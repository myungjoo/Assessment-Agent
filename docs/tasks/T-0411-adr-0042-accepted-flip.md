---
id: T-0411
title: ADR-0042 status PROPOSED→ACCEPTED flip (@nestjs/schedule 도입 확정)
phase: P7
status: DONE
completedAt: 2026-06-15T04:05:00Z
commitMode: direct
coversReq: [REQ-027, REQ-039, REQ-040]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-06-15
independentStream: p7-scheduling
dependsOn: [T-0410]
touchesFiles: [docs/decisions/ADR-0042-nestjs-schedule-adoption.md]
plannerNote: P7 stream ① — T-0410(ADR-0042 PROPOSED) 머지 후 ACCEPTED flip(§3.1 규칙4 = direct 1줄). dep 실추가(②)의 선행 게이트.
---

# T-0411 — ADR-0042 status PROPOSED→ACCEPTED flip (@nestjs/schedule 도입 확정)

## Why

[PLAN.md](../PLAN.md) Phase P7 (Scheduling & operations) 의 첫 산출물인 [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) (`@nestjs/schedule` 도입 결정) 가 T-0410 (PR #331, squash e6a6638) 로 `status: PROPOSED` 상태로 머지됐다. 사용자가 2026-06-15 새 외부 dependency 도입을 **명시적으로 승인** ([CLAUDE.md](../../CLAUDE.md) §5 게이트 해소) 했고 reviewer 가 PR #331 에서 APPROVE (r1/7, finding 0) 했으므로, 본 task 는 ADR frontmatter 의 status 를 `PROPOSED` → `ACCEPTED` 로 flip 한다. [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 4 에 따라 ADR status 한 줄 갱신은 `direct` commit 이며, 본 flip 이 후속 ② (package.json `@nestjs/schedule` 실 추가 + ScheduleModule import, pr-mode) 의 선행 게이트다.

## Required Reading

- [docs/decisions/ADR-0042-nestjs-schedule-adoption.md](../decisions/ADR-0042-nestjs-schedule-adoption.md) — frontmatter `status:` 라인 (현 `PROPOSED`)
- [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 4 — "ADR status 갱신(PROPOSED→ACCEPTED) 한 줄 수정은 direct"

## Acceptance Criteria

- [x] [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED` 로 변경.
- [x] frontmatter 외 ADR 본문 (Context / Decision / Consequences / Alternatives / 범위 밖 / References) 은 **무수정** — flip 1줄 외 diff 0.
- [x] 변경 후 `git diff docs/decisions/ADR-0042-nestjs-schedule-adoption.md` 가 status 라인 1줄 (+`status: ACCEPTED` / -`status: PROPOSED`) 만 보여줄 것.
- [x] doc-only direct commit — 코드 변경 0, 새 dependency 0, test 영향 0 (R-110 면제 대상: direct-mode doc-only).

## Result (DONE — 2026-06-15)

ADR-0042 frontmatter `status` 를 `PROPOSED` → `ACCEPTED` 로 flip (diff +1/-1, status 라인만). 본문 무수정. `@nestjs/schedule` 도입 결정 확정 — 후속 ② (package.json dep 실 추가 + ScheduleModule import, pr-mode) 의 선행 게이트 해소. cron local-15 fire, direct doc-only main commit.

## Out of Scope

- `package.json` / `pnpm-lock.yaml` 에 `@nestjs/schedule` 실 추가 — 후속 ② task (pr-mode, dependsOn: T-0411).
- `ScheduleModule.forRoot()` AppModule import / wiring — 후속.
- 스케줄러 service · `SchedulerRegistry` 동적 cron 등록 로직 — 후속.
- R-72 cron 주기 엔드포인트 / R-73 manual trigger / R-50 신규 인원 1년치 backfill — 각 후속 task.
- ADR 본문 내용 변경 (방향성·trade-off 재서술 등) — flip 외 어떤 본문 수정도 금지.

## Suggested Sub-agents

`implementer` (1줄 frontmatter edit — direct doc-only, tester/architect 불요).

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append. 후속 P7 ②: package.json `@nestjs/schedule` 실 추가 + `ScheduleModule.forRoot()` AppModule import (pr-mode, dependsOn: T-0411) — 본 flip 머지 후 planner 가 큐잉.)
