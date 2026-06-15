---
id: T-0416
title: api.md 에 /api/schedules cron 관리 endpoint 3종 doc-sync
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-039]
dependsOn: [T-0414, T-0415]
independentStream: p7-scheduling-docsync
touchesFiles: [docs/architecture/api.md]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-06-15
plannerNote: P7 ③ slice 2 follow-up #1b — T-0414/T-0415 가 shipped 한 /api/schedules 3 REST endpoint 를 api.md §4 prefix 표 + §5 endpoint 표에 doc-sync (direct doc-only)
---

# T-0416 — api.md 에 /api/schedules cron 관리 endpoint 3종 doc-sync

## Why

T-0414 (PR #334) 가 `CronScheduleController` 로 `/api/schedules` 의 3 REST endpoint (GET/PUT/DELETE) 를 shipped 했고 T-0415 (PR #335) 가 AppModule 에 `SchedulingModule` 을 import 해 런타임에 활성화했다 (REQ-039 / README R-72). 그러나 `docs/architecture/api.md` 의 endpoint 표 (§5) 에는 아직 `/api/schedules` 가 없고, 오히려 §7 의 line 171 은 "cron trigger path 는 HTTP endpoint 가 아닌 in-process `@Cron` handler" 라고 박제돼 있어 **doc 과 reality 가 어긋난다**. api.md 가 endpoint source-of-truth 이므로 (§5 표 말미 박제 — "endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상") shipped 된 cron 관리 surface 를 표에 반영해 정합을 회복한다. 본 task 는 T-0414 의 Out-of-Scope 로 defer 됐던 follow-up #1b (PLAN.md P7 ③ slice 2 backlog) 이다.

## Required Reading

- `docs/architecture/api.md` — §4 prefix 표 (L45~57), §5 endpoint 표 헤더 (L65~66) 와 인접 그룹 행 (예: L98~102 `/api/assessment-collection`, L113~120 `/api/llm`) 으로 description/auth tier 컬럼 작성 톤 참조, §7 line 171 의 in-process `@Cron` 단서, §5 말미 "합계" 줄 (L134)
- `src/scheduling/cron-schedule.controller.ts` — 실제 shipped 된 3 endpoint (GET `/api/schedules` list / PUT `/api/schedules` registerOrReplace / DELETE `/api/schedules/:name` remove), status code (200/200/204), RBAC (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`), 400/404 raw forward 분기
- `src/scheduling/dto/upsert-cron-schedule.dto.ts` — PUT body `UpsertCronScheduleDto` { `name`(string, `@IsNotEmpty`/`@MaxLength(255)`), `cronExpression`(string, `@IsNotEmpty`/`@MaxLength(255)`) }, 잘못된 cron 식/빈 name 은 service 가 400 변환
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` — §Decision 2 동적 registry 경로 + §Consequences (영속화/timezone defer) — description 에 인용할 ADR 링크

## Acceptance Criteria

- [ ] §4 prefix 표 (L45~57) 에 `/api/schedules` 행 1개 추가 — 책임 module 은 SchedulingModule (modules.md 의 SchedulerModule 책임 영역), 책임 UC 는 UC-01, 비고에 "Admin 런타임 cron 주기 지정/조회/삭제 (REQ-039 / R-72), T-0414/T-0415 박제, ADR-0042 §Decision2 동적 registry" 요지 1줄.
- [ ] §5 endpoint 표 (L65 이후) 에 새 그룹 헤더 행 + 3 endpoint 행 추가:
  - 그룹 헤더 (예: `**cron 주기 관리 (/api/schedules) — T-0414/T-0415 박제 (ADR-0042)**`).
  - `GET` `/api/schedules` — 등록된 cron job 이름 배열 조회, 200 (빈 배열 정상), Admin+.
  - `PUT` `/api/schedules` — `UpsertCronScheduleDto` { name / cronExpression } 로 cron 주기 등록/교체 (registerOrReplace), 200, 잘못된 cron 식/빈 name → 400 (service 변환), Admin+.
  - `DELETE` `/api/schedules/:name` — 등록 cron job 삭제 (remove), 204, 부재 name → 404, Admin+.
  - 각 행 description 은 ≤1~2줄 압축 (인접 그룹 톤 일치), auth tier 컬럼은 `Admin+`.
- [ ] §7 line 171 의 "cron trigger path 는 HTTP endpoint 가 아닌 in-process `@Cron` handler" 단서를 정정 — in-process cron 발화 path 는 유지하되, **런타임 cron 주기 관리(등록/조회/삭제) HTTP surface `/api/schedules` 가 T-0414/T-0415 로 추가됐음**을 1줄로 보강 (기존 단서를 삭제하지 말고 보강).
- [ ] §5 말미 "합계" 줄 (L134) 의 endpoint 수 / prefix 수를 갱신 — `/api/schedules` prefix 1 추가 + endpoint 3 추가를 반영하는 1구절 append (기존 박제 톤 유지).
- [ ] 변경은 `docs/architecture/api.md` 단일 파일에 국한 (코드/테스트 변경 0).
- [ ] 추가/정정 문구는 한국어 (§12), 식별자·path·status code·enum 은 영어 유지.

## Out of Scope

- 코드/테스트 변경 (이미 T-0414/T-0415 가 shipped — 본 task 는 doc-sync 만).
- cron tick callback 의 실 평가 pipeline 결선 (④ manual trigger / ⑤ backfill 후속 task 의 책임 — api.md 에 별도 endpoint 로 박제 예정).
- 등록 cron job 영속화 / timezone(KST) 처리 문서화 — ADR-0042 §Consequences 별도 ADR defer (api.md 에서 다루지 않음).
- `/api/assessment-evaluation/period` 등 기존 endpoint 행 수정.
- §6 status code 표 / §4 외 다른 § 의 구조 변경.
- 분기 없는 doc-only 변경 — R-112 test 항목 비적용 (commitMode direct, 코드 0 LOC).

## Suggested Sub-agents

direct doc-only 이므로 sub-agent 없이 driver 가 직접 Edit 처리 (planner → driver). 코드 변경 0 이라 implementer/tester 불요.

## Follow-ups

(없음 — 생성 시점)

## Result (DONE 2026-06-15T11:08Z)

- direct doc-only commit fdeb3d6 (main fast-forward, PR/리뷰 없음 — commitMode direct).
- api.md §4 prefix 표 +1행 / §5 cron 주기 관리 그룹 +3 endpoint / §7 L171 단서 보강 / 합계 줄 prefix 13→14 (headline+chain). 코드·테스트 0 LOC.
- CI run 27542100921 (fdeb3d6, doc-only) in_progress → 다음 fire 재확인 (trivially green 예상).
