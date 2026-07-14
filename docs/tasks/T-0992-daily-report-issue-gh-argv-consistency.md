---
id: T-0992
title: daily-step dual-leg run report issue gh argv 빌더에 sibling -consistency drift-guard 신설 (buildRealDataDailyStepDualLegRunReportIssueGhArgv 산출을 action+commandArgs single-source round-trip 대조)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-gh-argv
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — issue-command-args triad(T-0897/T-0990/T-0991) 완결 뒤 T-0991 Follow-ups 잔여 sibling 1순위(-issue-gh-argv) consistency 짝 부재 봉합. 요약축 선례 T-0653·daily-step T-0990/T-0988 consistency-신설 mirror. producer 무변경(self-wire 후속). pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0992 — daily-step dual-leg run report issue gh argv 빌더 sibling consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈 action(create/update) + 명령-args 를 실 `gh` 명령에 그대로 넘길 인자-벡터(argv, `string[]`)로 합성하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueGhArgv`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts`, T-0899)에는 **sibling 관례인 `-consistency` drift-guard 짝이 없다**. issue-command-args sub-helper 는 producer(T-0897)→consistency(T-0990)→self-wire(T-0991) 삼단이 완결됐고, T-0991 Follow-ups 가 명시적으로 잔여 consistency-미봉 sibling 목록(`-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`)을 예고했다. 본 task 는 그 목록의 **1순위** `-issue-gh-argv` 를 봉한다.

문제는 이 argv 빌더의 합성 규칙(create 분기 = `["issue", "create", "--title", title, "--body", body, ...("--label", <label>) 순서보존 전개]`, update 분기 = `["issue", "edit", String(issueNumber), "--title", title, "--body", body]`)이 오직 자기 colocated spec 이 그 조합을 커버할 때만 검증된다는 점이다. 누군가 규칙을 편집(예: `--title` 뒤 값과 body 뒤바꿈, label flag-pair 순서·개수 어긋남, create action 인데 `issue edit` argv 산출, issueNumber 문자열화 정합 파괴)하면서 spec 을 함께 고치지 않으면, 손상 argv 가 `execFile('gh', argv)` live wiring 으로 새어나가 잘못된 gh 명령이 실행될 수 있다. 본 task 는 요약축 선례 T-0653(`assertRealDataResultIssueGhArgvPreservesCommandArgs`, `realdata-e2e-result-issue-gh-argv-consistency.ts`)와 정확히 동형으로, action + commandArgs 를 single-source 로 삼아 argv 의 동사·title/body/labels 위치를 **독립 round-trip 재유도**해 실제 argv 와 byte-identical 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs` + colocated R-112 spec 을 신설한다.

이는 T-0984(collection-plan consistency 신설)·T-0986(daily-report markdown consistency 신설)·T-0988(issue-descriptor consistency 신설)·T-0990(issue-command-args consistency 신설) 패턴의 issue-gh-argv-leg mirror 이자, 요약축(summary axis)의 T-0653 을 daily-step 축으로 옮긴 판이다. **producer(T-0899) 본문은 무변경** — self-wire(빌더 반환 직전 자가 호출)는 후속 slice(T-0991 mirror)로 분리한다. 가드는 argv 빌더(T-0899)를 import 하지 않고(oracle 독립성 — 동사·title/body/labels 위치 불변식을 가드 안에 재현) action·command-args 타입만 `import type` 로 참조하므로, 이 가드가 나중에 producer 에 value import 로 배선돼도 런타임 순환 의존이 생기지 않는다(consistency → gh-argv value 엣지 0). producer(T-0899)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` (T-0899) — 대조 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs): string[]`. create 분기 = `["issue", "create", "--title", createArgs.title, "--body", createArgs.body, ...("--label", <label>) 순서보존 전개]`, update 분기 = `["issue", "edit", String(action.issueNumber), "--title", updateArgs.title, "--body", updateArgs.body]`. inline guard 는 `assertNonBlank`(title/body 빈-공백)·`assertPositiveIssueNumber`(update issueNumber 양의 정수)만 보유. **가드는 이 파일을 import 하지 않는다** — 위 argv 위치 규칙을 가드 안에 독립 재현한다.
- `test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts` (T-0653, 요약축 선례 — main 박제) — **신설 가드의 직접 형태 선례**. `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs): void` 의 불변식 집합(create C0~C3 동사/title/body/labels flag-pair, update U0~U4 동사/issueNumber/title/body/잉여원소 거부), 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError, 기대 vs 실측 노출), 검사 순서(구조 → 동사 분기 → 위치 정합, fail-fast), oracle 독립성(producer import 0, 규칙 재현), 한국어 JSDoc·책임 경계 주석 스타일을 그대로 daily-step 축으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0898) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueAction`(create/update 분기, update 시 issueNumber: number)를 `import type` 로 재사용(중복 정의 0). read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueCommandArgs`(`{ searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }`)를 `import type` 로 재사용. read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts` (T-0899) — producer 기존 spec. fixture(action + commandArgs) 구성 형태·happy/error/negative 배치 관례를 참고해 신설 consistency spec 을 작성한다(가드 spec 은 별도 colocated 파일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv, action, commandArgs, label?): void` export. action + commandArgs 를 single-source 로 argv 위치 불변식을 **독립 재유도**해 실제 `argv` 와 byte-identical 대조. create 분기(동사 `issue create`, argv[2]=`--title`+argv[3]=createArgs.title, argv[4]=`--body`+argv[5]=createArgs.body, argv[6..] = createArgs.labels 의 `("--label", <label>)` flag-pair 순서·개수·원소 정확 일치)·update 분기(동사 `issue edit`, argv[2]=String(issueNumber), argv[3]=`--title`+argv[4]=updateArgs.title, argv[5]=`--body`+argv[6]=updateArgs.body, 길이 정확히 7). **gh-argv helper(T-0899) 를 import 하지 않는다**(재호출 금지 — 양방향 drift 상쇄 방지). 타입은 `import type` 재사용만.
- [ ] 에러 정책 — 구조 결손(argv null/undefined·비배열·원소 비-string; action null/undefined·분기값 오류·update 시 issueNumber 비-number; commandArgs null/undefined·분기별 필수 하위 필드 비-string·createArgs.labels 비배열·원소 비-string) = 한국어 `TypeError`. 값 정합 위반(동사 분기 불일치, title/body 위치 drift, labels flag-pair 순서·개수·원소 불일치, issueNumber 문자열화 불일치, update argv 잉여 원소) = 한국어 `RangeError`(기대 vs 실측 노출, 선택 label 접두로 어느 위치 drift 인지 식별). silent 통과(위반인데 정상 반환) 0, fail-fast. 검사 순서 = 구조(action → argv → commandArgs) → 동사 분기 판정 → 위치 정합.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: 정합 action+commandArgs → producer 산출 argv 를 가드가 throw 0 으로 통과시킴을 assert 1+. producer(T-0899)를 실제 호출해 얻은 argv 를 가드에 넣어 정합 검증하는 round-trip case 1+ 포함(oracle ↔ producer 규칙 일치 증명). create 분기(labels 0개/1개/다수)·update 분기 각각.
  - **Error path**: 구조 결손 각 유형(argv null·비배열·원소 비-string, action null·분기값 오류, update issueNumber 비-number, commandArgs null, createArgs.labels 비배열) 이 각각 `TypeError` 를 던짐 1+.
  - **Flow/branch cover**: 재유도 분기(create C0~C3 · update U0~U4)마다 정합 통과 + drift throw 를 각 1+ 로 분리 검증. create/update 두 분기 모두 커버.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: drift mutant 각각이 `RangeError` 를 던짐 — (a) create action 인데 argv 동사가 `issue edit`(또는 반대), (b) argv[3](title 값)과 argv[5](body 값) 뒤바꿈, (c) label flag-pair 순서 뒤집기/개수 부족/초과/원소 변경 각각, (d) update issueNumber 문자열화 불일치, (e) update argv 잉여 원소 추가(길이≠7). 각 mutant 독립 case. 가드가 argv·action·commandArgs 입력을 mutate 하지 않음(비변형) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 argv·action·command-args 구조만 재유도) assert.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts`(T-0899) 본문 수정 0 — 신설 가드는 별도 파일. producer self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer `buildRealDataDailyStepDualLegRunReportIssueGhArgv`(T-0899) 반환 직전 가드 self-wire 배선 0 — 후속 slice(T-0991 mirror). 본 task 는 consistency 가드 **신설**만.
- issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) · daily-report markdown leg(T-0986/T-0987) · collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg 의 재수정 0 — 이미 삼단/짝 완결.
- 잔여 consistency-미봉 sibling(`-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- action 빌더(T-0898) · 명령-args 빌더(T-0897) · descriptor 빌더(T-0896) · 렌더러(T-0895) · 컴포저(T-0894) 수정 0 — read-only. title/body/labels/issueNumber 재계산 0(가드는 argv 위치 불변식만 재유도).
- `--repo owner/repo` 인자 / repo slug 정합 검증 0 — 빌더가 issue create/edit 핵심 인자만 산출하고 repo 컨텍스트는 caller 책임(본 가드는 빌더가 실제 산출하는 argv 범위만).
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드 신설 후 후속 slice: producer `buildRealDataDailyStepDualLegRunReportIssueGhArgv`(T-0899) 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs` self-wire(T-0991 mirror) — 배선으로 issue-gh-argv sub-helper 도 producer→consistency→self-wire 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
