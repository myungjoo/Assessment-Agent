---
id: T-1958
title: POST /api/schedules/backfill/:personId e2e 계약 spec 신설
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-027]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-09-07
independentStream: backfill-e2e-contract
dependsOn: []
touchesFiles: [test/e2e/schedules-backfill.e2e-spec.ts]
plannerNote: P7 REQ-027 backfill endpoint 가 요구표에 스스로 적은 "e2e 미보유" 공백을 계약 spec 1 파일로 닫는다
---

# T-1958 — POST /api/schedules/backfill/:personId e2e 계약 spec 신설

## Why

`docs/requirements.md` `46 행` REQ-027(README `50 행` — 신규 인원 1년치 평가 **1 회**)은 검증 위치를 `unit + e2e` 로 선언해 두고 상태 칸에 스스로 **"e2e 미보유"** 를 적어 놓았다. 즉 이 REQ 는 자기 문서 안에 검증 공백을 명시한 유일한 row 다(`grep -c "e2e 미보유" docs/requirements.md` → **1**). 직전 ADR-0064 chain(T-1948~T-1957)이 종결됐고 P5 잔여 bullet 2 건(PLAN `109`·`110 행`)은 credential 게이트라 dependency-free 큐잉이 불가하므로, 본 task 는 실측으로 확인된 이 test 공백을 새 축으로 연다.

**issue-still-relevant pre-check (origin/main `7884387c` 실측)** — ① `git grep -c "backfill" origin/main -- test/` → **0 hit**(e2e·smoke·perf 어디에도 backfill 호출 0), ② `git ls-tree origin/main --name-only test/e2e/` **29 파일**에 backfill spec 부재, ③ `git grep -c "schedules/backfill" origin/main -- test/` → **0**, ④ 동일 의도 PENDING task 0 · `T-1958` ID 미사용. 반대로 검증 대상은 실재한다 — `src/scheduling/backfill.controller.ts` `69~77 행` 의 `@Post("backfill/:personId")` + `@HttpCode(202)` + `@Roles("Admin")` 과 `src/scheduling/scheduling.module.ts` `61~83 행` 의 controller·`ALREADY_BACKFILLED_CHECKER` 실 provider 배선. 따라서 안착 0 이 확정이다.

**오너 게이트 판정** — PLAN `157 행`(k6 부하검증 최우선): `package.json` · `.github/workflows/load-k6.yml` · `test/load/` 무변경이라 경합 0. PLAN `158 행`(R-92 per-route perf baseline churn 중단): 본 task 는 `test/perf/*.perf-spec.ts` 를 1 파일도 만들지 않는 **e2e 계약** slice 라 비해당. PLAN `183 행`(REQ 재판정 구현 후 1 회): 본 PR 은 `docs/requirements.md` 를 **건드리지 않는다** — REQ-027 의 "(e2e 미보유)" 표기 정정은 본 slice 머지 뒤 별도 direct doc-sync 1 회로 처리한다(Follow-ups (a)). PLAN `182 행`(소비처 동반 의무): production helper 신설 0 인 test-only slice라 비해당.

## Required Reading

- `src/scheduling/backfill.controller.ts` `48~78 행` — route path · `@HttpCode(202)` · guard stack · pass-through 계약.
- `src/scheduling/backfill-runner.service.ts` `47~125 행` — `runBackfill` 의 skip 단축 회로 · 52 window 순차 호출 · fail-fast 전파, `BackfillRunResult` 4 필드 정의(`46~59 행`).
- `src/scheduling/assessment-backfill-checker.service.ts` `28~48 행` — "직전 Assessment 존재" proxy idempotency 판정.
- `test/e2e/assessment-collection-trigger.e2e-spec.ts` `1~80 행` — no-network 전략(빈 `serviceIdentities` Person seed) + RBAC 401/403 + `createAuthenticatedE2EApp`/`truncateAll` 패턴. 본 spec 이 1:1 mirror 할 선례.
- `test/helpers/auth-e2e-helper.ts` `119~200 행` — `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors`.
- `test/helpers/db-truncate.ts` `44~60 행` — `TRUNCATE_TABLES` 8 종. `Assessment` 는 명단에 없고 `"Person"` TRUNCATE ... CASCADE 로 함께 비워진다.
- `prisma/schema.prisma` `model Assessment` — 직접 seed 시 필요한 필수 필드(`difficulty` · `contributionScore` · `volume` · `narrative`) + `@@unique([personId, period, scope, periodStart])` `314 행`.
- `docs/architecture/api.md` `165 행` — endpoint 계약 row(202 + `BackfillRunResult` + 404/409 raw forward).

## Acceptance Criteria

- [ ] 신규 파일 `test/e2e/schedules-backfill.e2e-spec.ts` **1 개만** 추가한다. `src/` · `web/` · `prisma/` · `package.json` · 워크플로 diff **0**.
- [ ] **happy-path** — 빈 `serviceIdentities` Person 을 seed 하고 Admin 쿠키로 `POST /api/schedules/backfill/:personId` 호출 시 **202** + body 가 `personId` · `totalWindows` · `triggeredCount` · `skipped` **4 key** 를 노출하고 `skipped === false`, `totalWindows === triggeredCount === 52` 임을 단언. 같은 케이스에서 DB `Assessment` 가 **52 건**이고 전부 `period === "week"` · `scope === "aggregate"` 임을 확인. 52 window 순차 처리 시간을 감안해 해당 `it` 에 **명시 timeout(≥ 60_000ms)** 을 부여한다(jest 기본 5s 로는 flaky).
- [ ] **error path** — (i) 쿠키 없이 호출 시 **401**, (ii) 존재하지 않는 `:personId` 로 Admin 호출 시 runner 의 fail-fast 전파로 **404** 임을 단언(응답 body 를 삼키지 않음).
- [ ] **분기 cover** — idempotency 분기: 같은 Person 에 `Assessment` **1 건**을 `prisma` 로 직접 seed(= `AssessmentBackfillChecker` 가 `true` 판정)한 뒤 호출하면 **202** + `skipped === true` · `triggeredCount === 0` · `totalWindows === 0` 이고 `Assessment` 건수가 **1 로 불변**(추가 생성 0)임을 단언. 52 건 재실행 대신 1 건 직접 seed 로 러닝타임을 줄인다.
- [ ] **negative case** — (i) `User` 등급 actor 쿠키로 호출 시 **403**(Admin+ tier 미달), (ii) 403·401 경로에서 `Assessment` 생성이 **0 건**임을 DB 로 확인, (iii) skip 응답이 `triggeredCount` 를 0 이 아닌 값으로 부풀리지 않음. 실 네트워크 호출 0(빈 `serviceIdentities` 로 adapter fetch 미도달)을 spec 헤더 주석에 근거와 함께 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 게이트를 계속 통과(`src/` 변경 0 이라 회귀 0). e2e 는 실 DB 필요 — 로컬 `DATABASE_URL` 부재 시 CI 의 `pnpm test:e2e`(R-113) green 으로 확인한다.
- [ ] 총 diff **≤ 300 LOC / 1 파일** 유지. 헤더 주석은 20 행 이내로 쓰고, 초과가 예상되면 케이스를 합치지 말고 주석을 줄인다.

## Out of Scope

- `src/scheduling/` 의 endpoint · runner · checker 동작 수정(계약 확장, `weeks`/`reference` 파라미터화, 영속 backfill 표식 신설) — 본 task 는 **현행 계약 고정**만 한다.
- `docs/requirements.md` REQ-027 의 "(e2e 미보유)" 표기 정정 — PLAN `183 행` once-rule 대로 본 PR 머지 뒤 direct doc-sync 1 회(Follow-ups (a)).
- `scripts/daily-test.sh` 에 leg 추가 금지 — Q-0054 선례상 drift-guard smoke 3 종 동반 수정을 강제해 5 파일 cap 을 깬다.
- `test/perf/` · `test/load/` · k6 관련 일체 무접촉(PLAN `157`·`158 행`).
- 실 token · 실 네트워크 수집 검증(ADR-0031 `§5` deferred 범위) — mock override 도 도입하지 않는다.
- `test/helpers/` 의 기존 helper 시그니처 변경. 재사용만 한다(guard 는 stateless JWT 라 actor 재-seed 불요 — `assessment-collection-trigger.e2e-spec.ts` 선례. 만약 401 이 관측되면 그때만 `reseedAuthenticatedActors` 를 `afterEach` 에 추가).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 본 PR 머지 후 direct doc-sync 1 회 — `docs/requirements.md` `46 행` REQ-027 의 "(e2e 미보유)" 표기를 실제 spec 좌표로 교체(once-rule 준수, 구현 전 재판정 0).
