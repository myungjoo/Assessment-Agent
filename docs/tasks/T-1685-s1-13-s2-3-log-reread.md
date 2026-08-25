---
id: T-1685
title: 같은 run 재독으로 S1 13 회차 · S2 3 회차 실측 회수 + §3.1 회차 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T02:05:00Z
independentStream: load-k6-baseline-record
dependsOn: [T-1684]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: PLAN 141 행 R-91 chain 65/N — T-1684 run 32798553930 재독만으로 S1·S2 leg 회수, 새 dispatch 0, 임계·코드 변경 0
---

# T-1685 — 같은 run 재독으로 S1 13 회차 · S2 3 회차 실측 회수 + §3.1 회차 기록

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하검증, 오너 최우선 지시 `144 행`) chain 의 다음 칸이며 T-1684 Follow-up **①** 이다. T-1684 는 `load-k6.yml` 을 정확히 1 회 dispatch(run `32798553930`) 해 **S3 leg 수치만** 회수하고, 같은 run 의 S1 · S2 leg 수치는 diff cap 때문에 Out of Scope 로 이월했다.

본 slice 는 **그 run 의 로그를 재독만** 해서(새 `workflow_dispatch` · rerun · 재시도 **0**) `§3.1` 에 `#### 13 회차` 와 `#### S2 3 회차` 를 신설한다. T-1680 이 소진한 run 을 T-1681 이 재독해 S1 12 회차를 회수한 선례를 그대로 승계한다 — 이미 지불한 CI 비용에서 남은 수치를 마저 뽑는 것이므로 새 부하 실행이 필요 없다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§3.1` 헤더 `276 행` · `#### 12 회차` (`769 행` ~, S1 회차 서식 선례) · `#### S2 2 회차` (`913 행` ~, S2 회차 서식 선례) · `#### S3 2 회차` (`1052 행` ~, 같은 run 의 이미 기록된 leg) · `§5` item 5 꼬리
- [docs/tasks/T-1681-s1-12th-log-reread.md](T-1681-s1-12th-log-reread.md) — 재독 전용 slice 의 선례 (새 dispatch 0 · 재계수 절차 · 표기 규약)
- [docs/tasks/T-1684-s3-2nd-dispatch-record.md](T-1684-s3-2nd-dispatch-record.md) — 본 run(`32798553930`) 의 dispatch 조건 · Out of Scope 이월 문구
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 임계 표 (`182 행` ~) — T-1668 재확정 규칙 ①-(a)/①-(b) 트리거 조문
- [docs/PLAN.md](../PLAN.md) `141 행` 꼬리

## Acceptance Criteria

- [ ] `gh run view 32798553930 --log` 를 **재독만** 한다. 새 `gh workflow run` · rerun · 재시도는 **0** — 실행했다면 위반이다.
- [ ] S1 leg step(`k6 S1 평가 배치 부하 시나리오 실행`) 로그에서 다음을 **원문 그대로** 옮겨 적는다 (추정 · 다른 회차 값 전용 금지, 없으면 "미출력" 명시):
  - step 구간 · conclusion · k6 exit code, THRESHOLDS 3 종 원문과 `✓`/`✗`
  - batch p95(`http_req_duration`), `http_reqs`, `http_req_failed`, `iteration_duration`, 표본 행 수 로그 줄, `level=error` 줄 수
- [ ] S2 leg step(`k6 S2 조회 API 응답 지연 시나리오 실행`) 로그에서도 같은 방식으로 회수한다 — step 구간 · conclusion · exit code, THRESHOLDS 원문과 `✓` 개수, 전역 및 route 별 `http_req_duration`, `http_req_failed`, `http_reqs`, `iterations`, 행 수 로그 줄.
- [ ] [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 `#### 12 회차` **직후**에 `#### 13 회차 (T-1685, run 32798553930, T-1684 dispatch 의 S1 leg 재독 회수)` 를, `#### S2 2 회차` **직후**에 `#### S2 3 회차 (T-1685, run 32798553930, 같은 run 재독 회수)` 를 신설한다. 각각 인접 선례 소절의 4 블록 서식(측정 일시 / THRESHOLDS 원문 / 수치 / 판정)을 승계하고 `p99` 는 **미확보** 로 표기한다.
- [ ] `#### 13 회차` 안에서 T-1668 재확정 규칙을 **기계 재계수** 한다 — 실 scale 표본 133 의 수치 회수 회차 목록 · 개수 · 평균 · 표본표준편차 · 평균+3σ 를 계산해 적고, 트리거 ①-(a)/①-(b) 발화 여부를 명시한다. **트리거가 발화하더라도 본 slice 에서는 임계값을 바꾸지 않는다** — 발화 사실과 산출값만 기록하고 임계 조정은 별도 slice 로 넘긴다 (Follow-ups 에 append).
- [ ] `§3.1` 헤더(`276 행`)의 개수 표기를 `(S1 13 회분 · S2 3 회분 · S3 2 회분)` 으로 갱신한다. **S3 회분은 올리지 않는다** (T-1684 가 이미 기록).
- [ ] `#### S3 2 회차` 꼬리에 **같은 run 의 S1 · S2 회수 완료 pointer 1 줄**을 추가한다 (Out of Scope 이월 해소 사실만). 기존 문장 · 수치는 **삭제 0** — 이력 보존.
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (재독 전용 · 새 dispatch 0 · 회분 S1 12→13 · S2 2→3 · 재계수 결과).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append 하고 회차 개수를 재계수한다. `140 행` checkbox 는 실 수집 축 미검증이라 `[ ]` 유지.
- [ ] `§3` 임계 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 은 **문자 단위 0 변경**. 변경했다면 위반이다.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`) 이고 `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only 라 R-110 tester 의무 면제 — production 0 LOC).

## Out of Scope

- **새 dispatch · rerun** — 본 slice 는 이미 끝난 run `32798553930` 의 로그 재독만 한다.
- **임계값 조정** — 재계수 결과가 트리거를 발화시켜도 `§3` 표 · `STUB_BASELINE_P95_MS` · spec 은 건드리지 않는다 (별도 slice).
- `K6_SEED_PERSONS` `"30"` → `133` 상향 판단 — 별도 slice.
- 단계별 percentile export step 도입 (p99 회수 · 단계 분해) — 별도 slice.
- 워크플로 · k6 스크립트 · smoke spec · dependency 변경.

## Suggested Sub-agents

`implementer` (로그 재독 + 재계수 + 문서 기록) → 별도 tester 불요 (doc-only, R-110 면제 — 확인용 `pnpm lint` 만).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
