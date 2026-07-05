#!/usr/bin/env node
/**
 * Celaut Skills MCP server — read-only.
 *
 * Exposes the data-fetching surface of the Celaut Skills registry over MCP
 * stdio transport. No state-mutating tools are exposed; this server is safe
 * to wire into any MCP-aware client (Claude, IDEs, agents) for inspection.
 *
 * This file is deliberately THIN: every `load_*` function lives in the shared,
 * framework-agnostic registry core at `src/lib/registry/core.mjs` (the same
 * module the web app draws its Type NFT ids from). The server here only maps
 * those functions onto MCP tools — it does not re-implement the data layer, so
 * the two can never drift apart.
 *
 * Data source: Ergo Explorer mainnet (override via `CELAUT_EXPLORER_API`). When
 * the Type NFT ids in the core aren't real on-chain hex, queries short-circuit
 * to [] so the tools degrade gracefully rather than throwing.
 *
 * Run: `npm run mcp`
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {
  loadSkills,
  loadCoverages,
  loadBenchmarks,
  loadResults,
  loadSkillTree,
  loadServiceData,
  loadServiceMetadata
} from '../src/lib/registry/core.mjs';

// ── MCP tool registry ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'load_skills',
    description: 'Load every registered Skill (capability marker) from the Celaut on-chain registry.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'load_coverages',
    description: 'Load every Coverage for a given Skill box id — direct Coverage boxes plus services that indirectly cover the skill via Results. A Coverage asserts that a service can address a skill.',
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
  },
  {
    name: 'load_service_data',
    description: 'Load the on-chain functional spec fragments (architecture / api / network) published for a given service id. Each entry is either inline (JSON on-chain) or source mode (a blake2b hash whose content lives in `sources`). Lets a client learn basic service facts without downloading the whole service.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Hex service id (content hash) the info is about.' }
      },
      required: ['serviceId'],
      additionalProperties: false
    }
  },
  {
    name: 'load_service_metadata',
    description: 'Load the on-chain descriptive metadata (name / description / tags) published for a given service id. Each entry is inline JSON or a blake2b hash resolved from `sources`.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Hex service id (content hash) the info is about.' }
      },
      required: ['serviceId'],
      additionalProperties: false
    }
  },
  // ── Publish (state-mutating) tools ──────────────────────────────────────
  // These build/submit on-chain reputation opinions via reputation-system/node.
  // Signing mode is set by env (CELAUT_SIGNER_MODE=seed|unsigned); see publish.mjs.
  {
    name: 'create_skill',
    description: 'Publish a new Skill (capability marker) to the Celaut on-chain registry. Builds a reputation opinion and either submits it (seed signer) or returns the unsigned tx (unsigned signer).',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        name: { type: 'string', description: 'Skill name.' },
        prose: { type: 'string', description: 'Human-readable description of the skill.' },
        formal: { type: 'string', description: 'Optional formal/spec definition.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
        domain: { type: 'string', description: 'Optional domain.' },
        extendedSkillBoxIds: { type: 'array', items: { type: 'string' }, description: 'Optional parent skill box ids this extends.' },
        sourceHash: { type: 'string', description: 'Optional hash of the source artifact.' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'name', 'prose'],
      additionalProperties: false
    }
  },
  {
    name: 'create_coverage',
    description: 'Publish a Coverage opinion asserting that a service can address a given Skill.',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        skillBoxId: { type: 'string', description: 'Hex box id of the Skill being covered.' },
        serviceId: { type: 'string', description: 'Optional service identifier providing the coverage.' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'skillBoxId'],
      additionalProperties: false
    }
  },
  {
    name: 'create_benchmark',
    description: 'Publish a Benchmark opinion defining how a given Skill is measured.',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        skillBoxId: { type: 'string', description: 'Hex box id of the Skill being benchmarked.' },
        name: { type: 'string', description: 'Benchmark name.' },
        description: { type: 'string', description: 'Benchmark description.' },
        caseDescriptors: { type: 'array', description: 'Ordered case descriptors.' },
        performanceMetrics: { type: 'array', description: 'Ordered performance metric definitions.' },
        sourceHash: { type: 'string', description: 'Optional hash of the source artifact.' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'skillBoxId', 'name'],
      additionalProperties: false
    }
  },
  {
    name: 'create_result',
    description: 'Publish a Result opinion: a performance tensor submitted against a given Benchmark.',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        benchmarkId: { type: 'string', description: 'Hex box id of the Benchmark.' },
        serviceId: { type: 'string', description: 'Service identifier that produced the result.' },
        data: {
          type: 'array',
          description: 'Per-case execution data: [{ caseMeta: number[], metricsValues: number[] }].',
          items: {
            type: 'object',
            properties: {
              caseMeta: { type: 'array', items: { type: 'number' } },
              metricsValues: { type: 'array', items: { type: 'number' } }
            }
          }
        },
        notes: { type: 'string', description: 'Optional notes.' },
        timestamp: { type: 'number', description: 'Optional unix timestamp.' },
        sourceHash: { type: 'string', description: 'Optional hash of the source artifact.' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'benchmarkId', 'serviceId', 'data'],
      additionalProperties: false
    }
  },
  {
    name: 'create_service_data',
    description: 'Publish a Service Data opinion: a functional spec fragment (container / api / network) for a service id. `content` is either a JSON object (inline) or a blake2b hash string whose content lives in `sources`.',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        serviceId: { type: 'string', description: 'Service id (content hash) the data describes.' },
        content: { description: 'JSON object (container/api/network) OR a blake2b256 hash string (source mode).' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'serviceId', 'content'],
      additionalProperties: false
    }
  },
  {
    name: 'create_service_metadata',
    description: 'Publish a Service Metadata opinion: arbitrary descriptive JSON (or a blake2b hash) for a service id.',
    inputSchema: {
      type: 'object',
      properties: {
        mainBoxId: { type: 'string', description: 'Hex box id of the reputation profile box to spend from.' },
        serviceId: { type: 'string', description: 'Service id (content hash) the metadata describes.' },
        content: { description: 'Arbitrary JSON object OR a blake2b256 hash string (source mode).' },
        tokenAmount: { type: 'number', description: 'Reputation tokens to allocate (default 1).' }
      },
      required: ['mainBoxId', 'serviceId', 'content'],
      additionalProperties: false
    }
  }
];

const HANDLERS = {
  load_skills: async () => loadSkills(),
  load_coverages: async ({ skillBoxId }) => loadCoverages(skillBoxId),
  load_benchmarks: async ({ skillBoxId }) => loadBenchmarks(skillBoxId),
  load_results: async ({ benchmarkId }) => loadResults(benchmarkId),
  load_skill_tree: async ({ skillBoxId }) => loadSkillTree(skillBoxId),
  load_service_data: async ({ serviceId }) => loadServiceData(serviceId),
  load_service_metadata: async ({ serviceId }) => loadServiceMetadata(serviceId),
  // Publish handlers lazy-import the publish surface so the read-only tools keep
  // working even if the reputation-system/node dependency is unavailable.
  create_skill: async (args) => (await import('./publish.mjs')).createSkill(args),
  create_coverage: async (args) => (await import('./publish.mjs')).createCoverage(args),
  create_benchmark: async (args) => (await import('./publish.mjs')).createBenchmark(args),
  create_result: async (args) => (await import('./publish.mjs')).createResult(args),
  create_service_data: async (args) => (await import('./publish.mjs')).createServiceData(args),
  create_service_metadata: async (args) => (await import('./publish.mjs')).createServiceMetadata(args)
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
