<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let currentSort: string = 'name';

  const dispatch = createEventDispatcher();

  const sortOptions = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'services', label: 'Most Services' },
    { value: 'benchmarks', label: 'Most Benchmarks' },
    { value: 'newest', label: 'Newest' }
  ];

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    currentSort = target.value;
    dispatch('sort', currentSort);
  }
</script>

<div class="sort-dropdown">
  <label class="sort-label" for="sort-select">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="4" y1="12" x2="16" y2="12"/>
      <line x1="4" y1="18" x2="12" y2="18"/>
    </svg>
    Sort
  </label>
  <select id="sort-select" class="sort-select" value={currentSort} on:change={handleChange}>
    {#each sortOptions as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style lang="postcss">
  .sort-dropdown {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }

  .sort-select {
    padding: 0.375rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.8125rem;
    cursor: pointer;
    outline: none;
  }

  .sort-select:focus {
    box-shadow: 0 0 0 2px hsl(var(--ring));
  }
</style>
