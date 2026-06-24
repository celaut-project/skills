<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filteredSkills, loading, searchQuery, skills } from '$lib/stores';
  import { loadSkills as fetchSkills } from '$lib/api';
  import { NANOERG_PER_ERG } from '$lib/reputation';
  import SkillCard from './SkillCard.svelte';
  import CategoryFilter from './CategoryFilter.svelte';
  import SortDropdown from './SortDropdown.svelte';
  import { Search, X, Plus, GitCompare, RotateCw } from 'lucide-svelte';
  import type { Skill } from '$lib/types';

  /** Navigate to a skill's detail view. */
  export let onSelectSkill: (skill: Skill) => void;
  /** Optional: triggered by the "Register New Skill" CTA (e.g. switch to Submit tab). */
  export let onRegister: (() => void) | undefined = undefined;
  /** Optional: triggered when the user confirms a comparison selection. */
  export let onCompare: ((skills: Skill[]) => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{ register: void; compare: Skill[] }>();

  let activeCategory = 'all';
  let currentSort = 'reputation';
  let minRepErg = 0; // preset threshold in ERG (0 = Any)

  // Comparison mode
  let compareMode = false;
  let selectedIds = new Set<string>();

  const repPresets = [
    { value: 0, label: 'Any reputation' },
    { value: 1, label: '≥ 1 ERG' },
    { value: 10, label: '≥ 10 ERG' },
    { value: 50, label: '≥ 50 ERG' },
    { value: 100, label: '≥ 100 ERG' }
  ];

  async function refresh() {
    $loading = true;
    $skills = await fetchSkills();
    $loading = false;
  }

  function filterByCategory(list: Skill[], category: string): Skill[] {
    if (category === 'all') return list;
    return list.filter((s) => s.domain?.toLowerCase() === category.toLowerCase());
  }

  function filterByReputation(list: Skill[], minErg: number): Skill[] {
    if (!minErg) return list;
    const floor = minErg * NANOERG_PER_ERG;
    return list.filter((s) => (s.reputation ?? 0) >= floor);
  }

  function sortSkills(list: Skill[], sort: string): Skill[] {
    const sorted = [...list];
    switch (sort) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'services':
        return sorted.sort((a, b) => b.coverages.length - a.coverages.length);
      case 'results':
        return sorted.sort((a, b) => (b.resultCount ?? 0) - (a.resultCount ?? 0));
      case 'reputation':
        return sorted.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
      case 'newest':
        return sorted.reverse();
      default:
        return sorted;
    }
  }

  $: displayedSkills = sortSkills(
    filterByReputation(filterByCategory($filteredSkills, activeCategory), minRepErg),
    currentSort
  );

  $: selectedSkills = $skills.filter((s) => selectedIds.has(s.boxId));
  $: hasActiveFilters = !!$searchQuery || activeCategory !== 'all' || minRepErg > 0;

  function handleCompareToggle(e: CustomEvent<{ skill: Skill; selected: boolean }>) {
    const { skill, selected } = e.detail;
    if (selected) selectedIds.add(skill.boxId);
    else selectedIds.delete(skill.boxId);
    selectedIds = new Set(selectedIds); // trigger reactivity
  }

  function clearComparison() {
    selectedIds = new Set();
  }

  function toggleCompareMode() {
    compareMode = !compareMode;
    if (!compareMode) clearComparison();
  }

  function confirmCompare() {
    if (selectedSkills.length < 2) return;
    onCompare?.(selectedSkills);
    dispatch('compare', selectedSkills);
  }

  function register() {
    onRegister?.();
    dispatch('register');
  }
</script>

<!-- Category filter (color-coded chips with per-category counts) -->
<CategoryFilter {activeCategory} skills={$skills} on:filter={(e) => { activeCategory = e.detail; }} />

<!-- Dominant search + controls bar -->
<div class="control-bar">
  <div class="search">
    <Search class="search-icon" size={20} strokeWidth={2} aria-hidden="true" />
    <input
      type="text"
      bind:value={$searchQuery}
      placeholder="Search skills, tags, domains…"
      class="search-input"
      aria-label="Search skills"
    />
    {#if $searchQuery}
      <button class="search-clear" on:click={() => ($searchQuery = '')} aria-label="Clear search" title="Clear search">
        <X size={16} strokeWidth={2.5} />
      </button>
    {/if}
  </div>

  <div class="controls">
    <SortDropdown {currentSort} on:sort={(e) => { currentSort = e.detail; }} />

    <label class="rep-filter">
      <span class="rep-label">Min Rep</span>
      <select bind:value={minRepErg} class="rep-select" aria-label="Minimum reputation">
        {#each repPresets as p}
          <option value={p.value}>{p.label}</option>
        {/each}
      </select>
    </label>

    <button
      class="compare-toggle"
      class:compare-toggle-on={compareMode}
      on:click={toggleCompareMode}
      title="Select skills to compare side by side"
    >
      <GitCompare size={15} strokeWidth={2} />
      Compare
    </button>

    <button class="refresh-btn" on:click={refresh} title="Reload skills from chain" aria-label="Refresh">
      <RotateCw size={15} strokeWidth={2} />
    </button>
  </div>
</div>

<!-- Result count line -->
<p class="result-count">
  {displayedSkills.length} skill{displayedSkills.length !== 1 ? 's' : ''}
  {$searchQuery ? `matching "${$searchQuery}"` : ''}
  {activeCategory !== 'all' ? `in ${activeCategory}` : ''}
</p>

{#if $loading}
  <div class="loading-state">
    <div class="spinner"></div>
    <span>Loading skills from chain…</span>
  </div>
{:else if displayedSkills.length === 0}
  <div class="empty-state">
    <p class="empty-title">No skills found</p>
    {#if hasActiveFilters}
      <p class="empty-sub">Try a different search term, category, or lower the minimum reputation.</p>
    {:else}
      <p class="empty-sub">Be the first to register a skill.</p>
    {/if}
  </div>
{:else}
  <div class="skills-grid">
    {#each displayedSkills as skill (skill.boxId)}
      <SkillCard
        {skill}
        selectable={compareMode}
        selected={selectedIds.has(skill.boxId)}
        onClick={() => onSelectSkill(skill)}
        on:compare={handleCompareToggle}
      />
    {/each}
  </div>
{/if}

<!-- Register CTA -->
<div class="cta-row">
  <button class="register-cta" on:click={register}>
    <Plus size={17} strokeWidth={2.5} />
    Register New Skill
  </button>
</div>

<!-- Comparison tray -->
{#if compareMode && selectedSkills.length > 0}
  <div class="compare-tray" role="region" aria-label="Comparison selection">
    <span class="compare-tray-count">{selectedSkills.length} selected</span>
    <span class="compare-tray-names">{selectedSkills.map((s) => s.name).join(' · ')}</span>
    <button class="compare-tray-clear" on:click={clearComparison}>Clear</button>
    <button class="compare-tray-go" disabled={selectedSkills.length < 2} on:click={confirmCompare}>
      <GitCompare size={15} strokeWidth={2} />
      Compare ({selectedSkills.length})
    </button>
  </div>
{/if}

<style lang="postcss">
  /* ── Dominant search bar ─────────────────────────────────────────────── */
  .control-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 360px;
    min-width: 240px;
  }
  .search :global(.search-icon) {
    position: absolute;
    left: 0.875rem;
    color: hsl(var(--muted-foreground));
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    height: 3rem;
    padding: 0 2.75rem;
    font-size: 0.9375rem;
    border-radius: 0.75rem;
    border: 1.5px solid hsl(var(--border));
    background: hsl(var(--card));
    color: hsl(var(--foreground));
    box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .search-input::placeholder {
    color: hsl(var(--muted-foreground));
  }
  .search-input:focus {
    outline: none;
    border-color: hsl(var(--primary) / 0.7);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15);
  }
  .search-clear {
    position: absolute;
    right: 0.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .search-clear:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .rep-filter {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .rep-label {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }
  .rep-select {
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.8125rem;
    cursor: pointer;
    outline: none;
  }
  .rep-select:focus {
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
  }

  .compare-toggle,
  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--muted-foreground));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .compare-toggle:hover,
  .refresh-btn:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--foreground) / 0.3);
  }
  .compare-toggle-on {
    background: hsl(var(--primary) / 0.12);
    border-color: hsl(var(--primary) / 0.5);
    color: hsl(var(--primary));
  }
  .refresh-btn {
    padding: 0.4rem 0.55rem;
  }

  .result-count {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 1rem;
  }

  /* ── Grid ────────────────────────────────────────────────────────────── */
  .skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  /* ── States ──────────────────────────────────────────────────────────── */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 5rem 0;
    color: hsl(var(--muted-foreground));
  }
  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    border: 2px solid hsl(var(--muted));
    border-top-color: hsl(var(--primary));
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state {
    text-align: center;
    padding: 5rem 0;
  }
  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
  }
  .empty-sub {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    margin-top: 0.5rem;
  }

  /* ── Register CTA ────────────────────────────────────────────────────── */
  .cta-row {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }
  .register-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    border: none;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px -4px hsl(var(--primary) / 0.5);
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .register-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px -4px hsl(var(--primary) / 0.6);
    filter: brightness(1.05);
  }
  .register-cta:active {
    transform: translateY(0);
  }

  /* ── Comparison tray ─────────────────────────────────────────────────── */
  .compare-tray {
    position: sticky;
    bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--primary) / 0.4);
    background: hsl(var(--card));
    box-shadow: 0 8px 24px -8px hsl(var(--foreground) / 0.2);
  }
  .compare-tray-count {
    font-size: 0.8125rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    white-space: nowrap;
  }
  .compare-tray-names {
    flex: 1;
    min-width: 0;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .compare-tray-clear {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    padding: 0.4rem 0.5rem;
  }
  .compare-tray-clear:hover {
    color: hsl(var(--foreground));
  }
  .compare-tray-go {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.875rem;
    border-radius: 0.5rem;
    border: none;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .compare-tray-go:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .control-bar { flex-direction: column; align-items: stretch; }
    .controls { justify-content: space-between; }
  }
</style>
