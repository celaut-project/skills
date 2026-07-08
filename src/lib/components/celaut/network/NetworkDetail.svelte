<script lang="ts">
  /**
   * NetworkDetail — Displays the selected network definition's metadata.
   *
   * Uses a structured layout with clear label/value hierarchy,
   * normalized action chips, and an Explorer link.
   */
  import type { StrictDefinitionBox } from '$lib/types';
  import { isNetworkDefinition } from '$lib/strictDefinition';
  import ExplorerLink from '../ExplorerLink.svelte';
  import InfoTip from '../InfoTip.svelte';
  import DetailDialog from './DetailDialog.svelte';

  export let network: StrictDefinitionBox;

  let showDialog = false;

  // Action entries as [name, description] pairs for iteration.
  $: actionEntries = isNetworkDefinition(network.content)
    ? Object.entries(network.content.formal.actions)
    : [];
</script>

<article class="detail-card">
  <!-- Header: tag, explorer link, box ID -->
  <div class="detail-card__header">
    <div class="detail-card__title-row">
      <span class="detail-card__tag">{network.content.tag}</span>
      <ExplorerLink
        boxId={network.boxId}
        liveTooltip="View Strict Definition box on Explorer"
      />
      <InfoTip title="What is a network definition?">
        <p>
          A <strong>network definition</strong> is a brand-free Strict Definition
          that pins down one communication domain a service can reach — its
          protocol, how peers are discovered, and the fundamental actions
          performed on it.
        </p>
        <p>
          Each action is later scored for trust &amp; access by a
          <strong>Trust Framework</strong> below.
        </p>
      </InfoTip>
    </div>
    <div class="detail-card__header-right">
      <button type="button" class="detail-card__details-btn" on:click={() => (showDialog = true)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Details
      </button>
      <code class="detail-card__box-id">{network.boxId}</code>
    </div>
  </div>

  <!-- Prose description -->
  {#if network.content.prose}
    <p class="detail-card__prose">{network.content.prose}</p>
  {/if}

  <!-- Formal specification -->
  {#if isNetworkDefinition(network.content)}
    {@const spec = network.content.formal}
    <dl class="detail-card__spec">
      <div class="detail-card__spec-row">
        <dt>
          Protocol
          <InfoTip title="Protocol" placement="right">
            <p>The communication domain / transport stack a service speaks on this network, e.g. <code>grpc/celaut-v1</code>.</p>
          </InfoTip>
        </dt>
        <dd><code class="detail-card__code">{spec.protocol}</code></dd>
      </div>
      <div class="detail-card__spec-row">
        <dt>
          Peer Discovery
          <InfoTip title="Peer discovery" placement="right">
            <p>How peers find each other on this network — e.g. <code>static</code>, <code>environment_variable</code>, or <code>dht</code>.</p>
          </InfoTip>
        </dt>
        <dd><code class="detail-card__code">{spec.peerDiscovery}</code></dd>
      </div>
      {#if actionEntries.length > 0}
        <div class="detail-card__spec-row detail-card__spec-row--actions">
          <dt>
            Actions
            <InfoTip title="Network actions" placement="right">
              <p>The fundamental operations performed on this network, each a <code>name → description</code> pair. Every one is scored for trust &amp; access in a Trust Framework.</p>
            </InfoTip>
          </dt>
          <dd class="detail-card__actions">
            {#each actionEntries as [name, description]}
              <span class="action-chip" title={description}>{name}</span>
            {/each}
          </dd>
        </div>
      {/if}
    </dl>
  {/if}
</article>

<!-- Full-detail dialog -->
<DetailDialog
  bind:open={showDialog}
  title={network.content.tag}
  subtitle="Network definition"
>
  {#if network.content.prose}
    <p class="dlg-prose">{network.content.prose}</p>
  {/if}

  {#if isNetworkDefinition(network.content)}
    {@const spec = network.content.formal}
    <dl class="dlg-meta">
      <div class="dlg-meta__row">
        <dt>Protocol</dt>
        <dd><code>{spec.protocol}</code></dd>
      </div>
      <div class="dlg-meta__row">
        <dt>Peer Discovery</dt>
        <dd><code>{spec.peerDiscovery}</code></dd>
      </div>
      <div class="dlg-meta__row">
        <dt>Box ID</dt>
        <dd><code class="dlg-box-id">{network.boxId}</code></dd>
      </div>
    </dl>

    <h3 class="dlg-section-title">Actions</h3>
    <ul class="dlg-actions">
      {#each actionEntries as [name, description]}
        <li class="dlg-action">
          <code class="dlg-action__name">{name}</code>
          <span class="dlg-action__desc">{description || '—'}</span>
        </li>
      {/each}
    </ul>
  {/if}
</DetailDialog>

<style lang="postcss">
  .detail-card {
    padding: 20px 24px;
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 12px;
    background: hsl(var(--card) / 0.5, hsl(var(--background)));
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .detail-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .detail-card__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .detail-card__tag {
    font-size: 15px;
    font-weight: 700;
    color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.1);
    padding: 4px 12px;
    border-radius: 6px;
    letter-spacing: -0.01em;
  }
  .detail-card__header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .detail-card__details-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 8px;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .detail-card__details-btn:hover {
    background: hsl(var(--muted) / 0.2);
    border-color: hsl(var(--border) / 0.8);
    color: hsl(var(--foreground));
  }
  .detail-card__details-btn:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  .detail-card__box-id {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 11px;
    color: hsl(var(--muted-foreground) / 0.7);
    background: hsl(var(--muted) / 0.2);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Prose ─────────────────────────────────────────────────────────────── */
  .detail-card__prose {
    font-size: 14px;
    line-height: 1.6;
    color: hsl(var(--foreground) / 0.85);
    margin: 0;
  }

  /* ── Specification list ────────────────────────────────────────────────── */
  .detail-card__spec {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding-top: 12px;
    border-top: 1px solid hsl(var(--border) / 0.3);
  }
  .detail-card__spec-row {
    display: flex;
    gap: 16px;
    align-items: baseline;
  }
  .detail-card__spec-row dt {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground) / 0.65);
    min-width: 110px;
    flex-shrink: 0;
    padding-top: 2px; /* Visual alignment with code baseline */
  }
  .detail-card__spec-row dd {
    margin: 0;
    font-size: 14px;
  }
  .detail-card__spec-row--actions {
    align-items: flex-start;
  }

  .detail-card__code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 13px;
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.3);
    padding: 3px 8px;
    border-radius: 4px;
  }

  /* ── Action chips ──────────────────────────────────────────────────────── */
  .detail-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .action-chip {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--foreground) / 0.9);
    background: hsl(var(--muted) / 0.35);
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    line-height: 1.3;
  }

  /* ── Detail dialog content ─────────────────────────────────────────────── */
  .dlg-prose {
    margin: 0 0 16px;
    font-size: 14px;
    line-height: 1.6;
    color: hsl(var(--foreground) / 0.85);
  }
  .dlg-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 0 20px;
    padding: 0 0 16px;
    border-bottom: 1px solid hsl(var(--border) / 0.3);
  }
  .dlg-meta__row {
    display: flex;
    gap: 16px;
    align-items: baseline;
  }
  .dlg-meta__row dt {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground) / 0.65);
    min-width: 110px;
    flex-shrink: 0;
  }
  .dlg-meta__row dd {
    margin: 0;
    font-size: 13px;
    min-width: 0;
  }
  .dlg-meta__row code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.3);
    padding: 3px 8px;
    border-radius: 4px;
  }
  .dlg-box-id {
    word-break: break-all;
  }
  .dlg-section-title {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground) / 0.7);
  }
  .dlg-actions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dlg-action {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid hsl(var(--border) / 0.3);
    border-radius: 8px;
    background: hsl(var(--muted) / 0.06);
  }
  .dlg-action__name {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    font-weight: 600;
    color: hsl(var(--primary));
  }
  .dlg-action__desc {
    font-size: 13px;
    line-height: 1.5;
    color: hsl(var(--foreground) / 0.8);
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .detail-card {
      padding: 16px;
    }
    .detail-card__header {
      flex-direction: column;
      gap: 8px;
    }
    .detail-card__spec-row {
      flex-direction: column;
      gap: 4px;
    }
    .detail-card__spec-row dt {
      min-width: unset;
    }
  }
</style>