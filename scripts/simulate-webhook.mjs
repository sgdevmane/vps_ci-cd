#!/usr/bin/env node
// Simulate a signed webhook delivery against one of this app's hook URLs.
// Usage:
//   node scripts/simulate-webhook.mjs <hook-url> [--secret <s>] [--provider github|gitlab|generic] [--branch <b>] [--sha <hex>]
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const url = args.find((a) => a.startsWith('http'));
if (!url) {
  console.error(
    'Usage: node scripts/simulate-webhook.mjs <hook-url> [--secret <s>] [--provider github|gitlab|generic] [--branch <b>] [--sha <hex>]',
  );
  process.exit(1);
}

const secret = get('--secret', '');
const provider = get('--provider', 'github');
const branch = get('--branch', 'main');
const sha = get('--sha', crypto.randomBytes(20).toString('hex'));
const body = JSON.stringify({ ref: `refs/heads/${branch}`, after: sha });

const headers = { 'Content-Type': 'application/json' };
if (provider === 'github') {
  headers['X-GitHub-Event'] = 'push';
  if (secret) {
    headers['X-Hub-Signature-256'] =
      'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
} else if (provider === 'gitlab') {
  headers['X-Gitlab-Event'] = 'Push Hook';
  if (secret) headers['X-Gitlab-Token'] = secret;
} else if (secret) {
  headers['X-Webhook-Token'] = secret;
}

const res = await fetch(url, { method: 'POST', headers, body });
console.log(`HTTP ${res.status}`);
console.log(await res.text());
