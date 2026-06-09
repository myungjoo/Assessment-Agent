---
id: T-0300
title: EvaluationResult 영속화 write service (reset-and-recreate + fill/reeval 모드 + P2002→ConflictException)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-037, REQ-041, REQ-032]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-06-09
plannerNote: "P5 ADR-0033 §Follow-ups slice 3 (write service) — T-0299 mapper + 기존 repository 재사용, $transaction reset-and-recreate. R-112 backbone ×1.5. dep0/credential0."
---

# T-0300 — EvaluationResult 영속화 write service

## Why

[ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) §Follow-ups 의 **3번째 dependency-free slice** 다. slice 1 (schema+migration, T-0298 DONE) 과 slice 2 (순수 매핑 함수, T-0299 DONE) 이 안착했으므로, 이제 그 매퍼 출력을 **실제 PostgreSQL 에 영속화하는 write service** 를 박제한다. ADR-0033 §3 의 reset-and-recreate semantics (`$transaction` delete-if-exists → nested create), fill/reeval 두 모드 분기, partial-reset (`personId`+`period` prefix delete), 그리고 P2002 → `ConflictException` 도메인 변환을 구현해 REQ-029 (non-volatile 저장) 를 평가 layer 에서 닫는다. orchestrator/controller wiring (slice 4) 은 본 task 범위 밖 — 본 slice 는 service + colocated spec 만.

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — §Decision 1 (매핑 방향) / §Decision 3 (reset-and-recreate + fill/reeval + partial-reset semantics) / §Decision 4 (Contribution unique) / §Consequences (트랜잭션 atomicity risk) / §Follow-ups 3.
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` — 본 service 가 호출하는 매퍼. `mapEvaluationResultsToAssessment(context, results)` → `MappedAssessment { assessment, contributions }`. `EvaluationPersistContext` 4-tuple 타입. `contributions` 는 `assessmentId` 미포함 (`ContributionCreateInputWithoutAssessment`) — service 가 nested create 로 주입.
- `src/user/assessment.repository.ts` — `AssessmentCreateInput` shape (8 키) + P2002 propagation 정책 (호출자 변환 책임). delete cascade 주석.
- `src/user/contribution.repository.ts` — `ContributionCreateInput` (assessmentId FK 포함) shape.
- `src/user/assessment.service.ts` — 기존 P2002 → `ConflictException` 변환 precedent (`getPrismaErrorCode(error) === "P2002"` 패턴). 본 service 가 동일 helper 재사용.
- `src/persistence/prisma.service.ts` — `PrismaService extends PrismaClient` (line 29) → `$transaction` 직접 사용 가능. 본 service 가 트랜잭션 delegate 로 nested create / delete 호출.
- `prisma/schema.prisma` L274–349 — Assessment `@@unique([personId, period, scope, periodStart])` + `onDelete: Cascade` (Person→Assessment, Assessment→Contribution) + Contribution `@@unique([assessmentId, sourceRef])` (T-0298 박제).
- `test/helpers/prisma-mock.ts` — colocated spec 의 PrismaService mock 패턴 (`$transaction` mock 포함 — 트랜잭션 콜백을 즉시 실행하는 stub 으로 검증).

## Acceptance Criteria

신규 service 위치: `src/assessment-evaluation/evaluation-result-persist.service.ts` (NestJS `@Injectable`, `assessment-evaluation` module 소속 — ADR-0033 §Cross-Module Impact 의 "평가 layer 가 persist hook 소유, user repository 재사용"). colocated spec: `src/assessment-evaluation/evaluation-result-persist.service.spec.ts`.

- [ ] `persist(context: EvaluationPersistContext, results: EvaluationResult[], mode: "fill" | "reeval"): Promise<{ assessmentId: string; contributionCount: number }>` (또는 동등 반환) 메서드를 구현. 내부에서 T-0299 매퍼 `mapEvaluationResultsToAssessment` 를 호출해 `MappedAssessment` 를 얻고, `$transaction` 안에서 Assessment(1) + Contribution[](N) 를 nested create (또는 Assessment create 후 contribution create) 한다.
- [ ] **reset-and-recreate (ADR-0033 §3)**: 동일 idempotency key `(personId, period, scope, periodStart)` 의 기존 Assessment 를 `findUnique` 로 확인. `reeval` 모드면 존재 시 `delete` (component Contribution 은 schema `onDelete: Cascade` 동반 삭제) → 새 Assessment+Contribution create. **delete→create 는 단일 `$transaction`** 으로 묶어 부분 실패 시 이전 평가가 유실되지 않도록 한다 (atomicity).
- [ ] **fill 모드 (ADR-0033 §3 "평가 없는 부분만 평가")**: 동일 key 의 Assessment 가 이미 존재하면 no-op (중복 row 0, 기존 보존). 부재면 create. fill 모드 재실행은 idempotent (row 수 불변).
- [ ] **partial-reset 메서드 (ADR-0033 §3)**: `resetByPeriod(personId, period)` (또는 동등) — `delete where { personId, period }` 로 한 person 의 한 period Assessment 만 삭제, 다른 period/scope 는 보존. `@@index([personId, period, periodStart])` leading-edge 정합.
- [ ] **P2002 → ConflictException 변환**: reset-and-recreate 경합 등으로 `@@unique` 위반 P2002 가 발생하면 `assessment.service.ts` 의 `getPrismaErrorCode` precedent 를 재사용해 `ConflictException` (한국어 메시지) 으로 변환.
- [ ] **NIT (a) — `aggregateDifficulty` unknown 값 정책 결정** (T-0299 review NIT): 현 매퍼의 `aggregateDifficulty` 는 알 수 없는 difficulty 를 silent skip (contribution guard 가 throw 하는 것과 비대칭). 본 service 진입 시점 또는 매퍼 호출 전후로 **정책을 명시적으로 결정·구현**한다 — (1) service 가 difficulty 유효성을 검증해 invalid 면 명시적 throw 하거나, (2) 비대칭을 ADR 정합으로 의도적 수용임을 service 주석 + spec 으로 박제. 둘 중 하나를 reviewer 가 catch 가능하도록 명문화. 해당 분기에 negative test 1+.
- [ ] **NIT (b) — Decimal precision/rounding 정책 정의** (T-0299 review NIT): 매퍼의 평균 score 는 float (`scoreSum / length`) 로 `Contribution.contributionScore` / `Assessment.contributionScore` (Prisma `Decimal` 컬럼) 로 흘러간다. 본 service 에서 **Decimal precision/rounding 정책 (예: 소수 N 자리 round, 또는 Prisma Decimal 변환 위임 명시)** 을 결정·구현하고 주석 + spec 으로 박제. 정책 분기에 test 1+.
- [ ] **Happy-path unit test**: `persist` (fill / reeval 각각), `resetByPeriod` 의 정상 경로 — mock PrismaService 로 `$transaction` 콜백이 호출되고 올바른 create/delete 인자가 전달됨을 검증.
- [ ] **Error path unit test**: P2002 발생 시 `ConflictException` 으로 변환됨 / 트랜잭션 내부 실패 시 throw 가 propagate 됨 (이전 데이터 보존 = create 가 호출 안 됨) 각 1+.
- [ ] **Flow / branch coverage**: fill (존재 → no-op / 부재 → create) 두 분기, reeval (존재 → delete+create / 부재 → create) 두 분기, NIT(a)/(b) 정책 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 빈 `results[]` (Assessment 1 + Contribution 0 의 결정적 처리) / 알 수 없는 difficulty (NIT a 정책) / Decimal 경계값 (NIT b) / 트랜잭션 중단 시 이전 데이터 보존 / P2002 외 Prisma error 는 그대로 propagate (잘못 삼키지 않음) — 각 1+ test. 단일 negative 금지.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` 통과. tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과 확인 (R-110).

## Out of Scope

- orchestrator/controller wiring (`evaluateActivities` 결과 반환 직전 persist hook 호출, controller DTO 에 personId/period/scope/periodStart 추가) — ADR-0033 §Follow-ups slice 4 (별도 task).
- `Summary` table write — ADR-0033 §1/§Consequences 에서 명시적으로 본 slice 범위 밖 (aggregate 평가 slice 책임).
- 새 repository 메서드 발명 — 기존 `AssessmentRepository` / `ContributionRepository` primitive (create/findById/findByPerson/delete) 와 PrismaService `$transaction` 만 재사용. (단, transaction wrapper 가 repository 위가 아니라 service 안에서 PrismaService delegate 를 직접 쓰는 형태면 repository 변경 0 — 그쪽을 권장.)
- 매퍼 (`evaluation-result.persist.mapper.ts`) 의 매핑 로직 변경 — NIT(a)/(b) 는 **service layer 에서 정책 결정·검증**으로 처리 (매퍼는 순수 함수로 보존). 매퍼 자체를 고쳐야 한다고 판단되면 Follow-ups 에 적고 본 task 에선 service-layer 처리.
- 새 외부 dependency / 새 ADR / schema 변경 — 전부 불요 (slice 1~2 가 이미 박제).
- `data-model.md` doc-sync — ADR-0033 §Follow-ups slice 5 (별도 direct task).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0033 가 설계를 이미 박제, NIT(a)/(b) 는 service-layer 정책 결정 수준이라 ADR-worthy 아님. 단 NIT(a) 비대칭 수용이 ADR 정합 해석을 요한다고 implementer 가 판단하면 그 판단만 PR body 에 1 줄 명시).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
