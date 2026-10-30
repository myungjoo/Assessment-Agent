---
id: T-2051
title: 불완전 수집 저장 차단 ② — 식별자 기준 수집 범위 판정 규칙과 org 열거 실패 전달
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: ef010b7f
prNumber: 1612
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-039]
estimatedDiff: 294
estimatedFiles: 4
created: 2026-10-30
dependsOn: [T-2050]
touchesFiles: [src/assessment-collection/collection-spec.service.ts, src/assessment-collection/collection-spec.service.spec.ts, src/assessment-collection/github-collection-spec.service.ts, src/assessment-collection/github-collection-spec.service.spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ② — "미설정" 의 의미를 규칙으로 고정
---

# T-2051 — 수집 범위 판정

## Why

일부 GitHub · Confluence instance 나 org 가 미설정이거나 열거에 실패하면 호출 실패로 집계되지 않아 ([T-2042](T-2042-collection-blank-row-guard.md) Follow-ups) 무활동 좌표에 빈 평가가 저장된다. 실제 상태를 모르는데 first-write-wins 로 영구히 남는다. 무엇이 "실패" 인지부터 정한다.

## 판정 규칙 (정본)

인원의 `ServiceIdentity.service` key 별로 판정한다. 코드 정본은 `assessCollectionCoverage`.

| 식별자의 key 상태 | 판정 | 이유 |
| --- | --- | --- |
| `GITHUB_INSTANCES` · `CONFLUENCE_INSTANCES` 어디에도 없다 | 무시 (실패 아님) | 운영자가 올린 적 없는 instance 는 수집 대상이 아니다. 이를 실패로 치면 그 식별자를 가진 인원의 다른 instance 평가까지 영원히 막힌다 |
| 목록에 있고 필수 env 가 빠졌다 | 실패 | 수집 대상인데 수집하지 못했다 |
| 목록에 있고 repo · org · SPACE 대상이 0 이다 (해석 불가 repo token 1 개 이상 포함) | 실패 | 위와 같다 |
| 쓸 수 있고 org 열거 · 수집 호출이 실패했다 | 실패 | 위와 같다 |
| 쓸 수 있고 호출이 모두 성공했다 | 완전 | 빈 org · 활동 0 건도 사실이므로 저장한다 |

추가 조건 2 개:

- 수집 가능한 식별자가 하나도 없으면 실패다.
- 목록에 없는 key 가 있고 쓸 수 있는 GitHub instance 가 하나도 없으면 실패다. `GITHUB_INSTANCES` 전체 유실과 구분되지 않으며, T-2042 의 `githubMissing` 보호를 유지한다.

식별자가 없는 instance 의 상태와 장애는 그 인원과 무관하다. 귀속이 instance 단위 (`filterActivitiesByAuthor`) 라 결과에 영향이 없으므로, Confluence 도 식별자가 있는 instance 만 수집한다.

알려진 한계: 일부 instance key 를 env 목록에서 통째로 지우면 "올린 적 없음" 과 구분되지 않는다. DB 수집 대상 (다음 feature) 에서 다시 본다.

## Required Reading

- `src/assessment-collection/collection-spec.service.ts`, `github-collection-spec.service.ts`, `domain/github-repo-source.ts`, `domain/author-filter.ts`.

## Acceptance Criteria

- [ ] `assessCollectionCoverage` 가 위 규칙을 구현하고 코드 주석에 규칙을 적는다. 규칙 양쪽 (무시 · 실패) 을 unit 으로 검증한다.
- [ ] `buildCollectionSpecWithCoverage` 는 org 열거 실패도 미달로 치고 Confluence 를 식별자 있는 instance 로 제한한다.
- [ ] 기존 `buildCollectionSpec` 호출 · 반환은 그대로다.
- [ ] R-112: happy · error · 분기 · 예외 분기 negative.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- 저장 판정 소비 — T-2052. DB 수집 대상.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) T-2052 가 `period-bridge-admin-persist.service.ts` 에서 `buildCollectionSpecWithCoverage` 를 소비한다. 함께 넣으면 estimatedFiles 6 · estimatedDiff 433 으로 cap 을 넘는다.
