---
id: T-0009
title: Smoke test 인프라 + 첫 smoke + CI 통합
phase: P0.5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 5
created: 2026-05-23
requeuedAt: 2026-05-24
plannerNote: P0.5 세 번째 bullet. README 113 / R-113 의 smoke 부분 구현. supertest/@nestjs/testing 이미 devDep — 신규 dep 0. T-0008 DONE 으로 unblocked.
dependsOn: [T-0008]
blocks: [T-0010]
---

# T-0009 — Smoke test 인프라 + 1개 smoke + CI

## Why

[README.md](../../README.md) 113행 / [CLAUDE.md](../../CLAUDE.md) §3.2 R-113 은 unit + smoke + e2e 셋이 모두 CI 에서 자동 수행되기를 요구한다. unit 은 T-0005 이후 active, coverage threshold 는 T-0008 이후 active. 본 task 는 smoke 인프라를 박는다 (REQ-061 의 smoke 부분).

본 프로젝트에서 smoke 의 정의:

- NestJS app 을 메모리에 부트스트랩.
- `GET /` 같은 health endpoint 1+ 호출해 200 응답 확인.
- DB / 외부 서비스 mock — 아직 도메인 모듈 없으므로 향후 도메인 추가 시 점진 확장.
- 빠르게 (≤ 30초) 동작.

T-0010 (e2e) 의 prerequisite. T-0008 (coverage threshold) merge 완료로 본 task 는 unblocked.

## Required Reading

- [src/main.ts](../../src/main.ts), [src/app.module.ts](../../src/app.module.ts), [src/app.controller.ts](../../src/app.controller.ts) (T-0004 산출물)
- [package.json](../../package.json) — `jest.coveragePathIgnorePatterns` / `jest.testRegex` / scripts (현 상태: `test:smoke` 미존재, supertest 7.0.0 / @nestjs/testing 10.4.4 이미 devDep)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 현 step 순서 (lint → build → test:cov)
- [docs/tasks/T-0010-e2e-test-infra.md](T-0010-e2e-test-infra.md) — 격리 전략 참고 (smoke vs e2e 구분)
- NestJS testing module 공식 docs (architect 가 필요 시 WebFetch)

## Acceptance Criteria

### 인프라

- [ ] `test/smoke/` 디렉토리 신설. 본 디렉토리는 jest 의 unit testRegex (`.*\.spec\.ts$`) 와 충돌하지 않도록 spec 파일명을 `.smoke-spec.ts` 로 지정하고, 기본 jest config 의 `testPathIgnorePatterns` 에 `test/smoke/` 추가 (unit run 시 smoke 가 같이 안 돌도록).
- [ ] `test/jest-smoke.json` config 신설. `rootDir: "."`, `testRegex: ".*\\.smoke-spec\\.ts$"`, `transform`/`moduleFileExtensions` 는 root jest 와 동일.
- [ ] `package.json` 의 `scripts` 에 `test:smoke: jest --config ./test/jest-smoke.json` 추가.
- [ ] 첫 smoke spec: `test/smoke/app.smoke-spec.ts`. supertest + `@nestjs/testing` 의 `Test.createTestingModule` 로 `AppModule` 부트스트랩 → `GET /` → 200 응답 확인. spec 상단 코멘트로 "smoke = 빠른 healthcheck. flow 검증은 e2e (T-0010)" 명시.

### CI

- [ ] [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 에 새 step `name: smoke test` 추가. 위치: `unit test` step 직후, `e2e test` (T-0010 에서 추가) 직전. command: `pnpm test:smoke`.
- [ ] smoke step 이 unit/coverage step 과 격리되어 독립적으로 fail 할 수 있는 구조 확인 (한 step 의 fail 이 다른 step 을 막아도 됨, GitHub Actions 기본 동작).

### R-112 (4 항목, [README.md](../../README.md) 112행)

본 task 는 신규 production code 추가가 없지만 (도메인 코드 없음), smoke spec 자체 + script/config 가 새 public artifact 다. 다음을 자체적으로 검증한다:

- [ ] **Happy-path test**: smoke spec 의 `GET /` 케이스가 200 + 응답 body 가 `'Hello World!'` (T-0004 의 AppService 산출물) 임을 검증. (smoke 본 자체가 happy-path.)
- [ ] **Error path test**: smoke runner 가 의도된 fail (예: 존재하지 않는 endpoint `/__not_exists__` 에 대해 supertest expect 404) 1+ 추가. 또는 별도 spec `app.smoke-fail-spec.ts` 가 fail 함을 본 task PR body 에서 demonstration (수동 실행 후 출력 첨부).
- [ ] **Flow / branch coverage**: smoke 자체에 분기가 없으므로 본 항목은 "분기 없음 — 항목 생략" 으로 task body 에 명시. (R-112 의 의미상 분기 cover 는 production code 분기에 대한 것이며 smoke 인프라 자체에는 적용 어려움.)
- [ ] **Negative test**: jest config 의 `testRegex` 가 unit 의 `.spec.ts` 를 picking 하지 않음을 확인 — `pnpm test` (unit) 실행 시 `test/smoke/` 가 잡히지 않고, `pnpm test:smoke` 실행 시 `src/**/*.spec.ts` 가 잡히지 않음을 PR body 에 출력 첨부.

### R-110 / R-111 / R-114 ([CLAUDE.md](../../CLAUDE.md) §3.2)

- [ ] tester 가 본 task 의 모든 변경 후 로컬에서 `pnpm lint && pnpm build && pnpm test && pnpm test:smoke` 실행해 전부 pass 함을 확인.
- [ ] PR push 후 CI workflow run conclusion 이 `success` 임을 driver 가 확인 (R-114). smoke step 이 30초 이내 완료를 목표.
- [ ] CI step 중 어느 하나라도 fail 이면 PR red → integrator 가 ANOTHER_ROUND 또는 BLOCKED (R-111).

### Regression test 면제

- [ ] 본 task 는 patch 아님 (`hqOrigin` frontmatter 없음) → regression test 면제.

### 문서

- [ ] [README.md](../../README.md) 의 로컬 빌드 단락 (T-0005 가 추가한 부분) 에 `pnpm test:smoke` 한 줄 추가. e2e 는 T-0010 에서 추가될 예정으로 본 task 는 smoke 만.

### Size

- [ ] 단일 commit, ≤300 LOC / ≤5 파일. 예상: smoke spec 1 + jest-smoke.json 1 + package.json patch 1 + ci.yml patch 1 + README patch 1 = 5 파일 / ~120 LOC.

## Out of Scope

- **E2E 인프라** — [T-0010](T-0010-e2e-test-infra.md). 본 task 는 smoke 만 박고 e2e 의 jest-e2e.json / CI step 은 손대지 않는다.
- **DB / 외부 API 가 들어간 smoke** — 도메인 모듈 (P3+) 추가 시 자연스럽게 확장. 본 task 는 health endpoint 1개만.
- **Performance smoke / load test** — 별도 phase / 별도 ADR (P7 / P8).
- **신규 dependency 추가** — supertest 7.0.0 / @nestjs/testing 10.4.4 가 이미 devDep 에 있으므로 본 task 는 의존성 추가 없음. 만약 implementer 가 다른 package 가 필요하다고 판단하면 §5 에 따라 BLOCKED 처리하고 작업 중단.
- **Coverage 측정에 smoke 포함 여부 결정** — T-0008 의 coverage threshold 가 unit 만 대상인지, smoke 까지 합산할지는 별도 ADR (본 task Follow-ups 에 적어두기만).
- **Smoke spec 다중화** — 첫 smoke 1개만. 추가 smoke 는 도메인 모듈이 들어올 때마다 별도 task.

## Suggested Sub-agents

`implementer` (smoke spec + jest-smoke.json + package.json patch + ci.yml step + README) → `tester` (R-112 4 항목 자체 검증 + `pnpm test:smoke` 로컬 실행 + unit/smoke 격리 demonstration)

## Follow-ups

- T-0008 의 coverage threshold 가 smoke 도 합산할지 결정 (ADR 후보) — 본 task 와 별도.
- T-0010 (e2e) 에서 본 task 의 smoke 격리 패턴을 참고해 e2e 격리도 동일 방식으로 (testRegex 분리).
- 도메인 모듈이 추가될 때마다 smoke spec 1개 추가 (별도 task).
- **2026-05-24 — BLOCKED on [T-0012](T-0012-check-spec-presence-patch.md)**: PR-10 의 `spec-presence-check` step 이 T-0007 산출물 `scripts/check-spec-presence.sh` 결함으로 fail (`.smoke-spec.ts` suffix 누락 + `test/*` leading-glob 미매칭). T-0012 merge 후 본 PR 의 CI 재시도 필요. status 는 PENDING 유지 (BLOCKED-on-T-0012 의미).
