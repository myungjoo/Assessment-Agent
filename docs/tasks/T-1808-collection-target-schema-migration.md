---
id: T-1808
title: CollectionTarget model + migration 박제 (ADR-0059 Follow-up (a))
phase: P6
status: DONE
prNumber: 1420
completedAt: 2026-08-30T16:03:43Z
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-30
independentStream: p6-collection-target
dependsOn: [T-1807]
touchesFiles:
  - prisma/schema.prisma
  - prisma/migrations/20260830000000_collection_target/migration.sql
  - test/prisma-schema.spec.ts
plannerNote: "P6 PLAN 130 행 시스템 축 — ADR-0059 §Follow-ups (a) schema+migration slice, backbone × 1.5 = 200 LOC / 3 파일"
---

# T-1808 — CollectionTarget model + migration 박제 (ADR-0059 Follow-up (a))

## Why

[PLAN.md](../PLAN.md) `130 행` 오너 지시(R-164~R-168)의 잔여 3 row 중 **시스템 축**(REQ-072 등록·편집 / REQ-070 빈 상태 우산 / REQ-073 RBAC)은 지금 평가 대상 시스템 좌표를 **env 에만** 두고 있어 운영자가 화면에서 대상을 늘릴 수 없다. 직전 slice [T-1807](T-1807-adr-collection-target-registration.md) 이 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) 로 저장 위치 · credential 경계 · 대상 종류 모델링 · API/RBAC 6 축을 확정했고, 그 §Follow-ups 가 `(a) schema + migration → (b) repository+service → (c) DTO+controller → (d) e2e` 순서를 못 박았다. 본 task 는 그 chain 의 **첫 slice** 로, §Decision 4 의 필드 표와 `@@unique([type, instanceKey])` 를 `prisma/schema.prisma` 에 additive 로 박제하고 migration 을 생성한다. 코드 배선(repository / service / controller / web)은 전부 후속 slice 소관이다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — 특히 `§Decision 2`(credential 경계) · `§Decision 4`(필드 표 · `@@unique` · enum-as-String · `String[]` 근거) · `§Decision 6`(§5 게이트 판정) · `§Follow-ups (a)`
- `prisma/schema.prisma` — `model ServiceIdentity`(`250 행` 부근, enum-as-String + `@@unique` 관례) 와 `model ImportJob`(파일 말미, 주석 밀도 · `@@index` 관례)
- `prisma/migrations/20260618000000_export_import_job/migration.sql` — migration SQL 주석 · additive-only 표기 선례(T-0485)
- `prisma/migrations/20260706000000_user_timezone/migration.sql` — 최근(가장 마지막) migration 의 디렉토리 이름 규칙
- `test/prisma-schema.spec.ts` — 기존 schema-validation spec 의 (a) happy-path / (b) negative / (c) 안전망 3 구획 패턴. 본 task 의 spec 은 이 파일에 **describe 블록 1 개를 append** 한다(신규 spec 파일 신설 금지)

## Acceptance Criteria

- [ ] **additive 재확인이 첫 의무** — `prisma/schema.prisma` 를 실측해 `CollectionTarget` 추가가 (i) 기존 model 의 컬럼·relation 을 1 개도 바꾸지 않고, (ii) 기존 model 에 back-relation 필드 추가가 불필요하며, (iii) 기존 row 를 읽거나 옮기는 data migration 이 0 임을 확인한다. **셋 중 하나라도 깨지면 즉시 작업 중단 + BLOCKED(`db-schema-change`) 로 [CLAUDE.md §5](../../CLAUDE.md) owner 게이트(humanQuestion)를 경유한다** (ADR-0059 `§Decision 6` 위임).
- [ ] `prisma/schema.prisma` 에 `model CollectionTarget` 추가 — ADR-0059 `§Decision 4` 필드 표 1:1: `id String @id @default(cuid())` / `type String` / `instanceKey String` / `endpoint String` / `orgs String[]` / `repos String[]` / `spaces String[]` / `active Boolean @default(true)` / `createdAt DateTime @default(now())` / `updatedAt DateTime @updatedAt`. **relation 0** (다른 model 과 FK 를 맺지 않는다).
- [ ] `@@unique([type, instanceKey])` 박제. `endpoint` 단독 unique 는 두지 않는다(ADR-0059 `§Decision 4` 근거 주석으로 명시).
- [ ] **credential 컬럼 0** (ADR-0059 `§Decision 2`) — `token` · `tokenEnc` · `secret` · `password` · `apiKey` · `credential` 계열 컬럼을 **정의하지 않는다**. DB 는 `instanceKey` 참조만 보유한다는 취지를 schema 주석에 명시(ADR-0006 raw 미저장 schema-level 강제 동형 기법).
- [ ] `type` 은 Prisma `enum` 으로 격상하지 않고 `String` 유지 — 근거(ADR-0059 `§Decision 4` (i)~(iii))를 schema 주석 1~3 줄로 박제. 값 invariant(`"GITHUB"` | `"CONFLUENCE"`) 강제는 후속 DTO `@IsIn` 소관임을 함께 적는다.
- [ ] migration 생성 — `prisma/migrations/20260830000000_collection_target/migration.sql`. `CREATE TABLE "CollectionTarget"` + `CREATE UNIQUE INDEX` 만 포함하고 **기존 table 의 ALTER / DROP / UPDATE 문 0**. 다중 값 컬럼은 PostgreSQL `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` 로 둔다. 파일 상단 주석에 task ID · ADR 절 · additive-only 사실을 T-0485 선례 형식으로 적는다.
- [ ] `pnpm prisma validate` 통과 + `pnpm prisma format` 적용 후 diff 안정(포맷터가 재차 바꾸지 않음).
- [ ] **Happy-path unit test** — `test/prisma-schema.spec.ts` 에 `describe("prisma schema — CollectionTarget (T-1808, ADR-0059 §Decision 4)")` 블록을 append 해, generated `PrismaClient` 가 `collectionTarget` delegate 를 노출하고 DMMF datamodel 에 model 이 존재하며 10 개 필드가 각각 기대 타입(`String` / `Boolean` / `DateTime`)과 list 여부(`orgs` · `repos` · `spaces` 는 `isList: true`)로 선언됐음을 단언하는 test 1+.
- [ ] **Error path test** — 필수 필드(`type` · `instanceKey` · `endpoint`)가 `isRequired: true` 이고 nullable 이 아님을 단언하는 test 1+ (누락 시 저장 불가라는 schema-level 계약의 regression 방지).
- [ ] **Flow / branch coverage** — schema 선언에는 런타임 분기가 없다. 해당 항목은 `type` discriminator 가 허용하는 두 값(`"GITHUB"` / `"CONFLUENCE"`)이 **DB 제약이 아니라 후속 DTO 검증 소관** 임을 문서화하는 단언(= Prisma enum 이 생성되지 않았음 확인)으로 대체하고, spec 주석에 "분기 없음 — schema 선언 slice" 를 명시한다.
- [ ] **Negative cases 충분 cover** — 최소 4 종 각 1+ test: (1) credential 계열 금지 컬럼 목록이 field 로 **존재하지 않음**(ADR-0059 `§Decision 2` regression), (2) 다른 model 로의 relation 필드가 0 개임(additive 판정 regression), (3) `@@unique([type, instanceKey])` 선언이 schema 원문과 migration SQL 양쪽에 존재하고 `endpoint` 단독 unique 는 부재함, (4) 기존 model(`Person` · `User` · `ServiceIdentity`) 의 필드 수·필수성이 본 migration 으로 바뀌지 않았음을 확인하는 안전망 단언(기존 spec (c) 구획 패턴 승계).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green (tester 확인) + CI green.

## Out of Scope

- repository · service · DTO · controller · module 배선 — ADR-0059 `§Follow-ups (b)` · `(c)` 소관. `src/` diff 0.
- e2e 오류 계약 고정(`§Follow-ups (d)`) · AdminView 등록·편집 패널(`(e)`) · `api.md` 표 추가와 REQ status 재판정(`(f)`) · env 병합 배선(`(g)`).
- `PLAN.md` `130 행` 마커 승격 · `requirements.md` REQ-070/072/073 status 변경 — 본 slice 는 어떤 완료 표기도 하지 않는다.
- `package.json` · lockfile · `.github/workflows/` 변경 0 (새 dependency 0).
- 기존 env 기반 수집 경로(`github-instance-config.ts` · `confluence-instance-config.ts` · `collection-entry.service.ts`) 수정 — 1 LOC 도 건드리지 않는다.
- seed 데이터 삽입 · 기존 env 대상의 DB 이관 스크립트.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)

## 결과 (DONE — 2026-08-30T16:03:43Z, PR #1420 → main `26e4add8`)

- AC 1 게이트 통과 — `prisma/schema.prisma` 실측으로 additive 3 조건(기존 model 컬럼·relation 무변경 / back-relation 추가 불요 / 기존 row 를 읽거나 옮기는 data migration 0)을 확인해 [CLAUDE.md §5](../../CLAUDE.md) owner 게이트(`db-schema-change`) 경유 없이 진행했다.
- `model CollectionTarget` 10 필드를 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Decision 4` 필드 표와 1:1 로 박제하고 `@@unique([type, instanceKey])` 를 뒀다 — relation 0, credential 계열 컬럼 0(`§Decision 2`), `type` 은 Prisma enum 으로 격상하지 않고 `String` 유지(값 invariant 는 후속 DTO `@IsIn` 소관이라 주석 병기).
- `prisma/migrations/20260830000000_collection_target/migration.sql` 은 `CREATE TABLE` + `CREATE UNIQUE INDEX` 만 — 기존 table 의 ALTER / DROP / UPDATE 문 0, 다중 값 컬럼은 `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`.
- `test/prisma-schema.spec.ts` 에 describe 블록 1 개 append (신규 spec 파일 신설 0) — happy 12 · error path 3 · branch 대체 1(Prisma enum 미생성 확인) · negative 4(credential 컬럼 부재 / relation 0 / unique 계약 양쪽 존재 + `endpoint` 단독 unique 부재 / 기존 model 무손상).
- 3 파일 `+300/-0`, `src/` diff 0. 458 suite · 13243 test green, line 99.94% · function 100%. reviewer APPROVE round 1/7(BLOCKER · MAJOR · MINOR 0), 4-게이트 전부 pass, squash + branch delete.
