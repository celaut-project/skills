# Celaut Skills MCP server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server
that exposes the Celaut Skills on-chain registry as MCP tools. No tool in this
server creates or mutates state — it is safe to wire into any MCP client.

## Run

```bash
npm install
npm run mcp
```

The server speaks MCP over stdio. Point any MCP-aware client at
`node mcp/server.mjs` from the repo root.

Optional env: `CELAUT_EXPLORER_API` (defaults to `https://api.ergoplatform.com`).

## Connect a client

Running the server is not enough — an MCP client has to be told where to find
it. Use the absolute path to `mcp/server.mjs` in this repo.

**Claude Code / Claude Desktop (one-liner):**

```bash
claude mcp add celaut-skills -- node /path/to/skills/mcp/server.mjs
```

**Generic `mcpServers` config block** (Claude Desktop `claude_desktop_config.json`,
or any client that reads this shape):

```json
{
  "mcpServers": {
    "celaut-skills": {
      "command": "node",
      "args": ["/path/to/skills/mcp/server.mjs"],
      "env": {
        "CELAUT_EXPLORER_API": "https://api.ergoplatform.com"
      }
    }
  }
}
```

Replace `/path/to/skills` with the absolute path to your clone. The `env` block
is optional (the default explorer API is used when it is omitted). Run
`npm install` in the repo first so `node` can resolve the server's dependencies.

## Discovery flow — start with `load_skills`

Four of the five tools require a `skillBoxId` or `benchmarkId`, and **only
`load_skills` takes no arguments**. There is no other entry point, so every
session starts by listing skills and picking a box id from the results:

```
load_skills                         (no args)  → [ { boxId, name, ... }, ... ]
   │  pick a boxId
   ▼
load_skill_tree { skillBoxId }      → skill + coverages + benchmarks + results
```

Worked example:

```jsonc
// 1. List skills — the only argument-free tool.
load_skills()
// → [
//     { "boxId": "3f1c9a...e7", "name": "Optimal XAU/BTC Performance",
//       "tags": ["trading", "gold"], "extendedSkillBoxIds": [] },
//     { "boxId": "8b204d...aa", "name": "Sat-sorter", "tags": ["utxo"] }
//   ]

// 2. Take a boxId from step 1 and load the full tree in one call.
load_skill_tree({ "skillBoxId": "3f1c9a...e7" })
// → {
//     "skill":      { "boxId": "3f1c9a...e7", "name": "Optimal XAU/BTC Performance", ... },
//     "coverages":  [ { "boxId": "c0ffee...", "serviceId": "9a77..." } ],
//     "benchmarks": [ { "id": "bench01...", "name": "12-month backtest",
//                       "results": [ { "id": "res01...", "serviceId": "9a77..." } ] } ]
//   }
```

If you need finer-grained access, the same `skillBoxId` feeds `load_coverages`
and `load_benchmarks`, and a `benchmarkId` from `load_benchmarks` feeds
`load_results`. `load_skill_tree` is just the convenience call that bundles all
of them.

## Architecture — one data layer, no duplication

`mcp/server.mjs` is a **thin wrapper**. It contains only the MCP tool registry
and handlers; it implements no chain logic of its own. Every `load_*` function,
the Type NFT ids, the Explorer box search, and the R9 parsers live once in the
shared, framework-agnostic core:

```
src/lib/registry/core.mjs   ← single source of truth (plain ESM, no Svelte/Vite)
├─ imported by  src/lib/api.ts      (the web app re-exports the Type NFT ids)
└─ imported by  mcp/server.mjs      (the MCP server maps load_* → tools)
```

Because the core is dependency-free ESM (only `@fleet-sdk/serializer` + global
`fetch`), it runs unchanged under both Vite and bare Node. The server therefore
**cannot drift** from the app: the load functions and ids are literally the same
module, not a hand-copied mirror.

> Note: the Type NFT ids are placeholders until real Type NFTs are minted, so
> these queries return empty arrays — the same behaviour as the web app's live
> mode. The web app's *transport* differs (it uses `reputation-system`'s
> `searchBoxes` in the browser); the core inlines the equivalent register search
> so it works under Node. Everything else — ids, parsing, `load_*` shapes — is
> shared.

## Tools

### `load_skills`

List every registered Skill (capability marker).

- **Args:** none.
- **Returns:** array of
  `{ boxId, profileId, name, prose, formal, tags[], domain, extendedSkillBoxIds[], sourceHash? }`.

### `load_coverages`

Coverages for one Skill — the services that address it. Includes both **direct**
coverages (Coverage boxes pointing at the skill) and services that **indirectly**
cover it by appearing as the `service_id` of a Result under one of the skill's
Benchmarks. The list is deduped by `serviceId` (direct coverages win).

- **Args:** `{ skillBoxId: string }` (hex box id).
- **Returns:** array of `{ boxId, profileId, serviceId? }`.

### `load_benchmarks`

Benchmarks defined under one Skill (the "how to measure" specs).

- **Args:** `{ skillBoxId: string }` (hex box id).
- **Returns:** array of
  `{ id, profileId, skillBoxId, name, description, caseDescriptors[], performanceMetrics[], sourceHash? }`
  where `caseDescriptors[i] = { name, description }` and
  `performanceMetrics[i] = { name, description, higherIsBetter }`.

### `load_results`

Results submitted against one Benchmark.

- **Args:** `{ benchmarkId: string }` (hex Benchmark box id).
- **Returns:** array of
  `{ id, profileId, benchmarkId, serviceId, data[], notes, timestamp, sourceHash? }`
  where each `data[i] = { caseMeta: number[], metricsValues: number[] }` and
  indexes line up positionally with the parent Benchmark's `caseDescriptors`
  and `performanceMetrics`.

### `load_skill_tree`

Convenience tool — returns a Skill plus its Coverages, Benchmarks, and the
Results under each Benchmark in a single nested payload.

- **Args:** `{ skillBoxId: string }`.
- **Returns:** `{ skill, coverages[], benchmarks: (Benchmark & { results: Result[] })[] }`.

## Explicitly omitted

The following data-layer functions create or mutate on-chain state and are
**not** exposed by this server: `createSkill`, `createCoverage`,
`createBenchmark`, `createResult`.
