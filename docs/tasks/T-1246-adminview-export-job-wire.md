---
id: T-1246
title: AdminView handleExport 를 job-flow 로 배선 — runAdminExportJob 헬퍼 신설로 구 GET 모델 runExport 를 대체(구 코드 제거는 후속 slice)
phase: P6
status: DONE
mergedAs: f07da887
prNumber: 1138
reviewRounds: 1
commitMode: pr
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-export-contract-fix
dependsOn: [T-1245]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: P6 export-contract-fix stream — AdminView 최종 배선 slice 2/N. handleExport 를 job-flow(runExportJobDownload+runExportJob bind) 로 교체하는 exported 헬퍼 runAdminExportJob 신설. 구 runExport/buildExportPath 는 dead-but-exported 로 남겨 cap 준수(제거는 후속 slice). pr, ~200 LOC.
---

# T-1246 — AdminView handleExport 를 job-flow 로 배선 (runAdminExportJob 헬퍼 신설)

## Why

export 계약 drift-fix stream 이 T-1242(client primitive) → T-1243(`runExportJob` create→poll→download orchestration) → T-1244(terminal-token drift-guard) → T-1245(`runExportJobDownload` Response→blob→파일저장+state 전이 격리 러너) 로 hub 밖 plumbing 을 완성했다. 그러나 실사용 경로인 `AdminView.tsx` 의 `handleExport`(L3474)는 여전히 **구 GET 모델** `runExport(buildExportPath(selectedScope), { getRaw: requestRaw, ... })` 를 호출한다 — backend 에 plain `@Get('/api/admin/export')` 가 없어 실사용 시 **404 버그**다(api.md 는 job 기반 POST 모델).

본 slice 는 그 실 배선을 수행한다: `handleExport` 가 T-1245 의 `runExportJobDownload` 를 `runExportJob`(client 3-primitive 주입) 로 bind 해 호출하도록 교체한다. 다만 최종 배선은 4875-LOC hub `AdminView.tsx` + 9449-LOC `AdminView.test.tsx`(구 `runExport`/`buildExportPath` 단위 test ~18 `it`) 편집이라 300 LOC / 5 파일 cap 을 넘는다(T-1245 Follow-up 이 (a)배선 / (b)구 코드·dead-test 제거 로 split 예고). 그래서 본 slice(2/N)는 **(a) 배선만** 담당하고, 구 `runExport`/`ExportDeps`/`buildExportPath` 및 그 test 는 **exported 인 채로 그대로 남겨**(TS6133 미발생 — exported 심볼은 unused 로 flag 되지 않음, 기존 test 무회귀 pass) cap 안에 든다. 구 코드·dead-test 물리 제거는 **후속 slice(T-1247, 삭제 위주)**.

**왜 exported 헬퍼로 배선하나**: `handleExport` 는 컴포넌트 내부 `useCallback` 이라 렌더 없이 단위 검증이 어렵다. 구 `runExport` 가 exported 순수 함수라 jsdom 없이 검증됐던 것과 동형으로, job-flow 배선 로직을 **exported `runAdminExportJob(selectedScope, deps)`** + scope→입력 매퍼 `buildExportInput(selectedScope)` 로 뽑아 `handleExport` 는 그 1회 호출로 축약한다. 이로써 R-112 full cover 를 렌더 없이 확보한다.

## Required Reading

- `web/src/views/AdminView.tsx` L3444~3493 — **핵심 수정 지점**. 현 `handleExport`(L3474~3487, `runExport(buildExportPath(selectedScope), {...})` 호출)와 export state(`exporting`/`setExporting`/`setExportError`/`setExportMessage`/`selectedScope`). 본 slice 가 이 `handleExport` 본문을 `runAdminExportJob(selectedScope, {...})` 호출로 교체한다.
- `web/src/views/AdminView.tsx` L860~965 — **읽기만**. `browserDownloadDeps`(L962, 런타임 `createObjectURL`/`revokeObjectURL`/`clickAnchor`)·구 `runExport`(L924~957)·`ExportDeps`(L911) 흐름을 mirror 참조. **구 `runExport`/`ExportDeps`/`buildExportPath`(L258) 는 본 slice 에서 삭제 금지 — exported 인 채 그대로 둔다**(dead-but-exported, 제거는 T-1247).
- `web/src/api/exportJobDownload.ts` — **읽기만**. export 심볼 `runExportJobDownload(input, deps): Promise<void>`, 타입 `RunExportJobDownloadDeps`(`{ runJob, createObjectURL, revokeObjectURL, clickAnchor, describeError, exporting, setExporting, setExportError, setExportMessage }`). 본 배선의 최종 소비 지점.
- `web/src/api/exportJobFlow.ts` — **읽기만**. export 심볼 `runExportJob(input, deps, options?): Promise<Response>`, 타입 `ExportJobFlowDeps`·`RunExportJobOptions`. `runAdminExportJob` 이 `runExportJobDownload` 의 `runJob` dep 로 `(i) => runExportJob(i, {createExportJob,getExportJob,downloadExportJob}, options)` 를 bind.
- `web/src/api/exportJob.ts` — **읽기만**. `createExportJob`/`getExportJob`/`downloadExportJob` client 3-primitive + 타입 `CreateExportInput`(`{ scope?, dateRange?, entitySelector? }`). `buildExportInput` 이 `selectedScope` 를 이 타입으로 매핑(중복 타입 정의 금지 — import).
- `web/src/views/AdminView.test.tsx` L2898~3175 — **읽기만(참고)**. 구 `runExport`/`buildExportPath` 단위 test harness(`makeExportDeps`, `mockRawResponse`, deps 주입 convention). 본 slice 의 신규 `runAdminExportJob`/`buildExportInput` test 도 동일 colocated convention·deps 주입으로 작성. **이 구 describe 블록은 삭제 금지**(T-1247).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 **exported 순수 매퍼** `buildExportInput(selectedScope: string): CreateExportInput` 신설 — `selectedScope` 가 truthy 면 `{ scope: selectedScope }`, 빈 문자열(전체 선택) 이면 `{}`(scope 미부착) 반환. `CreateExportInput` 은 `../api/exportJob` 에서 import(재정의 금지).
- [ ] `web/src/views/AdminView.tsx` 에 **exported async 배선 헬퍼** `runAdminExportJob(selectedScope: string, deps): Promise<void>` 신설 — `runExportJobDownload(buildExportInput(selectedScope), { runJob: (i) => runExportJob(i, { createExportJob, getExportJob, downloadExportJob }, options), ...browser/부수효과/state deps })` 로 조립. `deps` 는 client 3-primitive(`createExportJob`/`getExportJob`/`downloadExportJob`) + `DownloadDeps` 동형(`createObjectURL`/`revokeObjectURL`/`clickAnchor`) + `describeError`/`exporting`/`setExporting`/`setExportError`/`setExportMessage`(+선택적 `RunExportJobOptions` passthrough `delay`/`maxPolls`)를 받는다. 매직 스트링·중복 상수 인라인 금지.
- [ ] `handleExport`(L3474) 를 `runAdminExportJob(selectedScope, { createExportJob, getExportJob, downloadExportJob, ...browserDownloadDeps, describeError: toErrorMessage, exporting, setExporting, setExportError, setExportMessage })` 호출로 교체. `useCallback` 의존성 배열은 기존과 동형(`[exporting, selectedScope]`) 유지.
- [ ] 배선 교체로 `handleExport` 가 더 이상 `requestRaw` 를 넘기지 않아 module-level `requestRaw` import 가 unused 가 되면 **L20 import 에서 `requestRaw` 제거**(TS6133 방어). `request`/`ApiError` 는 유지(다른 소비처 존재). 구 `runExport` 는 자체 `deps.getRaw` 를 쓰므로 module-level requestRaw 미참조 — 삭제해도 컴파일 OK.
- [ ] `buildExportInput`·`runAdminExportJob` 을 파일 하단 export 목록에 추가.
- [ ] **구 `runExport`/`ExportDeps`/`buildExportPath`/`browserDownloadDeps`/`parseFilename`/`triggerDownload` 및 그 test 는 삭제 0** — 본 slice 는 배선 추가 + handleExport 1줄 교체 + 죽은 requestRaw import 정리만. 물리 제거는 T-1247.
- [ ] **backend·prisma/schema.prisma·exportJob.ts·exportJobFlow.ts·exportJobDownload.ts·api.md 수정 0** — 권위 계약이며 web 이 정합 대상.
- [ ] **Happy-path test 1+**: `runAdminExportJob('', deps)` 로 — mock `createExportJob`(job resolve)→`getExportJob`(SUCCEEDED)→`downloadExportJob`(content-disposition 포함 Response) 주입 시, `createExportJob` 이 `buildExportInput('')`(=`{}`) 로 1회 호출 + blob→`createObjectURL`·`clickAnchor` 각 1회(파일저장) + `setExportMessage(완료문구)` + `setExporting(true)`→`setExporting(false)` 순서 + `setExportError` 미호출을 검증. `delay` mock 주입해 실 타이머 미대기.
- [ ] **Error path test 각 1+**(throw 없이 state 표면화): (a) `createExportJob` reject(403) → `setExportError(toErrorMessage 파생 문구)` + 파일저장 부수효과 미호출 + `setExporting(false)`. (b) poll 결과 terminal `FAILED` → `setExportError` + 다운로드 미호출 + `setExporting(false)`. (c) `downloadExportJob` reject → 동일하게 error 표면화 + `setExporting(false)`.
- [ ] **Flow/branch cover + negative 충분**: (1) **scope 매핑 분기** — `runAdminExportJob('persons', deps)` 시 `createExportJob` 이 `{ scope: 'persons' }` 로 호출됨을 별도 `it` 로 검증(truthy 분기). (2) `buildExportInput` 단위 test — truthy→`{scope}`·빈 문자열→`{}` 각 `it`. (3) **동시 재호출 가드** — `exporting: true` 로 호출 시 `createExportJob`·setter 전부 미호출(즉시 return) 검증(runExportJobDownload 가드 전파 확인). (4) **filename fallback 경계** — download Response 에 content-disposition 없음 → 기본 파일명으로 `clickAnchor` 호출됨 검증. (5) `setExporting` 이 성공·실패·가드 경로별로 올바르게 토글(가드 경로 미토글) 됨을 경로별 `it` 분리(단일 거대 assert 금지).
- [ ] **기존 AdminView 단위 test 무회귀** — 구 `runExport`/`buildExportPath` describe(~18 `it`) 는 그대로 pass(구 심볼 미변경). 정적 렌더 회귀 test 도 pass(`requestRaw` import 제거가 렌더에 영향 0).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 전체 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 0, 타입 에러 0). web coverageThreshold 는 T-1165 게이트로 미강제이나 `buildExportInput`·`runAdminExportJob` 전 분기(성공/각 error/가드/scope 매핑/filename fallback)를 신규 test 로 충분 cover.

## Out of Scope

- **구 `runExport`/`ExportDeps`/`buildExportPath`/`getRaw`/`browserDownloadDeps`/`parseFilename`/`triggerDownload` 물리 제거 금지** — 및 그 colocated test(~18 `it`) 삭제 금지. dead-but-exported 로 남겨 cap 준수. 제거는 **후속 slice T-1247**(삭제 위주 — cap 상 test 삭제 slice 와 src 삭제 slice 추가 분할 검토는 planner).
- **exportJob.ts·exportJobFlow.ts·exportJobDownload.ts 수정 금지** — 확정 계약(T-1242/T-1243/T-1245). 본 slice 는 그 위 조립만.
- **backend `export.controller.ts`·`export-job.service.ts`·`prisma/schema.prisma`·api.md 수정 금지** — 권위 계약.
- **filename/기본명/완료문구 dedup 금지** — hub 의 구 `parseFilename`/`DEFAULT_EXPORT_FILENAME`/`EXPORT_DONE_TEXT`(현재 exportJobDownload.ts 로컬 판과 중복) 를 공용 모듈로 추출·전환하는 dedup 은 구 코드 제거(T-1247) 안정화 후 별도 Follow-up.
- **import 측(`POST /api/admin/import`) 대칭 배선 금지** — export 배선 완결 후 별도 Follow-up.
- **UX(토스트·진행률·`DataImportExportPanel` 렌더 확장) 금지** — 본 slice 는 handleExport 배선 + state setter 결선까지.
- **exportJobDownload.ts `parseFilename` reviewer nit 처리 금지** — 별도 파일(`exportJobDownload.test.ts`)이라 본 slice(AdminView 집중)와 file/module 분리. Follow-up 으로 이연.
- **cap 유의**: AdminView.tsx(+~35/-~12) + AdminView.test.tsx(+~150) ≈ 200 LOC / 2 파일. 300 LOC / 5 파일 여유. 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청(예: `buildExportInput` slice 분리).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **후속 slice(필수, T-1247 — 구 코드·dead-test 제거)**: 구 `runExport`/`ExportDeps`/`buildExportPath`/`getRaw` 사용부/관련 export 및 `AdminView.test.tsx` 의 구 `runExport`(~13 `it`)·`buildExportPath`(~4 `it`) describe 블록 삭제로 실 export 404 버그 잔재 청소. 삭제 위주라 diff ~380 LOC 예상 → cap 상 (a) test 삭제 slice / (b) src 삭제 slice 분할 또는 sizeExempt(삭제-only 저위험) 검토는 planner. **주의**: src·test 삭제는 orphaned reference 방지 위해 동시에 처리해야 함(src 만 삭제 시 test 가 삭제된 export 참조 → build fail).
- **reviewer nit(T-1245/PR #1137)**: `web/src/api/exportJobDownload.ts` 의 `parseFilename` malformed percent-encoding(`decodeURIComponent` catch) fallthrough 분기 미검증 → `exportJobDownload.test.ts` 에 regression test 1건 추가(잘못된 `%` 인코딩 filename → catch fallthrough → 안전 fallback 검증). 별도 파일이라 본 slice 와 file-disjoint — 별도 소형 task 또는 T-1247 에 fold.
- 후보: hub `parseFilename`/`triggerDownload`/기본명·완료문구를 공용 `web/src/api/exportDownload.ts` 로 추출해 hub·exportJobDownload.ts 가 함께 import(중복 제거) — 구 코드 제거 안정화 후.
- 후보: import 측 대칭 orchestration(`runImportJob` + 다운로드 대칭) — export 배선 완결 후.
