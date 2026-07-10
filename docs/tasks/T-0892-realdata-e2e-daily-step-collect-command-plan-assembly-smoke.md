---
id: T-0892
title: realdata-e2e daily-test step_collect command-plan 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-07-11
independentStream: realdata-e2e-daily-step-collect-assembly-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-collect-command-plan-assembly.smoke-spec.ts
plannerNote: "P5 §109 step④ — collect-leg command-plan 조립(gating→action→argv) non-gated build-time smoke 신설(eval-leg T-0736 mirror). 컴포저 guard+self-wire(T-0890/T-0891) 닫힘 후 조립 smoke gap. test-only pr 1파일 dep0 stage5b 병렬 후보."
---

# T-0892 — realdata-e2e daily-test step_collect command-plan 조립 체인 non-gated build-time smoke 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 `deploy/daily-test.sh` `step_collect` 진입 경계는 순수 컴포저 `buildRealDataDailyStepCollectCommandPlan(env)`(T-0887)가 닫는다 — gating 판정을 `resolveRealDataE2eLiveGating(env)`(T-0610)에 위임하고 그 `enabled` 분기를 `{action:"run", argv:[...]}` / `{action:"skip"}` plan 으로 매핑한다. 이 컴포저는 unit/consistency spec(`realdata-e2e-daily-step-collect-command-plan.spec.ts`) + 독립 정합 가드(T-0890) + self-wire(T-0891)로 닫혔으나, **gating → action → jest-argv 합성 조립을 묶은 조립 체인 단위의 non-gated build-time smoke** 는 아직 부재다.

**eval-leg** 은 동형 조립 smoke `realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`(T-0736, PR #651 머지)를 이미 갖고 있으나, collect-leg 은 그 mirror 가 없어 조립 surface 회귀(action↔gating 오매핑·skip 인데 argv 존재·run 인데 argv config/spec-path drift·argv 길이/순서 어긋남·reason 재포장·§9 credential 값 누출)를 public CI 그물로 잡지 못한다. 본 task 는 그 gap 을 메워 eval-leg(T-0736)와 동형의 collect-leg 조립 smoke 를 신설한다 — T-0889 shell↔TS parity smoke(bash 배선 대비 argv drift)와 별개로, **컴포저 조립 surface 자체**(gating→action→argv 합성)를 검증한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts`(T-0887) — 본 smoke 가 검증할 컴포저(`buildRealDataDailyStepCollectCommandPlan` + `RealDataDailyStepCollectCommandPlan` interface + `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` / `REALDATA_E2E_SMOKE_JEST_CONFIG` 상수). canonical argv = `["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`.
- `test/helpers/realdata-e2e-live-gating.ts` — gating 위임 대상 `resolveRealDataE2eLiveGating`(env 키 집합·완전성 규칙 — fixture env 구성에 필요).
- `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`(T-0736, 정본) — **mirror 템플릿**. 구조·문서주석·non-gated describe·Out of Scope 패턴을 collect-leg 로 그대로 차용하되 컴포저/상수/spec 경로만 collect 로 교체(`buildRealDataDailyStepEvalCommandPlan`→`buildRealDataDailyStepCollectCommandPlan`, live smoke spec 경로→`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`).
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-daily-step-collect-command-plan-assembly.smoke-spec.ts` 1개만 추가(test-only, production `src/`·기존 컴포저·helper·가드 수정 0).
- [ ] **Happy-path unit test 1+** — gating env 완전 set fixture → `action === "run"` + `argv` 가 정확히 `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts"]` canonical 4-요소 벡터 + `reason` 전파. gating env 부재 fixture → `action === "skip"` + `argv === undefined` + `reason` 전파(조용한 SKIP, throw 0). 양 분기 각 1+ test.
- [ ] **Error path unit test 1+** — gating env 가 **부분만** set(필수 키 일부 누락) 인 fixture → `action === "skip"`(불완전 gating 은 run 으로 새지 않음) 1+ test. self-wire(T-0891)로 컴포저가 산출 직전 가드를 self-assert 하므로 정상 합성은 throw 0 임도 검증.
- [ ] **Flow / branch cover** — 컴포저의 run/skip 두 분기 각 1+ test(위 happy/error 로 충족). 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) 빈 env(`{}`) → skip, (b) 필수 gating 키 일부 누락 → skip, (c) **argv 가 실 credential 값을 echo 하지 않음**(§9 — 주입한 fixture 의 token-like placeholder 값이 argv/reason 어디에도 없음, 정규식 단언 1+), (d) 결정론·무공유: 동일 env 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan·새 argv 배열(참조 비동일), (e) 입력 env 객체 mutate 0(호출 전후 env deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip` 금지 — public CI 에서 always green 발화, R-113). `process.env` 읽기 0(fixture env 객체를 직접 주입).
- [ ] live leg(실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 jest spawn / 실 github 수집) 복제 0 — gating→action→argv 조립 surface 만 검증.
- [ ] 새 외부 dependency 0 — 기존 `build*`/gating 컴포저 import 재사용만(새 컴포저/가드/helper 신설 금지).
- [ ] **lint+build+smoke green**: `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.
- [ ] **colocated/smoke 위치**: 신규 파일은 `test/smoke/` 아래(eval-leg 정본 T-0736 와 동일 디렉토리). 새 공용 mock helper 추출 불요 — T-0736 fixture env 구성 패턴 재사용.

## Out of Scope

- **eval-leg 조립 smoke(`realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`, T-0736) 수정** — 절대 건드리지 않음(file-disjoint 병렬).
- **T-0889 shell↔TS parity-drift smoke 재구현** — 본 task 는 컴포저 조립 surface(gating→action→argv 합성) 검증만. bash 배선 대비 argv drift 는 T-0889 이 별도 cover.
- **컴포저 소스(`realdata-e2e-daily-step-collect-command-plan.ts`) / gating helper / consistency 가드 수정** — test-only, 호출/import 만.
- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 live smoke 실행 / 실 collectForPerson / Ollama / live-LLM / credential wiring**.
- **새 컴포저 / 가드 / helper / consistency-guard 신설** — 기존 import 재사용만.
- **production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경 / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (조립 smoke 선례 eval-leg T-0736 명확 — architect 생략. 정본 `realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts` 를 구조·주석·describe·Out of Scope 째로 mirror 하되 컴포저/상수/spec 경로를 collect 로 교체.)

## Follow-ups

(없음 — 단, 본 task 머지로 collect-leg command-plan 사슬이 eval-leg 와 동형으로 컴포저(T-0887)→bash(T-0888)→parity smoke(T-0889)→가드(T-0890)→self-wire(T-0891)→조립 smoke(T-0892)까지 완전 대칭이 된다. 이후 P5 잔여 갭: step④ result-issue 계열 collect 결과 박제 배선 재survey·R-9 사용자 지정 기간 평가문(bullet 98)·R-61 일/주/월 요약 평가(bullet 97)·timezone KST(bullet 110) — 별도 슬라이스로 planner 가 큐잉.)
