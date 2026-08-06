<script>
  import { CircleCheck, CircleAlert, Info, X } from '@lucide/svelte';
  import { toasts, dismiss } from '../lib/toast.svelte.js';
</script>

<div class="toast-host">
  {#each toasts as t (t.id)}
    <div class="toast" class:toast-success={t.kind === 'success'} class:toast-error={t.kind === 'error'}>
      {#if t.kind === 'success'}
        <CircleCheck size={17} style="color: var(--success); flex:none;" />
      {:else if t.kind === 'error'}
        <CircleAlert size={17} style="color: var(--danger); flex:none;" />
      {:else}
        <Info size={17} style="color: var(--info); flex:none;" />
      {/if}
      <span>{t.message}</span>
      <button class="toast-close" onclick={() => dismiss(t.id)} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  {/each}
</div>
