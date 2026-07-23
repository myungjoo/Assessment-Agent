---
id: T-1153
title: AdminView 파트 생성 mutation 배선 (POST /api/parts)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-part
dependsOn: [T-1152]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 PLAN Admin 패널 bullet 파트 관리 create slice — T-1152 읽기전용 마운트 다음. 그룹 create(T-1146 runCreateGroup) mirror + Part.name @unique 라 409 중복 error 표면화 추가. pr web 2파일"
---

# T-1153 — AdminView 파트 생성 mutation 배선 (POST /api/parts)

## Why

P6 PLAN.md 의 "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" bullet 과 README 85행("Admin은 … 인원 Group/파트 편집 등을 할 수 있다")·REQ-028(단일 조직도 파트)이 요구하는 파트 관리 UI 를, 직전 그룹 관리 UI(presentational T-1147 → mount T-1148 → **create T-1146** → delete T-1149 → update T-1150)와 동형으로 진행 중이다. 파트는 presentational(T-1151) → 읽기 전용 마운트(T-1152)까지 완료됐으나 **사람이 새 파트를 만들 방법이 없다** — AdminView 는 현재 `PARTS_PATH = '/api/parts'` 정적 상수로 파트 목록을 read-only 로만 조회한다. 본 slice 는 그룹 create(T-1146 `runCreateGroup`)에서 검증된 패턴을 mirror 해 파트 생성 폼을 배선한다.

단, 한 가지 도메인 차이가 있다 — `Group.name` 은 `@unique` 미정의라 서버가 409 를 거의 안 던졌으나, **`Part.name` 은 `prisma/schema.prisma` L116 에서 `@unique`** 이고 `PartService.create` 가 Prisma `P2002` → `ConflictException(409)` 으로 변환한다(`src/user/part.service.ts`). 따라서 파트 생성 폼은 중복 이름 입력 시 돌아오는 **409 를 사람-친화 error("이미 존재하는 파트 이름" 취지)로 표면화**해야 한다. backend `POST /api/parts`(`src/user/part.controller.ts` `@Post()` + `CreatePartDto { name }`)는 이미 shipped 이므로 서버 계약은 손대지 않는다. REQ-028(파트 등록)·REQ-049(Admin 관리 UI) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 배선 대상 컨테이너. 특히:
  - T-1152 가 추가한 파트 조회부: `const PARTS_PATH = '/api/parts'`(정적 상수) + `useApiResource<PartRow[]>(PARTS_PATH)` → `{ data: partsData, loading: partLoading, error: partError }` + `<section aria-label={PART_HEADING}>` 파트 관리 섹션. 본 slice 는 `PARTS_PATH` 정적 상수를 nonce-aware `buildPartsPath(nonce)` 빌더로 전환하고 `partsRefreshNonce` state + `runCreatePart` 러너 + 생성 폼(input + 버튼)을 추가한다.
  - 그룹 생성 배선(T-1146): `buildGroupsPath(nonce)`·`groupsRefreshNonce` state·`runCreateGroup(name, deps)` 순수 async 러너·그룹 생성 폼(name controlled input + "그룹 추가" 버튼). 본 slice 는 이를 파트로 그대로 mirror 하되 409 분기만 추가한다.
  - 인원 생성 배선(`runCreatePerson`·`buildPersonsPath`·`personsRefreshNonce`) — trim 가드·in-flight 가드·nonce bump 재조회 패턴의 원형.
- `web/src/components/PartList.tsx` — 마운트된 파트 목록 컴포넌트. `export type { PartRow }` 재사용(수정 0). 생성 성공 후 nonce bump 로 `PartList` 가 자동 재조회 렌더된다.
- `web/src/views/AdminView.test.tsx` — colocated test. 그룹 생성 mutation test 패턴(happy/error/분기/negative — trim 가드·in-flight·nonce bump·재조회)을 참조해 파트 생성도 동형 커버. 파트 생성 POST mock 을 추가할 때 기존 파트·그룹·인원·멤버십·provider·schedules 조회/생성 mock 이 회귀 없이 유지되도록 path 분기 mock 을 확장한다.
- `src/user/dto/create-part.dto.ts` — 생성 payload 계약(`name: string` 단일 필드, `@IsString`+`@IsNotEmpty`). 폼 입력 1종을 이 계약에 맞춘다. body 는 `{ name: name.trim() }`.
- `src/user/part.controller.ts`(L84~120 `@Post()` create) + `src/user/part.service.ts`(P2002→ConflictException 변환) + `prisma/schema.prisma`(L114~122 `model Part`, `name @unique`) — 409 중복 계약 확인만(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `PARTS_PATH` 정적 상수를 `buildPartsPath(nonce)` 빌더로 전환(nonce query 를 붙여 생성 성공 후 재조회 유발). 기존 `useApiResource<PartRow[]>(PARTS_PATH)` 호출을 `useApiResource<PartRow[]>(buildPartsPath(partsRefreshNonce))` 로 교체(`buildGroupsPath`/`groupsRefreshNonce` mirror). 파트 목록 섹션·다른 조회부는 회귀 없이 유지.
- [ ] `AdminView` 에 파트 생성 폼(name controlled input + "파트 추가" 버튼) + `runCreatePart(name, deps)` 순수 async 러너 추가. 러너는 (1) trim 후 빈/공백 name 가드(no-op — 불필요 POST 미발사), (2) creating in-flight 이중 POST 가드, (3) 성공 시 `partsRefreshNonce` bump 재조회 + 입력 초기화, (4) 실패 시 사람-친화 error state 표면화(throw 없음, no-throw), (5) finally 진행 off 를 수행한다. body 는 `{ name: name.trim() }`.
- [ ] **409 중복 분기**: POST 응답이 409(Part.name `@unique` 위반 → `ConflictException`)이면 일반 error 문구와 구분되는 사람-친화 중복 error 문구(예: "이미 존재하는 파트 이름입니다" 취지)를 error state 로 표면화한다. 그룹(409 없음)과 달리 파트는 409 를 명시 분기한다.
- [ ] `apiClient`/`useApiResource`/backend `src/`/`PartList` 컴포넌트/`prisma` 수정 0(ADR-0041 Decision 1 — 기존 fetch hook 재사용만).
- [ ] **Happy-path test 1+**: `runCreatePart` 정상 POST(올바른 path `/api/parts`·method POST·body `{ name }`·성공 시 `partsRefreshNonce` bump 재조회·입력 초기화), `buildPartsPath` 가 nonce 를 query 로 반영하는지.
- [ ] **Error path test 1+**: POST network/500 실패 시 error state 표면화·nonce 미bump·throw 없음. **409 중복 응답** 시 중복 전용 문구 표면화(일반 error 와 구분)를 별도 test 로 1+.
- [ ] **분기/flow test**: trim 후 빈 name 가드(POST 미발사), 공백-only 입력 가드, creating in-flight 재발사 차단, `buildPartsPath` nonce 0/>0 분기, 409 분기 vs 비-409 error 분기 각각 test.
- [ ] **Negative cases 충분 cover(각 1+)**: 앞뒤 공백 name → trim 후 body 반영 / 재클릭 이중 POST 차단 / reject 시 finally 진행 off 복구 / 성공 후 입력 필드 초기화 / 409 중복 후 재입력·재시도 시 error 문구 초기화 / 파트 생성 POST mock 추가가 기존 그룹·인원 등 조회·생성 mock 을 깨지 않음. 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc --noEmit + vite build) green, lint clean. web 은 vitest — 신규 심볼(runCreatePart·buildPartsPath) happy/error/분기/negative 충분 cover(기존 web 테스트 관행 준수).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 은 vitest coverage 로 확인.

## Out of Scope

- backend `src/` 변경(POST /api/parts 이미 shipped — 서버 계약·서비스·DTO·prisma schema 손대지 않음).
- `apiClient.ts`·`useApiResource.ts`·`PartList.tsx` 수정(ADR-0041 D1 — 기존 fetch hook·presentational 재사용만).
- 파트 삭제(DELETE /api/parts/:id)·수정(PATCH /api/parts/:id) mutation 러너·버튼 배선 — 각각 별도 후속 slice(그룹 delete T-1149 / update T-1150 mirror).
- 파트 소속 인원(persons) 관리 UI(`GET /api/parts/:id/persons` 조회·재배정) — 별도 후속 slice.
- 필터/정렬/페이지네이션(상위 컨테이너 책임).
- api.md 갱신(endpoint 이미 박제됨).
- 다른 stream(인원·그룹·LLM provider·permission-denied·스케줄·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
