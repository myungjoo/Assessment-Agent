---
id: T-0985
title: github 수집 plan 조립 helper 반환 직전 consistency drift-guard self-wire (buildRealDataGithubCollectionPlan 산출을 즉시 자가 검증)
phase: P5
status: DONE
commitMode: pr
prNumber: 879
mergedAs: 85ae5cf5
reviewRounds: 1
coversReq: [REQ-032, REQ-059]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-collection-plan
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-github-collection-live.ts
  - test/helpers/realdata-e2e-github-collection-live.spec.ts
plannerNote: "P5 §109 test-hardening — T-0984 로 봉한 collection-plan consistency 가드를 producer 반환 직전 self-wire(T-0983/T-0977/T-0982 self-wire mirror). T-0984 이미 main 박제라 dep[]. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0985 — github 수집 plan 조립 helper 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 수집 leg 에서, gating 결과 + seed descriptor 배열로부터 실 github round-trip 요청 plan 을 조립하는 순수 함수 `buildRealDataGithubCollectionPlan`(`test/helpers/realdata-e2e-github-collection-live.ts`, T-0806)을 T-0984 가 독립 oracle 재유도-대조 drift-guard `assertRealDataGithubCollectionPlanConsistent`(`test/helpers/realdata-e2e-github-collection-live-consistency.ts`, PR #878 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 producer 에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다. 누군가 조립 규칙을 편집(예: path 형태 `/users/{u}/events/public` 변경, host 오타, primary-우선 username 선택 로직 파괴, gating.githubPat 존재 판정을 raw 값 유입으로 바꿔 §9 위반, enabled=false 인데 entries 를 채움)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 조용히 통과할 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataGithubCollectionPlan` 이 plan 을 반환하기 **직전** `assertRealDataGithubCollectionPlanConsistent(gating, seeds, plan)` 를 스스로 호출해 조립 즉시 자가 검증하도록 한다. 이렇게 하면 producer 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live smoke 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0977(eval-chain-input 조립 self-wire)·T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire) 패턴의 collection-plan-leg mirror 이자, T-0984 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 producer 를 `import type` 로만 참조하므로(확인됨), producer 가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0984 가 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

## Required Reading

- `test/helpers/realdata-e2e-github-collection-live.ts` (T-0806) — self-wire 대상 producer. `buildRealDataGithubCollectionPlan(gating, seeds): RealDataE2eGithubCollectionPlan` 는 두 return 지점을 갖는다 — (1) `gating.enabled !== true` 분기의 `return { enabled: false, entries: [] }`, (2) 활성 분기의 `return { enabled: true, entries }`. 두 exit 모두 반환 직전 plan 을 지역 변수(`plan`)에 담고 self-assert 후 반환하도록 소폭 리팩터(계산 로직 재정의 0). extractGithubUsername·상수(GITHUB_COLLECTION_HOST 등)는 그대로 둔다.
- `test/helpers/realdata-e2e-github-collection-live-consistency.ts` (T-0984, main 박제) — 배선할 가드. `assertRealDataGithubCollectionPlanConsistent(gating, seeds, plan, label?): void` — 정합이면 void, 구조 결손 = TypeError / 값 정합 위반(host/path/apiBaseUrl/username/hasAuthorizationHeader/enabled 반영/entries 길이 drift) = RangeError. 이 파일은 producer 로부터 `RealDataE2eGithubCollectionPlan`·`RealDataE2eGithubCollectionPlanEntry` 타입만 `import type` 로 참조하므로(58~63행 확인됨), producer 가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → producer value 엣지 0).
- `test/helpers/realdata-e2e-github-collection-live.spec.ts` (T-0806/T-0984) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` fixture + `RealDataSeedDescriptor` 타입(spec 정합 입력 재사용, read-only).
- `test/helpers/realdata-e2e-live-gating.ts` (T-0610) — `RealDataE2eLiveGating` 타입(enabled/ollama/githubPat 필드, type-only 참조).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-github-collection-live.ts` 수정 — `assertRealDataGithubCollectionPlanConsistent` 를 `./realdata-e2e-github-collection-live-consistency` 에서 value import 하고, `buildRealDataGithubCollectionPlan` 의 **두 return 지점 모두**(disabled 빈 plan · enabled entries plan) 반환 직전 plan 을 지역 변수에 담아 `assertRealDataGithubCollectionPlanConsistent(gating, seeds, plan)` 를 호출한 뒤 반환한다. 정합 plan 이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 조립 규칙(enabled 분기 · seed→entry 매핑 · primary-우선 username · host/apiBaseUrl/path/hasAuthorizationHeader 슬롯) 자체는 재정의 0 — 계산은 기존 그대로 두고 return 직전 self-assert 만 추가한다.
- [ ] `test/helpers/realdata-e2e-github-collection-live.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataGithubCollectionPlan` 이 정합 plan 을 throw 0 으로 정상 반환함을 assert 1+ — enabled=true fixture(seed 당 entry 정합) · enabled=false fixture(빈 plan) 두 경우 각각.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — gating 비-객체(null 포함) / seeds 비-배열 / seed 에 github.com identity 부재·externalId 공백 입력이 여전히 producer 자체(또는 self-assert)의 TypeError/Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataGithubCollectionPlanConsistent` 를 감싼 뒤, (a) enabled=true 경로와 (b) enabled=false 경로 각각에서 `buildRealDataGithubCollectionPlan` 호출 시 그 spy 가 `(gating, seeds, 반환된 plan)` 인자로 정확히 호출됐음을 assert(두 return 지점 모두 배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard).
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 producer 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataGithubCollectionPlan` 이 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 plan 이 여전히 새 객체 + entries 새 배열, 입력 gating/seeds 미변형) assert 1+.
  - **§9 secret-safety**: fixture/plan/에러 메시지 어디에도 실 secret/PAT 실 값 미노출(githubPat 은 비시크릿 더미 string 으로만, 에러 메시지에 PAT 값 미등장, plan 은 hasAuthorizationHeader boolean 만 노출) assert 유지(기존 case 재사용 가능).
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(githubPat fixture 는 비시크릿 더미 string). raw 활동 본문(commit/PR/issue 본문·payload 전문)을 파일/전역에 저장하지 않는다 — 본 배선은 요청 plan 구조만 다룬다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-github-collection-live-consistency.ts`(T-0984) 본문 수정 0 — value import·호출만(가드 재정의 0). 조립 규칙 재구현 0.
- eval-chain 3 sub-leg(input=T-0977 · activity-map=T-0982 · collect-request=T-0983) 의 self-wire·consistency 는 이미 완결 — 재수정 0.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 형제 helper 수정 0. 실 credential 주입·실 nightly 실행·`deploy/daily-test.sh` step_eval 재배선은 본 task 밖(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(`resolveGithubApiBaseUrl`·타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 collection-plan leg 도 helper(T-0806)→consistency(T-0984)→self-wire(본 task) 삼단 완결 — eval-chain 3 sub-leg 과 동형. §109 test-hardening 은 이후 다른 vein(예: gating premise leg·seed fixture consistency) 으로 이동 검토.
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 재배선 + 결과 daily-test 이슈 박제.

## Result (DONE — 2026-07-14T07:15Z)

- 완료: PR [#879](https://github.com/myungjoo/Assessment-Agent/pull/879) squash `85ae5cf5` main 머지. reviewer round 1/7 APPROVE(0 BLOCKER/0 MAJOR/0 MINOR), 4-게이트 전부 PASS.
- `buildRealDataGithubCollectionPlan` 두 return 지점(disabled 빈 plan · enabled entries plan) 반환 직전 `assertRealDataGithubCollectionPlanConsistent(gating, seeds, plan)` self-wire. 조립 계산 재정의 0 — value import + return 직전 self-assert 만. consistency→producer type-only 라 런타임 순환 없음.
- spec R-112 4종(happy enabled/disabled · error-path 가드 미가림 · flow/branch spy 로 두 return 지점 (gating,seeds,plan) 호출 증명 · negative drift RangeError 전파 + 비변형) 추가. lint·build·test:cov green(382 suites / 10065 tests, threshold line≥80%/func≥80% 충족). test-only 2파일 +168/-2, src·dep 변경 0.
- collection-plan leg 삼단 완결(helper T-0806 → consistency T-0984 → self-wire T-0985). §109 test-hardening 은 daily-report(step ④) vein(T-0986)으로 이동.
