---
id: T-0386
title: P6 composition wiring ④b AdminView 에 DifficultyModelSelector 패널 배선(GET /api/llm/providers + /api/llm/difficulty-mappings 읽기)
phase: P6
status: DONE
prNumber: 317
mergedAs: cec35b7
reviewRounds: 1
completedAt: 2026-06-13T20:04:56Z
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0385]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④b; ADR-0041 Decision1·3·5; AdminView 에 DifficultyModelSelector 두번째 패널 배선(GET /api/llm/providers + /api/llm/difficulty-mappings 읽기 2회 useApiResource); PATCH onAssign mutation·Admin+ RBAC gating 은 ④c"
sizeExempt: false
---

# T-0386 — P6 composition wiring ④b AdminView 에 DifficultyModelSelector 패널 배선(GET /api/llm/providers + /api/llm/difficulty-mappings 읽기)

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 두 번째 fragment 를 잇는다. wiring ④a (T-0385 머지 0a05a7e/PR #316) 가 `AdminView` 컨테이너 shell 을 박제해 `AppShell` 의 `view === 'admin'` 분기는 실 `<AdminView />` 를 렌더하고, 첫 패널 `GroupMemberList` (GET `/api/groups` 읽기) 를 controlled lift-up 으로 배선했다. 그러나 ④a Out of Scope 가 명시한 나머지 4 패널 (`DifficultyModelSelector`·`ReEvaluationTriggerPanel`·`DataImportExportPanel`·`SchedulePanel`) 은 아직 미배선이다. 본 slice 는 그 중 **두 번째 패널 `DifficultyModelSelector` 를 AdminView 에 배선** 해 README REQ-049·REQ-050·REQ-051 (LLM provider · 난이도 매핑 설정) 의 frontend 표면을 cover 한다.

전체 Admin 화면 (5 패널 + mutation + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. 따라서 ③a→③b-1→③b-2→③b-3→④a split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널 단위 직렬 추가) 을 그대로 따라 본 **④b 는 `DifficultyModelSelector` 한 패널의 읽기 배선까지로 국소화** 한다:

- **두 읽기 조회 추가** (`web/src/views/AdminView.tsx`): `useApiResource` 를 추가로 **두 번** 호출해 (1) `GET /api/llm/providers` 의 provider 목록 (api.md 114행 — sanitize view 6 필드 `id`/`provider`/`endpointUrl`/`modelId`/`createdAt`/`updatedAt`, apiKey 누출 차단, Admin+) 과 (2) `GET /api/llm/difficulty-mappings` 의 3 난이도 슬롯 매핑 배열 (api.md 119행 — `findAllMappings`, 빈 배열 정상, Admin+) 을 받는다. ④a 가 박제한 `useApiResource` 재사용 (신규 fetch hook 작성 금지).
- **client-side 파생 → props 배선**: provider 응답 row 를 `DifficultyModelSelector` 의 `ProviderOption[]` (`{ id, provider, modelId }`) 로 매핑하는 순수 helper + difficulty-mappings 응답을 `Record<Difficulty, string | null>` (`mapping` props) 로 매핑하는 순수 helper 를 추가한다. presentational `DifficultyModelSelector` 는 props 로만 소비 (**컴포넌트 수정 0**, ADR-0041 Decision 1).
- **`onAssign` 은 본 slice no-op 또는 미배선** — 슬롯 재지정 PATCH (`PATCH /api/llm/difficulty-mappings/:difficulty`) mutation 은 **④c Out of Scope**. `DifficultyModelSelector` 의 `onAssign` props 는 required 이므로 (본문에서 컴포넌트 props 형태 확인 후) **빈 콜백 (no-op) 을 전달하거나 변경 사항을 컨테이너 상태에만 임시 반영** 하되 실 PATCH 호출은 하지 않는다 (주석으로 "mutation 은 ④c" 명시). 컴포넌트 수정 0 유지.

본 slice 는 **zero-new-dep** — `react` hooks (`useMemo`) + 기존 `useApiResource`/`DifficultyModelSelector` import 만 추가하고, 기박제 presentational 은 **수정 0** 으로 props 배선만 한다. axios·react-query·차트 라이브러리·jsdom·@testing-library 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0385]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

**RBAC 측면 (중요)**: `GET /api/llm/providers`·`GET /api/llm/difficulty-mappings` 는 api.md 114·119행 기준 **Admin+** 전용이라 (④a 의 `GET /api/groups` User+ 와 다름) User 등급 사용자는 403 을 받는다. 본 slice 는 그 403 (또는 일반 error) 을 `DifficultyModelSelector` 의 `error` props 로 안전 표시 (throw 없음) 하는 것까지만 책임지고, **Admin+ 미만 사용자에게 패널 자체를 숨기는 RBAC gating UI 는 ④c/후속 Out of Scope** (mutation 패널 조립 시 일괄 결정). 본 slice 는 읽기 배선 + error 안전 표시만.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error 는 컨테이너 소유, presentational 은 props 소비) / Decision 3 (thin fetch hook `useApiResource` 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 114·119행 — `GET /api/llm/providers` (Admin+, sanitize view 6 필드 `id`/`provider`/`endpointUrl`/`modelId`/`createdAt`/`updatedAt`, apiKey 누출 차단, 빈 배열 정상) / `GET /api/llm/difficulty-mappings` (Admin+, 3 난이도 슬롯 매핑 배열, 빈 배열 seed 전 정상). 두 endpoint 모두 Admin+ 라 User 등급은 403 — 본 slice 는 error props 안전 표시까지 (RBAC gating UI 는 Out of Scope)
- `web/src/views/AdminView.tsx` — **갱신 대상** (④a 박제 컨테이너, ~177 LOC). 현재 `useApiResource<GroupRow[]>('/api/groups')` 한 번 + `findGroup`/`deriveMembers` 순수 helper + `<select>` 그룹 선택 + `GroupMemberList` 첫 패널 배선. 본 slice 는 (1) `useApiResource` 두 번 추가 호출 (`/api/llm/providers`·`/api/llm/difficulty-mappings`), (2) provider/mapping 파생 순수 helper 추가, (3) `DifficultyModelSelector` 두 번째 패널을 `<section>` 안에 추가 배선. **기존 그룹 패널 배선·findGroup/deriveMembers·AdminViewProps·export 는 불변** (추가만 — 기존 코드 회귀 0)
- `web/src/components/DifficultyModelSelector.tsx` — **재사용 (수정 0)**. props: `providers: ProviderOption[]` (`{ id, provider, modelId }`), `mapping: Record<Difficulty, string | null>` (`Difficulty = 'easy' | 'medium' | 'hard'`), `onAssign: (difficulty, providerId) => void` (**required**), `loading?: boolean`, `error?: string`. loading 우선 → 빈 provider 목록 → error alert → 슬롯 `<select>` 분기가 이미 박제. `ProviderOption`·`Difficulty`·`DifficultyModelSelectorProps` 타입을 named import 해 배선 props 타입으로 쓴다 (frontend-local 재정의 금지). `onAssign` 은 required 라 본 slice 는 no-op 콜백 전달 (실 PATCH 는 ④c — 본문 결정·주석 근거)
- `web/src/api/useApiResource.ts` — **재사용 (수정 0)**. `useApiResource<T>(path: string | null, options?)` 가 `{ data, loading, error }` 반환. 본 slice 는 LLM provider 목록·difficulty-mappings 조회에 추가로 두 번 사용 (④a 의 그룹 조회 한 번 + 본 slice 두 번 = 총 세 번)
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④a colocated spec). 기존 그룹 패널 test 는 **불변 유지** 하고, DifficultyModelSelector 배선 + 신규 파생 helper test 를 추가한다. ④a~③b-3 의 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 확장자 고정) 을 그대로 따른다 — `useApiResource` 가 이제 세 번 호출되므로 mock 이 path 별로 다른 응답을 반환하도록 조정 (path 인자 기준 분기 mock)

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — `DifficultyModelSelector` 두 번째 패널 배선 (기존 그룹 패널 회귀 0):
  - [ ] `useApiResource` 를 추가로 **두 번** 호출 — (1) `GET /api/llm/providers` provider 목록, (2) `GET /api/llm/difficulty-mappings` 난이도 슬롯 매핑 배열 (④a thin fetch hook 재사용, 신규 fetch hook 작성 금지). 각 응답 row 의 frontend-local 최소 타입 (예 `LlmProviderRow { id?, provider?, modelId? }`, `DifficultyMappingRow { difficulty?, llmProviderConfigId? }`) 을 보수적으로 정의해 누락/비정상 row 도 throw 없이 받는다 (③a~④a frontend-local 최소 타입 convention 정합).
  - [ ] provider 응답 → `ProviderOption[]` (`{ id, provider, modelId }`) 파생 순수 helper (예 `deriveProviders(rows)`) 추가 — id/provider/modelId 누락 row 는 보수적 fallback (id 누락 row 는 index 기반 합성 key 또는 skip). `DifficultyModelSelector` 의 `providers` props 로 내려보낸다 — **컴포넌트 수정 0**.
  - [ ] difficulty-mappings 응답 → `Record<Difficulty, string | null>` (`mapping` props) 파생 순수 helper (예 `deriveDifficultyMapping(rows)`) 추가 — 세 슬롯 (easy/medium/hard) 을 키로 하고, 응답에 슬롯이 없으면 `null` 로 기본화한다 (빈 배열 seed 전 안전 처리). `DifficultyModelSelector` 의 `mapping` props 로 내려보낸다.
  - [ ] `DifficultyModelSelector` 에 `providers`/`mapping`/`loading` (= LLM 조회 loading)/`error` (= LLM 조회 error) props 배선 + `onAssign` no-op 콜백 전달 (실 PATCH mutation 은 ④c Out of Scope — 주석으로 "mutation 은 ④c" 명시). `ProviderOption`·`Difficulty`·`DifficultyModelSelectorProps` 타입 named import (재정의 금지).
- [ ] loading/error → props 경계 준수 (ADR-0041 Decision 1) — `DifficultyModelSelector` 는 fetch 를 모른다. LLM 조회 두 건의 loading/error 를 컨테이너가 받아 props 로 내려보낸다 (loading 은 두 조회 중 하나라도 진행 중이면 true 합성 — 본문 결정·주석 근거 / error 는 두 조회 error 중 우선순위 결정 — 본문 결정·주석 근거). Admin+ 미만 사용자의 403 응답도 error props 로 안전 표시 (throw 없음).
- [ ] 기존 그룹 패널 (`GroupMemberList` + `findGroup`/`deriveMembers` + `<select>` 그룹 선택) **불변** — 본 slice 는 추가만 (회귀 0). `AdminViewProps`·기존 export 시그니처 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `useApiResource`/`DifficultyModelSelector` import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `DifficultyModelSelector.tsx` 등 presentational **수정 0** — controlled props 그대로 소비. 배선이 컴포넌트 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 그룹 패널 test 불변 유지 + `useApiResource` 가 세 번 호출되도록 mock 을 path 별 분기로 조정. DifficultyModelSelector 배선 + 신규 파생 helper (`deriveProviders`/`deriveDifficultyMapping`) 에 대한 R-112 4 종:
  - [ ] **happy-path**: provider 목록 + difficulty-mappings 조회 성공 시 `DifficultyModelSelector` 가 세 난이도 슬롯 `<select>` 와 provider 옵션을 노출함 1+ AND 매핑된 슬롯이 현재 할당 provider 를 반영함 1+.
  - [ ] **error path**: LLM 조회 loading 중 `DifficultyModelSelector` 가 loading 표시 (props 로 loading 전달) 1+ / LLM 조회 error (예 Admin+ 미만 403) 시 `DifficultyModelSelector` 가 error alert (또는 loading 우선 정책에 따른 표시) 를 props 로 받아 표시 1+.
  - [ ] **flow/branch**: provider 빈 목록 (provider 0 건) 분기에서 `DifficultyModelSelector` 가 빈 상태 (`EMPTY_PROVIDERS_TEXT`) 렌더 1+ AND provider 가 1+ 일 때 슬롯 `<select>` 렌더 분기 1+.
  - [ ] **negative cases 충분 cover**: provider row 의 id·provider·modelId 누락 시 보수적 fallback (throw/undefined 렌더 없음) 각 1+ / difficulty-mappings 응답이 빈 배열 (seed 전) 일 때 세 슬롯 모두 `null` 안전 처리 1+ / difficulty-mappings 응답에 미지의 난이도 키가 있을 때 무시하고 throw 없음 1+ / `llmProviderConfigId` 가 provider 목록에 없는 stale 매핑일 때 안전 표시 (placeholder fallback, throw 없음) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx (갱신) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파생 helper (`deriveProviders`/`deriveDifficultyMapping`/LLM 조회 loading·error 합성 로직) line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 helper 의 분기별 spec 으로 **구성적 cover** 한다 — ③a~④a 와 동일.

## Out of Scope

- **난이도 슬롯 재지정 PATCH mutation** — `DifficultyModelSelector` 의 `onAssign` 실 배선 (`PATCH /api/llm/difficulty-mappings/:difficulty`) · 낙관적 업데이트 · 저장 성공/실패 토스트 — **④c Out of Scope**. 본 slice 는 `onAssign` no-op + 읽기 표시까지.
- **나머지 3 Admin 패널 배선** — `ReEvaluationTriggerPanel` (재평가 trigger, POST `/api/assessment-evaluation/*`) · `DataImportExportPanel` (데이터 import/export, `/api/admin`) · `SchedulePanel` (스케줄 설정) 배선은 **④c/후속 follow-up slice 책임**.
- **멤버 추가/제거 mutation** — `GroupMemberList` 의 `onRemove` 배선 등 ④a 가 남긴 mutation 은 ④c Out of Scope. 본 slice 는 그룹 패널 회귀 0 (추가만).
- **Admin+ RBAC gating UI** — Admin+ 미만 사용자에게 LLM 패널 (또는 Admin 화면 전체) 을 숨기는 gating. `/api/llm/*` 는 Admin+ 라 User 등급은 403 을 받는데, 본 slice 는 그 403 을 error props 로 안전 표시까지만 하고 패널 숨김/접근 차단 UI 는 ④c/후속 (mutation 패널 일괄 조립 시) 결정.
- **provider CRUD UI** — `POST/PATCH/DELETE /api/llm/providers` (provider 추가/수정/삭제) 배선은 본 slice 와 무관 (후속 또는 별도). 본 slice 는 provider 목록 **읽기** 만.
- **`view === 'superadmin-setup'` 분기 컨테이너 조립** (`SuperAdminSetupForm` 배선) — 후속 slice. placeholder 유지.
- **세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선** — 후속 slice (이전 task Out of Scope 그대로 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ④c** — `DifficultyModelSelector` 의 `onAssign` 실 PATCH mutation 배선 (`PATCH /api/llm/difficulty-mappings/:difficulty`) + 멤버 추가/제거 mutation (`onRemove`) + Admin+ RBAC gating UI 일괄 결정 + `ReEvaluationTriggerPanel`/`DataImportExportPanel`/`SchedulePanel` 배선. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너 (`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
