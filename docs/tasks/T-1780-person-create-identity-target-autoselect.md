---
id: T-1780
title: AdminView 인원 생성 성공 후 ServiceIdentity 대상 자동 선택 결선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-079]
independentStream: service-identity-web-ui
dependsOn: [T-1778, T-1779]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.person-create-identity-autoselect.test.tsx
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-29
plannerNote: P5 / ADR-0058 §Follow-ups (d) 잔여 동선 — 인원 생성 성공 응답의 id 를 identity 대상으로 자동 연결 (REQ-079 IN_PROGRESS 해소)
---

# T-1780 — 인원 생성 성공 후 ServiceIdentity 대상 자동 선택

## Why

[T-1779](T-1779-service-identity-req-rejudge-ui-axis.md) 가 `docs/requirements.md` `98 행` REQ-079 를
`PLANNED` → `IN_PROGRESS` 로 재판정하며 남긴 유일한 잔여가 "인원 생성 성공 후 identity 대상 자동
연결 없음" 이다 — `setSelectedIdentityPersonId` 호출처가 `handleIdentityPersonChange`(select 이벤트)
하나뿐이라, 방금 만든 인원에 service identity 를 붙이려면 사용자가 select 에서 그 인원을 손으로 다시
골라야 한다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)`
가 요구한 "이름 / email 만 입력 가능한 상태 금지" 동선의 마지막 한 칸이다.

`POST /api/persons` 는 201 로 생성된 `Person`(id 포함)을 반환하는데
([src/user/person.controller.ts](../../src/user/person.controller.ts) `68~72 행`) 현재
`runCreatePerson` 은 그 응답을 `await` 만 하고 버린다. 본 slice 는 응답에서 id 를 **방어적으로**
꺼내는 순수 helper 를 신설하고, 러너에 optional 콜백 1 개를 추가해 컨테이너에서 identity 대상
state 로 연결한다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1681~1745 행` — `CreatePersonDeps` / `runCreatePerson` 본체(응답 미소비 지점)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `3414~3440 행` — `selectedIdentityPersonId` state · `handleIdentityPersonChange` · identity 목록 재조회 의존성
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `3631~3675 행` — `handleCreatePerson` useCallback(deps 주입 지점)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2266~2275 행` — `normalizeRowId`(id 정규화 규칙 정본 — 재구현 금지, 필요 시 재사용)
- [web/src/views/AdminView.person-create-contract.test.ts](../../web/src/views/AdminView.person-create-contract.test.ts) — 기존 `runCreatePerson` 계약 spec(하위 호환 확인용)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `68~72 행` — `POST /api/persons` 201 + `Person` 반환 계약
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)`

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 helper `extractCreatedPersonId(response: unknown): string | undefined` 를 신설한다 — 객체가 아니거나 `id` 가 string 이 아니거나 trim 후 빈 값이면 `undefined` 를 반환한다(응답 형태를 신뢰하지 않는 방어 파싱). id 정규화가 필요하면 `normalizeRowId` 를 재사용하고 같은 규칙을 다시 구현하지 않는다.
- [ ] `CreatePersonDeps` 에 **optional** 필드 `onCreated?: (personId: string) => void` 를 추가하고, `runCreatePerson` 이 `deps.create(...)` 의 반환값에서 id 추출에 성공한 경우에만 `deps.onCreated?.(id)` 를 호출한다. 추출 실패 시 호출 0 · 기존 성공 경로(`bumpRefresh` → `resetInput`)와 실패 경로는 그대로 유지한다(하위 호환 — 기존 호출처는 미수정으로 컴파일·통과).
- [ ] 컨테이너 `handleCreatePerson` 의 deps 에 `onCreated` 를 배선해 생성된 인원 id 를 `setSelectedIdentityPersonId` 로 넘긴다. 자동 선택 근거(생성 직후 identity 추가 동선 — REQ-079)와 "재조회 직후라 select option 이 잠깐 비어 보일 수 있음" 을 주석으로 박제한다.
- [ ] 신규 colocated spec `web/src/views/AdminView.person-create-identity-autoselect.test.tsx` 를 추가한다(위치 고정 — 다른 디렉토리 금지).
- [ ] **happy-path test 1+** — 응답이 `{ id: 'p-1', ... }` 일 때 `onCreated` 가 `'p-1'` 로 정확히 1 회 호출되고 `bumpRefresh` · `resetInput` 도 함께 호출됨.
- [ ] **error path test 1+** — `create` 가 throw 하면 `onCreated` 호출 0 · 기존대로 `setCreateError` 만 표면화되고 `finally` 의 진행 off 가 유지됨.
- [ ] **분기 cover** — helper 의 각 분기(정상 객체 / null / 배열·문자열·숫자 등 비객체 / `id` 비-string / `id` 공백뿐)와 러너의 `onCreated` 유무(미전달 시 crash 0) 분기 각 1+ test.
- [ ] **negative cases 충분 cover** — 빈/공백 입력 미발사 · in-flight 재호출 억제 · 응답 `undefined` · `{}` · `{ id: '' }` · `{ id: 42 }` · `onCreated` 미전달 각 1+ test(총 5+).
- [ ] `pnpm --dir web test` · 루트 `pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] 루트 `pnpm lint` · `pnpm --dir web build`(`tsc --noEmit` 포함, `noUnusedLocals` 위반 0) green.
- [ ] 기존 `AdminView.person-create-contract.test.ts` 는 수정 없이 통과한다(optional 필드라 계약 파괴 0).

## Out of Scope

- backend 변경 0 — `src/**` · `prisma/**` 무수정(응답 계약을 읽기만 한다).
- 인원 생성 폼·identity 패널의 JSX / 레이아웃 변경 0 — 배선만 한다.
- 자동 선택 후 identity 추가 폼에 포커스 이동 · 스크롤 등 UX 부가 동작 0.
- `docs/requirements.md` REQ-079 status 재판정 0 — 실측 재판정은 별도 direct slice.
- ADR-0058 `§Status` · `§Follow-ups` closure 표기 0 — 별도 direct slice.
- 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-29 10:53Z DONE)

- `commitMode: pr` — PR [#1407](https://github.com/myungjoo/Assessment-Agent/pull/1407) squash `e4c81021` 머지 후 branch 삭제.
- `web/src/views/AdminView.tsx` 에 `extractCreatedPersonId`(기존 `normalizeRowId` 재사용) 방어 파싱 helper 신설 + `CreatePersonDeps.onCreated` optional 추가 + 컨테이너 `handleCreatePerson` 을 `setSelectedIdentityPersonId` 로 배선 (2 파일 `+211/-1`, backend·JSX·새 dependency 0).
- 신규 colocated spec `AdminView.person-create-identity-autoselect.test.tsx` 로 R-112 4 종 cover — helper 분기 9 종 + 러너 happy / error path / `onCreated` 미전달 / 응답 형태 4 종 / 빈 입력 2 종 / in-flight. web 2898 · 루트 13208 test green, `test:cov`(line·function ≥ 80%) · lint · web build green.
- 4-게이트 PASS: reviewer APPROVE(round 1/7) + PR comment 외부 존재 + integrator 자체 점검 + PR CI green.
- 잔여: REQ-079 재판정(자동 선택 동선 shipped 반영) 과 ADR-0058 `§Follow-ups (d)·(e)` closure 표기 doc slice.
