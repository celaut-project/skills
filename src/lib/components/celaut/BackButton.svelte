<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Label shown next to the arrow icon. */
  export let label = 'Back';

  const dispatch = createEventDispatcher<{ click: void }>();

  function handleClick() {
    dispatch('click');
  }
</script>

<button class="back-button" on:click={handleClick}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
  {label}
</button>

<style>
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 1.5rem;
    padding: 0.375rem 0.75rem;
    margin-left: -0.75rem;
    border-radius: 0.5rem;
    transition: color 0.2s ease, background 0.2s ease;
  }
  .back-button:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
  }
</style>
