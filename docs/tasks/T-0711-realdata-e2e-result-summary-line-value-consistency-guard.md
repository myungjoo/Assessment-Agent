---
id: T-0711
title: realdata-e2e result-summary-line 값 ↔ summary 필드 single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — formatRealDataResultSummaryLine 의 라인 값을 summary 필드만으로 독립 재합성하는 값-정합 가드 신설(format-shape 가드는 형태만·body 가드는 formatter 재호출이라 값 drift 미cover gap)"
independentStream: realdata-e2e-result-summary-line-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line-consistency.ts
  - test/helpers/realdata-e2e-result-summary-line-consistency.spec.ts
---

# T-0711 — realdata-e2e result-summary-line 값 ↔ summary 필드 single-source 재유도 정합 가드 신설

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 요약 표현 surface 의 build-time consistency-guard sweep 의 일환이다. NO-GUARD leaf 컴포저 `formatRealDataResultSummaryLine`(T-0643, `test/helpers/realdata-e2e-result-summary-line.ts`)은 현재 형태 가드 `assertRealDataResultSummaryLineFormatShape`(라인 **문자열**만 받아 prefix·토큰 존재·개행 0 등 **형태**만 검증) 만 self-wire 하고 있다. 한편 상위 body-consistency 가드(T-0646)는 `formatRealDataResultSummaryLine(summary)` 를 **컴포저 재호출**해 byte-identical 대조하므로, formatter 내부 값 매핑(count/volume 토큰·난이도 슬롯 값·기여도 슬롯 값·슬롯 순서)이 잘못 바뀌어도 재호출 산출도 같은 잘못된 값을 내어 **양방향 drift 상쇄로 통과**한다. 즉 summary 필드의 실제 값이 라인 안의 올바른 슬롯에 단조 매핑됐는지를 검증하는 **값-정합 가드는 부재(origin/main grep 0)** 다. T-0701(outcome-report summaryLine 독립 재합성 정합 가드)의 result-summary-line mirror 로, summary 필드만으로 라인을 컴포저 재호출 없이 독립 재합성해 byte-identical 대조하는 가드를 신설해 값 drift 를 build-time fail-fast 로 차단한다. REQ-059(결과 요약이 raw 미보유·결정적 표현) + REQ-032(이슈 표면 정합) 가드층을 보강한다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary-line.ts` — 가드 대상 컴포저 `formatRealDataResultSummaryLine(summary)`. 라인 합성 규칙(`RESULT_LINE_PREFIX` + `count=N` + `· volume=V` + `· 난이도(easy/medium/hard)=a/b/c` + `· 기여도(zero/low/medium/high)=p/q/r/s`)이 single source. `DIFFICULTIES`·`CONTRIBUTION_LEVELS` 고정 순서 순회.
- `test/helpers/realdata-e2e-result-summary-line-format-shape.ts` — 기존 형태 가드(라인 문자열만 검증). 본 가드는 이를 **대체하지 않고** 값-정합 층을 추가(형태↔값 책임 분리).
- `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts` 와 그 colocated spec — **mirror 선례**(T-0701). 독립 재합성 → byte-identical 대조, 구조결손 TypeError↔값정합 RangeError 분리 패턴을 그대로 따른다.
- `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` — 컴포저 재호출 방식의 상위 가드(본 task 가 메우는 gap 의 출처). 본 가드는 재호출 없이 summary 필드만으로 재유도한다는 점에서 차별화됨을 확인.
- `test/helpers/realdata-e2e-result-summary.ts` — `RealDataResultSummary` 타입(count/totalVolume/byDifficulty/byContribution) single source 참조.

## Acceptance Criteria

신규 파일 `test/helpers/realdata-e2e-result-summary-line-consistency.ts` 에 순수 함수 가드 `assertRealDataResultSummaryLineConsistentWithSummary(line: string, summary: RealDataResultSummary): void`(또는 동등한 명명) 를 신설하고, colocated spec `test/helpers/realdata-e2e-result-summary-line-consistency.spec.ts` 를 작성한다.

- [ ] 가드는 `formatRealDataResultSummaryLine` 을 **재호출하지 않고** summary 필드(count·totalVolume·byDifficulty 3 슬롯·byContribution 4 슬롯)만으로 expected 라인을 독립 재합성(`RESULT_LINE_PREFIX` 상수만 single-source import 재사용)한 뒤, 실제 `line` 과 **byte-identical** 대조한다. 정합이면 void(무회귀·입력 비변형), 불일치면 `RangeError`(값 정합 위반).
- [ ] 구조 결손(line 이 string 아님·null/undefined, summary 가 null/undefined 이거나 byDifficulty/byContribution 누락)은 `TypeError` 로 분리해 던진다(값정합 `RangeError` 와 구분).
- [ ] **Happy-path test 1+** — 정상 summary↔라인 쌍(빈 batch count=0 슬롯 포함, 일반 batch)에 대해 가드가 throw 0 으로 통과.
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test: ① count 값 drift(라인의 count 토큰이 summary.count 와 불일치) → RangeError, ② volume drift → RangeError, ③ 난이도 슬롯 값/순서 drift(예: easy↔hard 값 뒤바뀜) → RangeError, ④ 기여도 슬롯 값/순서 drift → RangeError, ⑤ prefix drift → RangeError, ⑥ line null/undefined/비string → TypeError, ⑦ summary null/undefined → TypeError, ⑧ summary.byDifficulty / byContribution 누락 → TypeError.
- [ ] **Flow / branch coverage** — TypeError 분기와 RangeError 분기, 재합성 슬롯 순회(난이도·기여도) 각 분기를 test 로 cover.
- [ ] 가드가 입력 `line`·`summary` 를 비변형(읽기 전용)함을 검증하는 test 1+(호출 전후 deep-equal).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 가드 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test 무회귀).

## Out of Scope

- 컴포저 `realdata-e2e-result-summary-line.ts` 의 self-wire 배선(반환 직전 본 신규 가드 self-assert 삽입)은 **본 task 에서 하지 않는다** — 후속 짝 task(T-0701→T-0702 패턴)로 분리. 본 task 는 가드 신설만.
- `formatRealDataResultSummaryLine` formatter 본문·라인 출력 byte 변경 금지(가드는 읽기만).
- 기존 형태 가드(`assertRealDataResultSummaryLineFormatShape`)·body-consistency 가드(T-0646) 수정/대체 금지.
- `result-summary-markdown`·`result-summary` 등 다른 NO-GUARD 후보는 별도 task.
- `src/` 변경 0(test-only).

## Suggested Sub-agents

`implementer → tester` (test-only 가드 신설 — 아키텍처 결정 없음, T-0701 mirror 라 architect 불요).

## Follow-ups

- (예정) result-summary-line 컴포저 self-wire 짝 — `formatRealDataResultSummaryLine` 반환 직전 본 신규 가드 self-assert + import(T-0702/T-0710 self-wire mirror).
- 잔여 NO-GUARD leaf 후보 재survey: `renderRealDataResultSummaryMarkdown`(result-summary-markdown) 등.
