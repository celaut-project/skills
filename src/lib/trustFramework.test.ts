import { describe, it, expect } from 'vitest';
import {
  TrustLevel,
  AccessLevel,
  computeFrameworkScores,
  encodeFrameworkR9,
  decodeFrameworkR9,
  type ActionAssessment
} from './trustFramework';

/**
 * Golden values for the OFF-CHAIN Sigmaverse score calculation. Anyone reading
 * a Dependency-and-Trust-Framework box's R9 structure must reproduce these.
 */
describe('computeFrameworkScores (Sigmaverse Quality Standard, off-chain)', () => {
  it('best case: fully trust-minimized + verifiable artifact', () => {
    const actions: ActionAssessment[] = [
      { name: 'create', trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { name: 'claim', trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact }
    ];
    expect(computeFrameworkScores(actions)).toEqual({ weakestLink: 1, averageRisk: 1 });
  });

  it('worst case: fiduciary + centralized service', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.Fiduciary, access: AccessLevel.CentralizedService }
    ];
    // levels [3,2] → max 3, mean 2.5
    expect(computeFrameworkScores(actions)).toEqual({ weakestLink: 3, averageRisk: 2.5 });
  });

  it('weakest link tracks the single worst axis even if the rest are clean', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { trust: TrustLevel.Fiduciary, access: AccessLevel.VerifiableArtifact } // one bad action
    ];
    // levels [1,1, 1,1, 3,1] = 8 over 6 → mean 1.33, max 3
    expect(computeFrameworkScores(actions)).toEqual({ weakestLink: 3, averageRisk: 1.33 });
  });

  it('rejects an empty framework', () => {
    expect(() => computeFrameworkScores([])).toThrow();
  });
});

describe('R9 raw_content round-trip', () => {
  it('encodes and decodes the action structure', () => {
    const actions: ActionAssessment[] = [
      { name: 'mint', trust: TrustLevel.TrustMinimized, access: AccessLevel.CentralizedService },
      { name: 'govern', trust: TrustLevel.Fiduciary, access: AccessLevel.VerifiableArtifact }
    ];
    const r9 = encodeFrameworkR9(actions);
    expect(typeof r9).toBe('string');
    expect(decodeFrameworkR9(r9).actions).toEqual(actions);
  });
});
