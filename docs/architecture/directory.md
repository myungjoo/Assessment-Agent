# Directory structure

> **본 문서는 P2 의 산출물이다. [T-0021](../tasks/T-0021-p2-directory-structure.md) 가 NestJS 표준 디렉토리 구조 + 9 module ↔ `src/<module>/` 매핑 + `common/` / `config/` / `prisma/` / `test/` layout 을 박제했다. 본 task 머지로 Phase P2 의 "디렉토리 구조 정의" sub-bullet ([PLAN.md](../PLAN.md) L87) 가 닫힌다.**

## 개요

본 문서는 Assessment-Agent 의 **디렉토리 구조** — [modules.md](modules.md) (T-A4) 가 박제한 9 NestJS module (8 application module + PersistenceModule) 을 그대로 NestJS 표준 디렉토리 (`src/<module>/<module>.module.ts` + controller / service / dto / entities) 로 1:1 mapping 한 single source of truth — 를 박제한다. P3+ 의 implementer 가 새 module 디렉토리를 만들 때 "어디에 무엇을 둘지" 를 본 문서 한 곳만 보면 결정 가능하도록 한다.

본 디렉토리 구조의 기반 결정은 다음 ADR 이 박제했다:

- [ADR-0001](../decisions/ADR-0001-stack.md) §1 — NestJS framework + `@Module` decorator 가 본 디렉토리의 module 단위 분할을 자연 강제.
- [ADR-0003](../decisions/ADR-0003-deployment.md) §1 — Monolithic NestJS process 결정이 단일 `src/` root 를 정당화 (별도 worker 디렉토리 미도입).
- [ADR-0002](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma 가 root `prisma/` 디렉토리 (Prisma 표준 위치) 의 존재를 결정.

본 문서는 [INDEX.md](INDEX.md) 의 **MVA 원칙** 에 따라 작성됐다 — module 단위 디렉토리 + 표준 sub-dir + top-level `src/` 트리 + `common/` / `config/` / `prisma/` / `test/` layout **까지만** 박제한다. 구체 service class / 메서드 시그니처 / file-by-file 깊은 트리는 본 문서 범위 밖이며, P3+ 의 task 가 실제 디렉토리 / 파일을 생성할 때 본 문서를 Required Reading 으로 참조한다.

## Top-level 디렉토리 트리

repo root 의 상위 디렉토리 + `src/` 직접 하위만 (깊이 2 단). 본 task 시점에는 `src/` 안에 [T-0004](../tasks/T-0004-src-skeleton.md) 가 박제한 skeleton 만 존재 — 9 module 디렉토리는 P3+ 에서 생성되는 **blueprint** 다.

```
<repo root>/
├── src/                        ← NestJS application root (ADR-0001 / ADR-0003 §1)
│   ├── main.ts                 ← entry point (NestFactory.create + listen)
│   ├── app.module.ts           ← root composition (imports 9 module)
│   ├── auth/                   ← AuthModule (RBAC, guards)
│   ├── persistence/            ← PersistenceModule (Prisma client + repository 진입점)
│   ├── user/                   ← UserModule (평가 대상 인원 CRUD)
│   ├── github/                 ← GithubModule (3 instance adapter)
│   ├── confluence/             ← ConfluenceModule (사내 Confluence adapter)
│   ├── llm/                    ← LlmModule (5 provider gateway)
│   ├── assessment/             ← AssessmentModule (평가 orchestration + Worker)
│   ├── scheduler/              ← SchedulerModule (@nestjs/schedule)
│   ├── web/                    ← WebModule (@nestjs/serve-static, web/dist SPA serve — ADR-0040 옵션 1 shipped)
│   ├── common/                 ← shared decorators / filters / interceptors / pipes / dto
│   └── config/                 ← @nestjs/config 의 configuration loader + validation
├── prisma/                     ← Prisma 표준 위치 (ADR-0002)
│   ├── schema.prisma           ← schema-as-code (P3 에서 entity 정의)
│   └── migrations/             ← prisma migrate dev / deploy 산출 SQL (P3+)
├── test/                       ← unit 외 test layout
│   ├── smoke/                  ← *.smoke-spec.ts (T-0009)
│   ├── e2e/                    ← *.e2e-spec.ts (T-0010)
│   ├── jest-smoke.json         ← smoke 전용 Jest config
│   └── jest-e2e.json           ← e2e 전용 Jest config
├── web/                        ← frontend SPA 패키지 (React+Vite, ADR-0040 옵션 1 shipped — 아래 "Frontend" 단락)
├── docs/                       ← architecture / decisions / tasks / use-cases / progress
├── .github/workflows/          ← CI (T-0005)
├── package.json                ← pnpm workspace root (ADR-0001 §3)
└── README.md / CLAUDE.md       ← 요구사항 명세 + 운영 규칙
```

본 시점 (T-0021) 의 `src/` 실제 내용은 `main.ts` + `app.module.ts` + `app.controller.ts` + `app.service.ts` + `app.service.spec.ts` 의 skeleton — 9 module 디렉토리는 모두 미생성. P3 (Domain core) 의 첫 implementer task 가 `src/auth/auth.module.ts` 등을 생성하면서 본 문서의 trail 을 따른다.

## 각 module 디렉토리의 표준 sub-structure

NestJS `nest g module <name>` / `nest g controller <name>` / `nest g service <name>` 의 CLI default 를 그대로 따른다. 모든 module 디렉토리는 다음 4 항목을 공통으로 가진다:

- `<module>.module.ts` — `@Module({ imports, controllers, providers, exports })` 선언.
- `<module>.controller.ts` — HTTP endpoint (해당 module 이 endpoint 를 노출하는 경우만).
- `<module>.service.ts` — domain 로직.
- `<module>.service.spec.ts` — service 의 unit test (co-located, [Jest default](../tasks/T-0003-project-config.md)).

추가 sub-dir 은 module 별 책임에 따라 다음과 같이 표준화한다:

| sub-dir | 용도 | 채택 module |
| --- | --- | --- |
| `dto/` | request / response DTO class (`class-validator` decorator). [REQ-038](../requirements.md) 조회 endpoint 의 query DTO 등. | 모든 endpoint 가진 module (assessment / user / auth / web / scheduler) |
| `entities/` | domain entity 또는 Prisma generated type 의 re-export wrapper. raw text 컬럼 0 ([ADR-0002](../decisions/ADR-0002-db.md) §2). | assessment / user (domain entity 보유) |
| `guards/` | NestJS RBAC guard (`@UseGuards(RolesGuard)`). [REQ-044](../requirements.md) 의 3 권한 (SuperAdmin / Admin / User). | **auth** (전용) |
| `providers/` | external service provider 별 adapter (5 LLM provider — custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI). | **llm** (전용) |
| `adapters/` | 외부 시스템 instance 별 HTTP client wrapper. github 의 경우 3 instance (`com` / `sec` / `ecode`) 가 단일 adapter + sub-config 로 라우팅 ([components.md](components.md) "GitHub Adapter 묶음 결정"). | github / confluence |
| `repositories/` | Prisma client wrapping repository (`UserRepository.findActiveByGroupId(...)` 등). domain module 안에 두어 domain-cohesion 유지. | user / assessment (domain module 별로 보유) |

PersistenceModule 의 특수 sub-structure:

- `src/persistence/persistence.module.ts` — `@Global()` decorator 적용 + `PrismaService` export ([modules.md](modules.md) "DB Persistence 의 module 분리 결정" 참조).
- `src/persistence/prisma.service.ts` — `PrismaClient` 를 wrapping 하는 NestJS injectable. `onModuleInit` 에서 `$connect()`, `onModuleDestroy` 에서 `$disconnect()`.
- `src/persistence/prisma.service.spec.ts` — 연결 / 종료 lifecycle unit test (P3 에서).
- repository pattern 자체는 본 module 안에 모으지 **않고** 각 domain module 의 `repositories/` 에 둔다 (domain-cohesion 우선).

## 9 module 별 디렉토리 mapping

[modules.md](modules.md) §"Module 목록" 의 9 module 과 본 문서의 디렉토리 경로의 1:1 매핑. module 명은 PascalCase (`<Name>Module`), 디렉토리 명은 lowercase singular (`<name>/`) — NestJS CLI `nest g module <name>` default convention.

| module (modules.md) | 디렉토리 경로 | 표준 sub-dir | 비고 |
| --- | --- | --- | --- |
| **AuthModule** | `src/auth/` | `dto/`, `guards/` | guards/ 가 다른 module 의 controller 에서 `@UseGuards(RolesGuard)` 로 import. JWT/session 발급은 `auth.service.ts`. |
| **PersistenceModule** | `src/persistence/` | (특수 — `prisma.service.ts` 만, controller 없음) | `@Global()` 적용. PrismaService export. 모든 domain module 이 본 module 을 import. |
| **UserModule** | `src/user/` | `dto/`, `entities/`, `repositories/` | 평가 대상 인원 CRUD + group / part 소속 / activate-deactivate. controller endpoint 노출. |
| **GithubModule** | `src/github/` | `dto/`, `adapters/` | adapters/ 안에 단일 `github.adapter.ts` + 3 instance sub-config (com / sec / ecode). controller 미노출 (adapter only). |
| **ConfluenceModule** | `src/confluence/` | `dto/`, `adapters/` | adapters/ 안에 `confluence.adapter.ts` + 사내 Confluence sub-config. controller 미노출. |
| **LlmModule** | `src/llm/` | `dto/`, `providers/` | providers/ 안에 5 provider 별 adapter (`custom.provider.ts` / `azure-openai.provider.ts` / `anthropic.provider.ts` / `google-gemini.provider.ts` / `openai.provider.ts`). `llm.service.ts` 가 Admin 지정 modelId 로 라우팅. |
| **AssessmentModule** | `src/assessment/` | `dto/`, `entities/`, `repositories/` | 평가 orchestration service + 조회 controller (sort / filter / 시계열). [components.md](components.md) 의 Worker 책임을 본 module 의 service layer 로 흡수. |
| **SchedulerModule** | `src/scheduler/` | `dto/` | `@nestjs/schedule` SchedulerRegistry. controller 는 manual trigger endpoint 만 (또는 AssessmentModule 가 trigger endpoint 보유 — [deployment.md](deployment.md) §Scheduler). |
| **WebModule** | `src/web/` | (controller only) | `@nestjs/serve-static` 으로 repo-root `web/dist/` 를 mount + 비-`/api/*` SPA fallback (ADR-0040 옵션 1 shipped). SPA 소스는 repo-root `web/`. 자세히는 아래 "Frontend (web/) 의 위치" 단락. |

[modules.md](modules.md) 의 dependency graph 방향 (예: AssessmentModule → GithubModule import) 은 본 디렉토리 구조에 직접 영향 없음 — 디렉토리 위치는 각 module 의 독립이며, import 방향은 각 `.module.ts` 의 `imports: [...]` 선언에서만 결정.

## common/ shared utilities

NestJS 의 application-wide cross-cutting concern 을 위치시키는 표준 sub-dir. 본 프로젝트는 NestJS convention 의 minimum 만 채택하며, 실제 코드는 P3+ 에서 first-use 시점에 추가.

| sub-dir | 용도 | 예시 |
| --- | --- | --- |
| `src/common/decorators/` | custom NestJS decorator | `@CurrentUser()`, `@Roles('Admin')`, `@SkipAuth()` |
| `src/common/filters/` | exception filter (`@Catch()`) | `HttpExceptionFilter` (REQ-008 PermissionDeniedEvent 의 HTTP 응답 변환) |
| `src/common/interceptors/` | request / response interceptor | `LoggingInterceptor`, `TimeoutInterceptor` |
| `src/common/pipes/` | validation / transform pipe | `ValidationPipe` (class-validator), `ParseIntPipe` (NestJS 내장 외 custom) |
| `src/common/dto/` | 여러 module 이 공유하는 DTO | `PaginationQueryDto`, `DateRangeQueryDto` (REQ-038 시계열 조회 공통) |

`src/common/utils/` 또는 `src/common/types/` 같은 추가 sub-dir 은 first-use 시점에 도입 — 본 task 는 위 5 sub-dir 만 표준으로 박제.

## config/

`@nestjs/config` 표준 패턴. [ADR-0003](../decisions/ADR-0003-deployment.md) §2 의 secret env-only 결정을 코드 레벨로 구현하는 위치.

- `src/config/configuration.ts` — `export default registerAs('app', () => ({ ... }))` 형태로 env → typed config 매핑. ConfigModule 의 `load: [configuration]` 에 등록.
- `src/config/validation.ts` (옵션) — Joi 또는 zod schema 로 startup 시 env validation. invalid 시 process crash → fail-fast.
- `.env` / `.env.example` 위치는 repo root (NestJS / `@nestjs/config` 표준). `.env` 는 `.gitignore` 에 등록 (현재 보장은 P3 도입 task — [ADR-0003](../decisions/ADR-0003-deployment.md) §2 참조).

본 디렉토리 자체의 실제 코드는 [ADR-0003](../decisions/ADR-0003-deployment.md) §2 의 후속 task (P3 / P4 환경변수 schema 가 모이면) 가 도입.

## prisma/

[ADR-0002](../decisions/ADR-0002-db.md) 가 박제한 Prisma 의 표준 위치 — repo root 의 `prisma/` 디렉토리 (NOT `src/persistence/prisma/`).

- `prisma/schema.prisma` — schema-as-code single file. entity / relation / index / unique constraint. raw text 컬럼 미정의 ([ADR-0002](../decisions/ADR-0002-db.md) §2 / [REQ-032](../requirements.md)).
- `prisma/migrations/<timestamp>_<name>/migration.sql` — `prisma migrate dev` 가 schema diff 로 자동 생성한 SQL. git 으로 버전 관리 ([deployment.md](deployment.md) §Migration 정책).
- `prisma/seed.ts` (옵션) — 개발 환경 seed data. README 57 행 (export / restore) 의 dev convenience.

Prisma generated client 의 import path 는 `@prisma/client` (npm package) — 본 디렉토리에서 generate 된 client 는 `node_modules/.prisma/client/` 에 위치. `src/persistence/prisma.service.ts` 가 `PrismaClient` 를 import 하여 `extends PrismaClient` 패턴으로 wrapping.

본 디렉토리의 실제 schema 본문 정의는 P3 (Domain core) phase 의 별도 task 책임 — 본 task 는 **위치** 만 박제.

## test/ layout

[T-0003](../tasks/T-0003-project-config.md) / [T-0009](../tasks/T-0009-smoke-tests.md) (future) / [T-0010](../tasks/T-0010-e2e-tests.md) (future) 가 도입하는 3 종 test 의 위치 합의.

| 종류 | 위치 | Jest config | 도입 task |
| --- | --- | --- | --- |
| **unit** | `src/**/*.spec.ts` (production code 와 **co-located**) | `jest.config.json` (root) — NestJS default | T-0003 (현재 active) |
| **smoke** | `test/smoke/*.smoke-spec.ts` | `test/jest-smoke.json` (현존) | T-0009 (P0.5) |
| **e2e** | `test/e2e/*.e2e-spec.ts` | `test/jest-e2e.json` (현존) | T-0010 (P0.5) |

unit test 의 co-location 은 NestJS 표준 — `src/auth/auth.service.spec.ts` 가 `src/auth/auth.service.ts` 옆. file 간 cohesion 유지 + import 경로 짧음.

`pnpm test` = unit 만, `pnpm test:smoke` = smoke 만, `pnpm test:e2e` = e2e 만. CI 의 [R-113](../../CLAUDE.md) (smoke + e2e 도 CI) 강제는 [T-0009](../tasks/T-0009-smoke-tests.md) / [T-0010](../tasks/T-0010-e2e-tests.md) 머지 이후 active.

## Frontend (web/) 의 위치

종전 본 단락은 옵션 2 (NestJS 내부 정적 자산 serve) 를 default 로, 옵션 1 (별도 `web/` 패키지) 의 SPA framework 결정을 "P6 의 별도 ADR" 미래로 두었으나, 이 서술은 이제 stale 이다 — [ADR-0040](../decisions/ADR-0040-frontend-stack.md) (ACCEPTED) 이 **옵션 1 (별도 `web/` 패키지) 의 소스 위치 + 옵션 2 의 serve 방식을 결합 채택** 했고 shipped 됐다 ([modules.md](modules.md) "WebModule 의 frontend 분리" 단락과 동일 현실). `src/web/` 과 repo-root `web/` 의 역할은 다음과 같이 분리된다:

- **repo-root `web/`** — frontend SPA **소스** 패키지 (pnpm workspace). React + Vite (TypeScript), 소스 `web/src/`, build 산출물 `web/dist/`. backend `src/` 와 빌드 분리.
- **`src/web/`** — NestJS WebModule. `@nestjs/serve-static` 으로 `web/dist/` 빌드 **산출물을 serve** + 비-`/api/*` 경로를 SPA `index.html` 로 fallback (T-0354 shipped). 즉 `web/` = SPA 소스, `src/web/` = 그 빌드 산출물 serve 진입점.

repo-root `web/src/` 의 실제 구조 (디렉토리 단위 — composition-wiring 스트림 T-0353~T-0394, [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 이 조립·배선 완료):

- `web/src/components/` — 15 presentational 컴포넌트 (대시보드 시각화 · Admin 패널 · 인증 폼 등, props 소비 stateless).
- `web/src/views/` — 2 view 컨테이너 (`DashboardView` · `AdminView`, controlled lift-up 으로 상태 소유).
- `web/src/api/` — thin fetch hook (`apiClient` · `useApiResource` · `auth`, JWT cookie 자동 동반).
- `web/src/AppShell.tsx` — 전역 레이아웃 + 무라우터 view enum 전환 + R-78 배너 슬롯.
- `web/src/AuthGate.tsx` — 인증 게이트, `web/src/main.tsx` — Vite 진입점.

backend endpoint 미shipped 로 의도적 defer 된 잔여 (`ReEvaluationTriggerPanel` · `SchedulePanel` 미마운트, auto-polling, `GroupMember` mutation, import 결과 상세) 는 [modules.md](modules.md) "WebModule 의 frontend 분리" 단락이 이미 박제 — 본 directory.md 범위 밖이라 중복 박제하지 않는다.

## References

- [modules.md](modules.md) — T-A4 산출물. 본 문서의 9 module 매핑 source.
- [components.md](components.md) — T-A3 산출물. 본 문서의 module ↔ component 매핑 source.
- [deployment.md](deployment.md) — T-A2 산출물. monolithic NestJS process 결정이 본 디렉토리의 단일 `src/` root 를 정당화.
- [INDEX.md](INDEX.md) — architecture document 인덱스 + MVA 원칙.
- [ADR-0001](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest framework 기반.
- [ADR-0002](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma. `prisma/` 디렉토리 위치 결정의 source.
- [ADR-0003](../decisions/ADR-0003-deployment.md) — Monolithic process / secret env-only / `@nestjs/schedule` / direct egress 결정이 본 디렉토리 구조의 4 단락 (top-level / config / prisma / scheduler) 의 source.
- [README.md](../../README.md) L7-22 (REQ-005~007 GitHub 3 instance), L96-103 (REQ-049 / REQ-051~055 LLM 5 provider — `llm/providers/<name>.provider.ts` sub-dir 결정의 source).
- [ADR-0040](../decisions/ADR-0040-frontend-stack.md) — frontend 스택 결정. 옵션 1 (별도 `web/` React+Vite 패키지) + 옵션 2 serve 방식 결합 채택의 source.
- [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) — frontend composition-wiring 결정. `web/src/` 의 컴포넌트 ↔ view ↔ api 배선 구조의 source.
- [T-0021](../tasks/T-0021-p2-directory-structure.md) — 본 문서 신설 task.
- [T-0397](../tasks/T-0397-directory-md-web-frontend-doc-sync.md) — frontend(web/) 섹션 P6 closure doc-sync (ADR-0040 옵션 1 shipped 반영).

Refs: T-0021, T-0017, T-0016, T-0397, ADR-0001, ADR-0002, ADR-0003, ADR-0040, ADR-0041, REQ-002, REQ-005, REQ-006, REQ-007, REQ-015, REQ-026, REQ-032, REQ-038, REQ-044, REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055
