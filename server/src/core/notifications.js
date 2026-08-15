import { db } from '../db/index.js';

/**
 * Dispatch rich notification cards across all bound channels for a service event
 * @param {number} serviceId
 * @param {'start' | 'success' | 'failed' | 'skipped'} eventType
 * @param {object} ctx - { serviceName, branch, sha, durationMs, error, triggerId, publicUrl }
 */
export async function dispatchNotifications(serviceId, eventType, ctx = {}) {
  try {
    const column = eventType === 'start' ? 'on_start' : (eventType === 'success' ? 'on_success' : 'on_failure');
    const channels = await db('service_notifications')
      .join('notification_channels', 'notification_channels.id', 'service_notifications.channel_id')
      .where('service_notifications.service_id', serviceId)
      .where('notification_channels.enabled', 1)
      .where(`service_notifications.${column}`, 1)
      .select('notification_channels.*');

    if (!channels.length) return;

    await Promise.allSettled(
      channels.map((channel) => sendToChannel(channel, eventType, ctx))
    );
  } catch (err) {
    console.error('[notifications] failed to dispatch notifications:', err.message);
  }
}

/**
 * Send notification to a single configured channel
 */
export async function sendToChannel(channel, eventType, ctx) {
  const { name, provider, webhook_url, config: rawConfig } = channel;
  let customConfig = {};
  try {
    if (rawConfig) customConfig = JSON.parse(rawConfig);
  } catch {
    customConfig = {};
  }

  const isSuccess = eventType === 'success';
  const isFailed = eventType === 'failed';
  const statusEmoji = isSuccess ? '✅' : (isFailed ? '❌' : '🚀');
  const statusLabel = isSuccess ? 'Success' : (isFailed ? 'Failed' : 'Started');
  const title = `${statusEmoji} Deployment ${statusLabel}: ${ctx.serviceName || 'Service'}`;
  const details = [
    `Branch: \`${ctx.branch || 'main'}\``,
    ctx.sha ? `Commit: \`${String(ctx.sha).slice(0, 7)}\`` : '',
    ctx.durationMs ? `Duration: ${Math.round(ctx.durationMs / 1000)}s` : '',
    ctx.error ? `Error: ${ctx.error}` : '',
  ].filter(Boolean).join(' · ');

  switch (provider) {
    case 'slack': {
      if (!webhook_url) return;
      const color = isSuccess ? '#3ecf8e' : (isFailed ? '#f2637a' : '#58a6ff');
      const payload = {
        text: `${title} — ${details}`,
        attachments: [
          {
            color,
            title,
            text: details,
            footer: 'VPS CI/CD Automation Runner',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      break;
    }

    case 'discord': {
      if (!webhook_url) return;
      const color = isSuccess ? 0x3ecf8e : (isFailed ? 0xf2637a : 0x58a6ff);
      const payload = {
        embeds: [
          {
            title,
            description: details,
            color,
            footer: { text: 'VPS CI/CD Runner' },
            timestamp: new Date().toISOString(),
          },
        ],
      };
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      break;
    }

    case 'telegram': {
      const botToken = customConfig.bot_token || webhook_url;
      const chatId = customConfig.chat_id;
      if (!botToken || !chatId) return;
      const text = `<b>${title}</b>\n${details}`;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      break;
    }

    case 'webhook':
    default: {
      if (!webhook_url) return;
      const payload = {
        event: eventType,
        service: ctx.serviceName,
        branch: ctx.branch,
        sha: ctx.sha,
        duration_ms: ctx.durationMs,
        error: ctx.error || null,
        trigger_id: ctx.triggerId || null,
        timestamp: new Date().toISOString(),
      };
      const headers = {
        'Content-Type': 'application/json',
        ...(customConfig.headers || {}),
      };
      await fetch(webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      break;
    }
  }
}
