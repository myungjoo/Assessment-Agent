---
id: T-0546
title: 미평가 fill batch plan → HTTP 응답 shape 순수 mapper toUnevaluatedFillPlanResponse 추가
phase: P5
status: DONE
completedAt: 2026-06-20T03:59:32Z
mergedAs: d8c4101
prNumber: 460
reviewRounds: 1
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts
  - src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 응답-side slice — planner 출력 UnevaluatedFillBatchPlan(periodStart Date)을 formatKstIso 경유 ISO string 으로 직렬화한 JSON 응답 shape 순수 mapper, controller 실배선 deferred
---

# T-0546 — 미평가 fill batch plan → HTTP 응답 shape 순수 mapper toUnevaluatedFillPlanResponse 추가

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 4 조각 + impure compose service `EvaluationUnevaluatedFillPlanner`(T-0542) + module provider 등록(T-0543) + HTTP 요청 검증 DTO `UnevaluatedFillPlanRequestDto`(T-0544) + 요청 string→Date 변환 mapper `toIntendedPeriodCoordinatesInput`(T-0545, merge ffbc8b3)까지 닫혔다. 즉 **요청 진입(HTTP string surface → planner 입구 도메인 타입)** 경로는 완결됐다.

그러나 그 반대 방향 — planner 출력 `UnevaluatedFillBatchPlan`(domain/evaluation-unevaluated-fill-batch-plan.ts)을 **HTTP 응답으로 직렬화**하는 경로는 아직 0 이다. plan 의 각 batch 는 `periods: EvaluationPersistContext[]` 를 담고, 그 안의 `periodStart` 는 **`Date` instance**(evaluation-result.persist.mapper.ts L51)다. Date 는 JSON 직렬화 시 구현-의존 표현(엔진 toJSON)으로 누출되므로, controller 가 plan 을 응답으로 내보내기 전에 `Date → 명시 offset ISO-8601 string` 으로 변환해 안정적 contract 를 박제해야 한다.

본 task 는 T-0545 의 request-side mapper 의 **대칭(symmetric) 짝** 인 응답-side 순수 mapper 만 닫는다 — `UnevaluatedFillBatchPlan`(periodStart `Date`) → JSON 직렬화 가능 응답 shape(periodStart ISO string). controller endpoint 실배선·RBAC·planner 실호출은 본 task 밖(후속 wiring slice, safe·dependency-free). 신규 파일 2 개만 추가하고 기존 파일은 0 LOC 변경 — stage5b 동시 claim 안전(파일-disjoint·dependsOn []).

핵심 제약 — **Date → string 직렬화는 raw `.toISOString()` 가 아니라 기존 `formatKstIso`(common/period-boundary.ts L195) single-source helper 를 경유**한다(R-9 / ADR-0039 §Decision4 정합 — 응답 시각 필드의 offset-명시 ISO contract, round-trip 시 원 instant 보존). 요청 mapper(T-0545)가 `parseKstPeriodInput` 를 경유한 것과 정확히 대칭이다(parse↔format 쌍 single-source).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts` (L30~60) — mapper 의 **입력 타입** `UnevaluatedFillBatchPlan`(`batches: UnevaluatedFillBatch[]` / `totalGapCount: number` / `personCount: number`) + `UnevaluatedFillBatch`(`personId: string` / `periods: EvaluationPersistContext[]`). 불변식(`totalGapCount === sum(periods.length)`)·person 묶음 순서(firstSeenOrder)·좌표 순서(gap 등장 순서)를 응답에서 그대로 보존(재정렬 0).
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` (L44~52) — `periods` 원소 타입 `EvaluationPersistContext`(personId `string` / period `string` / scope `string` / **periodStart `Date`**). mapper 가 직렬화할 4 축 — periodStart 만 Date→string 변환, 나머지 3 축은 passthrough.
- `src/common/period-boundary.ts` (L189~201) — Date → 명시 offset ISO-8601 string single-source `formatKstIso(instant: Date): string`(예 `2026-06-10T06:00:00Z` → `"2026-06-10T15:00:00+09:00"`). Invalid Date / 비-Date → `TypeError`. mapper 가 periodStart 직렬화에 경유할 유일한 helper(raw `.toISOString()` 금지). 요청 mapper 의 `parseKstPeriodInput` 와 대칭 쌍.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts` — T-0545 의 request-side 순수 mapper. 본 task 의 **대칭 reference** — 순수 함수 구조(@Injectable 0 / 부수효과 0 / 입력 비변형 / 한국어 JSDoc / single-source helper 경유 / null/undefined fail-fast). 본 mapper 는 이 패턴을 response 방향으로 mirror. 본 task 는 이 파일을 **편집하지 않고** 패턴만 참고.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.spec.ts` — colocated spec 패턴(순수 함수 직접 호출 + happy/error/branch/negative). 본 response mapper spec 은 `plainToInstance` 불요(순수 함수 직접 호출).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` 신설 — 응답 shape interface(예 `UnevaluatedFillPlanResponse` = `{ batches: { personId: string; periods: { personId: string; period: string; scope: string; periodStart: string }[] }[]; totalGapCount: number; personCount: number }`, periodStart 만 `string`) + `export function toUnevaluatedFillPlanResponse(plan: UnevaluatedFillBatchPlan): UnevaluatedFillPlanResponse`. 동작: `totalGapCount`/`personCount`/`personId`/`period`/`scope` 는 그대로 전사, 각 period 의 `periodStart`(Date)만 `formatKstIso(period.periodStart)` 로 string 변환. `batches` 와 `periods` 는 **새 배열로 map**(입력 비변형). raw `.toISOString()` 사용 0. 파일 상단에 한국어 JSDoc 으로 책임 + "Date→string 직렬화만 single-source helper 경유, 재정렬/필터/dedup/controller 실배선은 본 mapper 밖" 명시.
- [ ] mapper 는 **순수 함수** — `@Injectable` 0, NestJS/Prisma/LLM import 0, 부수효과 0, 입력 plan 객체·배열·원소 비변형(map 으로 새 구조 생성). import 는 입력 타입(`UnevaluatedFillBatchPlan` + 필요 시 `EvaluationPersistContext`) + `formatKstIso` 만(class-validator decorator 0 — 응답 shape 은 검증 대상 아님, plain interface).
- [ ] 방어적 입력 — `plan` 이 null/undefined 면 한국어 메시지 `TypeError` 로 fail-fast(silent 진행 금지). periodStart 가 Invalid Date / 비-Date 면 `formatKstIso` 의 `TypeError` 가 **자연 전파**(mapper 가 재던지지 않음 — single-source error 메시지 보존). 정상 경로에서 planner 출력은 유효 Date 만 담으므로 helper error 는 방어 그물.
- [ ] 새 외부 dependency 0. 새 module import / module 등록 0(mapper 는 NestJS provider 아님 — `assessment-evaluation.module.ts` 미편집). 새 query 표면 / repository 메서드 / ADR / schema / migration 0. 기존 파일 0 LOC 변경.
- [ ] happy-path unit test 1+ — 유효 plan(batches 2 묶음 + 각 묶음 periods 1+ + 유효 periodStart Date + totalGapCount/personCount 일관) 입력 시 응답 shape 반환: totalGapCount/personCount/personId/period/scope 정확히 전사 + periodStart 가 `typeof === "string"` 이고 `formatKstIso` 산출 ISO 문자열(offset 명시 `+09:00` 포함)과 일치 + person 묶음 순서/좌표 순서 보존(재정렬 0).
- [ ] error path unit test 1+ — (a) `plan` null → `TypeError`, (b) `plan` undefined → `TypeError`, (c) 한 period 의 `periodStart` 가 `new Date("invalid")`(Invalid Date) → `formatKstIso` 의 `TypeError` 전파, (d) `periodStart` 가 Date 아닌 값(예 string) → `formatKstIso` 의 `TypeError` 전파 — 각 1+ assertion(`toThrow`).
- [ ] flow / branch coverage — (a) `batches` 빈 배열(`[]`) → 빈 배열 + totalGapCount/personCount 전사(passthrough) 1 test, (b) 한 batch 의 `periods` 빈 배열 → 빈 periods 배열 전사 1 test, (c) periodStart 가 KST 자정 instant → `+09:00` offset ISO 로 직렬화 검증 1 test(formatKstIso 분기를 mapper 경유로 cover), (d) round-trip 검증 — `parseKstPeriodInput(반환 periodStart)` 가 원 Date instant 와 동등(getTime 일치) 1 test.
- [ ] negative cases 충분 cover — 단일 negative 금지. 최소: (1) plan null, (2) plan undefined, (3) periodStart Invalid Date, (4) periodStart 비-Date 타입, (5) 입력 plan.batches 비변형 검증(반환 batches 가 입력과 다른 배열 참조 + 입력 배열/원소 mutate 0), (6) 입력 plan.batches[*].periods 비변형 검증(반환 periods 가 입력과 다른 배열 참조) — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 100% 목표, 순수 함수라 분기 적음).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.spec.ts`(mapper 당 1 개 colocated, request mapper 와 같은 디렉토리). 새 mock helper 추출 불요(순수 함수 직접 호출).

## Out of Scope

- **controller endpoint 실배선** — 본 response mapper 를 controller 메서드에서 호출해 `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill`(T-0542) 출력을 `@Body` 요청(+ T-0545 request mapper)과 연결해 HTTP 응답으로 내보내는 route(`@Get`/`@Post`) + RBAC(`@Roles`) + ValidationPipe 결합은 본 task 밖. 후속 wiring slice. 본 task 는 plan→응답 shape mapper + spec 만.
- **재정렬 / 필터 / dedup / 집계 가공** — `batches`/`periods` 순서 변경, gap 필터, 중복 제거, 추가 요약 필드 계산은 본 mapper 책임 아님(planner / 순수 helper 가 이미 결정한 순서·집계를 그대로 직렬화만). 본 mapper 는 Date→string 변환 + passthrough map 만.
- **요청-side mapper / planner / reader / 순수 조각 / DTO 동작 변경** — `toIntendedPeriodCoordinatesInput`(T-0545) / `EvaluationUnevaluatedFillPlanner` / `EvaluationPersistedRecordsReader` / 순수 4 조각 / compose helper / `UnevaluatedFillPlanRequestDto` / `assessment-evaluation.controller.ts` 의 로직·시그니처 불변. 본 task 는 신규 response mapper 함수 + spec 만(기존 파일 0 LOC 변경).
- **새 module import / module 등록** — mapper 는 순수 함수(NestJS provider 아님)라 module 등록 불요. `assessment-evaluation.module.ts` 미편집. 새 외부 dependency 0.
- **새 query 표면 / 새 repository 메서드 / schema / migration / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045 LAN 수동만), export download chain(Q-0042/Q-0043), import upload infra(게이트3 미승인), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
