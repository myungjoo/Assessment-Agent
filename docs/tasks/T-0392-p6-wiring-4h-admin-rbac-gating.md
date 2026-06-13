---
id: T-0392
title: P6 composition wiring ④h AdminView Admin+ RBAC gating UI(GET /api/auth/me role 파생 → 비-Admin 에게 Admin 패널 숨김/안내)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047, REQ-008]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0391]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④h; ADR-0041 Decision1·3·5; Admin+ RBAC gating — shipped GET /api/auth/me(api.md 71 role 필드) 로 isAdmin 파생→비-Admin 에 Admin 패널 숨김+안내. import 결과 상세·GroupMember mutation·SchedulePanel 은 backend 계약 미shipped 라 defer"
sizeExempt: false
---

# T-0392 — P6 composition wiring ④h AdminView Admin+ RBAC gating UI

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 여덟 번째 fragment 를 잇는다. ④a~④g (T-0385~T-0391) 가 Admin 화면의 5 패널 중 3 패널(GroupMemberList / DifficultyModelSelector / DataImportExportPanel)을 read + mutation + Blob 다운로드 + scope query 까지 배선했으나, **현재 컨테이너는 사용자 등급(role)을 모른 채 Admin+ 전용 endpoint 들을 무조건 호출** 한다. `GET /api/llm/providers`·`/api/llm/difficulty-mappings`·`/api/admin/export`·`/api/admin/import` 는 전부 Admin+ (api.md 114·119·122·123) 라, User 등급이 이 화면에 도달하면 모든 패널이 403 → error props 로 표시된다 (기능적으로는 안전하나 UX 상 "권한 없음" alert 가 패널마다 뜨는 노이즈). 본 slice 는 **사용자 등급을 shipped `GET /api/auth/me` 로 파생해, 비-Admin 사용자에게는 Admin 전용 패널을 아예 숨기고 권한 부족 안내 한 줄을 보여주는 RBAC gating UI** 를 완결한다 — README REQ-046·REQ-047 (Admin 패널 가시성) + REQ-008 (권한 부족 통지) 의 frontend gating 표면을 cover 한다.

본 slice 가 SHIPPED endpoint 를 잇는 이유: `GET /api/auth/me` 는 api.md 71행 기준 **shipped (T-0106 박제, PR-107)** 이며 응답이 명확히 명세돼 있다 — 5 readonly 필드 `{ id, email, role, createdAt, updatedAt }` (User+, JwtAuthGuard 단독, role 은 "SuperAdmin"/"Admin"/"User" enum). 본 slice 는 이 shipped endpoint 1 개를 컨테이너에 추가 호출해 `role` 만 파생하면 되므로 새 endpoint 추가 0 이다. 반면 backlog 의 다른 후보 — import 결과 상세 표시(`POST /api/admin/import` 응답 body 형태가 api.md 123 에 미명세 — 현 ④e 도 "응답 body 형태는 소비하지 않음" 명시), GroupMemberList add/remove mutation(api.md 에 per-member add/remove endpoint 부재 — `DELETE /api/groups/:id` 는 group 전체 link 만 제거, 멤버 단위 link 표현 미확정), SchedulePanel(scheduler endpoint api.md 미존재 — P7 deferred) — 은 전부 backend 계약이 미shipped/미명세라 본 slice 보다 뒤로 미룬다.

전체 Admin 화면(5 패널 + 다중 mutation + 파일 저장 UX + scope UI + RBAC gating + import 결과 상세) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→…→④g 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④h 는 등급 파생 → Admin 패널 gating 한 concern 으로만 국소화** 한다:

- **등급 조회 + isAdmin 파생** (`web/src/views/AdminView.tsx`): 컨테이너가 `GET /api/auth/me` 를 `useApiResource` 로 한 번 추가 호출(④a~④b 의 그룹/LLM 조회 패턴 정합 — read-on-mount thin hook 재사용)하고, 응답 `role` 을 순수 helper `isAdminRole(role)` 로 파생한다(`role === 'Admin' || role === 'SuperAdmin'` → true, 그 외/누락/조회 전 → false = fail-closed). `/api/auth/me` 는 User+ 라 인증만 되면 403 없이 자기 등급을 받는다(AuthGate 가 미인증 이미 차단).
- **Admin 전용 패널 conditional 렌더** (`web/src/views/AdminView.tsx`): `isAdmin` 이 false 면 Admin+ 전용 패널(DifficultyModelSelector / scope `<select>` + DataImportExportPanel — 전부 Admin+ endpoint 의존)을 **렌더하지 않고**, 대신 권한 부족 안내 한 줄(`role="status"` 또는 `<p>`)을 보여준다. 등급 조회 중(loading)에는 fail-closed 로 Admin 패널을 숨기되 별도 진행 표시를 두지 않거나 안내 문구로 둔다(깜빡임 최소 — gating 은 loading 끝난 뒤 안정화). GroupMemberList(GET /api/groups 는 User+) 는 비-Admin 에게도 보일지 결정 — api.md 81 이 User+ 라 조회는 가능하므로 본 slice 는 **그룹 패널은 등급 무관 표시 유지**(User+ 조회 가능)하고, **Admin+ endpoint 에 의존하는 LLM·import/export 패널만 gating** 한다(gating 경계 = 패널이 의존하는 endpoint 의 최소 등급 기준).
- **무조건 호출이던 Admin+ fetch 의 gating-aware 처리는 본 slice 범위 밖**(Out of Scope): 현 컨테이너가 `/api/llm/*`·export 를 무조건 호출하는 것을 isAdmin 일 때만 호출하도록 조건화(fetch 자체 skip)하는 것은 `useApiResource` 시그니처/조건부 호출 패턴 변경을 요구할 수 있어 별도 후속 slice 로 둔다 — 본 slice 는 **렌더 gating(패널 숨김)** 까지만(비-Admin 의 background 403 fetch 는 error 로 흡수되나 패널이 안 보이므로 사용자에게 노출 0). 조건부 fetch 최적화는 Follow-up.

본 slice 는 **zero-new-dep** — `react` hooks + 기존 `useApiResource`/`toErrorMessage` + 기존 패널만 사용한다(ADR-0040 §5 게이트 — axios·react-query·router·차트 라이브러리 등 새 dependency 0). `DataImportExportPanel.tsx`·`DifficultyModelSelector.tsx`·`GroupMemberList.tsx`·`apiClient.ts`·`useApiResource.ts` 는 **수정 0**(패널 props 계약 불변 — gating 은 컨테이너의 conditional 렌더로만; useApiResource 는 ④a~④g 그대로 재사용). 직렬 chain (`dependsOn: [T-0391]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립(다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/파생 상태는 컨테이너 소유, presentational 은 props 만) / Decision 3 (thin fetch hook 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 71행 — `GET /api/auth/me` (User+, JwtAuthGuard 단독, 응답 5 필드 `{ id, email, role, createdAt, updatedAt }` — role enum "SuperAdmin"/"Admin"/"User", hashedPassword 누출 차단). 401(cookie 부재/invalid)/404(token 유효하나 row 부재). **본 slice 의 등급 source** — 인증된 사용자는 403 없이 자기 role 을 받는다(AuthGate 가 미인증 이미 차단).
- `docs/architecture/api.md` 114·119·122·123행 — `GET /api/llm/providers`·`/api/llm/difficulty-mappings`·`/api/admin/export`·`/api/admin/import` 가 전부 **Admin+** 임을 확인(본 slice 가 gating 하는 패널들이 의존하는 endpoint 의 최소 등급 = Admin+). `GET /api/groups`(81행)는 **User+** 라 그룹 패널은 gating 대상 아님(비-Admin 도 조회 가능).
- `web/src/views/AdminView.tsx` — **갱신 대상** (④a~④g 박제 컨테이너). 현재 `useApiResource` 를 그룹/LLM-providers/LLM-mappings 3 회 호출하고 5 state·다수 순수 helper(deriveMembers/deriveProviders/deriveDifficultyMapping/buildMappingsPath/buildExportPath/mergeMapping/parseFilename/triggerDownload/runAssign/runExport/runImport)를 박제했다. 본 slice 는 (1) `GET /api/auth/me` useApiResource 추가 호출(네 번째), (2) 순수 helper `isAdminRole(role)` 추가(role === 'Admin' || 'SuperAdmin' → true, 그 외/누락 → false fail-closed), (3) `isAdmin` 파생(useMemo — me 응답 role → isAdminRole), (4) return JSX 에서 DifficultyModelSelector·scope `<select>`·DataImportExportPanel 을 `isAdmin &&` conditional 로 감싸고 비-Admin 시 권한 부족 안내 한 줄 렌더. **GroupMemberList·그룹 선택 `<select>` 는 등급 무관 유지(User+ 조회 가능). 기존 모든 helper·state·runner·패널 props 합성은 불변** — 본 slice 는 등급 파생 + 렌더 gating 만 추가(기존 회귀 0). `AdminViewProps` 에 테스트용 초기 등급 주입 필드(`initialRole?` 또는 me 응답 mock 주입 — renderToStaticMarkup 정적 검증용, ③a~④g 의 initial* 주입 패턴 정합) 추가 검토.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④a~④g colocated spec). 기존 그룹·LLM·export(scope/Blob)·import test 는 **불변 유지** 하되(Admin 등급 가정 하의 기존 test 는 isAdmin=true 경로로 유지), 본 slice 의 등급 파생 → gating R-112 4 종을 추가. `isAdminRole` 순수 helper 는 직접 검증(jsdom·@testing-library 미사용 — ④a~④g convention). gating 렌더는 renderToStaticMarkup 또는 helper 단언으로 검증(Admin → Admin 패널 노출 / 비-Admin → 숨김 + 안내).
- `web/src/api/useApiResource.ts` — **재사용 (수정 0)**. ④a~④g 의 read-on-mount thin hook 그대로 `GET /api/auth/me` 호출에 재사용. `toErrorMessage` named export 도 재사용.
- `web/src/components/DataImportExportPanel.tsx`·`web/src/components/DifficultyModelSelector.tsx`·`web/src/components/GroupMemberList.tsx` — **재사용 (수정 0)**. gating 은 컨테이너의 conditional 렌더(패널을 마운트하지 않음)로만 — 패널 시그니처/내부 불변(ADR-0041 Decision 1).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — Admin+ RBAC gating UI (기존 그룹·LLM·export·import 회귀 0):
  - [ ] `GET /api/auth/me` 를 `useApiResource` 로 추가 호출(④a~④b read-on-mount 패턴 정합 — 컨테이너 네 번째 fetch). 응답 frontend-local 최소 타입(role 후보 필드만 보수 매핑 — 누락/비정상 응답도 throw 없이 수용).
  - [ ] 순수 helper `isAdminRole(role)` 추가 — `role === 'Admin' || role === 'SuperAdmin'` 면 true, 그 외("User")/undefined/null/빈값/조회 전 면 false(fail-closed — 등급 불명 시 Admin 권한 부여 안 함). `isAdmin` 을 useMemo 로 파생(me 응답 role → isAdminRole).
  - [ ] 비-Admin(`isAdmin === false`)이면 Admin+ 전용 패널(DifficultyModelSelector + scope `<select>` + DataImportExportPanel)을 **conditional 렌더로 숨기고**(마운트 0), 권한 부족 안내 한 줄(`role="status"` 또는 `<p>` — 사람-친화 한국어)을 대신 렌더. Admin(`isAdmin === true`)이면 ④a~④g 그대로 모든 패널 노출.
  - [ ] GroupMemberList + 그룹 선택 `<select>` 는 **등급 무관 유지**(GET /api/groups 가 User+ 라 비-Admin 도 조회 가능 — gating 대상 아님). 등급 조회 중(loading)에는 fail-closed 로 Admin 패널 숨김(안정화 후 노출 — 깜빡임 최소).
- [ ] gating 경계 준수 (ADR-0041 Decision 1) — `DifficultyModelSelector`·`DataImportExportPanel`·`GroupMemberList` 는 등급/gating 을 모른다(props 계약 불변). 등급 조회·isAdmin 파생·패널 숨김 판정은 컨테이너가 소유하고 패널은 기존 props 만 소비(컴포넌트 수정 0 — conditional 렌더는 컨테이너 JSX).
- [ ] 기존 배선(`GroupMemberList` + `DifficultyModelSelector` read/onAssign + `DataImportExportPanel` export(scope/Blob)/import + `runAssign`/`runExport`/`runImport`/`triggerDownload`/`parseFilename`/`buildExportPath`/`buildMappingsPath`/`mergeMapping`/`deriveMembers`/`deriveProviders`/`deriveDifficultyMapping`) **불변** — 본 slice 는 등급 파생 + 렌더 gating 만 추가(기존 회귀 0). busy/error/message 합성·`browserDownloadDeps`·`EXPORT_SCOPE_OPTIONS`·기존 useApiResource 3 호출 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `useApiResource`/`toErrorMessage` + 기존 패널만(router/axios/react-query/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED(§5 new-dep 게이트).
- [ ] `DataImportExportPanel.tsx`·`DifficultyModelSelector.tsx`·`GroupMemberList.tsx`·`apiClient.ts`·`useApiResource.ts` **수정 0** — gating 은 컨테이너 conditional 렌더로만(file-disjoint·controlled 유지, ADR-0041 Decision 1). 패널 수정을 요구하면 BLOCKED/Follow-up.
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 test 불변 유지(Admin 등급 가정 하 기존 test 는 isAdmin=true 경로로) + 등급 파생·gating 의 R-112 4 종:
  - [ ] **happy-path**: `isAdminRole('Admin')`·`isAdminRole('SuperAdmin')` 가 true 반환 1+ AND Admin 등급(me 응답 role='Admin' 또는 'SuperAdmin')일 때 DifficultyModelSelector·scope `<select>`·DataImportExportPanel 이 렌더됨(④a~④g 패널 노출) 1+.
  - [ ] **error path**: `GET /api/auth/me` 조회 실패(에러)·응답 누락 시 isAdmin=false fail-closed → Admin 패널 숨김 + 안내 표시(throw 없이) 1+. role 필드 누락/null 응답도 fail-closed 처리 1+.
  - [ ] **flow/branch**: Admin 등급 → Admin 패널 노출 분기 1+ AND 비-Admin('User') 등급 → Admin 패널 숨김 + 권한 부족 안내 분기 1+ AND 등급 조회 중(loading) → fail-closed(Admin 패널 숨김) 분기 1+.
  - [ ] **negative cases 충분 cover**: `isAdminRole('User')`·`isAdminRole(undefined)`·`isAdminRole('')`·`isAdminRole('admin')`(소문자 — enum 불일치) 가 전부 false 반환(대소문자 엄격 — backend enum 정확 매칭) 1+ / 비-Admin 등급에서도 GroupMemberList + 그룹 `<select>` 는 노출 유지(User+ 조회 — gating 대상 아님) 1+ / Admin 등급 응답 도착 전(loading) Admin 패널 미노출 후 도착 시 노출되는 전이(stale-Admin 노출 없음) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx(갱신) + 기존 apiClient/AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 — web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인.
- [ ] coverage: web vitest 의 본 task 신규 `isAdminRole`·`isAdmin` 파생·gating conditional 분기 line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선(T-0355 Follow-up tracked gap)이고 `@vitest/coverage-v8` 미설치(ADR-0040 §5 zero-new-dep)라 coverage 는 신규 분기별 spec 으로 **구성적 cover** — ③a~④g 와 동일.

## Out of Scope

- **조건부 fetch 최적화(비-Admin 시 Admin+ endpoint 호출 자체 skip)** — 본 slice 는 **렌더 gating(패널 숨김)** 까지만. 현 컨테이너가 `/api/llm/*`·export 를 무조건 호출하는 것을 isAdmin 일 때만 호출하도록 조건화(background 403 fetch 제거)하는 것은 `useApiResource` 의 조건부 호출 패턴 변경(또는 enabled 플래그 도입)을 요구할 수 있어 별도 후속(Follow-up). 비-Admin 의 background 403 은 error 로 흡수되나 패널이 숨겨져 사용자 노출 0 이라 기능 안전.
- **import 결과 상세 표시 / dry-run / 진행률** — `POST /api/admin/import` 응답 body 형태(건수/충돌/검증 리포트)가 api.md 123 에 미명세(현 ④e 도 응답 미소비). 응답 계약 확정 후 후속.
- **GroupMemberList 멤버 추가/제거 mutation**(`onRemove`/`onAdd`) — api.md 에 per-member add/remove endpoint 부재(`DELETE /api/groups/:id` 는 group 전체 link 만 제거, 멤버 단위 link 표현 미확정). 멤버 link 계약(person↔group, 예 `PATCH /api/persons/:id` 의 group 필드 또는 신규 endpoint) 확인 후 별도 slice.
- **SchedulePanel 배선** — scheduler endpoint 가 api.md 에 미존재(P7 scheduler deferred). shipped endpoint 확인 후 후속.
- **ReEvaluationTriggerPanel 배선** — backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 미구현(api.md 94~97 deferred). backend 완결 후 후속.
- **backup / restore 배선** — `POST /api/admin/backup`·`/api/admin/restore`(api.md 124·125) 배선은 본 slice 무관(후속 또는 별도).
- **세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration(전역 등급 컨텍스트)** — 본 slice 는 AdminView 국소 등급 조회만. 전역 auth 컨텍스트(App 레벨 me hydration → 모든 view 가 공유)·세션 만료 redirect 는 후속(이전 task Out of Scope 유지).
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / personId 선택 `GET /api/persons` 배선** — 후속 slice(이전 task Out of Scope 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **공통 RBAC gating hook 추출**(`useRole`/`useIsAdmin` 등) — 본 slice 는 컨테이너 내부 isAdminRole helper + useMemo 유지(④a~④g 정합). 전역 등급 컨텍스트 도입 시 함께 평가.
- **react-router · @tanstack/react-query · axios · file-saver · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **조건부 fetch 최적화**(비-Admin 시 Admin+ endpoint 호출 자체 skip — `useApiResource` enabled 플래그 또는 조건부 path). 그 후 backend 계약 확정 대기 항목 — **import 결과 상세 표시**(`POST /api/admin/import` 응답 body 형태 확정 선행), **GroupMemberList add/remove mutation**(person↔group link endpoint 계약 api.md 확인 선행), **SchedulePanel**(shipped scheduler endpoint 확인 선행), **ReEvaluationTriggerPanel**(backend reeval/delete/run 완결 후), **backup/restore** 배선. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 전역 auth 컨텍스트(App 레벨 `GET /api/auth/me` 부트 hydration → 모든 view 공유 + 세션 만료 → view 전환) / `superadmin-setup` view 컨테이너(`SuperAdminSetupForm`) 조립 / personId 선택 드롭다운 `GET /api/persons` 배선. 등급 gating 이 여러 view 에서 반복되면 공통 `useIsAdmin` hook·전역 RoleContext 추출 평가.)
