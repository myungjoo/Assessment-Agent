---
id: T-0610
title: 실 평가 e2e env-gated live smoke spec — 조립된 step-args 를 실 수집+실 LLM 1 회 round-trip 실행
phase: P5
status: DONE
commitMode: pr
prNumber: 524
mergedAs: 51c42b3
reviewRounds: 1
coversReq: [REQ-013, REQ-009, REQ-059]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 109행 실 평가 e2e — pure step-args 스택(T-0573~T-0601) 닫힘. live 실행 leg(env-gated smoke)가 비어 있음 — period-bridge-live smoke gating mirror"
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-live.smoke-spec.ts
  - test/helpers/realdata-e2e-live-gating.ts
---

# T-0610 — 실 평가 e2e env-gated live smoke spec

## Why

P5(PLAN 109행, 🟢 실 평가 e2e — github.com `myungjoo`+`leemgs` 실 공개 활동) 의
**build-time 순수 layer 는 T-0573~T-0601 chain 으로 완결**됐다 — seed fixture →
upsert-args → collect-input → collect-call-args → Activity→EvaluationInput 매퍼 →
scoreUnit 호출-args → 결과 요약 descriptor → daily-test 이슈 렌더/박제 plan,
그리고 최상위 단일 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597) +
`buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601). 그러나 이 조립된
step-args 를 **실제로 실행**하는 leg(실 github 수집 → 실 LLM 평가 1 회 round-trip)는
T-0600/T-0601 Follow-ups 가 "daily-test step_eval wiring / gh 이슈 실 박제(step④
live, deferred — LAN/credential gate)" 로 미룬 채 비어 있다.

본 slice 는 그 gap 의 **첫 단계** — `period-bridge-live.smoke-spec.ts`(T-0339,
ADR-0037 §Decision5 env-gated 해소) 의 gating 패턴을 mirror 하는 **env-gated live
smoke spec** 을 추가한다. realdata-e2e 전용 gating env(예: `REALDATA_E2E_LIVE_TEST`
+ Ollama LLM 5 종 + github read PAT)가 *모두* set 된 경우에만 활성화되고, 부재 시
`describe.skip` 으로 전 suite 가 skip 된다 → public CI 는 gating env 부재라 항상 skip
→ 실 네트워크 0 / secret 0 / 비용 0 으로 green 유지(R-113). 실 credential 주입 +
실행 1 회 + 결과 daily-test 이슈 박제는 본 task 가 아니라 후속 slice(credentialed
run + daily-test.sh step_eval) 책임이다. 본 task 는 **gating helper + skip-by-default
실행 spec 인프라** 만 박제한다(period-bridge-live slice 1/2 와 동형).

raw 미저장(R-59) — 평가 결과만 산출하며 raw github 본문은 보관하지 않는다(수집
경로의 typed surface 만 evaluate).

## Required Reading

- `test/smoke/period-bridge-live.smoke-spec.ts` — **mirror 대상**. gating 판정 →
  `describe.skip` 분기, makeLiveGateway() 스타일 실 객체 조립, bounded-single-request
  (입력 1 건 = 실 LLM 호출 1 회) 패턴, 실 credential 값을 spec 에 적지 않고 env 에서만
  읽는 §9 격리, provider 라벨 매핑 주의를 그대로 따른다. 단 본 task 는 azure 대신
  로컬 Ollama(OpenAI 호환 `openai-compatible` provider) + 실 github 수집 leg 를 쓴다.
- `src/llm/llm-live-test-gating.ts` L86 `resolveLiveTestGating(env)` — gating 판정
  순수 helper. 본 task 의 `realdata-e2e-live-gating.ts` 는 이 패턴을 **mirror** 하되
  realdata-e2e 전용 env 키 집합(LLM 5 종 + github PAT + enable flag)을 판정한다.
  **`llm-live-test-gating.ts` 자체는 변경 금지** — 패턴 참조만.
- `test/helpers/realdata-e2e-run-plan.ts` L120 `buildRealDataE2eRunPlan(seeds,
  modelId, run)` → `{pipeline, run}` 시그니처 + throw 계약(modelId/seed/run guard)
  확인. 본 spec 이 이 단일 진입점으로 실행 plan 을 fail-fast 검증한다. **변경 금지** —
  소비만.
- `test/helpers/realdata-e2e-step-args.ts` L137 `buildRealDataE2eStepArgs(runPlan,
  activities, results)` → `{evaluation, publish}` 시그니처 확인. 본 spec 이 실
  수집 산출 `activities` + 실 평가 산출 `results` 를 이 aggregator 로 묶어 step-args
  를 조립한다. **변경 금지** — 소비만.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `myungjoo`/`leemgs` seed descriptor
  빌더(T-0573) 시그니처 확인. 본 spec 의 seeds 입력 source.
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `evaluateActivities
  (activities, options)` — 실 평가 leg 진입. period-bridge-live 와 동일하게 실
  EvaluationScoringService + 실 LlmHttpGateway(Ollama 지향) 조립을 통해 호출.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-live-gating.ts` 신설 — `resolveRealDataE2eLiveGating
  (env): { enabled: boolean, ... }` 순수 helper. realdata-e2e 전용 gating env 집합
  (enable flag + Ollama LLM 접속 5 종 + github read PAT)이 *모두* non-blank 일 때만
  `enabled: true`, 하나라도 부재/공백이면 `enabled: false`. 실 credential 값은 반환
  객체에 담되 본 helper 가 어디에도 echo/log 하지 않는다(§9). `llm-live-test-gating.ts`
  의 판정 형태를 mirror 하되 별도 파일로 분리(realdata-e2e 전용 env 키).
- [ ] `test/smoke/realdata-e2e-live.smoke-spec.ts` 신설 — `resolveRealDataE2eLiveGating
  (process.env).enabled` 가 false 면 `describe.skip` 으로 전 suite skip. true 일 때만
  seed → `buildRealDataE2eRunPlan` → 실 github 수집 1 건 bound → 실 Ollama LLM 평가
  1 회 round-trip → `buildRealDataE2eStepArgs` 조립 → 평가 결과 산출 검증.
  실행은 입력 1 건 = 실 LLM 호출 1 회로 bound(period-bridge-live bounded-single-request
  mirror). raw github 본문 미보관(R-59) — typed surface 만.
- [ ] **Happy-path unit test 1+**: gating env 가 모두 set 된 모의 env 에서
  `resolveRealDataE2eLiveGating(mockEnv).enabled === true` + 반환 객체에 LLM 5 종 /
  PAT 값이 정확히 매핑됨 검증. (live 실 round-trip 자체는 CI 에서 skip 되므로 gating
  helper 의 판정 로직을 unit 으로 cover — period-bridge-live 가 gating helper 를 별도
  unit 으로 검증한 선례 동형.)
- [ ] **Error path unit test 1+**: gating env 중 하나라도 부재/공백인 모의 env →
  `enabled === false` 반환(throw 0, 조용한 skip 유도). 빈 객체 env → `enabled === false`.
- [ ] **Flow / branch 분기 cover**: (a) 전 env set → enabled true 분기, (b) enable
  flag 만 부재 → false 분기, (c) LLM env 일부 부재 → false 분기, (d) PAT 만 부재 →
  false 분기 각 1+ test — gating helper 의 각 필수 키 누락 분기를 분리 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, gating 경계마다 분리:
  (1) 빈 문자열 env 값(공백만) → false(non-blank guard 동작),
  (2) enable flag 가 "false"/"0" 같은 falsy 문자열일 때 정책(명시적으로 활성/비활성
    중 어느 쪽인지 spec 으로 박제 — 권장: enable flag 는 존재+non-blank 면 활성, 값
    무관. 단 빈 문자열은 부재로 간주),
  (3) LLM 5 종 중 정확히 1 종만 부재(부분 set) → false,
  (4) PAT 부재 시 github 수집 leg 진입 불가 → enabled false 로 전 suite skip 보장,
  (5) gating 반환 객체가 credential 값을 log/throw message 에 노출하지 않음(§9)
    — 반환만, 부수효과 0 확인 각 1+ test.
- [ ] `describe.skip` 으로 인해 **public CI 에서 본 smoke suite 가 실 네트워크 호출 0 /
  secret 0 / 비용 0 으로 skip** 됨을 보장(`pnpm test:smoke` 가 gating env 부재 환경에서
  green). period-bridge-live 와 동일 보호.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `realdata-e2e-live-gating.ts`
  의 모든 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- **실 credential 주입 + 실행 1 회 + 결과 daily-test 이슈 박제 금지** — 본 task 는
  gating helper + skip-by-default 실행 spec 인프라만(period-bridge-live slice 1/2 동형).
  credentialed run + `deploy/daily-test.sh` 의 `step_eval` 배선은 후속 slice.
- `src/llm/llm-live-test-gating.ts` 변경 금지 — realdata-e2e 전용 gating 은 별도 파일.
- `realdata-e2e-run-plan.ts` / `realdata-e2e-step-args.ts` 등 기존 순수 helper 변경
  금지 — 본 spec 은 소비만(재구현 0). 시그니처/throw 계약 불변.
- `EvaluationOrchestratorService` / scoring / gateway / 5 detection composer 변경
  금지 — 실 평가 leg 는 기존 객체 조립만(period-bridge-live mirror).
- `deploy/daily-test.sh` / `deploy/seed-llm-config.sh` 변경 금지 — 본 task 는 test
  파일 2 개만 touch. deploy 배선은 후속.
- DB write / Prisma migration 0 — 본 spec 은 in-memory 평가 산출 검증만(period-bridge
  의 구조적 write-0 동형). 실 github 수집도 typed surface 만, raw 미저장(R-59).
- 신규 외부 dependency 0 — Node 내장 fetch(gateway transport) + 기존 helper import만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: realdata-e2e credentialed live run(실 PAT + 로컬 Ollama 주입, 1 회 실행,
  결과 박제) + `deploy/daily-test.sh` `step_eval` 배선(LLM_LIVE_*→Ollama endpoint +
  본 smoke spec 또는 평가 endpoint 실호출) → daily-test result/rolling 이슈 박제 =
  자율 nightly 실 평가 e2e(PLAN 109행 ④ 단계).
- PLAN 109행 closure 후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98), R-61
  일/주/월 요약 평가(bullet 97), timezone KST 반영(bullet 110, ADR-first) 등과 대조.
