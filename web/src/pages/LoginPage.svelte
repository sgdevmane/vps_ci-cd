<script>
  import { Radio, ArrowLeft, ShieldQuestion, KeyRound, Eye, EyeOff, Sun, Moon } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { setUser } from '../lib/auth.svelte.js';
  import { theme, toggleTheme } from '../lib/theme.svelte.js';
  import { toast } from '../lib/toast.svelte.js';

  let mode = $state('login'); // login | question
  let busy = $state(false);
  let error = $state('');

  let username = $state('');
  let password = $state('');
  let showPass = $state(false);

  let question = $state('');
  let answer = $state('');
  let newPassword = $state('');
  let newPassword2 = $state('');

  async function login(e) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const user = await api.post('/api/auth/login', { username, password });
      setUser(user);
      toast(`Welcome back, ${user.username}`, 'success');
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function forgot() {
    error = '';
    busy = true;
    try {
      const res = await api.get('/api/auth/security-question');
      if (!res.set) {
        error = 'No security question has been set up yet. Sign in with your credentials.';
        return;
      }
      question = res.question;
      mode = 'question';
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function reset(e) {
    e.preventDefault();
    error = '';
    if (newPassword.length < 8) {
      error = 'New password must be at least 8 characters.';
      return;
    }
    if (newPassword !== newPassword2) {
      error = 'New passwords do not match.';
      return;
    }
    busy = true;
    try {
      const res = await api.post('/api/auth/reset-password', { answer, newPassword });
      setUser({ username: res.username, mustChangePassword: false, hasSecurityQuestion: true });
      toast('Password reset — you are now signed in', 'success');
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="auth-wrap">
  <button
    class="btn btn-ghost btn-icon"
    style="position:fixed; top:18px; right:18px;"
    onclick={toggleTheme}
    title="Toggle theme"
  >
    {#if theme.current === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
  </button>

  <div class="auth-card">
    <div class="auth-brand">
      <div class="brand-mark">
        <Radio size={22} stroke-width={2.2} />
      </div>
      <div class="brand-name" style="font-size:17px;">VPS CI/CD</div>
    </div>

    {#if mode === 'login'}
      <div class="auth-title">Sign in</div>
      <div class="auth-sub">Manage your sync services and deployments.</div>
      <form onsubmit={login}>
        <div class="field">
          <label class="label" for="login-user">Username</label>
          <input id="login-user" class="input" bind:value={username} autocomplete="username" required />
        </div>
        <div class="field">
          <label class="label" for="login-pass">Password</label>
          <div class="input-wrap">
            <input
              id="login-pass"
              class="input"
              type={showPass ? 'text' : 'password'}
              bind:value={password}
              autocomplete="current-password"
              required
            />
            <div class="input-actions">
              <button type="button" class="btn btn-ghost btn-icon" onclick={() => (showPass = !showPass)} tabindex="-1">
                {#if showPass}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
              </button>
            </div>
          </div>
        </div>
        {#if error}<div class="field-error" style="margin-bottom:10px;">{error}</div>{/if}
        <button class="btn btn-primary" style="width:100%;" disabled={busy}>
          {#if busy}<span class="spinner"></span>{/if}
          <KeyRound size={15} /> Sign in
        </button>
      </form>
      <div class="auth-alt">
        Forgot your password?
        <button onclick={forgot} disabled={busy}>Reset with security question</button>
      </div>
    {:else}
      <div class="auth-title">Reset password</div>
      <div class="auth-sub">Answer your security question to set a new password.</div>
      <form onsubmit={reset}>
        <div class="field">
          <label class="label" for="q-display">Security question</label>
          <div class="input" style="background:var(--bg-elevated); color:var(--text-muted);">
            <ShieldQuestion size={14} style="vertical-align:-2px; margin-right:6px;" />
            {question}
          </div>
        </div>
        <div class="field">
          <label class="label" for="q-answer">Your answer</label>
          <input id="q-answer" class="input" bind:value={answer} required />
          <div class="field-hint">Answers are not case-sensitive.</div>
        </div>
        <div class="field">
          <label class="label" for="q-pass1">New password</label>
          <input id="q-pass1" class="input" type="password" bind:value={newPassword} minlength="8" required />
        </div>
        <div class="field">
          <label class="label" for="q-pass2">Repeat new password</label>
          <input id="q-pass2" class="input" type="password" bind:value={newPassword2} required />
        </div>
        {#if error}<div class="field-error" style="margin-bottom:10px;">{error}</div>{/if}
        <button class="btn btn-primary" style="width:100%;" disabled={busy}>
          {#if busy}<span class="spinner"></span>{/if}
          Reset password
        </button>
      </form>
      <div class="auth-alt">
        <button onclick={() => { mode = 'login'; error = ''; }}>
          <ArrowLeft size={13} style="vertical-align:-2px;" /> Back to sign in
        </button>
      </div>
    {/if}
  </div>
</div>
