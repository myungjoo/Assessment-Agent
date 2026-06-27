---
id: T-0710
title: realdata-e2e result-issue-descriptor identity 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 L109 실 평가 e2e — assertRealDataResultIssueDescriptorIdentityConsistent 를 buildRealDataResultIssueDescriptor 단일 return 직전 self-assert 배선, T-0709 가드 짝 닫기, T-0706 단일-return self-wire mirror, dependsOn [] 독립
independentStream: realdata-e2e-result-issue-descriptor-identity-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.ts
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
---

# T-0710 — realdata-e2e result-issue-descriptor identity 가드 컴포저 self-wire 배선

## Why

P5(PLAN L109, 실 github.com 공개 활동 = 실 평가 e2e 입력) realdata-e2e build-time consistency guard chain 의 후속이다. T-0709(PR #625, squash 02573de6)가 `assertRealDataResultIssueDescriptorIdentityConsistent(descriptor, run)` title·marker identity 정합 가드를 신설했으나, 컴포저 `buildRealDataResultIssueDescriptor`(T-0582) 가 아직 그 가드를 호출하지 않는다 — 가드는 colocated spec 에서만 검증되고 production-path(컴포저 return) 에는 미배선이다. 본 task 는 컴포저의 **단일 return 사이트**(line 151, `return { title, marker, body }`) 직전에 가드를 self-assert 로 배선해, title·marker 식별자 drift(title 과 marker 의 run token 어긋남 / prefix 변형 / marker 가 다른 run token 을 담아 멱등 search-or-update 가 깨지는 회귀)를 build-time fail-fast 로 차단한다(REQ-032 이슈 중복 방지 멱등 정합 / REQ-059 action 의 title·marker 정합). 컴포저는 이미 같은 return 사이트에 body-consistency 가드(T-0646) self-wire 를 갖고 있어, 본 배선은 그 직전에 identity self-assert 1 줄을 더하는 동형 패턴이다. T-0705→T-0706(result-summary 단일-return self-wire) cadence 와 동형이며, T-0709 가드 신설의 self-wire 짝을 닫는다.

issue-still-relevant pre-check (origin/main grep):

- `git grep -n -i "assertRealDataResultIssueDescriptorIdentityConsistent|descriptor-identity-consistency" origin/main -- "test/helpers/realdata-e2e-result-issue-descriptor.ts"` → **exit 1 (매칭 0)**. 컴포저 본체에 identity 가드 self-wire 호출·import 부재 확인 — make-work 아님.
- 가드 본체 `realdata-e2e-result-issue-descriptor-identity-consistency.ts` + `.spec.ts` 는 origin/main 존재(T-0709 머지, blob fca52938 / ccbe5056). 본 task 는 그 가드를 컴포저 return-path 에 배선만.

circular-dep 부재 (T-0708 과의 차이):

- T-0709 identity 가드는 컴포저로부터 **type-only import**(`import type { RealDataResultIssueDescriptor, RealDataResultIssueRunRef }`)만 쓰고 prefix 상수는 **독립 재정의**(`EXPECTED_ISSUE_TITLE_PREFIX` / `EXPECTED_ISSUE_MARKER_PREFIX`) 한다 — 컴포저의 runtime value 를 import 하지 않는다. type-only import 는 컴파일 시 erase 되므로 컴포저가 가드를 **top-level import** 해도 CommonJS 런타임 순환 의존이 형성되지 않는다(T-0708 의 lazy require 우회 불요). 기존 body-consistency 가드(T-0646)도 동일하게 top-level import 되어 있음 — 본 task 는 그 import 블록에 1 줄 추가 + return 직전 self-assert 1 줄 추가.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — 대상 컴포저. `buildRealDataResultIssueDescriptor(summary, run)` 는 **단일 return 사이트**(약 151행 `return { title, marker, body }`) 를 가진다. 그 직전(약 141~150행)에 이미 `assertRealDataResultIssueDescriptorBodyConsistent({ title, marker, body }, summary)` self-wire(T-0646) 가 있음 — 본 task 의 identity self-assert 는 그 body self-assert 와 같은 위치(return 직전)에 둔다. 기존 import 블록(56~59행)에 identity 가드 import 1 줄 추가.
- `test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.ts` — 호출할 가드 시그니처: `assertRealDataResultIssueDescriptorIdentityConsistent(descriptor: RealDataResultIssueDescriptor, run: RealDataResultIssueRunRef): void` (약 178행 export). title·marker mismatch / run token 교차 불일치 / prefix 어긋남 → RangeError, 구조·타입 결손 → TypeError. **컴포저로부터 type-only import 만** 쓰므로 컴포저의 top-level import 에 circular dep 없음. (가드 본체는 읽기만 — 본 task 에서 수정 금지.)
- `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` — 컴포저 colocated spec. self-wire 배선 검증 describe 를 추가한다.
- `test/helpers/realdata-e2e-result-summary.ts` + `.spec.ts` — **단일 return self-wire 선례(T-0706)**. 단일 return 직전 self-assert + top-level import 패턴, spec 의 spy 호출 증명(가드가 1 회 호출됨) + throw 전파 검증 방식을 참고. 본 task 의 단일-return 구조와 동형.

## Acceptance Criteria

- [ ] `buildRealDataResultIssueDescriptor` 의 **단일 return 직전** 에 `assertRealDataResultIssueDescriptorIdentityConsistent({ title, marker, body }, run)` (또는 동일 descriptor 객체) self-assert 를 추가한다 — 기존 body-consistency self-assert(T-0646) 와 같은 위치(return 직전). 정상 합성이면 가드는 void 반환하므로 동작·반환값 byte-identical 보존.
- [ ] 컴포저는 identity 가드를 **top-level import**(`import { assertRealDataResultIssueDescriptorIdentityConsistent } from "./realdata-e2e-result-issue-descriptor-identity-consistency"`) 한다 — 가드가 컴포저로부터 type-only import 만 쓰므로 circular dep 없음(T-0708 의 lazy require 불요). 가드 본체 수정 0.
- [ ] Happy-path unit test 1+: 정상 `summary`·`run` 입력 시 self-assert 가 throw 없이 통과하고, 반환 descriptor(`{ title, marker, body }`) 가 self-wire 전과 byte-identical(기존 happy-path 회귀 없음). summary 가 달라도 동일 run 이면 동일 title·marker 임(멱등) 검증 1+.
- [ ] Error path unit test 1+: identity self-assert 가 실제로 호출됨을 증명 — `assertRealDataResultIssueDescriptorIdentityConsistent` 를 jest spy/mock 으로 가로채 `buildRealDataResultIssueDescriptor` 가 그것을 정상 경로에서 1 회 호출함을 검증.
- [ ] Flow / branch coverage — 컴포저는 단일 return 경로(분기 없음, `assertNonBlank` 빈/공백 거부는 return 도달 전 throw). 그러므로 (1) 정상 경로(self-assert 통과 후 return) 와 (2) `assertNonBlank` 거부 경로(빈/공백 gitSha·dateToken → identity self-assert 도달 전 throw) 를 각각 cover. self-assert 자체에 분기가 없으므로 "분기 없음 — 가드 호출/throw 전파로 cover" 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: (1) identity 가드를 spy 로 RangeError throw 시키면 컴포저가 삼키지 않고 전파(값 정합 위반 시 손상 descriptor 미반환), (2) identity 가드를 spy 로 TypeError throw 시키는 구조 결손 시나리오 전파, (3) body-consistency 가드(T-0646)와 identity 가드가 **둘 다** return 직전에 호출됨을 검증(한쪽만 배선한 회귀 차단 — 두 spy 모두 1 회 호출 확인), (4) 빈/공백 gitSha·dateToken run → 컴포저 `assertNonBlank` 가 identity self-assert 도달 전에 거부(throw) 함을 검증.
- [ ] 기존 `realdata-e2e-result-issue-descriptor.spec.ts` 의 기존 test 가 회귀 없이 모두 통과 (self-wire 가 정상 입력에서 반환값/순수성을 바꾸지 않음).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 `realdata-e2e-result-issue-descriptor.ts` cov 보존(가급적 100%).

## Out of Scope

- `realdata-e2e-result-issue-descriptor-identity-consistency.ts`(가드 **본체**) 수정 금지 — T-0709 에서 완결됨. 본 task 는 컴포저 배선 + 컴포저 colocated spec 의 self-wire 검증 describe 추가만.
- 가드 로직(독립 재유도·title/marker byte-identical 대조·run token 교차 검증·에러 정책·빈/공백 거부) 변경 금지.
- `body` 3 블록 구조 self-wire(T-0646)·`assertRealDataResultIssueDescriptorBodyConsistent` 변경 0 — 그대로 유지(본 task 는 identity self-assert 를 그 옆에 추가만).
- `ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX`·`runToken` 합성 규칙·`assertNonBlank` 정책 변경 0 (반환 결과 byte-identical 보존).
- T-0708 식 lazy require 도입 금지 — 본 가드는 circular dep 없으므로 top-level import 가 정합. lazy require 는 불필요한 복잡도.
- `src/` production code 변경 / DB write·migration / live LLM 호출 / zod·ajv 등 외부 validation 라이브러리 도입 — 전부 0.
- 잔여 다른 컴포저 가드 신설·배선 0 — 별도 task chain.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점. result-issue-descriptor leaf 의 가드 신설(T-0709)+self-wire(T-0710) 짝이 닫히면 backlogNote 가 명명한 NO-GUARD leaf 사슬이 한 칸 더 마감됨 — 다음 fire 에서 잔여 미cover 영역 재survey.)
