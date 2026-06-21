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
  loadSkillTree
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
  }
];

const HANDLERS = {
  load_skills: async () => loadSkills(),
  load_coverages: async ({ skillBoxId }) => loadCoverages(skillBoxId),
  load_benchmarks: async ({ skillBoxId }) => loadBenchmarks(skillBoxId),
  load_results: async ({ benchmarkId }) => loadResults(benchmarkId),
  load_skill_tree: async ({ skillBoxId }) => loadSkillTree(skillBoxId)
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
