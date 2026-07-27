---
id: T-1263
title: ExportEntity → Prisma delegate·model 매핑 공용 module 추출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 380
estimatedFiles: 4
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1262]
touchesFiles:
  - src/export/export-entity-sources.ts
  - src/export/export-entity-sources.spec.ts
  - src/export/export-job.service.ts
  - src/import/import-restore-order.spec.ts
sizeExempt: true
exemptReason: R-112 backbone slice — 신규 production module 은 ~90 LOC (cap 안) 이고 초과분은 전량 spec (5 entity × 매핑 3 축 + negative 다수) + 기존 사본 제거 diff. 동일 chain 선례 실측 T-1261 총 595 (production 106 / spec 489), T-1262 총 628 (production 154 / spec 474) 로 모두 spec 초과 상태로 머지됐다.
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 380 LOC, 선례 T-1262 실측 628(prod 154/spec 474) — ADR-0055 §Follow-up(b) $transaction slice 의 prerequisite"
---

# T-1263 — ExportEntity → Prisma delegate·model 매핑 공용 module 추출

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (… → FK 안전 실행 순서 → operation 그룹핑 → **ADR-0044 §3 atomic `$transaction` 복원** → controller 재배선) 의 **아홉 번째 slice** 이자, 다음 slice (실 `$transaction`) 의 **prerequisite** 다. T-1262 가 산출하는 `ImportRestoreOperation` 은 `entity` 이름 (`LlmConfig` / `AuditLog` 같은 5 literal) 만 들고 있어서, 실제 `prisma.llmProviderConfig.createMany(...)` 를 호출하려면 **entity → Prisma delegate accessor** 매핑이 필요하다. 그 매핑표는 이미 [`export-job.service.ts`](../../src/export/export-job.service.ts) 138~173행에 `EXPORT_ENTITY_SOURCES` 로 존재하지만 **module-private** 라 import 경로가 없고, [`import-restore-order.spec.ts`](../../src/import/import-restore-order.spec.ts) 289행에는 같은 지식의 **사본** (`ENTITY_TO_PRISMA_MODEL`) 이 따로 박혀 있다 (T-1261 reviewer round 2 NIT-1 이월분).

본 slice 는 그 매핑을 공용 module 로 승격해 **단일 source-of-truth** 로 만든다 — 하류 `$transaction` slice 가 세 번째 사본을 만들지 않게 하고, entity 추가 시 컴파일 단계에서 누락을 잡는 `Record<ExportEntity, ...>` 강제를 한 곳에 모은다. 런타임 동작 변경 0 의 순수 추출 + 배선 (PLAN.md 137행 R-57 backup/restore 의 restore 경로 실동작 완결로 가는 길목).

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §1 dump 대상 5 entity, §2 raw 미저장 / artifactRef, §3 `$transaction` 복원 계약.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) — 138~173행 `EXPORT_ENTITY_SOURCES` + `ExportEntityDelegate` (추출 대상 원본) 과 504~560행 두 소비처 (`Object.entries(EXPORT_ENTITY_SOURCES)` 순회).
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportEntity` union (5 literal) 과 `VALID_EXPORT_ENTITIES` 집합 (멤버십 판정 재사용 대상).
- [src/import/import-restore-order.spec.ts](../../src/import/import-restore-order.spec.ts) — 289~295행 `ENTITY_TO_PRISMA_MODEL` 사본 (제거 대상) 과 398~409행 사용처.
- [src/import/import-restore-ops.ts](../../src/import/import-restore-ops.ts) — 하류 소비자 형태 (`ImportRestoreOperation.entity`) 확인용. 본 task 는 수정 대상 아님.
- [src/export/export-entity-full-record-select.ts](../../src/export/export-entity-full-record-select.ts) — 같은 매핑 지식을 참조하는 sibling helper 의 주석 규약 (동형 유지용).

## Acceptance Criteria

- [ ] `src/export/export-entity-sources.ts` 신설 — `ExportEntityDelegate` (5 literal union), `ExportEntitySource` (`{ delegate; model; instantColumn }`), `EXPORT_ENTITY_SOURCES` (`Readonly<Record<ExportEntity, ExportEntitySource>>`), `exportEntityPrismaModel(entity: ExportEntity): string` 를 export 한다.
- [ ] `model` 필드는 Prisma model 이름 (PascalCase — `LlmConfig → LlmProviderConfig`, `AuditLog → PermissionDeniedRecord`, 나머지 3 개는 동명) 을 담는다. delegate 문자열에서 문자열 조작으로 파생시키지 않고 **명시 값**으로 박제한다 (오타·convention 변경에 취약한 파생 금지).
- [ ] `src/export/export-job.service.ts` 는 로컬 `EXPORT_ENTITY_SOURCES` 상수와 `ExportEntityDelegate` 타입 선언을 **삭제**하고 새 module 에서 import 한다. **런타임 동작 변경 0** — 기존 `export-job.service.spec.ts` 를 수정 없이 전부 통과 (`instantColumn` 기반 projection-only read 규약 유지, REQ-032).
- [ ] `src/import/import-restore-order.spec.ts` 의 `ENTITY_TO_PRISMA_MODEL` 사본을 제거하고 `exportEntityPrismaModel` (또는 `EXPORT_ENTITY_SOURCES`) 에서 model 이름을 얻도록 바꾼다. 기존 schema 사실 고정 test 의 단언 내용·강도는 그대로 유지 (약화 금지).
- [ ] 순수 module — DB · Prisma client 인스턴스 · repository · file I/O · REST 배선 0. 상수는 호출자가 변형할 수 없도록 `Readonly` 타입 + `Object.freeze` 로 보호하고, `exportEntityPrismaModel` 은 non-mutating.
- [ ] **happy-path unit test 1+** — 5 entity 각각에 대해 `EXPORT_ENTITY_SOURCES[entity]` 의 `delegate` / `model` / `instantColumn` 3 축 값이 기대값과 일치, `exportEntityPrismaModel` 이 5 entity 모두에 대해 올바른 model 이름을 돌려주는지 검증.
- [ ] **error path unit test 1+** — `exportEntityPrismaModel` 에 union 밖 값 (오타 문자열 / 소문자 / 빈 문자열) → RangeError, 비-string (null / undefined / 숫자 / 객체 / 배열) → TypeError. 메시지는 한국어이며 입력 원본 객체를 문자열로 강제 변환해 싣지 않는다 (REQ-032 — 비-string 은 타입 이름만 노출).
- [ ] **분기 cover** — `exportEntityPrismaModel` 의 (a) 정상 조회, (b) string 이지만 union 밖, (c) 비-string 세 분기 각 1+ test. 매핑표 쪽은 5 entity × 존재/부재 분기 cover.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+: (a) 비-string 입력 4 종 (null / undefined / 숫자 / 객체), (b) union 밖 string 3 종 (오타 / 소문자 / 빈 문자열), (c) `"__proto__"` / `"constructor"` 같은 prototype 오염 유도 key 로 조회해도 RangeError (상속 속성 오탐 0), (d) 반환 model 문자열을 호출자가 바꿔도 다음 호출 결과 불변, (e) `EXPORT_ENTITY_SOURCES` 에 write 시도 시 값이 바뀌지 않음 (freeze 증명), (f) 매핑표 key 집합이 `VALID_EXPORT_ENTITIES` 와 정확히 일치 (entity 추가/삭제 회귀 catch — 누락도 여분도 없음), (g) 5 delegate 값이 서로 중복되지 않음, (h) 5 model 값이 서로 중복되지 않음.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1262 동형).
- [ ] `scripts/check-spec-presence.sh` 통과 — 신규 production `.ts` 에 colocated spec 존재 (`src/export/export-entity-sources.spec.ts`), `prettier --check` 통과.

## Out of Scope

- 실 `$transaction` 실행 · Prisma delegate 호출 · DB 접근 (다음 slice). 본 task 는 **이름 매핑 표**만 다루며 delegate 를 실제로 호출하지 않는다.
- `import-restore-ops.ts` / `import-restore-order.ts` production 코드 수정 (본 task 는 order 의 **spec** 사본만 정리).
- `export-job.service.ts` 의 `previewSelection` / `SCOPE_ENUM_TO_PAYLOAD` / chunk 관련 로직 변경, service 의 다른 리팩터 (동일 파일이라도 매핑표 import 전환 외 손대지 않는다).
- `ExportEntity` union 자체의 확장 (AuditLog 실 model 승격 등 — ADR-0044 §Follow-ups).
- `import.controller.ts` 의 interim false-success guard 교체 · REST 배선 (chain 마지막 slice).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` sub-multiplier 박제 follow-up 에 T-1261 / T-1262 실측치 합산 — T-1261 총 595 (production 106 / spec 489, nit-closure +221 포함), T-1262 총 628 (production 154 / spec 474). `sizeExempt` 근거 추정치의 약 1.3~1.9 배이며 **nit-closure 분량도 추정에 포함해야 한다**는 항목 추가.
- (T-1259~T-1262 이월, 미회수) `src/export/import-dump-validate.ts` 53 / 93행의 `generatedAt` issue 메시지가 "ISO 파싱 가능한 string" 이라고 적혀 있으나 실제 판정은 `new Date()` 파싱 기준 — 문구 정합 필요.
