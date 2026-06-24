---
id: T-0635
title: R-61 요약 batch roster pre-flight 계획 라인 형태 불변식 검증 순수 가드 assertSummaryBatchRosterPlanShape
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — formatSummaryBatchRosterPlan 한 줄(개행 0·prefix `요약 평가 batch 예정:`·person/총/[버킷] 토큰) JSDoc 불변식을 런타임 fail-fast 가드로 강제. T-0633 report-shape 가드 패턴의 입력측 mirror. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts
  - src/assessment-evaluation/domain/summary-batch-roster-plan-shape.spec.ts
---

# T-0635 — R-61 요약 batch roster pre-flight 계획 라인 형태 불변식 검증 순수 가드 assertSummaryBatchRosterPlanShape

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". `formatSummaryBatchRosterPlan(roster)`(T-0628, PR #542 — `src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts`)는 batch 실행 **전에** "지금 무엇이 돌아갈 것인가"(roster · granularity · 좌표 수)를 사람-친화 결정적 한국어 단일 라인으로 렌더하는 pre-flight 표현 조각이다. 그 출력 형태 불변식(① string · ② 개행 0(단일 라인) · ③ prefix `요약 평가 batch 예정: ` · ④ `person N명` 토큰 존재 · ⑤ `· 총 N좌표 [...]` 토큰 존재 · ⑥ 대괄호 안 `day N · week N · month N · other N` 4 버킷 슬롯 누락 0)은 formatter JSDoc 으로 **문서로만** 박제됐고, 그 plan 라인은 두 caller surface 로 외화된다 — (a) `SummaryBatchOrchestratorService.previewRosterPlan(roster)`(T-0629, PR #543)가 service 경계로 그대로 노출, (b) `formatSummaryBatchReport(roster, result)`(T-0630, PR #544)가 합본 리포트의 1번째 "계획: " 라인 본문으로 위임 소비.

그러나 그 단일 라인 형태를 **런타임에서 fail-fast 로 강제하는 가드가 없어**, 합성 단계의 미래 회귀(개행 혼입·prefix drift·person 토큰 누락·총 좌표 토큰 누락·버킷 슬롯 누락·빈 라인 위장)가 발생하면 손상된 plan 라인이 `previewRosterPlan` 의 로그·journal surface 와 `formatSummaryBatchReport` 의 합본 리포트 1번째 라인으로 **silent leak** 한다. 합본 리포트는 T-0633/T-0634 의 2-라인 블록 형태 가드(`assertSummaryBatchReportShape`)로 외형은 보호되지만, 1번째 라인 본문 자체의 형태(개행 0·prefix·person/총/버킷 토큰)는 단언 안에 들어있지 않다.

본 task 는 그 빈칸을 채운다 — `assertSummaryBatchRosterPlanShape(plan)` 순수 가드가 plan 라인 문자열이 위 6 불변식을 모두 만족하는지 fail-fast 검증한다. T-0633 `assertSummaryBatchReportShape`(2-라인 블록 합본 표현 가드)의 **입력측 mirror** 슬라이스 — 이번엔 합본 1번째 라인을 단독으로 산출하는 pre-flight 표현 가드. T-0620 outcome 카운트 가드·T-0626 roster 입력 무결성 가드·T-0633 report-shape 가드와 동형의 순수 가드 패턴(구조 결손=한국어 TypeError / 형태 위반=한국어 RangeError 구분).

본 task 는 **순수 가드 정의·검증까지** 만 — 가드를 `previewRosterPlan` / `formatSummaryBatchRosterPlan` 산출 직전·직후로 배선하는 wiring 은 별도 follow-up(T-0621 outcome 가드 배선 / T-0627 roster-input 가드 배선 / T-0634 report-shape 가드 배선 패턴 동형). 본 task 닫히면 p5-summary-aggregate stream 의 표현 양 반쪽(plan 라인 · outcome 라인 · 합본 블록)이 모두 가드로 보호되며, 자연 follow-up 은 (1) 본 가드 wiring 1 슬라이스 / (2) §5 BLOCKED 의 manual-trigger endpoint(Q-0030) · collection bridge ADR 으로 좁혀진다.

## Required Reading

- [src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts) — `formatSummaryBatchRosterPlan` 가 산출하는 단일 라인 형태(prefix `요약 평가 batch 예정: ` · `person N명` · `총 N좌표` · `[day N · week N · month N · other N]` · 개행 0)의 single-source 계약. 본 가드가 검증할 불변식의 출처. JSDoc(L43~76) 의 출력 형태 박제와 함수 본문(L78~110)의 실 렌더 식 모두 참조 — single-source 라벨 정합 의도(드리프트 방지)는 라벨/prefix 상수 export amend 한 줄 정도까지 허용(값·동작 무변경).
- [src/assessment-evaluation/domain/summary-batch-report-shape.ts](../../src/assessment-evaluation/domain/summary-batch-report-shape.ts) — T-0633 `assertSummaryBatchReportShape(report: string): void` 의 throw 계약(구조 결손=한국어 TypeError / 형태 위반=한국어 RangeError 구분, 진단용 scope 라벨, 순수·입력 비변형, 한국어 JSDoc·메시지) — 본 가드가 mirror 할 형식·메시지 톤·구조. **변경 0** — read-only 참조.
- [src/assessment-evaluation/domain/summary-batch-outcome.ts](../../src/assessment-evaluation/domain/summary-batch-outcome.ts) — `GRANULARITY_BUCKETS`(day → week → month → other) single-source 고정 순서. 본 가드의 ⑥ 버킷 슬롯 검증이 이 single source 를 import 해 4 버킷 라벨 등장을 단언(`Object.keys` 의존 0). **변경 0** — import 만.
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.spec.ts] — colocated spec 신규 작성 위치(본 task 가 생성). T-0633 report-shape colocated spec 구조 mirror(분기 격리 spec · 한 위반만 trigger).

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts` 에 순수 함수 `export function assertSummaryBatchRosterPlanShape(plan: string): void` 추가. plan 라인 문자열이 다음 불변식을 모두 만족하면 정상 반환(void), 위반 시 fail-fast throw — **자동 복구·정규화·drop 0**:
  - ① `plan` 이 string 이 아니면(null/undefined/숫자/객체/배열 등 비-string) 한국어 `TypeError`(scope 라벨 명시).
  - ② `\n` 이 0개여야 한다(= 정확히 단일 라인). 1개 이상이면 한국어 `RangeError`(어느 라인 수인지 명시).
  - ③ prefix `요약 평가 batch 예정: ` 로 시작해야 한다(라벨+공백 1개). 위반 시 한국어 `RangeError`(prefix 누락·drift).
  - ④ `person N명` 토큰이 등장해야 한다(N 은 0 이상 정수). 위반 시 한국어 `RangeError`(person 토큰 누락 또는 형식 drift).
  - ⑤ `· 총 N좌표 [` 토큰이 등장해야 한다(N 은 0 이상 정수, 대괄호 시작 포함). 위반 시 한국어 `RangeError`(총 좌표 토큰 누락 또는 대괄호 시작 drift).
  - ⑥ 대괄호 안에 `day N`, `week N`, `month N`, `other N` 4 버킷 슬롯이 `GRANULARITY_BUCKETS` single-source 고정 순서로 모두 등장해야 한다(각 N 은 0 이상 정수). 슬롯 누락·순서 drift 시 한국어 `RangeError`(누락/잘못된 버킷 명시).
- [ ] prefix 상수(`요약 평가 batch 예정: `)는 가능하면 `summary-batch-roster-plan-format.ts` 의 single-source 와 정합해야 한다 — drift 방지를 위해 해당 모듈에서 상수를 `export` 하여 import(format 모듈은 **상수 export 한 줄 amend 만 허용, 값·동작 무변경**). import 가 순환참조를 유발하거나 형 변경이 너무 침습적이면 본 가드 파일 내 로컬 상수로 복제하되 JSDoc 에 single-source 출처(`summary-batch-roster-plan-format.ts`) 명시. 버킷 라벨은 반드시 `summary-batch-outcome.ts` 의 `GRANULARITY_BUCKETS` import 사용(자체 정의 금지 — single-source 정합).
- [ ] 입력 `plan` 문자열 **비변형**(읽기만 — split/match/regex 결과로 원본 변형 0)·결정성·부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 dependency 0·migration 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉).
- [ ] **Happy-path test 1+**: `formatSummaryBatchRosterPlan` 가 산출한(또는 동형으로 구성한) 정상 단일 라인을 넣으면 throw 0(void 반환). 실제 `formatSummaryBatchRosterPlan(roster)` 산출을 그대로 통과시키는 end-to-end 정합 케이스 1+ 포함(roster 빈/non-empty 둘 다). 가드가 정상 plan 라인을 변형·차단하지 않음을 검증(입력 deep-equal 비변형 1+).
- [ ] **Error path test 1+**: 각 위반 분기(①~⑥)에 대해 throw 타입(TypeError/RangeError)과 한국어 메시지 핵심 어휘를 assert — null/undefined `plan`(TypeError), 비-string(TypeError), 개행 1개+(RangeError), prefix 누락·drift(RangeError), person 토큰 누락(RangeError), 총 좌표 토큰 누락(RangeError), 버킷 슬롯 누락(RangeError).
- [ ] **Flow/branch test**: ①~⑥ 각 가드 분기를 정확히 1개씩 trigger 하는 케이스 + 모두 통과하는 정상 케이스 1+ 로 분기 cover. 한 위반만 있는 입력으로 해당 분기 격리(여러 위반 동시 trigger 로 분기 흐림 금지).
- [ ] **Negative cases 충분 cover (각 1+)**: ① 빈 문자열 `""` → RangeError(prefix 누락 분기) ② prefix 만 있고 본문 빈(`요약 평가 batch 예정: `) → RangeError(person 토큰 누락) ③ 버킷 순서 뒤바뀜(`[week 1 · day 2 · month 0 · other 0]`) → RangeError(고정 순서 위반) ④ 1 버킷 누락(`[day 0 · week 0 · month 0]`, other 슬롯 없음) → RangeError ⑤ 개행 혼입(`요약 평가 batch 예정: person 1명 · 총 1좌표 [day 1 · week 0 · month 0 · other 0]\n`) → RangeError(후행 개행/단일 라인 위반) ⑥ 비-string(숫자·객체·null·undefined) → TypeError ⑦ 같은 입력 2회 호출 결정성(byte-identical 동작·입력 deep-equal 비변형). 단일 negative 만 작성 금지 — 위 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 가드 파일 line/branch/function 100% 유지(가드는 분기 cover 가 핵심이므로 branch 100% 목표 — 도달 불가 defensive 분기 있으면 spec 주석으로 명시).
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `formatSummaryBatchRosterPlan`/`previewRosterPlan`/`formatSummaryBatchReport`/`reportBatch`/`evaluateAndReportForRoster`/pipeline/composer/enumerate **본문 변경 0** — 본 task 는 format 모듈의 prefix 상수 export 한 줄 amend(값·동작 무변경) 정도와 신규 가드 파일만. formatter 동작·출력 무변경.
- 본 가드를 `previewRosterPlan`/`formatSummaryBatchRosterPlan`/`formatSummaryBatchReport`/로그/journal/notification 에 배선(호출) — 별도 wiring follow-up(T-0621 outcome-가드 배선·T-0627 roster-input-가드 배선·T-0634 report-shape-가드 배선 패턴 동형). 본 task 는 순수 가드 함수 정의·검증까지.
- 자동 복구·정규화·drop·재렌더 — 손상 plan 라인은 fail-fast throw 만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 표현 양 반쪽(plan 라인 · outcome 라인) 가드와 합본 블록 가드가 모두 정의됨. 자연 후속은 (a) 본 가드의 `previewRosterPlan`/`formatSummaryBatchRosterPlan` 산출 직후 wiring 1 슬라이스(T-0634 동형) 또는 (b) §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 인접 PLAN bullet(R-9 사용자 지정 기간 임의 평가문 등)으로 stream 전환 판단.)
