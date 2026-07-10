---
id: T-0889
title: realdata-e2e step④ deploy/daily-test.sh step_collect shell-literal jest argv ↔ buildRealDataDailyStepCollectCommandPlan run-branch argv full-ordered-vector parity drift-detection smoke — bash step_collect 가 하드코딩한 jest argv(`--config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`)가 정본 TS helper buildRealDataDailyStepCollectCommandPlan(gating-enabled env).argv 의 4-요소 ordered 벡터와 byte-identical 임을 실 shell 파일 readFileSync 로 대조하는 cross-artifact(bash↔TS) drift-detection non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-07-10T17:30:51Z
mergedAs: 09fa6054
prNumber: 783
reviewRounds: 2
commitMode: pr
coversReq: [REQ-009, REQ-013, REQ-059]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-07-11
independentStream: realdata-e2e-daily-test-step-collect-shell-argv-helper-plan-full-vector-parity-drift-smoke
dependsOn: [T-0887, T-0888]
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × T-0790 eval-leg mirror(R-112 happy·cross-artifact full-vector parity(bash step_collect 하드코딩 jest argv 4-요소 ordered 벡터 == helper run-branch argv byte-identical·순서·길이·토큰 1:1) + helper canonical-source 재유도(buildRealDataDailyStepCollectCommandPlan(enabled env).argv) + REALDATA_E2E_SMOKE_JEST_CONFIG/REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH 상수 1:1 + skip-branch argv 부재 boundary + shell 파일 readFileSync robustness + negative 분기 다수(파일 부재·step_collect 함수 부재·flag 누락 검출·순서 어긋남 검출) + credential 미surface(§9) + 결정론/no-mutation) = ~230 LOC 1파일. T-0790(230) eval-leg sibling smoke 패턴 동형 정당화(test-only·src 0·cross-artifact 변형). 신규 spec 이 파일 I/O(readFileSync) + 토큰 추출 보조 함수를 담아 T-0790 과 동급 LOC 근접이라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-step-collect-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts
plannerNote: "P5 §109 step④ — T-0888 collect bash 배선 머지 후 첫 Follow-up. eval-leg T-0790 mirror: bash step_collect 하드코딩 jest argv ↔ T-0887 helper run-branch argv full-vector byte-identical parity drift smoke. test-only 1파일, dep [T-0887,T-0888](둘 다 머지), file-disjoint."
---

# T-0889 — realdata-e2e step④ daily-test.sh step_collect shell-literal jest argv ↔ helper run-branch argv full-ordered-vector parity drift-detection non-gated build-time smoke 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5)의 step④는 `deploy/daily-test.sh` 가 nightly 로 실 github 수집 leg + 실 LLM 평가 leg 를 각 1 회 round-trip 하는 자율 실 평가 e2e 다. T-0888(PR #782, merged)이 그 수집 leg 를 배선하는 bash `step_collect()` 를 추가했고, 그 jest argv 는 **정본(canonical source)** 인 TS helper `buildRealDataDailyStepCollectCommandPlan(env).argv`(run 분기)를 손으로 mirror 한 사본이다(`deploy/daily-test.sh` 209~222행: `--config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`, 주석 211~213행이 "T-0887 plan helper 의 run argv mirror" 명시).

본 task 는 eval-leg 이 **T-0611(컴포저) → T-0612(bash 배선) → T-0790(shell↔TS full-vector parity drift smoke)** 순으로 쌓은 것과 **동형**으로, collect-leg 의 **T-0887(컴포저) → T-0888(bash 배선) → 본 task(parity drift smoke)** 를 채운다. T-0888 Follow-up 이 명시한 첫 slice 다.

사전 조사(origin/main) 결과 이 정본-사본 parity 는 현재 **약하게만** 검증된다:

- **bash test `deploy/daily-test-step-collect.test.sh`(T-0888)** 는 step_collect argv 를 substring/grep-presence 로만 검사 — argv 의 **full-ordered 벡터·요소 순서·요소 개수·flag↔value 페어링 parity 0**(토큰이 따로 등장하기만 하면 PASS, 순서 뒤집힘·flag 추가/누락 검출 못 함).
- **TS 측** 은 helper `buildRealDataDailyStepCollectCommandPlan` 을 in-memory 단독 검증(T-0887 unit)만 하고, 실 `deploy/daily-test.sh` bash 배선을 읽지 않으므로 shell 사본이 helper 정본과 어긋나는지 알 수 없다.

즉 **실 `deploy/daily-test.sh` 파일에서 `step_collect` 함수가 하드코딩한 jest argv 토큰을 추출해, 그것이 helper 의 run-branch argv 4-요소 ordered 벡터(`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`)와 byte-identical(순서·길이·토큰 1:1)인지 대조하는 smoke 가 0 부재**다. 이 drift 가 발생하면(step_collect flag reorder·config 경로 변경·helper 상수만 갱신하고 shell 미수정) **정본과 사본이 silent 하게 분기** → nightly 자율 실 평가 e2e 가 **잘못된 jest 호출** 로 수집 leg 를 돌려 무인 모니터링에 false 신호를 준다. 이는 shell↔TS 두 artifact 간 drift-detection 표면이다(REQ-009 search-or-update 멱등 e2e 가 의도대로 실행되는가의 운영 무결성).

본 task 는 그 빈 자리를 채운다 — `deploy/daily-test.sh` 를 `readFileSync` 로 읽어 `step_collect` 함수 본문에서 jest argv 토큰을 추출하고, gating-enabled env 로 `buildRealDataDailyStepCollectCommandPlan(env)` 를 호출해 그 `.argv`(run 분기, 4-요소 ordered 벡터)를 expected 로 삼아 shell 사본 ↔ helper 정본의 **full-ordered-vector byte-identical parity** 를 단언한다. live leg(실 collectForPerson·실 github.com fetch·실 jest spawn) 복제 0·non-gated 항상 실행 — 순수 build-time 검증만(파일 read + in-memory helper 호출). `deploy/daily-test.sh` 는 읽기만 하고 실행/source 0.

## Required Reading

- `deploy/daily-test.sh` — **본 task 의 핵심 검증 대상(사본)**. `step_collect()` 함수(209~222행)가 하드코딩한 jest argv: `pnpm exec jest --config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`(214~216행, line-continuation `\` 다중행) + 정본 명시 주석(211~213행). 본 task 가 `readFileSync` 로 읽어 step_collect 함수 본문에서 argv 토큰(`--config`·config 경로·`--runTestsByPath`·spec 경로)을 추출하는 정확한 source — **추출 정규식/슬라이스는 이 파일의 실제 토큰(line-prefix·whitespace·`pnpm exec jest \` 다중행 continuation)으로 확인해 박제(drift 0)**. `ORDER=(redeploy health liveness auth eval collect)`(230행)·`mark collect SKIP` 분기(299·304행)도 skip-branch 정합 확인용.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` (T-0887) — **본 task 의 정본(canonical source)**. `buildRealDataDailyStepCollectCommandPlan(env)`(82행~)의 run 분기 argv = `["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`(4-요소 ordered, 99~105행) + skip 분기 argv undefined(91행) + 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`, 45행) · `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`, 40행) + `RealDataDailyStepCollectCommandPlan` interface({action, argv?, reason}). 본 task 가 import 해 gating-enabled env 로 호출, run-branch `.argv` 를 expected ordered 벡터로 사용. (시그니처·상수값·argv 요소 순서 파일로 확인.)
- `test/helpers/realdata-e2e-live-gating.ts` (`resolveRealDataE2eLiveGating` 정의 파일 — 위 컴포저의 import 로 경로 확인) — gating 판정 helper. 본 task 가 **gating-enabled(7종 env 모두 set)** 와 **gating-disabled(일부 부재)** env 를 합성해 helper 의 run/skip 분기를 각각 유도하는 데 필요. (필수 env 키 7종 이름·완전성 규칙 파일로 확인 — 실 credential 값은 합성 placeholder 만, §9.)
- `test/smoke/realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts` (T-0790) — **eval-leg 의 동형 정본 패턴**. 본 task 는 이 spec 을 그대로 mirror 하되 (a) helper 를 `buildRealDataDailyStepCollectCommandPlan` 으로, (b) 상수를 `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` 로, (c) shell 추출 대상을 `step_collect` 함수로, (d) spec 경로를 collection smoke 로 교체한다. readFileSync robustness·토큰 추출 보조 함수·drift-detection 변별성 항·negative 합성 shell 문자열 패턴을 재사용. (구조·assertion 스타일은 이 파일로 확인 — 중복 0, collect-leg 대칭.)
- `deploy/daily-test-step-collect.test.sh` (T-0888) — bash executable 단위 test. **본 task 와의 경계 확인용**: 이 test 는 step_collect argv 를 substring-presence 로만 검사 — full-ordered-vector·순서·길이 parity 0. 본 task 는 그것을 TS 측에서 full-vector byte-identical 로 확장(distinct — substring vs ordered-vector). (본 task 가 이 bash test 를 변경/재구현하지 않음 — 상보적 TS smoke.)

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-daily-test-step-collect-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time 파일 read + in-memory helper 호출 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path: shell argv 추출 + helper run-branch argv 산출**: `readFileSync(path.resolve(__dirname, "../../deploy/daily-test.sh"), "utf8")` 로 shell 소스를 읽어 `step_collect()` 함수 본문에서 jest argv 토큰(`--config`·config 경로·`--runTestsByPath`·spec 경로)을 추출하는 보조 함수 + gating-enabled env(7종 모두 set, credential 은 합성 placeholder)로 `const plan = buildRealDataDailyStepCollectCommandPlan(env)` 호출 → `plan.action === "run"`·`Array.isArray(plan.argv)`·shell 추출 토큰 배열이 비어있지 않음. repo-root 경로는 `__dirname` 기준 상대로 cwd-robust 하게 해석(test 실행 cwd 무관) happy test 1+.
- [ ] **full-ordered-vector byte-identical parity 수렴(branch — 핵심 불변식, 본 task 의 새 표면)**: shell `step_collect` 에서 추출한 jest argv 토큰 배열이 `plan.argv`(helper run-branch 4-요소 ordered 벡터)와 **byte-identical**(`toEqual` — 요소값·순서·길이 1:1) 단언 1+ test. 즉 shell 사본 = helper 정본 full-vector. (substring-presence 가 아니라 ordered-vector equality — flag reorder·요소 추가/누락·값 drift 를 모두 검출.)
- [ ] **요소별 위치-정합 1:1 수렴(branch — 핵심 불변식 2)**: 추출 argv 의 `[0] === "--config"`·`[1] === REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`)·`[2] === "--runTestsByPath"`·`[3] === REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`)·`length === 4`, AND 각 요소가 `plan.argv[i]` 와 위치별 일치(forEach 또는 인덱스별 `toBe`) 단언 1+ test(flag↔value 페어링·길이 어긋남 0).
- [ ] **helper 상수 ↔ shell 사본 토큰 1:1 수렴(branch)**: helper export 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG` · `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` 각각이 shell 소스 텍스트에 그대로 등장(`.includes`)하고, 추출 argv 의 대응 요소와 byte-identical(`toBe`) 단언 1+ test(상수가 정본인데 shell 사본이 literal 로 박제됨을 cross-check).
- [ ] **skip-branch argv 부재 boundary 수렴(branch — REQ-059 / §9 경계)**: gating-disabled env(필수 env 7종 중 1+ 부재)로 `buildRealDataDailyStepCollectCommandPlan(env)` 호출 → `plan.action === "skip"`·`plan.argv === undefined`(명시적 부재) — shell 측도 gating 부재 시 `mark collect SKIP`(argv spawn 0) 임을 shell 소스에서 확인(`mark collect SKIP` 분기 텍스트 등장, `realdata_eval_gating_enabled` 호출부/`ORDER` 의 collect 항목 존재) 단언 1+ test(run 분기에서만 argv 존재·skip 분기 jest spawn 0 의 정본-사본 양측 정합).
- [ ] **drift-detection 변별성 수렴(branch — 본 task 가 drift 를 실제로 잡음을 입증)**: 추출 argv 의 한 요소를 의도적으로 mutate 한 사본 배열(예: `[1]` 을 `"./test/jest.json"` 으로 교체, 또는 `[0]`·`[2]` flag 순서 swap)이 `plan.argv` 와 **byte-identical 아님**(`not.toEqual`) — 즉 본 smoke 의 parity 단언이 drift 를 검출하는 진짜 그물임을 명시. 원본 추출 argv 는 mutate 0(사본만 변형) 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외/경계 분기마다 각 1+ test:
  - **shell 파일 부재 경로** — 존재하지 않는 경로로 `readFileSync` → throw(ENOENT) 됨을 단언(본 smoke 의 파일-read 가 silent 0-byte fallback 으로 false-PASS 하지 않음; `expect(() => readFileSync(badPath, "utf8")).toThrow()`).
  - **step_collect 함수 토큰 부재 검출** — 추출 보조 함수에 `step_collect` 함수가 없는 합성 shell 문자열(예: `"#!/bin/bash\necho noop\n"`)을 주면 추출 결과가 빈 배열/undefined 이거나 추출 함수가 throw — 즉 "argv 못 찾음" 이 silent PASS 로 새지 않음 단언 1+ test(파싱 robustness — 함수 본문이 사라지면 본 smoke 가 fail 하도록).
  - **flag 누락 검출(합성)** — `--config` 만 있고 `--runTestsByPath` 가 빠진 합성 shell 문자열 → 추출 argv 가 helper 4-요소 벡터와 `not.toEqual`(길이/요소 mismatch 검출) 단언 1+ test.
  - **순서 어긋남 검출(합성)** — `--runTestsByPath <spec> --config <config>` 순서로 뒤집힌 합성 shell 문자열 → 추출 argv 가 helper 벡터와 `not.toEqual`(ordered-vector 가 순서에 민감) 단언 1+ test(substring-presence 였다면 PASS 했을 케이스가 ordered-vector parity 에서 FAIL 함을 박제 — 기존 substring 대비 본 smoke 의 우월성 입증).
  - **eval-leg spec 교차오염 검출(합성)** — 추출 argv 의 spec 요소가 eval-leg spec(`test/smoke/realdata-e2e-live.smoke-spec.ts`)로 잘못 박제된 합성 shell 문자열 → collect helper 벡터와 `not.toEqual`(collect 사본이 collection spec 을 정확히 가리켜야 함, 두 leg argv 가 spec 경로만 다름을 교차오염 0 으로 박제) 단언 1+ test.
  - **gating env 부분-부재마다 skip** — 필수 env 7종 중 서로 다른 키를 1개씩 빼는 2+ 케이스 각각에서 `plan.action === "skip"`·`plan.argv === undefined`(단일 env 부재만 단언 금지 — 여러 키 각각 cover) 단언 1+ test.
- [ ] **credential 누출 0(REQ-059 / §9)**: 합성 gating-enabled env 에 placeholder credential 을 넣었을 때, `plan.argv`(존재 시)·`plan.reason`·shell 에서 추출한 argv 어느 문자열에도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token/실 토큰 placeholder 값이 등장하지 않음을 정규식 단언 1+ test(argv 는 jest 실행 인자만·credential 은 process env 상속이라 plan/argv 에 미surface).
- [ ] **결정론·no-mutation**: 동일 shell 소스·동일 env 로 추출+helper 호출을 두 번 → 추출 argv·`plan.argv` 가 두 번 byte-identical deep-equal 1+ test. AND 입력 env 객체가 `buildRealDataDailyStepCollectCommandPlan` 호출 후 mutate 0(원본 deep-equal 유지), 추출 보조 함수가 입력 shell 문자열을 mutate 0 단언 1+ test.
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper/production src 변경 0 — 본 spec 추가가 coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper export type 과 정합(특히 `RealDataDailyStepCollectCommandPlan`·`buildRealDataDailyStepCollectCommandPlan` 시그니처·`plan.action` "run"/"skip" union narrowing·`plan.argv?: string[]` optional narrowing·상수 string type·`readFileSync`/`path` node import).
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern daily-test-step-collect-shell-argv-helper-plan-full-vector-parity` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS. (파일 read 만·실 shell 실행/source/jest spawn 0.)

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only. (helper `buildRealDataDailyStepCollectCommandPlan`·상수·`RealDataDailyStepCollectCommandPlan` 은 비교 source 로 import 만 — 변경 0.)
- `deploy/daily-test.sh` **변경 0** — 읽기(readFileSync)만. step_collect 함수/argv 를 고치지 않는다(만약 drift 가 실제로 발견되면 그건 별도 fix task — 본 task 는 검증 smoke 신설만, drift 발견 시 Follow-up 에 기록).
- `deploy/daily-test-step-collect.test.sh`(T-0888 bash test) 변경/재구현 0 — 본 task 는 상보적 TS smoke 신설(bash test 의 substring-presence 를 TS full-vector parity 로 보완하되 bash test 자체는 그대로).
- 실 `deploy/daily-test.sh` **실행 / source / 실 jest spawn / 실 redeploy·health·liveness·auth·eval·collect step 실행** 0 — 본 smoke 는 파일 텍스트 read + helper in-memory 호출만. step_collect 의 실 동작(live collection smoke spawn) 검증은 본 task 범위 밖.
- helper `buildRealDataDailyStepCollectCommandPlan` 의 **조립 로직 자체·gating 판정 분기 재단언** 금지(T-0887 helper unit cover). 본 task 는 helper 산출 argv 를 expected 로 사용만(로직 재현 0).
- gating helper `resolveRealDataE2eLiveGating` 의 env 키 완전성 규칙·reason 합성 자체 재단언 금지(gating helper spec cover). 본 task 는 enabled/disabled env 합성으로 run/skip 분기 유도만.
- collection-leg **command-plan consistency 가드**(eval-leg T-0693→T-0694 mirror) 신설 금지 — T-0888 Follow-up 의 별도 후속 slice. 본 task 는 shell↔TS full-vector parity drift smoke 만.
- 실 collectForPerson 호출 / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출 0. DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free·파일 read only.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper export 만 import. spec 로컬 보조 함수(shell 텍스트에서 step_collect argv 토큰 추출·합성 shell 문자열 생성·credential 정규식)만 허용.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. eval-leg T-0790 spec 을 정본 패턴으로 mirror — helper `buildRealDataDailyStepCollectCommandPlan` + 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`/`REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` + type `RealDataDailyStepCollectCommandPlan` 을 import 하고, node `readFileSync`/`path` 로 `deploy/daily-test.sh` 를 읽어 `step_collect()` 함수 본문에서 jest argv 토큰을 추출하는 보조 함수 작성. **핵심 새 표면 = cross-artifact(bash↔TS) full-ordered-vector parity — shell `step_collect` 이 하드코딩한 jest argv 4-요소 토큰 배열이 helper run-branch `.argv`(정본) 와 byte-identical(toEqual, 순서·길이·요소 1:1)임을 단언**, drift-detection 변별성 항(요소 mutate/reorder 사본이 not.toEqual), negative 로 합성 shell 문자열(step_collect 부재·flag 누락·순서 뒤집힘·eval-leg spec 교차오염)에서 추출이 helper 벡터와 not.toEqual 함을 입증. 추출 정규식/슬라이스는 `deploy/daily-test.sh` 214~216행 실제 토큰(line continuation `\` 다중행·들여쓰기)으로 확인해 정확히 박제. repo-root 경로는 `path.resolve(__dirname, "../..")` 로 cwd-robust 하게. credential 은 합성 placeholder 만(§9).)

## Follow-ups

(없음 — 단, 본 task 의 parity 단언이 실제로 FAIL 하면(즉 현재 `deploy/daily-test.sh` step_collect argv 가 helper 정본과 이미 drift) → 그것은 본 smoke 가 잡아낸 genuine 결함이므로 별도 fix task 로 shell 사본을 helper 정본에 맞추도록 patch 필요 — implementer/tester 가 본 task 구현 중 parity FAIL 을 관측하면 본 Follow-up 에 정확한 drift 토큰을 기록하고 driver 에 BLOCKED 보고. 정상(parity PASS)이면 Follow-up 무변. **다음 collect-leg slice**: (a) collection-leg command-plan consistency 가드 + self-wire(eval-leg T-0693→T-0694 mirror), (b) PLAN 109행 closure 후 P5 잔여 갭 — R-9 사용자 지정 기간 평가문(bullet 98)·R-61 일/주/월 요약 평가(bullet 97)·timezone KST(bullet 110, ADR-first). live-wiring(실 credential 주입 nightly 발화)은 credential/LAN gate 로 BLOCKED — 별도 슬라이스.)
