---
id: T-0625
title: R-61 요약 batch roster-entry 메서드로 buildSummaryBatchOrchestratorInput composer 를 service 에 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: P5 PLAN 97행 R-61 — T-0624 buildSummaryBatchOrchestratorInput 이 정의만 되고 미소비인 unwired 공백을 service roster-entry 메서드로 닫음
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0625 — R-61 요약 batch roster-entry 메서드로 buildSummaryBatchOrchestratorInput composer 를 service 에 배선

## Why

PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가" 의 p5-summary-aggregate stream 은
순수 layer(enumerate→plan→run→outcome→pipeline) + `@Injectable` service-경계 +
summaryLine + roster→input composer(T-0624) 까지 모두 머지됐다(T-0613~T-0624).
그러나 T-0624 가 추가한 순수 composer `buildSummaryBatchOrchestratorInput(roster)`
는 정의·검증만 됐고 **어떤 caller 도 호출하지 않는다** — `git grep` 매치가 자기
파일·자기 spec 뿐(T-0613 enumerate / T-0619 formatter / T-0620 가드가 직전에
처해 있던 것과 동일한 exists-but-unwired 공백).

`SummaryBatchOrchestratorService.evaluateBatch` 는 caller 가 이미 enumerate 해 넘긴
`SummaryBatchOrchestratorInput`(`coordinates` 포함)을 요구하므로, roster(personIds)
+ granularities 를 직접 받는 진입점이 service 경계에 비어 있다. T-0624 composer 가
바로 그 roster→input 조립을 닫았으니, 본 task 는 그 composer 를 service 의
roster-entry 메서드로 **배선**한다 — `evaluateBatchForRoster(roster)` 가
`buildSummaryBatchOrchestratorInput(roster)` 로 입력을 조립한 뒤 기존
`evaluateBatch(input)` 에 위임한다(둘 다 재구현 0). T-0621 가드 배선 /
T-0622 formatter 배선 / T-0623 summaryLine 경계 외화와 동형의 wiring slice.

## Required Reading

- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` — `SummaryBatchOrchestratorService`(생성자 주입 / `evaluateBatch(input: SummaryBatchOrchestratorInput)` 시그니처·계약 / `SummaryBatchOrchestratorInput` interface / `SummaryBatchPipelineResult` re-export). 본 task 가 roster-entry 메서드를 여기에 추가.
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — `buildSummaryBatchOrchestratorInput(input: SummaryBatchRosterInput)` 시그니처·계약·`SummaryBatchRosterInput` 타입(personIds/granularities/resultsByCoordinate/mode/options/now 6 필드 surface — 본 메서드가 입력으로 받아 composer 에 위임).
- `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts` — 기존 service spec 패턴(mock `{ evaluateAndPersist: jest.fn() }` 주입 / happy/error/branch/negative 구성). roster-entry 케이스를 여기에 추가.
- `src/assessment-evaluation/domain/summary-due-coordinates.ts` — `enumerateSummaryDueCoordinates` 의 비변형·fail-fast·결정성 계약(composer 가 위임 → 본 메서드가 간접 상속하는 error 전파 surface 파악용, error path 테스트 근거).

## Acceptance Criteria

- [ ] `SummaryBatchOrchestratorService` 에 roster-entry 메서드 `evaluateBatchForRoster(roster: SummaryBatchRosterInput): Promise<SummaryBatchPipelineResult>` 추가. 본문은 `buildSummaryBatchOrchestratorInput(roster)` 로 `SummaryBatchOrchestratorInput` 을 조립한 뒤 `this.evaluateBatch(input)` 에 위임(재구현 0 — composer + 기존 메서드 합성만).
- [ ] `SummaryBatchRosterInput` 타입은 `domain/summary-batch-roster-input` 에서 `import type` 으로 재사용(신규 type 정의 0, single-source 보존). `buildSummaryBatchOrchestratorInput` 은 value import.
- [ ] 직접 부수효과 0 · `@Injectable` 신규 0(기존 service 데코레이터 그대로) · Prisma 0 · LLM 호출 0 · 새 외부 dependency 0 · 새 migration 0 · raw 미저장(R-59). roster 입력 비변형(composer 의 비변형 계약 상속 — service 가 추가 변형 0).
- [ ] 메서드 JSDoc(한국어) 추가 — roster → composer → `evaluateBatch` 위임 흐름, `now` 동일 instance thread, error 전파 상속(composer/enumerate/pipeline error 그대로 전파, swallow 0) 명시. 클래스 머리말 주석은 roster-entry 진입점이 추가됐음을 한 줄 갱신(코드 동작 외 drift 정정).
- [ ] **Happy-path unit test**: 정상 roster(`personIds` × `granularities` + resultsByCoordinate/mode/options/now) 입력 → mock orchestrator `evaluateAndPersist` 가 좌표 수만큼 호출되고 반환이 `{ plan, outcomes, report, summaryLine }` 4 산출을 갖는 케이스 1+. 산출이 동일 입력으로 직접 `buildSummaryBatchOrchestratorInput` + `evaluateBatch` 를 호출했을 때와 정합함을 검증.
- [ ] **Error path unit test**: ① `roster` null/undefined → composer/위임 chain 의 한국어 `TypeError` 전파 ② `personIds`/`granularities` null/undefined → enumerate 위임 `TypeError` 전파 ③ `now` Invalid Date → helper `TypeError` 전파 ④ 주입된 orchestrator `evaluateAndPersist` reject → 그대로 reject 전파(swallow 0) — 각 1+.
- [ ] **Flow / branch coverage**: 빈 roster(빈 `personIds` 또는 빈 `granularities`) → 빈 `coordinates` → orchestrator 호출 0 · report 전 카운트 0(throw 0) 분기 vs 비어있지 않은 분기 각 1+.
- [ ] **Negative cases 충분 cover**: ① 빈 roster → orchestrator 호출 0 + 빈 report ② 중복 personId roster → 좌표 중복 보존(de-dup 0, enumerate 계약 상속)으로 orchestrator 호출 횟수도 그만큼 ③ roster 입력 객체·배열·`now` 비변형(원본 reference 미변형 단언) ④ 같은 service 인스턴스로 2 회 호출 시 두 호출 독립(evaluator 잔여 상태 누수 0, 매 호출 새 합성) ⑤ resultsByCoordinate map 미부착 좌표가 있어도 좌표별 빈 배열 기본(buildSummaryBatchPlan 책임)으로 throw 0 — 각 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경된 service 파일의 신규 메서드는 100% line/branch/function 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green(tester 가 확인).
- [ ] colocated spec 위치는 `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts`(기존 service spec 에 roster-entry describe 추가).

## Out of Scope

- 기존 `evaluateBatch(input)` 메서드 본문/시그니처/계약 변경 금지 — roster-entry 는 그 위에 얹는 진입점일 뿐, 기존 coordinates-입력 진입점은 그대로 유지(둘 다 public).
- 생성자/DI/provider 변경 금지 — 기존 `SummaryAggregateOrchestratorService` 주입 그대로 재사용.
- `buildSummaryBatchOrchestratorInput` / `summary-batch-roster-input.ts` / `enumerateSummaryDueCoordinates` / `summary-due-coordinates.ts` 본문 변경 금지(import + 호출만, 값/순서 무변경).
- manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 금지 — Q-0030 RBAC ADR-gated(§5 BLOCKED).
- 좌표 → `EvaluationResult[]` 도출(collection bridge) 금지 — caller 가 `resultsByCoordinate` map 을 이미 넘긴다고 전제(cross-module/RBAC ADR 영역, §5 BLOCKED).
- roster(personIds) source 도출(DB read / Person repository) 금지 — caller 가 in-memory string[] 로 주입.
- scheduler 자동 trigger(@nestjs/schedule cron) 금지 — P7 새 dep.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음)
