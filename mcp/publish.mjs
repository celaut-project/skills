/**
 * Celaut Skills MCP — publish (state-mutating) surface.
 *
 * Unlike the read-only tools in `server.mjs`, these create on-chain reputation
 * opinions (Skill / Coverage / Benchmark / Result). The publish logic is NOT
 * re-implemented here — it is imported from `reputation-system/node`, the Node
 * entry point of the shared library, so there is a single source of truth for
 * how a reputation transaction is built. The Type NFT ids come from the same
 * registry core the read tools use (`src/lib/registry/core.mjs`), so reads and
 * writes can never drift apart.
 *
 * Signing is pluggable via the library's Signer abstraction, chosen by env:
 *
 *   CELAUT_SIGNER_MODE=seed      – sign + submit autonomously with a mnemonic.
 *     CELAUT_MNEMONIC   (required)  BIP-39 mnemonic of the publishing wallet.
 *     CELAUT_MNEMONIC_PASSWORD     optional BIP-39 passphrase.
 *     CELAUT_NODE_URI              Ergo node for submission (default :9053).
 *     CELAUT_ADDRESS_INDEX         change-path index (default 0).
 *
 *   CELAUT_SIGNER_MODE=unsigned  – build only; return the unsigned EIP-12 tx for
 *                                  an external wallet to sign. No key in the
 *                                  agent. (default)
 *     CELAUT_ADDRESS    (required)  the P2PK address whose UTXOs fund the tx.
 */

import {
  create_opinion_with_signer,
  SeedSigner,
  UnsignedSigner
} from 'reputation-system/node';

import {
  SKILL_TYPE_ID,
  COVERAGE_TYPE_ID,
  BENCHMARK_TYPE_ID,
  RESULT_TYPE_ID,
  SERVICE_DATA_TYPE_ID,
  SERVICE_METADATA_TYPE_ID,
  DEFAULT_EXPLORER_API
} from '../src/lib/registry/core.mjs';

const EXPLORER_API = DEFAULT_EXPLORER_API;

// Created opinions are locked: each entity can be referenced by another, and an
// update would change its box id (its identity). Mirrors src/lib/ergoProvider.ts.
const LOCKED = true;

/** Build the configured Signer from environment. */
export function makeSigner() {
  const mode = (process.env.CELAUT_SIGNER_MODE || 'unsigned').toLowerCase();
  if (mode === 'seed') {
    const mnemonic = process.env.CELAUT_MNEMONIC;
    if (!mnemonic) throw new Error('CELAUT_SIGNER_MODE=seed requires CELAUT_MNEMONIC.');
    return new SeedSigner({
      mnemonic,
      password: process.env.CELAUT_MNEMONIC_PASSWORD,
      addressIndex: process.env.CELAUT_ADDRESS_INDEX ? Number(process.env.CELAUT_ADDRESS_INDEX) : 0,
      explorerUri: EXPLORER_API,
      nodeUri: process.env.CELAUT_NODE_URI
    });
  }
  if (mode === 'unsigned') {
    const address = process.env.CELAUT_ADDRESS;
    if (!address) throw new Error('CELAUT_SIGNER_MODE=unsigned requires CELAUT_ADDRESS.');
    return new UnsignedSigner({ address, explorerUri: EXPLORER_API });
  }
  throw new Error(`Unknown CELAUT_SIGNER_MODE: ${mode} (expected 'seed' or 'unsigned').`);
}

/**
 * Fetch a reputation-proof box by id and shape it into the RPBox `main_box`
 * that `create_opinion` consumes. The box's R4 (rendered) is its Type NFT id,
 * which the contract requires as a data input.
 */
export async function fetchMainBox(mainBoxId) {
  if (!/^[0-9a-fA-F]{64}$/.test(mainBoxId || '')) {
    throw new Error(`mainBoxId must be a 64-char hex box id (got: ${mainBoxId}).`);
  }
  const res = await fetch(`${EXPLORER_API}/api/v1/boxes/${mainBoxId}`);
  if (!res.ok) throw new Error(`Failed to fetch main box ${mainBoxId}: HTTP ${res.status}`);
  const box = await res.json();

  const reputationTokenId = box?.assets?.[0]?.tokenId;
  if (!reputationTokenId) {
    throw new Error(`Box ${mainBoxId} holds no reputation token; not a valid main box.`);
  }

  return {
    box: {
      boxId: box.boxId,
      value: box.value.toString(),
      assets: (box.assets ?? []).map((a) => ({ tokenId: a.tokenId, amount: a.amount.toString() })),
      ergoTree: box.ergoTree,
      creationHeight: box.creationHeight,
      // Explorer { R4: { serializedValue, ... } } -> Fleet { R4: serializedValue }.
      additionalRegisters: Object.entries(box.additionalRegisters ?? {}).reduce((acc, [k, v]) => {
        acc[k] = v.serializedValue;
        return acc;
      }, {}),
      index: box.index ?? 0,
      transactionId: box.transactionId
    },
    box_id: box.boxId,
    type: { tokenId: box?.additionalRegisters?.R4?.renderedValue || '' },
    token_id: reputationTokenId,
    token_amount: Number(box.assets[0].amount),
    object_pointer: box?.additionalRegisters?.R5?.renderedValue || '',
    is_locked: box?.additionalRegisters?.R6?.renderedValue === 'true',
    polarization: box?.additionalRegisters?.R8?.renderedValue === 'true',
    content: {}
  };
}

/** Normalize a SignerResult into an MCP-friendly payload. */
function describeResult(result) {
  if (result.kind === 'submitted') {
    return { submitted: true, txId: result.txId };
  }
  return {
    submitted: false,
    unsignedTransaction: result.transaction,
    note: 'Transaction built but not signed. Sign + submit with an external wallet (Nautilus/ErgoPay).'
  };
}

async function publishOpinion(typeNftId, objectPointer, content, mainBoxId, tokenAmount) {
  const signer = makeSigner();
  const main_box = await fetchMainBox(mainBoxId);
  const result = await create_opinion_with_signer(
    signer,
    EXPLORER_API,
    tokenAmount ?? 1,
    typeNftId,
    objectPointer,
    true, // polarization (positive)
    content,
    LOCKED,
    main_box
  );
  return describeResult(result);
}

// ── The four uploads (content shapes mirror src/lib/ergoProvider.ts) ─────────

export async function createSkill(input) {
  return publishOpinion(
    SKILL_TYPE_ID,
    '', // a skill does not point at another entity
    {
      name: input.name,
      prose: input.prose,
      formal: input.formal ?? '',
      tags: input.tags ?? [],
      domain: input.domain ?? '',
      extended_skill_boxes: input.extendedSkillBoxIds ?? [],
      source_hash: input.sourceHash ?? null
    },
    input.mainBoxId,
    input.tokenAmount
  );
}

export async function createCoverage(input) {
  return publishOpinion(
    COVERAGE_TYPE_ID,
    input.skillBoxId,
    {
      skill_box_id: input.skillBoxId,
      service_id: input.serviceId ?? null
    },
    input.mainBoxId,
    input.tokenAmount
  );
}

export async function createBenchmark(input) {
  return publishOpinion(
    BENCHMARK_TYPE_ID,
    input.skillBoxId,
    {
      skill_box_id: input.skillBoxId,
      name: input.name,
      description: input.description ?? '',
      case_descriptors: input.caseDescriptors ?? [],
      performance_metrics: input.performanceMetrics ?? [],
      source_hash: input.sourceHash ?? null
    },
    input.mainBoxId,
    input.tokenAmount
  );
}

export async function createResult(input) {
  return publishOpinion(
    RESULT_TYPE_ID,
    input.benchmarkId,
    {
      benchmark_id: input.benchmarkId,
      service_id: input.serviceId,
      data: (input.data ?? []).map((c) => ({
        case_meta: c.caseMeta,
        metrics_values: c.metricsValues
      })),
      notes: input.notes ?? '',
      timestamp: input.timestamp ?? null,
      source_hash: input.sourceHash ?? null
    },
    input.mainBoxId,
    input.tokenAmount
  );
}

// Service info: R5 = service id, R9 = the spec fragment (object) OR a blake2b
// hash string pointing at the content in `sources`. `content` is passed through
// verbatim so callers can publish either mode.
export async function createServiceData(input) {
  return publishOpinion(
    SERVICE_DATA_TYPE_ID,
    input.serviceId,
    input.content,
    input.mainBoxId,
    input.tokenAmount
  );
}

export async function createServiceMetadata(input) {
  return publishOpinion(
    SERVICE_METADATA_TYPE_ID,
    input.serviceId,
    input.content,
    input.mainBoxId,
    input.tokenAmount
  );
}
