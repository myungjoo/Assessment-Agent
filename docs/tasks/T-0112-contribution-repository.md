---
id: T-0112
title: ContributionRepository 추가 (Contribution entity CRUD primitive + raw 미저장 invariant 검증)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-05-31
dependsOn: [T-0110, T-0111]
plannerNote: "P3 ~99% — ADR-0006 chain T-0111 직후 자연 next slice (Contribution repo). T-0111 AssessmentRepository 1:1 mirror, pr-mode."
---

# T-0112 — ContributionRepository 추가 (Contribution entity CRUD primitive + raw 미저장 invariant 검증)

## Why

직전 머지 T-0111 (PR-111, b346d31) 이 `src/user/assessment.repository.ts` 를 박제해 **Assessment entity 의 data-access layer 가 존재**한다. 다음 자연 slice 는 **ContributionRepository** — [ADR-0006](../decisions/ADR-0006-assessment-data-model.md) Decision §2 가 박제한 Contribution entity (Assessment N:1 의 개별 기여 단위 — 단일 commit / 단일 PR / 단일 문서 변경) 의 CRUD primitive 다. Contribution 은 평가 결과의 component 로, [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장 schema-level 강제) / REQ-033 (commit·문서 별 기여도·난이도·양) / REQ-036 (상대 비교 정규화 수치) 의 data-access backbone 이다.

**T-0111 (AssessmentRepository) 패턴을 1:1 mirror** — PrismaService 의 `contribution` delegate 에 1:1 forwarding 하는 얇은 wrapper. Contribution 도 Assessment 처럼 **immutable** (ADR-0006 §2 — `updatedAt` 미정의) 이라 lifecycle 은 create → read → hard delete 의 3 phase 만. 단 Contribution 은 Assessment N:1 관계라 reverse query 메서드 (`findByAssessment`) 가 핵심 (PersonRepository 의 `findByPartId` / `findByGroupId` 패턴 mirror). Assessment 삭제 시 schema 의 `onDelete: Cascade` (schema.prisma L272) 가 동반 삭제 책임 — 본 repository 는 그 cascade 를 신뢰하고 별도 cascade 처리를 하지 않는다.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §2 (Contribution 컬럼 9 종: id / assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume / createdAt) / §4 (raw 미저장 R-59 schema-level 강제 — `sourceUrl` + `sourceRef` 는 참조 식별자만, raw 본문 아님) / §5 (REQ-036 정규화 `Decimal`) / §6 (`onDelete: Cascade` from Assessment, hard delete lifecycle).
- `prisma/schema.prisma` (L249–273) — 머지된 `Contribution` model 의 정확한 컬럼·type·`onDelete: Cascade`. raw 본문 컬럼 0 임을 확인 (column 부재 = R-59 schema-level 강제).
- `src/user/assessment.repository.ts` — **1:1 mirror 대상** (T-0111, b346d31). 본 task 의 패턴 source: PrismaService delegate forwarding / immutable lifecycle (create / findById / findBy<parent> / delete 4 메서드) / `AssessmentCreateInput` interface / `AssessmentFindByPersonOptions` interface / P2002 propagate 정책 / P2025 propagate 정책 / null-safe findById / 빈 배열 findByPerson.
- `src/user/assessment.repository.spec.ts` — colocated spec 의 R-112 4 카테고리 패턴 + Jest mock factory (`buildPrismaMock`) + fixture builder + raw-noretain runtime guard test 패턴. 본 task 의 spec 은 이를 Contribution 으로 1:1 translate.
- `src/persistence/prisma.service.ts` — PrismaService 가 노출하는 delegate (본 repository 가 `prisma.contribution` 사용).
- `src/user/user.module.ts` — `providers` / `exports` 등록 패턴 (T-0111 의 `AssessmentRepository` 등록 라인 mirror).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 3 개:

- [ ] `src/user/contribution.repository.ts` 신설 — `@Injectable()` `ContributionRepository` 가 `PrismaService` 를 생성자 주입받아 `prisma.contribution` delegate 에 forwarding 하는 CRUD primitive 를 노출한다. Contribution 은 immutable (ADR-0006 §2 — `updatedAt` 미정의, 재평가는 Assessment 삭제 → cascade) 이므로 다음 4 메서드만 박제:
  - `create(input: ContributionCreateInput): Promise<Contribution>` — `assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume` 7 키를 받아 `prisma.contribution.create`. assessmentId 의 FK 존재 검증은 본 layer 책임 외 (호출자 = 후속 ContributionService 책임 — PersonRepository.create 의 partId 검증 정책 mirror). FK 위반 시 Prisma 의 외래키 error 가 그대로 propagate.
  - `findById(id: string): Promise<Contribution | null>` — `findUnique`, row 부재 시 null 반환 (throw 안 함). PersonRepository.findById / AssessmentRepository.findById 의 null-safe API 정공법 mirror.
  - `findByAssessment(assessmentId: string): Promise<Contribution[]>` — Assessment N:1 의 reverse query (지정 Assessment 의 모든 component Contribution 조회). `where: { assessmentId }`. 정렬은 `orderBy: { createdAt: "asc" }` (component 가 생성 순서대로 — Assessment 의 aggregate semantic 정합). 매칭 row 0 시 빈 배열 `[]` 반환 (null 아님). assessmentId 자체의 존재 검증 (Assessment row 가 실제 존재하는지) 은 본 layer 책임 외 — 호출자 책임.
  - `delete(id: string): Promise<void>` — hard delete (REQ-041 / REQ-037 lifecycle, ADR-0006 §6). row 부재 시 Prisma `P2025` propagate. Contribution 자체에는 component cascade 없음 (leaf entity).
  - input shape interface (`ContributionCreateInput`) 를 export 하여 후속 service layer 가 직접 import 가능하게 한다 (AssessmentRepository 의 `AssessmentCreateInput` 패턴 mirror).
  - **raw 미저장 (R-59) 정합** — `ContributionCreateInput` 의 키 집합은 ADR-0006 §2 의 허용 7 컬럼만 (`assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume`). raw 본문 키 (commit body / diff / 문서 본문 / `rawBody` / `content` / `patch` / `body` 등) 는 type 차원에서 reject — schema 강제의 type-level guard.
  - `contributionScore` 는 `Prisma.Decimal | number | string` (Prisma Decimal input — AssessmentRepository 와 동일 트래픽).
- [ ] `src/user/contribution.repository.spec.ts` (colocated) 신설 — R-112 4 카테고리 전부:
  - [ ] **Happy-path**: `create` / `findById` / `findByAssessment` / `delete` 각각이 올바른 `prisma.contribution` delegate 메서드를 올바른 인자로 호출하고 return 값을 그대로 propagate 하는지 1+ test (call-shape contract). PrismaService 의 `contribution` delegate 를 Jest mock 으로 대체 (DB 실연결 0 — assessment.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror).
  - [ ] **Error path**: `create` 가 FK 위반 (`P2003` Prisma foreign key constraint failed — assessmentId 가 존재하지 않는 Assessment 를 가리킬 때) 를 catch 없이 그대로 throw 하는지, `delete` 가 `P2025` (row 부재) 를 그대로 throw 하는지 각 1+ test.
  - [ ] **Flow / branch**: `findByAssessment` 의 `where: { assessmentId }` + `orderBy: { createdAt: "asc" }` shape 가 정확한지 검증 (분기 자체는 단일이지만 query shape contract 가 branch 의무). 분기가 적으므로 본 항목은 query shape 검증으로 cover.
  - [ ] **Negative cases 충분 cover** (예외 분기마다): (a) `findById` 의 row 부재 → null 반환 검증, (b) `findByAssessment` 의 매칭 row 0 → 빈 배열 `[]` 반환 검증 (null 아님), (c) `create` 의 FK 위반 `P2003` propagate, (d) `delete` 의 `P2025` propagate. 단일 negative 금지 — 위 4 예외 상황 각각.
  - [ ] **raw 미저장 (R-59) invariant 검증**: `create` 에 전달되는 `data` 객체에 raw 본문 컬럼 (commit body / diff / 문서 본문 / `rawBody` / `content` / `patch` / `body` 등) 이 포함되지 않음을 검증하는 test 1+ (전달 키 집합이 ADR-0006 §2 의 허용 컬럼 7 종으로 한정됨을 assert — schema-level 강제의 runtime guard). AssessmentRepository spec 의 raw-noretain test 와 동일 패턴.
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 repository 는 forwarding + 단순 query 라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `ContributionRepository` 를 `providers` 에 등록 + `exports` 에 추가 (후속 ContributionService / AssessmentService 가 inject 가능하도록 — AssessmentRepository 등록 패턴 mirror, L90~94 + L110~112 직후). import 정렬 유지 (alphabetical — `AssessmentRepository` 다음 `ContributionRepository`).
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 repository unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **ContributionService** (P2002 / P2003 → ConflictException, P2025 → NotFoundException 의 HTTP exception 변환, 도메인 의미 부여) — 별도 후속 task (Follow-ups). 본 task 는 repository slice 만.
- **ContributionController + DTO + endpoint** — 별도 후속 task. ADR-0006 chain 의 T-0113+ candidate.
- **SummaryRepository** — Contribution 과 평행 slice (Follow-ups). 본 task 는 Contribution entity 만.
- **AssessmentService / AssessmentController** — ADR-0006 chain 의 별도 candidate (Follow-ups). 본 task 는 ContributionRepository 만.
- **`@db.Decimal(p,s)` precision/scale 결정 / 추가 `@@index` 조정 / cross-cutting timezone 정책** — ADR-0006 가 후속 schema task 로 defer. 본 task 는 schema 변경 0 (이미 머지된 schema 를 read-only 로 사용).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **sourceType / difficulty 의 enum-as-String 값 invariant 검증** (잘못된 literal 차단) — ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제. repository 는 값을 그대로 forward.
- `update` / `softDelete` / `restore` 메서드 — Contribution 은 immutable (ADR-0006 §2), 박제하지 않는다.
- **AssessmentRepository 변경 0** — T-0111 이 박제한 4 메서드 시그니처 / 본문 / spec 모두 그대로 유지. wiring 갱신만 user.module.ts 에서 동반.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 schema/컬럼/invariant 결정을 박제했고, AssessmentRepository (T-0111) 가 1:1 mirror 패턴을 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append. 예상 후속: SummaryRepository / AssessmentService / ContributionService / AssessmentController.)
