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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
  <span>{label}</span>
</button>

<style lang="postcss">
  .run-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
    background: linear-gradient(180deg, hsl(214 100% 60%), hsl(214 92% 50%));
    color: white;
    box-shadow: 0 10px 24px hsl(214 100% 45% / 0.22);
  }

  .run-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.96;
  }

  .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .run-btn-large {
    padding: 0.9rem 1.4rem;
    border-radius: 1.1rem;
    font-size: 0.98rem;
    font-weight: 700;
  }

  .run-btn-small {
    padding: 0.5rem 0.8rem;
    border-radius: 0.9rem;
    font-size: 0.78rem;
    font-weight: 600;
  }
</style>
