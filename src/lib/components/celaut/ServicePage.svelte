<script lang="ts">
  /**
   * ?service=<serviceId|boxId> — Dedicated service view.
   *
   * Shows: sources (ServiceSourceCard), structured service data with resolved
   * network refs, metadata, associated skills, and a ForumSidebar entry-point.
   */
  import { onMount, createEventDispatcher } from 'svelte';
  import { loadServiceData, loadServiceMetadata, loadStrictDefinition, formatServiceId } from '$lib/api';
  import type { ServiceData, ServiceMetadata } from '$lib/types';
  import type { Skill } from '$lib/types';
  import type { StrictDefinitionBox } from '$lib/types';
  import { toasts } from './toastStore';
  import { openForum } from './forumSidebar';
  import { viewedNetworkId, networkPageReturn } from '$lib/stores';
  import ServiceSourceCard from './ServiceSourceCard.svelte';
  import ExplorerLink from './ExplorerLink.svelte';
  import ServiceInfoCard from './ServiceInfoCard.svelte';

  export let serviceId: string = '';
  export let skills: Skill[] = [];

  const dispatch = createEventDispatcher<{ back: void; navigateSkill: string }>();

  // ── State ────────────────────────────────────────────────────────────────────
  let metadata: ServiceMetadata[] = [];
  let data: ServiceData[] = [];
  let loading = false;

  // Map from network boxId → resolved StrictDefinitionBox (for inline display)
  let resolvedNetworks: Record<string, StrictDefinitionBox | null> = {};
  let resolvingNetworks: Set<string> = new Set();

  const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

  $: topMeta = [...metadata].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))[0];
  $: topData = [...data].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))[0];

  // All network items in the best data assertion
  $: networkItems = topData?.content?.network
    ? asArray(topData.content.network)
    : [];

  // Extract any boxId refs for auto-resolve
  $: {
    for (const item of networkItems) {
      if (typeof item === 'string' && item.length === 64 && !(item in resolvedNetworks)) {
        resolveNetwork(item);
      }
    }
  }

  $: associatedSkills = skills.filter(s =>
    s.coverages.some(c => c.serviceId === serviceId)
  );

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!serviceId) return;
    loading = true;
    try {
      [data, metadata] = await Promise.all([
        loadServiceData(serviceId),
        loadServiceMetadata(serviceId)
      ]);
    } catch {
      toasts.error('Failed to load service information.');
    } finally {
      loading = false;
    }
  }

  async function resolveNetwork(boxId: string) {
    if (resolvingNetworks.has(boxId) || boxId in resolvedNetworks) return;
    resolvingNetworks = new Set([...resolvingNetworks, boxId]);
    try {
      const def = await loadStrictDefinition(boxId);
      resolvedNetworks = { ...resolvedNetworks, [boxId]: def };
    } catch {
      resolvedNetworks = { ...resolvedNetworks, [boxId]: null };
    } finally {
      resolvingNetworks = new Set([...resolvingNetworks].filter(id => id !== boxId));
    }
  }

  function openNetworkPage(boxId: string) {
    networkPageReturn.set({ type: 'service', serviceId });
    viewedNetworkId.set(boxId);
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      u.searchParams.set('network', boxId);
      window.history.pushState({}, '', u);
    }
  }
</script>

<div class="sp-container">
  <div class="sp-header">
    <button class="sp-back" type="button" on:click={() => dispatch('back')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
    <h1 class="sp-title">
      Service
      <code class="sp-service-id">{formatServiceId(serviceId)}</code>
    </h1>
    <ExplorerLink boxId={serviceId} liveTooltip="View on Ergo Explorer" />
    <button
      class="sp-forum-btn"
      type="button"
      on:click={() => openForum(serviceId, `Service: ${formatServiceId(serviceId)}`)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      Dialogue
    </button>
  </div>

  {#if loading}
    <div class="sp-card sp-loading">Loading service information…</div>
  {:else}
    <div class="sp-grid">
      <!-- Left column: data + metadata -->
      <div class="sp-main">

        <!-- Service data and metadata -->
        <ServiceInfoCard serviceId={serviceId || ''} compact={true} />

        <!-- Sources -->
        <ServiceSourceCard {serviceId} compact={false} />
      </div>

      <!-- Right column: associated skills -->
      <aside class="sp-sidebar">
        <div class="sp-card">
          <h2 class="sp-section-title">Skills covered</h2>
          {#if associatedSkills.length === 0}
            <p class="sp-empty-aside">No skills found for this service.</p>
          {:else}
            <ul class="sp-skill-list">
              {#each associatedSkills as skill}
                <li>
                  <button class="sp-skill-btn" type="button" on:click={() => dispatch('navigateSkill', skill.boxId)}>
                    <span class="sp-skill-name">{skill.name}</span>
                    <span class="sp-skill-domain">{skill.domain}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </aside>
    </div>
  {/if}
</div>

<style lang="postcss">
  .sp-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .sp-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .sp-title {
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sp-service-id {
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
    color: hsl(var(--muted-foreground));
    font-weight: 400;
  }
  .sp-back {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    padding: 0.4rem 0.8rem;
    border-radius: 0.6rem;
    border: 0px solid hsl(var(--border) / 0.7);
    background: transparent;
    cursor: pointer;
  }
  .sp-forum-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: auto;
    font-size: 0.8rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border));
    background: transparent;
    cursor: pointer;
  }
  .sp-loading { color: hsl(var(--muted-foreground)); font-size: 0.85rem; }
  .sp-grid {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 1.25rem;
    align-items: start;
  }
  @media (max-width: 700px) { .sp-grid { grid-template-columns: 1fr; } }
  .sp-main { display: flex; flex-direction: column; gap: 1rem; }
  .sp-sidebar { display: flex; flex-direction: column; gap: 1rem; }

  .sp-card {
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.9rem;
    padding: 1.1rem;
    background: hsl(var(--muted) / 0.06);
  }
  .sp-card-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .sp-section-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem; }
  .sp-card-head .sp-section-title { margin: 0; }
  .sp-empty-card { color: hsl(var(--muted-foreground)); font-size: 0.85rem; }
  .sp-multi-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 0.4rem;
    background: hsl(var(--muted) / 0.4);
    color: hsl(var(--muted-foreground));
  }

  .sp-field { margin-bottom: 0.85rem; }
  .sp-field-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.3rem;
  }
  .sp-prose { font-size: 0.87rem; margin: 0; }
  .sp-hash-note { font-size: 0.82rem; color: hsl(var(--muted-foreground)); }
  .sp-hash { font-family: ui-monospace, monospace; font-size: 0.75rem; word-break: break-all; }
  .sp-hash-mini { font-family: ui-monospace, monospace; font-size: 0.75rem; }

  .sp-kv-list { display: flex; flex-direction: column; gap: 0.25rem; }
  .sp-kv-row { display: flex; gap: 0.75rem; align-items: baseline; }
  .sp-kv-key {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    font-weight: 700;
    color: hsl(var(--primary));
    min-width: 8rem;
  }
  .sp-kv-val { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; }

  .sp-api-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .sp-api-slot { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
  .sp-api-badge {
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border-radius: 0.4rem;
    background: hsl(var(--muted) / 0.4);
    font-family: ui-monospace, monospace;
  }
  .sp-api-transport { background: hsl(var(--primary) / 0.08); }
  .sp-api-protocol { background: hsl(210, 60%, 50%, 0.1); }

  .sp-network-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .sp-network-ref {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.4rem 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.5);
    background: hsl(var(--muted) / 0.06);
  }
  .sp-network-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0.3rem 0;
  }
  .sp-network-tag {
    font-size: 0.78rem;
    font-weight: 700;
    background: hsl(var(--primary) / 0.1);
    color: hsl(var(--primary));
    padding: 0.15rem 0.5rem;
    border-radius: 0.4rem;
  }
  .sp-network-tag-inline {
    font-size: 0.72rem;
    padding: 0.15rem 0.45rem;
    border-radius: 0.4rem;
    background: hsl(var(--muted) / 0.4);
  }
  .sp-network-protocol { font-family: ui-monospace, monospace; font-size: 0.75rem; }
  .sp-network-jump {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--primary) / 0.4);
    background: hsl(var(--primary) / 0.07);
    cursor: pointer;
  }
  .sp-network-resolving { font-size: 0.78rem; color: hsl(var(--muted-foreground)); font-style: italic; }
  .sp-network-unresolved { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }

  .sp-empty-aside { font-size: 0.82rem; color: hsl(var(--muted-foreground)); }
  .sp-skill-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .sp-skill-btn {
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.65rem;
    border-radius: 0.55rem;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .sp-skill-btn:hover { background: hsl(var(--muted) / 0.3); }
  .sp-skill-name { font-size: 0.85rem; font-weight: 700; }
  .sp-skill-domain { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
</style>
