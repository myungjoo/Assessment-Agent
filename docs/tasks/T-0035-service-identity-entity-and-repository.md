---
id: T-0035
title: P3 — ServiceIdentity entity + Person↔ServiceIdentity 1:N + isPrimary invariant + migration
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-023, REQ-024]
estimatedDiff: 260
estimatedFiles: 5
created: 2026-05-25
plannerNote: P3 셋째 task. p3-implementation-plan.md §2 row 3 의 cron #5 split — T-0034 머지 후 ServiceIdentity entity + Person 1:N relation + isPrimary invariant + ServiceIdentityRepository + 두 번째 migration.
dependsOn: [T-0034]
blocks: [T-0036, T-0037]
hqOrigin: null
humanApprovalGate: false
---

# T-0035 — P3 셋째 task: ServiceIdentity entity + Person↔ServiceIdentity 1:N + isPrimary invariant

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 (L52 — "서비스별 ID 매핑 — github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등 각 서비스의 ID 보유, 일부 NULL 허용 (R-48)" + L53 — "Primary key 역할 ID 지정 — 서비스 중 1 개의 ID 를 기준 식별자로 (예: confluence.sec.samsung.net ID) (R-47)") + [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 3 의 **cron #5 split footnote** ("T-0034 임계 task — split 의무 평가" 의 잔여 절반) 첫 책임 슬라이스. 직전 T-0034 머지 ([087b322](https://github.com/myungjoo/Assessment-Agent/commit/087b322)) 로 Person entity / PersonRepository / UserModule skeleton / 첫 migration 박제 — 본 task 는 그 위에 **ServiceIdentity entity Prisma model + Person↔ServiceIdentity 1:N relation + isPrimary invariant (REQ-024) + 두 번째 migration + ServiceIdentityRepository 4 CRUD primitive** 까지만 진행한다.

본 task 의 split 의도 ([T-0034](./T-0034-person-repository-and-user-module-skeleton.md) Out of Scope §108 "ServiceIdentity entity / Prisma model / `isPrimary` invariant → T-0035" 명시 + p3-implementation-plan.md §2 footnote 명시):

- **DO (본 task)**: (1) prisma/schema.prisma 에 ServiceIdentity model 추가 — `id`(cuid PK) / `personId`(FK → Person.id) / `service`(enum-like String — github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등) / `externalId`(서비스 측 ID 문자열) / `isPrimary`(Boolean default false) / `createdAt` / `updatedAt`. (2) Person model 에 `serviceIdentities ServiceIdentity[]` relation 필드 추가. (3) `@@unique([personId, service])` invariant — 1 Person 이 동일 service 의 ID 2 개 가질 수 없음. (4) `pnpm prisma migrate dev --name service_identity` 로 두 번째 migration 생성 (Prisma CLI 자동 — 수동 SQL 편집 X). (5) `src/user/service-identity.repository.ts` — ServiceIdentityRepository class (4 CRUD primitive: `findByPersonId` / `create` / `setPrimary` / `delete`). (6) `src/user/service-identity.repository.spec.ts` — happy/error/branch/negative test + coverage line/function ≥ 80%. (7) UserModule providers/exports 에 ServiceIdentityRepository 추가.
- **DO NOT (후속 task 책임)**: (a) `isPrimary` invariant 의 **service-layer 강제** (1 Person 당 정확히 1 row 의 `isPrimary=true`) — 본 task 는 schema 차원의 `@@unique` 만, 도메인 invariant 검증은 후속 PersonService / ServiceIdentityService 책임 (T-0036+). 본 task 의 `setPrimary` 메서드는 Prisma transaction 으로 기존 primary unset + 새 primary set 의 두 op 만 수행 — 검증 책임 없음. (b) PersonService (도메인 로직: group/part invariant 검증 / soft delete cascade / ServiceIdentity primary 자동 지정 등) → T-0036. (c) PersonController + REST endpoint (`GET/POST/PATCH/DELETE /api/persons` + `/api/persons/:id/service-identities`) + DTO + class-validator → T-0036. (d) Group / Part entity Prisma model + Person↔Group N:M + Person↔Part N:1 invariant → T-0037 (p3-implementation-plan.md §2 의 T-0035 책임이 한 자리 뒤로 밀린 결과 — T-0034 의 split 으로 인한 ID 시퀀스 shift). (e) p3-implementation-plan.md §2 표의 task ID 시퀀스 갱신 박제 — 별도 doc-only follow-up.

본 split 결정의 정당성: T-0034 의 split 으로 ServiceIdentity 가 T-0035 로 이전 + Group/Part 가 T-0037 로 한 자리씩 밀린 결과를 자연 적용. ServiceIdentity entity 단독 + repository + migration 만으로 5 파일 / ~260 LOC — [CLAUDE.md §3](../../CLAUDE.md) cap (≤5 파일 / ≤300 LOC) 안. ADR 신설 0 (data-model.md §2 row 2 ServiceIdentity + §3 관계 1 + REQ-024 invariant 가 conceptual source 로 충분, ADR-0002 의 Prisma schema-as-code 가 implementation form).

산출물 (5 파일):

1. **prisma/schema.prisma** (수정) — ServiceIdentity model 추가 + Person.serviceIdentities relation 필드 추가 + `@@unique([personId, service])`. ~30 LOC.
2. **prisma/migrations/&lt;timestamp&gt;_service_identity/migration.sql** (Prisma CLI 자동 생성) — ServiceIdentity table + FK + unique index. ~25 LOC.
3. **src/user/service-identity.repository.ts** (신규) — ServiceIdentityRepository class + 4 메서드. ~80 LOC.
4. **src/user/service-identity.repository.spec.ts** (신규) — Jest unit test (happy/error/branch/negative + R-112 coverage). ~110 LOC.
5. **src/user/user.module.ts** (수정) — providers/exports 에 ServiceIdentityRepository 1 줄 추가. +2/-0 LOC.

cap 검산: 5 파일 정확히 / ~260 LOC. 추정 검증은 architect 가 첫 read 직후 재검산 + 필요 시 더 작게 split (예: schema + migration 만 + repository 별도). 추정 초과 시 planner 재호출.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L52, L53) — "서비스별 ID 매핑" + "Primary key 역할 ID 지정" bullet
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 3 + footnote "T-0034 임계 task — split 의무 평가"
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 row 2 ServiceIdentity entity + §3 관계 1 Person↔ServiceIdentity 1:N + §6 REQ-023/024/025 cover
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) §6 data 단락 ServiceIdentity 사용 흐름
- [docs/architecture/modules.md](../architecture/modules.md) UserModule 항목 (책임 + 의존성)
- [docs/architecture/directory.md](../architecture/directory.md) `src/user/` 위치 + module sub-structure 표준
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) PostgreSQL + Prisma + adapter-pg 결정
- [docs/requirements.md](../requirements.md) REQ-023 / REQ-024 / REQ-025 row
- [prisma/schema.prisma](../../prisma/schema.prisma) 현재 Person model (T-0033/T-0034 산출)
- [prisma/migrations/20260525000000_init/migration.sql](../../prisma/migrations/) 첫 migration 산출물 (T-0034)
- [src/user/person.repository.ts](../../src/user/person.repository.ts) PersonRepository 의 PrismaService 주입 패턴 — ServiceIdentityRepository 가 본 pattern 동일 적용
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) PrismaService mock 패턴 — ServiceIdentityRepository spec 이 본 pattern 동일 적용
- [src/user/user.module.ts](../../src/user/user.module.ts) providers/exports 배열 (ServiceIdentityRepository 추가 위치)
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) PrismaService 시그니처 (`serviceIdentity` delegate 자동 생성됨)
- [package.json](../../package.json) `scripts.postinstall` / Prisma CLI 명령 / jest coverageThreshold
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr) / §3.2 (R-110~R-114 + coverage line ≥ 80% AND function ≥ 80%)

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. Schema 확장

- [ ] `prisma/schema.prisma` 에 ServiceIdentity model 추가:
  - `id String @id @default(cuid())` PK
  - `personId String` FK → Person.id
  - `service String` (예: "github.com" / "github.sec.samsung.net" / "github.ecodesamsung.com" / "confluence.sec.samsung.net"; 본 task 는 enum 도입 안 함 — 단순 String + service-layer validation 은 후속 책임)
  - `externalId String` (서비스 측 user ID 문자열)
  - `isPrimary Boolean @default(false)` (REQ-024)
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `person Person @relation(fields: [personId], references: [id], onDelete: Cascade)` — Person 삭제 시 ServiceIdentity cascade (REQ-026 soft delete 는 active flag 만 toggle 이므로 본 cascade 는 hard delete 시에만 발동).
  - `@@unique([personId, service])` — 1 Person 의 동일 service ID 2 개 금지 invariant.
- [ ] Person model 에 `serviceIdentities ServiceIdentity[]` relation 필드 1 줄 추가.

### B. Migration 생성

- [ ] `pnpm prisma migrate dev --name service_identity` 실행하여 `prisma/migrations/<timestamp>_service_identity/migration.sql` 생성. schema.prisma 와 정합.
- [ ] migration SQL inspect 시 `CREATE TABLE "ServiceIdentity"` + `ALTER TABLE "ServiceIdentity" ADD CONSTRAINT ... FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE` + `CREATE UNIQUE INDEX "ServiceIdentity_personId_service_key"` 가 존재.
- [ ] 본 migration SQL 은 Prisma CLI 자동 생성물 — 수동 편집 안 함.

### C. ServiceIdentityRepository 코드

- [ ] `src/user/service-identity.repository.ts` 신규 — `@Injectable()` class 가 PrismaService 를 생성자 주입받고 다음 4 메서드 공개:
  - `findByPersonId(personId: string): Promise<ServiceIdentity[]>` — 해당 Person 의 모든 ServiceIdentity 반환 (isPrimary 우선 정렬 또는 service 알파벳 순 — 본 task 는 Prisma default 순서 유지, sort 는 후속 service 책임).
  - `create(input: { personId: string; service: string; externalId: string; isPrimary?: boolean }): Promise<ServiceIdentity>` — `isPrimary` default false. Prisma `P2002` (unique constraint `personId+service` 위반) 시 propagate (catch 안 함).
  - `setPrimary(personId: string, serviceIdentityId: string): Promise<ServiceIdentity>` — Prisma `$transaction` 으로 (1) 해당 Person 의 기존 `isPrimary=true` row 들을 모두 `false` 로 unset (REQ-024 invariant — 1 Person 당 정확히 1 primary), (2) 인자의 serviceIdentityId 를 `isPrimary=true` 로 set. 두 op 가 atomic. 본 메서드는 *primary 가 0 → 1 / 1 → 다른 1 두 transition 모두* cover.
  - `delete(id: string): Promise<ServiceIdentity>` — hard delete (ServiceIdentity 는 soft delete 도입 안 함 — data-model.md §5 에서 entity 별 결정으로 deferred, 본 task 는 hard delete 채택). id 부재 시 Prisma `P2025` propagate.
- [ ] `src/user/user.module.ts` 의 `providers` / `exports` 배열에 `ServiceIdentityRepository` 추가 (1 줄씩).

### D. Unit test (R-112 강제)

- [ ] `src/user/service-identity.repository.spec.ts` 신규 — PrismaService 의 `serviceIdentity` 와 `$transaction` 을 Jest mock 으로 대체. 다음 case cover:
  - **Happy path × 4 메서드**: findByPersonId / create / setPrimary / delete 각 1 test (PrismaService mock 호출 인자 + return 값 검증).
  - **Error path**: create 가 `P2002` throw (동일 personId+service 중복) 1 test / delete 가 `P2025` throw (id 부재) 1 test / setPrimary 의 `$transaction` 안 두 op 중 하나가 throw 시 그대로 propagate 1 test (transaction rollback 가정).
  - **Branch**: create 의 `isPrimary?: boolean` 의 두 분기 — (a) `isPrimary` 미지정 시 false default 동작 1 test, (b) `isPrimary: true` 명시 시 그대로 전달 1 test.
  - **Negative**: findByPersonId 의 personId 가 존재하지 않는 (Person row 부재) 경우 빈 배열 반환 1 test / setPrimary 의 serviceIdentityId 가 다른 Person 소속이어도 본 layer 는 cross-person 검증 안 함 (service-layer 책임) — 본 layer 가 raw forward 하는지 검증 1 test / create 의 externalId 가 empty string 인 경우 raw pass-through 1 test (validator 는 service 책임). 분기 4 항목 모두 cover.
- [ ] `pnpm test:cov` 실행 결과 ServiceIdentityRepository 의 line ≥ 80% AND function ≥ 80% (jest `coverageThreshold.global` 강제, [package.json](../../package.json) 의 jest config). 전체 coverage 도 thresholds 미달 시 jest exit 1 → CI red.

### E. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (새 파일 0 lint error).
- [ ] `pnpm build` 통과 (TypeScript 컴파일 성공 — `@prisma/client` 의 ServiceIdentity type 자동 생성 후 import 가능).
- [ ] `pnpm test` 통과 (모든 unit test green — 기존 PersonRepository / UserModule spec 포함 regression 없음).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (기존 smoke 가 regression 없이 통과).
- [ ] `pnpm test:e2e` 통과 (기존 e2e 가 regression 없이 통과).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### F. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE 또는 결함 사항 후속 round 처리.
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 또는 MCP `add_issue_comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-112 coverage / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 또는 MCP `merge_pull_request --squash` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **isPrimary invariant 의 service-layer 강제** (1 Person 당 정확히 1 row 의 `isPrimary=true` 검증) → T-0036 PersonService / ServiceIdentityService 책임. 본 task 의 `setPrimary` 메서드는 기존 unset + 새 set 의 두 op 만 atomic 수행, *primary 가 0 row 인 상태* 의 검증 책임은 service-layer.
- **PersonService (도메인 로직)** — group/part invariant 검증 / soft delete cascade / ServiceIdentity primary 자동 지정 등 → T-0036.
- **PersonController + REST endpoint** — `GET/POST/PATCH/DELETE /api/persons` + nested `/api/persons/:id/service-identities` → T-0036.
- **DTO + class-validator** — Person / ServiceIdentity request/response shape → T-0036.
- **service field 의 enum 도입** — 본 task 는 String 으로 유지. 후속 task 가 `enum ServiceKind { GITHUB_COM, GITHUB_SEC_SAMSUNG_NET, ... }` 또는 별도 lookup table 도입 ADR 박제 가능.
- **Group / Part entity Prisma model** + Person↔Group N:M + Person↔Part N:1 invariant → T-0036 (p3-implementation-plan.md §2 의 T-0035 책임을 본 task 가 cron #5 split 으로 흡수한 결과 — 본 task 머지 후 후속 planner 호출 시 ID 시퀀스 한 자리씩 뒤로 shift).
- **User (로그인 계정) entity + AuthModule + RBAC guard + SuperAdmin 첫 로긴 자동 지정** → T-0037+.
- **Assessment / Contribution / Summary entity + AssessmentModule** → T-0038+.
- **p3-implementation-plan.md §2 표 task ID 시퀀스 갱신** (T-0034 / T-0035 split 으로 후속 task ID 가 한 자리씩 밀림 박제) — 별도 doc-only follow-up task. 본 task scope (코드 + migration) 외.
- **Migration rollback / down migration** — Prisma 는 단방향 migration 만 (별도 ADR 없으면 미도입).
- **Seed data** (`prisma db seed`) — 별도 task.
- **Repository pattern 의 abstract base class / interface 추상화** — over-engineering 회피. ServiceIdentityRepository 는 PersonRepository 와 동일하게 concrete class 1 개로 진행. 향후 동일 패턴 N entity 등장 시 별도 refactor task.
- **PostgreSQL container 의 CI service container 도입** — 본 task 의 unit test 는 PrismaService mock 으로 cover (DB 실제 connection 불필요). 실제 DB integration test 는 별도 ops task.
- **ServiceIdentity 의 audit log** — 누가 언제 setPrimary 호출했는지 등 → data-model.md §2 conceptual AuditLog row 의 책임 (별도 task).

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 본 task 첫 read 직후 (a) cap 재검산 (실제 LOC > 300 또는 파일 > 5 면 split 요청 — 예: schema+migration 만 vs repository 별도) (b) ServiceIdentity model 의 cascade policy 확정 (Person hard delete 시 cascade vs RESTRICT — 본 task 는 Cascade 채택, 사유 1 줄 박제) (c) `@@unique([personId, service])` invariant 의 schema-level vs service-level 책임 분리 박제 (d) ServiceIdentityRepository 의 4 메서드 시그니처 + `setPrimary` 의 `$transaction` 패턴 결정 (e) ADR 신설 필요 없음 — data-model.md §2 row 2 + §3 관계 1 + REQ-024 invariant 가 conceptual source 로 충분. implementer 가 schema 수정 + migration 생성 + 신규 repository 파일 + UserModule edit. tester 가 repository spec + lint/build/test:cov/smoke/e2e 검증.

## Follow-ups

(architect / implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **T-0036 후보** — PersonService + ServiceIdentityService (도메인 로직 — isPrimary 1-row invariant 강제 / soft delete cascade / 동명이인 / Group/Part invariant 검증) + PersonController + REST endpoint + DTO + class-validator. p3-implementation-plan.md §2 의 T-0035 책임이 본 task 머지로 한 자리 뒤로 shift.
- **T-0037 후보** — Group + Part entity Prisma model + Person↔Group N:M + Person↔Part N:1 mandatory invariant. p3-implementation-plan.md §2 의 T-0035 책임의 추가 절반.
- **doc-only follow-up** — p3-implementation-plan.md §2 표의 task ID 시퀀스 갱신 (T-0034 split + T-0035 cron #5 split 두 번 누적된 ID shift 박제).
- **service enum 도입 ADR 후보** — 현재 String 으로 박제한 ServiceIdentity.service 컬럼이 N service 추가 시 enum 또는 lookup table 로 격상될 수 있음. P4 진입 (실제 GithubAdapter / ConfluenceAdapter 도입) 시 결정 권장.
