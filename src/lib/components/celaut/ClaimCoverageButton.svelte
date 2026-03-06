<script lang="ts">
  let showTooltip = false;
</script>

<div class="claim-wrapper">
  <button
    class="claim-btn"
    disabled
    on:mouseenter={() => showTooltip = true}
    on:mouseleave={() => showTooltip = false}
    on:focus={() => showTooltip = true}
    on:blur={() => showTooltip = false}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    Claim Coverage
  </button>
  {#if showTooltip}
    <div class="claim-tooltip">Connect wallet &amp; deploy service first</div>
  {/if}
</div>

<style lang="postcss">
  .claim-wrapper {
    position: relative;
    display: inline-flex;
    margin-bottom: 1.5rem;
  }

  .claim-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    cursor: not-allowed;
    opacity: 0.6;
  }

  .claim-tooltip {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    background-color: hsl(var(--foreground));
    color: hsl(var(--background));
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .claim-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: hsl(var(--foreground));
  }
</style>
