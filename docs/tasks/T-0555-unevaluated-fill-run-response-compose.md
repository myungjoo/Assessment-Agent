---
id: T-0555
title: per-좌표 미평가 fill 실행 outcome → controller-facing 응답 shape 순수 compose helper composeUnevaluatedFillRunResponse 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-run-response.compose.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-response.compose.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037·038) — plan→execute 출력-side compose-only 순수 helper: 집계(T-0552)+응답 직렬화(T-0553) 2조각을 1 deterministic step 으로. 입력-side T-0554 의 출력-side 대칭 짝. impure orchestrator/LLM deferred."
---

# T-0555 — per-좌표 미평가 fill 실행 outcome → controller-facing 응답 shape 순수 compose helper composeUnevaluatedFillRunResponse 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038)의 plan→execute 전이는 두 방향으로 진행됐다. **입력-side(orchestration-input 조립)** 는 T-0549(`buildUnevaluatedFillRequests`, merge 522805f) → T-0550(`toPeriodBridgeRequests`, merge 3f2221b) → T-0551(`dedupePeriodBridgeRequests`, merge d6045f4) 3 조각을 닫고, 직전 T-0554(`composeUnevaluatedFillBridgeRequests`, merge 0652e65)가 그 3 조각을 **1 deterministic compose step 으로** 잇는 입력-side compose helper 를 추가해 입력 조립을 완결했다.

**출력-side(batch-run 요약)** 는 두 순수 조각이 이미 박제됐다: T-0552 `aggregateUnevaluatedFillRunResult`(merge 3d95ab1 — per-좌표 실행 outcome 배열 → batch-run 요약 도메인 shape `UnevaluatedFillRunResult` 로 결정적 집계) + T-0553 `toUnevaluatedFillRunResponse`(merge 98a25d0 — 도메인 요약 `UnevaluatedFillRunResult` → controller-facing 안정 HTTP 응답 shape `UnevaluatedFillRunResponse` 로 직렬화). 그러나 이 둘은 **개별 함수일 뿐**, 호출자(향후 impure orchestrator)가 raw per-좌표 outcome 배열로부터 곧장 응답 shape 을 얻으려면 매번 두 함수를 정확한 순서(`aggregate` → `toResponse`)로 직접 엮어야 한다.

본 task 는 그 출력-side 2 조각을 **1 deterministic compose step 으로 잇는** dependency-free 순수 compose helper `composeUnevaluatedFillRunResponse(outcomes: UnevaluatedFillRunOutcome[]): UnevaluatedFillRunResponse` 를 추가한다. 이는 입력-side T-0554 `composeUnevaluatedFillBridgeRequests`(3 조각을 1 compose 로 잇던 helper)의 **출력-side 대칭 짝**이자, detection 사슬의 T-0540 `composeUnevaluatedFillPlan`(4 조각 compose) 동형이다. 조립 순서(`aggregateUnevaluatedFillRunResult` → `toUnevaluatedFillRunResponse`)를 single source 로 박제해, 향후 impure orchestrator 가 순서를 재구현(누락·오순서 risk)하는 대신 본 helper 1 회 호출만으로 raw outcome → HTTP 응답을 닫게 한다.

compose-only 가치는 (i) 2 조각의 결정성·순서·집계·직렬화 정책을 그대로 합성(중간 가공 0 — 각 조각의 status-aware 집계·passthrough 직렬화·비변형·순서 보존 정책 불변), (ii) outcome-level fail-fast + 조각 내부 방어 자연 전파, (iii) plan→execute 출력 단계의 안정 진입점을 미리 닫아 후속 impure wiring 의 책임 표면을 줄이는 데 있다. T-0540·T-0554 도 조각을 그대로 호출만 했음에도 compose helper 를 별도로 둔 동형 근거다.

orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출)·controller 실행 route(POST .../unevaluated-fill-run)·LLM 경로는 impure wiring 의 책임이며, live-LLM standing 게이트(ADR-0045 ACCEPTED, LAN 수동만, 만료 2026-06-30)에 묶여 deferred 다. 본 task 는 그 wiring 이 raw outcome 배열로부터 응답 shape 을 산출하는 순수 출력 조각이다(outcome 을 만들지 않는다 — 이미 산출된 outcome 의 집계+직렬화 합성만).

## Required Reading

- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` — 첫 조각 `aggregateUnevaluatedFillRunResult(outcomes: UnevaluatedFillRunOutcome[]): UnevaluatedFillRunResult` + 입력 타입 `UnevaluatedFillRunOutcome` + 출력 타입 `UnevaluatedFillRunResult` + status union `UnevaluatedFillRunStatus`. outcomes null/undefined·non-array·원소 null/undefined·비-union status·잘못된 evaluatedCount fail-fast 한국어 `TypeError`(인덱스 포함) 패턴. status-aware totalEvaluatedRecords 합산
- `src/assessment-evaluation/dto/unevaluated-fill-run-response.mapper.ts` — 둘째 조각 `toUnevaluatedFillRunResponse(result: UnevaluatedFillRunResult): UnevaluatedFillRunResponse` + 반환 타입 `UnevaluatedFillRunResponse`. 집계 필드 passthrough 전사 + outcomes 새-배열 map(비변형·순서 보존) + result null/undefined·outcomes non-array·원소 null/undefined fail-fast 한국어 `TypeError`
- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts` — detection 사슬 compose-only 대칭 패턴(T-0540 `composeUnevaluatedFillPlan`): wrapper-level 1 차 fail-fast + 조각 호출 순서 박제 + 중간 가공 0 + 조각 내부 방어 자연 전파(재던지지 않음) + @Injectable 0 + NestJS/Prisma/LLM import 0. 본 helper 는 그 출력-side 실행 대칭(단, 본 task 의 입력은 wrapper 가 아니라 outcome 배열 1 개라 wrapper 타입 신설 0)
- (광범위 read 금지 — 위 3 파일 + 신규 colocated spec 외 추가 read 불요. `EvaluationResult`/LLM/repository import 금지. `PeriodBridgeDto` 직접 import 불요 — outcome 좌표는 이미 string 축)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-run-response.compose.ts` 에 dependency-free 순수 함수 `composeUnevaluatedFillRunResponse(outcomes: UnevaluatedFillRunOutcome[]): UnevaluatedFillRunResponse` 를 추가한다. 동작: `aggregateUnevaluatedFillRunResult(outcomes)` → `toUnevaluatedFillRunResponse(result)` 를 이 순서로 호출해 controller-facing 응답 shape `UnevaluatedFillRunResponse` 를 반환한다. **중간 가공 0** — 첫 조각 결과(`UnevaluatedFillRunResult`)를 그대로 둘째 조각에 넘긴다(재정렬/필터/집계 재계산/직렬화 변형 0). 새 타입 정의 0(입력·반환·중간 타입은 import 재사용 — wrapper 타입 신설 불요, 입력이 outcome 배열 1 개이므로).
- [ ] 순수성: `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — 위 2 helper 와 `UnevaluatedFillRunOutcome`/`UnevaluatedFillRunResponse` 타입만 import. 부수효과 0, 입력 `outcomes` 배열·각 원소 비변형(각 조각이 이미 비변형 — 첫 조각은 새 배열 slice, 둘째 조각은 새 배열 map 이므로 자연 보존. 본 helper 가 입력·중간 배열을 mutate 하지 않음을 단언).
- [ ] outcome-level fail-fast + 조각 내부 방어 자연 전파: `outcomes` 가 null/undefined·non-array 일 때 첫 조각 `aggregateUnevaluatedFillRunResult` 의 한국어 `TypeError` 가 그대로 전파된다(본 helper 가 별도 wrapper 방어를 둘지, 조각 전파에 위임할지 택1 고정해 주석·spec 에 못박는다). 원소 null/undefined·비-union status·잘못된 evaluatedCount 등 outcome 내부 구조 오류도 첫 조각의 방어 메시지(인덱스 포함)로 자연 전파됨을 단언.
- [ ] **Happy-path unit test**: 혼합 status(evaluated/skipped/failed 각 1+, 일부 evaluated 에 evaluatedCount 설정·일부 미설정) outcome 배열을 compose 해 (i) 반환이 `toUnevaluatedFillRunResponse(aggregateUnevaluatedFillRunResult(outcomes))` 와 동등(집계 필드 정확·outcomes 순서·내용 일치)하고, (ii) status 별 count 합 불변식(`evaluatedCount + skippedCount + failedCount === totalCount`)이 성립하며, (iii) `totalEvaluatedRecords` 가 evaluated outcome 들의 `evaluatedCount` 합(status-aware)과 일치하고, (iv) outcomes 순서가 입력과 일치(재정렬/dedup 0)함을 단언하는 test 1+. 빈 배열 `[]` → 모든 count 0·빈 outcomes 응답도 단언.
- [ ] **Error path unit test**: `outcomes` 가 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast(첫 조각 전파) 1+. `outcomes` 가 non-array(객체·string)일 때 한국어 메시지 `TypeError`(첫 조각 전파) 1+. 배열 원소가 null/undefined 일 때 한국어 메시지 `TypeError`(인덱스 포함, 첫 조각 전파) 1+. 원소 status 가 허용 union 멤버가 아닐 때(예 `"done"`) 한국어 `TypeError`(인덱스 포함, 첫 조각 전파) 1+. evaluated 원소의 evaluatedCount 가 음수/비정수일 때 한국어 `TypeError`(인덱스 포함) 1+.
- [ ] **Flow / branch coverage**: 본 helper 는 compose-only 라 자체 분기 0 — compose 경로의 대표 case 를 분리: (a) 빈 배열 → 빈 응답, (b) evaluated-only, (c) skipped-only, (d) failed-only, (e) evaluated 에 evaluatedCount 미설정(undefined → totalEvaluatedRecords 0 으로 취급, 첫 조각 분기 전파). "본 helper 자체 분기 없음 — compose 경로 대표 case 분리" 를 spec 주석에 명시.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — outcomes null/undefined, outcomes non-array(객체/string), 원소 null/undefined, 원소 status 비-union 값, status 누락(undefined), evaluatedCount 음수/비정수. 각 조각 방어가 전파됨을 case 별로 cover(단일 negative 만 작성 금지 — 예외 분기마다 cover). 전파 메시지가 첫 조각(`aggregateUnevaluatedFillRunResult` prefix)에서 왔는지 단언으로 합성 순서(집계가 직렬화보다 먼저 호출됨) 회귀를 잡는다.
- [ ] **비변형·합성 순서 단언**: 입력 `outcomes` 배열·각 outcome 객체가 compose 호출 후에도 그대로임을 단언(구조 동등성·길이 불변)하는 test 1+. 반환이 집계+직렬화된 응답 shape(= 2 조각 순서 정확)임을 happy/negative 양쪽에서 단언해 조각 순서 뒤바뀜(예: 직렬화를 집계 전에 호출 — 타입상 불가능하지만 합성 의도 회귀)을 잡는다. 반환 outcomes 가 입력과 별개의 새 배열임(둘째 조각의 map 결과)도 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `unevaluated-fill-run-response.compose.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- 2 조각(`aggregateUnevaluatedFillRunResult`/`toUnevaluatedFillRunResponse`) 로직 재구현·수정·역삽입 — 0. 본 helper 는 기존 조각을 호출 순서대로 엮을 뿐, 어느 조각도 변경하지 않는다(각 조각은 자기 책임으로 분리 유지).
- orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출) — 후속 impure wiring slice. 본 task 는 **이미 산출된 outcome → 응답 shape 까지만**(outcome 을 만들지 않는다).
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설·RBAC 결정 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 / ADR-0045, 만료 2026-06-30 수동) — 건드리지 않음.
- 입력-side 조각(T-0549~T-0551·T-0554 compose) 에 본 출력 compose 역삽입 — 0. 본 helper 는 출력-side 조립 책임으로 분리.
- `@Injectable` service 화·module provider 등록 — 0. 본 task 는 순수 함수만. service wrapper·DI 배선은 후속 impure slice.
- 중간 결과(`UnevaluatedFillRunResult`) 외부 노출·반환 — 0. 본 helper 는 최종 응답 shape `UnevaluatedFillRunResponse` 만 반환한다(중간 집계 단계는 internal).
- `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 — 0(REQ-032 raw-not-stored 정합 — 본 helper 는 건수·status 만 다룬다).
- class-validator 런타임 validate 호출 — controller-scope ValidationPipe 책임. plain 객체만 다룬다.
- 새 dependency / ADR / schema / migration / module provider 등록 / auth 변경 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
