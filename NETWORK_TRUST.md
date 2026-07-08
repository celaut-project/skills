# Networks & Trust Frameworks

A **Service** is a sealed black box, but it never runs in a vacuum: it talks to
the outside world through **networks** — a gRPC comm domain, a REST API, an IPFS
swarm. A service is only as trustworthy as the networks it depends on, so those
networks are pinned down formally and assessed in the open, exactly the way
Skills and Services are.

Two brand-free objects capture this, both stored as ordinary reputation-system
boxes on Ergo:

## 1. Network Definition (the *what*)

A **Network Definition** is a *Strict Definition* — an improvable, brand-free
formalization of a single communication domain. It answers *what this network
is*, with three fields:

- **Tag** — a short machine key, `network:<slug>` (e.g. `network:celaut-comm-domain`).
- **Prose** — the human-readable definition of the domain.
- **Formal** — a machine-checkable spec:
  - **Protocol** — the transport / comm stack, e.g. `grpc/celaut-v1`.
  - **Peer Discovery** — how peers find each other: `static`, `environment_variable`, `dht`, …
  - **Actions** — a **dict** mapping each fundamental action's `name` to a short
    `description` of what it does. This is the surface that gets assessed.

A definition is **self-contained**: it points at nothing and carries its whole
payload inline. Anyone can publish one, and anyone can publish a better one.

## 2. Dependency & Trust Framework (the *how trustworthy*)

A **Trust Framework** is a *Know-Your-Assumptions* (KyA) assessment **of** a
Network Definition. It points at the definition and scores **every declared
action** on the **Sigmaverse Quality Standard**. Multiple frameworks can assess
the same network — assessment is a permissionless, peer-reviewed act, not the
network author's privilege.

# The Scoring System

The standard follows one principle: **Action-Centric Analysis**. A system is
broken into its fundamental actions, and each action is scored on two
independent axes. In both, a **lower number is better** (more decentralized,
more sovereign).

## Trust Category — how an action is authorized

| Level | Name | Meaning |
|:-----:|------|---------|
| **1** | Trust-Minimized | Validity is decided *exclusively* by the immutable smart-contract script. No external mediator can block or forge it. |
| **2** | Crypto-Economic | Depends on a permissionless set of external actors (oracles, keepers) kept honest by economic incentives and slashing. |
| **3** | Fiduciary | Depends on a permissioned, static set (a dev address, a multisig, a governance council). You trust their identity and integrity. |

## Access Category — user sovereignty over execution

| Level | Name | Meaning |
|:-----:|------|---------|
| **1** | Verifiable Artifact | The user runs the software in their own environment (CLI, desktop, client-side web). No third party is required to act. |
| **2** | Centralized Service | Execution depends on a service hosted by a third party (a website, a centralized API). Its uptime and integrity are load-bearing. |

## The two summary scores

Both scores are a **pure function of the box's contents**, computed *off-chain*.
Nothing is stored — anyone can recompute and verify them from the framework
itself.

- **Weakest Link** — the single highest (worst) level found anywhere in the
  system, across either axis. It surfaces the biggest risk in one number.
- **Average Risk** — the mean of every trust and access level assigned to every
  action. It reflects the overall design rather than the worst case.

A network whose every action scores `1 / 1` is fully trust-minimized and
self-sovereign (Weakest Link 1, Average Risk 1.0). Any `2` or `3` pulls the
scores up and tells you exactly where the assumptions live.

The information here is strictly formal and technical — no marketing, no
endorsements. The scores let you compare networks at a glance; the per-action
matrix lets you read the fine print when you care.
