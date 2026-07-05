<script lang="ts">
  /**
   * Publish a Service Data or Service Metadata opinion for a service id.
   *
   * R9 payload (both types):
   *  - paste an inline JSON object, or
   *  - paste a blake2b256 hash → the content is resolved from `sources` (source mode,
   *    detected automatically by the payload being a hash string).
   *
   * Service Data is expected to hold `container` / `api` / `network`; Service
   * Metadata is arbitrary JSON. Both are opinions carrying skin-in-the-game
   * reputation, so consumers can weight competing assertions.
   */
  import { WalletButton, walletConnected } from 'wallet-svelte-component';
  import { toasts } from './toastStore';
  import { createServiceData, createServiceMetadata } from '$lib/data';
  import { looksLikeBlake2bHash } from '$lib/api';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';
  import { createEventDispatcher } from 'svelte';

  export let serviceId = '';

  const dispatch = createEventDispatcher<{ published: { txId: string; kind: 'data' | 'metadata' } }>();

  const DATA_PLACEHOLDER = `{
  "container": { "architecture": "linux/amd64" },
  "api": [{ "port": 8080, "transport": ["tcp"], "protocol": ["http"] }],
  "network": [{ "tags": ["public", "ipv4"] }]
}`;
  const META_PLACEHOLDER = `{
  "name": "My service",
  "description": "What it does",
  "tags": ["ai", "vision"]
}`;

  let kind: 'data' | 'metadata' = 'data';
  let payload = '';
  let submitting = false;
  let submitTx: string | null = null;
  let error: string | null = null;

  $: isHashMode = looksLikeBlake2bHash(payload.trim());
  $: placeholder = kind === 'data' ? DATA_PLACEHOLDER : META_PLACEHOLDER;

  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  /** Return the R9 content (hash string or parsed object), or throw on bad JSON. */
  function buildContent(): Record<string, unknown> | string {
    const trimmed = payload.trim();
    if (looksLikeBlake2bHash(trimmed)) return trimmed;
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload must be a JSON object or a blake2b256 hash.');
    }
    return parsed as Record<string, unknown>;
  }

  async function handleSubmit() {
    error = null;
    submitTx = null;
    if (!$walletConnected) {
      error = 'Connect your wallet first.';
      toasts.error(error);
      return;
    }
    if (!serviceId.trim()) {
      error = 'Service id is required.';
      return;
    }
    let content: Record<string, unknown> | string;
    try {
      content = buildContent();
    } catch (e: any) {
      error = e?.message || 'Invalid JSON payload.';
      toasts.error(error ?? 'Invalid JSON payload.');
      return;
    }

    submitting = true;
    try {
      const input = {
        serviceId: serviceId.trim(),
        content,
        tokenAmount: 1,
        mainBox: currentMainBox()
      };
      const txId = kind === 'data'
        ? await createServiceData(input)
        : await createServiceMetadata(input);
      submitTx = txId;
      toasts.success(
        $demoMode
          ? `Service ${kind} submitted (demo mode).`
          : `Service ${kind} published on-chain.`
      );
      dispatch('published', { txId, kind });
      payload = '';
    } catch (e: any) {
      error = e?.message || 'Submission failed.';
      toasts.error(error ?? 'Submission failed.');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="service-info-form">
  <div class="sif-kind">
    <button class:active={kind === 'data'} type="button" on:click={() => (kind = 'data')}>Service Data</button>
    <button class:active={kind === 'metadata'} type="button" on:click={() => (kind = 'metadata')}>Service Metadata</button>
  </div>

  <label class="sif-label" for="sif-payload">
    R9 payload — JSON object{kind === 'data' ? ' (container / api / network)' : ' (any JSON)'} or a blake2b256 hash
  </label>
  <textarea id="sif-payload" class="sif-textarea" rows="7" bind:value={payload} {placeholder}></textarea>
  {#if isHashMode}
    <p class="sif-hint">Detected a hash → published in <strong>source mode</strong> (content resolved from sources).</p>
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
  }
  .sif-input,
  .sif-textarea {
    width: 100%;
    padding: 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid hsl(var(--border) / 0.8);
    background: hsl(var(--background));
    font-size: 0.85rem;
  }
  .sif-textarea {
    font-family: ui-monospace, monospace;
    resize: vertical;
  }
  .sif-hint {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin: 0;
  }
  .sif-error {
    font-size: 0.8rem;
    color: hsl(var(--destructive, 0 84% 60%));
    margin: 0;
  }
  .sif-ok {
    font-size: 0.8rem;
    color: hsl(142 70% 45%);
    margin: 0;
  }
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
  .sif-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
