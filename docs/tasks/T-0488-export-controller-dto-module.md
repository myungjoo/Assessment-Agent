---
id: T-0488
title: ExportController + CreateExportDto + ExportModule 배선 — GET /api/admin/export job 생성·조회 endpoint
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 280
estimatedFiles: 5
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0486]
touchesFiles:
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
  - src/export/dto/create-export.dto.ts
  - src/export/export.module.ts
  - src/app.module.ts
plannerNote: "P7 chain step5 — ADR-0044 §Follow-ups 'controller/service 골격 배선' 의 HTTP-facing slice. ExportJobService(T-0486) 위에 GET /api/admin/export endpoint + DTO + ExportModule 등록. Import controller·45 helper 실호출은 후속."
---

# T-0488 — ExportController + CreateExportDto + ExportModule (HTTP-facing 배선)

## Why

P7 export/import 실 배선 chain 의 step5 다. step3 ([T-0486](T-0486-export-job-persistence-service.md), 1ae19cb) 이 `ExportJobService` (ExportJob 생성·status 전이·polling) 를, step4 ([T-0487](T-0487-import-job-persistence-service.md), a451f6a) 가 대칭 `ImportJobService` 를 박제·merge 했다. 그러나 그 service 를 호출하는 **HTTP-facing controller·DTO·module 등록이 전부 부재** — [api.md](../architecture/api.md) §5 의 `GET /api/admin/export` 계약이 구현 0 인 상태다.

[ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §Follow-ups 의 "AssessmentModule export/import controller (`GET /api/admin/export`) + service 골격 배선" 의 **dependency-order 첫 HTTP slice** 인 **ExportController** (export job 생성 + status polling 조회) 를 박제한다. 기존 controller (DifficultyMappingController T-0139 / SummaryController) 의 RBAC stack (`JwtAuthGuard` + `RolesGuard` + `@Roles("Admin")`) + `ValidationPipe` (whitelist / forbidNonWhitelisted / transform) 를 1:1 mirror 한다 — 신규 auth 결정 0. Import controller·45 helper (T-0437~T-0483) 실호출·실 dump 직렬화·artifact 저장소는 size cap (≤300 LOC / 5 파일) 준수를 위해 후속 task 로 분리한다 (§Out of Scope). 이로써 [UC-07 §5](../use-cases/UC-07-export-import.md) 의 Export 측 HTTP entry 가 코드 차원에서 처음 채워진다 (REQ-030 Export, REQ-032 raw 미저장, REQ-045 Admin).

## Required Reading

- `docs/decisions/ADR-0044-export-import-job-persistence.md` — Decision §1 (ExportJob 책임·scope), §2 (raw 미저장 — DTO 에 raw payload 필드 0), §5 (AuditLog 경계 — controller 는 job record 만)
- `docs/architecture/api.md` §5 `UC-07 Export / Import / Backup` 행 — `GET /api/admin/export` 계약 (resource path / `scope` query / Admin+ tier / content type)
- `src/export/export-job.service.ts` L49~75 — 주입할 `ExportJobService` 의 `CreateExportJobInput` shape (`scope: ExportScope` / `requestedById: string` / `dateRange?` / `entitySelector?`) 과 `createJob` / `findJob` / `findRunning` 시그니처. controller 가 forward 할 대상.
- `src/llm/difficulty-mapping.controller.ts` L1~45 — **mirror 대상**: controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + service raw-forward (controller 추가 4xx 변환 0) 패턴.
- `src/llm/llm.module.ts` L1~40 (헤더 + import 부) — module 구조 mirror 대상. `PersistenceModule` 이 `@Global()` 이라 `PrismaService` 는 imports 명시 불요 (UserModule 동일).
- `src/app.module.ts` L52~70 — `imports:` 배열에 `ExportModule` 추가 위치.
- `prisma/schema.prisma` L550~553 (`enum ExportScope` — FULL / RANGE / PARTIAL) — DTO 의 `scope` enum 검증 대상.

## Acceptance Criteria

- [ ] `src/export/dto/create-export.dto.ts` 에 `CreateExportDto` 신설 — `scope` (ExportScope enum, `@IsEnum`) + 선택 `dateRange?` / `entitySelector?` (scope=RANGE/PARTIAL 시). `class-validator` decorator 로 검증 (`whitelist` + `forbidNonWhitelisted` 로 raw payload 키 거부 — ADR-0044 §2 정합). `requestedById` 는 DTO 가 아니라 인증 actor (req.user) 에서 추출 (client 가 임의 발화자 위장 불가).
- [ ] `src/export/export.controller.ts` 에 `@Controller("api/admin/export") ExportController` 신설 — 생성자에서 `ExportJobService` 주입.
- [ ] `POST` (또는 `GET` query) `/api/admin/export` endpoint — `CreateExportDto` 를 받아 인증 actor id 를 `requestedById` 로 결합해 `ExportJobService.createJob` 호출, 생성된 job (status=PENDING) 반환. (api.md 는 `GET ... scope` query 로 명시 — endpoint 메서드/입력 위치는 api.md 계약 우선; job 생성이 mutation 이므로 POST 가 자연스러우면 본문에 근거 1줄 명시하고 api.md follow-up 으로 기록.)
- [ ] status polling 조회 endpoint — `GET /api/admin/export/:id` (단건 `findJob`, 부재 시 service 가 NotFoundException→404 raw forward) + `GET /api/admin/export` 의 running 목록 옵션 또는 `GET /api/admin/export/running` (`findRunning`, UC-07 §8 status polling). 1 polling 경로면 충분.
- [ ] RBAC — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (REQ-045 Admin 전용). 인증 부재 → 401, 권한 미달(User) → 403 (기존 guard stack raw forward, 신규 auth 결정 0).
- [ ] `src/export/export.module.ts` 에 `ExportModule` 신설 — `ExportJobService` provider 등록 + `ExportController` controller 등록. `PrismaService` 는 global PersistenceModule 에서 해결 (imports 명시 불요, llm.module mirror).
- [ ] `src/app.module.ts` 의 `imports:` 배열에 `ExportModule` 추가 (app-wide 등록 — 미등록 시 endpoint live 0).
- [ ] **Happy-path unit test**: controller 의 각 public 메서드 (create / findJob / findRunning) 에 대해 정상 동작 test 1+ — `ExportJobService` mock 으로 호출 인자(actor id 결합 포함)·반환 forward 검증.
- [ ] **Error path unit test**: `findJob` 부재 시 service 가 throw 한 NotFoundException 이 그대로 propagate(404) 1+; service 가 BadRequestException(scope invariant 위반) throw 시 그대로 propagate(400) 1+.
- [ ] **Flow / branch cover**: create endpoint 의 actor id 결합 분기 + scope 별 입력 분기, polling 의 단건/목록 분기 각 1+ test. DTO 검증 분기(유효 scope / 잘못된 scope enum / 정의 안 된 필드 forbidNonWhitelisted) 각 1+.
- [ ] **Negative cases 충분 cover** — 잘못된 scope enum 값(400), 정의 안 된 raw payload 필드 포함(forbidNonWhitelisted 400), 인증 부재(401), User tier 권한 미달(403), 존재하지 않는 job id 조회(404) 각 1+ test (예외 처리 분기마다).
- [ ] colocated spec `src/export/export.controller.spec.ts` 작성 (NestJS convention — controller 와 같은 디렉토리). `ExportJobService` 는 mock provider 로 주입. DTO 검증은 `ValidationPipe` transform/validate 동작을 spec 또는 별도 `src/export/dto/create-export.dto.spec.ts` 로 cover (DTO 분기가 있으면 colocated dto spec 권장 — cap 안에서면 본 task, 초과 risk 시 Follow-up).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%).

## Out of Scope

- **ImportController / Import DTO** (`POST /api/admin/import` multipart upload) 배선 — 후속 task (Export 와 대칭이나 별도 slice — size cap). multipart 파일 수신은 추가 복잡도라 독립 slice.
- **45 helper (T-0437~T-0483) 실호출 배선** (chunked streaming·dedup·retransmit) — 후속 task chain. 본 controller 는 job record 생성·조회만, 실 dump 전송 0.
- **실 dump 직렬화 로직** (DB row → artifact) — 본 controller/service 는 status/artifactRef record 만, 실 직렬화·streaming 응답은 helper 배선 task.
- **artifact 저장소 mechanism** (filesystem vs object storage) — ADR-0044 §Out of scope (새 dependency 가능성 → 별도 §5 게이트).
- **`/api/admin/backup` / `/api/admin/restore` / `/api/admin/import`** endpoint — 본 task 는 `/api/admin/export` 1 resource 만.
- **신규 auth-flow / RBAC 정책 변경 0** — 기존 `JwtAuthGuard`+`RolesGuard`+`@Roles` stack 적용만.
- **응답 envelope 표준화 / pagination / sort** — service return 그대로 forward.
- `prisma/schema.prisma` 변경 0 (이미 T-0485 merge). `ExportJobService` 자체 로직 변경 0 (T-0486 merge 그대로 주입만). 새 외부 dependency / credential 0 (Q-0040 승인은 DB schema 범위만 — artifact SDK 는 여전히 §5 BLOCKED).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- **api.md §5 `GET /api/admin/export` → `POST` 정정** (planner 신규 direct doc task) — 본 controller 는 job 생성이 mutation 이므로 `POST /api/admin/export` 로 박제했다 (REST 정합 — query GET 으로 mutation 발화는 안티패턴). 근거는 `src/export/export.controller.ts` 의 endpoint surface 주석에 1줄 명시. 그러나 [docs/architecture/api.md](../architecture/api.md) §5 (L123 부근) 의 계약 표는 여전히 `GET /api/admin/export` 를 명시 → 코드↔문서 drift. api.md 본문은 `direct` commitMode (docs/architecture status 갱신) 이므로 본 pr-mode PR 에 포함하지 않고 별도 direct doc task 로 `GET`→`POST` 메서드 정정 (status polling `GET /:id`·`GET /running` 은 조회라 GET 유지). PR-400 reviewer round 1 MAJOR finding 의 closure 기록 (AC L44 "follow-up 으로 기록" 의무 충족).
