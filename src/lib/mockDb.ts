/**
 * In-memory mock database for demo mode.
 * Mirrors the Ergo API functions with local data.
 * Pre-populated with getDemoSkills() data.
 */

import type { DataProvider } from './dataProvider';
import type { Skill, Coverage, Result } from './types';
import { getDemoSkills } from './api';

class MockDatabase implements DataProvider {
  private skills: Skill[];

  constructor() {
    this.skills = getDemoSkills();
  }

  async loadSkills(): Promise<Skill[]> {
    // Return a deep copy to prevent mutation
    return JSON.parse(JSON.stringify(this.skills));
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    const skill = this.skills.find(s => s.boxId === skillBoxId);
    if (!skill) return [];
    return JSON.parse(JSON.stringify(skill.coverages));
  }

  async loadResults(benchmarkId: string): Promise<Result[]> {
    for (const skill of this.skills) {
      for (const bench of skill.benchmarks) {
        if (bench.id === benchmarkId) {
          return JSON.parse(JSON.stringify(bench.results));
        }
      }
    }
    return [];
  }

  /** Reset the database to initial demo data. */
  reset(): void {
    this.skills = getDemoSkills();
  }
}

/** Singleton mock database instance. */
export const mockDb = new MockDatabase();
