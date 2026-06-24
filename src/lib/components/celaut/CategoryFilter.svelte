<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Skill } from '$lib/types';
  import { categoryColor } from '$lib/categoryIcons';

  export let activeCategory: string = 'all';
  export let skills: Skill[] = [];

  const dispatch = createEventDispatcher();
  const seedCategories = ['finance', 'infrastructure', 'analytics', 'security', 'ai/ml'];

  function titleize(value: string): string {
    return value
      .split('/')
      .map((part) => part.split('-').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' '))
      .join('/');
  }

  $: categories = (() => {
    const counts = new Map<string, number>();

    for (const seed of seedCategories) counts.set(seed, 0);
    for (const skill of skills) {
      const key = skill.domain?.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const ranked = [...counts.entries()]
      .filter(([value, count]) => value && (count > 0 || seedCategories.includes(value)))
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([value, count]) => ({ value, label: titleize(value), count, color: categoryColor(value) }));

    return [{ value: 'all', label: 'All', count: skills.length, color: '220 9% 46%' }, ...ranked];
  })();

  function select(value: string) {
    activeCategory = value;
    dispatch('filter', value);
  }
</script>

<div class="category-filter" role="tablist" aria-label="Filter skills by category">
  {#each categories as cat}
    <button
      class="chip"
      class:chip-active={activeCategory === cat.value}
      style={`--chip-accent: ${cat.color};`}
      role="tab"
      aria-selected={activeCategory === cat.value}
      on:click={() => select(cat.value)}
    >
      {#if cat.value !== 'all'}
        <span class="chip-dot" aria-hidden="true"></span>
      {/if}
      <span class="chip-label">{cat.label}</span>
      <span class="chip-count">{cat.count}</span>
    </button>
  {/each}
</div>

<style lang="postcss">
  .category-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--background));
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chip:hover:not(.chip-active) {
    background-color: hsl(var(--muted));
    color: hsl(var(--foreground));
    border-color: hsl(var(--chip-accent) / 0.4);
  }

  .chip-dot {
    width: 7px;
    height: 7px;
    border-radius: 9999px;
    background: hsl(var(--chip-accent));
    flex-shrink: 0;
  }

  .chip-count {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.05rem 0.35rem;
    border-radius: 9999px;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    line-height: 1.4;
  }

  .chip-active {
    background-color: hsl(var(--chip-accent) / 0.14);
    color: hsl(var(--foreground));
    border-color: hsl(var(--chip-accent) / 0.55);
    font-weight: 600;
  }
  .chip-active .chip-dot {
    box-shadow: 0 0 0 3px hsl(var(--chip-accent) / 0.18);
  }
  .chip-active .chip-count {
    background: hsl(var(--chip-accent) / 0.22);
    color: hsl(var(--foreground));
  }
</style>
