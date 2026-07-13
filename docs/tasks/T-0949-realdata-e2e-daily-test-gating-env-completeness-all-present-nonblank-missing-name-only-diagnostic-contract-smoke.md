---
id: T-0949
title: realdata-e2e nightly runner(`deploy/daily-test.sh`) 의 **gating-env completeness 계약**(`realdata_eval_gating_enabled`)을 정적 검증하는 non-gated build-time smoke — realdata-e2e live leg(eval/collect/rediscovery) 을 **언제 실행/SKIP 할지 결정하는 gating 함수의 내부 완전성 semantics** 를 봉함(무인 nightly 가 cloud CI / 일반 LAN 에서 credential 부재 시 조용히 SKIP·부분-set 시 이름만 진단·실값 누출 0 을 신뢰). 계약: **(a) 7-env 이름 집합·순서**(150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)` — enable flag → Ollama 5 종 → github read PAT, T-0610 helper 의 `REALDATA_E2E_REQUIRED_ENV` 이름·순서 bash mirror) · **(b) all-present-AND-non-blank 완전성 규칙**(164~179행 — 7 종 *모두* present+non-blank 여야 return 0(enabled), 하나라도 부재/빈/공백-only 면 return 1(disabled)) · **(c) whitespace-blank guard**(169행 `[ -z "${val//[[:space:]]/}" ]` — trim 후 길이 0 이면 부재로 간주, T-0610 helper 의 non-blank 규칙 mirror) · **(d) missing-NAMES-only §9 진단**(173~176행 `log "step eval: gating env 부재 — ${missing[*]}"` — 부재 env *이름* 만 로그, 실 credential *값* echo 0). 불변식: gating 함수는 7-env 완전성(전부 present+non-blank)으로만 enabled 를 산출하고, 부분-set 이면 부재 *이름* 만 진단해 credential 값을 절대 누출하지 않는다(§9) — cloud CI / 일반 LAN 무인 실행이 네트워크 0 / secret 0 / jest spawn 0 의 조용한 SKIP 을 신뢰. `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) gating 유도 표현(150~158·164~179행)을 정적 추출 + 완전성 동형 pure 함수(`gatingEnabled`/`isBlank`/`missingEnvNames`/`REQUIRED_ENV`)로 완전성·blank-guard·이름만-진단 불변식 assert. T-0947(step-chain SKIP-propagation cascade — `! realdata_eval_gating_enabled` gate call-site 3 회 count 만)·T-0790/T-0887(eval/collect jest argv parity)·T-0791(6-키 schema)·T-0944(집계 값)·T-0945(dual-sink)·T-0946(로그 prune)·T-0948(스칼라 provenance) 가 미cover 한 **gating 함수 내부 완전성 semantics**(7-env 완전성·blank-guard·이름만-§9-진단) gap 상보 표면. 실 redeploy/HTTP/jest spawn/gh/git 0·process.env/gating 실행 0·credential 0·새 dep 0·write 0(ADR-0045 무관)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-test-gating-env-completeness-all-present-nonblank-missing-name-only-diagnostic-contract.smoke-spec.ts
independentStream: realdata-e2e-daily-test-gating-env-completeness
plannerNote: P5 §109 step④ — T-0948 이 스칼라 provenance 를 봉한 뒤, realdata-e2e live leg 을 언제 SKIP/실행할지 결정하는 gating 함수(realdata_eval_gating_enabled) 의 내부 완전성 semantics(7-env 완전성·whitespace-blank guard·부재 이름만 §9 진단·실값 누출 0)를 정적 smoke 로 봉함. T-0947(cascade gate call-site count)/T-0790(argv parity) 상보 distinct surface. test-only 1파일 dep[] file-disjoint stage5b 병렬.
---

# T-0949 — realdata-e2e nightly gating-env completeness 정적 smoke (7-env all-present-non-blank · whitespace-blank guard · missing-name-only §9 진단)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 `deploy/daily-test.sh` nightly runner 가 realdata-e2e live leg(eval/collect/rediscovery) 을 **gating env 7 종이 모두 set 일 때만** 실행하고, 부재 시 SKIP(네트워크 0 / secret 0 / jest spawn 0 no-op)함을 명시한다. 이 SKIP-vs-run 결정의 **판정 주체**가 `realdata_eval_gating_enabled` 함수(164~179행)다. T-0947 은 이 함수의 **호출 결과에 따른 downstream SKIP-propagation cascade**(auth 미통과 또는 gating 부재 → eval/collect/rediscovery SKIP, `! realdata_eval_gating_enabled` gate call-site 3 회 등장)만 봉했다 — 그러나 **gating 함수가 어떻게 enabled/disabled 를 산출하는가**(내부 완전성 semantics)는 origin/main 시점에 검증 0 부재다. 이 완전성 semantics 는 무인 nightly 운영의 실용적 안전성·§9 credential 비-누출의 핵심이다:

- **(a) 7-env 이름 집합·순서**(150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)`) — gating 은 정확히 7 종(`REALDATA_E2E_LIVE_TEST`(enable flag) → `REALDATA_E2E_LLM_BASE_URL`·`_API_KEY`·`_MODEL`·`_PROVIDER`·`_API_VERSION`(Ollama 접속 5 종) → `REALDATA_E2E_GITHUB_READ_PAT`(github read PAT)) 로 판정한다. 이 이름·순서는 T-0610 `realdata-e2e-live-gating.ts` 의 `REALDATA_E2E_REQUIRED_ENV` 를 bash 로 mirror 한 것(정본은 그 helper, 배열은 이름·순서만 동일 박제). 이름 하나가 빠지거나 순서가 바뀌면 gating 판정이 정본 helper 와 어긋난다.
- **(b) all-present-AND-non-blank 완전성 규칙**(164~179행) — 7 종을 순회하며 하나라도 부재/빈/공백-only 면 `missing` 에 이름을 담고, `missing` 이 비지 않으면 return 1(disabled), 전부 present+non-blank 여야 return 0(enabled). 즉 **부분-set(6/7 만 set)은 disabled** 다 — half-armed 상태에서 live leg 이 실행돼 credential 절반만으로 실 네트워크를 두드리는 사고를 차단한다.
- **(c) whitespace-blank guard**(169행 `[ -z "${val//[[:space:]]/}" ]`) — env 가 present 여도 값이 공백-only(예: `"   "`)면 부재로 간주한다. `${val//[[:space:]]/}`(모든 whitespace 제거 후 길이 0 검사)는 T-0610 helper 의 non-blank 규칙 mirror. 이 guard 가 깨져 공백-only 를 present 로 오판하면, 실질적으로 빈 credential 로 live leg 이 실행돼 무의미한 실패/네트워크 낭비를 낳는다.
- **(d) missing-NAMES-only §9 진단**(173~176행 `log "step eval: gating env 부재 — ${missing[*]}"`) — 부재 시 로그는 부재 env *이름* 만 출력하고 **실 credential 값은 절대 echo 하지 않는다**(§9 / REQ-059). `${missing[*]}` 는 부재로 판정된 이름 배열이지 값 배열이 아니다. 이 §9 규율이 깨져 값을 로그에 흘리면 nightly 로그 파일(deploy/logs/daily-*.log)·stderr 에 credential 이 영속화되는 보안 회귀다.

이 gating 완전성 전체를 관통하는 **불변식**: **gating 함수는 7-env 완전성(전부 present+non-blank, 공백-only 는 부재)으로만 enabled 를 산출하고, 부분-set 이면 부재 *이름* 만 진단해 credential 값을 절대 누출하지 않는다.** 이 불변식이 cloud CI / 일반 LAN 무인 실행의 조용한 SKIP(no-op)·§9 비-누출 신뢰성의 핵심이다.

그러나 이 **gating 함수 내부 완전성 semantics** 계약은 origin/main 시점에 검증 0 부재다: T-0947 은 `! realdata_eval_gating_enabled` **gate call-site 3 회 등장**(311/329/348행)과 그에 따른 downstream SKIP cascade 만 봉했다(함수 *내부* 의 7-env 완전성·blank-guard·이름만-진단은 다루지 않음 — 함수를 black-box 로 호출 카운트만). T-0790/T-0887 은 eval/collect 의 **jest argv parity**(run 분기 argv)만, T-0791 은 6-키 **schema·순서**만, T-0944 는 **집계 값**만, T-0945 는 **dual-sink 방출**만, T-0946 은 **로그 prune**만, T-0948 은 **스칼라 provenance**만 봉했다. 어느 것도 **7-env 이름 집합·완전성 규칙·whitespace-blank guard·missing-NAMES-only §9 진단**은 다루지 않는다. 만약 누군가 REALDATA_E2E_REQUIRED_ENV 에서 env 이름을 빼거나(→ 불완전 gating), 완전성 검사를 OR(하나라도 set 이면 enabled)로 바꾸거나(→ half-armed 실행), blank-guard 를 `[ -z "$val" ]`(공백-only 통과)로 약화하거나, 진단 로그에 `${!name}`(실값)을 끼워넣으면(→ §9 누출) — 무인 nightly 운영은 half-armed 실행·credential 누출의 silent 회귀를 겪는다.

본 task 는 그 빈 자리를 T-0947/T-0948 과 **동형 정적 패턴**(shell 파일 readFileSync + 텍스트 추출 + 완전성 동형 pure 함수 + 정적 assert)으로 닫는다. `deploy/daily-test.sh` 를 읽어 gating 유도 표현(150~158·164~179행)을 정적 추출하고, 완전성 동형 pure 함수(`gatingEnabled`·`isBlank`·`missingEnvNames`·`REQUIRED_ENV`)로 완전성 불변식(7-env 이름·all-present-non-blank·blank-guard·이름만-진단)을 assert 한다.

**비-blocked 근거**: 본 task 는 `deploy/daily-test.sh` 를 **readFileSync 로 읽기만** 한다(실행/source 0). 실 redeploy·실 HTTP·실 jest spawn·실 gh·실 git 0. process.env 읽기 0 / gating 분기 실행 0 — non-gated 항상 실행(describe.skip 0, R-113 green). gating 완전성은 pure 함수로 **동형 모델링**할 뿐 실 bash / 실 env 읽기 0. 새 외부 dependency 0(node 내장 `fs`/`path` 만). production `src/` LOC 0(test-only). 새 credential / env / schema / auth 흐름 도입 0 → §5 재-BLOCKED 불요.

**scope 경계**: 본 task 는 정적 gating-completeness contract smoke 만 추가한다. `deploy/daily-test.sh` 변경 0(읽기만 — gating 함수/env 배열 미수정, drift 발견 시 별도 fix task). T-0947 표면 재단언 0(T-0947 은 downstream SKIP-propagation cascade / gate call-site count, 본 task 는 gating 함수 **내부 완전성 semantics** — distinct surface). T-0790/T-0887/T-0791/T-0944/T-0945/T-0946/T-0948 표면 재단언 0.

issue-still-relevant 확인(2026-07-13): T-0947 spec 은 `! realdata_eval_gating_enabled` gate call-site 3 회 등장과 downstream SKIP cascade 만 모델링(함수 *내부* 완전성·blank-guard·이름만-진단은 미cover — grep `REQUIRED_ENV|missing|blank|공백|이름만|7 종` on T-0947 spec 결과 gate call-site count 3 뿐). `deploy/daily-test.sh` 는 현재 150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)`(7 종), 164~179행 `realdata_eval_gating_enabled()`(for 순회 + 169행 `[ -z "${val//[[:space:]]/}" ]` blank-guard + 173~176행 `log "... ${missing[*]}"` 이름-진단 + return 1/0) 로 gating 완전성을 산출 — 본 smoke 가 이 완전성 앵커들을 잡고 gating-env completeness 를 봉한다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ realdata-e2e live leg gating = 7-env 완전성 판정, cloud CI / 일반 LAN 조용한 SKIP)
- `deploy/daily-test.sh` — **1순위 정적 검증 대상(읽기만, 실행/source 0)**. 다음 gating 완전성 앵커를 정확히 추출·검증:
  - 150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)` — 7-env 이름·순서(enable flag → Ollama 5 종 → github read PAT) 앵커. T-0610 helper 이름 집합·순서 bash mirror.
  - 164~179행 `realdata_eval_gating_enabled()` — 완전성 함수 전체. for 순회(166~172행)·`missing` 누적·return 분기(173~178행).
  - 169행 `[ -z "${val//[[:space:]]/}" ]` — whitespace-blank guard(trim 후 길이 0 → 부재) 앵커.
  - 173~176행 `log "step eval: gating env 부재 — ${missing[*]}"` + return 1 — missing-NAMES-only §9 진단(이름 배열, 실값 아님) + disabled 반환 앵커.
  - 178행 `return 0` — 전부 present+non-blank 시 enabled 반환 앵커.
- `test/smoke/realdata-e2e-daily-test-machine-json-scalar-provenance-ts-single-source-logpath-crossfield-gitsha-unknown-fallback-contract.smoke-spec.ts` — **동형 패턴 템플릿(T-0948)**. readFileSync + 정적 텍스트 앵커 추출 + 동형 pure 함수 + 결정론/no-mutation 규약을 mirror. **단 본 task 는 스칼라 provenance 를 재단언하지 않고**(그건 T-0948 소관), **gating 함수 내부 완전성 semantics**(7-env 이름·all-present-non-blank·blank-guard·이름만-§9-진단)라는 distinct surface 만 봉한다.

## Acceptance Criteria

신규 smoke spec 1 개(`test/smoke/realdata-e2e-daily-test-gating-env-completeness-all-present-nonblank-missing-name-only-diagnostic-contract.smoke-spec.ts`). `deploy/daily-test.sh` 를 readFileSync 로 읽어(실행/source 0) gating 완전성 유도 표현(150~158·164~179행)을 정적 추출하고, 완전성 동형 pure 함수(`REQUIRED_ENV`·`isBlank`·`missingEnvNames`·`gatingEnabled`)로 완전성 불변식(7-env 이름·all-present-non-blank·whitespace-blank guard·missing-NAMES-only §9 진단)을 assert 한다. non-gated(describe.skip 0, process.env/bash 실행 0) 이라 public CI 에서 항상 실행돼 green. 실 redeploy/HTTP/jest spawn/gh/git 0. `deploy/daily-test.sh` 미변경(읽기만). production `src/` LOC 0.

- [ ] **happy-path — 7-env 이름 집합·순서 정적 추출** — `deploy/daily-test.sh` 를 readFileSync 로 읽어 150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)` 배열을 정적 추출하고, 정확히 7 개 이름이 예상 순서(`REALDATA_E2E_LIVE_TEST`, `REALDATA_E2E_LLM_BASE_URL`, `REALDATA_E2E_LLM_API_KEY`, `REALDATA_E2E_LLM_MODEL`, `REALDATA_E2E_LLM_PROVIDER`, `REALDATA_E2E_LLM_API_VERSION`, `REALDATA_E2E_GITHUB_READ_PAT`)로 등장함을 assert(정본 T-0610 helper 이름·순서 mirror 앵커).
- [ ] **happy-path — gating 함수 앵커 정적 추출** — `realdata_eval_gating_enabled` 함수 정의(164행)·for 순회(166행 `for name in "${REALDATA_E2E_REQUIRED_ENV[@]}"`)·blank-guard(169행 `[ -z "${val//[[:space:]]/}" ]`)·이름-진단(175행 `${missing[*]}`)·return 1(176행)·return 0(178행)이 실 소스에 존재함을 정적 assert(pure 함수가 실 bash 완전성 로직을 mirror 함을 앵커).
- [ ] **happy-path — all-present-non-blank → enabled model** — `gatingEnabled(env)` 가 7-env 모두 present+non-blank 인 입력에서 `true`(return 0 동형)를 반환함을 assert. 정상 env map(7 종 전부 non-blank 값)으로 호출 시 enabled 임을 실증(실 env 읽기 0 — env map 은 함수 파라미터).
- [ ] **happy-path — isBlank whitespace guard 검증** — `isBlank(val)` 가 빈 문자열·공백-only(`"   "`·`"\t\n"`)에 대해 true, 비어있지 않은 값(`"x"`·`" x "`(내부 non-space 존재))에 대해 false 를 반환함을 assert(169행 `${val//[[:space:]]/}` trim-후-길이-0 규칙과 정합).
- [ ] **branch — partial-set → disabled + missing 이름 목록** — 7-env 중 일부(예: `REALDATA_E2E_GITHUB_READ_PAT` 만 부재)인 입력에서 `gatingEnabled` 가 `false` 를, `missingEnvNames(env)` 가 부재 env *이름* 배열(`["REALDATA_E2E_GITHUB_READ_PAT"]`)을 반환함을 assert(164~176행 부분-set → disabled 분기). 부재가 2+ 종일 때도 이름 목록이 정확히 그 부재 이름들임을 실증.
- [ ] **branch — all-absent vs all-present 양극** — (i) 7-env 전부 부재 → `gatingEnabled` false + `missingEnvNames` 가 7 이름 전부, (ii) 7-env 전부 present+non-blank → `gatingEnabled` true + `missingEnvNames` 빈 배열 임을 assert(완전성 규칙 양 끝단 분기).
- [ ] **error path — shell 파일 부재 → readFileSync throw(silent 0-byte fallback 0)** — 존재하지 않는 경로로 readFileSync 시 throw 를 assert(T-0948 동형). 정적 앵커 추출이 조용히 빈 결과로 성공-위장하지 않음.
- [ ] **error path — gating 완전성 앵커 부재 시 명시적 실패** — 추출 보조 함수가 gating 유도 표현(REQUIRED_ENV 배열·for 순회·blank-guard·이름-진단·return 분기) 중 하나라도 못 찾으면(빈 매칭) 명시적으로 실패(빈 문자열/undefined 를 pass 로 오통과 0). 앵커가 실 shell 에 실재함을 강제.
- [ ] **negative cases 충분 cover (각 1+, 단일 negative 금지)**:
  - (a) **완전성 규칙 OR-약화 drift 변별** — gating 완전성을 "하나라도 set 이면 enabled"(OR)로 mutate 한 모델 사본에서 "partial-set → disabled" assert 가 실패함을 실증(half-armed 실행 회귀 검출). 원본 pure 함수 불변.
  - (b) **blank-guard 제거 drift 변별** — `isBlank` 를 `val === ""`(공백-only 통과)로 약화한 모델 사본에서 "공백-only 값은 부재로 간주" assert 가 실패함을 assert(공백 credential 오판 회귀 검출). 원본 불변.
  - (c) **7-env 이름 누락/변조 drift 변별** — REQUIRED_ENV 에서 env 이름 하나를 뺀(6 원소) 또는 이름을 오타로 바꾼 배열 사본에서 "정확히 7 이름·예상 순서" assert 가 실패함을 assert(불완전 gating 회귀 검출). 원본 소스 문자열 mutate 0 — 사본에만 주입.
  - (d) **§9 missing-진단 값-누출 drift 변별** — 진단 로그를 `${missing[*]}`(이름) 대신 실값(env 값 배열)을 내도록 mutate 한 모델 사본에서 "진단은 이름만(값 미포함)" assert 가 실패함을 assert(credential 누출 회귀 검출). 실 소스 175행이 `${missing[*]}`(이름 배열)임을 정적 확인(`${!name}`·값-echo 표현 미등장).
  - (e) **credential 누출 0** — 추출/합성하는 어떤 문자열(env 이름·missing 목록·앵커 텍스트)에도 gh 토큰 어휘(`ghp_`·`--token`·`GITHUB_TOKEN`·`Bearer`·`Authorization`) 및 실 credential 값 placeholder 미등장(§9 / REQ-059). env 이름(`REALDATA_E2E_*`)은 이름 집합 assert 목적으로 등장하나 그 *값* 은 어디에도 surface 0.
- [ ] **flow — 결정론·no-mutation** — 동일 입력(env map)으로 pure 함수를 두 번 호출하면 byte-identical deep-equal(결정론). 동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal. pure 함수·추출 보조 함수가 입력(env map·shell 소스 사본)을 mutate 0(원본 불변 assert). mutant 사본 생성은 원본 복제 후 치환하며 원본 불변.
- [ ] **dormant/non-gated 확인 — side-effect 0** — 본 spec 은 `describe.skip` 0(항상 실행), process.env 읽기 0(env map 은 pure 함수 파라미터로만 표현), 실 `bash`/`git`/gh 실행 0. 실 redeploy·HTTP·jest spawn 0(파일 read + 정적 텍스트 추출 + 완전성 동형 pure 함수만). `deploy/daily-test.sh` 는 읽기만(실행/source 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 spec 포함, non-gated 항상 실행), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — readFileSync 로 읽기만. gating 완전성 유도 표현(150~158·164~179행)·REQUIRED_ENV 배열·blank-guard·진단 로그 미수정(drift 발견 시 별도 fix task). gating 로직을 함수로 추출하는 refactor 금지(정적 텍스트 앵커 + 완전성 동형 pure 함수로 봉함 — critical nightly 스크립트 동작 변경 0).
- **T-0947 표면 재단언 금지** — downstream SKIP-propagation cascade(auth 미통과·gating 부재 → eval/collect/rediscovery SKIP)·`! realdata_eval_gating_enabled` gate call-site count 는 T-0947 소관. 본 task 는 gating 함수 **내부 완전성 semantics**(7-env 이름·all-present-non-blank·blank-guard·이름만-진단)라는 distinct surface 만. T-0947 spec 파일 변경 0. gate call-site 등장 횟수·cascade 재검증 0.
- **T-0790/T-0887 표면 재단언 금지** — eval/collect 의 jest argv(run 분기 argv, `--config`/`--runTestsByPath` 벡터) parity 는 각 소관. 본 task 는 gating **완전성 판정** distinct surface 만(argv 조립은 다루지 않음). 해당 spec 파일 변경 0.
- **T-0791/T-0944/T-0945/T-0946/T-0948 표면 재단언 금지** — 6-키 schema(T-0791)·집계 값(T-0944)·dual-sink(T-0945)·로그 prune(T-0946)·스칼라 provenance(T-0948)는 각 소관. 본 task 는 gating **완전성 semantics** distinct surface 만. 해당 spec 파일들 변경 0.
- **정본 helper(realdata-e2e-live-gating.ts) 재검증 금지** — T-0610 `realdata-e2e-live-gating.ts` 의 `REALDATA_E2E_REQUIRED_ENV`/`isPresent` TS 구현 자체는 그 helper 의 spec 소관. 본 task 는 `deploy/daily-test.sh` 의 bash mirror 가 그 이름 집합·완전성 규칙과 정합함만 정적 검증(TS helper import/실행 0 — bash 소스 텍스트 앵커만).
- **live gating / 실 실행 도입 금지** — 본 spec 은 non-gated 정적 파일 read + 완전성 pure 함수 only. gating env / process.env / 실 `bash` / 실 `git` / 실 gh / 실 jest spawn 실행 도입 0. T-0942/T-0943 의 live rediscovery smoke·bash step spec 재작성 0.
- **production `src/` 코드 변경 금지** — test-only. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts`·`deploy/*`·`.github/workflows/*` 변경 0(신규 `*.smoke-spec.ts` 는 `pnpm test:smoke` 가 jest-discover 하므로 CI config 변경 불요). 새 외부 dependency 0(node 내장 `fs`/`path` 만).

## Suggested Sub-agents

`implementer → tester` (src 변경 0, `deploy/daily-test.sh` 미변경 이라 architect 불요. T-0948 scalar-provenance smoke 를 패턴 템플릿으로 mirror 해 신규 `*.smoke-spec.ts` 1 개를 작성: readFileSync 로 `deploy/daily-test.sh` 읽어 gating 완전성 유도 표현(150~158·164~179행)을 정적 앵커로 추출 + 완전성 동형 pure 함수(`REQUIRED_ENV`·`isBlank`·`missingEnvNames`·`gatingEnabled`)로 완전성 불변식(7-env 이름·all-present-non-blank·whitespace-blank guard·missing-NAMES-only §9 진단) assert. happy(7-env 이름 추출·함수 앵커 추출·enabled model·isBlank 검증)/branch(partial-set→disabled+missing 이름·all-absent vs all-present)/error(파일 부재·앵커 부재)/negative(OR-약화·blank-guard 제거·이름 누락·§9 값-누출·credential 누출 0)·결정론/no-mutation cover. non-gated(describe.skip 0), 실 bash/git/env 읽기 0, credential 값 미surface. write 무관(ADR-0045 deferred).)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
