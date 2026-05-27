---
id: T-0077
title: estimate-model.md 15 회차 milestone + inline-amend variance 박제 refinement
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-05-28
dependsOn: [T-0070, T-0073, T-0076]
plannerNote: cap-bend pre-justified: doc-only enumerated-section × 1.6 × 0.4 inline-amend = 60 LOC, T-0070/T-0073 패턴 정당화 — 15 회차 milestone + variance 박제
---

# T-0077 — estimate-model.md 15 회차 milestone + inline-amend variance 박제 refinement

## Why

T-0076 머지로 inline-amend × 0.4 sub-multiplier dogfood 3 회차 누적 (T-0070 -63% / T-0073 -86% / T-0076 -1%) — 평균 -50% 가 아닌 **standard deviation 큼 (range 85 percentage point)** 의 박제 source 가 확정됐다. estimate-model.md §2.3 (session #20-21 4 회차) + §2.4 (14 회차 누적) + §3.2.2 (inline-amend sub-pattern) + §4.2 (sub-multiplier × 0.4) 의 4 단락은 현재 11 회차/14 회차 milestone 기준 박제 — 15 회차 milestone 진입 + variance 박제 데이터 추가가 자연 follow-up. PLAN.md L142 운영정책 review backlog 의 estimate 안정화 trigger 도 본 task 가 cover (cap-bend pattern 명문화 후 5 회차 → 14 회차 → 15 회차 누적 갱신 cycle).

PLAN.md Phase P3 운영 메타 안정화 + 차후 P3 잔여 backbone task (User + AuthModule + ADR-0008 chain) 의 estimate 신뢰도 박제가 본 task 의 strategic value.

## Required Reading

- `docs/architecture/estimate-model.md` — §1 ~ §7 전체 (특히 §2.3 / §2.4 / §3.2.2 / §4.2 / §7 References 의 amend 대상).
- `docs/tasks/T-0076-p3-to-p4-transition-refresh.md` — `actualDiff` / `actualFiles` / `estimateOutcome` frontmatter 박제 source (-1% accurate-pass).
- `docs/tasks/T-0070-estimate-model-multiplier-refinement.md` — -63% precedent source.
- `docs/tasks/T-0073-integrator-md-and-claude-md-mcp-amend.md` — -86% precedent source.
- `docs/progress/journal-2026-05-28.md` 첫 entry (turn 3 milestone (i)) — variance 큼 박제의 직접 trigger 근거.
- `.claude/agents/planner.md` "Estimate model" 단락 (sub-multiplier × 0.4 inline-amend 적용 절차) — 본 doc 의 sub-multiplier 부분 변경 시 동기 가능성.

## Acceptance Criteria

본 task 는 doc-only direct (production code 변경 0) — CLAUDE.md §3.2 R-110 의 tester 의무 면제. 단 검증 항목은 명시:

- [ ] `docs/architecture/estimate-model.md` §2.3 표에 T-0076 1 row 추가 (`T-0076 p3-to-p4-transition.md refresh | doc-only enumerated-section (inline-amend sub-pattern) | 120 | 119 | -1%`). 단락 끝 평균 overrun 문장 (-41%) 을 T-0076 누적 반영해 갱신 (4 회차 → 5 회차, 평균 재계산).
- [ ] `docs/architecture/estimate-model.md` §2.4 14 회차 누적 평균 단락을 **15 회차 누적 평균** 으로 갱신. 본 단락 안의 doc-only enumerated-section subset (4 회차 → 5 회차) + inline-amend 2 회차 평균 -74% → 3 회차 평균 -50% 박제 + **variance/standard-deviation 큼 marker 신설** (range ~85 percentage point: -86% ~ -1%). milestone marker (14 → 15) 박제 한 줄 추가.
- [ ] `docs/architecture/estimate-model.md` §3.2.2 inline-amend sub-pattern 단락에 **variance 큼 박제 1 단락 추가** — 3 회차 누적 -86% / -63% / -1% 의 spread 가 NEW-doc creation 의 spread (T-0063 +201% / T-0072 -3%) 보다 작거나 비슷 (둘 다 outlier 큼). sub-multiplier × 0.4 의 calibration band 의 "정확한 평균값" 보다 **systematic over-estimate 의 일관성** 박제가 정확 — sub-multiplier 자체 값 변경 0 (× 0.4 유지) 명시.
- [ ] `docs/architecture/estimate-model.md` §4.2 sub-multiplier 표의 "산출 근거" 컬럼에 T-0076 1 회차 추가 박제 (-1% accurate-pass) + 3 회차 누적 평균 -50% 갱신 + sub-multiplier × 0.4 유지 invariant 명시. effective × 0.64 식 변경 0.
- [ ] `docs/architecture/estimate-model.md` §6 갱신 정책 단락의 "20 회차 milestone" trigger 박제 갱신 (현 15 회차 → next 20 회차 = +5 task estimate, 본 task 후 7 task 진행 예상).
- [ ] `docs/architecture/estimate-model.md` §7 References 에 `T-0076-p3-to-p4-transition-refresh.md` 1 줄 추가 + `T-0077-estimate-model-15-milestone-variance-refinement.md` (본 task) 1 줄 추가. Refs: trailer 의 T-0077, T-0076 prepend.
- [ ] `.claude/agents/planner.md` 의 "Estimate model" 단락 검토 — sub-multiplier × 0.4 자체 변경 0 이지만 variance 큼 박제 사실을 한 줄 반영 (선택, edit 최소화 우선).
- [ ] `prettier --write` 적용 후 `prettier --check docs/architecture/estimate-model.md .claude/agents/planner.md` 통과.
- [ ] 본 task 의 envelope: estimate-model.md amend ~50-60 LOC raw-add + planner.md selective amend ~5-10 LOC raw-add = **총 60-70 LOC, 2 파일**. inline-amend × 0.4 effective × 0.64 sub-multiplier 4 회차 dogfood 자체.
- [ ] §1 박제 범위 invariant 보존 (5 unit) + §3 카테고리 정의 4 종 invariant 보존 (R-112 / doc-only / ADR-first / single-helper) + §4 multiplier 4 종 값 (× 1.5 / × 1.6 / × 1.3 / × 1.0) + § 4.1 sub × 1.2 / § 4.2 sub × 0.4 모든 sub-multiplier 값 invariant. 본 task 는 milestone counter (14 → 15) + variance 박제 + T-0076 row 추가만 변경.

## Out of Scope

- multiplier (× 1.5 / × 1.6 / × 1.3 / × 1.0) 또는 sub-multiplier (× 1.2 P2002 / × 0.4 inline-amend) **값 자체 변경** — CLAUDE.md §3 의 ramen-noodle pattern 회피 (1 회차 spike 만으로 정책 변경 금지). 본 task 는 data 누적 박제 only, multiplier 값 invariant.
- §3 카테고리 정의 4 종 (R-112 backbone / doc-only enumerated / ADR-first split / single-helper test) 의 정의 변경 또는 신설 — 25 회차 milestone trigger 후보, 본 task 외.
- §1 박제 범위 (5 unit) 또는 §5 planner 적용 절차의 변경 — invariant 보존.
- estimate-model.md 외 다른 architecture doc (p3-to-p4-transition.md / race-patterns.md / 등) 의 갱신 — 별도 task.
- CLAUDE.md / LOOP.md / 기타 agent 정의 (planner.md 외) 의 변경 — 별도 task. planner.md 도 sub-multiplier 식 자체 변경 없는 한 변경 최소화.
- production code 변경 (src/ / web/ / test/ / prisma/) 완전 0 — pr-mode 전이 0.
- new package.json dependency 추가 0.
- T-0076 변경 retroactive (frontmatter 또는 본문) — invariant 보존, 본 task 는 estimate-model.md 안에서 T-0076 row 추가만 박제.

## Suggested Sub-agents

`implementer → (tester 면제, doc-only direct)`

본 task 는 driver 의 single-commit bundle 4 회차 dogfood 후보 — implementer 가 2 파일 staged (commit 안 함) 한 뒤 driver 의 STATE / journal / task frontmatter status DONE 박제를 single direct commit on main 으로 묶음.

R-110 tester 의무는 doc-only direct 면제 (CLAUDE.md §3.2 R-110 의 "production code 변경 0 LOC 이어도 tester 의무" 는 pr-mode 한정). T-0076 의 doc-only direct 예시 박제 mirror.

## Follow-ups

(executor / implementer / tester sub-agent 가 본 task 진행 중 발견한 follow-up 후보 박제)

- estimate model 16 회차 milestone refinement (본 task 후 추가 1 회차 누적 시 자연 follow-up — 단 R-112 backbone subset 의 P2002 sub-multiplier × 1.2 추가 검증 회차 누적 시 우선).
- ADR-0007 audit log entity schema 박제 (P4 와 병행 가능, p3-to-p4-transition.md §2.3 박제 후보).
- doc-only enumerated-section subset 의 NEW-doc vs inline-amend bi-modal 박제를 별도 카테고리 승격 (§3.2.1 / §3.2.2 → §3.5 / §3.6) 검토 — 25 회차 milestone trigger 후보.
