/**
 * Real Ergo Explorer API data provider.
 * Wraps the existing API functions into the DataProvider interface.
 */

import type { DataProvider } from './dataProvider';
import type {
  Skill,
  Coverage,
  Benchmark,
  Result,
  SkillCreationInput,
  CoverageCreationInput,
  BenchmarkCreationInput,
  ResultCreationInput
} from './types';
import { loadSkills as apiLoadSkills, loadCoverages as apiLoadCoverages, loadBenchmarks as apiLoadBenchmarks, loadResults as apiLoadResults } from './api';
import { ApiError } from './types';
import { create_profile, create_opinion } from 'reputation-system';
import type { RPBox } from 'source-application';
import {
  SKILL_TYPE_ID,
  COVERAGE_TYPE_ID,
  BENCHMARK_TYPE_ID,
  RESULT_TYPE_ID
} from './api';

function getMainBox(inputMainBox: unknown, entityName: string): RPBox {
  if (!inputMainBox) {
    throw new ApiError(
      `A main reputation box is required to create ${entityName} on-chain.`,
      'MISSING_MAIN_BOX'
    );
  }

  return inputMainBox as RPBox;
}

class ErgoDataProvider implements DataProvider {
  async loadSkills(): Promise<Skill[]> {
    return apiLoadSkills();
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    return apiLoadCoverages(skillBoxId);
  }

  async loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
    return apiLoadBenchmarks(skillBoxId);
  }

  async loadResults(benchmarkId: string): Promise<Result[]> {
    return apiLoadResults(benchmarkId);
  }

  async createSkill(input: SkillCreationInput): Promise<string> {
    // Nota: create_opinion suele requerir un tokenAmount (usamos reputationSupply o 1 por defecto)
    // y una caja de reputación destino. Si es una habilidad raíz, se suele apuntar a sí misma o usar un ID vacío.
    const txId = await create_opinion(
      'https://ergoplatform.com',
      input.tokenAmount ?? 1,
      SKILL_TYPE_ID,
      '', // ID de la caja objetivo. Una skill no apunta a nada en concreto.
      true,
      {
        name: input.name,
        prose: input.prose,
        tags: input.tags,
        domain: input.domain,
        other_skill_box_ids: input.otherSkillBoxIds,
        source_hash: input.sourceHash ?? null,
        protocols: input.protocols ?? []
      },
      false,
      // create_opinion requiere una RPBox. Si no viene en el input, se necesita una alternativa global o lanzar error.
      getMainBox((input as any).mainBox, 'skill') 
    );

    if (!txId) {
      throw new ApiError('Failed to create skill on-chain.', 'CREATE_SKILL_FAILED');
    }

    return txId;
  }

  async createCoverage(input: CoverageCreationInput): Promise<string> {
    const txId = await create_opinion(
      'https://api.ergoplatform.com',
      input.tokenAmount ?? 1,
      COVERAGE_TYPE_ID,
      input.skillBoxId,
      true,
      {
        skill_box_id: input.skillBoxId,
        service_id: input.serviceId ?? null
      },
      false,
      getMainBox(input.mainBox, 'coverage')
    );

    if (!txId) {
      throw new ApiError('Failed to create coverage on-chain.', 'CREATE_COVERAGE_FAILED');
    }

    return txId;
  }

  async createBenchmark(input: BenchmarkCreationInput): Promise<string> {
    const txId = await create_opinion(
      'https://api.ergoplatform.com',
      input.tokenAmount ?? 1,
      BENCHMARK_TYPE_ID,
      input.skillBoxId,
      true,
      {
        skill_box_id: input.skillBoxId,
        name: input.name,
        description: input.description,
        metric: input.metric,
        higher_is_better: input.higherIsBetter,
        source_hash: input.sourceHash ?? null
      },
      true,
      getMainBox(input.mainBox, 'benchmark')
    );

    if (!txId) {
      throw new ApiError('Failed to create benchmark on-chain.', 'CREATE_BENCHMARK_FAILED');
    }

    return txId;
  }

  async createResult(input: ResultCreationInput): Promise<string> {
    const txId = await create_opinion(
      'https://api.ergoplatform.com',
      input.tokenAmount ?? 1,
      RESULT_TYPE_ID,
      input.benchmarkId,
      true,
      {
        benchmark_id: input.benchmarkId,
        service_id: input.serviceId,
        score: input.score,
        notes: input.notes,
        timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
        source_hash: input.sourceHash ?? null
      },
      false,
      getMainBox(input.mainBox, 'result')
    );

    if (!txId) {
      throw new ApiError('Failed to create result on-chain.', 'CREATE_RESULT_FAILED');
    }

    return txId;
  }
}

/** Singleton Ergo data provider instance. */
export const ergoProvider = new ErgoDataProvider();
