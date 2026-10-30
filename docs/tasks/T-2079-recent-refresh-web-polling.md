---
id: T-2079
title: 최근 N일 재수집 ⑪ — web 이 끝날 때까지 상태를 조회해 실제 결과를 받는다
phase: P7
status: READY
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 170
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2078]
touchesFiles: [web/src/views/adminScheduleRunners.ts, web/src/views/adminScheduleRunners.test.ts, web/src/views/useAdminSchedule.ts, web/src/views/useAdminSchedule.test.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑪. 설계 결정은 T-2069
---

# T-2079 — 결과 조회

## Why

POST 는 시작만 하므로 지금 web 은 실행이 끝났는지, 몇 건이 바뀌었는지 모른다.

## Acceptance Criteria

- [ ] 실행이 끝날 때까지 GET 을 반복하고 결과를 hook 상태로 올린다. 시간 상한은 없다 (실행 시간은 좌표 수에 비례).
- [ ] 연속 조회 실패가 상한에 이르면 error 로 알리고 진행을 해제한다. 중간 성공은 실패 수를 초기화한다.
- [ ] 실행 중이 아닌데 결과가 없으면 (서버 재시작) 확인할 수 없다고 알린다.
- [ ] 재시작 시 직전 결과 · 오류를 비운다.
- [ ] web test · build green, PR CI green.

## Out of Scope

- 패널 props 배선 · 인원 옵션 (T-2080).
