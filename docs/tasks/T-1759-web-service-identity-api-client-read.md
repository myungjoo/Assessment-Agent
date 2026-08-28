---
id: T-1759
title: web ServiceIdentity API 클라이언트 읽기 축 신설 (GET 목록)
phase: P6
status: DONE
prNumber: 1387
completedAt: 2026-08-28T13:54:58Z
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: []
touchesFiles:
  - web/src/api/serviceIdentity.ts
  - web/src/api/serviceIdentity.test.ts
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) Admin UI 축의 첫 web slice: GET 목록 client 1 개만 절단 (패널 배선은 후속)"
---

# T-1759 — web ServiceIdentity API 클라이언트 읽기 축 신설 (GET 목록)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(R-182~R-183, REQ-078 · REQ-079)의 backend 축은
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` `(a)~(c)` ·
`(e)` chain (T-1739 ~ T-1758) 으로 모두 머지됐고, 남은 항목은 `(d) AdminView 편집 UI` 하나다.
그런데 현재 `web/src` 에는 ServiceIdentity 를 다루는 코드가 **0 건** 이라(`git grep identities --
web/src` 무결과) 패널을 그리기 전에 backend 5 route 를 호출할 client 계층이 먼저 필요하다.
본 slice 는 그 중 **읽기 축(GET 목록) 1 개** 만 절단한다 — `(d)` 전체(패널 컴포넌트 + 편집
동선 + AdminView 배선)를 한 commit 에 담으면 직전 web slice 실적상 300 LOC / 5 파일 cap 을
확실히 넘기 때문이다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1`(5 route) · `§Decision 4`(guard tier) · `§Decision 5`(오류 계약) · `§Follow-ups (d)`
- [docs/architecture/api.md](../architecture/api.md) `82 행` — `GET /api/persons/:personId/identities` 계약 정본(200 + raw `ServiceIdentity[]`, row 0 개면 빈 배열, Person 부재는 404)
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `request` / `ApiError` 시그니처와 credentials · 401 refresh 정책
- [web/src/api/auth.ts](../../web/src/api/auth.ts) — 얇은 per-resource helper 모듈의 선례(주석 헤더 · `ApiError` 흡수 분기 형태)
- [web/src/api/auth.test.ts](../../web/src/api/auth.test.ts) — 전역 `fetch` 를 `vi.fn` 으로 mock 하는 vitest 선례(파일명 `.test.ts` 고정 근거 포함)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `69`·`86 행` — controller path prefix 와 GET handler 의 실제 반환 형태

## Acceptance Criteria

- [ ] `web/src/api/serviceIdentity.ts` 신설 — 다음 3 가지만 export 한다.
  - [ ] `serviceIdentityCollectionPath(personId: string): string` — `/api/persons/<encodeURIComponent(personId)>/identities` 를 조립한다. path param 에 `/`·공백 등이 섞여도 경로가 깨지지 않도록 반드시 encode 한다.
  - [ ] `ServiceIdentityRow` 타입 — backend raw row 와 1:1 (`id` · `personId` · `service` · `externalId` · `isPrimary` 5 필드 필수, `createdAt` · `updatedAt` 은 optional `string`). 필드명·의미는 [prisma/schema.prisma](../../prisma/schema.prisma) `257~274 행` 및 api.md `82 행` 과 일치.
  - [ ] `fetchServiceIdentities(personId: string): Promise<ServiceIdentityRow[]>` — `apiClient.request` 에 GET 위임. 응답 가공(정렬 · 필터 · 복제)은 하지 않는다.
- [ ] `fetchServiceIdentities` 의 분기 계약을 코드 주석으로 명시하고 그대로 구현한다.
  - [ ] `personId` 가 빈 문자열 / 공백뿐이면 **네트워크 호출 없이** 빈 배열을 반환한다(선택 전 상태의 UI 가 `/api/persons//identities` 를 때리지 않도록).
  - [ ] 응답이 배열이 아니면(계약 위반 · 비 JSON 등) 빈 배열로 흡수한다.
  - [ ] `ApiError`(404 Person 부재 · 401 · 5xx 등)는 **흡수하지 않고 그대로 전파** 한다 — 오류 표면화는 후속 패널 slice 책임임을 주석에 박제.
- [ ] `web/src/api/serviceIdentity.test.ts` 신설 — 전역 `fetch` 를 mock 해 다음 R-112 4 종을 모두 덮는다.
  - [ ] happy-path: 2 row 200 응답이 그대로 반환되고(필드 5 종 일치), 호출된 URL 이 `/api/persons/p1/identities` 임을 단언.
  - [ ] error path: 404 · 500 응답 시 `ApiError` 가 status 를 보존한 채 전파되는지 각 1+ (`rejects.toThrow` 만이 아니라 `status` 단언), 네트워크 throw(`fetch` reject) 시 `ApiError(0)` 전파 1+.
  - [ ] 분기 cover: 빈/공백 `personId` 조기 반환 분기(`fetch` 호출 0 회 단언) · 비배열 응답 흡수 분기 · 정상 배열 분기 각 1+.
  - [ ] negative cases 충분 cover: 빈 배열 200(빈 결과 유지) · `null` 응답 · 객체(비배열) 응답 · `personId` 에 `/` 포함(encode 확인) · 공백만 있는 `personId` 각 1+.
- [ ] `pnpm --filter web test` 통과(신규 스위트 포함 전량 green).
- [ ] `pnpm --filter web build` 통과(`tsc --noEmit` 타입 검사 포함).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 변경 0 이라 회귀만 확인.
- [ ] 새 dependency 0 (`web/package.json` diff 0) — 브라우저 표준 `fetch` + 기존 `apiClient` 만 사용.

## Out of Scope

- 쓰기 축 client (POST 추가 · PATCH 수정 · DELETE 삭제 · POST primary 지정 4 route) — 후속 slice.
- `ServiceIdentityList` 등 React 컴포넌트 신설과 AdminView 마운트 · RBAC gating 배선.
- `useApiResource` 를 쓰는 hook 화, 로딩/에러 UI, 정렬(primary 우선) 표시 규칙.
- backend (`src/`) 코드 · `prisma/schema.prisma` · CI workflow · api.md · requirements.md · ADR-0058 완료 표기 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 쓰기 축 client 4 route (POST 추가 · PATCH 수정 · DELETE 삭제 · POST primary 지정) 신설 — ADR-0058 `§Follow-ups (d)` 의 두 번째 web slice.
- `ServiceIdentityList` 컴포넌트 신설 + AdminView 마운트 + RBAC gating 배선.
- 위 두 축 shipped 후 `docs/requirements.md` REQ-078 을 IN_PROGRESS -> DONE 으로 재판정 (UI 축 게이트 해소).
