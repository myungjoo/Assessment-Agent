---
id: T-0565
title: 미평가 fill run controller route 배선 — POST /unevaluated-fill-run (run-request DTO → orchestrator.run → UnevaluatedFillRunResult)
phase: P5
status: DONE
mergedAs: 372a287
prNumber: 480
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts
estimatedDiff: 130
estimatedFiles: 4
created: 2026-06-21
plannerNote: P5 bullet 106(R-64/REQ-037·038) Q-0045 옵션1 run-side chain slice(2) — orchestrator(T-0564) 위 HTTP wiring, T-0547 mirror, e2e 는 slice(3) 분리
---

# T-0565 — 미평가 fill run controller route 배선 — POST /unevaluated-fill-run

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가" / REQ-038) Q-0045 옵션1 run-side chain 의 **마지막 wiring slice 직전** — T-0556~T-0563 의 dependency-free 순수 조각 8 개와 T-0564 의 `@Injectable UnevaluatedFillRunOrchestratorService`(slice 1', merge 4325286) 까지 모두 박제·머지됐다. 그러나 orchestrator service 의 `.run(rawBridges, requestModelId, defaultModelId)` 메서드는 **HTTP caller 가 0** 이라 실 호출 경로가 닫히지 않았다 — T-0547 이 plan-side 사슬에서 controller route 로 닫은 것과 동형의 wiring 이 run-side 에 필요하다.

본 task 는 (a) HTTP request body 검증 DTO `UnevaluatedFillRunRequestDto`(rawBridges: PeriodBridgeDto[] 배열 검증 + modelId?: string + defaultModelId: string) 1 개를 신설하고, (b) `AssessmentEvaluationController` 에 새 route `POST /api/assessment-evaluation/unevaluated-fill-run` 1 개를 추가해 검증된 DTO → `UnevaluatedFillRunOrchestratorService.run(rawBridges, modelId, defaultModelId)` 1 회 위임 → 반환 `UnevaluatedFillRunResult`(plain JSON-safe shape 이미 string 축) 를 그대로 반환한다. controller 는 **thin delegate** — orchestration/조립/dedup/options 도출 재구현 0, DTO 분해 + service forward 만.

**RBAC 는 새 auth 결정이 아니다** — 기존 `evaluate` route + T-0547 `unevaluated-fill-plan` route 의 Admin+ 정책(`JwtAuthGuard + RolesGuard + @Roles("Admin")`)을 그대로 mirror 한다. 미평가 fill run 은 비용 있는 LLM round-trip 실 평가 + 영속 사슬의 **실 실행 진입**이므로 plan(read-only detection)보다 더 엄격해질 이유는 있어도 약해질 이유 없음 — Admin+ 동일 정책. 인증 부재 → 401, tier 미달 → 403 의 기존 가드 동작에 위임하므로 **새 인증 흐름/권한 모델/secret 변경 0**(CLAUDE.md §5 BLOCKED 항목 비해당). `defaultModelId` 의 source 는 본 task 에서 **request body 의 명시 인자**로 받는다(클라이언트 책임) — LLM 설정 source(env / `LlmProviderConfig` table) 배선은 별도 후속 slice 로 분리해 본 task 의 cap 과 dep 표면을 최소화한다(새 외부 dependency / config / env 변경 0).

**새 외부 dependency 0**: `class-validator` / `class-transformer` 둘 다 이미 package.json 박제(period-bridge.dto.ts·unevaluated-fill-plan-request.dto.ts 가 이미 사용 중). `@Type(() => PeriodBridgeDto)` + `@ValidateNested({ each: true })` 패턴은 기존 nested DTO 검증 관행 mirror(별도 ADR 불요). schema / migration / repository 메서드 / query 표면 0. 새 module import 0(controller + orchestrator service 둘 다 이미 `assessment-evaluation.module.ts` 에 등록 — T-0564 머지).

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` (L428~472) — T-0547 이 박제한 `POST /unevaluated-fill-plan` route 의 데코레이터 패턴 + thin-delegate 구조 + RBAC Admin+ mirror 근거 + JSDoc 톤. 본 task 는 동일 컨트롤러에 새 route 1 개 + constructor 주입 1 줄 추가 + import 4~5 줄 추가(기존 route 로직 0 LOC 변경).
- `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts` (전체 145 LOC) — 위임 대상 `UnevaluatedFillRunOrchestratorService.run(rawBridges: PeriodBridgeDto[], requestModelId: string | undefined | null, defaultModelId: string): Promise<UnevaluatedFillRunResult>`. constructor 주입 대상(@Injectable, 이미 module 등록 — T-0564). 흡수 경계 주석(L36~48) — controller 가 흡수해야 하는 것은 0(service 가 fail-fast `TypeError` 를 전파, controller 는 raw 전파만).
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` (L83~102) — service 반환 shape `UnevaluatedFillRunResult`(outcomes + 4 count 축). 이미 plain JSON-safe(string 축 — periodStart 이미 ISO string). **response mapper 불요** — service 반환을 그대로 controller 반환 타입으로 노출.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` (전체 75 LOC) — 신설할 run-request DTO 의 mirror 패턴. class-validator decorator 만 사용(class-transformer 없음 — primitive 축만). 본 task 의 DTO 는 nested PeriodBridgeDto 배열을 받으므로 `@Type` + `@ValidateNested({ each: true })` 가 추가됨.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` (전체) — nested 검증 대상 entity. 이미 class-validator decorator 박제. 본 task 는 import 후 `@Type(() => PeriodBridgeDto)` + `@ValidateNested({ each: true })` 로 배열 원소 자동 검증.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` (특히 T-0547 가 박제한 `planUnevaluatedFill` describe 블록 — Required Reading 기준 line 위치는 spec 파일 grep 으로 찾는다) — 본 task 가 추가할 새 route describe 블록의 mirror 패턴. orchestrator service mock 추가 + RBAC/Validation/thin-delegate 검증 6+ test.
- `docs/tasks/T-0547-unevaluated-fill-plan-controller-route.md` — plan-side controller route 의 Acceptance Criteria / Out of Scope 패턴. 본 task 는 run-side 동형이므로 거의 동일한 cell 구성.

## Acceptance Criteria

- [ ] 신규 DTO 파일 `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts` 작성 — `class UnevaluatedFillRunRequestDto` 3 필드: (1) `rawBridges: PeriodBridgeDto[]` — `@IsArray() @ValidateNested({ each: true }) @Type(() => PeriodBridgeDto)`(빈 배열 형식 허용, 도메인 결정성 위임 — plan DTO 의 personIds 빈 배열 정책 mirror), (2) `modelId?: string` — `@IsOptional() @IsString() @IsNotEmpty()`(선택, fallback 대상), (3) `defaultModelId: string` — `@IsString() @IsNotEmpty()`(필수). 파일 상단 JSDoc 으로 책임 + 허용 literal 검증을 service 책임으로 위임함 + nested DTO 검증 패턴 + plan-request DTO 와의 동형/차이를 한국어로 명시.
- [ ] colocated DTO spec `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts` — class-validator `validate()` 호출로 형식 검증: happy(3 필드 유효 → error 0) 1+ / error(rawBridges 누락·non-array·nested PeriodBridgeDto 위반·modelId 빈 문자열·defaultModelId 누락) 6+ / branch(modelId 미지정 vs 지정 vs null vs ""·rawBridges 빈 배열 vs 다수) 3+ / negative(forbidNonWhitelisted 동작 가정 unknown 필드 plain 객체 통과 — 본 spec 은 DTO 단독 검증이므로 unknown 필드는 validator 가 무시; controller-scope pipe 가 거부함을 별도 controller spec 에서 검증) 1+. 신규 DTO 의 line ≥ 80% / function ≥ 80% cov.
- [ ] `AssessmentEvaluationController` 에 새 route 메서드 추가 — `@Post("unevaluated-fill-run") @HttpCode(200) @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin")` 데코레이터(기존 `evaluate`/`unevaluated-fill-plan` route mirror). 시그니처 `async runUnevaluatedFill(@Body() dto: UnevaluatedFillRunRequestDto): Promise<UnevaluatedFillRunResult>`. 동작: `this.unevaluatedFillRunOrchestrator.run(dto.rawBridges, dto.modelId, dto.defaultModelId)` await → 반환 그대로 return. thin delegate — 분기/조립/dedup/재정렬/응답 mapper 0. service-layer error 는 raw 전파(swallow 0 — core 의 한국어 `TypeError`(options 무효 / rawBridges non-array 등) / 좌표 단위 person/persist reject 흡수는 service 가 책임). 메서드 위 한국어 JSDoc 으로 책임 + RBAC Admin+ 근거(실 평가/영속 사슬 진입, evaluate/plan route 동형) + UnevaluatedFillRunResult plain JSON-safe shape 근거(response mapper 불요 — string 축만) 명시.
- [ ] controller constructor 에 `private readonly unevaluatedFillRunOrchestrator: UnevaluatedFillRunOrchestratorService` 주입 1 줄 추가(이미 module 등록·export — T-0564 머지, 새 module 변경 불요). 새 import 는 orchestrator service + 신규 DTO + 결과 타입(`UnevaluatedFillRunResult`) 만. 기존 import 와 중복 없게 정리.
- [ ] 새 외부 dependency 0. `assessment-evaluation.module.ts` 미편집(controller·orchestrator·planner 등 모든 collaborator 이미 등록·export). 새 query 표면 / repository 메서드 / ADR / schema / migration / auth 흐름 변경 0. 새 LLM config source 0(`defaultModelId` 는 클라이언트 명시 — env / config table 배선은 본 task 밖). 기존 route(`evaluate` / `period` / `unevaluated-fill-plan`)·기존 생성자 주입·controller-scope pipe 로직 불변(추가만).
- [ ] happy-path controller unit test 1+ — 유효 DTO(rawBridges 2+ + modelId 지정 + defaultModelId 지정) 입력 시: orchestrator mock `.run(...)` 이 `(dto.rawBridges, dto.modelId, dto.defaultModelId)` 3 인자로 정확히 호출됨 검증 + orchestrator mock 이 반환한 `UnevaluatedFillRunResult` 가 controller 반환과 deep-equal(가공 0) 검증.
- [ ] error path controller unit test 1+ — (a) orchestrator mock 이 reject(예: `TypeError("options 무효")`) → controller 가 raw 전파(swallow 0, `await expect(...).rejects` + 인스턴스/메시지 검증), (b) modelId 미지정(undefined) 시에도 orchestrator 가 정확히 `(rawBridges, undefined, defaultModelId)` 로 호출됨 검증(plain pass-through — controller 가 임의 default 채워 넣지 않음).
- [ ] flow / branch coverage — (a) rawBridges 빈 배열 DTO → orchestrator 호출 + service 가 반환한 빈 outcomes 결과 그대로 응답 1 test, (b) modelId 지정 vs 미지정 두 분기 각각 orchestrator 호출 인자 검증 1+ test, (c) orchestrator reject 시 raw 전파 1 test. controller 자체 분기 최소(thin delegate)라 service 결과 forward 경로를 cover.
- [ ] RBAC / negative cases 충분 cover — 단일 negative 금지. 최소: (1) orchestrator reject 전파 검증, (2) `@Roles("Admin")` 메타데이터가 새 route 에 박제됨 검증(reflect-metadata 또는 기존 spec 의 RBAC 검증 패턴 mirror — evaluate/plan route 검증과 동형), (3) `@UseGuards(JwtAuthGuard, RolesGuard)` 박제 검증, (4) `@HttpCode(200)` 메타데이터 검증, (5) 빈 rawBridges → 빈 outcomes 결과(silent 비정상 진행 아님, 도메인 결정성), (6) thin delegate 비변형 — controller 가 service 반환을 재정렬/필터/직렬화 변환 없이 그대로 반환(orchestrator mock 호출 인자 = DTO 의 3 필드, 가공 0) — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(변경 controller 의 신규 route 메서드 + 신규 DTO 둘 다 line ≥ 80% / function ≥ 80% — thin delegate 라 100% 목표).
- [ ] colocated spec 위치: 신규 DTO spec 은 같은 디렉토리(`src/assessment-evaluation/dto/`), controller spec 은 기존 `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 에 새 describe 블록 append(기존 describe 불변, orchestrator mock 1 개 추가).

## Out of Scope

- **e2e HTTP 통합 spec(supertest 실 부팅) + 실 PostgreSQL + 실 LLM round-trip 배선검증** — 본 task 는 colocated controller/DTO unit(orchestrator mock + class-validator validate)까지. supertest 로 RBAC/Validation/route 통합을 실 부팅 검증하는 e2e + 실 PostgreSQL CI service + LAN 수동 live-LLM 1 회 round-trip 검증은 **slice(3)** 의 별도 후속 task. 본 task 의 빌드/unit 은 mock 만(LLM 0, live-LLM standing 게이트 ADR-0045 무관).
- **LLM config source 배선(`defaultModelId` 의 env / `LlmProviderConfig` table source)** — 본 task 는 `defaultModelId` 를 request body 의 명시 인자로 받는다(클라이언트 책임). env / config table 에서 default modelId 를 자동 주입하는 layer 는 별도 후속 slice(새 config source 결정 동반 — ADR 후보). 이 분리로 본 task 의 cap 과 dep 표면 최소화.
- **orchestrator / core / 순수 helper / 응답 직렬화 동작 변경** — `UnevaluatedFillRunOrchestratorService.run` / `runUnevaluatedFillRunCore` / T-0556~T-0562 순수 helper / `aggregateUnevaluatedFillRunResult` / `UnevaluatedFillRunResult` shape 의 로직·시그니처 불변. 본 task 는 controller 에 route+주입 추가 + 신규 DTO 1 개 추가 + spec 추가만(기존 파일 다른 부분 0 LOC 변경).
- **RBAC 정책 상향/하향** — Admin+ 는 기존 evaluate/plan route 와 동일 정책 mirror. User+ 허용 / self-only 등 권한 모델 변경(예: T-0564 가 backlogNote 에서 가정한 "RBAC(self-only·Admin)" full 정책)은 본 task 밖 — 본 task 는 evaluate/plan 과 동형 Admin+ 만. self-only personId 동등성 강제 등은 별도 정책 결정(ADR 후보) + 후속 slice.
- **응답 shape 변경 / response mapper 신설** — `UnevaluatedFillRunResult` 는 이미 plain JSON-safe(periodStart 이미 ISO string, 4 count 축 number, status union string). plan-side 처럼 Date→ISO mapper 가 필요 없음. 응답 envelope 변경(예: data/meta wrapper) 도입은 본 task 밖.
- **새 module import / module 등록** — controller·orchestrator service·person service·persist service 모두 이미 `assessment-evaluation.module.ts` 에 등록·export(T-0564 머지). 미편집. 새 외부 dependency 0. 하나라도 module/dep/schema/auth 변경이 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045 LAN 수동만), export download chain(Q-0042/Q-0043), import upload infra(게이트3 미승인), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
