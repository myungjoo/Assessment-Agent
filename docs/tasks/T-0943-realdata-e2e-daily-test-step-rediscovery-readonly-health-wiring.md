---
id: T-0943
title: realdata-e2e nightly runner(`deploy/daily-test.sh`)에 **read-only 재발견 검색 health step** `step_rediscovery` 배선 — T-0942(rediscovery-search-live smoke)를 step_eval(T-0612)/step_collect(T-0888) 패턴으로 dormant env-gated 단일-spec bound jest argv 로 nightly 에 편입. 공유 `realdata_eval_gating_enabled`(REALDATA_E2E_* 7 종) 재사용(새 gating 함수 0), auth PASS 체인 + gating 7 종 set 일 때만 실 `gh search issues`(read-only, mutation 0) round-trip smoke 실행 → PASS/FAIL, 그 외 SKIP(cloud CI/일반 LAN no-op, 기존 6 step 불변). ORDER=(redeploy health liveness auth eval collect rediscovery) 7 원소로 확장 + 머신 JSON parity-drift smoke(T-0791) EXPECTED_ORDER 동기 + CI run step 추가 + bash executable spec 신설. **write step_report(create/edit publish)는 본 task 밖 — ADR-0045 credential gate deferred 유지**. read-scope PAT 만으로 도는 read-only health 라 write credential 불요(오너 승인 Q-0051)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-07-13
dependsOn: []
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-rediscovery.test.sh
  - test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts
  - .github/workflows/ci.yml
independentStream: realdata-e2e-daily-test-step-rediscovery-readonly-health-wiring
plannerNote: P5 §109 step④ — T-0942 read-only 재발견 smoke 를 step_eval(T-0612)/step_collect(T-0888) 패턴으로 nightly 배선. read PAT gating 재사용(write step_report 는 ADR-0045 deferred 유지). dep[] file-disjoint stage5b 병렬.
---

# T-0943 — realdata-e2e nightly runner 에 read-only 재발견 검색 health step `step_rediscovery` 배선 (dormant env-gated)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ 는 dual-leg run report leg 들을 `deploy/daily-test.sh` nightly runner 에 배선해 **자율 nightly 실 평가 e2e** 를 완성하는 것이 목표다. 지금까지 eval leg(`step_eval`, T-0612)·collect leg(`step_collect`, T-0888)이 각각 dormant env-gated 단일-spec bound jest argv 로 nightly 에 편입됐고, 각 배선은 bash executable spec(`daily-test-step-eval.test.sh`·`daily-test-step-collect.test.sh`)으로 검증된다.

T-0941(publish-live, write-side create/edit round-trip)과 T-0942(rediscovery-search-live, read-side 재발견 검색 read-only round-trip)가 dual-leg run report rolling-issue 의 **write / read live round-trip smoke** 를 각각 봉했다. 그러나 그 두 smoke 중 어느 것도 아직 `deploy/daily-test.sh` nightly runner 에 **배선되지 않았다** — nightly 는 eval·collect 까지만 실행하고 report 관련 live round-trip 은 수동 실행에만 의존한다.

본 task 는 그중 **credential 게이트에 걸리지 않는 read-only 절반** 을 nightly 에 배선한다: T-0942 의 `realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts`(실 `gh search issues` read-only, **mutation 0**)를 실행하는 `step_rediscovery` 를 step_eval/step_collect 와 동형으로 추가한다. 이 step 은 **오직 read-scope 로만 도는 재발견 health check** 라 — 실 github 에서 "재발견 검색이 정상 동작하는가"(argv 수용성·`--json` round-trip·fresh-marker create 결정)를 write publish credential 없이 nightly 로 상시 검증한다(T-0942 Follow-up 2 "read-only 재발견 nightly health check" 구체화).

**비-blocked 근거**: `step_rediscovery` 는 새 gating 함수·새 credential 클래스를 도입하지 않고 **기존 공유 `realdata_eval_gating_enabled`(REALDATA_E2E_* 7 종, `REALDATA_E2E_GITHUB_READ_PAT` 포함)를 그대로 재사용**한다 — step_eval/step_collect 와 동일 gating. gating env 부재(=cloud CI / 일반 LAN 기본) 시 `mark rediscovery SKIP`(jest spawn 0 / 실 네트워크 0 / mutation 0 / secret 0) 로 기존 6 step 동작 불변(R-113 green). read-scope PAT 주입은 오너 승인(Q-0051, PLAN 109행)으로 이미 충족 — read-only 라 write-scope 신규 credential 도입 0 이므로 §5 재-BLOCKED 불요.

**write step_report 은 본 task 밖(scope 경계)**: dual-leg run report 의 **write publish**(실 `gh issue create|edit`)를 nightly 에 배선하는 step_report(T-0941 publish-live 를 호출)는 write credential 주입 + production nightly write activation 이 필요해 **ADR-0045 credential gate 로 deferred 유지**한다. 본 task 는 오직 read-only 재발견 health step 만 배선하며, write step_report 배선은 credential gate 상태가 해소되면 별도 task 로 남긴다.

issue-still-relevant 확인(2026-07-13): `grep "step_rediscovery" deploy/daily-test.sh` = 0개 — 재발견 health step 미배선 확정. `deploy/daily-test.sh` ORDER 는 현재 `(redeploy health liveness auth eval collect)` 6 원소(rediscovery 부재). T-0942 의 rediscovery smoke 는 main 에 이미 머지됨(PR #836) — 본 task 는 그 spec 을 **다시 만들지 않고** nightly runner 가 실행하도록 배선하는 것.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ "결과를 daily-test result/rolling 이슈에 박제")
- `deploy/daily-test.sh` — **1순위 배선 대상**. `step_eval`(184~197행)·`step_collect`(209~222행) 함수 정의(단일-spec bound jest argv 규약·`log` 사용·실 credential argv 미포함 §9)·source-guard(244행, 함수가 guard 앞에 정의돼야 bash spec 이 함수 단위 검증)·`ORDER=(...)`(230행)·`mark`(232행)·eval/collect elif 체인(279~309행: auth PASS 체인 + `realdata_eval_gating_enabled` gating → run/SKIP 분기)을 **정확히 mirror**. `step_rediscovery` 는 collect 와 동형이되 spec 경로만 rediscovery smoke 로 교체.
- `deploy/daily-test-step-collect.test.sh` — **2순위 bash spec 템플릿**. source-guard 를 통한 함수 단위 검증(HTTP/redeploy 부작용 0)·gating 판정(`assert_gating`)·argv mirror(collect spec 지향 + eval/collect 교차오염 0 `awk` 함수본문 추출)·SKIP 분기·mktemp WORKDIR 격리·pass/failtest 누적 규약을 mirror. `daily-test-step-rediscovery.test.sh` 는 이를 rediscovery step 대상으로 복제(collect→rediscovery, 교차오염 검사는 rediscovery step 이 eval·collect spec 을 가리키지 않고 rediscovery spec 을 가리킴).
- `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` — **EXPECTED_ORDER(64~71행) 동기 대상**. 현재 6 원소(redeploy…collect). rediscovery 를 7번째로 append 해야 `ORDER`↔`steps`↔`EXPECTED_ORDER` parity 가 유지된다(미동기 시 이 smoke fail). 스키마 6-키·printf 템플릿·failedStep 분기 로직은 그대로 — EXPECTED_ORDER 배열에 `"rediscovery"` 1 원소 추가 + 관련 헤더 주석 한 줄 동기만.
- `.github/workflows/ci.yml` — **CI run step 추가 대상**. `daily-test-step-eval.test.sh`(136행)·`daily-test-step-collect.test.sh`(144행) run step 과 동형으로 `bash deploy/daily-test-step-rediscovery.test.sh` step 추가(self-contained, 네트워크 0 / jest spawn 0 로 도는 bash spec). `bash -n deploy/daily-test.sh`(298행) syntax check 는 기존대로 신규 함수도 커버.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts` (T-0942, 머지됨) — **step_rediscovery 가 실행할 대상 spec**. 경로만 확인(내용 재단언 금지 — 이미 T-0942 가 봉함). step_rediscovery jest argv 가 이 경로를 단일-spec bound 로 가리켜야 함.

## Acceptance Criteria

`deploy/daily-test.sh` 에 `step_rediscovery` 함수 + ORDER 7원소 확장 + elif 체인 배선, bash executable spec 1개 신설, 머신 JSON parity-drift smoke EXPECTED_ORDER 동기, CI run step 추가. 총 4 파일(±1). gating env(REALDATA_E2E_* 7 종) 부재 시 `mark rediscovery SKIP`(jest spawn 0 / 실 네트워크 0 / mutation 0 / secret 0) → cloud CI / 일반 LAN 에서 기존 6 step 동작 불변(R-113 green). 실 credential 값(gh 토큰/read PAT)은 argv·로그·JSON 어디에도 echo 0 — 자식 jest 프로세스가 상속한 process env 로만 전달(§9). step_rediscovery 는 collect/eval 과 동형이되 **read-only 재발견 smoke** 를 지향(write step_report 배선 금지).

- [ ] **step_rediscovery 함수 배선 (happy-path 배선)** — `deploy/daily-test.sh` 의 source-guard(244행) *앞* 에 `step_rediscovery()` 정의: 단일-spec bound jest argv(`--config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts`) 로 1 회 spawn → exit 0 이면 `log` + `return 0`, non-zero 면 `log` + `return 1`. `step_collect` 함수(209~222행) byte-형태 mirror, spec 경로만 rediscovery 로 교체. 함수 헤더 한국어 주석(목적·gating 공유·read-only 재발견 health·실 credential argv 미포함 §9).
- [ ] **ORDER 7원소 확장 + elif 체인** — `ORDER=(redeploy health liveness auth eval collect rediscovery)` 로 rediscovery 를 7번째 append. collect elif 블록(297~309행) 직후에 rediscovery elif 블록 추가: `auth != PASS` → `mark rediscovery SKIP`(선행 체인 미통과 로그) / `! realdata_eval_gating_enabled` → `mark rediscovery SKIP`(gating 부재 no-op 로그, 부재 env 이름만 출력·실값 echo 0) / `step_rediscovery` → `mark rediscovery PASS` else `mark rediscovery FAIL`. 새 gating 함수 추가 0(공유 `realdata_eval_gating_enabled` 재사용).
- [ ] **머신 JSON parity 동기 (branch — ORDER↔steps↔EXPECTED_ORDER)** — `realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` 의 `EXPECTED_ORDER`(64~71행)에 `"rediscovery"` 7번째 원소 추가 + T-0888 주석 옆 한 줄 동기(rediscovery step 이 7번째 append 됨). 이 동기가 없으면 해당 smoke 가 fail(steps↔ORDER drift) 함을 확인(즉 동기 후 `pnpm test:smoke` 해당 spec green).
- [ ] **bash executable spec 신설 (핵심 검증 surface — happy/error/branch/negative)** — 신규 `deploy/daily-test-step-rediscovery.test.sh` 는 `daily-test-step-collect.test.sh` 를 mirror 해 source-guard 로 함수 단위 검증(실 redeploy/HTTP/jest spawn 부작용 0). 아래를 각 1+ bash assertion 으로:
  - **happy** — gating 7 종 set 시 `realdata_eval_gating_enabled` 가 enabled(exit 0) 이고 step_rediscovery 함수 본문(awk 추출) argv 가 rediscovery smoke 경로를 단일-spec bound 로 지향.
  - **error** — step_rediscovery 가 실행할 jest 가 non-zero exit 이면 함수가 `return 1`(FAIL 신호) 됨을 stub/argv 검사 수준에서 확인(실 spawn 없이 함수 계약).
  - **branch** — gating env 일부(7 종 중 1 종) 결여 시 `realdata_eval_gating_enabled` 가 disabled(exit 1) → caller 가 `mark rediscovery SKIP` 분기함을 판정 수준에서 확인.
  - **negative cover (각 1+, 단일 negative 금지)** — (a) **교차오염 0**: step_rediscovery 함수 본문이 eval spec(`realdata-e2e-live.smoke-spec.ts`)·collect spec(`realdata-e2e-github-collection-live.smoke-spec.ts`) 경로를 가리키지 않고 rediscovery spec 만 지향(awk 함수본문 추출 grep). (b) **credential no-echo**: step_rediscovery 함수 본문·elif 블록에 `ghp_`/`--token`/`GITHUB_TOKEN`/실 PAT 어휘 미등장(§9 / REQ-059). (c) **write 명령 0**: 함수/elif 어디에도 `gh issue create`/`gh issue edit` 문자열 미등장(read-only 보장 — write step_report 는 본 task 밖). (d) **ORDER parity**: `ORDER=(...)` 배열이 rediscovery 를 정확히 7번째로 포함(정규식 추출).
- [ ] **CI run step 추가** — `.github/workflows/ci.yml` 에 `run: bash deploy/daily-test-step-rediscovery.test.sh` step 추가(step_collect run step 144행 동형, 주석 T-0943). self-contained(네트워크 0 / jest spawn 0)라 public CI 에서 항상 실행돼 green.
- [ ] **dormant 확인 — CI/일반 환경 side-effect 0** — gating env 없이(=CI 기본) `bash deploy/daily-test.sh`(또는 source guard 하 단위) 실행 시 `mark rediscovery SKIP`(jest spawn 0·실 gh 0·mutation 0·exit 0), 기존 6 step 결과 불변. `bash -n deploy/daily-test.sh` syntax green.
- [ ] **write step_report 미배선 확인 (scope 경계)** — 본 task 는 read-only `step_rediscovery` 만 추가. `step_report`/publish-live(T-0941) write 배선·write credential 주입·실 `gh issue create|edit` nightly 활성 도입 0(ADR-0045 credential gate deferred 유지).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke` green(신규 parity 동기 포함, gating 부재 skip), 전체 unit suite 무회귀(`pnpm test`). production `src/` LOC 0 변경(bash+config+test-only)이라 jest `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 로 기존 임계 유지 확인. `bash deploy/daily-test-step-rediscovery.test.sh` exit 0.

## Out of Scope

- **write step_report 배선 금지** — dual-leg run report 의 write publish(실 `gh issue create|edit`, T-0941 publish-live 호출)를 nightly 에 배선하는 step_report 는 write credential 주입 + production write activation 필요 → ADR-0045 credential gate **deferred 유지**. 본 task 는 read-only `step_rediscovery` 만. write 명령 문자열 도입 0.
- **새 gating 함수 / 새 credential 클래스 설계 금지** — 기존 공유 `realdata_eval_gating_enabled`(REALDATA_E2E_* 7 종) 그대로 재사용. read-scope PAT 는 이미 gating 7 종에 포함(`REALDATA_E2E_GITHUB_READ_PAT`) — 신규 env/credential 0.
- **T-0942 rediscovery smoke 내용 재단언/재작성 금지** — 이미 머지됨(PR #836). 본 task 는 그 spec 을 nightly 가 실행하도록 **배선만** — spec 파일 자체 변경 0.
- **머신 JSON 스키마 6-키·printf 템플릿·failedStep 분기 변경 금지** — parity-drift smoke 는 `EXPECTED_ORDER` 에 rediscovery 1 원소 append + 주석 동기만. 스키마 구조/템플릿/직렬화 로직 재설계 0.
- **production `src/` 코드 변경 금지** — 본 task 는 bash(`deploy/daily-test.sh`) + bash spec + CI config + 기존 smoke 의 EXPECTED_ORDER 동기만. `src/`·`package.json`·lockfile·`prisma/schema.prisma`·helper `*.ts` 변경 0. 새 외부 dependency 0.
- eval/collect step 로직(`step_eval`/`step_collect`/그 elif 블록) 재작성 금지 — rediscovery step 추가만(기존 step 동작 불변).

## Suggested Sub-agents

`implementer → tester` (src 변경 0 이라 architect 불요. `deploy/daily-test.sh` 에 `step_collect`(T-0888) 를 정확히 mirror 한 `step_rediscovery` 함수를 source-guard 앞에 추가 + ORDER 7원소 확장 + collect elif 직후 rediscovery elif 블록 배선, `daily-test-step-rediscovery.test.sh` bash executable spec 을 `daily-test-step-collect.test.sh` mirror 로 신설(source-guard 함수 단위 검증·gating 판정·argv/교차오염/credential-no-echo/write-0/ORDER-parity negative), 머신 JSON parity-drift smoke EXPECTED_ORDER 에 rediscovery append, CI run step 추가. 실 credential 값 argv/로그/JSON echo 0(§9), read-only 보장(write 명령 문자열 0), gating 부재 시 SKIP no-op. write step_report 배선은 ADR-0045 deferred 로 본 task 밖.)

## Follow-ups

- **write step_report nightly 배선 (ADR-0045 credential gate deferred)** — read-only `step_rediscovery` 가 shipped 되면, dual-leg run report 의 write publish(T-0941 publish-live)를 nightly 에 배선하는 `step_report`(실 `gh issue create|edit` + write credential 주입 + production write activation) 를 다음 turn planner 가 credential gate 상태 재확인 후 판단. read step(본 task)과 독립.
- **경량 read-only gating subset** — 본 task 는 step_rediscovery 를 공유 7-env gating(Ollama env 포함)에 종속시켰다. read-only 재발견 health 는 실제로 github read PAT 만 필요하므로, Ollama env 없이 read PAT 만으로 돌 수 있는 경량 gating subset 을 설계해 read-only nightly health 를 더 넓은 환경에서 상시 실행할 여지가 있다(필요 판명 시 별도 task — 새 gating 함수 설계 수반이라 본 task 밖).
