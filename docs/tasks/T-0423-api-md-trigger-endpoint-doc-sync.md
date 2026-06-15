---
id: T-0423
title: api.md 에 POST /api/schedules/trigger manual trigger endpoint doc-sync
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-040]
dependsOn: [T-0417]
independentStream: p7-scheduling-docsync
touchesFiles: [docs/architecture/api.md]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-06-16
plannerNote: P7 ④/⑤ slice 4 잔여 — T-0417 이 shipped 한 POST /api/schedules/trigger 를 api.md §5 cron 주기 관리 그룹 + 합계 줄에 doc-sync (direct doc-only, T-0422 동형)
---

# T-0423 — api.md 에 POST /api/schedules/trigger manual trigger endpoint doc-sync

## Why

T-0417 (PR #336, squash 62edc3b merged) 이 `CronScheduleController` 위에 `POST /api/schedules/trigger` (Admin 이 cron 주기와 무관하게 즉시 1회 평가를 manual 하게 trigger 하는 REST endpoint, R-73 / REQ-040) 를 shipped 했다. 그러나 `docs/architecture/api.md` §5 endpoint 표의 `cron 주기 관리 (/api/schedules)` 그룹 (L134~138) 에는 아직 이 endpoint 가 없어 **doc 과 reality 가 어긋난다** — 현재 그 그룹에는 cron 주기 관리 3 endpoint (GET/PUT/DELETE) + backfill POST 1 (T-0421) 만 박제돼 있고 manual trigger endpoint 는 누락 상태다. api.md §5 표는 endpoint source-of-truth 이며 ("endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상", L140). 본 task 는 T-0417 의 Out of Scope (L55) 로 명시 defer 됐던 slice 4 잔여 doc-sync 이며 T-0422 의 Follow-up 으로 명시된 항목이다. 게이트 (순환·schema·architect) 없는 direct doc-only 라 즉시 처리 가능하다 (backlogNote slice 4 잔여 우선순위 1).

## Required Reading

- `docs/architecture/api.md` — §5 endpoint 표의 `cron 주기 관리 (/api/schedules)` 그룹 (L134~138: 그룹 헤더 + GET/PUT/DELETE/backfill POST 4행) — 본 task 는 이 그룹 안에 trigger 행 1개를 추가 (DELETE 행 다음 또는 backfill POST 행 다음, 그룹 내 위치는 가독성 우선 — cron 관리 3행 → trigger → backfill 순 또는 기존 순서 유지 후 append 둘 다 허용). 인접 행의 description / auth tier 컬럼 톤 (T-NNNN 박제 + PR 번호 + RBAC + status code 표기) 참조. 그리고 §5 말미 `**합계**` 줄 (L140) 의 endpoint 수 / prefix 수 박제 패턴.
- `docs/tasks/T-0417-manual-trigger-endpoint.md` — 본 endpoint 의 실 계약 (Acceptance Criteria L39~44): `POST /api/schedules/trigger`, 요청 body 없음 (fire-and-forget, DTO 불요), 주입된 `CRON_TICK_HANDLER` (tickHandler) 를 즉시 1회 호출 (Promise 반환 시 await), `202 Accepted` (`@HttpCode(202)`), handler throw/reject 시 raw propagate (500 표면화), Admin+ RBAC (`JwtAuthGuard`+`RolesGuard`+`@Roles("Admin")`).
- `src/scheduling/cron-schedule.controller.ts` — shipped 된 실 구현 확인 (`@Controller("api/schedules")` 의 `CronScheduleController`, `@Post("trigger")`, `@HttpCode(202)`, Admin+ guard stack). description 작성 시 사실 정합 검증용.
- `docs/tasks/T-0422-api-md-backfill-endpoint-doc-sync.md` — 직전 동형 api.md doc-sync 패턴 (같은 `/api/schedules` 그룹에 backfill POST 행을 추가했던 task). description 톤 / 합계 줄 갱신 방식 mirror 참조.

## Result

DONE (2026-06-15T18:05Z, cron@local-aa15-71aba8). api.md §5 cron 주기 관리 (/api/schedules) 그룹 backfill 행 다음에 `POST /api/schedules/trigger` 행 1개 추가 (UC-01, Admin+, R-73/REQ-040, T-0417/PR #336 박제) + §5 합계 줄 endpoint 약 54→55 (prefix 14 불변 — 같은 `/api/schedules` prefix 내 추가). 단일 파일 docs/architecture/api.md +2/-1, 코드/테스트 0. 실 계약은 src/scheduling/cron-schedule.controller.ts (`@Post("trigger")`, `@HttpCode(202)`, `await this.tickHandler()`, Admin+ guard stack) 와 사실 정합 확인. slice 4 doc-sync 완결 (trigger + backfill 모두 api.md §5 박제 완료).

## Acceptance Criteria

- [x] §5 endpoint 표의 `cron 주기 관리 (/api/schedules)` 그룹 (현 L134~138) 안에 `POST` `/api/schedules/trigger` 행 1개 추가:
  - method `POST`, path `/api/schedules/trigger`, UC 컬럼 `[UC-01](../use-cases/UC-01-evaluation-execution.md)`.
  - description (≤1~2줄, 인접 행 톤 일치): Admin 이 cron 주기와 무관하게 즉시 1회 평가를 manual 하게 trigger (R-73 / REQ-040) — 주입된 `CRON_TICK_HANDLER` (tickHandler) 를 즉시 1회 호출 (Promise 반환 시 await) → `202 Accepted` (body 없음, fire-and-forget). handler throw/reject 시 raw forward (500 표면화). cron tick callback 과 동일 실행 추상 공유 ([ADR-0042 §Decision2](../decisions/ADR-0042-nestjs-schedule-adoption.md)). T-0417 박제 (PR #336) — RBAC enforced (Admin+ via `JwtAuthGuard`+`RolesGuard`, `@Roles("Admin")`). 요지 1~2줄로 압축.
  - auth tier 컬럼 `Admin+`.
- [x] §5 말미 `**합계**` 줄 (현 L140) 갱신 — `/api/schedules` prefix 의 endpoint 수가 +1 (trigger POST 1 추가) 임을 반영하는 1구절 append (기존 박제 톤 유지 — "T-0417 박제로 `/api/schedules/trigger` manual trigger endpoint 1 추가 (PR #336, 같은 `/api/schedules` prefix 내 추가라 prefix 14 불변)" 요지). headline 수치 약 54 → 약 55 endpoint 로 +1 (기존 표기 방식 그대로). prefix 수 (14) 는 동일 그룹 내 추가라 불변.
- [x] 변경은 `docs/architecture/api.md` 단일 파일에 국한 (코드/테스트 변경 0).
- [x] 추가 문구는 한국어 (§12), 식별자·path·status code·RBAC 토큰·enum 은 영어 유지.

## Out of Scope

- 코드/테스트 변경 (이미 T-0417 이 shipped — 본 task 는 doc-sync 만).
- backfill endpoint (`POST /api/schedules/backfill/:personId`) doc-sync — 이미 T-0422 가 처리 완료 (본 task 는 trigger endpoint 한 건만).
- slice 2 후속 a-2 (PersonService create hook 자동 배선) — module 순환 해소 architect/ADR 선행 게이트. 본 doc 에서 다루지 않음.
- slice 3 (backfill 1회 완료 영속화 표식 `Person.backfilledAt` 등) — schema 게이트 BLOCKED. 본 doc 에서 다루지 않음.
- §6 status code 표 / §4 prefix 표 구조 변경 (이미 T-0416 이 `/api/schedules` prefix 행을 §4 에 추가했으므로 §4 는 불변 — trigger 도 같은 prefix).
- manual trigger 의 대상 지정 (특정 personId / period / scope) — T-0417 Out of Scope 그대로, 현 trigger 는 전체 발화 1회. doc 에서 새 계약 추가 금지 (실 구현 그대로만 박제).
- 분기 없는 doc-only 변경 — R-112 test 항목 비적용 (commitMode direct, 코드 0 LOC).

## Suggested Sub-agents

direct doc-only 이므로 sub-agent 없이 driver 가 직접 Edit 처리 (planner → driver). 코드 변경 0 이라 implementer/tester 불요.

## Follow-ups

- (slice 4 doc-sync 완결) trigger + backfill endpoint 모두 api.md §5 박제 완료 후 — slice 4 잔여 없음. 다음 P7 stream 은 slice 2 후속 a-2 (PersonService hook, module 순환 architect 게이트) 또는 slice 3 (영속화 표식, schema 게이트) — 둘 다 게이트 해소 선행 필요.
