<script lang="ts">
  import { onMount } from 'svelte';

  let visible = false;
  onMount(() => {
    setTimeout(() => { visible = true; }, 50);
  });
</script>

<section class="hero-section" class:hero-visible={visible}>
  <div class="hero-content">
    <h1 class="hero-title">Skills Gallery</h1>

    <p class="hero-description">
      A decentralized registry for AI agent capabilities
    </p>
  </div>
</section>

<style lang="postcss">
  .hero-section {
    @apply relative overflow-hidden py-5 md:py-7 px-4;
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
    @apply inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    border: 1px solid hsl(var(--border));
  }

  .hero-title {
    @apply text-2xl md:text-3xl font-extrabold leading-tight mb-2;
    letter-spacing: -0.03em;
  }

  .hero-description {
    @apply text-sm md:text-base text-muted-foreground max-w-md mx-auto mb-3 leading-relaxed;
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
    color: hsl(var(--foreground));
  }

  .hero-stat-label {
    @apply text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wider;
  }
</style>
