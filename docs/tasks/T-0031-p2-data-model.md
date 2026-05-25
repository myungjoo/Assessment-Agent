---
id: T-0031
title: P2 데이터 모델 초안 — docs/architecture/data-model.md (conceptual entity model)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-032, REQ-037, REQ-038, REQ-043, REQ-044, REQ-045, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-063]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 다섯째 bullet (data-model.md). 8-10 entity conceptual model + 관계 + REQ-032 raw 미저장 invariant 박제. T-0031 머지 시 P2 fully complete.
dependsOn: [T-0019, T-0028, T-0029, T-0030]
blocks: []
hqOrigin: null
---

# T-0031 — P2 데이터 모델 초안 (`docs/architecture/data-model.md` 신설)

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 5 entry artifact 중 **다섯째이자 마지막 — "데이터 모델 초안"** ([PLAN.md](../PLAN.md) L38) 을 본 task 가 cover 한다. P2 의 직전 task [T-0030](T-0030-p2-api-contract.md) (PR-29 merged 13de859) 가 **8 UC × 약 35 endpoint × 9 resource prefix** 의 API contract 표를 박제 완료. 본 task 는 그 resource path 들 (`/api/persons`, `/api/assessments`, `/api/groups`, `/api/parts`, `/api/llm-config`, `/api/auth` 등) 의 **entity 이름 source** 를 conceptual model 로 박제한다.

본 task 의 본질: **8 UC §5 sequence diagram / §6 데이터 / §7 NFR 에서 호명되는 entity 와 그 관계를 단일 data-model.md 의 conceptual table 로 박제**. 본 모델은 P3 의 Persistence component ([components.md](../architecture/components.md) "Persistence") + Prisma schema task 들의 contract source. 본 task 가 없으면 P3 의 Prisma schema 작성 task 가 entity inventory 를 매 task 마다 재추론해야 하므로 (a) 중복 노력 (b) entity 이름·관계 일관성 깨질 위험 (c) raw 미저장 invariant (REQ-032) 의 박제 시점 분산.

본 task 가 **P2 의 마지막 entry artifact** — 본 task 머지 시 [PLAN.md](../PLAN.md) Phase P2 의 모든 bullet 이 `[x]` 가 되어 **Phase P2 fully complete**. P3 (Domain core — Persistence layer / Auth/RBAC / 인원 관리 / 평가 결과 저장 모델) 진입 준비 완료.

산출물: (1) [docs/architecture/data-model.md](../architecture/data-model.md) 신설 — 8-10 entity conceptual table (entity 이름 / 책임 / source UC / 관련 REQ / 책임 module 컬럼) + 관계 (mermaid ER diagram 또는 표) + raw 미저장 invariant 박제 + cross-cutting field conceptual mention + REQ → entity coverage cross-reference + Out of scope + References, (2) [docs/architecture/INDEX.md](../architecture/INDEX.md) 의 data-model.md row 갱신 (`미작성` → `완료 (T-0031)` + 생성 task 컬럼 `P2 후` → `T-0031 (P2)`), (3) [docs/PLAN.md](../PLAN.md) P2 단락 다섯째 bullet 의 `[ ]` → `[x]` + closure marker inline append.

본 task 는 architecture document 신설이므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/architecture/* 추가는 reviewer 점검 대상).

**Scope discipline (architect 결정 박제)**:

- **DO**: entity 이름 + 책임 + source UC + 관련 REQ + 책임 module 5-컬럼 conceptual table. entity 간 관계 (mermaid ER 또는 표 — 1:1 / 1:N / N:M / optional). raw 미저장 invariant (REQ-032) 박제 — Assessment entity 가 raw commit body / 문서 body 를 저장하지 않고 평가 결과 (난이도/기여도/양/평가문) 만 보유. Cross-cutting field conceptual mention (created_at / updated_at / deleted_at — soft delete 인지 / created_by). REQ → entity coverage cross-reference 표.
- **DO NOT**: 구체 컬럼 type (CHAR(50) / TEXT / TIMESTAMPTZ 등 specific type). Index / unique constraint specifics. Cascade policy (ON DELETE CASCADE / RESTRICT). Prisma schema 코드 (P3 책임). Migration SQL. Audit log schema 구체 (conceptual mention 만). raw_data_storage policy 의 implementation detail (REQ-032 박제만). LLM API key 의 encryption-at-rest 구체 (별도 보안 ADR).
- **DO NOT**: 새 entity 발굴 시 ADR 없이 결정 — 8 UC 에서 호명되지 않은 entity 는 task 본문 또는 후속 task 로 follow-up.

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (CLAUDE.md §7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 다섯째 bullet "데이터 모델 초안" 의 cover. L38)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 목록 (data-model.md row 갱신 대상) + MVA 원칙
- [docs/architecture/api.md](../architecture/api.md) — **본 task 의 핵심 source 1**. 직전 T-0030 산출물. resource model (`/api/persons` 등) 의 path prefix 가 본 task entity 이름의 1:1 source. § 5 endpoint 표 의 각 resource 가 어느 entity 를 manipulate 하는지 1:1 reference.
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — 8 UC backbone 표 (각 UC 의 actor / 책임 component 빠르게 파악)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — UC-01 §5 / §6 / §7 (Assessment / Contribution / Summary entity 호명)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — UC-02 §5 / §6 (Assessment 조회 차원 / Group / Part)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — UC-03 §5 / §6 (Person / ServiceIdentity / Group / Part entity 의 핵심 source)
- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) — UC-04 §5 / §6 (User login account entity + Person 과의 분리)
- [docs/use-cases/UC-05-llm-config.md](../use-cases/UC-05-llm-config.md) — UC-05 §5 / §6 (LlmProviderConfig entity 의 핵심 source — 5 provider / 3 model 슬롯 / 난이도 매핑)
- [docs/use-cases/UC-06-evaluation-delete-reeval.md](../use-cases/UC-06-evaluation-delete-reeval.md) — UC-06 §5 / §6 (Assessment delete + UC-01 자동 재수집 — entity lifecycle 박제)
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — UC-07 §5 / §6 (Export/Import atomic transaction — entity bulk operation conceptual reference)
- [docs/use-cases/UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md) — UC-08 §5 / §6 (PermissionDeniedRecord entity 의 핵심 source — System actor 가 emit 하는 event 의 영속화)
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — T-0029 산출물. 66 REQ × 4 enum 분류 중 uc-covered 48 REQ 의 entity 매핑 cross-reference
- [docs/architecture/components.md](../architecture/components.md) — **Persistence component** 단락 (본 task 의 component scope). Domain core ↔ Persistence contract 박제 위치
- [docs/architecture/modules.md](../architecture/modules.md) — 9 NestJS module (각 entity 가 어느 module 의 책임인지 결정 source — `PersonModule` 의 Person/ServiceIdentity/Group/Part, `AssessmentModule` 의 Assessment/Contribution/Summary, `AuthModule` 의 User/Role, `LlmModule` 의 LlmProviderConfig, `PermissionDeniedModule` 의 PermissionDeniedRecord 등)
- [docs/requirements.md](../requirements.md) — REQ-023~028 (인원 모델 / ServiceIdentity / Group / Part) / REQ-032 (raw 미저장 — **핵심 invariant**) / REQ-037/041 (Assessment lifecycle) / REQ-038 (조회 차원) / REQ-043~045 (User / Role) / REQ-049~055 (LlmProviderConfig) / REQ-063 (상대 비교 가능 데이터 구조) 매핑
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript 결정 (본 task 의 entity definition language 선택 source 는 P3 — 본 task 는 conceptual only)
- [docs/decisions/ADR-0002-database.md](../decisions/ADR-0002-database.md) — **본 task 의 핵심 source 2**. PostgreSQL + Prisma 결정. 본 task 는 conceptual model 만 박제 (Prisma schema 는 P3), 단 ADR-0002 의 결정 이유 (관계형 DB / 강한 schema / migration 지원) 가 본 모델의 형식 source.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Monolith / single DB instance (data-model.md 의 entity 가 단일 DB 안에서 관계 가짐 — multi-DB 분리 안 함)
- [docs/tasks/T-0030-p2-api-contract.md](T-0030-p2-api-contract.md) — 직전 task (template / Acceptance Criteria pattern / Out of Scope 분리 style 참고)

## Acceptance Criteria

본 task 는 doc-only 이지만 새 파일 신설 + commitMode: pr 이므로 R-110 (lint/build/test 확인) 의무가 적용된다. R-112 의 4 항목 (happy-path test / error path / 분기 / negative test) 은 **production code 가 0 LOC 이므로 분기 없음 — 이 항목 생략**, R-111/113 는 markdown 변경이므로 자동 통과.

### A. `docs/architecture/data-model.md` 신설 (핵심 산출물)

- [ ] `docs/architecture/data-model.md` 파일 신설. 최소 다음 8 section 포함:
  - § 1. 개요 (data-model.md 의 scope + ADR-0002 PostgreSQL+Prisma reference + MVA 원칙 reference + "conceptual only, 구체 컬럼은 P3" 박제)
  - § 2. **Entity 목록 표** (핵심 산출물. entity 이름 | 책임 | source UC | 관련 REQ | 책임 module 5-컬럼)
  - § 3. **Entity 간 관계** (mermaid ER diagram 또는 표 — 1:1 / 1:N / N:M / optional 관계 박제. 최소: Person ↔ ServiceIdentity (1:N) / Person ↔ Group (N:M) / Person ↔ Part (N:1, REQ-051 정확히 1개 invariant) / Person ↔ Assessment (1:N) / Assessment ↔ Contribution (1:N) / Assessment ↔ Summary (1:N) / User ↔ Person (선택적 1:1 또는 분리) / LlmProviderConfig (singleton 또는 다중) / PermissionDeniedRecord ↔ ServiceIdentity 또는 Person (N:1))
  - § 4. **Raw 미저장 invariant** (REQ-032) 박제 — Assessment / Contribution entity 가 raw commit body / 문서 변경 body 등을 저장하지 않고 평가 결과 (난이도 / 기여도 / 양 / 평가문) 만 보유. 본 invariant 위반은 ADR 필수.
  - § 5. **Cross-cutting field** conceptual level — created_at / updated_at / deleted_at (soft delete 인지 / hard delete 인지 결정은 entity 별 P3) / created_by (User reference) 등. 모든 entity 가 가지는 공통 field 의 conceptual 명시.
  - § 6. **REQ → entity coverage cross-reference** — 본 task 의 coversReq frontmatter REQ 들이 어느 entity 로 cover 되는지 1:1 표.
  - § 7. **Out of scope** (구체 컬럼 type / index / unique constraint / cascade policy / migration / Prisma schema 코드 / audit log 구체 schema / LLM API key encryption-at-rest — 모두 P3 또는 별도 ADR 책임)
  - § 8. References (PLAN.md / INDEX.md / 8 UC body / api.md / REQ-COVERAGE-AUDIT.md / components.md / modules.md / requirements.md / ADR-0001 / ADR-0002 / ADR-0003 / future P3 Prisma schema 도입 hook)
- [ ] **§ 2 entity 목록 표** 가 다음 8-12 entity 를 포함 (architect 가 8 UC 검토 후 최종 inventory 결정 — 아래는 floor):
  - **Person**: 평가 대상 인원 (REQ-023/024 — 휴직 시 숨김 = active flag). UC-01/02/03 source. 책임 module = PersonModule.
  - **ServiceIdentity**: Person ↔ 서비스별 ID 매핑 (github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등. REQ-025/026/027/028 + R-48 일부 NULL 허용 / R-47 primary key 역할 ID). UC-01/03 source. 책임 module = PersonModule.
  - **Group**: 임의 group (R-51 — 다중 소속 가능). UC-03 source. 책임 module = PersonModule.
  - **Part**: 조직도 파트 (R-51 — 정확히 1개 소속 invariant). UC-03 source. 책임 module = PersonModule.
  - **User**: 로그인 계정 (Person 과 conceptual 분리 — REQ-043/044). UC-04 source. 책임 module = AuthModule. SuperAdmin / Admin / User role.
  - **Assessment**: 평가 결과 단위 (REQ-037/038/041 — 일·주·월 요약 또는 commit/document 단위. REQ-032 raw 미저장). UC-01/02/06 source. 책임 module = AssessmentModule.
  - **Contribution**: 개별 기여 entity (commit/document 단위 평가 결과 — Assessment 의 component). 책임 module = AssessmentModule.
  - **Summary**: 일·주·월 요약 entity (REQ-038 조회 차원). UC-02 source. 책임 module = AssessmentModule.
  - **LlmProviderConfig**: 5 provider × 3 model 슬롯 × 난이도 매핑 (REQ-049/050/051~055). UC-05 source. 책임 module = LlmModule.
  - **PermissionDeniedRecord**: 외부 4xx → System actor emit (REQ-008/016). UC-08 source. 책임 module = PermissionDeniedModule (또는 components.md 의 별도 component).
  - (선택적) **AuditLog**: User mutation event 영속화 — conceptual mention 만, 구체 schema 는 별도 ADR. 본 task scope 외.
- [ ] § 2 표의 각 row 가 **source UC** 와 **책임 module** 을 cross-reference (예: "UC-03 §5 / PersonModule" 또는 anchor link)
- [ ] § 3 관계 박제 — mermaid `erDiagram` 또는 표. 최소 7 관계 명시:
  - Person 1:N ServiceIdentity (Person 1명이 여러 service ID 보유)
  - Person N:M Group (다중 group 소속 가능)
  - Person N:1 Part (정확히 1개 Part — REQ-051 invariant 박제)
  - Person 1:N Assessment (Person 1명이 여러 Assessment 보유)
  - Assessment 1:N Contribution (Assessment 가 여러 Contribution 의 aggregation)
  - Person 1:N Summary (일·주·월 요약은 Person 단위 또는 Group/Part 단위 — architect 결정)
  - User 0..1:1 Person (선택적 매핑 — User 가 Person 과 같은 인물일 수도 다를 수도. SuperAdmin 첫 로그인 시 자동 매핑 정책은 별도)
  - LlmProviderConfig: singleton 또는 다중 — architect 결정 박제
  - PermissionDeniedRecord N:1 ServiceIdentity 또는 Person — 4xx 대상 박제
- [ ] § 4 raw 미저장 invariant (REQ-032) 가 **명시적으로 박제** — Assessment / Contribution entity description 에 "raw commit body / 문서 body 미저장. 평가 결과 (난이도 / 기여도 / 양 / 평가문) 만 보유" 문장 1+ 포함.
- [ ] § 5 cross-cutting field — created_at / updated_at / deleted_at / created_by 의 conceptual 명시. soft delete 인지 hard delete 인지 entity 별 결정은 P3 박제.
- [ ] § 6 REQ → entity coverage 표 — frontmatter coversReq 의 20 REQ 가 모두 1+ entity 로 cover (uncovered 0 검산).
- [ ] § 7 Out of scope 가 본 task scope discipline 의 7 항목 (구체 컬럼 type / index / unique constraint / cascade policy / migration / Prisma schema 코드 / audit log 구체 schema / LLM API key encryption-at-rest) 을 명시.
- [ ] frontmatter 필요 없음 (architecture document 는 frontmatter 안 씀 — components.md / modules.md / directory.md / api.md style 따름).
- [ ] 본문 길이 약 150-200 LOC 안에서 작성 (over-design 회피, MVA 원칙). entity 표 + 관계 mermaid + REQ coverage 표가 핵심.

### B. [docs/architecture/INDEX.md](../architecture/INDEX.md) 갱신

- [ ] data-model.md row 의 "상태" 컬럼: `미작성` → `완료 (T-0031)`
- [ ] data-model.md row 의 "생성 task" 컬럼: `P2 후` → `T-0031 (P2)`

### C. [docs/PLAN.md](../PLAN.md) 갱신

- [ ] P2 단락 다섯째 bullet (L38, "데이터 모델 초안") 의 `[ ]` → `[x]` 전환
- [ ] 같은 bullet 끝에 closure marker inline append: `T-0031 으로 박제 완료 — [data-model.md](architecture/data-model.md) (8-10 entity × 5 컬럼 + 7+ 관계 + raw 미저장 invariant + REQ coverage)`.
- [ ] (선택적) P2 단락 끝에 "**Phase P2 fully complete** — T-0031 머지 시점" 한 줄 메모 (architect 판단).

### D. R-110 (lint/build/test) 의무 (CLAUDE.md §3.2)

- [ ] `pnpm lint` 실행 — markdown 변경이므로 baseline 변동 0 expected. baseline 초과 시 BLOCKED.
- [ ] `pnpm build` 실행 — production code 변경 0 LOC 이므로 통과 expected.
- [ ] `pnpm test` 실행 — production code 변경 0 LOC 이므로 통과 expected.
- [ ] R-112 의 4 항목 (happy-path / error path / 분기 / negative) 은 production code 0 LOC 이므로 **분기 없음 — 이 항목 생략**. PR body 에 "doc-only task, R-112 자동 통과" 명시.

### E. PR body + agent-trail

- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria 체크리스트 + 산출물 요약 (data-model.md entity count / 관계 count / REQ coverage count / "Phase P2 fully complete" 진입 marker) 명시.
- [ ] commit message 에 agent-trail blob 포함 (CLAUDE.md §11 표준 포맷). 본 task 는 architect → implementer → tester 3 sub-agent dispatch (reviewer / integrator 는 driver loop 책임).

## Out of Scope

본 task 에서 **하지 않는다** (executor 가 다른 주제로 빠지는 것 방지 — CLAUDE.md §3 cap discipline):

- 구체 컬럼 type 명세 (예: `CHAR(50)` / `TEXT` / `TIMESTAMPTZ` / `JSONB`) — P3 Prisma schema 책임 (`prisma/schema.prisma`).
- Index / unique constraint specifics (예: `@@index([personId, createdAt])` / `@unique([email])`) — P3 책임.
- Cascade policy (ON DELETE CASCADE / RESTRICT / SET NULL) — P3 결정. 본 task 는 관계 자체만 박제.
- Prisma schema 코드 작성 (P3 책임).
- Migration SQL / migration 정책 (P3 책임).
- Audit log entity 의 구체 schema — conceptual mention 만, 별도 ADR 필요.
- `raw_data_storage` policy 의 implementation detail — REQ-032 invariant 박제만, encryption / storage scheme 은 별도.
- LLM API key 의 encryption-at-rest 구체 mechanism — 별도 보안 ADR 책임 (예: ADR-0004 secret-encryption).
- Audit / soft-delete 정책의 entity 별 specific 결정 — § 5 cross-cutting conceptual 만, entity 별 적용은 P3.
- 새 entity 발굴이 8 UC scope 를 벗어나는 경우 — 본 task 본문 또는 후속 task 로 follow-up. 본 task 안에서 ADR 없이 신규 entity 결정 금지.
- gap REQ-004 (사용자 지정 기간 임의 평가문) 의 entity 영향 — T-0029 audit 가 gap follow-up 으로 박제. 본 task 는 8 UC scope 만 cover.
- ER diagram 의 cardinality 정확도 검증을 P3 의 schema review 단계까지 미룸 — 본 task 는 MVA 수준 conceptual 만.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect** (1순위): 8 UC §5 / §6 / §7 + api.md § 5 endpoint 표 + REQ-COVERAGE-AUDIT.md 를 1차 source 로 entity inventory 수집 → 관계 결정 (cardinality + optional 여부) → User ↔ Person 분리/매핑 정책 결정 → LlmProviderConfig singleton vs 다중 결정 → Summary entity 의 aggregation 단위 결정 (Person 단위 / Group 단위 / Part 단위) → § 7 Out of scope 의 trade-off 박제. ADR 신설 미필요 (data-model.md 자체가 reference document, ADR 수준 결정은 ADR-0002 에 이미 박제됨). 단 architect 가 검토 중 ADR-2 와 충돌하는 결정이 필요해지면 BLOCKED (CLAUDE.md §5).
- **implementer**: architect 의 결정 박제 → data-model.md 작성 (8 section + entity 표 + mermaid ER diagram + REQ coverage 표) + INDEX.md / PLAN.md 갱신.
- **tester**: `pnpm lint && pnpm build && pnpm test` 실행 확인 — markdown 변경이므로 baseline 변동 0 expected. mermaid syntax validation (GitHub render preview 확인 또는 mermaid CLI 사용). R-110 / R-112 검증 의무.

## Follow-ups

(empty — 빈 상태로 시작. sub-agent 가 본 task 수행 중 인접 작업 발견 시 본 단락 또는 STATE.json.humanQuestions 에 박제. 본 task 머지 시 **Phase P2 fully complete** — 다음 자연 phase 진입은 **P3 Domain core** (Persistence layer / Auth/RBAC / 인원 관리 / 평가 결과 저장 모델 / raw 미저장 구현 / 상대 비교 가능 데이터 구조). P3 의 첫 task 는 planner 가 P2 마지막 머지 후 다음 호출에서 결정.)
