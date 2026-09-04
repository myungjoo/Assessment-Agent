---
id: T-1887
title: AdminView 의 LLM provider · 난이도 매핑 축 prelude(조회 2 + 파생 5 + 상태 18 + 핸들러 7)를 useAdminLlmProviders hook 으로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051]
independentStream: adminview-god-component-refactor
dependsOn: [T-1886]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminLlmProviders.ts
  - web/src/views/useAdminLlmProviders.test.ts
  - web/src/views/AdminView.llm-provider-list-contract.test.ts
  - web/src/views/AdminView.difficulty-mapping-list-contract.test.ts
estimatedDiff: 940
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`1177 행` ~ `1466 행` 의 LLM provider · 난이도 매핑 축 조회 · 파생 · state · 핸들러를 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminLlmProviders()` 시그니처와 반환 object literal · AdminView 의 destructure 배선 · drift-guard 2 개의 anchor 소스 경로 교체뿐이며 분기 0) · (b) 신규 로직 0 LOC (`useApiResource<LlmProviderRow[]>(providersPath)` · `useApiResource<DifficultyMappingRow[]>(mappingsPath)` 두 조회, `deriveProviders`/`deriveProviderConfigs`/`deriveDifficultyMapping`/`mergeMapping` 파생, 러너 4 종(`runCreateProvider` · `runUpdateProvider` · `runDeleteProvider` · `runAssign`) 주입, `llmLoading`/`llmError` 합성이 전부 본문 무변경 이동이고 `useCallback`/`useMemo` deps 배열도 그대로) · (c) 기존 spec 은 anchor 소스 경로 2 줄 외 무수정 통과 — planner 가 AdminView 소스를 `readFileSync` 로 읽는 drift-guard **19 파일을 전수 검사**한 결과 본 축을 anchor 로 쓰는 spec 은 `AdminView.llm-provider-list-contract.test.ts` · `AdminView.difficulty-mapping-list-contract.test.ts` **2 건뿐**이고(둘 다 `useApiResource<...Row[]>(...)` 호출부를 정규식으로 추출), `AdminView.test.tsx` 의 소스 읽기 3 곳은 역할 변경 · 인스턴스 접근 · 사용자 관리 축이라 무관하다. 이동 290 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 은 예외 없이 준수(추가 파일이 발견되면 착수 전 범위를 줄인다)."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 셋째 본문 분해 슬라이스 — LLM provider·난이도 축 hook 화, head cfe566d3 좌표 · 축 밖 의존 0 · hook 파라미터 0 · drift-guard anchor 2 건 실측"
---

# T-1887 — AdminView 의 LLM provider · 난이도 매핑 축 prelude 를 useAdminLlmProviders hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook 모듈)** 의 셋째 슬라이스다. 첫 슬라이스 [T-1884](T-1884-adminview-import-export-hook-extract.md) 가 import/export 축으로 `-173 줄`, 둘째 [T-1886](T-1886-adminview-collection-targets-hook-extract.md) 이 수집 대상 축으로 `-201 줄` 을 냈고, 본 task 는 같은 방식으로 bullet 인벤토리 ④ **LLM provider · 난이도 매핑 축** 을 옮긴다. 이 축은 인벤토리 아홉 축 중 **연속 블록으로는 가장 큰 mass** 이며, 목표선(≤ 2,000 줄) 까지 `-1,076 줄` 이 남아 축 단위 hook 화를 계속 잇는 것이 유일한 경로다.

**issue-still-relevant pre-check 실측** (head [`cfe566d3`](https://github.com/myungjoo/Assessment-Agent/commit/cfe566d3), working tree == origin/main):

- ① 목적지 `web/src/views/useAdminLlmProviders.ts` 는 main 에 **미존재** — `git ls-tree origin/main web/src/views/ | grep useAdmin` 이 `useAdminImportExport.{ts,test.ts}` · `useAdminCollectionTargets.{ts,test.ts}` **4 개만** 보고하고, `git grep useAdminLlmProviders origin/main` 은 **0 건**이다. 동일 의도 미안착.
- ② PLAN bullet 의 좌표(`1192 행` ~ `1479 행`)는 T-1884 · T-1886 머지분(`-374`)만큼 stale 하므로 **본 task 가 좌표를 직접 재실측**했다: `wc -l` = **3,076 줄**, 대상 블록은 선행 주석 포함 `1177 행` ~ `1466 행`(**290 줄, 연속**) 이고 구성은 조회 2(`1193 행` providers · `1307 행` difficulty-mappings) + 경로·파생 5(`1185` `providersPath` · `1303` `mappingsPath` · `1314` `providers` · `1321` `providerConfigs` · `1430` `difficultyMapping`) + 합성 2(`1438` `llmLoading` · `1443` `llmError`) + 상태 18 + 핸들러·리셋 7(`1214` `handleDeleteProvider` · `1250` `handleCreateProvider` · `1353` `resetEditProviderForm` · `1364` `handleEditProvider` · `1381` `handleCancelEditProvider` · `1395` `handleUpdateProvider` · `1454` `handleAssign`) = **37 선언**이다.
- ③ **축 밖 의존 0 · hook 파라미터 0** — 블록의 비-주석 코드가 참조하는 외부 심볼은 `useState`/`useMemo`/`useCallback` · `useApiResource`/`toErrorMessage`(`19 행` import) · `request`(`20 행` import) · 러너 4 종 · 빌더 2 종 · 파생 4 종 · 타입뿐이며 **전부 모듈 최상위 import** 라 hook 시그니처에 넘길 값이 없다(T-1884 가 뒤늦게 발견한 `initialImportConfirmText` 같은 props 참조가 본 축에는 0 건 — `initial*` props 참조 없음을 비-주석 코드에서 확인). 반대로 블록 밖에서 이 축 심볼을 참조하는 코드도 **JSX 소비처뿐**이고, 나머지 등장 15 곳(`129`/`271`/`456`/`709`/`714`/`792`/`938`/`943`/`955`/`965`/`976`/`995`/`1005`/`1085`/`1089 행`)은 전부 **주석 안 언급**이라 이동 대상이 아니다.
- ④ 소비처는 JSX 의 LLM 패널 구역(`2088 행` ~ `2255 행`) 한 곳뿐이고, 그 구역이 실제로 쓰는 심볼은 **35 개**(주석 안 언급 `providersRefreshNonce` · `providerData` · `assigning` · `assignError` 는 제외)라 같은 슬라이스에서 destructure 로 되돌려 쓴다([CLAUDE.md](../../CLAUDE.md) §3 소비처 동반 의무 충족 — hook 단독 슬라이스가 아니다).
- ⑤ 이동해도 AdminView 의 관련 import 는 **하나도 지우지 않는다** — `buildProvidersPath` · `buildMappingsPath` · `deriveProviders` · `deriveProviderConfigs` · `deriveDifficultyMapping` · `mergeMapping` · `runAssign` · `runCreateProvider` · `runUpdateProvider` · `runDeleteProvider` 와 타입 `LlmProviderRow` · `DifficultyMappingRow` 가 모두 배럴(`2944 행` ~ `3076 행`)의 재수출 대상이라 제거하면 배럴이 깨진다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `19 행` ~ `20 행`(`useApiResource`/`toErrorMessage`/`request` import), `1177 행` ~ `1466 행`(이동 대상 블록), `1468 행` ~ `1472 행`(직전 슬라이스의 hook 호출 형식), `2088 행` ~ `2255 행`(JSX 소비처), `2944 행` ~ `3076 행`(배럴 재수출)
- [web/src/views/useAdminCollectionTargets.ts](../../web/src/views/useAdminCollectionTargets.ts) — 직전 슬라이스가 확립한 hook 모듈 형식(헤더 주석 · 반환 literal · 배럴 미추가 원칙)
- [web/src/views/useAdminCollectionTargets.test.ts](../../web/src/views/useAdminCollectionTargets.test.ts) — probe 컴포넌트 + `createElement` + `renderToStaticMarkup` harness 선례(신규 dependency 0, `.test.ts` 확장자로 [check-spec-presence.sh](../../scripts/check-spec-presence.sh) 게이트 충족)
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — 이미 분리된 러너 4 종(`runCreateProvider` · `runUpdateProvider` · `runDeleteProvider` · `runAssign`)과 파생 helper 의 주입 계약
- [web/src/views/AdminView.llm-provider-list-contract.test.ts](../../web/src/views/AdminView.llm-provider-list-contract.test.ts) — `107 행` 의 `readFileSync('./AdminView.tsx')` 와 `71 행` 의 `useApiResource<LlmProviderRow[]>(...)` 추출 정규식(anchor 소스 교체 대상 1)
- [web/src/views/AdminView.difficulty-mapping-list-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-list-contract.test.ts) — `68 행` 의 `useApiResource<DifficultyMappingRow[]>(...)` 추출 정규식(anchor 소스 교체 대상 2)
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 순수 추출 3 조건 판정과 축별 인벤토리

## Acceptance Criteria

- [ ] 신규 [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) 가 AdminView `1177 행` ~ `1466 행` 의 **37 선언**(조회 2 + 경로·파생 5 + 합성 2 + 상태 18 + 핸들러·리셋 7)을 **선행 주석까지 본문 무변경으로** 담고, `export function useAdminLlmProviders()` 가 **파라미터 0 개**로 선언된다.
- [ ] hook 반환은 JSX 가 실제로 쓰는 **35 심볼만** 공개한다 — `providers` · `providerConfigs` · `providersLoading` · `providersError` · `deletingProvider` · `deleteProviderError` · `handleDeleteProvider` · `providerInput`/`setProviderInput` · `endpointUrlInput`/`setEndpointUrlInput` · `apiKeyInput`/`setApiKeyInput` · `modelIdInput`/`setModelIdInput` · `creatingProvider` · `createProviderError` · `handleCreateProvider` · `editingProviderId` · `editProviderInput`/`setEditProviderInput` · `editEndpointUrlInput`/`setEditEndpointUrlInput` · `editApiKeyInput`/`setEditApiKeyInput` · `editModelIdInput`/`setEditModelIdInput` · `updatingProvider` · `updateProviderError` · `handleEditProvider` · `handleCancelEditProvider` · `handleUpdateProvider` · `difficultyMapping` · `llmLoading` · `llmError` · `handleAssign`. **`providersRefreshNonce` · `providerData` · `mappingData` · `mappingsLoading` · `mappingsError` · `providersPath` · `mappingsPath` · `refreshNonce` · `optimisticMapping` · `assigning` · `assignError` · `resetEditProviderForm` 와 나머지 내부 setter 는 노출하지 않는다**(캡슐화 — T-1884/T-1886 선례 승계).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 **블록이 있던 자리 그대로**(`addCandidates` 파생 직후 · `useAdminImportExport` 호출 직전) `const { ... } = useAdminLlmProviders();` 로 되돌려 쓴다. **위치를 옮기면 안 된다** — 기존 spec 이 `useApiResource` mock 을 호출 순서로 구분하므로 두 조회의 순번이 바뀌면 red 가 된다.
- [ ] JSX 의 LLM 패널 구역(`2088 행` ~ `2255 행`) 과 배럴(`2944 행` ~ `3076 행`) 은 **한 글자도 바뀌지 않는다**(공개 표면 무변경이 순수 추출의 전제). 배럴이 재수출하는 축 관련 import 10 종 + 타입 2 종도 **제거하지 않는다** — 제거하면 배럴이 깨져 기존 spec 이 red.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **2,860 줄 이하**(기준 3,076, 기대 순 감소 `-240` 줄 안팎)로 줄어든다.
- [ ] drift-guard 2 개([AdminView.llm-provider-list-contract.test.ts](../../web/src/views/AdminView.llm-provider-list-contract.test.ts) · [AdminView.difficulty-mapping-list-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-list-contract.test.ts))의 `readFileSync` 대상만 `./useAdminLlmProviders.ts` 로 바꾼다 — **정규식 · 단언 · 케이스 수는 그대로** 두어 계약 검증력이 줄지 않게 한다(T-1882 의 anchor 소스 교체 선례 동형).
- [ ] **happy-path unit test** — 신규 colocated spec [web/src/views/useAdminLlmProviders.test.ts](../../web/src/views/useAdminLlmProviders.test.ts) 가 probe 컴포넌트(`createElement` + `renderToStaticMarkup` 1 회 렌더, T-1886 harness 승계) 로 hook 을 호출해 초기 반환을 고정한다: `useApiResource` mock 이 `buildProvidersPath(0)` 와 `buildMappingsPath(0)` 를 **각각 1 회 · 그 순서로** 호출 · `providers`/`providerConfigs` 가 파생 결과 그대로 · 입력 4 개와 편집 입력 4 개가 빈 문자열 · `editingProviderId` 가 `null` · 에러 4 종이 `undefined` · 핸들러 7 개가 모두 함수.
- [ ] **happy-path (러너 주입 계약)** — `vi.mock('./adminLlmProviderMutationRunners')` 로 러너 4 종을 대체한 뒤 `handleCreateProvider` · `handleUpdateProvider` · `handleDeleteProvider` · `handleAssign` 를 각각 호출해, 대응 러너가 **1 회씩** 호출되고 주입 deps 의 키(입력값 · in-flight 가드 · `bumpRefresh` · 성공 후 리셋/낙관 override 콜백)가 이동 전과 동일한지 검증한다.
- [ ] **error path unit test** — ① 러너 mock 이 reject 하는 Promise 를 반환할 때 핸들러가 **동기 throw 하지 않고** 그 Promise 를 그대로 전파한다(실패 문구 합성 책임은 러너에 있고 hook 은 위임만 한다는 이동 전 계약 고정) 1+ test. ② `useApiResource` mock 이 두 조회 모두 `error` 를 반환할 때 `llmError` 가 이동 전 우선순위(`assignError ?? providersError ?? mappingsError`)대로 합성되고 `providers` 가 빈 배열로 안전 착지 1+ test.
- [ ] **분기 cover** — 분기마다 1+ test: ① `llmLoading` 의 3 항 OR(provider 조회 중 / mapping 조회 중 / `assigning` 중 각각 true) · ② `llmError` 의 3 단 `??` 우선순위(assign 실패 우선 → provider 조회 error → mapping 조회 error → 셋 다 없으면 `undefined`) · ③ `difficultyMapping` 의 낙관 override 병합 분기(override 비었을 때 서버 매핑 그대로 / override 있을 때 해당 슬롯만 덮임) · ④ `handleEditProvider` 의 편집 진입 분기(목록에 있는 id → 그 행 값으로 prefill / 없는 id → 이동 전과 동일한 방어 동작) · ⑤ `handleCancelEditProvider` 의 리셋 분기(편집 id `null` + 입력 4 축 초기화 + 직전 실패 문구 제거).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: ① in-flight(`creatingProvider === true`) 상태에서 `handleCreateProvider` 재호출 시 러너에 넘어가는 가드 인자가 이동 전과 동일 · ② `handleDeleteProvider` 를 빈 문자열 id 로 호출한 경우의 전달값 · ③ `handleAssign` 을 빈 `providerId` 로 호출할 때 hook 이 자체 판단 없이 그대로 위임(가드는 러너 책임) · ④ 조회 응답이 비정상 payload(`null` · 객체 · 문자열)일 때 `providers`/`providerConfigs`/`difficultyMapping` 이 빈 값으로 안전 착지 · ⑤ hook 반환 객체가 내부 심볼(`providersRefreshNonce` · `providerData` · `mappingData` · `assigning` · `resetEditProviderForm`)을 **노출하지 않음**(캡슐화 회귀 가드).
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 green — 기존 web vitest **132 파일 3,920 test**(T-1886 기준선)가 위 anchor 소스 2 줄 교체 외 무수정 통과하고, 신규 spec 만큼 파일 · test 수가 증가한다.
- [ ] 루트 `pnpm test:cov` 로 line ≥ 80% / function ≥ 80% 임계 유지 — 본 task 는 `src/` 를 건드리지 않으므로 회귀 0 임을 확인한다.
- [ ] 착수 시 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 로 drift-guard 목록을 **재실측**(planner 실측 19 개)해 본 축 심볼을 anchor 로 쓰는 spec 이 2 개보다 늘었는지 확인한다. 늘어 파일 cap(≤ 5) 을 넘기면 착수 전 Follow-ups 에 남기고 범위를 줄인다(LOC 만 면제 — 파일 cap 은 예외 없음).

## Out of Scope

- 다른 축(ServiceIdentity · 파트 · 사용자 관리 · 스케줄 · 그룹 · 인원) 의 prelude 이동 — 한 슬라이스 한 축.
- JSX 섹션의 하위 컴포넌트화(PLAN `183 행` 의 경로 2) — 순수 추출 3 조건 (b) 미충족이라 별도 cap 안 슬라이스로 진행한다.
- 이동한 선언의 **본문 수정** — 리팩터 · 이름 변경 · 주석 재작성 · deps 배열 정리 · state 통합 전부 금지(신규 로직 0 LOC 이 `sizeExempt` 의 전제).
- `adminLlmProviderMutationRunners.ts` 의 러너 본문 변경 및 배럴 재수출 목록 변경.
- drift-guard 2 개의 **정규식 · 단언 · 케이스 변경** — `readFileSync` 대상 경로 한 줄씩만 바꾼다.
- 신규 hook 모듈을 AdminView 배럴에 추가하는 것(공개 표면 무변경 유지).
- 새 dependency 추가(React Testing Library · react-test-renderer 등) — probe + `renderToStaticMarkup` harness 로 해결한다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — doc-only `direct` 라 본 `pr` task 와 섞지 않는다([CLAUDE.md](../../CLAUDE.md) §3.1 판정 규칙 3).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
