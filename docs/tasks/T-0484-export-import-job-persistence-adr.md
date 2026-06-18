---
id: T-0484
title: ADR — export/import job 영속 데이터 모델 결정 (ExportJob/ImportJob)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: []
touchesFiles: [docs/decisions/ADR-0044-export-import-job-persistence.md, docs/architecture/data-model.md]
plannerNote: "P7 export/import 실 배선 chain step 1 — Q-0040 옵션1 승인 따라 ExportJob/ImportJob 영속 데이터 모델 ADR 박제(doc-only enumerated-section ×1.6)"
---

# T-0484 — ADR: export/import job 영속 데이터 모델 결정 (ExportJob/ImportJob)

## Why

Q-0040 이 옵션 1 (export/import 실 배선용 Prisma schema migration 승인) 으로 RESOLVED 됐다 (CLAUDE.md §5 DB schema 게이트 통과). 사용자가 명시한 절차는 **(1) ADR 로 export/import job 영속 데이터 모델 박제 → (2) Prisma schema + migration → (3) AssessmentModule export/import controller/service 배선** 이며, 본 task 는 그 **dependency-free 첫 step** 인 (1) ADR 작성이다. 누적 45 helper (T-0437~T-0483, `src/export/*.ts` 비-spec) 가 실 controller/service/DB 에 미배선인 상태를 회수하기 위한 contract source 를 박제한다. CLAUDE.md §5 — 사용자 승인 → ADR 작성 → 구현 순서이므로, 실제 schema migration·controller 배선은 본 task 가 아닌 후속 task (Follow-ups) 로 분리해 size cap (≤300 LOC / ≤5 파일) 을 지킨다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions[]` Q-0040 entry (특히 `decision` 필드 — 승인 범위·절차).
- `docs/architecture/data-model.md` §2 entity 목록 / §3 ER diagram / §4 raw 미저장 invariant / §5 cross-cutting field / §7 Out of scope (특히 `AuditLog` conceptual mention + Import-Export 언급).
- `docs/architecture/api.md` L56·L122~124·L176 — `GET /api/admin/export`·`POST /api/admin/import` 계약 (resource path / role / content type).
- `docs/use-cases/UC-07-export-import.md` §1 (3 invariant) / §3 (Export read-only vs Import destructive) / §5 main flow / §6 alt flow (scope-한정 dump, replace vs merge mode) / §7.5 (DB connection 실패) / §8.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` (reset-and-recreate + transaction atomicity 패턴 — Import 의 all-or-nothing 복원 invariant 가 동형).
- `docs/decisions/ADR-0002-db.md` (PostgreSQL + Prisma — schema-as-code form).
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` §Consequences (in-memory vs DB 영속 결정 선례 — job 영속 여부 trade-off 참고).
- 기존 ADR 1개 (예: `docs/decisions/ADR-0043-daily-deploy-test.md`) — 본 repo 의 ADR 문서 구조 / 섹션 template 참고.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0044-export-import-job-persistence.md` 신설 (status: ACCEPTED). 표준 ADR 섹션 (Context / Decision / Consequences / Alternatives / References) 포함, 본문 한국어 (§12).
- [ ] **Decision 박제 항목** (최소):
  - [ ] `ExportJob` / `ImportJob` (또는 동등) 영속 entity 의 책임·필드 목록 (개념 수준 + 구체 컬럼 의도) — 예: `id`, `status` (PENDING/RUNNING/SUCCEEDED/FAILED enum), `scope` (전체 / 기간 / 인원 / entity 한정 — UC-07 §6.1), `mode` (Import: replace vs merge — UC-07 §6.2), `requestedBy` (User 참조), `createdAt`, `startedAt`, `finishedAt`, `error`, dump/upload artifact 참조 식별자 (raw 미포함 — REQ-032).
  - [ ] **raw 미저장 invariant (REQ-032) 의 ExportJob/ImportJob 전파** — job entity 자체도 raw commit/문서 본문 컬럼 0, dump artifact 도 raw 미포함 (data-model.md §4 + UC-07 §1 invariant a 정합) 명시.
  - [ ] **Import atomic transaction invariant** (UC-07 §1 invariant b / ADR-0033 reset-and-recreate 패턴) — Import job 의 기존 row 삭제 + snapshot 재구성이 단일 `prisma.$transaction` all-or-nothing 임을 박제.
  - [ ] **idempotency / 재실행 정책** — 동일 job 중복 실행 / 부분 실패 후 재시도 처리 방침 (ADR-0033 §3 패턴 참고).
  - [ ] **AuditLog 와의 관계** — data-model.md §2 의 `AuditLog` conceptual mention (Import-Export event 감사) 과 ExportJob/ImportJob 의 책임 경계 명시 (중복 신설 회피).
  - [ ] **책임 module** — AssessmentModule (api.md L56 `/api/admin` = AssessmentModule controller) 정합.
- [ ] **Alternatives 박제** — 최소 2개 대안 비교: (a) job 영속 entity 없이 synchronous 처리 (즉시 dump/restore, 진행 추적 없음) vs (b) ExportJob/ImportJob 영속 entity 도입 (비동기 진행 추적·재시도·감사). 각 trade-off 1~2줄.
- [ ] **Out of scope 명시** — 구체 Prisma schema 코드 / migration SQL / controller endpoint 구현 / artifact 저장소 (파일시스템 vs object storage) 결정은 후속 task 책임으로 분리.
- [ ] `docs/architecture/data-model.md` §2 entity 표에 `ExportJob` / `ImportJob` row 추가 (책임 / source UC = UC-07 / 관련 REQ / 책임 module = AssessmentModule) + §2 합계 갱신 + §3 ER diagram 에 관계 추가 (User ↔ ExportJob/ImportJob 등) + §7 Out of scope 의 관련 항목 갱신. ADR-0044 링크 cross-reference.
- [ ] **새 외부 dependency 추가 0** — package.json 변경 0 (본 task 는 ADR + doc 만). 새 dep 필요 판단 시 즉시 BLOCKED (Q-0040 승인 범위 밖).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과 green 확인 (R-110 — ADR/doc-only task 이나 ADR 신설은 commitMode: pr 이므로 CI green 검증 의무. 코드 변경 0 이므로 기존 test 가 깨지지 않음을 확인).

## Out of Scope

- **Prisma schema 코드 작성** (`prisma/schema.prisma` 의 `model ExportJob` / `model ImportJob`) — 후속 task (T-0485 후보).
- **Migration SQL / `prisma migrate` 실행** — 후속 task.
- **AssessmentModule export/import controller·service 구현** + 45 helper 배선 — 후속 task chain.
- **artifact 저장소 mechanism** (로컬 파일시스템 vs S3-호환 object storage) 의 구체 선택 — 새 외부 dependency 가능성 있으므로 본 task 밖, 필요 시 별도 §5 게이트.
- **AuditLog entity 의 구체 schema** — 별도 보안 ADR (data-model.md §7) 책임.
- 코드 변경 일절 (src/ / test/ 수정 0).

## Suggested Sub-agents

`architect → tester`

(architect 가 ADR-0044 + data-model.md 갱신을 작성, tester 가 lint/build/test green 확인. implementer 는 코드 변경 0 이므로 생략 가능 — architect 가 doc 만 작성.)

## Follow-ups

- (후속) T-NNNN: `prisma/schema.prisma` 에 `model ExportJob` / `model ImportJob` 추가 + `prisma migrate` migration 파일 생성 (ADR-0044 Decision 기반, commitMode: pr, dependsOn: [T-0484]).
- (후속) T-NNNN: AssessmentModule 에 export/import controller (`GET /api/admin/export` / `POST /api/admin/import`) + service 골격 배선 (job 생성·status 추적, dependsOn: [schema task]).
- (후속) T-NNNN~: 누적 45 export/import helper (T-0437~T-0483) 를 controller/service 에 실제 호출로 배선 (chunked streaming·dedup·retransmit 등) — 여러 작은 task 로 분할.
