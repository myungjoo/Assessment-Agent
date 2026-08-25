---
id: T-1700
title: 재확정 임계 1200 의 실 run 첫 적용 — dispatch 1 회 + S1 16 회차 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
independentStream: load-k6-s1-baseline
dependsOn: [T-1696, T-1697]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-26
createdAt: 2026-08-26T00:00:00Z
plannerNote: PLAN 141 행 R-91 chain 다음 칸 — T-1696/T-1697 이 올린 관찰용 게이트 1200 이 실 run 에서 0 회 적용, dispatch 1 회로 S1 leg 만 회수
---

# T-1700 — 재확정 임계 `p(95)<1200` 의 실 run 첫 적용 (dispatch 1 회 + `§3.1` `#### 16 회차`)

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증, 오너 최우선 지시) chain 의 다음 칸이다.
T-1695 가 15 회차에서 T-1668 규칙을 기계 재계수해 트리거 **①-(a) · ①-(b)** 발화를 확인했고,
규칙 ④ 의 2 task split 대로 T-1696 이 코드 축(`s1-batch.js` 의 `STUB_BASELINE_P95_MS` 1100 →
**1200** + drift-guard smoke 동기, `pr`) · T-1697 이 문서 축(`direct`) 을 각각 집행했다.
그런데 **그 재확정 임계는 아직 실 run 에서 한 번도 적용된 적이 없다** — 15 회차의 마지막 실
run 은 옛 임계 `1100` 아래에서 `✗` 로 끝났고, 이후 T-1698 · T-1699 는 새 dispatch **0** 인
문서 slice 였다. 임계를 바꿔 놓고 실 run 으로 확인하지 않으면 상수만 갈아 끼운 셈이 되고,
그 게이트가 실제로 k6 `THRESHOLDS` 원문에 `p(95)<1200` 으로 나타나는지도 미증명이다.

본 slice 는 [`load-k6.yml`](../../.github/workflows/load-k6.yml) 을 **정확히 1 회** dispatch 해
그 run 의 **S1 leg 수치만** 회수하고 `§3.1` 에 `#### 16 회차` 를 신설한다. 12 회차(T-1681,
"T-1669 재확정 임계 `p(95)<1100` 의 실 run 첫 적용") 와 같은 성격의 회차 기록이다. 같은 run 의
S2 · S3 leg 는 **본 slice 범위 밖**이며 다음 slice 가 **같은 run 로그를 재독만 해서** 회수한다
(T-1684 → T-1685, T-1692 → T-1693, T-1694 → T-1695 선례 승계 — dispatch 를 두 번 태우지 않는다).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  - `473 행` — `### 3.1 baseline 실측 기록 (S1 15 회분 · S2 5 회분 · S3 4 회분)` 헤더 (개수 표기 갱신 대상)
  - `1205~1312 행` — `#### 15 회차 (T-1695, run 32843613484, ...)` 전문 (**서식 정본**: 측정 일시/run ·
    표본 로그 원문 · 행 수 로그 · `level=error` 줄 수 · seed step 결과 · `THRESHOLDS` 원문 인용 ·
    T-1668 규칙 기계 재계수 · `§3` 표 무변경 판정 · 이월 pointer)
  - `1313 행` — `#### S2 1 회차` 헤더. 신설 `#### 16 회차` 는 **이 줄 직전**(15 회차 블록 꼬리)에 삽입한다
  - `966~1038 행` — `#### 12 회차` (재확정 임계의 **실 run 첫 적용** 을 기록한 직전 선례, 서술 톤 참고)
  - `§5` item 5 꼬리 (파일 끝, `3204 행`) — 집행 문단 append 위치
- [test/load/s1-batch.js](../../test/load/s1-batch.js) — `47~74 행` 의 `STUB_BASELINE_PERSONS = 133` ·
  `STUB_BASELINE_P95_MS = 1200` 과 게이트 부착 조건(`SAMPLE_PERSONS === STUB_BASELINE_PERSONS`).
  **읽기만 한다 — 본 slice 는 이 파일을 수정하지 않는다.**
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) —
  `S1_STUB_BASELINE_P95_MS` drift-guard. **읽기만 한다 — 수정 0.**
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `workflow_dispatch` input
  `s1_persons`, S1 step `k6 S1 평가 배치 부하 시나리오 실행`
- [docs/tasks/T-1694-s3-stage-trend-second-dispatch-record.md](T-1694-s3-stage-trend-second-dispatch-record.md) —
  dispatch 1 회 + 회차 1 개 기록 slice 의 직전 선례 (범위 절제 방식)
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(commit mode rule 1) · `§12`(언어 · 범위 좌표 표기 · 소급 치환 금지)

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** 실행한다.
      rerun · 재 dispatch · 재시도는 **0** — run 이 `failure` 로 끝나거나 S1 step 이 skip 돼도
      **그 사실 자체를 기록하고 종료**한다 (성공할 때까지 반복 금지). `git log` · journal 에
      dispatch 가 2 회 이상 나타나면 본 항목 실패.
- [ ] `gh run view <run-id> --log` 로 **S1 leg 만** 회수해 `docs/ops/load-resilience-test-plan.md`
      `§3.1` 의 `#### S2 1 회차` **직전**에 `#### 16 회차 (T-1700, run <run-id>, 재확정 임계
      p(95)<1200 의 실 run 첫 적용)` 소절을 add-only 로 신설한다. 항목 구성은 `#### 15 회차`
      서식을 그대로 승계 — 측정 일시/run · 표본 로그 원문(`N == M == 133` 판정) · 행 수 로그
      미출력 사실 · `level=error` 줄 수 · seed step 결과 · `THRESHOLDS` 로그 **원문 인용** ·
      `§3` 표 무변경 판정 · 이월 pointer.
- [ ] `THRESHOLDS` 인용에 **`p(95)<1200` 문자열이 실제 run 로그 원문으로 등장**함을 박제하고
      `✓` / `✗` 중 어느 쪽인지 원문 그대로 적는다. 등장하지 않으면(예: 표본 인원 불일치로 게이트
      미부착) **그 미부착 사실과 원인 줄을 그대로 기록**하고 추정 서술을 덧붙이지 않는다.
- [ ] `§3.1` 헤더(`473 행`)의 회분 표기를 **`S1 16 회분 · S2 5 회분 · S3 4 회분`** 으로 갱신한다
      (S2 · S3 숫자는 본 slice 에서 올리지 않는다 — 같은 run 의 그 두 leg 는 다음 slice 소관).
- [ ] **임계 재조정 0** — T-1668 규칙 ①-(a)/①-(b) 를 새 표본 포함해 기계 재계수한 결과(실 scale
      표본 개수 · 평균 · 표본표준편차 · 평균+3σ · 트리거 발화 여부)는 소절에 **기록만** 하고,
      `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS` · drift-guard spec 의
      `S1_STUB_BASELINE_P95_MS` · `§3` 임계 표는 **문자 단위 무변경**이다 (숫자 집행은 규칙 ④ 의
      2 task split 소관). `git diff --stat` 에 `test/` · `src/` · `.github/workflows/` ·
      `package.json` 이 **0 파일**로 나타나야 한다.
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개, [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장을
      append 한다. `140 행` checkbox 는 **`[ ]` 유지**(LLM stub · 실 수집 왕복 여전히 0).
- [ ] 기박제 수치 **소급 치환 0** — 1 ~ 15 회차 · S2 1 ~ 5 회차 · S3 1 ~ 4 회차 소절과 T-1698
      규칙 소절(`394~472 행`) 은 `git diff -U0` 상 hunk **0**.
- [ ] 변경은 **2 파일 · ≤ 300 LOC** (`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`).
      `pnpm lint` 무경고 확인. doc-only `direct` 라 R-110 tester 의무는 면제.

## Out of Scope

- 같은 run 의 **S2 6 회차 · S3 5 회차 기록** — 다음 slice 가 같은 로그를 재독해 회수한다.
- 관찰용 게이트 임계 · drift-guard 상수 · `§3` 임계 표의 어떤 숫자 변경도 금지 (규칙 ④ split 소관).
- S3 `latency cliff` 재판정 (T-1698 규칙 ③ 의 3 번째 표본 반영) — 별도 slice.
- `s1-batch.js` · `s3-concurrent.js` · `load-k6.yml` · spec · `package.json` 등 **코드 변경 일체**.
- 실 LLM 수집 왕복 활성화 · `LOAD_TEST_STUB` 해제 · 새 dependency 추가.
- run 이 실패했을 때의 원인 수정 · rerun · workflow 손질.

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + 문서 append). doc-only `direct` 라 `tester` 는 면제이나
`pnpm lint` 확인은 implementer 가 수행.

## Follow-ups
