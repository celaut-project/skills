/**
 * Real Ergo Explorer API data provider.
 * Wraps the existing API functions into the DataProvider interface.
 */

import type { DataProvider } from './dataProvider';
import type { Skill, Coverage, Benchmark, Result } from './types';
import { loadSkills as apiLoadSkills, loadCoverages as apiLoadCoverages, loadBenchmarks as apiLoadBenchmarks, loadResults as apiLoadResults } from './api';

class ErgoDataProvider implements DataProvider {
  async loadSkills(): Promise<Skill[]> {
    return apiLoadSkills();
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    return apiLoadCoverages(skillBoxId);
  }

  async loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
    return apiLoadBenchmarks(skillBoxId);
  }

  async loadResults(benchmarkId: string): Promise<Result[]> {
    return apiLoadResults(benchmarkId);
  }
}

/** Singleton Ergo data provider instance. */
export const ergoProvider = new ErgoDataProvider();
