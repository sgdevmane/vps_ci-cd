import { db, insertReturning } from '../db/index.js';
import { syncService } from './git.js';
import { execCommand } from './exec.js';
import { nowIso, parseList, indent } from '../util/misc.js';
import { activeSyncs, syncDuration, triggersTotal } from './metrics.js';

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

function logLine(lines, message) {
  lines.push(`[${nowIso()}] ${message}`);
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

  const q = queueFor(serviceId);
  if (q.running) {
    // Deployment semantics: only the newest pending trigger is worth running.
    for (const oldId of q.pending) {
      await db('triggers').where({ id: oldId }).update({
        status: 'skipped',
        finished_at: nowIso(),
        log: `[${nowIso()}] Superseded by a newer trigger while a run was already in progress.`,
      });
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

async function runTrigger(serviceId, triggerId) {
  const [service, trigger] = await Promise.all([
    db('services').where({ id: serviceId }).first(),
    db('triggers').where({ id: triggerId }).first(),
  ]);
  if (!service || !trigger) return;

  const lines = [];
  const log = (msg) => logLine(lines, msg);
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

  let status = 'success';
  try {
    if (!service.enabled) {
      status = 'skipped';
      log('Service is disabled — nothing to do.');
    } else {
      const { branch, sha } = await syncService(service, trigger.branch, log);
      log(`Repository synced — branch "${branch}" @ ${String(sha).slice(0, 7)}`);

      const commands = await db('commands')
        .where({ service_id: serviceId })
        .orderBy('position', 'asc')
        .orderBy('id', 'asc');
      const matching = commands.filter(
        (c) => !c.branch_filter || parseList(c.branch_filter).includes(branch),
      );
      if (matching.length === 0) {
        log(commands.length === 0 ? 'No commands configured for this service.' : `No commands match branch "${branch}" — done.`);
      }
      for (const c of matching) {
        const command = substitutePlaceholders(c.command, { branch, sha });
        if (c.branch_filter) log(`Running (branch filter "${c.branch_filter}"):`);
        log(`$ ${command}`);
        const { code, output } = await execCommand(command, service.folder_path);
        if (output.trim()) log(indent(output.replace(/\s+$/, '')));
        if (code !== 0) {
          log(`Command exited with code ${code}.`);
          if (c.continue_on_error) {
            log('"Continue on error" is enabled — moving to the next command.');
            continue;
          }
          status = 'failed';
          break;
        }
      }
    }
  } catch (err) {
    status = 'failed';
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
}
