---
id: T-0806
title: 실 평가 e2e github.com 수집 leg env-gated live smoke (PLAN 109행 gate 2 collection leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-07-07
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts
  - test/helpers/realdata-e2e-github-collection-live.ts
  - test/helpers/realdata-e2e-github-collection-live.spec.ts
independentStream: p5-realdata-e2e-collect-leg
plannerNote: "P5 gate2(실 github myungjoo/leemgs 평가 e2e) — T-0610 이 deferred 한 '실 github 네트워크 수집 배선' leg 을 env-gated skip-by-default smoke 로 박제(새 dep 0, 공개 CI green)."
---

# T-0806 — 실 평가 e2e github.com 수집 leg env-gated live smoke (PLAN 109행 gate 2 collection leg)

## Why

오너가 [Q-0051](../STATE.json) 옵션 2 로 "실 github.com `myungjoo`/`leemgs` 공개 활동을 실 평가 e2e 입력으로" 승인했다([PLAN.md](../PLAN.md) 109행, 권장 착수 순서 5→4→2 중 gate 2). 그 e2e 의 LLM 평가 leg 는 이미 env-gated live smoke 로 박제됐으나(`test/smoke/realdata-e2e-live.smoke-spec.ts`, T-0610), **그 spec 의 header 가 명시적으로 "실 github 네트워크 수집 배선은 후속 slice … 본 task 는 typed surface 만" 이라며 collection leg 를 synthetic Activity 1 건으로 stub** 해 뒀다. 본 task 는 그 deferred 된 collection leg 를 메운다 — 실 github.com 공개 활동을 실제로 1 회 round-trip 수집하는 env-gated skip-by-default smoke 를 박제한다. gating env(github read PAT — `REALDATA_E2E_GITHUB_READ_PAT`, 이미 `resolveRealDataE2eLiveGating` 이 판정)가 부재한 공개 CI 에서는 `describe.skip` 으로 전 suite 가 skip 돼 실 네트워크 0 / secret 0 / 비용 0 으로 green 을 유지한다(R-113). 새 외부 dependency 0(Node 내장 fetch — 기존 `GithubAdapter` default transport 재사용). 실 credential 주입 자체는 §5 게이트(deploy env 의 PAT 주입 = ops 책임)라 본 task 밖 — 본 task 는 credential 이 주입됐을 때 발화하는 **수집 leg wiring + gating 판정 순수 helper + skip-by-default 실행 spec** 만 박제한다.

## Required Reading

- `docs/PLAN.md` 109행 — 실 평가 e2e (myungjoo/leemgs) bullet + Q-0051 오너 승인 annotation(운영 전제 = github read PAT 주입뿐)
- `test/smoke/realdata-e2e-live.smoke-spec.ts` (header + gating/compose 구조) — 본 task 가 mirror 할 **LLM leg** env-gated smoke. 그 header 가 collection leg 를 후속 slice 로 명시 deferred 한 지점(실 github 네트워크 수집 배선)이 본 task 의 진입점
- `test/helpers/realdata-e2e-live-gating.ts` — `resolveRealDataE2eLiveGating(env)` 순수 helper. `REALDATA_E2E_GITHUB_READ_PAT`(52행 `REALDATA_E2E_GITHUB_READ_PAT_ENV`)를 이미 판정해 `gating.githubPat`(평문 trim, skip 시 undefined)로 노출한다 — 본 collection smoke 가 이 gating 결과를 그대로 재사용(새 gating 발명 0)
- `test/smoke/github-live.smoke-spec.ts` (T-0204, ADR-0021) — 실 github.com 네트워크 round-trip smoke 의 **canonical mirror 패턴**: `new GithubAdapter()` → `adapter.request(input)` default `globalThis.fetch` 로 실 endpoint 도달, env 부재 시 describe.skip, 비결정 본문 미assert(도메인 매핑 정상 round-trip + 비어있지 않은 메타 1+ 만 assert)
- `src/github/github-adapter.service.ts` (263행 `async request(input)`, 287행 `async requestAllPages(input)`) — 실 github round-trip 진입 public 메서드(재사용, 변경 0). `GithubDomainError` export 도 참고
- `test/helpers/realdata-e2e-seed-collect-input.ts` (T-0576) — seed descriptor → `CollectForPersonInput[]` 순수 매퍼 + `CollectForPersonInput` type import 위치. 본 smoke 가 수집 대상 person(myungjoo/leemgs) 식별자를 조립할 때 재사용
- `test/helpers/realdata-e2e-seed-fixture.ts` (`buildRealDataE2eSeed` / `RealDataSeedDescriptor`) — myungjoo/leemgs seed descriptor source(수집 대상 username 확정)

## Acceptance Criteria

새 gating/collection helper `test/helpers/realdata-e2e-github-collection-live.ts`(순수 함수 — env 판정·요청 plan 조립만, 실 fetch 미포함)와 colocated unit spec, 그리고 env-gated 실행 smoke `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` 를 추가한다. production `src/` 변경 0(전부 import 재사용). 실 credential 값은 어느 파일에도 적지 않고 env 에서만 읽는다(§9).

- [ ] **collection leg gating 재사용 + 요청 plan 순수 helper**: `test/helpers/realdata-e2e-github-collection-live.ts` 에 `resolveRealDataE2eLiveGating`(기존, 변경 0)의 결과 `githubPat` + seed descriptor(myungjoo/leemgs)로부터 **실 github round-trip 요청 plan**(대상 username·수집 endpoint 형태·Authorization 헤더 존재 여부 등 결정론적 구조)을 조립하는 순수 함수를 export 한다. 실 fetch 는 하지 않는다(plan 만) — 순수·부수효과 0·입력 비변형·호출마다 새 객체.
- [ ] **env-gated skip-by-default 실행 smoke**: `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` 는 `resolveRealDataE2eLiveGating(process.env).enabled === false`(공개 CI 기본) 시 `describe.skip` 으로 전 suite skip → 실 네트워크 0 / secret 0. gating env 전부 present 일 때만 `new GithubAdapter()` → `adapter.request(...)`(default `globalThis.fetch`)로 myungjoo/leemgs 공개 활동을 **정확히 필요한 최소 round-trip**(github-live.smoke mirror — bounded, rate-limit 여유)만 수행하고, 비결정 본문은 assert 하지 않고 도메인 매핑 정상 round-trip + 비어있지 않은 메타 1+(repo/활동 식별자)만 assert 한다.
- [ ] **raw 미보관(R-59)**: 수집 결과에서 commit/PR/issue 본문 등 raw 외부 활동 데이터를 파일/변수로 보관하지 않는다 — 식별자/메타 존재만 검증. helper 는 `CollectForPersonInput` 최소 shape(service+externalId)만 다룬다.
- [ ] **Happy-path unit test 1+**: gating enabled(github PAT + Ollama 5 종 present, mock env)일 때 요청 plan helper 가 myungjoo/leemgs 대상·Authorization 헤더 present·결정론 구조를 반환하는 happy-path 1+.
- [ ] **Error path unit test 1+**: helper 입력(env 또는 seed descriptor)이 `null`/`undefined`/비정상 shape(username 누락 등)일 때 한국어 메시지 `TypeError`/명시적 throw. 각 축 1+.
- [ ] **Flow/branch coverage**: gating enabled/disabled 분기 각 1+(disabled → skip plan 또는 빈 plan). seed 대상이 1명/2명 분기 각 1+.
- [ ] **Negative cases 충분 cover(각 1+)**: (a) github PAT env 부재 → enabled false → smoke describe.skip(실 호출 0), (b) Ollama 5 종 중 1개 부재 → enabled false, (c) 빈 seed descriptor → 빈 plan, (d) PAT 는 있으나 빈 문자열 → enabled false(수집 leg 진입 불가), (e) 순수 helper 호출 후 입력 env/seed 배열 비변형(부수효과 0), 각 1+.
- [ ] **입력 비변형 검증**: 함수 호출 후 입력 env 객체·seed 배열이 mutate 되지 않음을 spec 로 확인.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 순수 helper 는 100% 근접 목표. 실행 smoke 는 skip-by-default 라 gating helper unit 이 커버리지 담당.

## Out of Scope

- **실 credential 주입 / deploy env 배선** — github read PAT(`REALDATA_E2E_GITHUB_READ_PAT`) 실값을 deploy env/secret 에 주입하는 것은 §5 credential 게이트(ops 책임, 오너 승인됨). 본 task 는 credential present 시 발화하는 wiring + skip-by-default spec 만 — 실값 0.
- **`resolveRealDataE2eLiveGating` / GithubAdapter / CollectionEntryService 시그니처 변경** — 전부 read-only import 재사용(변경 0). production `src/` 무변경.
- **LLM 평가 leg 재배선** — `realdata-e2e-live.smoke-spec.ts` 의 LLM leg 는 이미 env-gated live 로 존재. 본 task 는 collection leg 만.
- **daily-test.sh `step_eval` credentialed run 박제 / 결과 이슈 publish** — nightly 자율 실행 leg(PLAN 109행 step ④)은 credential 주입 후 후속 slice. `deploy/daily-test-step-eval.test.sh` 등 arg-plan 은 이미 main 에 존재.
- **DB write / persist** — 수집→평가 in-memory 검증만, DB write 0(persist symbol 주입 0).
- **새 외부 dependency** — Node 내장 fetch(GithubAdapter default transport)만. 새 package 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(gate 5 cleanup, non-blocking)** — **ADR-0053(overwrite/재평가)는 선행 [ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)의 중복 재결정이다**: overwrite/재평가 feature 는 ADR-0038 chain(T-0333~T-0337)이 이미 완결했다 — `period-bridge.dto.ts` `reevaluate?` 필드, `period-bridge-admin-persist.service.ts` 의 `reeval` 분기(reset-and-recreate), controller Admin-only + User `reevaluate:true` fail-closed 403, `test/e2e/period-bridge-reevaluate.e2e-spec.ts`(9 it: replace·first-write-wins 보존·create degrade·동시 수렴·negative) 전부 main 에 안착·검증됨. ADR-0053(T-0804)가 ADR-0038 을 0회 참조한 채 재결정했고, T-0805 helper(`computeOverwriteReevalPlan`)는 orchestration 이 자체 inline 분기로 동작하므로 **어디에서도 호출되지 않는 unwired dead code** 다. → 별도 작은 cleanup task 로: (1) `ADR-0053` frontmatter `status: SUPERSEDED` + `supersededBy: ADR-0038` 표기 + Context 한 줄로 "ADR-0038 이 동일 mechanism 을 선행 구현" 박제, (2) `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts` 의 T-0805 helper 를 제거(dead code)하거나, 실 배선 실익(다중 좌표 partial-reset plan outsource)이 있다고 판단되면 orchestration 에 wire — 오너/reviewer 판단. commitMode: ADR 표기 flip 은 direct(§3.1 rule 4 예외), helper 제거/배선은 pr. 본 항목은 **non-blocking** — 자율 loop 을 멈추지 않으며 gate 5 는 기능적으로 이미 완료됐다.
- **(gate 2 다음 slice)** — daily-test.sh `step_eval` credentialed run + 결과 daily-test rolling 이슈 박제(PLAN 109행 step ④). credential 주입(§5 ops) 후 진입. 본 task 의 collection leg smoke 가 그 실행 leg 의 수집 축을 검증한다.
- **(gate 2 후속)** — collection leg + LLM leg 를 한 실행 spec 으로 compose(실 github 수집 → 실 Ollama 평가 → 산출 검증)하는 full round-trip env-gated smoke. 두 leg 가 각각 env-gated 로 박제된 후 dependency-free 로 진입 가능.
