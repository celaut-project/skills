/**
 * Tests for the full network-definition + trust-framework creation flow
 * exercised by NetworkPage.svelte and ServicePage.svelte.
 *
 * Pure-function coverage only — network calls (loadStrictDefinitions, etc.)
 * require a live Ergo Explorer and are integration-tested separately.
 */
import { describe, it, expect } from 'vitest';
import {
  makeNetworkDefinition,
  encodeStrictDefinitionR9,
  decodeStrictDefinitionR9,
  isNetworkDefinition,
  assessNetwork,
  ConceptKind,
  type NetworkFormalSpec
} from './strictDefinition';
import {
  TrustLevel,
  AccessLevel,
  encodeFrameworkR9,
  decodeFrameworkR9,
  computeFrameworkScores
} from './trustFramework';
import { get } from 'svelte/store';
import {
  viewedNetworkId,
  viewedServiceId,
  networkPageReturn,
  serviceDataFormState
} from './stores';

// ── Shared fixtures ──────────────────────────────────────────────────────────
const SPEC: NetworkFormalSpec = {
  protocol: 'grpc/celaut-v1',
  peerDiscovery: 'environment_variable',
  actions: {
    'peer-discovery': 'Locate other peers on the domain.',
    'message-delivery': 'Deliver a message to a peer.',
    'service-launch': 'Request a peer to launch a service.'
  }
};
const ACTION_NAMES = Object.keys(SPEC.actions);

// ── Full creation flow: make → encode → decode → isNetwork ───────────────────
describe('network definition creation flow (NetworkPage path)', () => {
  it('produces a well-formed strict definition that survives R9 round-trip', () => {
    const def = makeNetworkDefinition('my-net', 'My network.', SPEC);
    const encoded = encodeStrictDefinitionR9(def);
    const decoded = decodeStrictDefinitionR9(encoded);

    expect(decoded.kind).toBe(ConceptKind.Network);
    expect(decoded.tag).toBe('network:my-net');
    expect(isNetworkDefinition(decoded)).toBe(true);
    expect(decoded.formal).toEqual(SPEC);
  });

  it('isNetworkDefinition returns false for a non-network kind', () => {
    const def = makeNetworkDefinition('my-net', 'My network.', SPEC);
    // isNetworkDefinition is a kind-check only; override kind to a different value
    const wrongKind = { ...def, kind: ConceptKind.Skill };
    expect(isNetworkDefinition(wrongKind as any)).toBe(false);
  });

  it('isNetworkDefinition guards access to .formal.actions', () => {
    const def = makeNetworkDefinition('my-net', 'My network.', SPEC);
    if (isNetworkDefinition(def)) {
      expect(def.formal.actions).toEqual(SPEC.actions);
      expect(Object.keys(def.formal.actions)).toEqual(ACTION_NAMES);
    } else {
      throw new Error('Expected isNetworkDefinition to be true');
    }
  });
});

// ── Trust framework: assessNetwork → encode → decode → scores ────────────────
describe('trust framework creation flow (NetworkPage trust-framework form)', () => {
  it('encodes and decodes a full framework for all declared actions', () => {
    const def = makeNetworkDefinition('my-net', 'My network.', SPEC);
    const levels = {
      'peer-discovery': { trust: TrustLevel.CryptoEconomic, access: AccessLevel.VerifiableArtifact },
      'message-delivery': { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      'service-launch': { trust: TrustLevel.Fiduciary, access: AccessLevel.CentralizedService }
    };
    const fw = assessNetwork(def, levels);
    const encoded = encodeFrameworkR9(fw.actions);
    const decoded = decodeFrameworkR9(encoded);

    expect(decoded.actions.map((a) => a.name)).toEqual(ACTION_NAMES);
    expect(decoded.actions[0].trust).toBe(TrustLevel.CryptoEconomic);
    expect(decoded.actions[2].access).toBe(AccessLevel.CentralizedService);
  });

  it('computeFrameworkScores reflects the selected trust/access levels', () => {
    const allTrustMinimized = ACTION_NAMES.map((name) => ({
      name,
      trust: TrustLevel.TrustMinimized,
      access: AccessLevel.VerifiableArtifact
    }));
    const scores = computeFrameworkScores(allTrustMinimized);
    expect(scores.weakestLink).toBe(1);
    expect(scores.averageRisk).toBe(1);
  });

  it('weakest-link reflects the worst action in a mixed set', () => {
    const mixed = [
      { name: 'peer-discovery', trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { name: 'service-launch', trust: TrustLevel.Fiduciary, access: AccessLevel.CentralizedService }
    ];
    const scores = computeFrameworkScores(mixed);
    expect(scores.weakestLink).toBe(3);
    expect(scores.averageRisk).toBeGreaterThan(1);
  });
});

// ── Stores: initial state and mutation ───────────────────────────────────────
describe('page navigation stores', () => {
  it('viewedNetworkId initialises null and can be set', () => {
    expect(get(viewedNetworkId)).toBeNull();
    viewedNetworkId.set('abc123');
    expect(get(viewedNetworkId)).toBe('abc123');
    viewedNetworkId.set(null);
  });

  it('viewedServiceId initialises null', () => {
    expect(get(viewedServiceId)).toBeNull();
  });

  it('networkPageReturn carries return-to-serviceForm type', () => {
    expect(get(networkPageReturn)).toBeNull();
    networkPageReturn.set({ type: 'serviceForm' });
    const ret = get(networkPageReturn);
    expect(ret?.type).toBe('serviceForm');
    networkPageReturn.set(null);
  });

  it('networkPageReturn carries return-to-service type with serviceId', () => {
    networkPageReturn.set({ type: 'service', serviceId: 'deadbeef' });
    const ret = get(networkPageReturn);
    expect(ret?.type).toBe('service');
    if (ret?.type === 'service') {
      expect(ret.serviceId).toBe('deadbeef');
    }
    networkPageReturn.set(null);
  });

  it('serviceDataFormState is null by default and accepts form state', () => {
    expect(get(serviceDataFormState)).toBeNull();
    serviceDataFormState.set({
      serviceId: 'abc',
      prose: 'My service',
      containerArchitecture: 'linux/amd64',
      apiSlots: [{ port: '8080', transport: ['tcp'], protocol: ['grpc'] }],
      networkItems: [{ type: 'inline', tags: ['network:my-net'] }],
      metadataJson: '{}',
      kind: 'data'
    });
    const state = get(serviceDataFormState);
    expect(state?.prose).toBe('My service');
    expect(state?.apiSlots[0].port).toBe('8080');
    expect(state?.networkItems[0]).toMatchObject({ type: 'inline' });
    serviceDataFormState.set(null);
  });
});
