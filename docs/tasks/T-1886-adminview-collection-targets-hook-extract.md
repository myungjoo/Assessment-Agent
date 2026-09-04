---
id: T-1886
title: AdminView 의 수집 대상 축 prelude(조회 1 + 파생 1 + 상태 14 + 핸들러 7)를 useAdminCollectionTargets hook 으로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: adminview-god-component-refactor
dependsOn: [T-1884]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminCollectionTargets.ts
  - web/src/views/useAdminCollectionTargets.test.ts
estimatedDiff: 900
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`1533 행` ~ `1761 행` 의 수집 대상 축 조회 · 파생 · state · 핸들러를 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminCollectionTargets()` 시그니처와 반환 object literal · AdminView 의 destructure 배선 · import 경로 조정뿐이며 분기 0) · (b) 신규 로직 0 LOC (`useApiResource<CollectionTargetRow[]>(COLLECTION_TARGETS_PATH)` 호출 · `collectionTargets` 의 `Array.isArray` 정상화 · 러너 4 종(`runCreateCollectionTarget` · `runDeleteCollectionTarget` · `runToggleCollectionTargetActive` · `runUpdateCollectionTarget`) 주입 · `foldScopeForEdit`/`buildScopePatch` 조립이 전부 본문 무변경 이동이고 `useCallback` deps 배열도 그대로) · (c) 렌더 트리가 그대로라 기존 spec 무수정 통과 — planner 가 AdminView 소스를 `readFileSync` 로 읽는 drift-guard **19 파일을 전수 검사한 결과 수집 대상 문자열을 anchor 로 쓰는 spec 0 건**(`grep -c 'collectionTarget|CollectionTarget|COLLECTION_TARGET'` 이 19 파일 모두 0)이고, 렌더 기반 `AdminView.collection-targets-*.test.tsx` 6 개는 배럴 재수출(`runCreateCollectionTarget` · `runDeleteCollectionTarget` · `runToggleCollectionTargetActive` · `foldScopeForEdit` · `buildScopePatch`)과 JSX 무변경 덕에 그대로 산다. 이동 229 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 둘째 본문 분해 슬라이스 — 수집 대상 축 hook 화, head 43ba5f84 좌표 · 축 밖 의존 0 · hook 파라미터 0 · drift-guard anchor 0 실측"
---

# T-1886 — AdminView 의 수집 대상 축 prelude 를 useAdminCollectionTargets hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook 모듈)** 의 둘째 슬라이스다. 첫 슬라이스 [T-1884](T-1884-adminview-import-export-hook-extract.md) 가 import/export 축을 [useAdminImportExport.ts](../../web/src/views/useAdminImportExport.ts) 로 옮겨 `-173 줄` 을 냈고, 본 task 는 같은 방식으로 **수집 대상 축**(bullet 인벤토리 ⑥) 을 옮긴다. 남은 목표선(≤ 2,000 줄) 까지 `-1,277 줄` 이라 축 단위 hook 화를 계속 이어가는 것이 유일한 경로다.

**issue-still-relevant pre-check 실측** (head [`43ba5f84`](https://github.com/myungjoo/Assessment-Agent/commit/43ba5f84), working tree == origin/main): ① 목적지 `web/src/views/useAdminCollectionTargets.ts` 는 main 에 **미존재**(`git ls-tree origin/main web/src/views/ | grep useAdmin` 이 `useAdminImportExport.{ts,test.ts}` 2 개만 보고, `git grep useAdminCollectionTargets origin/main` 0 건) — 동일 의도 미안착. ② PLAN bullet 의 좌표는 T-1884 머지분(`-173`)만큼 stale 하므로 **본 task 가 좌표를 직접 재실측**했다: `wc -l` = **3,277 줄**, 대상 블록은 `1533 행` ~ `1761 행`(**229 줄, 연속**) 이고 구성은 조회 1(`1541 행` ~ `1546 행`, `reload: reloadCollectionTargets` 포함) + 파생 1(`1552 행` `collectionTargets`) + 상태 14 + 핸들러 7(`1575`/`1616`/`1641`/`1685`/`1702`/`1711`/`1723 행`) = **23 선언**이다. ③ **축 밖 의존 0** — 블록 안 `set*` 호출 7 종이 전부 자기 축 state 이고(타 축 refresh nonce 미변경), 비-주석 코드에서 AdminView props(`initial*` 11 개) 참조 **0 건** 이라 **hook 파라미터 0 개**(T-1884 가 뒤늦게 발견한 `initialImportConfirmText` 같은 예외가 본 축에는 없음을 사전 확인). ④ 소비처는 JSX 의 수집 대상 섹션 한 곳(`3069 행` ~ `3137 행`) 뿐이라 같은 슬라이스에서 destructure 로 되돌려 쓴다([CLAUDE.md](../../CLAUDE.md) §3 소비처 동반 의무 충족 — hook 단독 슬라이스가 아니다).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `205 행` ~ `226 행`(수집 대상 관련 import), `1533 행` ~ `1761 행`(이동 대상 블록), `3069 행` ~ `3137 행`(JSX 소비처), `3145 행` ~ `3277 행`(배럴 재수출)
- [web/src/views/useAdminImportExport.ts](../../web/src/views/useAdminImportExport.ts) — 직전 슬라이스가 확립한 hook 모듈 형식(헤더 주석 · 반환 literal · 배럴 미추가 원칙)
- [web/src/views/useAdminImportExport.test.ts](../../web/src/views/useAdminImportExport.test.ts) — probe 컴포넌트 + `renderToStaticMarkup` harness 선례(신규 dependency 0)
- [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) — 이미 분리된 러너 4 종 + `foldScopeForEdit`/`buildScopePatch`/`COLLECTION_TARGETS_PATH`/`EMPTY_COLLECTION_TARGET_SCOPE_INPUT`
- [web/src/views/AdminView.collection-targets-scope-edit.test.tsx](../../web/src/views/AdminView.collection-targets-scope-edit.test.tsx) — 무수정 통과해야 하는 기존 렌더 spec 6 개 중 대표(`useApiResource` file-level mock 방식 확인용)
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 순수 추출 3 조건 판정과 축별 인벤토리

## Acceptance Criteria

- [ ] 신규 [web/src/views/useAdminCollectionTargets.ts](../../web/src/views/useAdminCollectionTargets.ts) 가 AdminView `1533 행` ~ `1761 행` 의 **23 선언**(조회 1 + 파생 1 + 상태 14 + 핸들러 7)을 **선행 주석까지 본문 무변경으로** 담고, `export function useAdminCollectionTargets()` 가 **파라미터 0 개**(외부 의존은 전부 모듈 최상위 import 로 해결)로 선언된다.
- [ ] hook 반환은 JSX 가 실제로 쓰는 심볼만 공개한다 — `collectionTargets` · `collectionTargetLoading` · `collectionTargetError` · `collectionTargetTypeInput` · `collectionTargetInstanceKeyInput` · `collectionTargetEndpointInput` · `setCollectionTargetTypeInput` · `setCollectionTargetInstanceKeyInput` · `setCollectionTargetEndpointInput` · `creatingCollectionTarget` · `createCollectionTargetError` · `deleteCollectionTargetError` · `toggleCollectionTargetError` · `updateCollectionTargetError` · `editingCollectionTargetId` · `updatingCollectionTargetId` · `collectionTargetEndpointEditInput` · `setCollectionTargetEndpointEditInput` · `collectionTargetScopeEditInput` · 핸들러 7. **`reloadCollectionTargets` · `deletingCollectionTargetId` · `togglingCollectionTargetId` 와 나머지 내부 setter 는 노출하지 않는다**(캡슐화 — T-1884 선례 승계).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 **블록이 있던 자리 그대로**(파트 목록 조회 `useApiResource<PartRow[]>(partsPath)` 직후 · `selectedPartId` 선언 직전) `const { ... } = useAdminCollectionTargets();` 로 되돌려 쓴다. **위치를 옮기면 안 된다** — 기존 collection-targets spec 이 `useApiResource` mock 을 호출 순서로 구분하므로 hook 호출 순번이 바뀌면 red 가 된다.
- [ ] JSX 수집 대상 섹션(`3069 행` ~ `3137 행`) 과 배럴(`3145 행` ~ `3277 행`)은 **한 글자도 바뀌지 않는다** — 공개 표면 무변경이 순수 추출의 전제다.
- [ ] 이동으로 미사용이 된 AdminView import **named specifier 만** 제거한다(`COLLECTION_TARGETS_PATH` · `EMPTY_COLLECTION_TARGET_SCOPE_INPUT` · `runUpdateCollectionTarget` · `CollectionTargetScopeField` 타입 · `COLLECTION_TARGET_TYPES`). **배럴이 재수출하는 `runCreateCollectionTarget` · `runDeleteCollectionTarget` · `runToggleCollectionTargetActive` · `foldScopeForEdit` · `buildScopePatch` 의 import 는 남긴다** — 제거하면 배럴이 깨져 기존 spec 이 red. `CollectionTargetAddForm` · `CollectionTargetList` default import 는 JSX 가 계속 쓰므로 유지한다.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **3,110 줄 이하**(기준 3,277, 기대 순 감소 `-190` 줄 안팎)로 줄어든다.
- [ ] **happy-path unit test** — 신규 colocated spec [web/src/views/useAdminCollectionTargets.test.ts](../../web/src/views/useAdminCollectionTargets.test.ts) 가 probe 컴포넌트(`createElement` + `renderToStaticMarkup` 1 회 렌더, T-1884 harness 승계)로 hook 을 호출해 초기 반환을 고정한다: `useApiResource` mock 이 `COLLECTION_TARGETS_PATH` **1 회** 호출됨 · `collectionTargets` 가 mock data 배열 그대로 · `collectionTargetTypeInput` 이 `COLLECTION_TARGET_TYPES[0]` · 나머지 입력 3 개가 빈 문자열 · 에러 4 종이 `undefined` · 핸들러 7 개가 모두 함수.
- [ ] **happy-path (러너 주입 계약)** — `vi.mock('./adminCollectionTargetRunners')` 로 러너 4 종을 대체한 뒤 `handleCreateCollectionTarget` · `handleDeleteCollectionTarget` · `handleToggleCollectionTargetActive` · `handleSubmitEditCollectionTarget` 를 각각 호출해, 대응 러너가 **1 회씩** 호출되고 주입 deps 의 키(입력 3 값 · in-flight 가드 · `reload` · 성공 후 리셋 콜백)가 이동 전과 동일한지 검증한다.
- [ ] **error path unit test** — ① 러너 mock 이 reject 하는 Promise 를 반환할 때 핸들러가 **동기 throw 하지 않고** 그 Promise 를 그대로 전파(실패 문구 합성 책임은 러너에 있고 hook 은 위임만 한다는 이동 전 계약 고정) 1+ test. ② `useApiResource` mock 이 `error` 를 반환할 때 `collectionTargetError` 가 그대로 전달되고 `collectionTargets` 는 빈 배열로 안전 착지 1+ test.
- [ ] **분기 cover** — 분기마다 1+ test: ① `collectionTargets` 의 `Array.isArray` 분기(배열 → 그대로 / `null` · 객체 · 문자열 → `[]`) · ② `handleStartEditCollectionTarget` 의 대상 존재 분기(목록에 있는 id → `foldScopeForEdit` 결과로 prefill / 없는 id → 이동 전과 동일한 방어 동작) · ③ `handleChangeCollectionTargetScope` 의 필드별 갱신 분기(`orgs`/`repos`/`spaces` 중 지정 필드만 바뀌고 나머지는 보존) · ④ `handleCancelEditCollectionTarget` 의 리셋 분기(편집 id · endpoint 입력 · 범위 입력 3 축이 모두 초기값으로).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: ① in-flight(`creatingCollectionTarget === true`) 상태에서 `handleCreateCollectionTarget` 재호출 시 러너에 넘어가는 가드 인자가 이동 전과 동일 · ② `handleDeleteCollectionTarget` 를 빈/미존재 id 로 호출한 경우의 전달값 · ③ `handleToggleCollectionTargetActive` 의 `nextActive` 반전 인자가 잘못된 타입(`undefined`)일 때 hook 이 자체 판단 없이 그대로 위임 · ④ `handleSubmitEditCollectionTarget` 를 편집 진입 없이 호출할 때 러너에 `undefined` 가 그대로 넘어감 · ⑤ hook 반환 객체가 내부 심볼(`reloadCollectionTargets` · `deletingCollectionTargetId` · `togglingCollectionTargetId`)을 **노출하지 않음**(캡슐화 회귀 가드).
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 green — 기존 web vitest **131 파일 3,899 test**(T-1884 기준선)가 무수정 통과하고 신규 spec 만큼 파일 · test 수가 증가한다. 특히 `AdminView.collection-targets-*.test.tsx` **6 개**가 한 줄도 수정되지 않고 통과해야 한다(순수 추출 조건 (c)).
- [ ] 루트 `pnpm test:cov` 로 line ≥ 80% / function ≥ 80% 임계 유지 — 본 task 는 `src/` 를 건드리지 않으므로 회귀 0 임을 확인한다.
- [ ] 착수 시 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 로 drift-guard 목록을 **재실측**(planner 실측 19 개)해 수집 대상 심볼을 anchor 로 쓰는 spec 이 새로 생겼는지 확인한다. 발견되면 그 파일까지 포함해도 파일 cap ≤ 5 를 지킬 수 있는지 판정하고, 초과하면 착수 전 Follow-ups 에 남기고 범위를 줄인다.

## Out of Scope

- 다른 축(ServiceIdentity · LLM provider · 파트 · 사용자 관리 · 스케줄 · 그룹 · 인원) 의 prelude 이동 — 한 슬라이스 한 축.
- JSX 섹션의 하위 컴포넌트화(PLAN `183 행` 의 경로 2) — 순수 추출 3 조건 (b) 미충족이라 별도 cap 안 슬라이스로 진행한다.
- 이동한 선언의 **본문 수정** — 리팩터 · 이름 변경 · 주석 재작성 · deps 배열 정리 전부 금지(신규 로직 0 LOC 이 `sizeExempt` 의 전제).
- `adminCollectionTargetRunners.ts` 의 러너 본문 변경 및 배럴 재수출 목록 변경.
- 신규 hook 모듈을 AdminView 배럴에 추가하는 것(공개 표면 무변경 유지).
- 새 dependency 추가(React Testing Library · react-test-renderer 등) — probe + `renderToStaticMarkup` harness 로 해결한다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — doc-only `direct` 라 본 `pr` task 와 섞지 않는다([CLAUDE.md](../../CLAUDE.md) §3.1 판정 규칙 3).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
