---
id: T-1689
title: S3 스크립트에 단계 식별 tag key 1 개를 배선 (설계 조항 ③ · 문제 (b) 앞단)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-048]
independentStream: load-resilience-plan
dependsOn: [T-1687, T-1688]
touchesFiles:
  - test/load/s3-concurrent.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
estimatedDiff: 175
estimatedFiles: 2
created: 2026-08-25T06:20:00Z
plannerNote: P5 성능 검증(PLAN 141 행) — T-1688 Follow-up ② 의 앞단, 설계 조항 ③ 단계 tag 축만 배선하고 출력 회수는 후속 slice
---

# T-1689 — S3 스크립트에 단계 식별 tag key 1 개를 배선

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 의 **`#### 단계별 percentile export 설계 (사전 박제, T-1687)`** 소절이 굳힌 두 공백 중 **(a) `p99` 미확보** 는 T-1688(PR #1337, `d6301e30`)이 조항 ① 후보 A 로 닫았고, 남은 **(b) S3 저하 곡선의 단계 분해 불가** 는 조항 ③ 의 **단계 tag 축 부여** + 조항 ④ 의 **출력 회수** 두 조각으로만 닫힌다. 본 task 는 그 중 **앞 조각 — 단계 식별 전용 tag key 1 개 배선** 만 집행한다(뒤 조각인 단계별 값 출력 1 줄은 별도 `pr` slice, 아래 Follow-ups ①). PLAN `141 행` 의 P5 부하·복원력 검증 bullet 을 잇고, T-1688 과 동형으로 스크립트와 drift-guard 단언을 **같은 commit 에서 동기**한다(둘이 갈리면 guard red — T-1676 선례).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 의 `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절 (조항 ①~⑤ — 특히 **③ 단계 분해 원칙** 과 **② 판정 임계 불변**)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 전문 (96 행 — 머리 주석 규약 ①~⑤ · `SEED_PARAMS`/`TEARDOWN_PARAMS` · `setup()`/`default`/`teardown()`)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 의 `1081 행` 부근 S3 상수 블록(`S3_THRESHOLD_KEYS` · `S3_MAX_SEC` · `s3Script()` · `s3Body()` · `stageTargets()`) 과 **파일 끝의 T-1688 describe** (append 위치 · negative 5 종 작성 패턴)
- [docs/tasks/T-1688-load-k6-p99-summary-trend-stats.md](T-1688-load-k6-p99-summary-trend-stats.md) 의 Acceptance Criteria (동형 slice 의 검증 눈금)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` (R-110 ~ R-114) · `§12` (언어 정책)

## Acceptance Criteria

- [ ] [`test/load/s3-concurrent.js`](../../test/load/s3-concurrent.js) 에 **단계 식별 전용 tag key 1 개**(`stage`)를 배선한다. 값은 `options.stages` 3 단과 **1:1 대응**하는 `"1"` · `"2"` · `"3"` 이며, `route` 값 집합(`read` · `write` · `seed` · `teardown`)에는 **단계 값을 섞지 않는다**(설계 조항 ③).
- [ ] 단계 값 산출은 **조건 분기 0 의 산술 1 식** — `setup()` 이 반환하는 기준 시각과의 경과시간을 `options.stages` 경계(10s / 10s / 5s)로 나눈 index 를 `Math.min` 으로 clamp 한다. `if` · 삼항 연산자 · `switch` 를 쓰지 않아 머리 주석 규약 ⑤ **"조건 분기 로직 0"** 을 유지한다.
- [ ] 판정면 **문자 단위 0 변경** 을 유지한다(설계 조항 ②) — `thresholds` 4 종 키·임계 숫자(`3000` · `0.01`), `stages` 의 `duration`/`target`, `route` tag 값, `summaryTrendStats` 6+1 종은 그대로다. 새 tag 용 임계는 **추가하지 않는다**.
- [ ] 기존 `[s3-concurrent] persons 행 수 …` 로그 2 줄(T-1682)과 `setup()` 반환값의 `startRows` 소비 경로(`teardown(data)`)는 회귀 0 이다.
- [ ] **happy-path test** — drift-guard smoke 에 describe 1 개를 append 해, ① `stage` tag key 가 실 스크립트에 존재하고 ② 값이 `1`·`2`·`3` 3 종이며 ③ `route` tag 값 집합이 기존 4 종 그대로이고 ④ `S3_THRESHOLD_KEYS` 4 종이 순서까지 불변임을 각각 단언한다(각 1+ it).
- [ ] **error path test** — 스크립트 파일이 비었거나(`""`) tag 선언이 없는 합성 본문에서 추출 helper 가 **추측 없이** 빈 결과 또는 `null` 을 내고 0-byte false-PASS 가 나지 않음을 단언하는 it 1+.
- [ ] **분기 cover** — 추출 helper 의 분기마다 it 1+ (예: 따옴표 종류 차이 · 줄바꿈 배치 차이 · tag 객체가 한 줄/여러 줄인 경우 각각 같은 정규형을 내는지).
- [ ] **negative cases 충분 cover** — 최소 5 종: (1) `stage` tag 를 제거한 합성 본문을 guard 가 검출 (2) 단계 값 하나(`"3"`)를 지운 합성 본문을 검출 (3) `route` 값에 단계 문자열을 섞은 합성 본문(판정 표본 오염)을 검출 (4) `stage` 를 임계 키(`http_req_duration{stage:...}`)로 굳힌 합성 본문을 검출(관찰 전용 위반) (5) 스크립트에 `if (` · `? :` 같은 조건 분기가 새로 들어간 합성 본문을 검출(규약 ⑤ 위반). 각 케이스는 원본을 mutate 하지 않는 대조군 단언을 동반한다.
- [ ] `pnpm lint` · `pnpm build` 무경고, `pnpm test` green(기존 spec 회귀 0), `pnpm test:cov` 임계 통과(line ≥ 80% / function ≥ 80% — `src/` 변경 0 이라 전역 coverage 불변이어야 한다).
- [ ] diff ≤ 300 LOC · 변경 파일 ≤ 5 개(본 task 는 2 파일). `git diff --stat` 로 확인.

## Out of Scope

- **조항 ④ 의 단계별 값 출력 1 줄** (`handleSummary()` 등으로 단계별 통계를 run log 한 줄에 나열) — 본 task 는 **축 부여까지**만이고 출력 회수는 별도 `pr` slice(Follow-ups ①).
- `s1-batch.js` · `s2-read.js` 변경 — 단계 축은 ramping 을 쓰는 S3 만의 문제다.
- `.github/workflows/load-k6.yml` 변경(새 step · 새 env · 트리거 추가) 및 `workflow_dispatch` 실발화 · rerun.
- [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 임계 표 · `§3.1` 회차 기록 · `PLAN.md` 갱신 — 실 run 값 회수 **뒤에** 하는 `direct` slice(설계 조항 ⑤ (ii)). 본 task 는 문서 변경 0.
- 새 dependency 추가(`k6` npm 패키지 · 외부 시계열 저장소 · artifact 업로드) — 설계 조항 ① 대로 0.
- 임계 재산정 · 새 판정 게이트 신설.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① 조항 ④ 출력 slice 설계 시 **k6 caveat 확인 필요** — tag 를 달아도 종료 요약에 sub-metric 열이 자동으로 생기지는 않는다(요약에 나타나는 sub-metric 은 `thresholds` 선언으로 만들어진다). 조항 ② 가 새 임계를 금지하므로 출력 경로는 `handleSummary()`(후보 B)로 좁혀질 가능성이 크다 — 그 slice 에서 실제 동작을 먼저 확인한 뒤 배선할 것.

## 완료 기록

- 완료 시각: 2026-08-25T07:05Z
- PR: #1338, reviewer APPROVE round 1/7, squash merge `44d77a2c`
- 결과: `test/load/s3-concurrent.js` 에 `STAGE_TAG_KEY`/`STAGE_VALUES`/`STAGE_STEP_MS` 3 상수 + `stageTagOf`·`withStage` 헬퍼 2 개로 iteration 3 요청에 `stage` 축(값 `1`·`2`·`3`)을 부여했다. 조항 ② 대로 `thresholds` 4 종 · 임계 숫자 · `route` 값 집합 · `stages` · `summaryTrendStats` 는 문자 단위 0 변경(관찰 전용). drift-guard smoke 에 describe 1 개 · it 12 개 append (happy 4 · error 1 · 분기 2 · negative 5). 2 파일 `+260/-8`(≤300 LOC · ≤5 파일), unit 13,009 test green, CI 전 step success.
