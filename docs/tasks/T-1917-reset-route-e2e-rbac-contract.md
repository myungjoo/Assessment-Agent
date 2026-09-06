---
id: T-1917
title: 평가 partial-reset route e2e RBAC · 계약 왕복 (REQ-037 e2e 1/2)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-09-06
independentStream: req-037-explicit-reset-endpoint
dependsOn: [T-1915, T-1916]
touchesFiles:
  - test/e2e/assessment-evaluation-reset.e2e-spec.ts
plannerNote: P5 PLAN 106 행 R-64 — T-1916 Follow-up (a) 의 e2e 1/2(RBAC·계약). main 에 reset e2e 0 실측, 실 삭제 왕복은 2/2 로 split
---

# T-1917 — 평가 partial-reset route e2e RBAC · 계약 왕복 (REQ-037 e2e 1/2)

## Why

**축 선택 근거.** 직전 fire 의 [T-1916](T-1916-reset-by-period-controller-route.md) 이 `POST /api/assessment-evaluation/reset` route 를 배선하면서 `Follow-ups (a)` 에 e2e 를 남겼고, [docs/requirements.md](../requirements.md) `56 행` 의 REQ-037 행은 검증 수단 열이 **`e2e`** 다 — 즉 REQ-037 은 unit 만으로는 DONE 판정 근거가 갖춰지지 않는다. 같은 Follow-up 의 (b) REQ-037 재판정은 본 e2e 가 닫힌 **뒤** 1 회만 수행해야 [CLAUDE.md](../../CLAUDE.md) `§3.1` 의 "REQ 당 1 회" 와 [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시(왕복 제거)를 동시에 지킨다. 지금 재판정을 먼저 하면 e2e 머지 후 같은 REQ 를 다시 판정하는 왕복이 되므로 순서상 본 task 가 먼저다. 경쟁 축은 전부 자율 집행 불가다 — PLAN `157 행` R-91 은 배포기기 자격증명 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트, `158 행` R-92 는 오너가 신규 per-route slice 큐잉을 금지한다.

**issue-still-relevant pre-check (origin/main `e948ca7a` 실측).** 본 spec 이 아직 없음을 확인했다 — `git ls-tree origin/main test/e2e/` 는 28 개 spec 을 나열하지만 reset 계열 파일이 0 이고, `git grep -n "reset" origin/main -- test/e2e/` 의 유일한 hit 은 `period-bridge-reevaluate.e2e-spec.ts` `125 행` 의 주석("reset-and-recreate" 라는 replace 의미론 설명)뿐이라 reset route 를 때리는 e2e 케이스가 0 이다. 반대로 선행 slice 산출물은 이미 안착했다 — `assessment-evaluation.controller.ts` `739 행` 에 `@Post("reset")` 이, `dto/reset-by-period-request.dto.ts` (45 행) 에 `ResetByPeriodRequestDto` 가 실재한다. 즉 본 task 는 main 에 안착한 일의 재큐잉이 아니다.

**split 근거 (cap 사고 사전 차단).** 동형 e2e 3 종의 실측 분량은 `unevaluated-fill-plan` 328 행 · `period-bridge-reevaluate` 303 행 · `unevaluated-fill-run` 296 행으로 **한 파일이 이미 cap(300 LOC) 경계**다. 여기에 실 Assessment · Summary row seed(필수 컬럼 다수 + Person FK)를 더하면 확실히 초과하므로 Follow-up (a) 를 둘로 나눈다 — 본 task 는 **부팅 왕복 · guard · pipe · 멱등 0/0 계약** 만(좌표 seed 0), 실 삭제 왕복(seed → reset → row 감소 단언)은 2/2 후속이다. 새 dependency 0 · production 변경 0 LOC · 새 결정 0(따라서 새 ADR 0).

## Required Reading

- [docs/tasks/T-1916-reset-by-period-controller-route.md](T-1916-reset-by-period-controller-route.md) `Follow-ups` 절 — 본 task 가 이행하는 (a) 의 명세, 그리고 (b) 재판정이 본 task 뒤라는 순서.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `739 행` ~ `760 행` — 검증 대상 route 의 decorator stack(`@Post("reset")` · `@HttpCode(200)` · `JwtAuthGuard`/`RolesGuard` · `@Roles("Admin")`)과 응답 4 필드 · 순차 위임 계약.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `145 행` ~ `152 행` — controller prefix(`api/assessment-evaluation`)와 controller-scope `ValidationPipe` 설정(`whitelist` · `forbidNonWhitelisted` · `transform`) — 400 케이스의 근거.
- `src/assessment-evaluation/dto/reset-by-period-request.dto.ts` (전체 45 행) — `personId` · `period` 2 필드에 `@IsString` + `@IsNotEmpty` 만 적용, `@IsIn` 미적용(허용 literal 은 service 책임)이라는 경계.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` `140 행` ~ `152 행` 및 `274 행` ~ `282 행` — `resetByPeriod` 의 `deleteMany` 와, 허용 외 period 를 **plain `Error`** 로 던지는 `assertValidPeriod`(HTTP 매핑이 없다는 사실이 본 spec 의 status 단언 근거).
- `src/assessment-evaluation/summary-persist.service.ts` `140 행` ~ `150 행` — 둘째 위임 대상의 동형 시그니처.
- `test/e2e/unevaluated-fill-plan.e2e-spec.ts` `79 행` ~ `115 행` (describe · beforeAll · afterAll · afterEach 관행), `223 행` ~ `287 행` (401/403/400 negative 케이스 관행), `304 행` ~ `328 행` (truncate 후 actor 재-seed 회귀) — 본 spec 의 1:1 mirror 대상.
- `test/helpers/auth-e2e-helper.ts` `72 행` ~ `145 행` — `AuthenticatedE2EContext` · `buildAuthCookie` · `createAuthenticatedE2EApp` 의 시그니처와 actor seed 범위.
- `test/helpers/db-truncate.ts` (전체) — `truncateAll` 의 대상 모델과 CASCADE 범위, actor User 가 함께 지워진다는 사실.
- `test/jest-e2e.json` (전체 14 행) — `testRegex` 가 `*.e2e-spec.ts` 를 자동 수집하므로 **등록 파일 수정이 0** 이라는 근거(파일 수 cap 이 1 로 닫히는 이유).

## Acceptance Criteria

- [ ] `test/e2e/assessment-evaluation-reset.e2e-spec.ts` 1 파일만 신설한다(production `src/` 변경 0 LOC, 기존 spec · helper · config 수정 0). `describe` 는 route 와 task ID 를 포함한 한국어 서술로 연다.
- [ ] **happy-path** — Admin 쿠키 + 유효 body(`personId` · `period`) 로 실 부팅 왕복 1+ 케이스: status 200 이고 응답이 `{ personId, period, deletedAssessments, deletedSummaries }` 4 필드 shape 이며, 좌표를 seed 하지 않은 상태이므로 삭제 건수가 둘 다 `0` (요청 personId · period 가 응답에 그대로 echo 되는 것까지 단언).
- [ ] **error path** — (1) 허용 외 period literal(예: `"quarter"`)을 Admin 쿠키로 보내면 service 의 `assertValidPeriod` 가 plain `Error` 를 던져 controller 가 자체 매핑 없이 전파한 결과인 **500** 이 오는 케이스 1+ (2) 그 요청이 400 이 **아님**(=DTO 가 literal 을 검증하지 않는다는 책임 경계) 을 같은 케이스에서 함께 단언.
- [ ] **분기별 cover** — 인증 실패 분기 · 인가 실패 분기 · 검증 실패 분기 · 성공 분기를 각각 **별도 `it`** 으로 분리한다(한 케이스가 두 분기를 겹쳐 덮지 않게 한다).
- [ ] **negative case (예외 분기마다 1+)** — (1) 쿠키 부재 시 401 (`JwtAuthGuard`) (2) User tier 쿠키 시 403 (`RolesGuard` + `@Roles("Admin")`) (3) 빈 body 시 400 (필수 2 축 누락) (4) `period` 만 누락 시 400 (5) DTO 정의 외 필드를 섞으면 400 (`forbidNonWhitelisted` — reset 은 파괴적 연산이라 오타 필드 차단이 계약) (6) `personId` 가 문자열이 아닌 wrong-type 일 때 400 (`@IsString`).
- [ ] **멱등 계약** — 같은 body 로 연속 2 회 호출해도 두 번 다 200 + `0/0` 인 케이스 1+ (삭제 대상 부재를 오류로 만들지 않는다).
- [ ] **actor-present 회귀** — `afterEach(truncateAll)` 이 actor User 를 지운 뒤에도 후속 요청이 200 을 받도록 관행대로 actor 를 재-seed 한다(`unevaluated-fill-plan.e2e-spec.ts` `304 행` ~ `328 행` mirror). 이 재-seed 가 없으면 두 번째 이후 케이스가 401/404 로 깨진다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`). e2e 는 unit coverage 집계 대상이 아니고 신규 production symbol 이 0 이므로 게이트는 기존 unit 으로 유지된다 — 이 사실을 spec 머리 주석에 1~2 줄로 박제한다.
- [ ] 로컬에 `DATABASE_URL` 이 없어 e2e 를 돌릴 수 없으면 CI 의 `test:e2e` step 결과로 검증을 위임하고, 그 사실을 tester trail 에 명시한다(실행하지 않은 것을 통과로 적지 않는다).

## Out of Scope

- **실 삭제 왕복** — Assessment · Summary row 를 seed 한 뒤 reset 이 그 row 만 지우고 다른 period 는 보존함을 확인하는 케이스. cap 근거로 2/2 로 분리했다(`Follow-ups (a)`).
- `src/` 변경 일체 — controller · 두 persist service · DTO · module 모두 있는 그대로 소비한다. 허용 외 period 의 500 을 400 으로 바꾸고 싶어도 본 task 에서 고치지 않고 `Follow-ups` 에 적는다.
- 기존 e2e spec · `test/helpers/*` · `test/jest-e2e.json` · `deploy/daily-test*` 수정 — `testRegex` 자동 수집이라 등록 작업이 0 이고, 파생 drift-guard smoke spec 을 건드리면 파일 수 cap 이 깨진다.
- `docs/requirements.md` REQ-037 재판정 · PLAN `106 행` checkbox 변경 — 본 slice 머지 후 1 회만([CLAUDE.md](../../CLAUDE.md) `§3.1`, PLAN `183 행`).
- Admin UI(web) 의 reset 노출 · 광역 reset · dry-run · 삭제 감사 로그 — 새 결정이 필요한 범위.
- 머리 주석은 동형 spec 의 50 행대 주석 블록을 그대로 복제하지 말고 요지 위주로 **30 행 이내**로 압축한다(cap 여유 확보).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) e2e 2/2 — 실 삭제 왕복: Assessment + Summary row seed → reset → 해당 좌표만 삭제되고 다른 period row 는 보존됨을 건수와 잔존 row 로 단언(본 slice 머지 후).
- (b) REQ-037 재판정 1 회 — e2e 2/2 까지 닫힌 뒤 `docs/requirements.md` `56 행` 상태 문자열 · PLAN `106 행` checkbox 를 한 번에 재판정(중간 재판정 금지).
