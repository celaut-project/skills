<script lang="ts">
  /**
   * Reputation Profile card.
   *
   * Attention hierarchy (per the redesign brief in TODO.md):
   *   LEVEL 1 — the burned-ERG value is the hero (≈3× body type); "Burn More
   *             ERG" is the single primary CTA.
   *   LEVEL 2 — Skills and Benchmarks, rendered with their real content.
   *   LEVEL 3 — the renamed "Profile Data" (formerly "R9 data"), Services &
   *             Results, and the wallet address truncated in a peripheral spot.
   *
   * The card is data-driven: skills/benchmarks/services/results and the list of
   * wallet profiles are optional props so the host (App.svelte) can wire real
   * on-chain content. Actions are emitted as events; the host owns the flows.
   *
   * `readOnly` (default false) hides every action (Burn More ERG, Add field,
   * create-profile "+") so the same card can render another user's profile.
   */
  import { createEventDispatcher } from 'svelte';
  import { total_burned_string, type ReputationProof, type RPBox } from 'reputation-system';
  import type { Skill, Benchmark, Coverage, Result } from '$lib/types';
  import { formatReputation } from '$lib/reputation';
  import { hexToUtf8 } from '$lib/ergo/envs';
  import ProfileAvatar from './ProfileAvatar.svelte';

  export let proof: ReputationProof;
  /** When true, render non-interactively (viewing someone else's profile). */
  export let readOnly = false;

  // Real on-chain content the user has produced. Generic — rendered by id/name.
  export let skills: Skill[] = [];
  export let benchmarks: Benchmark[] = [];
  export let services: Coverage[] = [];
  export let results: Result[] = [];

  /** All reputation profiles held by the wallet, for the "Active Profile" row. */
  export let profiles: ReputationProof[] = [];
  /** token_id of the globally-active profile. Defaults to `proof.token_id`. */
  export let activeProfileId: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    burn: void;
    addField: void;
    selectProfile: string;
    createProfile: void;
  }>();

  type Row = { key: string; value: string };

  function hasContent(content: unknown): boolean {
    if (content == null) return false;
    if (typeof content === 'string') return content.trim().length > 0;
    if (typeof content === 'object') return Object.keys(content as object).length > 0;
    return true;
  }

  /**
   * Resolve the profile's R9 content blob. The real payload lives on the
   * proof's boxes (decoded into `RPBox.content`); the profile box is the
   * self-pointing box (`object_pointer === token_id`). Falls back to any box
   * carrying content, then to `proof.data`.
   */
  function resolveProfileData(p: ReputationProof): unknown {
    const boxes: RPBox[] = p.current_boxes ?? [];
    const selfBox = boxes.find((b) => b.object_pointer === p.token_id && hasContent(b.content));
    const contentBox = selfBox ?? boxes.find((b) => hasContent(b.content));
    if (contentBox) return contentBox.content;
    return (p as any).data;
  }

  /**
   * Normalize the profile's content blob into key/value rows. Handles a plain
   * object, a JSON string, or a hex-encoded (Coll[Byte]) blob; degrades to a
   * best-effort string. Nothing here throws.
   */
  function toRows(raw: unknown): Row[] {
    let data: unknown = raw;

    if (typeof data === 'string') {
      const s = data.trim();
      if (!s) return [];
      try {
        data = JSON.parse(s);
      } catch {
        const decoded =
          /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 ? hexToUtf8(s) : null;
        if (decoded) {
          try {
            data = JSON.parse(decoded);
          } catch {
            data = decoded;
          }
        }
      }
    }

    if (data == null) return [];

    if (typeof data === 'object' && !Array.isArray(data)) {
      return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: stringifyValue(value)
      }));
    }

    if (Array.isArray(data)) {
      return data.map((value, i) => ({ key: `[${i}]`, value: stringifyValue(value) }));
    }

    return [{ key: 'value', value: stringifyValue(data) }];
  }

  function stringifyValue(value: unknown): string {
    if (value == null) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function shortId(id: string | undefined | null, head = 6, tail = 4): string {
    if (!id) return '—';
    if (id.length <= head + tail + 1) return id;
    return `${id.slice(0, head)}…${id.slice(-tail)}`;
  }

  $: profileRows = toRows(resolveProfileData(proof));
  $: burned = total_burned_string(proof);
  // The hero shows burned ERG verbatim, but a bare integer reads as "5.0" from
  // the library — collapse a dangling ".0" to "5" for the headline.
  $: burnedDisplay = burned.replace(/\.0$/, '');
  $: walletShort = shortId(proof.token_id, 6, 6);

  // The selector always shows at least the current profile.
  $: selectorProfiles = profiles.length ? profiles : [proof];
  $: activeId = activeProfileId ?? proof.token_id;

  // Generic, content-bearing views of each level-2/3 collection. We never assume
  // domain-specific fields beyond name/id/reputation that the types guarantee.
  $: skillItems = skills.map((s) => ({
    id: s.boxId,
    primary: s.name || shortId(s.boxId),
    meta: formatReputation(s.reputation ?? 0)
  }));
  $: benchmarkItems = benchmarks.map((b) => ({
    id: b.id,
    primary: b.name || shortId(b.id),
    meta: b.results?.length ? `${b.results.length} result${b.results.length === 1 ? '' : 's'}` : formatReputation(b.reputation ?? 0)
  }));
  $: serviceItems = services.map((c) => ({
    id: c.boxId,
    primary: shortId(c.serviceId || c.profileId || c.boxId),
    meta: formatReputation(c.reputation ?? 0)
  }));
  $: resultItems = results.map((r) => ({
    id: r.id,
    primary: r.notes?.trim() || shortId(r.benchmarkId || r.id),
    meta: formatReputation(r.reputation ?? 0)
  }));

  function selectProfile(id: string) {
    if (readOnly || id === activeId) return;
    dispatch('selectProfile', id);
  }
</script>

<section class="rp-card" aria-label="Reputation profile">
  <!-- Header: title + peripheral wallet ----------------------------------- -->
  <header class="rp-header">
    <span class="rp-section-title">Reputation Profile</span>
    <span class="rp-wallet" title={proof.token_id}>
      <span class="rp-wallet-dot" aria-hidden="true"></span>
      {walletShort}
    </span>
  </header>

  <!-- LEVEL 1 — ERG hero + single primary CTA ----------------------------- -->
  <div class="rp-hero">
    <div class="rp-hero-value">
      <span class="rp-hero-number">{burnedDisplay}</span>
      <span class="rp-hero-unit">ERG</span>
    </div>
    <p class="rp-hero-caption">Burned to this profile</p>
    {#if !readOnly}
      <button type="button" class="rp-cta" on:click={() => dispatch('burn')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Burn More ERG
      </button>
    {/if}
  </div>

  <!-- LEVEL 2 — Skills + Benchmarks (real content, medium attention) ------ -->
  <div class="rp-grid rp-grid-2">
    <div class="rp-tile">
      <div class="rp-tile-title">Skills</div>
      {#if skillItems.length}
        <ul class="rp-list">
          {#each skillItems as item (item.id)}
            <li class="rp-list-row">
              <span class="rp-list-primary" title={item.primary}>{item.primary}</span>
              <span class="rp-list-meta">{item.meta}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="rp-empty">No skills yet</span>
      {/if}
    </div>

    <div class="rp-tile">
      <div class="rp-tile-title">Benchmarks</div>
      {#if benchmarkItems.length}
        <ul class="rp-list">
          {#each benchmarkItems as item (item.id)}
            <li class="rp-list-row">
              <span class="rp-list-primary" title={item.primary}>{item.primary}</span>
              <span class="rp-list-meta">{item.meta}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="rp-empty">No benchmarks yet</span>
      {/if}
    </div>
  </div>

  <!-- LEVEL 3 — Profile Data + Services & Results (low attention) ---------- -->
  <div class="rp-grid rp-grid-2">
    <div class="rp-tile rp-tile-muted">
      <div class="rp-tile-title">Profile Data</div>
      {#if profileRows.length}
        <dl class="rp-kv">
          {#each profileRows as row (row.key)}
            <div class="rp-kv-row">
              <dt class="rp-kv-key">{row.key}</dt>
              <dd class="rp-kv-value">{row.value}</dd>
            </div>
          {/each}
        </dl>
      {:else}
        <span class="rp-empty">No fields added</span>
      {/if}
      {#if !readOnly}
        <button type="button" class="rp-ghost-btn" on:click={() => dispatch('addField')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add field
        </button>
      {/if}
    </div>

    <div class="rp-tile rp-tile-muted">
      <div class="rp-tile-title">Services &amp; Results</div>
      {#if serviceItems.length || resultItems.length}
        <ul class="rp-list">
          {#each serviceItems as item (item.id)}
            <li class="rp-list-row">
              <span class="rp-list-tag">Service</span>
              <span class="rp-list-primary" title={item.primary}>{item.primary}</span>
              <span class="rp-list-meta">{item.meta}</span>
            </li>
          {/each}
          {#each resultItems as item (item.id)}
            <li class="rp-list-row">
              <span class="rp-list-tag">Result</span>
              <span class="rp-list-primary" title={item.primary}>{item.primary}</span>
              <span class="rp-list-meta">{item.meta}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="rp-empty">No services or results yet</span>
      {/if}
    </div>
  </div>

  <!-- Active Profile selector --------------------------------------------- -->
  <footer class="rp-selector">
    <span class="rp-section-title rp-selector-label">Active Profile</span>
    <div class="rp-selector-row">
      {#each selectorProfiles as p (p.token_id)}
        <button
          type="button"
          class="rp-chip"
          class:rp-chip-active={p.token_id === activeId}
          aria-pressed={p.token_id === activeId}
          disabled={readOnly && p.token_id !== activeId}
          title={p.token_id}
          on:click={() => selectProfile(p.token_id)}
        >
          <ProfileAvatar profileId={p.token_id} size={18} clickable={false} />
          <span class="rp-chip-id">{shortId(p.token_id)}</span>
        </button>
      {/each}
      {#if !readOnly}
        <button type="button" class="rp-chip rp-chip-new" on:click={() => dispatch('createProfile')} title="Create a new profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      {/if}
    </div>
  </footer>
</section>

<style>
  /* Base body type for the card; all ratios are relative to this. */
  .rp-card {
    --rp-body: 0.9rem;
    border: 1px solid hsl(var(--border));
    border-radius: 1rem;
    padding: 1.5rem;
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    display: grid;
    gap: 2rem; /* large gap below the hero block */
    margin-bottom: 1rem;
    font-size: var(--rp-body);
  }

  .rp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .rp-section-title {
    font-size: 0.7rem; /* 0.9x of muted scale, uppercase + wide */
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
  }

  /* Peripheral, low-attention wallet address. */
  .rp-wallet {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem; /* metadata ~0.8x */
    color: hsl(var(--muted-foreground));
  }
  .rp-wallet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: hsl(var(--primary));
  }

  /* ── LEVEL 1: hero ─────────────────────────────────────────────────── */
  .rp-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.85rem;
    padding: 1.25rem 1rem;
  }
  .rp-hero-value {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    line-height: 1;
  }
  .rp-hero-number {
    font-size: 2.7rem; /* ≈3× body */
    font-weight: 800;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--foreground));
  }
  .rp-hero-unit {
    font-size: 1.1rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    letter-spacing: 0.02em;
  }
  .rp-hero-caption {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: hsl(var(--muted-foreground));
    margin: 0;
  }
  .rp-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.25rem;
    padding: 0.6rem 1.25rem;
    border: none;
    border-radius: 0.6rem;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: var(--rp-body);
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
    box-shadow: 0 2px 8px hsl(var(--foreground) / 0.1);
  }
  .rp-cta:hover {
    filter: brightness(1.04);
    box-shadow: 0 4px 14px hsl(var(--foreground) / 0.16);
  }
  .rp-cta:active {
    transform: translateY(1px);
    box-shadow: 0 1px 5px hsl(var(--foreground) / 0.12);
  }
  .rp-cta:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }

  /* ── Tiles (levels 2 & 3) ──────────────────────────────────────────── */
  .rp-grid {
    display: grid;
    gap: 1rem; /* medium gap between level-2 cards */
  }
  .rp-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 560px) {
    .rp-grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .rp-tile {
    border: 1px solid hsl(var(--border));
    border-radius: 0.75rem;
    padding: 0.9rem 1rem;
    background: hsl(var(--background));
    display: grid;
    gap: 0.6rem; /* compact within each card */
    align-content: start;
  }
  /* Level 3 reads quieter than level 2. */
  .rp-tile-muted {
    background: hsl(var(--muted) / 0.4);
    border-color: hsl(var(--border) / 0.7);
  }

  .rp-tile-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
  }

  .rp-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .rp-list-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--rp-body);
  }
  .rp-list-primary {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .rp-list-meta {
    flex-shrink: 0;
    font-size: 0.72rem;
    color: hsl(var(--muted-foreground));
    font-variant-numeric: tabular-nums;
  }
  .rp-list-tag {
    flex-shrink: 0;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 0.7);
    border-radius: 0.3rem;
    padding: 0.1rem 0.35rem;
  }

  /* Key/value Profile Data */
  .rp-kv {
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  .rp-kv-row {
    display: grid;
    gap: 0.1rem;
  }
  .rp-kv-key {
    font-size: 0.72rem;
    color: hsl(var(--muted-foreground));
  }
  .rp-kv-value {
    margin: 0;
    font-size: var(--rp-body);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-word;
  }

  .rp-empty {
    font-size: 0.78rem;
    color: hsl(var(--muted-foreground));
    font-style: italic;
  }

  .rp-ghost-btn {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.15rem;
    padding: 0.3rem 0.6rem;
    border: 1px dashed hsl(var(--border));
    border-radius: 0.5rem;
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
  }
  .rp-ghost-btn:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--muted-foreground));
  }

  /* ── Active Profile selector ───────────────────────────────────────── */
  .rp-selector {
    border-top: 1px solid hsl(var(--border));
    padding-top: 1rem;
    display: grid;
    gap: 0.6rem;
  }
  .rp-selector-label {
    color: hsl(var(--muted-foreground));
  }
  .rp-selector-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .rp-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem 0.3rem 0.35rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.6rem;
    /* inactive: faded / translucent */
    background: hsl(var(--muted) / 0.3);
    color: hsl(var(--muted-foreground));
    opacity: 0.65;
    font-size: 0.72rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    cursor: pointer;
    transition: opacity 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .rp-chip:hover:not(:disabled) {
    opacity: 0.9;
  }
  .rp-chip:disabled {
    cursor: default;
  }
  /* active: stronger outline + subtle fill, fully opaque */
  .rp-chip-active {
    opacity: 1;
    border-color: hsl(var(--primary));
    border-width: 2px;
    padding: calc(0.3rem - 1px) calc(0.6rem - 1px) calc(0.3rem - 1px) calc(0.35rem - 1px);
    background: hsl(var(--primary) / 0.12);
    color: hsl(var(--foreground));
    font-weight: 600;
  }
  .rp-chip:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  /* create-new: dashed border */
  .rp-chip-new {
    border-style: dashed;
    background: transparent;
    opacity: 0.8;
  }
  .rp-chip-new:hover {
    opacity: 1;
    color: hsl(var(--foreground));
    border-color: hsl(var(--muted-foreground));
  }
</style>
