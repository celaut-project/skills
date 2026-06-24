/**
 * Multi-Criteria Global Scoring System — implementation of SCORE.md.
 *
 * Computes a Service's global score WITHIN a Skill, combining verified empirical
 * performance (benchmark results, confidence-weighted) with the service's own
 * external reputation. Used to rank a skill's services and pick the recommended
 * one. See SCORE.md for the full mathematical specification; section references
 * below map each step to that document.
 *
 * Reputation availability note: the on-chain entities expose a `reputation`
 * integer (services, benchmarks, results). The *user* (result uploader) raw
 * reputation is not carried on the Result, so W_u defaults to neutral (0.5)
 * unless a `profileReputations` map is supplied by the caller. The formula stays
 * structurally faithful; supplying user reputations only sharpens C_r.
 */

import type { Skill, Benchmark } from './types';
import { collectCasePoints, listServiceIds, median } from './scoring';

/** α — balances trust in the result's uploader vs the result's own reputation (§4A). */
export const ALPHA = 0.4;
/** β — weights verified technical performance vs the service's brand reputation (§5.3). */
export const BETA = 0.7;

export interface ServiceScore {
  serviceId: string;
  /** Definitive global score in [0, 1] (SCORE.md §5.3). */
  scoreGlobal: number;
  /** Consolidated technical performance across benchmarks, or null if no results. */
  scorePerf: number | null;
  /** Confidence weight of the service entity itself, W_S in [0, 1]. */
  wService: number;
  /** Number of distinct benchmarks this service has results in. */
  benchmarkCount: number;
  /** Number of distinct result submissions backing the perf score. */
  resultCount: number;
}

export interface ScoreOptions {
  /** Optional profile_id → raw reputation, used for the uploader weight W_u. */
  profileReputations?: Map<string, number>;
}

/**
 * Confidence Normalization W_e (SCORE.md §2): signed logarithmic map of a raw
 * reputation into [0, 1]. R≥0 → [0.5,1], R<0 → [0,0.5], R=0 → 0.5. nMax is the
 * max absolute reputation observed within the skill, keeping the scale
 * calibrated; when it is 0 every entity is neutral (0.5).
 */
export function confidenceWeight(rRaw: number, nMax: number): number {
  if (!Number.isFinite(rRaw) || nMax <= 0) return 0.5;
  const denom = Math.log(1 + nMax);
  if (denom === 0) return 0.5;
  if (rRaw >= 0) {
    return 0.5 + 0.5 * (Math.log(1 + rRaw) / denom);
  }
  return 0.5 - 0.5 * (Math.log(1 + Math.abs(rRaw)) / denom);
}

/** Max absolute reputation across every entity observed in the skill (the N_max calibrator). */
function computeNMax(skill: Skill, profileReputations?: Map<string, number>): number {
  let nMax = 0;
  const track = (r: number | undefined | null) => {
    if (typeof r === 'number' && Number.isFinite(r)) nMax = Math.max(nMax, Math.abs(r));
  };
  for (const cov of skill.coverages) track(cov.reputation);
  for (const bench of skill.benchmarks) {
    track(bench.reputation);
    for (const r of bench.results) {
      track(r.reputation);
      track(profileReputations?.get(r.profileId));
    }
  }
  return nMax;
}

/**
 * Performance Metric Normalization N(x) (SCORE.md §3): bring a raw metric value
 * onto [0, 1] using the historical min/max for that (benchmark, metric)
 * dimension, respecting the metric's direction. Neutral 0.5 when the range
 * collapses (a single observed value gives no discrimination).
 */
function normalize(x: number, min: number, max: number, higherIsBetter: boolean): number {
  if (max === min) return 0.5;
  const n = higherIsBetter ? (x - min) / (max - min) : (max - x) / (max - min);
  return Math.min(1, Math.max(0, n));
}

/** Per-(metric) observed min/max across every case value of every result in the benchmark. */
function metricRanges(benchmark: Benchmark): Array<{ min: number; max: number }> {
  const metrics = benchmark.performanceMetrics ?? [];
  return metrics.map((_, metricIndex) => {
    let min = Infinity;
    let max = -Infinity;
    for (const result of benchmark.results) {
      for (const c of result.data ?? []) {
        const v = c.metricsValues?.[metricIndex];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
  });
}

/**
 * Performance within a single benchmark, P(S, B) (SCORE.md §5.1):
 * confidence-weighted mean of each result's performance quality P_r, where the
 * confidence C_r = α·W_u + (1-α)·W_r down-weights low-reputation (fake) results.
 * Returns null when the service has no usable results in this benchmark.
 */
function performanceInBenchmark(
  benchmark: Benchmark,
  serviceId: string,
  nMax: number,
  profileReputations: Map<string, number> | undefined,
): { value: number; resultCount: number } | null {
  const metrics = benchmark.performanceMetrics ?? [];
  if (metrics.length === 0) return null;
  const ranges = metricRanges(benchmark);
  // Equal metric weights w_m = 1/M — the on-chain Benchmark carries no per-metric
  // weights, and SCORE.md only requires Σ w_m = 1 (§4B).
  const wM = 1 / metrics.length;

  let numerator = 0; // Σ (C_r · P_r)
  let denominator = 0; // Σ C_r
  let resultCount = 0;

  for (const result of benchmark.results) {
    if (result.serviceId !== serviceId) continue;

    // P_r — weighted sum of normalized metrics (SCORE.md §4B). Aggregate this
    // result's cases per metric via median (mirrors the tensor aggregation),
    // then normalize and weight.
    let pr = 0;
    let contributed = false;
    for (let m = 0; m < metrics.length; m++) {
      const caseVals = (result.data ?? [])
        .map((c) => c.metricsValues?.[m])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const med = median(caseVals);
      if (med === null) continue;
      const nx = normalize(med, ranges[m].min, ranges[m].max, metrics[m].higherIsBetter);
      pr += wM * nx;
      contributed = true;
    }
    if (!contributed) continue;

    // C_r — result confidence (SCORE.md §4A).
    const wR = confidenceWeight(result.reputation ?? 0, nMax);
    const wU = confidenceWeight(profileReputations?.get(result.profileId) ?? 0, nMax);
    const cr = ALPHA * wU + (1 - ALPHA) * wR;

    numerator += cr * pr;
    denominator += cr;
    resultCount += 1;
  }

  if (resultCount === 0 || denominator === 0) return null;
  return { value: numerator / denominator, resultCount };
}

/**
 * Compute the global score for every service in the skill (SCORE.md §5):
 *   Score_Perf(S) = Σ(W_B · P(S,B)) / Σ W_B               (§5.2)
 *   Score_Global  = β · Score_Perf + (1-β) · W_S          (§5.3)
 * A service with no empirical results is scored on its reputation alone (W_S),
 * so coverage-only / brand-new services still rank.
 */
export function computeServiceScores(skill: Skill, opts: ScoreOptions = {}): ServiceScore[] {
  const { profileReputations } = opts;
  const nMax = computeNMax(skill, profileReputations);
  const serviceIds = listServiceIds(skill);

  // Service reputation = the reputation on its coverage entry (direct or
  // result-derived; loadCoverages merges both).
  const covRepByService = new Map<string, number>();
  for (const cov of skill.coverages) {
    if (cov.serviceId) covRepByService.set(cov.serviceId, cov.reputation ?? 0);
  }

  return serviceIds.map((serviceId) => {
    const wService = confidenceWeight(covRepByService.get(serviceId) ?? 0, nMax);

    // Σ(W_B · P(S,B)) / Σ W_B across benchmarks where the service has results.
    let perfNum = 0;
    let perfDen = 0;
    let benchmarkCount = 0;
    let resultCount = 0;
    for (const bench of skill.benchmarks) {
      const p = performanceInBenchmark(bench, serviceId, nMax, profileReputations);
      if (!p) continue;
      const wB = confidenceWeight(bench.reputation ?? 0, nMax);
      perfNum += wB * p.value;
      perfDen += wB;
      benchmarkCount += 1;
      resultCount += p.resultCount;
    }

    const scorePerf = perfDen > 0 ? perfNum / perfDen : null;
    const scoreGlobal =
      scorePerf === null ? wService : BETA * scorePerf + (1 - BETA) * wService;

    return { serviceId, scoreGlobal, scorePerf, wService, benchmarkCount, resultCount };
  });
}

/**
 * The single best service for a skill by global score (SCORE.md). Returns null
 * only when the skill has no services. Ties break by performance presence then
 * raw score; a sole service always wins.
 */
export function pickBestServiceByScore(
  skill: Skill,
  opts: ScoreOptions = {},
): ServiceScore | null {
  const scores = computeServiceScores(skill, opts);
  if (!scores.length) return null;
  return [...scores].sort(
    (a, b) =>
      b.scoreGlobal - a.scoreGlobal ||
      Number(b.scorePerf !== null) - Number(a.scorePerf !== null),
  )[0];
}
