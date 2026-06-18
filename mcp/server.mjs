#!/usr/bin/env node
/**
 * Celaut Skills MCP server — read-only.
 *
 * Exposes the data-fetching surface of the Celaut Skills registry over MCP
 * stdio transport. No state-mutating tools are exposed; this server is safe
 * to wire into any MCP-aware client (Claude, IDEs, agents) for inspection.
 *
 * Data source: Ergo Explorer mainnet (https://api.ergoplatform.com) via the
 * `searchBoxes` helper from `reputation-system`. The Type NFT IDs are the
 * same placeholder values used by the web app (`src/lib/api.ts`). When the
 * Type NFTs aren't real on-chain hex, queries short-circuit to [] so the
 * tools degrade gracefully rather than throwing.
 *
 * Run: `npm run mcp`
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// We deliberately avoid importing `reputation-system` here — that package
// targets Svelte/Vite (extensionless ESM imports, "svelte" export condition)
// and won't load under plain Node ESM. The bits we need are tiny — Sigma-
// serialise a typeNftId/objectPointer hex into the register payload that the
// Explorer's `/boxes/unspent/search` endpoint expects — so we inline them
// using `@fleet-sdk/serializer` (already a transitive dependency of the app).
import { SColl, SByte } from '@fleet-sdk/serializer';

function hexToBytes(hex) {
  if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Strip the SColl[SByte] tag prefix to match Explorer's renderedValue. */
function serializedToRendered(serialized) {
  if (serialized.startsWith('0e')) return serialized.substring(4);
  if (serialized.startsWith('04')) return serialized.substring(2);
  return serialized;
}

const LIMIT_PER_PAGE = 100;

async function* searchBoxes(explorerUri, typeNftId, objectPointer, limit) {
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

const EXPLORER_API = process.env.CELAUT_EXPLORER_API || 'https://api.ergoplatform.com';

// Type NFT IDs — must match `src/lib/api.ts`. Placeholders today; queries
// short-circuit when these aren't real hex.
const SKILL_TYPE_ID     = 'ffce59c01b9c0c245005f9c2daf817607e912a3ececd5f61aaba48d30230f60c';
const BENCHMARK_TYPE_ID = 'f6480184daf3b7750a58e58319e12adc5266bd986eec0f57ac451c995a30f54d';
const RESULT_TYPE_ID    = '49b26dc06b1680769477264d2e8e9bf561005236cde3097630bffcff631b7aef';
const COVERAGE_TYPE_ID  = '1da6799e935cbb0fb14d359f06f23854c3d1bd509508948cc01b7b018dbbbdf5';

const isHexId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{4,}$/.test(v);

async function collectBoxes(typeNftId, objectPointer, limit = 100) {
  const all = [];
  for await (const batch of searchBoxes(EXPLORER_API, typeNftId, objectPointer, limit)) {
    all.push(...batch);
  }
  return all;
}

function parseR9(box) {
  try {
    const r9 = box?.additionalRegisters?.R9?.renderedValue || '';
    return r9 ? JSON.parse(r9) : {};
  } catch {
    return {};
  }
}

function deriveProfileId(box, parsed) {
  return (
    parsed.profile_id ||
    parsed.profileId ||
    box?.assets?.[0]?.tokenId ||
    box?.boxId ||
    ''
  );
}

// ── Read functions (mirror src/lib/api.ts shapes) ──────────────────────────

async function loadSkills() {
  if (!isHexId(SKILL_TYPE_ID)) return [];
  const boxes = await collectBoxes(SKILL_TYPE_ID, undefined);
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

async function loadCoverages(skillBoxId) {
  if (!isHexId(COVERAGE_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(COVERAGE_TYPE_ID, skillBoxId);
  return boxes.map((box) => {
    const parsed = parseR9(box);
    return {
      boxId: box.boxId,
      profileId: deriveProfileId(box, parsed),
      serviceId: parsed.service_id || undefined
    };
  });
}

async function loadBenchmarks(skillBoxId) {
  if (!isHexId(BENCHMARK_TYPE_ID) || !isHexId(skillBoxId)) return [];
  const boxes = await collectBoxes(BENCHMARK_TYPE_ID, skillBoxId);
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

async function loadResults(benchmarkId) {
  if (!isHexId(RESULT_TYPE_ID) || !isHexId(benchmarkId)) return [];
  const boxes = await collectBoxes(RESULT_TYPE_ID, benchmarkId);
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

// ── MCP tool registry ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'load_skills',
    description: 'Load every registered Skill (capability marker) from the Celaut on-chain registry.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'load_coverages',
    description: 'Load every Coverage opinion for a given Skill box id. A Coverage asserts that a service can address a skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skillBoxId: { type: 'string', description: 'Hex box id of the Skill.' }
      },
      required: ['skillBoxId'],
      additionalProperties: false
    }
  },
  {
    name: 'load_benchmarks',
    description: 'Load every Benchmark opinion for a given Skill box id. A Benchmark defines how the skill is measured.',
    inputSchema: {
      type: 'object',
      properties: {
        skillBoxId: { type: 'string', description: 'Hex box id of the Skill.' }
      },
      required: ['skillBoxId'],
      additionalProperties: false
    }
  },
  {
    name: 'load_results',
    description: 'Load every Result opinion submitted against a given Benchmark id.',
    inputSchema: {
      type: 'object',
      properties: {
        benchmarkId: { type: 'string', description: 'Hex box id of the Benchmark.' }
      },
      required: ['benchmarkId'],
      additionalProperties: false
    }
  },
  {
    name: 'load_skill_tree',
    description: 'Load a Skill with all of its Coverages, Benchmarks and per-Benchmark Results in a single nested payload.',
    inputSchema: {
      type: 'object',
      properties: {
        skillBoxId: { type: 'string', description: 'Hex box id of the Skill.' }
      },
      required: ['skillBoxId'],
      additionalProperties: false
    }
  }
];

const HANDLERS = {
  load_skills: async () => loadSkills(),
  load_coverages: async ({ skillBoxId }) => loadCoverages(skillBoxId),
  load_benchmarks: async ({ skillBoxId }) => loadBenchmarks(skillBoxId),
  load_results: async ({ benchmarkId }) => loadResults(benchmarkId),
  load_skill_tree: async ({ skillBoxId }) => {
    const [skills, coverages, benchmarks] = await Promise.all([
      loadSkills(),
      loadCoverages(skillBoxId),
      loadBenchmarks(skillBoxId)
    ]);
    const skill = skills.find((s) => s.boxId === skillBoxId) || null;
    const benchmarksWithResults = await Promise.all(
      benchmarks.map(async (b) => ({ ...b, results: await loadResults(b.id) }))
    );
    return { skill, coverages, benchmarks: benchmarksWithResults };
  }
};

// ── Server bootstrap ───────────────────────────────────────────────────────

const server = new Server(
  { name: 'celaut-skills', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const handler = HANDLERS[name];
  if (!handler) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }]
    };
  }
  try {
    const data = await handler(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error in ${name}: ${err?.message || String(err)}` }]
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// Keep the process alive; stdio transport handles lifecycle.
