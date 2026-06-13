---
id: T-0389
title: P6 composition wiring ④e AdminView 에 DataImportExportPanel import 배선(onImportFile → POST /api/admin/import multipart)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0388]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: "P6 wiring④e; ADR-0041 Decision1·3·5; AdminView DataImportExportPanel import 배선(onImportFile→POST /api/admin/import multipart FormData, runImport async 러너=④d runExport 패턴 차용); POST /api/admin/import 는 api.md 123 shipped; 실 파일저장 UX·scope UI·RBAC gating·나머지 패널은 후속"
sizeExempt: false
---

# T-0389 — P6 composition wiring ④e AdminView 에 DataImportExportPanel import 배선

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 다섯 번째 fragment 를 잇는다. wiring ④a (T-0385 / PR #316) 가 `AdminView` 컨테이너 shell + `GroupMemberList` 첫 패널을, ④b (T-0386 / PR #317) 가 `DifficultyModelSelector` 읽기 배선을, ④c (T-0387 / PR #318 dcb75af) 가 `DifficultyModelSelector.onAssign` 실 PATCH mutation 을, ④d (T-0388 / PR #319 squash b3efa92) 가 `DataImportExportPanel.onExport` 실 GET export 배선을 박제했다. ④d Out of Scope 가 명시적으로 후속으로 미룬 **`DataImportExportPanel` 의 import 배선** 을 본 slice 가 완결한다. README REQ-046·REQ-047 (데이터 export/import) 의 frontend import 표면을 cover 한다.

import 을 본 slice 에서 배선하는 것이 가능한 이유: `POST /api/admin/import` (multipart file upload, Admin+) 는 **api.md 123행 기준 shipped** 다 — `/api/admin/export` 와 같은 UC-07 endpoint 테이블의 live row 이며, `/api/assessments` batch 4 건 (`/run`·bulk `DELETE`·`/reeval`·`/reset`, api.md 94~97행 "미구현, P5") 이나 `ReEvaluationTriggerPanel` 이 매핑되는 deferred endpoint 와 달리 미구현 annotation 이 없다. 따라서 본 slice 는 shipped endpoint 를 가진 import 를 잇는다 (deferred endpoint 의존 패널은 backend 완결 후 후속).

전체 Admin 화면 (5 패널 + 다중 mutation + 실 파일저장 UX + scope UI + Admin+ RBAC gating) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. ③a→③b-1→③b-2→③b-3→④a→④b→④c→④d 의 split discipline (ADR-0041 Consequences §부정 — View 공유 수정은 잘게 split + 패널/concern 단위 직렬 추가) 을 그대로 따라, 본 **④e 는 `DataImportExportPanel` 의 import 한 concern 으로만 국소화** 한다:

- **import 콜백 배선** (`web/src/views/AdminView.tsx`): 이미 ④d 에서 마운트된 `DataImportExportPanel` 의 `onImportFile` 콜백을 실 핸들러로 배선한다 (④d 가 미전달로 비활성화했던 파일 입력을 활성화). `onImportFile(file)` 호출 시 `multipart/form-data` `FormData` 를 만들어 `apiClient.request` 로 `POST /api/admin/import` (api.md 123행 — Admin+) 를 호출한다. ④c `runAssign` / ④d `runExport` 정합 — 신규 fetch/mutation hook 작성 금지, 컨테이너 내부 async 러너 (`runImport`) 로 캡슐화.
- **import 진행/결과/실패 안전 표시**: import in-flight 동안 `busy` props 로 진행 표시, 성공 시 `message` props 로 사람-친화 안내 (예: "가져오기 완료" — import 건수/결과 요약은 응답 형태에 따라 본문 결정), 실패 (403 Admin+ 미만 / 400 잘못된 파일 / 네트워크 0 / 비-2xx) 시 `error` props 로 throw 없이 문구를 표면화한다 (`ApiError.status` → `toErrorMessage` 파생, ④c·④d 패턴 정합).

`apiClient.request` 는 `RequestOptions extends Omit<RequestInit, 'credentials'>` 라 `{ method: 'POST', body: <FormData> }` 를 native 로 받는다 — `body` 가 `FormData` 면 브라우저가 multipart `Content-Type` boundary 를 자동 설정하므로 **`apiClient.ts` 수정 0** 으로 multipart 전송이 가능하다 (응답은 기존 `parseBody` 가 JSON/text 처리). 본 slice 는 **zero-new-dep** — `react` hooks (`useState`/`useCallback`) + 기존 `apiClient.request`/`DataImportExportPanel`/`toErrorMessage` import 만 사용하고, 기박제 presentational 은 **수정 0** 으로 props 배선만 한다 (ADR-0040 §5 게이트 — axios·react-query·차트 라이브러리·jsdom·@testing-library 등 새 dependency 0). 직렬 chain (`dependsOn: [T-0388]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AdminView.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/mutation 트리거는 컨테이너 소유, presentational 은 props 콜백만 노출) / Decision 3 (thin fetch hook 재사용 + loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 123행 — `POST /api/admin/import` (Admin+, 평가 자료 import multipart file upload). api.md 122행 (`GET /api/admin/export`) 는 ④d 가 이미 배선 — 본 slice 무관. 124~125행 (`/api/admin/backup`·`/restore`) 은 본 slice **Out of Scope** (import 만). Admin+ 라 User 등급은 403 — 본 slice 는 error props 안전 표시까지.
- `web/src/views/AdminView.tsx` — **갱신 대상** (④d 박제 컨테이너). 현재 `useApiResource` 3회 + `runAssign` async 러너 + `runExport` async 러너 (`apiClient.request` 주입) + `GroupMemberList`/`DifficultyModelSelector`/`DataImportExportPanel` 세 패널 배선. 본 slice 는 (1) 기마운트된 `DataImportExportPanel` 의 `onImportFile` 콜백 실 배선 (④d 가 미전달했던 prop), (2) import 컨테이너 내부 async 러너 (④d `runExport` 캡슐화 패턴 차용 — `runImport` 순수 async 러너로 테스트 가능성 확보, `ImportDeps` 주입), (3) import 진행/결과/실패 표시를 위한 busy/message/error state 관리. **export 의 busy/message/error state 와 import 의 그것을 어떻게 공유/분리할지는 본문 결정** (예: 패널 단위 단일 busy/error/message — `DataImportExportPanel` 이 export·import 를 한 패널로 표현하므로 단일 state 묶음이 자연스러움; 또는 작업별 분리. 주석으로 근거). **기존 그룹/LLM 패널 배선·runAssign·runExport·deriveProviders/deriveDifficultyMapping/mergeMapping·AdminViewProps·export 시그니처는 불변** (import 추가만 — 기존 회귀 0).
- `web/src/components/DataImportExportPanel.tsx` — **재사용 (수정 0)**. props: `onExport?: () => void`, `onImportFile?: (file: File) => void`, `busy?: boolean`, `error?: string`, `message?: string`, `exportLabel?`/`importLabel?`. `handleFileChange` 가 선택된 첫 `File` (`event.target.files?.[0]`) 로 `onImportFile(file)` 호출 — 본 slice 는 `onImportFile` 만 추가 배선 (④d 가 배선한 `onExport`/`busy`/`error`/`message` 는 유지). 파일 입력은 `onImportFile` 전달 시 활성화된다 (`disabled={!onImportFile}`). `DataImportExportPanelProps` 타입 named import (재정의 금지). 컴포넌트 시그니처/내부 불변.
- `web/src/api/apiClient.ts` — **재사용 (수정 0)**. `request<T>(path, options?: RequestOptions)` 가 `RequestOptions extends Omit<RequestInit, 'credentials'>` 라 `{ method: 'POST', body: formData }` 를 native 수용. `body` 가 `FormData` 면 브라우저가 multipart boundary 를 자동 설정 (수동 `Content-Type` 지정 금지 — boundary 누락됨). 401→refresh→retry·`ApiError(status)`·네트워크 `ApiError(0)` 표면화 내장. 본 slice 의 import 는 `request('/api/admin/import', { method: 'POST', body: formData })` 형태. **FormData 의 field 이름 (예: `file`) 은 backend multipart 계약을 따른다 — api.md 또는 백엔드 controller 확인 후 정확히 (불명 시 가장 표준적인 `file` 키 + 주석 근거, 후속 정정 가능)**.
- `web/src/api/useApiResource.ts` — `toErrorMessage` named export 만 사용 (재사용, 수정 0). `useApiResource` 자체는 read-on-mount hook 이라 import (파일 선택 발화) 에는 쓰지 않는다 — 본 slice 는 `apiClient.request` 직접 호출 (④c·④d 정합). `toErrorMessage(e)` 로 `ApiError` → 사람-친화 문구 파생.
- `web/src/views/AdminView.test.tsx` — **갱신 대상** (④d colocated spec). 기존 그룹·LLM 읽기/mutation·export test 는 **불변 유지** 하고 import 배선 test 를 추가한다. ④a~④d 의 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request` mock, jsdom·@testing-library 미사용, `.test.tsx` 고정) 정합. import test 는 `runImport` 순수 async 러너를 직접 검증 (④d `runExport` 직접 검증 convention — jsdom/렌더러 없이 import 본체 검증) + `apiClient.request` mock 을 method/path/body(FormData) 기준 단언 + 성공/실패 분기 응답 주입. `FormData` 단언은 mock 호출 인자의 `body instanceof FormData` + (가능 시) `formData.get('<field>')` 로 파일 동봉 확인.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 갱신 — `DataImportExportPanel.onImportFile` 실 배선 (기존 패널·export 회귀 0):
  - [ ] 기마운트된 `DataImportExportPanel` 에 `onImportFile` 콜백 추가 전달 — 파일 선택 시 호출되며, ④d 가 비활성화했던 파일 입력이 활성화된다. `onExport`/`busy`/`error`/`message` (④d 배선) 는 유지. export·import 의 busy/error/message state 공유/분리는 본문 결정·주석 근거.
  - [ ] import 컨테이너 내부 async 러너 (`runImport`, ④d `runExport` 캡슐화 패턴 차용 — `ExportDeps` 와 동형의 `ImportDeps` 주입으로 jsdom 없이 본체 검증) — `onImportFile(file)` 호출 시 `FormData` 에 선택 `File` 을 append 하고 `apiClient.request` 로 `POST /api/admin/import` (`{ method: 'POST', body: formData }`) 를 호출. FormData field 이름은 backend 계약 (불명 시 `file` + 주석 근거). `apiClient.ts` 수정 0 (multipart 는 native `RequestInit.body` 로 전송, 수동 Content-Type 미지정).
  - [ ] import 진행/결과/실패 안전 표시 — in-flight 동안 `busy` props (또는 컨테이너 `importing`/공통 state), 성공 시 `message` props 로 사람-친화 안내 (예: "가져오기 완료"), 실패 시 `error` props 로 throw 없이 문구 표면화 (`ApiError.status` → `toErrorMessage` 파생). 403 Admin+ 미만 / 400 잘못된 파일 / 404 / 네트워크 0 / 비-2xx 분기를 모두 안전 처리. busy·message·error 우선순위는 `DataImportExportPanel` 의 busy/error/message 렌더 분기 정합 (busy 우선 → error → message).
- [ ] busy/error/message → props·콜백 경계 준수 (ADR-0041 Decision 1) — `DataImportExportPanel` 은 fetch/FormData 를 모른다. import 호출·진행·결과·실패는 컨테이너가 소유하고 presentational 은 `onImportFile` 콜백 + `busy`/`error`/`message` props 만 소비.
- [ ] 기존 배선 (`GroupMemberList` 그룹 패널 + `DifficultyModelSelector` provider/mapping 읽기 + onAssign PATCH + `DataImportExportPanel` export + `runAssign`/`runExport`/`deriveProviders`/`deriveDifficultyMapping`/`mergeMapping`/`buildMappingsPath`) **불변** — 본 slice 는 import 추가만 (기존 회귀 0). `AdminViewProps`·기존 export/시그니처 보존.
- [ ] 새 dependency 0 — `react` hooks + 기존 `apiClient`/`DataImportExportPanel`/`toErrorMessage` import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `DataImportExportPanel.tsx`·`apiClient.ts`·`useApiResource.ts` 등 기존 모듈 **수정 0** — controlled props·기존 request primitive·native multipart body 그대로 소비. 배선이 컴포넌트/hook/apiClient 시그니처 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 갱신 — 기존 test 불변 유지 + import 배선 (`runImport` 직접 + `apiClient.request` mock 을 method/path/body 기준 단언·분기 응답 주입) 에 대한 R-112 4 종:
  - [ ] **happy-path**: import 트리거 (파일 선택) 시 `apiClient.request` 가 `POST /api/admin/import` 로 `body instanceof FormData` (선택 `File` 동봉) 인자로 정확히 호출됨 1+ AND 성공 후 `message` props 로 완료 안내가 `DataImportExportPanel` 에 내려가고 busy 해제됨 1+.
  - [ ] **error path**: import 가 실패 (예 403 Admin+ 미만, 400 잘못된 파일, 비-2xx) 할 때 `DataImportExportPanel` 이 `error` props 로 사람-친화 문구를 받아 표시하고 throw 없이 처리됨 1+ / 네트워크 실패 (`ApiError(0)`) 시 안전 문구 표시 1+.
  - [ ] **flow/branch**: import in-flight 동안 진행 표시 (`busy`/`importing`) 분기 1+ AND 성공 완료 후 진행 표시 해제 + message 표시 분기 1+ AND 실패 후 진행 표시 해제 + error 표시 분기 1+.
  - [ ] **negative cases 충분 cover**: import in-flight 중 재선택 (이전 import 미완 중 재호출) 시 이중 호출·state 깨짐 없이 안전 처리 (④c·④d 의 guard 동형) 1+ / 파일 없는 change 이벤트 (빈 선택) 시 호출 안 됨·throw 없음 1+ (`DataImportExportPanel.handleFileChange` 가 file falsy 시 미호출이나 러너 자체 방어도 확인) / 실패 후 재시도 (재선택) 시 직전 error 비우고 정상 재발화 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx (갱신) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 import 러너 (`runImport`)·busy/message/error state·핸들러 로직 line ≥ 80% AND function ≥ 80% 충족. 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 러너의 분기별 spec 으로 **구성적 cover** 한다 — ③a~④d 와 동일.

## Out of Scope

- **실 파일 저장 / 다운로드 UX (export Blob 다운로드 트리거)** — ④d export 의 응답을 `Blob` → `URL.createObjectURL` → 가상 `<a download>` 클릭으로 실제 파일 저장하는 UX 는 후속 (④d Out of Scope 그대로 유지). 본 slice 는 import 만 — export 측 변경 0.
- **import 결과 상세 표시 / dry-run / 진행률** — import 응답의 건수/충돌/검증 리포트를 상세 패널로 펼치거나, dry-run preview, 업로드 진행률 (`XMLHttpRequest` progress) 표시는 후속. 본 slice 는 성공/실패를 `message`/`error` 로 표면화하는 것까지.
- **파일 형식 검증 / 크기 제한 UI** — 클라이언트 측 `accept` 필터, 확장자/MIME 검증, 최대 크기 경고 UI 는 후속. 본 slice 는 선택 `File` 을 그대로 multipart 전송 (검증은 backend 책임 — 400 을 error props 로 안전 표시).
- **backup / restore 배선** — `POST /api/admin/backup`·`/api/admin/restore` (api.md 124·125행) 배선은 본 slice 무관 (후속 또는 별도).
- **export scope 선택 UI** — `scope` query 를 사용자가 고르는 드롭다운/필터 UI 는 후속 (④d Out of Scope 유지). 본 slice 무관.
- **나머지 2 Admin 패널 배선** — `ReEvaluationTriggerPanel` (재평가 trigger — backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 미구현 deferred, api.md 94~97행, backend 완결 후 후속) · `SchedulePanel` (스케줄 설정) 배선은 후속 slice 책임.
- **`GroupMemberList` 멤버 추가/제거 mutation** (`onRemove`/`onAdd`) — ④a 가 남긴 mutation 은 후속 slice. 본 slice 는 그룹 패널 회귀 0 (불변).
- **`DifficultyModelSelector` 의 provider CRUD UI / 추가 mutation** — 본 slice 무관.
- **Admin+ RBAC gating UI** — Admin+ 미만 사용자에게 import/export 패널 (또는 Admin 화면 전체) 을 숨기는 gating. 본 slice 는 403 을 error props 로 안전 표시까지만 (④b·④c·④d 정책 유지) 하고 패널 숨김/접근 차단 UI 는 후속 (mutation 패널 일괄 조립 시) 결정.
- **공통 mutation hook 추출** (`useApiMutation` 등) — 본 slice 는 컨테이너 내부 async 러너로 처리 (④c `runAssign` / ④d `runExport` 정합). import 가 세 번째 async 러너이므로 공통 추출을 Follow-up 으로 평가 (지금 추출하면 cap·YAGNI 위배 — runAssign/runExport/runImport 세 사례로 패턴 확인 후 후속).
- **`view === 'superadmin-setup'` 분기 컨테이너 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선** — 후속 slice (이전 task Out of Scope 그대로 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **export 실 파일 저장 UX** — ④d export 응답 Blob→다운로드 트리거 (`URL.createObjectURL` + 가상 `<a download>`) + export scope 선택 UI + import 결과 상세 표시. 그 후 `SchedulePanel` 배선 / `ReEvaluationTriggerPanel` 배선 (backend `/api/assessments/reeval`·bulk `DELETE`·`/run` 완결 후) + `GroupMemberList` 멤버 add/remove mutation + Admin+ RBAC gating UI 일괄 결정. `runAssign`/`runExport`/`runImport` 세 async 러너 등장 → 공통 mutation hook (`useApiMutation`) 추출 평가. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너 (`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
