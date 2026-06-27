---
id: T-0724
title: realdata-e2e result-issue-output-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-28
independentStream: realdata-e2e-result-issue-output-parse-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-output-parse.ts
  - test/helpers/realdata-e2e-result-issue-output-parse.spec.ts
  - test/helpers/realdata-e2e-result-issue-output-parse-consistency.spec.ts
plannerNote: "P5 consistency sweep — T-0723 가드 짝 닫기. parseRealDataResultIssueCreateEditOutput 단일 return 직전 assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout) self-assert(outcome·stdout 둘 다 return site 가용). 가드가 type-only import 라 순환 0·top-level import T-0722/T-0720 mirror. dependsOn [] 독립"
---

# T-0724 — realdata-e2e result-issue-output-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 이슈 표현 surface 의 build-time consistency-guard sweep 짝 닫기 task 다. 직전 T-0723(PR #639)이 NO-GUARD-value leaf 컴포저 `parseRealDataResultIssueCreateEditOutput`(`test/helpers/realdata-e2e-result-issue-output-parse.ts`, T-0589)의 **값-정합 가드** `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout)`(stdout 만으로 expected `{issueNumber, url}` 을 컴포저 재호출 없이 독립 재유도해 deep-equal 대조, issueNumber/url 값 drift·잘못된 매칭 URL 선택·추가필드 drop 값 drift fail-fast)를 신설했다. 그러나 컴포저 자신의 단일 return 사이트는 아직 **outcome 키 집합 set-equality 가드**(`assertRealDataResultIssueOutcomeMatchesParseShape`, T-0661/T-0662)만 self-wire 하고 있어, 본 신설 값-정합 가드는 spec 에서만 호출되고 컴포저 산출 객체에는 배선되지 않았다(origin/main grep 0 부재 확인). set-equality 가드는 outcome 의 키 집합만 보므로 issueNumber/url **값** drift·잘못된 첫 매칭 URL 선택·trim 누락을 놓친다 — 그 gap 을 본 self-wire 가 컴포저 산출 경로에서 build-time fail-fast 로 닫는다. search-parse 의 T-0721→T-0722 self-wire 의 정확한 post-execution mirror. REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 마저 닫는다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout)` 로 **두 인자**(산출 `outcome` + raw `stdout`)를 받는다. 컴포저 `parseRealDataResultIssueCreateEditOutput(stdout)` 의 단일 return 사이트(현 L139 `return outcome;`)에서 `stdout` 은 파라미터로, `outcome` 은 이미 `const outcome: RealDataResultIssueOutcome = {...}`(L126~129) 로 묶여 있어 **둘 다 가용**하므로 컴포저 단일 호출 안에서 self-wire 가능하다. 현 코드는 이미 `const outcome = {...}` → set-equality 가드 self-wire → `return outcome;` 구조라, 그 `return outcome;` 직전(set-equality 가드 호출 다음)에 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout);` 한 줄을 추가하면 된다(outcome 변수 재구성 불요 — T-0722 보다 더 단순).

**순환 의존 없음(top-level import)**: 값-정합 가드 `realdata-e2e-result-issue-output-parse-consistency.ts`(T-0723) 는 `RealDataResultIssueOutcome` 를 `import type` only 로만 가져오고 컴포저로부터 **value 를 import 하지 않는다**(L49 가드 본문 확인 — value import 0). 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0722/T-0720/T-0718 type-only top-level import mirror — lazy require 불요).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — self-wire 대상 컴포저 `parseRealDataResultIssueCreateEditOutput(stdout): RealDataResultIssueOutcome`. **단일 return 사이트**(L139 `return outcome;`, 직전 L134~137 에 이미 set-equality 가드 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` self-wire 가 있음). self-wire 는 그 set-equality 가드 호출 **다음**·`return outcome;` **직전**에 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout);` 한 줄을 추가. 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단(L60~63 set-equality 가드 import 인근)에 값-정합 가드 top-level import 1 줄 추가. 기존 set-equality self-wire 는 **유지**(대체·삭제 금지 — outcome shape 가드와 전체 값 가드 공존).
- `test/helpers/realdata-e2e-result-issue-output-parse-consistency.ts`(T-0723) — self-wire 할 가드. `assertRealDataResultIssueOutputConsistentWithStdout(outcome: RealDataResultIssueOutcome, stdout: string): void`(L163, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError). `RealDataResultIssueOutcome` 를 `import type` only 로 가져오고(L49) 컴포저 value import 0(순환 의존 0 근거).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts`(T-0722 self-wire 완료본) + 그 spec — **직전 sibling self-wire mirror**. type-only import 라 top-level import + 단일 return 직전 self-assert 패턴(lazy require 불요)을 그대로 따른다.
- `test/helpers/realdata-e2e-result-issue-output-parse.spec.ts` — 기존 컴포저 spec(무회귀 대상 + self-wire describe 추가 위치). 본 task 의 self-wire 검증 test(jest.spyOn 1 회 호출·인자 순서 outcome+stdout·throw 선전파·산출 byte-identical 무변경)를 본 colocated spec 에 describe 로 추가.
- `test/helpers/realdata-e2e-result-issue-output-parse-consistency.spec.ts` — 가드 본체 spec(무회귀 대상). self-wire 호출수/경로 동기가 필요하면만 갱신, 불필요하면 무변경.

## Acceptance Criteria

`parseRealDataResultIssueCreateEditOutput` 단일 return 사이트 직전(기존 set-equality 가드 호출 다음)에 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`realdata-e2e-result-issue-output-parse-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-result-issue-output-parse.ts` 상단에 `import { assertRealDataResultIssueOutputConsistentWithStdout } from "./realdata-e2e-result-issue-output-parse-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `parseRealDataResultIssueCreateEditOutput` 의 `return outcome;`(L139) 직전, 기존 `assertRealDataResultIssueOutcomeMatchesParseShape(...)` 호출 **다음**에 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout);` self-assert 추가. 산출 `outcome` 객체 값·참조-무공유(매 호출 새 객체) 무변경. 인자 순서 `(outcome, stdout)` 준수(가드 시그니처와 동일).
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 outcome·stdout 을 읽기·재유도·비교만). 기존 set-equality self-wire(`assertRealDataResultIssueOutcomeMatchesParseShape`)는 **유지**(대체·삭제 금지) — outcome shape 가드와 전체 값 가드 둘 다 호출.
- [ ] 가드 본체(`realdata-e2e-result-issue-output-parse-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path test 1+**(`realdata-e2e-result-issue-output-parse.spec.ts` self-wire describe) — `parseRealDataResultIssueCreateEditOutput(stdout)` 가 정상 stdout(단일 URL 라인·다중 줄 첫 매칭·trailing 개행/공백)에 대해 throw 0 으로 기존과 동일한 `{issueNumber, url}` 을 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 outcome + 원본 stdout 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 outcome 과 동일 참조·둘째 인자가 입력 stdout 과 동일·인자 순서 `(outcome, stdout)`.
- [ ] **Error path test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataResultIssueOutputConsistentWithStdout` 가 RangeError(또는 TypeError)를 throw 하도록 강제하면 `parseRealDataResultIssueCreateEditOutput(stdout)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError(값 정합 위반) 분기·TypeError(구조 결손) 분기 각 1+(가드 throw 선전파 negative).
- [ ] **Flow / branch coverage** — 정상(void → return outcome) 경로 1+ test. 컴포저는 URL 미발견 throw·number 비양정수 throw 분기를 이미 가지나 self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로를 cover. 기존 컴포저 분기(URL 미발견 throw·issue number 비양정수 throw)는 self-wire 도달 전 단계라 기존 spec 무회귀로 cover(self-wire 가 그 분기 동작을 바꾸지 않음 확인).
- [ ] **Negative cases 충분 cover** — 가드 throw 선전파(RangeError·TypeError 각 1+) + 결정성: self-wire 후에도 동일 stdout 두 번 호출 산출이 deep-equal·참조-무공유 유지(매 호출 새 객체) test 1+. spy 가 매 호출 1 회씩 호출됨(두 번 호출 시 2 회). 기존 컴포저 자체 throw 경로(URL 미발견 stdout·`/issues/0`·`/issues/abc`·`/pull/` 경로·비-github 호스트)가 self-wire 도달 전에 throw 돼 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음).
- [ ] **§9 정합** — self-wire 호출이 raw 활동 본문·credential 을 에러 메시지/산출에 노출하지 않음(가드는 issueNumber·url 값만 다룸 — T-0723 가드 본체 보장 그대로).
- [ ] (선택) `realdata-e2e-result-issue-output-parse-consistency.spec.ts` 에 self-wire 호출수/경로 동기가 필요하면 갱신(가드 본체 무변경 전제 — describe 문자열·호출 count assert 정도). 불필요하면 생략하고 touchesFiles 에서 빼도 무방.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), self-wire 후 컴포저 cov 100% 유지 목표.
- [ ] 전체 unit suite green(기존 result-issue-output-parse spec·consistency spec 무회귀).

## Out of Scope

- 가드 본체(`realdata-e2e-result-issue-output-parse-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `parseRealDataResultIssueCreateEditOutput` 의 파싱·검증 규약(`ISSUE_URL_PATTERN` 첫 매칭·`assertPositiveIssueNumber`·URL trim·`{issueNumber, url}` 정규화) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- 기존 set-equality self-wire(`assertRealDataResultIssueOutcomeMatchesParseShape`, T-0661/T-0662) 제거/대체 금지(outcome shape 가드와 전체 값 가드 공존).
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0722/T-0720/T-0718 mirror). lazy require 는 value-import 가드(T-0712/T-0708)의 패턴이며 본 task 엔 부적합.
- 실 gh issue create/edit 호출 / `execFile` / live wiring(step ④ credential gate).
- 다른 NO-GUARD leaf(`result-issue-outcome-parse-shape` 등) 가드 신설·self-wire 는 별도 task — 본 task 는 result-issue-output-parse value-guard self-wire 단일.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0.
- 새 dependency 도입(zod 등 금지).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0722/T-0720 self-wire mirror 라 architect 불요).

## Follow-ups

- result-issue side stream 가드 사슬 진행도 점검 — search-parse(T-0721+T-0722)·output-parse(가드 T-0723 + self-wire 본 task) 짝 닫힘 확인 후, 잔여 NO-GUARD parse-shape 류 leaf(`result-issue-outcome-parse-shape` 등)의 값-정합 가드 적용 여부 case-by-case 판정 후 별도 task.
