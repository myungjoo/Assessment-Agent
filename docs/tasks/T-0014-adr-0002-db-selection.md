---
id: T-0014
title: ADR-0002 — DB 선택 (PostgreSQL / SQLite / 기타) + deployment.md DB 단락 신설
phase: P1
status: DONE
completedAt: 2026-05-24T20:12:00+09:00
mergedAs: 56a93b0
prNumber: 13
reviewRounds: 1
commitMode: pr
coversReq: [REQ-029, REQ-031, REQ-032, REQ-033, REQ-036, REQ-047, REQ-048]
estimatedDiff: 150
estimatedFiles: 3
actualDiff: 166
actualFiles: 3
created: 2026-05-24
plannerNote: P1 T-A2 split 첫 task — DB 결정만 박제 (ADR-0002 + deployment.md DB 단락). cap 안에서 응집. pr-mode doc-only.
dependsOn: [T-0013]
blocks: [T-0015, T-A3, T-A4]
hqOrigin: null
---

# T-0014 — ADR-0002 DB 선택 + deployment.md DB 단락

## Why

[docs/PLAN.md](../PLAN.md) Phase P1 의 T-A2 (Deployment view) 는 5 결정 항목 (monolith vs worker / **DB** / secret / scheduler / 외부 네트워크 boundary) 을 한 번에 박제하도록 설계됐다. 그러나 5 결정 + deployment.md 신설 + ADR-0002 + ADR-0003 를 합치면 ~300-400 LOC / 4 파일로 [CLAUDE.md](../../CLAUDE.md) §3 의 size cap (≤300 LOC / ≤5 파일) 에 매우 근접한다. 따라서 T-A2 를 **2 task 로 split** 한다:

- **T-0014 (본 task)**: **DB 결정만** — ADR-0002 신설 + deployment.md 의 DB 단락 신설. 나머지 4 결정은 build-up 의 첫 단계가 DB 라서 의존성 chain 상 먼저. ~150 LOC / 3 파일.
- **T-0015 (T-0014 DONE 후 planner 가 큐잉)**: 나머지 4 결정 (monolith / secret / scheduler / network) — ADR-0003 신설 + deployment.md 나머지 단락.

DB 결정은 후속 P3 (Domain core), P4 (External integrations), P5 (Evaluation pipeline) 의 모든 persistence 코드가 따라야 하는 1 차 토대다. 본 task 의 ADR-0002 는 결정과 근거만 박제 — **실제 ORM dependency 도입은 CLAUDE.md §5 의 "새 외부 dependency 추가 BLOCKED 룰" 적용 대상이므로 별도 후속 task** (P3 phase 진입 시) 로 미룬다.

본 task 가 cover 하는 REQ:

- REQ-029 (평가 자료 non-volatile 저장 — durability NFR) — 본 DB 결정의 핵심 동기
- REQ-031 (재수집 중복 방지 + 최근 1주 재수집 OK) — unique constraint / upsert 가능한 schema 형태가 결정에 영향
- REQ-032 (raw data 저장 금지 — 평가 결과만 보유) — schema 가 raw text 컬럼을 갖지 않음
- REQ-033 (commit/문서 별 기여도·난이도·양 보유) — schema 가 row-per-artifact 형태 필요
- REQ-036 (상대 비교 가능 + LLM 정성 + Metric 수치) — orderable / aggregatable schema 필요
- REQ-047 ([README.md](../../README.md) 91 행 — 100-200명 / 50-100 repo / 1000 confluence / 1h 처리량 NFR) — DB write throughput 고려
- REQ-048 ([README.md](../../README.md) 92 행 — 조회 3초 이내 NFR) — DB read latency / index 고려

## Required Reading

- [README.md](../../README.md) 56–64 행 (저장 정책 — non-volatile / export-restore / 재수집 / raw 금지 / 단위 평가 보유)
- [README.md](../../README.md) 88–92 행 (성능 특성 NFR — 1h 처리 + 3초 조회)
- [README.md](../../README.md) 7–12 행 (도입 — 평가·저장·시각화 범위)
- [CLAUDE.md](../../CLAUDE.md) §1 (기술 스택 표 — DB 행 "별도 ADR 로 결정")
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode 표 — 새 ADR 은 pr)
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-110~114 (test/CI 절대 규칙 — 본 task 는 doc-only pr 이라 R-112 4 종 N/A 처리)
- [CLAUDE.md](../../CLAUDE.md) §5 (HITL — 새 외부 dependency 추가 BLOCKED — 본 task 는 결정만, 실제 ORM 도입 안 함)
- [CLAUDE.md](../../CLAUDE.md) §9 (안전장치 — 새 dependency BLOCKED 재강조)
- [docs/PLAN.md](../PLAN.md) L43–L67 (Phase P1 섹션) 과 L99–L106 (P3 Persistence layer 위치)
- [docs/requirements.md](../requirements.md) L48 (REQ-029), L50 (REQ-031), L51 (REQ-032), L52 (REQ-033), L55 (REQ-036), L66 (REQ-047), L67 (REQ-048)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) (ADR 매핑 표 — ADR-0002 는 "미작성, T-A2 또는 T-A2 후속" 으로 이미 예약됨)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (선행 ADR — frontmatter / 본문 schema 참고)

## Acceptance Criteria

### 산출물 1 — ADR-0002 신설

- [ ] `docs/decisions/ADR-0002-db.md` 파일이 신설된다. 파일명 slug 는 `db`.
- [ ] frontmatter: `id: ADR-0002` / `title: <한국어 한 줄>` / `status: ACCEPTED` / `date: 2026-05-24` / `relatedTask: T-0014` / `supersedes: null`. ADR-0001 의 frontmatter schema 와 일치.
- [ ] 본문 구조: **Context / Decision / Consequences / Alternatives** 4 섹션 (ADR-0001 과 동일 schema). 본문은 한국어 (CLAUDE.md §12).
- [ ] **Context**: 본 task 가 cover 하는 7 REQ (REQ-029/031/032/033/036/047/048) 의 근거 요약 + 결정을 지배하는 외력 (README 행 인용, 1-2 줄씩). long-horizon 자율 agent 환경 / single-operator 운영 / agent 친화성 도 언급.
- [ ] **Decision**: 본 task 가 채택하는 DB 1 종 + ORM 1 종 (예: "PostgreSQL via Prisma" 또는 "SQLite via Prisma + 추후 PostgreSQL 마이그레이션 경로") 을 **한 줄로** 명시. 결정 1 줄 다음에 근거 3–5 줄 (R-47/R-48 NFR 충족 가능성 / R-32 raw 저장 금지 schema / R-31 unique-key + upsert 가능성).
- [ ] **Consequences**: 채택의 결과 — 긍정 3-4 항목 (orderable schema / index / migration tooling / community / agent-friendly type) + 부정·trade-off 2-3 항목 (예: PostgreSQL 외부 인스턴스 의존, ORM 도입 별도 task 필요, 추후 sharding 한계 등). 후속 task 가 어떻게 진행될지 1-2 줄 (P3 phase 의 Persistence layer task 가 본 ADR 을 전제로 ORM dependency 추가 task 를 별도 제안).
- [ ] **Alternatives**: 최소 3 개 대안을 표 또는 bullet 으로 비교. 예: PostgreSQL+Prisma / PostgreSQL+TypeORM / SQLite (개발 stage 만) / MongoDB 류 NoSQL / Embedded (PouchDB·LevelDB 등). 각 대안에 R-47/R-48/R-29/R-32 4 NFR/Constraint 적합도와 trade-off 한 줄씩.
- [ ] ADR-0002 의 **Decision 이 SQL/PostgreSQL 류 (orderable / index 가능 schema)** 인 경우 R-47 / R-48 성능 가능성 1 줄 명시 (예: "PostgreSQL 의 B-Tree index 와 partial index 로 REQ-048 3 초 조회 가능"). NoSQL 류 결정 시 명시적 정당화 필요 (왜 SQL 의 orderable 표준을 포기했는가 — README 의 sort/filter 요구 R-38 과의 정합성).
- [ ] ADR-0002 마지막 줄에 `Refs: T-0014, REQ-029, REQ-031, REQ-032, REQ-033, REQ-036, REQ-047, REQ-048` 형식 한 줄.

### 산출물 2 — deployment.md DB 단락 신설

- [ ] `docs/architecture/deployment.md` 파일이 신설된다 (현재 미존재). 본 task 는 **DB 단락만** 채우고, 다른 4 결정 단락 (monolith/worker, secret, scheduler, network) 은 T-0015 가 추가. 본 task 가 만든 파일에는 상단 placeholder 로 "본 문서는 T-A2 의 산출물. T-0014 가 DB 단락만 채움. 나머지 4 결정 단락은 T-0015 에서 추가 예정." 한 줄 안내 명시.
- [ ] 파일 구조 (markdown heading):
  - `# Deployment view` (H1)
  - `## 개요` (H2, 2-3 줄 — MVA 원칙 + 본 문서가 ADR-0002/0003 의 view layer 임을 명시)
  - `## DB / Persistence` (H2) — 본 task 가 채우는 단락
  - `## TBD` 또는 비워둠 — 다른 4 단락 자리. 헤딩만 만들지 본문은 비우는 형태도 OK. (T-0015 가 채움)
- [ ] DB 단락 본문 (~25-35 줄):
  - ADR-0002 의 결정 1 줄 인용 + 링크 (`[ADR-0002](../decisions/ADR-0002-db.md)`)
  - 배포 토폴로지 — DB 인스턴스 위치 (예: "동일 호스트 별도 process / Docker container / external managed service 중 택"). README 의 single-operator 컨텍스트 (CLAUDE.md §1) 고려.
  - Migration 정책 (1-2 줄 — "ORM 의 migration 도구 사용 / 별도 script / TBD" 중 택. 본 task 는 결정 박제만, 도구 도입은 별도 task).
  - Backup / restore 전략 (REQ-030 export/backup 과의 연결 — DB-level dump 가능성 1 줄).
  - Raw data 저장 금지 (REQ-032) 의 schema-level 강제 — column 설계 시 raw text 컬럼 없음을 reviewer 가 검증할 수 있게 정책 한 줄.
- [ ] DB 단락 끝에 후속 task 안내 1 줄 — "schema 컬럼 / index 설계 / migration 도구 도입은 P3 Persistence layer task 에서 진행".

### 산출물 3 — PLAN.md 갱신 + INDEX.md 갱신

- [ ] `docs/PLAN.md` L48 의 T-A1 bullet 을 `[x] T-A1 — ... (T-0013 으로 subsumed: requirements.md kind 컬럼이 채워짐)` 으로 변경. **단 본 task 의 PR 에서 함께 처리하지 않는다** — PLAN.md 갱신은 planner 가 본 task 큐잉 시 doc-only direct commit 으로 별도 처리 (본 task 와 동일 turn 의 planner action 안에 포함). 따라서 본 acceptance 는 **executor 가 PR 작성 직전 main 의 PLAN.md L48 이 `[x]` 처리됐는지 sanity check 만** 한다 (이미 처리됐으면 본 task 는 PLAN.md touch 안 함).
- [ ] `docs/PLAN.md` L49 의 T-A2 bullet 끝에 `(T-0014 = ADR-0002 DB 선택, T-0015 = ADR-0003 나머지 4 결정 — split 진행 중)` 추가. 이 갱신도 위와 같이 planner 의 본 turn doc-only direct commit 에서 처리. executor 는 sanity check 만.
- [ ] `docs/architecture/INDEX.md` L28 의 `ADR-0002 DB (TBD)` 행을 `ADR-0002 DB (...채택...)` 와 status `ACCEPTED (T-0014, <commit-sha>)` 로 갱신. **본 task 의 PR 에 포함** (architect 가 ADR 작성하면서 동시에 INDEX.md 도 갱신해야 정합 유지).
- [ ] `docs/architecture/INDEX.md` L10 의 `deployment.md ... 미작성` 행을 `부분 (T-0014 가 DB 단락만)` 으로 갱신.

### 산출물 4 — production code 0 LOC + 신규 dependency 0

- [ ] `src/`, `test/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc*`, `.github/workflows/`, `.claude/` 어느 파일도 변경되지 않음. `git diff --name-only HEAD origin/main` 결과가 **3 파일** (ADR-0002-db.md / deployment.md / INDEX.md) 또는 **4 파일** (위 3 개 + 본 task 파일 frontmatter status 갱신) 안에 들어옴.
- [ ] `package.json` 의 `dependencies` / `devDependencies` 항목 변동 0. 본 task 가 결정한 ORM 의 패키지가 추가되지 않음. **CLAUDE.md §5 의 BLOCKED 룰을 본 task 가 자체적으로 회피** — 결정만 박제, 실제 도입은 별도 task.

### 산출물 5 — R-110 ~ R-114 CI 검증

- [ ] **R-110**: 본 task 는 `commitMode: pr` 이므로 R-110 active. production code 변경 0 LOC 이지만, tester 는 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 5 단계 (또는 ci.yml 의 step 전부) 를 로컬에서 실행하여 doc 변경이 기존 test 를 깨지 않았음을 확인한다. tester 의 TRAIL 에 `result: pass` 명시.
- [ ] **R-111**: PR push 후 GitHub Actions 가 자동 trigger 되어 CI 의 7 step (lint / build / test:cov / smoke / e2e / spec-presence / spec-presence self-test) 모두 green. integrator 의 3중 게이트 중 "CI green" 검사가 이를 강제.
- [ ] **R-112**: production code 변경 0 LOC 이므로 happy/error/branch/negative 4 종 unit test 추가 **N/A**. PR 본문에 "production code 0 LOC 변경 — R-112 적용 N/A" 명시.
- [ ] **R-113**: smoke + e2e step 이 본 task 의 PR CI 에서 실행되어 green. doc 변경이 기존 smoke/e2e 를 깨지 않음을 검증.
- [ ] **R-114**: integrator 가 squash merge 전에 PR CI 의 latest run conclusion 이 `success` 임을 확인. fail 시 BLOCKED.

### 산출물 6 — reviewer 정책 점검

- [ ] reviewer agent 가 README 117–128 8-check 로 검토. 본 task 의 doc 변경이 [CLAUDE.md](../../CLAUDE.md) §12 (한국어 정책 — ADR 본문 / deployment.md 본문 한국어) 와 §3.1 (commit mode 표 — ADR 은 pr) 와 §3 (size cap ≤300 LOC / ≤5 파일) 와 §5 (새 dependency 추가 없음) 모두 준수하는지 확인.
- [ ] reviewer VERDICT=APPROVE 시 `gh pr comment` 로 PR 에 외화. PR 본문에 inline 만 적는 위장 패턴 금지 (CLAUDE.md §3.3 게이트 2).

### 정합성 / non-regression

- [ ] ADR-0002 의 frontmatter `relatedTask: T-0014` 가 실존하는 본 task ID 를 가리킴.
- [ ] deployment.md 의 mermaid 다이어그램은 본 task 에서 만들지 않음 (T-0015 가 component-level 다이어그램 추가 시 함께 그릴 수 있음). 본 task 는 DB 단락 텍스트만.
- [ ] ADR-0002 의 Alternatives 표가 최소 3 행 (3 대안). 1-2 행이면 비교가 빈약 — reviewer 가 ANOTHER_ROUND.
- [ ] 본 task DONE 후 T-0013 의 frontmatter `blocks: [T-A2, T-A3, T-A4]` 에 본 task ID 가 자연 흡수됨 (`blocks` 갱신은 driver 가 STATE 갱신 시 처리, 본 task 의 acceptance 는 아님).

## Out of Scope

- ADR-0003 작성 (나머지 4 결정 — monolith vs worker / secret / scheduler / network) — T-0015 가 처리. 본 task 는 ADR-0002 만.
- 실제 ORM dependency 추가 (`prisma` / `@nestjs/prisma` / `typeorm` / `@nestjs/typeorm` 등) — **CLAUDE.md §5 BLOCKED 룰** 대상. 별도 후속 task (P3 Persistence layer 진입 시) 가 사용자 승인을 받고 도입.
- 구체 schema 디자인 (table 컬럼 / 인덱스 정의 / migration 파일) — P3 phase 의 task. 본 ADR 은 DB engine + ORM 선택만.
- migration tool 도입 (prisma migrate / typeorm migration / liquibase 등) — 별도 task. 본 ADR 에서는 "어떤 도구를 쓸지 1 줄 결정" 만 (도구 패키지 install 안 함).
- Backup / restore 도구 도입 (pg_dump 자동화 등) — REQ-030 의 구현은 P6/P7 phase. 본 task 는 deployment.md 에 "전략 1 줄" 만.
- DB connection pool / connection 관리 코드 — P3 phase.
- README.md 본문 갱신 — README 는 source of truth, 본 task 가 변경하지 않음.
- T-0013 의 Follow-ups 에 적힌 REQ-029 / REQ-024 등의 재분류 — 별도 P2 phase 진입 시.
- mermaid 다이어그램 — T-A3 / T-A4 가 처리. 본 task 는 텍스트만.
- web/ 또는 frontend 관련 결정 — 별도 ADR / 별도 phase.

## Suggested Sub-agents

- **architect**: ADR-0002 작성 (Context/Decision/Consequences/Alternatives 4 섹션) + deployment.md DB 단락 작성 + INDEX.md 갱신.
- **implementer**: production code 0 LOC 이므로 호출 안 함. doc 변경만 architect 가 처리.
- **tester**: R-110 ~ R-114 강제. production code 0 LOC 이라도 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 7 step (ci.yml 동일) 모두 로컬 실행 후 green 확인 + TRAIL 작성.

호출 순서: `architect → tester`. (implementer 없음.)

## Follow-ups

비어있음 — sub-agent 가 작업 중 발견한 항목 append.
