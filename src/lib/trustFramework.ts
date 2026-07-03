/**
 * Strict Definition + Dependency-and-Trust-Framework Type NFTs.
 *
 * Two brand-free Type NFTs that let a user think only about the *skill* they
 * want while everything underneath (services, benchmarks, and the networks the
 * services connect through) is pinned down formally — no logos, no marketing.
 *
 *  1. Strict Definition  (Tag-Prose-Formal)
 *     ─────────────────────────────────────
 *     An improvable formalization: a `tag`, a human `prose` gloss, and a
 *     machine-checkable `formal` clause. This is the same Tag-Prose-Formal
 *     shape a Skill already carries, promoted to its own type so ANY concept —
 *     a skill, a benchmark space, or a *network* — can be strictly defined and
 *     refined over time. When it defines a network, the `formal` field carries
 *     the network specification and R8 points to a KyA (Know-your-Application)
 *     report following the Sigmaverse Quality Standard's Action-Centric
 *     Analysis. See https://ergoforum.org/t/sigmaverse-update/5222
 *
 *  2. Dependency and Trust Framework
 *     ──────────────────────────────
 *     Attaches an objective risk assessment to a Strict Definition. It scores
 *     every fundamental action of the assessed system on two axes and lets the
 *     chain compute the two summary scores. See `dependency_trust_framework.es`
 *     for the on-chain enforcement — this module is the off-chain mirror used
 *     by the UI and tests, and MUST stay bit-for-bit equivalent to the script.
 */

/**
 * Trust Category — how an action's validity is secured.
 * (Sigmaverse Quality Standard, ascending = worse.)
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
 * (Sigmaverse Quality Standard, ascending = worse.)
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
 * The two final scores summarizing a Dependency-and-Trust-Framework.
 * Both are computed on-chain from the R9 structure; the box merely stores them
 * and the guarding script refuses to preserve a box whose stored values differ.
 */
export interface FrameworkScores {
  /**
   * Weakest Link Score — the single highest (worst) level across every
   * category. Identifies the greatest vulnerability. Range 1..3.
   */
  weakestLink: number;
  /**
   * Average Risk Score — the mean of every assigned level, scaled ×100 so the
   * integer-only VM keeps two decimals. Divide by 100 for display. Reflects
   * overall system design. Range 100..300.
   */
  averageRiskScaled: number;
}

/** Factor R7 is scaled by on-chain to preserve two decimals of precision. */
export const AVERAGE_RISK_SCALE = 100;

/**
 * Compute the two Sigmaverse summary scores from a list of per-action
 * assessments. This is the exact off-chain twin of the ErgoScript in
 * `dependency_trust_framework.es` — keep them in lockstep.
 *
 * @throws if `actions` is empty (a framework with no actions is meaningless;
 *         on-chain such a box is simply unspendable/frozen).
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
  // Integer division, mirroring ErgoScript `(totalLevels * 100) / levelCount`.
  const averageRiskScaled = Math.floor((totalLevels * AVERAGE_RISK_SCALE) / levelCount);

  return { weakestLink: maxLevel, averageRiskScaled };
}

/** Present the scaled average risk as a decimal (e.g. 183 → 1.83). */
export function displayAverageRisk(scores: FrameworkScores): number {
  return scores.averageRiskScaled / AVERAGE_RISK_SCALE;
}

/**
 * Encode the per-action structure into the flat `Coll[(Int, Int)]` layout the
 * ErgoScript reads from R9: one `(trustLevel, accessLevel)` pair per action,
 * in declaration order. Fleet-SDK renders this to the R9 register bytes.
 */
export function encodeActionsForR9(actions: ActionAssessment[]): Array<[number, number]> {
  return actions.map((a) => [a.trust, a.access]);
}
