import { db } from '../db/index.js';
import { nowIso } from '../util/misc.js';

/**
 * Append-only security audit trail. Fire-and-forget: audit failures are logged
 * but never break the request they describe.
 *
 * @param {{ userId?: number|null, action: string, targetType?: string|null,
 *           targetId?: string|number|null, details?: unknown, ip?: string|null }} entry
 */
export async function auditLog({ userId = null, action, targetType = null, targetId = null, details = null, ip = null }) {
  try {
    await db('audit_logs').insert({
      user_id: userId ?? null,
      action: String(action).slice(0, 255),
      target_type: targetType ? String(targetType).slice(0, 64) : null,
      target_id: targetId != null ? String(targetId).slice(0, 64) : null,
      details:
        details == null
          ? null
          : typeof details === 'string'
            ? details.slice(0, 4000)
            : JSON.stringify(details).slice(0, 4000),
      ip: ip ? String(ip).slice(0, 128) : null,
      created_at: nowIso(),
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}
