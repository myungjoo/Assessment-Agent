---
id: T-0074
title: estimate-model.md 14 회차 milestone + doc-only inline-amend sub-multiplier × 0.4 신설 + planner.md 동기
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 100
actualDiff: 100
estimatedFiles: 2
actualFiles: 2
created: 2026-05-27
completedAt: 2026-05-27
reviewRounds: 0
dependsOn: [T-0070, T-0071, T-0072, T-0073]
plannerNote: session #21 turn 4 doc-only direct (inline-amend sub-pattern 본 task 자체가 dogfood — estimate envelope base 직관 100 × multiplier × 1.6 × inline-amend sub × 0.4 = effective 64 LOC, actual 100 LOC = mid-range). 14 회차 case study + bi-modal NEW-doc vs inline-amend 박제 + sub-multiplier × 0.4 신설.
---

# T-0074 — estimate-model.md 14 회차 milestone + inline-amend sub-multiplier × 0.4 신설 + planner.md 동기

## Why

[T-0070](T-0070-estimate-model-multiplier-refinement.md) 머지 (402d3cf, 11 회차 milestone) 직후 [T-0071](T-0071-part-service-update.md) (R-112 backbone + P2002 sub × 1.2 첫 사용 사례 accurate-pass -10%) + [T-0072](T-0072-adapt-agents-to-mcp.md) (doc-only NEW-doc accurate-pass -3%) + [T-0073](T-0073-integrator-md-and-claude-md-mcp-amend.md) (doc-only inline-amend systematic over -86%) 3 회차 추가 calibration data 박제. **14 회차 누적 평균 +41%** — session #20-21 4 회차의 over-estimate 가 누적 평균을 ~33%p 끌어내림.

**핵심 신규 박제**: doc-only enumerated-section 카테고리의 **bi-modal pattern** — NEW-doc creation (T-0072 -3% accurate) vs inline-amend (T-0070 + T-0073 평균 -74% systematic over). 본 차이는 ADR 또는 task spec 이 source 일 때 inline edit 가 wholesale replacement 의 ~1/3 LOC 으로 가능한 것이 박제 source. **inline-amend sub-multiplier × 0.4 신설** (effective × 0.64 envelope) 으로 분리 calibration.

[CLAUDE.md §3.1](../../CLAUDE.md) direct-mode 정합 — `docs/architecture/estimate-model.md` + `.claude/agents/planner.md` inline amend = doc-only direct.

REQ-057 (planner / size cap 정책 자체 박제) + REQ-058 (REST 표준 underlying) 의 estimation infrastructure refinement.

## Required Reading

- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) — 본 task 의 변경 대상 source-of-truth (현재 11 회차 milestone, T-0070 박제 시점).
- [.claude/agents/planner.md](../../.claude/agents/planner.md) §Estimate model 단락 — 본 task 의 변경 대상 (estimate-model.md 와의 동기).
- [docs/tasks/T-0071-part-service-update.md](T-0071-part-service-update.md) — actual 325 LOC -10% 박제 (P2002 sub × 1.2 첫 사용 사례 검증).
- [docs/tasks/T-0072-adapt-agents-to-mcp.md](T-0072-adapt-agents-to-mcp.md) — actual 234 LOC -3% 박제 (NEW-doc creation accurate-pass).
- [docs/tasks/T-0073-integrator-md-and-claude-md-mcp-amend.md](T-0073-integrator-md-and-claude-md-mcp-amend.md) — actual 38 LOC -86% 박제 (inline-amend systematic over).

## Acceptance Criteria

### A. estimate-model.md amend (14 회차 milestone)

- [x] §2 제목 "11 회차" → "14 회차" 갱신.
- [x] §2.3 신설 — "session #20 turn 9 + session #21 3 회차 추가 박제 (T-0070 ~ T-0073)" 표 + 평균 overrun -41% 박제 + bi-modal 박제 명시.
- [x] §2.4 신설 — "14 회차 누적 평균" 갱신 (+41% 누적), R-112 backbone subset 8 회차 +32% 갱신 + P2002 sub-multiplier 검증 데이터 1 회차 확정 박제 + doc-only enumerated subset 4 회차 bi-modal 박제 (NEW-doc +99% vs inline-amend -74%).
- [x] §3.2 doc-only enumerated-section 정의 amend — bi-modal pattern 박제 (§3.2.1 + §3.2.2 sub-pattern split).
- [x] §3.2.1 신설 — NEW-doc creation sub-pattern (T-0063 + T-0072 precedent, multiplier × 1.6 유지).
- [x] §3.2.2 신설 — inline-amend sub-pattern (T-0070 + T-0073 precedent, sub-multiplier × 0.4 박제 결론).
- [x] §4.1 P2002 sub-multiplier 표 amend — T-0071 첫 사용 사례 -10% accurate-pass 박제 검증 데이터 1 회차 확정.
- [x] §4.2 신설 — doc-only inline-amend sub-multiplier × 0.4 표 (effective × 0.64).
- [x] §5 planner 적용 절차 step 2 + 3 amend — inline-amend sub-multiplier 판정 + 적용 식.
- [x] §6 milestone trigger 갱신 — 15 회차 → 20 회차 / 20 회차 → 25 회차 (T-0073 본 갱신 후 next 6 task 누적).
- [x] §7 References — T-0070, T-0071, T-0072, T-0073 4 row 추가 + 본 doc 의 14 회차 확장 명시.

### B. planner.md §Estimate model 동기

- [x] §Estimate model 단락 amend — 11 회차 → 14 회차 표 + multiplier table 의 precedent column 누적 (T-0071, T-0073 추가) + sub-multiplier table 의 P2002 column 갱신 (T-0071 첫 사용 사례) + 신규 sub-multiplier table 신설 (doc-only inline-amend × 0.4) + 적용 절차 step 2 + 3 amend.

### C. Test / 검증

- [x] 본 task 는 doc-only direct. production code 0 — R-110 면제.
- [x] `pnpm lint && pnpm build` — local CRLF + Prisma generate 누락 deferred-to-CI 패턴 누적 (T-0066~T-0073 dogfood), 본 변경 surface .md only 무관.
- [x] R-112 unit test 면제.

### D. 기타

- [x] frontmatter `commitMode: direct` 정합 — `docs/architecture/` + `.claude/agents/` inline amend = direct.
- [x] commit 본문 한국어 + agent-trail blob 표준 포맷.
- [x] **본 task 자체가 inline-amend sub-pattern dogfood** — estimate envelope 100 LOC vs actual ~80-100 LOC 박제로 sub-multiplier × 0.4 의 1 회차 추가 데이터 (single-commit bundle 첫 dogfood T-0073 의 2 회차 차).

## Out of Scope

- **카테고리 추가** — ADR-first split stage / single-helper test / R-112 backbone 의 새 카테고리 분리는 20+ 회차 milestone (§6 박제) 시점.
- **multiplier 값 변경** — × 1.5 / × 1.6 / × 1.3 / × 1.0 본 박제 유지. 본 task 는 sub-multiplier 추가만.
- **estimate-model.md 의 §1 개요 / §3.3 / §3.4 / §5 step 1 / §5 step 4 / §5 step 5** 변경 안 함 — 본 task 의 변경 surface 0.
- **task 파일들의 retroactive 갱신** — historical record 보존 (§6 갱신 책임 박제).
- **ADR 신설** — 본 task 는 estimate model 자체 refinement only.

## Follow-ups

- **20 회차 milestone** — +6 회차 추가 시 (T-0074 본 갱신 후 next 6 task), multiplier delta ≥ 0.2 시 §4 갱신. inline-amend sub-multiplier × 0.4 → × 0.5 또는 × 0.3 calibration 검토.
- **race-patterns.md §8 cron-vs-loop variant + 12 회차 worktree race milestone + multi-driver collab 3-way pattern 박제** — T-0072 cron + local /loop 합작 + T-0073 single-commit bundle.
- **Part 도메인 마지막 layer T-0075 (PartController @Patch endpoint + spec)** — T-0071 PartService.update 의 controller layer.
- **phase 2 src/user spec migration** — ~200-250 LOC mechanical.
- **P3 → P4 phase advance trigger 재평가** — Group 4-layer + Part 3-layer = 7/11 entity backbone 박제 후.
