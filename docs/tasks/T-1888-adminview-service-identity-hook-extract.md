---
id: T-1888
title: AdminView 의 ServiceIdentity 축 prelude(조회 1 + 파생 3 + 상태 13 + 핸들러·게이트 11 = 28 선언)를 useAdminServiceIdentities hook 으로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
independentStream: adminview-god-component-refactor
dependsOn: [T-1887]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminServiceIdentities.ts
  - web/src/views/useAdminServiceIdentities.test.ts
estimatedDiff: 810
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`492 행` ~ `710 행` 의 ServiceIdentity 축 조회 · 파생 · state · 핸들러 · 행 액션 slot 을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminServiceIdentities(initialSelectedIdentityPersonId, initialEditingIdentityId)` 시그니처와 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0) · (b) 신규 로직 0 LOC (`useApiResource<ServiceIdentityRow[]>(serviceIdentitiesPath)` 조회, `serviceIdentities`/`editingIdentity`/`serviceIdentityRowActionsDeps` 파생, 러너 2 종 주입, `createInFlightIdGate` 게이트, `buildServiceIdentityRowActionsSlot` slot 조립이 전부 본문 무변경 이동이고 `useMemo`/`useCallback` deps 배열도 그대로) · (c) 기존 spec 무수정 통과 — planner 가 AdminView 소스를 `readFileSync` 로 읽는 drift-guard **17 파일을 전수 검사**한 결과 본 축 심볼을 anchor 로 쓰는 spec 이 **0 건**이고, 이름에 identity 가 든 2 건(`AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx`)은 **인원 축 핸들러의 `onCreated: (personId) => setSelectedIdentityPersonId(personId)` 배선**을 anchor 로 잡으므로 그 setter 를 hook 반환으로 노출해 호출부를 글자-동일 유지하면 green 이다. 이동 219 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 여유 있게 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 넷째 본문 분해 슬라이스 — ServiceIdentity 축 hook 화, head 9d047760 좌표 재실측 · 축 밖 의존 0 · drift-guard anchor 0 건"
---

# T-1888 — AdminView 의 ServiceIdentity 축 prelude 를 useAdminServiceIdentities hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook 모듈)** 의 넷째 슬라이스다. [T-1884](T-1884-adminview-import-export-hook-extract.md)(import/export 축 `-173 줄`) · [T-1886](T-1886-adminview-collection-targets-hook-extract.md)(수집 대상 축 `-201 줄`) · [T-1887](T-1887-adminview-llm-provider-hook-extract.md)(LLM provider · 난이도 축 `-241 줄`) 이 같은 방식으로 셋을 마감했고, 본 task 는 bullet 인벤토리 ③ **ServiceIdentity 축** 을 옮긴다. 이 축은 남은 축 중 **연속 블록으로 가장 큰 mass(219 줄)** 이면서 뒤에서 보듯 축 밖 의존이 0 이라, 목표선(≤ 2,000 줄) 까지 남은 `-835 줄` 을 줄이는 가장 값싼 다음 절단면이다.

**issue-still-relevant pre-check 실측** (head [`9d047760`](https://github.com/myungjoo/Assessment-Agent/commit/9d047760), working tree == origin/main, `git status` clean):

- ① 목적지 `web/src/views/useAdminServiceIdentities.ts` 는 main 에 **미존재** — `ls web/src/views | grep '^useAdmin'` 이 `useAdminImportExport.{ts,test.ts}` · `useAdminCollectionTargets.{ts,test.ts}` · `useAdminLlmProviders.{ts,test.ts}` **6 개만** 보고한다. 동일 의도 미안착.
- ② PLAN bullet 의 좌표(`501 행` ~ `719 행`)와 LOC(`3,450 줄`)은 T-1884 · T-1886 · T-1887 머지분만큼 stale 하므로 **본 task 가 좌표를 직접 재실측**했다: `wc -l web/src/views/AdminView.tsx` = **2,835 줄**, 대상 블록은 선행 주석 포함 `492 행` ~ `710 행`(**219 줄, 연속**)이고 구성은 조회 1(`524 행` destructure) + 경로 1(`512 행` `serviceIdentitiesPath`) + 파생 3(`532 행` `serviceIdentities` · `589 행` `editingIdentity` · `677 행` `serviceIdentityRowActionsDeps`) + slot 1(`707 행` `serviceIdentityRowActionsSlot`) + 상태 13 + gate 2(`652 행` `identityActionBusyIdRef` · `653 행` `identityActionGate`) + 핸들러 · 리셋 7(`499` `handleIdentityPersonChange` · `550` `handleCreateServiceIdentity` · `594` `handleEditTargetChange` · `602` `endServiceIdentityEdit` · `608` `handleUpdateServiceIdentity` · `660` `handleBeginServiceIdentityEdit`) = **28 선언**이다.
- ③ **축 밖 의존 0** — 블록의 비-주석 코드가 참조하는 외부 심볼은 `useState`/`useMemo`/`useCallback`/`useRef` · `useApiResource`/`toErrorMessage` · `buildServiceIdentitiesPath` · `buildServiceIdentityRowActionsSlot` · `createInFlightIdGate` · 러너(`runCreateServiceIdentity` · `runUpdateServiceIdentity` 및 deps factory 가 받는 나머지) · 타입뿐이며 **전부 모듈 최상위 import** 다. 다른 축의 state · nonce · 파생값을 읽는 줄이 **0 건**임을 블록 전체 식별자 집합 대조로 확인했다(`isAdmin` · `persons*` · `groups` · `members` · `parts*` · `providers*` · `selectedPersonId` 매칭 0).
- ④ **hook 파라미터 2 개** — 블록이 참조하는 props 유래 초기값은 `initialSelectedIdentityPersonId`(`496 행`) · `initialEditingIdentityId`(`580 행`) 둘뿐이라 hook 시그니처로 받는다([T-1884](T-1884-adminview-import-export-hook-extract.md) 의 `initialImportConfirmText` 선례 동형). `AdminViewProps` 정의(`386 행` · `388 행`)와 props destructure(`416 행` · `417 행`)는 AdminView 에 그대로 둔다.
- ⑤ 블록 밖에서 이 축 심볼을 참조하는 코드는 **JSX 소비처(`2350 행` ~ `2411 행`)** 와 **인원 축 핸들러 2 곳(`757 행` `handleCreatePerson` 의 `onCreated` · `1040 행` `handleUpdatePerson` 의 `onUpdated`)** 뿐이다. 후자는 `setSelectedIdentityPersonId(personId)` 를 호출하므로 hook 이 그 setter 를 반환해야 두 줄이 글자-동일로 남는다(그 두 줄을 anchor 로 잡는 drift-guard 2 건이 green 을 유지하는 조건 — 위 `exemptReason` (c)).
- ⑥ 이동해도 AdminView 의 관련 import 는 **하나도 지우지 않는다** — 축 러너 · 빌더 · 타입이 모두 배럴(`2703 행` ~ `2835 행`)의 재수출 대상이라 제거하면 배럴이 깨진다([T-1887](T-1887-adminview-llm-provider-hook-extract.md) 이 확인한 동일 제약).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `19 행` ~ `20 행`(`useApiResource`/`toErrorMessage`/`request` import), `407 행` ~ `418 행`(props destructure 와 두 초기값), `486 행` ~ `490 행`(직전 인원 조회 — 블록 시작점 기준), `492 행` ~ `710 행`(이동 대상 블록), `712 행` 이후(블록 종료 직후 인원 생성 축), `757 행` · `1040 행`(`setSelectedIdentityPersonId` 호출 2 곳), `2350 행` ~ `2411 행`(JSX 소비처), `2703 행` ~ `2835 행`(배럴 재수출)
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) — 직전 슬라이스가 확립한 hook 모듈 형식(헤더 주석 · 반환 literal · 배럴 미추가 원칙)
- [web/src/views/useAdminLlmProviders.test.ts](../../web/src/views/useAdminLlmProviders.test.ts) — probe 컴포넌트 + `createElement` + `renderToStaticMarkup` harness 선례(신규 dependency 0, `.test.ts` 확장자로 [check-spec-presence.sh](../../scripts/check-spec-presence.sh) 게이트 충족)
- [web/src/views/adminServiceIdentityRunners.ts](../../web/src/views/adminServiceIdentityRunners.ts) — 이미 분리된 축 러너와 `createInFlightIdGate` 의 주입 계약
- [web/src/views/adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) — `buildServiceIdentityRowActionsSlot` 이 받는 deps 계약(`677 행` ~ `704 행` 의 memo 가 조립하는 객체 형태)
- [web/src/views/AdminView.person-create-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-create-identity-autoselect.test.tsx) — `163 행` ~ `168 행` 의 `onCreated: (personId) => setSelectedIdentityPersonId(personId)` anchor(무수정 green 유지 대상 1)
- [web/src/views/AdminView.person-update-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-update-identity-autoselect.test.tsx) — `140 행` ~ `145 행` 의 `onUpdated` anchor(무수정 green 유지 대상 2)
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 순수 추출 3 조건 판정과 축별 인벤토리

## Acceptance Criteria

- [ ] 신규 [web/src/views/useAdminServiceIdentities.ts](../../web/src/views/useAdminServiceIdentities.ts) 가 AdminView `492 행` ~ `710 행` 의 **28 선언**(조회 1 + 경로 1 + 파생 3 + slot 1 + 상태 13 + gate 2 + 핸들러 · 리셋 7)을 **선행 주석까지 본문 무변경으로** 담고, `export function useAdminServiceIdentities(initialSelectedIdentityPersonId: string, initialEditingIdentityId: string)` 가 **파라미터 정확히 2 개**로 선언된다.
- [ ] hook 반환은 소비처가 실제로 쓰는 **23 심볼만** 공개한다 — `selectedIdentityPersonId` · `setSelectedIdentityPersonId` · `handleIdentityPersonChange` · `serviceIdentities` · `serviceIdentityLoading` · `serviceIdentityError` · `serviceIdentityRowActionsSlot` · `identityServiceInput`/`setIdentityServiceInput` · `identityExternalIdInput`/`setIdentityExternalIdInput` · `creatingServiceIdentity` · `createServiceIdentityError` · `handleCreateServiceIdentity` · `editingIdentityId` · `editingIdentity` · `handleEditTargetChange` · `identityEditExternalIdInput`/`setIdentityEditExternalIdInput` · `updatingServiceIdentity` · `updateServiceIdentityError` · `endServiceIdentityEdit` · `handleUpdateServiceIdentity`. **`serviceIdentitiesRefreshNonce` · `serviceIdentitiesPath` · `serviceIdentityData` · `identityActionBusyId` · `confirmingDeleteIdentityId` · `identityActionErrorId` · `identityActionErrorText` · `identityActionGate` · `identityActionBusyIdRef` · `handleBeginServiceIdentityEdit` · `serviceIdentityRowActionsDeps` 와 나머지 내부 setter 는 노출하지 않는다**(캡슐화 — T-1884/T-1886/T-1887 선례 승계. 단 `setSelectedIdentityPersonId` 는 인원 축 핸들러 2 곳이 부르므로 **예외적으로 노출**하고 그 사유를 hook 헤더 주석에 박제한다).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 **블록이 있던 자리 그대로**(인원 조회 `useApiResource<PersonRow[]>(personsPath)` 직후 · 인원 생성 입력 상태 직전) `const { ... } = useAdminServiceIdentities(initialSelectedIdentityPersonId, initialEditingIdentityId);` 로 되돌려 쓴다. **위치를 옮기면 안 된다** — 기존 spec 이 `useApiResource` mock 을 path 별로 라우팅하되 호출 순서에 의존하는 케이스가 있어 조회 순번이 바뀌면 red 가 된다.
- [ ] `757 행` `handleCreatePerson` 의 `onCreated: (personId) => setSelectedIdentityPersonId(personId)` 와 `1040 행` `handleUpdatePerson` 의 `onUpdated: ...` 두 줄이 **글자 하나도 바뀌지 않는다** — 두 identity-autoselect drift-guard spec 이 무수정 green 이어야 한다.
- [ ] JSX 의 ServiceIdentity 패널 구역(`2350 행` ~ `2411 행`) 과 배럴(`2703 행` ~ `2835 행`) 은 **한 글자도 바뀌지 않는다**(공개 표면 무변경이 순수 추출의 전제). 배럴이 재수출하는 축 관련 import(러너 · 빌더 · slot factory · 타입)도 **제거하지 않는다** — 제거하면 배럴이 깨져 기존 spec 이 red.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **2,660 줄 이하**(기준 2,835, 기대 순 감소 `-190` 줄 안팎)로 줄어든다.
- [ ] **happy-path unit test** — 신규 colocated spec [web/src/views/useAdminServiceIdentities.test.ts](../../web/src/views/useAdminServiceIdentities.test.ts) 가 probe 컴포넌트(`createElement` + `renderToStaticMarkup` 1 회 렌더, T-1887 harness 승계) 로 hook 을 호출해 초기 반환을 고정한다: `useApiResource` mock 이 `buildServiceIdentitiesPath(<주입 personId 또는 undefined>, 0)` 를 **1 회** 호출 · `serviceIdentities` 가 응답 배열 그대로 · 입력 2 개와 편집 입력이 빈 문자열 · `selectedIdentityPersonId`/`editingIdentityId` 가 주입 초기값 그대로 · 에러 2 종이 `undefined` · 핸들러 6 개와 setter 5 개가 모두 함수 · `serviceIdentityRowActionsSlot` 이 slot factory 반환값.
- [ ] **happy-path (러너 · slot 주입 계약)** — `vi.mock('./adminServiceIdentityRunners')` · `vi.mock('./adminServiceIdentityRowActions')` 로 대체한 뒤 `handleCreateServiceIdentity` · `handleUpdateServiceIdentity` 를 각각 호출해 대응 러너가 **1 회씩** 호출되고 주입 deps 의 키(입력값 · in-flight 가드 · `bumpRefresh` · 성공 후 리셋 콜백)가 이동 전과 동일한지, `buildServiceIdentityRowActionsSlot` 이 받는 deps 객체의 키 집합이 이동 전과 동일한지 검증한다.
- [ ] **error path unit test** — ① 러너 mock 이 reject 하는 Promise 를 반환할 때 핸들러가 **동기 throw 하지 않고** 그 Promise 를 그대로 전파한다(실패 문구 합성 책임은 러너에 있고 hook 은 위임만 한다는 이동 전 계약 고정) 1+ test. ② `useApiResource` mock 이 `error` 를 반환할 때 `serviceIdentityError` 가 그대로 표면화되고 `serviceIdentities` 가 빈 배열로 안전 착지 1+ test.
- [ ] **분기 cover** — 분기마다 1+ test: ① `serviceIdentitiesPath` 의 선택 인원 분기(선택값 있음 → 그 id 로 조회 / 빈 문자열 → `undefined` 로 idle) · ② `serviceIdentities` 의 `Array.isArray` 방어 분기(배열 / 비배열) · ③ `editingIdentity` 의 조회 분기(목록에 있는 id → 그 행 / 없는 id → `undefined`) · ④ `handleIdentityPersonChange` 의 값 갱신 분기(값 선택 / 빈 값 선택으로 미선택 복귀) · ⑤ `endServiceIdentityEdit` 의 리셋 분기(편집 id 비움 + 입력 초기화 + 직전 실패 문구 제거) · ⑥ `identityActionGate` 의 in-flight id 읽기/쓰기 분기(진행 없음 → `undefined` 읽기 / 진행 중 → 그 id 읽기).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: ① in-flight(`creatingServiceIdentity === true`) 상태에서 `handleCreateServiceIdentity` 재호출 시 러너에 넘어가는 가드 인자가 이동 전과 동일 · ② `handleUpdateServiceIdentity` 를 편집 대상 미선택(빈 `editingIdentityId`) 상태로 호출했을 때의 전달값(가드는 러너 책임 — hook 은 자체 판단 없이 위임) · ③ 조회 응답이 비정상 payload(`null` · 객체 · 문자열)일 때 `serviceIdentities`/`editingIdentity` 가 빈 값으로 안전 착지 · ④ 초기값 파라미터가 빈 문자열일 때 조회 path 가 idle 형태이고 편집 폼 대상이 미선택 · ⑤ hook 반환 객체가 내부 심볼(`serviceIdentitiesRefreshNonce` · `serviceIdentityData` · `identityActionGate` · `serviceIdentityRowActionsDeps` · `handleBeginServiceIdentityEdit`)을 **노출하지 않음**(캡슐화 회귀 가드).
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 green — 기존 web vitest **133 파일 3,944 test**(T-1887 기준선)가 **무수정** 통과하고, 신규 spec 만큼 파일 · test 수가 증가한다. 특히 service-identity 계열 렌더 spec **12 개**(`AdminView.service-identity-*.test.tsx`)가 무수정 green 이어야 한다(렌더 트리 무변경 확인).
- [ ] 루트 `pnpm test:cov` 로 line ≥ 80% / function ≥ 80% 임계 유지 — 본 task 는 `src/` 를 건드리지 않으므로 회귀 0 임을 확인한다.
- [ ] 착수 시 `grep -rln "readFileSync" web/src --include=*.test.* | xargs grep -ln "AdminView.tsx"` 로 drift-guard 목록을 **재실측**(planner 실측 17 개)해 본 축 심볼을 anchor 로 쓰는 spec 이 0 건보다 늘었는지 확인한다. 늘어 파일 cap(≤ 5) 을 넘기면 착수 전 Follow-ups 에 남기고 범위를 줄인다(LOC 만 면제 — 파일 cap 은 예외 없음).

## Out of Scope

- 다른 축(인원 · 그룹 · 멤버십 · 파트 · 사용자 관리 · 스케줄) 의 prelude 이동 — 한 슬라이스 한 축.
- JSX 섹션의 하위 컴포넌트화(PLAN `183 행` 의 경로 2) — 순수 추출 3 조건 (b) 미충족이라 별도 cap 안 슬라이스로 진행한다.
- 이동한 선언의 **본문 수정** — 리팩터 · 이름 변경 · 주석 재작성 · deps 배열 정리 · state 통합 전부 금지(신규 로직 0 LOC 이 `sizeExempt` 의 전제).
- `adminServiceIdentityRunners.ts` · `adminServiceIdentityRowActions.tsx` 의 본문 변경 및 배럴 재수출 목록 변경.
- 기존 drift-guard spec 의 anchor · 정규식 · 단언 변경 — 본 슬라이스는 **spec 무수정**이 전제다(수정이 필요해지면 축 밖 의존 판정이 틀렸다는 뜻이므로 착수를 멈추고 Follow-ups 에 남긴다).
- 신규 hook 모듈을 AdminView 배럴에 추가하는 것(공개 표면 무변경 유지).
- 새 dependency 추가(React Testing Library · react-test-renderer 등) — probe + `renderToStaticMarkup` harness 로 해결한다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — doc-only `direct` 라 본 `pr` task 와 섞지 않는다([CLAUDE.md](../../CLAUDE.md) §3.1 판정 규칙 3). 현 bullet 은 T-1884/T-1886/T-1887 머지분만큼 stale(LOC `3,450` · 좌표 · "다음 대상 = import/export 축" 모두 소진)이므로 **다음 `direct` 슬라이스에서 재실측 갱신**한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

**planner 가 미리 박제한 후속 절단면** (본 슬라이스 Out of Scope, 착수 순서 제안):

1. **PLAN `183 행` 재실측 `direct` 슬라이스** — 본 task 머지 후 LOC · 4 구역 좌표 · prelude 축 인벤토리를 다시 재고, 소진된 ③ ~ ⑥ 축을 목록에서 지운다.
2. **사용자 관리 축 hook 화(`pr`, 2 슬라이스 필요)** — planner 실측상 이 축은 조회 · 생성 · 역할 변경이 `usersRefreshNonce` 를 공유해 한 덩어리인데, 그 셋을 함께 옮기면 anchor 가 깨지는 drift-guard 가 `AdminView.users-list-contract.test.ts`(`useApiResource<UserRow[]>(usersPath)` 추출 정규식) · `AdminView.create-user-failure.test.ts`(`runCreateUser(userEmailInput, userPasswordInput, {...})` 정규식) · `AdminView.test.tsx`(T-1165 `const handleChangeRole = useCallback(` 블록 추출) **3 건**이라 총 6 파일로 **파일 cap 초과**다. 그래서 ① 조회 + 생성(`1353 행` ~ `1411 행`, hook 이 `setUsersRefreshNonce` 를 한시적으로 노출해 잔류 `handleChangeRole` 의 `bumpRefresh` 를 글자-동일 유지 / 5 파일) → ② 역할 변경 + 인스턴스 접근(같은 hook 모듈로 합류, `AdminView.test.tsx` 1 건만 anchor 교체 / 4 파일) 2 슬라이스로 나눈다.
