---
id: T-0263
title: ADR-0030 §5 slice iii-b1 — CollectionPersistenceService 영속화 경계 분리(persistActivities)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-031, REQ-032]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split iii-b1 — collectAndPersist 의 collect→persist 결합을 분리해 persistActivities(activities, assessmentId) 경계 노출. author 필터/collectForPerson(iii-b2) 가 소비. R-112 backbone ×1.5(no @unique)."
---

# T-0263 — ADR-0030 §5 slice iii-b1 — CollectionPersistenceService 영속화 경계 분리(persistActivities)

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`, T-0261) + slice iii-a(author 필터 순수 함수 `filterActivitiesByAuthor`, T-0262, 5013934)가 전부 머지됐다. 남은 dependency-first 다음 단위는 slice iii-b(`collectForPerson` 진입)인데, ADR-0030 §5 + T-0262 Follow-up 이 지적한 핵심 난점이 그 진입을 한 task 에 다 담지 못하게 만든다 — **`CollectionPersistenceService.collectAndPersist(spec, assessmentId)` 가 현재 `orchestrator.collectActivities(spec)` → mapper → `ContributionService.create` 를 한 메서드 안에서 collect→persist 로 결합 수행** 하므로(main 대조 확인), `collectForPerson` 이 그 사이에 `filterActivitiesByAuthor` 를 끼우려면 이 영속화 경계를 먼저 재구성해야 한다. 그 경계 재구성 + `collectForPerson` 진입 service 신설 + `CollectionSpecService` provider 배선 + R-112 spec 을 한 task 에 모으면 cap(≤300 LOC / ≤5 파일)을 초과한다.

본 task 는 그 dependency-first 선행 micro-slice(iii-b1) — **이미 `Activity[]` 를 손에 쥔 caller 가 그 활동들만 영속화할 수 있도록 `persistActivities(activities, assessmentId): Promise<Contribution[]>` 경계 메서드를 `CollectionPersistenceService` 에 노출** 하고, 기존 `collectAndPersist` 는 그 메서드를 재사용하도록 재구성한다(공개 시그니처·동작 불변, 내부만 분리). 이로써 후속 iii-b2(`collectForPerson`)는 `buildCollectionSpec`(T-0261) → `orchestrator.collectActivities` → `filterActivitiesByAuthor`(T-0262) → `persistActivities`(본 task) 로 조립만 하면 된다 — author 필터가 collect 와 persist 사이에 자연스럽게 들어가는 hook 이 본 task 의 산출물이다. 새 DB schema 0 / 새 dependency 0 / 새 credential 0 (기존 `ContributionService.create` + 기존 `mapActivityToContribution` 재사용, in-process 순수 refactor) — CLAUDE.md §5 게이트 미발화. README L13-14(Person 기여 수집→영속화) + REQ-031/032(재수집 dedup·raw-not-stored)를 cover 한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §5(collectForPerson 진입 계약 + "cap 분할" — slice iii 를 author 필터 / 진입 결선 으로 분리; 본 task 는 그 진입 결선의 영속화 경계 선행분), §6(testing posture — mocked-adapter unit test 필수, negative cases 충분 cover).
- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — §3(orchestration 계약 — `collectActivities(spec): Promise<Activity[]>` aggregate), §6(Activity → Contribution 영속화 매핑 — `mapActivityToContribution` 순수 변환, fail-fast 전파 방침), Decision §6 의 per-activity 오류 방침(transactional 도 per-activity skip 도 아닌 fail-fast 전파; 빈 입력 → create 0회 + 빈 배열).
- `src/assessment-collection/collection-persistence.service.ts` — **본 task 가 재구성할 대상**. 현재 `collectAndPersist(spec, assessmentId)` 가 `orchestrator.collectActivities(spec)`(collect) → `mapActivityToContribution(activity, assessmentId)`(순수 변환) → `contributions.create(input)`(순차 await, fail-fast 전파) 를 한 메서드에 결합. 본 task 는 후반(map→create 순차 영속화)을 `persistActivities(activities, assessmentId)` 로 추출하고 `collectAndPersist` 가 그것을 호출하도록 변경. 입력 순서 보존·fail-fast·빈 배열 처리 불변.
- `src/assessment-collection/collection-persistence.service.spec.ts` — 본 task 가 보강할 colocated spec. 기존 `collectAndPersist` test(happy / fail-fast 전파 / 빈 수집 / 순서 보존)는 회귀 없이 통과해야 하고, 신규 `persistActivities` 직접 호출 test 를 추가한다.
- `src/assessment-collection/collection-orchestrator.service.ts` — `collectActivities(spec): Promise<Activity[]>` 시그니처 확인용(본 task 는 호출처만, 변경 0). orchestrator 는 절대 throw 0 (try/catch 흡수)이라 collectAndPersist 의 throw 는 영속화 단계(create)에서만 발생.
- `src/assessment-collection/domain/activity-contribution.mapper.ts` L1-30 — `mapActivityToContribution(activity, assessmentId): ContributionCreateInput` 순수 변환 시그니처 확인용(본 task 는 호출만, 변경 0).
- `src/user/contribution.service.ts` (`create` 시그니처만) — `ContributionService.create(input): Promise<Contribution>` 확인용(mock 주입 대상, 변경 0). assessmentId FK 위반은 이 service 의 P2003→`BadRequestException` 변환에 위임(본 task 는 잡지 않고 전파).

## Acceptance Criteria

본 task 의 산출물은 `src/assessment-collection/collection-persistence.service.ts`(경계 분리 refactor) + `src/assessment-collection/collection-persistence.service.spec.ts`(R-112 spec 보강) 2 파일이다. 새 파일·새 provider·새 module import 0(기존 service 내부 메서드 추출만).

- [ ] **신규 경계 메서드 `persistActivities`**: `persistActivities(activities: Activity[], assessmentId: string): Promise<Contribution[]>` 를 `CollectionPersistenceService` 의 public 메서드로 추가한다. 동작 — 입력 `Activity[]` 각각을 `mapActivityToContribution(activity, assessmentId)` 로 변환 후 `contributions.create(input)` 로 순차 영속화(`for ... await`, 결정론적 순서 보존)하고 `Contribution[]` 반환. orchestrator 를 호출하지 않는다(이미 수집된 활동을 받는다 — 이것이 author 필터 hook 의 핵심).
- [ ] **`collectAndPersist` 재구성(동작 불변)**: 기존 `collectAndPersist(spec, assessmentId)` 는 `const activities = await this.orchestrator.collectActivities(spec); return this.persistActivities(activities, assessmentId);` 로 재구성한다 — 공개 시그니처·반환 위상·순서·fail-fast 전파·빈 배열 처리가 모두 기존과 동일(회귀 0). collect 와 persist 가 분리된 두 단계임이 코드에 드러난다.
- [ ] **fail-fast 전파 보존(ADR-0029 §6)**: `persistActivities` 도 `create` 가 throw(예: assessmentId FK 위반 → `BadRequestException`)하면 잡지 않고 그대로 전파한다(transactional 도 per-activity skip 도 아님). 첫 오류에서 중단되어 이후 `create` 는 호출되지 않는다.
- [ ] **빈 입력 처리**: `persistActivities([], assessmentId)` 는 `create` 를 0회 호출하고 빈 `Contribution[]` 를 반환한다(throw 0). 마찬가지로 빈 수집(`collectActivities` 가 빈 배열)일 때 `collectAndPersist` 도 빈 배열 반환(기존 동작 유지).
- [ ] happy-path test 1+ **`persistActivities` 직접 호출**: 2+ `Activity`(GitHub + Confluence 혼합 권장) 입력 → 각 활동이 `mapActivityToContribution` 으로 변환되어 `create` 가 입력 순서대로 호출되고 반환 `Contribution[]` 순서가 입력 순서와 일치함을 검증(mock `ContributionService.create` 로 호출 인자·호출 횟수·순서 확인).
- [ ] happy-path test 1+ **`collectAndPersist` 회귀**: 기존 동작(orchestrator 가 반환한 활동들이 모두 영속화되고 순서 보존)이 재구성 후에도 통과함을 검증. orchestrator mock 이 반환한 `Activity[]` 가 `persistActivities` 경로로 흘러 동일 결과를 냄을 확인.
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 + 분기마다 cover): (a) **`persistActivities` 의 `create` 가 첫 활동에서 reject** → 그 reject 가 그대로 전파되고 이후 `create` 가 호출되지 않음(fail-fast — 호출 횟수로 검증), (b) **`persistActivities` 의 `create` 가 중간 활동에서 reject** → 그 시점까지만 create 호출되고 전파(부분 영속 후 fail-fast), (c) **`persistActivities([], id)` 빈 입력** → create 0회 + 빈 배열(throw 0), (d) **`collectAndPersist` 의 orchestrator 가 빈 배열 반환** → persistActivities 가 빈 배열 반환(create 0회), (e) **`collectAndPersist` 의 create reject** → collectAndPersist 가 그 reject 를 전파(경계 분리 후에도 fail-fast 경로 유지).
- [ ] flow/branch cover: 빈 activities vs non-empty / create 성공 vs reject / collectAndPersist 경로 vs persistActivities 직접 경로 각 1+ test.
- [ ] **기존 spec 회귀 0**: 기존 `collection-persistence.service.spec.ts` 의 모든 test(`collectAndPersist` happy / fail-fast / 빈 수집 / 순서)가 변경 없이 통과한다(필요 시 describe 그룹만 정리, 의미 변경 금지).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/collection-persistence.service.spec.ts`(기존 colocated spec 보강 — 새 spec 파일 신설 아님). NestJS `Test.createTestingModule` 또는 직접 인스턴스화로 mock orchestrator + mock `ContributionService` 주입(기존 spec 의 mock 패턴 mirror).

## Out of Scope

- **`collectForPerson` 진입 service 신설** — slice iii-b2(후속 task). 본 task 는 영속화 경계(`persistActivities`)만 노출하고 `collectForPerson` / `buildCollectionSpec` / `filterActivitiesByAuthor` 를 호출하거나 wiring 하지 않는다. author 필터를 collect 와 persist 사이에 실제로 끼우는 조립은 iii-b2 가 본 task 의 `persistActivities` hook 위에서 수행한다.
- **`CollectionSpecService` provider 배선** — main 대조 결과 `CollectionSpecService` 는 아직 `AssessmentCollectionModule` provider 에 미등록이다(T-0261 Follow-up). 그 배선은 iii-b2 또는 별도 module 배선 micro-slice 책임. 본 task 는 `collection-persistence.service.ts` + 그 spec 2 파일만 건드린다.
- **`collectAndPersist` 의 공개 동작/시그니처 변경** — 본 task 는 내부 분리만, 외부 계약 불변. 호출자가 보는 동작이 달라지면 안 된다(회귀 0).
- **author 필터 적용** — T-0262 가 순수 함수를 산출했고, 그것을 실제 파이프라인에 끼우는 것은 iii-b2. 본 task 는 author 필터를 import 하지도 호출하지도 않는다.
- **mapper / orchestrator / ContributionService 변경** — 전부 기존 시그니처 재사용(호출만). 본 task 는 그 파일들을 수정하지 않는다.
- **since 도출 / pass-through** — slice vi. 본 영속화 경계는 since 와 무관.
- **DB schema / migration** — 0(기존 `Contribution` entity + `ContributionService.create` 재사용). 만약 구현 중 schema 변경이 필요해 보이면 즉시 중단하고 §5 게이트로 escalate(현 설계상 불필요).
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. mock 주입 orchestrator + mock `ContributionService` 위에서만 unit-test(실 fetch 0 / 실 token 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- slice iii-b2: `collectForPerson(person, since?, assessmentId): Promise<Contribution[]>` 진입 service 신설 — `buildCollectionSpec`(T-0261) → `orchestrator.collectActivities` → `filterActivitiesByAuthor`(T-0262) → `persistActivities`(본 task) 조립. `CollectionSpecService` provider 배선 동반(또는 선행 micro-slice). `assessmentId` 주입 경계(scheduler/manual trigger) 결정 포함.
- slice vi: since 도출(직전 Assessment → since) — GitHub/Confluence 양쪽 pass-through.
- module 배선: `CollectionSpecService`(+ 신설 `collectForPerson` service)를 `AssessmentCollectionModule` provider/export 로 등록.
