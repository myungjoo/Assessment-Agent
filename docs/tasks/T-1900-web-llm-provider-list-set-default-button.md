---
id: T-1900
title: Web UI — LlmProviderConfigList "기본으로 지정" 버튼 (쓰기 축 B2, T-1866 재split 2/3)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1897, T-1898, T-1899]
touchesFiles:
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
estimatedDiff: 200
estimatedFiles: 2
created: 2026-09-05
plannerNote: "PLAN 107 행 chain 5/7 — 쓰기 축 B 재split 의 2/3(버튼 컴포넌트 + spec 2 파일). B1 hook 머지(b4a945ea) 후속."
---

# T-1900 — Web UI — `onSetDefault` prop + "기본으로 지정" 버튼 (쓰기 축 B2)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 [T-1866](T-1866-web-llm-default-provider-select-ui.md) 은 파일 cap 초과로 SUPERSEDED 됐고, 쓰기 축 B 도 현 head 실측 6 파일 · 약 445 LOC 로 cap 재초과가 확정돼 B1 (hook 핸들러) · B2 (버튼 컴포넌트) · B3 (AdminView 배선 + contract spec) 로 다시 split 했다. B1 인 [T-1899](T-1899-web-llm-set-default-provider-hook-handler.md) 가 `b4a945ea` 로 머지돼 `handleSetDefaultProvider` 가 hook 반환 표면에 올라왔으므로, 본 slice 는 그 핸들러를 실제로 발화할 **UI 컨트롤 (B2)** 을 presentational 컴포넌트에 추가한다.

오너 확정 제약 ① ("Admin 이 Web UI 에서 지정한 기본 provider 가 어떤 자동 규칙보다 언제나 우선") 는 화면에 **명시 선택 컨트롤**이 존재해야 성립한다 — [T-1897](T-1897-web-llm-default-provider-badge-read-axis.md) 이 읽기 축 ("기본" 배지) 만 닫았고, 지정 행위 자체의 진입점은 아직 없다.

본 slice 는 §3 소비처 동반 의무의 관점에서 **컴포넌트 계약까지만** 책임진다 — 버튼의 실 소비처인 AdminView 배선은 B3 이며, 그 이유는 AdminView 배선을 같은 PR 에 넣으면 신규 contract spec 포함 4 파일 · 약 300 LOC 로 cap 경계를 다시 밟기 때문이다 (`estimatedDiff` / `estimatedFiles` 근거 제시 — §3 예외 조항). 잔여 소비처 배선은 §Follow-ups 에 파일 · 배선 단위로 명시한다.

## Required Reading

- [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 전량 (127 행). 특히 `31 행 ~ 40 행` (`DELETE_LABEL` · `EDIT_LABEL` · `DEFAULT_BADGE_LABEL` · `DEFAULT_BADGE_TESTID` 상수 규약 — 본 slice 가 mirror 할 정본), `51 행 ~ 59 행` (`onDelete?` · `onEdit?` 선택 콜백 prop 의 주석 밀도 · controlled 계약 문구), `101 행 ~ 119 행` (`row.isDefault === true` 배지 분기 + `onEdit` / `onDelete` 버튼 분기 — 신규 버튼이 끼어들 지점과 렌더 순서).
- [web/src/components/LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) `1 행 ~ 66 행` (import · 라벨 토큰 상수 · `countBadges` · `collectButtons(node)` 헬퍼 · `sampleProviders` 2 건 — 본 slice 는 여기에 `SET_DEFAULT_LABEL` 토큰만 추가하고 헬퍼는 재사용한다), `283 행 ~ 318 행` (`onEdit` 렌더 · 콜백 발화 · 미전달 하위 호환 3 종 — **본 slice 가 1:1 mirror 할 형식**), `319 행 ~ 354 행` (`onEdit` + `onDelete` 공존 버튼 수 · `collectButtons` 순서 검증 — 신규 버튼의 순서 spec 형식), `388 행 ~ 409 행` (배지 happy-path — `<li>` 단위 split 로 행 대응을 확인하는 관용구), `410 행 ~ 439 행` (loading / error 우선 negative 형식).
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `105 행 ~ 125 행` (`handleSetDefaultProvider` 시그니처 `(id: string) => void` — 본 slice 의 prop 타입이 맞춰야 할 소비처 계약. 파일 수정은 하지 않는다).
- [docs/tasks/T-1899-web-llm-set-default-provider-hook-handler.md](T-1899-web-llm-set-default-provider-hook-handler.md) §Follow-ups 의 **B2** 항목 — 본 slice 의 원본 범위 정의.

## Acceptance Criteria

- [ ] `LlmProviderConfigList.tsx` 에 선택 prop `onSetDefault?: (id: string) => void` 추가 — `onEdit` (`55 행 ~ 59 행`) 의 주석 밀도 · controlled 계약 문구 (실 PUT 요청 · 재조회는 상위 컨테이너 책임) 를 그대로 mirror 한다.
- [ ] 라벨 상수 `SET_DEFAULT_LABEL = '기본으로 지정'` 을 `EDIT_LABEL` (`34 행`) 옆에 상수로 선언 (인라인 문자열 금지 — 기존 상수 규약).
- [ ] 버튼 렌더 분기 — `onSetDefault` 가 전달되고 **그 행이 `row.isDefault === true` 가 아닐 때만** 버튼을 렌더한다 (이미 기본인 행은 배지만 두고 버튼 미렌더 — 무의미한 재지정 차단). 클릭 시 `row.id` 로 콜백 호출. 렌더 순서는 기존 `수정` → `삭제` **뒤** (마지막) — 기존 두 버튼의 상대 순서 · 기존 spec 기대값을 한 줄도 바꾸지 않기 위함이며, 그 근거를 주석 한 줄로 남긴다.
- [ ] loading / error / empty 세 우선 분기는 신규 prop 과 무관하게 그대로 유지 (분기 순서 변경 0).
- [ ] happy-path test 1+ — `onSetDefault` 전달 시 비-default 행 수만큼 버튼이 렌더되고 `html` 에 `SET_DEFAULT_LABEL` 이 등장한다 (`283 행` `onEdit` 렌더 spec 형식).
- [ ] happy-path test 1+ — `collectButtons` 로 수집한 버튼의 `onClick` 발화 시 해당 행 `id` (`'p1'` · `'p2'`) 로 `onSetDefault` 가 호출된다 (`295 행` 콜백 발화 spec 형식).
- [ ] error path test 1+ — `error` truthy + `onSetDefault` 전달 → 목록 · 버튼 대신 `role="alert"` 만 렌더 (버튼 0). (`370 행` 형식)
- [ ] 분기별 test 1+ — (a) `loading=true` + `onSetDefault` 전달 → 로딩 표시 우선, 버튼 0 (b) `row.isDefault === true` 인 행에는 버튼 미렌더 · 배지만 렌더, 같은 목록의 비-default 행에는 버튼 렌더 (`<li>` 단위 split 로 행 대응 확인 — `388 행` 관용구) (c) `onSetDefault` + `onEdit` + `onDelete` 3 종 동시 전달 시 비-default 행당 버튼 3 개, 행별 `[수정, 삭제, 기본으로 지정]` 순으로 각 콜백이 대응 id 로 호출된다 (`335 행` 순서 spec 형식).
- [ ] negative case 를 예외 분기마다 1+ — (a) `onSetDefault` 미전달 → 버튼 0 · 기존 렌더 불변 (읽기 전용 하위 호환 — T-1134 마운트 보존) (b) 빈 배열 providers + `onSetDefault` 전달 → 버튼 0 + 빈 상태 문구 (c) 모든 행이 `isDefault: true` (backend 불변식 위반 응답) → 버튼 0 이지만 throw 없이 배지는 각 행에 그대로 렌더 (화면이 응답을 있는 그대로 비춘다 — `485 행` 정책 동형) (d) `isDefault: 'true'` 같은 비-boolean → 엄격 boolean 비교라 배지 0 이고 버튼은 **렌더된다** (경계값 — 비-default 취급) (e) `onSetDefault` 전달 상태에서도 markup 에 `apiKey` 등 secret 토큰이 등장하지 않는다.
- [ ] 기존 spec 전량 **무수정 green** — `onEdit` / `onDelete` / 배지 관련 기존 케이스의 문구 · 기대값 변경 0 (신규 라벨 `'기본으로 지정'` 이 `DEFAULT_BADGE_LABEL='기본'` 을 부분 문자열로 포함하지만 배지 판정은 `data-testid` 토큰 기반이라 오탐이 없음을 확인).
- [ ] `pnpm lint && pnpm build && pnpm test` (root) + `pnpm --dir web test` 통과. web coverage line ≥ 80% / function ≥ 80% — 변경 컴포넌트의 신규 라인은 100% 목표.

## Out of Scope

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) destructure 키 추가 · `onSetDefault` props 전달 · 신규 `AdminView.llm-provider-set-default-contract.test.ts` (**B3**). 본 slice 는 `web/src/views/` 를 한 줄도 건드리지 않으며 기존 AdminView contract spec 도 무수정이어야 한다.
- [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) · [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 수정 (T-1898 · T-1899 에서 완결 — 본 slice 는 import 조차 하지 않는다).
- 기본 row 삭제 409 안내 문구 개선, 기본 provider 전용 GET, seed no-override ([T-1867](T-1867-seed-llm-config-default-no-override.md)), doc-sync ([T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md)).
- 배지 · 버튼의 CSS / 스타일링, 확인 다이얼로그, 낙관적 UI (다른 주제 — Follow-ups 로).
- 컴포넌트의 다른 축 (`onEdit` · `onDelete`) 리팩터 · 주석 정리.

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- **B3 (쓰기 축 B 재split 3/3)** — ① [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1029 행` 의 `<LlmProviderConfigList>` 에 `onSetDefault={handleSetDefaultProvider}` + `loading={… || settingDefault}` + `error={setDefaultError ?? …}` props 전달 및 `useAdminLlmProviders()` destructure 3 키 추가 (신규 로직 0) ② 신규 `web/src/views/AdminView.llm-provider-set-default-contract.test.ts` (기존 `AdminView.llm-provider-delete-contract.test.ts` 동형 계약 spec).
- chain 잔여: [T-1867](T-1867-seed-llm-config-default-no-override.md) (seed no-override) → [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct doc-sync, PLAN `107 행` bullet 닫기).
