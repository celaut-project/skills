<script lang="ts">
  /**
   * NetworkCreateForm — Form for creating a new network definition.
   *
   * Uses consistent field sizing, clear required indicators,
   * and inline validation hints. Emits a structured payload on submit.
   */
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    submit: { slug: string; prose: string; protocol: string; peerDiscovery: string; actions: string[] };
    cancel: void;
  }>();

  let slug = '';
  let prose = '';
  let protocol = '';
  let peerDiscovery = '';
  let actionsRaw = '';
  let submitting = false;

  function handleSubmit() {
    const trimmedSlug = slug.trim();
    const trimmedProse = prose.trim();
    const trimmedProtocol = protocol.trim();
    const trimmedPeer = peerDiscovery.trim();
    const actions = actionsRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (!trimmedSlug || !trimmedProse || !trimmedProtocol || !trimmedPeer) return;
    if (actions.length === 0) return;

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
    actionsRaw.split(',').map(s => s.trim()).filter(Boolean).length > 0;
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
      <label class="field__label" for="create-actions">
        Actions
        <span class="field__required" aria-label="required">*</span>
      </label>
      <input
        id="create-actions"
        class="field__input"
        type="text"
        bind:value={actionsRaw}
        placeholder="peer-discovery, message-delivery, service-launch"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="field__hint">Comma-separated action names to be assessed in the Trust Framework</span>
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
  }
</style>