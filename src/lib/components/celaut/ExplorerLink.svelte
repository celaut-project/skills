<script lang="ts" context="module">
  /**
   * Module-level cache of boxId → creating-transaction id. ExplorerLink is
   * rendered many times (leaderboards, coverage lists), so we de-dupe lookups
   * across every instance for the lifetime of the page. `null` = looked up but
   * unresolved; a string = resolved tx id.
   */
  const txCache = new Map<string, string | null>();
  const inflight = new Map<string, Promise<string | null>>();

  /** Resolve the transaction that *created* a box via the Explorer API. */
  async function resolveCreatingTx(boxId: string, apiBase: string): Promise<string | null> {
    if (txCache.has(boxId)) return txCache.get(boxId) ?? null;
    const pending = inflight.get(boxId);
    if (pending) return pending;

    const p = (async () => {
      try {
        const base = apiBase.replace(/\/+$/, '');
        const res = await fetch(`${base}/api/v1/boxes/${boxId}`);
        if (!res.ok) {
          txCache.set(boxId, null);
          return null;
        }
        const data = await res.json();
        // Explorer v1 box payload exposes the creating tx as `transactionId`.
        const tx: string | null = typeof data?.transactionId === 'string' ? data.transactionId : null;
        txCache.set(boxId, tx);
        return tx;
      } catch {
        txCache.set(boxId, null);
        return null;
      } finally {
        inflight.delete(boxId);
      }
    })();

    inflight.set(boxId, p);
    return p;
  }
</script>

<script lang="ts">
  /**
   * "View on Ergo Explorer" link for a single boxId. Renders as a discreet
   * external-link icon — clickable when the boxId looks like a real on-chain
   * hex id, disabled (with a "demo box — no on-chain reference" tooltip)
   * otherwise so the affordance stays consistent in demo mode.
   *
   * The link points at the **transaction that created the box** (the box's
   * creating tx is permanent, whereas a spent box can 404 on some explorers).
   * Callers only pass a `boxId`, so we look the creating tx up lazily via the
   * Explorer API (`explorer_uri` store) and cache it module-wide. Until that
   * resolves — or if it fails / runs offline — we fall back to the box page so
   * the link is always useful. A caller can also pass `txId` directly to skip
   * the lookup entirely.
   *
   * The base URLs come from the user-configurable `web_explorer_uri_*` stores
   * so power users can point at any explorer (ergoplatform, a private node…).
   */
  import { onMount } from 'svelte';
  import { web_explorer_uri_box, web_explorer_uri_tx, explorer_uri } from '$lib/common/store';

  export let boxId: string | undefined | null = '';
  /**
   * Optional creating-transaction id. When provided we link straight to it and
   * skip the Explorer lookup.
   */
  export let txId: string | undefined | null = '';
  /** Override what shows in the disabled-state tooltip. */
  export let demoMessage: string = 'Demo box — no on-chain reference yet.';
  /** Override the live-state tooltip. */
  export let liveTooltip: string = 'View the creating transaction on the Ergo Explorer';

  const isHexId = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9a-fA-F]{32,}$/.test(v);

  /** Creating tx resolved from the Explorer API (null until looked up). */
  let resolvedTxId: string | null = null;

  $: isRealBoxId = isHexId(boxId);
  $: isRealTxId = isHexId(txId);
  $: effectiveTxId = isRealTxId ? (txId as string) : resolvedTxId;

  // Prefer the (permanent) transaction link; fall back to the box page while the
  // creating tx is still resolving or if it can't be determined.
  $: href = effectiveTxId
    ? `${$web_explorer_uri_tx}${effectiveTxId}`
    : isRealBoxId
      ? `${$web_explorer_uri_box}${boxId}`
      : '';
  $: hasLink = !!effectiveTxId || isRealBoxId;
  $: resolvedTooltip = effectiveTxId
    ? liveTooltip
    : 'View this box on the Ergo Explorer';

  onMount(() => {
    // Only fetch when we have a real box but no explicit tx id.
    if (isRealBoxId && !isRealTxId) {
      resolveCreatingTx(boxId as string, $explorer_uri).then((tx) => {
        if (tx) resolvedTxId = tx;
      });
    }
  });
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
