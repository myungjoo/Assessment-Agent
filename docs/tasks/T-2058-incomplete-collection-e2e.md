---
id: T-2058
title: 불완전 수집 저장 차단 ⑨ — fake GitHub e2e
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 6d82606d
prNumber: 1619
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-083]
estimatedDiff: 165
estimatedFiles: 1
created: 2026-10-31
dependsOn: [T-2057]
touchesFiles: [test/e2e/schedules-cron.e2e-spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ⑨ — 저장 차단 · 재시도 · run status 를 실 경로로 고정
---

# T-2058 — e2e

## Why

앞선 slice 는 unit 으로 검증됐다. 실 HTTP · 실 DB 경로에서 한 source 실패가 좌표를 비워 두고 다음 실행이 채우는지 고정한다.

## Required Reading

- `test/e2e/schedules-cron.e2e-spec.ts` 실 평가 실행 절, [T-2051](T-2051-collection-coverage-rule.md) 판정 규칙.

## Acceptance Criteria

- [ ] 활동 + `issues` 500 → row 0 + `lastEvaluationRun` 불완전 9 건 → 복구 후 9 건 저장 · 불완전 0.
- [ ] 목록에 있으나 쓸 수 없는 instance 의 식별자 → row 0. 올린 적 없는 instance 의 식별자 → 저장.
- [ ] fill-run: `pulls` 500 → `skipped` + `collection-incomplete`, 복구 후 저장. 기간 끝 이후 활동은 좌표에 들어가지 않는다.
- [ ] 기존 T-2043 시나리오 (무중복 · 401 · 미설정) 무변경.
- [ ] `pnpm test:e2e` green (CI).

## Out of Scope

- 활동이 있는 좌표의 실제 저장 (fake LLM 필요), 실 GitHub · 실 LLM.

## Suggested Sub-agents

`tester`
