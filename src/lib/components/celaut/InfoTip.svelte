<script lang="ts">
  /**
   * Small "ℹ" icon button that opens a dropdown explaining a piece of data
   * in the Skill view. Lightweight popover — uses a native `<dialog>`-style
   * overlay so it works on touch without depending on hover.
   *
   * The popover is **portalled to <body>** and pinned with `position: fixed`
   * (coordinates derived from the trigger's bounding rect). This guarantees it
   * always renders on top and is never clipped by an ancestor's `overflow` or
   * trapped inside a stacking context — previously it could be cut off by
   * surrounding cards/tables.
   *
   * Usage:
   *   <InfoTip title="Composite score">
   *     The composite is the direction-signed z-score per metric column,
   *     weighted by max(bench_rep, 1) × max(result_rep, 1).
   *   </InfoTip>
   */
  import { tick } from 'svelte';
  import { portal } from '$lib/actions/portal';

  export let title: string = '';
  /** Optional small label rendered next to the icon (e.g. "what is this?"). */
  export let label: string = '';
  /** Preferred position of the popover relative to the button. */
  export let placement: 'bottom' | 'top' | 'right' = 'bottom';

  let open = false;
  let buttonEl: HTMLButtonElement;
  let popoverEl: HTMLDivElement;
  // Start hidden so the popover never flashes at (0,0) before it's positioned.
  let popoverStyle = 'visibility:hidden;';

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  /** Pin the portalled popover to the trigger, clamped inside the viewport. */
  async function position() {
    if (!open || !buttonEl) return;
    await tick();
    if (!popoverEl) return;
    const b = buttonEl.getBoundingClientRect();
    const pop = popoverEl.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    let top: number;
    let left: number;

    if (placement === 'top') {
      top = b.top - gap - pop.height;
      left = b.left;
    } else if (placement === 'right') {
      top = b.top;
      left = b.right + gap;
    } else {
      // bottom (default)
      top = b.bottom + gap;
      left = b.left;
    }

    // Clamp horizontally, then vertically, so the popover never leaves the view.
    const maxLeft = window.innerWidth - pop.width - margin;
    left = Math.min(Math.max(margin, left), Math.max(margin, maxLeft));
    const maxTop = window.innerHeight - pop.height - margin;
    top = Math.min(Math.max(margin, top), Math.max(margin, maxTop));

    popoverStyle = `top:${top}px;left:${left}px;visibility:visible;`;
  }

  // Reposition while open (page scroll, inner-scroll containers, resize).
  // Reset to hidden on close so the next open re-positions before painting.
  $: if (open) {
    position();
  } else {
    popoverStyle = 'visibility:hidden;';
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

  // `capture: true` so scrolling any ancestor container (not just window)
  // keeps the popover glued to its trigger.
  function onScroll() {
    if (open) position();
  }
</script>

<svelte:window
  on:click={onWindowClick}
  on:keydown={onEscape}
  on:resize={position}
  on:scroll|capture={onScroll}
/>

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
      use:portal
      class="info-tip-popover"
      style={popoverStyle}
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

  /* Portalled to <body>: fixed positioning + high z-index so it always sits on
     top and is never clipped. Exact top/left come from inline `popoverStyle`. */
  .info-tip-popover {
    position: fixed;
    z-index: 1000;
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
