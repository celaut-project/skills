/**
 * In-memory mock database for demo mode.
 * Mirrors the Ergo API functions with local data.
 * Pre-populated with getDemoSkills() data.
 */

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
import { getDemoSkills } from './api';

class MockDatabase implements DataProvider {
  private skills: Skill[];
  private writeCounter = 0;

  constructor() {
    this.skills = getDemoSkills();
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private createId(prefix: string): string {
    this.writeCounter += 1;
    const entropy = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}-${entropy}-${this.writeCounter}`;
  }

  private createTxId(kind: string): string {
    return `demo-${kind}-${Date.now().toString(36)}-${this.writeCounter}`;
  }

  private syncSkillCounters(skill: Skill): void {
    skill.resultCount = skill.benchmarks.reduce((sum, benchmark) => sum + benchmark.results.length, 0);
  }

  private findSkill(boxId: string): Skill | undefined {
    return this.skills.find((skill) => skill.boxId === boxId);
  }

  private findBenchmark(benchmarkId: string): { skill: Skill; benchmark: Benchmark } | undefined {
    for (const skill of this.skills) {
      const benchmark = skill.benchmarks.find((item) => item.id === benchmarkId);
      if (benchmark) {
        return { skill, benchmark };
      }
    }
    return undefined;
  }

  async loadSkills(): Promise<Skill[]> {
    // Return a deep copy to prevent mutation
    return this.clone(this.skills);
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    const skill = this.skills.find(s => s.boxId === skillBoxId);
    if (!skill) return [];
    return this.clone(skill.coverages);
  }

  async loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
    const skill = this.skills.find(s => s.boxId === skillBoxId);
    if (!skill) return [];
    return this.clone(skill.benchmarks);
  }

  async loadResults(benchmarkId: string): Promise<Result[]> {
    for (const skill of this.skills) {
      for (const bench of skill.benchmarks) {
        if (bench.id === benchmarkId) {
          return this.clone(bench.results);
        }
      }
    }
    return [];
  }

  async createSkill(input: SkillCreationInput): Promise<string> {
    const boxId = this.createId('skill');
    const skill: Skill = {
      boxId,
      name: input.name,
      prose: input.prose,
      tags: [...input.tags],
      domain: input.domain,
      otherSkillBoxIds: [...input.otherSkillBoxIds],
      coverages: [],
      benchmarks: [],
      resultCount: 0,
      sourceHash: input.sourceHash
    };

    this.skills.push(skill);
    return this.createTxId('skill');
  }

  async createCoverage(input: CoverageCreationInput): Promise<string> {
    const skill = this.findSkill(input.skillBoxId);
    if (!skill) {
      throw new Error(`Skill ${input.skillBoxId} not found.`);
    }

    skill.coverages.push({
      boxId: this.createId('cov'),
      serviceId: input.serviceId,
      label: input.label
    });

    return this.createTxId('coverage');
  }

  async createBenchmark(input: BenchmarkCreationInput): Promise<string> {
    const skill = this.findSkill(input.skillBoxId);
    if (!skill) {
      throw new Error(`Skill ${input.skillBoxId} not found.`);
    }

    skill.benchmarks.push({
      id: this.createId('bench'),
      skillBoxId: input.skillBoxId,
      name: input.name,
      description: input.description,
      metric: input.metric,
      higherIsBetter: input.higherIsBetter,
      results: [],
      sourceHash: input.sourceHash
    });

    this.syncSkillCounters(skill);
    return this.createTxId('benchmark');
  }

  async createResult(input: ResultCreationInput): Promise<string> {
    const match = this.findBenchmark(input.benchmarkId);
    if (!match) {
      throw new Error(`Benchmark ${input.benchmarkId} not found.`);
    }

    match.benchmark.results.push({
      id: this.createId('res'),
      benchmarkId: input.benchmarkId,
      serviceId: input.serviceId,
      score: input.score,
      notes: input.notes,
      timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
      sourceHash: input.sourceHash
    });

    this.syncSkillCounters(match.skill);
    return this.createTxId('result');
  }

  /** Reset the database to initial demo data. */
  reset(): void {
    this.skills = getDemoSkills();
  }
}

/** Singleton mock database instance. */
export const mockDb = new MockDatabase();
