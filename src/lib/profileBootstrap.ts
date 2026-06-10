/**
 * Profile bootstrap + simple reputation helpers (per Josemi 2026-06-10).
 *
 *  - When the wallet first connects, check whether the user already has a
 *    reputation profile via `fetchAllUserProfiles`. If none, prompt them to
 *    create one with `create_profile` (an optional ERG sacrifice can be added
 *    to boost the profile's reputation right away).
 *  - Reputation surface is intentionally simple in this iteration: it is the
 *    total amount sacrificed against the profile_id (the token_id of the
 *    reputation proof that signed the entity). We expose that via
 *    `getProfileReputation(proof)` which delegates to `total_burned` from the
 *    reputation-system library.
 *
 * Author of each entity is its `profile_id` — derivable from the on-chain
 * box's token, so we do not carry it inline anymore.
 */

import {
  create_profile,
  fetchAllUserProfiles,
  fetchTypeNfts,
  sacrifice_assets,
  total_burned,
  type ReputationProof,
  type RPBox,
  type TypeNFT,
} from 'reputation-system';

/** Type NFT used for plain user profiles (no celaut-domain type yet). */
const USER_PROFILE_TYPE_ID = '';

/**
 * Returns the user's existing profiles, if any. Pass the current explorer URI.
 * If `types` is omitted, all profiles are returned regardless of type.
 */
export async function getUserProfiles(
  explorerUri: string,
  types?: string[],
): Promise<ReputationProof[]> {
  const availableTypes = await fetchTypeNfts(explorerUri);
  return fetchAllUserProfiles(explorerUri, null, types, availableTypes);
}

/**
 * Ensure the wallet has at least one reputation profile. If none exist, create
 * a new one with `totalSupply` tokens and optionally sacrifice ERG at mint time
 * to give the profile non-zero starting reputation.
 *
 * Returns the existing profile if found, otherwise the tx id of the new profile.
 */
export async function ensureUserProfile(
  explorerUri: string,
  options: {
    totalSupply?: number;
    sacrificeErg?: bigint;
    typeNftId?: string;
    content?: object | string | null;
  } = {},
): Promise<{ status: 'existing'; profiles: ReputationProof[] } | { status: 'created'; txId: string }> {
  const profiles = await getUserProfiles(explorerUri);
  if (profiles.length > 0) {
    return { status: 'existing', profiles };
  }
  const txId = await create_profile(
    explorerUri,
    options.totalSupply ?? 1,
    options.typeNftId ?? USER_PROFILE_TYPE_ID,
    options.content ?? null,
    options.sacrificeErg,
  );
  if (!txId) throw new Error('Failed to create reputation profile.');
  return { status: 'created', txId };
}

/**
 * Sacrifice additional ERG against an existing profile box, increasing the
 * profile's reputation (= total burned against that profile_id).
 */
export async function boostProfileReputation(
  explorerUri: string,
  box: RPBox,
  ergAmount: bigint,
): Promise<string> {
  const txId = await sacrifice_assets(explorerUri, box, ergAmount);
  if (!txId) throw new Error('Sacrifice failed.');
  return txId;
}

/**
 * Reputation of a profile_id = total ERG/tokens burned against it.
 * This is the simple stub Josemi asked for — we may layer benchmark-result
 * reputation on top later.
 */
export function getProfileReputation(proof: ReputationProof): number {
  return total_burned(proof);
}

export type { ReputationProof, RPBox, TypeNFT };
