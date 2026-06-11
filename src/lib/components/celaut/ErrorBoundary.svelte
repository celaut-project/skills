<script lang="ts">
  /**
   * Simple error boundary for Svelte 4.
   * Wraps a slot and catches rendering errors, showing a fallback message.
   *
   * Usage:
   *   <ErrorBoundary message="Forum failed to load">
   *     <svelte:component this={ForumComponent} ... />
   *   </ErrorBoundary>
   */
  export let message = 'Something went wrong.';

  let hasError = false;
  let errorMessage = '';

  function handleError(event: Event) {
    hasError = true;
    errorMessage = (event as ErrorEvent).message || message;
  }
</script>

<svelte:window on:error={handleError} />

{#if hasError}
  <div class="error-boundary">
    <p class="text-sm text-muted-foreground">{message}</p>
    {#if errorMessage && errorMessage !== message}
      <p class="text-xs text-muted-foreground mt-1 font-mono">{errorMessage}</p>
    {/if}
    <button
      class="mt-2 text-xs text-primary hover:underline"
      on:click={() => { hasError = false; errorMessage = ''; }}
    >
      Try again
    </button>
  </div>
{:else}
  <slot />
{/if}

<style lang="postcss">
  .error-boundary {
    @apply p-4 rounded-lg border border-border bg-card text-center;
  }
</style>
