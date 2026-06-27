---
id: T-0705
title: realdata-e2e result-summary 집계 결과 ↔ EvaluationResult[] 독립 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5/PLAN109 realdata-e2e build-time guard chain — NO-GUARD leaf buildRealDataResultSummary(T-0580) 집계↔입력 독립 재유도 정합 가드 신설, T-0701 summaryLine 가드 mirror, dependsOn [] 독립"
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-consistency.ts
  - test/helpers/realdata-e2e-result-summary-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-result-summary-guard
---

# T-0705 — realdata-e2e result-summary 집계 결과 ↔ EvaluationResult[] 독립 재유도 정합 가드 신설

## Why

PLAN P5(109행) 의 realdata-e2e build-time consistency guard chain 이 NO-GUARD leaf 컴포저를 하나씩 정합 가드로 덮고 있다. `buildRealDataResultSummary(results)` ([test/helpers/realdata-e2e-result-summary.ts](../../test/helpers/realdata-e2e-result-summary.ts), T-0580) 는 `EvaluationResult[]` 를 결과 요약 descriptor(count / byDifficulty / byContribution / totalVolume)로 집계하는 순수 leaf 인데, 그 집계 로직(슬롯 초기화·difficulty/contribution 카운트·volume 합산)이 입력으로부터 **독립 재유도되어 build-time 에 대조되지 않는다**. 상위 가드(T-0699 result-report-plan)는 컴포저를 **재호출**해 deep-equal 할 뿐 집계 내부 로직 drift 는 미cover 한다(T-0701 summaryLine 독립 재합성 가드가 동일 gap 을 닫은 것과 동형). 본 가드는 컴포저 재호출 없이 `results` 만으로 expected 요약을 독립 재유도해 deep-equal 대조함으로써 집계 drift 를 build-time fail-fast 로 차단한다. R-59/REQ-032(raw 미저장 — 요약은 narrative 본문 미보유, 카운트·분포·합산만) 와 REQ-059(요약 descriptor 가 raw 활동 본문 미보유) 정합을 가드가 박제한다.

## Required Reading

- [test/helpers/realdata-e2e-result-summary.ts](../../test/helpers/realdata-e2e-result-summary.ts) — 가드 대상 leaf 컴포저(`buildRealDataResultSummary`, `RealDataResultSummary` 인터페이스, `zeroDifficultyCounts`/`zeroContributionCounts` 내부 helper, slot single-source 정합 주석).
- [test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts](../../test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts) — 독립 재유도 가드 신설의 직전 mirror(T-0701, summaryLine 을 컴포저 재호출 없이 재합성 후 대조 — 구조결손 TypeError ↔ 값정합 RangeError 분리 패턴 차용).
- [test/helpers/realdata-e2e-result-issue-action-consistency.ts](../../test/helpers/realdata-e2e-result-issue-action-consistency.ts) — 직전 신설 가드(T-0703, 분기 결정 독립 재유도 deep-equal + 에러 종류 분리 패턴).
- `src/assessment-evaluation/domain/evaluation-result.ts` 의 `CONTRIBUTION_LEVELS` / `ContributionLevel` / `EvaluationResult`, `src/llm/difficulty.ts` 의 `DIFFICULTIES` / `Difficulty` — 슬롯 single-source(import 재사용, 중복 정의 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-summary-consistency.ts` 신설 — `assertRealDataResultSummaryConsistentWithInputs(summary: RealDataResultSummary, results: EvaluationResult[]): void` export. 컴포저(`buildRealDataResultSummary`)를 **재호출하지 않고** `results` 만으로 expected 요약(count = `results.length`, byDifficulty/byContribution = `DIFFICULTIES`/`CONTRIBUTION_LEVELS` 슬롯 0 초기화 후 카운트, totalVolume = volume 합산)을 독립 재유도한 뒤 입력 `summary` 와 deep-equal 대조. 불일치 시 throw.
- [ ] 에러 종류 분리(T-0703/T-0701 패턴 차용): 입력 `summary` 의 구조 결손(필드 누락 / 타입 불일치 / byDifficulty·byContribution 가 객체 아님)은 `TypeError`, 구조는 정상이나 값이 재유도 결과와 불일치(카운트·합산·분포 슬롯 값 drift)는 `RangeError` 로 분리해 throw. 에러 메시지는 한국어로 어느 필드/슬롯이 어긋났는지 식별 가능하게.
- [ ] 가드는 입력 `summary` / `results` 를 변형하지 않는다(읽기만). 재유도용 새 Record 만 생성.
- [ ] colocated spec `test/helpers/realdata-e2e-result-summary-consistency.spec.ts` 신설.
- [ ] **happy-path test 1+**: 정상 컴포저 산출(`buildRealDataResultSummary` 호출 결과)을 가드에 통과 → throw 0. 빈 입력(count 0, 전 슬롯 0, totalVolume 0) · 단일 원소 · 다수 원소(여러 difficulty/contribution 혼재) 각각 1+.
- [ ] **error path test 1+**: 구조 결손 입력(필드 누락 / byDifficulty null / count 가 number 아님 등) → `TypeError`. 각 결손 종류 1+.
- [ ] **flow / branch cover**: count drift / totalVolume drift / byDifficulty 슬롯 값 drift / byContribution 슬롯 값 drift 각 분기 → 각각 `RangeError` 1+ test. TypeError vs RangeError 분기 경계 cover.
- [ ] **negative cases 충분 cover**: ① 미등장 슬롯이 0 으로 보존돼야 하는데 임의 값 주입된 summary → RangeError. ② volume 합산 1 차이 drift → RangeError. ③ byContribution 한 슬롯만 +1 drift → RangeError. ④ summary 객체 자체가 null/undefined → TypeError. ⑤ results 원소의 difficulty 가 슬롯 키 아님(가드가 재유도 시 미정의 슬롯 접근) 경계 처리. 예외 처리 분기마다 각 1+ test.
- [ ] 가드가 입력을 변형하지 않음을 검증하는 비변형 test 1+ (재유도 후 입력 `summary`·`results` 참조·값 동일).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 line/branch/func/stmt 충분 cover(직전 신설 가드 T-0701/T-0703 와 동등 100% 지향).
- [ ] `pnpm lint && pnpm build && pnpm test` green, CI 3종(unit/smoke/e2e) green.

## Out of Scope

- 컴포저 `realdata-e2e-result-summary.ts` 의 self-wire 배선(가드를 컴포저 return 직전 호출하도록 삽입) — **별도 task(T-0706 후속)** 로 분리. 본 task 는 가드 helper + colocated spec 신설만(가드 신설/self-wire 분리 패턴 T-0701→T-0702, T-0703→T-0704 동형).
- 컴포저 로직 자체 변경 / 집계 공식 변경 / 슬롯 키 집합 변경.
- production `src/` 코드 변경 — test helper 단독(타입·슬롯 배열 import 재사용만).
- 다른 NO-GUARD leaf(live-gating `resolveRealDataE2eLiveGating` / result-issue-descriptor) 가드 — 별도 task.
- result-summary-line / result-summary-markdown(별개 leaf, 별도 shape 가드 존재) 정합.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 신설 시 비움. self-wire 짝은 본 task 머지 후 planner 가 T-0706 으로 큐잉.)
