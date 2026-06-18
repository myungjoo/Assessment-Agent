---
id: ADR-0044
title: "export/import job 영속 데이터 모델 결정 (ExportJob/ImportJob — 비동기 진행 추적·재시도·감사 경계)"
status: ACCEPTED
date: 2026-06-18
relatedTask: T-0484
relatedReq: [REQ-030, REQ-032, REQ-045]
supersedes: null
---

# ADR-0044 — export/import job 영속 데이터 모델 결정 (ExportJob/ImportJob)

> 본 ADR 은 [Q-0040](../STATE.json) 이 옵션 1 (export/import 실 배선용 Prisma schema migration 승인) 으로 RESOLVED 된 직후, 사용자가 명시한 절차 **(1) ADR 로 export/import job 영속 데이터 모델 박제 → (2) Prisma schema + migration → (3) AssessmentModule export/import controller/service 배선** 의 **dependency-free 첫 step (1)** 이다. 누적 45 helper ([T-0437](../tasks/T-0437.md)~[T-0483](../tasks/T-0483.md), `src/export/*.ts` 비-spec) 가 실 controller/service/DB 에 미배선인 상태를 회수하기 위한 **contract source** 를 박제한다. 본 ADR 은 **결정 전용 0 LOC** — 실 Prisma schema 코드·migration SQL·controller/service 구현은 본 ADR ACCEPTED 후 별도 후속 task (§Out of scope / §Follow-ups) 이며, [CLAUDE.md §9](../../CLAUDE.md) "코드보다 ADR이 먼저다" + [§3.1](../../CLAUDE.md) 규칙 4 에 따라 P7 export/import stream 의 첫 산출물이 본 ADR 이다.

## Context

[UC-07](../use-cases/UC-07-export-import.md) 은 Admin 이 평가 자료를 (a) **Export** (read-only, DB → file artifact 다운로드) 또는 (b) **Import / Restore** (destructive write, file artifact 업로드 → DB 복원) 하는 dump / load 대칭 흐름을 박제한다 ([REQ-030](../requirements.md)). [api.md](../architecture/api.md) L56·L122~124·L176 가 `GET /api/admin/export` + `POST /api/admin/import` 계약 (resource path / Admin role / content type) 을 정의하나, **구현 controller·service·영속 entity 가 전부 부재**하다 (Q-0040 context — `ExportController`/`ImportController` 0, `prisma/schema.prisma` 의 Export/Import job 테이블 0).

핵심 외력:

- **[Q-0040 decision](../STATE.json)** — 사용자가 export/import 실 배선을 옵션 1 로 승인했다. CLAUDE.md §5 의 "DB schema 변경 = BLOCKED" 게이트가 이 승인으로 해소됐고, 승인 절차는 **ADR → schema/migration → controller/service** 의 순서를 명시한다. 본 ADR 은 그 (1) 이다.
- **[UC-07 §1](../use-cases/UC-07-export-import.md)** 의 3 invariant — (a) raw 미저장 정책 ([REQ-032](../requirements.md)) 이 Export payload 에 자연 전파, (b) **Import atomic transaction** (기존 row 삭제 + snapshot 재구성이 all-or-nothing), (c) UC-01 의 다음 발화가 비어있는 시간 구간 자동 재수집 ([REQ-037](../requirements.md)). 본 ADR 의 Decision §2·§3 이 (a)·(b) 를 job entity 차원에서 박제한다.
- **[UC-07 §8 NFR](../use-cases/UC-07-export-import.md)** — 대량 dump 는 long-running operation 가능, "async job + status polling + chunked streaming + resumable upload" 가 명시 deferred 됐다. 본 ADR 의 ExportJob/ImportJob 영속 entity 가 바로 그 **async job 의 진행 추적 backbone** 이다.
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md) §3** — reset-and-recreate + 단일 `prisma.$transaction` all-or-nothing 패턴. Import job 의 "기존 row 삭제 + snapshot 재구성" 이 이 패턴과 **동형** (homolog) 이므로 재발명 없이 그대로 차용한다.
- **[ADR-0002](ADR-0002-db.md)** — PostgreSQL 16+ + Prisma. job entity 의 실 구현 form 은 `schema.prisma` model.
- **[ADR-0042](ADR-0042-nestjs-schedule-adoption.md) §Consequences** — cron schedule 을 in-memory `SchedulerRegistry` 로만 보유 (비영속) 한 선례. 본 ADR 은 그 trade-off 를 참고하되 **export/import job 은 DB 영속을 채택**한다 (근거는 §Alternatives B — 진행 추적·재시도·감사가 process 재시작을 넘어 보존돼야 함).
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / 새 credential 은 BLOCKED. 본 결정은 **새 dependency 0** (내장 Prisma 만), **새 credential 0**. DB schema 변경은 Q-0040 승인으로 게이트 해소됐고, 그 schema 의 ADR 이 본 문서다.

본 ADR 은 **새 table 도입 (ExportJob/ImportJob)** 의 책임·필드·invariant·module 경계만 decide 하며, 구체 Prisma 코드·migration·artifact 저장소 선택은 후속 task 로 분리해 size cap (≤300 LOC / ≤5 파일) 을 지킨다.

## Decision

### Decision §1 — ExportJob / ImportJob 영속 entity 도입 + 책임·필드 박제

**채택: export/import 의 비동기 진행 추적·재시도·감사를 위해 `ExportJob` / `ImportJob` 두 영속 entity 를 도입한다. 책임 module 은 [AssessmentModule](../architecture/modules.md) ([api.md](../architecture/api.md) L56 `/api/admin` = AssessmentModule controller 정합).**

두 entity 의 공통 필드 (개념 수준 + 구체 컬럼 의도 — 구체 type 은 후속 schema task):

- `id` — job 식별자 (PK).
- `status` — job 진행 상태 enum: `PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED` (UC-07 §5 sequence + §8 NFR 의 status polling 대상). 향후 `CANCELLED` 추가 가능 (§6.4 race 정책).
- `requestedBy` — 발화한 [User](../architecture/data-model.md) 참조 (FK, REQ-045 Admin). 누가 dump/restore 를 일으켰는지 추적.
- `createdAt` — job row 최초 생성 시각.
- `startedAt` — 실 실행 시작 시각 (nullable — PENDING 동안 null).
- `finishedAt` — 종료 (SUCCEEDED/FAILED) 시각 (nullable).
- `error` — FAILED 시 실패 사유 요약 (nullable, raw stack trace 가 아닌 사람-친화 메시지 — §2 raw 미저장 정합).
- `artifactRef` — dump/upload artifact 의 **참조 식별자** (파일 경로 / object key / handle — raw 본문 미포함, §2). artifact 저장소 mechanism (파일시스템 vs object storage) 의 구체 선택은 본 task 밖 (§Out of scope).

`ExportJob` 고유 필드:

- `scope` — dump 범위 enum: `full` / `range` / `partial` (UC-07 §6.1). full = 전체 entity 전 기간, range = 기간 한정, partial = entity/인원 한정.
- `dateRange` (nullable) + `entitySelector` (nullable) — scope=range/partial 시의 구체 한정값 (UC-07 §6.1 의 3차원 Cartesian product 중 dateRange / entitySelector 축). 구체 직렬화 형태는 후속 schema task.

`ImportJob` 고유 필드:

- `mode` — 복원 모드 enum: `replace` (default — 기존 row 삭제 후 snapshot 복원) / `merge` (기존 row 보존 + 추가) (UC-07 §6.2).
- `restoredRowCount` (nullable) — SUCCEEDED 시 복원된 row 수 요약 (UC-07 §8 (e) Import postcondition).

**필드 박제 수준**: 본 ADR 은 "어떤 책임의 필드가 필요한가" 의 개념 + 구체 컬럼 의도만 박제한다. 구체 Prisma type (`@id` 형식 / enum 정의 / `DateTime?` nullable / `Json` for dateRange·entitySelector 등) · index · FK cascade policy 는 후속 schema task ([data-model.md §7](../architecture/data-model.md) "구체 컬럼 type / Prisma schema 코드 / migration SQL 은 본 문서 범위 밖" 정합).

### Decision §2 — raw 미저장 invariant (REQ-032) 의 ExportJob/ImportJob 전파

**채택: ExportJob/ImportJob entity 자체도 raw commit 본문 / 문서 본문 컬럼 0, dump artifact 도 raw 미포함 — [data-model.md §4](../architecture/data-model.md) + [UC-07 §1 invariant a](../use-cases/UC-07-export-import.md) 와 정합하게 raw 미저장 invariant 가 job entity 까지 전파됨을 명시 박제한다.**

- **job entity 차원**: ExportJob/ImportJob 의 어떤 필드도 raw GitHub commit message 전문 / diff / PR description / issue body / Confluence page 본문 HTML 을 컬럼으로 보유하지 **않는다**. `artifactRef` 는 artifact 의 **pointer (참조 식별자)** 일 뿐 본문이 아니며, `error` 는 사람-친화 실패 요약일 뿐 raw payload 가 아니다.
- **dump artifact 차원**: Export 가 dump 하는 row 는 평가 결과 (Assessment/Contribution/Summary — 이미 raw 미저장) + 인원 master (Person/ServiceIdentity/Group/Part) + LLM 설정 (LlmProviderConfig/DifficultyMapping) + AuditLog (실 export-source: `PermissionDeniedRecord` — §6 매핑표 참조) 이며, raw 외부 본문은 **처음부터 DB 에 없으므로 dump artifact 에 자동 부재** (UC-07 §1 invariant a — "raw 미저장 정책이 Export payload 에 자연 전파"). 본 invariant 위반은 ADR 신설 필수 ([data-model.md §4](../architecture/data-model.md), CLAUDE.md §5).

### Decision §3 — Import atomic transaction invariant (all-or-nothing) — ADR-0033 패턴 차용

**채택: Import job 의 "기존 row 일괄 삭제 + file snapshot 재구성" 은 [ADR-0033 §3](ADR-0033-evaluation-result-persistence.md) 의 reset-and-recreate 와 동형으로, 단일 `prisma.$transaction` all-or-nothing 으로 묶어 부분 복원 상태가 발생하지 않음을 박제한다 ([UC-07 §1 invariant b](../use-cases/UC-07-export-import.md) / §7.5).**

- **replace mode (default)**: `$transaction([ deleteMany(기존 row 일괄), ...create(snapshot 재구성) ])` 가 하나의 트랜잭션. delete 와 create 중 어느 하나라도 실패하면 전체 rollback — 기존 데이터가 유실되지 않고 부분 복원 상태도 남지 않는다 (UC-07 §7.5 "기존 row 삭제와 file snapshot 재구성이 함께 rollback").
- **ADR-0033 동형성**: ADR-0033 의 Assessment 단위 reset-and-recreate (delete cascade → create 를 단일 `$transaction`) 와 의미 구조가 같다 — 차이는 scope 뿐 (ADR-0033 은 한 Assessment, 본 Import 는 DB-wide snapshot). 따라서 트랜잭션 패턴을 재발명하지 않고 그대로 차용한다.
- **merge mode (§6.2)**: 기존 row 보존 + artifact row 추가 — conflict resolution (PK 충돌 / timestamp 비교 / dedupe) 의 구체 알고리즘은 후속 service task 책임 (UC-07 §6.2 Out of Scope). 본 ADR 은 merge 도 단일 트랜잭션 경계 안에서 수행됨만 박제.
- **Export 는 read-only** — 트랜잭션 무관 (DB 무변화, UC-07 §8 (a)). ExportJob 은 진행 추적·감사 목적으로만 존재하며 DB 상태를 바꾸지 않는다.

### Decision §4 — idempotency / 재실행 정책

**채택: ExportJob/ImportJob 은 [ADR-0033 §3](ADR-0033-evaluation-result-persistence.md) 의 idempotency 정신을 차용하되, job entity 자체는 진행 추적 record 이므로 row-level idempotency key 를 강제하지 않는다 — 대신 재실행 안전성을 status 전이 + Import 트랜잭션 atomicity 로 보장한다.**

- **Export 재실행**: Export 는 read-only 이므로 동일 scope 재실행이 항상 안전하다 (DB 무변화). 같은 scope dump 를 N 번 요청하면 N 개 ExportJob row 가 생기지만 (각각 독립 audit trail), DB 상태에는 영향 0 — idempotent by nature.
- **Import 재실행**: Import 는 destructive 이나, replace mode 의 단일 트랜잭션 (§3) 이 **부분 실패 후 재시도 안전성**을 보장한다 — FAILED job 의 트랜잭션은 이미 rollback 됐으므로 (DB 는 이전 상태), 같은 artifact 로 재시도 시 다시 처음부터 all-or-nothing 으로 복원한다. 부분 복원 상태가 없으므로 재시도가 중복 row 를 만들지 않는다 (Assessment/Contribution/Summary 의 기존 `@@unique` 가 snapshot 재구성 시 중복을 schema 차원 차단 — [ADR-0033 §4](ADR-0033-evaluation-result-persistence.md) / [ADR-0035](ADR-0035-aggregate-summary-evaluation.md)).
- **중복 동시 실행 방지**: 동일 시점 2개 Import 가 동시 실행되면 UC-07 §6.4 race 정책 (default — 진행 중 작업 완료 후 실행) 으로 직렬화한다. 구체 lock / queue mechanism 은 후속 service task 책임. 본 ADR 은 "status `RUNNING` 인 Import job 이 있으면 새 Import 는 대기 또는 reject" 의 정책 방향만 박제.
- **재시도 = 새 job row**: 부분 실패 후 재시도는 기존 FAILED job 을 in-place 갱신하지 않고 **새 job row 를 생성**한다 (job entity 는 immutable record — 시도마다 1 row, audit trail 보존). 이는 ADR-0033 의 immutable 정신과 정합.

### Decision §5 — AuditLog 와의 책임 경계

**채택: ExportJob/ImportJob 은 export/import operation 의 **진행 추적 + 재시도 record** (status / artifact / error / row count) 를 책임지고, [AuditLog](../architecture/data-model.md) (§2 conceptual mention) 은 **mutation event 의 감사 로그** (누가·언제·무엇을 — Import-Export event 포함) 를 책임진다 — 두 entity 는 책임이 분리되며 중복 신설하지 않는다.**

- **ExportJob/ImportJob 책임**: 한 dump/restore operation 의 생명주기 (PENDING→RUNNING→SUCCEEDED/FAILED) 와 그 산출물 (artifactRef / restoredRowCount / error). UC-07 §8 NFR 의 status polling 이 본 entity 를 조회한다.
- **AuditLog 책임**: UC-07 §5 step 의 "Audit log row insert (Export/Import 종류 + actor + scope/file source + row count)" — operation 발생 사실의 **감사 event-stream**. data-model.md §5 의 `createdBy` (row 자체 감사) 와 별도로, AuditLog 는 event-stream 형태 ([data-model.md §5](../architecture/data-model.md) 정합).
- **중복 회피**: ExportJob/ImportJob 의 `requestedBy` + `createdAt` 이 "누가 언제 시작했는가" 의 1차 record 이고, AuditLog 는 그것을 감사 관점에서 별도 event 로 기록할 수 있으나 — **AuditLog entity 의 구체 schema 는 별도 보안 ADR 책임** ([data-model.md §2](../architecture/data-model.md) conceptual mention / §7 Out of scope). 본 ADR 은 ExportJob/ImportJob 이 AuditLog 를 대체하지 않으며, 역으로 AuditLog 가 job 진행 추적을 대체하지 않음 — 두 entity 의 경계만 박제한다.

### Decision §6 — ExportEntity → Prisma model + instant 컬럼 매핑 (T-0497 사후 박제)

**채택: `ExportEntity` union 의 5 literal 을 다음 Prisma model delegate + instant 컬럼으로 매핑한다. 두 건은 model 이름이 literal 과 달라 본 표가 그 치환을 흡수하며, 본 매핑은 [T-0497](../tasks/T-0497-export-select-records-preview-wire.md) (PR #408, squash 86c07c7) 이 `src/export/export-job.service.ts` 의 `EXPORT_ENTITY_SOURCES` 상수로 이미 머지된 사실을 contract source 인 본 ADR 에 사후 박제한다.**

| ExportEntity (literal) | Prisma model delegate | instant 컬럼 |
| --- | --- | --- |
| `Assessment` | `assessment` | `createdAt` |
| `Person` | `person` | `createdAt` |
| `Group` | `group` | `createdAt` |
| `LlmConfig` | `llmProviderConfig` | `createdAt` |
| `AuditLog` | `permissionDeniedRecord` | `createdAt` |

**두 치환의 사유**:

- **`LlmConfig` → `LlmProviderConfig`**: literal 이 약어일 뿐 동일 entity — export-source 는 기존 [data-model.md §2](../architecture/data-model.md) 의 `LlmProviderConfig` model 그대로 (신설 0).
- **`AuditLog` → `PermissionDeniedRecord`**: ADR-0044 §5 가 AuditLog 를 **conceptual-only** (구체 schema 는 별도 보안 ADR 책임) 로 둔 상태라, v1 export-source 로 현존하는 구체 감사 model `PermissionDeniedRecord` 를 **stand-in** 으로 사용한다. 일반 `AuditLog` Prisma model 이 별도 보안 ADR 로 신설되면 본 매핑의 export-source 가 그 model 로 승격될 수 있다 (forward note — §Follow-ups 참조).

**§5 와의 정합**: 본 §6 은 §5 의 "AuditLog 의 구체 schema 결정은 별도 보안 ADR 책임" 경계 결정을 **변경하지 않는다** — export-source 가 잠정적으로 `PermissionDeniedRecord` 를 가리킬 뿐, AuditLog entity 자체의 구체 schema 결정을 본 amend 가 내리지 않으므로 §5 의 책임 경계는 불변이다.

**instant 컬럼 = 5 model 모두 `createdAt` 선택 근거**: [UC-07 §6.1](../use-cases/UC-07-export-import.md) 의 range scope `[start, end)` 판정이 의미하는 "record 가 생성/발생한 시각" 과 정합 — Assessment 는 평가 record 생성, Person/Group/LlmProviderConfig 는 master record 생성, PermissionDeniedRecord 는 감사 사건 발생 시각이 모두 `createdAt` 으로 자연스럽다 (`src/export/export-job.service.ts` L89~92 inline 주석과 정합).

**source-of-truth cross-reference**: 본 §6 매핑의 사실 source 는 `src/export/export-job.service.ts` 의 `EXPORT_ENTITY_SOURCES` (T-0497, PR #408, squash 86c07c7) 다. 본 ADR 은 contract source 로서 그 코드 사실을 사후 박제하며, 향후 `ExportEntity` union 변경 / model 치환 변경은 본 §6 amend 가 선행해야 한다 ([CLAUDE.md §7.3](../../CLAUDE.md) "코드보다 ADR 이 먼저다" 정신 — T-0497 은 reviewer follow-up 으로 본 사후 박제 task 가 발급됐다).

## Consequences

### 긍정

- **UC-07 §8 NFR 의 async job 진행 추적 backbone 이 박제됨** — 대량 dump/restore 의 long-running operation 이 status polling 으로 추적 가능해지는 데이터 모델 source 가 확정. 누적 45 helper 의 배선 대상 contract 가 생겼다.
- **새 table 2 개 추가뿐 / 새 dependency 0 / 새 credential 0** — Prisma 는 이미 stack ([ADR-0002](ADR-0002-db.md)), 트랜잭션 패턴은 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 재사용. CLAUDE.md §5 BLOCKED 게이트는 Q-0040 승인으로 이미 해소.
- **Import atomic transaction invariant 가 job 차원에서 명문화** — ADR-0033 동형 패턴 차용으로 부분 복원 상태 0 이 데이터 모델 차원에서 보장.
- **raw 미저장 invariant (REQ-032) 의 일관 전파** — job entity·artifact 모두 raw 미포함이 명시 박제되어, 향후 schema task 가 raw 컬럼을 추가할 표면이 생기지 않는다.
- **AuditLog 와의 경계 명확화로 entity 중복 신설 회피** — 진행 추적 (job) vs 감사 event-stream (AuditLog) 의 책임이 분리돼 drift 가 차단된다.

### 부정 / trade-off

- **job entity 영속 = DB row 누적** — Export 재실행마다 1 row 씩 ExportJob 이 누적된다 (audit trail 목적). 오래된 job row 의 retention / cleanup 정책 (예: N일 후 삭제) 은 본 ADR 미결정 — 운영 요구 부상 시 후속 task. [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) 의 in-memory (비영속) 선택과 달리 영속을 택한 비용.
- **artifact 저장소 미결정** — `artifactRef` 가 가리키는 실 저장소 (로컬 파일시스템 vs S3-호환 object storage) 가 본 ADR 밖이라, 후속 task 가 그 선택 시 **새 외부 dependency 가능성** (object storage SDK) 이 있다 — 그 경우 별도 §5 게이트 / ADR 필요 (본 ADR §Out of scope 명시).
- **merge mode conflict resolution 미정** — merge mode 의 PK 충돌 / dedupe 알고리즘이 후속 service task 로 미뤄져, 그 설계 품질이 데이터 정합에 영향 (UC-07 §6.2 Out of Scope 정합 — risk 는 후속 task 의 spec / reviewer 점검 대상).

### Cross-Module Impact

본 결정은 새 export contract 를 바꾸지 않고 **추가**한다 (ExportJob/ImportJob 2 entity 신설 + AssessmentModule 의 export/import controller/service 후속 배선). 기존 [api.md](../architecture/api.md) 의 `GET /api/admin/export` / `POST /api/admin/import` 계약을 보존하며 그 구현을 채운다. 영향 module 은 **AssessmentModule 1 개로 한정** ([data-model.md §2](../architecture/data-model.md) 책임 module 정합, ≥3 module spread 아님 → BLOCKED 미해당). User entity 와의 FK (`requestedBy`) 는 기존 User table 위 참조 추가뿐 — User schema 변경 0.

## Alternatives considered

### A. job 영속 entity 없이 synchronous 처리 (즉시 dump/restore, 진행 추적 없음) (미채택)

`GET /api/admin/export` 요청을 받으면 그 자리에서 동기적으로 dump 를 직렬화해 streaming 응답하고, Import 도 요청 핸들러 안에서 동기 트랜잭션으로 복원하는 안. job entity·status·재시도 추적 0. 미채택 — [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 이 "대량 dump 는 long-running operation 가능, async job + status polling + chunked streaming + resumable upload" 를 명시 deferred 했고, 누적 45 helper (chunked streaming·dedup·retransmit) 가 이미 비동기 chunked 전송을 전제로 작성됐다. 동기 처리는 (a) 대량 dump 시 HTTP timeout / 메모리 압박, (b) 진행률·재시도·감사 추적 불가, (c) 45 helper 의 배선 대상 부재 — UC-07 NFR 과 기존 자산에 모두 부정합. 작은 dump 만 다룬다면 매력적이나 disaster recovery / migration 시나리오 (UC-07 §1) 의 대량 dump 를 cover 못 한다.

### B. ExportJob/ImportJob 영속 entity 도입 — 비동기 진행 추적·재시도·감사 (채택)

DB 영속 job entity 로 status / artifactRef / error / restoredRowCount 를 추적하는 안. **채택** — UC-07 §8 NFR 의 async job + status polling 요구를 정확히 cover 하고, 45 helper 의 chunked streaming 이 job 단위 진행 추적 위에 배선된다. [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) 의 cron schedule in-memory (비영속) 선택과 비교: cron schedule 은 process 재시작 시 재등록 가능한 휘발 상태지만, **export/import job 의 진행·재시도·감사는 process 재시작을 넘어 보존돼야** (장시간 dump 중 재시작 / 실패 job 의 사후 감사) 하므로 영속을 택한다. trade-off 는 job row 누적 (§Consequences 부정 — retention 정책 후속).

### C. AuditLog 에 job 진행 상태까지 통합 (별도 job entity 0) (미채택)

[AuditLog](../architecture/data-model.md) (§2 conceptual mention) entity 하나에 export/import event + 진행 상태 (status / artifactRef) 를 모두 기록하는 안. 미채택 — AuditLog 는 **mutation event 의 감사 event-stream** (append-only, 누가·언제·무엇을) 이 본질이고, job 의 **mutable 진행 상태** (PENDING→RUNNING→SUCCEEDED 전이) 는 성격이 다르다. 둘을 한 entity 에 섞으면 (a) AuditLog 의 append-only 감사 무결성이 약화 (status update 가 event 를 mutate), (b) status polling 쿼리와 감사 쿼리가 한 table 에 경합, (c) [data-model.md §2](../architecture/data-model.md) 의 AuditLog "구체 schema 는 별도 보안 ADR 책임" 경계 침범. 책임 분리 (Decision §5) 가 정합.

## Out of scope

본 ADR 은 **결정만 한다** — 다음은 후속 task / 별도 ADR 책임:

- **Prisma schema 코드 작성** (`prisma/schema.prisma` 의 `model ExportJob` / `model ImportJob`) — 후속 task (T-0485 후보, `commitMode: pr`, dependsOn: [T-0484]).
- **Migration SQL / `prisma migrate` 실행** — 후속 task ([ADR-0004](ADR-0004-smoke-e2e-db-mode.md) migrate-deploy 재사용).
- **AssessmentModule export/import controller (`GET /api/admin/export` / `POST /api/admin/import`) · service 구현** + 누적 45 helper ([T-0437](../tasks/T-0437.md)~[T-0483](../tasks/T-0483.md)) 배선 — 후속 task chain.
- **artifact 저장소 mechanism** (로컬 파일시스템 vs S3-호환 object storage) 의 구체 선택 — 새 외부 dependency 가능성 있으므로 본 task 밖, 필요 시 별도 §5 게이트 / ADR.
- **AuditLog entity 의 구체 schema** — 별도 보안 ADR 책임 ([data-model.md §7](../architecture/data-model.md)).
- **job row retention / cleanup 정책** (오래된 job row 삭제) — 운영 요구 부상 시 후속 task.
- **merge mode conflict resolution 알고리즘** (PK 충돌 / dedupe) — 후속 service task (UC-07 §6.2 Out of Scope 정합).
- **구체 컬럼 type / index / FK cascade policy** — 후속 schema task ([data-model.md §7](../architecture/data-model.md)).
- 코드 변경 일절 (`src/` / `test/` 수정 0).

## References

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — 본 ADR 의 직접 상류 (3 invariant / Export·Import 흐름 / §6 scope·mode 옵션 / §8 NFR async job)
- [docs/architecture/data-model.md](../architecture/data-model.md) — §2 entity 표 (ExportJob/ImportJob row 추가 대상) / §4 raw 미저장 invariant / §2 AuditLog conceptual mention 경계
- [docs/architecture/api.md](../architecture/api.md) — L56·L122~124·L176 `GET /api/admin/export` / `POST /api/admin/import` 계약 (본 ADR 이 구현 채울 대상)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — reset-and-recreate + `$transaction` all-or-nothing 패턴 (본 ADR Import atomicity 의 동형 source)
- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](ADR-0035-aggregate-summary-evaluation.md) — Summary `@@unique` (snapshot 재구성 중복 차단 정합)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma stack (job entity 의 실 구현 form)
- [docs/decisions/ADR-0042-nestjs-schedule-adoption.md](ADR-0042-nestjs-schedule-adoption.md) — in-memory vs DB 영속 선례 (§Alternatives B 의 trade-off 참고)
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL 패턴 (후속 migration task 재사용)
- [docs/STATE.json](../STATE.json) — Q-0040 decision (옵션 1 승인 — 본 ADR 의 외력)
- [README.md](../../README.md) — REQ-030 (Export/Import) / REQ-032 (raw 미저장) / REQ-045 (Admin 권한)
- [CLAUDE.md §3.1 / §5 / §9 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / ADR-first / 언어 정책

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112.)

- (후속) T-NNNN: `prisma/schema.prisma` 에 `model ExportJob` / `model ImportJob` 추가 + `prisma migrate` migration 파일 생성 (본 ADR Decision §1 기반, `commitMode: pr`, dependsOn: [T-0484]).
- (후속) T-NNNN: AssessmentModule 에 export/import controller (`GET /api/admin/export` / `POST /api/admin/import`) + service 골격 배선 (job 생성·status 추적, dependsOn: [schema task]).
- (후속) T-NNNN~: 누적 45 export/import helper (T-0437~T-0483) 를 controller/service 에 실제 호출로 배선 (chunked streaming·dedup·retransmit 등) — 여러 작은 task 로 분할.
- (후속) job row retention / cleanup 정책 + artifact 저장소 mechanism 선택 (새 dependency 가능성 시 별도 §5 게이트).
- (후속) 일반 `AuditLog` Prisma model 이 별도 보안 ADR 로 신설되면 §6 매핑표의 `AuditLog` export-source 를 `permissionDeniedRecord` → 새 `auditLog` delegate 로 승격 (T-NNNN, `commitMode: pr` — `src/export/export-job.service.ts` 의 `EXPORT_ENTITY_SOURCES` + `ExportEntityDelegate` union 동기 수정 + 본 ADR §6 표 update).
- (후속) [api.md](../architecture/api.md) / [data-model.md §4](../architecture/data-model.md) 의 export entity 열거 서술이 §6 의 `AuditLog (실 export-source: PermissionDeniedRecord)` 치환을 반영하도록 doc-sync (별도 direct task).

Refs: T-0484, ADR-0033, ADR-0035, ADR-0002, ADR-0042, ADR-0004, REQ-030, REQ-032, REQ-045, Q-0040
