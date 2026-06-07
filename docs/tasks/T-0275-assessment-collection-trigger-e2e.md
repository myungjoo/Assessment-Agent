---
id: T-0275
title: assessment-collection-trigger e2e slice (201/401/403/404/400, mocked adapter)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-040, REQ-029, REQ-045]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-06-07
plannerNote: "P4 ADR-0031 Follow-up #4 e2e slice — POST /collect 의 RBAC/ValidationPipe end-to-end round trip 검증(201/401/403/404/400). #1~#3 DONE 의존, no-network."
---

# T-0275 — assessment-collection-trigger e2e slice (201/401/403/404/400, mocked adapter)

## Why

ADR-0031([§2 endpoint 계약](../decisions/ADR-0031-collection-manual-trigger.md) / [§5 test posture](../decisions/ADR-0031-collection-manual-trigger.md))의 Follow-up #4 e2e slice 다. #3 controller slice(T-0274, merged f6cc24d)가 `AssessmentCollectionController`(POST /api/assessment-collection/collect, Admin RBAC, ValidationPipe)를 박제했고, controller spec 은 위임 단위만 검증하며 RBAC/ValidationPipe 통합(401/403/400)·실 DB 404 를 e2e 로 deferred 했다. 본 task 는 그 deferred 분을 `test/e2e/assessment-collection-trigger.e2e-spec.ts`(supertest)로 cover 해 endpoint 의 end-to-end round trip(인증·RBAC tier·validation·summary 반환)을 검증한다(REQ-040 manual trigger). 호출처 결선 chain: #1 DTO[DONE] → #2a read[DONE] → #2b orchestration[DONE] → #3 controller[DONE] → **#4 e2e[본 task]** → #5 doc-sync.

## Required Reading

- `docs/decisions/ADR-0031-collection-manual-trigger.md` — §2(endpoint 계약: route `POST /api/assessment-collection/collect` / RBAC Admin+ / request body `{personId,period,scope,periodStart?}` / response 201 summary shape / 에러 mapping 404·400·409) + §3(orchestration 6단계 — 특히 line 55: 빈 serviceIdentities → 빈 spec → 빈 `Contribution[]`, throw 0, contributionCount=0 = **no-network happy 경로의 근거**) + §5(test posture: e2e 는 201/401/403/404/400, adapter mock — 실 token·실 네트워크 0).
- `test/e2e/assessments.e2e-spec.ts` — **1:1 mirror reference**(가장 가까운 선례 — POST + Admin RBAC + 실 DB seed). 본 e2e 가 그대로 따라야 하는 패턴: (a) `createAuthenticatedE2EApp([{role,email}])` 로 User/Admin actor 2종 seed + token 발급, (b) `buildAuthCookie(token)` 로 supertest `Cookie:` header, (c) `request(app.getHttpServer()).post(...).set("Cookie", ...).send(...)`, (d) `afterEach(truncateAll)` / `afterAll(app.close + prisma.$disconnect)`, (e) `prisma.person.create` 로 평가 대상 Person seed(FK), (f) 401(cookie 부재)/401(invalid JWT)/403(User role token) RBAC negative 패턴 — A.2/A.5/A.6 블록을 collect endpoint 로 그대로 transpose, (g) 400 envelope(`{statusCode:400,error:"Bad Request"}`) + raw 필드 whitelist reject 패턴(C.2/C.3).
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp(seed: SeedUserInput[])` / `buildAuthCookie(token)` / `AuthenticatedE2EContext`({app, prisma, tokens}) 시그니처. AUTH_JWT_SECRET 은 본 helper import 의 module-load side-effect 가 박제(추가 셋업 0). **신규 인증 인프라 발명 금지 — 본 helper 재사용.**
- `test/helpers/db-truncate.ts` — `truncateAll(prisma)`(User/Person CASCADE → Assessment/Contribution/ServiceIdentity 동반 정리). afterEach 에서 호출.
- `test/helpers/e2e-app-factory.ts` — `createE2EApp()`(AppModule 부트스트랩 + applyGlobalMiddleware). auth helper 가 내부 호출 — 본 e2e 는 직접 호출 불요(참고용).
- `src/assessment-collection/collection-trigger.service.ts` — `CollectionTriggerSummary` 반환 shape(`{assessmentId, personId, since, period, scope, periodStart, contributionCount}`) — 201 happy assert 의 기대 키. line 55(빈 serviceIdentities → contributionCount=0) 가 no-network 근거.
- `src/assessment-collection/dto/collect-trigger.dto.ts` — request body 필드(personId/period/scope required, periodStart? ISO-8601). 400 negative(필수 누락 / raw 필드 / 잘못된 ISO) assert 의 입력.
- `prisma/schema.prisma` (L237 `model ServiceIdentity` 부근 + L67 `serviceIdentities` relation) — Person seed 시 serviceIdentities 를 비워(또는 생략) no-network happy 경로를 만드는 방법 확인. `prisma.serviceIdentity.create` 는 본 happy 경로에서 불요(빈 relation).

## Adapter mock / no-network 전략 (planner 사전 분석 — 구현자 honor)

본 e2e 는 **실 GitHub/Confluence token·실 네트워크 0**(ADR-0031 §5)이어야 한다. main 대조 분석 결과 다음 전략을 따른다 — 신규 인프라 발명 금지:

1. **happy 201 = 빈 serviceIdentities 경로(권장 default, override 불요)**: Person 을 serviceIdentities 없이 seed 하면 `CollectionEntryService.collectForPerson` 의 buildCollectionSpec 이 빈 spec → 빈 `Contribution[]`(ADR-0031 §3 line 55) → `GithubAdapter`/`ConfluenceAdapter` 의 `fetchFn`(default globalThis.fetch)이 **한 번도 호출되지 않는다**. 즉 happy 경로는 실 네트워크에 닿지 않고 `contributionCount=0` summary(201)를 반환한다. 이 경로가 가장 단순한 no-network happy 검증이며 adapter override 가 불필요하다.
2. **401/403/404/400 negative = collectForPerson 도달 전 throw**: 401(JwtAuthGuard)·403(RolesGuard)·400(ValidationPipe)은 controller 진입/검증 단계에서 reject 되고, 404(Person 부재 → `findByIdWithIdentities` NotFoundException)는 단계 (1)에서 throw 되어 모두 `collectForPerson` 전에 종료 → 실 네트워크 0.
3. **adapter override 는 본 task 에서 불요(권장)**: `createAuthenticatedE2EApp` 는 module override hook 을 노출하지 않으며, 위 1·2 로 모든 시나리오가 no-network 로 성립하므로 본 e2e 는 helper 를 그대로 사용한다. 만약 구현 중 비-빈 serviceIdentities happy 경로를 추가로 검증하고 싶어도 **본 task 범위 밖**(Out of Scope) — 빈 경로 happy 로 충분하다. adapter 를 실 fetch 로 타게 하는 어떤 seed 도 금지(실 token 부재 시 adapter 가 빈/throw 분기로 흘러 flaky 위험).
4. live(실 token + 실 네트워크)는 Q-0025/ADR-0031 §5 대로 deferred — 본 chain 밖.

## Acceptance Criteria

- [ ] `test/e2e/assessment-collection-trigger.e2e-spec.ts` 신설 — `test/e2e/assessments.e2e-spec.ts` 패턴 1:1 mirror. `beforeAll` 에서 `createAuthenticatedE2EApp([{role:"User",...},{role:"Admin",...}])` 로 actor 2종 seed + `buildAuthCookie` 로 userCookie/adminCookie 박제. `afterEach(truncateAll)` + `afterAll(app.close + prisma.$disconnect)`. 파일 상단에 책임/no-network 전략(빈 serviceIdentities) 주석 박제(§12 한국어, assessments.e2e 주석 포맷 mirror).
- [ ] **happy 201**(Admin token, 빈 serviceIdentities Person): `prisma.person.create`(serviceIdentities 없이) 후 `POST /api/assessment-collection/collect` 에 `{personId, period:"week", scope:"commit"}`(periodStart 생략) 전송 → `201` + content-type json + body 에 `CollectionTriggerSummary` 7 키(`assessmentId/personId/since/period/scope/periodStart/contributionCount`) 모두 존재 + `personId` 일치 + `contributionCount === 0`(빈 수집) + `since === null`(신규 인원 full collection). 실 DB 에 Assessment row 1 개 생성 확인(`prisma.assessment.findUnique({where:{id:body.assessmentId}})` not null, personId 일치, narrative `""` placeholder).
- [ ] **happy 201 branch — periodStart 명시**(Admin token): periodStart 를 ISO 문자열로 제공 시 201 + summary.periodStart 가 그 값과 정합(요청 제공 분기 cover — §3 periodStart 분기). 빈 serviceIdentities 로 no-network 유지.
- [ ] **401 negative ×2**(인증 부재 분기 충분 cover): (a) cookie 부재 POST → 401 + Assessment row 0(`prisma.assessment.count()===0`), (b) invalid JWT cookie(`buildAuthCookie("garbage.token.invalid")`) POST → 401 + row 0. assessments.e2e A.2/A.5 mirror.
- [ ] **403 negative**(tier 미달 분기): User role token(`userCookie`) 으로 POST → 403(RolesGuard Admin+ tier reject) + Assessment row 0. assessments.e2e A.6 mirror.
- [ ] **404 negative**(Person 부재 분기): Admin token + 존재하지 않는 personId 로 POST → 404 + envelope `{statusCode:404,error:"Not Found"}` + message truthy(service `findByIdWithIdentities` NotFoundException raw forward). Assessment row 0.
- [ ] **400 negative 충분 cover ×2+**(validation 분기마다): (a) Admin token + 빈 body `{}` → 400 + envelope `{statusCode:400,error:"Bad Request"}` + message truthy(필수 필드 누락), (b) Admin token + non-whitelisted raw 필드(예: `{personId,period,scope, rawBody:"..."}`) → 400 + whitelist reject(message 에 raw 키/property 매칭). 두 경우 모두 Assessment row 0(validation 차단). assessments.e2e C.2/C.3 mirror.
- [ ] **flow / branch coverage**: 위 happy(빈 serviceIdentities / periodStart 제공·생략) + 4xx 분기(401/403/404/400)가 각 1+ test 로 cover됨 — endpoint 의 guard stack(JwtAuthGuard→RolesGuard)·ValidationPipe·service throw mapping 각 분기 1+.
- [ ] **no-network 검증**: 본 e2e 의 어떤 test 도 실 GitHub/Confluence 네트워크에 닿지 않음(빈 serviceIdentities happy + collectForPerson 도달 전 throw negative). 실 token 환경변수·adapter override·실 외부 호출 0(Adapter mock / no-network 전략 §1~3 honor).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 spec 추가라 production LOC 0(coverage 회귀 0, 기존 controller/service 의 e2e cover 가 추가됨). e2e 는 CI 의 `pnpm test:e2e` step(test/jest-e2e.json testRegex `.*\.e2e-spec\.ts$`)이 자동 picking.
- [ ] cap 준수: 변경 파일 1(신규 spec 1개), diff ≤ 300 LOC.

## Out of Scope

- **doc-sync slice(ADR-0031 Follow-up #5)** — modules.md(AssessmentCollectionModule row 에 controller/CollectionTriggerService 추가) + api.md(POST /api/assessment-collection/collect 계약 박제)는 별도 **direct** doc-sync task. 본 task 는 e2e spec 만.
- **비-빈 serviceIdentities happy(실 contribution 영속) 검증** — 실 adapter fetch 를 타야 해 실 token/네트워크 또는 adapter override 가 필요하므로 본 task 밖. 빈 serviceIdentities happy(contributionCount=0)로 endpoint round trip 검증 충분(no-network 전략 §3).
- **live/credentialed 수집(실 GitHub/Confluence token + 실 네트워크)** — Q-0025/ADR-0031 §5 deferred(§5 credential 게이트). 본 e2e 는 실 token 0.
- **409(P2002 동일 경계 중복) e2e** — controller spec(T-0274)이 ConflictException propagation 을 unit 으로 cover했고, 실 DB 동일 periodStart 충돌 e2e 는 periodStart 명시+동일값 2회 POST 가 필요한데 happy 경로 검증 외 추가 가치가 낮아 본 slice 범위 밖(원하면 후속 follow-up). 401/403/404/400 의 핵심 RBAC/validation 경계가 우선.
- controller / CollectionTriggerService / DTO / building block 재구현·시그니처 변경 0 — 본 task 는 e2e spec 추가만.
- 신규 e2e helper / 인증 인프라 / app 부트스트랩 / DB setup 발명 0 — 기존 `test/helpers/*`(auth-e2e-helper / db-truncate / e2e-app-factory) 그대로 재사용.

## Suggested Sub-agents

`tester`

## Follow-ups

- (#5) doc-sync slice(direct) — modules.md AssessmentCollectionModule row 에 controller/CollectionTriggerService 추가 + api.md POST /api/assessment-collection/collect 계약 박제(ADR-0031 §2). ADR-0031 chain 의 마지막 slice.
