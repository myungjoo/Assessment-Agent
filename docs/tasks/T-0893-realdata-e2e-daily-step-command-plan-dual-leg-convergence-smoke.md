---
id: T-0893
title: realdata-e2e daily-step command-plan eval↔collect dual-leg convergence build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts
plannerNote: "P5 §109 step④ — daily-step eval↔collect 두 컴포저가 동일 gating single-source·jest config 공유·spec 경로만 상이함을 묶는 dual-leg convergence smoke 신설(eval-leg run-plan/step-args dual-leg convergence 패턴 mirror). 컴포저 쌍 대칭 닫힌 후 convergence 그물 gap. test-only pr 1파일 dep0 stage5b 병렬 후보."
---

# T-0893 — realdata-e2e daily-step command-plan eval↔collect dual-leg convergence build-time smoke 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 `deploy/daily-test.sh` 는 nightly 로 **eval leg**(`step_eval` → `realdata-e2e-live.smoke-spec.ts`)와 **collect leg**(`step_collect` → `realdata-e2e-github-collection-live.smoke-spec.ts`)를 각 1 회 spawn 한다. 두 leg 의 bash 결정 로직은 순수 컴포저 `buildRealDataDailyStepEvalCommandPlan`(T-0611) / `buildRealDataDailyStepCollectCommandPlan`(T-0887)로 외화됐고, 각각 컴포저→bash→parity smoke→가드→self-wire→조립 smoke 까지 **동형으로 대칭**하게 닫혔다(T-0611/T-0612/T-0790/T-0693/T-0694/T-0736 ↔ T-0887/T-0888/T-0889/T-0890/T-0891/T-0892).

그러나 두 leg 를 **하나의 수렴점(convergence)으로 묶어 검증하는 smoke 는 아직 부재**하다. 두 컴포저는 설계상:
- **동일 gating single-source** `resolveRealDataE2eLiveGating(env)`(T-0610)에 위임 — 임의 env 에 대해 run/skip 판정이 항상 일치해야 한다.
- **동일 jest config 상수** `REALDATA_E2E_SMOKE_JEST_CONFIG = "./test/jest-smoke.json"` 공유.
- **spec 경로만 상이** — argv 는 `["--config", <config>, "--runTestsByPath", <spec>]` 4-요소 벡터로 동형이되 마지막 원소(spec 경로)만 leg 별로 다르다(eval=live smoke / collect=collection live smoke).

eval-leg 은 이런 수렴을 묶는 `*-dual-leg-convergence-assembly.smoke-spec.ts` 계열(`realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` / `realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` 등)을 여럿 갖고 있으나, **daily-step eval↔collect 쌍의 수렴 smoke 는 그 mirror 가 없다**. 그 결과 향후 한쪽 컴포저의 gating 위임·jest config·argv 형태가 상대 없이 drift(예: 한 leg 만 gating 재구현·config 하드코딩·argv 순서 변경·spec 경로 cross-wiring)해도 public CI 그물이 잡지 못한다. 본 task 는 그 gap 을 메워 두 daily-step leg 의 수렴 불변식을 build-time smoke 로 박제한다 — T-0736/T-0892 조립 smoke(각 leg 단독 gating→action→argv 검증)와 별개로, **두 leg 간 수렴(공유 gating source·공유 config·spec-only 차이)** 을 검증한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts`(T-0611) — eval leg 컴포저(`buildRealDataDailyStepEvalCommandPlan` + `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` + `REALDATA_E2E_SMOKE_JEST_CONFIG`). canonical run argv = `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-live.smoke-spec.ts"]`.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts`(T-0887) — collect leg 컴포저(`buildRealDataDailyStepCollectCommandPlan` + `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` + `REALDATA_E2E_SMOKE_JEST_CONFIG`). canonical run argv = `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts"]`.
- `test/helpers/realdata-e2e-live-gating.ts`(T-0610) — 두 컴포저가 공유 위임하는 gating single-source `resolveRealDataE2eLiveGating`(env 키 집합·완전성 규칙 — fixture env 구성에 필요).
- `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`(T-0736) + `test/smoke/realdata-e2e-daily-step-collect-command-plan-assembly.smoke-spec.ts`(T-0892) — 각 leg 단독 조립 smoke. fixture env 구성·non-gated describe·§9 credential 부재 단언 패턴을 그대로 차용.
- `test/smoke/realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` — **dual-leg convergence 패턴 mirror 템플릿**. 두 leg 산출을 공통 불변식으로 묶는 describe 구조·문서주석 패턴을 daily-step 쌍으로 차용.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts` 1개만 추가(test-only, production `src/`·기존 두 컴포저·gating helper·가드·조립 smoke 수정 0).
- [ ] **Happy-path 수렴 test 1+** — gating env 완전 set fixture 를 두 컴포저에 각각 주입 → 둘 다 `action === "run"`, 둘 다 `argv.length === 4`, argv 의 앞 3 요소(`["--config", "./test/jest-smoke.json", "--runTestsByPath"]`)가 **byte-identical**, 4 번째 요소(spec 경로)만 상이(eval=`.../realdata-e2e-live.smoke-spec.ts` / collect=`.../realdata-e2e-github-collection-live.smoke-spec.ts`) 임을 각 1+ test.
- [ ] **공유 gating single-source 수렴 test 1+** — 동일 env 를 두 컴포저에 주입 시 `action`(run/skip)이 항상 일치함을 enabled / disabled 양 fixture 로 각 1+ test(두 leg 의 gating 판정이 갈리지 않음).
- [ ] **공유 config 상수 수렴 test 1+** — 두 컴포저가 export 하는 `REALDATA_E2E_SMOKE_JEST_CONFIG` 가 byte-identical(`"./test/jest-smoke.json"`)이고, run argv 의 config 요소도 양 leg 동일임을 1+ test.
- [ ] **Error / branch cover** — gating env 부재 fixture → 두 컴포저 모두 `action === "skip"` + `argv === undefined`(둘 다 조용한 SKIP, throw 0) 1+ test. gating env **부분만** set(필수 키 일부 누락) fixture → 두 컴포저 모두 `action === "skip"`(불완전 gating 이 어느 한 leg 만 run 으로 새지 않음) 1+ test. run/skip 두 분기 각 1+ test 로 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) 빈 env(`{}`) → 두 leg 모두 skip, (b) 필수 gating 키 일부 누락 → 두 leg 모두 skip, (c) **spec 경로 cross-wiring 부재** — eval argv 의 spec 요소에 collection 경로가 없고 collect argv 의 spec 요소에 live(eval) 경로가 없음(정규식/부등 단언 각 1+), (d) **argv 가 실 credential 값을 echo 하지 않음**(§9 — 주입한 fixture 의 token-like placeholder 값이 양 leg argv/reason 어디에도 없음, 정규식 단언 1+), (e) 결정론·무공유: 동일 env 로 각 컴포저 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan·새 argv 배열(참조 비동일), (f) 입력 env 객체 mutate 0(두 컴포저 각 호출 전후 env deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip` 금지 — public CI 에서 always green 발화, R-113). `process.env` 읽기 0(fixture env 객체를 직접 주입).
- [ ] live leg(실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 jest spawn / 실 github 수집) 복제 0 — 두 컴포저의 gating→action→argv 수렴 surface 만 검증.
- [ ] 새 외부 dependency 0 — 기존 두 컴포저 + gating helper import 재사용만(새 컴포저/가드/helper 신설 금지).
- [ ] **lint+build+smoke green**: `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 두 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.
- [ ] **smoke 위치**: 신규 파일은 `test/smoke/` 아래(eval-leg dual-leg convergence 정본들과 동일 디렉토리). 새 공용 mock helper 추출 불요 — T-0736/T-0892 fixture env 구성 패턴 재사용.

## Out of Scope

- **각 leg 단독 조립 smoke(T-0736 eval / T-0892 collect) 수정** — 절대 건드리지 않음(file-disjoint 병렬). 본 task 는 두 leg 간 수렴만 신설.
- **T-0889 shell↔TS parity-drift smoke 재구현** — bash 배선 대비 argv drift 는 별도 cover. 본 task 는 두 TS 컴포저 간 수렴만.
- **두 컴포저 소스(`realdata-e2e-daily-step-{eval,collect}-command-plan.ts`) / gating helper / consistency 가드 수정** — test-only, 호출/import 만.
- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 live smoke 실행 / Ollama / live-LLM / credential wiring**.
- **새 컴포저 / 가드 / helper / consistency-guard 신설** — 기존 import 재사용만.
- **production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경 / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (dual-leg convergence smoke 선례(`realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` 등) + 각 leg 조립 smoke(T-0736/T-0892) 명확 — architect 생략. 두 컴포저를 import 해 수렴 불변식(공유 gating source·공유 config·spec-only 차이)을 fixture env 로 검증하는 non-gated smoke 를 신설.)

## Follow-ups

(없음 — 본 task 머지로 daily-step eval↔collect 두 leg 가 컴포저 쌍 대칭(T-0611↔T-0887 …)에 더해 수렴 그물까지 닫힌다. 이후 P5 잔여 갭: step④ result-issue 계열 collect 결과 박제 배선 재survey / daily-test rolling 이슈에 두 leg outcome 박제 실배선 재survey — 별도 슬라이스로 planner 가 큐잉.)
