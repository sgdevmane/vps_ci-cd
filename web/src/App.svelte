<script>
  import { auth, loadMe } from './lib/auth.svelte.js';
  import { route } from './lib/router.svelte.js';
  import LoginPage from './pages/LoginPage.svelte';
  import DashboardPage from './pages/DashboardPage.svelte';
  import ServicesPage from './pages/ServicesPage.svelte';
  import ServiceEditPage from './pages/ServiceEditPage.svelte';
  import ActivityPage from './pages/ActivityPage.svelte';
  import TriggerDetailPage from './pages/TriggerDetailPage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Header from './components/Header.svelte';
  import Toasts from './components/Toasts.svelte';
  import ChangePasswordModal from './components/ChangePasswordModal.svelte';

  $effect(() => {
    loadMe();
  });

  const page = $derived.by(() => {
    const s = route.segments;
    if (s[0] === 'services' && s[1] === 'new') return { name: 'service-edit', id: null };
    if (s[0] === 'services' && s.length === 2) return { name: 'service-edit', id: s[1] };
    if (s[0] === 'services') return { name: 'services' };
    if (s[0] === 'activity' && s[1]) return { name: 'trigger', id: s[1] };
    if (s[0] === 'activity') return { name: 'activity' };
    if (s[0] === 'settings') return { name: 'settings' };
    return { name: 'dashboard' };
  });
</script>

{#if auth.loading}
  <div class="splash"><div class="spinner spinner-lg"></div></div>
{:else if !auth.user}
  <LoginPage />
{:else}
  <div class="shell">
    <Sidebar {page} />
    <div class="main">
      <Header {page} />
      <div class="content">
        {#key `${page.name}:${page.id ?? ''}`}
          {#if page.name === 'dashboard'}
            <DashboardPage />
          {:else if page.name === 'services'}
            <ServicesPage />
          {:else if page.name === 'service-edit'}
            <ServiceEditPage id={page.id} />
          {:else if page.name === 'activity'}
            <ActivityPage />
          {:else if page.name === 'trigger'}
            <TriggerDetailPage id={page.id} />
          {:else if page.name === 'settings'}
            <SettingsPage />
          {/if}
        {/key}
      </div>
    </div>
  </div>
  {#if auth.user.mustChangePassword}
    <ChangePasswordModal forced />
  {/if}
{/if}

<Toasts />
