import crypto from 'node:crypto';
import { config } from '../config.js';

// Derive a 32-byte encryption key from default admin password or secret salt
const MASTER_KEY = crypto
  .createHash('sha256')
  .update(process.env.APP_SECRET || config.defaultAdminPass || 'vps_ci_cd_master_secret')
  .digest();

const ALGO = 'aes-256-gcm';

/**
 * Encrypt a string using AES-256-GCM
 * Returns formatted string: "aes-gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptValue(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, iv);
  let encrypted = cipher.update(str, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `aes-gcm:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypt a string produced by encryptValue
 */
export function decryptValue(stored) {
  if (!stored || typeof stored !== 'string') return '';
  if (!stored.startsWith('aes-gcm:')) return stored; // plain fallback
  const parts = stored.split(':');
  if (parts.length !== 4) return '';
  const [, ivHex, tagHex, cipherHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[cryptoVault] decryption failed:', err.message);
    return '';
  }
}
