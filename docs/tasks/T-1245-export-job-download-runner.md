---
id: T-1245
title: export job-flow 다운로드 러너 신설 — runExportJob 결과 Response 를 blob→파일저장 + state 전이로 합성(격리 순수 함수)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-export-contract-fix
dependsOn: [T-1243]
touchesFiles: [web/src/api/exportJobDownload.ts, web/src/api/exportJobDownload.test.ts]
plannerNote: P6 export-contract-fix stream — AdminView 최종 배선 slice 를 cap 안으로 분해한 1/N. runExportJob 결과 Response 를 blob→파일저장+state 전이로 합성하는 격리 러너 신설(AdminView.tsx 무접촉 file-disjoint). 배선은 다음 slice. pr.
---

# T-1245 — export job-flow 다운로드 러너 신설 (Response → blob→파일저장 + state 전이 합성)

## Why

T-1242(client primitive) → T-1243(`runExportJob` create→poll→download orchestration) → T-1244(terminal-token drift-guard) 로 job 기반 export 계약의 plumbing 이 완성됐다. 남은 gap 은 **AdminView.tsx 의 실제 배선** — 현 `handleExport`(L3474)가 부르는 구 GET 모델 `runExport`(L924, `getRaw` 단발 GET → 404 실사용 버그)를 job-flow(`runExportJob`) 로 교체하는 것이다.

그러나 그 최종 배선은 **4875-LOC hub 파일 `AdminView.tsx` 편집 + `AdminView.test.tsx`(9449 LOC, export 관련 ~40 `it`) 대규모 재작업**이라 300 LOC / 5 파일 cap 을 넘고, concurrency-hot hub 파일 직접 편집이라 위험하다(T-1243 Why 가 명시한 격리 근거와 동일). 그래서 배선 slice 를 **cap 안으로 분해**한다 — 본 task 는 그 **1번째 slice**로, 배선에 필요한 마지막 합성 조각(`runExportJob` 이 resolve 하는 다운로드 `Response` → `response.blob()` → 파일명 파싱 → 파일저장 + export state 전이)을 **AdminView.tsx 와 file-disjoint 한 격리 deps-주입 순수 함수** `runExportJobDownload` 로 신설한다.

**왜 격리 러너로 먼저 짓는가**: 구 `runExport`(L924~957)는 `getRaw` GET → `response.blob()` → filename → `triggerDownload` → state 전이(setExporting/setExportError/setExportMessage) 를 한 몸으로 수행한다. job-flow 판은 GET 대신 `runExportJob`(create→poll→download) 로 Response 를 얻는 점만 다르고 그 뒤(blob→파일저장+state 전이)는 동일하다. 이 "Response → 파일저장 + state" 합성을 T-1243 이 `runExportJob` 을 hub 밖에서 지은 것과 동형으로 hub 밖에서 지어 완전 R-112 cover 하면, 다음(배선) slice 는 `handleExport` 가 이 러너 1회 호출로 축약되어 hub 편집·test 재작업이 최소화된다. 본 slice 는 AdminView 를 전혀 건드리지 않으므로 fine-grained concurrency stage 5b 하에서도 무충돌이다.

## Required Reading

- `web/src/api/exportJobFlow.ts` — 전량(85 LOC). 본 러너가 조립하는 상위 orchestration. export 심볼 `runExportJob(input, deps, options?): Promise<Response>`(성공 시 다운로드 `Response` resolve, FAILED/timeout/각 primitive reject 는 throw 전파), 타입 `ExportJobFlowDeps`·`RunExportJobOptions`. **본 러너는 `runExportJob` 을 직접 import 강결합하지 말고 `runJob: (input) => Promise<Response>` deps 로 주입**(다음 배선 slice 가 실 `runExportJob(input, flowDeps, options)` 을 bind 해 주입 — 단위 test 는 poll 로직 재검증 없이 합성/전이만 격리 검증).
- `web/src/api/exportJob.ts` — **읽기만**. 타입 `CreateExportInput`(`{ scope?, dateRange?, entitySelector? }`) 를 본 러너 입력 타입으로 재사용(중복 정의 금지 — import).
- `web/src/views/AdminView.tsx` L864~957 — **읽기만(수정 0)**. 구 `runExport`(L924~957)의 blob→파일저장+state 전이 흐름과 `DownloadDeps`(L870~878: `createObjectURL`/`revokeObjectURL`/`clickAnchor`)·`triggerDownload`(L883~)·`parseFilename`(content-disposition 파싱)·`DEFAULT_EXPORT_FILENAME`·`EXPORT_DONE_TEXT`·`exporting` 가드 를 **mirror 대상**으로 참조. 본 러너는 동일 흐름을 job-flow Response 로 수행하되, DOM/URL 부수효과는 **`DownloadDeps` 동형 객체를 주입**받아 jsdom 없이 검증한다. filename 파싱·기본명·완료 문구는 hub import 대신 **본 모듈 로컬 소형 helper/상수**로 둔다(hub 무접촉 유지 — 중복 제거 dedup 은 배선 slice Follow-up).
- `web/src/api/exportJobFlow.test.ts` — **읽기만(참고)**. 같은 디렉토리 colocated spec 관례(vitest `describe`/`it`, mock deps 주입, 실 타이머 미대기) 정합용.

## Acceptance Criteria

- [ ] `web/src/api/exportJobDownload.ts` 신설 — deps-주입 순수 async 러너 `runExportJobDownload(input: CreateExportInput, deps: RunExportJobDownloadDeps): Promise<void>` 를 export.
  - `RunExportJobDownloadDeps`(권장) = `{ runJob: (input: CreateExportInput) => Promise<Response>; createObjectURL; revokeObjectURL; clickAnchor; describeError: (e: unknown) => string; exporting: boolean; setExporting; setExportError; setExportMessage }`(`createObjectURL`/`revokeObjectURL`/`clickAnchor` 는 AdminView `DownloadDeps` 시그니처 동형).
  - 흐름(구 `runExport` mirror, GET→job-flow 만 교체): (1) `exporting` true 면 미발사(동시 재호출 가드 — 이중 job 생성·중복 다운로드 차단) → (2) `setExporting(true)` + `setExportError(undefined)` + `setExportMessage(undefined)`(재발화 시 직전 error/message 정리) → (3) `runJob(input)` 로 다운로드 `Response` 획득 → `response.blob()` → content-disposition filename 파싱(없으면 기본명 fallback) → 파일저장(`createObjectURL`→`clickAnchor`→`finally revokeObjectURL` 정리) → 완료 문구 `setExportMessage` → (4) catch: `setExportError(describeError(e))`(throw 없이 표면화) → (5) `finally setExporting(false)`.
- [ ] filename 파싱 helper·`DEFAULT_EXPORT_FILENAME`·완료 문구 상수는 **본 모듈 로컬**(hub import 0). 매직 스트링 인라인 금지.
- [ ] **AdminView.tsx·exportJobFlow.ts·exportJob.ts·backend·prisma/schema.prisma 수정 0** — 본 slice 는 신규 파일 2개만 추가. `handleExport` 배선 교체·구 `runExport` 제거는 다음 slice.
- [ ] **Happy-path test 1+**: mock deps 로 — `runJob` 이 성공 `Response`(content-disposition 헤더 포함) resolve → `runExportJobDownload` 가 `blob()` → filename 파싱 → `createObjectURL`·`clickAnchor` 각 1회 호출(파일저장) → `setExportMessage(완료문구)` 호출, 그리고 `setExporting(true)`→`setExporting(false)` 순서·`setExportError` 미호출(성공)을 검증.
- [ ] **Error path test 각 1+**(throw 없이 state 로 표면화): (a) `runJob` 이 reject(예: `runExportJob` timeout / FAILED / 403 create reject) → `setExportError(describeError(e))` 호출 + 파일저장 부수효과(`createObjectURL`/`clickAnchor`) 미호출 + `setExporting(false)` 보장. (b) `response.blob()` 이 reject → 동일하게 error 표면화 + `setExporting(false)`. (c) `describeError` 가 파생한 문구가 `setExportError` 로 그대로 전달됨을 검증(문구 파생 결선).
- [ ] **Flow/branch cover + negative 충분**: (1) **동시 재호출 가드** — `exporting: true` 로 호출 시 `runJob`·setter 전부 미호출(즉시 return) 검증. (2) **filename fallback 경계** — content-disposition 헤더 없음/파싱 실패 시 `DEFAULT_EXPORT_FILENAME` 으로 `clickAnchor` 호출됨을 검증(헤더 있음 분기와 별도 `it`). (3) **자원 정리 보장** — `clickAnchor` 가 throw 해도 `revokeObjectURL` 이 호출됨(finally 정리 — URL 누수 0)을 검증. (4) **빈/0-byte blob** 도 throw 없이 저장 흐름 통과(빈 Blob 안전 수용). (5) `setExporting` 이 성공·실패·가드 각 경로에서 올바르게 토글(가드 경로는 미토글, 실행 경로는 true→false)됨을 경로별 `it` 로 분리(단일 거대 assert 금지).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0, 타입 에러 0). web coverageThreshold 는 T-1165 게이트로 미강제이나 `runExportJobDownload` 의 전 분기(성공/각 error/가드/filename fallback/자원정리)를 신규 test 로 충분 cover.

## Out of Scope

- **AdminView.tsx 배선 금지** — `handleExport`(L3474)를 `runExportJobDownload` 호출로 교체 + 구 `runExport`/`ExportDeps`/`getRaw` 제거 + `AdminView.test.tsx` 의 구 GET 모델 export test(~40 `it`) 재작업은 **다음 slice(Follow-up)**. 본 task 는 그와 file-disjoint 한 격리 러너 + spec 신설만.
- **exportJobFlow.ts·exportJob.ts 수정 금지** — 이미 확정된 계약(T-1242/T-1243). 본 러너는 그 위에 조립만(deps 주입).
- **backend `export.controller.ts`·`export-job.service.ts`·`prisma/schema.prisma`·api.md 수정 금지** — 권위 계약이며 web 이 정합 대상.
- **filename/기본명/완료문구 dedup 금지** — hub(`AdminView.tsx`)의 `parseFilename`/`DEFAULT_EXPORT_FILENAME`/`EXPORT_DONE_TEXT`·`triggerDownload`/`DownloadDeps` 와 본 모듈 로컬 정의의 중복 제거(공용 모듈 추출 후 hub import 전환)는 hub 편집을 유발하므로 **배선 slice 에서 함께** 처리(별도 Follow-up). 본 slice 는 hub 무접촉 우선.
- **import 측(`POST /api/admin/import`) 대칭 러너 금지** — export 배선 안정화 후 별도 Follow-up.
- **UX(토스트·진행률·`DataImportExportPanel` 렌더) 금지** — 본 러너는 state setter 호출까지만. 패널 렌더 배선은 배선 slice 책임.
- **cap 유의**: 신규 파일 2개(`exportJobDownload.ts` 약 90 LOC + `exportJobDownload.test.ts` 약 160 LOC) ≈ 250 LOC. 300 LOC / 5 파일 여유. 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청(예: 자원정리/빈-blob negative 를 후속 slice 로 분리).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **다음 slice(필수, 최종 배선)**: `AdminView.tsx` 의 `handleExport` 를 `runExportJobDownload(input, { runJob: (i) => runExportJob(i, { createExportJob, getExportJob, downloadExportJob }), ...browserDownloadDeps, describeError, exporting, setExporting, setExportError, setExportMessage })` 호출로 교체 → 구 `runExport`/`ExportDeps`/`getRaw`/`buildExportPath`(GET 전용) 및 관련 dead test 제거로 실제 export 404 버그 최종 해소. hub 편집 + `AdminView.test.tsx` 재작업이라 **cap 상 추가 split 검토**(예: (a) handleExport 배선 + 신규 test, (b) 구 runExport·dead test 제거). scope 조립(selectedScope → `CreateExportInput`) 매핑도 이 slice 에서 확정. planner 가 슬라이싱 판단.
- 후보: hub `parseFilename`/`triggerDownload`/`DownloadDeps`/기본명·완료문구를 공용 `web/src/api/exportDownload.ts` 로 추출해 hub·본 러너가 함께 import(중복 제거) — 배선 slice 안정화 후.
- 후보: import 측 대칭 orchestration(`runImportJob` + 다운로드 대칭) — export 배선 완결 후.
