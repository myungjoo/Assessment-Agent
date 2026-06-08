---
id: T-0294
title: api.md POST /api/assessment-evaluation/evaluate endpoint doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-009, REQ-040]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-09
plannerNote: "P5 평가 controller(T-0293) HTTP endpoint api.md 박제 0건 — T-0276 collection-trigger doc-sync 패턴 mirror, direct doc-only inline-amend, modules.md/ADR-0032 status는 별도 task"
---

# T-0294 — api.md POST /api/assessment-evaluation/evaluate endpoint doc-sync

## Why

T-0293 (PR-245 squash merge 2ecbc64) 가 P5 평가 controller `POST /api/assessment-evaluation/evaluate` 를 main 에 박제했다 — `AssessmentEvaluationController` 가 `EvaluateActivitiesDto` 를 받아 `EvaluationOrchestratorService.evaluateActivities` 로 위임하고 `EvaluationResult[]` 를 반환한다 (Admin+ RBAC, `JwtAuthGuard` + `RolesGuard`, ValidationPipe). 그러나 [docs/architecture/api.md](../architecture/api.md) 의 endpoint 표에는 `assessment-evaluation` prefix 의 row 가 **0건** 이라 reality 와 어긋난다 (`git grep "assessment-evaluation" docs/architecture/api.md` = 0). 본 task 는 T-0276 의 collection manual-trigger doc-sync 패턴을 mirror 해 **`POST /api/assessment-evaluation/evaluate` row 1 줄 + section header 1 줄** 을 api.md 에 박제하는 doc-only 정합이다. 순수 문서 정합이라 direct (CLAUDE.md §3.1). modules.md 의 `AssessmentEvaluationModule` 박제 누락 (현재 `AssessmentModule` 단일 row 가 stale 하게 P5 책임을 가리킴) + ADR-0032 PROPOSED→ACCEPTED status flip 은 별도 task 로 분리 (본 task 와 합치면 5 파일 초과 risk + concern 혼합).

## Required Reading

- `docs/architecture/api.md` line 89~99 (`/api/assessments` 표 + 그 아래 `**수집 manual trigger ...** | | | | |` section header line 98 + `POST /api/assessment-collection/collect` row line 99 — 본 task 가 mirror 할 패턴 직접 예시)
- `docs/architecture/api.md` line 100~109 (`/api/contributions` / `/api/summaries` 인접 section header + row 패턴 — 신규 section header 위치 결정용 reference)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (머지된 controller — `@Controller("api/assessment-evaluation")` + `POST evaluate` 200 + `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true})` — doc 표기 reality source)
- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` (request body shape — `EvaluateActivitiesDto { activities: ActivityItemDto[] }` + `@ArrayMinSize(1)` + nested `@ValidateNested({ each: true })` + `@Type(() => ActivityItemDto)` + `ActivityItemDto` 의 sourceType / kind / externalId / instanceKey / author / timestamp / metadata 필드 — doc 표기 reality source)
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` line 30~60 (`evaluateActivities(activities: Activity[]): Promise<EvaluationResult[]>` — response shape 표기 reality source)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult { unitId, narrative, difficulty, contribution, volume }` 5필드 — response body element shape)
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` §3 (output `EvaluationResult` 계약) + §2 (평가 단위 1 건당 `LlmGateway.generate` 1 회 + difficulty routing)
- `docs/tasks/T-0276-collection-manual-trigger-doc-sync.md` (직전 패턴 reference — 본 task 의 정합 형태와 동일 doc-only direct)

## Acceptance Criteria

doc-only task — R-110 (코드 검토) / R-112 (test 작성) 은 코드 변경 0 이므로 무관 (CLAUDE.md §3.2 direct doc-only 면제). 검증은 파일 inspection 으로 한다.

- [ ] `docs/architecture/api.md` 의 `/api/contributions` section header (line 100) 위에 새 section header 1 줄 추가 — 패턴: `| **평가 manual trigger (\`/api/assessment-evaluation\`) — T-0293 박제 ([ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md))** | | | | |`. (collection section header line 98 패턴 정확 mirror)
- [ ] 위 section header 바로 아래 `POST /api/assessment-evaluation/evaluate` endpoint row 1 줄 추가 — 5-col 패턴 `METHOD | path | UC | description | auth tier`. description 에 ADR-0032 §2/§3 계약 박제:
  - request body `EvaluateActivitiesDto { activities: ActivityItemDto[] }`, `@ArrayMinSize(1)` (빈 배열 400), nested `ActivityItemDto` validation
  - response 200 `EvaluationResult[]` (각 원소 `{ unitId, narrative, difficulty, contribution, volume }` 5필드 — ADR-0032 §3)
  - 처리 흐름: `EvaluationOrchestratorService.evaluateActivities` → `Activity → EvaluationInput` 매퍼 → 평가-side dedup(R-21 시간적 + R-30 self-follow-up 제외) → `EvaluationScoringService.scoreUnit`(LLM generate + classifyNarrative + deterministic volume) → `EvaluationResult[]`
  - error: 400 (DTO 위반 — `whitelist: true, forbidNonWhitelisted: true, transform: true`, ValidationPipe), 401 (cookie 부재 / 토큰 invalid), 403 (User role)
  - 박제 task 링크: **T-0287 / T-0288 / T-0289 / T-0290 / T-0291 / T-0292 / T-0293 박제 ([ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md)) — RBAC enforced (Admin+ via JwtAuthGuard+RolesGuard, @Roles("Admin")).** live LLM 실호출 (실 endpoint/API key)은 §5 credential 게이트 deferred (별도 후속 task).
  - tier=Admin+. 책임 UC=[UC-01](../use-cases/UC-01-evaluation-execution.md) (평가 실행 main flow)
- [ ] UC-01 cross-reference 표 (line 159 부근 `[UC-01](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram) | manual trigger 의 alt block ...` row) 점검 — 신규 endpoint 가 UC-01 의 evaluation 단계를 cover 하므로 해당 row 의 `POST /api/assessments/run` 옆에 `POST /api/assessment-evaluation/evaluate` 도 박제할지 판단 후 정합. 변경 불요로 판단 시 task 본문 Follow-ups 에 근거 명시.
- [ ] 변경 diff 가 순수 문서 정합 범위 — `src/` · `test/` · `package.json` · `.github/workflows/` 미변경. cap ≤ 300 LOC / ≤ 5 파일 준수 (1 파일, 약 30 LOC).
- [ ] commit message subject prefix = `docs(architecture)` + 한국어 subject + (T-0294). trail blob `IMPLEMENTER` + `ACCEPTANCE` section 포함 (§11).

## Out of Scope

- `docs/architecture/modules.md` 의 `AssessmentEvaluationModule` 박제 — 현재 `AssessmentModule` row (line 39) 가 stale 하게 P5 책임을 단독으로 가리킨다. 신규 module 분리 표기 + Worker mapping (line 189) 갱신 + 머리말 chain 이력 append 가 필요해 별도 doc-sync task (T-0295 후보) 로 분리.
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` line 5 `status: PROPOSED` → `ACCEPTED` flip — ADR 본문 reality 정합 1 줄 수정이라 별도 direct task (T-0291 trail follow-up + T-0296 후보) 로 분리.
- ADR-0032 본문 (§1~§4 / Consequences / Alternatives / Follow-ups) 재작성 — 본 task 는 api.md 단독 정합.
- `src/` · `test/` 코드 변경 — 코드 chain (T-0287 ~ T-0293) 이미 머지 완료, 본 task 는 doc-only.
- live LLM 실호출 통합 (§5 credential 게이트), 일/주/월 aggregate 평가 batch prompting, 영속화 schema migration (§5 DB schema 게이트) — 전부 ADR-0032 Follow-ups deferred.

## Suggested Sub-agents

`implementer` 단독 — doc-only direct edit (1 파일 inline-amend, 약 30 LOC). architect/tester/reviewer 불요 (코드 변경 0, ADR 신설 아님, CLAUDE.md §3.1 direct 룰).

## Follow-ups

(본 task 머지 후 신규 doc-sync follow-up 의 출발점 — 본 task 자체에서 처리 금지)

- modules.md `AssessmentEvaluationModule` 박제 doc-sync (T-0295 후보) — controller 1 + 3 service (`EvaluationOrchestratorService` / `EvaluationScoringService` / 순수 함수 4 종은 service 아님) + dependencies (`LlmModule` import + `LLM_GATEWAY` useExisting) + Worker mapping (line 189) 의 P5 evaluation 측 module 갱신 + 머리말 chain 이력 append.
- ADR-0032 status PROPOSED → ACCEPTED flip (T-0296 후보) — line 5 한 줄 수정 + relatedTask 에 T-0287~T-0293 chain 추가 (T-0291 trail follow-up 박제).
- ADR-0032 Follow-ups 의 잔여 chain — issue comment thread 수집 확장 (필요 판정 시) / 평가 결과 영속화 schema (§5 DB schema 게이트) / live LLM run (§5 credential 게이트) — 전부 별도 task chain.
