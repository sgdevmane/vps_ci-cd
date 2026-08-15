import { Router } from "express";
import { db, insertReturning } from "../db/index.js";
import { getProvider } from "../webhooks/verify.js";
import { enqueueTrigger } from "../core/runner.js";
import { nowIso, parseList } from "../util/misc.js";
import { webhooksReceivedTotal } from "../core/metrics.js";

const router = Router();

function logText(...messages) {
  return messages.map((m) => `[${nowIso()}] ${m}`).join("\n");
}

async function recordClosedTrigger(serviceId, info, status, messages) {
  return insertReturning("triggers", {
    service_id: serviceId,
    source: "webhook",
    status,
    event: info.event || null,
    branch: info.branch || null,
    sha: info.sha || null,
    signature_ok: info.signatureOk ?? null,
    ip: info.ip || null,
    created_at: nowIso(),
    finished_at: nowIso(),
    duration_ms: 0,
    log: logText(...messages),
  });
}

// Public endpoint — intentionally NOT behind requireAuth.
// Body arrives as a raw Buffer (express.raw is mounted on /api/hooks).
router.post("/hooks/:hookToken", async (req, res, next) => {
  try {
    const service = await db("services")
      .where({ hook_token: req.params.hookToken })
      .first();
    if (!service) return res.status(404).json({ error: "Unknown webhook" });

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    let payload = {};
    if (rawBody.length) {
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        payload = {};
      }
    }

    const provider = getProvider(service.provider);
    const info = { ...provider.extract(req, payload), ip: req.ip };
    const check = provider.verify(service, req, rawBody);
    info.signatureOk = check.verified ? check.ok : null;

    if (!check.ok) {
      webhooksReceivedTotal.inc({
        provider: service.provider,
        verified: check.verified ? 'failed' : 'no_secret',
        status: 'rejected',
      });
      const triggerId = await recordClosedTrigger(
        service.id,
        info,
        "rejected",
        [
          `Webhook rejected: ${check.reason}`,
          `Event: ${info.event || "unknown"} · Branch: ${info.branch || "unknown"} · IP: ${info.ip}`,
        ],
      );
      return res.status(401).json({ error: check.reason, triggerId });
    }

    webhooksReceivedTotal.inc({
      provider: service.provider,
      verified: check.verified ? 'verified' : 'unverified',
      status: 'accepted',
    });

    if (info.event === "ping") {
      const triggerId = await recordClosedTrigger(service.id, info, "success", [
        "Ping event received — the webhook is configured correctly.",
        check.verified ? "Signature verified." : `Note: ${check.reason}.`,
      ]);
      return res.json({ ok: true, message: "pong", triggerId });
    }

    if (
      provider.pushEvents &&
      info.event &&
      !provider.pushEvents.includes(info.event)
    ) {
      const triggerId = await recordClosedTrigger(service.id, info, "skipped", [
        `Ignored "${info.event}" event — only push events trigger a sync.`,
      ]);
      return res.json({ ok: true, skipped: true, triggerId });
    }
    if (info.isDelete) {
      const triggerId = await recordClosedTrigger(service.id, info, "skipped", [
        "Branch deletion event ignored — nothing to sync.",
      ]);
      return res.json({ ok: true, skipped: true, triggerId });
    }
    if (info.isTag) {
      const triggerId = await recordClosedTrigger(service.id, info, "skipped", [
        "Tag push ignored — only branch pushes trigger a sync.",
      ]);
      return res.json({ ok: true, skipped: true, triggerId });
    }

    const allowed = parseList(service.allowed_branches);
    if (allowed.length > 0) {
      if (!info.branch) {
        const triggerId = await recordClosedTrigger(
          service.id,
          info,
          "skipped",
          [
            `Could not determine the pushed branch from the payload; allowed branches are: ${allowed.join(", ")}.`,
          ],
        );
        return res.json({ ok: true, skipped: true, triggerId });
      }
      if (!allowed.includes(info.branch)) {
        const triggerId = await recordClosedTrigger(
          service.id,
          info,
          "skipped",
          [
            `Branch "${info.branch}" is not in the allowed list (${allowed.join(", ")}). Nothing to do.`,
          ],
        );
        return res.json({ ok: true, skipped: true, triggerId });
      }
    }

    if (!check.verified) {
      console.warn(
        `[hooks] service "${service.name}" accepted a webhook without verification: ${check.reason}`,
      );
    }

    const triggerId = await enqueueTrigger(service.id, {
      source: "webhook",
      event: info.event || "push",
      branch: info.branch,
      sha: info.sha,
      signatureOk: info.signatureOk,
      ip: info.ip,
    });
    res.status(202).json({ ok: true, triggerId });
  } catch (err) {
    next(err);
  }
});

export default router;
