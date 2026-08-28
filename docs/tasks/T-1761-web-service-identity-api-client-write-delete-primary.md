---
id: T-1761
title: web ServiceIdentity API 클라이언트 쓰기 축 2/2 신설 (DELETE 삭제 · primary 지정)
phase: P6
status: DONE
prNumber: 1389
completed: 2026-08-28
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: [T-1760]
touchesFiles:
  - web/src/api/serviceIdentity.ts
  - web/src/api/serviceIdentity.test.ts
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 세 번째 web slice: 쓰기 잔여 2 route(DELETE·primary) 로 client 계층 마감"
---

# T-1761 — web ServiceIdentity API 클라이언트 쓰기 축 2/2 신설 (DELETE 삭제 · primary 지정)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(REQ-078 · REQ-079)의 backend 축은 T-1739 ~ T-1758 로 전부
머지됐고, [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` 잔여는
`(d) AdminView 편집 UI` 하나다. 그 전제 계층인 client 는 [T-1759](T-1759-web-service-identity-api-client-read.md)
(읽기 축 GET 목록) 와 [T-1760](T-1760-web-service-identity-api-client-write-create-update.md)
(쓰기 축 1/2 — POST 생성 · PATCH 수정) 로 5 route 중 3 개가 열렸고, 남은 것은 `DELETE` 삭제와
primary 지정 action POST 2 개다. 본 slice 가 그 2 개를 덮어 **client 계층을 마감**하면 후속 slice 는
`ServiceIdentityList` 패널 컴포넌트 + AdminView 배선(`(d)` 본체)만 남는다. 패널 신설까지 한 commit 에
담으면 300 LOC 상한을 확실히 넘으므로 client 잔여 2 route 만 절단한다.

## Required Reading

- [web/src/api/serviceIdentity.ts](../../web/src/api/serviceIdentity.ts) — 본 slice 가 확장할 파일. `ServiceIdentityRow` · `serviceIdentityItemPath` · 쓰기 공통 helper `assertPathParam`(빈/공백 param → 호출 없이 `ApiError(0)`) · `asRow`(비객체 응답 정상화) 를 **재사용** 한다(복제 금지). 파일 머리 주석 `5 행` 의 "남은 쓰기 2 route ... 후속 slice" 문구도 본 slice 가 사실과 맞게 갱신 대상
- [web/src/api/serviceIdentity.test.ts](../../web/src/api/serviceIdentity.test.ts) — `mockResponse` helper · 전역 `fetch` mock 골격 (신규 케이스도 이 골격을 재사용)
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `104~129 행` — `request<T>`(body 파싱) 과 `requestRaw`(2xx 시 body 미소비 raw `Response`) 의 차이, `ApiError`(비-2xx → status 보존, 네트워크 → status 0) 변환 정책
- [docs/architecture/api.md](../architecture/api.md) `85`·`86 행` — `DELETE /api/persons/:personId/identities/:identityId`(204 No Content, body 없음, 삭제 후 primary 자동 재승격은 backend 책임, 404 3 단) · `POST /api/persons/:personId/identities/:identityId/primary`(body 없음, `@HttpCode(200)` + 승격 row, idempotent, 404 3 단) 계약 정본
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `127`·`151 행` 부근 — 두 route 의 실제 decorator(`@Delete(":identityId")` + `@HttpCode(204)`, `@Post(":identityId/primary")` + `@HttpCode(200)`) 확인용

## Acceptance Criteria

- [ ] `web/src/api/serviceIdentity.ts` 확장 — 기존 export 는 시그니처 · 동작 그대로 두고 다음 2 개를 추가 export 한다.
  - [ ] `deleteServiceIdentity(personId: string, identityId: string): Promise<void>` — `DELETE` + `serviceIdentityItemPath`. 응답이 204 No Content 라 **body 를 파싱하지 않는다** — `request` 대신 `requestRaw` 를 써서 빈 body 를 의미 없는 문자열로 반환하지 않고 `void` 로 마감하며, 그 근거를 주석에 박제한다.
  - [ ] `setPrimaryServiceIdentity(personId: string, identityId: string): Promise<ServiceIdentityRow>` — `POST ${serviceIdentityItemPath(...)}/primary`. **body 를 보내지 않는다**(대상은 path param 2 개로 완전 지정, api.md `86 행`) — `Content-Type` 헤더와 `body` 옵션 모두 붙이지 않는다. 응답 200 + 승격 row 를 `asRow` 로 정상화해 반환한다.
- [ ] 두 함수의 분기 계약을 주석으로 명시하고 그대로 구현한다.
  - [ ] `personId` · `identityId` 중 하나라도 빈 문자열 / 공백뿐이면 **네트워크 호출 없이** `ApiError(0)` — 기존 `assertPathParam` 재사용(쓰기 축 정책 승계, 읽기 축의 빈 배열 조기 반환과 다름).
  - [ ] backend 오류(`404` 3 단 — Person 부재 · 타 Person 소유 · `P2025`, `401`, `5xx`, 네트워크)는 흡수하지 않고 `ApiError` 그대로 전파 — 사용자 표면화는 후속 패널 slice 책임임을 주석에 박제.
  - [ ] `setPrimaryServiceIdentity` 는 이미 primary 인 row 에 재요청해도 같은 결과를 돌려주는 idempotent 임을 주석에 명시(backend `$transaction` 책임 — client 는 중복 호출 방지 로직을 두지 않는다).
- [ ] 파일 머리 주석 `5 행` 의 "남은 쓰기 2 route(DELETE 삭제 · POST primary 지정)는 후속 slice" 를 **5 route 전량 client 완결 + 잔여는 패널 컴포넌트 · AdminView 배선** 기준으로 갱신한다(stale drift 방지).
- [ ] `web/src/api/serviceIdentity.test.ts` 확장 — 전역 `fetch` mock 위에서 R-112 4 종을 모두 덮는다(기존 읽기 · 쓰기 1/2 케이스는 그대로 유지, 회귀 0).
  - [ ] happy-path: `deleteServiceIdentity` 204 응답에서 `undefined` resolve + 호출 URL `/api/persons/p1/identities/i1` · `method === 'DELETE'` · **`body` 미전송** 단언. `setPrimaryServiceIdentity` 200 응답 row 반환 + URL `/api/persons/p1/identities/i1/primary` · `method === 'POST'` · **`body` 미전송** 단언.
  - [ ] error path: delete 의 `404`(Person 부재) · `404`(타 Person 소유) 와 primary 의 `404` · `500` 을 `ApiError` 로 잡아 **`status` 값까지 단언**. 네트워크 throw 시 `ApiError(0)` 전파 각 1+.
  - [ ] 분기 cover: 빈/공백 `personId` 조기 오류 분기(`fetch` 호출 0 회 단언) · 빈/공백 `identityId` 조기 오류 분기 · primary 의 비객체 응답(`null` · 배열 · 문자열) 정상화 분기 · 정상 응답 분기 각 1+. delete 는 204 body 미파싱 분기를 `response.json` 미호출(또는 빈 body 로도 성공) 로 단언.
  - [ ] negative cases 충분 cover: `personId` 에 `/` 포함 시 encode 확인 · `identityId` 에 `/` 포함 시 encode 확인(primary path 는 encode 된 id 뒤에 `/primary` 가 붙는지까지) · `401` 전파 · `409` 등 예기치 못한 status 도 흡수 없이 전파 · delete 재요청 404 전파 각 1+.
  - [ ] 기존 3 함수(`fetchServiceIdentities` · `createServiceIdentity` · `updateServiceIdentity`) 회귀 게이트 1+ — 신규 helper 재사용이 기존 계약을 바꾸지 않았음을 단언.
- [ ] `pnpm --filter web test` 통과(신규 케이스 포함 전량 green).
- [ ] `pnpm --filter web build` 통과(`tsc --noEmit` 타입 검사 포함).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 변경 0 이라 회귀만 확인.
- [ ] 새 dependency 0 (`web/package.json` diff 0) — 브라우저 표준 `fetch` + 기존 `apiClient` 만 사용.

## Out of Scope

- `ServiceIdentityList` 등 React 컴포넌트 신설 · AdminView 마운트 · RBAC gating 배선 · 로딩/에러 UI — `(d)` 본체는 후속 slice.
- `useApiResource` 기반 hook 화, 낙관적 갱신, 삭제 후 목록 재조회 정책, 삭제 확인 dialog.
- 기존 `fetchServiceIdentities` · `createServiceIdentity` · `updateServiceIdentity` 의 동작 · 시그니처 변경.
- backend (`src/`) 코드 · `prisma/schema.prisma` · e2e · CI workflow 변경.
- `docs/architecture/api.md` · `docs/requirements.md` REQ-078 재판정 · ADR-0058 `§Follow-ups` 완료 표기 — UI 축이 shipped 된 뒤 별도 doc slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

---

## 결과 (2026-08-28 완료)

- **DONE** — PR [#1389](https://github.com/myungjoo/Assessment-Agent/pull/1389) squash 머지 → main `86b1759a`. 2 파일 +294/-6.
- `deleteServiceIdentity`(204 무 body → `requestRaw` 로 파서 미호출 · void 마감) · `setPrimaryServiceIdentity`(body/Content-Type 미전송 · `asRow` 정상화 · idempotent) 추가로 ServiceIdentity client 5 route 마감. `assertPathParam` · `asRow` · `serviceIdentityItemPath` 재사용으로 복제 0, 새 dependency 0.
- 신규 24 케이스로 R-112 4 종 전부 cover + 기존 3 함수 회귀 게이트 2. web 84 파일 2597 test + 루트 458 스위트 13208 test green(line/function ≥ 80% 유지).
- reviewer round 1 APPROVE → 남은 Nit 을 CLAUDE.md §3 Nit-in-PR closure 로 round 2 에서 닫고 재-APPROVE, 4-게이트 PASS 후 머지.
