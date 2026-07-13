---
id: T-0953
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **log() 헬퍼 stderr 라우팅 · stdout 순수성 계약**을 정적 검증하는 non-gated build-time smoke — 모든 진행 로그가 로그 파일 append + stderr 로만 이중 방출되고 **stdout 은 절대 오염되지 않아** 무인 모니터링 routine 이 파싱하는 stdout 이 오직 최종 머신 JSON(387행 `cat "$RESULT_JSON"`)만 담음을 봉함(T-0945 가 JSON *방출* 측을 봉한 것의 상보 — "진행 로그는 stdout 으로 새지 않는다" stdout-순수성 측). 계약 (a) **stderr+파일 이중 sink**(59행 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2` — tee 가 로그 파일에 append + 그 tee 출력을 `>&2` 로 stderr 에 방출) · (b) **stdout 순수성**(`>&2` 가 tee 의 stdout 을 stderr 로 돌려 log() 는 stdout 에 0 byte — 유일한 bare-stdout 방출은 387행 `cat "$RESULT_JSON"`) · (c) **append 누적**(`tee -a` — overwrite `>` 아님, 한 run 의 모든 로그 라인이 로그 파일에 누적) · (d) **UTC timestamp 접두**(`date -u +%H:%M:%S` → `[HH:MM:SS]` 접두, 로컬 TZ 아님) · (e) **whole-message pass**(`"$*"` — 모든 인자를 join 해 한 줄로) · (f) **stdout 은 JSON 전용 주석 계약**(27~28·57행 "stdout 은 JSON 전용이라 건드리지 않음" — log() 가 이를 구조적으로 보장). 불변식: 모든 진행 로그는 `tee -a "$LOG_FILE" >&2` 로 로그 파일 append + stderr 이중 방출되며 stdout 에는 0 byte 를 쓰고(UTC `[HH:MM:SS]` 접두 + `"$*"` whole-message), 스크립트 전체에서 stdout 에 방출하는 라인은 오직 387행 최종 `cat "$RESULT_JSON"` 하나뿐 — 무인 routine 이 stdout 을 순수 JSON 으로 파싱할 수 있음의 근원. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) log 헬퍼 유도 표현(27~28·57~60·387행)을 정적 추출 + 라우팅 동형 pure 함수(`formatLogLine`/`logRouteTargets`/`stdoutEmitterLines`)로 stderr-이중-sink·stdout-순수성·append·UTC-timestamp·whole-message 불변식 assert. T-0945(머신 JSON dual-sink file+stdout cat single-source — *JSON 방출* 측만, 진행 로그 stderr 라우팅 제외)·T-0948(스칼라 provenance)·T-0944(집계 값)·T-0946(로그 prune)·T-0947(cascade)·T-0949~T-0952(gating/liveness/auth/health) 가 미cover 한 **log() 헬퍼 stderr 라우팅 + stdout 순수성** gap 상보 표면. 실 log 실행·실 tee·실 stderr·실 date·gh·git 0·process.env 읽기 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 370
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-log-helper-stderr-dual-sink-stdout-purity-tee-append-utc-timestamp-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-log-helper-stdout-purity-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0952) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(stderr+파일 이중 sink + stdout 순수성 + tee -a append + UTC timestamp + whole-message + 유일 stdout emitter=cat)의 happy/branch/error/negative full cover 에 ~370 LOC 필요, T-0945/T-0952 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step④ — T-0952 step_health 폴링 봉함 뒤, 무인 routine 이 stdout 을 순수 JSON 으로 파싱하는 근원인 log() 헬퍼의 stderr 이중-sink(tee -a $LOG_FILE >&2)·stdout 순수성(유일 stdout emitter=387행 cat)·append·UTC timestamp·whole-message 계약을 정적 smoke 로 봉함. T-0945(JSON 방출 측 dual-sink — 진행 로그 라우팅 제외) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0953 — realdata-e2e nightly log() 헬퍼 stderr 라우팅 · stdout 순수성 정적 smoke (stderr+파일 이중 sink · `tee -a` append · UTC `[HH:MM:SS]` timestamp · whole-message `"$*"` · 유일 stdout emitter=387행 `cat`)

## Why

`deploy/daily-test.sh` 는 두 종류의 출력을 낸다(27~28행 주석): **사람용 진행 로그**는 로그 파일 + stderr 로, **머신 요약 JSON** 한 줄은 stdout 으로 분리 방출한다. 이 분리의 목적은 로컬 무인 모니터링 routine 이 **stdout 을 깔끔한 JSON 으로 파싱**할 수 있게 하는 것이다(28행 "루틴이 stdout 을 JSON 으로 깔끔히 파싱할 수 있도록"). 이 분리를 구조적으로 보장하는 것이 `log()` 헬퍼(57~60행)다:

```bash
log() {
  printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2
}
```

1. **stderr + 파일 이중 sink**(59행) — `printf ... | tee -a "$LOG_FILE" >&2`. `tee -a` 가 진행 메시지를 로그 파일에 **append** 하고, tee 의 표준출력을 `>&2` 로 **stderr** 에 방출한다. 즉 한 로그 라인은 파일 + stderr **두 곳**에 간다.
2. **stdout 순수성** — 결정적으로 `>&2` 가 tee 의 stdout 을 stderr 로 돌려, `log()` 는 **stdout 에 0 byte** 를 쓴다. 스크립트 전체에서 stdout 에 방출하는 라인은 오직 387행 `cat "$RESULT_JSON"`(최종 머신 JSON re-emit) **하나뿐**이다. 모든 step 의 OK/FAIL/TIMEOUT/SKIP 진단은 `log()` 를 거쳐 stderr 로 가므로 stdout 을 오염시키지 않는다.
3. **UTC timestamp 접두**(59행) — `date -u +%H:%M:%S` → `[HH:MM:SS]`. 로컬 TZ 아닌 UTC 로 각 로그 라인에 시각 접두를 붙인다(59행 주석: log 는 "진행 메시지를 로그 파일과 stderr 양쪽에 기록").
4. **whole-message pass**(59행) — `"$*"` 로 호출자의 모든 인자를 한 줄로 join 해 방출.

이 헬퍼를 관통하는 **불변식**: **모든 진행 로그는 `tee -a "$LOG_FILE" >&2` 로 로그 파일 append + stderr 이중 방출되며 stdout 에는 0 byte 를 쓰고(UTC `[HH:MM:SS]` 접두 + `"$*"` whole-message), 스크립트 전체에서 stdout 에 방출하는 라인은 오직 387행 최종 `cat "$RESULT_JSON"` 하나뿐이다.** 이 불변식이 "무인 routine 이 stdout 을 순수 JSON 으로 파싱" 하는 신뢰의 근원이다:

- **stderr 이중 sink + stdout 순수성** — `>&2` 가 빠지면(또는 tee 가 stdout 으로 흘리면) 모든 진행 로그가 stdout 으로 새어나가, 무인 routine 이 stdout 에서 JSON 을 파싱할 때 `[HH:MM:SS] step health: OK` 같은 사람용 로그 라인이 JSON 앞에 섞여 파싱이 깨진다(false 신호 / crash). stdout 순수성은 머신-JSON 파싱 계약의 전제다.
- **`tee -a` append 누적** — `-a`(append) 대신 `>`(overwrite) 로 바뀌면 각 로그 라인이 이전 라인을 덮어써, 로그 파일에 마지막 한 줄만 남고 run 전체 이력이 소실된다(사후 디버깅 불가). `-a` 가 한 run 의 모든 로그를 누적한다.
- **UTC timestamp** — `date -u` 가 아닌 로컬 `date` 로 바뀌면 배포 기기 TZ 에 따라 로그 시각이 흔들려 여러 기기·로그 상관이 어긋난다.
- **유일 stdout emitter = 387행 cat** — stdout 방출자가 log() 로 하나 더 늘거나 중간 step 이 stdout 에 echo 하면 stdout 순수성이 깨진다. 스크립트 전체에서 stdout 에 쓰는 라인이 정확히 1개(387행 cat)임이 순수성의 정량 보증이다.

그러나 이 **log() 헬퍼 stderr 라우팅 + stdout 순수성** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0945**(machine-result-json-dual-sink-file-stdout-cat-single-source)는 **머신 JSON 방출 측**만 봉한다 — printf 발생==1·overwrite redirect·stdout==그 파일 `cat` 재읽기(single-source). 즉 "stdout 이 담는 JSON 이 어떻게 만들어지나" 만 다루고, **진행 로그가 stdout 으로 새지 않도록 stderr 로 라우팅되는가**(log() 헬퍼의 `>&2`/`tee -a`/UTC/whole-message) 는 명시적으로 범위 밖. 본 task 는 그 상보 측(stdout-순수성 = 진행 로그의 stderr 라우팅)을 봉한다.
- **T-0948**(scalar provenance)·**T-0944**(집계 값)·**T-0946**(로그 prune)는 각각 JSON 스칼라 산출·result/failedStep 집계·로그 파일 prune 만 봉함 — log() 헬퍼 라우팅은 다루지 않음.
- **T-0947**(cascade)·**T-0949~T-0952**(gating/liveness/auth/health)는 step 분기·gate 로직만 봉함 — 그 step 들이 *호출하는* log() 의 stderr/stdout 라우팅 mechanics 는 black-box 로 취급.

만약 누군가 `>&2` 를 제거하거나(→ 진행 로그가 stdout 오염), `tee -a` 를 `>`(overwrite)로 바꾸거나(→ 로그 이력 소실), `date -u` 를 로컬 date 로 바꾸거나(→ TZ 흔들림), 중간 step 에 stdout echo 를 추가하면(→ 유일-emitter 위반), 무인 nightly 는 머신-JSON 파싱 붕괴·로그 소실·시각 불일치의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0945/T-0952 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + 라우팅 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 log 헬퍼 유도 표현(27~28·57~60·387행)을 정적 추출하고, 라우팅 동형 pure 함수(`formatLogLine`·`logRouteTargets`·`stdoutEmitterLines`)로 stderr-이중-sink·stdout-순수성·append·UTC-timestamp·whole-message 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 log 실행·실 tee·실 stderr/stdout·실 date·실 gh·실 git 0. process.env 읽기 0 / 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 로그 라우팅은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 파일 IO / 실 stream redirect 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 log 라우팅 contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — log() 헬퍼/tee/redirect/date 미수정, drift 발견 시 별도 fix task). T-0945 표면 재단언 0(T-0945 는 머신 JSON *방출* 측 printf 단일·overwrite·cat single-source — 본 task 는 그 JSON 방출을 재단언하지 *않고* 진행 로그 stderr 라우팅 + stdout 순수성만). T-0948/T-0944/T-0946/T-0947/T-0949~T-0952 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 57~60행 `log()`(59행 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2`)로 진행 로그를 stderr+파일 이중 방출하고 27~28행 주석이 "stdout 은 마지막 1 줄 JSON 요약만"을 명시하며 387행 `cat "$RESULT_JSON"` 가 유일 stdout emitter — 본 smoke 가 이 라우팅 앵커들을 잡고 log-헬퍼 stdout-순수성 contract 를 봉한다. T-0945 는 JSON 방출 측만(진행 로그 라우팅 제외) → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ nightly runner 가 머신 요약 JSON 을 stdout 으로 방출해 무인 routine 이 파싱)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 log 라우팅 앵커를 정확히 추출·검증:
  - 27~28행 주석 — "stdout 은 마지막 1 줄 JSON 요약만, 진행 로그는 stderr + 로그 파일로 분리"(계약 의도 앵커).
  - 57~60행 `log()` — **로그 헬퍼 함수 전체**:
    - 57행 주석 — "진행 메시지를 로그 파일과 stderr 양쪽에 기록 (stdout 은 JSON 전용이라 건드리지 않음)".
    - 59행 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2` — timestamp 접두(`date -u +%H:%M:%S`) + whole-message(`"$*"`) + tee append(`-a`) + 로그 파일 sink(`"$LOG_FILE"`) + stderr redirect(`>&2`).
  - 387행 `cat "$RESULT_JSON"` — **유일한 bare-stdout emitter**(머신 JSON re-emit). 본 task 는 이 라인이 stdout 방출자로 정확히 1개임을 정량 확인(그 JSON 이 어떻게 만들어지나 = T-0945 소관, 본 task 는 stdout emitter *count* 만).
  - 참고: `curl_code`(62~65행)·step 함수들의 `curl -s` 는 command-substitution `$(...)` 안이라 stdout 이 변수에 캡처됨(스크립트 stdout 방출 아님) — bare-stdout emitter 열거 시 substitution 내부는 제외함을 확인.
- `test/smoke/realdata-e2e-daily-test-step-health-bounded-polling-deadline-timeout-loop-interval-hang-guard-last-body-none-diagnostic-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0952)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 health 폴링을 재단언하지 않고**(그건 T-0952 소관), **log() 헬퍼 stderr 라우팅 + stdout 순수성** 이라는 distinct surface 만 봉한다.
- `test/smoke/realdata-e2e-daily-test-machine-result-json-dual-sink-file-stdout-cat-single-source-emission-convergence.smoke-spec.ts` — **경계 대조(T-0945, 읽기만 — 재단언 방지)**. 이 spec 이 머신 JSON *방출* 측(printf 단일·overwrite·stdout==cat single-source)을 이미 봉함을 확인해, 본 task 가 그 JSON 방출을 재단언하지 않고 *진행 로그 stderr 라우팅 + stdout 순수성* 만 다룸을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-log-helper-stderr-dual-sink-stdout-purity-tee-append-utc-timestamp-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) log 헬퍼 유도 표현(27~28·57~60·387행)을 정적 추출하고, 라우팅 동형 pure 함수(`formatLogLine`·`logRouteTargets`·`stdoutEmitterLines`)로 stderr-이중-sink·stdout-순수성·append·UTC-timestamp·whole-message 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash/tee/date 실행 0)라 public CI 에서 항상 실행돼 green. 실 log/tee/stderr/stdout/date/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — log 헬퍼 라우팅 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `log()` 정의(58행)·라우팅 라인 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2`(59행)·유일 stdout emitter `cat "$RESULT_JSON"`(387행)·계약 주석("stdout 은 JSON 전용이라 건드리지 않음", 57행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 라우팅을 mirror 함을 앵커).
- [ ] **happy-path — formatLogLine(ts, msg)** — `formatLogLine(ts, msg)` 가 `[${ts}] ${msg}\n`(59행 `printf '[%s] %s\n'` 동형)을 반환함을 assert. 여러 (ts, msg) 조합으로 timestamp 접두 + whole-message join 을 실증(예: `formatLogLine("12:00:00", "step health: OK")` → `"[12:00:00] step health: OK\n"`). 실 date/printf 실행 0(입력은 파라미터).
- [ ] **happy-path — logRouteTargets: stderr + 파일 이중 sink, stdout 제외** — `logRouteTargets(logLine)` 가 59행 라우팅 라인을 파싱해 `{file: true, append: true, stderr: true, stdout: false}`(tee -a 파일 sink + `>&2` stderr + stdout 0 byte)를 반환함을 assert. 세 sink 분리 실증: 로그 파일 append true·stderr true·stdout false(진행 로그가 stdout 으로 새지 않음).
- [ ] **happy-path — stdoutEmitterLines: 유일 stdout emitter == 387행 cat** — `stdoutEmitterLines(shellSource)` 가 스크립트의 bare-stdout 방출 라인(command-substitution `$(...)` 내부 curl 제외)을 열거해 정확히 1개(`cat "$RESULT_JSON"`, 387행)를 반환함을 assert. log() 는 `>&2` 라 emitter 목록에 미포함, curl_code 의 `curl -s ... %{http_code}` 는 `$(...)` 캡처라 미포함 — stdout 방출자가 오직 최종 cat 하나임을 정량 확인.
- [ ] **branch — tee append(`-a`) vs overwrite(`>`) 정적 대조** — 59행 라우팅 표현이 `tee -a "$LOG_FILE"`(append) 를 포함하고 `tee "$LOG_FILE"`(overwrite, `-a` 없음) 또는 `> "$LOG_FILE"` 가 *아님* 을 정적 대조 assert. `logRouteTargets` 의 `append` 필드가 `-a` 존재 시 true, 부재 시 false 임을 두 입력(정본 `tee -a` / mutant `tee`)으로 분리 실증.
- [ ] **branch — UTC(`date -u`) vs 로컬(`date`) 정적 대조** — 59행 timestamp 표현이 `date -u +%H:%M:%S`(UTC, `-u` flag)를 포함함을 정적 대조 assert. `-u` 존재 여부로 UTC/로컬 분기 판정(정본 `date -u` → UTC / mutant `date` → 로컬). `date -u +%Y%m%dT%H%M%SZ`(51행 TS 산출, 다른 라인·맥락)와 혼동하지 않고 log() 의 `%H:%M:%S` timestamp 만 대상.
- [ ] **branch — stderr redirect(`>&2`) 존재 → stdout 미방출** — 59행 라우팅 라인이 `>&2`(tee stdout → stderr redirect)를 포함함을 정적 assert 하고, `logRouteTargets` 가 `>&2` 존재 시 `{stderr: true, stdout: false}`·부재 시 `{stderr: false, stdout: true}`(stdout 오염) 를 반환함을 두 입력으로 분리 실증(정본은 stdout false).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0952 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — log 라우팅 앵커 부재 시 명시적 실패** — 추출 보조 함수가 라우팅 유도 표현(`log()` 정의·`tee -a`·`>&2`·`date -u`·`"$*"`·유일 cat emitter) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **stdout 순수성 파괴 drift 변별** — 59행에서 `>&2` 를 제거한(→ tee stdout 이 스크립트 stdout 오염) 모델 사본에서 "log 는 stdout 미방출(stdout:false)" assert 가 실패함을 실증(진행 로그가 JSON 파싱을 깨는 회귀 검출). 원본 문자열/pure 함수 불변.
  - (b) **append → overwrite drift 변별** — `tee -a` 를 `tee`(overwrite)로 mutate 한 모델 사본에서 "로그 파일 append(`-a` 존재)" assert 가 실패함을 assert(로그 이력 소실 회귀 검출). 원본 불변.
  - (c) **UTC → 로컬 date drift 변별** — `date -u +%H:%M:%S` 를 `date +%H:%M:%S`(로컬 TZ)로 mutate 한 모델 사본에서 "UTC timestamp(`-u` 존재)" assert 가 실패함을 assert(TZ 흔들림 회귀 검출). 원본 불변.
  - (d) **유일-stdout-emitter 위반 drift 변별** — 중간 step 에 bare-stdout echo(예: `echo "$RESULT"`)를 추가한 모델 사본에서 `stdoutEmitterLines` 가 2개를 반환해 "stdout emitter 정확히 1개(387행 cat)" assert 가 실패함을 assert(stdout 순수성 정량 위반 회귀 검출). 원본 불변.
  - (e) **whole-message 소실 drift 변별** — `"$*"` 를 `"$1"`(첫 인자만)로 mutate 한 모델 사본에서 "whole-message pass(`"$*"`)" 정적 assert 가 실패함을 assert(다중-인자 로그 절단 회귀 검출). 원본 불변.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·formatLogLine 산출·라우팅 파싱 결과)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·env 실값·cookie 실값 미등장(§9 / REQ-059). log 라우팅 검증은 stream 목적지(file/stderr/stdout)만 다루고 실 로그 payload/credential 을 담지 않음을 정적 확인.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(ts·msg·shell 소스)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출/emitter 열거를 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(shell 소스 사본·인자)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `log`/`tee`/`date`/`bash`/`git`/gh 실행 0. 실 stderr/stdout redirect·실 파일 append·실 stream 0(파일 read + 정적 텍스트 추출 + 라우팅 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. log() 헬퍼(57~60행)·tee/redirect/date·387행 cat 미수정(drift 발견 시 별도 fix task). log 로직을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 라우팅 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0945 표면 재단언 금지** — 머신 JSON *방출* 측(printf 발생==1·overwrite redirect `>"$RESULT_JSON"`·stdout==그 파일 `cat` single-source, 그 spec)은 T-0945 소관. 본 task 는 그 JSON 이 어떻게 만들어지나를 재단언하지 *않고*, 진행 로그의 stderr 라우팅 + stdout emitter *count*(유일 == 387행 cat) 라는 distinct surface 만. T-0945 spec 파일 변경 0. JSON 6-키 스키마/직렬화 재검증 0.
- **T-0948/T-0944/T-0946 표면 재단언 금지** — 스칼라 provenance(T-0948)·result/failedStep 집계(T-0944)·로그 파일 prune(T-0946)은 각 소관. 본 task 는 log() 라우팅 distinct surface 만. 해당 spec 파일들 변경 0.
- **T-0947/T-0949~T-0952 표면 재단언 금지** — cascade(T-0947)·gating(T-0949)·liveness(T-0950)·auth(T-0951)·health(T-0952)는 각 소관(그 step 들이 호출하는 log() 는 black-box). 본 task 는 log() 헬퍼 *내부* 라우팅만. 해당 spec 파일들 변경 0.
- **실 로그 방출 / 실 stream redirect 금지** — 본 spec 은 non-gated 정적 파일 read + 라우팅 pure 함수 only. 실 tee/stderr/stdout redirect·실 파일 append·실 date·실 log 실행 도입 0(그건 실 nightly 실행 소관).
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0952 health 폴링 smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 log 라우팅 유도 표현(27~28·57~60·387행)을 정적 앵커로 추출 + 라우팅 동형 pure 함수(`formatLogLine`·`logRouteTargets`·`stdoutEmitterLines`)로 stderr+파일 이중 sink·stdout 순수성(유일 emitter=387행 cat)·`tee -a` append·`date -u` UTC timestamp·`"$*"` whole-message 불변식 assert. happy(앵커 추출·formatLogLine·logRouteTargets·유일 emitter)/branch(append vs overwrite·UTC vs 로컬·`>&2` 존재→stdout 미방출)/error(파일 부재·앵커 부재)/negative(stdout 순수성 파괴·append→overwrite·UTC→로컬·유일-emitter 위반·whole-message 소실·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 log/tee/stderr/date 실행 0, credential/env 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
