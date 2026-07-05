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
  formal: string;
  tags: string[];
  domain: string;
  extendedSkillBoxIds: string[];
  coverages: Coverage[];
  benchmarks: Benchmark[];
  resultCount: number;
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /**
   * Block height at which the skill box was created. Used to canonically order
   * a skill pair (newer vs older) when building a relationship topic id, so the
   * same pair always resolves to the same `{skill_nueva}_{skill_antigua}` topic
   * regardless of which side you open the discussion from.
   */
  creationHeight?: number;
}

/** Payload used to create a new Skill. */
export interface SkillCreationInput {
  name: string;
  prose: string;
  formal: string;
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
  /**
   * When set, this coverage targets a Benchmark instead of the skill directly —
   * a suggestion that the named service tests the skill following that
   * benchmark's specification. Absent for plain skill-level coverages.
   */
  benchmarkId?: string;
  reputation?: number;
}

/** Payload used to create a new Coverage opinion. */
export interface CoverageCreationInput {
  skillBoxId: string;
  /**
   * Target benchmark id. When provided, the coverage points at the benchmark
   * (object pointer = benchmarkId) rather than the skill box.
   */
  benchmarkId?: string;
  serviceId?: string;
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

export interface Descriptor {
  name: string;
  description: string;
}

export interface PerformanceMetric {
  name: string;
  description: string;
  higherIsBetter: boolean;
}

export interface CaseExecutionData {
  /** Numerical values corresponding positionally to the Benchmark's caseDescriptors */
  caseMeta: number[];
  /** Numerical measurements corresponding positionally to the Benchmark's performanceMetrics */
  metricsValues: number[];
}

/**
 * A Benchmark defines the structure/criteria for how results
 * are evaluated for a given skill — metrics, units, pass thresholds.
 */
/*
Type NFT definition:
A structured specification of an evaluation space designed to analyze computational solutions against a problem domain. It defines the structural parameters used to describe problem cases alongside the directional performance metrics used to quantify execution outcomes, constituting the blueprint of the performance tensor.
*/
export interface Benchmark {
  id: string;
  profileId: string;
  skillBoxId: string;
  name: string;
  description: string;
  caseDescriptors: Descriptor[];
  performanceMetrics: PerformanceMetric[];
  results: Result[];
  /**
   * Coverages that target this benchmark — services suggested to test the
   * skill following this benchmark's spec. Loaded lazily; defaults to [].
   */
  coverages?: Coverage[];
  reputation?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
}

/** Payload used to create a new Benchmark opinion. */
export interface BenchmarkCreationInput {
  skillBoxId: string;
  name: string;
  description: string;
  caseDescriptors: Descriptor[];
  performanceMetrics: PerformanceMetric[];
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  mainBox?: unknown;
}

/**
 * A Result is an individual benchmark result submitted on-chain,
 * evaluating a service's performance against a Skill's Benchmark.
 */
/*
Type NFT definition:
An empirical data payload recording the performance profile of a single computational service across an evaluation space. It populates the performance tensor by binding the service identity to a collection of specific problem cases and their corresponding quantitative execution metrics.
*/
export interface Result {
  id: string;
  profileId: string;
  benchmarkId: string;
  serviceId: string;
  data: CaseExecutionData[];
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
  data: CaseExecutionData[];
  notes: string;
  timestamp?: number;
  /** Blake2b256 hash of off-chain source file */
  sourceHash?: string;
  /** Reputation token amount to allocate to the opinion. */
  tokenAmount?: number;
  /** Optional main box used for live on-chain writes. */
  mainBox?: unknown;
}

/**
 * Service info (metadata + data) — on-chain fragments of a service's celaut
 * specification, keyed by service id (R5), so the UI can show basic info without
 * downloading the full service.
 *
 * Type NFT definitions:
 *  - `celaut:service-data:v1`     → the functional spec: architecture / api / network.
 *  - `celaut:service-metadata:v1` → descriptive metadata: name / description / tags.
 *
 * R9 encoding is one of two modes (see `parseServiceInfoR9`):
 *  - `inline` — R9 is a JSON spec fragment carried directly on-chain.
 *  - `source` — R9 is a bare blake2b256 hash; the full fragment lives off-chain
 *    in `sources` and is resolved via the source-application registry.
 */
export type ServiceInfoMode = 'inline' | 'source';

/** One API slot of a service (a port + its transport/protocol stack). */
export interface ServiceApiSlot {
  port?: number;
  transport?: string[];
  protocol?: string[];
  [key: string]: unknown;
}

/**
 * `celaut:service-data:v1` — the functional spec fragment. R9 is a JSON object
 * that may hold `container`, `api` and `network` (each with their own sub-fields),
 * or a blake2b hash (source mode). Fields are kept as-published; `architecture` is
 * derived from `container` for convenience/filtering.
 */
export interface ServiceData {
  boxId: string;
  profileId: string;
  serviceId: string;
  mode: ServiceInfoMode;
  /** Set in `source` mode: blake2b256 hash to resolve from sources. */
  sourceHash?: string;
  /** The full inline R9 object (empty in source mode). */
  content?: Record<string, unknown>;
  /** celaut `container` block (architecture, filesystem, entrypoint, …). */
  container?: Record<string, unknown>;
  /** celaut `api` — port/transport/protocol slots (shape as-published). */
  api?: ServiceApiSlot[] | unknown;
  /** celaut `network` — network requirements/tags (shape as-published). */
  network?: unknown;
  /** Convenience: architecture string derived from `container`. */
  architecture?: string;
  reputation?: number;
}

/**
 * `celaut:service-metadata:v1` — ARBITRARY descriptive JSON about a service (or a
 * blake2b hash in source mode). The whole object is kept in `content`, with a few
 * common fields surfaced when present.
 */
export interface ServiceMetadata {
  boxId: string;
  profileId: string;
  serviceId: string;
  mode: ServiceInfoMode;
  /** Set in `source` mode: blake2b256 hash to resolve from sources. */
  sourceHash?: string;
  /** The full inline R9 object (empty in source mode). */
  content?: Record<string, unknown>;
  name?: string;
  description?: string;
  tags?: string[];
  reputation?: number;
}

/** Payload used to create a Service Data / Service Metadata opinion. */
export interface ServiceInfoCreationInput {
  /** Service id (content hash) the info is about — becomes R5. */
  serviceId: string;
  /**
   * R9 payload: either an inline spec fragment (object) or a blake2b256 hash
   * string pointing at the content in `sources`.
   */
  content: Record<string, unknown> | string;
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
