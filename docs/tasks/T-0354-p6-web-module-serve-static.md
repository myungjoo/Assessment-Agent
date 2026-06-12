---
id: T-0354
title: P6 frontend scaffold slice 2 — @nestjs/serve-static + src/web/ WebModule (운영 static serve + SPA fallback)
phase: P6
status: DONE
completedAt: 2026-06-12T16:12:02Z
prNumber: 287
mergedAs: a437d79
reviewRounds: 1
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 150
estimatedFiles: 8
sizeExempt: true
exemptReason: "scaffold wiring — lockfile 포함 8 파일 > 5 파일 cap 이나 각 파일 trivial (dep 1줄 / module wiring / route prefix 이전 / 테스트 path 동기), lockfile 제외 ~150 LOC. T-0353 선례와 동일한 planner-pre-justified 경로."
independentStream: p6-frontend-scaffold
dependsOn: []
touchesFiles:
  - package.json
  - pnpm-lock.yaml
  - src/web/web.module.ts
  - src/web/web.module.spec.ts
  - src/app.module.ts
  - src/app.controller.ts
  - test/smoke/app.smoke-spec.ts
  - test/e2e/app.e2e-spec.ts
created: 2026-06-13
plannerNote: "P6 scaffold chain slice 2/3 — cap-bend pre-justified: R-112 backbone × 1.5 ≈ 150 LOC·8파일(lockfile 포함), T-0353 패턴"
---

# T-0354 — P6 frontend scaffold slice 2: @nestjs/serve-static + src/web/ WebModule (운영 static serve + SPA fallback)

## Why

T-0353 (slice 1: pnpm workspace + `web/` Vite React SPA, PR #286 squash `2ec3bdd`) 의 Chain 계획에 박제된 **slice 2**. [ADR-0040](../decisions/ADR-0040-frontend-stack.md) §3 운영 결정 — monolithic 단일 NestJS process ([ADR-0003](../decisions/ADR-0003-deployment.md)) 가 `web/dist/` build 산출물을 정적 serve 하고, 비-`/api/*` 경로의 SPA fallback (`index.html`) 을 처리한다 — 를 구현한다 (REQ-038 시각화 UI 의 전달 경로 + REQ-048 same-origin 구조).

**새 dependency `@nestjs/serve-static` 승인 근거**: Q-0036 사용자 결정 (1) 이 "scaffold 범위 새 runtime dep §5 승인 포함" 을 명시했고, ADR-0040 §3·§5 (ACCEPTED) 가 본 패키지 도입을 결정해 뒀다 — CLAUDE.md §5 new-dep BLOCKED 게이트는 이 경로로 이미 통과. PR 본문에 dep 목록을 명시해 reviewer 가 게이트 충족을 확인한다.

**sanity endpoint 이전이 본 slice 에 포함되는 이유**: NestJS 는 controller route 가 serve-static 의 static/fallback handler 보다 우선한다 (route 등록이 `onModuleInit` 의 serve-static 등록보다 먼저). 현 `AppController` 의 `GET /` (`@Controller()` + `@Get()`) 가 잔존하면 운영에서 SPA root (`/` → `index.html`) 가 status 문자열에 가려져 ADR-0040 §3 의 fallback 이 root 에서 깨진다. ADR-0040 §2 경계 (backend 는 `/api/*` namespace, 비-`/api/*` 는 SPA 소유) 에 맞춰 sanity 를 `GET /api` 로 이전한다.

## Required Reading

- `docs/decisions/ADR-0040-frontend-stack.md` — §3 (운영 NestJS static serve + SPA fallback, `@nestjs/serve-static` + `src/web/` WebModule), §5 (PR 본문 dep 목록 명시 의무)
- `src/app.module.ts` — imports 배열 + 주석 convention (module 추가 시 주석 1~2줄 동반)
- `src/app.controller.ts` — sanity `GET /` 현 구조 (`@Controller()` → `@Controller("api")` 이전 대상)
- `test/smoke/app.smoke-spec.ts` + `test/e2e/app.e2e-spec.ts` — `GET /` 를 hit 하는 spec (path 동기 대상)
- `package.json` (root) — `@nestjs/common` 10.4.4 (peer 호환 — `@nestjs/serve-static` 은 **v4 라인** 채택, v5 는 Nest 11 요구)
- `scripts/check-spec-presence.sh` — 신규 `src/**/*.ts` 는 colocated `.spec.ts` 의무 (`src/web/web.module.spec.ts`)

## Acceptance Criteria

- [ ] root `package.json` dependencies 에 `@nestjs/serve-static` (v4 라인 — Nest 10 peer 호환) 추가. **이 외 새 dep 추가 금지**. `pnpm-lock.yaml` 재생성 → CI frozen-lockfile install green. PR 본문에 새 dep 목록 + 승인 근거 (ADR-0040 §3·§5 ACCEPTED + Q-0036 결정 1) 명시.
- [ ] `src/web/web.module.ts` 신설 — `WebModule`: `web/dist/index.html` **존재 시** `ServeStaticModule.forRoot({ rootPath: <web/dist 절대경로>, exclude: ['/api/(.*)'] })` (v4 path-to-regexp syntax — implementer 가 실 동작 검증) 를 등록하고, **부재 시 등록 0** (CI / dev 환경에 `web/dist` 가 없어도 부팅·smoke·e2e 가 무변경 green — branch 분기를 exported pure helper 함수로 같은 파일 안에 분리해 unit-testable 하게; 별도 helper 파일 신설 금지 — 파일 수 cap).
- [ ] `src/app.module.ts` 에 `WebModule` import 추가 (기존 주석 convention 따라 1~2줄 주석 동반).
- [ ] `src/app.controller.ts` — `@Controller()` → `@Controller("api")` 로 sanity endpoint 를 `GET /` → `GET /api` 이전 (응답 본문·`AppService.getStatus()` 무변경). `test/smoke/app.smoke-spec.ts` / `test/e2e/app.e2e-spec.ts` 의 요청 path 를 `/api` 로 동기.
- [ ] R-112 unit tests — `src/web/web.module.spec.ts` (colocated, check-spec-presence 통과):
  - happy-path 1+: dist (index.html 포함) 존재 시 helper 가 rootPath/exclude 를 담은 ServeStatic 옵션 (또는 dynamic module 등록) 반환.
  - error path 1+: 존재하지 않는 경로 입력 시 등록 0 (throw 없이 안전 반환).
  - branch: 존재/부재 2 분기 각 1+ test.
  - negative cases 충분 cover: dist 디렉토리는 있으나 `index.html` 부재 / 빈 문자열·비정상 경로 입력 각 1+ test.
- [ ] root 에서 `pnpm lint && pnpm build && pnpm test` green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) + `pnpm test:smoke` / `pnpm test:e2e` green (dist 부재 분기로 무변경 부팅 검증 포함).
- [ ] push 후 PR CI 전 step green 확인 (R-114) — approval-gate ordering fail 은 benignRedNote case A 절차 (rerun) 로 처리.

## Out of Scope

- `.github/workflows/ci.yml` 의 web build/test step 추가 — **slice 3** (본 PR 의 CI 는 dist 부재 분기로 기존 workflow 무변경 green 이어야 함).
- `docs/architecture/directory.md` "Frontend (web/) 의 위치" 갱신 + `scripts/check-spec-presence.sh` web/ 정책 + web coverage (vitest threshold) 정책 — **slice 3** (T-0353 Follow-ups).
- `web/` workspace 쪽 변경 (web/src · vite config 등) — 본 task 는 backend serve 측만.
- 로그인 화면 · `/api/*` 실 소비 SPA 코드 · 라우터/차트/상태관리 lib — 각 후속 task + ADR-0040 §5 게이트.
- `GET /api` sanity 응답 형식 변경 / health-check 확장 — 현행 status string 유지.
- ADR-0039 (timezone KST) impl chain — scaffold chain 완료 후.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 §3 이 serve 방식·모듈 위치 결정 완료)

## Follow-ups

- (reviewer M1 — 박제 의무) dist-존재 분기의 실 HTTP serve/fallback/exclude 동작 persisted test 부재 — 임시 NestFactory 부팅 spec 검증 후 폐기됨. slice 3 의 CI web build 도입 시 dist-존재 통합 검증 1+ 추가가 자연 위치 (serve-static v4→v5 / path-to-regexp 구문 변경 회귀 가드).
- (reviewer m2) `coveragePathIgnorePatterns` 의 `\.module\.ts$` 가 web.module.ts 를 coverage 측정에서 제외 — 분기 helper 가 threshold enforcement 밖. slice 3 에서 본 파일 ignore 예외 검토.
- (reviewer m3) `process.cwd()` 기준 WEB_DIST_PATH 가정 미문서화 — slice 3 doc 갱신(directory.md)에 cwd 가정 포함 + production dist 부재 시 boot log 1줄 추가 검토 (silent degradation 방지).
- (executor) serve-static loader 는 TestingModule.compile() 경로에서 NoopLoader — TestingModule 기반 smoke/e2e 로는 실 serve 검증 불가, 실 부팅(NestFactory.create) 경로 필요 (M1 과 동일 맥락).
- (executor) vite 8.0.16 peer warning: `@types/node ^20.19.0+` 요구 vs root `20.16.10` (T-0353 잔존, non-blocking).

## Result

DONE (2026-06-12 16:12Z) — PR #287 squash `a437d79`, reviewer round 1/7 APPROVE (blockers 0 / major 1 / minor 3). m1(stale 주석)은 nit-in-PR closure 로 afd7df4 에서 정정 (§3 3번 유형, T-0335 선례 동형 — reviewer 재호출 불요). 8파일 +220/-12 (lockfile 제외 ~190 LOC). head afd7df4 pull_request run 27427592813 first-pass green (approve comment 선재). 전역 coverage 100/99.75/100/100. 동시성 관측: cron@cloud-e86f43 16:08Z fire 가 활성 claim(PR_OPEN #287) 존중 no-op — 5b direct-only 규율 실증.
