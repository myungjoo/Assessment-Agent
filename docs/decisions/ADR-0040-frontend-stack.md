---
id: ADR-0040
title: Frontend stack 결정 (React + Vite, NestJS 경계, build/serve 통합, web/ 구조)
status: ACCEPTED
date: 2026-06-11
relatedTask: T-0351
supersedes: null
---

# ADR-0040 — Frontend stack 결정 (React + Vite, NestJS 경계, build/serve 통합, web/ 구조)

## Context

Q-0035 RESOLVED — 사용자가 옵션 (4) **P6 frontend 진입** 을 선택했다. [CLAUDE.md](../../CLAUDE.md) §1 기술 스택 표의 Frontend 행은 "별도 ADR로 결정 — 기본 후보: React + Vite, P6 진입 시" 를 명시하고, [PLAN.md](../PLAN.md) Phase P6 (로그인/SuperAdmin 셋업 · 시각화 대시보드 · Admin 패널 · R-78 평가 진행 중 시각화 보호) 의 어떤 UI 구현 task 보다 본 stack ADR 이 선행해야 한다 ("코드보다 ADR이 먼저다").

선택을 지배하는 외력:

- **REQ-038** ([README.md](../../README.md) "평가 자료의 시각화와 UI"): 이름/ID/지표별 sorting + filtering + 일/주/월 시계열 변화를 인물·집단·전체·filter 인원 단위로 시각화. 즉 **client-side interaction (sort/filter 토글, 차트 갱신) 이 잦은 dashboard 워크로드**.
- **REQ-048** ([README.md](../../README.md) "성능 특성"): 저장된 평가 결과 조회 시 로딩 + 시각화 3초 이내. 데이터는 이미 backend 에 영속화되어 있으므로 병목은 API round-trip + 렌더링 — SSR 없이 SPA + JSON fetch 로 충분히 도달 가능한 수준 (100~200 명 규모).
- **REQ-042 / R-78** ([README.md](../../README.md) "평가 실행 제약 사항"): 평가 진행 중에는 기존 자료만 표시 + 상단 경고 배너 — frontend 측 상태 분기 책임이 있다 (아래 §6).
- **기존 backend 자산**: `/api/*` REST contract ≈ 50 endpoint ([api.md](../architecture/api.md)) + JWT HttpOnly cookie 인증 ([ADR-0008](ADR-0008-auth-credential-type.md)) + monolithic 단일 NestJS process ([ADR-0003](ADR-0003-deployment.md), [deployment.md](../architecture/deployment.md)) 이 이미 shipped — frontend 는 이 contract 의 **소비자**로만 진입해야 backend 변경 0 으로 P6 를 시작할 수 있다.
- **에이전트 친화성** ([ADR-0001](ADR-0001-stack.md) Context 와 동일 논리): LLM 에이전트가 코드를 생성하므로 생태계 최대 / convention 명확 / TypeScript first-class 인 선택이 환각·재추론 비용을 줄인다.

본 ADR 은 **결정 전용 0 LOC** — 실 패키지 추가는 본 ADR ACCEPTED 후 별도 task (§5).

## Decision

### 1. Frontend framework / build — React + Vite (TypeScript)

**React 18+ (SPA) + Vite (build/dev server) + TypeScript** 를 채택한다.

- **REQ-038 적합**: sort/filter/시계열 dashboard 는 상태 변화에 따른 부분 re-render 가 핵심 — React 의 선언적 상태 모델이 표준 경로다. 차트/테이블 라이브러리 생태계 (도입 시 별도 §5 게이트) 도 React 가 가장 넓다.
- **REQ-048 적합**: 데이터 조회는 `/api/*` JSON fetch — SPA 가 정적 자산을 1회 로드 후 API 만 호출하므로 100~200 명 규모 데이터의 3초 이내 시각화는 SSR 없이 충족 가능. Vite 의 code-splitting / production build (rollup) 이 초기 로드를 가볍게 유지한다.
- **에이전트 친화**: React + Vite + TS 는 LLM 학습 데이터에서 가장 흔한 frontend 조합 — 환각이 적고, Vite 의 convention (`index.html` 진입 + `src/main.tsx`) 이 디렉토리 재추론을 없앤다.
- **backend 와 정합**: TypeScript 단일 언어 ([ADR-0001](ADR-0001-stack.md) §2) 가 frontend 까지 이어져 DTO shape 공유·재사용 경로가 열린다 (공유 방식 자체는 후속 task — 본 ADR 미결정).
- 상태관리/라우터/차트 등 **추가 라이브러리는 본 ADR 이 결정하지 않는다** — 각각 도입 시점에 §5 new-dep 게이트 + 필요 시 별도 ADR.

### 2. NestJS 와의 경계 — SPA 는 기존 `/api/*` REST contract 의 순수 소비자

- **API contract**: frontend 는 [api.md](../architecture/api.md) 의 기존 `/api/*` endpoint 만 소비한다. frontend 사정으로 endpoint 를 신설/변경하려면 api.md 갱신 + 별도 backend task — frontend task 가 `src/` 를 직접 만지지 않는다 (경계 불변).
- **인증 흐름**: [ADR-0008](ADR-0008-auth-credential-type.md) 의 JWT HttpOnly Secure SameSite=Strict cookie (access 15min + refresh 7day rotation) 를 그대로 사용. SPA 는 token 을 저장/접근하지 않고 (HttpOnly — XSS 표면 차단), `POST /api/auth/login` → cookie 발급 → 이후 요청 자동 동반 → 401 시 `POST /api/auth/refresh` 재시도 → 실패 시 로그인 화면 전환의 표준 흐름만 구현한다.
- **CORS**: **도입하지 않는다 (CORS 설정 0)**. 아래 §3 의 same-origin 구조 (운영 = NestJS 가 SPA serve, 개발 = Vite dev proxy) 에서 browser 는 항상 same-origin 으로 `/api/*` 를 호출하므로 cross-origin 표면 자체가 없다. SameSite=Strict cookie 와도 정합 (cross-site 전송 불요). 별도 정적 호스팅으로 전환해 CORS 가 필요해지면 본 ADR SUPERSEDE 또는 갱신.

### 3. build / serve 통합 — 개발 Vite dev proxy / 운영 NestJS static serve

- **개발**: `vite dev` server (default port 5173) 가 SPA 를 serve 하고, `vite.config.ts` 의 `server.proxy` 로 `/api` → NestJS (localhost:3000) 에 forward. browser 관점 same-origin 이므로 cookie 인증·CORS 문제 없이 HMR 개발 흐름이 성립한다.
- **운영**: [deployment.md](../architecture/deployment.md) 의 monolithic 단일 NestJS process 결정과 정합하게, **NestJS 가 `web/dist/` build 산출물을 정적 serve** 한다 ([directory.md](../architecture/directory.md) "Frontend (web/) 의 위치" 의 옵션 2 serve 방식 + 옵션 1 소스 위치의 결합). `@nestjs/serve-static` 으로 `src/web/` WebModule 이 `web/dist/` 를 mount 하고, 비-`/api/*` 경로의 SPA fallback (`index.html`) 을 처리한다. `@nestjs/serve-static` 도입 자체도 새 dependency — §5 게이트 적용.
- **별도 정적 호스팅 (nginx / CDN) 기각**: single-operator + monolith 운영 ([ADR-0003](ADR-0003-deployment.md)) 에서 process 1 개 유지가 배포·secret·TLS 표면을 최소화한다. 규모/성능 사유 발생 시 별도 ADR 로 전환 (그때 CORS 도 함께 재결정).

### 4. `web/` 디렉토리 구조 — repo root `web/` + pnpm workspace

- **위치**: repo root 의 **`web/`** ([CLAUDE.md](../../CLAUDE.md) §6 파일 맵의 `web/ — (P6) Frontend` 위치 확정, [directory.md](../architecture/directory.md) 옵션 1 의 소스 위치 채택). frontend 소스는 `web/src/`, build 산출물은 `web/dist/` (gitignore — CI/배포 시 build).
- **패키지 관리**: **pnpm workspace** 채택 — repo root 에 `pnpm-workspace.yaml` (`packages: ["web"]` — root package.json 의 backend 는 현행 유지) + `web/package.json` 별도 패키지. [ADR-0001](ADR-0001-stack.md) §3 이 "monorepo 로 자라날 가능성 + pnpm workspace 지원" 을 채택 근거로 이미 박제했다. 단일 lockfile (`pnpm-lock.yaml`) 로 dependency 가 한 곳에서 검토되고 ([CLAUDE.md](../../CLAUDE.md) §9 new-dep 게이트의 가시성), strict mode 가 frontend 에도 동일 적용된다.
- **독립 package.json (workspace 미사용) 기각**: lockfile 이 2 개로 갈려 dependency 검토 표면이 분산되고, CI 의 install/cache 경로도 이중화된다.
- backend `src/` 와 frontend `web/` 의 빌드는 분리 — 기존 `pnpm build` (NestJS tsc) 는 불변, frontend 는 `pnpm --filter web build` 류의 분리 스크립트 (구체 스크립트·CI step 추가는 scaffold task 책임).

### 5. 새 dependency 도입 절차 — 본 ADR 은 결정 전용, 실 패키지 추가는 ACCEPTED 후 별도 task

본 ADR 은 **0 LOC 결정 문서**다. `react` / `vite` / `@nestjs/serve-static` 등 실 패키지 추가 (`pnpm create vite` scaffold, `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` 변경) 는 [CLAUDE.md](../../CLAUDE.md) §5 "새 외부 dependency 추가 = BLOCKED → 사용자 승인 후 ADR → 추가" + §9 게이트에 따라 **본 ADR 이 ACCEPTED 로 flip 된 후 별도 scaffold task** 에서 수행한다. 본 ADR 의 PROPOSED → ACCEPTED flip 자체가 그 승인 경로다 (stack 결정 ADR 은 사용자/reviewer 검토 대상). scaffold task 의 PR 은 새 dependency 목록을 PR 본문에 명시해 reviewer 가 §5 게이트 충족 (본 ADR ACCEPTED) 을 확인한다.

### 6. R-78 (REQ-042) 시각화 보호의 frontend 측 책임

"평가 진행 중에는 기존 자료만 표시 + 상단 경고 배너" 는 frontend 가 **평가 실행 상태를 조회해 배너를 토글하고, 조회 화면은 이미 영속화된 데이터만 fetch** 하는 구조로 충족한다. SPA 는 어차피 영속 데이터를 `/api/*` 로 읽으므로 "기존 자료만 표시" 는 자연 충족되고, 추가 책임은 (a) 실행 상태 polling (상태 endpoint 는 P5/P7 의 evaluation run 상태 자산 — 부재 시 backend task 선행) + (b) 전역 배너 컴포넌트 2 가지다. React 의 전역 상태 + 조건부 렌더가 이 패턴의 표준 경로라는 점이 §1 채택을 보강한다 — SSR 프레임워크라면 페이지 재생성 단위라 polling 기반 배너가 오히려 부자연스럽다. 구체 polling 주기·endpoint 는 P6 dashboard task 책임.

## Consequences

### 긍정

- frontend 가 기존 `/api/*` + JWT cookie contract 의 순수 소비자로 진입 — backend 변경 0 으로 P6 시작 가능, 경계가 명확해 frontend/backend task 가 독립 진행된다.
- same-origin 구조로 CORS·token 저장 등 보안 표면 추가 0 (HttpOnly cookie 그대로).
- pnpm workspace 단일 lockfile 로 new-dep 게이트 (§5/§9) 의 검토 표면이 한 곳 유지.
- React + Vite + TS 는 에이전트 환각이 가장 적은 조합 — long-horizon 코드 생성 비용 절감.

### 부정

- SPA 는 초기 bundle 로드 비용이 있다 — REQ-048 (3초) 위반 징후 시 code-splitting / lazy route 로 대응, 그래도 부족하면 별도 ADR (SSR 전환 등).
- monolith static serve 는 frontend 배포가 backend 재시작과 묶인다 — 현 single-operator 규모에서 수용, 분리 필요 시 별도 ADR.
- pnpm workspace 전환 시 CI install/cache 경로 갱신이 필요하다 — scaffold task 의 책임 범위로 박제.

### 중립

- 차트/상태관리/라우터 라이브러리, DTO 타입 공유 방식, e2e (browser) 테스트 도구는 본 ADR 미결정 — 각 도입 시점에 §5 게이트 + 필요 시 별도 ADR.
- [directory.md](../architecture/directory.md) "Frontend (web/) 의 위치" 단락은 본 ADR ACCEPTED 후 결정 반영 갱신 (옵션 1 소스 위치 + 옵션 2 serve 방식 결합) — 별도 doc task.

## Alternatives considered

### Next.js (대안 1)

SSR/file-routing 이 내장된 React meta-framework. 그러나 본 시스템은 사내 인증 뒤의 dashboard — SEO 무의미, SSR 이점 없음. Next 자체가 Node server 를 요구해 monolithic NestJS 1-process 결정 ([ADR-0003](ADR-0003-deployment.md)) 과 충돌 (process 2 개 또는 static export 로 기능 절단). 운영 표면과 학습 표면만 늘어난다 — **기각**.

### Vue + Vite (대안 2)

Vite 와의 통합은 동급으로 우수하나, React 대비 생태계·LLM 학습 데이터 양에서 열위 — 에이전트 환각 비용이 상대적으로 크다. CLAUDE.md §1 의 기본 후보 (React) 를 뒤집을 적극적 근거 부재 — **기각**.

### SPA 없음 — server-rendered 템플릿 (대안 3)

NestJS + 템플릿 엔진 (hbs 등) 으로 화면을 server-render 하면 새 빌드 체인이 없다는 장점. 그러나 REQ-038 의 sort/filter/시계열 인터랙션을 매번 full page reload 로 처리하면 REQ-048 (3초) 체감이 나빠지고, R-78 배너 같은 실시간 상태 토글도 부자연스럽다. 차트 시각화는 결국 client-side JS 가 필요해 어중간한 혼합이 된다 — **기각**.

## 범위 밖 (deferred)

- 실 scaffold (`pnpm create vite`, `pnpm-workspace.yaml`, `@nestjs/serve-static` wiring, CI step) — ACCEPTED 후 별도 task chain.
- `src/web/` WebModule 의 실 구현 / SPA fallback 라우팅 코드 — 후속 impl task.
- 차트·상태관리·라우터 라이브러리 선택, DTO 타입 공유, browser e2e 도구 — 각 별도 결정.
- PROPOSED → ACCEPTED flip — 사용자 검토 후 direct 한 줄 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 4).

## References

- [CLAUDE.md](../../CLAUDE.md) §1 (Frontend 행) / §5·§9 (new-dep 게이트) / §6 (`web/` 위치)
- [README.md](../../README.md) "평가 자료의 시각화와 UI" (REQ-038) / "평가 실행 제약 사항" (REQ-042, R-78) / "성능 특성" (REQ-048)
- [docs/PLAN.md](../PLAN.md) Phase P6 — Web UI
- [ADR-0001](ADR-0001-stack.md) — TypeScript / pnpm workspace 근거의 source
- [ADR-0003](ADR-0003-deployment.md) / [deployment.md](../architecture/deployment.md) — monolithic 1-process (serve 통합 결정의 전제)
- [ADR-0008](ADR-0008-auth-credential-type.md) — JWT HttpOnly cookie (인증 연동의 전제)
- [docs/architecture/api.md](../architecture/api.md) — `/api/*` contract (frontend 소비 대상)
- [docs/architecture/directory.md](../architecture/directory.md) — "Frontend (web/) 의 위치" 옵션 1/2 (본 ADR 이 결합 채택)
- Vite docs: <https://vitejs.dev/> / React docs: <https://react.dev/>
