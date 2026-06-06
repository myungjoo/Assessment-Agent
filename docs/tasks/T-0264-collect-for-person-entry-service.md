---
id: T-0264
title: ADR-0030 §5 slice iii-b2a — collectForPerson 진입 service 신설(4단계 조립)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024, REQ-031, REQ-032]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split iii-b2a — collectForPerson(person, since?, assessmentId) 진입 service 신설: buildCollectionSpec→collectActivities→filterActivitiesByAuthor→persistActivities 조립. module 배선은 iii-b2b. R-112 backbone ×1.5(no @unique)."
---

# T-0264 — ADR-0030 §5 slice iii-b2a — collectForPerson 진입 service 신설(4단계 조립)

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`, T-0261) + slice iii-a(author 필터 순수 함수 `filterActivitiesByAuthor`, T-0262) + slice iii-b1(영속화 경계 `persistActivities`, T-0263 / PR-226 merge 2c018d7)이 전부 머지됐다. 이제 그 4개 building block 을 조립하는 **collection enumerate 체인의 최종 진입점** `collectForPerson` 이 남았다 — main 대조 결과 `collectForPerson` 진입 service 는 아직 0(주석/언급만 존재, 실 구현 없음, issue-still-relevant pre-check 통과).

ADR-0030 §5 의 진입 계약은 `collectForPerson(person, since?): Promise<Contribution[]>` = (a) `buildCollectionSpec(person, since?)` 로 `CollectionSpec` 산출 → (b) `CollectionOrchestratorService.collectActivities(spec)` 로 두 source 를 `Activity[]` 로 수집 → (c) `filterActivitiesByAuthor(activities, serviceIdentities)` 로 Person 귀속 활동만 보존 → (d) `persistActivities(filtered, assessmentId)` 로 영속화하고 영속화된 `Contribution[]` 반환이다. T-0263 이 `persistActivities` 경계를 collect 와 persist 사이에 author 필터를 끼울 수 있는 hook 으로 노출했으므로, 본 task 는 그 hook 위에서 4단계를 조립만 하면 된다.

핵심 설계 결정(ADR-0030 §2 + 본 task): author 필터는 `serviceIdentities` 의 **`externalId`** 가 필요한데 `buildCollectionSpec` 의 입력(`GithubCollectionSpecInput`)은 `service` 필드만 쓴다. 따라서 `collectForPerson` 의 person 입력 타입은 `service` + `externalId` **둘 다** 필요하다(`Pick<ServiceIdentity, "service" | "externalId">[]` 이상). `assessmentId` 주입 경계는 `collectForPerson(person, since?, assessmentId)` 파라미터로 받는 것이 가장 단순하다 — scheduler/manual trigger(P5 평가 진입)가 주입하고, `Assessment` row 생성/조회는 본 service 밖이며 FK 유효성은 `ContributionService.create` 의 P2003→400 변환(T-0263 이 persistActivities 에서 fail-fast 전파)에 위임한다.

새 DB schema 0 / 새 dependency 0 / 새 credential 0 (기존 4 service/함수 재사용, in-process 조립 service). CLAUDE.md §5 게이트 미발화. README L13-18(Person 기여 수집→귀속→영속화) + REQ-005~008/REQ-015/REQ-024/REQ-031/032 를 cover 한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §5(collectForPerson 진입 계약 — `Promise<Contribution[]>` 까지, `assessmentId` 주입 경계 = 호출처; "cap 분할" — iii 를 author 필터/진입 결선으로 분리), §2(author 귀속 key = `ServiceIdentity.externalId`, post-collection 필터), §4(since 는 enumerate 가 도출 안 하고 주입받아 pass-through), §6(testing posture — mocked-adapter unit test 필수, negative cases 충분 cover).
- `docs/tasks/T-0263-persistence-boundary-persist-activities.md` — Follow-ups 의 iii-b2 조립 정의(buildCollectionSpec → collectActivities → filterActivitiesByAuthor → persistActivities) + module 배선이 별도 micro-slice 라는 분리 경계.
- `src/assessment-collection/collection-spec.service.ts` — **본 service 가 주입받아 호출**할 `CollectionSpecService.buildCollectionSpec(person, since?): Promise<CollectionSpec>`. 입력은 `GithubCollectionSpecInput`(serviceIdentities 의 `service` 만). 본 task 의 입력 타입은 이보다 넓게(`service` + `externalId`) 받아 author 필터에도 쓴다.
- `src/assessment-collection/collection-orchestrator.service.ts` — `CollectionOrchestratorService.collectActivities(spec: CollectionSpec): Promise<Activity[]>`(절대 throw 0, try/catch 흡수) + `CollectionSpec` 타입 정의 확인용(호출만, 변경 0).
- `src/assessment-collection/domain/author-filter.ts` — `filterActivitiesByAuthor(activities, serviceIdentities): Activity[]` 순수 함수(부수효과 0, 입력 순서 보존). 본 service 가 collect 와 persist 사이에 호출. serviceIdentities 는 `Pick<ServiceIdentity, "service" | "externalId">[]`.
- `src/assessment-collection/collection-persistence.service.ts` — `CollectionPersistenceService.persistActivities(activities: Activity[], assessmentId: string): Promise<Contribution[]>`(T-0263 신설 경계, fail-fast 전파, 빈 입력 → create 0회 + 빈 배열). 본 service 가 author 필터 후 결과를 이 메서드에 넘긴다(`collectAndPersist` 가 아니라 `persistActivities` 를 호출 — author 필터 hook).
- `src/assessment-collection/github-collection-spec.service.ts` L30-35 — `GithubCollectionSpecInput { serviceIdentities: Pick<ServiceIdentity,"service">[] }` 입력 contract 확인용. 본 task 의 입력 타입이 이것과 호환되도록(service 필드 포함) 설계.
- `prisma/schema.prisma` (Person / ServiceIdentity model 만) — `Person { id, fullName, email, ..., serviceIdentities: ServiceIdentity[] }`, `ServiceIdentity { service, externalId, isPrimary, ... }` 필드 확인용(변경 0).

## Acceptance Criteria

본 task 의 산출물은 신규 진입 service 파일 1개 + 그 colocated spec 1개 = 2 파일이다. module provider 배선(`AssessmentCollectionModule` 등록)은 본 task 밖(iii-b2b 후속) — 본 task 의 spec 은 `Test.createTestingModule` 의 mock wiring 또는 직접 인스턴스화 + mock 4개 주입으로 검증한다.

- [ ] **신규 진입 service**: `src/assessment-collection/collection-entry.service.ts` 에 `@Injectable()` `CollectionEntryService`(또는 동등한 명확한 이름)를 신설하고, `collectForPerson(person, since?: string, assessmentId: string): Promise<Contribution[]>` public 메서드를 노출한다. 생성자는 `CollectionSpecService` + `CollectionOrchestratorService` + `CollectionPersistenceService` 3개를 주입받는다(author 필터는 순수 함수 import — DI 아님).
- [ ] **입력 타입 `service` + `externalId` 둘 다**: `collectForPerson` 의 person 입력 타입은 `serviceIdentities` 의 `service`(buildCollectionSpec 매칭용)와 `externalId`(author 필터 귀속용)를 **둘 다** 포함한다(`{ serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[] }` 이상). 이 타입이 `CollectionSpecService.buildCollectionSpec` 입력(`GithubCollectionSpecInput`, service 만)과 호환되어야 한다(service 필드를 포함하므로 호환).
- [ ] **4단계 조립(ADR-0030 §5)**: `collectForPerson` 은 (1) `this.specService.buildCollectionSpec(person, since)` → `spec`, (2) `this.orchestrator.collectActivities(spec)` → `activities`, (3) `filterActivitiesByAuthor(activities, person.serviceIdentities)` → `filtered`, (4) `this.persistence.persistActivities(filtered, assessmentId)` → 반환 순서로 수행하고 그 결과 `Contribution[]` 를 반환한다. author 필터가 collect 와 persist 사이에 들어감이 코드에 드러난다.
- [ ] **since pass-through(ADR-0030 §4)**: `since` 는 도출하지 않고 `buildCollectionSpec` 에 그대로 전달만 한다. `since` 미지정(undefined) 경로도 정상 동작.
- [ ] **assessmentId 주입 경계(ADR-0030 §5)**: `assessmentId` 는 파라미터로 받아 `persistActivities` 에 그대로 전달한다. `Assessment` row 생성/조회는 본 service 밖이며, FK 유효성은 `persistActivities`(→ `ContributionService.create` P2003→400)에 위임(본 service 는 그 throw 를 잡지 않고 전파).
- [ ] happy-path test 1+: 매칭 instance + 귀속 활동이 있는 person 입력 → 4단계가 순서대로 호출되고(spec mock 의 buildCollectionSpec 반환 → orchestrator mock 의 collectActivities 반환 → author 필터 적용 → persistActivities 호출) 최종 `Contribution[]` 가 반환됨을 검증. 각 mock 의 호출 인자(특히 buildCollectionSpec 에 person/since, persistActivities 에 filtered/assessmentId)와 호출 순서를 확인.
- [ ] error path test 1+ **각 의존성 실패**(분기마다 cover, ADR-0030 §6 negative 충분): (a) `buildCollectionSpec` reject → collectForPerson 이 그 reject 를 전파(이후 orchestrator/persist 미호출), (b) `collectActivities` 가 reject(드물지만 방어) 또는 정상 빈 배열 반환 시 경로, (c) `persistActivities` reject(예: assessmentId FK 위반 → BadRequestException) → collectForPerson 이 그 reject 를 그대로 전파.
- [ ] negative/flow test 1+ **각각**(예외 상황 분기마다): (d) **빈 `serviceIdentities`** person → buildCollectionSpec 이 빈 spec, author 필터가 빈 결과, persistActivities 가 빈 배열 → 빈 `Contribution[]` 반환(throw 0), (e) **author 불일치** — 수집된 활동의 author 가 person 의 externalId 와 불일치 → author 필터가 전부 제외 → persistActivities 가 빈 입력으로 호출(create 0회 의미), (f) **author 일치 부분 집합** — 수집 활동 중 일부만 person externalId 와 일치 → 일치하는 활동만 persistActivities 로 전달됨을 호출 인자로 검증, (g) **since undefined vs 지정** 두 경로 각각 buildCollectionSpec 에 올바른 since 전달.
- [ ] flow/branch cover: 빈 serviceIdentities vs non-empty / author 매칭 0 vs 일부 vs 전부 / since undefined vs 지정 / 각 의존성 성공 vs reject 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제. 신규 service 파일 자체도 충분 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/collection-entry.service.spec.ts`(신규 colocated spec). mock 주입은 `Test.createTestingModule` 의 provider override 또는 직접 인스턴스화 + jest mock(3 service)으로 구성(기존 collection slice spec 의 mock 패턴 mirror — 예: `collection-persistence.service.spec.ts`). author 필터는 순수 함수라 실제 함수를 그대로 사용하거나 입력/출력으로 검증.

## Out of Scope

- **module provider 배선** — `CollectionSpecService`(현재 `AssessmentCollectionModule` provider 미등록, T-0261 Follow-up) + 본 신설 `CollectionEntryService` 를 `AssessmentCollectionModule` provider/export 로 등록하는 작업은 **slice iii-b2b(후속 task)**. 본 task 는 `collection-entry.service.ts` + 그 spec 2 파일만 신설하고, spec 은 mock wiring 으로 검증한다. `assessment-collection.module.ts` / `assessment-collection.module.spec.ts` 를 건드리지 않는다.
- **`CollectionSpecService` / `CollectionOrchestratorService` / `CollectionPersistenceService` / `filterActivitiesByAuthor` 의 변경** — 전부 기존 시그니처 재사용(호출/import 만). 본 task 는 그 파일들을 수정하지 않는다.
- **since 도출(직전 Assessment → since)** — slice vi. 본 service 는 주입받아 pass-through 만.
- **`assessmentId` 의 `Assessment` row 생성/조회** — 본 service 밖(scheduler/manual trigger / P5 평가 진입 책임). FK 유효성은 persistActivities → ContributionService 에 위임.
- **API-side `?author=` 최적화** — ADR-0030 deferred. 본 task 는 post-collection author 필터만(정확성 우선).
- **DB schema / migration** — 0(기존 entity/service 재사용). 구현 중 schema 변경이 필요해 보이면 즉시 중단하고 §5 게이트로 escalate(현 설계상 불필요).
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. mock 주입 3 service 위에서만 unit-test(실 fetch 0 / 실 token 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- slice iii-b2b (T-0265): collection chain 4 service(`CollectionEntryService` + `CollectionSpecService` + `GithubCollectionSpecService` + `GithubOrgEnumerateService`)를 `AssessmentCollectionModule` provider/export 로 배선 + `assessment-collection.module.spec.ts` 회귀(provider resolve 검증). GithubInstanceClient 는 기존 GithubModule export 로 닫힘.
- modules.md doc-sync(direct, 별도): AssessmentCollectionModule row 에 enumerate chain 반영.
- slice vi: since 도출(직전 Assessment → since) service — collectForPerson 의 since 인자 소비처.
- 호출처 결선: scheduler/manual trigger(P5 평가 진입)가 `collectForPerson(person, since, assessmentId)` 를 호출하며 assessmentId 를 주입하는 진입점 wiring.

## 완료 기록

- DONE 2026-06-06 (loop@AKIHA-s68 turn 8). PR-227 squash-merge `0557a7d`, reviewer APPROVE round 1/7 (0 BLOCKER/0 MAJOR/1 MINOR[327 LOC>cap300 spec-driven 비-차단]), 4-게이트 PASS, CI green (approval-gate race → rerun --failed green).
- 산출: `collection-entry.service.ts`(`CollectionEntryService.collectForPerson` — buildCollectionSpec→collectActivities→filterActivitiesByAuthor→persistActivities 4단계 조립) + colocated spec (9 case, 신규 파일 cov 100%). +327 LOC/2 파일. **collection 체인 backbone 진입점 완성** — module 배선(iii-b2b)만 남음.
