---
id: T-0722
title: realdata-e2e result-issue-search-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-27
independentStream: realdata-e2e-result-issue-search-parse-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-parse.ts
  - test/helpers/realdata-e2e-result-issue-search-parse.spec.ts
  - test/helpers/realdata-e2e-result-issue-search-parse-consistency.spec.ts
plannerNote: "P5 consistency sweep — T-0721 가드 짝 닫기. parseRealDataResultIssueSearchOutput 단일 return 직전 assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout) self-assert(hits·stdout 둘 다 return site 가용). 가드가 type-only import 라 순환 0·top-level import T-0720/T-0718 mirror. dependsOn [] 독립"
---

# T-0722 — realdata-e2e result-issue-search-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 이슈 표현 surface 의 build-time consistency-guard sweep 짝 닫기 task 다. 직전 T-0721(PR #637, squash 70b6f1f0)이 NO-GUARD-value leaf 컴포저 `parseRealDataResultIssueSearchOutput`(`test/helpers/realdata-e2e-result-issue-search-parse.ts`, T-0587)의 **값-정합 가드** `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)`(stdout 만으로 expected 를 컴포저 재호출 없이 독립 재유도해 deep-equal 대조, 개수·순서·필드값·추가필드 drop 값 drift fail-fast)를 신설했다. 그러나 컴포저 자신의 단일 return 사이트는 아직 **per-hit 키 집합 set-equality 가드**(`assertRealDataResultIssueSearchHitMatchesParseShape`, T-0659/T-0660)만 self-wire 하고 있어, 본 신설 값-정합 가드는 spec 에서만 호출되고 컴포저 산출 배열에는 배선되지 않았다(origin/main 70b6f1f0 grep 0 부재 확인). set-equality 가드는 각 hit 의 키 집합만 보므로 number/title/body **값** drift·hit 누락/중복/재정렬을 놓친다 — 그 gap 을 본 self-wire 가 컴포저 산출 경로에서 build-time fail-fast 로 닫는다. seed-side 의 T-0719→T-0720, result-summary 의 T-0711→T-0712 self-wire mirror. REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 마저 닫는다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` 로 **두 인자**(산출 `hits` + raw `stdout`)를 받는다. 컴포저 `parseRealDataResultIssueSearchOutput(stdout)` 의 단일 return 사이트에서 `stdout` 은 파라미터로, `hits` 는 `parsed.map(...)` 산출로 **둘 다 가용**하므로 컴포저 단일 호출 안에서 self-wire 가능하다(T-0719 의 `assertRealDataE2eSeedDeterministic` 가 두 호출 산출을 받아 self-wire 불가였던 것과 달리, 본 가드는 한 호출 안의 hits+stdout 으로 배선됨). 현재 `return parsed.map(...)` 를 `const hits = parsed.map(...)` 로 묶고 반환 직전 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` self-assert 후 `return hits` 로 전환한다.

**순환 의존 없음(top-level import)**: 값-정합 가드 `realdata-e2e-result-issue-search-parse-consistency.ts` 는 `RealDataResultIssueSearchHit` 를 `import type` only 로만 가져오고 컴포저로부터 **value 를 import 하지 않는다**(T-0721 가드 본문 확인 — value import 0). 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0720/T-0718 type-only top-level import mirror — lazy require 불요). T-0712/T-0708 의 value-import 순환 회피 lazy require 패턴과 구조 차이.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — self-wire 대상 컴포저 `parseRealDataResultIssueSearchOutput(stdout): RealDataResultIssueSearchHit[]`. **단일 return 사이트**(`return parsed.map((element, index) => {...})`, 현 L124~156, map 콜백 마지막에 이미 per-hit `assertRealDataResultIssueSearchHitMatchesParseShape` self-wire 가 있음). self-wire 는 그 `return parsed.map(...)` 식을 `const hits = parsed.map(...)` 로 묶고, 반환 직전 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` self-assert 후 `return hits` 로 전환. 산출 배열의 값·shape·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단에 가드 top-level import 1 줄 추가. 기존 per-hit set-equality self-wire 는 **유지**(대체·삭제 금지 — per-hit shape 가드와 전체 값 가드 공존).
- `test/helpers/realdata-e2e-result-issue-search-parse-consistency.ts`(T-0721) — self-wire 할 가드. `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits: RealDataResultIssueSearchHit[], stdout: string): void`(L206, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError). `RealDataResultIssueSearchHit` 를 `import type` only 로 가져오고 컴포저 value import 0(순환 의존 0 근거).
- `test/helpers/realdata-e2e-seed-fixture.ts`(T-0720) + 그 spec — **직전 self-wire mirror**. type-only import 라 top-level import + 단일 return 직전 self-assert(`const seed = ...; assert(seed); return seed;`) 패턴(lazy require 불요)을 그대로 따른다.
- `test/helpers/realdata-e2e-result-issue-search-parse.spec.ts` — 기존 컴포저 spec(무회귀 대상 + self-wire describe 추가 위치). 본 task 의 self-wire 검증 test(jest.spyOn 1 회 호출·인자 순서 hits+stdout·throw 선전파·산출 byte-identical 무변경)를 본 colocated spec 에 describe 로 추가.

## Acceptance Criteria

`parseRealDataResultIssueSearchOutput` 단일 return 사이트 직전에 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 배열의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`realdata-e2e-result-issue-search-parse-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-result-issue-search-parse.ts` 상단에 `import { assertRealDataResultIssueSearchOutputConsistentWithStdout } from "./realdata-e2e-result-issue-search-parse-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `parseRealDataResultIssueSearchOutput` 의 `return parsed.map(...)` 식을 `const hits = parsed.map(...)` 로 묶고, 반환 직전 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout);` self-assert 후 `return hits;`. 산출 배열·각 원소 값·참조-무공유(매 호출 새 배열·새 객체) 무변경. 인자 순서 `(hits, stdout)` 준수(가드 시그니처와 동일).
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 hits·stdout 을 읽기·재유도·비교만). 기존 per-hit set-equality self-wire(`assertRealDataResultIssueSearchHitMatchesParseShape`)는 **유지**(대체·삭제 금지) — per-hit shape 가드와 전체 값 가드 둘 다 호출.
- [ ] 가드 본체(`realdata-e2e-result-issue-search-parse-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path test 1+**(`realdata-e2e-result-issue-search-parse.spec.ts` self-wire describe) — `parseRealDataResultIssueSearchOutput(stdout)` 가 정상 stdout(1~2 hit·`"[]"` 0건)에 대해 throw 0 으로 기존과 동일한 hits 배열을 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 hits + 원본 stdout 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 hits 와 동일 참조·둘째 인자가 입력 stdout 과 동일·인자 순서 `(hits, stdout)`.
- [ ] **Error path test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataResultIssueSearchOutputConsistentWithStdout` 가 RangeError(또는 TypeError)를 throw 하도록 강제하면 `parseRealDataResultIssueSearchOutput(stdout)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError(값 정합 위반) 분기·TypeError(구조 결손) 분기 각 1+(가드 throw 선전파 negative).
- [ ] **Flow / branch coverage** — 정상(void → return hits) 경로 1+ test. 컴포저는 `JSON.parse` 배열 guard·원소 객체 guard·number/title/body guard 분기를 이미 가지나 self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로를 cover. 기존 컴포저 분기(비배열 throw·원소 비객체 throw·number 비양정수 throw 등)는 self-wire 도달 전 단계라 기존 spec 무회귀로 cover(self-wire 가 그 분기 동작을 바꾸지 않음 확인).
- [ ] **Negative cases 충분 cover** — 가드 throw 선전파(RangeError·TypeError 각 1+) + 결정성: self-wire 후에도 동일 stdout 두 번 호출 산출이 deep-equal·참조-무공유 유지(매 호출 새 배열·새 객체) test 1+. spy 가 매 호출 1 회씩 호출됨(두 번 호출 시 2 회). 기존 컴포저 자체 throw 경로(비배열 stdout·원소 비객체·number 비양정수·title/body 비문자열)가 self-wire 도달 전에 throw 돼 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음).
- [ ] **§9 정합** — self-wire 호출이 raw 활동 본문·credential 을 에러 메시지/산출에 노출하지 않음(가드는 number·title/body 값·index·타입만 다룸 — T-0721 가드 본체 보장 그대로).
- [ ] (선택) `realdata-e2e-result-issue-search-parse-consistency.spec.ts` 에 self-wire 호출수/경로 동기가 필요하면 갱신(가드 본체 무변경 전제 — describe 문자열·호출 count assert 정도). 불필요하면 생략하고 touchesFiles 에서 빼도 무방.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), self-wire 후 컴포저 cov 100% 유지 목표.
- [ ] 전체 unit suite green(기존 result-issue-search-parse spec·consistency spec 무회귀).

## Out of Scope

- 가드 본체(`realdata-e2e-result-issue-search-parse-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `parseRealDataResultIssueSearchOutput` 의 파싱·검증 규약(`JSON.parse`·배열 guard·number/title/body guard·`{number,title,body}` 정규화) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- 기존 per-hit set-equality self-wire(`assertRealDataResultIssueSearchHitMatchesParseShape`, T-0659/T-0660) 제거/대체 금지(per-hit shape 가드와 전체 값 가드 공존).
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0720/T-0718 mirror). lazy require 는 value-import 가드(T-0712/T-0708)의 패턴이며 본 task 엔 부적합.
- 실 gh search 호출 / `execFile` / live wiring(step ④ credential gate).
- 다른 NO-GUARD leaf(`result-issue-output-parse`·`result-issue-outcome-parse-shape` 등) 가드 신설·self-wire 는 별도 task — 본 task 는 search-parse value-guard self-wire 단일.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0.
- 새 dependency 도입(zod 등 금지).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0720/T-0718 self-wire mirror 라 architect 불요).

## Follow-ups

- result-issue side stream 가드 사슬 진행도 점검 — search-parse(가드 T-0721 + self-wire 본 task)·result-issue-action·result-issue-descriptor-identity 짝 닫힘 확인 후, 잔여 NO-GUARD parse-shape 류 leaf(`result-issue-output-parse`·`result-issue-outcome-parse-shape` 등)의 값-정합 가드 적용 여부 case-by-case 판정 후 별도 task.
