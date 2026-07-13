---
id: T-0945
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 머신 요약 JSON 의 **dual-sink(file+stdout) single-source 방출 contract** 를 정적 검증하는 non-gated build-time smoke — 머신 JSON 은 정확히 **1개의 printf 템플릿**으로 `>"$RESULT_JSON"`(deploy/logs/latest-result.json)에 **overwrite(`>`, append `>>` 아님)** 로 1회 기록되고, stdout 방출(387행 `cat "$RESULT_JSON"`)은 **그 동일 파일을 재-읽기(cat) 로 re-emit** 할 뿐 **독립 second printf 가 아님** → 무인 모니터링이 파싱하는 stdout JSON 이 persisted 파일과 byte-identical(single write source) 임을 봉함. T-0791(schema/order)·T-0944(집계 값 semantics)가 미cover 한 **방출-경로 single-source** gap 을 상보적으로 닫는다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) printf 방출 표현식(375~378행)·`RESULT_JSON` 정의(53행)·`cat "$RESULT_JSON"` stdout 방출(387행)을 정적 추출 + 머신-JSON printf 발생 횟수==1·overwrite redirect·cat 인자==printf redirect 대상 동일 변수 를 assert. 실 redeploy/HTTP/jest spawn/gh/git 0·process.env/gating 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 235
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-machine-result-json-dual-sink-file-stdout-cat-single-source-emission-convergence.smoke-spec.ts
independentStream: realdata-e2e-daily-test-machine-result-json-dual-sink-single-source
plannerNote: P5 §109 step④ — T-0944 가 result/failedStep 집계 값을 봉한 뒤, 머신 JSON 이 file+stdout 두 sink 로 나가되 stdout 이 파일 cat 재읽기(단일 write source)라 두 sink 가 byte-parity 임을 정적 smoke 로 봉함. T-0791(schema)·T-0944(집계) 상보 표면. test-only 1파일 dep[] file-disjoint stage5b 병렬.
---

# T-0945 — realdata-e2e nightly 머신 요약 JSON 의 dual-sink(file+stdout) single-source 방출 contract 정적 smoke (stdout=cat 재읽기 · overwrite · printf 단일)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 머신 요약 JSON(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)을 **`deploy/logs/latest-result.json`(파일) 과 stdout 두 곳**으로 내보내고(25행 주석: "머신 요약 JSON → deploy/logs/latest-result.json + stdout (루틴이 파싱)"), **로컬 PC 의 무인 모니터링 routine 이 그 stdout JSON 을 파싱**해 nightly 상태를 판단하는 것을 명시한다.

여기에는 무인 모니터링이 의존하는 조용한 불변식이 하나 있다: **파일 sink 와 stdout sink 가 항상 동일한 JSON 이어야 한다**. 실 shell 은 이를 **single write source** 로 보장한다 — 머신 JSON 은 (a) 정확히 **1개의 printf 템플릿**(375~378행)이 `>"$RESULT_JSON"` 로 파일에 **overwrite(`>`)** 로 1회 기록하고, (b) stdout 방출은 387행 `cat "$RESULT_JSON"` 로 **그 동일 파일을 재-읽기** 할 뿐 **독립적인 second printf 가 아니다**. 즉 stdout 은 파일의 byte-identical 복제라 두 sink 가 구조적으로 절대 갈라질 수 없다.

그러나 이 **방출-경로 single-source** 불변식은 origin/main 시점에 검증 0 부재다: T-0791 parity-drift smoke 는 printf **템플릿의 6-키 스키마·order·failedStep null/quoted 직렬화 분기**만 봉했고, T-0944 는 `result`/`failedStep` **집계 값 semantics**(SKIP 비-failing·first-FAIL-wins)만 봉했다. 둘 다 **머신 JSON 이 어떻게 방출되는가**(파일 write 1회 + stdout 이 그 파일 cat) 는 다루지 않는다. 만약 누군가 387행 `cat "$RESULT_JSON"` 을 **stdout 용 두 번째 독립 printf** 로 바꾸거나(→ 두 sink 가 drift 가능), `>` overwrite 를 `>>` append 로 바꾸거나(→ 파일이 run 간 누적돼 routine 이 stale/garbage 파싱), 머신-JSON printf 를 실수로 복제하면(→ 방출 2회, 어느 것이 정본인지 모호) — 무인 모니터링은 파일과 다른 stdout 을 받거나 오래된 JSON 을 파싱해 silent 오판을 낸다.

본 task 는 그 빈 자리를 parity-drift/T-0944 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 (1) 머신-JSON printf 템플릿의 발생 횟수 == 1(방출 단일 source), (2) 그 printf 의 redirect 가 `>"$RESULT_JSON"`(append `>>` 아님 — overwrite), (3) 387행 stdout 방출이 `cat "$RESULT_JSON"`(printf redirect 대상과 **동일 변수** 를 재-읽기 — 독립 printf 아님), (4) `RESULT_JSON` 이 `$LOG_DIR/latest-result.json`(deploy/logs 하위) 로 해석됨 을 assert 한다. 이 contract 가 drift 하면 stdout↔file byte-parity 가 깨진다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git rev-parse 0. process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 새 외부 dependency 0(node 내장 `fs`/`path` 만). write 명령(`gh issue create|edit`) 무관 — 본 smoke 는 머신 JSON 방출-경로 semantics 만 검증하며 write step_report(ADR-0045 deferred)와 독립. production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 방출-경로 single-source smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — printf/cat/redirect 미수정, drift 발견 시 별도 fix task). T-0791 parity-drift smoke 의 6-키 스키마·order·failedStep 직렬화 표면 재단언 0(상보적 distinct surface — 본 task 는 **방출 경로/횟수/redirect/cat single-source**, T-0791 은 **템플릿 스키마 형식**). T-0944 의 result/failedStep **집계 값 semantics** 재단언 0.

issue-still-relevant 확인(2026-07-13): `grep -rln "dual-sink\|cat.*RESULT_JSON\|stdout.*single-source" test/smoke/` = 방출-경로 single-source smoke 미존재 확정(기존 `single-source` 매칭들은 aggregator run-plan threading / T-0791 schema 로 distinct surface). `deploy/daily-test.sh` 는 현재 375~378행 단일 printf `>"$RESULT_JSON"`, 387행 `cat "$RESULT_JSON"`, 53행 `RESULT_JSON="$LOG_DIR/latest-result.json"` — 본 smoke 가 이 세 앵커를 잡고 방출 single-source 를 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ 머신 요약 JSON = 무인 모니터링 contract, "deploy/logs/latest-result.json + stdout" dual-sink)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 앵커를 정확히 추출·검증:
  - `RESULT_JSON="$LOG_DIR/latest-result.json"`(53행) + `LOG_DIR="$REPO_DIR/deploy/logs"`(50행) — 파일 sink 경로 정의 source.
  - 머신-JSON printf(375~378행) — `printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}\n' ... >"$RESULT_JSON"`. **redirect 가 `>`(overwrite, `>>` append 아님)** + 이 6-키 템플릿 printf 가 **파일 전체에 정확히 1회** 등장함을 앵커.
  - stdout 방출(387행) — `cat "$RESULT_JSON"`. **stdout 이 독립 printf 가 아니라 printf redirect 대상과 동일 `$RESULT_JSON` 변수의 재-읽기(cat)** 임을 앵커.
  - 주석(25행) — "머신 요약 JSON → deploy/logs/latest-result.json + stdout (루틴이 파싱)" — dual-sink 의도 문서화 source.
- `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` — **동형 패턴 템플릿(T-0791)**. readFileSync + 정적 텍스트 추출 + REPO_ROOT `__dirname` 해석·비-gated describe(describe.skip 0)·credential placeholder 미surface 검사·결정론/no-mutation 규약을 mirror. **단 본 task 는 6-키 스키마/order/failedStep 직렬화 표면을 재단언하지 않고**(그건 T-0791 소관), **printf 방출 횟수/redirect(`>`)/stdout cat single-source** 라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-machine-result-json-dual-sink-file-stdout-cat-single-source-emission-convergence.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) 머신-JSON printf 방출 표현식·`RESULT_JSON` 정의·`cat "$RESULT_JSON"` stdout 방출을 정적 추출하고, dual-sink single-source contract(방출 printf 단일·overwrite redirect·stdout=동일 파일 cat)를 assert 한다. non-gated(describe.skip 0, process.env/gating 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — 머신-JSON printf 는 정확히 1회 방출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 6-키 머신-JSON 템플릿(`{"ts":"%s","gitSha":"%s",...,"logPath":"%s"}`)을 생성하는 printf 가 파일 전체에 **정확히 1회** 등장함을 assert(방출 단일 write source — 복제 printf 0). count == 1 (0 도, 2 도 아님).
- [ ] **happy-path — 파일 sink 는 overwrite redirect** — 그 머신-JSON printf 의 redirect 가 `>"$RESULT_JSON"`(overwrite) 임을, `>>"$RESULT_JSON"`(append) 이 **아님**을 정적 assert(append 면 run 간 누적돼 routine 이 stale JSON 파싱 — overwrite 만이 latest-result 의미를 보장).
- [ ] **happy-path — stdout 방출은 동일 파일 cat 재-읽기** — 387행 stdout 방출이 `cat "$RESULT_JSON"`(printf redirect 대상과 **동일 `$RESULT_JSON` 변수**)임을 assert 하고, stdout 방출부에 **독립적인 6-키 printf(두 번째 방출 source) 가 없음**을 assert(stdout 이 파일의 byte-identical 복제 = single source).
- [ ] **happy-path — 파일 sink 경로 해석** — `RESULT_JSON="$LOG_DIR/latest-result.json"`(53행) + `LOG_DIR="$REPO_DIR/deploy/logs"`(50행)를 정적 추출해 파일 sink 가 `deploy/logs/latest-result.json` 로 해석됨을 assert(무인 모니터링이 읽는 경로 고정).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0791 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — printf/cat 앵커 부재 시 명시적 실패** — 추출 보조 함수가 머신-JSON printf 또는 `cat "$RESULT_JSON"` 앵커를 못 찾으면(빈 매칭) 명시적으로 실패(빈 배열/undefined 를 pass 로 오통과 0). 앵커 추출이 실 shell 에 실재함을 강제.
- [ ] **branch — count 분기 변별** — 머신-JSON printf 발생 횟수 검사가 count==1 만 통과하고, 합성 mutant 소스(printf 를 복제해 count==2, 또는 printf 를 제거해 count==0)에서는 실패함을 assert(원본 소스 문자열 mutate 0 — 사본에만 주입).
- [ ] **branch — redirect overwrite/append 분기 변별** — redirect 검사가 `>` 만 통과하고, `>"$RESULT_JSON"` 를 `>>"$RESULT_JSON"` 로 치환한 mutant 사본에서는 실패함을 assert(overwrite 계약 고정).
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **stdout 독립-printf drift 변별** — 387행 `cat "$RESULT_JSON"` 을 stdout 용 독립 6-키 printf 로 치환한 mutant 사본은 "머신-JSON printf 발생 == 1" assert 를 위반(count==2)함을 실증(본 smoke 가 실제로 dual-source drift 를 잡음을 입증). 원본 mutate 0.
  - (b) **cat 인자 변조 변별** — `cat "$RESULT_JSON"` 을 `cat "$SOME_OTHER_FILE"`(printf redirect 대상과 다른 변수)로 치환한 mutant 사본에서 "stdout cat 인자 == printf redirect 대상 변수" assert 가 실패함을 assert(stdout 이 반드시 write 된 그 파일을 읽어야 single-source).
  - (c) **경로 drift 변별** — `RESULT_JSON` 정의를 `latest-result.json` 이 아닌 다른 basename 으로 치환한 mutant 사본에서 경로 assert 가 실패함을 assert(무인 모니터링 계약 경로 고정).
  - (d) **append drift 변별** — 위 branch 의 `>>` mutant 를 negative 로도 명시(overwrite→append 회귀가 latest-result 누적 오염을 유발한다는 계약 근거를 별도 assert 로 박제).
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(printf 템플릿·redirect·cat 라인·경로)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 미등장(§9 / REQ-059).
- [ ] **flow — 결정론·no-mutation** — 동일 shell 소스로 앵커 추출·검사를 두 번 호출하면 byte-identical deep-equal(결정론). 추출/검사 보조 함수가 입력(shell 문자열 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본을 복제 후 치환하며 원본 문자열 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0, gating 분기 0. 실 redeploy·HTTP·jest spawn·gh·git rev-parse 0(파일 read + 정적 텍스트 추출만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. printf 템플릿·`cat "$RESULT_JSON"`·redirect·`RESULT_JSON`/`LOG_DIR` 정의 미수정(drift 발견 시 별도 fix task). 방출부를 함수로 추출하는 refactor 금지(정적 텍스트 앵커로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0791 parity-drift smoke 표면 재단언 금지** — 6-키 스키마·`steps`↔`ORDER` byte-parity·`failedStep` null/quoted 직렬화 분기는 T-0791 소관. 본 task 는 **printf 방출 횟수/redirect(`>`)/stdout cat single-source** 라는 distinct surface 만. parity-drift spec 파일 변경 0.
- **T-0944 집계-semantics smoke 표면 재단언 금지** — `result`/`failedStep` 집계 값 semantics(SKIP 비-failing·first-FAIL-wins·SKIP 제3 토큰)는 T-0944 소관. 본 task 는 방출-경로 single-source 만. 집계-semantics spec 파일 변경 0.
- **write step_report / publish 배선 금지** — dual-leg run report 의 write publish(T-0941)는 ADR-0045 credential gate deferred 유지. 본 task 는 머신 JSON 방출-경로 정적 smoke 만 — write 명령 문자열·write credential 무관.
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read only. gating env / process.env / 실 gh / 실 jest spawn / 실 git 도입 0. 실 파일 write / 실 stdout 캡처 0(정적 텍스트 추출만). T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0791 parity-drift smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 머신-JSON printf(375~378행)·redirect(`>"$RESULT_JSON"`)·stdout `cat "$RESULT_JSON"`(387행)·`RESULT_JSON`/`LOG_DIR` 정의(50/53행)를 정적 앵커로 추출 + dual-sink single-source contract(printf 발생==1·overwrite redirect·stdout cat 인자==printf redirect 대상 동일 변수·경로==deploy/logs/latest-result.json) assert. happy/error/branch/negative(stdout 독립-printf drift·cat 인자 변조·경로 drift·append drift·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 실행 0, credential placeholder 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
