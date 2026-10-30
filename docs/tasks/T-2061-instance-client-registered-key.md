---
id: T-2061
title: 등록 수집 대상 실효화 ③ — GithubInstanceClient 가 등록 대상의 key 를 해석한다
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 61dec7b0
prNumber: 1622
reviewRounds: 2
commitMode: pr
coversReq: [REQ-070, REQ-072]
estimatedDiff: 259
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2060]
touchesFiles: [src/collection-target/collection-target-reader.service.ts, src/collection-target/collection-target-reader.service.spec.ts, src/github/github-instance-client.service.ts, src/github/github-instance-client.service.spec.ts, src/github/github.module.ts]
plannerNote: P7 · 등록 수집 대상 실효화 arc ③ — 수집 호출의 credential 해석
---

# T-2061 — client 의 등록 key 해석

## Why

GitHub 수집 호출은 source 의 `instanceKey` 만 들고 `GithubInstanceClient` 로 간다. client 가 env 만 보면 등록 대상의 source 는 호출 단계에서 전부 실패한다. spec 조립 (T-2062) 보다 먼저 client 가 그 key 를 해석해야 한다. Confluence 는 config 를 통째로 넘기므로 해당 없다.

## 결정

- `CollectionTargetReader` 신설. `@Global` PrismaService 만 의존해 GithubModule 이 AssessmentCollectionModule 을 거꾸로 import 하지 않는다. 캐시 없음.
- client 는 env 를 먼저 보고, 없을 때만 DB 를 읽어 `mergeGithubInstances` 결과에서 찾는다. env 전용 배포의 호출 경로에 DB round-trip 이 늘지 않는다.
- reader 는 필수 생성자 의존이다. `@Optional` 이면 DI 누락이 조용히 env-only 로 떨어진다.

## Security 판단 근거

CLAUDE.md §5 security 게이트: credential 저장 위치와 복호 시점은 그대로다 (env, JIT, ADR-0014). 변경은 그 credential 을 어느 host 로 보낼지를 row 가 정하는 것이고, 이는 owner 가 이 feature 지시에서 범위로 명시하고 진행을 지시했다 (2026-10-31). 남는 위험은 [T-2059](T-2059-effective-github-instances.md) Follow-ups 와 같고 arc 보고에서 owner 에게 올린다.

## Required Reading

- `src/github/github-instance-client.service.ts`, `src/collection-target/effective-instances.ts`, `src/assessment-collection/github-collection.service.ts`.

## Acceptance Criteria

- [ ] DB 전용 key 는 row 의 host 와 env token 으로 호출한다. env 에서 찾으면 DB 를 읽지 않는다.
- [ ] 충돌 시 env host, reject 된 env key · 비활성 row · credential 부재 · row 부재는 throw.
- [ ] 복호 실패 · DB 실패는 전파되고 token 이 오류에 실리지 않는다. 호출자 (`GithubCollectionService`) 는 이를 tally 실패로 센다.
- [ ] row 변경이 다음 요청에 반영된다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- spec 조립 배선 — T-2062. e2e · 문서 — T-2063 · T-2064.

## Suggested Sub-agents

`implementer → tester`
