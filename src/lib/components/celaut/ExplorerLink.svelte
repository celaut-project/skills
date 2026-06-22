<script lang="ts">
  /**
   * "View on Ergo Explorer" link for a single boxId. Renders as a discreet
   * external-link icon — clickable when the boxId looks like a real on-chain
   * hex id, disabled (with a "demo box — no on-chain reference" tooltip)
   * otherwise so the affordance stays consistent in demo mode.
   *
   * The base URL comes from the user-configurable `web_explorer_uri_box`
   * store so power users can point at any explorer (sigmaspace, ergoplatform,
   * a private node, etc.).
   */
  import { web_explorer_uri_box, web_explorer_uri_tx } from '$lib/common/store';

  export let boxId: string | undefined | null = '';
  /**
   * Optional creating-transaction id. A spent box can 404 on some explorers,
   * whereas its transaction is permanent — when no valid boxId is available we
   * fall back to deep-linking the transaction instead (ergoplatform /en/transaction/).
   */
  export let txId: string | undefined | null = '';
  /** Override what shows in the disabled-state tooltip. */
  export let demoMessage: string = 'Demo box — no on-chain reference yet.';
  /** Override the live-state tooltip. */
  export let liveTooltip: string = 'View this box on the Ergo Explorer';

  const isHexId = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9a-fA-F]{32,}$/.test(v);

  $: isRealBoxId = isHexId(boxId);
  $: isRealTxId = isHexId(txId);
  // Prefer the (stable) box link; fall back to the transaction link so spent
  // boxes still resolve to something on-chain.
  $: href = isRealBoxId
    ? `${$web_explorer_uri_box}${boxId}`
    : isRealTxId
      ? `${$web_explorer_uri_tx}${txId}`
      : '';
  $: hasLink = isRealBoxId || isRealTxId;
  $: resolvedTooltip = isRealBoxId ? liveTooltip : 'View the creating transaction on the Ergo Explorer';
</script>

{#if hasLink}
  <a class="explorer-link" href={href} target="_blank" rel="noopener noreferrer" title={resolvedTooltip}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  </a>
{:else if boxId || txId}
  <span class="explorer-link explorer-link-disabled" title={demoMessage} aria-disabled="true">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  </span>
{/if}

<style lang="postcss">
  .explorer-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
    border-radius: 0.1875rem;
    color: hsl(var(--muted-foreground));
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }
  .explorer-link:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.4);
  }
  .explorer-link-disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .explorer-link-disabled:hover {
    background: none;
    color: hsl(var(--muted-foreground));
  }
</style>
