---
id: T-0554
title: 미평가 fill batch plan → 중복 제거된 PeriodBridgeDto[] 순수 compose helper composeUnevaluatedFillBridgeRequests 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-bridge-requests.ts
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-bridge-requests.spec.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037·038) — plan→execute 입력-side compose-only 순수 helper: 3 조각(flatten/bridge-map/dedup)을 1 deterministic step 으로. T-0540 detection-chain compose 대칭. impure orchestrator/LLM deferred."
---

# T-0554 — 미평가 fill batch plan → 중복 제거된 PeriodBridgeDto[] 순수 compose helper composeUnevaluatedFillBridgeRequests 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038)의 plan→execute 전이는 **입력-side 순수 조각 3 개**로 orchestration-input 조립을 닫았다: T-0549 `buildUnevaluatedFillRequests`(merge 522805f — batch plan 을 per-좌표 요청 intent `UnevaluatedFillRequest[]` 로 평탄화), T-0550 `toPeriodBridgeRequests`(merge 3f2221b — intent[] → 기존 per-좌표 실행 진입점 `PeriodBridgeDto[]` 1:1 매핑), T-0551 `dedupePeriodBridgeRequests`(merge d6045f4 — 좌표 4-tuple 중복 first-wins 제거). 그러나 이 3 조각은 **개별 함수일 뿐**, 호출자(향후 impure orchestrator)가 `UnevaluatedFillBatchPlan` 하나로부터 "일괄 평가에 흘릴 깨끗한 좌표 배열"을 얻으려면 매번 세 함수를 정확한 순서로 직접 엮어야 한다.

본 task 는 그 3 조각을 **1 deterministic compose step 으로 잇는** dependency-free 순수 compose helper `composeUnevaluatedFillBridgeRequests(plan: UnevaluatedFillBatchPlan): PeriodBridgeDto[]` 를 추가한다. 이는 detection 사슬의 T-0540 `composeUnevaluatedFillPlan`(merge f3c0a79 — enumerate/project/select/batch-plan 4 조각을 1 compose 로 잇던 순수 helper)의 plan→execute 입력-side 대칭 짝이다. 조립 순서(`buildUnevaluatedFillRequests` → `toPeriodBridgeRequests` → `dedupePeriodBridgeRequests`)를 single source 로 박제해, 향후 impure orchestrator 가 순서를 재구현(누락·오순서 risk)하는 대신 본 helper 1 회 호출만으로 입력을 닫게 한다.

compose-only 가치는 (i) 3 조각의 결정성·순서 정책을 그대로 합성(중간 가공 0 — 각 조각의 비변형·순서 보존·dedup 정책 불변), (ii) plan-level fail-fast + 조각 내부 방어 자연 전파, (iii) plan→execute 입력 단계의 안정 진입점을 미리 닫아 후속 impure wiring 의 책임 표면을 줄이는 데 있다. T-0540 도 4 조각을 그대로 호출만 했음에도 compose helper 를 별도로 둔 동형 근거다.

orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출)·controller 실행 route(POST .../unevaluated-fill-run)·LLM 경로는 impure wiring 의 책임이며, live-LLM standing 게이트(ADR-0045 ACCEPTED, LAN 수동만, 만료 2026-06-30)에 묶여 deferred 다. 본 task 는 그 wiring 이 입력으로 받을 결정적 좌표 배열을 plan 하나로부터 산출하는 순수 조각이다.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-requests.ts` — 첫 조각 `buildUnevaluatedFillRequests(plan: UnevaluatedFillBatchPlan): UnevaluatedFillRequest[]` + 입력 타입 `UnevaluatedFillBatchPlan`(import 경로 확인). plan-level null/undefined·batches non-array fail-fast 한국어 `TypeError` 패턴
- `src/assessment-evaluation/dto/fill-requests-to-bridge.mapper.ts` — 둘째 조각 `toPeriodBridgeRequests(requests: UnevaluatedFillRequest[]): PeriodBridgeDto[]`. 4축 passthrough + reevaluate 미설정(fill=first-write-wins) + 순서 보존 1:1 map
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — 셋째 조각 `dedupePeriodBridgeRequests(requests: PeriodBridgeDto[]): PeriodBridgeDto[]`. 4-tuple key first-wins·순서 보존 dedup, 보존 원소 입력 참조 재사용
- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts` — compose-only 대칭 패턴(T-0540 `composeUnevaluatedFillPlan`): plan-level fail-fast + 조각 호출 순서 박제 + 중간 가공 0 + 조각 내부 방어 자연 전파 + @Injectable 0 + NestJS/Prisma/LLM import 0. 본 helper 는 그 입력-side 실행 대칭
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 반환 원소 타입 `PeriodBridgeDto`(4축 + 선택 reevaluate). class-validator decorator 는 controller-scope ValidationPipe 책임이라 본 helper 는 plain 객체만 다룬다(런타임 validate 호출 0)
- (광범위 read 금지 — 위 5 파일 + 신규 colocated spec 외 추가 read 불요. `EvaluationResult`/LLM/repository import 금지)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-unevaluated-fill-bridge-requests.ts` 에 dependency-free 순수 함수 `composeUnevaluatedFillBridgeRequests(plan: UnevaluatedFillBatchPlan): PeriodBridgeDto[]` 를 추가한다. 동작: `buildUnevaluatedFillRequests(plan)` → `toPeriodBridgeRequests(...)` → `dedupePeriodBridgeRequests(...)` 를 이 순서로 호출해 중복 제거된 `PeriodBridgeDto[]` 를 반환한다. **중간 가공 0** — 각 조각 결과를 그대로 다음 조각에 넘긴다(재정렬/필터/추가 dedup/좌표 변형 0). 새 타입 정의 0(반환·입력 타입은 import 재사용).
- [ ] 순수성: `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — 위 3 helper 와 `UnevaluatedFillBatchPlan`/`PeriodBridgeDto` 타입만 import. 부수효과 0, 입력 `plan` 비변형(각 조각이 이미 비변형이므로 자연 보존 — 본 helper 가 plan/중간 배열을 mutate 하지 않음을 단언).
- [ ] plan-level fail-fast + 조각 내부 방어 자연 전파: `plan` 이 null/undefined 일 때 첫 조각 `buildUnevaluatedFillRequests` 의 한국어 `TypeError` 가 그대로 전파된다(본 helper 가 별도 wrapper 방어를 둘지, 조각 전파에 위임할지 택1 고정해 주석·spec 에 못박는다). plan 내부 구조 오류(batches non-array, periodStart Invalid Date 등)도 해당 조각의 방어 메시지로 자연 전파됨을 단언.
- [ ] **Happy-path unit test**: 여러 person × 여러 좌표(일부 좌표 중복 포함)를 담은 정상 `UnevaluatedFillBatchPlan` 을 compose 해 (i) 반환이 `dedupePeriodBridgeRequests` 결과와 동일(중복 제거됨)하고, (ii) 4축이 plan 좌표와 일치하며 reevaluate 가 undefined 이고, (iii) 순서가 first-wins·등장순서로 보존됨을 단언하는 test 1+. 중복 없는 plan → 길이가 totalGapCount 와 동일(dedup 무손실)도 단언.
- [ ] **Error path unit test**: `plan` 이 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast(첫 조각 전파) 1+. plan.batches 가 non-array 일 때 한국어 메시지 `TypeError`(조각 전파) 1+. plan 의 한 좌표 periodStart 가 Invalid Date / 비-Date 일 때 `TypeError`(formatKstIso 자연 전파) 1+.
- [ ] **Flow / branch coverage**: 본 helper 는 compose-only 라 분기 0 — 단, compose 경로의 대표 case 를 분리 — (a) 빈 plan(batches `[]` 또는 빈 periods) → 빈 `[]` 반환, (b) 중복 좌표 포함 plan → dedup 으로 길이 감소, (c) 중복 없는 plan → 길이 보존. "본 helper 자체 분기 없음 — compose 경로 대표 case 분리" 를 spec 주석에 명시.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — plan null/undefined, plan non-object, plan.batches null/undefined, plan.batches non-array, 묶음 원소 null/undefined, periods non-array, 좌표 periodStart Invalid/비-Date. 각 조각 방어가 전파됨을 case 별로 cover(단일 negative 만 작성 금지). 전파 메시지가 어느 조각에서 왔는지(함수명 prefix) 단언으로 합성 순서 회귀를 잡는다.
- [ ] **비변형·합성 순서 단언**: 입력 `plan` 호출 후 그대로임을 단언(구조 동등성)하는 test 1+. 중간 배열을 mock spy 등으로 검사할 필요는 없으나, 반환이 중복 제거된 배열임(= 3 조각 순서 정확)을 happy/negative 양쪽에서 단언해 조각 순서 뒤바뀜(예: dedup 을 bridge-map 전에 호출)을 회귀로 잡는다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `evaluation-unevaluated-fill-bridge-requests.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- 3 조각(`buildUnevaluatedFillRequests`/`toPeriodBridgeRequests`/`dedupePeriodBridgeRequests`) 로직 재구현·수정·역삽입 — 0. 본 helper 는 기존 조각을 호출 순서대로 엮을 뿐, 어느 조각도 변경하지 않는다(각 조각은 자기 책임으로 분리 유지).
- orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출 → 집계) — 후속 impure wiring slice. 본 task 는 **입력 좌표 배열 산출까지만**(평가도 outcome 도 만들지 않는다).
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설·RBAC 결정 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 / ADR-0045, 만료 2026-06-30 수동) — 건드리지 않음.
- 출력-side 조각(T-0552 집계 / T-0553 response mapper) 에 본 compose 역삽입 — 0. 본 helper 는 입력-side 조립 책임.
- `@Injectable` service 화·module provider 등록 — 0. 본 task 는 순수 함수만. service wrapper·DI 배선은 후속 impure slice.
- 중간 결과(intent[] / pre-dedup bridge[]) 외부 노출·반환 — 0. 본 helper 는 최종 중복 제거된 `PeriodBridgeDto[]` 만 반환한다(중간 단계는 internal).
- 새 dependency / ADR / schema / migration / module provider 등록 / auth 변경 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
