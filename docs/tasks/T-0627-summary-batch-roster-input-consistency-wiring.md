---
id: T-0627
title: R-61 요약 batch roster-진입점에 roster-input orphan-result 가드 단언 지점 배선 — evaluateBatchForRoster 가 buildSummaryBatchOrchestratorInput 전 assertSummaryBatchRosterInputConsistent 호출
phase: P5
status: DONE
prNumber: 541
mergedAs: a5eeaea
reviewRounds: 1
completedAt: 2026-06-24T08:01:58Z
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0626 가드(PR #540 43337ab) 닫힌 후 그 첫 follow-up. evaluateBatchForRoster 가 roster 위임 전 assertSummaryBatchRosterInputConsistent(roster) 단언 배선(orphan-result silent drop 차단, T-0621 mirror). endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0627 — R-61 요약 batch roster-진입점에 roster-input orphan-result 가드 단언 지점 배선

## Why

PLAN.md P5 bullet 97 (REQ-061 "일/주/월 요약 평가")의 roster-input 무결성
배선 조각이다. p5-summary-aggregate stream 의 순수 layer · `@Injectable`
orchestrator service · roster-진입점 · roster-input orphan 가드가 모두 머지됐다:

- T-0624 `buildSummaryBatchOrchestratorInput`(PR #538) — roster 를 좌표 enumerate
  포함 `SummaryBatchOrchestratorInput` 으로 조립. `resultsByCoordinate` 는 변형·검증
  0 으로 pass-through.
- T-0625 `evaluateBatchForRoster(roster)`(PR #539 a62ef06) — 위 composer 로 입력을
  조립한 뒤 기존 `evaluateBatch(input)` 에 위임하는 roster-진입점.
- T-0626 `assertSummaryBatchRosterInputConsistent(input)`(PR #540 43337ab) — roster
  의 `resultsByCoordinate` 에 enumerate 가 산출하지 않은 **orphan key**(typo
  personId / 잘못된 periodStart / stray 좌표 key)가 있으면 `RangeError`(orphan 식별
  정보 포함), `input` null/undefined 면 `TypeError` 로 fail-fast 하는 순수 가드.

지금 그 가드는 **존재하나 어디에도 호출되지 않는다** — T-0626 Out of Scope 가
"가드 호출을 composer 안에 배선하는 것도 본 task 범위 밖(별도 wiring follow-up —
T-0621 가드 배선 패턴과 동형)"으로 의도적으로 분리했다. 그 결과 caller 가 잘못
만든 roster `resultsByCoordinate`(orphan key)가 `evaluateBatchForRoster` 를 통과해
`buildSummaryBatchOrchestratorInput` → `buildSummaryBatchPlan` 으로 흘러가면, 그
orphan 좌표가 좌표 집합에 없어 **조용히 drop** 되고 caller 의 실수가 가려진다.

본 task 는 그 빈칸을 채운다 — `evaluateBatchForRoster` 가 roster 를 composer 로
조립하기 **직전**, `assertSummaryBatchRosterInputConsistent(roster)` 를 단언 지점으로
호출해 orphan-result 가 plan-building 단계에서 silent drop 되기 **전에** fail-fast 로
막는다. 이는 T-0621 이 `runSummaryBatchPipeline` 에 outcome 가드를 배선한 것과
정확히 동형이다(exists-but-unwired 가드 → 산출 경로 직전 단언 지점 배선).

순수성 보존 — `assertSummaryBatchRosterInputConsistent` 는 순수 가드(부수효과 0 ·
입력 비변형 · 동일 입력 → 동일 동작)이므로 service 의 직접 부수효과·DI 계약을
바꾸지 않는다(import + 호출 1줄만). 새 외부 dependency 0 · DB write/migration 0 ·
raw 미저장(R-59). p5-summary-aggregate stream 내부 wiring 이며, realdata-e2e /
evaluation-adjustments stream 과 파일 disjoint(touchesFiles 교집합 0).
endpoint(Q-0030 RBAC) / collection bridge(cross-module RBAC) 같은 §5 ADR-gated
BLOCKED 영역은 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` — 배선 대상.
  `evaluateBatchForRoster(roster)`(L202~) 본문에서 `const input =
  buildSummaryBatchOrchestratorInput(roster);` **직전**에 가드 호출
  (`assertSummaryBatchRosterInputConsistent(roster);`)을 삽입한다. 좌표-진입점
  `evaluateBatch(input)` 은 좌표를 외부에서 받지 않으므로 본 가드 배선 범위 밖이다
  (roster-진입점만 — composer 가 좌표를 enumerate 한다). JSDoc 의 `@throws` 절에
  가드 전파를 한 줄 반영.
- `src/assessment-evaluation/domain/summary-batch-roster-input-consistency.ts` —
  import 대상 가드. `export function assertSummaryBatchRosterInputConsistent(input:
  SummaryBatchRosterInput): void;` 시그니처·에러 정책(orphan key → `RangeError` /
  null·undefined → `TypeError`) 확인. **변경 금지** — import·호출만.
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — composer
  `buildSummaryBatchOrchestratorInput(roster)` 와 `SummaryBatchRosterInput` surface
  (가드·composer 가 공유하는 입력 타입). 가드는 composer 와 동일 roster 를 받는다.
- `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts` — 기존
  service spec. 본 task 는 여기에 가드 배선 검증 케이스를 추가한다(기존 케이스 무회귀
  유지). roster fixture·주입 orchestrator mock 패턴 재사용.

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 의 `evaluateBatchForRoster(roster)`
  본문에서 `buildSummaryBatchOrchestratorInput(roster)` 호출 **직전**에
  `assertSummaryBatchRosterInputConsistent(roster)` 를 호출하는 한 줄(+ 한국어 주석)을
  삽입한다. import 문 1줄 추가
  (`import { assertSummaryBatchRosterInputConsistent } from "./domain/summary-batch-roster-input-consistency";`).
  가드 호출은 void(무회귀) — 정합한 roster 면 흐름이 그대로 composer 조립 →
  `evaluateBatch(input)` 위임으로 이어진다.
- [ ] JSDoc 갱신 — `evaluateBatchForRoster` 의 JSDoc `@throws` 절에 "roster 의
  `resultsByCoordinate` 에 enumerate 가 산출하지 않은 orphan key 가 있으면
  `assertSummaryBatchRosterInputConsistent` 가 `RangeError` 로 fail-fast(silent drop
  차단), roster null/undefined 면 `TypeError`" 를 한 줄 박제. 본문 흐름 주석(1~2
  단계)에도 "composer 조립 전 orphan 가드 단언" 한 문장 반영.
- [ ] **순수성·계약 보존** — service 는 여전히 직접 부수효과 0(위임만) · 생성자/DI
  무변경 · 좌표-진입점 `evaluateBatch` 무변경. 가드는 순수 검증이므로 입력 비변형 ·
  결정성 유지. 새 외부 dependency 0 · migration 0 · raw 미저장(R-59).
- [ ] **Happy-path test 1+**: orphan 0 인 정합 roster(enumerate 좌표와 일치하는
  `resultsByCoordinate` key 만 보유)로 `evaluateBatchForRoster` 호출 시 (a) throw 0,
  (b) 주입 orchestrator 의 `evaluateBatch` 가 정상 위임 호출되어 `{ plan, outcomes,
  report, summaryLine }` 4 산출을 그대로 반환(기존 happy 케이스 무회귀 보장 + 가드
  통과 확인).
- [ ] **Error path test 1+**: 가드가 실제로 호출됨을 검증 —
  `assertSummaryBatchRosterInputConsistent` 를 `jest.spyOn`(또는 module mock)으로
  가로채 (a) composer 호출 **전에** 가드가 정확히 1회 `roster` 인자로 호출됨,
  (b) orphan key 있는 roster 로 호출 시 가드가 throw 하는 `RangeError` 가 service
  밖으로 그대로 전파됨(swallow 0) + `evaluateBatch` 위임 **미도달**(부분 평가 위장 0)
  을 검증. roster null/undefined → 가드 `TypeError` 전파 1+.
- [ ] **Flow / branch 분기 cover** — 가드 호출 위치 정합:
  - (a) orphan 0 정합 roster → 가드 통과 → composer 조립 → `evaluateBatch` 위임 1회 +
    정상 반환,
  - (b) orphan 1+ roster → 가드 `RangeError` throw → composer 호출 **미도달** +
    `evaluateBatch` 호출 **0**(spy 로 두 하위 호출 미도달 검증 1+). (좌표-진입점
    `evaluateBatch(input)` 직접 호출 경로는 본 task 변경 없음 — roster-진입점만 cover.)
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) orphan 1건만 있는 roster → `RangeError` 전파 + 위임 미도달 1+ test,
  (2) orphan 다건 roster → `RangeError` 전파 1+ test,
  (3) roster null/undefined → 가드 `TypeError` 전파(composer/위임 미도달) 1+ test,
  (4) 정합 roster 호출 시 입력 비변형(가드 배선 추가가 `roster.personIds /
    granularities / resultsByCoordinate / now` 를 변형하지 않음) deep 동일성 1+ test,
  (5) 같은 정합 roster 2회 호출 → 두 호출 모두 정상 위임·반환(결정성·잔여 상태 누수 0)
    1+ test.
- [ ] colocated spec `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts`
  에 위 happy/error/branch/negative 케이스 추가 — 기존 케이스 무회귀 유지. roster
  fixture·주입 orchestrator 는 mock 함수/객체 리터럴로 단위 격리. 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — service 변경분·신규 분기 cover, 변경 service 파일
  line/branch/function 100% 목표.

## Out of Scope

- **`summary-batch-roster-input-consistency.ts` 변경 금지** — 본 task 는 가드를
  호출(배선)만. 가드 로직·에러 정책 수정은 별도 slice. (T-0626 가 이미 머지·검증됨.)
- **`buildSummaryBatchOrchestratorInput` / `summary-batch-roster-input.ts` 변경 금지**
  — composer 본문·pass-through 계약 변경 0. 가드는 composer 와 독립 단언 지점.
- **좌표-진입점 `evaluateBatch(input)` 변경 금지** — 본 task 는 roster-진입점
  `evaluateBatchForRoster` 에만 가드를 배선한다. 좌표-진입점은 좌표를 외부에서 받지
  않으므로 orphan 가드 대상 아님(composer 가 enumerate). 생성자/DI/providers 무변경.
- **자동 복구 / orphan key drop / map 정규화 금지** — 손상 roster 를 고치거나 clamp
  하지 않는다(fail-fast). 가드가 throw 하면 그대로 전파.
- **manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 0** —
  Q-0030 RBAC ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → `EvaluationResult[]`) 0** — cross-module/RBAC ADR
  영역(§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0 ·
  raw 미저장(R-59 — 좌표 식별 key 만 비교, 평가 본문 미접촉).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).
