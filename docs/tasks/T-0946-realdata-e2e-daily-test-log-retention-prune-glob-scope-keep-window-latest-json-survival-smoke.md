---
id: T-0946
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **오래된 daily 로그 prune contract** 를 정적 검증하는 non-gated build-time smoke — prune(384행 `ls -1t "$LOG_DIR"/daily-*.log 2>/dev/null | tail -n +"$((LOG_KEEP + 1))" | xargs -r rm -f`)이 **(a) glob scope 가 `daily-*.log` 뿐**(무인 모니터링이 읽는 `latest-result.json` 은 basename 불일치로 **절대 prune 대상 아님** = 방출 파일 생존), **(b) keep-window 가 최근 `LOG_KEEP`(기본 14) 개 유지**(`tail -n +LOG_KEEP+1` = LOG_KEEP 초과분만 삭제), **(c) mtime newest-first sort**(`ls -1t` 로 오래된 것부터 삭제 대상), **(d) `xargs -r`(--no-run-if-empty) 빈-입력 guard**(매칭 0 시 `rm` 이 인자 없이 실행되지 않음), **(e) 실행 위치가 머신-JSON write(375행 `>"$RESULT_JSON"`) 뒤 · stdout `cat "$RESULT_JSON"`(387행) 앞**(prune 이 방금 쓴 result JSON 을 오염/차단 0)임을 봉함. 추가로 머신-JSON `logPath` 필드가 `$LOG_FILE`(52행 `$LOG_DIR/daily-$TS.log`, per-run 로그 — `latest-result.json` 과 distinct)에 bind 됨을 앵커. T-0791(schema)·T-0944(집계)·T-0945(dual-sink 방출) 미cover 한 **로그 보관/prune 경로** gap 을 상보적으로 닫는다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) prune 표현식(384행)·`LOG_KEEP`(46행)·`LOG_FILE`/`LOG_DIR`(50/52행)·머신-JSON logPath(375행)를 정적 추출 + glob==daily-*.log·keep-count==LOG_KEEP+1 offset·`-t` sort·`-r` guard·순서(write<prune<cat)·logPath==LOG_FILE 를 assert. 실 redeploy/HTTP/jest spawn/gh/git 0·process.env/gating 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-log-retention-prune-glob-scope-keep-window-latest-json-survival.smoke-spec.ts
independentStream: realdata-e2e-daily-test-log-retention-prune
plannerNote: P5 §109 step④/⑤ — T-0945 가 머신 JSON dual-sink 방출을 봉한 뒤, 그 방출 파일이 의존하는 로그 prune contract(glob=daily-*.log 만·keep=LOG_KEEP·-t sort·xargs -r guard·write<prune<cat 순서·latest-result.json 생존)를 정적 smoke 로 봉함. T-0791/T-0944/T-0945 상보 표면. test-only 1파일 dep[] file-disjoint stage5b 병렬.
---

# T-0946 — realdata-e2e nightly 오래된 daily 로그 prune contract 정적 smoke (glob=daily-*.log · keep=LOG_KEEP · -t sort · xargs -r guard · write<prune<cat 순서 · latest-result.json 생존)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 머신 요약 JSON(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)을 `deploy/logs/latest-result.json`(파일)+stdout 두 sink 로 내보내고, **로컬 PC 의 무인 모니터링 routine 이 그 결과를 파싱**해 nightly 상태를 판단하는 것을 명시한다. runner 는 매 run 마다 per-run 로그 `deploy/logs/daily-$TS.log`(52행 `$LOG_FILE`) 를 남기고, 파일 무한 누적을 막으려 마지막에 **오래된 daily 로그를 prune** 한다(384행):

```
ls -1t "$LOG_DIR"/daily-*.log 2>/dev/null | tail -n +"$((LOG_KEEP + 1))" | xargs -r rm -f
```

이 prune 라인에는 무인 nightly 운영이 조용히 의존하는 계약 다발이 있다: **(a) glob scope 가 `daily-*.log` 뿐** — 무인 모니터링이 읽는 `latest-result.json` 은 basename 이 glob 과 불일치라 **절대 prune 대상이 아니다**(방출 파일 생존 보장). **(b) keep-window** — `tail -n +"$((LOG_KEEP + 1))"` 는 mtime 최신 `LOG_KEEP`(기본 14, 46행 `${LOG_KEEP:-14}`) 개를 유지하고 그 초과분만 삭제한다. **(c) mtime newest-first sort** — `ls -1t` 의 `-t` 가 최신순 정렬이라 tail offset 이 **오래된 것부터** 지운다(정렬 방향이 뒤집히면 최신 로그가 삭제돼 진단 이력이 사라진다). **(d) `xargs -r` 빈-입력 guard** — `-r`(--no-run-if-empty) 가 매칭 0 일 때 `rm` 이 인자 없이 실행되는 것을 막는다(guard 없으면 빈 파이프에서 `rm -f` 가 인자 대기/에러). **(e) 실행 위치** — prune 은 머신-JSON write(375~378행 `>"$RESULT_JSON"`) **뒤**, stdout `cat "$RESULT_JSON"`(387행) **앞**에 있어 방금 쓴 result JSON 을 오염하거나 stdout 재방출을 차단하지 않는다.

그러나 이 **로그 보관/prune 경로** 계약은 origin/main 시점에 검증 0 부재다: T-0791 parity-drift 는 머신-JSON printf **템플릿의 6-키 스키마·order**만, T-0944 는 `result`/`failedStep` **집계 값 semantics**만, T-0945 는 머신-JSON **dual-sink single-source 방출 경로**만 봉했다. 셋 중 어느 것도 **prune 이 무엇을 지우고 무엇을 남기는가**(glob scope·keep-window·sort 방향·empty guard·실행 순서·logPath binding)는 다루지 않는다. 만약 누군가 prune glob 을 `*.log` 또는 `*` 로 넓히거나(→ `latest-result.json` 이 실수로 prune 후보에 편입돼 무인 모니터링이 방금 쓴 상태 파일을 못 읽음), `ls -1t` 의 `-t` 를 떨어뜨리거나(→ 임의 정렬로 최신 로그가 삭제되고 진단 이력 유실), `tail -n +"$((LOG_KEEP + 1))"` offset 을 잘못 바꾸거나(→ off-by-one 으로 유지 개수 오류), `xargs -r` 의 `-r` 을 지우거나(→ 빈 파이프에서 `rm` 오작동), prune 라인을 머신-JSON write **앞**이나 `cat` **뒤**로 옮기면(→ 순서 회귀로 방출 파일 오염/누락) — 무인 nightly 운영은 상태 파일 유실·이력 유실·명령 오작동의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 parity-drift/T-0944/T-0945 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 (1) prune glob 이 정확히 `"$LOG_DIR"/daily-*.log`(`latest-result.json` basename 미매칭), (2) keep-window 가 `tail -n +"$((LOG_KEEP + 1))"` + `LOG_KEEP` 기본값 14, (3) sort 가 `ls -1t`(`-t` newest-first), (4) `xargs -r rm -f`(빈-입력 guard 존재), (5) prune 라인 위치가 머신-JSON printf redirect(375~378행) 뒤 · `cat "$RESULT_JSON"`(387행) 앞, (6) 머신-JSON `logPath` 필드가 `$LOG_FILE`(=`$LOG_DIR/daily-$TS.log`, `latest-result.json` 과 distinct) 로 bind 됨 을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git rev-parse 0. 실 파일 삭제/`rm` 0(정적 텍스트 추출만 — prune 을 실행하지 않는다). process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 새 외부 dependency 0(node 내장 `fs`/`path` 만). write 명령(`gh issue create|edit`) 무관 — 본 smoke 는 로그 prune 경로 semantics 만 검증하며 write step_report(ADR-0045 deferred)와 독립. production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 prune/logPath contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — prune 라인/`LOG_KEEP`/`LOG_FILE` 미수정, drift 발견 시 별도 fix task). T-0791/T-0944/T-0945 표면 재단언 0(상보적 distinct surface — 본 task 는 **로그 보관/prune 경로**, T-0791 은 템플릿 스키마, T-0944 는 집계 값, T-0945 는 방출 single-source).

issue-still-relevant 확인(2026-07-13): `grep -rn "LOG_KEEP|tail -n|xargs -r|prune|retention|daily-\*" test/smoke/*.smoke-spec.ts` = 로그 prune/retention contract smoke 미존재 확정(기존 `prune` 매칭들은 pnpm `prune --prod` docker artifact / ci-workflow script 토큰 화이트리스트 로 distinct surface). `deploy/daily-test.sh` 는 현재 384행 단일 prune 라인, 46행 `LOG_KEEP="${LOG_KEEP:-14}"`, 52행 `LOG_FILE="$LOG_DIR/daily-$TS.log"`, 375행 머신-JSON `logPath` 필드 — 본 smoke 가 이 앵커들을 잡고 prune/logPath 계약을 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ 머신 요약 JSON = 무인 모니터링 contract, per-run 로그 `daily-$TS.log` + prune)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 앵커를 정확히 추출·검증:
  - `LOG_KEEP="${LOG_KEEP:-14}"`(46행) — 보관 개수 기본값 14 source.
  - `LOG_DIR="$REPO_DIR/deploy/logs"`(50행) + `LOG_FILE="$LOG_DIR/daily-$TS.log"`(52행) + `RESULT_JSON="$LOG_DIR/latest-result.json"`(53행) — per-run 로그 파일 vs 방출 파일 경로 정의 source(둘의 basename 이 distinct: `daily-$TS.log` ↔ `latest-result.json`).
  - 머신-JSON printf(375~378행) — `... "logPath":"%s"}\n' ... "$LOG_FILE" >"$RESULT_JSON"`. **`logPath` 필드가 `$LOG_FILE` 로 채워짐**(per-run 로그, `latest-result.json` 아님) + redirect 대상이 `>"$RESULT_JSON"` 임을 앵커.
  - prune 라인(384행) — `ls -1t "$LOG_DIR"/daily-*.log 2>/dev/null | tail -n +"$((LOG_KEEP + 1))" | xargs -r rm -f`. **glob==`daily-*.log`(latest-result.json 미매칭)·sort==`ls -1t`(`-t`)·keep offset==`tail -n +"$((LOG_KEEP + 1))"`·guard==`xargs -r`** 를 앵커.
  - stdout 방출(387행) — `cat "$RESULT_JSON"`. **prune 라인(384행) 이 머신-JSON write(375행) 뒤 · 이 `cat`(387행) 앞** 이라는 실행 순서를 앵커(라인 인덱스 비교).
  - 주석(37·382행) — "보관할 daily 로그 개수 (기본 14)" / "오래된 daily 로그 prune (최근 LOG_KEEP 개 유지)" — 의도 문서화 source.
- `test/smoke/realdata-e2e-daily-test-machine-result-json-dual-sink-file-stdout-cat-single-source-emission-convergence.smoke-spec.ts` — **동형 패턴 템플릿(T-0945)**. readFileSync + 정적 텍스트 추출 + REPO_ROOT `__dirname` 해석·비-gated describe(describe.skip 0)·credential placeholder 미surface 검사·결정론/no-mutation 규약을 mirror. **단 본 task 는 방출 single-source(printf==1·overwrite·cat) 표면을 재단언하지 않고**(그건 T-0945 소관), **prune glob/keep-window/sort/guard/순서/logPath binding** 라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-log-retention-prune-glob-scope-keep-window-latest-json-survival.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) prune 표현식·`LOG_KEEP`·`LOG_FILE`/`LOG_DIR`·머신-JSON logPath 필드를 정적 추출하고, 로그 prune contract(glob==daily-*.log·keep offset==LOG_KEEP+1·`-t` sort·`xargs -r` guard·write<prune<cat 순서·logPath==LOG_FILE·latest-result.json 생존)를 assert 한다. non-gated(describe.skip 0, process.env/gating 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git/rm 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — prune glob scope 는 `daily-*.log` 뿐** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 prune 라인(384행)의 glob 이 `"$LOG_DIR"/daily-*.log` 임을 정적 assert 하고, **`latest-result.json` 의 basename(`latest-result.json`)이 이 glob 에 매칭되지 않음**(방출 상태 파일이 prune 대상 아님)을 assert.
- [ ] **happy-path — keep-window 는 최근 LOG_KEEP 개 유지** — prune 라인의 `tail -n +"$((LOG_KEEP + 1))"`(LOG_KEEP 초과분만 삭제) offset 표현과 `LOG_KEEP="${LOG_KEEP:-14}"`(46행) 기본값 14 를 정적 추출해 assert(keep-count 계약 고정).
- [ ] **happy-path — mtime newest-first sort** — prune 라인의 sort 가 `ls -1t`(`-t` newest-first flag 존재)임을 assert(오래된 로그부터 삭제 방향 고정 — 최신 로그 삭제 방지).
- [ ] **happy-path — 빈-입력 guard `xargs -r`** — prune 라인이 `xargs -r rm -f`(`-r`/--no-run-if-empty guard 존재)임을 assert(매칭 0 일 때 `rm` 이 인자 없이 실행되지 않음).
- [ ] **happy-path — 실행 순서 write < prune < cat** — 머신-JSON printf redirect(`>"$RESULT_JSON"`, 375~378행)의 라인 인덱스 < prune 라인(384행) 인덱스 < stdout `cat "$RESULT_JSON"`(387행) 인덱스 를 정적으로 비교해 assert(prune 이 방금 쓴 result JSON 을 오염/차단 0).
- [ ] **happy-path — logPath == LOG_FILE binding** — 머신-JSON printf 의 `logPath` 필드가 `$LOG_FILE` 로 채워지고(387행 아닌 375행 printf 인자 순서), `LOG_FILE="$LOG_DIR/daily-$TS.log"`(52행) 로 해석되며 `RESULT_JSON`(latest-result.json)과 basename distinct 임을 assert.
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0945 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — prune/logPath 앵커 부재 시 명시적 실패** — 추출 보조 함수가 prune 라인(`ls -1t ... xargs -r`) 또는 머신-JSON `logPath` 앵커를 못 찾으면(빈 매칭) 명시적으로 실패(빈 배열/undefined 를 pass 로 오통과 0). 앵커 추출이 실 shell 에 실재함을 강제.
- [ ] **branch — glob scope 분기 변별** — glob 검사가 `daily-*.log` 만 통과하고, `daily-*.log` 를 `*.log`(또는 `*`)로 넓힌 mutant 사본에서는 "latest-result.json 미매칭" assert 가 실패함을 assert(원본 소스 문자열 mutate 0 — 사본에만 주입).
- [ ] **branch — sort 방향 분기 변별** — sort 검사가 `ls -1t` 만 통과하고, `-t` 를 제거(`ls -1`)하거나 reverse(`ls -1tr`)한 mutant 사본에서는 실패함을 assert(newest-first 계약 고정).
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **latest-result.json prune 편입 drift 변별** — glob 을 `*.log` 로 넓히거나 별도 `rm` 대상에 `latest-result.json` 을 추가한 mutant 사본은 "latest-result.json 은 prune 대상 아님" assert 를 위반함을 실증(본 smoke 가 실제로 상태-파일 유실 회귀를 잡음을 입증). 원본 mutate 0.
  - (b) **keep-window off-by-one drift 변별** — `tail -n +"$((LOG_KEEP + 1))"` 를 `tail -n +"$LOG_KEEP"`(또는 `+1` 제거)로 치환한 mutant 사본에서 keep-window assert 가 실패함을 assert(유지 개수 계약 고정).
  - (c) **xargs -r guard 제거 drift 변별** — `xargs -r rm -f` 에서 `-r` 을 제거한 mutant 사본에서 empty-guard assert 가 실패함을 assert(빈 파이프 `rm` 오작동 회귀 검출).
  - (d) **실행 순서 drift 변별** — prune 라인을 머신-JSON write **앞**(또는 `cat` **뒤**)으로 옮긴 mutant 사본에서 "write < prune < cat" 순서 assert 가 실패함을 assert(순서 회귀로 방출 파일 오염/누락 검출).
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(prune 라인·glob·경로·logPath)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 미등장(§9 / REQ-059).
- [ ] **flow — 결정론·no-mutation** — 동일 shell 소스로 앵커 추출·검사를 두 번 호출하면 byte-identical deep-equal(결정론). 추출/검사 보조 함수가 입력(shell 문자열 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본을 복제 후 치환하며 원본 문자열 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0, gating 분기 0. 실 redeploy·HTTP·jest spawn·gh·git rev-parse·실 파일 삭제(`rm`) 0(파일 read + 정적 텍스트 추출만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. prune 라인·`LOG_KEEP`·`LOG_FILE`/`LOG_DIR`·머신-JSON logPath 미수정(drift 발견 시 별도 fix task). prune 을 함수로 추출하는 refactor 금지(정적 텍스트 앵커로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0791/T-0944/T-0945 표면 재단언 금지** — 6-키 스키마·order(T-0791), result/failedStep 집계 값 semantics(T-0944), dual-sink single-source 방출(printf==1·overwrite·cat, T-0945)는 각 소관. 본 task 는 **로그 보관/prune 경로 + logPath binding** distinct surface 만. 해당 spec 파일들 변경 0.
- **write step_report / publish 배선 금지** — dual-leg run report 의 write publish(T-0941)는 ADR-0045 credential gate deferred 유지. 본 task 는 로그 prune 경로 정적 smoke 만 — write 명령 문자열·write credential 무관.
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read only. gating env / process.env / 실 gh / 실 jest spawn / 실 git / 실 `rm`·`ls` 도입 0. 실 파일 삭제 / 실 로그 생성 0(정적 텍스트 추출만). T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0945 dual-sink smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 prune 라인(384행)·`LOG_KEEP`(46행)·`LOG_FILE`/`LOG_DIR`(50/52행)·머신-JSON logPath(375행)를 정적 앵커로 추출 + prune contract(glob==daily-*.log·keep offset==LOG_KEEP+1·`-t` sort·`xargs -r` guard·write<prune<cat 순서·logPath==LOG_FILE·latest-result.json 생존) assert. happy/error/branch/negative(latest-result.json prune 편입·keep off-by-one·xargs -r 제거·순서 drift·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 실행 0, credential placeholder 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
