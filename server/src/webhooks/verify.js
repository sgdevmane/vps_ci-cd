import crypto from "node:crypto";

function hmacHex(secret, body) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function safeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const acceptedUnverified = (reason) => ({ ok: true, verified: false, reason });

function verifyHmac(signature, secret, rawBody, headerName) {
  if (!secret) {
    return signature
      ? {
          ok: false,
          verified: false,
          reason:
            "Received a signature but no secret is configured for this service",
        }
      : acceptedUnverified(
          "No secret configured — accepted without signature verification",
        );
  }
  if (!signature)
    return {
      ok: false,
      verified: true,
      reason: `Missing ${headerName} header`,
    };
  return safeEqualStr(signature, hmacHex(secret, rawBody))
    ? { ok: true, verified: true }
    : {
        ok: false,
        verified: true,
        reason: "HMAC signature mismatch (check the webhook secret)",
      };
}

function verifyPlainToken(token, secret, where) {
  if (!secret) {
    return token
      ? {
          ok: false,
          verified: false,
          reason:
            "Received a token but no secret is configured for this service",
        }
      : acceptedUnverified(
          "No secret configured — accepted without token verification",
        );
  }
  if (!token)
    return { ok: false, verified: true, reason: `Missing token (${where})` };
  return safeEqualStr(token, secret)
    ? { ok: true, verified: true }
    : {
        ok: false,
        verified: true,
        reason: "Token mismatch (check the webhook secret)",
      };
}

/** GitHub/GitLab/Gitea/Gogs-style payloads: ref + after. */
function stdExtract(eventHeader) {
  return (req, payload) => {
    const event =
      req.get(eventHeader) || payload?.hook_name || payload?.event || null;
    let branch = null;
    let isTag = false;
    const ref = payload?.ref;
    if (typeof ref === "string") {
      if (ref.startsWith("refs/heads/"))
        branch = ref.slice("refs/heads/".length);
      else if (ref.startsWith("refs/tags/")) isTag = true;
    } else if (typeof payload?.branch === "string") {
      branch = payload.branch;
    }
    const sha =
      payload?.after ||
      payload?.checkout_sha ||
      payload?.head_commit?.id ||
      payload?.sha ||
      payload?.commit ||
      null;
    return { event, branch, sha, isTag, isDelete: false };
  };
}

/**
 * Provider registry. Each entry defines:
 *  - label: display name
 *  - pushEvents: event names that trigger a sync (null = no event filtering)
 *  - verify(service, req, rawBody): { ok, verified, reason? }
 *  - extract(req, payload): { event, branch, sha, isTag, isDelete }
 */
export const PROVIDERS = {
  github: {
    label: "GitHub",
    pushEvents: ["push"],
    verify: (service, req, rawBody) =>
      verifyHmac(
        String(req.get("x-hub-signature-256") || "").replace(/^sha256=/, ""),
        service.secret,
        rawBody,
        "X-Hub-Signature-256",
      ),
    extract: stdExtract("x-github-event"),
  },

  gitlab: {
    label: "GitLab",
    pushEvents: ["Push Hook", "Tag Push Hook"],
    verify: (service, req) =>
      verifyPlainToken(
        req.get("x-gitlab-token"),
        service.secret,
        "X-Gitlab-Token header",
      ),
    extract: stdExtract("x-gitlab-event"),
  },

  bitbucket: {
    label: "Bitbucket",
    pushEvents: ["repo:push"],
    // Bitbucket Cloud does not sign payloads; optionally protect the URL with a
    // token appended as ?token= (or sent in a header) on the webhook URL.
    verify: (service, req) => {
      let token = req.get("x-webhook-token");
      if (!token && req.query?.token) token = String(req.query.token);
      return verifyPlainToken(
        token,
        service.secret,
        "X-Webhook-Token header or ?token=",
      );
    },
    extract: (req, payload) => {
      const change = payload?.push?.changes?.[0];
      return {
        event: req.get("x-event-key") || null,
        branch: change?.new?.name ?? null,
        sha: change?.new?.target?.hash ?? null,
        isTag: false,
        isDelete: !change?.new,
      };
    },
  },

  gitea: {
    label: "Gitea / Forgejo",
    pushEvents: ["push"],
    verify: (service, req, rawBody) =>
      verifyHmac(
        req.get("x-gitea-signature") || req.get("x-forgejo-signature"),
        service.secret,
        rawBody,
        "X-Gitea-Signature",
      ),
    extract: stdExtract("x-gitea-event"),
  },

  gogs: {
    label: "Gogs",
    pushEvents: ["push"],
    verify: (service, req, rawBody) =>
      verifyHmac(
        req.get("x-gogs-signature"),
        service.secret,
        rawBody,
        "X-Gogs-Signature",
      ),
    extract: stdExtract("x-gogs-event"),
  },

  generic: {
    label: "Generic",
    pushEvents: null,
    verify: (service, req) => {
      const headerName = (
        service.generic_token_header || "X-Webhook-Token"
      ).toLowerCase();
      let token = req.get(headerName);
      if (!token && req.query?.token) token = String(req.query.token);
      return verifyPlainToken(
        token,
        service.secret,
        `${service.generic_token_header || "X-Webhook-Token"} header or ?token=`,
      );
    },
    extract: stdExtract("x-webhook-event"),
  },
};

export function getProvider(name) {
  return PROVIDERS[name] || PROVIDERS.generic;
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS);
