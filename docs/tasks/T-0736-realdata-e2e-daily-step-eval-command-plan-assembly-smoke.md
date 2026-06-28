---
id: T-0736
title: realdata-e2e daily-test step_eval command-plan 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e — daily-test step_eval gating↔jest-argv 조립 smoke. 컴포저 unit 닫힘·조립 smoke 부재 gap. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-daily-step-eval-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts]
---

# T-0736 — realdata-e2e daily-test step_eval command-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e) step ④ 의 `deploy/daily-test.sh` `step_eval` 진입 경계는 순수 컴포저 `buildRealDataDailyStepEvalCommandPlan(env)` (T-0611) 가 닫는다 — gating 판정을 `resolveRealDataE2eLiveGating(env)` (T-0610) 에 위임하고 그 `enabled` 분기를 `{action:"run", argv:[...]}` / `{action:"skip"}` plan 으로 매핑한다. 이 컴포저는 unit/consistency spec (`realdata-e2e-daily-step-eval-command-plan.spec.ts`) 으로는 닫혀 있으나, **gating → action → jest-argv 합성 조립을 묶은 조립 체인 단위의 non-gated build-time smoke** 는 부재였다 (sibling 조립 smoke T-0728/T-0729/T-0730/T-0731 이 다른 composer family 만 cover). 본 task 는 그 gap 을 메워 조립 surface 회귀 (action↔gating 오매핑·skip 인데 argv 존재·run 인데 argv config/spec-path drift·argv 길이/순서 어긋남·reason 재포장) 를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` — 본 smoke 가 검증할 컴포저 (`buildRealDataDailyStepEvalCommandPlan` + `RealDataDailyStepEvalCommandPlan` interface + `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` / `REALDATA_E2E_SMOKE_JEST_CONFIG` 상수)
- `test/helpers/realdata-e2e-live-gating.ts` — gating 위임 대상 `resolveRealDataE2eLiveGating` (env 키 집합·완전성 규칙 — fixture env 구성에 필요)
- `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope 패턴의 mirror 템플릿 (sibling 조립 smoke)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 파일을 잡는지 확인용, 신규 파일명이 `*.smoke-spec.ts` 패턴 충족)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — gating env 완전 set fixture → `action === "run"` + `argv` 가 정확히 `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-live.smoke-spec.ts"]` canonical 4-요소 벡터 + `reason` 전파. gating env 부재 fixture → `action === "skip"` + `argv === undefined` + `reason` 전파 (조용한 SKIP, throw 0). 두 분기 각 1+ test.
- [ ] **Error/negative path test** — gating env 가 **부분만** set (필수 키 일부 누락) 인 fixture → `action === "skip"` (불완전 gating 은 run 으로 새지 않음) 1+ test. `argv` 가 실 credential 값을 echo 하지 않음 (§9 — argv 는 spec 경로·config flag 만, 주입한 fixture 의 token-like 값이 argv 어디에도 없음) 검증 1+ test.
- [ ] **Flow / branch coverage** — 컴포저의 run/skip 두 분기 각 1+ test (위 happy/negative 로 충족). 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 env (`{}`) → skip, (b) 필수 키 일부 누락 → skip, (c) 결정론·무공유: 동일 env 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan·새 argv 배열 (참조 비동일), (d) 입력 env 객체 mutate 0 (호출 전후 env deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI 에서 always green 발화, R-113). `process.env` 읽기 0 (fixture env 객체를 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 jest spawn) 복제 0 — gating→action→argv 조립 surface 만 검증.
- [ ] 새 외부 dependency 0 — 기존 `build*`/gating 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-daily-step-eval-command-plan.ts`) / gating helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
