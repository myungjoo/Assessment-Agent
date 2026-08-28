---
id: T-1760
title: web ServiceIdentity API 클라이언트 쓰기 축 1/2 신설 (POST 추가 · PATCH 수정)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: [T-1759]
touchesFiles:
  - web/src/api/serviceIdentity.ts
  - web/src/api/serviceIdentity.test.ts
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 두 번째 web slice: 쓰기 4 route 중 생성·수정 2 개만 절단 (삭제·primary 는 후속)"
---

# T-1760 — web ServiceIdentity API 클라이언트 쓰기 축 1/2 신설 (POST 추가 · PATCH 수정)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(R-182~R-183, REQ-078 · REQ-079)의 backend 축은 T-1739 ~ T-1758 로
전부 머지됐고, [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` 잔여는
`(d) AdminView 편집 UI` 하나다. 그 전제 계층인 client 는 [T-1759](T-1759-web-service-identity-api-client-read.md)
가 읽기 축(GET 목록) 1 개만 열어둔 상태라, 편집 패널을 그리려면 쓰기 4 route (POST 추가 · PATCH 수정 ·
DELETE 삭제 · POST primary 지정) 가 필요하다. 4 개를 한 commit 에 담으면 직전 slice 실적(1 route 에 client
77 LOC + spec 202 LOC)상 300 LOC 상한을 확실히 넘기므로, 본 slice 는 **생성 · 수정 2 route** 만 절단한다.
삭제 · primary 지정 2 route 는 후속 slice 몫이다.

## Required Reading

- [web/src/api/serviceIdentity.ts](../../web/src/api/serviceIdentity.ts) — 본 slice 가 확장할 파일. `ServiceIdentityRow` 타입 · `serviceIdentityCollectionPath` · `fetchServiceIdentities` 의 기존 계약과 주석 관례
- [web/src/api/serviceIdentity.test.ts](../../web/src/api/serviceIdentity.test.ts) — `mockResponse` helper · 전역 `fetch` mock 골격 (본 slice 의 신규 케이스도 이 골격을 재사용)
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `104~118 행` — `request<T>(path, options)` 시그니처와 `ApiError`(비-2xx → status 보존, 네트워크 → status 0) 변환 정책
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `28~35 행` — 쓰기 요청의 관례(`method` · `headers: { 'Content-Type': 'application/json' }` · `JSON.stringify(body)`)
- [docs/architecture/api.md](../architecture/api.md) `83`·`84 행` — `POST /api/persons/:personId/identities`(201 + 생성 row, 400/404/409) · `PATCH /api/persons/:personId/identities/:identityId`(200 + 갱신 row, 400/404) 계약 정본
- [src/user/dto/create-service-identity.dto.ts](../../src/user/dto/create-service-identity.dto.ts) · [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) — body 허용 축(create 는 `service` + `externalId` 2 개, update 는 `externalId` 단일; `isPrimary` · `service` 갱신은 400)

## Acceptance Criteria

- [ ] `web/src/api/serviceIdentity.ts` 확장 — 기존 export 는 그대로 두고 다음 3 가지를 추가 export 한다.
  - [ ] `serviceIdentityItemPath(personId: string, identityId: string): string` — `/api/persons/<enc>/identities/<enc>` 를 조립한다. path param 2 개 모두 `encodeURIComponent` 를 통과시킨다.
  - [ ] `createServiceIdentity(personId: string, input: { service: string; externalId: string }): Promise<ServiceIdentityRow>` — `POST` + `Content-Type: application/json` + body 2 필드만 직렬화. backend DTO 가 `forbidNonWhitelisted` 라 **`isPrimary` 등 여분 필드는 절대 실어 보내지 않는다**(주석에 근거 박제).
  - [ ] `updateServiceIdentity(personId: string, identityId: string, input: { externalId: string }): Promise<ServiceIdentityRow>` — `PATCH` + body `externalId` 단일 축. `service` · `isPrimary` 는 시그니처 자체에서 봉쇄한다(ADR-0058 `§Decision 3`).
- [ ] 두 쓰기 함수의 분기 계약을 주석으로 명시하고 그대로 구현한다.
  - [ ] `personId`(그리고 update 는 `identityId` 도) 가 빈 문자열 / 공백뿐이면 **네트워크 호출 없이** `ApiError(0)` 을 던진다 — 읽기 축의 "빈 배열 조기 반환" 과 달리, 쓰기는 조용히 성공한 척하면 안 되므로 값이 아니라 오류로 표면화한다.
  - [ ] backend 오류(`400` DTO 위반 · `404` Person 부재 또는 타 Person 소유 · `409` `@@unique([personId, service])` 중복 · `401` · `5xx` · 네트워크)는 **흡수하지 않고 `ApiError` 그대로 전파** 한다 — 사용자 표면화는 후속 패널 slice 책임임을 주석에 박제.
  - [ ] 응답 body 가 객체가 아니면(계약 위반 · 비 JSON) `ApiError(0)` 으로 정상화한다 — 목록 축처럼 빈 값으로 흡수하면 호출측이 없는 row 를 다루게 되므로 삼키지 않는다.
- [ ] `web/src/api/serviceIdentity.test.ts` 확장 — 전역 `fetch` mock 위에서 R-112 4 종을 모두 덮는다(기존 읽기 축 케이스는 유지).
  - [ ] happy-path: `createServiceIdentity` 201 응답 row 반환 + 호출 URL `/api/persons/p1/identities` · `method === 'POST'` · 전송 body 가 정확히 `{service, externalId}` 2 키 임을 단언. `updateServiceIdentity` 200 응답 row 반환 + URL `/api/persons/p1/identities/i1` · `method === 'PATCH'` · body 가 `{externalId}` 단일 키 임을 단언.
  - [ ] error path: create 의 `409`(중복) · `404`(Person 부재) · `400`(DTO 위반) 각 1+ 와 update 의 `404`(타 Person 소유) · `400` 각 1+ 를 `ApiError` 로 잡아 **`status` 값까지 단언**. 네트워크 throw 시 `ApiError(0)` 전파 1+.
  - [ ] 분기 cover: 빈/공백 `personId` 조기 오류 분기(`fetch` 호출 0 회 단언) · 빈 `identityId` 조기 오류 분기 · 비객체 응답(`null` · 배열 · 문자열) 정상화 분기 · 정상 응답 분기 각 1+.
  - [ ] negative cases 충분 cover: `personId` 에 `/` 포함 시 encode 확인 · `identityId` 에 `/` 포함 시 encode 확인 · `401` 전파 · `500` 전파 · create input 에 여분 필드를 넘겨도 전송 body 에 실리지 않음 각 1+.
  - [ ] `serviceIdentityItemPath` 자체의 조립 결과 단언 1+ (정상 · encode 필요 입력).
- [ ] `pnpm --filter web test` 통과(신규 케이스 포함 전량 green).
- [ ] `pnpm --filter web build` 통과(`tsc --noEmit` 타입 검사 포함).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 변경 0 이라 회귀만 확인.
- [ ] 새 dependency 0 (`web/package.json` diff 0) — 브라우저 표준 `fetch` + 기존 `apiClient` 만 사용.

## Out of Scope

- 삭제(`DELETE`) · primary 지정(`POST .../primary`) 2 route 의 client — 쓰기 축 2/2 후속 slice.
- `ServiceIdentityList` 등 React 컴포넌트 신설 · AdminView 마운트 · RBAC gating 배선 · 로딩/에러 UI.
- `useApiResource` 기반 hook 화, 낙관적 갱신, 목록 재조회 정책.
- backend (`src/`) 코드 · `prisma/schema.prisma` · e2e · CI workflow · `docs/architecture/api.md` · `docs/requirements.md` · ADR-0058 완료 표기 변경.
- 기존 `fetchServiceIdentities` 의 동작 변경(시그니처 · 흡수 분기 그대로 보존).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 쓰기 축 2/2 client — `deleteServiceIdentity`(204 무 body) · `setPrimaryServiceIdentity`(200 + 승격 row) 신설.
- `ServiceIdentityList` 컴포넌트 신설 + AdminView 마운트 + RBAC gating 배선 (ADR-0058 `§Follow-ups (d)` 본체).
- 위 축들이 shipped 되면 `docs/requirements.md` REQ-078 을 IN_PROGRESS -> DONE 으로 재판정.

---

## 완료 기록

- **완료 시각**: 2026-08-28T15:02Z
- **결과**: PR [#1388](https://github.com/myungjoo/Assessment-Agent/pull/1388) squash 머지 → main `a56b7a5b`.
  `web/src/api/serviceIdentity.ts` 에 `serviceIdentityItemPath` · `createServiceIdentity`(POST 201) ·
  `updateServiceIdentity`(PATCH 200) 3 심볼을 추가하고, 쓰기 공통 helper(`assertPathParam` · `asRow`)로
  조기 오류 · 응답 정상화 분기를 접었다. 2 파일 `+297/-8`, 새 dependency 0.
- **test**: colocated spec 42 케이스로 R-112 4 종 전부 cover — happy(POST/PATCH) · error path
  (400 · 404 · 409 · 401 · 500 · 네트워크) · 분기(빈/공백 param 은 fetch 0 회 · 비객체 응답 정상화) ·
  negative(두 param encode 2 축 · 여분 body 필드 배제). web 2566 test · 루트 13208 test 전량 green.
- **review**: reviewer APPROVE round 1 (PR comment 외부 존재), 4-게이트 PASS.
- **잔여**: 쓰기 축 2/2 (DELETE 삭제 · primary 지정 2 route) 와 `ServiceIdentityList` 패널 컴포넌트 +
  AdminView 배선은 후속 slice.
