---
id: ADR-0044
title: export/import job 영속 데이터 모델 (ExportJob/ImportJob entity 도입 — 비동기 진행 추적·재시도·감사)
status: ACCEPTED
date: 2026-06-18
relatedTask: T-0484
supersedes: null
---

# ADR-0044 — export/import job 영속 데이터 모델 (ExportJob/ImportJob)

> 본 ADR 은 P7 "export/import 실 배선" milestone 의 **ADR-first 첫 slice** 다. [Q-0040](../STATE.json) 이 옵션 1 (export/import 실 배선용 Prisma schema migration 승인 — [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 통과) 로 RESOLVED 된 결정에 따라, export/import job 의 **영속 데이터 모델 (ExportJob/ImportJob entity) 만 conceptual 수준에서 decide** 하며 production code · Prisma schema 코드 · migration SQL · controller 구현 0 LOC 다. 누적 45 helper ([T-0437~T-0483](../tasks/) 의 `src/export/*.ts` 비-spec) 가 실 controller/service/DB 에 미배선인 상태를 회수하기 위한 **contract source** 를 박제한다. 사용자 승인 절차 ((1) ADR → (2) schema+migration → (3) controller/service 배선) 의 (1) 에 해당하며, (2)(3) 은 §Follow-ups 로 분해해 size cap (≤300 LOC / ≤5 파일) 을 지킨다.

## Context

[UC-07](../use-cases/UC-07-export-import.md) 이 Admin 의 export (read-only dump) / import (destructive restore) 대칭 흐름을 박제하고, [api.md L123~124](../architecture/api.md) 가 `GET /api/admin/export` / `POST /api/admin/import` (+ backup/restore) endpoint 를 [AssessmentModule](../architecture/modules.md) controller 책임으로 매핑해 두었다. 그러나 현 시점에 export/import 는 **DB 에 영속되는 job 추적 entity 가 없다** — 45 개 누적 pure-helper (chunked streaming · dedup · retransmit 등, T-0437~T-0483) 가 머지돼 있으나 실 controller/service/DB 에 미배선이고, job 의 진행 상태 (PENDING/RUNNING/...) · 실패 사유 · 재시도 여부 · 누가 언제 무엇을 dump/restore 했는지를 영속할 자리가 없다.

[UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 은 이미 "대량 dump 는 long-running operation 가능 — async job + status polling + chunked streaming + resumable upload 는 P5 의 별도 설계" 를 deferred 로 명시해 두었다. 본 ADR 은 그 deferred piece 의 **데이터 측면 (job 영속 entity)** 을 닫는다.

핵심 사실 — **export/import 는 평가 결과 영속화 ([ADR-0033](ADR-0033-evaluation-result-persistence.md)) 와 다른 종류의 데이터다**:

- ADR-0033 은 평가 결과 (`Assessment`/`Contribution`/`Summary`) 의 영속을 닫았다 — 이는 **export 가 dump 하는 대상 (payload)** 이다.
- 본 ADR 은 그 dump/restore **작업 자체의 진행 추적 (job)** 을 닫는다 — payload 가 아니라 operation 의 metadata.
- 따라서 본 ADR 의 ExportJob/ImportJob 은 평가 데이터 entity 와 책임이 직교하며, 기존 entity 를 재사용하지 않고 **신규 entity 2 개를 도입**한다 (ADR-0033 §Alternatives A 가 기존 entity 재사용을 택한 것과 상황이 다름 — 거기선 저장 대상 table 이 이미 있었으나, job 추적 table 은 부재).

### 외력

- **[Q-0040 decision](../STATE.json)** — 사용자가 옵션 1 (export/import 실 배선용 Prisma schema migration 승인, ExportJob/ImportJob 테이블 추가 + migration 정책) 으로 RESOLVED. [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트를 사람 명시 승인으로 통과. 절차는 (1) ADR → (2) schema+migration → (3) controller/service 배선이며 본 task 가 (1).
- **[UC-07 §1 invariant](../use-cases/UC-07-export-import.md)** — (a) raw 미저장 정책 ([REQ-032](../requirements.md)) 의 Export payload 자연 전파, (b) Import atomic transaction (all-or-nothing, 부분 복원 상태 없음), (c) UC-01 다음 발화의 자동 재수집. 본 ADR 의 §Decision 2·3 이 (a)(b) 를 job entity 차원으로 전파.
- **[REQ-032](../requirements.md) / R-59** ([README.md L59](../../README.md), [data-model.md §4](../architecture/data-model.md)) — raw data 저장 금지. job entity 자체도 raw 컬럼 0, dump artifact 도 raw 미포함을 §Decision 2 에서 박제.
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md) §Decision 3** — reset-and-recreate + `prisma.$transaction` all-or-nothing 패턴. Import 의 "기존 row 삭제 + snapshot 재구성" 이 이 패턴과 동형이므로 §Decision 3 이 그대로 재사용.
- **[ADR-0002](ADR-0002-db.md)** — PostgreSQL + Prisma. 본 conceptual entity 의 실 구현 form 은 P7 의 `prisma/schema.prisma` model (별도 후속 task).
- **[ADR-0042](ADR-0042-nestjs-schedule-adoption.md) §Consequences** — 동적 cron schedule 을 in-memory `SchedulerRegistry` 로만 보유 (비영속) 한 선례. 본 ADR 은 **반대 결정** — export/import job 은 DB 영속 (in-memory 휘발 아님). 근거는 §Alternatives B 에서 trade-off 로 박제 (job 은 진행 추적·감사·재시도가 요구라 휘발성 부적합, cron schedule 은 재부팅 시 재등록 가능한 설정값이라 휘발 허용).
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency 0 (내장 Prisma 만), 새 credential 0, DB schema 변경은 본 ADR 이 그 ADR (Q-0040 승인 동반).

## Decision

### Decision §1 — ExportJob / ImportJob 영속 entity 2 개 신규 도입 (책임·필드)

**채택: export 작업과 import 작업의 진행을 추적하는 영속 entity `ExportJob` / `ImportJob` 2 개를 신규 도입한다. 두 entity 는 책임 module = AssessmentModule ([api.md L56](../architecture/api.md) `/api/admin` = AssessmentModule controller 정합), source UC = UC-07 이다.**

두 entity 의 conceptual 필드 (개념 수준 + 구체 컬럼 의도 — 구체 type/index/constraint 는 P7 schema task 책임):

- **공통 필드 (ExportJob / ImportJob 둘 다)**:
  - `id` — job 식별자 (PK).
  - `status` — job 진행 상태 enum: `PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED`. ([CLAUDE.md §12](../../CLAUDE.md) — enum 토큰 영어 유지.)
  - `requestedBy` — 작업을 발화한 `User` 참조 (FK → User). UC-07 §2 actor = Admin/SuperAdmin.
  - `createdAt` — job row 최초 생성 시각 (요청 수신 시점).
  - `startedAt` — 실 작업 (dump/restore) 시작 시각 (nullable — PENDING 동안 null).
  - `finishedAt` — 종료 시각 (SUCCEEDED/FAILED 도달 시, nullable).
  - `error` — FAILED 시 사람-친화 사유 텍스트 (nullable — raw payload 아닌 진단 메시지만).
  - `artifactRef` — dump/upload artifact 참조 **식별자** (예: artifact 파일명 / object key / 무결성 hash). **artifact 본문 (raw dump bytes) 자체는 미저장** — pointer 만 (§Decision 2). 구체 artifact 저장소 (파일시스템 vs object storage) 는 Out of scope.
- **ExportJob 전용**:
  - `scope` — export 범위 enum/구조: 전체 (full) / 기간 한정 (range) / 인원 한정 / entity 한정 ([UC-07 §6.1](../use-cases/UC-07-export-import.md) 의 3 차원 옵션 — scope/dateRange/entitySelector). 구체 query schema 는 후속 task.
- **ImportJob 전용**:
  - `mode` — import mode enum: `replace` (default, 기존 row 삭제 후 snapshot 복원) / `merge` ([UC-07 §6.2](../use-cases/UC-07-export-import.md)).
  - `restoredRowCount` — 복원된 row 수 (SUCCEEDED 시 채워짐, 감사·결과 요약용, nullable).

**ExportJob/ImportJob 분리 근거**: 두 작업은 데이터 흐름 방향 (DB→artifact vs artifact→DB) · 멱등성 (export 는 read-only 무변화 vs import 는 destructive) · 전용 필드 (scope vs mode/restoredRowCount) 가 비대칭이라 단일 통합 `IoJob` entity 보다 2 entity 가 책임 명확 (§Alternatives C). 단, P7 schema task 가 공통 필드 비중을 보고 shared base / single-table-with-discriminator 를 선택할 여지는 열어둔다 (본 ADR 은 conceptual 2 entity 만 박제, 물리 schema 형태는 후속).

### Decision §2 — raw 미저장 invariant (REQ-032) 의 ExportJob/ImportJob 전파

**채택: ExportJob/ImportJob entity 자체도 raw commit 본문 / 문서 본문 컬럼 0 이며, 이들이 참조하는 dump artifact 도 raw 미포함이다 — [data-model.md §4](../architecture/data-model.md) + [UC-07 §1 invariant (a)](../use-cases/UC-07-export-import.md) 와 정합.**

- **job entity 자체**: status/timestamp/error/scope/mode/artifactRef 같은 **operation metadata 만** 보유. raw GitHub commit message / diff / Confluence page 본문 등을 컬럼으로 갖지 않는다 — 애초에 dump 대상 (`Assessment`/`Contribution`) 이 raw 를 보유하지 않으므로 ([ADR-0033 §Decision 2](ADR-0033-evaluation-result-persistence.md)) job entity 가 raw 를 끌어올 표면 자체가 없다.
- **dump artifact**: export 산출물은 평가 결과 + 인원 master + Group + LLM 설정 + Audit log snapshot 으로 구성되며 ([UC-07 §1](../use-cases/UC-07-export-import.md)), raw GitHub/Confluence 본문은 처음부터 DB 에 없으므로 자동 제외 ([data-model.md §4](../architecture/data-model.md) "Export 시 처리"). 본 invariant 위반은 별도 ADR 필수 ([CLAUDE.md §5](../../CLAUDE.md)) — job entity 에 raw 컬럼 추가 금지.
- `error` 필드의 진단 텍스트는 LLM raw 인용·외부 본문 quote 가 아닌 시스템 메시지에 한정 (구현 slice 가 sanitize 책임 미도입 — 입력이 raw-free 임은 상류 보장).

### Decision §3 — Import atomic transaction invariant (ADR-0033 reset-and-recreate 동형)

**채택: ImportJob 의 replace mode 복원 (기존 row 삭제 + file snapshot 재구성) 은 [ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md) 의 reset-and-recreate 패턴과 동형으로, 단일 `prisma.$transaction` all-or-nothing 으로 묶는다 — 부분 복원 상태가 존재하지 않는다 ([UC-07 §1 invariant (b)](../use-cases/UC-07-export-import.md) / [§5 step 7](../use-cases/UC-07-export-import.md) / [§7.5](../use-cases/UC-07-export-import.md)).**

- **transaction 경계**: 기존 row 일괄 삭제 → file snapshot 으로 재구성 → commit 이 하나의 `$transaction`. 중간 실패 시 전체 rollback → 기존 데이터 유실 0 ([UC-07 §7.5](../use-cases/UC-07-export-import.md) DB write fail 시 rollback). ADR-0033 의 delete→create atomicity 와 동일 메커니즘.
- **ImportJob status 와 transaction 의 관계**: `RUNNING` 동안 transaction 진행, commit 성공 시 `SUCCEEDED` + `restoredRowCount` 기록, rollback 시 `FAILED` + `error` 기록. job status 전이는 transaction 결과를 반영하되, **job row 자체의 status update 는 복원 transaction 과 별개 write** (job 추적 row 가 복원 transaction 에 휩쓸려 rollback 되면 실패 기록이 사라지므로 — job bookkeeping 은 transaction 밖). 구체 transaction 경계·격리 수준은 P7 service slice 책임.
- merge mode 의 conflict resolution (PK 충돌 / timestamp 비교 / dedupe) 은 [UC-07 §6.2](../use-cases/UC-07-export-import.md) 대로 P7 service layer 책임 (본 ADR scope 외).

### Decision §4 — idempotency / 재실행 정책

**채택: job entity 는 [ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md) 의 idempotency 정신을 따르되, export/import 의 operation 성격에 맞춰 다음을 박제한다.**

- **Export 재실행**: export 는 read-only 라 DB 무변화 ([UC-07 §8 (a)](../use-cases/UC-07-export-import.md)) — 같은 scope 로 N 회 실행해도 부작용 0. 각 실행은 새 ExportJob row 1 개 (감사 추적 목적 — 누가 언제 무엇을 dump 했는가는 매 실행이 별도 event). export 는 **중복 방지 unique key 불요** (read-only 이므로 중복이 데이터를 오염시키지 않음).
- **Import 재실행 / 부분 실패 후 재시도**: import 는 destructive 라 replace mode 의 복원 transaction (§Decision 3) 이 all-or-nothing 이므로, **부분 실패 후 재시도 = 동일 artifact 로 transaction 재실행** 이 안전하다 (이전 실패 transaction 은 rollback 되어 흔적 0, 재시도가 기존 row 삭제→재구성을 다시 수행). 동일 artifact 의 import 는 결과 DB 상태가 멱등 (같은 snapshot 으로 복원하면 row 집합 동일 — ADR-0033 의 "같은 입력 재실행 시 row 수 불변" mirror).
- **중복 실행 방지**: 동시에 같은 종류 destructive import 가 2 개 RUNNING 이 되는 것은 [UC-07 §6.4 race 정책](../use-cases/UC-07-export-import.md) (진행 중 작업 완료 후 실행 default) 으로 직렬화 — job status 가 `RUNNING` 인 ImportJob 존재 시 새 import 는 대기/거부 (구체 lock/queue mechanism 은 P7 service slice).
- 재시도가 새 ImportJob row 인지 기존 row 의 status 재전이인지는 P7 구현 결정 — 본 ADR 은 "동일 artifact 재시도가 멱등이고 안전하다" 만 박제.

### Decision §5 — AuditLog 와의 책임 경계

**채택: ExportJob/ImportJob 은 [data-model.md §2](../architecture/data-model.md) 의 `AuditLog` conceptual mention 과 책임이 분리되며, AuditLog 를 본 ADR 에서 신설하지 않는다 (중복 신설 회피).**

- **ExportJob/ImportJob 의 책임**: 개별 export/import operation 의 **진행 상태 추적 + 결과 metadata** (status / 진행 timestamp / restoredRowCount / error / artifactRef). job 의 lifecycle (PENDING→RUNNING→SUCCEEDED/FAILED) 을 보유하는 operation-scoped row.
- **AuditLog 의 책임**: User mutation event (등급 변경 / 평가 삭제 / Import-Export 등) 의 **감사 로그** — event-stream 형태 ([data-model.md §2](../architecture/data-model.md) / [§5 createdBy](../architecture/data-model.md)). [UC-07 §8](../use-cases/UC-07-export-import.md) 의 "Audit log 1 row 생성 (Export/Import 종류 + actor + scope/file source + row count)" 이 이 AuditLog event 다.
- **경계**: ExportJob/ImportJob = job 진행 추적 (live operation state), AuditLog = 불변 감사 event (operation 완료 후 영구 기록). 둘은 보완적 — import 1 회는 ImportJob 1 row (진행 추적) + AuditLog 1 event (감사) 를 모두 남길 수 있다. 본 ADR 은 ImportJob/ExportJob 만 도입하고 **AuditLog entity 의 구체 schema 는 별도 보안 ADR 책임** ([data-model.md §7](../architecture/data-model.md) Out of scope — ADR-0004 audit-log 후보). job entity 가 AuditLog 책임을 흡수하지 않는다.

## Consequences

### 긍정

- **UC-07 §8 NFR 의 deferred async job 추적이 데이터 측면에서 닫힌다** — long-running export/import 의 진행 추적·status polling·재시도·감사가 영속 entity 위에서 가능해진다. 45 helper vein 의 sunk 가치를 실 배선으로 회수할 contract source 가 박제된다.
- **새 dependency 0 / 새 credential 0** — 내장 Prisma (ADR-0002) 만 사용. Q-0040 승인으로 DB schema 게이트 통과 ([CLAUDE.md §5](../../CLAUDE.md) 충족).
- **ADR-0033 패턴 재사용으로 새 메커니즘 발명 0** — Import atomic transaction 이 reset-and-recreate `$transaction` 을 그대로 재사용 (homolog).
- **raw 미저장 invariant 의 새 위반 표면 0** — job entity 가 metadata 만 보유, artifact 는 pointer 만 (§Decision 2).
- **AuditLog 중복 신설 회피** — job 추적과 감사 로그의 책임 경계를 명확히 해 entity 비대 방지.

### 부정 / trade-off

- **신규 entity 2 개 도입으로 [data-model.md §2](../architecture/data-model.md) entity 수 증가** (11 → 13) — schema 표면 증가. 단 job 추적은 평가 데이터와 직교한 별도 도메인이라 기존 entity 재사용이 부적합 (§Alternatives A 가 synchronous 무영속 안을 검토).
- **ADR-0042 와 영속/비영속 결정 비대칭** — cron schedule 은 in-memory (비영속), export/import job 은 DB 영속. 두 결정의 근거 차이 (job 은 진행 추적·감사·재시도 요구 vs cron 은 재부팅 재등록 가능 설정) 를 §Alternatives B 에 박제했으나, 향후 "왜 어떤 건 영속, 어떤 건 휘발인가" 의 일관성 질문이 재부상하면 cross-ADR 정리 필요.
- **artifact 저장소 미결정** — `artifactRef` 가 참조하는 실 저장소 (파일시스템 vs object storage) 는 Out of scope 라, P7 구현 시 새 외부 dependency (S3-호환 SDK 등) 가 필요하면 별도 [CLAUDE.md §5](../../CLAUDE.md) 게이트 발화 가능 (그 시점 BLOCKED → 사용자 결정).
- **physical schema 형태 미확정** — 본 ADR 은 conceptual 2 entity 만 박제하고 shared base / single-table-with-discriminator 여부는 P7 schema task 로 미룬다 — 그 task 의 reviewer 점검 대상.

### Cross-Module Impact

본 결정은 **doc-only 이며 기존 public API / shared symbol contract 를 변경하지 않는다** — 신규 entity 2 개 도입 (data-model.md 표 row 추가) + ADR 신설뿐이고, 기존 `Assessment`/`Contribution`/`User` entity 시그니처·관계·기존 endpoint 계약을 보존한다. 영향 module 은 **AssessmentModule 1 개로 한정** (export/import controller/service 가 향후 job entity 를 사용 — 단 그 배선은 후속 task) — ≥3 module spread 아님 → [CLAUDE.md hard rule](../../CLAUDE.md) BLOCKED 미해당. `User` 참조 (`requestedBy` FK) 는 기존 User entity 를 읽기 참조만 하므로 AuthModule 의 User 계약 변경 0. 본 ADR 자체는 `src/` 코드 0 LOC 라 inbound caller scan 불요 (새 entity 의 실 caller 는 후속 schema/controller task 가 생성).

## Alternatives considered

### A. job 영속 entity 없이 synchronous 처리 (즉시 dump/restore, 진행 추적 없음) (미채택)

export/import 를 요청 즉시 동기 처리하고 (request → dump bytes 스트리밍 / file → 복원 → response) job 추적 entity 를 두지 않는 안. 미채택 — [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 이 "대량 dump 는 long-running operation 가능" 을 명시해 동기 처리는 timeout/연결 끊김 시 진행 상황을 알 수 없고, 부분 실패 후 재시도 추적·감사 (누가 언제 무엇을 restore 했나) 가 불가능하다. 작은 dump 는 동기로 충분하나 disaster recovery 의 대량 dump·resumable upload 요구를 cover 못함. 진행 추적 entity 가 이 gap 을 닫는다.

### B. job 영속 entity 도입 (비동기 진행 추적·재시도·감사) (채택)

export/import 작업마다 영속 ExportJob/ImportJob row 를 만들어 status/progress/error/artifactRef 를 추적하는 안 — **채택**. trade-off: schema 표면이 entity 2 개만큼 늘고, [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) 의 cron-schedule-비영속 결정과 비대칭이 생긴다. 그러나 (a) long-running operation 의 status polling/재시도 ([UC-07 §8](../use-cases/UC-07-export-import.md)), (b) destructive import 의 감사 추적 (UC-07 §8 (e) Audit log), (c) 부분 실패 후 안전한 재시도 (§Decision 4) 가 모두 영속 추적을 요구하므로 비용 대비 가치가 높다. ADR-0042 와의 비대칭은 의도적 — cron schedule 은 "재부팅 시 코드로 재등록 가능한 설정값" 이라 휘발 허용이지만, export/import job 의 진행 이력·감사는 휘발하면 복구 불가 (한 번 지나간 operation 의 결과를 재구성 못함).

### C. ExportJob/ImportJob 을 단일 통합 `IoJob` entity 로 통합 (미채택)

export 와 import 를 `type` discriminator 컬럼을 가진 단일 `IoJob` table 로 합치는 안. 미채택 (conceptual 수준에서는) — export (read-only, scope 필드) 와 import (destructive, mode/restoredRowCount 필드) 의 전용 필드가 비대칭이고 멱등성 의미가 정반대라 conceptual 표현은 2 entity 가 책임 명확하다. 단 이는 conceptual 결정일 뿐 — P7 schema task 가 공통 필드 비중을 보고 물리 layer 에서 single-table-with-discriminator 또는 shared base 를 선택할 여지는 열어둔다 (§Decision 1 말미). conceptual model 의 명료성과 physical schema 의 정규화는 별개 층위이므로 충돌 아님.

## Out of scope

본 ADR 은 **하지 않는다** — 다음은 후속 task / 별도 ADR 책임:

- **Prisma schema 코드 작성** (`prisma/schema.prisma` 의 `model ExportJob` / `model ImportJob`) — 후속 task (T-0485 후보, [ADR-0033 §Decision 4](ADR-0033-evaluation-result-persistence.md) migrate-deploy 패턴 재사용 예정).
- **Migration SQL / `prisma migrate` 실행** — 후속 task.
- **AssessmentModule export/import controller·service 구현** + 45 helper (T-0437~T-0483) 배선 — 후속 task chain (chunked streaming·dedup·retransmit 실 호출).
- **artifact 저장소 mechanism** (로컬 파일시스템 vs S3-호환 object storage) 의 구체 선택 — 새 외부 dependency 가능성 있으므로 본 task 밖, 필요 시 별도 [CLAUDE.md §5](../../CLAUDE.md) 게이트.
- **AuditLog entity 의 구체 schema** — 별도 보안 ADR 책임 ([data-model.md §7](../architecture/data-model.md), ADR-0004 audit-log 후보). 본 ADR 은 책임 경계만 박제 (§Decision 5).
- **구체 컬럼 type / index / unique constraint / cascade policy** — [data-model.md §1](../architecture/data-model.md) MVA 원칙대로 P7 schema task.
- **physical entity 형태** (2 table vs single-table-with-discriminator vs shared base) — P7 schema task 결정 (§Alternatives C).
- **merge mode conflict resolution / schema version migration** — P7 service layer ([UC-07 §6.2/§6.3](../use-cases/UC-07-export-import.md)).

## References

- [Q-0040 decision](../STATE.json) — export/import 실 배선 schema migration 승인 (옵션 1) — 본 ADR 의 직접 외력
- [UC-07](../use-cases/UC-07-export-import.md) — Export/Import/Backup/Restore use case (§1 invariant / §6 alt flow / §7.5 / §8 NFR — job 추적 요구의 source)
- [ADR-0033](ADR-0033-evaluation-result-persistence.md) — 평가 결과 영속화 (§Decision 3 reset-and-recreate `$transaction` 패턴 — Import atomic transaction 의 homolog)
- [ADR-0002](ADR-0002-db.md) — PostgreSQL + Prisma stack 기반 (본 conceptual entity 의 실 구현 form)
- [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) — cron schedule in-memory 비영속 선례 (본 ADR 의 영속 결정과 trade-off 대비, §Alternatives B)
- [docs/architecture/data-model.md](../architecture/data-model.md) — §2 entity 표 (본 ADR 이 ExportJob/ImportJob row 추가) / §4 raw 미저장 invariant / §7 Out of scope
- [docs/architecture/api.md](../architecture/api.md) L56·L123~124·L176 — `/api/admin/export`·`/api/admin/import` 계약 (AssessmentModule controller / Admin+ role)
- [README.md](../../README.md) L59 (REQ-032 raw 미저장) / "평가 자료의 저장" 단락
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / DB schema BLOCKED 게이트 (Q-0040 승인으로 통과) / 언어 정책

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112.)

- [ ] **Prisma schema slice** — `prisma/schema.prisma` 에 `model ExportJob` / `model ImportJob` 추가 + migration `<ts>_export_import_job` 생성 (`commitMode: pr`, ADR-0033 §Decision 4 migrate-deploy 패턴 재사용, dependsOn: [T-0484]).
- [ ] **controller/service slice** — AssessmentModule 에 `GET /api/admin/export` / `POST /api/admin/import` controller + service 골격 배선 (job 생성·status 추적, dependsOn: [schema slice]).
- [ ] **helper 배선 slice(s)** — 누적 45 export/import helper (T-0437~T-0483) 를 controller/service 의 실 호출로 배선 (chunked streaming·dedup·retransmit) — 여러 작은 task 로 분할.
- [ ] **(조건부) artifact 저장소 ADR** — 파일시스템 vs object storage 선택 시 새 dependency 가능성 → 별도 §5 게이트 ADR.
