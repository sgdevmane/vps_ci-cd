<script>
  import { X, RotateCcw, GitCommit, User, Calendar } from '@lucide/svelte';
  import { api } from '../lib/api.js';
  import { fireConfetti } from '../lib/confetti.js';
  import { toast, toastError } from '../lib/toast.svelte.js';
  import { navigate } from '../lib/router.svelte.js';

  let { service, onClose } = $props();

  let commits = $state([]);
  let loading = $state(true);
  let selectedSha = $state('');
  let busy = $state(false);

  async function loadCommits() {
    try {
      const res = await api.get(`/api/services/${service.id}/commits`);
      commits = res.commits || [];
      if (commits.length > 0) {
        selectedSha = commits[0].sha;
      }
    } catch (e) {
      toastError(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadCommits();
  });

  async function doRollback() {
    if (!selectedSha) return;
    busy = true;
    try {
      const res = await api.post(`/api/services/${service.id}/rollback`, {
        targetSha: selectedSha,
      });
      fireConfetti({ count: 40 });
      toast(`Rollback queued to ${selectedSha.slice(0, 7)}`, 'success');
      onClose();
      navigate(`/activity/${res.triggerId}`);
    } catch (err) {
      toastError(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rollback-title">
  <div class="modal modal-wide">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
      <div>
        <h3 id="rollback-title" class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <RotateCcw size={18} /> Rollback Service — {service.name}
        </h3>
        <div class="modal-sub">Select a previous commit to instantly revert and run deployment commands.</div>
      </div>
      <button class="btn btn-ghost btn-icon" onclick={onClose} aria-label="Close modal"><X size={16} /></button>
    </div>

    {#if loading}
      <div style="display:grid; place-items:center; padding:40px;"><div class="spinner"></div></div>
    {:else if commits.length === 0}
      <div class="muted" style="padding:20px 0; text-align:center;">
        No git commit history found in folder. Ensure the service folder is a cloned repository.
      </div>
    {:else}
      <div class="commit-list">
        {#each commits as c}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="commit-item"
            class:selected={selectedSha === c.sha}
            onclick={() => (selectedSha = c.sha)}
          >
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <span class="mono bold" style="font-size:12.5px; color:var(--accent-text);">
                <GitCommit size={13} style="vertical-align:-2px; margin-right:4px;" />
                {c.shortSha || c.sha.slice(0, 7)}
              </span>
              <span class="faint small" style="display:flex; align-items:center; gap:4px;">
                <Calendar size={11} /> {c.date?.slice(0, 10)}
              </span>
            </div>
            <div style="font-weight:600; font-size:13px; margin-bottom:4px;">{c.message}</div>
            <div class="faint small" style="display:flex; align-items:center; gap:4px;">
              <User size={11} /> {c.author}
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-actions">
        <button class="btn" onclick={onClose} disabled={busy}>Cancel</button>
        <button class="btn btn-danger" onclick={doRollback} disabled={busy || !selectedSha}>
          {#if busy}<span class="spinner"></span>{:else}<RotateCcw size={14} />{/if}
          Rollback to {selectedSha ? selectedSha.slice(0, 7) : 'Commit'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .commit-list {
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 14px 0;
    padding-right: 4px;
  }
  .commit-item {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    background: var(--bg-elevated);
    transition: border-color 0.13s, background 0.13s;
  }
  .commit-item:hover {
    border-color: var(--border-strong);
  }
  .commit-item.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
