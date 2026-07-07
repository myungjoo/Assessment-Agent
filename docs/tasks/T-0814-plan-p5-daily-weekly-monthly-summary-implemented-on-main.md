---
id: T-0814
title: PLAN.md P5 일/주/월 요약 평가 bullet(97) implemented-on-main checkbox 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-061]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
independentStream: p5-plan-doc-sync
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5 bullet97(일/주/월 요약 평가, R-61) 이 ADR-0035/0039 chain 으로 implemented-on-main 인데 checkbox [ ] 잔존 — T-0812/T-0813 drift 패턴 mirror, direct doc-only.
---

# T-0814 — PLAN.md P5 일/주/월 요약 평가 bullet(97) implemented-on-main checkbox 정합

## Why

PLAN.md P5 line 97 "일/주/월 요약 평가 (LLM 정성 + Metric 수치)" bullet 은 아직 `[ ]` 로 표기돼 있으나, 해당 기능(R-61 당일 자정까지 미평가 + 주간 다음주 시작 + 월간 다음달 시작, KST 경계)은 이미 main 에 shipped 돼 있다 — `period-evaluable.ts` 의 `isPeriodEvaluable`/`computePeriodEnd`(ADR-0039 KST boundary 경유) + summary batch/aggregate/narrative/persist orchestrator chain(ADR-0035). T-0809·T-0810·T-0811·T-0812·T-0813 와 동일한 stale-checkbox drift 로, 본 task 는 line 97 을 `[x]` + implemented-on-main 절로 정합한다.

## Required Reading

- `docs/PLAN.md` (line 96~110, 특히 line 97)
- `src/assessment-evaluation/domain/period-evaluable.ts` (`isPeriodEvaluable`/`computePeriodEnd` — R-61 자정/주/월 경계 permission 판정)
- `src/assessment-evaluation/domain/summary-due-coordinates.ts` (R-61 요약 대상 좌표 enumeration)
- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` (`@Injectable` batch orchestrator)
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` (aggregate orchestrator `evaluateAndPersist`)
- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` (aggregate summary 평가 §Decision 3)
- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` (KST 자정/주/월 경계 §Decision 3)

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 97 의 체크박스를 `[ ]` → `[x]` 로 변경.
- [ ] 같은 bullet 에 `**implemented-on-main**:` 절 추가 — period-evaluable(`isPeriodEvaluable`/`computePeriodEnd` KST 경계), summary-due-coordinates(좌표 enumeration), summary-batch/aggregate orchestrator chain, ADR-0035 + ADR-0039 canonical source 를 인용. 참조 경로·심볼명은 origin/main 실측과 일치해야 함.
- [ ] R-61 의 "당일 활동은 자정까지 평가 미실시 / 주간은 다음주 시작 / 월간은 다음달 시작" 이 KST(Asia/Seoul) 경계로 cover 됨을 절 안에 명시.
- [ ] 변경은 line 97 국한 — 다른 bullet·section 미접촉 (`git diff --stat` 로 `docs/PLAN.md` 1 파일 확인).
- [ ] `node -e "require('./docs/STATE.json')"` 로 STATE.json parse 무결 확인 (본 task 가 STATE 를 건드리면).

## Out of Scope

- 코드·test·ADR 변경 (본 task 는 doc-only reconciliation — 기능은 이미 main 에 존재).
- line 97 외 다른 P5 unchecked bullet(98 R-9 custom period, 108~110 live-LLM/e2e/timezone) 의 checkbox 변경 — 각각 별도 판정·task.
- summary orchestrator 의 신규 scheduler 자동 발화 배선 (ADR-0035 §Decision 3 상 P7 scope, 본 bullet 밖).

## Suggested Sub-agents

direct doc-only 이므로 sub-agent chain 불요 — driver 가 직접 edit + direct commit.

## Follow-ups

(작성 시점 없음. sub-agent 가 관련 작업 발견 시 여기에 append.)
