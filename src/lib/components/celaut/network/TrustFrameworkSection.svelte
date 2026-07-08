<script lang="ts">
  /**
   * TrustFrameworkSection — Manages trust frameworks for a selected network.
   *
   * Contains the section header with "Add" button, the inline creation form,
   * and a list of existing framework cards with score badges and action tables.
   */
  import { createEventDispatcher } from 'svelte';
  import type { StrictDefinitionBox, TrustFrameworkBox } from '$lib/types';
  import { isNetworkDefinition } from '$lib/strictDefinition';
  import {
    TrustLevel,
    AccessLevel,
    computeFrameworkScores
  } from '$lib/trustFramework';
  import ExplorerLink from '../ExplorerLink.svelte';

  export let network: StrictDefinitionBox;
  export let selectedFrameworks: TrustFrameworkBox[] = [];
  export let loadingFrameworks = false;

  const dispatch = createEventDispatcher<{
    create: Array<{ name: string; trust: TrustLevel; access: AccessLevel }>;
  }>();

  let showForm = false;
  let tfActions: Array<{ name: string; trust: TrustLevel; access: AccessLevel }> = [];
  let creating = false;

  const TRUST_LABELS: Record<TrustLevel, string> = {
    [TrustLevel.TrustMinimized]: 'Trust-Minimized',
    [TrustLevel.CryptoEconomic]: 'Crypto-Economic',
    [TrustLevel.Fiduciary]: 'Fiduciary'
  };
  const ACCESS_LABELS: Record<AccessLevel, string> = {
    [AccessLevel.VerifiableArtifact]: 'Verifiable Artifact',
    [AccessLevel.CentralizedService]: 'Centralized Service'
  };

  function openForm() {
    if (!isNetworkDefinition(network.content)) return;
    tfActions = network.content.formal.actions.map(name => ({
      name,
      trust: TrustLevel.TrustMinimized,
      access: AccessLevel.VerifiableArtifact
    }));
    showForm = true;
  }

  async function handleCreate() {
    creating = true;
    await dispatch('create', tfActions);
    creating = false;
    showForm = false;
  }

  function getScores(actions: Array<{ name: string; trust: TrustLevel; access: AccessLevel }>) {
    try { return computeFrameworkScores(actions); } catch { return null; }
  }
</script>

<section class="tf-section">
  <!-- Section header -->
  <div class="tf-section__header">
    <h2 class="tf-section__title">Trust Frameworks</h2>
    {#if isNetworkDefinition(network.content)}
      <button
        type="button"
        class="tf-section__add-btn"
        on:click={openForm}
        disabled={showForm}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Framework
      </button>
    {/if}
  </div>

  <!-- Inline creation form -->
  {#if showForm && isNetworkDefinition(network.content)}
    <div class="tf-form">
      <h3 class="tf-form__title">Score Each Action</h3>
      <p class="tf-form__hint">
        Rate on the Sigmaverse Quality Standard: Trust level × Access level.
      </p>

      {#each tfActions as action, i}
        <div class="tf-form__row">
          <span class="tf-form__action-name">{action.name}</span>
          <div class="tf-form__selects">
            <label class="tf-form__select-label">
              <span class="tf-form__select-label-text">Trust</span>
              <select class="tf-form__select" bind:value={tfActions[i].trust}>
                {#each Object.entries(TRUST_LABELS) as [val, label]}
                  <option value={Number(val)}>{label}</option>
                {/each}
              </select>
            </label>
            <label class="tf-form__select-label">
              <span class="tf-form__select-label-text">Access</span>
              <select class="tf-form__select" bind:value={tfActions[i].access}>
                {#each Object.entries(ACCESS_LABELS) as [val, label]}
                  <option value={Number(val)}>{label}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>
      {/each}

      <!-- Live score preview -->
      {#if tfActions.length > 0}
        {@const scores = getScores(tfActions)}
        {#if scores}
          <div class="tf-form__preview">
            <span class="tf-form__preview-label">Preview</span>
            <span class="tf-form__preview-value">
              Weakest link: <strong>{scores.weakestLink}</strong>
              <span class="tf-form__preview-sep" aria-hidden="true">·</span>
              Avg risk: <strong>{scores.averageRisk}</strong>
            </span>
          </div>
        {/if}
      {/if}

      <div class="tf-form__actions">
        <button
          type="button"
          class="btn btn--primary"
          on:click={handleCreate}
          disabled={creating}
        >
          {creating ? 'Publishing…' : 'Publish Framework'}
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          on:click={() => (showForm = false)}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Framework list -->
  {#if loadingFrameworks}
    <div class="tf-section__loading">Loading trust frameworks…</div>
  {:else if selectedFrameworks.length === 0}
    <p class="tf-section__empty">
      No trust frameworks published for this network yet.
    </p>
  {:else}
    <div class="tf-list">
      {#each selectedFrameworks as tf (tf.boxId)}
        {@const scores = getScores(tf.actions)}
        <article class="tf-card">
          <!-- Card header -->
          <div class="tf-card__header">
            <div class="tf-card__identity">
              <code class="tf-card__box-id">{tf.boxId.slice(0, 16)}…</code>
              <ExplorerLink boxId={tf.boxId} liveTooltip="View Trust Framework box" />
            </div>
            {#if scores}
              <span class="tf-card__score">
                Weakest: {scores.weakestLink}
                <span class="tf-card__score-sep" aria-hidden="true">·</span>
                Avg: {scores.averageRisk}
              </span>
            {/if}
          </div>

          <!-- Action table -->
          <table class="tf-card__table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Trust</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            <tbody>
              {#each tf.actions as a}
                <tr>
                  <td><code class="tf-card__action-code">{a.name ?? '—'}</code></td>
                  <td class="tf-card__level-cell">{TRUST_LABELS[a.trust] ?? a.trust}</td>
                  <td class="tf-card__level-cell">{ACCESS_LABELS[a.access] ?? a.access}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style lang="postcss">
  .tf-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Section header ────────────────────────────────────────────────────── */
  .tf-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .tf-section__title {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: hsl(var(--foreground));
  }
  .tf-section__add-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .tf-section__add-btn:hover:not(:disabled) {
    background: hsl(var(--muted) / 0.2);
    border-color: hsl(var(--border) / 0.8);
    color: hsl(var(--foreground));
  }
  .tf-section__add-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tf-section__add-btn:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }

  /* ── Inline form ───────────────────────────────────────────────────────── */
  .tf-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px dashed hsl(var(--border) / 0.45);
    border-radius: 10px;
    background: hsl(var(--muted) / 0.03);
  }
  .tf-form__title {
    font-size: 13px;
    font-weight: 700;
    margin: 0;
    color: hsl(var(--foreground));
  }
  .tf-form__hint {
    font-size: 12px;
    color: hsl(var(--muted-foreground));
    margin: 0;
    line-height: 1.4;
  }
  .tf-form__row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: hsl(var(--muted) / 0.15);
    border-radius: 8px;
  }
  .tf-form__action-name {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--foreground));
    min-width: 140px;
    flex-shrink: 0;
  }
  .tf-form__selects {
    display: flex;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .tf-form__select-label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .tf-form__select-label-text {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground) / 0.6);
  }
  .tf-form__select {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid hsl(var(--border) / 0.6);
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 12px;
    font-family: inherit;
    width: 100%;
    cursor: pointer;
  }
  .tf-form__select:focus {
    outline: none;
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.08);
  }

  /* Score preview */
  .tf-form__preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: hsl(var(--primary) / 0.06);
    border-radius: 6px;
    border: 1px solid hsl(var(--primary) / 0.1);
  }
  .tf-form__preview-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: hsl(var(--muted-foreground) / 0.7);
  }
  .tf-form__preview-value {
    font-size: 12px;
    color: hsl(var(--muted-foreground));
  }
  .tf-form__preview-value strong {
    color: hsl(var(--foreground));
    font-weight: 600;
  }
  .tf-form__preview-sep {
    margin: 0 4px;
    opacity: 0.4;
  }

  .tf-form__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
  }

  /* ── Framework list ────────────────────────────────────────────────────── */
  .tf-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tf-section__loading,
  .tf-section__empty {
    font-size: 13px;
    color: hsl(var(--muted-foreground));
    text-align: center;
    padding: 32px 16px;
    margin: 0;
    line-height: 1.5;
  }

  /* ── Framework card ────────────────────────────────────────────────────── */
  .tf-card {
    border: 1px solid hsl(var(--border) / 0.35);
    border-radius: 10px;
    background: hsl(var(--muted) / 0.04);
    overflow: hidden;
  }
  .tf-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid hsl(var(--border) / 0.25);
  }
  .tf-card__identity {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .tf-card__box-id {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 11px;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tf-card__score {
    font-size: 11px;
    color: hsl(var(--muted-foreground) / 0.8);
    padding: 3px 10px;
    border-radius: 4px;
    background: hsl(var(--muted) / 0.3);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tf-card__score-sep {
    margin: 0 3px;
    opacity: 0.4;
  }

  /* ── Table ─────────────────────────────────────────────────────────────── */
  .tf-card__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .tf-card__table thead {
    background: hsl(var(--muted) / 0.08);
  }
  .tf-card__table th {
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground) / 0.6);
    padding: 8px 16px;
    border-bottom: 1px solid hsl(var(--border) / 0.2);
  }
  .tf-card__table td {
    padding: 10px 16px;
    border-bottom: 1px solid hsl(var(--border) / 0.12);
    color: hsl(var(--foreground) / 0.85);
  }
  .tf-card__table tbody tr:last-child td {
    border-bottom: none;
  }
  .tf-card__table tbody tr:hover {
    background: hsl(var(--muted) / 0.06);
  }
  .tf-card__action-code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    color: hsl(var(--foreground));
  }
  .tf-card__level-cell {
    color: hsl(var(--muted-foreground));
  }

  /* ── Shared buttons (duplicated from create form — extract to global if needed) ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    border: none;
    font-family: inherit;
  }
  .btn:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  .btn--primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
  .btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn--ghost {
    background: transparent;
    color: hsl(var(--muted-foreground));
    border: 1px solid hsl(var(--border) / 0.5);
  }
  .btn--ghost:hover {
    background: hsl(var(--muted) / 0.2);
    border-color: hsl(var(--border) / 0.8);
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 700px) {
    .tf-form__row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .tf-form__action-name {
      min-width: unset;
    }
    .tf-form__selects {
      flex-direction: column;
    }
    .tf-card__header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .tf-card__table th,
    .tf-card__table td {
      padding: 8px 12px;
    }
  }

  @media (max-width: 480px) {
    .tf-section__header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>