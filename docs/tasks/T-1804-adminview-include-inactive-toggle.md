---
id: T-1804
title: AdminView 인원 목록에 휴직 인원 포함 토글 배선 (Activate 진입점 개통)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-071]
estimatedDiff: 195
estimatedFiles: 3
created: 2026-08-30
independentStream: p6-admin-person
dependsOn: [T-1803]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.persons-include-inactive.test.tsx
  - web/src/views/AdminView.persons-list-contract.test.ts
plannerNote: "P6 오너 지시 130 행 인원 축의 유일 잔여(Activate 진입점) 의 web 소비 slice — T-1803 이 연 ?includeInactive query 배선"
---

# T-1804 — AdminView 인원 목록에 휴직 인원 포함 토글 배선 (Activate 진입점 개통)

## Why

오너 지시 [PLAN](../PLAN.md) `130 행` (평가 대상 추가·편집 인터페이스, R-164~R-168) 의 인원 축은 [T-1802](T-1802-requirements-req071-person-crud-rejudge.md) 재판정으로 **4/5 shipped, 잔여는 Activate(재활성) UI 진입점 1 건** 임이 확정됐다 ([requirements.md](../requirements.md) `90 행` REQ-071 `IN_PROGRESS`). 그 잔여의 선행 backend 축은 [T-1803](T-1803-person-list-include-inactive-query.md)(PR #1417, main `e2c8e673`) 이 `GET /api/persons?includeInactive=true` 로 이미 열었으나, **web 에서 그 query 를 소비하는 곳이 0** 이라 휴직 처리한 인원은 여전히 AdminView 인원 목록에서 사라지고 `active: true` 로 되돌릴 화면 경로가 없다. 본 slice 는 그 소비 한 겹 — 컨테이너의 조회 path 에 `includeInactive` 를 실어 주는 토글 — 만 절단해 기존 인라인 수정 폼(활성·휴직 `<select>` → `PATCH /api/persons/:id`)이 재활성 경로로 닿게 한다.

## Required Reading

- [docs/tasks/T-1803-person-list-include-inactive-query.md](T-1803-person-list-include-inactive-query.md) — 본 slice 가 소비할 backend query 계약 (`=== "true"` 일 때만 `findAll()`, 그 외 `findActive()`)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `@Get()` 핸들러 — `@Query("includeInactive")` 판정 분기 (계약 정본)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `128~132 행` (`PERSONS_PATH` 상수 + 주석), `799~810 행` (`buildPersonsPath` 순수 빌더), `3428~3450 행` (`personsRefreshNonce` state → `personsPath` useMemo → `useApiResource<PersonRow[]>` 조회), `5532~5545 행` (`PERSON_HEADING` 섹션 렌더 진입부 — 토글 마운트 위치)
- [web/src/views/AdminView.persons-list-contract.test.ts](../../web/src/views/AdminView.persons-list-contract.test.ts) `170~185 행` — 기존 drift guard 가 `buildPersonsPath(0) === BASE` · `buildPersonsPath(5) === '?_r=5'` 를 단언한다 (본 slice 의 회귀 0 기준선)
- 신규 colocated spec 위치: **`web/src/views/AdminView.persons-include-inactive.test.tsx`** (colocated 우선 — `web/src/views/` 의 기존 `AdminView.*.test.ts(x)` 규약 승계)

## Acceptance Criteria

- [ ] `buildPersonsPath` 가 두 번째 인자 `includeInactive` (기본값 `false`) 를 받아, `true` 일 때만 조회 path 에 `includeInactive=true` query 를 싣는다. `_r` cache-buster 와 동시에 실릴 때 query 구분자(`?` / `&`) 가 올바르게 조립돼야 한다.
- [ ] 기본 동작 불변 — `buildPersonsPath(0)` 은 여전히 `/api/persons`, `buildPersonsPath(5)` 는 여전히 `/api/persons?_r=5` 다 (`pnpm --dir web test` 로 [AdminView.persons-list-contract.test.ts](../../web/src/views/AdminView.persons-list-contract.test.ts) 회귀 0 확인).
- [ ] AdminView 컨테이너가 휴직 포함 여부 boolean state 를 소유하고 `personsPath` useMemo 가 그 값을 의존성에 포함해, 토글 변경이 곧 `useApiResource` 재조회(path 변경)로 이어진다.
- [ ] 인원 관리 섹션(`aria-label={PERSON_HEADING}`) 안에 휴직 인원 포함 여부를 켜고 끄는 controlled `<input type="checkbox">` 가 접근 가능한 이름(한국어 label 또는 `aria-label`)과 함께 렌더된다.
- [ ] **Happy-path unit test 1+** — 토글 OFF 기본 상태에서 `/api/persons` 를 조회하고, 토글 ON 후에는 `includeInactive=true` 가 실린 path 로 재조회하는 것을 신규 colocated spec 이 단언한다.
- [ ] **Error path unit test 1+** — 인원 조회가 실패(error) 한 상태에서도 토글이 렌더·조작 가능하고 throw 없이 안전 렌더된다 (또는 조회 실패 시 목록이 `?? []` 로 빈 배열 유지).
- [ ] **분기 cover** — `buildPersonsPath` 의 4 분기(nonce 0/양수 × includeInactive false/true) 각각 1+ test.
- [ ] **Negative cases 충분 cover** — 최소 4 종: (a) 토글 OFF 일 때 path 에 `includeInactive` 문자열이 **등장하지 않음**, (b) 토글 ON → 다시 OFF 로 되돌리면 query 가 제거됨, (c) `includeInactive=false` 같은 거짓 값을 path 에 싣지 않음 (backend 가 `=== "true"` 만 보므로 무의미한 query 금지), (d) 두 번째 인자를 생략한 기존 호출부(default 인자) 가 종전 path 를 그대로 낸다.
- [ ] 배선을 되돌리는 mutation(토글 값을 path 에 싣지 않도록 변경) 시 신규 spec 이 최소 2 개 fail 하는 것을 확인해 비-공허성을 확보한다.
- [ ] `pnpm lint && pnpm build && pnpm test` (root) 와 `pnpm --dir web test` 전량 green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- backend 변경 일체 — [person.controller.ts](../../src/user/person.controller.ts) · [person.service.ts](../../src/user/person.service.ts) 는 T-1803 상태 그대로 둔다.
- `PersonList` 등 presentational 컴포넌트 수정 (활성/휴직 배지 · 행 스타일 구분 등) — 목록에 휴직 인원이 나타나는 것까지만 본 slice 책임.
- 인라인 수정 폼 · `buildPersonPatch` · `handleUpdatePerson` 수정 — 재활성은 **기존** 활성/휴직 `<select>` 경로를 그대로 쓴다.
- [requirements.md](../requirements.md) `90 행` REQ-071 재판정 (`IN_PROGRESS` → `DONE`) 과 [PLAN](../PLAN.md) `130 행` 서술 갱신 — 별도 doc-only `direct` slice.
- [api.md](../architecture/api.md) `77 행` 의 `?includeInactive` query 계약 동기 — 별도 doc-only `direct` slice (T-1803 Follow-ups).
- 전역 CSS · 탭 내비게이션 등 `133 행` (R-187~R-191) 소관.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가)
