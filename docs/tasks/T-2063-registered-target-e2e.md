---
id: T-2063
title: 등록 수집 대상 실효화 ⑤ — API 등록 대상의 수집 반영 e2e
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 0e90f8f4
prNumber: 1624
reviewRounds: 1
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-070, REQ-072]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-10-31
dependsOn: [T-2062]
touchesFiles: [test/e2e/collection-target-effective.e2e-spec.ts]
plannerNote: P7 · 등록 수집 대상 실효화 arc ⑤ — 실 HTTP · 실 DB 로 고정
---

# T-2063 — e2e

## Why

앞선 slice 는 unit 으로 검증됐다. API 로 등록한 대상이 실제 호출로 이어지고, 비활성화 · 실패가 저장 판정까지 가는지 실 경로로 고정한다.

## Required Reading

- `test/e2e/schedules-cron.e2e-spec.ts` 실 평가 실행 절, [T-2060](T-2060-coverage-registered-targets.md), [T-2062](T-2062-collection-spec-registered-targets.md).

## Acceptance Criteria

- [ ] API 등록 → 재기동 없이 fake host 호출 (env token) · 저장. PATCH 비활성화 → 다음 수집에서 호출 0 · 저장 0.
- [ ] env 와 등록 대상 동시 수집. 비활성 대상의 식별자는 env 대상의 저장을 막지 않는다 (T-2062 에서 unit 을 뺀 자동 평가 경로).
- [ ] 충돌 시 env host 로만 호출. row 를 비활성화해도 env 는 계속 수집한다 (T-2062 에서 unit 을 뺀 GitHub 충돌).
- [ ] 등록 대상 호출 실패 → 좌표 비움, 복구 후 저장.
- [ ] credential 부재 → 호출 0, 다른 대상이 있어도 저장 0 (T-2062 에서 unit 을 뺀 GitHub credential 부재). 복호 불가 credential → 저장 0.
- [ ] 등록 Confluence 대상 호출 · 실패 · 복구.
- [ ] `pnpm test:e2e` green (CI). 로컬 DB 가 없어 로컬 실행은 하지 않는다.

## Out of Scope

- 활동이 있는 좌표의 저장 (fake LLM 필요), 실 GitHub · 실 Confluence · 실 LLM. 문서 — T-2064.

## Suggested Sub-agents

`tester`

## Follow-ups

- (리뷰 MINOR, 파일 300 행 cap) 충돌 시나리오에 row repo · token 미혼입 단언, credential 시나리오에 `incompleteCount` 단언을 더하면 실패 원인까지 고정된다. 지금은 같은 파일의 다른 test 와 T-2060 unit 이 보호한다.
