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
  /* Premium "Run" CTA — refined blue gradient, soft elevation, and subtle
     hover/active microinteractions. Minimalist Linear/Stripe/Vercel feel. */
  .run-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    color: #fff;
    /* Layered gradient gives the surface a faint top-edge highlight. */
    background:
      linear-gradient(180deg, hsl(214 100% 64%) 0%, hsl(216 92% 52%) 100%);
    box-shadow:
      0 1px 0 hsl(214 100% 78% / 0.45) inset,
      0 1px 2px hsl(216 60% 18% / 0.28),
      0 8px 20px hsl(214 95% 45% / 0.26);
    transition:
      transform 0.15s cubic-bezier(0.2, 0, 0.2, 1),
      box-shadow 0.15s ease,
      filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .run-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: saturate(1.05) brightness(1.03);
    box-shadow:
      0 1px 0 hsl(214 100% 80% / 0.5) inset,
      0 2px 4px hsl(216 60% 18% / 0.3),
      0 12px 26px hsl(214 95% 45% / 0.34);
  }

  .run-btn:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.97);
    box-shadow:
      0 1px 1px hsl(216 60% 18% / 0.3) inset,
      0 2px 6px hsl(214 95% 45% / 0.22);
  }

  .run-btn:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px hsl(var(--background)),
      0 0 0 4px hsl(214 95% 55% / 0.7),
      0 8px 20px hsl(214 95% 45% / 0.26);
  }

  .run-btn:disabled {
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    opacity: 0.7;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Icon sits in its own tinted chip so it reads with stronger weight than
     the label and stays crisp against the gradient. */
  .run-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: hsl(0 0% 100% / 0.18);
  }
  .run-btn-icon svg {
    display: block;
  }

  .run-btn-label {
    font-weight: 650;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  .run-btn-large {
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    border-radius: 0.85rem;
    font-size: 0.95rem;
  }
  .run-btn-large .run-btn-icon {
    width: 1.55rem;
    height: 1.55rem;
  }
  .run-btn-large .run-btn-icon svg {
    width: 0.95rem;
    height: 0.95rem;
  }

  .run-btn-small {
    gap: 0.45rem;
    padding: 0.5rem 0.95rem;
    border-radius: 0.6rem;
    font-size: 0.8rem;
  }
  .run-btn-small .run-btn-icon {
    width: 1.2rem;
    height: 1.2rem;
  }
  .run-btn-small .run-btn-icon svg {
    width: 0.7rem;
    height: 0.7rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .run-btn,
    .run-btn:hover:not(:disabled),
    .run-btn:active:not(:disabled) {
      transition: none;
      transform: none;
    }
  }
</style>
