---
id: T-0353
title: P6 frontend scaffold slice 1 — pnpm workspace + Vite React TS 최소 SPA (web/)
phase: P6
status: DONE
completedAt: 2026-06-12T15:30:12Z
prNumber: 286
mergedAs: 2ec3bdd
reviewRounds: 1
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 160
estimatedFiles: 9
sizeExempt: true
exemptReason: "scaffold boilerplate — lockfile 포함 9 파일 > 5 파일 cap 이나 각 파일 trivial (config/진입점/정적 컴포넌트), lockfile 제외 ~160 LOC. estimate-model planner-pre-justified 경로."
independentStream: p6-frontend-scaffold
dependsOn: []
touchesFiles:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - web/package.json
  - web/vite.config.ts
  - web/tsconfig.json
  - web/index.html
  - web/src/main.tsx
  - web/src/App.tsx
  - web/src/App.test.tsx
created: 2026-06-13
plannerNote: "P6 진입 (Q-0036 결정1) scaffold chain slice 1/3 — cap-bend pre-justified: boilerplate 9파일, lockfile 제외 ~160 LOC"
---

# T-0353 — P6 frontend scaffold slice 1: pnpm workspace + Vite React TS 최소 SPA (web/)

## Why

Q-0036 사용자 결정 (1): ADR-0040 (frontend stack — React + Vite SPA) ACCEPTED flip 완료, **P6 frontend scaffold chain 이 1순위**. 본 task 는 그 chain 의 slice 1 — [PLAN.md](../PLAN.md) Phase P6 의 모든 UI bullet (로그인 / 대시보드 / Admin 패널 / R-78 배너) 의 전제가 되는 `pnpm-workspace.yaml` + `web/` Vite React TypeScript 최소 SPA 를 박제한다 (ADR-0040 §1·§3·§4). 새 runtime dep (react, vite 등) 은 Q-0036 resolution 에 §5 승인 포함으로 명시됐다.

**Chain 계획** (각각 별도 task — 본 task 범위 아님): slice 2 = `@nestjs/serve-static` + `src/web/` WebModule (운영 static serve + SPA fallback, ADR-0040 §3), slice 3 = ci.yml web build/test step + directory.md 동기.

## Required Reading

- `docs/decisions/ADR-0040-frontend-stack.md` — §3 (dev proxy `/api` → localhost:3000), §4 (`web/` 위치 + pnpm workspace, root backend package 불변), §5 (PR 본문에 새 dep 전체 목록 명시 의무)
- `package.json` (root) — scripts (`lint` 는 `{src,test}/**/*.ts` 만 대상), `jest.testRegex` == `.*\.spec\.ts$` (web 쪽 테스트 파일명이 이 패턴에 걸리면 root jest 가 잘못 pickup — 충돌 회피 필수), `packageManager: pnpm@9.12.0`, `engines.node >= 20.11.0`
- `.github/workflows/ci.yml` — install step 확인 (workspace 화 후에도 `pnpm install` 이 그대로 동작해야 함; ci.yml 자체 수정은 본 task 금지)

## Acceptance Criteria

- [ ] `pnpm-workspace.yaml` 신설 — `packages: ["web"]`. root `package.json` (backend) 은 **무변경** (ADR-0040 §4: 단일 lockfile, root backend 현행 유지). 파일 inspect 로 검증.
- [ ] `web/` 최소 Vite + React 18+ + TypeScript SPA 신설: `web/package.json` (`"name": "web"`, `"private": true`, scripts: `dev` / `build` / `test`), `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx` (정적 placeholder — "Assessment-Agent" 제목 수준, 분기·로직 없음), `web/tsconfig.json` (단일 파일로 통합 가능 — 파일 수 최소화), `web/vite.config.ts`.
- [ ] `web/vite.config.ts` 에 `server.proxy`: `/api` → `http://localhost:3000` (ADR-0040 §3 개발 same-origin 구조). 파일 inspect 로 검증.
- [ ] 새 dependency 는 **web/package.json 에만** 추가: runtime `react`, `react-dom` / dev `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`. **이 외 추가 금지** (jsdom · @testing-library · router · 차트 · 상태관리 lib 등은 후속 slice 의 §5 게이트). PR 본문에 새 dep 전체 목록 명시 — reviewer 가 ADR-0040 §5 게이트 (ACCEPTED + Q-0036 승인) 충족 확인.
- [ ] R-112 unit tests — `web/src/App.test.tsx` (vitest):
  - happy-path 1+: `react-dom/server` 의 `renderToStaticMarkup(<App />)` 결과에 placeholder 텍스트 포함 검증 (jsdom 없이 가능 — dep 표면 최소화).
  - negative 1+: 렌더 결과가 빈 문자열이 아님 + 의도하지 않은 텍스트 (예: 미구현 화면 문구) 미포함 각 1+.
  - flow/branch: App 은 분기 없는 정적 컴포넌트 — **분기 없음, 이 항목 생략** (본문 명시로 충족).
  - 실행: `pnpm --filter web test` (vitest run) 통과.
- [ ] **테스트 파일명은 `.test.tsx`** — root jest `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. `web/` 아래에 `.spec.ts` 파일 금지. (`.tsx` 는 패턴 불일치라 안전하나 규율로 `.test.tsx` 고정.)
- [ ] `pnpm --filter web build` 성공 — `web/dist/` 산출 (기존 `.gitignore` 의 `dist/` 패턴으로 이미 ignored — **커밋 금지**, `.gitignore` 수정 불요 확인).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` 그대로 green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도).
- [ ] `pnpm-lock.yaml` 이 workspace 기준으로 재생성되어 CI 의 install step (frozen lockfile) green. push 후 PR CI 전 step green 확인 (R-114).

## Out of Scope

- `@nestjs/serve-static` 도입 / `src/web/` WebModule / SPA fallback 라우팅 — **slice 2** (별도 task, backend 코드).
- `.github/workflows/ci.yml` 의 web build/test step 추가 — **slice 3** (본 PR 은 기존 CI 가 무변경으로 green 이어야 함).
- `docs/architecture/directory.md` "Frontend (web/) 의 위치" 단락 갱신 — slice 3 또는 별도 doc task (ADR-0040 Consequences 중립 항목).
- 로그인 화면 · `/api/*` 실 소비 코드 · 라우터/상태관리/차트 라이브러리 · jsdom/@testing-library — 각 후속 task + §5 게이트.
- ADR-0039 (timezone KST) impl chain — scaffold chain 완료 후 후속.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조 결정 완료)

## Follow-ups

- (executor 발견) slice 3 에서 `scripts/check-spec-presence.sh` 의 web/ 정책 결정 필요 — web 테스트는 vitest `.test.ts(x)` 명명이라 현 `.spec.ts` 대응 규칙이 web/ 의 신규 `.ts` 유틸에 안 맞음 (본 slice 는 `.tsx`/`.mts` 만이라 미발화).
- (reviewer MINOR) web vitest 가 CI 미실행 transient gap — slice 3 (ci.yml web step) 을 chain 에서 지체 없이 진행 + web 측 coverage 정책 (vitest threshold 여부) 함께 결정.

## Result

DONE (2026-06-12 15:30Z) — PR #286 squash `2ec3bdd`, reviewer round 1/7 APPROVE (blockers 0 / major 0 / minor 2 — 전부 slice 3 위임·정보성). 10 파일 +927/-53 (lockfile 제외 ~129 LOC). deviation 2건 정당 판정: `web/vite.config.mts` (spec-presence 게이트 충돌 해소), `tsconfig.build.json` exclude "web" (+1 파일, backend 불변 AC 필수 수단). pull_request run 27424985776 rerun 후 전 step green — frozen-lockfile install 로 workspace 화 lockfile 정합 실증. backend 6844 tests + cov threshold 그대로 green.
