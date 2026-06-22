/**
 * Data access facade for Celaut Skills.
 * Routes calls to mock DB or real Ergo API based on demo mode setting.
 */

import { get } from 'svelte/store';
import { demoMode } from './config';
import { mockDb } from './mockDb';
import { ergoProvider } from './ergoProvider';
import type { DataProvider } from './dataProvider';
import type {
  Skill,
  Coverage,
  Benchmark,
  Result,
  SkillCreationInput,
  CoverageCreationInput,
  BenchmarkCreationInput,
  ResultCreationInput
} from './types';

/** Get the currently active data provider based on demo mode. */
function getProvider(): DataProvider {
  return get(demoMode) ? mockDb : ergoProvider;
}

/** Load all skills from the active provider. */
export async function loadSkills(): Promise<Skill[]> {
  return getProvider().loadSkills();
}

/** Load coverages for a given skill box ID. */
export async function loadCoverages(skillBoxId: string): Promise<Coverage[]> {
  return getProvider().loadCoverages(skillBoxId);
}

/** Load coverages that target a given benchmark ID. */
export async function loadBenchmarkCoverages(benchmarkId: string): Promise<Coverage[]> {
  return getProvider().loadBenchmarkCoverages(benchmarkId);
}

/** Load benchmarks for a given skill box ID. */
export async function loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
  return getProvider().loadBenchmarks(skillBoxId);
}

/** Load results for a given benchmark ID. */
export async function loadResults(benchmarkId: string): Promise<Result[]> {
  return getProvider().loadResults(benchmarkId);
}

/** Create a new skill profile. */
export async function createSkill(input: SkillCreationInput): Promise<string> {
  return getProvider().createSkill(input);
}

/** Create a new coverage opinion. */
export async function createCoverage(input: CoverageCreationInput): Promise<string> {
  return getProvider().createCoverage(input);
}

/** Create a new benchmark opinion. */
export async function createBenchmark(input: BenchmarkCreationInput): Promise<string> {
  return getProvider().createBenchmark(input);
}

/** Create a new result opinion. */
export async function createResult(input: ResultCreationInput): Promise<string> {
  return getProvider().createResult(input);
}
