---
id: T-0811
title: PLAN.md P7 scheduling/operations bullet 4종 implemented-on-main checkbox 정합
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-072, REQ-073, REQ-074, REQ-050]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-07-07
independentStream: plan-doc-drift
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5-in-progress; T-0809 P5 drift 패턴을 P7 bullet 132~135 에 mirror — src/scheduling 실shipped 를 `[ ]`→`[x]` 정합
---

# T-0811 — PLAN.md P7 scheduling/operations bullet 4종 implemented-on-main checkbox 정합

## Why

T-0809(P5 detection/adjustment)·T-0810(api.md UC-06) 가 교정한 "PLAN↔shipped-code drift" 패턴을 P7 scheduling bullet 에 mirror 한다. Q-0051(2026-07-07) 로 오너가 P7 + `@nestjs/schedule` 를 승인했고, grep 실측 결과 P7 의 4개 bullet(R-72 cron 주기 지정 / R-73 manual trigger / R-74 최근 N일 재수집 / R-50 신규 인원 1년치 backfill)는 이미 `src/scheduling/` 에 controller·service·spec 로 전량 shipped-on-main 이다(`@nestjs/schedule` dep + ADR-0042 ACCEPTED). 그런데 `docs/PLAN.md` L132~135 는 여전히 `[ ]` 미체크로 stale drift 상태다. 이를 `[x]` + implemented-on-main 절로 정합해 미래 planner 의 done-bullet 재큐잉(make-work) risk 를 차단한다(bullet 99~101/103~105 T-0809 precedent 그대로).

## Required Reading

- `docs/PLAN.md` (L130~135 P7 phase 헤더 + 대상 4 bullet)
- `docs/tasks/T-0809-*.md` (P5 checkbox 정합 precedent — implemented-on-main 절 포맷 mirror 대상)
- 실shipped 확인용(읽기만, 링크 경로/symbol 실존 재검증):
  - `src/scheduling/cron-schedule.controller.ts` (R-72: `@Get`/`@Put`/`@Delete(":name")`/`@Post("trigger")`)
  - `src/scheduling/backfill.controller.ts` (R-73/R-50: `@Post("backfill/:personId")`)
  - `src/scheduling/recent-deletion.controller.ts` (R-74: `@Post("recent-deletion/:personId")`)
  - `src/scheduling/backfill-plan.ts` (R-50: `buildBackfillPlan`, 52주≈1년 window)
  - `src/scheduling/backfill-runner.service.ts` (R-50: `runBackfill`)
  - `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` (P7 진입 근거 링크)

## Acceptance Criteria

- [x] `docs/PLAN.md` L132(R-72)·L133(R-73)·L134(R-74)·L135(R-50) 4 bullet 의 `- [ ]` 를 `- [x]` 로 flip.
- [x] 각 bullet 끝에 **implemented-on-main** 절 append — 실 파일 경로 + symbol + ADR-0042 참조. bullet 99~101/103~105(T-0809) 포맷 mirror. 예: R-72 = `[cron-schedule.controller.ts](../src/scheduling/cron-schedule.controller.ts)` GET/PUT/DELETE(":name")/POST("trigger") route.
- [x] append 하는 모든 링크 경로·symbol 을 구현 직전 `git grep`/`ls` 로 origin/main 실존 재확인(T-0809 규율). 실존 안 하는 경로 링크 금지.
- [x] R-50 은 "일반 인원 매주 1회 평가와 분리된 신규 인원 1년치(52주) 1회 backfill" 이 `backfill-plan.ts`/`backfill-runner.service.ts` 로 shipped 임을 절에 명시.
- [ ] R-73(manual trigger) 은 cron-schedule `POST("trigger")` + backfill `POST("backfill/:personId")` 두 경로가 함께 cover 함을 명시(중복 아님 — 다른 대상의 수동 트리거).
- [ ] append-only 규율 — 기존 REQ 참조·설명 본문·헤더는 보존, checkbox flip + implemented-on-main 절 추가만.
- [ ] R-57(import/export/restore)·R-91/R-92(성능 검증) bullet 은 **건드리지 않는다**(Out of Scope — restore leg 산발/perf test 부재로 shipped 판정 보류).
- [ ] direct doc-only commit — 코드/test 0 이라 tester 불요(R-110 면제). markdown 형식 유효성만 확인.

## Out of Scope

- R-57(import/export/restore, bullet 137)·R-91/R-92(성능 검증, bullet 138~140) checkbox 변경 — 별도 실측 필요(perf test 파일 grep 결과 부재, restore leg 산발). 본 task 는 명확히 shipped 인 4 bullet 만.
- P7 phase 헤더(L130 오너 승인 blockquote) 문구 변경.
- P7 의 실 미shipped 잔여(성능 벤치마크 등) 신규 구현.
- `src/` 코드 변경 일체 — 본 task 는 PLAN.md doc-drift 정합만.
- STATE.json / journal / counters write(driver 몫).

## Suggested Sub-agents

`implementer` (doc-only, PLAN.md 편집 + 링크 경로 실존 재확인). tester 불요(direct doc-only, R-110 면제).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기 append)
