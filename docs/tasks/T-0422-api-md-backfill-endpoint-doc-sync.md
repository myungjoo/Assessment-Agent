---
id: T-0422
title: api.md 에 POST /api/schedules/backfill/:personId manual backfill endpoint doc-sync
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-027]
dependsOn: [T-0421]
independentStream: p7-scheduling-docsync
touchesFiles: [docs/architecture/api.md]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-06-16
plannerNote: P7 ⑤ slice 4 — T-0421 이 shipped 한 POST /api/schedules/backfill/:personId 를 api.md §5 cron 주기 관리 그룹 + 합계 줄에 doc-sync (direct doc-only, T-0416 패턴)
---

# T-0422 — api.md 에 POST /api/schedules/backfill/:personId manual backfill endpoint doc-sync

## Why

T-0421 (PR #340, squash 005c84d merged) 이 `BackfillController` 로 `POST /api/schedules/backfill/:personId` (Admin 이 특정 인원의 1년치 평가를 manual 하게 1회 backfill 발화하는 REST endpoint, R-50 / REQ-027) 를 shipped 했다. 그러나 `docs/architecture/api.md` 의 endpoint 표 (§5) 에는 아직 이 endpoint 가 없어 **doc 과 reality 가 어긋난다** — api.md §5 표는 endpoint source-of-truth 이며 ("endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상", L139) 현재 `/api/schedules` 그룹 (L134~137) 에는 cron 주기 관리 3 endpoint (GET/PUT/DELETE) 만 박제돼 있고 backfill endpoint 는 누락 상태다. 본 task 는 T-0421 의 Out of Scope 로 명시 defer 됐던 slice 4 (backlogNote 우선순위 1) doc-sync 다. 게이트 (순환·schema·architect) 없는 direct doc-only 라 즉시 처리 가능하다.

## Required Reading

- `docs/architecture/api.md` — §5 endpoint 표의 `cron 주기 관리 (/api/schedules)` 그룹 (L134~137: 그룹 헤더 + GET/PUT/DELETE 3행) — 본 task 는 이 그룹의 DELETE 행 (L137) **다음**에 backfill 행 1개를 append. 인접 행의 description / auth tier 컬럼 톤 (T-NNNN 박제 + PR 번호 + RBAC + status code 표기) 참조. 그리고 §5 말미 `**합계**` 줄 (L139) 의 endpoint 수 / prefix 수 박제 패턴.
- `docs/tasks/T-0421-manual-backfill-endpoint.md` — 본 endpoint 의 실 계약 (Acceptance Criteria L43~49 + Result L68): `POST /api/schedules/backfill/:personId`, `:personId` path param, 요청 body 없음, `BackfillRunnerService.runBackfill(personId)` 1회 위임, `202 Accepted`, 반환 body `BackfillRunResult` (`{ personId, totalWindows, triggeredCount, skipped }`), Admin+ RBAC (`JwtAuthGuard`+`RolesGuard`+`@Roles("Admin")`), service-throw raw forward (Person 404 / P2002 409 / collect reject 전파).
- `src/scheduling/backfill.controller.ts` — shipped 된 실 구현 확인 (`@Controller("api/schedules")` 의 `BackfillController`, `@Post("backfill/:personId")`, `@HttpCode(202)`, Admin+ guard stack). description 작성 시 사실 정합 검증용.
- `docs/tasks/T-0416-api-md-schedules-doc-sync.md` — 직전 동형 api.md doc-sync 패턴 (cron 주기 관리 그룹을 추가했던 task). description 톤 / 합계 줄 갱신 방식 mirror 참조.

## Acceptance Criteria

- [ ] §5 endpoint 표의 `cron 주기 관리 (/api/schedules)` 그룹 (현 L134~137) 의 DELETE `/api/schedules/:name` 행 **다음**에 `POST` `/api/schedules/backfill/:personId` 행 1개 추가:
  - method `POST`, path `/api/schedules/backfill/:personId`, UC 컬럼 `[UC-01](../use-cases/UC-01-evaluation-execution.md)`.
  - description (≤1~2줄, 인접 행 톤 일치): Admin 이 path `:personId` 인원의 1년치 (52주, week/aggregate 기본값) 평가를 manual 하게 1회 backfill 발화 (R-50 / REQ-027). 주입된 `BackfillRunnerService.runBackfill(personId)` 1회 위임 → `202 Accepted` + `BackfillRunResult` (`{ personId, totalWindows, triggeredCount, skipped }`). 이미 backfill 된 기존 인원은 `skipped:true` (triggerCollection 0회) — T-0420 의 Assessment 존재 proxy idempotency. Person 부재 → 404 / 중복 → 409 / collect reject 등 service-throw raw forward. T-0421 박제 (PR #340) — RBAC enforced (Admin+ via `JwtAuthGuard`+`RolesGuard`, `@Roles("Admin")`). 요지 1~2줄로 압축.
  - auth tier 컬럼 `Admin+`.
- [ ] §5 말미 `**합계**` 줄 (현 L139) 갱신 — `/api/schedules` prefix 의 endpoint 수가 3 → 4 (backfill POST 1 추가) 임을 반영하는 1구절 append (기존 박제 톤 유지 — "T-0421 박제로 `/api/schedules/backfill/:personId` manual backfill endpoint 1 추가" 요지). 약 53 endpoint → 약 54 endpoint 로 headline 수치도 +1 (기존 표기 방식 그대로). prefix 수 (14) 는 동일 그룹 내 추가라 불변.
- [ ] (선택) §7 cross-reference 표 또는 §7 말미 단서에 backfill endpoint 를 1줄 보강해도 무방하나, 핵심은 §5 표 + 합계 줄. §7 보강은 톤 일치 시에만 (불필요한 구조 변경 금지).
- [ ] 변경은 `docs/architecture/api.md` 단일 파일에 국한 (코드/테스트 변경 0).
- [ ] 추가 문구는 한국어 (§12), 식별자·path·status code·RBAC 토큰·enum 은 영어 유지.

## Out of Scope

- 코드/테스트 변경 (이미 T-0421 이 shipped — 본 task 는 doc-sync 만).
- T-0417 의 `POST /api/schedules/trigger` (manual cron trigger endpoint) doc-sync — 별도 task 의 책임 (아직 api.md 미박제, 본 task 와 분리). 본 task 는 backfill endpoint 한 건만.
- slice 2 후속 a-2 (PersonService create hook 자동 배선) — module 순환 해소 architect/ADR 선행 게이트. 본 doc 에서 다루지 않음.
- slice 3 (backfill 1회 완료 영속화 표식 `Person.backfilledAt` 등) — schema 게이트 BLOCKED. 본 doc 의 idempotency 서술은 T-0420 의 "Assessment 존재 proxy" 그대로.
- `data-model.md` doc-sync — backfill 은 새 schema 0 (T-0420 proxy idempotency) 이라 data-model 변경 불요. 향후 slice 3 영속화 표식 도입 시 별도 task.
- §6 status code 표 / §4 prefix 표 구조 변경 (이미 T-0416 이 `/api/schedules` prefix 행을 §4 에 추가했으므로 §4 는 불변).
- 분기 없는 doc-only 변경 — R-112 test 항목 비적용 (commitMode direct, 코드 0 LOC).

## Suggested Sub-agents

direct doc-only 이므로 sub-agent 없이 driver 가 직접 Edit 처리 (planner → driver). 코드 변경 0 이라 implementer/tester 불요.

## Follow-ups

- (slice 4 잔여) T-0417 `/api/schedules/trigger` manual cron trigger endpoint api.md doc-sync (본 task 와 별개 — 다음 doc-sync fire 후보).

---

**Status: DONE** (2026-06-15T17:05Z, cron@local-aa15-43bc00bc). api.md §5 cron 주기 관리 그룹 DELETE 행 다음에 `POST /api/schedules/backfill/:personId` 행 1개 append + 합계 줄 53→54 endpoint 갱신 (prefix 14 불변, PR #340 박제). 단일 파일 +2/-1, direct doc-only main commit. 코드/테스트 변경 0.
