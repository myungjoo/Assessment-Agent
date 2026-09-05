---
id: T-1898
title: Web UI — runSetDefaultProvider PUT 러너 (쓰기 축 A, T-1866 split 2/3)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1897]
touchesFiles:
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
estimatedDiff: 245
estimatedFiles: 2
created: 2026-09-05
plannerNote: "PLAN 107 행 오너 chain 5/7 split 2/3 — T-1866 §Resolution 이 예고한 쓰기 축 A(러너 + spec) 2 파일. 소비처 hook 배선은 3/3."
---

# T-1898 — Web UI — `runSetDefaultProvider` PUT 러너 (쓰기 축 A)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 [T-1866](T-1866-web-llm-default-provider-select-ui.md) 은 실측 7 파일로 CLAUDE.md §3 파일 cap (≤ 5) 을 초과해 SUPERSEDED 됐고, 그 §Resolution 이 읽기 축 (T-1897, 머지) → **쓰기 축 A (러너)** → 쓰기 축 B (버튼 + hook + AdminView 배선) 3 조각으로 split 했다. 본 slice 는 그 2/3 이다.

backend 는 [T-1865](T-1865-llm-default-provider-controller-endpoint.md) 가 `PUT /api/llm/providers/default` 를 이미 열어 뒀고 ([api.md](../architecture/api.md) `134 행`), 읽기 축은 T-1897 이 목록에 `기본` 배지를 띄웠다. 남은 것은 Admin 이 실제로 기본을 **바꾸는** 발사 경로다. 그 mutation 본체를 AdminView / hook 이 아니라 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 의 순수 async 러너로 두는 것이 이 모듈의 확립된 convention 이며 (PLAN `183 행` god component 부채 — 신규 로직은 러너 모듈에), jsdom 없이 mutation 본체를 직접 검증할 수 있다.

**§3 소비처 동반 의무의 명시 예외** — 본 러너의 소비처 (hook handler + 버튼) 를 같은 PR 에 포함하면 `useAdminLlmProviders.ts` + 그 spec + `LlmProviderConfigList.tsx` + 그 spec + `AdminView.tsx` 가 더해져 **7 파일 / 약 550 LOC** 로 파일 cap (≤ 5) · diff cap (≤ 300) 을 둘 다 초과한다 (T-1866 이 SUPERSEDED 된 사유 그대로). 그래서 소비처 배선은 아래 `Follow-ups` 에 파일 · 배선 단위로 명시하고 쓰기 축 B slice 로 분리한다.

## Required Reading

- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `39 행` (`LLM_PROVIDERS_PATH` 상수 — 본 러너도 이 상수를 쓴다, 재선언 금지), `50 행 ~ 106 행` (`DeleteProviderDeps` + `runDeleteProvider` — **`(id, deps)` 인자 순서 · 빈/공백 id 가드 · in-flight 가드 · setError(undefined) 선행 · try/catch/finally 골격의 정본 mirror 대상**), `205 행 ~ 303 행` (`UpdateProviderDeps` + `runUpdateProvider` — JSON body 발사 + `bumpRefresh()` 권위 재조회 convention).
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) `1 행 ~ 107 행` (모듈 import + deps mock 조립 헬퍼), `169 행 ~ 222 행` (`runDeleteProvider` describe — 가드 · 성공 · 실패 케이스 배치), `223 행 ~ 309 행` (`runUpdateProvider` describe — body 단언 패턴).
- [docs/architecture/api.md](../architecture/api.md) `134 행` — `PUT /api/llm/providers/default` 계약 (body `SetDefaultLlmProviderDto { llmProviderConfigId }` · 200 + sanitize view · 400 / 401 / 403 / **404 부재 id** · 멱등).
- [src/llm/dto/set-default-llm-provider.dto.ts](../../src/llm/dto/set-default-llm-provider.dto.ts) — 필드명 `llmProviderConfigId` 1 개 (`@IsString` · `@IsNotEmpty` · `@MaxLength(255)`). body 키 오타 방지용 정본.
- [docs/tasks/T-1866-web-llm-default-provider-select-ui.md](T-1866-web-llm-default-provider-select-ui.md) §Acceptance Criteria 2 번 항목 + §Resolution — 본 slice 의 사양 원본 (재작성 금지, 인용만).

## Acceptance Criteria

- [ ] `SetDefaultProviderDeps` interface 를 `adminLlmProviderMutationRunners.ts` 에 export 추가 — `update: (path, options) => Promise<unknown>` (PUT 발사 primitive) · `describeError: (e: unknown) => string` · `settingDefault: boolean` · `setSettingDefault: (next: boolean) => void` · `setDefaultError: (next: string | undefined) => void` · `bumpRefresh: () => void`. `DeleteProviderDeps` (`50 행`) 의 주석 밀도 · 명명 규약을 그대로 따른다.
- [ ] `runSetDefaultProvider(id: string, deps: SetDefaultProviderDeps): Promise<void>` export 추가. **인자 순서는 `(id, deps)`** — 같은 모듈의 `runDeleteProvider` convention 을 따른다 (T-1866 AC 본문의 `runSetDefaultProvider(deps, id)` 표기는 모듈 convention 에 맞춰 뒤집는다. 이 판정 근거를 선언 위 주석에 한 줄 남긴다).
- [ ] 발사 계약 — `PUT ${LLM_PROVIDERS_PATH}/default` (id 는 path 가 아니라 **body** 로 간다 — `Content-Type: application/json` + `JSON.stringify({ llmProviderConfigId: id })`). path 는 정적 문자열이라 `encodeURIComponent` 대상이 없다.
- [ ] 상태 전이 — 발사 전 `setSettingDefault(true)` + `setDefaultError(undefined)`, 성공 시 `bumpRefresh()` (권위 재조회 — 낙관 반영 · 목록 직접 변형 없음), 실패 시 `setDefaultError(deps.describeError(e))` (throw 없이 표면화, `bumpRefresh` 미호출), `finally` 에서 `setSettingDefault(false)`.
- [ ] 가드 2 종 — (a) 빈 / 공백 / falsy `id` 는 미발사 (`id.trim() === ''` 포함), (b) `settingDefault === true` (이전 발사 미완) 이면 미발사. 두 가드 모두 `runDeleteProvider` 동형이며 `setSettingDefault` 도 호출하지 않는다.
- [ ] happy-path test 1+ — 유효 id 로 호출 시 `update` 가 정확히 1 회, path `'/api/llm/providers/default'`, `method: 'PUT'`, `headers['Content-Type'] === 'application/json'`, `JSON.parse(body)` 가 `{ llmProviderConfigId: id }` 와 정확히 일치 (키 1 개). 성공 후 `bumpRefresh` 1 회 · `setDefaultError(undefined)` 는 호출됐고 error 문구는 set 되지 않음 · `setSettingDefault` 가 true → false 순서로 호출.
- [ ] error path test 1+ — `update` 가 reject 하면 `setDefaultError` 에 `describeError` 결과가 실리고, `bumpRefresh` 는 0 회, `setSettingDefault(false)` 는 여전히 호출된다 (finally 보장). throw 가 호출자에게 전파되지 않는다 (`await expect(...).resolves.toBeUndefined()`).
- [ ] 분기별 test 1+ — 가드 (a) 분기 · 가드 (b) 분기 · 성공 분기 · 실패 분기 각각 1+.
- [ ] negative case 를 예외 분기마다 1+ — (a) `id` 가 빈 문자열 → `update` 0 회 + setter 0 회 (b) `id` 가 공백만 (`'   '`) → `update` 0 회 (경계값) (c) `settingDefault: true` 재진입 → `update` 0 회 (이중 PUT 차단) (d) 404 (부재 id) ApiError reject → 한국어 문구가 `setDefaultError` 로 (e) 403 / 500 비-2xx reject → 문구 표면화 (f) 네트워크 reject (`new TypeError('Failed to fetch')`) → 문구 표면화 + 진행 플래그 clear (g) 이미 기본인 id 재지정 (멱등 성공) → 성공 경로 그대로, error 0.
- [ ] 기존 러너 4 개 (`runDeleteProvider` / `runCreateProvider` / `runUpdateProvider` / `runAssign`) 와 `AdminView` 재수출 identity spec (`393 행` describe) 은 **무수정 green**. 본 slice 는 기존 심볼 본문을 건드리지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` (root) + web `pnpm --dir web test` 통과. web coverage line ≥ 80% / function ≥ 80% — 변경 2 파일은 line · branch · function 100% 목표.

## Out of Scope

- `useAdminLlmProviders.ts` 의 `settingDefault` state · `handleSetDefaultProvider` · 반환 object 노출 (쓰기 축 B).
- `LlmProviderConfigList.tsx` 의 `onSetDefault` prop · "기본으로 지정" 버튼 (쓰기 축 B).
- `AdminView.tsx` 배선 (destructure 키 + props). 본 slice 는 AdminView 를 **한 줄도 건드리지 않는다** — `AdminView.llm-provider-list-contract.test.ts` 등 drift-guard spec 도 무수정이어야 한다.
- 삭제 409 (기본 row) 안내 문구 개선, 기본 provider 조회 전용 GET, 배지 UI 변경 (T-1897 에서 완료).
- 러너 모듈의 다른 심볼 리팩터 · 주석 정리 (다른 주제 — Follow-ups 로).

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- **쓰기 축 B (T-1866 split 3/3, 다음 큐잉 대상)** — 소비처 배선 5 파일: ① [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 에 `onSetDefault?: (id: string) => void` + "기본으로 지정" 버튼 (`isDefault === true` 행에는 배지만, 버튼 미렌더 / prop 미전달 시 버튼 0) ② [web/src/components/LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) 버튼 렌더 · 콜백 인자 spec ③ [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) 에 `settingDefault` state · `setDefaultError` state · `handleSetDefaultProvider` (본 slice 의 `runSetDefaultProvider` 에 `update` · `describeError` · `bumpRefresh` 주입 — `handleDeleteProvider` 주입 규약 mirror) + 반환 object 노출 ④ 같은 hook 의 spec ⑤ [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) destructure 키 추가 + `<LlmProviderConfigList onSetDefault=… loading={… || settingDefault} error={setDefaultError ?? …}>` props 2 (신규 로직 0).
- chain 잔여: [T-1867](T-1867-seed-llm-config-default-no-override.md) (seed no-override) → [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct doc-sync, PLAN `107 행` bullet 닫기 + T-1865 reviewer MINOR `modules.md` LlmModule 행 문구 흡수).
