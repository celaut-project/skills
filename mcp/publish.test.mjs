/**
 * Tests for the MCP publish surface (mcp/publish.mjs).
 *
 * The transaction-building + signing path itself is covered by
 * reputation-system's own mock-chain suite. Here we cover the celaut-specific
 * glue: signer selection from env, and the explorer-box -> RPBox shaping that
 * feeds create_opinion.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSigner, fetchMainBox } from './publish.mjs';

describe('makeSigner', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('builds an UnsignedSigner by default when an address is provided', () => {
    process.env.CELAUT_SIGNER_MODE = 'unsigned';
    process.env.CELAUT_ADDRESS = '9hY16vzHmmfyVBwKeFGHvb2bMFsG94A1u7To1QGtuQ1xHHEwYS3';
    const signer = makeSigner();
    expect(signer.constructor.name).to.equal('UnsignedSigner');
  });

  it('builds a SeedSigner when mode=seed and a mnemonic is provided', () => {
    process.env.CELAUT_SIGNER_MODE = 'seed';
    process.env.CELAUT_MNEMONIC =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const signer = makeSigner();
    expect(signer.constructor.name).to.equal('SeedSigner');
  });

  it('throws when seed mode lacks a mnemonic', () => {
    process.env.CELAUT_SIGNER_MODE = 'seed';
    delete process.env.CELAUT_MNEMONIC;
    expect(() => makeSigner()).to.throw(/CELAUT_MNEMONIC/);
  });

  it('throws when unsigned mode lacks an address', () => {
    process.env.CELAUT_SIGNER_MODE = 'unsigned';
    delete process.env.CELAUT_ADDRESS;
    expect(() => makeSigner()).to.throw(/CELAUT_ADDRESS/);
  });

  it('throws on an unknown signer mode', () => {
    process.env.CELAUT_SIGNER_MODE = 'hsm';
    expect(() => makeSigner()).to.throw(/Unknown CELAUT_SIGNER_MODE/);
  });
});

describe('fetchMainBox', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shapes an explorer box into the RPBox create_opinion expects', async () => {
    const boxId = 'a'.repeat(64);
    const typeNftId = 'ffce59c01b9c0c245005f9c2daf817607e912a3ececd5f61aaba48d30230f60c';
    const reputationTokenId = 'b'.repeat(64);

    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url)).to.contain(`/api/v1/boxes/${boxId}`);
      return {
        ok: true,
        json: async () => ({
          boxId,
          value: 1000000n.toString(),
          ergoTree: '0008cd02abcd',
          creationHeight: 800000,
          assets: [{ tokenId: reputationTokenId, amount: '1000' }],
          additionalRegisters: {
            R4: { serializedValue: '0e20' + typeNftId, renderedValue: typeNftId },
            R5: { serializedValue: '0e20' + reputationTokenId, renderedValue: reputationTokenId },
            R6: { serializedValue: '0400', renderedValue: 'false' },
            R8: { serializedValue: '0401', renderedValue: 'true' }
          },
          index: 0,
          transactionId: 'c'.repeat(64)
        })
      };
    });

    const main_box = await fetchMainBox(boxId);

    // Type NFT id is pulled from R4's rendered value (needed as a data input).
    expect(main_box.type.tokenId).to.equal(typeNftId);
    // Reputation token id from the first asset.
    expect(main_box.token_id).to.equal(reputationTokenId);
    expect(main_box.token_amount).to.equal(1000);
    // Registers are flattened to { Rn: serializedValue } for Fleet.
    expect(main_box.box.additionalRegisters.R4).to.equal('0e20' + typeNftId);
    expect(main_box.box.boxId).to.equal(boxId);
    expect(main_box.is_locked).to.equal(false);
    expect(main_box.polarization).to.equal(true);
  });

  it('rejects a non-hex box id without hitting the network', async () => {
    globalThis.fetch = vi.fn();
    await expect(fetchMainBox('not-a-box')).rejects.toThrow(/64-char hex/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
