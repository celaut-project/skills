<script lang="ts">
  import { onMount } from 'svelte';

  export let skillCount: number = 0;

  let visible = false;
  onMount(() => {
    setTimeout(() => { visible = true; }, 50);
  });
</script>

<section class="hero-section" class:hero-visible={visible}>
  <div class="hero-content">
    <div class="hero-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
      <span>Powered by Ergo Blockchain</span>
    </div>

    <h1 class="hero-title">Celaut Skills</h1>

    <p class="hero-description">
      A decentralized registry for AI agent capabilities
    </p>

    {#if skillCount > 0}
      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat-value">{skillCount}</span>
          <span class="hero-stat-label">Registered Skills</span>
        </div>
      </div>
    {/if}
  </div>
</section>

<style lang="postcss">
  .hero-section {
    @apply relative overflow-hidden py-8 md:py-12 px-4;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  .hero-visible {
    opacity: 1;
  }

  .hero-content {
    @apply relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center;
  }

  .hero-badge {
    @apply inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4;
    background: hsl(var(--primary) / 0.08);
    color: hsl(var(--primary));
    border: 1px solid hsl(var(--primary) / 0.15);
  }

  .hero-title {
    @apply text-2xl md:text-3xl font-extrabold leading-tight mb-2;
    letter-spacing: -0.03em;
  }

  .hero-description {
    @apply text-sm md:text-base text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed;
    font-family: var(--font-body);
  }

  .hero-stats {
    @apply flex items-center;
  }

  .hero-stat {
    @apply flex flex-col items-center;
  }

  .hero-stat-value {
    @apply text-xl md:text-2xl font-bold;
    font-family: var(--font-heading);
    color: hsl(var(--primary));
  }

  .hero-stat-label {
    @apply text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wider;
  }
</style>
