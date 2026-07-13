---
id: T-0947
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **step-chaining SKIP-propagation gate cascade** 를 정적 검증하는 non-gated build-time smoke — 선행 체인이 끊긴 downstream step 은 **절대 PASS/FAIL 이 아니라 SKIP** 으로 표기됨(무인 모니터링 false 신호 차단)을 봉함. cascade 계약: **(a) `SKIP_REDEPLOY=1` → redeploy SKIP**(281행, "PASS" 와 구별 — 실행 성공 아님) · **(b) redeploy FAIL → health SKIP**(291행 `[ "${STEP_STATUS[redeploy]}" != "FAIL" ]` gate — SKIP·PASS 는 non-FAIL 이라 health 진행) · **(c) health != PASS → liveness+auth 둘 다 SKIP**(297행 `[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]` gate — health SKIP/FAIL 시 둘 SKIP) · **(d) auth != PASS → eval·collect·rediscovery 3종 SKIP**(308/326/345행 `[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]` gate) · **(e) auth PASS + gating 부재 → eval·collect·rediscovery SKIP**(311/329/348행 `! realdata_eval_gating_enabled`). 불변식: downstream step 은 precondition 미충족 시 항상 SKIP(never PASS/FAIL) — false-positive nightly 신호 차단. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/HTTP/spawn 0) cascade gate 표현(281/291/297/308/326/345/311/329/348행)을 정적 추출 + TS 동형 `computeChainedStatuses` 로 SKIP-propagation 불변식 assert. T-0944(집계 값 aggregate)·T-0791(schema)·T-0945(방출)·T-0946(prune)가 미cover 한 **cascade gate → 어떤 status 가 발생하는가** gap 상보 표면. 실 redeploy/HTTP/jest spawn/gh/git 0·process.env/gating 실행 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: DONE
mergedAs: 81f6a97d
prNumber: 841
reviewRounds: 1
completedAt: 2026-07-13T08:07:13Z
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-step-chain-skip-propagation-gate-cascade-downstream-never-passfail-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-step-chain-cascade
plannerNote: P5 §109 step④ — T-0946 이 로그 prune 을 봉한 뒤, 무인 모니터링이 파싱하는 step status 를 산출하는 cascade gate(redeploy FAIL→health SKIP→liveness/auth SKIP→eval/collect/rediscovery SKIP·SKIP_REDEPLOY 는 non-FAIL·gating 부재 SKIP)의 SKIP-propagation 불변식을 정적 smoke 로 봉함. T-0944(집계 값) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬.
---

# T-0947 — realdata-e2e nightly step-chaining SKIP-propagation gate cascade 정적 smoke (downstream 은 precondition 미충족 시 절대 PASS/FAIL 아닌 SKIP)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 머신 요약 JSON(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)을 방출하고 **로컬 PC 의 무인 모니터링 routine 이 그 결과를 파싱**해 nightly 상태를 판단하는 것을 명시한다. 그 JSON 의 `steps` object 는 7 step(`redeploy`·`health`·`liveness`·`auth`·`eval`·`collect`·`rediscovery`) 각각의 `PASS`/`FAIL`/`SKIP` 상태를 담는데, 이 상태들은 runner 실행 블록(279~357행)의 **step-chaining gate cascade** 로부터 산출된다:

- **(a) `SKIP_REDEPLOY=1` → redeploy SKIP**(281~283행) — 디버깅/이미 배포된 상태 테스트 시 redeploy 를 실행하지 않고 **SKIP** 으로 표기한다. 주석(280행)이 명시하듯 이는 실행 성공 `"PASS"` 와 **구별**돼야 한다(무인 모니터링에 false 신호 방지).
- **(b) redeploy FAIL → health SKIP**(291행 gate `[ "${STEP_STATUS[redeploy]}" != "FAIL" ]`) — redeploy 가 FAIL 이면 health 를 실행하지 않고 SKIP. redeploy 가 **PASS 또는 SKIP** 이면(둘 다 non-FAIL) health 진행.
- **(c) health != PASS → liveness+auth 둘 다 SKIP**(297행 gate `[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]`) — health 가 PASS 일 때만 liveness·auth 를 실행하고, health 가 SKIP/FAIL 이면 **둘 다** SKIP.
- **(d) auth != PASS → eval·collect·rediscovery 3종 SKIP**(308/326/345행 gate `[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]`) — 선행 체인(auth)이 PASS 가 아니면 realdata-e2e 3 leg 모두 SKIP.
- **(e) auth PASS + gating 부재 → eval·collect·rediscovery SKIP**(311/329/348행 `! realdata_eval_gating_enabled`) — auth 가 PASS 라도 gating env 7 종이 없으면(cloud CI / 일반 LAN) 3 leg 모두 SKIP(네트워크 0 / secret 0 / jest spawn 0 no-op).

이 cascade 전체를 관통하는 **불변식**: **downstream step 은 자신의 precondition 체인이 끊기면 절대 `PASS`/`FAIL` 로 표기되지 않고 항상 `SKIP` 이다.** 이 불변식이 무인 nightly 운영의 신뢰성 핵심이다 — 만약 liveness 가 health 미성공 상태에서 실행돼 우연히 PASS 를 냈다면 무인 모니터링은 "앱 정상"이라는 false-positive 신호를 받는다. cascade 는 그 false 신호를 구조적으로 차단한다.

그러나 이 **cascade gate → 어떤 status 가 발생하는가** 계약은 origin/main 시점에 검증 0 부재다: T-0944 는 **이미 산출된 profile 을 입력받아** `result`/`failedStep` 을 **집계**하는 `aggregate(profile, ORDER)` 만 봉했다(profile 이 **어떻게 만들어지는가**는 다루지 않음). T-0791 은 머신-JSON printf **템플릿 스키마·order**만, T-0945 는 **방출 경로**만, T-0946 은 **로그 prune**만 봉했다. 어느 것도 **step-chaining gate 가 선행 실패/SKIP 을 어떻게 downstream SKIP 으로 전파하는가**(SKIP-propagation cascade)는 다루지 않는다. 만약 누군가 redeploy gate 를 `!= "FAIL"` 에서 `== "PASS"` 로 좁히거나(→ SKIP_REDEPLOY 경로에서 health 가 잘못 SKIP), health gate 의 `:-SKIP` default 를 떨어뜨리거나(→ set -u 하 unbound 회귀), auth gate 의 3 leg 중 하나를 빠뜨리거나(→ gating 부재에도 leg 실행 시도로 network/secret 노출), SKIP_REDEPLOY 를 `mark redeploy PASS` 로 바꾸면(→ 실행 안 한 redeploy 를 성공으로 false 보고) — 무인 nightly 운영은 false-positive/false-negative 신호의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0944/T-0945/T-0946 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + TS 동형 모델 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 cascade gate 표현(281/291/297/308/326/345행 + 311/329/348행 gating 분기)을 정적 추출하고, TS 동형 `computeChainedStatuses(outcomes, opts)` 로 5 종 gate 계약과 SKIP-propagation 불변식(downstream 은 precondition 미충족 시 never PASS/FAIL)을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git 0. process.env 읽기 0 / gating 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). cascade 는 TS 로 **동형 모델링**할 뿐 실 bash 실행 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). write 명령(`gh issue create|edit`) 무관 — 본 smoke 는 step 상태 산출 cascade semantics 만 검증하며 write step_report(ADR-0045 deferred)와 독립. production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 cascade contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — 실행 블록/gate 표현 미수정, drift 발견 시 별도 fix task). T-0944 표면 재단언 0(T-0944 는 profile→result/failedStep **집계**, 본 task 는 outcomes→profile **cascade gate** — distinct surface). T-0791/T-0945/T-0946 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): T-0944 spec 은 `aggregate(profile, ORDER)`(profile 입력 → result/failedStep 산출) 만 모델링 — 선행 체인이 profile 을 **어떻게 산출하는가**(cascade gate)는 미cover 확정(grep `선행 체인|STEP_STATUS\[redeploy\]|SKIP_REDEPLOY|cascade` on test/smoke 결과 T-0944 는 aggregate 만·chaining gate 부재). `deploy/daily-test.sh` 는 현재 281행 `[ "$SKIP_REDEPLOY" = "1" ]`, 291행 `[ "${STEP_STATUS[redeploy]}" != "FAIL" ]`, 297행 `[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]`, 308/326/345행 `[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]`, 311/329/348행 `! realdata_eval_gating_enabled` — 본 smoke 가 이 gate 앵커들을 잡고 SKIP-propagation cascade 를 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ 머신 요약 JSON = 무인 모니터링 contract, step status 산출 cascade)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 cascade gate 앵커를 정확히 추출·검증:
  - 279~288행 redeploy 분기 — `if [ "$SKIP_REDEPLOY" = "1" ]; then ... mark redeploy SKIP; elif step_redeploy; then mark redeploy PASS; else mark redeploy FAIL`. **SKIP_REDEPLOY=1 → SKIP(not PASS)** 앵커.
  - 291~295행 health gate — `if [ "${STEP_STATUS[redeploy]}" != "FAIL" ]; then ... else mark health SKIP`. **redeploy FAIL → health SKIP·redeploy SKIP/PASS(non-FAIL) → health 진행** 앵커.
  - 297~303행 liveness+auth gate — `if [ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]; then ... else mark liveness SKIP; mark auth SKIP`. **health != PASS → liveness+auth 둘 다 SKIP** + `:-SKIP` default(set -u guard) 앵커.
  - 308~320행 eval gate — `if [ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]; then mark eval SKIP; elif ! realdata_eval_gating_enabled; then mark eval SKIP; elif step_eval; then mark eval PASS; else mark eval FAIL`. **auth != PASS → SKIP · gating 부재 → SKIP** 앵커.
  - 326~338행 collect gate·345~357행 rediscovery gate — eval 과 **동형 3중 분기**(auth != PASS → SKIP / gating 부재 → SKIP / run). 3 leg 모두 동일 gate 임을 앵커.
  - 259행 `ORDER=(redeploy health liveness auth eval collect rediscovery)` + 257행 `declare -A STEP_STATUS=()` + 261~266행 `mark()` — step 이름 순서 · 상태 저장 source.
- `test/smoke/realdata-e2e-daily-test-machine-result-status-aggregation-skip-nonfailing-failedstep-firstwins-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0944)**. readFileSync + 정적 텍스트 추출 + TS 동형 모델(`aggregate`) + mutant 사본 변별 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 `aggregate`(profile→result/failedStep 집계)를 재단언하지 않고**(그건 T-0944 소관), **`computeChainedStatuses`(outcomes→profile cascade gate)** 라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-step-chain-skip-propagation-gate-cascade-downstream-never-passfail-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) cascade gate 표현(281/291/297/308/326/345/311/329/348행)을 정적 추출하고, TS 동형 `computeChainedStatuses(outcomes, opts)` 로 5 종 gate 계약과 SKIP-propagation 불변식(downstream 은 precondition 미충족 시 never PASS/FAIL)을 assert 한다. non-gated(describe.skip 0, process.env/gating 실행 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — 전부 성공 경로** — outcomes 가 redeploy=PASS·health=PASS·liveness=PASS·auth=PASS·gating=enabled·eval/collect/rediscovery run=PASS 일 때 `computeChainedStatuses` 가 7 step 모두 PASS profile 을 산출함을 assert(정상 nightly).
- [ ] **happy-path — cascade gate 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 5 종 gate 표현(SKIP_REDEPLOY 분기·`[ "${STEP_STATUS[redeploy]}" != "FAIL" ]`·`[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]`·`[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]`×3·`! realdata_eval_gating_enabled`×3)가 실 소스에 존재함을 정적 assert(TS 모델이 실 bash gate 를 mirror 함을 앵커).
- [ ] **happy-path — SKIP_REDEPLOY=1 → redeploy SKIP(not PASS)** — `computeChainedStatuses(outcomes, { skipRedeploy: true })` 가 redeploy=SKIP 을 산출하고(281행 gate), 이후 health gate 가 redeploy 를 **non-FAIL** 로 취급해 health 진행함을 assert(SKIP≠PASS 이지만 둘 다 non-FAIL). 소스에서 SKIP_REDEPLOY 분기가 `mark redeploy SKIP`(not `mark redeploy PASS`)임을 정적 확인.
- [ ] **branch — redeploy FAIL → health SKIP → 전 downstream SKIP** — outcomes redeploy=FAIL 이면 health=SKIP 이고, 연쇄로 liveness·auth·eval·collect·rediscovery 전부 SKIP 임을 assert(291/297/308 gate 전파). redeploy 만 FAIL, 나머지 downstream 은 절대 PASS/FAIL 아님.
- [ ] **branch — health FAIL/SKIP → liveness+auth 둘 다 SKIP** — outcomes redeploy=PASS·health=FAIL(또는 health 미실행 SKIP) 이면 liveness·auth **둘 다** SKIP 이고, 그 결과 eval/collect/rediscovery 도 SKIP 임을 assert(297행 gate 는 health==PASS 일 때만 liveness+auth 진행).
- [ ] **branch — auth FAIL → eval·collect·rediscovery 3종 SKIP** — outcomes 앞 체인 PASS·auth=FAIL 이면 eval·collect·rediscovery 3 leg 모두 SKIP 임을 assert(308/326/345 gate). 3 leg 이 **동일** gate(auth != PASS)에 걸림을 3개 각각 확인.
- [ ] **branch — auth PASS + gating 부재 → eval·collect·rediscovery SKIP** — outcomes auth=PASS 이지만 `gatingEnabled: false` 면 eval·collect·rediscovery 3 leg 모두 SKIP 임을 assert(311/329/348 `! realdata_eval_gating_enabled` gate). auth PASS 만으로는 leg 실행에 불충분(gating 도 필요)함을 실증.
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0944 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — cascade gate 앵커 부재 시 명시적 실패** — 추출 보조 함수가 5 종 gate 표현 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 배열/undefined 를 pass 로 오통과 0). gate 추출이 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **downstream never PASS/FAIL 불변식 위반 변별** — cascade gate 를 위반하도록 mutate 한 TS 모델 사본(예: health 미PASS 인데 liveness 를 run 시키는 mutant)에서 "precondition 끊긴 downstream 은 SKIP" 불변식 assert 가 실패함을 실증(본 smoke 가 실제로 false-positive 회귀를 잡음을 입증). 원본 모델/소스 mutate 0.
  - (b) **SKIP_REDEPLOY → PASS drift 변별** — 소스에서 `mark redeploy SKIP`(281~283행)을 `mark redeploy PASS` 로 치환한 mutant 사본에서 "SKIP_REDEPLOY 경로는 SKIP(not PASS)" assert 가 실패함을 assert(실행 안 한 redeploy 를 성공으로 false 보고하는 회귀 검출). 원본 문자열 mutate 0 — 사본에만 주입.
  - (c) **redeploy gate 축소 drift 변별** — health gate 를 `!= "FAIL"` 에서 `== "PASS"` 로 좁힌 mutant 사본에서 "redeploy SKIP(SKIP_REDEPLOY 경로) → health 진행" assert 가 실패함을 assert(SKIP 을 non-FAIL 로 취급하는 계약 고정).
  - (d) **auth gate leg 누락 drift 변별** — eval/collect/rediscovery 3 gate 중 하나에서 `auth != PASS` 검사를 제거한 mutant 사본에서 "auth FAIL → 해당 leg SKIP" assert 가 실패함을 assert(gating/체인 부재에도 leg 실행 시도로 network/secret 노출되는 회귀 검출).
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(gate 표현·step 이름·profile)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 미등장(§9 / REQ-059). gating env 이름(`REALDATA_E2E_*`)은 이름만 등장 가능(실값 0).
- [ ] **flow — 결정론·no-mutation** — 동일 outcomes 입력으로 `computeChainedStatuses` 를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 gate 추출을 두 번 하면 deep-equal. 모델/추출 보조 함수가 입력(outcomes 객체·shell 문자열 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0, gating 분기 실행 0(gating 은 TS 모델 파라미터로만 표현 — 실 env 검사 0). 실 redeploy·HTTP·jest spawn·gh·git·bash 실행 0(파일 read + 정적 텍스트 추출 + TS 동형 모델만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. 실행 블록(279~357행)·cascade gate 표현·`mark`·`ORDER` 미수정(drift 발견 시 별도 fix task). cascade 를 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + TS 동형 모델로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0944 표면 재단언 금지** — profile→`result`/`failedStep` **집계**(`aggregate`)는 T-0944 소관. 본 task 는 outcomes→profile **cascade gate**(`computeChainedStatuses`)라는 distinct surface 만. T-0944 spec 파일 변경 0. 집계 값(first-FAIL-wins / SKIP 비-failing) 재검증 0.
- **T-0791/T-0945/T-0946 표면 재단언 금지** — 6-키 스키마·order(T-0791), dual-sink 방출(T-0945), 로그 prune(T-0946)은 각 소관. 본 task 는 **step-chaining SKIP-propagation cascade** distinct surface 만. 해당 spec 파일들 변경 0.
- **gating helper 내부 재검증 금지** — `realdata_eval_gating_enabled` 의 7-env non-blank trim 판정 내부는 T-0612 계열 bash executable spec 소관. 본 task 는 cascade 에서 gating 을 **boolean 결과**(enabled/disabled)로만 취급(gating→leg SKIP 전파). gating 내부 로직 재검증 0.
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read + TS 모델 only. gating env / process.env / 실 gh / 실 jest spawn / 실 git / 실 bash 실행 도입 0. T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0944 aggregation smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 5 종 cascade gate 표현(281/291/297/308+326+345/311+329+348행)을 정적 앵커로 추출 + TS 동형 `computeChainedStatuses(outcomes, opts)` 로 SKIP-propagation 불변식(downstream 은 precondition 미충족 시 never PASS/FAIL) assert. happy(전부 PASS·SKIP_REDEPLOY SKIP)/branch(redeploy FAIL→전 downstream SKIP·health FAIL→liveness+auth SKIP·auth FAIL→3 leg SKIP·gating 부재→3 leg SKIP)/error(파일 부재·앵커 부재)/negative(불변식 위반·SKIP→PASS drift·gate 축소·leg 누락·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 실행 0, credential placeholder 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
