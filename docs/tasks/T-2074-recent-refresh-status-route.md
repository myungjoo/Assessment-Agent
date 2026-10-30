---
id: T-2074
title: 최근 N일 재수집 ⑥ — GET 상태 route 와 API 문서
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: c8965143
prNumber: 1635
reviewRounds: 3
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 70
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2073]
touchesFiles: [src/scheduling/recent-deletion.controller.ts, src/scheduling/recent-deletion.controller.spec.ts, web/src/views/AdminView.recent-deletion-contract.test.ts, test/e2e/schedules-recent-deletion.e2e-spec.ts, docs/architecture/api.md]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑥. 설계 결정은 T-2069
---

# T-2074 — GET 상태

## Why

POST 는 시작만 하고 돌아오므로 결과를 볼 경로가 필요하다. web 이 삭제 · 교체 · 미교체 건수를 표시할 근거다. 응답 shape 이 바뀐 POST 와 함께 `api.md` 를 고친다.

## Required Reading

- T-2069 "설계 결정", `src/scheduling/recent-deletion-runner.service.ts` 의 `refreshStatus`.

## Acceptance Criteria

- [ ] `GET /api/schedules/recent-deletion/:personId` 는 Admin+ 전용이고 `{ personId, running, result }` 를 돌려준다.
- [ ] User 403, 무인증 401.
- [ ] web 계약 guard 가 handler 2 개를 구분한다.
- [ ] `api.md` 의 POST 설명 · GET 행 · endpoint 합계가 맞다.
- [ ] `pnpm lint && pnpm build && pnpm test` · e2e green, PR CI green.

## Out of Scope

- 실 row 교체 e2e (T-2076), web 표시 (T-2077 이후).
