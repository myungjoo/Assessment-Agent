---
id: T-0990
title: daily-step dual-leg run report issue 명령-args 빌더에 sibling -consistency drift-guard 신설 (buildRealDataDailyStepDualLegRunReportIssueCommandArgs 산출을 독립 oracle 재유도 대조)
phase: P5
status: DONE
completedAt: 2026-07-14T10:24:09Z
mergedAs: 58d0f347
prNumber: 884
reviewRounds: 2
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-command-args
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — issue-descriptor triad(T-0896/T-0988/T-0989) 완결 뒤 T-0989 Follow-ups 잔여 sibling 1순위(-issue-command-args) consistency 짝 부재 봉합. T-0988/T-0984 consistency-신설 mirror. producer 무변경(self-wire 후속). pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0990 — daily-step dual-leg run report issue 명령-args 빌더 sibling consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report descriptor `{ title, marker, body }` 를 gh issue 멱등 search-or-update 명령-args 묶음으로 변환하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts`, T-0897)에는 **sibling 관례인 `-consistency` drift-guard 짝이 없다**. issue-descriptor sub-helper 는 producer(T-0896)→consistency(T-0988)→self-wire(T-0989) 삼단이 완결됐고, T-0989 Follow-ups 가 명시적으로 잔여 consistency-미봉 sibling 목록(`-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`)을 예고했다. 본 task 는 그 목록의 **1순위** `-issue-command-args` 를 봉한다.

문제는 이 명령-args 빌더의 조립 규칙(searchQuery=descriptor.marker 그대로 / createArgs={title, body, labels 결정론 상수 복제} / updateArgs={title, body} / create·update 양쪽 body 에 descriptor.body 그대로 전달해 marker 라인 보존 = 멱등성)이 오직 자기 colocated spec 이 그 조합을 커버할 때만 검증된다는 점이다. 누군가 규칙을 편집(예: searchQuery 를 marker 아닌 title 로 바꾸기, createArgs.body 와 updateArgs.body 를 서로 다르게 만들어 멱등성 파괴, labels 상수 집합 변경·복제 누락으로 무공유 파괴, title/body 필드 pass-through 를 왜곡)하면서 spec 을 함께 고치지 않으면, mislabel/비멱등 명령-args 가 조용히 새어나갈 수 있다. 본 task 는 T-0988 이 issue-descriptor 에 한 것과 정확히 동형으로, descriptor 로부터 expected 명령-args 를 **독립 oracle 로 재유도**해 producer 산출과 필드별 deep-equal(byte-identical) 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent` + colocated R-112 spec 을 신설한다.

이는 T-0984(collection-plan consistency 신설)·T-0986(daily-report markdown consistency 신설)·T-0988(issue-descriptor consistency 신설) 패턴의 issue-명령-args-leg mirror 다. **producer(T-0897) 본문은 무변경** — self-wire(빌더 반환 직전 자가 호출)는 후속 slice(T-0989 mirror)로 분리한다. 가드는 issue-command-args helper 를 import 하지 않고(oracle 독립성 — searchQuery/createArgs/updateArgs/labels 결합 규칙을 가드 안에 재현) descriptor·command-args 타입만 `import type` 로 참조하므로, 이 가드가 나중에 producer 에 value import 로 배선돼도 런타임 순환 의존이 생기지 않는다(consistency → command-args value 엣지 0). producer(T-0897)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — 대조 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor): { searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }`. 상단 `assertNonBlank` 2종(descriptor.title / descriptor.marker 빈-공백 throw) 후 searchQuery=descriptor.marker, createArgs={title: descriptor.title, body: descriptor.body, labels: `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 복제}, updateArgs={title: descriptor.title, body: descriptor.body} 합성. labels 상수 = `["realdata-e2e", "daily-step-dual-leg-run-report"]`. 매 호출 새 객체/새 배열(무공유). **가드는 이 파일을 import 하지 않는다** — 위 규칙(labels 상수 포함)을 가드 안에 독립 재현한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueDescriptor { title, marker, body }` 를 `import type` 로 재사용(중복 정의 0). read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` (T-0988, main 박제 bcf75de0) — **신설 가드의 형태 선례**. 에러 정책(구조 결손 = TypeError / 값 drift = RangeError), 선택 label 접두, oracle 독립성(producer import 0, 규칙 재현), 한국어 에러 메시지(기대 vs 실측 노출) 스타일을 그대로 따른다. 마크다운 위임 부분은 본 task 와 무관(command-args 는 body 를 pass-through 만 — 마크다운 재유도 불요).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` (T-0897) — producer 기존 spec. fixture descriptor 구성 형태·happy/error/negative 배치 관례를 참고해 신설 consistency spec 을 작성한다(가드 spec 은 별도 colocated 파일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(descriptor, commandArgs, label?): void` export. descriptor 로부터 expected 명령-args 를 **독립 재유도**(searchQuery=descriptor.marker / createArgs={title, body, labels 상수 복제} / updateArgs={title, body}; labels 상수 `["realdata-e2e", "daily-step-dual-leg-run-report"]` 를 가드 안에 재현) 후 실제 `commandArgs` 와 필드별 deep-equal(byte-identical, 공백·줄바꿈·대소문자·배열 순서 민감) 대조. 정합이면 void, drift 면 throw. **issue-command-args helper(T-0897) 를 import 하지 않는다**(재호출 금지 — 양방향 drift 상쇄 방지). 타입은 `import type` 재사용만.
- [ ] 에러 정책 — 구조 결손(commandArgs null/undefined·비객체, searchQuery/createArgs/updateArgs 필드 부재·비객체, createArgs.title/body 비string, createArgs.labels 비배열·요소 비string, updateArgs.title/body 비string) = 한국어 `TypeError`. 값 drift(searchQuery≠marker, createArgs/updateArgs 의 title/body 불일치, labels 요소·순서·개수 불일치) = 한국어 `RangeError`(기대 vs 실측 노출, 선택 label 접두로 어느 대조 지점인지 식별). descriptor.title/marker 빈-공백 = 재유도 단계에서 producer(T-0897)와 동형 `Error`(비식별 이슈 명령 방지). silent 통과 0, fail-fast.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: 정합 descriptor→producer 산출을 가드가 throw 0 으로 통과시킴을 assert 1+. producer(T-0897) 를 실제 호출해 얻은 command-args 를 가드에 넣어 정합 검증하는 round-trip case 1+ 포함(oracle ↔ producer 규칙 일치 증명). 서로 다른 descriptor fixture(title/marker/body 조합) 각각.
  - **Error path**: 구조 결손 각 유형(commandArgs null·비객체, searchQuery 부재, createArgs 부재·비객체, updateArgs 부재, createArgs.labels 비배열) 이 각각 `TypeError` 를 던짐 1+. descriptor.title/marker 빈-공백 입력이 `Error` 를 던짐 각 1+.
  - **Flow/branch cover**: 재유도 분기(searchQuery 대조·createArgs 3필드 대조·updateArgs 2필드 대조·labels 배열 대조)마다 정합 통과 + drift throw 를 각 1+ 로 분리 검증.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: drift mutant 각각이 `RangeError` 를 던짐 — (a) searchQuery 를 marker 아닌 값으로 왜곡, (b) createArgs.body ≠ updateArgs.body(멱등성 파괴), (c) createArgs.title/updateArgs.title 왜곡, (d) labels 상수 변경(요소 추가/삭제/문자열 변경/순서 뒤집기 각각), (e) labels 개수 불일치. 각 mutant 독립 case. 가드가 descriptor·commandArgs 입력을 mutate 하지 않음(비변형) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 descriptor·command-args 구조만 재유도) assert.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts`(T-0897) 본문 수정 0 — 신설 가드는 별도 파일. producer self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`(T-0897) 반환 직전 가드 self-wire 배선 0 — 후속 slice(T-0989 mirror). 본 task 는 consistency 가드 **신설**만.
- issue-descriptor leg(T-0896/T-0988/T-0989) · daily-report markdown leg(T-0986/T-0987) · collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg 의 재수정 0 — 이미 삼단 완결.
- 잔여 consistency-미봉 sibling(`-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- descriptor 빌더(T-0896) · 렌더러(T-0895) · 컴포저(T-0894) 수정 0 — read-only. 마크다운/title/marker/body 재계산 0(command-args 는 body pass-through 만이라 마크다운 재유도 자체가 불요).
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드 신설 후 후속 slice: producer `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`(T-0897) 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent` self-wire(T-0989 mirror) — 배선으로 issue-command-args sub-helper 도 producer→consistency→self-wire 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
