<script>
  import { RefreshCw, ScrollText } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { formatDateTime, formatDuration, shortSha, STATUS_META } from '../lib/format.js';
  import { toastError } from '../lib/toast.svelte.js';

  let triggers = $state([]);
  let services = $state([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let serviceFilter = $state('');
  let statusFilter = $state('');

  async function load() {
    try {
      const params = new URLSearchParams({ limit: '60' });
      if (serviceFilter) params.set('service_id', serviceFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/api/triggers?${params}`);
      triggers = res.triggers;
    } catch (e) {
      toastError(e);
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  $effect(() => {
    api.get('/api/services').then((r) => (services = r.services)).catch(() => {});
    load();
  });

  function refresh() {
    refreshing = true;
    load();
  }
</script>

<div class="page-head">
  <div class="filter-bar">
    <select class="select" bind:value={serviceFilter} onchange={load}>
      <option value="">All services</option>
      {#each services as s (s.id)}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
    <select class="select" bind:value={statusFilter} onchange={load}>
      <option value="">All statuses</option>
      {#each Object.entries(STATUS_META) as [key, meta] (key)}
        <option value={key}>{meta.label}</option>
      {/each}
    </select>
  </div>
  <button class="btn" onclick={refresh} disabled={refreshing}>
    {#if refreshing}<span class="spinner"></span>{:else}<RefreshCw size={14} />{/if}
    Refresh
  </button>
</div>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else if triggers.length === 0}
  <div class="card card-tight">
    <EmptyState
      icon={ScrollText}
      title="No triggers recorded"
      sub="When a webhook arrives or you press “Sync now”, the full run is logged here."
    />
  </div>
{:else}
  <div class="card card-tight">
    <table class="table">
      <thead>
        <tr>
          <th>When</th>
          <th>Service</th>
          <th>Source</th>
          <th>Branch</th>
          <th>Commit</th>
          <th>Status</th>
          <th class="nowrap">Duration</th>
        </tr>
      </thead>
      <tbody>
        {#each triggers as t (t.id)}
          <tr
            class="row-click"
            role="link"
            tabindex="0"
            aria-label={`Open trigger #${t.id} for ${t.service_name}`}
            onclick={() => navigate(`/activity/${t.id}`)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/activity/${t.id}`);
              }
            }}
          >
            <td class="small muted nowrap">{formatDateTime(t.created_at)}</td>
            <td class="cell-main">{t.service_name}</td>
            <td>
              <span class="badge" class:badge-accent={t.source === 'webhook'} class:badge-muted={t.source === 'manual'}>
                {t.source}{t.event && t.event !== 'push' && t.event !== 'manual' ? ` · ${t.event}` : ''}
              </span>
            </td>
            <td class="small">{t.branch || '—'}</td>
            <td class="mono small" style="background:none; border:none; padding:0;">{shortSha(t.sha)}</td>
            <td><StatusBadge status={t.status} /></td>
            <td class="small faint nowrap">{formatDuration(t.duration_ms)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
