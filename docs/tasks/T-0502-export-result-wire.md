---
id: T-0502
title: buildExportResult helper 를 ExportJobService.previewSelection 응답 확장으로 실호출 배선 — 45 helper 배선 chain step11
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0501]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step11 — buildExportResult(T-0456 미호출 helper) 를 T-0501 previewSelection 의 summary+scope 위에 completionResult 응답 확장으로 배선(headline/exportedCounts/impactLines/scopeLine). DB write 0·신규 endpoint 0. R-112 backbone × 1.5 = ~210 LOC."
---

# T-0502 — buildExportResult helper 를 previewSelection 응답 확장으로 실호출 배선 (chain step11)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step11 다. [T-0501](T-0501-export-job-plan-wire.md) (chain step10, PR #411, squash 392e94e) 가 `buildExportJobPlan` 을 `ExportJobService.previewSelection` 응답의 `deliveryPlan` 필드로 배선해 "이 dump 를 sync 다운로드로 줄지 async job 으로 줄지 + 어떤 status 단계를 거치는지"의 **실행 plan descriptor** 를 노출했다. 이로써 preview 응답은 (a) count 요약 → (b) `summary`(T-0499 perEntity breakdown + instantRange) → (c) `sizeEstimate`(T-0500 예상 크기 + recommendation) → (d) `deliveryPlan`(T-0501 전달 방식) 까지 "무엇을·얼마나·어떻게 전달할지"의 사전 안내는 다 갖췄다. 그러나 UC-07 §5 step 13(`결과 표시 (Export: 다운로드 완료 …)`) + §8 (a) Export postcondition(DB 무변화 read-only + scope 요약 + entity-별 영향 + row count)이 요구하는 **"이 scope 로 무엇이 실제로 export 되는가"의 사람-친화 완료 결과 메시지** — 즉 "다운로드 완료 — 선별 N row export" headline + entity-별 영향 라인 + scope 한국어 요약 라인 — 은 여전히 미노출이다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `buildExportResult` ([T-0456](T-0456-export-result-helper.md), `src/export/export-result.ts`). 입력으로 `ExportSelectionSummary`(T-0449 산출, T-0499 가 응답에 노출한 그 타입) + `ExportScope`(T-0437) 를 받아 `{ headline(한국어), exportedCounts{selected,excluded}, impactLines(한국어[]), scopeLine(한국어) }` 의 완료 결과 모델을 순수 DRY 합성하는 helper(재실행 0 — 이미 산출된 summary/scope 만 derive). `git grep buildExportResult -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 외 production wiring 0 인 미호출 helper. T-0501 까지 산출된 동일 `summary`(ExportSelectionSummary) + `previewSelection` 인자로 들어온 `scope`(ExportScope) 위에 추가 인자·재계산 0 으로 자연 연결되는 다음 chain step 이다. (`buildExportChunkPlan`(export-chunk-plan.ts) 는 `chunkSizeBytes` 필수 인자 — 정책/ENV 동적 값 결정이 선행돼야 하므로 본 minimum-diff slice 보다 뒤 chain step 으로 미룬다 — §Follow-ups.)

본 task 는 신설 endpoint 0·DB write 0 의 **응답 확장 slice** 다. `ExportJobService.previewSelection(scope)` 안에서 이미 산출된 `summary`(ExportSelectionSummary)와 인자로 받은 `scope`(ExportScope — line 48 `type ExportScope as ExportScopePayload` 이므로 `buildExportResult` 가 기대하는 `ExportScope` 와 동일 타입, 추가 변환 0)를 그대로 `buildExportResult(summary, scope)` 에 forward 해 완료 결과를 derive 한 뒤, 반환 shape 을 (a) 기존 count 요약 + `summary` + `sizeEstimate` + `deliveryPlan` + (b) 신규 `completionResult: ExportResult` 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL/RBAC/ValidationPipe 불변 — 응답 body 만 확장된다.

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export scope 사람-친화 미리보기·완료 결과 안내), (2) helper 가 summary/scope derivation 만 다루고 DB read 가 [T-0497](T-0497-export-select-records-preview-wire.md)/[T-0499](T-0499-export-selection-summary-wire.md)/[T-0500](T-0500-export-dump-size-estimate-wire.md) 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(result message 만 derive, raw payload 0·추가 DB read 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step10 의 deliveryPlan 위에 result derivation 1 layer 만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0502-export-result-wire.md` (본 파일)
- `src/export/export-result.ts` 전체 — 호출할 순수 helper. `buildExportResult(summary: ExportSelectionSummary, scope: ExportScope): ExportResult`. 반환 shape: `{ headline: string(한국어 "다운로드 완료 — 선별 N row export"), exportedCounts: { selected: number; excluded: number }, impactLines: string[](selected total 라인 + 0 아닌 perEntity entity 라인; excluded.total>0 면 제외 요약 라인 추가, full scope 의 excluded.total=0 은 제외 라인 생략), scopeLine: string(scope full/range/partial 한국어 표기 + range dateRange 요약 / partial entitySelector 요약) }`. **입력 방어**: summary 비-plain-object → TypeError, summary.selected/excluded 부재·비-object → TypeError(어느 그룹인지 label), 그 total 비-정수·음수 → TypeError, perEntity 부재·비-object → TypeError, scope 비-plain-object → TypeError, scope.scope 가 full/range/partial 외 → RangeError. non-mutating(freeze 된 입력 통과), selected/excluded 0 / impactLines 빈 경계 정상(throw 0).
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` (line 266~330) 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords` → `summarizeExportSelection`(→ `summary`) → `estimateExportDumpSize` → `buildExportJobPlan`. 본 task 는 이미 산출된 `summary`(line 284) 와 인자 `scope`(line 267) 를 그대로 `buildExportResult(summary, scope)` 에 forward 만 하면 된다 — 추가 순회·재계산 0(helper 가 summary/scope 만 derive). (b) `ExportSelectionPreview` interface (line 158~165) — 본 task 가 `completionResult: ExportResult` 필드 추가. (c) helper import 패턴 (line 41 `buildExportJobPlan` + `type ExportJobPlan` import) mirror. (d) line 48 `type ExportScope as ExportScopePayload` — `buildExportResult` 가 기대하는 `ExportScope` 와 동일 타입이라 `scope` 인자 그대로 전달 가능(별칭만 다름, 추가 변환 0).
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0501 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 `completionResult` 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview`) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497/T-0499/T-0500/T-0501 추가분) — 신규 `completionResult` 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/use-cases/UC-07.md` §5 step 13 + §8 (a) Export postcondition — "다운로드 완료" 결과 메시지 + scope 요약 + entity-별 영향 + DB 무변화 read-only 의 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 `collectExportRecords()` + `selectExportRecords` + `summarizeExportSelection`(→summary) + `estimateExportDumpSize` + `buildExportJobPlan` 호출 유지 → (2) 이미 산출된 `summary` 와 인자 `scope` 를 그대로 `buildExportResult(summary, scope)` 실호출 → (3) helper 산출 `ExportResult` 를 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §5 step 13 다운로드 완료 결과 + §8 (a) Export postcondition scope 요약·영향 정합 + REQ-032 derivation-only).
- [ ] `ExportSelectionPreview` 에 `completionResult: ExportResult` 필드 추가. helper 의 `ExportResult` 타입을 그대로 surface 에 노출(service 가 `import { buildExportResult, type ExportResult }`). 기존 `selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` / `deliveryPlan` 필드 전부 불변(append-only 확장 — backward-compat).
- [ ] `scope` 인자는 추가 변환 없이 `buildExportResult` 에 그대로 전달한다 — `ExportScopePayload` 가 `ExportScope`(T-0437) 의 별칭(line 48)이라 타입 호환. 별도 매핑/생성 0(근거 주석 1줄).
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `buildExportResult` 는 입력 `summary` + `scope` 만 derivation 하므로 추가 Prisma 호출 0. T-0497/T-0499/T-0500/T-0501 의 projection-only read(REQ-032) 정책 불변.
- [ ] scope invariant 위반 시 `selectExportRecords` 가 throw 하는 정책 그대로(result 호출 도달 0). helper `buildExportResult` 의 입력 방어 분기(RangeError/TypeError)는 `summarizeExportSelection` 통과 summary + 검증된 scope 만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — full scope / range scope / partial scope 각 1+: 분류 결과 → summary → result 호출 → 응답에 `completionResult.headline` · `completionResult.exportedCounts.selected` · `completionResult.exportedCounts.excluded` · `completionResult.impactLines` · `completionResult.scopeLine` 가 정확히 박제됨을 검증.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(result 호출 도달 0), (b) result 호출 자체는 정상 summary/scope 입력만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 summary 는 항상 selected/excluded breakdown 보유 · scope.scope 는 항상 full/range/partial).
- [ ] **Flow / branch coverage** — (a) excluded.total > 0 → impactLines 에 "제외 N row" 라인 포함 / (b) full scope 의 excluded.total === 0 → 제외 라인 생략 두 분기 각 1+ test. 추가로 (c) range scope → `scopeLine` 에 dateRange 요약 포함, (d) partial scope → `scopeLine` 에 entitySelector 요약 포함, (e) full scope → 부가 요약 없는 scopeLine 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) 빈 DB / 빈 selection (selected.total 0 · excluded.total 0 → headline "선별 0 row export" · impactLines 에 entity 라인 0 · 제외 라인 생략), (b) selected 일부 entity 만 0 아님 (0 entity 라인 생략 검증), (c) excluded.total 만 0 아님 (제외 라인 포함), (d) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 `completionResult` 포함으로 stub 하고 200 응답 body 에 `completionResult` 이 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `buildExportResult` 의 import 경로는 `./export-result` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] `completionResult.exportedCounts.selected` 가 `summary.selected.total` 과 일치하고 `completionResult.exportedCounts.excluded` 가 `summary.excluded.total` 과 일치함을 spec 1+ 로 cross-check (summary ground-truth 회귀 차단).
- [ ] `completionResult.scopeLine` 의 scope 표기(full/range/partial)가 인자 `scope.scope` 와 1:1 대응함을 spec 1+ 로 검증 (scope ground-truth 회귀 차단).
- [ ] 기존 `summary` / `sizeEstimate` / `deliveryPlan` / `selectedCount` / `excludedCount` / `perEntitySelected` 필드가 본 확장 후에도 그대로 반환됨을 spec 1+ 로 확인 (append-only 확장의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `buildExportResult` 는 input(summary/scope) derivation 이라 추가 DB 호출 0. T-0497~T-0501 의 projection-only `collectExportRecords` 그대로.
- `buildExportChunkPlan`(export-chunk-plan.ts) 배선 — `chunkSizeBytes` 필수 인자라 정책 row · ENV 기반 chunk 크기 결정이 선행돼야 함. 다음 chain step (별도 task, §Follow-ups). 본 task 는 추가 인자 0 helper 만.
- 실 file artifact 직렬화 / 다운로드 stream / object-storage 업로드 / Audit row 실 INSERT — Q-0040 범위 밖. 본 task 는 result message 안내만(REQ-030/REQ-032 범위). 실 export 직렬화·artifact 전달은 P5 service layer(별도 task).
- `summarizeExportSelection` / `buildExportJobPlan` 재호출 / 재계산 — 이미 산출된 `summary` 와 인자 `scope` 만 forward. result helper 가 둘을 derive 만 한다(DRY).
- helper(`buildExportResult`) 구현 변경 — T-0456 helper 본문 (`src/export/export-result.ts`) 은 건드리지 않는다. service 가 `ExportResult` interface 를 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만. `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR-0044 본문 변경 / 새 ADR — 본 task 는 코드만. result helper 는 신규 architectural 결정 0.
- `api.md` 의 `POST /api/admin/export/preview-selection` 응답 shape `completionResult` 정합 갱신 — 별도 doc-sync direct task (§Follow-ups).
- `ImportJobService` 대칭 배선 (buildRestoreResult 측) — import 측 별도 chain (별도 task).
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 분기 1줄 + 응답 shape 1 필드 확장 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 추가 인자 0·새 architectural 결정 0.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **다음 code slice (chain step12)**: `buildExportChunkPlan`(export-chunk-plan.ts) → `deliveryPlan.chunked === true` 일 때 chunk 경계 plan 합성 배선 (pr-mode). `chunkSizeBytes` 정책 row · ENV 기반 결정이 선행돼야 함 — 그 결정 task 후 연결.
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape `completionResult` 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — buildRestoreResult 실호출 배선 (별도 chain).)
