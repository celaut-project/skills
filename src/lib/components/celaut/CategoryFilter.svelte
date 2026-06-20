<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Skill } from '$lib/types';

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
      .map(([value]) => ({ value, label: titleize(value) }));

    return [{ value: 'all', label: 'All' }, ...ranked];
  })();

  function select(value: string) {
    activeCategory = value;
    dispatch('filter', value);
  }
</script>

<div class="category-filter">
  {#each categories as cat}
    <button
      class="chip"
      class:chip-active={activeCategory === cat.value}
      on:click={() => select(cat.value)}
    >
      {cat.label}
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
    padding: 0.375rem 0.875rem;
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
  }

  .chip-active {
    background-color: hsl(var(--foreground) / 0.12);
    color: hsl(var(--foreground));
    border-color: hsl(var(--foreground) / 0.4);
    font-weight: 600;
  }
</style>
