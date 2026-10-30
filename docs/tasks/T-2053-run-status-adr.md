---
id: T-2053
title: 불완전 수집 저장 차단 ④ — ADR-0060 에 마지막 평가 실행 요약 계약 추가
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-083]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-10-30
dependsOn: [T-2052]
touchesFiles: [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md]
plannerNote: P7 · 불완전 수집 저장 차단 arc ④ — 코드보다 ADR 먼저, 구현 T-2054 가 5 파일 cap 을 채워 분리
---

# T-2053 — run status 계약

## Why

[T-2052](T-2052-partial-collection-no-save.md) 로 건너뛴 좌표는 로그에만 남는다. 운영자가 run status 로 볼 수 있어야 한다. 기존 필드 (`active` · `runningCount` · `startedAt` · `observedAt`) 는 "지금 실행 중인가" 만 말하므로 끝난 실행의 결과를 표현할 수 없다. 응답 계약이 바뀌므로 ADR 을 먼저 고친다. DB schema 변경은 승인 범위가 아니고 필요도 없다.

## Required Reading

- `docs/decisions/ADR-0060-evaluation-run-status-endpoint.md` §Decision 1~3 · §Consequences (c).

## Acceptance Criteria

- [ ] §Decision 6 에 `lastEvaluationRun` 필드 표, `personId` 공개 범위, 다중 인스턴스 한계를 적는다.
- [ ] 코드 변경 0. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- 구현 — T-2054. runner · controller 호출 — T-2056. `api.md` 는 T-2056 후 direct doc-sync.

## Suggested Sub-agents

`architect`

## Follow-ups

- web 화면에 불완전 좌표 표시 (담당 미정, 이번 범위 밖).
