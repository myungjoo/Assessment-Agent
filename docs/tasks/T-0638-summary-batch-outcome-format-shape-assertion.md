---
id: T-0638
title: R-61 요약 batch outcome 한 줄 요약 라인 형태 불변식 검증 순수 가드 assertSummaryBatchOutcomeFormatShape
phase: P5
status: DONE
commitMode: pr
mergedAs: fcd38e33721d7cc1641f29058cb2028bae3ebd0c
prNumber: 552
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0635 plan-shape 가드의 outcome-side mirror. formatSummaryBatchOutcome(T-0622) 한 줄 요약 라인의 형태 불변식이 런타임 가드 부재 → 합본 리포트 2번째 라인 silent leak. plan 라인은 T-0635/36/37 로 가드·배선 완결됐으나 outcome 라인은 동등 가드 0. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts
  - src/assessment-evaluation/domain/summary-batch-outcome-format-shape.spec.ts
  - src/assessment-evaluation/domain/summary-batch-outcome-format.ts
---

# T-0638 — R-61 요약 batch outcome 한 줄 요약 라인 형태 불변식 검증 순수 가드 assertSummaryBatchOutcomeFormatShape

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". p5-summary-aggregate stream 의 표현(presentation) layer 에서 **합본 리포트(`formatSummaryBatchReport`, T-0630)는 2 라인** 으로 구성된다 — 1번째 라인 = `${PLAN_LABEL}${formatSummaryBatchRosterPlan(roster)}`(pre-flight 계획), 2번째 라인 = `${RESULT_LABEL}${result.summaryLine}`(outcome 결과). 그중 **1번째 라인의 plan 형태 불변식은 `assertSummaryBatchRosterPlanShape`(T-0635)로 가드가 정의·검증됐고 service `previewRosterPlan`(T-0636)·합본 formatter `formatSummaryBatchReport`(T-0637) 두 산출 지점에 배선까지 완결**됐다.

그러나 **2번째 라인(outcome `summaryLine`)을 산출하는 `formatSummaryBatchOutcome`(T-0622)의 한 줄 요약 문자열 형태 불변식을 런타임에서 fail-fast 로 강제하는 가드는 존재하지 않는다**. `formatSummaryBatchOutcome` 은 JSDoc(summary-batch-outcome-format.ts:33~66)으로만 출력 형태를 박제했다 — 결정적 한국어 단일 라인(개행 0) · prefix `요약 평가 batch: 총 N건` · `· 평가 N (생성 C / 기존 E)` · `· skip N` · 대괄호 `[day ... · week ... · month ... · other ...]` 4 버킷 고정 순서. 그 산출 `summaryLine` 은 pipeline → `result.summaryLine` 으로 외화돼 두 caller surface 로 흘러간다 — (a) `formatSummaryBatchReport` 가 합본 리포트 2번째 라인 본문으로 그대로 읽고(재렌더 0), (b) `SummaryBatchOrchestratorService` 가 pipeline 산출 `summaryLine` 을 가공 없이 노출. 그러나 `formatSummaryBatchReport` 의 기존 가드는 `result.summaryLine` 이 **비-string 이면 TypeError** 만 던질 뿐(summary-batch-report-format.ts), 그 라인 안의 형태 불변식(개행 0 · prefix · 5 카운트 토큰 · 4 버킷 슬롯)은 검증하지 않는다. 따라서 outcome 라인 산출 단계의 미래 회귀(prefix drift · 카운트 토큰 누락 · 버킷 슬롯 누락 · 개행 혼입 · 빈 라인 위장)는 모든 가드를 통과해 로그·journal·합본 리포트 2번째 라인으로 **silent leak** 할 수 있다.

본 task 는 그 비대칭 공백을 닫는다 — `assertSummaryBatchRosterPlanShape`(T-0635, plan 라인 형태 가드)의 정확한 **outcome-side mirror** 인 순수 가드 `assertSummaryBatchOutcomeFormatShape(line: string): void` 를 정의·검증한다. outcome 한 줄 요약이 형태 불변식을 위반하면 한국어 명세형 에러(구조·타입 결손=`TypeError` / 값·형태 위반=`RangeError`)를 던져 손상된 outcome 라인이 표현 surface 로 새는 것을 차단한다. 본 task 는 **가드 정의·검증까지만** — 산출 지점(합본 formatter `formatSummaryBatchReport` 2번째 라인 · service 경계) 배선은 별도 wiring follow-up(T-0636/T-0637 패턴 동형). 본 task 닫히면 p5-summary-aggregate stream 의 두 표현 라인(plan · outcome)이 **모두** 런타임 형태 가드를 갖춘다.

## Required Reading

- [src/assessment-evaluation/domain/summary-batch-outcome-format.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format.ts) — `formatSummaryBatchOutcome(report)`(L67~98) 가 산출하는 outcome 한 줄 요약 문자열의 **정확한 형태**(L80~97: head = `요약 평가 batch: 총 ${total}건 · 평가 ${evaluated} (생성 ${created} / 기존 ${existing}) · skip ${skipped}`, buckets = `GRANULARITY_BUCKETS.map(...).join(" · ")` 를 `[${buckets}]` 로 감쌈). 본 가드의 불변식은 이 출력 형태와 정합해야 한다. **본 task 는 이 파일에서 prefix 상수(예: `OUTCOME_LINE_PREFIX = "요약 평가 batch: "`)를 export 한 줄 추가 amend 만 허용**(formatter head 가 그 상수를 사용하도록 1줄 정렬 + 가드가 import 소비 — single-source 정합·prefix drift 방지). formatter 출력 byte-identical 보존(값·동작 무변경).
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts) — T-0635 `assertSummaryBatchRosterPlanShape(plan: string): void` 가드의 **mirror 대상**: ① string 타입 검사(비-string → TypeError) ② 개행 0(`\n` 포함 시 RangeError) ③ prefix 정합(RangeError) ④~⑥ 토큰·버킷 슬롯 정합(RangeError) 패턴 + 한국어 명세형 메시지 + 입력 비변형(읽기만) + JSDoc `@throws` 구분(TypeError=구조/타입 결손, RangeError=값/형태 위반). 본 가드는 이 파일의 에러 정책·문구 톤·구조를 그대로 mirror 하되 대상이 plan 라인이 아니라 outcome 한 줄 요약이다. **본문 변경 0 — 패턴 참조만**.
- [src/assessment-evaluation/domain/summary-batch-outcome.ts](../../src/assessment-evaluation/domain/summary-batch-outcome.ts) — `GRANULARITY_BUCKETS`(day → week → month → other 고정 순서) export const. 본 가드의 버킷 슬롯 검사는 이 single-source 를 import 해 순회한다(자체 정의 금지 — 라벨·순서 single-source 정합). `SummaryBatchOutcomeReport` 타입은 import 불필요(가드 입력은 산출된 string).
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.spec.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.spec.ts) — 본 가드 colocated spec 의 구조 mirror(happy 통과 · 각 불변식 위반별 RangeError · 비-string TypeError · 결정성·입력 비변형). describe/it 한국어 문자열·테스트 fixture 작성 convention 참조.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts` 신규 — 순수 가드 `assertSummaryBatchOutcomeFormatShape(line: string): void` 를 export 한다. 정상 형태면 `void` 반환(입력 비변형), 위반이면 한국어 명세형 에러를 던진다. 검증 불변식(`formatSummaryBatchOutcome` 출력 형태 정합):
  - ① **타입**: `line` 이 string 이 아니면(null/undefined/숫자/객체 포함) `TypeError`(구조·타입 결손).
  - ② **개행 0**: `line` 에 `\n` 이 포함되면 `RangeError`(단일 라인 위반).
  - ③ **prefix**: `line` 이 `요약 평가 batch: 총 ` 으로 시작하지 않으면 `RangeError`(prefix drift). prefix 상수는 outcome-format 모듈에서 import(single-source).
  - ④ **전역 카운트 토큰**: `평가 `, `(생성 `, ` / 기존 `, `· skip ` 핵심 토큰이 모두 등장하지 않으면 `RangeError`(카운트 토큰 누락).
  - ⑤ **버킷 대괄호 + 4 슬롯**: `[...]` 대괄호가 정확히 1쌍 존재하고 그 안에 `GRANULARITY_BUCKETS`(day/week/month/other) 4 버킷 라벨이 **고정 순서**로 모두 등장하지 않으면 `RangeError`(버킷 슬롯 누락·순서 뒤바뀜).
  - ⑥ **빈 라인 위장 차단**: 빈 문자열(`""`)·공백만(`"   "`) 은 prefix 불일치로 ③ 에 의해 `RangeError`(silent 빈 라인 위장 차단).
- [ ] `summary-batch-outcome-format.ts` amend 는 **prefix 상수 export 한 줄 + formatter head 가 그 상수 사용하도록 1줄 정렬**까지만 — formatter 출력 byte-identical 보존(값·동작·기존 spec 무회귀). `formatSummaryBatchOutcome` 본문 로직·`formatBucketDetail`·카운트 문구·버킷 순회 변경 0. 만약 순환 import 발생 시 가드 측에서 상수 로컬 복제 fallback 허용(단 값 동일성 spec 으로 drift 방지).
- [ ] 순수성·안전 보존: 직접 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · repository 0 · 새 dependency 0 · migration 0 · schema 변경 0 · raw 미저장(R-59 — 형태 검증만, 평가 본문·summaryId/narrative 미접촉) · 입력 비변형(`line` 문자열 읽기만 — split/match/test 결과로 원본 변형 0).
- [ ] 자동 복구·정규화·drop·재렌더 0 — 손상 outcome 라인은 fail-fast throw 전파만(silent 수선·정규화 금지).
- [ ] **Happy-path test 1+**: `formatSummaryBatchOutcome` 의 실제 산출 라인(여러 report fixture — 빈 batch `총 0건`, 혼합 카운트, 전건 skip, 전건 created, 일부 버킷 0)을 본 가드에 통과시키면 모두 `void` 반환(정상 형태를 false-positive throw 하지 않음)을 assert. 실제 formatter 산출을 가드에 먹이는 round-trip happy 1+ 필수(가드 불변식 ↔ formatter 출력 정합 회귀 차단).
- [ ] **Error path test 1+**: 비-string 입력(`null`/`undefined`/숫자/객체) → `TypeError` 전파 1+. 추가로 형태 위반 입력 → `RangeError` 전파 1+.
- [ ] **Flow/branch test**: 가드 통과(정상 형태 → void) 분기 1 + 각 위반 불변식(②~⑥)별 throw 분기 1 — 각 1+ test 로 분기 격리. 에러 종류(TypeError vs RangeError) 도 분기별 assert.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 빈 문자열·공백만 → RangeError(빈 라인 위장 차단) ② prefix drift(`평가 batch: ...` / `요약 평가: ...`) → RangeError ③ 개행 혼입(`...other 0]\n`) → RangeError ④ 버킷 1개 누락(`[day .. · week .. · month ..]`, other 없음) → RangeError ⑤ 버킷 순서 뒤바뀜(`[week .. · day .. ..]`) → RangeError ⑥ 카운트 토큰 누락(`생성`/`기존`/`skip` 중 하나 빠진 라인) → RangeError ⑦ 같은 입력 2회 호출 결정성(byte-identical 동작·입력 비변형) ⑧ 정상 라인 비변형(가드 호출 후 입력 문자열 무변경). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 가드 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- 가드 wiring — `formatSummaryBatchReport` 합본 2번째 라인 산출 직전 · service 경계에서 본 가드를 호출하는 배선은 **별도 follow-up**(T-0636/T-0637 패턴 동형). 본 task 는 가드 정의·검증까지만. 산출 경로 안에서 본 가드 자동 호출 0.
- `formatSummaryBatchOutcome`/`formatBucketDetail`/`summarizeSummaryBatchOutcome`/`SummaryBatchOutcomeReport` **본문 로직 변경**(카운트 문구·버킷 순회·출력 형태 무변경) — outcome-format 모듈은 prefix 상수 export 한 줄 + head 1줄 정렬 amend 만(byte-identical 출력 보존).
- `assertSummaryBatchRosterPlanShape`/`assertSummaryBatchReportShape`/`assertSummaryBatchOutcomeConsistent`(report 객체 일관성 가드, T-0620) **본문 변경** — 본 task 는 새 outcome 라인 형태 가드 추가만. report 객체 가드(T-0620)와 라인 문자열 가드(본 task)는 책임 분리(전자=머신리더블 카운트 일관성, 후자=렌더된 문자열 형태).
- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표 → EvaluationResult[] collection bridge(cross-module RBAC ADR) — §5 BLOCKED 회피.
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 · 다국어(i18n) · 정규식 과적합 — 순수 문자열 검사만.
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 두 표현 라인(plan · outcome)이 모두 런타임 형태 가드를 갖춘다. 남는 자연 후보: (a) 본 outcome-format-shape 가드를 `formatSummaryBatchReport` 합본 2번째 라인 산출 직전·service 경계에 배선하는 wiring slice(T-0636/T-0637 패턴 동형 — outcome-side) / (b) p5-summary-aggregate 표현측 가드·wiring 소진 시 인접 PLAN bullet 으로 stream 전환 — R-58 재수집 정책(PLAN 100행)·R-37·38 품질 분류(PLAN 103행) 등 / (c) 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 다른 stream 으로 판단.)
