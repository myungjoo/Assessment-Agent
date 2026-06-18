---
id: T-0495
title: buildExportScopeRejection helper 를 ExportJobService.createJob 의 scope 검증 실패 path 에 실호출 배선 — 45 helper 배선 chain step5
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0491]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
plannerNote: "P7 helper-배선 chain step5 — buildExportScopeRejection(T-0463 순수 helper, 미호출) 를 ExportJobService.createJob 의 validateExportScope invalid 분기(T-0491 박제) 에 배선해 ad-hoc join 을 구조화 reject 메시지로 교체. file-disjoint(service), 새 dep/schema 0."
---

# T-0495 — buildExportScopeRejection helper 를 ExportJobService.createJob 의 scope 검증 실패 path 에 실호출 배선

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step5 다. step1([T-0491](T-0491-export-job-service-scope-validate-wire.md), `validateExportScope`→`ExportJobService.createJob`) 이 scope/dateRange/entitySelector field-level 검증을 service 의 실 path 에 배선하면서, helper 가 `{ valid:false }` 를 반환하면 `verdict.errors.map((e) => `${e.field}: ${e.message}`).join("; ")` **ad-hoc 문자열 join** 으로 `BadRequestException(400)` 을 던지도록 임시 처리했다. 그러나 UC-07 §7.3 이 박제한 사람-친화 reject 메시지 모델(headline + field 별로 묶은 안내 + 재입력 actionable guidance + blocking flag)을 산출하는 전용 helper `buildExportScopeRejection`([T-0463](T-0463-export-scope-rejection-message.md), `src/export/export-scope-rejection-message.ts`)은 `git grep buildExportScopeRejection -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — **자기 spec 외 어디서도 호출되지 않는 unwired helper** 다.

본 task 는 `createJob` 의 `verdict.valid === false` 분기에서 그 ad-hoc join 을 `buildExportScopeRejection(verdict)` 실호출로 교체해, 산출된 `ExportScopeRejectionMessage`(headline + detailLines + blocking)를 `BadRequestException` 메시지로 결합한다. 이로써 (1) 미호출 helper 1 종이 실 service path 에 연결되고(REQ-030 Export scope 검증), (2) reject 메시지가 §7.3 이 명시한 구조화 안내(field 별 묶음 + 재입력 guidance)로 일관되며, (3) `verdict.errors`/`raw stack` 을 메시지에 직접 노출하지 않아 REQ-032(raw 미저장)·진단 잡음 회피 정책이 유지된다.

본 task 는 **persistence / DB write 0, scope 재검증 0** — 이미 산출된 `validateExportScope` verdict 를 사람-친화 메시지로 합성만 한다. 새 외부 dependency / DB schema / auth-flow 표면 0(helper·service·exception 이미 존재, 호출 1 줄 교체 + 입력 정규화).

## Required Reading

- `docs/tasks/T-0495-export-scope-rejection-message-wire.md` (본 파일)
- `src/export/export-job.service.ts` L88-113 — 배선 위치. `createJob` 의 `const verdict = validateExportScope(...)` + `if (!verdict.valid) { throw new BadRequestException(verdict.errors.map(...).join("; ")); }` ad-hoc join 분기. 이 분기를 `buildExportScopeRejection(verdict)` 호출로 교체한다. `verdict` 는 `ExportScopeValidation` 타입(이미 helper 가 요구하는 입력 형).
- `src/export/export-scope-rejection-message.ts` 전체 — 호출할 순수 helper. `buildExportScopeRejection(validation: ExportScopeValidation): ExportScopeRejectionMessage`. 반환 `{ headline, detailLines[], blocking }`. valid=true 면 통과 메시지·blocking=false, valid=false 면 field 별 묶음 detailLines + blocking=true. **입력 방어**: validation 비-object → TypeError, valid 비-boolean → TypeError, errors 비-array → TypeError, valid=false 인데 errors 빈 배열 → RangeError. createJob 은 항상 helper 가 산출한 정상 verdict 를 넘기므로 본 방어 분기는 정상 경로에서 발화 안 됨(negative test 로 cover).
- `src/export/export-scope-validate.ts` — `validateExportScope` 반환 `ExportScopeValidation { valid, errors: ExportScopeError[], normalized? }` 타입 정의. `buildExportScopeRejection` 입력과 1:1 동일 — 변환·재가공 0 으로 verdict 를 그대로 helper 에 forward.
- `src/import/import-job.service.ts` (있다면 import 측 대칭 reject 메시지 helper 호출 패턴 참고용 — 없으면 생략) 및 `src/export/export.controller.ts` L177-187 의 `describeScope`(T-0494) helper 직접 호출 패턴 — service 안에서 helper 호출 + 결과를 exception 메시지로 결합하는 mirror.
- `src/export/export-job.service.spec.ts` L58-200 — colocated spec(추가/수정 test 작성 위치). `describe("createJob")` 의 기존 invalid-scope BadRequestException test 들(L143-181 requestedById 빈 문자열 / RANGE start≥end / Invalid Date / PARTIAL 허용 외 entity). 본 task 는 이 분기들이 여전히 BadRequestException 을 던지되 메시지가 `buildExportScopeRejection` 산출(headline 포함)로 구성됨을 검증하도록 보강한다. 신규 spec 파일 생성 금지 — colocated 우선.

## Acceptance Criteria

배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출은 의무):

- [ ] `ExportJobService.createJob` 의 `if (!verdict.valid)` 분기에서 기존 ad-hoc `verdict.errors.map((e) => ...).join("; ")` 를 제거하고, `buildExportScopeRejection(verdict)` 를 호출해 산출된 `ExportScopeRejectionMessage` 의 `headline`(+ 필요 시 `detailLines` 결합)을 `BadRequestException` 메시지로 사용한다. `verdict` 는 변환 없이 그대로 helper 에 forward(타입 동일 — `ExportScopeValidation`). 교체 근거 주석 1줄 박제(§7.3 구조화 reject 메시지).
- [ ] `buildExportScopeRejection` 이 자기 spec 외 실 service 에서 호출됨을 검증 — `git grep buildExportScopeRejection -- src/export/export-job.service.ts` 가 1+ 매칭.
- [ ] 검증 실패 시 던지는 `BadRequestException` 은 여전히 HTTP 400 으로 매핑되고, 메시지가 helper 산출 headline(사람-친화 한국어)을 포함한다 — `verdict.errors` raw 객체·stack 을 메시지에 직접 직렬화하지 않는다(REQ-032 정합).
- [ ] **Happy-path test**: 정상 scope 입력(scope=FULL / RANGE valid dateRange / PARTIAL valid entitySelector)에서는 `buildExportScopeRejection` 가 호출되지 않고(verdict.valid=true 분기) `exportJob.create` 가 정상 PENDING job 을 반환하는 test 1+(기존 happy test 유지 또는 보강).
- [ ] **Error path test**: invalid scope 입력(RANGE start≥end / RANGE Invalid Date / PARTIAL 허용 외 entity / FULL+한정값 등)에서 `createJob` 이 `BadRequestException` 을 던지고, 그 메시지가 `buildExportScopeRejection` 산출 headline(reject 문구)을 포함함을 단언하는 test 각 1+. helper 를 spy 해 invalid verdict 로 정확히 1 회 호출됨을 검증하는 test 1+.
- [ ] **Flow / branch test**: `createJob` 의 두 분기 — (a) verdict.valid=true → helper 미호출 + create 진행, (b) verdict.valid=false → `buildExportScopeRejection` 호출 + BadRequestException — 각 분기 1+ test. requestedById 빈 문자열 분기(helper 호출 전 早期 BadRequest)는 별도 분기로 유지·cover.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ — (1) requestedById 빈 문자열 → helper 호출 전 BadRequestException(早期 return, helper 미호출 단언), (2) RANGE+dateRange 누락/start≥end → invalid verdict → reject 메시지 BadRequest, (3) PARTIAL+허용 외 entity → invalid verdict → reject 메시지 BadRequest, (4) helper 가 산출한 blocking=true 가 reject 분기에서만 발화(valid 분기는 helper 미호출)임을 단언. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — export-job.service.ts 변경 부분 colocated spec 으로 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- ExportController / `describeScope`(T-0494) / 다른 helper 배선 — 본 task 는 `buildExportScopeRejection` 1개만 `export-job.service.ts` 에 배선. controller layer 는 건드리지 않는다(touchesFiles 2 파일, file-disjoint).
- `buildExportScopeRejection` / `validateExportScope` helper 자체 로직 변경 — 이미 존재·검증됨(T-0463 / T-0444 박제 그대로). 호출(import)만.
- `BadRequestException` → 새 custom exception 신설 / HTTP status 변경 — 기존 400 매핑 유지, 메시지 source 만 helper 산출으로 교체.
- import 측 대칭 reject 메시지 helper(`buildDumpValidationMessage` 등) 배선 — chain 의 후속 slice(별도 task). 한 task 1 helper 배선 원칙.
- DB write / persistence 변경 — `createJob` 의 reject 분기는 create 전 早期 throw 라 DB 무접근. 정상 분기의 `exportJob.create` shape 불변.
- 실 dump 직렬화 / streaming / multipart / artifact 저장소 — 후속 chain / §5 BLOCKED.
- api.md 등 doc 계약 추가/정정 — 필요 시 §Follow-ups 에 기록(별도 direct doc-sync task).
- STATE.json / journal / PLAN 등 doc 변경 — direct-mode 별 task. 본 task 는 코드+spec pr-mode 만.
- 새 외부 dependency / schema migration / auth-flow 변경 0(전부 기존 표면 재사용) — 발생 시 BLOCKED.

## Suggested Sub-agents

`implementer → tester`

(아키텍처 결정 0 — 기존 helper·service·exception·mock 재사용, 새 ADR 불요. architect 생략.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append — 예: import 입구 §7.4 dump 구조 reject 안내 `buildDumpValidationMessage`(T-0459) 의 ImportJobService 측 대칭 배선 slice(dump payload 가 필요해 multipart upload infra 선행이 자연스러움). export 측 잔여 미호출 helper(`buildExportJobPlan`·`estimateExportDumpSize`·`summarizeExportSelection` 등) 의 배선 slice — 단 이들은 실 record 선별·dump 조립이 필요해 별도 task.)
