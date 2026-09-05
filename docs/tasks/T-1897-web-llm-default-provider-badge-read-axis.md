---
id: T-1897
title: Web UI — LLM provider 목록 기본 배지 (읽기 축, T-1866 split 1/3)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865]
touchesFiles:
  - web/src/views/adminProviderDifficultyDerivations.ts
  - web/src/views/adminProviderDifficultyDerivations.test.ts
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
estimatedDiff: 230
estimatedFiles: 4
created: 2026-09-05
plannerNote: "PLAN 107 행 오너 chain 5/7 재실측 split 1/3 — T-1866(7 파일, 파일 cap 초과)을 읽기 축(배지)만으로 좁혀 4 파일. 소비처는 AdminView 무수정으로 이미 배선됨."
---

# T-1897 — Web UI — LLM provider 목록 기본 배지 (읽기 축)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 T-1866 은 "배지 + 기본 지정 버튼 + PUT 배선" 을 한 slice 로 묶어 실측 7 파일 (CLAUDE.md §3 파일 cap ≤ 5 초과) 이었다. 2026-09-05 03:42 저널의 planner 재실측 지시대로 읽기 축 / 쓰기 축으로 나눈 첫 조각이다.

읽기 축은 backend 가 이미 다 열어 뒀다 — T-1864 가 `LlmProviderConfigView` 에 파생 필드 `isDefault` 를 추가했고 (`src/llm/llm-provider-config.service.ts` `86 행`), `GET /api/llm/providers` 응답의 7 번째 필드로 나온다. 그런데 web 쪽은 `LlmProviderRow` 에 그 필드가 없어 파생 단계에서 통째로 버려지고 있다. 이 slice 는 그 값을 화면까지 흘려 Admin 이 **현재 기본이 무엇인지** 볼 수 있게 한다. 쓰기 축 (기본 지정 버튼 + `PUT /api/llm/providers/default` 러너 + hook state) 은 후속 slice 2 개로 분리한다.

소비처 동반 의무 (CLAUDE.md §3) 는 이 slice 안에서 이미 충족된다 — [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 `<LlmProviderConfigList providers={providerConfigs} …>` 로 파생 결과를 그대로 내려보내고 있어 (`deriveProviderConfigs` → props), 파생 helper 와 컴포넌트만 고치면 실제 화면에 배지가 뜬다. AdminView 수정 0 줄.

## Required Reading

- [web/src/views/adminProviderDifficultyDerivations.ts](../../web/src/views/adminProviderDifficultyDerivations.ts) `37 행 ~ 45 행` (`LlmProviderRow` 타입 — 선택 필드 추가 지점) 과 `82 행 ~ 102 행` (`deriveProviderConfigs` — truthy 일 때만 키를 매핑하는 보수 매핑 convention).
- [web/src/views/adminProviderDifficultyDerivations.test.ts](../../web/src/views/adminProviderDifficultyDerivations.test.ts) — 순수 helper spec 패턴 (happy / 선택 필드 누락 / 비배열 안전).
- [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 전체 (110 행) — `LlmProviderConfigRow` 계약, 라벨 상수 (`DELETE_LABEL` / `EDIT_LABEL`) 규약, loading → error → empty → populated 분기 순서.
- [web/src/components/LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) — 조건부 렌더 / 라벨 조회 검증 패턴.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `76 행 ~ 100 행` — `LlmProviderConfigView` 의 7 필드와 파생 `isDefault` 의미 (슬롯이 가리키는 row 만 true, 자동 승격 0).
- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) §Decision 3 — `isDefault` 는 컬럼이 아니라 단일 슬롯 table 파생값. 정확히 0 개 또는 1 개 row 만 true.

## Acceptance Criteria

- [ ] `LlmProviderRow` (`adminProviderDifficultyDerivations.ts`) 에 선택 필드 `isDefault?: boolean` 추가. `deriveProviders` (DifficultyModelSelector 경로) 동작은 **불변** — 이 필드를 쓰지 않는다.
- [ ] `deriveProviderConfigs` 가 `row.isDefault === true` 인 경우에만 `isDefault: true` 키를 매핑한다. false / undefined / 문자열 `"true"` 같은 비-boolean 은 **키 자체를 생략** (modelId · endpointUrl 의 truthy-only convention 동형). 기존 `expect(partial[0]).toEqual({ id, provider })` 류 단언이 그대로 green 이어야 한다 (기존 spec 무수정 통과가 본 항목의 검증 수단).
- [ ] `LlmProviderConfigRow` (`LlmProviderConfigList.tsx`) 에 `isDefault?: boolean` 추가. `isDefault === true` 인 행에만 `기본` 배지를 라벨 옆에 렌더한다 — `data-testid="llm-provider-default-badge"` 로 조회 가능. 배지 라벨은 파일 상단 상수 (`DEFAULT_BADGE_LABEL`) 로 두어 `DELETE_LABEL` / `EDIT_LABEL` 규약을 따른다.
- [ ] 기존 props 계약 불변 — `onDelete` / `onEdit` 미전달 시 버튼 미렌더, loading → error → empty 분기 순서, `apiKey` 미노출은 그대로. 컴포넌트에 mutation · fetch 로직 0 (controlled presentational 유지).
- [ ] happy-path test 1+ — `isDefault: true` row 1 개 + 비-default row 2 개인 목록에서 배지가 정확히 1 개 렌더되고 그 행의 provider 라벨과 같은 `<li>` 안에 있다. `deriveProviderConfigs` 가 backend 형태 (7 필드) row 를 받아 `isDefault: true` 를 보존한다.
- [ ] error path test 1+ — `error` truthy 이면 `isDefault: true` row 가 있어도 배지 0 (alert 영역만 렌더). `loading === true` 이면 배지 0 (loading 우선 정책).
- [ ] 분기별 test 1+ — 배지 렌더 분기의 true / false 양쪽, `deriveProviderConfigs` 의 매핑 / 생략 양쪽.
- [ ] negative case 를 예외 분기마다 1+ — (a) `isDefault` 필드 자체가 없는 row → 배지 0 (b) `isDefault: false` → 배지 0 + 파생 결과에 키 없음 (c) `isDefault: "true"` 같은 비-boolean → 배지 0 (보수 매핑) (d) 빈 목록 → 배지 0 + 빈 상태 문구 (e) `rows` 가 배열이 아님 (undefined / null) → 빈 배열 반환, throw 없음 (f) 여러 row 가 `isDefault: true` 인 비정상 응답 → 컴포넌트는 throw 없이 각 행에 배지를 렌더 (backend 불변식 위반은 web 이 교정하지 않는다 — 이 정책을 spec 주석에 명시).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. web coverage line ≥ 80% / function ≥ 80% (변경 2 파일은 line · branch · function 100% 목표).

## Out of Scope

- "기본으로 지정" 버튼 · `onSetDefault` prop · `runSetDefaultProvider` 러너 · `PUT /api/llm/providers/default` 호출 — **후속 쓰기 축 slice 2 개** 책임.
- [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) / [AdminView.tsx](../../web/src/views/AdminView.tsx) 수정 — 본 slice 는 두 파일 모두 무수정이다 (파생 결과가 이미 props 로 흐른다). 수정이 필요해 보이면 설계가 틀린 것이니 멈추고 Follow-ups 에 적는다.
- `DifficultyModelSelector` · `deriveProviders` 동작 변경.
- 삭제 409 (기본 row) 안내 문구 개선, 배지 스타일링 / CSS.
- AdminView god component 정리 (PLAN `183 행` 별도 chain).

## Suggested Sub-agents

`implementer → tester`.

## Follow-ups

- (후속 slice A) `runSetDefaultProvider(deps, id)` 러너 + `adminLlmProviderMutationRunners.test.ts` — `PUT /api/llm/providers/default` body `{ llmProviderConfigId }`, 성공 시 nonce bump, 404 / 500 / network 한국어 문구.
- (후속 slice B) `useAdminLlmProviders.ts` 의 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` 배선 + `LlmProviderConfigList` 의 `onSetDefault` 버튼 + AdminView props 2 개.
