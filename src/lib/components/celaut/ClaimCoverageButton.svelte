<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { createCoverage } from '$lib/data';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';

  export let skillBoxId: string = '';

  const dispatch = createEventDispatcher<{ created: { txId: string } }>();
  let showTooltip = false;
  let submitting = false;

  // The coverage's service id is provided by the user, NOT derived from the
  // wallet address. A coverage asserts that a specific service (by its id)
  // covers the skill — that id belongs to the service, not to the claimant.
  let serviceId = '';

  async function handleClaim() {
    if (!$walletConnected) {
      toasts.error('Connect wallet to claim coverage.');
      return;
    }
    if (!skillBoxId) {
      toasts.error('Select a skill first.');
      return;
    }
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
        serviceId: trimmedServiceId,
        tokenAmount: 1,
        mainBox: getMainReputationBox($reputation_proof)
      });

      toasts.success($demoMode ? 'Coverage claimed (demo mode).' : 'Coverage published on-chain.');
      serviceId = '';
      dispatch('created', { txId });
    } catch (error: any) {
      toasts.error(error?.message || 'Coverage submission failed.');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="claim-wrapper">
  <input
    class="claim-service-input"
    type="text"
    bind:value={serviceId}
    placeholder="Service id to cover"
    disabled={!$walletConnected || submitting}
    spellcheck="false"
    autocomplete="off"
    on:keydown={(e) => { if (e.key === 'Enter') handleClaim(); }}
  />
  <button
    class="claim-btn"
    class:claim-btn-active={$walletConnected}
    disabled={!$walletConnected || submitting}
    on:click={handleClaim}
    on:mouseenter={() => showTooltip = true}
    on:mouseleave={() => showTooltip = false}
    on:focus={() => showTooltip = true}
    on:blur={() => showTooltip = false}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    {#if submitting}
      Claiming...
    {:else}
      Claim Coverage
    {/if}
  </button>
  {#if showTooltip && !$walletConnected}
    <div class="claim-tooltip">Connect wallet to claim coverage</div>
  {/if}
</div>

<style lang="postcss">
  .claim-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .claim-service-input {
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    min-width: 14rem;
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
