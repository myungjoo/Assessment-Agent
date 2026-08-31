---
id: T-1826
title: AdminView 수집 대상 등록 폼 신설 + POST 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072]
estimatedDiff: 460
estimatedFiles: 4
sizeExempt: true
exemptReason: "consumer-bundled-ui-slice — 폼 컴포넌트 + AdminView POST 배선을 한 PR 에 담는 것이 CLAUDE.md §3 소비처 동반 의무. 컴포넌트만 / 배선만 으로 쪼개면 소비처 0 helper PR 이 되어 오너 2026-08-31 지시 위반. 초과분은 R-112 spec 이고 제품 코드는 300 LOC 이내."
independentStream: web-collection-target-ui
dependsOn: [T-1825]
touchesFiles:
  - web/src/components/CollectionTargetAddForm.tsx
  - web/src/components/CollectionTargetAddForm.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.collection-targets-create.test.tsx
created: 2026-08-31
plannerNote: "P6/ADR-0059 §Follow-ups (e) 편집 축 첫 조각. cap-bend pre-justified: R-112 backbone × 1.5 = 460 LOC, T-1825 선례 + §3 소비처 동반 의무."
---

# T-1826 — AdminView 수집 대상 등록 폼 신설 + POST 배선

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` 는 "AdminView 등록·편집 패널" 이고, 직전 [T-1825](T-1825-admin-collection-target-list-panel.md) 가 그 중 **읽기 축**(목록 조회 + 빈 상태 안내)만 열었다. 지금 화면에는 등록된 수집 대상을 볼 수단만 있고 **새로 등록할 수단이 없어**, [requirements.md](../requirements.md) `89 행` REQ-070(빈 상태에서 막히지 않게 하는 대상 인터페이스) 이 요구하는 "빈 상태에서 막히지 않는다" 가 실제로는 충족되지 않는다 — 목록이 비어 있으면 사용자가 할 수 있는 일이 0 이다. `91 행` REQ-072(평가 대상 시스템 등록·편집) 도 같은 이유로 `PLANNED` 다.

본 slice 는 그 편집 축을 **등록(POST) 하나만** 연다: 등록 폼 컴포넌트 신설 + AdminView 에서 `POST /api/collection-targets` 호출 · 성공 시 목록 재조회까지 **한 PR 에** 담는다. 폼 컴포넌트만 만들고 배선을 다음 slice 로 미루는 절단은 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무(2026-08-31 오너 지시) 가 금지한 형태다 — ADR-0058 축에서 `ServiceIdentityAddForm` 이 소비처 0 인 채 여러 slice 를 대기한 전례를 반복하지 않는다.

**issue-still-relevant pre-check (2026-08-31 실측)** — `origin/main` 기준 `git grep -i "CollectionTargetAddForm\|CollectionTargetForm" -- web/` 0 건, `web/` 안에서 `COLLECTION_TARGETS_PATH` 를 쓰는 곳은 [AdminView.tsx](../../web/src/views/AdminView.tsx) `183 행`(상수) · `4440 행`(GET 조회 1 회) 와 T-1825 의 mount spec 뿐이라 **POST 경로는 web 어디에도 없다**. `web/src/api/collectionTarget.ts` 도 부재. 따라서 본 task 의 변경 의도는 main 에 미박제이며 중복 slice 가 아니다.

## Required Reading

- [src/assessment-collection/dto/create-collection-target.dto.ts](../../src/assessment-collection/dto/create-collection-target.dto.ts) — 폼이 인용할 검증 규칙 정본. `type` 은 `@IsIn(["GITHUB","CONFLUENCE"])`, `instanceKey` · `endpoint` 는 `@IsNotEmpty` + `@MaxLength(255)`, `orgs` / `repos` / `spaces` / `active` 는 전부 `@IsOptional`(미전달 시 DB default 위임)
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) `120~135 행` — `@Post()` 이 `@Roles("Admin")` 편집 tier 이고 201 + 생성 row 를 반환한다는 계약 (조회 2 route 의 `@Roles("User")` 와 다르다)
- [web/src/components/ServiceIdentityAddForm.tsx](../../web/src/components/ServiceIdentityAddForm.tsx) — controlled presentational 폼 선례(입력 미완 · 형식 위반 · loading 우선 submit 게이팅, `role="alert"` 에러, `aria-describedby` 안내 문구, named + default export convention). 본 컴포넌트가 그대로 승계할 형태
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `4430~4450 행` — 수집 대상 조회 hook(`useApiResource<CollectionTargetRow[]>(COLLECTION_TARGETS_PATH)`) 과 `Array.isArray` 정상화. `useApiResource` 는 `reload` 를 함께 반환하므로 등록 성공 후 재조회에 쓴다
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `5720~5740 행` — 마운트된 "수집 대상 관리" 섹션. 주석이 "등록·수정·삭제 폼이 붙는 후속 편집 slice 가 그 컨트롤에만 Admin+ gating 을 얹는다" 로 본 slice 의 자리를 이미 예고해 둔 지점
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `3789 행` — `isAdmin` 파생(`isAdminRole(meData?.role)`). 편집 컨트롤 gating 에 그대로 쓴다
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `request` / `ApiError`(비-2xx → `ApiError` 변환, 401 → refresh → 재시도)
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 4`(필드) · `§Decision 5`(route · 권한 tier · 오류 표) · `§Consequences (a)(b)` · `§Follow-ups (e)`

## Acceptance Criteria

- [ ] `web/src/components/CollectionTargetAddForm.tsx` 신설 — **controlled presentational** 컴포넌트(자체 fetch · 자체 상태 보유 금지, [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) `Decision 1`(컴포넌트는 fetch 를 모른다) 승계). 입력 축은 `type`(GITHUB / CONFLUENCE 2 option `<select>`) · `instanceKey` · `endpoint` 3 개이며, 값 · 변경 콜백 · `onSubmit` · `loading` · `error` 를 props 로 받는다.
- [ ] 폼이 backend DTO 규칙을 **화면에서 먼저 차단** 한다 — 입력 미완(trim 후 빈 문자열) · `MaxLength(255)` 초과 · `loading === true` 중 하나라도 참이면 submit 버튼 disabled(loading 우선). 조건 안내 문구는 입력 전에도 항상 렌더되고 `aria-describedby` 로 해당 입력에 연결된다.
- [ ] `error` 가 truthy 일 때만 `role="alert"` 영역을 렌더한다(falsy 면 미렌더 — 빈 에러가 자리를 차지하지 않는다).
- [ ] `web/src/views/AdminView.tsx` 배선 — "수집 대상 관리" 섹션 안, **`isAdmin` 이 true 일 때만** 위 폼을 렌더한다(`@Roles("Admin")` 편집 tier 라 non-Admin 에게 보이면 403 이 확정된 컨트롤을 노출하는 셈). 목록 자체는 종전대로 gating **바깥** 유지 — 기존 읽기 축 회귀 0.
- [ ] 제출 시 `request(COLLECTION_TARGETS_PATH, { method: 'POST', body: { type, instanceKey, endpoint } })` 를 호출하고, 성공하면 입력 3 개를 초기화한 뒤 `useApiResource` 의 `reload()` 로 목록을 재조회한다. 실패하면 `ApiError` 를 사람이 읽는 문구로 변환해 폼 `error` 로 내려보낸다(`toErrorMessage` 등 기존 변환 재사용, 화면은 죽지 않는다).
- [ ] 요청 body 에 `id` · `createdAt` · `updatedAt` · token 계열 필드를 싣지 않는다(backend 가 `forbidNonWhitelisted` 라 실으면 그 자체로 400 이며, [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Decision 2` credential 경계 위반이다).
- [ ] **happy-path test 1+** — 폼 spec: 3 입력을 채우고 submit 하면 `onSubmit` 이 1 회 호출된다. AdminView spec: Admin 으로 렌더 → 입력 → submit 하면 `POST /api/collection-targets` 가 위 body 로 1 회 발사되고, 성공 후 목록 재조회(`GET /api/collection-targets` 2 회째)가 일어난다.
- [ ] **error path test 1+** — POST 가 비-2xx(예: 409 중복 · 500)로 실패하면 `role="alert"` 문구가 뜨고 입력값은 보존되며(사용자가 다시 타이핑하지 않아도 되게) 목록 재조회는 일어나지 않는다.
- [ ] **분기 cover** — 폼의 submit 게이팅 분기 각 1+ test: (1) 입력 미완 disabled, (2) 255 초과 disabled, (3) `loading` 중 disabled, (4) 전부 유효 + non-loading 이면 enabled. AdminView 의 gating 분기 2 종: `isAdmin === true` 면 폼 렌더 / `false` 면 미렌더(목록은 그대로 렌더).
- [ ] **negative cases 충분 cover** — 최소 5 종 각 1+ test: (a) 공백만 입력한 `instanceKey` 는 미완으로 취급(네트워크 호출 0), (b) `endpoint` 256 자 → submit 차단(호출 0), (c) disabled 상태에서 form submit 이벤트가 직접 발생해도 `onSubmit` 미호출 + 페이지 reload 없음(`preventDefault`), (d) non-Admin 사용자에게 폼이 렌더되지 않아 POST 경로가 아예 없음, (e) POST 성공 응답이 배열·null 등 예상 밖 shape 여도 throw 없이 목록 재조회로 착지.
- [ ] `pnpm --dir web test` 전량 green + `pnpm --dir web build` 성공. backend 무변경이므로 `pnpm test:cov` 의 전역 coverage 변동 0 임을 확인(line ≥ 80% / function ≥ 80% 유지).
- [ ] spec 은 colocated — 폼은 `web/src/components/CollectionTargetAddForm.test.tsx`, 배선은 `web/src/views/AdminView.collection-targets-create.test.tsx`.

## Out of Scope

- `PATCH` 수정 폼 · `DELETE` 삭제 버튼 · `active` 토글 — 편집 축의 나머지 조각이며 후속 slice 가 같은 섹션에 얹는다.
- `orgs` / `repos` / `spaces` 배열 입력 축 — backend DTO 가 전부 `@IsOptional` 이고 미전달 시 DB default(빈 배열)로 위임되므로 등록 자체는 3 필드로 성립한다. 배열 입력 UI(구분자 파싱 · 중복 제거 · 빈 항목 처리)를 본 slice 에 넣으면 cap 을 넘긴다.
- `web/src/api/collectionTarget.ts` per-resource client 파일 신설 — 본 slice 는 route 1 개뿐이라 `apiClient.request` 직접 호출로 충분하고, client 파일을 먼저 만들면 소비처 대비 과한 층이 된다(5 route 가 다 붙는 시점에 추출 판단).
- `instanceKey` 후보 제시(ADR-0059 `§Consequences (b)`) · env 유래 vs DB row 출처 표시(`§Consequences (a)`) — 목록 표시 축의 판단이라 별도 slice.
- backend(`src/`) · `prisma/` · `test/` · `package.json` · `.github/workflows/` 변경 일체 — 본 slice 는 `web/` 전용이다.
- `AdminView.tsx` 의 god component 부채([PLAN.md](../PLAN.md) `183 행`) 를 겨냥한 추가 추출 리팩터 — 본 slice 의 배선은 최소로 얹고, 추출은 별도 순수 추출 task 로 진행한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
