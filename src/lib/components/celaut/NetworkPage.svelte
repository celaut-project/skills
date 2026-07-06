<script lang="ts">
  /**
   * ?network=<box_id|"new"> — Reusable Network Definition management page.
   *
   * Shows a browseable list of on-chain Strict Definition (network kind) boxes,
   * lets the user create new ones and publish associated Trust Framework boxes,
   * and surfaces all trust frameworks for the currently selected network.
   */
  import { onMount, createEventDispatcher } from 'svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';
  import { demoMode } from '$lib/config';
  import {
    loadStrictDefinitions,
    loadTrustFrameworks,
    STRICT_DEFINITION_TYPE_ID
  } from '$lib/api';
  import { createStrictDefinition, createTrustFramework } from '$lib/data';
  import {
    makeNetworkDefinition,
    encodeStrictDefinitionR9,
    isNetworkDefinition
  } from '$lib/strictDefinition';
  import {
    TrustLevel,
    AccessLevel,
    encodeFrameworkR9,
    computeFrameworkScores
  } from '$lib/trustFramework';
  import type { StrictDefinitionBox, TrustFrameworkBox } from '$lib/types';
  import { networkPageReturn, serviceDataFormState, viewedNetworkId } from '$lib/stores';
  import ExplorerLink from './ExplorerLink.svelte';
  import InfoTip from './InfoTip.svelte';

  export let networkId: string = '';

  const dispatch = createEventDispatcher<{ back: void }>();

  // ── Page state ──────────────────────────────────────────────────────────────
  let networks: StrictDefinitionBox[] = [];
  let loading = false;
  let searchQuery = '';
  let selectedNetwork: StrictDefinitionBox | null = null;
  let selectedFrameworks: TrustFrameworkBox[] = [];
  let loadingFrameworks = false;

  // Create network form
  let showCreateForm = false;
  let networkSlug = '';
  let networkProse = '';
  let networkProtocol = '';
  let networkPeerDiscovery = '';
  let networkActionsRaw = '';
  let creatingNetwork = false;

  // Create trust framework form
  let showTfForm = false;
  let tfActions: Array<{ name: string; trust: TrustLevel; access: AccessLevel }> = [];
  let creatingTf = false;

  const TRUST_LABELS: Record<TrustLevel, string> = {
    [TrustLevel.TrustMinimized]: 'Trust-Minimized (1)',
    [TrustLevel.CryptoEconomic]: 'Crypto-Economic (2)',
    [TrustLevel.Fiduciary]: 'Fiduciary (3)'
  };
  const ACCESS_LABELS: Record<AccessLevel, string> = {
    [AccessLevel.VerifiableArtifact]: 'Verifiable Artifact (1)',
    [AccessLevel.CentralizedService]: 'Centralized Service (2)'
  };

  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  onMount(async () => {
    await loadNetworks();
    // If opened with a specific box id, auto-select it
    if (networkId && networkId !== 'new') {
      const match = networks.find(n => n.boxId === networkId);
      if (match) await selectNetwork(match);
    }
    if (networkId === 'new') showCreateForm = true;
  });

  async function loadNetworks() {
    loading = true;
    try {
      const all = await loadStrictDefinitions();
      networks = all.filter(d => isNetworkDefinition(d.content));
    } catch {
      networks = [];
      toasts.error('Failed to load network definitions.');
    } finally {
      loading = false;
    }
  }

  async function selectNetwork(def: StrictDefinitionBox) {
    selectedNetwork = def;
    viewedNetworkId.set(def.boxId);
    showCreateForm = false;
    showTfForm = false;
    loadingFrameworks = true;
    try {
      selectedFrameworks = await loadTrustFrameworks(def.boxId);
    } catch {
      selectedFrameworks = [];
    } finally {
      loadingFrameworks = false;
    }
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      u.searchParams.set('network', def.boxId);
      window.history.replaceState({}, '', u);
    }
  }

  $: filteredNetworks = searchQuery
    ? networks.filter(n =>
        (n.content.tag || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content.prose || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : networks;

  // ── Create network ──────────────────────────────────────────────────────────
  async function handleCreateNetwork() {
    if (!networkSlug.trim() || !networkProse.trim() || !networkProtocol.trim() || !networkPeerDiscovery.trim()) {
      toasts.error('All fields are required.');
      return;
    }
    const actions = networkActionsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (actions.length === 0) {
      toasts.error('At least one action is required.');
      return;
    }
    if (!$walletConnected && !$demoMode) {
      toasts.error('Connect your wallet first.');
      return;
    }
    creatingNetwork = true;
    try {
      const def = makeNetworkDefinition(networkSlug.trim(), networkProse.trim(), {
        protocol: networkProtocol.trim(),
        peerDiscovery: networkPeerDiscovery.trim(),
        actions
      });
      const content = encodeStrictDefinitionR9(def);
      await createStrictDefinition({ content, tokenAmount: 1, mainBox: currentMainBox() });
      toasts.success($demoMode ? 'Network definition created (demo mode).' : 'Network definition published on-chain.');
      networkSlug = networkProse = networkProtocol = networkPeerDiscovery = networkActionsRaw = '';
      showCreateForm = false;
      await loadNetworks();
    } catch (e: any) {
      toasts.error(e?.message || 'Failed to create network definition.');
    } finally {
      creatingNetwork = false;
    }
  }

  // ── Trust framework ─────────────────────────────────────────────────────────
  function initTfActions() {
    if (!selectedNetwork || !isNetworkDefinition(selectedNetwork.content)) return;
    const actions = selectedNetwork.content.formal.actions;
    tfActions = actions.map(name => ({
      name,
      trust: TrustLevel.TrustMinimized,
      access: AccessLevel.VerifiableArtifact
    }));
    showTfForm = true;
  }

  async function handleCreateTf() {
    if (!selectedNetwork || tfActions.length === 0) return;
    if (!$walletConnected && !$demoMode) { toasts.error('Connect your wallet first.'); return; }
    creatingTf = true;
    try {
      const content = encodeFrameworkR9(tfActions.map(a => ({ name: a.name, trust: a.trust, access: a.access })));
      await createTrustFramework({
        strictDefinitionBoxId: selectedNetwork.boxId,
        content,
        tokenAmount: 1,
        mainBox: currentMainBox()
      });
      toasts.success($demoMode ? 'Trust framework published (demo mode).' : 'Trust framework published on-chain.');
      showTfForm = false;
      selectedFrameworks = await loadTrustFrameworks(selectedNetwork.boxId);
    } catch (e: any) {
      toasts.error(e?.message || 'Failed to publish trust framework.');
    } finally {
      creatingTf = false;
    }
  }

  function handleBack() {
    const ret = $networkPageReturn;
    networkPageReturn.set(null);
    if (ret?.type === 'serviceForm') {
      viewedNetworkId.set(null);
      if (typeof window !== 'undefined') {
        const u = new URL(window.location.href);
        u.searchParams.delete('network');
        window.history.pushState({}, '', u);
      }
    }
    dispatch('back');
  }
</script>

<div class="np-container">
  <div class="np-header">
    <button class="back-button" type="button" on:click={handleBack}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      {$networkPageReturn?.type === 'serviceForm' ? 'Back to service form' : 'Back'}
    </button>
    <h1 class="np-title">Network Definitions</h1>
    <InfoTip title="What are network definitions?">
      <p>A <strong>Strict Definition</strong> (network kind) formally describes a reusable network — its protocol stack, peer-discovery mechanism, and the fundamental actions that can be assessed for trust.</p>
      <p>A <strong>Dependency Trust Framework</strong> pairs with a network definition to score each action on the Sigmaverse Quality Standard (Trust × Access axes).</p>
    </InfoTip>
  </div>

  <div class="np-layout">
    <!-- Left: network list -->
    <aside class="np-sidebar">
      <div class="np-sidebar-head">
        <input class="np-search" bind:value={searchQuery} placeholder="Search by tag or prose…" />
        <button type="button" class="np-create-btn" on:click={() => { showCreateForm = true; selectedNetwork = null; }}>
          + New
        </button>
      </div>
      {#if loading}
        <p class="np-empty">Loading…</p>
      {:else if filteredNetworks.length === 0}
        <p class="np-empty">No network definitions found{searchQuery ? ' matching your query' : ''}.</p>
      {:else}
        <ul class="np-list">
          {#each filteredNetworks as def}
            <li>
              <button
                type="button"
                class="np-list-item"
                class:np-list-item-active={selectedNetwork?.boxId === def.boxId}
                on:click={() => selectNetwork(def)}
              >
                <span class="np-list-tag">{def.content.tag}</span>
                <span class="np-list-prose">{def.content.prose?.slice(0, 60)}{(def.content.prose?.length ?? 0) > 60 ? '…' : ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <!-- Right: detail panel -->
    <main class="np-detail">
      {#if showCreateForm}
        <div class="np-card">
          <h2 class="np-card-title">Create network definition</h2>
          <div class="form-group">
            <label class="form-label" for="np-slug">Slug (kebab-case) <span class="text-red-500">*</span></label>
            <input id="np-slug" class="form-input" bind:value={networkSlug} placeholder="e.g. celaut-comm-domain" />
          </div>
          <div class="form-group">
            <label class="form-label" for="np-prose">Prose description <span class="text-red-500">*</span></label>
            <textarea id="np-prose" class="form-input form-textarea" rows="3" bind:value={networkProse} placeholder="Human-readable definition of this network."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="np-protocol">Protocol <span class="text-red-500">*</span></label>
            <input id="np-protocol" class="form-input" bind:value={networkProtocol} placeholder="e.g. grpc/celaut-v1" />
          </div>
          <div class="form-group">
            <label class="form-label" for="np-peer">Peer discovery <span class="text-red-500">*</span></label>
            <input id="np-peer" class="form-input" bind:value={networkPeerDiscovery} placeholder="e.g. environment_variable, dht, static" />
          </div>
          <div class="form-group">
            <label class="form-label" for="np-actions">Actions (comma-separated) <span class="text-red-500">*</span></label>
            <input id="np-actions" class="form-input" bind:value={networkActionsRaw} placeholder="peer-discovery, message-delivery, service-launch" />
            <p class="form-hint">These action names will be assessed in the Trust Framework.</p>
          </div>
          <div class="np-form-actions">
            <button type="button" class="submit-btn" on:click={handleCreateNetwork} disabled={creatingNetwork}>
              {creatingNetwork ? 'Publishing…' : 'Publish Network Definition'}
            </button>
            <button type="button" class="back-btn-sm" on:click={() => (showCreateForm = false)}>Cancel</button>
          </div>
        </div>

      {:else if selectedNetwork}
        <div class="np-card">
          <div class="np-detail-head">
            <div>
              <span class="np-detail-tag">{selectedNetwork.content.tag}</span>
              <ExplorerLink boxId={selectedNetwork.boxId} liveTooltip="View Strict Definition box on Explorer" />
            </div>
            <code class="np-detail-boxid">{selectedNetwork.boxId.slice(0, 12)}…</code>
          </div>
          <p class="np-detail-prose">{selectedNetwork.content.prose}</p>

          {#if isNetworkDefinition(selectedNetwork.content)}
            {@const spec = selectedNetwork.content.formal}
            <dl class="np-spec">
              <div class="np-spec-row">
                <dt>Protocol</dt><dd><code>{spec.protocol}</code></dd>
              </div>
              <div class="np-spec-row">
                <dt>Peer discovery</dt><dd><code>{spec.peerDiscovery}</code></dd>
              </div>
              <div class="np-spec-row">
                <dt>Actions</dt>
                <dd class="np-actions-list">
                  {#each spec.actions as action}
                    <span class="np-action-badge">{action}</span>
                  {/each}
                </dd>
              </div>
            </dl>
          {/if}
        </div>

        <!-- Trust frameworks for this network -->
        <div class="np-card">
          <div class="np-tf-header">
            <h2 class="np-card-title">Trust Frameworks</h2>
            <button type="button" class="np-tf-add" on:click={initTfActions}>+ Add Trust Framework</button>
          </div>

          {#if showTfForm && isNetworkDefinition(selectedNetwork.content)}
            <div class="np-tf-form">
              <h3 class="np-tf-form-title">New trust framework</h3>
              <p class="form-hint">Score each action on the Sigmaverse Quality Standard axes.</p>
              {#each tfActions as action, i}
                <div class="np-tf-action-row">
                  <span class="np-action-badge">{action.name}</span>
                  <label class="form-label-inline">Trust</label>
                  <select class="form-select" bind:value={tfActions[i].trust}>
                    {#each Object.entries(TRUST_LABELS) as [val, label]}
                      <option value={Number(val)}>{label}</option>
                    {/each}
                  </select>
                  <label class="form-label-inline">Access</label>
                  <select class="form-select" bind:value={tfActions[i].access}>
                    {#each Object.entries(ACCESS_LABELS) as [val, label]}
                      <option value={Number(val)}>{label}</option>
                    {/each}
                  </select>
                </div>
              {/each}
              {#if tfActions.length > 0}
                {@const scores = (() => { try { return computeFrameworkScores(tfActions); } catch { return null; } })()}
                {#if scores}
                  <div class="np-tf-scores">
                    Weakest link: <strong>{scores.weakestLink}</strong> &nbsp;·&nbsp; Average risk: <strong>{scores.averageRisk}</strong>
                  </div>
                {/if}
              {/if}
              <div class="np-form-actions">
                <button type="button" class="submit-btn" on:click={handleCreateTf} disabled={creatingTf}>
                  {creatingTf ? 'Publishing…' : 'Publish Trust Framework'}
                </button>
                <button type="button" class="back-btn-sm" on:click={() => (showTfForm = false)}>Cancel</button>
              </div>
            </div>
          {/if}

          {#if loadingFrameworks}
            <p class="np-empty">Loading trust frameworks…</p>
          {:else if selectedFrameworks.length === 0}
            <p class="np-empty">No trust frameworks published for this network yet.</p>
          {:else}
            {#each selectedFrameworks as tf}
              {@const scores = (() => { try { return computeFrameworkScores(tf.actions); } catch { return null; } })()}
              <div class="np-tf-card">
                <div class="np-tf-card-head">
                  <code class="np-tf-boxid">{tf.boxId.slice(0, 8)}…</code>
                  <ExplorerLink boxId={tf.boxId} liveTooltip="View Trust Framework box" />
                  {#if scores}
                    <span class="np-tf-score-badge">Weakest: {scores.weakestLink} · Avg: {scores.averageRisk}</span>
                  {/if}
                </div>
                <table class="np-tf-table">
                  <thead>
                    <tr><th>Action</th><th>Trust</th><th>Access</th></tr>
                  </thead>
                  <tbody>
                    {#each tf.actions as a}
                      <tr>
                        <td><code>{a.name ?? '—'}</code></td>
                        <td>{TRUST_LABELS[a.trust] ?? a.trust}</td>
                        <td>{ACCESS_LABELS[a.access] ?? a.access}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <div class="np-card np-empty-state">
          <p>Select a network definition from the list, or create a new one.</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style lang="postcss">
  .np-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .np-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .np-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
  .np-layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 1.25rem;
    align-items: start;
  }
  @media (max-width: 700px) { .np-layout { grid-template-columns: 1fr; } }

  /* Sidebar */
  .np-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.85rem;
    padding: 0.75rem;
    background: hsl(var(--muted) / 0.08);
  }
  .np-sidebar-head { display: flex; gap: 0.4rem; }
  .np-search {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.82rem;
  }
  .np-create-btn {
    padding: 0.4rem 0.7rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--primary) / 0.5);
    background: hsl(var(--primary) / 0.1);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .np-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .np-list-item {
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.65rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .np-list-item:hover { background: hsl(var(--muted) / 0.3); }
  .np-list-item-active { background: hsl(var(--primary) / 0.12); border-color: hsl(var(--primary) / 0.4); }
  .np-list-tag { font-size: 0.78rem; font-weight: 700; }
  .np-list-prose { font-size: 0.73rem; color: hsl(var(--muted-foreground)); }

  /* Detail cards */
  .np-detail { display: flex; flex-direction: column; gap: 1rem; }
  .np-card {
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 0.9rem;
    padding: 1.1rem;
    background: hsl(var(--muted) / 0.06);
  }
  .np-card-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem; }
  .np-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .np-detail-tag { font-size: 0.9rem; font-weight: 800; background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); padding: 0.2rem 0.6rem; border-radius: 0.4rem; margin-right: 0.35rem; }
  .np-detail-boxid { font-family: ui-monospace, monospace; font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
  .np-detail-prose { font-size: 0.88rem; color: hsl(var(--foreground)); margin: 0.5rem 0 0.75rem; }

  .np-spec { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
  .np-spec-row { display: flex; gap: 0.75rem; align-items: baseline; }
  .np-spec-row dt { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: hsl(var(--muted-foreground)); min-width: 8rem; }
  .np-spec-row dd { margin: 0; font-size: 0.85rem; }
  .np-actions-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .np-action-badge { font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 0.4rem; background: hsl(var(--muted) / 0.4); font-family: ui-monospace, monospace; }

  /* Trust framework */
  .np-tf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .np-tf-add { font-size: 0.8rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; border: 1px solid hsl(var(--border)); background: transparent; cursor: pointer; }
  .np-tf-form { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border: 1px dashed hsl(var(--border) / 0.6); border-radius: 0.7rem; margin-bottom: 0.75rem; }
  .np-tf-form-title { font-weight: 700; font-size: 0.88rem; margin: 0; }
  .np-tf-action-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .np-tf-scores { font-size: 0.78rem; color: hsl(var(--muted-foreground)); padding: 0.35rem 0; }
  .np-tf-card { border: 1px solid hsl(var(--border) / 0.5); border-radius: 0.7rem; padding: 0.75rem; margin-bottom: 0.6rem; }
  .np-tf-card-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .np-tf-boxid { font-family: ui-monospace, monospace; font-size: 0.75rem; }
  .np-tf-score-badge { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 0.4rem; background: hsl(var(--muted) / 0.4); margin-left: auto; }
  .np-tf-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .np-tf-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: hsl(var(--muted-foreground)); padding: 0.25rem 0.4rem; border-bottom: 1px solid hsl(var(--border) / 0.4); }
  .np-tf-table td { padding: 0.3rem 0.4rem; }

  .np-empty { font-size: 0.85rem; color: hsl(var(--muted-foreground)); text-align: center; padding: 1.5rem 0; }
  .np-empty-state { text-align: center; }

  /* Shared form styles */
  .form-group { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
  .form-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: hsl(var(--muted-foreground)); }
  .form-label-inline { font-size: 0.72rem; font-weight: 700; color: hsl(var(--muted-foreground)); }
  .form-input {
    padding: 0.45rem 0.65rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.85rem;
    width: 100%;
  }
  .form-textarea { resize: vertical; font-family: inherit; }
  .form-select {
    padding: 0.35rem 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.8rem;
  }
  .form-hint { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin: 0; }
  .np-form-actions { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
  .submit-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.6rem;
    border: none;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .submit-btn:disabled { opacity: 0.6; cursor: default; }
  .back-btn-sm {
    font-size: 0.82rem;
    padding: 0.45rem 0.8rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background: transparent;
    cursor: pointer;
  }
  .back-button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    padding: 0.4rem 0.8rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.7);
    background: transparent;
    cursor: pointer;
  }
</style>
