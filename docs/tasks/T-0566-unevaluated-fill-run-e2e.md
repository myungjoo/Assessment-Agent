---
id: T-0566
title: POST /unevaluated-fill-run 라우트 e2e 검증 추가 (RBAC + ValidationPipe + fail-fast + 빈-좌표 round-trip; live-LLM round-trip 은 수동 후속)
phase: P5
status: DONE
mergedAs: 30514d8
prNumber: 481
reviewRounds: 1
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - test/e2e/unevaluated-fill-run.e2e-spec.ts
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-22
plannerNote: P5 bullet 106(R-64/REQ-037·038) Q-0045 옵션1 run-side chain slice(3) e2e. T-0548 plan e2e mirror. live-LLM round-trip 은 LAN 수동 후속(cloud cron LAN 무경로)
---

# T-0566 — POST /unevaluated-fill-run 라우트 e2e 검증 추가

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가" / REQ-038) Q-0045 옵션1 run-side 사슬은 T-0556~T-0564 순수 조각 + @Injectable orchestrator 까지, 그리고 T-0565(merge 372a287, PR #480)가 `POST /api/assessment-evaluation/unevaluated-fill-run` controller route + `UnevaluatedFillRunRequestDto` 까지 배선해 닫혔다. 그러나 이 새 라우트는 **controller unit spec(orchestrator mock)만 있고 e2e 가 없다** — README 113행(R-113)은 unit 외에 e2e 도 CI 에서 수행할 것을 요구한다. plan-side 가 T-0548(`unevaluated-fill-plan.e2e-spec.ts`, merge c7f3583)로 e2e 를 닫은 것과 동형으로, run-side 의 새 HTTP 엔드포인트의 실 부팅 round-trip(인증 가드 + ValidationPipe + 라우트 마운트 + fail-fast 경로 + 빈-좌표 200)을 supertest 로 검증해 사슬을 닫는다.

**live-LLM 경계(load-bearing — 본 task 의 scope 결정 근거)**: 비어있지 않은 `rawBridges` 로 진짜 round-trip 을 하면 orchestrator 가 `PeriodBridgeAdminPersistService.generateAndPersist`(collect→filter→evaluate→persist)를 호출 → **실 LLM round-trip** 이 발생한다. 본 task 를 실행하는 cloud cron 은 LAN(192.168.0.5 Ollama, ADR-0045)에 무경로 → live-LLM 자율 수행 불가. 따라서 본 e2e 는 **LLM 에 도달하지 않는 모든 경로** 를 cover 한다: (1) RBAC 가드(401/403 — 가드는 handler 진입 전 동작), (2) ValidationPipe(400 — handler 진입 전), (3) fail-fast `TypeError` 경로(modelId 무효 시 core 가 좌표를 흘리기 전 throw — orchestrator.service.ts L134~142 + run-core), (4) **빈 `rawBridges` + 유효 modelId → 200 + 빈 outcomes 결과**(좌표 0 → orchestrator 가 좌표 순회 0 → `generateAndPersist` 호출 0 → LLM 0 인 진짜 round-trip). **비어있지 않은 좌표의 live-LLM round-trip 1 회 검증은 본 task 의 Follow-ups + Out of Scope 에 수동/로컬(LAN) 후속으로 명시** — cloud cron 에서는 미수행, 빌드/CI 영향 0.

기존 `unevaluated-fill-plan.e2e-spec.ts`(T-0548) + `period-bridge-admin-persist.e2e-spec.ts` 의 실 DB·no-network·`createAuthenticatedE2EApp`·`afterEach(truncateAll)` 패턴을 1:1 mirror 한다. production code(`src/`) 변경 0 — e2e spec 1 파일 추가만.

## Required Reading

- `test/e2e/unevaluated-fill-plan.e2e-spec.ts`(전체) — 본 task 의 1:1 mirror 대상. plan-side 라우트 e2e 의 `createAuthenticatedE2EApp` 부트스트랩 + Admin/User token + 401/403/400 negative + `messageText` helper + `afterEach(truncateAll)` + `afterAll(close+$disconnect)` 패턴. 본 task 는 이 구조를 run-side route 로 mirror 하되 happy-path 는 빈-좌표 200(LLM 무도달)로 한다.
- `src/assessment-evaluation/assessment-evaluation.controller.ts`(`runUnevaluatedFill` 라우트 메서드 — grep `unevaluated-fill-run` 으로 위치 확인) — RBAC `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@HttpCode(200)` + `@Body() dto: UnevaluatedFillRunRequestDto` → `orchestrator.run(dto.rawBridges, dto.modelId, dto.defaultModelId)` 위임. e2e 가 검증할 라우트 path 와 status code 근거.
- `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts`(전체) — 3 필드 검증(`rawBridges: PeriodBridgeDto[]` `@ValidateNested({each:true})` `@Type` / `modelId?` `@IsOptional @IsString @IsNotEmpty` / `defaultModelId` `@IsString @IsNotEmpty`). e2e 의 400 negative(필수 누락·non-array·nested 위반·빈 defaultModelId) 입력 설계 근거.
- `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts`(L107~143 `run` 메서드 + L36~48 경계 주석) — 빈 rawBridges → 좌표 순회 0 → `generateAndPersist` 호출 0(LLM 무도달) → 빈 `UnevaluatedFillRunResult` 반환 근거. modelId 무효 시 core 의 fail-fast `TypeError` 전파(handler 가 흡수 0) → HTTP status 근거(아래 Acceptance 의 fail-fast 항목에서 실제 status 를 spec 으로 확정).
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts`(L83~102) — 응답 shape `{ outcomes: [...], evaluatedCount, skippedCount, failedCount, totalCount }`(plain JSON-safe). 빈-좌표 200 응답이 `outcomes: []` + 4 count 0 인지 assert 근거.
- `src/assessment-evaluation/dto/period-bridge.dto.ts`(전체) — nested 검증 대상. 400 negative 의 nested PeriodBridgeDto 위반 입력 설계 근거.
- `test/helpers/auth-e2e-helper.ts`(`createAuthenticatedE2EApp`, `buildAuthCookie`, `SeedUserRole`) — Admin/User token 발급 + cookie 헤더 헬퍼.
- `test/helpers/db-truncate.ts`(`truncateAll`) — afterEach 격리.

## Acceptance Criteria

새 e2e spec `test/e2e/unevaluated-fill-run.e2e-spec.ts` 1 파일을 추가한다. 라우트 path 는 `/api/assessment-evaluation/unevaluated-fill-run`. 기존 e2e 패턴(`createAuthenticatedE2EApp` + 실 PostgreSQL + `afterEach(truncateAll)` + `afterAll(close+$disconnect)`)을 T-0548 mirror 로 1:1 따른다. **본 spec 의 모든 케이스는 LLM 에 도달하지 않는다** — 비어있지 않은 좌표로 `generateAndPersist`(LLM)를 호출하는 케이스는 작성하지 않는다(live-LLM 수동 후속). production code(`src/`) 변경 0.

- [ ] **Happy-path round-trip(빈 좌표, LLM 무도달)** — Admin 토큰 + 유효 body `{ rawBridges: [], modelId: "<some>", defaultModelId: "<some>" }` POST → **200** + 응답 body 가 `{ outcomes: [], evaluatedCount: 0, skippedCount: 0, failedCount: 0, totalCount: 0 }`(또는 result 의 실제 4 count 축 — `unevaluated-fill-run-result.ts` 박제 필드명에 정합) shape 임을 assert. 좌표 0 → orchestrator 가 좌표 순회 0 → `generateAndPersist` 호출 0 → 실 LLM/네트워크 0 인 진짜 부팅 round-trip(라우트 마운트·DI·응답 직렬화 검증). 신규 라우트 public 동작(엔드포인트 마운트 + 200 status + 응답 shape)의 happy-path 1+.
- [ ] **Error path / RBAC negative cases 충분 cover** — 단일 negative 금지, 예외 분기마다 1+ test:
  - 인증 부재(쿠키 없음) → **401**.
  - User tier(비-Admin) 토큰 → **403**.
  - ValidationPipe **400**: (a) `defaultModelId` 누락, (b) `rawBridges` 누락 또는 non-array, (c) `modelId` 빈 문자열(`@IsNotEmpty` 위반), (d) nested `PeriodBridgeDto` 필수 축 위반(`@ValidateNested` 동작 검증 — 형식상 잘못된 1 원소 배열) — 각 1+ test. `messageText` 헬퍼(T-0548 mirror)로 message string/string[] 양형 흡수.
- [ ] **Flow / branch coverage(fail-fast 경로 — LLM 무도달)** — `rawBridges` 는 형식 유효(빈 배열)이되 modelId 조합이 무효라 core 가 좌표를 흘리기 전 `TypeError` fail-fast 하는 경로 1+ test: 예 `{ rawBridges: [], modelId: undefined, defaultModelId: " " }`(둘 다 무효)가 ValidationPipe 를 통과한 뒤(빈 문자열이 아닌 whitespace 가 `@IsNotEmpty` 통과하면 — 통과 여부를 spec 으로 확정) orchestrator→core 의 한국어 `TypeError` 전파로 이어지는지. **실제 반환 HTTP status(NestJS 기본 unhandled → 500, 또는 ValidationPipe 가 먼저 400 으로 막으면 400)를 spec 으로 관측해 확정**하고 그 status 를 assert(추측 금지 — `pnpm test:e2e` 실행 결과로 fix). 만약 모든 무효 modelId 조합이 ValidationPipe 400 에서 먼저 막혀 core fail-fast 가 e2e 로 도달 불가하면, 그 사실을 spec 주석으로 명시하고 본 항목을 "ValidationPipe 가 modelId 무효를 선제 차단 — core fail-fast 는 controller unit spec(T-0565) cover" 로 대체(분기 부재 명시).
- [ ] **negative — thin delegate 비변형 / 빈-좌표 결정성**: 빈 `rawBridges` → silent 비정상 진행이 아니라 명시적 빈 결과(200 + 빈 outcomes)임을 assert(도메인 빈 run 결정성 — T-0548 의 빈 personIds → 빈 plan 정책 동형). 응답이 envelope 없이 result shape 그대로(가공 0)임을 assert.
- [ ] **R-113 e2e step 통과**: `pnpm test:e2e` 가 새 spec 를 포함해 green(로컬 DATABASE_URL 부재 시 CI 전용 step). 추가로 `pnpm lint && pnpm build` clean. `pnpm test:cov`(unit)는 신규 production symbol 0 이므로 기존대로 통과(coverage 영향 0 — e2e 는 cov 집계 대상 아님).
- [ ] **분기 / coverage 항목 주석**: 본 task 는 e2e spec 추가이며 production code 변경 0 — `coverageThreshold`(line/function ≥ 80%)는 unit `pnpm test:cov` 가 기존대로 통과(신규 production symbol 0). e2e 내부 helper 는 단순 assertion 이라 별도 분기 test 불요 — "production code 0 / coverage 영향 0" spec 상단 주석에 명시.

## Out of Scope

- **production code(`src/`) 변경 일체** — 라우트/DTO/orchestrator/core 는 모두 T-0556~T-0565 로 머지됨. e2e spec 1 파일 추가만. 라우트 동작 수정이 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **live-LLM round-trip 검증(비어있지 않은 좌표)** — 비어있지 않은 `rawBridges` 로 `generateAndPersist`(collect→evaluate→persist)를 실제 호출하는 e2e 는 실 LLM round-trip 을 요구한다(LAN=AKIHA 192.168.0.5 Ollama, ADR-0045 수동, 만료 2026-06-30). 본 task 를 실행하는 cloud cron 은 LAN 무경로라 자율 수행 불가 → **수동/로컬(LAN) 후속**(Follow-ups 참조). 본 e2e 는 LLM 무도달 경로만.
- **provider override(`overrideProvider`)로 persist/LLM 을 fake 로 치환한 비어있지-않은 좌표 round-trip** — `createE2EApp`(test/helpers/e2e-app-factory.ts)는 override 훅이 없다. override 인프라 신설은 본 task 의 cap·dep 표면을 넘는 별도 후속(helper 변경 = pr-mode 별도 task). 본 task 는 기존 `createAuthenticatedE2EApp` 만 사용.
- **다른 라우트(`evaluate` / `period` / `unevaluated-fill-plan`)의 e2e** — 본 task 는 `unevaluated-fill-run` 라우트 1 개에 집중. plan 라우트 e2e 는 T-0548 가 이미 닫음.
- **LLM config source 배선(`defaultModelId` 의 env / `LlmProviderConfig` table source)** — 본 e2e 는 `defaultModelId` 를 request body 로 받는 현 동작을 검증만. config source 자동 주입 layer 는 별도 후속 slice(ADR 후보).
- **RBAC 정책 상향/하향** — Admin+ 는 라우트가 이미 박제한 정책. e2e 는 그 정책(401/403)을 검증만, self-only personId 동등성 등 권한 모델 변경 0.
- **응답 정렬/필터/pagination / envelope** — 라우트가 result shape 을 그대로 전파하므로 e2e 는 그 shape 을 assert 만.
- **standing 게이트** — export download(Q-0042/Q-0043), import upload(게이트3 미승인), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester` (e2e spec 작성 + `pnpm test:e2e`/lint/build 실행 확인. fail-fast 항목의 실제 HTTP status 는 `pnpm test:e2e` 관측 결과로 확정 — 추측 금지).

## Follow-ups

- **수동/로컬(LAN) live-LLM round-trip 1 회 검증** — AKIHA LAN(192.168.0.5 Ollama, ADR-0045 만료 2026-06-30) 접속 가능한 로컬 환경에서, 비어있지 않은 `rawBridges`(영속 Assessment 0 인 person 의 미평가 좌표 1+) + 유효 modelId 로 `POST /unevaluated-fill-run` 1 회 실행 → 200 + outcomes 가 evaluated/skipped/failed 로 채워지는지 + 영속 Assessment row 가 생성되는지 수동 확인. cloud cron 미수행(LAN 무경로). 결과는 별도 journal/note 박제.
