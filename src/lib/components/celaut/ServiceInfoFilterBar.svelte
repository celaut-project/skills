<script lang="ts">
  /**
   * Filter bar for a skill's covered services, driven by the on-chain Service
   * Data each service publishes: hide services with networks, or filter by
   * architecture / api protocol. Options are derived from whatever has loaded so
   * far, so the bar fills in as the lazy service-info loads land.
   */
  import { serviceFilters, filterOptions, anyServiceLoading, filtersActive, emptyFilters } from '$lib/serviceFilters';

  $: options = $filterOptions;
  $: hasFacets = options.architectures.length > 0 || options.protocols.length > 0;
  $: active = filtersActive($serviceFilters);

  function reset() {
    serviceFilters.set(emptyFilters());
  }
</script>

<div class="sif-bar">
  <div class="sif-controls">
    <label class="sif-check">
      <input type="checkbox" bind:checked={$serviceFilters.noNetworks} />
      No networks
    </label>

    <label class="sif-field">
      <span>Architecture</span>
      <select bind:value={$serviceFilters.architecture}>
        <option value={null}>Any</option>
        {#each options.architectures as arch}
          <option value={arch}>{arch}</option>
        {/each}
      </select>
    </label>

    <label class="sif-field">
      <span>API</span>
      <select bind:value={$serviceFilters.protocol}>
        <option value={null}>Any</option>
        {#each options.protocols as proto}
          <option value={proto}>{proto}</option>
        {/each}
      </select>
    </label>

    {#if active}
      <button class="sif-reset" type="button" on:click={reset}>Clear</button>
    {/if}
  </div>

  {#if $anyServiceLoading}
    <span class="sif-loading">Loading service info…</span>
  {:else if !hasFacets}
    <span class="sif-loading">No service info published yet.</span>
  {/if}
</div>

<style lang="postcss">
  .sif-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.75rem;
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.75rem;
    background: hsl(var(--muted) / 0.12);
  }
  .sif-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .sif-check {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .sif-field {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }
  .sif-field select {
    padding: 0.25rem 0.4rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.8rem;
    color: hsl(var(--foreground));
  }
  .sif-reset {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: transparent;
    cursor: pointer;
  }
  .sif-loading {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }
</style>
