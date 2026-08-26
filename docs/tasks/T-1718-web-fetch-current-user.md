---
id: T-1718
title: web 인증 사용자 등급 조회 helper fetchCurrentUser 신설 (REQ-073 slice 1)
phase: P6
status: DONE
completedAt: 2026-08-26T11:53:34Z
prNumber: 1349
mergeCommit: 0519d8ca
commitMode: pr
coversReq: [REQ-073, REQ-070]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-26
independentStream: evaluation-target-ui
dependsOn: []
touchesFiles:
  - web/src/api/auth.ts
  - web/src/api/auth.test.ts
plannerNote: P6 오너 지시(PLAN 130 행 🔴) 분해 slice 2 — RBAC 노출 차등(REQ-073)의 전제인 web 측 role 정보원이 부재해 먼저 연다.
---

# T-1718 — web 인증 사용자 등급 조회 helper fetchCurrentUser 신설 (REQ-073 slice 1)

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `130 행` 🔴 (평가 대상 추가·편집 인터페이스, REQ-070~REQ-073) 분해 slice 2. slice 1([T-1717](T-1717-appshell-authed-view-nav.md))이 인증 후 대시보드↔관리 화면 전환 동선을 박제해 AdminView 도달 불가 상태를 해소했으나, 그 내비게이션과 관리 화면은 **현재 모든 인증 사용자에게 동일하게 노출**된다. REQ-073 ([requirements.md](../requirements.md) `92 행`) 은 "평가 대상 편집은 Admin 등급만, User 등급은 조회만" 을 요구하는데, web 코드베이스에는 **현재 로그인한 사용자의 등급(role)을 알아낼 경로가 전혀 없다** — `web/src/api/auth.ts` 는 `login` · `refresh` · `signup` · `signupDetailed` 4 종만 노출하고, 같은 파일 `47 행` 주석이 `GET /api/auth/me` 부트 hydration 을 명시적으로 Out of Scope 로 남겨 뒀다.

backend 는 이미 준비돼 있다 — `GET /api/auth/me`([src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) `@Get("me")`, T-0106)가 `JwtAuthGuard` 단독으로 `UserResponseDto`(`id` · `email` · `role` · `createdAt` · `updatedAt` 5 필드, `hashedPassword` 구조적 차단)를 반환하고 [api.md](../architecture/api.md) `72 행` 이 그 계약의 정본이다. 본 slice 는 그 shipped 계약을 소비하는 **web 측 순수 api helper 1 개** 만 연다. 실제 노출 차등(nav 항목 · AdminView 패널 gating)은 이 정보원 위에서 후속 slice 가 배선한다 — 정보원과 소비를 한 task 에 합치면 cap(≤ 300 LOC / 5 파일)을 넘고 검증 축도 섞이기 때문에 분리한다.

## Required Reading

- [web/src/api/auth.ts](../../web/src/api/auth.ts) — 본 task 의 수정 대상. 기존 4 helper 의 서술 · 에러 흡수 정책 · `export { ... }` 마지막 줄 형식을 그대로 승계한다.
- [web/src/api/auth.test.ts](../../web/src/api/auth.test.ts) — colocated spec. 기존 `describe` 구성 · `globalThis.fetch` mock 방식 · `ApiError` 단언 패턴을 그대로 따른다.
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `request<T>(path, init)` 시그니처 · `ApiError`(`status` · `message` = 비-2xx body 원문) · 401 시 refresh 후 1 회 재시도(`fetchWithRefresh`) 동작.
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) `@Get("me")` — 응답 계약(200 `UserResponseDto` / 401 인증 실패 / 404 stale token).
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — 응답 5 필드(`id` · `email` · `role` · `createdAt` · `updatedAt`).
- [docs/architecture/api.md](../architecture/api.md) `72 행` — `/api/auth/me` row (정본, 본 task 에서 수정하지 않는다).

## Acceptance Criteria

- [ ] `web/src/api/auth.ts` 에 named export `fetchCurrentUser(): Promise<CurrentUser | null>` 와 `type CurrentUser` 를 추가한다. `CurrentUser` 는 `{ id: string; email: string; role: string }` 3 필드만 담는다(`createdAt` · `updatedAt` 는 web 소비처가 없으므로 계약에서 제외).
- [ ] 성공(2xx) 경로: `request<...>('/api/auth/me')`(GET, 기본 method) 응답 body 의 `id` · `email` · `role` **셋이 모두 문자열일 때만** `CurrentUser` 를 반환한다. 하나라도 누락/비문자열이면 `null` 을 반환한다(사유를 지어내지 않는 안전 분기 — `signupDetailed` 의 `role` 문자열 검사 선례 승계).
- [ ] 401 경로: `ApiError.status === 401` 이면 throw 하지 않고 `null` 을 반환한다(미인증 = 등급 없음. `refresh` helper 의 401 흡수 정책 mirror).
- [ ] 404 경로: `ApiError.status === 404`(stale token — 유효 서명이지만 DB row 삭제됨)도 `null` 을 반환한다.
- [ ] 그 외 에러(5xx · 네트워크 status 0 등)는 **흡수하지 않고 그대로 전파**한다 — 호출측이 표면 에러로 외화할 수 있어야 한다.
- [ ] 파일 마지막 줄의 `export { login, refresh, signup, signupDetailed };` 와 `export type { SignupResult };` 에 새 심볼을 알파벳 순으로 합류시킨다(기존 심볼 이름 · 시그니처 · 동작은 **무수정**).
- [ ] R-112 happy-path: `fetchCurrentUser` 가 200 + 3 필드 정상 body 에서 `{ id, email, role }` 을 그대로 반환하고, 요청이 `/api/auth/me` 로 정확히 1 회 발사되는지 검증하는 test 1+.
- [ ] R-112 error path: 5xx(예: 500) 에서 `ApiError` 가 전파돼 `await expect(...).rejects` 로 잡히는 test 1+.
- [ ] R-112 분기 cover: (a) 200 정상 → 객체, (b) 200 + 필드 결손 → `null`, (c) 401 → `null`, (d) 404 → `null`, (e) 그 외 status → throw. 5 분기 각 1+ test.
- [ ] R-112 negative 충분 cover — 각 1+ test: ① `role` 누락, ② `role` 이 비문자열(예: `42` · `null`), ③ body 자체가 `null`, ④ body 가 배열/문자열 등 비객체, ⑤ 401 에서 `null` 반환 시 **throw 하지 않음**, ⑥ 5xx 흡수 금지(반환값 `null` 이 아니라 throw).
- [ ] 기존 `login` · `refresh` · `signup` · `signupDetailed` 관련 test 는 **한 개도 수정하지 않고** 전부 green.
- [ ] `pnpm --dir web lint` · `pnpm --dir web build` · `pnpm --dir web test` 3 종 green (web 쪽은 `coverageThreshold` 미도입 상태 — PLAN 127 행 게이트된 backlog. 따라서 root `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 기준은 `src/` 무변경으로 자동 무회귀이며, 본 task 는 root `pnpm test:cov` 도 함께 돌려 회귀 0 을 확인한다).
- [ ] 새 dependency 0 · `src/` diff 0 파일 · `web/src/AppShell.tsx` · `web/src/views/AdminView.tsx` diff 0 파일.

## Out of Scope

- **nav 항목 · AdminView 패널의 실제 role 기반 노출 차등** — 본 task 는 정보원만 연다. 소비 배선은 후속 slice.
- `AppShell` / `AuthGate` 의 부트 hydration(로그인 성공 후 `fetchCurrentUser` 호출 · state 보관) — 후속 slice.
- backend 변경 일체 — `GET /api/auth/me` 는 이미 shipped 이므로 `src/` 는 읽기만.
- `docs/architecture/api.md` · `docs/requirements.md` 의 REQ-073 status 갱신 — 실 노출 차등이 배선된 뒤 별도 `direct` doc task.
- `createdAt` / `updatedAt` 를 `CurrentUser` 에 포함시키기 — 소비처 0.
- `web/package.json` 에 `@vitest/coverage-v8` 도입(새 dependency, §5 게이트 — PLAN 127 행).
- e2e spec 추가(`test/e2e/`) — REQ-073 의 e2e 축은 노출 차등 배선 후 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-26)

- PR [#1349](https://github.com/myungjoo/Assessment-Agent/pull/1349) round 1 reviewer APPROVE → 4-게이트 PASS → squash merge `0519d8ca` + branch delete.
- 변경 2 파일 `+178/-3` — `web/src/api/auth.ts` 에 `fetchCurrentUser` + `type CurrentUser` named export 추가(알파벳 순 합류), 기존 `login`·`refresh`·`signup`·`signupDetailed` 무수정. `src/`·`AppShell.tsx`·`AdminView.tsx`·`package.json` diff 0 파일.
- R-112 4 종 cover — happy 1 · error path 1 · 분기 5(200 정상 / 필드 결손 / 401 / 404 / 그 외 status) · negative 6(role 누락 · 비문자열 · null body · 비객체 · 401 무-throw · 5xx 흡수 금지), spec 13 케이스. web 2180 test + root 13009 test · lint · build green.
- 후속: 본 정보원 위에 nav 항목·AdminView 패널 RBAC gating 을 배선하는 slice 가 REQ-073 을 닫는다.
