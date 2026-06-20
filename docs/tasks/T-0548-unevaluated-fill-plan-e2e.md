---
id: T-0548
title: POST /unevaluated-fill-plan 라우트 e2e 검증 추가
phase: P5
status: DONE
mergedAs: c7f3583
prNumber: 462
reviewRounds: 1
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - test/e2e/unevaluated-fill-plan.e2e-spec.ts
estimatedDiff: 250
estimatedFiles: 1
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) — T-0547 controller route 배선 후 R-113 e2e 닫기. POST /unevaluated-fill-plan 실 DB round-trip + RBAC negative. dependsOn 없음·test/e2e disjoint.
---

# T-0548 — POST /unevaluated-fill-plan 라우트 e2e 검증 추가

## Why

PLAN.md P5 bullet 106(R-64/REQ-037·REQ-038 "평가 없는 부분 일괄 평가")의 detection 사슬은 T-0536~T-0547 로 순수 helper → impure compose service → request/response mapper → controller route 까지 모두 박제·머지됐다. 마지막 머지(T-0547, squash 3a7e8e4)가 `POST /api/assessment-evaluation/unevaluated-fill-plan` 라우트를 배선했으나, 이 라우트는 **controller unit spec 만 있고 e2e 검증이 없다**. README 113행(R-113)은 unit 외에 e2e 도 CI 에서 수행할 것을 요구하므로, 새로 배선된 HTTP 엔드포인트의 실 round-trip(인증 + 실 PostgreSQL 좌표 read + 응답 shape) e2e 를 추가해 사슬을 닫는다. 기존 `period-bridge-admin-persist.e2e-spec.ts` 의 실 DB·no-network 패턴을 mirror 한다.

## Required Reading

- `docs/tasks/T-0547-unevaluated-fill-plan-controller-route.md` (라우트 배선 직전 task — RBAC/DTO/mapper 배선 의도)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` L428~471 (POST unevaluated-fill-plan 라우트 — RBAC `@Roles("Admin")`, `@HttpCode(200)`, DTO→mapper→planner→response 배선)
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` (5축 입력 검증: personIds/period/scope/rangeStart/rangeEnd)
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` (응답 shape: `{ batches: [{ personId, periods: [{ periodStart ISO string, ... }] }], totalGapCount, personCount }`)
- `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts` (planner 위임 — `reader.readForPersons` → `findByPerson` 실 DB read, LLM/네트워크 0)
- `test/e2e/period-bridge-admin-persist.e2e-spec.ts` (mirror 대상 — 실 DB·createAuthenticatedE2EApp·truncateAll·RBAC negative 패턴)
- `test/helpers/auth-e2e-helper.ts` (`createAuthenticatedE2EApp`, `buildAuthCookie`)
- `test/helpers/db-truncate.ts` (`truncateAll`)

## Acceptance Criteria

새 e2e spec `test/e2e/unevaluated-fill-plan.e2e-spec.ts` 1 파일을 추가한다. 라우트 path 는 `/api/assessment-evaluation/unevaluated-fill-plan`. 기존 e2e 패턴(`createAuthenticatedE2EApp` + 실 PostgreSQL + `afterEach(truncateAll)` + `afterAll(close+$disconnect)`)을 1:1 mirror 한다. 네트워크/LLM 호출 0 — 라우트는 planner 의 `reader.readForPersons`(영속 좌표 read)만 수행하므로 별도 mock override 불필요(실 DB read).

- [ ] **Happy-path (round-trip)**: Admin 토큰으로 유효한 5축 body(personIds + period + scope + rangeStart + rangeEnd, KST ISO-8601)를 POST → 200 + 응답 body 가 `{ batches, totalGapCount, personCount }` shape 을 갖는지 assert. 영속 Assessment row 0 인 person 에 대해 의도 좌표 전부가 미평가 gap 으로 잡혀 `totalGapCount > 0` + `periods[].periodStart` 가 ISO-8601 string(`Z` 또는 명시 offset)인지 검증.
- [ ] **Flow / branch (gap 차집합 분기)**: 같은 person 에 대해 의도 범위 중 일부 좌표에 해당하는 Assessment row 를 미리 seed(prisma create) 한 뒤 POST → 해당 좌표는 gap 에서 제외되고 `totalGapCount` 가 seed 만큼 줄어드는지 assert. (intended ∖ persisted 차집합 분기 cover.) seed 시 actor User FK 재시드 주의 — `test/helpers/db-truncate.ts` 의 truncate 가 actor 를 지우므로 Assessment 가 참조하는 personId 가 유효한 User 인지 확인.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 1+ test:
  - 인증 부재(쿠키 없음) → 401.
  - User/비-Admin tier 토큰 → 403.
  - 잘못된 body(필수 축 누락 / wrong-type / 비-ISO rangeStart) → 400 (ValidationPipe).
  - 빈 personIds → 200 + `batches: []` + `totalGapCount: 0` (도메인 빈 plan 결정성 — DTO 가 `@ArrayNotEmpty` 미적용임을 T-0544 가 박제했으므로 400 아님).
- [ ] **R-113 e2e step 통과**: `pnpm test:e2e` 가 새 spec 를 포함해 green (로컬 DATABASE_URL 부재 시 CI 전용 step). 추가로 `pnpm lint && pnpm build` clean.
- [ ] **분기 없음 항목 주석**: 본 task 는 e2e spec 추가이며 production code 변경 0 — `coverageThreshold`(line/function ≥ 80%) 는 unit `pnpm test:cov` 가 기존대로 통과해야 하나, 신규 production symbol 0 이므로 coverage 영향 없음. e2e 는 cov 집계 대상 아님(별 step). spec 내부 helper 분기는 단순 assertion 이라 별도 분기 test 불요 — "분기 없음" 명시.

## Out of Scope

- production code(`src/`) 변경 일체 — 라우트/DTO/mapper/planner 는 이미 머지됨. e2e spec 추가만.
- POST /period 같은 다른 라우트의 e2e — 본 task 는 unevaluated-fill-plan 라우트 1개에 집중.
- live-LLM / 실 네트워크 round-trip — 본 라우트는 LLM 호출 0(영속 좌표 read 만). LLM bridge 검증은 standing 게이트(ADR-0037 §Decision5, LAN 수동만).
- reeval/overwrite 경로(ADR-0033 reeval) — bullet 107 DEFERRED.
- timezone ADR 박제(bullet 109) — 본 spec 은 기존 KST helper(parseKstPeriodInput/formatKstIso)가 박제한 동작을 검증만, 새 ADR 결정 0.
- 응답 정렬/필터/pagination — 라우트가 planner 결정성을 그대로 전파하므로 e2e 는 그 순서를 assert 만.

## Suggested Sub-agents

`implementer → tester` (e2e spec 작성 + `pnpm test:e2e`/lint/build 실행 확인).

## Follow-ups

(없음 — 생성 시점)
