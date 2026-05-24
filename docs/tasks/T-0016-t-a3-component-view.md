---
id: T-0016
title: T-A3 — Component view (components.md 신설 + mermaid + 8 component table + contracts)
phase: P1
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-015, REQ-026, REQ-038, REQ-044, REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-05-24
plannerNote: P1 T-A3 — components.md 신설 (mermaid + 8 component table + contracts). T-A4 (modules.md) 의 선행. pr-mode doc-only.
dependsOn: [T-0015]
blocks: [T-A4]
hqOrigin: null
---

# T-0016 — T-A3 Component view (components.md 신설)

## Why

[docs/PLAN.md](../PLAN.md) Phase P1 의 T-A3 (Component view) 는 시스템을 **component 단위로 분해**하고, 각 component 의 책임 / 입출력 contract / 외부 시스템과의 경계를 박제하는 task 다. T-A2 (T-0014 + T-0015 = ADR-0002 + ADR-0003) 가 **deployment 토폴로지** (단일 NestJS process / PostgreSQL / @nestjs/config / @nestjs/schedule / direct egress) 를 박제했으므로, 본 task 는 그 process 안에 어떤 component 가 들어가는지의 **논리적 분해도** 를 만든다.

T-A3 가 만들어 둔 component 분해도는 다음 task 들의 기반:

- **T-A4 (T-NNNN, blocks 본 task 의 후속)**: NestJS module 구조 (AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule) 가 본 task 의 component 분해를 NestJS module class 로 mapping.
- **P2 use case decomposition**: 각 use case 가 본 task 의 어느 component 를 거치는지 sequence diagram / 텍스트로 표현.
- **P3 Persistence layer**: DB Persistence component 의 책임 범위 (Prisma schema + repository pattern) 가 본 task 의 component 정의에 기반.
- **P4 외부 통합**: GitHub Adapter (3 instance) / Confluence Adapter / LLM Gateway component 의 구체 service class 가 본 task 의 contract 정의에 기반.

본 task 가 cover 하는 REQ ([docs/requirements.md](../requirements.md) 기준):

- **REQ-005 / REQ-006 / REQ-007** — 3 GitHub instance — GitHub Adapter component 의 motivation. 3 instance 를 단일 component (multi-tenant adapter) 로 묶을지 / 3 sub-component 로 분리할지의 결정도 본 task 가 박제.
- **REQ-015** — Confluence 지정 SPACE 평가 — Confluence Adapter component 의 motivation.
- **REQ-026** — 인원 CRUD + Deactivate/Activate — Backend API 의 User domain 책임 범위.
- **REQ-038** — UI 조회 / sort / filter / 시계열 — Web UI ↔ Backend API contract 의 motivation.
- **REQ-044** — SuperAdmin / Admin / User 3 등급 + 첫 로그인 SuperAdmin — Backend API 의 Auth 책임 범위.
- **REQ-049** — Admin 이 LLM 모델 지정 — LLM Gateway component 의 motivation (5 provider abstraction).
- **REQ-051 ~ REQ-055** — 5 LLM provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI) — LLM Gateway component 의 책임 범위.

본 task 는 **MVA 원칙** ([INDEX.md](../architecture/INDEX.md) 참조) 에 따라:

- 시스템 component 분해 + 각 component 의 **책임 한 문단 + 입출력 contract** 까지만.
- 구체 NestJS module class 시그니처 / service 메서드 시그니처 / API endpoint URL / DB schema 컬럼은 **본 task 의 범위 밖** — 각각 T-A4 / P3 / P2 / P3 phase 의 후속 task.

본 task 는 `commitMode: pr` (architecture document 신설 → reviewer 검토 필요). production code 0 LOC / 신규 dependency 0.

## Required Reading

- [README.md](../../README.md) 6–18 행 (도입 — 3 GitHub instance / Confluence) — REQ-005~007 / REQ-015 의 source.
- [README.md](../../README.md) 19–22 행 (관리자 권한) — REQ-044 의 source.
- [README.md](../../README.md) 68–71 행 (UI 조회·sort·filter·시계열) — REQ-038 의 source.
- [README.md](../../README.md) 96–103 행 (LLM 5 provider) — REQ-049 / REQ-051~055 의 source.
- [README.md](../../README.md) 45–51 행 (인원 CRUD / 서비스별 ID / Group) — REQ-026 의 source.
- [CLAUDE.md](../../CLAUDE.md) §1 (기술 스택 박제) — NestJS 단일 process 전제.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode — 새 architecture doc 신설 = pr).
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-110 ~ R-114 (test/CI 절대 규칙 — 본 task 는 doc-only pr 이므로 R-112 4 종 N/A, R-110 active 로 tester 호출 의무).
- [CLAUDE.md](../../CLAUDE.md) §5 (HITL — 새 외부 dependency 추가 BLOCKED 룰). 본 task 는 dependency 0.
- [CLAUDE.md](../../CLAUDE.md) §12 (한국어 정책 — components.md 본문 / mermaid label 한국어).
- [docs/PLAN.md](../PLAN.md) L43–L75 (Phase P1 섹션) 와 L55–L62 (T-A3 bullet) 와 L63 (T-A4 의존).
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — 본 task 가 components.md 행을 `미작성` → `완료 (T-0016)` 로 갱신.
- [docs/architecture/deployment.md](../architecture/deployment.md) — T-0014 + T-0015 산출물. 본 task 가 component 분해 시 인용 (특히 monolithic 결정 — 모든 component 가 동일 process).
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS 채택.
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma — DB Persistence component 의 기반.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic / secret / scheduler / network — 본 task 의 component 분해와 토폴로지 정합.
- [docs/requirements.md](../requirements.md) L24~L28 (REQ-005~007) / L34 (REQ-015) / L45 (REQ-026) / L57 (REQ-038) / L63 (REQ-044) / L68 (REQ-049) / L70~L74 (REQ-051~055).
- [docs/tasks/T-0014-adr-0002-db-selection.md](T-0014-adr-0002-db-selection.md) 와 [docs/tasks/T-0015-adr-0003-deployment-rest.md](T-0015-adr-0003-deployment-rest.md) — 직전 architecture task 의 schema / 결정 인용 방식 참고.

## Acceptance Criteria

### 산출물 1 — components.md 신설

- [ ] `docs/architecture/components.md` 파일이 신설된다. 본문 한국어 ([CLAUDE.md](../../CLAUDE.md) §12).
- [ ] 문서 첫 단락에 **본 view 의 의도와 MVA 원칙** 1-2 단락 — "component 분해 + 책임 + contract 만, 구체 NestJS module class / service 메서드 시그니처는 T-A4 / P3 의 책임" 명시. [INDEX.md](../architecture/INDEX.md) 의 MVA 원칙 인용 링크.
- [ ] [docs/architecture/deployment.md](../architecture/deployment.md) 와 [ADR-0003](../decisions/ADR-0003-deployment.md) 와 [ADR-0002](../decisions/ADR-0002-db.md) 에 대한 cross-reference 1 단락 — "모든 component 는 ADR-0003 의 monolithic 결정에 따라 동일 NestJS process 안에서 동작" 명시.

### 산출물 2 — Component diagram (mermaid)

- [ ] components.md 안에 mermaid 다이어그램 1 개. 형식: `graph LR` 또는 `graph TB` 중 가독성 좋은 쪽 (architect 가 결정).
- [ ] 다이어그램 노드 — 최소 다음 8 component 모두 포함:
  1. **Web UI** (Frontend)
  2. **Backend API** (NestJS controller / service layer — HTTP API 진입점)
  3. **Worker** (평가 파이프라인 — monolithic 결정에 따라 Backend 와 동일 process 내 service layer 로 표현하되, 논리적 책임 분리 명시)
  4. **DB Persistence** (PostgreSQL + Prisma — ADR-0002 산출물)
  5. **LLM Gateway** (5 provider abstraction — REQ-049/051~055)
  6. **GitHub Adapter** (3 instance — REQ-005~007)
  7. **Confluence Adapter** (REQ-015)
  8. **Scheduler** (@nestjs/schedule in-process — ADR-0003 §3)
- [ ] 다이어그램 화살표 — 주요 contract 표시:
  - Web UI → Backend API (HTTPS REST)
  - Backend API ↔ DB Persistence (sync, Prisma)
  - Backend API → LLM Gateway (sync method call)
  - Backend API → GitHub Adapter / Confluence Adapter (sync method call)
  - Scheduler → Backend API or Worker (in-process trigger)
  - LLM Gateway → 외부 LLM provider 5 종 (HTTPS, async)
  - GitHub Adapter → 외부 GitHub 3 instance (HTTPS)
  - Confluence Adapter → 외부 Confluence (HTTPS)
- [ ] 외부 시스템 (외부 GitHub / Confluence / LLM provider) 은 다른 형태 (예: dashed border / 별도 subgraph) 로 시각적 구분.
- [ ] mermaid label 은 한국어 또는 한국어+영어 혼용 (component 이름 자체는 영어 식별자로 유지, 설명 텍스트만 한국어). [CLAUDE.md](../../CLAUDE.md) §12 의 식별자 영어 / 설명 한국어 원칙.
- [ ] **mermaid 문법 정합성** — GitHub 가 PR 본문 렌더링 시 mermaid 다이어그램이 정상 렌더링됨. reviewer 가 local mermaid live editor (또는 GitHub PR preview) 로 확인.

### 산출물 3 — Component table (8 row)

- [ ] components.md 안에 8 component 의 표 1 개. 컬럼: `component | 책임 | 입력/출력 contract | 관련 REQ | 관련 ADR / 문서`.
- [ ] 각 row 의 책임 컬럼은 1-3 문장 (한국어). contract 컬럼은 sync/async + message format (예: HTTP REST / TypeScript method call / EventEmitter) 명시.
- [ ] 8 row 모두 포함:
  - **Web UI** — REQ-038 (조회/sort/filter/시계열) / REQ-026 (인원 CRUD UI 진입점) / REQ-044 (로그인 / 권한 UI).
  - **Backend API** — REQ-026 / REQ-038 / REQ-044 / REQ-049. Auth / RBAC / 인원 / Group / 평가 조회 endpoint 의 진입점.
  - **Worker** (or 평가 파이프라인 service) — REQ-005~007 / REQ-015 / REQ-049. commit / 문서 / Confluence page 평가 파이프라인.
  - **DB Persistence** — REQ-029 (저장) / REQ-032 (raw 금지) — ADR-0002 / ADR-0003.
  - **LLM Gateway** — REQ-049 / REQ-051~055. 5 provider abstraction interface.
  - **GitHub Adapter** — REQ-005 / REQ-006 / REQ-007. 3 instance 묶음 결정 (산출물 5 참조).
  - **Confluence Adapter** — REQ-015 / REQ-016 (권한 부족 통지 motivation).
  - **Scheduler** — REQ-039 / REQ-040 — cron + manual trigger 단일 진입점.

### 산출물 4 — Contracts 섹션

- [ ] components.md 안에 Contracts 섹션. 표 1 개 — 컬럼: `from | to | sync/async | message format | 비고`.
- [ ] 최소 8 row — 다이어그램의 각 화살표 1 row:
  - Web UI → Backend API (sync, HTTPS REST JSON)
  - Backend API ↔ DB Persistence (sync, Prisma typed query)
  - Backend API → LLM Gateway (sync TypeScript method call, in-process)
  - LLM Gateway → 외부 LLM provider (async, HTTPS REST)
  - Backend API → GitHub Adapter (sync method call)
  - GitHub Adapter → 외부 GitHub (async, HTTPS REST)
  - Backend API → Confluence Adapter (sync method call)
  - Confluence Adapter → 외부 Confluence (async, HTTPS REST)
  - Scheduler → Backend API or Worker (in-process trigger — NestJS @Cron decorator / EventEmitter)
- [ ] 각 row 의 비고에 관련 REQ 또는 ADR 인용 (예: "ADR-0003 §1 monolithic — 동일 process 내 method call").

### 산출물 5 — GitHub Adapter 3 instance 묶음 결정 (sub-section)

- [ ] components.md 안에 별도 sub-section "GitHub Adapter — 3 instance 묶음 vs 분리" — 결정 박제.
- [ ] architect 가 본 task 진행 중 결정 — 다음 2 옵션 중 1:
  - **(a) 단일 component (multi-tenant adapter)** — `GithubAdapter` 1 service 가 instance key (com / sec / ecode) 를 받아 적절한 base URL + token 사용. config 기반 routing.
  - **(b) 3 sub-component** — `GithubComAdapter` / `GithubSecAdapter` / `GithubEcodeAdapter` 3 service. 각각 별도 module 또는 같은 module 내 별도 provider.
- [ ] 결정 + reasoning 3-5 줄 (한국어). 본 결정이 큰 architecture 변경이라 판단되면 architect 가 **ADR-0004 신설을 task Follow-ups 에 제안** — 본 task 안에서 ADR-0004 생성하지 않음 (task split 원칙 — size cap 관리).
- [ ] 기본 권고 (planner 가 박는 default): **(a) 단일 component** — multi-tenant adapter. 3 instance 의 API surface 가 동일 GitHub API spec 이므로 코드 중복 회피, instance 별 config (URL / token) 만 분리. 단 architect 가 (b) 채택 시 Alternatives 단락에 정당화.

### 산출물 6 — References 섹션

- [ ] components.md 끝에 References 섹션. 다음 항목 링크:
  - [ADR-0001](../decisions/ADR-0001-stack.md) (NestJS)
  - [ADR-0002](../decisions/ADR-0002-db.md) (PostgreSQL + Prisma)
  - [ADR-0003](../decisions/ADR-0003-deployment.md) (monolithic / secret / scheduler / network)
  - [docs/requirements.md](../requirements.md) (REQ ID 의 source)
  - [docs/architecture/deployment.md](../architecture/deployment.md) (T-A2 산출물)
  - [docs/architecture/INDEX.md](../architecture/INDEX.md) (architecture document 인덱스)
  - [README.md](../../README.md) 6–18 / 19–22 / 45–51 / 68–71 / 96–103 행 (REQ source)

### 산출물 7 — INDEX.md 갱신

- [ ] `docs/architecture/INDEX.md` L11 의 `components.md ... 미작성` 행을 `완료 (T-0016)` 로 갱신.
- [ ] ADR 매핑 표 (L25~L29) 는 변경 없음 (본 task 는 새 ADR 신설하지 않음 — GitHub Adapter 묶음 결정은 component view 본문에 인라인). 단 architect 가 ADR-0004 채택 시 본 표에 행 추가 (단 그 경우 산출물 5 처럼 별도 task 로 split).

### 산출물 8 — PLAN.md L55 T-A3 closure

- [ ] `docs/PLAN.md` L55 의 T-A3 bullet 의 `[ ]` 표시를 `[x]` 로 변경 + 끝에 closure 메모 `(T-0016, components.md ACCEPTED)` 추가. L56~L62 의 sub-bullet 은 유지.
- [ ] L65 의 "완료 조건" 단락 자연스러운 갱신 — T-A3 완료 반영, 잔여 T-A4 명시.

### 산출물 9 — deployment.md 링크 추가 (선택, 1 줄)

- [ ] `docs/architecture/deployment.md` 의 첫 단락 또는 References 위치에 `[components.md](components.md)` 링크 1 줄 추가. component view 와 deployment view 가 cross-reference 되도록.
- [ ] 본 변경은 5-10 LOC. 산출물 9 가 size cap 부담을 키우면 생략 가능 (architect 판단).

### 산출물 10 — production code 0 LOC + 신규 dependency 0

- [ ] `src/`, `test/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc*`, `.github/workflows/`, `.claude/` 어느 파일도 변경되지 않음. `git diff --name-only HEAD origin/main` 결과가 **4 파일 안** (components.md 신설 + INDEX.md edit + PLAN.md edit + deployment.md edit [선택]).
- [ ] `package.json` 의 `dependencies` / `devDependencies` 변동 0. mermaid 렌더링은 GitHub native — 별도 dependency 없음. **CLAUDE.md §5 BLOCKED 룰을 본 task 가 자체적으로 회피**.

### 산출물 11 — R-110 ~ R-114 CI 검증

- [ ] **R-110**: 본 task 는 `commitMode: pr` 이므로 R-110 active. production code 변경 0 LOC 이지만, tester 는 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` (또는 ci.yml 의 7 step 전부) 를 로컬에서 실행하여 doc 변경이 기존 test 를 깨지 않았음을 확인한다. tester 의 TRAIL 에 `result: pass` 명시.
- [ ] **R-111**: PR push 후 GitHub Actions 가 자동 trigger 되어 CI 의 7 step (lint / build / test:cov / smoke / e2e / spec-presence / spec-presence self-test) 모두 green. integrator 의 3중 게이트 중 "CI green" 검사가 이를 강제.
- [ ] **R-112**: production code 변경 0 LOC 이므로 happy / error / branch / negative 4 종 unit test 추가 **N/A**. PR 본문에 "production code 0 LOC 변경 — R-112 적용 N/A" 명시.
  - 분기 없음 — 이 항목 생략 (R-112 가이드라인의 분기 없음 케이스).
- [ ] **R-113**: smoke + e2e step 이 본 task 의 PR CI 에서 실행되어 green. doc 변경이 기존 smoke/e2e 를 깨지 않음을 검증.
- [ ] **R-114**: integrator 가 squash merge 전에 PR CI 의 latest run conclusion 이 `success` 임을 확인. fail 시 BLOCKED.

### 산출물 12 — reviewer 정책 점검 (§3.3 4-게이트)

- [ ] reviewer agent 가 [README.md](../../README.md) 117–128 8-check 로 검토. 본 task 의 doc 변경이 [CLAUDE.md](../../CLAUDE.md) §12 (한국어 정책 — components.md 본문 한국어) 와 §3.1 (commit mode 표 — architecture doc 신설은 pr) 와 §3 (size cap ≤300 LOC / ≤5 파일) 와 §5 (새 dependency 추가 없음) 모두 준수하는지 확인.
- [ ] reviewer 가 mermaid 다이어그램 문법 정합성 + component table 의 책임 일관성 + contract 표의 sync/async 분류 정합성을 함께 점검.
- [ ] reviewer VERDICT=APPROVE 시 **반드시 `gh pr comment` 로 PR 에 외화**. PR body 에 inline 만 적는 위장 패턴 금지 ([CLAUDE.md](../../CLAUDE.md) §3.3 게이트 2).
- [ ] integrator 가 4-게이트 (reviewer.VERDICT == APPROVE + PR comment 외화 검증 + integrator self-check 통과 + CI green) 모두 만족 후 `gh pr merge --squash --delete-branch`. integrator.md 의 tools 에 Agent 가 ba85ac2 로 추가됐으므로 본 task 가 첫 dogfood — integrator 가 reviewer 를 sub-agent 로 정식 dispatch 가능.

### 정합성 / non-regression

- [ ] components.md 의 8 component 가 [PLAN.md](../PLAN.md) L56~L62 의 component 목록과 정합 (Web UI / Backend API / Worker / DB / LLM Gateway / GitHub Adapter / Confluence Adapter / Scheduler).
- [ ] components.md 의 모든 component 가 monolithic process 안에 있음 — ADR-0003 §1 결정과 정합.
- [ ] component table 의 contract 컬럼이 ADR-0003 §3 (scheduler in-process) 결정과 정합 — 외부 cron 으로 분류된 row 없음.
- [ ] component table 의 LLM Gateway row 가 [ADR-0003](../decisions/ADR-0003-deployment.md) §4 의 5 provider 와 일치.
- [ ] mermaid 다이어그램의 8 node 가 component table 8 row 와 1:1 일치.
- [ ] 본 task DONE 후 STATE.json 의 `mostRecentTasks` 가 [T-0016, T-0015, T-0014, T-0013, T-0010] 로 갱신되고 `counters.tasksCompleted` 가 14→15 로 +1 (driver 책임).

## Out of Scope

- **T-A4 (modules.md)** — NestJS module class 구조 (AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule) 의 의존성 acyclic 검증 + component view 와 mapping. 본 task 의 다음 task 책임.
- **구체 NestJS service class 시그니처 / 메서드 시그니처** — implementer 책임, 각 도입 task.
- **구체 API endpoint URL / HTTP method / schema** — P2 use case decomposition 후 api.md task 책임.
- **DB schema 컬럼 / 인덱스 / Prisma model** — P3 Persistence layer task 책임.
- **Frontend component 트리 (React component / routing / state management)** — P6 Web UI task 책임.
- **LLM provider 5 종의 구체 API 차이 / endpoint / model 식별자** — P4 LLM gateway task 책임.
- **3 GitHub instance 의 구체 URL / token 환경변수 이름** — P4 GitHub adapter task 책임.
- **Authentication / RBAC 모델 구체 흐름** (JWT vs session / 권한 검사 decorator / role hierarchy) — P3 Auth task 책임.
- **실제 패키지 도입** — @nestjs/config / @nestjs/schedule / @nestjs/event-emitter / prisma 등 어느 것도 본 task 가 `pnpm add` 하지 않음. **CLAUDE.md §5 BLOCKED 룰** 대상.
- **ADR-0004 신설** — GitHub Adapter 묶음 결정이 큰 architecture change 로 판단되면 별도 task 로 split. 본 task 는 component view 본문에 인라인 결정만.
- **README.md 본문 갱신** — README 는 source of truth, 본 task 변경 안 함.
- **requirements.md 갱신** — REQ 인용은 함, 새 REQ 추가 없음.
- **mermaid 외 다른 다이어그램 도구** — PlantUML / draw.io 등 사용 안 함 (GitHub native 렌더링 우선).

## Suggested Sub-agents

- **architect**: components.md 작성 (Overview / Component diagram / Component table / Contracts / GitHub Adapter 묶음 결정 / References) + INDEX.md 갱신 + PLAN.md L55 closure + (선택) deployment.md 링크 1 줄. mermaid 다이어그램 직접 작성 + 8 component 의 책임·contract 일관성 점검. GitHub Adapter 묶음 결정 시 default (단일 component) 채택 또는 reasoning 동반한 alternative 채택.
- **implementer**: production code 0 LOC 이므로 호출 안 함. doc 변경만 architect 가 처리.
- **tester**: R-110 ~ R-114 강제. production code 0 LOC 이라도 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 7 step (ci.yml 동일) 모두 로컬 실행 후 green 확인 + TRAIL 작성. mermaid 다이어그램이 GitHub PR 본문에서 정상 렌더링 되는지 PR open 직후 시각적 확인 1 회.

호출 순서: `architect → tester`. (implementer 없음.)

## Follow-ups

비어있음 — sub-agent 가 작업 중 발견한 항목 append. 예: GitHub Adapter (b) 채택 시 ADR-0004 신설 별도 task 제안 / 외부 시스템 별도 view 분리 필요시 별도 task 제안.
