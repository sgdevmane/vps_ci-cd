# VPS CI/CD

<div align="center">

![VPS CI/CD Logo](/web/public/logo.png)

**Self-hosted, high-availability, webhook-driven git sync & automated deployment runner for your VPS.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Svelte 5](https://img.shields.io/badge/frontend-svelte_5-ff3e00.svg)](https://svelte.dev)
[![Docker](https://img.shields.io/badge/docker-ready-2496ed.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/database-postgresql_%7C_sqlite-336791.svg)](https://www.postgresql.org)
[![Prometheus](https://img.shields.io/badge/metrics-prometheus-e6522c.svg)](https://prometheus.io)
[![Swagger](https://img.shields.io/badge/docs-openapi_3.0-85ea2d.svg)](http://localhost:19443/api/docs)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## 🚀 Overview

VPS CI/CD bridges your git hosting providers (GitHub, GitLab, Bitbucket, Gitea, Forgejo, Gogs, or generic curl/POST webhooks) directly to your server file system. When code is pushed to your repositories:

1. Inbound webhook arrives with cryptographic signature verification (HMAC-SHA256).
2. The bound directory on your server is cloned or fast-forwarded/hard-reset to match the remote branch.
3. Ordered post-sync shell commands execute sequentially (with decrypted environment variable injection).
4. Output is streamed live to connected browsers via Server-Sent Events (SSE).
5. Post-deployment HTTP healthcheck verifies system readiness with automatic rollback on failure.
6. Real-time notification cards are dispatched to Slack, Discord, Telegram, or custom webhooks.

```mermaid
flowchart LR
    A[Git Push] --> B[Inbound Webhook]
    B --> C{Verify HMAC / Token}
    C -->|Valid| D[Git Sync / Clone]
    C -->|Invalid| X[Rejected & Logged]
    D --> E[Inject Encrypted Env Vars]
    E --> F[Run Post-Sync Commands]
    F --> G[Live SSE Stream to UI]
    F --> H{Healthcheck Probe}
    H -->|Pass| I[Dispatch Success Alerts]
    H -->|Fail & Auto-Rollback| J[Revert Commit & Alert]
```

---

## ✨ Features

- **Multiple Sync Services**: Bind any directory on your server (any path) to any repository. Mix GitHub, GitLab, Bitbucket, Gitea/Forgejo, Gogs, and generic webhooks freely.
- **High Availability & Load Balancing**: Dual backend cluster (`backend-1`, `backend-2`) behind an Nginx reverse proxy with healthcheck failover and least-connection load distribution.
- **Dual Database Architecture**: Connect to a remote PostgreSQL database via `DATABASE_URL` (with connection pooling) or use zero-config SQLite (`app.db`) for local runs. Includes full [`init.sql`](file:///Users/mctavish/github/vps_ci-cd/init.sql) DDL.
- **Real-Time SSE Live Log Streaming**: Zero-latency log output streamed live to the browser as commands execute.
- **Universal Git Webhook Engine**: Timing-safe HMAC-SHA256 signature verification for **GitHub** (`X-Hub-Signature-256`), **GitLab** (`X-Gitlab-Token`), **Gitea / Forgejo** (`X-Gitea-Signature`), **Gogs** (`X-Gogs-Signature`), **Bitbucket** token verification, and **Generic** headers/tokens.
- **Branch Routing Strategies**:
  - *Follow webhook branch*: A push to `staging` syncs `staging`, a push to `main` syncs `main`.
  - *Fixed branch*: Always checkout one designated branch (e.g. `production`).
  - *Current branch*: Keep whatever branch is checked out and pull latest changes.
  - *Allowed branches filter*: Restrict builds to specific branches (e.g. `main, staging`); others are logged as skipped.
- **Post-Sync Command Pipeline**:
  - Sequential shell commands with `{branch}` and `{sha}` placeholder substitutions.
  - Per-command branch filtering and `continue-on-error` options.
- **Outbound Notifications Hub**: Real-time deployment alert dispatching to **Slack**, **Discord Webhooks**, **Telegram Bots**, and **Custom JSON Webhooks**.
- **Instant One-Click Rollbacks**: Browse git commit history and revert the repository to any previous commit — deployment commands re-run automatically against the rolled-back tree.
- **Healthcheck Guards & Auto-Rollback**: Automatic post-deployment HTTP endpoint probe. When enabled, a failing probe instantly reverts to the previously deployed commit, re-runs commands and re-verifies.
- **Maintenance Mode**: Suspend a service's deployments without disabling its webhook — triggers complete as *skipped* with a clear audit note.
- **Security Audit Trail**: Every sign-in, configuration change, rollback and recovery action is recorded in an append-only audit log, browsable in *Settings → Security Audit Trail*.
- **Webhook Rate Limiting**: Inbound hooks are throttled per service + IP (120 req/min) with proper `429` + `Retry-After` responses to stop floods and signature brute-forcing.
- **Encrypted Environment Variables**: AES-256-GCM authenticated encryption at rest for sensitive service-level environment variables.
- **Dynamic Shields.io SVG Badges**: Live SVG deployment status badges (`/api/badges/:serviceId/status.svg`) for repository READMEs.
- **System Health Telemetry**: Live CPU load, RAM usage, and disk capacity monitoring in the UI header and via `/api/system/health`.
- **Disaster Recovery Backup / Restore**: Export and import full JSON snapshots of services, commands, settings, and notification channels.
- **In-App Webhook Simulator & Confetti**: Test and debug webhook payloads directly from the browser panel with celebratory particle effects.
- **Developer CLI Tool (`vps-cli`)**: Full terminal management tool for services, syncs, rollbacks, and logs.
- **Full Observability & Developer API**: Prometheus metrics (`/api/metrics`), Grafana dashboard (`13000`), Swagger UI (`/api/docs`), and importable Postman collection.

---

## 🏗️ High-Availability Architecture

```
                                  ┌───────────────────────────┐
                                  │   Nginx Reverse Proxy     │
                                  │   (Host Port: 19443)      │
                                  └─────────────┬─────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │      Backend Instance 1     │                   │      Backend Instance 2     │
        │      (Port: 3000 Internal)  │                   │      (Port: 3000 Internal)  │
        └──────────────┬──────────────┘                   └──────────────┬──────────────┘
                       │                                                 │
                       └────────────────────────┬────────────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │   Prometheus & Grafana      │                   │     Remote PostgreSQL DB    │
        │   (Ports: 19090 / 13000)    │                   │   (or SQLite app.db)        │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 📦 Quick Start & Local Run

### Requirements
- Node.js ≥ 20
- `git` installed on host (with SSH keys configured if pulling from private repositories)

### Setup & Run
```bash
# 1. Install dependencies across workspaces
npm install

# 2. Build Svelte frontend
npm run build

# 3. Start local development server (with Vite HMR middleware)
npm run dev

# 4. Or start production standalone server
npm start
```

The startup banner displays the port. Without a `PORT` env var, a random 5-digit port is chosen on first boot and remembered in `data/runtime.json` (so webhook URLs stay stable). Open `http://your-vps:<port>` and sign in with the default credentials:

```
username: admin
password: admin123
```

You will be asked to set your own password on first login. Then set a **security question** in *Settings* — it is the only password-recovery path.

---

## 🐳 Docker Deployment

VPS CI/CD provides production and staging Docker configurations exposing dedicated non-standard ports to prevent port conflicts with standard services (3000, 8000, 8080, 80, 443).

### Production High-Availability (2 Backend Instances + Nginx + Prometheus + Grafana)

```bash
# Start production containers (Nginx on port 19443)
npm run docker:prod:up

# View logs across all cluster services
npm run docker:prod:logs

# Tear down production containers
npm run docker:prod:down
```

### Staging Environment

```bash
# Start staging containers (Nginx on port 19444)
npm run docker:staging:up

# Tear down staging containers
npm run docker:staging:down
```

### Port Mappings in Docker

| Service | Environment | Host Port | Purpose |
| :--- | :--- | :--- | :--- |
| **Nginx Web & API Proxy** | Production | `19443` | Main Web UI, API, SSE Stream, and Webhooks |
| **Nginx Web & API Proxy** | Staging | `19444` | Staging Web UI, API, and Webhooks |
| **Prometheus** | Production | `19090` | Telemetry Metrics Scraper |
| **Prometheus** | Staging | `19091` | Staging Metrics Scraper |
| **Grafana** | Production | `13000` | Monitoring Dashboards (login from `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`) |
| **Grafana** | Staging | `13001` | Staging Monitoring Dashboards |

> **Note (HA + SQLite):** the production stack runs two backend instances sharing one data volume. SQLite is hardened for this (WAL + busy-timeout), but for heavy multi-instance write loads a remote PostgreSQL `DATABASE_URL` is recommended.

---

## 🖥️ Bare-Metal & Process Manager Deployment

### 1. systemd Service (Recommended for Bare-Metal)

```bash
sudo useradd -m deploy            # or reuse an existing user
sudo mkdir -p /opt/vps-ci-cd && sudo chown deploy:deploy /opt/vps-ci-cd
# As deploy user: clone the project, npm install, npm run build, add .env
sudo cp deploy/vps-ci-cd.service /etc/systemd/system/
sudo sed -i 's/User=deploy/User=<your-user>/; s|/opt/vps-ci-cd|<install-dir>|g' /etc/systemd/system/vps-ci-cd.service
sudo systemctl daemon-reload
sudo systemctl enable --now vps-ci-cd
```

### 2. PM2

```bash
npm i -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

### 3. Standalone Nginx Reverse Proxy Example

```nginx
server {
    listen 443 ssl http2;
    server_name deploy.example.com;

    ssl_certificate /etc/letsencrypt/live/deploy.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deploy.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:19443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

Then in **Settings → Public Base URL**, set `https://deploy.example.com` and set `COOKIE_SECURE=true`.

---

## 🔗 Connecting a Repository

Create a **service** in the panel (*Services → New service*). Each service gets a unique webhook URL:

```
https://your-vps:<port>/api/hooks/<token>
```

### GitHub
Repo → *Settings → Webhooks → Add webhook*:
- **Payload URL**: the service's webhook URL
- **Content type**: `application/json`
- **Secret**: paste the secret from the service
- **Events**: *Just the push event*

### GitLab
Repo → *Settings → Webhooks*:
- **URL**: the service's webhook URL
- **Secret token**: the service's secret
- **Trigger**: *Push events*

### Bitbucket
Repo → *Repository settings → Webhooks → Add webhook*:
- **URL**: the service's webhook URL (append `?token=<secret>` if you set one)
- **Triggers**: *Repository push*

### Gitea / Forgejo (including Codeberg)
Repo → *Settings → Webhooks → Add webhook → Gitea*:
- **Target URL**: the service's webhook URL
- **Secret**: the service's secret (`X-Gitea-Signature` / `X-Forgejo-Signature`)
- **Trigger on**: *Push events*

### Gogs
Repo → *Settings → Webhooks → Add webhook*:
- **Payload URL**: the service's webhook URL
- **Secret**: the service's secret (`X-Gogs-Signature`)
- **Trigger**: *Push*

### Generic Curl / Automation
Point any automation that can POST JSON at the URL. Include the secret token in the configured header (default `X-Webhook-Token`) or as `?token=…`.

---

## ⚙️ Environment Variables

Configure environment variables via `.env.production`, `.env.staging`, or `.env.local`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Environment mode (`development` or `production`) |
| `PORT` | `3000` | Internal backend server listening port |
| `PROD_PORT` | `19443` | Host port exposed by Nginx in production |
| `STAGING_PORT` | `19444` | Host port exposed by Nginx in staging |
| `PROMETHEUS_PORT` | `19090` / `19091` | Host port for Prometheus (prod / staging) |
| `GRAFANA_PORT` | `13000` / `13001` | Host port for Grafana (prod / staging) |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana administrator username |
| `GRAFANA_ADMIN_PASSWORD` | `change-me` | Grafana administrator password — **set this before deploying** |
| `DATABASE_URL` | `""` | Remote PostgreSQL connection string (`postgres://user:pass@host:5432/db`) |
| `PG_SSL` | `false` | Enable TLS/SSL for PostgreSQL connection |
| `DATA_DIR` | `/app/data` | Directory for local data runtime files and SQLite storage |
| `DATABASE_FILE` | `<DATA_DIR>/app.db` | Explicit SQLite database path override |
| `SESSION_DAYS` | `7` | Administrator session cookie duration in days |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS/TLS |
| `DEFAULT_ADMIN_USER`| `admin` | Initial admin username on clean database boot |
| `DEFAULT_ADMIN_PASS`| `admin123` | Initial admin password on clean database boot |
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics endpoint at `/api/metrics` |
| `SWAGGER_ENABLED` | `true` | Enable OpenAPI Swagger documentation at `/api/docs` |

---

## 🛠️ CLI Companion (`vps-cli`)

Manage your VPS CI/CD runner directly from your terminal using `vps-cli`:

```bash
# 1. Sign in to your VPS CI/CD instance
./scripts/vps-cli.mjs login http://localhost:19443 admin admin123

# 2. List all configured sync services
./scripts/vps-cli.mjs list

# 3. Trigger manual deployment
./scripts/vps-cli.mjs sync 1 --branch main

# 4. View trigger execution logs
./scripts/vps-cli.mjs logs 42

# 5. Rollback service to a previous commit SHA
./scripts/vps-cli.mjs rollback 1 a1b2c3d4e5f6

# 6. Check live system health
./scripts/vps-cli.mjs health
```

---

## 🧪 Webhook Simulation & Testing

You can simulate webhook payloads in two ways:

1. **In-Browser Simulator**: Click **Test Webhook** on any service in the web dashboard.
2. **Terminal Simulation Script**:
```bash
npm run simulate:hook -- "http://localhost:19443/api/hooks/<token>" \
  --provider github --secret <secret> --branch main
```

---

## 🔄 Trigger Execution Lifecycle

1. **Verification**: Inbound HMAC signature / secret token is verified (mismatches are stored as *rejected* and answered `401`). Requests are rate-limited per service + IP (120/min → `429`).
2. **Event Filter**: Non-push events are stored as *skipped*.
3. **Branch Filter**: Pushed branch is checked against the configured allowed list.
4. **Queue Serialization**: Run is queued — one run per service at a time; if a run is already active, latest pending trigger wins.
5. **Git Sync**: `git fetch` → checkout target branch → `pull --ff-only` or `reset --hard origin/<branch>` (auto-clones if folder is empty). Rollback triggers instead `reset --hard <commit>`.
6. **Encrypted Env Injection**: Decrypts service environment variables and injects them into process execution.
7. **Command Pipeline**: Runs configured commands sequentially, streaming log chunks in real-time via SSE.
8. **Healthcheck Probe & Auto-Rollback**: Probes `healthcheck_url` (if set). On failure with *auto-rollback* enabled, the service reverts to the previously deployed commit, re-runs the command pipeline and re-verifies.
9. **Notifications Dispatch**: Dispatches alerts to Slack, Discord, Telegram, and Webhook channels.

---

## 🔌 API Documentation & Postman

### Interactive Swagger UI
Access the interactive API explorer at:
```
http://<server-host>:19443/api/docs
```
Raw OpenAPI 3.0 specification JSON:
```
http://<server-host>:19443/api/docs/swagger.json
```

### Postman Collection
Import [`vps-ci-cd.postman_collection.json`](file:///Users/mctavish/github/vps_ci-cd/vps-ci-cd.postman_collection.json) directly into Postman. It includes all endpoints for authentication, services, rollbacks, env vars, notifications, webhooks, and telemetry.

---

## 📂 Project Structure

```
server/src/
  index.js            # Express app, static UI middleware, boot, graceful shutdown
  config.js           # Environment-driven configuration
  db/                 # Knex instance, migrations (SQLite & PostgreSQL)
  auth/               # Sessions, first-boot admin, password reset
  routes/             # Auth, services, triggers, notifications, badges, system, settings, hooks
  core/               # Git engine, command runner, SSE hub, notifications, crypto vault,
                      #   metrics, systemInfo, audit trail
  webhooks/           # Signature verification + payload parsing
web/src/
  App.svelte          # Auth gate, shell, router
  components/         # BrandMark, modals (Simulator, Rollback, Badges, Notifications),
                      #   status badges, log viewer, header, sidebar
  pages/              # Login, dashboard (parallax carousel), services, editor, activity, settings
deploy/
  Dockerfile.server   # Multi-stage Node 20 container with git & ssh (prod-deps only)
  Dockerfile.web      # Vite build + Alpine Nginx container
  nginx/              # Load balancer configuration (keepalive, SSE-friendly)
  prometheus/         # Prometheus scrape configs (production + staging)
  grafana/            # Provisioned datasources and dashboards (prod + staging variants)
  vps-ci-cd.service   # systemd unit
  ecosystem.config.cjs# PM2 configuration
scripts/
  vps-cli.mjs         # Standalone developer CLI companion tool
  simulate-webhook.mjs# Webhook simulation test helper
  lint-server.mjs     # Server source syntax linting
public assets
  favicon.svg / logo.svg / logo.png / apple-touch-icon.png / og-image.png
```

---

## 🛡️ Security & Best Practices

1. **Change Default Credentials**: Change initial admin password immediately upon first boot.
2. **Setup Security Question**: Configure recovery security question in Settings.
3. **Use Webhook Secrets**: Configure strong random secrets on each service.
4. **Encrypted Environment Variables**: Store database passwords and API tokens in the service Environment Variables vault (encrypted with AES-256-GCM).
5. **HTTPS / TLS Reverse Proxy**: Set `COOKIE_SECURE=true` when terminating TLS with Nginx or Cloudflare.
6. **Harden the Observability Stack**: Set `GRAFANA_ADMIN_PASSWORD` before deploying, and consider firewalling the Prometheus/Grafana ports (`19090`/`13000`) to trusted networks.
7. **Audit Trail**: Review *Settings → Security Audit Trail* for sign-ins, failed logins, configuration changes, and rollback actions.
8. **Defense in Depth (Nginx layer)**: `server_tokens off`, strict security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), and per-service webhook rate limiting.
9. **Graceful Shutdown & Session Hygiene**: SIGTERM-safe draining on redeploy; expired sessions are purged every 6 hours.

---

## 📄 License

MIT © VPS CI/CD Maintainers
