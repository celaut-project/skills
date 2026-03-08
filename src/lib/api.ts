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
      author: parsed.author || box.address || '',
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
          ergoTreeTemplateHash: null,
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
          ergoTreeTemplateHash: null,
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
          ergoTreeTemplateHash: null,
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
            benchmarkId: parsed.benchmark_id || benchmarkId,
            serviceId: parsed.service_id || '',
            score: parsed.score || 0,
            notes: parsed.notes || '',
            author: parsed.author || '',
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
      author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
      otherSkillBoxIds: ['demo-003'],
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
          author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
          results: [
            { id: 'res-001', benchmarkId: 'bench-001', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 2.41, notes: 'Consistent alpha over 30d window', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1734134400 },
            { id: 'res-002', benchmarkId: 'bench-001', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 1.87, notes: 'Good but higher drawdowns', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733529600 },
            { id: 'res-003', benchmarkId: 'bench-001', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', score: 1.52, notes: '', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1732924800 },
            { id: 'res-004', benchmarkId: 'bench-001', serviceId: 'QmW9xK3pNfD4VyL8tB2mRa6jUc5gYe1h4', score: 0.94, notes: 'Underperformed in bear phase', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1732320000 }
          ]
        },
        {
          id: 'bench-002',
          skillBoxId: 'demo-001',
          name: 'Max Drawdown',
          description: 'Maximum observed loss from peak to trough. Lower is better — measures worst-case risk.',
          metric: 'max_drawdown_pct',
          higherIsBetter: false,
          author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA',
          results: [
            { id: 'res-005', benchmarkId: 'bench-002', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 4.2, notes: 'Tight risk management', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1734134400 },
            { id: 'res-006', benchmarkId: 'bench-002', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 8.7, notes: '', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733529600 },
            { id: 'res-007', benchmarkId: 'bench-002', serviceId: 'QmT4nP8vLkR2WxJ6sC9mUq5eHb3yZd7f1', score: 12.3, notes: 'High volatility exposure', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1732924800 }
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
      author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
      otherSkillBoxIds: ['demo-001'],
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
          author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
          results: [
            { id: 'res-020', benchmarkId: 'bench-010', serviceId: 'QmJ5wN8kFpL3VyR2tC7mXq9eDf4bZa6h3', score: 42, notes: 'Sub-50ms consistently', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1734220800 },
            { id: 'res-021', benchmarkId: 'bench-010', serviceId: 'QmXf39bC4F7dNK2PwAjQgHh1Vy8cZ9b2a', score: 187, notes: '', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1733616000 },
            { id: 'res-022', benchmarkId: 'bench-010', serviceId: 'QmR7kL5mTnWqP3xJvE8uYs4dFa6wN9c3b', score: 310, notes: 'Slow bridge delays', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733011200 }
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
      author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA',
      otherSkillBoxIds: [],
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
          author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA',
          results: [
            { id: 'res-008', benchmarkId: 'bench-003', serviceId: 'QmP2rV6nKdF8WxL4tA9mYq3eBs5jUc7g2', score: 34.2, notes: 'Optimal for large UTXO sets', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1734307200 },
            { id: 'res-009', benchmarkId: 'bench-003', serviceId: 'QmL8tK4pMfE3VxR6sB7nWq2eDc9jYa5h1', score: 28.7, notes: '', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1733702400 },
            { id: 'res-010', benchmarkId: 'bench-003', serviceId: 'QmN6wR3pLdG9VyT5tC4mXs8eHf2bZa7k4', score: 19.1, notes: 'Simple greedy approach', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1733097600 }
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
      author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
      otherSkillBoxIds: ['demo-001', 'demo-004'],
      coverages: [],
      benchmarks: [
        {
          id: 'bench-004',
          skillBoxId: 'demo-003',
          name: 'Classification Accuracy',
          description: 'Accuracy on the Celaut Sentiment Corpus v2 test set. Higher is better.',
          metric: 'accuracy',
          higherIsBetter: true,
          author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
          results: [
            { id: 'res-011', benchmarkId: 'bench-004', serviceId: 'QmV3xK7pNdF2WyL9tB6mRa4jUc8eHb1g5', score: 0.891, notes: 'Fine-tuned on crypto corpus', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1734048000 },
            { id: 'res-012', benchmarkId: 'bench-004', serviceId: 'QmU8wP4pMfE6VxR3sC9nYq5eDf7bZa2h8', score: 0.834, notes: '', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733443200 },
            { id: 'res-013', benchmarkId: 'bench-004', serviceId: 'QmS5tL2pKdG4VyT8tA7mWq6eHc3jYa9k1', score: 0.762, notes: 'Base model, no fine-tuning', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1732838400 }
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
      author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
      otherSkillBoxIds: ['demo-005'],
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
          author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
          results: [
            { id: 'res-014', benchmarkId: 'bench-005', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', score: 96.8, notes: 'Near-perfect detection', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1734220800 },
            { id: 'res-015', benchmarkId: 'bench-005', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 93.1, notes: '', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1733616000 },
            { id: 'res-016', benchmarkId: 'bench-005', serviceId: 'QmC2tL9pKdG6VyT4tA1mWq3eHc7jYa5k8', score: 89.4, notes: 'Misses some subtle sandwich attacks', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733011200 },
            { id: 'res-023', benchmarkId: 'bench-005', serviceId: 'QmD9xR6pLfE5WyT3tB8mYq2eDf1bZa7h9', score: 84.7, notes: '', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1732406400 },
            { id: 'res-024', benchmarkId: 'bench-005', serviceId: 'QmE4wK1pMdG8VxR7sC6nWq5eHc3jYa2k5', score: 79.2, notes: 'Rule-based only', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1731801600 }
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
      author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
      otherSkillBoxIds: ['demo-004'],
      coverages: [
        { boxId: 'cov-011', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1', label: 'ErgoShield' }
      ],
      benchmarks: [
        {
          id: 'bench-011',
          skillBoxId: 'demo-004b',
          name: 'False Positive Rate',
          description: 'Percentage of legitimate transactions incorrectly flagged as MEV. Lower is better.',
          metric: 'false_positive_pct',
          higherIsBetter: false,
          author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d',
          results: [
            { id: 'res-025', benchmarkId: 'bench-011', serviceId: 'QmF8tN3pKfD2WxL5tA4mRq7eBs6jUc9g1', score: 0.3, notes: 'Very low false positives', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1734307200 },
            { id: 'res-026', benchmarkId: 'bench-011', serviceId: 'QmA3xK8pNfD7WyL2tB5mRa9jUc4eHb6g1', score: 1.2, notes: '', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1733702400 },
            { id: 'res-027', benchmarkId: 'bench-011', serviceId: 'QmB7wP5pMdE9VxR1sC3nYq8eDf2bZa4h6', score: 2.8, notes: 'Aggressive detection settings', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1733097600 }
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
      author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA',
      otherSkillBoxIds: ['demo-001', 'demo-004'],
      coverages: [
        { boxId: 'cov-007', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', label: 'PathFinder DEX' }
      ],
      benchmarks: [
        {
          id: 'bench-006',
          skillBoxId: 'demo-005',
          name: 'Routing Efficiency',
          description: 'Percentage of optimal output achieved on standard test routes. Higher is better.',
          metric: 'efficiency_pct',
          higherIsBetter: true,
          author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA',
          results: [
            { id: 'res-017', benchmarkId: 'bench-006', serviceId: 'QmG5xK2pNdF9WyL7tB3mRa1jUc6eHb4g8', score: 97.1, notes: '', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1734134400 },
            { id: 'res-018', benchmarkId: 'bench-006', serviceId: 'QmH9wP6pMdE3VxR5sC8nYq4eDf9bZa1h2', score: 91.4, notes: 'Misses some multi-hop paths', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1733529600 },
            { id: 'res-019', benchmarkId: 'bench-006', serviceId: 'QmI4tL7pKdG1VyT2tA6mWq9eHc5jYa3k7', score: 84.8, notes: 'Single-chain only', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1732924800 }
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
      author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
      otherSkillBoxIds: ['demo-004'],
      coverages: [
        { boxId: 'cov-008', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', label: 'SigmaAudit' },
        { boxId: 'cov-009', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', label: 'ErgoSentinel' }
      ],
      benchmarks: [
        {
          id: 'bench-007',
          skillBoxId: 'demo-006',
          name: 'Vulnerability Detection F1',
          description: 'F1 score on the Celaut Contract Vulnerability Corpus. Higher is better.',
          metric: 'f1_score',
          higherIsBetter: true,
          author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F',
          results: [
            { id: 'res-028', benchmarkId: 'bench-007', serviceId: 'QmK1xK5pNfD4WyL9tB2mRa8jUc3eHb7g6', score: 0.923, notes: 'Strong on ErgoScript patterns', author: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F', timestamp: 1734134400 },
            { id: 'res-029', benchmarkId: 'bench-007', serviceId: 'QmL6wP9pMdE7VxR4sC1nYq6eDf5bZa8h3', score: 0.889, notes: '', author: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d', timestamp: 1733529600 },
            { id: 'res-030', benchmarkId: 'bench-007', serviceId: 'QmM3tL4pKdG9VyT6tA5mWq1eHc8jYa2k9', score: 0.831, notes: 'Misses register injection', author: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAA', timestamp: 1732924800 }
          ]
        }
      ],
      resultCount: 3
    }
  ];
}
