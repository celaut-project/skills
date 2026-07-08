<script lang="ts">
  /**
   * NetworkPage — Reusable Network Definition management page.
   *
   * Delegates to focused sub-components for sidebar browsing,
   * network detail display, creation forms, and trust framework management.
   * Uses an 8px spacing system throughout for visual consistency.
   */
  import { onMount, createEventDispatcher } from 'svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';
  import { demoMode } from '$lib/config';
  import {
    loadStrictDefinitions,
    loadTrustFrameworks
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
  import { networkPageReturn, viewedNetworkId } from '$lib/stores';
  import BackButton from './BackButton.svelte';
  import InfoTip from './InfoTip.svelte';
  import NetworkSidebar from './network/NetworkSidebar.svelte';
  import NetworkDetail from './network/NetworkDetail.svelte';
  import NetworkCreateForm from './network/NetworkCreateForm.svelte';
  import TrustFrameworkSection from './network/TrustFrameworkSection.svelte';

  export let networkId: string = '';

  const dispatch = createEventDispatcher<{ back: void }>();

  // ── Page state ──────────────────────────────────────────────────────────────
  let networks: StrictDefinitionBox[] = [];
  let loading = false;
  let searchQuery = '';
  let selectedNetwork: StrictDefinitionBox | null = null;
  let selectedFrameworks: TrustFrameworkBox[] = [];
  let loadingFrameworks = false;
  let showCreateForm = false;

  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  onMount(async () => {
    await loadNetworks();
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
    loadingFrameworks = true;
    try {
      selectedFrameworks = await loadTrustFrameworks(def.boxId);
    } catch {
      selectedFrameworks = [];
    } finally {
      loadingFrameworks = false;
    }
    updateUrl(def.boxId);
  }

  function updateUrl(boxId: string) {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    u.searchParams.set('network', boxId);
    window.history.replaceState({}, '', u);
  }

  function clearUrl() {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    u.searchParams.delete('network');
    window.history.pushState({}, '', u);
  }

  // ── Create network ──────────────────────────────────────────────────────────
  async function handleCreateNetwork(formData: {
    slug: string;
    prose: string;
    protocol: string;
    peerDiscovery: string;
    actions: Record<string, string>;
  }) {
    if (!$walletConnected && !$demoMode) {
      toasts.error('Connect your wallet first.');
      return;
    }
    try {
      const def = makeNetworkDefinition(formData.slug, formData.prose, {
        protocol: formData.protocol,
        peerDiscovery: formData.peerDiscovery,
        actions: formData.actions
      });
      const content = encodeStrictDefinitionR9(def);
      await createStrictDefinition({ content, tokenAmount: 1, mainBox: currentMainBox() });
      toasts.success($demoMode ? 'Network definition created (demo mode).' : 'Network definition published on-chain.');
      showCreateForm = false;
      await loadNetworks();
    } catch (e: any) {
      toasts.error(e?.message || 'Failed to create network definition.');
    }
  }

  // ── Trust framework creation ────────────────────────────────────────────────
  async function handleCreateTf(actions: Array<{ name: string; trust: TrustLevel; access: AccessLevel }>) {
    if (!selectedNetwork || actions.length === 0) return;
    if (!$walletConnected && !$demoMode) {
      toasts.error('Connect your wallet first.');
      return;
    }
    try {
      const content = encodeFrameworkR9(
        actions.map(a => ({ name: a.name, trust: a.trust, access: a.access }))
      );
      await createTrustFramework({
        strictDefinitionBoxId: selectedNetwork.boxId,
        content,
        tokenAmount: 1,
        mainBox: currentMainBox()
      });
      toasts.success($demoMode ? 'Trust framework published (demo mode).' : 'Trust framework published on-chain.');
      selectedFrameworks = await loadTrustFrameworks(selectedNetwork.boxId);
      return true;
    } catch (e: any) {
      toasts.error(e?.message || 'Failed to publish trust framework.');
      return false;
    }
  }

  function handleBack() {
    const ret = $networkPageReturn;
    networkPageReturn.set(null);
    if (ret?.type === 'serviceForm') {
      viewedNetworkId.set(null);
      clearUrl();
    }
    dispatch('back');
  }

  $: filteredNetworks = searchQuery
    ? networks.filter(n =>
        (n.content.tag || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content.prose || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : networks;
</script>

<div class="np-page">
  <!-- Page header: back nav, title, contextual help -->
  <header class="np-header">
      <BackButton
          label={$networkPageReturn?.type === 'serviceForm'
              ? 'Back to service form'
              : 'Back'}
          on:click={handleBack}
      />

      <h1 class="np-title">
          Network Definitions

          <InfoTip title="What are network definitions?">
              A service specification declares the communication domains a service depends on. These networks may represent anything from storage systems and distributed ledgers to peer-to-peer overlays or specific on-chain protocols.
          </InfoTip>
      </h1>
  </header>

  <!-- Two-column layout: sidebar + detail -->
  <div class="np-layout">
    <NetworkSidebar
      networks={filteredNetworks}
      loading={loading}
      searchQuery={searchQuery}
      selectedBoxId={selectedNetwork?.boxId ?? null}
      on:search={(e) => searchQuery = e.detail}
      on:select={(e) => selectNetwork(e.detail)}
      on:create={() => { showCreateForm = true; selectedNetwork = null; }}
    />

    <main class="np-main">
      {#if showCreateForm}
        <NetworkCreateForm
          on:submit={(e) => handleCreateNetwork(e.detail)}
          on:cancel={() => (showCreateForm = false)}
        />

      {:else if selectedNetwork}
        <NetworkDetail network={selectedNetwork} />

        <TrustFrameworkSection
          network={selectedNetwork}
          {selectedFrameworks}
          {loadingFrameworks}
          on:create={(e) => handleCreateTf(e.detail)}
        />

      {:else}
        <!-- Empty state when nothing is selected -->
        <div class="np-empty-state">
          <div class="np-empty-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <p class="np-empty-text">Select a network definition from the list, or create a new one.</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style lang="postcss">
  /* ────────────────────────────────────────────────────────────────
   * Page
   * Mirrors ServicePage.svelte for visual consistency.
   * ──────────────────────────────────────────────────────────────── */

  .np-page {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 100%;
  }

  /* ────────────────────────────────────────────────────────────────
   * Header
   * Same layout pattern as ServicePage.
   * ──────────────────────────────────────────────────────────────── */

  .np-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .np-title {
    margin: 0;

    display: flex;
    align-items: center;
    gap: 0.5rem;

    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1.2;

    color: hsl(var(--foreground));
  }

  /* Keep the help icon aligned with the title */
  .np-header :global(.info-tip) {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* ────────────────────────────────────────────────────────────────
   * Layout
   * ──────────────────────────────────────────────────────────────── */

  .np-layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .np-main {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  /* ────────────────────────────────────────────────────────────────
   * Empty state
   * ──────────────────────────────────────────────────────────────── */

  .np-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    padding: 5rem 2rem;

    border: 1px dashed hsl(var(--border) / 0.5);
    border-radius: 0.75rem;

    background: hsl(var(--muted) / 0.03);
  }

  .np-empty-icon {
    color: hsl(var(--muted-foreground) / 0.4);
    margin-bottom: 1rem;
  }

  .np-empty-text {
    margin: 0;
    max-width: 18rem;

    text-align: center;
    line-height: 1.5;

    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
  }

  /* ────────────────────────────────────────────────────────────────
   * Responsive
   * ──────────────────────────────────────────────────────────────── */

  @media (max-width: 900px) {
    .np-page {
      padding: 1rem;
    }

    .np-layout {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  @media (max-width: 640px) {
    .np-page {
      padding: 0.75rem;
    }

    .np-title {
      font-size: 1.2rem;
    }
  }
</style>