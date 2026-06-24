---
id: T-0646
title: 실 평가 e2e 결과 이슈 descriptor body 구조 불변식 검증 순수 가드 assertRealDataResultIssueDescriptorBodyConsistent 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — issue-descriptor body 가 (marker · 한 줄 요약 · markdown) 3블록을 single-source 산출과 byte-identical 합성함을 런타임 강제하는 순수 가드. summary-batch-outcome-consistency mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts
  - test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.spec.ts
---

# T-0646 — 실 평가 e2e 결과 이슈 descriptor body 구조 불변식 검증 순수 가드

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 post-composition 무결성 조각. realdata-e2e-result-summary-line stream 은 한 줄 요약을 정의(T-0642)·형태검증(T-0643)·self-guard(T-0644)했고, T-0645 (PR #559 squash a14c88f) 가 그 한 줄을 이슈 descriptor body 의 leading 라인으로 **실배선**해 `body = [marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")` 3블록 구조로 합성한다.

그러나 그 body 3블록 구조 불변식 — **① 첫 라인 = marker / ② 한 줄 요약이 `formatRealDataResultSummaryLine(summary)` 산출과 byte-identical 하게 정확히 1회 등장 / ③ markdown 본문이 `renderRealDataResultSummaryMarkdown(summary)` 산출과 byte-identical / ④ 세 블록이 빈 줄 1개로 구분** — 은 현재 `buildRealDataResultIssueDescriptor` 본문 주석과 T-0645 spec 의 happy-path 단언으로만 박제돼 있고, **런타임에서 강제되는 독립 불변식 가드가 부재**하다. body 합성 로직이 미래에 회귀(블록 순서 뒤바뀜·구분 빈 줄 누락·한 줄 요약 중복/누락·markdown 가공 혼입)하면 그것을 즉시 fail-fast 로 catch 하는 layer 가 없다.

본 task 는 그 빈칸을 채운다 — `summary-batch` 측이 outcome 리포트의 문서화된 불변식을 `assertSummaryBatchOutcomeConsistent`(T-0615 mirror, summary-batch-outcome-consistency.ts) 순수 가드로 런타임 강제한 패턴의 정확한 realdata-e2e-side mirror 다. 신규 helper `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 는 주어진 descriptor 의 `body` 가 입력 `summary` 로부터 single-source 산출(`formatRealDataResultSummaryLine` + `renderRealDataResultSummaryMarkdown`)을 **재유도해 비교**함으로써, body 가 (marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown) 정확한 구조를 byte-identical 로 만족하는지 검증한다. 위반이면 어느 블록·어느 불변식이 깨졌는지 명시한 한국어 명세형 에러(구조 결손 = TypeError / 형태 위반 = RangeError)를 던져, 손상된 descriptor 가 gh issue 실배선·rolling 이슈 surface 로 새기 전 차단한다.

본 가드가 닫히면 한 줄 요약이 정의·형태검증·self-guard·caller-surface 실배선·**body 구조 무결성 런타임 강제**까지 닿아, 자연 follow-up (가드를 `buildRealDataResultIssueDescriptor` 산출 직전에 self-wire — T-0644 formatter self-guard 의 descriptor-side mirror, 또는 gh issue 실배선 — LAN/credential gate deferred) 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `buildRealDataResultIssueDescriptor(summary, run)` (L116~141) 의 `body` 합성 구조 (L132~138): `[marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")`. `RealDataResultIssueDescriptor` 인터페이스 (L83~87) `{ title, marker, body }`. 본 task 는 이 본문을 **변경하지 않고** 그 산출 descriptor 의 body 구조를 검증하는 외부 가드만 신설. import 재사용: `RealDataResultIssueDescriptor` 타입.
- [test/helpers/realdata-e2e-result-summary-line.ts](../../test/helpers/realdata-e2e-result-summary-line.ts) — `formatRealDataResultSummaryLine(summary)` (T-0642/T-0644). 본 가드가 body 의 한 줄 요약 블록 기대값을 재유도할 single-source. import 재사용 (본문 변경 0).
- [test/helpers/realdata-e2e-result-summary-markdown.ts](../../test/helpers/realdata-e2e-result-summary-markdown.ts) — `renderRealDataResultSummaryMarkdown(summary)` (T-0581). 본 가드가 body 의 markdown 블록 기대값을 재유도할 single-source. import 재사용 (본문 변경 0).
- [src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts) — **mirror 패턴 참조만**: `assertSummaryBatchOutcomeConsistent(report)` 순수 가드 (순수 함수 / null·undefined fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 재유도 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0). 본 가드는 이 파일을 import 하지 않으나 에러 정책·가드 관례·JSDoc 톤을 mirror.
- [test/helpers/realdata-e2e-result-issue-descriptor.spec.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.spec.ts) — 기존 colocated spec 의 fixture 빌더 (슬롯별 카운트로 결정론적 summary 생성) 관례 참조. 본 task 의 신규 colocated spec 이 동형 fixture 관례로 happy/error/branch/negative describe 블록을 구성.

## Acceptance Criteria

- [ ] 신규 helper `assertRealDataResultIssueDescriptorBodyConsistent(descriptor: RealDataResultIssueDescriptor, summary: RealDataResultSummary): void` 를 `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` 에 신설. body 가 입력 summary 로부터 재유도한 single-source 산출과 정확한 3블록 구조로 byte-identical 합성됐는지 검증하는 **순수 가드**.
- [ ] **검증 불변식 (single source — JSDoc 명시)**: ① `descriptor.body` 가 string. ② `body.split("\n")` 가 정확히 (marker 라인 → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown 블록) 구조 — 첫 라인 = `descriptor.marker`, marker 직후 빈 줄 1개, 그다음 라인이 `formatRealDataResultSummaryLine(summary)` 산출과 byte-identical, 그다음 빈 줄 1개, 나머지가 `renderRealDataResultSummaryMarkdown(summary)` 산출과 byte-identical. ③ 한 줄 요약 블록은 정확히 1회 등장 (중복·누락 0). markdown 블록은 다행 가능하므로 한 줄 요약 블록 다음 빈 줄 이후 전부를 markdown 기대값과 비교.
- [ ] **에러 정책 (구조 결손=TypeError / 형태 위반=RangeError)**: ① `descriptor`·`summary` null/undefined → 한국어 TypeError. ② `descriptor.body`·`descriptor.marker` 가 string 아님 → 한국어 TypeError. ③ body 의 한 줄 요약 블록이 formatter 산출과 불일치 → 한국어 RangeError (어느 블록이 어떻게 drift 했는지 명시). ④ body 첫 라인이 marker 와 불일치 / 구분 빈 줄 누락 / markdown 블록 drift → 한국어 RangeError. silent 통과 (위반인데 정상 반환) 0.
- [ ] **single-source 재유도 비교** — 한 줄 요약 기대값은 `formatRealDataResultSummaryLine(summary)` 호출로, markdown 기대값은 `renderRealDataResultSummaryMarkdown(summary)` 호출로 재유도해 body 의 해당 블록과 비교. 기대 문자열 hard-code 0 (descriptor 합성 로직과 동일 single-source 사용 — drift 0).
- [ ] **순수성·무공유·R-59 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — body 의 count·volume·분포·markdown 카운트만 비교, narrative/raw 본문 미접촉). 입력 `descriptor`·`summary` 읽기·비교만 (mutate 0). 동일 입력 → 동일 동작 (정상 descriptor 면 항상 void 반환, 손상 descriptor 면 항상 동일 위치 throw). 외부 validation 라이브러리 (zod/ajv) 도입 0.
- [ ] **Happy-path test 1+**: 정상 summary (difficulty/contribution 섞임, totalVolume>0) 로 `buildRealDataResultIssueDescriptor` 가 산출한 descriptor → `assertRealDataResultIssueDescriptorBodyConsistent` 가 void 반환 (throw 0). count=0 빈 summary descriptor 도 정상 통과. 1+.
- [ ] **Error path test 각 1+**: ① `descriptor` null → TypeError ② `summary` null → TypeError ③ `descriptor.body` 가 string 아님 (예: undefined) → TypeError ④ `descriptor.marker` 가 string 아님 → TypeError. 각 1+ (필드별·결손별 분기).
- [ ] **Flow/branch test**: ① 정상 descriptor → void 분기 ② body 첫 라인이 marker 와 불일치하도록 손상한 descriptor → RangeError 분기 ③ body 의 한 줄 요약 블록을 formatter 산출과 다르게 손상한 descriptor → RangeError 분기 ④ body 의 markdown 블록을 renderer 산출과 다르게 손상한 descriptor → RangeError 분기 ⑤ 구분 빈 줄을 제거해 블록 구조를 깨뜨린 descriptor → RangeError 분기 — 각 1+ test 로 분기 격리. (손상 descriptor 는 정상 descriptor 를 spread 후 body 만 수정한 fixture 로 생성.)
- [ ] **Negative cases 충분 cover (각 1+)**: ① **재유도 일치** — 정상 descriptor 의 body 한 줄 요약 블록이 `formatRealDataResultSummaryLine(summary)` 산출과, markdown 블록이 `renderRealDataResultSummaryMarkdown(summary)` 산출과 byte-identical 임을 가드가 통과시킴 검증. ② **한 줄 요약 중복 손상** — body 에 한 줄 요약을 2회 끼운 손상 descriptor → RangeError. ③ **한 줄 요약 누락 손상** — body 에서 한 줄 요약 블록을 뺀 손상 descriptor → RangeError. ④ **입력 비변형** — 가드 호출 후 `descriptor`·`summary`·`byDifficulty`·`byContribution` 객체 변경 0 assert. ⑤ **결정성** — 동일 (descriptor, summary) 2회 호출 → 둘 다 동일 동작 (정상이면 둘 다 void, 손상이면 둘 다 동일 throw). ⑥ **R-59** — 가드가 raw narrative 키/본문을 읽지 않음 (body·summary 모두 카운트·분포·markdown 만 비교). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — 신규 spec 은 `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.spec.ts` (colocated). 기존 `realdata-e2e-result-issue-descriptor.spec.ts` 의 fixture 빌더 관례 동형 (슬롯별 카운트로 결정론적 summary 생성).
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 파일 line/branch/function/statement 커버 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueDescriptorBodyConsistent` 를 `buildRealDataResultIssueDescriptor` 산출 직전에 self-wire (호출 배선) — 본 task 는 순수 가드 helper + spec 만. self-wire 는 별도 follow-up (T-0644 formatter self-guard 의 descriptor-side mirror).
- `buildRealDataResultIssueDescriptor` (T-0582/T-0645) · `formatRealDataResultSummaryLine` (T-0642/T-0644) · `renderRealDataResultSummaryMarkdown` (T-0581) 본문·출력 형태 변경 — 본 task 는 import·재유도 비교만 (전부 본문 변경 0).
- 자동 복구·정규화·기본값 채움·silent 수선·body 재합성 — 손상 body 검출 시 fail-fast throw 만 (본 task 는 검증만, 손상 descriptor 수선 0).
- `title`·`marker` 자체 구조 검증 — 본 가드는 body 3블록 구조에 한정 (marker 는 body 첫 라인과의 일치만 비교, marker 합성 규칙 자체 재검증 아님). title 검증은 별도 slice.
- JSON schema / 외부 validation 라이브러리 (zod/ajv) 도입 — 순수 string split·비교만.
- 실 gh issue 호출 · `gh issue create`/`comment` · daily-test step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (outcome-consistency / report / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 descriptor body 가드 helper 신설만 (summary-batch-outcome-consistency.ts 는 mirror 참조만, import 0).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 한 줄 요약이 정의·형태검증·self-guard·caller-surface 실배선·body 구조 무결성 런타임 강제까지 닿으므로, 자연 후속은 ① 가드를 `buildRealDataResultIssueDescriptor` 산출 직전에 self-wire (T-0644 formatter self-guard 의 descriptor-side mirror) ② gh issue 실배선 (LAN/credential gate deferred) — 모두 realdata-e2e-result-summary-line stream 의 연속 slice 로 이어진다.)
