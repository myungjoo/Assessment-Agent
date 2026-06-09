// EvaluationResultPersistService — ADR-0033 §Follow-ups 3번째 slice (write service).
// T-0299 의 순수 매퍼 `mapEvaluationResultsToAssessment` 출력을 실제 PostgreSQL 에
// 영속화한다. 평가 layer (`assessment-evaluation`) 가 persist hook 을 소유하고 `user`
// 영속 module 의 entity (Assessment / Contribution) 를 PrismaService `$transaction`
// delegate 로 직접 nested create / delete 한다 (ADR-0033 §Cross-Module Impact —
// 평가 layer 가 persist hook 소유, repository 변경 0 / 새 메서드 발명 0).
//
// 책임 (ADR-0033 §3):
//   - reset-and-recreate semantics: idempotency key `(personId, period, scope,
//     periodStart)` 의 기존 Assessment 를 findUnique 로 확인 → 모드별 분기 → 단일
//     `$transaction` 안에서 delete(if exists)+create 로 atomicity 보장 (부분 실패 시
//     이전 평가 유실 방지).
//   - fill 모드: 동일 key 존재 시 no-op (중복 row 0, 기존 보존), 부재 시 create.
//     재실행 idempotent (row 수 불변).
//   - reeval 모드: 동일 key 존재 시 delete (component Contribution 은 schema
//     `onDelete: Cascade` 동반 삭제) → 새 Assessment+Contribution create. 부재 시 create.
//   - partial-reset (`resetByPeriod`): 한 person 의 한 period Assessment 만 일괄 삭제,
//     다른 period/scope 보존 (`@@index([personId, period, periodStart])` leading-edge 정합).
//   - P2002 → ConflictException 변환: reset-and-recreate 경합 등으로 `@@unique` 위반
//     P2002 발생 시 assessment.service.ts 의 `getPrismaErrorCode` precedent 재사용.
//
// Out of Scope (ADR-0033 §Follow-ups slice 4/5):
//   - orchestrator/controller persist-return wiring / Summary write / data-model.md sync.
//   - 매퍼 매핑 로직 변경 — NIT(a)/(b) 는 본 service layer 에서 정책 결정 (매퍼는 순수
//     함수로 보존).
import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";
import {
  VALID_DIFFICULTIES,
  VALID_PERIODS,
  VALID_SCOPES,
} from "../user/assessment.service";

import type { EvaluationResult } from "./domain/evaluation-result";
import {
  mapEvaluationResultsToAssessment,
  type EvaluationPersistContext,
  type MappedAssessment,
} from "./domain/evaluation-result.persist.mapper";

// 영속화 모드 — ADR-0033 §3. `"fill"` = 평가 없는 부분만 채움 (존재 시 no-op),
// `"reeval"` = 강제 재평가 (존재 시 reset-and-recreate).
export type PersistMode = "fill" | "reeval";

// persist 결과 — 박제된 Assessment id + 그 component Contribution 수.
export interface PersistResult {
  assessmentId: string;
  contributionCount: number;
}

// CONTRIBUTION_SCORE_DECIMAL_PLACES — NIT(b) Decimal precision/rounding 정책.
// 매퍼의 평균 score 는 float (`scoreSum / length`) 이라 1/3 같은 나눗셈에서 무한
// 소수가 발생할 수 있다. Prisma `Decimal` 컬럼으로 흘려보내기 전에 본 service 가
// **소수 2 자리로 round** 해 결정적 정밀도를 박제한다 (REQ-036 상대 비교 의미는 등간격
// ordinal 0~3 의 평균이라 2 자리면 충분히 구분 가능). round 책임을 Prisma Decimal 변환에
// 암묵 위임하지 않고 service 가 명시적으로 가진다 — reviewer 가 정책을 catch 가능하도록.
const CONTRIBUTION_SCORE_DECIMAL_PLACES = 2;

// Prisma known error code 식별 — assessment.service.ts 의 동일 helper 재사용 정책
// (duck typing, runtime 의존 미증가). 본 slice 가 별도 util 추출 0 (Out of Scope —
// 공용화는 별도 refactor follow-up, assessment.service.ts 주석 정합).
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

// roundScore — NIT(b) 정책 구현. 소수 N 자리 반올림 (Number.EPSILON 보정으로 1.005
// 류 부동소수 경계 안정화). 빈 입력 시 매퍼가 0 을 주므로 round(0)=0 결정적.
function roundScore(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// PrismaTransactionClient — `$transaction` 콜백이 받는 delegate 의 최소 surface.
// Assessment create/delete/findUnique + Contribution create 만 사용 (nested create
// 가능하므로 contribution 은 Assessment create 의 nested data 로 주입).
type PrismaTransactionClient = Pick<Prisma.TransactionClient, "assessment">;

@Injectable()
export class EvaluationResultPersistService {
  constructor(private readonly prisma: PrismaService) {}

  // persist — ADR-0033 §3 reset-and-recreate 진입점. 매퍼로 MappedAssessment 를 얻고
  // (NIT(a)/(b) 정책 적용), 모드별 분기 후 단일 `$transaction` 으로 영속화한다.
  //
  // 흐름:
  //   1. 매퍼 호출 → MappedAssessment { assessment, contributions }.
  //   2. NIT(a): assessment.difficulty / scope 유효성 검증 (invalid 면 명시적 throw —
  //      매퍼의 silent skip 비대칭을 service 진입에서 닫는다).
  //   3. NIT(b): contributionScore 를 Decimal 정밀도 정책으로 round.
  //   4. $transaction 안에서 findUnique → 모드 분기 (fill: 존재 no-op / reeval:
  //      존재 delete) → nested create.
  //   5. P2002 → ConflictException 변환, 그 외 error 는 그대로 propagate.
  async persist(
    context: EvaluationPersistContext,
    results: EvaluationResult[],
    mode: PersistMode,
  ): Promise<PersistResult> {
    const mapped = mapEvaluationResultsToAssessment(context, results);
    // NIT(a) — difficulty unknown 값 정책: 매퍼의 aggregateDifficulty 는 알 수 없는
    // difficulty 를 silent skip (contribution guard 가 throw 하는 것과 비대칭) 한다.
    // 본 service 진입 시점에 aggregate difficulty / scope 의 enum-as-String literal
    // 유효성을 명시적으로 검증해 invalid 면 throw — 비대칭을 service layer 에서 닫는다
    // (AssessmentService.create 의 literal 검증 precedent 정합).
    this.assertValidAggregate(mapped);
    const normalized = this.normalizeScores(mapped);

    try {
      return await this.prisma.$transaction(async (tx) => {
        return this.persistInTransaction(
          tx as PrismaTransactionClient,
          context,
          normalized,
          mode,
        );
      });
    } catch (error) {
      // P2002 (`@@unique` 위반 — reset-and-recreate 경합 등) 만 ConflictException 으로
      // 변환. 그 외 Prisma error (P2025 / P2003 / unknown) 는 잘못 삼키지 않고 propagate.
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          `평가 결과가 이미 존재한다: personId=${context.personId} period=${context.period} scope=${context.scope}`,
        );
      }
      throw error;
    }
  }

  // resetByPeriod — ADR-0033 §3 partial-reset. 한 person 의 한 period 에 속한 모든
  // Assessment 를 일괄 삭제 (component Contribution 은 `onDelete: Cascade` 동반 삭제).
  // 다른 period / scope 의 Assessment 는 건드리지 않는다 — `@@index([personId, period,
  // periodStart])` leading-edge 정합으로 효율적 부분 삭제. 삭제된 row 수를 반환.
  async resetByPeriod(personId: string, period: string): Promise<number> {
    this.assertValidPeriod(period);
    const result = await this.prisma.assessment.deleteMany({
      where: { personId, period },
    });
    return result.count;
  }

  // persistInTransaction — $transaction 콜백 내부 로직. 모드 분기 + nested create.
  private async persistInTransaction(
    tx: PrismaTransactionClient,
    context: EvaluationPersistContext,
    mapped: MappedAssessment,
    mode: PersistMode,
  ): Promise<PersistResult> {
    const existing = await tx.assessment.findUnique({
      where: {
        personId_period_scope_periodStart: {
          personId: context.personId,
          period: context.period,
          scope: context.scope,
          periodStart: context.periodStart,
        },
      },
      select: { id: true },
    });

    if (existing !== null) {
      // fill 모드: 이미 존재하면 no-op (기존 보존, 중복 row 0, 재실행 idempotent).
      if (mode === "fill") {
        return {
          assessmentId: existing.id,
          contributionCount: 0,
        };
      }
      // reeval 모드: 기존 Assessment 를 delete (component Contribution 은 cascade
      // 동반 삭제) — 이후 아래에서 새로 create.
      await tx.assessment.delete({ where: { id: existing.id } });
    }

    return this.createAssessment(tx, mapped);
  }

  // createAssessment — Assessment(1) + component Contribution[](N) 를 nested create.
  // 매퍼 출력의 contributions 는 assessmentId 미포함 (`ContributionCreateInput
  // WithoutAssessment`) 이므로 nested `contributions.create` 로 주입 — FK 를 service 가
  // 수동 채우지 않고 Prisma nested write 가 자동 연결 (트랜잭션 일관성).
  private async createAssessment(
    tx: PrismaTransactionClient,
    mapped: MappedAssessment,
  ): Promise<PersistResult> {
    const created = await tx.assessment.create({
      data: {
        ...mapped.assessment,
        contributions: {
          create: mapped.contributions,
        },
      },
      select: { id: true },
    });
    return {
      assessmentId: created.id,
      contributionCount: mapped.contributions.length,
    };
  }

  // normalizeScores — NIT(b) Decimal 정책 적용. aggregate Assessment + 각 Contribution
  // 의 contributionScore 를 소수 2 자리로 round 한 새 MappedAssessment 를 반환 (입력
  // mutate 0 — 매퍼 순수성 보존). number 타입은 Prisma Decimal input 이 accept.
  private normalizeScores(mapped: MappedAssessment): MappedAssessment {
    return {
      assessment: {
        ...mapped.assessment,
        contributionScore: roundScore(
          mapped.assessment.contributionScore as number,
          CONTRIBUTION_SCORE_DECIMAL_PLACES,
        ),
      },
      contributions: mapped.contributions.map((c) => ({
        ...c,
        contributionScore: roundScore(
          c.contributionScore as number,
          CONTRIBUTION_SCORE_DECIMAL_PLACES,
        ),
      })),
    };
  }

  // assertValidAggregate — NIT(a) 정책. 매퍼의 `aggregateDifficulty` 는 알 수 없는
  // difficulty 를 silent skip (DIFFICULTY_ORDER lookup 이 undefined → 비교 false →
  // 기본값 "easy" 유지) 한다 — contribution guard 가 throw 하는 것과 비대칭. 따라서
  // aggregate 결과만 검증하면 unknown 이 "easy" 로 흡수돼 통과해 버린다. 비대칭을
  // 실제로 닫으려면 **component Contribution 각각의 difficulty** (매퍼가 1:1 전사한
  // EvaluationResult.difficulty) 를 검증해야 한다. invalid 면 명시적 throw — 영속화
  // 진입 전에 차단 (AssessmentService.create 의 literal 검증 precedent 정합). scope 는
  // context 4-tuple 의 enum-as-String 이라 함께 검증.
  private assertValidAggregate(mapped: MappedAssessment): void {
    const { scope } = mapped.assessment;
    if (!(VALID_SCOPES as readonly string[]).includes(scope)) {
      throw new Error(
        `알 수 없는 scope 값: "${scope}" (허용: ${VALID_SCOPES.join("/")})`,
      );
    }
    for (const c of mapped.contributions) {
      if (!(VALID_DIFFICULTIES as readonly string[]).includes(c.difficulty)) {
        throw new Error(
          `알 수 없는 difficulty 값: "${c.difficulty}" (허용: ${VALID_DIFFICULTIES.join("/")})`,
        );
      }
    }
  }

  // assertValidPeriod — partial-reset 의 period literal 검증 (AssessmentService 정합,
  // VALID_PERIODS single source 재사용).
  private assertValidPeriod(period: string): void {
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
      throw new Error(
        `알 수 없는 period 값: "${period}" (허용: ${VALID_PERIODS.join("/")})`,
      );
    }
  }
}
