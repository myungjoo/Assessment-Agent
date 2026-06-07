# ADR-0031 — Collection manual-trigger HTTP endpoint 계약 — 호출처 결선(manual)

- Status: PROPOSED (T-0270)
- Date: 2026-06-07
- 관련 ADR: [ADR-0029](ADR-0029-assessment-collection-orchestrator.md)(collection orchestrator — 수집/평가 분리 §1, 본 ADR 이 그 §3 이 deferred 한 "호출처" 를 manual trigger 로 resolve), [ADR-0030](ADR-0030-assessment-collection-enumerate.md)(enumerate — §5 line 59 가 `assessmentId` 주입 경계를 "호출처(scheduler/manual trigger)" 로 deferred, 본 ADR 이 그 호출처를 박제), [ADR-0006](ADR-0006-assessment-data-model.md)(Assessment immutable + `@@unique`), [ADR-0008](ADR-0008-rbac-role-hierarchy.md)(RBAC tier)
- 관련 REQ: REQ-029(평가 자료 영속), REQ-031~033(재수집 dedup/영속화), REQ-038(조회), REQ-040(manual trigger)

## Context

collection 체인(`src/assessment-collection/`)은 end-to-end 머지됐으나 **production caller 가 0** 이다. `CollectionEntryService.collectForPerson(person, since, assessmentId): Promise<Contribution[]>`(진입) 과 `SinceDerivationService.deriveSince(personId): Promise<string|undefined>`(incremental since 도출) 이 모두 `AssessmentCollectionModule` 에 배선됐지만, 이들을 실제로 호출하는 외부 진입점이 없다([ADR-0030](ADR-0030-assessment-collection-enumerate.md) §5 line 59 가 `assessmentId` 주입 경계를 "호출처(scheduler/manual trigger, P5 평가 진입)가 결정한다" 로 명시 deferred).

사용자가 그 호출처를 **manual HTTP endpoint(POST)** 로 박제하기로 결정했다([Q-0026](../STATE.json) decision): 새 외부 dependency 0 으로 dependency-free 즉시 착수, cron/scheduler 자동화는 추후(미승인). 본 ADR 은 그 manual-trigger endpoint 의 (1) Assessment row 생성 주체, (2) endpoint 계약, (3) orchestration 합성, (4) module 배치, (5) test posture 를 코드보다 먼저 결정한다.

핵심 제약(main 대조):

- `collectForPerson` 은 `persistActivities` 단계에서 `ContributionService.create` 로 `Contribution` 을 영속화하며, `Contribution.assessmentId` 는 **유효한 Assessment FK** 를 요구한다 → 수집 전에 Assessment row 가 존재해야 한다.
- `Assessment` 는 **immutable**([ADR-0006](ADR-0006-assessment-data-model.md) §1 — `updatedAt` 부재, 재평가 = hard delete 후 재생성) 이고 `@@unique([personId, period, scope, periodStart])` + `difficulty`/`contributionScore`/`volume`/`narrative` 의 **평가-산출 필드**(P5 평가가 채움)를 가진다 → 수집 단계가 Assessment 를 만들면 이 필드는 placeholder 여야 한다([ADR-0029](ADR-0029-assessment-collection-orchestrator.md) §1 수집/평가 분리).
- `PersonService.findById(id)` 는 `serviceIdentities` relation 을 **include 하지 않는다**(person.repository 의 findById 에 include 없음) → orchestration 이 `CollectForPersonInput.serviceIdentities` 를 확보하려면 별도 read 경로가 필요하다.
- `deriveSince(personId)` 는 직전 Assessment 의 `periodStart`(= 마지막 수집 경계)를 since 로 반환한다(T-0267). 즉 **`periodStart` 는 "수집 경계 timestamp"** 의 의미로 이미 쓰이고 있다.

## Decision

### §1 — Assessment row 생성 주체 = manual-trigger endpoint (endpoint 가 생성)

manual-trigger endpoint 의 orchestration service 가 `collectForPerson` 호출 **전에** `AssessmentService.create` 로 Assessment row 를 직접 생성한다(호출자가 `assessmentId` 를 넘기지 않는다). 근거: 본 endpoint 는 "한 Person 을 지금 수집하라" 는 self-contained 연산이므로, 수집 container(Assessment) 도 endpoint 가 책임지는 것이 호출자 부담을 없앤다.

생성 필드:

- `personId` = 요청의 personId.
- `period` / `scope` = **요청 body 가 지정**(Admin 이 수집 batch 의 의미를 지정; literal 검증은 기존 `AssessmentService.create` 가 `BadRequestException` 으로 수행). 기본값 미강제 — DTO 가 required.
- `periodStart` = **이번 수집의 경계 timestamp**. 요청이 명시 제공하면 그 값, 없으면 서버 `now()`. 이 값이 다음 수집의 `deriveSince` 결과(= since 하한)가 된다(T-0267 의 periodStart-as-boundary convention 과 정합). 즉 `since`(deriveSince 결과 = 직전 경계) < 수집 활동 ≤ `periodStart`(이번 경계).
- `difficulty` / `contributionScore` / `volume` / `narrative` = **평가 placeholder**(`difficulty="medium"`, `contributionScore=0`, `volume=0`, `narrative=""`). 이는 수집 container 의 미평가 sentinel 이며, P5 평가가 Assessment immutability 규칙(hard delete 후 재생성, ADR-0006 §1)에 따라 실값으로 대체한다. CollectionPersistenceService 의 Contribution placeholder(difficulty/score/volume 0)와 동형 — 수집은 평가하지 않는다(ADR-0029 §1).

**재수집 중복(REQ-031, P2002)**: `periodStart = now()` 를 기본으로 쓰면 매 수집의 경계가 달라 `@@unique([personId, period, scope, periodStart])` 충돌이 사실상 발생하지 않는다. 단 요청이 동일 `periodStart` 를 명시 제공해 충돌하면(`AssessmentService.create` 가 P2002 → `ConflictException` 변환), orchestration 은 그 `ConflictException(409)` 을 **그대로 전파**한다(같은 경계의 재수집은 명시적 충돌로 차단 — 호출자가 다른 periodStart 로 재시도하거나 기존 row 를 먼저 삭제). dedup 의 본질(같은 활동 중복 영속 방지)은 collectForPerson 내부의 Activity dedup(commit SHA / page id+version, ADR-0029 §6)이 담당하며, 본 §1 의 P2002 는 Assessment-container 수준 중복만 다룬다.

### §2 — manual-trigger endpoint 계약

- **route**: `POST /api/assessment-collection/collect`. 근거: 수집 trigger 는 collection 책임이므로 collection module 의 namespace(`/api/assessment-collection`)에 둔다(ADR-0029 §1 수집/평가 분리 — persons sub-resource `/api/persons/:id/collect` 는 수집을 user 도메인에 묶어 경계를 흐린다, Alternatives (c)).
- **RBAC**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`. 근거: 수집 trigger 는 비용 있는 write/orchestration 연산이므로 `AssessmentController` 의 POST/DELETE(Admin+) tier 를 mirror(REQ-045). 인증 부재 → 401, tier 미달 → 403.
- **request body**(`CollectTriggerDto`): `{ personId: string; period: string; scope: string; periodStart?: string(ISO-8601) }`. `ValidationPipe`(whitelist + forbidNonWhitelisted + transform — 기존 controller mirror). `periodStart` 는 `@IsOptional() @IsISO8601()`, 미제공 시 서버 now().
- **response**: `201 Created` + **summary** `{ assessmentId: string; personId: string; since: string | null; period: string; scope: string; periodStart: string(ISO); contributionCount: number }`. 근거: 영속화된 `Contribution[]` 전문 대신 summary 를 반환해 페이로드를 작게 유지(전문은 `GET /api/assessments?personId=` 등 기존 조회 경로로 확보 가능, REQ-038). `since` 는 deriveSince 결과(undefined → JSON `null` = full collection).
- **HTTP status**: `201`(Assessment row + Contribution[] 신규 생성). 에러 mapping(service-layer HttpException raw forward): Person 부재 → 404, literal 위반 → 400, P2002 동일 경계 중복 → 409.

### §3 — orchestration 합성 순서

신규 `CollectionTriggerService`(collection module) 가 다음 순서로 조립한다:

1. `PersonService.findById(personId)` 로 Person resolve(부재 → `NotFoundException` 404 전파).
2. **serviceIdentities 확보** — `findById` 가 serviceIdentities 를 include 하지 않으므로, orchestration-service slice 에서 `serviceIdentities`-포함 read 경로를 추가한다. **권장**: `PersonService` 에 serviceIdentities 를 include 하는 조회(예: `findByIdWithIdentities(id)`)를 추가(단일 round-trip, 404 분기 재사용, 기존 `findById` 시그니처 불변) 후 `UserModule` 이 그대로 export(PersonService 이미 export). `CollectForPersonInput.serviceIdentities` = 그 Person 의 `serviceIdentities.map(si => ({ service: si.service, externalId: si.externalId }))`.
3. `deriveSince(personId)` 로 since 도출(직전 Assessment periodStart, 없으면 undefined = full collection).
4. **Assessment row 생성**(§1) — `AssessmentService.create({ personId, period, scope, periodStart(요청 or now), placeholder 평가필드 })` → `assessmentId`. (collectForPerson 의 persist FK 가 이 row 를 요구하므로 collectForPerson **전** 필수.)
5. `collectForPerson({ serviceIdentities }, since, assessmentId)` 호출 → 영속화된 `Contribution[]`.
6. summary(§2) 조립 후 반환.

빈 serviceIdentities(수집 대상 외부계정 0) → collectForPerson 의 buildCollectionSpec 이 빈 spec → 빈 `Contribution[]`(throw 0, contributionCount=0). 단계 4 의 Assessment 는 그대로 생성됨(빈 수집도 유효한 batch).

### §4 — module 배치

`CollectTriggerDto` + `CollectionTriggerService` + `AssessmentCollectionController` 를 **`AssessmentCollectionModule`** 에 둔다(ADR-0029 §1 — 수집 trigger 는 collection 책임). DI 경계:

- `CollectionTriggerService` 의 의존 `CollectionEntryService` / `SinceDerivationService` 는 **같은 module 의 provider**(이미 등록). `PersonService` / `AssessmentService` 는 **기존 `UserModule` import 의 export**(user.module.ts — 둘 다 export)로 닫힘 → 새 module import 0.
- controller 의 guard(`JwtAuthGuard` / `RolesGuard`)는 `AuthModule` 의 의존(JwtService 등)을 요구하므로 `AssessmentCollectionModule.imports` 에 **`AuthModule` 추가**(AssessmentModule 이 AuthModule 을 import 하는 패턴 mirror — 이는 새 외부 dependency 가 아니라 기존 internal module import). controller 는 providers 에, DTO 는 일반 class.

### §5 — test posture

- **mocked unit**(R-112 — `collection-trigger.service.spec.ts`): happy(정상 수집 → summary) + error/negative 충분 cover: (a) Person 404 전파, (b) 빈 serviceIdentities → contributionCount=0(throw 0), (c) deriveSince undefined → since=null(full collection) 경로, (d) AssessmentService.create P2002 → 409 전파, (e) collectForPerson reject → 전파, (f) deriveSince/PersonService reject 전파. PersonService/AssessmentService/SinceDerivationService/CollectionEntryService 는 jest mock 주입(실 DB·실 adapter 0).
- **e2e**(supertest — `test/e2e/`): `POST /api/assessment-collection/collect` 의 201 happy + 401(미인증) + 403(non-Admin) + 404(Person 부재) + 400(literal 위반). collection adapter(GitHub/Confluence fetch)는 mock(실 token·실 네트워크 0).
- **live**(실 GitHub/Confluence token + 실 네트워크)는 [Q-0025](../STATE.json) 대로 **deferred**(§5 credential 게이트) — 본 chain 에서 다루지 않는다.

## Consequences

**긍정**: 머지만 돼 있고 caller 0 이던 collection backbone 이 실제 호출 가능해진다('safe but useless' 해소). manual endpoint 라 새 외부 dependency 0(§5 미발화), DB row + log 로 수집 결과 검증 가능(UI 부재 무관). `periodStart`-as-boundary convention(T-0267)과 정합해 incremental 재수집(다음 수집의 since = 이번 periodStart)이 자연히 성립한다.

**부정 / trade-off**: (1) 수집이 Assessment 를 placeholder 평가필드로 생성하므로, P5 평가는 immutability 규칙상 hard delete 후 재생성으로 실값을 채워야 한다(Assessment container 의 일시적 placeholder 존재). (2) `period`/`scope` 를 요청이 지정해야 하므로 호출자가 수집 batch 의 의미를 결정해야 한다(자동 추론 안 함). (3) cron 자동화 부재 — 주기 수집은 사람이 매번 trigger(추후 scheduler slice 가 보완, 미승인). (4) `PersonService` 에 serviceIdentities-포함 read 추가가 user 도메인 표면을 약간 넓힌다(기존 메서드 불변이라 회귀 risk 낮음).

**후속 영향**: P5 평가 진입(scheduler/manual eval trigger)이 본 endpoint 가 만든 Assessment + Contribution 을 입력으로 받는다(ADR-0029 §1 feeding). modules.md/api.md 는 impl slice merge 후 doc-sync.

## Alternatives

- **(a) cron/scheduler 자동 트리거** — `@nestjs/schedule` 기반 주기 수집. **미승인**(Q-0026 — 사용자가 manual endpoint 우선 결정, cron 은 새 외부 dependency §5 게이트라 추후 별도 결정). 본 ADR 의 manual orchestration(CollectionTriggerService)은 추후 cron handler 가 재사용 가능하게 설계(트리거 표면만 다름).
- **(b) 호출자가 `assessmentId` 를 넘기는 안** — Assessment 를 외부(평가 trigger 등)가 먼저 만들고 collect endpoint 는 assessmentId 만 받음. 장점: 수집/평가 row 책임 단일화, placeholder 평가필드 불필요. 단점: manual 수집이 사전 Assessment 생성 단계를 요구해 self-contained 하지 않음 + "지금 이 사람 수집" UX 가 2-step 이 됨. 본 ADR 은 §1 에서 endpoint-생성을 택해 1-step trigger 를 우선.
- **(c) route = `POST /api/persons/:id/collect`** — 수집을 person sub-resource 로. 장점: personId 가 path 로 자연스러움. 단점: 수집 책임이 user 도메인 controller 로 새어 ADR-0029 §1 수집/평가(/user) 분리 경계를 흐림. 본 ADR 은 collection module namespace(`/api/assessment-collection/collect`)를 택함.

## Follow-ups (impl slice — dependency-first, 각 ≤300 LOC / ≤5 파일)

1. **DTO slice**(pr) — `CollectTriggerDto`(personId/period/scope/periodStart?) + class-validator 데코레이터 + colocated spec(검증 happy/negative).
2. **orchestration service slice**(pr) — `CollectionTriggerService`(§3 6단계) + `PersonService.findByIdWithIdentities`(serviceIdentities include read 추가) + colocated spec(R-112 §5 a~f). UserModule export 확인.
3. **controller slice**(pr) — `AssessmentCollectionController`(POST /collect, RBAC, ValidationPipe) + `AuthModule` import 배선 + module.spec 회귀(controller/provider resolve) + colocated spec.
4. **e2e slice**(pr) — `test/e2e/assessment-collection-trigger.e2e-spec.ts`(201/401/403/404/400, mocked adapter).
5. **doc-sync slice**(direct) — modules.md(AssessmentCollectionModule row 에 controller/trigger 추가) + api.md(POST /api/assessment-collection/collect 계약).
