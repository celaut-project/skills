<script lang="ts">
  /**
   * DetailDialog — a lightweight, portalled modal used to show the full details
   * of a single network definition or trust-framework instance.
   *
   * Mirrors the app's other portal-based overlays (ShareModal / InfoTip): it is
   * appended to <body>, sits above everything with a high z-index, and closes on
   * overlay click or Escape. Content is provided via the default slot; the
   * header shows `title` (and optional `subtitle`).
   */
  import { createEventDispatcher } from 'svelte';
  import { portal } from '$lib/actions/portal';

  export let open = false;
  export let title = '';
  export let subtitle = '';

  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    open = false;
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div
    use:portal
    class="dd-overlay"
    role="presentation"
    on:click|self={close}
  >
    <div class="dd-dialog" role="dialog" aria-modal="true" aria-label={title || 'Details'}>
      <header class="dd-header">
        <div class="dd-heading">
          <h2 class="dd-title">{title}</h2>
          {#if subtitle}<p class="dd-subtitle">{subtitle}</p>{/if}
        </div>
        <button type="button" class="dd-close" on:click={close} aria-label="Close dialog" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>
      <div class="dd-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .dd-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: hsl(0 0% 0% / 0.5);
    backdrop-filter: blur(2px);
  }

  .dd-dialog {
    width: 100%;
    max-width: 40rem;
    max-height: min(85vh, 720px);
    display: flex;
    flex-direction: column;
    border: 1px solid hsl(var(--border));
    border-radius: 12px;
    background: hsl(var(--card));
    box-shadow: 0 24px 60px -20px hsl(0 0% 0% / 0.5);
    overflow: hidden;
  }

  .dd-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid hsl(var(--border) / 0.4);
  }
  .dd-heading {
    min-width: 0;
  }
  .dd-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: hsl(var(--foreground));
    word-break: break-word;
  }
  .dd-subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: hsl(var(--muted-foreground));
  }
  .dd-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .dd-close:hover {
    background: hsl(var(--muted) / 0.3);
    color: hsl(var(--foreground));
  }
  .dd-close:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }

  .dd-body {
    padding: 20px;
    overflow-y: auto;
  }

  @media (max-width: 600px) {
    .dd-overlay {
      padding: 12px;
    }
    .dd-body {
      padding: 16px;
    }
  }
</style>
