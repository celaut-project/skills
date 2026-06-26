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
import { loadSkills as apiLoadSkills, loadCoverages as apiLoadCoverages, loadBenchmarkCoverages as apiLoadBenchmarkCoverages, loadBenchmarks as apiLoadBenchmarks, loadResults as apiLoadResults, applySkillInheritance } from './api';
import { ApiError } from './types';
import { create_profile, create_opinion } from 'reputation-system';
import type { RPBox } from 'source-application';
import {
  SKILL_TYPE_ID,
  COVERAGE_TYPE_ID,
  BENCHMARK_TYPE_ID,
  RESULT_TYPE_ID
} from './api';

const LOCKED: boolean = true; // For now, we lock the boxes we create. This can be changed later if needed. Esto evita que los boxes puedan actualizarse, pues cada entidad puede ser referenciada por otra, y una actualización de una entidad modificaría su propio identificador (id de la caja), ademas de que no queremos que las entidades puedan ser modificadas una vez creadas, para mantener la integridad de la reputación.

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
    // `apiLoadSkills()` returns skills with EMPTY coverages/benchmarks — the
    // explorer query only yields the skill boxes themselves. mockDb, by
    // contrast, ships fully-populated skills (getDemoSkills). To reach parity
    // we hydrate each skill's direct relations (coverages, benchmarks, and the
    // results under each benchmark) before applying inheritance — otherwise
    // applySkillInheritance has nothing to merge and the UI sees empty skills.
    const skills = await apiLoadSkills();

    await Promise.all(
      skills.map(async (skill) => {
        const [coverages, benchmarks] = await Promise.all([
          apiLoadCoverages(skill.boxId),
          apiLoadBenchmarks(skill.boxId)
        ]);

        await Promise.all(
          benchmarks.map(async (benchmark) => {
            const [results, benchmarkCoverages] = await Promise.all([
              apiLoadResults(benchmark.id),
              apiLoadBenchmarkCoverages(benchmark.id)
            ]);
            benchmark.results = results;
            benchmark.coverages = benchmarkCoverages;
          })
        );

        skill.coverages = coverages;
        skill.benchmarks = benchmarks;
        skill.resultCount = benchmarks.reduce(
          (sum, benchmark) => sum + benchmark.results.length,
          0
        );
      })
    );

    // Now that direct relations are loaded, merge inherited coverages/benchmarks
    // from extended skills (same logic mockDb relies on).
    return applySkillInheritance(skills);
  }

  async loadCoverages(skillBoxId: string): Promise<Coverage[]> {
    return apiLoadCoverages(skillBoxId);
  }

  async loadBenchmarkCoverages(benchmarkId: string): Promise<Coverage[]> {
    return apiLoadBenchmarkCoverages(benchmarkId);
  }

  async loadBenchmarks(skillBoxId: string): Promise<Benchmark[]> {
    return apiLoadBenchmarks(skillBoxId);
  }

  async loadResults(benchmarkId: string): Promise<Result[]> {
    return apiLoadResults(benchmarkId);
  }

  async createSkill(input: SkillCreationInput): Promise<string> {
    // Nota: create_opinion suele requerir un tokenAmount (usamos reputationSupply o 1 por defecto)
    // y, opcionalmente, un objeto al que hace referencia. Si es una habilidad raíz, se suele apuntar a sí misma o usar un ID vacío.
    const txId = await create_opinion(
      'https://api.ergoplatform.com',
      input.tokenAmount ?? 1,
      SKILL_TYPE_ID,
      '', // ID del objetivo. Una skill no apunta a nada en concreto.
      true,
      {
        name: input.name,
        prose: input.prose,
        formal: input.formal ?? '',
        tags: input.tags,
        domain: input.domain,
        extended_skill_boxes: input.extendedSkillBoxIds,
        source_hash: input.sourceHash ?? null
      },
      LOCKED,
      // create_opinion requiere una RPBox. Si no viene en el input, se necesita una alternativa global o lanzar error.
      getMainBox((input as any).mainBox, 'skill')
    );

    if (!txId) {
      throw new ApiError('Failed to create skill on-chain.', 'CREATE_SKILL_FAILED');
    }

    return txId;
  }

  async createCoverage(input: CoverageCreationInput): Promise<string> {
    // A coverage may target either the skill (default) or one of its
    // benchmarks. When `benchmarkId` is set, the opinion points at the
    // benchmark box and records the benchmark id in its payload.
    const targetBenchmark = !!input.benchmarkId;
    const objectPointer = targetBenchmark ? input.benchmarkId! : input.skillBoxId;
    const txId = await create_opinion(
      'https://api.ergoplatform.com',
      input.tokenAmount ?? 1,
      COVERAGE_TYPE_ID,
      objectPointer,
      true,
      {
        skill_box_id: input.skillBoxId,
        benchmark_id: input.benchmarkId ?? null,
        service_id: input.serviceId ?? null
      },
      LOCKED,
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
        case_descriptors: input.caseDescriptors.map((d) => ({
          name: d.name,
          description: d.description
        })),
        // Emit the canonical snake_case `higher_is_better` declared by the
        // benchmark Type-NFT schema so external tooling (and our own reader)
        // resolve the metric direction instead of seeing `undefined`.
        performance_metrics: input.performanceMetrics.map((m) => ({
          name: m.name,
          description: m.description,
          higher_is_better: m.higherIsBetter
        })),
        source_hash: input.sourceHash ?? null
      },
      LOCKED,
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
        // The performance tensor: an array of CaseExecutionData, each with
        // caseMeta (positional to caseDescriptors) and metricsValues
        // (positional to performanceMetrics).
        data: input.data.map((c) => ({
          case_meta: c.caseMeta,
          metrics_values: c.metricsValues
        })),
        notes: input.notes,
        timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
        source_hash: input.sourceHash ?? null
      },
      LOCKED,
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
