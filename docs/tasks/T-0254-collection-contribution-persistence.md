---
id: T-0254
title: Assessment 수집 영속화 service — aggregate Activity[] → mapper → ContributionService.create (ADR-0029 slice v-c)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-031, REQ-032, REQ-033]
estimatedDiff: 145
estimatedFiles: 4
created: 2026-06-06
status: DONE
completedAt: 2026-06-06T16:24:00+09:00
prNumber: 218
mergeCommit: 259bdd5
result: PR-218 squash merge 259bdd5 (loop@AKIHA-s67 t3). CollectionPersistenceService + spec(12 test) + module(UserModule import). reviewer APPROVE(2 MINOR=ADR-0029 L37 import 표기 drift·LOC 423 + 1 NIT, 비차단), CI green, 4-게이트 PASS. 실 diff +423/-18 (4 파일) — spec/mock boilerplate/주석 dominated, 핵심 logic ≈30 LOC. persistence coverage 100%.
plannerNote: P4 ADR-0029 slice v-c — orchestrator aggregate Activity[] → mapper → ContributionService.create 영속화만 큐잉(enumerate/since 제외). R-112 backbone ×1.5, Contribution @@unique 부재라 P2002 미적용
---

# T-0254 — Assessment 수집 영속화 service — aggregate Activity[] → mapper → ContributionService.create (ADR-0029 slice v-c)

## Why

ADR-0029 Decision §6 은 수집된 `Activity[]` 를 v-a 매퍼(`mapActivityToContribution`)로 `ContributionCreateInput` 으로 변환한 뒤 기존 `ContributionService.create` 로 `Contribution` row 를 영속화하는 매핑 계약을 결정했다. orchestrator 의 aggregate(`collectActivities` → `Activity[]`, T-0253) 와 순수 매퍼(T-0252) 는 머지됐으나, **그 둘을 이어 실제로 DB 에 영속화하는 caller 가 아직 0** 이다 — 수집된 활동이 `Contribution` 으로 저장되지 않는다. 이는 README REQ-033(commit·문서별 기여 데이터 영속) + REQ-031(참조 식별자 기반 재수집) 을 완성하는 backbone 이며, ADR-0029 가 박제한 "고립된 두 adapter 가 활동 수집으로 실현되는" 마지막 영속화 단계다.

slice (v) 전체(orchestrator entry + Person enumerate + 두 collection service 호출 + 영속화)는 cap 을 초과하므로 T-0252(v-a 순수 매퍼) → T-0253(v-b aggregate orchestrator) 로 분리됐다. 본 task 는 그 다음 **dependency-first 단위인 영속화 layer** 만 분리한다 — 이미 산출된 `Activity[]` 와 `assessmentId` 를 받아 매퍼를 거쳐 `ContributionService.create` 를 호출해 `Contribution[]` 를 영속화하는 service 1개 + module 배선(UserModule import). **Person enumerate(`collectForPerson`) 와 incremental since 는 본 task 밖**(아래 §Out of Scope) 으로 두어 cap 안에 둔다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §6(Activity → Contribution 영속화 매핑 — 수집 시점엔 `sourceType`/`sourceUrl`/`sourceRef` 참조 식별 필드만 채우고 `difficulty`/`contributionScore`/`volume` 평가 산출물은 P5 책임 = placeholder) + §Consequences negative 1(평가 필드 transient placeholder). 본 task 는 §6 의 "매퍼 결과를 ContributionService 로 영속화" 부분만 구현(enumerate·since 제외).
- `src/assessment-collection/collection-orchestrator.service.ts` — `CollectionOrchestratorService.collectActivities(spec: CollectionSpec): Promise<Activity[]>` 시그니처 + `CollectionSpec { github: GithubCollectionSpec; confluence: ConfluenceCollectionSpec }`. 본 영속화 service 가 inject 해 호출할 대상(또는 호출처가 주입한 `Activity[]` 를 입력으로 받음 — 아래 AC 참조).
- `src/assessment-collection/domain/activity-contribution.mapper.ts` — `mapActivityToContribution(activity: Activity, assessmentId: string): ContributionCreateInput` 순수 함수(T-0252). 평가 필드는 `PLACEHOLDER_DIFFICULTY="easy"` / `PLACEHOLDER_CONTRIBUTION_SCORE=0` / `PLACEHOLDER_VOLUME=0` 으로 채워짐. 본 service 가 각 `Activity` 마다 호출.
- `src/user/contribution.service.ts` — `ContributionService.create(input: ContributionCreateInput): Promise<Contribution>` 시그니처. assessmentId FK 위반(Assessment row 부재) 시 P2003 → `BadRequestException` 변환. sourceType/difficulty literal 검증(VALID_SOURCE_TYPES/VALID_DIFFICULTIES) 후 repository.create. 본 service 가 매퍼 결과를 넘길 영속화 진입점.
- `src/user/contribution.repository.ts` — `ContributionCreateInput` 타입 정의(매퍼 출력 = service.create 입력). 본 task 는 repository 를 직접 호출하지 않고 ContributionService 를 통한다.
- `src/assessment-collection/assessment-collection.module.ts` — 본 task 가 새 영속화 service 를 provider/export 로 추가하고 `UserModule`(ContributionService export 보유) 을 imports 에 추가할 module. 현재 GithubModule/ConfluenceModule import + 두 collection service + orchestrator provide/export 중.
- `src/user/user.module.ts` — `UserModule` 이 `ContributionService` 를 exports 에 포함함(L181 부근 확인). 본 module 을 import 하면 영속화 service 의 `ContributionService` 생성자 주입이 DI 로 resolve 됨.
- `src/assessment-collection/collection-orchestrator.service.spec.ts` — colocated spec 위치/스타일 + collection service jest mock 주입 패턴 참조(본 영속화 service spec 도 `src/assessment-collection/` 에 colocated, orchestrator + ContributionService 를 jest mock 으로 주입).

## Acceptance Criteria

- [ ] `src/assessment-collection/collection-persistence.service.ts` 신설 — `@Injectable()` `CollectionPersistenceService`. 생성자에 `CollectionOrchestratorService` + `ContributionService` 를 inject. 헤더 주석에 ADR-0029 §6 근거 + 책임 경계(enumerate·since 제외, 평가 필드 placeholder) 박제.
- [ ] **영속화 메서드**: `collectAndPersist(spec: CollectionSpec, assessmentId: string): Promise<Contribution[]>` (또는 동등 시그니처) export — (1) `orchestrator.collectActivities(spec)` 로 `Activity[]` aggregate, (2) 각 `Activity` 를 `mapActivityToContribution(activity, assessmentId)` 로 `ContributionCreateInput` 변환, (3) 각 input 을 `contributionService.create(input)` 로 영속화해 `Contribution[]` 반환. assessmentId 는 호출처(상위 enumerate slice)가 주입하며 본 service 는 매퍼/service 에 pass-through(FK 유효성은 ContributionService 가 P2003→400 변환으로 책임).
- [ ] **per-activity 독립성 결정**: 한 `Activity` 영속화가 throw(예: assessmentId FK 위반의 `BadRequestException`)할 때의 처리 방침을 service 헤더 주석에 명시하고 그대로 구현 — 권장: 영속화는 transactional all-or-nothing 이 아닌 **best-effort 누적 반환이 아니라**, assessmentId 는 호출 단위로 동일하므로 FK 위반은 전체 호출 오류(첫 create 가 throw 하면 전체 throw 가 자연스러움). 단 빈 `Activity[]`(수집 0건)일 때는 create 0회 호출 + 빈 `Contribution[]` 반환(throw 0). 선택한 방침(전체 throw vs per-activity skip)을 주석 + AC negative test 로 일관 박제.
- [ ] colocated spec `src/assessment-collection/collection-persistence.service.spec.ts` 추가 — `CollectionOrchestratorService` + `ContributionService` 를 jest mock 으로 주입(live·실 DB 0, Q-0025 deferred 정합).
- [ ] **Happy-path test**: orchestrator mock 이 `Activity[]`(GitHub commit 1 + Confluence page 1, 총 2건) 반환 시 `collectAndPersist` 가 매퍼를 거쳐 `ContributionService.create` 를 2회 호출하고 2건의 `Contribution[]` 를 반환함을 검증(create 가 매퍼 산출 input — 특히 placeholder difficulty="easy"/score=0/volume=0 + 올바른 sourceType/sourceRef — 으로 호출됨도 assert).
- [ ] **Error path test**: `ContributionService.create` 가 reject(예: assessmentId FK 위반 `BadRequestException`)할 때 `collectAndPersist` 가 그 오류를 전파(또는 위에서 택한 방침대로 처리)함을 검증 + orchestrator 가 reject 할 때의 전파도 1+ test.
- [ ] **Branch test**: (1) `Activity[]` 가 빈 배열일 때 create 0회 호출 + 빈 `Contribution[]` 반환, (2) GitHub-only(Confluence 0건) / Confluence-only / mixed 각각에 대해 매퍼 분기(sourceType "commit"/"pr"/"document")가 올바른 input 으로 create 호출됨 — 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**: (1) 빈 수집 결과 시 create 미호출(불필요 DB 호출 0), (2) assessmentId 가 빈 문자열일 때도 매퍼는 그대로 통과시키고 create 에 위임됨(orchestrator/매퍼는 검증 안 함 — service-layer 책임 경계 assert), (3) create 호출 순서·인자 정합(매퍼 산출 input 이 변형 없이 그대로 전달됨) assert, (4) 반환 `Contribution[]` 순서가 입력 `Activity[]` 순서(GitHub→Confluence)와 일치하는 결정론 검증 — 각 1+ test.
- [ ] `src/assessment-collection/assessment-collection.module.ts` 에 `CollectionPersistenceService` 를 providers 에 추가 + `UserModule`(ContributionService export 보유) 을 imports 에 추가 + (후속 enumerate slice v-b2 가 inject 할 수 있도록) exports 에 `CollectionPersistenceService` 추가. import 방향 collection → user(domain)는 ADR-0029 §1 단방향 유지(user 가 collection 을 모름).
- [ ] `src/assessment-collection/assessment-collection.module.spec.ts`(존재 시) 에 새 service/import 정합 검증 추가 — DI 가 resolve 됨(provider 등록 + UserModule import 로 ContributionService token 공급) 확인.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- **Person enumerate** — `collectForPerson(person, since?)` 진입점 + Person 의 ServiceIdentity 별 instance×org×repo / Confluence instance 를 `CollectionSpec` 으로 산출하는 로직은 본 task 밖(후속 slice v-b2 — Follow-up). 특히 GithubRepoSource 의 org/repo source 가 ADR-0029 미정의라 별도 ADR/설계 결정 필요. 본 영속화 service 는 **이미 산출된 `CollectionSpec` + assessmentId 를 입력으로 받는다**(enumerate 0).
- **Assessment row 생성/조회** — `assessmentId` 에 해당하는 `Assessment` row 를 만들거나 조회하는 책임은 본 task 밖. 본 service 는 주입받은 assessmentId 를 그대로 사용하며 FK 유효성은 `ContributionService.create` 의 P2003→400 변환에 위임(존재하지 않는 assessmentId 면 service 가 BadRequestException — 그 동작을 negative test 로만 cover, Assessment 생성은 안 함).
- **dedup 재적용** — commit SHA / page-id+version dedup 은 collection service(T-0249/T-0250) 내부에서 이미 적용됨. 본 영속화 service 는 추가 dedup 0(중복 영속화 방지는 상위 책임).
- **incremental since 도출**(직전 Assessment → since) — slice (vi).
- **app.module.ts 배선** — AssessmentCollectionModule 의 AppModule import 는 enumerate entry(v-b2)가 실 caller 를 갖출 때 함께 처리(현재 orchestrator/영속화 service 는 self-test 외 caller 0 이므로 본 task 에서 app 배선 불요 — module 단위 DI 정합만 검증).
- 기존 orchestrator / 매퍼 / ContributionService / UserModule **수정 금지**(본 task 는 영속화 service 1개 추가 + module imports/providers/exports 추가만 — 기존 시그니처 불변).
- live/credentialed 수집·영속화 — Q-0025 대로 UI 이후 deferred. 본 task 는 mock 주입 orchestrator + mock ContributionService 위에서만 unit-test(실 DB·실 adapter 0).
- modules.md row 9 reconcile doc-sync — slice (vii).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (slice v-b2/enumerate) `collectForPerson(person, since?)` 진입점 — Person 의 ServiceIdentity 별 GitHub instance×org×repo / Confluence instance 를 `CollectionSpec` 으로 enumerate 한 뒤 본 영속화 service 의 `collectAndPersist` 를 호출. **주의: ServiceIdentity 는 `service`+`externalId` 만 보유하고 org/repo 정보가 없음 — GithubRepoSource `{instanceKey, org, repo}` 의 org/repo source(어디서 repo 목록을 얻는가)가 ADR-0029 미정의라 ADR-first 설계 결정 선행 필요**(Person 별 repo allowlist config? GitHub API 로 user 의 repo enumerate? — 별도 ADR slice).
- (slice vi) incremental since 도출 — 직전 Assessment → `since` 계산 + 경계값(동일 timestamp·미래·빈 결과) negative cover.
- (slice vii) modules.md row 9 `AssessmentModule` 수집/평가 분리 reconcile doc-sync(direct). **+ ADR-0029 L37 import 토폴로지 표기 정정** — L37 은 "collection → persistence" 로 박제됐으나 실 edge 는 "collection → user"(ContributionService 가 UserModule export 라 DI-정확). T-0254 reviewer MINOR-1 catch — 본 doc-sync 에서 함께 정정.
- (app 배선) enumerate entry 가 실 caller 를 갖추면 AssessmentCollectionModule 을 app.module.ts imports 에 추가.
