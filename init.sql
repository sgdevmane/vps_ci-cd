-- ============================================================================
-- VPS CI/CD — PostgreSQL Database Initialization Schema
-- This script sets up a clean, production-ready database schema for VPS CI/CD.
-- ============================================================================

-- Ensure uuid/crypto extensions if required
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Users Table (Authentication and Recovery)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  security_question TEXT,
  security_answer_hash TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ----------------------------------------------------------------------------
-- 2. Sessions Table (Persistent User Login Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at VARCHAR(64) NOT NULL,
  expires_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ----------------------------------------------------------------------------
-- 3. Services Table (Folder ↔ Repository Sync Bindings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(64) NOT NULL DEFAULT 'github',
  repo_url TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  branch_mode VARCHAR(64) NOT NULL DEFAULT 'webhook',
  fixed_branch VARCHAR(255),
  allowed_branches TEXT,
  sync_mode VARCHAR(64) NOT NULL DEFAULT 'pull',
  clone_if_empty BOOLEAN NOT NULL DEFAULT TRUE,
  secret TEXT,
  generic_token_header VARCHAR(128) DEFAULT 'X-Webhook-Token',
  hook_token VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  healthcheck_url TEXT,
  auto_rollback BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at VARCHAR(64),
  last_status VARCHAR(64),
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_hook_token ON services(hook_token);
CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider);
CREATE INDEX IF NOT EXISTS idx_services_enabled ON services(enabled);

-- ----------------------------------------------------------------------------
-- 4. Commands Table (Ordered Post-Sync Deployment Steps)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commands (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  command TEXT NOT NULL,
  branch_filter VARCHAR(255),
  continue_on_error BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_commands_service_id ON commands(service_id);
CREATE INDEX IF NOT EXISTS idx_commands_service_position ON commands(service_id, position);

-- ----------------------------------------------------------------------------
-- 5. Triggers Table (Execution and Webhook Audit Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS triggers (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  source VARCHAR(64) NOT NULL DEFAULT 'webhook',
  status VARCHAR(64) NOT NULL DEFAULT 'queued',
  event VARCHAR(128),
  branch VARCHAR(255),
  sha VARCHAR(255),
  signature_ok BOOLEAN,
  ip VARCHAR(128),
  created_at VARCHAR(64) NOT NULL,
  started_at VARCHAR(64),
  finished_at VARCHAR(64),
  duration_ms INTEGER,
  log TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_triggers_service_id_id ON triggers(service_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_triggers_status ON triggers(status);
CREATE INDEX IF NOT EXISTS idx_triggers_created_at ON triggers(created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Notification Channels Table (Slack, Discord, Telegram, Webhook, Email)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(64) NOT NULL DEFAULT 'slack',
  webhook_url TEXT,
  config TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. Service Notifications Mapping Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_notifications (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  on_start BOOLEAN NOT NULL DEFAULT FALSE,
  on_success BOOLEAN NOT NULL DEFAULT TRUE,
  on_failure BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(service_id, channel_id)
);

-- ----------------------------------------------------------------------------
-- 8. Service Environment Variables Table (Encrypted at rest)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_env (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value_enc TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT TRUE,
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL,
  UNIQUE(service_id, key)
);

CREATE INDEX IF NOT EXISTS idx_service_env_service_id ON service_env(service_id);

-- ----------------------------------------------------------------------------
-- 9. Audit Logs Table (Activity Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(255) NOT NULL,
  target_type VARCHAR(64),
  target_id VARCHAR(64),
  details TEXT,
  ip VARCHAR(128),
  created_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. Settings Table (Key-Value System Configurations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT
);

-- ----------------------------------------------------------------------------
-- 11. Default Admin Seeding (Creates default admin user if table is empty)
-- Note: Password is 'admin123' hashed with scrypt, must_change_password=TRUE.
-- ----------------------------------------------------------------------------
INSERT INTO users (username, password_hash, must_change_password, created_at, updated_at)
SELECT 'admin', 'scrypt:b229871131c9adbc4d97d02868ff1891:982b6838a16aa13df18a4a5bb8652c78ec25f9b4c09d562fa53aa91b058a9e048dfd248b26110f0f4a86f0aa6beeb2c2d43f07a759ba0e30c00ef65e4ff8f3ad', TRUE, NOW()::text, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Set default public base URL setting if not exists
INSERT INTO settings (key, value)
VALUES ('public_base_url', '')
ON CONFLICT (key) DO NOTHING;
