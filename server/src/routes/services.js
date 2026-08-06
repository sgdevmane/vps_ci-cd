import path from "node:path";
import { Router } from "express";
import { db, insertReturning } from "../db/index.js";
import { requireAuth } from "../auth/session.js";
import { newToken } from "../util/crypto.js";
import { nowIso, parseList } from "../util/misc.js";
import { enqueueTrigger } from "../core/runner.js";
import { getSetting, baseUrlFor } from "../core/appSettings.js";
import { PROVIDER_NAMES } from "../webhooks/verify.js";

const router = Router();
router.use(requireAuth);

const PROVIDERS = PROVIDER_NAMES;
const BRANCH_MODES = ["fixed", "webhook", "current"];
const SYNC_MODES = ["pull", "reset"];

function validateService(body) {
  const errors = [];
  const value = {
    name: String(body.name ?? "").trim(),
    provider: String(body.provider ?? "github"),
    repo_url: String(body.repo_url ?? "").trim(),
    folder_path: String(body.folder_path ?? "").trim(),
    branch_mode: String(body.branch_mode ?? "webhook"),
    fixed_branch: String(body.fixed_branch ?? "").trim() || null,
    allowed_branches: parseList(body.allowed_branches).join(","),
    sync_mode: String(body.sync_mode ?? "pull"),
    clone_if_empty:
      body.clone_if_empty === undefined ? 1 : !!body.clone_if_empty,
    secret:
      body.secret === undefined || body.secret === null
        ? ""
        : String(body.secret),
    generic_token_header:
      String(body.generic_token_header ?? "X-Webhook-Token").trim() ||
      "X-Webhook-Token",
    enabled: body.enabled === undefined ? 1 : !!body.enabled,
  };

  if (!value.name) errors.push("Name is required");
  if (!PROVIDERS.includes(value.provider))
    errors.push(`Provider must be one of: ${PROVIDERS.join(", ")}`);
  if (!value.repo_url) errors.push("Repository URL is required");
  else if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(value.repo_url)) {
    errors.push("Repository URL must be https://, ssh:// or git@…");
  }
  if (!value.folder_path) errors.push("Folder path is required");
  else if (!path.isAbsolute(value.folder_path))
    errors.push("Folder path must be absolute (e.g. /var/www/my-app)");
  if (!BRANCH_MODES.includes(value.branch_mode))
    errors.push(`Branch mode must be one of: ${BRANCH_MODES.join(", ")}`);
  if (value.branch_mode === "fixed" && !value.fixed_branch)
    errors.push('Fixed branch is required when branch mode is "fixed"');
  if (!SYNC_MODES.includes(value.sync_mode))
    errors.push(`Sync mode must be one of: ${SYNC_MODES.join(", ")}`);

  const commands = [];
  if (body.commands !== undefined) {
    if (!Array.isArray(body.commands)) errors.push("Commands must be an array");
    else {
      body.commands.forEach((c, i) => {
        const command = String(c?.command ?? "").trim();
        if (!command) errors.push(`Command #${i + 1} is empty`);
        else {
          commands.push({
            command,
            branch_filter: String(c?.branch_filter ?? "").trim() || null,
            continue_on_error: !!c?.continue_on_error,
          });
        }
      });
    }
  }

  return { errors, value, commands };
}

async function hookUrlFor(req, hookToken) {
  const base = baseUrlFor(req, await getSetting("public_base_url"));
  return `${base}/api/hooks/${hookToken}`;
}

async function serialize(req, row, { withCommands = false } = {}) {
  const out = {
    ...row,
    enabled: !!row.enabled,
    clone_if_empty: !!row.clone_if_empty,
    mustChangePassword: undefined,
    hook_url: await hookUrlFor(req, row.hook_token),
  };
  if (withCommands) {
    out.commands = await db("commands")
      .where({ service_id: row.id })
      .orderBy("position", "asc")
      .orderBy("id", "asc")
      .select("id", "command", "branch_filter", "continue_on_error");
    out.commands = out.commands.map((c) => ({
      ...c,
      continue_on_error: !!c.continue_on_error,
    }));
  }
  return out;
}

async function replaceCommands(serviceId, commands) {
  await db("commands").where({ service_id: serviceId }).del();
  const rows = commands.map((c, position) => ({
    ...c,
    service_id: serviceId,
    position,
  }));
  if (rows.length) await db("commands").insert(rows);
}

router.get("/", async (req, res, next) => {
  try {
    const rows = await db("services").orderBy("id", "asc");
    res.json({
      services: await Promise.all(rows.map((r) => serialize(req, r))),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { errors, value, commands } = validateService(req.body || {});
    if (errors.length) return res.status(400).json({ errors });
    const id = await insertReturning("services", {
      ...value,
      hook_token: newToken(16),
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    if (req.body?.commands !== undefined) await replaceCommands(id, commands);
    const row = await db("services").where({ id }).first();
    res
      .status(201)
      .json({ service: await serialize(req, row, { withCommands: true }) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const row = await db("services").where({ id: req.params.id }).first();
    if (!row) return res.status(404).json({ error: "Service not found" });
    res.json({ service: await serialize(req, row, { withCommands: true }) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await db("services").where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: "Service not found" });
    const merged = { ...existing, ...(req.body || {}) };
    const { errors, value, commands } = validateService(merged);
    if (errors.length) return res.status(400).json({ errors });
    await db("services")
      .where({ id: existing.id })
      .update({ ...value, updated_at: nowIso() });
    if (req.body?.commands !== undefined)
      await replaceCommands(existing.id, commands);
    const row = await db("services").where({ id: existing.id }).first();
    res.json({ service: await serialize(req, row, { withCommands: true }) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await db("services").where({ id: req.params.id }).del();
    if (!deleted) return res.status(404).json({ error: "Service not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/sync", async (req, res, next) => {
  try {
    const row = await db("services").where({ id: req.params.id }).first();
    if (!row) return res.status(404).json({ error: "Service not found" });
    const triggerId = await enqueueTrigger(row.id, {
      source: "manual",
      event: "manual",
      branch: req.body?.branch || null,
      ip: req.ip,
    });
    res.status(202).json({ ok: true, triggerId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/triggers", async (req, res, next) => {
  try {
    const row = await db("services").where({ id: req.params.id }).first();
    if (!row) return res.status(404).json({ error: "Service not found" });
    const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 200);
    const offset = parseInt(req.query.offset || "0", 10) || 0;
    const triggers = await db("triggers")
      .where({ service_id: row.id })
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset);
    res.json({ triggers });
  } catch (err) {
    next(err);
  }
});

export default router;
