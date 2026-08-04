# Deployment view

> **본 문서는 P1 T-A2 의 산출물이다. [T-0014](../tasks/T-0014-adr-0002-db-selection.md) 가 DB 단락을 채우고 ([ADR-0002](../decisions/ADR-0002-db.md)), [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 가 나머지 4 단락 (Monolithic / Secret / Scheduler / Network) 을 채워 ([ADR-0003](../decisions/ADR-0003-deployment.md)) T-A2 가 완성됐다. [T-0399](../tasks/T-0399-deployment-md-web-serve-static-doc-sync.md) 가 P6 frontend 진입 ([ADR-0040](../decisions/ADR-0040-frontend-stack.md) · [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md)) 에 따라 단일 process 의 Web UI 정적 serve 책임을 `### process 1 개의 책임 범위` 에 doc-sync 했다.**

## 개요

본 문서는 Assessment-Agent 의 **deployment view** — 어떤 process / 인스턴스 구조로 운영되며, 어떤 외부 자원에 의존하는지 — 를 박제한다. [docs/architecture/INDEX.md](INDEX.md) 의 MVA 원칙에 따라 운영 가능한 최소 결정만 다루고, 구체적인 manifest (Dockerfile / docker-compose.yml / Kubernetes manifest 등) 는 다루지 않는다 — 그것은 P7 (Scheduling & operations) phase 의 운영 task 책임.

본 view 는 [ADR-0002](../decisions/ADR-0002-db.md) (DB) 와 [ADR-0003](../decisions/ADR-0003-deployment.md) (Deployment 4 결정) 가 결정한 사항을 view layer 로 모은다. ADR 이 결정의 source of truth 이고, 본 문서는 ADR 결정이 운영 토폴로지에 어떻게 반영되는지의 도식 / 텍스트 설명이다.

본 deployment view 가 박제한 단일 NestJS process 안의 **component 분해 + contract** 는 [components.md](components.md) (T-0016 의 산출물) 에 박제되어 있다.

운영자용 배포·복구·trouble-shoot **실행 절차**(본 view 의 정책을 명령-level 로 푼 플레이북)는 [docs/ops/runbook.md](../ops/runbook.md) 참조.

## DB / Persistence

본 단락의 결정은 [ADR-0002 — Persistence DB / ORM 선택](../decisions/ADR-0002-db.md) 에서 박제했다. 본 view 는 그 결정을 운영 토폴로지로 풀어낸다.

**채택: PostgreSQL + Prisma**. [ADR-0002](../decisions/ADR-0002-db.md) 참조.

### 배포 토폴로지

- **단일 인스턴스 (initial deployment)**: PostgreSQL 16 이상을 별도 process 로 운영. Backend NestJS process 와 **동일 host 의 다른 process** 또는 **로컬 Docker container** (`postgres:16-alpine`) 형태가 default. [CLAUDE.md](../../CLAUDE.md) §1 의 single-operator 운영 컨텍스트에서는 본 형태가 가장 가볍다.
- **Backend → DB 연결**: 동일 host 의 경우 Unix socket 또는 `localhost:5432`. Docker 의 경우 docker-compose 내부 network 의 service 이름 (예: `db:5432`) 으로 접근. 외부 managed service (RDS / Cloud SQL) 도 connection string 만 교체하면 동작하도록 환경변수화 — 구체 변수 이름은 T-0015 의 secret 단락이 결정 (`DATABASE_URL` 표준 명칭이 Prisma convention).
- **Connection pool**: NestJS Backend process 내부에 PrismaService 의 singleton 으로 보유. Pool 크기와 statement timeout 의 구체 값은 P3 Persistence layer task 에서 결정.
- **Worker 분리 시 확장**: [ADR-0003 (T-0015)](../decisions/ADR-0003-deployment.md) 에서 worker process 분리가 결정되면, worker 도 동일 DB 인스턴스에 동일 connection string 으로 접근. DB schema 는 하나 — 본 ADR 의 결정으로 1 DB 인스턴스 전제.

### Migration 정책

- **도구**: [ADR-0002](../decisions/ADR-0002-db.md) 에 따라 `prisma migrate` 를 사용. 개발 환경은 `prisma migrate dev`, 배포 환경은 `prisma migrate deploy`.
- **Migration 파일 위치**: `prisma/migrations/` 디렉토리에 누적, git 으로 버전 관리.
- **CI 통합**: Migration SQL 의 자동 적용은 P3 phase 의 task 에서 ci.yml step 또는 별도 deployment script 로 도입. 본 task 는 정책만 박제.

### Backup / restore 전략

- **DB-level dump**: PostgreSQL 표준 `pg_dump` / `pg_restore` 로 binary 또는 plain SQL backup 가능. README 57 행 (export / backup / restore) 의 요구사항을 본 표준 도구로 충족 가능.
- **자동화**: cron 또는 NestJS scheduler 기반 자동 backup 은 P7 phase 의 task. 본 task 는 "표준 도구 사용" 정책만 박제.
- **Restore 시나리오**: 평가 자료 reset 또는 환경 이전 시 `pg_restore` 로 새 인스턴스에 적재. Migration history 도 함께 복원되어 schema 상태가 동기.

### Raw data 저장 금지 (REQ-032) 의 schema-level 강제

- [ADR-0002 Decision §2](../decisions/ADR-0002-db.md) 의 정책에 따라, Prisma `schema.prisma` 에 **commit/문서의 raw 본문을 담는 column 을 정의하지 않는다**. 평가 결과 (난이도 / 기여도 / 양 / LLM 평가문 / metric 수치) 만 컬럼화한다.
- Schema PR 의 reviewer agent 는 `String` 타입 column 추가 시 그 의도를 PR 본문에서 확인 — raw text 보관 의도이면 REQ-032 위반으로 REQUEST_CHANGES.
- 구체 column 설계 / 인덱스 / unique constraint 는 P3 Persistence layer task 에서 진행.

### 후속 진행

Schema 컬럼 설계 / 인덱스 정책 / migration 도구 실제 도입 (`prisma` package install) / PrismaService NestJS module 작성은 모두 P3 (Domain core) phase 의 Persistence layer task 에서 진행된다. 본 task 와 본 단락은 결정과 정책만 박제하며, 코드 변경은 0 LOC.

## 배포 토폴로지 (Monolithic vs worker 분리)

본 단락의 결정은 [ADR-0003 §1 — Monolithic NestJS process](../decisions/ADR-0003-deployment.md) 에서 박제했다.

**채택: 단일 NestJS process (monolithic)**. HTTP API / scheduler / 평가 파이프라인 / LLM gateway / GitHub & Confluence adapter / Web UI 정적 serve 가 동일 process 안에서 동작한다. 별도 worker process / 외부 큐 broker 는 도입하지 않는다.

frontend `web/` 빌드는 backend `src/` 와 분리된다 — 기존 `pnpm build` (NestJS tsc) 는 불변이고, frontend 는 `pnpm --filter web build` 류의 분리 스크립트로 `web/dist/` 를 산출한다 ([ADR-0040 §3/§6](../decisions/ADR-0040-frontend-stack.md)). 운영 process 는 그 `web/dist/` 산출물을 정적 serve 한다 (아래 책임 범위 참조).

### process 1 개의 책임 범위

- **HTTP API** — controller layer 가 Web UI / Admin UI 요청을 수신.
- **Scheduler** — `@nestjs/schedule` 기반 in-process cron + manual trigger endpoint (자세히는 아래 [Scheduler 위치](#scheduler-위치) 단락).
- **평가 파이프라인** — commit / 문서 / Confluence page 의 평가 (난이도 / 기여도 / 양 / LLM 정성 + Metric) 처리. service layer 의 동기 호출 또는 `Promise.all` + concurrency limit 으로 운영.
- **LLM gateway** — 5 provider (custom / Azure OpenAI / Anthropic / Google / OpenAI) 의 단일 추상화 service.
- **GitHub / Confluence adapter** — 3 GitHub instance + Confluence 의 외부 HTTPS 호출. adapter service 로 분리되어 있으나 동일 process.
- **Web UI 정적 serve** — 동일 NestJS process 가 `@nestjs/serve-static` (`src/web` WebModule) 으로 `web/dist/` SPA build 산출물을 mount 하고, 비-`/api/*` 경로의 SPA fallback (`index.html`) 을 처리한다 ([ADR-0040 §3](../decisions/ADR-0040-frontend-stack.md), T-0354 serve-static shipped). browser 관점 same-origin 이라 별도 정적 호스팅 / CORS 표면이 없다.

> **`process 1 개의 책임 범위` 6 bullet ↔ 실 `src/` 대조 (T-1437 실측 각주)** — 6 종 중 5 종은 **참** 이다: HTTP API (`src/*/*.controller.ts` **19**), Scheduler (`package.json` 31 행 `"@nestjs/schedule": "^4.1.2"` + `src/app.module.ts` 75 행 `ScheduleModule.forRoot()` + manual trigger `src/scheduling/cron-schedule.controller.ts` 140 행 `@Post("trigger")` — 다만 `@Cron` 데코레이터는 **0** 이고 실 등록은 `SchedulerRegistry` 동적 등록형이다), 평가 파이프라인 (`src/assessment-evaluation/`), LLM gateway (provider 식별자 **5** — `azure_openai` · `anthropic` · `google_gemini` · `openai` · `custom`, adapter 파일은 `openai-compatible.adapter.ts` 가 뒤 둘을 겸해 4), GitHub / Confluence adapter (`src/github/` · `src/confluence/`). 외부 큐 broker dependency 는 **0** 이라 54 행의 "worker / 큐 미도입" 도 참이고, 56 행 빌드 분리도 참이다 (root `"build": "nest build"` 불변 · `pnpm-workspace.yaml` `packages: - web` · `web/package.json` `"build": "tsc --noEmit -p tsconfig.json && vite build"`).
> **Web UI 정적 serve 만 조건부라 부분참** — `src/web/web.module.ts` 41 행 `if (!existsSync(join(distPath, "index.html")))` 이 빈 배열을 반환하고 49 행이 그 배열을 `.map` 으로 펼치므로, `web/dist/index.html` 이 없으면 `ServeStaticModule` **등록 수 0** 이다. 즉 **frontend 빌드 없이 부팅하면 API 는 뜨지만 SPA 라우트는 미등록** 이며, 위 bullet 의 무조건 mount 화법은 이 조건을 담지 못한다 (같은 사실의 소스 트리 축 판정은 `§ 12.34` 가 이미 박제 — 본 각주는 운영 축만 더한다).
> 본 각주는 **사실 기록** 이지 단락 재작성이 아니다 — 설계 의도 · trade-off 서술 (75 행 "배포가 backend 재시작과 묶인다" 등) 과 `### REQ-047 충족 시나리오` 는 형태 무관 · P7 perf 소관이라 **검증 불가 / 대상외** 로 판정에서 뺐다 (판정 근거는 [REQ-COVERAGE-AUDIT § 12.35](../use-cases/REQ-COVERAGE-AUDIT.md)).

### REQ-047 (1 h 처리) 충족 시나리오

100~200 명 × 50~100 repo × 7 일치 commit data + ~1000 Confluence page 를 1 h 내 처리. 일 평균 1 회 cron 기반 야간 처리이므로 동시성 압박이 낮다. NestJS service 의 `Promise.all` + `p-limit`-style concurrency limiter (예: 10 동시 외부 호출) 패턴으로 들어온다. 본 NFR 의 실측 검증은 P5 (Evaluation pipeline) phase 의 task 책임.

### worker 분리 전환 시점

다음 중 하나 발생 시 [ADR-0003](../decisions/ADR-0003-deployment.md) 를 SUPERSEDE 하는 별도 ADR 에서 worker + 외부 큐 (Redis + BullMQ) 도입 검토 — (a) 실측 REQ-047 미충족, (b) 사용자 / 대상 규모 300+ 명, (c) HA 가 요구사항화, (d) durable retry 가 운영 요구. 본 단락의 구체 도입은 **P5 phase 이후의 별도 task 책임**.

monolith 정적 serve 의 trade-off: frontend 배포가 backend process 재시작과 묶인다 — 현 single-operator 규모에서는 process 1 개 유지가 배포·secret·TLS 표면을 최소화하므로 수용하며, 별도 정적 호스팅 (nginx / CDN) 분리가 필요해지면 별도 ADR 로 전환한다 ([ADR-0040 Consequences](../decisions/ADR-0040-frontend-stack.md)).

## Secret / 자격증명 저장

본 단락의 결정은 [ADR-0003 §2 — env + `@nestjs/config`](../decisions/ADR-0003-deployment.md) 에서 박제했다.

**채택: 환경변수 (`process.env`) + `@nestjs/config` 의 `ConfigModule` 패턴**. 개발 환경은 `.env` 파일 (`.gitignore` 등록 필수, repo 에 commit 금지), 운영 환경은 process supervisor 의 환경변수 주입.

### 운영 환경 secret 주입 방식

- **systemd**: `EnvironmentFile=/etc/assessment-agent.env` 디렉티브로 unit file 에 외부 env 파일 mount. 파일 권한 `0600` + owner `assessment-agent` (전용 unprivileged user) 권장.
- **Docker / container**: `--env-file /path/to/.env.prod` 또는 orchestrator (docker-compose / k8s) 의 secret object 마운트.
- **CI/CD**: GitHub Actions 의 secret store 에서 deployment step 의 환경변수로 inject. repo 의 코드 / log 에 평문 노출 금지.

### 개발 환경 `.env` 정책

- `.env` 파일은 dev 머신 로컬에만 존재. `.gitignore` 에 등록 (실제 등록은 P3 / P4 도입 task 가 처리).
- `.env.example` 파일을 commit 하여 schema (변수 이름 + dummy value) 만 공유. 본 task 는 `.env.example` 작성하지 않음 — env schema 가 P3 / P4 진행 중 모이면 별도 task 가 작성.
- `@nestjs/config` 의 `ConfigModule.forRoot({ envFilePath: '.env', validationSchema: ... })` 로 schema validation 강제.

### Secret 의 종류 (참고)

GitHub 3 instance 의 PAT 또는 OAuth token / Confluence 의 PAT / LLM provider 5 종의 API key / DB 의 `DATABASE_URL` / Backend 의 JWT secret 또는 session secret. 각 환경변수 이름은 도입 task 의 reviewer 가 schema 일관성 점검.

### Secret rotation 정책

본 ADR 단계에서는 **수동 rotation** (사람이 PAT / API key 갱신 후 env 파일 갱신 + process restart). 자동 rotation (vault 도입 / dynamic credentials) 은 P7 / P8 phase 의 별도 ADR 책임. 구체 도입은 **P3 / P4 / P7 의 task 책임**.

> **`## Secret / 자격증명 저장` 단락 ↔ 실 `deploy/env.prod.example` · `docker-compose.yml` · `deploy/*.service` · `.gitignore` · `package.json` · `src/` 대조 (T-1441 실측 각주)** — 85 · 97 행의 **`@nestjs/config` 는 미도입** 이다. [ADR-0003 §2](../decisions/ADR-0003-deployment.md) 결정 자체는 실재하나 (그 §2 근거 5 가 "별도 task 가 사용자 승인 후 도입" 으로 유보했다) `package.json` 의 `@nestjs/*` 7 종에 `@nestjs/config` 가 **없고**, `src/` 의 `ConfigModule` hit **7 은 전부 주석** 이며 `src/main.ts` 2 행이 "의도적으로 도입하지 않음" 을 자인한다 — 실제 env 접근은 `process.env` 직접 read **24 곳** 이라 `ConfigModule.forRoot({ validationSchema })` 의 boot 검증 **강제도 없다** (`process.env` 채택 · `.env` + `.gitignore` 등록 자체는 참).
> **운영 주입 경로는 systemd 가 아니라 docker compose 다** — 89 행의 `EnvironmentFile=/etc/assessment-agent.env` 는 repo 배포 자산에 **0 hit** 이고, `deploy/assessment-agent-redeploy.service` 는 앱 실행 unit 이 아니라 **재배포 oneshot** (`Type=oneshot` · `ExecStart=…/deploy/redeploy.sh` · `Environment=REPO_DIR=…` 만) 이다. 90 행의 `--env-file` · orchestrator secret object 도 0 hit 이며 실제는 `docker-compose.yml` 47 ~ 48 행 `env_file: - .env` 다. 91 행의 CI/CD 주입은 `.github/workflows/` 에 배포 workflow 자체가 없어 (`ci.yml` 1 개, `secrets.GITHUB_TOKEN` 254 행 1 회) **미해당** 이다.
> **95 · 96 행의 시점 서술은 이미 지났다** — `.gitignore` 15 ~ 17 행이 `.env` · `.env.*` · `!.env.example` 을 등록했고, template 도 dev 용 `.env.example` (20 행) 과 운영용 `deploy/env.prod.example` **2 종이 실재** 한다 ("본 task 는 작성하지 않음 — 별도 task 가 작성" 이 이행된 상태이며, 운영 template 의 이름만 `.env.example` 이 아니다).
> **101 행 6 항목은 참 2 · 부분참 2 · 거짓 2** — `DATABASE_URL` (`deploy/env.prod.example` 15 행) 과 JWT secret (`AUTH_JWT_SECRET` 23 행 · `AUTH_JWT_REFRESH_SECRET`) 은 **참**, GitHub · Confluence 자격은 평문 PAT 이 아니라 `GITHUB_INSTANCES` / `CONFLUENCE_INSTANCES` + instance 별 `_TOKEN_ENC` **암호문** 이라 **부분참** (OAuth token 은 `src/` 0 hit, Confluence key 는 운영 template 미등재), LLM 5 종 API key 는 env 가 아니라 **DB `LlmProviderConfig.apiKey`** (`prisma/schema.prisma` 410 행, AES-256-GCM 암호화 저장) 이고 env 에는 master key `LLM_APIKEY_ENC_KEY` 만 있어 **거짓**, session secret 도 `src/` 0 hit 으로 **거짓** 이다. 반대로 `POSTGRES_PASSWORD` 는 실 secret 인데 열거에 **없다**.
> **105 행의 "구체 도입은 P3 / P4 / P7 의 task 책임" 역시 낡았다** (현 phase `P4-complete / P5-in-progress`). 수동 rotation 방침 · 파일 권한 `0600` 권장 · vault 미도입 (`src` · `package.json` 0 hit) 은 운영 가정이라 판정에서 뺐고, 83 행 pointer 는 ADR-0003 46 행 `### Decision §2` 실재로 유효하다 — 본 각주는 사실 기록이지 단락 재작성이 아니며, 101 행 열거가 ADR-0003 §2 원문의 전사라 in-place 치환은 정본 ↔ view 를 새로 어긋나게 한다 (판정 근거는 [REQ-COVERAGE-AUDIT § 12.39](../use-cases/REQ-COVERAGE-AUDIT.md)).

## Scheduler 위치

본 단락의 결정은 [ADR-0003 §3 — `@nestjs/schedule` (in-process)](../decisions/ADR-0003-deployment.md) 에서 박제했다.

**채택: NestJS 내장 `@nestjs/schedule` 모듈**. Backend NestJS process 내부에서 cron + interval + timeout trigger 를 모두 처리. 외부 cron (system cron / k8s CronJob 등) 은 사용하지 않는다.

### cron 주기 설정 흐름 (REQ-039)

```
Admin UI (cron 주기 변경)
  → HTTP PATCH /admin/schedule
  → ScheduleService.updateCron(newSpec)
  → DB 의 schedule 설정 row 갱신
  → SchedulerRegistry.deleteCronJob(name) + addCronJob(name, newCronJob)
  → 다음 trigger 부터 새 주기로 동작
```

cron 표현식 (예: `"0 2 * * *"` = KST 02:00 매일) 이 DB 에 저장되어 process restart 후에도 복원. 초기 default 는 [README.md](../../README.md) L72 예시 (KST 02:00). 실제 default 값과 cron 표현식 schema validation 은 P7 phase 의 도입 task 가 박제.

### Manual trigger 흐름 (REQ-040)

```
Admin UI (즉시 평가 버튼)
  → HTTP POST /admin/evaluation/trigger
  → EvaluationController.triggerNow()
  → EvaluationOrchestrator.runFullAssessment()  ← cron 도 동일 메서드 호출
  → 평가 파이프라인 진입
```

cron 과 manual 이 같은 service 메서드 (`EvaluationOrchestrator.runFullAssessment`) 를 호출 — code duplication 0. controller 와 scheduler handler 는 thin wrapper.

### 동시 실행 방지

평가 진행 중 새 trigger (cron 또는 manual) 가 와도 중복 실행되지 않도록 in-process mutex 또는 DB 의 `evaluation_runs` row 의 `status=RUNNING` 검사. 구체 구현은 **P5 phase 의 task 책임**.

### 후속 task 책임

`@nestjs/schedule` 의 실제 도입 (`pnpm add` + ScheduleModule import) / SchedulerRegistry 의 dynamic cron 등록 코드 / Admin UI 의 cron 편집 컴포넌트는 모두 **P7 phase 의 도입 task 책임**.

> **`## Scheduler 위치` 4 하위 절 ↔ 실 `src/scheduling/` · `prisma/schema.prisma` 대조 (T-1438 실측 각주)** — 기반 채택 (111 행) 은 **참** 이다 (`package.json` 31 행 `"@nestjs/schedule": "^4.1.2"` + `src/app.module.ts` 75 행 `ScheduleModule.forRoot()`). 다만 shipped 는 cron 등록뿐이고 (`addInterval` · `addTimeout` **0 hit**), 등록은 선언형 `@Cron` **0** · `SchedulerRegistry` 동적형이라 120 행의 `deleteCronJob` + `addCronJob` 은 실 `src/scheduling/cron-schedule.service.ts` 68 · 74 행과 **일치** 한다.
> **두 flow 의 route · 심볼은 실 구현과 어긋난다** — 실 route 는 `@Controller("api/schedules")` 아래 `@Put()` (107 행) · `@Post("trigger")` (140 행) 이라 117 행 `PATCH /admin/schedule` 은 경로 · method 두 축 모두, 130 행 `POST /admin/evaluation/trigger` 는 경로 축이 어긋난다. 118 · 131 · 132 · 136 행의 `ScheduleService.updateCron` · `EvaluationController.triggerNow` · `EvaluationOrchestrator.runFullAssessment` 는 **실재 0 hit** 이다 (실 명칭은 `CronScheduleService.registerOrReplace` · `CronScheduleController.trigger` · `EvaluationOrchestratorService`).
> **미shipped 축** — cron 설정 영속 model 은 `prisma/schema.prisma` 15 model 중 **0** 이라 119 · 124 행의 DB 저장 · restart 복원은 아직 blueprint 이고 (현 등록은 in-memory registry 전용), 140 행의 mutex / `status=RUNNING` 검사도 **0 hit** 다. 반대로 144 행이 P7 로 미룬 3 항목 중 `pnpm add` + `ScheduleModule` import · dynamic 등록 코드 · Admin UI cron 편집 (`web/src/components/SchedulePanel.tsx`) 은 **이미 shipped** 다.
> 본 각주는 **사실 기록** 이지 단락 재작성이 아니다 — Admin UI 진입점 서술 · thin wrapper 설계 의도 · phase 책임 배분은 형태 무관 · 검증 불가라 판정에서 뺐다 (판정 근거는 [REQ-COVERAGE-AUDIT § 12.36](../use-cases/REQ-COVERAGE-AUDIT.md)).

## 외부 네트워크 boundary

본 단락의 결정은 [ADR-0003 §4 — direct outbound from app process](../decisions/ADR-0003-deployment.md) 에서 박제했다.

**채택: Backend process 가 모든 외부 endpoint 에 직접 outbound**. 별도 egress proxy / NAT gateway / SOCKS bastion 없음. 운영 호스트는 corporate network (Samsung 사내 host 또는 VPN) 에 위치하여 내부+외부 둘 다 reach.

### 접근 대상 목록

| 대상 | 위치 | 인증 | 관련 REQ |
| --- | --- | --- | --- |
| github.com | public | PAT (or OAuth) | REQ-005 |
| github.sec.samsung.net | Samsung 내부망 | PAT (사내 발급) | REQ-006 |
| github.ecodesamsung.com | Samsung 내부망 | PAT (사내 발급) | REQ-007 |
| confluence.sec.samsung.net (+ 추가 사내 Confluence) | Samsung 내부망 | PAT | REQ-016 |
| Azure OpenAI | public (Azure) | API key | (LLM provider — REQ TBD, P2 가 requirements.md 에 추가 시 부여) |
| Anthropic API | public | API key | (LLM provider — REQ TBD) |
| Google Gemini | public | API key | (LLM provider — REQ TBD) |
| OpenAI API | public | API key | (LLM provider — REQ TBD) |
| Custom (사내 LLM proxy / OpenAI 호환 서버) | Samsung 내부망 또는 사용자 지정 | API key 또는 사내 token | (LLM provider — REQ TBD) |

### 지원 LLM 환경 = 배포 config (provider-중립)

위 표의 LLM provider 5 종(custom / Azure OpenAI / Anthropic / Google / OpenAI)은 **코드에 박힌 선택이 아니라 배포-환경 설정(deployment-environment configuration)** 이다 ([ADR-0045](../decisions/ADR-0045-llm-provider-deployment-config.md) ACCEPTED). provider 선택은 런타임에서 `LlmProviderConfig` DB row(Admin 지정 endpoint/key/model)로, live-verification 에서 gating env(`LLM_LIVE_PROVIDER` + `LLM_LIVE_*`)로 표현되며 — provider 를 바꾸는 것은 코드 변경이 아니라 설정 변경이다. **어느 provider 도 default/mandated 가 아니다**: openai-compatible 로컬 런너(Ollama / LM Studio / vLLM 등, localhost 의 `/v1`)·Azure OpenAI·Anthropic·Gemini·기타 OpenAI-호환 cloud 가 모두 동등하게 valid 한 config 이며, 개발 머신이 로컬 LLM 으로 도는 것은 "여러 valid 환경 중 하나" 일 뿐 시스템에 baked-in 되는 게 아니다. live-verification(배선 검증)은 특정 cloud credential 의 유효성과 분리되어 "그 실행 환경이 가진 아무 provider 로 1회 round-trip" 이면 충족되므로, cloud 키 만료와 무관하게 영구 성립한다(자세히는 ADR-0045 — 검증과 품질은 분리해 기술). **default modelId 의 source 도 동일하게 `LlmProviderConfig` row 의 `modelId` 필드에서 해석된다** — caller(request body) 가 매 호출마다 default model 을 넘기는 구조 대신 server-side resolver 가 LlmProviderConfig row 1 회 조회로 결정한다(단일-row 운용 가정 + 다중-row 분기는 REQ-051 진입 시 후속 ADR 로 deferred — 자세히는 [ADR-0048](../decisions/ADR-0048-default-model-id-source.md) ACCEPTED).

### TLS / 사내 인증서 처리

사내 PKI (Samsung 사내 CA) 가 발급한 인증서를 trust 하기 위해 `NODE_EXTRA_CA_CERTS=/path/to/samsung-ca-bundle.pem` 환경변수 사용. Node.js 표준 메커니즘 — 별도 dependency 0. **`NODE_TLS_REJECT_UNAUTHORIZED=0` 사용 금지** (MITM 위험, 보안 사고 표면).

Public network 접근 시 corporate egress proxy 가 필요한 경우 표준 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 환경변수 사용 — Node.js 의 HTTPS stack 이 native 지원하므로 코드 변경 0.

> **`## 외부 네트워크 boundary` 전반부 (도입 문단 · `### 접근 대상 목록` · `### 지원 LLM 환경` · `### TLS / 사내 인증서 처리`) ↔ 실 `src/github/` · `src/confluence/` · `src/llm/` · `deploy/` 대조 (T-1439 실측 각주)** — 155 행의 **직접 outbound** 는 **참** 이다. `src/github/github-adapter.service.ts` 246 행 · `src/confluence/confluence-adapter.service.ts` 305 행 · `src/llm/llm-http-gateway.service.ts` 76 행이 모두 default `globalThis.fetch` 주입이고, `axios` · `undici` · `HttpModule` · `ProxyAgent` 는 `src/` 전체에서 **0 hit** 라 별도 proxy / bastion 계층이 실제로 없다.
> **GitHub 3 host 는 실재하나 Confluence host 는 고정형이 아니다** — `src/github/github-live-test-gating.ts` 59 · 64 · 69 행이 `github.com` · `github.sec.samsung.net` · `github.ecodesamsung.com` 을 그대로 열거한다 (단 public 만 API host 가 분리돼 `src/github/github-request.builder.ts` 29 행 `https://api.github.com` 으로 라우팅된다). 반면 `src/confluence/confluence-instance-config.ts` 는 46 행 `baseUrl: string` + 124 행 env `…_BASE_URL` **주입형** 이라, 표의 `confluence.sec.samsung.net` 은 하드코딩된 대상이 아니라 **예시값** 으로 읽어야 한다.
> **LLM provider 5 종은 명칭 · 개수 모두 일치** — `src/llm/llm-http-gateway.service.ts` 138 행이 `azure_openai / custom / openai / anthropic / google_gemini` 5 종만 지원으로 못박고, gating env 도 `src/llm/llm-live-test-gating.ts` 29 행 `LLM_LIVE_PROVIDER` 로 실재한다. 표의 `REQ TBD` 자체는 지금도 참이지만 (`docs/requirements.md` 66 REQ 중 LLM provider 전용 REQ **0**), 그 조건절 `P2 가 requirements.md 에 추가 시 부여` 는 P2 가 지난 현 시점 기준으로 낡은 표기다.
> **TLS / proxy 환경변수는 이미 운영 config 에 등재** — `deploy/env.prod.example` 42 ~ 44 행에 `NODE_EXTRA_CA_CERTS` · `HTTPS_PROXY` · `NO_PROXY` 가 (선택 항목 주석 형태로) 있고 `HTTP_PROXY` 만 미등재이며, 금지 대상 `NODE_TLS_REJECT_UNAUTHORIZED` 는 `src/` · `scripts/` 에서 **0 hit** 로 위반이 없다. 본 각주는 사실 기록이지 단락 재작성이 아니며, 운영 호스트 위치 가정 · 인증 방식 컬럼은 형태 무관 · 미측정이라 판정에서 뺐다 (판정 근거는 [REQ-COVERAGE-AUDIT § 12.37](../use-cases/REQ-COVERAGE-AUDIT.md)).

### 권한 부족 (REQ-020) 감지 흐름

```
Adapter (GithubAdapter / ConfluenceAdapter / LlmGatewayService)
  → 외부 HTTPS 호출 (axios / undici / NestJS HttpModule)
  → 4xx 응답 catch (특히 401 / 403)
  → PermissionDeniedEvent emit (NestJS EventEmitter)
  → NotificationService 가 수신 → Admin 알림 + 해당 User 알림
```

4xx 응답 분류 (token 만료 / scope 부족 / repo / space 비공개 / rate limit) 와 알림 채널 (in-app banner / email / 별도 채널) 의 구체 구현은 **P4 phase 의 도입 task 책임**.

### 운영 호스트 가정

본 단락은 운영 호스트가 corporate network 안에 있다고 가정. cloud-managed (AWS / Azure 등) 환경으로 이전 시 [ADR-0003](../decisions/ADR-0003-deployment.md) SUPERSEDE + 사내 endpoint reach 토폴로지 (사내 VPN tunnel / Direct Connect / ExpressRoute) 의 새 ADR 필요. 본 task 의 범위 밖.

구체 도입 — `NODE_EXTRA_CA_CERTS` 환경변수 setup / corporate proxy 설정 / adapter 의 4xx catch 코드 / 알림 channel — 은 모두 **P4 / P7 의 task 책임**.

> **`## 외부 네트워크 boundary` 후반부 (`### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정`) ↔ 실 `src/` · `prisma/schema.prisma` · `docs/requirements.md` 대조 (T-1440 실측 각주)** — 189 행 adapter 3 종 중 `GithubAdapter` (`src/github/github-adapter.service.ts` 237 행) · `ConfluenceAdapter` (`src/confluence/confluence-adapter.service.ts` 293 행) 는 실재하나 **`LlmGatewayService` 는 `src/` 0 hit** 이다 — 실체는 `src/llm/llm-http-gateway.service.ts` 74 행 `LlmHttpGateway implements LlmGateway` 이고 `src/llm` 에 권한 부족 emit 경로가 **0** 이라 이 흐름의 주체가 아니다. 190 행의 **`axios` · `undici` · NestJS `HttpModule` 은 `src/` 전체 0 hit 으로 거짓** — 실 transport 는 `globalThis.fetch` 주입 (github 246 행, 전반부 각주 승계) 이다.
> **191 행 4xx catch 는 참** (`mapNon2xx` — github 411 행 · confluence 491 행이 401/403 에서 emit 후 도메인 error throw). 192 행은 **부분참** — `PermissionDeniedEvent` 는 실재하나 (`src/` 32 hit) 전달 수단이 **NestJS `EventEmitter` 가 아니라** 자체 `PermissionDeniedEmitter` port + DI token (`PERMISSION_DENIED_EMITTER` · `CONFLUENCE_PERMISSION_DENIED_EMITTER`) 이다 — `EventEmitter` 는 `src/` **0 hit**, `@nestjs/event-emitter` 는 `package.json` **미등재**.
> **193 행은 거짓** — `NotificationService` 는 `src/` **0 hit** 이고 실 수신자는 `PersistingPermissionDeniedEmitter` (`src/permission-denied/persisting-permission-denied-emitter.ts` 34 행) → `PermissionDeniedRecordService.record` (109 행) → `prisma/schema.prisma` 513 행 `model PermissionDeniedRecord` 로 이어지는 **영속 record 경로** 다. Admin / User 인식은 push 알림이 아니라 `GET /api/permission-denied-records` **pull 조회** 이며 (`@Roles("User")`), Admin 은 전체 · User 는 자기 instance allowlist 범위다 (service 163 행 분기).
> **196 · 202 행의 시점 서술은 낡았다** — 권한 부족은 현 번호 체계에서 REQ-020 (`조직 기여 큰 인원 → 높은 점수`, P5 IN_PROGRESS) 이 아니라 **REQ-008 · REQ-016** 이고 둘 다 `DONE` · 현 phase 는 `P4-complete / P5-in-progress` 라 "P4 / P7 의 task 책임" 중 4xx 분류 (`deriveReason` — 401/403 · 404 까지, 429/5xx 는 대상 밖) 와 CA / proxy 환경변수는 이미 shipped 다. 다만 **알림 채널 (in-app banner / email / 별도 채널) 은 여전히 미구현** 이라 그 조각만 유효하며, `### 운영 호스트 가정` 은 운영 전제라 검증 불가로 판정에서 빼고 [ADR-0003](../decisions/ADR-0003-deployment.md) pointer 실재만 확인했다 (판정 근거는 [REQ-COVERAGE-AUDIT § 12.38](../use-cases/REQ-COVERAGE-AUDIT.md)).
