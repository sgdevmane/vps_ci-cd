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
3. Ordered post-sync shell commands execute sequentially (e.g., container builds, asset compilation, service restarts).
4. Output and execution telemetry are recorded with real-time logs, Prometheus metrics, and status badges.

```mermaid
flowchart LR
    A[Git Push] --> B[Inbound Webhook]
    B --> C{Verify HMAC / Token}
    C -->|Valid| D[Git Sync / Clone]
    C -->|Invalid| X[Rejected & Logged]
    D --> E[Run Post-Sync Commands]
    E --> F[Prometheus Telemetry]
    E --> G[Live UI Dashboard]
```

---

## ✨ Features

- **High Availability & Zero-Downtime Deployment**
  - Multi-instance backend cluster (`backend-1` and `backend-2`) behind an Nginx load balancer.
  - Healthcheck failover and least-connection load distribution.
- **Dual Database Architecture**
  - **Remote PostgreSQL**: Configure `DATABASE_URL` to connect to cloud or private PostgreSQL databases with connection pooling.
  - **Zero-Config SQLite**: Built-in `better-sqlite3` storage for single-node local runs.
  - **Schema Init Script**: [`init.sql`](file:///Users/mctavish/github/vps_ci-cd/init.sql) provided for bootstrapping fresh PostgreSQL databases.
- **Universal Git Webhook Engine**
  - Native HMAC signature verification for **GitHub** (`X-Hub-Signature-256`), **GitLab** (`X-Gitlab-Token`), **Gitea / Forgejo** (`X-Gitea-Signature`), **Gogs** (`X-Gogs-Signature`), **Bitbucket** token checks, and **Generic** endpoints.
- **Branch Routing Strategies**
  - _Follow webhook branch_: Dynamic branch tracking.
  - _Fixed branch_: Always synchronize to a designated branch (e.g. `main` or `production`).
  - _Current branch_: Keep whatever branch is checked out and pull latest changes.
  - _Allowed branch filter_: Restrict builds to specific branches (e.g. `main, staging`).
- **Post-Sync Command Pipeline**
  - Parameterized commands with `{branch}` and `{sha}` placeholder substitutions.
  - Per-command branch filters and optional `continue-on-error` execution flags.
- **In-App Webhook Simulator & Confetti**
  - Test and debug webhook payloads directly from the browser panel before configuring provider settings.
  - Celebratory visual feedback on successful manual triggers, service creations, and deployments.
- **Full Observability & Developer API**
  - **Prometheus Metrics**: Exported at `/api/metrics` with request counts, active deployments, and latency histograms.
  - **Grafana Dashboard**: Auto-provisioned overview dashboard visualizing deployment health and server performance.
  - **Interactive Swagger UI**: OpenAPI 3.0 interactive documentation at `/api/docs`.
  - **Postman Collection**: [`vps-ci-cd.postman_collection.json`](file:///Users/mctavish/github/vps_ci-cd/vps-ci-cd.postman_collection.json) importable for external systems.

---

## 🏗️ Architecture

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

### Prerequisites
- Node.js ≥ 20
- `git` installed on host / server

```bash
# 1. Install workspace dependencies
npm install

# 2. Build Svelte frontend
npm run build

# 3. Start local development server (with Vite HMR middleware)
npm run dev

# 4. Start production standalone server
npm start
```

On first startup, the server prints default admin credentials in the terminal:
- **Username**: `admin`
- **Password**: `admin123`

You will be prompted to change the default password and configure a security recovery question in **Settings**.

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

### Default Port Mappings in Docker

| Service | Environment | Host Port | Purpose |
| :--- | :--- | :--- | :--- |
| **Nginx Web & API Proxy** | Production | `19443` | Main Web UI, API, and Webhooks |
| **Nginx Web & API Proxy** | Staging | `19444` | Staging Web UI, API, and Webhooks |
| **Prometheus** | Production | `19090` | Telemetry Metrics Scraper |
| **Prometheus** | Staging | `19091` | Staging Metrics Scraper |
| **Grafana** | Production | `13000` | Monitoring Dashboards (login: `admin`/`admin`) |
| **Grafana** | Staging | `13001` | Staging Monitoring Dashboards |

---

## ⚙️ Environment Variables

Configure environment variables via `.env.production`, `.env.staging`, or `.env.local`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Environment mode (`development` or `production`) |
| `PORT` | `3000` | Internal backend server listening port |
| `PROD_PORT` | `19443` | Host port exposed by Nginx in production |
| `STAGING_PORT` | `19444` | Host port exposed by Nginx in staging |
| `DATABASE_URL` | `""` | Remote PostgreSQL connection string (`postgres://user:pass@host:5432/db`) |
| `PG_SSL` | `false` | Enable TLS/SSL for PostgreSQL connection |
| `DATA_DIR` | `/app/data` | Directory for local data runtime files and SQLite storage |
| `SESSION_DAYS` | `7` | Administrator session cookie duration in days |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS/TLS |
| `DEFAULT_ADMIN_USER`| `admin` | Initial admin username on clean database boot |
| `DEFAULT_ADMIN_PASS`| `admin123` | Initial admin password on clean database boot |
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics endpoint at `/api/metrics` |
| `SWAGGER_ENABLED` | `true` | Enable OpenAPI Swagger documentation at `/api/docs` |

---

## 🔌 API & Tooling

### Interactive Swagger UI
Access the complete API explorer in your browser:
```
http://<server-host>:19443/api/docs
```
Raw OpenAPI specification JSON is available at:
```
http://<server-host>:19443/api/docs/openapi.json
```

### Postman Collection
Import [`vps-ci-cd.postman_collection.json`](file:///Users/mctavish/github/vps_ci-cd/vps-ci-cd.postman_collection.json) directly into Postman. It includes:
- Authentication & session cookies management
- Service creation, updating, listing, and deletion
- Immediate manual trigger dispatch
- Webhook simulation requests with signature headers
- System telemetry and health checks

---

## 🛡️ Security & Best Practices

1. **Change Default Credentials**: Change the initial administrator password immediately upon first boot.
2. **Setup Security Question**: Configure the recovery security question in Settings as the fail-safe recovery path.
3. **Use Webhook Secrets**: Always configure a strong random secret on each service and match it in your git provider settings.
4. **HTTPS / TLS Reverse Proxy**: When exposing VPS CI/CD publicly, set `COOKIE_SECURE=true` and terminate TLS with Certbot/Nginx.
5. **Least Privilege**: The process only requires write permissions on directories intended for synchronization.

---

## 📄 License

MIT © VPS CI/CD Maintainers
