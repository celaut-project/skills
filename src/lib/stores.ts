/**
 * Svelte stores for Celaut Skills app state.
 * Svelte 4 — uses writable/derived (NOT runes).
 */

import { writable, derived } from 'svelte/store';
import type { Skill, Benchmark, ActiveTab } from './types';

// ── Core Stores ──────────────────────────────────────────────────────────────

/** All loaded skills (from chain or demo fallback). */
export const skills = writable<Skill[]>([]);

/** Currently selected skill for detail view, or null for gallery. */
export const selectedSkill = writable<Skill | null>(null);

/** Currently selected benchmark for detail view, or null. */
export const selectedBenchmark = writable<Benchmark | null>(null);

/** Current search query for filtering skills. */
export const searchQuery = writable<string>('');

/** Active navigation tab. */
export const activeTab = writable<ActiveTab>('gallery');

/** Loading state for skill fetching. */
export const loading = writable<boolean>(true);

/** Error message if skill loading fails. */
export const error = writable<string | null>(null);

// ── Derived Stores ───────────────────────────────────────────────────────────

/** Filtered skills based on the current search query. */
export const filteredSkills = derived(
  [skills, searchQuery],
  ([$skills, $searchQuery]) => {
    if (!$searchQuery) return $skills;
    const q = $searchQuery.toLowerCase();
    return $skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.prose.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        s.domain.toLowerCase().includes(q)
    );
  }
);

/** Total results across all skills. */
export const totalResults = derived(skills, ($skills) =>
  $skills.reduce((sum, s) => sum + s.resultCount, 0)
);

/**
 * Profile id selected for the profile-detail view, or null for no selection.
 * Set when a user clicks any ProfileAvatar (or arrives via the `?profile=`
 * URL parameter) and consumed by App.svelte to render the profile screen.
 */
export const viewedProfileId = writable<string | null>(null);

/**
 * Network box id for the ?network= page, or null.
 * Set to a box id to view/manage a specific network definition,
 * or 'new' to open the create-network form.
 */
export const viewedNetworkId = writable<string | null>(null);

/**
 * Service id for the ?service= page, or null.
 */
export const viewedServiceId = writable<string | null>(null);

/**
 * Where to return when leaving the network page. Null when the user
 * navigated directly (e.g. shared URL).
 */
export const networkPageReturn = writable<{ type: 'service'; serviceId: string } | { type: 'serviceForm' } | null>(null);

/** Preserved service data form state — survives navigation to the network page. */
export interface ServiceDataFormState {
  serviceId: string;
  prose: string;
  containerArchitecture: string;
  apiSlots: Array<{ port: string; transport: string[]; protocol: string[] }>;
  networkItems: Array<{ type: 'inline'; tags: string[] } | { type: 'ref'; boxId: string }>;
  metadataJson: string;
  kind: 'data' | 'metadata';
}

export const serviceDataFormState = writable<ServiceDataFormState | null>(null);
