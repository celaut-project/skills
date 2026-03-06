<script lang="ts">
  import { WalletButton } from 'wallet-svelte-component';
  import { web_explorer_uri_addr } from '$lib/common/store';
  import { searchQuery } from '$lib/stores';
  import Theme from '../../../routes/Theme.svelte';
</script>

<header class="navbar-container">
  <div class="navbar-content">
    <a href="#" class="logo-container">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="mr-2 text-primary" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
      <span class="font-semibold">Celaut Skills</span>
    </a>

    <div class="flex-1 flex items-center justify-center px-8 max-w-lg mx-auto">
      <div class="relative w-full">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          bind:value={$searchQuery}
          placeholder="Search skills, tags, domains…"
          class="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <WalletButton explorerUrl={$web_explorer_uri_addr} />
      <Theme />
    </div>
  </div>
</header>

<style lang="postcss">
  .navbar-container {
    @apply sticky top-0 z-50 w-full border-b backdrop-blur-lg;
    background-color: hsl(var(--background) / 0.85);
    border-bottom-color: hsl(var(--border));
  }

  .navbar-content {
    @apply container flex h-16 items-center px-4;
  }

  .logo-container {
    @apply flex items-center font-semibold text-foreground no-underline whitespace-nowrap;
  }
</style>
