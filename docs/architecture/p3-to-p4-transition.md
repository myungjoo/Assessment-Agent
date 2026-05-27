# P3 → P4 transition checkpoint

> **본 문서는 Phase P3 (Domain core) → Phase P4 (External integrations) 의 전이 의사결정 가능 형태 박제 artifact 다.** session #19 turn 4 시점 (T-0062 머지 3398ad9 직후, P3 test-quality 9-cell closure 박제 완성) 의 P3 진척 status quo 와 P4 진입 trigger 후보 3 옵션을 박제한다. **본 문서는 결정 신설 0** — trigger option (a) eager-transition / (b) strict-completion / (c) hybrid-parallel 의 3 옵션 trade-off 만 박제, 실 phase 전환 의사결정은 별도 future task (또는 driver 의 next planner dispatch / humanQuestion 발화) 의 책임. STATE.phase 변경 0 (P3-in-progress 유지).

## 1. 개요

본 문서의 범위는 다음 5 사실의 박제:

1. **P3 진척 status quo 박제** — entity 5/11 / module 2/5 / ADR 1/4 / test-quality 4/4 + 9-cell closure milestone (backbone 3 도메인 × 3 layer fully closed).
2. **P3 잔여 backbone work 박제** — 미박제 6 entity + 3 module + 3 ADR (조합 ADR-0005 / ADR-0006 / ADR-0007 / ADR-0008 중 우선 ADR-0008 auth credential).
3. **P4 진입 trigger 3 옵션 박제** — (a) eager-transition / (b) strict-completion / (c) hybrid-parallel.
4. **권장 trigger option 박제** — (c) hybrid-parallel (선택 강제 안 함, 권장만).
5. **P3 잔여 backbone task 목록 estimate 박제** — 옵션 별 task 수.

본 doc 의 기반:

- [docs/PLAN.md](../PLAN.md) Phase P3 (L47–66) + Phase P4 (L70–80) — phase boundary 의 1 차 source.
- [docs/architecture/p3-implementation-plan.md](p3-implementation-plan.md) §6 P3 → P4 전이 조건 — entity 5/11 / module 2/5 / ADR 1/4 / test-quality 4/4 progress 박제 source.
- [docs/architecture/data-model.md](data-model.md) — 11 entity inventory source (박제 5 + 미박제 6 = 11).
- [docs/architecture/modules.md](modules.md) — 9 NestJS module 의 source. P3 scope 5 module 중 2 박제 + 3 미박제.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — P3 진행 중 신설된 첫 ADR (T-0051 9109e65 PR-46 ACCEPTED). ADR progress 1/4 박제 source.
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — session #19 turn 1/2/3 의 9-cell closure milestone 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode 정책) / §5 (HITL — 새 외부 dependency 추가는 BLOCKED) — 본 doc 가 doc-only direct 인 근거 source.

## 2. P3 진척 status quo (T-0062 closure 시점)

### 2.1 entity Prisma model — progress 5/11 (45%)

**박제 완료 5 entity**:

| entity | 박제 task | service+controller layer |
| --- | --- | --- |
| Person | T-0034 entity + T-0036 service+controller+DTO + T-0041 repository ext | 5/5 stage closure |
| ServiceIdentity | T-0035 entity + repository | 부분 박제 (read-only, REQ-026 invariant 는 PersonService cover) |
| Group | T-0039 entity + T-0050 service CRUD + T-0055 controller CRUD + T-0056 service N:M ops + T-0057 controller N:M endpoint | 5/5 stage closure |
| Part | T-0039 entity + T-0046 service+controller+DTO | 5/5 stage closure (1:N navigation) |
| PersonGroupMembership | T-0039 join entity + T-0049 repository | join entity (middle table, 직접 controller 불필요) |

**미박제 6 entity**:

| entity | 책임 module (modules.md) | P3 진입 task 후보 |
| --- | --- | --- |
| User | AuthModule | 후속 P3 backbone task (T-0064+) |
| Assessment | AssessmentModule | 후속 P3 backbone task |
| Contribution | AssessmentModule | 후속 P3 backbone task |
| Summary | AssessmentModule | 후속 P3 backbone task |
| LlmProviderConfig | LlmModule | 후속 P3 backbone task (ADR-0006 LLM key 동반 후보) |
| DifficultyMapping | LlmModule | 후속 P3 backbone task |
| PermissionDeniedRecord | UserModule (또는 AuthModule) | 후속 P3 backbone task (ADR-0007 audit log 동반 후보) |

(7 row 중 conceptual AuditLog 별도 — actual schema 박제 deferred, data-model.md §2 와 동일 입장.)

### 2.2 module skeleton — progress 2/5 (40%)

**박제 완료 2 module**: PersistenceModule (T-0033) / UserModule (T-0034 → T-0057 누적 확장).

**미박제 3 module (P3 scope)**:

- **AuthModule** — User entity + JWT/session credential + RBAC (SuperAdmin/Admin/User) + 첫 로그인 SuperAdmin 지정 invariant + Admin→User self-demote 금지 (R-84). 후보 ADR-0008 auth credential type 동반.
- **AssessmentModule** — Assessment + Contribution + Summary entity + 평가 결과 저장 모델 + raw 미저장 invariant schema-level 강제 (R-59) + 상대 비교 가능 데이터 구조 (R-63). 후보 ADR-0005 cross-cutting field 동반.
- **LlmModule (P3 scaffold)** — LlmProviderConfig + DifficultyMapping entity + provider abstraction interface. 실제 5 provider HTTP client 구현은 P4 책임. 후보 ADR-0006 LLM key encryption-at-rest 동반.

**P4+ 책임 4 module**: GithubModule (P4) / ConfluenceModule (P4) / SchedulerModule (P7) / WebModule (P6).

### 2.3 ADR — progress 1/4 (25%)

**박제 완료 1 ADR**: ADR-0004 (smoke/e2e CI DB mode policy) ACCEPTED — T-0051 9109e65 PR-46. P3 진행 중 첫 ADR 신설 milestone + ADR-first split 4-stage pattern (T-0051 ADR → T-0052 CI → T-0053 smoke → T-0054 e2e) 박제.

**미박제 4 후보 ADR** (우선순위 순):

| ADR | 책임 task 후보 | 트리거 시점 | 신설 사유 |
| --- | --- | --- | --- |
| ADR-0008 — Auth credential type (JWT vs session cookie) | User + AuthModule backbone 진입 직전 task | P3 진행 중 (우선) | api.md §2 Auth credential 행이 "P3 AuthModule 도입 task 의 ADR 에서 택일" 박제. AuthModule 진입 직전 trigger. |
| ADR-0005 — Cross-cutting field policy (timezone / soft delete / createdBy audit-source) | P3 종료 직전 별도 task | P3 진행 중 (중간) | data-model.md §5 conceptual 박제를 schema-level 정책으로 격상. P3 진행된 5 entity 의 cross-cutting field ad-hoc 적용 중. |
| ADR-0006 — LLM API key encryption-at-rest | LlmProviderConfig entity 진입 task 동반 | P4 진입 직전 (또는 P3 LlmModule scaffold) | LlmProviderConfig.apiKey 컬럼의 encryption mechanism (PostgreSQL pgcrypto / KMS / application-layer envelope) 결정. |
| ADR-0007 — Audit log entity schema | PermissionDeniedRecord entity 진입 task 동반 (또는 P4) | P3 끝 또는 P4 | data-model.md §2 conceptual AuditLog 의 구체 schema 박제. User mutation event (등급 변경 / 평가 삭제 / Import-Export) 영속화. |

### 2.4 test-quality — progress 4/4 (확장 closure, 9-cell matrix fully closed)

P3 test-quality 4 bullet (PLAN.md L63–66) 의 closure 박제:

- **L63 unit branch coverage 100% closure** — T-0042 (PersonService.update P2002 + patch.email undefined branch unit, 96.66% → 100% branch coverage).
- **L64 smoke domain endpoint 확장 closure** — T-0043 (persons.smoke 5 endpoint mock-DB) + T-0053 (persons.smoke real PostgreSQL cutover, 888a960 PR-49) + T-0059 (parts.smoke real PostgreSQL, 3f71c64) + T-0061 (groups.smoke real PostgreSQL, 2238e51).
- **L65 e2e domain endpoint 확장 closure** — T-0044 (persons.e2e mock-DB) + T-0054 (persons.e2e real PostgreSQL cutover, 2d52128 PR-50) + T-0060 (parts.e2e real PostgreSQL, acef3f4) + T-0062 (groups.e2e real PostgreSQL, 3398ad9).
- **L66 smoke/e2e real PostgreSQL CI 전환 closure** — ADR-0004 (T-0051) + CI Postgres services (T-0052 3983dca) + persons/parts/groups domain × smoke/e2e 6-cell real-DB cutover (T-0053/T-0054/T-0059/T-0060/T-0061/T-0062).

**9-cell matrix fully closed milestone** — backbone 3 도메인 (persons / parts / groups) × 3 layer (unit / smoke / e2e) = 9 cell 의 R-112/R-113 cover + real PostgreSQL CI infra 위에서 first-class 동작. **mock 시대 종결**의 모든 도메인 cover 완성 — session #19 turn 3 시점 T-0062 머지로 박제.

추가 확장 progress:

- **test infra refactor (T-0047)** — shared `test/helpers/prisma-mock.ts` 추출로 4 spec inline mock 중복 제거.
- **ADR-first split 4-stage closure (T-0051 → T-0054)** — ADR 신설이 CI infra → smoke → e2e 의 직선 chain cascading. T-0059/T-0060/T-0061/T-0062 가 본 패턴을 parts/groups 도메인으로 확장.
- **agent infra closure (T-0048)** — reviewer-gate race 7 회 연속 catch 후 `.claude/agents/integrator.md` 절차 박제. 이후 T-0049~T-0057 9 task 중 race-fix dogfood SUCCESS streak (`gh run rerun` 0 회 누적), T-0061 race-rerun 1 회 후 T-0062 single-shot 으로 정상화 검증.

### 2.5 cap-bend pattern observation (P3 진행 중 관측)

P3 진행 중 service/controller-with-R-112-spec backbone 의 systematic underestimate 박제:

| task | planner estimate | actual | overrun |
| --- | --- | --- | --- |
| T-0055 GroupController CRUD | 300 | 413 | +37% |
| T-0056 GroupService N:M ops | 240 | 545 | +127% |
| T-0057 GroupController N:M endpoint | 280 | 496 | +77% |
| T-0061 groups.smoke | 300 | 342 | +14% |
| T-0062 groups.e2e | 300 | 406 | +35% |

**평균 +58% over** (5 회차 systematic underestimate). R-112 4 카테고리 (happy / error / branch / negative) 충분 cover 의무 + DTO + controller + service + spec 의 4 layer 동시 박제 시 자연 cap-bend 정당화. estimate model 갱신 follow-up task 후보 (별도 doc-only direct, 본 doc scope 외).

## 3. P4 진입 trigger 3 옵션

### 옵션 (a) eager-transition

**정의**: 현 시점 (entity 5/11 / module 2/5 / ADR 1/4) 에서 즉시 P4 진입. 잔여 P3 backbone (User + Assessment + Contribution + Summary + LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord entity / AuthModule + AssessmentModule + LlmModule) 는 P4 진행 중 병행.

**장점**:

- **외부 통합 일찍 unblock** — GitHub adapter (github.com / github.sec.samsung.net / github.ecodesamsung.com 3 instance) / Confluence adapter / LLM gateway (5 provider) 의 P4 task 가 즉시 진입 가능.
- **P4 외부 dependency 추가 (`@octokit/rest` 등) 의 HITL BLOCKED 게이트 일찍 발화** — 사용자 결정 cycle 일찍 시작.
- **strategic value 우선** — 외부 시스템과의 통합 contract 가 일찍 박제되어 도메인 모델 조정 여지 확보.

**단점**:

- **도메인 invariant schema-level 강제 누락 위험** — raw 미저장 (R-59) / 상대 비교 가능 데이터 구조 (R-63) / RBAC (R-84) 등이 schema-level 강제 없이 외부 통합과 동시 진행 → 외부 데이터 수집 시점에 invariant 위반 catch 늦음.
- **AuthModule + RBAC 미완성 상태로 외부 자격증명 (GitHub token / Confluence token / LLM API key) 처리** — 자격증명 layer 가 unprotected 상태로 외부 통합 진행 위험.
- **phase boundary 모호** — P3 "complete" 의 박제 시점 의사결정이 어려워짐 (잔여 P3 work 가 P4 안에서 계속 진행).

### 옵션 (b) strict-completion

**정의**: PLAN.md L51–66 의 13 bullet 전부 + entity 11/11 + module 5/5 + ADR 4/4 박제 후 P4 진입.

**장점**:

- **도메인 invariant 의 schema-level 강제 완성** — raw 미저장 (R-59) / 상대 비교 (R-63) / RBAC (R-84) 모두 schema-level + service-level invariant 박제 후 외부 통합 진입 → 외부 데이터 수집 시점에 invariant 위반 자동 차단.
- **auth/RBAC 보안 layer 완성** — 외부 자격증명 처리 시점에 AuthModule + ADR-0008 auth credential type + RBAC 모두 박제 → 자격증명 unprotected 위험 0.
- **phase boundary 명확** — P3 closure milestone (entity 11/11 + module 5/5 + ADR 4/4 + test-quality 4/4) 박제 후 P4 entry document 신설 (별도 task) — P2 → P3 entry 의 [p3-implementation-plan.md](p3-implementation-plan.md) 패턴 reuse.

**단점**:

- **P4 까지 시간 비용 큼** — 미박제 6 entity + 3 module + 3 ADR 박제까지 평균 12–18 task 추가 (T-0064 ~ T-0080 예상). 5 회차 cap-bend 패턴 considering 시 actual 15–20 task estimate.
- **GitHub adapter / Confluence adapter / LLM gateway unblock 까지 시간 비용** — 외부 시스템 통합 contract 박제가 미뤄지면 사용자 의도 (전체 evaluation pipeline 의 end-to-end demo) 의 fully operational 시점이 지연.
- **잔여 backbone task 진행 중 외부 dependency 추가 누적** — class-validator stack (HQ-0005) precedent 처럼 각 entity/module 진입 시 새 패키지 추가 가능, HITL BLOCKED 게이트 누적.

### 옵션 (c) hybrid-parallel

**정의**: 핵심 P3 backbone (User + AuthModule + ADR-0008 auth credential / Assessment + Contribution + Summary entity + 영속 invariant ADR-0005 cross-cutting + ADR-0006 LLM key + raw 미저장 R-59 schema-level 강제 1+) 만 완성 후 P4 진입. LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord 는 P4 와 병행.

**장점**:

- **보안 + 핵심 invariant 강제 + 외부 통합 일찍 unblock 의 균형** — AuthModule 완성으로 자격증명 layer protected + raw 미저장 schema-level 강제로 평가 결과 저장 모델 invariant 박제 후 외부 통합 진입.
- **strategic value + risk mitigation 양쪽** — GitHub adapter / Confluence adapter unblock 까지 시간 비용 옵션 (b) 대비 약 절반 (~9 task estimate).
- **P3 진행 중 발견된 progress velocity 패턴 reuse** — cap-bend 5 회차 + R-112 colocated-spec catch streak 2 회차 + ADR-first split 4-stage closure 등의 P3 패턴이 잔여 핵심 backbone 에서도 reuse 가능 → estimate model 안정화.

**단점**:

- **phase boundary 모호 (옵션 (a) 와 유사)** — phase-completion 의 박제 시점 의사결정 추가 필요 (어느 entity/module 까지 "핵심" 인지 정의의 borderline).
- **잔여 (LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord) 의 P4 안 병행 진행 시 module 책임 분배 변경 가능** — 예: LlmModule 의 scaffold 가 P4 안에서 직접 P4 외부 통합과 동시 박제 → P3/P4 boundary 의 task ownership 재정의.
- **ADR-0007 audit log schema 의 미박제 상태로 PermissionDeniedRecord 진행 위험** — P4 와 병행 진행 중 audit log 정책이 ad-hoc 으로 박제 → 추후 ADR 박제 시점에 retroactive 부담.

## 4. 권장 trigger option + 의사결정 가능 시점

**권장 후보**: **(c) hybrid-parallel**.

**권장 사유**:

1. **progress velocity 분석** — P3 진행 중 발견된 cap-bend 5 회차 평균 +58% over + R-112 colocated-spec catch streak 2 회차 considering 시 옵션 (b) strict-completion 의 12–18 task estimate 가 실제 15–20 task 로 확장 → P4 외부 통합 unblock 까지 strategic value loss.
2. **보안 layer 최소 박제** — AuthModule + ADR-0008 auth credential + User entity 박제는 P4 의 외부 자격증명 처리의 prerequisite. 옵션 (a) eager-transition 의 자격증명 unprotected 위험 mitigation.
3. **도메인 invariant 핵심만 schema-level 강제** — raw 미저장 (R-59) + 상대 비교 (R-63) 의 schema-level 강제는 평가 결과 저장 모델 의 fully operational 의 핵심. Assessment + Contribution + Summary entity 박제까지는 P3 안에서 완성.
4. **ADR-first split 4-stage pattern reuse 가능** — T-0051 → T-0054 의 ADR-first 4-stage chain 패턴이 ADR-0008 auth credential / ADR-0005 cross-cutting / ADR-0006 LLM key 에서도 reuse → 잔여 P3 backbone 의 estimate stability 박제.

**단**: 본 문서는 권장만 박제, **실 의사결정은 다음 planner dispatch 또는 humanQuestion 발화 시점**. STATE.phase 변경 0 (P3-in-progress 유지) — phase 전환은 본 task 책임 아님.

**의사결정 가능 시점 후보**:

- **다음 cron / loop turn 의 planner dispatch** — planner 가 nextTask 결정 시 본 문서의 trigger option 3 종 중 1 종을 박제할 task 발행.
- **humanQuestion 발화** — driver 가 P3 잔여 backbone task 의 dependency chain 결정 시 사용자에게 trigger option 의 binding decision 요청.
- **P3 진행 중 자연 trigger** — User entity + AuthModule 박제 진입 task (T-0064+) 의 첫 task 진행 시점에 ADR-0008 동반 박제로 옵션 (c) hybrid-parallel 의 진입 박제.

## 5. P3 잔여 backbone task 목록 (estimate)

각 옵션 별 잔여 P3 backbone task 수 estimate:

### 옵션 (a) eager-transition

P3 잔여 backbone task 0 — 즉시 P4 진입, 잔여 work 가 P4 안에서 병행 진행. **단** P4 entry document 박제 task 1 개는 필요 (별도 planner task, P2 → P3 의 p3-implementation-plan.md 패턴 reuse).

### 옵션 (b) strict-completion (~17 task estimate)

| backbone | estimate task 수 | 후보 task 목록 |
| --- | --- | --- |
| User + AuthModule + ADR-0008 | ~3 task | User entity + repository / AuthModule + JWT/session + RBAC / ADR-0008 신설 |
| Assessment + Contribution + Summary entity | ~6 task | Assessment entity + repository / AssessmentService CRUD / AssessmentController / Contribution entity / Summary entity / Assessment N:M (Person → Assessment 관계) |
| LlmProviderConfig + DifficultyMapping | ~3 task | LlmProviderConfig entity / DifficultyMapping entity / LlmModule scaffold (provider abstraction interface) |
| PermissionDeniedRecord | ~2 task | PermissionDeniedRecord entity + repository / Recording integration |
| ADR-0005 cross-cutting | ~1 task | cross-cutting field policy ADR 신설 + 5 entity retroactive 적용 |
| ADR-0006 LLM key | ~1 task | LLM API key encryption-at-rest ADR 신설 |
| ADR-0007 audit log | ~1 task | Audit log entity schema ADR 신설 |
| **합계** | **~17 task** | cap-bend 5 회차 considering 시 actual 20–25 task estimate |

### 옵션 (c) hybrid-parallel (~9 task estimate)

| backbone | estimate task 수 | 후보 task 목록 |
| --- | --- | --- |
| User + AuthModule + ADR-0008 | ~3 task | (옵션 (b) 와 동일) |
| Assessment + Contribution + Summary entity | ~5 task | Assessment entity / AssessmentService / AssessmentController / Contribution + Summary entity / raw 미저장 R-59 schema-level 강제 |
| ADR-0005 cross-cutting | ~1 task | (옵션 (b) 와 동일) |
| ADR-0006 LLM key (P3 안 진행) | ~0 task (P4 와 병행) | LlmProviderConfig + LlmModule scaffold + ADR-0006 → P4 진입 task 와 병행 |
| ADR-0007 audit log | ~0 task (P4 와 병행) | PermissionDeniedRecord + ADR-0007 → P4 와 병행 |
| **합계** | **~9 task** | cap-bend considering 시 actual 12–15 task estimate |

각 task ID 미할당 — 별도 planner task 의 책임.

## 6. References

- [docs/PLAN.md](../PLAN.md) Phase P3 (L47–66) + Phase P4 (L70–80) — phase boundary 의 1 차 source.
- [docs/architecture/p3-implementation-plan.md](p3-implementation-plan.md) §6 P3 → P4 전이 조건 — entity 5/11 / module 2/5 / ADR 1/4 / test-quality 4/4 progress 박제 source.
- [docs/architecture/data-model.md](data-model.md) — 11 entity inventory source.
- [docs/architecture/modules.md](modules.md) — 9 NestJS module source.
- [docs/architecture/api.md](api.md) — 9 resource prefix × 35 endpoint source.
- [docs/architecture/INDEX.md](INDEX.md) — architecture document 목록 + MVA 원칙.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — P3 진행 중 신설된 첫 ADR (ADR progress 1/4 박제 source).
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — session #19 turn 1/2/3 의 9-cell closure milestone 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode) / §5 (HITL 새 dependency BLOCKED) — 본 doc 가 doc-only direct 인 근거 source.
- 본 doc 머지 commit SHA — T-0063 머지 후 driver bookkeeping 단계에서 갱신.

Refs: T-0063, T-0062, T-0061, T-0060, T-0059, T-0058, T-0057, T-0056, T-0055, T-0054, T-0053, T-0052, T-0051, T-0050, T-0049, T-0048, T-0047, T-0046, T-0045, T-0044, T-0043, T-0042, T-0041, T-0040, T-0039, T-0038, T-0037, T-0036, T-0035, T-0034, T-0033, T-0032, ADR-0001, ADR-0002, ADR-0003, ADR-0004, REQ-051, REQ-057, REQ-058
