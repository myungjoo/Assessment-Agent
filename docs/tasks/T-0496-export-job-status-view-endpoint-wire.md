---
id: T-0496
title: describeExportJobStatus helper 를 신설 GET /api/admin/export/:id/status-view 에 실호출 배선 — 45 helper 배선 chain step6
phase: P7
status: DONE
completedAt: 2026-06-18T10:04:47Z
mergedAs: 023075f
prNumber: 407
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0488]
touchesFiles:
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step6 — describeExportJobStatus(T-0468 순수 helper, 미호출) 를 신설 GET /api/admin/export/:id/status-view 에 배선. JobStatus enum→helper lowercase status 매핑 후 진행 view 산출. controller-only, file-disjoint, 새 dep/schema 0."
---

# T-0496 — describeExportJobStatus helper 를 신설 GET /api/admin/export/:id/status-view 에 실호출 배선

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step6 다. step3([T-0493](T-0493-import-modes-endpoint-describe-wire.md), `describeImportMode`→GET /api/admin/import/modes)·step4([T-0494](T-0494-export-describe-scope-endpoint-wire.md), `describeExportScope`→POST /api/admin/export/describe-scope)·step5([T-0495](T-0495-export-scope-rejection-message-wire.md), `buildExportScopeRejection`→service reject 분기)가 export/import 의 read-only/reject helper 들을 실 path 에 배선했다. 본 step 은 그 자연스러운 다음 read-side slice — **async Export job 의 진행 status view** 다.

`describeExportJobStatus` ([T-0468](T-0468-export-job-status-view.md), `src/export/export-job-status-view.ts`) 는 UC-07 §8 NFR(async job + status polling) + §5 step 13(Export 다운로드 완료 직전 진행 안내)이 요구하는 진행 view 모델(`ExportJobStatusView` — phaseLabel · stepIndex · totalSteps · nextStatus · terminal · downloadable · 한국어 message)을 산출하는 순수 helper 인데, `git grep describeExportJobStatus -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — **자기 spec 외 어디서도 호출되지 않는 unwired helper** 다. 반면 현행 `GET /api/admin/export/:id`([T-0488](T-0488-export-controller.md))은 raw `ExportJob` row 만 반환할 뿐, 사용자가 polling 도중 "지금 어디까지 왔는지"(몇 단계 중 몇 번째 · 다음 단계 · 다운로드 가능 여부)를 보여줄 사람-친화 view 는 코드 차원에서 비어 있다.

본 task 는 신설 `GET /api/admin/export/:id/status-view` endpoint 에서 `findJob(id)` 로 조회한 job 의 Prisma `JobStatus`(PENDING/RUNNING/SUCCEEDED/FAILED)를 helper 가 요구하는 lowercase `ExportJobStatus`(queued/running/ready/failed)로 매핑한 뒤 `describeExportJobStatus` 를 실호출해 `ExportJobStatusView` 를 200 으로 반환한다. 이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export), (2) raw 미저장 invariant(REQ-032)는 helper 가 status enum 1개만 다뤄 자연 유지되며, (3) Admin 전용 조회(REQ-045) RBAC 가 기존 endpoint 와 동일하게 적용된다. step4 의 `describe-scope`(POST read-only preview)와 동질의 read-only HTTP slice 다.

본 task 는 **persistence / DB write 0, 새 service 메서드 0**(기존 `findJob` 재사용) — controller layer 에 enum 매핑 + helper 호출 + 신설 GET route 1개만 추가한다. 새 외부 dependency / DB schema / auth-flow 표면 0(helper · controller · guard · findJob 이미 존재).

## Required Reading

- `docs/tasks/T-0496-export-job-status-view-endpoint-wire.md` (본 파일)
- `src/export/export.controller.ts` 전체 — 배선 위치. 특히 (a) `SCOPE_ENUM_TO_PAYLOAD` 상수 패턴(enum→helper 입력 매핑의 mirror — 본 task 의 `JOB_STATUS_TO_VIEW` 작성 참고), (b) `@Get(":id")` findJob 의 `findJob(id)` 재사용 + RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`), (c) `describeScope`(T-0494)의 controller 안 helper 직접 호출 + raw forward 정책(controller 자체 try/catch·status 변환 신설 0). **route 선언 순서 주의** — `:id/status-view` 는 `:id` 보다 깊은 segment 라 충돌 없으나, NestJS path matching 안전을 위해 `@Get(":id/status-view")` 를 `@Get(":id")` 보다 **먼저** 선언한다(고정-깊이 segment 우선 규칙, 기존 `running` before `:id` 패턴 동형).
- `src/export/export-job-status-view.ts` 전체 — 호출할 순수 helper. `describeExportJobStatus(status: ExportJobStatus): ExportJobStatusView`. 입력은 lowercase `ExportJobStatus`("queued"|"running"|"ready"|"failed"), 반환 `{ status, phaseLabel, stepIndex, totalSteps, nextStatus, terminal, downloadable, message }`. **입력 방어**: status 비-string → TypeError, 허용 4종 외 string → RangeError. controller 는 항상 매핑표가 산출한 정상 lowercase 값을 넘기므로 정상 경로에서 방어 분기 미발화(negative test 로 cover).
- `prisma/schema.prisma` L539-545(`enum JobStatus { PENDING RUNNING SUCCEEDED FAILED }`) + `model ExportJob`(status: JobStatus) — Prisma enum source. 매핑: PENDING→"queued", RUNNING→"running", SUCCEEDED→"ready", FAILED→"failed". 4값 1:1 대응(누락·여분 0). 매핑표는 `Record<JobStatus, ExportJobStatus>` 로 타입 강제해 enum 추가 시 컴파일 누락을 잡는다.
- `src/export/export-job.service.ts` 의 `findJob(id)` — 재사용할 조회 메서드(부재 시 P2025→NotFoundException(404) raw forward). 새 service 메서드 추가 금지 — findJob 결과의 status 만 매핑.
- `src/export/export.controller.spec.ts` 전체 — colocated spec(추가/수정 test 작성 위치). 기존 create/findRunning/describeScope/findJob test 의 mock service 패턴(ExportJobService stub)·guard override 패턴을 mirror 해 신설 endpoint test 를 추가. 신규 spec 파일 생성 금지 — colocated 우선.

## Acceptance Criteria

배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출은 의무):

- [ ] `ExportController` 에 `JOB_STATUS_TO_VIEW: Record<JobStatus, ExportJobStatus>` 매핑 상수를 추가한다(PENDING→"queued", RUNNING→"running", SUCCEEDED→"ready", FAILED→"failed"). `SCOPE_ENUM_TO_PAYLOAD` 패턴 mirror — schema/helper 변경 0, controller 가 대소문자·어휘 차이만 흡수. 타입을 `Record<JobStatus, ...>` 로 강제해 enum 확장 시 컴파일 누락 catch.
- [ ] 신설 `@Get(":id/status-view")` endpoint(`statusView(@Param("id") id: string)`)가 `service.findJob(id)` 로 조회한 job 의 `status` 를 `JOB_STATUS_TO_VIEW` 로 매핑한 뒤 `describeExportJobStatus(mapped)` 를 실호출해 `ExportJobStatusView` 를 반환한다. RBAC 는 기존 endpoint 와 동일(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`). route 선언은 `@Get(":id")` 보다 먼저(고정-깊이 우선). 배선 근거 주석 1줄 박제(UC-07 §8 진행 view).
- [ ] `describeExportJobStatus` 가 자기 spec 외 실 controller 에서 호출됨을 검증 — `git grep describeExportJobStatus -- src/export/export.controller.ts` 가 1+ 매칭.
- [ ] job 부재(존재하지 않는 :id) 시 `findJob` 의 `NotFoundException`(404)이 helper 호출 전에 raw propagate 됨(controller 자체 try/catch·status 변환 신설 0, REQ-032 정합 — raw stack 미노출).
- [ ] **Happy-path test**: 각 status(PENDING/RUNNING/SUCCEEDED/FAILED)의 job 을 findJob stub 이 반환할 때 `statusView` 가 올바른 `ExportJobStatusView`(매핑된 lowercase status + phaseLabel + downloadable 등)를 반환하는 test 각 1+. 특히 SUCCEEDED→downloadable=true, RUNNING→terminal=false 같은 핵심 불변을 단언.
- [ ] **Error path test**: findJob 이 `NotFoundException` 을 throw 할 때(존재하지 않는 id) `statusView` 가 그 예외를 swallow 없이 raw propagate 하고 `describeExportJobStatus` 가 호출되지 않음을 단언하는 test 1+(helper spy 미호출 검증).
- [ ] **Flow / branch test**: 매핑표 4 분기(PENDING/RUNNING/SUCCEEDED/FAILED) 각각이 올바른 lowercase status 로 helper 에 전달됨을 cover — helper 를 spy 해 매핑된 인자로 정확히 1회 호출됨을 검증하는 test 1+. 정상 조회 분기와 부재 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ — (1) job 부재 → NotFoundException raw propagate(helper 미호출), (2) RBAC 미달(User actor) → 403(guard, 기존 stack 동형 — 가능한 한 기존 guard test 패턴 재사용), (3) 인증 부재 → 401(JwtAuthGuard), (4) 매핑표가 모든 JobStatus 값을 cover 함을 보장하는 test(예: `Object.values(JobStatus)` 전부 매핑 결과가 유효 lowercase status 임 단언 — enum 확장 시 누락 회귀 방지). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — export.controller.ts 변경 부분 colocated spec 으로 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- ExportJobService / `findJob` 등 service 메서드 변경·신설 — 본 task 는 기존 `findJob` 재사용, controller layer 만 touch(touchesFiles 2 파일, file-disjoint with service stream).
- `describeExportJobStatus` / 다른 status helper 자체 로직 변경 — 이미 존재·검증됨(T-0468 박제 그대로). 호출(import)만.
- Import 측 대칭 status view(`describeImportJobStatus` 등) 배선 — chain 의 후속 slice(별도 task). 한 task 1 helper 배선 원칙.
- 실 dump 직렬화 / streaming / chunked download / artifact 저장소 — 후속 chain / §5 BLOCKED. status view 는 진행 표시만, 실 다운로드 전송 0.
- 응답 envelope 표준화 / pagination / sort — helper return 그대로 forward.
- 새 custom exception 신설 / HTTP status 변경 — findJob 의 기존 404 매핑 유지, 정상 조회는 200 + view.
- api.md 등 doc 계약 추가/정정(신설 status-view endpoint 의 §5 문서화) — 필요 시 §Follow-ups 에 기록(별도 direct doc-sync task).
- STATE.json / journal / PLAN 등 doc 변경 — direct-mode 별 task. 본 task 는 코드+spec pr-mode 만.
- 새 외부 dependency / schema migration / auth-flow 변경 0(전부 기존 표면 재사용) — 발생 시 BLOCKED.

## Suggested Sub-agents

`implementer → tester`

(아키텍처 결정 0 — 기존 helper·controller·guard·findJob·mock 재사용, 새 ADR 불요. architect 생략.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append — 예: api.md §5 에 신설 GET /api/admin/export/:id/status-view 계약 문서화(별도 direct doc-sync). Import 측 대칭 진행 view 배선 slice. export 측 잔여 미호출 helper(`buildExportJobPlan`·`estimateExportDumpSize`·`summarizeExportSelection` 등) 의 배선 slice — 단 이들은 실 record 선별·dump 조립이 필요해 별도 task.)
