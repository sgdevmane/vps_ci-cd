<script>
  import { Sun, Moon, LogOut, Settings, ChevronDown, CircleUserRound, Cpu, HardDrive } from '@lucide/svelte';
  import { theme, toggleTheme } from '../lib/theme.svelte.js';
  import { auth, clearUser } from '../lib/auth.svelte.js';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';

  let { page } = $props();
  let menuOpen = $state(false);
  let systemHealth = $state(null);

  const titles = $derived.by(() => {
    switch (page.name) {
      case 'services':
        return ['Sync Services', 'Folders on this server kept in step with your repositories'];
      case 'service-edit':
        return [page.id ? 'Edit Service' : 'New Service', 'Connect a folder to a repository and define post-sync commands'];
      case 'activity':
        return ['Activity', 'Every webhook received and every run, with full logs'];
      case 'trigger':
        return ['Trigger Detail', 'Full log for a single trigger'];
      case 'settings':
        return ['Settings', 'Account, security and server configuration'];
      default:
        return ['Dashboard', 'Overview of your sync services and recent activity'];
    }
  });

  async function loadHealth() {
    try {
      const res = await api.get('/api/system/health');
      systemHealth = res;
    } catch {
      /* ignore */
    }
  }

  $effect(() => {
    loadHealth();
    const timer = setInterval(loadHealth, 15000);
    return () => clearInterval(timer);
  });

  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignore */
    }
    clearUser();
    navigate('/');
  }
</script>

<header class="header">
  <div>
    <h1 class="header-title">{titles[0]}</h1>
    <div class="header-sub">{titles[1]}</div>
  </div>
  <div class="header-actions">
    {#if systemHealth}
      <div class="badge badge-muted" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:4px 10px;" title="Server Resource Utilization">
        <span style="display:flex; align-items:center; gap:4px;">
          <Cpu size={12} /> RAM: {systemHealth.memory.usedPercent}%
        </span>
        {#if systemHealth.disk}
          <span style="border-left:1px solid var(--border); padding-left:8px; display:flex; align-items:center; gap:4px;">
            <HardDrive size={12} /> Disk: {systemHealth.disk.usedPercent}%
          </span>
        {/if}
      </div>
    {/if}

    <button class="btn btn-ghost btn-icon" onclick={toggleTheme} title="Toggle theme">
      {#if theme.current === 'dark'}
        <Sun size={17} />
      {:else}
        <Moon size={17} />
      {/if}
    </button>

    <div class="user-menu">
      <button class="btn btn-ghost" onclick={() => (menuOpen = !menuOpen)}>
        <CircleUserRound size={17} />
        {auth.user?.username}
        <ChevronDown size={14} />
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="overlay-close" style="position:fixed; inset:0; z-index:40;" onclick={() => (menuOpen = false)} onkeydown={() => {}}></div>
        <div class="user-menu-pop">
          <div class="user-menu-head">
            <div style="font-weight:700; font-size:13.5px;">{auth.user?.username}</div>
            <div class="small faint">Administrator</div>
          </div>
          <button class="item" onclick={() => { menuOpen = false; navigate('/settings'); }}>
            <Settings size={15} /> Settings
          </button>
          <button class="item danger" onclick={logout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>
