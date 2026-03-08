/**
 * Core domain types for Celaut Skills — decentralized AI problem registry on Ergo.
 *
 * Hierarchy:
 *   Skill → Benchmark (defines HOW to measure) → Result (actual measurement)
 *          → Coverage (which services claim to solve this skill)
 */

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
}

/** A Coverage links a service (AI agent) to a Skill it can address. */
export interface Coverage {
  boxId: string;
  serviceId?: string;
  label: string;
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
  author: string;
  results: Result[];
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
  author: string;
  timestamp: number;
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
