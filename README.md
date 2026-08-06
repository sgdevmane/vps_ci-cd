# VPS CI/CD

A self-hosted, webhook-driven sync & deploy runner for your VPS. Point GitHub / GitLab (or any webhook source) at one URL; when you push, the bound folder on the server syncs to the right branch and your post-sync commands run — with every run fully logged in a clean web panel.

```
push to main ──▶ webhook ──▶ verify secret ──▶ git sync folder ──▶ run commands ──▶ logged
```

## Features

- **Multiple sync services** — bind any folder on the server (anywhere) to any repo. Mix GitHub, GitLab and generic webhook sources freely.
- **Branch control per service**
  - *Follow webhook branch* — a push to `staging` checks out `staging`, a push to `main` checks out `main`.
  - *Fixed branch* — the folder always switches to one configured branch.
  - *Stay on current branch* — never switch, only refresh.
  - Optional **allowed-branches list** (e.g. `main, staging`); other pushes are logged as *skipped*.
- **Sync modes** — `pull` (fast-forward, default) or `reset` (hard-reset to the remote branch), per service.
- **Auto-clone** — if the folder is empty / not a repository yet, the repo is cloned on first trigger.
- **Post-sync commands** — ordered shell commands run in the folder after a successful sync.
  - `{branch}` and `{sha}` placeholders, e.g. `npm run docker:{branch}:up`.
  - Optional per-command **branch filter** (run only when the synced branch matches).
  - Optional **continue-on-error** per command.
- **Webhook secrets** — GitHub `X-Hub-Signature-256` (HMAC SHA-256), GitLab `X-Gitlab-Token`, or a generic token header / `?token=` query param. Verified with timing-safe comparison.
- **Trigger history** — every webhook (accepted, skipped, rejected) and manual run is stored with a full timestamped log (git output + command output), viewable in the panel.
- **Auth** — single admin account with default credentials (change after login, no registration), session cookies, login throttling, and **password reset via security question**.
- **UI** — Svelte SPA, dark/light theme, sidebar + header layout, responsive.
- **SQLite today, PostgreSQL later** — data access goes through Knex; switching is a client + connection change.

## Requirements

- Node.js ≥ 20
- `git` available to the user running the server (SSH repos need a usable key for that user)

## Quick start

```bash
npm install          # installs server + web workspaces
npm run build        # builds the Svelte UI into web/dist
npm start            # boots the server (serves API + UI) on :3000
```

Open `http://your-vps:3000` and sign in with the default credentials:

```
username: admin
password: admin123
```

You'll be asked to set your own password on first login. Then set a **security question** in *Settings* — it is the only password-recovery path.

Development mode (hot reload + API proxy):

```bash
npm run dev          # server on :3000, UI on :5173
```

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All variables are optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | HTTP listen address |
| `DATA_DIR` | `./data` | Where the SQLite DB lives |
| `DATABASE_FILE` | `<DATA_DIR>/app.db` | Explicit DB path override |
| `SESSION_DAYS` | `7` | Session cookie lifetime |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `DEFAULT_ADMIN_USER` / `DEFAULT_ADMIN_PASS` | `admin` / `admin123` | Used only while the users table is empty |

## Connecting a repository

Create a **service** in the panel (*Services → New service*). Each service gets a unique webhook URL like:

```
https://your-vps:3000/api/hooks/<token>
```

### GitHub

Repo → *Settings → Webhooks → Add webhook*:

- **Payload URL**: the service's webhook URL
- **Content type**: `application/json`
- **Secret**: paste the secret from the service (or generate one in the panel and copy it)
- **Events**: *Just the push event* (other events are safely ignored)

### GitLab

Repo → *Settings → Webhooks*:

- **URL**: the service's webhook URL
- **Secret token**: the service's secret
- **Trigger**: *Push events*

### Anything else

Any tool that can POST JSON works. Send the token in the configured header (default `X-Webhook-Token`) or as `?token=…`. Payloads with a `ref` of the form `refs/heads/<branch>` (GitHub/GitLab push format) get full branch handling; a `branch` field also works.

### Testing without pushing

```bash
npm run simulate:hook -- "http://localhost:3000/api/hooks/<token>" \
  --provider github --secret <secret> --branch staging
```

## How a trigger runs

1. Signature / token is verified (mismatches are stored as *rejected* and answered `401`).
2. Non-push events and tag pushes are stored as *skipped*.
3. The pushed branch is checked against the allowed list (if configured).
4. The run is queued — one run per service at a time; if one is already running, only the newest pending trigger is kept.
5. `git fetch` → checkout the target branch → `pull --ff-only` or `reset --hard origin/<branch>` (clones first if the folder is empty and auto-clone is on).
6. Commands run top-to-bottom in the folder; a failing command stops the run unless *continue on error* is set.
7. Everything is written to the trigger log (view in *Activity*).

## Deploying on a VPS

### systemd (recommended)

```bash
sudo useradd -m deploy            # or reuse an existing user
sudo mkdir -p /opt/vps-ci-cd && sudo chown deploy:deploy /opt/vps-ci-cd
# as deploy: clone/copy the project, npm install, npm run build, add .env
sudo cp deploy/vps-ci-cd.service /etc/systemd/system/
sudo sed -i 's/User=deploy/User=<your-user>/; s|/opt/vps-ci-cd|<install-dir>|g' /etc/systemd/system/vps-ci-cd.service
sudo systemctl daemon-reload
sudo systemctl enable --now vps-ci-cd
```

Adjust `User=`, `Group=` and `WorkingDirectory=` in the unit to match your install.

### PM2

```bash
npm i -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

(Edit `cwd` in the ecosystem file to your install dir.)

### Behind a reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name deploy.example.com;
    # ... your cert config ...
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then set **Settings → Public base URL** to `https://deploy.example.com` so the webhook URLs shown in the panel are correct, and set `COOKIE_SECURE=true`.

## PostgreSQL (later)

All SQL goes through Knex (`server/src/db/index.js`). To switch:

1. `npm install -w server pg`
2. Change the client to `pg` and provide a connection object (or `connectionString`).
3. Re-run migrations (`npm start` runs `migrate.latest()` on boot).

The schema uses portable column types only.

## Project layout

```
server/src/
  index.js            # express app, static UI, boot
  config.js           # env-driven configuration
  db/                 # knex instance + migrations (SQLite)
  auth/               # sessions, first-boot admin
  routes/             # auth, services, triggers, settings, hooks (public)
  core/               # git sync engine, command runner, run queue
  webhooks/           # signature verification + payload parsing
web/src/
  App.svelte          # auth gate, shell, hash router
  components/         # sidebar, header, modals, badges, log viewer…
  pages/              # login, dashboard, services, editor, activity, settings
deploy/               # systemd unit + PM2 ecosystem
scripts/              # simulate-webhook + screenshot dev helpers
```

## Security notes

- Webhook secrets are stored as-is (they are shared HMAC secrets / tokens, required verbatim for verification).
- Commands are executed with the privileges of the server user — only trusted admins can edit services.
- Login attempts are throttled (5 failures → 15-minute lockout).
- Set `COOKIE_SECURE=true` and serve over HTTPS in production.
