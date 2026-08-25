---
id: T-1701
title: 같은 run 32879776505 재독으로 S2 6 회차 · S3 5 회차 실측 회수
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-k6-baseline-record
dependsOn: [T-1700]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-26
createdAt: 2026-08-26T00:00:00Z
plannerNote: PLAN 144 행 R-91 chain 다음 칸 — T-1700 이 이월한 같은 run 의 S2 6·S3 5 leg 를 재독만으로 회수, dispatch 0
---

# T-1701 — 같은 run 32879776505 재독으로 S2 6 회차 · S3 5 회차 실측 회수

## Why

[PLAN.md](../PLAN.md) `144 행` (🔴🔴 오너 최우선 지시 — R-91 k6 부하검증) chain 의 다음 칸이며,
T-1700 이 Result 에 명시 이월한 항목이다. T-1700 은 `load-k6.yml` 을 정확히 1 회
dispatch(run **32879776505**, conclusion `success`) 해 **S1 leg 수치만** 회수하고
(`#### 16 회차`), 같은 run 의 **S2 · S3 leg 는 diff cap 때문에 미회수** 로 남겼다.

본 slice 는 **그 로그를 재독만** 해 (새 `workflow_dispatch` · rerun · 재시도 **0**)
`§3.1` 에 `#### S2 6 회차` 와 `#### S3 5 회차` 를 신설한다 — T-1680→T-1681,
T-1684→T-1685, T-1692→T-1693, T-1694→T-1695 네 선례를 그대로 승계한다. 이미 태운 run 의
미회수 leg 를 먼저 거두는 것이 본 chain 의 확립된 순서다.

## Required Reading

- `docs/PLAN.md` `144 행` (오너 최우선 지시) · `141 행` (회차 카운터 문장)
- `docs/tasks/T-1700-s1-16th-dispatch-gate-1200-first-run.md` 의 `## Result` (이월 명시 + run id)
- `docs/ops/load-resilience-test-plan.md` `1719 행` `#### S2 5 회차` (S2 기록 서식 선례)
- `docs/ops/load-resilience-test-plan.md` `2086 행` `#### S3 4 회차` (S3 기록 서식 선례)
- `docs/ops/load-resilience-test-plan.md` `473 행` `### 3.1` 헤더 (회분 표기 갱신 대상)

## Acceptance Criteria

- [ ] **dispatch 0** — `gh run view 32879776505 --log` (또는 step 단위 log 조회) 로 **기존 run 만
      재독**한다. 새 `workflow_dispatch` · `gh run rerun` · 재시도를 **한 번도 하지 않는다**.
      (검증: `gh run list --workflow=load-k6.yml --limit 3` 결과에 본 task 시각 이후 신규 run 이
      없어야 한다.)
- [ ] `docs/ops/load-resilience-test-plan.md` 에 `#### S2 6 회차 (T-1701, run 32879776505, 같은 run
      재독 회수)` 를 **add-only** 로 신설 — 삽입 위치는 `#### K6_SEED_PERSONS 상한 상향 판단 (T-1686)`
      **직전**. 내용은 `#### S2 5 회차` 서식 승계 (측정 일시 · run/step 구간 · k6 exit code ·
      `THRESHOLDS` 원문 · p95/p99 · error rate · 직전 회차 대비 Δ 는 **산술 차이로만**).
- [ ] `docs/ops/load-resilience-test-plan.md` 에 `#### S3 5 회차 (T-1701, run 32879776505, 단계별
      Trend 3 번째 표본)` 를 **add-only** 로 신설 — 삽입 위치는 `## 4. 접근 방식·도구 후보`
      **직전**. 내용은 `#### S3 4 회차` 서식 승계 (단계별 custom `Trend` 3 행 값 포함).
- [ ] `### 3.1` 헤더(`473 행`) 회분 표기를 `S1 16 회분 · S2 6 회분 · S3 5 회분` 으로 갱신.
- [ ] `docs/PLAN.md` `141 행` 의 회차 카운터를 `baseline 실측 S1 16 회 · S2 6 회 · S3 5 회 완료` 로
      갱신하고 본 slice 집행 사실을 **1 문장** append (기존 문장 삭제 0). `144 행` checkbox 는
      `[ ]` 유지.
- [ ] leg 가 fail/skip 으로 끝났으면 **그 사실 자체를 기록** 하고 종료한다 — 성공할 때까지 재실행
      금지 (T-1694 선례).
- [ ] `pnpm lint` 무경고. 변경 파일 **정확히 2 개** (`docs/ops/load-resilience-test-plan.md` ·
      `docs/PLAN.md`), `src/` · `test/` · `.github/workflows/` · `package.json` diff **0**.

분기 없는 doc-only direct task 이므로 R-112 4 종(happy / error path / 분기 / negative) 은 적용 대상이
아니며, production code 0 LOC 라 R-110 tester 의무도 면제된다 (CLAUDE.md §3.2).

## Out of Scope

- 새 `workflow_dispatch` · rerun · 재측정 (본 slice 는 **재독 전용**).
- `§3` 임계 표 숫자 · `STUB_BASELINE_P95_MS` · `thresholds` 값 변경 (T-1668 규칙 ④ 의 2 task split 소관).
- `#### S3 latency cliff 판정 규칙` (T-1698) 의 **3 번째 표본 기계 대입** — T-1699 가 2 표본에
      적용한 것과 같은 형태로 별도 slice 에서 수행한다.
- `s2-read.js` 로의 단계별 custom `Trend` 확대 배선 (`pr` slice 소관).
- 기박제 회차 수치의 소급 치환, `§3.1` 기존 회차 본문 수정.

## Suggested Sub-agents

`implementer` (doc-only 기록 — tester 불요)

## Follow-ups
