---
id: T-0998
title: daily-step dual-leg run report issue search-argv 빌더에 sibling -consistency drift-guard 신설 (buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv 산출 argv 를 commandArgs.searchQuery single-source 로 round-trip 대조)
phase: P5
status: DONE
mergedAs: 1b408bac
prNumber: 892
reviewRounds: 1
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-search-argv
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — issue-gh-command-plan triad(T-0902/T-0994/T-0997) 완결 뒤 T-0997 Follow-ups 잔여 sibling 1순위(-issue-search-argv) consistency 짝 부재 봉합. 요약축 선례 T-0655(assertRealDataResultIssueSearchGhArgvPreservesCommandArgs) mirror. producer(T-0900) 무변경(self-wire 후속). pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0998 — daily-step dual-leg run report issue search-argv 빌더 sibling consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈의 `searchQuery` 를 실 `gh search issues --json number,title,body` 호출에 그대로 넘길 **인자-벡터(argv)** 로 합성하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts`, T-0900)에는 **sibling 관례인 `-consistency` drift-guard 짝이 없다**. issue-gh-command-plan 종단 컴포저는 방금 producer(T-0902)→consistency(T-0994)→self-wire(T-0997) 삼단이 완결됐고(PR #891 squash 42977fad), T-0997 Follow-ups 가 명시적으로 잔여 consistency-미봉 sibling 목록(`-issue-search-argv` / `-issue-outcome-parse-shape`)을 **다음 slice 1순위** 로 예고했다. 본 task 는 그 목록의 **1순위** `-issue-search-argv` 를 봉한다.

이 빌더는 `commandArgs.searchQuery` 를 입력받아 `["search", "issues", "--match", "body", searchQuery, "--json", REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS, "--limit", REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT]`(길이 9) argv 를 산출한다. 이 빌더는 `assertSearchQueryNonBlank` inline guard 만 보유하고, **산출 argv 가 commandArgs.searchQuery 를 argv 의 올바른 위치(index 4)로 정합 전파했는지, 고정 인자(`--match body` 위치·`--json` 필드 문자열·`--limit` 값·동사 prefix)가 drift 하지 않았는지 검증하는 독립 불변식 가드는 부재** 하다. 누군가 빌더 배선을 편집(예: searchQuery 값이 다른 위치로 새거나, `--match body` 위치가 어긋나거나, `--json` 필드가 `RealDataDailyStepDualLegRunReportIssueSearchHit` 멤버 집합과 어긋나거나, `--limit` 상수가 drift 하거나, `["search","issues"]` 동사 prefix 가 빠지거나, 잉여/누락 원소가 끼면)하면서 colocated spec 을 함께 고치지 않으면, 손상 argv 가 `execFile('gh', searchArgv)` live wiring 으로 새어 잘못된 gh 검색이 실행되고 분기 결정(T-0898 resolver)이 오염된다. 본 task 는 그 빈칸을 채운다.

본 task 는 요약축 선례 T-0655(`assertRealDataResultIssueSearchGhArgvPreservesCommandArgs`, `realdata-e2e-result-issue-search-argv-consistency.ts`)와 정확히 동형으로, 입력 `commandArgs` 를 single-source 로 삼아 argv 의 searchQuery 위치 round-trip(byte-identical) + 고정 인자 shape(동사 prefix·`--match body`·`--json` 필드·`--limit` 값·길이 9)를 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs` + colocated R-112 spec 을 신설한다. 가드는 **argv 합성 규칙을 재구현하지 않고 commandArgs.searchQuery + T-0900 named constant 만 single-source 로 비교**하므로(descriptor·resolver 재유도 0 — upstream 가드가 cover), 양방향 drift 상쇄 위험이 없다.

이는 T-0988(issue-descriptor)·T-0990(issue-command-args)·T-0992(issue-gh-argv)·T-0994(issue-gh-command-plan) consistency 신설 패턴의 search-argv-leg mirror 이자, 요약축(summary axis)의 T-0655 를 daily-step 축으로 옮긴 판이다. **producer(T-0900) 본문은 무변경** — self-wire(빌더 산출 직전 자가 호출)는 후속 slice(T-0654/T-0997 mirror)로 분리한다. 가드는 빌더(producer, T-0900)를 import 하지 않고(oracle 독립성 — commandArgs 타입 `import type` + T-0900 의 `--json`/`--limit` named constant 만 value import) argv·commandArgs 를 읽기·비교만 하므로, 이 가드가 나중에 producer 에 value import 로 배선돼도 런타임 순환 의존이 생기지 않는다(consistency → search-argv value 엣지는 상수만 — 함수 재호출 0). producer(T-0900)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` (T-0900) — 대조 대상 producer 빌더. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs): string[]`. 산출 argv = `["search","issues","--match","body",searchQuery,"--json",REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,"--limit",REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT]`(길이 9). export 된 named constant `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS`(`"number,title,body"`)·`REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT`(`"30"`)를 가드가 single-source 로 value import 한다. 빈/공백 searchQuery throw(`assertSearchQueryNonBlank`). **가드는 이 파일의 빌더 함수를 재호출하지 않는다** — commandArgs.searchQuery + 두 상수만 비교(양방향 drift 상쇄 방지).
- `test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts` (T-0655, 요약축 선례 — main 박제) — **신설 가드의 직접 형태 선례**. `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, commandArgs): void` 의 불변식 세트(S0 동사 prefix / S1 `--match body` / S2 searchQuery byte-identical round-trip at index 4 / S3 `--json` 필드 상수 / S4 `--limit` 값 상수 / S5 길이 9), 검사 순서(구조 → searchQuery 빈/공백 → 길이 → 동사 prefix → `--match body` → searchQuery → `--json` → `--limit`, fail-fast), 에러 정책(구조 결손 = TypeError / 값·의미 정합 위반 = RangeError, 기대 vs 실측 노출), oracle 독립성(빌더 함수 import 0 — 상수만 import), 한국어 JSDoc·책임 경계 주석 스타일을 그대로 daily-step 축으로 옮긴다. 이름·타입·import 경로만 daily-step 축으로 치환.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueCommandArgs`(`{ searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }`)를 `import type` 로 재사용. 가드는 `searchQuery` 만 본다(createArgs/updateArgs 는 무관 멤버로 무시). read-only.
- `test/helpers/realdata-e2e-result-issue-search-argv-consistency.spec.ts` (T-0655) — 신설 spec 의 배치 선례. happy/error/branch/negative case 구성·fixture 형태·mutant 목록(S0~S5 각 위반)을 그대로 daily-step 축 fixture 로 옮긴다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(argv: string[], commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): void` export. 입력 `commandArgs.searchQuery` + T-0900 named constant(`REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS` / `..._SEARCH_LIMIT`)를 single-source 로 삼아 argv 불변식 (S0) 동사 prefix `["search","issues"]`, (S1) argv[2]==='--match' & argv[3]==='body', (S2) argv[4]===commandArgs.searchQuery(byte-identical), (S3) argv[5]==='--json' & argv[6]===FIELDS 상수, (S4) argv[7]==='--limit' & argv[8]===LIMIT 상수, (S5) argv 길이 정확히 9 를 대조. **argv 합성 규칙 재구현 0(commandArgs.searchQuery + 상수만 비교)**. **빌더 producer(T-0900) 함수를 재호출하지 않는다**(양방향 drift 상쇄 방지 — 상수만 import). commandArgs 타입은 `import type` 재사용만.
- [ ] 에러 정책 — 구조 결손(argv null/undefined·비배열·원소 비-string; commandArgs null/undefined·searchQuery 비-string) = 한국어 `TypeError`. 값·의미 정합 위반(빈/공백 searchQuery, 그리고 S0~S5 모든 불변식 위반) = 한국어 `RangeError`(기대값 vs 실측값 노출, drift 위치 식별). silent 통과(위반인데 정상 void) 0, fail-fast(가장 먼저 위반한 지점에서 throw). 검사 순서 = 구조(argv → commandArgs) → searchQuery 빈/공백 → 길이(S5) → 동사 prefix(S0) → `--match body`(S1) → searchQuery(S2) → `--json`(S3) → `--limit`(S4).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: 정합 argv — producer(T-0900) `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 실제 호출로 얻은 argv 를 가드가 throw 0 으로 통과시킴을 assert 1+(oracle ↔ producer 합성 배선 일치 증명하는 round-trip case). searchQuery 다양성(일반 marker, 공백·특수문자 포함 인젝션 토큰 `"; rm -rf"`, 유니코드) 각각 정합 통과 1+.
  - **Error path**: 구조 결손 각 유형(argv null·비배열·원소 비-string, commandArgs null·searchQuery 비-string)이 각각 `TypeError` 를 던짐 1+.
  - **Flow/branch cover**: 검사 순서상 각 분기(길이·동사 prefix·`--match body`·searchQuery·`--json`·`--limit`)에 대해 정합 통과 + drift throw 를 분리 검증. 빈/공백 searchQuery(입력 의미 위반) → `RangeError` 도 별도 case.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: drift mutant 각각이 `RangeError` 를 던짐 — (a) 동사 prefix drift(S0: argv[0] 또는 argv[1] 변조), (b) `--match`/`body` 위치 drift(S1), (c) searchQuery 를 다른 위치로 새거나 argv[4] 변형(S2), (d) `--json` flag 또는 필드 상수 drift(S3), (e) `--limit` flag 또는 값 상수 drift(S4), (f) argv 길이 잉여/누락(S5: 원소 추가·삭제). 각 mutant 독립 case. 가드가 argv·commandArgs 입력을 mutate 하지 않음(비변형) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 argv·searchQuery 구조만 비교) assert.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts`(T-0900) 본문 수정 0 — 신설 가드는 별도 파일. producer self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer 빌더 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(T-0900) 산출 직전 가드 self-wire 배선 0 — 후속 slice(T-0654/T-0997 mirror). 본 task 는 consistency 가드 **신설**만.
- 빌더 T-0900 및 upstream helper(command-args T-0897 / resolver T-0898 / parse T-0901) 수정 0 — read-only(타입·상수 import 소비만). 각 helper 의 시그니처·throw 정책 불변.
- issue-gh-command-plan leg(T-0902/T-0994/T-0997) · issue-action leg(T-0898/T-0995/T-0996) · issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) 의 재수정 0 — 이미 삼단/짝 완결.
- 잔여 consistency-미봉 sibling(`-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- gh search response 의 실 JSON 파싱 / `JSON.parse(stdout)` / SearchHit[] 산출 정합 재현 0 — 본 가드는 search **argv**(입력측)만 검증, stdout 파싱은 별도 outcome-parse leg.
- `--repo owner/repo` 인자 / repo slug 정합 검증 0 — 빌더가 search 핵심 인자만 산출하고 repo 컨텍스트는 caller 책임(본 가드는 빌더가 실제 산출하는 argv 범위만).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드 신설 후 후속 slice: producer `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(T-0900) 산출 직전 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs` self-wire(T-0654/T-0997 mirror) — 배선으로 issue-search-argv sub-helper 도 producer→consistency→self-wire 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-outcome-parse-shape` consistency 신설(본 vein 내 마지막 삼단 미착수 sibling), 이후 self-wire.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
