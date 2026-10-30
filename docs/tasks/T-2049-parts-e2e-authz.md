---
id: T-2049
title: parts guard 실배선 후속 — parts.e2e-spec 인증·인가 단언 (무 cookie 401 · User mutation 403 · 변조 JWT · escalation)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 187
estimatedFiles: 1
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: [T-2048]
touchesFiles: [test/e2e/parts.e2e-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2049 — parts guard 실배선 후속 — parts.e2e-spec 인증·인가 단언 (무 cookie 401 · User mutation 403 · 변조 JWT · escalation)

## Why

T-2048 까지의 증거는 unit metadata 와 census 뿐이다. 실 `JwtAuthGuard` · `RolesGuard` 가 실 HTTP 요청을 실제로 거부한다는 end-to-end 증거를 닫는다. T-2040 동형이고 Q-0056 parts 축의 마지막 조각이다.

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts)

## Acceptance Criteria

- [ ] 변경 파일은 `test/e2e/parts.e2e-spec.ts` 1 개
- [ ] 무 cookie 401 × 6 route (실존 id, 부수효과 0)
- [ ] User token write 축 403 × 3 route (부수효과 0)
- [ ] 변조 JWT 401 × 2 (실 Admin token 변조)
- [ ] User + 빈 body POST → 403, 무 cookie + 부재 id → 401
- [ ] escalation: SuperAdmin POST 201 · Admin GET 200, 대조군 Admin PATCH 200
- [ ] 기존 11 test 단언 무변경
- [ ] `pnpm test:e2e` green (CI)

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- Q-0056 parts 축 완결. REQ-043 · 045 · 046 · 073 재판정은 arc 뒤 별 task 다.
