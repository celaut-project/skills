<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { total_burned_string, type ReputationProof, type RPBox } from 'reputation-system';
  import type { Skill, Benchmark, Coverage, Result } from '$lib/types';
  import { formatReputation } from '$lib/reputation';
  import { hexToUtf8 } from '$lib/ergo/envs';
  import ProfileAvatar from './ProfileAvatar.svelte';

  export let proof: ReputationProof;
  export let readOnly = false;
  export let skills: Skill[] = [];
  export let benchmarks: Benchmark[] = [];
  export let services: Coverage[] = [];
  export let results: Result[] = [];
  export let profiles: ReputationProof[] = [];
  export let activeProfileId: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    burn: void;
    updateProfileData: { data: Record<string, unknown> };
    selectProfile: string;
    createProfile: void;
    navigateSkill: string;
  }>();

  type Row = { key: string; value: string };

  function hasContent(content: unknown): boolean {
    if (content == null) return false;
    if (typeof content === 'string') return content.trim().length > 0;
    if (typeof content === 'object') return Object.keys(content as object).length > 0;
    return true;
  }

  function resolveProfileData(p: ReputationProof): unknown {
    const boxes: RPBox[] = p.current_boxes ?? [];
    const selfBox = boxes.find((b) => b.object_pointer === p.token_id && hasContent(b.content));
    const contentBox = selfBox ?? boxes.find((b) => hasContent(b.content));
    if (contentBox) return contentBox.content;
    return (p as any).data;
  }

  function toRows(raw: unknown): Row[] {
    let data: unknown = raw;
    if (typeof data === 'string') {
      const s = data.trim();
      if (!s) return [];
      try { data = JSON.parse(s); } catch {
        const decoded = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 ? hexToUtf8(s) : null;
        if (decoded) { try { data = JSON.parse(decoded); } catch { data = decoded; } }
      }
    }
    if (data == null) return [];
    if (typeof data === 'object' && !Array.isArray(data)) {
      return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        key, value: stringifyValue(value)
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
    if (typeof value === 'object') { try { return JSON.stringify(value); } catch { return String(value); } }
    return String(value);
  }

  function shortId(id: string | undefined | null, head = 6, tail = 4): string {
    if (!id) return '—';
    if (id.length <= head + tail + 1) return id;
    return `${id.slice(0, head)}…${id.slice(-tail)}`;
  }

  $: profileRows = toRows(resolveProfileData(proof));
  $: burned = total_burned_string(proof);
  $: burnedDisplay = burned.replace(/\.0$/, '');
  $: walletShort = shortId(proof.token_id, 6, 6);
  $: selectorProfiles = profiles.length ? profiles : [proof];
  $: activeId = activeProfileId ?? proof.token_id;

  /* ── Single source of truth: profile contributions ──────────────────── */
  interface ProfileContributions {
    submittedSkills: Skill[];
    coverages: Array<{ skill: Skill; coverage: Coverage }>;
    benchmarks: Array<{ skill: Skill; benchmark: Benchmark }>;
    results: Array<{ skill: Skill; benchmark: Benchmark; result: Result }>;
  }

  $: profileContributions = ((): ProfileContributions => {
    const empty: ProfileContributions = { submittedSkills: [], coverages: [], benchmarks: [], results: [] };
    const pid = proof.token_id;
    if (!pid) return empty;
    const acc: ProfileContributions = { submittedSkills: [], coverages: [], benchmarks: [], results: [] };
    for (const skill of skills) {
      if (skill.profileId === pid) acc.submittedSkills.push(skill);
      for (const cov of (skill.coverages ?? [])) {
        if (cov.profileId === pid) acc.coverages.push({ skill, coverage: cov });
      }
      for (const bench of (skill.benchmarks ?? [])) {
        if (bench.profileId === pid) acc.benchmarks.push({ skill, benchmark: bench });
        for (const result of (bench.results ?? [])) {
          if (result.profileId === pid) acc.results.push({ skill, benchmark: bench, result });
        }
      }
    }
    return acc;
  })();

  /* ── Collapse state (default collapsed) ─────────────────────────────── */
  let collapsedSkills = true;
  let collapsedBenchmarks = true;
  let collapsedServices = true;
  let collapsedResults = true;

  function toggleCollapse(which: 'skills' | 'benchmarks' | 'services' | 'results') {
    if (which === 'skills') collapsedSkills = !collapsedSkills;
    else if (which === 'benchmarks') collapsedBenchmarks = !collapsedBenchmarks;
    else if (which === 'services') collapsedServices = !collapsedServices;
    else collapsedResults = !collapsedResults;
  }

  /* ── Copy profile ID ────────────────────────────────────────────────── */
  let showCopied = false;
  let copiedTimeout: ReturnType<typeof setTimeout>;

  function copyProfileId() {
    if (!proof.token_id) return;
    navigator.clipboard.writeText(proof.token_id).then(() => {
      showCopied = true;
      clearTimeout(copiedTimeout);
      copiedTimeout = setTimeout(() => { showCopied = false; }, 2000);
    }).catch(() => {});
  }

  /* ── Profile Data modal (PUT semantics) ─────────────────────────────── */
  let showFieldModal = false;
  let modalRows: Array<{ key: string; value: string }> = [];
  let newKey = '';
  let newValue = '';

  function openFieldModal() {
    modalRows = profileRows.map(r => ({ key: r.key, value: r.value }));
    newKey = '';
    newValue = '';
    showFieldModal = true;
  }

  function closeFieldModal() {
    showFieldModal = false;
  }

  function addModalRow() {
    const k = newKey.trim();
    if (!k) return;
    const idx = modalRows.findIndex(r => r.key === k);
    if (idx >= 0) {
      modalRows = modalRows.map((r, i) => i === idx ? { key: k, value: newValue.trim() } : r);
    } else {
      modalRows = [...modalRows, { key: k, value: newValue.trim() }];
    }
    newKey = '';
    newValue = '';
  }

  function updateModalRow(index: number, field: 'key' | 'value', val: string) {
    modalRows = modalRows.map((r, i) => i === index ? { ...r, [field]: val } : r);
  }

  function removeModalRow(index: number) {
    modalRows = modalRows.filter((_, i) => i !== index);
  }

  function saveFieldModal() {
    const data: Record<string, unknown> = {};
    for (const row of modalRows) {
      const k = row.key.trim();
      if (k) data[k] = row.value;
    }
    dispatch('updateProfileData', { data });
    closeFieldModal();
  }

  /* ── Navigation ─────────────────────────────────────────────────────── */
  function navigateToSkill(skillBoxId: string) {
    dispatch('navigateSkill', skillBoxId);
  }

  function selectProfile(id: string) {
    if (readOnly || id === activeId) return;
    dispatch('selectProfile', id);
  }

  /* ── Global ESC ─────────────────────────────────────────────────────── */
  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showFieldModal) closeFieldModal();
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<!-- ── Profile Data Modal ──────────────────────────────────────────────── -->
{#if showFieldModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="rp-modal-backdrop" on:click={closeFieldModal}>
    <div class="rp-modal" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="Edit profile data">
      <div class="rp-modal-header">
        <h3 class="rp-modal-title">Profile Data</h3>
        <button type="button" class="rp-modal-close" on:click={closeFieldModal} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="rp-modal-body">
        {#each modalRows as row, i}
          <div class="rp-modal-row">
            <input
              type="text"
              class="rp-modal-input rp-modal-key"
              value={row.key}
              on:input={(e) => updateModalRow(i, 'key', (e.target as HTMLInputElement).value)}
              placeholder="Key"
            />
            <input
              type="text"
              class="rp-modal-input rp-modal-val"
              value={row.value}
              on:input={(e) => updateModalRow(i, 'value', (e.target as HTMLInputElement).value)}
              placeholder="Value"
            />
            <button type="button" class="rp-modal-remove" on:click={() => removeModalRow(i)} aria-label="Remove field">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        {/each}

        <div class="rp-modal-row rp-modal-new">
          <input type="text" class="rp-modal-input rp-modal-key" bind:value={newKey} placeholder="New key" />
          <input type="text" class="rp-modal-input rp-modal-val" bind:value={newValue} placeholder="New value" />
          <button type="button" class="rp-modal-add" on:click={addModalRow} aria-label="Add field">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div class="rp-modal-footer">
        <button type="button" class="rp-modal-cancel" on:click={closeFieldModal}>Cancel</button>
        <button type="button" class="rp-modal-save" on:click={saveFieldModal}>Save</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Main Card ───────────────────────────────────────────────────────── -->
<section class="rp-card" aria-label="Reputation profile">

  <!-- Header: profile_id top-right, clickable to copy -->
  <header class="rp-header">
    <div class="rp-header-left"></div>
    <div class="rp-header-right">
      <button class="rp-wallet-btn" title="Click to copy full ID" on:click={copyProfileId}>
        <span class="rp-wallet-dot" aria-hidden="true"></span>
        {walletShort}
        <svg class="rp-copy-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
      {#if showCopied}
        <span class="rp-copied-toast" aria-live="polite">Copied!</span>
      {/if}
    </div>
  </header>

  <!-- LEVEL 1 — ERG hero + single primary CTA -->
  <div class="rp-hero">
    <div class="rp-hero-value">
      <span class="rp-hero-number">{burnedDisplay}</span>
      <span class="rp-hero-unit">ERG</span>
    </div>
    <p class="rp-hero-caption">Burned to this profile</p>
    {#if !readOnly}
      <button type="button" class="rp-cta" on:click={() => dispatch('burn')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Burn More ERG
      </button>
    {/if}
  </div>

  <!-- Profile Data — full width, card-grid design -->
  <div class="rp-data-section">
    <div class="rp-data-bar">
      <span class="rp-tile-title">Profile Data</span>
      {#if !readOnly}
        <button type="button" class="rp-ghost-btn" on:click={openFieldModal}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
      {/if}
    </div>
    {#if profileRows.length}
      <div class="rp-data-grid">
        {#each profileRows as row (row.key)}
          <div class="rp-data-card">
            <span class="rp-data-card-key">{row.key}</span>
            <span class="rp-data-card-value">{row.value}</span>
          </div>
        {/each}
      </div>
    {:else}
      <span class="rp-empty">No fields added</span>
    {/if}
  </div>

  <!-- Entity containers: 2×2 grid, collapsible -->
  <div class="rp-grid rp-grid-2">

    <!-- Skills -->
    <div class="rp-tile">
      <button class="rp-tile-header" on:click={() => toggleCollapse('skills')} aria-expanded={!collapsedSkills}>
        <span class="rp-tile-title">Skills{#if profileContributions.submittedSkills.length} ({profileContributions.submittedSkills.length}){/if}</span>
        <svg class="rp-chevron" class:rp-chevron-open={!collapsedSkills} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {#if !collapsedSkills}
        {#if profileContributions.submittedSkills.length}
          <ul class="rp-list">
            {#each profileContributions.submittedSkills as s (s.boxId)}
              <li>
                <button class="rp-list-row rp-list-clickable" on:click={() => navigateToSkill(s.boxId)} title={s.name}>
                  <span class="rp-list-primary">{s.name || shortId(s.boxId)}</span>
                  <span class="rp-list-meta">{formatReputation(s.reputation ?? 0)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <span class="rp-empty">No skills yet</span>
        {/if}
      {/if}
    </div>

    <!-- Benchmarks -->
    <div class="rp-tile">
      <button class="rp-tile-header" on:click={() => toggleCollapse('benchmarks')} aria-expanded={!collapsedBenchmarks}>
        <span class="rp-tile-title">Benchmarks{#if profileContributions.benchmarks.length} ({profileContributions.benchmarks.length}){/if}</span>
        <svg class="rp-chevron" class:rp-chevron-open={!collapsedBenchmarks} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {#if !collapsedBenchmarks}
        {#if profileContributions.benchmarks.length}
          <ul class="rp-list">
            {#each profileContributions.benchmarks as { skill: s, benchmark: b } (b.id)}
              <li>
                <button class="rp-list-row rp-list-clickable" on:click={() => navigateToSkill(s.boxId)} title={b.name}>
                  <span class="rp-list-primary">{b.name || shortId(b.id)}</span>
                  <span class="rp-list-context">on {s.name}</span>
                  <span class="rp-list-meta">{formatReputation(b.reputation ?? 0)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <span class="rp-empty">No benchmarks yet</span>
        {/if}
      {/if}
    </div>

    <!-- Services (bottom-left) -->
    <div class="rp-tile rp-tile-muted">
      <button class="rp-tile-header" on:click={() => toggleCollapse('services')} aria-expanded={!collapsedServices}>
        <span class="rp-tile-title">Services{#if profileContributions.coverages.length} ({profileContributions.coverages.length}){/if}</span>
        <svg class="rp-chevron" class:rp-chevron-open={!collapsedServices} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {#if !collapsedServices}
        {#if profileContributions.coverages.length}
          <ul class="rp-list">
            {#each profileContributions.coverages as { skill: s, coverage: c } (c.boxId)}
              <li>
                <button class="rp-list-row rp-list-clickable" on:click={() => navigateToSkill(s.boxId)} title={s.name}>
                  <span class="rp-list-primary">{s.name}</span>
                  <span class="rp-list-context">{shortId(c.serviceId || c.boxId)}</span>
                  <span class="rp-list-meta">{formatReputation(c.reputation ?? 0)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <span class="rp-empty">No services yet</span>
        {/if}
      {/if}
    </div>

    <!-- Results (bottom-right) -->
    <div class="rp-tile rp-tile-muted">
      <button class="rp-tile-header" on:click={() => toggleCollapse('results')} aria-expanded={!collapsedResults}>
        <span class="rp-tile-title">Results{#if profileContributions.results.length} ({profileContributions.results.length}){/if}</span>
        <svg class="rp-chevron" class:rp-chevron-open={!collapsedResults} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {#if !collapsedResults}
        {#if profileContributions.results.length}
          <ul class="rp-list">
            {#each profileContributions.results as { skill: s, benchmark: b, result: r } (r.id)}
              <li>
                <button class="rp-list-row rp-list-clickable" on:click={() => navigateToSkill(s.boxId)} title={b.name}>
                  <span class="rp-list-primary">{b.name}</span>
                  <span class="rp-list-context">{shortId(r.serviceId || r.id)}</span>
                  <span class="rp-list-meta">{formatReputation(r.reputation ?? 0)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <span class="rp-empty">No results yet</span>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Active Profile selector (hidden when readOnly) -->
  {#if !readOnly}
    <footer class="rp-selector">
      <span class="rp-section-title rp-selector-label">Active Profile</span>
      <div class="rp-selector-row">
        {#each selectorProfiles as p (p.token_id)}
          <button
            type="button"
            class="rp-chip"
            class:rp-chip-active={p.token_id === activeId}
            aria-pressed={p.token_id === activeId}
            title={p.token_id}
            on:click={() => selectProfile(p.token_id)}
          >
            <ProfileAvatar profileId={p.token_id} size={18} clickable={false} />
            <span class="rp-chip-id">{shortId(p.token_id)}</span>
          </button>
        {/each}
        <button type="button" class="rp-chip rp-chip-new" on:click={() => dispatch('createProfile')} title="Create a new profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New
        </button>
      </div>
    </footer>
  {/if}
</section>

<style>
  /* ── Base card ──────────────────────────────────────────────────────── */
  .rp-card {
    --rp-body: 0.9rem;
    border: 1px solid hsl(var(--border));
    border-radius: 1rem;
    padding: 1.5rem;
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    display: grid;
    gap: 1.75rem;
    margin-bottom: 1rem;
    font-size: var(--rp-body);
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .rp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .rp-header-left { /* empty spacer — "Reputation Profile" removed */ }
  .rp-header-right {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rp-wallet-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.55rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.45rem;
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .rp-wallet-btn:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 0.3);
  }
  .rp-wallet-btn:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  .rp-wallet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: hsl(var(--primary));
    flex-shrink: 0;
  }
  .rp-copy-icon { opacity: 0.5; flex-shrink: 0; }
  .rp-wallet-btn:hover .rp-copy-icon { opacity: 1; }

  .rp-copied-toast {
    position: absolute;
    top: -1.6rem;
    right: 0;
    font-size: 0.68rem;
    font-weight: 600;
    color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.12);
    border: 1px solid hsl(var(--primary) / 0.25);
    padding: 0.15rem 0.5rem;
    border-radius: 0.35rem;
    pointer-events: none;
    animation: rp-toast-in 200ms ease-out;
    white-space: nowrap;
  }
  @keyframes rp-toast-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
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
    font-size: 2.7rem;
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

  /* ── Profile Data — full width, card-grid design ────────────────────── */
  .rp-data-section {
    display: grid;
    gap: 0.75rem;
  }
  .rp-data-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .rp-data-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }
  .rp-data-card {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    padding: 0.5rem 0.65rem;
    background: hsl(var(--background));
    display: grid;
    gap: 0.15rem;
    overflow: hidden;
  }
  .rp-data-card-key {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rp-data-card-value {
    font-size: 0.82rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  /* ── Shared tile styles ─────────────────────────────────────────────── */
  .rp-section-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
  }
  .rp-tile-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
  }

  .rp-grid {
    display: grid;
    gap: 0.75rem;
  }
  .rp-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 560px) {
    .rp-grid-2 { grid-template-columns: 1fr; }
  }

  .rp-tile {
    border: 1px solid hsl(var(--border));
    border-radius: 0.75rem;
    padding: 0;
    background: hsl(var(--background));
    display: grid;
    gap: 0;
    align-content: start;
    overflow: hidden;
  }
  .rp-tile-muted {
    background: hsl(var(--muted) / 0.4);
    border-color: hsl(var(--border) / 0.7);
  }

  /* Collapsible tile header */
  .rp-tile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 0.9rem;
    border: none;
    border-bottom: 1px solid transparent;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background 120ms ease;
    text-align: left;
  }
  .rp-tile-header:hover {
    background: hsl(var(--muted) / 0.25);
  }
  .rp-tile-header[aria-expanded="true"] {
    border-bottom-color: hsl(var(--border));
  }
  .rp-tile-header:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: -2px;
  }

  .rp-chevron {
    flex-shrink: 0;
    transition: transform 180ms ease;
    color: hsl(var(--muted-foreground));
  }
  .rp-chevron-open {
    transform: rotate(180deg);
  }

  /* ── List rows ──────────────────────────────────────────────────────── */
  .rp-list {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0.9rem 0.75rem;
    display: grid;
    gap: 0.25rem;
  }
  .rp-list-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--rp-body);
    padding: 0.3rem 0;
    width: 100%;
    border: none;
    border-radius: 0.35rem;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
    transition: background 100ms ease;
  }
  .rp-list-clickable {
    cursor: pointer;
  }
  .rp-list-clickable:hover {
    background: hsl(var(--muted) / 0.35);
  }
  .rp-list-clickable:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: -2px;
  }
  .rp-list-primary {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .rp-list-context {
    flex-shrink: 0;
    font-size: 0.68rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 5.5rem;
  }
  .rp-list-meta {
    flex-shrink: 0;
    font-size: 0.72rem;
    color: hsl(var(--muted-foreground));
    font-variant-numeric: tabular-nums;
  }

  .rp-empty {
    font-size: 0.78rem;
    color: hsl(var(--muted-foreground));
    font-style: italic;
    padding: 0.25rem 0.9rem 0.65rem;
  }

  .rp-ghost-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
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
  .rp-selector-label { color: hsl(var(--muted-foreground)); }
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
    background: hsl(var(--muted) / 0.3);
    color: hsl(var(--muted-foreground));
    opacity: 0.65;
    font-size: 0.72rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    cursor: pointer;
    transition: opacity 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .rp-chip:hover:not(:disabled) { opacity: 0.9; }
  .rp-chip:disabled { cursor: default; }
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

  /* ── Modal ──────────────────────────────────────────────────────────── */
  .rp-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: hsl(var(--background) / 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: rp-fade-in 150ms ease;
  }
  @keyframes rp-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .rp-modal {
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 0.85rem;
    box-shadow: 0 12px 40px hsl(var(--foreground) / 0.15);
    overflow: hidden;
  }

  .rp-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.15rem;
    border-bottom: 1px solid hsl(var(--border));
  }
  .rp-modal-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
    color: hsl(var(--foreground));
  }
  .rp-modal-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 0.4rem;
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .rp-modal-close:hover {
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--foreground));
  }

  .rp-modal-body {
    padding: 0.75rem 1.15rem;
    overflow-y: auto;
    display: grid;
    gap: 0.5rem;
  }

  .rp-modal-row {
    display: grid;
    grid-template-columns: 1fr 1fr 28px;
    gap: 0.4rem;
    align-items: center;
  }
  .rp-modal-input {
    width: 100%;
    padding: 0.4rem 0.55rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.4rem;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.82rem;
    font-family: inherit;
    transition: border-color 120ms ease;
  }
  .rp-modal-input:focus {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
  }
  .rp-modal-key {
    font-weight: 500;
  }
  .rp-modal-val {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
  }

  .rp-modal-remove,
  .rp-modal-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid hsl(var(--border));
    border-radius: 0.4rem;
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    flex-shrink: 0;
    transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
  }
  .rp-modal-remove:hover {
    background: hsl(var(--destructive) / 0.1);
    border-color: hsl(var(--destructive) / 0.3);
    color: hsl(var(--destructive));
  }
  .rp-modal-add:hover {
    background: hsl(var(--primary) / 0.1);
    border-color: hsl(var(--primary) / 0.3);
    color: hsl(var(--primary));
  }
  .rp-modal-new {
    border-top: 1px dashed hsl(var(--border));
    padding-top: 0.5rem;
    margin-top: 0.15rem;
  }

  .rp-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.85rem 1.15rem;
    border-top: 1px solid hsl(var(--border));
  }
  .rp-modal-cancel {
    padding: 0.4rem 0.9rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.45rem;
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
  }
  .rp-modal-cancel:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--muted-foreground));
  }
  .rp-modal-save {
    padding: 0.4rem 1rem;
    border: none;
    border-radius: 0.45rem;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 120ms ease, box-shadow 120ms ease;
  }
  .rp-modal-save:hover {
    filter: brightness(1.05);
    box-shadow: 0 2px 8px hsl(var(--foreground) / 0.1);
  }
</style>