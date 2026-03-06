/**
 * Svelte stores for Celaut Skills app state.
 * Svelte 4 — uses writable/derived (NOT runes).
 */

import { writable, derived } from 'svelte/store';
import type { Skill, ActiveTab } from './types';

// ── Core Stores ──────────────────────────────────────────────────────────────

/** All loaded skills (from chain or demo fallback). */
export const skills = writable<Skill[]>([]);

/** Currently selected skill for detail view, or null for gallery. */
export const selectedSkill = writable<Skill | null>(null);

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
