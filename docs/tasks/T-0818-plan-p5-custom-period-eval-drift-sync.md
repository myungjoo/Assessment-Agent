---
id: T-0818
title: PLAN.md P5 사용자 지정 기간 임의 평가문(R-9) bullet implemented-on-main checkbox 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-009]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-sync
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5 line98 R-9 사용자 지정 기간 평가문 bullet — period-bridge Admin/User 경로 전량 shipped-on-main, T-0812~0817 drift 패턴 mirror, direct doc-only
---

# T-0818 — PLAN.md P5 사용자 지정 기간 임의 평가문(R-9) bullet implemented-on-main checkbox 정합

## Why

`docs/PLAN.md` Phase P5 의 line 98 bullet "**사용자 지정 기간** 임의 평가문 생성 (R-9) — Admin/User 가 임의 기간을 지정해 LLM 평가문 요청" 이 아직 `[ ]` (미완) 로 남아 있으나, 실제 origin/main 에는 해당 기능 (period→collect→evaluate bridge 의 Admin full-persist 경로 + User self-only ephemeral 경로) 이 전량 shipped 되어 있다. STATE.phase 는 이미 `P4-complete / P5-in-progress` 인데 이 bullet 만 stale drift 로 남았다 — T-0812~0817 이 P3/P4/P5 다른 bullet 에 적용한 것과 동일한 checkbox 정합 패턴을 이 bullet 에 mirror 한다. README R-9 / REQ-009 를 cover 하는 진행상황 문서 정합.

## Required Reading

- `docs/PLAN.md` (Phase P5 섹션, line 98 bullet 및 인접 line 96~100 만 — 광범위 read 금지)
- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` (§Decision 1~5 status=ACCEPTED 확인용 — 앞 header 부분만)

## Acceptance Criteria

- [ ] `docs/PLAN.md` Phase P5 의 line 98 bullet checkbox 를 `- [ ]` → `- [x]` 로 변경.
- [ ] 같은 bullet 에 `**implemented-on-main**:` 근거 절을 append — 다음 shipped 경로를 명시 (경로는 origin/main 에서 grep/ls 로 실존 재확인한 것만 박제):
  - Admin full-persist 경로: [`period-bridge-admin-persist.service.ts`](../src/assessment-evaluation/period-bridge-admin-persist.service.ts) (`generateAndPersist`, first-write-wins read-through + reevaluate 분기) — ADR-0037 §Decision1/2/3 + ADR-0038.
  - User self-only ephemeral 경로: [`period-bridge-ephemeral.service.ts`](../src/assessment-evaluation/period-bridge-ephemeral.service.ts) (collect(in-memory)→evaluate→return, DB write 0) — ADR-0037 §Decision1.
  - controller endpoint: [`assessment-evaluation.controller.ts`](../src/assessment-evaluation/assessment-evaluation.controller.ts) `@Post("period")` 의 role dispatch (`isAdminRole` → persistForAdmin / else ephemeralForUser) + reevaluate fail-closed.
  - e2e: `test/e2e/period-bridge-admin-persist.e2e-spec.ts` + `period-bridge-ephemeral.e2e-spec.ts` + `period-bridge-reevaluate.e2e-spec.ts`.
  - canonical ADR = [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) (ACCEPTED, §Decision 1~5 전량 resolve).
- [ ] append 시 인접 bullet (line 97 요약 평가 / line 100 재수집 정책) 을 손상시키지 않는다 (append-only, 국소 diff).
- [ ] 변경 전 append 하려는 각 경로/symbol 이 origin/main 에 실존하는지 grep/ls-tree 로 재확인 (false-positive flip 0). 이미 위 Required Reading 단계에서 planner 가 실존 재확인함 — executor 는 spot-check 1회 재확인.
- [ ] 최종 diff 는 line 98 국한 (+1/-1 수준, 근거 절 append 로 line 길이만 증가). 다른 line 미변경.

## Out of Scope

- 코드 변경 0 — `src/` / `test/` / `prisma/` 어떤 파일도 건드리지 않는다 (본 task 는 순수 doc-sync).
- line 106 (R-64 재실행·부분 reset, 의도적 `[ ]` 유지) / line 110~111 (🔴 live-LLM bridge · 🟢 실 github e2e, owner-gated) bullet 은 건드리지 않는다 — 각기 별도 task 책임.
- STATE.json 의 concurrencyIncidents reenableNote 갱신 (lock-acquire claims.json fix "미머지" prose stale) — 별도 STATE-sync follow-up 으로 분리 권장 (아래 Follow-ups).
- 새 ADR 작성 / ADR status 변경 없음.

## Suggested Sub-agents

`implementer` (doc-only edit — architect/tester 불요, direct doc-only commit).

## Follow-ups

- (planner 발견, 미착수) STATE.json `concurrencyIncidents.reenableNote` / `note` 의 "근본 원인(lock-acquire 경로 claims.json 미보존) fix 아직 미머지" prose 는 stale 이다 — fix-1(`scripts/acquire-lock.sh` claims.json 보존, T-0673 PR #589) + fix-2(`scripts/lib-lock-tree.sh` acquire/select 단일화, T-0674 PR #590) + prNumber-sync(`scripts/sync-claim-pr.sh`, T-0732 PR #648) 이 모두 origin/main 에 머지 완료됨. reenableNote 의 "미머지 → 재발 risk" 서술을 "fix 머지됨 → risk 해소" 로 갱신하는 STATE-sync direct task 를 planner 가 후속 큐잉 권장 (본 task 와 별도 — STATE writer 경로).
