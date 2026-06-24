---
id: T-0624
title: R-61 요약 batch roster→orchestrator-input enumerate 순수 composer 추출
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: P5 PLAN 97행 R-61 — enumerate(T-0613)가 정의만 되고 미소비인 unwired 공백을 roster→SummaryBatchOrchestratorInput 순수 composer 로 닫음
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-roster-input.ts
  - src/assessment-evaluation/domain/summary-batch-roster-input.spec.ts
---

# T-0624 — R-61 요약 batch roster→orchestrator-input enumerate 순수 composer 추출

## Why

PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가" 의 p5-summary-aggregate stream 은
순수 layer(enumerate→plan→run→outcome→pipeline) + `@Injectable` service-경계 +
summaryLine 까지 모두 머지됐다(T-0613~T-0623). 그러나 그 stream 의 **첫 조각**인
`enumerateSummaryDueCoordinates`(T-0613, PR #527)는 정의·검증만 됐고 어떤 caller 도
호출하지 않는다 — `git grep` 매치가 자기 파일·자기 spec 과 다른 파일들의 JSDoc 주석뿐
(T-0619 formatter / T-0620 가드가 T-0621/T-0622 직전에 처해 있던 것과 동일한
exists-but-unwired 공백). `SummaryBatchOrchestratorService.evaluateBatch` 는 caller 가
이미 enumerate 해 넘긴 `coordinates` 를 입력으로 요구하므로(`SummaryBatchOrchestratorInput`),
roster(personIds) + granularities → `coordinates` enumerate → orchestrator-input 조립의
join 조각이 비어 있다.

본 task 는 그 빈 join 을 **순수 composer** `buildSummaryBatchOrchestratorInput(roster)`
로 채운다 — roster/granularities/resultsByCoordinate/mode/options/now 를 받아 내부에서
`enumerateSummaryDueCoordinates` 를 호출(재구현 0)해 `SummaryBatchOrchestratorInput`
형태를 결정적으로 조립한다. 좌표 enumerate 가 caller-facing 으로 처음 소비된다.

## Required Reading

- `src/assessment-evaluation/domain/summary-due-coordinates.ts` — `enumerateSummaryDueCoordinates(personIds, granularities, now)` 시그니처·계약·`SummaryDueCoordinate` 타입·`PeriodGranularity` 재export 경위(본 composer 가 위임 호출).
- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` — `SummaryBatchOrchestratorInput` interface(coordinates/resultsByCoordinate/mode/options/now 5 필드 surface — 본 composer 의 산출 타입). 이 타입을 `import type` 으로 재사용(신규 타입 발명 0).
- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` — 하위 조각의 순수 함수 관례(입력 비변형 / null·undefined fail-fast 한국어 `TypeError` / 결정성 / 한국어 JSDoc) — mirror 대상.
- `src/assessment-evaluation/domain/summary-batch-plan.spec.ts` — colocated spec 패턴(happy/error/branch/negative 구성) 참고.

## Acceptance Criteria

- [ ] 신규 `src/assessment-evaluation/domain/summary-batch-roster-input.ts` 에 순수 함수 `buildSummaryBatchOrchestratorInput(input)` 추가. 입력은 `{ personIds: string[], granularities: PeriodGranularity[], resultsByCoordinate, mode, options, now }` 단일 객체(positional 인자 혼동 차단), 산출은 `SummaryBatchOrchestratorInput`(`coordinates` 는 내부 `enumerateSummaryDueCoordinates(personIds, granularities, now)` 산출, 나머지 4 필드는 그대로 전달).
- [ ] 산출 타입 `SummaryBatchOrchestratorInput` 은 `summary-batch-orchestrator.service.ts` 에서 `import type` 으로 재사용(신규 type 정의 0, single-source 보존). `PeriodGranularity` 는 `period-evaluable`(또는 summary-due-coordinates 재export)에서 import.
- [ ] 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 호출 0 · repository 0 · DB write 0 — `enumerateSummaryDueCoordinates` 위임 + 4 필드 pass-through 만. 입력 배열·map·원소·`now` 비변형(enumerate 비변형 계약 상속). 새 외부 dependency 0 · raw 미저장(R-59, 좌표 식별 축만).
- [ ] **Happy-path unit test**: 정상 roster × granularities → `coordinates` 가 `enumerateSummaryDueCoordinates` 산출과 동일(등장 순서 보존) + resultsByCoordinate/mode/options/now 가 변형 없이 그대로 부착되는 케이스 1+.
- [ ] **Error path unit test**: `input` 이 null/undefined 일 때 한국어 `TypeError`; `personIds`/`granularities` null/undefined 시 enumerate 위임 `TypeError` 전파; `now` Invalid Date 시 helper `TypeError` 전파; 알 수 없는 granularity 시 helper `RangeError` 전파 — 각 1+.
- [ ] **Flow / branch coverage**: 빈 `personIds`(또는 빈 `granularities`) → 빈 `coordinates` 부착(throw 0) 분기 vs 비어있지 않은 분기 각 1+.
- [ ] **Negative cases 충분 cover**: ① 빈 roster → coordinates 빈 배열 ② 중복 personId roster → 좌표도 중복 보존(de-dup 0, enumerate 계약 상속) ③ 입력 객체·배열·now 비변형(원본 reference 미변형 단언) ④ 2 회 호출 결정성(같은 입력 → 깊은 값 동일) ⑤ resultsByCoordinate map 미부착 좌표가 있어도 composer 는 map 을 그대로 전달(좌표별 빈 배열 기본은 buildSummaryBatchPlan 책임 — 본 composer 는 map 변형 0) — 각 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 composer 파일은 100% line/branch/function 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green(tester 가 확인).
- [ ] colocated spec 위치는 `src/assessment-evaluation/domain/summary-batch-roster-input.spec.ts`(신규 composer 와 동일 디렉토리).

## Out of Scope

- `SummaryBatchOrchestratorService` 본문/생성자/DI 변경 금지 — 본 composer 는 service 가 소비할 입력을 조립할 뿐, service 배선은 별도(필요 시 follow-up).
- manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 금지 — Q-0030 RBAC ADR-gated(§5 BLOCKED).
- 좌표 → `EvaluationResult[]` 도출(collection bridge) 금지 — cross-module/RBAC ADR 영역(§5 BLOCKED). caller 가 `resultsByCoordinate` map 을 이미 넘긴다고 전제.
- roster(personIds) source 도출(DB read / Person repository) 금지 — caller 가 in-memory string[] 로 주입.
- mode/options/now 결정 로직 금지 — caller 가 넘긴 값 그대로 전달.
- `enumerateSummaryDueCoordinates` 본문 / `summary-due-coordinates.ts` 변경 금지(필요 시 `PeriodGranularity` import 경로만 사용, 값/순서 무변경).
- scheduler 자동 trigger(@nestjs/schedule cron) 금지 — P7 새 dep.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음)

---

## 결과 (DONE — 2026-06-24)

- PR #538 squash merge `cde656c` — reviewer r1 APPROVE(8-check, finding 0) · 외부 comment(issuecomment-4786423599), 4-게이트 PASS, PR checks green.
- 신규 2 파일 `src/assessment-evaluation/domain/summary-batch-roster-input.{ts,spec.ts}` (+133/-0), 신규 파일 cov 100%, unit 7102 green.
- 순수 composer `buildSummaryBatchOrchestratorInput` 추출 — 좌표 enumerate(`enumerateSummaryDueCoordinates`)가 caller-facing 으로 처음 소비. 부수효과 0·@Injectable 0·Prisma 0·LLM 0·새 dep 0.
- cron@aa-local-15-5201 fire — lock CAS 98c7f59→fa60167(획득)→06a5f70(select-claim T-0624 + lock tombstone release). fineGrainedConcurrency claim path(claims.json [] → active 0 → maxConcurrentClaims=2 게이트 통과, pr-mode 단독 claim → lock-free 진행 → 회수). concurrency incident 0.
- Follow-up: T-0625(roster-entry 메서드 `evaluateBatchForRoster` 로 본 composer 를 service 에 배선) planner queued.
