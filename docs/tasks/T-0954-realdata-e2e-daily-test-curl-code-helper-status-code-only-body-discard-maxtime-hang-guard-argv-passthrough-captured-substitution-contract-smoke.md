---
id: T-0954
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **curl_code() 헬퍼 status-code-only 방출 · body 폐기 · max-time hang-guard · argv passthrough · command-substitution 캡처 계약**을 정적 검증하는 non-gated build-time smoke — 모든 HTTP status 검사가 body 를 버리고(`-o /dev/null`) status code 만(`-w '%{http_code}'`) stdout 으로 방출하되 그 stdout 이 caller 의 `$(...)` command-substitution 에 캡처돼 스크립트 bare-stdout 을 오염시키지 않으며(T-0953 stdout-순수성 계약의 상보 — "curl_code 는 stdout 에 status 를 쓰지만 caller 가 변수로 캡처"), 첫 위치 인자(`"${1}"`)가 `--max-time` 으로 배선돼 hang 을 막고 나머지 인자(`"${@:2}"`)가 curl 로 passthrough 됨을 봉함(log() 헬퍼를 봉한 T-0953 의 helper-쌍 상보 — 스크립트의 두 공유 헬퍼 중 curl_code 측). 계약 (a) **silent**(64행 `-s` — progress meter 억제) · (b) **body 폐기**(`-o /dev/null` — 응답 body 를 stdout 아닌 null 로) · (c) **status-code-only 방출**(`-w '%{http_code}'` — HTTP status code 만 stdout 방출, caller 가 `$(...)` 로 캡처) · (d) **max-time hang-guard positional**(`--max-time "${1}"` — 첫 위치 인자가 timeout, hang 방지) · (e) **argv passthrough from arg2**(`"${@:2}"` — 두 번째 인자부터 URL/method/header/data 를 curl 로 전달) · (f) **caller 캡처로 stdout 비오염**(liveness 102·auth 122·130·137행 `code="$(curl_code ...)"` — curl_code stdout 이 command-substitution 에 캡처돼 스크립트 bare-stdout 방출 아님, 유일 bare-stdout emitter 는 387행 cat 그대로). 불변식: 모든 curl_code 호출은 `-s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"` 로 body 를 버리고 status code 만 stdout 방출하며 첫 인자를 timeout 으로 배선(hang-guard)하고 나머지를 curl 로 passthrough 하되, 그 stdout 은 caller 의 `$(...)` 에 캡처돼 스크립트 stdout 순수성(387행 cat 유일 bare-emitter)을 깨지 않는다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) curl_code 유도 표현(62~65행 정의 + liveness 102·auth 122·130·137행 caller 캡처)을 정적 추출 + argv 동형 pure 함수(`buildCurlCodeArgv`/`curlCodeContract`/`curlCodeCallerCaptures`)로 silent·body-폐기·status-only·max-time·passthrough·caller-캡처 불변식 assert. T-0953(log() 헬퍼 stderr dual-sink/stdout purity — 진행 로그 라우팅 측만, HTTP status 헬퍼 제외)·T-0952(step_health 폴링 — curl_code 미사용 직접 curl)·T-0950(liveness 3-gate)·T-0951(auth roundtrip)·T-0944~T-0949(집계/JSON/prune/cascade/provenance/gating) 가 curl_code 를 black-box 로 취급해 미cover 한 **HTTP status 헬퍼 계약** gap 상보 표면. 실 curl 실행·실 HTTP·실 network·gh·git 0·process.env 읽기 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 375
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-curl-code-helper-status-code-only-body-discard-maxtime-hang-guard-argv-passthrough-captured-substitution-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-curl-code-helper-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0953) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(silent + body 폐기 + status-only + max-time hang-guard positional + argv passthrough from arg2 + caller command-substitution 캡처)의 happy/branch/error/negative full cover 에 ~375 LOC 필요, T-0953/T-0952 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step④ — T-0953 log() 헬퍼 봉함 뒤, 스크립트의 나머지 공유 헬퍼 curl_code() 의 status-code-only 방출·body 폐기(-o /dev/null)·max-time hang-guard positional·argv passthrough(\"${@:2}\")·caller command-substitution 캡처(stdout 비오염) 계약을 정적 smoke 로 봉함. T-0953(log() stderr 라우팅 — HTTP status 헬퍼 제외) helper-쌍 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0954 — realdata-e2e nightly curl_code() 헬퍼 status-code-only · body 폐기 · max-time hang-guard · argv passthrough · caller 캡처 정적 smoke (`-s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"` · caller `$(...)` 캡처로 stdout 비오염)

## Why

`deploy/daily-test.sh` 는 두 개의 공유 헬퍼로 스크립트 전체를 지탱한다. 하나는 진행 로그를 담당하는 `log()`(57~60행, T-0953 이 봉함)이고, 다른 하나는 **모든 HTTP status 검사를 담당하는 `curl_code()`**(62~65행)다:

```bash
# curl_code: HTTP status code 만 반환 (응답 body 는 버림). --max-time 으로 hang 방지.
curl_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"
}
```

이 헬퍼는 liveness(102행 `code="$(curl_code 10 "$BASE_URL/")"`)와 auth(122·130·137행 signup/login/me)의 status 검사를 **단일 지점으로 통일**한다. 계약 요소:

1. **silent**(64행 `-s`) — curl 의 progress meter/error 를 억제해 출력에 잡음이 섞이지 않게 한다.
2. **body 폐기**(`-o /dev/null`) — 응답 body 를 stdout 이 아닌 `/dev/null` 로 버린다. curl_code 는 오직 status 만 관심이므로 body 가 stdout 을 오염시키지 않는다.
3. **status-code-only 방출**(`-w '%{http_code}'`) — HTTP status code 만 stdout 으로 방출한다. caller 가 이를 `$(...)` command-substitution 으로 캡처해 `code` 변수에 담는다.
4. **max-time hang-guard positional**(`--max-time "${1}"`) — **첫 위치 인자**가 timeout(초)으로 배선된다. 응답 없는 endpoint 에서 curl 이 무한 대기하지 않도록 hang 을 막는다(liveness 는 10초, auth 는 10초).
5. **argv passthrough from arg2**(`"${@:2}"`) — **두 번째 인자부터** URL·method(`-X POST`)·header(`-H`)·data(`-d`)·cookie jar(`-c`/`-b`)를 curl 로 그대로 전달한다. 즉 `curl_code 10 -X POST "$URL" -H ... -d ...` 형태로 timeout 을 앞에 두고 나머지 curl 옵션을 뒤에 붙인다.
6. **caller 캡처로 stdout 비오염**(102·122·130·137행) — curl_code 의 stdout(status code)은 caller 의 `code="$(curl_code ...)"` command-substitution 에 캡처된다. 따라서 curl_code 는 status 를 stdout 에 쓰지만 그 출력은 **변수로 흡수**돼 스크립트의 bare-stdout 을 오염시키지 않는다. 스크립트 전체에서 bare-stdout 방출은 여전히 387행 `cat "$RESULT_JSON"` 하나뿐이다.

이 헬퍼를 관통하는 **불변식**: **모든 curl_code 호출은 `-s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"` 로 body 를 버리고(`-o /dev/null`) status code 만(`-w '%{http_code}'`) stdout 방출하며 첫 인자를 timeout 으로 배선(hang-guard `--max-time "${1}"`)하고 나머지를 curl 로 passthrough(`"${@:2}"`)하되, 그 stdout 은 caller 의 `$(...)` 에 캡처돼 스크립트 stdout 순수성(387행 cat 유일 bare-emitter)을 깨지 않는다.** 이 불변식이 무너지면:

- **body 폐기(`-o /dev/null`) 제거** — 응답 body 가 stdout 으로 새어 caller 의 `$(...)` 캡처에 status code 앞에 body 가 섞인다. `code` 변수가 `<html>...200` 같은 오염값이 돼 `[ "$code" != "200" ]` 판정이 항상 참(=FAIL)이 된다.
- **status-only(`-w '%{http_code}'`) 제거** — status code 가 방출되지 않아 `code` 가 빈 문자열이 되고, 모든 status 비교가 깨진다(false FAIL).
- **max-time(`--max-time "${1}"`) 제거** — 응답 없는 endpoint 에서 curl 이 무한 대기해 nightly 전체가 hang(timeout 없는 배포 검증 → 정지).
- **passthrough(`"${@:2}"` → `"$@"`)** — 첫 인자(timeout 값 `10`)가 URL 로 오해돼 curl 이 `10` 을 endpoint 로 접속 시도, 실 URL 은 `--max-time` 인자로 오배선된다(전면 오작동).
- **caller 캡처 부재** — 만약 caller 가 `$(...)` 없이 curl_code 를 bare 호출하면 status code 가 스크립트 stdout 으로 새어 T-0953 이 봉한 stdout 순수성(387행 cat 유일 emitter)을 깬다.

그러나 이 **curl_code() HTTP status 헬퍼** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0953**(log-helper-stderr-dual-sink-stdout-purity)는 **진행 로그 라우팅 측**(log() 의 `>&2`/`tee -a`/UTC/whole-message)만 봉한다. HTTP status 헬퍼(curl_code)의 status-only 방출·body 폐기·max-time·passthrough·caller 캡처는 명시적으로 범위 밖(T-0953 은 스크립트의 두 헬퍼 중 log() 만). 본 task 는 그 helper-쌍 상보 측(curl_code)을 봉한다.
- **T-0952**(step_health bounded polling)는 health 폴링에서 `curl -s --max-time 5` 를 **직접** 호출하는 부분만 봉함 — curl_code 헬퍼는 사용하지 않으므로 curl_code 의 status-only/body-폐기/passthrough 계약과 무관.
- **T-0950**(liveness 3-gate)·**T-0951**(auth roundtrip)는 curl_code 를 **호출**하지만 그 헬퍼를 black-box 로 취급 — status code 가 어떤 curl 배선으로 산출되는지(`-o /dev/null`/`-w '%{http_code}'`/`--max-time "${1}"`/`"${@:2}"`)는 다루지 않고, 반환된 code 값의 분기(3-gate 결합·signup 201|409·login 200·me 200)만 봉함. 본 task 는 그 헬퍼 *내부* 배선을 봉한다.
- **T-0944~T-0949**(집계/JSON dual-sink/prune/cascade/provenance/gating)는 curl_code 와 무관한 표면.

만약 누군가 `-o /dev/null` 을 제거하거나(→ body 가 status 에 오염), `-w '%{http_code}'` 를 다른 형식으로 바꾸거나(→ status 미방출), `--max-time` 을 제거하거나(→ hang), `"${@:2}"` 를 `"$@"` 로 바꾸면(→ timeout-as-URL 오배선), 무인 nightly 는 전 HTTP step 의 오작동·hang·false-FAIL 의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0953/T-0952 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + argv 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 curl_code 유도 표현(62~65행 정의 + 102·122·130·137행 caller 캡처)을 정적 추출하고, argv 동형 pure 함수(`buildCurlCodeArgv`·`curlCodeContract`·`curlCodeCallerCaptures`)로 silent·body-폐기·status-only·max-time·passthrough·caller-캡처 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 curl 실행·실 HTTP·실 network·실 gh·실 git 0. process.env 읽기 0 / 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). curl 배선은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 curl / 실 소켓 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 curl_code contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — curl_code 헬퍼/flag/caller 미수정, drift 발견 시 별도 fix task). T-0953 표면 재단언 0(T-0953 은 log() 진행 로그 라우팅 — 본 task 는 curl_code HTTP status 헬퍼만). T-0950/T-0951 표면 재단언 0(그 spec 들은 반환된 code 의 분기만 — 본 task 는 code 를 산출하는 curl 배선만). T-0944~T-0949·T-0952 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 62~65행 `curl_code()`(64행 `curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"`)로 HTTP status 만 산출하고 102·122·130·137행이 `code="$(curl_code ...)"` 로 그 stdout 을 command-substitution 캡처 — 본 smoke 가 이 헬퍼 앵커들을 잡고 curl_code status-only/body-폐기/max-time/passthrough/caller-캡처 contract 를 봉한다. T-0953 은 log() 헬퍼만(HTTP status 헬퍼 제외) → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ nightly runner 가 배포 기기에서 HTTP 스모크로 liveness/auth 를 검증)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 curl_code 앵커를 정확히 추출·검증:
  - 62~65행 `curl_code()` — **HTTP status 헬퍼 함수 전체**:
    - 62행 주석 — "HTTP status code 만 반환 (응답 body 는 버림). --max-time 으로 hang 방지"(계약 의도 앵커).
    - 64행 `curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"` — silent(`-s`) + body 폐기(`-o /dev/null`) + status-only(`-w '%{http_code}'`) + max-time positional(`--max-time "${1}"`) + argv passthrough(`"${@:2}"`).
  - 102행 `code="$(curl_code 10 "$BASE_URL/")"` — liveness caller, timeout 10 + URL. command-substitution 캡처 앵커.
  - 122~123행 `code="$(curl_code 10 -X POST "$BASE_URL/api/users" -H 'Content-Type: application/json' -d "$payload")"` — auth signup caller, timeout 10 + method/header/data passthrough.
  - 130~131행 `code="$(curl_code 10 -c "$jar" -X POST "$BASE_URL/api/auth/login" ...)"` — auth login caller, cookie jar `-c` passthrough.
  - 137행 `code="$(curl_code 10 -b "$jar" "$BASE_URL/api/auth/me")"` — auth me caller, cookie `-b` passthrough.
  - 참고: curl_code 의 stdout(status code)은 모두 `$(...)` 안에 캡처됨 — 스크립트 bare-stdout 방출 아님(387행 `cat "$RESULT_JSON"` 만 bare-stdout). 이 caller 캡처가 T-0953 stdout 순수성의 curl_code 측 보증.
- `test/smoke/realdata-e2e-daily-test-log-helper-stderr-dual-sink-stdout-purity-tee-append-utc-timestamp-contract.smoke-spec.ts` — **동형 패턴 템플릿 + helper-쌍 상보 대조(T-0953)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 log() 진행 로그 라우팅을 재단언하지 않고**(그건 T-0953 소관), **curl_code() HTTP status 헬퍼** 라는 distinct surface 만 봉한다. 이 파일 변경 0.
- `test/smoke/realdata-e2e-daily-test-auth-signup-login-me-roundtrip-cookie-jar-threading-idempotent-branch-failfast-secret-safe-diagnostic-contract.smoke-spec.ts` — **경계 대조(T-0951, 읽기만 — 재단언 방지)**. 이 spec 이 auth roundtrip 의 *반환 code 분기*(signup 201|409·login 200·me 200·cookie jar threading)를 이미 봉함을 확인해, 본 task 가 그 분기를 재단언하지 않고 *code 를 산출하는 curl_code 배선*(status-only/body-폐기/max-time/passthrough)만 다룸을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-curl-code-helper-status-code-only-body-discard-maxtime-hang-guard-argv-passthrough-captured-substitution-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) curl_code 유도 표현(62~65행 정의 + 102·122·130·137행 caller 캡처)을 정적 추출하고, argv 동형 pure 함수(`buildCurlCodeArgv`·`curlCodeContract`·`curlCodeCallerCaptures`)로 silent·body-폐기·status-only·max-time·passthrough·caller-캡처 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash/curl 실행 0)라 public CI 에서 항상 실행돼 green. 실 curl/HTTP/network/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — curl_code 헬퍼 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `curl_code()` 정의(63행)·배선 라인 `curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"`(64행)·caller 캡처(102·122·130·137행 `code="$(curl_code ...)"`)·계약 주석("HTTP status code 만 반환 (응답 body 는 버림). --max-time 으로 hang 방지", 62행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 배선을 mirror 함을 앵커).
- [ ] **happy-path — buildCurlCodeArgv(timeout, rest)** — `buildCurlCodeArgv(timeout, rest)` 가 `["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", String(timeout), ...rest]`(64행 배선 동형)을 반환함을 assert. 여러 (timeout, rest) 조합으로 timeout 이 `--max-time` 뒤 위치·rest 가 뒤에 passthrough 됨을 실증(예: `buildCurlCodeArgv(10, ["-X","POST","http://x/api/users"])` → `[..., "--max-time","10","-X","POST","http://x/api/users"]`). 실 curl 실행 0(입력은 파라미터).
- [ ] **happy-path — curlCodeContract: silent·body-폐기·status-only·max-time·passthrough** — `curlCodeContract(defLine)` 가 64행 배선 라인을 파싱해 `{silent: true, bodyDiscardDevNull: true, statusCodeOnlyWrite: true, maxTimePositional: true, restPassthroughFromArg2: true}`(-s + -o /dev/null + -w '%{http_code}' + --max-time "${1}" + "${@:2}")를 반환함을 assert. 다섯 계약 요소 분리 실증.
- [ ] **happy-path — curlCodeCallerCaptures: 모든 caller 가 command-substitution 캡처** — `curlCodeCallerCaptures(shellSource)` 가 curl_code 호출부(102·122·130·137행)를 열거해 각 호출이 `code="$(curl_code ...)"` 형태(command-substitution `$(...)` 안에 캡처)임을 반환함을 assert. 네 caller 모두 status stdout 이 변수로 흡수됨(bare-stdout 방출 0) — 첫 인자가 timeout(10)·나머지가 URL/method/header/cookie passthrough 임을 정량 확인.
- [ ] **branch — body 폐기(`-o /dev/null`) 존재 → status 만 stdout** — 64행 배선이 `-o /dev/null`(body 폐기) 를 포함함을 정적 대조 assert. `curlCodeContract` 의 `bodyDiscardDevNull` 이 `-o /dev/null` 존재 시 true, 부재 시 false 임을 두 입력(정본 `-o /dev/null` / mutant `-o` 부재)으로 분리 실증(정본은 true — body 가 stdout 오염 0).
- [ ] **branch — status-only(`-w '%{http_code}'`) vs 다른 write-out 정적 대조** — 64행 배선이 `-w '%{http_code}'`(status code 방출)를 포함하고 `-w '%{time_total}'` 등 다른 metric 이 *아님* 을 정적 대조 assert. `statusCodeOnlyWrite` 가 `%{http_code}` 존재 시 true·부재/타 metric 시 false 임을 두 입력(정본 / mutant `%{time_total}`)으로 분리 실증.
- [ ] **branch — max-time positional(`--max-time "${1}"`) vs 부재 정적 대조** — 64행 배선이 `--max-time "${1}"`(첫 위치 인자 timeout)을 포함함을 정적 대조 assert. `maxTimePositional` 이 `--max-time "${1}"` 존재 시 true·부재 시 false 임을 두 입력(정본 / mutant `--max-time` 제거)으로 분리 실증(정본은 true — hang-guard 배선).
- [ ] **branch — passthrough(`"${@:2}"`) vs `"$@"` 정적 대조** — 64행 배선이 `"${@:2}"`(두 번째 인자부터 passthrough)를 포함하고 `"$@"`(전 인자, timeout 포함)가 *아님* 을 정적 대조 assert. `restPassthroughFromArg2` 가 `"${@:2}"` 존재 시 true·`"$@"` 시 false 임을 두 입력(정본 `"${@:2}"` / mutant `"$@"`)으로 분리 실증(정본은 true — timeout 이 URL 로 오배선 0).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0953 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — curl_code 앵커 부재 시 명시적 실패** — 추출 보조 함수가 배선 유도 표현(`curl_code()` 정의·`-s`·`-o /dev/null`·`-w '%{http_code}'`·`--max-time "${1}"`·`"${@:2}"`·caller `$(...)` 캡처) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **body 폐기 파괴 drift 변별** — 64행에서 `-o /dev/null` 을 제거한(→ 응답 body 가 status 앞에 stdout 오염) 모델 사본에서 "body 폐기(`-o /dev/null` 존재)" assert 가 실패함을 실증(caller `$(...)` 캡처가 오염값 얻는 회귀 검출). 원본 문자열/pure 함수 불변.
  - (b) **status-only → 타 metric drift 변별** — `-w '%{http_code}'` 를 `-w '%{time_total}'`(잘못된 metric)로 mutate 한 모델 사본에서 "status-code-only(`%{http_code}` 존재)" assert 가 실패함을 assert(status 미방출 회귀 검출). 원본 불변.
  - (c) **max-time 제거 drift 변별** — `--max-time "${1}"` 를 제거한 모델 사본에서 "max-time positional 존재" assert 가 실패함을 assert(hang-guard 소실 → 무한 대기 회귀 검출). 원본 불변.
  - (d) **passthrough → 전-인자 drift 변별** — `"${@:2}"` 를 `"$@"`(timeout 포함 전 인자)로 mutate 한 모델 사본에서 "passthrough from arg2(`"${@:2}"` 존재)" assert 가 실패함을 assert(첫 인자 timeout 이 URL 로 오배선되는 회귀 검출). 원본 불변.
  - (e) **caller bare-호출 drift 변별(stdout 순수성 상보)** — caller 중 하나를 `curl_code 10 "$URL"`(command-substitution 없는 bare 호출)로 mutate 한 모델 사본에서 `curlCodeCallerCaptures` 가 "모든 caller 가 `$(...)` 캡처" assert 를 실패시킴을 assert(status code 가 스크립트 bare-stdout 으로 새어 T-0953 stdout 순수성 깨는 회귀 검출). 원본 불변.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·buildCurlCodeArgv 산출·contract 파싱 결과·caller 캡처)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·env 실값·cookie 실값·password 실값 미등장(§9 / REQ-059). curl_code 검증은 flag 구조(silent/body-폐기/status-only/max-time/passthrough)만 다루고 실 payload(`$payload`·`$jar` 실값)를 담지 않음을 정적 확인 — caller 앵커에서 `"$payload"`/`"$SMOKE_PASSWORD"` 는 변수 참조 토큰이지 실값 아님을 확인.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(timeout·rest·shell 소스)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출/caller 열거를 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(shell 소스 사본·인자 배열)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `curl`/`bash`/`git`/gh 실행 0. 실 HTTP/network/소켓 0(파일 read + 정적 텍스트 추출 + argv 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. curl_code() 헬퍼(62~65행)·flag/passthrough·caller 캡처(102·122·130·137행) 미수정(drift 발견 시 별도 fix task). curl 배선을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + argv 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0953 표면 재단언 금지** — 진행 로그 라우팅 측(log() 의 `>&2`/`tee -a`/UTC/whole-message, 그 spec)은 T-0953 소관. 본 task 는 curl_code HTTP status 헬퍼(status-only/body-폐기/max-time/passthrough/caller-캡처)라는 helper-쌍 상보 surface 만. T-0953 spec 파일 변경 0. 단 caller-캡처 negative(e)는 T-0953 stdout 순수성의 curl_code 측 보증으로 상보 인용만(재단언 아님 — 387행 cat 유일-emitter 자체는 T-0953 소관).
- **T-0950/T-0951 표면 재단언 금지** — liveness 3-gate 결합(T-0950)·auth roundtrip 반환 code 분기(signup 201|409·login 200·me 200·cookie jar threading, T-0951)는 각 소관. 본 task 는 그 반환 code 를 *산출하는* curl_code 배선만(반환값의 분기는 다루지 않음). 해당 spec 파일들 변경 0.
- **T-0952 표면 재단언 금지** — step_health bounded polling(직접 `curl -s --max-time 5`, curl_code 미사용)은 T-0952 소관. 본 task 는 curl_code 헬퍼만. 그 spec 파일 변경 0.
- **T-0944~T-0949 표면 재단언 금지** — 집계(T-0944)·JSON dual-sink(T-0945)·prune(T-0946)·cascade(T-0947)·provenance(T-0948)·gating(T-0949)는 각 소관. 본 task 는 curl_code distinct surface 만. 해당 spec 파일들 변경 0.
- **실 HTTP 호출 / 실 curl 실행 금지** — 본 spec 은 non-gated 정적 파일 read + argv pure 함수 only. 실 curl/HTTP/network/소켓·실 status code round-trip 도입 0(그건 실 nightly 실행 소관).
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0953 log() 헬퍼 smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 curl_code 유도 표현(62~65행 정의 + 102·122·130·137행 caller 캡처)을 정적 앵커로 추출 + argv 동형 pure 함수(`buildCurlCodeArgv`·`curlCodeContract`·`curlCodeCallerCaptures`)로 silent(`-s`)·body-폐기(`-o /dev/null`)·status-only(`-w '%{http_code}'`)·max-time hang-guard positional(`--max-time "${1}"`)·argv passthrough from arg2(`"${@:2}"`)·caller command-substitution 캡처(stdout 비오염) 불변식 assert. happy(앵커 추출·buildCurlCodeArgv·curlCodeContract·caller 캡처)/branch(body 폐기·status-only vs 타 metric·max-time positional·passthrough vs `"$@"`)/error(파일 부재·앵커 부재)/negative(body 폐기 파괴·status-only 타 metric·max-time 제거·passthrough 전-인자·caller bare-호출·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 curl/HTTP/network 실행 0, credential/env/cookie/password 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
