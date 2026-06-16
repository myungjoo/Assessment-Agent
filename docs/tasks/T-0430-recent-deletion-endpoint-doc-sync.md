---
id: T-0430
title: REQ-041 recent-deletion endpoint api.md 문서화 (slice 4 doc-sync)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-041]
dependsOn: [T-0428]
touchesFiles:
  - docs/architecture/api.md
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-16
independentStream: req-041-recent-deletion-docs
plannerNote: "P7 ⑤ REQ-041 slice 4 doc-sync — T-0428 머지된 POST /api/schedules/recent-deletion/:personId 를 api.md Endpoint 표에 박제. doc-only direct, 게이트 없음."
---

# T-0430 — REQ-041 recent-deletion endpoint api.md 문서화 (slice 4 doc-sync)

## Why

P7 ⑤ (R-74 / REQ-041 "최근 N일 결과 manual delete→재수집") 의 slice 2 후속 b 인 **POST `/api/schedules/recent-deletion/:personId`** REST endpoint 가 T-0428 로 머지(PR #346 squash 9704df1)됐으나, `docs/architecture/api.md` 의 Endpoint 표(§5)에는 아직 박제되지 않았다. backlogNote 가 명시한 ungated 후속(slice 4 doc-sync). 같은 prefix 의 backfill(T-0421)·trigger(T-0417) endpoint 가 이미 표에 박제된 것과 정합을 맞춘다. doc-only 라 schema/repository/module-cycle 게이트 없음.

## Required Reading

- `docs/architecture/api.md` §5 Endpoint 표 (138~141행 — backfill/trigger 행 + 합계 주석이 mirror 대상)
- `src/scheduling/recent-deletion.controller.ts` (endpoint 계약 — path, RBAC, 202, ValidationPipe, raw forward)
- `src/scheduling/dto/recent-deletion.dto.ts` (요청 본문 — `instants: string[]`(ISO, ArrayMaxSize), 선택 `days?: number`(IsInt/IsPositive))
- `src/scheduling/recent-deletion-runner.service.ts` (응답 shape `RecentDeletionRunResult` = `{ personId, deletedCount, recollected }`)

## Acceptance Criteria

- [ ] `docs/architecture/api.md` §5 Endpoint 표에 `POST | /api/schedules/recent-deletion/:personId` 행 1개 추가. 같은 `/api/schedules` prefix 의 backfill(138행)·trigger(139행) 행 서식을 mirror.
- [ ] 추가 행이 다음 계약을 담는다: (1) UC 링크 [UC-01](../use-cases/UC-01-evaluation-execution.md), (2) R-74 / REQ-041 참조, (3) 요청 본문 `RecentDeletionDto` (`instants` ISO string[] + 선택 `days`), (4) 위임 대상 `RecentDeletionRunnerService.runRecentDeletion(personId, instants, undefined, days)` 1회, (5) 202 Accepted + `RecentDeletionRunResult` (`{ personId, deletedCount, recollected }`), (6) deleter 미주입 시 삭제 0 (`deletedCount:0`) 기본, (7) service-throw raw forward (400/404/500), (8) T-0428 박제 (PR #346) — Admin+ RBAC (`JwtAuthGuard`+`RolesGuard`, `@Roles("Admin")`), (9) auth tier 열 `Admin+`.
- [ ] §5 말미 "합계" 주석(141행)에 T-0428 박제로 `/api/schedules/recent-deletion/:personId` endpoint 1 추가됨을 한 절 추가 (같은 `/api/schedules` prefix 내 추가라 prefix 14 불변임을 backfill/trigger 와 동형으로 명시).
- [ ] 추가 endpoint 수만큼 "약 55 endpoint" 합계 숫자를 정합 갱신 (55 → 56).
- [ ] 본문 한국어, 식별자/경로/HTTP method/status code 는 영어 (§12).

## Out of Scope

- `src/` · `test/` 코드 변경 0 (endpoint 는 이미 T-0428 로 머지됨 — 본 task 는 문서만).
- `docs/architecture/data-model.md` 변경 — recent-deletion endpoint 는 신규 entity/schema 를 도입하지 않으므로 data-model.md 갱신 불요 (필요 판단 시 Follow-up 으로). 본 task 는 api.md 단일 파일만.
- schema/repository 게이트 동반 후속(slice 2 후속 a 실 deleter provider, 후속 a-2 instants 자동 도출, slice 3 삭제 audit 영속) — 별도 task.
- §7 UC sequence cross-reference 표 갱신 — 본 task 범위 밖(필요 시 Follow-up).

## Suggested Sub-agents

direct doc-only 이므로 sub-agent 불요 — driver(또는 implementer)가 api.md 1개 파일을 직접 편집. tester 불요(코드 0 LOC, R-110 면제 — direct doc-only).

## Follow-ups

(없음)

## Result (DONE — 2026-06-16T00:38Z)

- **완료**: cron@local-aalocal fire(claim 경로). docs/architecture/api.md §5 Endpoint 표에 `POST /api/schedules/recent-deletion/:personId` 행을 backfill/trigger 행 mirror 로 박제(UC-01 링크 + R-74/REQ-041 + RecentDeletionDto(instants ISO[] + 선택 days) + runRecentDeletion 위임 + 202/RecentDeletionRunResult{personId,deletedCount,recollected} + deleter 미주입 시 deletedCount:0 + raw forward + Admin+ RBAC) + 합계 주석/숫자 55→56 정합.
- **변경**: docs/architecture/api.md (+2/-1), doc-only direct. src/test 0 LOC.
- **검증**: R-110 면제(direct doc-only, 코드 0 LOC). lint/build/test 무관.
- **commit**: direct → main (본 closeout commit). Acceptance Criteria 전 항목 ok.
