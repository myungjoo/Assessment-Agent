---
id: T-0720
title: realdata-e2e seed-fixture 결정성·불변식 정합 가드 컴포저 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-058, REQ-059, REQ-024]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 consistency sweep — T-0719 가드 짝 닫기. buildRealDataE2eSeed 단일 return 직전 assertRealDataE2eSeedConsistentWithUsernames self-assert(불변식만 self-wire — Deterministic 은 2-출력 인자라 spec 잔류). type-only import 라 순환 0, T-0714/T-0718 top-level import mirror. dependsOn [] 독립"
independentStream: realdata-e2e-seed-fixture-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-fixture.ts
  - test/helpers/realdata-e2e-seed-fixture.spec.ts
---

# T-0720 — realdata-e2e seed-fixture 결정성·불변식 정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ①(seed 입력 계약 surface) 의 build-time consistency-guard sweep 에서, 직전 T-0719(PR #635 squash 5ac01daf)가 seed-side leaf 컴포저 `buildRealDataE2eSeed()`(`test/helpers/realdata-e2e-seed-fixture.ts`, T-0573)의 결정성·username-파생 불변식 정합 가드 `assertRealDataE2eSeedConsistentWithUsernames` / `assertRealDataE2eSeedDeterministic` 를 신설했다. 그러나 가드는 **호출처가 없으면 휴면 상태** — 컴포저가 산출을 반환할 때 가드를 호출하지 않으면 합성 규칙 drift(email suffix·externalId≠username·isPrimary 누락·service 중복·primary 개수 위반·email 중복)가 build-time 에 자동으로 잡히지 않는다. 본 task 는 다른 seed-side leaf(seed-upsert T-0716·seed-resolve-person-id T-0718)가 가드 신설 직후 self-wire 짝으로 닫은 것과 동일하게, T-0719 가드의 짝을 닫는다(T-0714/T-0718 self-wire mirror).

**자기-self-wire 적용 범위 판정(case-by-case)**: T-0719 의 두 export 중 self-wire 가능한 것은 **`assertRealDataE2eSeedConsistentWithUsernames(seed)` 하나뿐**이다 — 단일 산출 `seed: RealDataSeedDescriptor[]` 만 인자로 받으므로 컴포저 단일 return 직전에 `assert(result)` 형태로 묶을 수 있다. 반면 `assertRealDataE2eSeedDeterministic(first, second)` 는 **두 호출 산출을 인자로 받는 형태**(T-0719 가 type-only import 유지·순환 회피 목적으로 분리한 설계)라 컴포저 단일 호출 안에서 self-wire 할 수 없다 — 결정성 검사는 spec 에서 컴포저를 두 번 호출해 두 산출을 넘기는 방식으로 그대로 잔류한다(self-wire 대상 아님). 따라서 본 task 의 self-wire 는 불변식 가드 1 개만 배선한다.

issue-still-relevant 확인(origin/main 5ac01daf grep): 컴포저 `realdata-e2e-seed-fixture.ts` 에 `assertRealDataE2eSeed` 호출·`consistency` import **grep 0 부재** 확인 — 본 self-wire 는 아직 main 에 박제되지 않았다. 가드 export(`assertRealDataE2eSeedConsistentWithUsernames` L205 / `assertRealDataE2eSeedDeterministic` L251)는 main 존재. 가드는 `RealDataSeedDescriptor` 를 **`import type` only(value import 0)** 로 가져오므로, 컴포저가 가드를 top-level `import` 해도 CommonJS 순환 의존이 발생하지 않는다(T-0714/T-0718 type-only top-level import mirror — lazy require 불요. T-0712/T-0716 의 value-import 순환 회피 lazy require 와 구조 차이).

REQ-058(재수집 중복 방지: distinct compound-unique key 정합) + REQ-059(seed 가 raw 활동 미보유: username 메타데이터만) + REQ-024(1 Person 당 정확히 1 primary identity invariant) 의 build-time fail-fast 게이트를 컴포저 산출 경로에 실제로 활성화한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-fixture.ts` — self-wire 대상 컴포저 `buildRealDataE2eSeed(): RealDataSeedDescriptor[]`. **단일 return 사이트**(`return REAL_DATA_GITHUB_USERNAMES.map((username) => ({...}))` 형태, 약 L96). self-wire 는 이 return 식을 `const seed = REAL_DATA_GITHUB_USERNAMES.map(...)` 로 묶고 반환 직전 `assertRealDataE2eSeedConsistentWithUsernames(seed)` self-assert 후 `return seed` 로 전환. 산출 shape·값·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단에 가드 top-level import 1 줄 추가.
- `test/helpers/realdata-e2e-seed-fixture-consistency.ts`(T-0719) — self-wire 할 가드. `assertRealDataE2eSeedConsistentWithUsernames(seed: RealDataSeedDescriptor[]): void`(L205, 정상 시 void / 구조 결손 TypeError / 불변식 위반 RangeError) 가 self-wire 대상. `assertRealDataE2eSeedDeterministic(first, second)`(L251)은 2-인자라 self-wire 대상 아님(spec 잔류). 가드가 `RealDataSeedDescriptor` 를 `import type` only 로 가져옴(순환 의존 0 근거).
- `test/helpers/realdata-e2e-seed-resolve-person-id.ts`(T-0718) + 그 spec — **직전 self-wire mirror**. type-only import 라 top-level import + 단일 return 직전 self-assert 패턴(lazy require 불요)을 그대로 따른다.
- `test/helpers/realdata-e2e-seed-fixture.spec.ts` — 기존 컴포저 spec(무회귀 대상 + self-wire describe 추가 위치). 본 task 의 self-wire 검증 test(spy 1 회 호출·인자 순서·throw 선전파·산출 byte-identical 무변경)를 본 colocated spec 에 describe 로 추가.

## Acceptance Criteria

`buildRealDataE2eSeed` 단일 return 사이트 직전에 `assertRealDataE2eSeedConsistentWithUsernames(seed)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 descriptor 배열의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `assertRealDataE2eSeedDeterministic` 는 self-wire 하지 않는다(2-인자 — spec 잔류). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`realdata-e2e-seed-fixture-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-seed-fixture.ts` 상단에 `import { assertRealDataE2eSeedConsistentWithUsernames } from "./realdata-e2e-seed-fixture-consistency";`(top-level, value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `buildRealDataE2eSeed` 의 return 식을 `const seed = REAL_DATA_GITHUB_USERNAMES.map(...)` 로 묶고, 반환 직전 `assertRealDataE2eSeedConsistentWithUsernames(seed);` self-assert 후 `return seed;`. 산출 트리·값·참조-무공유(매 호출 새 트리) 무변경.
- [ ] **Happy-path test 1+**(`realdata-e2e-seed-fixture.spec.ts` self-wire describe) — `buildRealDataE2eSeed()` 가 throw 0 으로 기존과 동일한 descriptor 배열을 반환(self-wire 후 무회귀). self-wire 호출이 가드를 정확히 산출에 대해 1 회 호출함을 `jest.spyOn`(가드 모듈) 으로 검증 — 호출 횟수 1·인자가 반환될 산출과 동일 참조·인자 순서.
- [ ] **Error path test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataE2eSeedConsistentWithUsernames` 가 RangeError(또는 TypeError)를 throw 하도록 강제하면 `buildRealDataE2eSeed()` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError 분기·TypeError 분기 각 1+(가드 throw 선전파 negative).
- [ ] **Flow / branch coverage** — 정상(void → return seed) 경로 1+ test. 컴포저는 분기 없는 무인자 builder 이므로 self-wire 추가 후에도 분기 추가 0 — 가드 throw 선전파(error 경로)와 정상 경로 두 흐름을 cover(분기 없음 — 가드 throw 선전파로 error 흐름 cover).
- [ ] **Negative cases 충분 cover** — 가드 throw 선전파(RangeError·TypeError 각 1+) + 결정성: self-wire 후에도 두 번 호출 산출이 deep-equal·참조-무공유 유지(`assertRealDataE2eSeedDeterministic(first, second)` 로 spec 에서 직접 검증 — 본 가드 self-wire 가 결정성을 깨지 않음). spy 가 매 호출 1 회씩 호출됨(두 번 호출 시 2 회).
- [ ] `assertRealDataE2eSeedDeterministic` 는 컴포저에 self-wire 하지 **않음**(2-인자 — 컴포저 단일 호출 안에서 배선 불가). spec 에서 두 산출을 넘겨 검증하는 기존/신규 test 로만 cover. trail notes 에 "Deterministic 는 2-출력 인자라 self-wire 제외, 불변식 가드만 배선" 1 줄.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), self-wire 후 컴포저 cov 100% 유지 목표.
- [ ] 전체 unit suite green(기존 seed-fixture spec·consistency spec 무회귀).

## Out of Scope

- 가드 본체(`realdata-e2e-seed-fixture-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- `assertRealDataE2eSeedDeterministic` self-wire 시도 금지 — 2-인자라 컴포저 단일 return 안에서 배선 불가(결정성은 spec 검증으로 잔류).
- `buildRealDataE2eSeed` 의 합성 규칙(`REAL_DATA_GITHUB_USERNAMES`·email suffix·externalId·isPrimary 등) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다.
- 다른 NO-GUARD parse-shape 류 leaf(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 가드 신설·self-wire 는 별도 task.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0. 실 DB seed/upsert 배선 0.

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0714/T-0718 self-wire mirror 라 architect 불요).

## Follow-ups

- seed-side stream 가드 사슬 완결(seed-collect-input·seed-collect-call-args·seed-upsert·seed-resolve-person-id·seed-fixture 5 leaf 모두 가드+self-wire 짝 닫힘) — 본 task 머지로 seed-side 전량 closeout 확인 후, 잔여 NO-GUARD parse-shape 류 leaf(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 의 값-정합 가드 적용 여부 case-by-case 판정 후 별도 task.
