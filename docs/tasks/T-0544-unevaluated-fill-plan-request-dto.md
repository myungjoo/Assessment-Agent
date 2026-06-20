---
id: T-0544
title: 미평가 fill 계획 요청 입력 검증 DTO UnevaluatedFillPlanRequestDto 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts
  - src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.spec.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 consume slice — intended 좌표 enumeration 입력의 HTTP 요청 검증 DTO, 새 dep/ADR/schema 0
---

# T-0544 — 미평가 fill 계획 요청 입력 검증 DTO UnevaluatedFillPlanRequestDto 추가

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 4 조각 + 첫 impure 입력 source `EvaluationPersistedRecordsReader`(T-0541) + impure compose service `EvaluationUnevaluatedFillPlanner`(T-0542, merge 2ff683a) + module provider 등록(T-0543, merge ddea799)까지 **class 단위로 전부 닫히고 DI-wire 됐다**. 그러나 그 planner `planUnevaluatedFill(intended: IntendedPeriodCoordinatesInput)` 는 아직 **소비처(consumer)가 0** 이다 — `IntendedPeriodCoordinatesInput`(어떤 person·기간을 평가하려는지)을 외부에서 받아 planner 로 흘리는 입구가 없다.

T-0542 / T-0543 의 Out of Scope 가 명시적으로 deferred 한 두 가지 — (a) orchestrator/controller 실배선과 (b) `intended` range/person 외부 source 결정 — 중, 본 task 는 (b) 의 **첫 자족 slice** 인 HTTP 요청 입력 검증 DTO 만 닫는다. `personIds[]` + `period` + `scope` + `rangeStart` + `rangeEnd`(= `IntendedPeriodCoordinatesInput` 의 5 축)을 class-validator decorator 로 **형식만** 검증하는 `UnevaluatedFillPlanRequestDto` 를 신설한다. 이 DTO 는 후속 controller endpoint slice 가 `@Body()` 로 받아 planner 입력으로 변환할 입구가 되며, controller/RBAC 실배선·planner 호출은 본 task 밖으로 유지한다(safe·dependency-free).

기존 `PeriodBridgeDto`(T-0317) / `EvaluateActivitiesDto`(T-0293) 의 입력-형식-만-검증 관행을 충실히 mirror 한다 — 허용 literal 값(period 의 day/week/month, scope 의 commit/document/aggregate) 검증은 service/domain helper 책임이고 DTO 는 형식(`@IsString` / `@IsISO8601` / `@IsNotEmpty`)만 강제한다. **새 외부 dependency 0**(class-validator 는 이미 의존), **새 ADR / schema / migration / repository 메서드 / query 표면 0**.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts` (L32~47) — DTO 가 형식상 1:1 대응할 `IntendedPeriodCoordinatesInput { personIds, period, scope, rangeStart, rangeEnd }` 의 5 축과 각 축의 의미(period day/week/month 라벨, scope exact-match, rangeStart/rangeEnd 반열림 `[start, end)`). DTO 는 string surface(rangeStart/rangeEnd 는 ISO-8601 string)로 받고 Date 변환은 후속 controller slice 책임.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — mirror 대상 DTO 패턴(class-validator decorator + 한국어 JSDoc + "형식만 검증, literal 값은 service 책임" 관행 + `@IsISO8601` 로 ISO date 형식 강제). 본 DTO 가 따를 스타일·decorator 선택의 single reference.
- `src/assessment-evaluation/dto/period-bridge.dto.spec.ts` — colocated DTO spec 패턴(class-transformer `plainToInstance` + class-validator `validate` 로 happy/negative 검증). 본 task 의 spec 이 mirror 할 검증 패턴.
- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — 배열 필드(`activities`) 검증 패턴 참고(`@IsArray` + `@ArrayNotEmpty`/`@ArrayMinSize` 등 — `personIds: string[]` 검증에 필요한 decorator 선택 근거). 본 task 는 이 파일을 편집하지 않고 패턴만 참고.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` 신설 — `export class UnevaluatedFillPlanRequestDto`. 5 필드: `personIds: string[]`(`@IsArray` + 각 원소 `@IsString({ each: true })` + 비어있지 않은 string 강제 `@IsNotEmpty({ each: true })`, 빈 배열 허용 여부는 아래 결정), `period: string`(`@IsString` + `@IsNotEmpty`), `scope: string`(`@IsString` + `@IsNotEmpty`), `rangeStart: string`(`@IsISO8601`), `rangeEnd: string`(`@IsISO8601`). 각 필드 위에 한국어 JSDoc 으로 책임 + "형식만 검증, 허용 literal/Date 변환·범위 검증은 service/controller 책임" 명시(`period-bridge.dto.ts` 스타일 mirror).
- [ ] `personIds` 빈 배열 정책 결정 + 박제 — 도메인 helper(`enumerateIntendedPeriodCoordinates`)는 빈 `personIds` 를 빈 결과로 흡수하므로 DTO 단에서 `@ArrayNotEmpty` 를 **적용하지 않고** 빈 배열을 형식상 허용한다(도메인 결정성에 위임). 이 결정을 JSDoc 1~2 줄로 명시(빈 배열 → 빈 plan 의 자연스러운 흐름).
- [ ] 새 import 는 `class-validator` decorator 들만(이미 의존). **새 외부 dependency / 새 module import / class-transformer `@Type`(nested 객체 없으므로 불요) 0**. nested DTO 0 — 5 축 모두 primitive(string) / primitive 배열.
- [ ] happy-path unit test 1+ — `plainToInstance(UnevaluatedFillPlanRequestDto, validPayload)` + `validate(...)` 가 error 0 을 반환(유효 입력 통과). `personIds` 2+ 원소 + 유효 ISO date rangeStart/rangeEnd 포함한 정상 payload.
- [ ] error path unit test 1+ — 각 필수 필드 누락 / wrong type 시 `validate` 가 해당 property 의 constraint violation 을 반환: (a) `personIds` 누락 또는 non-array, (b) `period` 누락 또는 빈 문자열, (c) `scope` 누락 또는 빈 문자열, (d) `rangeStart` non-ISO 문자열(예 `"2026-13-99"`), (e) `rangeEnd` non-ISO 문자열 — 각 1+ assertion(`errors` 에 해당 property 가 포함되는지 검증).
- [ ] flow / branch coverage — `personIds` 원소-수준 검증 분기: (a) 모든 원소가 유효 string → 통과, (b) 한 원소가 non-string(예 number) → `each: true` violation, (c) 한 원소가 빈 문자열 → `@IsNotEmpty({ each: true })` violation. 각 1+ test. (DTO 는 분기 로직이 적으므로 decorator 별 통과/위반 쌍으로 cover.)
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) `personIds` non-array, (2) `personIds` 원소 non-string, (3) `personIds` 원소 빈 문자열, (4) `period` 빈 문자열, (5) `scope` 빈 문자열, (6) `rangeStart` 비-ISO, (7) `rangeEnd` 비-ISO, (8) 정의되지 않은 추가 필드가 있을 때(whitelist 검증은 controller-scope ValidationPipe 책임이므로 DTO spec 에서는 `forbidNonWhitelisted` 옵션을 명시한 validator 로 1 assertion 또는 "controller-scope 검증임을 JSDoc/주석으로 명시"로 대체) — 각 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 100% 목표, DTO 는 decorator metadata 라 함수 본문 최소).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.spec.ts`(DTO 당 1 개 colocated, `period-bridge.dto.spec.ts` 와 같은 디렉토리·패턴). 새 mock helper 추출 불요(class-transformer `plainToInstance` + class-validator `validate` 직접 사용).

## Out of Scope

- **controller endpoint 실배선** — 본 DTO 를 `@Body()` 로 받아 `IntendedPeriodCoordinatesInput`(rangeStart/rangeEnd string → Date 변환 포함)으로 변환해 `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill` 을 호출하는 controller 메서드 + route(`@Get`/`@Post`) + RBAC(`@Roles`)는 본 task 밖. 후속 wiring slice. 본 task 는 입력 DTO + 검증 spec 만.
- **string → Date 변환 / KST boundary snap** — `rangeStart`/`rangeEnd` 의 ISO string → Date 변환(`parseKstPeriodInput` 등)과 KST boundary 정렬은 controller/orchestration 책임. 본 DTO 는 형식(ISO-8601 string)만 강제.
- **허용 literal 값 검증** — `period`(day/week/month) / `scope`(commit/document/aggregate)의 허용 집합 검증은 domain helper / service 책임(`@IsIn` 미적용 — 기존 DTO 관행 정합). 본 DTO 는 `@IsString` + `@IsNotEmpty` 형식만.
- **planner / reader / 순수 조각 동작 변경** — `EvaluationUnevaluatedFillPlanner` / `EvaluationPersistedRecordsReader` / 순수 4 조각 / compose helper 의 로직·시그니처 불변. 본 task 는 신규 DTO class + spec 만(기존 파일 0 LOC 변경).
- **새 module import / module 등록** — DTO class 는 NestJS provider 가 아니므로 module 등록 불요. `assessment-evaluation.module.ts` 미편집. 새 외부 dependency 0.
- **새 query 표면 / 새 repository 메서드 / schema / migration / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045), export download chain(Q-0042/Q-0043), import upload infra(게이트3), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
