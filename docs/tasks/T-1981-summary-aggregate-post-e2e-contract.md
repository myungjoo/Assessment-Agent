---
id: T-1981
title: POST /api/assessment-evaluation/summary 의 LLM-무의존 계약면 e2e 신설 (시점 게이트 skip · 400 매트릭스 · RunStatus 짝)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004, REQ-043, REQ-045]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts]
independentStream: assessment-evaluation-summary-e2e
created: 2026-09-08
plannerNote: P5 · PLAN 166 행 e2e 축 — summary route 는 test/ 전체 히트 0(unit mock 만); import 대칭 축은 realdb perf 중복이라 회피
---

# T-1981 — POST /api/assessment-evaluation/summary 의 LLM-무의존 계약면 e2e 신설

## Why

PLAN [`166 행`](../PLAN.md) 의 E2E 시나리오 커버리지 축에서 **`POST /api/assessment-evaluation/summary` 는 실 부팅 왕복 검증이 0** 이다. pre-check 실측(origin/main `21948072`):

- `test/` **전체**(e2e 36 spec + perf + smoke)에서 `assessment-evaluation/summary` 문자열 히트 **0**. 같은 controller 의 다른 route 는 e2e 히트가 있다 — `period` 9 · `unevaluated-fill-run` 3 · `unevaluated-fill-plan` 3 · `reset` 3 · `relative-comparison` 2(T-1979) — 즉 **summary 만 남은 마지막 공백**이다(`evaluate` 도 0 이나 그쪽은 실 LLM 실행이 본체라 별도 주제).
- 구현은 이미 main 에 실재하므로 **미구현 신설이 아니라 계약 고정**이다 — [`assessment-evaluation.controller.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `887~888 행`(`@Post("summary")` + `@HttpCode(200)`), `891 행`(`summarize`), `909`·`919 행`(`runStatus.begin` / `finally end`), `929~941 행`·`955~958 행`(400 매퍼 3 분기).
- 기존 커버는 **controller unit spec 뿐이고 boundary 를 잠그지 못한다** — [`assessment-evaluation.controller.spec.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 에 `summarize` 히트 25 건이 있으나 orchestrator·RunStatus 를 mock 으로 주입하고 controller 를 직접 호출하므로 **ValidationPipe(whitelist / forbidNonWhitelisted) · JwtAuthGuard · RolesGuard · HTTP status 매핑 · 실 DB write 0 은 어느 spec 도 통과시키지 않는다**.

e2e 로만 잡히는 축 3 개:

1. **`@HttpCode(200)` + skip 의 성공 의미** — 시점 게이트가 진행 중 구간으로 판정하면 [`summary-aggregate-orchestrator.service.ts`](../../src/assessment-evaluation/summary-aggregate-orchestrator.service.ts) `113~116 행` 이 `{ evaluated: false }` 를 돌려주고 controller 는 이를 404/409 로 바꾸지 않는다. `@Post` 기본값 201 이 아닌 **200** 이라는 사실과 skip 이 오류가 아니라는 계약은 실 HTTP 왕복에서만 관찰된다.
2. **400 이 begin 이전이라는 순서 계약** — `929~958 행` 의 매퍼 3 분기(difficulty / contribution / mode)와 DTO 형식 위반은 `909 행` `begin("evaluation")` **앞**에서 끊겨야 한다. 이 순서가 뒤집히면 실행에 진입하지도 못한 요청이 카운터를 올리거나 짝 없는 end 를 남긴다 — 같은 프로세스의 [`run-status.controller.ts`](../../src/run-status/run-status.controller.ts) `51~56 행` `GET /api/run-status` 로 관찰하는 **cross-controller 상태 축이라 unit spec 이 구조적으로 못 잡는다**.
3. **알 수 없는 period 의 500 경계** — [`period-evaluable.ts`](../../src/assessment-evaluation/domain/period-evaluable.ts) `50~53 행` 의 `computePeriodEnd` 는 `HttpException` 이 아닌 **평문 `Error`** 를 던진다. DTO 에 `@IsIn` 이 0 개라([`summary-aggregate-request.dto.ts`](../../src/assessment-evaluation/dto/summary-aggregate-request.dto.ts) `23 행` 이 스스로 근거를 적는다) `period: "year"` 는 400 이 아니라 **500** 으로 나가며, 그 본문에 내부 메시지가 새지 않는지는 실 필터 stack 을 태워야 확인된다.

**issue-still-relevant pre-check — 직전 slice 의 이월 항목을 그대로 받지 않은 근거**: T-1980 `Out of Scope` 는 import 대칭 3 route(`running` · `modes` · `:id`) e2e 를 이월했으나, 실측 결과 그 축은 이미 **실 DB perf-spec 2 개가 mock 0 · override 0 으로 덮고 있다** — [`import-read-realdb.perf-spec.ts`](../../test/perf/import-read-realdb.perf-spec.ts) `161~258 행`(modes·running happy 2 + RUNNING 0 건 200 `[]` + status 혼재 필터 + 401 2 종 + 403 2 종), [`import-detail-read-realdb.perf-spec.ts`](../../test/perf/import-detail-read-realdb.perf-spec.ts)(`:id` happy + 404). 지금 e2e 를 새로 파면 **동일 단언의 재작성**이라 PLAN [`182 행`](../PLAN.md)(과분할 금지) 취지에 어긋난다. 따라서 그 축은 이월하지 않고 **덮인 곳이 한 곳도 없는 summary route** 로 옮긴다.

오너 게이트 미침범 실측 — PLAN [`157`](../PLAN.md)·[`158 행`](../PLAN.md)(신규 perf/load slice 금지): 본 task 는 `test/perf/`·`test/load/` **무접촉**(위 perf-spec 은 읽기 참조만). [`182 행`](../PLAN.md): 신설 helper **0** — 기존 [`auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts)·[`db-truncate.ts`](../../test/helpers/db-truncate.ts) 만 재사용하고, 절단면을 케이스 1 개가 아니라 **LLM 도달 전 계약면 전량**으로 잡아 잔여 slice 를 남기지 않는다. [`183 행`](../PLAN.md): `docs/requirements.md` 무접촉 — REQ 재판정은 머지 후 필요 시 1 회로 이월.

## Required Reading

- [`src/assessment-evaluation/assessment-evaluation.controller.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `856~886 행`(route 머리 주석: skip 은 오류가 아님 · reject raw 전파 · 검증 분담), `887~890 행`(`@Post("summary")` + `@HttpCode(200)` + `@Roles("Admin")`), `891~921 행`(DTO→도메인 변환을 begin **앞**에 배치 → `begin` → `return await` → `finally end`), `929~941 행`(`toEvaluationResult` 의 difficulty·contribution 400 분기, 메시지에 `unitId` 포함), `955~958 행`(`toPersistMode` 의 fill/reeval 외 400).
- [`src/assessment-evaluation/summary-aggregate-orchestrator.service.ts`](../../src/assessment-evaluation/summary-aggregate-orchestrator.service.ts) — `104~126 행`(게이트 false → `{ evaluated: false }` write 0 반환 / true → persist 위임).
- [`src/assessment-evaluation/domain/period-evaluable.ts`](../../src/assessment-evaluation/domain/period-evaluable.ts) — `40~58 행`(`computePeriodEnd` — day/week/month 의 KST 반열림 종료 시각, 알 수 없는 period 는 평문 `Error`), `72~79 행`(`isPeriodEvaluable` = `now ≥ periodEnd`).
- [`src/assessment-evaluation/dto/summary-aggregate-request.dto.ts`](../../src/assessment-evaluation/dto/summary-aggregate-request.dto.ts) — `26~32 행`(whitelist·forbidNonWhitelisted 로 강제되는 400 2 종), `60~92 행`(nested `SummaryAggregateUnitResultDto` 5 필드 — `narrative` 는 빈 문자열 허용, `volume` 은 `@IsInt` + `@Min(0)`), `93~137 행`(`personId` · `period` · `periodStart`(`@IsISO8601`) · `mode` · `modelId` · `results`).
- [`src/run-status/run-status.controller.ts`](../../src/run-status/run-status.controller.ts) `44~56 행` + [`run-status.service.ts`](../../src/run-status/run-status.service.ts) `23~37 행`·`99~105 행` — snapshot 형태(`{ active, evaluation: { active, ... }, collection }`), `@Roles("User")` tier.
- [`test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts`](../../test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts) — 같은 controller 의 직전 e2e(T-1979): `createAuthenticatedE2EApp` 다중 actor · `buildAuthCookie` · guard `it.each` · SuperAdmin 과차단 0 패턴 참고본.
- [`test/e2e/run-status.e2e-spec.ts`](../../test/e2e/run-status.e2e-spec.ts) — `GET /api/run-status` 호출·단언 형태 참고본(본 spec 은 idle 관찰용으로만 재사용, 그 spec 은 수정 0).
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `132~162 행`(actor seed + token 발급) — `afterEach` 의 `truncateAll` 이 actor User 를 지우므로 `reseedAuthenticatedActors` 로 원 `id`/`email`/`role` 재 seed 하는 기존 순서를 그대로 따를 것.

## Acceptance Criteria

신규 파일 **[`test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts`](../../test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts) 1 개만** 추가하고 아래를 모두 만족한다.

- [ ] **happy-path (R-112 (1))** — 아직 끝나지 않은 구간(예: `period: "month"` + `periodStart` 가 이번 달 KST 월초, 또는 미래 좌표)으로 유효 body 를 보내면 **201 이 아니라 200** 이고 본문이 정확히 `{ evaluated: false }` 임을 단언한다(`result` 키 부재). Admin actor 기준.
- [ ] **분기 (R-112 (3))** — ① 시점 게이트를 `day` · `week` · `month` 세 granularity 각각 진행 중 좌표로 두드려 모두 200 + `evaluated: false` 임을 단언(`computePeriodEnd` 3 분기). ② `mode: "fill"` 과 `"reeval"` 두 허용 값이 각각 게이트 앞을 통과함(400 이 아님)을 단언해 `toPersistMode` 의 통과 분기를 cover.
- [ ] **DB write 0 계약** — 위 skip 요청 전후로 `prisma.summary.count()` 가 불변임을 단언한다(게이트 false 경로는 persist 미호출).
- [ ] **error path (R-112 (2))** — `period: "year"`(DTO 형식은 통과하나 도메인 미허용)로 호출하면 **500** 이고, 본문에 내부 예외 메시지(`알 수 없는 period`)·스택 트레이스·SQL 이 노출되지 않음을 단언한다.
- [ ] **negative (R-112 (4)) — 예외 분기마다 1+** — 아래를 각각 1 케이스 이상 cover 한다(가능하면 `it.each` 로 묶되 단언은 분기별로 구분):
      (a) `results[0].difficulty` 미허용 값 → 400 + 메시지에 해당 `unitId` 포함, (b) `results[0].contribution` 미허용 값 → 400, (c) `mode` 가 fill/reeval 외 → 400, (d) 정의되지 않은 body 필드 추가 → 400(forbidNonWhitelisted), (e) 필수 필드 누락 또는 wrong type(예: `volume: "3"` / 음수) → 400, (f) `periodStart` 가 비-ISO 문자열 → 400(`@IsISO8601`), (g) Cookie 미부착 → 401, (h) 변조/손상 토큰 → 401, (i) `User` role actor → 403. 401/403 응답 본문에 요청 body 나 도메인 데이터가 되비치지 않음도 단언.
- [ ] **과차단 0** — `SuperAdmin` actor 가 skip happy-path 와 동일하게 200 + `{ evaluated: false }` 를 받음을 단언(RolesGuard escalation).
- [ ] **RunStatus 짝 불변식(cross-controller)** — 위 400 케이스 1 건 직후 `GET /api/run-status` 가 `evaluation.active === false`(begin 미진입)이고, skip 200 케이스와 500 케이스 직후에도 `evaluation.active === false`(짝 없는 end 0 — `finally` 로 해소)임을 단언한다. `GET /api/run-status` 는 `@Roles("User")` 라 어떤 actor 로도 조회 가능하다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 본 task 는 `src/` 0 LOC 변경이라 전역 coverage 불변이어야 한다).
- [ ] `pnpm test:e2e` green — 신규 suite 1 개가 실행 목록에 포함되고 기존 e2e suite 는 하나도 깨지지 않는다(`afterEach` 의 `truncateAll` → `reseedAuthenticatedActors` 순서를 기존 e2e 와 동일하게 유지).
- [ ] diff ≤ 300 LOC · 파일 1 개(CLAUDE.md §3 cap).

## Out of Scope

- **`evaluated: true` happy-path(실제 종합 코멘트 생성)** — `SummaryNarrativeService` 가 실 LLM round-trip 을 타고 e2e 는 mock override 0 원칙이라 자격증명 없이 결정적이지 않다. 본 spec 은 **LLM 도달 전 계약면만** 고정한다. persist 경합 `ConflictException` 경로도 같은 이유로 제외.
- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 — **test-only**. 구현 결함을 발견하면 고치지 말고 `Follow-ups` 에 적는다.
- 같은 controller 의 `evaluate` · `period` · `unevaluated-fill-plan` · `unevaluated-fill-run` · `reset` · `relative-comparison` 재검증(이미 e2e 보유) 및 `test/e2e/run-status.e2e-spec.ts` 수정(읽기 재사용만).
- import 대칭 3 route e2e — 위 `Why` 의 pre-check 대로 realdb perf-spec 2 개가 이미 덮어 **중복이므로 만들지 않는다**(다시 이월하지 말 것).
- `test/perf/` · `test/load/` 접촉(PLAN `157`·`158 행`) 및 신규 test helper 신설(PLAN `182 행` — 기존 2 helper 재사용만).
- `docs/requirements.md` REQ status 재판정(PLAN `183 행` — 머지 후 1 회로 이월).
- 케이스별 서술 주석은 1~2 줄로 제한한다(장문 머리 주석으로 cap 을 초과시키지 말 것).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
