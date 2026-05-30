---
id: T-0111
title: AssessmentRepository 추가 (Assessment entity CRUD primitive + raw 미저장 invariant 검증)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036, REQ-038]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-05-31
completedAt: 2026-05-31T04:25:00+09:00
prNumber: 111
mergedAs: b346d31
reviewRounds: 1
plannerNote: "P3 ~99% — ADR-0006 구현 chain 의 T-0111 candidate. 머지된 Assessment schema 위 data-access layer (repository slice). pr-mode, §5 미발동(schema/migration 0)."
---

# T-0111 — AssessmentRepository 추가 (Assessment entity CRUD primitive + raw 미저장 invariant 검증)

## Why

직전 머지 T-0110 (PR-109, e076c92) 이 `prisma/schema.prisma` 에 Assessment / Contribution / Summary 3 model + migration 을 박제해 **DB schema 는 존재하나 runtime data-access / service / controller layer 가 0** 인 상태다. [ADR-0006 "후속 구현 task chain" 표](../decisions/ADR-0006-assessment-data-model.md) 가 명시한 **T-0111 candidate = AssessmentService / repository** 의 첫 slice 로 **AssessmentRepository** 를 박제한다. 이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장) / REQ-033 (commit·문서 별 기여도·난이도·양) / REQ-036 (상대 비교 정규화 수치) / REQ-038 (시계열 조회) 의 data-access backbone 이다. 기존 `PersonRepository` (T-0034) 의 PrismaService delegate forwarding 패턴을 1:1 mirror — Assessment 의 immutable lifecycle (create / read / hard delete, update 없음) 에 맞춘 CRUD primitive 를 노출한다.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §1 (Assessment 컬럼) / §4 (raw 미저장 R-59 schema-level 강제) / §5 (REQ-036 정규화 수치) / §6 (`@@unique([personId, period, scope, periodStart])` + `@@index([personId, period, periodStart])` + cascade + hard delete). 본 repository 의 메서드 시그니처·invariant source.
- `prisma/schema.prisma` (L206–247) — 머지된 `Assessment` model 의 정확한 컬럼·type·`@@unique`·`@@index`·`onDelete: Cascade`. raw 본문 컬럼이 0 임을 확인 (column 부재 = R-59 강제).
- `src/user/person.repository.ts` — mirror 대상 패턴 (PrismaService delegate 1:1 forwarding, `PersonCreateInput` interface, findById 의 null 반환, create 의 P2002 propagate 정책). 단 Assessment 는 immutable 이라 update/softDelete/restore 는 박제하지 않음.
- `src/user/person.repository.spec.ts` (전체) — colocated spec 의 R-112 4 카테고리 패턴 + Jest mock factory (`buildPrismaMock`) + fixture builder (`buildPersonFixture`) 패턴 mirror 대상.
- `src/persistence/prisma.service.ts` — PrismaService 가 노출하는 delegate (본 repository 가 `prisma.assessment` 사용).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 2 개 (+ 필요 시 mock helper 1):

- [ ] `src/user/assessment.repository.ts` 신설 — `@Injectable()` `AssessmentRepository` 가 `PrismaService` 를 생성자 주입받아 `prisma.assessment` delegate 에 forwarding 하는 CRUD primitive 를 노출한다. Assessment 는 immutable (ADR-0006 §1 — `updatedAt` 미정의, 재평가는 hard delete 후 재생성) 이므로 다음 메서드만 박제:
  - `create(input: AssessmentCreateInput): Promise<Assessment>` — `personId / period / scope / periodStart / difficulty / contributionScore / volume / narrative` 를 받아 `prisma.assessment.create`. `@@unique` 위반 시 Prisma `P2002` 를 catch 없이 그대로 propagate (호출자 = 후속 AssessmentService 책임 — PersonRepository.create 정책 mirror).
  - `findById(id: string): Promise<Assessment | null>` — `findUnique`, row 부재 시 null 반환 (throw 안 함).
  - `findByPerson(personId, options?): Promise<Assessment[]>` — REQ-038 시계열 조회. `@@index([personId, period, periodStart])` 정합. `options.period?` 가 주어지면 `where: { personId, period }`, 아니면 `where: { personId }` 의 분기. 정렬은 `orderBy: { periodStart: "desc" }` (시계열 최신순).
  - `delete(id: string): Promise<void>` — hard delete (REQ-041 / REQ-037 lifecycle, ADR-0006 §6). row 부재 시 Prisma `P2025` propagate. Assessment 삭제 시 component Contribution 은 schema 의 `onDelete: Cascade` (schema.prisma L272) 가 동반 삭제 책임.
  - input shape interface (`AssessmentCreateInput`, `AssessmentFindByPersonOptions`) 를 export 하여 후속 service layer 가 직접 import 가능하게 한다 (PersonRepository 의 `PersonCreateInput` 패턴 mirror).
- [ ] `src/user/assessment.repository.spec.ts` (colocated) 신설 — R-112 4 카테고리 전부:
  - [ ] **Happy-path**: `create` / `findById` / `findByPerson` / `delete` 각각이 올바른 `prisma.assessment` delegate 메서드를 올바른 인자로 호출하고 return 값을 그대로 propagate 하는지 1+ test (call-shape contract). PrismaService 의 `assessment` delegate 를 Jest mock 으로 대체 (DB 실연결 0 — person.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror).
  - [ ] **Error path**: `create` 가 `P2002` (unique constraint 위반) 를 catch 없이 그대로 throw 하는지, `delete` 가 `P2025` (row 부재) 를 그대로 throw 하는지 각 1+ test.
  - [ ] **Flow / branch**: `findByPerson` 의 `options.period` 분기 (period 지정 vs 미지정) 각 1+ test — `where` 절 shape 가 분기별로 정확한지 검증. `orderBy: { periodStart: "desc" }` 가 항상 포함되는지 검증.
  - [ ] **Negative cases 충분 cover** (예외 분기마다): (a) `findById` 의 row 부재 → null 반환 검증, (b) `findByPerson` 의 매칭 row 0 → 빈 배열 `[]` 반환 검증 (null 아님), (c) `create` 의 `P2002` propagate (위 error path 와 별개로 unique 축 중복 시나리오), (d) `delete` 의 `P2025` propagate. 단일 negative 금지 — 위 4 예외 상황 각각.
  - [ ] **raw 미저장 (R-59) invariant 검증**: `create` 에 전달되는 `data` 객체에 raw 본문 컬럼 (commit body / diff / 문서 본문 / `rawBody` / `content` 등) 이 포함되지 않음을 검증하는 test 1+ (전달 키 집합이 ADR-0006 §1 의 허용 컬럼 9 종으로 한정됨을 assert — schema-level 강제의 runtime guard).
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 repository 는 forwarding + 단순 분기뿐이라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `AssessmentRepository` 를 `providers` 에 등록 + `exports` 에 추가 (후속 AssessmentService / Summary repo 가 inject 가능하도록 — PersonRepository 등록 패턴 mirror). import 정렬 유지.
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 repository unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **AssessmentService** (P2002 → ConflictException / P2025 → NotFoundException 의 HTTP exception 변환, REQ-027 NewPersonEvent 등 도메인 의미) — 별도 후속 task (Follow-ups, ADR-0006 T-0111 candidate 의 service half).
- **AssessmentController + DTO + endpoint** — ADR-0006 T-0112 candidate, 별도 후속 task.
- **ContributionRepository / SummaryRepository** — 각 별도 slice (Follow-ups). 본 task 는 Assessment entity 의 repository 1 개만.
- **`@db.Decimal(p,s)` precision/scale 결정 / 추가 `@@index` 조정 / cross-cutting timezone 정책** — ADR-0006 가 후속 schema task 로 defer. 본 task 는 schema 변경 0 (이미 머지된 schema 를 read-only 로 사용).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **period / scope / difficulty 의 enum-as-String 값 invariant 검증** (잘못된 literal 차단) — ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제. repository 는 값을 그대로 forward.
- `update` / `softDelete` / `restore` 메서드 — Assessment 는 immutable (ADR-0006 §1), 박제하지 않는다.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 schema/컬럼/invariant 결정을 박제했고, PersonRepository 가 mirror 패턴을 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
