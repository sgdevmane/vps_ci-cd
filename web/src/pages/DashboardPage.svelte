<script>
  import { GitFork, CircleCheck, CircleAlert, Clock, ArrowRight, Activity } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import ProviderIcon from '../components/ProviderIcon.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { timeAgo, formatDuration, shortSha } from '../lib/format.js';
  import { toastError } from '../lib/toast.svelte.js';

  let services = $state([]);
  let triggers = $state([]);
  let loading = $state(true);

  const enabledCount = $derived(services.filter((s) => s.enabled).length);
  const recent = $derived(triggers.slice(0, 8));
  const finished = $derived(triggers.filter((t) => ['success', 'failed'].includes(t.status)));
  const successRate = $derived(
    finished.length ? Math.round((finished.filter((t) => t.status === 'success').length / finished.length) * 100) : null,
  );
  const lastSync = $derived(
    services.map((s) => s.last_sync_at).filter(Boolean).sort().at(-1) || null,
  );

  async function load() {
    try {
      const [s, t] = await Promise.all([
        api.get('/api/services'),
        api.get('/api/triggers?limit=40'),
      ]);
      services = s.services;
      triggers = t.triggers;
    } catch (e) {
      toastError(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });
</script>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else}
  <div class="stats">
    <div class="stat">
      <div class="stat-icon" style="background:var(--accent-soft); color:var(--accent-text);">
        <GitFork size={19} />
      </div>
      <div>
        <div class="stat-label">Sync services</div>
        <div class="stat-value">{services.length}</div>
        <div class="stat-extra">{enabledCount} enabled</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--success-soft); color:var(--success);">
        <CircleCheck size={19} />
      </div>
      <div>
        <div class="stat-label">Success rate</div>
        <div class="stat-value">{successRate === null ? '—' : `${successRate}%`}</div>
        <div class="stat-extra">{finished.length} finished runs</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--danger-soft); color:var(--danger);">
        <CircleAlert size={19} />
      </div>
      <div>
        <div class="stat-label">Failed runs</div>
        <div class="stat-value">{triggers.filter((t) => t.status === 'failed').length}</div>
        <div class="stat-extra">recent history</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--info-soft); color:var(--info);">
        <Clock size={19} />
      </div>
      <div>
        <div class="stat-label">Last sync</div>
        <div class="stat-value" style="font-size:17px; padding-top:3px;">{timeAgo(lastSync)}</div>
        <div class="stat-extra">across all services</div>
      </div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: 3fr 2fr; gap:18px;" class="dash-grid">
    <div class="card card-tight">
      <div class="card-head" style="padding:18px 22px 0;">
        <div>
          <h3 class="card-title">Recent activity</h3>
          <div class="card-sub">Latest webhook triggers and manual runs</div>
        </div>
        <button class="btn btn-sm" onclick={() => navigate('/activity')}>
          View all <ArrowRight size={13} />
        </button>
      </div>
      {#if recent.length === 0}
        <EmptyState icon={Activity} title="No triggers yet" sub="Push to a connected repository or use “Sync now” on a service." />
      {:else}
        <table class="table" style="margin-top:12px;">
          <tbody>
            {#each recent as t (t.id)}
              <tr class="row-click" onclick={() => navigate(`/activity/${t.id}`)}>
                <td style="width:110px;" class="faint small nowrap">{timeAgo(t.created_at)}</td>
                <td>
                  <div class="cell-main">{t.service_name}</div>
                  <div class="cell-sub">{t.branch || '—'} · {shortSha(t.sha)}</div>
                </td>
                <td style="width:105px;"><StatusBadge status={t.status} /></td>
                <td style="width:70px;" class="faint small nowrap">{formatDuration(t.duration_ms)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="card card-tight">
      <div class="card-head" style="padding:18px 22px 0;">
        <div>
          <h3 class="card-title">Services</h3>
          <div class="card-sub">Folder ↔ repository bindings</div>
        </div>
      </div>
      {#if services.length === 0}
        <EmptyState icon={GitFork} title="No services yet" sub="Create your first folder ↔ repository sync service.">
          <button class="btn btn-primary btn-sm" onclick={() => navigate('/services/new')}>New service</button>
        </EmptyState>
      {:else}
        <div style="padding: 6px 10px 12px;">
          {#each services as s (s.id)}
            <button
              class="btn btn-ghost"
              style="width:100%; justify-content:flex-start; gap:10px; padding:10px 12px;"
              onclick={() => navigate(`/services/${s.id}`)}
            >
              <ProviderIcon provider={s.provider} withLabel={false} />
              <span style="flex:1; text-align:left;">
                <span style="display:block; font-weight:650; color:var(--text); font-size:13.5px;">{s.name}</span>
                <span class="small faint" style="display:block;">{s.folder_path}</span>
              </span>
              {#if s.last_status}
                <StatusBadge status={s.last_status} />
              {:else}
                <span class="badge badge-muted">new</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @media (max-width: 960px) {
    .dash-grid {
      grid-template-columns: 1fr !important;
    }
  }
</style>
