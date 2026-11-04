import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SKILL_TYPE_ID,
  BENCHMARK_TYPE_ID,
  RESULT_TYPE_ID,
  COVERAGE_TYPE_ID,
  applySkillInheritance,
  collectExtended,
  collectExtenders,
  loadSkillTree,
  loadBenchmarkCoverages
} from './core.mjs';

const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
const id = (c) => c.repeat(64);

// ── applySkillInheritance / collectExtended (no network) ────────────────────

const skill = (boxId, extendedSkillBoxIds = [], coverages = [], benchmarks = []) => ({
  boxId,
  name: boxId,
  tags: [],
  extendedSkillBoxIds,
  coverages,
  benchmarks
});
const cov = (boxId, serviceId) => ({ boxId, serviceId, profileId: 'p' });
const bench = (id, results = []) => ({ id, name: id, results });

describe('collectExtended', () => {
  it('follows the chain, nearest first, once each, and not the skill itself', () => {
    const skills = [skill('a', ['b', 'x']), skill('b', ['c']), skill('c', ['a', 'b'])];
    expect(collectExtended(skills, 'a').map((s) => s.boxId)).toEqual(['b', 'c']);
  });
  it('is empty for an unknown skill', () => {
    expect(collectExtended([skill('a')], 'zzz')).toEqual([]);
  });
  it('collectExtenders is the other direction', () => {
    const skills = [skill('gen', ['dock']), skill('dock'), skill('other', ['dock'])];
    expect(collectExtenders(skills, 'dock').map((s) => s.boxId)).toEqual(['gen', 'other']);
  });
});

describe('applySkillInheritance', () => {
  it('gives the extender the coverages and benchmarks of the extended skill, marked', () => {
    const [gen, dock] = applySkillInheritance([
      skill('gen', ['dock'], [cov('g1', 'sg')]),
      skill('dock', [], [cov('d1', 'sd')], [bench('bd', [{ id: 'r' }])])
    ]);
    expect(gen.coverages.map((c) => [c.boxId, c.inheritedFrom])).toEqual([
      ['g1', undefined],
      ['d1', 'dock']
    ]);
    expect(gen.benchmarks.map((b) => [b.id, b.inheritedFrom])).toEqual([['bd', 'dock']]);
    expect(gen.resultCount).toBe(1);
    // The extended skill gets nothing from the extender.
    expect(dock.coverages.map((c) => c.boxId)).toEqual(['d1']);
  });

  it('keeps the owner through a chain', () => {
    const [a] = applySkillInheritance([
      skill('a', ['b']),
      skill('b', ['c']),
      skill('c', [], [cov('c1', 'sc')])
    ]);
    expect(a.coverages).toEqual([{ ...cov('c1', 'sc'), inheritedFrom: 'c' }]);
  });

  it('survives a cycle and is idempotent', () => {
    const input = [skill('a', ['b'], [cov('a1')]), skill('b', ['a'], [cov('b1')])];
    const once = applySkillInheritance(input);
    expect(once[0].coverages.map((c) => c.boxId).sort()).toEqual(['a1', 'b1']);
    expect(applySkillInheritance(once)[0].coverages.map((c) => c.boxId).sort()).toEqual(['a1', 'b1']);
  });
});

// ── loadSkillTree against a fake Explorer ───────────────────────────────────

const GEN = id('a');
const DOCK = id('b');
const BENCH_D = id('c');
const SVC_D = id('1');
const SVC_RUN = id('2');

const box = (boxId, r9) => ({
  boxId,
  assets: [{ tokenId: id('e') }],
  additionalRegisters: { R9: { renderedValue: hex(JSON.stringify(r9)) } }
});

/** boxes by `${R4}|${R5 or ''}` */
const REGISTRY = {
  [`${SKILL_TYPE_ID}|`]: [
    box(GEN, { name: 'general', extended_skill_boxes: [DOCK] }),
    box(DOCK, { name: 'dockerfile', extended_skill_boxes: [] })
  ],
  [`${COVERAGE_TYPE_ID}|${DOCK}`]: [box('cov-d', { service_id: SVC_D })],
  [`${BENCHMARK_TYPE_ID}|${DOCK}`]: [box(BENCH_D, { name: 'refs' })],
  [`${RESULT_TYPE_ID}|${BENCH_D}`]: [box('res-d', { service_id: SVC_D, data: [] })],
  // A service that RUNS the benchmark.
  [`${COVERAGE_TYPE_ID}|${BENCH_D}`]: [box('cov-run', { service_id: SVC_RUN, benchmark_id: BENCH_D })]
};

function fakeExplorer() {
  const fetchMock = vi.fn(async (_url, init) => {
    const { registers } = JSON.parse(init.body);
    const items = REGISTRY[`${registers.R4}|${registers.R5 ?? ''}`] ?? [];
    return { ok: true, json: async () => ({ items }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('loadSkillTree', () => {
  it('shows the services of the extended skills under the extender', async () => {
    fakeExplorer();
    const tree = await loadSkillTree(GEN, 'http://explorer');
    expect(tree.skill.name).toBe('general');
    expect(tree.extends).toEqual([{ boxId: DOCK, name: 'dockerfile' }]);
    expect(tree.extendedBy).toEqual([]);
    // The service solves the specific skill and, by extension, the general one.
    expect(tree.coverages.map((c) => [c.serviceId, c.inheritedFrom])).toEqual([[SVC_D, DOCK]]);
    expect(tree.benchmarks.map((b) => [b.id, b.inheritedFrom])).toEqual([[BENCH_D, DOCK]]);
    expect(tree.benchmarks[0].results).toHaveLength(1);
  });

  it('keeps the runners of a benchmark apart from the solutions of the skill', async () => {
    fakeExplorer();
    const tree = await loadSkillTree(DOCK, 'http://explorer');
    expect(tree.coverages.map((c) => c.serviceId)).toEqual([SVC_D]);
    expect(tree.benchmarks[0].coverages.map((c) => [c.serviceId, c.benchmarkId])).toEqual([[SVC_RUN, BENCH_D]]);
    expect(tree.extendedBy).toEqual([{ boxId: GEN, name: 'general' }]);
  });

  it('inherit: false is only what the skill has', async () => {
    fakeExplorer();
    const tree = await loadSkillTree(GEN, 'http://explorer', { inherit: false });
    expect(tree.coverages).toEqual([]);
    expect(tree.benchmarks).toEqual([]);
    expect(tree.extends).toEqual([]);
  });

  it('loadBenchmarkCoverages gives the runners', async () => {
    fakeExplorer();
    const runners = await loadBenchmarkCoverages(BENCH_D, 'http://explorer');
    expect(runners.map((c) => c.serviceId)).toEqual([SVC_RUN]);
  });
});
