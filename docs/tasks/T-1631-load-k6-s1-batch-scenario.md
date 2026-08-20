---
id: T-1631
title: k6 S1 평가 배치 부하 시나리오 골격 신설 (D2 진입점 · D3 tag · D4 외삽 임계)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-08-20
createdAt: 2026-08-20T23:58:00Z
independentStream: load-harness-k6
dependsOn: [T-1630]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 12/N — ADR-0057 D2~D4 를 s1-batch.js 골격으로 집행. D5 provider seed·workflow 배선은 후속 slice.
---

# T-1631 — k6 S1 평가 배치 부하 시나리오 골격 신설

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수)의 chain 12/N 이다.
T-1626~T-1630 이 결정(ADR-0057 `D1`~`D5`)과 stub 배선 3 조각을 모두 닫았으므로, 이제
[ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `## 범위 밖` 두 번째 항목인
**`test/load/s1-batch.js` 신설** 이 남은 최선행 slice 다 — S1 은 REQ-047(평가 배치 ≤ 1h) 본체이며
3 시나리오 중 유일하게 스크립트가 없는 축이다.

본 slice 는 그 스크립트의 **골격만** 집행한다 — `D2`(타격 route) · `D3`(route tag 3 종) ·
`D4`(축소 표본 + 선형 외삽 임계). ADR 이 별도 항목으로 떼어 둔 `D5` provider 단일-row seed 와
`load-k6.yml` step 순서 재배치 · `package.json` script · parity 대조는 파일 cap(T-1122 전례)과
T-1622 → T-1623 선례(스크립트 먼저, seed 배선 다음)를 따라 후속 slice 로 남긴다. 본 slice 시점의
스크립트는 workflow · `package.json` 어디에도 배선되지 않아 **실행 경로 변화 0** 이다.

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) — `D2`(진입점·step 순서·첫-user SuperAdmin) · `D3`(tag 3 종 `batch`/`seed`/`auth`) · `D4`(외삽 산식) · `D5`(본 slice 범위 밖임을 확인)
- [test/load/s2-read.js](../../test/load/s2-read.js) — `setup()` 의 seed 반복문 · signup → login → cookie 규약 · `teardown(data)` 자기 정리 규약(승계 대상)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — 파일 머리 주석 규약 · `options.thresholds` 표기 · 조건 분기 0 규약
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `999~1222 행` — S3 describe 블록(본 slice 가 mirror 할 describe 구조 · `extractTopLevelBlock` 등 기존 helper 재사용점)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `599~610 행` — `@Post("unevaluated-fill-run")` RBAC Admin+ · `@HttpCode(200)` · body DTO 타입
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) + [src/assessment-evaluation/dto/period-bridge.dto.ts](../../src/assessment-evaluation/dto/period-bridge.dto.ts) — 요청 payload 필수 필드(`rawBridges[].personId`/`period`/`scope`/`periodStart` ISO8601)
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `6 행` — 외삽 기준 인원 133명

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` 신설 — `__ENV.K6_BASE_URL` 기본값이 `smoke.js`·`s2-read.js`·`s3-concurrent.js` 와 동일하고, 표본 인원은 `__ENV.K6_S1_PERSONS` 기본 `10`(ADR-0057 `D4`).
- [ ] 타격 route 는 ADR-0057 `D2` 가 확정한 `POST /api/assessment-evaluation/unevaluated-fill-run` **하나** — 신규 route 노출 0, 기존 route 수정 0.
- [ ] route tag 3 종 분리(ADR-0057 `D3`) — `batch`(대상 route) · `seed`(준비 write/정리) · `auth`(signup·login). 임계는 `batch` 에만 건다.
- [ ] 외삽 임계는 **상수 하드코딩이 아니라 산식** 으로 표기 — `3_600_000ms × (K6_S1_PERSONS / 133)` 을 스크립트가 계산해 `"http_req_duration{route:batch}"` 의 `p(95)` 상한으로 선언하고, 전역 `http_req_failed` 는 `rate<0.01`(계획 `§3` 표 그대로, 재산정 0).
- [ ] `setup()` 이 (a) 표본 인원만큼 `POST /api/persons` seed(`route:seed`) → id 수집, (b) `POST /api/users` signup(그 run 의 첫 user = SuperAdmin) → `POST /api/auth/login` → `access_token` cookie 확보(`route:auth`) 를 수행하고 JSON 직렬화 가능한 값만 반환한다. `teardown(data)` 가 seed person 을 전량 `DELETE`(`route:seed`) 로 회수한다.
- [ ] `default(data)` 는 setup 이 만든 personId 로 `rawBridges` 좌표 배열을 구성해 대상 route 를 1 회 호출하며, `Cookie` 헤더로 인증을 싣는다. 조건 분기 로직 0(카운트 기반 반복문만).
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 S1 describe 블록 추가 — 기존 S2/S3 describe 의 helper·구조를 재사용하고 기존 describe 4 종은 수정 0.
- [ ] **happy-path**: 스크립트 실재 + 대상 route 문자열 + tag 3 종 + `setup`/`default`/`teardown` export 존재 + 임계 key 목록 일치를 각각 `it` 로 고정.
- [ ] **error path**: 부재 경로를 읽었을 때 helper 가 던지는지(기존 `s2-read.absent.js` 패턴 승계) + non-string 입력에 `TypeError` 를 던지는지 1+ `it`.
- [ ] **분기 cover**: 임계 산식 파서/추출 helper 의 "대상 블록 있음 / 없음" 두 분기를 각각 1+ `it` 로 cover(분기 없는 helper 는 그 사실을 주석으로 명시).
- [ ] **negative 충분 cover**: (a) 스크립트에 auth-guarded 아닌 임의 route 추가 없음, (b) `batch` 외 tag 에 p95 임계가 걸리지 않음, (c) 임계가 리터럴 상수로 굳어있지 않음(산식 문자열 존재), (d) 고정 리터럴 자격증명/실 secret 문자열 0, (e) 조건 분기(`if`/삼항) 0 — 각 1+ `it`.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:smoke` green(신규 describe 포함).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(`src/` 변경 0 이므로 회귀 없음을 확인).
- [ ] 신규 dependency 0 · DB schema 변경 0 · 인증/권한 모델 변경 0 · `src/` 변경 0.

## Out of Scope

- ADR-0057 `D5` 의 **LlmProviderConfig 단일-row 멱등 seed**(`GET`/`DELETE`/`POST /api/llm/providers` 왕복) — 다음 slice. 본 slice 스크립트는 아직 provider row 를 만들지 않는다.
- `.github/workflows/load-k6.yml` 의 step 추가·**smoke → S1 → S2 → S3** 순서 재배치·`LOAD_TEST_STUB`/`LLM_APIKEY_ENC_KEY` env 주입 — 다음 slice(파일 cap, T-1122 전례).
- `package.json` 의 `test:load:s1` script 추가와 그 parity 대조 — workflow 배선 slice 와 함께.
- 133명 full seed 투입 · baseline 실측 · 계획 `§3` "baseline 후 fix" 임계 갱신.
- 서버 측 단계별(수집 / LLM / 저장) 소요 분해 지표 · 실 외부 I/O latency 실측.
- `src/` 코드 변경 일체(stub 배선 3 조각은 T-1627~T-1629 로 이미 완결).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
