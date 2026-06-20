---
id: T-0552
title: per-좌표 미평가 fill 실행 결과 → batch-run 요약 shape 결정적 집계 순수 helper aggregateUnevaluatedFillRunResult 추가
phase: P5
status: DONE
commitMode: pr
mergedAs: 3d95ab1
prNumber: 466
reviewRounds: 1
completedAt: 2026-06-20T07:25:30Z
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-run-result.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-result.spec.ts
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037·038) — plan→execute 전이 4번째 순수 조각(출력-side): per-좌표 실행 결과 → batch-run 요약 shape 결정적 집계. impure orchestrator/LLM deferred."
---

# T-0552 — per-좌표 미평가 fill 실행 결과 → batch-run 요약 shape 결정적 집계 순수 helper aggregateUnevaluatedFillRunResult 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038)의 plan→execute 전이는 지금까지 **입력-side(orchestration-input 조립)** 순수 조각 3 개로 진행됐다 — T-0549(merge 522805f, batch plan → `UnevaluatedFillRequest[]` 평탄화), T-0550(merge 3f2221b, 요청 intent → `PeriodBridgeDto[]` 매핑), T-0551(merge d6045f4, `PeriodBridgeDto[]` 좌표 중복 결정적 제거 first-wins). 이로써 일괄 평가에 넘길 깨끗한 입력(중복 제거된 좌표 배열)이 닫혔다. 그러나 일괄 평가를 **실제로 흘린 뒤** 그 결과를 호출자/UI 에게 돌려줄 **출력-side(batch-run 요약)** shape 은 아직 없다.

본 task 는 plan→execute 사슬을 **출력-side 로 한 칸 전진**시키는 **4 번째 순수-domain 조각**으로, per-좌표 실행 outcome 배열(각 좌표 + 결정적 status: `"evaluated" | "skipped" | "failed"`)을 받아 batch-run 요약 shape `UnevaluatedFillRunResult` 로 접는 dependency-free 순수 함수 `aggregateUnevaluatedFillRunResult` 를 추가한다. 입력-side 의 T-0546(`toUnevaluatedFillPlanResponse` — 계획을 응답 shape 으로 직렬화)의 **출력-side 대칭 짝**이다 — 계획 단계에 `UnevaluatedFillPlanResponse`(totalGapCount/personCount 집계)가 있었듯, 실행 단계에는 evaluated/skipped/failed 수와 per-좌표 outcome 리스트를 담은 결정적 요약이 필요하다.

이 helper 가 **outcome 을 직접 만들지는 않는다** — 그것은 impure orchestrator wiring(중복 제거된 `PeriodBridgeDto[]` 를 좌표별로 순회하며 fresh-collect → LLM 평가 → 영속)의 책임이며, 그 wiring 은 live-LLM standing 게이트(ADR-0045 ACCEPTED, LAN 수동만, 만료 2026-06-30)에 묶여 deferred 다. 본 task 는 그 impure wiring 이 **곧장 채워 반환할 결정적 출력 shape 과 집계 규칙을 미리 닫아**, wiring 진입 시 출력 형 결정·집계 로직을 다시 고민할 필요가 없게 한다. LLM 네트워크 round-trip·orchestrator 실배선·controller 실행 route 는 후속 impure slice 로 분리 유지한다.

## Required Reading

- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 각 outcome 이 가리키는 좌표 4 축 `PeriodBridgeDto`(personId/period/scope/periodStart:string + 선택 reevaluate?:boolean). 본 helper 의 outcome 타입은 이 4 축을 식별 좌표로 보유한다(coordinate echo). class-validator decorator 는 controller-scope ValidationPipe 책임이라 본 helper 는 plain 객체만 다룬다(런타임 validate 호출 0)
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — 입력-side 의 집계/직렬화 response shape 패턴(T-0546): interface 정의 + null/undefined fail-fast 한국어 `TypeError` + 비변형 map + @Injectable 0 + Prisma/LLM import 0. 본 helper 는 그 출력-side 대칭(실행 결과 집계)
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — 직전 입력-side 조각(T-0551). 배열 순회 + 결정성 + 비변형 + 한국어 `TypeError`(인덱스 포함) 방어 패턴 mirror. 본 helper 는 그 출력 좌표를 실행한 뒤의 결과를 집계
- (광범위 read 금지 — 위 3 파일 + colocated spec 외 추가 read 불요. `EvaluationResult` 타입 직접 import 금지 — 본 helper 는 실행 결과 건수(count)만 집계하고 평가문 본문은 다루지 않는다, REQ-032 raw-not-stored 정합)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` 에 다음을 추가한다:
  - per-좌표 실행 outcome 타입 `UnevaluatedFillRunOutcome` — 좌표 4 축(personId/period/scope/periodStart:string) + 결정적 `status: "evaluated" | "skipped" | "failed"` + 선택 `evaluatedCount?: number`(evaluated 시 생성된 평가 건수, ≥ 0 정수) + 선택 `reason?: string`(skipped/failed 사유 메모). status union 의 single-source 배열 const + `satisfies` compile-time 동기는 `evaluation-result.ts` CONTRIBUTION_LEVELS 패턴 mirror.
  - batch-run 요약 shape 타입 `UnevaluatedFillRunResult` — `outcomes: UnevaluatedFillRunOutcome[]` + `totalCount`(전체 outcome 수) + `evaluatedCount`/`skippedCount`/`failedCount`(status 별 좌표 수) + `totalEvaluatedRecords`(evaluated outcome 들의 `evaluatedCount` 합, 미설정은 0 으로 취급).
  - 순수 함수 `aggregateUnevaluatedFillRunResult(outcomes: UnevaluatedFillRunOutcome[]): UnevaluatedFillRunResult` — outcome 배열을 1 회 순회해 위 집계 필드를 결정적으로 산출한다. 부수효과 0 / 외부 의존 0(`@Injectable`·Prisma·LLM·class-validator 런타임 호출·repository import 0, 자기 타입 정의만).
- [ ] 결정성·순서 보존: 반환 `outcomes` 는 입력 순서를 그대로 보존한다(재정렬/dedup/필터 0 — 같은 좌표가 두 번 실행됐으면 둘 다 보존). 집계 카운트는 입력에 대해 결정적이다(`totalCount === outcomes.length`, `evaluatedCount + skippedCount + failedCount === totalCount`).
- [ ] **Happy-path unit test**: 혼합 status outcome 배열(evaluated/skipped/failed 각 1+)을 집계해 (i) 각 status 카운트가 정확하고, (ii) `totalCount`/합 불변식이 성립하고, (iii) `totalEvaluatedRecords` 가 evaluated outcome 들의 `evaluatedCount` 합과 일치하며, (iv) `outcomes` 순서·내용이 입력과 일치함을 단언하는 test 1+.
- [ ] **Error path unit test**: `outcomes` 가 null/undefined·non-array 일 때 한국어 메시지 `TypeError` fail-fast 1+. 배열 원소가 null/undefined 일 때 한국어 메시지 `TypeError`(인덱스 포함) 1+. 원소의 `status` 가 허용 union 멤버가 아닐 때(예 `"done"`) 한국어 메시지 `TypeError`(인덱스 포함) 1+.
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (a) 빈 배열 `[]` → 모든 카운트 0·`totalEvaluatedRecords` 0·빈 `outcomes`, (b) evaluated-only, (c) skipped-only, (d) failed-only, (e) evaluated outcome 의 `evaluatedCount` 미설정 시 `totalEvaluatedRecords` 합산에서 0 으로 취급(undefined → 0 분기), (f) evaluated 가 아닌 status 에 `evaluatedCount` 가 설정돼 있어도 합산은 evaluated outcome 만 더함(또는 명세대로 status 무관 합산 — 택1해 주석·spec 으로 일관 고정).
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — outcomes null/undefined, outcomes non-array(객체·string), 원소 null/undefined, status 비-union 값, status 누락(undefined), `evaluatedCount` 가 음수/비정수일 때의 처리(fail-fast 또는 그대로 합산 — 명세대로 일관 고정해 spec 으로 못박기). 단일 negative 만 작성 금지 — 예외 분기마다 cover.
- [ ] **비변형 단언**: 입력 `outcomes` 배열·각 outcome 객체 모두 mutate 0 — 반환 `UnevaluatedFillRunResult` 는 새 객체이고 `outcomes` 는 새 배열(원소는 입력 객체 참조 그대로 재사용 또는 명세대로 — 일관 고정). 입력 배열 길이가 호출 후에도 그대로임을 단언하는 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `unevaluated-fill-run-result.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- bridge orchestrator/service 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출) — 후속 impure wiring slice. 본 task 는 **이미 산출된 outcome 의 순수 집계만**(outcome 을 만들지 않는다).
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 / ADR-0045, 만료 2026-06-30 수동) — 건드리지 않음.
- `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 — 0. 본 helper 는 건수(count)와 status 만 집계한다(REQ-032 raw-not-stored 정합 — 평가 본문은 영속 layer 책임).
- 상류 입력-side 조각(T-0549/T-0550/T-0551)에 본 출력 타입 역삽입 금지 — 그 셋은 입력 조립 책임, 본 helper 는 출력 집계 책임으로 분리.
- class-validator 런타임 validate 호출(`validateOrReject` 등) — controller-scope ValidationPipe 책임. 본 helper 는 plain 객체만 다룬다.
- HTTP 직렬화용 별도 response mapper(periodStart Date→ISO 등) — 본 outcome 좌표는 이미 `PeriodBridgeDto` 와 동형의 string 축이라 추가 직렬화 불요. 필요 시 후속 slice.
- 새 dependency / ADR / schema / migration / module provider 등록 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
