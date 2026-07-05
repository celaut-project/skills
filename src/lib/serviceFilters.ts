/**
 * Skill-detail service filtering.
 *
 * On a skill's detail page each covered service lazily publishes its on-chain
 * Service Data / Service Metadata (see ServiceInfoCard). As those land they are
 * registered here, so a filter bar can offer facets — no-networks, architecture,
 * api/protocol — computed from the reputation-weighted top assertion of each
 * service, and the coverage list can hide services that don't match.
 *
 * Loading is never blocking: a service whose info hasn't arrived yet counts as a
 * match (stays visible with its own loading indicator) so the user is never
 * forced to wait for the data to download.
 */
import { writable, derived } from 'svelte/store';
import type { ServiceData, ServiceMetadata } from './types';

export interface ServiceInfoEntry {
  data: ServiceData[];
  metadata: ServiceMetadata[];
  loading: boolean;
}

export interface ServiceFilters {
  /** Only services that declare NO network requirements. */
  noNetworks: boolean;
  /** Exact architecture match (e.g. `linux/amd64`), or null for any. */
  architecture: string | null;
  /** Service exposes this api protocol (e.g. `http`), or null for any. */
  protocol: string | null;
}

export const emptyFilters = (): ServiceFilters => ({
  noNetworks: false,
  architecture: null,
  protocol: null
});

/** Registry of loaded service info, keyed by service id. */
export const serviceInfoRegistry = writable<Record<string, ServiceInfoEntry>>({});

/** The active skill-detail filters. */
export const serviceFilters = writable<ServiceFilters>(emptyFilters());

export function registerServiceInfo(serviceId: string, entry: ServiceInfoEntry): void {
  if (!serviceId) return;
  serviceInfoRegistry.update((m) => ({ ...m, [serviceId]: entry }));
}

/** Reset the registry + filters — call when switching to a different skill. */
export function resetServiceInfo(): void {
  serviceInfoRegistry.set({});
  serviceFilters.set(emptyFilters());
}

/** Highest-reputation assertion in a list (competing opinions weighted by rep). */
export function topByReputation<T extends { reputation?: number }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))[0];
}

function asArray(v: unknown): any[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/** Distinct api protocols declared by a service's data (from api slots). */
export function protocolsOf(d?: ServiceData): string[] {
  const set = new Set<string>();
  for (const slot of asArray(d?.api)) {
    if (slot && typeof slot === 'object' && Array.isArray((slot as any).protocol)) {
      for (const p of (slot as any).protocol) set.add(String(p));
    }
  }
  return [...set];
}

/** True when the service declares any network requirement. */
export function hasNetworks(d?: ServiceData): boolean {
  return asArray(d?.network).length > 0;
}

/** Facet options across all currently-loaded services. */
export const filterOptions = derived(serviceInfoRegistry, ($reg) => {
  const architectures = new Set<string>();
  const protocols = new Set<string>();
  for (const entry of Object.values($reg)) {
    const d = topByReputation(entry.data);
    if (d?.architecture) architectures.add(d.architecture);
    for (const p of protocolsOf(d)) protocols.add(p);
  }
  return {
    architectures: [...architectures].sort(),
    protocols: [...protocols].sort()
  };
});

/** True while at least one registered service is still loading its info. */
export const anyServiceLoading = derived(serviceInfoRegistry, ($reg) =>
  Object.values($reg).some((e) => e.loading)
);

export function filtersActive(f: ServiceFilters): boolean {
  return f.noNetworks || !!f.architecture || !!f.protocol;
}

/**
 * Does a service match the active filters? A service whose info is unknown or
 * still loading returns `true` (kept visible), so filtering never blocks on the
 * lazy download.
 */
export function serviceMatches(
  serviceId: string | undefined,
  reg: Record<string, ServiceInfoEntry>,
  f: ServiceFilters
): boolean {
  if (!filtersActive(f)) return true;
  if (!serviceId) return true;
  const entry = reg[serviceId];
  if (!entry || entry.loading) return true; // still loading → don't hide yet
  const d = topByReputation(entry.data);
  if (f.noNetworks && hasNetworks(d)) return false;
  if (f.architecture && d?.architecture !== f.architecture) return false;
  if (f.protocol && !protocolsOf(d).includes(f.protocol)) return false;
  return true;
}
