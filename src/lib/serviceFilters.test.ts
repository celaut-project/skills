import { describe, it, expect } from 'vitest';
import {
  serviceMatches,
  protocolsOf,
  hasNetworks,
  topByReputation,
  emptyFilters,
  filtersActive,
  type ServiceInfoEntry
} from './serviceFilters';
import type { ServiceData } from './types';

const data = (over: Partial<ServiceData> = {}): ServiceData => ({
  boxId: 'b',
  profileId: 'p',
  serviceId: 's',
  mode: 'inline',
  reputation: 0,
  ...over
});

const entry = (data: ServiceData[], loading = false): ServiceInfoEntry => ({
  data,
  metadata: [],
  loading
});

describe('serviceFilters predicates', () => {
  it('protocolsOf pulls distinct protocols from api slots', () => {
    const d = data({ api: [{ port: 8080, protocol: ['http', 'http'] }, { port: 9090, protocol: ['grpc'] }] });
    expect(protocolsOf(d).sort()).toEqual(['grpc', 'http']);
  });

  it('hasNetworks reflects the network field', () => {
    expect(hasNetworks(data({ network: [{ tags: ['public'] }] }))).toBe(true);
    expect(hasNetworks(data({ network: [] }))).toBe(false);
    expect(hasNetworks(data({}))).toBe(false);
  });

  it('topByReputation returns the highest-reputation entry', () => {
    const a = data({ boxId: 'a', reputation: 3, architecture: 'linux/amd64' });
    const b = data({ boxId: 'b', reputation: 9, architecture: 'linux/arm64' });
    expect(topByReputation([a, b])?.architecture).toBe('linux/arm64');
  });
});

describe('serviceMatches', () => {
  const reg = {
    withNet: entry([data({ serviceId: 'withNet', network: [{ tags: ['public'] }], architecture: 'linux/amd64', api: [{ protocol: ['http'] }] })]),
    noNet: entry([data({ serviceId: 'noNet', network: [], architecture: 'linux/arm64', api: [{ protocol: ['grpc'] }] })]),
    loadingSvc: entry([], true)
  };

  it('no filters → everything matches', () => {
    expect(serviceMatches('withNet', reg, emptyFilters())).toBe(true);
  });

  it('noNetworks hides services that declare networks', () => {
    const f = { ...emptyFilters(), noNetworks: true };
    expect(serviceMatches('withNet', reg, f)).toBe(false);
    expect(serviceMatches('noNet', reg, f)).toBe(true);
  });

  it('architecture filter matches exact', () => {
    const f = { ...emptyFilters(), architecture: 'linux/arm64' };
    expect(serviceMatches('withNet', reg, f)).toBe(false);
    expect(serviceMatches('noNet', reg, f)).toBe(true);
  });

  it('protocol filter matches api protocol', () => {
    const f = { ...emptyFilters(), protocol: 'grpc' };
    expect(serviceMatches('withNet', reg, f)).toBe(false);
    expect(serviceMatches('noNet', reg, f)).toBe(true);
  });

  it('still-loading or unknown services stay visible', () => {
    const f = { ...emptyFilters(), noNetworks: true };
    expect(serviceMatches('loadingSvc', reg, f)).toBe(true); // loading → keep
    expect(serviceMatches('unknownId', reg, f)).toBe(true); // unknown → keep
    expect(serviceMatches(undefined, reg, f)).toBe(true);
  });

  it('filtersActive detects any active facet', () => {
    expect(filtersActive(emptyFilters())).toBe(false);
    expect(filtersActive({ ...emptyFilters(), protocol: 'http' })).toBe(true);
  });
});
