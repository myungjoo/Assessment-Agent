---
id: T-0109
title: ADR-0006 신설 — Assessment/Contribution/Summary 데이터 모델 + raw 미저장 R-59 schema-level 강제
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036]
estimatedDiff: 300
estimatedFiles: 1
actualDiff: 177
actualFiles: 1
created: 2026-05-31
completedAt: 2026-05-31
prNumber: 108
mergedAs: b9fd482
reviewRounds: 1
plannerNote: P3 backbone — Assessment/Contribution/Summary entity 의 raw 미저장(R-59) 결정을 ADR-first 로 박제. requirements.md L51 REQ-032 "P3 (ADR 필수)" 충족. §5 DB-schema 는 ADR 단계라 미발동.
---

# T-0109 — ADR-0006 신설: Assessment/Contribution/Summary 데이터 모델 + raw 미저장 R-59 schema-level 강제

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 의 핵심 backbone bullet — "평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약, L57)" + "🔥 Raw data 저장 금지 (R-59, L58, **ADR-필수 항목**)" + "상대 비교 가능 데이터 구조 (R-63, L59)" — 을 cover 하기 위한 **ADR-first 진입 task** 다. auth/user 도메인 (ADR-0008 chain) 완결 후 [p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) 가 권장한 옵션 (c) hybrid-parallel 의 다음 핵심 backbone (Assessment + Contribution + Summary) 진입점.

**핵심 — §5 DB-schema 처리**: 이 backbone 은 결국 `prisma/schema.prisma` 에 3 신규 model 을 추가하는 DB-schema 변경이다. 그러나 (a) 신규 model 추가는 **순수 additive dev-phase schema** 로 기존 데이터 migration 이 없고 (Person/ServiceIdentity/Group/Part/User 모두 동일 패턴으로 진행됨 — T-0034/T-0035/T-0039/T-0080), (b) [docs/requirements.md L51](../requirements.md) 가 **REQ-032 의 구현 위치를 명시적으로 "P3 (ADR 필수)"** 로 박제, (c) [data-model.md §4](../architecture/data-model.md) 가 "raw 미저장 invariant 위반은 ADR 신설 필수" 로 박제한다. 따라서 **본 task 자체는 Prisma 코드를 작성하지 않는 ADR-only doc** 이며, 실제 schema 코드는 본 ADR 머지(=reviewer 사인오프) 후 별도 후속 task 의 책임이다. 이로써 schema 결정을 reviewer 가 먼저 검토하는 §5 정합 경로를 따른다.

## Required Reading

- [docs/architecture/data-model.md](../architecture/data-model.md) — §2 (Assessment/Contribution/Summary entity 책임 행), §3 관계 4·5·6 (Person↔Assessment / Assessment↔Contribution / Person↔Summary), §4 (raw 미저장 invariant), §5 (cross-cutting field), §7 (Out of scope — 구체 type/index/cascade 가 P3 책임).
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — ADR 본문 구조 (frontmatter + Context + REQ 외력 + Decision + Consequences + Alternatives) 참조 패턴. 본 ADR 이 1:1 mirror.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 5 entity (Person/ServiceIdentity/Group/Part/PersonGroupMembership) + User 의 컬럼/`@@unique`/cascade 패턴. 본 ADR 의 schema 결정이 이 기존 패턴과 정합해야 함 (cuid id / createdAt·updatedAt timestamp / onDelete 정책).
- [docs/requirements.md](../requirements.md) L48–55 — REQ-029/032/033/034/035/036 의 정확한 요약·kind·구현 위치. **REQ-063 은 본 backbone 아님** (L82 "PR review" 로 매핑됨 — data-model.md 의 REQ-063 인용은 stale, 본 ADR 은 REQ-036 사용).
- [docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) §2.6 + §4.1 — 옵션 (c) hybrid-parallel 의 Assessment+Contribution+Summary backbone 위치.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0006-assessment-data-model.md` 신규 생성. frontmatter (id: ADR-0006 / title / status: PROPOSED / date: 2026-05-31 / relatedTask: T-0109 / supersedes: null) 포함.
- [ ] **Context** 절: README L57–59 + requirements.md REQ-029/032/033/034/035/036 외력 인용 + p3-to-p4-transition.md 옵션 (c) 진척 박제 + ADR-0002 (PostgreSQL+Prisma) / ADR-0003 (단일 DB) 기반 정합.
- [ ] **Decision** 절에 다음 schema 결정을 박제 (구체 컬럼명·type 까지):
  - [ ] Assessment model — Person × period(일/주/월 enum-as-String) × scope(commit/document/aggregate) + 평가 결과 컬럼 (난이도/기여도/양/LLM 평가문 텍스트). **raw 본문 컬럼 0** (R-59 schema-level 강제 — raw body column 자체를 정의하지 않음).
  - [ ] Contribution model — Assessment N:1, 개별 commit/PR/문서 단위, **참조 식별자만** (외부 URL + commit SHA / page version ID) raw 본문 미저장.
  - [ ] Summary model — Person N:1, 일·주·월 요약 평가문 (LLM 정성 + Metric 수치). Group/Part aggregate 는 view-time 계산 (별도 entity 아님) 결정 재확인.
  - [ ] 상대 비교 가능 데이터 구조 (REQ-036) — Person × 동일 metric 비교 가능 형태 (정규화된 수치 컬럼) 결정.
  - [ ] `@@unique` / `@@index` 후보 (예: Assessment `@@unique([personId, period, scope, periodStart])`) + cascade 정책 (Person 삭제 시 Assessment, Assessment 삭제 시 Contribution) + soft/hard delete (Assessment/Contribution = hard delete per REQ-041) 박제.
- [ ] **Consequences** 절: raw 미저장 강제가 export(REQ-030)·재수집(REQ-031)·LLM gateway prompt 설계(P5)에 미치는 영향 + 후속 구현 task 의 schema 코드 책임 명시 (본 ADR 은 doc-only, Prisma 코드는 후속 task).
- [ ] **Alternatives considered** 절: (a) raw 본문 저장 후 평가 (reject 사유 — R-59 정면 위반 + 저장 비용/보안), (b) Assessment/Contribution 단일 테이블 통합 (reject 사유 — aggregate 단위 분리 손실), (c) Summary 를 별도 GroupSummary/PartSummary entity 로 (defer 사유 — view-time 계산으로 시작) 최소 2+ 박제.
- [ ] data-model.md §4 의 "본 invariant 위반은 ADR 신설 필수" 가 가리키는 ADR 이 본 ADR-0006 임을 ADR 본문에서 cross-reference.
- [ ] **분기 없음 — 코드 변경 0 (doc-only ADR)**: R-112 happy/error/branch/negative unit test 항목은 본 task 에 해당 없음 (production symbol 0). 단 §3.2 R-110 에 따라 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 ADR 추가가 CI 를 깨지 않음을 확인 (커버리지 변동 0 예상).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 코드 변경 0 이므로 기존 임계 유지).
- [ ] PR 본문에 task 링크 + Acceptance Criteria 체크리스트 + "smoke/e2e 영향 0 (doc-only ADR)" 명시.

## Out of Scope

- **`prisma/schema.prisma` 의 실제 model 코드 추가 금지** — 본 task 는 ADR(결정 문서)만. schema 코드 + migration 은 본 ADR 머지 후 별도 후속 task (T-0110+) 의 책임.
- AssessmentService / AssessmentController / DTO / repository 구현 금지 (후속 task).
- LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord entity 결정 금지 (P4 병행 backbone — 별도 ADR-0007 후보).
- cross-cutting field policy ADR (timezone / createdBy audit-source) 의 전면 박제 금지 — 본 ADR 은 Assessment backbone 에 필요한 최소 cross-cutting 결정(soft/hard delete)만. 전면 정책은 별도 doc-only direct task.
- `docs/architecture/data-model.md` 본문 amend 금지 (ADR 머지 후 living-doc 정합은 별도 follow-up).
- README / requirements.md 의 REQ 상태 컬럼 (PLANNED → 등) 변경 금지 (별도 direct task).

## Suggested Sub-agents

`architect → tester`. architect 가 ADR 본문(데이터 모델 결정 + raw 미저장 R-59 강제 + Alternatives)을 작성하고, tester 가 §3.2 R-110 에 따라 lint/build/test 가 green 임을 확인 (코드 변경 0, 커버리지 영향 0 확인). implementer 미호출 (production code 0).

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
