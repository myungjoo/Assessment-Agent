---
id: T-1633
title: load-k6.yml 에 S1 배치 step 배선 + stub env 주입 + test:load:s1 parity
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 215
estimatedFiles: 3
created: 2026-08-21
createdAt: 2026-08-21T02:20:00Z
independentStream: load-harness-k6
dependsOn: [T-1632]
touchesFiles:
  - .github/workflows/load-k6.yml
  - package.json
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 14/N — ADR-0057 범위밖 3 번째 항목(step 재배치 + stub env + script parity). 3 파일 cap 내.
---

# T-1633 — load-k6.yml 에 S1 배치 step 배선 + stub env 주입 + test:load:s1 parity

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수) chain 14/N 이다.
T-1631(스크립트 골격) · T-1632(D5 provider seed)로 [test/load/s1-batch.js](../../test/load/s1-batch.js)
는 완성됐지만 **어디에도 배선되지 않아 실행 경로가 0** 이다 — 부하 job 을 수동 발화해도 S1 은
한 번도 돌지 않는다.

[ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `## 범위 밖 (deferred)` 세 번째
항목이 본 slice 를 그대로 지정한다 — "`load-k6.yml` step 추가 — D2 가 요구하는 **smoke → S1 →
S2 → S3** 순서 재배치 + stub env 주입. `package.json` 의 `test:load:s1` script 와 drift-guard
smoke 의 parity 대조 포함." 순서는 선택이 아니라 `D2` 의 결론이다 — `s2-read.js` `setup()` 이
signup 을 하므로 S2 가 먼저 돌면 S1 계정이 두 번째 user 가 되어 SuperAdmin 이 아니고, Admin+
route 가 403 을 뱉어 그 403 이 전역 `http_req_failed` 임계를 오염시킨다.

env 주입도 두 갈래가 모두 필수다 — (a) `LOAD_TEST_STUB=1` 이 없으면 `D1` fail-safe default OFF
때문에 실 LLM gateway 가 바인딩돼 부하 job 이 외부 I/O 를 때리고, (b) `LLM_APIKEY_ENC_KEY` 가
없으면 T-1632 가 배선한 `POST /api/llm/providers` seed 가 cipher throw 로 실패해 `D5` 전제가
무너진다.

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `### D1`(env `LOAD_TEST_STUB` 가 **정확히 `"1"`** 일 때만 stub, 그 밖은 전부 실 gateway fall-through = fail-safe default OFF) · `### D2` 끝 문단(step 순서 **smoke → S1 → S2 → S3** 과 403 오염 근거) · `## 범위 밖 (deferred)` 세 번째 항목(본 slice 의 정의).
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 본 slice 의 주 대상. `48~74 행` 부하 대상 컨테이너 기동 step(`docker run -d --name aa-load --network host` 의 `-e` 3 종: `DATABASE_URL` · `AUTH_JWT_SECRET` · `PORT`), `81~84 행` smoke step, `86~94 행` S2 step(env 2 종 형태의 선례), `96~102 행` S3 step, `104~109 행` `if: always()` teardown.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `19~22 행` — `__ENV` 기본값 2 종(`K6_BASE_URL` 기본 `http://localhost:3000`, `K6_S1_PERSONS` 기본 10). workflow 주입값이 이 기본값과 동형이어야 drift-guard 가 대조 가능. 머리 주석 마지막 줄의 "범위 밖(후속 slice)" 문단은 본 slice 완료분(step · script)을 빼도록 갱신하지 **않는다**(본 slice 의 touchesFiles 밖 — Out of Scope 참조).
- [package.json](../../package.json) `23~25 행` — `test:load` / `test:load:s2` / `test:load:s3` 3 script 의 정확한 형태(`k6 run test/load/<file>.js`). 본 slice 는 같은 형태의 `test:load:s1` 1 줄만 추가한다.
- [src/common/load-test-stub-gating.ts](../../src/common/load-test-stub-gating.ts) `21 행`(`LOAD_TEST_STUB_ENV = "LOAD_TEST_STUB"`) · `28 행` 이하 판정 규칙(`"1"` 정확 일치만 true — `"true"` · `"0"` · 공백 전부 false).
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) `36 행`(`KEY_LENGTH_BYTES = 32`) · `43~65 행` `resolveKey`(env 값을 base64 우선 → 32 byte 아니면 hex 재시도, 둘 다 아니면 throw). 주입할 더미 값은 **정확히 32 byte 로 디코딩** 돼야 한다.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — `14~27 행` 공용 상수(`REPO_ROOT` · `LOAD_YML_PATH` · `PKG_JSON_PATH` · `EXPECTED_BASE_URL` · `BOOT_STEP_NAME`), `110~127 행` 공용 helper(`lineIndexOf` · `stepIndexOf` · `loadYml` · `pkg`), `194~198 행` 기존 `docker run` flag 단언(본 slice 가 `-e` 를 늘려도 깨지지 않아야 함), `1041~1160 행` T-1625 S3 배선 describe(**본 slice 가 그대로 승계할 workflow-step parity 패턴** — 실재 · step 추출 · 경로 parity · 순서 단언 · error path · negative), `1225~1256 행` T-1631/T-1632 의 S1 상수(`S1_SCRIPT_REL` · `S1_BATCH_ROUTE` · `S1_ROUTES` 등)와 `1253~1288 행` helper(`s1Script` · `s1Body` · `apiRoutesOf` · `routeP95Expression`).

## Acceptance Criteria

- [ ] `.github/workflows/load-k6.yml` 에 S1 실행 step 1 개 추가 — step 이름은 S2/S3 선례와 동형(예 `k6 S1 평가 배치 부하 시나리오 실행`), `run: k6 run test/load/s1-batch.js`, `env` 에 `K6_BASE_URL: http://localhost:3000` + `K6_S1_PERSONS: "10"`(스크립트 `__ENV` 기본값과 동일 값). step 위치는 smoke step **뒤**, S2 step **앞**(ADR-0057 `D2` 의 smoke → S1 → S2 → S3).
- [ ] 부하 대상 컨테이너 기동 step 의 `docker run` 에 `-e LOAD_TEST_STUB=1` 추가 — 값은 정확히 `1`(`D1` 판정 규칙). 같은 컨테이너를 S2/S3 도 쓰므로 stub 활성이 그 두 시나리오에 무해하다는 근거를 주석 1~2 줄로 남긴다(두 시나리오는 LLM gateway 를 타지 않음).
- [ ] 같은 `docker run` 에 `-e LLM_APIKEY_ENC_KEY=<더미>` 추가 — base64 또는 hex 로 **정확히 32 byte** 디코딩되는 리터럴 더미(예 base64 `YXNzZXNzbWVudC1hZ2VudC1jaS1sb2FkLTMyYnl0ZSE=`). 실 키·`${{ secrets.* }}` 참조 0.
- [ ] `package.json` 에 `"test:load:s1": "k6 run test/load/s1-batch.js"` 1 줄 추가 — 기존 3 script 와 동형이고 다른 script 변경 0, dependency 변경 0.
- [ ] **happy-path**: drift-guard smoke 에 신규 describe 추가(T-1625 패턴 승계) — (a) S1 step 이 실재하고 `run` 이 `test/load/s1-batch.js` 를 정확히 가리킨다, (b) step 의 `K6_BASE_URL` 이 `EXPECTED_BASE_URL` 과 일치하고 `K6_S1_PERSONS` 값이 스크립트 `__ENV` 기본값과 같다, (c) `package.json` 의 `test:load:s1` 이 같은 스크립트 경로를 가리킨다(3 자 parity), (d) `stepIndexOf` 로 smoke < S1 < S2 < S3 순서를 단언, (e) 기동 step 에 `-e LOAD_TEST_STUB=1` 과 `-e LLM_APIKEY_ENC_KEY=` 가 존재한다 — 각 `it` 1+.
- [ ] **error path**: 재사용 helper 계약이 신규 상수에서도 성립함을 `it` 1+ 로 고정 — S1 step 행을 제거한 합성 YAML 에서 `extractStep` 이 미발견 정규형을, `stepIndexOf` 가 `-1` 을 돌려주고, `extractStepBlock` 이 non-string 입력에 `TypeError` 를 던진다(기존 T-1625 `Error path` 블록 패턴 승계).
- [ ] **분기 cover**: (a) env 값의 따옴표 유무 두 형태를 합성 문자열로 각각 통과시킨다, (b) step 블록이 다음 step 헤더로 끝나는 경우 / 파일 끝으로 끝나는 경우 두 갈래, (c) `docker run` 의 `-e` flag 가 존재/부재인 두 갈래 — 각 `it` 1+. 신규 helper 를 추가하지 않고 기존 helper 만 재사용했다면 그 사실을 spec 주석에 명시한다.
- [ ] **negative 충분 cover**: (a) `LOAD_TEST_STUB` 값이 `1` 외 문자열(`true` · `0` · 빈 값)이 아님을 단언(`D1` fail-safe 오활성 차단), (b) `load-k6.yml` 전체에 `${{ secrets.` 참조 0 · 실 endpoint/실 API key 리터럴 0, (c) `on:` 트리거가 여전히 `workflow_dispatch` 단독(상시 PR CI 오염 0 — step 추가가 트리거를 늘리지 않음), (d) `package.json` 의 `dependencies`/`devDependencies` 에 k6 편입 0(ADR-0054 규약), (e) S1 step 이 `if:` 조건이나 `continue-on-error` 를 달지 않음(임계 위반이 조용히 green 이 되는 우회 차단), (f) S1 step 의 `run` 이 `k6 run` 단일 커맨드이고 다른 스크립트 경로를 함께 부르지 않음 — 각 `it` 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:smoke` green(신규 describe 포함, 기존 S1/S2/S3 describe 회귀 0).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(`src/` 변경 0 이므로 회귀 없음 확인).
- [ ] 신규 dependency 0 · DB schema 변경 0 · 인증/권한 모델 변경 0 · `src/` 변경 0 · `test/load/*.js` 변경 0 · 변경 파일 3 개 이내.

## Out of Scope

- `test/load/s1-batch.js` 본문 수정(머리 주석의 "범위 밖" 문단 갱신 포함) — 파일 수 cap(T-1122 전례)과 "배선만 하는 slice" 경계 유지. 주석 정합은 후속 doc-sync 로 흡수.
- 133명 full seed 투입 · baseline 실측 · [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` "baseline 후 fix" 임계 갱신 · 표본 2 종(10 vs 40) 선형성 점검.
- `Number(__ENV.K6_S1_PERSONS || 10)` 의 `NaN` 처리(T-1631 Follow-up) — 3 스크립트를 한 번에 다루는 별도 task.
- GitHub/Confluence 수집 adapter 의 stub 배선(ADR-0057 `D1` 이 같은 방식을 예고했으나 `src/` 변경이라 별도 slice).
- 실 workflow 발화(`workflow_dispatch` 수동 실행) · 실 k6 실행 · 실 docker 실행 — 본 slice 는 정적 배선 parity 까지.
- `ci.yml` 변경 일체 · PLAN/REQ 상태 전이 doc-sync(REQ-047 미검증 → 검증 전이는 baseline 실측 후).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
