<script>
  import Modal from './Modal.svelte';
  import { api } from '../lib/api.js';
  import { auth } from '../lib/auth.svelte.js';
  import { toast, toastError } from '../lib/toast.svelte.js';

  let { forced = false, onClose = undefined } = $props();

  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let busy = $state(false);
  let error = $state('');

  async function save() {
    error = '';
    if (next.length < 8) {
      error = 'New password must be at least 8 characters.';
      return;
    }
    if (next !== confirm) {
      error = 'New passwords do not match.';
      return;
    }
    busy = true;
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      auth.user = { ...auth.user, mustChangePassword: false };
      toast('Password updated', 'success');
      onClose?.();
    } catch (e) {
      error = e.message;
      toastError(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  title={forced ? 'Set a new password' : 'Change password'}
  sub={forced ? 'You are using the default password. Choose your own to continue.' : ''}
  onClose={forced ? undefined : onClose}
>
  <form onsubmit={(e) => { e.preventDefault(); save(); }}>
    <div class="field">
      <label class="label" for="cp-current">Current password</label>
      <input id="cp-current" class="input" type="password" bind:value={current} autocomplete="current-password" required />
    </div>
    <div class="field">
      <label class="label" for="cp-next">New password</label>
      <input id="cp-next" class="input" type="password" bind:value={next} autocomplete="new-password" required minlength="8" />
      <div class="field-hint">At least 8 characters.</div>
    </div>
    <div class="field">
      <label class="label" for="cp-confirm">Repeat new password</label>
      <input id="cp-confirm" class="input" type="password" bind:value={confirm} autocomplete="new-password" required />
    </div>
    {#if error}<div class="field-error">{error}</div>{/if}
    <div class="modal-actions">
      <button class="btn btn-primary" type="submit" disabled={busy}>
        {#if busy}<span class="spinner"></span>{/if}
        Save password
      </button>
    </div>
  </form>
</Modal>
