---
id: T-0984
title: 실 평가 e2e github 수집 plan 조립(buildRealDataGithubCollectionPlan) consistency drift-guard 순수 helper + colocated R-112 spec
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-collection-plan
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-github-collection-live-consistency.ts
  - test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — eval-chain 3 sub-leg 삼단 완결(T-0983) 후 collection-plan vein 로 이동. T-0806 producer 에 sibling 관례 -consistency drift-guard 부재 표면. T-0981/T-0976/T-0979 consistency mirror. pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0984 — github 수집 plan 조립 consistency drift-guard 순수 helper + colocated R-112 spec

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 수집 leg 에서, T-0806 이 gating 결과 + seed descriptor 배열로부터 실 github round-trip 요청 plan 을 조립하는 순수 함수 `buildRealDataGithubCollectionPlan`(`test/helpers/realdata-e2e-github-collection-live.ts`)을 봉했다. 이 함수는 (a) gating 비활성이면 빈 plan(entries 0), (b) 활성이면 각 seed 의 primary-우선 github.com identity 를 대상 username 으로 뽑아 host/apiBaseUrl/path/hasAuthorizationHeader 를 담은 entry 1 건씩 조립하는 결정론 producer 다.

문제는 이 producer 에 sibling 관례인 **`-consistency` drift-guard 짝이 부재**하다는 점이다. eval-chain sub-leg 3 종(input=T-0976, activity-map=T-0979, collect-request=T-0981)은 모두 producer 옆에 독립 oracle 재유도-대조 가드를 갖추고 self-wire 까지 봉했지만(T-0983 로 3 sub-leg 삼단 완결), 그보다 상류의 collection-plan 조립 규칙은 아직 오직 producer 자신의 spec 만이 검증한다. 누군가 조립 규칙을 편집(예: path 형태 `/users/{u}/events/public` 변경, host 오타, primary-우선 선택 로직 파괴, gating.githubPat 존재 판정을 raw 값 유입으로 바꿔 §9 위반, enabled=false 인데 entries 를 채움)하면서 그 특정 조합을 spec 이 커버하지 않으면 조용히 통과할 수 있다.

본 task 는 그 빈칸을 채운다 — 조립 규칙(enabled 반영 · seed 당 entry 1 건 · primary-우선 github.com username 추출 · host="github.com" · apiBaseUrl=`resolveGithubApiBaseUrl` 단일 원천 · path=`/users/{username}/events/public` · hasAuthorizationHeader=githubPat 존재 boolean · §9 raw PAT 미노출)을 **독립 oracle 로 재유도**해 `buildRealDataGithubCollectionPlan` 산출과 deep-equal(byte-identical) 대조하는 순수 fail-fast 가드 `assertRealDataGithubCollectionPlanConsistent` 를 신설한다. 이는 collect-request-consistency(T-0981)·eval-chain-input-consistency(T-0976)·activity-map-consistency(T-0979) 패턴의 collection-plan-leg mirror 다. 본 task 는 consistency 짝만 봉하고(producer 파일 무변경), 후속 slice 가 self-wire 로 이어받는다(3 sub-leg 이 밟은 삼단의 collection-plan 판). producer(T-0806)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-github-collection-live.ts` (T-0806) — 가드 대상 producer. `buildRealDataGithubCollectionPlan(gating, seeds): RealDataE2eGithubCollectionPlan` 의 조립 규칙(enabled 분기 · seed→entry 매핑 · `extractGithubUsername` primary-우선 선택 · host/apiBaseUrl/path/hasAuthorizationHeader 슬롯)을 독립 재유도의 근거로 삼는다. **가드는 이 파일의 함수를 import 하지 않는다** — 규칙을 독립적으로 재구현해 대조해야 drift 를 잡는다(oracle 독립성). 단 `RealDataE2eGithubCollectionPlan`·`RealDataE2eGithubCollectionPlanEntry` 타입은 type-only import 가능.
- `test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts` (T-0981, main 박제) — 신설 가드가 따를 sibling 형태의 canonical precedent. 시그니처(`assert...Consistent(입력들, 결과, label?): void`), 정합=void / 구조 결손=TypeError / 값 정합 위반=RangeError, 독립 oracle 재유도 + deep-equal 대조, §9 secret-safety 주석 관례를 그대로 mirror 한다.
- `test/helpers/realdata-e2e-live-gating.ts` (T-0610) — `RealDataE2eLiveGating` 타입(enabled/ollama/githubPat 필드) 확인용 type-only import.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor`/`RealDataServiceIdentitySeed` 타입 + `buildRealDataE2eSeed()` fixture(spec 에서 정합 seed 입력으로 재사용). type/fixture read-only.
- `src/github/github-request.builder.ts` — `resolveGithubApiBaseUrl` 확인용(가드가 apiBaseUrl 재유도 시 producer 와 동일 단일 원천 사용, read-only import).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-github-collection-live-consistency.ts` 신설 — `assertRealDataGithubCollectionPlanConsistent(gating: RealDataE2eLiveGating, seeds: RealDataSeedDescriptor[], plan: RealDataE2eGithubCollectionPlan, label?: string): void` export. 동작: (1) plan 구조(객체 · `enabled: boolean` · `entries: 배열`) 결손 시 한국어 메시지 TypeError. (2) gating/seeds 로부터 **독립 재유도**한 expected plan 을 조립 — enabled 미활성이면 `{enabled:false, entries:[]}`, 활성이면 seed 당 entry(primary-우선 github.com username · host="github.com" · apiBaseUrl=`resolveGithubApiBaseUrl("github.com")` · path=`/users/{username}/events/public` · hasAuthorizationHeader=(typeof gating.githubPat==="string" && trim.length>0)). (3) 실제 plan 과 expected 를 deep-equal 대조, 불일치 시 한국어 메시지 RangeError(어느 슬롯이 drift 했는지 식별). 가드는 gating/seeds/plan 을 **읽기만** 하고 mutate 0.
- [ ] `test/helpers/realdata-e2e-github-collection-live-consistency.spec.ts` 신설 — 신 가드에 대한 R-112 4종:
  - **Happy-path**: `buildRealDataGithubCollectionPlan` 를 producer 로 호출해 얻은 정합 plan(enabled=true fixture + enabled=false fixture 각각)에 대해 `assertRealDataGithubCollectionPlanConsistent` 가 throw 0(void)임을 assert 1+.
  - **Error path**: plan 구조 결손(비-객체/null / `enabled` 비-boolean / `entries` 비-배열) 입력에 대해 각각 TypeError 를 던짐을 각 1+ assert.
  - **Flow/branch cover — 분기마다 1+**: (a) gating.enabled=false → 빈 plan 정합 통과, (b) gating.enabled=true 다중 seed → seed 당 entry 정합 통과, (c) hasAuthorizationHeader true(githubPat 존재) / false(githubPat 부재·공백) 두 분기 각 정합 통과, (d) primary-우선 선택(primary identity 존재 시 그것, 부재 시 첫 github.com identity) 두 경로 각 정합 통과.
  - **Negative 충분 cover — 값 drift 유형마다 1+**: producer 정합 plan 을 얕은 복제 후 한 슬롯만 손상시켜 각각 RangeError 를 던짐을 검증 — (a) entry.host 오염, (b) entry.path 형태 변조(예: `/users/{u}/events` 로 public 누락), (c) entry.apiBaseUrl 변조, (d) entry.username 변조(잘못된 identity 선택 모사), (e) entry.hasAuthorizationHeader boolean 반전, (f) enabled=true 인데 entries 길이가 seeds 길이와 불일치(누락/과잉), (g) enabled 반영 drift(`enabled:false` 인데 entries 비어있지 않음). 각 1+ assert.
  - **§9 secret-safety**: fixture/plan/에러 메시지 어디에도 실 secret/PAT 실 값 미노출(githubPat 은 비시크릿 더미 string 으로만, 에러 메시지에 PAT 값 미등장, plan 은 hasAuthorizationHeader boolean 만 노출) assert 1+.
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(githubPat fixture 는 비시크릿 더미 string). raw 활동 본문(commit/PR/issue 본문·payload 전문)을 파일/전역에 저장하지 않는다 — 본 가드는 요청 plan 구조만 다룬다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신 가드·spec 모두 순수/결정론이라 완전 커버(신규 helper line/branch/func 100% 목표).

## Out of Scope

- `test/helpers/realdata-e2e-github-collection-live.ts`(T-0806) producer 본문 수정 0 — 본 task 는 consistency 짝만 신설(self-wire 는 후속 slice). producer 에 가드 배선하지 않는다(순환 의존·행동 변경 회피).
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 형제 helper(eval-chain input/activity-map/collect-request leg) 수정 0 — 이미 삼단 완결(T-0983).
- eval-chain 3 sub-leg 의 self-wire/consistency 재수정 0. collection-plan self-wire 는 본 task 밖(후속 slice).
- `src/` production 코드 변경 0(`resolveGithubApiBaseUrl`·타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드는 drift 감지 시 throw 만(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- collection-plan self-wire slice(후속): 본 가드를 `buildRealDataGithubCollectionPlan` 반환 직전에 self-wire 해 매 조립 자가 검증 트립와이어화(T-0983/T-0977/T-0982 self-wire mirror). producer→guard type-only import 라 런타임 순환 없음 예상(구현 시 재확인). 본 consistency 짝이 main 박제된 뒤 dep 으로 큐잉.
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 재배선 + 결과 daily-test 이슈 박제.

---

## Result (DONE)

- 완료: 2026-07-14, PR #878 squash merge `b8718165` (reviewer APPROVE round1 — 0 BLOCKER/0 MAJOR/0 MINOR, 4-게이트 PASS).
- 신설: `test/helpers/realdata-e2e-github-collection-live-consistency.ts` (+355, `assertRealDataGithubCollectionPlanConsistent`) + `.spec.ts` (29 test, R-112 4종).
- 전체 382 suite / 10055 tests green, lint·build·test:cov 통과 (global line 99.95% / func 100% / branch 99.25%, 신 helper 완전 커버). production src 0 LOC, 새 dep 0.
- Follow-up: T-0985 — producer `buildRealDataGithubCollectionPlan` 반환 직전 self-wire (planner 큐잉 완료).
