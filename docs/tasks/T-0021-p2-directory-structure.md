---
id: T-0021
title: P2-Directory — docs/architecture/directory.md 신설 (NestJS 표준 디렉토리 구조 + 8 module ↔ src/<module>/ mapping)
phase: P2
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-05-25
plannerNote: P2 architecture closure — modules.md (T-0017) 의 8 module 을 NestJS 표준 src/<module>/ 디렉토리로 mapping 박제. P3+ Persistence/Auth/Domain core 진입 전 src/ blueprint 완성.
dependsOn: [T-0017]
blocks: []
hqOrigin: null
---

# T-0021 — P2-Directory: docs/architecture/directory.md 신설

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 마지막 sub-bullet **"디렉토리 구조 정의 — [docs/architecture/directory.md](../architecture/directory.md). NestJS 표준 + module view 와 mapping"** (L87) 의 closure task. T-0017 ([modules.md](../architecture/modules.md)) 가 박제한 NestJS 8 module (AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule + PersistenceModule = 9 actual) 을 그대로 **NestJS 표준 디렉토리 구조** (`src/<module>/<module>.module.ts` + `<module>.controller.ts` + `<module>.service.ts` + `dto/` + `entities/`) 로 mapping 박제한다.

본 task 가 P2 의 architecture closure 인 이유:

1. **modules.md 와 components.md 가 "무엇이 있는가" / "어떻게 묶이는가" 를 박제**, 본 directory.md 가 "**어디에 코드가 위치하는가**" 의 단일 source of truth 가 된다. P3 (Domain core) 의 첫 implementer 가 `src/auth/auth.module.ts` 를 만들 때 본 문서가 답을 미리 갖고 있어야 over-design / re-decide cost 없음.
2. **P3+ 의 모든 implementer task 가 본 문서를 Required Reading 으로 참조** — directory 가 박제되어 있으면 NestJS 의 CLI generator (`nest g module ...`) default 와 본 프로젝트의 convention 차이를 매번 결정할 필요 없음.
3. **MVA 원칙** (INDEX.md §MVA) 에 맞춰 구체 service class / 메서드 시그니처 / file-by-file 디렉토리 트리는 본 문서 범위 밖 — module 단위 디렉토리 + 표준 sub-dir + top-level src/ 트리 + common/config/test layout 까지만.
4. 본 task 이후 **api.md / data-model.md** (P2 의 나머지 2 sub-bullet) 만 남으면 P2 가 완료된다. directory.md 가 먼저 박제되면 api.md / data-model.md 가 endpoint URL / entity 위치를 본 문서에 참조 가능.

본 task 는 새 `docs/architecture/*` 파일 추가이므로 CLAUDE.md §3.1 의 `pr` 카테고리 — reviewer 합의 + CI green 필요.

`coversReq: [TBD]` — directory layout 결정은 직접 cover 하는 functional REQ 가 없는 architecture document 이며, 간접적으로 모든 module 의 REQ 를 받쳐주는 infrastructure. P1 entry req mapping 의 follow-up 으로 본 task 의 REQ 매핑은 후속 architect 가 P3 진입 시 재검토 (현재 P1-Entry req mapping 표가 architecture document 자체의 REQ 매핑 컬럼을 따로 만들지 않으므로 `TBD` 가 적절).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 마지막 sub-bullet "디렉토리 구조 정의")
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — 본 디렉토리의 문서 목록 / MVA 원칙 / ADR 매핑 (본 task 가 directory.md row 의 status 를 미작성 → 완료 로 갱신)
- [docs/architecture/modules.md](../architecture/modules.md) — 8 module + PersistenceModule = 9 module 의 책임 표 + dependency graph + components ↔ modules mapping (본 task 의 mapping source)
- [docs/architecture/components.md](../architecture/components.md) — 8 component 의 책임 + contract (참조용, mapping 의 검증 source)
- [docs/architecture/deployment.md](../architecture/deployment.md) — monolithic NestJS 결정 (ADR-0003 §1) 가 본 directory 의 단일 `src/` root 를 정당화
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TS / pnpm / Jest 선택 (본 directory 구조의 framework 기반)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (Prisma schema 위치 결정의 source)
- [README.md](../../README.md) L7-22 (assessment target / role overview — directory naming hint), L96-103 (LLM provider — `llm/providers/<name>.adapter.ts` sub-dir 결정의 source)
- [docs/tasks/T-0017-t-a4-module-view.md](T-0017-t-a4-module-view.md) — modules.md 의 생성 task. style / 깊이 reference.

이 외에 src/ 디렉토리 자체는 본 task 시점에 NestJS skeleton 만 존재 (T-0004 가 박제) — `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, `src/main.ts` + sanity test. 실제 module 디렉토리는 P3+ 에서 생성. 본 task 의 directory.md 는 그 **미래의 디렉토리 구조** 를 박제하는 blueprint.

## Acceptance Criteria

### 1. docs/architecture/directory.md 신설

- [ ] `docs/architecture/directory.md` 신설. 한국어 본문 ≥ 60 줄 / ≤ 150 줄 (MVA 원칙 — overly-detailed 회피). 다음 section 을 본 순서로 포함:
  - **개요** — 1~2 단락. NestJS 표준 디렉토리 convention + 본 프로젝트 적용 원칙 (modules.md 의 9 module 을 그대로 1 module = 1 디렉토리 로 mapping). ADR-0001 (NestJS) / ADR-0003 §1 (monolithic) 의 결정이 본 디렉토리 구조의 기반임을 명시.
  - **Top-level 디렉토리 트리** — text tree block (` ``` ` fenced) 으로 `src/` 의 직접 하위만. 9 module 디렉토리 + `common/` + `config/` + `prisma/` (Prisma schema) + `main.ts` + `app.module.ts`. 깊이 2 단까지.
  - **각 module 디렉토리의 표준 sub-structure** — 표 또는 nested list. 각 NestJS module 디렉토리의 표준 sub-dir 및 파일 (`<module>.module.ts` / `<module>.controller.ts` / `<module>.service.ts` / `dto/` / `entities/` / `guards/` (AuthModule) / `providers/` (LlmModule) / `adapters/` (Github/Confluence)). PersistenceModule 의 `prisma.service.ts` / Prisma client wrapper / repository pattern 위치도.
  - **9 module 별 디렉토리 mapping 표** — module name / 디렉토리 경로 / 표준 sub-dir / 비고 (3 컬럼 또는 4 컬럼). modules.md 의 module 목록과 1:1 일치 검증.
  - **common/ shared utilities** — `common/decorators/` / `common/filters/` / `common/interceptors/` / `common/pipes/` / `common/dto/` 의 NestJS 표준 위치. 본 프로젝트가 채택할 minimum 만 박제 (실제 채택은 P3+ 에서).
  - **config/** — `config/configuration.ts` + `.env` 처리 (ADR-0003 §2 secret env-only 결정 참조). `@nestjs/config` 사용 default.
  - **prisma/** — `prisma/schema.prisma` (Prisma schema) + `prisma/migrations/` (Prisma migration 자동 생성). ADR-0002 의 결정 박제.
  - **test/ layout** — unit test 는 `*.spec.ts` 를 production code 와 co-locate (NestJS default), e2e 는 `test/e2e/*.e2e-spec.ts`, smoke 는 `test/smoke/*.smoke-spec.ts` 위치. T-0009 / T-0010 의 future task 와 정합.
  - **Frontend (web/) 의 위치** — modules.md 의 WebModule 단락이 박제한 옵션 2 가지 (NestJS 내부 정적 자산 serve / 별도 `web/` 패키지) 중 default 가정의 디렉토리 위치 1~2 줄. 본 결정은 P6 ADR 로 위임 명시.
  - **References** — modules.md / components.md / deployment.md / ADR-0001 / ADR-0002 / ADR-0003 / INDEX.md / README L7-22, L96-103 / 본 task 파일 링크. Refs 라인 끝에 `T-0021`.

### 2. directory tree ↔ modules.md 의 9 module 정확 일치

- [ ] directory.md 의 9 module 디렉토리 (`src/auth/`, `src/persistence/`, `src/user/`, `src/github/`, `src/confluence/`, `src/llm/`, `src/assessment/`, `src/scheduler/`, `src/web/`) 가 modules.md 의 9 module 명과 정확 일치 (대소문자·복수형 정합). modules.md 의 module 명이 `<Name>Module` (PascalCase) 일 때 directory.md 의 디렉토리는 `<name>/` (lowercase singular) — NestJS CLI 의 `nest g module <name>` default convention 따름.
- [ ] modules.md 가 박제한 dependency 방향 (예: AssessmentModule → GithubModule 의 import) 이 directory.md 의 sub-structure 표현에 영향 없음을 명시 (디렉토리 위치는 import 방향과 독립).

### 3. INDEX.md 갱신

- [ ] [docs/architecture/INDEX.md](../architecture/INDEX.md) 의 directory.md row 의 `상태` 컬럼: `미작성` → `완료 (T-0021)`.
- [ ] 필요 시 INDEX.md 의 `생성 task` 컬럼: `P2 use case decomposition 후` → `P2 (T-0021)` 갱신 (보존된 placeholder 갱신).

### 4. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) L87 의 directory.md bullet 의 marker `[ ]` → `[x]`. 본문 끝에 "T-0021 으로 박제 완료" inline 추가.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, lint 영향 없음 — sanity).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 분기 없음 생략 룰 적용).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 90 LOC / estimatedFiles 4 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안.
- [ ] 변경 파일: `docs/architecture/directory.md` (신설) + `docs/architecture/INDEX.md` (status / 생성 task) + `docs/PLAN.md` (L87 marker) + 본 task 파일 (status DONE 갱신은 driver/integrator) = 4 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019 / T-0020 의 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step + comment-deadlock rerun pattern 적용).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 docs/architecture/directory.md 신설 + INDEX.md / PLAN.md 갱신만 수행. 다음은 별도 task:

- **실제 src/<module>/ 디렉토리 생성 또는 dummy 파일** — P3 (Domain core) 의 첫 implementer task 책임. 본 task 는 blueprint 만.
- **UC-02 ~ UC-08 본문 분해** — 후속 P2 sub-task (T-0022~T-0028 예상). UC-01 (T-0020) 의 template 패턴을 따른다.
- **api.md 신설** — P2 의 별도 task. directory.md 의 controller 위치 박제가 api.md 의 endpoint URL grouping 의 input.
- **data-model.md 신설** — P2 의 별도 task. directory.md 의 entity 위치 (`<module>/entities/`) 박제가 data-model.md 의 entity name spacing 의 input.
- **Prisma schema 본문 정의** — P3 (Domain core) / P4 (External integrations) 범위. 본 task 는 `prisma/schema.prisma` 의 *위치* 만 박제 — *내용* 은 별도.
- **Frontend (web/) 의 실제 디렉토리 구조** — P6 (Web UI) 범위. 본 task 는 WebModule 의 backend-side 위치 (`src/web/`) 와 별도 web/ 패키지 옵션 2 가지의 *존재* 만 명시.
- **common/ sub-dir 의 실제 코드 작성** — P3+ 의 incidental. 본 task 는 common/ 의 *표준 sub-dir 목록* (decorators/filters/interceptors/pipes/dto) 만 박제.
- **CI 의 directory 구조 lint** (예: madge / eslint-plugin-boundaries) — modules.md L152 에서 위임된 future task. 본 task 범위 밖.
- **T-0019 review 의 나머지 MINOR follow-up** (modules.md "8 vs 9" 카운트 / PLAN.md `[~]` vs AC `[x]` / UC-08 actor 길이) — 본 task 가 modules.md 의 9 module (PersistenceModule 포함) 을 directory 에 mapping 하면서 "9 module" 명시 — 그 결과 modules.md 의 "8 vs 9" 카운트 불일치 follow-up 은 본 task 의 incidental clarification 으로 자연스럽게 부분 해소 가능 (강제 아님; 별도 patch 가 더 깔끔하면 별도 task).

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: directory.md 의 outline 결정 — section 별 한 줄 요약 + 9 module 의 디렉토리 매핑 표 (mapping spec) + top-level src/ 트리의 깊이·범위 결정 + common/config/prisma/test layout 의 NestJS 표준 vs 본 프로젝트 채택 minimum 차이 + WebModule 위치 옵션 2 가지의 default 결정. ADR 신설 미필요 (directory layout 은 stack/deployment ADR 의 follow-through, 별도 결정 아님).
- **implementer**: architect 의 outline 을 따라 directory.md 신설 + INDEX.md / PLAN.md 갱신. text tree block + mapping 표 작성. modules.md 와 cross-reference 정합 확인 (9 module 명 정확 일치). PR 본문에 task link + Acceptance Criteria checklist.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). INDEX.md / PLAN.md / modules.md / directory.md 간 link 무결성 확인 (modules.md 의 9 module 명 ↔ directory.md 의 9 디렉토리 명 1:1 정합 검증).

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)
