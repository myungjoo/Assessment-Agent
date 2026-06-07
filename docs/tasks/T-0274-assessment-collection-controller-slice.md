---
id: T-0274
title: AssessmentCollectionController(POST /collect) + AuthModule 배선 slice
phase: P4
status: DONE
completedAt: 2026-06-07T21:55:00+09:00
prNumber: 235
mergeCommit: f6cc24d
result: "AssessmentCollectionController(POST /api/assessment-collection/collect, Admin RBAC, ValidationPipe, 201 summary) → CollectionTriggerService 위임 + module 배선(controllers/CollectionTriggerService provider/AuthModule import, forwardRef 불요 circular 부재 compile 실측). PR-235 squash f6cc24d, reviewer r1 APPROVE 0/0/0, CI green(race 미발생), controller 100% cov, 189 suite/3541 test green. collection backbone 이제 HTTP 호출 가능."
commitMode: pr
coversReq: [REQ-040, REQ-029, REQ-045]
estimatedDiff: 190
estimatedFiles: 4
created: 2026-06-07
plannerNote: "P4 ADR-0031 Follow-up #3 controller slice — collection backbone 의 HTTP caller 박제(POST /collect + RBAC + AuthModule import). #1 DTO/#2 orchestration DONE 의존."
---

# T-0274 — AssessmentCollectionController(POST /collect) + AuthModule 배선 slice

## Why

ADR-0031([§2 endpoint 계약](../decisions/ADR-0031-collection-manual-trigger.md) / §4 module 배치)의 Follow-up #3 controller slice 다. collection backbone 은 end-to-end 머지됐으나 production caller 가 0 이고, #2 orchestration slice(T-0273, merged 4eec185)가 `CollectionTriggerService.triggerCollection(dto)` 를 완결했다. 본 task 는 그 service 를 호출하는 HTTP 진입점 `AssessmentCollectionController`(POST /api/assessment-collection/collect)를 박제해 "머지만 돼 있고 caller 0" 상태를 실제 호출 가능하게 만든다(REQ-040 manual trigger). 호출처 결선 chain: #1 DTO[DONE] → #2a read[DONE] → #2b orchestration[DONE] → **#3 controller[본 task]** → #4 e2e → #5 doc-sync.

## Required Reading

- `docs/decisions/ADR-0031-collection-manual-trigger.md` — §2(endpoint 계약: route / RBAC / request body / response summary / HTTP status) + §4(module 배치: AuthModule import + controller/provider 등록 + circular 평가) + §5(test posture — controller spec 은 위임만, RBAC/ValidationPipe 통합은 #4 e2e cover).
- `src/assessment-collection/collection-trigger.service.ts` — `CollectionTriggerService.triggerCollection(dto: CollectTriggerDto): Promise<CollectionTriggerSummary>` 시그니처 + `CollectionTriggerSummary` interface(controller 가 그대로 반환). 호출만 — 재구현 0.
- `src/assessment-collection/dto/collect-trigger.dto.ts` — `@Body() CollectTriggerDto`(personId/period/scope/periodStart?).
- `src/user/assessment.controller.ts` — RBAC 패턴 1:1 mirror reference: `@UsePipes(new ValidationPipe({whitelist,forbidNonWhitelisted,transform}))` controller-scope + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@HttpCode(201)` + guard import 경로(`../auth/jwt-auth.guard` / `../auth/roles.decorator` / `../auth/roles.guard`). 단 본 controller 는 collection module 에 있으므로 import 경로는 `../auth/...`(동일 depth) 확인.
- `src/user/assessment.controller.spec.ts` — controller spec 패턴(unit-level mocked service 위임 검증 부분). 본 task 의 controller spec 은 이 unit 부분만 mirror(integration/supertest 부분은 #4 e2e 로 deferred).
- `src/assessment-collection/assessment-collection.module.ts` — 현 구성(imports: GithubModule/ConfluenceModule/UserModule, providers/exports 목록). controllers 배열 부재 → 신규 추가 + CollectionTriggerService provider 추가 + AuthModule import 추가 위치.
- `src/assessment-collection/assessment-collection.module.spec.ts` — module.spec 회귀 패턴(PersistenceModule + mocked PrismaService imports, provider resolve / sentinel override 가드). controller resolve + CollectionTriggerService provider resolve 회귀 추가 위치.
- `src/auth/auth.module.ts` — AuthModule exports(JwtAuthGuard / RolesGuard / AuthService) 확인 + circular 평가 근거: AuthModule.imports = `[PassportModule, forwardRef(() => UserModule), JwtModule]` — collection 미참조 → **collection → auth 단방향, forwardRef 불요 기대값**(ADR-0031 §4 일치, planner pre-check 로 `src/auth/*.ts` 의 collection 참조 0 확인).

## AuthModule circular 평가 (planner 사전 확인 — 구현자 honor)

- planner pre-check: `git grep "assessment-collection" origin/main -- src/auth/*.ts` → 매칭 0. **auth 는 collection 을 import 하지 않는다.**
- 따라서 `AssessmentCollectionModule.imports` 에 `AuthModule`(plain import, **forwardRef 불요**) 추가가 circular 을 유발하지 않을 것이 기대값이다.
- **단 구현 시 실측 의무**: module.spec 의 `Test.createTestingModule` compile 이 circular 로 throw 하면(예상 밖) `forwardRef(() => AuthModule)` 로 전환하고 그 이유를 module.ts 주석에 박제. throw 없이 compile 되면 plain import 유지.
- AuthModule↔UserModule 는 이미 forwardRef 로 연결돼 있고(auth.module.ts L60), collection 은 이미 UserModule 을 plain import 중이므로(module.ts L74), AuthModule 추가 import 가 그 기존 forwardRef chain 과 충돌하지 않는지도 compile 로 검증된다.

## Acceptance Criteria

- [ ] `src/assessment-collection/assessment-collection.controller.ts` 신설 — `@Controller("api/assessment-collection")` + `@UsePipes(new ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true}))`(AssessmentController mirror). `@Post("collect")` `@HttpCode(201)` `@UseGuards(JwtAuthGuard, RolesGuard)` `@Roles("Admin")` handler `collect(@Body() dto: CollectTriggerDto): Promise<CollectionTriggerSummary>` 가 `this.triggerService.triggerCollection(dto)` 를 그대로 위임·반환. service-layer HttpException 은 추가 변환 0(raw forward — 404/400/409 자동 mapping).
- [ ] `src/assessment-collection/assessment-collection.module.ts` 수정 — (a) `controllers: [AssessmentCollectionController]` 배열 추가, (b) providers 에 `CollectionTriggerService` 추가, (c) imports 에 `AuthModule`(forwardRef 불요 기대 — circular 평가 참조) 추가. 변경 의도 주석 박제(§12 한국어).
- [ ] **module.spec 회귀**(`assessment-collection.module.spec.ts`): (1) compile 후 `AssessmentCollectionController` 가 resolve 됨(happy — controller 등록 정합), (2) `CollectionTriggerService` provider 가 resolve 됨(happy — provider 등록 정합). compile 이 circular 로 throw 하지 않음을 본 test 가 회귀 가드로 겸함. PersistenceModule + 기존 mocked PrismaService 패턴 재사용(필요 시 auth/user delegate mock 보강).
- [ ] **colocated controller spec**(`assessment-collection.controller.spec.ts`, AssessmentController.spec unit 부분 mirror) — happy-path: `collect()` 가 `triggerService.triggerCollection` 을 받은 dto 그대로 1회 호출하고 그 `CollectionTriggerSummary`(201) 를 반환함을 service mock 으로 검증.
- [ ] **error path unit test 1+**: `triggerService.triggerCollection` 이 reject(예: `NotFoundException` Person 부재 / `ConflictException` P2002 / `BadRequestException` literal 위반)할 때 controller 가 그 예외를 잡지 않고 그대로 전파함을 각 1+ test 로 검증(negative cases 충분 cover — 단일 negative 금지, 최소 2종 예외 propagation).
- [ ] **flow / branch coverage**: 본 controller handler 는 분기 없음(순수 위임) — "분기 없음 — 이 항목 생략" 명시. service mock call-args 검증으로 위임 경로 cover.
- [ ] RBAC/ValidationPipe 통합(401 미인증 / 403 non-Admin / 400 raw 필드 reject / decorator 위반)은 본 controller spec 에서 cover하지 않고 **#4 e2e(T-0275 후속)로 deferred** — controller spec 은 위임만(ADR-0031 §5, AssessmentController.spec 의 integration 부분 미복제).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 controller line/function coverage 100% 목표(분기 없는 위임이라 충분 cover 가능).
- [ ] cap 준수: 변경 파일 ≤ 5(controller + controller.spec + module.ts + module.spec = 4), diff ≤ 300 LOC.

## Out of Scope

- **e2e slice(ADR-0031 Follow-up #4)** — `test/e2e/assessment-collection-trigger.e2e-spec.ts`(201/401/403/404/400, mocked adapter)는 별도 후속 task. 본 task 의 controller spec 은 위임만.
- **doc-sync slice(ADR-0031 Follow-up #5)** — modules.md(AssessmentCollectionModule row 에 controller/trigger 추가) + api.md(POST /api/assessment-collection/collect 계약)는 별도 direct doc-sync task.
- CollectionTriggerService / CollectTriggerDto / building block(PersonService.findByIdWithIdentities / AssessmentService.create / SinceDerivationService / CollectionEntryService) 재구현·시그니처 변경 0 — 본 task 는 controller + 배선만.
- 새 RBAC tier / role 의미 / escalation 매핑 변경 0 — ADR-0008 / AssessmentController POST(Admin+) 패턴 그대로 mirror.
- 응답 envelope / pagination / Contribution[] 전문 반환 0 — summary(CollectionTriggerSummary) 그대로 반환(ADR-0031 §2).
- live/credentialed 수집(실 GitHub/Confluence token) 0 — Q-0025 deferred(§5 credential 게이트).
- cron/scheduler 자동 트리거 0 — ADR-0031 Alternatives (a) 미승인.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (#4) e2e slice — `test/e2e/assessment-collection-trigger.e2e-spec.ts`(201 happy + 401/403/404/400 negative, mocked adapter, ADR-0031 §5).
- (#5) doc-sync slice(direct) — modules.md AssessmentCollectionModule row 에 controller/CollectionTriggerService 추가 + api.md POST /api/assessment-collection/collect 계약 박제(ADR-0031 §2).
