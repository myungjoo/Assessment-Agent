---
id: T-0406
title: web-static serve-static 통합 smoke spec 신설 (T-0355 잔여 ① — T-0354 M1 회귀 가드)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 90
estimatedFiles: 1
dependsOn: []
touchesFiles:
  - test/smoke/web-static.smoke-spec.ts
independentStream: p6-frontend-scaffold
created: 2026-06-14
plannerNote: "T-0355 잔여 4 AC 중 단일 pr-slice 분리 — web-static smoke spec(T-0354 M1 dist-존재 통합 검증). nextFreeId T-0406, T-0405 직후. 나머지 잔여(coverage 포함·self-test 케이스·directory.md=T-0397에서 이미 sync)는 Follow-up."
hqOrigin: null
---

# T-0406 — web-static serve-static 통합 smoke spec 신설

## Why

T-0355(scaffold slice 3)의 핵심 CI-wiring AC 는 T-0405(PR #326, `4566f7c`)로 분리·완료됐고, ci.yml 의 web build/test step 이 머지됐다. T-0355 잔여 4 AC 중 **dist-존재 통합 검증**(T-0354 reviewer M1)이 가장 깨끗한 단일 `pr` slice 다 — serve-static 의 실 serve / SPA fallback / `/api/*` exclude 동작을 회귀 가드하는 smoke spec(`test/smoke/web-static.smoke-spec.ts`)이 아직 부재(grep 0)하다. CLAUDE.md §3.2 R-113(smoke + e2e 도 CI 에서 함께 수행) 정합이 본 task 의 근거이며, T-0354 가 박제한 `resolveServeStaticOptions`(dist 존재/부재 분기)의 실 부팅 layer 검증을 추가한다.

핵심 제약(T-0354 executor note): `Test.createTestingModule().compile()` 경로는 serve-static 을 **NoopLoader** 로 등록해 실제 static serve 가 일어나지 않는다. 따라서 본 spec 은 반드시 **`NestFactory.create(AppModule)`** 실 부팅 경로를 써야 serve-static 이 실제로 동작한다.

## Required Reading

- `test/smoke/app.smoke-spec.ts` — 기존 smoke spec 패턴(supertest + INestApplication lifecycle + GET /api sanity, GET 404). **단 본 task 는 compile() 이 아니라 NestFactory.create 를 써야 함에 주의.**
- `src/web/web.module.ts` — `resolveServeStaticOptions`(dist 존재/부재 분기) · `WEB_DIST_PATH`(=`join(process.cwd(), "web", "dist")`) · `API_EXCLUDE_PATTERN`(`/api/(.*)`) · `@Module` imports 구성.
- `src/app.service.ts` — `APP_STATUS_MESSAGE`(GET /api sanity body anchor — 기존 smoke 와 동일 import 패턴).
- `test/jest-smoke.json` — `testRegex: .*\.smoke-spec\.ts$`(신규 spec 자동 pickup) · `globalSetup`(DATABASE_URL 필요) · `maxWorkers: 1`.
- `test/helpers/jest-smoke-setup.ts` — globalSetup 이 DATABASE_URL fail-fast + truncate 1회(본 spec 의 DB 의존성 맥락 이해용 — 신규 spec 자체는 DB 사용 안 하나 AppModule 부팅이 Prisma 를 포함).
- `docs/decisions/ADR-0040-frontend-stack.md` §3(운영 serve + SPA fallback) · §2(`/api/*` namespace 경계).

## Acceptance Criteria

- [ ] `test/smoke/web-static.smoke-spec.ts` 신설 — **`NestFactory.create(AppModule)`** 실 부팅 경로 사용(`TestingModule.compile()` 금지 — serve-static NoopLoader 회피, T-0354 executor note). `beforeAll` 에서 app 생성·`init()`, `afterAll` 에서 `close()`.
- [ ] **dist 존재/부재 2 분기 guard**: `existsSync(join(WEB_DIST_PATH, "index.html"))`(또는 동등 판정)로 `web/dist/index.html` **부재 시 본 describe/케이스 전체 skip**(로컬 미빌드 환경에서 green), **존재 시** 실 검증 케이스 실행. 두 분기 모두 spec 안에 명시(branch cover).
- [ ] **happy-path 1+**(dist 존재 시): `GET /` 가 200 + `web/dist/index.html` 본문(또는 SPA index 임을 식별할 수 있는 마커)을 serve.
- [ ] **flow 1+**(dist 존재 시): 미지의 비-`/api` 경로(예: `GET /dashboard`)가 SPA fallback 으로 index.html(200)을 반환 — serve-static fallback 동작 검증.
- [ ] **sanity 1+**(dist 존재 시): `GET /api` 는 여전히 `APP_STATUS_MESSAGE`(200) — controller route 가 static fallback 보다 우선임을 검증.
- [ ] **negative 1+**(dist 존재 시): `GET /api/<없는경로>`(예: `GET /api/__none__`) 는 404 — `API_EXCLUDE_PATTERN` 으로 인해 static fallback 이 `/api/*` 를 가로채지 **않음**을 검증(exclude 동작의 negative 가드).
- [ ] R-110: production code 변경 0 이라도 tester 가 root `pnpm lint && pnpm build` + `pnpm test:smoke` 를 로컬 green 확인. (DATABASE_URL 주입 필요 — 미주입 시 globalSetup fail-fast 이므로 로컬 검증 시 DB env 설정.)
- [ ] R-113: 신규 spec 이 `pnpm test:smoke`(jest-smoke.json testRegex) 로 자동 pickup 됨을 확인 — 별도 config 등록 불요.
- [ ] R-114: push 후 PR CI 전 step green 확인. CI 는 web build step(T-0405)이 선행하므로 `web/dist` 가 존재 → 본 spec 의 실 검증 케이스가 CI 에서 실제 실행됨을 PR CI smoke step log 로 확인. approval-gate ordering fail 은 benignRedNote case A(reviewer approve comment 후 `gh run rerun --failed`)로 처리.

## Out of Scope

- `package.json` `coveragePathIgnorePatterns` 의 `src/web/web.module.ts` coverage 포함 조정 — **T-0355 잔여 ②**(별도 pr task, package.json 단일 concern).
- `scripts/check-spec-presence.test.sh` web self-test 케이스 추가 — **T-0355 잔여 ③**(별도 pr task, scripts 단일 concern). NOTE: `check-spec-presence.sh` 의 `.test.ts` 처리 자체는 T-0380 에서 이미 반영됨.
- `docs/architecture/directory.md` 동기 — **T-0397(`57ff461`)에서 이미 frontend(web/) 섹션 doc-sync 완료** — 추가 작업 불요(잔여 아님).
- `src/web/web.module.ts` 등 production code 변경(dist 부재 시 boot log 1줄 등 m3 후반) — Follow-up, 본 task 미포함.
- ci.yml 변경 — T-0405 에서 완료(web build/test step 머지). 본 task 는 spec 1 파일만.
- web vitest coverage threshold 실 도입(`@vitest/coverage-v8` 새 dev dep §5 게이트).

## Suggested Sub-agents

`implementer → tester`. architect 불요 — ADR-0040 + T-0354 executor note 가 결정 완료(NestFactory 실 부팅 경로 · dist 분기 guard), 본 task 는 smoke spec 1 파일 신설.

## Follow-ups

- (planner 선제) T-0355 잔여 ② — `package.json` `coveragePathIgnorePatterns` 조정으로 `src/web/web.module.ts` 를 coverage 측정에 포함(다른 `*.module.ts` 는 ignore 유지). `web.module.spec.ts` 가 이미 존재하므로 threshold 충족 가능 여부를 `pnpm test:cov` 로 확인 필요. 별도 pr task.
- (planner 선제) T-0355 잔여 ③ — `scripts/check-spec-presence.test.sh` 에 web 정책 self-test 케이스(happy: web `.ts` + colocated `.test.ts` → pass / negative: web `.ts` 단독 → fail / 제외: web `*.d.ts` 단독 → pass). 별도 pr task.
- (planner 선제) `src/web/web.module.ts` dist 부재 시 boot log 1줄(silent degradation 방지, m3 후반) — production code 변경이라 별도 검토 task.
