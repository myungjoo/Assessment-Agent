---
id: T-0713
title: realdata-e2e result-summary-markdown 렌더 값 ↔ summary 필드 single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — renderRealDataResultSummaryMarkdown 의 렌더 문자열을 summary 필드만으로 독립 재합성하는 값-정합 가드 신설(NO-GUARD leaf, T-0711 result-summary-line mirror)"
independentStream: realdata-e2e-result-summary-markdown-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-markdown-consistency.ts
  - test/helpers/realdata-e2e-result-summary-markdown-consistency.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: 가드 본체 + colocated spec(난이도 3슬롯·기여도 4슬롯·count·volume 6+ RangeError 분기 각 1+ negative) 합산 ~330 LOC. test-only·src 무변경, 직전 sibling T-0711(+421)/T-0705(+586)/T-0709(+613) 머지 선례 일관. R-112 negative-cases 충분 cover 가 spec 비중을 키움."
---

# T-0713 — realdata-e2e result-summary-markdown 렌더 값 ↔ summary 필드 single-source 재유도 정합 가드 신설

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 요약 표현 surface 의 build-time consistency-guard sweep 의 일환이다. NO-GUARD leaf 컴포저 `renderRealDataResultSummaryMarkdown`(T-0581, `test/helpers/realdata-e2e-result-summary-markdown.ts`)은 `RealDataResultSummary`(count / totalVolume / byDifficulty 3 슬롯 / byContribution 4 슬롯)를 daily-test 이슈 본문용 **결정론적 마크다운 문자열**로 렌더링하는 leaf 다. issue-still-relevant 확인: origin/main 에 `result-summary-markdown.ts`(leaf)·`.spec.ts` 는 존재하나, `*-result-summary-markdown-consistency.ts` 파일·`RealDataResultSummaryMarkdownConsistent` 심볼은 **grep 0 부재** — 렌더 문자열의 각 슬롯/카운트 토큰이 summary 필드의 실제 값에 단조 매핑됐는지를 검증하는 값-정합 가드층이 없다. 직전 T-0711(result-summary-line 값-정합 가드)의 Follow-up 이 본 leaf 를 다음 후보로 명시했다.

T-0711(라인 값 독립 재합성 정합 가드)의 markdown mirror 로, summary 필드만으로 expected 마크다운을 **컴포저 재호출 없이** 독립 재합성해 byte-identical 대조하는 가드를 신설해 값/슬롯 순서 drift 를 build-time fail-fast 로 차단한다(렌더러 내부 값 매핑이 잘못 바뀌어도 재호출 산출도 같은 잘못된 값을 내어 상쇄 통과하는 gap 을 닫는다). REQ-059(결과 요약이 raw 미보유·결정적 표현) + REQ-032(이슈 표면 정합) 가드층을 보강한다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary-markdown.ts` — 가드 대상 leaf 컴포저 `renderRealDataResultSummaryMarkdown(summary)`. 출력 구조(고정 순서: `## 실 평가 e2e 결과 요약` 헤더 → `- 평가 단위 수: <count>` → `- 총 volume: <totalVolume>` → `### difficulty 분포` 표(DIFFICULTIES 순서) → `### contribution 분포` 표(CONTRIBUTION_LEVELS 순서))가 single source. 표 행 형식 `| <slot> | <count> |`, 줄바꿈/공백 전부 고정. **본 가드는 이 출력 구조 리터럴을 그대로 미러링하되 컴포저를 재호출하지 않고 summary 필드만으로 재합성한다.**
- `test/helpers/realdata-e2e-result-summary-line-consistency.ts` 와 그 colocated spec — **mirror 선례**(T-0711). 컴포저 재호출 없이 입력 필드만으로 독립 재합성 → byte-identical 대조, 구조결손 TypeError↔값정합 RangeError 분리 패턴을 그대로 따른다.
- `test/helpers/realdata-e2e-result-summary.ts` — `RealDataResultSummary` 타입(count: number / totalVolume: number / byDifficulty: Record<Difficulty,number> / byContribution: Record<ContributionLevel,number>) single source 참조.
- `src/llm/difficulty.ts` — `DIFFICULTIES`(easy → medium → hard 고정 순서) 슬롯 single-source 배열 import 재사용.
- `src/assessment-evaluation/domain/evaluation-result.ts` — `CONTRIBUTION_LEVELS`(zero → low → medium → high 고정 순서) 슬롯 single-source 배열 import 재사용.

## Acceptance Criteria

신규 파일 `test/helpers/realdata-e2e-result-summary-markdown-consistency.ts` 에 순수 함수 가드 `assertRealDataResultSummaryMarkdownConsistentWithSummary(markdown: string, summary: RealDataResultSummary): void`(또는 동등한 명명) 를 신설하고, colocated spec `test/helpers/realdata-e2e-result-summary-markdown-consistency.spec.ts` 를 작성한다.

- [ ] 가드는 `renderRealDataResultSummaryMarkdown` 을 **재호출하지 않고** summary 필드(count·totalVolume·byDifficulty 3 슬롯·byContribution 4 슬롯)만으로 expected 마크다운을 독립 재합성(`DIFFICULTIES`·`CONTRIBUTION_LEVELS` 슬롯 배열만 single-source import 재사용, 헤더/표 리터럴은 가드 안에 미러링)한 뒤, 실제 `markdown` 과 **byte-identical** 대조한다. 정합이면 void(무회귀·입력 비변형), 불일치면 `RangeError`(값 정합 위반).
- [ ] 구조 결손(`markdown` 이 string 아님·null/undefined, `summary` 가 null/undefined 이거나 byDifficulty/byContribution 누락·해당 슬롯 키 부재)은 `TypeError` 로 분리해 던진다(값정합 `RangeError` 와 구분).
- [ ] **Happy-path test 1+** — 정상 summary↔마크다운 쌍(빈 batch count=0·전 슬롯 0 포함, 일반 batch)에 대해 가드가 throw 0 으로 통과(렌더러 실 출력 대조).
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test: ① count 토큰 drift(마크다운의 `평가 단위 수` 값이 summary.count 와 불일치) → RangeError, ② totalVolume 토큰 drift → RangeError, ③ difficulty 슬롯 값/순서 drift(예: easy↔hard 행 값 뒤바뀜) → RangeError, ④ contribution 슬롯 값/순서 drift → RangeError, ⑤ 헤더/표 구분선 등 고정 리터럴 drift(예: 섹션 제목·표 헤더 행 변형) → RangeError, ⑥ markdown null/undefined/비string → TypeError, ⑦ summary null/undefined → TypeError, ⑧ summary.byDifficulty / byContribution 누락 또는 슬롯 키 부재 → TypeError. (단일 negative 금지 — 예외 분기마다 각 1+.)
- [ ] **Flow / branch coverage** — TypeError 분기와 RangeError 분기, 재합성 슬롯 순회(difficulty 3 슬롯·contribution 4 슬롯) 각 분기를 test 로 cover.
- [ ] 가드가 입력 `markdown`·`summary`(하위 byDifficulty/byContribution 객체 포함)를 비변형(읽기 전용)함을 검증하는 test 1+(호출 전후 deep-equal).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 가드 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test 무회귀).

## Out of Scope

- 컴포저 `realdata-e2e-result-summary-markdown.ts` 의 self-wire 배선(반환 직전 본 신규 가드 self-assert 삽입)은 **본 task 에서 하지 않는다** — 후속 짝 task(T-0711→T-0712 패턴)로 분리. 본 task 는 가드 신설만.
- `renderRealDataResultSummaryMarkdown` 렌더러 본문·마크다운 출력 byte 변경 금지(가드는 읽기만).
- 기존 result-summary-line / result-summary 가드(T-0705/T-0711) 수정/대체 금지.
- 다른 NO-GUARD 후보(parse-shape / search-parse / seed-* 등)는 별도 task.
- `src/` 변경 0(test-only). 슬롯 배열(`DIFFICULTIES`·`CONTRIBUTION_LEVELS`)·타입은 import 재사용만, 재정의 금지.

## Suggested Sub-agents

`implementer → tester` (test-only 가드 신설 — 아키텍처 결정 없음, T-0711 mirror 라 architect 불요).

## Follow-ups

- (예정) result-summary-markdown 컴포저 self-wire 짝 — `renderRealDataResultSummaryMarkdown` 반환 직전 본 신규 가드 self-assert + import(T-0712 self-wire mirror; markdown 리터럴 재합성이라 lazy require 순환 의존 여부는 implementer 가 import 그래프로 판정).
- 잔여 NO-GUARD leaf 후보 재survey: parse-shape(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 류는 형태 검증 위주라 값-정합 가드 적용 여부 case-by-case. seed-side(`seed-fixture`·`seed-upsert`·`seed-resolve-person-id`)는 별도 stream.
