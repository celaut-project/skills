import type { ReputationProof, RPBox } from 'source-application';

/**
 * Pick the main box used to spend reputation tokens for opinion-style writes.
 * We prefer the self-referential box when available and fall back to the first box.
 */
export function getMainReputationBox(proof: ReputationProof | null | undefined): RPBox | undefined {
  if (!proof?.current_boxes?.length) return undefined;
  return proof.current_boxes.find((box) => box.object_pointer === proof.token_id) ?? proof.current_boxes[0];
}
