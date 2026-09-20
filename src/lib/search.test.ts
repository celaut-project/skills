import { describe, it, expect, beforeEach } from 'vitest';
import { buildSearchIndex, searchSkills } from './search';
import type { Skill } from './types';

const skill = (over: Partial<Skill> = {}): Skill => ({
  boxId: over.boxId ?? 'box',
  profileId: 'p',
  name: 'Unnamed Skill',
  prose: '',
  formal: '',
  tags: [],
  domain: '',
  extendedSkillBoxIds: [],
  coverages: [],
  benchmarks: [],
  resultCount: 0,
  ...over
});

const CATALOG: Skill[] = [
  skill({
    boxId: 'sat',
    name: 'Boolean Satisfiability Problem Solver',
    prose: 'Solves boolean satisfiability instances using CDCL search.',
    tags: ['sat', 'computation', 'ai'],
    domain: 'SAT'
  }),
  skill({
    boxId: 'summarize',
    name: 'Markdown Summarization',
    prose: 'Summarizes long markdown documents into a short digest.',
    tags: ['summarization', 'markdown', 'nlp'],
    domain: 'nlp'
  }),
  skill({
    boxId: 'ergo-addr',
    name: 'Ergo Address Validation',
    prose: 'Validates that a string is a well-formed Ergo address.',
    tags: ['ergo', 'validation', 'address'],
    domain: 'blockchain'
  })
];

describe('search', () => {
  beforeEach(() => {
    buildSearchIndex(CATALOG);
  });

  it('returns every skill for an empty or blank query', () => {
    expect(searchSkills('')).toEqual(CATALOG);
    expect(searchSkills('   ')).toEqual(CATALOG);
  });

  it('requires every term to match, even across different fields', () => {
    // "boolean" is in the SAT skill's name, "cdcl" only in its prose — the old
    // substring filter could not satisfy both from a single field.
    const results = searchSkills('boolean cdcl');
    expect(results.map((s) => s.boxId)).toEqual(['sat']);
  });

  it('does not match when terms are satisfied by unrelated skills only', () => {
    // "markdown" only in the summarization skill, "ergo" only in the address one.
    expect(searchSkills('markdown ergo')).toEqual([]);
  });

  it('matches a prefix of a word before it is fully typed', () => {
    const results = searchSkills('satisfi');
    expect(results.map((s) => s.boxId)).toContain('sat');
  });

  it('tolerates a minor typo via MiniSearch fuzzy matching (tier 1)', () => {
    const results = searchSkills('markdow summary');
    expect(results.map((s) => s.boxId)).toContain('summarize');
  });

  it('falls back to Fuse.js when MiniSearch finds nothing', () => {
    // Badly mangled query: MiniSearch's per-token fuzzy (edit distance ~0.2 of
    // token length) will not bridge this, but Fuse's whole-string approximate
    // match against "Ergo Address Validation" should.
    const results = searchSkills('ergo adress validaton');
    expect(results.map((s) => s.boxId)).toContain('ergo-addr');
  });

  it('indexes each tag individually rather than as one joined string', () => {
    const results = searchSkills('nlp');
    expect(results.map((s) => s.boxId)).toEqual(['summarize']);
  });

  it('rebuilds cleanly when the catalog changes', () => {
    const smaller = CATALOG.slice(0, 1);
    buildSearchIndex(smaller);
    expect(searchSkills('')).toEqual(smaller);
    expect(searchSkills('markdown')).toEqual([]);
  });
});
