---
id: T-2066
title: 등록 수집 대상 허용 host ② — 수집 경로 배선
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-072]
estimatedDiff: 270
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2065]
touchesFiles: [src/collection-target/effective-instances.ts, src/collection-target/effective-instances.spec.ts, src/assessment-collection/collection-spec.service.spec.ts, src/assessment-collection/github-collection-spec.service.spec.ts, src/github/github-instance-client.service.spec.ts]
plannerNote: P7 · ADR-0059 §Consequences (e) 봉합 arc ② — 실제 enforcement
---

# T-2066 — 수집 경로 배선

## Why

T-2065 의 판정을 등록 row 합성 지점에 건다. 모든 수집 경로 (자동 평가 · `POST /collect` · `POST /period` · `GithubInstanceClient`) 가 `mergeGithubInstances` / `mergeConfluenceInstances` 를 거치므로 이 한 곳이 enforcement 다.

## Required Reading

- [T-2065](T-2065-target-host-guard-helper.md), [T-2060](T-2060-coverage-registered-targets.md), ADR-0059 §Decision 3.

## Acceptance Criteria

- [ ] 거부된 row 는 instances 에서 빠지고 token 을 복호하지 않는다. listedKeys 에 남아 `assessCollectionCoverage` 가 실패로 친다 ("미설정" 으로 내려가지 않는다).
- [ ] 통과 row 는 정규화 값을 host / baseUrl 로 쓴다.
- [ ] 거부는 type · key · 사유로 로그에 남고 token · endpoint 원문은 남지 않는다. 같은 사유는 반복 기록하지 않는다.
- [ ] env 정의 대상의 동작은 그대로다 (http Confluence 포함).
- [ ] 기존 등록 대상 unit 의 env 에 허용 host 를 넣어 의도를 유지한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- `rejected` 진단의 API 노출, 등록 · 수정 시점 검증. e2e — T-2067. redirect · 문서 — T-2068.

## Follow-ups

- 등록 · 수정 시점의 형식 검증 (https · userinfo). 허용 host 일치 여부를 응답에 내면 env 존재를 알리는 oracle 이 되므로 형식만 가능하다. 화면 피드백이 필요할 때 owner 판단.
