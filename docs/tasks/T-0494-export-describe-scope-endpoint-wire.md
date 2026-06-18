---
id: T-0494
title: describeExportScope helper 를 POST /api/admin/export/describe-scope 에 실호출 배선
phase: P7
status: DONE
mergedAs: debe5a7
prNumber: 405
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0488]
touchesFiles: [src/export/export.controller.ts, src/export/export.controller.spec.ts]
plannerNote: P7 helper-배선 chain step4 — describeExportScope(T-0462)→신설 POST /api/admin/export/describe-scope, T-0493 describeModes 의 export 측 대칭 preview slice (pr)
---

# T-0494 — describeExportScope helper 를 POST /api/admin/export/describe-scope 에 실호출 배선

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step4 다. 직전 step3(T-0493)이 `describeImportMode`(T-0465)를 `GET /api/admin/import/modes` 에 배선한 import 측 dialog slice 였고, 본 task 는 그 export 측 대칭 — 순수 helper `describeExportScope`(T-0462, `src/export/export-scope-description.ts`)를 ExportController 의 신설 `POST /api/admin/export/describe-scope` endpoint 에 실호출 배선한다. `git grep describeExportScope -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭(자기 spec 외 미호출) 으로 아직 어떤 HTTP/service 경로에도 닿지 않은 unwired helper 임을 확인했다. 이 endpoint 는 사용자가 Export 를 *확정하기 전* "내가 무엇을 내보내는지" 를 보여주는 scope preview dialog(UC-07 §5 step 2 + §6.1 + §8 (a) read-only)의 정보 source 로, Import 측 `describeModes`(T-0493) 와 대칭 위치다.

## Required Reading

- `docs/tasks/T-0494-export-describe-scope-endpoint-wire.md` (본 파일)
- `src/export/export-scope-description.ts` — 배선 대상 helper. `describeExportScope(scope: ExportScope, options?)` → `ExportScopeDescription`. 입력 `ExportScope` 는 lowercase scope kind(full/range/partial) + `PeriodRange`(Date) dateRange + entity 이름 배열 entitySelector 를 요구. full/range/partial 별 분기 + TypeError/RangeError 입력 방어 확인.
- `src/export/export.controller.ts` — 배선 위치(신규 endpoint 추가 대상). 기존 RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) + controller-scope `@UsePipes(ValidationPipe whitelist/forbidNonWhitelisted/transform)` 1:1 적용.
- `src/import/import.controller.ts` — T-0493 `describeModes` 가 helper 를 호출하는 패턴(enum→lowercase 변환 상수 `IMPORT_MODE_ENUM_TO_PAYLOAD`, helper 호출, return). export 측에서 mirror.
- `src/export/export-job.service.ts` L69-72, L173, L180-193 — `SCOPE_ENUM_TO_PAYLOAD`(Prisma `ExportScope` enum→lowercase) + dateRange ISO string→Date coerce 정규화 패턴(T-0491 박제). 본 controller 가 helper 입력 정규화에 동일 패턴 재사용.
- `src/export/dto/create-export.dto.ts` — `CreateExportDto`(scope `@IsEnum(ExportScope)` / dateRange `@IsOptional @IsObject` / entitySelector `@IsOptional @IsArray`). 신규 endpoint 가 이 DTO 를 그대로 request body 로 재사용.
- `src/export/export.controller.spec.ts` — colocated spec(추가 test 작성 위치). 기존 RBAC/ValidationPipe test 패턴 확인.

## Acceptance Criteria

- [ ] ExportController 에 `POST /api/admin/export/describe-scope` 핸들러(예: `describeScope`)를 신설한다. `@Body() dto: CreateExportDto` 를 받아 Prisma `ExportScope` enum → lowercase scope kind 변환(`SCOPE_ENUM_TO_PAYLOAD` 패턴 mirror) + dateRange 의 ISO string → Date coerce(export-job.service 의 정규화 패턴 mirror) 후 `describeExportScope` 를 호출하고, 반환된 `ExportScopeDescription` 을 200 으로 그대로 반환한다.
- [ ] 신설 endpoint 에 기존 RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) 을 적용 — 신규 auth 결정 0. controller-scope `@UsePipes(ValidationPipe)` 가 body 형식 검증을 boundary 에서 강제.
- [ ] 라우트 선언 순서: 신규 `describe-scope` 는 고정 segment(POST) 라 `@Get(":id")` 동적 segment 와 충돌하지 않음을 확인(POST 메서드 분리). 기존 `running`/`:id` GET 순서 불변.
- [ ] **Happy-path test**: scope=FULL / scope=RANGE(valid dateRange) / scope=PARTIAL(valid entitySelector) 각각에 대해 `describeScope` 가 올바른 `ExportScopeDescription`(headline/scopeKind/scopeLine/entityLines/readOnly=true, range 일 때 dateRangeLine 포함)을 반환하는 test 1+.
- [ ] **Error path test**: helper 가 throw 하는 입력(RANGE+dateRange 누락 → RangeError, dateRange start>=end → RangeError, PARTIAL+빈/누락 entitySelector → RangeError, dateRange 비-Date/Invalid → TypeError, 허용 외 entity 섞임 → RangeError)이 controller 를 통해 그대로 propagate 되는(swallow 0) test 1+.
- [ ] **Flow / branch test**: enum→lowercase 변환 분기(FULL/RANGE/PARTIAL 3종 enum 모두 올바른 lowercase 로 매핑) + dateRange string→Date coerce 분기(string 입력 / 이미 Date 입력 / dateRange 부재) 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**: 인증 부재 → JwtAuthGuard 401 / User tier actor → RolesGuard 403 / `@Roles("Admin")` metadata Reflector 단언 / forbidNonWhitelisted 가 정의되지 않은 키(raw 본문 키) 거부 / entitySelector 가 허용 외 entity 포함 시 helper RangeError propagate — 각 1+ test(단일 negative 만 작성 금지).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규/수정 코드 colocated spec 으로 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- ImportController / 다른 helper 배선 — 본 task 는 `describeExportScope` 1개만 export.controller 에 배선.
- `export-scope-description.ts` helper 자체의 로직 변경 — 이미 존재·검증됨. import(호출)만.
- DB write / persistence — `describeScope` 는 순수 합성(read-only, DB 무접근). job record 생성·status 변경 0.
- 실 dump 직렬화 / streaming 응답 / multipart / artifact 저장소 — 후속 chain / §5 BLOCKED.
- api.md 등 doc 계약 추가/정정 — 필요 시 §Follow-ups 에 기록(별도 direct doc-sync task).
- `CreateExportDto` 변경 — 기존 DTO 재사용만. 새 DTO 신설 0.
- 새 외부 dependency / schema migration / auth-flow 변경 0(전부 기존 표면 재사용) — 발생 시 BLOCKED.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
