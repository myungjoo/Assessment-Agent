---
id: T-0988
title: daily-step dual-leg run report issue-박제 descriptor 조립 consistency drift-guard 순수 helper + R-112 spec 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-descriptor
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — daily-report markdown 삼단 완결(T-0895/T-0986/T-0987) 후 issue-박제 sub-helper vein 로 이동. T-0987 Follow-ups 가 예고한 -issue-descriptor consistency 짝 부재 봉합(T-0984/T-0986 consistency 신설 mirror). producer 무변경, self-wire 는 후속 slice. test-only pr-mode 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0988 — daily-step dual-leg run report issue-박제 descriptor 조립 consistency drift-guard 순수 helper + R-112 spec 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 를 daily-test rolling-issue 박제용 `(title / marker / body)` descriptor 로 묶는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`, T-0896)는 이슈 식별 layer 다 — 결정론적 제목(prefix + `dateToken@gitSha` runToken), 멱등 marker(동일 run → 동일), body(marker 라인 + 빈 줄 + 마크다운 렌더 위임)를 합성한다.

문제는 이 빌더가 아직 **consistency drift-guard 짝이 없다**는 점이다. eval-chain 3 sub-leg(input·activity-map·collect-request), collection-plan leg, daily-report markdown leg 는 모두 `producer → consistency(독립 oracle 재유도 대조) → self-wire` 삼단이 완결됐지만(T-0976~T-0987), issue-박제 sub-helper vein(`-issue-descriptor` / `-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan`)은 `result-issue-*` 사촌과 달리 consistency 짝이 부재하다(T-0987 Follow-ups 가 명시적으로 예고). 누군가 제목 prefix·marker 규약·runToken 결합 순서·body 2블록 결합(marker → 빈 줄 → markdown) 규칙을 편집하면서 이를 검증하는 test 가 그 특정 조합을 커버하지 않으면, mislabel/비멱등 이슈 박제 descriptor 가 조용히 새어나갈 수 있다.

본 task 는 그 gap 을 **독립 oracle 재유도-대조 drift-guard** 로 메운다 — report 로부터 expected `{title, marker, body}` 를 producer 와 독립적으로 재유도해 producer 산출과 byte-identical(deep-equal) 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor, label?)` 를 신설한다. 이는 T-0984(collection-plan)·T-0986(daily-report markdown) consistency 신설 패턴의 issue-descriptor-leg mirror 다. **producer(T-0896) 는 이 task 에서 변경 0** — self-wire(producer 반환 직전 자가 호출)는 T-0985/T-0987 mirror 로 후속 slice 에서 별도 큐잉한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — 검증 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report): { title; marker; body }`. 조립 규칙: `ISSUE_TITLE_PREFIX = "실 평가 e2e daily-step dual-leg run report"`, `ISSUE_MARKER_PREFIX = "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue:"`, `runToken = ${dateToken}@${gitSha}`, title = `${PREFIX} ${token}`, marker = `${MARKER_PREFIX} ${token} -->`, body = `[marker, "", renderRealDataDailyStepDualLegRunReportMarkdown(report)].join("\n")`. gitSha/dateToken 빈-공백 시 `assertNonBlank` throw. **oracle 는 이 파일을 import 하지 않는다**(독립 재유도) — prefix 상수·규칙만 재현.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts` (T-0986, main 박제) — 미러할 consistency 패턴 참조. `assertRealDataDailyStepDualLegRunReportMarkdownConsistent(report, markdown, label?)`: 정합이면 void, 구조 결손 = TypeError / 값·문자열 drift = RangeError. describe/it 배치·에러 분류·oracle 독립성 관례를 그대로 따른다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` (T-0895) — body 재유도에 위임할 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown(report): string`(read-only). oracle 은 body 의 마크다운 블록을 이 렌더러로 재유도한다(마크다운 내부 규칙은 T-0986 domain — 본 oracle 은 issue-descriptor 조립 축(title/marker/body 결합)만 검증).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport` descriptor 타입 + status/overallStatus enum(spec fixture 입력 재사용, read-only).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` (T-0896) — 기존 producer spec. fixture 형태·happy/error 배치를 참조해 신규 spec 을 정합적으로 작성.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` 신설 — `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor, label?): void` export. report 로부터 expected `{title, marker, body}` 를 **producer 와 독립적으로 재유도**(issue-descriptor helper 를 import 하지 않고 prefix 상수·runToken·body 결합 규칙을 재현; body 의 마크다운 블록만 렌더러 T-0895 에 위임)한 뒤 producer 가 넘긴 `descriptor` 와 필드별 byte-identical 대조한다. 정합이면 void, descriptor 구조 결손(title/marker/body 필드 부재·비string) = TypeError, 값 drift(title prefix/token, marker prefix/token/`-->` 종결, body 의 marker 라인·빈 줄 구분·마크다운 블록 불일치) = RangeError. gitSha/dateToken 빈-공백 report 는 재유도 단계에서 producer 와 동형 Error 를 던진다(비식별 방지). §9: 에러 메시지·재유도 어디에도 실 secret/PAT 실 값 미노출.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts` 신설 — R-112 4종:
  - **Happy-path**: 실 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 산출을 가드에 넣으면 throw 0 으로 void 반환함을 assert 1+ — leg status 조합(예: eval=pass/collect=fail, eval=skip/collect=skip, all-pass) 다중 fixture 각각.
  - **Error path**: report 필드(gitSha/dateToken) 빈-공백 입력 시 재유도가 producer 와 동형 Error/TypeError 를 던짐을 각 1+ assert.
  - **Flow/branch cover**: 구조 결손 분기(descriptor 에서 title/marker/body 각 필드 제거 또는 비string 주입) → TypeError, 값 drift 분기(title/marker/body 각각을 미세 변형) → RangeError 를 분기마다 1+ assert. 동일 run 이면 leg status 가 달라도 title/marker 동일(멱등) 검증 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) title prefix 변조·runToken 결합 순서 뒤집기(`gitSha@dateToken`)·marker `-->` 종결 누락·body 2블록 구분 빈 줄 제거·marker 라인 위치 이동 등 각 mutant 를 개별 drift 로 감지(RangeError) assert, (b) 가드가 정합 검증 시 입력 report/descriptor 를 mutate 하지 않음(재유도가 부작용 0) assert 1+, (c) §9 fixture 는 전부 비시크릿 더미 string, raw 활동 본문 파일/전역 저장 0 assert.
- [ ] producer(`...-issue-descriptor.ts`, T-0896)·렌더러(T-0895)·컴포저(T-0894) 본문 수정 0 — oracle 은 read-only import(렌더러만 value import, issue-descriptor 는 import 0)·규칙 재현. 재계산 로직 재구현은 oracle 자체 domain(issue-descriptor 조립 축)에 한정, 마크다운 내부 규칙 재구현 0(T-0895 위임).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896) 반환 직전 self-wire 배선 0 — consistency 신설만. self-wire 는 T-0985/T-0987 mirror 로 후속 slice 별도 큐잉.
- 렌더러(T-0895)·컴포저(T-0894) 수정 0 — read-only. 마크다운 내부 규칙 재유도/재구현 0(T-0986 이 이미 봉함, 본 oracle 은 렌더러에 위임).
- 잔여 issue-박제 sub-helper(`-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`) 의 consistency 신설 0 — 순차 mirror 후보(별도 큐잉).
- eval-chain 3 sub-leg · collection-plan · daily-report markdown leg 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 `deploy/daily-test.sh` step ④ 실 이슈 박제 / gh issue 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(해시/템플릿 라이브러리 포함) 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 consistency 신설로 issue-descriptor sub-helper 도 producer(T-0896)→consistency(본 task) 2단 확보 — 다음 slice 는 producer 반환 직전 self-wire(T-0985/T-0987 mirror)로 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling): `-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape` — `result-issue-*` 사촌과 달리 consistency 짝 부재, 순차 mirror 후보(별도 큐잉).
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1회(운영/env 층), (2) `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
