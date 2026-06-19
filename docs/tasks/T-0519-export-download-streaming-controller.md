---
id: T-0519
title: GET /api/admin/export/:id/download streaming controller 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-06-19
independentStream: export-download-chain
dependsOn: []
touchesFiles:
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: P5 export download chain — ADR-0047 §Follow-ups[3]. service materialize(T-0518) Readable 을 controller 가 pipe + download header 배선 (R-112 backbone × 1.5 ≈ 270 LOC)
---

# T-0519 — GET /api/admin/export/:id/download streaming controller 배선

## Why

ADR-0047 §Follow-ups[3] chain 의 다음 dependency-free 조각이다. 직전 T-0518 이
`ExportJobService.materializeFullExportDownload(scope)` 를 배선해 "scope → full-record
DB-read → fields 보존 envelope → Node `Readable`" materialization 을 service 차원에서
완결했으나, 이 stream 을 사용자에게 내려주는 HTTP 표면이 아직 없다. 본 task 는
`GET /api/admin/export/:id/download` controller route 를 추가해 (1) job 의 저장된 scope 로
service 의 Readable 을 얻고, (2) 다운로드 header(Content-Type / Content-Disposition,
T-0509 `serializeExportDownloadHeaders` 활용)를 설정한 뒤, (3) 그 Readable 을 HTTP response
로 흘려보낸다. REQ-030(Export) 의 실 다운로드 진입점이자 REQ-032(raw 미저장) 경계는 상류
projection-only read 로 이미 강제된다. ADR-0047 ACCEPTED 가 컬럼/저장 경계를 닫았고
Q-0043 옵션1 이 service-layer 배선 방향을 승인했으므로 본 task 는 "결정된 ADR 구현"
(CLAUDE.md §5 자동 진행 — 신규 외부 dep / schema migration / auth 표면 0).

## Required Reading

- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision3 + §Follow-ups[3] (controller 배선 contract)
- `src/export/export.controller.ts` — 기존 route 패턴 (특히 `@Get(":id/status-view")` / `@Get(":id")` 의 RBAC·route 선언 순서·raw forward 정책)
- `src/export/export.controller.spec.ts` — 기존 controller unit test 패턴 (service mock 방식)
- `src/export/export-job.service.ts` L453–499 — `materializeFullExportDownload(scope): Promise<Readable>` 시그니처 + `findJob(id)` (저장된 scope 조회)
- `src/export/export-download-headers.ts` — `serializeExportDownloadHeaders(descriptor, contentRange?): Record<string,string>` 시그니처
- `src/export/export-artifact-descriptor.ts` — `buildExportArtifactDescriptor(...)` 시그니처 (header 직렬화 입력 descriptor 산출)

## Acceptance Criteria

- [ ] `src/export/export.controller.ts` 에 `@Get(":id/download")` route 메서드 1개 추가. route 선언 순서는 NestJS path matching 안전을 위해 `:id` 동적 segment 보다 **앞**에 둔다 (기존 `running` / `:id/status-view` before `:id` 패턴 동형).
- [ ] RBAC 는 기존 export route 동형 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (Admin / SuperAdmin 통과, User 403, 미인증 401).
- [ ] 동작: `findJob(id)` 로 저장된 job 의 scope 를 얻어 `ExportScopePayload` 를 합성 → `materializeFullExportDownload(scope)` 로 Readable 획득 → `serializeExportDownloadHeaders(descriptor)` 로 산출한 header 를 response 에 설정 → Readable 을 response 로 stream. NestJS stream 전달은 `StreamableFile` 또는 `@Res({ passthrough: true })` 중 하나를 사용 (둘 중 선택을 코드 주석에 한국어로 근거 박제).
- [ ] **재필터 / secret strip / 컬럼 재검증 0** — 상류 T-0514 projection + T-0515 builder 가 이미 강제. controller 는 raw forward (descriptor single-source 정신).
- [ ] **Happy-path unit test 1+** — 정상 job(존재 + Admin) 다운로드 시 service.materializeFullExportDownload 가 job scope 로 호출되고, 산출 Readable + 다운로드 header(Content-Type / Content-Disposition)가 response 에 반영됨을 단언.
- [ ] **Error path unit test 1+** — job 부재 시 `findJob` 의 `NotFoundException`(404)이 swallow 없이 raw propagate 됨을 단언. 그리고 service.materializeFullExportDownload reject(의존성 실패)가 controller 를 통해 raw propagate 됨을 단언.
- [ ] **Flow / branch coverage** — scope literal(FULL / RANGE / PARTIAL) 분기 또는 header 설정 분기가 코드에 생기면 각 분기 1+ test. (분기 없이 raw forward 만이면 본문에 "controller 자체 분기 0 — raw forward, 이 항목 생략" 명시.)
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: (a) RBAC — User actor 403 / 미인증 401 (기존 export route 의 guard 단언 패턴 동형), (b) job 부재 404, (c) service reject propagate, (d) 빈 DB scope(예: 0 record materialization) 정상 stream 경계. 단일 negative 만으로 부족 — 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] controller 표면이므로 e2e/supertest 1+ — `GET /api/admin/export/:id/download` 가 존재하는 job 에 대해 다운로드 header + body stream 을 200 으로 반환함을 검증 (e2e harness 가 본 cap 안에서 무리면 unit-controller-test 로 표면을 cover 하고 e2e 는 Follow-ups 로 분리하되, 그 경우 PR 본문에 "e2e 후속 분리" 명시).

## Out of Scope

- import / upload 측 controller (multer / FileInterceptor 는 신규 외부 dep — 게이트3 미승인). 절대 추가 금지.
- chunk-plan 기반 chunk 단위 byte slice 다운로드 (resume / refetch / Content-Range) — 후속 task. 본 task 는 full dump 단일 stream 다운로드만.
- scope 기반 record 선별 결합 (materializeFullExportDownload 는 5 entity 전체 read — envelope scope 는 meta context 만). 변경 금지.
- 새 service 메서드 / 새 helper / 새 DTO 신설. 기존 `materializeFullExportDownload` / `findJob` / `serializeExportDownloadHeaders` / `buildExportArtifactDescriptor` 조합만 배선.
- prisma schema 변경 / migration / 새 외부 dependency / auth 흐름 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비움 — sub-agent 가 관련 작업 발견 시 추가)
