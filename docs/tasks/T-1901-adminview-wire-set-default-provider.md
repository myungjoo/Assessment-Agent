---
id: T-1901
title: Web UI — AdminView 에 onSetDefault 배선 (쓰기 축 B3, T-1866 재split 3/3)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1897, T-1898, T-1899, T-1900]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
estimatedDiff: 160
estimatedFiles: 2
created: 2026-09-05
plannerNote: "PLAN 107 행 chain 5/7 — 쓰기 축 B 재split 3/3(AdminView 배선 + 정적 렌더 검증). contract spec 은 cap 초과라 B4 로 재split."
---

# T-1901 — AdminView 에 `onSetDefault={handleSetDefaultProvider}` 배선 (쓰기 축 B3)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 [T-1866](T-1866-web-llm-default-provider-select-ui.md) 은 파일 cap 초과로 SUPERSEDED 됐고, 쓰기 축 B 는 다시 B1 (hook 핸들러, [T-1899](T-1899-web-llm-set-default-provider-hook-handler.md), `b4a945ea`) · B2 (버튼 컴포넌트, [T-1900](T-1900-web-llm-provider-list-set-default-button.md), `be003858`) · B3 (AdminView 배선) 로 split 됐다. B1·B2 가 모두 머지돼 hook 반환 표면의 `handleSetDefaultProvider` 와 컴포넌트의 `onSetDefault` prop 이 양쪽에 존재하지만 **둘을 잇는 배선이 없어 화면에는 아직 버튼이 뜨지 않는다** — 오너 확정 제약 ① ("Admin 이 Web UI 에서 지정한 기본 provider 가 어떤 자동 규칙보다 언제나 우선") 는 실제 화면에 지정 진입점이 마운트돼야 성립하므로, 본 slice 가 그 마지막 한 줄 배선을 닫는다 (§3 소비처 동반 의무의 소비처가 곧 본 task).

**issue-still-relevant pre-check (origin/main `781a01bb` 기준 실측, 2026-09-05T08:5xZ)**:

- `git grep -n "onSetDefault" origin/main -- web/src` → 히트는 [LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) `65 행 ~ 70 행` (prop 선언) · `95 행` (구조분해) · `131 행 ~ 143 행` (렌더 분기) 와 [LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) `517 행 ~ 670 행` (T-1900 spec 12 케이스) **뿐** — `web/src/views/AdminView.tsx` 히트 0. 배선 미박제 확정.
- `git grep -n "handleSetDefaultProvider\|settingDefault\|setDefaultError" origin/main -- web/src` → [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) (핸들러 · 반환 표면) · [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) (러너 · deps) · 각 spec 만 히트. **AdminView.tsx 히트 0** — 세 심볼 모두 소비처가 없다.
- `git ls-tree origin/main --name-only web/src/views/ | grep contract` → `AdminView.llm-provider-{create,update,delete,list}-contract.test.ts` 는 있으나 **`AdminView.llm-provider-set-default-contract.test.ts` 는 부재**.
- 결론: 부분 안착 (B1 러너 · hook · B2 컴포넌트 = 머지, 배선 · drift guard = 미박제). 본 task 는 잔여 중 **배선 + 정적 렌더 검증**만 책임진다.

**contract drift guard spec 을 같은 PR 에 넣지 않는 근거 (§3 cap 예외 · 재split)** — 신규 `AdminView.llm-provider-set-default-contract.test.ts` 는 동형 선례가 [llm-provider-delete-contract](../../web/src/views/AdminView.llm-provider-delete-contract.test.ts) 271 행 · [llm-provider-create-contract](../../web/src/views/AdminView.llm-provider-create-contract.test.ts) 291 행 · [difficulty-mapping-assign-contract](../../web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts) 290 행 으로 실측 271 ~ 291 LOC 다. 본 slice 의 배선 + 정적 렌더 검증 (실측 기반 약 100 ~ 160 LOC) 에 이를 더하면 **약 380 ~ 450 LOC** 로 cap (≤ 300 LOC) 을 명확히 초과한다. 따라서 drift guard spec 은 test-only 단독 slice (**B4**) 로 재split 해 §Follow-ups 에 파일 · 배선 단위로 명시한다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `760 행 ~ 802 행` (`useAdminLlmProviders()` 구조분해 39 심볼 중 현재 36 개만 되돌려 쓰는 블록 — `handleDeleteProvider` 바로 뒤 (`772 행` 부근) 가 본 slice 가 3 키를 끼워 넣을 지점. 주석의 "36 심볼" 서술도 함께 갱신 대상), `1023 행 ~ 1035 행` (`<LlmProviderConfigList>` 마운트 주석 + `providers` / `loading` / `error` / `onDelete` / `onEdit` 5 props — 본 slice 가 수정할 유일한 JSX 지점).
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `105 행 ~ 121 행` (`handleSetDefaultProvider` 시그니처 `(id: string) => void` 와 가드 위임 주석), `358 행 ~ 372 행` (반환 표면에 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` 3 키가 이미 실려 있음 — hook 파일은 **수정하지 않는다**).
- [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) `65 행 ~ 70 행` (`onSetDefault?: (id: string) => void` 선택 prop 의 controlled 계약 — 실 PUT · 재조회는 상위 컨테이너 책임), `104 행 ~ 116 행` (loading → error → empty 우선 분기 — loading / error 가 truthy 면 버튼이 아예 렌더되지 않음), `131 행 ~ 143 행` (`onSetDefault && row.isDefault !== true` 렌더 분기 + `SET_DEFAULT_LABEL` = `기본으로 지정`, 렌더 순서는 수정 → 삭제 **뒤** 마지막).
- [web/src/views/adminProviderDifficultyDerivations.ts](../../web/src/views/adminProviderDifficultyDerivations.ts) `37 행 ~ 50 행` (`LlmProviderRow` 타입 — `isDefault?: boolean` 포함), `100 행 ~ 115 행` (`isDefault === true` 인 행만 sanitized view 에 키를 싣는 엄격 boolean 파생 — 테스트 fixture 가 이 규약을 따라야 배지 · 버튼 분기가 재현된다).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `2184 행 ~ 2241 행` (T-1137 `provider 수정 배선 (정적 렌더)` describe — `CONFIG_ROWS` fixture · `countOccurrences` helper · `setRoutes` harness · happy / branch / negative 3 케이스. **본 slice 가 1:1 mirror 할 형식**), `2101 행 ~ 2110 행` (T-1135 삭제 배선 검증의 버튼 수 단언 관용구).
- [docs/tasks/T-1900-web-llm-provider-list-set-default-button.md](T-1900-web-llm-provider-list-set-default-button.md) §Follow-ups 의 **B3** 항목 — 본 slice 의 원본 범위 정의.

## Acceptance Criteria

- [ ] `AdminView.tsx` 의 `useAdminLlmProviders()` 구조분해에 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` 3 키를 추가한다 (`handleDeleteProvider` 뒤 — hook 반환 표면의 선언 순서와 같게). 블록 상단 주석의 "36 심볼" 서술을 실제 개수로 갱신한다.
- [ ] `<LlmProviderConfigList>` 에 `onSetDefault={handleSetDefaultProvider}` 를 전달한다 (기존 `onDelete` · `onEdit` 뒤).
- [ ] `loading` 을 `providersLoading || deletingProvider || settingDefault` 로 합성한다 (재지정 in-flight 도 진행 표시 — 기존 remove 패널 동형).
- [ ] `error` 를 `setDefaultError ?? deleteProviderError ?? providersError` 로 합성한다 (방금 한 재지정 실패를 최우선 노출 — mutation 우선 규약). 우선순위 근거를 주석 한 줄로 남긴다.
- [ ] **신규 로직 0** — 위 배선 외에 AdminView 안에 새 상태 · 새 핸들러 · 새 파생을 만들지 않는다 (모든 판단은 이미 머지된 hook · 러너 · 컴포넌트가 캡슐화).
- [ ] `AdminView.test.tsx` 에 `AdminView — 기본 provider 지정 배선 (정적 렌더, T-1901)` describe 를 추가 (T-1137 블록 `2184 행 ~ 2241 행` 형식 mirror, jsdom 미사용 정적 렌더). 아래 케이스를 모두 포함한다:
  - [ ] happy-path — Admin + provider 목록 (전원 비-default) 이면 `>기본으로 지정</button>` 이 provider 수만큼 렌더된다.
  - [ ] error path — provider 조회 error 가 truthy 면 목록 대신 alert 만 렌더되고 기본 지정 버튼 0 (컴포넌트 error 우선 분기가 배선을 타고 재현됨).
  - [ ] 분기 ① — 한 행이 `isDefault: true` 면 그 행에는 버튼이 빠지고 (버튼 수 = 전체 − 1) `기본` 배지가 함께 렌더된다.
  - [ ] 분기 ② — `providersLoading: true` 면 로딩 표시 우선, 버튼 0.
  - [ ] negative ① — 비-Admin 등급이면 목록 패널 자체가 미마운트돼 버튼 0 (fail-closed gating 경계).
  - [ ] negative ② — provider 목록이 빈 배열이면 버튼 0 + 빈 상태 문구.
  - [ ] negative ③ — 모든 행이 `isDefault: true` 인 경계에서는 버튼 0 (무의미한 재지정 진입점 미노출).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (root). `web` workspace test 도 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 기존 spec 무수정 green — 특히 [LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) 의 버튼 수 · 순서 단언과 `AdminView.test.tsx` 의 T-1135 / T-1137 배선 블록 기대값을 한 줄도 바꾸지 않는다.

## Out of Scope

- 신규 `web/src/views/AdminView.llm-provider-set-default-contract.test.ts` (web↔backend drift guard) — cap 초과 근거로 **B4** 로 재split (§Follow-ups).
- `useAdminLlmProviders.ts` · `adminLlmProviderMutationRunners.ts` · `LlmProviderConfigList.tsx` 수정 (이미 머지된 계약 — 본 slice 는 소비만 한다).
- backend (`src/llm/**`) · `docs/api.md` · `prisma/**` 변경.
- seed no-override ([T-1867](T-1867-seed-llm-config-default-no-override.md)) · doc-sync ([T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md)).
- AdminView god component 추출 리팩터 (PLAN `183 행` 부채) — 본 slice 는 배선 3 곳만 만진다.
- 낙관적 UI (버튼 클릭 즉시 배지 이동) — 권위 재조회 (`bumpRefresh`) 로 갱신하는 기존 결정 유지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **B4 (쓰기 축 B 재split 후속)** — 신규 `web/src/views/AdminView.llm-provider-set-default-contract.test.ts` (test-only, 약 280 LOC · 1 파일). backend [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `123 행 ~ 132 행` (`@Put("default")` + `@HttpCode(200)` + `@Body() SetDefaultLlmProviderDto`) 과 web [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `runSetDefaultProvider` (`358 행` 부근 PUT 발사) 의 계약 drift 를 대조한다. 선례 = [AdminView.llm-provider-create-contract.test.ts](../../web/src/views/AdminView.llm-provider-create-contract.test.ts) (정적 path + `@Body` 축). 특화 축: (1) `default` 정적 segment 가 `:id` 계열보다 **앞** 에 선언돼야 하는 라우트 순서, (2) body 키 정확히 1 개 (`llmProviderConfigId` — `forbidNonWhitelisted` 라 초과 키 400), (3) `Content-Type: application/json` 존재, (4) path param 0 (encodeURIComponent 대상 없음). import 는 `./adminLlmProviderMutationRunners` 직접 (AdminView 는 `runSetDefaultProvider` 를 re-export 하지 않으므로 배럴 수정 불요).
- chain 잔여: [T-1867](T-1867-seed-llm-config-default-no-override.md) (seed no-override) → [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct doc-sync, PLAN `107 행` bullet 닫기).
