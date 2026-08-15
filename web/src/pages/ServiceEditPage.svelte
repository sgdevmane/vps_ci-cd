<script>
  import {
    ArrowLeft, Save, Trash2, Eye, EyeOff, Shuffle, Plus, ChevronUp, ChevronDown, Webhook, Play,
  } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import CopyInput from '../components/CopyInput.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import WebhookSimulatorModal from '../components/WebhookSimulatorModal.svelte';
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
  let rawService = $state(null);

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
    enabled: true,
    commands: [],
  });
  let hookUrl = $state('');

  async function load() {
    if (!id) return;
    loading = true;
    try {
      const res = await api.get(`/api/services/${id}`);
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
        enabled: s.enabled,
        commands: s.commands.map((c) => ({
          command: c.command,
          branch_filter: c.branch_filter || '',
          continue_on_error: !!c.continue_on_error,
        })),
      };
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
        enabled: true,
        commands: [],
      };
      hookUrl = '';
      loading = false;
    }
  });

  function addCommand() {
    form.commands.push({ command: '', branch_filter: '', continue_on_error: false });
  }

  function removeCommand(i) {
    form.commands.splice(i, 1);
  }

  function moveCommand(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= form.commands.length) return;
    const tmp = form.commands[i];
    form.commands[i] = form.commands[j];
    form.commands[j] = tmp;
    form.commands = [...form.commands];
  }

  function generateSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    form.secret = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    showSecret = true;
  }

  async function save() {
    saving = true;
    try {
      const body = { ...form, commands: form.commands };
      if (isNew) {
        const res = await api.post('/api/services', body);
        fireConfetti({ count: 50 });
        toast('Service created successfully', 'success');
        navigate(`/services/${res.service.id}`);
      } else {
        await api.put(`/api/services/${id}`, body);
        fireConfetti({ count: 30 });
        toast('Service changes saved', 'success');
        await load();
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
      deleteBusy = false;
    }
  }
</script>

{#if loading}
  <div style="display:grid; place-items:center; padding:80px;"><div class="spinner spinner-lg"></div></div>
{:else}
  <div class="page-head">
    <button class="btn btn-ghost" onclick={() => navigate('/services')}>
      <ArrowLeft size={15} /> All services
    </button>
    <div style="display:flex; gap:10px;">
      {#if !isNew}
        <button class="btn btn-ghost" onclick={() => (showSimulator = true)} title="Simulate webhook payload">
          <Play size={14} /> Simulate Webhook
        </button>
        <button class="btn btn-danger" onclick={() => (confirmDelete = true)}>
          <Trash2 size={14} /> Delete
        </button>
      {/if}
      <button class="btn btn-primary" onclick={save} disabled={saving}>
        {#if saving}<span class="spinner"></span>{:else}<Save size={14} />{/if}
        {isNew ? 'Create service' : 'Save changes'}
      </button>
    </div>
  </div>

  <div class="card">
    <div class="section-title">General</div>
    <div class="field-row">
      <div class="field">
        <label class="label" for="f-name">Service name</label>
        <input id="f-name" class="input" bind:value={form.name} placeholder="Marketing site" />
      </div>
      <div class="field">
        <label class="label" for="f-provider">Provider</label>
        <select id="f-provider" class="select" bind:value={form.provider}>
          <option value="github">GitHub</option>
          <option value="gitlab">GitLab</option>
          <option value="bitbucket">Bitbucket</option>
          <option value="gitea">Gitea / Forgejo (Codeberg)</option>
          <option value="gogs">Gogs</option>
          <option value="generic">Generic (any webhook source)</option>
        </select>
      </div>
    </div>
    <label class="checkbox-line">
      <input type="checkbox" bind:checked={form.enabled} />
      Service enabled — webhooks are accepted and manual syncs allowed
    </label>
  </div>

  <div class="card">
    <div class="section-title">Repository &amp; folder</div>
    <div class="field">
      <label class="label" for="f-repo">Repository URL</label>
      <input id="f-repo" class="input mono" bind:value={form.repo_url} placeholder="https://github.com/acme/site.git  or  git@github.com:acme/site.git" />
      <div class="field-hint">HTTPS or SSH. For SSH, the server user's key must be available to this process.</div>
    </div>
    <div class="field">
      <label class="label" for="f-folder">Folder on this server</label>
      <input id="f-folder" class="input mono" bind:value={form.folder_path} placeholder="/var/www/my-app" />
      <div class="field-hint">Absolute path to the folder that should mirror the repository. It can be anywhere this process has write access.</div>
    </div>
    <div class="field">
      <span class="label">Sync mode</span>
      <div class="pill-radio">
        <button type="button" class:active={form.sync_mode === 'pull'} onclick={() => (form.sync_mode = 'pull')}>Pull (fast-forward)</button>
        <button type="button" class:active={form.sync_mode === 'reset'} onclick={() => (form.sync_mode = 'reset')}>Hard reset to remote</button>
      </div>
      <div class="field-hint">
        {#if form.sync_mode === 'pull'}
          Fast-forwards the folder. Fails if the folder contains local commits — safe for folders nobody edits locally.
        {:else}
          Forces the folder to exactly match the remote branch, discarding local changes. Typical for deployments.
        {/if}
      </div>
    </div>
    <label class="checkbox-line">
      <input type="checkbox" bind:checked={form.clone_if_empty} />
      Clone automatically if the folder is empty or not a repository yet
    </label>
  </div>

  <div class="card">
    <div class="section-title">Branch behavior</div>
    <div class="field">
      <span class="label">When a webhook arrives…</span>
      <div class="pill-radio">
        <button type="button" class:active={form.branch_mode === 'webhook'} onclick={() => (form.branch_mode = 'webhook')}>Follow webhook branch</button>
        <button type="button" class:active={form.branch_mode === 'fixed'} onclick={() => (form.branch_mode = 'fixed')}>Switch to fixed branch</button>
        <button type="button" class:active={form.branch_mode === 'current'} onclick={() => (form.branch_mode = 'current')}>Stay on current branch</button>
      </div>
      <div class="field-hint">
        {#if form.branch_mode === 'webhook'}
          The folder switches to whichever branch the push targeted — e.g. push to <code>staging</code> checks out <code>staging</code>.
        {:else if form.branch_mode === 'fixed'}
          The folder always switches to the branch below, regardless of what the webhook reports.
        {:else}
          The folder keeps whatever branch is currently checked out and only refreshes its content.
        {/if}
      </div>
    </div>
    {#if form.branch_mode === 'fixed'}
      <div class="field">
        <label class="label" for="f-fixed">Fixed branch</label>
        <input id="f-fixed" class="input" bind:value={form.fixed_branch} placeholder="main" />
      </div>
    {/if}
    <div class="field" style="margin-bottom:0;">
      <label class="label" for="f-allowed">Only react to these branches</label>
      <input id="f-allowed" class="input" bind:value={form.allowed_branches} placeholder="main, staging  (empty = every branch)" />
      <div class="field-hint">Comma-separated. Pushes to other branches are logged as “skipped”.</div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Webhook secret</div>
    {#if form.provider === 'github'}
      <div class="field-hint" style="margin-bottom:12px;">
        GitHub signs each delivery with this secret (HMAC SHA-256, <code>X-Hub-Signature-256</code>). Create one below and paste it into the GitHub webhook settings too.
      </div>
    {:else if form.provider === 'gitlab'}
      <div class="field-hint" style="margin-bottom:12px;">
        GitLab sends this value back in the <code>X-Gitlab-Token</code> header. Use the same string as the “Secret token” in the GitLab webhook settings.
      </div>
    {:else if form.provider === 'bitbucket'}
      <div class="field-hint" style="margin-bottom:12px;">
        Bitbucket Cloud does not sign deliveries. If you set a secret, append <code>?token=&lt;secret&gt;</code> to the webhook URL (or send an <code>X-Webhook-Token</code> header) and it will be enforced; leave it empty to accept unsigned deliveries and keep the URL private.
      </div>
    {:else if form.provider === 'gitea'}
      <div class="field-hint" style="margin-bottom:12px;">
        Gitea / Forgejo (and Codeberg) sign deliveries with HMAC SHA-256 in <code>X-Gitea-Signature</code> / <code>X-Forgejo-Signature</code>. Use the same string as the “Secret” in the webhook settings.
      </div>
    {:else if form.provider === 'gogs'}
      <div class="field-hint" style="margin-bottom:12px;">
        Gogs signs deliveries with HMAC SHA-256 in <code>X-Gogs-Signature</code>. Use the same string as the “Secret” in the Gogs webhook settings.
      </div>
    {:else}
      <div class="field-hint" style="margin-bottom:12px;">
        The token must arrive in the header named below, or as <code>?token=…</code> on the webhook URL. Leave the secret empty to accept unsigned deliveries (not recommended).
      </div>
      <div class="field">
        <label class="label" for="f-header">Token header name</label>
        <input id="f-header" class="input mono" bind:value={form.generic_token_header} />
      </div>
    {/if}
    <div class="field" style="margin-bottom:0;">
      <label class="label" for="f-secret">Secret</label>
      <div class="input-wrap">
        <input
          id="f-secret"
          class="input mono"
          type={showSecret ? 'text' : 'password'}
          bind:value={form.secret}
          placeholder={form.provider === 'generic' || form.provider === 'bitbucket' ? 'empty = no verification' : 'shared webhook secret'}
        />
        <div class="input-actions">
          <button type="button" class="btn btn-ghost btn-icon" onclick={() => (showSecret = !showSecret)} title="Show/hide">
            {#if showSecret}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
          </button>
          <button type="button" class="btn btn-ghost btn-icon" onclick={generateSecret} title="Generate a strong secret">
            <Shuffle size={15} />
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head" style="margin-bottom:10px;">
      <div>
        <h3 class="card-title">Post-sync commands</h3>
        <div class="card-sub">
          Run in the folder after a successful sync, top to bottom. Use <code>{'{branch}'}</code> and <code>{'{sha}'}</code> placeholders —
          e.g. <code>npm run docker:{'{branch}'}:up</code>.
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
        <div class="field-hint">
          {#if form.provider === 'github'}
            In the repo: Settings → Webhooks → Add webhook. Paste this URL, set Content type to <code>application/json</code>, add the secret above, and choose “Push” events (others are ignored safely).
          {:else if form.provider === 'gitlab'}
            In the repo: Settings → Webhooks. Paste this URL, set the Secret token to the secret above, and enable “Push events”.
          {:else if form.provider === 'bitbucket'}
            In the repo: Repository settings → Webhooks → Add webhook. Paste this URL (append <code>?token=…</code> if you set a secret) and choose the “Repository push” trigger.
          {:else if form.provider === 'gitea'}
            In the repo: Settings → Webhooks → Add webhook (Gitea). Paste this URL, set the Secret to the secret above, and keep the “Push events” trigger.
          {:else if form.provider === 'gogs'}
            In the repo: Settings → Webhooks → Add webhook. Paste this URL, set the Secret to the secret above, and choose “Push” events.
          {:else}
            Point any automation that can POST JSON at this URL. Include the token in the configured header or as <code>?token=…</code>.
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="card">
      <div class="section-title"><Webhook size={13} /> Webhook endpoint</div>
      <div class="field-hint">The unique webhook URL for this service is generated when you create it.</div>
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
  <WebhookSimulatorModal
    service={rawService}
    onClose={() => (showSimulator = false)}
  />
{/if}

{#if confirmDelete}
  <ConfirmDialog
    title="Delete service"
    message="Delete this service? Its webhook URL stops working immediately and its trigger history is removed. The synced folder itself is left untouched."
    confirmLabel="Delete service"
    busy={deleteBusy}
    onConfirm={doDelete}
    onClose={() => (confirmDelete = false)}
  />
{/if}
