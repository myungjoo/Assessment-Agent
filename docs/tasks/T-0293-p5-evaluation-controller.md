---
id: T-0293
title: P5 평가 controller/DTO — POST /api/assessment-evaluation/evaluate → orchestrator 위임
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-045, REQ-021, REQ-030, REQ-097, REQ-032, TBD]
estimatedDiff: 220
estimatedFiles: 5
created: 2026-06-09
dependsOn: [T-0292]
plannerSource: "ADR-0032 Follow-ups — 평가 controller / DTO slice. T-0292 가 EvaluationOrchestratorService.evaluateActivities(Activity[], options) 를 완결했으나 HTTP caller 0(collection layer 의 T-0274 이전 상태와 동형). 본 slice 가 그 orchestrator 를 NestJS controller + 검증 DTO 로 HTTP 노출한다(dependency-free, §5 미발화)."
plannerNote: "P5 일곱 번째 impl slice — 평가 controller/DTO. orchestrator(T-0292) caller 0 해소. POST /api/assessment-evaluation/evaluate, AssessmentCollectionController 패턴 mirror, orchestrator mock. dep 0, R-112 4종 + DTO negative."
---

# T-0293 — P5 평가 controller/DTO (POST /api/assessment-evaluation/evaluate → orchestrator 위임)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) §Follow-ups 의 **평가 controller / DTO slice** 다. 직전 slice T-0292 가 `EvaluationOrchestratorService.evaluateActivities(activities: Activity[], options: ScoringOptions): Promise<EvaluationResult[]>` 를 완결해 "수집된 `Activity[]` → 정규화 → 평가-side dedup → 단위별 scoring → `EvaluationResult[]`" end-to-end 경로를 in-process 박제했다. 그러나 이 orchestrator 는 **자기 spec 외 HTTP caller 가 0** 이다 — `AssessmentEvaluationModule` 이 `app.module.ts` 에도 미등록이라 NestJS 런타임에 진입조차 안 한다. 이는 collection layer 가 T-0274(controller)/T-0275(e2e) 이전에 있던 "backbone caller 0" 상태와 정확히 동형이며, 그 패턴이 검증된 thin-delegate controller slice 로 해소됐다.

핵심 가치 — (1) P5 평가 orchestrator 를 처음으로 **HTTP endpoint 로 노출**해, 평가 파이프라인을 실제 호출 가능하게 만든다. ADR-0032 §Follow-ups 의 "평가 controller / DTO slice — 사용자 지정 기간 평가문 요청(R-9) endpoint" 빈자리를 채운다. (2) `AssessmentCollectionController`(T-0274) 의 검증된 thin-delegate 패턴을 mirror — controller 는 orchestration 을 재구현하지 않고 검증 DTO 를 받아 `orchestrator.evaluateActivities` 에 그대로 위임만 한다. ValidationPipe(whitelist + forbidNonWhitelisted + transform) + RBAC(Admin+) 도 동일하게 적용한다. (3) `EvaluationOrchestratorService` 를 생성자 주입(NestJS DI)받아 test 에서 **mock** `evaluateActivities` 로 검증 — 실 LLM 호출 0 / live credential 0 / 새 외부 dependency 0 / DB schema·Prisma migration 0 / §5 게이트 미발화.

본 slice 는 **controller 1 + request DTO 1 + module 갱신(controller 등록) + app.module 등록 + colocated controller spec** 만. orchestrator 의 입력 `Activity[]` + scoring `modelId` 를 request body 로 받아 검증 후 위임하며, **period/personId → 수집 → `Activity[]` 변환 bridge 는 본 slice 밖**(별도 후속 — collection orchestration 과의 결합이라 dependency 표면이 커짐). 즉 본 endpoint 는 "이미 수집된 `Activity[]` + scoring 옵션을 받아 평가 결과를 반환" 하는 최소 계약을 박제한다.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — **§Decision (1) 평가 단위 계약(`Activity`→`EvaluationInput` 정규화)** + **§Follow-ups(평가 controller / DTO slice)** 정독. 핵심 박제: (a) 평가 layer 는 수집을 재구현하지 않고 `Activity` 를 consume 만 함(ADR-0029 SRP 경계). (b) raw 본문 0(REQ-032) — DTO 가 받는 `Activity` 도 typed surface 만(metadata 는 scalar only). (c) R-9 사용자 지정 기간 평가문 요청이 본 controller 의 궁극 책임이나, 기간→수집 bridge 는 후속이므로 본 slice 는 `Activity[]` 직접 수신 계약으로 시작.
- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — controller 가 주입받아 위임할 `EvaluationOrchestratorService.evaluateActivities(activities: Activity[], options: ScoringOptions): Promise<EvaluationResult[]>`. 시그니처 변경 0 — controller 는 검증된 DTO 를 이 메서드에 그대로 넘긴다. 머리 주석의 "controller / DTO / endpoint / R-9 사용자 지정 기간 — HTTP layer 는 후속 slice" 가 본 task 가 채울 빈자리임을 확인.
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) — `ScoringOptions { modelId: string }`. controller DTO 가 `modelId` 를 받아 `ScoringOptions` 로 전달. 재사용(새 옵션 타입 도입 금지 우선).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — endpoint 응답 타입 `EvaluationResult[]`(orchestrator 반환 그대로 forward).
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) — request body 의 핵심 입력 타입 `Activity = GithubActivity | ConfluenceActivity`(L83). `ActivityBase`(externalId/sourceType/instanceKey/author/timestamp/metadata) + `GithubActivity`(repoRef/kind) + `ConfluenceActivity`(spaceRef/version) + `ActivityMetadata`(scalar only — REQ-032). DTO 는 이 typed surface 의 형식만 검증(raw 본문 0).
- [src/assessment-collection/assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts) — **mirror 대상 패턴**. `@Controller("api/assessment-collection")` + controller-scope `@UsePipes(ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + `@Post + @HttpCode + @UseGuards(JwtAuthGuard, RolesGuard) + @Roles("Admin")` + 생성자 주입 service 에 thin 위임. 본 controller 가 이 구조를 그대로 복제.
- [src/assessment-collection/dto/collect-trigger.dto.ts](../../src/assessment-collection/dto/collect-trigger.dto.ts) — **mirror 대상 DTO 패턴**. class-validator decorator(`@IsString`/`@IsNotEmpty`/`@IsISO8601`/`@IsOptional`) 형식 검증 + "허용 literal 값 검증은 service 책임(@IsIn 미적용)" 주석 관행. 본 DTO 가 nested `Activity[]` 검증에 `@ValidateNested({ each: true })` + `@Type(() => ...)` (class-transformer, 이미 의존) 을 추가로 사용.
- [src/auth/jwt-auth.guard.ts](../../src/auth/jwt-auth.guard.ts) / [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) / [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — RBAC backbone. 신규 추가 0 — import 만(인증 부재 → 401, tier 미달 → 403).
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) — 본 module 에 controller 등록(`controllers: [...]`). `EvaluationOrchestratorService` 가 이미 provider/export 라 추가 provider 0. controller 가 같은 module 내 DI 로 orchestrator 주입.
- [src/app.module.ts](../../src/app.module.ts) — `AssessmentEvaluationModule` 을 `imports` 에 등록(현재 미등록 — controller route 가 런타임에 살아나려면 필요). `AssessmentCollectionModule` 등록 라인 mirror.

## Acceptance Criteria

### 신규/변경 파일 박제

- [ ] **`src/assessment-evaluation/dto/evaluate-activities.dto.ts` 신설** — request body 검증 DTO. `CollectTriggerDto` 패턴 mirror. 핵심:
  - `modelId: string` — `@IsString() @IsNotEmpty()`. `ScoringOptions.modelId` source.
  - `activities` — `Activity[]` 형식. nested object 배열 검증: `@IsArray()` + `@ValidateNested({ each: true })` + `@ArrayMinSize(1)`(빈 배열 거부는 service/orchestrator 가 빈 결과로 처리하나, endpoint 계약상 최소 1 건 요구 — 0 건이면 호출 무의미). nested item 클래스(`ActivityItemDto` 등) 에 `externalId`/`sourceType`/`instanceKey`/`author`/`timestamp`/`metadata` 의 형식 검증(`@IsString`/`@IsNotEmpty`/`@IsObject` 등). `sourceType` 의 "github"/"confluence" literal 값 검증은 형식만(@IsIn 미적용 — `CollectTriggerDto` 의 "literal 값 검증은 service 책임" 관행 정합) 또는 최소한의 `@IsString`.
  - 정의되지 않은 필드 → 400(forbidNonWhitelisted), decorator 위반(필수 누락/wrong type) → 400. raw 본문 필드는 `Activity` schema 에 부재이므로 whitelist 가 자동 차단(REQ-032 구조 보존).
  - 파일 머리 주석에 ADR-0032 §1 정합 + "period/personId bridge 는 후속, 본 DTO 는 `Activity[]` 직접 수신" + REQ-032(raw 본문 0) 명시. `collect-trigger.dto.ts` 주석 스타일 mirror.
- [ ] **`src/assessment-evaluation/assessment-evaluation.controller.ts` 신설** — `@Controller("api/assessment-evaluation")` + controller-scope `@UsePipes(ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. 단일 endpoint:
  - `@Post("evaluate") @HttpCode(200) @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin")` (또는 `@Roles("User")` 이상 — 평가문 요청은 R-9 가 Admin/User 허용; **planner 권장: Admin+ 로 시작**해 collection controller 와 일관, 완화는 후속 결정). `async evaluate(@Body() dto: EvaluateActivitiesDto): Promise<EvaluationResult[]>`.
  - 흐름: dto.activities(검증 통과) 를 `Activity[]` 로, `{ modelId: dto.modelId }` 를 `ScoringOptions` 로 `this.orchestrator.evaluateActivities(...)` 에 그대로 위임 → 반환 `EvaluationResult[]` forward. **orchestration 재구현 0**(분기 없음 — service-layer 가 매핑/dedup/scoring 책임).
  - service-layer error 는 raw forward(controller 추가 변환 0) — orchestrator 가 throw(예: scoreUnit reject 전파)하면 그대로 전파. `EvaluationOrchestratorService` 를 생성자 주입.
  - 파일 머리 주석에 ADR-0032 §Follow-ups 정합 + `AssessmentCollectionController` mirror + RBAC/Validation 근거 + 책임 경계(period bridge·영속화·집계는 후속) 명시.
- [ ] **`src/assessment-evaluation/assessment-evaluation.module.ts` 갱신** — `controllers: [AssessmentEvaluationController]` 추가. `EvaluationOrchestratorService` 가 이미 provider 라 추가 provider 0(같은 module 내 DI resolve). 기존 imports/providers/exports 변경 0. module compile 자기충족(module.spec 으로 검증 — 기존 `assessment-evaluation.module.spec.ts` 에 controller resolve 단언 1+ 추가).
- [ ] **`src/app.module.ts` 갱신** — `AssessmentEvaluationModule` 을 `imports` 에 등록(`AssessmentCollectionModule` 라인 mirror). controller route 가 런타임에 등록되려면 필요. 다른 module wiring 변경 0.
- [ ] **`src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 신설(colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2). `EvaluationOrchestratorService` 는 **mock**(`{ evaluateActivities: jest.fn() }` 또는 `Test.createTestingModule` + `overrideProvider`)으로 주입 — **실 LLM 호출 0 / 실 네트워크 0 / live credential 0**:
  - **happy-path** — 유효한 DTO(activities ≥1 + modelId) 입력 시 `orchestrator.evaluateActivities` 가 정확히 1 회, 올바른 `Activity[]` + `{ modelId }` 인자로 호출되고, 반환 `EvaluationResult[]` 가 그대로 forward 됨 1+ test.
  - **위임 검증** — controller 가 orchestration 을 재구현하지 않고 mock 반환을 그대로 통과시킴(가공 0) 1+ test.
  - **error path** — mock `evaluateActivities` 가 reject(orchestrator/scoreUnit 전파) 시 controller 가 그 error 를 그대로 전파(swallow 0) 1+ test.
  - **DTO validation negative cases(분기마다 1+)** — ValidationPipe 를 통과시키는 방식(`new ValidationPipe(...).transform(plainObj, { metatype: EvaluateActivitiesDto, type: "body" })` 단위 검증 또는 e2e-style HTTP 검증 중 colocated unit 수준으로 가능한 것)으로 각 1+: (i) `modelId` 누락 → 거부. (ii) `activities` 누락/비배열 → 거부. (iii) `activities` 빈 배열(`@ArrayMinSize(1)`) → 거부. (iv) nested activity 필수 필드(예: externalId) 누락 → 거부. (v) 정의 외 추가 필드(forbidNonWhitelisted, 예: raw 본문 필드) → 거부. (vi) wrong type(예: timestamp 가 number) → 거부.
  - **branch/negative** — (i) github activity 만 / (ii) confluence activity 만 / (iii) 혼합 입력 각각 위임 정합 1+(controller 는 source 분기 없이 전부 forward — 분기 없음 명시 가능하나 입력 다양성 cover). (iv) orchestrator 가 빈 `EvaluationResult[]` 반환 시 controller 도 빈 배열 forward 1+.
  - **determinism / no-side-effect** — 동일 DTO + 동일 mock 응답 → 동일 응답 2 회 1+. controller 가 입력 dto 를 변형하지 않음 1+.
  - **RBAC/guard** — guard metadata(`@Roles`/`@UseGuards`) 가 endpoint 에 부착됐는지 reflect-metadata 단언 1+(collection controller spec 패턴 mirror; 실 guard 통합은 e2e 후속).
- [ ] **branch cover** — DTO 의 optional/required 분기, github/confluence nested 분기, orchestrator reject 분기 각 1+. 분기 없는 thin forward 부분은 "분기 없음" 명시.

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 controller/DTO 의 line/function/branch 높은 커버리지 목표(thin delegate 라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인 — app.module 에 module 추가했으나 route 는 RBAC guard 뒤이고 실 LLM 호출 없으므로 기존 smoke/e2e 영향 0. 단 부팅 시 module DI resolve 가 깨지지 않는지는 e2e 부트가 검증).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **period/personId → 수집 → `Activity[]` 변환 bridge / R-9 사용자 지정 기간 요청의 full 계약** — 본 endpoint 는 "이미 수집된 `Activity[]` 직접 수신" 계약만. 기간을 받아 collection orchestration 을 거쳐 `Activity[]` 를 산출하는 bridge 는 collection layer 와의 결합이라 dependency 표면이 커짐 → **별도 후속 slice**. (R-9 의 "임의 기간 지정" 완전 충족은 그 bridge 이후.)
- **일/주/월 aggregate 평가 / batch prompting / 평가 결과 요약(PLAN P5 L97)** — 본 controller 는 orchestrator 의 per-unit 목록 평가만 노출. 집계·요약 endpoint 는 후속 slice(ADR-0032 §2 batch 경계).
- **실 LLM 호출 / live endpoint / 실 provider API key / LLM_APIKEY_ENC_KEY 주입** — orchestrator 는 test 에서 **mock** 만. 실 네트워크 round-trip / live credential 은 §5 credential 게이트(미승인) → 별도 후속 task(deferred).
- **새 외부 dependency 추가** — 기존 NestJS + class-validator + class-transformer(이미 의존) + orchestrator 만. octokit/axios/sdk 등 추가 0 (§5 dependency 게이트 미발화). class-validator/class-transformer 가 package.json 에 없으면 그 자체가 BLOCKED(§5) — 본 task 진입 전 implementer 가 `collect-trigger.dto.ts` 가 이미 그것을 쓰는지로 확인(쓰고 있으면 의존 존재).
- **평가 결과 영속화 / Prisma migration / `EvaluationResult` → Assessment·Contribution row 매핑** — §5 schema 게이트 deferred(ADR-0032 §Consequences). 본 controller 는 in-memory `EvaluationResult[]` 반환만 — DB write 0.
- **e2e HTTP 통합 spec(supertest 로 실 부팅 + RBAC/Validation 통합 검증)** — collection 의 T-0275 식 e2e slice mirror 로 **별도 후속**. 본 task 는 colocated controller unit(orchestrator mock) + module compile spec 까지. (단 `pnpm test:e2e` 가 app 부팅을 깨지 않는지는 본 task 의 통과 명령에서 확인.)
- **`evaluateActivities` / `ScoringOptions` / `Activity` / `EvaluationResult` 시그니처 변경** — 전부 박제 완료(import·주입·forward 만, 새 정의 0). 새 타입은 request DTO(`EvaluateActivitiesDto` + nested `ActivityItemDto`)만 신설 — orchestrator 계약 타입은 재사용.
- **PLAN.md L96/L98(단위 평가·R-9 bullet) `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 평가 종료 아님(period bridge + 영속화 후속 필요). 후속 slice 완결 후 별도 doc-sync.
- **ADR-0032 PROPOSED→ACCEPTED status flip + §2/§3 difficulty 주입 문구 doc-sync** — T-0291 reviewer MINOR follow-up. ADR status 전환은 별도 direct doc task — 본 코드 slice 와 분리(§3.1 commitMode mix 금지).

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 §1/§Follow-ups + `AssessmentCollectionController`(T-0274) 패턴이 박제 완료, controller 는 기존 orchestrator 의 thin HTTP delegate + 검증 DTO). RBAC tier(Admin+ 시작) · validation pipe 옵션 · nested DTO 검증 방식은 implementer 가 collection controller/DTO mirror 로 결정하는 수준이라 ADR 불요(새 도메인 결정 0 — 기존 패턴 복제). implementer 가 `evaluate-activities.dto.ts` + `assessment-evaluation.controller.ts` 신설 + module/app.module 갱신, tester 가 colocated controller spec 작성 + orchestrator mock + R-112 4 종 + DTO validation negative + RBAC metadata 단언 + coverage 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
