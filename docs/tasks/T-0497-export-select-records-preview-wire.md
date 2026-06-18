---
id: T-0497
title: selectExportRecords helper 를 신설 ExportJobService.previewSelection + POST /api/admin/export/preview-selection 에 실호출 배선 — 45 helper 배선 chain step7
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 230
estimatedFiles: 5
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0491]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step7 — selectExportRecords(T-0437 순수 helper, 미호출) 를 신설 read-only previewSelection 서비스 메서드 + POST /api/admin/export/preview-selection 에 배선. 최소 {entity,instant} projection DB read(REQ-032-safe) 후 scope 분류. 5 entity→ExportRecord 매핑은 architect 결정. downstream(estimate/plan/result) chain 의 기반 slice."
---

# T-0497 — selectExportRecords helper 를 신설 ExportJobService.previewSelection + POST /api/admin/export/preview-selection 에 실호출 배선

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step7 다. step3~step6([T-0493](T-0493-import-modes-endpoint-describe-wire.md)·[T-0494](T-0494-export-describe-scope-endpoint-wire.md)·[T-0495](T-0495-export-scope-rejection-message-wire.md)·[T-0496](T-0496-export-job-status-view-endpoint-wire.md))이 job-row / DTO-only 로 산출 가능한 read-only / reject helper 들을 실 path 에 배선했다. 그 결과 **dump payload 없이 배선 가능한 경량 helper 군은 소진**됐고, 남은 export read-side helper(`summarizeExportSelection`(T-0449)·`estimateExportDumpSize`(T-0466)·`buildExportJobPlan`(T-0467)·`buildExportResult`)은 전부 `ExportSelection`(= `selectExportRecords` 출력)을 입력으로 요구한다. 즉 **`selectExportRecords` 배선이 그 downstream chain 전체를 막는 단일 기반 slice** 다.

`selectExportRecords` ([T-0437](T-0437-export-scope-select.md), `src/export/export-scope-select.ts`)은 scope(full/range/partial) 규칙으로 in-memory `ExportRecord[]`(= `{entity, instant}` 최소 projection)을 selected / excluded 두 그룹으로 순수 분류하는 helper 인데, `git grep selectExportRecords -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — **자기 spec 외 어디서도 호출되지 않는 unwired helper** 다. helper 자체는 "이미 메모리에 올라온 record" 만 분류하므로, 배선하려면 service 가 5 entity(Assessment·Person·Group·LlmConfig·AuditLog) 에서 `{entity, instant}` 최소 projection 을 모아 helper 에 넘기는 read 가 필요하다.

본 task 는 신설 read-only `ExportJobService.previewSelection(scope)` 메서드에서 (1) 5 entity 의 `{entity, instant}` projection 만 Prisma 로 모아(전체 row·raw 미조회 — REQ-032 정합) `ExportRecord[]` 로 만들고, (2) `selectExportRecords(scope, records)` 를 실호출해 분류한 뒤, (3) selected / excluded 의 **count 요약**(전체 row 미반환 — PII·raw 미노출)을 신설 `POST /api/admin/export/preview-selection`(CreateExportDto body → scope 변환, T-0494 `describeScope` 의 enum→lowercase 변환 mirror) 로 200 반환한다. 이로써 (1) 미호출 helper 1 종이 실 HTTP/DB path 에 연결되고(REQ-030 Export scope 선별), (2) DB 에서 `{entity, instant}` 만 select 해 raw 미저장/미노출 invariant(REQ-032)가 유지되며, (3) Admin 전용 조회(REQ-045) RBAC 가 기존 endpoint 와 동일 적용된다. step4 의 `describe-scope`(POST read-only preview)와 동질의 read-only HTTP slice 이되, **scope 검증 통과 후 실 DB 선별을 처음 수행**하는 점이 새롭다.

본 task 는 **DB write 0**(read-only select 만), `ExportJob` 생성·status 전이와 무관하다. 새 외부 dependency / DB schema migration / auth-flow 표면 0(helper·controller·guard·PrismaService·DTO 모두 기존 표면 재사용 — 신규는 read-only service 메서드 1개 + GET 아닌 POST route 1개 + 5 entity→ExportRecord 매핑 상수).

## Required Reading

- `docs/tasks/T-0497-export-select-records-preview-wire.md` (본 파일)
- `src/export/export-scope-select.ts` 전체 — 호출할 순수 helper. `selectExportRecords(scope: ExportScope, records: ReadonlyArray<ExportRecord>): ExportSelection`. `ExportScope { scope: "full"|"range"|"partial"; dateRange?: PeriodRange; entitySelector?: ExportEntity[] }`, `ExportRecord { entity: ExportEntity; instant: Date }`, `ExportEntity = "Assessment"|"Person"|"Group"|"LlmConfig"|"AuditLog"`. 반환 `{ selected: ExportRecord[]; excluded: ExportRecord[] }`(입력 순서 보존, 합집합 = 입력, 비변형). **입력 방어**: scope 허용 외 → RangeError, records 비-배열 → TypeError, range scope 인데 dateRange 부재 → RangeError, partial scope 인데 entitySelector 부재/빈 → RangeError, 원소 instant 비-Date/Invalid Date → 그 index TypeError. `VALID_EXPORT_ENTITIES`(5 종) 상수 재사용.
- `src/export/export.controller.ts` 전체 — 배선 위치. 특히 (a) `POST /api/admin/export/describe-scope`(T-0494) 의 `SCOPE_ENUM_TO_PAYLOAD`(Prisma `ExportScope` FULL/RANGE/PARTIAL → helper lowercase "full"/"range"/"partial") + `coerceDateRange`(ISO→Date) 변환 + helper 직접 호출 + raw forward 정책 — 본 task 의 `POST /preview-selection` 이 동일 변환을 재사용한다(중복 변환 로직 추출 여부는 implementer 재량, 단 신규 helper 파일 신설 금지). (b) RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) + controller-scope ValidationPipe. (c) POST route 라 `@Get(":id")` 동적 segment 와 메서드가 달라 선언 순서 영향 없음(describe-scope 와 동일 — 주석 1줄로 박제).
- `src/export/export-job.service.ts` 전체 — 신설 `previewSelection(scope)` 메서드 위치. `createJob` 의 `validateExportScope`(T-0491) 사용 패턴 + `PrismaService` 주입 + `getPrismaErrorCode`/P2025→NotFoundException 변환 컨벤션 mirror. **신설 메서드는 read-only** — `this.prisma.<entity>.findMany({ select: { <instantColumn>: true } })` 로 각 entity 의 instant projection 만 모은다(전체 row select 금지 — REQ-032). 5 entity→Prisma model + instant column 매핑은 **architect 결정**(아래 §Suggested Sub-agents).
- `prisma/schema.prisma` — 5 entity(Assessment·Person·Group·LlmConfig·AuditLog) 의 model 정의 + 각 model 의 시간 컬럼(예: `createdAt`/`occurredAt`/`recordedAt` 등 — entity 별 명칭 상이) 확인. architect 가 entity 별 instant 로 쓸 컬럼을 결정(UC-07 §6.1 range scope 의 [start,end) 판정 의미와 정합 — "record 가 생성/발생한 시각"). model 이름이 `ExportEntity` literal 과 다르면(예: Prisma model `Person` vs literal "Person") 매핑 상수가 그 차이를 흡수.
- `src/export/export.controller.spec.ts` 전체 — colocated spec. 기존 `describeScope`/`findJob` test 의 ExportJobService stub·guard override 패턴 mirror 해 신설 endpoint test 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. 기존 PrismaService mock(`test/helpers/prisma-mock.ts` 또는 inline stub) 패턴 mirror 해 5 entity `findMany` 를 stub 하고 `previewSelection` 의 분류·count 산출을 검증. 신규 spec 파일 생성 금지.

## Acceptance Criteria

배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + DB projection-only read 는 의무):

- [ ] `ExportJobService` 에 read-only `async previewSelection(scope: ExportScope): Promise<{ selectedCount: number; excludedCount: number; perEntitySelected: Record<ExportEntity, number> }>`(반환 shape 은 implementer 재량 — 단 **전체 row·raw payload 미반환**, count/요약만) 메서드를 신설한다. 메서드는 (1) 5 entity 에서 `{entity, instant}` projection 만 Prisma `findMany({ select: ... })` 로 모아 `ExportRecord[]` 조립, (2) `selectExportRecords(scope, records)` 실호출, (3) selected/excluded count 요약 반환. DB write 0. 배선 근거 주석 1줄 박제(UC-07 §6.1 scope 선별 + REQ-032 projection-only).
- [ ] 5 entity → Prisma model + instant 컬럼 매핑 상수(예: `EXPORT_ENTITY_SOURCES`)를 `Record<ExportEntity, {...}>` 또는 동등 구조로 타입 강제해 entity 누락을 컴파일 차원에서 catch. architect ADR 의 매핑 결정을 그대로 인코딩.
- [ ] 신설 `@Post("preview-selection")` endpoint(`previewSelection(@Body() dto: CreateExportDto)`)가 dto 의 scope/dateRange/entitySelector 를 `describeScope`(T-0494) 와 동일하게 lowercase `ExportScope` 로 변환한 뒤 `service.previewSelection(scope)` 결과를 200 반환. RBAC 는 기존 endpoint 동일. POST 라 `@Get(":id")` 와 충돌 없음(주석 1줄).
- [ ] `selectExportRecords` 가 자기 spec 외 실 service 에서 호출됨을 검증 — `git grep selectExportRecords -- src/export/export-job.service.ts` 가 1+ 매칭.
- [ ] DB 에서 전체 row 가 아닌 `{instant}`(+ entity 는 source 별로 부여) projection 만 select 됨을 단언 — `findMany` 호출 인자에 `select` 가 존재하고 raw payload 컬럼이 select 되지 않음(REQ-032). mock 의 `findMany` 호출 인자 검증 test 1+.
- [ ] **Happy-path test**: (service) full scope → 5 entity 의 모든 projection 이 selected, excluded 0. range scope(valid dateRange) → [start,end) 구간 record 만 selected. partial scope(valid entitySelector) → 선택 entity record 만 selected. 각 분기 1+ test. (controller) 정상 CreateExportDto body → previewSelection 호출 + 200 count 반환 test 1+.
- [ ] **Error path test**: (service) scope 검증 helper 가 거부하는 입력(range 인데 dateRange 부재 / partial 인데 entitySelector 빈) 에서 `selectExportRecords` 가 RangeError 를 throw 하고 previewSelection 이 그것을 swallow 없이 propagate(또는 service 정책상 BadRequestException 변환 — implementer 가 describe-scope 의 raw-forward vs 변환 정책과 일관되게 결정, 그 정책을 단언) 하는 test 1+. (controller) 잘못된 scope enum / forbidNonWhitelisted 위반 body → 400 test 1+.
- [ ] **Flow / branch test**: previewSelection 내 scope 3 분기(full/range/partial) 각각이 helper 에 올바른 `ExportScope` 로 전달됨을 helper spy 로 검증(매핑된 lowercase scope + dateRange/entitySelector 변환 정확). 정상 분류 분기와 검증 실패 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ — (1) RANGE+dateRange 누락 → RangeError/BadRequest, (2) PARTIAL+entitySelector 빈/허용 외 entity → RangeError/BadRequest, (3) RBAC 미달(User actor) → 403(guard 기존 stack 동형), (4) 인증 부재 → 401, (5) 빈 DB(5 entity findMany 전부 빈 배열) → selectedCount 0·excludedCount 0(throw 0, 경계), (6) 매핑 상수가 5 ExportEntity 전부 cover 함을 단언(`VALID_EXPORT_ENTITIES` 전 entity 가 매핑 key 로 존재 — entity 확장 시 누락 회귀 방지). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 변경된 service/controller 부분 colocated spec 으로 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `summarizeExportSelection`(T-0449)·`estimateExportDumpSize`(T-0466)·`buildExportJobPlan`(T-0467)·`buildExportResult` 배선 — 본 task 는 `selectExportRecords` 1개만 배선해 그 chain 의 **입력(ExportSelection)** 을 처음 산출한다. 요약/추정/plan/result 합성은 후속 slice(별도 task, 한 task 1 helper 원칙).
- `ExportJob` record 생성·status 전이(createJob/markRunning 등) 와의 연동 — previewSelection 은 job record 와 무관한 read-only preview. 실제 dump 시점에 선별을 재실행할지는 후속 chain 결정.
- 실 dump 직렬화 / streaming / chunked download / artifact 저장소 — 후속 chain / §5 BLOCKED. preview 는 count 요약만, record payload 전송 0.
- 전체 row / PII / raw 본문 반환 — projection 은 `{entity, instant}` 만, 응답은 count/요약만(REQ-032). 선별된 실 record 데이터 노출 금지.
- DB schema 변경 / migration / 새 인덱스 추가 — 본 task 는 기존 5 entity 의 기존 컬럼만 read. 성능 인덱스 필요 판단 시 §Follow-ups 기록(별도 task).
- Import 측 대칭 preview 배선 — chain 후속 slice.
- `selectExportRecords` / `validateExportScope` helper 자체 로직 변경 — 이미 존재·검증됨(T-0437 / T-0444 박제 그대로). 호출(import)만.
- 응답 envelope 표준화 / pagination / sort — 결과 그대로 forward.
- 새 custom exception 신설 — 기존 정책(describe-scope raw-forward 또는 service BadRequest 변환) 과 일관되게 처리.
- api.md 등 doc 계약 추가/정정(신설 POST /preview-selection 의 §5 문서화) — 필요 시 §Follow-ups 기록(별도 direct doc-sync task).
- STATE.json / journal / PLAN 등 doc 변경 — direct-mode 별 task. 본 task 는 코드+spec pr-mode 만.
- 새 외부 dependency / auth-flow 변경 0(전부 기존 표면 재사용) — 발생 시 BLOCKED.

## Suggested Sub-agents

`architect → implementer → tester`

(architect 호출 사유 — 5 ExportEntity(Assessment·Person·Group·LlmConfig·AuditLog) 를 어느 Prisma model + 어느 instant 컬럼으로 매핑할지가 architectural 결정이다(UC-07 §6.1 range scope [start,end) 판정의 "record 시각" 의미 정합). architect 는 ADR 1개(또는 기존 ADR-0044 §Follow-ups inline-amend)로 entity→{model, instantColumn} 매핑표 + projection-only(REQ-032) 근거를 박제하고, 매핑 결정만 implementer 에 넘긴다. DB write·schema 변경 0 이므로 BLOCKED 사유 아님 — read-only projection 매핑 결정만.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append — 예: `summarizeExportSelection`(T-0449)→previewSelection 결과를 사람-친화 breakdown 으로 합성하는 다음 slice(본 task 의 ExportSelection 산출 위에 자연 연결). `estimateExportDumpSize`→`buildExportJobPlan`→`buildExportResult` 의 순차 배선 chain. api.md §5 에 신설 POST /api/admin/export/preview-selection 계약 문서화(별도 direct doc-sync). range scope 의 5 entity instant 컬럼 cross-table 조회 성능 — 대량 row 시 인덱스/집계 쿼리 전환 검토(별도 task). Import 측 대칭 preview 배선 slice.)
