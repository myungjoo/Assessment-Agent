---
id: T-0489
title: ImportController + CreateImportDto + ImportModule 배선 — POST /api/admin/import job 생성·polling endpoint
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 280
estimatedFiles: 5
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0487, T-0488]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
  - src/import/dto/create-import.dto.ts
  - src/import/import.module.ts
  - src/app.module.ts
plannerNote: "P7 chain step6 — T-0488 ExportController 의 대칭 HTTP slice. ImportJobService(T-0487) 위에 POST /api/admin/import job 생성 + status polling + ImportModule 등록. multipart upload·45 helper 실호출은 후속."
---

# T-0489 — ImportController + CreateImportDto + ImportModule (HTTP-facing 배선)

## Why

P7 export/import 실 배선 chain 의 step6 다. step4 ([T-0487](T-0487-import-job-persistence-service.md), a451f6a) 가 `ImportJobService` (ImportJob 생성·status 전이·polling) 를, step5 ([T-0488](T-0488-export-controller-dto-module.md), PR-400 ec2fe31) 가 대칭 `ExportController` + `CreateExportDto` + `ExportModule` 을 박제·merge 했다. 그러나 그 `ImportJobService` 를 호출하는 **HTTP-facing controller·DTO·module 등록이 전부 부재** — [api.md](../architecture/api.md) §5 (L124) 의 `POST /api/admin/import` 계약이 구현 0 인 상태다.

[ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §Follow-ups 의 "export/import controller (`POST /api/admin/import`) + service 배선" 의 **Import 측 HTTP slice** 인 `ImportController` (import job 생성 + status polling 조회) 를 박제한다. [T-0488](T-0488-export-controller-dto-module.md) 의 `ExportController` RBAC stack (`@UsePipes(ValidationPipe{whitelist/forbidNonWhitelisted/transform})` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@CurrentUser("sub")` actor 결합 + service raw-forward) 을 1:1 mirror 한다 — 신규 auth 결정 0. **multipart 파일 수신·실 artifact 파싱·atomic transaction 복원·45 helper 실호출은 본 slice 밖** (§Out of Scope) — `ImportJobService.createJob` 이 `{ mode?, requestedById }` 만 받으므로 본 controller 는 JSON `CreateImportDto { mode? }` body 로 job record 만 생성한다 (multipart 는 `@nestjs/platform-express` Multer 등 새 infra 표면 → 별도 후속 slice). 이로써 [UC-07 §5](../use-cases/UC-07-export-import.md) 의 Import 측 HTTP entry 가 코드 차원에서 처음 채워진다 (REQ-030 Import, REQ-032 raw 미저장, REQ-045 Admin).

## Required Reading

- `src/import/import-job.service.ts` 전체 — 주입할 `ImportJobService` 의 `CreateImportJobInput` shape (`mode?: ImportMode` / `requestedById: string`) 과 `createJob` / `findJob` / `findRunning` 시그니처. controller 가 forward 할 대상. **raw payload 필드 0 — multipart file 입력 없음** (input 은 mode + requestedById 뿐).
- `src/export/export.controller.ts` 전체 — **mirror 대상**: controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + 각 endpoint `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@CurrentUser("sub")` actor 결합 + service raw-forward (controller 추가 4xx 변환 0) 패턴. 라우트 선언 순서 (`running` 고정 segment 를 `:id` 동적 segment 보다 먼저) 도 그대로.
- `src/export/export.module.ts` 전체 — `ImportModule` 의 mirror 대상. `imports: [AuthModule]` (guard 주입) + `controllers` + `providers`/`exports`. `PersistenceModule` 이 `@Global()` 이라 `PrismaService` 는 imports 명시 불요.
- `src/export/dto/create-export.dto.ts` — `CreateImportDto` 의 mirror 대상 (class-validator decorator 패턴). (없으면 `src/export/export.controller.ts` 의 `CreateExportDto` import 경로로 위치 확인 후 read.)
- `prisma/schema.prisma` 의 `enum ImportMode` (REPLACE / MERGE) — DTO 의 `mode` enum 검증 대상.
- `src/app.module.ts` 의 `imports:` 배열 — `ImportModule` 추가 위치 (`ExportModule` 등록 줄 인근).

## Acceptance Criteria

- [ ] `src/import/dto/create-import.dto.ts` 에 `CreateImportDto` 신설 — 선택 `mode?` (ImportMode enum, `@IsOptional` + `@IsEnum(ImportMode)`). 미지정 시 service 가 schema `@default(REPLACE)` 적용 (DTO 가 default 강제하지 않음). `requestedById` 는 DTO 가 아니라 인증 actor (`@CurrentUser("sub")`) 에서 추출 (client 가 임의 발화자 위장 불가, REQ-045). `whitelist` + `forbidNonWhitelisted` 로 정의 안 된 키 (raw payload 키 등) 거부 (ADR-0044 §2 raw 미저장 정합).
- [ ] `src/import/import.controller.ts` 에 `@Controller("api/admin/import") ImportController` 신설 — 생성자에서 `ImportJobService` 주입.
- [ ] `POST /api/admin/import` endpoint — `CreateImportDto` 를 받아 `@CurrentUser("sub")` actor id 를 `requestedById` 로 결합해 `ImportJobService.createJob({ mode: dto.mode, requestedById: actorSub })` 호출, 생성된 job (status=PENDING) 반환. **multipart 파일 수신 0 — JSON body 만** (실 artifact upload 는 §Out of Scope, 본문 주석에 근거 1줄 명시).
- [ ] status polling 조회 endpoint — `GET /api/admin/import/running` (`findRunning`, RUNNING 목록) + `GET /api/admin/import/:id` (단건 `findJob`, 부재 시 service 가 P2025→NotFoundException→404 raw forward). 라우트 선언 순서 — `running` 고정 segment 를 `:id` 동적 segment 보다 **먼저** 선언 (ExportController 동형, "running" 이 `:id` 로 포착 방지).
- [ ] RBAC — 3 endpoint 전부 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (REQ-045 Admin 전용). 인증 부재 → 401, 권한 미달(User) → 403 (기존 guard stack raw forward, 신규 auth 결정 0).
- [ ] `src/import/import.module.ts` 에 `ImportModule` 신설 — `imports: [AuthModule]` (guard 주입) + `ImportJobService` provider 등록·export + `ImportController` controller 등록. `PrismaService` 는 global PersistenceModule 에서 해결 (imports 명시 불요, ExportModule mirror).
- [ ] `src/app.module.ts` 의 `imports:` 배열에 `ImportModule` 추가 (app-wide 등록 — 미등록 시 endpoint live 0).
- [ ] **Happy-path unit test**: controller 의 각 public 메서드 (create / findRunning / findJob) 에 대해 정상 동작 test 1+ — `ImportJobService` mock 으로 호출 인자(actor id 결합·mode forward 포함)·반환 forward 검증.
- [ ] **Error path unit test**: `findJob` 부재 시 service 가 throw 한 NotFoundException 이 그대로 propagate(404) 1+; service 가 BadRequestException(invariant 위반, 예: requestedById 누락) throw 시 그대로 propagate(400) 1+.
- [ ] **Flow / branch cover**: create endpoint 의 mode 지정/미지정 분기 각 1+ test (mode 명시 시 forward, 미지정 시 `mode: undefined` forward — service default 위임 확인). polling 의 단건/목록 분기 각 1+. DTO 검증 분기(유효 mode / 잘못된 mode enum / 정의 안 된 필드 forbidNonWhitelisted) 각 1+.
- [ ] **Negative cases 충분 cover** — 잘못된 mode enum 값(400), 정의 안 된 raw payload 필드 포함(forbidNonWhitelisted 400), 인증 부재(401), User tier 권한 미달(403), 존재하지 않는 job id 조회(404) 각 1+ test (예외 처리 분기마다).
- [ ] colocated spec `src/import/import.controller.spec.ts` 작성 (NestJS convention — controller 와 같은 디렉토리, `src/import/`). `ImportJobService` 는 mock provider 로 주입. DTO 검증은 `ValidationPipe` transform/validate 동작을 spec 또는 별도 `src/import/dto/create-import.dto.spec.ts` 로 cover (DTO 분기가 있으면 colocated dto spec 권장 — cap 안에서면 본 task, 초과 risk 시 Follow-up).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%).

## Out of Scope

- **multipart 파일 수신 / 실 artifact upload·파싱** (`@nestjs/platform-express` Multer · `FileInterceptor` · `multer` 타입) — 새 infra 표면이라 별도 후속 slice. 본 controller 는 JSON `CreateImportDto` body 로 job record 생성·조회만 (api.md 의 "multipart file upload" 는 실 upload 배선 task 에서 충족). 새 dependency 추가 시 CLAUDE.md §5 게이트.
- **실 atomic transaction 복원 로직** (ADR-0044 §3 REPLACE `$transaction` reset-and-recreate · MERGE conflict resolution) — 후속 service task. 본 controller/service 는 status/artifactRef/restoredRowCount record 만, 실 DB-wide snapshot 복원 0.
- **45 helper (T-0437~T-0483) 실호출 배선** (chunked upload·dedup·retransmit) — 후속 task chain.
- **artifact 저장소 mechanism** (filesystem vs object storage) — ADR-0044 §Out of scope (새 dependency 가능성 → 별도 §5 게이트).
- **`/api/admin/export` / `/api/admin/backup` / `/api/admin/restore`** endpoint — 본 task 는 `/api/admin/import` 1 resource 만 (export 는 T-0488 merge).
- **신규 auth-flow / RBAC 정책 변경 0** — 기존 `JwtAuthGuard`+`RolesGuard`+`@Roles` stack 적용만.
- **응답 envelope 표준화 / pagination / sort** — service return 그대로 forward.
- `prisma/schema.prisma` 변경 0 (이미 T-0485 merge). `ImportJobService` 자체 로직 변경 0 (T-0487 merge 그대로 주입만). 새 외부 dependency / credential 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(생성 시 비움 — sub-agent 가 관련 작업 발견 시 append.)
