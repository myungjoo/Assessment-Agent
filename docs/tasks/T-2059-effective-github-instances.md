---
id: T-2059
title: 등록 수집 대상 실효화 ① — env 와 CollectionTarget 을 합친 GitHub 수집 대상 계산
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-070, REQ-072]
estimatedDiff: 295
estimatedFiles: 2
created: 2026-10-31
dependsOn: []
touchesFiles: [src/collection-target/effective-instances.ts, src/collection-target/effective-instances.spec.ts]
plannerNote: P7 · 등록 수집 대상 실효화 arc ① — ADR-0059 §Follow-ups (g) 병합 규칙 helper
---

# T-2059 — GitHub 수집 대상 병합

## Why

운영자가 화면에서 수집 대상을 등록 · 편집 · 비활성화해도 수집은 env 만 읽는다 (`CollectionTargetService` 소비처는 자기 controller 뿐). [ADR-0059 §Decision 3](../decisions/ADR-0059-collection-target-registration.md) 의 union + env 우선을 코드로 옮긴다.

## 판정 규칙

ADR 이 정한 것: 수집 대상 = env 결과 ∪ `active=true` row. 충돌은 같은 `(type, instanceKey)` 가 양쪽에 있을 때이고 env 가 이긴다. credential 은 env 의 `GITHUB_<KEY>_TOKEN_ENC` 에서만 읽는다.

ADR 문언에서 도출해 여기 적는 것:

| 상황 | 결과 | 근거 |
| --- | --- | --- |
| 비활성 row + 같은 key 의 env | env 로 계속 수집 | 합집합에서 row 쪽만 빠진다. "env 우선" 과 일치한다 |
| env 목록에 있으나 필수 env 부재로 reject 된 key + row | row 무시, 수집 불가 | §Alternatives "env 의 fail-fast reject 계약 우회" 금지 |
| active row + credential 부재 | 대상 아님, `listedKeys` 에는 남음 | 다음 slice 의 범위 판정이 "미설정" 이 아니라 실패로 친다 |
| 대소문자만 다른 row 2 개 | 먼저 등록된 row | `@@unique` 는 대소문자를 구분하나 env 이름 조립은 구분하지 않는다 |

## Required Reading

- ADR-0059 §Decision 2 · §Decision 3, `src/github/github-instance-config.ts`.

## Acceptance Criteria

- [ ] `mergeGithubInstances(env, rows)` 가 위 규칙을 구현한다. 진단 (`rejected`) 에 credential 값을 싣지 않는다.
- [ ] env only · DB only · 충돌 · 비활성 · credential 부재 · 빈 입력을 unit 으로 검증한다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- Confluence 병합과 범위 판정 — T-2060. 수집 경로 배선 — T-2061 · T-2062. e2e · 문서 — T-2063 · T-2064.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) 소비처 `assessCollectionCoverage` 와 Confluence 병합을 함께 넣으면 estimatedDiff 약 550 · estimatedFiles 4 로 300 LOC cap 을 넘는다. T-2060 이 `src/assessment-collection/collection-spec.service.ts` 의 `assessCollectionCoverage` 에서 소비한다.
