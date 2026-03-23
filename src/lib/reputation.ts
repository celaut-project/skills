/**
 * Reputation scoring for Celaut Skills elements.
 *
 * Calculates reputation scores for skills, benchmarks, and coverages
 * based on activity metrics (coverages, benchmarks, results, scores).
 */

import type { Skill, Benchmark, Coverage } from './types';

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
  const coverages = skill.coverages.length;
  const benchmarks = skill.benchmarks.length;

  // Collect all results across all benchmarks
  const allResults = skill.benchmarks.flatMap(b => b.results);
  const totalResults = allResults.length;

  // Calculate average score (raw — not normalized, since scales vary per benchmark)
  let avgScore = 0;
  if (totalResults > 0) {
    avgScore = allResults.reduce((sum, r) => sum + r.score, 0) / totalResults;
  }

  // Normalize avgScore to 0-10 range for fair weighting
  // Since scores can be percentages (0-100), ratios (0-1), or other scales,
  // we cap the contribution at 10 points
  const normalizedAvgScore = Math.min(avgScore, 10);

  const total = coverages + benchmarks + totalResults + normalizedAvgScore;

  return {
    total: Math.round(total * 100) / 100,
    label: getReputationLabel(total),
    breakdown: {
      coverages,
      benchmarks,
      totalResults,
      avgScore: Math.round(normalizedAvgScore * 100) / 100
    }
  };
}

/**
 * Calculate reputation for a Benchmark.
 *
 * Formula: numberOfResults + avgScore (normalized)
 */
export function calculateBenchmarkReputation(benchmark: Benchmark): ReputationScore {
  const resultCount = benchmark.results.length;
  let avgScore = 0;
  if (resultCount > 0) {
    avgScore = benchmark.results.reduce((sum, r) => sum + r.score, 0) / resultCount;
  }
  const normalizedAvgScore = Math.min(avgScore, 10);
  const total = resultCount + normalizedAvgScore;

  return {
    total: Math.round(total * 100) / 100,
    label: getReputationLabel(total),
    breakdown: {
      resultCount,
      avgScore: Math.round(normalizedAvgScore * 100) / 100
    }
  };
}

/**
 * Calculate reputation for a Coverage based on how many results
 * reference the same service across all skills.
 */
export function calculateCoverageReputation(
  coverage: Coverage,
  allSkills: Skill[]
): ReputationScore {
  let resultCount = 0;

  for (const skill of allSkills) {
    for (const bench of skill.benchmarks) {
      for (const result of bench.results) {
        if (result.serviceId === coverage.serviceId) {
          resultCount++;
        }
      }
    }
  }

  return {
    total: resultCount,
    label: getReputationLabel(resultCount),
    breakdown: { resultCount }
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
