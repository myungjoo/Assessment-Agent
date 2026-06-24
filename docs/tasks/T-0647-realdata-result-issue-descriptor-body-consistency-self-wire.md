---
id: T-0647
title: buildRealDataResultIssueDescriptor 산출 직전 assertRealDataResultIssueDescriptorBodyConsistent self-wire 배선 (T-0644 formatter self-guard 의 descriptor-side mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — T-0646 신설 body 구조 가드를 builder 가 descriptor 반환 직전 self-assert 배선. T-0644 formatter self-guard 의 descriptor-side mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.ts
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
---

# T-0647 — buildRealDataResultIssueDescriptor 산출 직전 body 구조 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 self-guard 배선 slice. realdata-e2e-result-summary-line stream 은 한 줄 요약을 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)했고, T-0646 (PR #560 squash 1723710) 이 그 body 3블록 구조 불변식을 런타임 강제하는 순수 가드 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 를 신설했다.

그러나 그 가드는 현재 **신설만 됐고 어디서도 호출되지 않는다** — `buildRealDataResultIssueDescriptor` 가 합성한 descriptor 의 body 구조 무결성을 보장하는 산출 경로에 가드가 배선돼 있지 않다. 따라서 builder 의 body 합성 로직이 미래에 회귀(블록 순서 뒤바뀜·구분 빈 줄 누락·한 줄 요약 중복/누락·markdown 가공 혼입)해도 builder 자체는 손상 descriptor 를 그대로 반환하고, 그 손상은 별도로 가드를 호출하는 caller 가 있을 때만 catch 된다.

본 task 는 그 빈칸을 채운다 — `buildRealDataResultIssueDescriptor` 가 `{ title, marker, body }` 를 반환하기 직전에 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 로 자기 산출 descriptor 의 body 구조 무결성을 self-assert 한다. 이는 T-0644 가 `formatRealDataResultSummaryLine` 반환 직전에 `assertRealDataResultSummaryLineFormatShape` 로 자기 산출 라인을 self-assert 한 패턴의 **정확한 descriptor-side mirror** 다 — 같은 "이미 신설된 순수 가드를 산출처 자신이 반환 직전 호출해 자기 산출을 fail-fast 검증" 이고, 대상이 한 줄 라인이 아니라 이슈 descriptor body 다. 정상 합성이면 가드는 void 반환하므로 builder 동작·반환값은 byte-identical 보존되고, 회귀가 생기면 builder 가 손상 descriptor 를 반환하기 전에 한국어 명세형 에러로 즉시 throw 한다.

본 self-wire 가 닫히면 한 줄 요약이 정의·형태검증·self-guard·caller-surface 실배선·body 구조 무결성 런타임 강제·**산출처 self-wire** 까지 닿아, 자연 follow-up (gh issue 실배선 — LAN/credential gate deferred) 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `buildRealDataResultIssueDescriptor(summary, run)` (L116~141). 본 task 는 L140 의 `return { title, marker, body };` 직전에 `assertRealDataResultIssueDescriptorBodyConsistent({ title, marker, body }, summary)` 한 줄을 배선한다. import 블록 (L56~58) 에 `assertRealDataResultIssueDescriptorBodyConsistent` import 1줄 추가. **`title`·`marker`·`runToken`·`assertNonBlank`·`ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX`·body 합성 로직 본문 변경 0** (가드는 합성 후 반환 직전에만 끼움). 기존 gitSha/dateToken 빈/공백 throw 가드 본문·한국어 메시지 보존.
- [test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts](../../test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts) — `assertRealDataResultIssueDescriptorBodyConsistent(descriptor: RealDataResultIssueDescriptor, summary: RealDataResultSummary): void` (T-0646, L131~). 본 task 가 builder 반환 직전 self-wire 할 순수 가드. 본문 변경 0 (import·호출만). **순환 import 주의**: 이 helper 는 `import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor"` (type-only) 만 의존 — type-only import 라 런타임 순환 없음. builder 가 이 helper 의 값(함수)을 import 해도 helper 는 builder 의 type 만 import 하므로 runtime cycle 0 (안전). 빌드 시 `pnpm build` 로 순환 부재 확인.
- [test/helpers/realdata-e2e-result-summary-line.ts](../../test/helpers/realdata-e2e-result-summary-line.ts) — `formatRealDataResultSummaryLine` (T-0642·T-0644) self-guard 패턴 **참조만**: formatter 가 반환 직전 자기 산출 라인을 `assertRealDataResultSummaryLineFormatShape` 로 self-assert 한 동형 mirror. 본 task 는 그 "산출처 자신이 반환 직전 신설 가드 호출" 패턴을 descriptor builder 측으로 mirror. 본문 변경 0.
- [test/helpers/realdata-e2e-result-issue-descriptor.spec.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.spec.ts) — 기존 happy/error/branch/negative describe 블록. 본 task 가 "정상 summary/run → builder 가 self-guard 통과해 void 없이 정상 descriptor 반환 / self-wire 후에도 title·marker·body byte-identical 회귀 0 / 가드가 builder 산출 경로에 실제 배선됐음" 검증을 append 할 colocated spec. (builder 가 항상 정상 body 를 합성하므로 self-guard 가 throw 하는 negative 는 builder 입력으로 직접 유발 불가 — 그 검증은 T-0646 의 helper-직접 spec 가 이미 cover; 본 spec 은 self-wire 가 builder 동작을 깨지 않음 + 가드가 실제 호출 경로에 배선됐음에 집중.)

## Acceptance Criteria

- [ ] `buildRealDataResultIssueDescriptor` 의 `return { title, marker, body };` 직전에 `assertRealDataResultIssueDescriptorBodyConsistent({ title, marker, body }, summary)` 호출을 배선 (산출 descriptor 의 body 구조 무결성을 반환 전 self-assert). 정상 합성이면 void 반환 → 동작·반환값 byte-identical 보존.
- [ ] **import 1줄 추가** — `assertRealDataResultIssueDescriptorBodyConsistent` 를 `./realdata-e2e-result-issue-descriptor-body-consistency` 에서 import. 다른 import·상수·`title`·`marker`·body 합성 로직 변경 0.
- [ ] **순환 import 부재 확인** — body-consistency helper 가 builder 의 type 만 (`import type`) 의존하므로 runtime cycle 0. `pnpm build` (tsc) 가 순환·타입 에러 없이 green.
- [ ] **title·marker·body byte-identical 보존** — self-wire 전/후 정상 입력에 대한 `title`·`marker`·`body` 산출 완전히 동일 (가드는 검증만, 합성 0 변경). 기존 spec 의 title/marker/body 기대 문자열 회귀 0.
- [ ] **기존 식별자 guard 보존** — `assertNonBlank` (gitSha/dateToken 빈/공백 throw) 본문·한국어 메시지·동작 변경 0. self-wire 는 body 합성·식별자 guard 이후 단계라 동작 보존.
- [ ] **순수성·무공유·R-59 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — 가드는 count·volume·분포·markdown 카운트만 비교, narrative/raw 미접촉). 입력 `summary`/`run` 읽기만 (mutate 0). 매 호출 새 descriptor 객체 반환. 외부 validation 라이브러리 도입 0.
- [ ] **Happy-path test 1+**: 정상 summary (difficulty/contribution 섞임, totalVolume>0) + 정상 run → builder 가 self-guard 통과해 정상 `{ title, marker, body }` 반환 (throw 0). count=0 빈 summary 도 정상 통과. 1+.
- [ ] **Error path test 각 1+**: ① 빈/공백-only gitSha run → 기존 한국어 throw (body 합성·self-guard 도달 전 식별자 guard) ② 빈/공백-only dateToken run → 기존 한국어 throw. 각 1+ (필드별·빈/공백별 분기 — self-wire 가 기존 식별자 guard 우선순위를 깨지 않음 검증).
- [ ] **Flow/branch test**: ① 정상 summary → self-guard 통과 → 정상 descriptor 반환 분기 1 ② 모든 슬롯 값 0 (count=0, volume=0) summary → 정상 descriptor 반환 분기 1 ③ 큰 수·다양한 분포 summary → 정상 descriptor 반환 분기 1 ④ gitSha guard throw 분기 1 ⑤ dateToken guard throw 분기 1 — 각 1+ test 로 분기 격리. (builder 는 항상 정상 body 합성 → self-guard throw 분기는 builder 입력으로 직접 유발 불가, 분기 없음 명시.)
- [ ] **Negative cases 충분 cover (각 1+)**: ① **self-wire 배선 검증** — 가드가 builder 산출 경로에 실제 배선됐음을 검증 (예: body-consistency helper 모듈의 export 를 `jest.spyOn` 으로 감시해 builder 호출 시 정확히 1회·`(descriptor, summary)` 인자로 호출됨 assert, 또는 동등한 배선 증명). ② **결정성** — 동일 (summary, run) 2회 호출 → 둘 다 동일 descriptor (self-wire 후에도 결정성 보존). ③ **입력 비변형** — 호출 후 summary·byDifficulty·byContribution·run 객체 변경 0 assert. ④ **byte-identical 회귀 0** — self-wire 추가가 title/marker/body byte 를 바꾸지 않음 assert (정상 입력). ⑤ **body 구조 보존** — `body.split("\n")` 의 첫 라인 = marker, 한 줄 요약이 정확히 1회 등장, markdown 본문이 한 줄 요약 뒤에 위치 (self-wire 가 통과시키는 정상 구조 재확인). ⑥ **R-59** — body 가 raw narrative 키/본문을 담지 않음. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — 검증은 기존 colocated `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` 에 append (builder 의 spec). 신규 spec 파일 신설 불요 (body-consistency helper 자체 spec 은 T-0646 이 이미 신설).
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 파일 line/branch/function/statement 커버 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueDescriptorBodyConsistent` (T-0646) 본문·검증 로직·에러 정책 변경 — 본 task 는 import·호출 배선만 (helper 본문 변경 0).
- `formatRealDataResultSummaryLine` (T-0642/T-0644) · `renderRealDataResultSummaryMarkdown` (T-0581) · body 합성 로직 (T-0645) 본문·출력 형태 변경 — 본 task 는 합성 후 반환 직전 가드 호출 1지점 배선만.
- 이중 단언 도입 — body 합성 안에 가드를 중복 호출하거나 formatter self-guard 와 겹치는 검증 추가 0. self-wire 는 builder 반환 직전 정확히 1회만.
- 한 줄 요약을 이슈 `title`·`marker` 에 반영 — 본 task 는 self-wire 배선만 (title/marker byte-identical 보존).
- 실 gh issue 호출 · `gh issue create`/`comment` · daily-test step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·body 재합성 — self-guard 가 위반 검출 시 fail-fast throw 전파만 (본 task 는 배선만, 손상 descriptor 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 builder self-wire 1지점 배선만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 한 줄 요약이 정의·형태검증·self-guard·caller-surface 실배선·body 구조 무결성 런타임 강제·산출처 self-wire 까지 닿으므로, 자연 후속은 gh issue 실배선 — `gh issue create`/`comment` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice 로 이어진다.)

## Result

- Status: DONE (2026-06-24T22:17Z, cron@aa-local-15-30032)
- PR #561 squash-merge → main `f1fbf86`. reviewer round1 APPROVE + 외부 PR comment, 4-게이트 PASS, CI green.
- IMPLEMENTER: `test/helpers/realdata-e2e-result-issue-descriptor.ts` +11/-2 — import 1줄 + 반환 직전 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 호출 1지점 배선. body 합성·식별자 guard 본문 변경 0. type-only import 라 runtime cycle 0.
- TESTER: colocated spec 에 "body-consistency self-guard self-wire 배선 (T-0647)" describe (13 it) append. spyOn 으로 가드 정확히 1회 호출 검증 + happy/error/branch/negative(결정성·비변형·byte-identical 회귀0·body구조·R-59) cover. 대상 helper 100%, 전역 test:cov line 99.95%/func 100%.
