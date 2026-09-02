---
id: T-1857
title: AdminView 의 LLM provider mutation 러너 군을 별도 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
estimatedDiff: 800
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + RequestOptions 타입 import 1 줄 + 선언 앞 export 키워드만) · (b) 신규 로직 0 LOC (입력 타입 2 · deps 타입 3 · async 러너 3 의 본문 무변경) · (c) 기존 spec 4 개 (llm-provider-create/update/delete contract 3 + AdminView.test.tsx) 가 AdminView 재수출 덕에 import 경로까지 무수정 통과. 삭제 253 + 추가 약 276 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 여섯째 실분할 — head 6f910f7f 의 LLM provider mutation 축 8 심볼 비연속 3 블록 253 줄"
created: 2026-09-02
---

# T-1857 — AdminView 의 LLM provider mutation 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **여섯째 실분할** 이다. 직전 슬라이스 [T-1856](T-1856-adminview-person-mutation-runners-extract.md) 이 인원 축 11 심볼을 [adminPersonMutationRunners.ts](../../web/src/views/adminPersonMutationRunners.ts) 로 빼내며 `Follow-ups` 에 다음 대상을 **"사용자 축 또는 LLM provider 축"** 으로 적어뒀고, 본 slice 가 그 중 **LLM provider 축** 을 집행한다 (사용자 축은 `createInFlightIdGate` 공유 게이트와 인접해 경계가 더 까다로우므로 뒤로 미룬다 — 아래 Out of Scope).

**planner issue-still-relevant pre-check (origin/main `6f910f7f` 실측)** — 본 부채는 미해결이 맞고 대상 블록도 그대로 남아 있다:

1. `git ls-tree origin/main web/src/views/` 에 `adminLlmProviderMutationRunners*` 파일 **0 건** — 미안착 확정 (provider 관련 기존 파일은 계약 spec 4 개뿐).
2. 이동 대상 8 심볼이 전부 `AdminView.tsx` 에 잔존 — `DeleteProviderDeps` (`1596 행`) · `runDeleteProvider` (`1617 행`) · `CreateProviderFields` (`1724 행`) · `CreateProviderDeps` (`1735 행`) · `runCreateProvider` (`1759 행`) · `UpdateProviderFields` (`2137 행`) · `UpdateProviderDeps` (`2150 행`) · `runUpdateProvider` (`2178 행`).
3. 블록이 참조하는 AdminView 모듈 값은 `LLM_PROVIDERS_PATH` (`340 행`) **하나뿐** 이라, T-1854 `GROUPS_PATH` · T-1856 `PERSONS_PATH` 선례대로 동반 이동해 역방향 import 를 원천 차단할 수 있다.
4. 부채 실측 (head `6f910f7f`) — `wc -l web/src/views/AdminView.tsx` = **5,282 줄**, 선언 수 **138**. PLAN `183 행` bullet 이 적은 `5,569 줄 · 150` 은 T-1856 머지 전 값이라 이미 stale 하고, bullet 이 "다음 대상" 으로 지목한 **인원 mutation 러너 군은 T-1856 이 이미 처리** 했다. 즉 PLAN 문면을 그대로 집행하면 중복 작업이 되므로 본 task 가 다음 대상을 provider 축으로 **재지목** 하며, PLAN 본문 갱신은 `direct` 라 Follow-ups 로 분리한다.

목표선 `≤ 2,000 줄` 까지 `-3,282 줄` 이 남아 슬라이스당 -250 ~ -480 줄 페이스로도 산술 7 회 이상이 필요하다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 **비연속 3 블록** 이며, 각 선언 위 주석 블록까지 포함한 경계는 다음과 같다 (origin/main `6f910f7f` 기준, 합계 **249 줄**):
  - **삭제 축** `1591~1649 행` — `DeleteProviderDeps` (`1596`) · `runDeleteProvider` (`1617`). 바로 앞 `1533~1589 행` 의 `RemoveDeps` · `runRemove` 는 그룹 멤버 축이라 **범위 밖**, 종료 직후 `1651 행` 부터의 `AddDeps` 주석도 **범위 밖**.
  - **생성 축** `1721~1800 행` — `CreateProviderFields` (`1724`) · `CreateProviderDeps` (`1735`) · `runCreateProvider` (`1759`). 종료 직후 `1802 행` 부터의 `CREATE_USER_ERROR_SEPARATOR` 주석은 **범위 밖** (사용자 축).
  - **수정 축** `2131~2240 행` — `UpdateProviderFields` (`2137`) · `UpdateProviderDeps` (`2150`) · `runUpdateProvider` (`2178`). 바로 앞 `2104~2129 행` 의 `InFlightIdGate` · `createInFlightIdGate` 는 ServiceIdentity · 역할 변경 경로도 공유하는 범용 게이트라 **범위 밖**, 종료 직후 `2242 행` 부터의 `AdminView` 컨테이너 함수도 당연히 **범위 밖**.
  - `337~340 행` 의 `LLM_PROVIDERS_PATH` 상수 (주석 3 줄 + 선언 1 줄) — 러너 3 개가 직접 참조하므로 **동반 이동 대상** 이며, AdminView 의 `buildProvidersPath` (`903~908 행`, 본문 `905` · `907 행`) 가 계속 쓰므로 AdminView 가 새 모듈에서 import 해 온다. 인접한 `LLM_MAPPINGS_PATH` (`343 행`) 는 난이도 매핑 축이라 **범위 밖**.
  - 파일 끝 `export {` (`5150 행`) · `export type {` (`5233 행`) 목록 — 값 `runDeleteProvider` · `runCreateProvider` · `runUpdateProvider`, 타입 `DeleteProviderDeps` · `CreateProviderFields` · `CreateProviderDeps` · `UpdateProviderFields` · `UpdateProviderDeps` 가 이미 공개 표면이다.
- [web/src/views/adminPersonMutationRunners.ts](../../web/src/views/adminPersonMutationRunners.ts) `1~30 행` — 직전 slice (T-1856) 가 박제한 **모듈 헤더 주석 규약** (이동 근거 · 단방향 import 방향 · 재수출로 기존 spec 보존 · `.ts` 확장자 판단 · 상수 동반 이동 근거). 본 모듈도 같은 형식을 따른다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `176~195 행` — 직전 추출 모듈을 AdminView 가 import 하는 형태 (주석 + 값 import + `import type` 분리) 의 선례. 본 slice 의 import 블록도 같은 형태로 잇는다.
- [web/src/views/adminPersonMutationRunners.test.ts](../../web/src/views/adminPersonMutationRunners.test.ts) — 신설 모듈 **경계 spec** 의 선례 (`70 행` 이후 describe 구조 — 모듈 경계 · 러너별 happy/error/negative · 재수출 동일 참조 `toBe`). [adminCollectionTargetRunners.test.ts](../../web/src/views/adminCollectionTargetRunners.test.ts) `3~10 행` 주석이 그 범위 규약 (기존 spec 의 상세 행동을 복제하지 않고 "새 모듈 자신의 공개 표면" 만 검증) 의 정본이다.
- [web/src/views/AdminView.llm-provider-list-contract.test.ts](../../web/src/views/AdminView.llm-provider-list-contract.test.ts) `70~77 행` · `107~112 행` — `AdminView.tsx` **원문을 `readFileSync` 로 읽는** 유일한 provider 계열 drift-guard. 정규식이 잠그는 것은 `useApiResource<LlmProviderRow[]>(...)` **조회 call site** 라 컨테이너에 그대로 남으며, mutation 러너만 옮기면 계속 green 이다 — 이동 후 반드시 재확인한다.
- [web/src/views/AdminView.llm-provider-create-contract.test.ts](../../web/src/views/AdminView.llm-provider-create-contract.test.ts) `1~14 행` — 계약 spec 3 개가 `from './AdminView'` 로 러너·타입을 가져오는 형태 (update / delete spec 도 동일). 이 import 가 **무수정으로 살아야** 한다.
- [docs/PLAN.md](../PLAN.md) `183 행` — 대상 좌표 · 측정 방법 (`wc -l` / 선언 수 `grep -cE`) · 목표선의 정본. 본 slice 시점의 bullet 문면은 stale 하다 (Why 4 참조).

## Acceptance Criteria

- [ ] `web/src/views/adminLlmProviderMutationRunners.ts` 신설 — 위 3 블록의 **8 심볼** (입력 타입 2 `CreateProviderFields` · `UpdateProviderFields`, deps 타입 3 `DeleteProviderDeps` · `CreateProviderDeps` · `UpdateProviderDeps`, async 러너 3 `runDeleteProvider` · `runCreateProvider` · `runUpdateProvider`) 과 `LLM_PROVIDERS_PATH` 상수를 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`. 허용 변경은 (i) 선언 앞 `export` 키워드 추가, (ii) `import type { RequestOptions } from '../api/apiClient'` 1 줄 추가 뿐이다.
- [ ] 모듈 최상단 헤더 주석 — 이동 근거 (PLAN `183 행` 부채 · 여섯째 실분할) · **AdminView → 본 모듈 단방향 import** 규약 (본 모듈은 AdminView 를 import 하지 않는다) · 재수출로 기존 spec 을 보존한다는 사실 · `LLM_PROVIDERS_PATH` 동반 이동 근거 (역방향 import 차단, T-1854 `GROUPS_PATH` · T-1856 `PERSONS_PATH` 선례) · `.ts` 확장자 판단을 명시.
- [ ] `AdminView.tsx` 는 옮긴 심볼과 `LLM_PROVIDERS_PATH` 를 새 모듈에서 import 하고, `LLM_PROVIDERS_PATH` 를 **재선언하지 않는다** (정본 1 개 유지). `buildProvidersPath` 가 import 한 상수를 그대로 쓴다.
- [ ] `AdminView.tsx` 파일 끝 `export {` / `export type {` 목록의 **공개 표면이 이동 전과 정확히 같다** — 값 심볼 3 개 (`runDeleteProvider` · `runCreateProvider` · `runUpdateProvider`) 와 타입 심볼 5 개 (`DeleteProviderDeps` · `CreateProviderFields` · `CreateProviderDeps` · `UpdateProviderFields` · `UpdateProviderDeps`) 를 그대로 re-export 한다. 이동 전에 export 표면이 아니었던 심볼 (`LLM_PROVIDERS_PATH`) 은 AdminView 에서 새로 export 하지 않는다.
- [ ] 기존 spec **4 개** (`AdminView.llm-provider-create-contract` · `llm-provider-update-contract` · `llm-provider-delete-contract` · `AdminView.test.tsx`) 의 `from './AdminView'` 가 **한 줄도 수정되지 않고** 통과한다. `AdminView.llm-provider-list-contract` 의 `readFileSync` drift-guard (`extractProvidersFireMethod`) 도 AdminView 원문에서 계속 매칭돼야 한다 (조회 call site 는 옮기지 않으므로 무수정 통과가 정상).
- [ ] **happy-path unit test** — 신설 경계 spec `adminLlmProviderMutationRunners.test.ts` 에서 러너 3 개가 **직접 import 경로** 로도 각각 정확한 primitive 를 1 회 발사하고 (`POST /api/llm/providers` · `PATCH /api/llm/providers/:id` · `DELETE /api/llm/providers/:id`) 성공 전이 (재조회 트리거 · 입력 초기화 · 편집 종료) 를 수행함을 검증 (러너당 1+). 모듈이 직접 노출하는 `LLM_PROVIDERS_PATH` 값도 1 건 고정.
- [ ] **error path unit test** — 러너 3 개 각각의 주입 primitive 가 reject 할 때 **throw 없이** error 문구를 error state 로 표면화하고 진행 플래그를 `finally` 로 되돌림을 검증 (러너당 1+).
- [ ] **분기 cover** — 각 러너의 no-op 가드 분기를 분리해 test: 생성은 4 필드 (`provider` · `endpointUrl` · `apiKey` · `modelId`) 중 하나라도 공백이면 미발사하는 가드 · in-flight (`creating`) 가드, 삭제는 `id` 공백 가드 · in-flight (`deleting`) 가드, 수정은 `id` 공백 가드 · in-flight (`updating`) 가드 · **변경 필드 0 (4 필드 전부 공백) 이면 빈 body PATCH 미발사** 분기 + **부분 갱신 body 조립** 분기 (입력된 필드만 body 에 담기고 빈 `apiKey` 는 제외돼 기존 ciphertext 가 유지되는 갈래).
- [ ] **negative cases 충분 cover** — 최소 6 종 이상: ① 공백만 있는 필드가 섞인 생성 입력으로 POST 0 회 ② 공백 `id` 로 DELETE / PATCH 0 회 ③ in-flight 중 재호출 시 이중 발사 0 ④ 실패 경로에서 재조회 트리거 (`bumpRefresh`) · 입력 초기화 (`resetInput`) · 편집 종료 (`closeEdit`) 미호출 ⑤ 변경 필드 0 인 수정 입력으로 PATCH 0 회 ⑥ 비정상 문자가 든 `id` 가 `encodeURIComponent` 로 안전 인코딩돼 path 가 깨지지 않음 ⑦ **재수출 identity 보존** — `AdminView` 에서 import 한 심볼과 새 모듈에서 import 한 심볼이 **동일 함수 참조** (`toBe`) 임을 값 심볼 3 개 전부에 대해 검증 (기존 계약 spec 3 개의 위임 검증이 계속 유효함을 기계적으로 고정).
- [ ] 경계 spec 은 기존 계약 spec 3 개의 상세 행동 검증을 **복제하지 않는다** — 검증 범위는 "새 모듈 자신의 공개 표면" 으로 한정하고, 그 범위 규약을 spec 최상단 주석에 명시 (T-1830 선례).
- [ ] `cd web && pnpm test` (vitest) 전량 green — 기존 spec 4 개가 수정 없이 통과하는 것이 곧 순수 추출 조건 (c) 의 기계적 증거다.
- [ ] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과. web 번들은 `cd web && pnpm build` 로 확인 (import 경로 변경 반영).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [ ] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `5282` 보다 **215 줄 이상 작아진다** (이동 253 줄 - 새 import 블록 약 20 줄).

## Out of Scope

- `createInFlightIdGate` · `InFlightIdGate` (`2104~2129 행`) 이동 — ServiceIdentity · 역할 변경 경로도 공유하는 범용 게이트라 provider 축과 함께 옮기지 않는다 (PLAN `183 행` 이 명시한 경계).
- provider **조회 · 표시 축** 이동 — `deriveProviders` (`818 행`) · `deriveProviderConfigs` (`836 행`) · `buildProvidersPath` (`903 행`) · `resolveProviderSelectValue` (`395 행`) · `LLM_PROVIDER_OPTIONS` (`377 행`) · `LLM_PROVIDER_PLACEHOLDER_LABEL` (`386 행`) 은 mutation 축이 아니고, 특히 `buildProvidersPath` 는 list drift-guard 와 엮여 있어 본 slice 범위 밖이다.
- 사용자 축 (`CREATE_USER_ERROR_SEPARATOR` `1807 행` ~ `runChangeRole` `2063 행`) · 난이도 매핑 축 이동 — 다음 슬라이스 후보이며 본 slice 범위 밖.
- 러너 본문 로직 개선 (가드 추가 · 에러 문구 변경 · 중복 제거 · 타입 정리) — **순수 추출** 이므로 본문 한 줄도 바꾸지 않는다. 개선 여지가 보이면 Follow-ups 에 적는다.
- 컨테이너 (`handleCreateProvider` / `handleUpdateProvider` / `handleDeleteProvider`) 의 deps 조립부 이동 — AdminView 에 남긴다.
- 기존 계약 spec 4 개의 수정 — 무수정 통과가 본 task 의 성공 조건이다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 LOC · 다음 대상 문구 갱신 — `direct` 대상이라 [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 3 대로 본 task 에 섞지 않고 Follow-ups 로 분리한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예정) `direct` — PLAN `183 행` 부채 bullet 3 차 실측 갱신. **T-1856 (인원 축, `5,569 → 5,282`) 과 본 slice (provider 축) 두 슬라이스를 한 번에 반영** 한다 — 슬라이스마다 doc-sync `direct` task 를 1 건씩 붙이면 [PLAN.md](../PLAN.md) `운영 정책 review backlog` 의 오너 지시 (2026-08-31, 3 일 commit 183 건 중 48 건이 재판정 · doc-sync 성격) 가 지적한 churn 을 그대로 재생산하므로, 2 슬라이스당 1 회로 묶는다. 갱신 내용은 실측 LOC · 선언 수 · 진척 문단의 슬라이스 목록 + 다음 추출 대상 (사용자 축) 좌표 지목.
