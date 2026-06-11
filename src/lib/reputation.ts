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
 * Calculate reputation for a Skill.
 *
 * Formula: coverages + benchmarks + totalResults + avgResultScore
 * - coverages: number of services covering this skill
 * - benchmarks: number of benchmark definitions
 * - totalResults: total result submissions across all benchmarks
 * - avgResultScore: average score across all results (normalized 0-10)
 */
export function calculateSkillReputation(skill: Skill): ReputationScore {
  const total = skill.reputation ?? 0;

  return {
    total: Math.round(total * 100) / 100,
    label: getReputationLabel(total),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

/**
 * Calculate reputation for a Benchmark.
 *
 * Formula: numberOfResults + avgScore (normalized)
 */
export function calculateBenchmarkReputation(benchmark: Benchmark): ReputationScore {
  const total = benchmark.reputation ?? 0;

  return {
    total: Math.round(total * 100) / 100,
    label: getReputationLabel(total),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

/**
 * Calculate reputation for a Coverage based on how many results
 * reference the same service across all skills.
 */
export function calculateCoverageReputation(
  coverage: Coverage,
  _allSkills: Skill[]
): ReputationScore {
  const total = coverage.reputation ?? 0;

  return {
    total,
    label: getReputationLabel(total),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

export function calculateResultReputation(result: Result): ReputationScore {
  const total = result.reputation ?? 0;

  return {
    total,
    label: getReputationLabel(total),
    breakdown: { sacrifice: Math.round(total * 100) / 100 }
  };
}

/**
 * Get a human-readable label for a reputation score.
 */
function getReputationLabel(score: number): string {
  if (score >= 20) return 'Excellent';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  if (score >= 1) return 'Low';
  return 'New';
}

/**
 * Format a reputation score for display.
 */
export function formatReputation(score: number): string {
  if (score >= 100) return score.toFixed(0);
  if (score >= 10) return score.toFixed(1);
  return score.toFixed(2);
}
