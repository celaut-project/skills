<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { createCoverage } from '$lib/data';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';
  import { portal } from '$lib/actions/portal';

  export let skillBoxId: string = '';
  /**
   * When set, the coverage targets a BENCHMARK instead of the skill directly:
   * the user suggests a service that tests the skill following this benchmark's
   * specification. `skillBoxId` is still passed through as the parent skill.
   */
  export let benchmarkId: string = '';
  /** Button label — defaults differ slightly between skill and benchmark mode. */
  export let label: string = '';

  $: benchmarkMode = !!benchmarkId;
  $: btnLabel = label || (benchmarkMode ? 'Suggest Service' : 'Claim Coverage');

  const dispatch = createEventDispatcher<{ created: { txId: string } }>();
  let showTooltip = false;
  let submitting = false;

  // The coverage's service id is provided by the user via the modal form, NOT
  // derived from the wallet address. A coverage asserts that a specific service
  // (by its id) covers the skill — that id belongs to the service, not the
  // claimant.
  let showModal = false;
  let serviceId = '';

  /** Open the claim modal (after the cheap wallet/skill guards). */
  function openModal() {
    if (!$walletConnected) {
      toasts.error('Connect wallet to claim coverage.');
      return;
    }
    if (!benchmarkMode && !skillBoxId) {
      toasts.error('Select a skill first.');
      return;
    }
    if (benchmarkMode && !benchmarkId) {
      toasts.error('Select a benchmark first.');
      return;
    }
    serviceId = '';
    showModal = true;
  }

  function closeModal() {
    if (submitting) return;
    showModal = false;
    serviceId = '';
  }

  async function submitClaim() {
    const trimmedServiceId = serviceId.trim();
    if (!trimmedServiceId) {
      toasts.error('Enter the service id you are claiming coverage for.');
      return;
    }
    if (!$reputation_proof || !getMainReputationBox($reputation_proof)) {
      toasts.error('Create a reputation profile first.');
      return;
    }

    submitting = true;
    try {
      const txId = await createCoverage({
        skillBoxId,
        benchmarkId: benchmarkMode ? benchmarkId : undefined,
        serviceId: trimmedServiceId,
        tokenAmount: 1,
        mainBox: getMainReputationBox($reputation_proof)
      });

      toasts.success($demoMode ? 'Coverage claimed (demo mode).' : 'Coverage published on-chain.');
      submitting = false;
      showModal = false;
      serviceId = '';
      dispatch('created', { txId });
    } catch (error: any) {
      toasts.error(error?.message || 'Coverage submission failed.');
      submitting = false;
    }
  }
</script>

<div class="claim-wrapper">
  <button
    class="claim-btn"
    class:claim-btn-active={$walletConnected}
    disabled={!$walletConnected || submitting}
    on:click={openModal}
    on:mouseenter={() => showTooltip = true}
    on:mouseleave={() => showTooltip = false}
    on:focus={() => showTooltip = true}
    on:blur={() => showTooltip = false}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    {btnLabel}
  </button>
  {#if showTooltip && !$walletConnected}
    <div class="claim-tooltip">Connect wallet to claim coverage</div>
  {/if}
</div>

{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="claim-modal-backdrop" use:portal on:click={closeModal}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="claim-modal-content" on:click|stopPropagation role="dialog" aria-modal="true" aria-label={benchmarkMode ? 'Suggest service for benchmark' : 'Claim coverage'}>
      <div class="claim-modal-header">
        <h3 class="claim-modal-title">{benchmarkMode ? 'Suggest Service for Benchmark' : 'Claim Coverage'}</h3>
        <button class="claim-modal-close" on:click={closeModal} disabled={submitting} aria-label="Close">✕</button>
      </div>
      <p class="claim-modal-desc">
        {#if benchmarkMode}
          Enter the <strong>service id</strong> of a service that tests this skill
          following this benchmark's specification. The coverage names the
          service — not your wallet.
        {:else}
          Enter the <strong>service id</strong> that covers this skill. The coverage
          names the service — not your wallet.
        {/if}
      </p>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="claim-service-input"
        type="text"
        bind:value={serviceId}
        placeholder="Service id (hex)"
        disabled={submitting}
        spellcheck="false"
        autocomplete="off"
        autofocus
        on:keydown={(e) => { if (e.key === 'Enter') submitClaim(); }}
      />
      <div class="claim-modal-actions">
        <button class="claim-modal-cancel" on:click={closeModal} disabled={submitting}>Cancel</button>
        <button class="claim-modal-submit" on:click={submitClaim} disabled={submitting || !serviceId.trim()}>
          {#if submitting}Claiming…{:else}{btnLabel}{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .claim-wrapper {
    position: relative;
    display: inline-flex;
  }

  /* ── Claim modal ──────────────────────────────────────────────────────── */
  .claim-modal-backdrop {
    position: fixed;
    inset: 0;
    /* Above the sticky navbar (z-50), forum rail (z-90) and toasts (z-100);
       paired with use:portal so no ancestor stacking context can trap it. */
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
  }

  .claim-modal-content {
    width: 100%;
    max-width: 28rem;
    border-radius: 0.875rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    padding: 1.25rem 1.25rem 1rem;
  }

  .claim-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .claim-modal-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    margin: 0;
  }

  .claim-modal-close {
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    font-size: 1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem;
  }

  .claim-modal-close:hover:not(:disabled) {
    color: hsl(var(--foreground));
  }

  .claim-modal-desc {
    font-size: 0.85rem;
    color: hsl(var(--muted-foreground));
    margin: 0 0 0.875rem;
    line-height: 1.5;
  }

  .claim-service-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .claim-service-input::placeholder {
    color: hsl(var(--muted-foreground));
    font-family: inherit;
  }

  .claim-service-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .claim-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .claim-modal-cancel,
  .claim-modal-submit {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid hsl(var(--border));
  }

  .claim-modal-cancel {
    background-color: transparent;
    color: hsl(var(--muted-foreground));
  }

  .claim-modal-cancel:hover:not(:disabled) {
    background-color: hsl(var(--muted) / 0.5);
  }

  .claim-modal-submit {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary) / 0.85);
  }

  .claim-modal-submit:hover:not(:disabled) {
    background-color: hsl(var(--primary) / 0.85);
  }

  .claim-modal-submit:disabled,
  .claim-modal-cancel:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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
    transition: all 0.2s ease;
  }

  .claim-btn-active {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary) / 0.85);
    cursor: pointer;
    opacity: 1;
  }

  .claim-btn-active:hover {
    background-color: hsl(var(--primary) / 0.85);
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
