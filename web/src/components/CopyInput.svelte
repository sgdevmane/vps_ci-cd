<script>
  import { Copy, Check } from '@lucide/svelte';
  import { toast } from '../lib/toast.svelte.js';

  let { value, placeholder = '' } = $props();
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copied = true;
    toast('Copied to clipboard', 'success');
    setTimeout(() => (copied = false), 1600);
  }
</script>

<div class="copy-row">
  <input class="input" readonly {value} {placeholder} onfocus={(e) => e.target.select()} />
  <button class="btn btn-sm" onclick={copy} title="Copy to clipboard">
    {#if copied}
      <Check size={14} style="color: var(--success);" />
    {:else}
      <Copy size={14} />
    {/if}
    {copied ? 'Copied' : 'Copy'}
  </button>
</div>
