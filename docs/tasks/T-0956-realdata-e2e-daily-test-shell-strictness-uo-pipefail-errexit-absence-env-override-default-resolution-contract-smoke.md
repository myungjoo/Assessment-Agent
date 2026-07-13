---
id: T-0956
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 최상위 **shell-strictness(`set -uo pipefail`) + env-override 기본값 해석 계약**을 정적 검증하는 non-gated build-time smoke — 스크립트 서두(38~46행)가 `set -uo pipefail` 로 nounset(`-u`)·pipefail(`-o pipefail`)을 켜되 **errexit(`-e`)를 의도적으로 끈 채**(step 실패가 script abort 아닌 return-code 로 if/elif 게이트에 흡수 — mark PASS/FAIL orchestration 전체가 `-e` 부재에 의존), 7 종 운영 env(REPO_DIR/BASE_URL/DAILY_SMOKE_EMAIL/DAILY_SMOKE_PASSWORD/SKIP_REDEPLOY/HEALTH_TIMEOUT/LOG_KEEP)를 각 `${VAR:-default}` fallback 으로 해석하고 env-var 이름→shell-var 이름을 매핑(DAILY_SMOKE_EMAIL→SMOKE_EMAIL·DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD)하며 DAILY_SMOKE_PASSWORD 기본값이 AddUserDto `@MinLength(8)` 을 충족(길이 ≥ 8)함을 봉함 — step 함수·shared helper(T-0950~T-0955)·머신 JSON(T-0791/T-0944~T-0948)·gating env(T-0949) 를 봉한 뒤 남은 스크립트 서두 부트스트랩 계약. 계약 (a) **shell-strictness 모드**(38행 `set -uo pipefail` — nounset ON·pipefail ON·**errexit 의도적 OFF**: `elif step_redeploy; then ... else mark FAIL` 이 성립하려면 실패 step 이 script 를 abort 하지 않고 return-code 를 게이트에 넘겨야 함) · (b) **7 env-override 기본값 fallback**(40~46행 `${REPO_DIR:-/opt/assessment-agent}` 등 — 각 운영 env 의 `:-default` 해석) · (c) **env→shell 이름 매핑**(DAILY_SMOKE_EMAIL→SMOKE_EMAIL·DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD; 나머지는 동일 이름) · (d) **`:-` fallback 시맨틱**(env set 시 env 값·부재 시 default) · (e) **DAILY_SMOKE_PASSWORD 기본값 길이 ≥ 8**(AddUserDto `@MinLength(8)` 충족 — 34행 주석 계약) · (f) **§9 secret-safety**(7 default 중 실 credential 미포함 — SMOKE_PASSWORD default 는 문서화된 local-test placeholder). 불변식: 스크립트 서두는 `set -uo pipefail` 로 nounset·pipefail 을 켜되 errexit 을 끈 채 7 운영 env 를 `${VAR:-default}` 로 해석하고 env→shell 이름을 매핑하며 password 기본값이 `@MinLength(8)` 을 충족하되 실 secret 을 담지 않는다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) 서두 표현(38~46행)을 정적 추출 + 해석 동형 pure 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`resolveEnvOverride`·`smokePasswordMeetsMinLength`)로 strictness-플래그·default-값·이름-매핑·`:-`-시맨틱·MinLength·secret-safety 불변식 assert. T-0952(HEALTH_TIMEOUT 폴링 math — 본 task 는 default *해석*만·폴링 계산 아님)·T-0946(LOG_KEEP prune glob — default *해석*만·glob prune 아님)·T-0948(ts/logPath/LOG_DIR *유도* — env-override *fallback*만·파생 경로 조립 아님)·T-0949(REALDATA_E2E_* gating env — distinct env set)·T-0792(HEALTH_MESSAGE↔APP_STATUS_MESSAGE parity — 본 task 는 HEALTH_MESSAGE 미다룸) 가 미cover 한 **서두 shell-strictness + env-override 기본값 해석** gap 상보 표면. 실 bash 실행·실 env 읽기·gh·git 0·process.env 읽기 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: DONE
completedAt: 2026-07-13T13:05:41Z
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 380
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-shell-strictness-env-override-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0955) 이 360~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(shell-strictness errexit-absence + 7 env-override default + env→shell 이름매핑 + :- 시맨틱 + MinLength + secret-safety)의 happy/branch/error/negative full cover 에 ~380 LOC 필요, T-0955/T-0952 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step① — step 함수·helper·머신JSON·gating env 봉함 뒤 남은 스크립트 서두(38~46행) shell-strictness(set -uo pipefail, errexit 의도적 OFF — orchestration 이 의존) + 7 env-override 기본값 해석·이름매핑·MinLength·secret-safety 를 정적 smoke 로 봉함. T-0952/T-0946/T-0948/T-0949/T-0792 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0956 — realdata-e2e nightly `deploy/daily-test.sh` 서두 shell-strictness(`set -uo pipefail`, errexit 의도적 OFF) + env-override 기본값 해석 계약 정적 smoke

## Why

`deploy/daily-test.sh` 의 서두(38~46행)는 러너 전체의 실행 모드와 운영 파라미터를 확정하는 **부트스트랩 계약**이다:

```bash
set -uo pipefail

REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
SMOKE_EMAIL="${DAILY_SMOKE_EMAIL:-daily-smoke@local.test}"
SMOKE_PASSWORD="${DAILY_SMOKE_PASSWORD:-daily-smoke-pw-2026}"
SKIP_REDEPLOY="${SKIP_REDEPLOY:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
LOG_KEEP="${LOG_KEEP:-14}"
```

step 함수(redeploy T-0955·health T-0952·liveness T-0950·auth T-0951)와 shared helper(log T-0953·curl_code T-0954), 머신 JSON(schema T-0791·집계 T-0944·방출 T-0945·prune T-0946·scalar T-0948), gating env(T-0949) 는 각각 봉해졌으나, **스크립트 서두의 실행-모드 + env-override 기본값 해석** 계약만 origin/main 미cover 로 남아있다. 계약 요소:

1. **shell-strictness 모드**(38행 `set -uo pipefail`) — `-u`(nounset: unset 변수 참조 시 error)·`-o pipefail`(파이프 중간 실패 전파)을 켜되, **`-e`(errexit)를 의도적으로 끈다**. 이 `-e` 부재가 핵심이다: 스크립트의 step orchestration(284행 `elif step_redeploy; then mark redeploy PASS; else mark redeploy FAIL`)은 실패한 step 이 **script 를 abort 하지 않고 non-zero return-code 를 if/elif 게이트에 넘겨** mark FAIL 로 흡수되는 것에 전적으로 의존한다. 만약 `set -euo pipefail` 로 바뀌면 첫 실패 step 에서 스크립트가 즉시 종료돼 mark FAIL·머신 JSON 방출(375행)·로그 prune(384행)·`cat "$RESULT_JSON"`(387행)이 전부 실행되지 않아 무인 모니터링이 결과를 못 받는 silent 회귀가 발생한다.
2. **7 env-override 기본값 fallback**(40~46행) — 7 종 운영 env 를 각 `${VAR:-default}` 형태로 해석한다. env 가 set 이면 그 값, 부재/빈 값이면 documented default(`/opt/assessment-agent`·`http://localhost:3000`·`daily-smoke@local.test`·`daily-smoke-pw-2026`·`0`·`180`·`14`).
3. **env→shell 이름 매핑**(42·43행) — 외부 env 이름과 내부 shell 변수 이름이 두 곳에서 다르다: `DAILY_SMOKE_EMAIL`→`SMOKE_EMAIL`, `DAILY_SMOKE_PASSWORD`→`SMOKE_PASSWORD`. 나머지 5 종(REPO_DIR·BASE_URL·SKIP_REDEPLOY·HEALTH_TIMEOUT·LOG_KEEP)은 env 이름과 shell 변수 이름이 동일하다.
4. **`:-` fallback 시맨틱** — `${VAR:-default}` 는 VAR 이 set-이고-비어있지-않으면 그 값, 그 외(unset 또는 빈 문자열)면 default 를 쓴다(bash parameter expansion `:-` 규약).
5. **DAILY_SMOKE_PASSWORD 기본값 길이 ≥ 8**(34행 주석 `기본 길이 ≥ 8 — AddUserDto @MinLength(8)`) — auth step(step_auth, T-0951)이 이 기본 password 로 `POST /api/users` 를 호출하므로, default 값 `daily-smoke-pw-2026`(길이 18)는 `AddUserDto` 의 `@MinLength(8)` 을 충족해야 signup(201|409)이 유효하다. default 가 8 미만으로 바뀌면 auth step 이 400 으로 무너진다.
6. **§9 secret-safety** — 7 default 중 어느 것도 실 credential 이 아니다. `daily-smoke-pw-2026` 은 로컬 black-box 스모크 전용 문서화 placeholder 로, 실 배포 secret 은 env 주입(§9)으로만 들어온다.

이 서두를 관통하는 **불변식**: **스크립트 서두는 `set -uo pipefail` 로 nounset·pipefail 을 켜되 errexit 을 끈 채(step 실패의 return-code 흡수) 7 운영 env 를 `${VAR:-default}` 로 해석하고 DAILY_SMOKE_EMAIL/DAILY_SMOKE_PASSWORD 를 SMOKE_EMAIL/SMOKE_PASSWORD 로 매핑하며 password 기본값이 `@MinLength(8)` 을 충족하되 실 secret 을 담지 않는다.** 이 불변식이 무너지면:

- **errexit 추가**(`set -uo pipefail` → `set -euo pipefail`) — 첫 실패 step 에서 스크립트 즉시 종료 → mark FAIL·머신 JSON·prune·stdout cat 미실행 → 무인 모니터링 결과 소실(가장 위험한 회귀).
- **nounset/pipefail 제거** — unset 변수 오용·파이프 실패 은폐로 silent 오동작.
- **default 값 drift**(예: HEALTH_TIMEOUT:-180 → :-60·LOG_KEEP:-14 → :-7) — 폴링 타임아웃 단축으로 느린 Pi5 부팅 false FAIL, 또는 로그 보관 window 축소.
- **env→shell 이름 매핑 오배선**(예: DAILY_SMOKE_EMAIL 을 다른 shell 변수로) — 운영자가 지정한 계정이 auth step 에 반영 안 됨.
- **password default < 8** — auth step signup 이 `@MinLength(8)` 위반으로 400 → 무인 검증 무너짐.

그러나 이 **서두 shell-strictness + env-override 기본값 해석** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0952**(step_health)는 `HEALTH_TIMEOUT` 기본 180 을 *폴링 deadline 계산* 입력으로만 인용 — env-override *해석 계약*(`:-` fallback·이름 동일성) 자체는 범위 밖.
- **T-0946**(로그 retention prune)은 `LOG_KEEP` 기본 14 를 *prune keep-window* 로만 인용 — env-override *해석 계약* 자체는 범위 밖.
- **T-0948**(머신 JSON scalar provenance)은 ts/gitSha/logPath 산출과 `LOG_DIR = "$REPO_DIR/deploy/logs"` *유도*만 봉함 — 그 REPO_DIR 의 *env-override fallback* 해석·나머지 6 종 default 는 범위 밖.
- **T-0949**(gating env completeness)는 `REALDATA_E2E_*` 7 종 *live-gating* env 만 — 본 task 의 7 종 *운영* env(REPO_DIR 등)와 distinct set.
- **T-0792**(HTTP step parity)는 HEALTH_MESSAGE↔APP_STATUS_MESSAGE parity 를 봉함 — 본 task 는 HEALTH_MESSAGE(48행 `readonly`)를 다루지 않는다(경계 대조).

만약 누군가 `-e` 를 추가하거나, default 값을 바꾸거나, env→shell 매핑을 오배선하거나, password default 를 8 미만으로 줄이면, 무인 nightly 는 결과 소실·false FAIL·auth 붕괴의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0952/T-0955 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + 해석 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 서두 표현(38~46행)을 정적 추출하고, 해석 동형 pure 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`resolveEnvOverride`·`smokePasswordMeetsMinLength`)로 strictness-플래그·default-값·이름-매핑·`:-`-시맨틱·MinLength·secret-safety 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 bash 실행·실 env 읽기·실 gh·실 git 0. process.env 읽기 0 / 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). env 해석은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 env expansion 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0(기존 shell 계약을 *읽어* 검증만) → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 서두-계약 smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — `set` 플래그·default·매핑 미수정, drift 발견 시 별도 fix task). T-0952/T-0946/T-0948/T-0949/T-0792 표면 재단언 0(각 소관). HEALTH_MESSAGE(48행)·머신 JSON·gating·polling·prune 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 38행 `set -uo pipefail`(errexit 부재)·40~46행 7 env-override(`${REPO_DIR:-/opt/assessment-agent}` 등)로 서두를 구성 — grep 결과 개별 default 는 T-0946(LOG_KEEP)·T-0952(HEALTH_TIMEOUT)·T-0948(REPO_DIR 유도)이 *인접 목적*으로만 인용하고, `set -uo pipefail` 의 errexit-absence 계약·7 env-override 의 *해석 표(table)*·env→shell 이름 매핑·password MinLength 는 어떤 smoke 도 봉하지 않음 → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — nightly runner 가 배포 기기에서 env-override 로 파라미터화된 채 7 step 을 수행)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 서두 앵커를 정확히 추출·검증:
  - 38행 `set -uo pipefail` — shell-strictness 모드(nounset `-u`·pipefail `-o pipefail` ON, errexit `-e` **부재**).
  - 40행 `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` — 배포 체크아웃 default.
  - 41행 `BASE_URL="${BASE_URL:-http://localhost:3000}"` — 앱 base URL default.
  - 42행 `SMOKE_EMAIL="${DAILY_SMOKE_EMAIL:-daily-smoke@local.test}"` — env→shell 매핑(DAILY_SMOKE_EMAIL→SMOKE_EMAIL) + default.
  - 43행 `SMOKE_PASSWORD="${DAILY_SMOKE_PASSWORD:-daily-smoke-pw-2026}"` — env→shell 매핑(DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD) + default(길이 18 ≥ 8).
  - 44행 `SKIP_REDEPLOY="${SKIP_REDEPLOY:-0}"` — redeploy skip default(0).
  - 45행 `HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"` — health 폴링 최대 초 default(180).
  - 46행 `LOG_KEEP="${LOG_KEEP:-14}"` — 로그 보관 개수 default(14).
  - 34행 주석 `DAILY_SMOKE_PASSWORD  동 비밀번호 (기본 길이 ≥ 8 — AddUserDto @MinLength(8))` — password default MinLength 계약 근거.
  - 참고 앵커(재단언 금지, 경계 대조용): 48행 `readonly HEALTH_MESSAGE="Assessment-Agent"`(HEALTH_MESSAGE parity 는 T-0792 소관)·50~53행 파생 경로(`LOG_DIR`/`TS`/`LOG_FILE`/`RESULT_JSON` 유도는 T-0948 소관)·284행 `elif step_redeploy; then`(errexit-absence 가 성립시키는 orchestration 게이트 — 재단언 아닌 근거 인용).
- `test/smoke/realdata-e2e-daily-test-step-redeploy-invocation-repo-dir-env-thread-log-redirect-append-stdout-purity-return-code-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0955)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + §9-safe 진단 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 step_redeploy 호출 계약을 재단언하지 않고**(그건 T-0955 소관), **서두 shell-strictness + env-override 기본값 해석** 이라는 distinct surface 만 봉한다. 이 파일 변경 0.
- `test/smoke/realdata-e2e-daily-test-step-health-bounded-polling-deadline-timeout-loop-interval-hang-guard-last-body-none-diagnostic-contract.smoke-spec.ts` — **경계 대조(읽기만 — 재단언 방지)**. 이 spec 이 `HEALTH_TIMEOUT` 기본 180 을 *폴링 deadline* 입력으로만 씀을 확인해, 본 task 가 폴링 math 를 재단언하지 않고 env-override *해석 계약* 만 다룸을 보증. 이 파일 변경 0.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) 서두 표현(38~46행)을 정적 추출하고, 해석 동형 pure 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`resolveEnvOverride`·`smokePasswordMeetsMinLength`)로 strictness-플래그·default-값·이름-매핑·`:-`-시맨틱·MinLength·secret-safety 불변식을 assert 한다. non-gated(describe.skip 0, process.env/bash 실행 0)라 public CI 에서 항상 실행돼 green. 실 bash/env-expansion/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — 서두 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `set -uo pipefail`(38행)·7 env-override 라인(40~46행 `${...:-...}`)·34행 password MinLength 주석이 실 소스에 존재함을 정적 assert(pure 함수가 실 서두를 mirror 함을 앵커).
- [ ] **happy-path — parseShellStrictness(setLine)** — `parseShellStrictness("set -uo pipefail")` 가 `{ nounset: true, pipefail: true, errexit: false }` 를 반환함을 assert. `-u`·`-o pipefail` 존재로 nounset/pipefail true, `-e` 부재로 errexit **false**(orchestration 이 의존하는 핵심). 실 bash `set` 실행 0(문자열 파싱).
- [ ] **happy-path — buildEnvOverrideTable()** — `buildEnvOverrideTable()` 가 7 원소 배열 `[{ envName: "REPO_DIR", shellVar: "REPO_DIR", default: "/opt/assessment-agent" }, ..., { envName: "DAILY_SMOKE_EMAIL", shellVar: "SMOKE_EMAIL", default: "daily-smoke@local.test" }, { envName: "DAILY_SMOKE_PASSWORD", shellVar: "SMOKE_PASSWORD", default: "daily-smoke-pw-2026" }, ..., { envName: "HEALTH_TIMEOUT", shellVar: "HEALTH_TIMEOUT", default: "180" }, { envName: "LOG_KEEP", shellVar: "LOG_KEEP", default: "14" }]`(40~46행 배선 동형·순서 포함)를 반환함을 assert. 각 원소의 envName/shellVar/default 가 실 소스 라인과 일치함을 정적 대조.
- [ ] **happy-path — resolveEnvOverride(shellVar, envValue, default)** — `${VAR:-default}` 시맨틱 동형: envValue 가 non-empty 면 envValue, unset/빈 문자열이면 default 를 반환함을 assert(예: `resolveEnvOverride("HEALTH_TIMEOUT", "300", "180") === "300"`, `resolveEnvOverride("HEALTH_TIMEOUT", undefined, "180") === "180"`, `resolveEnvOverride("HEALTH_TIMEOUT", "", "180") === "180"`). 실 env 읽기 0(입력은 파라미터).
- [ ] **happy-path — smokePasswordMeetsMinLength(defaultPw, minLength)** — `smokePasswordMeetsMinLength("daily-smoke-pw-2026", 8)` 가 true(길이 18 ≥ 8)를 반환함을 assert. AddUserDto `@MinLength(8)` 충족 실증.
- [ ] **branch — errexit 부재 vs 존재 정적 대조** — 38행이 `set -uo pipefail`(errexit 없음) 이고 `set -euo pipefail`(errexit 있음) 가 *아님* 을 정적 대조 assert. `parseShellStrictness` 의 `errexit` 가 `-e` 존재 시 true·부재 시 false 임을 두 입력(정본 `set -uo pipefail` / mutant `set -euo pipefail`)으로 분리 실증(정본은 false — orchestration 이 return-code 흡수).
- [ ] **branch — env→shell 이름 매핑 동일/상이 분리** — 매핑이 상이한 2 종(DAILY_SMOKE_EMAIL→SMOKE_EMAIL·DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD)과 동일한 5 종(REPO_DIR·BASE_URL·SKIP_REDEPLOY·HEALTH_TIMEOUT·LOG_KEEP)을 `buildEnvOverrideTable` 산출에서 분리 실증(`envName === shellVar` 인 원소 5 개·`envName !== shellVar` 인 원소 2 개).
- [ ] **branch — `:-` fallback 3 분기** — `resolveEnvOverride` 의 (env set·non-empty → env 값)·(env unset → default)·(env 빈 문자열 → default) 3 분기 모두 실증(서로 다른 결과).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0955 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — 서두 앵커 부재 시 명시적 실패** — 추출 보조 함수가 서두 유도 표현(`set -uo pipefail`·7 env-override 라인·MinLength 주석) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **errexit 추가 drift 변별** — 38행을 `set -euo pipefail`(`-e` 추가)로 mutate 한 모델 사본에서 "errexit === false" assert 가 실패함을 실증(첫 실패 step 이 script abort → 결과 JSON 미방출 회귀 검출). 원본 문자열/pure 함수 불변.
  - (b) **nounset/pipefail 제거 drift 변별** — `set -uo pipefail` 를 `set -o pipefail`(`-u` 제거) 또는 `set -u`(pipefail 제거)로 mutate 한 사본에서 "nounset/pipefail === true" assert 가 각각 실패함을 실증. 원본 불변.
  - (c) **default 값 drift 변별** — `HEALTH_TIMEOUT:-180` 를 `:-60` 으로(또는 `LOG_KEEP:-14` 를 `:-7` 로) mutate 한 사본에서 "default === '180'/'14'" assert 가 실패함을 실증(폴링 타임아웃 단축·로그 보관 축소 회귀 검출). 원본 불변.
  - (d) **env→shell 이름 매핑 오배선 drift 변별** — 42행 `DAILY_SMOKE_EMAIL` 을 다른 env 이름으로 mutate 한 사본에서 "envName → shellVar 매핑" assert 가 실패함을 실증(운영자 지정 계정 미반영 회귀 검출). 원본 불변.
  - (e) **password default < 8 drift 변별** — `daily-smoke-pw-2026` 을 길이 8 미만(예: `pw`)으로 mutate 한 사본에서 `smokePasswordMeetsMinLength(..., 8)` 이 false 를 반환함을 실증(auth signup `@MinLength(8)` 위반 회귀 검출). 원본 불변.
  - (f) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·buildEnvOverrideTable 산출·resolveEnvOverride 결과)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·env 실값·실 password 미등장(§9 / REQ-059). SMOKE_PASSWORD default `daily-smoke-pw-2026` 는 문서화된 local-test placeholder 이며 실 배포 secret 이 아님을 정적 확인(주석 34행 근거) — 실 credential 은 env 주입으로만 들어옴.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(setLine·shell 소스)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출/서두 파싱을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(shell 소스 사본·인자)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `bash`/`set`/env-expansion/`git`/gh 실행 0. 실 서브프로세스/네트워크 0(파일 read + 정적 텍스트 추출 + 해석 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. 서두(38~46행)·`set` 플래그·env-override default·이름 매핑 미수정(drift 발견 시 별도 fix task). 서두를 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 해석 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0952 폴링 표면 재단언 금지** — `HEALTH_TIMEOUT` 를 폴링 deadline 계산에 쓰는 부분(T-0952)은 그 소관. 본 task 는 HEALTH_TIMEOUT 의 *env-override 해석*(`:-180` fallback)만.
- **T-0946 prune 표면 재단언 금지** — `LOG_KEEP` 를 로그 prune keep-window 에 쓰는 부분(T-0946)은 그 소관. 본 task 는 LOG_KEEP 의 *env-override 해석*(`:-14` fallback)만.
- **T-0948 파생-경로 표면 재단언 금지** — ts/gitSha/logPath 산출과 `LOG_DIR = "$REPO_DIR/deploy/logs"` 유도(T-0948)는 그 소관. 본 task 는 REPO_DIR 의 *env-override fallback*(`:-/opt/assessment-agent`)만 — 파생 경로 조립은 다루지 않음.
- **T-0949 gating-env 표면 재단언 금지** — `REALDATA_E2E_*` 7 종 live-gating env(T-0949)는 distinct env set. 본 task 는 7 종 *운영* env(REPO_DIR/BASE_URL/…)만.
- **T-0792 HEALTH_MESSAGE parity 재단언 금지** — 48행 `readonly HEALTH_MESSAGE="Assessment-Agent"` ↔ APP_STATUS_MESSAGE parity(T-0792)는 그 소관. 본 task 는 HEALTH_MESSAGE 를 다루지 않음(경계 대조 인용만).
- **실 bash 실행 / 실 env-expansion / 실 서브프로세스 금지** — 본 spec 은 non-gated 정적 파일 read + 해석 동형 pure 함수 only. 실 bash/`set`/parameter-expansion/서브프로세스 spawn 도입 0(그건 실 nightly 실행 소관).
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0955 step_redeploy smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 서두 유도 표현(38~46행)을 정적 앵커로 추출 + 해석 동형 pure 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`resolveEnvOverride`·`smokePasswordMeetsMinLength`)로 shell-strictness(errexit 의도적 OFF·nounset·pipefail)·7 env-override 기본값·env→shell 이름 매핑·`:-` fallback 시맨틱·password MinLength·secret-safety 불변식 assert. happy(앵커 추출·parseShellStrictness·buildEnvOverrideTable·resolveEnvOverride·smokePasswordMeetsMinLength)/branch(errexit 부재 vs 존재·이름 매핑 동일/상이·`:-` 3 분기)/error(파일 부재·앵커 부재)/negative(errexit 추가·nounset/pipefail 제거·default 값 drift·이름 매핑 오배선·password < 8·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 bash/env/서브프로세스 실행 0, credential/env/password 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
