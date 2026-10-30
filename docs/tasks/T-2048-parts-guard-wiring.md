---
id: T-2048
title: parts guard 실배선 — PartController read 3 User+ · write 3 Admin+ + census known-gap 0
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 272
estimatedFiles: 4
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: [T-2044, T-2045, T-2046, T-2047]
touchesFiles: [src/user/part.controller.ts, src/user/part.controller.spec.ts, test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts, docs/architecture/api.md]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2048 — parts guard 실배선 — PartController read 3 User+ · write 3 Admin+ + census known-gap 0

## Why

오너 승인 HQ Q-0056 (옵션 ①) 의 마지막 controller 다. `PartController` 6 route 는 무인증으로 읽기 · 쓰기가 열려 있다. 등급은 api.md 표를 따른다 — `GET /api/parts` User+, POST · PATCH · DELETE Admin+. 표에 없던 `:id` · `:id/persons` 는 groups 선례의 "모든 GET = User+" 관례로 판정하고 그 행 2 개를 api.md 에 함께 추가한다 (합계 86 → 88, shipped 81 → 83). 소비처 선행 T-2044 ~ T-2047 은 머지 완료.

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [src/user/part.controller.ts](../../src/user/part.controller.ts)
- [src/user/part.controller.spec.ts](../../src/user/part.controller.spec.ts)
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts)
- [docs/architecture/api.md](../../docs/architecture/api.md)

## Acceptance Criteria

- [ ] read 3 route: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`
- [ ] write 3 route: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`
- [ ] happy: 등급별 통과 (read User · Admin · SuperAdmin / write Admin · SuperAdmin)
- [ ] error: guard 거부 401 · 403 시 service 0 회 호출
- [ ] negative: User 의 write 403, 클래스 레벨 guard 0
- [ ] census `KNOWN_GAP_REQ_043` 0 건 · `MIN.guarded` 84
- [ ] api.md 에 `GET /api/parts/:id` · `:id/persons` User+ 행 추가, 합계 86 → 88 · shipped 81 → 83 동기
- [ ] `pnpm lint && pnpm build && pnpm test` green
- [ ] `pnpm test:e2e` · `pnpm test:smoke` · `pnpm test:perf` · `pnpm test:cov` green (CI)

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- e2e 인가 단언 T-2049. groups 의 같은 tier 행 2 개 누락은 별 건으로 남는다. REQ-043 · 045 · 046 · 073 재판정은 arc 뒤 별 task 다.
