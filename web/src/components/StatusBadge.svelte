<script>
  import { STATUS_META } from '../lib/format.js';

  let { status } = $props();
  const meta = $derived(STATUS_META[status] || { label: status, badge: 'badge-muted' });
</script>

<span class="badge {meta.badge}">
  <span class="dot"></span>
  {meta.label}
</span>
