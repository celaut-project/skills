<script lang="ts">
  import { FileCard, fetchFileSourcesByHash } from 'source-application';
  import type { FileSource } from 'source-application';
  import { explorer_uri, reputation_proof, source_explorer_url, web_explorer_uri_token } from '$lib/common/store';
  import { formatSourceHash } from '$lib/api';
  import { createEventDispatcher, onMount } from 'svelte';

  export let serviceId: string = '';
  export let compact: boolean = false;

  const dispatch = createEventDispatcher<{ addSource: string }>();

  let sources: FileSource[] = [];
  let loading = false;

  function looksLikeHash(value: string): boolean {
    return /^[0-9a-f]{64}$/i.test(value);
  }

  async function loadSources() {
    if (!looksLikeHash(serviceId)) {
      sources = [];
      return;
    }
    loading = true;
    try {
      sources = (await fetchFileSourcesByHash($explorer_uri, serviceId)) ?? [];
    } catch {
      sources = [];
    } finally {
      loading = false;
    }
  }

  onMount(loadSources);
  $: if (serviceId) loadSources();
</script>

<!-- Collapsible Source section (default collapsed) — keeps the service-solution
     view compact until the user opts into the on-chain source details. -->
<details class:service-source-card={true} class:service-source-card-compact={compact}>
  <summary class="service-source-header">
    <svg class="service-source-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
    <span class="service-source-label">Source</span>
    <code class="service-source-id">{formatSourceHash(serviceId)}</code>
  </summary>

  <div class="service-source-body">
    {#if !looksLikeHash(serviceId)}
      <p class="service-source-empty">Service id is not a file hash, so source lookup is unavailable.</p>
    {:else if loading}
      <p class="service-source-empty">Loading source…</p>
    {:else}
      <FileCard
        fileHash={serviceId}
        profile={$reputation_proof}
        {sources}
        explorerUri={$explorer_uri}
        source_explorer_url={$source_explorer_url}
        webExplorerUriTkn={$web_explorer_uri_token}
      />
      {#if $reputation_proof}
        <button class="service-source-add" on:click={() => dispatch('addSource', serviceId)}>+ Add Source</button>
      {/if}
    {/if}
  </div>
</details>

<style lang="postcss">
  .service-source-card {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.85rem;
    background: hsl(var(--muted) / 0.16);
  }

  .service-source-card-compact {
    padding: 0.625rem;
  }

  .service-source-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  /* Hide the native disclosure triangle (we render our own chevron). */
  .service-source-header::-webkit-details-marker {
    display: none;
  }

  .service-source-chevron {
    color: hsl(var(--muted-foreground));
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }
  details[open] > .service-source-header .service-source-chevron {
    transform: rotate(90deg);
  }

  .service-source-body {
    margin-top: 0.5rem;
  }

  .service-source-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
  }

  .service-source-id {
    font-size: 0.68rem;
    color: hsl(var(--foreground));
    background: hsl(var(--background));
    padding: 0.12rem 0.38rem;
    border-radius: 0.28rem;
  }

  .service-source-empty {
    margin: 0;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .service-source-add {
    display: inline-flex;
    align-items: center;
    margin-top: 0.5rem;
    padding: 0.3rem 0.65rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.72rem;
    cursor: pointer;
  }
</style>
