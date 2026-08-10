<script lang="ts">
  import { onMount } from 'svelte';
  import { categoryIcon, categoryColor, categoryVisual } from '$lib/categoryIcons';

  export let name: string;
  export let prose: string;
  export let tags: string[];
  export let domain: string;
  export let index: number = 0;
  /**
   * Progressive disclosure: secondary metadata (service/benchmark/result
   * counters, reputation / ERG stake, submitter, duplicate flag) is no longer
   * shown on the search card — it now lives on the skill detail view. The ERG
   * reputation stake in particular was removed here because users misread it as
   * a price. Retained purely for parent call-site compatibility.
   */
  export let profileId: string | undefined = undefined;

  let visible = false;
  onMount(() => {
    setTimeout(() => { visible = true; }, 80 + index * 30);
  });

  // The submitter avatar has been replaced by the category icon, which doubles
  // as the gallery's color-coded category indicator (so no separate badge).
  $: categoryComponent = categoryIcon(domain);
  $: categoryAccent = categoryColor(domain);
  $: categoryLabel = categoryVisual(domain).label;
</script>

<button
  class="skill-card"
  class:skill-card-visible={visible}
  on:click
>
  <div class="card-inner">
    <div class="flex items-center gap-2 min-w-0 mb-2">
      <span
        class="category-icon"
        style={`color: hsl(${categoryAccent}); background: hsl(${categoryAccent} / 0.12);`}
        title={`Category: ${categoryLabel}`}
      >
        <svelte:component this={categoryComponent} size={16} strokeWidth={2.25} />
      </span>
      <h3 class="card-title">{name}</h3>
    </div>

    <p class="card-prose">
      {prose || "No description available."}
    </p>

    {#if tags.length}
      <p class="card-tags">{tags.slice(0, 3).join(' · ')}</p>
    {/if}
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

  .category-icon {
    @apply inline-flex items-center justify-center rounded-lg flex-shrink-0;
    width: 28px;
    height: 28px;
  }

  .card-prose {
    @apply text-sm text-muted-foreground text-left mb-3 leading-relaxed;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Tags rendered as a quiet, dotted single line: "vision · classification". */
  .card-tags {
    @apply text-xs text-muted-foreground mt-auto;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
