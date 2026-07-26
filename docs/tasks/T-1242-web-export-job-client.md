---
id: T-1242
title: web export-job API client 모듈 신설 — job 기반 POST 계약(api.md 124)에 맞춘 순수 client helper
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-export-contract-fix
dependsOn: []
touchesFiles: [web/src/api/exportJob.ts, web/src/api/exportJob.test.ts]
plannerNote: P6 — T-1241 Follow-up(export 계약 drift). web 은 GET /api/admin/export 를 부르나 api.md124+backend 은 POST job 모델(plain @Get 없음 → 현재 404). 첫 slice=isolated job-기반 client 모듈 신설(AdminView 무접촉 file-disjoint). AdminView 배선은 후속 slice. pr.
---

# T-1242 — web export-job API client 모듈 신설 (job 기반 POST 계약 정합)

## Why

방금 완결된 `p6-group-member-add` stream(T-1237~T-1241) 이후, T-1241 이 명시적으로 defer 한 Follow-up(admin export 계약 drift)을 처리하는 stream 의 **첫 slice** 다.

**확인된 drift(설계 모호 아님 — 정합 대상 명확)**: web `AdminView.tsx`(L172~260 부근)는 평가 자료 export 를 `GET /api/admin/export`(`ADMIN_EXPORT_PATH` + `requestRaw`/`getRaw`, 단일-GET Blob 다운로드 모델)로 호출한다. 그러나 **api.md 124 행**(`POST /api/admin/export`, `CreateExportDto` body, REQ-032·REQ-030)과 **backend `@Controller("api/admin/export")`**(`src/export/export.controller.ts` L138~ — `@Post()` job 생성 / `@Get("running")` / `@Get(":id")` 상태 / `@Get(":id/download")` streaming / `@Get(":id/status-view")`, **plain `@Get()` 없음**)은 **job 기반 POST 모델**이다. 즉 web 의 `GET /api/admin/export`(id 없음)는 어떤 backend route 에도 매칭되지 않아 **현재 404** — export 버튼이 동작하지 않는 실사용 버그다. api.md 와 backend 가 서로 일치하므로 **정합의 정답은 web 을 job 기반 POST 모델로 교정**하는 것이다(권위 = api.md 124 + backend controller).

교정 자체는 4875-LOC 의 hub 파일 `AdminView.tsx`(컨테이너 fetch 로직 소재)를 건드려야 하므로 한 번에 하면 크고 위험하다. 그래서 **bottom-up 분해**한다: 본 첫 slice 는 job 기반 export 계약을 구현하는 **격리된 순수 client 모듈**(`web/src/api/exportJob.ts`)과 그 spec 을 신설하되 **AdminView 배선은 하지 않는다**(후속 slice). 이렇게 하면 `AdminView.tsx` 와 **file-disjoint** 하고(fine-grained concurrency stage 5b 하 다른 driver 작업과 무충돌), 순수 client 함수라 R-112 4종(happy/error/branch/negative)을 완전 cover 하며, 다음 slice 는 `runExport` 를 이 모듈 호출로 교체하기만 하면 되는 깨끗한 접합면을 남긴다.

## Required Reading

- `web/src/api/apiClient.ts` — 기존 client primitive. 특히: (a) `request<T>(path, options): Promise<T>`(L110) — 2xx body 파싱 반환, 비-2xx → `ApiError` throw, 네트워크 실패 → `ApiError`. (b) `requestRaw(path, options): Promise<Response>`(L124) — 본문 미파싱 raw `Response` 반환(Blob/스트리밍 다운로드용). (c) `RequestOptions` 타입(L132 export) — `method`/`body` 등. (d) export 되는 심볼: `request`, `requestRaw`, `ApiError`, `RequestOptions`(L131~132). 본 모듈은 이 primitive 위에 job 계약을 조립한다(fetch/refresh/credentials 정책 재구현 금지 — 재사용).
- `src/export/export.controller.ts` L138~460 — **읽기만**(backend 계약 참조, import 금지 — web/backend 별도 빌드). 정합 대상 route: `@Post()` create(`CreateExportDto` body `{ scope, dateRange?, entitySelector? }` → `ExportJob` 반환, status=PENDING) / `@Get("running")` → `ExportJob[]` / `@Get(":id")` → `ExportJob`(상태 조회) / `@Get(":id/download")` → streaming dump(raw). RBAC Admin+ (401/403 은 client 가 `ApiError` 로 표면화).
- `docs/architecture/api.md` L124~125 — **읽기만**. `POST /api/admin/export`(`CreateExportDto`, Admin+) 권위 계약 + `POST /api/admin/import`(대칭 참고). 본 모듈 상수 경로/DTO 필드명은 이 표기에 정합한다.
- `web/src/views/AdminView.tsx` L172~260 — **읽기만**(교정 대상 소재 확인용, 본 task 는 수정 금지). `ADMIN_EXPORT_PATH='/api/admin/export'`(L177)·`buildExportPath`(L258)·`EXPORT_SCOPE_QUERY_KEY`(L181)·`runExport`(현 GET 모델) 을 참고해 새 모듈의 경로/scope 표현을 정합시킨다(다음 slice 가 이 helper 들을 신모듈 호출로 교체).
- `web/src/api/auth.ts` — 기존 도메인별 client 모듈(`request` 위에 named 함수 + 경로 상수 조립)의 신설 관례(경로 상수 top-level `const`, named 함수 export, 최소 구조적 타입) mirror 대상.

## Acceptance Criteria

- [ ] `web/src/api/exportJob.ts` 신설 — top-level 경로 상수 `EXPORT_BASE_PATH = '/api/admin/export'` + 다음 named 함수를 `request`/`requestRaw` 위에 조립해 export 한다:
  - `createExportJob(input: CreateExportInput): Promise<ExportJob>` — `POST /api/admin/export`, body = `input`(`{ scope?, dateRange?, entitySelector? }`, api.md 124 `CreateExportDto` 정합). 반환 = 생성된 `ExportJob`(id·status 포함).
  - `getExportJob(id: string): Promise<ExportJob>` — `GET /api/admin/export/${encodeURIComponent(id)}` 상태 조회.
  - `listRunningExportJobs(): Promise<ExportJob[]>` — `GET /api/admin/export/running`.
  - `downloadExportJob(id: string): Promise<Response>` — `GET /api/admin/export/${encodeURIComponent(id)}/download` 를 `requestRaw` 로(Blob/스트리밍 raw Response). 호출측이 `response.blob()`/헤더로 소비.
- [ ] 최소 구조적 타입 `ExportJob`(최소 `{ id: string; status: string }`, 필요 필드만) + `CreateExportInput`(`{ scope?: string; dateRange?: unknown; entitySelector?: unknown }`) 을 web-local 로 정의·export 한다 — **backend 타입 import 금지**(web/backend 별도 빌드, 수동 동기 trade-off — AdminView L204 convention 계승). 필드명은 backend snake/camel 표기 그대로.
- [ ] 각 함수는 fetch/refresh/credentials/401 재시도/비-2xx→`ApiError` 정책을 **재구현하지 않고** `request`/`requestRaw` 에 위임한다(중복 0). `id` 는 항상 `encodeURIComponent` 로 인코딩(경로 인젝션/비정상 문자 방어).
- [ ] **AdminView.tsx·기존 컴포넌트·backend 는 읽기만, 수정 0** — 본 slice 는 신규 파일 2개만 추가. `runExport`·`ADMIN_EXPORT_PATH`·`buildExportPath` 교체는 다음 slice(Follow-up).
- [ ] **Happy-path test 1+ (각 함수)**: `request`/`requestRaw` 를 mock 해 — (a) `createExportJob({scope:'...'})` 가 `POST` + 정확한 path + body 로 1회 호출되고 반환 job 을 그대로 resolve, (b) `getExportJob('job-1')` 가 `GET /api/admin/export/job-1` 로 호출·job resolve, (c) `listRunningExportJobs()` 가 `GET .../running` 로 배열 resolve, (d) `downloadExportJob('job-1')` 가 `requestRaw` 를 `GET .../job-1/download` 로 호출·raw `Response` resolve 를 각각 검증.
- [ ] **Error path test 각 1+**: 각 함수에서 하위 `request`/`requestRaw` 가 `ApiError`(예: 403 Admin+ 미달, 404, 네트워크 실패)를 reject 하면 그 error 가 **swallow 없이 그대로 전파**됨을 검증(예: `await expect(createExportJob(...)).rejects.toThrow`). client 가 자체 try/catch 로 삼키지 않음.
- [ ] **Flow/branch cover + negative cases 충분**: (1) `id` 에 특수문자(예: `'a/b?c'`) 전달 시 `encodeURIComponent` 로 인코딩된 path 로 호출됨(경로 오염 방지) — `getExportJob`·`downloadExportJob` 각각. (2) `createExportJob` 를 `scope` 미전달(`{}`)로 호출 시 빈 body 로 정상 POST(backend 기본 scope 위임 — 빈 입력 경계값). (3) `listRunningExportJobs` 가 빈 배열 resolve 를 정상 통과(매칭 0 경계값). (4) `downloadExportJob` 는 `request`(body 파싱)가 아니라 `requestRaw` 를 쓴다는 것(Blob 소비 정합)을 mock 호출 대상으로 구분 검증.
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0, 타입 에러 0). web coverageThreshold 는 T-1165 게이트로 미강제이나 신규 4 함수 전 분기를 신규 test 로 충분 cover.

## Out of Scope

- **AdminView.tsx 수정 금지** — `runExport`/`ADMIN_EXPORT_PATH`/`buildExportPath` 를 신모듈 호출로 교체하는 배선은 **다음 slice(Follow-up)**. 본 task 는 격리된 client 모듈 + spec 신설만(AdminView file-disjoint 유지).
- **DataImportExportPanel.tsx 수정 금지** — presentational 패널 계약은 불변. export 진행률/폴링 UX 는 본 slice 미포함.
- import 측(`POST /api/admin/import`) client 모듈은 본 slice 미포함(export 만) — 필요 시 대칭 Follow-up.
- job 상태 polling loop(status=PENDING→RUNNING→DONE 반복 조회)·다운로드 저장(Blob→파일) UX·토스트는 본 slice 미포함 — client primitive(단발 함수)만 제공, orchestration 은 배선 slice 책임.
- backend `export.controller.ts`·`export-job.service.ts`·api.md 수정 금지 — 이들이 권위 계약이며 web 이 정합 대상. api.md 는 이미 job 모델을 정확히 문서화(수정 불요).
- 다른 P6 deferred 잔여(EvaluationGuardBanner 자동 polling 등) 배선 금지.
- **cap 유의**: 신규 파일 2개(`exportJob.ts` 약 90 LOC + `exportJob.test.ts` 약 140 LOC) ≈ 230 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청(예: download/running 함수를 후속 slice 로 분리).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 다음 slice(필수): `AdminView.tsx` 의 `runExport` 를 신 `exportJob.ts`(POST create → job id 확보 → status 조회/폴링 → `downloadExportJob` → Blob 저장) 호출로 교체해 실제 export 버그(GET 404) 를 해소. hub 파일이므로 scope 를 export 경로로만 좁혀 cap 준수.
- 후보: import 측 대칭 client 모듈(`importJob.ts`, `POST /api/admin/import` multipart) — export 배선 안정화 후.
- 후보: web↔backend export 계약 drift-guard spec(T-1234~T-1236 패턴) — 신모듈 경로가 backend route 표기와 일치하는지 기계 검증하는 회귀 앵커.
