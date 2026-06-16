---
id: T-0435
title: UC-01 §3 trigger 1·2 에 shipped cron schedule CRUD + manual trigger endpoint doc-sync
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-039, REQ-040]
estimatedDiff: 22
estimatedFiles: 1
created: 2026-06-16
touchesFiles: [docs/use-cases/UC-01-evaluation-execution.md]
dependsOn: [T-0414, T-0415, T-0417]
independentStream: p7-uc01-trigger-doc-sync
plannerNote: P7 — UC-01 §3 trigger 1(cron 시각 도달)·2(manual trigger)에 shipped /api/schedules CRUD + /trigger endpoint 참조 보강. doc-only, 게이트 없음.
---

# T-0435 — UC-01 §3 trigger 1·2 에 shipped cron schedule CRUD + manual trigger endpoint doc-sync

## Why

[UC-01](../use-cases/UC-01-evaluation-execution.md) §3 Trigger 는 3 가지 trigger 경로를 박제하며, 직전 T-0432 가 그 중 trigger 3 (재수집 trigger) 에 shipped `POST /api/schedules/recent-deletion/:personId` 참조를 박제해 정합을 복원했다. 남은 trigger 1·2 는 여전히 P2 설계기 conceptual 서술만 담는다 — trigger 1 (36행) 은 "`@Cron` decorator handler + cron 표현식 DB 영속 저장" 이라 적혀 있으나, P7 에서 shipped 된 실 구현은 **SchedulerRegistry 동적 등록** (정적 `@Cron` 데코레이터 아님) 이고 영속화는 ADR-0042 §Consequences 대로 **미shipped (in-memory registry)** 이며 진입점은 `GET/PUT/DELETE /api/schedules` (T-0414/T-0415, PR #334) 다. trigger 2 (37행) 도 "Backend API endpoint" 라고만 적혀 shipped `POST /api/schedules/trigger` (T-0417, PR #336, REQ-040) 을 0회 참조한다. `git grep -c "registerOrReplace|T-0414|T-0415|api/schedules/trigger|T-0417" UC-01` = 0 매칭으로 doc/reality gap 을 확인했다 (exit 1). T-0432 동형으로 trigger 1·2 에 shipped 진입점 참조 + 영속화 미shipped 한정을 보강해 living document 정합을 마무리한다. doc-only (UC-01 1파일) 라 schema/repository/module-cycle 게이트 0, src/test 코드 0 LOC.

## Required Reading

- `docs/use-cases/UC-01-evaluation-execution.md` — 수정 대상. 특히 §3 Trigger (34~38행, trigger 1 "Cron 시각 도달" / trigger 2 "Admin manual trigger") / §11 References (179~191행). trigger 3 (38행) 은 T-0432 가 이미 박제한 mirror 표현 참고.
- `docs/architecture/api.md` §5 Endpoint 표 ("cron 주기 관리 (`/api/schedules`)" 행들 — GET list / PUT registerOrReplace / DELETE `:name` / `POST /api/schedules/trigger`) — shipped endpoint 의 정확한 계약 참조 source.
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` §Decision2 (동적 SchedulerRegistry registry) / §Consequences (cron 영속화 후속 deferral) — trigger 1 의 "DB 영속 저장" conceptual 서술과 shipped reality 의 차이 근거.

## Acceptance Criteria

- [ ] UC-01 §3 trigger 1 ("Cron 시각 도달", 36행) 에 shipped 구현 참조를 1 절 보강 — conceptual 서술 (REQ-039) 은 유지하되, 실 진입점이 `GET/PUT/DELETE /api/schedules` (T-0414/T-0415, PR #334, Admin+ RBAC) 로 cron 주기를 런타임 등록/교체/조회/삭제하며, shipped 구현은 정적 `@Cron` 데코레이터가 아니라 **`CronScheduleService` 의 SchedulerRegistry 동적 등록** (재배포 없이 주기 변경, [ADR-0042 §Decision2](../decisions/ADR-0042-nestjs-schedule-adoption.md)) 이고, cron 표현식의 **DB 영속화는 ADR-0042 §Consequences 대로 미shipped (in-memory registry, process restart 시 비복원)** 임을 명시.
- [ ] UC-01 §3 trigger 2 ("Admin manual trigger", 37행) 에 shipped 진입점이 `POST /api/schedules/trigger` (T-0417, PR #336, Admin+ RBAC, REQ-040) 이며 cron tick callback 과 동일 실행 추상 (`CRON_TICK_HANDLER`) 을 공유함을 한 문장으로 추가. conceptual "Web UI 버튼 → Backend API endpoint" 서술은 유지.
- [ ] §11 References 에 `docs/architecture/api.md` §5 cron 주기 관리 (`/api/schedules`) 행 링크 1줄 추가 (REQ-039 cron CRUD + REQ-040 trigger endpoint 의 계약 source 지칭). 기존 References 항목은 보존.
- [ ] §5 sequence diagram (alt cron/manual block) / §6 / §9 mapping table / §10 REQ cover 표 의 기존 서술은 **변경하지 않는다** — 본 UC 의 conceptual 의도 (sequence 는 trigger metadata 만 다른 단일 flow) 를 존중하고, addendum 은 §3 trigger 1·2 각 한 절 + §11 References 한 줄로만 한정 (diagram 재작성 / REQ row 추가 금지 → diff 최소화 + scope creep 차단).
- [ ] 본문 한국어, 식별자/경로/HTTP method/status code 는 영어 (§12).
- [ ] doc-only direct commit — production code 0 LOC. (R-110/R-112 면제 — direct doc-only commit 에는 tester 불요.)

## Out of Scope

- §5 sequence diagram / §9 mapping table / §10 REQ cover 표 수정 — 본 task 는 §3 trigger 1·2 + §11 References 만 (diff ≤ ~22 LOC 유지). 필요 판단 시 Follow-up.
- cron 표현식 DB 영속화 구현 — ADR-0042 §Consequences 의 미shipped 후속 (schema 게이트). 본 task 는 그 게이트 미존재 사실만 언급.
- cron tick callback → 실 평가 실행 경로 배선 — 별도 P7 backbone (현재 `CRON_TICK_HANDLER` 주입형). 본 task 범위 밖.
- api.md / modules.md / UC-06 수정 — 이미 T-0430/T-0433/T-0431 로 박제됨. 본 task 는 UC-01 1파일만.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집). architect/tester 불요 (direct doc-only, 코드 0 LOC).

## Follow-ups

(없음 — sub-agent 가 발견 시 추가)
