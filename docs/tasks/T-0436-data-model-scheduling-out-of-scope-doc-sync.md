---
id: T-0436
title: data-model.md 에 cron schedule 비영속(ADR-0042 in-memory) 결정 + REQ-041 cross-ref doc-sync
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-041, REQ-072]
dependsOn: []
touchesFiles: [docs/architecture/data-model.md]
independentStream: p7-doc-sync
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-16
plannerNote: P7 doc-sync — data-model.md §7 에 cron schedule 비영속(ADR-0042 in-memory) 결정 박제 + §6 REQ-041 row 추가, direct doc-only 게이트 없음
---

# T-0436 — data-model.md 에 cron schedule 비영속(ADR-0042 in-memory) 결정 + REQ-041 cross-ref doc-sync

## Why

P7 conceptual↔shipped doc-sync chain(T-0430~T-0435: api.md / modules.md / UC-01 / UC-03 / UC-06)은 endpoint·module·use-case 문서를 정합했으나, **conceptual data model 문서(`docs/architecture/data-model.md`)는 P7 SchedulingModule 의 데이터 측면을 0회 반영**한다. 두 gap 이 남아있다:

1. **§7 Out of scope 에 cron schedule 비영속 결정 미박제** — shipped SchedulingModule(src/scheduling/)의 동적 cron schedule 은 [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) §Consequences 가 명시적으로 **단일 process in-memory `SchedulerRegistry`(process 재시작 시 휘발, DB entity 미신설)** 로 결정했다. 이는 data-model 의 의도적 omission 인데 §7 의 "하지 않는다" 목록에 없어, 독자가 "왜 CronSchedule entity 가 §2 에 없는가"를 추적할 source 가 없다(doc/decision gap).
2. **§6 REQ → entity coverage 표 본문에 REQ-041 누락** — REQ-041(최근 N일 결과 delete→재수집, R-74)은 본 문서 `Refs:` 줄과 frontmatter 인접에는 있으나 **§6 표 본문(L114~137)에 row 가 0**. REQ-041 은 Assessment lifecycle(delete) + 비영속 스케줄러 trigger 로 cover 되며 전용 entity 가 없음을 명시해야 한다.

doc-only(data-model.md 1파일)라 schema/repository/module-cycle/credential 게이트 0, src/test 0 LOC(R-110/R-112 면제). REQ-072 는 R-72 "Admin 런타임 cron 주기 지정"의 데이터 측면(비영속) 박제를 함께 cover.

## Required Reading

- `docs/architecture/data-model.md` §6(L110~146 coverage 표) + §7(L148~163 Out of scope) — 편집 대상.
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` §Consequences(L57: 단일 process in-memory, 재시작 휘발, 영속화는 후속 task) — 비영속 결정의 source.
- `docs/architecture/modules.md` L42 SchedulingModule row(T-0433 박제) — shipped backbone 참조용(본 task 는 modules.md 편집 안 함).

## Acceptance Criteria

- [ ] `docs/architecture/data-model.md` §7 Out of scope 목록에 cron schedule 비영속 결정 1 bullet 추가 — 내용: "**Cron schedule 영속화 entity** — shipped SchedulingModule(src/scheduling/)의 동적 cron schedule 은 [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) §Consequences 결정에 따라 단일 process in-memory `SchedulerRegistry` 로만 보유(process 재시작 시 휘발)하며 별도 DB entity 를 신설하지 않는다. 등록 cron 의 DB 영속화(부팅 시 재등록)는 후속 task / 별도 ADR 책임." (정확한 문구는 자연스럽게 다듬어도 의미 보존).
- [ ] `docs/architecture/data-model.md` §6 coverage 표 본문(L114~137 영역)에 REQ-041 row 1줄 추가 — `| REQ-041 | 최근 N일 결과 delete→재수집 | Assessment (delete lifecycle) + 비영속 cron trigger(전용 entity 없음, ADR-0042) |` 형태(REQ-037 row 인접 배치 권장).
- [ ] §6 의 "uncovered 0" 검산 문장(L137 근방)이 REQ-041 추가와 모순되지 않는지 확인 — REQ-041 이 전용 entity 없이 cover 됨을 명시(필요 시 "추가 cover" 절로 분류해도 무방).
- [ ] §2 Entity 목록 / §3 ER diagram / §5 cross-cutting field / mermaid 불변(신규 entity 0 — ADR-0042 가 비영속 결정한 영역이므로 entity 추가 금지).
- [ ] diff ≤ 300 LOC, 변경 파일 = `docs/architecture/data-model.md` 1개.
- [ ] direct doc-only commit (src/test 0 LOC → R-110/R-112 면제, CI gating 영향 0).

## Out of Scope

- **신규 entity(CronSchedule 등) 신설 금지** — ADR-0042 가 비영속을 명시 결정했으므로 entity 추가는 본 task 범위가 아니며, 영속화가 필요해지면 별도 ADR(§5 BLOCKED schema 게이트).
- **modules.md / api.md / UC-NN 편집 금지** — 이미 T-0430~T-0435 가 정합. 본 task 는 data-model.md 단일 파일.
- **prisma/schema.prisma / repository / migration 변경 금지** — schema 게이트, 후속.
- **REQ-027 backfill 의 Person.backfilledAt 전용 표식** — schema 게이트, 후속(backlogNote 명시).
- **ADR-0042 본문 수정 금지** — 이미 §Consequences 가 결정 박제, 본 task 는 data-model 가 그것을 참조만.

## Suggested Sub-agents

`implementer` 단독 (doc-only direct, executor 가 직접 편집해도 무방 — sub-agent 호출 없이 처리 가능).

## Follow-ups

(비어있음 — 작성 시점)
