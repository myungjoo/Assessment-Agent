---
id: T-0708
title: realdata-e2e live-gating 컴포저 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 95
estimatedFiles: 3
created: 2026-06-27
plannerNote: re-scope(arch-conflict) — self-wire 시 가드 spec 의 §9 단독-경로 test 가 컴포저 호출로 fixture 합성→throw 회귀, 그 1건 literal 합성 허용 + 컴포저 lazy require 로 circular dep 해소
independentStream: realdata-e2e-live-gating-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-live-gating.ts
  - test/helpers/realdata-e2e-live-gating.spec.ts
  - test/helpers/realdata-e2e-live-gating-consistency.spec.ts
---

# T-0708 — realdata-e2e live-gating 컴포저 self-wire 배선

## Why

P5(PLAN L109, 실 github.com 공개 활동 = 실 평가 e2e 입력) realdata-e2e build-time consistency guard chain 의 후속이다. T-0707(PR #623, squash a9ff2acd)가 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` 정합 가드를 신설했으나 컴포저 `resolveRealDataE2eLiveGating`(T-0610) 이 아직 그 가드를 호출하지 않는다 — 가드는 colocated spec 에서만 검증되고 production-path(컴포저 return) 에는 미배선이다. 본 task 는 컴포저의 **두 return 사이트**(① 7 env 중 하나라도 부재 → skip 분기 / ② 7 env 전부 set → live 활성 분기) 각각의 직전에 가드를 self-assert 로 배선해, gating 결정 drift(예: `enabled=true` 인데 credential 누락, `missing` 순서 불일치, `reason` 에 credential 값 누출)를 build-time fail-fast 로 차단한다(REQ-059 요약 무raw / REQ-032 정합). T-0703→T-0704(result-issue-action 양분기 self-wire) cadence 와 동형이며, T-0705→T-0706 self-wire 짝 닫기 mirror 다.

issue-still-relevant pre-check (origin/main grep):

- `git grep -n -i "assertRealDataE2eLiveGatingConsistentWithEnv|live-gating-consistency" origin/main -- "test/helpers/realdata-e2e-live-gating.ts"` → **exit 1 (매칭 0)**. 컴포저 본체에 self-wire 호출·가드 import 부재 확인 — make-work 아님.
- 가드 본체 `realdata-e2e-live-gating-consistency.ts` + `.spec.ts` 는 origin/main 존재(T-0707 머지). 본 task 는 그 가드를 컴포저 return-path 에 배선만.

arch-conflict re-scope 경위 (executor BLOCKED 반환 → planner 재검증):

- self-wire(컴포저가 §9 위반 시 throw)를 켜면, 가드 spec `realdata-e2e-live-gating-consistency.spec.ts` 의 "§9 단언 단독 경로" test(~309행)가 §9-위반 fixture 를 **컴포저 호출(`resolveRealDataE2eLiveGating(env)`, ~315행, apiKey="활성" 주입)** 로 합성해 fixture 생성 시점에 throw → fail 회귀. 그 test 1건만 컴포저 비호출(literal object 손수 합성)로 최소 조정 허용한다 — §9 단독-경로 test 는 본디 컴포저에 의존하면 안 되므로 더 정합적이다.
- circular dep(부차): T-0707 가드가 컴포저의 env 이름 상수를 runtime value 로 import 하므로, 컴포저가 가드를 self-assert 로 import 하면 CommonJS 순환 의존 형성. **컴포저 쪽 lazy require**(함수 내부 `require(...)`)로 해소 — 가드 본체는 수정 0.

## Required Reading

- `test/helpers/realdata-e2e-live-gating.ts` — 대상 컴포저. `resolveRealDataE2eLiveGating(env)` 는 **두 return 사이트**를 가진다 — (현 origin/main 기준) skip 분기 `return { enabled: false, reason: ... }`(약 161행) 와 live 활성 분기 `return { enabled: true, ollama, githubPat, reason }`(약 170행). 각 return 직전에 결과를 `const gating` 으로 묶어 self-assert 후 `return gating` 한다. 기존 import 블록에 가드 import 1줄 추가.
- `test/helpers/realdata-e2e-live-gating-consistency.ts` — 호출할 가드 시그니처: `assertRealDataE2eLiveGatingConsistentWithEnv(gating: RealDataE2eLiveGating, env: NodeJS.ProcessEnv): void`. 구조/타입 결손 → TypeError, 값 정합 위반(enabled mismatch / credential present-coupling / missing 순서) → RangeError 를 throw. **이 가드는 컴포저의 env 이름 상수를 runtime value 로 import** 하므로, 컴포저가 이 가드를 top-level import 하면 CommonJS 순환 의존 형성 → 컴포저 쪽 lazy require 로 우회. (가드 본체는 읽기만 — 본 task 에서 수정 금지.)
- `test/helpers/realdata-e2e-live-gating.spec.ts` — colocated spec. self-wire 배선 검증 describe 를 추가한다.
- `test/helpers/realdata-e2e-live-gating-consistency.spec.ts` — 가드 colocated spec. self-wire 가 켜지면 "§9 단언 단독 경로" test(~309행)가 §9-위반 fixture 를 컴포저 호출로 합성 → fixture 생성 시점 throw 회귀. **그 1건만** 컴포저 비호출 literal 합성으로 최소 조정한다(아래 AC). 다른 test 는 손대지 않는다.
- `test/helpers/realdata-e2e-result-issue-action.ts` + `.spec.ts` — **양분기 self-wire 선례(T-0704)**. create·update 각 return 직전 self-assert + import 패턴, spec 의 호출수/통과·throw 전파 검증 방식을 참고. 본 task 의 skip/active 양분기와 동형 구조.
- `test/helpers/realdata-e2e-result-summary.ts` + `.spec.ts` — 단일 return self-wire 선례(T-0706). spec 의 spy 호출 증명 방식 참고.

## Acceptance Criteria

- [ ] `resolveRealDataE2eLiveGating` 의 **skip 분기 return 직전** 에 결과 객체를 `const gating` 으로 묶고 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` self-assert 후 `return gating` 한다.
- [ ] `resolveRealDataE2eLiveGating` 의 **live 활성 분기 return 직전** 에도 동일하게 `const gating` 으로 묶고 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` self-assert 후 `return gating` 한다.
- [ ] **circular dep 해소**: 컴포저는 가드를 top-level import 하지 않고 **함수 내부 lazy require**(예: `const { assertRealDataE2eLiveGatingConsistentWithEnv } = require("./realdata-e2e-live-gating-consistency")`)로 가져온다 — 가드가 컴포저의 env 이름 상수를 runtime import 하므로 top-level import 시 CommonJS 순환 형성. 가드 본체 수정 0 으로 컴포저 쪽에서만 해소.
- [ ] Happy-path test 1+: (a) 7 env 전부 set → `enabled=true` 분기에서 self-assert 가 throw 없이 통과하고 반환 객체(enabled/ollama/githubPat/reason)가 self-wire 전과 byte-identical, (b) enable flag 부재 → `enabled=false` skip 분기에서 self-assert 통과 + 반환(enabled/reason/missing)이 self-wire 전과 byte-identical.
- [ ] Error path test 1+: self-assert 가 실제로 호출됨을 증명 — `assertRealDataE2eLiveGatingConsistentWithEnv` 를 jest spy/mock 으로 가로채 skip 분기·active 분기 각 경로에서 `resolveRealDataE2eLiveGating` 가 그것을 1회 호출함을 검증.
- [ ] Branch/flow test: 분기는 skip(부재) vs active(전부 set) 2 경로 — 각 경로에서 self-assert 통과 + 반환 정합 검증 1+ test (env 완전성 경계: 7 env 중 하나만 부재 → skip 경로로 진입함도 cover).
- [ ] Negative cases 충분 cover — 각 1+ test: (1) 가드를 spy 로 RangeError throw 시키면 `resolveRealDataE2eLiveGating` 가 삼키지 않고 전파(값 정합 위반 분기), (2) 가드를 spy 로 TypeError throw 시키는 구조 결손 시나리오 전파, (3) skip 분기와 active 분기 각각에서 throw 전파가 분기별로 발생함을 cover — self-wire 가 한쪽 분기만 배선한 회귀를 잡도록 양분기 모두 negative 검증.
- [ ] 기존 `realdata-e2e-live-gating.spec.ts` 의 기존 test 가 회귀 없이 모두 통과 (self-wire 가 정상 입력에서 반환값/순수성을 바꾸지 않음).
- [ ] **가드 spec §9 단독-경로 test 조정**: `realdata-e2e-live-gating-consistency.spec.ts` 의 "§9 단언 단독 경로" test(~309행, "reason 일치하지만 credential 누출 시 RangeError") **1건만** §9-위반 gating fixture 를 `resolveRealDataE2eLiveGating(env)` 호출 대신 **손수(literal object) 합성**하도록 최소 조정한다(self-wire 후 컴포저 호출이 fixture 생성 시점에 throw 하는 회귀 회피). 조정 후에도 그 test 가 가드의 §9 RangeError 전파를 그대로 검증함을 보존(테스트 의도 불변 — 컴포저 의존만 제거).
- [ ] **그 외 가드 spec 무회귀**: `realdata-e2e-live-gating-consistency.spec.ts` 의 위 1건 외 모든 test 는 수정 0 + 회귀 없이 통과. self-wire 가 정상/공백/부재 입력의 컴포저 결과를 바꾸지 않으므로 가드 spec 의 컴포저-호출 fixture 들(negative ④/⑤ 등 §9 비위반 경로)은 그대로 통과해야 한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 `realdata-e2e-live-gating.ts` cov 100% 보존.

## Out of Scope

- `realdata-e2e-live-gating-consistency.ts`(가드 **본체**) 수정 금지 — T-0707 에서 완결됨. 본 task 는 컴포저 배선만 + 가드 spec 의 §9 단독-경로 test 1건의 fixture-합성 방식 최소 조정(위 AC).
- 가드 spec `realdata-e2e-live-gating-consistency.spec.ts` 는 **"§9 단언 단독 경로" test 1건의 fixture 합성을 literal 로 바꾸는 최소 조정만** 허용 — 그 외 test 의 로직/단언/describe 변경 금지. test case 추가·삭제 0(해당 1건의 fixture 줄만 컴포저 비호출로 교체).
- 가드 로직(독립 재유도·deep-equal·에러 정책·§9 credential 비노출 단언) 변경 금지.
- env 이름 상수 집합·완전성 규칙·`isPresent` 정책·`missing` 나열 순서·`reason` 문구 변경 0 (반환 결과 byte-identical 보존).
- 잔여 NO-GUARD leaf 컴포저(result-issue-descriptor)의 가드 신설·배선 금지 — 별도 follow-up task.
- 실 credential 값을 코드·spec·journal 에 적기 0 (§9). env 이름 상수·합성 더미(예: `"x"`)만 사용.
- `src/` production code 변경 금지 (본 task 는 test/helpers 한정 test-only).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 NO-GUARD leaf 컴포저(result-issue-descriptor) 가드 신설 + self-wire 배선 (별도 task chain).

## Result (DONE)

- **완료**: 2026-06-27 (fire cron@aa-local15-5b168144, ADR-0036 stage5b claim-pickup).
- PR #624 squash 머지 `49476ee2`. reviewer round1 APPROVE, 4-게이트 PASS, CI green.
- 컴포저 `resolveRealDataE2eLiveGating` 두 return(skip/active) 직전 `const gating` 으로 묶어 `assertRealDataE2eLiveGatingConsistentWithEnv` self-assert 배선 + lazy `require` 로 CommonJS 순환 의존 해소(가드 본체 무수정). §9 단독-경로 test 1건만 composer-free literal fixture 로 조정.
- test-only +177/-5, 3 파일. self-wire(T-0708) describe 8 test 추가. 전체 8558 test pass, line/function ≥80% 게이트 통과.
