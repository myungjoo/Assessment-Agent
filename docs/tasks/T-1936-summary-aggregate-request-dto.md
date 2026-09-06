---
id: T-1936
title: 좌표 종합 코멘트 생성 요청 DTO 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 430
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-summary-aggregate-http
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/summary-aggregate-request.dto.ts
  - src/assessment-evaluation/dto/summary-aggregate-request.dto.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 430 LOC (nested DTO 2 클래스 · 11 필드 형식 검증 + colocated spec negative 8 종), T-1934 선례(+528). 소비처(controller endpoint + controller spec) 동반 시 ~660 LOC · 4 파일로 cap 2 배 초과 — PLAN 182 행 예외를 수치로 제시하고 소비처 slice 를 Follow-up (a) 에 파일 · 배선 단위로 명시"
plannerNote: "P5 REQ-004 잔여 축 — 좌표 종합 코멘트 chain 의 HTTP 진입점 0 을 여는 배선 1/2 (요청 DTO)"
---

# T-1936 — 좌표 종합 코멘트 생성 요청 DTO 신설

## Why

[docs/requirements.md](../requirements.md) `23 행` REQ-004 의 미충족 축 중 하나가 **"좌표 종합 코멘트의 HTTP 진입점 부재"** 다 — 좌표 종합 코멘트 chain (`SummaryNarrativeService.generateBatchNarrative` → `SummaryPersistService.persistSummary` → `SummaryAggregateOrchestratorService.evaluateAndPersist` → `SummaryBatchOrchestratorService`) 은 module provider/export 까지 등록돼 있으나 **HTTP caller 가 0** 이라 "지정 기간의 주요 활동 종합 요약" 이 API 로 도달하지 않고 단위별 평가문만 노출된다. 본 task 는 그 진입점의 입력 계약(request body DTO)을 먼저 닫는 배선 1/2 이고, route 배선은 Follow-up (a) 다 (PLAN.md `94 행` Phase P5 evaluation pipeline).

**issue-still-relevant pre-check (origin/main `cbe7c402` 실측)** — ① `SummaryAggregateOrchestratorService` / `SummaryBatchOrchestratorService` 의 spec 제외 참조가 `assessment-evaluation.module.ts` 등록 행 + 두 service 자기 파일 + domain 주석뿐이라 **controller 주입 0** 확인. ② `assessment-evaluation.controller.ts` 의 route 는 `247`·`400`·`614`·`675`·`752 행` `@Post` 5 개 + `803 행` `@Get("relative-comparison")` 1 개뿐이고 요약(summary) route 0. ③ `SummaryAggregateRequestDto` / `summary-aggregate-request` 히트 0 행 — DTO 부재. 구멍 유효(재큐잉 아님).

**오너 지시 게이트** — PLAN `157 행` R-91 · `158 행` R-92 는 미접촉 (`test/perf/` 파일 0 개 변경, k6 부하 축과 경합 없음). `182 행` 소비처 동반 의무는 소비처 포함 시 `~660 LOC · 4 파일` 로 cap 2 배 초과라 예외를 수치로 제시하고 (frontmatter `exemptReason`) 소비처 slice 를 Follow-up (a) 에 파일 · 배선 단위로 명시한다 (T-1931 → T-1932~T-1934 선례 동형). `183 행` REQ 재판정 once-rule 에 따라 REQ-004 재판정은 배선 2/2 머지 뒤 **1 회** (Follow-up (c)) — 본 task 는 `docs/requirements.md` 를 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — nested DTO(`ActivityItemDto`) + `@ValidateNested` / `@Type` / `forbidNonWhitelisted` 관행의 단일 선례. 본 DTO 가 mirror 할 형식-검증-only 계약(허용 literal 은 service 책임, `@IsIn` 미적용)이 파일 머리 주석에 박제돼 있다.
- `src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts` — nested DTO 의 colocated spec 관행 (validate 결과 constraint 키 단언 방식).
- `src/assessment-evaluation/dto/relative-comparison-query.dto.ts` — 직전 slice(T-1934)의 DTO 관행 (주석 밀도 · `@IsISO8601` 적용 기준).
- `src/assessment-evaluation/domain/evaluation-result.ts` `54~70 행` — nested unit DTO 가 형식 검증할 `EvaluationResult` 5 필드 (`unitId` / `narrative` / `difficulty` / `contribution` / `volume`).
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` `105~130 행` — 후속 소비처 `evaluateAndPersist(context, results, mode, options, now)` 의 5 인자 계약 (본 DTO 가 무엇을 실어 날라야 하는지의 근거).
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` `27~32 행` — 좌표 타입 `SummaryBatchContext` (`personId` / `period` / `periodStart: Date`). DTO 는 `periodStart` 를 ISO 문자열로 받고 `Date` 변환은 소비처 책임임을 주석에 박제할 것.
- `src/assessment-evaluation/summary-persist.service.ts` `55~58 행` (`SummaryPersistOptions.modelId`) + `src/assessment-evaluation/evaluation-result-persist.service.ts` `45 행` (`PersistMode = "fill" | "reeval"`) — `mode` / `modelId` 필드의 허용 literal 단일 출처 (DTO 는 형식만 검증).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/summary-aggregate-request.dto.ts` 신설 — export 클래스 2 개:
  - `SummaryAggregateUnitResultDto` (nested, 5 필드): `unitId`(`@IsString` + `@IsNotEmpty`) · `narrative`(`@IsString`, 빈 문자열 허용 — 빈 묶음 · 빈 평가문을 prompt 가 흡수하는 기존 계약 보존) · `difficulty`(`@IsString` + `@IsNotEmpty`) · `contribution`(`@IsString` + `@IsNotEmpty`) · `volume`(`@IsInt` + `@Min(0)`).
  - `SummaryAggregateRequestDto` (6 필드): `personId` · `period` · `mode` · `modelId`(각 `@IsString` + `@IsNotEmpty`) · `periodStart`(`@IsString` + `@IsNotEmpty` + `@IsISO8601`) · `results`(`@IsArray` + `@ValidateNested({ each: true })` + `@Type(() => SummaryAggregateUnitResultDto)`, **빈 배열 허용** — `@ArrayMinSize` 미적용).
- [ ] 허용 literal 값(`period` 의 day/week/month, `mode` 의 fill/reeval, `difficulty`, `contribution`) 검증을 DTO 에 넣지 않는다 — `@IsIn` 0 개. 단일 출처가 service · domain 임을 파일 주석에 좌표로 명시 (`evaluate-activities.dto.ts` 머리 주석 관행 정합).
- [ ] colocated spec `src/assessment-evaluation/dto/summary-aggregate-request.dto.spec.ts` 신설 (다른 위치 금지) — `class-transformer` `plainToInstance` + `class-validator` `validate` 조합으로 검증:
  - [ ] **happy path** 1+ : 6 필드 정상 payload(중첩 `results` 2 건 포함) → `errors.length === 0`.
  - [ ] **error path** 1+ : 필수 필드 누락(`personId` 부재) · 타입 불일치(`results` 가 배열 아님) 각각 → 해당 property 의 constraint 키 단언.
  - [ ] **분기별** 1+ : `results` 빈 배열(허용 — 통과) 과 `results` 원소가 불량인 경우(nested 실패 전파, `children` 에 nested 오류 존재) 두 분기 모두 test.
  - [ ] **negative case 를 예외 분기마다** 1+ : `periodStart` 비-ISO 문자열 · `periodStart` 빈 문자열 · `volume` 음수 · `volume` 비정수 · `unitId` 빈 문자열 · `mode` 비-string · `modelId` 누락 · 정의되지 않은 잉여 필드가 `forbidNonWhitelisted` 로 거부됨 — 각 1+ (총 8 종 이상).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%), 신규 DTO 파일은 line · function 100%.
- [ ] 새 외부 dependency 0 (`class-validator` / `class-transformer` 는 기존 의존 — `package.json` 변경 0).

## Out of Scope

- controller route 신설 · `assessment-evaluation.controller.ts` 변경 (배선 2/2, Follow-up (a)).
- `assessment-evaluation.module.ts` 변경 — 두 orchestrator 는 이미 provider/export 등록돼 있어 본 arc 에서 module 변경 0.
- DTO → 도메인(`SummaryBatchContext` / `EvaluationResult[]`) 변환 매퍼 (소비처 slice 책임).
- `SummaryAggregateOrchestratorService` / `SummaryPersistService` / `SummaryNarrativeService` 본문 · 시그니처 변경.
- `docs/architecture/api.md` route 표 갱신 · endpoint 합계 재집계 (Follow-up (b)).
- `docs/requirements.md` REQ-004 재판정 (PLAN `183 행` once-rule — Follow-up (c), 배선 2/2 머지 뒤 1 회).
- e2e / smoke / perf spec 추가 (PLAN `158 행` R-92 churn 금지 포함).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **소비처 slice (배선 2/2)** — `src/assessment-evaluation/assessment-evaluation.controller.ts` 에 `@Post("summary")` (`@HttpCode(200)` + `JwtAuthGuard` + `RolesGuard` + `@Roles("Admin")`) 신설 + 생성자 마지막 param 으로 `SummaryAggregateOrchestratorService` 주입(기존 param 순서 보존) + DTO → `SummaryBatchContext`(`periodStart` → `Date`) · `EvaluationResult[]` 변환 후 `evaluateAndPersist(context, results, mode, { modelId }, new Date())` 위임, `assessment-evaluation.controller.spec.ts` 확장(unit + RBAC/route metadata).
- (b) **doc-sync** — `docs/architecture/api.md` `§ 5` 에 신규 route 행 1 개 + 합계 `85 → 86` endpoint / shipped 재집계 (prefix 불변 여부 확인).
- (c) **REQ-004 재판정 1 회** — 배선 2/2 머지 뒤 `docs/requirements.md` `23 행` 의 "좌표 종합 코멘트의 HTTP 진입점 부재" 서술 실측 갱신 (프런트 노출 축 · 기간 종료 경계 축은 여전히 잔여이므로 `DONE` 승격 여부는 그때 실측 판단).
