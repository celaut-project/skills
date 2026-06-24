/**
 * Category → lucide icon mapping.
 *
 * Maps each skill `domain` (a.k.a. category) to a representative lucide-svelte
 * icon component. Seed categories get a bespoke icon; anything else falls back
 * to a generic "puzzle piece" so unknown categories still render a glyph.
 *
 * NOTE: minimal in-worktree implementation created by the skill-detail agent.
 * A parallel agent owns the canonical `$lib/categoryIcons`; if both land, the
 * orchestrator should dedupe to a single module exposing this same
 * `categoryIcon(category)` API.
 */
import {
  TrendingUp,
  Server,
  BarChart3,
  ShieldCheck,
  BrainCircuit,
  Puzzle
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

/** Normalize a raw domain string to a lookup key. */
function normalize(category: string | null | undefined): string {
  return (category ?? '').trim().toLowerCase();
}

const ICONS: Record<string, ComponentType> = {
  finance: TrendingUp,
  infrastructure: Server,
  analytics: BarChart3,
  security: ShieldCheck,
  'ai/ml': BrainCircuit
};

/**
 * Return the lucide icon component for a category/domain.
 * Falls back to a generic icon for unknown categories.
 */
export function categoryIcon(category: string | null | undefined): ComponentType {
  return ICONS[normalize(category)] ?? Puzzle;
}
