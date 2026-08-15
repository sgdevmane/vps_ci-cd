<script>
  import { LayoutDashboard, GitFork, Activity, Settings } from '@lucide/svelte';
  import BrandMark from './BrandMark.svelte';

  let { page } = $props();

  const items = [
    { name: 'dashboard', label: 'Dashboard', href: '#/', icon: LayoutDashboard },
    { name: 'services', label: 'Services', href: '#/services', icon: GitFork, also: ['service-edit'] },
    { name: 'activity', label: 'Activity', href: '#/activity', icon: Activity, also: ['trigger'] },
    { name: 'settings', label: 'Settings', href: '#/settings', icon: Settings },
  ];

  function isActive(item) {
    return page.name === item.name || (item.also || []).includes(page.name);
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <BrandMark size={34} />
    <div>
      <div class="brand-name">VPS CI/CD</div>
      <div class="brand-sub">webhook deploy</div>
    </div>
  </div>

  <nav class="nav">
    {#each items as item (item.name)}
      <a href={item.href} class:active={isActive(item)}>
        <item.icon size={17} stroke-width={2.1} />
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="sidebar-foot">
    <span class="small faint" style="padding: 0 12px;">Webhook listener active</span>
    <span class="small faint" style="padding: 0 12px; display:flex; align-items:center; gap:6px;">
      <span class="badge badge-success" style="padding:1px 7px;"><span class="dot"></span>online</span>
    </span>
  </div>
</aside>
