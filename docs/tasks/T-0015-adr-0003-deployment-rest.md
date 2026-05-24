---
id: T-0015
title: ADR-0003 — Deployment 나머지 4 결정 (Monolithic / Secret / Scheduler / Network) + deployment.md 4 단락 + T-A2 closure
phase: P1
status: DONE
completedAt: 2026-05-24T20:58:00+09:00
mergedAs: 91703e9
prNumber: 14
reviewRounds: 2
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-016, REQ-020, REQ-039, REQ-040, REQ-047]
estimatedDiff: 250
estimatedFiles: 4
actualDiff: 305
actualFiles: 4
created: 2026-05-24
plannerNote: P1 T-A2 split 두 번째 task — ADR-0003 4 결정 통합 + deployment.md 4 단락 채움 + T-A2 closure. commitMode=pr, ~250 LOC / 4 파일.
dependsOn: [T-0014]
blocks: [T-A3, T-A4]
hqOrigin: null
---

# T-0015 — ADR-0003 Deployment 나머지 4 결정 + deployment.md 4 단락 + T-A2 closure

## Why

[docs/PLAN.md](../PLAN.md) Phase P1 의 T-A2 (Deployment view) 는 5 결정 항목 — **Monolithic vs queue+worker 분리 / DB / Secret 저장 / Scheduler 위치 / 외부 네트워크 boundary** — 을 박제하도록 설계됐다. [CLAUDE.md](../../CLAUDE.md) §3 의 size cap (≤300 LOC / ≤5 파일) 을 안전하게 지키기 위해 T-A2 는 2 task 로 split 되어 진행 중이다.

- **T-0014 (DONE, PR-13, 56a93b0)**: DB 결정만 — [ADR-0002](../decisions/ADR-0002-db.md) (PostgreSQL + Prisma) + deployment.md 의 DB 단락. ACCEPTED.
- **T-0015 (본 task)**: 나머지 4 결정 — Monolithic vs worker / Secret / Scheduler / Network — 를 ADR-0003 한 문서로 응집 + deployment.md 의 4 placeholder 단락 채움 + PLAN.md L49 의 T-A2 closure 표시.

본 task 가 4 결정을 1 ADR 로 응집하는 이유: 4 결정이 모두 **운영 토폴로지 (process 구조 + 외부 자원 boundary)** 라는 동일 관심사이며, 서로 의존적이다. 예: monolithic 결정이 scheduler 가 NestJS 내장이 될지 분리 cron 이 될지에 영향. 4 결정을 1 ADR 로 묶으면 reviewer 가 한 PR 에서 4 결정의 정합성을 한꺼번에 검토할 수 있어 응집도가 높다 (split 4 ADR 은 over-fragmentation).

본 task 가 cover 하는 REQ ([docs/requirements.md](../requirements.md) 기준):

- **REQ-005 / REQ-006 / REQ-007** — 3 GitHub instance (github.com / github.sec.samsung.net / github.ecodesamsung.com) 접근 — 외부 네트워크 boundary 결정의 motivation.
- **REQ-016** — Confluence (confluence.sec.samsung.net 등) 접근 — 네트워크 boundary 결정의 motivation.
- **REQ-020** — 권한 부족 통지 — secret 관리 + 권한 정보 흐름과 연결.
- **REQ-039** — Admin cron 주기 지정 — Scheduler 결정의 직접 motivation.
- **REQ-040** — Manual trigger — Scheduler 결정의 부속 motivation (cron 이외의 trigger 경로).
- **REQ-047** — 1h 처리량 NFR (100~200명 / 50~100repo / ~1000 confluence) — Monolithic vs worker 결정의 직접 motivation.

본 task 의 결정은 모두 **운영 정책의 박제** 만 — 실제 패키지 도입 (예: Redis, BullMQ, @nestjs/bull, @nestjs/schedule, 외부 vault SDK 등) 은 **CLAUDE.md §5 의 "새 외부 dependency 추가 BLOCKED 룰" 의 적용 대상이므로 별도 후속 task 가 사용자 승인을 받고 도입**한다. 본 task 는 package.json 을 touch 하지 않는다.

## Required Reading

- [README.md](../../README.md) 7–17 행 (도입 — 3 GitHub instance 명시) — REQ-005~007 의 source.
- [README.md](../../README.md) 33–41 행 (Confluence 영역 — confluence.sec.samsung.net 접근) — REQ-016 의 source.
- [README.md](../../README.md) 19–22 행 (관리자 권한 / 인증) — REQ-020 (권한 부족) 의 source.
- [README.md](../../README.md) 71–74 행 (스케줄 / cron / manual trigger) — REQ-039 / REQ-040 의 source.
- [README.md](../../README.md) 88–92 행 (성능 NFR — 1h 처리 / 3초 조회) — REQ-047 의 source.
- [CLAUDE.md](../../CLAUDE.md) §1 (기술 스택 — NestJS / TS / pnpm / Jest / GHA 박제). Stack 변경 없음을 본 task 가 재확인.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode — 새 ADR / architecture 신설 = pr).
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-110 ~ R-114 (test/CI 절대 규칙 — 본 task 는 doc-only pr 이므로 R-112 4 종 N/A 처리, R-110 active 로 tester 호출 의무).
- [CLAUDE.md](../../CLAUDE.md) §5 (HITL — 새 외부 dependency 추가 BLOCKED 룰). 본 task 가 직접 부딪치는 룰 — 모든 결정의 actual 도입은 별도 task.
- [CLAUDE.md](../../CLAUDE.md) §9 (안전장치 — 새 dependency BLOCKED 재강조).
- [CLAUDE.md](../../CLAUDE.md) §12 (한국어 정책 — ADR 본문 / deployment.md 본문 한국어).
- [docs/PLAN.md](../PLAN.md) L43–L75 (Phase P1 섹션) 와 L49 (T-A2 bullet) 와 L100~L108 (P3 Persistence layer 와 P4 LLM provider) 의 의존 관계.
- [docs/requirements.md](../requirements.md) L24~L31 (REQ-005~007 GitHub instance) / L40 (REQ-016 Confluence) / L33 (REQ-020 권한 부족) / L58~L59 (REQ-039 / REQ-040) / L66 (REQ-047 NFR).
- [docs/architecture/INDEX.md](../architecture/INDEX.md) (ADR-0003 이 "미작성 — T-A2" 로 예약된 행, 본 task 가 ACCEPTED 로 갱신 + deployment.md 행 상태 부분→완료).
- [docs/architecture/deployment.md](../architecture/deployment.md) — T-0014 가 만든 placeholder 본문. 본 task 가 4 단락 (Monolithic / Secret / Scheduler / Network) 의 TBD 를 채움.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) 와 [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — ADR 본문 schema (Context / Decision / Consequences / Alternatives) 의 참고 모형.
- [docs/tasks/T-0014-adr-0002-db-selection.md](T-0014-adr-0002-db-selection.md) — split 앞 task. 본 task 와 결정 schema 의 일관성 유지.

## Acceptance Criteria

### 산출물 1 — ADR-0003 신설 (4 결정 응집)

- [ ] `docs/decisions/ADR-0003-deployment.md` 파일이 신설된다. 파일명 slug 는 `deployment`.
- [ ] frontmatter: `id: ADR-0003` / `title: <한국어 한 줄 — 4 결정 응집>` / `status: ACCEPTED` / `date: 2026-05-24` / `relatedTask: T-0015` / `supersedes: null`. ADR-0001 / ADR-0002 의 frontmatter schema 와 일치.
- [ ] 본문 구조: **Context / Decision / Consequences / Alternatives** 4 섹션 (ADR-0001 / ADR-0002 와 동일 schema). 본 ADR 은 4 결정을 응집하므로 **Decision 섹션 안에 4 sub-section (Decision §1 ~ §4)** 을 둔다. 본문은 한국어 (CLAUDE.md §12).
- [ ] **Context**:
  - 본 ADR 이 cover 하는 6 REQ (REQ-005/006/007/016/020/039/040/047) 의 근거 요약 + 결정을 지배하는 외력 (README 행 인용, 1-2 줄씩).
  - long-horizon 자율 agent 환경 / single-operator 운영 / agent 친화성 (CLAUDE.md §10) 도 언급.
  - 본 ADR 이 [ADR-0002 (DB)](../decisions/ADR-0002-db.md) 와 함께 T-A2 (Deployment view) 의 source of truth 임을 명시.
- [ ] **Decision §1 — Monolithic vs queue+worker 분리**:
  - **결정 (1 줄)**: 본 ADR 채택 시 default 권고 — Monolithic NestJS process 1 개로 시작 (in-process 순차 처리 또는 단순 in-process queue). worker 분리는 P5 (Evaluation pipeline) phase 이후 필요시 별도 ADR 로 전환.
  - **근거 (3-5 줄)**: REQ-047 의 boundary (100~200명 / 50~100 repo / ~1000 confluence / 1h 처리) 가 일평균 1회 평가 + cron 기반 야간 처리이므로 동시성 압박이 낮음 / monolithic 의 운영 단순성 (single-operator) 우선 / Redis · BullMQ 도입은 새 dependency BLOCKED 룰 적용 대상이라 단계적 도입 / NestJS scheduler 와 in-process flow 의 자연스러운 응집.
  - architect 가 default 와 다른 결정을 채택할 수 있으나, alternative 정당화 (예: worker 분리가 추후 sharding/HA 에 유리) 를 Alternatives 섹션에 명시해야 함.
- [ ] **Decision §2 — Secret 저장**:
  - **결정 (1 줄)**: default 권고 — 환경변수 (process.env) 기반 + 개발 시 `.env` 파일 (`.gitignore` 등록 필수, NestJS `@nestjs/config` 의 ConfigModule 사용 패턴). 외부 vault (HashiCorp Vault / AWS Secrets Manager / Azure Key Vault 등) 는 P7 / P8 phase 의 운영 강화 단계에서 별도 ADR 로 도입.
  - **근거 (3-5 줄)**: single-operator 운영 / Samsung 내부망 환경의 corporate 운영 정책 / REQ-020 (권한 부족 통지) 의 핵심은 자격증명 흐름이 single source of truth 에서 관리되어야 한다는 점 / vault 도입은 over-engineering 위험 / `.env` 패턴은 NestJS / @nestjs/config 의 표준이라 추가 dependency 0 (다만 @nestjs/config 자체는 별도 task 가 도입 — 본 ADR 은 정책만).
  - secret 의 종류 명시 (1-2 줄): GitHub 3 instance 의 PAT 또는 OAuth token / Confluence 의 PAT / LLM provider (Azure OpenAI / Anthropic / Google / OpenAI / custom) API key / DB 의 `DATABASE_URL` / Backend 의 JWT secret 또는 session secret.
- [ ] **Decision §3 — Scheduler 위치**:
  - **결정 (1 줄)**: default 권고 — `@nestjs/schedule` 모듈 (NestJS 내장) 을 Backend process 내부에서 사용. 외부 cron (system cron / Kubernetes CronJob 등) 은 사용하지 않음 — 단일 Backend process 안에서 모든 시간 trigger 처리.
  - **근거 (3-5 줄)**: REQ-039 (Admin 이 UI 에서 cron 주기 지정) 를 만족하려면 schedule 정보가 DB 에 저장되고 runtime 에 동적 갱신돼야 함 → 외부 cron 보다 in-process scheduler 가 자연스러움 / REQ-040 (manual trigger) 도 동일 NestJS controller endpoint 에서 처리 가능 → trigger 경로 응집 / monolithic 결정 (Decision §1) 과 정합 / @nestjs/schedule 은 별도 dependency BLOCKED 룰 대상이므로 실제 도입은 별도 task.
  - manual trigger (REQ-040) 와 cron (REQ-039) 의 통합 진입점 1 줄.
- [ ] **Decision §4 — 외부 네트워크 boundary**:
  - **결정 (1 줄)**: default 권고 — Samsung 내부망 (github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net / 내부 LLM proxy / custom OpenAI 호환 서버) 은 corporate network (VPN 또는 사내 host) 에서 직접 접근 + 외부 (github.com / Azure OpenAI / Anthropic / Google / OpenAI 공개 API) 도 동일 process 에서 접근. 별도 egress proxy 또는 NAT gateway 는 사용하지 않음 — 운영 단순성 우선.
  - **근거 (3-5 줄)**: REQ-005/006/007 의 3 GitHub instance 와 REQ-016 의 Confluence 가 corporate network 안 / public LLM provider 는 outbound 접근 / single-operator 의 배포 환경이 corporate host 1 대로 가정 / 운영 호스트가 internal+external 둘 다 reach 가능한 위치에 있다는 전제 / TLS / certificate 처리는 표준 Node.js HTTPS / `NODE_EXTRA_CA_CERTS` 환경변수로 사내 인증서 trust (별도 dependency 0).
  - 운영 호스트가 corporate 내부 가정. cloud 배포 (AWS / Azure 등) 로 전환 시 본 ADR SUPERSEDED 새 ADR 필요 1 줄.
- [ ] **Consequences**:
  - 4 결정 통합의 긍정 4-5 항목 (운영 단순성 / 단일 process 의 dev 친화 / @nestjs/config + @nestjs/schedule 의 NestJS native 정합 / corporate network 의 직접 접근 / agent-friendly 표준 패턴).
  - 부정·trade-off 3-4 항목 (worker 분리 시 새 ADR 필요 / Redis 등 외부 큐 도입 시 보조 ADR 필요 / vault 도입 시 새 ADR 필요 / corporate-host 가정이 cloud-managed 환경에서 깨질 위험).
  - 후속 task 의 진행 방향 2-3 줄 (P3 의 Persistence layer / P4 의 GitHub & Confluence adapter / P4 의 LLM gateway / P7 의 Scheduling & operations 각 task 가 본 ADR 을 전제로 작업).
- [ ] **Alternatives**: 4 결정 각각 별로 alternative 비교 표 (또는 Decision §N 아래 sub-bullet). 각 alternative 에 **장점 / 단점 / 본 ADR 이 선택하지 않은 이유** 한 줄씩.
  - Monolithic vs worker: 최소 3 alternative (Monolithic / Monolithic+in-process queue / 별도 worker process + Redis/BullMQ / Kubernetes Job 분리).
  - Secret: 최소 3 alternative (env+@nestjs/config / `.env` 단독 / HashiCorp Vault / cloud-managed secrets).
  - Scheduler: 최소 3 alternative (@nestjs/schedule / system cron / queue-based (Redis 등) / Kubernetes CronJob).
  - Network boundary: 최소 2-3 alternative (direct from app process / explicit egress proxy / NAT gateway / corporate-bypass via SOCKS proxy).
- [ ] ADR-0003 마지막 줄에 `Refs: T-0015, REQ-005, REQ-006, REQ-007, REQ-016, REQ-020, REQ-039, REQ-040, REQ-047` 형식 한 줄.

### 산출물 2 — deployment.md 의 4 TBD 단락 채움

- [ ] `docs/architecture/deployment.md` 의 L46~L60 (현재 4 TBD placeholder — Monolithic / Secret / Scheduler / Network) 단락 모두 채움. 본문 한국어 (CLAUDE.md §12).
- [ ] 각 단락의 구조: ADR-0003 Decision §N 의 결정 인용 1 줄 + 운영 토폴로지 (배치 형태 / 구성 요소 / 연결) 2-5 줄 + ADR 링크 (`[ADR-0003 §N](../decisions/ADR-0003-deployment.md)`).
- [ ] **Monolithic vs worker 분리 단락** (15-25 줄):
  - 채택 1 줄 (Monolithic NestJS process).
  - process 1 개의 책임 범위 (HTTP API + scheduler + 평가 파이프라인 + LLM gateway + GitHub/Confluence adapter 모두 동일 process).
  - 1h 처리량 (REQ-047) 충족 시나리오 1-2 줄 (in-process sequential / setTimeout pacing / 또는 단순 Promise.all + concurrency limit).
  - worker 분리 전환 시점 (P5 이후 필요시) 1 줄.
- [ ] **Secret 저장 단락** (15-25 줄):
  - 채택 1 줄 (env + @nestjs/config + `.env` for dev).
  - 운영 환경 secret 주입 방식 (CI/CD 시 환경변수 / process supervisor 의 env 파일 / systemd EnvironmentFile 등).
  - dev 환경의 `.env` 파일 정책 (`.gitignore` 에 포함, `.env.example` 만 commit, 본 task 는 example 파일 작성 안 함 — P3/P4 의 도입 task 가 처리).
  - secret rotation 정책 1 줄 (수동, P7 의 운영 task 가 자동화).
- [ ] **Scheduler 위치 단락** (15-25 줄):
  - 채택 1 줄 (@nestjs/schedule).
  - cron 주기 설정 흐름 (Admin UI → DB → SchedulerModule 의 dynamic registration).
  - manual trigger 흐름 (REQ-040 — Admin UI → controller endpoint → 평가 파이프라인 직접 호출).
  - default 시각 (예: KST 02:00 — README L72 의 예시 인용).
- [ ] **외부 네트워크 boundary 단락** (15-25 줄):
  - 채택 1 줄 (direct outbound from app process).
  - 접근 대상 목록 (3 GitHub instance + Confluence + LLM 5 provider) 표 또는 bullet.
  - 사내 인증서 / TLS 처리 1 줄 (`NODE_EXTRA_CA_CERTS` 환경변수 또는 NODE_TLS_REJECT_UNAUTHORIZED 운영 가이드 — 단 후자는 보안 위험 명시).
  - 권한 부족 (REQ-020) 감지 흐름 1 줄 (4xx 응답 catch → adapter 가 권한-부족 이벤트 emit → 통지 모듈로 전달).
- [ ] 각 단락 끝에 1 줄 — "구체 도입은 P3 / P4 / P7 의 task 책임" 안내.

### 산출물 3 — INDEX.md 갱신

- [ ] `docs/architecture/INDEX.md` L10 의 `deployment.md ... 부분 (T-0014 가 DB 단락만, 나머지 4 단락은 T-0015)` 행을 `완료 (T-0014 + T-0015)` 로 갱신.
- [ ] L29 의 `ADR-0003 Deployment (...) 미작성 — T-A2` 행을 `ACCEPTED (T-0015)` 로 갱신.

### 산출물 4 — PLAN.md L49 T-A2 closure

- [ ] `docs/PLAN.md` L49 의 T-A2 bullet 의 `[ ]` 표시를 `[x]` 로 변경 + 끝에 closure 메모 `(T-0014 + T-0015 = T-A2 complete; ADR-0002 + ADR-0003 ACCEPTED)` 추가. L50~L54 의 5 sub-bullet 은 그대로 유지 (split 진행 기록 보존).
- [ ] L65 의 "완료 조건" 단락에 T-0014 + T-0015 가 T-A2 를 완성했음 반영 (기존 문장에 자연스러운 갱신 — 새 문장 추가 또는 기존 문장 다듬음).

### 산출물 5 — production code 0 LOC + 신규 dependency 0

- [ ] `src/`, `test/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc*`, `.github/workflows/`, `.claude/` 어느 파일도 변경되지 않음. `git diff --name-only HEAD origin/main` 결과가 **4 파일 안** 에 들어옴 (ADR-0003-deployment.md / deployment.md / INDEX.md / PLAN.md). 본 task 파일 frontmatter 의 status 갱신 (PENDING → IN_PROGRESS → DONE) 은 driver 가 다른 turn 에서 처리하므로 본 PR 의 diff 에는 포함되지 않을 수 있음.
- [ ] `package.json` 의 `dependencies` / `devDependencies` 변동 0. ADR-0003 의 결정에 등장하는 모든 패키지 (@nestjs/config / @nestjs/schedule / @nestjs/bull / bullmq / ioredis / dotenv 등) 가 추가되지 않음. **CLAUDE.md §5 의 BLOCKED 룰을 본 task 가 자체적으로 회피** — 결정만 박제, 실제 도입은 별도 task.

### 산출물 6 — R-110 ~ R-114 CI 검증

- [ ] **R-110**: 본 task 는 `commitMode: pr` 이므로 R-110 active. production code 변경 0 LOC 이지만, tester 는 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` (또는 ci.yml 의 7 step 전부) 를 로컬에서 실행하여 doc 변경이 기존 test 를 깨지 않았음을 확인한다. tester 의 TRAIL 에 `result: pass` 명시.
- [ ] **R-111**: PR push 후 GitHub Actions 가 자동 trigger 되어 CI 의 7 step (lint / build / test:cov / smoke / e2e / spec-presence / spec-presence self-test) 모두 green. integrator 의 3중 게이트 중 "CI green" 검사가 이를 강제.
- [ ] **R-112**: production code 변경 0 LOC 이므로 happy / error / branch / negative 4 종 unit test 추가 **N/A**. PR 본문에 "production code 0 LOC 변경 — R-112 적용 N/A" 명시.
  - 분기 없음 — 이 항목 생략 (R-112 가이드라인의 분기 없음 케이스).
- [ ] **R-113**: smoke + e2e step 이 본 task 의 PR CI 에서 실행되어 green. doc 변경이 기존 smoke/e2e 를 깨지 않음을 검증.
- [ ] **R-114**: integrator 가 squash merge 전에 PR CI 의 latest run conclusion 이 `success` 임을 확인. fail 시 BLOCKED.

### 산출물 7 — reviewer 정책 점검 (§3.3 4-게이트)

- [ ] reviewer agent 가 [README.md](../../README.md) 117–128 8-check 로 검토. 본 task 의 doc 변경이 [CLAUDE.md](../../CLAUDE.md) §12 (한국어 정책 — ADR / deployment.md 본문 한국어) 와 §3.1 (commit mode 표 — ADR 은 pr) 와 §3 (size cap ≤300 LOC / ≤5 파일) 와 §5 (새 dependency 추가 없음) 모두 준수하는지 확인.
- [ ] reviewer VERDICT=APPROVE 시 **반드시 `gh pr comment` 로 PR 에 외화**. PR body 에 inline 만 적는 위장 패턴 금지 (CLAUDE.md §3.3 게이트 2).
- [ ] integrator 가 4-게이트 (reviewer.VERDICT == APPROVE + PR comment 외화 검증 + integrator self-check 통과 + CI green) 모두 만족 후 `gh pr merge --squash --delete-branch`.

### 정합성 / non-regression

- [ ] ADR-0003 의 frontmatter `relatedTask: T-0015` 가 실존하는 본 task ID 를 가리킴.
- [ ] ADR-0003 의 4 Decision 이 [ADR-0002 (DB)](../decisions/ADR-0002-db.md) 와 충돌하지 않음 — Monolithic 결정이 ADR-0002 의 단일 DB 인스턴스 가정과 정합, scheduler 결정이 DB 기반 동적 cron 갱신과 정합.
- [ ] ADR-0003 의 4 Decision 의 alternatives 합산이 최소 11 alternative (3+3+3+2) — 비교가 빈약하면 reviewer ANOTHER_ROUND.
- [ ] deployment.md 의 4 채워진 단락 모두 ADR-0003 의 해당 Decision sub-section 을 인용 (링크).
- [ ] PLAN.md L49 의 T-A2 closure 가 main 의 PLAN.md 와 정합 (driver 가 별도 commit 으로 갱신할 수 있고, 본 PR 안에서 함께 처리도 가능 — 한 곳에서만 처리).
- [ ] 본 task DONE 후 STATE.json 의 `mostRecentTasks` 가 [T-0015, T-0014, T-0013, T-0010, T-0009] 로 갱신되고 `counters.tasksCompleted` 가 13→14 로 +1 (driver 책임).

## Out of Scope

- 실제 패키지 도입 — @nestjs/config / @nestjs/schedule / @nestjs/bull / bullmq / ioredis / dotenv / HashiCorp Vault SDK 등 어느 것도 본 task 가 `pnpm add` 하지 않음. **CLAUDE.md §5 BLOCKED 룰** 대상 — 별도 후속 task (P3 / P4 / P7) 가 사용자 승인 후 도입.
- 구체 `.env.example` 파일 작성 — 별도 task (env schema 가 충분히 모일 때).
- ConfigModule / SchedulerModule / BullModule NestJS module 작성 — P3 / P4 / P7 의 task.
- Migration tool 도입 / DB schema 디자인 — ADR-0002 의 범위, 별도 P3 task.
- mermaid 다이어그램 — T-A3 (component view) / T-A4 (module view) 의 책임.
- README.md 본문 갱신 — README 는 source of truth, 본 task 변경 안 함.
- T-0013 / T-0014 의 Follow-ups 에 적힌 REQ 재분류 등 — 별도 P2 phase 진입 시.
- T-A3 (component view) / T-A4 (module view) — 별도 후속 task.
- corporate network 구체 토폴로지 (VPN endpoint / DNS 설정 / 사내 PKI 인증서 관리 매뉴얼) — 운영 매뉴얼 영역, P7 / P8 phase.
- LLM provider 5 종의 구체 endpoint 와 API 차이 — P4 phase 의 LLM gateway task.
- Authentication / RBAC 모델 — P3 의 별도 task.
- web/ frontend 관련 deployment — 별도 ADR / 별도 phase (P6).

## Suggested Sub-agents

- **architect**: ADR-0003 작성 (Context / Decision §1~§4 / Consequences / Alternatives 4 섹션) + deployment.md 4 단락 채움 + INDEX.md 갱신 + PLAN.md L49 closure. default 권고 (planner 가 task 본문에 박은 4 결정) 를 review 한 후 reasoning 보강. default 와 다른 결정 채택 시 Alternatives 섹션에서 정당화.
- **implementer**: production code 0 LOC 이므로 호출 안 함. doc 변경만 architect 가 처리.
- **tester**: R-110 ~ R-114 강제. production code 0 LOC 이라도 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 7 step (ci.yml 동일) 모두 로컬 실행 후 green 확인 + TRAIL 작성.

호출 순서: `architect → tester`. (implementer 없음.)

## Follow-ups

비어있음 — sub-agent 가 작업 중 발견한 항목 append.
