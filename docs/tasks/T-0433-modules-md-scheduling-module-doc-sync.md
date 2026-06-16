---
id: T-0433
title: modules.md SchedulerModule row 를 shipped SchedulingModule P7 backbone 으로 정합 (doc-sync)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-039, REQ-040, REQ-041]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-06-16
independentStream: req041-doc-sync
dependsOn: [T-0428, T-0430]
touchesFiles: [docs/architecture/modules.md]
plannerNote: "P7 ⑤ — modules.md L42 SchedulerModule row 가 P1 conceptual 서술뿐, shipped SchedulingModule(cron CRUD·trigger·backfill·recent-deletion) 0 반영. doc/reality gap 정합, direct, 게이트 없음."
---

# T-0433 — modules.md SchedulerModule row 를 shipped SchedulingModule P7 backbone 으로 정합

## Why

`docs/architecture/modules.md` L42 의 **SchedulerModule** row 는 P1 (T-A4) 설계기 conceptual 서술 — "`@nestjs/schedule` 기반 in-process cron + dynamic registry, 시각 도달 시 AssessmentModule 평가 service 호출" 만 박제하고, **P7 에서 실제 shipped 된 `SchedulingModule`(src/scheduling/) backbone 을 0회 반영**한다. 그 사이 api.md §5 (L134~140) 와 ADR-0042 는 다음 shipped surface 를 이미 박제했다: cron 주기 CRUD(`GET`/`PUT` `/api/schedules` + `DELETE :name`, T-0414/T-0415 PR #334), manual trigger(`POST /api/schedules/trigger`, T-0417 PR #336), manual backfill(`POST /api/schedules/backfill/:personId`, T-0421 PR #340), 그리고 **REQ-041 최근 N일 delete→재수집**(`POST /api/schedules/recent-deletion/:personId`, T-0428 PR #346 + `RecentDeletionRunnerService` T-0427 PR #344). modules.md 만 이 backbone 을 0 참조해 doc/reality gap 이 남아 있다. 본 task 는 그 row 1 개를 shipped 사실로 정합한다 (api.md §5·UC-01·UC-06 doc-sync 와 동형, REQ-041 게이트 없는 잔여 doc-sync 의 마지막 단추 중 하나).

README 109~128 (REQ-039 cron / REQ-040 manual trigger) + R-74/REQ-041 (최근 N일 delete→재수집) 이 본 module 책임의 요구 출처다.

## Required Reading

- `docs/architecture/modules.md` — L9 (MVA 범위 원칙: class/method/endpoint 본문은 범위 밖, 책임 1~2줄 + 의존성 + component + REQ 만), L15 (P7 placeholder), **L42 SchedulerModule row (정합 대상)**, L40 AssessmentCollectionModule row (정합 선례 — 같은 형식의 shipped backbone 박제 패턴), L97 mermaid Scheduler→Assessment edge.
- `docs/architecture/api.md` — L58 (`/api/schedules` resource 행) + L134~140 (cron 주기 관리 그룹 6 endpoint, source of truth 로 인용할 사실).
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` — §Decision1/Decision2 (동적 registry + cron tick / manual trigger 추상 공유), 본 row 의 ADR 링크 정합용.
- 본 task 파일 자신.

## Acceptance Criteria

- [ ] `docs/architecture/modules.md` L42 의 **SchedulerModule** row 를 다음을 반영하도록 정합한다 (MVA 원칙 준수 — 책임 1~2줄 + 의존성 + component + REQ + ADR 링크, **구체 메서드 시그니처/endpoint 본문은 api.md 로 위임**):
  - 실 shipped module 명이 `SchedulingModule` (src/scheduling/) 임을 반영 (P1 conceptual `SchedulerModule` 명칭과의 관계 1줄 — 명칭 정합 또는 "shipped 명 = SchedulingModule" 주석).
  - 책임에 P7 shipped surface 를 요약 박제: ① cron 주기 동적 CRUD(`CronScheduleController`/`CronScheduleService` — GET/PUT/DELETE `/api/schedules`, ADR-0042 §Decision2 registry), ② manual trigger(`POST /api/schedules/trigger`, CRON_TICK_HANDLER 공유), ③ manual backfill(`BackfillController`/`BackfillRunnerService` — `POST /api/schedules/backfill/:personId`), ④ **REQ-041 최근 N일 delete→재수집**(`RecentDeletionController`/`RecentDeletionRunnerService` — `POST /api/schedules/recent-deletion/:personId`, 순수-helper 3 slice buildRecentDeletionWindow/selectInDeletionWindow/buildRecentDeletionPlan 위에서 조립). 각 항목은 api.md §5 로 세부 위임 1줄.
  - 실 `RECENT_DELETION_DELETER` provider 미shipped(주입형 인터페이스 기본 no-op, deletedCount:0; 실 Prisma deleter 바인딩은 schema/repository 게이트 동반 별도 sub-slice) 임을 1구절로 한정 명시 (UC-06 §6.5·UC-01 §3 doc-sync 와 정합).
  - 의존성 칼럼: 기존 `PersistenceModule`/`AssessmentModule` 외에 실제 배선 사실 반영 (`AuthModule` controller guard, `AssessmentCollectionModule`/`CollectionTriggerService` 재수집 위임). 단 module-cycle 사실 변경 없이 **서술만** — 코드/배선 무변경.
  - REQ 칼럼에 `REQ-041` 추가 (기존 REQ-039/REQ-040 유지).
  - ADR 링크 칼럼에 `ADR-0042` 추가 (기존 ADR-0003 §3 유지 또는 정합).
- [ ] 변경은 modules.md **L42 row (+ 필요 시 인접 L15 P7 placeholder 1줄)** 에 국한 — L40 AssessmentCollectionModule row / L97 mermaid diagram / REQ 표 다른 row / 합계 등 불변 (MVA 범위·P1 의도 존중).
- [ ] doc-only direct commit (src/test 0 LOC). R-110/R-112 면제 (코드 0 LOC) — 본 task 는 production code 를 건드리지 않으므로 tester 호출·coverage 검증 불요.
- [ ] 분기 없음 — 본 task 는 doc-sync 1 row 정합이라 R-112 happy/error/branch/negative 항목 및 `pnpm test:cov` 게이트는 적용 대상 아님 (이 항목 생략).

## Out of Scope

- src/scheduling/ 의 어떤 코드도 변경하지 않는다 (실 `RecentDeletionDeleter` Prisma provider 바인딩 = schema/repository 게이트 — 별도 sub-slice).
- mermaid diagram (L97) 의 edge 추가·수정. 본 task 는 표 row 1개 정합만.
- api.md / UC-01 / UC-06 등 다른 doc 의 추가 정합 (이미 T-0430/T-0431/T-0432 로 박제됨 — 중복 금지).
- module 명칭을 src 레벨에서 변경 (`SchedulingModule` ↔ `SchedulerModule` rename refactor 금지 — doc 서술만 실 명칭에 맞춤).
- 새 ADR 신설 / 기존 ADR status 변경.

## Suggested Sub-agents

`implementer` (doc-only 단일 row 정합 — architect/tester 불요).

## Follow-ups

(작성 시점 비어 있음)

## 결과 (DONE — 2026-06-16T03:38Z)

- modules.md L42 SchedulerModule row 를 shipped `SchedulingModule`(src/scheduling/) P7 backbone 으로 정합 — cron 동적 CRUD(`CronScheduleController`/`Service`) · manual trigger(`/api/schedules/trigger`, `CRON_TICK_HANDLER` 공유) · backfill(`BackfillController`/`BackfillRunnerService`) · REQ-041 recent-deletion(`RecentDeletionController`/`RecentDeletionRunnerService`, 순수-helper 3 slice 조립) 4 surface 박제, endpoint 본문은 api.md §5 위임.
- 실 `RECENT_DELETION_DELETER` 미shipped no-op(`deletedCount:0`) 한정 명시. 의존성 칼럼에 `AuthModule` guard + `AssessmentCollectionModule`(`CollectionTriggerService`) 재수집 위임 서술(코드 무변경). REQ 칼럼 `REQ-041` 추가, ADR 칼럼 `ADR-0042` 추가. L15 P7 placeholder 1줄 동기.
- doc-only direct commit (modules.md 1 file, +2/-2). src/test 0 LOC → R-110/R-112 면제(tester 불요). L40 row / L97 mermaid / 다른 REQ row 불변.
- fire: cron@aalocal-s1-9967493 권위 lock CAS 획득(b67d0cc, prev tip 067cb12 free tombstone)→reclaim no-op(claims [])→active claim 0<maxConcurrentClaims 2 게이트 OK→select-claim T-0433(direct, active 0 단독, claim 박제+lock tombstone 동반 release)→lock-free executor→modules.md 편집→direct main commit. 종료 시 claims.json 에서 T-0433 entry 제거(완료).
