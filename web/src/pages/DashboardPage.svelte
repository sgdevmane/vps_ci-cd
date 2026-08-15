<script>
  import {
    GitFork, CircleCheck, CircleAlert, Clock, ArrowRight, Activity, Play, Plus,
    Cpu, RefreshCw, Zap, ExternalLink, ShieldCheck, Sparkles, ChevronLeft, ChevronRight
  } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import ProviderIcon from '../components/ProviderIcon.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import WebhookSimulatorModal from '../components/WebhookSimulatorModal.svelte';
  import { timeAgo, formatDuration, shortSha } from '../lib/format.js';
  import { fireConfetti } from '../lib/confetti.js';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let services = $state([]);
  let triggers = $state([]);
  let loading = $state(true);
  let showSimulator = $state(false);
  let activeSlide = $state(0);
  let slideTimer = null;

  const slides = [
    {
      badge: 'High Availability',
      title: 'Dual Load-Balanced Node Instances',
      desc: 'Nginx dynamically load-balances incoming webhook traffic across multiple instances with zero downtime.',
      icon: Cpu,
      gradient: 'linear-gradient(135deg, rgba(124, 108, 240, 0.22) 0%, rgba(56, 189, 248, 0.12) 100%)',
    },
    {
      badge: 'Multi-Provider Engine',
      title: 'Automated Git Sync & Webhook Verification',
      desc: 'Supports GitHub, GitLab, Bitbucket, Gitea, Forgejo, and custom webhook sources with HMAC-SHA256 verification.',
      icon: Zap,
      gradient: 'linear-gradient(135deg, rgba(62, 207, 142, 0.2) 0%, rgba(124, 108, 240, 0.15) 100%)',
    },
    {
      badge: 'Observability & Metrics',
      title: 'Prometheus & Grafana Monitoring',
      desc: 'Real-time telemetry on deployment latency, memory utilization, and webhook error rates exported at /api/metrics.',
      icon: Activity,
      gradient: 'linear-gradient(135deg, rgba(240, 178, 84, 0.2) 0%, rgba(242, 99, 122, 0.12) 100%)',
    },
  ];

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
    slideTimer = setInterval(() => {
      activeSlide = (activeSlide + 1) % slides.length;
    }, 6000);
    return () => clearInterval(slideTimer);
  });

  async function quickSync(service) {
    try {
      await api.post(`/api/services/${service.id}/sync`, {});
      fireConfetti({ count: 35 });
      toast(`Deployment enqueued for ${service.name}`, 'info');
      setTimeout(load, 2000);
    } catch (e) {
      toastError(e);
    }
  }
</script>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else}
  <!-- Animated Highlight Carousel -->
  <div class="carousel-card" style="background: {slides[activeSlide].gradient};">
    <div class="carousel-content">
      <div class="badge badge-accent carousel-badge">
        <Sparkles size={12} /> {slides[activeSlide].badge}
      </div>
      <h2 class="carousel-title">{slides[activeSlide].title}</h2>
      <p class="carousel-desc">{slides[activeSlide].desc}</p>
      <div class="carousel-actions">
        <button class="btn btn-primary btn-sm" onclick={() => (showSimulator = true)}>
          <Play size={13} /> Simulate Webhook
        </button>
        <button class="btn btn-ghost btn-sm" onclick={() => navigate('/services/new')}>
          <Plus size={13} /> Add New Service
        </button>
        <a href="/api/docs" target="_blank" class="btn btn-ghost btn-sm" style="margin-left:auto;">
          Swagger API <ExternalLink size={12} />
        </a>
      </div>
    </div>
    <div class="carousel-controls">
      <button
        class="btn btn-ghost btn-icon btn-sm"
        onclick={() => (activeSlide = (activeSlide - 1 + slides.length) % slides.length)}
        aria-label="Previous Slide"
      >
        <ChevronLeft size={16} />
      </button>
      <div class="carousel-dots">
        {#each slides as _, i}
          <button
            class="dot-btn"
            class:active={activeSlide === i}
            onclick={() => (activeSlide = i)}
            aria-label={`Slide ${i + 1}`}
          ></button>
        {/each}
      </div>
      <button
        class="btn btn-ghost btn-icon btn-sm"
        onclick={() => (activeSlide = (activeSlide + 1) % slides.length)}
        aria-label="Next Slide"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="stats">
    <div class="stat">
      <div class="stat-icon" style="background:var(--accent-soft); color:var(--accent-text);">
        <GitFork size={19} />
      </div>
      <div>
        <div class="stat-label">Sync Services</div>
        <div class="stat-value">{services.length}</div>
        <div class="stat-extra">{enabledCount} active &amp; listening</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--success-soft); color:var(--success);">
        <CircleCheck size={19} />
      </div>
      <div>
        <div class="stat-label">Success Rate</div>
        <div class="stat-value">{successRate === null ? '—' : `${successRate}%`}</div>
        <div class="stat-extra">{finished.length} completed executions</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--danger-soft); color:var(--danger);">
        <CircleAlert size={19} />
      </div>
      <div>
        <div class="stat-label">Failed Runs</div>
        <div class="stat-value">{triggers.filter((t) => t.status === 'failed').length}</div>
        <div class="stat-extra">recent failures</div>
      </div>
    </div>
    <div class="stat">
      <div class="stat-icon" style="background:var(--info-soft); color:var(--info);">
        <Clock size={19} />
      </div>
      <div>
        <div class="stat-label">Last Sync</div>
        <div class="stat-value" style="font-size:17px; padding-top:3px;">{timeAgo(lastSync)}</div>
        <div class="stat-extra">across all repos</div>
      </div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: 3fr 2fr; gap:18px;" class="dash-grid">
    <!-- Recent Activity -->
    <div class="card card-tight">
      <div class="card-head" style="padding:18px 22px 0;">
        <div>
          <h3 class="card-title">Recent Activity</h3>
          <div class="card-sub">Latest webhook dispatches and manual runs</div>
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

    <!-- Services Overview -->
    <div class="card card-tight">
      <div class="card-head" style="padding:18px 22px 0;">
        <div>
          <h3 class="card-title">Configured Services</h3>
          <div class="card-sub">Folder ↔ repository sync endpoints</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick={() => (showSimulator = true)} title="Test any service">
          <Play size={13} /> Simulate
        </button>
      </div>
      {#if services.length === 0}
        <EmptyState icon={GitFork} title="No services yet" sub="Create your first folder ↔ repository sync service.">
          <button class="btn btn-primary btn-sm" onclick={() => navigate('/services/new')}>
            <Plus size={13} /> New service
          </button>
        </EmptyState>
      {:else}
        <div style="padding: 6px 10px 12px;">
          {#each services as s (s.id)}
            <div
              style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--radius-sm); transition:background 0.15s ease;"
              class="service-item-row"
            >
              <button
                class="btn btn-ghost"
                style="flex:1; justify-content:flex-start; gap:10px; padding:0; height:auto; background:none; border:none;"
                onclick={() => navigate(`/services/${s.id}`)}
              >
                <ProviderIcon provider={s.provider} withLabel={false} />
                <span style="flex:1; text-align:left;">
                  <span style="display:block; font-weight:650; color:var(--text); font-size:13.5px;">{s.name}</span>
                  <span class="small faint mono" style="display:block;">{s.folder_path}</span>
                </span>
              </button>
              {#if s.last_status}
                <StatusBadge status={s.last_status} />
              {:else}
                <span class="badge badge-muted">new</span>
              {/if}
              <button
                class="btn btn-ghost btn-icon btn-sm"
                onclick={() => quickSync(s)}
                disabled={!s.enabled}
                title="Sync now"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showSimulator}
  <WebhookSimulatorModal
    {services}
    onClose={() => (showSimulator = false)}
  />
{/if}

<style>
  .carousel-card {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px 26px;
    margin-bottom: 22px;
    box-shadow: var(--shadow);
    transition: all 0.5s ease-in-out;
    overflow: hidden;
  }
  .carousel-badge {
    margin-bottom: 8px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .carousel-title {
    font-size: 19px;
    font-weight: 700;
    margin: 0 0 6px;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .carousel-desc {
    font-size: 13.5px;
    color: var(--text-muted);
    margin: 0 0 16px;
    max-width: 680px;
    line-height: 1.5;
  }
  .carousel-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .carousel-controls {
    position: absolute;
    top: 18px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .carousel-dots {
    display: flex;
    gap: 5px;
    margin: 0 4px;
  }
  .dot-btn {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border-strong);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .dot-btn.active {
    width: 18px;
    border-radius: 4px;
    background: var(--accent);
  }
  .service-item-row:hover {
    background: var(--bg-hover);
  }
  @media (max-width: 960px) {
    .dash-grid {
      grid-template-columns: 1fr !important;
    }
    .carousel-controls {
      position: static;
      margin-top: 14px;
      justify-content: flex-end;
    }
  }
</style>
