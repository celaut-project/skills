import { describe, it, expect } from 'vitest';
import {
  ConceptKind,
  makeNetworkDefinition,
  encodeStrictDefinitionR9,
  decodeStrictDefinitionR9,
  isNetworkDefinition,
  assessNetwork,
  type NetworkFormalSpec
} from './strictDefinition';
import { TrustLevel, AccessLevel, computeFrameworkScores } from './trustFramework';

const SPEC: NetworkFormalSpec = {
  protocol: 'grpc/celaut-v1',
  peerDiscovery: 'environment_variable',
  actions: ['peer-discovery', 'message-delivery', 'service-launch']
};

describe('makeNetworkDefinition', () => {
  it('builds a well-formed network Strict Definition with a kind-prefixed tag', () => {
    const def = makeNetworkDefinition('celaut-comm-domain', 'The celaut peer comm domain.', SPEC);
    expect(def.kind).toBe(ConceptKind.Network);
    expect(def.tag).toBe('network:celaut-comm-domain');
    expect(isNetworkDefinition(def)).toBe(true);
  });

  it('rejects non-kebab slugs, blank prose, and empty action sets', () => {
    expect(() => makeNetworkDefinition('Bad_Slug', 'x', SPEC)).toThrow(/kebab-case/);
    expect(() => makeNetworkDefinition('ok', '   ', SPEC)).toThrow(/prose/);
    expect(() => makeNetworkDefinition('ok', 'x', { ...SPEC, actions: [] })).toThrow(/action/);
    expect(() => makeNetworkDefinition('ok', 'x', { ...SPEC, protocol: '' })).toThrow(/protocol/);
  });
});

describe('R9 encode/decode', () => {
  it('round-trips through raw_content', () => {
    const def = makeNetworkDefinition('celaut-comm-domain', 'The celaut peer comm domain.', SPEC);
    const decoded = decodeStrictDefinitionR9(encodeStrictDefinitionR9(def));
    expect(decoded).toEqual(def);
  });

  it('refuses to encode a tag that does not match its kind', () => {
    const bad = { kind: ConceptKind.Network, tag: 'skill:oops', prose: 'x', formal: SPEC };
    expect(() => encodeStrictDefinitionR9(bad)).toThrow(/must start with/);
  });
});

describe('assessNetwork → trust framework', () => {
  it('pairs every declared action with its trust/access levels and scores off-chain', () => {
    const def = makeNetworkDefinition('celaut-comm-domain', 'The celaut peer comm domain.', SPEC);
    const content = assessNetwork(def, {
      'peer-discovery': { trust: TrustLevel.CryptoEconomic, access: AccessLevel.VerifiableArtifact },
      'message-delivery': { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      'service-launch': { trust: TrustLevel.Fiduciary, access: AccessLevel.CentralizedService }
    });
    expect(content.actions.map((a) => a.name)).toEqual(SPEC.actions);

    const scores = computeFrameworkScores(content.actions);
    // worst level present is Fiduciary (3); mean of [2,1,1,1,3,2] = 10/6 = 1.67
    expect(scores.weakestLink).toBe(3);
    expect(scores.averageRisk).toBe(1.67);
  });

  it('rejects level maps that miss or overshoot the declared actions', () => {
    const def = makeNetworkDefinition('n', 'x', { ...SPEC, actions: ['a', 'b'] });
    expect(() =>
      assessNetwork(def, { a: { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact } })
    ).toThrow(/missing: \[b\]/);
    expect(() =>
      assessNetwork(def, {
        a: { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
        b: { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
        c: { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact }
      })
    ).toThrow(/extra: \[c\]/);
  });
});
