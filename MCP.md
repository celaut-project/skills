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

## Data source

All tools query the Ergo Explorer via `searchBoxes` from the `reputation-system`
package and parse the same on-chain shape the web app uses (`src/lib/api.ts`).

> Note: the Type NFT IDs in `mcp/server.mjs` mirror the placeholder values in
> `src/lib/api.ts`. Until real Type NFTs are minted, these queries return
> empty arrays — the same behaviour as the web app's live mode.

## Tools

### `load_skills`

List every registered Skill (capability marker).

- **Args:** none.
- **Returns:** array of
  `{ boxId, profileId, name, prose, formal, tags[], domain, extendedSkillBoxIds[], sourceHash? }`.

### `load_coverages`

Coverages for one Skill (services that claim to address it).

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
