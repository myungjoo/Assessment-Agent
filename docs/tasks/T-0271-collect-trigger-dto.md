---
id: T-0271
title: CollectTriggerDto 신설 — collection manual-trigger endpoint request body 계약
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-040, REQ-029, REQ-031]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-07
plannerNote: "P4 호출처 결선 impl slice #1/5 (ADR-0031 Follow-up #1 DTO) — dependency-first chain 첫 slice, R-112 backbone ×1.5"
---

# T-0271 — CollectTriggerDto 신설 — collection manual-trigger endpoint request body 계약

## Why

[ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md) 가 caller 0 이던 collection backbone 의 호출처를 manual HTTP endpoint(`POST /api/assessment-collection/collect`)로 박제했고, 그 impl 을 dependency-first 5 slice 로 분할했다 (Follow-up #1 DTO → #2 orchestration service → #3 controller → #4 e2e → #5 doc-sync). 본 task 는 **#1 DTO slice** — endpoint 의 request body 계약(`CollectTriggerDto`)을 class-validator 데코레이터로 박제하는 가장 의존성이 적은 첫 slice 다. ADR-0031 §2 의 `{ personId: string; period: string; scope: string; periodStart?: string(ISO-8601) }` 계약을 1:1 구현한다. REQ-040(manual trigger) 의 입력 검증 진입점이자 후속 service/controller slice 가 의존하는 형식 계약이다.

## Required Reading

- `docs/decisions/ADR-0031-collection-manual-trigger.md` — 특히 **§2 manual-trigger endpoint 계약** (request body `CollectTriggerDto` 의 4 필드 + `@IsOptional() @IsISO8601()` periodStart + ValidationPipe whitelist/forbidNonWhitelisted/transform) 와 §1 (periodStart = 수집 경계 timestamp, 미제공 시 서버 now() — 단 now() fallback 은 후속 orchestration slice 책임, DTO 는 형식만).
- `src/user/dto/create-assessment.dto.ts` — mirror 할 기존 DTO 패턴 (personId/period/scope 의 `@IsString() @IsNotEmpty()` + 한국어 책임-경계 주석 스타일). **단 periodStart 는 본 패턴의 `@Type(() => Date) @IsDate()` 가 아니라 ADR-0031 §2 가 명시한 `@IsOptional() @IsISO8601()` (string 유지)** 를 따른다 — 차이 사유는 아래 Acceptance Criteria 참조.
- `src/user/dto/create-assessment.dto.spec.ts` — colocated spec 패턴 (`reflect-metadata` import + `plainToInstance` + `validate` + `validPayload` base + `withoutField` helper 로 누락 negative 생성). 본 task 의 spec 이 1:1 mirror 할 구조.
- `src/user/dto/create-person.dto.ts` (선택) — `@IsString() @IsNotEmpty()` 최소 DTO 의 추가 reference.

## Acceptance Criteria

- [ ] `src/assessment-collection/dto/collect-trigger.dto.ts` (모듈 관례상 `dto/` 하위, ADR-0031 §4 가 DTO 를 `AssessmentCollectionModule` 에 배치) 에 `CollectTriggerDto` class 를 신설한다. 필드 (ADR-0031 §2 verbatim):
  - `personId: string` — `@IsString() @IsNotEmpty()`.
  - `period: string` — `@IsString() @IsNotEmpty()` (허용 literal 검증은 `AssessmentService` 책임 — DTO 는 형식만, create-assessment.dto.ts mirror).
  - `scope: string` — `@IsString() @IsNotEmpty()`.
  - `periodStart?: string` — `@IsOptional() @IsISO8601()`. **string 유지** (create-assessment.dto.ts 의 `@Type(()=>Date) @IsDate()` 와 다름 — ADR-0031 §2 가 ISO-8601 string 계약 + §1 의 "미제공 시 서버 now()" fallback 을 orchestration slice 가 처리하기 때문. 본 차이를 DTO 파일 주석에 한 줄 명시).
- [ ] DTO 파일에 한국어 책임-경계 주석 (create-assessment.dto.ts 스타일): 본 DTO 가 ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합되어 정의 외 필드 → 400, decorator 위반 → 400 을 강제함을 명시. literal(period/scope) 값 검증은 service 책임이라 `@IsIn` 미적용을 명시.
- [ ] colocated spec `src/assessment-collection/dto/collect-trigger.dto.spec.ts` 작성 (create-assessment.dto.spec.ts mirror — `reflect-metadata` + `plainToInstance` + `validate`):
  - **Happy-path**: 정상 payload (4 필드 모두 + periodStart 포함) 의 `validate()` errors 가 빈 배열 (R-112 #1).
  - **Happy-path 분기**: `periodStart` **미제공** payload 도 errors 빈 배열 (`@IsOptional` 분기 — periodStart optional 이 정상 통과) (R-112 #3 분기 cover).
  - **Error/Negative — 빈 personId**: `personId: ""` → `isNotEmpty` constraint 포함 errors (R-112 #2).
  - **Negative — 잘못된 periodStart 형식**: `periodStart: "not-a-date"` (또는 `"2026-13-99"`) → `isISO8601` constraint 포함 errors.
  - **Negative — period/scope 타입 mismatch**: `period: 123` / `scope: {}` (number/object) → `isString` constraint 포함 errors (각 1+).
  - **Negative — 미정의 필드(forbidNonWhitelisted)**: ValidationPipe 의 forbidNonWhitelisted 동작을 spec 레벨에서 검증 (`validate(instance, { whitelist: true, forbidNonWhitelisted: true })` 로 정의 외 키 `foo: "bar"` 가 `whitelistValidation` error 를 발생, 또는 plainToInstance 후 정의 외 키 부재 확인 — create-assessment.dto.spec.ts 의 raw-key 부재 검증 패턴 mirror).
  - **Negative — personId 누락**: `withoutField("personId")` → errors 비어있지 않음.
- [ ] 위 negative 들이 예외 상황(빈 입력 · type mismatch · 형식 오류 · 정의 외 필드)을 분기마다 cover (R-112 #4 — 단일 negative 금지).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (tester 가 R-110 따라 실행 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global` 강제). DTO 는 데코레이터만이라 자체 coverage 는 spec 의 plainToInstance/validate 호출로 충족.
- [ ] `scripts/check-spec-presence.sh` 통과 (신규 production `.ts` 에 colocated spec 동반 — colocated 위치 의무 충족).

## Out of Scope

- **`CollectionTriggerService` orchestration (ADR-0031 §3 6단계)** — Follow-up #2 slice. 본 task 는 DTO + spec 만.
- **`PersonService.findByIdWithIdentities` (serviceIdentities include read)** — Follow-up #2 slice.
- **`AssessmentCollectionController` (POST /collect, RBAC, ValidationPipe 배선)** — Follow-up #3 slice.
- **`AuthModule` import / module.ts 배선** — Follow-up #3 slice (controller 가 들어올 때).
- **e2e spec (`test/e2e/`)** — Follow-up #4 slice.
- **modules.md / api.md doc-sync** — Follow-up #5 slice (direct).
- `period`/`scope`/`difficulty` 의 허용 literal 값(`@IsIn`) 검증 — service 책임 (ADR-0031 §2, create-assessment.dto.ts 패턴 정합). DTO 는 형식 검증만.
- `periodStart` 의 now() fallback 채움 — orchestration slice 책임. DTO 는 형식만 검증하고 optional 통과.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0031 §2 가 DTO 계약을 이미 박제, 기존 create-assessment.dto.ts 패턴 mirror).

## Follow-ups

- (ADR-0031 chain 잔여) #2 orchestration service slice — `CollectionTriggerService`(§3 6단계) + `PersonService.findByIdWithIdentities` + colocated spec (R-112 §5 a~f).
- (ADR-0031 chain 잔여) #3 controller slice — `AssessmentCollectionController`(POST /collect, RBAC, ValidationPipe) + `AuthModule` import + module.spec 회귀.
- (ADR-0031 chain 잔여) #4 e2e slice — `test/e2e/assessment-collection-trigger.e2e-spec.ts` (201/401/403/404/400, mocked adapter).
- (ADR-0031 chain 잔여) #5 doc-sync slice (direct) — modules.md + api.md.
