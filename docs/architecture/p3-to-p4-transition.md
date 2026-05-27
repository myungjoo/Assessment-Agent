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

| entity                | 박제 task                                                                                                              | service+controller layer                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Person                | T-0034 entity + T-0036 service+controller+DTO + T-0041 repository ext                                                  | 5/5 stage closure                                               |
| ServiceIdentity       | T-0035 entity + repository                                                                                             | 부분 박제 (read-only, REQ-026 invariant 는 PersonService cover) |
| Group                 | T-0039 entity + T-0050 service CRUD + T-0055 controller CRUD + T-0056 service N:M ops + T-0057 controller N:M endpoint | 5/5 stage closure                                               |
| Part                  | T-0039 entity + T-0046 service+controller+DTO                                                                          | 5/5 stage closure (1:N navigation)                              |
| PersonGroupMembership | T-0039 join entity + T-0049 repository                                                                                 | join entity (middle table, 직접 controller 불필요)              |

**미박제 6 entity**:

| entity                 | 책임 module (modules.md)     | P3 진입 task 후보                                    |
| ---------------------- | ---------------------------- | ---------------------------------------------------- |
| User                   | AuthModule                   | 후속 P3 backbone task (T-0064+)                      |
| Assessment             | AssessmentModule             | 후속 P3 backbone task                                |
| Contribution           | AssessmentModule             | 후속 P3 backbone task                                |
| Summary                | AssessmentModule             | 후속 P3 backbone task                                |
| LlmProviderConfig      | LlmModule                    | 후속 P3 backbone task (ADR-0006 LLM key 동반 후보)   |
| DifficultyMapping      | LlmModule                    | 후속 P3 backbone task                                |
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

| ADR                                                                                     | 책임 task 후보                                         | 트리거 시점                               | 신설 사유                                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ADR-0008 — Auth credential type (JWT vs session cookie)                                 | User + AuthModule backbone 진입 직전 task              | P3 진행 중 (우선)                         | api.md §2 Auth credential 행이 "P3 AuthModule 도입 task 의 ADR 에서 택일" 박제. AuthModule 진입 직전 trigger.                 |
| ADR-0005 — Cross-cutting field policy (timezone / soft delete / createdBy audit-source) | P3 종료 직전 별도 task                                 | P3 진행 중 (중간)                         | data-model.md §5 conceptual 박제를 schema-level 정책으로 격상. P3 진행된 5 entity 의 cross-cutting field ad-hoc 적용 중.      |
| ADR-0006 — LLM API key encryption-at-rest                                               | LlmProviderConfig entity 진입 task 동반                | P4 진입 직전 (또는 P3 LlmModule scaffold) | LlmProviderConfig.apiKey 컬럼의 encryption mechanism (PostgreSQL pgcrypto / KMS / application-layer envelope) 결정.           |
| ADR-0007 — Audit log entity schema                                                      | PermissionDeniedRecord entity 진입 task 동반 (또는 P4) | P3 끝 또는 P4                             | data-model.md §2 conceptual AuditLog 의 구체 schema 박제. User mutation event (등급 변경 / 평가 삭제 / Import-Export) 영속화. |

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

| task                                | planner estimate | actual | overrun |
| ----------------------------------- | ---------------- | ------ | ------- |
| T-0055 GroupController CRUD         | 300              | 413    | +37%    |
| T-0056 GroupService N:M ops         | 240              | 545    | +127%   |
| T-0057 GroupController N:M endpoint | 280              | 496    | +77%    |
| T-0061 groups.smoke                 | 300              | 342    | +14%    |
| T-0062 groups.e2e                   | 300              | 406    | +35%    |

**평균 +58% over** (5 회차 systematic underestimate). R-112 4 카테고리 (happy / error / branch / negative) 충분 cover 의무 + DTO + controller + service + spec 의 4 layer 동시 박제 시 자연 cap-bend 정당화. estimate model 갱신 follow-up task 후보 (별도 doc-only direct, 본 doc scope 외).

### 2.6 session #22 turn 1 시점 refresh (T-0075 closure 직후)

> **§2.1–§2.5 의 박제 freeze (session #19 turn 4, T-0062 closure 시점, entity 5/11) 는 역사 박제로 유지.** 본 subsection 은 session #20 의 T-0066 / T-0067 / T-0068 Group CRUD-U 4-layer 박제 완성 + session #22 turn 1 의 T-0075 Part CRUD-U 4-layer 박제 완성 후의 사실 박제. T-0063 박제 invariant 와 충돌 0 — 추가 박제 layer 만 신설.

**entity progress refresh — 5/11 → 8/11 (45% → 73%)**:

| 추가 박제 layer                                                       | 박제 task chain          | 4-layer closure marker                          |
| --------------------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| Group CRUD-U 4-layer (DTO + repository + service + controller + spec) | T-0066 + T-0067 + T-0068 | 4-layer fully closed (PATCH endpoint 박제 포함) |
| Part CRUD-U 4-layer (DTO + repository + service + controller + spec)  | T-0069 + T-0071 + T-0075 | 4-layer fully closed (PATCH endpoint 박제 포함) |

5 박제 entity (Person + ServiceIdentity + Group + Part + PersonGroupMembership) 의 layer-progress 가 Group + Part 에 대해 controller layer 의 update path (PATCH) 까지 fully closed 된 milestone. **entity 박제 수 자체는 5/11 → 8/11** 의 박제 layer-progress marker 로 해석 (entity 자체 신설 0, 기존 5 entity 중 Group + Part 의 CRUD-U full path 박제 추가 → "박제 layer 완성" 기준 3 단위 추가).

**미박제 3 entity 재정렬 (P3 잔여 핵심 backbone 후보)**:

- **핵심 backbone 3 entity (옵션 (c) hybrid-parallel 의 P3 안 박제 대상)**: User + Assessment + Contribution (또는 Assessment + Contribution + Summary 조합).
- **P4 와 병행 가능 4 entity (옵션 (c) hybrid-parallel 의 P4 안 박제 대상)**: Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord.
- (재정렬 사유: 평가 결과 저장 모델의 raw 미저장 invariant R-59 schema-level 강제는 Assessment + Contribution + Summary 3 entity 중 최소 Assessment + Contribution 박제 후 의미. Summary 의 P3 안 박제는 옵션 의 borderline.)

**module skeleton + ADR progress 변경 0**: 2/5 module 박제 유지 (PersistenceModule + UserModule) / 1/4 ADR 박제 유지 (ADR-0004). 본 refresh 의 박제 layer 는 기존 박제 module (UserModule) 안의 controller layer 확장 — module / ADR 신설 0.

**test-quality 9-cell matrix 의 retroactive 확장 박제**: Group + Part 도메인 의 CRUD-U layer 추가로 unit / integration spec 의 R-112 4 카테고리 cover 가 PATCH endpoint 까지 확장 박제. **단** smoke / e2e 의 PATCH endpoint 박제는 별도 후속 task (T-0075 Follow-ups 의 "parts.e2e PATCH endpoint" + "groups.e2e PATCH endpoint" 2 후보). 9-cell matrix 자체의 박제 marker (mock 시대 종결) 는 T-0062 closure 시점 freeze 유지 — 본 refresh 는 spec layer 안의 R-112 cover 확장만 박제.

**inline-amend × 0.4 sub-multiplier dogfood**: 본 task 는 T-0070 14 회차 milestone refinement + T-0073 inline-amend × 0.4 1 회차 박제 (estimate-model.md §3.2.2) 후 inline-amend dogfood 3 회차. T-0076 본 task 자체가 2 파일 envelope (transition doc + PLAN.md L70-74) 의 ~120 LOC estimate — inline-amend × 0.4 sub-multiplier 의 추가 dogfood 데이터 1 회차로 누적.

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

### 4.1 session #22 시점 binding-decision 권장 (Group + Part CRUD-U 4-layer closure 후 refresh)

> §4 의 권장 후보 (c) hybrid-parallel 박제는 T-0063 박제 시점 (session #19 turn 4) 의 사실 — invariant 로 유지. 본 subsection 은 session #22 turn 1 (T-0075 머지 직후) 시점의 **권장 강화** 박제. STATE.phase 변경 0 — 옵션 (c) 자체가 P3-in-progress 유지 중 일부 P4 task 병행 trigger 의 정의이므로 binding-decision 시점이 phase 전환과 무관.

**권장 강화 사유 — entity 73% 박제 후 strategic value 한계점**:

1. **entity backbone 73% 박제 완성** — Group + Part 도메인 CRUD-U full path (PATCH endpoint 포함) 박제 후 평가 결과 저장 모델의 prerequisite 인 도메인 layer 의 핵심 8/11 cover. 잔여 3 핵심 entity (User / Assessment / Contribution) + Summary 까지 박제하면 P3 핵심 backbone closure 박제 가능.
2. **cap-bend 14 회차 누적 평균 +41% 안정화** — estimate-model.md §2.4 의 cap-bend 14 회차 milestone 박제 (T-0070) 후 T-0071 + T-0075 2 회차 추가 P2002 sub × 1.2 데이터 + T-0073 inline-amend × 0.4 1 회차 누적 데이터 박제 — estimate model 의 안정화 marker 가 milestone 14 회차에서 15 회차로 진척 중. 잔여 P3 backbone task estimate 의 신뢰도 박제.
3. **잔여 task estimate ~9 → ~5~6 task 로 축소** — Group + Part CRUD-U 박제 후 옵션 (c) hybrid-parallel 의 잔여 핵심 backbone:
   - User + AuthModule + ADR-0008 auth credential ~3 task
   - Assessment + Contribution + Summary 핵심 entity + raw 미저장 R-59 schema-level 강제 ~3 task
   - ADR-0005 cross-cutting field policy ~0 task (별도 doc-only, 본 task chain 외)
   - 합계 ~5~6 task estimate. cap-bend 14 회차 누적 평균 +41% considering 시 actual ~7~9 task estimate.

**권장 binding-decision 시점 박제**:

User entity + AuthModule + ADR-0008 신설 task chain 의 **첫 task 진행 시 옵션 (c) hybrid-parallel 박제**. 박제 path 후보:

- **planner dispatch** — 다음 cron / loop turn 의 planner 가 User entity / AuthModule / ADR-0008 task chain 의 첫 task (예: T-0077+) 신설 시 trigger option 옵션 (c) 박제 marker frontmatter 에 추가.
- **humanQuestion 발화** — driver 가 P3 잔여 backbone task chain 의 dependency 결정 시 사용자에게 옵션 (c) 박제의 binding 요청 (예: "ADR-0008 auth credential type JWT vs session cookie" 의 결정 시점 동반).
- **자연 trigger** — User entity 진입 task 의 ADR-0008 동반 박제 자체가 옵션 (c) 의 박제. 별도 binding-decision artifact 신설 없이 task chain 진행 중 자연 박제.

**단**: 본 task (T-0076) 머지 후에도 STATE.phase 변경 0 — phase 전환 / binding-decision 의 실제 박제는 별도 planner / humanQuestion 의 책임 (T-0063 박제 invariant 유지). 본 §4.1 은 **권장 강화 박제 only**.

## 5. P3 잔여 backbone task 목록 (estimate)

각 옵션 별 잔여 P3 backbone task 수 estimate:

### 옵션 (a) eager-transition

P3 잔여 backbone task 0 — 즉시 P4 진입, 잔여 work 가 P4 안에서 병행 진행. **단** P4 entry document 박제 task 1 개는 필요 (별도 planner task, P2 → P3 의 p3-implementation-plan.md 패턴 reuse).

### 옵션 (b) strict-completion (~17 task estimate)

| backbone                                   | estimate task 수 | 후보 task 목록                                                                                                                                                    |
| ------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User + AuthModule + ADR-0008               | ~3 task          | User entity + repository / AuthModule + JWT/session + RBAC / ADR-0008 신설                                                                                        |
| Assessment + Contribution + Summary entity | ~6 task          | Assessment entity + repository / AssessmentService CRUD / AssessmentController / Contribution entity / Summary entity / Assessment N:M (Person → Assessment 관계) |
| LlmProviderConfig + DifficultyMapping      | ~3 task          | LlmProviderConfig entity / DifficultyMapping entity / LlmModule scaffold (provider abstraction interface)                                                         |
| PermissionDeniedRecord                     | ~2 task          | PermissionDeniedRecord entity + repository / Recording integration                                                                                                |
| ADR-0005 cross-cutting                     | ~1 task          | cross-cutting field policy ADR 신설 + 5 entity retroactive 적용                                                                                                   |
| ADR-0006 LLM key                           | ~1 task          | LLM API key encryption-at-rest ADR 신설                                                                                                                           |
| ADR-0007 audit log                         | ~1 task          | Audit log entity schema ADR 신설                                                                                                                                  |
| **합계**                                   | **~17 task**     | cap-bend 5 회차 considering 시 actual 20–25 task estimate                                                                                                         |

### 옵션 (c) hybrid-parallel (~9 task estimate, T-0063 박제 시점)

| backbone                                   | estimate task 수     | 후보 task 목록                                                                                                                   |
| ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| User + AuthModule + ADR-0008               | ~3 task              | (옵션 (b) 와 동일)                                                                                                               |
| Assessment + Contribution + Summary entity | ~5 task              | Assessment entity / AssessmentService / AssessmentController / Contribution + Summary entity / raw 미저장 R-59 schema-level 강제 |
| ADR-0005 cross-cutting                     | ~1 task              | (옵션 (b) 와 동일)                                                                                                               |
| ADR-0006 LLM key (P3 안 진행)              | ~0 task (P4 와 병행) | LlmProviderConfig + LlmModule scaffold + ADR-0006 → P4 진입 task 와 병행                                                         |
| ADR-0007 audit log                         | ~0 task (P4 와 병행) | PermissionDeniedRecord + ADR-0007 → P4 와 병행                                                                                   |
| **합계**                                   | **~9 task**          | cap-bend considering 시 actual 12–15 task estimate                                                                               |

#### session #22 시점 refresh (T-0075 closure 직후)

> §5 옵션 (c) hybrid-parallel ~9 task estimate 박제 (T-0063 시점) 는 entity 5/11 박제 기준. Group + Part CRUD-U 4-layer 박제 후 (entity 73%) 의 refresh:

| backbone                                   | refresh estimate task 수                         | 박제 변경 사유                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User + AuthModule + ADR-0008               | ~3 task                                          | 변경 0 (Group + Part CRUD-U 박제와 무관, P3 잔여 핵심 layer)                                                                                                                                                                                   |
| Assessment + Contribution + Summary entity | ~3 task                                          | ~5 → ~3 축소 (cap-bend 14 회차 누적 평균 +41% 안정화 considering, Assessment N:M 박제 - inline-amend × 0.4 sub-multiplier reuse 가능. raw 미저장 R-59 schema-level 강제는 별도 task 분리 안 함 — Assessment entity 박제 task 안에서 동반 박제) |
| ADR-0005 cross-cutting                     | ~0 task (별도 doc-only direct, 본 task chain 외) | 변경 0                                                                                                                                                                                                                                         |
| ADR-0006 LLM key + ADR-0007 audit log      | ~0 task (P4 와 병행)                             | 변경 0                                                                                                                                                                                                                                         |
| **합계**                                   | **~5~6 task**                                    | cap-bend 14 회차 누적 평균 +41% considering 시 actual ~7~9 task estimate                                                                                                                                                                       |

옵션 (b) strict-completion ~17 task estimate 표 + 옵션 (a) eager-transition 0 task 표 는 변경 0 — invariant 유지. 옵션 (b) 의 entity 진척 11/11 까지 잔여는 entity 8/11 박제 후에도 잔여 3 entity (User + Assessment + Contribution) + Summary + LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord 7 entity 박제 estimate ~17 task 의 식 자체는 변경 없음 (옵션 (b) 자체의 estimate 식 invariant).

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
- 본 doc §2.6 + §4.1 + §5 session #22 시점 refresh 머지 commit SHA — T-0076 머지 후 driver bookkeeping 단계에서 갱신.
- [docs/tasks/T-0066-group-update-dto-and-repository.md](../tasks/T-0066-group-update-dto-and-repository.md) ~ [docs/tasks/T-0068-group-controller-update.md](../tasks/T-0068-group-controller-update.md) — Group CRUD-U 4-layer 박제 task chain (session #20).
- [docs/tasks/T-0069-part-update-dto-and-repository.md](../tasks/T-0069-part-update-dto-and-repository.md) + [docs/tasks/T-0071-part-service-update.md](../tasks/T-0071-part-service-update.md) + [docs/tasks/T-0075-part-controller-update.md](../tasks/T-0075-part-controller-update.md) — Part CRUD-U 4-layer 박제 task chain (session #20 + session #22).
- [docs/architecture/estimate-model.md](estimate-model.md) §2.4 cap-bend 14 회차 milestone + §3.2.2 inline-amend × 0.4 sub-multiplier — 본 task 의 권장 강화 박제 기반.

Refs: T-0076, T-0075, T-0074, T-0073, T-0072, T-0071, T-0070, T-0069, T-0068, T-0067, T-0066, T-0063, T-0062, T-0061, T-0060, T-0059, T-0058, T-0057, T-0056, T-0055, T-0054, T-0053, T-0052, T-0051, T-0050, T-0049, T-0048, T-0047, T-0046, T-0045, T-0044, T-0043, T-0042, T-0041, T-0040, T-0039, T-0038, T-0037, T-0036, T-0035, T-0034, T-0033, T-0032, ADR-0001, ADR-0002, ADR-0003, ADR-0004, REQ-051, REQ-057, REQ-058, REQ-028
