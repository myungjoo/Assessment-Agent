---
id: T-0950
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **step_liveness 앱-생존 3-gate 합취(conjunction) 계약**을 정적 검증하는 non-gated build-time smoke — 기동된 컨테이너가 "살아있다" 를 판정하는 liveness step 의 **내부 3-조건 AND 판정 + SPA-HTML 탐지 정규식 + 조건별 진단 diagnostic** 을 봉함(무인 nightly 가 배포된 앱의 생존을 false-positive/negative 없이 판정함을 신뢰). 계약: **(a) 3-gate 합취 규칙**(95~114행 `step_liveness()` — ① `GET /api` body == `$HEALTH_MESSAGE`(98행) AND ② `GET /` status == `200`(104행 `curl_code`) AND ③ `GET /` body 가 SPA-HTML(108행 `grep -qiE '<!doctype html\|id="root"'`) — 셋 *모두* 통과해야 return 0(alive), 하나라도 실패면 return 1) · **(b) SPA-HTML 탐지 정규식**(108행 `<!doctype html|id="root"` case-insensitive `-qiE` — doctype 선언 또는 SPA mount root div 중 하나만 있어도 SPA 로 인정, health 문자열 단독으론 SPA 아님) · **(c) 조건별 §9-safe 진단 diagnostic**(99·105·109행 `log "step liveness: FAIL — ..."` — 어느 gate 가 깨졌는지 *조건* 만 진단하고 실 body 는 `${body:-<none>}` placeholder 로만 노출, credential/secret echo 0) · **(d) health-vs-liveness 구분**(step_health 는 `GET /api` body 일치만(79~93행), step_liveness 는 그 위에 root 200 + SPA-HTML 을 *더* 요구 — liveness 가 health 의 strict superset). 불변식: liveness 는 3-조건을 *모두* 만족해야만 앱-생존을 단언하고(부분 통과는 FAIL), 실패 시 어느 조건이 깨졌는지 *조건* 만 진단해 응답 body 실값을 누출하지 않으며(§9), SPA-HTML 판정은 doctype 또는 root-div 정규식으로만 한다 — 무인 nightly 가 배포 앱의 실 생존(단순 health ping 이 아닌 SPA 서빙까지)을 신뢰. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) liveness 유도 표현(95~114행)을 정적 추출 + 3-gate 합취 동형 pure 함수(`isAlive`/`isSpaHtml`/`livenessDiagnostic`)로 합취·SPA-정규식·조건별-진단 불변식 assert. T-0792(HTTP path·method·status parity — SPA-HTML 내용 비교 *제외* 명시, line 46)·T-0947(step-chain SKIP cascade — liveness 를 black-box outcome 으로만 취급)·T-0944(집계 값)·T-0945(dual-sink)·T-0946(로그 prune)·T-0948(스칼라 provenance)·T-0949(gating-env 완전성) 가 미cover 한 **liveness step 내부 3-gate 합취 + SPA-HTML 탐지 semantics** gap 상보 표면. 실 redeploy/HTTP/curl/gh/git 0·process.env/liveness 실행 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 360
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-liveness-app-alive-three-gate-conjunction-spa-html-detection-per-condition-diagnostic-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-liveness-app-alive-contract
sizeExempt: true
exemptReason: "test-only 단일 static-smoke spec — 직전 sibling(T-0944~T-0949) 이 425~578 LOC 를 단일 test-only 파일로 shipped(reviewer MINOR 수용). production src LOC 0 / file-disjoint 1 파일. cap-bend pre-justified: 단일 smoke 표면(3-gate 합취 + SPA-HTML 정규식 + 조건별 진단)의 happy/branch/error/negative full cover 에 ~360 LOC 필요, T-0949 정적-smoke 패턴 정당화."
plannerNote: "P5 §109 step④ — T-0949 gating-env 완전성 봉함 뒤, 배포 앱 생존을 판정하는 step_liveness 의 내부 3-gate 합취(GET /api match AND GET / 200 AND SPA-HTML) + SPA 정규식 + 조건별 §9-safe 진단을 정적 smoke 로 봉함. T-0792(HTTP status parity — SPA 내용 비교 제외 명시)/T-0947(cascade black-box outcome) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬."
---

# T-0950 — realdata-e2e nightly step_liveness 앱-생존 3-gate 합취 정적 smoke (GET /api match AND GET / 200 AND SPA-HTML 정규식 · 조건별 §9-safe 진단)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 기동된 컨테이너를 두드려 앱-생존·핵심 계약을 검증함을 명시한다. 그 생존 판정의 **핵심 gate 가 `step_liveness`**(95~114행)다 — 단순 health ping(GET /api body 일치)만으로는 "앱이 살아있다" 로 부족하고, root SPA 가 실제로 서빙되는지까지 확인해야 배포가 온전하다. `step_liveness` 는 이를 **3-조건 합취(AND)** 로 판정한다:

1. **① `GET /api` body == `$HEALTH_MESSAGE`**(98행) — backend health 문자열 일치. 불일치면 즉시 FAIL(`step liveness: FAIL — GET /api 불일치 ('${body:-<none>}')`, 99행).
2. **② `GET /` status == `200`**(102~104행, `curl_code 10 "$BASE_URL/"` → 106행 status 추출) — root(SPA 진입) HTTP 200. 아니면 FAIL(`step liveness: FAIL — GET / status=$code`, 105행).
3. **③ `GET /` body 가 SPA-HTML**(108행 `printf '%s' "$root" | grep -qiE '<!doctype html|id="root"'`) — doctype 선언 또는 SPA mount root div(`id="root"`) 중 하나가 case-insensitive 로 존재. 아니면 FAIL(`step liveness: FAIL — GET / 가 SPA HTML 아님`, 109행).
4. **셋 모두 통과 → return 0**(112~113행 `log "step liveness: OK (GET /api 일치, GET / 200 + SPA HTML)"`).

이 3-gate 합취를 관통하는 **불변식**: **liveness 는 3-조건을 *모두* 만족해야만 앱-생존을 단언하고(부분 통과는 FAIL), 실패 시 어느 *조건* 이 깨졌는지만 진단해 응답 body 실값을 누출하지 않으며(§9), SPA-HTML 판정은 doctype 또는 root-div 정규식으로만 한다.** 이 불변식이 무인 nightly 가 "배포 앱이 실제로 살아있고 SPA 를 서빙한다" 를 false-positive/negative 없이 판정하는 신뢰의 핵심이다:

- **합취(AND) semantics** — 세 조건 중 하나라도 깨지면 liveness FAIL. 만약 이 합취가 OR(하나만 통과해도 alive)로 약화되면, health 문자열만 맞고 root SPA 가 500 을 내는 half-broken 배포가 "alive" 로 오판돼 무인 모니터링이 false-positive 신호를 낸다.
- **SPA-HTML 탐지 정규식**(`<!doctype html|id="root"`, case-insensitive) — root 응답이 실제 SPA HTML 문서인지 판정. 이 정규식이 깨져(예: 빈 정규식/과광범위 매칭) 임의 200 응답을 SPA 로 오인하면, backend 가 404 HTML 이나 프록시 에러 페이지를 200 으로 반환해도 alive 로 오판된다. 반대로 정규식이 과협소해지면 정상 SPA 도 FAIL(false-negative).
- **조건별 §9-safe 진단**(99·105·109행) — 실패 시 로그는 *어느 조건* 이 깨졌는지만 출력하고, body 실값은 `${body:-<none>}` placeholder 로만(그것도 diagnostic 목적) 노출한다. 이 §9 규율이 깨져 응답 body 전체나 secret 을 로그에 흘리면 nightly 로그 파일(deploy/logs/daily-*.log)·stderr 에 민감 정보가 영속화되는 회귀다.
- **health-vs-liveness 구분** — `step_health`(79~93행)는 `GET /api` body 일치만 폴링(타임아웃 내 성공까지 대기), `step_liveness` 는 그 위에 root 200 + SPA-HTML 을 *더* 요구하는 strict superset. 이 구분이 무너져 liveness 가 health 로 축약되면 SPA 서빙 검증이 사라진다.

그러나 이 **liveness step 내부 3-gate 합취 + SPA-HTML 탐지 semantics** 계약은 origin/main 시점에 검증 0 부재다:

- **T-0792**(http-step-contract-nestjs-route-decorator-parity)는 step_liveness/health/auth 가 두드리는 5 endpoint 의 **path·HTTP method·기대 status ↔ NestJS controller route decorator parity** 만 봉하고, **SPA-HTML 내용 비교는 *명시적으로 제외***(그 spec line 46 `GET / SPA HTML 내용(<!doctype html·id="root") 비교 0 — root 는 P6 serve-static`). 즉 3-gate 합취·SPA 정규식·조건별 진단은 T-0792 범위 밖.
- **T-0947**(step-chain SKIP-propagation cascade)는 liveness 를 **black-box outcome**(PASS/FAIL)으로만 취급해 cascade(health==PASS → liveness 실행 else SKIP)만 봉함 — liveness *내부* 3-gate 판정은 다루지 않음.
- **T-0944/T-0945/T-0946/T-0948/T-0949** 는 각각 집계 값·dual-sink·로그 prune·스칼라 provenance·gating-env 완전성만 봉함 — 어느 것도 liveness 내부 합취를 다루지 않음.

만약 누군가 3-gate 합취를 OR 로 바꾸거나(→ half-broken 배포 오판), SPA-HTML 정규식을 빈/과광범위로 약화하거나(→ 임의 200 을 SPA 로 오인), 진단 로그에 body 실값을 끼워넣으면(→ §9 누출), 무인 nightly 는 false-positive alive·정보 누출의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0947/T-0949 와 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 앵커 추출 + 합취 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 liveness 유도 표현(95~114행 + curl_code 62~65행 + health 대조용 79~93행)을 정적 추출하고, 3-gate 합취 동형 pure 함수(`isAlive`·`isSpaHtml`·`livenessDiagnostic`)로 합취·SPA-정규식·조건별-진단 불변식을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 curl·실 HTTP·실 gh·실 git 0. process.env 읽기 0 / liveness 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). 3-gate 합취·SPA-HTML 탐지는 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 네트워크 요청 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 liveness-conjunction contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — liveness 함수/정규식 미수정, drift 발견 시 별도 fix task). T-0792 표면 재단언 0(T-0792 는 path·method·status parity, 본 task 는 liveness *내부* 3-gate 합취·SPA-HTML 내용·조건별 진단 — T-0792 가 명시 제외한 distinct surface). T-0947 표면 재단언 0(cascade black-box outcome). T-0944/T-0945/T-0946/T-0948/T-0949 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): `deploy/daily-test.sh` 는 현재 95~114행 `step_liveness()`(98행 `[ "$body" != "$HEALTH_MESSAGE" ]` → 99행 FAIL 진단, 102~104행 `curl_code 10 "$BASE_URL/"` + `[ "$code" != "200" ]` → 105행 FAIL 진단, 108행 `grep -qiE '<!doctype html|id="root"'` → 109행 FAIL 진단, 112~113행 OK return 0)로 3-gate 합취를 산출 — 본 smoke 가 이 합취 앵커들을 잡고 liveness-conjunction 을 봉한다. T-0792 는 SPA-HTML 내용 비교를 명시 제외(그 spec line 46), T-0947 은 liveness 를 outcome 으로만 취급 → 본 surface 는 origin/main 미cover 로 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ nightly runner 가 기동된 컨테이너를 두드려 앱 생존·핵심 계약 검증)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 liveness 합취 앵커를 정확히 추출·검증:
  - 62~65행 `curl_code()` — `-s -o /dev/null -w '%{http_code}'` status-only 추출 + `--max-time "${1}"` hang guard(positional timeout 인자). liveness 의 `GET /` status 판정이 이 helper 경유(102행).
  - 79~93행 `step_health()` — 대조용. `GET /api` body == `$HEALTH_MESSAGE` 폴링만(root/SPA 미검사). liveness 가 health 의 strict superset 임을 대조 앵커.
  - 95~114행 `step_liveness()` — **3-gate 합취 함수 전체**:
    - 97~101행 gate① — `body="$(curl -s --max-time 5 "$BASE_URL/api" ...)"` + `[ "$body" != "$HEALTH_MESSAGE" ]` → 99행 `log "step liveness: FAIL — GET /api 불일치 ('${body:-<none>}')"` + return 1.
    - 102~107행 gate② — `code="$(curl_code 10 "$BASE_URL/")"` + `[ "$code" != "200" ]` → 105행 `log "step liveness: FAIL — GET / status=$code"` + return 1.
    - 108~111행 gate③ — `printf '%s' "$root" | grep -qiE '<!doctype html|id="root"'` (부정 `! ...`) → 109행 `log "step liveness: FAIL — GET / 가 SPA HTML 아님"` + return 1.
    - 112~113행 OK — `log "step liveness: OK (GET /api 일치, GET / 200 + SPA HTML)"` + return 0.
- `test/smoke/realdata-e2e-daily-test-gating-env-completeness-all-present-nonblank-missing-name-only-diagnostic-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0949)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수(완전성/합취) + 결정론/no-mutation 규약을 mirror. **단 본 task 는 gating-env 완전성을 재단언하지 않고**(그건 T-0949 소관), **liveness 3-gate 합취 + SPA-HTML 탐지 semantics**(3-조건 AND·SPA 정규식·조건별 §9-safe 진단)라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-liveness-app-alive-three-gate-conjunction-spa-html-detection-per-condition-diagnostic-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) liveness 합취 유도 표현(95~114행 + curl_code 62~65행)을 정적 추출하고, 3-gate 합취 동형 pure 함수(`isSpaHtml`·`isAlive`·`livenessDiagnostic`)로 합취·SPA-정규식·조건별-진단 불변식(3-조건 AND·doctype|root-div 정규식·조건별 §9-safe 진단·health superset)을 assert 한다. non-gated(describe.skip 0, process.env/bash/curl 실행 0)라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/curl/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — step_liveness 3-gate 앵커 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 `step_liveness()` 정의(95행)·gate① `[ "$body" != "$HEALTH_MESSAGE" ]`(98행)·gate② `curl_code 10 "$BASE_URL/"`(102행) + `[ "$code" != "200" ]`(104행)·gate③ `grep -qiE '<!doctype html|id="root"'`(108행)·OK return 0(113행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 3-gate 합취를 mirror 함을 앵커).
- [ ] **happy-path — 3-조건 모두 통과 → alive** — `isAlive({apiBody, rootStatus, rootBody})` 가 (apiBody == HEALTH_MESSAGE) AND (rootStatus == 200) AND (isSpaHtml(rootBody)) 인 입력에서 `true`(return 0 동형)를 반환함을 assert. 정상 입력(health 문자열 일치 + 200 + `<!doctype html>...<div id="root">`)으로 호출 시 alive 임을 실증(실 curl/env 읽기 0 — 입력은 함수 파라미터).
- [ ] **happy-path — isSpaHtml 정규식 검증(doctype OR root-div, case-insensitive)** — `isSpaHtml(body)` 가 `"<!DOCTYPE html>"`(대문자)·`"<!doctype html>"`(소문자)·`'<div id="root"></div>'`(doctype 없이 root-div 만)·`'...ID="ROOT"...'`(대소문자 혼합) 각각에 대해 true, health 문자열 단독(`"Assessment-Agent"`)·빈 문자열·doctype/root 둘 다 없는 임의 텍스트에 대해 false 를 반환함을 assert(108행 `<!doctype html|id="root"` case-insensitive `-qiE` 규칙과 정합 — doctype 또는 root-div 중 *하나만* 있어도 SPA 인정).
- [ ] **branch — gate 별 실패 → not-alive + 조건별 진단** — (i) apiBody 불일치(rootStatus/rootBody 정상) → `isAlive` false + `livenessDiagnostic` 가 "GET /api 불일치" 조건 진단, (ii) apiBody 일치이나 rootStatus != 200 → false + "GET / status" 진단, (iii) apiBody 일치 + 200 이나 rootBody 비-SPA → false + "GET / 가 SPA HTML 아님" 진단 — 각 분기가 정확히 자기 조건의 진단을 냄을 assert(99·105·109행 조건별 진단 앵커).
- [ ] **branch — health superset 대조** — step_health(79~93행)는 `GET /api` body 일치만 검사(root/SPA 미검사)하고 step_liveness 는 그 위에 root 200 + SPA-HTML 을 *더* 요구함을 정적 대조 assert(health 소스에 `$BASE_URL/"`(root) 또는 `<!doctype`/`id="root"` SPA 정규식 미등장 확인 — liveness 가 strict superset). health-body-match 조건은 양 step 공통, root/SPA 는 liveness 전용임을 분리 실증.
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0949 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — liveness 합취 앵커 부재 시 명시적 실패** — 추출 보조 함수가 liveness 유도 표현(step_liveness 정의·gate①②③·SPA 정규식·OK return) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **합취 OR-약화 drift 변별** — 3-gate 합취를 OR(하나만 통과해도 alive)로 mutate 한 모델 사본에서 "부분 통과(health 만 맞고 root 500)는 not-alive" assert 가 실패함을 실증(half-broken 배포 오판 회귀 검출). 원본 pure 함수 불변.
  - (b) **SPA 정규식 과광범위 drift 변별** — `isSpaHtml` 을 항상 true(임의 200 을 SPA 로 인정)로 약화한 모델 사본에서 "health 문자열/빈 body 는 SPA 아님" assert 가 실패함을 assert(404/에러 페이지 오인 회귀 검출). 원본 불변.
  - (c) **SPA 정규식 과협소 drift 변별** — `isSpaHtml` 을 doctype 만(root-div 미인정)으로 좁힌 모델 사본에서 "doctype 없이 root-div 만 있는 body 도 SPA 로 인정" assert 가 실패함을 assert(정상 SPA false-negative 회귀 검출 — 108행 `|` OR 분기 보존 강제). 원본 불변.
  - (d) **§9 진단 body-누출 drift 변별** — liveness 진단을 조건명 대신 body 실값 전체를 내도록 mutate 한 모델 사본에서 "진단은 조건만(body 실값 미포함)" assert 가 실패함을 assert(응답 body 누출 회귀 검출). 실 소스 99·105·109행이 조건 진단(+`${body:-<none>}` placeholder)만이고 body 전체 echo·secret 표현 미등장임을 정적 확인.
  - (e) **credential/secret 누출 0** — 추출/합성하는 어떤 문자열(앵커 텍스트·진단·SPA 정규식·입력 body)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`)·password/secret placeholder 실값 미등장(§9 / REQ-059). SMOKE_PASSWORD/env 값은 어디에도 surface 0(liveness 는 credential 미사용이나 §9 정합 회귀 가드).
- [ ] **flow — 결정론·no-mutation** — 동일 입력(liveness 입력 map)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(입력 map·shell 소스 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(입력은 pure 함수 파라미터로만 표현), 실 `curl`/`bash`/`git`/gh 실행 0. 실 redeploy·HTTP·네트워크 요청 0(파일 read + 정적 텍스트 추출 + 합취 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. liveness 합취 유도 표현(95~114행)·SPA 정규식·조건별 진단 미수정(drift 발견 시 별도 fix task). liveness 로직을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 합취 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0792 표면 재단언 금지** — step_liveness/health/auth 의 HTTP path·method·기대 status ↔ NestJS controller route decorator parity 는 T-0792 소관. 본 task 는 liveness *내부* 3-gate 합취·SPA-HTML *내용* 판정(T-0792 가 line 46 에서 *명시적으로 제외*)·조건별 진단이라는 distinct surface 만. T-0792 spec 파일 변경 0. endpoint path/method/status parity 재검증 0.
- **T-0947 표면 재단언 금지** — step-chain SKIP-propagation cascade(health==PASS → liveness 실행 else SKIP)는 T-0947 소관(liveness 를 black-box outcome 으로만 취급). 본 task 는 liveness 함수 *내부* 3-gate 판정 semantics 만. T-0947 spec 파일 변경 0. cascade/gate call-site 재검증 0.
- **T-0944/T-0945/T-0946/T-0948/T-0949 표면 재단언 금지** — 집계 값(T-0944)·dual-sink(T-0945)·로그 prune(T-0946)·스칼라 provenance(T-0948)·gating-env 완전성(T-0949)은 각 소관. 본 task 는 liveness 3-gate 합취 distinct surface 만. 해당 spec 파일들 변경 0.
- **실 앱 기동 / 실 HTTP 검증 금지** — 본 spec 은 non-gated 정적 파일 read + 합취 pure 함수 only. 실 컨테이너 기동·실 `curl`/HTTP 요청·실 SPA 서빙 검증 도입 0(그건 실 nightly 실행 소관). NestJS controller e2e 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0949 gating-env-completeness smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 liveness 합취 유도 표현(95~114행 + curl_code 62~65행 + health 79~93행 대조)을 정적 앵커로 추출 + 3-gate 합취 동형 pure 함수(`isSpaHtml`·`isAlive`·`livenessDiagnostic`)로 합취·SPA-정규식·조건별-진단·health-superset 불변식 assert. happy(3-gate 앵커 추출·3-조건 통과 alive·isSpaHtml 정규식)/branch(gate 별 실패+조건별 진단·health superset 대조)/error(파일 부재·앵커 부재)/negative(합취 OR-약화·SPA 과광범위·SPA 과협소·§9 body-누출·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 curl/bash/HTTP 0, credential/body 실값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
