<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let activeCategory: string = 'all';

  const dispatch = createEventDispatcher();

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'finance', label: 'Finance' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'security', label: 'Security' },
    { value: 'ai/ml', label: 'AI/ML' }
  ];

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
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary));
  }
</style>
