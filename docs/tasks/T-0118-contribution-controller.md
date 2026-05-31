---
id: T-0118
title: ContributionController + CreateContributionDto + /api/contributions endpoint
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036]
estimatedDiff: 470
estimatedFiles: 5
created: 2026-05-31
sizeExempt: true
exemptReason: "R-112 4-카테고리 HTTP backbone (controller + colocated controller spec + DTO + DTO spec + e2e) × 1.5 — T-0117 actual ~1059 LOC 1:1 mirror. 4 endpoint × (happy + error envelope + branch + negative 충분) unit spec + e2e spec 2 layer test mass. estimatedDiff 470 cap 초과이나 indivisible controller+DTO+spec+e2e slice, T-0117 precedent 정당화."
plannerNote: "P3 controller mirror chain — AssessmentController(T-0117) 직후 ContributionController. plain controller over 기존 ContributionService(T-0115), §5 미발동."
dependsOn: [T-0115, T-0117]
completedAt: 2026-05-31T18:43:00+09:00
mergedAs: 5a0ae0e
prNumber: 120
reviewRounds: 1
---

# T-0118 — ContributionController + CreateContributionDto + /api/contributions endpoint

## Why

PLAN.md Phase P3 "평가 결과 저장 모델 (commit/document 단위)" + "평가 대상 인원 관리" bullet 의 HTTP-facing layer 진행. ADR-0006 chain (schema T-0110 + repository T-0111~T-0113 + service T-0114~T-0116) 완결 후, AssessmentController (T-0117, PR-119 sha 91331f7) 가 첫 HTTP-facing slice 를 박제했다. 본 task 는 그 controller mirror chain 의 2번째 — 이미 머지된 ContributionService (T-0115) 가 노출한 4 primitive (create / findById / findByAssessment / remove — Contribution 은 immutable 이라 update 없음) 위에 REST endpoint 를 노출한다. Contribution 은 개별 commit/PR/문서 단위 기여 데이터 (REQ-033) 이고 raw 본문 컬럼 0 (R-59 / REQ-032) — DTO 도 raw 키 미정의 + whitelist 로 정합.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §2 (Contribution model 컬럼·type·enum-as-String literal 집합 sourceType `commit`/`pr`/`document` + difficulty `easy`/`medium`/`hard`) + Decision §4 (raw 미저장 R-59) + §6 (Assessment 삭제 시 Contribution onDelete Cascade)
- `src/user/contribution.service.ts` — 본 controller 가 호출할 service. 4 메서드 시그니처 (create / findById / findByAssessment / remove) + HttpException 변환 (P2003 → BadRequest / null·P2025 → NotFound / P2002 미변환 re-throw — Contribution 은 `@@unique` 부재)
- `src/user/contribution.repository.ts` — `ContributionCreateInput` 7 키 (assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume) — DTO field 정합 source
- `src/user/assessment.controller.ts` — **1:1 mirror 대상**. controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + service HttpException 자동 status mapping + `@HttpCode(201/204)` + Query/Param/Body decorator 패턴
- `src/user/dto/create-assessment.dto.ts` — **DTO mirror 대상**. class-validator decorator 패턴 (@IsString/@IsNotEmpty/@IsNumber/@IsInt/@Min) + raw 키 미정의 정합. (Contribution 은 periodStart 없음 → @Type(()=>Date) 불요)
- `src/user/dto/create-assessment.dto.spec.ts` — **colocated DTO spec mirror 대상** (이것이 T-0117 round-1 CI fail 을 해소한 spec — 본 task 도 동일 spec 의무)
- `src/user/assessment.controller.spec.ts` — **colocated controller spec mirror 대상**. service mock 패턴 + 4 endpoint happy/error/branch/negative test
- `test/e2e/assessments.e2e-spec.ts` — **e2e mirror 대상**. createE2EApp + truncateAll + 실 PostgreSQL seed (FK 인 Assessment row 선행 seed 후 Contribution 생성) + 4 endpoint happy + 4xx envelope 검증
- `src/user/user.module.ts` — ContributionController 를 `controllers` 배열에 등록 (AssessmentController 등록 패턴 mirror)
- `scripts/check-spec-presence.sh` — **CI gate**. 신규 `.ts` source 마다 colocated `.spec.ts` 1:1 필수 (T-0117 round-1 CI fail 의 원인 — 본 task 의 DTO/controller 모두 colocated spec 필수)

## Acceptance Criteria

- [ ] `src/user/dto/create-contribution.dto.ts` 신설 — `ContributionCreateInput` 7 키 (assessmentId / sourceType / sourceUrl / sourceRef / difficulty / contributionScore / volume) 정합. raw 본문 키 (rawBody / content / diff / message 등) 절대 미정의 (R-59 DTO-level). 형식 검증만 (@IsString / @IsNotEmpty / @IsNumber / @IsInt / @Min(0)) — enum literal 값 검증은 service 책임이므로 @IsIn 미적용 (create-assessment.dto.ts 정합).
- [ ] `src/user/contribution.controller.ts` 신설 — `@Controller("api/contributions")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. 4 endpoint:
  - `GET /api/contributions?assessmentId=<id>` → `service.findByAssessment(assessmentId)` (200 + 배열, 매칭 0 시 빈 배열). `assessmentId` 누락/빈 string 시 controller 가 `BadRequestException` (400) 강제 (assessment.controller.ts 의 personId 누락 패턴 mirror).
  - `GET /api/contributions/:id` → `service.findById(id)` (200, row 부재 시 service NotFoundException → 404).
  - `POST /api/contributions` → `service.create(dto)` (`@HttpCode(201)`. ValidationPipe 위반 400 / literal 위반 → service BadRequest 400 / assessmentId FK 위반 → service BadRequest 400).
  - `DELETE /api/contributions/:id` → `service.remove(id)` (`@HttpCode(204)`, row 부재 시 service NotFoundException → 404).
- [ ] `src/user/user.module.ts` 의 `controllers` 배열에 `ContributionController` 등록 (AssessmentController mirror). ContributionService 는 이미 `providers` 에 등록됨 (T-0115) — 중복 추가 금지.
- [ ] **colocated DTO spec** `src/user/dto/create-contribution.dto.spec.ts` 신설 (check-spec-presence.sh CI gate 강제 — 누락 시 T-0117 round-1 처럼 CI fail). happy-path validation 통과 1 + per-field negative (각 field 누락/wrong type 위반 시 validation error) + raw 키 (rawBody 등) 포함 시 whitelist reject 검증. (create-assessment.dto.spec.ts mirror, `reflect-metadata` import 필수.)
- [ ] **colocated controller spec** `src/user/contribution.controller.spec.ts` 신설 (check-spec-presence.sh CI gate 강제) — ContributionService mock 으로 4 endpoint 검증:
  - **Happy-path** (R-112 ①): 4 endpoint 각 정상 호출 1+ (findByAssessment 200 배열 / findById 200 / create 201 / remove 204 — service 호출 인자 + return 정합).
  - **Error path** (R-112 ②): findById/remove 의 service NotFoundException propagate / create 의 service BadRequestException (literal·FK) propagate — controller 가 추가 변환 0, raw forward 검증.
  - **Branch** (R-112 ③): `findByAssessment` 의 `assessmentId` 존재/누락 2 분기 (존재 → service 호출 / 누락·빈 string → BadRequestException 400).
  - **Negative 충분 cover** (R-112 ④): assessmentId 누락 + assessmentId 빈 string + service 의 literal 위반 BadRequest + FK 위반 BadRequest + findById 404 + remove 404 — 예외 분기마다 각 1+ test.
- [ ] **e2e** `test/e2e/contributions.e2e-spec.ts` 신설 (R-113) — createE2EApp + truncateAll. **FK 선행 seed 주의**: Contribution.assessmentId 는 Assessment N:1 FK → Assessment(그 FK 인 Person) row 를 먼저 seed 한 후 Contribution 생성. 검증: 4 endpoint happy (POST 201 → GET :id 200 → GET ?assessmentId= 200 배열 → DELETE 204) + 4xx envelope (POST raw 키 포함 400 / POST literal 위반 400 / GET 미존재 :id 404 / DELETE 미존재 :id 404 / GET ?assessmentId 누락 400). (assessments.e2e-spec.ts mirror.)
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 controller / DTO 는 100% 근접 목표.
- [ ] tester 가 unit (`pnpm test`) + smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 결과 확인 (R-110 / R-113).

## Out of Scope

- **SummaryController** — 별도 후속 slice (controller mirror chain 의 3번째). 본 task 는 Contribution 만.
- **AuthGuard / RBAC 적용 안 함** — 기존 Person/Group/Part/Assessment controller 가 모두 AuthGuard 미적용 (auth credential 흐름 별도 task). api.md 의 auth tier (User+ / Admin+) 강제는 후속 AuthGuard task 책임. 본 task 가 auth/security 모델 변경 0 (CLAUDE.md §5 미발동). guard wiring 0.
- **api.md 갱신** — api.md §5 endpoint 표에 `/api/contributions` row 가 아직 부재 (현재 `/api/assessments` prefix 만 박제). doc-only direct follow-up 으로 분리 (본 task 는 src/ + test/ pr-mode code 만).
- **PATCH (update) endpoint** — Contribution 은 immutable (ADR-0006 §2, service 에 update 메서드 부재).
- **응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / filter query param** — Prisma return 그대로 (기존 controller 동일 정책).
- **getPrismaErrorCode / ValidationPipe option / literal 검증 helper 공용화 refactor** — 기존 controller/service 를 건드리면 diff 확장 + 회귀 위험. 별도 refactor follow-up.
- **`/api/assessments/:assessmentId/contributions` nested route** — flat `/api/contributions?assessmentId=` 채택 (assessment.controller.ts 의 `?personId=` query 패턴 mirror). nested route 는 별도 결정.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 가 모든 컬럼/literal/invariant 결정 박제 + AssessmentController/CreateAssessmentDto/assessments.e2e-spec.ts 가 controller+DTO+spec+e2e mirror 패턴 제공).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
