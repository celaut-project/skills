<script lang="ts">
  import { onMount } from 'svelte';

  export let name: string;
  export let prose: string;
  export let tags: string[];
  export let domain: string;
  export let coverageCount: number;
  export let benchmarkCount: number;
  export let relatedCount: number;
  export let index: number = 0;

  let visible = false;
  onMount(() => {
    setTimeout(() => { visible = true; }, 80 + index * 30);
  });

  const domainColors: Record<string, string> = {
    finance: 'domain-finance',
    infrastructure: 'domain-infra',
    analytics: 'domain-analytics',
    nlp: 'domain-nlp',
    security: 'domain-security',
  };

  $: domainClass = domainColors[domain.toLowerCase()] || 'domain-default';
</script>

<button
  class="skill-card"
  class:skill-card-visible={visible}
  on:click
>
  <div class="card-inner">
    <div class="flex items-start justify-between gap-2 mb-3">
      <h3 class="card-title">{name}</h3>
      {#if domain}
        <span class="domain-badge {domainClass}">{domain}</span>
      {/if}
    </div>

    <p class="card-prose">
      {prose || "No description available."}
    </p>

    <div class="card-tags">
      {#each tags.slice(0, 4) as tag}
        <span class="card-tag">{tag}</span>
      {/each}
    </div>

    <div class="card-stats">
      <div class="card-stat" class:card-stat-muted={coverageCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span class="card-stat-value">{coverageCount}</span>
        <span class="card-stat-label">services</span>
      </div>
      <div class="card-stat" class:card-stat-muted={benchmarkCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span class="card-stat-value">{benchmarkCount}</span>
        <span class="card-stat-label">benchmarks</span>
      </div>
      <div class="card-stat" class:card-stat-muted={relatedCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span class="card-stat-value">{relatedCount}</span>
        <span class="card-stat-label">related</span>
      </div>
    </div>
  </div>
</button>

<style lang="postcss">
  .skill-card {
    @apply relative flex flex-col rounded-xl border text-left cursor-pointer overflow-hidden;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    opacity: 0;
    transform: translateY(16px);
  }

  .skill-card-visible {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.4s ease, transform 0.4s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .skill-card:hover {
    border-color: hsl(var(--primary) / 0.3);
    box-shadow: 0 2px 8px hsl(var(--foreground) / 0.06);
  }

  .card-inner {
    @apply relative z-10 p-5 flex flex-col h-full;
  }

  .card-title {
    @apply text-base font-bold leading-snug;
    font-family: var(--font-heading);
    letter-spacing: -0.01em;
  }

  .domain-badge {
    @apply inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0;
  }

  .domain-finance {
    background: hsl(142 60% 50% / 0.12);
    color: hsl(142 60% 40%);
  }
  :global(.dark) .domain-finance {
    background: hsl(142 60% 50% / 0.15);
    color: hsl(142 60% 65%);
  }

  .domain-infra {
    background: hsl(210 60% 50% / 0.12);
    color: hsl(210 60% 40%);
  }
  :global(.dark) .domain-infra {
    background: hsl(210 60% 50% / 0.15);
    color: hsl(210 60% 65%);
  }

  .domain-analytics {
    background: hsl(280 60% 55% / 0.12);
    color: hsl(280 60% 40%);
  }
  :global(.dark) .domain-analytics {
    background: hsl(280 60% 55% / 0.15);
    color: hsl(280 60% 65%);
  }

  .domain-nlp {
    background: hsl(30 80% 50% / 0.12);
    color: hsl(30 80% 35%);
  }
  :global(.dark) .domain-nlp {
    background: hsl(30 80% 50% / 0.15);
    color: hsl(30 80% 65%);
  }

  .domain-security {
    background: hsl(0 70% 50% / 0.12);
    color: hsl(0 70% 40%);
  }
  :global(.dark) .domain-security {
    background: hsl(0 70% 50% / 0.15);
    color: hsl(0 70% 65%);
  }

  .domain-default {
    background: hsl(var(--primary) / 0.1);
    color: hsl(var(--primary));
  }

  .card-prose {
    @apply text-sm text-muted-foreground text-left mb-4 leading-relaxed;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    @apply flex flex-wrap gap-1.5 mb-4;
  }

  .card-tag {
    @apply px-2 py-0.5 rounded-md text-[11px] font-medium;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .card-stats {
    @apply flex gap-4 pt-3 mt-auto;
    border-top: 1px solid hsl(var(--border) / 0.6);
  }

  .card-stat {
    @apply flex items-center gap-1.5 text-xs text-muted-foreground;
  }

  .card-stat svg {
    @apply opacity-50;
  }

  .card-stat-value {
    @apply font-semibold text-foreground;
  }

  .card-stat-label {
    @apply text-muted-foreground;
  }

  .card-stat-muted {
    @apply opacity-40;
  }
  .card-stat-muted .card-stat-value {
    @apply text-muted-foreground;
  }
</style>
