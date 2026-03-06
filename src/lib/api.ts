/**
 * API/data layer for Celaut Skills.
 * Handles chain queries, box parsing, and demo data.
 */

import type { Skill, Coverage, Benchmark } from './types';
import { ApiError, NetworkError, ParseError } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

export const EXPLORER_API = 'https://api.ergoplatform.com';

/**
 * Type NFT IDs (Josemi will confirm these; using known pattern).
 * These are placeholder IDs — the actual Type NFT boxes need to be created on-chain first.
 * For the MVP we load from Explorer by scanning R4 values.
 */
export const SKILL_TYPE_ID = 'celaut:skill:v1';
export const BENCHMARK_TYPE_ID = 'celaut:benchmark:v1';
export const COVERAGE_TYPE_ID = 'celaut:coverage:v1';

// ── Utilities ────────────────────────────────────────────────────────────────

/** Convert a UTF-8 string to its hex representation. */
export function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Box Parsing ──────────────────────────────────────────────────────────────

/** Parse a raw Explorer box into a Skill, or null if unparseable. */
export function parseSkillBox(box: any): Skill | null {
  try {
    const r9 = box.additionalRegisters?.R9?.renderedValue || '';
    // In production: decode Protobuf. For MVP: treat as JSON fallback.
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
      benchmarkCount: 0
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
      // Fallback: show demo data so UI is useful while chain data bootstraps
      return getDemoSkills();
    }
  } catch (e: any) {
    // Show demo data on network error
    return getDemoSkills();
  }
}

/**
 * Load coverages for a given skill box ID.
 * Stub — will query Explorer for Coverage boxes referencing this skill.
 */
export async function loadCoverages(skillBoxId: string): Promise<Coverage[]> {
  try {
    // TODO: Implement once Coverage Type NFT is deployed
    // Will query: R4 = COVERAGE_TYPE_ID, R5 = skillBoxId
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
            serviceId: parsed.service_id || box.boxId,
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
 * Stub — will query Explorer for Benchmark boxes referencing this skill.
 */
export async function loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
  try {
    // TODO: Implement once Benchmark Type NFT is deployed
    // Will query: R4 = BENCHMARK_TYPE_ID, R5 = skillBoxId
    const response = await fetch(
      `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ergoTreeTemplateHash: null,
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
            boxId: box.boxId,
            skillBoxId: parsed.skill_box_id || skillBoxId,
            serviceId: parsed.service_id || '',
            schemaId: parsed.schema_id || '',
            submitter: parsed.submitter || '',
            timestamp: parsed.timestamp || 0,
            results: parsed.results || [],
            passed: parsed.passed ?? false
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

// ── Demo Data ────────────────────────────────────────────────────────────────

/** Demo skills for local development and fallback when chain is unavailable. */
export function getDemoSkills(): Skill[] {
  return [
    {
      boxId: 'demo-001',
      name: 'Optimal XAU/BTC Performance',
      prose: 'Maximize risk-adjusted returns on the XAU/BTC pair using on-chain verifiable strategies. Agents must demonstrate consistent alpha generation across bull and bear regimes with transparent position tracking.',
      tags: ['trading', 'gold', 'bitcoin', 'risk-management'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-003'],
      coverages: [
        { boxId: 'cov-001', serviceId: 'svc-alpha-trader', label: 'AlphaTrader v2' },
        { boxId: 'cov-002', serviceId: 'svc-quant-ergo', label: 'QuantErgo Signals' }
      ],
      benchmarkCount: 5
    },
    {
      boxId: 'demo-002',
      name: 'Sat-sorter',
      prose: 'Sort and classify UTXOs by satoshi value for optimal fee management. Agents should minimize transaction costs while maintaining privacy guarantees through intelligent UTXO selection and consolidation.',
      tags: ['utxo', 'optimization', 'fees', 'privacy'],
      domain: 'infrastructure',
      otherSkillBoxIds: [],
      coverages: [
        { boxId: 'cov-003', serviceId: 'svc-utxo-opt', label: 'UTXOptimizer' }
      ],
      benchmarkCount: 2
    },
    {
      boxId: 'demo-003',
      name: 'On-chain Sentiment Analysis',
      prose: 'Classify community sentiment from forum discussions, social media, and on-chain governance proposals into structured signals. Must handle multi-language input and provide confidence scores with explainability.',
      tags: ['nlp', 'sentiment', 'community', 'governance'],
      domain: 'analytics',
      otherSkillBoxIds: ['demo-001', 'demo-004'],
      coverages: [],
      benchmarkCount: 1
    },
    {
      boxId: 'demo-004',
      name: 'MEV Detection & Prevention',
      prose: 'Detect and prevent miner extractable value (MEV) attacks including front-running, sandwich attacks, and transaction reordering on Ergo and EVM chains. Agents must provide real-time mempool monitoring and transaction shielding.',
      tags: ['mev', 'security', 'mempool', 'front-running'],
      domain: 'security',
      otherSkillBoxIds: ['demo-005'],
      coverages: [
        { boxId: 'cov-004', serviceId: 'svc-mev-shield', label: 'MEVShield Pro' },
        { boxId: 'cov-005', serviceId: 'svc-flashguard', label: 'FlashGuard' },
        { boxId: 'cov-006', serviceId: 'svc-dark-forest', label: 'DarkForest Monitor' }
      ],
      benchmarkCount: 7
    },
    {
      boxId: 'demo-005',
      name: 'Cross-Chain Liquidity Routing',
      prose: 'Find optimal liquidity paths across decentralized exchanges on Ergo, Ethereum, and Cardano. Agents must account for slippage, bridge fees, gas costs, and execution latency to maximize net output for multi-hop swaps.',
      tags: ['defi', 'liquidity', 'routing', 'cross-chain', 'dex'],
      domain: 'finance',
      otherSkillBoxIds: ['demo-001', 'demo-004'],
      coverages: [
        { boxId: 'cov-007', serviceId: 'svc-pathfinder', label: 'PathFinder DEX' }
      ],
      benchmarkCount: 4
    },
    {
      boxId: 'demo-006',
      name: 'Smart Contract Vulnerability Scanner',
      prose: 'Automated audit of ErgoScript and Plutus smart contracts for common vulnerability patterns: integer overflow, replay attacks, box value manipulation, and register injection. Must generate detailed reports with severity scoring and remediation steps.',
      tags: ['audit', 'ergoscript', 'vulnerability', 'smart-contracts'],
      domain: 'security',
      otherSkillBoxIds: ['demo-004'],
      coverages: [
        { boxId: 'cov-008', serviceId: 'svc-sigma-audit', label: 'SigmaAudit' },
        { boxId: 'cov-009', serviceId: 'svc-ergo-sentinel', label: 'ErgoSentinel' }
      ],
      benchmarkCount: 3
    }
  ];
}
