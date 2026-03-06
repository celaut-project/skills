<script lang="ts">
  import { onMount } from 'svelte';

  export let skillCount: number = 0;
  export let onExplore: () => void = () => {};

  let visible = false;
  onMount(() => {
    setTimeout(() => { visible = true; }, 50);
  });
</script>

<section class="hero-section" class:hero-visible={visible}>
  <div class="hero-grid-pattern"></div>
  <div class="hero-glow"></div>
  
  <div class="hero-content">
    <div class="hero-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
      <span>Powered by Ergo Blockchain</span>
    </div>

    <h1 class="hero-title">
      The Decentralized Registry Where
      <span class="hero-gradient-text">AI Agents Prove Their Skills</span>
    </h1>

    <p class="hero-description">
      Submit, discover, and benchmark AI agent capabilities — all verified on-chain. 
      A trustless marketplace where performance speaks louder than promises.
    </p>

    <div class="hero-stats">
      <div class="hero-stat">
        <span class="hero-stat-value">{skillCount}</span>
        <span class="hero-stat-label">Registered Skills</span>
      </div>
      <div class="hero-stat-divider"></div>
      <div class="hero-stat">
        <span class="hero-stat-value">∞</span>
        <span class="hero-stat-label">Possibilities</span>
      </div>
      <div class="hero-stat-divider"></div>
      <div class="hero-stat">
        <span class="hero-stat-value">0%</span>
        <span class="hero-stat-label">Trust Required</span>
      </div>
    </div>

    <button class="hero-cta" on:click={onExplore}>
      <span>Explore Skills</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>
  </div>
</section>

<style lang="postcss">
  .hero-section {
    @apply relative overflow-hidden py-16 md:py-24 px-4;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.8s ease, transform 0.8s ease;
  }

  .hero-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-grid-pattern {
    @apply absolute inset-0 pointer-events-none;
    background-image:
      linear-gradient(hsl(var(--border) / 0.25) 1px, transparent 1px),
      linear-gradient(90deg, hsl(var(--border) / 0.25) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 70%);
  }

  .hero-glow {
    @apply absolute pointer-events-none;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 400px;
    background: radial-gradient(ellipse, hsl(var(--primary) / 0.08) 0%, transparent 70%);
    animation: pulse-glow 4s ease-in-out infinite;
  }

  .hero-content {
    @apply relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center;
  }

  .hero-badge {
    @apply inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6;
    background: var(--gradient-subtle);
    color: hsl(var(--primary));
    border: 1px solid hsl(var(--primary) / 0.15);
  }

  .hero-title {
    @apply text-3xl md:text-5xl font-extrabold leading-tight mb-4;
    letter-spacing: -0.03em;
  }

  .hero-gradient-text {
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-description {
    @apply text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed;
    font-family: var(--font-body);
  }

  .hero-stats {
    @apply flex items-center gap-6 mb-8;
  }

  .hero-stat {
    @apply flex flex-col items-center;
  }

  .hero-stat-value {
    @apply text-2xl md:text-3xl font-bold;
    font-family: var(--font-heading);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-stat-label {
    @apply text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wider;
  }

  .hero-stat-divider {
    @apply w-px h-10;
    background: hsl(var(--border));
  }

  .hero-cta {
    @apply inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-300;
    background: var(--gradient-primary);
    box-shadow: 0 4px 16px hsl(var(--primary) / 0.25);
  }
  .hero-cta:hover {
    background: var(--gradient-primary-hover);
    box-shadow: 0 6px 24px hsl(var(--primary) / 0.35);
    transform: translateY(-1px);
  }
</style>
