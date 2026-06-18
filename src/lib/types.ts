/**
 * Core domain types for Celaut Skills — decentralized AI problem registry on Ergo.
 *
 * Hierarchy:
 *   Skill → Benchmark (defines HOW to measure) → Result (actual measurement)
 *          → Coverage (which services claim to solve this skill)
 *
 * Note (per Josemi 2026-06-10):
 *  - Entities do NOT carry an `author` property. The author of every element
 *    is its `profile_id` — the token_id of the reputation proof that signed it,
 *    derivable from the on-chain box. UI should resolve it via the reputation
 *    library when display is needed.
 *  - Entities do NOT carry an inline `discussion` array. Comments are rendered
 *    by the `<Forum topic_id={...}>` component using the entity's own id.
 */

/** A Skill represents a registered AI problem/capability on-chain. */
/*
Type NFT definition:
An objective declaration of a computational problem or target task. It acts as an abstract capability marker that isolates the structural definition of the problem itself, maintaining absolute independence from any specific execution logic, implementation strategies, communication interfaces, or application-layer protocols.
*/
export interface Skill {
  boxId: string;
  profileId: string;
  name: string;
  prose: string;
  formal: string;  // TODO Agregar formal al resto. La especificación formal de la habilidad, en un lenguaje formal (ej. TLA+, Alloy, etc.) o un DSL específico de cualquiera.
  tags: string[];
  domain: string;
  extendedSkillBoxIds: string[];
  coverages: Coverage[];
  benchmarks: Benchmark[];
  resultCount: number;
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
}

/** Payload used to create a new Skill. */
export interface SkillCreationInput {
  name: string;
  prose: string;
  formal: string;  // TODO Agregar formal al resto.
  tags: string[];
  domain: string;
  extendedSkillBoxIds: string[];
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Reputation token supply to mint when creating the skill profile. */
  tokenAmount?: number;
  mainBox?: unknown;
}

/** A Coverage links a service (AI agent) to a Skill it can address. */
/*
Type NFT definition:
An explicit assertion declaring that a specific computational service is capable of addressing a designated computational problem. It establishes a referential linkage between a service identifier and a target abstract capability, serving as an unverified claim of functionality.
*/
export interface Coverage {
  boxId: string;
  profileId: string;
  serviceId?: string;
  reputation?: number;
}

/** Payload used to create a new Coverage opinion. */
export interface CoverageCreationInput {
  skillBoxId: string;
  serviceId?: string;
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/**
 * A Benchmark defines the structure/criteria for how results
 * are evaluated for a given skill — metrics, units, pass thresholds.
 */
export interface Benchmark {
  id: string;
  profileId: string;
  skillBoxId: string;
  name: string;
  description: string;
  metric: string;
  higherIsBetter: boolean;
  results: Result[];
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
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
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/**
 * A Result is an individual benchmark result submitted on-chain,
 * evaluating a service's performance against a Skill's Benchmark.
 */
export interface Result {
  id: string;
  profileId: string;
  benchmarkId: string;
  serviceId: string;
  score: number;
  notes: string;
  timestamp: number;
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
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
export type ActiveTab = 'gallery' | 'submit' | 'profile';

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
