---
id: T-0390
title: P6 composition wiring ④f AdminView export 실 파일 저장 UX(GET /api/admin/export 응답 Blob → 다운로드 트리거)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0389]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx, web/src/api/apiClient.ts, web/src/api/apiClient.test.ts]
plannerNote: "P6 wiring④f; ADR-0041 Decision1·3·5; export 실 파일 저장 UX(④d 가 호출만 하던 GET /api/admin/export 응답을 Blob→URL.createObjectURL→가상 <a download> 클릭으로 실제 파일 저장). apiClient 에 raw Response 반환 helper(requestRaw) 최소 추가(body 소비 안 함=Blob 필요)+runExport 가 그것으로 다운로드. scope UI·import 결과 상세·나머지 패널·RBAC gating 은 후속"
sizeExempt: false
---

# T-0390 — P6 composition wiring ④f AdminView export 실 파일 저장 UX

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 여섯 번째 fragment 를 잇는다. ④d (T-0388 / PR #319 b3efa92) 가 `DataImportExportPanel.onExport` 를 `GET /api/admin/export` 호출까지 배선했으나, 응답 본문을 **소비하지 않고 성공 사실만 message 로 표면화** 했다 (④d Out of Scope: "실 파일 저장 / 다운로드 UX 는 후속"). ④e (T-0389 / PR #320 ff98a5a) 가 import 배선을 완결했다. 본 slice 는 ④d/④e 가 명시적으로 후속으로 미룬 **export 응답을 실제 파일로 저장하는 다운로드 UX** 를 완결한다. README REQ-030·REQ-032 (평가 자료 export, raw 미포함) 의 frontend export 산출물 표면을 cover 한다.

본 slice 가 SHIPPED endpoint 를 잇는 이유: `GET /api/admin/export` (Admin+, raw 미포함) 는 **api.md 122행 기준 shipped** 이고 이미 ④d 가 호출 경로를 박제했다 (`/api/assessments` batch 4 건이나 `ReEvaluationTriggerPanel` 의 deferred endpoint 와 달리 미구현 annotation 없음). 본 slice 는 새 endpoint 를 추가하지 않고 **이미 호출 중인 shipped endpoint 의 응답을 소비** 하는 것뿐이다 (호출 contract 변화 0 — body 소비만 추가).

전체 Admin 화면 (5 패널 + 다중 mutation + 실 파일 저장 UX + scope UI + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→…→④a~④e 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④f 는 export 응답 → 파일 저장 한 concern 으로만 국소화** 한다:

- **raw Response 반환 fetch helper 추가** (`web/src/api/apiClient.ts`): 현 `request<T>` 는 `parseBody` 로 본문을 JSON/text 파싱해 반환하고 raw `Response` 를 버린다 — Blob (이진/임의 형식) 저장에 부적합하다. 따라서 **본문을 파싱하지 않고 raw `Response` 를 반환하는 얇은 형제 helper** (예 `requestRaw(path, options?)`) 를 추가한다. 기존 `request` 의 credentials·401→refresh→retry·`ApiError(status)`·네트워크 `ApiError(0)` 표면화 정책을 **그대로 공유** 하되 (중복 fetch 로직 양산 금지 — 공통 핵심을 재사용/추출), 비-2xx 시에도 동일하게 `ApiError` 를 던지고 성공 시 `Response` 자체를 반환한다. `request` 의 기존 시그니처/동작은 **불변** (호출처 회귀 0).
- **export 응답 → Blob → 다운로드 트리거** (`web/src/views/AdminView.tsx`): ④d 의 `runExport` 가 `requestRaw` 로 `GET /api/admin/export` 를 호출해 `Response` 를 받고, `response.blob()` → `URL.createObjectURL(blob)` → 가상 `<a download>` element 생성·클릭·정리 (`removeChild` + `URL.revokeObjectURL`) 로 실제 파일을 저장한다. 파일명은 `Content-Disposition` 헤더의 `filename` 이 있으면 그것을, 없으면 기본명 (예 `export.json` 또는 timestamp 포함 fallback) 을 쓴다. DOM 부수효과 (createElement/click/createObjectURL/revokeObjectURL) 는 **러너에 주입 가능한 deps 로 추상화** 해 (④c~④e 의 `*Deps` 주입 convention 정합) jsdom 없이 직접 검증 가능하게 한다.
- **진행/실패 안전 표시 보존**: in-flight 동안 `busy` (`exporting`), 실패 (403 Admin+ 미만 / 404 / 비-2xx / 네트워크 0) 시 `error` props 로 throw 없이 표면화 (④d 정책 유지). 성공 시 message 는 다운로드 완료 안내로 유지하되 실제 파일이 저장되므로 message 의 의미가 "호출 성공" 에서 "파일 저장 완료" 로 강화된다.

본 slice 는 **zero-new-dep** — `react` hooks + 기존 `apiClient`/`DataImportExportPanel`/`toErrorMessage` + 브라우저 표준 `Blob`/`URL`/DOM API 만 사용한다 (ADR-0040 §5 게이트 — axios·react-query·file-saver 등 새 dependency 0; Blob 다운로드는 브라우저 표준이라 라이브러리 불요). `DataImportExportPanel.tsx`·`useApiResource.ts` 는 **수정 0**. `apiClient.ts` 는 raw helper 1 개 **추가** (기존 export 불변). 직렬 chain (`dependsOn: [T-0389]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx`·`apiClient.ts` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/mutation 트리거는 컨테이너 소유, presentational 은 props 콜백만) / Decision 3 (thin fetch hook/layer 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch/Blob/URL 만, router/axios/react-query/file-saver/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 122행 — `GET /api/admin/export` (Admin+, 평가 자료 export raw 미포함 REQ-032·REQ-030, `scope` query 선택). Admin+ 라 User 등급은 403 — 본 slice 는 error props 안전 표시까지. 123~125행 (`import`·`backup`·`restore`) 은 본 slice 무관.
- `web/src/views/AdminView.tsx` — **갱신 대상** (④e 박제 컨테이너). 현재 `runExport(ExportDeps)` 가 `deps.get(ADMIN_EXPORT_PATH)` 로 호출만 하고 응답을 버리며 `EXPORT_DONE_TEXT` message 만 설정한다. 본 slice 는 (1) `runExport` 가 raw `Response` 를 받아 Blob 다운로드를 수행하도록 확장 (`ExportDeps` 에 raw fetch + DOM/URL 부수효과 주입 추가 — ④c~④e 의 deps 주입 convention), (2) `handleExport` 가 새 deps 를 주입하도록 갱신. **`runImport`/`runAssign`/`deriveMembers`/`deriveProviders`/`deriveDifficultyMapping`/`buildMappingsPath`/`mergeMapping`·import/group/LLM 패널 배선·`AdminViewProps`·`importExportPanelProps` 의 import 측·busy/error/message 합성은 불변** (export 응답 소비만 추가 — 기존 회귀 0). busy/error 합성 우선순위 (busy → error → message) 도 유지.
- `web/src/api/apiClient.ts` — **갱신 대상** (raw helper 추가). 현재 `request<T>(path, options?)` 가 `parseBody` 로 JSON/text 파싱 후 반환하고 raw `Response` 를 버린다. 본 slice 는 **본문을 파싱하지 않고 `Response` 를 반환하는 형제 helper** (예 `requestRaw(path, options?): Promise<Response>`) 를 추가한다 — 기존 credentials(`same-origin`)·401→`POST /api/auth/refresh`→retry 1회·비-2xx → `ApiError(status)`·네트워크 throw → `ApiError(0)` 정책을 **그대로 공유** (공통 fetch+retry 핵심을 재사용/추출해 중복 양산 금지). `request` 의 기존 시그니처/동작은 **불변** (`request` 호출처 — useApiResource/auth/runAssign/runImport — 회귀 0). `ApiError`·`RequestOptions`·`REFRESH_PATH` 재사용.
- `web/src/api/apiClient.test.ts` — **갱신 대상** (raw helper colocated spec). 기존 `request` test 는 **불변 유지** 하고 `requestRaw` 의 R-112 4 종 (성공 시 raw Response 반환 / 비-2xx → ApiError / 401→refresh→retry / 네트워크 → ApiError(0)) 을 추가한다. 기존 test 의 `fetch` mock convention (전역 `fetch` stub) 재사용.
- `web/src/components/DataImportExportPanel.tsx` — **재사용 (수정 0)**. props `onExport?`/`busy?`/`error?`/`message?` (④d 배선) 그대로 소비 — 본 slice 는 컨테이너의 `runExport` 내부만 확장하고 패널 props 계약은 불변 (패널은 Blob/다운로드를 모른다, ADR-0041 Decision 1). 컴포넌트 시그니처/내부 불변.
- `web/src/api/useApiResource.ts` — `toErrorMessage` named export 만 재사용 (수정 0). `useApiResource` 자체는 read-on-mount hook 이라 export 클릭 발화·Blob 다운로드에 쓰지 않는다 (④c~④e 정합 — `apiClient` 직접 호출). `toErrorMessage(e)` 로 `ApiError` → 사람-친화 문구 파생.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④e colocated spec). 기존 그룹·LLM·export(호출)·import test 는 **불변 유지** 하되, ④d 의 export 성공 test 가 응답 소비 0 을 단언했다면 본 slice 의 Blob 다운로드 동작으로 갱신한다. `runExport` 의 raw fetch + DOM/URL 부수효과는 주입 deps (mock) 로 직접 검증 (jsdom·@testing-library 미사용 — ④c~④e 의 `*Deps` 직접 검증 convention). `createObjectURL`/`revokeObjectURL`/anchor click 호출을 mock 으로 단언.

## Acceptance Criteria

- [ ] `web/src/api/apiClient.ts` 갱신 — raw `Response` 반환 helper 추가 (기존 `request` 불변):
  - [ ] `requestRaw(path, options?)` (또는 동등 명) 추가 — 본문을 파싱하지 않고 성공 시 `Response` 를 반환. 기존 `request` 의 credentials(`same-origin`)·401→refresh→retry 1회·비-2xx → `ApiError(status)`·네트워크 throw → `ApiError(0)` 정책을 **그대로 공유** (공통 핵심 재사용/추출 — 중복 fetch 로직 양산 금지).
  - [ ] 기존 `request<T>` 의 시그니처·동작 **불변** — `request` 호출처(useApiResource/auth/runAssign/runImport) 회귀 0. `ApiError`·`RequestOptions`·`REFRESH_PATH` export/내부 계약 보존.
- [ ] `web/src/views/AdminView.tsx` 갱신 — export 응답 → Blob → 다운로드 트리거 (기존 패널·import·LLM·group 회귀 0):
  - [ ] `runExport` 가 raw `Response` 를 받아 `response.blob()` → `URL.createObjectURL` → 가상 `<a download>` 생성·클릭·정리(`revokeObjectURL` + element 제거)로 실제 파일을 저장. raw fetch + DOM/URL 부수효과는 `ExportDeps` 에 주입 추가(④c~④e deps 주입 convention — jsdom 없이 검증 가능). 파일명은 `Content-Disposition` 의 `filename` 이 있으면 그것, 없으면 기본명 fallback(주석 근거).
  - [ ] `handleExport` 가 확장된 deps(raw fetch + createObjectURL/revokeObjectURL + anchor 생성/click 추상화)를 주입하도록 갱신. `exporting` 가드(이전 export 미완 중 재호출 미발사)·진행 on/off·시작 시 error·message 비움은 ④d 동작 유지.
  - [ ] 진행/실패 안전 표시 보존 — in-flight `busy`(exporting), 실패(403 Admin+ 미만/404/비-2xx/네트워크 0) 시 `error` props 로 throw 없이 표면화, 성공 시 `message`(파일 저장 완료 안내). `DataImportExportPanel` 의 busy → error → message 렌더 분기 정합.
- [ ] busy/error/message → props·콜백 경계 준수 (ADR-0041 Decision 1) — `DataImportExportPanel` 은 fetch/Blob/다운로드를 모른다. raw 호출·Blob 변환·파일 저장·진행·실패는 컨테이너가 소유하고 presentational 은 `onExport` 콜백 + `busy`/`error`/`message` props 만 소비.
- [ ] 기존 배선(`GroupMemberList` + `DifficultyModelSelector` read/onAssign + `DataImportExportPanel` import + `runAssign`/`runImport`/`deriveProviders`/`deriveDifficultyMapping`/`mergeMapping`/`buildMappingsPath`/`deriveMembers`) **불변** — 본 slice 는 export 응답 소비만 추가(기존 회귀 0). `AdminViewProps`·import 측 시그니처·busy/error/message 합성 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `apiClient`/`DataImportExportPanel`/`toErrorMessage` + 브라우저 표준 `Blob`/`URL`/DOM(`document.createElement`) 만(router/axios/react-query/file-saver/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED(§5 new-dep 게이트).
- [ ] `DataImportExportPanel.tsx`·`useApiResource.ts` **수정 0** — controlled props·기존 toErrorMessage 그대로 소비. 배선이 컴포넌트/hook 시그니처 수정을 요구하면 BLOCKED/Follow-up(file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/api/apiClient.test.ts` 갱신 — 기존 `request` test 불변 유지 + `requestRaw` 의 R-112 4 종:
  - [ ] **happy-path**: 2xx 응답 시 `requestRaw` 가 raw `Response`(본문 미파싱)를 반환 1+ AND credentials `same-origin` 으로 호출됨 단언 1+.
  - [ ] **error path**: 비-2xx(예 403/404/500) 응답 시 `ApiError(status)` throw 1+ / 네트워크 실패(fetch reject) 시 `ApiError(0)` throw 1+.
  - [ ] **flow/branch**: 401 응답 시 `POST /api/auth/refresh` 1회 호출 후 원 요청 재시도 → 재시도 성공 시 Response 반환 분기 1+ AND refresh 실패 시 원 401(ApiError(401)) 전파 분기 1+.
  - [ ] **negative cases 충분 cover**: refresh 자체가 자기 재호출하지 않음(무한 루프 방지) 1+ / 401 외 비-2xx 는 refresh 트리거 안 함 1+.
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 test 불변 유지(④d export 성공 test 는 Blob 다운로드 동작으로 갱신) + export 다운로드 배선의 R-112 4 종:
  - [ ] **happy-path**: export 트리거 시 raw fetch 가 `GET /api/admin/export` 로 호출되고 성공 응답의 blob 으로 `createObjectURL` + anchor download click + `revokeObjectURL` 이 호출됨 1+ AND 완료 message 가 패널에 내려가고 busy 해제됨 1+.
  - [ ] **error path**: export 실패(403 Admin+ 미만/404/비-2xx) 시 `DataImportExportPanel` 이 `error` props 로 사람-친화 문구를 받아 표시하고 throw 없이 처리 + 다운로드 부수효과 미호출(createObjectURL 등) 1+ / 네트워크 실패(`ApiError(0)`) 시 안전 문구 표시 1+.
  - [ ] **flow/branch**: in-flight 동안 진행 표시(busy/exporting) 분기 1+ AND 성공 후 진행 해제 + message + 다운로드 트리거 분기 1+ AND 실패 후 진행 해제 + error + 다운로드 미트리거 분기 1+ AND `Content-Disposition` filename 유무에 따른 파일명 결정 분기 각 1+.
  - [ ] **negative cases 충분 cover**: export in-flight 중 재트리거(이전 export 미완) 시 이중 호출·중복 다운로드 없이 안전 처리 1+ / 빈/비정상 blob(예 0-byte) 응답도 throw 없이 처리(또는 의도된 안전 분기) 1+ / 실패 후 재시도 시 직전 error 비우고 정상 재발화 + 다운로드 1+ / `createObjectURL` 후 예외 발생 시에도 `revokeObjectURL` 정리 누락 없음(자원 누수 방지) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx + apiClient.test.ts(갱신) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 — web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인.
- [ ] coverage: web vitest 의 본 task 신규 `requestRaw`·확장 `runExport`(Blob/다운로드 분기)·DOM/URL 부수효과 deps line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선(T-0355 Follow-up tracked gap)이고 `@vitest/coverage-v8` 미설치(ADR-0040 §5 zero-new-dep)라 coverage 는 신규 분기별 spec 으로 **구성적 cover** — ③a~④e 와 동일.

## Out of Scope

- **export scope 선택 UI** — `scope` query 를 사용자가 고르는 드롭다운/필터 UI 는 후속(④d Out of Scope 유지). 본 slice 는 scope 미부착(전체 scope, backend 기본 위임) 유지 — query 변경 0.
- **import 결과 상세 표시 / dry-run / 진행률** — import 응답의 건수/충돌/검증 리포트 상세 패널·dry-run·업로드 진행률은 후속(④e Out of Scope 유지). 본 slice 는 export 측만.
- **export 응답 형식 협상 / 다중 형식(CSV·xlsx) 선택 UI** — Accept 헤더 협상이나 사용자가 export 형식을 고르는 UI 는 후속. 본 slice 는 응답을 그대로 Blob 저장(형식은 backend 가 결정, Content-Type/Content-Disposition 따름).
- **backup / restore 배선** — `POST /api/admin/backup`·`/api/admin/restore`(api.md 124·125) 배선은 본 slice 무관(후속 또는 별도).
- **나머지 2 Admin 패널 배선** — `ReEvaluationTriggerPanel`(backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 미구현 deferred, api.md 94~97, backend 완결 후 후속)·`SchedulePanel`(스케줄 — shipped scheduler endpoint 미확인) 배선은 후속.
- **`GroupMemberList` 멤버 추가/제거 mutation**(`onRemove`/`onAdd`) — 멤버 제거 endpoint 계약(person↔group link 표현)이 api.md 에서 미확정이라 별도 slice 에서 contract 확인 후 배선. 본 slice 무관(그룹 패널 회귀 0).
- **`apiClient.request` 의 Blob/binary 지원으로의 통합** — 본 slice 는 raw `Response` 반환 형제 helper 만 추가(기존 `request` 의 파싱 동작 보존). `request` 를 generic 본문 모드(parse|raw|blob)로 통합 리팩토링하는 것은 cap·YAGNI 위배라 후속 평가(현재 두 호출처 형태로 충분).
- **Admin+ RBAC gating UI** — Admin+ 미만에게 패널/화면을 숨기는 gating 은 후속(본 slice 는 403 을 error props 로 안전 표시까지, ④b~④e 정책 유지).
- **공통 mutation hook 추출**(`useApiMutation` 등) — 본 slice 는 컨테이너 내부 async 러너 유지(④c~④e 정합). runAssign/runExport/runImport 패턴 확인 후 후속 평가.
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 `GET /api/persons` 배선** — 후속 slice(이전 task Out of Scope 유지).
- **react-router · @tanstack/react-query · axios · file-saver · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **export scope 선택 UI**(scope 드롭다운 → query 부착) + **import 결과 상세 표시**. 그 후 `GroupMemberList` 멤버 add/remove mutation(person↔group link endpoint 계약 api.md 확인 선행) + `SchedulePanel` 배선(shipped scheduler endpoint 확인 선행) + `ReEvaluationTriggerPanel` 배선(backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 완결 후) + Admin+ RBAC gating UI 일괄 결정. runAssign/runExport/runImport 세 async 러너 등장 → 공통 mutation hook(`useApiMutation`) 추출 평가. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너(`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
