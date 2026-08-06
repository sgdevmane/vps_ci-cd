<script>
  let { icon: Icon, title, sub = '', children } = $props();
</script>

<div class="empty">
  <div class="empty-icon">
    <Icon size={24} stroke-width={1.8} />
  </div>
  <div class="empty-title">{title}</div>
  {#if sub}<div class="empty-sub">{sub}</div>{/if}
  {#if children}
    <div style="margin-top:10px;">{@render children()}</div>
  {/if}
</div>
