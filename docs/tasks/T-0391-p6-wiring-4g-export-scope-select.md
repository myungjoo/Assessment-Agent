---
id: T-0391
title: P6 composition wiring ④g AdminView export scope 선택 UI(컨테이너 <select> → GET /api/admin/export?scope= query 부착)
phase: P6
status: DONE
mergedAs: 797197e
prNumber: 322
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0390]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④g; ADR-0041 Decision1·3·5; export scope 선택 UI — ④f 가 미부착한 scope query 를 컨테이너 <select> 로 골라 GET /api/admin/export?scope= 에 부착. DataImportExportPanel/apiClient 수정 0. import 결과 상세·GroupMember mutation·RBAC·⑤ polling 은 후속"
sizeExempt: false
---

# T-0391 — P6 composition wiring ④g AdminView export scope 선택 UI

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 일곱 번째 fragment 를 잇는다. ④f (T-0390 / PR #321 7462acd) 가 `GET /api/admin/export` 응답을 Blob → 가상 `<a download>` 으로 실제 파일 저장하는 UX 까지 완결했으나, **scope query 는 미부착** 한 채 전체 scope (backend 기본 위임) 로만 export 했다 (`AdminView.tsx` 47~52행 상수 주석: "scope 선택 UI(드롭다운/필터) 가 도입되는 후속 slice 전까지는 query 없이 전체 scope 로 export"). 본 slice 는 ④f 가 명시적으로 후속으로 미룬 **export scope 선택 UI** 를 완결한다 — 사용자가 export 범위 (scope) 를 고르면 그 값을 `GET /api/admin/export?scope=<선택값>` 의 query 로 부착한다. README REQ-030·REQ-032 (평가 자료 export, raw 미포함) 의 frontend export 범위 선택 표면을 cover 한다.

본 slice 가 SHIPPED endpoint 를 잇는 이유: `GET /api/admin/export` 는 api.md 122행 기준 shipped 이며 **`scope` query 가 그 계약에 이미 명시** 돼 있다 (`평가 자료 export (raw 미포함, REQ-032·REQ-030) — `scope` query`, Admin+). ④f 가 이미 호출 경로·Blob 다운로드를 박제했으므로 본 slice 는 새 endpoint 추가 0 — 이미 호출 중인 shipped endpoint 의 **선택적 query 1 개를 부착** 하는 것뿐이다 (호출 경로 변화 0, scope 미선택 시 ④f 와 동일하게 query 없는 전체 scope).

전체 Admin 화면 (5 패널 + 다중 mutation + 파일 저장 UX + scope UI + import 결과 상세 + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→…→④f 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④g 는 export scope 선택 → query 부착 한 concern 으로만 국소화** 한다:

- **scope 선택 상태 + `<select>` 컨트롤** (`web/src/views/AdminView.tsx`): 컨테이너가 `selectedScope` state (`useState`) 를 소유하고, `DataImportExportPanel` 위/옆에 scope 선택 `<select>` 를 컨테이너가 직접 렌더한다 (그룹 선택 `<select>` 와 동형 — presentational 패널은 scope 를 모른다, ADR-0041 Decision 1). scope 후보값은 frontend-local 상수 목록으로 둔다 (api.md 122 가 scope 의 enum 값을 명시하지 않으므로 보수적 기본 목록 — 예 "전체" + 의미 있는 보편 후보; 빈 선택 = scope 미부착 = 전체).
- **export path 빌더 순수 helper** (`buildExportPath(scope)`): scope 가 truthy 면 `${ADMIN_EXPORT_PATH}?scope=${encodeURIComponent(scope)}` 를, falsy/빈값이면 query 없는 `ADMIN_EXPORT_PATH` 를 반환한다 (`buildMappingsPath` 의 순수 path-빌더 convention 정합 — query 부착/미부착 분기를 순수 함수로 분리해 jsdom 없이 직접 검증). `runExport` 가 `ADMIN_EXPORT_PATH` 상수 대신 이 helper 결과를 `getRaw` 에 넘기도록 확장한다 (현재 `runExport` 는 `deps.getRaw(ADMIN_EXPORT_PATH)` 를 호출 — 본 slice 는 export path 를 인자/deps 로 주입해 scope 를 반영).
- **진행/실패 안전 표시·Blob 다운로드 보존**: ④f 의 in-flight `busy`(exporting)·실패 안전 표시(403/404/비-2xx/네트워크 0)·`response.blob()` → `triggerDownload` 파일 저장·`Content-Disposition` filename 결정은 **불변**. 본 slice 는 export 가 호출하는 **path 에 scope query 만 추가** 한다 (다운로드 동작·error 처리 회귀 0).

본 slice 는 **zero-new-dep** — `react` hooks + 기존 `apiClient.requestRaw`/`DataImportExportPanel`/`toErrorMessage` + 브라우저 표준만 사용한다 (ADR-0040 §5 게이트 — axios·react-query·file-saver·차트 라이브러리 등 새 dependency 0). `DataImportExportPanel.tsx`·`apiClient.ts`·`useApiResource.ts` 는 **수정 0** (패널 props 계약 불변 — scope 는 컨테이너 `<select>` 가 소유; apiClient 는 ④f 의 `requestRaw` 그대로 재사용 — path 만 컨테이너가 바꿈). 직렬 chain (`dependsOn: [T-0390]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/선택 상태는 컨테이너 소유, presentational 은 props 콜백만) / Decision 3 (thin fetch hook/layer 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch/Blob/URL 만, router/axios/react-query/file-saver/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 122행 — `GET /api/admin/export` (Admin+, 평가 자료 export raw 미포함 REQ-032·REQ-030, **`scope` query**). api.md 는 scope 의 enum 값/기본값을 명시하지 않음 — 따라서 본 slice 는 보수적 frontend-local 후보 목록을 두고, 빈 선택(전체) 시 query 미부착(④f 동작 유지). Admin+ 라 User 등급은 403 — error props 안전 표시(④f 정책 유지). 123~125행(import·backup·restore) 은 본 slice 무관.
- `web/src/views/AdminView.tsx` — **갱신 대상** (④f 박제 컨테이너). 현재 `ADMIN_EXPORT_PATH` 상수 + `runExport` 가 `deps.getRaw(ADMIN_EXPORT_PATH)` 로 query 없이 호출하고, 47~52행 주석이 "scope 미부착 — 후속 slice" 라 명시한다. 본 slice 는 (1) `selectedScope` state + scope 선택 `<select>` 렌더(그룹 `<select>`·`handleSelectChange` 동형), (2) 순수 helper `buildExportPath(scope)` 추가(scope truthy → `?scope=` query, 빈값 → 상수 그대로 — `buildMappingsPath` 패턴 정합), (3) `runExport` 가 고정 상수 대신 주입된 export path 를 `getRaw` 에 넘기도록 확장(`ExportDeps` 에 path 추가 또는 `runExport(path, deps)` 인자화 중 회귀 적은 쪽), (4) `handleExport` 가 `buildExportPath(selectedScope)` 결과를 주입하도록 갱신. **`runImport`/`runAssign`/`triggerDownload`/`parseFilename`/`deriveMembers`/`deriveProviders`/`deriveDifficultyMapping`/`buildMappingsPath`/`mergeMapping`·import/group/LLM 패널 배선·`browserDownloadDeps`·Blob 다운로드 본체·busy/error/message 합성은 불변** (export 가 호출하는 path 에 scope query 만 부착 — 기존 회귀 0). exporting 가드·진행 on/off·error/message 비움도 유지.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④f colocated spec). 기존 그룹·LLM·export(Blob 다운로드)·import test 는 **불변 유지** 하되(④f 의 export 성공 test 가 호출 path 를 단언했다면 scope 미선택 시 query 없는 경로로 갱신), 본 slice 의 scope 선택 → query 부착 R-112 4 종을 추가한다. `buildExportPath` 순수 helper·`runExport` 의 path 주입은 mock 으로 직접 검증(jsdom·@testing-library 미사용 — ④c~④f 의 *Deps/순수 helper 직접 검증 convention). `getRaw` mock 의 호출 인자(path) 로 scope query 부착을 단언.
- `web/src/components/DataImportExportPanel.tsx` — **재사용 (수정 0)**. props `onExport?: () => void`(인자 없음)·`busy?`/`error?`/`message?` 그대로 소비 — 패널은 scope 를 모른다(ADR-0041 Decision 1 — scope 선택 `<select>` 는 컨테이너가 직접 렌더). 컴포넌트 시그니처/내부 불변.
- `web/src/api/apiClient.ts` — **재사용 (수정 0)**. ④f 가 추가한 `requestRaw(path, options?)` 그대로 재사용 — 본 slice 는 컨테이너가 넘기는 path 문자열에 scope query 만 추가할 뿐 fetch 계약은 불변.
- `web/src/api/useApiResource.ts` — `toErrorMessage` named export 만 재사용 (수정 0). export 클릭 발화는 ④c~④f 정합으로 `apiClient.requestRaw` 직접 호출 — `useApiResource` 는 read-on-mount hook 이라 미사용.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — export scope 선택 UI + scope query 부착 (기존 Blob 다운로드·import·LLM·group 회귀 0):
  - [ ] `selectedScope` state(`useState`) 추가 + scope 선택 `<select>` 를 컨테이너가 직접 렌더(그룹 선택 `<select>`·`handleSelectChange` 동형 — `aria-label` 부여). scope 후보값은 frontend-local 상수 목록(빈 선택 = 전체 = query 미부착). `DataImportExportPanel` 은 scope 를 모름(props 계약 불변, Decision 1).
  - [ ] 순수 helper `buildExportPath(scope)` 추가 — scope truthy 면 `${ADMIN_EXPORT_PATH}?scope=${encodeURIComponent(scope)}`, 빈/falsy 면 `ADMIN_EXPORT_PATH` 그대로 반환(`buildMappingsPath` 순수 path-빌더 convention 정합). scope 값 인코딩으로 비정상 문자(공백/특수문자) 안전.
  - [ ] `runExport` 가 고정 `ADMIN_EXPORT_PATH` 대신 주입된 export path 를 `getRaw` 에 넘기도록 확장(`ExportDeps` 에 path 추가 또는 `runExport(path, deps)` 인자화 중 회귀 적은 쪽 — 결정 근거 주석). `handleExport` 는 `buildExportPath(selectedScope)` 결과를 주입.
  - [ ] ④f 동작 보존 — `response.blob()` → `Content-Disposition` filename(없으면 기본명) → `triggerDownload` 파일 저장, in-flight `busy`(exporting), 실패(403 Admin+ 미만/404/비-2xx/네트워크 0) error props 안전 표시(throw 없이), 성공 message, exporting 동시 재호출 가드, 시작 시 error/message 비움 전부 불변.
- [ ] scope 선택 → 콜백/props 경계 준수 (ADR-0041 Decision 1) — `DataImportExportPanel` 은 scope/fetch/Blob/다운로드를 모른다. scope 선택 상태·query 부착·raw 호출·Blob 변환·파일 저장은 컨테이너가 소유하고 패널은 `onExport`(인자 없음) 콜백 + `busy`/`error`/`message` props 만 소비.
- [ ] 기존 배선(`GroupMemberList` + `DifficultyModelSelector` read/onAssign + `DataImportExportPanel` import + Blob 다운로드 + `runAssign`/`runImport`/`triggerDownload`/`parseFilename`/`deriveProviders`/`deriveDifficultyMapping`/`mergeMapping`/`buildMappingsPath`/`deriveMembers`) **불변** — 본 slice 는 export path 에 scope query 부착만 추가(기존 회귀 0). `AdminViewProps`·import 측 시그니처·busy/error/message 합성·`browserDownloadDeps` 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `apiClient.requestRaw`/`DataImportExportPanel`/`toErrorMessage` + 브라우저 표준만(router/axios/react-query/file-saver/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED(§5 new-dep 게이트).
- [ ] `DataImportExportPanel.tsx`·`apiClient.ts`·`useApiResource.ts` **수정 0** — 패널 controlled props·`requestRaw`·`toErrorMessage` 그대로 소비. scope 선택이 컴포넌트/hook/apiClient 시그니처 수정을 요구하면 BLOCKED/Follow-up(file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 test 불변 유지(④f export 성공 test 는 scope 미선택 시 query 없는 경로로 갱신) + scope 선택·query 부착의 R-112 4 종:
  - [ ] **happy-path**: scope 선택값이 truthy 일 때 export 트리거 시 `getRaw` 가 `GET /api/admin/export?scope=<선택값>` path 로 호출됨 1+ AND 성공 응답의 blob 으로 `createObjectURL`+anchor download+`revokeObjectURL`(④f 동작) 이 그대로 호출됨 1+. `buildExportPath('<값>')` 가 인코딩된 query 부착 path 를 반환 1+.
  - [ ] **error path**: scope 부착 export 실패(403/404/비-2xx) 시 `DataImportExportPanel` 이 `error` props 로 사람-친화 문구를 받아 표시하고 throw 없이 처리 + 다운로드 부수효과 미호출 1+ / 네트워크 실패(`ApiError(0)`) 시 안전 문구 표시 1+.
  - [ ] **flow/branch**: scope **미선택(빈값)** 시 `buildExportPath('')` 가 query 없는 `ADMIN_EXPORT_PATH` 그대로 반환(④f 동작 유지) 분기 1+ AND scope **선택** 시 `?scope=` query 부착 분기 1+ AND in-flight 진행 표시(busy/exporting) 분기 1+ AND 성공 후 진행 해제+message+다운로드 트리거 분기 1+.
  - [ ] **negative cases 충분 cover**: scope 값에 공백/특수문자 포함 시 `encodeURIComponent` 로 안전 인코딩(query 깨짐 없음) 1+ / scope 변경 후 export 시 변경된 scope 가 반영된 path 로 호출(stale scope 미사용) 1+ / export in-flight 중 scope 변경·재트리거 시 이중 호출·중복 다운로드 없이 안전 처리(exporting 가드) 1+ / 실패 후 scope 그대로 재시도 시 직전 error 비우고 정상 재발화+다운로드 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx(갱신) + 기존 apiClient/AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 — web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인.
- [ ] coverage: web vitest 의 본 task 신규 `buildExportPath`·확장 `runExport`(path 주입)·scope `<select>`/`selectedScope` 분기 line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선(T-0355 Follow-up tracked gap)이고 `@vitest/coverage-v8` 미설치(ADR-0040 §5 zero-new-dep)라 coverage 는 신규 분기별 spec 으로 **구성적 cover** — ③a~④f 와 동일.

## Out of Scope

- **export 형식 협상 / 다중 형식(CSV·xlsx) 선택 UI** — Accept 헤더 협상이나 사용자가 export 형식을 고르는 UI 는 후속(④f Out of Scope 유지). 본 slice 는 scope(범위) 선택만 — 형식은 backend 가 Content-Type 으로 결정(④f 그대로).
- **scope enum 값의 backend 계약 정합 / 동적 scope 목록 fetch** — api.md 122 가 scope enum 을 명시하지 않으므로 본 slice 는 frontend-local 보수 후보 목록을 둔다. backend 가 지원하는 scope 값을 endpoint 로 받아오거나(예 `GET /api/admin/export/scopes`) 확정 enum 으로 정합화하는 것은 후속(backend 계약 확인 후 — 현 src/ export controller 미확인이라 ④f 와 동일하게 계약 기준 선배선).
- **import 결과 상세 표시 / dry-run / 진행률** — import 응답의 건수/충돌/검증 리포트 상세 패널·dry-run·업로드 진행률은 후속(④e Out of Scope 유지). 본 slice 는 export scope 측만.
- **backup / restore 배선** — `POST /api/admin/backup`·`/api/admin/restore`(api.md 124·125) 배선은 본 slice 무관(후속 또는 별도).
- **나머지 2 Admin 패널 배선** — `ReEvaluationTriggerPanel`(backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 미구현 deferred, api.md 94~97, backend 완결 후 후속)·`SchedulePanel`(스케줄 — shipped scheduler endpoint 미확인) 배선은 후속.
- **`GroupMemberList` 멤버 추가/제거 mutation**(`onRemove`/`onAdd`) — 멤버 제거 endpoint 계약(person↔group link 표현)이 api.md 에서 미확정이라 별도 slice 에서 contract 확인 후 배선. 본 slice 무관(그룹 패널 회귀 0).
- **`apiClient.request` 의 query 빌더 통합** — 본 slice 는 컨테이너 순수 helper `buildExportPath` 로 scope query 만 부착(YAGNI — 범용 query 빌더 추상화는 cap·범위 위배라 후속 평가). `buildMappingsPath` 와 동형의 국소 helper 로 충분.
- **Admin+ RBAC gating UI** — Admin+ 미만에게 패널/화면을 숨기는 gating 은 후속(본 slice 는 403 을 error props 로 안전 표시까지, ④b~④f 정책 유지).
- **공통 mutation hook 추출**(`useApiMutation` 등) — 본 slice 는 컨테이너 내부 async 러너 유지(④c~④f 정합). runAssign/runExport/runImport 패턴 확인 후 후속 평가.
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 `GET /api/persons` 배선** — 후속 slice(이전 task Out of Scope 유지).
- **react-router · @tanstack/react-query · axios · file-saver · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **import 결과 상세 표시**(import 응답 건수/충돌/검증 리포트 표면화 — 응답 형태 확인 선행). 그 후 `GroupMemberList` 멤버 add/remove mutation(person↔group link endpoint 계약 api.md 확인 선행) + `SchedulePanel` 배선(shipped scheduler endpoint 확인 선행) + `ReEvaluationTriggerPanel` 배선(backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 완결 후) + Admin+ RBAC gating UI 일괄 결정. runAssign/runExport/runImport 세 async 러너 + buildMappingsPath/buildExportPath 두 path 빌더 등장 → 공통 mutation hook(`useApiMutation`)·query 빌더 추출 평가. scope enum 의 backend 계약 정합(동적 scope 목록 fetch 또는 확정 enum) — backend export controller 계약 확인 후. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너(`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
