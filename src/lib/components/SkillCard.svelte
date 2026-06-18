<script lang="ts">
  import { onMount } from 'svelte';
  import ProfileAvatar from './celaut/ProfileAvatar.svelte';

  export let name: string;
  export let prose: string;
  export let tags: string[];
  export let domain: string;
  export let coverageCount: number;
  export let benchmarkCount: number;
  export let resultCount: number;
  /** Flag when multiple concurrent submissions exist for this skill name. */
  export let isDuplicate: boolean = false;
  export let index: number = 0;
  export let reputation: number = 0;
  /** Profile id of the submitter — used to render an identicon avatar. */
  export let profileId: string | undefined = undefined;

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
      <div class="flex items-center gap-2 min-w-0">
        {#if profileId}
          <ProfileAvatar {profileId} size={18} title={`Submitted by ${profileId}`} />
        {/if}
        <h3 class="card-title">{name}</h3>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        {#if reputation > 0}
          <span class="reputation-badge" title="Reputation score">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {reputation.toFixed(1)}
          </span>
        {/if}
        {#if domain}
          <span class="domain-badge {domainClass}">{domain}</span>
        {/if}
      </div>
    </div>

    <p class="card-prose">
      {prose || "No description available."}
    </p>

    {#if isDuplicate}
      <div class="card-duplicate-flag" title="Multiple concurrent submissions exist for this skill name">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        concurrent submissions
      </div>
    {/if}

    <div class="card-tags">
      {#each tags.slice(0, 4) as tag}
        <span class="card-tag">{tag}</span>
      {/each}
    </div>

    <div class="card-stats">
      <div class="card-stat" class:card-stat-muted={coverageCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span class="card-stat-value">{coverageCount}</span>
        <span class="card-stat-label">{coverageCount === 1 ? 'service' : 'services'}</span>
      </div>
      <div class="card-stat" class:card-stat-muted={benchmarkCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span class="card-stat-value">{benchmarkCount}</span>
        <span class="card-stat-label">{benchmarkCount === 1 ? 'benchmark' : 'benchmarks'}</span>
      </div>
      <div class="card-stat" class:card-stat-muted={resultCount === 0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span class="card-stat-value">{resultCount}</span>
        <span class="card-stat-label">results</span>
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
    border-color: hsl(var(--foreground) / 0.2);
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
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  :global(.dark) .domain-finance {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .domain-infra {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  :global(.dark) .domain-infra {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .domain-analytics {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  :global(.dark) .domain-analytics {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .domain-nlp {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  :global(.dark) .domain-nlp {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .domain-security {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  :global(.dark) .domain-security {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .domain-default {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .reputation-badge {
    @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold;
    background: hsl(45 90% 50% / 0.15);
    color: hsl(45 80% 35%);
  }
  :global(.dark) .reputation-badge {
    background: hsl(45 90% 50% / 0.12);
    color: hsl(45 80% 70%);
  }

  .card-prose {
    @apply text-sm text-muted-foreground text-left mb-3 leading-relaxed;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-duplicate-flag {
    @apply mb-3 flex items-center gap-1 px-2 py-0.5 rounded-md w-fit text-[10px] font-medium;
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--muted-foreground));
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
