<script lang="ts">
  /**
   * NetworkSidebar — Searchable list of network definitions.
   *
   * Handles search input, network list rendering with consistent
   * item sizing, and clear active/hover states.
   */
  import type { StrictDefinitionBox } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let networks: StrictDefinitionBox[] = [];
  export let loading = false;
  export let searchQuery = '';
  export let selectedBoxId: string | null = null;

  function handleSearch(e: Event) {
    const target = e.target as HTMLInputElement;
    dispatch('search', target.value);
  }

  const dispatch = createEventDispatcher<{
    search: string;
    select: StrictDefinitionBox;
    create: void;
  }>();
</script>

<aside class="sidebar" aria-label="Network definitions list">
  <!-- Search + create row -->
  <div class="sidebar__controls">
    <label for="network-search" class="sidebar__search-label">Search</label>
    <div class="sidebar__search-row">
      <input
        id="network-search"
        class="sidebar__search"
        type="search"
        value={searchQuery}
        on:input={handleSearch}
        placeholder="Filter networks…"
        aria-label="Search network definitions"
      />
      <button
        type="button"
        class="sidebar__create-btn"
        on:click={() => dispatch('create')}
        aria-label="Create new network definition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>New</span>
      </button>
    </div>
  </div>

  <!-- Network list -->
  <div class="sidebar__list-wrapper" role="listbox" aria-label="Network definitions">
    {#if loading}
      <div class="sidebar__loading">
        <span class="sidebar__spinner" aria-hidden="true"></span>
        Loading…
      </div>
    {:else if networks.length === 0}
      <p class="sidebar__empty">
        {searchQuery ? 'No matching networks' : 'No network definitions yet'}
      </p>
    {:else}
      {#each networks as def (def.boxId)}
        <button
          type="button"
          class="sidebar__item"
          class:sidebar__item--active={selectedBoxId === def.boxId}
          role="option"
          aria-selected={selectedBoxId === def.boxId}
          on:click={() => dispatch('select', def)}
        >
          <span class="sidebar__item-tag">{def.content.tag}</span>
          <span class="sidebar__item-prose">
            {def.content.prose || 'No description'}
          </span>
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style lang="postcss">
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: sticky;
    top: 24px;
    max-height: calc(100vh - 120px);
  }

  /* ── Controls ──────────────────────────────────────────────────────────── */
  .sidebar__controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sidebar__search-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: hsl(var(--muted-foreground) / 0.7);
    padding-left: 2px;
  }
  .sidebar__search-row {
    display: flex;
    gap: 8px;
  }
  .sidebar__search {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid hsl(var(--border) / 0.6);
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 13px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .sidebar__search::placeholder {
    color: hsl(var(--muted-foreground) / 0.5);
  }
  .sidebar__search:focus {
    outline: none;
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
  }

  .sidebar__create-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid hsl(var(--primary) / 0.3);
    background: hsl(var(--primary) / 0.08);
    color: hsl(var(--primary));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .sidebar__create-btn:hover {
    background: hsl(var(--primary) / 0.15);
    border-color: hsl(var(--primary) / 0.5);
  }
  .sidebar__create-btn:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }

  /* ── List wrapper (scrollable) ─────────────────────────────────────────── */
  .sidebar__list-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 12px;
    background: hsl(var(--muted) / 0.04);
    /* Thin custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--border) / 0.4) transparent;
  }
  .sidebar__list-wrapper::-webkit-scrollbar {
    width: 5px;
  }
  .sidebar__list-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar__list-wrapper::-webkit-scrollbar-thumb {
    background: hsl(var(--border) / 0.4);
    border-radius: 3px;
  }

  /* ── List items ────────────────────────────────────────────────────────── */
  .sidebar__item {
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .sidebar__item:hover {
    background: hsl(var(--muted) / 0.2);
  }
  .sidebar__item:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: -2px;
  }

  /* Active state: clear visual indicator */
  .sidebar__item--active {
    background: hsl(var(--primary) / 0.1);
    border-color: hsl(var(--primary) / 0.35);
  }
  .sidebar__item--active:hover {
    background: hsl(var(--primary) / 0.14);
  }

  .sidebar__item-tag {
    font-size: 13px;
    font-weight: 600;
    color: hsl(var(--foreground));
    line-height: 1.3;
  }
  .sidebar__item--active .sidebar__item-tag {
    color: hsl(var(--primary));
  }
  .sidebar__item-prose {
    font-size: 12px;
    color: hsl(var(--muted-foreground));
    line-height: 1.4;
    /* Consistent two-line clamp */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Loading & empty ───────────────────────────────────────────────────── */
  .sidebar__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    font-size: 13px;
    color: hsl(var(--muted-foreground));
  }
  .sidebar__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid hsl(var(--border) / 0.5);
    border-top-color: hsl(var(--primary));
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .sidebar__empty {
    font-size: 13px;
    color: hsl(var(--muted-foreground));
    text-align: center;
    padding: 32px 16px;
    margin: 0;
    line-height: 1.5;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .sidebar {
      position: static;
      max-height: none;
    }
    .sidebar__list-wrapper {
      max-height: 240px;
    }
  }
</style>