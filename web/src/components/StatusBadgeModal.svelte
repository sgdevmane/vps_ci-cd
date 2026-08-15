<script>
  import { X, ShieldCheck, Copy, Check } from '@lucide/svelte';
  import { toast } from '../lib/toast.svelte.js';

  let { service, onClose } = $props();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const badgeUrl = $derived(`${baseUrl}/api/badges/${service.id}/status.svg`);
  const markdownSnippet = $derived(`[![Deploy Status](${badgeUrl})](${baseUrl}/services/${service.id})`);
  const htmlSnippet = $derived(`<a href="${baseUrl}/services/${service.id}"><img src="${badgeUrl}" alt="Deploy Status" /></a>`);

  let copiedMd = $state(false);
  let copiedHtml = $state(false);

  function copy(text, type) {
    navigator.clipboard.writeText(text);
    if (type === 'md') {
      copiedMd = true;
      setTimeout(() => (copiedMd = false), 2000);
    } else {
      copiedHtml = true;
      setTimeout(() => (copiedHtml = false), 2000);
    }
    toast('Badge snippet copied to clipboard', 'success');
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="badge-title">
  <div class="modal modal-wide">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
      <div>
        <h3 id="badge-title" class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <ShieldCheck size={18} /> Status Badge — {service.name}
        </h3>
        <div class="modal-sub">Embed real-time deployment status badge directly in your GitHub/GitLab README.</div>
      </div>
      <button class="btn btn-ghost btn-icon" onclick={onClose} aria-label="Close modal"><X size={16} /></button>
    </div>

    <div style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:12px; padding:20px; text-align:center; margin-bottom:16px;">
      <div class="small muted" style="margin-bottom:10px;">Live SVG Badge Preview:</div>
      <img src={badgeUrl} alt="Deploy Status Badge" style="vertical-align:middle;" />
    </div>

    <div class="field">
      <label class="label" for="md-snippet">Markdown</label>
      <div class="input-wrap">
        <input id="md-snippet" class="input mono" readonly value={markdownSnippet} />
        <div class="input-actions">
          <button class="btn btn-sm" onclick={() => copy(markdownSnippet, 'md')}>
            {#if copiedMd}<Check size={12} />{:else}<Copy size={12} />{/if}
            {copiedMd ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>

    <div class="field">
      <label class="label" for="html-snippet">HTML</label>
      <div class="input-wrap">
        <input id="html-snippet" class="input mono" readonly value={htmlSnippet} />
        <div class="input-actions">
          <button class="btn btn-sm" onclick={() => copy(htmlSnippet, 'html')}>
            {#if copiedHtml}<Check size={12} />{:else}<Copy size={12} />{/if}
            {copiedHtml ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-primary" onclick={onClose}>Done</button>
    </div>
  </div>
</div>
