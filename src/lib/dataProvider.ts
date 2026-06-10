/**
 * DataProvider interface for Celaut Skills.
 * Both the real Ergo API and the in-memory mock DB implement this interface,
 * allowing seamless swapping between demo and live modes.
 */

import type { Skill, Coverage, Benchmark, Result } from './types';

export interface DataProvider {
  /** Load all skills. */
  loadSkills(): Promise<Skill[]>;

  /** Load coverages for a given skill box ID. */
  loadCoverages(skillBoxId: string): Promise<Coverage[]>;

  /** Load benchmarks for a given skill box ID. */
  loadBenchmarks(skillBoxId: string): Promise<Benchmark[]>;

  /** Load results for a given benchmark ID. */
  loadResults(benchmarkId: string): Promise<Result[]>;
}
