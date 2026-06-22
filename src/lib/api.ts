/**
 * API/data layer for Celaut Skills.
 * Handles chain queries, box parsing, and demo data.
 */

import { hexToUtf8 } from './ergo/envs';
import type { Skill, Coverage, Benchmark, Result } from './types';
import { ApiError, NetworkError, ParseError } from './types';
import {
  searchBoxes,
  fetchAllProfiles,
  fetchTypeNfts,
  calculate_reputation,
  type ReputationProof,
} from 'reputation-system';

// ── Constants ────────────────────────────────────────────────────────────────

export const EXPLORER_API = 'https://api.ergoplatform.com';

/**
 * Type NFT IDs.
 *
 * Single source of truth: `src/lib/registry/core.mjs` — the framework-agnostic
 * registry core shared with the MCP server. We import the ids here (and
 * re-export them for existing callers) so the app and the MCP server can never
 * drift. They are *placeholder* identifiers until real on-chain Type NFTs are
 * minted, so the chain query functions below short-circuit to `[]` meanwhile.
 */
import {
  SKILL_TYPE_ID,
  BENCHMARK_TYPE_ID,
  RESULT_TYPE_ID,
  COVERAGE_TYPE_ID
} from './registry/core.mjs';
export { SKILL_TYPE_ID, BENCHMARK_TYPE_ID, RESULT_TYPE_ID, COVERAGE_TYPE_ID };

// ── Utilities ────────────────────────────────────────────────────────────────

/** Convert a UTF-8 string to its hex representation. */
export function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * True if a value looks like a real on-chain hex identifier (token id, box id,
 * type NFT id). Used to gate chain queries so placeholder strings like
 * "celaut:skill:v1" don't generate malformed Explorer requests.
 */
function isHexId(value: string): boolean {
  return /^[0-9a-fA-F]{4,}$/.test(value);
}

/** Drain the searchBoxes async-generator into a flat array of raw boxes. */
async function collectBoxes(
  typeNftId: string | undefined,
  objectPointer: string | undefined,
  limit = 100
): Promise<any[]> {
  const all: any[] = [];
  for await (const batch of searchBoxes(
    EXPLORER_API,
    undefined,
    typeNftId,
    objectPointer,
    undefined,
    undefined,
    undefined,
    undefined,
    limit
  )) {
    all.push(...batch);
  }
  return all;
}

/**
 * Parse a box's R9 JSON payload.
 *
 * The Explorer returns R9 (a Coll[Byte]) as a HEX string, so it must be
 * `hexToUtf8`-decoded before `JSON.parse` — parsing the raw hex throws and was
 * silently dropping every benchmark/coverage/result (only `parseSkillBox` was
 * decoding correctly). Throws on malformed JSON; callers wrap in try/catch.
 */
function parseBoxR9(box: any): any {
  const rendered = box?.additionalRegisters?.R9?.renderedValue || '';
  return JSON.parse(hexToUtf8(rendered) || '');
}

/** Format a service ID for display — show truncated hash in monospace style. */
export function formatServiceId(serviceId?: string, boxId?: string): string {
  const id = serviceId || boxId || '';
  if (!id) return 'Unknown';
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

/** Format a source hash for display — truncated with ellipsis. */
export function formatSourceHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function deriveProfileId(box: any, parsed: any, fallback: string): string {
  return parsed?.profile_id || box?.assets?.[0]?.tokenId || fallback;
}

// ── Reputation Hydration ─────────────────────────────────────────────────────
//
// Reputation is computed from the profile's reputation proof via `calculate_reputation`
// from `reputation-system` — i.e. the burned value sacrificed against the
// profile_id (token_id of the reputation proof). We fetch every profile once
// (bulk via `fetchAllProfiles`) and cache the resulting Map<token_id, proof>
// for fast lookup during hydration. The library doesn't re-export
// `fetchProfileById` from its package entry, so a bulk-then-cache approach
// is what's available to us.

let profileMapPromise: Promise<Map<string, ReputationProof>> | null = null;

async function loadProfileMap(): Promise<Map<string, ReputationProof>> {
  if (!profileMapPromise) {
    profileMapPromise = (async () => {
      try {
        const availableTypes = await fetchTypeNfts(EXPLORER_API);
        const profiles = await fetchAllProfiles(EXPLORER_API, null, undefined, availableTypes);
        return new Map(profiles.map((p) => [p.token_id, p]));
      } catch {
        return new Map();
      }
    })();
  }
  return profileMapPromise;
}

/**
 * Hydrate `.reputation` on a list of entities that have a `profileId`.
 * Mutates entities in-place and returns the same array. Safe to call with
 * an empty array.
 */
export async function hydrateReputations<T extends { profileId: string; reputation?: number }>(
  entities: T[],
): Promise<T[]> {
  if (entities.length === 0) return entities;
  const profileMap = await loadProfileMap();
  for (const e of entities) {
    const proof = profileMap.get(e.profileId);
    e.reputation = proof ? calculate_reputation(proof) : 0;
  }
  return entities;
}

/** Clear the cached profile map. Useful for forcing fresh reputation lookups. */
export function clearProfileCache(): void {
  profileMapPromise = null;
}

function demoProfileId(seed: string): string {
  return `demo-profile-${seed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function demoReputationFor(profileId: string): number {
  let total = 0;
  for (const char of profileId) total = (total + char.charCodeAt(0)) % 29;
  return total + 1;
}

function cloneCoverage(coverage: Coverage): Coverage {
  return { ...coverage };
}

function cloneResult(result: Result): Result {
  return { ...result };
}

function cloneBenchmark(benchmark: Benchmark): Benchmark {
  return {
    ...benchmark,
    results: benchmark.results.map(cloneResult)
  };
}

function cloneSkill(skill: Skill): Skill {
  return {
    ...skill,
    tags: [...skill.tags],
    extendedSkillBoxIds: [...skill.extendedSkillBoxIds],
    coverages: skill.coverages.map(cloneCoverage),
    benchmarks: skill.benchmarks.map(cloneBenchmark)
  };
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Merge coverages and benchmarks from related skills into each skill.
 *
 * The merge is idempotent and cycle-safe: own entries stay first, related data
 * is appended once per unique box/id.
 */
export function applySkillInheritance(skills: Skill[]): Skill[] {
  const skillMap = new Map(skills.map((skill) => [skill.boxId, skill] as const));
  const memo = new Map<string, Skill>();
  const active = new Set<string>();

  const resolve = (skill: Skill): Skill => {
    const cached = memo.get(skill.boxId);
    if (cached) return cloneSkill(cached);

    if (active.has(skill.boxId)) {
      return cloneSkill(skill);
    }

    active.add(skill.boxId);

    const base = cloneSkill(skill);
    const inherited = skill.extendedSkillBoxIds
      .map((refId) => skillMap.get(refId))
      .filter(Boolean) as Skill[];

    const relatedSkills = inherited.map(resolve);

    base.coverages = dedupeBy(
      [
        ...base.coverages,
        ...relatedSkills.flatMap((related) => related.coverages.map(cloneCoverage))
      ],
      (coverage) => coverage.boxId
    ).map(cloneCoverage);

    base.benchmarks = dedupeBy(
      [
        ...base.benchmarks,
        ...relatedSkills.flatMap((related) => related.benchmarks.map(cloneBenchmark))
      ],
      (benchmark) => benchmark.id
    ).map(cloneBenchmark);

    base.resultCount = base.benchmarks.reduce(
      (sum, benchmark) => sum + benchmark.results.length,
      0
    );

    active.delete(skill.boxId);
    memo.set(skill.boxId, base);
    return cloneSkill(base);
  };

  return skills.map(resolve);
}

/**
 * Demo authoring shapes — the *input* shapes used inside getDemoSkills().
 * They omit the bookkeeping fields (`profileId`, `reputation`) that
 * `enrichDemoSkills` fills in deterministically downstream.
 */
type DemoResult = Omit<Result, 'profileId' | 'reputation'>;
type DemoBenchmark = Omit<Benchmark, 'profileId' | 'reputation' | 'results'> & {
  results: DemoResult[];
};
type DemoCoverage = Omit<Coverage, 'profileId' | 'reputation'>;
type DemoSkillInput = Omit<Partial<Skill>, 'coverages' | 'benchmarks'> & {
  boxId: string;
  coverages: DemoCoverage[];
  benchmarks: DemoBenchmark[];
};

/**
 * Inflate demo skills authored in the current native types.ts shape — assign
 * deterministic demo profileIds + reputations to every Skill / Coverage /
 * Benchmark / Result so the UI has stable, deduped on-chain-ish identifiers.
 *
 * Demo authoring rules (no legacy compat — Josemi 2026-06-19):
 *   - Each Benchmark MUST declare `caseDescriptors[]` (may be empty) and
 *     `performanceMetrics[]` (must be non-empty).
 *   - Each Result MUST carry `data: CaseExecutionData[]` (one or more cases)
 *     with `metricsValues.length === performanceMetrics.length` and
 *     `caseMeta.length === caseDescriptors.length`.
 *   - `formal` is required on Skill (use "" if no JSON schema yet).
 */
function enrichDemoSkills(rawSkills: DemoSkillInput[]): Skill[] {
  return rawSkills.map((skill, skillIndex) => {
    const skillProfileId = demoProfileId(`skill-${skillIndex + 1}-${skill.boxId}`);

    return {
      boxId: skill.boxId,
      profileId: skillProfileId,
      name: skill.name ?? 'Unnamed Skill',
      prose: skill.prose ?? '',
      formal: skill.formal ?? '',
      tags: skill.tags ?? [],
      domain: skill.domain ?? '',
      extendedSkillBoxIds: skill.extendedSkillBoxIds ?? [],
      sourceHash: skill.sourceHash,
      reputation: demoReputationFor(skillProfileId),
      resultCount: 0, // computed below
      coverages: skill.coverages.map((coverage) => {
        const profileId = demoProfileId(`coverage-${coverage.serviceId || coverage.boxId}`);
        return {
          boxId: coverage.boxId,
          profileId,
          serviceId: coverage.serviceId,
          reputation: demoReputationFor(profileId)
        } as Coverage;
      }),
      benchmarks: skill.benchmarks.map((benchmark, benchmarkIndex) => {
        const benchmarkProfileId = demoProfileId(`benchmark-${skill.boxId}-${benchmark.id}-${benchmarkIndex + 1}`);
        return {
          id: benchmark.id,
          profileId: benchmarkProfileId,
          skillBoxId: skill.boxId,
          name: benchmark.name,
          description: benchmark.description,
          caseDescriptors: benchmark.caseDescriptors,
          performanceMetrics: benchmark.performanceMetrics,
          sourceHash: benchmark.sourceHash,
          reputation: demoReputationFor(benchmarkProfileId),
          coverages: (benchmark.coverages ?? []).map((coverage) => {
            const coverageProfileId = demoProfileId(`bench-coverage-${coverage.serviceId || coverage.boxId}`);
            return {
              boxId: coverage.boxId,
              profileId: coverageProfileId,
              serviceId: coverage.serviceId,
              benchmarkId: benchmark.id,
              reputation: demoReputationFor(coverageProfileId)
            } as Coverage;
          }),
          results: benchmark.results.map((result) => {
            const resultProfileId = demoProfileId(`result-${result.serviceId}-${result.id}`);
            return {
              id: result.id,
              profileId: resultProfileId,
              benchmarkId: benchmark.id,
              serviceId: result.serviceId,
              data: result.data.map((c) => ({
                caseMeta: [...c.caseMeta],
                metricsValues: [...c.metricsValues]
              })),
              notes: result.notes ?? '',
              timestamp: result.timestamp,
              sourceHash: result.sourceHash,
              reputation: demoReputationFor(resultProfileId)
            } as Result;
          })
        } as Benchmark;
      })
    };
  }).map((skill) => {
    skill.resultCount = skill.benchmarks.reduce((sum, b) => sum + b.results.length, 0);
    return skill;
  });
}
// ── Box Parsing ──────────────────────────────────────────────────────────────

/** Parse a raw Explorer box into a Skill, or null if unparseable. */
export function parseSkillBox(box: any): Skill | null {
  try {
    const rawValue = box.additionalRegisters?.R9?.renderedValue || '';
    const potentialString = hexToUtf8(rawValue);
    let parsed: any = {};
    if (potentialString) {
      try {
          parsed = JSON.parse(potentialString);
      } catch {
          parsed = potentialString;
      }
    }
    const profileId = deriveProfileId(box, parsed, box.boxId);
    return {
      boxId: box.boxId,
      profileId,
      name: parsed.name || 'Unnamed Skill',
      prose: parsed.prose || '',
      formal: parsed.formal || '',
      tags: parsed.tags || [],
      domain: parsed.domain || '',
      extendedSkillBoxIds: parsed.extended_skill_boxes || [],
      coverages: [],
      benchmarks: [],
      resultCount: 0,
      reputation: 0,
      // Ergo boxes expose creationHeight; settlement/inclusion are fallbacks
      // when an explorer payload omits it. Drives canonical relationship topic
      // ordering (newer skill first in `{skill_nueva}_{skill_antigua}`).
      creationHeight:
        box.creationHeight ?? box.settlementHeight ?? box.inclusionHeight ?? 0
    };
  } catch {
    return null;
  }
}

// ── Chain Queries ────────────────────────────────────────────────────────────

/**
 * Load skills from the Ergo blockchain.
 *
 * Delegates to `searchBoxes` from reputation-system (which hits the correct
 * `/api/v1/boxes/unspent/search` endpoint with properly Sigma-serialized
 * registers — the old hand-rolled payload here was returning HTTP 400). If
 * `SKILL_TYPE_ID` is still a placeholder string (not real hex), we skip the
 * query and return [] so live mode shows the empty state instead of erroring.
 */
export async function loadSkills(): Promise<Skill[]> {
  if (!isHexId(SKILL_TYPE_ID)) return [];
  const boxes = await collectBoxes(SKILL_TYPE_ID, undefined);
  const skills = boxes.map(parseSkillBox).filter(Boolean) as Skill[];
  await hydrateReputations(skills);
  return applySkillInheritance(skills);
}

/**
 * Load *skill* coverages for a given skill box ID.
 *
 * A skill coverage is a service that addresses/solves the skill. A service can
 * become a skill coverage in two ways:
 *  1. Directly — a Coverage box (COVERAGE_TYPE_ID) pointing at the skill.
 *  2. Indirectly — by appearing as the `service_id` of a Result submitted
 *     against a Benchmark of this skill. Submitting a result demonstrably
 *     proves the service solves the skill, so it counts as a skill coverage.
 *
 * NOTE: this is deliberately different from `loadBenchmarkCoverages`, which
 * lists benchmark *runners* — a Result's service is a skill *solution*, never a
 * benchmark runner, so it is derived here but NOT there.
 *
 * Both sources are merged; direct coverages win, deduped by serviceId.
 */
export async function loadCoverages(skillBoxId: string): Promise<Coverage[]> {
  if (!isHexId(COVERAGE_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(COVERAGE_TYPE_ID, skillBoxId);
  const direct = boxes
    .map((box: any) => {
      try {
        const parsed = parseBoxR9(box);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        return {
          boxId: box.boxId,
          profileId,
          serviceId: parsed.service_id || undefined,
          reputation: 0
        } as Coverage;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Coverage[];
  await hydrateReputations(direct);

  // Indirect skill coverages: results → benchmarks → this skill.
  const benchmarks = await loadBenchmarks(skillBoxId);
  const resultLists = await Promise.all(benchmarks.map((b) => loadResults(b.id)));
  const results = resultLists.flat();

  // Merge, deduping by serviceId. Direct coverages win; coverages without a
  // serviceId are kept as-is (nothing to dedupe on).
  const seenServiceIds = new Set<string>();
  const merged: Coverage[] = [];
  for (const coverage of direct) {
    if (coverage.serviceId) {
      if (seenServiceIds.has(coverage.serviceId)) continue;
      seenServiceIds.add(coverage.serviceId);
    }
    merged.push(coverage);
  }
  for (const result of results) {
    const serviceId = result.serviceId;
    if (!serviceId || seenServiceIds.has(serviceId)) continue;
    seenServiceIds.add(serviceId);
    merged.push({
      boxId: result.id,
      profileId: result.profileId,
      serviceId,
      reputation: result.reputation ?? 0
    } as Coverage);
  }

  return merged;
}

/**
 * Load coverages that target a Benchmark (object pointer = benchmarkId).
 *
 * Only explicit Coverage boxes published against the benchmark id count. A
 * service that submitted a Result to this benchmark is a skill *solution*
 * (ranked in Results), not a benchmark *runner*, so it is deliberately NOT
 * derived into the coverage list — the two are different purposes.
 */
export async function loadBenchmarkCoverages(benchmarkId: string): Promise<Coverage[]> {
  if (!isHexId(COVERAGE_TYPE_ID) || !isHexId(benchmarkId)) return [];
  const boxes = await collectBoxes(COVERAGE_TYPE_ID, benchmarkId);
  const direct = boxes
    .map((box: any) => {
      try {
        const parsed = parseBoxR9(box);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        return {
          boxId: box.boxId,
          profileId,
          serviceId: parsed.service_id || undefined,
          benchmarkId,
          reputation: 0
        } as Coverage;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Coverage[];
  await hydrateReputations(direct);

  const seenServiceIds = new Set<string>();
  const merged: Coverage[] = [];
  for (const coverage of direct) {
    if (coverage.serviceId) {
      if (seenServiceIds.has(coverage.serviceId)) continue;
      seenServiceIds.add(coverage.serviceId);
    }
    merged.push(coverage);
  }

  return merged;
}

/** Load benchmarks for a given skill box ID. */
export async function loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
  if (!isHexId(BENCHMARK_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(BENCHMARK_TYPE_ID, skillBoxId);
  console.log("Benchmark boxes:", boxes);
  const benchmarks = boxes
    .map((box: any) => {
      try {
        const parsed = parseBoxR9(box);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        return {
          id: box.boxId,
          profileId,
          skillBoxId,
          name: parsed.name || 'Unnamed Benchmark',
          description: parsed.description || '',
          caseDescriptors: Array.isArray(parsed.case_descriptors) ? parsed.case_descriptors : [],
          performanceMetrics: Array.isArray(parsed.performance_metrics) ? parsed.performance_metrics : [],
          results: [],
          coverages: [],
          sourceHash: parsed.source_hash,
          reputation: 0
        } as Benchmark;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Benchmark[];
  await hydrateReputations(benchmarks);
  return benchmarks;
}

/** Load results for a given benchmark ID. */
export async function loadResults(benchmarkId: string): Promise<Result[]> {
  if (!isHexId(RESULT_TYPE_ID) || !isHexId(benchmarkId)) return [];
  const boxes = await collectBoxes(RESULT_TYPE_ID, benchmarkId);
  const results = boxes
    .map((box: any) => {
      try {
        const parsed = parseBoxR9(box);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        const rawCases = Array.isArray(parsed.data) ? parsed.data : [];
        const data = rawCases.map((c: any) => ({
          caseMeta: Array.isArray(c?.case_meta) ? c.case_meta.map(Number) : [],
          metricsValues: Array.isArray(c?.metrics_values) ? c.metrics_values.map(Number) : []
        }));
        return {
          id: box.boxId,
          profileId,
          benchmarkId: benchmarkId,
          serviceId: parsed.service_id || '',
          data,
          notes: parsed.notes || '',
          timestamp: parsed.timestamp || 0,
          sourceHash: parsed.source_hash,
          reputation: 0
        } as Result;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Result[];
  await hydrateReputations(results);
  return results;
}

// ── Demo Data ────────────────────────────────────────────────────────────────

/**
 * Single-metric, descriptor-less benchmark shape. Used for the demo skills
 * that semantically measure ONE thing across UNDIFFERENTIATED runs (e.g.
 * "Sharpe ratio", "F1 score"). Keeps authoring concise while still producing
 * native multi-case shape — every result lifts to `data: [{ caseMeta: [],
 * metricsValues: [value] }]`.
 *
 * For genuinely multi-dimensional benchmarks (see skill demo-008) author the
 * caseDescriptors / performanceMetrics / data arrays directly.
 */
function singleMetricBenchmark(opts: {
  id: string;
  skillBoxId: string;
  name: string;
  description: string;
  metricName: string;
  higherIsBetter: boolean;
  sourceHash?: string;
  /** Coverages targeting this benchmark (services suggested to test it). */
  coverages?: Array<{ boxId: string; serviceId: string }>;
  results: Array<{ id: string; serviceId: string; value: number; notes?: string; timestamp: number; sourceHash?: string }>;
}): Benchmark {
  return {
    id: opts.id,
    profileId: '', // filled in by enrichDemoSkills
    skillBoxId: opts.skillBoxId,
    name: opts.name,
    description: opts.description,
    caseDescriptors: [],
    performanceMetrics: [{ name: opts.metricName, description: opts.description, higherIsBetter: opts.higherIsBetter }],
    sourceHash: opts.sourceHash,
    coverages: (opts.coverages ?? []).map((c) => ({
      boxId: c.boxId,
      profileId: '', // filled in by enrichDemoSkills
      serviceId: c.serviceId,
      benchmarkId: opts.id,
      reputation: 0
    })),
    results: opts.results.map((r) => ({
      id: r.id,
      profileId: '', // filled in by enrichDemoSkills
      benchmarkId: opts.id,
      serviceId: r.serviceId,
      data: [{ caseMeta: [], metricsValues: [r.value] }],
      notes: r.notes ?? '',
      timestamp: r.timestamp,
      sourceHash: r.sourceHash
    }))
  };
}

/** Demo skills for local development and fallback when chain is unavailable. */
export function getDemoSkills(): Skill[] {
  const rawSkills: DemoSkillInput[] = [
    // ── Skill 1a: XAU/BTC by Author A ──
    {
      boxId: 'demo-001',
      name: 'Optimal XAU/BTC Performance',
      prose: 'Maximize risk-adjusted returns on the XAU/BTC pair using on-chain verifiable strategies. Agents must demonstrate consistent alpha generation across bull and bear regimes with transparent position tracking.',
      tags: ['trading', 'gold', 'bitcoin', 'risk-management'],
      domain: 'finance',
      extendedSkillBoxIds: [],
      sourceHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      coverages: [
        { boxId: 'cov-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a' },
        { boxId: 'cov-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-001',
          skillBoxId: 'demo-001',
          name: 'Sharpe Ratio (30d rolling)',
          description: 'Measures risk-adjusted return over a 30-day rolling window. Higher Sharpe ratios indicate better risk-adjusted performance.',
          metricName: 'sharpe_ratio',
          higherIsBetter: true,
          sourceHash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
          coverages: [
            { boxId: 'bcov-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a' },
            { boxId: 'bcov-002', serviceId: 'QmP2sV7hWnR9xK4tL6mDc8eFj3bYa5z1q' }
          ],
          results: [
            { id: 'res-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', value: 2.41, notes: 'Consistent alpha over 30d window', timestamp: 1734134400 },
            { id: 'res-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', value: 1.87, notes: 'Good but higher drawdowns', timestamp: 1733529600 },
            { id: 'res-003', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', value: 1.52, timestamp: 1732924800 },
            { id: 'res-004', serviceId: 'QmW9xK3pNfD4VyL8tB2mRa6jUc5gYe1h4', value: 0.94, notes: 'Underperformed in bear phase', timestamp: 1732320000 }
          ]
        }),
        singleMetricBenchmark({
          id: 'bench-002',
          skillBoxId: 'demo-001',
          name: 'Max Drawdown',
          description: 'Maximum observed loss from peak to trough. Lower is better — measures worst-case risk.',
          metricName: 'max_drawdown_pct',
          higherIsBetter: false,
          results: [
            { id: 'res-005', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', value: 4.2, notes: 'Tight risk management', timestamp: 1734134400 },
            { id: 'res-006', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', value: 8.7, timestamp: 1733529600 },
            { id: 'res-007', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', value: 12.3, notes: 'High volatility exposure', timestamp: 1732924800 }
          ]
        })
      ],
      resultCount: 7
    },
    // ── Skill 1b: XAU/BTC by Author B (same topic, different author) ──
    {
      boxId: 'demo-001b',
      name: 'Optimal XAU/BTC Performance',
      prose: 'Gold-Bitcoin pair trading optimization with focus on low-latency execution and MEV protection. Targets sub-second arbitrage across centralized and decentralized venues.',
      tags: ['trading', 'gold', 'bitcoin', 'arbitrage', 'mev'],
      domain: 'finance',
      extendedSkillBoxIds: ['demo-001'],
      coverages: [
        { boxId: 'cov-010', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-010',
          skillBoxId: 'demo-001b',
          name: 'Execution Latency',
          description: 'Average order execution latency in milliseconds. Lower is better.',
          metricName: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-020', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', value: 42, notes: 'Sub-50ms consistently', timestamp: 1734220800 },
            { id: 'res-021', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', value: 187, timestamp: 1733616000 },
            { id: 'res-022', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', value: 310, notes: 'Slow bridge delays', timestamp: 1733011200 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 2: Sat-sorter ──
    {
      boxId: 'demo-002',
      name: 'Sat-sorter',
      prose: 'Sort and classify UTXOs by satoshi value for optimal fee management. Agents should minimize transaction costs while maintaining privacy guarantees through intelligent UTXO selection and consolidation.',
      tags: ['utxo', 'optimization', 'fees', 'privacy'],
      domain: 'infrastructure',
      extendedSkillBoxIds: [],
      sourceHash: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      coverages: [
        { boxId: 'cov-003', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-003',
          skillBoxId: 'demo-002',
          name: 'Fee Savings (%)',
          description: 'Percentage of fees saved compared to naive UTXO selection. Higher is better.',
          metricName: 'fee_savings_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-008', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', value: 34.2, notes: 'Optimal for large UTXO sets', timestamp: 1734307200 },
            { id: 'res-009', serviceId: 'QmL8tK4pMfE3VxR6sB7nWq2eDc9jYa5h1', value: 28.7, timestamp: 1733702400 },
            { id: 'res-010', serviceId: 'QmN6wR3pLdG9VyT5tC4mXs8eHf2bZa7k4', value: 19.1, notes: 'Simple greedy approach', timestamp: 1733097600 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 3: Sentiment Analysis ──
    {
      boxId: 'demo-003',
      name: 'On-chain Sentiment Analysis',
      prose: 'Classify community sentiment from forum discussions, social media, and on-chain governance proposals into structured signals. Must handle multi-language input and provide confidence scores with explainability.',
      tags: ['nlp', 'sentiment', 'community', 'governance'],
      domain: 'analytics',
      extendedSkillBoxIds: ['demo-001'],
      sourceHash: '1122334455667788990011223344556677889900aabbccddeeff00112233445566',
      coverages: [],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-004',
          skillBoxId: 'demo-003',
          name: 'Classification Accuracy',
          description: 'Accuracy on the Celaut Sentiment Corpus v2 test set. Higher is better.',
          metricName: 'accuracy',
          higherIsBetter: true,
          results: [
            { id: 'res-011', serviceId: 'QmV3xK7pNdF2WyL9tB6mRa4jUc8eHb1g5', value: 0.891, notes: 'Fine-tuned on crypto corpus', timestamp: 1734048000 },
            { id: 'res-012', serviceId: 'QmU8wP4pMfE6VxR3sC9nYq5eDf7bZa2h8', value: 0.834, timestamp: 1733443200 },
            { id: 'res-013', serviceId: 'QmS5tL2pKdG4VyT8tA7mWq6eHc3jYa9k1', value: 0.762, notes: 'Base model, no fine-tuning', timestamp: 1732838400 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 4: MEV Detection ──
    {
      boxId: 'demo-004',
      name: 'MEV Detection & Prevention',
      prose: 'Detect and prevent miner extractable value (MEV) attacks including front-running, sandwich attacks, and transaction reordering on Ergo and EVM chains. Agents must provide real-time mempool monitoring and transaction shielding.',
      tags: ['mev', 'security', 'mempool', 'front-running'],
      domain: 'security',
      extendedSkillBoxIds: ['demo-003'],
      coverages: [
        { boxId: 'cov-004', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1' },
        { boxId: 'cov-005', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6' },
        { boxId: 'cov-006', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-005',
          skillBoxId: 'demo-004',
          name: 'Detection Rate',
          description: 'Percentage of MEV attacks correctly detected in test mempool. Higher is better.',
          metricName: 'detection_rate_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-014', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', value: 96.8, notes: 'Near-perfect detection', timestamp: 1734220800, sourceHash: 'deadbeef01234567890abcdef01234567890abcdef01234567890abcdef012345' },
            { id: 'res-015', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', value: 93.1, timestamp: 1733616000 },
            { id: 'res-016', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', value: 89.4, notes: 'Misses some subtle sandwich attacks', timestamp: 1733011200 },
            { id: 'res-023', serviceId: 'QmD9xR6pLfE5WyT3tB8mYq2eDf1bZa7h9', value: 84.7, timestamp: 1732406400 },
            { id: 'res-024', serviceId: 'QmE4wK1pMdG8VxR7sC6nWq5eHc3jYa2k5', value: 79.2, notes: 'Rule-based only', timestamp: 1731801600 }
          ]
        })
      ],
      resultCount: 5
    },
    // ── Skill 4b: MEV Detection by Author B (same topic, different author) ──
    {
      boxId: 'demo-004b',
      name: 'MEV Detection & Prevention',
      prose: 'Comprehensive MEV protection suite for Ergo-based DEXes. Focuses on sandwich attack prevention with configurable slippage bounds and private mempool routing.',
      tags: ['mev', 'security', 'dex', 'ergo'],
      domain: 'security',
      extendedSkillBoxIds: ['demo-004'],
      coverages: [
        { boxId: 'cov-011', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-011',
          skillBoxId: 'demo-004b',
          name: 'False Positive Rate',
          description: 'Percentage of legitimate transactions incorrectly flagged as MEV. Lower is better.',
          metricName: 'false_positive_pct',
          higherIsBetter: false,
          results: [
            { id: 'res-025', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1', value: 0.3, notes: 'Very low false positives', timestamp: 1734307200 },
            { id: 'res-026', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', value: 1.2, timestamp: 1733702400 },
            { id: 'res-027', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', value: 2.8, notes: 'Aggressive detection settings', timestamp: 1733097600 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 5: Cross-Chain Liquidity Routing ──
    {
      boxId: 'demo-005',
      name: 'Cross-Chain Liquidity Routing',
      prose: 'Find optimal liquidity paths across decentralized exchanges on Ergo, Ethereum, and Cardano. Agents must account for slippage, bridge fees, gas costs, and execution latency to maximize net output for multi-hop swaps.',
      tags: ['defi', 'liquidity', 'routing', 'cross-chain', 'dex'],
      domain: 'finance',
      extendedSkillBoxIds: ['demo-004'],
      coverages: [
        { boxId: 'cov-007', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-006',
          skillBoxId: 'demo-005',
          name: 'Routing Efficiency',
          description: 'Percentage of optimal output achieved on standard test routes. Higher is better.',
          metricName: 'efficiency_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-017', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', value: 97.1, timestamp: 1734134400 },
            { id: 'res-018', serviceId: 'QmH9wP6pMdE3VxR5sC8nYq4eDf9bZa1h2', value: 91.4, notes: 'Misses some multi-hop paths', timestamp: 1733529600 },
            { id: 'res-019', serviceId: 'QmI4tL7pKdG1VyT2tA6mWq9eHc5jYa3k7', value: 84.8, notes: 'Single-chain only', timestamp: 1732924800 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 6: Smart Contract Scanner ──
    {
      boxId: 'demo-006',
      name: 'Smart Contract Vulnerability Scanner',
      prose: 'Automated audit of ErgoScript and Plutus smart contracts for common vulnerability patterns: integer overflow, replay attacks, box value manipulation, and register injection. Must generate detailed reports with severity scoring and remediation steps.',
      tags: ['audit', 'ergoscript', 'vulnerability', 'smart-contracts'],
      domain: 'security',
      extendedSkillBoxIds: ['demo-005'],
      sourceHash: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
      coverages: [
        { boxId: 'cov-008', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6' },
        { boxId: 'cov-009', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-007',
          skillBoxId: 'demo-006',
          name: 'Vulnerability Detection F1',
          description: 'F1 score on the Celaut Contract Vulnerability Corpus. Higher is better.',
          metricName: 'f1_score',
          higherIsBetter: true,
          sourceHash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
          results: [
            { id: 'res-028', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', value: 0.923, notes: 'Strong on ErgoScript patterns', timestamp: 1734134400, sourceHash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6' },
            { id: 'res-029', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', value: 0.889, timestamp: 1733529600 },
            { id: 'res-030', serviceId: 'QmM3tL4pKdG9VyT6tA5mWq1eHc8jYa2k9', value: 0.831, notes: 'Misses register injection', timestamp: 1732924800 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Stress Test: Image Classification — 3 different authors, same skill name ──
    // ── Skill 7a: Image Classification by Author A ──
    {
      boxId: 'demo-img-001',
      name: 'Image Classification',
      prose: 'General-purpose image classification service supporting ImageNet-1k categories. Optimized for throughput on GPU clusters with batch inference support and automatic model selection.',
      tags: ['vision', 'classification', 'imagenet', 'gpu'],
      domain: 'analytics',
      extendedSkillBoxIds: [],
      sourceHash: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7',
      coverages: [
        { boxId: 'cov-img-001', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N' },
        { boxId: 'cov-img-002', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-img-001',
          skillBoxId: 'demo-img-001',
          name: 'Top-1 Accuracy (ImageNet-1k)',
          description: 'Top-1 classification accuracy on the ImageNet-1k validation set. Higher is better.',
          metricName: 'accuracy_pct',
          higherIsBetter: true,
          sourceHash: 'aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66',
          results: [
            { id: 'res-img-001', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', value: 88.7, notes: 'ViT-L/14 backbone', timestamp: 1734307200 },
            { id: 'res-img-002', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', value: 85.3, notes: 'EfficientNet-B7', timestamp: 1733702400 },
            { id: 'res-img-003', serviceId: 'QmImg3C4D5E6F7G8H9I0J1K2L3M4N5O6P', value: 82.1, notes: 'ResNet-152', timestamp: 1733097600 },
            { id: 'res-img-004', serviceId: 'QmImg4D5E6F7G8H9I0J1K2L3M4N5O6P7Q', value: 79.8, notes: 'MobileNetV3 — lightweight', timestamp: 1732492800 },
            { id: 'res-img-005', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', value: 76.4, notes: 'Custom CNN', timestamp: 1731888000 }
          ]
        }),
        singleMetricBenchmark({
          id: 'bench-img-002',
          skillBoxId: 'demo-img-001',
          name: 'Inference Speed',
          description: 'Average inference time per image in milliseconds on an A100 GPU. Lower is better.',
          metricName: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-img-006', serviceId: 'QmImg4D5E6F7G8H9I0J1K2L3M4N5O6P7Q', value: 2.1, notes: 'MobileNet — blazing fast', timestamp: 1734307200 },
            { id: 'res-img-007', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', value: 8.4, notes: 'Batch=1', timestamp: 1733702400 },
            { id: 'res-img-008', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', value: 15.2, notes: 'ViT-L — larger model', timestamp: 1733097600 },
            { id: 'res-img-009', serviceId: 'QmImg3C4D5E6F7G8H9I0J1K2L3M4N5O6P', value: 11.8, timestamp: 1732492800 }
          ]
        })
      ],
      resultCount: 9
    },
    // ── Skill 7b: Image Classification by Author B ──
    {
      boxId: 'demo-img-002',
      name: 'Image Classification',
      prose: 'Medical image classification specializing in radiology scans (X-ray, CT, MRI). HIPAA-compliant inference pipeline with explainability via GradCAM attention maps and confidence calibration.',
      tags: ['vision', 'classification', 'medical', 'radiology', 'explainability'],
      domain: 'analytics',
      extendedSkillBoxIds: ['demo-img-001'],
      sourceHash: 'bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77',
      coverages: [
        { boxId: 'cov-img-003', serviceId: 'QmMed1F7G8H9I0J1K2L3M4N5O6P7Q8R9S' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-img-003',
          skillBoxId: 'demo-img-002',
          name: 'F1 Score (Chest X-ray)',
          description: 'F1 score on the CheXpert multi-label classification benchmark. Higher is better.',
          metricName: 'f1_score',
          higherIsBetter: true,
          results: [
            { id: 'res-img-010', serviceId: 'QmMed1F7G8H9I0J1K2L3M4N5O6P7Q8R9S', value: 0.912, notes: 'DenseNet-121 fine-tuned on CheXpert', timestamp: 1734307200 },
            { id: 'res-img-011', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', value: 0.847, notes: 'General ViT, not domain-tuned', timestamp: 1733702400 },
            { id: 'res-img-012', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', value: 0.791, notes: 'Custom lightweight model', timestamp: 1733097600 }
          ]
        })
      ],
      resultCount: 3
    },
    // ── Skill 7c: Image Classification by Author C ──
    {
      boxId: 'demo-img-003',
      name: 'Image Classification',
      prose: 'Edge-optimized image classification for IoT and embedded devices. Sub-5ms inference on ARM Cortex-M7 with INT8 quantization. Targets industrial quality inspection and anomaly detection use cases.',
      tags: ['vision', 'classification', 'edge', 'iot', 'quantization'],
      domain: 'infrastructure',
      extendedSkillBoxIds: ['demo-img-002'],
      coverages: [
        { boxId: 'cov-img-004', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0' },
        { boxId: 'cov-img-005', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1' },
        { boxId: 'cov-img-006', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2' }
      ],
      benchmarks: [
        singleMetricBenchmark({
          id: 'bench-img-004',
          skillBoxId: 'demo-img-003',
          name: 'Accuracy (MVTec AD)',
          description: 'Classification accuracy on the MVTec Anomaly Detection dataset. Higher is better.',
          metricName: 'accuracy_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-img-013', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', value: 94.2, notes: 'PatchCore-based approach', timestamp: 1734307200 },
            { id: 'res-img-014', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', value: 91.7, notes: 'INT8 quantized', timestamp: 1733702400 },
            { id: 'res-img-015', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', value: 87.5, notes: 'TinyML model, very fast', timestamp: 1733097600 },
            { id: 'res-img-016', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', value: 96.8, notes: 'Cloud model — not edge-optimized', timestamp: 1732492800 }
          ]
        }),
        singleMetricBenchmark({
          id: 'bench-img-005',
          skillBoxId: 'demo-img-003',
          name: 'Edge Inference Latency',
          description: 'Inference time per image in milliseconds on ARM Cortex-M7 (STM32H7). Lower is better.',
          metricName: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-img-017', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', value: 3.2, notes: 'INT8, fully optimized', timestamp: 1734307200 },
            { id: 'res-img-018', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', value: 4.8, notes: 'NanoNet architecture', timestamp: 1733702400 },
            { id: 'res-img-019', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', value: 12.4, notes: 'FP32 — not quantized', timestamp: 1733097600 }
          ]
        })
      ],
      resultCount: 7
    },
    // ── Skill 8: LLM Inference — NATIVE multi-descriptor / multi-metric ──
    // Demonstrates the post-2026-06-18 tensor shape: each benchmark declares
    // caseDescriptors[] (problem axes) and performanceMetrics[] (measurement
    // axes), and each Result.data is a list of cases sweeping the descriptor
    // grid. The leaderboard groups these by descriptor tuple.
    {
      boxId: 'demo-008',
      name: 'LLM Inference Service',
      prose: 'Serve large-language-model completions with bounded latency, predictable cost, and reproducible quality. Agents must handle batched inference across varying context lengths and model sizes; results are reported per (model_size, context_tokens, batch_size) configuration so consumers can pick the best service for their workload.',
      tags: ['llm', 'inference', 'serving', 'gpu'],
      domain: 'analytics',
      extendedSkillBoxIds: [],
      sourceHash: '8a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7008',
      coverages: [
        { boxId: 'cov-llm-a', serviceId: 'QmLLM-A-fast-gpu' },
        { boxId: 'cov-llm-b', serviceId: 'QmLLM-B-cheap-cpu' },
        { boxId: 'cov-llm-c', serviceId: 'QmLLM-C-balanced' }
      ],
      benchmarks: [
        {
          id: 'bench-llm-perf',
          skillBoxId: 'demo-008',
          name: 'Inference Performance Grid',
          description: 'Latency, throughput, and cost across model size, context length, and batch size. Cases sweep a 2×3×2 grid; metrics are independent dimensions.',
          // NEW SHAPE: native multi-descriptor + multi-metric.
          caseDescriptors: [
            { name: 'model_size_b', description: 'Parameter count, in billions (7 or 70).' },
            { name: 'context_tokens', description: 'Prompt + completion tokens per request.' },
            { name: 'batch_size', description: 'Concurrent requests per inference call.' }
          ],
          performanceMetrics: [
            { name: 'latency_p50_ms', description: 'Median end-to-end request latency.', higherIsBetter: false },
            { name: 'throughput_tok_per_s', description: 'Decoded tokens per second per request.', higherIsBetter: true },
            { name: 'cost_per_1k_tokens_usd', description: 'Billed cost per 1k output tokens.', higherIsBetter: false }
          ],
          results: [
            {
              id: 'res-llm-001',
              benchmarkId: 'bench-llm-perf',
              serviceId: 'QmLLM-A-fast-gpu',
              notes: 'A100 80GB cluster, vLLM 0.6 with paged-attention.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,   512, 1],  metricsValues: [ 180,  92, 0.0009] },
                { caseMeta: [7,   512, 8],  metricsValues: [ 240, 380, 0.00045] },
                { caseMeta: [7,  2048, 1],  metricsValues: [ 520,  88, 0.0011] },
                { caseMeta: [7,  2048, 8],  metricsValues: [ 690, 360, 0.00055] },
                { caseMeta: [7,  8192, 1],  metricsValues: [1850,  72, 0.0017] },
                { caseMeta: [7,  8192, 8],  metricsValues: [2400, 290, 0.00085] },
                { caseMeta: [70,  512, 1],  metricsValues: [ 410,  41, 0.0042] },
                { caseMeta: [70,  512, 8],  metricsValues: [ 720, 165, 0.0021] },
                { caseMeta: [70, 2048, 1],  metricsValues: [1300,  38, 0.0055] },
                { caseMeta: [70, 2048, 8],  metricsValues: [2200, 145, 0.0027] },
                { caseMeta: [70, 8192, 1],  metricsValues: [5100,  29, 0.0091] },
                { caseMeta: [70, 8192, 8],  metricsValues: [7400, 110, 0.0046] }
              ]
            },
            {
              id: 'res-llm-002',
              benchmarkId: 'bench-llm-perf',
              serviceId: 'QmLLM-B-cheap-cpu',
              notes: 'Spot-priced CPU instances; cheap but slow.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,   512, 1],  metricsValues: [1600,  12, 0.00012] },
                { caseMeta: [7,   512, 8],  metricsValues: [3200,  60, 0.00006] },
                { caseMeta: [7,  2048, 1],  metricsValues: [4900,  10, 0.00015] },
                { caseMeta: [7,  2048, 8],  metricsValues: [9800,  52, 0.00008] }
                // Larger sweeps OOM on CPU instances — intentionally missing
                // cases so the UI exercises the partial-coverage path.
              ]
            },
            {
              id: 'res-llm-003',
              benchmarkId: 'bench-llm-perf',
              serviceId: 'QmLLM-C-balanced',
              notes: 'H100 single-node; midrange cost.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,   512, 1],  metricsValues: [ 140, 110, 0.0014] },
                { caseMeta: [7,   512, 8],  metricsValues: [ 200, 440, 0.0007] },
                { caseMeta: [7,  2048, 1],  metricsValues: [ 430, 105, 0.0017] },
                { caseMeta: [7,  2048, 8],  metricsValues: [ 600, 410, 0.00085] },
                { caseMeta: [7,  8192, 1],  metricsValues: [1500,  86, 0.0024] },
                { caseMeta: [7,  8192, 8],  metricsValues: [2100, 335, 0.0012] },
                { caseMeta: [70,  512, 1],  metricsValues: [ 320,  52, 0.0055] },
                { caseMeta: [70,  512, 8],  metricsValues: [ 580, 200, 0.0028] },
                { caseMeta: [70, 2048, 1],  metricsValues: [ 990,  48, 0.0072] },
                { caseMeta: [70, 2048, 8],  metricsValues: [1700, 180, 0.0036] },
                { caseMeta: [70, 8192, 1],  metricsValues: [3800,  36, 0.0118] },
                { caseMeta: [70, 8192, 8],  metricsValues: [5500, 138, 0.006] }
              ]
            },
            {
              id: 'res-llm-004',
              benchmarkId: 'bench-llm-perf',
              serviceId: 'QmLLM-C-balanced',
              notes: 'Same service, re-run with TensorRT-LLM build for a vouching duplicate.',
              timestamp: 1734393600,
              data: [
                { caseMeta: [7,   512, 1],  metricsValues: [ 130, 115, 0.0014] },
                { caseMeta: [7,  2048, 1],  metricsValues: [ 415, 108, 0.0017] },
                { caseMeta: [70, 2048, 1],  metricsValues: [ 960,  50, 0.0072] }
              ]
            }
          ]
        },
        {
          id: 'bench-llm-quality',
          skillBoxId: 'demo-008',
          name: 'Quality Grid (MMLU + HumanEval)',
          description: 'Quality across model size on two evaluation suites. caseMeta = [model_size_b, eval_suite_id] where 0 = MMLU, 1 = HumanEval.',
          caseDescriptors: [
            { name: 'model_size_b', description: 'Parameter count, in billions.' },
            { name: 'eval_suite_id', description: '0 = MMLU (general knowledge), 1 = HumanEval (code).' }
          ],
          performanceMetrics: [
            { name: 'accuracy_pct', description: 'Suite accuracy (%) — for code suites this is pass@1.', higherIsBetter: true },
            { name: 'std_err', description: 'Standard error of the accuracy estimate.', higherIsBetter: false }
          ],
          results: [
            {
              id: 'res-llm-q-001',
              benchmarkId: 'bench-llm-quality',
              serviceId: 'QmLLM-A-fast-gpu',
              notes: 'Stock model snapshots.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,  0], metricsValues: [62.4, 1.1] },
                { caseMeta: [7,  1], metricsValues: [34.7, 1.8] },
                { caseMeta: [70, 0], metricsValues: [78.9, 0.9] },
                { caseMeta: [70, 1], metricsValues: [62.1, 1.6] }
              ]
            },
            {
              id: 'res-llm-q-002',
              benchmarkId: 'bench-llm-quality',
              serviceId: 'QmLLM-C-balanced',
              notes: 'Same checkpoints, different harness build.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,  0], metricsValues: [62.1, 1.2] },
                { caseMeta: [7,  1], metricsValues: [35.1, 1.7] },
                { caseMeta: [70, 0], metricsValues: [79.3, 0.8] },
                { caseMeta: [70, 1], metricsValues: [61.8, 1.5] }
              ]
            },
            {
              id: 'res-llm-q-003',
              benchmarkId: 'bench-llm-quality',
              serviceId: 'QmLLM-B-cheap-cpu',
              notes: 'CPU service only runs the 7B suite — 70B is intentionally absent.',
              timestamp: 1734307200,
              data: [
                { caseMeta: [7,  0], metricsValues: [61.9, 1.3] },
                { caseMeta: [7,  1], metricsValues: [33.4, 1.9] }
              ]
            }
          ]
        }
      ],
      resultCount: 7
    }
  ];

  return enrichDemoSkills(rawSkills);
}
