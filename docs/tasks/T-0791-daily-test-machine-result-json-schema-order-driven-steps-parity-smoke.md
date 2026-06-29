---
id: T-0791
title: realdata-e2e step④ deploy/daily-test.sh 머신 요약 latest-result.json 스키마 ↔ ORDER-driven steps 조립 ↔ failedStep null/quoted 분기 contract parity drift-detection non-gated build-time smoke — daily-test.sh 가 stdout/latest-result.json 으로 내보내는 머신 요약 JSON 의 6-키 스키마(ts·gitSha·result·failedStep·steps·logPath), 그 steps 객체 키 집합이 ORDER 배열(redeploy·health·liveness·auth·eval)과 정확히 일치(steps_json 이 ORDER 순회로 조립됨), failedStep 이 null(unquoted)/"step"(quoted) 두 분기로 직렬화됨을 실 deploy/daily-test.sh 파일을 readFileSync 로 읽어 정적 검증하는 cross-artifact(shell→machine-JSON) drift-detection 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 235
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ — build-time aggregator render-line sweep(T-0778~0789, 20-way)·cross-artifact step_eval argv parity(T-0790) 소진/완결. T-0790 Follow-up 명시 candidate (b)(ORDER 배열·mark/JSON 조립 shell 로직 ↔ 머신 JSON 스키마 parity)를 HIGH-bar 재판정으로 채택 — genuine distinct seam: daily-test.sh 가 stdout/latest-result.json 으로 내보내는 머신 요약 JSON(282행 printf, 6 키 ts·gitSha·result·failedStep·steps·logPath) 스키마는 무인 nightly 모니터링 routine 이 파싱하는 운영 contract 인데(헤더 22행 명시) 현재 검증 0. gap 실측(origin/main 1e0217b0): bash test daily-test-step-eval.test.sh(T-0612)는 ORDER 배열(142~150행)·mark 헬퍼(152~161행)만 cover, 내보내는 JSON 의 6-키 스키마·steps 키==ORDER·failedStep null/quoted 직렬화 분기 미cover. TS 측 result-JSON 파서/스키마/smoke 0 부재(grep 확인). step_eval argv(T-0790)·in-memory render-line 과 distinct 한 shell→machine-JSON 스키마 seam. dependsOn [] file-disjoint stage5b 병렬, 신규 spec 1파일 sizeExempt"
independentStream: daily-test-machine-result-json-schema-order-driven-steps-parity-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 인접 패턴(R-112 happy·cross-artifact contract parity(머신 요약 JSON 6-키 스키마 ts·gitSha·result·failedStep·steps·logPath 위치·존재 정합 + steps_json 이 ORDER 순회로 조립되어 steps 키 집합 == ORDER 5-원소(redeploy·health·liveness·auth·eval) byte-identical + failedStep null(unquoted)/quoted-string 두 직렬화 분기 정합) + ORDER 배열 추출 1:1 + printf 템플릿 6-format-slot 위치-정합 + shell 파일 readFileSync robustness + negative 분기 다수(파일 부재·printf 템플릿 부재·키 누락 검출·steps↔ORDER 어긋남 검출·failedStep 분기 누락 검출) + credential 미surface(§9) + 결정론/no-mutation) = ~235 LOC 1파일. T-0789(300)/T-0790(230) sibling smoke 패턴 인접 정당화(test-only·src 0·cross-artifact 변형). 신규 spec 이 파일 I/O(readFileSync) + 토큰/템플릿 추출 보조 함수를 담아 sibling 과 동급 LOC 근접이라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts
---

# T-0791 — realdata-e2e step④ daily-test.sh 머신 요약 latest-result.json 스키마 ↔ ORDER-driven steps 조립 ↔ failedStep null/quoted 분기 contract parity drift-detection non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④는 `deploy/daily-test.sh` 가 매일 02:00 자율 nightly 실 평가 e2e 를 돌린 뒤 **머신 요약 JSON 을 stdout/`latest-result.json` 으로 내보내고, 로컬 PC 의 무인 모니터링 routine 이 그 JSON 을 파싱**해 nightly 상태를 판단하게 한다(`deploy/daily-test.sh` 헤더 18~23행: "머신 요약 JSON → deploy/logs/latest-result.json + stdout(루틴이 파싱)", "stdout 은 마지막 1 줄 JSON 요약만 ... 루틴이 stdout 을 JSON 으로 깔끔히 파싱"). 즉 이 머신 요약 JSON 의 **스키마(키 집합·키 순서·값 직렬화 형식)는 무인 모니터링의 운영 contract** 다 — 스키마가 silent 하게 drift 하면(키 rename·`failedStep` 직렬화 형식 변경·`steps` 키가 ORDER 와 어긋남) routine 이 잘못 파싱해 nightly 모니터링에 false 신호를 준다(REQ-009 search-or-update 멱등 e2e 가 의도대로 돌고 그 결과가 올바로 보고되는가의 운영 무결성).

직전 sweep(T-0778~0789, 20-way render-line)은 in-memory aggregator chain 의 build-time render-line 깊이를 소진했고(T-0789 Follow-up: build-time 순수 render-line closure 고갈), T-0790 은 그 distinct seam 으로 **shell `step_eval` ↔ TS helper 의 jest argv full-vector parity** 를 채웠다. **T-0790 Follow-up 은 다음 잔여 distinct build-time seam 후보로 (b) "ORDER 배열·mark/JSON 조립 shell 로직 ↔ 머신 JSON 스키마 parity" 를 HIGH bar 재판정 조건부로 명시**했다. 본 task 는 그것을 HIGH-bar 로 재판정해 채택한다 — genuine distinct seam 임을 사전 조사로 확인했다.

본 task 의 사전 조사(origin/main 1e0217b0) 결과 — 이 머신 요약 JSON 스키마 contract 는 현재 **검증 0 부재** 다:

- **bash test `deploy/daily-test-step-eval.test.sh`(T-0612)** 는 `ORDER` 배열이 `(redeploy health liveness auth eval)` 인지(142~150행) 와 `mark` 헬퍼가 `STEP_STATUS`/`FAILED_STEP` 를 반영하는지(152~161행) 만 검사한다 — **실제로 stdout/`latest-result.json` 으로 내보내는 머신 요약 JSON 의 스키마(282~285행 `printf` 템플릿)는 미cover**: (1) 6-키 집합(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)이 다 존재하는가, (2) `steps` 객체 키 집합이 `ORDER` 와 정확히 일치하는가(`steps_json` 이 ORDER 순회로 조립됨 — 276~279행), (3) `failedStep` 이 null(unquoted)/`"step"`(quoted) 두 분기로 직렬화되는가(284행 조건부) — 셋 다 단언 0.
- **TS 측 result-JSON 파서/스키마/smoke** 는 grep 으로 확인한 결과 **0 부재** — 어떤 helper/spec 도 `latest-result.json` 의 키 집합·`failedStep` 직렬화·`steps`↔`ORDER` 정합을 읽거나 재유도하지 않는다(머신 contract 를 정의/검증하는 정본 자체가 없음).

즉 **실 `deploy/daily-test.sh` 파일의 `printf` JSON 템플릿(282행) + `ORDER` 배열(203행) + `steps_json` 조립(276~279행) + `failedStep` 분기(284행)를 정적으로 읽어, 내보내는 머신 요약 JSON 의 스키마 contract(6-키 집합·`steps` 키==`ORDER`·`failedStep` null/quoted 두 분기)가 보존됨을 단언하는 smoke 가 0 부재** 다. 이 contract 가 drift 하면(예: 누군가 `result` 키를 `status` 로 바꾸거나, `ORDER` 에 step 을 추가하고 `printf` 템플릿/`steps_json` 조립을 안 맞추거나, `failedStep` 의 null-vs-quoted 조건을 깨거나) 머신 요약과 무인 routine 의 기대 스키마가 silent 분기 → nightly 자율 모니터링 false 신호. 이는 render-line(in-memory) · step_eval argv(T-0790)와 distinct 한, **shell→machine-JSON 스키마 contract** 표면이다.

본 task 는 그 빈 자리를 채운다 — `deploy/daily-test.sh` 를 `readFileSync` 로 읽어 머신 요약 JSON 의 `printf` 템플릿·`ORDER` 배열·`steps_json` 조립·`failedStep` 분기를 정적 추출해, (a) 6-키 스키마 집합·순서, (b) `steps` 키 집합 == `ORDER` 5-원소 byte-identical, (c) `failedStep` null/quoted 두 직렬화 분기의 정합을 단언한다.

live leg(실 redeploy·실 HTTP health/liveness/auth·실 jest spawn·실 git rev-parse) 복제 0·non-gated 항상 실행 — 순수 build-time 검증만(파일 read + 정적 텍스트 추출). `deploy/daily-test.sh` 는 읽기만 하고 실행/source 0(top-level 실행 블록을 source 가드로도 트리거하지 않음 — readFileSync 텍스트 read only).

## Required Reading

- `deploy/daily-test.sh` — **본 task 의 핵심 검증 대상**. 머신 요약 JSON `printf` 템플릿(282~285행: `printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}\n'` — 6-키 순서·`failedStep` 은 `%s` 로 조건부 null/quoted 주입) + `ORDER` 배열(203행: `ORDER=(redeploy health liveness auth eval)`) + `steps_json` 조립(276~279행: `for s in "${ORDER[@]}"; do steps_json="$steps_json,\"$s\":\"${STEP_STATUS[$s]}\""; done` — ORDER 순회로 steps 객체 키 생성) + `failedStep` 직렬화 분기(284행: `"$([ "$FAILED_STEP" = "null" ] && echo null || printf '"%s"' "$FAILED_STEP")"` — null 이면 unquoted null, 아니면 quoted string). 본 task 가 `readFileSync` 로 읽어 정적 추출하는 정확한 source — **추출 정규식/슬라이스는 이 파일의 실제 토큰(printf format 문자열의 키 순서·ORDER 원소·for 루프 변수)으로 확인해 박제(line-prefix·whitespace·escape `\"` drift 0)**.
- `deploy/daily-test-step-eval.test.sh` (T-0612) — bash executable 단위 test. **본 task 와의 경계 확인용**: 이 test 는 `ORDER` 배열 값(142~150행)·`mark` 헬퍼 동작(152~161행)만 검사하고 **내보내는 머신 요약 JSON 스키마(printf 템플릿 6-키·steps↔ORDER·failedStep 직렬화)는 미cover**. 본 task 는 그 빈 자리(machine-JSON 스키마 contract)를 TS 측에서 채움(distinct — ORDER 배열 값 vs 내보내는 JSON 스키마; 본 task 가 이 bash test 를 변경/재구현하지 않음 — 상보적 TS smoke).
- `test/smoke/realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts` (T-0790) — **본 task 와의 경계 확인용 sibling**: 이 smoke 는 shell `step_eval` 의 jest argv ↔ TS helper run-branch argv full-vector parity 를 검증(실행 인자 벡터 seam). 본 task 는 distinct surface — 내보내는 머신 요약 JSON 의 스키마 contract(키 집합·steps↔ORDER·failedStep 직렬화). readFileSync 로 `deploy/daily-test.sh` 를 읽어 정적 추출하는 패턴은 공유하되 추출 대상·단언 surface 가 다름(argv 토큰 vs JSON 템플릿·ORDER·failedStep 분기). 중복 0·상보적. (repo-root 경로 해석·credential 정규식 negative 패턴은 이 sibling 의 방식 참조.)
- `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts` (T-0736) — **경계 확인용**: helper `buildRealDataDailyStepEvalCommandPlan` 단독 in-memory smoke, `deploy/daily-test.sh` bash 배선 명시 Out-of-Scope. 본 task 와 중복 0(본 task 는 shell 파일을 읽어 machine-JSON 스키마 검증, helper 미관여). (이 파일은 NUL KEY_SEP 로 git 이 "Bin" 표기될 수 있음 — MEMORY summary-batch-spec-nul-bytes 참조, 정상이므로 수정 0.)

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time 파일 read + 정적 텍스트 추출 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path: shell 소스 read + 머신 요약 JSON 템플릿/ORDER 추출**: `readFileSync(path.resolve(__dirname, "../../deploy/daily-test.sh"), "utf8")`(또는 cwd-robust 동등 경로)로 shell 소스를 읽어 (1) `printf` 머신 요약 JSON 템플릿 문자열(`{"ts":"%s",...}`)을 추출하는 보조 함수, (2) `ORDER=(...)` 배열 원소를 추출하는 보조 함수를 구현 → 템플릿 문자열이 비어있지 않고 `{` 로 시작·`}` 로 끝남, ORDER 추출 결과가 비어있지 않은 배열임. repo-root 경로는 `__dirname` 기준 상대(`path.resolve(__dirname, "../..")`)로 robust 하게 해석(test 실행 cwd 무관) happy test 1+.
- [ ] **6-키 스키마 집합·순서 정합 수렴(branch — 핵심 불변식 1)**: 추출한 `printf` 템플릿에서 머신 요약 JSON 의 top-level 키를 순서대로 추출 → `["ts", "gitSha", "result", "failedStep", "steps", "logPath"]` 와 **byte-identical**(`toEqual` — 키 값·순서·개수 1:1) 단언 1+ test. 즉 6 키가 모두 존재하고 문서화된 contract 순서대로임(키 rename·추가/누락·순서 변경을 모두 검출).
- [ ] **steps 키 집합 == ORDER byte-identical 수렴(branch — 핵심 불변식 2, 본 task 의 새 표면)**: 추출한 `ORDER` 배열이 `["redeploy", "health", "liveness", "auth", "eval"]`(5-원소 ordered)와 `toEqual` 이고, `steps_json` 조립 로직(`for s in "${ORDER[@]}"` 순회로 `"$s":"..."` 생성 — 276~279행)이 ORDER 를 순회 source 로 사용함을 shell 소스에서 확인(`for s in "${ORDER[@]}"` 패턴 + `steps_json` 에 `"$s"` 키 삽입 패턴 등장) 단언 1+ test. 즉 내보내는 JSON 의 `steps` 객체 키 집합이 `ORDER` 와 정확히 일치하도록 조립됨(steps 키가 ORDER 와 어긋나면 무인 routine 의 step 별 파싱이 깨짐 — 그 정합 박제).
- [ ] **failedStep null/quoted 두 직렬화 분기 정합 수렴(branch — 핵심 불변식 3)**: 추출한 `failedStep` 직렬화 표현식(284행 `[ "$FAILED_STEP" = "null" ] && echo null || printf '"%s"' "$FAILED_STEP"`)이 (a) `FAILED_STEP == "null"` 이면 **unquoted** `null` 을, (b) 아니면 **quoted** `"step"` 을 내보냄을 shell 소스에서 확인 — null-분기 토큰(`echo null`)과 quoted-분기 토큰(`printf '"%s"'`) 둘 다 등장 단언 1+ test. 즉 `failedStep` 이 JS `null`(JSON null) 과 문자열(JSON string) 두 형식으로 올바로 직렬화됨(머신 routine 이 `failedStep === null` vs `failedStep === "auth"` 를 구분 파싱 — 그 두 분기 정본 박제).
- [ ] **머신 요약 JSON 파싱-가능성 수렴(branch)**: 추출한 `printf` 템플릿의 `%s` 슬롯을 합성 더미값(예: `ts="20260629T000000Z"`, `gitSha="abc1234"`, `result="PASS"`, `failedStep=null`, `steps={"redeploy":"PASS",...}`, `logPath="/x.log"`)으로 채워 만든 JSON 문자열이 `JSON.parse` 로 valid object 로 파싱되고, 파싱 결과가 6 키를 가지며 `failedStep === null`(null 분기)·`typeof parsed.steps === "object"`·`parsed.steps` 키가 ORDER 와 일치함 단언 1+ test. AND `failedStep="auth"`(quoted 분기)로 채운 변형이 `JSON.parse` → `parsed.failedStep === "auth"`(string) 단언 1+ test(null/quoted 두 분기 모두 valid JSON 산출 입증).
- [ ] **drift-detection 변별성 수렴(branch — 본 task 가 drift 를 실제로 잡음을 입증)**: 추출한 키 배열의 한 키를 의도적으로 mutate 한 사본(예: `result` → `status`, 또는 키 순서 swap, 또는 한 키 삭제)이 expected 6-키 벡터와 **byte-identical 아님**(`not.toEqual`); ORDER 한 원소를 mutate/제거한 사본이 expected ORDER 벡터와 `not.toEqual` — 즉 본 smoke 의 schema/ORDER 단언이 drift 를 검출하는 진짜 그물임을 명시. 원본 추출 배열은 mutate 0(사본만 변형) 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외/경계 분기마다 각 1+ test:
  - **shell 파일 부재 경로** — 존재하지 않는 경로로 `readFileSync` → throw(ENOENT) 됨을 단언(`expect(() => readFileSync(badPath, "utf8")).toThrow()` — 파일-read 가 silent 0-byte fallback 으로 false-PASS 하지 않음).
  - **printf 템플릿 부재 검출** — 머신 요약 `printf` 가 없는 합성 shell 문자열(예: `"#!/bin/bash\necho noop\n"`)을 템플릿 추출 보조 함수에 주면 추출 결과가 빈/undefined 이거나 추출 함수가 throw — "템플릿 못 찾음" 이 silent PASS 로 새지 않음 단언 1+ test(파싱 robustness).
  - **키 누락 검출(합성)** — `failedStep` 키가 빠진 합성 printf 템플릿 문자열 → 추출한 키 배열이 expected 6-키 벡터와 `not.toEqual`(키 개수/집합 mismatch 검출) 단언 1+ test.
  - **steps↔ORDER 어긋남 검출(합성)** — `ORDER` 에 원소가 추가됐는데 그것이 expected 5-원소 벡터와 `not.toEqual` 인 합성 케이스(또는 ORDER 원소 순서 swap) → 어긋남 검출 단언 1+ test(ORDER drift 가 steps 키 contract 를 깨뜨릴 risk 를 본 smoke 가 잡음).
  - **failedStep 분기 누락 검출(합성)** — null-분기 토큰만 있고 quoted-분기(`printf '"%s"'`)가 없는 합성 표현식 문자열 → 두 분기 정합 단언이 FAIL 함(분기 누락 검출) 단언 1+ test.
- [ ] **credential 누출 0(REQ-059 / §9)**: 본 smoke 가 추출/합성하는 어떤 문자열(템플릿·ORDER·failedStep 표현식·합성 JSON)에도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token/실 토큰 placeholder 값이 등장하지 않음을 정규식 단언 1+ test(머신 요약 JSON 은 ts·gitSha·result·step 상태·logPath 만 운반·credential 미surface — §9 정합).
- [ ] **결정론·no-mutation**: 동일 shell 소스로 템플릿/ORDER/failedStep 추출을 두 번 → 결과가 두 번 byte-identical deep-equal 1+ test. AND 추출 보조 함수가 입력 shell 문자열을 mutate 0, 원본 추출 배열이 drift-변별성 항의 사본 mutate 후에도 불변(deep-equal 유지) 단언 1+ test.
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 production src 변경 0 — 본 spec 추가가 coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 정합(`readFileSync`/`path` node import, 추출 보조 함수의 string[] / string 반환 type, `JSON.parse` 결과 narrowing).
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern daily-test-machine-result-json-schema-order-driven-steps-parity` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS. (파일 read + 정적 텍스트 추출만·실 shell 실행/source/jest spawn/HTTP 0.)

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- `deploy/daily-test.sh` **변경 0** — 읽기(readFileSync)만. printf 템플릿/ORDER/failedStep 직렬화를 고치지 않는다(만약 contract drift 가 실제로 발견되면 그건 별도 fix task — 본 task 는 검증 smoke 신설만, drift 발견 시 Follow-up 에 기록).
- `deploy/daily-test-step-eval.test.sh`(T-0612 bash test) 변경/재구현 0 — 본 task 는 상보적 TS smoke 신설(bash test 의 ORDER 배열/mark cover 를 TS machine-JSON 스키마 parity 로 보완하되 bash test 자체는 그대로).
- 실 `deploy/daily-test.sh` **실행 / source / 실 redeploy·health·liveness·auth·eval step 실행 / 실 jest spawn / 실 git rev-parse / 실 HTTP** 0 — 본 smoke 는 파일 텍스트 read + 정적 추출 + JSON.parse(합성 문자열) 만. step 들의 실 동작·실 머신 JSON 생성(실 stdout) 검증은 본 task 범위 밖.
- `mark` 헬퍼·`STEP_STATUS`·`FAILED_STEP` 누적 로직 자체의 동작 단위 재검증 금지(T-0612 bash test cover). 본 task 는 그 산출이 내보내는 JSON 스키마 contract(키·steps↔ORDER·failedStep 직렬화)만 정적 검증.
- step_eval jest argv full-vector parity(T-0790) 재단언 금지 — 본 task 는 distinct surface(machine-JSON 스키마). argv 추출/helper 호출 0.
- helper `buildRealDataDailyStepEvalCommandPlan`·gating helper·command-args/command-plan/outcome-report 등 in-memory aggregator chain 재단언 금지(각 sweep/helper smoke cover). 본 task 는 shell→machine-JSON 스키마만.
- aggregator render-line sweep(T-0778~0789) 재단언 금지 — 그 sweep 은 소진. 본 task 는 distinct seam(shell→machine-JSON 스키마)으로 in-memory chain 합성 0.
- 실 collectForPerson / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출 0. DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free·파일 read only.
- live-LLM·실 fetch·실 gh CLI·실 collectForPerson·실 jest 프로세스 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). spec 로컬 보조 함수(shell 텍스트에서 printf 템플릿·ORDER·failedStep 표현식 추출·합성 shell/template 문자열 생성·credential 정규식)만 허용.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. node `readFileSync`/`path` 로 `deploy/daily-test.sh` 를 읽어 (1) 머신 요약 `printf` JSON 템플릿(282행)의 top-level 키를 순서대로 추출, (2) `ORDER=(...)` 배열(203행) 원소 추출, (3) `failedStep` 직렬화 표현식(284행)의 null-분기/quoted-분기 토큰 추출하는 spec 로컬 보조 함수 작성. **핵심 새 표면 = shell→machine-JSON 스키마 contract — 내보내는 JSON 의 6-키 집합·순서(`["ts","gitSha","result","failedStep","steps","logPath"]` toEqual) + steps 키 집합 == ORDER 5-원소(`["redeploy","health","liveness","auth","eval"]` toEqual, steps_json 이 `for s in "${ORDER[@]}"` 순회로 조립됨 확인) + failedStep null(unquoted)/quoted-string 두 직렬화 분기 정합**, drift-detection 변별성 항(키/ORDER mutate 사본이 not.toEqual)으로 본 smoke 가 실제 drift 를 잡는 그물임을 박제, 머신 JSON 파싱-가능성 항(템플릿 %s 슬롯을 더미로 채운 JSON 이 JSON.parse valid + 6 키 + steps↔ORDER + failedStep null/string 두 분기)으로 무인 routine 파싱 contract 보존 입증, negative 로 합성 shell/template 문자열(printf 부재·키 누락·ORDER 어긋남·failedStep 분기 누락)에서 추출이 expected 와 not.toEqual/FAIL 함을 입증. **추출 정규식/슬라이스는 `deploy/daily-test.sh` 282~285행(printf format 문자열의 escape `\"` 키)·203행(ORDER 배열)·276~279행(steps_json for 루프)·284행(failedStep 조건부 표현식) 실제 토큰으로 확인해 정확히 박제 — escape·whitespace·들여쓰기 drift 0**. repo-root 경로는 `path.resolve(__dirname, "../..")` 로 cwd-robust 하게. credential 은 합성 placeholder/정규식 negative 만(§9). T-0790 sibling smoke(step_eval argv parity)는 distinct surface 이므로 본 task 와 중복 0 — 상보적(같은 shell 파일을 읽되 추출 대상·단언 surface 다름).).

## Follow-ups

(없음 — 단, 본 task 의 스키마/ORDER/failedStep parity 단언이 실제로 FAIL 하면(즉 현재 `deploy/daily-test.sh` 의 머신 요약 JSON 스키마가 문서화 contract 와 이미 drift) → 그것은 본 smoke 가 잡아낸 genuine 결함이므로 별도 fix task 로 shell 사본을 contract 에 맞추도록 patch 필요 — implementer/tester 가 본 task 구현 중 parity FAIL 을 관측하면 본 Follow-up 에 정확한 drift 토큰을 기록하고 driver 에 BLOCKED 보고. 정상(parity PASS)이면 Follow-up 무변. **다음 sweep 방향**: build-time 순수 seam 은 in-memory aggregator render-line(소진) + cross-artifact shell↔TS step_eval argv parity(T-0790) + shell→machine-JSON 스키마 parity(본 task)로 거의 고갈. 잔여 distinct build-time seam 후보 — (a) `deploy/daily-test.sh` 의 step_health/step_liveness/step_auth 가 두드리는 HTTP endpoint·기대 상태(GET /api == "Assessment-Agent"·GET / 200+SPA HTML·POST /api/users 201|409 등) ↔ 실 NestJS controller route/응답 contract parity(genuine 한지·controller route 가 실제로 존재하는지 HIGH bar 재판정 필요), (b) `deploy/redeploy.sh`/`docker-entrypoint.sh`/`seed-llm-config.sh` 의 shell↔contract parity(genuine seam 인지 HIGH bar 재판정). 모두 genuine seam 인지 HIGH bar 로 엄격 재판정하되, seam 이 없으면(rephrase 양산 위험) live-wiring escalate(step①②③④ 실 wiring — credential/LAN/LLM gate BLOCKED, PLAN.md 108행 live-LLM 🔴 BLOCKED) 또는 P5 다른 PLAN.md bullet(e2e 통합·문서·운영)로 전환 판단. make-work 양산 금지.)
