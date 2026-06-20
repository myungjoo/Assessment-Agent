---
id: T-0545
title: 미평가 fill 요청 DTO → IntendedPeriodCoordinatesInput 순수 mapper toIntendedPeriodCoordinatesInput 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts
  - src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 consume slice — T-0544 DTO 의 string 축(rangeStart/rangeEnd)을 parseKstPeriodInput 경유 Date 로 변환해 IntendedPeriodCoordinatesInput 조립하는 순수 mapper, controller/RBAC 실배선 deferred
---

# T-0545 — 미평가 fill 요청 DTO → IntendedPeriodCoordinatesInput 순수 mapper toIntendedPeriodCoordinatesInput 추가

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 4 조각 + impure compose service `EvaluationUnevaluatedFillPlanner`(T-0542, planner) + module provider 등록(T-0543) + HTTP 요청 검증 DTO `UnevaluatedFillPlanRequestDto`(T-0544, merge 82a1f02)까지 닫혔다. 그러나 그 DTO 는 5 축을 **string surface** 로 받는다(`rangeStart`/`rangeEnd` 는 ISO-8601 string). planner 의 입구 타입 `IntendedPeriodCoordinatesInput`(evaluation-intended-period-coordinates.ts L41~47)은 `rangeStart`/`rangeEnd` 를 **`Date`** 로 요구한다. 둘 사이를 잇는 변환이 아직 0 이다.

T-0544 의 DTO JSDoc(L13~15, L58~62)과 Out of Scope 가 명시적으로 deferred 한 두 가지 — (a) controller endpoint 실배선과 (b) `string → Date 변환` — 중, 본 task 는 (b) 의 **자족 slice** 인 순수 mapper 만 닫는다. `UnevaluatedFillPlanRequestDto`(string 축) → `IntendedPeriodCoordinatesInput`(Date 축)으로 변환하는 dependency-free 순수 함수 `toIntendedPeriodCoordinatesInput` 를 신설한다. `personIds`/`period`/`scope` 3 축은 passthrough, `rangeStart`/`rangeEnd` 2 축만 string → Date 로 변환한다.

핵심 제약 — **string → Date 변환은 raw `new Date(...)` 가 아니라 기존 `parseKstPeriodInput`(common/period-boundary.ts L211) single-source helper 를 경유**한다(R-9 / ADR-0039 §Decision3 (d)/§Decision5 정합 — offset 미명시 시 KST 해석, malformed 입력 명시적 error). 기존 controller `assessment-evaluation.controller.ts` 의 `normalizeKstPeriodStart`(L226)·`EvaluateActivitiesDto` periodStart 변환(L192)이 같은 helper 를 경유하는 관행을 mirror 한다 — 이로써 opaque Invalid Date 가 planner 로 흘러드는 500 을 차단하고 timezone drift 를 구조적으로 막는다.

controller endpoint route(`@Get`/`@Post`)·RBAC(`@Roles`)·planner 실호출·KST boundary snap 은 본 task 밖으로 유지한다(후속 wiring slice, safe·dependency-free).

## Required Reading

- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` — mapper 의 **입력 타입** `UnevaluatedFillPlanRequestDto`(5 축: personIds `string[]` / period `string` / scope `string` / rangeStart `string`(ISO) / rangeEnd `string`(ISO)). 빈 personIds 형식 허용 정책(L37~40) 정합 유지.
- `src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts` (L32~56) — mapper 의 **출력 타입** `IntendedPeriodCoordinatesInput`(personIds / period / scope / rangeStart `Date` / rangeEnd `Date`) + 그 안의 `assertValidDate` 가 Date 축에 기대하는 계약(유효 Date / NaN 거부). mapper 는 이 타입을 정확히 조립한다(새 좌표 타입 발명 0).
- `src/common/period-boundary.ts` (L205~230) — string → Date 변환 single-source `parseKstPeriodInput(input: string): Date`. 비문자열/빈 문자열 → `TypeError`, 형식 위반/달력 불가능 값 → `RangeError`. mapper 가 rangeStart/rangeEnd 변환에 경유할 유일한 helper(raw `new Date(...)` 금지).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (L180~227) — `parseKstPeriodInput` import(L57) + `EvaluateActivitiesDto.periodStart` string → Date 변환(L192) + `normalizeKstPeriodStart`(L226) 의 helper-경유 관행. 본 mapper 가 따를 변환 스타일의 single reference. 본 task 는 이 파일을 **편집하지 않고** 패턴만 참고.
- `src/assessment-evaluation/dto/period-bridge.dto.spec.ts` — colocated spec 패턴(직접 함수 호출 + happy/negative 검증) 참고. 본 mapper spec 은 `plainToInstance` 불요(순수 함수 직접 호출).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts` 신설 — `export function toIntendedPeriodCoordinatesInput(dto: UnevaluatedFillPlanRequestDto): IntendedPeriodCoordinatesInput`. 동작: `personIds`/`period`/`scope` 3 축은 그대로 전사(personIds 는 **새 배열로 복사**해 입력 비변형 — 도메인 helper 가 입력 비변형을 기대하므로 안전), `rangeStart`/`rangeEnd` 2 축은 `parseKstPeriodInput(dto.rangeStart)`/`parseKstPeriodInput(dto.rangeEnd)` 로 변환. raw `new Date(...)` 사용 0. 파일 상단에 한국어 JSDoc 으로 책임 + "string→Date 변환만 single-source helper 경유, KST boundary snap/범위 검증/허용 literal 검증·controller 실배선은 본 mapper 밖" 명시.
- [ ] mapper 는 **순수 함수** — `@Injectable` 0, NestJS/Prisma/LLM import 0, 부수효과 0, 입력 dto 객체·배열 비변형(personIds 복사). import 는 입력 타입(`UnevaluatedFillPlanRequestDto`) + 출력 타입(`IntendedPeriodCoordinatesInput`) + `parseKstPeriodInput` 3 종만.
- [ ] 방어적 입력 — `dto` 가 null/undefined 면 한국어 메시지 `TypeError` 로 fail-fast(silent 진행 금지). rangeStart/rangeEnd 의 형식 위반은 `parseKstPeriodInput` 의 `TypeError`/`RangeError` 가 **자연 전파**(mapper 가 재던지지 않음 — single-source error 메시지 보존). DTO ValidationPipe 가 정상 경로에서 ISO 형식을 이미 강제하므로 mapper 의 helper error 는 방어 그물.
- [ ] 새 외부 dependency 0. 새 module import / module 등록 0(mapper 는 NestJS provider 가 아님 — `assessment-evaluation.module.ts` 미편집). 새 query 표면 / repository 메서드 / ADR / schema / migration 0.
- [ ] happy-path unit test 1+ — 유효 dto(personIds 2+ 원소 + 유효 ISO rangeStart/rangeEnd + period "week" + scope "commit") 입력 시 `IntendedPeriodCoordinatesInput` 반환: personIds/period/scope 정확히 전사 + rangeStart/rangeEnd 가 `instanceof Date` 이고 `parseKstPeriodInput` 가 산출한 instant 와 일치(예: KST 해석 검증 — offset 미명시 입력이 KST 로 해석되는지 1 assertion).
- [ ] error path unit test 1+ — (a) `dto` null/undefined → `TypeError`, (b) `rangeStart` 형식 위반(예 `"2026-13-99"`) → `parseKstPeriodInput` 의 `RangeError` 전파, (c) `rangeEnd` 빈 문자열 → `parseKstPeriodInput` 의 `TypeError` 전파 — 각 1+ assertion(`toThrow`).
- [ ] flow / branch coverage — (a) offset 명시(`"...+09:00"`/`"...Z"`) rangeStart → 그대로 instant, (b) offset 미명시(`"2026-06-10T15:00"`) rangeStart → KST 해석 instant, (c) 날짜-only(`"2026-06-10"`) rangeStart → KST 자정 — 각 1+ test(parseKstPeriodInput 분기를 mapper 경유로 cover). 빈 personIds(`[]`) → 빈 배열 전사(passthrough) 1 test.
- [ ] negative cases 충분 cover — 단일 negative 금지. 최소: (1) dto null, (2) dto undefined, (3) rangeStart 비-ISO, (4) rangeEnd 비-ISO, (5) rangeStart 빈 문자열, (6) rangeEnd 빈 문자열, (7) 입력 dto.personIds 비변형 검증(반환 personIds 가 입력과 다른 배열 참조이거나 입력 배열 mutate 0) — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 100% 목표, 순수 함수라 분기 적음).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.spec.ts`(mapper 당 1 개 colocated, DTO 와 같은 디렉토리). 새 mock helper 추출 불요(순수 함수 직접 호출).

## Out of Scope

- **controller endpoint 실배선** — 본 mapper 를 controller 메서드에서 호출해 `@Body() UnevaluatedFillPlanRequestDto` 를 받아 `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill`(T-0542) 로 흘리는 route(`@Get`/`@Post`) + RBAC(`@Roles`) + ValidationPipe 결합은 본 task 밖. 후속 wiring slice. 본 task 는 string→Date mapper + spec 만.
- **KST boundary snap / 범위 검증** — `rangeStart`/`rangeEnd` 를 period granularity canonical boundary 로 snap(`getKstPeriodRangeByPeriod`)하거나 `rangeStart < rangeEnd` 범위 검증은 controller/service 책임. 본 mapper 는 `parseKstPeriodInput` 경유 instant 변환만(snap 0).
- **허용 literal 값 검증** — `period`(day/week/month) / `scope`(commit/document/aggregate)의 허용 집합 검증은 domain helper(`enumerateIntendedPeriodCoordinates` 가 boundary helper 의 RangeError 로 자연 거부) / service 책임. 본 mapper 는 passthrough(검증 0).
- **planner / reader / 순수 조각 / DTO 동작 변경** — `EvaluationUnevaluatedFillPlanner` / `EvaluationPersistedRecordsReader` / 순수 4 조각 / compose helper / `UnevaluatedFillPlanRequestDto` / `assessment-evaluation.controller.ts` 의 로직·시그니처 불변. 본 task 는 신규 mapper 함수 + spec 만(기존 파일 0 LOC 변경).
- **새 module import / module 등록** — mapper 는 순수 함수(NestJS provider 아님)라 module 등록 불요. `assessment-evaluation.module.ts` 미편집. 새 외부 dependency 0.
- **새 query 표면 / 새 repository 메서드 / schema / migration / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045), export download chain(Q-0042/Q-0043), import upload infra(게이트3), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
