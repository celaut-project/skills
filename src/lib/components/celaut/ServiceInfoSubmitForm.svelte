<script lang="ts">
  /**
   * Publish a Service Data or Service Metadata opinion for a service id.
   *
   * Service Data is submitted as structured fields (prose, container, api, network).
   * Network items can be inline {tags} objects or string Box ID references to
   * STRICT_DEFINITION_TYPE_ID boxes. A blake2b256 hash toggle publishes in source mode.
   * Service Metadata stays as a JSON textarea.
   */
  import { WalletButton, walletConnected } from 'wallet-svelte-component';
  import { onMount, createEventDispatcher } from 'svelte';
  import { toasts } from './toastStore';
  import { createServiceData, createServiceMetadata } from '$lib/data';
  import { looksLikeBlake2bHash, loadStrictDefinitions } from '$lib/api';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';
  import {
    serviceDataFormState,
    viewedNetworkId,
    networkPageReturn,
    type ServiceDataFormState
  } from '$lib/stores';
  import ExplorerLink from './ExplorerLink.svelte';
  import type { StrictDefinitionBox } from '$lib/types';
  import { isNetworkDefinition } from '$lib/strictDefinition';

  export let serviceId = '';
  /** When true, the form can read/write the serviceDataFormState store for cross-page preservation. */
  export let preserveState = false;

  const dispatch = createEventDispatcher<{ published: { txId: string; kind: 'data' | 'metadata' } }>();

  // ── Form state ─────────────────────────────────────────────────────────────
  let kind: 'data' | 'metadata' = 'data';
  let prose = '';
  let containerArchitecture = '';
  let apiSlots: Array<{ port: string; transport: string[]; protocol: string[] }> = [
    { port: '', transport: ['tcp'], protocol: ['http'] }
  ];
  type NetworkItem =
    | { type: 'inline'; tags: string; resolvedDef?: StrictDefinitionBox | null }
    | { type: 'ref'; boxId: string; resolvedDef?: StrictDefinitionBox | null; resolving?: boolean };
  let networkItems: NetworkItem[] = [];
  // Metadata form
  let metadataJson = `{
  "name": "My service",
  "description": "What it does",
  "tags": ["ai", "vision"]
}`;

  // Hash mode toggle
  let useHashMode = false;
  let hashValue = '';

  let submitting = false;
  let submitTx: string | null = null;
  let error: string | null = null;

  // Network definition selector state
  let availableNetworks: StrictDefinitionBox[] = [];
  let networkSearchQuery = '';
  let showNetworkSelector = false;
  let selectedNetworkItemIdx: number | null = null;
  let loadingNetworks = false;

  const TRANSPORTS = ['tcp', 'udp', 'sctp'];
  const PROTOCOLS = ['http', 'grpc', 'http2', 'websocket', 'quic'];

  // ── Restore form state if set ─────────────────────────────────────────────
  onMount(() => {
    if (preserveState) {
      const saved = $serviceDataFormState;
      if (saved) {
        kind = saved.kind;
        prose = saved.prose;
        containerArchitecture = saved.containerArchitecture;
        apiSlots = saved.apiSlots.map(s => ({ ...s, transport: [...s.transport], protocol: [...s.protocol] }));
        networkItems = saved.networkItems.map(n =>
          n.type === 'inline' ? { type: 'inline' as const, tags: n.tags.join(', ') } : { type: 'ref' as const, boxId: n.boxId }
        );
        metadataJson = saved.metadataJson;
        serviceDataFormState.set(null);
      }
    }
  });

  function saveFormState() {
    if (!preserveState) return;
    serviceDataFormState.set({
      serviceId,
      kind,
      prose,
      containerArchitecture,
      apiSlots: apiSlots.map(s => ({ ...s })),
      networkItems: networkItems.map(n =>
        n.type === 'inline' ? { type: 'inline' as const, tags: n.tags.split(',').map(t => t.trim()).filter(Boolean) } : { type: 'ref' as const, boxId: n.boxId }
      ),
      metadataJson
    });
  }

  // ── API helpers ─────────────────────────────────────────────────────────────
  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  function buildDataContent(): Record<string, unknown> | string {
    if (useHashMode) {
      const h = hashValue.trim();
      if (!looksLikeBlake2bHash(h)) throw new Error('Not a valid blake2b256 hash.');
      return h;
    }
    const container: Record<string, unknown> = {};
    if (containerArchitecture.trim()) container.architecture = containerArchitecture.trim();
    const api = apiSlots
      .filter(s => s.port)
      .map(s => ({
        port: Number(s.port),
        transport: s.transport.filter(Boolean),
        protocol: s.protocol.filter(Boolean)
      }));
    const network = networkItems.map(n => {
      if (n.type === 'inline') {
        return { tags: n.tags.split(',').map(t => t.trim()).filter(Boolean) };
      }
      return n.boxId.trim();
    });
    const payload: Record<string, unknown> = {};
    if (prose.trim()) payload.prose = prose.trim();
    if (Object.keys(container).length > 0) payload.container = container;
    if (api.length > 0) payload.api = api;
    if (network.length > 0) payload.network = network;
    return payload;
  }

  function buildMetaContent(): Record<string, unknown> {
    try {
      const parsed = JSON.parse(metadataJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Metadata must be a JSON object.');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new Error('Invalid JSON in metadata field.');
    }
  }

  async function handleSubmit() {
    error = null;
    submitTx = null;
    if (!$walletConnected) { error = 'Connect your wallet first.'; toasts.error(error); return; }
    if (!serviceId.trim()) { error = 'Service id is required.'; return; }

    let content: Record<string, unknown> | string;
    try {
      content = kind === 'data' ? buildDataContent() : buildMetaContent();
    } catch (e: any) {
      error = e?.message || 'Invalid form data.';
      toasts.error(error ?? 'Invalid form data.');
      return;
    }

    submitting = true;
    try {
      const input = { serviceId: serviceId.trim(), content, tokenAmount: 1, mainBox: currentMainBox() };
      const txId = kind === 'data' ? await createServiceData(input) : await createServiceMetadata(input);
      submitTx = txId;
      toasts.success($demoMode ? `Service ${kind} submitted (demo mode).` : `Service ${kind} published on-chain.`);
      dispatch('published', { txId, kind });
      resetDataForm();
    } catch (e: any) {
      error = e?.message || 'Submission failed.';
      toasts.error(error ?? 'Submission failed.');
    } finally {
      submitting = false;
    }
  }

  function resetDataForm() {
    prose = '';
    containerArchitecture = '';
    apiSlots = [{ port: '', transport: ['tcp'], protocol: ['http'] }];
    networkItems = [];
    hashValue = '';
    useHashMode = false;
  }

  // ── API slots ────────────────────────────────────────────────────────────────
  function addApiSlot() { apiSlots = [...apiSlots, { port: '', transport: ['tcp'], protocol: ['http'] }]; }
  function removeApiSlot(i: number) { apiSlots = apiSlots.filter((_, idx) => idx !== i); }
  function toggleTransport(slotIdx: number, t: string) {
    const slot = apiSlots[slotIdx];
    slot.transport = slot.transport.includes(t) ? slot.transport.filter(x => x !== t) : [...slot.transport, t];
    apiSlots = [...apiSlots];
  }
  function toggleProtocol(slotIdx: number, p: string) {
    const slot = apiSlots[slotIdx];
    slot.protocol = slot.protocol.includes(p) ? slot.protocol.filter(x => x !== p) : [...slot.protocol, p];
    apiSlots = [...apiSlots];
  }

  // ── Network items ────────────────────────────────────────────────────────────
  function addInlineNetwork() { networkItems = [...networkItems, { type: 'inline', tags: '' }]; }
  function addRefNetwork() { networkItems = [...networkItems, { type: 'ref', boxId: '' }]; }
  function removeNetworkItem(i: number) { networkItems = networkItems.filter((_, idx) => idx !== i); }

  async function resolveRefNetwork(i: number) {
    const item = networkItems[i];
    if (item.type !== 'ref' || !item.boxId.trim()) return;
    item.resolving = true;
    networkItems = [...networkItems];
    try {
      const { loadStrictDefinition } = await import('$lib/api');
      const def = await loadStrictDefinition(item.boxId.trim());
      item.resolvedDef = def;
    } catch {
      item.resolvedDef = null;
    } finally {
      item.resolving = false;
      networkItems = [...networkItems];
    }
  }

  async function openNetworkSelector(i: number) {
    selectedNetworkItemIdx = i;
    showNetworkSelector = true;
    if (availableNetworks.length === 0) {
      loadingNetworks = true;
      try {
        const all = await loadStrictDefinitions();
        availableNetworks = all.filter(d => isNetworkDefinition(d.content));
      } catch {
        availableNetworks = [];
      } finally {
        loadingNetworks = false;
      }
    }
  }

  function selectNetwork(def: StrictDefinitionBox) {
    if (selectedNetworkItemIdx === null) return;
    networkItems[selectedNetworkItemIdx] = { type: 'ref', boxId: def.boxId, resolvedDef: def };
    networkItems = [...networkItems];
    showNetworkSelector = false;
    selectedNetworkItemIdx = null;
  }

  $: filteredNetworks = networkSearchQuery
    ? availableNetworks.filter(d =>
        (d.content.tag || '').toLowerCase().includes(networkSearchQuery.toLowerCase()) ||
        (d.content.prose || '').toLowerCase().includes(networkSearchQuery.toLowerCase()) ||
        JSON.stringify((d.content.formal as any)?.actions ?? []).toLowerCase().includes(networkSearchQuery.toLowerCase())
      )
    : availableNetworks;

  function goToCreateNetwork() {
    saveFormState();
    networkPageReturn.set({ type: 'serviceForm' });
    viewedNetworkId.set('new');
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      u.searchParams.set('network', 'new');
      window.history.pushState({}, '', u);
    }
  }
</script>

<div class="service-info-form">
  <div class="sif-kind">
    <button class:active={kind === 'data'} type="button" on:click={() => (kind = 'data')}>Service Data</button>
    <button class:active={kind === 'metadata'} type="button" on:click={() => (kind = 'metadata')}>Service Metadata</button>
  </div>

  {#if kind === 'data'}
    <!-- ── Structured Service Data form ───────────────────────────────────── -->
    <div class="sif-toggle-row">
      <label class="sif-toggle-label">
        <input type="checkbox" bind:checked={useHashMode} />
        <span>Use source hash (advanced)</span>
      </label>
    </div>

    {#if useHashMode}
      <label class="sif-label" for="sif-hash">Blake2b256 hash (source mode)</label>
      <input id="sif-hash" class="sif-input" bind:value={hashValue} placeholder="64-char hex hash" />
      {#if hashValue && looksLikeBlake2bHash(hashValue.trim())}
        <p class="sif-hint">Hash detected — will publish in source mode (content resolved from sources).</p>
      {/if}
    {:else}
      <div class="sif-section">
        <label class="sif-label" for="sif-prose">Prose description</label>
        <textarea id="sif-prose" class="sif-textarea" rows="3" bind:value={prose} placeholder="What does this service do?"></textarea>
      </div>

      <div class="sif-section">
        <label class="sif-label" for="sif-arch">Container architecture</label>
        <input id="sif-arch" class="sif-input" bind:value={containerArchitecture} placeholder="e.g. linux/amd64" />
      </div>

      <div class="sif-section">
        <div class="sif-label">API slots</div>
        {#each apiSlots as slot, i}
          <div class="sif-api-row">
            <input class="sif-input sif-port" type="number" bind:value={slot.port} placeholder="port" min="1" max="65535" />
            <div class="sif-check-group">
              {#each TRANSPORTS as t}
                <label class="sif-check">
                  <input type="checkbox" checked={slot.transport.includes(t)} on:change={() => toggleTransport(i, t)} />
                  {t}
                </label>
              {/each}
            </div>
            <div class="sif-check-group">
              {#each PROTOCOLS as p}
                <label class="sif-check">
                  <input type="checkbox" checked={slot.protocol.includes(p)} on:change={() => toggleProtocol(i, p)} />
                  {p}
                </label>
              {/each}
            </div>
            <button type="button" class="sif-remove" on:click={() => removeApiSlot(i)} disabled={apiSlots.length <= 1}>×</button>
          </div>
        {/each}
        <button type="button" class="sif-add" on:click={addApiSlot}>+ Add API slot</button>
      </div>

      <div class="sif-section">
        <div class="sif-label">Network requirements</div>
        {#each networkItems as item, i}
          <div class="sif-net-row">
            {#if item.type === 'inline'}
              <span class="sif-net-badge">inline</span>
              <input class="sif-input sif-net-tags" bind:value={item.tags} placeholder="tags, comma-separated (e.g. public, ipv4)" />
            {:else}
              <span class="sif-net-badge sif-net-badge-ref">ref</span>
              <input class="sif-input sif-net-boxid"
                bind:value={item.boxId}
                placeholder="Strict Definition box ID"
                on:blur={() => resolveRefNetwork(i)}
              />
              <button type="button" class="sif-net-browse" on:click={() => openNetworkSelector(i)}>Browse</button>
              {#if item.resolving}
                <span class="sif-net-status">Resolving…</span>
              {:else if item.resolvedDef}
                <span class="sif-net-status sif-net-ok" title={item.resolvedDef.content.prose}>
                  ✓ {item.resolvedDef.content.tag}
                </span>
                <ExplorerLink boxId={item.boxId} liveTooltip="View network definition box" />
              {:else if item.boxId && !item.resolving}
                <span class="sif-net-status sif-net-warn">Not resolved</span>
              {/if}
            {/if}
            <button type="button" class="sif-remove" on:click={() => removeNetworkItem(i)}>×</button>
          </div>
        {/each}
        <div class="sif-net-actions">
          <button type="button" class="sif-add" on:click={addInlineNetwork}>+ Inline network</button>
          <button type="button" class="sif-add" on:click={addRefNetwork}>+ Reference network</button>
          <button type="button" class="sif-add sif-net-create" on:click={goToCreateNetwork}>+ Create new network definition</button>
        </div>
      </div>
    {/if}

  {:else}
    <!-- ── Metadata (JSON textarea) ──────────────────────────────────────── -->
    <label class="sif-label" for="sif-meta">Metadata JSON (name / description / tags)</label>
    <textarea id="sif-meta" class="sif-textarea sif-textarea-mono" rows="6" bind:value={metadataJson}></textarea>
  {/if}

  {#if error}<p class="sif-error">{error}</p>{/if}
  {#if submitTx}<p class="sif-ok">Published — tx <code>{submitTx.slice(0, 10)}…</code></p>{/if}

  {#if $walletConnected}
    <button class="sif-submit" type="button" on:click={handleSubmit} disabled={submitting}>
      {submitting ? 'Publishing…' : `Publish Service ${kind === 'data' ? 'Data' : 'Metadata'}`}
    </button>
  {:else}
    <WalletButton explorerUrl="https://explorer.ergoplatform.com" />
  {/if}
</div>

<!-- ── Network selector modal ─────────────────────────────────────────────── -->
{#if showNetworkSelector}
  <div class="sif-modal-overlay" on:click|self={() => (showNetworkSelector = false)}>
    <div class="sif-modal">
      <div class="sif-modal-header">
        <span class="sif-modal-title">Select a network definition</span>
        <button type="button" class="sif-modal-close" on:click={() => (showNetworkSelector = false)}>✕</button>
      </div>
      <input class="sif-input" bind:value={networkSearchQuery} placeholder="Search by tag or prose…" />
      <div class="sif-modal-list">
        {#if loadingNetworks}
          <p class="sif-hint">Loading network definitions…</p>
        {:else if filteredNetworks.length === 0}
          <p class="sif-hint">No network definitions found on-chain. <button type="button" class="sif-link" on:click={goToCreateNetwork}>Create one</button>.</p>
        {:else}
          {#each filteredNetworks as def}
            <button type="button" class="sif-net-option" on:click={() => selectNetwork(def)}>
              <span class="sif-net-option-tag">{def.content.tag}</span>
              <span class="sif-net-option-prose">{def.content.prose?.slice(0, 80)}{(def.content.prose?.length ?? 0) > 80 ? '…' : ''}</span>
              <code class="sif-net-option-id">{def.boxId.slice(0, 8)}…</code>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .service-info-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.85rem;
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.85rem;
    background: hsl(var(--muted) / 0.12);
  }
  .sif-kind {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }
  .sif-kind button {
    flex: 1;
    padding: 0.4rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: transparent;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .sif-kind button.active {
    background: hsl(var(--primary) / 0.15);
    border-color: hsl(var(--primary) / 0.5);
  }
  .sif-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.2rem;
  }
  .sif-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem 0;
    border-top: 1px solid hsl(var(--border) / 0.4);
  }
  .sif-input {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.85rem;
  }
  .sif-textarea {
    width: 100%;
    padding: 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.85rem;
    resize: vertical;
  }
  .sif-textarea-mono { font-family: ui-monospace, monospace; }
  .sif-toggle-row { display: flex; align-items: center; gap: 0.5rem; }
  .sif-toggle-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; cursor: pointer; }
  .sif-api-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 0.4rem;
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 0.6rem;
    margin-bottom: 0.3rem;
  }
  .sif-port { width: 5rem; flex-shrink: 0; }
  .sif-check-group { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .sif-check { display: flex; align-items: center; gap: 0.2rem; font-size: 0.78rem; cursor: pointer; }
  .sif-net-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 0.4rem;
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 0.6rem;
    margin-bottom: 0.3rem;
  }
  .sif-net-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.4rem;
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }
  .sif-net-badge-ref { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }
  .sif-net-tags, .sif-net-boxid { flex: 1; min-width: 8rem; }
  .sif-net-browse, .sif-net-status {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
  }
  .sif-net-ok { color: hsl(142 70% 45%); border-color: hsl(142 70% 45% / 0.4); }
  .sif-net-warn { color: hsl(var(--muted-foreground)); }
  .sif-net-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.25rem; }
  .sif-net-create { border-style: dashed; }
  .sif-add {
    font-size: 0.78rem;
    padding: 0.3rem 0.65rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: transparent;
    cursor: pointer;
  }
  .sif-remove {
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    cursor: pointer;
    font-size: 0.9rem;
    color: hsl(var(--muted-foreground));
  }
  .sif-remove:disabled { opacity: 0.4; cursor: default; }
  .sif-hint { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin: 0; }
  .sif-link { font-size: inherit; color: hsl(var(--primary)); background: none; border: none; cursor: pointer; text-decoration: underline; }
  .sif-error { font-size: 0.8rem; color: hsl(var(--destructive, 0 84% 60%)); margin: 0; }
  .sif-ok { font-size: 0.8rem; color: hsl(142 70% 45%); margin: 0; }
  .sif-submit {
    margin-top: 0.35rem;
    padding: 0.55rem;
    border-radius: 0.7rem;
    border: none;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 700;
    cursor: pointer;
  }
  .sif-submit:disabled { opacity: 0.6; cursor: default; }

  /* Network selector modal */
  .sif-modal-overlay {
    position: fixed;
    inset: 0;
    background: hsl(var(--background) / 0.85);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sif-modal {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 1rem;
    padding: 1.25rem;
    width: min(480px, 92vw);
    max-height: 70vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 8px 32px hsl(0 0% 0% / 0.18);
  }
  .sif-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sif-modal-title { font-weight: 700; font-size: 1rem; }
  .sif-modal-close {
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--border) / 0.6);
    background: transparent;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .sif-modal-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .sif-net-option {
    width: 100%;
    text-align: left;
    padding: 0.6rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.6);
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .sif-net-option:hover { background: hsl(var(--muted) / 0.3); }
  .sif-net-option-tag { font-size: 0.8rem; font-weight: 700; }
  .sif-net-option-prose { font-size: 0.78rem; color: hsl(var(--muted-foreground)); }
  .sif-net-option-id { font-family: ui-monospace, monospace; font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
</style>
