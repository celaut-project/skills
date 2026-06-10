/**
 * Core domain types for Celaut Skills — decentralized AI problem registry on Ergo.
 *
 * Hierarchy:
 *   Skill → Benchmark (defines HOW to measure) → Result (actual measurement)
 *          → Coverage (which services claim to solve this skill)
 */

/** A discussion entry on a benchmark or result. */
export interface DiscussionEntry {
  author: string;
  text: string;
  timestamp: number;
}

/** A Skill represents a registered AI problem/capability on-chain. */
export interface Skill {
  boxId: string;
  name: string;
  prose: string;
  tags: string[];
  domain: string;
  author: string;
  otherSkillBoxIds: string[];
  coverages: Coverage[];
  benchmarks: Benchmark[];
  resultCount: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
}

/** Payload used to create a new Skill. */
export interface SkillCreationInput {
  name: string;
  prose: string;
  tags: string[];
  domain: string;
  otherSkillBoxIds: string[];
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Reputation token supply to mint when creating the skill profile. */
  tokenAmount?: number;
  mainBox?: unknown;
}

/** A Coverage links a service (AI agent) to a Skill it can address. */
export interface Coverage {
  boxId: string;
  serviceId?: string;
  label: string;
}

/** Payload used to create a new Coverage opinion. */
export interface CoverageCreationInput {
  skillBoxId: string;
  serviceId?: string;
  label: string;
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/**
 * A Benchmark defines the structure/criteria for how results
 * are evaluated for a given skill — metrics, units, pass thresholds.
 * (Previously called BenchmarkSchema)
 */
export interface Benchmark {
  id: string;
  skillBoxId: string;
  name: string;
  description: string;
  metric: string;
  higherIsBetter: boolean;
  results: Result[];
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Discussion entries (UI-only for now) */
  discussion?: DiscussionEntry[];
}

/** Payload used to create a new Benchmark opinion. */
export interface BenchmarkCreationInput {
  skillBoxId: string;
  name: string;
  description: string;
  metric: string;
  higherIsBetter: boolean;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  discussion?: DiscussionEntry[];
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/**
 * A Result is an individual benchmark result submitted on-chain,
 * evaluating a service's performance against a Skill's Benchmark.
 * (Previously called Benchmark)
 */
export interface Result {
  id: string;
  benchmarkId: string;
  serviceId: string;
  score: number;
  notes: string;
  timestamp: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Discussion entries (UI-only for now) */
  discussion?: DiscussionEntry[];
}

/** Payload used to create a new Result opinion. */
export interface ResultCreationInput {
  benchmarkId: string;
  serviceId: string;
  score: number;
  notes: string;
  timestamp?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  discussion?: DiscussionEntry[];
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/** Result from creating an entity. */
export interface EntityWriteResult {
  txId: string;
}

/** Tab options for the main navigation. */
export type ActiveTab = 'gallery' | 'submit';

/** Error types for API operations. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class ParseError extends ApiError {
  constructor(message: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}
