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

    padding: 0.4rem 0.8rem;

    font-size: 0.82rem;
    font-weight: 500;

    color: hsl(var(--muted-foreground));

    background: transparent;
    border: none;
    border-radius: 0.6rem;

    cursor: pointer;

    transition:
      background-color .15s ease,
      color .15s ease;
  }

  .back-button:hover {
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--foreground));
  }

  .back-button svg {
    flex-shrink: 0;
  }
</style>
