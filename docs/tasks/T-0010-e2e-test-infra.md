---
id: T-0010
title: E2E test 인프라 + 첫 e2e + CI 통합
phase: P0.5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-05-23
requeuedAt: 2026-05-24
plannerNote: P0.5 마지막 bullet. REQ-061 의 e2e 부분 구현 (smoke 는 T-0009 가 완료). T-0009 DONE 으로 dependsOn 해소. 신규 dep 0 — supertest/@nestjs/testing/@types/supertest 모두 devDep.
dependsOn: [T-0009]
blocks: []
---

# T-0010 — E2E test 인프라 + 1개 e2e + CI

## Why

[README.md](../../README.md) 113행 / [CLAUDE.md](../../CLAUDE.md) §3.2 R-113 은 unit + smoke + e2e 셋이 모두 CI 에서 자동 수행되기를 요구한다. unit/coverage 는 T-0005·T-0008 이후 active, smoke 는 T-0009 머지 (6a06638) 로 active. 본 task 는 마지막 한 축인 e2e 인프라를 박아 REQ-061 을 완전 cover 한다.

본 프로젝트에서 smoke 와 e2e 의 의도 차이:

- **smoke** (T-0009): "app 이 떴는가 / 핵심 endpoint 가 200 으로 응답하는가" — 빠른 healthcheck, ≤ 30초.
- **e2e** (본 task): "여러 module 의 협력 / 응답 contract (status·header·body shape) / 다음 flow 까지 끝까지 동작" — 더 무거운 검증.

본 task 는 P0.5 단계라 도메인 모듈이 거의 없는 상태 — **인프라만 박는다**. 첫 e2e 는 단순 health flow 1개. P2 (DB 도입) / P3 (외부 통합) 이후 도메인이 들어가면서 자연스럽게 확장. P0.5 phase 완료의 마지막 task — 본 task 머지 후 P1 (Architecture) 진입.

## Required Reading

- [src/main.ts](../../src/main.ts), [src/app.module.ts](../../src/app.module.ts), [src/app.controller.ts](../../src/app.controller.ts), [src/app.service.ts](../../src/app.service.ts) (T-0004 산출물 — e2e 가 부트스트랩할 대상)
- [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) 와 [test/jest-smoke.json](../../test/jest-smoke.json) (T-0009 산출물 — 격리 패턴 동일하게 재사용)
- [package.json](../../package.json) — 기존 `test:e2e` script 정의 (line 21: `jest --config ./test/jest-e2e.json`), `testPathIgnorePatterns` 에 이미 `<rootDir>/test/e2e/` 포함 (line 58), supertest 7.0.0 / @nestjs/testing 10.4.4 / @types/supertest 6.0.2 모두 devDep
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 현 step 순서 (lint → build → test:cov → smoke). e2e step 을 smoke 직후에 추가
- [docs/tasks/T-0009-smoke-test-infra.md](T-0009-smoke-test-infra.md) — 동일 phase 직전 task. Acceptance Criteria 구조를 본 task 가 거의 그대로 따른다 (격리 / R-112 / R-110·111·114).

## Acceptance Criteria

### 인프라

- [ ] `test/e2e/` 디렉토리 신설.
- [ ] `test/jest-e2e.json` config 신설. `rootDir: "."`, `testRegex: ".*\\.e2e-spec\\.ts$"`, `transform`/`moduleFileExtensions` 는 root jest 와 동일. `testPathIgnorePatterns` 에 `node_modules`, `dist` 포함. (`test/jest-smoke.json` 을 그대로 본떠 testRegex 만 `e2e-spec` 으로.)
- [ ] `package.json` 의 `scripts.test:e2e` 는 이미 정의돼 있음 (변경 불요). `testPathIgnorePatterns` 의 `<rootDir>/test/e2e/` 도 이미 존재 (변경 불요).
- [ ] 첫 e2e spec: `test/e2e/app.e2e-spec.ts`. supertest + `@nestjs/testing` 의 `Test.createTestingModule` 로 `AppModule` 부트스트랩 → `GET /` 호출 → status 200 + content-type 헤더 + body 가 `'Hello World!'` 임을 모두 검증 (smoke 보다 검증 항목이 1+ 더 많아야 의도 차이가 드러남). spec 상단 코멘트로 "e2e = 응답 contract + flow 검증. 빠른 healthcheck 는 smoke (T-0009)" 명시.

### CI

- [ ] [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 에 새 step `name: e2e test` 추가. 위치: `smoke test` step 직후 (가장 마지막). command: `pnpm test:e2e`.
- [ ] e2e step 이 unit/coverage/smoke step 과 격리되어 독립적으로 fail 할 수 있는 구조 확인 (GitHub Actions 기본 step 단위 격리).
- [ ] e2e step 이 fail 했을 때 PR CI 가 red 임을 본 task PR body 에 demonstration (의도된 fail spec 1회 push → red 확인 → 정상 spec 으로 되돌림 — 또는 로컬 `pnpm test:e2e` 의 exit code 1 출력 첨부).

### R-112 (4 항목, [README.md](../../README.md) 112행 / [CLAUDE.md](../../CLAUDE.md) §3.2)

본 task 는 신규 production code 추가가 없지만 (도메인 코드 없음), e2e spec + jest-e2e.json + CI step 이 새 public artifact. 다음을 자체 검증:

- [ ] **Happy-path test**: e2e spec 의 `GET /` 케이스가 200 + content-type `text/html` (NestJS default) + body `'Hello World!'` 임을 검증. (e2e 본 자체가 happy-path.)
- [ ] **Error path test**: e2e runner 가 의도된 fail (예: 존재하지 않는 endpoint `/__not_exists_e2e__` 에 대해 supertest expect 404) 1+ 추가 — happy spec 의 두 번째 `it()` 또는 별도 `it()` 로. NestJS 기본 404 응답 검증.
- [ ] **Flow / branch coverage**: e2e 자체에 분기가 없으므로 "분기 없음 — 항목 생략" 으로 task body 에 명시. (R-112 의 분기 cover 는 production code 분기에 대한 것이며, e2e 인프라 자체에는 적용 어려움. 도메인 모듈이 들어오면서 flow 분기 검증 e2e 가 자연 추가될 예정.)
- [ ] **Negative test**: jest config 의 `testRegex` 가 unit 의 `.spec.ts` 와 smoke 의 `.smoke-spec.ts` 를 picking 하지 않음을 확인 — `pnpm test:e2e` 실행 시 `src/**/*.spec.ts` 와 `test/smoke/**/*.smoke-spec.ts` 가 잡히지 않고 오직 `test/e2e/**/*.e2e-spec.ts` 만 실행됨을 PR body 에 jest 출력 첨부. 역방향도 (`pnpm test` / `pnpm test:smoke` 가 e2e 를 picking 하지 않음) 확인.

### R-110 / R-111 / R-114 ([CLAUDE.md](../../CLAUDE.md) §3.2)

- [ ] **R-110**: tester 가 본 task 의 모든 변경 후 로컬에서 `pnpm lint && pnpm build && pnpm test && pnpm test:smoke && pnpm test:e2e` 4 종 전부 pass 함을 확인.
- [ ] **R-111**: CI step 중 어느 하나라도 fail 이면 PR red → integrator 가 ANOTHER_ROUND 또는 BLOCKED.
- [ ] **R-114**: PR push 후 CI workflow run conclusion 이 `success` 임을 driver 가 `gh run list` 로 확인. e2e step 이 60초 이내 완료를 목표 (smoke 의 2배 한도).

### Regression test 면제

- [ ] 본 task 는 patch 아님 (`hqOrigin` frontmatter 없음) → regression test 면제.

### 문서

- [ ] [README.md](../../README.md) 의 로컬 빌드 단락 (T-0005 가 추가, T-0009 가 smoke 한 줄 추가) 에 `pnpm test:e2e` 한 줄 추가. 4 종 명령 (`pnpm test` / `test:cov` / `test:smoke` / `test:e2e`) 의 의도 차이를 코멘트 한 줄로 명시 (예: "smoke = 빠른 healthcheck, e2e = 응답 contract + flow").

### Size

- [ ] 단일 commit, ≤300 LOC / ≤5 파일. 예상: e2e spec 1 + jest-e2e.json 1 + ci.yml patch 1 + README patch 1 = 4 파일 / ~80 LOC. **5 파일 / 150 LOC 상한 안에서 cap 위반 risk 0.**

## Out of Scope

- **DB 가 들어간 e2e** (testcontainers / 임시 sqlite 등) — Phase P2 의 DB 도입 시 별도 ADR + task. 본 task 는 도메인 모듈 없음을 전제로 health endpoint 1개만 검증.
- **외부 API mock 인프라** (msw / nock 등) — Phase P3 의 GitHub/Confluence 통합 시 별도 ADR.
- **Performance / load e2e** — Phase P7 / P8 별도.
- **Browser e2e** (Playwright / Cypress frontend e2e) — Phase P6 (Web UI) 진입 시 별도 ADR.
- **신규 dependency 추가** — supertest 7.0.0 / @nestjs/testing 10.4.4 / @types/supertest 6.0.2 가 이미 devDep 에 있으므로 본 task 는 의존성 추가 없음. 만약 implementer 가 다른 package 가 필요하다고 판단하면 [CLAUDE.md](../../CLAUDE.md) §5 에 따라 **즉시 BLOCKED 처리하고 작업 중단** — turn cap (loopSession #4 turn 9/10, 잔여 1 turn) 안에서 신규 dep 협의 불가.
- **E2E spec 다중화** — 첫 e2e 1개만. 추가 e2e 는 도메인 모듈 (P3+) 추가 시 별도 task.
- **Coverage 측정에 e2e 포함 여부** — T-0008 의 coverage threshold 는 unit 만 대상. e2e 합산 여부는 별도 ADR (본 task Follow-ups).
- **P0.5 phase close 선언** — 본 task 머지 후 별도 direct-mode bookkeeping task 또는 다음 turn 의 planner 가 P1 entry task 와 함께 PLAN.md 의 P0.5 상태 [x] 표시 갱신.

## Suggested Sub-agents

`implementer` (e2e spec + jest-e2e.json + ci.yml step + README) → `tester` (R-112 4 항목 자체 검증 + 로컬 4 종 명령 pass + e2e 격리 demonstration + 의도된 fail 시 CI red 확인)

## Follow-ups

- DB-backed e2e (testcontainers + Postgres) — Phase P2 시작 시점에 task 신규.
- 외부 API contract test (Pact 또는 자체 fixture) — Phase P3 진입 시 별도 ADR.
- E2E 가 길어지면 (~ 5분 이상) CI matrix 분리 / parallel job — 별도 ADR.
- T-0008 의 coverage threshold 가 smoke + e2e 합산할지 결정 (ADR 후보).
- P0.5 phase close — 본 task 머지 후 PLAN.md 의 P0.5 4 bullet 모두 [x] 표시 + 다음 turn 의 planner 가 P1 entry task 생성.
