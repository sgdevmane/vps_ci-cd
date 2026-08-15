import path from 'node:path';
import { db, insertReturning } from '../db/index.js';
import { syncService, rollbackService, currentSha } from './git.js';
import { execCommand } from './exec.js';
import { nowIso, parseList, indent } from '../util/misc.js';
import { activeSyncs, syncDuration, triggersTotal } from './metrics.js';
import { broadcastLogChunk, broadcastTriggerStatus } from './sse.js';
import { dispatchNotifications } from './notifications.js';
import { decryptValue } from './cryptoVault.js';

// Per-service serialization: one run at a time, latest pending trigger wins.
const queues = new Map(); // serviceId -> { running: boolean, pending: number[] }

function queueFor(serviceId) {
  let q = queues.get(serviceId);
  if (!q) {
    q = { running: false, pending: [] };
    queues.set(serviceId, q);
  }
  return q;
}

export async function enqueueTrigger(serviceId, info) {
  const triggerId = await insertReturning('triggers', {
    service_id: serviceId,
    source: info.source || 'webhook',
    status: 'queued',
    event: info.event || null,
    branch: info.branch || null,
    sha: info.sha || null,
    signature_ok: info.signatureOk ?? null,
    ip: info.ip || null,
    created_at: nowIso(),
    log: '',
  });

  broadcastTriggerStatus(triggerId, 'queued', { service_id: serviceId });

  const q = queueFor(serviceId);
  if (q.running) {
    // Deployment semantics: only the newest pending trigger is worth running.
    for (const oldId of q.pending) {
      await db('triggers').where({ id: oldId }).update({
        status: 'skipped',
        finished_at: nowIso(),
        log: `[${nowIso()}] Superseded by a newer trigger while a run was already in progress.`,
      });
      broadcastTriggerStatus(oldId, 'skipped', { service_id: serviceId });
    }
    q.pending = [triggerId];
  } else {
    q.pending.push(triggerId);
    setImmediate(() => drain(serviceId));
  }
  return triggerId;
}

async function drain(serviceId) {
  const q = queueFor(serviceId);
  if (q.running) return;
  const triggerId = q.pending.shift();
  if (triggerId == null) return;
  q.running = true;
  try {
    await runTrigger(serviceId, triggerId);
  } catch (err) {
    console.error(`Trigger ${triggerId} crashed:`, err);
  } finally {
    q.running = false;
    if (q.pending.length > 0) setImmediate(() => drain(serviceId));
  }
}

function substitutePlaceholders(command, vars) {
  return String(command)
    .replaceAll('{branch}', vars.branch || '')
    .replaceAll('{sha}', vars.sha || '');
}

async function fetchServiceEnv(serviceId) {
  const rows = await db('service_env').where({ service_id: serviceId });
  const env = {};
  for (const r of rows) {
    env[r.key] = decryptValue(r.value_enc);
  }
  return env;
}

async function checkHealth(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * Run the ordered post-sync command pipeline for a service.
 * Returns { ok, errorMessage }.
 */
async function executeCommandPipeline({ serviceId, triggerId, service, branch, sha, customEnv, log }) {
  const commands = await db('commands')
    .where({ service_id: serviceId })
    .orderBy('position', 'asc')
    .orderBy('id', 'asc');
  const matching = commands.filter(
    (c) => !c.branch_filter || parseList(c.branch_filter).includes(branch || ''),
  );
  if (matching.length === 0) {
    log(
      commands.length === 0
        ? 'No commands configured for this service.'
        : `No commands match branch "${branch || '—'}" — nothing to run.`,
    );
    return { ok: true, errorMessage: '' };
  }

  for (const c of matching) {
    const command = substitutePlaceholders(c.command, { branch: branch || '', sha: sha || '' });
    if (c.branch_filter) log(`Running (branch filter "${c.branch_filter}"):`);
    log(`$ ${command}`);
    const { code, output } = await execCommand(
      command,
      service.folder_path,
      customEnv,
      (chunk) => broadcastLogChunk(triggerId, chunk),
    );
    if (output.trim()) log(indent(output.replace(/\s+$/, '')));
    if (code !== 0) {
      log(`Command exited with code ${code}.`);
      if (c.continue_on_error) {
        log('"Continue on error" is enabled — moving to the next command.');
        continue;
      }
      return { ok: false, errorMessage: `Command failed with exit code ${code}` };
    }
  }
  return { ok: true, errorMessage: '' };
}

async function runTrigger(serviceId, triggerId) {
  const [service, trigger] = await Promise.all([
    db('services').where({ id: serviceId }).first(),
    db('triggers').where({ id: triggerId }).first(),
  ]);
  if (!service || !trigger) return;

  const lines = [];
  const log = (msg) => {
    const line = `[${nowIso()}] ${msg}`;
    lines.push(line);
    broadcastLogChunk(triggerId, line + '\n');
  };

  log(`Trigger #${triggerId} started (source: ${trigger.source}${trigger.event ? `, event: ${trigger.event}` : ''})`);
  if (trigger.branch) log(`Branch from trigger: ${trigger.branch}`);
  if (trigger.sha) log(`Commit from trigger: ${String(trigger.sha).slice(0, 12)}`);

  const startedAt = Date.now();
  activeSyncs.inc({ service_id: String(serviceId) });
  await db('triggers').where({ id: triggerId }).update({
    status: 'running',
    started_at: nowIso(),
    log: lines.join('\n'),
  });
  broadcastTriggerStatus(triggerId, 'running', { service_id: serviceId });

  // Dispatch Start Notification
  dispatchNotifications(serviceId, 'start', {
    serviceName: service.name,
    branch: trigger.branch,
    sha: trigger.sha,
    triggerId,
  }).catch(() => {});

  let status = 'success';
  let errorMessage = '';
  let syncedSha = trigger.sha;
  let syncedBranch = trigger.branch;

  try {
    if (!service.enabled) {
      status = 'skipped';
      log('Service is disabled — nothing to do.');
    } else if (service.maintenance_mode) {
      status = 'skipped';
      log('Maintenance mode is enabled for this service — deployments are suspended, nothing to do.');
    } else {
      const customEnv = await fetchServiceEnv(serviceId);
      const folder = path.resolve(service.folder_path);
      // Snapshot the commit deployed *before* this run — used for auto-rollback.
      const preDeploySha = trigger.source === 'rollback' ? null : await currentSha(folder);

      if (trigger.source === 'rollback' && trigger.sha) {
        log(`Rollback run — target commit ${String(trigger.sha).slice(0, 12)}`);
        const rb = await rollbackService(service, trigger.sha, log);
        syncedSha = rb.sha;
        syncedBranch = rb.branch || syncedBranch;
        log(`Repository rolled back — ${rb.branch ? `branch "${rb.branch}"` : 'detached HEAD'} @ ${String(rb.sha).slice(0, 7)}`);
      } else {
        const { branch, sha } = await syncService(service, trigger.branch, log);
        syncedSha = sha;
        syncedBranch = branch;
        log(`Repository synced — branch "${branch}" @ ${String(sha).slice(0, 7)}`);
      }

      const run = await executeCommandPipeline({
        serviceId, triggerId, service, branch: syncedBranch, sha: syncedSha, customEnv, log,
      });
      if (!run.ok) {
        status = 'failed';
        errorMessage = run.errorMessage;
      }

      // Post-sync healthcheck validation with optional automatic rollback.
      if (status === 'success' && service.healthcheck_url) {
        log(`Verifying healthcheck endpoint: ${service.healthcheck_url}`);
        const healthy = await checkHealth(service.healthcheck_url);
        if (!healthy) {
          log(`ERROR: Healthcheck probe failed at ${service.healthcheck_url}`);
          if (service.auto_rollback && trigger.source !== 'rollback' && preDeploySha) {
            log(`Auto-rollback is enabled — reverting "${service.name}" to ${preDeploySha.slice(0, 7)} and re-running deployment commands.`);
            try {
              const rb = await rollbackService(service, preDeploySha, log);
              syncedSha = rb.sha;
              const rerun = await executeCommandPipeline({
                serviceId, triggerId, service, branch: syncedBranch, sha: rb.sha, customEnv, log,
              });
              if (!rerun.ok) {
                status = 'failed';
                errorMessage = `Auto-rollback executed, but re-deployment failed: ${rerun.errorMessage}`;
                log(`ERROR: ${errorMessage}`);
              } else if (await checkHealth(service.healthcheck_url)) {
                log('Healthcheck passed after auto-rollback — service recovered on the previous commit.');
              } else {
                status = 'failed';
                errorMessage = `Healthcheck failed even after auto-rollback to ${preDeploySha.slice(0, 7)}`;
                log(`ERROR: ${errorMessage}`);
              }
            } catch (rbErr) {
              status = 'failed';
              errorMessage = `Auto-rollback failed: ${rbErr.message}`;
              log(`ERROR: ${errorMessage}`);
            }
          } else {
            status = 'failed';
            errorMessage = `Healthcheck failed on ${service.healthcheck_url}`;
          }
        } else {
          log('Healthcheck probe passed successfully.');
        }
      }
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    log(`ERROR: ${err.message}`);
  } finally {
    activeSyncs.dec({ service_id: String(serviceId) });
  }

  const finishedAt = nowIso();
  const durationMs = Date.now() - startedAt;
  syncDuration.observe({ service_id: String(serviceId), status }, durationMs / 1000);
  triggersTotal.inc({
    source: trigger.source || 'manual',
    status,
    provider: service.provider || 'unknown',
  });

  if (status === 'success') log('Completed successfully.');
  else if (status === 'failed') log('Finished with errors.');

  await db('triggers').where({ id: triggerId }).update({
    status,
    finished_at: finishedAt,
    duration_ms: durationMs,
    log: lines.join('\n'),
  });
  await db('services').where({ id: serviceId }).update({
    last_sync_at: finishedAt,
    last_status: status,
    updated_at: finishedAt,
  });

  broadcastTriggerStatus(triggerId, status, { service_id: serviceId, duration_ms: durationMs });

  // Dispatch Success or Failure Notifications (start events are dispatched in-run)
  if (status === 'success' || status === 'failed') {
    dispatchNotifications(serviceId, status, {
      serviceName: service.name,
      branch: syncedBranch,
      sha: syncedSha,
      durationMs,
      error: errorMessage || null,
      triggerId,
    }).catch(() => {});
  }
}
