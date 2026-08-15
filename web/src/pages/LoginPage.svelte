<script>
  import {
    ArrowLeft, ShieldQuestion, KeyRound, Eye, EyeOff, Sun, Moon,
  } from '@lucide/svelte';
  import BrandMark from '../components/BrandMark.svelte';
  import { api } from '../lib/api.js';
  import { setUser } from '../lib/auth.svelte.js';
  import { theme, toggleTheme } from '../lib/theme.svelte.js';
  import { fireConfetti } from '../lib/confetti.js';
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

  function fillDefaultCredentials() {
    username = 'admin';
    password = 'admin123';
    toast('Default credentials populated', 'info');
  }

  async function login(e) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const user = await api.post('/api/auth/login', { username, password });
      fireConfetti({ count: 45 });
      setUser(user);
      toast(`Welcome back, ${user.username}!`, 'success');
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
        error = 'No security question has been set up yet. Sign in with your initial administrator credentials.';
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
      fireConfetti({ count: 50 });
      setUser({ username: res.username, mustChangePassword: false, hasSecurityQuestion: true });
      toast('Password reset successfully — you are now signed in', 'success');
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="auth-wrap">
  <!-- Dynamic Background Glow Orbs -->
  <div class="bg-orb orb-1"></div>
  <div class="bg-orb orb-2"></div>

  <button
    class="btn btn-ghost btn-icon theme-toggle-btn"
    onclick={toggleTheme}
    title="Toggle dark / light theme"
    aria-label="Toggle theme"
  >
    {#if theme.current === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
  </button>

  <div class="auth-card">
    <div class="auth-brand">
      <BrandMark size={46} />
      <div class="brand-name" style="font-size:18px;">VPS CI/CD</div>
    </div>

    {#if mode === 'login'}
      <div class="auth-title">Sign in to VPS CI/CD</div>
      <div class="auth-sub">Manage folder ↔ git sync services and production deployments.</div>
      <form onsubmit={login}>
        <div class="field">
          <label class="label" for="login-user">Username</label>
          <input
            id="login-user"
            class="input"
            bind:value={username}
            autocomplete="username"
            placeholder="admin"
            required
          />
        </div>
        <div class="field">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="label" for="login-pass">Password</label>
            <button
              type="button"
              class="small faint"
              style="background:none; border:none; padding:0; cursor:pointer; color:var(--accent-text);"
              onclick={fillDefaultCredentials}
            >
              Fill default
            </button>
          </div>
          <div class="input-wrap">
            <input
              id="login-pass"
              class="input"
              type={showPass ? 'text' : 'password'}
              bind:value={password}
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
            <div class="input-actions">
              <button
                type="button"
                class="btn btn-ghost btn-icon"
                onclick={() => (showPass = !showPass)}
                tabindex="-1"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {#if showPass}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
              </button>
            </div>
          </div>
        </div>
        {#if error}<div class="field-error" style="margin-bottom:12px;">{error}</div>{/if}
        <button class="btn btn-primary btn-submit" style="width:100%;" disabled={busy}>
          {#if busy}<span class="spinner"></span>{/if}
          <KeyRound size={15} /> Sign in
        </button>
      </form>
      <div class="auth-alt">
        Forgot password?
        <button onclick={forgot} disabled={busy}>Reset with security question</button>
      </div>
    {:else}
      <div class="auth-title">Reset Password</div>
      <div class="auth-sub">Answer your pre-configured security question to set a new password.</div>
      <form onsubmit={reset}>
        <div class="field">
          <span class="label">Security question</span>
          <div class="input" style="background:var(--bg-elevated); color:var(--text-muted); display:flex; align-items:center;">
            <ShieldQuestion size={15} style="margin-right:6px; color:var(--accent);" />
            {question}
          </div>
        </div>
        <div class="field">
          <label class="label" for="q-answer">Your answer</label>
          <input id="q-answer" class="input" bind:value={answer} required placeholder="Security answer" />
          <div class="field-hint">Answers are case-insensitive.</div>
        </div>
        <div class="field">
          <label class="label" for="q-pass1">New password</label>
          <input id="q-pass1" class="input" type="password" bind:value={newPassword} minlength="8" required placeholder="At least 8 characters" />
        </div>
        <div class="field">
          <label class="label" for="q-pass2">Repeat new password</label>
          <input id="q-pass2" class="input" type="password" bind:value={newPassword2} required placeholder="Repeat password" />
        </div>
        {#if error}<div class="field-error" style="margin-bottom:12px;">{error}</div>{/if}
        <button class="btn btn-primary btn-submit" style="width:100%;" disabled={busy}>
          {#if busy}<span class="spinner"></span>{/if}
          Reset password &amp; Sign in
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

<style>
  .theme-toggle-btn {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 50;
    backdrop-filter: blur(8px);
    background: var(--bg-panel);
    border: 1px solid var(--border);
  }
  .bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
    opacity: 0.35;
    animation: floatOrb 12s ease-in-out infinite alternate;
  }
  .orb-1 {
    width: 380px;
    height: 380px;
    background: var(--accent);
    top: 15%;
    left: 20%;
  }
  .orb-2 {
    width: 320px;
    height: 320px;
    background: var(--info);
    bottom: 15%;
    right: 20%;
    animation-delay: -6s;
  }
  @keyframes floatOrb {
    0% {
      transform: translate(0, 0) scale(1);
    }
    100% {
      transform: translate(40px, -30px) scale(1.1);
    }
  }
  .btn-submit {
    box-shadow: 0 4px 14px rgba(124, 108, 240, 0.35);
    transition: all 0.2s ease;
  }
  .btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 108, 240, 0.5);
  }
</style>
