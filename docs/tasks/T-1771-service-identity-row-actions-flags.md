---
id: T-1771
title: AdminView 에 ServiceIdentityRowActions 행별 플래그 순수 파생 helper deriveServiceIdentityRowActionsFlags 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1770]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-row-flags.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열세 번째 web slice: RowActions 마운트 전 행별 플래그 파생만 절단"
---

# T-1771 — AdminView 에 ServiceIdentityRowActions 행별 플래그 순수 파생 helper 신설

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. 읽기 ([T-1766](T-1766-adminview-service-identity-list-wiring.md)) · 추가 ([T-1767](T-1767-adminview-service-identity-create-wiring.md)) · 수정 ([T-1768](T-1768-adminview-service-identity-update-wiring.md)) 축이 배선됐고, 삭제 ([T-1769](T-1769-service-identity-delete-runner.md)) · primary ([T-1770](T-1770-service-identity-set-primary-runner.md)) 축은 **순수 러너까지** 올라와 있다. 남은 건 `ServiceIdentityRowActions` 마운트 한 겹이다.

그 마운트 slice 는 (a) 행별 in-flight id · 삭제 확인 id · 실패 문구 귀속 state, (b) 삭제 · primary 두 축의 `useCallback` 핸들러, (c) 목록 행 map 안의 JSX 마운트를 한꺼번에 담아야 한다. 직전 3 개 배선 slice 가 **각각 정확히 `+300` LOC** (T-1766 · T-1767 · T-1768) 로 cap (≤ 300 LOC / ≤ 5 파일) 을 꽉 채운 실적을 보면, 축 2 개를 동시에 배선하는 이번 겹은 한 slice 에 들어가지 않는다.

그래서 본 slice 는 그 마운트에서 **판정 로직만** 먼저 떼어낸다 — 행 하나가 "확인 단계인가 / 진행 중인가 / 어떤 실패 문구를 보여야 하는가" 를 결정하는 순수 파생 helper 다. 이 판정을 마운트 JSX 안 인라인 식으로 두면 [`deriveInstanceAccessFormFlags`](../../web/src/views/AdminView.tsx) (T-1168) 가 막았던 것과 같은 결함 — 한 행의 실패 문구가 **모든 행에 복제** 되거나, 미선택 sentinel `''` 이 **모든 행과 일치** 해 전 행이 확인 단계로 열리는 창 — 이 어떤 test 도 깨지 않고 지나간다. [ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 로 jsdom/RTL 상태 구동 렌더 test 가 불가한 현 harness 에서는 helper 직접 호출만이 그 진리표를 고정할 수 있다.

## Required Reading

- `web/src/views/AdminView.tsx` `2164~2195 행` — 승계할 정본 선례 `InstanceAccessFormInput` / `InstanceAccessFormFlags` / `deriveInstanceAccessFormFlags` (T-1168). 인자 → 반환 순수 helper, React import · state · 부수효과 0, 인자 객체 무변형, "(a) 결함 / (b) 그래서" 2 문단 주석 형식. 본 slice 는 이 형식을 그대로 따른다.
- `web/src/components/ServiceIdentityRowActions.tsx` `35~53 행` — 소비처의 props 계약. 본 helper 가 채워야 할 3 개는 `confirmingDelete?: boolean` · `loading?: boolean` · `error?: string` 이며, `loading` 이 다른 어떤 분기보다 우선해 전 버튼을 막고 `error` 는 truthy 일 때만 `role="alert"` 로 렌더된다. **본 slice 는 이 파일을 수정하지도 import 하지도 않는다.**
- `web/src/views/AdminView.tsx` `2355~2380 행` — 행별 in-flight id 선례 `createInFlightIdGate` (T-1165). 마운트 slice 가 진행 id 를 어떻게 들지의 근거이며, 본 helper 는 그 id 를 **읽기만** 한다 (gate 를 수정하지 않는다).
- `web/src/views/AdminView.test.tsx` `9544~9630 행` — 승계할 spec 패턴 (진리표 전량 고정 + 같은 인자 반복 호출 동일 결과 + 컨테이너가 helper 를 실제로 쓰는지 받치는 소스 문자열 drift guard). 단 본 slice 의 spec 은 **아래 신규 별도 파일** 에 쓴다 (거대 파일 추가 편집 회피).
- `web/src/views/AdminView.tsx` `5456~5500 행` test-only export 목록 — 신규 helper 를 `deriveInstanceAccessFormFlags` 인접에 추가해야 spec 이 import 할 수 있다.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 함수 `deriveServiceIdentityRowActionsFlags(input: ServiceIdentityRowFlagsInput): ServiceIdentityRowActionsFlags` 와 두 인터페이스를 신설한다. 입력은 최소 `identityId: string` · `confirmingDeleteId?: string` · `busyIdentityId?: string` · `errorIdentityId?: string` · `errorText?: string`, 반환은 `{ confirmingDelete: boolean; loading: boolean; error: string | undefined }` (`ServiceIdentityRowActions` props 3 개와 1:1).
- [ ] 판정 규칙 4 종을 구현한다: (a) `identityId` 가 falsy · 빈 · 공백뿐이면 세 값 모두 "꺼짐" (`false` / `false` / `undefined`) — 미선택 sentinel `''` 이 전 행과 일치하는 사고 차단, (b) `confirmingDelete` 는 `confirmingDeleteId` 가 `identityId` 와 **일치할 때만** true, (c) `loading` 은 `busyIdentityId` 가 `identityId` 와 **일치할 때만** true (다른 행의 진행이 이 행을 잠그지 않는다), (d) `error` 는 `errorIdentityId` 가 `identityId` 와 일치하고 `errorText` 가 truthy 일 때만 그 문구, 그 외에는 `undefined` — 한 행의 실패 문구가 다른 행에 복제되는 사고 차단. 비교 전 `trim()` 정규화하며, 그 근거를 "(a) 결함 / (b) 그래서" 2 문단 주석으로 남긴다.
- [ ] helper 는 **순수** 하다 — `throw` 0, React hook 0, 인자 객체 변형 0, 모듈 밖 state 참조 0. 같은 인자로 두 번 호출하면 같은 결과.
- [ ] 신규 helper 와 두 타입을 `web/src/views/AdminView.tsx` 하단 test-only export 블록에 추가한다 (`deriveInstanceAccessFormFlags` 인접, 타입은 `export type` 목록).
- [ ] 신규 colocated spec `web/src/views/AdminView.service-identity-row-flags.test.tsx` 를 만들고, **happy-path** 1+ 를 담는다 — 대상 행이 확인 단계 + 진행 중 + 자기 실패 문구를 모두 가질 때 세 값이 모두 켜져 반환된다.
- [ ] **error path** 1+ — `errorText` 가 있어도 `errorIdentityId` 가 다른 행이면 `error` 가 `undefined` 이고, `errorIdentityId` 가 일치해도 `errorText` 가 빈 문자열 · `undefined` 면 `undefined` 다.
- [ ] **분기 (flow) cover** — 위 판정 규칙 (a) ~ (d) 각 분기의 참 · 거짓 양쪽을 각각 1+ test 로 고정한다 (진리표 형태 권장).
- [ ] **negative cases 충분 cover** — 예외 상황 각 1+ test: `identityId` 가 빈 문자열 · 공백뿐, 세 id 가 모두 `undefined` (아무 것도 켜지지 않음), 다른 행이 진행 중일 때 이 행이 잠기지 않음, 다른 행이 확인 단계일 때 이 행이 열리지 않음, 앞뒤 공백만 다른 id 가 같은 행으로 취급됨, 인자 객체가 호출 후에도 변형되지 않음, 같은 인자 반복 호출 시 결과 동일.
- [ ] `web/src/views/AdminView.tsx` 의 **컨테이너 본문 · JSX 는 이번에 수정하지 않는다** — helper 는 다음 마운트 slice 가 소비하므로, 본 slice 의 spec 에는 소스 문자열 drift guard 를 넣지 않는다 (미소비 상태를 guard 가 곧바로 red 로 만들기 때문). 대신 helper 주석에 "소비처는 후속 마운트 slice" 를 1 줄 남긴다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — web coverage threshold 도 유지.

## Out of Scope

- `ServiceIdentityRowActions` 마운트 (JSX map · 컨테이너 state · `useCallback` 핸들러) — 다음 slice.
- `runDeleteServiceIdentity` · `runSetPrimaryServiceIdentity` 수정 — 이미 머지된 계약을 그대로 둔다.
- `web/src/components/ServiceIdentityRowActions.tsx` · `ServiceIdentityList.tsx` · `web/src/api/serviceIdentity.ts` 수정.
- backend (`src/`) · prisma schema · 워크플로 · `package.json` 수정, 새 dependency 추가.
- Admin RBAC gating, `docs/requirements.md` REQ-078/079 재판정 doc-sync.
- `web/src/views/AdminView.test.tsx` (거대 파일) 에 case 추가 — 신규 별도 spec 파일만 쓴다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

## 완료 기록

- 완료: 2026-08-29T01:55:03Z (PR [#1399](https://github.com/myungjoo/Assessment-Agent/pull/1399) squash `d5ed711e`)
- 결과: `web/src/views/AdminView.tsx` 에 `deriveServiceIdentityRowActionsFlags` + 인터페이스 2 개 신설, colocated spec 1 개 추가 (2 파일 `+183/-0`). 판정 규칙 (a)~(d) + trim 정규화 + "(a) 결함 / (b) 그래서" 2 문단 주석을 `deriveInstanceAccessFormFlags`(T-1168) 형식으로 박제. 컨테이너 본문·JSX 무수정. reviewer APPROVE(round 1/7) → 4-게이트 PASS.
- test: 신규 spec 25 test — happy 1 · error path 3 · 분기 진리표 10 · negative 11. web 94 files / 2785 test green, 루트 lint · web build(tsc --noEmit + vite) green, CI 2 job 전량 pass.
