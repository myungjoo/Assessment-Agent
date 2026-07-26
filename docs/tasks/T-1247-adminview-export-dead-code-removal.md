---
id: T-1247
title: AdminView 구 GET 모델 export 죽은코드 제거 — runExport/ExportDeps/buildExportPath 및 그 dead unit test 물리 삭제(src+test atomic)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 490
estimatedFiles: 2
created: 2026-07-26
sizeExempt: true
exemptReason: 순수 dead-code 삭제 slice — runExport/ExportDeps/buildExportPath 및 그 dead unit test(~419 LOC) 제거로 삭제분이 ~490 LOC 이나 신규/변경 로직 0. src(export)·test(import) 를 동시에 제거하지 않으면 orphan-reference build fail(T-1246 Follow-up 경고)이라 atomic 1 slice 강제 → cap 상 test-only/src-only 분할이 오히려 build 를 깨므로 sizeExempt 로 atomic 처리. 2 파일(≤5), 위험은 build+full-suite green 게이트로 즉시 검증.
independentStream: p6-export-contract-fix
dependsOn: [T-1246]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: P6 export-contract-fix stream 배선 slice 3/N(삭제). T-1246 배선 완료로 dead-but-exported 가 된 구 GET 모델 runExport/ExportDeps/buildExportPath + dead test 물리 제거. sizeExempt(삭제-only, src+test atomic 로 orphan-ref 방지). pr, ~490 LOC 삭제 2파일.
---

# T-1247 — AdminView 구 GET 모델 export 죽은코드 제거 (runExport/ExportDeps/buildExportPath + dead test)

## Why

export 계약 drift-fix stream 은 T-1242(client primitive) → T-1243(orchestration) → T-1244(terminal-token drift-guard) → T-1245(download 러너) → T-1246(AdminView `handleExport` 를 job-flow 로 배선 — `runAdminExportJob`/`buildExportInput` 신설)까지 실 배선을 완결했다. 그 결과 구 GET 모델 `runExport(buildExportPath(scope), { getRaw, ... })` 경로는 **더 이상 어느 caller 도 호출하지 않는 dead-but-exported 코드**로 남았다(T-1246 은 300 LOC / 5 파일 cap 준수를 위해 삭제를 후속 slice 로 명시 이연 — T-1246 Follow-up).

본 slice(3/N)는 그 잔재를 물리 제거한다: 구 `runExport`/`ExportDeps`/`buildExportPath`(+ `getRaw`)와 그 dead unit test(구 GET 모델 검증 3 describe 블록, ~19 `it`)를 삭제해 실 export 404 버그의 죽은 흔적을 청소한다. **src(export 선언)와 test(import·describe)를 반드시 같은 commit 에서 동시에 삭제**한다 — src 만 먼저 삭제하면 test 가 삭제된 export 를 import 해 build fail(T-1246 Follow-up 이 명시 경고한 orphan-reference)이기 때문이다.

## Required Reading

- `web/src/views/AdminView.tsx` L268~278 — **삭제 대상 1**. 구 `buildExportPath(scope)` 순수 helper(L271~276) + 그 위 주석. job-flow 는 scope 를 query 가 아니라 POST body(`buildExportInput`)로 싣는다 — `buildExportPath` 는 이제 미참조.
- `web/src/views/AdminView.tsx` L905~960 — **삭제 대상 2**. 구 `ExportDeps` interface(L924~935, `getRaw`/`DownloadDeps` 확장)와 구 `runExport(path, deps)` async 러너(L937~960). 둘 다 T-1246 배선 후 미참조.
- `web/src/views/AdminView.tsx` L4861~4931 (export 블록) — **삭제 대상 3**. `export { ... }` 안의 `buildExportPath`(L4877)·`runExport`(L4884), `export type { ... }` 안의 `ExportDeps`(L4930) 항목 3줄 제거. **주의: `parseFilename`(L4881)·`triggerDownload`(L4882)·`DownloadDeps`·`browserDownloadDeps` 는 삭제 금지**(아래 Out of Scope 참조).
- `web/src/views/AdminView.tsx` L975~990 (읽기만) — `browserDownloadDeps` 는 신규 `runAdminExportJob`(L3563 `...browserDownloadDeps`)가 **여전히 사용** → 삭제 금지. `DownloadDeps` interface(L883)도 `browserDownloadDeps`·`triggerDownload`·`RunExportJobDownloadDeps` 소비처 존재 → 삭제 금지.
- `web/src/views/AdminView.test.tsx` L68~120 (import 블록) — **삭제 대상 4**. value import 에서 `buildExportPath`(L78)·`runExport`(L85), type import 에서 `ExportDeps`(L128) 3줄 제거. **`buildExportInput`/`runAdminExportJob`/`parseFilename`/`triggerDownload`/`DownloadDeps`/`RunAdminExportJobDeps` import 은 유지**(신규 job-flow test·잔존 exported 심볼이 참조).
- `web/src/views/AdminView.test.tsx` L2904~3156 — **삭제 대상 5**. `describe('AdminView — onExport 실 GET export + Blob 다운로드 (④f runExport)')` 블록 전체(~13 `it`, `makeExportDeps`/`EXPORT_PATH` 로컬 포함). 위 관련 주석(L2904~2910)도 함께.
- `web/src/views/AdminView.test.tsx` L3158~3188 — **삭제 대상 6**. `describe('AdminView — buildExportPath (순수 함수, ④g)')` 블록 전체(~4 `it`) + 위 주석.
- `web/src/views/AdminView.test.tsx` L3392~3541 — **삭제 대상 7**. `describe('AdminView — scope query 부착 export (④g runExport path 주입)')` 블록 전체(~구 `runExport`/`buildExportPath` 사용, `makeExportDeps` 로컬 포함) + 위 주석(L3392~3396). **바로 다음 `describe('AdminView — ④g scope 선택 select 배선 (정적 렌더)')`(L3546~)는 정적 렌더 test 라 삭제 금지**(구 GET 모델 무관).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에서 구 `buildExportPath`(순수 helper) 정의·`ExportDeps` interface·`runExport` async 러너 3 심볼을 물리 삭제한다.
- [ ] `web/src/views/AdminView.tsx` 의 `export { ... }`·`export type { ... }` 블록에서 `buildExportPath`·`runExport`·`ExportDeps` 항목을 제거한다(삭제된 심볼을 export 하면 build fail).
- [ ] `web/src/views/AdminView.test.tsx` 에서 위 3 심볼의 value/type import 항목(`buildExportPath`·`runExport`·`ExportDeps`)을 제거하고, 구 GET 모델 검증 3 describe 블록(④f `runExport` · `buildExportPath` 순수함수 · ④g `runExport path 주입`)을 전부 삭제한다.
- [ ] **동시-삭제(atomic) 준수** — src 삭제와 test 삭제를 같은 commit 에 담는다. src-only 선삭제로 test 가 삭제된 export 를 참조하는 중간 상태를 만들지 않는다.
- [ ] **삭제 대상 외 export 심볼 무접촉** — `parseFilename`·`triggerDownload`·`DownloadDeps`·`browserDownloadDeps`·`buildExportInput`·`runAdminExportJob`·`RunAdminExportJobDeps` 는 삭제·서명 변경 0. 특히 `browserDownloadDeps` 는 `runAdminExportJob` 이 여전히 소비하므로 삭제 시 실 배선 붕괴.
- [ ] **newly-unused 심볼 sweep(TS6133 방어)** — 구 심볼 삭제로 어떤 import/const 가 **오직 삭제분에서만** 참조됐다면(예: `ExportDeps` 가 쓰던 `RequestOptions` type import, `buildExportPath` 가 쓰던 `ADMIN_EXPORT_PATH`/`EXPORT_SCOPE_QUERY_KEY` 상수) 그 심볼이 파일 내 다른 곳에서 미참조인지 grep 으로 확인 후, 미참조면 함께 제거하고 **다른 소비처가 하나라도 있으면 유지**한다. 판단 근거는 build(tsc `noUnusedLocals`) green 으로 최종 검증.
- [ ] **신규 public symbol 없음 → R-112 신규 happy/error/branch/negative test 항목 해당 없음** — 본 slice 는 코드/test 를 추가·변경하지 않고 삭제만 한다(behavioral 변경 0). 따라서 R-112 의 "추가/수정된 public symbol 에 대한 test" 5 항목은 본 삭제 slice 에 적용 대상이 없다(task 본문 명시로 §3.2 정합). 대신 아래 무회귀·regression 보증으로 안전을 검증한다.
- [ ] **regression 보증 — job-flow 경로 무회귀** — T-1246 이 추가한 `describe('AdminView — buildExportInput ...')` 및 `describe('AdminView — runAdminExportJob (job-flow 배선, T-1246)')` 의 모든 `it` 이 삭제 후에도 그대로 green 임을 확인(실 export 경로가 삭제에 영향받지 않음의 증거).
- [ ] **정적 렌더 회귀 test 무회귀** — `AdminView — 컨테이너 렌더`·`④g scope 선택 select 배선 (정적 렌더)` 등 렌더 test 가 그대로 pass(삭제가 컴포넌트 렌더에 영향 0).
- [ ] `pnpm --dir web build`(tsc --noEmit + vite) green — TS6133(unused import/local) 0, dangling export 0, 타입 에러 0.
- [ ] `pnpm --dir web test`(vitest) green — 전체 무회귀, 삭제된 describe 를 제외한 전 test pass, 삭제된 심볼을 참조하는 잔존 test 0.

## Out of Scope

- **`parseFilename`/`triggerDownload`/`DownloadDeps` dedup·이동 금지** — 이들은 `runExport` 삭제 후 dead-but-exported 가 되지만(exported 라 TS6133 미발생), hub↔`exportJobDownload.ts` 중복 제거(공용 `web/src/api/exportDownload.ts` 추출)는 **별도 후속 slice**(driver 지시: 본 slice 에 번들 금지). 본 slice 는 순수 삭제만, dedup 은 이연.
- **`browserDownloadDeps` 삭제 금지** — `runAdminExportJob`(실 배선) 이 여전히 사용. 삭제 시 export 붕괴.
- **`exportJob.ts`/`exportJobFlow.ts`/`exportJobDownload.ts` 수정 금지** — 확정 계약(T-1242/T-1243/T-1245). 본 slice 는 hub 의 구 GET 잔재만 제거.
- **backend `export.controller.ts`/`export-job.service.ts`/`prisma/schema.prisma`/`api.md` 수정 금지** — 권위 계약.
- **새 test 추가 금지** — 본 slice 는 삭제 전용. job-flow test 는 T-1246 이 이미 추가했고 본 slice 는 그 무회귀만 확인.
- **`import` 측(`POST /api/admin/import`) 대칭 정리 금지** — export 완결 후 별도 Follow-up.
- **T-1245 reviewer nit(`exportJobDownload.ts` `parseFilename` malformed-percent-encoding fallthrough regression test)** — 별도 파일이라 본 slice(AdminView 집중)와 file-disjoint. 별도 소형 task 로 이연.
- **cap 유의**: 본 slice 는 삭제 위주라 diff LOC(~490)가 300 을 넘지만 `sizeExempt: true`(frontmatter `exemptReason` 참조) — src+test atomic 삭제로 orphan-reference 를 원천 차단하기 위한 불가분 1 slice. 실제 신규/변경 로직은 0, 2 파일(≤5 파일 cap 준수). executor 는 sizeExempt task 이므로 LOC cap 검사를 skip하되, **파일 수(2)·삭제 대상 범위(위 Required Reading 7종)를 넘어서면 즉시 BLOCKED(task-too-large)로 planner 재-split 요청**.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **hub download 유틸 dedup(후속 slice)**: `parseFilename`/`triggerDownload`/기본파일명·완료문구를 공용 `web/src/api/exportDownload.ts` 로 추출해 hub(AdminView)·`exportJobDownload.ts` 가 함께 import(중복 제거). 본 삭제 slice 로 hub `parseFilename`/`triggerDownload` 가 dead-but-exported 가 되므로 dedup 의 자연스러운 후속.
- **T-1245 reviewer nit**: `web/src/api/exportJobDownload.ts` `parseFilename` malformed-percent-encoding(`decodeURIComponent` catch) fallthrough 분기 미검증 → `exportJobDownload.test.ts` regression test 1건.
- **import 측 대칭 orchestration**: `runImportJob` + 다운로드/진행 대칭 배선 — export 완결 후.
