---
id: T-0491
title: ExportJobService.createJob 에 validateExportScope(T-0444) 실호출 배선 — 45 helper 배선 chain step1
phase: P7
status: DONE
completedAt: 2026-06-18T07:53Z
mergedAs: 79910b0
reviewRounds: 2
commitMode: pr
prNumber: 402
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 280
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0486, T-0488]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/dto/create-export.dto.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step1 — validateExportScope(T-0444 순수 helper, 어디서도 미호출) 를 ExportJobService.createJob 에 실호출 배선. coarse assertScopeInvariant 를 field-level 검증으로 강화. 새 dep/schema/auth 0."
---

# T-0491 — ExportJobService.createJob 에 validateExportScope 실호출 배선

## Why

P7 export/import 실 배선 chain 의 controller slice (step3~6: [T-0486](T-0486-export-job-persistence-service.md)~[T-0489](T-0489-import-controller-dto-module.md)) 가 모두 merge 됐고, [api.md doc-sync](T-0490-api-md-export-get-to-post.md) 도 closure 됐다. backlogNote 가 명시한 다음 단계는 **"45 helper(T-0437~T-0483) 실 호출 배선"** — 지금까지 박제만 되고 어디서도 호출되지 않는 순수 helper 들을 실제 service/controller path 에 연결하는 작업이다.

본 task 는 그 chain 의 **첫 in-scope slice** 다. `validateExportScope` ([T-0444](T-0444-export-scope-validate.md), `src/export/export-scope-validate.ts`) 는 UC-07 §6.1 의 3 차원 scope 옵션(scope enum / range 의 dateRange 유효성·반열림 start<end / partial 의 entitySelector entity 멤버십 / AND 조합)을 **field-level error 목록**으로 검증하는 순수 helper 인데, `git grep validateExportScope -- src/**/*.service.ts src/**/*.controller.ts` 결과 **자기 spec 외 어디서도 호출되지 않는다**. 반면 현행 `ExportJobService.createJob` 은 `assertScopeInvariant` 로 **enum 존재 여부 + 한정값 유무**만 coarse 하게 검사할 뿐, dateRange 의 실제 형식(start/end 가 유효 Date 인지·start<end 인지)이나 entitySelector 의 entity 값 유효성은 검증하지 않는다 — 잘못된 dateRange/entitySelector 가 그대로 DB 에 record 된다.

본 task 는 `validateExportScope` 를 `createJob` 에 실호출 배선해 boundary 검증을 helper layer 로 위임한다. 이로써 (1) 미호출 helper 1 종이 실 path 에 연결되고(REQ-030 Export), (2) raw 미저장 invariant(REQ-032) 는 그대로 유지되며(helper 는 scope option 만 검사), (3) Admin 전용 경로(REQ-045)의 입력 검증이 field-level 로 강화된다.

## Required Reading

- `src/export/export-job.service.ts` 전체 — 배선 대상. `createJob` 의 현행 `assertScopeInvariant` 분기(requestedById 필수 / FULL+한정값 모순 / RANGE-dateRange 누락 / PARTIAL-entitySelector 누락)와 `CreateExportJobInput` shape(`scope: ExportScope` Prisma enum / `dateRange?: unknown` / `entitySelector?: unknown`).
- `src/export/dto/create-export.dto.ts` 전체 — round1 BLOCKER 의 fix 대상. 현행 `entitySelector` 는 `@IsObject()` 인데 class-validator 의 `isObject` 는 **배열을 거부**한다(`Array.isArray` true → object 판정 false). 본 task 의 round2 fix 가 `entitySelector` 를 array-aware(`@IsArray()` + `@IsOptional()` — per-element 검증은 helper 위임) 로 바꾼다. dateRange 는 `@IsObject` 그대로 유지(JSON object {start,end} 형태). MINOR finding(`assertScopeInvariant` 주석 참조)도 동시에 `validateExportScope` 로 갱신.
- `src/export/export-scope-validate.ts` 전체 — 호출할 순수 helper. `validateExportScope(input: unknown): ExportScopeValidation` 가 받는 **payload shape** 은 `{ scope: "full"|"range"|"partial", dateRange?: { start: Date, end: Date }, entitySelector?: ExportEntity[] }` 다 (lowercase scope·Date instance·string[] entity). 반환 `{ valid, errors: ExportScopeError[], normalized? }`.
- `src/export/export-scope-select.ts` L34-60 — helper 의 `ExportScope` 타입(lowercase scope)·`ExportEntity` union·`VALID_EXPORT_SCOPES`/`VALID_EXPORT_ENTITIES` 상수. Prisma enum 과 helper 타입의 **대소문자·형태 차이**(매핑 필요)를 정확히 파악.
- `src/export/export.controller.ts` L88-101 — `createJob` 에 들어오는 `dto.dateRange`/`dto.entitySelector` 가 `Record<string, unknown>` (JSON body) 이라는 점. JSON 역직렬화는 Date 를 ISO string 으로 보내므로, helper 가 요구하는 Date instance 와의 간극을 service 배선에서 어떻게 다룰지 결정(아래 AC 참조).
- `prisma/schema.prisma` 의 `enum ExportScope` (FULL/RANGE/PARTIAL) — Prisma enum ↔ helper lowercase 매핑의 source.
- `test/helpers/prisma-mock.ts` 의 `exportJob` delegate mock — spec 에서 재사용.

## Acceptance Criteria

- [ ] `ExportJobService.createJob` 가 기존 `assertScopeInvariant` 검증 **전 또는 대신** `validateExportScope` 를 실호출하도록 배선. Prisma `ExportScope` enum(FULL/RANGE/PARTIAL) → helper payload 의 lowercase scope("full"/"range"/"partial") 로 매핑하는 작은 변환 함수(예: `toScopePayload`)를 service private helper 로 추가. `dateRange`/`entitySelector` 는 input 의 값을 helper payload 형태로 전달.
- [ ] **dateRange Date 강제 정책** — JSON body 의 dateRange 는 ISO string 일 수 있으므로, service 가 helper 호출 전 `dateRange.start`/`end` 가 string 이면 `new Date(...)` 로 coerce 하는 정규화를 수행(coerce 후 helper 의 `isValidDate` 가 Invalid Date 를 잡음). 본문 주석에 "JSON 경유 ISO string → Date coerce" 근거 1줄 명시. (입력이 이미 Date 면 그대로 통과.)
- [ ] `validateExportScope` 가 `{ valid: false, errors }` 를 반환하면 `BadRequestException` 으로 변환해 throw — error message 는 helper 의 `errors` 배열(field+message 쌍)을 사람-친화 문자열로 결합(예: `errors.map(e => `${e.field}: ${e.message}`).join("; ")`). raw stack 미포함(REQ-032 정합).
- [ ] `requestedById` 필수 검증은 helper 가 다루지 않으므로(helper 는 scope payload 만) **유지** — `requestedById` 가 비면 기존대로 `BadRequestException`. helper 검증과 requestedById 검증의 순서·중복을 명확히(둘 다 BadRequestException 이지만 책임 분리).
- [ ] 검증 통과 시 기존 `prisma.exportJob.create` record 동작은 **불변** — record 되는 필드(scope/requestedById/dateRange/entitySelector null 정규화)는 그대로. 본 task 는 검증 강화만, persistence 동작 변경 0.
- [ ] **Happy-path unit test**: 유효한 FULL(한정값 없음) / RANGE(유효 dateRange) / PARTIAL(유효 entitySelector) 각각에 대해 `createJob` 이 정상적으로 `exportJob.create` 를 호출하고 job 을 반환하는 test 1+ (helper 통과 후 record 동작 검증).
- [ ] **Error path unit test**: helper 가 invalid 판정하는 입력 각각에 대해 `createJob` 이 `BadRequestException` throw — (a) RANGE 인데 dateRange.start ≥ end(역전 구간), (b) RANGE 인데 dateRange.start 가 Invalid Date(잘못된 ISO string coerce 결과), (c) PARTIAL 인데 entitySelector 에 허용 외 entity 값 포함, 각 1+ test.
- [ ] **Flow / branch cover**: scope 매핑 분기(FULL/RANGE/PARTIAL 각 1+) + dateRange coerce 분기(string 입력 coerce / 이미 Date 입력 / dateRange 부재) 각 1+ test. helper valid/invalid 두 분기 각 1+.
- [ ] **Negative cases 충분 cover** — (1) requestedById 누락(BadRequestException, helper 무관 분기), (2) RANGE-dateRange 누락(helper field "dateRange" error), (3) PARTIAL-entitySelector 누락(helper field "entitySelector" error), (4) FULL+dateRange 동봉(helper 가 normalized 에서 제거하므로 **valid** — 이 경우 create 정상 통과함을 단언해 helper 의 normalize 의미를 회귀로 박제), (5) 여러 field 위반 동시 발생 시 결합 message 에 모든 field 포함, 각 1+ test.
- [ ] colocated spec `src/export/export-job.service.spec.ts` 갱신 — 기존 test 는 보존(record/markRunning/findJob 등 회귀), 신규 검증 배선 test 추가. `exportJob` delegate 는 `test/helpers/prisma-mock.ts` mock 재사용.
- [ ] **[round2 BLOCKER fix]** `src/export/dto/create-export.dto.ts` 의 `entitySelector` 검증을 array-aware 로 교체 — `@IsObject()` → `@IsArray()` + `@IsOptional()` (per-element entity 멤버십 검증은 `validateExportScope` 헬퍼가 책임, DTO 는 형식만). `@IsArray` import 추가, 사용하지 않게 된 `@IsObject` 는 `dateRange` 가 여전히 쓰므로 import 유지. dateRange 의 `@IsObject` 는 변경 0(JSON object {start,end} 형태 그대로).
- [ ] **[round2 MINOR fix]** `src/export/dto/create-export.dto.ts` 의 주석 중 `assertScopeInvariant` 를 참조하는 문구(L15 / L21 부근 "scope 별 한정값 분기 (ExportJobService.assertScopeInvariant ...)" 등) 를 `validateExportScope` 로 교체. 본 task 의 service-layer 배선이 검증 책임 helper 위임으로 옮긴 사실과 doc 정합.
- [ ] **[round2 MAJOR fix]** controller→service integration test 추가(`src/export/export.controller.spec.ts` 확장 — 신규 파일 생성 대신 기존 spec 확장 권장. 없으면 신설). NestJS Test module 로 ValidationPipe + ExportController + ExportJobService(mock) 를 wire 해 다음 2 분기 cover: (a) **happy-path**: `entitySelector: ["Person", "Group"]` 배열을 담은 POST body 가 ValidationPipe 를 **통과**(`@IsArray` 정합)하고 service.createJob 이 호출되어 정상 응답을 반환 — round1 의 PARTIAL 경로 회귀 차단. (b) **negative-path**: `entitySelector: 42`(숫자) 같은 명백히 잘못된 shape 이 ValidationPipe 의 `@IsArray` 단계에서 400 으로 거부 — DTO 형식 boundary 가 동작함을 단언. helper 의 per-element 검증은 본 e2e 의 책임 아님(service-layer spec 가 이미 cover).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (변경 파일 line ≥ 80% / function ≥ 80%).

## Out of Scope

- **다른 44 helper 의 실호출 배선** — T-0437(selectExportRecords)·T-0438(buildExportDump)·T-0442(buildImportRestorePlan) 등은 후속 chain task. 본 task 는 `validateExportScope`(T-0444) 1 종만.
- **controller-layer 검증 로직 이동** — 본 task 는 service-layer 배선이 본체. ExportController 의 production code(검증 분기 추가 / Pipe 신설 등) 변경 0 — layer 분리 유지. 단 **round2 amend 로 controller→service integration test 추가는 in-scope** (test 파일만, production controller 코드 변경 0).
- **CreateExportDto 의 dateRange 구체 shape 검증** — dateRange 는 `@IsObject` 형식만(T-0488 그대로). 구체 shape(start/end 유효 Date·start<end 등) 검증 책임은 본 service 배선이 helper 위임으로 채움. dateRange 의 DTO decorator 변경 0. (entitySelector 의 array-aware DTO 검증은 round1 BLOCKER 해소를 위해 **in-scope** — 위 AC 참조.)
- **실 dump 직렬화 / artifact 저장소 / streaming 응답** — ADR-0044 §Out of Scope, 새 dependency 가능성 → 별도 §5 게이트.
- **prisma/schema.prisma 변경 0** (이미 T-0485 merge). enum ExportScope 정의 불변 — 본 task 는 enum↔helper lowercase 매핑만 코드로 추가.
- **ImportJobService 의 대칭 helper 배선** — 후속 task(예: validateImportDumpStructure 배선). 본 task 는 Export 측만.
- **새 외부 dependency / credential / auth-flow 변경 0** — helper 는 이미 존재하는 순수 함수, import 만 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- **PR #402 round1 REQUEST_CHANGES (reviewer, 2026-06-18) — scope amend 결정(option (a)).** 이 turn 의 planner 가 BLOCKER(DTO `@IsObject` ↔ helper `Array.isArray` 계약 모순) / MAJOR(controller→service e2e 부재) / MINOR(DTO 주석 `assertScopeInvariant` 잔재) 3 종 finding 을 본 task 의 §Out of Scope 를 좁혀 **본 task 내 round2 fix** 로 흡수했다(위 AC `[round2 BLOCKER fix]` / `[round2 MINOR fix]` / `[round2 MAJOR fix]` 3 항목 참조). 근거: DTO array-aware 1 줄 + 주석 1 줄 + integration test 1 파일 = 추가 ~70 LOC / +2 파일 → 누적 ~280 LOC / 4 파일 (cap ≤ 300 / ≤ 5 안). 별도 task 분리보다 helper 배선이 실제 PARTIAL 경로로 도달 가능해지는 ROI 가 높다.
- 다음 turn 의 executor 는 **prNumber=402 로 resume**(LOOP §1[2]) 하여 위 3 종 round2 fix 를 같은 PR 의 round2 commit 으로 올리고, 재호출된 reviewer 가 4-게이트 재평가. 신규 PR 생성 금지.
