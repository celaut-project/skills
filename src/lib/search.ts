/**
 * Client-side search over the loaded Skill catalog. No backend: the catalog is
 * small (loaded once from the chain into the `skills` store) and both indexes
 * below are cheap to rebuild whenever it changes.
 *
 * Two tiers:
 *   1. MiniSearch — the primary engine. `combineWith: 'AND'` requires every
 *      query term to match *some* field (fixing the old plain-substring filter,
 *      which only matched if the whole query appeared in one field), `prefix`
 *      gives as-you-type results, and per-token `fuzzy` catches minor typos.
 *   2. Fuse.js — a fallback used only when tier 1 finds nothing. It scores
 *      approximate matches over the whole string, which catches a typo too
 *      rough for MiniSearch's per-token fuzzy or a badly segmented word.
 */
import MiniSearch from 'minisearch';
import Fuse from 'fuse.js';
import type { Skill } from './types';

const SEARCH_FIELDS = ['name', 'prose', 'tags', 'domain'] as const;

function extractField(skill: Skill, field: string): string {
  const value = (skill as unknown as Record<string, unknown>)[field];
  if (Array.isArray(value)) return value.join(' ');
  return typeof value === 'string' ? value : '';
}

let miniIndex: MiniSearch<Skill> | null = null;
let fuseIndex: Fuse<Skill> | null = null;
let indexedSkills: Skill[] = [];

/** (Re)build both indexes over `skills`. Cheap enough to call on every load. */
export function buildSearchIndex(skills: Skill[]): void {
  indexedSkills = skills;

  miniIndex = new MiniSearch<Skill>({
    idField: 'boxId',
    fields: [...SEARCH_FIELDS],
    extractField,
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
      boost: { name: 3, tags: 2, domain: 1.5, prose: 1 }
    }
  });
  miniIndex.addAll(skills);

  fuseIndex = new Fuse(skills, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'tags', weight: 0.3 },
      { name: 'domain', weight: 0.15 },
      { name: 'prose', weight: 0.05 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  });
}

/**
 * Tier 2 fallback: Fuse.js matches a whole query string approximately, which on
 * its own drops the AND-across-terms guarantee tier 1 gives (a query like
 * "markdown ergo" would otherwise pass just because "markdown" alone scores
 * well). Searching each term separately and intersecting keeps "every term has
 * to match somewhere" while still tolerating a rough typo per term.
 */
function fuseFallback(query: string): Skill[] {
  if (!fuseIndex) return [];
  const terms = query.split(/\s+/).filter(Boolean);

  let matched: Set<Skill> | null = null;
  for (const term of terms) {
    const termMatches = new Set(fuseIndex.search(term).map((result) => result.item));
    if (matched === null) {
      matched = termMatches;
    } else {
      const intersection = new Set<Skill>();
      for (const skill of matched) {
        if (termMatches.has(skill)) intersection.add(skill);
      }
      matched = intersection;
    }
    if (matched.size === 0) return [];
  }
  return matched ? Array.from(matched) : [];
}

/** Search the last-built index. An empty/blank query returns every skill. */
export function searchSkills(query: string): Skill[] {
  const trimmed = query.trim();
  if (!trimmed || !miniIndex || !fuseIndex) return indexedSkills;

  const hits = miniIndex.search(trimmed);
  if (hits.length > 0) {
    const byId = new Map(indexedSkills.map((skill) => [skill.boxId, skill]));
    return hits.map((hit) => byId.get(String(hit.id))).filter((skill): skill is Skill => Boolean(skill));
  }

  return fuseFallback(trimmed);
}
