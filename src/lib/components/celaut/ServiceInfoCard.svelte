<script lang="ts">
  /**
   * Shows a service's on-chain info — the `celaut:service-metadata:v1` (name /
   * description / tags) and `celaut:service-data:v1` (architecture / api /
   * network) opinions keyed by this service id. Lets the skills UI surface basic
   * service info without downloading the whole service.
   *
   * When an opinion's R9 is a blake2b hash instead of an inline fragment (source
   * mode), the fragment lives in `sources`; we hand the hash to the existing
   * ServiceSourceCard so the user can find/download it.
   */
  import { onMount } from 'svelte';
  import { loadServiceData, loadServiceMetadata, formatServiceId } from '$lib/api';
  import type { ServiceData, ServiceMetadata } from '$lib/types';
  import ServiceSourceCard from './ServiceSourceCard.svelte';

  export let serviceId: string = '';
  export let compact: boolean = false;

  let metadata: ServiceMetadata[] = [];
  let data: ServiceData[] = [];
  let loading = false;

  // Highest-reputation assertion wins for display; the rest still contribute
  // their source hashes below.
  $: topMeta = [...metadata].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))[0];
  $: topData = [...data].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))[0];
  $: hasAny = metadata.length > 0 || data.length > 0;
  $: sourceHashes = Array.from(
    new Set(
      [...metadata, ...data]
        .filter((e) => e.mode === 'source' && e.sourceHash)
        .map((e) => e.sourceHash as string)
    )
  );

  async function load() {
    if (!serviceId) {
      metadata = [];
      data = [];
      return;
    }
    loading = true;
    try {
      [metadata, data] = await Promise.all([
        loadServiceMetadata(serviceId),
        loadServiceData(serviceId)
      ]);
    } catch {
      metadata = [];
      data = [];
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $: if (serviceId) load();
</script>

<div class:service-info-card={true} class:service-info-card-compact={compact}>
  <div class="service-info-header">
    <span class="service-info-label">Service info</span>
    <code class="service-info-id">{formatServiceId(serviceId)}</code>
  </div>

  {#if loading}
    <p class="service-info-empty">Loading service info…</p>
  {:else if !hasAny}
    <p class="service-info-empty">No on-chain service info published yet.</p>
  {:else}
    {#if topMeta}
      {#if topMeta.name}<h4 class="service-info-name">{topMeta.name}</h4>{/if}
      {#if topMeta.description}<p class="service-info-desc">{topMeta.description}</p>{/if}
      {#if topMeta.tags?.length}
        <div class="service-info-tags">
          {#each topMeta.tags as tag}<span class="service-info-tag">{tag}</span>{/each}
        </div>
      {/if}
    {/if}

    {#if topData}
      <dl class="service-info-spec">
        {#if topData.architecture}
          <div><dt>Architecture</dt><dd><code>{topData.architecture}</code></dd></div>
        {/if}
        {#if topData.api?.length}
          <div>
            <dt>API</dt>
            <dd>
              {#each topData.api as slot}
                <code class="service-info-slot">
                  {slot.port ?? '?'}{slot.protocol?.length ? ' · ' + slot.protocol.join('/') : ''}{slot.transport?.length ? ' · ' + slot.transport.join('/') : ''}
                </code>
              {/each}
            </dd>
          </div>
        {/if}
        {#if topData.network?.length}
          <div><dt>Network</dt><dd><code>{JSON.stringify(topData.network)}</code></dd></div>
        {/if}
      </dl>
    {/if}

    {#if sourceHashes.length}
      <div class="service-info-sources">
        <p class="service-info-empty">
          Some info is stored off-chain (referenced by hash) — resolve it from sources:
        </p>
        {#each sourceHashes as hash}
          <ServiceSourceCard serviceId={hash} compact />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .service-info-card {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.85rem;
    background: hsl(var(--muted) / 0.16);
  }

  .service-info-card-compact {
    padding: 0.625rem;
  }

  .service-info-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .service-info-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
  }

  .service-info-id {
    font-size: 0.72rem;
    color: hsl(var(--muted-foreground));
  }

  .service-info-empty {
    font-size: 0.8rem;
    color: hsl(var(--muted-foreground));
    margin: 0.25rem 0;
  }

  .service-info-name {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0.1rem 0 0.25rem;
  }

  .service-info-desc {
    font-size: 0.85rem;
    margin: 0 0 0.5rem;
  }

  .service-info-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .service-info-tag {
    font-size: 0.72rem;
    padding: 0.1rem 0.45rem;
    border-radius: 0.5rem;
    background: hsl(var(--muted) / 0.5);
  }

  .service-info-spec {
    display: grid;
    gap: 0.4rem;
    margin: 0;
  }

  .service-info-spec div {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }

  .service-info-spec dt {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    min-width: 5.5rem;
  }

  .service-info-spec dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .service-info-slot {
    font-size: 0.72rem;
    padding: 0.1rem 0.4rem;
    border-radius: 0.4rem;
    background: hsl(var(--muted) / 0.4);
  }

  .service-info-sources {
    margin-top: 0.5rem;
  }
</style>
