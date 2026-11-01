---
id: T-2079
title: 최근 N일 재수집 ⑪ — web 이 끝날 때까지 상태를 조회해 실제 결과를 받는다
phase: P7
status: DONE
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

- [x] 실행이 끝날 때까지 GET 을 반복하고 결과를 hook 상태로 올린다. 시간 상한은 없다 (실행 시간은 좌표 수에 비례).
- [x] 연속 조회 실패가 상한에 이르면 error 로 알리고 진행을 해제한다. 중간 성공은 실패 수를 초기화한다.
- [x] 실행 중이 아닌데 결과가 없으면 (서버 재시작) 확인할 수 없다고 알린다.
- [x] 재시작 시 직전 결과 · 오류를 비운다.
- [x] web test · build green, PR CI green.

## Out of Scope

- 패널 props 배선 · 인원 옵션 (T-2080).

## Follow-ups

- unmount 시 조회 미취소: `pollRefreshResult` 가 컴포넌트 unmount 뒤에도 계속 돈다 (Round 1 MINOR).
- 결과 재조회 경로: 조회 포기 뒤 화면에서 결과를 다시 받을 수 없다. 위 항목과 함께 다룬다 (Round 2 MINOR).
- 진행 해제 통합: `runReEvaluate` 의 해제 두 곳을 바깥 `try/finally` 하나로 합친다 (Round 2 NIT).
- T-2080 확인 사항: `reevalResult` · `reevalError` 에 인원 정보가 없고 인원을 바꿔도 비워지지 않는다. `AdminView.tsx` 의 "15 심볼" 주석도 함께 맞춘다.
- Round 3 은 executor inline 리뷰라 독립 리뷰가 아니다 (범위는 문구 +1/-1). squash commit trail 의 loc `+254/-35` 는 오기이고 실제는 `+253/-34` 다.
