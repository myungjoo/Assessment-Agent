---
id: T-0955
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **step_redeploy() 재배포 서브스크립트 호출 계약**을 정적 검증하는 non-gated build-time smoke — step 1(redeploy) 이 `REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1` 로 배포 체크아웃 하위의 `deploy/redeploy.sh` 를 bash 로 호출하되 REPO_DIR 을 자식 env 로 threading 하고 자식의 stdout+stderr 를 append(`>>`)로 LOG_FILE 에 병합(`2>&1`)해 스크립트 bare-stdout(387행 cat 유일 emitter)을 오염시키지 않으며, 자식 exit code 로 return 0(OK)/return 1(FAIL) 분기하고 시작·성공·실패 진단을 log()(stderr+file, bare-stdout 아님)로 방출함을 봉함 — 두 shared helper(T-0953 log·T-0954 curl_code)를 봉한 뒤 남은 마지막 step 함수(step 1 redeploy)의 내부 호출 계약. 계약 (a) **REPO_DIR env-prefix threading**(71행 `REPO_DIR="$REPO_DIR" bash ...` — REPO_DIR 을 자식 redeploy.sh 의 env 로 명시 전달, 자식이 동일 체크아웃 인식) · (b) **bash interpreter + REPO_DIR-relative 경로**(`bash "$REPO_DIR/deploy/redeploy.sh"` — 재배포 오케스트레이터를 REPO_DIR 하위 정확 경로로 bash 호출) · (c) **append redirect + stderr 병합**(`>>"$LOG_FILE" 2>&1` — 자식 stdout+stderr 를 truncate 아닌 append 로 LOG_FILE 에 병합, 진행 로그 보존) · (d) **stdout 순수성 보증**(자식 출력이 LOG_FILE 로 가고 스크립트 bare-stdout 으로 새지 않음 — 유일 bare-stdout emitter 는 387행 `cat "$RESULT_JSON"`, T-0953/T-0954 상보) · (e) **exit-code → return 분기**(`if ... then log OK; return 0; else log FAIL; return 1` — 자식 성공 시 0·실패 시 1) · (f) **진단 log() 라우팅**(70·72·75행 "step redeploy: 실행/OK/FAIL" 이 log() 경유 stderr+file, bare-stdout 아님). 불변식: step_redeploy 는 REPO_DIR 을 env 로 threading 한 채 `$REPO_DIR/deploy/redeploy.sh` 를 bash 로 호출하고 자식의 stdout+stderr 를 append 로 LOG_FILE 에 병합(스크립트 stdout 순수성 유지)하며 자식 exit code 로 0/1 을 반환하되 시작·성공·실패 진단을 log()(stderr+file)로만 방출한다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) step_redeploy 유도 표현(69~77행 정의)을 정적 추출 + 호출 동형 pure 함수(`buildRedeployInvocation`·`redeployInvocationContract`·`redeployReturnBranch`)로 REPO_DIR-threading·bash-호출·append-redirect·stderr-병합·stdout-순수성·exit-code-분기 불변식 assert. T-0953(log() 진행 로그 라우팅 — redeploy 서브스크립트 호출 제외)·T-0954(curl_code HTTP status 헬퍼 — redeploy 무관)·T-0947(SKIP-propagation cascade — redeploy PASS/FAIL/SKIP 의 *downstream* 전파만, 내부 호출 배선 아님)·redeploy-orchestration-entrypoint spec(redeploy.sh *자신*의 systemd/경로 entrypoint 계약 — daily-test 의 호출 측 아님) 가 미cover 한 **step_redeploy 호출 계약** gap 상보 표면. 실 redeploy 실행·실 bash·실 배포·gh·git 0·process.env 읽기 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 360
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-step-redeploy-invocation-repo-dir-env-thread-log-redirect-append-stdout-purity-return-code-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-step-redeploy-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0954) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(REPO_DIR env-threading + bash-호출 + append-redirect + stderr-병합 + stdout-순수성 + exit-code-분기 + log() 진단)의 happy/branch/error/negative full cover 에 ~360 LOC 필요, T-0954/T-0953 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step① — T-0953 log()·T-0954 curl_code 두 shared helper 봉함 뒤, 남은 마지막 step 함수 step_redeploy() 의 재배포 서브스크립트 호출 계약(REPO_DIR env-threading·bash-호출·append-redirect·stderr-병합·stdout-순수성·exit-code-분기)을 정적 smoke 로 봉함. redeploy-orchestration(redeploy.sh 자신 entrypoint)/T-0947(cascade downstream) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0955 — realdata-e2e nightly step_redeploy() 재배포 서브스크립트 호출 계약 정적 smoke (`REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1` · exit-code → return 0/1 · stdout 순수성)

## Why

`deploy/daily-test.sh` 의 7 step 중 step 1 은 배포 기기를 origin/main HEAD 로 동기·재빌드·컨테이너 교체하는 **재배포**다. 이를 담당하는 `step_redeploy()`(69~77행)는 nightly 검증의 첫 관문이자 유일하게 외부 서브스크립트(`deploy/redeploy.sh`)를 호출하는 step 이다:

```bash
step_redeploy() {
  log "step redeploy: deploy/redeploy.sh 실행"
  if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then
    log "step redeploy: OK"
    return 0
  fi
  log "step redeploy: FAIL (redeploy.sh non-zero — 로그 참조)"
  return 1
}
```

두 shared helper(진행 로그 `log()` — T-0953 봉함, HTTP status `curl_code()` — T-0954 봉함)와 나머지 step 함수(health T-0952·liveness T-0950·auth T-0951·eval/collect/rediscovery argv T-0611/T-0887/T-0942)는 각각 자기 계약이 봉해졌으나, **step_redeploy 의 호출 배선**만 origin/main 미cover 로 남아있다. 계약 요소:

1. **REPO_DIR env-prefix threading**(71행 `REPO_DIR="$REPO_DIR" bash ...`) — 부모의 `REPO_DIR` 을 자식 `redeploy.sh` 의 환경 변수로 **명시 전달**한다. redeploy.sh 가 부모와 동일한 배포 체크아웃(`/opt/assessment-agent`)을 인식하도록 env 를 threading 한다.
2. **bash interpreter + REPO_DIR-relative 경로**(`bash "$REPO_DIR/deploy/redeploy.sh"`) — 재배포 오케스트레이터를 `$REPO_DIR/deploy/redeploy.sh` 정확 경로로 `bash` 인터프리터를 통해 호출한다(직접 실행 아닌 `bash <path>` 형태 — exec bit 무관하게 동작).
3. **append redirect + stderr 병합**(`>>"$LOG_FILE" 2>&1`) — 자식의 stdout 과 stderr 를 **truncate 아닌 append(`>>`)**로 LOG_FILE 에 병합(`2>&1`)한다. 진행 로그를 덮어쓰지 않고 누적하며, redeploy 의 장황한 빌드 출력을 사람용 로그 파일로 보낸다.
4. **stdout 순수성 보증** — 자식의 모든 출력이 LOG_FILE 로 가므로 redeploy 의 빌드 노이즈가 스크립트의 **bare-stdout 으로 새지 않는다**. 스크립트 전체에서 bare-stdout 방출은 여전히 387행 `cat "$RESULT_JSON"`(머신 JSON) 하나뿐이다. 이는 T-0953(log() `>&2` 라우팅)·T-0954(curl_code caller `$(...)` 캡처)가 봉한 stdout 순수성의 **step_redeploy 측 보증**이다 — 만약 `>>"$LOG_FILE" 2>&1` 가 없으면 redeploy 출력이 stdout 으로 새어 무인 루틴의 JSON 파싱을 깬다.
5. **exit-code → return 분기**(`if ... then return 0; else ... return 1`) — 자식 `redeploy.sh` 의 exit code 로 분기한다. 성공(exit 0) 시 `log OK; return 0`, 실패(non-zero) 시 `log FAIL; return 1`. 이 return 값이 caller(284행 `elif step_redeploy; then mark redeploy PASS`)의 PASS/FAIL 마킹을 결정한다.
6. **진단 log() 라우팅**(70·72·75행) — "step redeploy: 실행/OK/FAIL" 진단 3 종이 모두 `log()` 를 경유해 stderr+file 로 방출되며 bare-stdout 이 아니다(T-0953 상보).

이 함수를 관통하는 **불변식**: **step_redeploy 는 REPO_DIR 을 env 로 threading 한 채(`REPO_DIR="$REPO_DIR"`) `$REPO_DIR/deploy/redeploy.sh` 를 bash 로 호출하고 자식의 stdout+stderr 를 append(`>>`)로 LOG_FILE 에 병합(`2>&1`)해 스크립트 stdout 순수성(387행 cat 유일 bare-emitter)을 유지하며 자식 exit code 로 return 0(OK)/return 1(FAIL) 을 반환하되 시작·성공·실패 진단을 log()(stderr+file)로만 방출한다.** 이 불변식이 무너지면:

- **REPO_DIR env-threading 제거**(`REPO_DIR="$REPO_DIR"` 제거) — 자식 redeploy.sh 가 부모와 다른 REPO_DIR 기본값을 쓸 수 있어(자식 자체 `REPO_DIR:-...` fallback) 잘못된 체크아웃을 재배포하는 silent drift.
- **append → truncate**(`>>` → `>`) — redeploy 출력이 LOG_FILE 을 덮어써 그 앞 진행 로그(daily-test 시작 로그)를 소실.
- **stderr 병합 제거**(`2>&1` 제거) — redeploy 의 stderr 가 LOG_FILE 로 안 가고 스크립트 stderr 로 새거나(로그 파일 불완전), 최악의 경우 stdout 오염 경로.
- **redirect 전체 제거**(`>>"$LOG_FILE" 2>&1` 제거) — redeploy 의 빌드 출력이 스크립트 bare-stdout 으로 새어 무인 루틴의 머신 JSON 파싱을 깬다(stdout 순수성 파괴).
- **exit-code 분기 반전/무시** — redeploy 실패를 PASS 로 오마킹(false green) 또는 성공을 FAIL 로(false red).

그러나 이 **step_redeploy 호출 계약**은 origin/main 시점에 검증 0 부재다:

- **T-0953**(log-helper)는 진행 로그 라우팅(`log()` 의 `>&2`/`tee -a`/UTC)만 봉함 — step_redeploy 가 *서브스크립트를 호출하는* 배선(REPO_DIR-threading·bash-호출·append-redirect)은 범위 밖.
- **T-0954**(curl_code)는 HTTP status 헬퍼만 — redeploy 서브스크립트 호출과 무관.
- **T-0947**(skip-propagation cascade)는 redeploy 의 PASS/FAIL/SKIP 이 *downstream* health/liveness/auth 로 전파되는 gating 만 봉함 — redeploy 의 *내부* 호출 배선(어떻게 PASS/FAIL 이 산출되는지)은 다루지 않고 black-box PASS/FAIL/SKIP 토큰만.
- **redeploy-orchestration-entrypoint spec**(`redeploy-orchestration-entrypoint-contract-artifact-parity-drift`)은 `redeploy.sh` **자신**의 entrypoint 계약(systemd `.service`/`.timer` → redeploy.sh 경로 parity)만 봉함 — daily-test.sh 가 그 스크립트를 *호출하는 측*(env-threading·경로·redirect)은 범위 밖.

만약 누군가 `REPO_DIR="$REPO_DIR"` env prefix 를 제거하거나, `>>` 를 `>` 로 바꾸거나, `2>&1` 를 제거하거나, redirect 전체를 없애면, 무인 nightly 는 잘못된 체크아웃 재배포·로그 소실·stdout 오염·JSON 파싱 실패의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0953/T-0954 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + 호출 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 step_redeploy 유도 표현(69~77행)을 정적 추출하고, 호출 동형 pure 함수(`buildRedeployInvocation`·`redeployInvocationContract`·`redeployReturnBranch`)로 REPO_DIR-threading·bash-호출·append-redirect·stderr-병합·stdout-순수성·exit-code-분기 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy 실행·실 bash·실 배포·실 gh·실 git 0. process.env 읽기 0 / 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 호출 배선은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 서브프로세스 / 실 배포 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 step_redeploy contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — step_redeploy/redirect/env-prefix 미수정, drift 발견 시 별도 fix task). `deploy/redeploy.sh` 변경 0(호출 측만 다룸 — 자신 계약은 별도 spec). T-0953/T-0954 표면 재단언 0(각 helper 소관). T-0947 cascade 표면 재단언 0(downstream 전파는 그 소관 — 본 task 는 내부 호출 배선만). redeploy-orchestration spec 표면 재단언 0(redeploy.sh 자신 entrypoint 는 그 소관).

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 69~77행 `step_redeploy()`(71행 `if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then`)로 재배포를 호출 — 본 smoke 가 이 호출 앵커를 잡고 REPO_DIR-threading/bash-호출/append-redirect/stderr-병합/stdout-순수성/exit-code-분기 contract 를 봉한다. T-0953(log() 진행 로그)·T-0954(curl_code)·T-0947(cascade downstream)·redeploy-orchestration(redeploy.sh 자신) 모두 호출 측 배선 미cover → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step① nightly runner 가 배포 기기에서 redeploy.sh 로 origin/main 동기·재빌드·컨테이너 교체)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 step_redeploy 앵커를 정확히 추출·검증:
  - 69~77행 `step_redeploy()` — **재배포 호출 함수 전체**:
    - 70행 `log "step redeploy: deploy/redeploy.sh 실행"` — 시작 진단(log() 경유 stderr+file).
    - 71행 `if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then` — REPO_DIR env-prefix threading(`REPO_DIR="$REPO_DIR"`) + bash interpreter(`bash`) + REPO_DIR-relative 경로(`"$REPO_DIR/deploy/redeploy.sh"`) + append-redirect(`>>"$LOG_FILE"`) + stderr 병합(`2>&1`).
    - 72~73행 `log "step redeploy: OK"; return 0` — 성공 분기(exit 0 → return 0).
    - 75~76행 `log "step redeploy: FAIL (redeploy.sh non-zero — 로그 참조)"; return 1` — 실패 분기(non-zero → return 1).
  - 참고 앵커(재단언 금지, 경계 대조용): 25~28행 주석(stdout 은 머신 JSON 만·진행 로그는 stderr+file 분리)·387행 `cat "$RESULT_JSON"`(유일 bare-stdout emitter — step_redeploy 출력이 이리로 새지 않음의 대조점). 284행 `elif step_redeploy; then`(caller PASS 마킹 — cascade T-0947 소관, 재단언 아님).
- `test/smoke/realdata-e2e-daily-test-log-helper-stderr-dual-sink-stdout-purity-tee-append-utc-timestamp-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0953)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 log() 진행 로그 라우팅을 재단언하지 않고**(그건 T-0953 소관), **step_redeploy 호출 계약** 이라는 distinct surface 만 봉한다. 이 파일 변경 0.
- `test/smoke/redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts` — **경계 대조(읽기만 — 재단언 방지)**. 이 spec 이 `redeploy.sh` *자신*의 entrypoint 계약(systemd `.service`/`.timer` → 경로 parity)을 이미 봉함을 확인해, 본 task 가 그 계약을 재단언하지 않고 *daily-test 가 redeploy.sh 를 호출하는 측*(env-threading·경로·redirect)만 다룸을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-step-redeploy-invocation-repo-dir-env-thread-log-redirect-append-stdout-purity-return-code-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) step_redeploy 유도 표현(69~77행)을 정적 추출하고, 호출 동형 pure 함수(`buildRedeployInvocation`·`redeployInvocationContract`·`redeployReturnBranch`)로 REPO_DIR-threading·bash-호출·append-redirect·stderr-병합·stdout-순수성·exit-code-분기 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash/redeploy 실행 0)라 public CI 에서 항상 실행돼 green. 실 redeploy/bash/배포/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — step_redeploy 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `step_redeploy()` 정의(69행)·호출 라인 `if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then`(71행)·성공 분기(`log "step redeploy: OK"`/`return 0`, 72~73행)·실패 분기(`log "step redeploy: FAIL ..."`/`return 1`, 75~76행)·시작 진단(`log "step redeploy: deploy/redeploy.sh 실행"`, 70행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 배선을 mirror 함을 앵커).
- [ ] **happy-path — buildRedeployInvocation(repoDir, logFile)** — `buildRedeployInvocation(repoDir, logFile)` 가 `{ envPrefix: { REPO_DIR: repoDir }, interpreter: "bash", script: `${repoDir}/deploy/redeploy.sh`, redirect: { target: logFile, mode: "append", stderrToStdout: true } }`(71행 배선 동형)을 반환함을 assert. 여러 (repoDir, logFile) 조합으로 REPO_DIR 이 env 로 threading·script 경로가 repoDir-relative·redirect 가 append+병합임을 실증. 실 redeploy 실행 0(입력은 파라미터).
- [ ] **happy-path — redeployInvocationContract: env-threading·bash·append·stderr-병합** — `redeployInvocationContract(invocationLine)` 가 71행 호출 라인을 파싱해 `{ repoDirEnvThreaded: true, bashInterpreter: true, scriptPathRepoDirRelative: true, appendRedirect: true, stderrMerged: true, redirectTargetIsLogFile: true, noBareStdout: true }`(REPO_DIR="$REPO_DIR" + bash + "$REPO_DIR/deploy/redeploy.sh" + >>"$LOG_FILE" + 2>&1)를 반환함을 assert. 각 계약 요소 분리 실증.
- [ ] **happy-path — redeployReturnBranch: exit-code → return 0/1** — `redeployReturnBranch(childExitZero)` 가 `childExitZero === true` 시 `{ log: "OK", ret: 0 }`, `false` 시 `{ log: "FAIL", ret: 1 }`(72~76행 if/else 동형)을 반환함을 assert. 성공/실패 두 분기 모두 실증(자식 exit code 로 PASS/FAIL 산출).
- [ ] **branch — append(`>>`) vs truncate(`>`) 정적 대조** — 71행 redirect 가 `>>"$LOG_FILE"`(append) 이고 `>"$LOG_FILE"`(truncate) 가 *아님* 을 정적 대조 assert. `redeployInvocationContract` 의 `appendRedirect` 가 `>>` 존재 시 true·`>` 시 false 임을 두 입력(정본 `>>` / mutant `>`)으로 분리 실증(정본은 true — 앞선 진행 로그 보존).
- [ ] **branch — stderr 병합(`2>&1`) 존재 vs 부재 정적 대조** — 71행이 `2>&1`(stderr→stdout 병합) 를 포함함을 정적 대조 assert. `stderrMerged` 가 `2>&1` 존재 시 true·부재 시 false 임을 두 입력(정본 / mutant `2>&1` 제거)으로 분리 실증(정본은 true — 자식 stderr 도 LOG_FILE 로).
- [ ] **branch — REPO_DIR env-prefix 존재 vs 부재 정적 대조** — 71행이 `REPO_DIR="$REPO_DIR"` env-prefix 로 시작함을 정적 대조 assert. `repoDirEnvThreaded` 가 prefix 존재 시 true·부재 시 false 임을 두 입력(정본 / mutant prefix 제거)으로 분리 실증(정본은 true — 자식이 부모 체크아웃 인식).
- [ ] **branch — 성공/실패 return 분기** — `redeployReturnBranch(true)` → ret=0·`redeployReturnBranch(false)` → ret=1 두 분기가 서로 다른 값을 반환함을 분리 실증(exit 0 을 return 1 로, 또는 그 반대로 오배선하지 않음).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0953 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — step_redeploy 앵커 부재 시 명시적 실패** — 추출 보조 함수가 배선 유도 표현(`step_redeploy()` 정의·`REPO_DIR="$REPO_DIR"`·`bash "$REPO_DIR/deploy/redeploy.sh"`·`>>"$LOG_FILE"`·`2>&1`·`return 0`/`return 1`) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **REPO_DIR env-threading 제거 drift 변별** — 71행에서 `REPO_DIR="$REPO_DIR"` env-prefix 를 제거한(→ 자식이 다른 체크아웃 재배포) 모델 사본에서 "repoDirEnvThreaded" assert 가 실패함을 실증. 원본 문자열/pure 함수 불변.
  - (b) **append → truncate drift 변별** — `>>"$LOG_FILE"` 를 `>"$LOG_FILE"`(truncate)로 mutate 한 모델 사본에서 "appendRedirect" assert 가 실패함을 assert(진행 로그 덮어쓰기 회귀 검출). 원본 불변.
  - (c) **stderr 병합 제거 drift 변별** — `2>&1` 를 제거한 모델 사본에서 "stderrMerged" assert 가 실패함을 assert(자식 stderr 유실/오염 회귀 검출). 원본 불변.
  - (d) **redirect 전체 제거 → stdout 오염 drift 변별** — `>>"$LOG_FILE" 2>&1` 전체를 제거한 모델 사본에서 "noBareStdout(redirect 존재)" assert 가 실패함을 assert(redeploy 출력이 스크립트 bare-stdout 으로 새어 머신 JSON 파싱 깨는 회귀 검출 — T-0953/T-0954 stdout 순수성의 step_redeploy 측 보증). 원본 불변.
  - (e) **exit-code 분기 반전 drift 변별** — `redeployReturnBranch` 를 exit 0 → ret 1, 실패 → ret 0 으로 반전한 모델 사본에서 "성공→0/실패→1" assert 가 실패함을 assert(false green/false red 회귀 검출). 원본 불변.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·buildRedeployInvocation 산출·contract 파싱 결과·return 분기)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·env 실값·password 실값 미등장(§9 / REQ-059). step_redeploy 검증은 호출 구조(env-prefix/경로/redirect/return)만 다루고 실 배포 secret·`$REPO_DIR` 실 경로값을 담지 않음을 정적 확인 — `REPO_DIR="$REPO_DIR"` 는 변수 참조 토큰이지 실 경로값 아님을 확인.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(repoDir·logFile·shell 소스)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출/호출 파싱을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(shell 소스 사본·인자)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `bash`/`redeploy.sh`/`git`/gh 실행 0. 실 배포/서브프로세스/네트워크 0(파일 read + 정적 텍스트 추출 + 호출 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. step_redeploy()(69~77행)·env-prefix·redirect·return 분기 미수정(drift 발견 시 별도 fix task). 호출 배선을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 호출 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **`deploy/redeploy.sh` 변경 금지 / 그 자신 계약 재단언 금지** — 본 task 는 daily-test 가 redeploy.sh 를 *호출하는 측*만. redeploy.sh 자신의 entrypoint/systemd/경로 계약은 `redeploy-orchestration-entrypoint-contract-artifact-parity-drift` spec 소관. 그 파일·spec 변경 0.
- **T-0953/T-0954 표면 재단언 금지** — 진행 로그 라우팅(log() 의 `>&2`/`tee -a`/UTC — T-0953)·HTTP status 헬퍼(curl_code — T-0954)는 각 소관. 본 task 는 step_redeploy 호출 계약이라는 distinct surface 만. 그 spec 파일들 변경 0. 단 stdout 순수성 negative(d)는 T-0953/T-0954 순수성의 step_redeploy 측 보증으로 상보 인용만(재단언 아님 — 387행 cat 유일-emitter 자체는 T-0953/T-0954 소관).
- **T-0947 cascade 표면 재단언 금지** — redeploy 의 PASS/FAIL/SKIP 이 downstream health/liveness/auth 로 전파되는 gating(T-0947)은 그 소관. 본 task 는 redeploy 의 *내부* 호출 배선(어떻게 PASS/FAIL 이 산출되는지)만 — downstream 전파·SKIP_REDEPLOY=1 head 분기(281~288행)는 다루지 않음. 그 spec 파일 변경 0.
- **실 redeploy 실행 / 실 bash 서브프로세스 / 실 배포 금지** — 본 spec 은 non-gated 정적 파일 read + 호출 동형 pure 함수 only. 실 bash/redeploy.sh/배포/컨테이너 교체·실 서브프로세스 spawn 도입 0(그건 실 nightly 실행 소관).
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0953 log() 헬퍼 smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 step_redeploy 유도 표현(69~77행)을 정적 앵커로 추출 + 호출 동형 pure 함수(`buildRedeployInvocation`·`redeployInvocationContract`·`redeployReturnBranch`)로 REPO_DIR env-threading(`REPO_DIR="$REPO_DIR"`)·bash-호출(`bash "$REPO_DIR/deploy/redeploy.sh"`)·append-redirect(`>>"$LOG_FILE"`)·stderr-병합(`2>&1`)·stdout-순수성(bare-stdout 아님)·exit-code-분기(성공→return 0/실패→return 1) 불변식 assert. happy(앵커 추출·buildRedeployInvocation·redeployInvocationContract·redeployReturnBranch)/branch(append vs truncate·stderr 병합·REPO_DIR prefix·성공/실패 return)/error(파일 부재·앵커 부재)/negative(env-threading 제거·append→truncate·stderr 병합 제거·redirect 전체 제거·exit-code 반전·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 bash/redeploy/배포 실행 0, credential/env/password 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
