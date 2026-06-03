---
id: T-0208
title: PermissionDeniedRecord prisma model + migration (ADR-0022 §1·§3·§4·§5 구현)
phase: P4
status: DONE
completedAt: 2026-06-04T01:02:00+09:00
mergedAs: 1039439
prNumber: 182
reviewRounds: 2
commitMode: pr
hqOrigin: Q-0019
coversReq: [REQ-044, REQ-016, REQ-059, REQ-029]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-06-04
plannerNote: P4 — ADR-0022 후속 chain 1번 slice. PermissionDeniedRecord schema model + migration (dependency-free, Q-0019 §5 게이트 OPEN). R-112 는 real-PostgreSQL smoke round-trip.
---

# T-0208 — PermissionDeniedRecord prisma model + migration (ADR-0022 §1·§3·§4·§5 구현)

## Why

[ADR-0022](../decisions/ADR-0022-permission-denied-record-data-model.md) 의 §"후속 task chain" 첫 row (**prisma schema + migration**) 를 구현한다 — ADR 이 박제한 데이터 모델(§1 필드 / §3 append-only `@@unique` 미정의 / §4 composite `@@index` 2종 / §5 standalone relation 부재 / immutable `updatedAt` 미정의)을 `prisma/schema.prisma` 의 `PermissionDeniedRecord` model + 그 migration 으로 코드 박제한다. [PLAN.md](../PLAN.md) P4 milestone-3(권한 거부 가시화)의 영속화 측 entity 이며, 사용자가 [STATE.json](../STATE.json) `humanQuestions[Q-0019]` 에서 DB schema migration 을 승인([CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 OPEN, 외부 credential 0 — CI 실 PostgreSQL 이미 존재 [ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md)). 새 외부 dependency 0(Prisma 기존). repository / service / wiring / emitter 구현은 후속 slice(Follow-ups).

## Required Reading

- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](../decisions/ADR-0022-permission-denied-record-data-model.md) — **단일 source**. Decision §1(필드 표 — `id`/`provider`/`instanceRef`/`resourceRef`/`principal` nullable/`httpStatus`/`reason` nullable/`createdAt`, `updatedAt` 미정의) / §3(append-only — `@@unique` 두지 않음) / §4(`@@index` 후보 2종) / §5(standalone — relation/FK 부재). 본 task 는 §1·§3·§4·§5 를 그대로 mirror.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 model 컨벤션(cuid PK / `createdAt @default(now())` / immutable entity 의 `updatedAt` 미정의 / enum-as-String literal). `DifficultyMapping` model(L356~367)·`Assessment`(L224~247)의 `@@index`/`@@unique` 표기법 mirror. 본 task 는 새 `PermissionDeniedRecord` model 1개 추가 — standalone 이라 다른 model 의 back-relation 필드 변경 0.
- [prisma/migrations/20260601010000_difficulty_mapping/migration.sql](../../prisma/migrations/20260601010000_difficulty_mapping/migration.sql) — hand-named 타임스탬프 dir + raw SQL `CREATE TABLE` + `CREATE INDEX` 포맷(본 migration 이 mirror). standalone 이라 `AddForeignKey` 절은 없음.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — CI 실 PostgreSQL 16 + `pnpm prisma migrate deploy` 패턴(본 migration 이 따를 절차) + §Cleanup `afterEach` truncate.
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — 실 PostgreSQL round-trip smoke 패턴(AppModule 부트스트랩 + `prisma.<model>.create` seed + 실 query 검증 + `afterEach(truncateAll)`). 본 task 의 신규 smoke spec 가 mirror.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `TRUNCATE_TABLES` 명단 + `truncateAll`. 본 task 가 `"PermissionDeniedRecord"` 1개 추가(test 격리).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 `PermissionDeniedRecord` model 추가 — ADR-0022 §1 필드를 그대로: `id String @id @default(cuid())`, `provider String`, `instanceRef String`, `resourceRef String`, `principal String?`(nullable), `httpStatus Int`, `reason String?`(nullable), `createdAt DateTime @default(now())`. **`updatedAt` 미정의**(§1 immutable). **`@@unique` 미정의**(§3 append-only — 중복 row 의도적 허용). **relation/FK 필드 미정의**(§5 standalone — 다른 model 변경 0).
- [ ] `@@index` 2종 추가(ADR-0022 §4) — `@@index([instanceRef, createdAt])`(instance×기간) + `@@index([provider, httpStatus, createdAt])`(provider×status×기간). `@@index([createdAt])` 단독은 §4 상 후보일 뿐 — 본 task 에서는 추가하지 않음(2 composite index 의 leading-edge 로 부분 cover, Out of Scope).
- [ ] `prisma/migrations/<YYYYMMDDHHMMSS>_permission_denied_record/migration.sql` 신설 — 직전 migration(`20260601010000_difficulty_mapping`) 보다 사전순 뒤서는 타임스탬프(예: `20260604000000_permission_denied_record`). raw SQL `CREATE TABLE "PermissionDeniedRecord"`(8 컬럼, `id` PK, nullable 컬럼은 `NOT NULL` 생략, `createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`) + `CREATE INDEX` 2개(위 composite index). `AddForeignKey` 절 없음(standalone). `prisma migrate dev` 로 자동 생성하되 생성 SQL 이 schema 와 정합하는지 확인(생성 불가 환경이면 위 mirror 포맷으로 수기 작성 — `prisma migrate deploy` 가 적용 가능한 형식).
- [ ] schema 와 migration 의 정합 검증 — `pnpm prisma migrate deploy`(또는 CI 의 동일 step)가 실 PostgreSQL 에 본 migration 을 적용해 `PermissionDeniedRecord` 테이블 + 2 index 를 생성하고, 이후 `prisma generate` 가 type 을 산출(빌드/smoke 가 의존).
- [ ] `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 에 `'"PermissionDeniedRecord"'` 추가(append-only standalone — 후속 smoke/e2e 의 `afterEach` 격리).
- [ ] **R-112 충족 전략(본 slice 는 순수 schema + migration SQL 이라 unit-testable TypeScript symbol 0 — integration smoke 로 cover)**: `test/smoke/permission-denied-record.smoke-spec.ts` 신설 — `persons.smoke-spec.ts` 패턴(AppModule 부트스트랩 + 실 PrismaService + `afterEach(truncateAll)` + `afterAll` disconnect) mirror. 본 smoke 가 migration+model 이 실 PostgreSQL 에서 동작함을 증명한다(R-113 smoke = bootstrap/실 DB 정합 책임).
- [ ] **Happy path(create + read round-trip)**: `prisma.permissionDeniedRecord.create({ data: { provider: "github", instanceRef: "github.sec.samsung.net", resourceRef: "/repos/o/r/commits", httpStatus: 403 } })` 로 1 row seed → `findUnique`/`findMany` 로 재조회해 컬럼 값(provider/instanceRef/resourceRef/httpStatus/createdAt) 왕복 일치 검증. `principal`/`reason` 미지정 시 `null` 박제 검증(§1 nullable). Confluence variant(`provider: "confluence"`, `instanceRef: "https://acme.atlassian.net/wiki/rest/api"`) 1 row 도 round-trip 검증(§1 instanceRef 정규화).
- [ ] **Error path / negative cases 충분 cover(예외 분기마다 1+)**: (a) required 컬럼 누락 시 reject — `provider` 또는 `instanceRef` 또는 `resourceRef` 또는 `httpStatus` 없이 `create` 시 실 DB(또는 Prisma type) 가 거부함을 검증(NOT NULL 위반). (b) **append-only 검증(§3)** — 동일 `(provider, instanceRef, resourceRef, httpStatus)` 값으로 `create` 를 2회 호출하면 **둘 다 성공해 2 row 가 된다**(`@@unique` 부재 → P2002 미발화 → 중복 허용). `count() === 2` + 두 row 의 `id` 가 서로 다름 검증. (c) `principal`/`reason` 에 명시값 전달 시 그대로 박제(nullable 이지만 값 수용) 1+.
- [ ] **Flow / branch 분기 cover**: 본 slice 는 schema + migration 이라 application 분기 코드 0 — "분기 없음(schema-only slice) — 이 항목은 §3 append-only round-trip(중복 2 row) + nullable 박제(null vs 값) 로 데이터-차원 분기를 cover" 를 spec 주석에 명시.
- [ ] `pnpm test:smoke` 가 본 smoke spec 를 picking 해 CI 실 PostgreSQL 에서 green(R-113). 본 slice 는 src TypeScript symbol 추가 0 이라 `pnpm test:cov`(unit coverage) 의 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 는 기존 수치를 회귀시키지 않음(신규 src 파일 0). `pnpm test:cov` 가 통과(회귀 0)함을 확인.
- [ ] `pnpm lint && pnpm build && pnpm test && pnpm test:smoke` green. tester 가 R-110(코드 검토 + test 작성 + test 수행) + R-113(smoke CI) 검증 수행. migration 적용 step(`prisma migrate deploy`) 이 CI 에서 본 테이블을 생성함을 확인.

## Out of Scope

- **repository + service** — `PermissionDeniedRecordRepository`(insert + §4 audit query) + service 는 후속 slice(ADR-0022 §후속 chain row 2). 본 task 는 schema model + migration + 격리/round-trip smoke 만.
- **영속화 emitter wiring** — `NO_OP_PERMISSION_DENIED_EMITTER` → 실 영속화 emitter(`PermissionDeniedEmitter` port 구현, ADR-0022 §6) 교체 + GithubModule/ConfluenceModule wiring 은 후속 slice(row 3). adapter 코드 변경 0.
- **`principal` 채우기 / ServiceIdentity FK 보강** — 이벤트 shape 확장 + nullable FK 는 별도 ADR(ADR-0022 §5 Alternatives (c)). 본 task 는 `principal String?` nullable 자리만 예약.
- **`@@index([createdAt])` 단독 추가** — ADR-0022 §4 상 후보일 뿐(2 composite index 의 leading-edge 로 부분 cover). 실 조회 빈도 측정 후 별도 task.
- **TTL / archival retention** — ADR-0022 §3 영구 보존(별도 ADR §Alternatives (b)).
- **다른 model 의 back-relation 필드 추가 / cascade 변경** — standalone(§5) 이라 기존 model 변경 0. Person/User/ServiceIdentity 등 손대지 않음.
- **e2e spec / API endpoint** — 권한 거부 audit 조회 endpoint 는 milestone-3 view 측 후속 책임(REQ-016 audience 분리 view).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0022 가 schema/index/relation contract 를 §1~§6 으로 이미 확정, 신규 architecture 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
