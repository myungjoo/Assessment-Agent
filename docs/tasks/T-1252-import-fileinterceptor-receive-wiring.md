---
id: T-1252
title: Import multipart 수신 배선 — FileInterceptor + @UploadedFile (ADR-0055 §Follow-up a)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 165
estimatedFiles: 3
created: 2026-07-27
independentStream: import-multipart-wiring
dependsOn: [T-1251]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/uploaded-dump-file.ts
  - src/import/import.controller.spec.ts
plannerNote: "P5 import chain — ADR-0055 §Follow-up (a) 첫 코드 slice: POST /api/admin/import 에 FileInterceptor 수신 배선 + local 타입 (새 dep 0)."
---

# T-1252 — Import multipart 수신 배선 (FileInterceptor + @UploadedFile)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) (T-1251, merge 7236b046) 가 **import canonical = multipart 파일 업로드** 를 ACCEPTED 로 박제했다. 본 task 는 그 ADR 의 **§Follow-ups (a) — 수신 실 배선** slice 로, 현재 JSON `CreateImportDto` body 만 받는 `POST /api/admin/import` ([import.controller.ts](../../src/import/import.controller.ts)) 에 `@UseInterceptors(FileInterceptor("file"))` + `@UploadedFile()` 를 추가해 dump artifact 파일을 in-memory buffer 로 수신한다. [ADR-0055 §Decision 1](../decisions/ADR-0055-import-multipart-file-upload.md) (FileInterceptor 수신, 새 runtime dep 0) + §Decision 2 (memoryStorage buffer) + §Decision 4 (zero-dep local 타입) 를 구현한다. [REQ-030](../requirements.md) (Import) / [REQ-032](../requirements.md) (raw 미저장) / [REQ-045](../requirements.md) (Admin 전용) 를 cover.

**본 slice 의 경계**: 파일을 *받는 입구* 만 연다. 받은 buffer 를 실제 복원 엔진에 넘기는 것은 §Follow-up (b), 크기 제한은 (c), interim false-success guard 는 (d) — 각 후속 task. 본 task 이후에도 controller 는 여전히 job record (status=PENDING) 만 만든다 (ADR-0055 §Consequences 의 "chain 완주 전 interim false-success 상태" 그대로 — 본 task 가 그 상태를 해소하지 않으며, buffer 를 소비하지 않고 수신만 검증).

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Decision 1 (FileInterceptor 수신 mechanism, 새 runtime dep 0) / §Decision 2 (memoryStorage buffer) / §Decision 4 (zero-dep local 타입) / §Consequences 부정 (interim false-success) / §Follow-ups (a). 본 task 의 직접 상류 결정.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — 현재 JSON-only `create()` + RBAC guard stack (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) + controller-scope `@UsePipes(ValidationPipe)`. 배선 대상.
- [src/import/dto/create-import.dto.ts](../../src/import/dto/create-import.dto.ts) — `CreateImportDto { mode? }` (`@IsOptional` + `@IsEnum(ImportMode)`). multipart/form-data 에서 `mode` 가 form field(문자열)로 도착할 때 ValidationPipe `transform` 동작 확인 대상.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) — 기존 controller unit spec (832 LOC). `create()` 관련 happy/RBAC test 위치 파악 후 multipart 수신 + 파일 누락 분기 test 추가 (colocated spec).
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) — `createJob({ mode?, requestedById })` 시그니처 (본 task 는 이 시그니처를 **바꾸지 않는다** — buffer 를 넘기지 않음, 수신만).
- `package.json` — `@nestjs/platform-express@10.4.4` (multer bundled, `FileInterceptor`/`@UploadedFile` 제공) 존재 확인. `@types/multer` 는 부재 — §Decision 4 local 타입으로 처리 (새 dep 0 유지).
- [CLAUDE.md §3.1 / §3.2 / §5 / §12](../../CLAUDE.md) — commitMode / R-112 test / BLOCKED 게이트 (새 dependency 금지) / 언어 정책.

## Acceptance Criteria

- [ ] `src/import/uploaded-dump-file.ts` 신설 — ADR-0055 §Decision 4 의 zero-dep local 타입 (`interface UploadedDumpFile { buffer: Buffer; originalname: string; size: number; mimetype: string }` 형태). `@types/multer` 를 devDependency 로 추가하지 않는다 (새 dep 0).
- [ ] `import.controller.ts` 의 `create()` 에 `@UseInterceptors(FileInterceptor("file"))` + `@UploadedFile() file: UploadedDumpFile` 추가 (ADR-0055 §Decision 1). `FileInterceptor` 는 `@nestjs/platform-express` 에서 import — `package.json` 변경 0.
- [ ] **파일 누락 분기**: 업로드 파일이 없으면 (`file` undefined) `BadRequestException` (400) 으로 거부. 파일 수신 시에는 기존대로 `service.createJob({ mode, requestedById })` 로 진행 (buffer 미소비 — 복원은 §Follow-up (b) slice).
- [ ] `import.module.ts` 변경 불요 확인 — `FileInterceptor` 는 `@nestjs/platform-express` 위에서 별도 module import 없이 동작 (변경 발생 시 5 파일 cap / touchesFiles 재검토, planner 인계).
- [ ] `mode` form field 처리 확인 — multipart/form-data 에서 `mode` 가 문자열 form field 로 도착할 때 controller-scope `ValidationPipe(transform:true)` + `CreateImportDto @IsEnum(ImportMode)` 이 정상 검증 (미지정 → undefined forward, 비유효 값 → 400). DTO 재배치가 필요하면 최소 변경으로 처리하고 근거를 주석에 박제.
- [ ] controller 상단 comment block 의 "multipart 파일 수신 0 — JSON CreateImportDto body 만" 서술을 현행화 (수신 배선 완료 반영, 단 buffer 는 복원 미소비 = interim 명시).
- [ ] **happy-path unit test**: `create()` 가 multipart 파일 수신 시 `service.createJob` 호출 + job record 반환 test 1+.
- [ ] **error path unit test**: 파일 누락 시 `BadRequestException`(400) test 1+.
- [ ] **flow / branch test**: 파일 있음 / 없음 두 분기 각 1+ test. `mode` 지정 / 미지정 분기 각 1+ (기존 test 재사용 가능).
- [ ] **negative cases 충분 cover**: 비 Admin actor 403 (RolesGuard) / 미인증 401 (JwtAuthGuard) / 비유효 mode form field 400 (ValidationPipe) 각 1+ test. 단일 negative 만 금지 — 분기마다 cover (기존 RBAC test 존재 시 파일 수신 축으로 확장).
- [ ] `tester` 가 R-110 검증: `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **dump buffer 파싱 → 실 복원 엔진** (역직렬화 → ADR-0044 §3 atomic `$transaction`) — §Follow-up (b) slice. 본 task 는 buffer 를 받되 소비하지 않는다.
- **크기 제한 config** (`limits.fileSize` 상한 수치 + 초과 거부 413/400 + `MulterError → 4xx` 예외 필터 매핑) — §Follow-up (c) slice (reviewer NIT-1 인계 대상, 아래 Follow-ups).
- **interim false-success guard** (복원 미배선 동안 import 성공 오표기 방지) — §Follow-up (d) slice.
- **`ImportJobService.createJob` 시그니처 변경** — buffer 를 service 로 넘기는 것은 (b) slice. 본 task 는 `{ mode?, requestedById }` 시그니처 보존.
- **e2e / supertest 추가** — colocated unit spec 만. e2e 는 복원 엔진 (b) 완주 후 별도 task.
- **web/ import UI multipart form 배선** — 별도 P6/web slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **reviewer NIT-1 (PR #1142) 재인계**: ADR-0055 §Decision 3 크기 제한을 구현하는 §Follow-up (c) slice 의 Acceptance Criteria 에 `MulterError`(`LIMIT_FILE_SIZE`) → 4xx(413) 예외 필터 매핑을 명시할 것 — multer 상한 초과는 default exception filter 하에서 500 으로 표면화되므로 구현자가 자동 4xx 를 가정하지 않도록. 본 task (a) 는 크기 제한 미포함이라 해당 없음, (c) slice 로 이월.
