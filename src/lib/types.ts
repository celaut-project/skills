/**
 * Core domain types for Celaut Skills — decentralized AI problem registry on Ergo.
 */

/** A Skill represents a registered AI problem/capability on-chain. */
export interface Skill {
  boxId: string;
  name: string;
  prose: string;
  tags: string[];
  domain: string;
  otherSkillBoxIds: string[];
  coverages: Coverage[];
  benchmarkCount: number;
}

/** A Coverage links a service (AI agent) to a Skill it can address. */
export interface Coverage {
  boxId: string;
  serviceId: string;
  label: string;
}

/**
 * BenchmarkSchema defines the structure/schema for how benchmarks
 * are evaluated for a given skill — metrics, units, pass thresholds.
 */
export interface BenchmarkSchema {
  schemaId: string;
  skillBoxId: string;
  name: string;
  description: string;
  metrics: BenchmarkMetric[];
  version: number;
}

/** A single metric definition within a BenchmarkSchema. */
export interface BenchmarkMetric {
  key: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  passThreshold?: number;
}

/**
 * A Benchmark is an individual benchmark result submitted on-chain,
 * evaluating a service's performance against a Skill's BenchmarkSchema.
 */
export interface Benchmark {
  boxId: string;
  skillBoxId: string;
  serviceId: string;
  schemaId: string;
  submitter: string;
  timestamp: number;
  results: BenchmarkResult[];
  passed: boolean;
}

/** A single metric result within a Benchmark submission. */
export interface BenchmarkResult {
  metricKey: string;
  value: number;
  passed: boolean;
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
