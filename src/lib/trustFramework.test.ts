import { describe, it, expect } from 'vitest';
import {
  TrustLevel,
  AccessLevel,
  computeFrameworkScores,
  displayAverageRisk,
  encodeActionsForR9,
  AVERAGE_RISK_SCALE,
  type ActionAssessment
} from './trustFramework';

/**
 * These assertions define the golden values the ErgoScript in
 * `dependency_trust_framework.es` MUST reproduce on-chain. If you change the
 * scoring rule, change it in both places and update these numbers.
 */
describe('computeFrameworkScores (Sigmaverse Quality Standard)', () => {
  it('best case: fully trust-minimized + verifiable artifact', () => {
    const actions: ActionAssessment[] = [
      { name: 'create', trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { name: 'claim', trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact }
    ];
    const s = computeFrameworkScores(actions);
    expect(s.weakestLink).toBe(1);
    expect(s.averageRiskScaled).toBe(100); // mean level 1.00
    expect(displayAverageRisk(s)).toBe(1);
  });

  it('worst case: fiduciary + centralized service', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.Fiduciary, access: AccessLevel.CentralizedService }
    ];
    const s = computeFrameworkScores(actions);
    expect(s.weakestLink).toBe(3);
    // levels [3,2] → mean 2.5 → scaled 250
    expect(s.averageRiskScaled).toBe(250);
    expect(displayAverageRisk(s)).toBe(2.5);
  });

  it('weakest link tracks the single worst axis even if the rest are clean', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { trust: TrustLevel.TrustMinimized, access: AccessLevel.VerifiableArtifact },
      { trust: TrustLevel.Fiduciary, access: AccessLevel.VerifiableArtifact } // one bad action
    ];
    const s = computeFrameworkScores(actions);
    expect(s.weakestLink).toBe(3);
    // levels [1,1, 1,1, 3,1] = 8 over 6 → 133 (floor of 133.33)
    expect(s.averageRiskScaled).toBe(133);
  });

  it('average uses integer (floor) division, matching ErgoScript', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.CryptoEconomic, access: AccessLevel.VerifiableArtifact }, // [2,1]
      { trust: TrustLevel.CryptoEconomic, access: AccessLevel.CentralizedService } // [2,2]
    ];
    const s = computeFrameworkScores(actions);
    // levels sum 7 over 4 → 175
    expect(s.averageRiskScaled).toBe(175);
  });

  it('rejects an empty framework', () => {
    expect(() => computeFrameworkScores([])).toThrow();
  });
});

describe('encodeActionsForR9', () => {
  it('flattens to ordered (trust, access) pairs for the R9 register', () => {
    const actions: ActionAssessment[] = [
      { trust: TrustLevel.TrustMinimized, access: AccessLevel.CentralizedService },
      { trust: TrustLevel.Fiduciary, access: AccessLevel.VerifiableArtifact }
    ];
    expect(encodeActionsForR9(actions)).toEqual([
      [1, 2],
      [3, 1]
    ]);
  });
});

describe('AVERAGE_RISK_SCALE', () => {
  it('is the ×100 factor the ErgoScript uses', () => {
    expect(AVERAGE_RISK_SCALE).toBe(100);
  });
});
