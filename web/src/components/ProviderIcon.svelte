<script>
  import { Webhook, Coffee, Terminal } from '@lucide/svelte';
  import { PROVIDER_LABELS } from '../lib/format.js';

  let { provider, withLabel = true } = $props();
</script>

<span class="provider-chip" title={PROVIDER_LABELS[provider] || provider}>
  {#if provider === 'github'}
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  {:else if provider === 'gitlab'}
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.919 1.263a.455.455 0 0 0-.867 0L1.388 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.92.92 0 0 0 .331-1.024" />
    </svg>
  {:else if provider === 'bitbucket'}
    <svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">
      <path d="M22.018 0H1.982C.787 0-.127 1.003.018 2.19l2.932 17.048c.163.951.987 1.644 1.951 1.644h5.621l-.423 2.522c-.113.677.408 1.296 1.093 1.296h2.462c.534 0 .996-.383 1.094-.908l.849-4.91h4.667c.964 0 1.788-.693 1.951-1.644L24.982 2.19C25.127 1.003 24.213 0 23.018 0Zm-6.563 14.325h-6.91l-.849-4.463h8.608l-.849 4.463Z" />
    </svg>
  {:else if provider === 'gitea'}
    <Coffee size={16} />
  {:else if provider === 'gogs'}
    <Terminal size={16} />
  {:else}
    <Webhook size={16} />
  {/if}
  {#if withLabel}{PROVIDER_LABELS[provider] || provider}{/if}
</span>
