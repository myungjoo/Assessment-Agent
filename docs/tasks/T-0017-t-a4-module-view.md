---
id: T-0017
title: T-A4 — Module view (modules.md 신설 + NestJS 8 module 구조 + 의존성 acyclic + components ↔ modules mapping)
phase: P1
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-015, REQ-026, REQ-038, REQ-039, REQ-044, REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 180
estimatedFiles: 4
created: 2026-05-24
plannerNote: P1 T-A4 — modules.md 신설 (NestJS 8 module 구조 + 의존성 acyclic + components ↔ modules mapping). T-A4 머지 시 Phase P1 완료 → P2 진입. pr-mode doc-only.
dependsOn: [T-0016]
blocks: [P2-Entry]
hqOrigin: null
---

# T-0017 — T-A4 Module view (modules.md 신설)

## Why

[docs/PLAN.md](../PLAN.md) Phase P1 의 T-A4 (Module view) 는 [T-0016](T-0016-t-a3-component-view.md) 의 component 분해도를 **NestJS module class** 로 mapping 하고, module 간 **의존성 방향 acyclic** 을 박제하는 task 다. T-A1 (requirements.md kind 컬럼) / T-A2 (deployment.md + ADR-0002 + ADR-0003) / T-A3 (components.md) 까지 완료되어 P1 의 마지막 architecture document 만 남았다 — 본 task 가 머지되면 **Phase P1 (Architecture / MVA) 가 전체 완료** 되어 P2 (Use case decomposition) 진입이 가능해진다.

본 task 가 박제하는 module 분해도는 다음 task 들의 기반:

- **P2 Use case decomposition**: 각 use case 가 본 task 의 어느 module 을 거치는지 sequence diagram / 텍스트로 표현 — module 명이 use case 본문에 직접 인용된다.
- **P2 directory.md**: NestJS 표준 디렉토리 구조 (src/<module>/...) 가 본 task 의 module 분해를 그대로 file system 으로 mapping.
- **P3 Persistence / Auth / Domain core**: AssessmentModule / UserModule / AuthModule 의 구체 service / controller class 가 본 task 의 module 책임 정의에 기반.
- **P4 External integrations**: GithubModule / ConfluenceModule / LlmModule 의 구체 adapter class 가 본 task 의 module 책임 정의에 기반.
- **P7 Scheduling**: SchedulerModule 의 구체 `@Cron` handler 가 본 task 의 module 책임 정의에 기반.
- **P6 Web UI**: WebModule (또는 분리된 frontend 패키지) 가 본 task 의 module 책임 정의에 기반.

본 task 가 cover 하는 REQ ([docs/requirements.md](../requirements.md) 기준):

- **REQ-005 / REQ-006 / REQ-007** — 3 GitHub instance — GithubModule 의 motivation. T-0016 의 GithubAdapter component (단일 + sub-config) 를 GithubModule 의 책임으로 mapping.
- **REQ-015** — Confluence 지정 SPACE 평가 — ConfluenceModule 의 motivation.
- **REQ-026** — 인원 CRUD + Deactivate/Activate — UserModule 의 책임 범위.
- **REQ-038** — 조회 / sort / filter / 시계열 시각화 — WebModule + AssessmentModule 의 협력.
- **REQ-039** — Admin cron 주기 지정 — SchedulerModule 의 motivation.
- **REQ-044** — 3 권한 등급 (SuperAdmin / Admin / User) — AuthModule 의 RBAC 책임.
- **REQ-049 / REQ-051~055** — 5 LLM provider 추상화 + Admin LLM 모델 지정 — LlmModule 의 motivation.

## Required Reading

- [docs/PLAN.md](../PLAN.md) — Phase P1 L43-66 (T-A1 ~ T-A4 의 진행 상태 + T-A4 의 scope L62-66 + P2 진입 조건).
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 목록 + MVA 원칙 + 본 task 가 채울 modules.md 행.
- [docs/architecture/components.md](../architecture/components.md) — T-A3 산출물 (T-0016 머지). 본 task 의 module 분해는 본 component 분해의 1:N / N:1 mapping 이다 — 8 component (Web UI / Backend API / Worker / DB Persistence / LLM Gateway / GitHub Adapter / Confluence Adapter / Scheduler) 와 8 module 의 책임 alignment.
- [docs/architecture/deployment.md](../architecture/deployment.md) — T-A2 산출물 (ADR-0003 monolithic 결정). 본 task 의 8 module 은 **모두 동일 NestJS process 안의 module** 이다.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS module 시스템 결정 (`@Module` decorator + DI container). 본 task 의 module 분할 메커니즘 기반.
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — Prisma + PostgreSQL 결정. DB Persistence 가 별도 module (예: PersistenceModule 또는 PrismaModule) 인지 / 다른 module 의 provider 인지 결정 시 참고.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic / @nestjs/config / @nestjs/schedule / direct egress 4 결정. SchedulerModule (@nestjs/schedule) / ConfigModule 의 위치 결정 시 참고.
- [docs/requirements.md](../requirements.md) — REQ-005~007 / REQ-015 / REQ-026 / REQ-038 / REQ-039 / REQ-044 / REQ-049 / REQ-051~055 row — 본 task 의 coversReq 의 출처.
- [docs/tasks/T-0016-t-a3-component-view.md](T-0016-t-a3-component-view.md) — T-A3 의 frontmatter / Why / Acceptance Criteria 양식 참조. 본 task 의 pattern 을 그대로 따른다 (doc-only pr-mode + mermaid 다이어그램 + table + cross-reference).

## Acceptance Criteria

1. **[docs/architecture/modules.md](../architecture/modules.md) 신설** — 한국어 본문 (≥120 줄 / ≤200 줄). 다음 5 section 을 모두 포함:
   - **개요** — 본 문서가 component 분해도 (T-A3) 를 NestJS module 로 mapping 한다는 명시 + MVA 원칙 (구체 service class / 메서드 시그니처는 P3+ 범위 밖) + 본 문서가 living document 임 명시.
   - **Module 목록** — 8 NestJS module 의 책임 표 (`module | 책임 | 주요 dependency | 관련 component | 관련 REQ | 관련 ADR`). 8 module: **AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule**. 각 module 의 책임은 1~2 줄 (구체 service class / endpoint 는 P3+ 범위 밖 명시).
   - **의존성 그래프 (mermaid)** — module 간 import 방향을 mermaid `graph TB` 또는 `graph LR` 로. NestJS 의 `imports: [...]` 방향이 화살표 방향. acyclic 여야 함 (cycle 발견 시 본 task 에서 해소 — 가장 흔한 패턴: shared module 또는 forwardRef 회피 위해 dependency direction 재배치).
   - **Acyclic 검증** — module dependency 의 topological order 한 줄 (예: `Auth → Persistence → User → Github/Confluence/Llm → Assessment → Scheduler → Web → AppModule`) + 표 또는 텍스트로 "어떤 module 이 어떤 module 을 import 하지 않는가" 의 명시. 만약 본 task 진행 중 cycle 발견 시 dependency direction 조정 + 결정 근거 인라인 박제.
   - **Components ↔ Modules mapping** — T-0016 의 8 component 와 본 task 의 8 module 의 mapping 표. 예시 매핑 (architect 가 task 진행 중 확정):
     - Web UI component → WebModule
     - Backend API component → AssessmentModule + UserModule + AuthModule (entry point 분산)
     - Worker component → AssessmentModule (평가 service layer)
     - DB Persistence component → (별도 PersistenceModule 또는 각 module 의 PrismaService provider — architect 결정)
     - LLM Gateway component → LlmModule
     - GitHub Adapter component → GithubModule
     - Confluence Adapter component → ConfluenceModule
     - Scheduler component → SchedulerModule
   - **References** — ADR-0001 / ADR-0002 / ADR-0003 / components.md / deployment.md / INDEX.md / README.md L7-128 (관련 REQ row) cross-link.
2. **8 NestJS module 모두 명시** — AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule. 각 module 의 책임 + 주요 dependency + 관련 component + 관련 REQ 가 표 row 1 개씩 채워짐. 누락 0.
3. **의존성 mermaid diagram + acyclic 검증** — mermaid graph 가 GitHub 의 native renderer 로 정상 표시 (T-0016 의 components.md mermaid 와 동일 syntax). cycle 0 — topological order 한 줄로 박제. cycle 발견 시 본 task 에서 dependency direction 조정 후 결정 근거 인라인 박제 (별도 ADR 신설 불필요 — 본 task 본문 박제로 충분).
4. **Components ↔ Modules mapping 표** — T-0016 의 8 component (Web UI / Backend API / Worker / DB Persistence / LLM Gateway / GitHub Adapter / Confluence Adapter / Scheduler) 와 본 task 의 8 module 간 N:N 또는 1:N mapping 이 표 row 로 박제. mapping 누락 0.
5. **[docs/architecture/INDEX.md](../architecture/INDEX.md) 갱신** — modules.md 행의 상태 컬럼을 "미작성" → "완료 (T-0017)" 로 변경. 다른 행은 손대지 않음.
6. **[docs/PLAN.md](../PLAN.md) Phase P1 의 T-A4 bullet (L62-66) 의 closure 표시** — `[ ]` → `[x]` 변경 + T-0017 PR 번호 / merge SHA 인라인 박제. T-A4 머지로 P1 phase 가 전체 완료됨을 P1 마무리 단락에 박제 (예: "**Phase P1 완료**. P2 (Use case decomposition) 진입 가능.").
7. **production code 0 LOC** — `src/`, `web/`, `test/`, `package.json`, lockfile, `.github/workflows/` 모두 untouched. 본 task 는 doc-only pr-mode commit (CLAUDE.md §3.1 분기 4 — 새 architecture doc 추가는 pr-mode).
8. **신규 dependency 0** — package.json / pnpm-lock.yaml untouched. ADR-0001 / ADR-0002 / ADR-0003 결정 안에서만 module 분할.
9. **R-110 (CLAUDE.md §3.2)** — pr-mode 이므로 architect → tester sequence 필수. production code 0 LOC 이지만 `pnpm lint && pnpm build && pnpm test` 실행 결과를 tester 가 commit message 의 TESTER trail section 에 박제 (CI 7 step 과 동일 — unit + smoke + e2e + lint + build + spec-check + coverage).
10. **R-112 (CLAUDE.md §3.2)** — production code 변경 0 LOC 이므로 R-112 (happy/error/branch/negative unit test) 는 본질적으로 **N/A**. tester 가 commit message TESTER trail 의 `notes:` 에 "production code 0 LOC, R-112 N/A — doc-only" 명시.
11. **분기 없음 — Acceptance Criteria 의 분기 분리 항목 생략 가능** (CLAUDE.md §planner 의 4번 항목 면제 — 본 task 는 doc-only 라 분기 없음).
12. **CI 7 step 모두 green** — push 후 CI conclusion = success 확인. 7 step: lint / build / spec-check / unit test / smoke test / e2e test / coverage.

## Out of Scope

- **실제 NestJS module class 코드 작성** — `src/<module>/<module>.module.ts` 파일 추가는 본 task 범위 밖. P3+ 의 각 phase task 가 module class 를 신설. 본 task 는 architecture document (modules.md) 만.
- **각 module 의 service / controller / provider 클래스 시그니처** — 본 task 는 module 책임 분해까지만. service class 명 / 메서드 시그니처는 implementer 책임 (P3+).
- **Frontend module (WebModule) 의 내부 구조** — React / Vue / Vite 선택은 P6 진입 시 별도 ADR. 본 task 는 WebModule 의 책임 범위만 (frontend SPA 의 backend 호출 진입점) 박제.
- **데이터 모델 / API endpoint schema** — P2 directory.md / api.md / data-model.md 의 책임. 본 task 의 8 module 표는 책임 분해까지만.
- **Use case 분해** — P2 의 책임. 본 task 는 module 분해만, 각 use case 가 어느 module 을 거치는지는 P2 use case decomposition 의 task 들이 다룬다.
- **추가 ADR 신설** — module 분해 결정에 외부 dependency / 운영 토폴로지 / 데이터 모델 영향이 없으므로 별도 ADR 불필요. 만약 architect 가 cycle 해소 위해 의미 있는 module 분할 결정을 내리면 본 문서 본문에 인라인 박제 (T-0016 의 "GitHub Adapter — 3 instance 묶음 결정" sub-section 패턴과 동일). 향후 module 분할 정책 변경 시 ADR-0004+ 신설.
- **smoke / e2e test 신설** — production code 변경 0 LOC 이므로 신설 불필요. R-113 의 smoke/e2e 인프라는 T-0009/T-0010 으로 이미 main 진입 — 본 task 는 그 인프라 위에서 단순히 CI green 만 요구.

## Suggested Sub-agents

`architect → tester`. architect 가 modules.md 신설 + INDEX.md / PLAN.md 갱신 + module dependency 의 acyclic 검증. tester 는 production code 0 LOC 검증 + `pnpm lint && pnpm build && pnpm test` 실행 (모두 noop 또는 unchanged baseline 통과 예상) + CI 7 step green 확인.

본 task 는 production code 0 LOC 이므로 implementer 호출 불필요. T-0014 / T-0015 / T-0016 의 doc-only pr-mode 와 동일 패턴.

## Follow-ups

(빈 상태 — sub-agent 가 작업 중 발견한 follow-up 을 본 섹션에 append. 본 task 자체에서 즉시 고치지 않는다 — CLAUDE.md §3.)

## Notes

- **본 task 머지 = Phase P1 (Architecture / MVA) 전체 완료** — P0 → P0.5 → P1 의 3 phase 가 모두 main 에 박힘. 다음 phase 는 P2 (Use case decomposition) 로, P1-Entry 와 유사한 P2-Entry task 가 planner 의 다음 호출에서 생성될 가능성이 높다.
- **module 분할의 진화** — 본 task 의 8 module 은 MVA 수준의 박제. P3+ 진행 중 module 의 크기가 비대해지면 sub-module 분할 또는 shared module 도입 등 결정이 ADR-NN 으로 박제될 수 있다. 본 task 의 modules.md 는 living document — 그 결정에 따라 갱신.
- **module 명 convention** — `<Domain>Module` (PascalCase) 으로 통일. NestJS 표준 convention. directory 명은 `src/<domain>/<domain>.module.ts` 패턴 (P2 directory.md 에서 박제).
- **DB Persistence module 의 위치** — architect 가 task 진행 중 결정. 후보: (a) 별도 `PersistenceModule` 또는 `PrismaModule` 로 분리 + 각 domain module 이 import; (b) 각 domain module 이 직접 PrismaService provider 보유 (NestJS Prisma 권장 패턴 중 하나). (a) 가 일반적이지만 (b) 도 valid. acyclic 의존성 그래프에 영향이 큰 결정이므로 architect 가 결정 근거를 modules.md 본문에 박제.
- **WebModule 의 분리 가능성** — frontend 가 별도 패키지 (예: `web/`) 로 분리될 가능성이 높지만 (P6 ADR), 본 task 시점에서는 backend 안의 module 표현으로 두고, P6 진입 시 별도 패키지 분리 ADR 작성 가능성을 본 문서의 References 또는 Notes 에 1 줄 박제.
