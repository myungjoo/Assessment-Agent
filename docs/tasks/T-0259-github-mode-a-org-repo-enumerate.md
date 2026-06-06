---
id: T-0259
title: ADR-0030 §1 enumerate slice ii-b1 — mode A org→repo async enumerate(orgEnumerateTargets → GithubRepoSource[])
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-06-06
plannerNote: "P4 ADR-0030 §1 cap-split slice ii-b1 — mode A(빈 allowlist) org→repo async enumerate. T-0258 orgEnumerateTargets 소비. buildCollectionSpec 조립은 ii-b2."
---

# T-0259 — ADR-0030 §1 enumerate slice ii-b1 — mode A org→repo async enumerate(orgEnumerateTargets → GithubRepoSource[])

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`)는 (i) `_REPOS` env parser(T-0257 머지), (ii-a) mode B allowlist 순수 매칭(T-0258 머지, `resolveGithubRepoSources` → `{ sources, orgEnumerateTargets }`), 그리고 본 task 가 다루는 **mode A(빈 allowlist) org 전체 repo 런타임 enumerate** + **전체 `buildCollectionSpec` 조립** 으로 나뉜다. mode A enumerate + buildCollectionSpec 을 한 task 에 넣으면 cap(300 LOC / 5 파일)을 명백히 초과하므로(async enumerate service + raw repo-list mapper + R-112 매트릭스 ≈ 270 LOC, buildCollectionSpec 조립 + Confluence resolve + R-112 ≈ 270 LOC), dependency-first 로 다시 쪼갠다. 본 task(ii-b1)는 **mode A enumerate 단독** — T-0258 이 노출한 `GithubOrgEnumerateTarget[]`(`{instanceKey, org, since?}`)를 받아, 각 target 에 대해 `GithubInstanceClient.requestAllPagesForInstance(instanceKey, "orgs/{org}/repos")` 로 repo 목록을 런타임 enumerate 하고 `GithubRepoSource[]`(`{instanceKey, org, repo, since?}`)로 산출한다(ADR-0030 §1 모드 A fallback). 전체 `buildCollectionSpec(person, since?)` 조립(mode B + mode A 결합 + Confluence `resolveConfluenceInstances` + `CollectionSpec` 조립)은 본 task 의 출력을 소비하는 후속 slice ii-b2 책임이다. README L15-18 의 "지정 Organization 내 전체 Repository"(=mode A)와 REQ-005~008(GitHub 활동 수집 + 권한 부족 통지)을 cover 한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §1(repo source 정책: 모드 A = 빈 allowlist → `requestAllPagesForInstance("orgs/{org}/repos")` 런타임 enumerate fallback + 4xx skip-and-continue), §2(author 귀속은 enumerate 밖), §5(cap 분할), §6(testing — negative 목록: org repo enumerate 4xx skip / since pass-through).
- `src/assessment-collection/domain/github-repo-source.ts` — T-0258 산출물. `GithubOrgEnumerateTarget {instanceKey, org, since?}` + `GithubRepoSourceResolution {sources, orgEnumerateTargets}` 가 본 task 의 **입력 타입**. 본 task 는 `orgEnumerateTargets` 를 소비해 `GithubRepoSource[]` 를 채운다.
- `src/assessment-collection/github-collection.service.ts` L50-66 — `GithubRepoSource {instanceKey, org, repo, since?}`(본 task 의 산출 타입) + per-source skip-and-continue 패턴(독립 try/catch swallow)의 참고 구현.
- `src/github/github-instance-client.service.ts` L73-83 — `requestAllPagesForInstance(key, path, query?): Promise<unknown[]>` 시그니처. 본 task 가 호출(mock 주입). path = `orgs/{org}/repos`.
- `src/assessment-collection/domain/github-activity.mapper.ts` L24-50 — raw `unknown` 방어적 추출(`isRecord` / `readString` type-guard) 순수 mapper 패턴 + null-skip 규약(malformed item → null, throw 0). 본 task 의 repo-name mapper 가 동형 패턴을 따른다.
- `src/assessment-collection/domain/commit-dedup.ts` — `domain/` 순수 함수 + colocated spec 의 코드 스타일·주석 톤 참고(본 task 의 repo-name mapper 도 `domain/` 에 둔다).

## Acceptance Criteria

본 task 의 산출물은 (1) `src/assessment-collection/domain/github-repo-list.mapper.ts`(raw `orgs/{org}/repos` 응답 item → repo 이름 추출 순수 함수) + colocated spec, (2) `src/assessment-collection/github-org-repo-enumerate.service.ts`(async enumerate service) + colocated spec 이다.

- [ ] **repo-name mapper(순수)**: `domain/github-repo-list.mapper.ts` 에 `mapRepoName(raw: unknown): string | null` 류 순수 함수 추가 — GitHub `orgs/{org}/repos` list item 의 repo 이름(`name` 필드, 필요 시 `full_name` fallback)을 type-guard(`isRecord`/string 검사)로 안전 추출. malformed/누락 item 은 `null` 반환(throw 0 — `github-activity.mapper.ts` 의 null-skip 규약 mirror). 부수효과 0 / 외부 의존 0.
- [ ] **enumerate service(async)**: `GithubOrgEnumerateService`(또는 동등명) class 를 `@Injectable` 로 `github-org-repo-enumerate.service.ts` 에 추가. `GithubInstanceClient` 를 생성자 주입. `enumerateRepoSources(targets: GithubOrgEnumerateTarget[]): Promise<GithubRepoSource[]>` 류 메서드가 각 target 에 대해 `requestAllPagesForInstance(target.instanceKey, "orgs/{org}/repos")` 호출 → raw `unknown[]` → `mapRepoName` 으로 repo 이름 추출(null skip) → 각 repo 를 `{instanceKey, org, repo, since}` source 로 변환. `since` 는 target 의 값 그대로 pass-through(도출 0).
- [ ] **per-target skip-and-continue(ADR-0030 §1)**: 각 target 호출을 **독립 try/catch** 로 감싼다. 한 target 의 throw(권한 부족 4xx 등 client/adapter domain error)가 다른 target enumerate 를 막지 않도록 skip 하고 계속(부분 가용성 우선). 본 service 는 새 permission-denied emit 경로를 만들지 않는다(기존 adapter emit 재사용 — wrapper 가 throw 한 error 를 swallow 만).
- [ ] happy-path test 1+: 2 target × 각 N repo 응답 → 올바른 `GithubRepoSource[]`(instanceKey/org/repo/since 정확) 산출 + `requestAllPagesForInstance` 가 `orgs/{org}/repos` path 로 호출됨을 mock 으로 검증.
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 + 분기마다 cover): (a) 한 target 이 throw(4xx) → 그 target skip, 나머지 target 의 source 는 보존(skip-and-continue), (b) 빈 targets 배열 → 빈 결과(throw 0, client 호출 0), (c) raw item 중 malformed(name 누락/비-string) → 그 repo skip 나머지 유지(mapper null), (d) org 의 repo 응답이 빈 배열 → 그 target source 0, (e) since 미지정(undefined) target → 산출 source 의 since 도 undefined, (f) since 지정 target → 산출 source 에 since pass-through.
- [ ] **mapper 단독 spec(colocated)**: `domain/github-repo-list.mapper.spec.ts` 에 happy(정상 name 추출) + negative(null/비객체/배열/name 누락/빈 문자열/full_name fallback) 분기 cover.
- [ ] flow/branch cover: try(성공) vs catch(skip) 분기 / mapper null skip vs 정상 분기 / 빈 targets early-return 분기 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: mapper 는 `src/assessment-collection/domain/github-repo-list.mapper.spec.ts`, service 는 `src/assessment-collection/github-org-repo-enumerate.service.spec.ts`(NestJS convention + 기존 collection slice 의 colocated 패턴 정합). client 는 jest mock 객체 literal 로 주입(공유 helper 불요 — 단일 spec).

## Out of Scope

- **전체 `buildCollectionSpec(person, since?)` 조립** — mode B(`resolveGithubRepoSources` sources) + mode A(본 task enumerate 결과) 결합 + Confluence `resolveConfluenceInstances(env)` + `CollectionSpec` 조립은 slice ii-b2(후속). 본 task 는 mode A enumerate 단독으로 `GithubRepoSource[]` 만 산출하고 `CollectionSpec` 을 조립하지 않는다.
- **`collectForPerson` 진입 + 영속화 결선(`collectAndPersist`) + author 필터(`Activity.author === externalId`)** — slice iii. 본 task 는 author 귀속/필터를 다루지 않는다(repo source enumerate 만).
- **mode B allowlist 매칭** — T-0258(`resolveGithubRepoSources`)에서 완결. 본 task 는 그 함수가 노출한 `orgEnumerateTargets` 만 소비.
- **Confluence instance enumerate** — slice ii-b2/iii.
- **since 도출(직전 Assessment → since)** — slice vi(ADR-0029 §5). 본 task 는 since 를 주입받아 pass-through 만.
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. 본 task 는 mock 주입 `GithubInstanceClient` 위에서만 unit-test(실 fetch 0 / 실 token 0).
- **module 배선 / DI provider 등록** — enumerate service 를 `AssessmentCollectionModule` provider 로 등록하는 배선은 본 task 가 service class·spec 만 추가하고, provider/export 등록은 ii-b2(buildCollectionSpec service 화 시) 또는 별도 micro-slice 로 둔다(본 task 의 spec 은 `Test.createTestingModule` 로 service + mock client 만 wiring). 단 enumerate service 가 standalone provider 로 즉시 등록 가능하면 그 1 줄 등록은 본 task 에 포함해도 무방(cap 내 — 구현 판단, 단 module spec 회귀는 추가 비용이므로 reviewer 와 정합).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
