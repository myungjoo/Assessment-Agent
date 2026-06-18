---
id: T-0498
title: ExportEntity→Prisma-model 치환(AuditLog→PermissionDeniedRecord / LlmConfig→LlmProviderConfig) 을 ADR-0044 에 박제 — T-0497 reviewer follow-up doc-sync
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-030, REQ-032]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0497]
touchesFiles:
  - docs/decisions/ADR-0044-export-import-job-persistence.md
plannerNote: "T-0497 reviewer follow-up — EXPORT_ENTITY_SOURCES 의 AuditLog→PermissionDeniedRecord / LlmConfig→LlmProviderConfig 치환이 어느 ADR 에도 미기록. ADR-0044 §5 inline-amend 로 박제(direct, doc-only). downstream chain 의 contract source 정합."
---

# T-0498 — ExportEntity→Prisma-model 치환을 ADR-0044 에 박제 (T-0497 reviewer follow-up)

## Why

[T-0497](T-0497-export-select-records-preview-wire.md) (PR #408, squash 86c07c7) 이 `selectExportRecords` 를 `ExportJobService.previewSelection` 에 배선하며 `src/export/export-job.service.ts` 에 `EXPORT_ENTITY_SOURCES` 매핑표를 박제했다. 이 표는 5 `ExportEntity` literal 을 Prisma model delegate 로 매핑하는데, 그중 **두 건이 이름이 다른 model 로 치환**됐다:

- `ExportEntity "AuditLog"` → Prisma model `permissionDeniedRecord`
- `ExportEntity "LlmConfig"` → Prisma model `llmProviderConfig`

reviewer 가 T-0497 검토에서 지적한 바: 이 치환은 **architectural substitution 인데 어느 ADR 에도 기록되지 않았다**. 특히 `AuditLog → PermissionDeniedRecord` 치환은 [ADR-0044 §Decision §5](../decisions/ADR-0044-export-import-job-persistence.md) (AuditLog 와의 책임 경계) 와 직접 충돌 소지가 있다 — ADR-0044 §5 는 "AuditLog entity 의 구체 schema 는 별도 보안 ADR 책임" 이라며 AuditLog 를 **conceptual-only (아직 실 Prisma model 부재)** 로 박제했는데, T-0497 구현은 기존의 구체 model `PermissionDeniedRecord` 를 그 stand-in 으로 사용했다. ADR-0044 §Consequences (line 65) 의 dump-artifact 대상 entity 열거도 "LlmProviderConfig / DifficultyMapping + AuditLog" 라고만 적혀 실제 export-source 가 `PermissionDeniedRecord` 임을 반영하지 못한다.

`EXPORT_ENTITY_SOURCES` 는 downstream chain (`summarizeExportSelection`·`estimateExportDumpSize`·`buildExportJobPlan`·`buildExportResult` 배선) 전체가 위에 쌓이는 **기반 매핑**이다. 더 많은 코드가 이 미기록 치환에 의존하기 전에 ADR (contract source) 에 박제하는 것이 [CLAUDE.md §7.3](../../CLAUDE.md) "결정은 ADR 로 — 같은 결정을 두 번 추론하지 않도록" + "코드보다 ADR 이 먼저다" 정신에 맞는다. 본 task 는 ADR-0044 의 ACCEPTED 결정 본문은 건드리지 않고, 이미 머지된 구현 치환을 사후 기록하는 **inline-amend (doc-only direct)** 다.

## Required Reading

- `docs/tasks/T-0498-export-entity-source-mapping-adr-amend.md` (본 파일)
- `docs/decisions/ADR-0044-export-import-job-persistence.md` 전체 — amend 대상. 특히 §Decision §5 (AuditLog 책임 경계, line 85~91), §Consequences 의 dump-artifact entity 열거 (line 65 부근), §Follow-ups 섹션 (있으면 그 끝에 amend 항목 append).
- `src/export/export-job.service.ts` L83~118 — 박제할 사실(fact) source. `EXPORT_ENTITY_SOURCES` 매핑표 5 entry + `ExportEntityDelegate` union + instant 컬럼 결정 근거 주석. ADR 본문이 이 코드와 정합해야 한다 (코드는 변경하지 않는다 — 코드의 기존 inline 주석을 ADR 로 끌어올리는 doc-sync).

## Acceptance Criteria

- [ ] ADR-0044 에 `ExportEntity → Prisma model + instant 컬럼` 매핑을 기록하는 단락(또는 §Decision §5 직후 inline subsection / §Follow-ups 의 결정 항목)을 추가한다. 다음 5 매핑을 표 또는 리스트로 박제: `Assessment→assessment.createdAt`, `Person→person.createdAt`, `Group→group.createdAt`, `LlmConfig→llmProviderConfig.createdAt`, `AuditLog→permissionDeniedRecord.createdAt`.
- [ ] 두 치환(`AuditLog→PermissionDeniedRecord`, `LlmConfig→LlmProviderConfig`)의 **사유**를 한국어 1~2줄로 명시: (1) `LlmConfig` 의 export-source 는 기존 `LlmProviderConfig` model (literal 이 약어일 뿐 동일 entity), (2) `AuditLog` 는 ADR-0044 §5 가 conceptual-only 로 둔 entity 라 v1 export-source 로 **현존하는 구체 감사 model `PermissionDeniedRecord` 를 stand-in** 으로 사용 — 일반 AuditLog model 이 별도 보안 ADR 로 신설되면 export-source 가 그 model 로 승격될 수 있음(forward note).
- [ ] §Decision §5 의 "AuditLog 는 conceptual mention / 별도 보안 ADR 책임" 서술과 본 치환이 **모순 아님**을 1줄로 정합화(ADR-0044 §5 의 경계 결정은 불변 — export-source 가 잠정적으로 PermissionDeniedRecord 를 가리킬 뿐, AuditLog entity 의 구체 schema 결정을 본 amend 가 내리지 않음을 명시).
- [ ] instant 컬럼 = 5 model 모두 `createdAt` 선택 근거(UC-07 §6.1 range scope [start,end) 판정의 "record 생성/발생 시각" 정합)를 1줄로 박제 — 코드 L89~92 주석과 정합.
- [ ] amend 단락이 source-of-truth 가 `src/export/export-job.service.ts` 의 `EXPORT_ENTITY_SOURCES` (T-0497) 임을 cross-reference(파일 경로 + T-0497 / PR #408).
- [ ] 본 amend 가 ADR-0044 의 기존 ACCEPTED Decision §1~§4 본문을 **변경하지 않음**(추가만) — git diff 가 신규 단락 + 필요한 경우 §Consequences line 65 의 entity 열거 1줄 정정(`AuditLog (실 export-source: PermissionDeniedRecord)`)만 보여줌.
- [ ] doc-only direct commit — R-112 test 항목은 [§3.2](../../CLAUDE.md) direct-mode doc-only 면제(코드 변경 0).

## Out of Scope

- `src/export/export-job.service.ts` 등 **코드 변경** — 본 task 는 이미 머지된 T-0497 구현을 사후 기록하는 doc-sync. `EXPORT_ENTITY_SOURCES` 매핑 자체를 바꾸지 않는다(코드 inline 주석도 그대로 둔다).
- 일반 `AuditLog` Prisma model 신설 / 보안 ADR — ADR-0044 §5 가 별도 책임으로 둔 그대로. 본 amend 는 "현재 stand-in 이 PermissionDeniedRecord" 라는 사실만 기록, AuditLog entity schema 결정 0.
- `summarizeExportSelection`(T-0449)·`estimateExportDumpSize`(T-0466)·`buildExportJobPlan`(T-0467)·`buildExportResult` 배선 — 다음 code slice(별도 pr task, §Follow-ups 참조).
- api.md 등 다른 doc 의 export entity 열거 정정 — 필요 시 §Follow-ups 기록(별도 doc-sync). 본 task 는 ADR-0044 1 파일만.
- data-model.md §4 dump-artifact 서술 갱신 — ADR-0044 가 contract source 라 본 task 우선; data-model.md 동기는 필요 판단 시 §Follow-ups(별도 task).
- 신규 ADR 번호 발급 / 새 ADR 파일 — 본 task 는 기존 ADR-0044 inline-amend(ACCEPTED 유지). 새 architectural 결정이 아니라 기 구현 결정의 사후 기록.

## Suggested Sub-agents

`architect` (단독 — ADR amend 는 architect 책임. doc-only direct 라 implementer/tester 불요. driver 가 직접 direct commit.)

(architect 호출 사유 — ADR-0044 §5 의 책임 경계 결정과 T-0497 치환의 정합성 판단은 architectural 검토가 필요하다. 단 새 결정을 내리는 게 아니라 기 머지된 구현 치환을 ADR contract source 에 사후 박제 + §5 와의 정합 서술이므로 doc-only.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **다음 code slice**: `summarizeExportSelection`(T-0449, `src/export/export-selection-summary.ts`)→`previewSelection` 결과(ExportSelection)를 사람-친화 breakdown 으로 합성하는 pr-mode 배선. T-0497 이 산출한 `ExportSelection` 위에 자연 연결되는 chain step8. EXPORT_ENTITY_SOURCES 매핑은 본 ADR amend 로 contract source 정합됨.
- 이후 `estimateExportDumpSize`(T-0466)→`buildExportJobPlan`(T-0467)→`buildExportResult` 순차 배선.
- 일반 AuditLog model 이 보안 ADR 로 신설되면 EXPORT_ENTITY_SOURCES 의 `AuditLog` export-source 를 PermissionDeniedRecord→AuditLog 로 승격(별도 task).
- data-model.md §4 dump-artifact entity 서술을 PermissionDeniedRecord 반영해 동기(별도 doc-sync).)
