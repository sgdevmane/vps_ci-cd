<script>
  import { Plus, RefreshCw, Pencil, Trash2, GitFork } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import ProviderIcon from '../components/ProviderIcon.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import { timeAgo } from '../lib/format.js';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let services = $state([]);
  let loading = $state(true);
  let syncingId = $state(null);
  let deleting = $state(null);
  let deleteBusy = $state(false);

  async function load() {
    try {
      const res = await api.get('/api/services');
      services = res.services;
    } catch (e) {
      toastError(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  function branchRule(s) {
    if (s.branch_mode === 'fixed') return `always → ${s.fixed_branch}`;
    if (s.branch_mode === 'current') return 'stay on current branch';
    const allowed = (s.allowed_branches || '').trim();
    return allowed ? `webhook branch (${allowed})` : 'webhook branch (any)';
  }

  async function toggleEnabled(s) {
    const enabled = !s.enabled;
    s.enabled = enabled;
    try {
      await api.put(`/api/services/${s.id}`, { enabled });
      toast(`"${s.name}" ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (e) {
      s.enabled = !enabled;
      toastError(e);
    }
  }

  async function syncNow(s) {
    syncingId = s.id;
    try {
      await api.post(`/api/services/${s.id}/sync`, {});
      toast(`Sync started for "${s.name}"`, 'info');
      setTimeout(load, 2500);
    } catch (e) {
      toastError(e);
    } finally {
      syncingId = null;
    }
  }

  async function confirmDelete() {
    deleteBusy = true;
    try {
      await api.del(`/api/services/${deleting.id}`);
      toast(`"${deleting.name}" deleted`, 'success');
      deleting = null;
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      deleteBusy = false;
    }
  }
</script>

<div class="page-head">
  <h2>{services.length} service{services.length === 1 ? '' : 's'}</h2>
  <button class="btn btn-primary" onclick={() => navigate('/services/new')}>
    <Plus size={15} /> New service
  </button>
</div>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else if services.length === 0}
  <div class="card card-tight">
    <EmptyState
      icon={GitFork}
      title="No sync services yet"
      sub="Connect any folder on this server to a GitHub, GitLab or generic webhook repository. When the webhook fires, the folder syncs and your commands run."
    >
      <button class="btn btn-primary" onclick={() => navigate('/services/new')}>
        <Plus size={15} /> Create your first service
      </button>
    </EmptyState>
  </div>
{:else}
  <div class="card card-tight">
    <table class="table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Branch rule</th>
          <th>Folder</th>
          <th>Last sync</th>
          <th style="width:64px;">On</th>
          <th style="width:150px;"></th>
        </tr>
      </thead>
      <tbody>
        {#each services as s (s.id)}
          <tr>
            <td>
              <div class="cell-main" style="display:flex; align-items:center; gap:8px;">
                <ProviderIcon provider={s.provider} withLabel={false} />
                <a href={`#/services/${s.id}`} style="color:inherit;">{s.name}</a>
              </div>
              <div class="cell-sub">{s.repo_url}</div>
            </td>
            <td class="small muted nowrap">{branchRule(s)}</td>
            <td class="small mono" style="background:none; border:none; padding:0; color:var(--text-muted);">{s.folder_path}</td>
            <td style="min-width:130px;">
              {#if s.last_sync_at}
                <div class="small nowrap">{timeAgo(s.last_sync_at)}</div>
                {#if s.last_status}<StatusBadge status={s.last_status} />{/if}
              {:else}
                <span class="badge badge-muted">never</span>
              {/if}
            </td>
            <td>
              <label class="toggle">
                <input type="checkbox" checked={s.enabled} onchange={() => toggleEnabled(s)} />
                <span class="track"></span>
              </label>
            </td>
            <td>
              <div style="display:flex; gap:6px; justify-content:flex-end;">
                <button class="btn btn-sm" onclick={() => syncNow(s)} disabled={syncingId === s.id || !s.enabled} title="Sync now">
                  {#if syncingId === s.id}
                    <span class="spinner"></span>
                  {:else}
                    <RefreshCw size={13} />
                  {/if}
                  Sync
                </button>
                <button class="btn btn-sm btn-icon" onclick={() => navigate(`/services/${s.id}`)} title="Edit">
                  <Pencil size={13} />
                </button>
                <button class="btn btn-sm btn-icon btn-danger" onclick={() => (deleting = s)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if deleting}
  <ConfirmDialog
    title="Delete service"
    message={`Delete "${deleting.name}"? Its webhook URL stops working immediately and its trigger history is removed. The synced folder itself is left untouched.`}
    confirmLabel="Delete service"
    busy={deleteBusy}
    onConfirm={confirmDelete}
    onClose={() => (deleting = null)}
  />
{/if}
