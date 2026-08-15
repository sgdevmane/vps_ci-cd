<script>
  import { Send, CheckCircle2, AlertTriangle, ArrowRight, Radio } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import ProviderIcon from './ProviderIcon.svelte';
  import { navigate } from '../lib/router.svelte.js';
  import { fireConfetti } from '../lib/confetti.js';
  import { toast } from '../lib/toast.svelte.js';

  let { service, services = [], onClose } = $props();

  let selectedServiceId = $state('');

  $effect(() => {
    if (service) {
      selectedServiceId = String(service.id);
    } else if (services.length > 0 && !selectedServiceId) {
      selectedServiceId = String(services[0].id);
    }
  });

  let activeService = $derived(
    service || services.find((s) => String(s.id) === String(selectedServiceId)) || services[0]
  );

  let branch = $state('main');
  let sha = $state('7f9a2b' + Math.random().toString(16).substring(2, 8));
  let commitMessage = $state('Deploy release update from simulator');
  let eventType = $state('push');
  let busy = $state(false);
  let result = $state(null);
  let error = $state('');

  const payloadPreview = $derived(
    JSON.stringify(
      {
        ref: `refs/heads/${branch}`,
        before: '0000000000000000000000000000000000000000',
        after: sha,
        event: eventType,
        head_commit: {
          id: sha,
          message: commitMessage,
          timestamp: new Date().toISOString(),
        },
      },
      null,
      2
    )
  );

  async function sendWebhook() {
    if (!activeService) return;
    busy = true;
    error = '';
    result = null;

    try {
      const url = `/api/hooks/${activeService.hook_token}`;
      const headers = {
        'Content-Type': 'application/json',
      };

      // Set simulated provider headers
      if (activeService.provider === 'github') {
        headers['X-GitHub-Event'] = eventType;
      } else if (activeService.provider === 'gitlab') {
        headers['X-Gitlab-Event'] = 'Push Hook';
      } else if (activeService.provider === 'gitea') {
        headers['X-Gitea-Event'] = 'push';
      } else if (activeService.provider === 'gogs') {
        headers['X-Gogs-Event'] = 'push';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: payloadPreview,
      });

      const data = await res.json();
      result = { status: res.status, data };

      if (res.ok) {
        fireConfetti({ count: 40 });
        toast('Simulated webhook accepted by server!', 'success');
      } else {
        error = data.error || `HTTP ${res.status}: Rejected`;
      }
    } catch (err) {
      error = err.message || 'Failed to dispatch webhook';
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Simulate Inbound Webhook" sub="Test your webhook trigger workflow directly in the browser" {onClose} wide>
  <div style="display:flex; flex-direction:column; gap:16px;">
    {#if !service && services.length > 0}
      <div class="field">
        <label class="label" for="sim-service-select">Target Service</label>
        <select id="sim-service-select" class="select" bind:value={selectedServiceId}>
          {#each services as s (s.id)}
            <option value={s.id}>{s.name} ({s.provider})</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if activeService}
      <div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:var(--bg-elevated); border-radius:var(--radius-sm); border:1px solid var(--border);">
        <ProviderIcon provider={activeService.provider} withLabel={true} />
        <span style="font-weight:600; font-size:13px; color:var(--text);">→ {activeService.name}</span>
        <span class="mono faint small" style="margin-left:auto;">{activeService.folder_path}</span>
      </div>
    {/if}

    <div class="field-row">
      <div class="field">
        <label class="label" for="sim-branch">Branch</label>
        <input id="sim-branch" class="input mono" bind:value={branch} placeholder="main" />
      </div>
      <div class="field">
        <label class="label" for="sim-sha">Commit SHA</label>
        <input id="sim-sha" class="input mono" bind:value={sha} placeholder="Commit hex hash" />
      </div>
    </div>

    <div class="field">
      <label class="label" for="sim-msg">Commit Message</label>
      <input id="sim-msg" class="input" bind:value={commitMessage} placeholder="Commit description" />
    </div>

    <div class="field">
      <span class="label">Payload Preview</span>
      <pre class="log-viewer" style="max-height:140px; margin-top:4px;">{payloadPreview}</pre>
    </div>

    {#if result}
      <div style="padding:12px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid {result.status < 300 ? 'var(--success-soft)' : 'var(--danger-soft)'};">
        <div style="display:flex; align-items:center; gap:8px;">
          {#if result.status < 300}
            <CheckCircle2 size={16} style="color:var(--success);" />
            <span style="font-weight:600; color:var(--success);">Webhook Accepted (HTTP {result.status})</span>
          {:else}
            <AlertTriangle size={16} style="color:var(--danger);" />
            <span style="font-weight:600; color:var(--danger);">Webhook Rejected (HTTP {result.status})</span>
          {/if}
          {#if result.data?.triggerId}
            <button
              class="btn btn-sm btn-ghost"
              style="margin-left:auto;"
              onclick={() => {
                onClose();
                navigate(`/activity/${result.data.triggerId}`);
              }}
            >
              View Run #{result.data.triggerId} <ArrowRight size={13} />
            </button>
          {/if}
        </div>
        {#if error}
          <div class="field-error" style="margin-top:6px;">{error}</div>
        {/if}
      </div>
    {/if}

    <div class="modal-actions" style="margin-top:8px;">
      <button class="btn" onclick={onClose}>Close</button>
      <button class="btn btn-primary" onclick={sendWebhook} disabled={busy || !activeService}>
        {#if busy}<span class="spinner"></span>{:else}<Send size={14} />{/if}
        Send Simulated Webhook
      </button>
    </div>
  </div>
</Modal>
