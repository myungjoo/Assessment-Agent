---
id: T-1809
title: CollectionTargetRepository CRUD primitive 5 종 + colocated spec 박제
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-registration
dependsOn: [T-1808]
touchesFiles:
  - src/assessment-collection/collection-target.repository.ts
  - src/assessment-collection/collection-target.repository.spec.ts
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-31
plannerNote: P5 / ADR-0059 Follow-up (b) 전반부 — schema(T-1808) 위 repository CRUD primitive 만 절단, service 변환층은 다음 slice
---

# T-1809 — CollectionTargetRepository CRUD primitive 5 종 + colocated spec 박제

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` (repository + service) 의 **전반부**다. 직전 slice T-1808 이 `model CollectionTarget` 과 additive migration 을 main 에 박았으나 그 table 을 읽고 쓰는 코드는 아직 0 이라 (`origin/main` 에서 `CollectionTarget` 문자열은 `prisma/schema.prisma` · `prisma/migrations/20260830000000_collection_target/migration.sql` · `test/prisma-schema.spec.ts` 3 곳뿐, `src/` 0 건) 등록·편집 계약이 코드로 이어지지 않는다. 본 slice 는 [PLAN](../PLAN.md) `130 행` 오너 지시(R-164~R-168)의 **시스템 축**(REQ-070 빈 상태 해소 · REQ-072 등록/편집 · REQ-073 권한) chain 에서 Prisma delegate 를 얇게 감싸는 CRUD primitive 5 종만 가져간다.

(b) 를 통째로 하면 repository(+spec) 와 service(+spec, `P2002`→409 / `P2025`→404 변환 + credential 미노출 보장)가 한 diff 에 들어가 [CLAUDE.md §3](../../CLAUDE.md) cap(≤ 300 LOC / ≤ 5 파일)을 구조적으로 초과한다 — 선례 `service-identity.repository.ts`(124 LOC) + spec(493 LOC) 만으로도 cap 을 넘는다. 따라서 (b) 를 repository slice(본 task) → service slice(다음 task) 로 2 분할한다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 2`(credential 경계: token 계열 컬럼 0, DB 는 `instanceKey` 참조만) · `§Decision 4`(필드 표 + `@@unique([type, instanceKey])` + `type` enum-as-String) · `§Decision 5`(오류 계약 표 c/d 행 — `P2002`→409 · `P2025`→404 는 **service** 소관) · `§Follow-ups (b)`
- [prisma/schema.prisma](../../prisma/schema.prisma) `690~707 행` — `model CollectionTarget` 10 필드 + `@@unique([type, instanceKey])` (본 slice 는 이 파일을 **읽기만** 한다)
- [src/user/part.repository.ts](../../src/user/part.repository.ts) — CRUD primitive 5 종(create / findById / findMany / update / delete) + Prisma error raw-propagate 주석 관례의 정본 선례. 본 slice 는 이 shape 을 mirror 한다.
- [src/user/service-identity.repository.spec.ts](../../src/user/service-identity.repository.spec.ts) `1~45 행` — repository spec 의 mocking 관례(로컬 `buildPrismaMock()` + fixture factory, 공유 helper 불요) + R-112 4 카테고리 헤더 주석 관례
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — 주입 대상 `PrismaService` (PersistenceModule 은 `@Global` 이라 module import 불요)
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 / §9 secret / §12 언어 정책

## Acceptance Criteria

- [ ] `src/assessment-collection/collection-target.repository.ts` 신설 — `@Injectable()` `CollectionTargetRepository` 가 생성자로 `PrismaService` 만 주입받고, `prisma.collectionTarget` delegate 에 1:1 forwarding 하는 public 메서드 정확히 **5 개**:
      `create(input)` / `findById(id): Promise<CollectionTarget | null>` / `findMany(): Promise<CollectionTarget[]>` / `update(id, input)` / `delete(id)`.
- [ ] 같은 파일에 input 타입 2 개를 export — `CollectionTargetCreateInput`(`type` · `instanceKey` · `endpoint` 필수, `orgs?` · `repos?` · `spaces?`: `string[]`, `active?`: `boolean`) 과 `CollectionTargetUpdateInput`(`endpoint?` · `orgs?` · `repos?` · `spaces?` · `active?` — **`type` · `instanceKey` 는 정체성 축이라 갱신 축에서 제외**, ADR-0059 `§Decision 5` PATCH 행).
- [ ] **credential 계열 필드 0** — 파일 전체에 `token` · `TOKEN_ENC` · `authUser` · `password` 계열 필드/입력이 등장하지 않는다 (ADR-0059 `§Decision 2`). `grep -in "token\|password" src/assessment-collection/collection-target.repository.ts` 가 0 건.
- [ ] Prisma error 는 **본 layer 에서 catch 하지 않고 raw propagate** — `try` / `catch` 0 건. `P2002`(create 중복) · `P2025`(update · delete row 부재) 변환은 다음 service slice 소관임을 주석으로 명시.
- [ ] colocated spec `src/assessment-collection/collection-target.repository.spec.ts` 신설 (helper 파일 신설 0 — 로컬 `buildPrismaMock()` + fixture factory 로 PostgreSQL 없이 isolated 실행).
- [ ] **happy-path test** — 5 메서드 각 1+ : 올바른 delegate 메서드를 올바른 인자 shape 으로 호출하고 (`create` → `{ data: input }`, `findById` → `{ where: { id } }`, `update` → `{ where: { id }, data: input }`, `delete` → `{ where: { id } }`) return 값을 그대로 propagate 한다.
- [ ] **error path test** — `create` 의 `P2002`(동일 `(type, instanceKey)` 재등록) 가 catch 없이 그대로 reject 되는지 1+, `update` · `delete` 의 `P2025`(row 부재) 가 그대로 reject 되는지 각 1+.
- [ ] **분기 cover** — `findById` 의 row 존재 / `null` 두 분기 각 1+, `findMany` 의 0 row(빈 배열) / 1+ row 두 분기 각 1+, `create` 의 `orgs` / `repos` / `spaces` / `active` **미지정**(schema default 위임) / **명시** 두 분기 각 1+.
- [ ] **negative cases 충분 cover** — 최소 4 종 각 1+ : (i) `update` 의 빈 객체 `{}` 가 그대로 forward 되어 `@updatedAt` 만 갱신되는 no-op-아님 케이스, (ii) `type` 값 유효성(`"GITHUB"` / `"CONFLUENCE"`) 을 본 layer 가 **검증하지 않고** 임의 문자열을 raw pass-through 한다(검증은 DTO `@IsIn` 소관), (iii) `CollectionTargetUpdateInput` 에 `type` · `instanceKey` 축이 **부재**함을 고정하는 drift-guard test 1+ (그 축이 추가되면 fail), (iv) `GITHUB` 인데 `spaces` 가 채워진 것 같은 type 별 정합성을 본 layer 가 거르지 않고 그대로 저장 인자로 넘긴다(조건부 필수성 검증은 service/DTO 소관 — ADR-0059 `§Consequences (c)`).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 — 전역 `coverageThreshold` (line ≥ 80% AND function ≥ 80%) 유지, 신규 파일은 line · function 100%.
- [ ] 변경 파일 2 개 · diff ≤ 300 LOC 유지 (초과 예상 시 헤더 주석을 줄이고 spec 의 중복 케이스를 병합한다 — 파일 추가 분할 금지).

## Out of Scope

- **`CollectionTargetService` 신설 0** — `P2002`→`ConflictException` / `P2025`→`NotFoundException` 변환과 credential 미노출 응답 매핑은 다음 slice(ADR-0059 `§Follow-ups (b)` 후반부).
- **DTO · controller · `@Roles` 배선 0** — `§Follow-ups (c)`.
- **module 배선 0** — `assessment-collection.module.ts` 의 `providers` / `exports` 는 건드리지 않는다 (controller 가 생기는 (c) slice 에서 함께 등록). `assessment-collection.module.spec.ts` 도 무변경.
- **`prisma/schema.prisma` · migration 변경 0** — T-1808 이 박은 것을 읽기만 한다.
- **수집 파이프라인 변경 0** — `collection-entry.service.ts` · `resolveGithubInstances` / `resolveConfluenceInstances` 무변경. env ↔ DB union 병합(`§Decision 3`) 은 `§Follow-ups (g)`.
- **e2e / smoke spec 추가 0** — 오류 계약 HTTP 고정은 `§Follow-ups (d)`.
- **web 변경 0** — AdminView 패널은 `§Follow-ups (e)`.
- **doc-sync 0** — `docs/architecture/api.md` · `docs/architecture/data-model.md` · `docs/requirements.md` REQ status · PLAN `130 행` 마커는 `§Follow-ups (f)`. 본 task 는 어떤 완료 표기도 하지 않는다.
- **새 dependency 0** — `package.json` 무변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 결과 (2026-08-30 완료)

- **DONE** — `commitMode: pr`, PR [#1421](https://github.com/myungjoo/Assessment-Agent/pull/1421) → main `28435491`. 2 파일 `+296/-0`.
- `src/assessment-collection/collection-target.repository.ts` — `PrismaService` 단독 주입 + `collectionTarget` delegate 1:1 forwarding CRUD 5 종. `PartRepository` shape mirror. 자격증명 계열 필드 0 · `try/catch` 0 (Prisma error 는 raw propagate — `P2002`→409 · `P2025`→404 변환은 다음 service slice 소관, ADR-0059 `§Decision 5`).
- colocated spec 16 case 로 R-112 4 종 cover (happy 5 · error path 3 · 분기 4 · negative 4). 신규 파일 line/function/branch 100%, 전체 459 suite / 13259 test green, 전역 threshold(line·function ≥ 80%) 유지.
- 4-게이트 전부 충족 — reviewer `APPROVE` PR comment 외화(`#issuecomment-5470007742`) + integrator self-check + CI green(기본 검사 · 배포 산출물 검증 2 job pass) 후 squash merge.
- Out of Scope 는 전부 무변경 유지 — service 변환층 · module 배선 · controller · DTO · e2e/smoke · web · doc-sync 는 ADR-0059 `§Follow-ups (b) 후반부`~`(f)` 로 이월.
