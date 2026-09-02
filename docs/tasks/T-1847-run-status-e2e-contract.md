---
id: T-1847
title: GET /api/run-status 계약을 e2e 로 고정
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 360
estimatedFiles: 1
created: 2026-09-02
dependsOn: [T-1846]
independentStream: run-status-adr0060
touchesFiles: [test/e2e/run-status.e2e-spec.ts]
sizeExempt: true
exemptReason: "1 파일 신설이라 파일 수 cap(5)은 준수하고 LOC 만 면제. 항목별 산정 — 파일 헤더 주석(책임·실 DB 전략·상태 조작 방식) 45 + import·beforeAll/afterAll 셋업 45 + happy 3 test 55 + error path 2 test 40 + 분기 3 test 65 + negative 6 test 110 = 약 360. e2e 1 개를 두 파일로 쪼개면 createAuthenticatedE2EApp 부트스트랩 블록(약 45 줄)이 통째로 중복되고 미인증 401 과 인증 200 이 다른 파일로 갈라져 계약이 흩어지므로 분할하지 않는다. 초과분은 전부 spec 이며 production 코드 0 LOC."
plannerNote: "P6 133 행 ④ R-78 polling — ADR-0060 §Follow-ups (d) e2e 로 GET /api/run-status 계약 고정 (chain (b) 다음 순서)"
---

# T-1847 — GET /api/run-status 계약을 e2e 로 고정

## Why

[PLAN.md](../PLAN.md) `133 행` ④ R-78 polling 의 backend arc 는 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` 가 `(a) → (b) → (d) → (e) → (f)` 순서로 못박았고, (a) 상태 service(T-1841) · (a2) 평가 축 3 handler 배선(T-1842 · T-1843 · T-1844) · (c) 수집 축 배선(T-1845) · (b) 조회 route + AppModule 등록(T-1846) 까지 머지돼 이제 (d) 만 남았다. [CLAUDE.md](../../CLAUDE.md) `§3.2` R-113 은 unit 외에 e2e 도 CI 에서 수행할 것을 요구하는데, 현재 이 endpoint 의 검증은 controller unit spec 과 `app.module.spec.ts` DI 게이트뿐이라 **guard stack(401) · 실 HTTP 응답 shape · JSON 직렬화 결과** 를 실제 요청으로 확인하는 층이 없다.

pre-check 실측(origin/main `48115e61`): `ls test/e2e/ | grep -i run-status` 매칭 **0**(e2e 27 개 중 없음), `git grep -n "api/run-status" -- test` 매칭 **0** — 중복 큐잉도 부분 안착도 아닌 미착수다. 반대로 `src/run-status/` 는 4 파일 + controller/spec 이 이미 있고 `src/app.module.ts` `68 행` 이 `RunStatusModule` 을 등록해 route 는 실제로 서빙 중이므로, 본 slice 는 **이미 살아 있는 route 를 실 HTTP 로 고정하는 검증층**이지 새 기능이 아니다(production 코드 0 LOC). [requirements.md](../requirements.md) `102 행` REQ-083 은 여전히 `PLANNED` 이고 검증 위치 칸이 `unit + e2e` 라, 그 칸을 실제로 충족시키는 것이 본 slice 다(재판정 자체는 `§3.1` 규칙 6 대로 (e) 머지 후 (f) 에서 1 회).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) — `§Decision 2`(응답 필드 표 + 불변식) · `§Decision 3`(RBAC · 401) · `§Follow-ups (d)`
- [src/run-status/run-status.controller.ts](../../src/run-status/run-status.controller.ts) — `@Controller("api/run-status")` · guard stack · handler
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) — `begin(axis)` / `end(axis)` / `snapshot()` 와 `RunStatusSnapshot` 타입
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` · `buildAuthCookie` · `AuthenticatedE2EContext`(`moduleRef` 노출)
- [test/e2e/assessment-collection-trigger.e2e-spec.ts](../../test/e2e/assessment-collection-trigger.e2e-spec.ts) — 인증 e2e 의 셋업 · 401 negative 작성 형태 mirror(234 행, 가장 짧은 인증 e2e 중 하나)
- [test/jest-e2e.json](../../test/jest-e2e.json) — `testRegex` 가 `.e2e-spec.ts` 를 잡고 `maxWorkers: 1` 인 전제

## Acceptance Criteria

- [ ] `test/e2e/run-status.e2e-spec.ts` **1 파일만** 신설한다. `src/` · `web/` · `package.json` · workflow 변경 0.
- [ ] happy-path: `User` 로 seed 한 actor 의 cookie 를 붙여 `GET /api/run-status` 호출 시 **200** 이고 body 가 `active` · `evaluation.{active,runningCount,startedAt}` · `collection.{active,runningCount,startedAt}` · `observedAt` **8 필드 전부**를 `§Decision 2` 표의 타입대로 가진다. `Admin` cookie 로도 200 임을 별도 test 로 확인한다(`ROLE_HIERARCHY` 통과 — 인증된 사용자에게 403 경로가 없다는 `§Decision 3` 주장 고정).
- [ ] error path 1: cookie 없이 호출하면 **401** 이고 body 에 실행 상태 필드(`active` 등)가 새지 않는다.
- [ ] error path 2: 위조·무효 토큰 cookie 로 호출해도 **401** 이다(만료 토큰 또는 임의 문자열 중 하나로 1+).
- [ ] 분기 cover: `context.moduleRef.get(RunStatusService)` 로 실제 카운터를 조작해 ① 비실행(`active: false`, 두 축 `runningCount: 0`, `startedAt: null`) ② 평가 축만 실행(`evaluation.active: true` · `collection.active: false` · `active: true` · `startedAt` 이 ISO-8601 string) ③ 수집 축만 실행 ④ 두 축 동시 실행 네 상태를 각각 실 HTTP 로 확인한다. 각 test 는 `finally` 또는 `afterEach` 에서 `end(axis)` 로 반드시 원복해 다른 test 로 상태가 새지 않게 한다.
- [ ] negative cases 충분 cover(각 1+): (1) 응답 key 집합이 위 8 필드 **정확히** 그것뿐이라 내부 구현 필드가 새지 않는다 (2) `active === (evaluation.active || collection.active)` 및 각 축 `active === (runningCount > 0)` 불변식이 실행/비실행 양쪽에서 성립한다 (3) 동시 N 건(같은 축 `begin` 2 회) 후 `end` 1 회만 하면 여전히 `active: true` 이고 `runningCount` 가 2 → 1 로만 내려간다 (4) 조회를 2 회 연속해도 `observedAt` 이 갱신되고 조회 자체가 카운터를 바꾸지 않는다(부수효과 0 — `runningCount` 불변) (5) `POST /api/run-status` 는 **404** 다(route 는 `@Get()` 하나뿐) (6) query parameter 를 임의로 붙여도(`?foo=bar`) 200 + 동일 shape 이다(계약상 query 0).
- [ ] `evaluation.startedAt` · `collection.startedAt` 이 실행 중일 때 `Date.parse` 가능한 ISO-8601 문자열이고 비실행 시 정확히 `null` 임을 assert 한다(`undefined` · 빈 문자열 금지).
- [ ] DB 격리: 본 endpoint 는 DB write 0 이므로 `afterEach(truncateAll)` 을 두지 않고 `afterAll` 에서 정리 + `app.close()` 한다. 만약 truncate 를 넣는다면 actor `User` 가 지워지므로 `reseedAuthenticatedActors` 로 같은 id 재seed 를 반드시 동반한다.
- [ ] `pnpm lint` 0 warning · `pnpm build` 성공 · `pnpm test` 전량 green · `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 본 slice 는 production 0 LOC 라 커버리지 수치 불변) · `pnpm test:e2e` 로 신규 spec 이 green(로컬 `DATABASE_URL` 부재 시 CI `test:e2e` step 결과로 확인).

## Out of Scope

- `src/run-status/**` · `src/app.module.ts` 등 production 코드 수정 — 본 slice 는 검증층만 추가한다(수정이 필요해 보이면 고치지 말고 Follow-ups 에 적는다).
- web polling 배선(`web/src/api/runStatus.ts` · `AppShell.tsx`) — ADR-0060 `§Follow-ups (e)` 소관.
- [api.md](../architecture/api.md) 표 행 추가 · [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 갱신 · [requirements.md](../requirements.md) `102 행` REQ-083 재판정 — 전부 `§Follow-ups (f)` 소관이며 [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 상 (e) 머지 후 1 회다.
- [PLAN.md](../PLAN.md) `133 행` 마커 변경 — 잔여 ① 전역 CSS 가 남아 `[ ]` 유지.
- 다중 인스턴스 false-negative · 진행률 · 취소 · 실행 이력 — ADR-0060 이 명시적으로 범위 밖에 둔 항목.
- 기존 e2e spec 파일 수정 — 본 slice 는 신규 1 파일만 건드린다.

## Suggested Sub-agents

`tester` (spec 작성 + `pnpm lint` / `build` / `test` / `test:cov` 실행) — production 코드 변경이 0 이라 implementer 는 호출하지 않는다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

## Result (2026-09-02)

`DONE` — `pr` mode, PR [#1452](https://github.com/myungjoo/Assessment-Agent/pull/1452) → main `d87cb465`. `test/e2e/run-status.e2e-spec.ts` 1 파일 신설 `+372/-0`, production 코드 **0 LOC**. `ctx.moduleRef.get(RunStatusService)` 로 부트스트랩된 singleton 카운터를 직접 조작해 비실행 · 평가만 · 수집만 · 동시 4 상태를 실 HTTP 로 확인하고 매 test `try/finally` 원복 + `afterEach` drain 으로 상태 누수를 이중 차단했다. R-112 4 종 = happy 3 · error 2 · 분기 4 · negative 6 = **15 test**. reviewer round 1/7 APPROVE (BLOCKER 0 · MAJOR 0 · MINOR 0), CI 전 step green. `sizeExempt` 사전 수치 360 대비 실측 372 로 오차 3% — 파일 수 1 은 cap 준수.
