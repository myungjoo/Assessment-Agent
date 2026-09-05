---
id: T-1899
title: Web UI — useAdminLlmProviders 기본 provider 재지정 핸들러 (쓰기 축 B1, T-1866 split 3/3 재split 1/3)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1897, T-1898]
touchesFiles:
  - web/src/views/useAdminLlmProviders.ts
  - web/src/views/useAdminLlmProviders.test.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-09-05
plannerNote: "PLAN 107 행 chain 5/7 — 쓰기 축 B 를 현 head 실측(6 파일 · 약 445 LOC)으로 재split 한 1/3(hook 핸들러 + spec 2 파일)."
---

# T-1899 — Web UI — `handleSetDefaultProvider` hook 핸들러 (쓰기 축 B1)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 [T-1866](T-1866-web-llm-default-provider-select-ui.md) 은 파일 cap 초과로 SUPERSEDED 됐고, 그 §Resolution 이 읽기 축 ([T-1897](T-1897-web-llm-default-provider-badge-read-axis.md), 머지) → 쓰기 축 A ([T-1898](T-1898-web-llm-set-default-provider-runner.md), 머지 `edc5299b`) → 쓰기 축 B (버튼 + hook + AdminView 배선) 로 split 했다.

**쓰기 축 B 를 현 head (`6c40d4d1`) 로 재실측한 결과 CLAUDE.md §3 cap 을 다시 초과한다** — ① [LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 버튼 (약 30 LOC) ② 그 [spec](../../web/src/components/LlmProviderConfigList.test.tsx) (T-1897 실측 배지 spec 이 139 LOC 였으므로 버튼 spec 도 100+ LOC) ③ [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) state 2 + 핸들러 + 반환 3 키 (약 45 LOC) ④ 그 [spec](../../web/src/views/useAdminLlmProviders.test.ts) (약 130 LOC) ⑤ [AdminView.tsx](../../web/src/views/AdminView.tsx) 배선 ⑥ 신규 `AdminView.llm-provider-set-default-contract.test.ts` (기존 llm-provider create · delete · list · update contract spec 4 종과 동형이 요구된다) = **6 파일 · 약 445 LOC** 로 파일 cap (≤ 5) · diff cap (≤ 300) 을 둘 다 초과한다. T-1866 이 미실측으로 SUPERSEDED 된 전례를 반복하지 않기 위해 쓰기 축 B 를 B1 (hook) · B2 (버튼 컴포넌트) · B3 (AdminView 배선 + contract spec) 3 조각으로 다시 split 하고, 본 slice 는 그 **B1** 이다.

B1 을 먼저 두는 이유는 §3 소비처 동반 의무다 — T-1898 이 머지한 [`runSetDefaultProvider`](../../web/src/views/adminLlmProviderMutationRunners.ts) `334 행` 에는 아직 호출자가 없고, 그 직접 소비처가 본 hook 핸들러다.

## Required Reading

- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `296 행 ~ 314 행` (`SetDefaultProviderDeps` — 주입할 6 필드 `update` · `describeError` · `settingDefault` · `setSettingDefault` · `setDefaultError` · `bumpRefresh` 의 정본), `334 행 ~ 337 행` (`runSetDefaultProvider(id, deps)` — **인자 순서 `(id, deps)`**).
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `65 행 ~ 92 행` (`deletingProvider` · `deleteProviderError` state + `handleDeleteProvider` useCallback — **본 slice 가 1:1 mirror 할 정본**: 주석 밀도 · deps 주입 규약 · `[deletingProvider]` 의존성 배열), `335 행 ~ 376 행` (반환 object — 공개 표면 36 심볼 + 그 위 주석의 심볼 수 문구).
- [web/src/views/useAdminLlmProviders.test.ts](../../web/src/views/useAdminLlmProviders.test.ts) `1 행 ~ 60 행` (harness 설명 + `vi.hoisted` mock 조립 + `vi.mock('./adminLlmProviderMutationRunners', …)` — **본 slice 는 여기에 `runSetDefaultMock` 을 추가한다**), `145 행 ~ 220 행` (초기 반환 계약 describe — 반환 키 목록에 신규 3 키 추가 대상), `276 행 ~ 291 행` (`handleDeleteProvider` 주입 계약 spec — mirror 대상), `503 행 ~ 530 행` (negative describe), `555 행 ~ 585 행` (**캡슐화 회귀 가드 — `toHaveLength(36)` 과 그 위 주석 문구를 신규 키 수만큼 갱신해야 한다**).
- [docs/architecture/api.md](../architecture/api.md) `134 행` — `PUT /api/llm/providers/default` 계약 (문구 참조용. 본 slice 는 fetch 를 직접 발사하지 않는다 — 러너에 위임).
- [docs/tasks/T-1898-web-llm-set-default-provider-runner.md](T-1898-web-llm-set-default-provider-runner.md) §Follow-ups — 쓰기 축 B 소비처 배선 5 항목 원본 (본 slice 는 그중 hook 항목만 집행).

## Acceptance Criteria

- [ ] `useAdminLlmProviders.ts` 에 state 2 개 추가 — `settingDefault: boolean` (기본 `false`, PUT in-flight) · `setDefaultError: string | undefined` (기본 `undefined`, 실패 문구). `deletingProvider` · `deleteProviderError` (`65 행 ~ 74 행`) 의 주석 밀도 · 명명 규약을 그대로 따른다.
- [ ] `handleSetDefaultProvider = useCallback((id: string) => runSetDefaultProvider(id, { … }), [settingDefault])` 추가 — deps 주입은 `update: request` · `describeError: toErrorMessage` · `settingDefault` · `setSettingDefault` · `setDefaultError` · `bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1)`. `handleDeleteProvider` (`81 행 ~ 92 행`) 의 주입 규약을 1:1 mirror 하고, hook 은 **자체 가드 판단을 하지 않는다** (빈 id · 재진입 차단은 러너 책임 — 위임만).
- [ ] 반환 object 에 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` 3 키 추가 (`setSettingDefault` 등 내부 setter 는 **미노출** — 캡슐화 규약). 반환 표면 주석의 심볼 수 문구 (`336 행` 부근 "36 심볼") 도 39 로 갱신.
- [ ] happy-path test 1+ — `hook.handleSetDefaultProvider('p2')` 호출 시 `runSetDefaultProvider` mock 이 정확히 1 회, 첫 인자 `'p2'`, deps 의 `update === requestStub` · `describeError === toErrorMessageStub` · `settingDefault === false` · `setSettingDefault` · `setDefaultError` · `bumpRefresh` 가 function (`276 행 ~ 291 행` 의 delete 주입 계약 spec 형식 그대로).
- [ ] error path test 1+ — 러너 mock 이 reject 해도 hook 호출이 throw 를 전파하지 않고 렌더가 깨지지 않는다 (`315 행` error path describe 의 delete 선례 형식 — 반환 promise 를 모아 `resolves` 로 관측).
- [ ] 분기별 test 1+ — (a) 초기 렌더 반환값 `settingDefault === false` · `setDefaultError === undefined` (b) 주입된 `setSettingDefault(true)` 호출 후 재렌더 시 반환 `settingDefault === true` 이고 다음 호출의 deps `settingDefault` 가 `true` 로 실린다 (render-phase update harness) (c) 주입된 `setDefaultError('문구')` 후 반환 `setDefaultError === '문구'` (d) 주입된 `bumpRefresh()` 호출 시 provider 조회 path 가 새 nonce 로 바뀐다 (`useApiResourceMock` 인자 관찰 — delete 축 선례 동형).
- [ ] negative case 를 예외 분기마다 1+ — (a) 빈 문자열 id 로 호출해도 hook 은 자체 판단 없이 그대로 러너에 위임 (`520 행` delete 선례 동형) (b) 공백만 (`'   '`) id 도 동일 위임 (경계값 — 차단은 러너 책임) (c) 반환 object 가 `setSettingDefault` 등 내부 setter 를 노출하지 않는다 (`555 행` 캡슐화 가드 hidden 목록에 `setSettingDefault` 추가) (d) 러너 mock 이 `undefined` 를 반환해도 hook 반환 계약이 유지된다 (throw 없음).
- [ ] `555 행 ~ 585 행` 캡슐화 회귀 가드의 `expect(keys).toHaveLength(36)` 를 **39** 로 갱신 + 그 위 한국어 주석의 심볼 수 문구도 함께 갱신 (숫자만 바꾸고 hidden 목록의 기존 항목은 유지).
- [ ] `145 행 ~ 220 행` 초기 반환 계약 describe 의 키 목록에 신규 3 키 추가 — 기존 항목 순서 · 문구 변경 0.
- [ ] 기존 러너 4 축 (create · update · delete · assign) spec 과 [adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) · AdminView drift-guard spec 전량 **무수정 green**.
- [ ] `pnpm lint && pnpm build && pnpm test` (root) + `pnpm --dir web test` 통과. web coverage line ≥ 80% / function ≥ 80% — 변경 hook 파일의 신규 라인은 100% 목표.

## Out of Scope

- [LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 의 `onSetDefault` prop · "기본으로 지정" 버튼 · 그 spec (**B2**). 본 slice 는 `web/src/components/` 를 한 줄도 건드리지 않는다.
- [AdminView.tsx](../../web/src/views/AdminView.tsx) destructure 키 추가 · props 전달 · 신규 `AdminView.llm-provider-set-default-contract.test.ts` (**B3**). 본 slice 는 `AdminView.tsx` 를 한 줄도 건드리지 않으며 기존 AdminView contract spec 도 무수정이어야 한다.
- [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 본문 수정 (T-1898 에서 완결 — import 만 한다).
- 삭제 409 (기본 row) 안내 문구 개선, 기본 provider 전용 GET, seed no-override ([T-1867](T-1867-seed-llm-config-default-no-override.md)), doc-sync ([T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md)).
- hook 의 다른 축 (create · update · assign) 리팩터 · 주석 정리 (다른 주제 — Follow-ups 로).

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- **B2 (쓰기 축 B 재split 2/3)** — ① [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 에 `onSetDefault?: (id: string) => void` prop + `SET_DEFAULT_LABEL` 상수 + 버튼 (`row.isDefault === true` 행은 배지만 두고 버튼 미렌더, prop 미전달 시 버튼 0 — `onEdit` · `onDelete` 선택 prop 규약 동형) ② [web/src/components/LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) 에 버튼 렌더 · 콜백 인자 · 기본 행 버튼 부재 · prop 미전달 하위 호환 spec.
- **B3 (쓰기 축 B 재split 3/3)** — ③ [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 `useAdminLlmProviders()` destructure 에 3 키 추가 + `<LlmProviderConfigList onSetDefault={handleSetDefaultProvider} loading={… || settingDefault} error={setDefaultError ?? deleteProviderError ?? providersError}>` props (신규 로직 0) ④ 신규 `web/src/views/AdminView.llm-provider-set-default-contract.test.ts` (기존 `AdminView.llm-provider-delete-contract.test.ts` 동형 계약 spec).
- chain 잔여: [T-1867](T-1867-seed-llm-config-default-no-override.md) (seed no-override) → [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct doc-sync, PLAN `107 행` bullet 닫기).
