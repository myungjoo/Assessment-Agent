// PeriodBridgeDto — P5 period→collection→evaluate bridge endpoint(후속 slice 3 의
// 예: POST /api/assessment-evaluation/period)의 request body 검증 DTO. ADR-0037 slice 1.
// `CollectTriggerDto`(T-0117/T-0274) · `EvaluateActivitiesDto`(T-0293) 패턴 mirror —
// class-validator decorator 로 형식만 검증하고, 허용 literal 값(period 의 day/week/month,
// scope 의 commit/document/aggregate) 검증은 service/orchestrator 책임(@IsIn 미적용,
// 기존 collection/evaluation DTO 관행 정합).
//
// 본 DTO 는 ADR-0037 의 FIRM 결정만 박제한다:
//   - §Decision1(RBAC Admin full / User self-only ephemeral) 의 입력 축 = personId.
//     RBAC role 분기·self-only(personId 동등성) 강제는 본 DTO 밖 — RBAC guard / orchestration
//     진입(slice 4) 책임. 본 DTO 는 "누구의 평가를 어느 기간으로 요청하는가" 의 입력 형식만.
//   - §Decision4(fresh in-memory collect 좌표 source-of) 의 좌표 = (personId, period, scope,
//     periodStart). bridge 는 이 4-tuple 로 fresh collect → evaluate 를 매 호출 수행한다.
//     좌표 자체의 형식만 boundary 에서 강제하고, fresh-collect/평가 배선은 orchestration
//     bridge service(slice 2) 책임.
//
// §Decision2(double-write 경계)·§Decision3(idempotency)는 ADR-0037 에서 PROPOSE 상태이며
// 본 DTO 는 입력 형식만 — double-write/idempotency semantics 는 slice 2/5 책임이라 본 DTO 에
// 어떤 영속화/동시성 semantics 도 baking 하지 않는다(사용자 ADR PR 검토 결과와 독립).
//
// 본 DTO 는 controller(slice 3)의 @Body() 로 사용되며 controller-scope ValidationPipe
// (whitelist + forbidNonWhitelisted + transform)과 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted).
//   - decorator 위반(필수 누락 / wrong type / 잘못된 ISO date) → 400.
//
// 새 외부 dependency 0 — class-validator 는 이미 의존(collect-trigger.dto.ts /
// evaluate-activities.dto.ts 가 사용 중, package.json 박제, ADR-0037 §Decision5).
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class PeriodBridgeDto {
  // personId — 평가 대상 person 의 식별자(§Decision1 RBAC 입력 축 / §Decision4 좌표의
  // leading 축). 존재 검증(실 Person row)·self-only(personId == 요청 principal) 동등성
  // 강제는 본 DTO 밖 — RBAC guard / orchestration(slice 4) 책임. DTO 는 형식(비어있지 않은
  // string)만.
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — 평가 기간 종류(day/week/month enum-as-String). 형식만 검증, 허용 literal 값은
  // service 책임(@IsIn 미적용 — collect-trigger.dto 의 period/scope 관행 정합).
  @IsString()
  @IsNotEmpty()
  period!: string;

  // scope — 평가 scope(commit/document/aggregate enum-as-String). 형식만 검증, 허용 literal
  // 값은 service 책임(@IsIn 미적용).
  @IsString()
  @IsNotEmpty()
  scope!: string;

  // periodStart — 기간 시작 시각(ISO-8601 string, §Decision4 좌표의 boundary 축).
  // `@IsISO8601()` 로 형식을 boundary 에서 강제 — 비-ISO 문자열(예: "2026-13-99")은 400 으로
  // 거부되어 downstream 의 `new Date(...)` 가 Invalid Date 를 만들어 흘러들어가는 opaque 500
  // 을 차단한다(evaluate-activities.dto 의 periodStart 패턴 mirror).
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  periodStart!: string;

  // reevaluate — 이미 영속화된 평가문의 재평가(overwrite) 요청 flag(ADR-0038 §Decision1,
  // T-0333 slice 1). default false = first-write-wins 보존(ADR-0037 §Decision3 동작 회귀 0,
  // ADR-0038 §Decision3) — reeval opt-out 의 request 계약이며, true 일 때만 bridge 가
  // reset-and-recreate(persist-service 의 PersistMode `"reeval"`, ADR-0033 §3)로 영속화한다.
  // 미지정 시 undefined — orchestration 이 default false(first-write-wins)로 처리한다
  // (slice 2b 책임).
  //
  // 본 DTO 는 형식 검증만(@IsOptional + @IsBoolean — 제공 시 boolean 강제, "true"/"yes"
  // string·1 number 같은 비-boolean 은 400) — reeval 영속화/persist 분기 = orchestration
  // slice 2b, Admin RBAC + User reevaluate fail-closed reject = controller slice 3,
  // idempotency/동시성 e2e = slice 4 책임(전부 본 DTO 밖, ADR-0038 §Decision2~5 미baking).
  //
  // 참고: T-0315 가 speculatively 추가했던 vestigial `mode` field(period bridge unwired)는
  // ADR-0038 §Decision1 amendment(T-0334)로 제거됐다 — contract 는 본 5 키
  // (personId/period/scope/periodStart/reevaluate)뿐이며, `mode` 제공 payload 는 controller
  // 의 ValidationPipe(whitelist + forbidNonWhitelisted)가 정의 외 필드로 400 거부한다.
  @IsOptional()
  @IsBoolean()
  reevaluate?: boolean;
}
