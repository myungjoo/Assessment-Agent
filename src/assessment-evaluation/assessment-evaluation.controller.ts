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
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLE_HIERARCHY, RolesGuard } from "../auth/roles.guard";
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
import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";
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

// PeriodBridgeAdminResponse — POST /period 의 **Admin 분기** 반환 shape (ADR-0037
// slice 3, §Decision1 "평가 결과가 Assessment/Contribution 에 영속화돼 이후 조회의
// source"). User 분기가 ephemeral `EvaluationResult[]` 를 반환하는 것과 달리, Admin
// 분기는 영속화 후 **영속 Assessment 식별자/좌표** 를 반환해 caller 가 이후 조회의
// source row 를 참조하게 한다. role 별 body 차이를 박제:
//   - User 분기  → `EvaluationResult[]`(ephemeral, persist 호출 0, DB write 0).
//   - Admin 분기 → `PeriodBridgeAdminResponse`(영속 식별자 + 좌표 + created 플래그).
// 필드:
//   - assessmentId — 영속 Assessment 의 primary key(이후 조회 source).
//   - personId / period / scope — 영속 좌표(§Decision4 fresh collect 좌표 3 축).
//   - periodStart — 영속 좌표의 boundary 축(ISO-8601 string 으로 직렬화).
//   - created — 이번 호출이 좌표를 새로 create 했는지(true) / first-write-wins
//     read-through 로 기존 저장본을 반환했는지(false). amended §Decision3.
export interface PeriodBridgeAdminResponse {
  assessmentId: string;
  personId: string;
  period: string;
  scope: string;
  periodStart: string;
  created: boolean;
}

// isAdminRole — principal role 이 Admin tier 이상(Admin / SuperAdmin)인지 판별한다.
// role dispatch source: @CurrentUser() 의 JwtPayload.role(JwtStrategy.validate 가 박제).
// RolesGuard 의 ROLE_HIERARCHY 를 단일 source of truth 로 재사용한다 — `Admin` 등급의
// escalation 목록(["Admin","SuperAdmin"])에 principal role 이 포함되면 Admin 분기.
// 그 외(User / 미지정 / 알 수 없는 role)는 User 분기로 fall-through 한다. RolesGuard
// 가 이미 `@Roles("User")` 로 User+ escalation 을 통과시키므로, 여기서는 User 와
// Admin+ 를 가르는 dispatch 판별만 한다(인증/escalation 자체는 guard 책임).
function isAdminRole(role: string | undefined): boolean {
  if (role === undefined) {
    return false;
  }
  return ROLE_HIERARCHY.Admin.includes(role);
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
    // PeriodBridgeAdminPersistService — POST /period 의 **Admin 분기** 위임 대상
    // (T-0321, ADR-0037 §Decision1 Admin full-persist + amended §Decision3 first-
    // write-wins read-through). ephemeralBridge 의 sibling — 같은 module
    // (assessment-evaluation.module.ts)이 이미 provider/export 등록(T-0321)이라 추가
    // token 0. test 는 jest mock { generateAndPersist } 를 주입해 실 LLM/DB/네트워크 0
    // 으로 Admin 분기 위임 정합만 검증한다.
    private readonly adminBridge: PeriodBridgeAdminPersistService,
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

  // POST /api/assessment-evaluation/period — period bridge HTTP 진입점.
  // **role-branching**(ADR-0037 slice 3, §Decision1 Admin full-persist / User
  // self-only ephemeral + §Decision4 fresh in-memory collect). 같은 endpoint 가
  // principal role 에 따라 두 경로를 dispatch 한다:
  //   - User 분기  → PeriodBridgeEphemeralService.generateEphemeral 위임,
  //     `EvaluationResult[]` 를 **DB write 0**(persist 호출 0)로 반환(self-only 강제).
  //   - Admin 분기 → PeriodBridgeAdminPersistService.generateAndPersist 위임, 평가
  //     결과를 Assessment/Contribution 에 **영속화**하고 `PeriodBridgeAdminResponse`
  //     (영속 Assessment 식별자/좌표)를 반환(임의 personId 허용 — self-only 미적용).
  // README R-9(Admin·User 임의 기간 평가문 요청, PLAN P5 L98)의 마지막 backbone wire.
  //
  // === endpoint 접근 결정(같은 endpoint role-branching, task §결정 권장) ===
  // 별도 endpoint 가 아니라 **같은 `POST /period` 의 role 분기**를 택했다. 근거:
  //   (1) Admin·User 둘 다 같은 입력 계약(`PeriodBridgeDto`)·좌표 의미로 "임의 기간
  //       평가문 요청"을 수행한다 — 차이는 RBAC role 과 영속화 여부뿐(§Decision1).
  //       같은 resource·같은 동사이므로 REST 상 같은 endpoint 가 자연스럽다.
  //   (2) `@Roles("User")` escalation(ROLE_HIERARCHY)상 Admin/SuperAdmin 도 이
  //       endpoint 에 도달하므로, 도달한 principal 의 role 로 분기하면 하나의 route 가
  //       두 경로를 dispatch 한다.
  //
  // === role dispatch source / 방식 ===
  //   - dispatch source = @CurrentUser() 의 JwtPayload.role(JwtStrategy.validate 박제).
  //     isAdminRole(actor?.role) 이 Admin tier 이상(ROLE_HIERARCHY.Admin 재사용)이면
  //     Admin 분기, 그 외(User 포함)는 User 분기.
  //   - Admin 분기는 self-only 검사를 **우회**한다 — Admin 은 임의 personId 를 target
  //     할 수 있어야 하므로(§Decision1) `principal sub == personId` 동등성을 타지 않는다.
  //   - User 분기는 기존 self-only(fail-closed) 강제를 그대로 유지한다(회귀 0).
  //
  // === slice 3 / slice 4 경계(어디서 선을 긋나) ===
  //   - slice 3(본 slice) = role dispatch + Admin 위임 + 응답 shape + context 4-tuple
  //     조립. Admin 분기가 **새 self-only 로직 없이** role 판별 + 기존 guard + self-only
  //     검사 우회만으로 닫힌다(self-contained).
  //   - slice 4(DEFER) = Admin 임의-personId 허용 vs User self-only(personId 동등성)의
  //     정밀 RBAC guard 강화. 본 slice 는 그 정밀화를 추가하지 않는다 — User 분기는
  //     기존 controller-level self-only 를, Admin 분기는 self-only 미적용(우회)만.
  //     타인 personId User → 403 의 fail-closed 정밀화·principal 부재 deny 강화는
  //     slice 4 책임(task §Out of Scope).
  //   - smoke/e2e(Admin full-persist round-trip + first-write-wins read-through
  //     idempotency)는 ADR-0037 slice 5 후속.
  //
  // === 공통 위임 배선 ===
  //   - personId → resolved person 변환은 PersonService.findByIdWithIdentities 재사용
  //     (row 부재 시 그 service 가 NotFoundException(404) 전파 — controller 추가 분기 0).
  //   - since 는 dto.periodStart pass-through(도출 0 — task §Out of Scope). modelId 는
  //     본 slice 가 model 선택 입력을 받지 않으므로 미지정(undefined). service-layer
  //     error 는 raw 전파(swallow 0). dto.mode 는 Admin 분기에서 reeval 로 baking 하지
  //     않는다 — generateAndPersist 가 항상 "fill"(amended §Decision3, overwrite DEFERRED).
  @Post("period")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async period(
    @Body() dto: PeriodBridgeDto,
    @CurrentUser() actor: JwtPayload | undefined,
  ): Promise<EvaluationResult[] | PeriodBridgeAdminResponse> {
    // role dispatch — Admin tier 이상이면 full-persist 분기(임의 personId 허용),
    // 그 외(User 등)는 self-only ephemeral 분기. dispatch source 는 principal role.
    if (isAdminRole(actor?.role)) {
      return this.persistForAdmin(dto);
    }
    return this.ephemeralForUser(dto, actor?.sub);
  }

  // ephemeralForUser — User 분기(self-only ephemeral, T-0317 기존 동작 보존).
  // principal sub 이 dto.personId 와 일치할 때만 진행하고, ephemeral bridge 에 위임해
  // `EvaluationResult[]` 를 persist 호출 0(DB write 0)으로 반환한다.
  private async ephemeralForUser(
    dto: PeriodBridgeDto,
    principalUserId: string | undefined,
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

  // persistForAdmin — Admin 분기(full-persist, ADR-0037 §Decision1). self-only 우회
  // (임의 personId 허용). personId 를 resolve 한 뒤 context 4-tuple 을 조립해
  // generateAndPersist 에 위임하고, 영속 Assessment 식별자/좌표(`PeriodBridgeAdminResponse`)
  // 를 반환한다. dto.mode 는 reeval 로 baking 하지 않는다(service 가 항상 "fill").
  private async persistForAdmin(
    dto: PeriodBridgeDto,
  ): Promise<PeriodBridgeAdminResponse> {
    // personId → resolved person 변환 재사용 — Admin 은 임의 personId 를 target 할 수
    // 있으므로 self-only 동등성 검사 없이 바로 resolve(row 부재 시 PersonService 가
    // NotFoundException(404) 전파 — controller 추가 분기 0).
    const person = await this.personService.findByIdWithIdentities(
      dto.personId,
    );

    // context 4-tuple(ADR-0037 §Decision4 좌표) 조립 — personId/period/scope 전사 +
    // periodStart string → Date 파싱(기존 evaluate() 패턴 mirror). 허용 literal 값
    // 검증은 persist service 책임(DTO 는 형식만).
    const context: EvaluationPersistContext = {
      personId: dto.personId,
      period: dto.period,
      scope: dto.scope,
      periodStart: new Date(dto.periodStart),
    };

    // Admin full-persist 위임 — resolved serviceIdentities + since(periodStart
    // pass-through, 도출 0) + modelId 미지정 + context 4-tuple. service-layer error
    // (evaluateActivities throw / persist 비-Conflict error 등)는 raw 전파(swallow 0).
    const { assessment, created } = await this.adminBridge.generateAndPersist(
      { serviceIdentities: person.serviceIdentities },
      { since: dto.periodStart },
      { modelId: undefined as unknown as string },
      context,
    );

    // 영속 Assessment 식별자/좌표를 응답 shape 로 박제(이후 조회의 source).
    // periodStart 는 ISO-8601 string 으로 직렬화(영속 Date → string).
    return {
      assessmentId: assessment.id,
      personId: assessment.personId,
      period: assessment.period,
      scope: assessment.scope,
      periodStart: assessment.periodStart.toISOString(),
      created,
    };
  }
}
