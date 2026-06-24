---
id: T-0645
title: 실 평가 e2e 결과 이슈 descriptor body 에 한 줄 요약 formatRealDataResultSummaryLine 배선 (marker 다음 leading 라인)
phase: P5
status: DONE
completedAt: 2026-06-24T20:24:00Z
prNumber: 559
mergeCommit: a14c88f122f1923dd5b9b00f02798382fcaedd82
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — realdata-e2e-result-summary-line stream 완결(T-0642 formatter→T-0643 가드→T-0644 self-wire) 후 caller-surface 배선 첫 slice. summary-batch outcome-line→report 합성 mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.ts
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
---

# T-0645 — 실 평가 e2e 결과 이슈 descriptor body 에 한 줄 요약 formatter 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 caller-surface 배선. realdata-e2e-result-summary-line stream 은 이제 3 slice 가 완결됐다:

- T-0642 (PR #556 squash a581a50): `formatRealDataResultSummaryLine(summary)` → 결정적 한국어 단일 라인 formatter. 산출 형태는 `${RESULT_LINE_PREFIX}count=N · volume=V · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s`.
- T-0643 (PR #557 squash a479f9a): `assertRealDataResultSummaryLineFormatShape(line)` → 그 라인의 형태 불변식 ①~⑥ fail-fast 가드.
- T-0644 (PR #558 squash 62c2da8): formatter 가 반환 직전에 자기 산출 라인을 가드로 self-assert (정의·검증 + self-guard 완결).

세 slice 의 Follow-ups 가 일관되게 가리키는 **자연 후속은 "가드/formatter 를 외부 산출처에 wiring 배선"** 이다 (T-0636 service-경계 mirror · T-0637 합본 formatter mirror 패턴). 현재 `buildRealDataResultIssueDescriptor(summary, run)` (T-0582) 의 `body` 는 `[marker, "", renderRealDataResultSummaryMarkdown(summary)]` 만 합성한다 — 다행 markdown 본문은 있으나 **사람이 한눈에 읽는 결정적 한 줄 요약이 이슈 본문 상단에 부재**하다. daily-test rolling 이슈를 사람이 스캔할 때 markdown 표를 펼치기 전 첫 줄에서 count·volume·분포를 즉시 파악할 한 줄이 없는 것이다.

본 task 는 그 한 줄 layer 를 이슈 descriptor body 의 leading 요약 라인으로 배선한다 — `body` 를 `[marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")` 형태로 합성해, marker 직후·markdown 본문 위에 사람-친화 한 줄을 박는다. 이는 summary-batch 측이 outcome 한 줄 (`result.summaryLine`) 을 합본 리포트 (`formatSummaryBatchReport` 2번째 라인) 로 **합성·재사용** 한 패턴의 정확한 realdata-e2e-side mirror 다 — 같은 "이미 검증된 한 줄 formatter 산출을 표현 surface (여기선 이슈 본문 상단) 로 가공 0 합성" 이고, 대상이 합본 리포트 라인이 아니라 이슈 body leading 라인이다. T-0644 self-guard 덕분에 `formatRealDataResultSummaryLine` 호출 자체가 형태 가드를 통과한 라인만 반환하므로, 별도 가드 직접 배선 없이 형태 안전이 이미 보장된다 (가드는 formatter 안에 박혀 있음 — service 가 formatter 에 위임하므로 별도 배선 불필요했던 T-0639 와 동형).

본 layer 가 닫히면 한 줄 요약이 정의·검증·self-guard·**caller-surface 실배선**까지 닿아, 자연 follow-up (이슈 title 에 한 줄 요약 일부 반영 또는 daily-test step_eval stdout 한 줄 진입점 실배선 — LAN/credential gate deferred) 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `buildRealDataResultIssueDescriptor(summary, run)` (L112~129). 본 task 는 L124~126 의 `body = [marker, "", renderRealDataResultSummaryMarkdown(summary)].join("\n")` 합성을, marker 직후·markdown 본문 위에 `formatRealDataResultSummaryLine(summary)` 한 줄을 끼운 `body = [marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")` 로 배선한다. import 블록 (L56~57) 에 `formatRealDataResultSummaryLine` import 1줄 추가. `RealDataResultIssueDescriptor` 인터페이스 (L79~83) JSDoc 의 body 설명에 "marker 라인 + 한 줄 요약 + markdown 본문" 으로 한 줄 보강. **`title`·`marker`·`runToken`·`assertNonBlank`·`ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX` 본문 변경 0** (한 줄 요약은 body 에만 추가, title/marker 는 run 식별 token 만 그대로). 기존 gitSha/dateToken 빈/공백 throw 가드 본문·한국어 메시지 보존.
- [test/helpers/realdata-e2e-result-summary-line.ts](../../test/helpers/realdata-e2e-result-summary-line.ts) — `formatRealDataResultSummaryLine(summary)` (T-0642·T-0644) — 본 task 가 이슈 body 에 합성할 한 줄 formatter. 반환 직전 self-guard (T-0644) 가 형태를 보장하므로 별도 가드 배선 불요. 본문 변경 0 (import·호출만).
- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — **참조만**: summary-batch 측이 이미 검증된 한 줄 (`result.summaryLine`) 을 합본 리포트로 가공 0 합성한 동형 패턴. 본 task 는 그 "검증된 한 줄을 표현 surface 로 합성" 패턴을 이슈 body leading 라인으로 mirror.
- [test/helpers/realdata-e2e-result-issue-descriptor.spec.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.spec.ts) — 기존 happy/error/branch/negative describe 블록 (L1~). 본 task 가 "body 에 한 줄 요약이 정확히 1 회·marker 와 markdown 본문 사이에 포함된다 / 한 줄 요약이 formatter 산출과 byte-identical / title·marker 회귀 0" 검증을 append 할 colocated spec.

## Acceptance Criteria

- [ ] `buildRealDataResultIssueDescriptor` 의 `body` 합성에 `formatRealDataResultSummaryLine(summary)` 한 줄을 marker 직후 (빈 줄 1개) · markdown 본문 위 (빈 줄 1개) 에 배선. 합성 순서: `[marker, "", <한 줄 요약>, "", <markdown 본문>].join("\n")`.
- [ ] **import 1줄 추가** — `formatRealDataResultSummaryLine` 를 `./realdata-e2e-result-summary-line` 에서 import. 다른 import·상수·`title`·`marker` 합성 로직 변경 0.
- [ ] **title·marker byte-identical 보존** — `title` (= `${ISSUE_TITLE_PREFIX} ${token}`) 과 `marker` (= `${ISSUE_MARKER_PREFIX} ${token} -->`) 는 본 task 전/후 완전히 동일 (한 줄 요약은 `body` 에만 추가). 기존 spec 의 title/marker 기대 문자열 회귀 0.
- [ ] **body 구조 검증** — 본 task 후 `body` 는 정확히 3 블록 (marker 라인 / 한 줄 요약 / markdown 본문) 이 빈 줄로 구분돼 합성. 한 줄 요약은 정확히 1 회 등장 (중복·누락 0), marker 라인 직후·markdown 본문 직전에 위치.
- [ ] **JSDoc 보강** — `RealDataResultIssueDescriptor.body` 설명을 "marker 라인 + 한 줄 요약 + markdown 본문" 으로 갱신. 기존 title/marker 기술 보존.
- [ ] **기존 식별자 guard 보존** — `assertNonBlank` (gitSha/dateToken 빈/공백 throw) 본문·한국어 메시지·동작 변경 0. guard 는 한 줄 요약 합성 전 단계라 동작 보존.
- [ ] **순수성·무공유·R-59 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — 한 줄 요약은 count·volume·분포 카운트만, narrative/raw 본문 미포함). 입력 `summary`/`run` 읽기만 (mutate 0). 매 호출 새 descriptor 객체 반환. 외부 validation/template/해시 라이브러리 도입 0.
- [ ] **Happy-path test 1+**: 정상 summary (difficulty/contribution 섞임, totalVolume>0) + 정상 run → body 에 한 줄 요약이 marker 와 markdown 본문 사이에 정확히 포함됨 검증. count=0 빈 summary 도 정상 body 합성. 1+.
- [ ] **Error path test 각 1+**: ① 빈/공백-only gitSha run → 기존 한국어 throw (한 줄 요약 합성 도달 전 guard) ② 빈/공백-only dateToken run → 기존 한국어 throw. 각 1+ (필드별·빈/공백별 분기).
- [ ] **Flow/branch test**: ① 정상 summary → 한 줄 요약 포함 body 합성 분기 1 ② 모든 슬롯 값 0 (count=0, volume=0, 슬롯 모두 0) summary → 정상 body 합성 분기 1 ③ 큰 수·다양한 분포 summary → 정상 body 합성 분기 1 ④ gitSha guard throw 분기 1 ⑤ dateToken guard throw 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **합성 일치** — body 의 한 줄 요약 부분이 `formatRealDataResultSummaryLine(summary)` 산출과 byte-identical (가공 0 합성 증명). ② 결정성 — 동일 (summary, run) 2회 호출 → 둘 다 동일 body (한 줄 요약 포함). ③ 입력 비변형 — 호출 후 summary·byDifficulty·byContribution·run 객체 변경 0 assert. ④ marker·title 회귀 0 — 한 줄 요약 추가가 marker/title byte 를 바꾸지 않음 assert. ⑤ body 라인 구조 — `body.split("\n")` 의 첫 라인 = marker, 한 줄 요약이 정확히 1 회 등장, markdown 본문이 한 줄 요약 뒤에 위치 assert. ⑥ R-59 — body 가 raw narrative 키/본문을 담지 않음 (한 줄 요약·markdown 모두 카운트·분포만). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 파일 line/branch/function/statement 커버 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- 한 줄 요약을 이슈 `title` 또는 `marker` 에 반영 — 본 task 는 `body` leading 라인 배선만. title/marker 는 run 식별 token 만 그대로 (byte-identical). title 에 요약 일부 반영은 별도 follow-up.
- `formatRealDataResultSummaryLine` (T-0642/T-0644) 본문·출력 형태·self-guard 변경 — 본 task 는 import·호출만 (formatter 본문 변경 0).
- `renderRealDataResultSummaryMarkdown` (T-0581) 본문·markdown 형태 변경 — 본 task 는 markdown 위에 한 줄을 끼우는 body 합성만.
- `assertRealDataResultSummaryLineFormatShape` 가드를 issue-descriptor 안에서 직접 호출 — 불요 (formatter self-guard 가 이미 형태 보장, T-0644). 이중 단언 회피 (T-0639 service 미배선과 동형).
- `buildRealDataResultReportPlan` (T-0593) · `realdata-e2e-result-issue-command-args` (gh args) 본문 변경 — 본 task 는 issue-descriptor body 1 지점 배선만.
- 실 gh issue 호출 · `gh issue create`/`comment` · daily-test step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·재렌더·drop — 형태 위반 시 formatter self-guard 의 fail-fast throw 전파만 (본 task 는 합성만, 손상 라인 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (plan / outcome / report / 합성 진입점) 본문·가드 변경 — 본 task 는 realdata-e2e 측 이슈 body 한 줄 배선만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 realdata-e2e 결과 한 줄 요약이 정의·검증·self-guard·이슈 body caller-surface 배선까지 닿으므로, 자연 후속은 ① 이슈 title 에 한 줄 요약 일부 반영 (count·volume 같은 핵심 토큰) ② daily-test rolling 이슈 step ④ 실배선 (LAN/credential gate deferred) — 모두 realdata-e2e-result-summary-line stream 의 연속 slice 로 이어진다.)
