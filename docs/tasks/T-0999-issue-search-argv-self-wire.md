---
id: T-0999
title: daily-step dual-leg run report issue search-argv 빌더 반환 직전 consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv 산출 argv 를 단일 반환 지점에서 즉시 자가 검증)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-search-argv
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts
plannerNote: "P5 §109 test-hardening — T-0998(PR #892 1b408bac) consistency 가드를 producer(T-0900) 단일 반환 지점 직전 self-wire(T-0997/T-0905 mirror). issue-search-argv leaf 삼단 완결. 드라이버 제안 outcome-parse-shape consistency 는 T-0904/T-0905/T-0906 로 이미 main 안착(중복 회피) → T-0998 Follow-up #1(1순위) search-argv self-wire 로 정정. T-0998 main 박제라 dep[]. test-only pr 2파일 file-disjoint stage5b 병렬."
---

# T-0999 — daily-step dual-leg run report issue search-argv 빌더 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈의 `searchQuery` 를 실 `gh search issues` 호출 argv 로 합성하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts`, T-0900)를 T-0998 이 독립 drift-guard `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs`(`...issue-search-argv-consistency.ts`, PR #892 squash 1b408bac 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 빌더에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 argv drift 를 잡는다. 누군가 빌더 배선을 편집(예: searchQuery 값이 다른 위치로 새거나, `--match body` 위치가 어긋나거나, `--json` 필드가 drift 하거나, `--limit` 상수가 drift 하거나, `["search","issues"]` 동사 prefix 가 빠지거나, 잉여/누락 원소가 끼면)하면서 colocated spec 을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 손상 argv 가 step ④ live wiring(`execFile('gh', searchArgv)`)으로 조용히 새어 잘못된 gh 검색이 실행되고 분기 결정(T-0898 resolver)이 오염된다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 가 argv 를 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` 를 스스로 호출해 산출 즉시 자가 검증하도록 한다. 이렇게 하면 합성 로직과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live wiring)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 issue 파이프라인 leaf 별 producer→consistency→self-wire 삼단 패턴의 issue-search-argv leaf mirror 이자, T-0998 Follow-up #1(명시적 "다음 slice 1순위")이 예고한 후속 slice 다. 이 배선으로 issue-search-argv sub-helper 도 producer(T-0900)→consistency(T-0998)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void — 가드가 commandArgs.searchQuery + T-0900 named constant 만 single-source 로 대조)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. 요약축 선례 `realdata-e2e-result-issue-search-argv.ts`(자체 self-wire 완료본)와 daily-step 축 선례 T-0905(outcome-parse-shape self-wire)·T-0997(gh-command-plan self-wire, 단일 return 지점 배선)의 정확한 mirror 다.

**주의 — 빌더는 반환 지점이 1곳이다**: 현재 `return [ "search", "issues", ... ];`(129~139행) 단일 지점. 그 argv 배열을 `const searchArgv = [ ... ];` 로 묶고 self-assert 후 `return searchArgv;` 하면 된다. `assertSearchQueryNonBlank` inline guard(96~102행)는 그대로 두고, 가드 self-assert 만 반환 직전에 추가한다.

**드라이버 제안 정정 근거(issue-still-relevant 확인)**: 본 fire 를 깨운 드라이버는 다음 후보로 `-issue-outcome-parse-shape` consistency 를 제안했으나, planner 의 issue-still-relevant pre-check 결과 그 sibling 은 이미 main 에 완결돼 있다 — outcome-parse-shape shape 가드(T-0904, self-wire T-0905) + output-parse **value**-consistency 가드(`...issue-output-parse-consistency.ts`, T-0906, 요약축 T-0723 mirror) 가 모두 박제됨. 즉 daily-step issue vein 의 모든 leaf(action·command-args·descriptor·gh-argv·gh-command-plan·outcome-parse-shape·output-parse·search-argv·search-parse)가 이미 각자의 consistency 가드를 보유해 신규 consistency 가드는 중복이 된다. vein 의 genuine 잔여는 **self-wire**뿐이고, 그중 top-priority(T-0998 Follow-up #1)가 본 search-argv self-wire 다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` (T-0900) — self-wire 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs): string[]`. **단일 반환 지점**: 129~139행 `return [ "search","issues","--match","body",searchQuery,"--json",FIELDS,"--limit",LIMIT ];`. 그 직전에 `const searchArgv: string[] = [ ... ];` 로 묶고 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` 호출 후 `return searchArgv;`. argv 합성 로직 재정의 0 — 기존 배열 리터럴 그대로 두고 return 직전 self-assert 만 추가. `assertSearchQueryNonBlank`(96~102행)는 변경 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.ts` (T-0998, main 박제 1b408bac) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(argv: string[], commandArgs): void` — 정합이면 void, 구조 결손(argv null/undefined·비배열·원소 비-string; commandArgs null/undefined·searchQuery 비-string) = TypeError / S0~S5 불변식(동사 prefix·`--match body`·searchQuery byte-identical at index 4·`--json` 필드 상수·`--limit` 값 상수·길이 9) 위반 = RangeError. 이 파일은 producer 를 import 하지 않고(oracle 독립성 — commandArgs 타입 `import type` + T-0900 named constant 만 value import) argv·commandArgs 를 읽기·비교만 한다. 빌더가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → search-argv value 엣지는 상수만 — 함수 재호출 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` (T-0900) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다(기존 case 회귀 없이).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` (T-0997 self-wire 완료본, PR #891 42977fad main 박제) — 반환 직전 self-wire 배선의 직접 선례(산출을 `const` 로 묶기 + self-assert + spy 검증 spec 관례). 단일 return 지점 배선 형태·spy 검증 spec 관례를 그대로 search-argv 축으로 옮긴다.
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` (요약축 search-argv self-wire 완료본 — main 박제) — 요약축 정확한 mirror(`assertRealDataResultIssueSearchGhArgvPreservesCommandArgs` 를 빌더 반환 직전 self-wire). 이름·타입·import 경로만 daily-step 축으로 치환.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency` 에서 value import 하고, `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 의 **단일 반환 지점**(129~139행)에서 산출된 argv 를 `const searchArgv = [ ... ]` 로 묶은 뒤 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` 를 호출하고 그 searchArgv 를 반환한다. 정합이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). argv 합성 로직(배열 리터럴 원소·순서) 자체는 재정의 0 — 기존 그대로 두고 return 직전 self-assert 만 추가. `assertSearchQueryNonBlank` inline guard 변경 0.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 가 정합 argv 를 throw 0 으로 정상 반환함을 assert 1+ — searchQuery 다양성(일반 marker, 공백·특수문자 포함 인젝션 토큰 `"; rm -rf"`, 유니코드) 각각 정합 통과. 반환 argv 가 기존 기대(길이 9, `["search","issues","--match","body",searchQuery,"--json","number,title,body","--limit","30"]` deep-equal)와 유지 검증 1+.
  - **Error path**: 기존 방어 throw(빈/공백 searchQuery → `assertSearchQueryNonBlank` Error)가 self-wire 도입으로 가려지지 않음 — 여전히 빌더 호출이 Error 를 던짐 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs` 를 감싼 뒤, 빌더 호출에서 그 spy 가 `(반환된 searchArgv, commandArgs)` 인자로 정확히 호출됐음을 assert(배선 존재 증명 — self-wire 제거 시 이 test 가 fail = de-facto regression guard). 최소 1 case, searchQuery 다양성 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 빌더 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 가 동일 RangeError 를 전파, silent 삼킴 0), (b) 가드가 TypeError 를 throw 하도록 mock 시 동일 TypeError 전파, (c) self-wire 가 정상 산출을 mutate 하지 않음(반환 argv 가 여전히 기대와 deep-equal, 입력 commandArgs 객체·중첩 createArgs/updateArgs 미변형, 매 호출 새 argv 배열 무공유) assert 1+.
  - **§9 / §12 안전성**: fixture/argv/commandArgs/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 argv·searchQuery 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.ts`(T-0998) 본문 수정 0 — value import·호출만(가드 재정의 0). 불변식 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.ts`(T-0998) 본문 수정 0 — value import·호출만(가드 재정의 0). 불변식 규칙 재구현 0.
- upstream/downstream helper(command-args T-0897 / resolver T-0898 / create-edit argv T-0899 / output-parse T-0903) 수정 0 — read-only. argv 합성 규칙 재계산 0.
- issue-gh-command-plan leaf(T-0902/T-0994/T-0997) · issue-action leaf(T-0898/T-0995/T-0996) · issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) · outcome-parse-shape/output-parse leg(T-0904/T-0905/T-0906) 의 재수정 0 — 이미 삼단/짝 완결.
- 잔여 self-wire 미착수 sibling(output-parse-consistency T-0906 등)의 self-wire 신설 0 — 별도 순차 slice.
- gh search response 의 실 JSON 파싱 / `JSON.parse(stdout)` / SearchHit[] 산출 정합 재현 0 — 본 배선은 search **argv**(입력측)만, stdout 파싱은 별도 leg.
- `src/` production 코드 변경 0(타입·상수 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-search-argv sub-helper 도 producer(T-0900)→consistency(T-0998)→self-wire(본 task) 삼단 완결 — issue-gh-command-plan·issue-action·issue-gh-argv·issue-command-args·issue-descriptor sub-helper 와 동형.
- daily-report issue-박제 vein 잔여(self-wire 미착수 sibling 후보): output-parse value-consistency 가드(T-0906) 의 파서(T-0903) 산출 직전 self-wire(요약축 T-0724 mirror) — 배선으로 output-parse leg 도 삼단 완결. 이후 vein 은 요약축 대비 미미러 leaf(outcome-report family·search-hit-shape·search-json-fields·command-plan/publish-plan 등)로 확장 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
