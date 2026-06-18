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

/**
 * Mirrors the `Protocol` message defined in celaut.proto
 * (https://github.com/celaut-project/nodo/blob/stable/protos/celaut.proto#L70).
 *
 * Stored as JSON inside the skill payload for now (per Josemi 2026-06-16,
 * "aun en formato JSON") so a skill can advertise a set of protocols it
 * speaks without yet committing to an on-chain binary representation.
 */
export interface Protocol {
  /** Repeated string tags identifying the protocol — proto field 1. */
  tags: string[];
  /** Human-readable description — proto field 2. */
  prose: string;
  /**
   * Optional formal specification — proto field 3.
   * Bytes in the proto; carried as a base64 string here so it round-trips
   * through JSON without loss.
   */
  formal?: string;
}

/** A Skill represents a registered AI problem/capability on-chain. */
export interface Skill {
  boxId: string;
  profileId: string;
  name: string;
  prose: string;
  tags: string[];
  domain: string;
  extendedSkillBoxIds: string[];
  coverages: Coverage[];
  benchmarks: Benchmark[];
  resultCount: number;
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Set of protocols this skill speaks (celaut.proto Protocol set, JSON form). */
  protocols?: Protocol[];
}

/** Payload used to create a new Skill. */
export interface SkillCreationInput {
  name: string;
  prose: string;
  tags: string[];
  domain: string;
  extendedSkillBoxIds: string[];
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Set of protocols this skill speaks (celaut.proto Protocol set, JSON form). */
  protocols?: Protocol[];
  networks?: Protocol[];
  /** Reputation token supply to mint when creating the skill profile. */
  tokenAmount?: number;
  mainBox?: unknown;
}

/** A Coverage links a service (AI agent) to a Skill it can address. */
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
