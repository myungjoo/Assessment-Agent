---
id: T-0355
title: P6 frontend scaffold slice 3 — ci.yml web build/test step + spec-presence·coverage 정책 + dist-존재 통합 검증 + directory.md 동기
phase: P6
status: PENDING
rescopeNote: "2026-06-14 onHold(credential-workflow-scope) 해소 — 사용자가 gh auth refresh -s workflow 재인증. ci.yml web build/test step AC(본 task 의 첫 2 AC)는 T-0405(PR #326, squash merge 4566f7c)로 분리·완료. **잔여 AC = workflow scope 불요(ci.yml 미변경)라 dependency-free**: (1) web-static smoke spec(test/smoke/web-static.smoke-spec.ts, NestFactory boot + dist-존재 통합 검증) / (2) package.json coveragePathIgnorePatterns 로 src/web/web.module.ts coverage 포함 / (3) scripts/check-spec-presence.test.sh web self-test 케이스 / (4) docs/architecture/directory.md 동기. planner 가 다음 pickup 시 첫 2 AC(ci.yml web build/test step)는 T-0405 완료로 skip 하고 잔여 4 AC 만 구현. staleness 주의: check-spec-presence.sh 의 .test.ts 처리는 T-0380 에서 이미 반영됨(AC 의 일부 선반영)."
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 250
estimatedFiles: 6
sizeExempt: true
exemptReason: "scaffold chain 마무리 — 6 파일 > 5 파일 cap 이나 각 파일 trivial~소형 (CI step 2개 / script 분기 / self-test 케이스 / coverage 패턴 1줄 / smoke spec 1개 / doc 단락 동기), 합계 ~250 LOC. T-0353/T-0354 와 동일한 planner-pre-justified 경로."
independentStream: p6-frontend-scaffold
dependsOn: [T-0353, T-0354]
touchesFiles:
  - .github/workflows/ci.yml
  - scripts/check-spec-presence.sh
  - scripts/check-spec-presence.test.sh
  - package.json
  - test/smoke/web-static.smoke-spec.ts
  - docs/architecture/directory.md
created: 2026-06-13
plannerNote: "P6 scaffold chain slice 3/3 (마지막) — cap-bend pre-justified: CI-stage × 1.3 ≈ 250 LOC·6파일, T-0353/T-0354 패턴"
---

# T-0355 — P6 frontend scaffold slice 3: ci.yml web build/test step + spec-presence·coverage 정책 + dist-존재 통합 검증 + directory.md 동기

## Why

T-0353 (slice 1: workspace + Vite SPA, PR #286) / T-0354 (slice 2: serve-static WebModule, PR #287) 의 Chain 계획에 박제된 **slice 3 — scaffold chain 의 마지막**. 두 task 의 Follow-ups 7건이 입력이다: web vitest 가 CI 미실행인 transient gap (T-0353 reviewer MINOR — "지체 없이 진행" 명시), web build CI step, check-spec-presence 의 web/ 정책 (vitest `.test.ts(x)` 명명 불일치), web coverage 정책 결정, dist-존재 통합 검증 1+ (T-0354 reviewer M1 — serve-static 실 serve/fallback/exclude 회귀 가드), directory.md 실 구현 동기 + `process.cwd()` 가정 문서화 (m3), `coveragePathIgnorePatterns` 의 web.module.ts 예외 (m2). R-111/R-113 (모든 test 는 CI 에서 자동 실행) 정합이 핵심 — CI 게이트 효력이 문서보다 우선이나 본 task 는 둘 다 cap-bend 안에 수용한다.

## Driver 주의사항

- **ci.yml 변경 포함 branch push 는 token 의 `workflow` scope 필요** — push 거부 (refusing to allow ... workflow) 시 `gh auth refresh -s workflow` 후 재시도 (이 머신의 gh relogin 이 workflow scope 를 떨어뜨린 전례 있음).
- pr-mode: feature branch `claude/T-0355-ci-web-steps` → PR → reviewer → integrator 4-게이트.

## Required Reading

- `docs/tasks/T-0353-p6-frontend-scaffold-workspace-vite.md` — Follow-ups (web vitest CI gap / check-spec-presence web 정책)
- `docs/tasks/T-0354-p6-web-module-serve-static.md` — Follow-ups M1 (dist-존재 통합 검증) · m2 (coverage 예외) · m3 (cwd 가정 doc) · executor note (**TestingModule.compile() 은 serve-static NoopLoader — 실 부팅 `NestFactory.create` 경로 필수**)
- `.github/workflows/ci.yml` — step 구조 (의존성 설치 → Lint → Build → migrate → test:cov → smoke → e2e), 주석 convention
- `scripts/check-spec-presence.sh` + `scripts/check-spec-presence.test.sh` — 현 `.spec.ts` colocated 규칙 + self-test 구조
- `package.json` — `jest.coveragePathIgnorePatterns` (L89-93: `\.module\.ts$`), `coverageThreshold`
- `test/jest-smoke.json` — testRegex `.*\.smoke-spec\.ts$` (신규 spec 자동 pickup), globalSetup, maxWorkers 1
- `src/web/web.module.ts` — exported helper 구조 (coverage 포함 영향 + 실 부팅 검증 대상)
- `docs/architecture/directory.md` — §"Frontend (web/) 의 위치" (L148-155, stale — 옵션 2 default 서술) + L34 tree 주석
- `docs/decisions/ADR-0040-frontend-stack.md` — §3 (운영 serve + SPA fallback) · §4 (web/ workspace)

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 에 **web build step** (`pnpm --filter web build`) 신설 — `pnpm test:smoke` step **이전** 배치 (dist-존재 통합 검증의 전제). 한국어 주석 1~3줄 (도입 근거 + T-0355) 동반. 파일 inspect + PR CI 에서 step green.
- [ ] `.github/workflows/ci.yml` 에 **web unit test step** (`pnpm --filter web test`) 신설 — vitest run 이 CI 에서 자동 실행 (R-111, T-0353 reviewer MINOR 해소). PR CI 에서 step green.
- [ ] `scripts/check-spec-presence.sh` web 정책 분기 — `web/` 하위 신규 production `.ts` 는 colocated `.spec.ts` 대신 **`.test.ts` 또는 `.test.tsx`** 를 기대 (vitest 명명). `*.d.ts` 는 검사 제외. 기존 `src/` 규칙 (`.spec.ts`) 불변. 파일 inspect 로 검증.
- [ ] `scripts/check-spec-presence.test.sh` 에 web 정책 self-test 케이스 추가 — happy 1+ (web `.ts` + colocated `.test.ts` → pass), **negative 1+** (web `.ts` 단독 → fail), 제외 분기 1+ (web `*.d.ts` 단독 → pass). 실행: `bash scripts/check-spec-presence.test.sh` green. (script 변경의 happy/error/branch/negative cover — R-112 를 shell self-test layer 로 충족.)
- [ ] **dist-존재 통합 검증** (T-0354 M1): `test/smoke/web-static.smoke-spec.ts` 신설 — `web/dist/index.html` **존재 시** 실 부팅 (`NestFactory.create(AppModule)` — TestingModule 은 NoopLoader 라 불가) 후 supertest 로: (a) happy 1+ — `GET /` 가 index.html 을 serve, (b) flow 1+ — 미지의 비-`/api` 경로 (예: `GET /dashboard`) 가 SPA fallback 으로 index.html 반환, (c) 1+ — `GET /api` 는 여전히 sanity status string (controller 우선), (d) **negative 1+** — `GET /api/<없는경로>` 는 404 (exclude 동작 — static fallback 이 `/api/*` 를 가로채지 않음). `web/dist/index.html` **부재 시 전체 skip** (로컬 미빌드 환경 green — 존재/부재 2 분기가 guard). CI 에선 web build step 선행으로 실 실행됨을 PR CI log 로 확인.
- [ ] `package.json` (m2): `coveragePathIgnorePatterns` 를 조정해 `src/web/web.module.ts` 가 coverage 측정에 **포함** (다른 `*.module.ts` 는 ignore 유지) — 분기 helper 가 threshold enforcement 안으로. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `docs/architecture/directory.md` §"Frontend (web/) 의 위치" 실 구현 동기 — (1) 현 구조 박제: repo root `web/` workspace (Vite React SPA, T-0353) + `src/web/` WebModule (serve-static 으로 `web/dist` serve + SPA fallback + `/api/*` exclude, T-0354) 의 hybrid, (2) WEB_DIST_PATH 의 **`process.cwd()` 기준 가정** (repo root 에서 부팅 전제) 문서화 (m3), (3) **web coverage 정책 박제**: vitest coverage threshold 는 보류 — `@vitest/coverage-v8` 새 dev dep 필요 (§5 게이트) 라 별도 task, (4) L34 tree 주석 등 stale 표현 동기. 파일 inspect 로 검증.
- [ ] R-110: production code 변경 0 이어도 tester 가 root `pnpm lint && pnpm build && pnpm test` + `pnpm test:smoke` + `pnpm test:e2e` 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 benignRedNote case A 절차 (rerun) 로 처리.

## Out of Scope

- `src/web/web.module.ts` 등 production code 변경 — m3 의 "dist 부재 시 boot log 1줄" 은 본 task 미포함 (Follow-ups 로 잔존, silent degradation 검토 별도).
- vitest coverage threshold **실 도입** (`@vitest/coverage-v8` 새 dev dep — §5 BLOCKED 게이트). 본 task 는 보류 정책 문서화만.
- check-spec-presence 의 `.tsx` production 파일 검사 확장 — 현 `*.ts` pathspec 한정 유지 (확장은 별도 검토).
- `web/` SPA 실 화면 (로그인 / 대시보드) · `/api/*` 소비 코드 · 라우터/차트 lib — 후속 P6 task + ADR-0040 §5 게이트.
- ci.yml node-version 20→24 bump (Q-0034 (4) make-work 판정 유지).
- ADR-0039 (timezone KST) impl chain — **본 task 완료 = scaffold chain 끝, 그 다음 백로그가 KST chain 1번째 task** (Q-0036 결정 2).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 + T-0353/T-0354 Follow-ups 가 결정 완료, 본 task 는 CI/script/test/doc 동기)

## Follow-ups

- (planner 선제) `src/web/web.module.ts` 의 dist 부재 시 boot log 1줄 (m3 후반 — silent degradation 방지) — production code 변경이라 본 task 제외, 필요성 검토 후 별도 task.
- (planner 선제) web vitest coverage threshold 실 도입 — `@vitest/coverage-v8` dev dep §5 승인 게이트 후 별도 task.
