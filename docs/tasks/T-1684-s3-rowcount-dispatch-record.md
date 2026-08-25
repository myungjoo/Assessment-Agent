---
id: T-1684
title: 행 수 로그 배선 후 첫 dispatch 로 S3 2 회차 실측 회수 + §3.1 회차 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T01:05:00Z
independentStream: load-k6-s3-baseline
dependsOn: [T-1682, T-1683]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: PLAN 141 행 R-91 chain 64/N — T-1682 배선의 첫 실측(dispatch 정확히 1 회, S3 2 회차만 기록), 임계·코드 변경 0
---

# T-1684 — 행 수 로그 배선 후 첫 dispatch 로 S3 2 회차 실측 회수 + §3.1 회차 기록

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하검증, 오너 최우선 지시 `144 행`) chain 의 다음 칸이다. T-1682(PR #1336 → main `a5f84cb1`) 가 [`test/load/s3-concurrent.js`](../../test/load/s3-concurrent.js) 의 `setup()` · `teardown()` 에 `persons` 행 수 로그를 배선했고 T-1683 이 계획 문서 축을 동기했지만, **그 배선을 실제로 통과한 run 은 아직 0 회**다. 그래서 `#### S3 1 회차` 가 이월한 "잔여 row 직접 카운트 미확보" 공백과 `#### S2 2 회차` 의 "보존 계약이 `data_received` 정황뿐" 공백이 그대로 남아 있다.

본 slice 는 `load-k6.yml` 을 **정확히 1 회** dispatch 해 그 run 의 S3 leg 수치를 회수하고, `§3.1` 에 `#### S3 2 회차` 를 신설한다. 같은 run 의 S1 · S2 leg 수치는 **본 slice 범위 밖**이며, 다음 slice 가 **같은 run 로그를 재독만 해서** 회수한다 (T-1680 run 을 T-1681 이 재독한 선례 승계 — 새 dispatch 를 두 번 태우지 않기 위함).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2 ### S3. 동시 요청 내성` (행 수 로그 계약, T-1683 박제) · `§3.1` 헤더 `276 행` · `#### S3 1 회차` (`997 행` ~) · `§5` item 5
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — `setup()` / `teardown()` 의 로그 문자열 2 종 (`[s3-concurrent] persons 행 수 시작 …행`, `[s3-concurrent] persons 행 수 종료 …행 / 시작 …행`) 과 route tag 분리 (`seed` / `teardown` vs 판정 tag `read` / `write`)
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `workflow_dispatch` input `s1_persons` (`15 행`), S3 step `k6 S3 동시 요청 내성 시나리오 실행` (`207 행` 부근, `if: ${{ !cancelled() }}`)
- [docs/tasks/T-1680-s2-s3-first-dispatch-record.md](T-1680-s2-s3-first-dispatch-record.md) — 회차 소절 서식 선례 (측정 일시 / THRESHOLDS 원문 / 수치 / 판정 4 블록)
- [docs/PLAN.md](../PLAN.md) `141 행` 꼬리

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** 실행한다. rerun · 재 dispatch · 재시도는 **0** — run 이 fail 로 끝나도 그 사실 자체를 기록하고 종료한다.
- [ ] run 종료 후 `gh run view <run-id> --log` 로 S3 step 로그를 회수하고, 다음을 **원문에서 그대로** 옮겨 적는다 (추정 · 재계산 금지, 다른 회차 값 전용 금지):
  - step 구간 · conclusion · k6 exit code, THRESHOLDS 4 종 원문과 `✓`/`✗` 개수
  - 전역 · `{route:read}` · `{route:write}` 의 `http_req_duration` 원문 줄, `http_req_failed`, `http_reqs`, `iterations`, `iteration_duration`, `vus` / `vus_max`
  - **`[s3-concurrent] persons 행 수 시작 …행` · `… 종료 …행 / 시작 …행` 2 줄** — 없으면 "미출력" 으로 명시.
- [ ] [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 `#### S3 1 회차` 소절 **뒤에** `#### S3 2 회차 (T-1684, run <run-id>, T-1682 행 수 로그 배선 후 첫 회차)` 를 신설한다. `#### S3 1 회차` 서식(측정 일시 / THRESHOLDS 원문 / 수치 / 판정)을 그대로 승계하고, 다음 2 항목을 추가로 담는다:
  - **행 수 잔여 판정** — 종료 행 수 − 시작 행 수 를 직접 적고, 그 차이로 iteration 자기 정리(규약 ②) 잔여를 판정한다. `http_reqs` 배수식은 이제 `3 × iterations + 2` 임을 확인만 하고 잔여 근거로 쓰지 않는다.
  - **`p99` 미확보 표기** — k6 기본 요약 미출력. 다른 회차 값으로 대체 금지.
- [ ] `§3.1` 헤더(`276 행`)의 개수 표기를 `(S1 12 회분 · S2 2 회분 · S3 2 회분)` 으로 갱신한다. **S1 · S2 회분 수는 본 slice 에서 올리지 않는다** (같은 run 의 S1 · S2 수치 회수는 다음 slice 소관).
- [ ] `#### S3 1 회차` 꼬리(자기정리 bullet 의 `[항등식 주의 (T-1682) …]` 대괄호)에 **회수 완료 pointer 1 줄**을 추가한다 — 배선 후 실측이 `S3 2 회차` 에 있다는 사실만. 기존 문장 · 수치는 **삭제 0** (이력 보존).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (dispatch 1 회 · run id · S3 회분 1→2 · S1 · S2 회수는 다음 slice).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append. `140 행` checkbox 는 실 수집 축 미검증이라 `[ ]` 유지.
- [ ] `§3` 임계 표는 **문자 단위 0 변경** — S3 축 표본이 2 회뿐이라 `error rate < 1%` · `latency cliff 부재` 를 fix 하지 않는다 (규칙 사전 박제 → 기계 적용 2 단계 승계). 변경했다면 위반.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`) 이고 `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only 라 R-110 tester 의무 면제 — production 0 LOC).

## Out of Scope

- **같은 run 의 S1 13 회차 · S2 3 회차 기록** — 다음 slice 가 같은 run 로그를 **재독만** 해 회수한다 (T-1681 선례). 본 slice 에서 쓰면 diff cap 을 넘긴다.
- `K6_SEED_PERSONS` `"30"` → `133` 상향 판단 — 별도 slice (본 slice 의 행 수 로그가 그 판단의 입력이다).
- 단계별 percentile export step 도입 — 별도 slice.
- 임계 숫자(`§3` 표 · `STUB_BASELINE_P95_MS`) 변경, 워크플로 · k6 스크립트 · smoke spec 변경, 새 dependency 추가.
- 두 번째 dispatch · rerun — run 이 fail 이어도 재실행하지 않는다.

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + 문서 기록) → 별도 tester 불요 (doc-only, R-110 면제 — 확인용 `pnpm lint` 만).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
