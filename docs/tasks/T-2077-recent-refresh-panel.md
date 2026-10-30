---
id: T-2077
title: 최근 N일 재수집 ⑨ — 패널이 실제 결과 · 재시도 · 참인 경고를 보여준다
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 81848dd9
prNumber: 1638
reviewRounds: 2
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-10-31
dependsOn: [T-2076]
touchesFiles: [web/src/components/ReEvaluationTriggerPanel.tsx, web/src/components/ReEvaluationTriggerPanel.test.tsx]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑨. 설계 결정은 T-2069
---

# T-2077 — 패널

## Why

패널은 오류가 나면 alert 만 남아 되돌아갈 길이 없고, 경고 문구는 "삭제한 뒤 재수집" 이라 실제 동작과 다르며, 결과를 표시할 자리가 없다.

## Required Reading

- T-2069 "설계 결정", `web/src/components/ReEvaluationTriggerPanel.tsx`.

## Acceptance Criteria

- [ ] 오류가 나도 alert 와 함께 선택 UI 가 남아 재시도할 수 있다.
- [ ] `result` 의 삭제 · 저장 · 갱신 안 됨 건수와 중단 안내를 표시한다. 진행 중에는 숨긴다.
- [ ] 경고는 교체 · 실패 기간 유지 · 오늘 제외를 말한다.
- [ ] `triggerDisabled` 면 버튼이 비활성이다.
- [ ] web test · build green, PR CI green.

## Out of Scope

- 결과 조회 · props 배선 (T-2078, T-2079).

## Follow-ups

- (planner 판정, 소비처 동반 의무 예외) `result` · `triggerDisabled` 의 소비처를 포함하면 `estimatedFiles` 7 로 5 파일 cap 을 넘는다. 소비처는 T-2079 (`adminScheduleRunners.ts` 폴링, `useAdminSchedule.ts`) · T-2080 (`AdminView.tsx` props 배선) 다.
