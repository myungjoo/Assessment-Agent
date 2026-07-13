---
id: T-0948
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 머신 요약 JSON 의 **scalar-value provenance 계약**을 정적 검증하는 non-gated build-time smoke — 스칼라 필드(`ts`·`gitSha`·`logPath`)가 **어떻게 산출·직렬화되는가**를 봉함(무인 모니터링이 JSON↔로그 파일 상관·git 실패 내성을 신뢰). 계약: **(a) `ts` single-source**(51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"` 1 회 산출 → 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"` · 376행 JSON `ts` 필드 · 277/380행 시작/종료 로그 라인이 **동일 TS** 재사용, 형식 `^\d{8}T\d{6}Z$` compact UTC Z) · **(b) logPath↔ts cross-field**(375행 JSON `logPath` == `$LOG_DIR/daily-$TS.log` → `basename(logPath)` == `daily-${ts}.log` 이므로 머신 JSON 한 건에서 사람용 로그 파일을 결정론적으로 역추적) · **(c) LOG_DIR 유도**(50행 `LOG_DIR="$REPO_DIR/deploy/logs"` · 53행 `RESULT_JSON="$LOG_DIR/latest-result.json"`) · **(d) gitSha unknown-fallback**(365행 `git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown` → git 실패 시 `gitSha` == literal `unknown`, 스크립트 계속·non-fatal, `--short` abbreviated). 불변식: 스칼라 필드는 단일 소스(TS)·결정론 유도·git 실패 내성(unknown)으로 산출되어 무인 모니터링이 JSON↔로그 상관·부분 실패 진단을 신뢰. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/HTTP/spawn 0) 스칼라 유도 표현(50/51/52/53/365/375/376행)을 정적 추출 + TS 동형 pure 함수(`deriveLogPath`/`isCompactUtcTs`/`resolveGitSha`/`logFileNameFromTs`)로 provenance 불변식 assert. T-0791(6-키 schema·failedStep null/quoted 직렬화)·T-0944(result/failedStep 집계 값)·T-0945(dual-sink 방출)·T-0946(로그 prune)·T-0947(step-chain cascade)·T-0792(HTTP path/method/status parity)가 미cover 한 **스칼라 필드 값이 어떻게 산출·직렬화되는가**(ts single-source·logPath cross-field·gitSha fallback) gap 상보 표면. 실 redeploy/HTTP/jest spawn/gh/git 0·process.env/gating 실행 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-machine-json-scalar-provenance-ts-single-source-logpath-crossfield-gitsha-unknown-fallback-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-machine-json-scalar-provenance
plannerNote: P5 §109 step④ — T-0947 이 step-chain cascade 를 봉한 뒤, 머신 JSON 스칼라 필드가 어떻게 산출/직렬화되는가(ts single-source→LOG_FILE/logPath 재사용·logPath↔ts cross-field 역추적·gitSha unknown-fallback git 실패 내성·LOG_DIR 유도)를 정적 smoke 로 봉함. T-0791(schema)/T-0944(집계 값) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬.
---

# T-0948 — realdata-e2e nightly 머신 요약 JSON scalar-value provenance 정적 smoke (ts single-source · logPath↔ts cross-field · gitSha unknown-fallback)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 머신 요약 JSON(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)을 방출하고 **로컬 PC 의 무인 모니터링 routine 이 그 결과를 파싱**해 nightly 상태를 판단하는 것을 명시한다. 이 JSON 의 6 필드 중 `result`(집계)·`failedStep`(집계)·`steps`(cascade) 는 각각 T-0944·T-0947 이 봉했지만, **나머지 스칼라 3 필드(`ts`·`gitSha`·`logPath`)가 어떻게 산출·직렬화되는가**(scalar-value provenance)는 origin/main 시점에 검증 0 부재다. 이 스칼라 provenance 는 무인 운영의 실용적 신뢰성 핵심이다:

- **(a) `ts` single-source**(51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"`) — 스크립트는 시작 시 TS 를 **1 회** 산출하고, 이 동일 TS 값을 세 곳에서 재사용한다: (i) 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"`(사람용 로그 파일명), (ii) 375~376행 머신 JSON `ts` 필드, (iii) 277·380행 시작/종료 로그 라인. TS 형식은 compact UTC Z-suffix(`YYYYMMDDTHHMMSSZ`, 구분자 없음, 정규식 `^\d{8}T\d{6}Z$`). single-source 이므로 JSON `ts` 와 로그 파일명의 타임스탬프가 **byte-identical**이다.
- **(b) `logPath` ↔ `ts` cross-field**(375행 JSON `logPath` = `$LOG_DIR/daily-$TS.log`) — 머신 JSON 한 건이 주어지면 `basename(logPath)` == `daily-${ts}.log` 이므로, 무인 모니터링 routine 이 **JSON 만 보고 대응하는 사람용 로그 파일을 결정론적으로 역추적**할 수 있다. 이 cross-field 불변식이 깨지면(예: logPath 가 다른 TS/경로를 참조) 실패 진단 시 로그 상관이 불가능해진다.
- **(c) `LOG_DIR` 유도**(50행 `LOG_DIR="$REPO_DIR/deploy/logs"` · 53행 `RESULT_JSON="$LOG_DIR/latest-result.json"`) — 로그·결과 JSON 의 저장 위치가 `REPO_DIR` 로부터 결정론적으로 유도된다. `logPath` 는 이 LOG_DIR 하위(`daily-<ts>.log`), `RESULT_JSON` 은 고정 basename(`latest-result.json`, distinct)이다.
- **(d) `gitSha` unknown-fallback**(365행 `GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"`) — 배포 체크아웃에서 git 이 없거나 실패해도(`|| echo unknown`) 스크립트는 **멈추지 않고** `gitSha` 필드를 literal `unknown` 으로 채운다(non-fatal). `--short` 이므로 abbreviated SHA 다. 이 fallback 이 깨져 git 실패가 fatal 이 되면 nightly 전체가 무산되고, fallback 이 조용히 빈 문자열을 내면 무인 모니터링이 배포 리비전을 상관할 수 없다.

이 스칼라 provenance 전체를 관통하는 **불변식**: **머신 JSON 의 스칼라 필드는 단일 소스(TS)로부터 결정론적으로 유도되고(ts↔로그 파일명 byte-identical), cross-field 로 로그 파일을 역추적 가능하며(logPath basename↔ts), git 실패에 내성(gitSha=unknown non-fatal)이다.** 이 불변식이 무인 nightly 운영의 JSON↔로그 상관·부분 실패 진단 신뢰성의 핵심이다.

그러나 이 **스칼라 값이 어떻게 산출·직렬화되는가** 계약은 origin/main 시점에 검증 0 부재다: T-0791 은 6-키 **스키마·순서·failedStep null/quoted 직렬화 분기**만 봉했다(스칼라 값이 **어떤 소스로부터 산출되는가**는 다루지 않음 — printf 템플릿의 slot 위치만). T-0944 는 `result`/`failedStep` **집계 값**만, T-0945 는 dual-sink **방출 경로**만, T-0946 은 **로그 prune**만, T-0947 은 **step-chain cascade**만, T-0792 는 **HTTP step path/method/status parity**만 봉했다. 어느 것도 **`ts` single-source(로그 파일명↔JSON ts 동일 소스)·`logPath`↔`ts` cross-field 역추적·`gitSha` unknown-fallback·LOG_DIR 유도**는 다루지 않는다. 만약 누군가 51행 date 포맷을 non-Z/구분자 형식으로 바꾸거나(→ 로그 파일명↔ts 불일치), LOG_FILE 을 별도 TS 로 재산출하거나(→ single-source 깨짐), gitSha fallback 을 제거해 `|| echo unknown` 을 떨어뜨리거나(→ git 실패가 fatal, `set -uo pipefail` 하 스크립트 중단), fallback 을 `|| echo ""`(빈 문자열)로 바꾸면(→ 리비전 상관 불가) — 무인 nightly 운영은 JSON↔로그 상관·부분 실패 진단의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0944/T-0945/T-0946/T-0947 과 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + TS 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 스칼라 유도 표현(50/51/52/53/365/375~376행)을 정적 추출하고, TS 동형 pure 함수(`deriveLogPath`·`logFileNameFromTs`·`isCompactUtcTs`·`resolveGitSha`)로 provenance 불변식(ts single-source·logPath↔ts cross-field·gitSha unknown-fallback·LOG_DIR 유도)을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git·실 `date` 실행 0. process.env 읽기 0 / gating 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). ts/gitSha 유도는 TS pure 함수로 **동형 모델링**할 뿐 실 bash/date/git 실행 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). write 명령(`gh issue create|edit`) 무관 — 본 smoke 는 스칼라 필드 산출 semantics 만 검증하며 write step_report(ADR-0045 deferred)와 독립. production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 scalar-provenance contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — 실행 블록/유도 표현 미수정, drift 발견 시 별도 fix task). T-0791 표면 재단언 0(T-0791 은 6-키 schema·failedStep 직렬화 분기, 본 task 는 ts/gitSha/logPath **값 산출 provenance** — distinct surface). T-0944/T-0945/T-0946/T-0947/T-0792 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): T-0791 spec 은 printf 템플릿의 6-키 **슬롯 순서**와 failedStep **직렬화 분기**만 모델링 — 스칼라 슬롯에 **어떤 값이 어떤 소스로부터 들어가는가**(ts single-source·gitSha fallback·logPath cross-field)는 미cover 확정(grep `date -u|logFile|LOG_FILE|rev-parse|unknown|single-source|cross-field` on test/smoke 결과 T-0791 은 template/order 만·값 provenance 부재). `deploy/daily-test.sh` 는 현재 50행 `LOG_DIR="$REPO_DIR/deploy/logs"`, 51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"`, 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"`, 365행 `git ... rev-parse --short HEAD 2>/dev/null || echo unknown`, 375~376행 printf `"ts":"%s"..."logPath":"%s"` 에 `$TS`·`$LOG_FILE` 주입 — 본 smoke 가 이 유도 앵커들을 잡고 scalar-value provenance 를 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ 머신 요약 JSON = 무인 모니터링 contract, 스칼라 필드 산출)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 스칼라 유도 앵커를 정확히 추출·검증:
  - 50행 `LOG_DIR="$REPO_DIR/deploy/logs"` + 53행 `RESULT_JSON="$LOG_DIR/latest-result.json"` — LOG_DIR 유도 · RESULT_JSON 고정 basename(distinct) 앵커.
  - 51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"` — ts single-source(compact UTC Z, 구분자 없음) 앵커.
  - 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"` — LOG_FILE 이 **동일 $TS** 재사용(single-source) 앵커.
  - 365행 `GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"` — gitSha `--short` + `|| echo unknown` fallback(git 실패 non-fatal) 앵커.
  - 375~378행 printf 머신 JSON — `"ts":"%s"` slot 에 `$TS`, `"logPath":"%s"` slot 에 `$LOG_FILE` 주입(같은 TS 가 ts 필드·logPath basename 양쪽에 흐름) 앵커. printf 인자 순서(`$TS`, `$GIT_SHA`, ..., `$LOG_FILE`) 확인.
  - 277행 `log "=== daily-test 시작 (ts=$TS ...`  + 380행 `log "=== daily-test 종료 ...` — 시작/종료 로그도 동일 $TS/결과 재사용(single-source 재확인, 보조 앵커).
- `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` — **동형 패턴 템플릿(T-0791)**. readFileSync + printf 템플릿 정적 추출 + TS 동형 모델 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 6-키 schema·failedStep 직렬화 분기를 재단언하지 않고**(그건 T-0791 소관), **스칼라 값 provenance**(ts single-source·logPath↔ts cross-field·gitSha unknown-fallback·LOG_DIR 유도)라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-machine-json-scalar-provenance-ts-single-source-logpath-crossfield-gitsha-unknown-fallback-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) 스칼라 유도 표현(50/51/52/53/365/375~376행)을 정적 추출하고, TS 동형 pure 함수(`logFileNameFromTs`·`deriveLogPath`·`isCompactUtcTs`·`resolveGitSha`)로 provenance 불변식(ts single-source·logPath↔ts cross-field·gitSha unknown-fallback·LOG_DIR 유도)을 assert 한다. non-gated(describe.skip 0, process.env/date/git 실행 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git/date 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — ts single-source 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"` 와 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"` 를 정적 추출하고, LOG_FILE 이 **동일 `$TS`** 를 참조함을(별도 `date` 재호출 아님) assert(single-source 앵커). date 포맷 리터럴이 compact UTC Z(`%Y%m%dT%H%M%SZ`)임을 확인.
- [ ] **happy-path — 스칼라 유도 앵커 정적 추출** — LOG_DIR(50행)·RESULT_JSON(53행)·gitSha fallback(365행)·printf 스칼라 slot(375~376행 `"ts":"%s"`·`"logPath":"%s"`)이 실 소스에 존재함을 정적 assert(TS pure 함수가 실 bash 유도를 mirror 함을 앵커).
- [ ] **happy-path — ts single-source 재사용 model** — `logFileNameFromTs(ts)` 가 `daily-${ts}.log` 를, `deriveLogPath(repoDir, ts)` 가 `${repoDir}/deploy/logs/daily-${ts}.log` 를 산출함을 assert. 정상 TS(예: `20260713T020000Z`)로 호출 시 로그 파일명·logPath 가 결정론적으로 유도됨을 실증(실 date 실행 0 — TS 는 함수 파라미터).
- [ ] **happy-path — isCompactUtcTs 형식 검증** — `isCompactUtcTs(ts)` 가 compact UTC Z 형식(`^\d{8}T\d{6}Z$`)만 true, 구분자 포함(`2026-07-13T02:00:00Z`)·Z 누락·소수초 포함 등은 false 를 반환함을 assert(51행 date 포맷이 이 형식을 산출함과 정합).
- [ ] **branch — logPath ↔ ts cross-field 역추적** — 머신 JSON 한 건(`{ ts, logPath }`)에서 `basename(logPath)` == `daily-${ts}.log` 임을 assert(375행 logPath 가 52행 LOG_FILE=`daily-$TS.log` 이므로 무인 routine 이 JSON→로그 파일 결정론 역추적 가능). ts 값이 logPath basename 에 embed 됨을 실증.
- [ ] **branch — gitSha unknown-fallback (git 성공 vs 실패)** — `resolveGitSha(rawSha, gitFailed)` 가 (i) git 성공 시 abbreviated SHA(예: `a1b2c3d`) 반환, (ii) git 실패(`gitFailed: true`) 시 literal `unknown` 반환함을 assert(365행 `|| echo unknown` gate). 소스에서 fallback 표현이 `|| echo unknown`(빈 문자열 `""` 아님)임을 정적 확인.
- [ ] **branch — LOG_DIR / RESULT_JSON 유도 distinct** — `LOG_DIR` == `${repoDir}/deploy/logs`, `RESULT_JSON` basename == `latest-result.json`(logPath basename `daily-<ts>.log` 와 **distinct**)임을 assert(50·53행). 결과 JSON 과 사람용 로그가 서로 다른 파일임을 실증(T-0946 prune 이 daily-*.log 만 대상·latest-result.json 생존과 정합).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0791 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — 스칼라 유도 앵커 부재 시 명시적 실패** — 추출 보조 함수가 스칼라 유도 표현(TS 산출·LOG_FILE·gitSha fallback·printf slot) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **ts non-single-source drift 변별** — LOG_FILE 이 `$TS` 대신 `$(date ...)` 재호출하도록 mutate 한 소스 사본에서 "LOG_FILE 은 동일 TS 재사용" assert 가 실패함을 실증(single-source 회귀 검출). 원본 소스 mutate 0.
  - (b) **date 포맷 drift 변별** — 51행 date 포맷을 구분자 포함(`%Y-%m-%dT%H:%M:%SZ`)으로 치환한 mutant 사본에서 `isCompactUtcTs` 기반 형식 assert 가 실패함을 assert(로그 파일명↔ts 형식 회귀 검출). 원본 문자열 mutate 0 — 사본에만 주입.
  - (c) **gitSha fallback 제거/변조 drift 변별** — 365행 `|| echo unknown` 을 제거한 사본(→ git 실패 fatal)과 `|| echo ""`(빈 문자열) 로 바꾼 사본에서 "gitSha fallback 은 literal unknown" assert 가 실패함을 assert(git 실패 내성·리비전 상관 회귀 검출).
  - (d) **logPath↔ts cross-field drift 변별** — `deriveLogPath` 를 다른 basename(예: `daily-${otherTs}.log`)을 내도록 mutate 한 모델 사본에서 "basename(logPath)==daily-${ts}.log" cross-field assert 가 실패함을 assert(JSON↔로그 역추적 회귀 검출). 원본 모델 불변.
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(TS·gitSha·logPath·LOG_DIR)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 미등장(§9 / REQ-059). gating env 이름(`REALDATA_E2E_*`)조차 본 스칼라 provenance 표면엔 무관(등장 0).
- [ ] **flow — 결정론·no-mutation** — 동일 입력(`ts`·`repoDir`·`rawSha`)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(문자열/객체·shell 소스 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0, 실 `date`/`git` 실행 0(ts/gitSha 는 pure 함수 파라미터로만 표현). 실 redeploy·HTTP·jest spawn·gh·git·bash 실행 0(파일 read + 정적 텍스트 추출 + TS 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. 스칼라 유도 표현(50/51/52/53/365/375~376행)·printf 템플릿·mark·ORDER 미수정(drift 발견 시 별도 fix task). 스칼라 유도를 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + TS 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0791 표면 재단언 금지** — 6-키 schema·순서·failedStep null/quoted **직렬화 분기**는 T-0791 소관. 본 task 는 스칼라 필드(`ts`·`gitSha`·`logPath`)의 **값 산출 provenance**(single-source·cross-field·fallback·LOG_DIR 유도)라는 distinct surface 만. T-0791 spec 파일 변경 0. 템플릿 slot 순서·failedStep 직렬화 재검증 0.
- **T-0944/T-0945/T-0946/T-0947/T-0792 표면 재단언 금지** — result/failedStep 집계 값(T-0944), dual-sink 방출(T-0945), 로그 prune(T-0946), step-chain cascade(T-0947), HTTP path/method/status parity(T-0792)는 각 소관. 본 task 는 **스칼라 값 provenance** distinct surface 만. 해당 spec 파일들 변경 0. (단 T-0946 의 latest-result.json 생존·logPath==daily-*.log distinct 정합은 provenance 관점으로 참조만 — 재단언 아닌 상보.)
- **steps 객체 조립 재검증 금지** — steps_json 조립(368~372행, ORDER 순회·comma-join)은 T-0791/T-0944 소관. 본 task 는 `ts`·`gitSha`·`logPath` **스칼라 slot** 만(steps object 는 다루지 않음).
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read + TS pure 함수 only. gating env / process.env / 실 `date` / 실 `git` / 실 gh / 실 jest spawn / 실 bash 실행 도입 0. T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0791 schema smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 스칼라 유도 표현(50/51/52/53/365/375~376행)을 정적 앵커로 추출 + TS 동형 pure 함수(`logFileNameFromTs`·`deriveLogPath`·`isCompactUtcTs`·`resolveGitSha`)로 provenance 불변식(ts single-source·logPath↔ts cross-field·gitSha unknown-fallback·LOG_DIR 유도) assert. happy(ts single-source 추출·앵커 추출·재사용 model·형식 검증)/branch(logPath↔ts 역추적·gitSha 성공vs실패·LOG_DIR distinct)/error(파일 부재·앵커 부재)/negative(ts non-single-source·date 포맷·gitSha fallback 변조·logPath cross-field·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 date/git/실행 0, credential placeholder 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
