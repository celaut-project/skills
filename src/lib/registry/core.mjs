// @ts-nocheck — plain-ESM runtime module shared by the Vite app and the Node
// MCP server; it mirrors the shapes documented in src/lib/types, but is not
// itself TypeScript-checked (it must run untranspiled under bare Node).
/**
 * Celaut Skills registry — framework-agnostic data core.
 *
 * This is the SINGLE source of truth for the on-chain registry's read layer:
 * the Type NFT ids, the Explorer box search, the R9 parsers, and the `load_*`
 * functions. It is plain ESM with no Svelte/Vite/`reputation-system`
 * dependency, so it loads unchanged in three places:
 *
 *   - the Vite web app  (`src/lib/api.ts` re-exports the Type NFT ids here)
 *   - the MCP server     (`mcp/server.mjs` is a thin wrapper over `load_*`)
 *   - any plain Node script
 *
 * Keeping the logic here means the MCP server no longer re-implements (and
 * drifts from) what the app already knows. The only thing the app does NOT
 * share is the transport: in the browser it uses `reputation-system`'s
 * `searchBoxes`; here we inline the equivalent register search using
 * `@fleet-sdk/serializer` (a transitive dependency) so it runs under Node too.
 */
import { SColl, SByte } from '@fleet-sdk/serializer';

// ── Type NFT ids (single source of truth) ──────────────────────────────────
export const SKILL_TYPE_ID = 'ffce59c01b9c0c245005f9c2daf817607e912a3ececd5f61aaba48d30230f60c';
export const BENCHMARK_TYPE_ID = 'f6480184daf3b7750a58e58319e12adc5266bd986eec0f57ac451c995a30f54d';
export const RESULT_TYPE_ID = '49b26dc06b1680769477264d2e8e9bf561005236cde3097630bffcff631b7aef';
export const COVERAGE_TYPE_ID = '1da6799e935cbb0fb14d359f06f23854c3d1bd509508948cc01b7b018dbbbdf5';

export const DEFAULT_EXPLORER_API =
  (typeof process !== 'undefined' && process.env && process.env.CELAUT_EXPLORER_API) ||
  'https://api.ergoplatform.com';

const LIMIT_PER_PAGE = 100;

export const isHexId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{4,}$/.test(v);

function hexToBytes(hex) {
  if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Strip the SColl[SByte] tag prefix to match the Explorer's renderedValue. */
function serializedToRendered(serialized) {
  if (serialized.startsWith('0e')) return serialized.substring(4);
  if (serialized.startsWith('04')) return serialized.substring(2);
  return serialized;
}

/**
 * Async-generator over unspent boxes matching a Type NFT (R4) and an optional
 * object pointer (R5), paging the Explorer's `/boxes/unspent/search` endpoint.
 */
export async function* searchBoxes(explorerUri, typeNftId, objectPointer, limit) {
  const registers = {};
  if (typeNftId) {
    registers.R4 = serializedToRendered(SColl(SByte, hexToBytes(typeNftId)).toHex());
  }
  if (objectPointer) {
    registers.R5 = serializedToRendered(SColl(SByte, hexToBytes(objectPointer)).toHex());
  }
  let offset = 0;
  let total = 0;
  while (true) {
    if (limit !== undefined && total >= limit) break;
    const fetchLimit =
      limit !== undefined ? Math.min(LIMIT_PER_PAGE, limit - total) : LIMIT_PER_PAGE;
    const url = `${explorerUri}/api/v1/boxes/unspent/search?offset=${offset}&limit=${fetchLimit}`;
    const body = { ergoTreeTemplateHash: undefined, registers, assets: [] };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return;
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    if (items.length === 0) return;
    yield items;
    total += items.length;
    offset += items.length;
    if (items.length < fetchLimit) return;
  }
}

export async function collectBoxes(typeNftId, objectPointer, limit = 100, explorerUri = DEFAULT_EXPLORER_API) {
  const all = [];
  for await (const batch of searchBoxes(explorerUri, typeNftId, objectPointer, limit)) {
    all.push(...batch);
  }
  return all;
}

export function parseR9(box) {
  try {
    const r9 = box?.additionalRegisters?.R9?.renderedValue || '';
    return r9 ? JSON.parse(r9) : {};
  } catch {
    return {};
  }
}

export function deriveProfileId(box, parsed) {
  return (
    parsed.profile_id ||
    parsed.profileId ||
    box?.assets?.[0]?.tokenId ||
    box?.boxId ||
    ''
  );
}

// ── load_* (mirror src/lib/types shapes) ────────────────────────────────────

export async function loadSkills(explorerUri = DEFAULT_EXPLORER_API) {
  if (!isHexId(SKILL_TYPE_ID)) return [];
  const boxes = await collectBoxes(SKILL_TYPE_ID, undefined, 100, explorerUri);
  return boxes.map((box) => {
    const parsed = parseR9(box);
    return {
      boxId: box.boxId,
      profileId: deriveProfileId(box, parsed),
      name: parsed.name || 'Unnamed Skill',
      prose: parsed.prose || '',
      formal: parsed.formal || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      domain: parsed.domain || '',
      extendedSkillBoxIds: Array.isArray(parsed.extended_skill_boxes) ? parsed.extended_skill_boxes : [],
      sourceHash: parsed.source_hash
    };
  });
}

function parseCoverageBox(box) {
  const parsed = parseR9(box);
  return {
    boxId: box.boxId,
    profileId: deriveProfileId(box, parsed),
    serviceId: parsed.service_id || undefined
  };
}

export async function loadBenchmarks(skillBoxId, explorerUri = DEFAULT_EXPLORER_API) {
  if (!isHexId(BENCHMARK_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(BENCHMARK_TYPE_ID, skillBoxId, 100, explorerUri);
  return boxes.map((box) => {
    const parsed = parseR9(box);
    return {
      id: box.boxId,
      profileId: deriveProfileId(box, parsed),
      skillBoxId,
      name: parsed.name || 'Unnamed Benchmark',
      description: parsed.description || '',
      caseDescriptors: Array.isArray(parsed.case_descriptors) ? parsed.case_descriptors : [],
      performanceMetrics: Array.isArray(parsed.performance_metrics) ? parsed.performance_metrics : [],
      sourceHash: parsed.source_hash
    };
  });
}

export async function loadResults(benchmarkId, explorerUri = DEFAULT_EXPLORER_API) {
  if (!isHexId(RESULT_TYPE_ID) || !isHexId(benchmarkId)) return [];
  const boxes = await collectBoxes(RESULT_TYPE_ID, benchmarkId, 100, explorerUri);
  return boxes.map((box) => {
    const parsed = parseR9(box);
    const rawCases = Array.isArray(parsed.data) ? parsed.data : [];
    return {
      id: box.boxId,
      profileId: deriveProfileId(box, parsed),
      benchmarkId,
      serviceId: parsed.service_id || '',
      data: rawCases.map((c) => ({
        caseMeta: Array.isArray(c?.case_meta) ? c.case_meta.map(Number) : [],
        metricsValues: Array.isArray(c?.metrics_values) ? c.metrics_values.map(Number) : []
      })),
      notes: parsed.notes || '',
      timestamp: parsed.timestamp || 0,
      sourceHash: parsed.source_hash
    };
  });
}

/**
 * Coverages for a skill — direct Coverage boxes PLUS service ids that
 * indirectly cover the skill via Results (results → benchmarks → skill).
 * Deduped by serviceId; direct coverages take precedence. Mirrors the
 * `loadCoverages` semantics in `src/lib/api.ts`.
 */
export async function loadCoverages(skillBoxId, explorerUri = DEFAULT_EXPLORER_API) {
  if (!isHexId(COVERAGE_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(COVERAGE_TYPE_ID, skillBoxId, 100, explorerUri);
  const direct = boxes.map(parseCoverageBox);

  const benchmarks = await loadBenchmarks(skillBoxId, explorerUri);
  const resultLists = await Promise.all(benchmarks.map((b) => loadResults(b.id, explorerUri)));
  const results = resultLists.flat();

  const seen = new Set();
  const merged = [];
  for (const coverage of direct) {
    if (coverage.serviceId) {
      if (seen.has(coverage.serviceId)) continue;
      seen.add(coverage.serviceId);
    }
    merged.push(coverage);
  }
  for (const result of results) {
    const serviceId = result.serviceId;
    if (!serviceId || seen.has(serviceId)) continue;
    seen.add(serviceId);
    merged.push({ boxId: result.id, profileId: result.profileId, serviceId });
  }
  return merged;
}

/** A skill with its coverages, benchmarks, and per-benchmark results. */
export async function loadSkillTree(skillBoxId, explorerUri = DEFAULT_EXPLORER_API) {
  const [skills, coverages, benchmarks] = await Promise.all([
    loadSkills(explorerUri),
    loadCoverages(skillBoxId, explorerUri),
    loadBenchmarks(skillBoxId, explorerUri)
  ]);
  const skill = skills.find((s) => s.boxId === skillBoxId) || null;
  const benchmarksWithResults = await Promise.all(
    benchmarks.map(async (b) => ({ ...b, results: await loadResults(b.id, explorerUri) }))
  );
  return { skill, coverages, benchmarks: benchmarksWithResults };
}
