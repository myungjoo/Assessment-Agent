---
id: T-0009
title: Smoke test 인프라 + 첫 smoke + CI 통합
phase: P0.5
status: PENDING
commitMode: pr
estimatedDiff: 120
estimatedFiles: 5
created: 2026-05-23
plannerNote: README 113 의 "unit + smoke + e2e 모두 CI에서 수행" 의 smoke 부분 구현. supertest 기반 NestJS testing module 로 가장 가벼운 smoke 1개부터. e2e 는 T-0010.
dependsOn: [T-0008]
blocks: []
---

# T-0009 — Smoke test 인프라 + 1개 smoke + CI

## Why

README 113 / §3.2 R-113 는 unit + smoke + e2e 셋 다 CI 에서 수행되기를 요구. unit 은 T-0005 끝나고 active. 본 task 는 smoke 도입.

Smoke 의 정의 (이 프로젝트 기준):

- NestJS app 을 메모리에 부트스트랩.
- `GET /` 같은 health endpoint 1+ 호출해 200 응답 확인.
- DB / 외부 서비스 mock — 아직 도메인 모듈 없으므로 향후 도메인 추가 시 점진 확장.
- 빠르게 (≤ 30초) 동작.

## Required Reading

- `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts` (T-0004 의 산출물)
- `package.json` 의 `test:smoke` script 자리 (없으면 본 task 에서 추가)
- `.github/workflows/ci.yml`
- NestJS testing module 공식 docs (architect 가 WebFetch 가능)

## Acceptance Criteria

- [ ] `test/smoke/` 디렉토리 신설 (또는 `test/jest-smoke.json` config 로 격리).
- [ ] 첫 smoke spec: `test/smoke/app.smoke-spec.ts`. supertest + NestJS testing module 로 app 부트스트랩 → `GET /` → 200 + body 검증.
- [ ] `package.json` 의 `test:smoke` script: `jest --config <smoke config>` 또는 jest 의 testPathPattern 으로 smoke 만 선택.
- [ ] **R-112 자체 test**: smoke runner 가 정상 케이스에서 0 exit, 의도된 fail (예: 잘못된 endpoint) 에서 non-zero exit 확인 — 본 task 의 spec 1개 + 1 negative.
- [ ] **regression test 면제**: 본 task 는 patch 아님.
- [ ] `.github/workflows/ci.yml` 에 step `name: smoke test` 추가 (`pnpm test:smoke`). build 직후, unit test 직후 위치.
- [ ] [README.md](../../README.md) 에 `pnpm test:smoke` 사용법 한 줄 추가.
- [ ] 단일 commit, ≤300 LOC / ≤5 파일.

## Out of Scope

- E2E test 인프라 — [T-0010](T-0010-e2e-test-infra.md).
- DB / 외부 API 가 들어간 smoke — 도메인 모듈 추가 시 자연스럽게 확장.
- Performance smoke (load test 류) — 별도 ADR.
- 신규 dependency 추가 시 §5 BLOCKED — supertest / @nestjs/testing 은 이미 devDependencies 에 있음 (T-0003 산출물).

## Suggested Sub-agents

`implementer` (smoke spec + script + CI step + README) → `tester` (R-112 자체 test + smoke 실행 결과 확인)

## Follow-ups

- coverage 측정에 smoke 포함할지 별도 결정 (T-0008 의 threshold 가 unit + smoke 합산 대상인지) — ADR.
