/**
 * API/data layer for Celaut Skills.
 * Handles chain queries, box parsing, and demo data.
 */

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
 * These are *placeholder* identifiers — real on-chain Type NFTs have not been
 * minted yet, so the chain query functions below short-circuit to `[]` until
 * each constant is replaced with a real 64-char hex token ID. This avoids the
 * 400 Bad Request that the previous hand-rolled box-search payload was
 * producing against the Ergo Explorer API.
 */
export const SKILL_TYPE_ID = 'celaut:skill:v1';
export const BENCHMARK_TYPE_ID = 'celaut:benchmark-schema:v1'; // Defines HOW to measure (was: benchmark schema)
export const RESULT_TYPE_ID = 'celaut:benchmark:v1';           // Actual measurement result (was: benchmark)
export const COVERAGE_TYPE_ID = 'celaut:coverage:v1';

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
export async function hydrateReputations<T extends { profileId: string; reputation: number }>(
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

function enrichDemoSkills(rawSkills: any[]): Skill[] {
  return rawSkills.map((skill: any, skillIndex: number) => {
    const skillProfileId = demoProfileId(`skill-${skillIndex + 1}-${skill.boxId}`);

    return {
      ...skill,
      profileId: skillProfileId,
      reputation: demoReputationFor(skillProfileId),
      coverages: skill.coverages.map((coverage: any) => {
        const profileId = demoProfileId(`coverage-${coverage.serviceId || coverage.boxId}`);
        return {
          ...coverage,
          profileId,
          reputation: demoReputationFor(profileId)
        };
      }),
      benchmarks: skill.benchmarks.map((benchmark: any, benchmarkIndex: number) => {
        const benchmarkProfileId = demoProfileId(`benchmark-${skill.boxId}-${benchmark.id}-${benchmarkIndex + 1}`);
        return {
          ...benchmark,
          profileId: benchmarkProfileId,
          reputation: demoReputationFor(benchmarkProfileId),
          results: benchmark.results.map((result: any) => {
            const resultProfileId = demoProfileId(`result-${result.serviceId}-${result.id}`);
            return {
              ...result,
              profileId: resultProfileId,
              reputation: demoReputationFor(resultProfileId)
            };
          })
        };
      })
    };
  });
}
// ── Box Parsing ──────────────────────────────────────────────────────────────

/** Parse a raw Explorer box into a Skill, or null if unparseable. */
export function parseSkillBox(box: any): Skill | null {
  try {
    const r9 = box.additionalRegisters?.R9?.renderedValue || '';
    let parsed: any = {};
    try {
      parsed = JSON.parse(r9);
    } catch {
      parsed = { name: r9 || box.boxId.slice(0, 8) };
    }
    const profileId = deriveProfileId(box, parsed, box.boxId);
    return {
      boxId: box.boxId,
      profileId,
      name: parsed.name || 'Unnamed Skill',
      prose: parsed.prose || '',
      tags: parsed.tags || [],
      domain: parsed.domain || '',
      extendedSkillBoxIds: parsed.extended_skill_boxes || [],
      coverages: [],
      benchmarks: [],
      resultCount: 0,
      reputation: 0
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

/** Load coverages for a given skill box ID. */
export async function loadCoverages(skillBoxId: string): Promise<Coverage[]> {
  if (!isHexId(COVERAGE_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(COVERAGE_TYPE_ID, skillBoxId);
  const coverages = boxes
    .map((box: any) => {
      try {
        const r9 = box.additionalRegisters?.R9?.renderedValue || '';
        const parsed = JSON.parse(r9);
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
  await hydrateReputations(coverages);
  return coverages;
}

/** Load benchmarks for a given skill box ID. */
export async function loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
  if (!isHexId(BENCHMARK_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(BENCHMARK_TYPE_ID, skillBoxId);
  const benchmarks = boxes
    .map((box: any) => {
      try {
        const r9 = box.additionalRegisters?.R9?.renderedValue || '';
        const parsed = JSON.parse(r9);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        return {
          id: box.boxId,
          profileId,
          skillBoxId,
          name: parsed.name || 'Unnamed Benchmark',
          description: parsed.description || '',
          metric: parsed.metric || '',
          higherIsBetter: parsed.higher_is_better ?? true,
          results: [],
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
        const r9 = box.additionalRegisters?.R9?.renderedValue || '';
        const parsed = JSON.parse(r9);
        const profileId = deriveProfileId(box, parsed, box.boxId);
        return {
          id: box.boxId,
          profileId,
          benchmarkId: benchmarkId,
          serviceId: parsed.service_id || '',
          score: parsed.score || 0,
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

/** Demo skills for local development and fallback when chain is unavailable. */
export function getDemoSkills(): Skill[] {
  const rawSkills = [
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
        { boxId: 'cov-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', label: 'AlphaTrader v2' },
        { boxId: 'cov-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', label: 'QuantErgo Signals' }
      ],
      benchmarks: [
        {
          id: 'bench-001',
          skillBoxId: 'demo-001',
          name: 'Sharpe Ratio (30d rolling)',
          description: 'Measures risk-adjusted return over a 30-day rolling window. Higher Sharpe ratios indicate better risk-adjusted performance.',
          metric: 'sharpe_ratio',
          higherIsBetter: true,
          sourceHash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
          results: [
            { id: 'res-001', benchmarkId: 'bench-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 2.41, notes: 'Consistent alpha over 30d window', timestamp: 1734134400 },
            { id: 'res-002', benchmarkId: 'bench-001', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 1.87, notes: 'Good but higher drawdowns', timestamp: 1733529600 },
            { id: 'res-003', benchmarkId: 'bench-001', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', score: 1.52, notes: '', timestamp: 1732924800 },
            { id: 'res-004', benchmarkId: 'bench-001', serviceId: 'QmW9xK3pNfD4VyL8tB2mRa6jUc5gYe1h4', score: 0.94, notes: 'Underperformed in bear phase', timestamp: 1732320000 }
          ]
        },
        {
          id: 'bench-002',
          skillBoxId: 'demo-001',
          name: 'Max Drawdown',
          description: 'Maximum observed loss from peak to trough. Lower is better — measures worst-case risk.',
          metric: 'max_drawdown_pct',
          higherIsBetter: false,
          results: [
            { id: 'res-005', benchmarkId: 'bench-002', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 4.2, notes: 'Tight risk management', timestamp: 1734134400 },
            { id: 'res-006', benchmarkId: 'bench-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 8.7, notes: '', timestamp: 1733529600 },
            { id: 'res-007', benchmarkId: 'bench-002', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', score: 12.3, notes: 'High volatility exposure', timestamp: 1732924800 }
          ]
        }
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
        { boxId: 'cov-010', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', label: 'GoldBot Fast' }
      ],
      benchmarks: [
        {
          id: 'bench-010',
          skillBoxId: 'demo-001b',
          name: 'Execution Latency',
          description: 'Average order execution latency in milliseconds. Lower is better.',
          metric: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-020', benchmarkId: 'bench-010', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', score: 42, notes: 'Sub-50ms consistently', timestamp: 1734220800 },
            { id: 'res-021', benchmarkId: 'bench-010', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 187, notes: '', timestamp: 1733616000 },
            { id: 'res-022', benchmarkId: 'bench-010', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 310, notes: 'Slow bridge delays', timestamp: 1733011200 }
          ]
        }
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
        { boxId: 'cov-003', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', label: 'UTXOptimizer' }
      ],
      benchmarks: [
        {
          id: 'bench-003',
          skillBoxId: 'demo-002',
          name: 'Fee Savings (%)',
          description: 'Percentage of fees saved compared to naive UTXO selection. Higher is better.',
          metric: 'fee_savings_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-008', benchmarkId: 'bench-003', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', score: 34.2, notes: 'Optimal for large UTXO sets', timestamp: 1734307200 },
            { id: 'res-009', benchmarkId: 'bench-003', serviceId: 'QmL8tK4pMfE3VxR6sB7nWq2eDc9jYa5h1', score: 28.7, notes: '', timestamp: 1733702400 },
            { id: 'res-010', benchmarkId: 'bench-003', serviceId: 'QmN6wR3pLdG9VyT5tC4mXs8eHf2bZa7k4', score: 19.1, notes: 'Simple greedy approach', timestamp: 1733097600 }
          ]
        }
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
        {
          id: 'bench-004',
          skillBoxId: 'demo-003',
          name: 'Classification Accuracy',
          description: 'Accuracy on the Celaut Sentiment Corpus v2 test set. Higher is better.',
          metric: 'accuracy',
          higherIsBetter: true,
          results: [
            { id: 'res-011', benchmarkId: 'bench-004', serviceId: 'QmV3xK7pNdF2WyL9tB6mRa4jUc8eHb1g5', score: 0.891, notes: 'Fine-tuned on crypto corpus', timestamp: 1734048000 },
            { id: 'res-012', benchmarkId: 'bench-004', serviceId: 'QmU8wP4pMfE6VxR3sC9nYq5eDf7bZa2h8', score: 0.834, notes: '', timestamp: 1733443200 },
            { id: 'res-013', benchmarkId: 'bench-004', serviceId: 'QmS5tL2pKdG4VyT8tA7mWq6eHc3jYa9k1', score: 0.762, notes: 'Base model, no fine-tuning', timestamp: 1732838400 }
          ]
        }
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
        { boxId: 'cov-004', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', label: 'MEVShield Pro' },
        { boxId: 'cov-005', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', label: 'FlashGuard' },
        { boxId: 'cov-006', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', label: 'DarkForest Monitor' }
      ],
      benchmarks: [
        {
          id: 'bench-005',
          skillBoxId: 'demo-004',
          name: 'Detection Rate',
          description: 'Percentage of MEV attacks correctly detected in test mempool. Higher is better.',
          metric: 'detection_rate_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-014', benchmarkId: 'bench-005', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', score: 96.8, notes: 'Near-perfect detection', timestamp: 1734220800, sourceHash: 'deadbeef01234567890abcdef01234567890abcdef01234567890abcdef012345' },
            { id: 'res-015', benchmarkId: 'bench-005', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 93.1, notes: '', timestamp: 1733616000 },
            { id: 'res-016', benchmarkId: 'bench-005', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', score: 89.4, notes: 'Misses some subtle sandwich attacks', timestamp: 1733011200 },
            { id: 'res-023', benchmarkId: 'bench-005', serviceId: 'QmD9xR6pLfE5WyT3tB8mYq2eDf1bZa7h9', score: 84.7, notes: '', timestamp: 1732406400 },
            { id: 'res-024', benchmarkId: 'bench-005', serviceId: 'QmE4wK1pMdG8VxR7sC6nWq5eHc3jYa2k5', score: 79.2, notes: 'Rule-based only', timestamp: 1731801600 }
          ]
        }
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
        {
          id: 'bench-011',
          skillBoxId: 'demo-004b',
          name: 'False Positive Rate',
          description: 'Percentage of legitimate transactions incorrectly flagged as MEV. Lower is better.',
          metric: 'false_positive_pct',
          higherIsBetter: false,
          results: [
            { id: 'res-025', benchmarkId: 'bench-011', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1', score: 0.3, notes: 'Very low false positives', timestamp: 1734307200 },
            { id: 'res-026', benchmarkId: 'bench-011', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', score: 1.2, notes: '', timestamp: 1733702400 },
            { id: 'res-027', benchmarkId: 'bench-011', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 2.8, notes: 'Aggressive detection settings', timestamp: 1733097600 }
          ]
        }
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
        {
          id: 'bench-006',
          skillBoxId: 'demo-005',
          name: 'Routing Efficiency',
          description: 'Percentage of optimal output achieved on standard test routes. Higher is better.',
          metric: 'efficiency_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-017', benchmarkId: 'bench-006', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', score: 97.1, notes: '', timestamp: 1734134400 },
            { id: 'res-018', benchmarkId: 'bench-006', serviceId: 'QmH9wP6pMdE3VxR5sC8nYq4eDf9bZa1h2', score: 91.4, notes: 'Misses some multi-hop paths', timestamp: 1733529600 },
            { id: 'res-019', benchmarkId: 'bench-006', serviceId: 'QmI4tL7pKdG1VyT2tA6mWq9eHc5jYa3k7', score: 84.8, notes: 'Single-chain only', timestamp: 1732924800 }
          ]
        }
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
        {
          id: 'bench-007',
          skillBoxId: 'demo-006',
          name: 'Vulnerability Detection F1',
          description: 'F1 score on the Celaut Contract Vulnerability Corpus. Higher is better.',
          metric: 'f1_score',
          higherIsBetter: true,
          sourceHash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
          results: [
            { id: 'res-028', benchmarkId: 'bench-007', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', score: 0.923, notes: 'Strong on ErgoScript patterns', timestamp: 1734134400, sourceHash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6' },
            { id: 'res-029', benchmarkId: 'bench-007', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', score: 0.889, notes: '', timestamp: 1733529600 },
            { id: 'res-030', benchmarkId: 'bench-007', serviceId: 'QmM3tL4pKdG9VyT6tA5mWq1eHc8jYa2k9', score: 0.831, notes: 'Misses register injection', timestamp: 1732924800 }
          ]
        }
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
        {
          id: 'bench-img-001',
          skillBoxId: 'demo-img-001',
          name: 'Top-1 Accuracy (ImageNet-1k)',
          description: 'Top-1 classification accuracy on the ImageNet-1k validation set. Higher is better.',
          metric: 'accuracy_pct',
          higherIsBetter: true,
          sourceHash: 'aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66',
          results: [
            { id: 'res-img-001', benchmarkId: 'bench-img-001', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 88.7, notes: 'ViT-L/14 backbone', timestamp: 1734307200 },
            { id: 'res-img-002', benchmarkId: 'bench-img-001', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', score: 85.3, notes: 'EfficientNet-B7', timestamp: 1733702400 },
            { id: 'res-img-003', benchmarkId: 'bench-img-001', serviceId: 'QmImg3C4D5E6F7G8H9I0J1K2L3M4N5O6P', score: 82.1, notes: 'ResNet-152', timestamp: 1733097600 },
            { id: 'res-img-004', benchmarkId: 'bench-img-001', serviceId: 'QmImg4D5E6F7G8H9I0J1K2L3M4N5O6P7Q', score: 79.8, notes: 'MobileNetV3 — lightweight', timestamp: 1732492800 },
            { id: 'res-img-005', benchmarkId: 'bench-img-001', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', score: 76.4, notes: 'Custom CNN', timestamp: 1731888000 }
          ]
        },
        {
          id: 'bench-img-002',
          skillBoxId: 'demo-img-001',
          name: 'Inference Speed',
          description: 'Average inference time per image in milliseconds on an A100 GPU. Lower is better.',
          metric: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-img-006', benchmarkId: 'bench-img-002', serviceId: 'QmImg4D5E6F7G8H9I0J1K2L3M4N5O6P7Q', score: 2.1, notes: 'MobileNet — blazing fast', timestamp: 1734307200 },
            { id: 'res-img-007', benchmarkId: 'bench-img-002', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', score: 8.4, notes: 'Batch=1', timestamp: 1733702400 },
            { id: 'res-img-008', benchmarkId: 'bench-img-002', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 15.2, notes: 'ViT-L — larger model', timestamp: 1733097600 },
            { id: 'res-img-009', benchmarkId: 'bench-img-002', serviceId: 'QmImg3C4D5E6F7G8H9I0J1K2L3M4N5O6P', score: 11.8, notes: '', timestamp: 1732492800 }
          ]
        }
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
        {
          id: 'bench-img-003',
          skillBoxId: 'demo-img-002',
          name: 'F1 Score (Chest X-ray)',
          description: 'F1 score on the CheXpert multi-label classification benchmark. Higher is better.',
          metric: 'f1_score',
          higherIsBetter: true,
          results: [
            { id: 'res-img-010', benchmarkId: 'bench-img-003', serviceId: 'QmMed1F7G8H9I0J1K2L3M4N5O6P7Q8R9S', score: 0.912, notes: 'DenseNet-121 fine-tuned on CheXpert', timestamp: 1734307200 },
            { id: 'res-img-011', benchmarkId: 'bench-img-003', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 0.847, notes: 'General ViT, not domain-tuned', timestamp: 1733702400 },
            { id: 'res-img-012', benchmarkId: 'bench-img-003', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', score: 0.791, notes: 'Custom lightweight model', timestamp: 1733097600 }
          ]
        }
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
        {
          id: 'bench-img-004',
          skillBoxId: 'demo-img-003',
          name: 'Accuracy (MVTec AD)',
          description: 'Classification accuracy on the MVTec Anomaly Detection dataset. Higher is better.',
          metric: 'accuracy_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-img-013', benchmarkId: 'bench-img-004', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', score: 94.2, notes: 'PatchCore-based approach', timestamp: 1734307200 },
            { id: 'res-img-014', benchmarkId: 'bench-img-004', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', score: 91.7, notes: 'INT8 quantized', timestamp: 1733702400 },
            { id: 'res-img-015', benchmarkId: 'bench-img-004', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', score: 87.5, notes: 'TinyML model, very fast', timestamp: 1733097600 },
            { id: 'res-img-016', benchmarkId: 'bench-img-004', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 96.8, notes: 'Cloud model — not edge-optimized', timestamp: 1732492800 }
          ]
        },
        {
          id: 'bench-img-005',
          skillBoxId: 'demo-img-003',
          name: 'Edge Inference Latency',
          description: 'Inference time per image in milliseconds on ARM Cortex-M7 (STM32H7). Lower is better.',
          metric: 'latency_ms',
          higherIsBetter: false,
          results: [
            { id: 'res-img-017', benchmarkId: 'bench-img-005', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', score: 3.2, notes: 'INT8, fully optimized', timestamp: 1734307200 },
            { id: 'res-img-018', benchmarkId: 'bench-img-005', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', score: 4.8, notes: 'NanoNet architecture', timestamp: 1733702400 },
            { id: 'res-img-019', benchmarkId: 'bench-img-005', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', score: 12.4, notes: 'FP32 — not quantized', timestamp: 1733097600 }
          ]
        }
      ],
      resultCount: 7
    }
  ];

  return enrichDemoSkills(rawSkills);
}
