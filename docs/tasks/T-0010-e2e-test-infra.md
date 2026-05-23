---
id: T-0010
title: E2E test 인프라 + 첫 e2e + CI 통합
phase: P0.5
status: PENDING
commitMode: pr
estimatedDiff: 150
estimatedFiles: 5
created: 2026-05-23
plannerNote: README 113 의 e2e 부분 구현. smoke (T-0009) 와 격리된 더 무거운 검증 — DB · auth · 외부 통합이 들어오기 시작하는 P2 / P3 phase 에서 본격 활용. 인프라만 P0.5 에서 박아둔다.
dependsOn: [T-0009]
blocks: []
---

# T-0010 — E2E test 인프라 + 1개 e2e + CI

## Why

README 113 / §3.2 R-113 의 e2e 부분 충족. Smoke 가 "app 이 떴는가 / 핵심 endpoint 가 응답하는가" 의 가벼운 검증이라면, e2e 는 "여러 module 의 정상 협력 / 외부 입출력의 contract 충족 / 의도된 flow 가 끝까지 동작" 의 무거운 검증.

본 task 는 P0.5 단계라 도메인 모듈이 거의 없는 상태 — **인프라만 박는다**. 첫 e2e 는 단순 health flow 1개. P1 이후 도메인이 들어가면서 자연스럽게 확장.

## Required Reading

- T-0009 의 산출물 (smoke 구조 — 분리 위해 비교)
- `package.json` 의 기존 `test:e2e` script (이미 정의돼 있음 — `jest --config ./test/jest-e2e.json`)
- `.github/workflows/ci.yml`

## Acceptance Criteria

- [ ] `test/jest-e2e.json` config 파일 신설 (또는 갱신). testRegex 가 `.*\.e2e-spec\.ts$`, rootDir 가 `.`.
- [ ] `test/e2e/` 디렉토리 신설.
- [ ] 첫 e2e spec: `test/e2e/app.e2e-spec.ts`. supertest + NestJS testing module 로 app 부트스트랩 → `GET /` → 200 + 응답 형태 검증. (smoke 와 의도 차이를 코멘트로 명시: smoke 는 빠른 healthcheck, e2e 는 응답 형태 / status / header / 다음 flow 까지.)
- [ ] **R-112 자체 test**: e2e runner 의 happy / 의도된 fail 검증.
- [ ] **격리**: e2e 가 unit / smoke 와 동시에 돌지 않도록 jest config 분리 (testRegex 또는 testPathIgnorePatterns).
- [ ] `.github/workflows/ci.yml` 에 step `name: e2e test` 추가 (`pnpm test:e2e`). smoke step 직후. e2e 가 unit / smoke 보다 오래 걸리므로 마지막 위치.
- [ ] e2e 가 fail 했을 때 CI 가 fail 함을 확인하는 절차를 README / task body 에 명시.
- [ ] [README.md](../../README.md) 에 `pnpm test:e2e` 사용법 한 줄 추가.
- [ ] 단일 commit, ≤300 LOC / ≤5 파일.

## Out of Scope

- DB 가 들어간 e2e (testcontainers 등) — Phase P2 의 DB 도입 시 별도 ADR + task.
- 외부 API mock 인프라 (msw 등) — Phase P3 의 GitHub/Confluence 통합 시 별도.
- Performance e2e — 별도 phase.
- Browser e2e (frontend) — Phase P5.
- 신규 dependency — supertest / @nestjs/testing 으로 충분.

## Suggested Sub-agents

`implementer` (e2e config + spec + CI step + README) → `tester` (R-112 자체 test + fail 시 CI fail 확인)

## Follow-ups

- DB-backed e2e (testcontainers + Postgres) — Phase P2 시작 시점에 task 신규.
- 외부 API contract test (Pact 또는 자체 fixture) — Phase P3 진입 시.
- E2E 가 길어지면 (~ 5분 이상) CI matrix 분리 / parallel job — 별도 ADR.
