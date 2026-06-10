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
  ForbiddenException,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import type { Activity } from "../assessment-collection/domain/activity";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PersonService } from "../user/person.service";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluateActivitiesDto } from "./dto/evaluate-activities.dto";
import { PeriodBridgeDto } from "./dto/period-bridge.dto";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationResultPersistService,
  type PersistMode,
} from "./evaluation-result-persist.service";
import { PeriodBridgeEphemeralService } from "./period-bridge-ephemeral.service";

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
    // PeriodBridgeEphemeralService — POST /period 의 위임 대상(T-0317, ADR-0037
    // §Decision1 User self-only ephemeral). 같은 module(assessment-evaluation.
    // module.ts)이 이미 provider/export 등록(T-0316)이라 추가 token 0. test 는
    // jest mock { generateEphemeral } 를 주입해 실 LLM/DB/네트워크 0 으로 위임 정합만 검증.
    private readonly ephemeralBridge: PeriodBridgeEphemeralService,
    // PersonService — personId → resolved person(serviceIdentities) 변환 재사용
    // (T-0317, UserModule export). findByIdWithIdentities 가 row 부재 시
    // NotFoundException(404)을 전파하므로 controller 의 존재 검증 분기 0. test 는
    // mock { findByIdWithIdentities } 주입.
    private readonly personService: PersonService,
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

  // POST /api/assessment-evaluation/period — User self-only ephemeral 평가
  // (T-0317, ADR-0037 §Decision1 User self-only ephemeral + §Decision4 fresh
  // in-memory collect). 인증된 User 가 **자기 자신**의 임의 기간 평가문을 요청하면
  // PeriodBridgeEphemeralService.generateEphemeral 에 위임해 EvaluationResult[] 를
  // **DB write 0**(persist 호출 0)로 200 응답한다(README R-9 / PLAN P5 L98 User 경로).
  //
  // 본 endpoint 의 범위(ADR-0037 §Decision1/4 FIRM 부분만):
  //   - Admin full-persist 경로(§Decision2 double-write / §Decision3 idempotency)는
  //     PROPOSE 상태라 본 endpoint 가 일절 baking 하지 않는다 — persist 호출·영속 식별자
  //     반환·mode 분기 0. dto.mode 는 ephemeral 이므로 무시한다.
  //   - smoke/e2e(실 PostgreSQL round-trip + User ephemeral DB-write-0 검증)는
  //     ADR-0037 slice 5 후속.
  //
  // RBAC + self-only(fail-closed):
  //   - @UseGuards(JwtAuthGuard, RolesGuard) + @Roles("User") — User+ escalation
  //     (User/Admin/SuperAdmin 통과, 인증 부재 → 401, tier 미달은 없음). 기존 auth
  //     infra 재사용만(새 guard/decorator/role 의미 변경 0, task §Out of Scope).
  //   - self-only 강제: @CurrentUser("sub") 의 principal userId 가 dto.personId 와
  //     **일치할 때만** 진행. principal sub 이 undefined/null 이거나 personId 와
  //     불일치하면 ForbiddenException(403) — 타인 평가문 요청 차단(fail-closed deny).
  //     이 분기에서는 generateEphemeral 위임 미수행(이른 차단).
  //
  // 위임 배선:
  //   - personId → resolved person 변환은 PersonService.findByIdWithIdentities 재사용
  //     (row 부재 시 그 service 가 NotFoundException(404) 전파 — controller 추가 분기 0).
  //   - resolved person 의 serviceIdentities 를 { serviceIdentities } 로 조립해
  //     generateEphemeral(person, { since }, options) 에 위임하고 반환 EvaluationResult[]
  //     를 가공 0 으로 그대로 200 응답한다(persist 호출 0).
  //   - since 는 dto.periodStart pass-through(도출 0 — SinceDerivationService 도출은
  //     Admin/collection 책임, task §Out of Scope). options.modelId 는 본 ephemeral
  //     slice 가 model 선택 입력을 받지 않으므로 미지정(undefined) 으로 전달 — 평가
  //     정책 차원의 modelId 배선은 후속 slice. service-layer error 는 raw 전파(swallow 0).
  @Post("period")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async period(
    @Body() dto: PeriodBridgeDto,
    @CurrentUser("sub") principalUserId: string | undefined,
  ): Promise<EvaluationResult[]> {
    // self-only 강제(fail-closed) — principal sub 이 부재(undefined/null)거나
    // dto.personId 와 불일치하면 진행 전 차단(타인 평가문 요청 거부). generateEphemeral
    // 위임은 이 검사 통과 후에만 수행된다.
    if (
      principalUserId === undefined ||
      principalUserId === null ||
      principalUserId !== dto.personId
    ) {
      throw new ForbiddenException(
        "self-only: 본인(personId == principal sub)의 평가만 요청할 수 있다",
      );
    }

    // personId → resolved person 변환 재사용 — row 부재 시 PersonService 가
    // NotFoundException(404)을 전파한다(controller 추가 분기 0).
    const person = await this.personService.findByIdWithIdentities(
      dto.personId,
    );

    // resolved person 의 serviceIdentities 만 조립해 ephemeral bridge 에 위임.
    // periodStart 는 since 로 pass-through(도출 0). modelId 는 본 slice 미지정.
    return this.ephemeralBridge.generateEphemeral(
      { serviceIdentities: person.serviceIdentities },
      { since: dto.periodStart },
      { modelId: undefined as unknown as string },
    );
  }
}
