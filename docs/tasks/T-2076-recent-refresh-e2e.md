---
id: T-2076
title: 최근 N일 재수집 ⑧ — 실 DB row 교체 e2e
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: fff3d977
prNumber: 1637
reviewRounds: 2
commitMode: pr
coversReq: [REQ-041, REQ-031]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-10-31
dependsOn: [T-2075]
touchesFiles: [test/e2e/schedules-recent-refresh.e2e-spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑧. 설계 결정은 T-2069
---

# T-2076 — 실 경로 e2e

## Why

재수집의 핵심 약속을 실 HTTP · 실 DB 로 고정한다. 창 안 row 만 교체하고, 다른 인원 · 창 밖 · 오늘 · Summary 는 그대로이며, 수집이나 평가가 실패하면 이전 row 가 남는다.

## Required Reading

- T-2069 "설계 결정", `test/e2e/schedules-cron.e2e-spec.ts` 의 가짜 GitHub 구성.

## Acceptance Criteria

- [ ] 활동 있는 좌표가 새 평가 row 로 교체되고 이전 Contribution 이 사라진다.
- [ ] 다른 인원 · 창 밖 · 오늘 row 와 Summary 는 그대로다.
- [ ] 저장본이 없던 닫힌 날이 채워진다.
- [ ] 식별자 없음 · GitHub 장애 · LLM 장애에서 이전 row 가 남고 not refreshed 로 알린다.
- [ ] 실행 중 재요청은 409 다.
- [ ] 외부 host 는 `globalThis.fetch` 로만 대체한다. 실 GitHub · 실 LLM 은 검증하지 않는다.
- [ ] 로컬 lint, PR CI green.

## Out of Scope

- production 코드 변경, 동시 tick 시나리오 (unit 에서 evaluation 축 409 를 고정).
