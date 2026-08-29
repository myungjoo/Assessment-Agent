---
id: T-1781
title: AdminView 인원 수정 성공 후 ServiceIdentity 대상 자동 선택 결선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-079]
independentStream: service-identity-web-ui
dependsOn: [T-1780]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.person-update-identity-autoselect.test.tsx
estimatedDiff: 170
estimatedFiles: 2
created: 2026-08-29
plannerNote: P5 / ADR-0058 §Follow-ups (d) 잔여 — 인원 수정 동선의 identity 대상 자동 선택 (REQ-079 잔여 (1) 마지막 한 칸)
---

# T-1781 — AdminView 인원 수정 성공 후 ServiceIdentity 대상 자동 선택 결선

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` 의 잔여 동선이다.
[T-1780](T-1780-person-create-identity-target-autoselect.md) 이 **인원 생성** 성공 후 그 인원을 identity
대상으로 자동 선택하는 결선을 끝냈지만, `docs/requirements.md` 의 REQ-079 행이 잔여 (1) 로 적어 둔
"인원 추가 **· 수정** 성공 후 그 인원을 identity 대상으로 자동 선택" 중 **수정 동선** 은 아직 비어
있다 — `runUpdatePerson` 은 성공 시 `bumpRefresh()` + `closeEdit()` 만 하고 방금 수정한 인원 id 를
버려서, 사용자가 `5591 행` 조회 select 를 손으로 다시 골라야 매핑을 이어 붙일 수 있다.
본 slice 는 생성 축과 동형으로 optional 콜백 1 개만 절단해 그 한 칸을 메운다 (수정은 대상 id 가
이미 입력이라 T-1780 의 응답 파싱 helper 가 불필요 — 그만큼 더 작다).

## Required Reading

- `web/src/views/AdminView.tsx` `2991~3015 행` — `UpdatePersonDeps` interface (콜백을 추가할 지점)
- `web/src/views/AdminView.tsx` `3023~3070 행` — `runUpdatePerson` 본체 (성공 분기 `bumpRefresh()` + `closeEdit()`)
- `web/src/views/AdminView.tsx` `3964~3995 행` — 컨테이너 `handleUpdatePerson` 의 deps 주입부 + `editingPersonId`
- `web/src/views/AdminView.tsx` `3683~3712 행` — `handleCreatePerson` 의 `onCreated` 배선 (T-1780 선례 · mirror 대상)
- `web/src/views/AdminView.person-create-identity-autoselect.test.tsx` — spec 구조 · mock 주입 관례 (mirror 대상)
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)`

## Acceptance Criteria

- [ ] `UpdatePersonDeps` 에 optional `onUpdated?: (personId: string) => void` 를 추가한다. optional 이므로
      기존 호출처·기존 spec 은 무수정으로 통과해야 한다 (하위 호환).
- [ ] `runUpdatePerson` 의 **성공 분기에서만** `deps.onUpdated?.(id.trim())` 을 호출한다 — 실패(catch)
      분기와 3 가드(빈/공백 id · `updating` in-flight · 빈 patch) no-op 경로에서는 호출하지 않는다.
      `bumpRefresh()` · `closeEdit()` 의 기존 호출 순서·개수는 바꾸지 않는다.
- [ ] 컨테이너 `handleUpdatePerson` 의 deps 에 `onUpdated: (personId) => setSelectedIdentityPersonId(personId)`
      를 주입하고, T-1780 선례처럼 근거(ADR-0058 `§Follow-ups (d)` · REQ-079 · 재조회 지연으로 option 이
      잠깐 비어 보일 수 있음)를 한국어 주석으로 박제한다. `useCallback` 의존성 배열 정합을 유지한다.
- [ ] 신규 colocated spec `web/src/views/AdminView.person-update-identity-autoselect.test.tsx` 를 추가한다
      (파일명·구조는 `AdminView.person-create-identity-autoselect.test.tsx` mirror).
- [ ] **happy path** — 정상 id + 비어있지 않은 patch 로 `runUpdatePerson` 성공 시 `onUpdated` 가 그 id 로
      정확히 1 회 호출되고, `bumpRefresh` · `closeEdit` 도 각각 1 회 호출되는 test 1+.
- [ ] **error path** — `update` 가 throw (예: 409 email 중복 · 404 미존재 · 네트워크 실패) 할 때
      `onUpdated` 가 **호출되지 않고** `setUpdateError` 만 세팅되며 throw 가 새지 않는 test 1+.
- [ ] **분기 cover** — 3 가드 분기 각각 (빈 id · 공백만 든 id · `updating: true` · 빈 patch) 에서
      `onUpdated` 미호출 + `update` 미발사를 검증하는 test 각 1+, 그리고 `onUpdated` 를 아예 주입하지
      않은 deps 로도 성공 경로가 throw 없이 끝나는 test 1+ (optional 콜백 분기).
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: 공백만 든 id(경계값) · 빈 patch(변경 필드 0) ·
      in-flight 재호출(이중 PATCH 억제) · `onUpdated` 미전달(undefined) · 실패 후 `closeEdit` 미호출(편집 유지) ·
      성공 시 넘어가는 id 가 trim 된 값인지(앞뒤 공백 섞인 id).
- [ ] 배선 소스 guard — `handleUpdatePerson` 의 deps 에 `onUpdated` 가 실제로 배선돼 있고 그 대상이
      `setSelectedIdentityPersonId` 임을 소스 텍스트로 확인하는 test 1+ (T-1780 spec 의 배선 guard mirror).
- [ ] `pnpm --dir web test` · 루트 `pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 루트 `pnpm lint` · `pnpm --dir web build` green.

## Out of Scope

- `docs/requirements.md` REQ-079 재판정 · `docs/PLAN.md` 갱신 — 별도 direct doc slice (본 slice 머지 후).
- [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)·(e)` closure 표기 — 별도 direct doc slice.
- backend (`src/`) · `prisma/schema.prisma` · e2e 변경 0.
- 새 컴포넌트 · 새 JSX 구획 · 새 외부 dependency 추가 금지.
- 인원 수정 응답 body 소비(낙관 갱신) 금지 — 기존대로 `bumpRefresh()` 권위 재조회만 유지.
- 인원 삭제 · Deactivate 동선의 identity 대상 처리는 범위 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)

## 결과 (2026-08-29 11:52Z DONE)

- `commitMode: pr` — PR [#1408](https://github.com/myungjoo/Assessment-Agent/pull/1408) squash `4e50c061` 머지 후 branch 삭제.
- `web/src/views/AdminView.tsx` 의 `UpdatePersonDeps` 에 optional `onUpdated` 를 추가하고 성공 분기에서만 `deps.onUpdated?.(id.trim())` 1 회 호출하도록 절단, 컨테이너 `handleUpdatePerson` 의 deps 에 `setSelectedIdentityPersonId` 를 배선했다 (2 파일 `+164/-0`, backend·JSX·새 dependency 0 · 콜백이 optional 이라 기존 호출처 무수정 하위 호환).
- 신규 colocated spec `AdminView.person-update-identity-autoselect.test.tsx` 로 R-112 4 종 cover — happy 1 · error 3 종 · 3 가드 · in-flight · 훅 미전달 · trim 경계 · 배선 소스 guard. web 2909 · 루트 13208 test green, `test:cov`(line·function ≥ 80%) · 루트 lint · web build green.
- 4-게이트 PASS: reviewer APPROVE(round 1/7, PR comment 외부 존재) + integrator 자체 점검 + PR CI green.
- 잔여: REQ-079 재판정(생성·수정 두 동선 shipped 반영) 과 ADR-0058 `§Follow-ups (d)·(e)` closure 표기 doc slice.
