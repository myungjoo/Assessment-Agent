---
id: T-1893
title: AdminView ⑦ 파트 축 배선(`1085 행` ~ `1106 행` · `1141 행` ~ `1171 행` · `1208 행` ~ `1372 행`, 218 줄)을 useAdminParts hook 으로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
independentStream: adminview-god-component-refactor
dependsOn: [T-1892]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminParts.ts
  - web/src/views/useAdminParts.test.ts
  - web/src/views/AdminView.parts-list-contract.test.ts
  - web/src/views/AdminView.part-persons-contract.test.ts
estimatedDiff: 1100
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: 파트 축 3 조각(`1085 행` ~ `1106 행` 재조회 nonce · nonce-aware path · `useApiResource<PartRow[]>` 목록 조회 / `1141 행` ~ `1171 행` 선택 파트 상태 · 조건부 소속 인원 path · `useApiResource<PersonRow[]>` 조회 · `partPersons` 파생 / `1208 행` ~ `1372 행` 생성 · 삭제 · 수정 상태 11 + 핸들러 6)을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminParts(initialSelectedPartId: string)` 시그니처와 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0. (b) 신규 로직 0 LOC: `buildPartsPath(partsRefreshNonce)` · `buildPartPersonsPath(selectedPartId || undefined, partsRefreshNonce)` useMemo · `runCreatePart` · `runDeletePart` · `runUpdatePart` 주입 키 · 모든 `useCallback` deps 배열까지 본문 무변경 이동. (c) 기존 spec 무수정 통과 — 렌더 spec 의 `vi.mock('../api/useApiResource')` 는 모듈 단위라 hook 모듈 import 에도 그대로 적용되고 라우팅이 path 기반이라 회귀 0, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 2 파일뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 218 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 여덟째 슬라이스 — ⑦ 파트 축 3 조각 218 줄 단일 슬라이스, head b567c28d 재실측 · drift-guard 2 건 pointer 동반"
---

# T-1893 — AdminView 파트 축 배선을 useAdminParts hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 여덟째 슬라이스다. 직전 두 슬라이스([T-1891](T-1891-adminview-users-query-create-hook-extract.md) · [T-1892](T-1892-adminview-users-role-access-hook-extract.md))가 ⑧ 사용자 관리 축을 완결해 그 축이 소진됐고, 잔여는 ① 그룹 · 멤버십(295 줄, 비연속 5 조각) · ② 인원(220 줄, 비연속 4 조각) · **⑦ 파트(218 줄, 비연속 3 조각)** 3 축이다. bullet 이 못 박은 착수 순서 기준은 **"축 밖 의존이 적은 축부터"** 이며, 아래 pre-check 실측대로 파트 축은 **축 밖 의존이 0** 이다(그룹 · 인원 두 축은 서로 좌표가 교차하고 멤버십 파생을 공유한다). AdminView 는 현재 2,426 줄이라 목표선 ≤ 2,000 줄까지 잔여 `-426 줄` 이고, 본 슬라이스의 기대 순 감소는 `-175 줄` 안팎이다.

**issue-still-relevant pre-check 결과** ([.claude/agents/planner.md](../../.claude/agents/planner.md) `§Pre-check: issue-still-relevant`, head `b567c28d` 기준 실측):

1. **목적지 모듈 미존재** — `git ls-tree origin/main web/src/views/` 에 `useAdminParts.ts` 가 없다(현존 hook 모듈은 `useAdminCollectionTargets` · `useAdminImportExport` · `useAdminLlmProviders` · `useAdminSchedule` · `useAdminServiceIdentities` · `useAdminUsers` 6 개). `git grep "useAdminParts" origin/main -- web/src` 결과 0 건 — 본 축은 아직 AdminView 본문에 그대로 있다.
2. **좌표 재실측** (bullet 의 좌표는 T-1891 · T-1892 이전 것이라 무효 → 현 head 로 재측정) — 파트 축은 3 조각이다: **(A) `1085 행` ~ `1106 행`**(22 줄 — `partsRefreshNonce` 선언 `1088 행` · `partsPath` useMemo `1092 행` ~ `1095 행` · `useApiResource<PartRow[]>(partsPath)` `1103 행` ~ `1106 행`), **(B) `1141 행` ~ `1171 행`**(31 줄 — `selectedPartId` `1143 행` ~ `1145 행` · `partPersonsPath` useMemo `1151 행` ~ `1154 행` · `useApiResource<PersonRow[]>(partPersonsPath)` `1159 행` ~ `1163 행` · `partPersons` 파생 `1168 행` ~ `1171 행`), **(C) `1208 행` ~ `1372 행`**(165 줄 — 생성 3 상태 + `handleCreatePart` · 삭제 2 상태 + `handleDeletePart` · 수정 5 상태 + `resetEditPartForm` · `handleEditPart` · `handleCancelEditPart` · `handleUpdatePart`). 합 218 줄로 bullet 이 적은 축 크기와 일치한다.
3. **축 밖 의존 0 실측** — `grep -nE 'partsRefreshNonce|partsPath|partsData|partLoading|partError|partPersons|selectedPartId'` 결과 축 3 조각과 파트 관리 섹션 JSX(`2085 행` ~ `2210 행`) 밖에서 참조하는 곳이 0 이다. 역으로 파트 축이 참조하는 축 밖 심볼도 props 유래 `initialSelectedPartId` 하나뿐이라(그룹 · 인원 · 멤버십 파생 참조 0) hook 파라미터 1 개로 닫힌다 — [T-1888](T-1888-adminview-service-identity-hook-extract.md) 이 props 초기값 2 개를 넘긴 선례와 동형이고, bullet 이 경고한 "축 밖 nonce · 파생을 파라미터로 넘겨야 해 (a) 가 깨지는" 경우가 아니다.
4. **anchor census 재실행** (bullet `(i)` ~ `(iv)` 지시대로) — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 결과 **15 파일**이고, 그중 본 축 심볼을 **호출식 정규식**으로 잡는 것은 `AdminView.parts-list-contract.test.ts`(`/useApiResource<PartRow\[\]>\(\s*(partsPath[^)]*)\)/`, `75 행`) 와 `AdminView.part-persons-contract.test.ts`(`/useApiResource<PersonRow\[\]>\(\s*(partPersonsPath[^)]*)\)/`, `75 행`) **2 건**뿐이다. `AdminView.persons-list-contract.test.ts` 는 `personsPath` 만 anchor 하고 `partPersonsPath` 는 주석에서만 언급하므로 무수정 통과하며, `AdminView.part-create-contract.test.ts` · `AdminView.part-update-contract.test.ts` · `AdminView.part-delete-contract.test.ts` 는 controller · DTO 소스만 읽고 러너(`runCreatePart` 등)를 직접 호출하므로 배선 이동과 무관하다. `AdminView.test.tsx` 의 소스 가드 2 건(`9613 행` · `9698 행`)은 인스턴스 접근 · 사용자 섹션 markup 대상이라 파트와 무관하고, 같은 파일의 파트 관련 test 는 배럴에서 import 한 순수 러너 · 빌더를 직접 호출하는 단위 test 다. **따라서 touchesFiles 5 = 파일 cap 정확히 준수** — 여유가 0 이므로 착수 시 census 를 한 번 더 돌려 6 번째 파일이 필요해지면 즉시 planner 에게 분할을 요청한다.
5. **useApiResource 호출 순번 계약 확인** — `1110 행` 주석이 "collection-targets spec 이 useApiResource mock 을 호출 순서로 구분한다" 고 적고 있으나, 실측상 web 의 모든 spec 은 `useApiResourceMock.mockImplementation((path) => ...)` 의 **path 라우팅**이고 `mockReturnValueOnce` · `mock.calls[n]` 기반 순번 라우팅은 0 건이다. 그래도 안전 우선으로 `useAdminParts(...)` 호출은 **조각 (A) 자리(`1085 행`, 수집 대상 hook 호출 직전)** 에 두고, 수집 대상 · 사용자 hook 호출 위치는 건드리지 않는다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 순수 추출 3 조건 판정 · 파일 cap anchor census 방법 `(i)` ~ `(iv)` · 착수 순서 기준("축 밖 의존이 적은 축부터")
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 3 조각(`1085 행` ~ `1106 행` · `1141 행` ~ `1171 행` · `1208 행` ~ `1372 행`) · 파트 관리 섹션 JSX 소비처(`2085 행` ~ `2210 행`) · props 선언(`385 행` ~ `387 행` `initialSelectedPartId`, `422 행` 기본값) · `PartRow` import(`209 행`) · 배럴 `export { ... };`(`2294 행` 이하)
- [web/src/views/useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) — 직전 슬라이스가 세운 hook 모듈 형식(머리말 주석 · 반환 표면 화이트리스트 · 내부 전용 비공개)
- [web/src/views/useAdminServiceIdentities.ts](../../web/src/views/useAdminServiceIdentities.ts) — props 초기값을 파라미터로 받는 hook 선례(본 task 의 `initialSelectedPartId` 동형)
- [web/src/views/useAdminUsers.test.ts](../../web/src/views/useAdminUsers.test.ts) — hook spec 의 R-112 4 종 구성 · `renderHook` 부재 환경의 검증 관용구
- [web/src/views/AdminView.parts-list-contract.test.ts](../../web/src/views/AdminView.parts-list-contract.test.ts) `70 행` ~ `120 행` — `extractPartsFireMethod` anchor 와 `ADMIN_VIEW_SOURCE` 선언
- [web/src/views/AdminView.part-persons-contract.test.ts](../../web/src/views/AdminView.part-persons-contract.test.ts) `71 행` ~ `125 행` — `extractPersonsFireMethod` anchor 와 `ADMIN_VIEW_SOURCE` 선언
- [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무 · `§3.2` R-112

## Acceptance Criteria

- [ ] `web/src/views/useAdminParts.ts` 가 `AdminView.tsx` 의 파트 축 3 조각(`1085 행` ~ `1106 행` · `1141 행` ~ `1171 행` · `1208 행` ~ `1372 행`)을 선행 주석까지 **본문 한 글자도 바꾸지 않고** 흡수한다. hook 시그니처는 `useAdminParts(initialSelectedPartId: string)` 하나이고, 그 밖의 파라미터 · 축 밖 상태 의존은 0 이다.
- [ ] 반환 표면에 파트 섹션 JSX 가 실제로 쓰는 심볼만 공개한다: `partsData` · `partLoading` · `partError` · `selectedPartId` · `setSelectedPartId` · `partPersons` · `partPersonLoading` · `partPersonError` · `partNameInput` · `setPartNameInput` · `creatingPart` · `createPartError` · `handleCreatePart` · `deletingPart` · `deletePartError` · `handleDeletePart` · `editingPartId` · `editPartNameInput` · `setEditPartNameInput` · `updatingPart` · `updatePartError` · `handleEditPart` · `handleCancelEditPart` · `handleUpdatePart`. 내부 전용(`partsRefreshNonce` · `setPartsRefreshNonce` · `partsPath` · `partPersonsPath` · `partPersonData` · `editPartOriginalName` · `resetEditPartForm` 등)은 노출하지 않는다 — 축이 통째로 들어오므로 [T-1891](T-1891-adminview-users-query-create-hook-extract.md) 같은 **한시적 setter 노출이 필요 없다**.
- [ ] `AdminView.tsx` 는 세 조각을 조각 (A) 자리(`1085 행`, 수집 대상 hook 호출 직전)의 `useAdminParts(initialSelectedPartId)` destructure 한 블록으로 대체한다 — **소비처 동반**: 파트 관리 섹션 JSX(`2085 행` ~ `2210 행`)의 `PartList` props 3 종 · 생성 폼 · 인라인 수정 폼 · 파트 선택 `<select value={selectedPartId}>` 가 destructure 한 값을 즉시 되돌려 쓴다(hook 단독 슬라이스가 아니다 — CLAUDE.md `§3` slice 하한 충족).
- [ ] 수집 대상 hook(`useAdminCollectionTargets`) · 사용자 hook(`useAdminUsers`) 호출 위치와 그 밖의 모든 축 좌표는 **무변경**이고, 배럴 `export { ... };` · `export type { ... };` 목록 · JSX markup · 러너 · 빌더 import 줄도 무변경이다. 단 `PartRow` type import(`209 행`)는 마지막 사용처가 hook 으로 이동해 소멸하면 그 1 줄만 내린다(배럴 재수출 대상이 아님을 확인한 뒤 — 재수출한다면 남긴다).
- [ ] `web/src/views/useAdminParts.test.ts`(colocated 신규 spec)의 happy-path 1+ — `handleCreatePart` 가 `runCreatePart(partNameInput, {...})` 에, `handleDeletePart` 가 `runDeletePart(id, {...})` 에, `handleUpdatePart` 가 `runUpdatePart(...)` 에 이동 전과 **글자-동일한 주입 키**를 넘기고, 성공 경로에서 입력 초기화 · 편집 종료 · `partsRefreshNonce` bump 가 일어난다. 조회 축은 `buildPartsPath(0)` · `buildPartPersonsPath(선택값, nonce)` 가 hook 이 계산한 path 로 `useApiResource` 에 전달됨을 검증한다.
- [ ] 같은 spec 의 error path 1+ — 생성 409(`Part.name @unique` 중복 → 전용 문구) · 그 외 status(`toErrorMessage` 파생) · 삭제 실패 · 수정 409 각각에서 대응 error 상태(`createPartError` · `deletePartError` · `updatePartError`)가 채워지고 in-flight 플래그가 false 로 되돌아오며 **throw 가 밖으로 새지 않는다**.
- [ ] 같은 spec 의 branch cover — (1) 미선택(`selectedPartId` 빈 값)이면 `buildPartPersonsPath` 가 null 을 내어 소속 인원 조회가 idle 이고 선택 시 path 가 생기는 두 분기, (2) `partsRefreshNonce` 가 0 일 때 base path / 증가 시 `_r` query 가 붙는 두 분기, (3) `partPersons` 파생이 배열 payload / 비배열 · undefined payload 로 갈리는 두 분기, (4) `handleDeletePart` 가 **선택 중인 파트를 삭제하면 `selectedPartId` 를 비우고** 다른 파트 삭제 시엔 유지하는 두 분기, (5) `handleEditPart` 가 `partsData` 에서 id 매칭에 성공 / 실패하는 두 분기, (6) `handleCancelEditPart` 가 진행 중(`updatingPart`)이면 취소를 억제하는 분기.
- [ ] 같은 spec 의 negative cases **충분 cover** — 예외 분기마다 1+: 빈 · 공백-only `partNameInput` 에서 생성 발사 0, in-flight(`creatingPart` · `deletingPart` · `updatingPart`) 중 중복 클릭 이중 발사 0, falsy id 삭제 발사 0, 미변경 name 수정 발사 0, 파트 error 문구가 그룹 · 인원 축 문구와 섞이지 않음(별개 축 유지), 내부 전용 값(`partsPath` · `partPersonsPath` · `editPartOriginalName` · `setPartsRefreshNonce`)이 반환 표면에 **없음**. 단일 negative 로 끝내지 않는다.
- [ ] `AdminView.parts-list-contract.test.ts` 의 anchor pointer 만 `useAdminParts.ts` 소스로 교체한다 — `it` 제목 · 계약 문장 · 합성 소스 negative 케이스(`247 행`)의 단언 의미는 **무변경**.
- [ ] `AdminView.part-persons-contract.test.ts` 의 anchor pointer 만 `useAdminParts.ts` 소스로 교체한다 — 같은 방식으로 계약 문장 · 합성 소스 negative 케이스(`280 행`)의 단언 의미 무변경.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 통과 — 특히 파트 섹션 렌더 test · `AdminView.part-create-contract.test.ts` · `AdminView.part-update-contract.test.ts` · `AdminView.part-delete-contract.test.ts` · `AdminView.persons-list-contract.test.ts` 가 **무수정 green**(렌더 계약 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 `useAdminParts.ts` 포함.
- [ ] `git diff --stat` 이 위 `touchesFiles` 5 개만 보고하고, `wc -l web/src/views/AdminView.tsx` 가 현 2,426 줄에서 **약 `-175 줄`**(이동 218 − hook 호출 destructure · 머리말 주석 증가분) 줄어든 값을 보인다.

## Out of Scope

- **경로 2(JSX 섹션 → 하위 컴포넌트) 착수 금지** — 파트 관리 섹션 markup 은 한 줄도 옮기지 않는다(PLAN bullet 이 별도 경로로 분리했고 순수 추출 3 조건 미충족).
- **잔여 2 축(① 그룹 · 멤버십 · ② 인원) 이동 금지** — 좌표가 교차하므로 별도 슬라이스.
- **러너 · 빌더 모듈 수정 금지** — `adminGroupPartMutationRunners.ts` · `adminResourcePathBuilders.ts` 는 무변경(본 task 는 호출 배선의 위치만 옮긴다).
- **배럴 공개 표면 변경 금지** — 기존 spec 이 AdminView 배럴에서 import 하는 이름은 그대로 유지한다.
- **동작 개선 · 리팩터 금지** — deps 배열 정리, 문구 개선, error 표면화 방식 변경 등은 순수 추출 (b) 조건을 깨므로 하지 않는다(발견 시 Follow-ups 에만 적는다).
- **PLAN.md `183 행` 부채 bullet 재측정 금지** — 본 task 는 `pr` 코드 슬라이스이며, 실측 갱신은 별도 `direct` doc task 다(commitMode 혼합 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(reviewer MINOR, 본 PR 미수정)** [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 `useAdminCollectionTargets` 선행 주석이 주장하는 "`useApiResource` 호출 순번 계약" 은 실측상 근거가 없고, 본 슬라이스가 파트 축 3 조각을 hook 으로 옮기면서 서술이 더 부정확해졌다. 잔여 축(① 그룹 · 멤버십 / ② 인원) 슬라이스에서 같은 주석을 손대는 김에 정리한다 — 별도 task 로 승격하지 않는다(주석 1 곳 정리라 CLAUDE.md §3 "Nit-in-PR closure" 취지대로 다음 슬라이스가 cap 안에서 흡수).
