/**
 * Category iconography for Celaut Skills.
 *
 * A single source of truth mapping a skill's `domain` (a.k.a. category) to a
 * lucide-svelte icon component, plus a consistent color token per category for
 * scannable color-coding across the gallery and the detail view.
 *
 * The same five seed categories are defined in `CategoryFilter.svelte`
 * (`finance`, `infrastructure`, `analytics`, `security`, `ai/ml`). Any unknown
 * or user-supplied category falls back to a generic icon + neutral color so the
 * UI never renders a blank slot.
 *
 * Reuse: the skill detail view replaces its title glyph with
 * `categoryIcon(skill.domain)` and can read `categoryColor(skill.domain)` for a
 * matching accent — keep this helper presentation-agnostic.
 */
import type { ComponentType } from 'svelte';
import {
  Coins,
  Server,
  ChartColumn,
  ShieldCheck,
  BrainCircuit,
  Puzzle
} from 'lucide-svelte';

/** Visual identity for one category: its icon and an HSL accent hue token. */
export interface CategoryVisual {
  /** lucide-svelte icon component for this category. */
  icon: ComponentType;
  /**
   * Accent color as a bare HSL triplet (e.g. `"217 91% 60%"`), usable directly
   * inside `hsl(... )` / `hsl(... / <alpha>)`. Kept theme-agnostic so callers
   * can apply their own opacity for fills, borders, or text.
   */
  hsl: string;
  /** Human-facing category label (Title Case). */
  label: string;
}

const GENERIC: CategoryVisual = {
  icon: Puzzle as unknown as ComponentType,
  hsl: '220 9% 46%',
  label: 'Other'
};

/**
 * Canonical visuals keyed by the normalized category value (lower-cased, the
 * same form stored in `skill.domain`). Keep keys aligned with the seed list in
 * CategoryFilter so every seed category resolves to a dedicated icon.
 */
const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  finance: { icon: Coins as unknown as ComponentType, hsl: '142 71% 45%', label: 'Finance' },
  infrastructure: { icon: Server as unknown as ComponentType, hsl: '24 95% 53%', label: 'Infrastructure' },
  analytics: { icon: ChartColumn as unknown as ComponentType, hsl: '217 91% 60%', label: 'Analytics' },
  security: { icon: ShieldCheck as unknown as ComponentType, hsl: '0 72% 51%', label: 'Security' },
  'ai/ml': { icon: BrainCircuit as unknown as ComponentType, hsl: '271 81% 56%', label: 'AI/ML' }
};

/** Aliases that map alternate spellings onto a canonical category key. */
const ALIASES: Record<string, string> = {
  ai: 'ai/ml',
  'ai/mi': 'ai/ml',
  'ai-ml': 'ai/ml',
  ml: 'ai/ml',
  'machine-learning': 'ai/ml',
  fintech: 'finance',
  defi: 'finance',
  infra: 'infrastructure',
  devops: 'infrastructure',
  sec: 'security',
  data: 'analytics',
  analysis: 'analytics'
};

/** Normalize a raw category/domain string to a canonical lookup key. */
function normalize(category: string | null | undefined): string {
  const key = (category ?? '').trim().toLowerCase();
  return ALIASES[key] ?? key;
}

/**
 * Resolve the full visual identity (icon + accent + label) for a category.
 * Always returns a value — unknown categories yield the generic fallback.
 */
export function categoryVisual(category: string | null | undefined): CategoryVisual {
  return CATEGORY_VISUALS[normalize(category)] ?? GENERIC;
}

/**
 * Resolve the lucide-svelte icon component for a category, with a generic
 * fallback for unknown categories. This is the primary helper consumers use to
 * swap a profile/avatar glyph for a category icon.
 */
export function categoryIcon(category: string | null | undefined): ComponentType {
  return categoryVisual(category).icon;
}

/** Bare HSL accent triplet for a category (for use inside `hsl(...)`). */
export function categoryColor(category: string | null | undefined): string {
  return categoryVisual(category).hsl;
}
