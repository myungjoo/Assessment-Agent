---
id: T-0487
title: ImportJobService — ImportJob 생성·status 전이·polling 조회 persistence service 배선
phase: P7
status: DONE
mergedAs: a451f6a
prNumber: 399
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 225
estimatedFiles: 3
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0485]
touchesFiles:
  - src/import/import-job.service.ts
  - src/import/import-job.service.spec.ts
  - test/helpers/prisma-mock.ts
plannerNote: "P7 export/import 실배선 chain step4 — ExportJobService(T-0486) 대칭 slice. ImportJob 생성·status 전이·polling. 실 atomic transaction §3 복원 로직은 후속."
---

# T-0487 — ImportJobService (ImportJob persistence service)

## Why

P7 export/import 실 배선 chain 의 step4 이다. step3 ([T-0486](T-0486-export-job-persistence-service.md)) 이 `ExportJobService` (ExportJob 생성·status 전이·polling 조회) 를 `src/export/export-job.service.ts` 로 박제·merge 했다 (1ae19cb). 그 **대칭 counterpart** 인 `ImportJobService` (ImportJob 의 생성·status 전이·polling 조회) 를 박제한다.

[ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §Follow-ups 의 "AssessmentModule export/import controller + service 골격 배선 (job 생성·status 추적)" 중 service 층 두 번째 slice 다. ImportJob 은 ExportJob 공통 필드 (id/status/requestedBy/createdAt/startedAt?/finishedAt?/error/artifactRef) 에 더해 고유 필드 `mode` (ImportMode REPLACE/MERGE, default REPLACE) 와 `restoredRowCount` (SUCCEEDED 시 복원 row 수, UC-07 §8 (e) postcondition) 를 가진다. 본 service 는 그 entity 의 생명주기 record 만 책임지고, **실 atomic transaction 복원 로직 (ADR-0044 §3 `$transaction` reset-and-recreate)** 은 후속 task 로 분리한다 (§Out of Scope). 이로써 [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 의 Import 측 async job + status polling backbone 이 코드 차원에서 채워진다 (REQ-030 Restore, REQ-032 raw 미저장, REQ-045 Admin).

## Required Reading

- `docs/decisions/ADR-0044-export-import-job-persistence.md` — Decision §1 (ImportJob 고유 필드 `mode`/`restoredRowCount`), §2 (raw 미저장 전파 — error 는 short message·artifactRef 는 pointer), §3 (Import atomic transaction — **본 task 는 record 만, 실 transaction 은 후속**), §4 (재실행 = 새 row)
- `prisma/schema.prisma` L539~564 (`enum JobStatus` / `enum ImportMode`), L639~656 (`model ImportJob` 의 실 필드: status default PENDING, mode default REPLACE, requestedById, createdAt, startedAt?, finishedAt?, error?, artifactRef?, restoredRowCount?)
- `src/export/export-job.service.ts` — **mirror 대상** (T-0486). createJob/mark*/findJob/findRunning 구조, `getPrismaErrorCode` helper, P2025→NotFoundException 매핑(`mapNotFound`), `updateOrThrow` 패턴을 ImportJob 에 동형 적용. 단 scope invariant → mode 검증으로 치환.
- `src/persistence/prisma.service.ts` — 주입할 `PrismaService` (Prisma client wrapper). `importJob` delegate 사용.
- `test/helpers/prisma-mock.ts` — colocated spec 가 import 할 Prisma mock helper. 현재 `person` + `exportJob` delegate 보유 — `importJob` delegate (create/update/findUniqueOrThrow/findMany) 추가 대상.

## Acceptance Criteria

- [ ] `src/import/import-job.service.ts` 에 `@Injectable() ImportJobService` 신설 — 생성자에서 `PrismaService` 주입 (ExportJobService 구조 mirror).
- [ ] `createJob(input)` 메서드 — `mode` (ImportMode, 미지정 시 REPLACE default) + `requestedById` 를 받아 `prisma.importJob.create` 로 status=PENDING row 생성. raw 본문 컬럼 0 (ADR-0044 §2 — input 에 raw payload 필드 자체가 없어야 함; artifactRef 는 import 할 artifact 의 pointer 일 뿐).
- [ ] invariant 검증 분기 — `requestedById` 가 비었으면 `BadRequestException` (FK 발화자 필수). mode 가 명시됐으나 ImportMode enum 값이 아니면 `BadRequestException` (REPLACE/MERGE 외 거부).
- [ ] status 전이 메서드 — `markRunning(id)` (status→RUNNING + startedAt=now), `markSucceeded(id, artifactRef, restoredRowCount)` (status→SUCCEEDED + finishedAt=now + artifactRef + restoredRowCount), `markFailed(id, error)` (status→FAILED + finishedAt=now + error 사람-친화 short message). 각 `prisma.importJob.update` 위임 (ExportJobService `updateOrThrow` mirror).
- [ ] polling 조회 메서드 — `findJob(id)` (단건, 부재 시 `NotFoundException` via findUniqueOrThrow + P2025 매핑) + `findRunning()` (status=RUNNING row 목록, UC-07 §8 status polling).
- [ ] **Happy-path unit test**: 위 모든 public 메서드 (createJob / markRunning / markSucceeded / markFailed / findJob / findRunning) 에 대해 정상 동작 test 1+ (Prisma delegate mock 으로 호출 인자·반환 검증). createJob 의 mode default(REPLACE) 적용 test 1+, mode=MERGE 명시 test 1+.
- [ ] **Error path unit test**: `findJob` 부재 시 NotFoundException 1+; `mark*` 가 P2025 (row 부재) throw 시 NotFoundException 매핑 1+; P2025 외 Prisma error 는 그대로 propagate 됨 1+.
- [ ] **Flow / branch cover**: createJob 의 invariant 분기 (정상 / requestedById 누락 400 / 잘못된 mode 400) 각 1+, status 전이 분기 (RUNNING / SUCCEEDED / FAILED) 각 1+, mapNotFound 의 P2025 분기와 non-P2025 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — 빈/undefined requestedById (400), enum 외 mode 값 (400), 존재하지 않는 id 로 mark* 호출 (P2025→404), 존재하지 않는 id 로 findJob (404), markSucceeded 시 restoredRowCount 누락/0 처리 각 1+ test (예외 처리 분기마다).
- [ ] colocated spec `src/import/import-job.service.spec.ts` 작성 (NestJS convention — 신규 service 와 같은 디렉토리). `test/helpers/prisma-mock.ts` 의 mock 에 `importJob` delegate (create/update/findUniqueOrThrow/findMany) 추가 후 재사용 (`exportJob` delegate 추가 패턴 mirror).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%).

## Out of Scope

- **실 atomic transaction 복원 로직** (ADR-0044 §3 — REPLACE mode 의 `prisma.$transaction([deleteMany, ...create])` reset-and-recreate, MERGE mode conflict resolution) — 후속 task. 본 service 는 job 의 status/artifactRef/restoredRowCount **record** 만, 실 DB-wide snapshot 복원은 별도 slice (size cap + 트랜잭션 복잡도).
- import **controller / DTO** (`POST /api/admin/import`) 배선 — 후속 task.
- export/import **module 등록** (새 `ImportModule`/`ExportModule` 또는 AssessmentModule 편입 + app.module import) — 후속 task (본 task 는 service class + spec 만; 미등록이어도 unit test 통과).
- **45 helper (T-0437~T-0483) 실호출 배선** (chunked streaming·dedup·retransmit) — 후속 task chain.
- **artifact 저장소 mechanism / 실 file snapshot 파싱** — ADR-0044 §Out of scope (새 dependency 가능성 → 별도 §5 게이트).
- `prisma/schema.prisma` 변경 0 (이미 T-0485 merge). 새 외부 dependency / credential 0 (Q-0040 승인은 DB schema 범위만 — artifact SDK 는 여전히 §5 BLOCKED).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.)
