---
id: T-0951
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **step_auth signup→login→me 인증 round-trip 계약**을 정적 검증하는 non-gated build-time smoke — 배포된 앱의 인증 흐름 생존을 판정하는 auth step 의 **순차 3-leg round-trip(signup→login→me) + 멱등 signup 분기(201|409) + cookie-jar 단일-소스 threading(-c write / -b read + mktemp 생성 / rm -f 전-경로 정리) + fail-fast short-circuit(leg 실패 시 하류 leg 미실행) + §9-safe 진단(status 코드만 노출, SMOKE_EMAIL/SMOKE_PASSWORD 실값 echo 0)** 을 봉함(무인 nightly 가 배포 앱의 인증 계약을 credential 누출 없이 판정함을 신뢰). 계약: **(a) 순차 3-leg round-trip 규칙**(116~144행 `step_auth()` — ① `POST /api/users` signup → ② `POST /api/auth/login` login → ③ `GET /api/auth/me` me 를 *순서대로* 실행, 각 leg 성공이 다음 leg 진입의 전제) · **(b) 멱등 signup 분기**(124~127행 `case "$code" in 201 | 409)` — 첫 호출 201 또는 이미-존재 409 *둘 다* signup OK 로 수용, 그 외는 FAIL — 재실행 안전한 멱등 계약) · **(c) cookie-jar 단일-소스 threading**(119행 `jar="$(mktemp)"` 생성 → 130행 login 이 `-c "$jar"` 로 Set-Cookie 저장(write) → 137행 me 가 `-b "$jar"` 로 access_token cookie 로 인증(read) — login 이 발급한 세션이 me 로 단일-jar 를 통해 전달, 인증 cookie 의 write→read 단일-소스) · **(d) rm -f 전-경로 정리**(126·133·138행 — signup FAIL·login FAIL·me 진입 *모든* 경로에서 `rm -f "$jar"` 로 임시 jar 삭제 — 임시파일 누수 0) · **(e) fail-fast short-circuit**(각 leg guard 가 FAIL 시 `return 1` 로 즉시 종료 → 하류 leg 미실행 — signup 실패면 login/me 안 함, login 실패면 me 안 함) · **(f) §9-safe 진단**(126·133·140행 `log "step auth: FAIL — <leg> status=$code"` — 어느 leg 가 어떤 status 로 깨졌는지 *status 코드* 만 진단하고 SMOKE_EMAIL/SMOKE_PASSWORD/payload 실값·cookie 값은 로그에 echo 0, credential 누출 0). 불변식: auth 는 signup→login→me 를 *순서대로* 통과해야만 인증-생존을 단언하고(중간 leg 실패는 하류 미실행 FAIL), signup 은 201|409 를 멱등 수용하며, login 이 발급한 cookie 는 단일 jar 로만 me 에 전달되고, jar 는 모든 종료 경로에서 정리되며, 실패 진단은 status 코드만 노출해 credential 실값을 누출하지 않는다(§9) — 무인 nightly 가 배포 앱의 인증 흐름 실 생존을 credential-safe 하게 판정. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) auth round-trip 유도 표현(116~144행)을 정적 추출 + round-trip 동형 pure 함수(`isIdempotentSignupStatus`/`authRoundTripOutcome`/`authDiagnostic`)로 순차·멱등·jar-threading·정리·short-circuit·§9-진단 불변식 assert. T-0792(HTTP path·method·status parity — auth endpoint 의 route decorator parity 만, round-trip 순서·jar-threading·멱등 semantics *제외* line 48)·T-0950(liveness 3-gate 합취)·T-0947(step-chain SKIP cascade — auth 를 black-box outcome 으로만 취급)·T-0949(gating-env 완전성)·T-0944~T-0948(집계·dual-sink·prune·provenance) 가 미cover 한 **step_auth 내부 signup→login→me round-trip semantics** gap 상보 표면. 실 signup/login/me HTTP·curl·mktemp·gh·git 0·process.env/auth 실행 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 370
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-auth-signup-login-me-roundtrip-cookie-jar-threading-idempotent-branch-failfast-secret-safe-diagnostic-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-auth-roundtrip-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0950) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(순차 3-leg round-trip + 멱등 signup 분기 + cookie-jar threading + rm -f 정리 + fail-fast short-circuit + §9-safe 진단)의 happy/branch/error/negative full cover 에 ~370 LOC 필요, T-0950 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step④ — T-0950 liveness 3-gate 합취 봉함 뒤, 배포 앱 인증 흐름 생존을 판정하는 step_auth 의 내부 signup→login→me round-trip(멱등 201|409 + cookie-jar -c/-b threading + rm -f 전-경로 정리 + fail-fast short-circuit + §9-safe status-only 진단)을 정적 smoke 로 봉함. T-0792(HTTP path/method/status parity — round-trip 순서·jar·멱등 제외 line 48)/T-0947(cascade black-box outcome) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0951 — realdata-e2e nightly step_auth signup→login→me 인증 round-trip 정적 smoke (멱등 201|409 · cookie-jar -c/-b 단일-소스 threading · rm -f 전-경로 정리 · fail-fast short-circuit · §9-safe status-only 진단)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 기동된 컨테이너를 두드려 앱-생존·핵심 계약을 검증함을 명시한다. 그 핵심 계약 중 하나가 **인증 흐름의 실 생존**이다 — 단순 health/liveness ping 만으로는 "앱이 로그인/세션을 정상 처리한다" 를 보증하지 못한다. `step_auth`(116~144행)는 이를 **signup→login→me 순차 round-trip** 으로 판정한다:

1. **① signup — `POST /api/users`**(122~127행) — `curl_code 10 -X POST "$BASE_URL/api/users"` 로 사용자 생성. `case "$code" in 201 | 409)` — 첫 호출 201 또는 이미-존재 409 *둘 다* OK(125행), 그 외는 FAIL(`step auth: FAIL — signup status=$code`, 126행) + `rm -f "$jar"` + return 1.
2. **② login — `POST /api/auth/login`**(130~134행) — `curl_code 10 -c "$jar" -X POST "$BASE_URL/api/auth/login"` 로 로그인 + Set-Cookie 를 jar 에 저장(`-c`). `[ "$code" != "200" ]` 이면 FAIL(133행) + `rm -f "$jar"` + return 1.
3. **③ me — `GET /api/auth/me`**(137~141행) — `curl_code 10 -b "$jar" "$BASE_URL/api/auth/me"` 로 jar 의 access_token cookie(`-b`) 로 인증. `rm -f "$jar"`(138행, me 진입 시 정리) 후 `[ "$code" != "200" ]` 이면 FAIL(140행) + return 1.
4. **셋 모두 통과 → return 0**(142~143행 `log "step auth: OK (signup→login→me round-trip)"`).

이 round-trip 을 관통하는 **불변식**: **auth 는 signup→login→me 를 *순서대로* 통과해야만 인증-생존을 단언하고(중간 leg 실패는 하류 미실행 FAIL), signup 은 201|409 를 멱등 수용하며, login 이 발급한 cookie 는 단일 jar 로만 me 에 전달되고, jar 는 모든 종료 경로에서 정리되며, 실패 진단은 status 코드만 노출해 credential 실값을 누출하지 않는다(§9).** 이 불변식이 무인 nightly 가 "배포 앱의 인증 흐름이 실제로 살아있다" 를 credential-safe 하게 판정하는 신뢰의 핵심이다:

- **순차 3-leg + fail-fast short-circuit** — signup·login·me 는 순서 의존이다(login 은 signup 된 계정에, me 는 login 발급 세션에 의존). 각 leg guard 가 FAIL 시 `return 1` 로 즉시 종료해 하류 leg 를 실행하지 않는다. 만약 이 순차/short-circuit 이 깨져 leg 를 병렬·무순서로 두거나 실패 후에도 하류를 계속 실행하면, 로그인 실패 상태에서 me 를 두드려 무의미한 401 을 auth FAIL 로 이중 보고하거나 signup 없이 login 을 시도해 false-negative 를 낸다.
- **멱등 signup 분기(201|409)** — nightly 는 반복 실행되므로 signup 이 첫 회 201, 이후 409(이미 존재)를 낸다. `201 | 409` 를 *둘 다* 정상 수용해야 재실행 안전(멱등)이다. 이 분기가 201 만 수용하도록 좁혀지면 2회차부터 매번 signup FAIL 로 오판(false-positive 장애 신호)한다.
- **cookie-jar 단일-소스 threading** — login 이 `-c "$jar"` 로 Set-Cookie(access_token)를 *쓰고*, me 가 `-b "$jar"` 로 그 cookie 를 *읽어* 인증한다. 하나의 mktemp jar 가 write→read 단일 소스다. 이 threading 이 깨져 me 가 jar 를 안 읽거나(`-b` 누락) 다른 jar 를 읽으면, login 세션이 me 로 전달되지 않아 정상 배포도 me 401 로 false-negative 를 낸다.
- **rm -f 전-경로 정리** — signup FAIL(126행)·login FAIL(133행)·me 진입(138행) *모든* 종료 경로에서 임시 jar 를 삭제한다. 이 정리가 일부 경로에서 빠지면 nightly 반복 실행마다 `/tmp` 에 cookie jar 파일이 누수(민감 cookie 를 담은 임시파일 잔존 — §9 정합 위험).
- **§9-safe status-only 진단** — 실패 로그는 *어느 leg 가 어떤 status* 로 깨졌는지(status 코드)만 출력하고, `$payload`(email·password 포함)·SMOKE_EMAIL·SMOKE_PASSWORD 실값·jar cookie 값은 로그에 echo 하지 않는다. 이 §9 규율이 깨져 payload/credential 을 진단 로그에 흘리면 nightly 로그 파일(deploy/logs/daily-*.log)·stderr 에 인증 정보가 영속화되는 회귀다.

그러나 이 **step_auth 내부 signup→login→me round-trip semantics** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0792**(http-step-contract-nestjs-route-decorator-parity)는 step_auth 가 두드리는 endpoint 의 **path·HTTP method·기대 status ↔ NestJS controller route decorator parity** 만 봉하고(그 spec line 48 `409 conflict 실 트리거·round-trip 순서 검증 0 — created-status/멱등 표기의 정적 확인만`), **round-trip 순서·cookie-jar threading·멱등 signup semantics·rm -f 정리·fail-fast short-circuit·§9 진단은 명시적으로 범위 밖**.
- **T-0947**(step-chain SKIP-propagation cascade)는 auth 를 **black-box outcome**(PASS/FAIL/SKIP)으로만 취급해 cascade(liveness==PASS → auth 실행 else SKIP)만 봉함 — auth *내부* round-trip 은 다루지 않음.
- **T-0950**(liveness 3-gate 합취)·**T-0944~T-0949** 는 각각 liveness 합취·집계·dual-sink·prune·provenance·gating-env 완전성만 봉함 — 어느 것도 auth round-trip 을 다루지 않음.

만약 누군가 signup 분기를 201-only 로 좁히거나(→ 2회차부터 오판), me 의 `-b "$jar"` 를 누락하거나(→ 세션 전달 단절 false-negative), fail-fast short-circuit 을 제거하거나(→ 실패 후 하류 실행), 일부 경로의 `rm -f` 를 빼거나(→ jar 누수), 진단에 payload/credential 을 끼워넣으면(→ §9 누출), 무인 nightly 는 false-positive/negative·정보 누출의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0950/T-0949 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + round-trip 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 auth round-trip 유도 표현(116~144행)을 정적 추출하고, round-trip 동형 pure 함수(`isIdempotentSignupStatus`·`authRoundTripOutcome`·`authDiagnostic`)로 순차·멱등·jar-threading·정리·short-circuit·§9-진단 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 signup·login·me·실 curl·실 HTTP·실 mktemp·실 gh·실 git 0. process.env 읽기 0 / auth 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). round-trip·멱등·jar-threading 은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 네트워크 / 실 cookie jar 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만 — auth 흐름 신설 0) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 auth-round-trip contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — step_auth 함수/멱등 분기/jar-threading 미수정, drift 발견 시 별도 fix task). T-0792 표면 재단언 0(T-0792 는 path·method·status parity, 본 task 는 step_auth *내부* round-trip 순서·멱등·jar-threading·정리·short-circuit·§9 진단 — T-0792 가 명시 제외한 distinct surface). T-0947 표면 재단언 0(cascade black-box outcome). T-0944~T-0950 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 116~144행 `step_auth()`(118행 payload = email/password, 119행 `jar="$(mktemp)"`, 122~127행 signup `case 201|409`, 130~134행 login `-c "$jar"` + `!= "200"` guard, 137~141행 me `-b "$jar"` + `rm -f "$jar"` + `!= "200"` guard, 142~143행 OK return 0)로 round-trip 을 산출 — 본 smoke 가 이 round-trip 앵커들을 잡고 auth-contract 를 봉한다. T-0792 는 round-trip 순서·jar·멱등을 명시 제외(그 spec line 48), T-0947 은 auth 를 outcome 으로만 취급 → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ nightly runner 가 기동된 컨테이너를 두드려 앱 생존·핵심 계약 검증)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 auth round-trip 앵커를 정확히 추출·검증:
  - 62~65행 `curl_code()` — `-s -o /dev/null -w '%{http_code}'` status-only 추출 + positional `--max-time "${1}"` hang guard. auth 3-leg 이 모두 이 helper 경유(122·130·137행).
  - 116~144행 `step_auth()` — **signup→login→me round-trip 함수 전체**:
    - 118행 payload — `printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD"` (credential 은 payload 로만, 로그 echo 0 대조 앵커).
    - 119행 jar 생성 — `jar="$(mktemp)"`.
    - 122~127행 signup leg — `curl_code 10 -X POST "$BASE_URL/api/users"` + `case "$code" in 201 | 409) log OK ;; *) log FAIL — signup status=$code; rm -f "$jar"; return 1 ;;`.
    - 130~134행 login leg — `curl_code 10 -c "$jar" -X POST "$BASE_URL/api/auth/login"` + `[ "$code" != "200" ]` → 133행 `log FAIL — login status=$code; rm -f "$jar"; return 1`.
    - 137~141행 me leg — `curl_code 10 -b "$jar" "$BASE_URL/api/auth/me"` + `rm -f "$jar"`(138행) + `[ "$code" != "200" ]` → 140행 `log FAIL — me status=$code; return 1`.
    - 142~143행 OK — `log "step auth: OK (signup→login→me round-trip)"` + return 0.
- `test/smoke/realdata-e2e-daily-test-liveness-app-alive-three-gate-conjunction-spa-html-detection-per-condition-diagnostic-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0950)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수(합취/round-trip) + 조건별 §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 liveness 3-gate 합취를 재단언하지 않고**(그건 T-0950 소관), **step_auth signup→login→me round-trip semantics**(순차·멱등 201|409·cookie-jar threading·rm -f 정리·fail-fast short-circuit·status-only 진단)라는 distinct surface 만 봉한다.
- `test/smoke/realdata-e2e-daily-test-http-step-contract-nestjs-route-decorator-parity-drift.smoke-spec.ts` — **경계 대조(T-0792, 읽기만 — 재단언 방지)**. 이 spec 이 step_auth 의 path·method·status parity 를 이미 봉함(그리고 line 48 에서 round-trip 순서·409 실 트리거·jar 를 명시 제외)을 확인해, 본 task 가 그 표면을 재단언하지 않고 *내부 round-trip semantics* 만 다룸을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-auth-signup-login-me-roundtrip-cookie-jar-threading-idempotent-branch-failfast-secret-safe-diagnostic-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) auth round-trip 유도 표현(116~144행 + curl_code 62~65행)을 정적 추출하고, round-trip 동형 pure 함수(`isIdempotentSignupStatus`·`authRoundTripOutcome`·`authDiagnostic`)로 순차·멱등·jar-threading·정리·short-circuit·§9-진단 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash/curl 실행 0)라 public CI 에서 항상 실행돼 green. 실 signup/login/me/HTTP/curl/mktemp/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — step_auth round-trip 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `step_auth()` 정의(116행)·signup `-X POST "$BASE_URL/api/users"` + `case "$code" in 201 | 409)`(122·124행)·login `-c "$jar" -X POST "$BASE_URL/api/auth/login"`(130행)·me `-b "$jar" "$BASE_URL/api/auth/me"`(137행)·jar 생성 `jar="$(mktemp)"`(119행)·OK return 0(143행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash round-trip 을 mirror 함을 앵커).
- [ ] **happy-path — 3-leg 모두 통과 → auth OK** — `authRoundTripOutcome({signupStatus, loginStatus, meStatus})` 가 (signupStatus ∈ {201,409}) AND (loginStatus == 200) AND (meStatus == 200) 인 입력에서 `{ok:true}`(return 0 동형)를 반환함을 assert. 정상 입력(signup 201·login 200·me 200) 및 멱등 재실행 입력(signup 409·login 200·me 200) 둘 다로 호출 시 OK 임을 실증(실 curl/env 읽기 0 — 입력은 함수 파라미터).
- [ ] **happy-path — isIdempotentSignupStatus(201|409 수용, 그 외 거부)** — `isIdempotentSignupStatus(code)` 가 `201`·`409` 에 대해 true, `200`·`400`·`401`·`403`·`422`·`500`·`0`(curl 실패 code) 각각에 대해 false 를 반환함을 assert(124행 `case "$code" in 201 | 409)` 규칙과 정합 — 첫 회 created 201·이미-존재 409 *둘 다* 멱등 수용, 그 외 status 는 signup FAIL).
- [ ] **branch — leg 별 실패 → not-ok + leg별 진단 + fail-fast short-circuit** — (i) signup status ∉ {201,409}(login/me 정상) → `authRoundTripOutcome` `{ok:false, failedLeg:"signup"}` + `authDiagnostic` 가 "signup status=" 진단 + login/me 미실행(executed leg 이 signup 에서 멈춤), (ii) signup OK 이나 login != 200 → `{ok:false, failedLeg:"login"}` + "login status=" 진단 + me 미실행, (iii) signup·login OK 이나 me != 200 → `{ok:false, failedLeg:"me"}` + "me status=" 진단 — 각 분기가 정확히 자기 leg 의 진단을 내고 하류 leg 를 실행하지 않음을 assert(126·133·140행 leg별 진단 + fail-fast return 앵커).
- [ ] **branch — cookie-jar 단일-소스 threading(login write → me read) 정적 대조** — login leg 이 `-c "$jar"`(Set-Cookie *write*)를 쓰고 me leg 이 `-b "$jar"`(cookie *read*)를 씀을, 그리고 *동일* jar 변수(119행 `jar="$(mktemp)"` 단일 소스)를 참조함을 정적 대조 assert(login `-c` 와 me `-b` 가 같은 `"$jar"` 를 인자로 가짐 — write→read 단일-소스 threading). signup leg 은 jar 미참조(`-c`/`-b` 없음 — cookie 발급 전)임도 분리 실증.
- [ ] **branch — rm -f 전-경로 정리** — signup FAIL(126행)·login FAIL(133행)·me 진입(138행) *모든* 종료 경로에 `rm -f "$jar"` 가 존재함을 정적 assert(임시 jar 가 어느 exit 경로에서도 정리됨 — 누수 0). happy 경로(me 진입 138행 정리 후 OK) 및 각 FAIL 경로에서 jar 정리가 빠지지 않음을 leg별로 분리 확인.
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0950 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — auth round-trip 앵커 부재 시 명시적 실패** — 추출 보조 함수가 auth 유도 표현(step_auth 정의·signup/login/me leg·`201 | 409` 분기·`-c`/`-b` jar·rm -f·OK return) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **멱등 signup 좁힘(201-only) drift 변별** — `isIdempotentSignupStatus` 를 201 만 수용(409 거부)하도록 좁힌 모델 사본에서 "409(이미-존재)도 signup OK" assert 가 실패함을 실증(2회차 nightly 오판 회귀 검출). 원본 pure 함수 불변.
  - (b) **fail-fast short-circuit 제거 drift 변별** — round-trip 을 leg 실패 후에도 하류를 계속 실행(short-circuit 제거)하도록 mutate 한 모델 사본에서 "signup 실패면 login/me 미실행" assert 가 실패함을 assert(실패 후 하류 실행 회귀 검출). 원본 불변.
  - (c) **cookie-jar threading 단절(me `-b` 누락) drift 변별** — me leg 이 jar 를 안 읽도록(`-b "$jar"` 누락) 약화한 모델 사본에서 "login write → me read 단일-소스 threading" assert 가 실패함을 assert(세션 전달 단절 false-negative 회귀 검출). 원본 불변.
  - (d) **rm -f 정리 누락 drift 변별** — 일부 경로(예: login FAIL)의 `rm -f "$jar"` 를 뺀 모델 사본에서 "모든 종료 경로에서 jar 정리" assert 가 실패함을 assert(임시 jar 누수 회귀 검출). 원본 불변.
  - (e) **§9 진단 credential-누출 drift 변별** — auth 진단을 status 코드 대신 `$payload`(email/password 포함)·SMOKE_PASSWORD 실값을 내도록 mutate 한 모델 사본에서 "진단은 leg+status 만(credential/payload 실값 미포함)" assert 가 실패함을 assert(credential 누출 회귀 검출). 실 소스 126·133·140행이 status 진단만이고 payload/email/password/cookie echo 미등장임을 정적 확인.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·진단·입력 status)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·SMOKE_PASSWORD/SMOKE_EMAIL 실값·cookie(access_token) 실값 미등장(§9 / REQ-059). payload 는 email/password 를 담으나 그 실값이 진단/JSON/앵커 어디에도 surface 0 임을 정적 확인.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(auth status map)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(status map·shell 소스 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `curl`/`bash`/`mktemp`/`git`/gh 실행 0. 실 signup/login/me·HTTP·네트워크 요청·실 cookie jar 0(파일 read + 정적 텍스트 추출 + round-trip 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. auth round-trip 유도 표현(116~144행)·멱등 분기·jar-threading·rm -f·진단 미수정(drift 발견 시 별도 fix task). step_auth 로직을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + round-trip 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0792 표면 재단언 금지** — step_auth 의 HTTP path·method·기대 status ↔ NestJS controller route decorator parity 는 T-0792 소관. 본 task 는 step_auth *내부* round-trip 순서·멱등 semantics·cookie-jar threading·rm -f 정리·fail-fast short-circuit·§9 진단(T-0792 가 line 48 에서 *명시적으로 제외*)이라는 distinct surface 만. T-0792 spec 파일 변경 0. endpoint path/method/status parity 재검증 0.
- **T-0947 표면 재단언 금지** — step-chain SKIP-propagation cascade(liveness==PASS → auth 실행 else SKIP)는 T-0947 소관(auth 를 black-box outcome 으로만 취급). 본 task 는 auth 함수 *내부* round-trip semantics 만. T-0947 spec 파일 변경 0. cascade/gate call-site 재검증 0.
- **T-0950/T-0944~T-0949 표면 재단언 금지** — liveness 3-gate 합취(T-0950)·집계 값(T-0944)·dual-sink(T-0945)·로그 prune(T-0946)·SKIP cascade(T-0947)·스칼라 provenance(T-0948)·gating-env 완전성(T-0949)은 각 소관. 본 task 는 step_auth round-trip distinct surface 만. 해당 spec 파일들 변경 0.
- **실 앱 기동 / 실 인증 검증 금지** — 본 spec 은 non-gated 정적 파일 read + round-trip pure 함수 only. 실 컨테이너 기동·실 signup/login/me·실 curl/HTTP 요청·실 cookie jar 도입 0(그건 실 nightly 실행 소관). NestJS auth controller e2e 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0950 liveness 3-gate 합취 smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 auth round-trip 유도 표현(116~144행 + curl_code 62~65행)을 정적 앵커로 추출 + round-trip 동형 pure 함수(`isIdempotentSignupStatus`·`authRoundTripOutcome`·`authDiagnostic`)로 순차·멱등·jar-threading·rm -f 정리·fail-fast short-circuit·§9-진단 불변식 assert. happy(round-trip 앵커 추출·3-leg 통과 OK·isIdempotentSignupStatus)/branch(leg별 실패+진단+short-circuit·jar threading 대조·rm -f 전-경로)/error(파일 부재·앵커 부재)/negative(멱등 좁힘·short-circuit 제거·jar threading 단절·rm -f 누락·§9 credential 누출·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 curl/bash/mktemp/HTTP 0, credential/payload 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
