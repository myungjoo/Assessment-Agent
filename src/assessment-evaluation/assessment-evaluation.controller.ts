// AssessmentEvaluationController — P5 평가 manual-trigger HTTP 진입점
// (T-0293, ADR-0032 §1/§Follow-ups). POST /api/assessment-evaluation/evaluate 가
// EvaluationOrchestratorService.evaluateActivities 에 위임해 "이미 수집된 `Activity[]` +
// scoring 옵션 → 평가 결과 목록" 의 최소 계약을 HTTP 로 노출한다(REQ-009, REQ-045 manual
// trigger 의 평가 쪽 mirror). 직전 slice T-0292 가 orchestrator 의 in-process 경로를 닫았
// 으나 HTTP caller 0 + AppModule 미등록 상태였고, 본 controller 가 그 빈자리를 채운다.
//
// 패턴 mirror — AssessmentCollectionController(T-0274, ADR-0031 §2):
//   - controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform):
//     정의 외 필드 → 400(forbidNonWhitelisted), decorator 위반(필수 누락 / wrong type /
//     nested 객체 위반) → 400, `EvaluateActivitiesDto` 의 class-transformer `@Type`
//     decorator 가 plain object → DTO 인스턴스로 transform.
//   - RBAC Admin+(JwtAuthGuard + RolesGuard + @Roles("Admin")): 인증 부재 → 401, tier 미달
//     → 403. 평가 trigger 는 비용 있는 LLM round-trip 연산이므로 collection trigger 와
//     동일하게 Admin+ 로 시작(R-9 사용자/Admin 허용은 후속 정책 결정 — task 의 Out of
//     Scope 정합).
//   - thin delegate: orchestration / dedup / scoring 재구현 0. controller 는 검증된 DTO 를
//     `{ modelId }` ScoringOptions 와 `activities` `Activity[]` 로 그대로 분해해
//     `orchestrator.evaluateActivities(...)` 에 forward 하고 반환 `EvaluationResult[]` 도
//     가공 0 으로 그대로 forward(분기 없음 — service-layer 가 매핑/dedup/scoring 책임).
//   - service-layer error 는 raw 전파(swallow 0) — orchestrator 가 throw 하면(scoreUnit
//     reject 전파 등) 그대로 NestJS 가 응답으로 매핑하게 둔다(ADR-0032 §2 실패 격리).
//
// 책임 경계(ADR-0032 §Follow-ups + 본 task Out of Scope 정합):
//   - period/personId → 수집 → `Activity[]` 변환 bridge 는 본 controller 밖. 본 endpoint
//     는 "이미 수집된 `Activity[]` 직접 수신" 계약만(R-9 사용자 지정 기간의 full 계약은
//     후속 bridge slice).
//   - 평가 결과 영속화 — T-0301(ADR-0033 §Follow-ups slice 4)이 본 controller 에
//     persist hook 을 배선했다. orchestrator 호출(in-memory 순수 compose, ADR-0032
//     계약 보존) 후 그 결과를 `EvaluationResultPersistService.persist` 에 넘겨 영속화
//     하고, 박제된 식별자(assessmentId / contributionCount)와 in-memory 결과를 함께
//     반환한다. context 4-tuple(personId/period/scope/periodStart, ADR-0033 §51)은
//     HTTP request body 가 소유하므로 controller 가 persist 진입의 조립 책임을 가진다.
//   - 일/주/월 aggregate 평가 / batch prompting — orchestrator 가 per-unit 만 cover.
//     집계 endpoint 는 후속 slice(ADR-0032 §2 batch 경계).
//   - e2e HTTP 통합 spec(supertest 실 부팅 + RBAC/Validation 통합 검증) — 후속 slice.
//     본 task 는 colocated controller unit(orchestrator mock)까지.
import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import type { Activity } from "../assessment-collection/domain/activity";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluateActivitiesDto } from "./dto/evaluate-activities.dto";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationResultPersistService,
  type PersistMode,
} from "./evaluation-result-persist.service";

// EvaluateResponse — POST /evaluate 반환 shape(ADR-0033 §Follow-ups slice 4 — "persists
// the result and returns the assessmentId / persisted identifiers"). 영속 식별자
// (assessmentId / contributionCount)와 in-memory 평가 결과(results)를 동시에 반환해
// caller 가 영속 row 참조와 즉시 결과 활용을 모두 할 수 있게 한다.
export interface EvaluateResponse {
  assessmentId: string;
  contributionCount: number;
  results: EvaluationResult[];
}

@Controller("api/assessment-evaluation")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AssessmentEvaluationController {
  // EvaluationOrchestratorService + EvaluationResultPersistService 를 생성자 주입 —
  // 둘 다 같은 module(assessment-evaluation.module.ts)의 기존 provider 라 추가 token /
  // module 배선 변경 0. test 는 jest mock { evaluateActivities } / { persist } 를 주입해
  // 실 LLM 호출 0 / 실 DB write 0 / 실 네트워크 0 / live credential 0 으로 배선 정합만
  // 검증한다.
  constructor(
    private readonly orchestrator: EvaluationOrchestratorService,
    private readonly persistService: EvaluationResultPersistService,
  ) {}

  // POST /api/assessment-evaluation/evaluate — 평가 manual trigger + persist.
  //   - 200 OK + { assessmentId, contributionCount, results }(영속 식별자 + in-memory
  //     결과 동시 반환 — ADR-0033 §Follow-ups slice 4).
  //   - controller-scope ValidationPipe + class-transformer 가 dto 를 인스턴스화하며
  //     nested `activities` 항목도 ActivityItemDto 로 transform 된다. orchestrator 는
  //     `Activity[]` 형식만 요구하므로 검증된 DTO 를 그대로 cast 해 위임한다.
  //   - 배선 순서: orchestrator(in-memory 순수 compose, ADR-0032 계약 보존) → persist
  //     (영속화). orchestrator reject 시 persist 미호출 + error 그대로 전파. persist
  //     reject(예: P2002 → ConflictException) 시에도 raw 전파(swallow 0) — NestJS 가
  //     ConflictException 을 409 로 매핑하게 둔다.
  @Post("evaluate")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async evaluate(
    @Body() dto: EvaluateActivitiesDto,
  ): Promise<EvaluateResponse> {
    // dto.activities 는 nested DTO 인스턴스 배열(class-transformer 결과)이지만 형식상
    // Activity union 의 필드 집합과 정합한다(externalId/sourceType/instanceKey/author/
    // timestamp/metadata + source-별 옵션 필드). orchestrator 는 `Activity[]` 시그니처를
    // 요구하므로 unknown 을 거쳐 cast(런타임 변환 0 — 동일 객체 forward).
    const activities = dto.activities as unknown as Activity[];
    const results = await this.orchestrator.evaluateActivities(activities, {
      modelId: dto.modelId,
    });

    // context 4-tuple 조립(ADR-0033 §51) — periodStart 만 string → Date 파싱, 나머지
    // 3 종은 그대로 전사. 허용 literal 값 검증은 persist service 책임(DTO 는 형식만).
    const context: EvaluationPersistContext = {
      personId: dto.personId,
      period: dto.period,
      scope: dto.scope,
      periodStart: new Date(dto.periodStart),
    };

    // mode 정규화(ADR-0033 §3) — DTO 는 string surface 라 union 으로 좁힌다. 명시적
    // "reeval" 만 reeval, 그 외(미지정 포함)는 기본값 "fill". 허용 외 값을 reeval 로
    // 오인하지 않도록 "fill" 쪽으로 안전 fallback 한다.
    const mode: PersistMode = dto.mode === "reeval" ? "reeval" : "fill";

    const persisted = await this.persistService.persist(context, results, mode);

    return {
      assessmentId: persisted.assessmentId,
      contributionCount: persisted.contributionCount,
      results,
    };
  }
}
