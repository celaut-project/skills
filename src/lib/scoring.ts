/**
 * Multidimensional scoring for Celaut Skills.
 *
 * The new domain model (per Josemi 2026-06-18) treats benchmark results as a
 * tensor: each Result carries `CaseExecutionData[]`, where every case has
 *   - caseMeta[]:      values positionally aligned with the Benchmark's
 *                       caseDescriptors (dimensions of the problem space)
 *   - metricsValues[]: values positionally aligned with the Benchmark's
 *                       performanceMetrics (how performance is measured)
 *
 * The leaderboard / "best service" UI therefore can no longer rank by a single
 * scalar — it has to compare a service across (benchmark × metric) cells.
 *
 * The helpers below build that comparison tensor and a single composite score
 * per service, weighted by both the benchmark's reputation and each
 * contributing result's reputation.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TODO (Josemi clarification needed — leaving sensible defaults in place):
 *
 *  1. AGGREGATION across cases for the same (service, benchmark, metric):
 *     currently arithmetic mean of metricsValues[metricIdx] across every
 *     CaseExecutionData of every Result by that service. Other reasonable
 *     choices: median, best, worst, weighted-by-caseMeta. Please confirm
 *     mean is what you want, or specify the rule.
 *
 *  2. NORMALIZATION across metrics with different scales (latency in ms vs
 *     accuracy 0..1 vs Sharpe ratio) when combining into a single composite:
 *     currently no normalization — raw mean × direction sign × repWeight is
 *     summed. A proper composite should probably z-score or min-max per
 *     metric column (using the population of services that have a value
 *     for that column). Confirm preferred approach.
 *
 *  3. DIRECTION handling for lower-is-better metrics: currently the
 *     contribution is multiplied by -1 inside the composite so "more is
 *     better composite-wise" still holds. If you want the composite to be
 *     scale-invariant, normalization (TODO #2) supersedes this.
 *
 *  4. CROSS-BENCHMARK METRIC MERGING: if two benchmarks both define a
 *     PerformanceMetric named "accuracy", we currently keep them as
 *     separate columns in the tensor (because they may use different
 *     methodologies). Confirm — or specify a merging rule (e.g. same name
 *     ⇒ same axis).
 *
 *  5. EMPTY DATA fallback: a Result with `data: []` contributes nothing and
 *     is silently skipped. Should it instead invalidate the result, or
 *     count negatively toward the service's reputation?
 *
 *  6. REPUTATION WEIGHT for benchmarks with 0 reputation: currently floored
 *     to 1 so brand-new benchmarks still contribute *something*. Confirm
 *     this is desired vs. excluding them entirely.
 */

import type { Skill, Benchmark, Result, PerformanceMetric } from './types';

/** One column of the comparison tensor — identifies (benchmark, metric). */
export interface MetricColumn {
  benchmarkId: string;
  benchmarkName: string;
  benchmarkReputation: number;
  metricIndex: number;
  metric: PerformanceMetric;
}

/** One cell: the value a single service has on one MetricColumn. */
export interface TensorCell {
  value: number | null;
  /**
   * Reputation backing this cell: aggregated reputation of every Result
   * that contributed to the mean. Used to surface "vouched-for" cells.
   */
  resultsReputation: number;
  /** Number of result submissions backing this cell. */
  resultCount: number;
}

/** One row: a single service across every metric column. */
export interface TensorRow {
  serviceId: string;
  cells: TensorCell[];
  /** Composite score across all cells (see composite TODOs above). */
  composite: number;
  /** Sum of reputation contributing to this service's composite. */
  compositeReputation: number;
}

export interface ComparisonTensor {
  columns: MetricColumn[];
  rows: TensorRow[];
  /** Per-column winner — useful for highlighting the best cell in a column. */
  columnWinners: Array<number | null>;
}

/** All performance metrics declared by a skill, exploded to (benchmark, idx). */
export function listMetricColumns(skill: Skill): MetricColumn[] {
  const cols: MetricColumn[] = [];
  for (const bench of skill.benchmarks) {
    const metrics = bench.performanceMetrics ?? [];
    metrics.forEach((m, i) => {
      cols.push({
        benchmarkId: bench.id,
        benchmarkName: bench.name,
        benchmarkReputation: bench.reputation ?? 0,
        metricIndex: i,
        metric: m
      });
    });
  }
  return cols;
}

/** All unique serviceIds appearing as either a Coverage or a Result author. */
export function listServiceIds(skill: Skill): string[] {
  const ids = new Set<string>();
  for (const cov of skill.coverages) {
    if (cov.serviceId) ids.add(cov.serviceId);
  }
  for (const bench of skill.benchmarks) {
    for (const r of bench.results) {
      if (r.serviceId) ids.add(r.serviceId);
    }
  }
  return [...ids];
}

/**
 * Mean of metricsValues[metricIdx] for `serviceId` across every case of every
 * Result on `benchmark`. Returns null when the service has no data points.
 *
 * Reputation-weighted across results: cases from a higher-reputation result
 * count more. (Aggregation rule itself is TODO #1.)
 */
export function aggregateMetricForService(
  benchmark: Benchmark,
  serviceId: string,
  metricIndex: number
): { value: number | null; resultsReputation: number; resultCount: number } {
  let weightedSum = 0;
  let weightTotal = 0;
  let resultsReputation = 0;
  let resultCount = 0;

  for (const result of benchmark.results) {
    if (result.serviceId !== serviceId) continue;
    const cases = result.data ?? [];
    if (cases.length === 0) continue;

    // Per-result mean across cases for this metric column.
    let caseSum = 0;
    let caseCount = 0;
    for (const c of cases) {
      const v = c.metricsValues?.[metricIndex];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      caseSum += v;
      caseCount += 1;
    }
    if (caseCount === 0) continue;
    const perResultMean = caseSum / caseCount;

    // Weight by the result's own reputation (floor 1 so unreputed results
    // still register — TODO #6).
    const weight = Math.max(result.reputation ?? 0, 1);
    weightedSum += perResultMean * weight;
    weightTotal += weight;
    resultsReputation += result.reputation ?? 0;
    resultCount += 1;
  }

  if (weightTotal === 0) {
    return { value: null, resultsReputation: 0, resultCount: 0 };
  }
  return {
    value: weightedSum / weightTotal,
    resultsReputation,
    resultCount
  };
}

/**
 * Build the full service × metric tensor for a skill.
 * `extraServiceIds` lets callers force a service row even when the service
 * has no results yet (e.g. to keep every Coverage visible in the table).
 */
export function buildComparisonTensor(skill: Skill): ComparisonTensor {
  const columns = listMetricColumns(skill);
  const serviceIds = listServiceIds(skill);

  const rows: TensorRow[] = serviceIds.map((serviceId) => {
    const cells: TensorCell[] = columns.map((col) => {
      const bench = skill.benchmarks.find((b) => b.id === col.benchmarkId);
      if (!bench) {
        return { value: null, resultsReputation: 0, resultCount: 0 };
      }
      const agg = aggregateMetricForService(bench, serviceId, col.metricIndex);
      return agg;
    });

    // Composite score — see TODOs #2 and #3.
    let composite = 0;
    let compositeReputation = 0;
    cells.forEach((cell, i) => {
      if (cell.value === null) return;
      const col = columns[i];
      const directionSign = col.metric.higherIsBetter ? 1 : -1;
      const benchWeight = Math.max(col.benchmarkReputation, 1);
      const resultWeight = Math.max(cell.resultsReputation, 1);
      composite += directionSign * cell.value * benchWeight * resultWeight;
      compositeReputation += benchWeight + resultWeight;
    });

    return {
      serviceId,
      cells,
      composite: Math.round(composite * 100) / 100,
      compositeReputation
    };
  });

  // Per-column winners (highest if higherIsBetter, lowest otherwise).
  const columnWinners = columns.map((col, i) => {
    const values = rows
      .map((row) => row.cells[i]?.value)
      .filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return col.metric.higherIsBetter ? Math.max(...values) : Math.min(...values);
  });

  return { columns, rows, columnWinners };
}

/**
 * Pick the best service for a skill — the row with the highest composite.
 * Returns null when no service has any qualifying result.
 */
export function pickBestService(skill: Skill): TensorRow | null {
  const { rows } = buildComparisonTensor(skill);
  let best: TensorRow | null = null;
  for (const row of rows) {
    if (row.cells.every((c) => c.value === null)) continue;
    if (!best || row.composite > best.composite) {
      best = row;
    }
  }
  return best;
}
