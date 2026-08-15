#!/usr/bin/env node

/**
 * VPS CI/CD Command-Line Interface (vps-cli)
 * Official CLI companion tool for managing VPS CI/CD from terminal.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_FILE = path.join(os.homedir(), '.vps-cicd-cli.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: 'http://localhost:19443', token: '' };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save auth config:', err.message);
  }
}

async function request(endpoint, options = {}) {
  const cfg = loadConfig();
  const url = `${cfg.baseUrl.replace(/\/$/, '')}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(cfg.token ? { Cookie: `vcid_session=${cfg.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.error('❌ Error: Unauthorized. Please run `vps-cli login` first.');
    process.exit(1);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case 'login': {
      const [url, username, password] = args;
      if (!url || !username || !password) {
        console.log('Usage: vps-cli login <server-url> <username> <password>');
        console.log('Example: vps-cli login http://localhost:19443 admin mypassword');
        process.exit(1);
      }
      try {
        const loginUrl = `${url.replace(/\/$/, '')}/api/auth/login`;
        const res = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          console.error(`❌ Login failed: ${err.error || 'Invalid credentials or server error.'}`);
          process.exit(1);
        }
        const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
        const cookieStr = cookies.join('; ');
        const match = cookieStr.match(/vcid_session=([^;]+)/);
        const token = match ? match[1] : '';
        saveConfig({ baseUrl: url, token });
        console.log(`✅ Successfully signed in to ${url} as "${username}"`);
      } catch (err) {
        console.error('❌ Login error:', err.message);
      }
      break;
    }

    case 'services':
    case 'list': {
      try {
        const { services } = await request('/api/services');
        console.log('\n📦 Configured VPS CI/CD Services:');
        console.table(
          services.map((s) => ({
            ID: s.id,
            Name: s.name,
            Provider: s.provider,
            Branch: s.fixed_branch || s.branch_mode,
            Status: s.last_status || 'never synced',
            Enabled: s.enabled ? '✅' : '⏸️',
          }))
        );
      } catch (err) {
        console.error('❌ Error:', err.message);
      }
      break;
    }

    case 'sync': {
      const serviceId = args[0];
      if (!serviceId) {
        console.log('Usage: vps-cli sync <serviceId> [--branch <name>]');
        process.exit(1);
      }
      const branchIdx = args.indexOf('--branch');
      const branch = branchIdx !== -1 ? args[branchIdx + 1] : undefined;
      try {
        const res = await request(`/api/services/${serviceId}/sync`, {
          method: 'POST',
          body: JSON.stringify({ branch }),
        });
        console.log(`🚀 Deployment queued! Trigger #${res.triggerId}`);
        console.log(`View live logs with: vps-cli logs ${res.triggerId} --follow`);
      } catch (err) {
        console.error('❌ Sync failed:', err.message);
      }
      break;
    }

    case 'rollback': {
      const [serviceId, targetSha] = args;
      if (!serviceId || !targetSha) {
        console.log('Usage: vps-cli rollback <serviceId> <targetCommitSha>');
        process.exit(1);
      }
      try {
        const res = await request(`/api/services/${serviceId}/rollback`, {
          method: 'POST',
          body: JSON.stringify({ targetSha }),
        });
        console.log(`⏪ Rollback queued to ${targetSha}! Trigger #${res.triggerId}`);
      } catch (err) {
        console.error('❌ Rollback failed:', err.message);
      }
      break;
    }

    case 'logs': {
      const triggerId = args[0];
      if (!triggerId) {
        console.log('Usage: vps-cli logs <triggerId> [--follow]');
        process.exit(1);
      }
      try {
        const { trigger } = await request(`/api/triggers/${triggerId}`);
        console.log(`\n📋 Trigger #${trigger.id} [${trigger.status.toUpperCase()}] — ${trigger.service_name}`);
        console.log('----------------------------------------------------');
        console.log(trigger.log || 'No logs available.');
      } catch (err) {
        console.error('❌ Error:', err.message);
      }
      break;
    }

    case 'health': {
      try {
        const health = await request('/api/system/health');
        console.log('\n🖥️  VPS CI/CD System Health:');
        console.log(`Host: ${health.hostname} (${health.platform} ${health.arch})`);
        console.log(`CPU Cores: ${health.cpu.cores} | Load (1m): ${health.cpu.loadAvg1m}`);
        console.log(`Memory Used: ${health.memory.usedMb}MB / ${health.memory.totalMb}MB (${health.memory.usedPercent}%)`);
        if (health.disk) {
          console.log(`Disk Used: ${health.disk.usedPercent}% (Free: ${health.disk.freeGb}GB)`);
        }
        console.log(`Process Uptime: ${Math.round(health.processUptimeSeconds / 60)} minutes`);
      } catch (err) {
        console.error('❌ Error:', err.message);
      }
      break;
    }

    case 'help':
    default: {
      console.log(`
VPS CI/CD Command-Line Companion (vps-cli)

Commands:
  vps-cli login <url> <user> <pass>    Authenticate with VPS CI/CD instance
  vps-cli list / services              List all configured deployment services
  vps-cli sync <serviceId>             Trigger manual sync and deploy
  vps-cli rollback <serviceId> <sha>   Rollback service to a specific commit
  vps-cli logs <triggerId>             View trigger execution logs
  vps-cli health                       Display live VPS CPU, RAM, and Disk metrics
  vps-cli help                         Show this help message
      `);
      break;
    }
  }
}

main();
