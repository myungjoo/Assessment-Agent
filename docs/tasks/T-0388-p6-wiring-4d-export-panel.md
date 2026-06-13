---
id: T-0388
title: P6 composition wiring ④d AdminView 에 DataImportExportPanel export 배선(onExport → GET /api/admin/export)
phase: P6
status: DONE
mergedAs: b3efa92
prNumber: 319
reviewRounds: 1
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0387]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④d; ADR-0041 Decision1·3·5; AdminView 세번째 패널 DataImportExportPanel export 배선(onExport→GET /api/admin/export, busy/error/message props); import multipart·실 파일저장 UX·RBAC gating 은 후속"
sizeExempt: false
---

# T-0388 — P6 composition wiring ④d AdminView 에 DataImportExportPanel export 배선

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 네 번째 fragment 를 잇는다. wiring ④a (T-0385 / PR #316) 가 `AdminView` 컨테이너 shell + `GroupMemberList` 첫 패널을, ④b (T-0386 / PR #317) 가 `DifficultyModelSelector` 읽기 배선을, ④c (T-0387 / PR #318 squash dcb75af) 가 `DifficultyModelSelector.onAssign` 실 PATCH mutation 을 박제했다. ④a~④c Out of Scope 가 일관되게 후속으로 미룬 나머지 3 패널 (`ReEvaluationTriggerPanel`·`DataImportExportPanel`·`SchedulePanel`) 중 **`DataImportExportPanel` 의 export 배선** 을 본 slice 가 완결한다. README REQ-046·REQ-047 (데이터 export/import) 의 frontend export 표면을 cover 한다.

`ReEvaluationTriggerPanel` 이 아니라 `DataImportExportPanel` export 를 먼저 배선하는 이유: `ReEvaluationTriggerPanel` 이 표현하는 "N일 window delete→재수집" 은 backend `POST /api/assessments/reeval`·`DELETE /api/assessments`·`POST /api/assessments/run` 에 매핑되는데 이들은 api.md 94~97행 기준 **미구현 (P5/P7 deferred)** 이라 실 endpoint 가 없다. 반면 `GET /api/admin/export` (api.md 122행, Admin+) 는 **shipped** 라 실 배선이 가능하다. 따라서 본 slice 는 shipped endpoint 를 가진 export 부터 잇는다 (deferred endpoint 의존 패널은 backend 완결 후 후속).

전체 Admin 화면 (5 패널 + 다중 mutation + import multipart + 파일저장 UX + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→③b-1→③b-2→③b-3→④a→④b→④c 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④d 는 `DataImportExportPanel` 의 export 한 concern 으로만 국소화** 한다:

- **세 번째 패널 추가 + export 콜백 배선** (`web/src/views/AdminView.tsx`): `DataImportExportPanel` 을 `<section>` 안에 추가하고 `onExport` 콜백을 실 핸들러로 배선한다. `onExport` 호출 시 `apiClient.request` 로 `GET /api/admin/export` (api.md 122행 — `scope` query, Admin+) 를 호출한다. `useApiResource` 는 read-on-mount 라 사용자 클릭으로 발화하는 export 에는 부적합 — export 는 컨테이너 내부 async 핸들러에서 `apiClient.request` 직접 호출 (④c `runAssign` 패턴 정합, 신규 fetch/mutation hook 작성 금지).
- **export 진행/결과/실패 안전 표시**: export in-flight 동안 `busy` props 로 진행 표시, 성공 시 `message` props 로 사람-친화 안내 (예: "내보내기 완료" — export 데이터 건수/scope 요약은 본문 결정), 실패 (403 Admin+ 미만 / 네트워크 0 / 비-2xx) 시 `error` props 로 throw 없이 문구를 표면화한다 (`ApiError.status` → `toErrorMessage` 파생, ④c 패턴 정합).

본 slice 는 **zero-new-dep** — `react` hooks (`useState`/`useCallback`) + 기존 `apiClient.request`/`DataImportExportPanel`/`toErrorMessage` import 만 추가하고, 기박제 presentational 은 **수정 0** 으로 props 배선만 한다 (ADR-0040 §5 게이트 — axios·react-query·차트 라이브러리·jsdom·@testing-library 등 새 dependency 0). 직렬 chain (`dependsOn: [T-0387]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/mutation 트리거는 컨테이너 소유, presentational 은 props 콜백만 노출) / Decision 3 (thin fetch hook 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 122행 — `GET /api/admin/export` (Admin+, 평가 자료 export raw 미포함 REQ-032·REQ-030, `scope` query). Admin+ 라 User 등급은 403 — 본 slice 는 error props 안전 표시까지. 123~125행 (`POST /api/admin/import`·`/backup`·`/restore`) 은 본 slice **Out of Scope** (export 만).
- `web/src/views/AdminView.tsx` — **갱신 대상** (④c 박제 컨테이너, ~459 LOC). 현재 `useApiResource` 3회 + `runAssign` async 러너 (`apiClient.request` 주입) + `GroupMemberList`/`DifficultyModelSelector` 두 패널 배선. 본 slice 는 (1) `DataImportExportPanel` import + 세 번째 `<section>` 추가, (2) export 컨테이너 내부 async 러너 (④c `runAssign` 캡슐화 패턴 차용 — `runExport` 순수 async 러너로 테스트 가능성 확보) + busy/message/error state 3종, (3) `onExport` 핸들러 배선. **기존 그룹/LLM 패널 배선·runAssign·deriveProviders/deriveDifficultyMapping/mergeMapping·AdminViewProps·export 시그니처는 불변** (export 추가만 — 기존 회귀 0).
- `web/src/components/DataImportExportPanel.tsx` — **재사용 (수정 0)**. props: `onExport?: () => void`, `onImportFile?: (file: File) => void`, `busy?: boolean`, `error?: string`, `message?: string`, `exportLabel?`/`importLabel?`. busy 우선 → error alert → 정상(export 버튼/import 입력/message) 분기가 이미 박제. 본 slice 는 `onExport`/`busy`/`error`/`message` 만 배선하고 `onImportFile` 은 **미전달** (import 는 Out of Scope — 파일 입력 비활성). `DataImportExportPanelProps` 타입 named import (재정의 금지). 컴포넌트 시그니처/내부 불변.
- `web/src/api/apiClient.ts` — **재사용 (수정 0)**. `request<T>(path, options?: RequestOptions)` 가 export GET primitive (401→refresh→retry·`ApiError(status)`·네트워크 `ApiError(0)` 표면화 내장, 2xx 는 JSON/text 파싱). 본 slice 의 export 는 `request('/api/admin/export' + scope query, { method: 'GET' })` (또는 옵션 생략 — 기본 GET) 형태로 호출. 정확한 RequestOptions 키는 본문 확인.
- `web/src/api/useApiResource.ts` — `toErrorMessage` named export 만 사용 (재사용, 수정 0). `useApiResource` 자체는 read-on-mount hook 이라 export (클릭 발화) 에는 쓰지 않는다 — 본 slice 는 `apiClient.request` 직접 호출 (④c 정합). `toErrorMessage(e)` 로 `ApiError` → 사람-친화 문구 파생.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④c colocated spec). 기존 그룹·LLM 읽기/mutation test 는 **불변 유지** 하고 export 배선 test 를 추가한다. ④a~④c 의 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request` mock, jsdom·@testing-library 미사용, `.test.tsx` 고정) 정합. export test 는 `runExport` 순수 async 러너를 직접 검증 (④c `runAssign` 직접 검증 convention — jsdom/렌더러 없이 export 본체 검증) + `apiClient.request` mock 을 method/path 기준 단언 + 성공/실패 분기 응답 주입.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — `DataImportExportPanel` 세 번째 패널 + export 배선 (기존 패널 회귀 0):
  - [ ] `DataImportExportPanel` 을 `<section>` 안에 추가 배선 — `DataImportExportPanelProps` named import. `onExport` 에 실 export 핸들러, `busy`/`error`/`message` 에 컨테이너 state 를 내려보낸다. `onImportFile` 은 **미전달** (import Out of Scope — 파일 입력 비활성, 주석으로 "import 는 후속" 명시).
  - [ ] export 컨테이너 내부 async 러너 (`runExport`, ④c `runAssign` 캡슐화 패턴 차용 — `AssignDeps` 와 동형의 `ExportDeps` 주입으로 jsdom 없이 본체 검증) — `onExport` 호출 시 `apiClient.request` 로 `GET /api/admin/export` (scope query 포함 여부·기본 scope 는 본문 결정·주석 근거) 를 호출. `useApiResource` 미사용 (클릭 발화라 read-on-mount 부적합 — 컨테이너 내부 async 핸들러).
  - [ ] export 진행/결과/실패 안전 표시 — in-flight 동안 `busy` props (또는 컨테이너 `exporting` state), 성공 시 `message` props 로 사람-친화 안내 (예: "내보내기 완료"), 실패 시 `error` props 로 throw 없이 문구 표면화 (`ApiError.status` → `toErrorMessage` 파생). 403 Admin+ 미만 / 404 / 네트워크 0 / 비-2xx 분기를 모두 안전 처리. busy·message·error 우선순위는 본문 결정·주석 근거 (예: busy 우선 → error → message — `DataImportExportPanel` 의 busy/error/message 렌더 분기 정합).
- [ ] busy/error/message → props·콜백 경계 준수 (ADR-0041 Decision 1) — `DataImportExportPanel` 은 fetch 를 모른다. export 호출·진행·결과·실패는 컨테이너가 소유하고 presentational 은 `onExport` 콜백 + `busy`/`error`/`message` props 만 소비.
- [ ] 기존 배선 (`GroupMemberList` 그룹 패널 + `DifficultyModelSelector` provider/mapping 읽기 + onAssign PATCH + `runAssign`/`deriveProviders`/`deriveDifficultyMapping`/`mergeMapping`/`buildMappingsPath`) **불변** — 본 slice 는 export 추가만 (기존 회귀 0). `AdminViewProps`·기존 export 시그니처 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `apiClient`/`DataImportExportPanel`/`toErrorMessage` import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `DataImportExportPanel.tsx`·`apiClient.ts`·`useApiResource.ts` 등 기존 모듈 **수정 0** — controlled props·기존 request primitive 그대로 소비. 배선이 컴포넌트/hook 시그니처 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 test 불변 유지 + export 배선 (`runExport` 직접 + `apiClient.request` mock 을 method/path 기준 단언·분기 응답 주입) 에 대한 R-112 4 종:
  - [ ] **happy-path**: export 트리거 시 `apiClient.request` 가 `GET /api/admin/export` (scope query 포함 시 정확한 path) 로 정확히 호출됨 1+ AND 성공 후 `message` props 로 완료 안내가 `DataImportExportPanel` 에 내려가고 busy 해제됨 1+.
  - [ ] **error path**: export 가 실패 (예 403 Admin+ 미만, 404, 비-2xx) 할 때 `DataImportExportPanel` 이 `error` props 로 사람-친화 문구를 받아 표시하고 throw 없이 처리됨 1+ / 네트워크 실패 (`ApiError(0)`) 시 안전 문구 표시 1+.
  - [ ] **flow/branch**: export in-flight 동안 진행 표시 (`busy`/`exporting`) 분기 1+ AND 성공 완료 후 진행 표시 해제 + message 표시 분기 1+ AND 실패 후 진행 표시 해제 + error 표시 분기 1+.
  - [ ] **negative cases 충분 cover**: export in-flight 중 재클릭 (이전 export 미완 중 재호출) 시 이중 호출·state 깨짐 없이 안전 처리 (④c `runAssign` 의 assigning 가드 동형) 1+ / 비정상 응답 (빈 body·예상 외 형태) 시 throw 없이 안전 처리 1+ / 실패 후 재시도 (재클릭) 시 직전 error 비우고 정상 재발화 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx (갱신) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 export 러너 (`runExport`)·busy/message/error state·핸들러 로직 line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 러너의 분기별 spec 으로 **구성적 cover** 한다 — ③a~④c 와 동일.

## Out of Scope

- **import (가져오기) 배선** — `DataImportExportPanel.onImportFile` 실 배선 (`POST /api/admin/import` multipart file upload) 은 **후속 slice 책임**. 본 slice 는 `onImportFile` 미전달 (파일 입력 비활성) — export 만. multipart `FormData` 전송은 별도 fetch 형태라 별 concern.
- **backup / restore 배선** — `POST /api/admin/backup`·`/api/admin/restore` (api.md 124·125행) 배선은 본 slice 무관 (후속 또는 별도). 본 slice 는 export 1 endpoint 만.
- **실 파일 저장 UX (브라우저 다운로드 트리거)** — export 응답을 `Blob` → `URL.createObjectURL` → 가상 `<a download>` 클릭으로 실제 파일 저장하는 UX 는 후속. 본 slice 는 `apiClient.request` 로 export 데이터를 받아 성공/실패를 `message`/`error` 로 표면화하는 것까지 (파일 저장 트리거는 별 slice — Blob 처리·`apiClient` 가 JSON/text 파싱이라 binary stream 은 별도 fetch 경로 검토 필요).
- **export scope 선택 UI** — `scope` query 를 사용자가 고르는 드롭다운/필터 UI 는 후속. 본 slice 는 기본 scope (또는 scope 생략) 로 export 호출 (본문 결정·주석 근거).
- **나머지 2 Admin 패널 배선** — `ReEvaluationTriggerPanel` (재평가 trigger — backend `/api/assessments/reeval`·`DELETE`·`/run` 미구현 deferred, backend 완결 후 후속) · `SchedulePanel` (스케줄 설정) 배선은 후속 slice 책임.
- **`GroupMemberList` 멤버 추가/제거 mutation** (`onRemove`/`onAdd`) — ④a 가 남긴 mutation 은 후속 slice. 본 slice 는 그룹 패널 회귀 0 (불변).
- **`DifficultyModelSelector` 의 provider CRUD UI / 추가 mutation** — 본 slice 무관.
- **Admin+ RBAC gating UI** — Admin+ 미만 사용자에게 export 패널 (또는 Admin 화면 전체) 을 숨기는 gating. 본 slice 는 403 을 error props 로 안전 표시까지만 (④b·④c 정책 유지) 하고 패널 숨김/접근 차단 UI 는 후속 (mutation 패널 일괄 조립 시) 결정.
- **공통 mutation hook 추출** (`useApiMutation` 등) — 본 slice 는 컨테이너 내부 async 러너로 처리 (④c `runAssign` 정합). export 가 두 번째 async 러너이므로 공통 추출을 Follow-up 으로 평가 (지금 추출하면 cap·YAGNI 위배 — runAssign/runExport 두 사례로 패턴 확인 후 후속).
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선** — 후속 slice (이전 task Out of Scope 그대로 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ④e** — `DataImportExportPanel.onImportFile` 실 배선 (`POST /api/admin/import` multipart `FormData`) + export 실 파일 저장 UX (Blob→다운로드 트리거) + export scope 선택 UI. 그 후 `SchedulePanel` 배선 / `ReEvaluationTriggerPanel` 배선 (backend `/api/assessments/reeval`·delete·run 완결 후) + `GroupMemberList` 멤버 add/remove mutation + Admin+ RBAC gating UI 일괄 결정. `runAssign`/`runExport` 두 async 러너 등장 → 공통 mutation hook (`useApiMutation`) 추출 평가. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너 (`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
