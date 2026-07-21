---
id: T-1121
title: realdata-e2e 실 github 평가 full-chain live smoke 의 daily-test command-plan 순수 컴포저 scaffold (skip-guarded LIVE-wiring 1차 slice)
phase: P5
status: DONE
completedAt: 2026-07-21T08:54:43Z
mergedAs: 2e0e830e
prNumber: 1014
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-037]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-07-21
hqOrigin: Q-0053
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.spec.ts
independentStream: realdata-e2e-github-live-eval-wiring
plannerNote: "Q-0053 옵션1 승인 후 첫 LIVE-wiring slice. full-chain eval-chain-live smoke(T-0975)는 존재하나 daily-test command-plan 미배선 — step_eval(T-0611)/collect(T-0887)/rediscovery(T-0942) 동형 순수 plan helper 신설. credential-safe skip-guarded, 새 dep 0."
---

# T-1121 — realdata-e2e 실 github 평가 full-chain live smoke 의 daily-test command-plan 순수 컴포저 scaffold

## Why

Q-0053 owner 결정(옵션 1 승인, 2026-07-21): 실 github.com `myungjoo`/`leemgs` 평가 e2e LIVE wiring 진입. PLAN.md 109행 ④ 단계(`deploy/daily-test.sh` 에 실 github 수집 → 실 Ollama 평가 full-chain 을 nightly 로 배선 = 자율 nightly 실 평가 e2e)의 잔여 LIVE slice 중 **첫 scaffold** 이다.

현 상태 점검: full-chain 실 평가 e2e smoke(`test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts`, T-0975 — 실 github 수집 → bounded single 조립 → 실 Ollama LLM 평가 round-trip)는 이미 main 에 존재·skip-guarded 로 완성돼 있으나, **daily-test 실행 레이어(command-plan 순수 helper)로 배선돼 있지 않다**. 반면 형제 leg 인 step_eval(`buildRealDataDailyStepEvalCommandPlan`, T-0611) · step_collect(T-0887) · step_rediscovery(T-0942)는 각각 command-plan helper 를 갖고 daily-test.sh 가 그 argv 를 mirror 한다. 본 task 는 그 누락된 full-chain command-plan 컴포저를 T-0611 동형으로 신설한다. credential 부재 환경(cloud CI·일반 LAN)에서는 gating helper 위임으로 조용히 `action:"skip"` 을 산출해 네트워크 0 / secret 0 로 CI green 을 보존한다(skip-guard).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` (T-0611 — 정확히 mirror 할 정본 shape: `RealDataDailyStepEvalCommandPlan` interface + `build...` 순수 컴포저 + gating 위임 + skip/run 분기)
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts` (T-0611 unit spec — 본 task spec 이 참고할 test 구조: run/skip 분기, argv 벡터, 결정론/무공유, §9 credential 미포함)
- `test/helpers/realdata-e2e-live-gating.ts` (`resolveRealDataE2eLiveGating(env)` — gating env 키·완전성 규칙의 단독 소유자. 재구현 금지, 위임만)
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` (T-0975 — 본 command-plan 이 argv 로 가리킬 대상 spec 경로 확인: `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts`)

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.ts` 신설 — `buildRealDataDailyStepEvalChainCommandPlan(env: NodeJS.ProcessEnv)` 순수 컴포저 export. T-0611 동형: `resolveRealDataE2eLiveGating(env)` 위임(gating 키 재구현 0) → `enabled` 이면 `{ action: "run", argv, reason }`, 아니면 `{ action: "skip", reason }`(argv 미포함).
- [ ] argv 는 단일-spec bound 벡터 `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts"]` — spec 경로만 T-0611 과 다르고(full-chain smoke 로 교체) config/flag 관례는 동일. spec 경로·config 를 `export const` 상수로 노출(T-0611 동형).
- [ ] Happy-path test: gating 7 종 env 모두 set 인 env 주입 시 `action==="run"` + argv 4-요소 canonical 벡터(정확한 순서·값) + `reason` 전파 검증(1+).
- [ ] Error/negative path test: gating env 하나라도 부재(빈 env 포함)면 `action==="skip"` + `argv` 미존재(undefined) + throw 0(조용한 skip) 검증. 부재 env 조합을 **여러 경우**(빈 env, 일부만 set, PAT 만 누락 등 경계) 각 1+ 로 cover — 단일 negative 만으로 부족.
- [ ] Branch coverage: run 분기 / skip 분기 각 1+ test 로 분리.
- [ ] 결정론·무공유·§9 검증: 동일 env 두 번 호출 → deep-equal 산출 + 매 호출 새 객체(argv 배열 참조 비동일) + 입력 env mutate 0 + argv/reason 에 실 credential 값(PAT·Ollama URL·api key) 미포함(§9) 검증 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `deploy/daily-test.sh` 에 실제 `step_eval_chain` bash step 추가 — **본 task 밖**(follow-up). 본 slice 는 순수 command-plan 컴포저 + unit spec 만(정본 결정 로직의 testable 외화). bash 배선은 이 helper 산출 argv 를 mirror 하는 별도 pr task.
- consistency self-wire 가드(`assert...ConsistentWithGating` 형제) 추가 — 본 scaffold 는 컴포저 core 만. self-wire 가드는 필요 시 follow-up(신설 leaf 라 첫 가드는 정당하나 slice 최소화 위해 분리).
- `resolveRealDataE2eLiveGating` gating 키·완전성 규칙 수정 — 단독 소유자(T-0610) 불변, 위임만.
- `package.json` / `test/jest-smoke.json` / smoke spec 본문 수정. write-scope credential / 새 gh mutation / 새 외부 dependency 도입.
- STATE.json counters / lock write.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append. 예상 후속: (1) `deploy/daily-test.sh` step_eval_chain bash 배선 + bash executable spec, (2) 본 컴포저 consistency self-wire 가드.)
