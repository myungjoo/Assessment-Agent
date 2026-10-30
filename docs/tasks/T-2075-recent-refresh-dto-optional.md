---
id: T-2075
title: 최근 N일 재수집 ⑦ — DTO 의 instants 를 선택으로 바꿔 web 이 보내지 않게 준비
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 2c71dada
prNumber: 1636
reviewRounds: 2
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 40
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2074]
touchesFiles: [src/scheduling/dto/recent-deletion.dto.ts, src/scheduling/dto/recent-deletion.dto.spec.ts, src/scheduling/recent-deletion.controller.spec.ts, web/src/views/AdminView.recent-deletion-contract.test.ts, docs/architecture/api.md]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑦. 설계 결정은 T-2069
---

# T-2075 — instants 선택화

## Why

서버가 대상을 찾으므로 `instants` 는 쓰이지 않지만 아직 필수다. 먼저 선택으로 바꿔 web 이 보내지 않아도 되게 하고, web 전환 뒤 제거한다.

## Required Reading

- T-2069 "설계 결정", `src/scheduling/dto/recent-deletion.dto.ts`.

## Acceptance Criteria

- [ ] `instants` 없이 `{ days }` 만으로 202 다. 보내면 형식만 검증하고 무시한다.
- [ ] web 계약 guard 가 "필수 필드 없음 · days optional" 을 고정하고, 추후 instants 제거에도 수정이 필요 없다.
- [ ] `api.md` POST 설명이 맞다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- web 본문 변경 (T-2077), `instants` 완전 제거 (T-2079).
