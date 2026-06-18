<script lang="ts">
  /**
   * Small "ℹ" icon button that opens a dropdown explaining a piece of data
   * in the Skill view. Lightweight popover — uses a native `<dialog>`-style
   * overlay so it works on touch without depending on hover.
   *
   * Usage:
   *   <InfoTip title="Composite score">
   *     The composite is the direction-signed z-score per metric column,
   *     weighted by max(bench_rep, 1) × max(result_rep, 1).
   *   </InfoTip>
   */
  export let title: string = '';
  /** Optional small label rendered next to the icon (e.g. "what is this?"). */
  export let label: string = '';
  /** Position the popover relative to the button. */
  export let placement: 'bottom' | 'top' | 'right' = 'bottom';

  let open = false;
  let buttonEl: HTMLButtonElement;
  let popoverEl: HTMLDivElement;

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  function onWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (popoverEl?.contains(target) || buttonEl?.contains(target)) return;
    close();
  }

  function onEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onEscape} />

<span class="info-tip-wrap">
  <button
    bind:this={buttonEl}
    type="button"
    class="info-tip-btn"
    class:info-tip-btn-open={open}
    aria-expanded={open}
    aria-label={title ? `Info: ${title}` : 'More info'}
    on:click={toggle}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
    {#if label}<span class="info-tip-label">{label}</span>{/if}
  </button>

  {#if open}
    <div
      bind:this={popoverEl}
      class="info-tip-popover info-tip-popover-{placement}"
      role="dialog"
      aria-label={title || 'Info'}
    >
      {#if title}
        <div class="info-tip-title">{title}</div>
      {/if}
      <div class="info-tip-body">
        <slot />
      </div>
    </div>
  {/if}
</span>

<style lang="postcss">
  .info-tip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .info-tip-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.125rem;
    border-radius: 9999px;
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .info-tip-btn:hover,
  .info-tip-btn-open {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.4);
  }

  .info-tip-label {
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .info-tip-popover {
    position: absolute;
    z-index: 50;
    min-width: 16rem;
    max-width: 22rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--card));
    color: hsl(var(--foreground));
    box-shadow: 0 8px 24px -8px hsl(0 0% 0% / 0.35);
    font-size: 0.75rem;
    line-height: 1.55;
    text-align: left;
    white-space: normal;
  }

  .info-tip-popover-bottom {
    top: calc(100% + 0.375rem);
    left: 0;
  }

  .info-tip-popover-top {
    bottom: calc(100% + 0.375rem);
    left: 0;
  }

  .info-tip-popover-right {
    top: 0;
    left: calc(100% + 0.375rem);
  }

  .info-tip-title {
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.375rem;
    color: hsl(var(--foreground));
  }

  .info-tip-body {
    color: hsl(var(--muted-foreground));
  }

  .info-tip-body :global(p) {
    margin: 0 0 0.375rem;
  }
  .info-tip-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .info-tip-body :global(code) {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.25rem;
    border-radius: 0.1875rem;
    background: hsl(var(--muted) / 0.5);
  }
  .info-tip-body :global(ul) {
    margin: 0.25rem 0;
    padding-left: 1rem;
  }
  .info-tip-body :global(li) {
    margin-bottom: 0.125rem;
  }
  .info-tip-body :global(strong) {
    color: hsl(var(--foreground));
  }
</style>
