---
id: T-0113
title: SummaryRepository 추가 (Summary entity CRUD primitive + raw 미저장 invariant 검증)
phase: P3
status: DONE
commitMode: pr
dependsOn: [T-0110, T-0111, T-0112]
coversReq: [REQ-029, REQ-032, REQ-034, REQ-035, REQ-038]
hqOrigin: null
estimatedDiff: 510
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 4-카테고리 backbone (repository + colocated spec 4 layer + module wiring) × 1.5 = ~255 LOC base. T-0111/T-0112 1:1 mirror precedent 의 actual ~500 LOC (systematic +195% over) — service/controller-with-R-112-spec backbone 자연 cap-bend, planner pre-justified."
created: 2026-05-31
plannerNote: "P3 ~99.4% — ADR-0006 후속 chain 의 Summary slice (Person N:1, 일/주/월 요약, raw 본문 컬럼 0). ContributionRepository T-0112 1:1 mirror, pr-mode, §5 미발동."
suggestedAgents: implementer → tester
---

# T-0113 — SummaryRepository 추가 (Summary entity CRUD primitive + raw 미저장 invariant 검증)

## Why

직전 머지 T-0112 (PR-113, 1d093f7) 이 `ContributionRepository` 를 박제해 **Assessment / Contribution data-access layer 는 존재하나 Summary 의 data-access layer 가 0** 인 상태다. [ADR-0006 Decision §3](../decisions/ADR-0006-assessment-data-model.md) 가 박제한 **Summary entity (Person N:1, 일·주·월 단위 요약 평가문, LLM 정성 평가 narrative + 정규화 metricScore, raw 본문 0)** 의 repository slice 를 박제한다. 이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장 — narrative 는 LLM 생성 결과물로 raw 아님) / REQ-034 (일·주·월 요약 평가) / REQ-035 (시간 기반 요약 단위 분리) / REQ-038 (시계열 조회) 의 data-access backbone 이다. 직전 T-0112 의 `ContributionRepository` 패턴을 1:1 mirror — Summary 의 immutable lifecycle (create / read / hard delete, update 없음 — ADR-0006 §3 `updatedAt` 미정의, 재계산 = hard delete 후 재생성) 에 맞춘 CRUD primitive 를 노출한다. ADR-0006 chain 의 본 slice 머지로 Assessment / Contribution / Summary 3 entity 의 repository-layer fully closed → 후속 AssessmentService / ContributionService / SummaryService backbone 진입 prerequisite 완성.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §3 (Summary 7 컬럼) / §4 (raw 미저장 R-59 schema-level 강제 — narrative 는 LLM 결과물로 raw 아님 명시) / §6 (cascade + hard delete). 본 repository 의 메서드 시그니처·invariant source.
- `prisma/schema.prisma` (L275–299) — 머지된 `Summary` model 의 정확한 컬럼·type·`@@index([personId, period, periodStart])`·`onDelete: Cascade` (Person.id 참조). raw 본문 컬럼 0, `@@unique` 없음 (재계산 시 동일 (personId, period, periodStart) 다중 row 일시 공존 허용).
- `src/user/contribution.repository.ts` — **mirror 대상 패턴 (T-0112, 가장 최근 1:1 precedent)**: PrismaService delegate 1:1 forwarding, `ContributionCreateInput` interface 의 raw 컬럼 부재 type-guard, findById 의 null 반환, create 의 Prisma error propagate, findByAssessment 의 빈 배열 반환 + orderBy 정책, delete 의 P2025 propagate. 본 task 는 동 패턴을 Summary 에 mirror — `findByAssessment(assessmentId)` 자리는 `findByPerson(personId, options?)` 로 (Summary 는 Person N:1, Assessment N:1 아님 — AssessmentRepository.findByPerson 의 옵션 패턴 mirror).
- `src/user/contribution.repository.spec.ts` — colocated spec 의 R-112 4 카테고리 + Jest mock factory (`buildPrismaMock`) + fixture builder 패턴 mirror 대상. 단 Summary 는 Person N:1 이므로 fixture 의 FK 컬럼이 `personId` (Contribution 의 `assessmentId` 자리).
- `src/user/assessment.repository.ts` — `findByPerson(personId, options?)` 의 시계열 조회 + `options.period?` 분기 + `orderBy: { periodStart: "desc" }` 패턴. 본 task 의 `findByPerson` 이 동 시그니처 1:1 mirror (Summary 도 period × periodStart 시계열 index 보유, `@@index` 정합).
- `src/user/user.module.ts` (43-94 라인 부근) — `AssessmentRepository` / `ContributionRepository` providers/exports 등록 패턴 mirror 대상.
- `src/persistence/prisma.service.ts` — PrismaService 가 노출하는 delegate (본 repository 가 `prisma.summary` 사용).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 3 개 (repo / colocated spec / module wiring, + user.module.spec.ts 동기 갱신 시 4 개):

- [ ] `src/user/summary.repository.ts` 신설 — `@Injectable()` `SummaryRepository` 가 `PrismaService` 를 생성자 주입받아 `prisma.summary` delegate 에 forwarding 하는 CRUD primitive 를 노출. Summary 는 immutable (ADR-0006 §3 — `updatedAt` 미정의, 재계산 = hard delete 후 재생성) 이므로 다음 메서드만 박제:
  - `create(input: SummaryCreateInput): Promise<Summary>` — `personId / period / periodStart / narrative / metricScore` 5 키만 받아 `prisma.summary.create`. `personId` FK 위반 (Person row 부재) 시 Prisma `P2003` 를 catch 없이 propagate (호출자 = 후속 SummaryService 책임 — ContributionRepository.create 정책 mirror).
  - `findById(id: string): Promise<Summary | null>` — `findUnique`, row 부재 시 null 반환 (throw 안 함, ContributionRepository.findById mirror).
  - `findByPerson(personId: string, options?: SummaryFindByPersonOptions): Promise<Summary[]>` — REQ-038 시계열 조회. `@@index([personId, period, periodStart])` 정합. `options.period?` 가 주어지면 `where: { personId, period }`, 아니면 `where: { personId }` 의 분기 (AssessmentRepository.findByPerson 패턴 1:1 mirror). 정렬은 `orderBy: { periodStart: "desc" }` (시계열 최신순, AssessmentRepository 정합). 매칭 row 0 시 빈 배열 `[]` 반환 (null 아님).
  - `delete(id: string): Promise<void>` — hard delete (REQ-041 Admin 개별 manual delete + 재계산 lifecycle, ADR-0006 §3 / §6). row 부재 시 Prisma `P2025` propagate. **본 메서드는 Admin 의 개별 row 수동 삭제 + 재계산 경로 cover** — Person 전체 hard delete 시는 schema `onDelete: Cascade` (schema.prisma L295) 가 별도 책임 (본 repository 우회).
  - input shape interface (`SummaryCreateInput`, `SummaryFindByPersonOptions`) 를 export 하여 후속 service layer 가 직접 import 가능하게 한다 (AssessmentRepository / ContributionRepository 의 input shape export 패턴 mirror).
  - **type-level raw guard 의무**: `SummaryCreateInput` interface 가 ADR-0006 §3 의 허용 5 컬럼 (`personId / period / periodStart / narrative / metricScore`) 만 포함 — raw 본문 키 (`commitBody / diff / documentBody / rawBody / content / rawQuote` 등) 가 type 차원에서 reject 되도록. 주석으로 R-59 강제 의도 + `narrative` 가 LLM 정성 결과물 (raw 아님) 임을 명시 (ContributionRepository 의 `ContributionCreateInput` 주석 1:1 mirror + Summary 의 narrative 의미 추가 주석).
- [ ] `src/user/summary.repository.spec.ts` (colocated) 신설 — R-112 4 카테고리 전부:
  - [ ] **Happy-path**: `create` / `findById` / `findByPerson` / `delete` 각각이 올바른 `prisma.summary` delegate 메서드를 올바른 인자로 호출하고 return 값을 그대로 propagate 하는지 1+ test (call-shape contract). PrismaService 의 `summary` delegate 를 Jest mock 으로 대체 (DB 실연결 0 — contribution.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror).
  - [ ] **Error path**: `create` 가 `P2003` (FK violation — `personId` 부재) 를 catch 없이 그대로 throw 하는지, `delete` 가 `P2025` (row 부재) 를 그대로 throw 하는지 각 1+ test.
  - [ ] **Flow / branch**: `findByPerson` 의 `options.period` 분기 (period 지정 vs 미지정) 각 1+ test — `where` 절 shape 가 분기별로 정확한지 검증 (AssessmentRepository.findByPerson 의 분기 패턴 1:1 mirror). `findById` 의 null 반환 분기 vs 정상 row 반환 분기 각 1+ test. `orderBy: { periodStart: "desc" }` 가 항상 포함되는지 검증.
  - [ ] **Negative cases 충분 cover** (예외 분기마다): (a) `findById` 의 row 부재 → null 반환, (b) `findByPerson` 의 매칭 row 0 → 빈 배열 `[]` (null 아님), (c) `create` 의 `P2003` FK violation propagate, (d) `delete` 의 `P2025` propagate, (e) `findByPerson` 이 다른 personId 의 row 를 누출하지 않음 검증 (where 절 shape 가 정확히 `{ personId }` 또는 `{ personId, period }` 인지 mock call assertion). 단일 negative 금지 — 위 5 예외 상황 각각.
  - [ ] **raw 미저장 (R-59) invariant 검증**: `create` 에 전달되는 `data` 객체에 raw 본문 컬럼 (`commitBody / diff / documentBody / rawBody / content / rawQuote` 등) 이 포함되지 않음을 검증하는 test 1+. `SummaryCreateInput` 의 키 집합이 ADR-0006 §3 의 허용 5 종으로 한정됨을 assert (schema-level 강제의 runtime guard). `narrative` 는 LLM 정성 결과물 (raw 본문 인용 아님) 로 명시 — 본 invariant 의 의미가 schema column 차원 강제임을 spec 주석 또는 test description 에 박제.
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 repository 는 forwarding + 단순 분기뿐이라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `SummaryRepository` 를 `providers` 에 등록 + `exports` 에 추가 (후속 SummaryService / AssessmentService 가 inject 가능하도록 — ContributionRepository 등록 패턴 mirror). import 정렬 유지. `user.module.spec.ts` 가 wiring 정합성을 검증한다면 그 spec 도 동기 갱신 (해당 file 의 기존 패턴 따름 — Contribution 시 추가된 wiring test 와 1:1 mirror).
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 repository unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **SummaryService** (P2003 → BadRequestException / P2025 → NotFoundException 의 HTTP exception 변환, 일/주/월 period 값 invariant 검증, periodStart 의 단위 정합 검증 등 도메인 의미) — 별도 후속 task (Follow-ups).
- **SummaryController + DTO + endpoint** — 별도 후속 task. 본 task 는 controller/DTO 층 손대지 않음.
- **AssessmentService / ContributionService / AssessmentController** — ADR-0006 chain 의 별도 task. Summary 와 독립.
- **Group/Part aggregate Summary** — ADR-0006 Alternatives (c) defer 으로 view-time 계산으로 시작, 본 task scope 외 (P5+ 책임).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **`@db.Decimal(p,s)` precision/scale 결정 / `@@index` 추가 / cross-cutting timezone 정책** — ADR-0006 가 후속 schema task 로 defer.
- **`period` 의 enum-as-String 값 invariant 검증** (`"daily"` / `"weekly"` / `"monthly"` literal 차단) — ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제. repository 는 값을 그대로 forward.
- **`narrative` 의 LLM raw quote 미포함 검증** — ADR-0006 §Consequences 음의 3 가 P5 LLM prompt 설계 책임으로 박제. 본 task 는 schema column 차원 raw 미저장만 cover (`narrative` 값 자체의 내용 검증 0).
- **`periodStart` 의 단위 정합 검증** (일 = 자정 / 주 = 월요일 자정 / 월 = 1일 자정 등) — service-layer 책임.
- **재계산 (REQ-037 재평가 lifecycle) 의 application logic** — `delete` 후 `create` 의 sequencing 은 SummaryService / 재평가 orchestrator 책임. 본 task 는 primitive 만.
- `update` / `softDelete` / `restore` 메서드 — Summary 는 immutable (ADR-0006 §3), 박제하지 않는다.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 schema/컬럼/invariant 결정을 박제했고, ContributionRepository (T-0112) / AssessmentRepository (T-0111) 가 mirror 패턴을 1:1 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
