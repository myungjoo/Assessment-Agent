---
id: T-1111
title: realdata-e2e github-collection-live per-element 재유도 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg14
phase: P5
status: DONE
mergedAs: e233947b
prNumber: 1003
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg14 — github-collection-live per-element 재유도 delegate(resolveGithubApiBaseUrl(host)) toHaveBeenCalledWith/NthCalledWith 인자-충실도 lock. spec W=0 적격(T=11), 기존 githubRequestBuilderModule spyOn 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1111 — realdata-e2e github-collection-live per-element 재유도 인자-충실도 완결 (§D 후보 2 leg14)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg13([T-1098~T-1110](T-1110-eval-inputs-argfid.md))로 진행됐다. leg1~7 은 `result-issue` 계열, leg8~10 은 daily-step dual-leg 형제 계열, leg11~12(T-1108/T-1109)는 daily-step **collect/eval-command-plan** leaf 컴포저 seam, leg13(T-1110)은 **evaluation-inputs** per-element 재유도 seam 을 소진했다.

본 leg 은 그 sweep 의 **leg14** 로, T-1110 Follow-ups 가 명시적으로 지목한 **잔여 W=0 & T>0 non-daily-step seam** 중 첫 후보 **`github-collection-live`** 를 대상으로 한다. 이 가드 `assertRealDataGithubCollectionPlanConsistent(gating, seeds, plan)` 는 컴포저 산출 plan 을 source seeds 전량에 대해 **per-element 재유도**(guard 소스 L200 `seeds.map`)해 byte-identical 정합을 대조하며, 그 재유도 안에서 apiBaseUrl 을 delegate `resolveGithubApiBaseUrl(host)`(guard 소스 L58 import·L207 호출)로 산출한다. 구조-검사 선행성(재유도-앞 구조 error → delegate 0-call)·call-count(happy `toHaveBeenCalledTimes(SEEDS.length)` / gating disabled 0-call / 값-drift RangeError `SEEDS.length` 회)는 이미 못박혔으나(T-1088), 그 order-locked spy 가 **어떤 host 인자로**(각 호출이 constant host `"github.com"`) 호출됐는지(`toHaveBeenCalledWith`/`toHaveBeenNthCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 45105961 — T-1110 머지 PR #1002 squash 이후):
- 대상 spec `test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 11건·`spyOn` 14건 보유 → order/count-lock spy 인프라 조밀(W=0 & T>0 잔여 후보군 다음 항목).
- 가드 소스 `test/helpers/realdata-e2e-github-collection-live-consistency.ts` L58 실증: named import `resolveGithubApiBaseUrl`, L200 `seeds.map` per-element 재유도가 각 seed 마다 L207 `resolveGithubApiBaseUrl(EXPECTED_GITHUB_COLLECTION_HOST)` 로 delegate 를 1-arg 호출. `EXPECTED_GITHUB_COLLECTION_HOST = "github.com"`(guard L70) 상수 — 매 호출 동일 host 인자 `"github.com"`.
- 기존 spec 의 "구조-검사 선행성" describe 블록(L575~) happy-path it(L583~604)에 `const spy = jest.spyOn(githubRequestBuilderModule, "resolveGithubApiBaseUrl")`(L592) 를 설치해 `toHaveBeenCalledTimes(SEEDS.length)`(L603)만 못박고, 값-boundary it(L738·L766)도 `toHaveBeenCalledTimes(SEEDS.length)`(L763·L786)만 대조 — **각 호출의 host 인자 payload 충실도(`toHaveBeenCalledWith`)는 assert 하지 않는다** → 진성 인자-충실도 gap. fixture 는 `SEEDS = buildRealDataE2eSeed()`(L58, 순서 있는 배열)·`GATING_ENABLED_WITH_PAT`(L32)·module alias `githubRequestBuilderModule`(L19 `import * as githubRequestBuilderModule from "../../src/github/github-request.builder"`).

## Required Reading

- `docs/tasks/T-1110-eval-inputs-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 evaluation-inputs per-element 인자-충실도 leg(T-1110)의 canonical assert 패턴(`toHaveBeenNthCalledWith(i+1, arg)` per-element + canonical `toHaveBeenCalledWith` + 인자-축 negative + arity 봉함)을 **본 seam** 에 그대로 확장 적용한다. 단 본 seam 의 delegate 인자는 원소별 상이한 payload 가 아니라 **매 호출 동일 constant host `"github.com"`** 이라는 점만 다르다(순번별 원소 대조 대신 순번별 동일 host 대조).
- `test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts` — **"구조-검사 선행성" describe 블록(L575~) happy-path it(L583~604)의 `spy` spyOn 설치(L592)·`toHaveBeenCalledTimes(SEEDS.length)`(L603) 패턴과 fixture(`SEEDS`(L58)·`GATING_ENABLED_WITH_PAT`(L32))·module alias(`githubRequestBuilderModule`(L19))·`afterEach(jest.restoreAllMocks)`(L578~580) 격리만.** 파일 전량 광범위 read 금지 — 대상 it(L583~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-github-collection-live-consistency.ts` — **L58 import·L70 상수·L200~207 per-element map 3줄만.** delegate 가 named `resolveGithubApiBaseUrl`(1-arg `host: string`)이며 per-seed map 에서 매번 constant `"github.com"` 로 호출됨을 확인(이미 planner pre-check 로 확정). `EXPECTED_GITHUB_COLLECTION_HOST` 는 guard 로컬 상수(미export)이므로 spec 에서는 literal `"github.com"` 를 직접 쓴다.

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-github-collection-live-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **resolveGithubApiBaseUrl delegate 인자-충실도(happy-path, per-element 순번별)**: happy-path 선행성 it(L583) 에서 delegate 가 각 호출마다 **정확히 constant host `"github.com"` 를 그 순번에** 받았음을 순번별 `toHaveBeenNthCalledWith`(예: `for (let i = 1; i <= SEEDS.length; i++) expect(spy).toHaveBeenNthCalledWith(i, "github.com")`) 로 lock. 추가로 canonical `expect(spy).toHaveBeenCalledWith("github.com")` 1+ 도 명시(전체 완전 충실도). 기존 `toHaveBeenCalledTimes(SEEDS.length)` 는 제거 말고 유지(횟수+순번+인자 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenNthCalledWith`/`toHaveBeenCalledWith` 가 host 인자 drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(spy).not.toHaveBeenCalledWith("evil.example")`(오염 host 미매칭) 또는 `expect(spy).not.toHaveBeenCalledWith("")`(빈 host drift 미매칭) 형태로 host payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 it(슬롯 drift·entries 길이 불일치)을 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.** (주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 실제 host `"github.com"` 와 다르도록 구성.)
- [ ] **negative — 인자 개수/arity 봉함**: 각 delegate 호출이 정확히 1 인자로 호출됨을 `spy.mock.calls.forEach((call) => expect(call.length).toBe(1))`(또는 대표 호출 `expect(spy.mock.calls[0].length).toBe(1)`) 로 lock 하는 assert 1+(여분 인자 0 — per-seed map 의 1-arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 선행성 재유도 order-lock it(L583) 단일 경로 tighten — 새 분기 도입 0. per-seed 재유도 조립 경로에 분기 없음(요소별 동일 constant host 호출) → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts` ≥ 1(본 leg 이 github-collection-live per-element 재유도 인자-충실도를 최초 lock — audit 후보 2 leg14, 잔여 non-daily-step seam 소진 진행).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 선행성 happy `toHaveBeenCalledTimes(SEEDS.length)`·gating disabled 0-call·구조 결손 0-call·값-drift RangeError `SEEDS.length` 회 negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-github-collection-live-consistency.ts`·`github-request.builder.ts` 등) 변경 금지** — test-only assert 추가. 가드/delegate 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 github-collection-live **한 seam** 만. 잔여 W=0 & T>0 seam(`seed-upsert-consistency` W=0 T=1 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성·call-count exactly-N(happy `SEEDS.length` / gating disabled 0 / 구조 결손 0)·order-lock 재유도** — 소진(T-1088). 기존 `toHaveBeenCalledTimes` assert 제거·변경 금지(유지만).
- **result-issue 계열·daily-step dual-leg 형제 계열·collect/eval-command-plan·evaluation-inputs(leg1~13: T-1098~T-1110) 인자-충실도** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 `githubRequestBuilderModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 per-element 재유도 seam 확장). implementer 는 happy-path 선행성 it(L583) 의 `spy` 인프라를 재사용해 순번별 `toHaveBeenNthCalledWith(i, "github.com")` 인자-충실도 + canonical `toHaveBeenCalledWith("github.com")` + 인자-축 negative 2종(host payload drift + arity 봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 github-collection-live per-element 재유도 인자-충실도를 lock 하면, 잔여 W=0 & T>0 non-daily-step seam 중 `seed-upsert-consistency`(W=0 T=1) 를 다음 pre-check 로 `toHaveBeenCalledWith` count=0 & `toHaveBeenCalledTimes`>0 재확인 후 소진. 잔여 없으면 completion-audit(후보 2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
