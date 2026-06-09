// SummaryPersistService — ADR-0035 §Follow-ups 의 aggregate 평가 write service slice
// (write service 분할 2/2). 첫 조각 T-0307 (`SummaryNarrativeService.generateBatch
// Narrative` — LLM 정성 narrative) + T-0306 (`aggregateMetricScore` — deterministic
// metricScore 순수 함수) 을 한 `(personId, period, periodStart)` 좌표에 대해 **결합**해
// `Summary` row 1 개를 **reset-and-recreate** 로 영속화한다. 평가 layer
// (`assessment-evaluation`) 가 persist hook 을 소유하고 `user` 영속 module 의 entity
// (Summary) 를 PrismaService `$transaction` delegate 로 직접 create / delete 한다
// (`EvaluationResultPersistService` (T-0300, ADR-0033) 의 mirror — 평가 layer 가 persist
// hook 소유, repository 변경 0 / 새 메서드 발명 0).
//
// 책임 (ADR-0035 §Decision 1 / §Decision 4):
//   - narrative = LLM 정성 batch (SummaryNarrativeService 위임) / metricScore =
//     deterministic field-level (`aggregateMetricScore` 순수 함수) 분리 결합.
//   - reset-and-recreate semantics: idempotency key `(personId, period, periodStart)`
//     의 기존 Summary 를 findUnique 로 확인 → 모드별 분기 → 단일 `$transaction` 안에서
//     delete(if exists)+create 로 atomicity 보장 (부분 실패 시 이전 요약 유실 방지).
//   - fill 모드: 동일 key 존재 시 no-op (중복 row 0, 기존 보존). 재실행 idempotent.
//   - reeval 모드: 동일 key 존재 시 delete → 새 Summary create. 부재 시 create.
//   - partial-reset (`resetByPeriod`): 한 person 의 한 period Summary 만 일괄 삭제,
//     다른 period 보존 (`@@index([personId, period, periodStart])` leading-edge 정합).
//   - P2002 → ConflictException 변환: reset-and-recreate 경합 등으로 `@@unique` 위반
//     P2002 발생 시 EvaluationResultPersistService 의 `getPrismaErrorCode` precedent 재사용.
//
// Out of Scope (ADR-0035 §Follow-ups / task Out of Scope):
//   - orchestrator / controller batch endpoint 배선 / `isPeriodEvaluable` 시점 게이트
//     호출 / period→collection→evaluate bridge / 영속 Contribution[] read 경로 /
//     live LLM 실 호출 / data-model.md doc-sync — 별도 후속 slice.
import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";
import { VALID_PERIODS } from "../user/assessment.service";

import type { EvaluationResult } from "./domain/evaluation-result";
import { aggregateMetricScore } from "./domain/summary-aggregate";
import type { SummaryBatchContext } from "./domain/summary-batch-prompt";
// 영속화 모드 enum — EvaluationResultPersistService 의 것을 그대로 import 재사용
// (새 enum 발명 0, `"fill"` no-op / `"reeval"` reset-and-recreate 의미 정합).
import type { PersistMode } from "./evaluation-result-persist.service";
import { SummaryNarrativeService } from "./summary-narrative.service";

// persist 결과 — 박제된 Summary id + 영속화 narrative / metricScore (caller 검증용).
export interface SummaryPersistResult {
  // 박제된 Summary row 의 id (fill no-op 시 기존 row id).
  summaryId: string;
  // 실제 write 가 일어났는지 — fill no-op 면 false (기존 보존), create 면 true.
  created: boolean;
}

// SummaryPersistOptions — narrative 생성에 쓸 LLM modelId 를 caller 가 주입.
// SummaryNarrativeService.generateBatchNarrative 의 `{ modelId }` source 와 정합.
// 좌표/묶음만으로는 어떤 LLM model 로 평가할지 도출할 수 없으므로 (modelId 는 입력이
// 아니라 평가 정책 차원의 선택), caller (상위 orchestrator) 가 본 옵션으로 넘긴다
// (ScoringOptions / SummaryNarrativeOptions 정합 — modelId 단일 필수 필드만 박제).
export interface SummaryPersistOptions {
  // 사용할 LLM model 식별자 — gateway 의 modelId 로 그대로 전달.
  modelId: string;
}

// Prisma known error code 식별 — EvaluationResultPersistService 의 동일 helper 재사용
// 정책 (duck typing, runtime 의존 미증가). 별도 util 추출 0 (Out of Scope — 공용화는
// 별도 refactor follow-up, EvaluationResultPersistService 주석 정합).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// PrismaTransactionClient — `$transaction` 콜백이 받는 delegate 의 최소 surface.
// Summary findUnique / create / delete 만 사용 (다른 delegate 미사용).
type PrismaTransactionClient = Pick<Prisma.TransactionClient, "summary">;

@Injectable()
export class SummaryPersistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaryNarrativeService: SummaryNarrativeService,
  ) {}

  // persistSummary — ADR-0035 §Decision 1/4 reset-and-recreate 진입점. 한 좌표에 대해
  // (1) `aggregateMetricScore` 로 deterministic metricScore 산출, (2) narrative service
  // 위임으로 LLM narrative 생성, (3) 단일 `$transaction` 안에서 reset-and-recreate 로
  // Summary row 1 개 write.
  //
  // 흐름:
  //   1. metricScore = aggregateMetricScore(results) — deterministic, 빈 입력 0.
  //   2. narrative = summaryNarrativeService.generateBatchNarrative(...) — reject 전파
  //      (swallow 0 — narrative 실패가 fallback 으로 위장되지 않게 함, §Decision 1).
  //   3. $transaction 안에서 findUnique → 모드 분기 (fill: 존재 no-op / reeval: 존재
  //      delete) → create.
  //   4. P2002 → ConflictException 변환, 그 외 error 는 그대로 propagate.
  async persistSummary(
    context: SummaryBatchContext,
    results: EvaluationResult[],
    mode: PersistMode,
    options: SummaryPersistOptions,
  ): Promise<SummaryPersistResult> {
    // (1) deterministic metricScore — 빈 묶음이어도 결정적 0 (div-by-zero 방어).
    const metricScore = aggregateMetricScore(results);

    // (2) LLM narrative — reject 는 전파 (swallow 0). metricScore 산출 후 호출해
    //     narrative 실패 시 불필요한 집계 재계산이 없도록 한다 (순서는 무관, 둘 다 순수/
    //     위임이라 부수효과 없음).
    const narrative = await this.summaryNarrativeService.generateBatchNarrative(
      context,
      results,
      { modelId: options.modelId },
    );

    // (3) reset-and-recreate write.
    try {
      return await this.prisma.$transaction(async (tx) => {
        return this.persistInTransaction(
          tx as PrismaTransactionClient,
          context,
          narrative,
          metricScore,
          mode,
        );
      });
    } catch (error) {
      // P2002 (`@@unique([personId, period, periodStart])` 위반 — reset-and-recreate
      // 경합 등) 만 ConflictException 으로 변환. 그 외 Prisma error (P2025 / P2003 /
      // unknown) 는 잘못 삼키지 않고 propagate.
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          `요약 평가가 이미 존재한다: personId=${context.personId} period=${context.period} periodStart=${context.periodStart.toISOString()}`,
        );
      }
      throw error;
    }
  }

  // resetByPeriod — ADR-0035 §Decision 4 partial-reset. 한 person 의 한 period 에
  // 속한 모든 Summary 를 일괄 삭제. 다른 period 의 Summary 는 건드리지 않는다 —
  // `@@index([personId, period, periodStart])` leading-edge 정합으로 효율적 부분 삭제.
  // 삭제된 row 수를 반환. period literal 은 VALID_PERIODS 로 검증 (오삭제 방지).
  async resetByPeriod(personId: string, period: string): Promise<number> {
    this.assertValidPeriod(period);
    const result = await this.prisma.summary.deleteMany({
      where: { personId, period },
    });
    return result.count;
  }

  // persistInTransaction — $transaction 콜백 내부 로직. 모드 분기 + create.
  private async persistInTransaction(
    tx: PrismaTransactionClient,
    context: SummaryBatchContext,
    narrative: string,
    metricScore: number,
    mode: PersistMode,
  ): Promise<SummaryPersistResult> {
    const existing = await tx.summary.findUnique({
      where: {
        personId_period_periodStart: {
          personId: context.personId,
          period: context.period,
          periodStart: context.periodStart,
        },
      },
      select: { id: true },
    });

    if (existing !== null) {
      // fill 모드: 이미 존재하면 no-op (기존 보존, 중복 row 0, 재실행 idempotent).
      if (mode === "fill") {
        return { summaryId: existing.id, created: false };
      }
      // reeval 모드: 기존 Summary 를 delete → 이후 아래에서 새로 create.
      await tx.summary.delete({ where: { id: existing.id } });
    }

    return this.createSummary(tx, context, narrative, metricScore);
  }

  // createSummary — Summary row 1 개를 create. narrative (LLM) + metricScore
  // (deterministic) 를 idempotency 좌표와 함께 영속화. metricScore 는 number 라 Prisma
  // 가 Decimal 컬럼 입력 시 내부 변환한다 (summary.repository.ts SummaryCreateInput 정합).
  private async createSummary(
    tx: PrismaTransactionClient,
    context: SummaryBatchContext,
    narrative: string,
    metricScore: number,
  ): Promise<SummaryPersistResult> {
    const created = await tx.summary.create({
      data: {
        personId: context.personId,
        period: context.period,
        periodStart: context.periodStart,
        narrative,
        metricScore,
      },
      select: { id: true },
    });
    return { summaryId: created.id, created: true };
  }

  // assertValidPeriod — partial-reset 의 period literal 검증 (AssessmentService 정합,
  // VALID_PERIODS single source 재사용 — EvaluationResultPersistService mirror).
  private assertValidPeriod(period: string): void {
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
      throw new Error(
        `알 수 없는 period 값: "${period}" (허용: ${VALID_PERIODS.join("/")})`,
      );
    }
  }
}
