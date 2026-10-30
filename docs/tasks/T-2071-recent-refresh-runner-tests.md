---
id: T-2071
title: 최근 N일 재수집 ③ — runner 분기별 unit test 와 종료 중 시작 거부
phase: P7
status: READY
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-10-31
dependsOn: [T-2070]
touchesFiles: [src/scheduling/recent-deletion-runner.service.ts, src/scheduling/recent-deletion-runner.service.spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ③. T-2070 이 cap 때문에 미룬 test 회수. 설계 결정은 T-2069
---

# T-2071 — runner 분기 test

## Why

T-2070 은 300 LOC cap 때문에 핵심 경로 test 만 넣었다. PR #1631 리뷰가 빠뜨리면 안 되는 분기를 적어 두었다. 이것을 회수한다. 리뷰 NIT 대로 앱 종료 중의 시작도 거부한다.

## Required Reading

- T-2069 "설계 결정", PR #1631 리뷰 코멘트.

## Acceptance Criteria

- [ ] 실행 전 throw (days `RangeError` · 인원 부재), 409 두 경로, 실행이 늘지 않음을 고정한다.
- [ ] throw 좌표 후 계속 진행, 식별자 없는 인원의 저장 0 건, 창 밖 row 미접근, 진행 중 row 집계를 고정한다.
- [ ] 모델 조회 실패 시 `aborted`, 앱 종료 후 남은 좌표 집계, 종료 중 시작 거부를 고정한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- controller 전환 · 기존 `runRecentDeletion` 제거 (T-2072).

## Follow-ups

- T-2072: controller 를 `startRefresh` 로 옮기고 GET 상태 route 를 추가하고 `runRecentDeletion` 을 제거한다.
- (owner, PR #1631 리뷰 MINOR) `assessCollectionCoverage` 는 목록에 없는 instance 의 식별자를 실패로 치지 않고, 쓸 수 있는 GitHub instance 가 하나라도 있으면 완전으로 판정한다 (T-2051 규칙). fill 에서는 빈 좌표만 채우므로 영향이 작았지만, 재수집은 이 판정으로 기존 row 를 교체한다. 그래서 instance 하나를 설정에서 빼거나 비활성화한 채 재수집하면 그 instance 활동이 빠진 평가가 이전 row 를 대체할 수 있다. 재수집에 더 엄격한 판정을 쓸지는 오너 판단이다.
