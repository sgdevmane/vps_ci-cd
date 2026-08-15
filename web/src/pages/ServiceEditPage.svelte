<script>
  import {
    ArrowLeft, Save, Trash2, Eye, EyeOff, Shuffle, Plus, ChevronUp, ChevronDown, Webhook, Play,
    RotateCcw, ShieldCheck, Key, HeartPulse,
  } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import CopyInput from '../components/CopyInput.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import WebhookSimulatorModal from '../components/WebhookSimulatorModal.svelte';
  import RollbackModal from '../components/RollbackModal.svelte';
  import StatusBadgeModal from '../components/StatusBadgeModal.svelte';
  import { fireConfetti } from '../lib/confetti.js';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let { id } = $props();
  const isNew = $derived(!id);

  let loading = $state(false);
  let saving = $state(false);
  let showSecret = $state(false);
  let confirmDelete = $state(false);
  let deleteBusy = $state(false);
  let showSimulator = $state(false);
  let showRollback = $state(false);
  let showBadge = $state(false);
  let rawService = $state(null);

  let envVars = $state([]);

  let form = $state({
    name: '',
    provider: 'github',
    repo_url: '',
    folder_path: '',
    branch_mode: 'webhook',
    fixed_branch: '',
    allowed_branches: '',
    sync_mode: 'pull',
    clone_if_empty: true,
    secret: '',
    generic_token_header: 'X-Webhook-Token',
    healthcheck_url: '',
    auto_rollback: false,
    maintenance_mode: false,
    enabled: true,
    commands: [],
  });
  let hookUrl = $state('');

  async function load() {
    if (!id) return;
    loading = true;
    try {
      const [res, envRes] = await Promise.all([
        api.get(`/api/services/${id}`),
        api.get(`/api/services/${id}/env`),
      ]);
      const s = res.service;
      rawService = s;
      form = {
        name: s.name,
        provider: s.provider,
        repo_url: s.repo_url,
        folder_path: s.folder_path,
        branch_mode: s.branch_mode,
        fixed_branch: s.fixed_branch || '',
        allowed_branches: s.allowed_branches || '',
        sync_mode: s.sync_mode,
        clone_if_empty: s.clone_if_empty,
        secret: s.secret || '',
        generic_token_header: s.generic_token_header || 'X-Webhook-Token',
        healthcheck_url: s.healthcheck_url || '',
        auto_rollback: !!s.auto_rollback,
        maintenance_mode: !!s.maintenance_mode,
        enabled: s.enabled,
        commands: s.commands.map((c) => ({
          command: c.command,
          branch_filter: c.branch_filter || '',
          continue_on_error: !!c.continue_on_error,
        })),
      };
      envVars = (envRes.env || []).map((e) => ({ key: e.key, value: '', is_secret: !!e.is_secret }));
      hookUrl = s.hook_url;
    } catch (e) {
      toastError(e);
      navigate('/services');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (id) {
      load();
    } else {
      rawService = null;
      form = {
        name: '',
        provider: 'github',
        repo_url: '',
        folder_path: '',
        branch_mode: 'webhook',
        fixed_branch: '',
        allowed_branches: '',
        sync_mode: 'pull',
        clone_if_empty: true,
        secret: '',
        generic_token_header: 'X-Webhook-Token',
        healthcheck_url: '',
        auto_rollback: false,
        maintenance_mode: false,
        enabled: true,
        commands: [],
      };
      envVars = [];
      hookUrl = '';
      loading = false;
    }
  });

  function addCommand() {
    form.commands = [...form.commands, { command: '', branch_filter: '', continue_on_error: false }];
  }

  function removeCommand(idx) {
    form.commands = form.commands.filter((_, i) => i !== idx);
  }

  function moveCommand(idx, delta) {
    const target = idx + delta;
    if (target < 0 || target >= form.commands.length) return;
    const copy = [...form.commands];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    form.commands = copy;
  }

  function addEnvVar() {
    envVars = [...envVars, { key: '', value: '', is_secret: true }];
  }

  function removeEnvVar(idx) {
    envVars = envVars.filter((_, i) => i !== idx);
  }

  function generateSecret() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    form.secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    showSecret = true;
  }

  async function manualSync() {
    try {
      const res = await api.post(`/api/services/${id}/sync`, {});
      fireConfetti({ count: 40 });
      toast('Sync enqueued', 'success');
      navigate(`/activity/${res.triggerId}`);
    } catch (e) {
      toastError(e);
    }
  }

  async function save() {
    saving = true;
    try {
      if (isNew) {
        const res = await api.post('/api/services', form);
        if (envVars.length > 0) {
          await api.put(`/api/services/${res.service.id}/env`, { env: envVars });
        }
        fireConfetti({ count: 50 });
        toast('Service created', 'success');
        navigate(`/services/${res.service.id}`);
      } else {
        await Promise.all([
          api.put(`/api/services/${id}`, form),
          api.put(`/api/services/${id}/env`, { env: envVars }),
        ]);
        fireConfetti({ count: 25 });
        toast('Service saved', 'success');
        load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      saving = false;
    }
  }

  async function doDelete() {
    deleteBusy = true;
    try {
      await api.del(`/api/services/${id}`);
      toast('Service deleted', 'success');
      navigate('/services');
    } catch (e) {
      toastError(e);
    } finally {
      deleteBusy = false;
      confirmDelete = false;
    }
  }
</script>

<div class="page-head">
  <button class="btn btn-ghost" onclick={() => navigate('/services')}>
    <ArrowLeft size={15} /> All services
  </button>
  <div style="display:flex; gap:8px; flex-wrap:wrap;">
    {#if !isNew}
      <button class="btn btn-sm" onclick={() => (showRollback = true)}>
        <RotateCcw size={13} /> Rollback
      </button>
      <button class="btn btn-sm" onclick={() => (showBadge = true)}>
        <ShieldCheck size={13} /> Status Badge
      </button>
      <button class="btn btn-sm" onclick={() => (showSimulator = true)}>
        <Play size={13} /> Test Webhook
      </button>
      <button class="btn btn-sm" onclick={manualSync}>
        <Play size={13} /> Sync now
      </button>
      <button class="btn btn-sm btn-danger btn-icon" onclick={() => (confirmDelete = true)} title="Delete service">
        <Trash2 size={14} />
      </button>
    {/if}
  </div>
</div>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else}
  <div class="card">
    <div class="card-head" style="margin-bottom:12px;">
      <h3 class="card-title" style="margin:0;">{isNew ? 'New sync service' : 'Edit service'}</h3>
      <label class="checkbox-line" style="font-size:13px; font-weight:600;">
        <input type="checkbox" bind:checked={form.enabled} /> Enabled
      </label>
    </div>

    <div class="field">
      <label class="label" for="f-name">Service name</label>
      <input id="f-name" class="input" bind:value={form.name} placeholder="e.g. My Next.js Frontend" required />
    </div>

    <div class="field-row">
      <div class="field">
        <label class="label" for="f-provider">Git provider</label>
        <select id="f-provider" class="select" bind:value={form.provider}>
          <option value="github">GitHub</option>
          <option value="gitlab">GitLab</option>
          <option value="bitbucket">Bitbucket</option>
          <option value="gitea">Gitea / Forgejo</option>
          <option value="gogs">Gogs</option>
          <option value="generic">Generic webhook (curl / custom)</option>
        </select>
      </div>

      <div class="field">
        <label class="label" for="f-repo">Repository URL</label>
        <input id="f-repo" class="input mono" bind:value={form.repo_url} placeholder="git@github.com:org/repo.git or https://..." required />
      </div>
    </div>

    <div class="field">
      <label class="label" for="f-folder">Server folder path</label>
      <input id="f-folder" class="input mono" bind:value={form.folder_path} placeholder="/var/www/my-service" required />
      <div class="field-hint">Must be an absolute path on the VPS. The runner will sync files into this directory.</div>
    </div>

    <div class="field-row">
      <div class="field">
        <label class="label" for="f-bmode">Branch strategy</label>
        <select id="f-bmode" class="select" bind:value={form.branch_mode}>
          <option value="webhook">Follow webhook branch (push to `staging` syncs `staging`)</option>
          <option value="fixed">Fixed branch (always checkout the branch below)</option>
          <option value="current">Current branch (do not switch, just pull current)</option>
        </select>
      </div>

      {#if form.branch_mode === 'fixed'}
        <div class="field">
          <label class="label" for="f-fbranch">Target branch</label>
          <input id="f-fbranch" class="input mono" bind:value={form.fixed_branch} placeholder="main" required />
        </div>
      {/if}
    </div>

    <div class="field-row">
      <div class="field">
        <label class="label" for="f-allowed">Allowed branches filter (optional)</label>
        <input id="f-allowed" class="input mono" bind:value={form.allowed_branches} placeholder="main, staging, release/*" />
      </div>
      <div class="field">
        <label class="label" for="f-smode">Git sync mode</label>
        <select id="f-smode" class="select" bind:value={form.sync_mode}>
          <option value="pull">Fast-forward pull (git pull --ff-only)</option>
          <option value="reset">Hard reset (git fetch && git reset --hard origin/branch)</option>
        </select>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label class="label" for="f-health">Healthcheck URL (optional)</label>
        <input id="f-health" class="input mono" bind:value={form.healthcheck_url} placeholder="http://127.0.0.1:3000/api/health" />
        <div class="field-hint">HTTP probe performed after deployment. If it returns non-200, build is marked failed.</div>
      </div>
      <div class="field" style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
        <label class="checkbox-line small muted">
          <input type="checkbox" bind:checked={form.auto_rollback} />
          Auto-rollback on deployment / healthcheck failure
        </label>
        <label class="checkbox-line small muted">
          <input type="checkbox" bind:checked={form.maintenance_mode} />
          Maintenance mode — suspend deployments (triggers complete as skipped)
        </label>
        <label class="checkbox-line small muted">
          <input type="checkbox" bind:checked={form.clone_if_empty} />
          Auto-clone repository if folder is empty
        </label>
      </div>
    </div>

    <div class="field" style="margin-bottom:0;">
      <label class="label" for="f-secret">Secret</label>
      <div class="input-wrap">
        <input
          id="f-secret"
          class="input mono"
          type={showSecret ? 'text' : 'password'}
          bind:value={form.secret}
          placeholder="shared webhook secret"
        />
        <div class="input-actions">
          <button type="button" class="btn btn-ghost btn-icon" onclick={() => (showSecret = !showSecret)} title="Show/hide">
            {#if showSecret}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
          </button>
          <button type="button" class="btn btn-ghost btn-icon" onclick={generateSecret} title="Generate secret">
            <Shuffle size={15} />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Encrypted Environment Variables -->
  <div class="card">
    <div class="card-head" style="margin-bottom:10px;">
      <div>
        <h3 class="card-title" style="display:flex; align-items:center; gap:8px; margin:0;">
          <Key size={15} /> Environment Variables (AES-256 Encrypted)
        </h3>
        <div class="card-sub">Injected securely into shell execution commands during deployments.</div>
      </div>
      <button class="btn btn-sm" onclick={addEnvVar}><Plus size={13} /> Add Variable</button>
    </div>

    {#if envVars.length === 0}
      <div class="field-hint">No environment variables configured.</div>
    {:else}
      <div style="display:flex; flex-direction:column; gap:8px;">
        {#each envVars as ev, i}
          <div style="display:grid; grid-template-columns:1fr 1.5fr auto; gap:8px; align-items:center;">
            <input class="input mono" bind:value={ev.key} placeholder="KEY (e.g. PORT)" />
            <input class="input mono" type="password" bind:value={ev.value} placeholder="Value (encrypted at rest)" />
            <button class="btn btn-ghost btn-icon btn-sm" onclick={() => removeEnvVar(i)} title="Remove">
              <Trash2 size={14} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Post-Sync Commands -->
  <div class="card">
    <div class="card-head" style="margin-bottom:10px;">
      <div>
        <h3 class="card-title">Post-sync commands</h3>
        <div class="card-sub">
          Run in folder after successful sync. Use <code>{'{branch}'}</code> and <code>{'{sha}'}</code> placeholders.
        </div>
      </div>
      <button class="btn btn-sm" onclick={addCommand}><Plus size={13} /> Add command</button>
    </div>

    {#if form.commands.length === 0}
      <div class="field-hint" style="padding: 8px 0 4px;">No commands — the service will only sync the folder.</div>
    {/if}

    {#each form.commands as c, i (i)}
      <div class="command-row">
        <div>
          <label class="label" for="cmd-{i}">Command {i + 1}</label>
          <input id="cmd-{i}" class="input mono" bind:value={c.command} placeholder="npm ci && npm run build" />
        </div>
        <div>
          <label class="label" for="cmd-f-{i}">Only on branches</label>
          <input id="cmd-f-{i}" class="input" bind:value={c.branch_filter} placeholder="any" />
        </div>
        <div class="row-opts">
          <label class="checkbox-line small muted">
            <input type="checkbox" bind:checked={c.continue_on_error} />
            continue on error
          </label>
          <span style="margin-left:auto; display:flex; gap:4px;">
            <button class="btn btn-ghost btn-icon btn-sm" onclick={() => moveCommand(i, -1)} disabled={i === 0} title="Move up">
              <ChevronUp size={14} />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick={() => moveCommand(i, 1)} disabled={i === form.commands.length - 1} title="Move down">
              <ChevronDown size={14} />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick={() => removeCommand(i)} title="Remove">
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      </div>
    {/each}
  </div>

  {#if !isNew}
    <div class="card">
      <div class="section-title"><Webhook size={13} /> Webhook endpoint</div>
      <div class="field">
        <span class="label">Payload URL</span>
        <CopyInput value={hookUrl} />
      </div>
    </div>
  {/if}

  <div style="display:flex; justify-content:flex-end; gap:10px;">
    <button class="btn" onclick={() => navigate('/services')}>Cancel</button>
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {#if saving}<span class="spinner"></span>{:else}<Save size={14} />{/if}
      {isNew ? 'Create service' : 'Save changes'}
    </button>
  </div>
{/if}

{#if showSimulator && rawService}
  <WebhookSimulatorModal service={rawService} onClose={() => (showSimulator = false)} />
{/if}

{#if showRollback && rawService}
  <RollbackModal service={rawService} onClose={() => (showRollback = false)} />
{/if}

{#if showBadge && rawService}
  <StatusBadgeModal service={rawService} onClose={() => (showBadge = false)} />
{/if}

{#if confirmDelete}
  <ConfirmDialog
    title="Delete service"
    message="Delete this service? Its webhook URL stops working immediately and its trigger history is removed."
    confirmLabel="Delete service"
    busy={deleteBusy}
    onConfirm={doDelete}
    onClose={() => (confirmDelete = false)}
  />
{/if}
