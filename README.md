# Celaut Skills

**The decentralized "App Store of problems" for AI agents on Celaut + Ergo**

**Celaut Skills** is a **100% on-chain**, serverless, trustless registry where the **problems (skills)** are the protagonists.

Instead of searching for Celaut services directly, you search for a **skill** ("Optimal XAU/BTC Performance", "Sat-sorter", etc.) and inside it you automatically find:

- Services that cover it (Coverage)
- Real comparative benchmarks
- Community comments and discussion
- Smart ranking by reputation and verifiable metrics

All built on **Ergo + Celaut**, with **skin-in-the-game** native to the reputation system.

---

## Interface surface — how to reach this registry

There are exactly two ways to interact with the registry, and there is **no CLI at this time**:

| Purpose | Interface | How |
|---|---|---|
| **Read** (discover skills, coverages, benchmarks, results) | **MCP server** (read-only) | `npm run mcp` — see [MCP.md](./MCP.md). Wire it into any MCP client (Claude, etc.). |
| **Publish** (create skills, coverages, benchmarks, results) | **`reputation-system` TypeScript library** | `createReputationBox({...})` — see [REPUTATION_LIBRARY.md](./REPUTATION_LIBRARY.md) and the example below. Requires a connected Ergo wallet. |

- **No `nodo` CLI and no standalone Celaut Skills CLI exists** for reading or publishing skills. Agents read through the MCP server; humans/apps publish through the `reputation-system` library (typically from the Svelte web app in this repo). A CLI is **not on the roadmap and not yet shipped** — if that changes it will be documented here.
- The MCP server is read-only by design: it never creates or mutates on-chain state. See the "Explicitly omitted" section of [MCP.md](./MCP.md).

---

## Philosophy and motivation

Celaut has **no** central service registry (by decentralized design).
**Celaut Skills** solves this by inverting the model:

- AI agents search for **problems**, not solutions.
- A single comparative **Result** says more than 100 loose opinions.
- Skills **compose** (they reference other skills) → duplicates resolve organically and in a decentralized way.
- **Everything is opinion with skin-in-the-game → nobody spams without risking reputation.**

---

## The main libraries (all official, from ergo-basics and reputation-systems)

1. **Base template**
   https://github.com/ergo-basics/template
   (Svelte 4 + Vite + Tailwind + Ergo Explorer integration)

2. **Wallet Svelte Component** (real connection to Nautilus and SAFEW)
   https://github.com/ergo-basics/wallet-svelte-component
   Ready-to-use component with reactive stores and full Ergo support.

3. **Reputation System** (core of types and reputation)
   https://github.com/reputation-systems/reputation-system

4. **Forum Application** (on-chain comments on any entity)
   https://github.com/reputation-systems/forum-application

---

## The Types / Entities (official schema)

Each type is a **Type NFT (Digital Public Good)** from the reputation-system.
The actual boxes are **Reputation Boxes** with a fixed structure:

- **R4** = TokenId of the Type NFT
- **R5** = Unique identifier
- **R6** = `locked` (true/false)
- **R7** = `blake2b256(ownerScript)`
- **R8** = `polarization = true`
- **R9** = JSON

### 1. Skill (`celaut:skill:v1`)
**Type NFT** → R4 = `"celaut:skill:v1"`
**Boxes**: R5 = `skill-tag`, R6 = `true`, R9 = `Skill`

### 2. Benchmark (`celaut:benchmark:v1`)
**Type NFT** → R4 = `"celaut:benchmark:v1"`
**Boxes**: R5 = `skill_box_id`, R6 = `true`, R9 = `Benchmark`

### 3. Result (`celaut:result:v1`)
**Type NFT** → R4 = `"celaut:result:v1"`
**Boxes**: R5 = `benchmark_box_id`, R6 = `false` (updatable), R9 = `Result`

### 4. Coverage (`celaut:coverage:v1`)
**Type NFT** → R4 = `"celaut:coverage:v1"`
**Boxes**: R5 = `skill_box_id`, R6 = `false`, R9 = `Coverage`

### 5. Service Data (`celaut:service-data:v1`)
**Type NFT** → R4 = `"celaut:service-data:v1"`
**Boxes**: R5 = `service_id`, R9 = **functional** fragment of the service specification: a JSON that may contain **`container`** (architecture, …), **`api`** and **`network`** with their respective fields — or a blake2b hash.

### 6. Service Metadata (`celaut:service-metadata:v1`)
**Type NFT** → R4 = `"celaut:service-metadata:v1"`
**Boxes**: R5 = `service_id`, R9 = **arbitrary JSON** with descriptive metadata for the service (e.g. `name` / `description` / `tags`) — or a blake2b hash.

> **Service Data + Service Metadata** put *part* of a service's specification on-chain (indexed by `service_id` in R5) so that clients can display a service's api/network/architecture/name in the skills UI **without downloading the full service**. They can be **published** from the app (a form on the service card) and the UI weighs competing assertions by their **reputation**.
>
> **R9 mode (for both):**
> - **inline** — R9 is the JSON directly on-chain (Data: `container`/`api`/`network`; Metadata: free-form JSON).
> - **source** — R9 is a **blake2b256** hash of arbitrary content; the client looks that content up in `sources` (source-application). This mode is detected simply because the R9 payload is a hash string.

---

## Wallet integration (wallet-svelte-component)

This is the official component used for all wallet connection.
It installs with a single command and is used like this:

```svelte
<script>
  import { 
    WalletButton, 
    WalletAddressChangeHandler,
    walletConnected,
    walletAddress,
    walletBalance,
    walletManager 
  } from 'wallet-svelte-component';
</script>

<header>
  <WalletButton explorerUrl="https://explorer.ergoplatform.com" />
</header>

{#if $walletConnected}
  <p>Connected: {$walletAddress}</p>
  <p>Balance: {Number($walletBalance.nanoErgs) / 1e9} ERG</p>
{/if}

<WalletAddressChangeHandler />
```

Useful functions:
- `walletManager.connectWallet('nautilus')`
- `walletManager.disconnectWallet()`
- `walletManager.refreshBalance()`

The component auto-detects Nautilus and SAFEW and manages all reactive state.

---

## How to create and publish entities

Publishing goes through the **`reputation-system`** library (there is no CLI — see "Interface surface" above). Full example with a connected wallet:

```typescript
import { createReputationBox } from 'reputation-system';
import { walletManager } from 'wallet-svelte-component';

// ... after connecting the wallet
const skillProtoBytes = new Skill({ name: "Optimal XAU/BTC", ... }).serializeBinary();

await createReputationBox({
  typeId: skillTypeTokenId,
  r5: "trading-xau-btc",
  r6: true,
  r7: ownerScriptHash,
  r8: true,
  r9: Buffer.from(skillProtoBytes)
});
```

---

## Discovering skills (agent read path)

Agents read the registry through the MCP server. Only `load_skills` takes no
arguments — the other four tools need a `skillBoxId` or `benchmarkId` you can
only obtain by listing skills first. So discovery always starts the same way:

1. **`load_skills`** (no args) → pick a `boxId` from the returned skills.
2. **`load_skill_tree`** `{ skillBoxId }` → the whole tree (coverages, benchmarks, results) in one call.

See [MCP.md](./MCP.md) for the full tool signatures and a worked example.

---

## Comments with Forum Application

Any Service, Skill, Result, Benchmark or Coverage can have on-chain discussion:

```svelte
<script>
  import { Forum } from 'forum-application';
</script>

<Forum 
  topicIdentifier={currentBoxId}  // or service_id ... 
  reputationTokenId={globalRepToken}
/>
```

---

## UI flow

1. **/skills** → Skills gallery (ordered by reputation).
2. Click a Skill → recursively loads `extended_skill_boxes`.
3. Shows a comparative table + full **Forum section**.
4. AI agents consume the same data via the Celaut node.

---
