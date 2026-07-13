---
id: T-0944
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 머신 요약 JSON 의 **result/failedStep 상태-집계 contract** 를 정적 검증하는 non-gated build-time smoke — SKIP 은 result 를 FAIL 로 뒤집지 않음(dormant 6-step SKIP 프로파일 → result=PASS·failedStep=null 유지), FAIL 은 result=FAIL 로 뒤집고 첫 FAIL step 만 failedStep 에 박제(mark first-FAIL-wins), SKIP 은 PASS/FAIL 과 구분되는 제3 상태 토큰으로 steps 값에 직렬화됨을 봉함. T-0791/T-0943 parity-drift(schema·order)가 dummy "PASS" 만 채워 미cover 한 **집계 semantics gap** 을 상보적으로 닫는다. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) RESULT 루프(359~362행)·mark first-FAIL guard(266~271행)·steps_json SKIP 직렬화를 정적 추출 + TS 로 동형 모델링해 7-step PASS/FAIL/SKIP 조합을 assert. 실 redeploy/HTTP/jest spawn/gh 0·process.env/gating 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-machine-result-status-aggregation-skip-nonfailing-failedstep-firstwins-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-machine-result-status-aggregation-contract
plannerNote: P5 §109 step④ — T-0943 이 rediscovery 를 7번째 SKIP-gated step 으로 배선한 뒤, 무인 모니터링이 파싱하는 머신 JSON 의 result/failedStep 집계 semantics(SKIP 비-failing·first-FAIL-wins)를 정적 smoke 로 봉함. parity-drift(schema·order)의 상보 표면. test-only 1 파일 dep[] file-disjoint stage5b 병렬.
---

# T-0944 — realdata-e2e nightly 머신 요약 JSON 의 result/failedStep 상태-집계 contract 정적 smoke (SKIP 비-failing · first-FAIL-wins)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 **머신 요약 JSON**(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)을 stdout/`deploy/logs/latest-result.json` 으로 내보내고 **로컬 PC 의 무인 모니터링 routine 이 그 JSON 을 파싱**해 nightly 상태를 판단하는 것을 명시한다 — 이 JSON 은 무인 모니터링의 운영 contract 다.

T-0943 이 `rediscovery` 를 7번째 step 으로 배선하면서 nightly runner 는 이제 **6 개의 SKIP-gated 프로파일**(cloud CI / 일반 LAN 기본: eval·collect·rediscovery 가 gating 부재로 SKIP, redeploy/health/liveness/auth 는 환경별 PASS/SKIP)을 가진다. 즉 실전 nightly 산출 JSON 의 `steps` 값 대부분이 `SKIP` 이며, 이때 **overall `result` 가 FAIL 로 뒤집히면 안 되고**(SKIP 은 정상 no-op — false 알람 금지), **`failedStep` 은 null 이어야 한다**. 반대로 실제 FAIL 이 하나라도 나면 `result=FAIL` 이 되고 `failedStep` 에는 **첫 FAIL step 만** 박제돼야 한다(`mark` first-FAIL-wins, 266~271행).

그러나 이 **집계 semantics** 는 origin/main 시점에 검증 0 부재다: T-0791/T-0943 의 parity-drift smoke 는 머신 JSON 의 6-키 스키마·`steps`↔`ORDER` byte-parity·`failedStep` null/quoted 두 직렬화 분기만 봉했고, `steps` 값을 채울 때 **오직 dummy `"PASS"` 만** 사용했다(`buildStepsJson` = 모든 step PASS). 즉 (a) SKIP 이 `result` 를 FAIL 로 뒤집지 않는다는 집계 규칙(`RESULT="PASS"` + FAIL-only 검사 루프, 359~362행), (b) 첫 FAIL 만 `failedStep` 에 남는다는 first-FAIL-wins(`mark`), (c) `SKIP` 이 PASS/FAIL 과 구분되는 제3 상태 토큰으로 `steps` 값에 직렬화됨 — 이 세 집계 불변식은 **어떤 spec/helper 도 검증하지 않는다**.

본 task 는 그 빈 자리를 parity-drift 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + TS 동형 모델링)으로 닫는다. `deploy/daily-test.sh` 를 읽어 RESULT 집계 루프·mark first-FAIL guard·steps_json SKIP 직렬화 표현식을 정적 추출하고, 그 bash semantics 를 TS 순수 함수로 동형 모델링해 7-step 의 PASS/FAIL/SKIP 조합(all-SKIP dormant / mixed PASS+SKIP / 단일 FAIL / 다중 FAIL first-wins)에 대한 `result`·`failedStep` 산출을 assert 한다. 이 contract 가 drift 하면(SKIP 이 FAIL 로 집계·다중 FAIL 이 failedStep 을 덮어씀·SKIP 이 steps 값에서 사라짐) 무인 모니터링이 false 알람 또는 silent 오판을 낸다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git rev-parse 0. process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 새 외부 dependency 0(node 내장 `fs`/`path` 만). write 명령(`gh issue create|edit`) 무관 — 본 smoke 는 머신 JSON 집계 semantics 만 검증하며 write step_report(ADR-0045 deferred)와 독립. production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 집계-semantics smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — RESULT 루프/mark/printf 미수정, drift 발견 시 별도 fix task). T-0791 parity-drift smoke 의 스키마·order·failedStep 직렬화 표면 재단언 0(상보적 distinct surface — 본 task 는 **집계 값 semantics**, T-0791 은 **스키마/직렬화 형식**). T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.

issue-still-relevant 확인(2026-07-13): `grep -rl "status-aggregation\|first-FAIL\|SKIP.*non.*fail" test/smoke/` = 0개 — 집계-semantics smoke 미존재 확정. `deploy/daily-test.sh` 의 RESULT 루프(359~362행)는 현재 `[ "${STEP_STATUS[$s]}" = "FAIL" ] && RESULT="FAIL"`(FAIL-only, SKIP/PASS 무시), `mark`(266~271행)는 `[ "$2" = "FAIL" ] && [ "$FAILED_STEP" = "null" ]`(first-FAIL-wins) — 본 smoke 가 이 두 표현식을 정적 앵커로 잡고 TS 동형 모델로 집계 값을 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ "결과를 daily-test result/rolling 이슈에 박제", 머신 요약 JSON = 무인 모니터링 contract)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 세 표현식을 정확히 앵커·모델링:
  - `mark`(266~271행) — `STEP_STATUS["$1"]="$2"` + `if [ "$2" = "FAIL" ] && [ "$FAILED_STEP" = "null" ]; then FAILED_STEP="$1"; fi`(첫 FAIL 만 failedStep 에 박제 = first-FAIL-wins).
  - RESULT 집계 루프(359~362행) — `RESULT="PASS"` init + `for s in "${ORDER[@]}"; do [ "${STEP_STATUS[$s]}" = "FAIL" ] && RESULT="FAIL"; done`(FAIL-only 검사 — SKIP/PASS 는 result 불변).
  - steps_json 조립(367~371행) — `for s in "${ORDER[@]}"; do steps_json="$steps_json,\"$s\":\"${STEP_STATUS[$s]}\""; done`(STEP_STATUS 값을 그대로 직렬화 — SKIP 도 PASS/FAIL 과 동일 슬롯의 제3 토큰).
  - `ORDER=(redeploy health liveness auth eval collect rediscovery)`(261행) — 7-원소 집계 순회 source.
- `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` — **동형 패턴 템플릿(T-0791)**. readFileSync + 정적 텍스트 추출 + TS 합성 모델링 규약·REPO_ROOT `__dirname` 해석·비-gated describe(describe.skip 0)·credential placeholder 미surface 검사·결정론/no-mutation 규약을 mirror. **단 본 task 는 스키마/order/failedStep 직렬화 표면을 재단언하지 않고**(그건 T-0791 소관), `result`/`failedStep` **집계 값 semantics** 라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-machine-result-status-aggregation-skip-nonfailing-failedstep-firstwins-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) RESULT 루프·mark first-FAIL guard·steps_json 직렬화 표현식을 정적 추출하고, 그 bash semantics 를 TS 순수 함수로 동형 모델링해 7-step PASS/FAIL/SKIP 조합의 `result`·`failedStep` 산출을 assert 한다. non-gated(describe.skip 0, process.env/gating 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — dormant all-SKIP 프로파일 → result=PASS·failedStep=null** — TS 동형 집계 모델(mark first-FAIL-wins + RESULT FAIL-only 루프 mirror)에 7-step 을 SKIP 만(또는 SKIP+PASS 혼합, FAIL 0) 넣으면 `result==="PASS"` AND `failedStep===null` 임을 assert. 이것이 cloud CI / 일반 LAN 의 기본 nightly 프로파일(eval·collect·rediscovery SKIP)이 false 알람을 내지 않는다는 핵심 불변식.
- [ ] **happy-path — 정적 앵커 존재** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 (a) RESULT 집계 루프 텍스트(`RESULT="PASS"` + `[ "${STEP_STATUS[$s]}" = "FAIL" ] && RESULT="FAIL"`), (b) mark first-FAIL guard(`[ "$2" = "FAIL" ] && [ "$FAILED_STEP" = "null" ]`), (c) steps_json 직렬화 루프(`"$s":"${STEP_STATUS[$s]}"` 패턴)가 소스에 등장함을 assert(집계 semantics 가 실 shell 에 실재하는 앵커에 근거함을 고정).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0791 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — 집계 모델 입력에 미지 상태 토큰 주입 시 방어** — TS 집계 모델에 PASS/FAIL/SKIP 외 미지 토큰(예: `"UNKNOWN"`)이 섞이면 result 가 실 shell semantics 와 동형으로 처리됨을 assert(실 shell 은 FAIL 만 result 를 뒤집으므로 미지 토큰은 PASS 처럼 result 불변 — 이 동형성을 명시적으로 박제해 모델 drift 검출).
- [ ] **branch — 단일 FAIL → result=FAIL·failedStep=그 step** — 7-step 중 정확히 1 개가 FAIL(나머지 SKIP/PASS)이면 `result==="FAIL"` AND `failedStep===<그 step>` 임을 assert. RESULT 루프의 FAIL-분기와 mark 의 첫-FAIL 박제 branch cover.
- [ ] **branch — first-FAIL-wins(다중 FAIL) → failedStep 은 ORDER 상 첫 FAIL step 만** — ORDER 순서로 여러 step 이 FAIL 일 때 `failedStep` 이 **첫 번째** FAIL step(ORDER index 최소)으로 고정되고 이후 FAIL 이 덮어쓰지 않음을 assert(`mark` 의 `[ "$FAILED_STEP" = "null" ]` guard = 최초 1회만 세팅). result 는 여전히 FAIL.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **SKIP 비-failing 변별성** — 모든 step 이 SKIP 인 프로파일과 모든 step 이 PASS 인 프로파일이 **둘 다 result=PASS·failedStep=null** 로 동형 수렴함을 assert(SKIP 이 PASS 와 result 집계상 동치임을 명시 — SKIP 이 FAIL 로 오집계되면 이 assert FAIL).
  - (b) **SKIP 은 steps 값에서 제3 토큰으로 보존** — steps_json 직렬화 모델에 SKIP 을 넣으면 결과 JSON 의 해당 키 값이 `"SKIP"`(PASS/FAIL 로 뭉개지지 않음) 이고, JSON.parse 후 그 값이 `"SKIP"` 문자열로 round-trip 됨을 assert.
  - (c) **집계 drift 변별성** — SKIP 을 FAIL 로 집계하는 mutant 모델(사본)이 정본 result 와 not.toEqual(본 smoke 가 실제로 집계 drift 를 잡음을 입증). 원본 모델은 mutate 0.
  - (d) **failedStep 덮어쓰기 drift 변별성** — first-FAIL-wins 대신 last-FAIL-wins 하는 mutant 모델(사본)이 정본 failedStep 과 다른 step 을 산출함을 assert(원본 first-wins 계약 고정).
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(RESULT 루프 텍스트·steps_json·합성 JSON)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 미등장(§9 / REQ-059).
- [ ] **flow — 결정론·no-mutation** — 동일 shell 소스로 앵커 추출·집계 모델을 두 번 호출하면 byte-identical deep-equal(결정론). 집계 모델·추출 보조 함수가 입력(STEP_STATUS 사본·shell 문자열)을 mutate 0(원본 불변 assert).
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0, gating 분기 0. 실 redeploy·HTTP·jest spawn·gh·git rev-parse 0(파일 read + 정적 텍스트 추출 + 합성 JSON.parse 만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. RESULT 루프·`mark`·steps_json·printf 템플릿 미수정(drift 발견 시 별도 fix task). RESULT 집계를 함수로 추출하는 refactor 금지(정적 TS 동형 모델링으로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0791 parity-drift smoke 표면 재단언 금지** — 6-키 스키마·`steps`↔`ORDER` byte-parity·`failedStep` null/quoted 직렬화 분기는 T-0791 소관. 본 task 는 `result`/`failedStep` **집계 값 semantics**(SKIP 비-failing·first-FAIL-wins·SKIP 제3 토큰)라는 distinct surface 만. parity-drift spec 파일 변경 0.
- **write step_report / publish 배선 금지** — dual-leg run report 의 write publish(T-0941)는 ADR-0045 credential gate deferred 유지. 본 task 는 머신 JSON 집계 semantics 정적 smoke 만 — write 명령 문자열·write credential 무관.
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read only. gating env / process.env / 실 gh / 실 jest spawn / 실 git 도입 0. T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0791 parity-drift smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 RESULT 루프·mark first-FAIL guard·steps_json 직렬화 표현식을 정적 앵커로 추출 + 그 bash semantics 를 TS 순수 함수(mark first-FAIL-wins + RESULT FAIL-only 집계 + steps_json 직렬화)로 동형 모델링 → 7-step PASS/FAIL/SKIP 조합(all-SKIP dormant·mixed·단일 FAIL·다중 FAIL first-wins)의 result/failedStep 산출 assert. happy/error/branch/negative(SKIP 비-failing 변별·SKIP 제3 토큰 보존·집계 drift mutant·failedStep 덮어쓰기 drift mutant·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 실행 0, credential placeholder 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
