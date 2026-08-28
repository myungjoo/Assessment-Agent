---
id: T-1766
title: AdminView 에 인원별 ServiceIdentity 목록 읽기 축 배선 (path builder + useApiResource + ServiceIdentityList)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: [T-1765]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-wiring.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 여덟 번째 web slice: 컴포넌트 4 종 완성 후 첫 컨테이너 배선, 읽기 축(GET) 1 겹만 절단"
---

# T-1766 — AdminView 에 인원별 ServiceIdentity 목록 읽기 축 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · presentational 컴포넌트 4 종 (T-1762 `ServiceIdentityList` · T-1763 `ServiceIdentityAddForm` · T-1764 `ServiceIdentityEditForm` · T-1765 `ServiceIdentityRowActions`) 이 모두 main 에 박제됐다. 그러나 이 4 종은 **어느 화면에도 마운트되지 않은 상태** 다 — `web/src/views/AdminView.tsx` 에 `ServiceIdentity` 문자열이 0 hit 이라 사용자는 아직 서비스 계정을 볼 수도 없다.

본 task 는 그 첫 컨테이너 배선 겹으로 **읽기 축 (GET /api/persons/:personId/identities) 만** 절단한다 — 조회 대상 인원 선택 상태 + 조건부 path builder + `useApiResource` 조회 + `ServiceIdentityList` 마운트. 추가 · 수정 · 삭제 · primary 지정 mutation 배선 (`ServiceIdentityAddForm` · `ServiceIdentityEditForm` · `ServiceIdentityRowActions` 마운트 + client 함수 호출) 은 잔여 전체가 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘으므로 후속 slice 로 남긴다.

REQ-078 / REQ-079 의 status 재판정은 **쓰기 축까지 마운트된 뒤** 한다 — 본 slice 만으로는 어떤 REQ 도 status 를 바꾸지 않는다.

## Required Reading

- `web/src/views/AdminView.tsx` `809~831 행` — 승계할 정본 선례 `buildPartPersonsPath` (조건부 path builder: 미선택 시 `null` 반환 → `useApiResource` idle, `encodeURIComponent`, `refreshNonce <= 0` 이면 query 없는 base path / 1+ 면 `?_r=<nonce>`).
- `web/src/views/AdminView.tsx` `3830~3850 행` — 그 builder 의 `useMemo` + `useApiResource<PersonRow[]>` 배선 형태 (loading / error 를 컨테이너가 받아 presentational props 로 내려보내는 ADR-0041 Decision 1 경계).
- `web/src/views/AdminView.tsx` `4540~4565 행` — 인원 선택 `<select>` 의 controlled lift-up 선례 (`aria-label` · placeholder `<option value="">` · `onChange` 핸들러 형태). `4226 행` 의 `selectedPersonId` state 는 **재평가 패널 전용** 이므로 재사용하지 않는다.
- `web/src/views/AdminView.tsx` `5000~5050 행` 부근의 test-only export 목록 — 신규 builder 를 여기에 추가해야 spec 이 import 할 수 있다.
- `web/src/api/serviceIdentity.ts` `28~36 행` (`ServiceIdentityRow` 타입) · `45~47 행` (`serviceIdentityCollectionPath(personId)` — base path 를 재구현하지 말고 이 함수를 호출한다).
- `web/src/components/ServiceIdentityList.tsx` `26~40 행` — props 계약 (`identities` 필수 배열 · `loading?` · `error?` · `emptyMessage?`) 과 loading → error → empty → populated 분기 순서.
- `web/src/views/AdminView.userlist-wiring.test.tsx` `1~50 행` — 승계할 spec 패턴 (별도 파일 + file-level `vi.mock('../api/useApiResource')` + presentational 컴포넌트 prop 캡처 stub + `renderToStaticMarkup`, 새 dependency 0). `AdminView.test.tsx` 는 **수정하지 않는다** (같은 파일에서 stub 치환 시 기존 markup 단언이 무너지므로 별도 파일이 정본 선례다).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 순수 helper `buildServiceIdentitiesPath(selectedPersonId: string | undefined, refreshNonce = 0): string | null` 를 신설한다. `buildPartPersonsPath` 와 동형으로 — falsy / 빈 문자열 / 공백뿐인 personId 면 `null` 을 반환하고 (미조회 idle — `/api/persons//identities` 같은 깨진 path 발사 차단), 그 외에는 `serviceIdentityCollectionPath(personId)` 를 base 로 쓰며 `refreshNonce <= 0` 이면 base 를, 1+ 면 `?_r=<nonce>` 를 부착한다. path 문자열을 직접 조립하지 않는다 (client 의 함수를 호출해 계약 drift 를 막는다).
- [ ] 컨테이너에 조회 대상 인원 state (`selectedIdentityPersonId`) 와 그 `<select>` 를 신설한다 — 재평가 패널의 `selectedPersonId` 를 재사용하지 않는다 (두 화면의 선택이 서로를 덮으면 안 된다). 옵션은 **이미 조회 중인** `GET /api/persons` 결과 (`personData`) 에서 파생하고, 새 fetch 를 추가하지 않는다. 미선택 placeholder `<option value="">` 를 첫 옵션으로 두고 `aria-label` 은 한국어로 명시한다.
- [ ] `useMemo` + `useApiResource<ServiceIdentityRow[]>(identitiesPath)` 로 조건부 조회를 배선하고, 결과를 `<ServiceIdentityList identities={...} loading={...} error={...} />` 로 내려보낸다. 응답이 배열이 아닌 비정상 payload (객체 · null · 문자열) 이거나 `undefined` 여도 **빈 배열로 방어** 한다 (throw 0 — `partPersonData` 방어 선례 동형). `error` 는 기존 `toErrorMessage` 경로를 그대로 쓴다.
- [ ] `ServiceIdentityList` 는 default import 로 마운트하고 **컴포넌트 파일을 수정하지 않는다** (ADR-0041 Decision 1 — 패널은 fetch 를 모른다). `ServiceIdentityRow` 는 `import type` 으로 재사용하고 재선언하지 않는다.
- [ ] `buildServiceIdentitiesPath` 를 파일 하단 test-only export 목록에 추가한다.
- [ ] `web/src/views/AdminView.service-identity-wiring.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup` + `vi.mock`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — (1) `buildServiceIdentitiesPath('p1')` 가 `/api/persons/p1/identities` 를 반환하는 test 1+, (2) AdminView 렌더 시 `ServiceIdentityList` 가 마운트되고 미선택 초기 상태에서 `identities: []` · `loading` falsy 로 props 가 내려가는 test 1+.
  - [ ] **error path** — `useApiResource` 가 identities path 에 대해 `error` 를 돌려줄 때 그 문구가 `ServiceIdentityList` 의 `error` prop 으로 그대로 전달되는 test 1+, `loading: true` 일 때 `loading` prop 이 전달되는 test 1+.
  - [ ] **분기 cover** — builder 의 3 분기 (미선택 → `null` / `refreshNonce <= 0` → base / `refreshNonce >= 1` → `?_r=` 부착) 각 1+ test, 그리고 컨테이너가 미선택 시 identities path 로 `null` 을 넘겨 조회를 걸지 않는 것 (mock 호출 인자 검증) 1+ test.
  - [ ] **negative cases 충분 cover** — `undefined` · 빈 문자열 · 공백뿐 personId 각각 `null` 반환, `/` · 공백이 든 personId 가 `encodeURIComponent` 로 인코딩돼 경로가 깨지지 않음, 응답이 배열이 아닌 payload (객체 · `null` · 문자열) 일 때 `identities` prop 이 빈 배열로 방어됨, `refreshNonce` 가 음수여도 base path 로 떨어짐 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green — 기존 `AdminView.test.tsx` 회귀 0).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test:cov` 통과 — coverage threshold line ≥ 80% AND function ≥ 80% 유지 (본 task 는 `src/` 를 건드리지 않으므로 backend 결과가 직전과 동일해야 한다).

## Out of Scope

- `ServiceIdentityAddForm` · `ServiceIdentityEditForm` · `ServiceIdentityRowActions` 마운트, `createServiceIdentity` · `updateServiceIdentity` · `deleteServiceIdentity` · `setPrimaryServiceIdentity` 호출, 편집 · 삭제 상태 보유, mutation 성공 후 목록 재조회 nonce — 후속 쓰기 축 배선 slice 책임.
- `web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 본문 수정 (읽기 전용 재사용만).
- `web/src/views/AdminView.test.tsx` (9827 행) 수정 — 본 slice 는 별도 spec 파일만 추가한다. 기존 spec 이 새 `<select>` 때문에 깨지면 그 사실을 Follow-ups 에 적고 **BLOCKED 로 올린다** (파일 3 개째 편집은 cap 위험).
- Admin+ RBAC gating · 탭/구획 내비게이션 · CSS — PLAN `133 행` (R-187 ~ R-191) 별건.
- `docs/requirements.md` REQ-078 · REQ-079 status 재판정, ADR-0058 `§Follow-ups` 완료 표기, `docs/architecture/*` doc-sync.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
