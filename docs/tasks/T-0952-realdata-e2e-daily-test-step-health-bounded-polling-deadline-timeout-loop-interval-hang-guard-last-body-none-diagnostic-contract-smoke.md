---
id: T-0952
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **step_health bounded-polling deadline/timeout 루프 계약**을 정적 검증하는 non-gated build-time smoke — 배포 앱이 `GET /api == HEALTH_MESSAGE` 로 준비될 때까지 *유한하게* 폴링하는 health-gate 의 **deadline = now + HEALTH_TIMEOUT 유한-경계 산출 + strict `-lt` 배타-상한 while 루프 + per-request `--max-time 5` hang guard + `|| true` non-fatal(요청 실패→빈 body→폴링 지속) + `sleep 3` 폴링 간격 + 첫-일치 early-exit(return 0) + deadline 경과 TIMEOUT 진단(`마지막 응답='${body:-<none>}'` last-body <none> fallback → return 1)** 을 봉함(무인 nightly 가 배포 앱의 준비-대기를 무한-hang 없이 유한 시간에 판정함을 신뢰). 계약: **(a) 유한-경계 deadline 산출**(82행 `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))` — 시작 epoch + HEALTH_TIMEOUT(기본 180, 45행 env override `${HEALTH_TIMEOUT:-180}`) = 폴링 종료 시각, 무한-대기 금지의 경계) · **(b) strict `-lt` 배타-상한 bounded 루프**(83행 `while [ "$(date +%s)" -lt "$deadline" ]` — 현재 epoch < deadline 인 동안만 폴링, deadline 도달 시 루프 종료 — 유한 반복) · **(c) per-request hang guard + non-fatal**(84행 `body="$(curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true)"` — 각 요청 5초 상한(개별 요청 hang 이 전체 deadline 을 무력화하지 못함) + `|| true` 로 요청 실패 시 빈 body 로 폴링 지속(transient 실패 non-fatal)) · **(d) `sleep 3` 폴링 간격**(89행 — 재시도 사이 3초 대기, busy-loop 로 서버·CPU 를 두드리지 않음) · **(e) 첫-일치 early-exit**(85~87행 `if [ "$body" = "$HEALTH_MESSAGE" ]; then log OK; return 0` — 첫 폴링에서 body 가 기대 health 메시지와 일치하면 즉시 OK 반환, 나머지 폴링 미실행) · **(f) deadline 경과 TIMEOUT 진단**(91~92행 `log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"; return 1` — 루프가 일치 없이 소진되면 *마지막* 응답 body 를 `${body:-<none>}` fallback(빈/미설정 시 `<none>`)로만 진단하고 FAIL(return 1)). 불변식: step_health 는 `now + HEALTH_TIMEOUT` 이라는 유한 deadline 안에서 strict `-lt` 배타-상한으로 폴링하며, 각 요청은 `--max-time 5` 로 개별 hang 을 막고 `|| true` 로 transient 실패를 non-fatal 하게(빈 body→지속) 흡수하고, 재시도는 `sleep 3` 간격을 두며, body 가 기대 health 메시지와 일치하는 *첫* 폴링에서 early-exit(return 0)하고, deadline 이 일치 없이 경과하면 마지막 body 를 `<none>` fallback 진단으로만 노출하며 FAIL(return 1) — 무인 nightly 가 배포 앱의 준비-대기를 무한-hang 0·busy-loop 0 으로 유한 시간에 판정. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) health 폴링 유도 표현(45·79~93행)을 정적 추출 + 폴링-루프 동형 pure 함수(`healthDeadline`/`isBeforeDeadline`/`healthPollOutcome`/`healthTimeoutDiagnostic`)로 유한-경계·배타-상한·hang-guard·non-fatal·간격·early-exit·TIMEOUT-fallback 불변식 assert. T-0792(HTTP path·method·status + HEALTH_MESSAGE↔APP_STATUS_MESSAGE byte-parity — *폴링 루프 mechanics 제외*)·T-0950(liveness 3-gate 합취 — step_health 슬라이스를 superset 대조로만 취급, 폴링 deadline/간격/timeout mechanics 미cover)·T-0947(step-chain SKIP cascade — health 를 black-box gate 로만 취급)·T-0944~T-0949(집계·dual-sink·prune·provenance·gating-env) 가 미cover 한 **step_health 내부 bounded-polling deadline/timeout 루프 mechanics** gap 상보 표면. 실 health curl·실 HTTP·실 sleep·실 date·gh·git 0·process.env 읽기 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 375
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-step-health-bounded-polling-deadline-timeout-loop-interval-hang-guard-last-body-none-diagnostic-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-step-health-polling-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0951) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(유한-경계 deadline + strict -lt 배타-상한 루프 + per-request hang guard + || true non-fatal + sleep 3 간격 + first-match early-exit + TIMEOUT <none> fallback 진단)의 happy/branch/error/negative full cover 에 ~375 LOC 필요, T-0951 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step② — T-0951 step_auth round-trip 봉함 뒤, 배포 앱 준비-대기를 무한-hang 없이 유한 판정하는 step_health 의 내부 bounded-polling(deadline=now+HEALTH_TIMEOUT·strict -lt 배타-상한 루프·per-request --max-time 5 hang guard·|| true non-fatal·sleep 3 간격·first-match early-exit·deadline 경과 TIMEOUT <none> fallback 진단) mechanics 를 정적 smoke 로 봉함. T-0792(HEALTH_MESSAGE↔APP_STATUS_MESSAGE parity·path/method/status — 폴링 mechanics 제외)/T-0950(liveness superset 대조)/T-0947(cascade black-box gate) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0952 — realdata-e2e nightly step_health bounded-polling deadline/timeout 루프 정적 smoke (유한-경계 deadline · strict `-lt` 배타-상한 · per-request `--max-time 5` hang guard · `|| true` non-fatal · `sleep 3` 간격 · first-match early-exit · TIMEOUT `<none>` fallback 진단)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step② 는 `deploy/daily-test.sh` nightly runner 가 재배포 직후 기동 중인 컨테이너를 `GET /api` 로 폴링해 앱이 준비될 때까지 대기함을 명시한다. Pi5(arm64) 는 빌드·부팅이 느려 컨테이너가 곧바로 응답하지 않으므로, health-gate 는 **유한한 deadline 안에서 반복 폴링**해 준비를 기다리되 **무한 hang 없이** 유한 시간에 PASS/FAIL 를 판정해야 한다. `step_health`(79~93행)가 이를 담당한다:

1. **deadline 산출**(82행) — `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))`. 시작 epoch + HEALTH_TIMEOUT(기본 180초, 45행 `HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"`) = 폴링을 끝낼 절대 시각. 이 유한 경계가 무한-대기를 금지한다.
2. **bounded 폴링 루프**(83~90행) — `while [ "$(date +%s)" -lt "$deadline" ]; do ... done`. 현재 epoch 가 deadline *미만*(strict `-lt` — 배타 상한)인 동안만 반복. 매 반복:
   - 84행 `body="$(curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true)"` — 각 요청은 `--max-time 5` 로 5초 상한(개별 요청 hang 이 전체 deadline 을 무력화하지 못함) + `2>/dev/null || true` 로 요청 실패 시 빈 body 로 폴링을 *지속*(transient 실패 non-fatal).
   - 85~87행 `if [ "$body" = "$HEALTH_MESSAGE" ]; then log "step health: OK"; return 0; fi` — body 가 기대 health 메시지와 일치하면 *즉시* OK 반환(첫-일치 early-exit — 나머지 폴링 미실행).
   - 89행 `sleep 3` — 재시도 사이 3초 대기(busy-loop 금지).
3. **TIMEOUT 진단**(91~92행) — 루프가 일치 없이 소진되면 `log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"; return 1`. *마지막* 응답 body 를 `${body:-<none>}` fallback(빈/미설정 시 리터럴 `<none>`)로만 진단하고 FAIL 반환.

이 폴링 루프를 관통하는 **불변식**: **step_health 는 `now + HEALTH_TIMEOUT` 이라는 유한 deadline 안에서 strict `-lt` 배타-상한으로 폴링하며, 각 요청은 `--max-time 5` 로 개별 hang 을 막고 `|| true` 로 transient 실패를 non-fatal 하게(빈 body→지속) 흡수하고, 재시도는 `sleep 3` 간격을 두며, body 가 기대 health 메시지와 일치하는 *첫* 폴링에서 early-exit(return 0)하고, deadline 이 일치 없이 경과하면 마지막 body 를 `<none>` fallback 진단으로만 노출하며 FAIL(return 1).** 이 불변식이 무인 nightly 가 "배포 앱의 준비-대기를 무한-hang 0·busy-loop 0 으로 유한 시간에 판정" 하는 신뢰의 핵심이다:

- **유한-경계 deadline + strict `-lt` 배타-상한** — deadline 은 시작 시각 + HEALTH_TIMEOUT 로 *한 번* 산출되고, 루프는 현재 시각이 그 미만인 동안만 돈다. 이 경계가 사라지거나(무한 루프) 상한이 배타(`-lt`)가 아니라 무경계로 바뀌면, 준비되지 않는 앱에 대해 nightly 가 영원히 hang 해 다음 step(liveness/auth/eval)로 진행하지 못하고 cron 다음 발화까지 lock 을 물고 있게 된다.
- **per-request `--max-time 5` hang guard** — 전체 deadline 이 유한해도, *개별* curl 요청이 무한 hang 하면 (예: 앱이 TCP 는 열되 응답 안 함) 전체 deadline 이 무력화된다. 각 요청 5초 상한이 이를 막는다. 이 guard 가 빠지면 개별 요청 hang 하나가 deadline 경계를 우회해 무한-대기를 재도입한다.
- **`|| true` non-fatal** — 컨테이너 재기동 중에는 curl 이 connection-refused 로 실패하는 것이 정상이다. `|| true` 가 이 transient 실패를 빈 body 로 흡수해 폴링을 *지속*시킨다. 이 guard 가 빠지면 첫 transient 실패가 폴링을 중단시켜(정상 부팅 지연을 장애로 오판) false-negative 를 낸다.
- **`sleep 3` 폴링 간격** — 재시도 사이 3초 대기가 없으면 busy-loop 로 서버·CPU·로그를 3초에 수백 회 두드려, 부팅 중인 느린 Pi5 를 더 압박하고 로그를 오염시킨다.
- **첫-일치 early-exit** — body 가 일치하는 첫 폴링에서 즉시 return 0 해야 불필요한 대기 없이 다음 step 으로 진행한다. early-exit 이 깨지면 준비된 앱에도 남은 deadline 만큼 헛대기한다.
- **TIMEOUT `<none>` fallback 진단** — 실패 시 *마지막* 응답 body 를 `${body:-<none>}` 로 진단해 "무엇을 마지막으로 받았나"(빈 응답이면 `<none>`)를 무인 모니터링에 남긴다. 이 fallback 이 빠지면 빈-body 케이스에서 진단이 `마지막 응답=''` 같이 모호해지고, body 전체 raw echo 로 바뀌면 §9 정합(민감 응답 노출) 위험이 생긴다.

그러나 이 **step_health 내부 bounded-polling deadline/timeout 루프 mechanics** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0792**(http-step-contract-nestjs-route-decorator-parity)는 step_health 가 두드리는 endpoint 의 **path·HTTP method·기대 status ↔ NestJS route decorator parity** 와 **HEALTH_MESSAGE ↔ `src/app.service.ts` APP_STATUS_MESSAGE byte-parity**(그 spec 301행)만 봉하고, **폴링 루프 mechanics(deadline 산출·배타-상한·hang guard·non-fatal·간격·early-exit·TIMEOUT fallback)는 명시적으로 범위 밖**.
- **T-0950**(liveness 3-gate 합취)는 step_health 슬라이스를 **liveness 가 health 의 superset 임 대조용**으로만 취급(그 spec 158~160·269행) — health 의 *폴링 deadline/간격/timeout mechanics* 는 다루지 않음. liveness gate① 의 `${body:-<none>}` placeholder(99·105·109행)는 *liveness* 진단이며, step_health 의 91행 *TIMEOUT* 진단과는 다른 라인·맥락이다.
- **T-0947**(step-chain SKIP-propagation cascade)는 health 를 **black-box gate**(PASS→liveness/auth 실행 else SKIP)로만 취급 — health *내부* 폴링 루프는 다루지 않음.
- **T-0944~T-0949** 는 각각 집계·dual-sink·prune·provenance·gating-env 완전성만 봉함 — 어느 것도 health 폴링을 다루지 않음.

만약 누군가 deadline 산출을 제거하거나(→ 무한 루프), strict `-lt` 를 무경계로 바꾸거나(→ 무한 대기), `--max-time 5` 를 빼거나(→ 개별 요청 hang 이 deadline 우회), `|| true` 를 빼거나(→ transient 실패가 폴링 중단 false-negative), `sleep 3` 을 빼거나(→ busy-loop), TIMEOUT 진단의 `<none>` fallback 을 raw echo 로 바꾸면(→ 모호/§9 위험), 무인 nightly 는 무한-hang·busy-loop·false-negative·정보 노출의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0951/T-0950 과 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + 폴링-루프 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 health 폴링 유도 표현(45·79~93행)을 정적 추출하고, 폴링-루프 동형 pure 함수(`healthDeadline`·`isBeforeDeadline`·`healthPollOutcome`·`healthTimeoutDiagnostic`)로 유한-경계·배타-상한·hang-guard·non-fatal·간격·early-exit·TIMEOUT-fallback 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 health curl·실 HTTP·실 sleep·실 date·실 gh·실 git 0. process.env 읽기 0 / 폴링 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 폴링 루프·deadline·timeout 은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 네트워크 / 실 wall-clock 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 health-polling contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — step_health 함수/deadline/루프/간격 미수정, drift 발견 시 별도 fix task). T-0792 표면 재단언 0(T-0792 는 path·method·status parity + HEALTH_MESSAGE↔APP_STATUS_MESSAGE byte-parity — 본 task 는 그 message-parity 를 재단언하지 *않고* step_health *내부* 폴링 mechanics 만). T-0950 표면 재단언 0(liveness 3-gate 합취·liveness gate① 진단). T-0947/T-0944~T-0949 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 79~93행 `step_health()`(82행 `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))`, 83행 `while [ "$(date +%s)" -lt "$deadline" ]`, 84행 `curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true`, 85행 `[ "$body" = "$HEALTH_MESSAGE" ]` → return 0, 89행 `sleep 3`, 91행 `log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"` → return 1)로 bounded 폴링을 산출 + 45행 `HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"` — 본 smoke 가 이 폴링 앵커들을 잡고 health-polling contract 를 봉한다. T-0792 는 폴링 mechanics 를 제외(path/method/status + message byte-parity 만), T-0950 은 health 슬라이스를 superset 대조로만 취급 → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step② nightly runner 가 재배포 후 기동 중인 컨테이너를 `GET /api` 로 폴링해 준비 대기)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 health 폴링 앵커를 정확히 추출·검증:
  - 45행 `HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"` — env override default 180(폴링 deadline 경계의 기본값).
  - 48행 `readonly HEALTH_MESSAGE="Assessment-Agent"` — 폴링 성공 판정에 쓰는 기대 메시지(본 task 는 이 값을 *성공 gate 입력 fixture* 로만 쓰고, 그 값이 `src/app.service.ts` APP_STATUS_MESSAGE 와 byte-parity 임은 재단언 0 — 그건 T-0792 소관).
  - 79~93행 `step_health()` — **bounded 폴링 루프 함수 전체**:
    - 82행 deadline 산출 — `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))`.
    - 83행 bounded 루프 — `while [ "$(date +%s)" -lt "$deadline" ]; do`(strict `-lt` 배타 상한).
    - 84행 요청 — `body="$(curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true)"`(`--max-time 5` hang guard + `|| true` non-fatal).
    - 85~87행 성공 gate — `if [ "$body" = "$HEALTH_MESSAGE" ]; then log "step health: OK"; return 0; fi`(첫-일치 early-exit).
    - 89행 간격 — `sleep 3`.
    - 91~92행 TIMEOUT — `log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"; return 1`(last-body `<none>` fallback).
- `test/smoke/realdata-e2e-daily-test-auth-signup-login-me-roundtrip-cookie-jar-threading-idempotent-branch-failfast-secret-safe-diagnostic-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0951)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 auth round-trip 을 재단언하지 않고**(그건 T-0951 소관), **step_health bounded-polling deadline/timeout 루프 mechanics** 라는 distinct surface 만 봉한다.
- `test/smoke/realdata-e2e-daily-test-http-step-contract-nestjs-route-decorator-parity-drift.smoke-spec.ts` — **경계 대조(T-0792, 읽기만 — 재단언 방지)**. 이 spec 이 step_health 의 path·method·status parity + HEALTH_MESSAGE↔APP_STATUS_MESSAGE byte-parity(그 301행)를 이미 봉함을 확인해, 본 task 가 그 표면을 재단언하지 않고 *폴링 루프 mechanics* 만 다룸을 보증. 이 파일 변경 0.
- `test/smoke/realdata-e2e-daily-test-liveness-app-alive-three-gate-conjunction-spa-html-detection-per-condition-diagnostic-contract.smoke-spec.ts` — **경계 대조(T-0950, 읽기만 — 재단언 방지)**. 이 spec 이 step_health 슬라이스를 *liveness superset 대조*(158~160·269행)로만 쓰고 폴링 mechanics 를 다루지 않음을 확인해, 본 task 가 폴링 deadline/간격/timeout 을 distinct 하게 봉함을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-step-health-bounded-polling-deadline-timeout-loop-interval-hang-guard-last-body-none-diagnostic-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) health 폴링 유도 표현(45·79~93행)을 정적 추출하고, 폴링-루프 동형 pure 함수(`healthDeadline`·`isBeforeDeadline`·`healthPollOutcome`·`healthTimeoutDiagnostic`)로 유한-경계·배타-상한·hang-guard·non-fatal·간격·early-exit·TIMEOUT-fallback 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash/curl/date/sleep 실행 0)라 public CI 에서 항상 실행돼 green. 실 health curl/HTTP/wall-clock/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — step_health 폴링 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `step_health()` 정의(79행)·deadline 산출 `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))`(82행)·bounded 루프 `while [ "$(date +%s)" -lt "$deadline" ]`(83행)·요청 `curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true`(84행)·성공 gate `[ "$body" = "$HEALTH_MESSAGE" ]` + `return 0`(85~87행)·`sleep 3`(89행)·TIMEOUT `마지막 응답='${body:-<none>}'` + `return 1`(91~92행)·`HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"`(45행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 폴링 루프를 mirror 함을 앵커).
- [ ] **happy-path — healthDeadline(start + timeout)** — `healthDeadline(startEpoch, timeoutSec)` 가 `startEpoch + timeoutSec` 를 반환함을 assert(82행 산술 동형). 기본 timeout 180(45행 default) 및 override 값(예: 60)으로 각각 호출해 deadline 이 시작 + 해당 timeout 임을 실증.
- [ ] **happy-path — 준비된 앱: 첫-일치 early-exit → OK** — `healthPollOutcome({polls, deadline, expectedMessage})` 가 body 가 expectedMessage 와 일치하는 *첫* poll 에서 `{ok:true, matchedAtIndex:0, polled:1}`(return 0 동형, 나머지 poll 미소비)를 반환함을 assert. 첫 poll 즉시 일치(polled==1) 및 3번째 poll 에서 일치(앞 2회는 빈/불일치 body — polled==3, matchedAtIndex==2) 두 케이스로 early-exit 이 *첫 일치* 에서 멈춤을 실증(실 curl/sleep 0 — 입력은 poll 관측 시퀀스 파라미터).
- [ ] **happy-path — isBeforeDeadline(strict `-lt` 배타 상한)** — `isBeforeDeadline(nowEpoch, deadline)` 가 `nowEpoch < deadline` 에서 true, `nowEpoch == deadline`(경계 정확 도달) 및 `nowEpoch > deadline` 에서 false 를 반환함을 assert(83행 strict `-lt` 배타 상한 — deadline 도달 순간 루프 종료). 경계값(deadline-1 true / deadline false / deadline+1 false)을 분리 실증.
- [ ] **branch — hang guard(`--max-time 5`) + non-fatal(`|| true`) 정적 대조** — 84행 요청 표현이 `--max-time 5`(per-request hang 상한) *그리고* `2>/dev/null || true`(요청 실패 시 빈 body non-fatal)를 *둘 다* 포함함을 정적 대조 assert. 두 guard 가 각각 존재하고 같은 요청 라인에 결합돼 있음을 분리 확인(하나라도 누락이면 fail).
- [ ] **branch — transient 요청 실패 → 빈 body → 폴링 지속(non-fatal)** — `healthPollOutcome` 에 중간 poll 이 빈 body(요청 실패 흡수)인 시퀀스(예: `["", "", "Assessment-Agent"]`)를 주면 빈 body 폴링을 *중단하지 않고* 지속해 이후 일치 poll 에서 `{ok:true, matchedAtIndex:2}` 를 반환함을 assert(`|| true` non-fatal 동형 — transient 실패가 폴링을 죽이지 않음). 모든 poll 이 빈 body(일치 0)면 `{ok:false}` + 마지막 body="" 임을 별도 확인.
- [ ] **branch — deadline 경과 → TIMEOUT + last-body `<none>` fallback 진단** — 어떤 poll 도 일치하지 않고 deadline 이 경과한 입력에서 `healthPollOutcome` 가 `{ok:false, lastBody}`(return 1 동형)를 반환하고, `healthTimeoutDiagnostic(lastBody)` 가 `step health: TIMEOUT (마지막 응답='<lastBody>')` 형태를 내되 lastBody 가 빈/undefined 이면 `<none>` fallback 을 씀을 assert. lastBody="<some>"(비어있지 않음 — 그대로) 과 lastBody=""(→ `<none>`) 두 케이스를 분리 실증(91행 `${body:-<none>}` 동형).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0951 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — health 폴링 앵커 부재 시 명시적 실패** — 추출 보조 함수가 폴링 유도 표현(step_health 정의·deadline 산출·`-lt` 루프·`--max-time 5`·`|| true`·`sleep 3`·성공 gate·TIMEOUT `<none>`) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **유한-경계 deadline 제거 drift 변별** — `isBeforeDeadline` 을 항상 true(deadline 무시 — 무한 루프)로 약화한 모델 사본에서 "nowEpoch == deadline 이면 루프 종료(false)" assert 가 실패함을 실증(무한-hang 회귀 검출). 원본 pure 함수 불변.
  - (b) **strict `-lt` → 무경계 drift 변별** — `isBeforeDeadline` 을 `nowEpoch <= deadline`(배타→포함) 또는 무경계로 mutate 한 모델 사본에서 "deadline 정확 도달 시 false(배타 상한)" assert 가 실패함을 assert(경계 우회 회귀 검출). 원본 불변.
  - (c) **hang guard(`--max-time 5`) 누락 drift 변별** — 요청 표현에서 `--max-time 5` 를 뺀 모델 사본에서 "per-request hang guard 존재" 정적 assert 가 실패함을 assert(개별 요청 무한-hang 재도입 회귀 검출). 원본 불변.
  - (d) **non-fatal(`|| true`) 제거 → transient 실패가 폴링 중단 drift 변별** — `healthPollOutcome` 를 빈 body(요청 실패) 만나면 즉시 중단(`|| true` 제거 동형)하도록 mutate 한 모델 사본에서 "빈 body 폴링 지속 → 이후 일치 poll OK" assert 가 실패함을 assert(transient 실패 false-negative 회귀 검출). 원본 불변.
  - (e) **TIMEOUT `<none>` fallback → raw echo drift 변별** — `healthTimeoutDiagnostic` 를 `<none>` fallback 없이 빈 body 를 그대로(또는 body 전체 raw echo) 내도록 mutate 한 모델 사본에서 "빈 last-body 는 `<none>` 로 진단(raw echo 0)" assert 가 실패함을 assert(진단 모호/§9 raw 노출 회귀 검출). 실 소스 91행이 `${body:-<none>}` fallback 임을 정적 확인. 원본 불변.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·진단·poll body·deadline 값)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·env 실값·cookie 실값 미등장(§9 / REQ-059). TIMEOUT 진단은 last-body(HEALTH_MESSAGE app-status 또는 `<none>`)만 노출하고 credential 을 담지 않음을 정적 확인.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(poll 시퀀스·deadline·start/timeout)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(poll 시퀀스 사본·shell 소스 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `curl`/`bash`/`sleep`/`date`/`git`/gh 실행 0. 실 health 폴링·HTTP·네트워크 요청·실 wall-clock 0(파일 read + 정적 텍스트 추출 + 폴링-루프 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. health 폴링 유도 표현(45·79~93행)·deadline·루프·간격·timeout 미수정(drift 발견 시 별도 fix task). step_health 로직을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 폴링-루프 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0792 표면 재단언 금지** — step_health 가 두드리는 endpoint 의 HTTP path·method·기대 status ↔ NestJS route decorator parity + HEALTH_MESSAGE ↔ `src/app.service.ts` APP_STATUS_MESSAGE byte-parity(그 spec 301행)는 T-0792 소관. 본 task 는 step_health *내부* 폴링 루프 mechanics(deadline 산출·배타-상한·hang guard·non-fatal·간격·early-exit·TIMEOUT fallback) 라는 distinct surface 만. T-0792 spec 파일 변경 0. HEALTH_MESSAGE 값의 cross-file parity 재검증 0(본 task 는 HEALTH_MESSAGE 를 *성공 gate 입력 fixture* 로만 사용).
- **T-0950 표면 재단언 금지** — liveness 3-gate 합취(GET /api 일치 + GET / 200 + SPA HTML) 및 liveness gate① 진단(99·105·109행 `${body:-<none>}`)은 T-0950 소관. 본 task 는 step_health 폴링 mechanics + step_health TIMEOUT 진단(91행, liveness gate 와 다른 라인·맥락)만. T-0950 spec 파일 변경 0. liveness 합취/SPA 검출 재검증 0.
- **T-0947 표면 재단언 금지** — step-chain SKIP-propagation cascade(health==PASS → liveness/auth 실행 else SKIP)는 T-0947 소관(health 를 black-box gate 로 취급). 본 task 는 step_health 함수 *내부* 폴링 루프만. T-0947 spec 파일 변경 0. cascade/gate call-site 재검증 0.
- **T-0944~T-0946·T-0948·T-0949 표면 재단언 금지** — 집계 값(T-0944)·dual-sink(T-0945)·로그 prune(T-0946)·스칼라 provenance(T-0948)·gating-env 완전성(T-0949)은 각 소관. 본 task 는 step_health 폴링 distinct surface 만. 해당 spec 파일들 변경 0.
- **실 앱 기동 / 실 health 폴링 금지** — 본 spec 은 non-gated 정적 파일 read + 폴링-루프 pure 함수 only. 실 컨테이너 기동·실 curl/HTTP 폴링·실 sleep/wall-clock·실 date 도입 0(그건 실 nightly 실행 소관). NestJS health endpoint e2e 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0951 auth round-trip smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 health 폴링 유도 표현(45·79~93행)을 정적 앵커로 추출 + 폴링-루프 동형 pure 함수(`healthDeadline`·`isBeforeDeadline`·`healthPollOutcome`·`healthTimeoutDiagnostic`)로 유한-경계·strict `-lt` 배타-상한·`--max-time 5` hang-guard·`|| true` non-fatal·`sleep 3` 간격·first-match early-exit·TIMEOUT `<none>` fallback 진단 불변식 assert. happy(앵커 추출·deadline 산출·early-exit·isBeforeDeadline)/branch(hang-guard+non-fatal 대조·transient 실패 지속·deadline 경과 TIMEOUT fallback)/error(파일 부재·앵커 부재)/negative(deadline 제거·배타→포함·hang-guard 누락·non-fatal 제거·`<none>` raw echo·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 curl/bash/sleep/date/HTTP 0, credential/env 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
