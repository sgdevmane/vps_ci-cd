<script>
  import Modal from './Modal.svelte';

  let {
    title,
    message,
    confirmLabel = 'Confirm',
    danger = true,
    busy = false,
    onConfirm,
    onClose,
  } = $props();
</script>

<Modal {title} {onClose}>
  <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.55;">{message}</p>
  <div class="modal-actions">
    <button class="btn" onclick={onClose} disabled={busy}>Cancel</button>
    <button class="btn" class:btn-danger={danger} class:btn-primary={!danger} onclick={onConfirm} disabled={busy}>
      {#if busy}<span class="spinner"></span>{/if}
      {confirmLabel}
    </button>
  </div>
</Modal>
