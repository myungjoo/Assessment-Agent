---
id: T-1625
title: k6 S3 동시 요청 내성 시나리오 신설 (read + write 혼합 · 동시성 단계 상승)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-048]
estimatedDiff: 260
estimatedFiles: 4
created: 2026-08-20
createdAt: 2026-08-20T12:20:00Z
independentStream: load-harness-k6
dependsOn: [T-1624]
touchesFiles:
  - test/load/s3-concurrent.js
  - .github/workflows/load-k6.yml
  - package.json
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 6/N — 계획 §2 S3(동시 read+write 내성) 을 k6 harness 에 신설. S1 133명 배치·baseline 확정은 후속 slice.
---

# T-1625 — k6 S3 동시 요청 내성 시나리오 신설 (read + write 혼합 · 동시성 단계 상승)

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수)의 chain 6/N 이다. T-1620~T-1624 로 k6 job 골격 · 부하 대상 기동 · S2 조회 시나리오 · seed 배선 · 인증 조회까지 열렸으나, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2` 가 정의한 3 시나리오 중 **S3(동시 요청 내성)** 은 아직 스크립트가 0 이다. 현 S2 는 고정 `vus: 5` 의 read 전용이라 "평가 작성 진행 중 조회" 같은 read + write 혼합도, 동시성 단계 상승에 따른 error rate 급증 · latency cliff 유무도 관찰 대상 밖이다. 본 slice 가 `test/load/s3-concurrent.js` 를 신설해 `§3` 표의 S3 행(error rate < 1% · p95 저하 곡선 관찰)을 처음으로 실발화시킨다.

남은 R-91 backlog 중 S1(133명 실 scale 배치)은 실 LLM · 외부 수집 I/O 의존이 지배적이라(`§2` S1 주의 · `§4`) stub/격리 endpoint 결정이 선행돼야 하고, baseline 확정 · REQ-047 doc-sync 는 실측 run 이 있어야 한다. 그래서 credential 0 · dependency 0 으로 지금 닫을 수 있는 S3 를 먼저 큐잉한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2` S3 정의(동시 read + write 혼합, 동시성 단계 상승) 와 `§3` 임계 표 S3 행. 임계 재산정 금지의 근거.
- [test/load/s2-read.js](../../test/load/s2-read.js) — 본 slice 가 승계할 규약(`__ENV` 기본값 · route tag 분리 · `setup()`/`teardown(data)` · 조건 분기 0 · 주석 한국어).
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — S2 실행 step 바로 뒤 · 정리 step 앞에 S3 step 을 끼울 위치와 `K6_BASE_URL` 주입 형태.
- [package.json](../../package.json) `23~24 행` — `test:load` / `test:load:s2` script 형태(신설 `test:load:s3` 의 parity 대상).
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 기존 3 개 describe 블록(T-1620/T-1622/T-1623) 의 helper(`extractStepBlock` · `scriptPathOf` · `extractTopLevelBlock` 등)와 4 분류 구성. 신규 describe 는 이 helper 를 재사용한다(중복 helper 신설 금지).
- [docs/tasks/T-1622-load-k6-s2-read-scenario.md](T-1622-load-k6-s2-read-scenario.md) — 동형(스크립트 신설 + workflow step + script + smoke) slice 의 선례.

## Acceptance Criteria

- [ ] `test/load/s3-concurrent.js` 신설 — read + write 혼합 iteration 을 동시성 **단계 상승** 프로파일(`stages` ramping)로 인가한다. 총 지속시간은 40s 이내로 묶어 수동 job 비용을 제한한다.
- [ ] write 경로는 iteration 안에서 **자기 정리** 한다 — guard-free `POST /api/persons` 로 만들고 같은 iteration 이 `DELETE /api/persons/:id` 로 지워, 반복 부하가 DB 를 무한 성장시키지 않는다. 식별자 충돌은 `Date.now()`/VU·iteration 접미사로 회피한다(T-1623 규약 승계).
- [ ] read 경로는 guard-free 목록 GET 을 재사용하고, write / read 요청은 **서로 다른 route tag** 를 달아 지표가 섞이지 않는다.
- [ ] 임계는 계획 `§3` 표 값 그대로 선언한다 — 전역 `http_req_failed: ["rate<0.01"]` + `http_req_duration: ["p(95)<3000"]` + write/read route tag 별 `p(95)<3000`. **임계 재산정 0**(3000 / 0.01 이외 숫자 금지). latency cliff 곡선은 임계 없이 k6 기본 summary 로 관찰만 한다는 주석을 남긴다.
- [ ] 스크립트 안에 조건 분기 로직을 두지 않는다(T-1620 이후 규약). 분기가 필요하면 그 사실을 Follow-ups 에 남기고 본 task 에서는 도입하지 않는다.
- [ ] `.github/workflows/load-k6.yml` 에 S3 실행 step 1 개 추가 — S2 실행 step **뒤**, 정리 step **앞**. `K6_BASE_URL` 은 기존 step 들과 동일한 로컬 인스턴스를 겨냥한다. `services` · 기동 step · 정리 step 은 무변경.
- [ ] `package.json` 에 `test:load:s3` script 1 줄 추가. 기존 `test:load` / `test:load:s2` 는 무변경이고 dependency 추가는 0(k6 는 정적 바이너리).
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 T-1625 describe 블록을 추가하고, 아래 4 분류를 모두 채운다(기존 3 블록과 동형):
  - [ ] **happy-path**: S3 스크립트 실재 · ramping stages 선언 · read/write route tag 존재 · 임계 선언 · workflow S3 step 실재 및 순서(S2 뒤 · 정리 앞) · workflow 경로 ↔ `test:load:s3` 경로 parity — 각 1+ test.
  - [ ] **error path**: S3 step 이 없는 합성 YAML → throw 없이 미발견 정규형, non-string 입력 → `TypeError`(0-byte fallback false-PASS 방지) — 각 1+ test.
  - [ ] **flow / 분기 cover**: step 블록이 다음 헤더에서 끊기는 경우 / 파일 끝에서 끊기는 경우, 값 따옴표 유무, `stages` 배열 항목 1 개/다수 — 각 분기 1+ test.
  - [ ] **negative cases 충분 cover** — 최소 6 종 각 1+ test: (1) `load-k6.yml` 에 여전히 `pull_request`/`push`/`schedule` 트리거 없음, (2) `ci.yml` 에 S3 실행 문자열 없음(상시 CI 유출 차단), (3) `package.json` 어디에도 k6 dependency 키 없음, (4) S3 스크립트에 auth-guarded prefix 가 없음(401 이 error rate 임계 오염 차단), (5) 정리 step 의 `if: always()` 불변, (6) 임계 문자열이 3000 / 0.01 이외 값으로 재산정되지 않음 + 합성 mutation 이 drift 로 검출됨.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 기존 46 it 이 모두 green 이고 신규 it 이 함께 pass.
- [ ] diff ≤ 300 LOC · 변경 파일 ≤ 4 개(위 `touchesFiles` 목록 그대로). 초과 예상 시 negative case 를 줄이지 말고 **S3 스크립트 주석/단계 수**를 먼저 줄인다.

## Out of Scope

- `src/` 변경 일체 — 본 slice 는 harness 전용이며 production 코드는 건드리지 않는다.
- `.github/workflows/ci.yml` 변경 — 부하는 상시 PR CI 에서 돌지 않는다(ADR-0054 §Consequences). `ci.yml` 을 열면 drift-guard 동반 파일 수가 cap 을 깬다(T-1122 전례).
- `test/load/smoke.js` · `test/load/s2-read.js` 변경 — 기존 시나리오는 무변경.
- 실제 k6 / HTTP 발화 · 실측 run trigger — 본 task 는 배선만. baseline 실측과 임계 fix 는 후속 slice.
- S1(133명 실 scale 배치 · 1h 게이트) 도입 — 실 LLM/수집 격리 결정이 선행돼야 한다.
- npm dependency 추가 — k6 는 lockfile 밖 정적 바이너리(추가 필요 시 §5 BLOCKED).
- 임계 재산정 · 신규 지표 임계 도입 — 계획 `§3` 표 밖 숫자 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기 append 한다.)
