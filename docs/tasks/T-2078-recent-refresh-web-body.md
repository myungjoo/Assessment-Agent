---
id: T-2078
title: 최근 N일 재수집 ⑩ — web 이 기간만 보낸다
phase: P7
status: READY
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 15
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2077]
touchesFiles: [web/src/views/adminScheduleRunners.ts, web/src/views/adminScheduleRunners.test.ts, web/src/views/AdminView.test.tsx, web/src/views/AdminView.recent-deletion-contract.test.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑩. 설계 결정은 T-2069
---

# T-2078 — web 본문

## Why

서버가 대상을 찾으므로 client 가 `instants` 를 보낼 이유가 없다. 이후 DTO 에서 제거할 수 있게 먼저 web 을 옮긴다.

## Acceptance Criteria

- [ ] POST 본문은 `{ days }` 뿐이고 계약 guard 가 이를 고정한다.
- [ ] web test · build green, PR CI green.

## Out of Scope

- 결과 조회 (T-2079), `instants` DTO 제거 (T-2081).
