---
id: T-0112
title: ContributionRepository 추가 (Contribution entity CRUD primitive + raw 미저장 invariant 검증)
phase: P3
status: DONE
commitMode: pr
dependsOn: [T-0110, T-0111]
coversReq: [REQ-029, REQ-032, REQ-033]
hqOrigin: null
estimatedDiff: 170
estimatedFiles: 3
actualDiff: 502
actualFiles: 4
created: 2026-05-31
completedAt: 2026-05-31T07:25:00+09:00
prNumber: 113
mergeSha: 1d093f7
reviewRounds: 1
plannerNote: "P3 ~99.2% — ADR-0006 후속 chain 의 Contribution slice (Assessment N:1 참조 식별자, raw 본문 컬럼 0). AssessmentRepository T-0111 1:1 mirror, pr-mode, §5 미발동."
result: "PR-113 round 1 single-shot 머지 1d093f7. ContributionRepository (4 메서드 + 7 키 input shape) + colocated spec (336 LOC, R-112 4 카테고리 + R-59 dual-guard) + UserModule wiring. 808/808 test pass, coverage line/function/branch/statement 100%. reviewer APPROVE findings 0. CI first-run reviewer-gate race (T-0048 19 회차) 재현 + empty commit synchronize self-heal (T-0111 패턴 1:1 mirror)."
suggestedAgents: implementer → tester
---

# T-0112 — ContributionRepository 추가 (Contribution entity CRUD primitive + raw 미저장 invariant 검증)

## Why

직전 머지 T-0111 (PR-111, b346d31) 이 `AssessmentRepository` 를 박제해 **Assessment data-access layer 는 존재하나 Contribution / Summary 의 data-access layer 가 0** 인 상태다. [ADR-0006 Decision §2](../decisions/ADR-0006-assessment-data-model.md) 가 박제한 **Contribution entity (Assessment N:1, 개별 commit / PR / 문서 단위, 참조 식별자만 보유 raw 본문 0)** 의 repository slice 를 박제한다. 이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장 — 본 entity 가 R-59 의 schema-level 강제 핵심 — 참조 식별자 `sourceUrl` + `sourceRef` 만으로 외부 본문 재수집 backbone) / REQ-033 (commit·문서 별 기여도·난이도·양 보유) 의 data-access backbone 이다. 직전 T-0111 의 `AssessmentRepository` 패턴을 1:1 mirror — Contribution 의 immutable lifecycle (create / read / hard delete, update 없음 — ADR-0006 §2 `updatedAt` 미정의) 에 맞춘 CRUD primitive 를 노출한다. Contribution 의 hard delete 는 Assessment 의 `onDelete: Cascade` (schema.prisma L272) 가 동반 수행 책임이지만, Admin 의 개별 row 수동 삭제 (REQ-041) 경로도 본 repository 의 `delete` 로 cover.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §2 (Contribution 8 컬럼) / §4 (raw 미저장 R-59 schema-level 강제 — 참조 식별자 정책) / §6 (cascade + hard delete). 본 repository 의 메서드 시그니처·invariant source.
- `prisma/schema.prisma` (L259–273) — 머지된 `Contribution` model 의 정확한 컬럼·type·`onDelete: Cascade`. raw 본문 컬럼 0, `@@unique` 없음 (단일 commit/PR 이 여러 Assessment 에 등장 가능 — REQ-031 재수집 정합), index 없음.
- `src/user/assessment.repository.ts` — **mirror 대상 패턴 (T-0111)**: PrismaService delegate 1:1 forwarding, `AssessmentCreateInput` interface 의 raw 컬럼 부재 type-guard, findById 의 null 반환, create 의 P2002 propagate, delete 의 P2025 propagate. 본 task 는 동 패턴을 Contribution 에 mirror.
- `src/user/assessment.repository.spec.ts` — colocated spec 의 R-112 4 카테고리 + Jest mock factory (`buildPrismaMock`) + fixture builder 패턴 mirror 대상.
- `src/user/user.module.ts` (43-94 라인 부근) — `AssessmentRepository` providers/exports 등록 패턴 mirror 대상.
- `src/persistence/prisma.service.ts` — PrismaService 가 노출하는 delegate (본 repository 가 `prisma.contribution` 사용).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 3 개 (repo / colocated spec / module wiring):

- [ ] `src/user/contribution.repository.ts` 신설 — `@Injectable()` `ContributionRepository` 가 `PrismaService` 를 생성자 주입받아 `prisma.contribution` delegate 에 forwarding 하는 CRUD primitive 를 노출. Contribution 은 immutable (ADR-0006 §2 — `updatedAt` 미정의) 이므로 다음 메서드만 박제:
  - `create(input: ContributionCreateInput): Promise<Contribution>` — `assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume` 7 키만 받아 `prisma.contribution.create`. `assessmentId` FK 위반 (Assessment row 부재) 시 Prisma `P2003` 를 catch 없이 propagate (호출자 = 후속 ContributionService 책임 — AssessmentRepository.create 정책 mirror).
  - `findById(id: string): Promise<Contribution | null>` — `findUnique`, row 부재 시 null 반환 (throw 안 함, AssessmentRepository.findById mirror).
  - `findByAssessment(assessmentId: string): Promise<Contribution[]>` — 특정 Assessment 의 component Contribution 전체 조회 (REQ-033 commit·문서별 보유 데이터의 aggregate-level fan-out). 정렬은 `orderBy: { createdAt: "asc" }` (수집 순서 보존, 시간축 자연 순서). 매칭 row 0 시 빈 배열 `[]` 반환 (null 아님).
  - `delete(id: string): Promise<void>` — hard delete (REQ-041 Admin 개별 manual delete, ADR-0006 §6). row 부재 시 Prisma `P2025` propagate. **본 메서드는 Admin 의 개별 row 수동 삭제 경로 cover** — Assessment 전체 hard delete 시는 schema `onDelete: Cascade` 가 별도 책임 (본 repository 우회).
  - input shape interface (`ContributionCreateInput`) 를 export 하여 후속 service layer 가 직접 import 가능하게 한다 (AssessmentRepository 의 `AssessmentCreateInput` 패턴 mirror).
  - **type-level raw guard 의무**: `ContributionCreateInput` interface 가 ADR-0006 §2 의 허용 7 컬럼 (`assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume`) 만 포함 — raw 본문 키 (`commitBody / diff / documentBody / rawBody / content` 등) 가 type 차원에서 reject 되도록. 주석으로 R-59 강제 의도 명시 (AssessmentRepository 의 `AssessmentCreateInput` 주석 1:1 mirror).
- [ ] `src/user/contribution.repository.spec.ts` (colocated) 신설 — R-112 4 카테고리 전부:
  - [ ] **Happy-path**: `create` / `findById` / `findByAssessment` / `delete` 각각이 올바른 `prisma.contribution` delegate 메서드를 올바른 인자로 호출하고 return 값을 그대로 propagate 하는지 1+ test (call-shape contract). PrismaService 의 `contribution` delegate 를 Jest mock 으로 대체 (DB 실연결 0 — assessment.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror).
  - [ ] **Error path**: `create` 가 `P2003` (FK violation — `assessmentId` 부재) 를 catch 없이 그대로 throw 하는지, `delete` 가 `P2025` (row 부재) 를 그대로 throw 하는지 각 1+ test.
  - [ ] **Flow / branch**: 본 repository 의 분기는 단순 (find* 의 row 부재 분기뿐) — `findById` 의 null 반환 분기 vs 정상 row 반환 분기 각 1+ test, `findByAssessment` 의 빈 배열 vs 매칭 row 다수 (≥2) 시나리오 각 1+ test. `orderBy: { createdAt: "asc" }` 가 항상 포함되는지 검증.
  - [ ] **Negative cases 충분 cover** (예외 분기마다): (a) `findById` 의 row 부재 → null 반환, (b) `findByAssessment` 의 매칭 row 0 → 빈 배열 `[]` (null 아님), (c) `create` 의 `P2003` FK violation propagate, (d) `delete` 의 `P2025` propagate, (e) `findByAssessment` 가 다른 assessmentId 의 row 를 누출하지 않음 검증 (where 절 shape 가 정확히 `{ assessmentId }` 인지 mock call assertion). 단일 negative 금지 — 위 5 예외 상황 각각.
  - [ ] **raw 미저장 (R-59) invariant 검증**: `create` 에 전달되는 `data` 객체에 raw 본문 컬럼 (`commitBody / diff / documentBody / rawBody / content` 등) 이 포함되지 않음을 검증하는 test 1+. `ContributionCreateInput` 의 키 집합이 ADR-0006 §2 의 허용 7 종으로 한정됨을 assert (schema-level 강제의 runtime guard). `sourceUrl` + `sourceRef` 는 참조 식별자 (pointer) 일 뿐 본문 자체가 아님 — raw 아님으로 명시.
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 repository 는 forwarding + 단순 분기뿐이라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `ContributionRepository` 를 `providers` 에 등록 + `exports` 에 추가 (후속 ContributionService / AssessmentService 가 inject 가능하도록 — AssessmentRepository 등록 패턴 mirror). import 정렬 유지. user.module.spec.ts 가 wiring 정합성을 검증한다면 그 spec 도 동기 갱신 (해당 file 의 기존 패턴 따름).
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 repository unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **ContributionService** (P2003 → BadRequestException / P2025 → NotFoundException 의 HTTP exception 변환, 도메인 의미 검증) — 별도 후속 task (Follow-ups).
- **ContributionController + DTO + endpoint** — 별도 후속 task. 본 task 는 controller/DTO 층 손대지 않음.
- **SummaryRepository** — 별도 slice (Follow-ups). 본 task 는 Contribution entity 의 repository 1 개만.
- **AssessmentService / AssessmentController** — ADR-0006 chain 의 별도 task. Contribution 과 독립.
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **`@db.Decimal(p,s)` precision/scale 결정 / `@@index` 추가 / cross-cutting timezone 정책** — ADR-0006 가 후속 schema task 로 defer.
- **`sourceType` 의 enum-as-String 값 invariant 검증** (`"commit"` / `"pr"` / `"document"` literal 차단) — ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제. repository 는 값을 그대로 forward.
- **`sourceUrl` / `sourceRef` 의 형식 검증** (URL schema, SHA 길이 등) — service-layer 책임.
- `update` / `softDelete` / `restore` 메서드 — Contribution 은 immutable (ADR-0006 §2), 박제하지 않는다.
- **재수집 (REQ-031) 의 application logic** — Contribution 의 `sourceUrl` + `sourceRef` 로 외부 본문 재수집은 별도 P5 evaluation pipeline 책임. 본 task 는 참조 식별자의 영속 layer 만 박제.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 가 모든 schema/컬럼/invariant 결정을 박제했고, AssessmentRepository (T-0111) 가 mirror 패턴을 1:1 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
