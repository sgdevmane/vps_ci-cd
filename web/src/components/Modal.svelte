<script>
  import { X } from '@lucide/svelte';

  let { title, sub = '', wide = false, onClose, children } = $props();

  function onKeydown(e) {
    if (e.key === 'Escape' && onClose) onClose();
  }

  $effect(() => {
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="overlay"
  onclick={(e) => {
    if (e.target === e.currentTarget && onClose) onClose();
  }}
  onkeydown={() => {}}
>
  <div class="modal" class:modal-wide={wide}>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
      <div>
        <h3 class="modal-title">{title}</h3>
        {#if sub}<p class="modal-sub" style="margin-bottom:0;">{sub}</p>{/if}
      </div>
      {#if onClose}
        <button class="btn btn-ghost btn-icon" onclick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      {/if}
    </div>
    <div style="margin-top:16px;">
      {@render children?.()}
    </div>
  </div>
</div>
