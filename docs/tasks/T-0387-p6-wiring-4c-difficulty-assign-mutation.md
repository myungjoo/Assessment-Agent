---
id: T-0387
title: P6 composition wiring ④c AdminView 의 DifficultyModelSelector onAssign 실 PATCH mutation 배선(PATCH /api/llm/difficulty-mappings/:difficulty)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0386]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④c; ADR-0041 Decision1·3·5; DifficultyModelSelector onAssign 실 PATCH(/api/llm/difficulty-mappings/:difficulty {llmProviderConfigId}) mutation 배선 + 성공 시 재조회/낙관 반영 + 실패 안전 표시; 나머지 3패널·RBAC gating·onRemove 는 후속"
sizeExempt: false
---

# T-0387 — P6 composition wiring ④c AdminView 의 DifficultyModelSelector onAssign 실 PATCH mutation 배선

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 세 번째 fragment 를 잇는다. wiring ④a (T-0385 / PR #316) 가 `AdminView` 컨테이너 shell + `GroupMemberList` 첫 패널을, ④b (T-0386 / PR #317 squash cec35b7) 가 `DifficultyModelSelector` 두 번째 패널의 **읽기 배선** (GET `/api/llm/providers` + GET `/api/llm/difficulty-mappings` + 파생 helper + `onAssign` **no-op**) 을 박제했다. ④b 가 명시적으로 ④c 로 미룬 단 하나의 잔여 concern — `DifficultyModelSelector` 의 `onAssign` 슬롯 재지정 **실 mutation** — 을 본 slice 가 완결한다. README REQ-049·REQ-050 (난이도 ↔ provider/model 매핑 설정) 의 frontend write 표면을 cover 한다.

전체 Admin 화면 (5 패널 + 다중 mutation + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→③b-1→③b-2→③b-3→④a→④b 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④c 는 `DifficultyModelSelector.onAssign` 한 mutation concern 으로만 국소화** 한다:

- **실 PATCH 호출 배선** (`web/src/views/AdminView.tsx`): ④b 가 전달하던 no-op `onAssign` 을 실 핸들러로 교체한다. `onAssign(difficulty, providerId)` 호출 시 `apiClient.request` 로 `PATCH /api/llm/difficulty-mappings/:difficulty` (body `{ llmProviderConfigId: providerId }`) 를 호출한다 (api.md 120행 — `AssignDifficultyMappingDto.llmProviderConfigId`, Admin+). `useApiResource` 는 read-only 라 mutation 은 `apiClient.request` 직접 사용 (신규 mutation hook 작성은 cap·범위상 본 slice 에서 만들지 않고 컨테이너 내부 async 핸들러로 처리 — 추출은 Follow-up).
- **성공 시 매핑 갱신**: PATCH 성공 후 `GET /api/llm/difficulty-mappings` 를 재조회해 슬롯 매핑을 최신화한다 (`useApiResource` 의 재조회 트리거 — refetch 함수가 없으면 컨테이너의 `refreshKey` state 를 bump 해 path/option 변경으로 재조회를 유발하는 ③a~④b convention 정합, 또는 mapping 을 컨테이너 local state 로 끌어와 낙관적 반영 후 재조회 정합). 본문에서 ④b 의 `deriveDifficultyMapping` 결과 소비 형태 확인 후 최소 변경 경로 선택.
- **mutation 진행/실패 안전 표시**: PATCH in-flight 동안 `DifficultyModelSelector` 의 `loading` props 를 통해 진행 표시 (또는 컨테이너 local `assigning` state), 실패 (400 미지원 난이도 / 404 config·슬롯 부재 / 403 Admin+ 미만 / 네트워크) 시 `error` props 로 사람-친화 문구를 throw 없이 표면화한다 (apiClient 의 `ApiError` → 문구 파생, ④b·useApiResource 의 `toErrorMessage` 패턴 정합).

본 slice 는 **zero-new-dep** — `react` hooks (`useState`/`useCallback`) + 기존 `apiClient.request`/`useApiResource`/`DifficultyModelSelector` import 만 추가하고, 기박제 presentational 은 **수정 0** 으로 props 배선만 한다 (ADR-0040 §5 게이트 — axios·react-query·차트 라이브러리·jsdom·@testing-library 등 새 dependency 0). 직렬 chain (`dependsOn: [T-0386]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/mutation 트리거는 컨테이너 소유, presentational 은 props 콜백만 노출) / Decision 3 (thin fetch hook 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 120행 — `PATCH /api/llm/difficulty-mappings/:difficulty` (Admin+, body `AssignDifficultyMappingDto.llmProviderConfigId`, service 4xx: 미지원 난이도 400 (`isDifficulty` false) / config 부재·슬롯 부재 P2025 404). 119행 (`GET /api/llm/difficulty-mappings` 재조회 대상) 도 함께 확인.
- `src/llm/dto/assign-difficulty-mapping.dto.ts` — PATCH payload 형태 확인 (단일 필수 필드 `llmProviderConfigId: string`). frontend 배선 body 형태 정합 (frontend 에서 DTO 재정의 금지 — `{ llmProviderConfigId: providerId }` literal 만).
- `web/src/views/AdminView.tsx` — **갱신 대상** (④b 박제 컨테이너). 현재 `useApiResource` 3회 (`/api/groups`·`/api/llm/providers`·`/api/llm/difficulty-mappings`) + `deriveProviders`/`deriveDifficultyMapping` 순수 helper + `DifficultyModelSelector` 에 `onAssign` **no-op** 전달. 본 slice 는 (1) no-op `onAssign` → 실 PATCH async 핸들러 교체, (2) PATCH 성공 시 difficulty-mappings 재조회 트리거, (3) mutation 진행/실패 state 를 `loading`/`error` props 로 배선. **기존 그룹 패널·provider/mapping 읽기 배선·deriveProviders/deriveDifficultyMapping·AdminViewProps·export 는 불변** (mutation 추가만 — 읽기 회귀 0).
- `web/src/components/DifficultyModelSelector.tsx` — **재사용 (수정 0)**. `onAssign: (difficulty: Difficulty, providerId: string) => void` (required), `loading?`/`error?` props 가 이미 박제. 본 slice 는 `onAssign` 에 실 핸들러를 주입할 뿐 컴포넌트 시그니처/내부는 건드리지 않는다. `Difficulty` 타입 named import (재정의 금지).
- `web/src/api/apiClient.ts` — **재사용 (수정 0)**. `request<T>(path, options?: RequestOptions)` 가 mutation primitive (method/body/headers 지정 가능, 401→refresh→retry·`ApiError(status)` 표면화 내장). 본 slice 의 PATCH 는 `request('/api/llm/difficulty-mappings/<difficulty>', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ llmProviderConfigId }) })` 형태로 호출 (정확한 옵션 키는 본문 RequestOptions 확인).
- `web/src/api/useApiResource.ts` — **재사용 (수정 0)**. read-only hook 이라 mutation 후 재조회는 path/option 또는 별도 trigger 로 유발한다 (refetch 함수 노출 여부 본문 확인 — 없으면 컨테이너 `refreshKey` state bump 로 path 변경 유발 또는 mapping local state 낙관 반영). 본 slice 가 hook 시그니처를 바꿔야 하면 cap·범위상 BLOCKED/Follow-up.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④b colocated spec). 기존 그룹·provider·mapping 읽기 test 는 **불변 유지** 하고 onAssign mutation test 를 추가한다. ④a~④b 의 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 고정) 정합. mutation test 는 `apiClient.request` mock 을 method/path 기준으로 PATCH 호출 단언 + 성공/실패 분기 응답 주입으로 검증.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — `DifficultyModelSelector.onAssign` 실 PATCH mutation 배선 (기존 읽기 배선 회귀 0):
  - [ ] `onAssign(difficulty, providerId)` 호출 시 `apiClient.request` 로 `PATCH /api/llm/difficulty-mappings/:difficulty` 를 호출 — path 에 `difficulty` slot 을, body 에 `{ llmProviderConfigId: providerId }` (JSON) 을 싣는다. method `PATCH` + JSON Content-Type 명시. `useApiResource` 는 read-only 라 mutation 은 `apiClient.request` 직접 사용 (신규 fetch hook/mutation hook 작성 금지 — 컨테이너 내부 async 핸들러).
  - [ ] PATCH 성공 시 슬롯 매핑 최신화 — `GET /api/llm/difficulty-mappings` 재조회 트리거 (`useApiResource` refetch 또는 컨테이너 `refreshKey`/local mapping state 중 ④b 박제 형태에 맞는 최소 변경 경로). 재지정한 슬롯이 새 provider 를 반영함이 `DifficultyModelSelector` 의 `mapping` props 로 내려간다.
  - [ ] mutation 진행/실패 안전 표시 — PATCH in-flight 동안 진행 표시 (`loading` props 또는 컨테이너 `assigning` state), 실패 시 `error` props 로 사람-친화 문구 (`ApiError.status` → 문구 파생, ④b·useApiResource `toErrorMessage` 패턴 정합) 를 **throw 없이** 표면화. 미지원 난이도 400 / config·슬롯 부재 404 / Admin+ 미만 403 / 네트워크 0 분기를 모두 안전 처리.
- [ ] loading/error/mutation 트리거 → props·콜백 경계 준수 (ADR-0041 Decision 1) — `DifficultyModelSelector` 는 fetch·PATCH 를 모른다. mutation 호출·진행·실패는 컨테이너가 소유하고 presentational 은 `onAssign` 콜백 + `loading`/`error` props 만 노출. 읽기 loading/error 와 mutation loading/error 의 합성 우선순위는 본문에서 결정·주석 근거 (예: mutation in-flight 우선 표시).
- [ ] 기존 읽기 배선 (`GroupMemberList` 그룹 패널 + `DifficultyModelSelector` provider/mapping 읽기 + `deriveProviders`/`deriveDifficultyMapping`) **불변** — 본 slice 는 mutation 추가만 (읽기 회귀 0). `AdminViewProps`·기존 export 시그니처 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `apiClient`/`useApiResource`/`DifficultyModelSelector` import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `DifficultyModelSelector.tsx`·`apiClient.ts`·`useApiResource.ts` 등 기존 모듈 **수정 0** — controlled props·기존 request primitive 그대로 소비. 배선이 컴포넌트/hook 시그니처 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 읽기 test 불변 유지 + onAssign mutation 에 대한 R-112 4 종 (`apiClient.request` mock 을 method/path 기준 단언·분기 응답 주입):
  - [ ] **happy-path**: `onAssign('medium', '<providerId>')` 호출 시 `apiClient.request` 가 `PATCH /api/llm/difficulty-mappings/medium` + body `{ llmProviderConfigId: '<providerId>' }` 로 정확히 호출됨 1+ AND 성공 후 difficulty-mappings 재조회가 트리거되어 해당 슬롯 매핑이 갱신됨 1+.
  - [ ] **error path**: PATCH 가 실패 (예 404 config·슬롯 부재, 403 Admin+ 미만) 할 때 `DifficultyModelSelector` 가 `error` props 로 사람-친화 문구를 받아 표시하고 throw 없이 처리됨 1+ / 네트워크 실패 (`ApiError(0)`) 시 안전 문구 표시 1+.
  - [ ] **flow/branch**: mutation in-flight 동안 진행 표시 (`loading`/`assigning`) 분기 1+ AND 성공 완료 후 진행 표시 해제 + 매핑 반영 분기 1+ AND 실패 후 진행 표시 해제 + error 표시 분기 1+.
  - [ ] **negative cases 충분 cover**: 미지원 난이도 400 응답 시 안전 문구 표시 (throw 없음) 1+ / 동일 슬롯 연속 재지정 (이전 mutation 미완 중 재호출) 시 이중 호출·state 깨짐 없이 안전 처리 1+ / providerId 가 빈 문자열/undefined 인 비정상 호출 시 PATCH 미발사 또는 안전 처리 (잘못된 body 전송 회피) 1+ / 재조회 자체가 실패할 때 직전 매핑 유지 + error 안전 표시 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx (갱신) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 mutation 핸들러·진행/실패 state·재조회 트리거 로직 line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 핸들러의 분기별 spec 으로 **구성적 cover** 한다 — ③a~④b 와 동일.

## Out of Scope

- **나머지 3 Admin 패널 배선** — `ReEvaluationTriggerPanel` (재평가 trigger, POST `/api/assessment-evaluation/*`) · `DataImportExportPanel` (데이터 import/export, `/api/admin`) · `SchedulePanel` (스케줄 설정) 배선은 **④d/후속 follow-up slice 책임**. 본 slice 는 DifficultyModelSelector 한 패널의 mutation 만.
- **`GroupMemberList` 멤버 추가/제거 mutation** (`onRemove`/`onAdd` 배선) — ④a 가 남긴 mutation 은 후속 slice. 본 slice 는 그룹 패널 회귀 0 (불변).
- **provider CRUD UI** — `POST/PATCH/DELETE /api/llm/providers` (provider 추가/수정/삭제) 배선은 본 slice 무관. 본 slice 는 difficulty-mapping 슬롯 재지정 1 mutation 만.
- **Admin+ RBAC gating UI** — Admin+ 미만 사용자에게 LLM 패널 (또는 Admin 화면 전체) 을 숨기는 gating. 본 slice 는 403 을 error props 로 안전 표시까지만 (④b 정책 유지) 하고 패널 숨김/접근 차단 UI 는 후속 (mutation 패널 일괄 조립 시) 결정.
- **공통 mutation hook 추출** (`useApiMutation` 등) — 본 slice 는 컨테이너 내부 async 핸들러로 처리. 두 번째 mutation 패널 (③/④ 후속) 등장 시 공통 hook 추출을 Follow-up 으로 평가 (지금 추출하면 cap·YAGNI 위배).
- **낙관적 업데이트 / 저장 성공 토스트 / undo** — 본 slice 는 PATCH→재조회 (또는 최소 낙관 반영) + 진행/실패 표시까지. 토스트 알림 UI·undo·재시도 버튼 등 UX 고도화는 후속.
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선** — 후속 slice (이전 task Out of Scope 그대로 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ④d** — 나머지 3 Admin 패널 (`ReEvaluationTriggerPanel` POST 재평가 trigger / `DataImportExportPanel` import·export / `SchedulePanel`) 배선 + `GroupMemberList` 멤버 add/remove mutation + Admin+ RBAC gating UI 일괄 결정. 두 번째 mutation 패널 등장 시 공통 mutation hook (`useApiMutation`) 추출 평가. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너 (`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
