<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Skill } from '$lib/types';
  import { categoryVisual } from '$lib/categoryIcons';
  import { formatReputation } from '$lib/reputation';
  import { Wrench, ChartBar, Activity, Check } from 'lucide-svelte';

  export let skill: Skill;
  export let onClick: () => void;
  /** When true, render a comparison checkbox and surface compare interactions. */
  export let selectable: boolean = false;
  /** Whether this card is currently picked for comparison. */
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{ compare: { skill: Skill; selected: boolean } }>();

  $: visual = categoryVisual(skill.domain);
  $: Icon = visual.icon;
  $: accent = visual.hsl;

  // Reputation is stored as burned nanoERG; the badge is the skill's headline metric.
  $: reputation = skill.reputation ?? 0;
  $: hasReputation = reputation > 0;

  $: coverageCount = skill.coverages?.length ?? 0;
  $: benchmarkCount = skill.benchmarks?.length ?? 0;
  $: resultCount = skill.resultCount ?? 0;

  // Operational metrics define a small reliability profile. With no on-chain
  // time-series available, the sparkline shows the skill's activity shape across
  // (services → benchmarks → results) so a flat number becomes a glanceable trend.
  $: sparkPoints = buildSparkline([coverageCount, benchmarkCount, resultCount]);
  $: reliabilityActive = coverageCount > 0 && benchmarkCount > 0 && resultCount > 0;

  function buildSparkline(values: number[]): string {
    const max = Math.max(1, ...values);
    const w = 48;
    const h = 16;
    const step = values.length > 1 ? w / (values.length - 1) : w;
    return values
      .map((v, i) => {
        const x = +(i * step).toFixed(2);
        const y = +(h - (v / max) * (h - 2) - 1).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');
  }

  function handleCompare(event: Event) {
    event.stopPropagation();
    dispatch('compare', { skill, selected: !selected });
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }
</script>

<article
  class="skill-card"
  class:skill-card-selected={selected}
  style={`--cat-accent: ${accent};`}
>
  <!-- Whole-card click target; the compare control overrides it locally. -->
  <div
    class="card-hit"
    role="button"
    tabindex="0"
    aria-label={`Open ${skill.name}`}
    on:click={onClick}
    on:keydown={handleKey}
  >
    <!-- Header: compare · category icon · name · ERG badge -->
    <div class="card-head">
      {#if selectable}
        <button
          type="button"
          class="compare-box"
          class:compare-box-on={selected}
          role="checkbox"
          aria-checked={selected}
          aria-label={selected ? `Remove ${skill.name} from comparison` : `Add ${skill.name} to comparison`}
          title="Compare"
          on:click={handleCompare}
        >
          {#if selected}<Check size={12} strokeWidth={3} />{/if}
        </button>
      {/if}

      <span class="cat-icon" aria-hidden="true">
        <svelte:component this={Icon} size={18} strokeWidth={2} />
      </span>

      <h3 class="card-title">{skill.name}</h3>

      {#if hasReputation}
        <span class="erg-badge" title="On-chain reputation — total ERG burned against this skill">
          {formatReputation(reputation)}
        </span>
      {/if}
    </div>

    <!-- Description: looser leading + AA contrast; full text on hover/focus -->
    <p class="card-prose" title={skill.prose || 'No description available.'}>
      {skill.prose || 'No description available.'}
    </p>

    <!-- Domain tags — visually separated from operational metrics below -->
    {#if skill.tags?.length}
      <div class="card-tags">
        {#each skill.tags.slice(0, 4) as tag}
          <span class="tag">{tag}</span>
        {/each}
        {#if skill.tags.length > 4}
          <span class="tag tag-more">+{skill.tags.length - 4}</span>
        {/if}
      </div>
    {/if}

    <!-- Operational metrics with explicit text labels for each icon -->
    <div class="card-metrics">
      <span class="metric" class:metric-muted={coverageCount === 0} title={`${coverageCount} service${coverageCount === 1 ? '' : 's'}`}>
        <Wrench size={13} strokeWidth={2} />
        <span class="metric-value">{coverageCount}</span>
        <span class="metric-label">{coverageCount === 1 ? 'Service' : 'Services'}</span>
      </span>
      <span class="metric" class:metric-muted={benchmarkCount === 0} title={`${benchmarkCount} benchmark${benchmarkCount === 1 ? '' : 's'}`}>
        <ChartBar size={13} strokeWidth={2} />
        <span class="metric-value">{benchmarkCount}</span>
        <span class="metric-label">{benchmarkCount === 1 ? 'Benchmark' : 'Benchmarks'}</span>
      </span>
      <span class="metric metric-results" class:metric-muted={resultCount === 0} title={`${resultCount} result${resultCount === 1 ? '' : 's'} — reliability trend`}>
        <Activity size={13} strokeWidth={2} />
        <span class="metric-value">{resultCount}</span>
        <span class="metric-label">{resultCount === 1 ? 'Result' : 'Results'}</span>
        <svg class="spark" class:spark-on={reliabilityActive} width="48" height="16" viewBox="0 0 48 16" aria-hidden="true">
          <polyline points={sparkPoints} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </span>
    </div>
  </div>
</article>

<style lang="postcss">
  .skill-card {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--card));
    overflow: hidden;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  }
  /* Category color accent strip down the leading edge. */
  .skill-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: hsl(var(--cat-accent));
    opacity: 0.7;
  }
  .skill-card:hover {
    border-color: hsl(var(--cat-accent) / 0.5);
    box-shadow: 0 6px 20px -8px hsl(var(--cat-accent) / 0.35);
    transform: translateY(-2px);
  }
  .skill-card-selected {
    border-color: hsl(var(--cat-accent) / 0.8);
    box-shadow: 0 0 0 1px hsl(var(--cat-accent) / 0.6);
  }

  .card-hit {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 1rem 1rem 0.875rem 1.125rem;
    cursor: pointer;
    outline: none;
  }
  .card-hit:focus-visible {
    box-shadow: inset 0 0 0 2px hsl(var(--cat-accent) / 0.6);
    border-radius: 0.5rem;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }

  .compare-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: 0.3rem;
    border: 1.5px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--primary-foreground));
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .compare-box:hover {
    border-color: hsl(var(--cat-accent) / 0.7);
  }
  .compare-box-on {
    background: hsl(var(--cat-accent));
    border-color: hsl(var(--cat-accent));
    color: #fff;
  }
  .compare-box:focus-visible {
    outline: 2px solid hsl(var(--cat-accent) / 0.6);
    outline-offset: 1px;
  }

  .cat-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 0.5rem;
    background: hsl(var(--cat-accent) / 0.12);
    color: hsl(var(--cat-accent));
  }

  .card-title {
    flex: 1;
    min-width: 0;
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.01em;
    color: hsl(var(--foreground));
    /* Allow two lines for long names rather than hard truncation. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .erg-badge {
    flex-shrink: 0;
    align-self: flex-start;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    background: hsl(var(--cat-accent) / 0.14);
    color: hsl(var(--cat-accent));
    border: 1px solid hsl(var(--cat-accent) / 0.25);
  }

  .card-prose {
    margin-bottom: 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.55;
    /* Brighter than the default muted tone to meet WCAG AA on cards. */
    color: hsl(var(--muted-foreground));
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  :global(.dark) .card-prose {
    color: hsl(var(--foreground) / 0.72);
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.875rem;
  }
  .tag {
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 500;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  .tag-more {
    background: transparent;
    border: 1px dashed hsl(var(--border));
  }

  .card-metrics {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid hsl(var(--border) / 0.7);
  }
  .metric {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }
  .metric :global(svg) {
    opacity: 0.65;
  }
  .metric-value {
    font-weight: 700;
    color: hsl(var(--foreground));
  }
  .metric-label {
    color: hsl(var(--muted-foreground));
  }
  .metric-muted {
    opacity: 0.42;
  }
  .metric-results {
    margin-left: auto;
  }
  .spark {
    color: hsl(var(--muted-foreground) / 0.5);
  }
  .spark-on {
    color: hsl(var(--cat-accent));
  }
</style>
