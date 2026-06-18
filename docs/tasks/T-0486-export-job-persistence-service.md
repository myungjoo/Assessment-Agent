---
id: T-0486
title: ExportJobService — ExportJob 생성·status 전이·polling 조회 persistence service 배선
phase: P7
status: DONE
commitMode: pr
mergedAs: 1ae19cb
prNumber: 398
reviewRounds: 1
completedAt: 2026-06-18T03:25:33Z
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0485]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - test/helpers/prisma-mock.ts
plannerNote: "P7 export/import 실배선 chain step3 — ADR-0044 §Follow-ups 'service 골격(job 생성·status 추적)' 의 첫 slice(ExportJob persistence). controller/Import/helper 배선은 후속."
---

# T-0486 — ExportJobService (ExportJob persistence service)

## Why

P7 export/import 실 배선 chain 의 step3 이다. step1 ([T-0484](T-0484-export-import-job-persistence-adr.md)) 이 [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) 로 ExportJob/ImportJob 영속 데이터 모델을 박제했고, step2 ([T-0485](T-0485-export-import-job-prisma-schema.md)) 가 `prisma/schema.prisma` 에 `model ExportJob` / `model ImportJob` + enum + migration 을 merge 했다 (b8b8faa). 그러나 그 entity 를 실제로 읽고 쓰는 코드는 0 이고, 누적 45 helper (`src/export/*.ts`, [T-0437](T-0437.md)~[T-0483](T-0483.md)) 도 controller/service 미배선 상태다.

ADR-0044 §Follow-ups 의 두 번째 항목 — "AssessmentModule export/import controller + service 골격 배선 (job 생성·status 추적)" — 의 **dependency-order 첫 slice** 인 **ExportJobService** (ExportJob 의 생성·status 전이·polling 조회) 를 박제한다. controller/DTO·ImportJobService·45 helper 실호출·module 등록·artifact 저장소는 size cap (≤300 LOC / 5 파일) 준수를 위해 후속 task 로 분리한다 (§Out of Scope). 이 service 는 [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 의 async job + status polling backbone 을 코드 차원에서 처음 채운다 (REQ-030 Export, REQ-032 raw 미저장, REQ-045 Admin).

## Required Reading

- `docs/decisions/ADR-0044-export-import-job-persistence.md` — Decision §1 (필드·책임), §2 (raw 미저장 전파), §4 (재실행 = 새 row / status 전이 안전성), §5 (AuditLog 경계)
- `prisma/schema.prisma` L550~622 — `enum ExportScope` / `enum JobStatus` / `model ExportJob` 의 실 필드 (status default PENDING, scope, dateRange Json?, entitySelector Json?, requestedById, createdAt, startedAt?, finishedAt?, error?, artifactRef?)
- `src/persistence/prisma.service.ts` — 주입할 `PrismaService` (전 service 의 Prisma client wrapper)
- `src/scheduling/recent-deletion-runner.service.ts` (L25~40) — `@Injectable` + 주입형 service 패턴 + 도메인 상수 박제 컨벤션 mirror 대상
- `test/helpers/prisma-mock.ts` — colocated spec 가 import 할 Prisma mock helper (exportJob delegate mock 추가 대상)

## Acceptance Criteria

- [ ] `src/export/export-job.service.ts` 에 `@Injectable() ExportJobService` 신설 — 생성자에서 `PrismaService` 주입.
- [ ] `createJob(input)` 메서드 — `scope` (ExportScope) + `requestedById` (+ scope=RANGE/PARTIAL 시 `dateRange`/`entitySelector`) 를 받아 `prisma.exportJob.create` 로 status=PENDING row 생성. raw 본문 컬럼 0 (ADR-0044 §2 — input 에 raw payload 필드 자체가 없어야 함).
- [ ] scope invariant 검증 분기 — scope=FULL 인데 dateRange/entitySelector 가 넘어오면 `BadRequestException`; scope=RANGE 인데 dateRange 누락 시 `BadRequestException` (schema 주석 L548~549 "service-layer 가 값 invariant 검증 책임" 정합).
- [ ] status 전이 메서드 — `markRunning(id)` (status→RUNNING + startedAt=now), `markSucceeded(id, artifactRef)` (status→SUCCEEDED + finishedAt=now + artifactRef), `markFailed(id, error)` (status→FAILED + finishedAt=now + error 사람-친화 message). 각 `prisma.exportJob.update` 위임.
- [ ] polling 조회 메서드 — `findJob(id)` (단건, 부재 시 `NotFoundException` via P2025 매핑 또는 findUniqueOrThrow) + `findRunning()` (status=RUNNING row 목록, UC-07 §8 status polling).
- [ ] **Happy-path unit test**: 위 모든 public 메서드 (createJob / markRunning / markSucceeded / markFailed / findJob / findRunning) 에 대해 정상 동작 test 1+ (Prisma delegate mock 으로 호출 인자·반환 검증).
- [ ] **Error path unit test**: `findJob` 부재 시 NotFoundException 1+; Prisma update 가 P2025 (row 부재) throw 시 NotFoundException 매핑 1+.
- [ ] **Flow / branch cover**: scope invariant 분기 (FULL / RANGE / PARTIAL 각 분기) 와 status 전이 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — scope=FULL+dateRange 동반 (400), scope=RANGE+dateRange 누락 (400), 빈/undefined requestedById, 존재하지 않는 id 로 mark* 호출 (P2025→404) 각 1+ test (예외 처리 분기마다).
- [ ] colocated spec `src/export/export-job.service.spec.ts` 작성 (NestJS convention — 신규 service 와 같은 디렉토리). `test/helpers/prisma-mock.ts` 의 mock 에 `exportJob` delegate (create/update/findUniqueOrThrow/findMany) 추가 후 재사용.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%).

## Out of Scope

- export/import **controller / DTO** (`GET /api/admin/export`) 배선 — 후속 task.
- **ImportJobService** (ImportJob 생성·atomic transaction §3) — 후속 task (Export 와 대칭이나 별도 slice — size cap).
- **45 helper (T-0437~T-0483) 실호출 배선** (chunked streaming·dedup·retransmit) — 후속 task chain.
- **module 등록** (새 `ExportModule` 또는 AssessmentModule 편입 + app.module import) — 후속 task (본 task 는 service class + spec 만; 미등록이어도 unit test 는 통과).
- **artifact 저장소 mechanism** (filesystem vs object storage) — ADR-0044 §Out of scope (새 dependency 가능성 → 별도 §5 게이트).
- **실 dump 직렬화 로직** (DB row → artifact) — 본 service 는 status/artifactRef record 만, 실 직렬화는 helper 배선 task.
- `prisma/schema.prisma` 변경 0 (이미 T-0485 merge). 새 외부 dependency / credential 0 (Q-0040 승인은 DB schema 범위만 — artifact SDK 는 여전히 §5 BLOCKED).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.)
