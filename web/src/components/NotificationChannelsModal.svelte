<script>
  import { X, Bell, Plus, Trash2, Send, Check } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { fireConfetti } from '../lib/confetti.js';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let { onClose } = $props();

  let channels = $state([]);
  let loading = $state(true);

  // New channel form
  let showAdd = $state(false);
  let name = $state('');
  let provider = $state('slack');
  let webhook_url = $state('');
  let bot_token = $state('');
  let chat_id = $state('');
  let saving = $state(false);
  let deletingChannel = $state(null);
  let deleteBusy = $state(false);

  async function load() {
    try {
      const res = await api.get('/api/notifications/channels');
      channels = res.channels || [];
    } catch (e) {
      toastError(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  async function saveChannel(e) {
    e.preventDefault();
    saving = true;
    try {
      const config = provider === 'telegram' ? { bot_token, chat_id } : null;
      await api.post('/api/notifications/channels', {
        name,
        provider,
        webhook_url: provider === 'telegram' ? bot_token : webhook_url,
        config,
      });
      toast('Notification channel added', 'success');
      showAdd = false;
      name = '';
      webhook_url = '';
      bot_token = '';
      chat_id = '';
      load();
    } catch (err) {
      toastError(err);
    } finally {
      saving = false;
    }
  }

  async function confirmDeleteChannel() {
    deleteBusy = true;
    try {
      await api.del(`/api/notifications/channels/${deletingChannel.id}`);
      toast('Channel removed', 'success');
      deletingChannel = null;
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      deleteBusy = false;
    }
  }

  async function testChannel(id) {
    try {
      await api.post(`/api/notifications/channels/${id}/test`);
      fireConfetti({ count: 35 });
      toast('Test notification sent successfully!', 'success');
    } catch (err) {
      toastError(err);
    }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="notif-title">
  <div class="modal modal-wide">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
      <div>
        <h3 id="notif-title" class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <Bell size={18} /> Notification Channels
        </h3>
        <div class="modal-sub">Configure outbound notifications for Slack, Discord, Telegram, or Webhooks.</div>
      </div>
      <button class="btn btn-ghost btn-icon" onclick={onClose} aria-label="Close modal"><X size={16} /></button>
    </div>

    {#if loading}
      <div style="display:grid; place-items:center; padding:40px;"><div class="spinner"></div></div>
    {:else}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <span class="small muted">{channels.length} channel{channels.length === 1 ? '' : 's'} configured</span>
        <button class="btn btn-sm btn-primary" onclick={() => (showAdd = !showAdd)}>
          <Plus size={13} /> Add Channel
        </button>
      </div>

      {#if showAdd}
        <form onsubmit={saveChannel} class="card" style="margin-bottom:16px; background:var(--bg-elevated);">
          <div class="field-row">
            <div class="field">
              <label class="label" for="ch-name">Channel Name</label>
              <input id="ch-name" class="input" bind:value={name} placeholder="e.g. #devops-alerts" required />
            </div>
            <div class="field">
              <label class="label" for="ch-provider">Platform</label>
              <select id="ch-provider" class="select" bind:value={provider}>
                <option value="slack">Slack Webhook</option>
                <option value="discord">Discord Webhook</option>
                <option value="telegram">Telegram Bot</option>
                <option value="webhook">Custom JSON Webhook</option>
              </select>
            </div>
          </div>

          {#if provider === 'telegram'}
            <div class="field-row">
              <div class="field">
                <label class="label" for="tg-token">Bot Token</label>
                <input id="tg-token" class="input mono" bind:value={bot_token} placeholder="123456:ABC-DEF..." required />
              </div>
              <div class="field">
                <label class="label" for="tg-chat">Chat ID</label>
                <input id="tg-chat" class="input mono" bind:value={chat_id} placeholder="-100123456789" required />
              </div>
            </div>
          {:else}
            <div class="field">
              <label class="label" for="ch-url">Webhook URL</label>
              <input id="ch-url" class="input mono" bind:value={webhook_url} placeholder="https://hooks.slack.com/services/..." required />
            </div>
          {/if}

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button type="button" class="btn btn-sm" onclick={() => (showAdd = false)}>Cancel</button>
            <button type="submit" class="btn btn-sm btn-primary" disabled={saving}>
              {#if saving}<span class="spinner"></span>{:else}<Check size={13} />{/if} Save Channel
            </button>
          </div>
        </form>
      {/if}

      {#if channels.length === 0 && !showAdd}
        <div class="muted" style="padding:24px 0; text-align:center;">
          No notification channels configured yet. Click "Add Channel" above to connect Slack, Discord, or Telegram.
        </div>
      {:else}
        <div style="display:flex; flex-direction:column; gap:8px;">
          {#each channels as ch}
            <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:10px; padding:10px 14px; background:var(--bg-elevated);">
              <div>
                <div style="font-weight:600; font-size:13.5px;">{ch.name}</div>
                <div class="small muted" style="text-transform:capitalize;">{ch.provider}</div>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm" onclick={() => testChannel(ch.id)} title="Send test ping">
                  <Send size={12} /> Test
                </button>
                <button class="btn btn-sm btn-danger btn-icon" onclick={() => (deletingChannel = ch)} title="Delete channel">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="modal-actions">
        <button class="btn btn-primary" onclick={onClose}>Done</button>
      </div>
    {/if}
  </div>
</div>

{#if deletingChannel}
  <ConfirmDialog
    title="Delete notification channel"
    message={`Delete "${deletingChannel.name}"? Services bound to it will stop receiving deployment alerts.`}
    confirmLabel="Delete channel"
    busy={deleteBusy}
    onConfirm={confirmDeleteChannel}
    onClose={() => (deletingChannel = null)}
  />
{/if}
