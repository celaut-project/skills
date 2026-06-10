<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { walletConnected, walletAddress } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { createCoverage } from '$lib/data';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';

  export let skillBoxId: string = '';
  export let skillName: string = '';

  const dispatch = createEventDispatcher<{ created: { txId: string } }>();
  let showTooltip = false;
  let submitting = false;

  function truncateAddress(value: string): string {
    if (!value) return '';
    if (value.length <= 12) return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
  }

  async function handleClaim() {
    if (!$walletConnected) {
      toasts.error('Connect wallet to claim coverage.');
      return;
    }
    if (!skillBoxId) {
      toasts.error('Select a skill first.');
      return;
    }

    submitting = true;
    try {
      const serviceId = $walletAddress || undefined;
      const label = skillName
        ? `${skillName} by ${truncateAddress($walletAddress || 'wallet')}`
        : `Coverage by ${truncateAddress($walletAddress || 'wallet')}`;

      const txId = await createCoverage({
        skillBoxId,
        serviceId,
        label,
        author: $walletAddress || 'wallet',
        tokenAmount: $demoMode ? 1 : 1,
        mainBox: getMainReputationBox($reputation_proof)
      });

      toasts.success($demoMode ? 'Coverage claimed (demo mode).' : 'Coverage published on-chain.');
      dispatch('created', { txId });
    } catch (error: any) {
      toasts.error(error?.message || 'Coverage submission failed.');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="claim-wrapper">
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
    transition: all 0.2s ease;
  }

  .claim-btn-active {
    background-color: hsl(142 50% 42%);
    color: white;
    border-color: hsl(142 50% 38%);
    cursor: pointer;
    opacity: 1;
  }

  .claim-btn-active:hover {
    background-color: hsl(142 50% 38%);
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
