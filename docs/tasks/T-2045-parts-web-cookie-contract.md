---
id: T-2045
title: parts guard 선행 ② — useAdminParts 5 발사의 web 인증 cookie 전송 계약 test
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 169
estimatedFiles: 1
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: []
touchesFiles: [web/src/views/useAdminParts.auth-cookie.test.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2045 — parts guard 선행 ② — useAdminParts 5 발사의 web 인증 cookie 전송 계약 test

## Why

Q-0056 `decision` 의 조건이다 — 각 slice 는 web 측이 인증 cookie 를 실제로 보내 guard 배선 뒤에도 401 로 깨지지 않음을 test 로 박제해야 한다. 파트 축 발사는 `useAdminParts` 5 지점뿐이고 (AdminView 파트 섹션 전용, 다른 화면의 파트 호출 0), 전부 `apiClient` 경유다. 비-admin 도 AdminView 에 도달하면 read 는 User+ 라 그대로 동작하고, mutation 은 403 이 화면 error 로 보인다.

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [web/src/views/useAdminParts.auth-cookie.test.ts](../../web/src/views/useAdminParts.auth-cookie.test.ts)

## Acceptance Criteria

- [ ] 변경 파일은 `web/src/views/useAdminParts.auth-cookie.test.ts` 1 개
- [ ] happy: 목록 GET · 소속 인원 GET · POST · PATCH · DELETE 전부 same-origin
- [ ] 분기: 미선택 시 소속 인원 미조회, PATCH 401 → refresh → retry
- [ ] error: GET 401 → refresh 401 이면 error 상태
- [ ] negative: POST 403 · DELETE 네트워크 실패 · credentials 덮어쓰기 불가 · 빈 id 미발사

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- 없음.
