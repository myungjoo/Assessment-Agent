---
id: T-2054
title: 불완전 수집 저장 차단 ⑤ — run status 마지막 평가 실행 요약 구현
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: fd018aec
prNumber: 1615
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-083]
estimatedDiff: 180
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2053]
touchesFiles: [src/run-status/run-status.service.ts, src/run-status/run-status.service.spec.ts, src/run-status/run-status.controller.spec.ts, src/app.module.spec.ts, test/e2e/run-status.e2e-spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ⑤ — ADR-0060 §Decision 6 구현
---

# T-2054 — 마지막 평가 실행 요약 구현

## Why

[T-2053](T-2053-run-status-adr.md) 의 계약을 구현한다.

## Required Reading

- `docs/decisions/ADR-0060-evaluation-run-status-endpoint.md` §Decision 6, `src/run-status/run-status.service.ts`.

## Acceptance Criteria

- [ ] `snapshot()` 에 `lastEvaluationRun` (객체 또는 `null`) 을 더한다. `recordEvaluationRun` 이 직전 요약을 덮어쓴다.
- [ ] 좌표는 중복 제거 · 첫 등장 순서 · 50 개까지이고 전체 수와 인원 수를 따로 알린다. `personId` 는 응답에 없다.
- [ ] 기존 필드 · 불변식 · `begin` / `end` 는 그대로다. Prisma schema 변경 0.
- [ ] 키 집합을 고정한 기존 spec (`run-status.controller.spec` · `app.module.spec` · `run-status.e2e-spec`) 을 갱신한다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- runner · controller 의 호출 — T-2056.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) T-2056 이 `evaluation-tick-runner.service.ts` · `assessment-evaluation.controller.ts` 에서 소비한다. 함께 넣으면 그 2 파일과 spec 2 개를 더해 estimatedFiles 9 로 cap 을 넘는다.
