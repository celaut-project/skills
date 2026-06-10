/**
 * API/data layer for Celaut Skills.
 * Handles chain queries, box parsing, and demo data.
 */

import type { Skill, Coverage, Benchmark, Result } from './types';
import { ApiError, NetworkError, ParseError } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

export const EXPLORER_API = 'https://api.ergoplatform.com';

/**
 * Type NFT IDs (Josemi will confirm these; using known pattern).
 * These are placeholder IDs — the actual Type NFT boxes need to be created on-chain first.
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
    return {
      boxId: box.boxId,
      name: parsed.name || 'Unnamed Skill',
      prose: parsed.prose || '',
      tags: parsed.tags || [],
      domain: parsed.domain || '',
      otherSkillBoxIds: parsed.other_skill_box_ids || [],
      coverages: [],
      benchmarks: [],
      resultCount: 0
    };
  } catch {
    return null;
  }
}

// ── Chain Queries ────────────────────────────────────────────────────────────

/** Load skills from the Ergo blockchain via Explorer API. Falls back to demo data on error. */
export async function loadSkills(): Promise<Skill[]> {
  try {
    const response = await fetch(
      `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ergoTreeTemplateHash: "",
          registers: {
            R4: { serializedValue: toHex(SKILL_TYPE_ID) }
          }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      const skills = (data.items || []).map(parseSkillBox).filter(Boolean) as Skill[];
      return skills;
    } else {
      return getDemoSkills();
    }
  } catch (e: any) {
    return getDemoSkills();
  }
}

/**
 * Load coverages for a given skill box ID.
 */
export async function loadCoverages(skillBoxId: string): Promise<Coverage[]> {
  try {
    const response = await fetch(
      `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ergoTreeTemplateHash: "",
          registers: {
            R4: { serializedValue: toHex(COVERAGE_TYPE_ID) },
            R5: { serializedValue: toHex(skillBoxId) }
          }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return (data.items || []).map((box: any) => {
        try {
          const r9 = box.additionalRegisters?.R9?.renderedValue || '';
          const parsed = JSON.parse(r9);
          return {
            boxId: box.boxId,
            serviceId: parsed.service_id || undefined,
            label: parsed.label || 'Unknown Service'
          } as Coverage;
        } catch {
          return null;
        }
      }).filter(Boolean) as Coverage[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Load benchmarks for a given skill box ID.
 */
export async function loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
  try {
    const response = await fetch(
      `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ergoTreeTemplateHash: "",
          registers: {
            R4: { serializedValue: toHex(BENCHMARK_TYPE_ID) },
            R5: { serializedValue: toHex(skillBoxId) }
          }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return (data.items || []).map((box: any) => {
        try {
          const r9 = box.additionalRegisters?.R9?.renderedValue || '';
          const parsed = JSON.parse(r9);
          return {
            id: box.boxId,
            skillBoxId,
            name: parsed.name || 'Unnamed Benchmark',
            description: parsed.description || '',
            metric: parsed.metric || '',
            higherIsBetter: parsed.higher_is_better ?? true,
            results: [],
            sourceHash: parsed.source_hash
          } as Benchmark;
        } catch {
          return null;
        }
      }).filter(Boolean) as Benchmark[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Load results for a given benchmark ID.
 */
export async function loadResults(benchmarkId: string): Promise<Result[]> {
  try {
    const response = await fetch(
      `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ergoTreeTemplateHash: "",
          registers: {
            R4: { serializedValue: toHex(RESULT_TYPE_ID) },
            R5: { serializedValue: toHex(benchmarkId) }
          }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return (data.items || []).map((box: any) => {
        try {
          const r9 = box.additionalRegisters?.R9?.renderedValue || '';
          const parsed = JSON.parse(r9);
          return {
            id: box.boxId,
            benchmarkId: benchmarkId,
            serviceId: parsed.service_id || '',
            score: parsed.score || 0,
            notes: parsed.notes || '',
            timestamp: parsed.timestamp || 0
          } as Result;
        } catch {
          return null;
        }
      }).filter(Boolean) as Result[];
    }
    return [];
  } catch {
    return [];
  }
}

// ── Demo Data ────────────────────────────────────────────────────────────────

/** Demo skills for local development and fallback when chain is unavailable. */
export function getDemoSkills(): Skill[] {
  return [
    // ── Skill 1a: XAU/BTC by Author A ──
    {
      boxId: 'demo-001',
      name: 'Optimal XAU/BTC Performance',
      prose: 'Maximize risk-adjusted returns on the XAU/BTC pair using on-chain verifiable strategies. Agents must demonstrate consistent alpha generation across bull and bear regimes with transparent position tracking.',
      tags: ['trading', 'gold', 'bitcoin', 'risk-management'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-001b', 'demo-003'],
      sourceHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      coverages: [
        { boxId: 'cov-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', label: 'AlphaTrader v2' },
        { boxId: 'cov-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', label: 'QuantErgo Signals' },
        { boxId: 'cov-030', serviceId: 'QmZ1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o', label: 'BullionSwap Router' },
        { boxId: 'cov-031', serviceId: 'QmA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p', label: 'GoldChain Analytics' }
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
            { id: 'res-004', benchmarkId: 'bench-001', serviceId: 'QmW9xK3pNfD4VyL8tB2mRa6jUc5gYe1h4', score: 0.94, notes: 'Underperformed in bear phase', timestamp: 1732320000 },
            { id: 'res-101', benchmarkId: 'bench-001', serviceId: 'QmZ1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o', score: 2.15, notes: 'Low volatility approach', timestamp: 1734220800 },
            { id: 'res-102', benchmarkId: 'bench-001', serviceId: 'QmA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p', score: 1.69, notes: 'Mid-frequency strats', timestamp: 1734312000 }
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
            { id: 'res-007', benchmarkId: 'bench-002', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', score: 12.3, notes: 'High volatility exposure', timestamp: 1732924800 },
            { id: 'res-103', benchmarkId: 'bench-002', serviceId: 'QmZ1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o', score: 5.1, notes: 'Hedged positions', timestamp: 1734220800 }
          ]
        },
        {
          id: 'bench-020',
          skillBoxId: 'demo-001',
          name: 'Sortino Ratio (90d)',
          description: 'Risk-adjusted return metric penalizing only downside deviation over 90 days. Higher is better.',
          metric: 'sortino_ratio',
          higherIsBetter: true,
          results: [
            { id: 'res-104', benchmarkId: 'bench-020', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 3.89, notes: 'Excellent downside protection', timestamp: 1734400000 },
            { id: 'res-105', benchmarkId: 'bench-020', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 2.44, notes: 'Standard performance', timestamp: 1734390000 },
            { id: 'res-106', benchmarkId: 'bench-020', serviceId: 'QmZ1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o', score: 3.12, notes: 'Robust to market shocks', timestamp: 1734380000 }
          ]
        }
      ],
      resultCount: 13
    },
    // ── Skill 1b: XAU/BTC by Author B (same topic, different author) ──
    {
      boxId: 'demo-001b',
      name: 'Optimal XAU/BTC Performance',
      prose: 'Gold-Bitcoin pair trading optimization with focus on low-latency execution and MEV protection. Targets sub-second arbitrage across centralized and decentralized venues.',
      tags: ['trading', 'gold', 'bitcoin', 'arbitrage', 'mev'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-001'],
      sourceHash: 'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
      coverages: [
        { boxId: 'cov-010', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', label: 'GoldBot Fast' },
        { boxId: 'cov-040', serviceId: 'QmB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q', label: 'ArbitrageX' },
        { boxId: 'cov-041', serviceId: 'QmC3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r', label: 'SpeedRoute Pro' }
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
            { id: 'res-022', benchmarkId: 'bench-010', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 310, notes: 'Slow bridge delays', timestamp: 1733011200 },
            { id: 'res-107', benchmarkId: 'bench-010', serviceId: 'QmB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q', score: 35, notes: 'Co-located nodes', timestamp: 1734307200 },
            { id: 'res-108', benchmarkId: 'bench-010', serviceId: 'QmC3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r', score: 68, notes: 'Cross-chain routing overhead', timestamp: 1734290000 }
          ]
        },
        {
          id: 'bench-030',
          skillBoxId: 'demo-001b',
          name: 'Slippage Avoidance',
          description: 'Average percentage of slippage avoided vs market order baseline. Higher is better.',
          metric: 'slippage_avoided_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-109', benchmarkId: 'bench-030', serviceId: 'QmB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q', score: 96.4, notes: 'TWAP algorithm', timestamp: 1734400000 },
            { id: 'res-110', benchmarkId: 'bench-030', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', score: 93.1, notes: 'VWAP execution', timestamp: 1734390000 },
            { id: 'res-111', benchmarkId: 'bench-030', serviceId: 'QmC3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r', score: 89.5, notes: '', timestamp: 1734380000 },
            { id: 'res-112', benchmarkId: 'bench-030', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 82.3, notes: 'Limit orders only', timestamp: 1734370000 }
          ]
        }
      ],
      resultCount: 9
    },
    // ── Skill 2: Sat-sorter ──
    {
      boxId: 'demo-002',
      name: 'Sat-sorter',
      prose: 'Sort and classify UTXOs by satoshi value for optimal fee management. Agents should minimize transaction costs while maintaining privacy guarantees through intelligent UTXO selection and consolidation.',
      tags: ['utxo', 'optimization', 'fees', 'privacy'],
      domain: 'infrastructure',
      otherSkillBoxIds: ['demo-011'],
      sourceHash: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      coverages: [
        { boxId: 'cov-003', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', label: 'UTXOptimizer' },
        { boxId: 'cov-050', serviceId: 'QmD4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s', label: 'FeeSaver' },
        { boxId: 'cov-051', serviceId: 'QmE5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t', label: 'PrivacyMixer Basic' }
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
            { id: 'res-010', benchmarkId: 'bench-003', serviceId: 'QmN6wR3pLdG9VyT5tC4mXs8eHf2bZa7k4', score: 19.1, notes: 'Simple greedy approach', timestamp: 1733097600 },
            { id: 'res-113', benchmarkId: 'bench-003', serviceId: 'QmD4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s', score: 31.8, notes: 'Dynamic fee estimation', timestamp: 1734400000 },
            { id: 'res-114', benchmarkId: 'bench-003', serviceId: 'QmE5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t', score: 22.4, notes: 'Prioritizes privacy over fees', timestamp: 1734390000 }
          ]
        },
        {
          id: 'bench-031',
          skillBoxId: 'demo-002',
          name: 'Privacy Score (Dumbness)',
          description: 'Measures transaction obfuscation effectiveness against cluster analysis (0-100). Higher is better.',
          metric: 'privacy_score',
          higherIsBetter: true,
          results: [
            { id: 'res-115', benchmarkId: 'bench-031', serviceId: 'QmE5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t', score: 88.5, notes: 'CoinJoin compatible', timestamp: 1734400000 },
            { id: 'res-116', benchmarkId: 'bench-031', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', score: 72.3, notes: 'Standard mixing', timestamp: 1734390000 },
            { id: 'res-117', benchmarkId: 'bench-031', serviceId: 'QmD4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s', score: 65.1, notes: 'No mixing, deterministic selection', timestamp: 1734380000 }
          ]
        }
      ],
      resultCount: 8
    },
    // ── Skill 2b: Sat-sorter by Author B (same topic, different author) ──
    {
      boxId: 'demo-011',
      name: 'Sat-sorter',
      prose: 'Aggressive UTXO consolidation for enterprise wallets. Minimizes chain bloat by intelligently batching small UTXOs during low-fee periods, optimizing for long-term storage efficiency.',
      tags: ['utxo', 'consolidation', 'batching', 'enterprise'],
      domain: 'infrastructure',
      otherSkillBoxIds: ['demo-002'],
      coverages: [
        { boxId: 'cov-060', serviceId: 'QmF6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u', label: 'BulkConsolidator' }
      ],
      benchmarks: [
        {
          id: 'bench-032',
          skillBoxId: 'demo-011',
          name: 'UTXO Set Reduction',
          description: 'Percentage reduction in UTXO count over a 30-day period. Higher is better.',
          metric: 'reduction_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-118', benchmarkId: 'bench-032', serviceId: 'QmF6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u', score: 68.4, notes: 'Heavy batching at night', timestamp: 1734307200 },
            { id: 'res-119', benchmarkId: 'bench-032', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', score: 45.2, notes: 'Conservative merging', timestamp: 1733702400 },
            { id: 'res-120', benchmarkId: 'bench-032', serviceId: 'QmD4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s', score: 51.9, notes: 'Balanced approach', timestamp: 1733097600 }
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
      otherSkillBoxIds: ['demo-001', 'demo-004', 'demo-012'],
      sourceHash: '1122334455667788990011223344556677889900aabbccddeeff00112233445566',
      coverages: [
        { boxId: 'cov-070', serviceId: 'QmG7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v', label: 'SentiChain V2' }
      ],
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
            { id: 'res-013', benchmarkId: 'bench-004', serviceId: 'QmS5tL2pKdG4VyT8tA7mWq6eHc3jYa9k1', score: 0.762, notes: 'Base model, no fine-tuning', timestamp: 1732838400 },
            { id: 'res-121', benchmarkId: 'bench-004', serviceId: 'QmG7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v', score: 0.902, notes: 'Multilingual transformer', timestamp: 1734400000 }
          ]
        },
        {
          id: 'bench-033',
          skillBoxId: 'demo-003',
          name: 'F1 Score (Governance Proposals)',
          description: 'F1 score specifically on governance proposal sentiment dataset. Higher is better.',
          metric: 'f1_score',
          higherIsBetter: true,
          results: [
            { id: 'res-122', benchmarkId: 'bench-033', serviceId: 'QmG7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v', score: 0.875, notes: 'Specifically trained on governance', timestamp: 1734400000 },
            { id: 'res-123', benchmarkId: 'bench-033', serviceId: 'QmV3xK7pNdF2WyL9tB6mRa4jUc8eHb1g5', score: 0.844, notes: '', timestamp: 1734390000 },
            { id: 'res-124', benchmarkId: 'bench-033', serviceId: 'QmU8wP4pMfE6VxR3sC9nYq5eDf7bZa2h8', score: 0.789, notes: 'Struggles with nuance', timestamp: 1734380000 },
            { id: 'res-125', benchmarkId: 'bench-033', serviceId: 'QmS5tL2pKdG4VyT8tA7mWq6eHc3jYa9k1', score: 0.711, notes: 'General model', timestamp: 1734370000 }
          ]
        }
      ],
      resultCount: 8
    },
    // ── Skill 3b: Sentiment Analysis by Author B ──
    {
      boxId: 'demo-012',
      name: 'On-chain Sentiment Analysis',
      prose: 'Real-time whale tracking and sentiment scoring based on large wallet movements and DEX liquidity changes. Uses order flow and size to infer institutional mood, optimized for low-latency trading signals.',
      tags: ['nlp', 'sentiment', 'whales', 'order-flow', 'trading-signals'],
      domain: 'analytics',
      otherSkillBoxIds: ['demo-003'],
      coverages: [
        { boxId: 'cov-080', serviceId: 'QmH8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w', label: 'WhaleWatch AI' },
        { boxId: 'cov-081', serviceId: 'QmI9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x', label: 'FlowSentry' }
      ],
      benchmarks: [
        {
          id: 'bench-034',
          skillBoxId: 'demo-012',
          name: 'Directional Accuracy',
          description: 'Percentage of times the sentiment signal correctly predicts 4h price direction. Higher is better.',
          metric: 'accuracy_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-126', benchmarkId: 'bench-034', serviceId: 'QmH8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w', score: 72.4, notes: 'Strong on BTC pairs', timestamp: 1734307200 },
            { id: 'res-127', benchmarkId: 'bench-034', serviceId: 'QmI9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x', score: 68.1, notes: '', timestamp: 1733702400 },
            { id: 'res-128', benchmarkId: 'bench-034', serviceId: 'QmV3xK7pNdF2WyL9tB6mRa4jUc8eHb1g5', score: 61.5, notes: 'NLP models struggle with price pred.', timestamp: 1733097600 }
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
      otherSkillBoxIds: ['demo-004b', 'demo-006'],
      coverages: [
        { boxId: 'cov-004', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', label: 'MEVShield Pro' },
        { boxId: 'cov-005', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', label: 'FlashGuard' },
        { boxId: 'cov-006', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', label: 'DarkForest Monitor' },
        { boxId: 'cov-090', serviceId: 'QmJ0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y', label: 'MempoolX' }
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
            { id: 'res-024', benchmarkId: 'bench-005', serviceId: 'QmE4wK1pMdG8VxR7sC6nWq5eHc3jYa2k5', score: 79.2, notes: 'Rule-based only', timestamp: 1731801600 },
            { id: 'res-129', benchmarkId: 'bench-005', serviceId: 'QmJ0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y', score: 95.2, notes: 'ML-based mempool scanning', timestamp: 1734400000 }
          ]
        },
        {
          id: 'bench-035',
          skillBoxId: 'demo-004',
          name: 'Protection Success Rate',
          description: 'Percentage of shielded transactions that avoid MEV extraction. Higher is better.',
          metric: 'protection_rate_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-130', benchmarkId: 'bench-035', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', score: 99.1, notes: 'Private mempool routing', timestamp: 1734400000 },
            { id: 'res-131', benchmarkId: 'bench-035', serviceId: 'QmJ0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y', score: 98.4, notes: 'Encryption layer', timestamp: 1734390000 },
            { id: 'res-132', benchmarkId: 'bench-035', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 94.6, notes: 'Slippage tolerance bounds', timestamp: 1734380000 },
            { id: 'res-133', benchmarkId: 'bench-035', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', score: 88.2, notes: 'Basic delay mechanism', timestamp: 1734370000 }
          ]
        }
      ],
      resultCount: 10
    },
    // ── Skill 4b: MEV Detection by Author B (same topic, different author) ──
    {
      boxId: 'demo-004b',
      name: 'MEV Detection & Prevention',
      prose: 'Comprehensive MEV protection suite for Ergo-based DEXes. Focuses on sandwich attack prevention with configurable slippage bounds and private mempool routing.',
      tags: ['mev', 'security', 'dex', 'ergo'],
      domain: 'security',
      otherSkillBoxIds: ['demo-004'],
      sourceHash: 'd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
      coverages: [
        { boxId: 'cov-011', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1', label: 'ErgoShield' },
        { boxId: 'cov-100', serviceId: 'QmK1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z', label: 'SplashPool Defend' }
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
            { id: 'res-027', benchmarkId: 'bench-011', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 2.8, notes: 'Aggressive detection settings', timestamp: 1733097600 },
            { id: 'res-134', benchmarkId: 'bench-011', serviceId: 'QmK1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z', score: 0.8, notes: 'Tuned specifically for Ergo DEX', timestamp: 1734400000 }
          ]
        }
      ],
      resultCount: 4
    },
    // ── Skill 5: Cross-Chain Liquidity Routing ──
    {
      boxId: 'demo-005',
      name: 'Cross-Chain Liquidity Routing',
      prose: 'Find optimal liquidity paths across decentralized exchanges on Ergo, Ethereum, and Cardano. Agents must account for slippage, bridge fees, gas costs, and execution latency to maximize net output for multi-hop swaps.',
      tags: ['defi', 'liquidity', 'routing', 'cross-chain', 'dex'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-001', 'demo-004', 'demo-013'],
      sourceHash: 'e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
      coverages: [
        { boxId: 'cov-007', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', label: 'PathFinder DEX' },
        { boxId: 'cov-110', serviceId: 'QmL2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a', label: 'OmniBridge V3' },
        { boxId: 'cov-111', serviceId: 'QmM3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b', label: 'ChainHop Liquidity' },
        { boxId: 'cov-112', serviceId: 'QmN4o5P6q7R8s9T0u1V2w3X4y5Z6a7B8c', label: 'AquaRouter' }
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
            { id: 'res-019', benchmarkId: 'bench-006', serviceId: 'QmI4tL7pKdG1VyT2tA6mWq9eHc5jYa3k7', score: 84.8, notes: 'Single-chain only', timestamp: 1732924800 },
            { id: 'res-135', benchmarkId: 'bench-006', serviceId: 'QmL2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a', score: 96.5, notes: 'Excellent bridge routing', timestamp: 1734400000 },
            { id: 'res-136', benchmarkId: 'bench-006', serviceId: 'QmM3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b', score: 93.2, notes: '', timestamp: 1734390000 },
            { id: 'res-137', benchmarkId: 'bench-006', serviceId: 'QmN4o5P6q7R8s9T0u1V2w3X4y5Z6a7B8c', score: 89.9, notes: 'Limited liquidity sources', timestamp: 1734380000 }
          ]
        },
        {
          id: 'bench-036',
          skillBoxId: 'demo-005',
          name: 'Cross-Chain Settlement Time',
          description: 'Average time in seconds to complete a cross-chain swap including bridging. Lower is better.',
          metric: 'settlement_time_s',
          higherIsBetter: false,
          results: [
            { id: 'res-138', benchmarkId: 'bench-036', serviceId: 'QmL2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a', score: 18.4, notes: 'L2 bridge utilized', timestamp: 1734400000 },
            { id: 'res-139', benchmarkId: 'bench-036', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', score: 32.1, notes: 'Standard routing', timestamp: 1734390000 },
            { id: 'res-140', benchmarkId: 'bench-036', serviceId: 'QmM3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b', score: 45.9, notes: 'Includes finality wait', timestamp: 1734380000 },
            { id: 'res-141', benchmarkId: 'bench-036', serviceId: 'QmN4o5P6q7R8s9T0u1V2w3X4y5Z6a7B8c', score: 120.5, notes: 'Slow L1 bridge', timestamp: 1734370000 }
          ]
        }
      ],
      resultCount: 10
    },
    // ── Skill 5b: Cross-Chain Liquidity Routing by Author B ──
    {
      boxId: 'demo-013',
      name: 'Cross-Chain Liquidity Routing',
      prose: 'Enterprise-grade liquidity aggregation across 15 chains. Focuses on high-volume institutional swaps ($1M+) with TWAP execution, minimal market impact, and integrated compliance checks.',
      tags: ['defi', 'liquidity', 'institutional', 'compliance', 'whale'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-005'],
      coverages: [
        { boxId: 'cov-120', serviceId: 'QmO5p6Q7r8S9t0U1v2W3x4Y5z6a7B8c9D', label: 'InstitutionalRouter' }
      ],
      benchmarks: [
        {
          id: 'bench-037',
          skillBoxId: 'demo-013',
          name: 'Market Impact ($5M Swap)',
          description: 'Percentage of price slippage on a $5M notional swap. Lower is better.',
          metric: 'market_impact_pct',
          higherIsBetter: false,
          results: [
            { id: 'res-142', benchmarkId: 'bench-037', serviceId: 'QmO5p6Q7r8S9t0U1v2W3x4Y5z6a7B8c9D', score: 0.12, notes: 'Dark pool integration', timestamp: 1734307200 },
            { id: 'res-143', benchmarkId: 'bench-037', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', score: 1.85, notes: 'Public DEX only', timestamp: 1733702400 },
            { id: 'res-144', benchmarkId: 'bench-037', serviceId: 'QmL2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a', score: 0.45, notes: 'Good for mid-size', timestamp: 1733097600 }
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
      otherSkillBoxIds: ['demo-004', 'demo-014'],
      sourceHash: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
      coverages: [
        { boxId: 'cov-008', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', label: 'SigmaAudit' },
        { boxId: 'cov-009', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', label: 'ErgoSentinel' },
        { boxId: 'cov-130', serviceId: 'QmP6q7R8s9T0u1V2w3X4y5Z6a7b8C9d0E', label: 'AuditBot 3000' }
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
            { id: 'res-030', benchmarkId: 'bench-007', serviceId: 'QmM3tL4pKdG9VyT6tA5mWq1eHc8jYa2k9', score: 0.831, notes: 'Misses register injection', timestamp: 1732924800 },
            { id: 'res-145', benchmarkId: 'bench-007', serviceId: 'QmP6q7R8s9T0u1V2w3X4y5Z6a7b8C9d0E', score: 0.905, notes: 'Heuristic + symbolic execution', timestamp: 1734400000 }
          ]
        },
        {
          id: 'bench-038',
          skillBoxId: 'demo-006',
          name: 'Scan Speed (LOC/min)',
          description: 'Lines of code scanned per minute. Higher is better.',
          metric: 'loc_per_min',
          higherIsBetter: true,
          results: [
            { id: 'res-146', benchmarkId: 'bench-038', serviceId: 'QmP6q7R8s9T0u1V2w3X4y5Z6a7b8C9d0E', score: 12500, notes: 'SAST fast-path', timestamp: 1734400000 },
            { id: 'res-147', benchmarkId: 'bench-038', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', score: 8400, notes: 'Deep formal verification', timestamp: 1734390000 },
            { id: 'res-148', benchmarkId: 'bench-038', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', score: 6200, notes: '', timestamp: 1734380000 }
          ]
        }
      ],
      resultCount: 7
    },
    // ── Skill 6b: Smart Contract Scanner by Author B ──
    {
      boxId: 'demo-014',
      name: 'Smart Contract Vulnerability Scanner',
      prose: 'EVM-focused smart contract security scanner. Detects reentrancy, flash loan attacks, and oracle manipulation in Solidity and Vyper contracts with high precision using taint analysis.',
      tags: ['audit', 'solidity', 'evm', 'vulnerability', 'taint-analysis'],
      domain: 'security',
      otherSkillBoxIds: ['demo-006'],
      coverages: [
        { boxId: 'cov-140', serviceId: 'QmQ7r8S9t0U1v2W3x4Y5z6a7B8c9D0e1F', label: 'EVMGuard' },
        { boxId: 'cov-141', serviceId: 'QmR8s9T0u1V2w3X4y5Z6a7b8C9d0E1f2G', label: 'SolidityShield' }
      ],
      benchmarks: [
        {
          id: 'bench-039',
          skillBoxId: 'demo-014',
          name: 'SWC Registry Detection Rate',
          description: 'Detection rate across the SWC vulnerability registry test cases. Higher is better.',
          metric: 'detection_rate_pct',
          higherIsBetter: true,
          results: [
            { id: 'res-149', benchmarkId: 'bench-039', serviceId: 'QmQ7r8S9t0U1v2W3x4Y5z6a7B8c9D0e1F', score: 94.5, notes: 'Excellent on reentrancy', timestamp: 1734307200 },
            { id: 'res-150', benchmarkId: 'bench-039', serviceId: 'QmR8s9T0u1V2w3X4y5Z6a7b8C9d0E1f2G', score: 89.2, notes: '', timestamp: 1733702400 },
            { id: 'res-151', benchmarkId: 'bench-039', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', score: 42.1, notes: 'ErgoScript model fails on EVM', timestamp: 1733097600 }
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
      otherSkillBoxIds: ['demo-img-002', 'demo-img-003'],
      sourceHash: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7',
      coverages: [
        { boxId: 'cov-img-001', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', label: 'VisionNet Pro' },
        { boxId: 'cov-img-002', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', label: 'EfficientClassifier' },
        { boxId: 'cov-img-010', serviceId: 'QmImg0Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M', label: 'BatchVision Cloud' }
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
            { id: 'res-img-005', benchmarkId: 'bench-img-001', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', score: 76.4, notes: 'Custom CNN', timestamp: 1731888000 },
            { id: 'res-img-020', benchmarkId: 'bench-img-001', serviceId: 'QmImg0Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M', score: 89.1, notes: 'Ensemble of 3 models', timestamp: 1734400000 }
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
            { id: 'res-img-009', benchmarkId: 'bench-img-002', serviceId: 'QmImg3C4D5E6F7G8H9I0J1K2L3M4N5O6P', score: 11.8, notes: '', timestamp: 1732492800 },
            { id: 'res-img-021', benchmarkId: 'bench-img-002', serviceId: 'QmImg0Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M', score: 22.4, notes: 'Ensemble overhead', timestamp: 1734400000 }
          ]
        },
        {
          id: 'bench-img-030',
          skillBoxId: 'demo-img-001',
          name: 'Throughput (Images/sec)',
          description: 'Number of images processed per second on an A100 GPU with batch size 32. Higher is better.',
          metric: 'images_per_sec',
          higherIsBetter: true,
          results: [
            { id: 'res-img-022', benchmarkId: 'bench-img-030', serviceId: 'QmImg0Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M', score: 1420, notes: 'Optimized batch pipeline', timestamp: 1734400000 },
            { id: 'res-img-023', benchmarkId: 'bench-img-030', serviceId: 'QmImg2B3C4D5E6F7G8H9I0J1K2L3M4N5O', score: 1100, notes: '', timestamp: 1734390000 },
            { id: 'res-img-024', benchmarkId: 'bench-img-030', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 450, notes: 'Memory bound', timestamp: 1734380000 }
          ]
        }
      ],
      resultCount: 14
    },
    // ── Skill 7b: Image Classification by Author B ──
    {
      boxId: 'demo-img-002',
      name: 'Image Classification',
      prose: 'Medical image classification specializing in radiology scans (X-ray, CT, MRI). HIPAA-compliant inference pipeline with explainability via GradCAM attention maps and confidence calibration.',
      tags: ['vision', 'classification', 'medical', 'radiology', 'explainability'],
      domain: 'analytics',
      otherSkillBoxIds: ['demo-img-001', 'demo-img-003'],
      sourceHash: 'bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77',
      coverages: [
        { boxId: 'cov-img-003', serviceId: 'QmMed1F7G8H9I0J1K2L3M4N5O6P7Q8R9S', label: 'MedVision AI' },
        { boxId: 'cov-img-011', serviceId: 'QmMed2G8H9I0J1K2L3M4N5O6P7Q8R9S0T', label: 'RadiologyNet' },
        { boxId: 'cov-img-012', serviceId: 'QmMed3H9I0J1K2L3M4N5O6P7Q8R9S0T1U', label: 'HealthScan Pro' }
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
            { id: 'res-img-012', benchmarkId: 'bench-img-003', serviceId: 'QmImg5E6F7G8H9I0J1K2L3M4N5O6P7Q8R', score: 0.791, notes: 'Custom lightweight model', timestamp: 1733097600 },
            { id: 'res-img-025', benchmarkId: 'bench-img-003', serviceId: 'QmMed2G8H9I0J1K2L3M4N5O6P7Q8R9S0T', score: 0.924, notes: 'Specialized in thorax pathologies', timestamp: 1734400000 },
            { id: 'res-img-026', benchmarkId: 'bench-img-003', serviceId: 'QmMed3H9I0J1K2L3M4N5O6P7Q8R9S0T1U', score: 0.898, notes: 'Multi-center validated', timestamp: 1734390000 }
          ]
        },
        {
          id: 'bench-img-031',
          skillBoxId: 'demo-img-002',
          name: 'AUC-ROC (Brain MRI Segmentation)',
          description: 'Area under the ROC curve for tumor classification on BraTS dataset. Higher is better.',
          metric: 'auc_roc',
          higherIsBetter: true,
          results: [
            { id: 'res-img-027', benchmarkId: 'bench-img-031', serviceId: 'QmMed2G8H9I0J1K2L3M4N5O6P7Q8R9S0T', score: 0.965, notes: '3D U-Net variant', timestamp: 1734400000 },
            { id: 'res-img-028', benchmarkId: 'bench-img-031', serviceId: 'QmMed1F7G8H9I0J1K2L3M4N5O6P7Q8R9S', score: 0.941, notes: 'Generic medical model', timestamp: 1734390000 },
            { id: 'res-img-029', benchmarkId: 'bench-img-031', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 0.822, notes: 'Not trained on MRI', timestamp: 1734380000 }
          ]
        }
      ],
      resultCount: 8
    },
    // ── Skill 7c: Image Classification by Author C ──
    {
      boxId: 'demo-img-003',
      name: 'Image Classification',
      prose: 'Edge-optimized image classification for IoT and embedded devices. Sub-5ms inference on ARM Cortex-M7 with INT8 quantization. Targets industrial quality inspection and anomaly detection use cases.',
      tags: ['vision', 'classification', 'edge', 'iot', 'quantization'],
      domain: 'infrastructure',
      otherSkillBoxIds: ['demo-img-001', 'demo-img-002'],
      coverages: [
        { boxId: 'cov-img-004', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', label: 'TinyClassifier' },
        { boxId: 'cov-img-005', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', label: 'EdgeInspect v3' },
        { boxId: 'cov-img-006', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', label: 'NanoVision' },
        { boxId: 'cov-img-013', serviceId: 'QmEdge4J1K2L3M4N5O6P7Q8R9S0T1U2V3', label: 'IndustrialEye' }
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
            { id: 'res-img-016', benchmarkId: 'bench-img-004', serviceId: 'QmImg1A2B3C4D5E6F7G8H9I0J1K2L3M4N', score: 96.8, notes: 'Cloud model — not edge-optimized', timestamp: 1732492800 },
            { id: 'res-img-030', benchmarkId: 'bench-img-004', serviceId: 'QmEdge4J1K2L3M4N5O6P7Q8R9S0T1U2V3', score: 95.1, notes: 'Hybrid edge-cloud fallback', timestamp: 1734400000 }
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
            { id: 'res-img-019', benchmarkId: 'bench-img-005', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', score: 12.4, notes: 'FP32 — not quantized', timestamp: 1733097600 },
            { id: 'res-img-031', benchmarkId: 'bench-img-005', serviceId: 'QmEdge4J1K2L3M4N5O6P7Q8R9S0T1U2V3', score: 6.1, notes: 'Heavy model but accurate', timestamp: 1734400000 }
          ]
        },
        {
          id: 'bench-img-032',
          skillBoxId: 'demo-img-003',
          name: 'Memory Footprint (KB)',
          description: 'Peak RAM usage during inference in kilobytes. Lower is better.',
          metric: 'ram_kb',
          higherIsBetter: false,
          results: [
            { id: 'res-img-032', benchmarkId: 'bench-img-032', serviceId: 'QmEdge3I0J1K2L3M4N5O6P7Q8R9S0T1U2', score: 48, notes: 'Extremely lightweight', timestamp: 1734400000 },
            { id: 'res-img-033', benchmarkId: 'bench-img-032', serviceId: 'QmEdge1G8H9I0J1K2L3M4N5O6P7Q8R9S0', score: 128, notes: 'Standard INT8', timestamp: 1734390000 },
            { id: 'res-img-034', benchmarkId: 'bench-img-032', serviceId: 'QmEdge4J1K2L3M4N5O6P7Q8R9S0T1U2V3', score: 256, notes: 'Acceptable for STM32H7', timestamp: 1734380000 },
            { id: 'res-img-035', benchmarkId: 'bench-img-032', serviceId: 'QmEdge2H9I0J1K2L3M4N5O6P7Q8R9S0T1', score: 512, notes: 'FP32 overhead', timestamp: 1734370000 }
          ]
        }
      ],
      resultCount: 13
    }
  ];
}