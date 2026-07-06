/**
 * Strict Definition (Tag-Prose-Formal) — the concept-formalization half of the
 * Strict-Definition + Dependency-and-Trust-Framework pair. See
 * `trustFramework.ts` for the assessment half they compose into.
 *
 * A Strict Definition is an improvable, brand-free formalization of ANY concept
 * — a skill, a benchmark space, or a *network* — expressed as three fields:
 *
 *   tag     a short machine key, `<kind>:<slug>` (e.g. "network:celaut-comm-domain")
 *   prose   the human-readable definition
 *   formal  a machine-checkable spec; its shape depends on the concept kind
 *
 * It is an ordinary reputation-system object and uses the EXACT standard opinion
 * register schema — nothing custom:
 *
 *   R4  type_nft_id    STRICT_DEFINITION_TYPE_ID
 *   R5  object_pointer EMPTY — a Strict Definition is self-contained, points at nothing
 *   R6  is_locked : Bool
 *   R7  proposition    (author ergoTree)
 *   R8  polarization : Bool
 *   R9  raw_content : utf8 (the JSON payload below)
 *
 * A Dependency-and-Trust-Framework box then points at THIS box via its own R5
 * and carries the per-action trust/access assessment. Networks are the first
 * concept we pin down end-to-end because a service is only as trustworthy as the
 * network it talks through — the thing the nodo `Service.Network` domain models.
 */

import type { ActionAssessment, FrameworkContent } from './trustFramework';

/**
 * The kind of concept a Strict Definition formalizes. The tag is prefixed with
 * this so consumers can dispatch on `formal`'s shape without guessing.
 */
export enum ConceptKind {
  Skill = 'skill',
  Benchmark = 'benchmark',
  Network = 'network'
}

/**
 * Machine-checkable spec for a *network* Strict Definition. Captures exactly the
 * properties the Sigmaverse KyA assessment (the Trust Framework) needs to reason
 * about — the comm domain, how peers are found, and the fundamental actions that
 * will each be scored on trust + access.
 */
export interface NetworkFormalSpec {
  /** Communication domain / protocol stack, e.g. "grpc/celaut-v1". */
  protocol: string;
  /** How peers discover each other, e.g. "static", "environment_variable", "dht". */
  peerDiscovery: string;
  /**
   * The fundamental network actions that the Trust Framework assesses. Every
   * name here should appear as an ActionAssessment in the DTF that points at
   * this definition, so the two boxes stay in lockstep.
   */
  actions: string[];
}

/** The R9 payload of a Strict Definition box (JSON, utf8). */
export interface StrictDefinitionContent {
  kind: ConceptKind;
  /** `<kind>:<slug>` — must start with `kind`. */
  tag: string;
  prose: string;
  /** Shape depends on `kind`; NetworkFormalSpec when kind === Network. */
  formal: unknown;
}

/** A Strict Definition whose concept is a network. */
export interface NetworkDefinition extends StrictDefinitionContent {
  kind: ConceptKind.Network;
  formal: NetworkFormalSpec;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Build the R9 content for a network Strict Definition. Enforces the invariants
 * the on-chain schema can't (non-empty prose, well-formed tag, at least one
 * assessable action) so a malformed definition never reaches a box.
 *
 * @throws if any field is empty/blank or the slug is not kebab-case.
 */
export function makeNetworkDefinition(
  slug: string,
  prose: string,
  formal: NetworkFormalSpec
): NetworkDefinition {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`makeNetworkDefinition: slug must be kebab-case, got "${slug}"`);
  }
  if (prose.trim().length === 0) {
    throw new Error('makeNetworkDefinition: prose is required');
  }
  if (formal.protocol.trim().length === 0 || formal.peerDiscovery.trim().length === 0) {
    throw new Error('makeNetworkDefinition: protocol and peerDiscovery are required');
  }
  if (formal.actions.length === 0) {
    throw new Error('makeNetworkDefinition: at least one network action is required');
  }
  return {
    kind: ConceptKind.Network,
    tag: `${ConceptKind.Network}:${slug}`,
    prose,
    formal
  };
}

/**
 * Serialize a Strict Definition into the utf8 JSON string that goes in R9
 * (`raw_content`). `create_opinion` JSON.stringifies objects too — this is the
 * explicit form and the one the decoder round-trips.
 */
export function encodeStrictDefinitionR9(def: StrictDefinitionContent): string {
  if (!def.tag.startsWith(`${def.kind}:`)) {
    throw new Error(`encodeStrictDefinitionR9: tag "${def.tag}" must start with "${def.kind}:"`);
  }
  return JSON.stringify(def);
}

/** Parse a Strict Definition box's R9 `raw_content` back into its structure. */
export function decodeStrictDefinitionR9(rawContent: string): StrictDefinitionContent {
  return JSON.parse(rawContent) as StrictDefinitionContent;
}

/** Type guard: is this Strict Definition about a network? */
export function isNetworkDefinition(def: StrictDefinitionContent): def is NetworkDefinition {
  return def.kind === ConceptKind.Network && def.formal != null;
}

/**
 * Bridge a network definition to a Dependency-and-Trust-Framework payload: pair
 * each declared network action with the trust/access levels supplied for it. The
 * result is the FrameworkContent that becomes the DTF box's R9, with that box's
 * R5 pointing back at this definition.
 *
 * @throws if `levels` doesn't cover exactly the definition's declared actions.
 */
export function assessNetwork(
  def: NetworkDefinition,
  levels: Record<string, Omit<ActionAssessment, 'name'>>
): FrameworkContent {
  const declared = def.formal.actions;
  const supplied = Object.keys(levels);
  const missing = declared.filter((a) => !(a in levels));
  const extra = supplied.filter((a) => !declared.includes(a));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `assessNetwork: levels must cover exactly the declared actions ` +
        `(missing: [${missing.join(', ')}], extra: [${extra.join(', ')}])`
    );
  }
  return {
    actions: declared.map((name) => ({ name, ...levels[name] }))
  };
}
