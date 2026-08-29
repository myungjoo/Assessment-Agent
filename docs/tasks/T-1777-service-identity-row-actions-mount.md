---
id: T-1777
title: AdminView 에 ServiceIdentityRowActions 컨테이너 마운트 결선
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 270
estimatedFiles: 2
independentStream: web-admin-service-identity
dependsOn: [T-1775, T-1776]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-row-actions-mount.test.tsx
created: 2026-08-29
plannerNote: P6 ADR-0058 §Follow-ups (d) 마감 마운트 — 준비된 러너·factory 7 겹을 컨테이너 state + deps memo + renderRowActions 로 결선
---

# T-1777 — AdminView 에 `ServiceIdentityRowActions` 컨테이너 마운트 결선

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` (AdminView 편집 UI)
의 행 액션 축은 **부품이 전부 준비됐지만 화면에 하나도 붙어 있지 않은 상태** 다. 삭제·primary 러너
(T-1769 / T-1770) · 행별 플래그 helper(T-1771) · 행 어댑터(T-1772) · props 조립 factory(T-1773) ·
`ServiceIdentityList` 의 `renderRowActions` slot(T-1774) · slot factory(T-1775) · 편집 진입 helper
(T-1776) 까지 일곱 겹이 머지됐는데, `origin/main` 의 `AdminView.tsx` 에서 `renderRowActions` 는 아직
**주석 안에만** 존재한다 (실 마운트 0 hit). 즉 사용자는 지금도 목록에서 identity 를 삭제하거나 primary
로 지정할 수 없고, 준비된 코드는 소비처 없는 상태로 남아 있다.

본 slice 는 그 마지막 결선 한 겹만 절단한다 — 컨테이너 state 4 종(진행 id · 삭제 확인 id · 실패 귀속
id · 실패 문구) + in-flight gate + wiring deps memo + `<ServiceIdentityList renderRowActions={...} />`.
새 순수 helper 는 만들지 않고 이미 머지된 factory 를 호출만 한다(로직 재구현 0). 이로써 R-182/R-183
(PLAN.md 132 행) 의 조회/추가/수정/삭제/primary 5 축이 UI 에서 모두 발사 가능해진다.

## Required Reading

- `web/src/views/AdminView.tsx` — 다음 구간만: `2261~2300` (행 어댑터 deps), `2334~2360`
  (`ServiceIdentityRowActionsWiringDeps` 계약 — 본 task 가 채워야 할 14 필드), `2440~2450`
  (`buildServiceIdentityRowActionsSlot`), `2450~2500` (`beginServiceIdentityEdit` + deps),
  `2656~2682` (`createInFlightIdGate`), `4610~4620` (gate 를 컨테이너에서 쓰는 선례 —
  `changingRoleIdRef` + `useMemo`), `3400~3500` (service identity 조회 · nonce · 편집 state 4 종),
  `5498~5520` (`<ServiceIdentityList>` 현 마운트 지점)
- `web/src/components/ServiceIdentityList.tsx` — `renderRowActions` prop 계약 (`46 행`, `97 행`)
- `web/src/components/ServiceIdentityRowActions.tsx` — `ServiceIdentityRowActionsProps` 표면
- `web/src/api/serviceIdentity.ts` — `deleteServiceIdentity` · `setPrimaryServiceIdentity` 시그니처
- `web/src/views/AdminView.service-identity-wiring.test.tsx` — 컨테이너 spec harness 선례
  (`vi.mock` prop 캡처 stub + `renderToStaticMarkup`). 본 task 의 새 spec 은 이 패턴을 승계한다.
- `web/src/views/AdminView.service-identity-row-slot.test.tsx` — slot factory 계약이 이미 어디까지
  고정돼 있는지 (중복 test 작성 금지 판단용)
- `docs/decisions/ADR-0058-service-identity-management-api.md` — `§Decision 2` (1 인원 1 primary) ·
  `§Follow-ups (d)`
- `docs/decisions/ADR-0040-web-test-harness.md` — `§5` (RTL 상태 구동 렌더 test 불가 — spec 설계 제약)

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 컨테이너에 행 액션 state 4 종을 추가한다: 진행 중 행 id(+ 동기
      `useRef` 사본) · 삭제 확인 행 id · 실패 귀속 행 id · 실패 문구. 진행 id 는 반드시 기존
      `createInFlightIdGate(ref, setState)` 로 감싸 gate 로 read / write 한다 (`changingRoleGate` 선례
      그대로 — 같은 tick 이중 발사 창을 ref 로 닫는다). gate 를 새로 구현하지 않는다.
- [ ] `beginServiceIdentityEdit`(T-1776) 를 컨테이너 setter 6 종에 묶은 `onEdit` 콜백을 만든다
      (`useCallback`). 진입 로직을 인라인으로 다시 쓰지 않는다.
- [ ] `ServiceIdentityRowActionsWiringDeps` 14 필드를 채우는 `useMemo` 를 두되, `remove` 에는
      `deleteServiceIdentity`, `setPrimary` 에는 `setPrimaryServiceIdentity` 를 꽂는다(두 primitive 는
      시그니처가 같아 교차 배선이 컴파일을 통과하므로 spec 이 인자까지 검증해야 한다). `personId` 는
      identity 조회용 선택 인원(`selectedIdentityPersonId`), `describeError` 는 `toErrorMessage`,
      `bumpRefresh` 는 기존 `serviceIdentitiesRefreshNonce` bump 를 재사용한다.
- [ ] `<ServiceIdentityList>` 에 `renderRowActions={buildServiceIdentityRowActionsSlot(deps)}` 를
      내려보낸다 (slot 함수는 `useMemo` 로 안정화). props 를 손으로 조립하지 않는다.
- [ ] 새 spec `web/src/views/AdminView.service-identity-row-actions-mount.test.tsx` 를 추가한다
      (colocated). harness 는 `AdminView.service-identity-wiring.test.tsx` 선례 —
      `ServiceIdentityList` prop 캡처 stub + `renderToStaticMarkup`, `../api/serviceIdentity` 는
      `importOriginal` partial mock 으로 두 발사 primitive 만 치환.
- [ ] **happy-path test 1+**: 캡처한 `ServiceIdentityList` props 에 `renderRowActions` 함수가 실려
      있고, 행 1 건을 넣어 호출하면 `ServiceIdentityRowActions` element 가 반환되며 `personId` ·
      `identityId` · `isPrimary` 등 계약 props 가 선택 인원/행 값 그대로 실린다.
- [ ] **error path test 1+**: 반환 element 의 `onDelete` 를 확인 단계까지 진행시켜 실 발사했을 때
      `deleteServiceIdentity` 가 reject 해도 렌더/호출이 throw 하지 않고 실패 문구 경로로 흡수된다
      (러너 계약 — `describeError` 가 문자열을 만든다).
- [ ] **분기 cover test**: (a) 인원 미선택(빈 문자열)일 때도 `renderRowActions` 는 제공되지만
      `personId` 가 빈 값이라 러너 가드가 no-op, (b) identity 응답이 비배열(객체 · null)일 때 목록
      방어가 유지되고 마운트가 깨지지 않음, (c) 초기 상태에서 행 플래그 3 종(진행 · 삭제 확인 ·
      실패 문구)이 모두 꺼짐 — 각 1+ test.
- [ ] **negative cases 충분 cover**: 행 id 가 빈 문자열/공백뿐일 때 액션이 전체 no-op · `onDelete`
      첫 호출이 확인 단계만 열고 DELETE 를 발사하지 않음 · `onSetPrimary` 호출이
      `setPrimaryServiceIdentity` 만 부르고 `deleteServiceIdentity` 는 부르지 않음(교차 배선 차단) ·
      그 역방향 1 건 · `onEdit` 이 함수로 실려 있고 호출이 throw 하지 않음 — 각 1+ test.
- [ ] `pnpm --dir web test` 전량 green, 루트 `pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint` + `pnpm --dir web build` green (`noUnusedLocals` 위반 0 — 추가한 state 는 모두
      deps memo 가 소비해야 한다).
- [ ] diff ≤ 300 LOC / 파일 ≤ 2 개 유지. spec 이 커져 cap 이 위태로우면 test 개수를 위 필수 항목
      범위로 좁힌다 (slot factory · props factory 계약 재검증은 T-1773/T-1775 spec 책임이므로 중복
      금지).

## Out of Scope

- Admin RBAC gating (행 액션 노출 권한 분기) — 다음 slice 책임.
- `requirements.md` REQ-078 / REQ-079 재판정 · PLAN.md 132 행 checkbox flip 등 doc-sync (direct task 로 분리).
- 이미 머지된 러너 · 플래그 helper · 어댑터 · props factory · slot factory · 편집 진입 helper 의
  **본문 수정** (호출만 한다. 계약 변경이 필요해 보이면 Follow-ups 에 적는다).
- `ServiceIdentityList` · `ServiceIdentityRowActions` 컴포넌트 본문 수정.
- backend (`src/`) · Prisma schema · api client(`web/src/api/serviceIdentity.ts`) 변경.
- 스타일/CSS · 섹션 내비게이션 개선 (PLAN.md 133 행 별도 축).
- e2e · smoke spec 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)

---

## 완료 기록

- **완료 시각**: 2026-08-29T07:56:58Z (PR [#1405](https://github.com/myungjoo/Assessment-Agent/pull/1405) squash `ff78a38b`)
- **결과 요약**: `web/src/views/AdminView.tsx` 컨테이너에 행 액션 state 4 종을 배치하고 기존
  `createInFlightIdGate` 로 in-flight 를 감쌌다. `beginServiceIdentityEdit` 를 `onEdit` useCallback 으로
  묶고, wiring deps 14 필드를 `useMemo` 로 안정화해 `buildServiceIdentityRowActionsSlot` 결과를
  `ServiceIdentityList` 의 `renderRowActions` 로 전달했다 (remove=`deleteServiceIdentity` /
  setPrimary=`setPrimaryServiceIdentity` 정배선, 교차 없음). 새 순수 helper 신설 0 — 준비된 7 겹을
  소비만 했다. 2 파일 `+275/-1`.
- **검증**: 신규 colocated spec 10 케이스(happy 1 · error path 1 · 분기 3 · negative 5 — 교차 배선
  양방향 포함) 로 R-112 4 종 cover. web 2872 test · 루트 13208 test green, `pnpm test:cov`
  (line/function 80%) 통과, 루트 lint + web build green.
- **4-게이트**: reviewer APPROVE(round 1/7, finding 0) + PR comment 외부 post + integrator 자체 점검
  + PR CI green 모두 PASS → squash 머지 + branch 삭제.
