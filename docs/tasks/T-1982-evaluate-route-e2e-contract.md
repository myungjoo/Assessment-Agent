---
id: T-1982
title: POST /api/assessment-evaluation/evaluate e2e 계약 spec 신설 (stub gateway 결정적 왕복 · fill/reeval 영속 분기 · 400 매트릭스 · RBAC)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-003, REQ-010, REQ-031, REQ-043, REQ-045]
estimatedDiff: 295
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/e2e/assessment-evaluation-evaluate.e2e-spec.ts]
independentStream: assessment-evaluation-evaluate-e2e
created: 2026-09-08
plannerNote: P5 · PLAN 166 행 e2e 축 — 전체 route 인벤토리에서 실 왕복이 0 으로 남은 마지막 route(evaluate) 를 stub gateway 로 계약 고정
---

# T-1982 — POST /api/assessment-evaluation/evaluate e2e 계약 spec 신설

## Why

PLAN [`166 행`](../PLAN.md) 의 E2E 시나리오 커버리지 축에서 **`POST /api/assessment-evaluation/evaluate` 는 실 부팅 왕복이 0** 이다. pre-check 실측(origin/main `4409b6b3`):

- **route 인벤토리 전수 대조** — `src/**/*.controller.ts` 의 route decorator 102 개를 뽑아 `test/e2e/` 37 spec 의 경로 리터럴과 대조한 결과, e2e 히트가 **0 인 route 는 3 개**뿐이다: `POST /api/assessment-evaluation/evaluate` · `GET /api/admin/import/modes` · `GET /api/admin/import/running`. 뒤의 2 개는 [T-1981](T-1981-summary-aggregate-post-e2e-contract.md) `§Why` 가 실측으로 "realdb perf-spec 2 개가 mock 0 · override 0 으로 이미 덮어 중복" 이라고 판정해 **명시적으로 이월 금지**했으므로, 남은 유일한 공백이 `evaluate` 다.
- `git grep -c "assessment-evaluation/evaluate" -- test/` 히트 **0**(e2e · perf · smoke · load 전부). `test/e2e/` 의 `evaluate` 문자열 매칭은 전부 다른 route(`reevaluate` · `unevaluated-fill-*`) 이고, k6 부하 script 도 [`test/load/s1-batch.js`](../../test/load/s1-batch.js) `172 행` 이 `unevaluated-fill-run` 을 때릴 뿐 본 route 는 미접촉이다.
- 구현은 이미 main 에 실재하므로 **미구현 신설이 아니라 계약 고정**이다 — [`assessment-evaluation.controller.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `263~266 행`(`@Post("evaluate")` + `@HttpCode(200)` + `@UseGuards` + `@Roles("Admin")`), `279 행`(`runStatus.begin` 을 try **밖**에 배치), `285~288 행`(orchestrator 위임), `309 행`(persist 위임), `324~326 행`(`finally end`).
- 기존 커버는 **controller unit spec 뿐이고 boundary 를 잠그지 못한다** — [`assessment-evaluation.controller.spec.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 의 `evaluate` 문자열 매칭 **346** 건은 전부 orchestrator · persist · RunStatus 를 mock 으로 주입하고 controller 메서드를 직접 호출하는 축이라, **ValidationPipe(whitelist / forbidNonWhitelisted / nested `@ValidateNested`) · JwtAuthGuard · RolesGuard · 실 Postgres write · unique 좌표 충돌 분기** 를 어느 spec 도 통과시키지 않는다.

e2e 로만 잡히는 축 3 개:

1. **fill 재호출의 `contributionCount: 0` 계약** — [`evaluation-result-persist.service.ts`](../../src/assessment-evaluation/evaluation-result-persist.service.ts) `160~178 행` 은 같은 좌표(`personId_period_scope_periodStart`)가 이미 있으면 fill 모드에서 **기존 `assessmentId` 를 그대로 돌려주고 `contributionCount` 를 0 으로** 낸다. 즉 두 번째 호출의 `contributionCount: 0` 은 "평가 실패" 가 아니라 **idempotent no-op 의 성공 표기**이며, 이 의미는 실 unique index 위에서 두 번 왕복해야만 관찰된다(mock 은 자기가 정한 값을 되돌려줄 뿐이다).
2. **reeval 재호출의 row 교체** — 같은 파일 `189~199 행` 이 기존 row 를 delete(component `Contribution` 은 cascade) 한 뒤 `205~223 행` `createAssessment` 로 재생성한다. 따라서 `assessmentId` 가 **바뀌고** Assessment 총 row 수는 1 로 유지되며 Contribution 은 재생성된다 — schema `294~317 행` 의 `@@unique` + `onDelete: Cascade` 와 결합된 결과라 실 DB 없이는 단언 불가.
3. **미허용 `scope` 의 500 경계** — DTO 에 `@IsIn` 이 없어 형식만 통과하는 `scope` 값은 persist 의 `258~264 행` `assertValidAggregate` 가 **평문 `Error`** 로 던진다(HttpException 아님) → 400 이 아니라 **500**. 본문에 내부 메시지·스택·SQL 이 새지 않는지는 실 필터 stack 을 태워야 확인된다. 같은 프로세스의 [`run-status.controller.ts`](../../src/run-status/run-status.controller.ts) `51~56 행` 으로 관찰하는 **짝 없는 end 0** 도 cross-controller 라 unit 이 구조적으로 못 잡는다.

**LLM 왕복 회피 전략(본 task 의 핵심 전제)** — `evaluate` 의 happy-path 는 [`evaluation-scoring.service.ts`](../../src/assessment-evaluation/evaluation-scoring.service.ts) `99~101 행` 에서 gateway 를 반드시 1 회 호출하고 DTO 는 `@ArrayMinSize(1)` 이라 "빈 입력으로 LLM 을 피하는" 경로가 없다. 그러나 [`assessment-evaluation.module.ts`](../../src/assessment-evaluation/assessment-evaluation.module.ts) `176~181 행` 의 `LLM_GATEWAY` `useFactory` 가 **env `LOAD_TEST_STUB === "1"` 일 때만** [`LlmStubGateway`](../../src/llm/llm-stub-gateway.service.ts) 를 고르므로(ADR-0057 `D1`, 판정은 module 초기화 1 회), spec 이 app 부팅 **전에** 그 env 를 세우면 **DI override 0 · 네트워크 0 · 결정적** 인 실 배선 왕복이 성립한다. 이는 provider 를 갈아끼우는 mock override 가 아니라 [`load-k6.yml`](../../.github/workflows/load-k6.yml) `93 행` 이 이미 쓰는 **프로덕션 배선 분기 자체** 이고, guard · ValidationPipe · Prisma · orchestrator · persist 는 전부 실물로 남는다. `LlmStubGateway` 는 `75~100 행` 에서 blank prompt/modelId 만 400 으로 거절하고 그 외에는 `[load-test-stub]` 접두 narrative 를 즉시 반환한다.

오너 게이트 미침범 실측 — PLAN [`157`](../PLAN.md)·[`158 행`](../PLAN.md)(신규 perf/load slice 금지): `test/perf/` · `test/load/` **무접촉**(위 k6 script 은 읽기 대조만). [`182 행`](../PLAN.md): 신설 helper **0** — 기존 [`auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) · [`db-truncate.ts`](../../test/helpers/db-truncate.ts) 만 재사용하고 절단면을 route 1 개 전량(happy + 영속 분기 + 400 매트릭스 + RBAC)으로 잡아 잔여 slice 를 남기지 않는다. [`183 행`](../PLAN.md): `docs/requirements.md` 무접촉 — REQ 재판정은 머지 후 필요 시 1 회로 이월.

## Required Reading

- [`src/assessment-evaluation/assessment-evaluation.controller.ts`](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `255~262 행`(route 머리 주석: 배선 순서 · reject raw 전파), `263~270 행`(decorator 4 종 + `@Body()`), `279~284 행`(`begin` 을 try 밖에 두는 이유), `285~309 행`(orchestrator → context 4-tuple → mode 정규화 → persist), `324~326 행`(`finally end`).
- [`src/assessment-evaluation/dto/evaluate-activities.dto.ts`](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — `49~107 행`(`ActivityItemDto` — `externalId` · `sourceType` · `instanceKey` · `author` · `timestamp` 5 필수 string + `metadata` `@IsObject` + optional 3), `112~140 행`(`EvaluateActivitiesDto` — `modelId` 필수 · `activities` `@IsArray` + `@ArrayMinSize(1)` + `@ValidateNested({each:true})` + `@Type` · `periodStart` `@IsISO8601` · `mode` `@IsIn(["fill","reeval"])`).
- [`src/assessment-evaluation/evaluation-result-persist.service.ts`](../../src/assessment-evaluation/evaluation-result-persist.service.ts) — `103~139 행`(persist 진입 · P2002→409 변환), `160~199 행`(fill no-op / reeval delete), `205~223 행`(`createAssessment` 의 nested create + `contributionCount` 산출), `258~272 행`(`assertValidAggregate` 의 평문 `Error`).
- [`src/assessment-evaluation/evaluation-orchestrator.service.ts`](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `139~177 행` + [`evaluation-scoring.service.ts`](../../src/assessment-evaluation/evaluation-scoring.service.ts) `90~117 행` — 정규화 → dedup → 단위별 `scoreUnit`(gateway 1 회) → 후처리. `unitId` 는 입력에서 그대로 전사된다.
- [`src/assessment-evaluation/assessment-evaluation.module.ts`](../../src/assessment-evaluation/assessment-evaluation.module.ts) `165~181 행` + [`src/common/load-test-stub-gating.ts`](../../src/common/load-test-stub-gating.ts) `21~44 행` + [`src/llm/llm-stub-gateway.service.ts`](../../src/llm/llm-stub-gateway.service.ts) `42~104 행` — `LOAD_TEST_STUB` 가 **정확히 `"1"`** 일 때만 stub, 판정은 module 초기화 1 회(= app 생성 전에 env 를 세워야 한다), narrative 접두 상수.
- [`prisma/schema.prisma`](../../prisma/schema.prisma) `294~317 행` — `Assessment` 의 `personId` FK(`onDelete: Cascade`) + `@@unique([personId, period, scope, periodStart])`. Person row 가 없으면 FK 위반이므로 happy-path 는 Person 을 먼저 seed 해야 한다.
- [`src/run-status/run-status.controller.ts`](../../src/run-status/run-status.controller.ts) `44~56 행` — snapshot 형태와 `@Roles("User")` tier(어떤 actor 로도 조회 가능).
- [`test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts`](../../test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts) — 같은 controller 의 직전 e2e(T-1981): 다중 actor · `buildAuthCookie` · guard `it.each` · RunStatus 짝 단언 패턴 참고본(이 파일은 수정 0).
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `132~181 행`(`createAuthenticatedE2EApp`) · `182 행` 이하(`reseedAuthenticatedActors`) — `afterEach` 의 `truncateAll` 이 actor User 를 지우므로 원 `id`/`email`/`role` 재 seed 순서를 기존 e2e 와 동일하게 유지할 것.

## Acceptance Criteria

신규 파일 **[`test/e2e/assessment-evaluation-evaluate.e2e-spec.ts`](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts) 1 개만** 추가하고 아래를 모두 만족한다.

- [ ] **stub 배선 전제** — `beforeAll` 에서 app 부팅 **이전에** `process.env.LOAD_TEST_STUB = "1"` 을 세우고, `afterAll` 에서 원래 값(부재였으면 `delete`)으로 **복원**한다. DI override(`overrideProvider` / `overrideGuard`) 는 **0** 이어야 한다. 파일 머리 주석 3~6 줄로 "왜 mock override 가 아니라 프로덕션 env 분기인가"(ADR-0057 `D1`)를 남긴다.
- [ ] **happy-path (R-112 (1))** — Person 1 건 seed 후 Admin actor 로 유효 body(activities 2 건)를 보내면 **200**(201 아님)이고 본문이 `assessmentId`(비어 있지 않은 string) · `contributionCount` **2** · `results` 길이 2 를 만족한다. 실 DB 에서 `prisma.assessment.count()` **1** · `prisma.contribution.count()` **2** 이고, Assessment row 의 `personId` · `period` · `scope` 가 요청 좌표와 일치함을 재조회로 단언한다. `results[0].narrative` 가 `[load-test-stub]` 로 시작함을 단언해 **실 LLM 왕복 0** 을 증거로 남긴다.
- [ ] **분기 (R-112 (3)) — fill idempotency** — 같은 좌표로 `mode: "fill"`(또는 미지정 = 기본 fill) 재호출 시 200 + `assessmentId` 가 1 회차와 **동일** + `contributionCount` **0** 이고, Assessment count 1 · Contribution count 2 가 **불변**임을 단언한다.
- [ ] **분기 (R-112 (3)) — reeval 교체** — 같은 좌표로 `mode: "reeval"` 재호출 시 200 + `assessmentId` 가 1 회차와 **다르고** `contributionCount` 가 다시 2 이며, Assessment count 는 여전히 **1**(중복 row 0) 이고 기존 Contribution 이 cascade 삭제 후 재생성돼 총 2 임을 단언한다.
- [ ] **error path (R-112 (2))** — 미허용 `scope`(DTO 형식은 통과, 예 `"bogus"`)로 호출하면 **500** 이고 본문에 내부 예외 메시지(`알 수 없는 scope`) · 스택 트레이스 · SQL 이 노출되지 않으며, Assessment row 가 **0 건** 그대로임(트랜잭션 진입 전 차단)을 단언한다.
- [ ] **negative (R-112 (4)) — 예외 분기마다 1+** — 아래를 각각 1 케이스 이상 cover 한다(400 계열은 `it.each` 로 묶되 케이스 라벨로 분기를 구분): (a) `activities: []` → 400(`@ArrayMinSize(1)`), (b) nested 항목의 필수 필드 누락(예 `externalId`) → 400(`@ValidateNested`), (c) 정의되지 않은 최상위 필드 추가 → 400(forbidNonWhitelisted), (d) `periodStart` 가 비-ISO 문자열 → 400(`@IsISO8601`), (e) `mode` 가 fill/reeval 외 → 400(`@IsIn`), (f) Cookie 미부착 → 401, (g) 변조/손상 토큰 → 401, (h) `User` role actor → 403. 400 계열 전부에서 Assessment count 가 **0** 으로 남고, 401/403 본문에 요청 body 나 도메인 데이터가 되비치지 않음도 단언한다.
- [ ] **과차단 0** — `SuperAdmin` actor 가 happy-path 와 동일하게 200 + row 1 건 생성을 받음을 단언(RolesGuard escalation).
- [ ] **RunStatus 짝 불변식(cross-controller)** — 400 케이스 1 건 직후 `GET /api/run-status` 가 `evaluation.active === false`(begin 미진입), happy 200 직후와 500 직후에도 `evaluation.active === false`(짝 없는 end 0 — `finally` 로 해소)임을 단언한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 본 task 는 `src/` 0 LOC 변경이라 전역 coverage 불변이어야 한다).
- [ ] `pnpm test:e2e` green — 신규 suite 1 개가 실행 목록에 포함되고 기존 e2e suite 는 하나도 깨지지 않는다(`afterEach` 의 `truncateAll` → `reseedAuthenticatedActors` 순서를 기존 e2e 와 동일하게 유지하고, `LOAD_TEST_STUB` 복원이 다른 suite 로 새지 않는지 확인).
- [ ] diff ≤ 300 LOC · 파일 1 개(CLAUDE.md §3 cap). 케이스별 주석은 1~2 줄로 제한한다.

## Out of Scope

- **실 LLM gateway 경유 검증** — 자격증명 0 · 비결정적이라 e2e 대상이 아니다. 본 spec 은 stub 배선으로만 왕복하며 `LlmHttpGateway` 는 건드리지 않는다. narrative **내용** 의 품질 단언도 하지 않는다(접두 상수 확인까지).
- **동시 요청 경합(P2002 → 409 · reeval P2025 → 409)** — 실 병렬 트랜잭션 유도는 결정성이 낮아 별도 slice(이미 unit 축이 존재). 본 spec 은 순차 왕복만 한다.
- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 — **test-only**. 구현 결함을 발견하면 고치지 말고 `Follow-ups` 에 적는다.
- 같은 controller 의 `period` · `summary` · `reset` · `relative-comparison` · `unevaluated-fill-*` 재검증(이미 e2e 보유) 및 [`test/e2e/run-status.e2e-spec.ts`](../../test/e2e/run-status.e2e-spec.ts) 수정(읽기 재사용만).
- `GET /api/admin/import/modes` · `running` e2e — T-1981 `§Why` 의 pre-check 대로 realdb perf-spec 이 이미 덮어 **중복이므로 만들지 않는다**(다시 이월하지 말 것).
- `test/perf/` · `test/load/` 접촉(PLAN `157`·`158 행`) 및 신규 test helper 신설(PLAN `182 행` — 기존 2 helper 재사용만).
- `docs/requirements.md` REQ status 재판정(PLAN `183 행` — 머지 후 1 회로 이월).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
