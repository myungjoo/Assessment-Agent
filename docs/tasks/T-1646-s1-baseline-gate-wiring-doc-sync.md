---
id: T-1646
title: 900ms 게이트 배선 완료를 부하계획 §3 각주 · §5 item 5 · PLAN 141 행에 doc-sync
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22T00:00:00Z
completedAt: 2026-08-22T06:47:00Z
independentStream: load-k6-s1
dependsOn: [T-1645]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: "P5 성능 검증(R-91) — T-1645 머지로 stale 이 된 '배선은 pr-mode 별도 task' 서술 3 곳을 사실과 동기화"
---

# T-1646 — 900ms 게이트 배선 완료를 부하계획 §3 각주 · §5 item 5 · PLAN 141 행에 doc-sync

## Why

[PLAN.md](../PLAN.md) `140~141 행` "성능 검증 · R-91" bullet (오너 지시 `144 행` "R-91 k6 최우선·즉시 착수" chain) 의 후속이다.
T-1645 (PR #1316 → main `874297ca`) 가 **stub 조건 baseline p95 ≤ 900ms 를 [`test/load/s1-batch.js`](../../test/load/s1-batch.js) 의 `thresholds` 게이트로 실제 배선**했는데,
문서 3 곳은 아직 "배선은 pr-mode **별도 task 로 남는다**" 로 적혀 있어 main 의 사실과 어긋난다 (stale 서술).
본 slice 는 그 3 곳만 현재 사실로 맞추는 direct-mode doc-sync 이며, **임계 숫자 · 스크립트 · 워크플로는 전혀 건드리지 않는다**.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 각주 (`102~106 행` 부근 — "본 회차는 스크립트 배선을 바꾸지 않았다 (900ms 를 게이트로 태우는 일은 pr-mode 별도 task)")
- 같은 문서 `§5` item 5 (`336~364 행` 부근 — "남은 것은 확정된 900ms 를 스크립트 `thresholds` 게이트로 태우는 **배선**(pr-mode 별도 task)뿐이며…")
- [docs/PLAN.md](../PLAN.md) `140~141 행` (141 행 말미 "…게이트로 태우는 배선은 pr-mode 별도 task 로 남는다.")
- [docs/tasks/T-1645-s1-batch-stub-baseline-threshold-wiring.md](T-1645-s1-batch-stub-baseline-threshold-wiring.md) — 무엇이 어떻게 배선됐는지 (상수명 · 조건부 활성 · 임계 key 2 종)
- [test/load/s1-batch.js](../../test/load/s1-batch.js) 의 `thresholds` 블록 — 문서에 인용할 상수명 (`STUB_BASELINE_PERSONS` · `STUB_BASELINE_P95_MS`) 과 조건부 활성 동작 확인용

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` `§3` 각주의 "본 회차는 스크립트 배선을 바꾸지 않았다 (900ms 를 게이트로 태우는 일은 pr-mode 별도 task)" 서술이 **T-1645 (main `874297ca`, PR #1316) 로 배선 완료** 로 갱신돼 있다. 갱신 문장에 ① 배선 task/commit 좌표 ② 조건부 활성 (표본 `133` 일 때만 900ms 게이트가 붙고 기본 표본 10 run 은 영향 0) ③ **REQ-047 판정 임계는 여전히 1h 예산(`FULL_RUN_BUDGET_MS`)** 이라는 성격 구분이 함께 적혀 있다.
- [ ] 같은 문서 `§5` item 5 의 "남은 것은 … 배선(pr-mode 별도 task)뿐이며, 이는 임계 확정과 다른 축이다" 문장이 **배선 축 해소** 로 갱신됐고, item 5 의 잔여 목록이 **① 실 dataset seed (133 명 `Person` + github `ServiceIdentity` 실 수집 왕복) 1 개만 남는다** 는 사실을 명시한다 (② 임계 fix · ③ 환경 메타 회수는 이미 해소 표기 유지).
- [ ] `docs/PLAN.md` `141 행` 말미의 "…배선은 pr-mode 별도 task 로 남는다." 서술이 배선 완료 사실 (T-1645 · main `874297ca` · PR #1316) 로 갱신됐다.
- [ ] **`140 행` checkbox 는 `[ ]` 유지** — 인원 축만 실 scale 이고 LLM stub · 외부 수집 왕복 0 이라 REQ-047 완료 조건 미달이라는 판단은 무변경.
- [ ] **임계 숫자 무변경** — `§3` 표의 `≤ 900ms` · `< 1%` · S2 · S3 의 `baseline 후 fix` 표기, `§3` 도출식 (평균 734.32ms + 3σ 25.02ms = 809.38ms → 900ms), `§3.1` 1~5 회차 실측 기록이 모두 문자 그대로 보존됨을 `git diff` 로 확인.
- [ ] `test/load/s1-batch.js` · `.github/workflows/load-k6.yml` · `package.json` · `src/` · `test/` 변경 0 (`git diff --name-only` 가 위 `touchesFiles` 2 개만 출력).
- [ ] 변경 파일 ≤ 2 개, diff ≤ 300 LOC (CLAUDE.md §3).
- [ ] direct commit 이므로 tester 는 호출하지 않는다 (CLAUDE.md §3.2 R-110 의 doc-only 면제). 단 push 후 main CI run conclusion 을 driver 가 확인한다 (R-114).

## Out of Scope

- k6 재 dispatch 실측 (배선된 900ms 게이트가 실제로 통과/차단하는지 확인) — 별도 slice.
- 133 명 실 dataset seed / 실 수집 왕복 (`§5` item 5 잔여 ①) — 별도 slice.
- REQ-047 상태 전이 doc-sync (`docs/requirements.md` 등) — 별도 slice.
- `§3` 표의 임계 숫자 조정, S2 · S3 축의 `baseline 후 fix` 해제.
- `test/load/s1-batch.js` · 워크플로 · smoke drift spec 의 어떤 변경도 금지 (본 slice 는 문서 전용).
- R-92 per-route perf-spec 신규 slice (PLAN `145 행` 오너 지시로 큐잉 금지).
- PLAN `146 행` R-92 mega-bullet prune — 별도 오너 지시 항목이라 본 slice 에 섞지 않는다.

## Suggested Sub-agents

`implementer` (doc 편집만) — architect · tester 불요.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 시 append)
