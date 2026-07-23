---
id: T-1143
title: AdminView 인원 생성 mutation 배선 POST /api/persons
phase: P6
status: DONE
completedAt: 2026-07-23T12:40:00Z
result: PR #1035 머지(squash b5285a2f, round 1/7). AdminView 인원 생성 폼 + runCreatePerson/buildPersonsPath 배선, web 732 tests green, 4-게이트 PASS.
commitMode: pr
coversReq: [REQ-049, REQ-023]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-person
dependsOn: [T-1142]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 인원관리 — T-1142 read-only 마운트 후속 create slice, T-1136 runCreateProvider 패턴 mirror + PERSONS_PATH nonce 전환, pr web 2파일
---

# T-1143 — AdminView 인원 생성 mutation 배선 POST /api/persons

## Why

P6 line 120 Admin 패널의 "인원(Person)" 관리는 backend CRUD(PersonController 5 endpoint)와 읽기 전용
목록 마운트(T-1142, `PersonList` + `GET /api/persons`)까지 완결됐으나, 아직 **인원을 추가할 UI 가 없다** —
관리자가 새 평가 대상 인원을 등록하려면 API 를 직접 호출해야 한다. 본 slice 는 직전 LLM provider CRUD 사슬의
생성 slice(T-1136 `runCreateProvider`)와 그룹 멤버 추가(T-1131 `runAdd`) 패턴을 mirror 해, AdminView 에
`fullName`/`email` 입력 폼 + "추가" 버튼 + `POST /api/persons` mutation 을 배선한다. 성공 시 인원 목록을
권위 재조회(refresh nonce bump)한다. 인원 생성은 시스템 전체 평가의 진입점(사람이 있어야 평가 가능)이라
Person CRUD UI 의 첫 mutation slice 다. REQ-049(인원 관리 UI)·REQ-023(신규 인원 추가) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 배선 대상 컨테이너. 다음 3 지점을 mirror:
  - `buildProvidersPath(refreshNonce)`(L588) + `providersRefreshNonce`(L1564) nonce-aware 재조회 패턴 — 본 task 는 현재 고정 `PERSONS_PATH` 상수(L67)와 `useApiResource<PersonRow[]>(PERSONS_PATH)`(L1446)를 `buildPersonsPath(personsRefreshNonce)` nonce-aware 빌더로 전환한다.
  - `runCreateProvider`(L1253) 순수 async 러너 + `creatingProvider` in-flight 가드 + 빈/공백 trim 가드 + 성공 시 nonce bump + 실패 시 error state(no-throw) 구조를 인원 생성용으로 mirror.
  - PersonList 마운트 섹션(L2421~L2427) — 생성 폼을 이 섹션 heading("인원 관리") 안/근처에 배치.
- `src/user/person.controller.ts` (L65~72) — `POST /api/persons` 계약: 201 Created, `CreatePersonDto` @Body, email 중복 시 409 Conflict. (수정 금지 — 읽기 참조)
- `src/user/dto/create-person.dto.ts` — request body shape: `{ fullName: string(비어있지 않음, ≤255), email: string(IsEmail, ≤255) }`. 이 2 필드만 body 로 보낸다(active 는 Prisma default true). (수정 금지)
- `web/src/api/useApiResource.ts` — fetch hook 계약(`useApiResource<T>(path)` → `{ data, loading, error }`, path 변경 시 재조회). 수정 0.
- `web/src/api/apiClient.ts` — `apiClient.request(path, { method, body })` mutation 호출 계약. runCreateProvider 가 쓰는 방식 그대로. 수정 0.
- `web/src/views/AdminView.test.tsx` — colocated test. 기존 provider create(runCreateProvider) test 섹션의 mock/assert 방식을 참조해 회귀 없이 인원 생성 test 를 추가한다.

## Acceptance Criteria

- [ ] 고정 `const PERSONS_PATH = '/api/persons'`(L67)를 nonce-aware `buildPersonsPath(refreshNonce)` 빌더로 전환하고, `personsRefreshNonce` state(초기 0)를 추가해 `useApiResource<PersonRow[]>(buildPersonsPath(personsRefreshNonce))` 로 조회한다(T-1135 buildProvidersPath 패턴). nonce 0 일 때 path 는 기존과 동일해야 한다(회귀 0).
- [ ] `fullName`/`email` 2 controlled input + "추가" 버튼을 인원 관리 섹션에 추가한다(문구 §12 한국어). `runCreatePerson` 순수 async 러너를 신설해 `apiClient.request('/api/persons', { method: 'POST', body: { fullName, email } })` 를 발사하고, 성공 시 `personsRefreshNonce` bump + 입력 초기화, 실패 시 error state 설정(throw 금지 — runCreateProvider mirror).
- [ ] in-flight 가드: 진행 중(creating) 이면 재발사 억제(이중 POST 차단). 빈/공백 가드: `fullName` 또는 `email` 이 빈 문자열/공백만이면(trim 후) 버튼 비활성화 + 미발사.
- [ ] backend(`src/user/person*`)·`apiClient`·`useApiResource`·`PersonList` 컴포넌트 수정 0 — 본 task 는 AdminView 2파일(컨테이너 + colocated test)만. 낙관적 추가(optimistic insert) 없음 — 성공 후 권위 재조회만.
- [ ] **Happy-path test**: 유효한 fullName+email 입력 후 "추가" 클릭 → `apiClient.request` 가 `POST /api/persons` + body `{fullName, email}` 로 1회 호출되고, 성공 시 목록 재조회(nonce bump 로 재 fetch)·입력 초기화되는지 1+ test.
- [ ] **Error path test**: POST 가 실패(예: 409 email 중복 / 네트워크 error)하면 `role="alert"` 에러 표면이 렌더되고 목록은 기존 상태 유지·throw 없음·입력 미초기화인지 1+ test. 409 와 일반 실패를 각각 cover.
- [ ] **분기 test**: creating 중(버튼 비활성/재발사 억제) / 빈·공백 입력(버튼 비활성·미발사) / 정상 발사 각 분기 1+ test. 기존 AdminView 다른 패널(provider·member·person 목록) test 는 회귀 없이 유지.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `fullName`만 채우고 `email` 빈 경우 미발사, 공백만(`'   '`) trim 후 미발사, in-flight 중 두 번째 클릭 무시(단일 POST), 실패 후 재시도 시 정상 발사, nonce bump 가 기존 person 목록 조회를 재트리거(중복 fetch·key 충돌 없음). 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green. web 커버리지 게이트(line ≥ 80% / function ≥ 80%) 통과.

## Out of Scope

- Person 수정(PATCH)·삭제(DELETE)·deactivate/reactivate(active toggle) mutation UI — 각각 별도 후속 slice.
- ServiceIdentity(서비스별 ID)·Group·Part 소속 nested 입력 — 후속 slice(backend nested endpoint 미노출).
- 필터(active-only / part 별)·정렬·페이지네이션·query param — 후속 slice.
- 낙관적 UI(optimistic insert) — 본 slice 는 성공 후 권위 재조회만.
- `PersonList` 컴포넌트 자체 수정·`useApiResource`/`apiClient`/backend 수정.
- api.md 갱신(endpoint 이미 박제됨).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
