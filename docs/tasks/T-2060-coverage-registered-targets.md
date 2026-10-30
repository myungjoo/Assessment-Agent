---
id: T-2060
title: 등록 수집 대상 실효화 ② — Confluence 병합과 범위 판정에 등록 대상 반영
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 8df7d2be
prNumber: 1621
reviewRounds: 3
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-070, REQ-072]
estimatedDiff: 296
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2059]
touchesFiles: [src/collection-target/effective-instances.ts, src/collection-target/effective-instances.spec.ts, src/assessment-collection/collection-spec.service.ts, src/assessment-collection/collection-spec.service.spec.ts]
plannerNote: P7 · 등록 수집 대상 실효화 arc ② — T-2051 판정 규칙이 등록 대상을 알게 한다
---

# T-2060 — 범위 판정

## Why

[T-2051](T-2051-collection-coverage-rule.md) 판정은 env 목록에 없는 key 를 "미설정" 으로 무시한다. 등록 대상이 수집되기 시작하면 그 대상의 실패가 "미설정" 으로 묻혀 불완전한 좌표가 저장된다. 수집 배선 (T-2061 · T-2062) 전에 판정부터 고친다.

## 판정 규칙 (T-2051 표에 더함)

| 식별자의 key 상태 | 판정 | 이유 |
| --- | --- | --- |
| active row 로 등록됐고 쓸 수 있다 | 다른 수집 대상과 같다 | 호출 실패는 tally 로 실패가 된다 |
| active row 로 등록됐고 credential · endpoint · repo / org / SPACE 대상이 없다 | 실패 | 수집 대상인데 수집하지 못한다. 좌표를 비워 둔다 |
| 비활성 row 만 있다 | 무시 (실패 아님) | 운영자가 제외한 대상이다. 이를 실패로 치면 그 식별자를 가진 인원의 다른 instance 평가까지 막힌다 |
| 비활성 row + 같은 key 의 env | env 기준으로 판정 | env 우선 (T-2059) |

식별자가 비활성 대상뿐이면 수집 가능한 식별자가 0 이라 기존 규칙대로 실패다. 비활성 대상이 있는 인원의 저장본에는 그 대상의 활동이 빠진다. 운영자의 제외 결정이므로 수용한다.

T-2051 의 알려진 한계는 env 목록에서 지운 key 에 그대로 남는다. 등록 대상은 row 를 지우면 같은 상황이고, 일시 제외는 비활성으로 구분된다.

## Required Reading

- [T-2051](T-2051-collection-coverage-rule.md), [T-2059](T-2059-effective-github-instances.md), `src/assessment-collection/collection-spec.service.ts` `assessCollectionCoverage`.

## Acceptance Criteria

- [ ] `mergeConfluenceInstances(env, rows)` 가 GitHub 과 같은 규칙으로 동작하고 `_AUTH_USER` 도 env 에서 읽는다.
- [ ] `assessCollectionCoverage(identities, env, targets = [])` 가 위 표를 구현한다. `targets` 생략 시 기존 동작이다.
- [ ] 기존 T-2051 test 무변경 통과.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- DB 읽기와 수집 경로 배선 — T-2061 · T-2062. 이 PR 뒤에도 production 은 `targets` 를 넘기지 않아 동작 변화가 없다.

## Suggested Sub-agents

`implementer → tester`
