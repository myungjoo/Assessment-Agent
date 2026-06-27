---
id: T-0714
title: realdata-e2e result-summary-markdown 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-27
plannerNote: "P5 consistency sweep — assertRealDataResultSummaryMarkdownConsistentWithSummary 를 renderRealDataResultSummaryMarkdown 단일 return 직전 self-assert 배선(T-0713 가드 짝 닫기, T-0710 top-level import self-wire mirror — 가드가 컴포저 미import 라 순환 의존 0)"
independentStream: realdata-e2e-result-summary-markdown-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-markdown.ts
  - test/helpers/realdata-e2e-result-summary-markdown.spec.ts
  - test/helpers/realdata-e2e-result-summary-markdown-consistency.spec.ts
---

# T-0714 — realdata-e2e result-summary-markdown 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 요약 표현 surface 의 build-time consistency-guard sweep 의 일환으로, T-0713 이 신설한 값-정합 가드 `assertRealDataResultSummaryMarkdownConsistentWithSummary`(`test/helpers/realdata-e2e-result-summary-markdown-consistency.ts`)는 현재 **컴포저에서 호출되지 않는다**(self-wire 미배선). 가드가 존재하지만 `renderRealDataResultSummaryMarkdown` 의 실 렌더 경로에 self-assert 로 묶이지 않아, 렌더러 값 매핑이 잘못 바뀌면 가드를 따로 호출하지 않는 한 build-time 에 잡히지 않는 gap 이 남는다.

issue-still-relevant 확인: origin/main(cc6d1224) 의 `test/helpers/realdata-e2e-result-summary-markdown.ts` 본문에 `assertRealDataResultSummaryMarkdownConsistent*` self-assert 호출이 **grep 0 부재** — self-wire 가 진짜로 안 됐음을 확인했다. 또한 가드 모듈은 `CONTRIBUTION_LEVELS`·`DIFFICULTIES`(value) + `RealDataResultSummary`(type-only) 만 import 하고 **컴포저 모듈을 import 하지 않으므로**, 컴포저 → 가드 단방향 edge 만 생긴다(순환 의존 0 — T-0710 top-level import 선례, T-0708/T-0712 의 lazy require 불요).

T-0711→T-0712 / T-0709→T-0710 / T-0707→T-0708 패턴의 markdown mirror 로, `renderRealDataResultSummaryMarkdown` 단일 return 직전에 본 가드를 self-assert 로 배선해 렌더 값 drift 를 컴포저 호출 경로 자체에서 fail-fast 차단한다. REQ-059(결과 요약이 raw 미보유·결정적 표현) + REQ-032(이슈 표면 정합) 의 build-time 가드층을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary-markdown.ts` — self-wire 대상 leaf 컴포저 `renderRealDataResultSummaryMarkdown(summary)`. 단일 return(배열 `.join("\n")`)의 직전에 `const markdown = [...].join("\n")` 로 묶고, 그 직후 가드 self-assert 후 `markdown` 을 return 하도록 배선한다. 가드 본체·출력 byte 변경 금지.
- `test/helpers/realdata-e2e-result-summary-markdown-consistency.ts` — self-wire 할 가드 `assertRealDataResultSummaryMarkdownConsistentWithSummary(markdown, summary)`. **import 그래프 확인**: 본 가드는 컴포저 모듈을 import 하지 않음(`CONTRIBUTION_LEVELS`/`DIFFICULTIES`/type-only 만) → 컴포저에서 **top-level import** 로 가드를 가져와도 순환 의존 0. (T-0710 mirror. implementer 가 import 그래프 재확인 후 top-level import 채택하되, 만약 예상과 달리 순환 edge 가 발견되면 T-0712 lazy `require` fallback.)
- `test/helpers/realdata-e2e-result-summary-line.ts` 와 그 컴포저 — **self-wire 선례**(T-0712, lazy require) / `test/helpers/realdata-e2e-result-issue-descriptor.ts`(T-0710, top-level import). 두 패턴 중 import 그래프에 맞는 쪽 채택.

## Acceptance Criteria

`test/helpers/realdata-e2e-result-summary-markdown.ts` 의 `renderRealDataResultSummaryMarkdown` 단일 return 직전에 `assertRealDataResultSummaryMarkdownConsistentWithSummary` 를 self-assert 로 배선한다(import 1 줄 + self-assert 1 줄, 가드 본체·렌더 출력 byte 무변경).

- [ ] 컴포저는 최종 마크다운 문자열을 `const markdown` 으로 묶은 뒤, return 직전 `assertRealDataResultSummaryMarkdownConsistentWithSummary(markdown, summary)` 를 호출하고 `markdown` 을 그대로 return 한다. 렌더 출력 byte·구조 무변경(기존 happy-path test 무회귀).
- [ ] import 는 top-level(가드가 컴포저 미import → 순환 의존 0 검증 후) 채택. 만약 import 그래프에서 순환 edge 가 확인되면 lazy `require`(T-0712 mirror)로 회피하고 그 사유를 trail notes 에 1 줄 박제.
- [ ] **Happy-path test 1+** — 컴포저가 정상 summary 에 대해 가드 self-assert 통과 후 정상 마크다운 문자열을 return 함을 검증(기존 렌더 출력과 byte-identical, 무회귀).
- [ ] **호출 배선 검증 test 1+** — `renderRealDataResultSummaryMarkdown` 호출 시 `assertRealDataResultSummaryMarkdownConsistentWithSummary` 가 실제 호출됨을 spy/mock 으로 검증(self-wire 배선 자체가 dead 가 아님을 증명).
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test:
  - ① 가드가 RangeError 를 throw 하는 입력(예: 렌더러 값 매핑을 의도적으로 깨는 mock 시나리오 또는 가드 spy 가 throw)에서 그 throw 가 컴포저 밖으로 **전파**됨을 검증.
  - ② 가드가 TypeError 를 throw 하는 구조 결손 입력에서 그 throw 가 컴포저 밖으로 전파됨을 검증.
  - ③ 형태/구조 가드가 먼저 throw 하는 경우(있다면) 값-정합 가드가 **호출되지 않음**(선throw 시 후속 미호출) negative 검증 — 분기 순서 보장.
  (단일 negative 금지 — 예외 전파·미호출 분기 각 1+.)
- [ ] **Flow / branch coverage** — self-assert 통과 경로(정상 return)와 self-assert throw 전파 경로 양 분기를 test 로 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test·T-0713 가드 spec 무회귀).

## Out of Scope

- T-0713 가드 본체(`realdata-e2e-result-summary-markdown-consistency.ts`) 로직 수정/대체 금지 — 본 task 는 self-wire 배선만(import 그래프 확인 위해 read 만).
- `renderRealDataResultSummaryMarkdown` 렌더러의 마크다운 출력 byte/구조 변경 금지(self-assert 삽입 외 동작 변화 0).
- 다른 NO-GUARD leaf 컴포저(parse-shape / search-parse / seed-* 등) self-wire 는 별도 task.
- `src/` 변경 0(test-only). 슬롯 배열·타입 재정의 금지.

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, import 그래프 확인은 implementer 가 read 로 판정, T-0710/T-0712 mirror 라 architect 불요).

## Follow-ups

- 잔여 NO-GUARD leaf 후보 재survey(가드 신설 + self-wire 짝): parse-shape(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 류는 형태 검증 위주라 값-정합 가드 적용 여부 case-by-case. seed-side(`seed-fixture`·`seed-upsert`·`seed-resolve-person-id`)는 별도 stream.
