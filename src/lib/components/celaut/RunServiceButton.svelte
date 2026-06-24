<script lang="ts">
  import { toasts } from './toastStore';

  export let serviceId: string = '';
  export let large: boolean = false;
  export let label: string = 'Run';
  export let title: string | undefined = undefined;

  $: command = serviceId ? `nodo execute ${serviceId}` : '';

  async function handleRun() {
    if (!command) {
      toasts.error('Missing service id.');
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      toasts.success('Run command copied to clipboard.', {
        detail: "Don't have the node yet? Download and install it here.",
        detailHref: 'https://github.com/celaut-project/nodo/blob/stable/README.md#installation',
        duration: 10000
      });
    } catch {
      toasts.error('Failed to copy command.');
    }
  }
</script>

<button
  class:run-btn={true}
  class:run-btn-large={large}
  class:run-btn-small={!large}
  on:click={handleRun}
  title={title || command}
  disabled={!serviceId}
>
  <span class="run-btn-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 4 20 12 6 20 6 4"/>
    </svg>
  </span>
  <span class="run-btn-label">{label}</span>
</button>

<style lang="postcss">
  /* Flat "Run" button — calm and unobtrusive. A single solid fill, no
     gradients, no elevation/shadows, no inset highlight or icon chip.
     Just a quiet hover and an accessible focus ring. */
  .run-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    color: hsl(var(--primary-foreground));
    background: hsl(var(--primary));
    box-shadow: none;
    transition: background-color 0.12s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .run-btn:hover:not(:disabled) {
    background: hsl(var(--primary) / 0.88);
  }

  .run-btn:active:not(:disabled) {
    background: hsl(var(--primary) / 0.8);
  }

  .run-btn:focus-visible {
    outline: 2px solid hsl(var(--ring, var(--primary)));
    outline-offset: 2px;
  }

  .run-btn:disabled {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    cursor: not-allowed;
  }

  .run-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .run-btn-icon svg {
    display: block;
  }

  .run-btn-label {
    font-weight: 600;
    line-height: 1;
  }

  .run-btn-large {
    gap: 0.5rem;
    padding: 0.75rem 1.4rem;
    border-radius: 0.5rem;
    font-size: 0.95rem;
  }
  .run-btn-large .run-btn-icon svg {
    width: 0.95rem;
    height: 0.95rem;
  }

  .run-btn-small {
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    border-radius: 0.4rem;
    font-size: 0.8rem;
  }
  .run-btn-small .run-btn-icon svg {
    width: 0.7rem;
    height: 0.7rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .run-btn {
      transition: none;
    }
  }
</style>
