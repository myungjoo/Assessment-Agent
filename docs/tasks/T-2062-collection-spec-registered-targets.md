---
id: T-2062
title: 등록 수집 대상 실효화 ④ — 수집 spec 조립이 등록 대상을 쓴다
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-070, REQ-072]
estimatedDiff: 256
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2061]
touchesFiles: [src/assessment-collection/collection-spec.service.ts, src/assessment-collection/collection-spec.service.spec.ts, src/assessment-collection/github-collection-spec.service.ts, src/assessment-collection/github-collection-spec.service.spec.ts, src/assessment-collection/assessment-collection.module.ts]
plannerNote: P7 · 등록 수집 대상 실효화 arc ④ — 실제 동작이 바뀌는 slice
---

# T-2062 — 수집 spec 배선

## Why

앞선 slice 는 병합 · 판정 · 호출을 준비했을 뿐 production 동작을 바꾸지 않았다. 이 slice 가 `GithubCollectionSpecService` 와 `CollectionSpecService` 에 등록 row 를 넣어, 등록 · 비활성화가 다음 수집부터 반영되게 한다.

## 결정

- 두 service 가 매 호출 `CollectionTargetReader.findAll()` 을 읽는다. 캐시가 없어 재기동 없이 반영된다. table 이 비면 결과는 env 와 같다 (ADR-0059 §Decision 3).
- `buildCollectionSpecWithCoverage` 는 spec 과 범위 판정에 같은 row 를 넘긴다.
- DB 조회 실패는 전파한다. 대상을 알 수 없으므로 빈 수집으로 흡수하면 안 된다. tick 은 좌표 단위 catch 로 `failedCount` 에 세고 좌표는 비어 있다.

## 다른 호출처 판정

| 위치 | 판정 |
| --- | --- |
| `github-instance-client.service.ts` | merged (T-2061) |
| `collection-spec.service.ts` · `github-collection-spec.service.ts` | merged (이 task) |
| `domain/author-filter.ts` | 호출 없음 (주석). key 문자열 비교라 DB 전용 key 도 그대로 귀속된다 |
| `confluence-collection.service.ts` · `confluence-space-traversal.service.ts` | 호출 없음 (주석). spec 의 config 를 그대로 받는다 |
| `confluence.module.ts` `CONFLUENCE_INSTANCES` provider | env only 유지. 부팅 시 계산되는 값이고 주입처가 0 이다 |
| `create-service-identity.dto.ts` | allowlist 없음 (형식만). DB 전용 key 식별자를 받는다 |

## Required Reading

- [T-2060](T-2060-coverage-registered-targets.md), `src/assessment-collection/collection-spec.service.ts`, `github-collection-spec.service.ts`.

## Acceptance Criteria

- [ ] DB 전용 대상이 mode A · mode B 로 spec 에 들어가고, 비활성 · credential 부재는 빠지며, 충돌 시 env 좌표를 쓴다.
- [ ] Confluence 도 같다. `WithCoverage` 는 credential 부재 대상을 실패로, 비활성 대상을 무시로 판정한다.
- [ ] 매 호출 DB 를 다시 읽고, DB 실패는 전파한다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI (unit · smoke · e2e) green.

## Out of Scope

- 실 HTTP 검증 — T-2063. 문서 — T-2064.

## Suggested Sub-agents

`implementer → tester`
