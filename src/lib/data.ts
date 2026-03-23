/**
 * Data access facade for Celaut Skills.
 * Routes calls to mock DB or real Ergo API based on demo mode setting.
 */

import { get } from 'svelte/store';
import { demoMode } from './config';
import { mockDb } from './mockDb';
import { ergoProvider } from './ergoProvider';
import type { DataProvider } from './dataProvider';
import type { Skill, Coverage, Result } from './types';

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

/** Load results for a given benchmark ID. */
export async function loadResults(benchmarkId: string): Promise<Result[]> {
  return getProvider().loadResults(benchmarkId);
}
