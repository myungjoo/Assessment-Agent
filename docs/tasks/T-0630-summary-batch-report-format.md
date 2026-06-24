---
id: T-0630
title: R-61 요약 batch pre-flight 범위 + outcome 결과를 한 블록으로 묶는 순수 formatter formatSummaryBatchReport(roster, result) → string 추가
phase: P5
status: DONE
completedAt: 2026-06-24
mergedAs: 5a601e5
prNumber: 544
reviewRounds: 1
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — previewRosterPlan(T-0629)·summaryLine(T-0622) 두 presentation 반쪽을 '계획 vs 결과' 한 블록으로 합치는 순수 formatter. 새 dep 0. endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-report-format.ts
  - src/assessment-evaluation/domain/summary-batch-report-format.spec.ts
---

# T-0630 — R-61 요약 batch "계획 vs 결과" 합본 한 블록 순수 formatter

## Why

PLAN.md P5 bullet 97 (REQ-061 "일/주/월 요약 평가")의 presentation 수렴 조각이다.
p5-summary-aggregate stream 은 이제 **표현(presentation) 양 반쪽이 모두 머지**됐다 —
입력(pre-flight)측은 `formatSummaryBatchRosterPlan`(T-0628) → service 경계
`previewRosterPlan`(T-0629, PR #543 squash 673dfa2)로, 결과(outcome)측은
`formatSummaryBatchOutcome`(T-0622) → pipeline 산출 `summaryLine`(PR #536)로 닫혔다.

**그러나 두 반쪽을 하나로 묶어 "무엇을 평가하려 했는가(계획) vs 무엇을 평가했는가(결과)"
를 한 눈에 보여주는 합본 표현은 빈칸이다.** caller(로그·journal·향후 notification
surface)가 그 둘을 함께 박제하려면 지금은 `previewRosterPlan(roster)` 와 batch 결과의
`summaryLine` 을 각각 따로 받아 caller 가 손수 이어 붙여야 한다 — 합치는 관례(라벨·순서·
구분자)가 caller 마다 drift 할 여지가 남는다.

본 task 는 그 빈칸을 채운다 — 순수 합본 formatter
`formatSummaryBatchReport(roster: SummaryBatchRosterInput, result:
SummaryBatchPipelineResult): string` 를 추가한다. roster 로부터 pre-flight 범위 라인을
`formatSummaryBatchRosterPlan(roster)` 위임(재구현 0)으로 산출하고, batch 결과의
`result.summaryLine`(이미 `formatSummaryBatchOutcome` 으로 렌더된 결과 한 줄)을 가공 0 으로
재사용해, 두 줄을 결정적 한국어 라벨(`계획:` / `결과:`)과 함께 한 블록(개행 1개로 구분된
정확히 2 라인) 문자열로 묶는다. 이는 입력측·결과측 두 formatter 의 단순 합성이며 — 새 표현
규칙을 발명하지 않고 두 single-source 라인을 라벨·구분만 부착해 잇는다.

순수 — formatter 는 순수 함수(부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 ·
repository 0 · 입력 비변형 · 동일 입력 → byte-identical 출력 · 잔여 상태 누수 0). pre-flight
라인 산출은 `formatSummaryBatchRosterPlan` 위임(재구현 0)으로 그 결정성·비변형·fail-fast
계약을 상속하고, 결과 라인은 `result.summaryLine`(이미 산출된 string)을 그대로 읽는다. 새
외부 dependency 0 · DB write/migration 0 · raw 미저장(R-59 — 좌표 식별 축·카운트만, 평가
본문 미접촉). p5-summary-aggregate stream 내부 표현 layer 조각이며 realdata-e2e /
evaluation-adjustments stream 과 파일 disjoint(touchesFiles 교집합 0). manual-trigger HTTP
endpoint(Q-0030 RBAC) / collection bridge(cross-module RBAC) 같은 §5 ADR-gated BLOCKED
영역은 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts` —
  **pre-flight 라인 위임 대상**. `formatSummaryBatchRosterPlan(roster:
  SummaryBatchRosterInput): string` 의 계약: 순수 함수 / `roster` null·undefined 직접
  가드 한국어 `TypeError` / `enumerateSummaryDueCoordinates` 위임의 TypeError·RangeError
  전파 / 결정적 한국어 단일 라인(개행 0) / 빈 roster 도 `총 0좌표` 명시(throw 0). 본
  formatter 가 import·위임할 함수. **변경 금지**(import·호출만).
- `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` — **mirror 패턴
  source**. 결과측 `formatSummaryBatchOutcome(report)` 가 outcome report 를 한 줄로 렌더한
  관례(순수 함수 / null fail-fast 한국어 TypeError / 결정적 한국어 단일 라인 / 한국어
  JSDoc / 책임 경계 주석)를 본 formatter 의 문구 톤·주석 구조 mirror 대상으로 참고. **본
  formatter 는 이 파일을 직접 import 하지 않는다** — 결과 라인은 이미 렌더된
  `result.summaryLine` 을 재사용(중복 렌더 0).
- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` — `SummaryBatchPipelineResult`
  타입(`{ plan, outcomes, report, summaryLine }`) 정의(L93~106). 본 formatter 가 받을
  `result` 의 surface 와 `summaryLine: string`(L105) 필드 확인. **import type 만** — pipeline
  본문·계약 변경 0. service 가 이 타입을 re-export 하므로(orchestrator service L79) 본
  formatter 는 domain 원본에서 import.
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — 본 formatter 가
  받을 `SummaryBatchRosterInput` surface. **import type 만**.
- `src/assessment-evaluation/domain/summary-batch-roster-plan-format.spec.ts` — colocated
  spec 구조·R-112 4종 케이스 배치 mirror. 고정 `now` 주입으로 결정성 확보하는 fixture
  관례 참고.

## Acceptance Criteria

- [ ] 신규 순수 formatter `formatSummaryBatchReport(roster: SummaryBatchRosterInput,
  result: SummaryBatchPipelineResult): string` 를
  `src/assessment-evaluation/domain/summary-batch-report-format.ts` 에 추가한다. 동작:
  - `roster` null/undefined → `formatSummaryBatchRosterPlan` 위임의 한국어 `TypeError`
    전파(직접 재구현 0).
  - `result` null/undefined → 한국어 `TypeError` fail-fast(직접 가드 — `result.summaryLine`
    역참조 전에). `result.summaryLine` 이 string 이 아니면(누락 등) 한국어 `TypeError`.
  - pre-flight 라인 = `formatSummaryBatchRosterPlan(roster)`(위임, 재구현 0).
  - 결과 라인 = `result.summaryLine`(이미 렌더된 string, 가공 0 재사용).
  - 두 라인을 결정적 한국어 라벨(`계획:` / `결과:`)과 개행 1개로 구분해 **정확히 2 라인**
    블록 문자열로 반환. 라벨·구분자·순서(계획 먼저)는 본 함수가 single source(JSDoc 에
    예시 박제). 다중 개행·후행 개행 없음.
- [ ] **순수성·계약 보존** — formatter 는 순수 함수: 부수효과 0 · `@Injectable` 0 ·
  Prisma 0 · LLM 0 · repository 0 · 입력 비변형(roster·result 읽기만) · 동일 입력 →
  byte-identical 출력 · 잔여 상태 누수 0. 새 외부 dependency 0 · migration 0 · raw 미저장
  (R-59 — pre-flight 좌표 축·결과 카운트만, 평가 본문 미접촉).
- [ ] **Happy-path test 1+**: 정상 roster(예: personIds 2명 × `[day, week, month]`) +
  정상 `result`(summaryLine 비어있지 않음)로 호출 시 (a) throw 0, (b) 반환이 정확히 2 라인
  (개행 1개), (c) 1번째 라인이 `formatSummaryBatchRosterPlan(roster)` 의 출력을 포함(계획
  라벨과 함께), (d) 2번째 라인이 `result.summaryLine` 을 포함(결과 라벨과 함께).
- [ ] **Error path test 1+**: (a) `roster` null → 한국어 `TypeError`(위임 전파), `roster`
  undefined → 한국어 `TypeError`. (b) `result` null → 한국어 `TypeError`(직접 가드),
  `result` undefined → 한국어 `TypeError`. (c) `result.summaryLine` 이 누락/비-string →
  한국어 `TypeError`. (d) `roster.personIds` null 또는 `granularities` 에 알 수 없는
  granularity 포함 → `formatSummaryBatchRosterPlan` 위임의 enumerate TypeError/RangeError
  전파(swallow 0).
- [ ] **Flow / branch 분기 cover** — 분기마다 1+:
  - (a) 비어있지 않은 roster + 비어있지 않은 summaryLine → 2 라인 정상 블록,
  - (b) 빈 roster(빈 `personIds`) → pre-flight 라인은 `총 0좌표`(throw 0), 결과 라인은
    `result.summaryLine` 그대로 → 여전히 정확히 2 라인,
  - (c) `result` 가드 분기(null) vs `roster` 가드 분기(null) 각각 도달.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리(각 1+):
  (1) `roster` null/undefined → 한국어 `TypeError` 2종 test,
  (2) `result` null/undefined → 한국어 `TypeError` 2종 test,
  (3) `result.summaryLine` 누락/비-string → 한국어 `TypeError` test,
  (4) 빈 roster(personIds 빈 배열) + 정상 summaryLine → `총 0좌표` pre-flight + 결과 라인,
    정확히 2 라인 test,
  (5) 동일 (roster, result) 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0) test,
  (6) 호출 후 입력 비변형(`roster`·`roster.personIds`·`result`·`result.summaryLine` deep
    동일성 — formatter 가 입력을 변형하지 않음) test.
- [ ] **위임 호출 무복제 검증** — 결과 라인이 `result.summaryLine` 을 그대로 재사용함을
  검증(`formatSummaryBatchOutcome` 을 재호출해 중복 렌더하지 않음 — 본 formatter 가 outcome
  formatter 를 import 하지 않음을 코드/spec 으로 단언, 결과 라인이 주어진 summaryLine 과
  정확히 일치) 1+.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-report-format.spec.ts`
  작성(NestJS convention + discoverability). pre-flight 좌표는 실제
  `enumerateSummaryDueCoordinates` 를 통해 산출(고정 `now` 주입으로 결정성), `result` 는
  `summaryLine` 만 채운 최소 fixture(`plan`/`outcomes`/`report` 는 임의 최소값 또는 빈
  값) — 실 LLM/DB/Prisma 0, 순수 단위 격리.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 formatter 파일 line/branch/function 100% 목표.

## Out of Scope

- **`summary-batch-roster-plan-format.ts` / `summary-batch-outcome-format.ts` /
  `summary-batch-pipeline.ts` / `summary-batch-roster-input.ts` 변경 금지** — import(type ·
  함수)·위임만. pre-flight formatter 본문·outcome formatter·pipeline 계약 무변경.
- **결과 라인 재렌더 금지** — 결과 라인은 `result.summaryLine`(이미 `formatSummaryBatchOutcome`
  으로 렌더됨)을 그대로 재사용. `formatSummaryBatchOutcome` 을 import·재호출하지 않는다
  (중복 렌더 0 — single-source 라인 재사용).
- **orchestrator service / 가드 / composer 변경 금지** — 본 task 는 순수 formatter 함수
  까지. formatter 를 service 경계(`previewRosterPlan` 옆에 합본 메서드)나 로그·journal·
  notification 에 배선(호출)하는 것은 별도 wiring follow-up(T-0623 가 outcome formatter 를
  service 경계로 외화한 패턴 동형). 생성자/DI/providers 무변경.
- **JSON 직렬화 / i18n / markdown 표 / 템플릿 엔진 / 3 라인 이상 금지** — 한국어 2 라인
  블록 문자열 하나만(계획 라인 + 결과 라인).
- **plan / outcomes / report 본문 렌더 금지** — 합본은 두 한 줄 요약(pre-flight 범위 라인 +
  결과 summaryLine)만. 세부 분포·tuple·좌표 dump 는 본 formatter 책임 밖.
- **manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 0** — Q-0030 RBAC
  ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → `EvaluationResult[]`) 0** — cross-module/RBAC ADR 영역(§5
  BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0 · raw 미저장
  (R-59 — pre-flight 좌표 축·결과 카운트만, 평가 본문 미접촉).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

후보 후속 slice(참고 — 본 task 범위 밖):
- 합본 formatter `formatSummaryBatchReport` 를 service 경계(`SummaryBatchOrchestratorService`
  의 합본 메서드 — 예: `reportBatch(roster, result): string`)로 외화 — T-0623·T-0629 가
  formatter 를 service 경계로 외화한 패턴 동형(wiring slice).
- 합본 요약을 `evaluateBatchForRoster` 결과/로그·journal surface 에 실제 emit(side-effect)
  배선 — 실 호출처 결선(별도 follow-up).
- manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first) — **§5 BLOCKED**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5 BLOCKED**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).
