---
id: T-1864
title: resolver 우선순위 — 명시 기본 provider 최우선 + service setDefault / isDefault view
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1863]
touchesFiles:
  - src/llm/llm-provider-config-resolver.service.ts
  - src/llm/llm-provider-config-resolver.service.spec.ts
  - src/llm/llm-provider-config.service.ts
  - src/llm/llm-provider-config.service.spec.ts
estimatedDiff: 260
estimatedFiles: 4
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 3/7. T-1863 repository 메서드의 소비처 slice — resolver 가 실 동작 변경 지점 (row ≥ 2 fail-fast 가 명시 선택으로 해소)"
---

# T-1864 — resolver 우선순위 — 명시 기본 provider 최우선 + service setDefault / isDefault view

## Why

[T-1863](T-1863-llm-default-provider-schema-migration-repository.md) 이 만든 `findDefault` / `setDefault` 의 소비처를 배선한다. 실제 동작이 바뀌는 지점은 [LlmProviderConfigResolver](../../src/llm/llm-provider-config-resolver.service.ts) 다 — 오너 지시 (2026-09-03) "명시 선택이 언제나 우선" 을 코드로 옮기면 **resolver 의 첫 분기가 `findDefault()` 여야** 하고, row 수 기반 3 분기는 명시 선택이 없을 때의 fallback 으로 강등된다. 이로써 seed row + UI row 공존 (row ≥ 2) 상태에서 Admin 이 기본을 지정하는 순간 `unevaluated-fill-run` default 경로가 되살아난다.

service 쪽은 T-1865 controller 가 쓸 `setDefault(id)` 와, 목록 view 의 `isDefault` 필드 (UI 가 별도 GET 없이 배지를 그리기 위한 것 — ADR-0062 (B)) 를 추가한다.

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — (1) 명시 최우선 · (2) fallback 3 분기 · (B) view 필드.
- [src/llm/llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) 전체 (약 100 행) — 현 3 분기 + `TypeError` 형식 검증. 형식 검증은 명시 선택 row 에도 동일 적용.
- [src/llm/llm-provider-config-resolver.service.spec.ts](../../src/llm/llm-provider-config-resolver.service.spec.ts) — repository mock 패턴 (`findMany` jest.fn). `findDefault` mock 추가.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `72~130 행` (view type + sanitize 명시 field pick), `240~270 행` (delete 의 P2025/P2003 변환 — `setDefault` 의 P2025 → 404 변환 선례).
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — T-1863 이 추가한 `findDefault` / `setDefault` 시그니처.

## Acceptance Criteria

- [ ] `resolveDefaultModelId()` 분기 재정의 — (0) `findDefault()` 비-null → 그 row 의 `modelId` (형식 검증 후) 반환, **row 수와 무관**. (0) 이 null 일 때만 기존 (a)/(b)/(c). (c) 의 메시지는 "LlmProviderConfig 가 N 개 — Admin UI 의 LLM provider 설정에서 기본 provider 를 지정하라" 로 행동 지시형 교체.
- [ ] `LlmProviderConfigView` 에 `isDefault: boolean` 추가. `findAll` / `findById` / `create` / `update` 가 돌려주는 view 모두 채워진다 (택1 (i) 면 row 컬럼 그대로, (ii) 면 `findDefault` 1 회 조회 후 id 비교 — findAll 에서 N+1 금지). `apiKey` 는 여전히 명시 field pick 밖.
- [ ] `setDefault(id): Promise<LlmProviderConfigView>` — repository.setDefault 호출, P2025 → `NotFoundException` (404), 반환 view 의 `isDefault === true`.
- [ ] resolver happy-path 1+ — 명시 default 가 있고 row 가 3 개일 때 default 의 modelId 반환 (row ≥ 2 fail-fast 가 더 이상 발생하지 않음을 **명시적으로** 검증하는 test 1 — 회귀 방지).
- [ ] resolver error path 1+ — `findDefault` reject propagate · 명시 default row 의 modelId 가 빈 문자열이면 `TypeError`.
- [ ] resolver 분기 cover — (0) hit / (0) miss → (a) / (b) / (c) 각 1+. (c) 메시지 문구 검증.
- [ ] service happy/error/분기/negative — `setDefault` 성공 · P2025 404 · 그 외 error raw propagate · 빈 id · `findAll` 의 `isDefault` 가 정확히 1 row 만 true (또는 전부 false) · view 에 `apiKey` 키 자체가 없음 (`not.toHaveProperty`).
- [ ] 기존 resolver / service spec 이 새 mock 없이 깨지면 본 PR 에서 갱신.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build` 통과.

## Out of Scope

- controller / DTO / api.md (T-1865). 본 slice 의 `setDefault` 는 service 까지 — HTTP 노출은 다음 slice.
- Web UI (T-1866). seed (T-1867).
- `LlmHttpGateway` 변경 — difficulty 미제공 경로는 종전대로 `options.modelId` (config id) 직접 사용. 기본 provider 는 resolver 의 소비처 (`unevaluated-fill-run`) 에만 영향.

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- T-1865: `PUT /api/llm/providers/default` 가 본 `setDefault` 를 호출. `DELETE /:id` 의 기본 row 409 는 택1 (ii) 면 P2003 자동 · (i) 면 service `delete` 에 "isDefault 면 ConflictException" 분기 추가 — T-1865 에서 처리.
