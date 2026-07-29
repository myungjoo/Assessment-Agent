---
id: T-1299
title: POST /api/admin/import/preview 배선 — 복원 실행 없이 영향 요약만 반환 (controller slice 3c-5b)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1297]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 약 255 LOC / 2 파일. T-1297 의 previewFromDump 호출처 0 을 HTTP entry 로 닫는 slice (UC-07 §5 64 행 confirmation 영향 범위)"
---

# T-1299 — POST /api/admin/import/preview 배선 (controller slice 3c-5b)

## Why

[T-1297](T-1297-restore-preview-dry-run.md) (머지 `642f95f5`) 이 [`ImportRestoreService.previewFromDump`](../../src/import/import-restore.service.ts) 를 신설해 **복원을 실행하지 않고 영향 요약만** 산출하는 service 경로를 만들었다. 그러나 그 메서드는 아직 **production 호출처가 0** 이다 — [UC-07](../use-cases/UC-07-export-import.md) §5 sequence 64 행이 요구하는 "Import 는 강한 confirmation — destructive 명시 + **영향 범위** + 기존 데이터 삭제 경고" 는 여전히 실행 **뒤** 응답 (`restoreSummary`, [T-1296](T-1296-import-response-restore-summary.md)) 으로만 얻어진다.

본 slice 는 그 호출처 한 겹을 HTTP entry 로 만든다 — [`ImportController`](../../src/import/import.controller.ts) 에 `POST /api/admin/import/preview` 를 추가해, 기존 `create` 와 **똑같은 업로드 수신 stack** (Admin+ RBAC · `FileInterceptor` + `MAX_IMPORT_FILE_SIZE_BYTES` 상한 · `MulterExceptionFilter` 413 매핑 · `CreateImportDto` mode) 위에서 `previewFromDump` 만 호출하고 그 `RestorePlanSummary` 를 그대로 반환한다. **job row 생성 0 · runner 호출 0 · DB write 0** — dry-run 이 `ImportJob` 을 남길 이유가 없고 (T-1297 판단 유지), 반환 타입이 실행 응답의 `restoreSummary` 와 **같은 타입** 이라 preview 수치와 실행 후 수치를 client 가 직접 비교할 수 있다.

실 HTTP 왕복 e2e (같은 dump 로 preview → 실행 시 두 요약이 일치) 는 **다음 slice (3c-5c)** 다. controller + spec + e2e 를 한 slice 에 합치면 파일 수·LOC cap 을 넘긴다.

**estimate 근거** — controller 핸들러 + 근거 주석 + 모듈 헤더 갱신 ~60 LOC, spec (unit 6~8 케이스 + metadata 단언 + RBAC integration + 두 TestingModule harness 의 provider 보강) ~110 → base ~170, R-112 backbone × 1.5 → **~255 LOC / 2 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 전문 (290 행) — **본 task 의 주 변경 대상**. 특히 (a) 모듈 헤더의 endpoint surface 목록 (본 slice 가 한 줄 추가), (b) `MAX_IMPORT_FILE_SIZE_BYTES` 상수와 그 근거 주석 (**재사용, 수정 0**), (c) `CreateImportResponse` 선언부 (본 slice 는 이 타입을 건드리지 않는다), (d) `create` 핸들러의 decorator stack (`@Post()` / `@UseGuards(JwtAuthGuard, RolesGuard)` / `@Roles("Admin")` / `@UseFilters(MulterExceptionFilter)` / `@UseInterceptors(FileInterceptor(...))` / `@UploadedFile()` / `@Body()` / `@CurrentUser("sub")`) 과 파일 누락 400 분기 — preview 는 이 stack 을 **그대로 mirror** 한다. 라우트 선언 순서 주의 사항 (고정 segment 를 `:id` 보다 먼저) 도 그대로 적용.
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 의 `previewFromDump(buffer: Buffer, mode: ImportMode): Promise<RestorePlanSummary>` 시그니처와 헤더 주석의 전파 계약 (거부 verdict → `BadRequestException`, read 단계 throw 는 인스턴스 그대로 전파, 재랩핑 · 흡수 0). **0 수정** — controller 는 호출만 한다.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 의 harness 구역 — **두 번째 변경 대상**. 재사용할 것: 상단 `jest.mock("../persistence/prisma.service")`, `buildImportJobFixture`, `buildServiceMock()` (170~177 행 부근 — `new ImportController(service, runner)` 조립), 179 행 unit describe, 593 행 guard/@Roles metadata describe, 629 행 크기 상한 + 예외 필터 describe, 653 행 RBAC + ValidationPipe integration describe (697 행 `Test.createTestingModule` providers), 1219 행 real RolesGuard escalation describe (1256 행 providers). **새 harness · 새 fixture 를 중복 신설하지 않는다** — 기존 조립 함수에 restore mock 을 최소 확장한다.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 23~38 행 (`RestorePlanGroupBreakdown` / `RestorePlanSummary`) — 반환 타입 정본. **0 수정**.
- [src/import/dto/create-import.dto.ts](../../src/import/dto/create-import.dto.ts) — `mode` 선택 필드의 검증 계약 (preview 도 같은 DTO 를 재사용, 새 DTO 신설 0).
- [src/import/import.module.ts](../../src/import/import.module.ts) 52~67 행 — `ImportRestoreService` 가 이미 `providers` · `exports` 에 등록돼 있음을 확인만 한다 (T-1282). **본 task 에서 module 수정 0**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 sequence 64 행 (confirmation — destructive 명시 + 영향 범위) + §7.4 (transaction 시작 전 reject, DB 변경 0) — 본 endpoint 가 채우는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `src/import/import.controller.ts`, `src/import/import.controller.spec.ts` **만**. `import.module.ts` · `import-restore.service.ts` · `import-job.service.ts` · `import-job-runner.service.ts` · `dto/**` · `src/export/**` · `test/e2e/**` · `prisma/**` · `web/**` · `package.json` · `docs/**` **0 수정**.
- [ ] **`@Post("preview")` 핸들러 신설** — 시그니처는 `preview(@UploadedFile() file: UploadedDumpFile | undefined, @Body() dto: CreateImportDto): Promise<RestorePlanSummary>`. decorator stack 은 `create` 와 동일 (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@UseFilters(MulterExceptionFilter)` + `@UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES } }))`). 상수는 **재사용** 하며 새 상한 값을 만들지 않는다.
- [ ] **`ImportRestoreService` 를 constructor 3 번째 의존으로 주입** — `import type` 이 아니라 **값 import** (DI 메타데이터 소거 방지 — 기존 `ImportJobRunnerService` 주석의 근거 동일). `import.module.ts` 는 이미 등록돼 있으므로 수정 0.
- [ ] **본문 3 단계** — (1) `file === undefined` 면 `BadRequestException(400)`, (2) `mode` 해석, (3) `this.restore.previewFromDump(file.buffer, mode)` 반환. `service.createJob` · `runner.runJob` 은 **어느 경로에서도 호출 0** 이고, 반환 요약은 service 인스턴스 **그대로** (복제 · 재계산 · 필드 pick · 재랩핑 0).
- [ ] **파일 누락 message 중복 0** — `create` 와 preview 가 같은 400 문구를 쓰되 문자열 리터럴을 사본으로 두지 않는다 (모듈 상단 상수 1 개로 추출해 양쪽이 참조). **기존 `create` 의 message 문자열은 한 글자도 바뀌지 않아야** 한다 (기존 spec · e2e 단언 무수정 통과가 그 증거).
- [ ] **mode 미지정 분기** — preview 는 job row 를 만들지 않아 schema `@default(REPLACE)` 가 적용될 자리가 없다. `dto.mode` 가 `undefined` 면 `ImportMode.REPLACE` 로 해석해 실행 경로 (`create` → schema default) 와 **같은 수치** 가 나오도록 하고, 그 근거 (schema default mirror · drift 시 두 경로가 어긋난다는 사실) 를 한국어 주석으로 박제한다.
- [ ] **주석** — 모듈 헤더의 endpoint surface 목록에 `POST /api/admin/import/preview` 한 항목 추가 (DB write 0 · job row 0 · 실행 응답과 같은 타입 반환 · e2e 는 다음 slice). 핸들러 위에 3 단계 주석 (`create` 스타일) — 단 `create` 주석의 근거를 사본으로 반복하지 않고 차이 (job 미생성 · runner 미호출 · transaction 미개시) 만 적는다. §12 한국어.
- [ ] **happy-path unit test 1+** — mock `previewFromDump` 가 요약 fixture 를 resolve 할 때 (a) 반환이 그 **인스턴스 그대로** (`toBe`), (b) `previewFromDump` 가 `(file.buffer 동일 인스턴스, ImportMode.MERGE)` 로 **1 회** 호출 (buffer 복사 · slice 0), (c) `createJob` · `runJob` 이 **0 회** 호출됨을 단언.
- [ ] **error path unit test 1+** — (a) `previewFromDump` 가 `BadRequestException` (거부 verdict) 으로 reject 하면 controller 가 **인스턴스 그대로** 전파 (`rejects.toBe`, 재랩핑 · try/catch 0), (b) `previewFromDump` 가 `TypeError` 를 던져도 흡수 없이 그대로 전파, (c) 두 경우 모두 `createJob` · `runJob` 0 회.
- [ ] **분기 cover** — (a) 파일 누락 → 400 이고 `previewFromDump` **0 회**, (b) `dto.mode` 지정 (MERGE / REPLACE 둘 다) → 변환 없이 그대로 forward, (c) `dto.mode` 미지정 → `ImportMode.REPLACE` forward.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 미인증 요청 401 (`JwtAuthGuard`, supertest), (b) User actor 403 (`RolesGuard` tier 미달) 이고 그때 `previewFromDump` 0 회 (guard 가 파일 파싱 전에 차단), (c) Admin / SuperAdmin 은 통과 (real RolesGuard escalation describe 확장), (d) `CreateImportDto` 에 없는 필드를 form 에 실으면 `forbidNonWhitelisted` 로 400 (raw 본문 키 거부 — REQ-032), (e) 400 응답 body 에 dump 원문 · plan payload · stack 이 실리지 않음 (sentinel 문자열 미포함으로 확인), (f) preview 요청이 `importJob` prisma mock 의 어떤 write 도 트리거하지 않음 (`create` / `update` mock 0 회 — DB write 0 의 controller 층 증거).
- [ ] **metadata 단언 확장** — 기존 guard/@Roles metadata describe (593 행) 에 `preview` 핸들러의 `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` 부착 단언 추가. 기존 크기 상한 + 예외 필터 describe (629 행) 에 preview 핸들러에도 `MulterExceptionFilter` + `FileInterceptor` 상한이 붙어 있다는 단언 추가 (413 매핑이 preview 에도 적용됨).
- [ ] **기존 단언 무수정** — `create` / `findRunning` / `describeModes` / `findJob` 에 관한 기존 spec 단언은 **한 줄도 수정하지 않는다** (허용 변경은 두 `Test.createTestingModule` providers 배열과 `buildServiceMock` 조립부에 restore mock 을 더하는 것뿐). 기존 단언 수정이 필요해지면 그것은 회귀 신호 — 멈추고 원인을 PR body 에 기록한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `import.controller.ts` 의 line/branch/function coverage 종전 수치 (100%) 유지.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green (e2e 는 무회귀 확인 — 본 slice 는 e2e 0 추가).
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 2 파일. 초과가 예상되면 negative (e) → (f) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **하류 결함 발견 시 수정 금지** — 배선 중 `ImportRestoreService` · runner · DTO 쪽 결함이 드러나면 그 파일들을 고치지 말고 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **e2e 0** — 실 HTTP 왕복 (같은 dump 로 preview 수치 ↔ 실행 후 `restoreSummary` 일치) 검증은 다음 slice (3c-5c). `test/e2e/**` 를 열지 않는다.
- **web (frontend) 배선 0** — confirmation dialog 가 preview 를 호출하도록 바꾸는 것은 P6 축. `web/**` 0 수정.
- **문서 동기 0** — [docs/architecture/api.md](../architecture/api.md) · UC-07 에 새 endpoint 를 적는 것은 별도 direct-mode doc task (§3.1 rule 3 — 한 task 에 두 commitMode 를 섞지 않는다).
- **응답 shape 확장 0** — 반환은 `RestorePlanSummary` 그대로. `{ mode, summary }` 같은 wrapper 나 job 필드 동봉은 하지 않는다 (실행 응답의 `restoreSummary` 와 **같은 타입** 이어야 preview ↔ 실행 비교가 성립).
- **`CreateImportResponse` · `create` 의 의미 변경 0** — 응답 필드 개명 / 삭제 / 순서 변경 0.
- **preview 결과 영속화 0 · `ImportJob` row 생성 0 · audit row 0** — schema 변경은 §5 BLOCKED 이고 dry-run 이 row 를 남길 이유도 없다.
- **REPLACE 비선별 삭제 차단 / 경고 정책 구현 0** — 수치를 보여줄 뿐 차단 판단은 제품 결정 (Follow-ups 유지).
- **새 DTO · 새 ADR · 새 외부 dependency 0** — `CreateImportDto` · `FileInterceptor` (@nestjs/platform-express 내장) 재사용.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 의 다음 겹, 3c-5c) `POST /api/admin/import/preview` 실 HTTP 왕복 e2e — 같은 dump 를 preview → 실행으로 연달아 보내 두 요약 (`preview` 응답 ↔ `restoreSummary`) 이 일치하고, preview 만 보낸 경우 DB row 가 전혀 바뀌지 않음을 박제.
- (본 slice 가 낳음) api.md / UC-07 §5 에 preview endpoint 계약 (route · RBAC · 요청 multipart · 응답 `RestorePlanSummary` · DB write 0) 문서 동기 — direct-mode doc task.
- (본 slice 가 낳음) preview 응답에 **해석된 mode 를 echo** 할지 판단 — `mode` 미지정 시 client 는 어떤 mode 기준 수치인지 알 수 없다. shape 확장이라 별도 slice.
- (유지, T-1293~T-1297) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview endpoint 로 실행 전 수치는 보여줄 수 있게 됐으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1297 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 정상 경로 도달 불가하나 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1297 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
