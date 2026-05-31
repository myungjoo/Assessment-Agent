---
id: T-0119
title: SummaryController + CreateSummaryDto + /api/summaries endpoint
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-034, REQ-035, REQ-036, REQ-037, REQ-038]
estimatedDiff: 480
estimatedFiles: 5
created: 2026-05-31
sizeExempt: true
exemptReason: "R-112 4-카테고리 HTTP backbone (controller + colocated controller spec + DTO + DTO spec + e2e) × 1.5 — T-0117/T-0118 actual ~1000+ LOC 1:1 mirror. 4 endpoint × (happy + error envelope + branch + negative 충분) unit spec + e2e spec 2 layer test mass. Summary 는 @@unique 부재 → P2002 sub-multiplier 미적용. estimatedDiff 480 cap 초과이나 indivisible controller+DTO+spec+e2e slice, T-0117/T-0118 precedent 정당화 (5 신규/수정 파일, cap 5 file 안)."
plannerNote: "P3 controller mirror chain 3/3 종결 — Assessment(T-0117)/Contribution(T-0118) 직후 SummaryController. plain controller over 기존 SummaryService(T-0116), §5 미발동."
dependsOn: [T-0116, T-0117, T-0118]
---

# T-0119 — SummaryController + CreateSummaryDto + /api/summaries endpoint

## Why

PLAN.md Phase P3 "평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)" bullet 의 일·주·월 요약 half 를 HTTP-facing layer 로 노출한다. ADR-0006 chain (schema T-0110 + repository T-0111~T-0113 + service T-0114~T-0116) 완결 후, controller mirror chain 이 AssessmentController (T-0117, PR-119) → ContributionController (T-0118, PR-120) 로 진행됐다. 본 task 는 그 chain 의 **3번째이자 마지막 slice** — 이미 머지된 SummaryService (T-0116) 가 노출한 4 primitive (create / findById / findByPerson / remove — Summary 는 immutable 이라 update 없음) 위에 REST endpoint 를 노출한다. Summary 는 일/주/월 단위 요약 평가 (REQ-034/035) + LLM 정성 narrative + 정규화 metricScore (REQ-036) 이고 raw 본문 컬럼 0 (R-59) — DTO 도 raw 키 미정의 + whitelist 로 정합. 본 task 머지로 ADR-0006 trio 의 HTTP-facing layer 가 완성된다.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §3 (Summary model 컬럼·type·period enum-as-String literal 집합 `day`/`week`/`month` + immutable invariant) + Decision §4 (raw 미저장 R-59 — narrative 는 LLM 생성 결과물이라 R-59 적용 외) + §6 (Person 삭제 시 Summary onDelete Cascade)
- `src/user/summary.service.ts` — 본 controller 가 호출할 service. 4 메서드 시그니처 (create / findById / findByPerson / remove) + HttpException 변환 (P2003 personId FK → BadRequest / null·P2025 → NotFound / period literal 위반 → BadRequest / P2002 미변환 re-throw — Summary 는 `@@unique` 부재)
- `src/user/summary.repository.ts` — `SummaryCreateInput` 5 키 (personId / period / periodStart / narrative / metricScore) + `SummaryFindByPersonOptions` (period?) — DTO field + GET query 정합 source. periodStart 는 `Date` 타입 (Contribution 과 달리 Date 컬럼 존재).
- `src/user/assessment.controller.ts` — **1:1 mirror 대상** (Contribution 보다 Assessment 가 더 가까움 — Summary 의 finder 가 `findByPerson(personId, {period?})` 로 Assessment 와 동일 시그니처). controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + service HttpException 자동 status mapping + `@HttpCode(201/204)` + `@Query("personId")`/`@Query("period")` 2 query + Param/Body decorator 패턴
- `src/user/dto/create-assessment.dto.ts` — **DTO mirror 대상**. class-validator decorator 패턴 + `periodStart` 의 `@Type(() => Date)` + `@IsDate()` 변환 (Summary 도 periodStart Date 컬럼 보유 → 동일 처리) + narrative `@IsString @IsNotEmpty` + raw 키 미정의 정합. (Summary 는 scope/difficulty 컬럼 부재 → 해당 field 없음.)
- `src/user/dto/create-assessment.dto.spec.ts` — **colocated DTO spec mirror 대상** (check-spec-presence.sh CI gate 강제 — 신규 DTO 마다 colocated `*.dto.spec.ts` 1:1 필수. T-0117 round-1 CI fail 의 원인이었음 — 본 task 도 동일 spec 의무)
- `src/user/assessment.controller.spec.ts` — **colocated controller spec mirror 대상**. service mock 패턴 + 4 endpoint happy/error/branch/negative test
- `test/e2e/assessments.e2e-spec.ts` — **e2e mirror 대상**. createE2EApp + truncateAll + 실 PostgreSQL seed (FK 인 Person row 선행 seed 후 Summary 생성) + 4 endpoint happy + 4xx envelope 검증
- `src/user/user.module.ts` — SummaryController 를 `controllers` 배열에 등록 (AssessmentController/ContributionController 등록 패턴 mirror). SummaryService 는 이미 `providers` 에 등록됨 (T-0116) — 중복 추가 금지.
- `scripts/check-spec-presence.sh` — **CI gate**. 신규 `.ts` source 마다 colocated `.spec.ts` 1:1 필수 (본 task 의 DTO/controller 모두 colocated spec 필수)

## Acceptance Criteria

- [ ] `src/user/dto/create-summary.dto.ts` 신설 — `SummaryCreateInput` 5 키 (personId / period / periodStart / narrative / metricScore) 정합. raw 본문 키 (rawBody / content / diff / message / commitBody 등) 절대 미정의 (R-59 DTO-level). 형식 검증만: personId·period·narrative `@IsString @IsNotEmpty` / periodStart `@Type(() => Date) @IsDate()` (create-assessment.dto.ts mirror) / metricScore `@IsNumber` (Prisma Decimal 컬럼, transform 으로 numeric→number). period 의 enum literal 값 검증은 service 책임이므로 `@IsIn` 미적용 (create-assessment.dto.ts 정합). narrative 는 LLM 생성 결과물 (R-59 적용 외 — DTO 에 정상 field).
- [ ] `src/user/summary.controller.ts` 신설 — `@Controller("api/summaries")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. 4 endpoint:
  - `GET /api/summaries?personId=<id>&period=<day|week|month>` → `service.findByPerson(personId, period !== undefined ? { period } : undefined)` (200 + 배열, 매칭 0 시 빈 배열). `personId` 누락/빈 string 시 controller 가 `BadRequestException` (400) 강제 (assessment.controller.ts 의 personId 누락 패턴 mirror). period 가 허용 집합 밖이면 service 가 BadRequestException → 400.
  - `GET /api/summaries/:id` → `service.findById(id)` (200, row 부재 시 service NotFoundException → 404).
  - `POST /api/summaries` → `service.create(dto)` (`@HttpCode(201)`. ValidationPipe 위반 400 / period literal 위반 → service BadRequest 400 / personId FK 위반 → service BadRequest 400 (P2003 변환)). Summary 는 `@@unique` 부재 → ConflictException(409) 분기 없음.
  - `DELETE /api/summaries/:id` → `service.remove(id)` (`@HttpCode(204)`, row 부재 시 service NotFoundException → 404).
- [ ] `src/user/user.module.ts` 의 `controllers` 배열에 `SummaryController` 등록 (AssessmentController/ContributionController mirror). SummaryService 는 이미 `providers` 에 등록됨 (T-0116) — 중복 추가 금지.
- [ ] **colocated DTO spec** `src/user/dto/create-summary.dto.spec.ts` 신설 (check-spec-presence.sh CI gate 강제 — 누락 시 CI fail). happy-path validation 통과 1 + per-field negative (각 field 누락/wrong type 위반 시 validation error — 특히 periodStart 의 잘못된 date string 은 400) + raw 키 (rawBody 등) 포함 시 whitelist reject 검증. (create-assessment.dto.spec.ts mirror, `reflect-metadata` import 필수.)
- [ ] **colocated controller spec** `src/user/summary.controller.spec.ts` 신설 (check-spec-presence.sh CI gate 강제) — SummaryService mock 으로 4 endpoint 검증:
  - **Happy-path** (R-112 ①): 4 endpoint 각 정상 호출 1+ (findByPerson 200 배열 / findById 200 / create 201 / remove 204 — service 호출 인자 + return 정합).
  - **Error path** (R-112 ②): findById/remove 의 service NotFoundException propagate / create 의 service BadRequestException (period literal·FK) propagate — controller 가 추가 변환 0, raw forward 검증.
  - **Branch** (R-112 ③): `findByPerson` 의 `personId` 존재/누락 2 분기 (존재 → service 호출 / 누락·빈 string → BadRequestException 400) + `period` 존재/미지정 2 분기 (존재 → `{ period }` options forward / undefined → undefined forward).
  - **Negative 충분 cover** (R-112 ④): personId 누락 + personId 빈 string + service 의 period literal 위반 BadRequest + FK 위반 BadRequest + findById 404 + remove 404 — 예외 분기마다 각 1+ test.
- [ ] **e2e** `test/e2e/summaries.e2e-spec.ts` 신설 (R-113) — createE2EApp + truncateAll. **FK 선행 seed 주의**: Summary.personId 는 Person N:1 FK → Person row 를 먼저 seed 한 후 Summary 생성. 검증: 4 endpoint happy (POST 201 → GET :id 200 → GET ?personId= 200 배열 → DELETE 204) + 4xx envelope (POST raw 키 포함 400 / POST period literal 위반 400 / GET 미존재 :id 404 / DELETE 미존재 :id 404 / GET ?personId 누락 400). (assessments.e2e-spec.ts mirror.)
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 controller / DTO 는 100% 근접 목표.
- [ ] tester 가 unit (`pnpm test`) + smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 결과 확인 (R-110 / R-113).

## Out of Scope

- **AuthGuard / RBAC 적용 안 함** — 기존 Person/Group/Part/Assessment/Contribution controller 가 모두 AuthGuard 미적용 (auth credential 흐름 별도 task). api.md 의 auth tier (User+ / Admin+) 강제는 후속 AuthGuard task 책임. 본 task 가 auth/security 모델 변경 0 (CLAUDE.md §5 미발동). guard wiring 0.
- **api.md 갱신** — api.md §5 endpoint 표에 `/api/summaries` row 추가는 doc-only direct follow-up 으로 분리 (본 task 는 src/ + test/ pr-mode code 만). T-0117/T-0118 의 동일 defer 패턴 mirror.
- **PATCH (update) endpoint** — Summary 는 immutable (ADR-0006 §3, service 에 update 메서드 부재 — 재계산은 hard delete 후 재생성).
- **Group/Part view-time aggregate Summary 계산** — 별도 task (P5 evaluation pipeline 의존).
- **응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / filter query param** — Prisma return 그대로 (기존 controller 동일 정책).
- **getPrismaErrorCode / ValidationPipe option / VALID_PERIODS / literal 검증 helper 공용화 refactor** — 기존 controller/service 를 건드리면 diff 확장 + 회귀 위험. 별도 refactor follow-up.
- **`/api/persons/:personId/summaries` nested route** — flat `/api/summaries?personId=` 채택 (assessment.controller.ts 의 `?personId=` query 패턴 mirror). nested route 는 별도 결정.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 가 모든 컬럼/literal/invariant 결정 박제 + AssessmentController/CreateAssessmentDto/assessments.e2e-spec.ts 가 controller+DTO+spec+e2e mirror 패턴 제공).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
