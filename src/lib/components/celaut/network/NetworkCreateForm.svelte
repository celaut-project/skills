<script lang="ts">
  /**
   * NetworkCreateForm — Form for creating a new network definition.
   *
   * Uses consistent field sizing, clear required indicators,
   * and inline validation hints. Emits a structured payload on submit.
   */
  import { createEventDispatcher } from 'svelte';
  import InfoTip from '../InfoTip.svelte';

  const dispatch = createEventDispatcher<{
    submit: { slug: string; prose: string; protocol: string; peerDiscovery: string; actions: Record<string, string> };
    cancel: void;
  }>();

  let slug = '';
  let prose = '';
  let protocol = '';
  let peerDiscovery = '';
  // Actions are a dict (name → description). Edited as an ordered list of rows
  // and collapsed into a Record on submit.
  let actionRows: Array<{ name: string; description: string }> = [
    { name: '', description: '' }
  ];
  let submitting = false;

  function addActionRow() {
    actionRows = [...actionRows, { name: '', description: '' }];
  }

  function removeActionRow(i: number) {
    actionRows = actionRows.filter((_, idx) => idx !== i);
    if (actionRows.length === 0) actionRows = [{ name: '', description: '' }];
  }

  /** Collapse the row list into a { name: description } dict, dropping blank names. */
  function collectActions(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of actionRows) {
      const name = row.name.trim();
      if (name) out[name] = row.description.trim();
    }
    return out;
  }

  function handleSubmit() {
    const trimmedSlug = slug.trim();
    const trimmedProse = prose.trim();
    const trimmedProtocol = protocol.trim();
    const trimmedPeer = peerDiscovery.trim();
    const actions = collectActions();

    if (!trimmedSlug || !trimmedProse || !trimmedProtocol || !trimmedPeer) return;
    if (Object.keys(actions).length === 0) return;

    submitting = true;
    dispatch('submit', {
      slug: trimmedSlug,
      prose: trimmedProse,
      protocol: trimmedProtocol,
      peerDiscovery: trimmedPeer,
      actions
    });
    // Parent resets submitting state via prop or we reset after a tick
    setTimeout(() => { submitting = false; }, 3000);
  }

  function handleCancel() {
    dispatch('cancel');
  }

  $: isValid = slug.trim() && prose.trim() && protocol.trim() && peerDiscovery.trim() &&
    actionRows.some(r => r.name.trim());
</script>

<div class="create-card">
  <h2 class="create-card__title">Create Network Definition</h2>
  <p class="create-card__subtitle">
    Define a reusable network's protocol, peer discovery, and assessable actions.
  </p>

  <form class="create-card__form" on:submit|preventDefault={handleSubmit}>
    <div class="field">
      <label class="field__label" for="create-slug">
        Slug
        <span class="field__required" aria-label="required">*</span>
      </label>
      <input
        id="create-slug"
        class="field__input"
        type="text"
        bind:value={slug}
        placeholder="e.g. celaut-comm-domain"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="field__hint">Lowercase kebab-case identifier</span>
    </div>

    <div class="field">
      <label class="field__label" for="create-prose">
        Description
        <span class="field__required" aria-label="required">*</span>
      </label>
      <textarea
        id="create-prose"
        class="field__input field__textarea"
        rows="3"
        bind:value={prose}
        placeholder="Human-readable definition of this network."
      ></textarea>
    </div>

    <div class="field-row">
      <div class="field field-row__item">
        <label class="field__label" for="create-protocol">
          Protocol
          <span class="field__required" aria-label="required">*</span>
        </label>
        <input
          id="create-protocol"
          class="field__input"
          type="text"
          bind:value={protocol}
          placeholder="e.g. grpc/celaut-v1"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="field field-row__item">
        <label class="field__label" for="create-peer">
          Peer Discovery
          <span class="field__required" aria-label="required">*</span>
        </label>
        <input
          id="create-peer"
          class="field__input"
          type="text"
          bind:value={peerDiscovery}
          placeholder="e.g. dht, static"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <div class="field">
      <span class="field__label" id="create-actions-label">
        Actions
        <span class="field__required" aria-label="required">*</span>
        <InfoTip title="Network actions" placement="right">
          <p>
            The fundamental operations a service performs on this network — each
            one is later scored on the Sigmaverse Quality Standard in a Trust
            Framework.
          </p>
          <p>
            Give every action a machine <strong>name</strong> and a short
            <strong>description</strong> of what it does. They're stored as a
            <code>name → description</code> dict, not a flat list.
          </p>
        </InfoTip>
      </span>

      <div class="actions-editor" role="group" aria-labelledby="create-actions-label">
        {#each actionRows as row, i (i)}
          <div class="action-row">
            <input
              class="field__input action-row__name"
              type="text"
              bind:value={row.name}
              placeholder="action_name"
              aria-label={`Action ${i + 1} name`}
              autocomplete="off"
              spellcheck="false"
            />
            <input
              class="field__input action-row__desc"
              type="text"
              bind:value={row.description}
              placeholder="What this action does"
              aria-label={`Action ${i + 1} description`}
              autocomplete="off"
            />
            <button
              type="button"
              class="action-row__remove"
              on:click={() => removeActionRow(i)}
              aria-label={`Remove action ${i + 1}`}
              title="Remove action"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        {/each}
        <button type="button" class="actions-editor__add" on:click={addActionRow}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add action
        </button>
      </div>
      <span class="field__hint">Each action is assessed for trust &amp; access in the Trust Framework</span>
    </div>

    <div class="create-card__actions">
      <button
        type="submit"
        class="btn btn--primary"
        disabled={!isValid || submitting}
      >
        {submitting ? 'Publishing…' : 'Publish Network Definition'}
      </button>
      <button type="button" class="btn btn--ghost" on:click={handleCancel}>
        Cancel
      </button>
    </div>
  </form>
</div>

<style lang="postcss">
  .create-card {
    padding: 24px;
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 12px;
    background: hsl(var(--card) / 0.5, hsl(var(--background)));
  }
  .create-card__title {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 4px;
    color: hsl(var(--foreground));
  }
  .create-card__subtitle {
    font-size: 13px;
    color: hsl(var(--muted-foreground));
    margin: 0 0 20px;
    line-height: 1.5;
  }

  .create-card__form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Field ─────────────────────────────────────────────────────────────── */
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field__label {
    font-size: 12px;
    font-weight: 600;
    color: hsl(var(--muted-foreground) / 0.8);
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .field__required {
    color: hsl(0 80% 60%);
    font-size: 14px;
    line-height: 1;
  }
  .field__input {
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid hsl(var(--border) / 0.6);
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 13px;
    font-family: inherit;
    width: 100%;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .field__input::placeholder {
    color: hsl(var(--muted-foreground) / 0.45);
  }
  .field__input:focus {
    outline: none;
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.08);
  }
  .field__textarea {
    resize: vertical;
    min-height: 72px;
  }
  .field__hint {
    font-size: 12px;
    color: hsl(var(--muted-foreground) / 0.6);
    line-height: 1.4;
  }

  /* ── Two-column row ────────────────────────────────────────────────────── */
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Keep the InfoTip aligned with the label text */
  .field__label :global(.info-tip-wrap) {
    margin-left: 2px;
  }

  /* ── Actions editor (name → description rows) ──────────────────────────── */
  .actions-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .action-row {
    display: grid;
    grid-template-columns: minmax(120px, 0.9fr) minmax(0, 2fr) auto;
    gap: 8px;
    align-items: center;
  }
  .action-row__name {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 12px;
  }
  .action-row__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid hsl(var(--border) / 0.5);
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .action-row__remove:hover {
    background: hsl(0 80% 60% / 0.1);
    border-color: hsl(0 80% 60% / 0.4);
    color: hsl(0 80% 60%);
  }
  .actions-editor__add {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px dashed hsl(var(--border) / 0.6);
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .actions-editor__add:hover {
    background: hsl(var(--muted) / 0.2);
    border-color: hsl(var(--border));
    color: hsl(var(--foreground));
  }

  /* ── Action buttons ────────────────────────────────────────────────────── */
  .create-card__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid hsl(var(--border) / 0.25);
  }

  /* ── Buttons (shared) ──────────────────────────────────────────────────── */
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
  @media (max-width: 600px) {
    .create-card {
      padding: 16px;
    }
    .field-row {
      grid-template-columns: 1fr;
    }
    .action-row {
      grid-template-columns: 1fr auto;
    }
    .action-row__desc {
      grid-column: 1 / -1;
    }
  }
</style>