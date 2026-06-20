---
id: T-0547
title: 미평가 fill plan controller route 배선 — POST /unevaluated-fill-plan (요청 DTO→mapper→planner→응답 mapper)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 wiring slice — 요청 DTO→request mapper→planner→response mapper 를 잇는 controller route, RBAC 는 기존 Admin+ 정책 mirror(새 auth 결정 0)
---

# T-0547 — 미평가 fill plan controller route 배선 — POST /unevaluated-fill-plan

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 4 조각 + impure compose service `EvaluationUnevaluatedFillPlanner`(T-0542) + module provider 등록(T-0543, DI-wire 완료) + HTTP 요청 검증 DTO `UnevaluatedFillPlanRequestDto`(T-0544) + 요청 string→Date 변환 mapper `toIntendedPeriodCoordinatesInput`(T-0545) + 응답 Date→ISO string mapper `toUnevaluatedFillPlanResponse`(T-0546, merge d8c4101)까지 **모든 조각이 박제·머지됐다**.

그러나 이 조각들은 아직 **HTTP caller 가 0** 이다 — DTO·request mapper·planner·response mapper 가 전부 존재하지만 이들을 하나의 endpoint 로 잇는 controller route 가 없어 `planUnevaluatedFill` 의 실 호출 경로가 닫히지 않았다. T-0542~T-0546 의 Out of Scope 가 일관되게 deferred 해 온 **controller 실배선** 이 본 task 의 책임이다.

본 task 는 `AssessmentEvaluationController` 에 새 route `POST /api/assessment-evaluation/unevaluated-fill-plan` 1 개를 추가한다 — `@Body() UnevaluatedFillPlanRequestDto` 를 받아 `toIntendedPeriodCoordinatesInput`(request mapper)로 `IntendedPeriodCoordinatesInput` 으로 변환 → `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill(...)` 호출 → 반환 `UnevaluatedFillBatchPlan` 을 `toUnevaluatedFillPlanResponse`(response mapper)로 JSON 응답 shape 로 직렬화. controller 는 **thin delegate** — orchestration/조립 재구현 0, 검증된 DTO 분해 + mapper 호출 + planner forward + 응답 mapper 변환만.

**RBAC 는 새 auth 결정이 아니다** — 기존 `evaluate` route 의 Admin+ 정책(`JwtAuthGuard + RolesGuard + @Roles("Admin")`)을 그대로 mirror 한다(controller 주석 L13 의 "평가 trigger 는 비용 있는 LLM round-trip 연산이므로 Admin+" 근거와 동형 — 미평가 fill plan 도 평가-비용 사슬의 진입). 인증 부재 → 401, tier 미달 → 403 의 기존 가드 동작에 위임하므로 **새 인증 흐름/권한 모델/secret 변경 0**(CLAUDE.md §5 BLOCKED 항목 비해당). 새 외부 dependency / 새 ADR / schema / migration / repository 메서드 / query 표면 0 — 모든 의존 조각은 이미 머지됐다.

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` (L119~280) — `@Controller("api/assessment-evaluation")` + controller-scope `@UsePipes(ValidationPipe{whitelist, forbidNonWhitelisted, transform})` + constructor DI 패턴 + 기존 `@Post("evaluate")`(L165~) route 의 `@HttpCode(200) + @UseGuards(JwtAuthGuard, RolesGuard) + @Roles("Admin")` mirror 대상. 본 task 가 추가할 route 의 데코레이터·thin-delegate 구조의 single reference. 본 task 는 이 파일에 **새 route 메서드 1 개 + constructor 에 planner 주입 1 줄** 만 추가(기존 route 로직 불변).
- `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts` (L37~70) — 호출할 service `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill(intended: IntendedPeriodCoordinatesInput): Promise<UnevaluatedFillBatchPlan>`. constructor 주입 대상(@Injectable, 이미 module 등록 — T-0543).
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` (L31~) — `@Body()` 타입 `UnevaluatedFillPlanRequestDto`(personIds/period/scope/rangeStart/rangeEnd). controller-scope ValidationPipe 가 검증.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts` (L54~) — `toIntendedPeriodCoordinatesInput(dto): IntendedPeriodCoordinatesInput`(string→Date 변환). DTO → planner 입력 변환 함수.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` (L44~71) — 응답 shape interface `UnevaluatedFillPlanResponse` + `toUnevaluatedFillPlanResponse(plan): UnevaluatedFillPlanResponse`(Date→ISO string). planner 출력 → HTTP 응답 변환 함수.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` (기존 describe 구조 + orchestrator/persist mock 패턴, 특히 `evaluate` route 의 RBAC/Validation/delegate unit test) — 본 task 가 추가할 새 route describe 블록의 mirror 패턴. planner mock 추가 + 새 route 검증 describe 1 개 append(기존 describe 불변).

## Acceptance Criteria

- [ ] `AssessmentEvaluationController` 에 새 route 메서드 추가 — `@Post("unevaluated-fill-plan") @HttpCode(200) @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin")` 데코레이터(기존 `evaluate` route mirror). 시그니처 `async planUnevaluatedFill(@Body() dto: UnevaluatedFillPlanRequestDto): Promise<UnevaluatedFillPlanResponse>`. 동작: `toIntendedPeriodCoordinatesInput(dto)` → `this.unevaluatedFillPlanner.planUnevaluatedFill(intended)` await → `toUnevaluatedFillPlanResponse(plan)` 반환. thin delegate — 분기/조립/dedup/재정렬 0. service-layer error 는 raw 전파(swallow 0). 메서드 위에 한국어 JSDoc 으로 책임 + RBAC Admin+ 근거(평가-비용 사슬 진입, evaluate route 동형) 명시.
- [ ] constructor 에 `private readonly unevaluatedFillPlanner: EvaluationUnevaluatedFillPlanner` 주입 1 줄 추가(이미 module 등록된 provider — 새 module 변경 불요). 새 import 는 planner service + 두 mapper 함수 + 응답 타입 + 요청 DTO(필요 시) 만 — 기존 import 와 중복 없게.
- [ ] 새 외부 dependency 0. `assessment-evaluation.module.ts` 미편집(controller 와 planner 둘 다 이미 등록). 새 query 표면 / repository 메서드 / ADR / schema / migration / auth 흐름 변경 0. 기존 route(`evaluate`/`period`)·생성자 기존 주입·controller-scope pipe 로직 불변(추가만).
- [ ] happy-path unit test 1+ — 유효 DTO(personIds 2+ + 유효 period/scope + 유효 ISO rangeStart/rangeEnd) 입력 시: planner mock 이 `toIntendedPeriodCoordinatesInput` 산출 `IntendedPeriodCoordinatesInput`(personIds/period/scope passthrough + rangeStart/rangeEnd Date 변환)으로 정확히 호출됨 검증 + planner mock 이 반환한 `UnevaluatedFillBatchPlan` 이 `toUnevaluatedFillPlanResponse` 거쳐 응답 shape(periodStart `typeof === "string"` ISO)로 반환됨 검증.
- [ ] error path unit test 1+ — (a) planner mock 이 reject(예: reader error) → controller 가 raw 전파(swallow 0, `await expect(...).rejects`), (b) request mapper 가 던지는 경로(예: dto 의 rangeStart 비-ISO 로 mapper helper 가 TypeError) → 전파 검증 — 각 1+ assertion.
- [ ] flow / branch coverage — (a) personIds 빈 배열 DTO → mapper/planner 경유 빈 plan → 빈 batches 응답 1 test, (b) batches 2+ 묶음 정상 plan → 응답에 순서/좌표 보존 1 test. controller 는 thin delegate 라 자체 분기 최소 — mapper/planner 결과 forward 경로를 cover.
- [ ] RBAC / negative cases 충분 cover — 단일 negative 금지. 최소: (1) planner reject 전파, (2) request mapper error 전파, (3) `@Roles("Admin")` 메타데이터가 route 에 박제됨 검증(reflect-metadata 또는 기존 spec 의 RBAC 검증 패턴 mirror — evaluate route 검증과 동형), (4) `@UseGuards(JwtAuthGuard, RolesGuard)` 박제 검증, (5) 빈 personIds → 빈 응답(silent 비정상 진행 아님, 도메인 결정성), (6) thin delegate 비변형 — controller 가 planner 반환 plan 을 재정렬/필터 없이 response mapper 에만 넘김(planner mock 호출 인자 = mapper 산출, 가공 0) — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(변경 controller 의 신규 route 메서드 line ≥ 80% / function ≥ 80% — thin delegate 라 100% 목표).
- [ ] colocated spec 위치: `src/assessment-evaluation/assessment-evaluation.controller.spec.ts`(기존 controller spec 에 새 route describe 블록 append). 새 mock helper 추출 불요(기존 spec 의 orchestrator/persist mock 패턴 + planner mock 1 개 추가).

## Out of Scope

- **`intended` range/person 의 외부 source 결정 변경** — DTO 가 받는 personIds/period/scope/rangeStart/rangeEnd 5 축은 T-0544 가 확정한 surface 그대로. 새 입력 source(예: query enumeration, 자동 range 추론)는 본 task 밖.
- **e2e HTTP 통합 spec(supertest 실 부팅)** — 본 task 는 colocated controller unit(planner mock)까지. supertest 로 RBAC/Validation/route 통합을 실 부팅 검증하는 e2e 는 후속 slice(기존 controller 의 e2e 도 후속 slice 로 deferred 됨 — 본 task 정합).
- **planner / reader / 순수 조각 / mapper / DTO 동작 변경** — `EvaluationUnevaluatedFillPlanner` / `EvaluationPersistedRecordsReader` / 순수 4 조각 / `toIntendedPeriodCoordinatesInput` / `toUnevaluatedFillPlanResponse` / `UnevaluatedFillPlanRequestDto` 의 로직·시그니처 불변. 본 task 는 controller 에 route+주입 추가 + spec describe 추가만(기존 파일 다른 부분 0 LOC 변경).
- **RBAC 정책 상향/하향** — Admin+ 는 기존 evaluate route 와 동일 정책 mirror. User+ 허용 등 권한 모델 변경은 본 task 밖(별도 정책 결정 — R-9 사용자/Admin 허용은 후속). 본 task 는 기존 가드를 그대로 재사용할 뿐 새 auth 흐름 도입 0.
- **응답 영속화 / assessmentId 발급** — 본 endpoint 는 plan(읽기 전용 detection 결과)만 반환. evaluate route 처럼 persist hook 배선은 본 task 밖(미평가 fill 의 실 평가 실행·영속은 후속 slice).
- **새 module import / module 등록** — controller·planner 둘 다 이미 `assessment-evaluation.module.ts` 에 등록. 미편집. 새 외부 dependency 0. 하나라도 module/dep/schema/auth 변경이 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045 LAN 수동만), export download chain(Q-0042/Q-0043), import upload infra(게이트3 미승인), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
