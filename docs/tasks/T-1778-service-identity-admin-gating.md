---
id: T-1778
title: AdminView ServiceIdentity 쓰기 축에 Admin+ RBAC gating 부착
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 270
estimatedFiles: 2
independentStream: web-admin-service-identity
dependsOn: [T-1777]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-admin-gating.test.tsx
created: 2026-08-29
plannerNote: P6 ADR-0058 §Follow-ups (d) 잔여 RBAC 축 — 쓰기 3 컨트롤 + 행 액션 slot 만 isAdmin fail-closed gating, 읽기(User+)는 유지
---

# T-1778 — AdminView ServiceIdentity 쓰기 축에 Admin+ RBAC gating 부착

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 4` 는 identity 축의
권한을 **조회 = User+ / 추가 · 수정 · 삭제 · primary 지정 = Admin+** 로 못 박았다. 그런데 T-1766 ~
T-1777 로 화면에 붙은 ServiceIdentity 관리 UI 는 **등급과 무관하게 전부 렌더된다** — `origin/main` 의
`AdminView.tsx` 에서 identity 조회 select · 목록 · 추가 폼 · 수정 폼 · 행 액션 slot 은 모두 `isAdmin`
삼항(`5115 행` ~ `5463 행`) **바깥** 에 있다. 결과적으로 User 등급 사용자에게 눌러도 401 / 403 만
돌아오는 쓰기 버튼이 그대로 노출되고, 기존 Admin 패널이 지키던 fail-closed 원칙(비-Admin 에게는
패널을 아예 마운트하지 않아 403 노이즈를 차단)과 어긋난다.

본 slice 는 ADR-0058 `§Follow-ups (d)` 의 **잔여 2 항목 중 RBAC gating 축** 을 닫는다 (남은 1 항목인
`(e)` api.md · requirements.md doc-sync 는 별도 direct task). 읽기 축은 `§Decision 4` 가 User+ 로
허용하므로 **gating 대상이 아니다** — 쓰기 축 3 컨트롤과 행 액션 slot 만 막는다.

## Required Reading

- `web/src/views/AdminView.tsx` — 다음 지점만: `NOT_ADMIN_NOTICE_TEXT`(`220 행` 부근) · `isAdminRole`
  (`560 행` 부근) · `isAdmin` 파생 `useMemo`(`3957 행` 부근) · 기존 Admin 패널 gating 삼항
  (`5115 행` 시작 ~ `5463 행` 의 `) : ( ... )}` 종료) · identity 축 JSX 블록(조회 select · 
  `<ServiceIdentityList>` · `<ServiceIdentityAddForm>` · 수정 대상 select · `<ServiceIdentityEditForm>`,
  `5580 행` ~ `5637 행` 부근).
- `web/src/views/AdminView.service-identity-row-actions-mount.test.tsx` — 승계할 spec harness
  (`ServiceIdentityList` prop 캡처 stub + `renderToStaticMarkup` + `../api/serviceIdentity`
  `importOriginal` partial mock + `/api/auth/me` 응답으로 등급 주입하는 `useApiResource` mock).
- `web/src/components/ServiceIdentityList.tsx` — `renderRowActions` 가 optional slot 이며 미전달 시
  markup 이 동일함(T-1774 하위 호환 계약).
- `docs/decisions/ADR-0058-service-identity-management-api.md` `§Decision 1` 표 + `§Decision 4`
  (조회 User+ / 편집 Admin+) + `§Follow-ups (d)`.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 identity 쓰기 축 전용 안내 문구 상수를 1 개 신설한다 (예:
      `SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT`). 기존 `NOT_ADMIN_NOTICE_TEXT` 를 **재사용하지 않는다**
      — 비-Admin 화면에 같은 문구가 두 번 뜨면 spec 의 텍스트 조회가 모호해지고 사람도 어느 패널
      이야기인지 구분할 수 없다. 문구는 한국어 한 줄(§12), `role="status"` 로 렌더한다.
- [ ] 쓰기 축 3 컨트롤 — `<ServiceIdentityAddForm>` · 수정 대상 `<select>` · `<ServiceIdentityEditForm>`
      — 을 `isAdmin` 삼항 안으로 옮겨 **Admin/SuperAdmin 일 때만 마운트** 하고, 그 외에는 위 안내
      문구 한 줄만 렌더한다. 판정은 기존 `isAdmin` 파생 값을 그대로 쓴다 (`isAdminRole` 재구현 ·
      새 등급 helper 신설 금지).
- [ ] 행 액션 slot 도 같은 게이트를 탄다: `<ServiceIdentityList renderRowActions={...}>` 에
      `isAdmin` 이 false 면 `undefined` 를 내려 T-1774 의 slot 미전달 경로(행 액션 markup 0)로
      떨어뜨린다. slot factory 호출 자체를 조건부로 두지 말고 **전달 여부만** 분기해도 무방하다.
- [ ] 읽기 축은 등급 무관 렌더를 **유지** 한다 — identity 조회 `<select>` 와 `<ServiceIdentityList>`
      본체는 게이트 밖에 남긴다 (ADR-0058 `§Decision 4` GET = User+). 이 판단 근거를 gating 주석
      한 줄로 코드에 박제한다.
- [ ] 새 spec `web/src/views/AdminView.service-identity-admin-gating.test.tsx` 를 추가한다
      (colocated). harness 는 `AdminView.service-identity-row-actions-mount.test.tsx` 를 승계하고,
      `/api/auth/me` mock 응답의 `role` 값으로 등급을 주입한다.
- [ ] **happy-path test 1+**: `role: 'Admin'` 일 때 쓰기 축 3 컨트롤이 모두 렌더되고 캡처한
      `ServiceIdentityList` props 의 `renderRowActions` 가 함수이며, 안내 문구는 렌더되지 않는다.
      `role: 'SuperAdmin'` 도 동일하게 통과하는 test 1+.
- [ ] **error path test 1+**: `/api/auth/me` 조회가 실패(error 상태)했을 때도 throw 없이 렌더되고
      fail-closed(쓰기 컨트롤 0 · `renderRowActions === undefined` · 안내 문구 1)로 떨어진다.
- [ ] **분기 cover test**: (a) `isAdmin === true` 분기, (b) `isAdmin === false` 분기, (c) 등급 조회
      진행 중(`loading`)일 때의 false 분기 — 각 1+ test. 읽기 축(조회 select + 목록)이 세 경우
      **모두** 렌더된다는 것도 함께 고정한다.
- [ ] **negative cases 충분 cover**: `role: 'User'` · `role` 필드 누락(undefined) · `role: null` ·
      빈 문자열 · 대소문자 불일치(`'admin'`) 5 종에서 각각 쓰기 컨트롤이 0 개이고
      `renderRowActions` 가 전달되지 않음 — 각 1+ test. 추가로 비-Admin 상태에서 identity 조회
      select 가 여전히 존재해 읽기 축이 막히지 않음을 검증하는 test 1+.
- [ ] `pnpm --dir web test` 전량 green, 루트 `pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint` + `pnpm --dir web build` green (`noUnusedLocals` 위반 0 — 게이트 밖으로 밀려난
      state / 핸들러가 미사용이 되지 않아야 한다).
- [ ] diff ≤ 300 LOC / 파일 ≤ 2 개 유지. JSX 이동으로 재들여쓰기 diff 가 커지므로, spec 은 위 필수
      항목 범위로 test 개수를 좁힌다 (slot factory · props factory · 러너 계약 재검증은
      T-1771 ~ T-1776 spec 책임 — 중복 금지).

## Out of Scope

- **api.md · requirements.md doc-sync** (ADR-0058 `§Follow-ups (e)`) — 별도 direct task.
- **backend guard 변경** — controller 의 `@Roles` stack 은 이미 `(b)` slice 에서 배선됐다. `src/`
  는 한 줄도 건드리지 않는다.
- **identity 조회 fetch 자체의 등급 gating** — 게이트로 조회 select 가 사라지지 않으므로 읽기 fetch
  는 그대로 둔다. 쓰기 발사 경로의 추가 방어(비-Admin 상태에서 러너 no-op)는 backend 403 이 이미
  막고 있으므로 본 slice 범위 밖 (필요 시 Follow-ups).
- **다른 패널의 gating 재조정** — 기존 Admin 패널 삼항(`5115 행`)의 내용 · 인원(Person) 관리 섹션 ·
  그룹 / 파트 섹션은 손대지 않는다.
- **새 컴포넌트 · 새 순수 helper 신설** — 본 slice 는 기존 `isAdmin` 파생과 JSX 배치만 다룬다.
- **새 dependency 추가 · 스타일링 · 접근성 개선(문구 외)**.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
