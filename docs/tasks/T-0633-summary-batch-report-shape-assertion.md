---
id: T-0633
title: R-61 요약 batch 합본 리포트 블록 형태 불변식 검증 순수 가드 assertSummaryBatchReportShape
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — formatSummaryBatchReport 2-라인 블록 JSDoc 불변식(계획:/결과: 라벨·개행 1개·후행 0)을 런타임 fail-fast 가드로 강제. T-0620/T-0626 가드 패턴 동형. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-report-shape.ts
  - src/assessment-evaluation/domain/summary-batch-report-shape.spec.ts
---

# T-0633 — R-61 요약 batch 합본 리포트 블록 형태 불변식 검증 순수 가드 assertSummaryBatchReportShape

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". `formatSummaryBatchReport(roster, result)`(T-0630, PR #544 squash 5a601e5)는 JSDoc 으로 "정확히 2 라인 블록 — 1번째 라인 `계획: ` 라벨 + pre-flight 범위, 2번째 라인 `결과: ` 라벨 + outcome summaryLine, 개행 정확히 1개, 후행 개행 0" 이라는 출력 형태 불변식을 **문서로만** 박제했고, 그 합본 리포트는 T-0631 `reportBatch`·T-0632 `evaluateAndReportForRoster` 를 통해 service 경계로 외화돼 caller(로그·journal·향후 notification surface)가 흘려보낸다. 그러나 그 2-라인 블록 형태를 **런타임에서 fail-fast 로 강제하는 가드가 없어**, 합성 단계의 미래 회귀(라벨 drift·라인 수 변형·후행 개행 혼입·빈 라인 위장)가 발생하면 손상된 합본 리포트가 로그·notification surface 로 **silent leak** 한다.

본 task 는 그 빈칸을 채운다 — `assertSummaryBatchReportShape(report)` 순수 가드가 합본 리포트 문자열이 JSDoc 불변식(① string · ② 정확히 2 라인 = `\n` 정확히 1개·후행 개행 0 · ③ 1번째 라인 `계획: ` 라벨 prefix · ④ 2번째 라인 `결과: ` 라벨 prefix · ⑤ 각 라벨 뒤 본문 non-empty)을 만족하는지 fail-fast 검증한다. 손상 report 가 표현 surface 로 새기 전에 차단하고, 향후 service/관측 layer 의 단언 지점으로 재사용한다. T-0620 `assertSummaryBatchOutcomeConsistent`·T-0626 `assertSummaryBatchRosterInputConsistent` 가 outcome 카운트·roster 입력 무결성을 런타임 fail-fast 로 강제한 패턴과 동형의 가드 slice — 이번엔 합본 **표현(presentation) 형태** 대상.

## Required Reading

- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — `formatSummaryBatchReport` 가 산출하는 합본 블록 형태(라벨 `PLAN_LABEL="계획: "` / `RESULT_LABEL="결과: "`, 개행 1개로 구분된 2 라인, 후행 개행 0)의 single-source 계약 — 본 가드가 검증할 불변식의 출처
- [src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts) — T-0620 가드 패턴(구조 결손=TypeError / 값·식 위반=RangeError 구분, 진단용 scope 라벨, 순수·입력 비변형, 한국어 JSDoc·메시지) — 본 가드가 mirror 할 형식
- [src/assessment-evaluation/domain/summary-batch-report-shape.spec.ts] — colocated spec 신규 작성 위치(본 task 가 생성). T-0620/T-0626 colocated spec 구조 mirror

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/summary-batch-report-shape.ts` 에 순수 함수 `export function assertSummaryBatchReportShape(report: string): void` 추가. 합본 리포트 문자열이 다음 불변식을 모두 만족하면 정상 반환(void), 위반 시 fail-fast throw — **자동 복구·정규화·drop 0**:
  - ① `report` 가 string 이 아니면(null/undefined/비-string) 한국어 `TypeError`.
  - ② `\n` 이 정확히 1개여야 한다(= 정확히 2 라인). 0개 또는 2개 이상이면 한국어 `RangeError`(어느 라인 수인지 명시).
  - ③ 후행 개행(`report` 가 `\n` 으로 끝남) 금지 — 위반 시 한국어 `RangeError`.
  - ④ 1번째 라인이 `계획: ` 라벨로 시작하고 라벨 뒤 본문이 non-empty 여야 한다. 위반 시 한국어 `RangeError`.
  - ⑤ 2번째 라인이 `결과: ` 라벨로 시작하고 라벨 뒤 본문이 non-empty 여야 한다. 위반 시 한국어 `RangeError`.
- [ ] 라벨 상수(`계획: ` / `결과: `)는 `summary-batch-report-format.ts` 의 single-source 와 정합해야 한다 — drift 방지를 위해 가능하면 해당 모듈에서 라벨 상수를 `export` 하여 import(format 모듈은 **상수 export 한 줄 amend 만 허용, 값·동작 무변경**). import 가 순환참조를 유발하면 본 가드 파일 내 로컬 상수로 복제하되 JSDoc 에 single-source 출처(`summary-batch-report-format.ts`) 명시.
- [ ] 입력 `report` 문자열 **비변형**(읽기만 — split/match 결과로 원본 변형 0)·결정성·부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 dependency 0·migration 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉).
- [ ] **Happy-path test 1+**: `formatSummaryBatchReport` 가 산출한(또는 동형으로 구성한) 정상 2-라인 블록을 넣으면 throw 0(void 반환). 실제 `formatSummaryBatchReport(roster, result)` 산출을 그대로 통과시키는 end-to-end 정합 케이스 1+ 포함.
- [ ] **Error path test 1+**: 각 위반 분기(①~⑤)에 대해 throw 타입(TypeError/RangeError)과 한국어 메시지 핵심 어휘를 assert — null/undefined `report`(TypeError), `\n` 0개·2개+(RangeError), 후행 개행(RangeError), 1번째 라인 라벨 누락·본문 empty(RangeError), 2번째 라인 라벨 누락·본문 empty(RangeError).
- [ ] **Flow/branch test**: ①~⑤ 각 가드 분기를 정확히 1개씩 trigger 하는 케이스 + 모두 통과하는 정상 케이스 1개로 분기 cover. 한 위반만 있는 입력으로 해당 분기 격리(여러 위반 동시 trigger 로 분기 흐림 금지).
- [ ] **Negative cases 충분 cover (각 1+)**: ① 빈 문자열 `""` → RangeError ② 라벨 순서 뒤바뀜(`결과:` 가 먼저) → RangeError ③ 라벨만 있고 본문 빈 라인(`계획: \n결과: `) → RangeError ④ 3 라인 이상(개행 2개+) → RangeError ⑤ 비-string(숫자·객체·null) → TypeError ⑥ 같은 입력 2회 호출 결정성(byte-identical 동작·입력 비변형 deep-equal). 단일 negative 만 작성 금지 — 위 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 가드 파일 line/branch/function 100% 유지(가드는 분기 cover 가 핵심이므로 branch 100% 목표 — 도달 불가 defensive 분기 있으면 spec 주석으로 명시).
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `formatSummaryBatchReport`/`reportBatch`/`evaluateAndReportForRoster`/pipeline/composer/enumerate 본문 변경 — 본 task 는 라벨 상수 export 한 줄 amend(값·동작 무변경)와 신규 가드 파일만. formatter 동작·출력 무변경.
- 본 가드를 service/`reportBatch`/로그/journal/notification 에 배선(호출) — 별도 wiring follow-up(T-0621 outcome-가드 배선·T-0627 roster-input-가드 배선 패턴 동형). 본 task 는 순수 가드 함수 정의·검증까지.
- 자동 복구·정규화·drop·재렌더 — 손상 report 는 fail-fast throw 만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 예상 후속: 본 가드를 `reportBatch`/`evaluateAndReportForRoster` 의 반환 직전 단언 지점으로 배선하는 wiring slice — T-0621/T-0627 패턴 동형.)
