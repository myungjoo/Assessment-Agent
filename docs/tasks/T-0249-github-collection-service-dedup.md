---
id: T-0249
title: GitHub 수집 service + SHA earliest-wins dedup 구현 (collection slice ii)
phase: P4
status: DONE
completedAt: 2026-06-06T12:33:00+09:00
mergedAs: 69b4f8f
prNumber: 213
reviewRounds: 1
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-031]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-06-06
plannerNote: P4 collection slice (ii) — GithubInstanceClient 위 instance×org×repo 수집 service + SHA earliest-wins dedup, mocked unit R-112 (×1.5 backbone)
---

# T-0249 — GitHub 수집 service + SHA earliest-wins dedup 구현 (collection slice ii)

## Why

ADR-0029 가 Assessment collection orchestrator 설계를 박제했고 첫 slice (i)(Activity 도메인 모델 + raw→typed mapper)는 T-0248(merged 4df23ec)로 완료됐다. 본 task 는 후속 slice **(ii) = GitHub 측 수집 service** 다 — 이제껏 caller 0 였던 `GithubInstanceClient.requestAllPagesForInstance` 의 첫 production caller 를 만든다. 이 service 는 한 Person 의 GitHub instance(com/sec/ecode) × org × repo 를 enumerate 하며 commits/PRs/issues list endpoint 를 호출 → 머지된 `github-activity.mapper` 로 raw `unknown[]` → `GithubActivity[]` 변환(null 항목 skip) → SHA earliest-timestamp dedup(REQ-009 Fork/Rebase/Meld 시간적 중복 + REQ-031 재수집 중복 방지) 까지 책임진다. ADR-0029 Decision §3(orchestration 계약·skip-and-continue) + §4(commit dedup = earliest wins) 의 GitHub 부분을 구현한다. Confluence 수집은 slice (iii), module 배선은 (iv), orchestrator entry + 영속화는 (v), since 도출은 (vi)로 분리된다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §3(GitHub loop = instance×org×repo, `requestAllPagesForInstance` 재사용, per-source 독립 try/catch skip-and-continue, 기존 permission-denied emit 재사용 — orchestrator 는 새 emit 경로 미생성) + Decision §4(commit dedup = `externalId`=SHA 기준, 동일 SHA 다중 수집 시 earliest `timestamp` 1개만 유지) + Decision §7(mocked-adapter unit test 필수, live 수집 deferred)
- `src/github/github-instance-client.service.ts` — `requestAllPagesForInstance(key, path, query?): Promise<unknown[]>` / `requestForInstance` 시그니처 + 미존재/비활성 key throw 동작(수집 service 가 이 wrapper 를 mock 으로 주입받아 호출)
- `src/assessment-collection/domain/activity.ts` — `GithubActivity`(base `Activity` + `repoRef` / `kind`("commit"|"pr"|"issue")) + `ActivityMetadata` 타입 정의(수집 결과 type)
- `src/assessment-collection/domain/github-activity.mapper.ts` — raw `unknown` → `GithubActivity | null` 순수 mapper 시그니처(null = malformed skip; 본 service 가 호출하고 null 을 걸러냄)
- `src/assessment-collection/domain/github-activity.mapper.spec.ts` — colocated spec 패턴/fixture 형식 참조(본 task 의 spec 작성 시 동형 스타일)
- `docs/requirements.md` — REQ-005~008(GitHub 3 instance 활동 수집) / REQ-009(Fork/Rebase/Meld 중복 제거, earlier date 우선) / REQ-031(재수집 중복 방지)

## Acceptance Criteria

본 task 는 GitHub 수집 service 1종 + commit dedup helper(순수 함수) 1종 + 각 colocated unit spec 을 산출한다(총 4 파일 목표). 파일 위치는 ADR-0029 정합으로 `src/assessment-collection/` 하위(예: `src/assessment-collection/github-collection.service.ts` + `src/assessment-collection/domain/commit-dedup.ts`(또는 collection 하위 적절 위치) + 각 `.spec.ts`). `AssessmentCollectionModule` 정의·`app.module.ts` 배선·Confluence 수집·orchestrator entry·영속화는 본 slice 밖(Out of Scope).

- [ ] **GitHub 수집 service** — `GithubInstanceClient`(주입) 위에 instance key(com/sec/ecode) × org × repo 를 enumerate 하며 commits/PRs/issues list endpoint 를 `requestAllPagesForInstance` 로 호출하는 service 메서드(예: `collectGithubActivities(spec): Promise<GithubActivity[]>`, spec = instance/org/repo enumerate 입력). raw `unknown[]` → `github-activity.mapper` 호출 → null 항목 skip → `GithubActivity[]` 누적. dedup helper 적용 후 반환. (org/repo/instance enumerate 입력 shape 는 구현 재량 — 단 단일 Person 의 ServiceIdentity 별 GitHub 수집을 표현. since 도출은 slice (vi) 이므로 본 service 는 `since?` query 를 받아 그대로 adapter 에 pass-through 만, 도출 로직 미포함).
- [ ] **per-source skip-and-continue** — ADR-0029 §3 대로 각 instance/org/repo/endpoint 호출을 **독립 try/catch** 로 감싸 한 source 의 throw(권한 부족 4xx 등 `GithubInstanceClient`/adapter 가 throw 하는 domain error)가 다른 source 수집을 막지 않도록 skip-and-continue. orchestrator 는 새 permission-denied emit 경로를 만들지 않는다(기존 `GithubAdapter` emit 은 wrapper 내부에서 이미 발생 — 본 service 는 통과만).
- [ ] **commit dedup helper** — `GithubActivity[]` → dedup 된 `GithubActivity[]` 순수 함수. `externalId`(=commit SHA, `kind === "commit"` 한정 또는 ADR §4 대로 commit 활동) 기준으로 중복 SHA 중 **earliest `timestamp` 1개만** 유지(REQ-009 earlier date 우선). commit 외 kind(pr/issue)의 dedup 정책은 구현 결정(ADR §4 는 commit dedup 만 명시 — pr/issue 는 externalId 기준 중복 제거 또는 무중복 가정 중 택, 본문에 결정 근거 1줄). 부수효과 0 순수 함수.
- [ ] **(R-112-1) Happy-path unit test** — service 의 정상 수집 경로(`GithubInstanceClient` mock 이 fixture raw item 배열 반환 → mapper 통과 → dedup → 기대 `GithubActivity[]`) 1+ test. dedup helper 의 무중복 입력 → 그대로 반환 happy-path 1+.
- [ ] **(R-112-2) Error/negative path unit test** — (a) `GithubInstanceClient.requestAllPagesForInstance` 가 throw(권한 부족 등)할 때 해당 source skip 하고 나머지 source 결과는 반환(전체 throw 0)됨을 검증하는 test 1+. (b) mapper 가 null 반환하는 malformed raw item 이 결과에서 걸러짐 1+. (c) 빈 instance/org/repo enumerate 입력 → 빈 배열 반환 1+. (d) 모든 source 가 throw → 빈 배열 반환(전체 실패도 throw 0) 1+. 단일 negative 만 작성 금지 — 각 예외 분기마다 cover.
- [ ] **(R-112-3) Flow/branch coverage** — service 의 skip-and-continue try/catch 분기(성공/throw 경로 각각) + dedup helper 의 분기(중복 SHA earliest 선택 / 동일 timestamp tie-break / 무중복) 각 1+ test 로 branch 분리.
- [ ] **(R-112-4) negative cases 충분 cover** — dedup earliest-wins 의 핵심 분기: 같은 SHA 2건 중 (i) 첫째가 earlier, (ii) 둘째가 earlier, (iii) 동일 timestamp(tie-break 결정 명시) 각 1+ test. instance/org/repo 다중 enumerate 에서 일부만 throw 하는 부분 가용성 시나리오 1+.
- [ ] **(R-112-5) Coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] **colocated spec 위치** — spec 은 대상과 colocated: `src/assessment-collection/github-collection.service.spec.ts` + `src/assessment-collection/domain/commit-dedup.spec.ts`(파일명은 실제 산출물 경로에 맞춤). 2+ spec 공유 fixture 는 `test/helpers/` 또는 collection 하위 fixture 모듈로 추출. `GithubInstanceClient` mock 은 jest mock 주입(live 호출 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- **Confluence 수집 service**(`ConfluenceSpaceTraversalService.traverseInstance` 재사용 + `confluence-activity.mapper` + page-id/version latest dedup) — slice (iii).
- `AssessmentCollectionModule` 정의 + `app.module.ts` import 배선 — slice (iv).
- orchestrator entry `collectForPerson(person, since?)`(GitHub + Confluence 통합 진입) — slice (v).
- Activity → Contribution 영속화 / Contribution repository 호출 / Prisma — slice (v).
- **incremental "since" 도출 로직**(직전 Assessment → since 계산) — slice (vi). 본 service 는 `since?` 를 받아 query 로 pass-through 만, 도출 0.
- **live / credentialed 수집 테스트** — Q-0025 결정대로 UI 이후로 deferred. 본 slice 는 mocked `GithubInstanceClient` + fixture raw item unit test 만, 실 GitHub 호출 0 / 실 token 0.
- 기존 `GithubInstanceClient` / `GithubAdapter` / instance-config 동작 변경 — 본 slice 는 wrapper 의 반환 shape·throw 동작만 mock 으로 가정한다.
- modules.md / data-model.md 동기 갱신 — slice (vii) direct doc-sync.
- 새 외부 dependency / 새 credential / 새 DB migration — ADR-0029 대로 0(Node 내장 fetch 기반 기존 adapter + 머지된 mapper 재사용).

## Suggested Sub-agents

`implementer → tester` (수집 loop·skip-and-continue·dedup 위상은 ADR-0029 Decision §3/§4 가 이미 설계를 박제했으므로 architect 불요. enumerate 입력 shape 같은 micro 결정만 구현 재량 — ADR 결정 범위 안).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append. effort 의 후속 slice (iii)~(vii)는 T-0247 / ADR-0029 Follow-ups 에 이미 박제됨.)
