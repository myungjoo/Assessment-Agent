---
id: T-2044
title: parts guard 선행 ① — parts e2e · smoke 요청 전부에 tier 인증 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 153
estimatedFiles: 2
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: []
touchesFiles: [test/e2e/parts.e2e-spec.ts, test/smoke/parts.smoke-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2044 — parts guard 선행 ① — parts e2e · smoke 요청 전부에 tier 인증 cookie 선탑재

## Why

Q-0056 마지막 축인 parts 의 guard 를 붙이면 cookie 없는 기존 e2e 11 곳 · smoke 10 곳이 401 로 깨진다. groups 축 T-2031 과 같은 선행이다. pre-check: `src/user/part.controller.ts` 에 `UseGuards` · `Roles` 0 hit, `test/e2e/parts.e2e-spec.ts` · `test/smoke/parts.smoke-spec.ts` 에 cookie 0 hit (`origin/main` `6a8ea774`).

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts)
- [test/smoke/parts.smoke-spec.ts](../../test/smoke/parts.smoke-spec.ts)

## Acceptance Criteria

- [ ] 변경 파일은 `test/e2e/parts.e2e-spec.ts` · `test/smoke/parts.smoke-spec.ts` 2 개
- [ ] e2e 11 곳 · smoke 10 곳 전부 tier cookie 부착 (GET = User, 그 외 = Admin)
- [ ] `afterEach` truncate → `reseedAuthenticatedActors` 순서 고정
- [ ] 기존 test 단언 무변경
- [ ] `pnpm test:e2e` · `pnpm test:smoke` green (CI)

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- 다음 slice: web cookie 계약 (T-2045) → perf (T-2046) → k6 (T-2047) → guard 배선 (T-2048) → e2e 인가 단언 (T-2049).
