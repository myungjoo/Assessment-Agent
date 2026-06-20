---
id: T-0553
title: 미평가 fill batch-run 요약 → HTTP 응답 shape 순수 mapper toUnevaluatedFillRunResponse 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-run-response.mapper.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-response.mapper.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037·038) — plan→execute 출력-side 2번째 순수 조각: run-result → HTTP 응답 shape mapper. T-0546(plan→response)의 출력-side 대칭. impure orchestrator/LLM deferred."
---

# T-0553 — 미평가 fill batch-run 요약 → HTTP 응답 shape 순수 mapper toUnevaluatedFillRunResponse 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038)의 plan→execute 전이는 입력-side 순수 조각 3 개(T-0549 평탄화 merge 522805f, T-0550 bridge 매핑 merge 3f2221b, T-0551 좌표 dedup merge d6045f4)로 orchestration-input 조립을 닫았고, 출력-side 는 T-0552(merge 3d95ab1, `aggregateUnevaluatedFillRunResult` — per-좌표 실행 outcome 배열을 batch-run 요약 `UnevaluatedFillRunResult` 로 집계)로 첫 조각을 박제했다. 그러나 그 요약 `UnevaluatedFillRunResult` 는 **도메인 타입**일 뿐, controller 가 호출자/UI 에게 돌려줄 **안정된 HTTP 응답 shape** 은 아직 없다.

본 task 는 plan→execute 사슬을 **출력-side 로 한 칸 더 전진**시키는 순수-domain 조각으로, `UnevaluatedFillRunResult` 를 controller-facing plain JSON shape `UnevaluatedFillRunResponse` 로 변환하는 dependency-free 순수 함수 `toUnevaluatedFillRunResponse` 를 추가한다. 이는 detection 사슬의 T-0546(`toUnevaluatedFillPlanResponse` — 계획을 응답 shape 으로 직렬화)의 **출력-side 대칭 짝**이다. 계획 단계에 `UnevaluatedFillBatchPlan` → `UnevaluatedFillPlanResponse` 직렬화가 있었듯, 실행 단계에는 `UnevaluatedFillRunResult` → `UnevaluatedFillRunResponse` 직렬화가 필요하다.

run-result 의 `periodStart` 는 이미 ISO string 이라(T-0552 의 `UnevaluatedFillRunOutcome` 가 `PeriodBridgeDto` 와 동형의 string 축 보유) Date→ISO 변환은 불요하다 — 본 mapper 의 가치는 **도메인 타입과 분리된 안정 응답 contract** 를 두어 (i) controller 가 도메인 객체를 그대로 새는 것을 막고, (ii) 노출 필드를 의도적으로 통제(예: `reason` echo 여부 명시, 내부 전용 필드 누출 차단)하며, (iii) 후속 impure controller route 가 채워 반환할 출력 형을 미리 닫는 데 있다. T-0546 도 `periodStart` 외 5 축이 passthrough 임에도 `UnevaluatedFillPlanResponse` 를 별도로 둔 동형 근거다.

orchestrator 실배선·per-좌표 fresh-collect·LLM 평가·영속·controller 실행 route(POST .../unevaluated-fill-run)는 impure wiring 의 책임이며, live-LLM standing 게이트(ADR-0045 ACCEPTED, LAN 수동만, 만료 2026-06-30)에 묶여 deferred 다. 본 task 는 그 wiring 이 곧장 반환할 결정적 출력 shape 을 미리 닫는 순수 조각이다.

## Required Reading

- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` — 입력 타입 `UnevaluatedFillRunResult`(outcomes + totalCount + evaluatedCount/skippedCount/failedCount + totalEvaluatedRecords)와 `UnevaluatedFillRunOutcome`(4 축 string + status + 선택 evaluatedCount/reason). 본 mapper 의 변환 source. T-0552 의 status union/집계 규칙도 여기 박제
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — 출력-side 대칭 패턴(T-0546): interface 정의(별도 response shape) + null/undefined fail-fast 한국어 `TypeError` + 비변형 새-배열 map + @Injectable 0 + NestJS/Prisma/LLM import 0 + 부수효과 0. 본 mapper 는 그 실행-단계 대칭(periodStart 는 이미 string 이라 변환 없는 passthrough map)
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — outcome 4 축의 동형 source `PeriodBridgeDto`(personId/period/scope/periodStart:string). class-validator decorator 는 controller-scope ValidationPipe 책임이라 본 mapper 는 plain 객체만 다룬다(런타임 validate 호출 0)
- (광범위 read 금지 — 위 3 파일 + colocated spec 외 추가 read 불요. `EvaluationResult` 타입 직접 import 금지 — 본 mapper 는 집계 요약만 직렬화하고 평가문 본문은 다루지 않는다, REQ-032 raw-not-stored 정합)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-run-response.mapper.ts` 에 다음을 추가한다:
  - per-좌표 outcome 응답 shape `UnevaluatedFillRunOutcomeResponse` — 좌표 4 축(personId/period/scope/periodStart:string) + `status: "evaluated" | "skipped" | "failed"` + 선택 `evaluatedCount?: number` + 선택 `reason?: string`. 도메인 outcome 의 노출 필드를 명시적으로 통제(`UnevaluatedFillRunStatus` 타입을 import 재사용해 status 타입 동기).
  - batch-run 응답 shape `UnevaluatedFillRunResponse` — `outcomes: UnevaluatedFillRunOutcomeResponse[]` + `totalCount` + `evaluatedCount`/`skippedCount`/`failedCount` + `totalEvaluatedRecords`(도메인 `UnevaluatedFillRunResult` 와 동형 집계 필드 passthrough).
  - 순수 함수 `toUnevaluatedFillRunResponse(result: UnevaluatedFillRunResult): UnevaluatedFillRunResponse` — `result` 의 집계 필드는 그대로 전사(passthrough), `outcomes` 는 새 배열로 map(입력 비변형). 각 outcome 의 4 축·status·evaluatedCount·reason 을 응답 outcome 으로 복사(periodStart 는 이미 string — 추가 직렬화 0). 부수효과 0 / 외부 의존 0(`@Injectable`·NestJS·Prisma·LLM·class-validator 런타임 호출·repository import 0, `unevaluated-fill-run-result.ts` 의 타입만 import).
- [ ] 비변형·순서 보존: 반환은 새 객체이고 `outcomes` 는 새 배열이다. 입력 `result.outcomes` 배열·각 outcome 객체는 mutate 0. outcome 순서는 입력과 일치한다(재정렬/dedup/필터 0). 집계 필드는 입력값을 그대로 전사한다(`totalCount`/status 별 count/`totalEvaluatedRecords` 동일).
- [ ] **Happy-path unit test**: 혼합 status outcome(evaluated/skipped/failed 각 1+, evaluatedCount·reason 일부 설정)을 담은 `UnevaluatedFillRunResult` 를 변환해 (i) 집계 필드 5 종이 입력과 동일하게 전사되고, (ii) `outcomes` 의 각 4 축·status·evaluatedCount·reason 이 입력과 일치하며, (iii) outcome 순서·길이가 입력과 일치함을 단언하는 test 1+.
- [ ] **Error path unit test**: `result` 가 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast 1+. `result.outcomes` 가 null/undefined·non-array 일 때 한국어 메시지 `TypeError` 1+. 배열 원소가 null/undefined 일 때 한국어 메시지 `TypeError`(인덱스 포함) 1+.
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (a) 빈 `outcomes` `[]` + 집계 필드 0 → 빈 응답 outcomes·집계 0 passthrough, (b) `evaluatedCount` 설정 outcome → 응답에 그대로 echo, (c) `evaluatedCount` 미설정(undefined) outcome → 응답에서도 undefined 유지(임의로 0 채우지 않음), (d) `reason` 설정/미설정 각각 → 설정 시 echo, 미설정 시 undefined 유지.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — result null/undefined, result non-object(string·number 등 — 명세대로 일관 처리: outcomes 접근 전 fail-fast or outcomes 방어로 흡수, 택1 고정해 주석·spec 못박기), result.outcomes null/undefined, result.outcomes non-array(객체·string), outcomes 원소 null/undefined. 단일 negative 만 작성 금지 — 예외 분기마다 cover.
- [ ] **비변형 단언**: 입력 `result`·`result.outcomes`·각 outcome 객체 모두 호출 후 그대로임을 단언(배열 길이·원소 참조 동등성)하는 test 1+. 반환 `outcomes` 가 입력과 다른 배열 참조임도 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `unevaluated-fill-run-response.mapper.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- orchestrator/bridge 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출 → 집계) — 후속 impure wiring slice. 본 task 는 **이미 집계된 run-result 의 순수 직렬화만**(outcome 도 집계도 만들지 않는다).
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설·RBAC 결정 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 / ADR-0045, 만료 2026-06-30 수동) — 건드리지 않음.
- 집계 로직(status 별 count·totalEvaluatedRecords 산출) 재구현 — 0. 그것은 T-0552 `aggregateUnevaluatedFillRunResult` 의 책임이며 본 mapper 는 이미 집계된 값을 passthrough 전사만 한다(재계산/검산 0).
- `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 — 0. 본 mapper 는 건수·status·좌표만 직렬화한다(REQ-032 raw-not-stored 정합).
- periodStart Date→ISO 변환(formatKstIso 호출 등) — 0. run-result 의 periodStart 는 이미 ISO string 이라 추가 직렬화 불요(plan-side T-0546 와 다른 점).
- class-validator 런타임 validate 호출(`validateOrReject` 등) — controller-scope ValidationPipe 책임. 본 mapper 는 plain 객체만 다룬다.
- 상류 입력-side 조각(T-0549/T-0550/T-0551) 또는 집계 helper(T-0552)에 본 응답 타입 역삽입 금지 — 그것들은 각자의 책임으로 분리, 본 mapper 는 출력 직렬화 책임.
- 새 dependency / ADR / schema / migration / module provider 등록 / auth 변경 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
