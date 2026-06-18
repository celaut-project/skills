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
import { applySkillInheritance, getDemoSkills } from './api';

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


  private getProfileId(mainBox: unknown): string {
    const profileId = (mainBox as { token_id?: string } | undefined)?.token_id;
    return profileId || this.createId('profile');
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
    return applySkillInheritance(this.clone(this.skills));
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    const skill = applySkillInheritance(this.clone(this.skills)).find(s => s.boxId === skillBoxId);
    if (!skill) return [];
    return this.clone(skill.coverages);
  }

  async loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
    const skill = applySkillInheritance(this.clone(this.skills)).find(s => s.boxId === skillBoxId);
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
    const profileId = this.getProfileId(input.mainBox);
    const skill: Skill = {
      boxId,
      profileId,
      name: input.name,
      prose: input.prose,
      formal: input.formal ?? '',
      tags: [...input.tags],
      domain: input.domain,
      extendedSkillBoxIds: [...input.extendedSkillBoxIds],
      coverages: [],
      benchmarks: [],
      resultCount: 0,
      reputation: 0,
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

    const profileId = this.getProfileId(input.mainBox);
    skill.coverages.push({
      boxId: this.createId('cov'),
      profileId,
      serviceId: input.serviceId,
      reputation: 0
    });

    return this.createTxId('coverage');
  }

  async createBenchmark(input: BenchmarkCreationInput): Promise<string> {
    const skill = this.findSkill(input.skillBoxId);
    if (!skill) {
      throw new Error(`Skill ${input.skillBoxId} not found.`);
    }

    const profileId = this.getProfileId(input.mainBox);
    skill.benchmarks.push({
      id: this.createId('bench'),
      profileId,
      skillBoxId: input.skillBoxId,
      name: input.name,
      description: input.description,
      caseDescriptors: [...(input.caseDescriptors ?? [])],
      performanceMetrics: [...(input.performanceMetrics ?? [])],
      results: [],
      reputation: 0,
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

    const profileId = this.getProfileId(input.mainBox);
    match.benchmark.results.push({
      id: this.createId('res'),
      profileId,
      benchmarkId: input.benchmarkId,
      serviceId: input.serviceId,
      data: input.data.map((c) => ({
        caseMeta: [...c.caseMeta],
        metricsValues: [...c.metricsValues]
      })),
      notes: input.notes,
      timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
      sourceHash: input.sourceHash,
      reputation: 0
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
