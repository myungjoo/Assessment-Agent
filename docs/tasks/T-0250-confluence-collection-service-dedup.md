---
id: T-0250
title: Confluence 수집 service + page-id/version latest-wins dedup 구현 (collection slice iii)
phase: P4
status: DONE
completedAt: 2026-06-06T13:01:00+09:00
mergedAs: 19cdde2
prNumber: 214
reviewRounds: 1
commitMode: pr
coversReq: [REQ-015, REQ-010, REQ-031]
estimatedDiff: 225
estimatedFiles: 4
created: 2026-06-06
plannerNote: P4 collection slice (iii) — ConfluenceSpaceTraversalService 위 instance×SPACE 수집 service + (page-id,version) latest-wins dedup, mocked unit R-112 (×1.5 backbone)
---

# T-0250 — Confluence 수집 service + page-id/version latest-wins dedup 구현 (collection slice iii)

## Why

ADR-0029 가 Assessment collection orchestrator 설계를 박제했고, slice (i) Activity 도메인 모델 + raw→typed mapper(T-0248 merged 4df23ec) → slice (ii) GitHub 수집 service + SHA earliest-wins dedup(T-0249 merged 69b4f8f)이 완료됐다. 본 task 는 후속 slice **(iii) = Confluence 측 수집 service** 로, T-0249(GitHub) 의 구조를 정확히 mirror 한다 — 이제껏 caller 0 였던 `ConfluenceSpaceTraversalService.traverseInstance` 의 첫 production caller 를 만든다. 이 service 는 한 Person 의 Confluence instance × SPACE allowlist 를 instance 단위로 enumerate 하며 `traverseInstance(config)` 를 호출 → 머지된 `mapConfluenceActivity` 로 SpaceTraversalResult 의 raw `pages: unknown[]` → `ConfluenceActivity` 변환(null 항목 skip) → `(page-id, version)` 기준 latest-version-wins dedup(REQ-015 지정 SPACE 문서 활동 + REQ-010 중복 제거 + REQ-031 재수집 중복 방지) 까지 책임진다. ADR-0029 Decision §3(Confluence loop = instance×SPACE, `traverseInstance` 재사용, per-source skip-and-continue) + §4(Confluence dedup = page-id+version latest 유지) + §7(mocked-adapter unit 필수, live 수집 deferred) 의 Confluence 부분을 구현한다. module 배선은 slice (iv), orchestrator entry + 영속화는 (v), since 도출은 (vi)로 분리된다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §3(Confluence loop = instance × SPACE allowlist 순회는 `ConfluenceSpaceTraversalService` 내부 책임이므로 orchestrator 는 instance loop 만 추가, per-source 독립 try/catch skip-and-continue, SPACE 단위 4xx skip+emit 은 traversal service 가 이미 보유 — 본 service 는 새 emit 경로 미생성) + Decision §4(Confluence dedup = `(page-id, version)` 기준, 같은 page-id 의 여러 version 수집 시 latest version 1개만 유지) + Decision §7(mocked-adapter unit test 필수, live 수집 deferred)
- `src/confluence/confluence-space-traversal.service.ts` — `traverseInstance(config: ConfluenceInstanceConfig): Promise<SpaceTraversalResult[]>` 시그니처 + `SpaceTraversalResult { spaceKey: string; pages: unknown[] }` 반환 shape(수집 service 가 이 service 를 mock 으로 주입받아 호출, raw `pages` 를 mapper 에 흘림) + SPACE 단위 4xx skip+emit 이 내부 책임임을 확인
- `src/assessment-collection/domain/activity.ts` — `ConfluenceActivity`(base `Activity` + `spaceRef` / `version: number`) + `ActivityMetadata` 타입 정의(수집 결과 type) + `Activity` discriminated union
- `src/assessment-collection/domain/confluence-activity.mapper.ts` — `mapConfluenceActivity(raw: unknown): ConfluenceActivity | null` 순수 mapper 시그니처(null = 필수 식별 필드(page-id/author/timestamp/version) 누락 시 malformed skip; 본 service 가 호출하고 null 을 걸러냄)
- `src/assessment-collection/github-collection.service.ts` + `src/assessment-collection/domain/commit-dedup.ts` — slice (ii) 의 GitHub 측 구현(본 task 가 mirror 할 구조 템플릿 — service 의 instance loop + per-source try/catch skip-and-continue + mapper 호출 + null filter + dedup helper 적용 패턴, dedup helper 의 순수 함수 형식)
- `src/assessment-collection/github-collection.service.spec.ts` + `src/assessment-collection/domain/commit-dedup.spec.ts` — colocated spec 패턴/fixture 형식 참조(본 task 의 spec 작성 시 동형 스타일·mock 주입 방식)
- `docs/requirements.md` — REQ-015(Confluence 지정 SPACE 문서 활동 수집) / REQ-010(시간적/구조적 중복 제거) / REQ-031(재수집 중복 방지)

## Acceptance Criteria

본 task 는 Confluence 수집 service 1종 + page dedup helper(순수 함수) 1종 + 각 colocated unit spec 을 산출한다(총 4 파일 목표). 파일 위치는 ADR-0029 / T-0249 정합으로 `src/assessment-collection/` 하위: `src/assessment-collection/confluence-collection.service.ts` + `src/assessment-collection/domain/page-dedup.ts`(또는 collection 하위 적절 위치) + 각 `.spec.ts`. `AssessmentCollectionModule` 정의·`app.module.ts` 배선·orchestrator entry·영속화·since 도출은 본 slice 밖(Out of Scope).

- [ ] **Confluence 수집 service** — `ConfluenceSpaceTraversalService`(주입) 위에 Confluence instance 를 enumerate 하며 instance 별 `traverseInstance(config)` 를 호출하는 service 메서드(예: `collectConfluenceActivities(spec): Promise<ConfluenceActivity[]>`, spec = instance/config enumerate 입력). 반환 `SpaceTraversalResult[]` 의 각 `pages: unknown[]` → `mapConfluenceActivity` 호출 → null 항목 skip → `ConfluenceActivity[]` 누적(매핑 시 SPACE 식별은 `SpaceTraversalResult.spaceKey` 또는 mapper 추출값 — 구현 재량, 본문에 결정 근거 1줄). dedup helper 적용 후 반환. (instance enumerate 입력 shape 는 구현 재량 — 단 단일 Person 의 Confluence 수집을 표현. SPACE allowlist 순회는 traversal service 내부 책임이므로 service 는 instance loop 만 추가. since/lastModified 필터 도출은 slice (vi) 이므로 본 service 는 config/query 를 받아 그대로 traversal 에 pass-through 만, 도출 로직 미포함).
- [ ] **per-source skip-and-continue** — ADR-0029 §3 대로 각 instance 의 `traverseInstance` 호출을 **독립 try/catch** 로 감싸 한 instance 의 throw 가 다른 instance 수집을 막지 않도록 skip-and-continue. SPACE 단위 4xx skip+emit 은 traversal service 내부에서 이미 처리되므로 본 service 는 그것을 통과시키고 instance 레벨 throw 만 흡수한다. 새 permission-denied emit 경로를 만들지 않는다.
- [ ] **page dedup helper** — `ConfluenceActivity[]` → dedup 된 `ConfluenceActivity[]` 순수 함수. `externalId`(=page-id) 기준 그룹핑 후 같은 page-id 의 여러 version 중 **latest `version`(최대 version number) 1개만** 유지(REQ-010/REQ-031, ADR §4 latest-wins). 동일 page-id + 동일 version tie-break 결정 명시(본문 1줄). 부수효과 0 순수 함수.
- [ ] **(R-112-1) Happy-path unit test** — service 의 정상 수집 경로(`ConfluenceSpaceTraversalService` mock 이 fixture `SpaceTraversalResult[]`(raw page item 배열) 반환 → mapper 통과 → dedup → 기대 `ConfluenceActivity[]`) 1+ test. dedup helper 의 무중복 입력 → 그대로 반환 happy-path 1+.
- [ ] **(R-112-2) Error/negative path unit test** — (a) `traverseInstance` 가 throw(instance 레벨 오류)할 때 해당 instance skip 하고 나머지 instance 결과는 반환(전체 throw 0)됨을 검증 1+. (b) mapper 가 null 반환하는 malformed raw page item 이 결과에서 걸러짐 1+. (c) 빈 instance enumerate 입력 또는 빈 `pages` → 빈 배열 반환 1+. (d) 모든 instance 가 throw → 빈 배열 반환(전체 실패도 throw 0) 1+. 단일 negative 만 작성 금지 — 각 예외 분기마다 cover.
- [ ] **(R-112-3) Flow/branch coverage** — service 의 skip-and-continue try/catch 분기(성공/throw 경로 각각) + dedup helper 의 분기(같은 page-id 중 latest version 선택 / 동일 version tie-break / 무중복) 각 1+ test 로 branch 분리.
- [ ] **(R-112-4) negative cases 충분 cover** — dedup latest-wins 의 핵심 분기: 같은 page-id 2건 중 (i) 첫째가 higher version, (ii) 둘째가 higher version, (iii) 동일 version(tie-break 결정 명시) 각 1+ test. 다중 instance enumerate 에서 일부만 throw 하는 부분 가용성 시나리오 1+. malformed version(mapper 가 이미 null 처리하므로 service 입력 fixture 에서 일부 null + 정상 혼재) 1+.
- [ ] **(R-112-5) Coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] **colocated spec 위치** — spec 은 대상과 colocated: `src/assessment-collection/confluence-collection.service.spec.ts` + `src/assessment-collection/domain/page-dedup.spec.ts`(파일명은 실제 산출물 경로에 맞춤). 2+ spec 공유 fixture 는 `test/helpers/` 또는 collection 하위 fixture 모듈로 추출. `ConfluenceSpaceTraversalService` mock 은 jest mock 주입(live 호출 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- **GitHub 수집 service** — slice (ii) T-0249 로 완료(merged 69b4f8f). 본 slice 는 Confluence 측만.
- `AssessmentCollectionModule` 정의 + `app.module.ts` import 배선 — slice (iv).
- orchestrator entry `collectForPerson(person, since?)`(GitHub + Confluence 통합 진입) — slice (v).
- Activity → Contribution 영속화 / Contribution repository 호출 / Prisma — slice (v).
- **incremental "since" / lastModified 도출 로직**(직전 Assessment → since 계산) — slice (vi). 본 service 는 config/query 를 받아 traversal 에 pass-through 만, 도출 0.
- **live / credentialed 수집 테스트** — Q-0025 결정대로 UI 이후로 deferred. 본 slice 는 mocked `ConfluenceSpaceTraversalService` + fixture raw page item unit test 만, 실 Confluence 호출 0 / 실 token 0.
- 기존 `ConfluenceSpaceTraversalService` / `ConfluenceAdapter` / SPACE allowlist 동작 변경 — 본 slice 는 wrapper 의 반환 shape(`SpaceTraversalResult[]`)·throw 동작만 mock 으로 가정한다.
- modules.md / data-model.md 동기 갱신 — slice (vii) direct doc-sync.
- 새 외부 dependency / 새 credential / 새 DB migration — ADR-0029 대로 0(Node 내장 fetch 기반 기존 adapter + 머지된 mapper 재사용).

## Suggested Sub-agents

`implementer → tester` (수집 loop·skip-and-continue·dedup 위상은 ADR-0029 Decision §3/§4 가 이미 설계를 박제했고 T-0249 가 GitHub 측 동형 구조를 박제했으므로 architect 불요. instance enumerate 입력 shape 같은 micro 결정만 구현 재량 — ADR 결정 범위 안).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append. effort 의 후속 slice (iv)~(vii)는 T-0247 / ADR-0029 Follow-ups 에 이미 박제됨.)
