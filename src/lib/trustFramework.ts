/**
 * Strict Definition + Dependency-and-Trust-Framework Type NFTs.
 *
 * Two brand-free Type NFTs so a user only has to think about the *skill* they
 * want; everything under it (services, benchmarks, and the networks services
 * connect through) is pinned down formally — no logos, no marketing.
 *
 * Both are ordinary reputation-system objects and use the EXACT standard
 * opinion register schema — nothing custom:
 *
 *   R4  type_nft_id        (which Type NFT this box instantiates)
 *   R5  object_pointer     (the box this object points at; empty if none)
 *   R6  is_locked : Bool
 *   R7  proposition        (author ergoTree)
 *   R8  polarization : Bool
 *   R9  raw_content : utf8 (JSON payload)
 *
 *  1. Strict Definition (Tag-Prose-Formal)
 *     ─────────────────────────────────────
 *     An improvable formalization of ANY concept — a skill, a benchmark space,
 *     or a network — as `tag` + human `prose` + machine-checkable `formal`.
 *     It is self-contained: it POINTS TO NOTHING (R5 empty). Its whole payload
 *     lives in R9.
 *
 *  2. Dependency and Trust Framework
 *     ──────────────────────────────
 *     A Sigmaverse-Quality-Standard KyA assessment OF a Strict Definition. It
 *     points at the Strict Definition via R5 (object_pointer) — the same slot a
 *     Benchmark uses to point at its Skill — and carries the per-action trust +
 *     access structure in R9. See https://ergoforum.org/t/sigmaverse-update/5222
 *
 * The two summary scores (Weakest Link, Average Risk) are NOT stored on-chain.
 * They are a pure function of the R9 structure and are computed OFF-CHAIN by
 * `computeFrameworkScores` below — anyone can recompute them from the box.
 */

/**
 * Trust Category — how an action's validity is secured.
 * (Sigmaverse Quality Standard; ascending = worse.)
 */
export enum TrustLevel {
  /** Validity is exclusively the immutable smart-contract script. */
  TrustMinimized = 1,
  /** Depends on external crypto-economic actors with incentive-based security. */
  CryptoEconomic = 2,
  /** Requires fiduciary trust in permissioned devs / governance. */
  Fiduciary = 3
}

/**
 * Access Category — user sovereignty over execution.
 * (Sigmaverse Quality Standard; ascending = worse.)
 */
export enum AccessLevel {
  /** Verifiable Artifact — the user runs the software in their own environment. */
  VerifiableArtifact = 1,
  /** Centralized Service Dependency — relies on a third-party hosted service. */
  CentralizedService = 2
}

/** One fundamental action of the assessed system, scored on both axes. */
export interface ActionAssessment {
  /** Human-readable action name, e.g. "create proposal", "claim funds". */
  name?: string;
  trust: TrustLevel;
  access: AccessLevel;
}

/**
 * The R9 payload of a Dependency-and-Trust-Framework box (JSON, utf8).
 * Mirrors the reputation-system convention where R9 holds the object's content.
 */
export interface FrameworkContent {
  actions: ActionAssessment[];
}

/** The two Sigmaverse summary scores. Derived, never stored on-chain. */
export interface FrameworkScores {
  /** Weakest Link — the single highest (worst) level across every category. 1..3. */
  weakestLink: number;
  /** Average Risk — mean of every assigned level (rounded to 2 decimals). 1..3. */
  averageRisk: number;
}

/**
 * Compute the two Sigmaverse summary scores from a Dependency-and-Trust-Framework's
 * per-action structure. Pure, deterministic, OFF-CHAIN.
 *
 * @throws if `actions` is empty (a framework with no actions is meaningless).
 */
export function computeFrameworkScores(actions: ActionAssessment[]): FrameworkScores {
  if (actions.length === 0) {
    throw new Error('computeFrameworkScores: at least one action is required');
  }

  let maxLevel = 0;
  let totalLevels = 0;
  for (const a of actions) {
    maxLevel = Math.max(maxLevel, a.trust, a.access);
    totalLevels += a.trust + a.access;
  }

  const levelCount = actions.length * 2; // one trust + one access per action
  const averageRisk = Math.round((totalLevels / levelCount) * 100) / 100;

  return { weakestLink: maxLevel, averageRisk };
}

/**
 * Serialize the framework structure into the utf8 JSON string that goes in R9
 * (`raw_content`). `create_opinion` already JSON.stringifies objects, so passing
 * the `FrameworkContent` object directly works too — this is the explicit form.
 */
export function encodeFrameworkR9(actions: ActionAssessment[]): string {
  const content: FrameworkContent = { actions };
  return JSON.stringify(content);
}

/** Parse a framework box's R9 `raw_content` back into its structure. */
export function decodeFrameworkR9(rawContent: string): FrameworkContent {
  return JSON.parse(rawContent) as FrameworkContent;
}
