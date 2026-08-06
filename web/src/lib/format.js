export function timeAgo(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : "—";
}

export const STATUS_META = {
  queued: { label: "Queued", badge: "badge-muted" },
  running: { label: "Running", badge: "badge-info badge-running" },
  success: { label: "Success", badge: "badge-success" },
  failed: { label: "Failed", badge: "badge-danger" },
  skipped: { label: "Skipped", badge: "badge-muted" },
  rejected: { label: "Rejected", badge: "badge-warning" },
};

export const PROVIDER_LABELS = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  gitea: "Gitea / Forgejo",
  gogs: "Gogs",
  generic: "Generic",
};
