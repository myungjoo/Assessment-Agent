---
id: T-1253
title: Import 업로드 크기 제한 + MulterError→4xx 예외 필터 (ADR-0055 §Follow-up c)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 180
estimatedFiles: 4
created: 2026-07-27
independentStream: import-multipart-wiring
dependsOn: [T-1252]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/multer-exception.filter.ts
  - src/import/multer-exception.filter.spec.ts
  - src/import/import.controller.spec.ts
plannerNote: "P5 import chain — ADR-0055 §Follow-up (c) slice: FileInterceptor limits.fileSize 상한 + MulterError(LIMIT_FILE_SIZE)→413 예외 필터 매핑 (NIT-1 회수)."
---

# T-1253 — Import 업로드 크기 제한 + MulterError→4xx 예외 필터

## Why

[ADR-0055 §Decision 3](../decisions/ADR-0055-import-multipart-file-upload.md) 은 "`limits.fileSize` 상한이 반드시 강제된다" 는 invariant 를 박제했다 — 상한 없는 memoryStorage ([§Decision 2](../decisions/ADR-0055-import-multipart-file-upload.md)) 는 무제한 업로드가 프로세스 메모리를 소진시키는 **DoS 표면**이며, 상한 강제가 memoryStorage 채택의 **안전 전제**다. T-1252 (§Follow-up a, merge 21c167d4) 가 `FileInterceptor("file")` 수신 배선을 완료했으나 `limits` 를 미지정한 상태다. 본 task 는 §Follow-up (c) slice 로 (1) `FileInterceptor` 에 `limits.fileSize` 상한을 지정하고, (2) multer 가 상한 초과 시 던지는 `MulterError` (`LIMIT_FILE_SIZE`) 를 NestJS 예외 필터로 **413 Payload Too Large** 로 매핑한다. 이는 [T-1252 Follow-ups](T-1252-import-fileinterceptor-receive-wiring.md) 에 재인계된 **reviewer NIT-1** 의 회수다 — multer 상한 초과는 default exception filter 하에서 500 으로 표면화되므로 명시적 4xx 매핑이 없으면 구현이 자동 4xx 를 가정할 수 없다. [REQ-030](../requirements.md) (Import) / [REQ-032](../requirements.md) (raw 미저장 — 메모리 잔류 상한) / [REQ-045](../requirements.md) (Admin 전용) cover.

**본 slice 의 경계**: 크기 상한 강제 + 초과 거부 응답 매핑만. buffer 파싱→실 복원 엔진은 §Follow-up (b), interim false-success guard 는 (d) — 각 별도 task. 본 task 이후에도 controller 는 여전히 job record (status=PENDING) 만 만든다 (buffer 미소비 유지).

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Decision 2 (memoryStorage DoS 표면) / §Decision 3 (`limits.fileSize` 상한 invariant + 413 권장) / §Decision 4 (zero-dep local 타입 — 직접 multer API 호출 회피 원칙) / §Consequences 부정 (memoryStorage 대용량 압박). 본 task 의 직접 상류 결정.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — 현재 `@UseInterceptors(FileInterceptor("file"))` (limits 미지정) 배선 + `create()` 파일 누락 400 분기 + RBAC guard stack. 상한 지정 + 필터 적용 대상.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) — 기존 controller unit spec. `create()` 수신 / 파일 누락 / RBAC test 위치 파악 후 필터 적용 배선 test 확장 (colocated spec).
- [src/import/uploaded-dump-file.ts](../../src/import/uploaded-dump-file.ts) — T-1252 신설 zero-dep local 타입 (본 task 는 이 파일을 **바꾸지 않는다** — 참고만).
- `package.json` — `@nestjs/platform-express@10.4.4` (multer bundled). `@types/multer` 부재 유지 — MulterError 는 직접 import 하지 말고 duck typing (`err.name === "MulterError"`) 으로 감지 (§Decision 4 새 dep 0 유지, 직접 multer API 호출 회피).
- [CLAUDE.md §3.1 / §3.2 / §5 / §12](../../CLAUDE.md) — commitMode / R-112 test / BLOCKED 게이트 (새 dependency 금지) / 언어 정책.

## Acceptance Criteria

- [ ] `src/import/multer-exception.filter.ts` 신설 — NestJS `ExceptionFilter` 구현. multer 가 던진 error 를 duck typing (`exception?.name === "MulterError"`) 으로 감지해 매핑:
  - `code === "LIMIT_FILE_SIZE"` → **413 Payload Too Large** (`PayloadTooLargeException`).
  - 그 외 `MulterError` (예: `LIMIT_UNEXPECTED_FILE`) → **400 Bad Request** (`BadRequestException`).
  - `HttpException` (파일 누락 400 / service 4xx 등) → **원래 status·body 그대로 passthrough** (재매핑 0 — swallow 금지).
  - 그 외 unknown error → 500 (default 동작 보존).
  `@types/multer` 를 devDependency 로 추가하지 않는다 (새 dep 0). multer 를 직접 import 하지 않는다 (§Decision 4).
- [ ] 업로드 크기 상한 상수 (예: `export const MAX_IMPORT_FILE_SIZE_BYTES = <상한>`) 를 정의하고 근거를 주석에 박제 (env override 는 본 slice 범위 밖 — 후속 follow-up 로 명시). 분기 있는 env parsing 은 도입하지 않는다 (R-112 entrypoint 예외 회피 — 단순 상수).
- [ ] `import.controller.ts` 의 `@UseInterceptors(FileInterceptor("file"))` 를 `@UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES } }))` 로 변경 + `@UseFilters(MulterExceptionFilter)` 를 `create()` (또는 controller scope) 에 적용. 상한 초과 시 multer 가 `MulterError(LIMIT_FILE_SIZE)` 를 던지고 필터가 413 으로 변환.
- [ ] controller 상단 comment block 의 수신 서술을 현행화 — 크기 상한 강제 + 413 매핑 반영 (단 buffer 는 여전히 복원 미소비 = interim 명시 유지).
- [ ] **happy-path unit test**: 상한 이하 파일 수신 시 정상 `create()` 진행 (필터가 정상 흐름을 방해하지 않음) test 1+. 필터의 `HttpException` passthrough 가 원래 status 를 보존하는 test 1+.
- [ ] **error path unit test**: `MulterError(LIMIT_FILE_SIZE)` 입력 시 필터가 413 반환 test 1+. 파일 누락 (`BadRequestException` 400) 이 필터 통과 후 400 유지 test 1+.
- [ ] **flow / branch test**: 필터의 4 분기 (LIMIT_FILE_SIZE→413 / 기타 MulterError→400 / HttpException passthrough / unknown→500) 각 1+ test.
- [ ] **negative cases 충분 cover**: 상한 초과 413 / 예상치 못한 필드 MulterError 400 / null·undefined exception 방어 / non-Error object 방어 / 비 Admin 403·미인증 401 이 필터 도입 후에도 보존 각 1+ test. 단일 negative 만 금지 — 분기마다 cover.
- [ ] `tester` 가 R-110 검증: `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **dump buffer 파싱 → 실 복원 엔진** (역직렬화 → ADR-0044 §3 atomic `$transaction`) — §Follow-up (b) slice. 본 task 는 buffer 미소비.
- **interim false-success guard** (복원 미배선 동안 import 성공 오표기 방지) — §Follow-up (d) slice.
- **상한 수치 env override / 동적 config** — 본 slice 는 단순 상수만 (분기 있는 env parsing 도입 금지). env override 는 별도 follow-up.
- **초과 시 job status 처리 (FAILED 기록 등)** — 본 slice 는 요청 거부 (413) 만. job record 생성 전에 거부되므로 별도 status 처리 불요 (필요 판명 시 후속 task).
- **`ImportJobService.createJob` 시그니처 변경** — 보존.
- **memoryStorage 대용량 근본 완화** (streaming 파싱 / diskStorage) — 후속 task (§Consequences 부정 근거).
- **e2e / supertest 추가** — colocated unit spec 만. e2e 는 복원 엔진 (b) 완주 후 별도 task.
- **web/ import UI 크기 제한 안내** — 별도 P6/web slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **env override 이월**: `MAX_IMPORT_FILE_SIZE_BYTES` 를 배포 환경별로 조정하려면 env parsing helper (분기 있음 → 별도 함수 + spec, CLAUDE.md §3.2 entrypoint 예외) 가 필요 — 실 필요 실측 시 별도 task 로 박제.
- **§Follow-up (b) 상류 note**: 복원 엔진 slice 는 본 task 가 확정한 상한 이하 buffer 만 받는다는 전제로 파싱 로직을 설계할 것 (상한 초과는 필터가 이미 413 으로 차단).

## Result

- **DONE** 2026-07-27T05:38:36Z — PR [#1144](https://github.com/myungjoo/Assessment-Agent/pull/1144) squash merge `d0e30938`.
- `FileInterceptor("file")` 에 `limits.fileSize=MAX_IMPORT_FILE_SIZE_BYTES`(50MiB 상수) + `@UseFilters(MulterExceptionFilter)`. 필터는 zero-dep duck typing 으로 `LIMIT_FILE_SIZE`→413 / 기타 MulterError→400 / HttpException passthrough / unknown→500 매핑.
- reviewer round1 APPROVE (0 BLOCKER / 0 MAJOR / 3 MINOR·NIT 전부 justified). NIT(PR body 죽은 링크)은 body metadata edit 로 closure. 대상 2파일 coverage 100%, CI green (4-게이트 PASS).
- Follow-up: env override(§Follow-ups), buffer 파싱 실복원 엔진(ADR-0055 §Follow-up b), interim false-success guard(§Follow-up d) 각 별도 task 이월.
