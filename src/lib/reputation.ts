/**
 * Reputation scoring for Celaut Skills elements.
 *
 * Calculates reputation scores for skills, benchmarks, and coverages
 * based on activity metrics (coverages, benchmarks, results, scores).
 */

import type { Skill, Benchmark, Coverage, Result } from './types';

/** Reputation score result with breakdown. */
export interface ReputationScore {
  /** Overall reputation score. */
  total: number;
  /** Human-readable label (e.g. "High", "Medium", "Low"). */
  label: string;
  /** Breakdown of score components. */
  breakdown: Record<string, number>;
}

/**
 * A precomputed relative-labeling scale over a population of sibling scores.
 *
 * Build this ONCE for a set of siblings (e.g. all skills, all benchmarks of a
 * skill) and reuse it for every member — never rebuild it inside a per-element
 * loop. `labelForScore` then classifies any score against the population.
 */
export interface ReputationScale {
  /** Sibling scores sorted ascending. */
  readonly sorted: number[];
  /** Population size. */
  readonly n: number;
}

const EPSILON = 1e-9;

/** Build a relative-labeling scale from a population of sibling scores. */
export function buildReputationScale(scores: number[]): ReputationScale {
  const sorted = [...scores].sort((a, b) => a - b);
  return { sorted, n: sorted.length };
}

/**
 * Midrank percentile of `score` within the population (0..1).
 *
 * Uses the average-rank convention so heavily-tied populations behave sanely:
 * an outlier above a flat population lands near 1.0, the flat bulk lands near
 * the middle, and an outlier below lands near 0.0.
 */
function percentileRank(score: number, scale: ReputationScale): number {
  const { sorted, n } = scale;
  if (n === 0) return 0.5;
  let less = 0;
  let lessOrEqual = 0;
  for (const v of sorted) {
    if (v < score - EPSILON) {
      less += 1;
      lessOrEqual += 1;
    } else if (v <= score + EPSILON) {
      lessOrEqual += 1;
    }
  }
  return (less + lessOrEqual) / 2 / n;
}

/**
 * Relative reputation label for a score, judged against its siblings.
 *
 * Labels are RELATIVE to the population — an element that stands out is
 * `Excellent` and one that lags is `Low`/`Very Low`, regardless of absolute
 * value (a 10 among 5s is Excellent; a 10 among 5000s is Very Low).
 *
 * Bands (by percentile):
 *  - base case (population < 2): `Medium`
 *  - top 15% (p ≥ 0.85): `Excellent`
 *  - p 0.50–0.85: `High`
 *  - p 0.25–0.50: `Medium`
 *  - p 0.05–0.25: `Low`
 *  - bottom 5% (p < 0.05): `Very Low`, or `New` when the score is ~0
 */
export function labelForScore(score: number, scale: ReputationScale): string {
  if (scale.n < 2) return 'Medium';
  const p = percentileRank(score, scale);
  if (p >= 0.85) return 'Excellent';
  if (p >= 0.5) return 'High';
  if (p >= 0.25) return 'Medium';
  if (p >= 0.05) return 'Low';
  return score <= EPSILON ? 'New' : 'Very Low';
}

/**
 * Convenience: label a score against a raw population of sibling scores.
 * Builds the scale on the fly — for a single element only. To label many
 * elements, call `buildReputationScale` once and `labelForScore` per element.
 */
function relativeLabel(score: number, siblingScores?: number[]): string {
  if (!siblingScores || siblingScores.length < 2) return 'Medium';
  return labelForScore(score, buildReputationScale(siblingScores));
}

/**
 * Calculate reputation for a Skill.
 *
 * Formula: coverages + benchmarks + totalResults + avgResultScore
 * - coverages: number of services covering this skill
 * - benchmarks: number of benchmark definitions
 * - totalResults: total result submissions across all benchmarks
 * - avgResultScore: average score across all results (normalized 0-10)
 */
export function calculateSkillReputation(skill: Skill, siblings?: Skill[]): ReputationScore {
  const total = skill.reputation ?? 0;
  const rounded = Math.round(total * 100) / 100;

  return {
    total: rounded,
    label: relativeLabel(total, siblings?.map((s) => s.reputation ?? 0)),
    breakdown: { sacrifice: rounded }
  };
}

/**
 * Calculate reputation for a Benchmark.
 *
 * Formula: numberOfResults + avgScore (normalized)
 */
export function calculateBenchmarkReputation(benchmark: Benchmark, siblings?: Benchmark[]): ReputationScore {
  const total = benchmark.reputation ?? 0;
  const rounded = Math.round(total * 100) / 100;

  return {
    total: rounded,
    label: relativeLabel(total, siblings?.map((b) => b.reputation ?? 0)),
    breakdown: { sacrifice: rounded }
  };
}

/**
 * Calculate reputation for a Coverage based on how many results
 * reference the same service across all skills.
 */
export function calculateCoverageReputation(
  coverage: Coverage,
  siblings?: Coverage[]
): ReputationScore {
  const total = coverage.reputation ?? 0;

  return {
    total,
    label: relativeLabel(total, siblings?.map((c) => c.reputation ?? 0)),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

export function calculateResultReputation(result: Result, siblings?: Result[]): ReputationScore {
  const total = result.reputation ?? 0;

  return {
    total,
    label: relativeLabel(total, siblings?.map((r) => r.reputation ?? 0)),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

/** nanoERG per 1 ERG. Reputation is stored on-chain as burned nanoERG. */
export const NANOERG_PER_ERG = 1e9;

/**
 * Format a reputation score for display, in ERG.
 *
 * Stored reputation values are burned ERG amounts in nanoERG (as returned by
 * the reputation-system `calculate_reputation`). This converts to ERG and
 * appends an "ERG"/"ERGs" suffix (singular only when the amount is exactly 1).
 *
 * Reputation always renders to exactly 4 decimal places (e.g. `0.0000`) so
 * small sacrifices stay distinguishable and the column reads consistently.
 */
export function formatReputation(score: number): string {
  const erg = (score ?? 0) / NANOERG_PER_ERG;
  const num = erg.toFixed(4);
  const unit = erg === 1 ? 'ERG' : 'ERGs';
  return `${num} ${unit}`;
}
