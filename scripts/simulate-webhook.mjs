#!/usr/bin/env node
// Simulate a signed webhook delivery against one of this app's hook URLs.
// Usage:
//   node scripts/simulate-webhook.mjs <hook-url> [--secret <s>] [--provider github|gitlab|bitbucket|gitea|gogs|generic] [--branch <b>] [--sha <hex>]
import crypto from "node:crypto";

const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

let url = args.find((a) => a.startsWith("http"));
if (!url) {
  console.error(
    "Usage: node scripts/simulate-webhook.mjs <hook-url> [--secret <s>] [--provider github|gitlab|bitbucket|gitea|gogs|generic] [--branch <b>] [--sha <hex>]",
  );
  process.exit(1);
}

const secret = get("--secret", "");
const provider = get("--provider", "github");
const branch = get("--branch", "main");
const sha = get("--sha", crypto.randomBytes(20).toString("hex"));
const hmac = (body) =>
  crypto.createHmac("sha256", secret).update(body).digest("hex");

const refBody = JSON.stringify({ ref: `refs/heads/${branch}`, after: sha });
const headers = { "Content-Type": "application/json" };
let body = refBody;

switch (provider) {
  case "github":
    headers["X-GitHub-Event"] = "push";
    if (secret) headers["X-Hub-Signature-256"] = "sha256=" + hmac(body);
    break;
  case "gitlab":
    headers["X-Gitlab-Event"] = "Push Hook";
    if (secret) headers["X-Gitlab-Token"] = secret;
    break;
  case "bitbucket":
    body = JSON.stringify({
      push: { changes: [{ new: { name: branch, target: { hash: sha } } }] },
    });
    headers["X-Event-Key"] = "repo:push";
    if (secret)
      url +=
        (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(secret);
    break;
  case "gitea":
    headers["X-Gitea-Event"] = "push";
    if (secret) headers["X-Gitea-Signature"] = hmac(body);
    break;
  case "gogs":
    headers["X-Gogs-Event"] = "push";
    if (secret) headers["X-Gogs-Signature"] = hmac(body);
    break;
  default:
    if (secret) headers["X-Webhook-Token"] = secret;
}

const res = await fetch(url, { method: "POST", headers, body });
console.log(`HTTP ${res.status}`);
console.log(await res.text());
