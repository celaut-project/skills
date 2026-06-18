/**
 * Multidimensional scoring for Celaut Skills.
 *
 * The domain model treats benchmark results as a tensor: each Result carries
 * `CaseExecutionData[]`, where every case has
 *   - caseMeta[]:      values positionally aligned with the Benchmark's
 *                       caseDescriptors (dimensions of the problem space)
 *   - metricsValues[]: values positionally aligned with the Benchmark's
 *                       performanceMetrics (how performance is measured)
 *
 * Scoring rules (frozen per Josemi 2026-06-18):
 *   1. AGGREGATION  — median across cases per (service, benchmark, metric).
 *   2. NORMALIZATION — z-score across services per (benchmark, metric) column.
 *   3. DIRECTION    — z is negated for lower-is-better metrics, so the
 *                     composite is always "higher is better".
 *   4. CROSS-BENCHMARK MERGING — none. Two benchmarks declaring "accuracy"
 *                     are treated as distinct columns; benchmark + result
 *                     reputation provide the cross-benchmark weighting.
 *   5. EMPTY DATA   — `data: []` contributes nothing (silent skip).
 *   6. REPUTATION FLOOR — benchmark + result reputations are floored to 1
 *                     so brand-new entries still contribute. (Note: this
 *                     leaves a Sybil-attack surface that Josemi is tracking
 *                     separately; do not "fix" it here.)
 */

import type { Skill, Benchmark, PerformanceMetric, CaseExecutionData } from './types';

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
  /** Median of every case value contributed by this service for the column. */
  value: number | null;
  /** Sum of result reputations backing this cell — used as composite weight. */
  resultsReputation: number;
  /** Number of underlying case executions across all results. */
  caseCount: number;
  /** Number of distinct result submissions backing this cell. */
  resultCount: number;
}

/** One row: a single service across every metric column. */
export interface TensorRow {
  serviceId: string;
  cells: TensorCell[];
  /** Composite = weighted mean of (direction × z-score) across cells. */
  composite: number;
  /** Sum of weights that contributed to the composite. */
  compositeWeight: number;
}

export interface ComparisonTensor {
  columns: MetricColumn[];
  rows: TensorRow[];
  /** Per-column "best" raw value (max if higherIsBetter, min otherwise). */
  columnWinners: Array<number | null>;
}

/** ── Helpers ──────────────────────────────────────────────────────────────── */

/** Plain median of a numeric array. Returns null on empty input. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Sample standard deviation. Returns 0 when fewer than 2 finite values. */
function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/** ── Column / service discovery ───────────────────────────────────────────── */

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

/** ── Cell aggregation (median across cases) ──────────────────────────────── */

/**
 * Collect every (caseValue, resultReputation) point a service has contributed
 * to one (benchmark, metric) column. Used by both the cell aggregator and the
 * per-descriptor breakdown view.
 */
export function collectCasePoints(
  benchmark: Benchmark,
  serviceId: string,
  metricIndex: number
): Array<{ value: number; resultReputation: number; resultId: string; caseMeta: number[] }> {
  const points: Array<{
    value: number;
    resultReputation: number;
    resultId: string;
    caseMeta: number[];
  }> = [];
  for (const result of benchmark.results) {
    if (result.serviceId !== serviceId) continue;
    const cases = result.data ?? [];
    for (const c of cases) {
      const v = c.metricsValues?.[metricIndex];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      points.push({
        value: v,
        resultReputation: result.reputation ?? 0,
        resultId: result.id,
        caseMeta: c.caseMeta ?? []
      });
    }
  }
  return points;
}

/**
 * Median of every case value `serviceId` contributed for the given metric,
 * across every result on the benchmark. Returns null when empty (rule #5).
 */
export function aggregateMetricForService(
  benchmark: Benchmark,
  serviceId: string,
  metricIndex: number
): TensorCell {
  const points = collectCasePoints(benchmark, serviceId, metricIndex);
  if (points.length === 0) {
    return { value: null, resultsReputation: 0, caseCount: 0, resultCount: 0 };
  }
  const value = median(points.map((p) => p.value));
  const resultIds = new Set(points.map((p) => p.resultId));
  // Reputation per distinct result (not per case).
  let resultsReputation = 0;
  for (const result of benchmark.results) {
    if (result.serviceId !== serviceId) continue;
    if (!resultIds.has(result.id)) continue;
    resultsReputation += result.reputation ?? 0;
  }
  return {
    value,
    resultsReputation,
    caseCount: points.length,
    resultCount: resultIds.size
  };
}

/** ── Tensor construction + z-score composite ──────────────────────────────── */

/**
 * Build the full service × metric tensor and a composite score per service.
 *
 * Composite computation (rules #2, #3, #4, #6):
 *   - For each column, compute the population mean/stddev of cell values
 *     across services that *have* a value.
 *   - For each non-null cell, z = (value - mean) / stddev (0 when σ = 0).
 *   - Direction sign: z stays positive when higherIsBetter, negated otherwise.
 *     The composite is therefore always "higher = better".
 *   - Cell weight = max(benchmarkReputation, 1) × max(resultsReputation, 1).
 *     This pushes high-trust benchmarks + heavily-vouched results to dominate.
 *   - Composite per service = Σ(weight × signedZ) / Σ(weight).
 */
export function buildComparisonTensor(skill: Skill): ComparisonTensor {
  const columns = listMetricColumns(skill);
  const serviceIds = listServiceIds(skill);

  // 1. Fill raw cells.
  const rows: TensorRow[] = serviceIds.map((serviceId) => ({
    serviceId,
    cells: columns.map((col) => {
      const bench = skill.benchmarks.find((b) => b.id === col.benchmarkId);
      if (!bench) return { value: null, resultsReputation: 0, caseCount: 0, resultCount: 0 };
      return aggregateMetricForService(bench, serviceId, col.metricIndex);
    }),
    composite: 0,
    compositeWeight: 0
  }));

  // 2. Per-column z-score parameters.
  const columnStats = columns.map((_col, i) => {
    const vals = rows
      .map((r) => r.cells[i]?.value)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length === 0) return { mean: 0, sigma: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean, sigma: stddev(vals, mean) };
  });

  // 3. Composite per row.
  for (const row of rows) {
    let weightedZ = 0;
    let weightTotal = 0;
    row.cells.forEach((cell, i) => {
      if (cell.value === null) return;
      const col = columns[i];
      const { mean, sigma } = columnStats[i];
      const z = sigma === 0 ? 0 : (cell.value - mean) / sigma;
      const signedZ = col.metric.higherIsBetter ? z : -z;
      const weight = Math.max(col.benchmarkReputation, 1) * Math.max(cell.resultsReputation, 1);
      weightedZ += signedZ * weight;
      weightTotal += weight;
    });
    row.composite = weightTotal === 0 ? 0 : weightedZ / weightTotal;
    row.compositeWeight = weightTotal;
  }

  // 4. Per-column raw winners (for highlighting top cell in UI).
  const columnWinners = columns.map((col, i) => {
    const vals = rows
      .map((r) => r.cells[i]?.value)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length === 0) return null;
    return col.metric.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  });

  return { columns, rows, columnWinners };
}

/** Pick the row with the highest composite; null when no service has data. */
export function pickBestService(skill: Skill): TensorRow | null {
  const { rows } = buildComparisonTensor(skill);
  let best: TensorRow | null = null;
  for (const row of rows) {
    if (row.cells.every((c) => c.value === null)) continue;
    if (!best || row.composite > best.composite) best = row;
  }
  return best;
}

/** ── Descriptor grouping ──────────────────────────────────────────────────── */

/**
 * Stringify a caseMeta tuple for use as a Map key. Trailing undefined slots
 * are normalised to "—" so two cases that omit a trailing descriptor still
 * collide on the same bucket.
 */
export function caseMetaKey(caseMeta: number[], descriptorCount: number): string {
  const parts: string[] = [];
  for (let i = 0; i < descriptorCount; i++) {
    const v = caseMeta[i];
    parts.push(typeof v === 'number' && Number.isFinite(v) ? String(v) : '—');
  }
  return parts.join(' · ');
}

/**
 * Per-descriptor-bucket aggregate for one benchmark.
 *
 * For each unique caseMeta tuple, returns the median of every (service,
 * metric) value at that tuple, plus the underlying case count. This is what
 * the "By descriptor" sub-view consumes.
 */
export interface DescriptorBucket {
  caseMeta: number[];
  key: string;
  serviceValues: Map<string, Array<number | null>>; // serviceId -> per-metric median at this bucket
  caseCount: number;
}

export function bucketByDescriptor(benchmark: Benchmark): DescriptorBucket[] {
  const descriptorCount = benchmark.caseDescriptors?.length ?? 0;
  const metricCount = benchmark.performanceMetrics?.length ?? 0;
  // serviceId -> bucketKey -> metricIdx -> values[]
  const grouped = new Map<
    string,
    Map<string, { caseMeta: number[]; perMetric: number[][] }>
  >();

  for (const result of benchmark.results) {
    const sid = result.serviceId;
    if (!sid) continue;
    for (const c of result.data ?? []) {
      const key = caseMetaKey(c.caseMeta ?? [], descriptorCount);
      let perService = grouped.get(sid);
      if (!perService) {
        perService = new Map();
        grouped.set(sid, perService);
      }
      let bucket = perService.get(key);
      if (!bucket) {
        bucket = {
          caseMeta: (c.caseMeta ?? []).slice(0, descriptorCount),
          perMetric: Array.from({ length: metricCount }, () => [])
        };
        perService.set(key, bucket);
      }
      for (let m = 0; m < metricCount; m++) {
        const v = c.metricsValues?.[m];
        if (typeof v === 'number' && Number.isFinite(v)) {
          bucket.perMetric[m].push(v);
        }
      }
    }
  }

  // Pivot to bucketKey -> serviceId -> median[per-metric].
  const bucketsByKey = new Map<
    string,
    { caseMeta: number[]; serviceValues: Map<string, Array<number | null>>; caseCount: number }
  >();
  for (const [sid, perService] of grouped.entries()) {
    for (const [key, bucket] of perService.entries()) {
      let entry = bucketsByKey.get(key);
      if (!entry) {
        entry = { caseMeta: bucket.caseMeta, serviceValues: new Map(), caseCount: 0 };
        bucketsByKey.set(key, entry);
      }
      const medians = bucket.perMetric.map((vals) => (vals.length ? median(vals) : null));
      entry.serviceValues.set(sid, medians);
      entry.caseCount += bucket.perMetric.reduce((acc, vals) => acc + vals.length, 0);
    }
  }

  // Sort buckets by their first descriptor numerically when possible.
  return [...bucketsByKey.entries()]
    .map(([key, b]) => ({ key, ...b }))
    .sort((a, b) => {
      const av = a.caseMeta[0];
      const bv = b.caseMeta[0];
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return a.key.localeCompare(b.key);
    });
}

/** Flat enumeration of every (service, case) pair on a benchmark — for raw tables. */
export interface FlatCaseRow {
  serviceId: string;
  resultId: string;
  resultReputation: number;
  caseMeta: number[];
  metricsValues: number[];
}

export function flattenBenchmarkCases(benchmark: Benchmark): FlatCaseRow[] {
  const rows: FlatCaseRow[] = [];
  for (const result of benchmark.results) {
    if (!result.serviceId) continue;
    for (const c of result.data ?? []) {
      rows.push({
        serviceId: result.serviceId,
        resultId: result.id,
        resultReputation: result.reputation ?? 0,
        caseMeta: (c.caseMeta ?? []).slice(),
        metricsValues: (c.metricsValues ?? []).slice()
      });
    }
  }
  return rows;
}

// Convenience re-export so consumers don't have to import from types separately.
export type { CaseExecutionData };
