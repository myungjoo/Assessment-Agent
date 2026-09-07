---
id: T-1963
title: POST /api/schedules/recent-deletion/:personId e2e 계약 spec 신설
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 215
estimatedFiles: 1
created: 2026-09-08
independentStream: e2e-contract-gap
dependsOn: []
touchesFiles: [test/e2e/schedules-recent-deletion.e2e-spec.ts]
plannerNote: P7 REQ-041 이 검증 위치를 "unit + e2e" 로 선언했으나 test/ 의 recent-deletion 참조가 0 인 공백을 계약 spec 1 파일로 닫는다
---

# T-1963 — 최근 N일 결과 manual delete → 재수집 endpoint e2e 계약 spec 신설

## Why

`docs/requirements.md` `60 행` REQ-041 (README `74 행`, R-74 "Admin 최근 N일 결과 manual delete → 재수집") 은 검증 위치 열에 **`unit + e2e`** 를 선언하고 상태 값도 `DONE` 이지만, 실제로는 e2e 축이 존재하지 않는다. 직전 T-1958 이 닫은 REQ-027 backfill 공백과 **같은 형태의 잔여 공백**이며, `test/e2e/` 31 파일 중 이 endpoint 를 도는 것이 하나도 없어 controller ↔ runner ↔ module 실 배선이 HTTP 계약 수준에서 한 번도 고정된 적이 없다.

**issue-still-relevant pre-check (origin/main `7204b67f` 실측)** — ① `git grep -c "recent-deletion" origin/main -- test/` **0 hit** (unit spec 은 `src/scheduling/` colocated 만 존재), ② `git ls-tree origin/main --name-only test/e2e/` 에 `recent`/`deletion` 매칭 파일 **0**, ③ `docs/tasks/` 에서 `recent-deletion` 을 언급하는 **非-DONE task 0 건**, ④ `T-1963` ID 미사용 확인. 반대로 검증 대상은 실재한다 — [`src/scheduling/recent-deletion.controller.ts`](../../src/scheduling/recent-deletion.controller.ts) 의 `@Post("recent-deletion/:personId")` + `@HttpCode(202)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + controller-scope `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, [`src/scheduling/scheduling.module.ts`](../../src/scheduling/scheduling.module.ts) 의 `RecentDeletionController` 등록 + `RecentDeletionRunnerService` provider 배선(`RECENT_DELETION_DELETER` 는 미주입 = 삭제 0 안전 기본값). 즉 "이미 안착된 일" 이 아니라 **아직 아무도 검증하지 않은 실 배선** 이다.

오너 게이트 판정 — PLAN `157 행`(k6·`test/load` 무접촉) · `158 행`(`test/perf` 무접촉, per-route baseline slice 아님) · `182 행`(test-only 라 helper 신설 0, 소비처 동반 의무 비해당) · `183 행`(REQ-041 재판정 task 미생성 — 본 PR 은 `docs/requirements.md` 무접촉, 재판정은 머지 후 direct doc-sync 1 회로 유예) 전부 미침범.

## Required Reading

- `src/scheduling/recent-deletion.controller.ts` — route · 202 · RBAC tier · ValidationPipe 옵션 · raw forward 정책 (파일 상단 주석이 계약 정본).
- `src/scheduling/dto/recent-deletion.dto.ts` — `instants!: string[]` (`@IsArray` + `@ArrayMaxSize(1000)` + `@IsISO8601({}, { each: true })`) · `days?: number` (`@IsOptional` + `@IsInt` + `@IsPositive`).
- `src/scheduling/recent-deletion-runner.service.ts` `58 행` ~ `140 행` — `RecentDeletionRunResult` 3 key (`personId` / `deletedCount` / `recollected`), `toDelete` 빈 케이스 no-op 분기, deleter 미주입 시 `deletedCount` 0, 재수집 후 `recollected: true`, fail-fast 전파 정책.
- `src/scheduling/recent-deletion-window.ts` `17 행` ~ `55 행` — `DEFAULT_DAYS = 1` · `MAX_DAYS = 366` · window 가 KST 일 경계 `[start, end)` 라는 점 (in-window instant 선택 근거).
- `test/e2e/schedules-backfill.e2e-spec.ts` — 1:1 mirror 할 패턴 (no-network 전략 · `createAuthenticatedE2EApp` 다중 actor · `afterEach truncateAll` · seed helper).

## Acceptance Criteria

신규 파일은 **`test/e2e/schedules-recent-deletion.e2e-spec.ts` 1 개** 뿐이다. 아래 전 항목은 `pnpm test:e2e` (실 PostgreSQL) 로 검증한다.

- [ ] **happy-path** — Admin 쿠키 + `serviceIdentities` 가 빈 Person + 현재 시각 instant 1 건(기본 `days` 미지정 = 1 일 window 안) 요청 시 **202** 와 body 3 key (`personId` 일치 · `deletedCount: 0` (`RECENT_DELETION_DELETER` 미주입 기본) · `recollected: true`) 를 검증하는 test 1+.
- [ ] **happy-path (days 명시 축)** — `days: 7` 을 명시한 요청도 202 + 동일 shape 를 반환해 선택 필드가 계약대로 통과함을 검증하는 test 1+.
- [ ] **error path** — ① 존재하지 않는 `:personId` 로 in-window instant 를 보내면 재수집 단계의 `NotFoundException` 이 삼켜지지 않고 **404** 로 표면화됨 ② 인증 쿠키 없이 호출 시 **401** — 각 test 1+.
- [ ] **분기 (no-op)** — instants 가 전부 window 밖(예: 30 일 전 ISO)이거나 **빈 배열**일 때 202 + `recollected: false` + `deletedCount: 0` 로 삭제·재수집이 발화하지 않음을 검증하는 test 각 1+ (runner 의 `toDelete.length === 0` 단축 회로).
- [ ] **분기 (ValidationPipe)** — ① `instants` 원소가 비-ISO 문자열 ② `instants` 가 배열 아님 ③ `days` 가 0 또는 음수(비-`@IsPositive`) ④ 정의되지 않은 키 포함(`forbidNonWhitelisted`) — 네 경우 각각 **400** 을 검증하는 test 각 1+.
- [ ] **negative case** — ① `User` actor 쿠키는 tier 미달 **403** ② `SuperAdmin` actor 쿠키는 escalation 으로 **202** 통과 ③ 401/403 경로에서 재수집이 발화하지 않아 `Assessment` 가 **0 건**으로 남음 — 각 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (R-110 — production 변경 0 LOC 여도 tester 필수 호출).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` diff 0 이라 전역 coverage 회귀가 없어야 한다.
- [ ] no-network 확인: 실 GitHub/Confluence 토큰·네트워크 0 — happy 경로는 `serviceIdentities` 가 빈 Person 을 seed 해 adapter fetch 가 0 회가 되도록 하고(backfill spec 전략 1:1 mirror), mock override 는 도입하지 않는다.
- [ ] 격리: 기존 `test/helpers/auth-e2e-helper.ts` · `test/helpers/db-truncate.ts` 를 **무수정 재사용**하고 신규 helper 를 만들지 않는다. `afterEach(truncateAll)` + `afterAll(app.close + $disconnect)` 유지.

## Out of Scope

- `src/` · `web/` · `prisma/` · `.github/workflows/` · `package.json` 변경 — production 코드 diff 0 인 test-only slice 다.
- `docs/requirements.md` REQ-041 재판정 — 본 PR 머지 후 별도 direct doc-sync task 1 회 (PLAN `183 행` once-rule).
- `days > 366` (`MAX_DAYS` 초과) · 비-정수 `reference` 등 helper 의 `RangeError`/`TypeError` 가 **5xx 로 표면화**되는 경로 assert — 현행 계약을 500 으로 못박지 않기 위해 본 slice 에서 다루지 않고 아래 Follow-ups 로 넘긴다.
- `RECENT_DELETION_DELETER` 실 repository provider 바인딩(삭제 0 → 실 삭제 전환) — schema/repository 게이트 동반 별도 slice.
- `scripts/daily-test.sh` leg 추가 (Q-0054 선례 — leg 추가는 drift-guard smoke 3 종 동반 갱신을 강제해 파일 cap 을 깬다).
- `test/perf/` per-route baseline spec 추가 (PLAN `158 행` 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `days > 366` 요청이 `RangeError` → 500 으로 나가는 현행 동작이 적절한지 판정 (400 매핑이 필요하면 controller/DTO 축 별도 pr task).
- 본 PR 머지 후 `docs/requirements.md` `60 행` REQ-041 상태 칸에 실 e2e 좌표(파일 · describe · it 수)를 박제하는 direct doc-sync 1 회.
