---
id: T-0790
title: realdata-e2e step④ deploy/daily-test.sh step_eval shell-literal jest argv ↔ buildRealDataDailyStepEvalCommandPlan run-branch argv full-ordered-vector parity drift-detection smoke — bash step_eval 가 하드코딩한 jest 실행 argv(`--config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts`)가 그 "정본(canonical source)" TS helper buildRealDataDailyStepEvalCommandPlan(gating-enabled env).argv 의 4-요소 ordered 벡터와 byte-identical(full-vector·순서·길이·토큰 1:1)임을, 실 deploy/daily-test.sh 파일을 readFileSync 로 읽어 step_eval 함수 본문에서 argv 토큰을 추출해 helper 산출과 대조하는 cross-artifact(bash↔TS) drift-detection non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ — build-time aggregator render-line sweep(T-0778~0789, 20-way)은 T-0789 Follow-up 대로 소진(distinct in-memory seam 고갈). HIGH-bar 재판정으로 sweep 21번째 축은 큐잉 거부하고, genuinely 다른 seam 으로 전환: deploy/daily-test.sh step_eval 의 하드코딩 jest argv 와 그 정본 helper buildRealDataDailyStepEvalCommandPlan(env).argv 의 cross-artifact(bash↔TS) full-vector drift. gap 실측(origin/main 1e0217b0/9b780fcc): (1) bash test daily-test-step-eval.test.sh(T-0612)는 grep -q substring-presence 만(line 120-121·132-133, full-vector·순서·길이 parity 0). (2) TS smoke realdata-e2e-daily-step-eval-command-plan-assembly(T-0736)는 helper 단독, deploy/daily-test.sh 를 명시 Out-of-Scope(line 38). → 실 shell 파일 argv 토큰을 읽어 helper 산출 ordered 벡터와 byte-identical 대조하는 smoke 0 부재. step_eval argv 가 reorder/flag-변경되면 정본 helper 와 silent 분기 → nightly e2e 가 잘못된 jest 호출 → 무인 모니터링 false 신호. distinct seam(render-line 아님·shell↔TS drift). dependsOn [] file-disjoint stage5b 병렬, 신규 spec 1파일 sizeExempt"
independentStream: realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 인접 패턴(R-112 happy·cross-artifact full-vector parity(bash step_eval 하드코딩 jest argv 4-요소 ordered 벡터 == helper run-branch argv byte-identical·순서·길이·토큰 1:1) + helper canonical-source 재유도(buildRealDataDailyStepEvalCommandPlan(enabled env).argv) + REALDATA_E2E_SMOKE_JEST_CONFIG/REALDATA_E2E_LIVE_SMOKE_SPEC_PATH 상수 1:1 + skip-branch argv 부재 boundary + shell 파일 readFileSync robustness + negative 분기 다수(파일 부재·step_eval 함수 부재·flag 누락 검출·순서 어긋남 검출) + credential 미surface(§9) + 결정론/no-mutation) = ~230 LOC 1파일. T-0788(300)/T-0789(300) sibling smoke 패턴 인접 정당화(test-only·src 0·sweep 인접 cross-artifact 변형). 신규 spec 이 파일 I/O(readFileSync) + 토큰 추출 보조 함수를 담아 sibling 과 동급 LOC 근접이라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts
---

# T-0790 — realdata-e2e step④ daily-test.sh step_eval shell-literal jest argv ↔ helper run-branch argv full-ordered-vector parity drift-detection non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④는 "`deploy/daily-test.sh` 에 `step_eval` 추가 ... **jest argv 는 `buildRealDataDailyStepEvalCommandPlan` 의 run 분기 산출을 mirror**(정본은 그 helper)" 를 명시한다. 즉 nightly 자율 실 평가 e2e 의 핵심 실행 결정 — gating env 7종이 set 됐을 때 어떤 jest 명령으로 live smoke 를 spawn 하는가 — 는 TS helper `buildRealDataDailyStepEvalCommandPlan(env).argv`(run 분기) 가 **canonical source(정본)** 이고, bash `step_eval()` 함수는 그것을 손으로 mirror 한 사본이다(`deploy/daily-test.sh` 187~189행: `--config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts`, 주석 179~186행이 "정본은 그 helper" 명시).

직전 sweep(T-0778~0789)은 in-memory aggregator chain 의 render-line 깊이를 20-way 까지 닫았고, **T-0789 Follow-up 은 그 build-time 순수 render-line sweep 이 본질적으로 소진됐음을 명시**(20-way 가 build-time render-line closure 의 자연 경계 — 추가 축은 rephrase 양산 위험). 따라서 본 task 는 sweep 21번째 축을 거부하고, HIGH-bar 로 판정한 **genuinely distinct seam** 으로 전환한다: **shell ↔ TS helper 사이의 cross-artifact argv drift**.

본 task 의 사전 조사(origin/main 1e0217b0 / lastCommit 9b780fcc) 결과 — 이 정본-사본 parity 는 현재 **약하게만** 검증된다:

- **bash test `deploy/daily-test-step-eval.test.sh`(T-0612)** 는 step_eval argv 를 `grep -q -- '--config ./test/jest-smoke.json'` + `grep -q -- '--runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts'`(120~121행) **substring-presence** 로만 검사한다 — argv 의 **full-ordered 벡터·요소 순서·요소 개수·flag↔value 페어링 parity 0**(두 토큰이 따로 등장하기만 하면 PASS, 순서가 뒤집히거나 flag 가 추가/누락돼도 못 잡음). helper 측도 `grep -q 'test/smoke/realdata-e2e-live.smoke-spec.ts'`(132~133행) substring 만.
- **TS smoke `realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`(T-0736)** 는 helper `buildRealDataDailyStepEvalCommandPlan` 을 **단독 in-memory 검증**하고, **실 `deploy/daily-test.sh` bash 배선을 명시 Out-of-Scope**(38행: "실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn ... 검증 0") 으로 제외한다 — shell 파일을 읽지 않으므로 shell 사본이 helper 정본과 어긋나는지 알 수 없다.

즉 **실 `deploy/daily-test.sh` 파일에서 `step_eval` 함수가 하드코딩한 jest argv 토큰을 추출해, 그것이 helper 의 run-branch argv 4-요소 ordered 벡터(`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]`)와 byte-identical(순서·길이·토큰 1:1)인지 대조하는 smoke 가 0 부재**다. 이 drift 가 발생하면(예: 누군가 `step_eval` 의 flag 를 reorder 하거나, config 경로를 바꾸거나, helper 의 상수만 갱신하고 shell 을 안 고치거나) **정본과 사본이 silent 하게 분기** → nightly 자율 실 평가 e2e 가 **잘못된 jest 호출** 을 돌려 무인 모니터링에 false 신호를 준다. 이는 render-line 토큰 깊이와 distinct 한, **shell↔TS 두 artifact 간 drift-detection** 표면이다(REQ-009 search-or-update 멱등 e2e 가 의도대로 실행되는가의 운영 무결성).

본 task 는 그 빈 자리를 채운다 — `deploy/daily-test.sh` 를 `readFileSync` 로 읽어 `step_eval` 함수 본문에서 jest argv 토큰을 추출하고, gating-enabled env 로 `buildRealDataDailyStepEvalCommandPlan(env)` 를 호출해 그 `.argv`(run 분기, 4-요소 ordered 벡터)를 expected 로 삼아, shell 사본 ↔ helper 정본의 **full-ordered-vector byte-identical parity** 를 단언한다. 추가로 helper 가 노출하는 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`) · `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-live.smoke-spec.ts`) 가 shell 사본의 대응 토큰과 1:1 임을 박제한다.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoreUnit·실 gh CLI 실행·실 jest spawn) 복제 0·non-gated 항상 실행 — 순수 build-time 검증만(파일 read + in-memory helper 호출). `deploy/daily-test.sh` 는 읽기만 하고 실행/source 0.

## Required Reading

- `deploy/daily-test.sh` — **본 task 의 핵심 검증 대상(사본)**. `step_eval()` 함수(182~195행) 가 하드코딩한 jest argv: `pnpm exec jest --config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts`(187~189행) + 정본 명시 주석(179~186행: "jest argv 는 ... buildRealDataDailyStepEvalCommandPlan 의 run 분기 산출을 bash 로 mirror — 정본은 그 helper"). 본 task 가 `readFileSync` 로 읽어 step_eval 함수 본문에서 argv 토큰(`--config`·config 경로·`--runTestsByPath`·spec 경로)을 추출하는 정확한 source — **추출 정규식/슬라이스는 이 파일의 실제 토큰으로 확인해 박제(line-prefix·whitespace drift 0)**.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` — **본 task 의 정본(canonical source)**. `buildRealDataDailyStepEvalCommandPlan(env)`(74행~) 의 run 분기 argv = `["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]`(4-요소 ordered) + skip 분기 argv undefined + 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`, 38행) · `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-live.smoke-spec.ts`, 33행) + `RealDataDailyStepEvalCommandPlan` interface({action, argv?, reason}). 본 task 가 import 해 gating-enabled env 로 호출, run-branch `.argv` 를 expected ordered 벡터로 사용. (시그니처·상수값·argv 요소 순서 파일로 확인.)
- `test/helpers/realdata-e2e-live-gating.ts` (또는 `resolveRealDataE2eLiveGating` 정의 파일 — `realdata-e2e-daily-step-eval-command-plan.ts` 의 import 로 경로 확인) — gating 판정 helper. 본 task 가 **gating-enabled(7종 env 모두 set)** 와 **gating-disabled(일부 부재)** env 를 합성해 helper 의 run/skip 분기를 각각 유도하는 데 필요. (필수 env 키 7종 이름·완전성 규칙 파일로 확인 — 실 credential 값은 합성 placeholder 만, §9.)
- `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts` (T-0736) — helper 단독 smoke. **본 task 와의 경계 확인용**: 이 smoke 는 helper 의 env→{action,argv,reason} in-memory 조립만 검증하고 `deploy/daily-test.sh` bash 배선을 명시 Out-of-Scope(38행). 본 task 는 그 반대편 — 실 shell 파일을 읽어 helper 정본과의 full-vector parity 를 단언(중복 0, 상보적). (이 파일은 NUL KEY_SEP 로 git 이 "Bin" 표기될 수 있음 — MEMORY summary-batch-spec-nul-bytes 참조, 정상이므로 수정 0; 읽을 때 `tr -d '\000'` 불요·jest 는 정상 처리.)
- `deploy/daily-test-step-eval.test.sh` (T-0612) — bash executable 단위 test. **본 task 와의 경계 확인용**: 이 test 는 step_eval argv 를 `grep -q` substring-presence(120~121·132~133행) 로만 검사 — full-ordered-vector·순서·길이 parity 0. 본 task 는 그것을 TS 측에서 full-vector byte-identical 로 확장(distinct — substring vs ordered-vector). (본 task 가 이 bash test 를 변경/재구현하지 않음 — 상보적 TS smoke.)

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time 파일 read + in-memory helper 호출 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path: shell argv 추출 + helper run-branch argv 산출**: `readFileSync(path.join(<repo-root>, "deploy/daily-test.sh"), "utf8")` 로 shell 소스를 읽어 `step_eval()` 함수 본문에서 jest argv 토큰(`--config`·config 경로·`--runTestsByPath`·spec 경로)을 추출하는 보조 함수 + gating-enabled env(7종 모두 set, credential 은 합성 placeholder)로 `const plan = buildRealDataDailyStepEvalCommandPlan(env)` 호출 → `plan.action === "run"`·`Array.isArray(plan.argv)`·shell 추출 토큰 배열이 비어있지 않음. repo-root 경로는 `__dirname` 기준 상대(`path.resolve(__dirname, "../..")`) 또는 `process.cwd()` 로 robust 하게 해석(test 실행 cwd 무관) happy test 1+.
- [ ] **full-ordered-vector byte-identical parity 수렴(branch — 핵심 불변식, 본 task 의 새 표면)**: shell `step_eval` 에서 추출한 jest argv 토큰 배열이 `plan.argv`(helper run-branch 4-요소 ordered 벡터)와 **byte-identical**(`toEqual` — 요소값·순서·길이 1:1) 단언 1+ test. 즉 shell 사본 = helper 정본 full-vector. (substring-presence 가 아니라 ordered-vector equality — flag reorder·요소 추가/누락·값 drift 를 모두 검출.)
- [ ] **요소별 위치-정합 1:1 수렴(branch — 핵심 불변식 2)**: 추출 argv 의 `[0] === "--config"`·`[1] === REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`)·`[2] === "--runTestsByPath"`·`[3] === REALDATA_E2E_LIVE_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-live.smoke-spec.ts`)·`length === 4`, AND 각 요소가 `plan.argv[i]` 와 위치별 일치(forEach 또는 인덱스별 `toBe`) 단언 1+ test(flag↔value 페어링·길이 어긋남 0).
- [ ] **helper 상수 ↔ shell 사본 토큰 1:1 수렴(branch)**: helper export 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG` · `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` 각각이 shell 소스 텍스트에 그대로 등장(`.includes`)하고, 추출 argv 의 대응 요소와 byte-identical(`toBe`) 단언 1+ test(상수가 정본인데 shell 사본이 literal 로 박제됨을 cross-check).
- [ ] **skip-branch argv 부재 boundary 수렴(branch — REQ-059 / §9 경계)**: gating-disabled env(필수 env 7종 중 1+ 부재)로 `buildRealDataDailyStepEvalCommandPlan(env)` 호출 → `plan.action === "skip"`·`plan.argv === undefined`(명시적 부재) — shell 측도 gating 부재 시 `mark eval SKIP`(argv spawn 0) 임을 shell 소스에서 확인(`step eval: SKIP` 분기 텍스트 등장, `realdata_eval_gating_enabled` 호출부 존재) 단언 1+ test(run 분기에서만 argv 존재·skip 분기 jest spawn 0 의 정본-사본 양측 정합).
- [ ] **drift-detection 변별성 수렴(branch — 본 task 가 drift 를 실제로 잡음을 입증)**: 추출 argv 의 한 요소를 의도적으로 mutate 한 사본 배열(예: `[1]` 을 `"./test/jest.json"` 으로 교체, 또는 `[0]`·`[2]` flag 순서 swap)이 `plan.argv` 와 **byte-identical 아님**(`not.toEqual`) — 즉 본 smoke 의 parity 단언이 drift 를 검출하는 진짜 그물임을 명시(toEqual 이 reorder·값변경에 민감함을 박제). 원본 추출 argv 는 mutate 0(사본만 변형) 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외/경계 분기마다 각 1+ test:
  - **shell 파일 부재 경로** — 존재하지 않는 경로로 `readFileSync` → throw(ENOENT) 됨을 단언(본 smoke 의 파일-read 가 silent 0-byte fallback 으로 false-PASS 하지 않음을 명시; `expect(() => readFileSync(badPath, "utf8")).toThrow()`).
  - **step_eval 함수 토큰 부재 검출** — 추출 보조 함수에 `step_eval` 함수가 없는 합성 shell 문자열(예: `"#!/bin/bash\necho noop\n"`)을 주면 추출 결과가 빈 배열/undefined 이거나 추출 함수가 throw — 즉 "argv 못 찾음" 이 silent PASS 로 새지 않음 단언 1+ test(파싱 robustness — 함수 본문이 사라지면 본 smoke 가 fail 하도록).
  - **flag 누락 검출(합성)** — `--config` 만 있고 `--runTestsByPath` 가 빠진 합성 shell 문자열 → 추출 argv 가 helper 4-요소 벡터와 `not.toEqual`(길이/요소 mismatch 검출) 단언 1+ test.
  - **순서 어긋남 검출(합성)** — `--runTestsByPath <spec> --config <config>` 순서로 뒤집힌 합성 shell 문자열 → 추출 argv 가 helper 벡터와 `not.toEqual`(ordered-vector 가 순서에 민감) 단언 1+ test(substring-presence 였다면 PASS 했을 케이스가 ordered-vector parity 에서 FAIL 함을 박제 — 기존 grep -q 대비 본 smoke 의 우월성 입증).
  - **gating env 부분-부재마다 skip** — 필수 env 7종 중 서로 다른 키를 1개씩 빼는 2+ 케이스 각각에서 `plan.action === "skip"`·`plan.argv === undefined`(단일 env 부재만 단언 금지 — 여러 키 각각 cover) 단언 1+ test.
- [ ] **credential 누출 0(REQ-059 / §9)**: 합성 gating-enabled env 에 placeholder credential 을 넣었을 때, `plan.argv`(존재 시)·`plan.reason`·shell 에서 추출한 argv 어느 문자열에도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token/실 토큰 placeholder 값이 등장하지 않음을 정규식 단언 1+ test(argv 는 jest 실행 인자만·credential 은 process env 상속이라 plan/argv 에 미surface — §9·README step④ "실 credential 값은 argv 미포함" 정합).
- [ ] **결정론·no-mutation**: 동일 shell 소스·동일 env 로 추출+helper 호출을 두 번 → 추출 argv·`plan.argv` 가 두 번 byte-identical deep-equal 1+ test. AND 입력 env 객체가 `buildRealDataDailyStepEvalCommandPlan` 호출 후 mutate 0(원본 deep-equal 유지), 추출 보조 함수가 입력 shell 문자열을 mutate 0 단언 1+ test.
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper/production src 변경 0 — 본 spec 추가가 coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper export type 과 정합(특히 `RealDataDailyStepEvalCommandPlan`·`buildRealDataDailyStepEvalCommandPlan` 시그니처·`plan.action` "run"/"skip" union narrowing·`plan.argv?: string[]` optional narrowing·상수 string type·`readFileSync`/`path` node import).
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern daily-test-step-eval-shell-argv-helper-plan-full-vector-parity` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS. (파일 read 만·실 shell 실행/source/jest spawn 0.)

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only. (helper `buildRealDataDailyStepEvalCommandPlan`·상수·`RealDataDailyStepEvalCommandPlan` 은 비교 source 로 import 만 — 변경 0.)
- `deploy/daily-test.sh` **변경 0** — 읽기(readFileSync)만. step_eval 함수/argv 를 고치지 않는다(만약 drift 가 실제로 발견되면 그건 별도 fix task — 본 task 는 검증 smoke 신설만, drift 발견 시 Follow-up 에 기록).
- `deploy/daily-test-step-eval.test.sh`(T-0612 bash test) 변경/재구현 0 — 본 task 는 상보적 TS smoke 신설(bash test 의 grep -q substring-presence 를 TS full-vector parity 로 보완하되 bash test 자체는 그대로).
- 실 `deploy/daily-test.sh` **실행 / source / 실 jest spawn / 실 redeploy·health·liveness·auth step 실행** 0 — 본 smoke 는 파일 텍스트 read + helper in-memory 호출만. step_eval 의 실 동작(live smoke spawn) 검증은 본 task 범위 밖.
- helper `buildRealDataDailyStepEvalCommandPlan` 의 **조립 로직 자체·gating 판정 분기·self-assert guard 재단언** 금지(T-0736 helper smoke + consistency helper spec cover). 본 task 는 helper 산출 argv 를 expected 로 사용만(로직 재현 0).
- gating helper `resolveRealDataE2eLiveGating` 의 env 키 완전성 규칙·reason 합성 자체 재단언 금지(gating helper spec cover). 본 task 는 enabled/disabled env 합성으로 run/skip 분기 유도만.
- aggregator render-line sweep(T-0778~0789, in-memory outcomeReport.summaryLine·descriptor.body·summary·evaluation/collect-leg 내부-shape·search·resolve·marker) 재단언 금지 — 그 sweep 은 소진(T-0789 Follow-up). 본 task 는 distinct seam(shell↔TS argv drift)으로 전환했으므로 in-memory chain 합성 0.
- 실 collectForPerson 호출 / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출 0. DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free·파일 read only.
- live-LLM·실 fetch·실 gh CLI·실 collectForPerson·실 jest 프로세스 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper export 만 import. spec 로컬 보조 함수(shell 텍스트에서 step_eval argv 토큰 추출·합성 shell 문자열 생성·credential 정규식)만 허용.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. helper `buildRealDataDailyStepEvalCommandPlan` + 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`/`REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` + type `RealDataDailyStepEvalCommandPlan` 을 import 하고, node `readFileSync`/`path` 로 `deploy/daily-test.sh` 를 읽어 `step_eval()` 함수 본문에서 jest argv 토큰을 추출하는 보조 함수 작성. **핵심 새 표면 = cross-artifact(bash↔TS) full-ordered-vector parity — shell `step_eval` 이 하드코딩한 jest argv 4-요소 토큰 배열이 helper run-branch `.argv`(정본) 와 byte-identical(toEqual, 순서·길이·요소 1:1)임을 단언**, drift-detection 변별성 항(요소 mutate/reorder 사본이 not.toEqual)으로 본 smoke 가 실제 drift 를 잡는 그물임을 박제, negative 로 합성 shell 문자열(step_eval 부재·flag 누락·순서 뒤집힘)에서 추출이 helper 벡터와 not.toEqual 함을 입증(기존 grep -q substring-presence 대비 ordered-vector 의 우월성 — 순서 뒤집힘 케이스가 substring 이면 PASS·ordered-vector 면 FAIL). skip-branch 는 plan.argv===undefined·shell `mark eval SKIP` 양측 정합. **추출 정규식/슬라이스는 `deploy/daily-test.sh` 187~189행 실제 토큰(line-prefix·whitespace·`pnpm exec jest \` 다중행)으로 확인해 정확히 박제 — line continuation `\` 와 들여쓰기 drift 0**. repo-root 경로는 `path.resolve(__dirname, "../..")` 로 cwd-robust 하게. credential 은 합성 placeholder 만(§9). `realdata-e2e-daily-step-eval-command-plan-assembly` smoke(T-0736)는 helper 단독·shell Out-of-Scope 이므로 본 task 와 중복 0 — 상보적.).

## Follow-ups

(없음 — 단, 본 task 의 parity 단언이 실제로 FAIL 하면(즉 현재 `deploy/daily-test.sh` step_eval argv 가 helper 정본과 이미 drift) → 그것은 본 smoke 가 잡아낸 genuine 결함이므로 별도 fix task 로 shell 사본을 helper 정본에 맞추도록 patch 필요 — implementer/tester 가 본 task 구현 중 parity FAIL 을 관측하면 본 Follow-up 에 정확한 drift 토큰을 기록하고 driver 에 BLOCKED 보고. 정상(parity PASS)이면 Follow-up 무변. **다음 sweep 방향**: build-time 순수 seam 은 in-memory aggregator render-line(소진) + 본 cross-artifact shell↔TS argv parity 로 거의 고갈. 잔여 distinct build-time seam 후보 — (a) `deploy/daily-test.sh` 의 다른 step(redeploy/health/liveness/auth) 의 shell↔helper/endpoint-contract parity(genuine 한지 HIGH bar 재판정 필요), (b) ORDER 배열·mark/JSON 조립 shell 로직 ↔ 머신 JSON 스키마 parity. 모두 genuine seam 인지 HIGH bar 로 엄격 재판정하되, seam 이 없으면(rephrase 양산 위험) live-wiring escalate(step②/③/④ 실 wiring — credential/LAN/LLM gate BLOCKED) 또는 P5 다른 PLAN.md bullet(e2e 통합·문서·운영)로 전환 판단. make-work 양산 금지.)
