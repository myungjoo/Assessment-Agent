---
id: T-0708
title: realdata-e2e live-gating 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 PLAN L109 — T-0707 live-gating 가드 짝 닫기, resolveRealDataE2eLiveGating 양분기 return self-wire (T-0704 양분기 self-wire mirror)
independentStream: realdata-e2e-live-gating-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-live-gating.ts
  - test/helpers/realdata-e2e-live-gating.spec.ts
---

# T-0708 — realdata-e2e live-gating 컴포저 self-wire 배선

## Why

P5(PLAN L109, 실 github.com 공개 활동 = 실 평가 e2e 입력) realdata-e2e build-time consistency guard chain 의 후속이다. T-0707(PR #623, squash a9ff2acd)가 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` 정합 가드를 신설했으나 컴포저 `resolveRealDataE2eLiveGating`(T-0610) 이 아직 그 가드를 호출하지 않는다 — 가드는 colocated spec 에서만 검증되고 production-path(컴포저 return) 에는 미배선이다. 본 task 는 컴포저의 **두 return 사이트**(① 7 env 중 하나라도 부재 → skip 분기 / ② 7 env 전부 set → live 활성 분기) 각각의 직전에 가드를 self-assert 로 배선해, gating 결정 drift(예: `enabled=true` 인데 credential 누락, `missing` 순서 불일치, `reason` 에 credential 값 누출)를 build-time fail-fast 로 차단한다(REQ-059 요약 무raw / REQ-032 정합). T-0703→T-0704(result-issue-action 양분기 self-wire) cadence 와 동형이며, T-0705→T-0706 self-wire 짝 닫기 mirror 다.

issue-still-relevant pre-check (origin/main grep):

- `git grep -n -i "assertRealDataE2eLiveGatingConsistentWithEnv|live-gating-consistency" origin/main -- "test/helpers/realdata-e2e-live-gating.ts"` → **exit 1 (매칭 0)**. 컴포저 본체에 self-wire 호출·가드 import 부재 확인 — make-work 아님.
- 가드 본체 `realdata-e2e-live-gating-consistency.ts` + `.spec.ts` 는 origin/main 존재(T-0707 머지). 본 task 는 그 가드를 컴포저 return-path 에 배선만.

## Required Reading

- `test/helpers/realdata-e2e-live-gating.ts` — 대상 컴포저. `resolveRealDataE2eLiveGating(env)` 는 **두 return 사이트**를 가진다 — (현 origin/main 기준) skip 분기 `return { enabled: false, reason: ... }`(약 161행) 와 live 활성 분기 `return { enabled: true, ollama, githubPat, reason }`(약 170행). 각 return 직전에 결과를 `const gating` 으로 묶어 self-assert 후 `return gating` 한다. 기존 import 블록에 가드 import 1줄 추가.
- `test/helpers/realdata-e2e-live-gating-consistency.ts` — 호출할 가드 시그니처: `assertRealDataE2eLiveGatingConsistentWithEnv(gating: RealDataE2eLiveGating, env: NodeJS.ProcessEnv): void`. 구조/타입 결손 → TypeError, 값 정합 위반(enabled mismatch / credential present-coupling / missing 순서) → RangeError 를 throw. (읽기만 — 본 task 에서 수정 금지.)
- `test/helpers/realdata-e2e-live-gating.spec.ts` — colocated spec. self-wire 배선 검증 describe 를 추가한다.
- `test/helpers/realdata-e2e-result-issue-action.ts` + `.spec.ts` — **양분기 self-wire 선례(T-0704)**. create·update 각 return 직전 self-assert + import 패턴, spec 의 호출수/통과·throw 전파 검증 방식을 참고. 본 task 의 skip/active 양분기와 동형 구조.
- `test/helpers/realdata-e2e-result-summary.ts` + `.spec.ts` — 단일 return self-wire 선례(T-0706). spec 의 spy 호출 증명 방식 참고.

## Acceptance Criteria

- [ ] `resolveRealDataE2eLiveGating` 의 **skip 분기 return 직전** 에 결과 객체를 `const gating` 으로 묶고 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` self-assert 후 `return gating` 한다.
- [ ] `resolveRealDataE2eLiveGating` 의 **live 활성 분기 return 직전** 에도 동일하게 `const gating` 으로 묶고 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` self-assert 후 `return gating` 한다. import 1줄을 기존 import 블록에 추가.
- [ ] Happy-path test 1+: (a) 7 env 전부 set → `enabled=true` 분기에서 self-assert 가 throw 없이 통과하고 반환 객체(enabled/ollama/githubPat/reason)가 self-wire 전과 byte-identical, (b) enable flag 부재 → `enabled=false` skip 분기에서 self-assert 통과 + 반환(enabled/reason/missing)이 self-wire 전과 byte-identical.
- [ ] Error path test 1+: self-assert 가 실제로 호출됨을 증명 — `assertRealDataE2eLiveGatingConsistentWithEnv` 를 jest spy/mock 으로 가로채 skip 분기·active 분기 각 경로에서 `resolveRealDataE2eLiveGating` 가 그것을 1회 호출함을 검증.
- [ ] Branch/flow test: 분기는 skip(부재) vs active(전부 set) 2 경로 — 각 경로에서 self-assert 통과 + 반환 정합 검증 1+ test (env 완전성 경계: 7 env 중 하나만 부재 → skip 경로로 진입함도 cover).
- [ ] Negative cases 충분 cover — 각 1+ test: (1) 가드를 spy 로 RangeError throw 시키면 `resolveRealDataE2eLiveGating` 가 삼키지 않고 전파(값 정합 위반 분기), (2) 가드를 spy 로 TypeError throw 시키는 구조 결손 시나리오 전파, (3) skip 분기와 active 분기 각각에서 throw 전파가 분기별로 발생함을 cover — self-wire 가 한쪽 분기만 배선한 회귀를 잡도록 양분기 모두 negative 검증.
- [ ] 기존 `realdata-e2e-live-gating.spec.ts` 의 기존 test 가 회귀 없이 모두 통과 (self-wire 가 정상 입력에서 반환값/순수성을 바꾸지 않음).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 `realdata-e2e-live-gating.ts` cov 100% 보존.

## Out of Scope

- `realdata-e2e-live-gating-consistency.ts`(가드 본체)·그 spec 수정 금지 — T-0707 에서 완결됨. 본 task 는 배선만.
- 가드 로직(독립 재유도·deep-equal·에러 정책·§9 credential 비노출 단언) 변경 금지.
- env 이름 상수 집합·완전성 규칙·`isPresent` 정책·`missing` 나열 순서·`reason` 문구 변경 0 (반환 결과 byte-identical 보존).
- 잔여 NO-GUARD leaf 컴포저(result-issue-descriptor)의 가드 신설·배선 금지 — 별도 follow-up task.
- 실 credential 값을 코드·spec·journal 에 적기 0 (§9). env 이름 상수·합성 더미(예: `"x"`)만 사용.
- `src/` production code 변경 금지 (본 task 는 test/helpers 한정 test-only).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
