---
id: T-1243
title: export-job orchestration 헬퍼 신설 — create→poll status→download 를 단일 순수 함수로 합성
phase: P6
status: DONE
commitMode: pr
completed: 2026-07-26T06:40:00Z
mergedAs: 2ea4040b
prNumber: 1135
reviewRounds: 1
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-export-contract-fix
dependsOn: [T-1242]
touchesFiles: [web/src/api/exportJobFlow.ts, web/src/api/exportJobFlow.test.ts]
plannerNote: P6 — T-1242 후속 slice(export 계약 drift). T-1242 client primitive 위에 job orchestration(create→poll→download) 을 격리 순수 함수로 합성. AdminView.tsx 무접촉 file-disjoint(hub 편집 회피). AdminView 배선은 최종 slice. pr.
---

# T-1243 — export-job orchestration 헬퍼 신설 (create → poll status → download 합성)

## Why

T-1242 가 job 기반 export 계약의 **격리된 client primitive**(`web/src/api/exportJob.ts` 의 `createExportJob`/`getExportJob`/`listRunningExportJobs`/`downloadExportJob`)를 신설했다. 그러나 실제 export 를 완료하려면 backend job 모델의 lifecycle — **POST create(status=PENDING) → status polling(RUNNING → SUCCEEDED) → download** — 을 순차 합성해야 한다. T-1242 의 Out of Scope 는 이 **polling loop orchestration** 을 명시적으로 "배선 slice 책임"으로 defer 했다. 본 task 가 그 orchestration slice 다.

**왜 AdminView.tsx 에 직접 배선하지 않고 별도 헬퍼로 분리하는가**: 최종 소비처인 `web/src/views/AdminView.tsx` 는 4875-LOC 의 hub 파일이고(현 `runExport`(L924)는 단발 `getRaw` GET 모델), 다른 driver 작업과 자주 겹치는 concurrency-hot 파일이다. polling loop 는 상태 전이(PENDING/RUNNING/SUCCEEDED/FAILED) 분기 + timeout + download-error 등 negative case 가 많아 hub 파일 안에서 직접 짜면 (a) 큰 위험한 hub 편집, (b) R-112 충분 cover 가 어렵다. 그래서 **deps 주입 순수 함수 `runExportJob`** 로 격리해 — `AdminView.tsx` 와 **file-disjoint**(fine-grained concurrency stage 5b 하 무충돌) 하고, 모든 상태 전이 분기를 mock deps 로 완전 cover 하며, 다음(최종) slice 는 `runExport` 를 이 헬퍼 1회 호출 + Blob 저장으로 교체하기만 하면 되는 깨끗한 접합면을 남긴다.

## Required Reading

- `web/src/api/exportJob.ts` — 본 헬퍼가 조립하는 primitive(전량). export 심볼: `createExportJob(input): Promise<ExportJob>`, `getExportJob(id): Promise<ExportJob>`, `downloadExportJob(id): Promise<Response>`, 타입 `ExportJob`(`{ id: string; status: string }`)·`CreateExportInput`(`{ scope?, dateRange?, entitySelector? }`). 이 심볼들을 재사용하되, 테스트 가능성을 위해 **deps 로 주입**한다(직접 import 강결합 대신 — AdminView `ExportDeps` 주입 convention 계승).
- `src/export/export.controller.ts` — **읽기만**(계약 참조, import 금지). 확인 대상: (a) `@Get(":id")`(L 부근) 가 반환하는 `ExportJob` 의 `status` 필드가 **Prisma `JobStatus` enum 표기**(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`, uppercase — L124~135 의 enum→친화문자열 매핑표 참조)임을 **직접 확인**하고 그 정확한 terminal 토큰을 헬퍼 상수에 반영. (b) `@Get(":id/download")`(L379) 가 최종 dump streaming route.
- `prisma/schema.prisma` — **읽기만**. `enum JobStatus` 정의를 확인해 성공 terminal(`SUCCEEDED`)·실패 terminal(`FAILED`)·진행중(`PENDING`/`RUNNING`) 집합을 **backend source 그대로** 헬퍼 상수로 박제(하드코딩 오타 방지). enum 표기가 위와 다르면 schema 를 정답으로 삼는다.
- `web/src/views/AdminView.tsx` L898~975 — **읽기만**(수정 금지). `runExport(path, deps)`(L924)의 deps 주입 순수 함수 패턴 + `ExportDeps` 구조를 mirror 대상으로 참조(본 헬퍼가 같은 주입 스타일을 따른다). 배선 교체는 본 task 범위 밖(최종 slice).

## Acceptance Criteria

- [ ] `web/src/api/exportJobFlow.ts` 신설 — deps 주입 순수 orchestration 함수 `runExportJob` 를 export 한다:
  - 시그니처(권장): `runExportJob(input: CreateExportInput, deps: ExportJobFlowDeps, options?: RunExportJobOptions): Promise<Response>`.
  - `ExportJobFlowDeps` = `{ createExportJob, getExportJob, downloadExportJob, delay? }` — 앞 3개는 `exportJob.ts` 시그니처 그대로, `delay?: (ms: number) => Promise<void>` 는 poll 간 대기(테스트에서 주입해 실 타이머 대기 제거; 미주입 시 `setTimeout` 기반 기본 구현).
  - `RunExportJobOptions` = `{ maxPolls?: number; intervalMs?: number }`(기본값 예: `maxPolls=30`, `intervalMs=1000`).
  - 흐름: `createExportJob(input)` → 반환 job 의 `id` 확보 → `getExportJob(id)` 를 성공 terminal(`SUCCEEDED`) 까지 poll(각 poll 사이 `delay(intervalMs)`) → 성공 시 `downloadExportJob(id)` 의 `Response` 를 resolve.
- [ ] backend terminal 토큰 상수를 **backend source(schema.prisma / controller) 확인값 그대로** 모듈 상수로 박제(예: `SUCCEEDED`/`FAILED`) — web 로컬 오타 방지, 매직 스트링 인라인 금지.
- [ ] **AdminView.tsx·exportJob.ts·backend·기타 컴포넌트는 읽기만, 수정 0** — 본 slice 는 신규 파일 2개만 추가. `runExport`/`ADMIN_EXPORT_PATH`/`getRaw` 교체는 다음(최종) slice.
- [ ] **Happy-path test 1+**: mock deps 로 — `createExportJob` 가 job(id, status=`PENDING`) resolve → 첫 `getExportJob` 가 `RUNNING`, 다음이 `SUCCEEDED` resolve → `downloadExportJob(id)` 의 `Response` 를 `runExportJob` 가 그대로 resolve, 그리고 `createExportJob`·`downloadExportJob` 가 각 1회, `getExportJob` 가 올바른 `id` 로 호출됨을 검증(`delay` mock 으로 즉시 진행).
- [ ] **Error path test 각 1+** (swallow 없이 전파): (a) `createExportJob` 가 `ApiError`(예: 403 Admin+ 미달) reject → `runExportJob` 도 reject(poll·download 미호출). (b) `getExportJob` 가 reject → 전파(download 미호출). (c) `downloadExportJob` 가 reject → 전파.
- [ ] **Flow/branch cover + negative cases 충분**: (1) **성공 terminal 도달** 전 `PENDING`→`RUNNING`→`SUCCEEDED` 다단 전이를 거쳐 정상 download(전이 분기 cover). (2) **실패 terminal `FAILED` 수신 시** poll 을 즉시 중단하고 **명확한 Error 를 throw**(download 미호출 — 실패 job 다운로드 시도 방지). (3) **maxPolls 초과**(계속 `RUNNING`) 시 무한 loop 없이 timeout Error 로 reject(경계값 — `getExportJob` 가 `maxPolls` 회만 호출됨을 검증). (4) `createExportJob` 가 이미 `SUCCEEDED` job 을 반환하는 경우(즉시 완료) poll 0~1 회로 바로 download(경계). (5) `delay` 가 정확한 `intervalMs` 로 poll 사이마다 호출됨을 검증(실 타이머 대기 없이).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0, 타입 에러 0). web coverageThreshold 는 T-1165 게이트로 미강제이나 `runExportJob` 의 전 분기(성공 terminal / 실패 terminal / timeout / 즉시완료 / 각 error 전파)를 신규 test 로 충분 cover.

## Out of Scope

- **AdminView.tsx 수정 금지** — `runExport`/`ADMIN_EXPORT_PATH`/`buildExportPath`/`getRaw` 를 `runExportJob` 호출 + Blob 저장으로 교체하는 배선은 **다음(최종) slice(Follow-up)**. 본 task 는 격리된 orchestration 헬퍼 + spec 신설만(AdminView file-disjoint 유지 — hub 편집 회피).
- **Blob→파일 저장 UX·토스트·진행률 표시 금지** — 본 헬퍼는 성공 시 `Response` 를 resolve 할 뿐. `response.blob()` → 파일 다운로드 트리거·`DataImportExportPanel` 진행 UX 는 배선 slice 책임.
- **exportJob.ts primitive 수정 금지** — 이미 T-1242 로 확정된 계약. 본 헬퍼는 그 위에 조립만(deps 주입).
- import 측(`POST /api/admin/import`) orchestration 은 본 slice 미포함(export 만) — 필요 시 대칭 Follow-up.
- backend `export.controller.ts`·`export-job.service.ts`·`prisma/schema.prisma`·api.md 수정 금지 — 권위 계약이며 web 이 정합 대상.
- **cap 유의**: 신규 파일 2개(`exportJobFlow.ts` 약 90 LOC + `exportJobFlow.test.ts` 약 160 LOC) ≈ 250 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청(예: timeout/failed-terminal negative 묶음을 후속 slice 로 분리).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 다음(최종) slice(필수): `AdminView.tsx` 의 `runExport` 를 `runExportJob`(create → poll → download) 호출 + `response.blob()` 파일 저장으로 교체해 실제 export 버그(GET 404) 를 최종 해소. hub 파일이므로 scope 를 export 경로로만 좁혀 cap 준수.
- 후보: import 측 대칭 orchestration(`runImportJob`, `POST /api/admin/import` multipart) — export 배선 안정화 후.
- 후보: web↔backend export 계약 drift-guard spec(T-1234~T-1236 패턴) — 헬퍼가 사용하는 terminal 토큰이 prisma `JobStatus` enum 과 일치하는지 기계 검증하는 회귀 앵커.
