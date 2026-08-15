import { Router } from "express";
import { db } from "../db/index.js";
import {
  requireAuth,
  createSession,
  destroySession,
  destroyAllSessions,
} from "../auth/session.js";
import { hashSecret, verifySecret, normalizeAnswer } from "../util/crypto.js";
import { nowIso } from "../util/misc.js";
import { auditLog } from "../core/audit.js";

const router = Router();

const MIN_PASSWORD_LEN = 8;

// --- naive brute-force throttle (in-memory) ---
const attempts = new Map(); // ip -> { fails, windowStart, lockedUntil }
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function throttle(req) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry) return { locked: false };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { locked: true, retryInMs: entry.lockedUntil - now };
  }
  return { locked: false };
}

function recordFailure(req) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip) || {
    fails: 0,
    windowStart: now,
    lockedUntil: 0,
  };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.fails = 0;
    entry.windowStart = now;
  }
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) entry.lockedUntil = now + LOCK_MS;
  attempts.set(ip, entry);
}

function recordSuccess(req) {
  attempts.delete(req.ip || "unknown");
}

async function findUser(username) {
  return db("users").where({ username }).first();
}

router.post("/login", async (req, res, next) => {
  try {
    const lock = throttle(req);
    if (lock.locked) {
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${Math.ceil(lock.retryInMs / 60000)} minute(s).`,
      });
    }
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }
    const user = await findUser(String(username).trim());
    if (!user || !verifySecret(password, user.password_hash)) {
      recordFailure(req);
      auditLog({ action: 'auth.login_failed', targetType: 'user', targetId: String(username).slice(0, 64), ip: req.ip });
      return res.status(401).json({ error: "Invalid username or password" });
    }
    recordSuccess(req);
    await createSession(res, user.id);
    auditLog({ userId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: req.ip });
    res.json({
      username: user.username,
      mustChangePassword: !!user.must_change_password,
      hasSecurityQuestion: !!user.security_question,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    username: req.user.username,
    mustChangePassword: req.user.mustChangePassword,
    hasSecurityQuestion: req.user.hasSecurityQuestion,
  });
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }
    if (String(newPassword).length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({
          error: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
        });
    }
    const user = await db("users").where({ id: req.user.id }).first();
    if (!user || !verifySecret(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await db("users")
      .where({ id: user.id })
      .update({
        password_hash: hashSecret(newPassword),
        must_change_password: 0,
        updated_at: nowIso(),
      });
    await destroyAllSessions(user.id);
    await createSession(res, user.id);
    auditLog({ userId: user.id, action: 'auth.password_changed', targetType: 'user', targetId: user.id, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/security-question", async (req, res, next) => {
  try {
    const user = await db("users")
      .whereNotNull("security_question")
      .select("security_question")
      .first();
    if (!user) return res.json({ set: false });
    res.json({ set: true, question: user.security_question });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { answer, newPassword } = req.body || {};
    if (!answer || !newPassword) {
      return res
        .status(400)
        .json({ error: "Answer and new password are required" });
    }
    if (String(newPassword).length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({
          error: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
        });
    }
    const user = await db("users").whereNotNull("security_answer_hash").first();
    if (!user) {
      return res
        .status(404)
        .json({ error: "No security question has been set up" });
    }
    const stored = user.security_answer_hash.replace(/^answer:/, "");
    if (!verifySecret(normalizeAnswer(answer), stored)) {
      return res.status(401).json({ error: "The answer is not correct" });
    }
    await db("users")
      .where({ id: user.id })
      .update({
        password_hash: hashSecret(newPassword),
        must_change_password: 0,
        updated_at: nowIso(),
      });
    await destroyAllSessions(user.id);
    await createSession(res, user.id);
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

router.put("/security-question", requireAuth, async (req, res, next) => {
  try {
    const { question, answer } = req.body || {};
    const user = await db("users").where({ id: req.user.id }).first();
    const q = String(question ?? "").trim();
    const a = String(answer ?? "").trim();
    const updates = { updated_at: nowIso() };

    if (q) updates.security_question = q;
    else if (!user.security_question) {
      return res.status(400).json({ error: "Question is required" });
    }
    if (a) {
      if (a.length < 2)
        return res.status(400).json({ error: "Answer is too short" });
      updates.security_answer_hash = "answer:" + hashSecret(normalizeAnswer(a));
    } else if (!user.security_answer_hash) {
      return res.status(400).json({ error: "Answer is required" });
    }

    await db("users").where({ id: req.user.id }).update(updates);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
