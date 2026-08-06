<script>
  import { KeyRound, ShieldQuestion, Globe, Save } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import ChangePasswordModal from '../components/ChangePasswordModal.svelte';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let me = $state(null);
  let passModal = $state(false);

  let question = $state('');
  let answer = $state('');
  let qBusy = $state(false);

  let baseUrl = $state('');
  let effective = $state('');
  let urlBusy = $state(false);

  async function load() {
    try {
      const [authMe, settings] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/settings'),
      ]);
      me = authMe;
      baseUrl = settings.publicBaseUrl || '';
      effective = settings.effectiveBaseUrl;
    } catch (e) {
      toastError(e);
    }
  }

  $effect(() => {
    load();
  });

  async function saveQuestion(e) {
    e.preventDefault();
    qBusy = true;
    try {
      await api.put('/api/auth/security-question', { question, answer });
      toast('Security question saved', 'success');
      answer = '';
      load();
    } catch (err) {
      toastError(err);
    } finally {
      qBusy = false;
    }
  }

  async function saveBaseUrl() {
    urlBusy = true;
    try {
      const res = await api.put('/api/settings', { publicBaseUrl: baseUrl });
      effective = res.effectiveBaseUrl;
      toast('Server settings saved', 'success');
    } catch (err) {
      toastError(err);
    } finally {
      urlBusy = false;
    }
  }
</script>

<div class="card">
  <div class="section-title"><KeyRound size={13} /> Password</div>
  <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
    <div>
      <div style="font-weight:650;">Signed in as {me?.username ?? '…'}</div>
      <div class="small muted">Change the password you use to sign in to this panel.</div>
    </div>
    <button class="btn" onclick={() => (passModal = true)}>Change password</button>
  </div>
</div>

<div class="card">
  <div class="section-title"><ShieldQuestion size={13} /> Password reset — security question</div>
  {#if me?.hasSecurityQuestion}
    <div class="badge badge-success" style="margin-bottom:12px;"><span class="dot"></span>A security question is configured</div>
  {:else}
    <div class="badge badge-warning" style="margin-bottom:12px;"><span class="dot"></span>Not configured yet — password reset is disabled</div>
  {/if}
  <form onsubmit={saveQuestion}>
    <div class="field">
      <label class="label" for="sq-q">Question</label>
      <input id="sq-q" class="input" bind:value={question} placeholder="What was the name of your first server?" required />
    </div>
    <div class="field">
      <label class="label" for="sq-a">{me?.hasSecurityQuestion ? 'New answer' : 'Answer'}</label>
      <input id="sq-a" class="input" bind:value={answer} placeholder="Leave blank to keep the current answer" minlength={me?.hasSecurityQuestion ? 0 : 2} required={!me?.hasSecurityQuestion} />
      <div class="field-hint">Answers are not case-sensitive. This is the only way to recover access if you forget the password.</div>
    </div>
    <button class="btn btn-primary" disabled={qBusy || (!question && !answer)}>
      {#if qBusy}<span class="spinner"></span>{:else}<Save size={14} />{/if}
      Save security question
    </button>
  </form>
</div>

<div class="card">
  <div class="section-title"><Globe size={13} /> Public URL</div>
  <div class="field">
    <label class="label" for="base-url">Public base URL of this server</label>
    <input id="base-url" class="input mono" bind:value={baseUrl} placeholder={effective || 'https://deploy.example.com'} />
    <div class="field-hint">
      Used to build the webhook URLs shown on services. Set it when this panel sits behind a reverse proxy or domain —
      e.g. <code>https://deploy.example.com</code>. Currently effective: <code>{effective}</code>
    </div>
  </div>
  <button class="btn btn-primary" onclick={saveBaseUrl} disabled={urlBusy}>
    {#if urlBusy}<span class="spinner"></span>{:else}<Save size={14} />{/if}
    Save URL
  </button>
</div>

{#if passModal}
  <ChangePasswordModal onClose={() => (passModal = false)} />
{/if}
