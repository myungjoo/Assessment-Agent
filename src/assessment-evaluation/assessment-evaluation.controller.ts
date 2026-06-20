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
import {
  getKstPeriodRangeByPeriod,
  parseKstPeriodInput,
} from "../common/period-boundary";
import { PersonService } from "../user/person.service";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluateActivitiesDto } from "./dto/evaluate-activities.dto";
import { PeriodBridgeDto } from "./dto/period-bridge.dto";
import { UnevaluatedFillPlanRequestDto } from "./dto/unevaluated-fill-plan-request.dto";
import { toIntendedPeriodCoordinatesInput } from "./dto/unevaluated-fill-plan-request.mapper";
import {
  type UnevaluatedFillPlanResponse,
  toUnevaluatedFillPlanResponse,
} from "./dto/unevaluated-fill-plan-response.mapper";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationResultPersistService,
  type PersistMode,
} from "./evaluation-result-persist.service";
import { EvaluationUnevaluatedFillPlanner } from "./evaluation-unevaluated-fill-planner.service";
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
    // EvaluationUnevaluatedFillPlanner — POST /unevaluated-fill-plan 의 위임 대상
    // (T-0547, REQ-037 미평가 fill detection 사슬의 impure compose 완결, T-0542).
    // 같은 module(assessment-evaluation.module.ts)이 이미 provider 등록(T-0543)이라
    // 추가 token / module 배선 변경 0. test 는 jest mock { planUnevaluatedFill } 를
    // 주입해 실 DB read 0 / 실 네트워크 0 으로 위임 정합만 검증한다.
    private readonly unevaluatedFillPlanner: EvaluationUnevaluatedFillPlanner,
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
    // 3 종은 그대로 전사. R-9 입력 string → Date 변환은 raw `new Date(...)` 가 아니라
    // `parseKstPeriodInput` 1 곳 경유다(ADR-0039 §Decision3 (d)/§Decision5) — offset
    // 미명시 입력은 Asia/Seoul default 로 해석돼(예 `2026-06-10T15:00` → KST 15시 =
    // `2026-06-10T06:00:00Z`) period() 경로의 좌표 해석과 정합한다. malformed 입력은
    // helper 의 RangeError/TypeError 로 명시 거부(silent Invalid Date 진입 차단).
    // 허용 literal 값 검증은 persist service 책임(DTO 는 형식만).
    const context: EvaluationPersistContext = {
      personId: dto.personId,
      period: dto.period,
      scope: dto.scope,
      periodStart: parseKstPeriodInput(dto.periodStart),
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

  // normalizeKstPeriodStart — `dto.periodStart`(ISO string)을 `parseKstPeriodInput`
  // 으로 §Decision3 (d) Asia/Seoul-default 해석한 instant 를 요청 `period` granularity
  // 의 canonical KST period boundary 로 snap 한 UTC Date 를 산출한다(ADR-0039 §Decision3
  // (a)~(d) + §Decision5 — 입력 해석·boundary 계산은 helper 1 점 집중, controller 는
  // 진입점 배선만). 입력 string → Date 변환은 raw `new Date(...)` 가 아니라 helper 경유라
  // offset 미명시 입력이 Asia/Seoul 로 해석된다(예 `2026-06-10T15:00` → KST 15시).
  // 두 분기(Admin 좌표 / 양 분기 since)가 본 helper 1 곳을 공유해 중복 산술을 금지한다.
  // 효과:
  //   - 같은 KST 일/주/월 안의 서로 다른 입력 instant 가 동일 canonical boundary 로
  //     수렴 → persist 좌표(personId/period/scope/periodStart)의 idempotency 안정화
  //     (ADR-0037 §Decision4 / ADR-0038 first-write-wins 좌표가 KST 자정/주초/월초 정렬).
  //   - granularity 매핑은 helper 의 single source(`getKstPeriodRangeByPeriod`)를 재사용
  //     해 controller 에 별도 매핑을 박제하지 않는다(§Decision5 drift 차단).
  // 알 수 없는 `period` 는 helper 가 RangeError 로 reject(snap 전 명시 차단 — silent
  // Invalid coordinate 금지). DTO `@IsISO8601` 통과했으나 형식 위반/달력 불가능/범위 외
  // offset 인 edge 는 `parseKstPeriodInput` 의 RangeError, 비문자열/빈 입력은 TypeError
  // 가 전파된다(R-112 negative 분기 — silent Invalid Date 대신 명시적 error).
  private normalizeKstPeriodStart(period: string, periodStart: string): Date {
    return getKstPeriodRangeByPeriod(period, parseKstPeriodInput(periodStart))
      .start;
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
  //     error 는 raw 전파(swallow 0). dto.reevaluate 는 Admin 분기에서 generateAndPersist
  //     의 5번째 인자로 가공 없이 pass-through 된다(ADR-0038 §Decision1 — strict-true
  //     판정은 service 책임, false/미지정은 first-write-wins default 보존 §Decision3).
  //     비-Admin(User)이 reevaluate: true 를 명시하면 fail-closed reject(403, ADR-0038
  //     §Decision4 (ii)) — "요청했으나 무시됨" silent 혼란 차단.
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

  // ephemeralForUser — User 분기(self-only ephemeral, T-0317 기존 동작 보존 +
  // ADR-0038 §Decision4 (ii) reevaluate fail-closed reject). principal sub 이
  // dto.personId 와 일치할 때만 진행하고, ephemeral bridge 에 위임해
  // `EvaluationResult[]` 를 persist 호출 0(DB write 0)으로 반환한다.
  private async ephemeralForUser(
    dto: PeriodBridgeDto,
    principalUserId: string | undefined,
  ): Promise<EvaluationResult[]> {
    // 재평가 fail-closed reject(ADR-0038 §Decision4 (ii)) — 비-Admin 이
    // reevaluate === true 를 명시하면 self-only 검사·person resolve·generateEphemeral
    // 위임보다 **선행** 차단한다(전부 미호출 — 타인 personId 조합에서도 거부 사유가
    // 재평가 거부로 결정적). User ephemeral 경로는 영속본이 없어 재평가 대상이 N/A 며,
    // "요청했으나 무시됨" silent 혼란 대신 명시적 403 으로 의도를 드러낸다.
    // false/미지정은 기존 self-only ephemeral 그대로(영속 write 0 구조 불변, 회귀 0).
    if (dto.reevaluate === true) {
      throw new ForbiddenException(
        "재평가(reevaluate)는 Admin 전용이다 — User 경로는 영속본이 없어 재평가할 수 없다",
      );
    }

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

    // periodStart 를 요청 period granularity 의 canonical KST boundary 로 snap 한 뒤
    // since(ISO string)로 흘려보낸다(ADR-0039 §Decision3 — raw `dto.periodStart` 직접
    // 전달 금지). snap 은 self-only/재평가 fail-closed 검사 **이후**에만 도달하므로
    // 기존 차단 우선순위는 불변(회귀 0). 알 수 없는 period / Invalid Date 는 helper 가
    // reject(전파).
    const sinceBoundary = this.normalizeKstPeriodStart(
      dto.period,
      dto.periodStart,
    );

    // resolved person 의 serviceIdentities 만 조립해 ephemeral bridge 에 위임.
    // since 는 KST boundary 로 snap 된 좌표(도출은 controller orchestration). modelId 는
    // 본 slice 미지정.
    return this.ephemeralBridge.generateEphemeral(
      { serviceIdentities: person.serviceIdentities },
      { since: sinceBoundary.toISOString() },
      { modelId: undefined as unknown as string },
    );
  }

  // persistForAdmin — Admin 분기(full-persist, ADR-0037 §Decision1). self-only 우회
  // (임의 personId 허용). personId 를 resolve 한 뒤 context 4-tuple 을 조립해
  // generateAndPersist 에 위임하고, 영속 Assessment 식별자/좌표(`PeriodBridgeAdminResponse`)
  // 를 반환한다. dto.reevaluate 는 5번째 인자로 가공 없이 pass-through 한다(ADR-0038
  // §Decision1 — strict-true 만 "reeval" 판정은 service 책임, baking·정규화 0).
  private async persistForAdmin(
    dto: PeriodBridgeDto,
  ): Promise<PeriodBridgeAdminResponse> {
    // personId → resolved person 변환 재사용 — Admin 은 임의 personId 를 target 할 수
    // 있으므로 self-only 동등성 검사 없이 바로 resolve(row 부재 시 PersonService 가
    // NotFoundException(404) 전파 — controller 추가 분기 0).
    const person = await this.personService.findByIdWithIdentities(
      dto.personId,
    );

    // periodStart 를 요청 period granularity 의 canonical KST boundary 로 snap(ADR-0039
    // §Decision3). 같은 KST 일/주/월 안의 서로 다른 입력 instant 가 동일 좌표로 수렴해
    // persist idempotency(ADR-0037/0038 first-write-wins)가 KST 자정/주초/월초로 정렬된다.
    // 알 수 없는 period / Invalid Date 는 helper 가 reject(전파) — silent Invalid 좌표 금지.
    const periodStartBoundary = this.normalizeKstPeriodStart(
      dto.period,
      dto.periodStart,
    );

    // context 4-tuple(ADR-0037 §Decision4 좌표) 조립 — personId/period/scope 전사 +
    // periodStart 는 raw 가 아니라 snap 된 canonical KST boundary. 허용 literal 값
    // 검증은 persist service 책임(DTO 는 형식만).
    const context: EvaluationPersistContext = {
      personId: dto.personId,
      period: dto.period,
      scope: dto.scope,
      periodStart: periodStartBoundary,
    };

    // Admin full-persist 위임 — resolved serviceIdentities + since(snap 된 KST boundary
    // ISO string, 좌표와 동일 source) + modelId 미지정 + context 4-tuple + reevaluate
    // flag(5번째 인자, ADR-0038 §Decision1 — true/false/undefined 그대로 전달, 가공 0).
    // service-layer error(evaluateActivities throw / persist error — reeval 경로의
    // ConflictException 포함, T-0335 전파 계약)는 raw 전파(swallow 0).
    const { assessment, created } = await this.adminBridge.generateAndPersist(
      { serviceIdentities: person.serviceIdentities },
      { since: periodStartBoundary.toISOString() },
      { modelId: undefined as unknown as string },
      context,
      dto.reevaluate,
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

  // POST /api/assessment-evaluation/unevaluated-fill-plan — 미평가 fill 계획 detection
  // 사슬의 HTTP 진입점(T-0547, PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분
  // 일괄 평가" / REQ-038). T-0542~T-0546 이 박제·머지한 4 조각(요청 DTO / request mapper /
  // planner / response mapper)을 하나의 endpoint 로 잇는 **마지막 wiring slice** —
  // 그동안 HTTP caller 가 0 이던 `planUnevaluatedFill` 의 실 호출 경로를 닫는다.
  //
  //   - 200 OK + `UnevaluatedFillPlanResponse`(person 별 미평가 좌표 묶음 + 총 gap 수 /
  //     person 수, periodStart 는 offset-명시 ISO string 으로 직렬화).
  //   - controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)가
  //     `UnevaluatedFillPlanRequestDto` 의 5 축(personIds / period / scope / rangeStart /
  //     rangeEnd)을 형식만 검증한다(허용 literal 값은 domain helper / service 책임).
  //   - thin delegate: 분기 / 조립 / dedup / 재정렬 0. `toIntendedPeriodCoordinatesInput`
  //     (request mapper, string→Date 변환)으로 검증된 DTO 를 planner 입력으로 바꾸고,
  //     `planUnevaluatedFill` 에 forward 한 뒤, 반환 `UnevaluatedFillBatchPlan` 을
  //     `toUnevaluatedFillPlanResponse`(response mapper, Date→ISO string)로 직렬화만 한다.
  //   - service-layer error 는 raw 전파(swallow 0) — request mapper 의 RangeError/
  //     TypeError(비-ISO range / 비문자열 등), planner reject(reader 의존성 실패 등),
  //     response mapper 의 TypeError(Invalid Date 직렬화)가 그대로 NestJS 응답에 매핑된다.
  //
  // RBAC Admin+(JwtAuthGuard + RolesGuard + @Roles("Admin")) — 기존 `evaluate` route 의
  // Admin+ 정책을 그대로 mirror 한다(새 auth 결정 0). 미평가 fill 계획은 비용 있는 LLM
  // round-trip 일괄 평가 사슬의 **진입**이므로 evaluate route 와 동형으로 Admin+ 로 gate
  // 한다(인증 부재 → 401 / tier 미달 → 403 은 기존 가드 동작에 위임 — controller 추가 분기 0).
  @Post("unevaluated-fill-plan")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async planUnevaluatedFill(
    @Body() dto: UnevaluatedFillPlanRequestDto,
  ): Promise<UnevaluatedFillPlanResponse> {
    // 검증된 DTO(string 축) → 도메인 enumeration 입력(Date 축) 변환. rangeStart/rangeEnd
    // 의 string→Date 변환은 mapper 가 single-source helper(parseKstPeriodInput)로 수행하며,
    // 형식 위반(@IsISO8601 우회 가정한 edge)은 mapper 의 RangeError/TypeError 가 전파된다.
    const intended = toIntendedPeriodCoordinatesInput(dto);

    // planner 위임 — 미평가 fill batch plan 을 impure compose(reader read + 순수 compose).
    // reader 의존성 실패 등의 reject 는 await 가 그대로 throw → raw 전파(swallow 0).
    const plan =
      await this.unevaluatedFillPlanner.planUnevaluatedFill(intended);

    // 반환 plan(periodStart Date 축) → HTTP 응답 shape(periodStart ISO string 축) 직렬화.
    // 재정렬/필터/dedup 0 — planner 의 결정성·순서 정책을 그대로 전파한다.
    return toUnevaluatedFillPlanResponse(plan);
  }
}
