---
id: ADR-0001
title: Backend / language / package manager / test / CI 스택 확정 (NestJS, TypeScript, pnpm, Jest, GitHub Actions)
status: ACCEPTED
date: 2026-05-23
relatedTask: T-0002
supersedes: null
---

# ADR-0001 — Backend / language / package manager / test / CI 스택 확정

## Context

Assessment-Agent는 long-horizon 자율 에이전트가 README 명세를 따라 점진적으로 만들어 가는 시스템이다. 코드 작성을 시작하기 전에 **변경 비용이 가장 큰 다섯 가지 선택** — 백엔드 프레임워크, 언어, 패키지 매니저, 테스트 러너, CI — 을 박제하지 않으면 후속 task가 매번 같은 결정을 다시 추론하게 되어 context 가 낭비되고 일관성도 깨진다.

본 ADR은 [CLAUDE.md](../../CLAUDE.md) §1 의 "기술 스택 (확정)" 표에 이미 명시된 다섯 항목을 정식 ADR로 옮겨 박제하기 위한 것이다. 코드보다 결정 문서가 먼저라는 원칙([CLAUDE.md](../../CLAUDE.md) §1 끝줄)에 따라, [T-0003](../tasks/T-0003-project-config.md)·[T-0004](../tasks/T-0004-src-skeleton.md)·[T-0005](../tasks/T-0005-ci-pipeline.md) 가 본 ADR을 전제로 진행된다.

선택을 지배하는 외력은 다음과 같다.

- **README §성능 특성** (88–93행): 평가 대상자 100–200명, GitHub repo 50–100개, Confluence page 1000여건을 1시간 이내에 처리. 즉 I/O 다발 / 동시성 다발 워크로드. CPU-bound 가 아니므로 Node.js 의 이벤트 루프 모델이 자연스러운 fit 이다.
- **README §구현 과정에 대한 제약** (106–116행): well-known & well-maintained 라이브러리 사용, 중복 dependency 금지, unit + smoke + e2e 테스트 모두 CI 에서 자동 실행, PR 이 만들어지면 다른 agent 가 review.
- **에이전트 친화성**: 에이전트(LLM)가 코드를 생성·읽을 때 타입 힌트가 강하면 환각이 줄어든다. 동시에 framework 의 convention 이 명확할수록 "어디에 무엇을 둬야 하는지"를 에이전트가 추론 없이 결정할 수 있다.
- **단일 운영자 환경**: 본 프로젝트는 single-operator (myungjoo) 가 자기 머신에서 long-horizon 으로 굴린다. 무거운 인프라(Kubernetes, 별도 빌드 서비스) 는 부담이다.

## Decision

다음 다섯 가지를 본 프로젝트의 기본 스택으로 채택한다. 본 ADR 의 supersede 가 발생할 때까지 모든 task 는 이 스택을 따른다.

### 1. Backend framework — NestJS

NestJS 를 backend framework 로 채택한다.

NestJS 는 module / controller / provider / pipe / guard / interceptor 라는 **명시적인 layer convention** 을 가진 framework 이다. 에이전트가 새 기능을 추가할 때 "어디에 둬야 하는지"를 framework 자체가 강제하므로, 에이전트가 매번 디렉토리 구조를 재추론할 필요가 없다. DI(dependency injection) 컨테이너가 내장되어 있어 controller 와 service 의 결합도를 낮게 유지하기 쉽고, 같은 이유로 단위 테스트에서 의존성을 mock 하기 쉽다 — README 112행이 요구하는 "feature 내 기능 + 예외 + flow 를 대부분 커버하는 unit test" 와 잘 맞물린다.

또한 NestJS 는 OpenAPI 자동 생성(`@nestjs/swagger`), e2e 테스트 도구(`@nestjs/testing` + supertest) 를 1급으로 지원한다. 이는 README 113행이 요구하는 smoke / e2e 테스트를 추가 라이브러리 도입 없이 표준 경로로 작성하게 해 준다(별도 ADR 불필요).

### 2. Language — TypeScript

TypeScript 를 단일 backend 언어로 채택한다. JavaScript 직접 작성은 금지하고, `.ts` 파일과 `tsc` 컴파일을 거친다.

LLM 기반 에이전트는 정적 타입이 있을 때 환각(존재하지 않는 method 호출, 잘못된 인자 순서) 비율이 눈에 띄게 떨어진다. 에이전트가 매 turn fresh context 로 코드를 만지는 본 프로젝트에서는 이 효과가 특히 크다. `tsc --noEmit` 을 CI 의 첫 게이트로 두면(T-0005 범위), 에이전트가 만든 PR 중 명백한 실수가 review 전에 걸러진다.

TypeScript 는 NestJS 와 first-class 통합이며(`@nestjs/cli` 가 `.ts` 를 가정), Jest 와의 통합도 `ts-jest` 또는 `@swc/jest` 어느 쪽이든 표준 경로다. 즉 본 ADR 의 다른 선택들과 마찰 없이 결합한다.

### 3. Package manager — pnpm

pnpm 을 패키지 매니저로 채택한다. npm / yarn 은 사용하지 않는다.

pnpm 은 content-addressable store + symlink 구조로 디스크와 install 시간을 모두 줄인다. 본 프로젝트는 backend + (이후 ADR 로 결정될) frontend 의 monorepo 구조로 자라날 가능성이 높고, pnpm 의 workspace 지원이 yarn classic 보다 매끄럽고 yarn berry 의 PnP 같은 복잡한 사전지식을 요구하지 않는다.

또한 pnpm 의 strict mode 는 `package.json` 에 선언되지 않은 transitive dependency 를 import 하는 코드를 install 단계에서 막아 준다. 이는 README 108행 "이미 import 한 library 가 제공되는 기능을 위해 다른 library 를 다시 import 하지 않도록" 요구사항을 자동으로 enforce 하는 메커니즘이다 — 에이전트가 무심코 transitive dep 을 직접 쓰는 사고를 install 단계에서 탐지한다.

### 4. Test runner — Jest (+ supertest)

Unit 과 component 레벨 테스트는 Jest 로, HTTP layer e2e 테스트는 supertest 로 작성한다.

Jest 는 NestJS 의 default test runner 이며, `@nestjs/testing` 이 Jest 를 전제로 만들어져 있다. 따라서 NestJS 를 채택한 이상 Jest 를 채택하는 것이 자연스럽고, 다른 runner 를 고르면 framework 의 표준 경로를 벗어나 에이전트가 매번 우회 로직을 작성해야 한다(추론 비용 증가).

supertest 는 NestJS 의 e2e 테스트 공식 가이드가 사용하는 라이브러리로, `app.getHttpServer()` 와 결합하여 실제 HTTP 흐름을 인메모리로 검증한다. README 113행의 smoke / e2e 요구는 supertest 단일 라이브러리로 충족할 수 있다(별도 e2e framework 불필요).

### 5. CI — GitHub Actions

CI 플랫폼은 GitHub Actions 를 채택한다.

본 저장소는 이미 GitHub 에 호스팅되어 있고 reviewer / integrator agent 가 `gh` CLI 와 PR API 를 사용한다([CLAUDE.md](../../CLAUDE.md) §11). 같은 플랫폼에 CI 를 두면 PR check status, run log, secret 관리가 단일 권한 모델 안에서 일관되게 동작한다. 외부 CI(CircleCI, BuildKite 등) 를 도입하면 토큰 관리와 권한 모델이 두 군데로 갈리고, 이는 [CLAUDE.md](../../CLAUDE.md) §9 의 "외부 자격증명 BLOCKED" 정책과 충돌하기 쉽다.

GitHub Actions 는 작은 워크로드에 한해 무료 quota 가 충분하며, matrix build / cache action / artifact upload 같은 기본 기능이 모두 first-class 다. T-0005 에서 lint → typecheck → unit → e2e 의 4단 게이트를 단일 workflow YAML 로 구성한다.

## Consequences

### 긍정

- 다섯 가지 핵심 결정이 한 곳에 박제되어, 후속 task 의 에이전트가 매번 같은 추론을 반복하지 않는다. context 절약 효과가 크다.
- 모든 선택이 서로 first-class 통합이어서 glue 코드가 거의 필요 없다 (NestJS ↔ TypeScript ↔ Jest ↔ supertest 가 한 묶음).
- pnpm 의 strict mode 가 README 108행을 install 단계에서 자동 검증한다.
- GitHub Actions 와 GitHub PR 워크플로가 단일 권한 모델 안에 있어 reviewer / integrator agent 의 동작이 단순해진다.

### 부정

- Node.js 생태계 자체가 빠르게 움직이는 영역이라 framework / 라이브러리 major version 업그레이드 비용이 주기적으로 발생한다. 이는 별도 maintenance task 로 다룬다(현재는 follow-up 없음 — 첫 release 후 재평가).
- pnpm 의 strict node_modules 구조는 일부 오래된 라이브러리(특히 Babel 시대 tooling) 와 호환성 이슈가 있을 수 있다. 발생 시 해당 라이브러리 별로 `public-hoist-pattern` 을 `.npmrc` 에 추가해야 한다.
- TypeScript 컴파일 단계가 추가되어 cold start dev loop 가 순수 JS 대비 약간 느리다. `tsx` 또는 `@swc-node/register` 같은 빠른 transformer 도입은 본 ADR 의 범위 밖이며, 필요하면 별도 ADR.
- NestJS 의 DI 컨테이너는 첫 학습 비용이 있다. 본 프로젝트의 작성자는 에이전트이므로 학습 비용은 인간이 아니라 context 사용량으로 전가된다 — 다행히 NestJS docs 는 잘 정돈되어 있어 architect 가 필요 시 WebFetch 로 참조 가능.

### 중립

- 본 ADR 은 **백엔드 런타임만** 다룬다. Frontend / DB / LLM 클라이언트 / queue / cache 같은 컴포넌트는 별도 ADR 에서 결정한다(아래 "범위 밖" 참조).
- 본 ADR 의 선택은 모두 OSS 이며 추가 외부 자격증명을 요구하지 않는다. 따라서 [CLAUDE.md](../../CLAUDE.md) §5 의 BLOCKED 조건에 해당하지 않는다.

## Alternatives considered

### Express + tsx (대안 1)

Express 는 Node.js 생태계에서 가장 잘 알려진 minimal framework 이고 tsx 는 TypeScript 를 직접 실행하는 도구다. "가벼움" 이라는 장점이 있지만, 본 프로젝트에서 가장 큰 비용은 인간의 학습 곡선이 아니라 **에이전트가 매 turn 새 코드를 어디에 둘지 추론하는 비용**이다. Express 는 디렉토리 구조 convention 이 없어 에이전트가 매번 "controller 를 어디에?" "validation 을 어디에?" 를 결정해야 한다. 또한 DI / pipe / guard 같은 cross-cutting 기능을 직접 만들어야 하므로 결과적으로 NestJS 의 sub-set 을 재발명하게 된다 — **기각**.

### Fastify + 자체 layer (대안 2)

Fastify 는 Express 보다 빠른 vanilla HTTP framework 다. 성능 이점은 분명하지만 본 프로젝트의 워크로드는 외부 LLM / GitHub / Confluence API 호출이 dominate 하므로 framework 자체의 RPS 차이는 무의미하다(병목은 외부 I/O). NestJS 는 Fastify 를 adapter 로 underneath 에서 쓸 수도 있으므로(`@nestjs/platform-fastify`), 만약 추후 측정 결과 Express adapter 가 병목이 되면 그 시점에 새 ADR 로 Fastify adapter 로 전환 가능하다 — **현재 시점에서는 기각**, 단 미래 옵션은 열어 둔다.

### npm (대안 3)

npm 은 Node.js 가 기본 번들하는 패키지 매니저로 추가 설치가 불필요하다는 장점이 있다. 단, package-lock.json 이 거대해지고 install 속도가 pnpm 의 1/3 ~ 1/5 수준이며, 무엇보다 transitive dep 누락 import 를 막지 못한다(README 108행 enforce 메커니즘 없음). pnpm corepack 은 Node 18+ 에 기본 포함되어 install 부담도 거의 없다 — **기각**.

### yarn classic / berry (대안 4)

yarn classic 은 maintenance mode 이고 yarn berry 의 PnP 는 NestJS / Jest / 기타 라이브러리와 빈번한 호환성 이슈가 보고된다. 추가로 yarn berry 는 자체 plugin 시스템 학습이 필요하다 — **기각**.

### vitest (대안 5)

vitest 는 Vite 생태계의 빠른 test runner 다. ESM 친화적이고 watch 모드가 빠르다는 장점이 있지만, NestJS 의 `@nestjs/testing` 이 Jest API 를 가정하고 만들어져 있어 vitest 를 쓰면 어댑터 코드가 필요하고 e2e 가이드도 자체 작성해야 한다. README 가 요구하는 unit/smoke/e2e 3종을 모두 단일 runner 로 표준 경로로 처리하려면 Jest 쪽이 마찰이 적다 — **기각**.

### 자체 호스팅 CI / CircleCI (대안 6)

CircleCI 등 외부 CI 는 무료 quota 와 기능이 GitHub Actions 와 비슷하지만 토큰 / secret 관리가 두 군데로 갈린다. 자체 호스팅 CI 는 single-operator 환경에서 운영 부담이 너무 크다 — **기각**.

## 범위 밖 (deferred to future ADRs)

본 ADR 은 다음 항목을 **결정하지 않는다**. 각각은 별도 ADR 에서 결정한다.

- **DB 선택** (PostgreSQL vs SQLite vs 기타 / Prisma vs TypeORM 등) — Phase P2 진입 시 ADR-0002 로.
- **Frontend 선택** (React + Vite, SvelteKit, 기타) — Phase P5 직전에 별도 ADR 로.
- **LLM client / SDK 선택** (anthropic SDK, openai SDK, custom HTTP client) — Phase P3 진입 시 별도 ADR 로.
- **Queue / job runner** (BullMQ, Temporal, 자체 cron) — 필요해질 때 별도 ADR 로.
- **Cache layer** (Redis 등) — 측정 후 필요하면 별도 ADR 로.
- **로깅 / observability 라이브러리** (pino, winston, OpenTelemetry) — 첫 e2e 작성 후 별도 ADR 로.
- **`package.json` / `tsconfig.json` / `.npmrc` 실제 작성** — [T-0003](../tasks/T-0003-project-config.md) 의 일.
- **`src/` 디렉토리 구조와 첫 NestJS 모듈 작성** — [T-0004](../tasks/T-0004-src-skeleton.md) 의 일.
- **GitHub Actions workflow YAML 작성** — [T-0005](../tasks/T-0005-ci-pipeline.md) 의 일.

본 ADR 이 박제한 것은 다섯 가지 도구의 **선택 자체**이지, 그 도구들의 **구성 파일과 코드** 가 아니다.

## References

- [CLAUDE.md](../../CLAUDE.md) §1 — 기술 스택 (확정) 표
- [CLAUDE.md](../../CLAUDE.md) §5 — HITL 정책 (새 dependency / 외부 자격증명 BLOCKED 룰)
- [CLAUDE.md](../../CLAUDE.md) §9 — 안전장치 (새 dependency 추가 BLOCKED)
- [CLAUDE.md](../../CLAUDE.md) §12 — 언어 정책
- [README.md](../../README.md) §성능 특성 (88–93행) — I/O 다발 워크로드 특성
- [README.md](../../README.md) §구현 과정에 대한 제약 (106–116행) — 라이브러리 / 테스트 / CI 요구사항
- [T-0001](../tasks/T-0001-bootstrap-stack-and-ci.md) — 원본 부트스트랩 task (T-0002~T-0005 로 split 되기 전)
- [T-0002](../tasks/T-0002-adr-0001-stack.md) — 본 ADR 을 만든 task
- NestJS docs: <https://docs.nestjs.com/>
- pnpm docs: <https://pnpm.io/>
- Jest docs: <https://jestjs.io/>
- supertest: <https://github.com/ladjs/supertest>
- GitHub Actions docs: <https://docs.github.com/actions>
