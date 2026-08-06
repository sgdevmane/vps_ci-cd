<script>
  import { ArrowLeft, RefreshCw, ShieldCheck, ShieldAlert, ShieldOff } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import ProviderIcon from '../components/ProviderIcon.svelte';
  import LogViewer from '../components/LogViewer.svelte';
  import { formatDateTime, formatDuration } from '../lib/format.js';
  import { toastError } from '../lib/toast.svelte.js';

  let { id } = $props();

  let trigger = $state(null);
  let loading = $state(true);

  const live = $derived(trigger && ['queued', 'running'].includes(trigger.status));

  async function load() {
    try {
      const res = await api.get(`/api/triggers/${id}`);
      trigger = res.trigger;
    } catch (e) {
      toastError(e);
      navigate('/activity');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  $effect(() => {
    if (!live) return;
    const timer = setInterval(load, 2500);
    return () => clearInterval(timer);
  });
</script>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else if trigger}
  <div class="page-head">
    <button class="btn btn-ghost" onclick={() => navigate('/activity')}>
      <ArrowLeft size={15} /> All activity
    </button>
    <div style="display:flex; align-items:center; gap:10px;">
      <StatusBadge status={trigger.status} />
      <button class="btn btn-sm" onclick={load}>
        <span class="inline-icon" class:spinning={live}><RefreshCw size={13} /></span> Refresh
      </button>
    </div>
  </div>

  <div class="card">
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
      <ProviderIcon provider={trigger.service_provider} withLabel={false} />
      <h3 class="card-title" style="margin:0;">{trigger.service_name}</h3>
      <span class="faint small">trigger #{trigger.id}</span>
      {#if trigger.signature_ok === true}
        <span class="badge badge-success"><ShieldCheck size={12} /> signature verified</span>
      {:else if trigger.signature_ok === false}
        <span class="badge badge-danger"><ShieldAlert size={12} /> signature failed</span>
      {:else}
        <span class="badge badge-muted"><ShieldOff size={12} /> not verified</span>
      {/if}
    </div>
    <dl class="kv">
      <dt>Received</dt><dd>{formatDateTime(trigger.created_at)}</dd>
      <dt>Source</dt><dd>{trigger.source}{trigger.event ? ` · ${trigger.event}` : ''}</dd>
      <dt>Branch</dt><dd>{trigger.branch || '—'}</dd>
      <dt>Commit</dt><dd class="mono" style="font-size:12px;">{trigger.sha || '—'}</dd>
      <dt>Folder</dt><dd class="mono" style="font-size:12px;">{trigger.service_folder}</dd>
      <dt>From IP</dt><dd>{trigger.ip || '—'}</dd>
      <dt>Duration</dt><dd>{formatDuration(trigger.duration_ms)}</dd>
    </dl>
  </div>

  <div class="card">
    <div class="card-head" style="margin-bottom:10px;">
      <h3 class="card-title">Run log</h3>
      {#if live}<span class="badge badge-info badge-running"><span class="dot"></span>live</span>{/if}
    </div>
    <LogViewer log={trigger.log || 'No output yet.'} />
  </div>
{/if}

<style>
  .inline-icon {
    display: inline-flex;
    vertical-align: -2px;
  }
  .spinning {
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
