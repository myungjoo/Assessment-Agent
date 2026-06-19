---
id: T-0514
title: export full-record allow-list select 상수 single-source 화 (entity 별 컬럼 + apiKey deny)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
independentStream: export-download-wiring
dependsOn: []
touchesFiles:
  - src/export/export-entity-full-record-select.ts
  - src/export/export-entity-full-record-select.spec.ts
plannerNote: P5 export download chain — ADR-0047 §Follow-ups[1] 첫 조각. entity 별 full-record allow-list select 상수 single-source + apiKey deny. R-112 backbone × 1.5.
---

# T-0514 — export full-record allow-list select 상수 single-source 화

## Why

[ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md) (b4d3eb2, ACCEPTED) §Decision1 이 export full-record DB-read 의 **entity 별 컬럼 allow-list** 와 **deny-list (`LlmProviderConfig.apiKey` secret)** 를 컬럼 경계로 박제했으나, 그 경계는 아직 코드로 옮겨지지 않았다 (결정 전용 0 LOC ADR). ADR-0047 §Follow-ups 의 dependency-order 첫 조각이 "`ExportRecord` full-record 확장 + entity 별 allow-list `select` 상수 single-source 화" 다. 본 task 는 그중 **select 상수 single-source 화** 부분만 — 5 entity 별 allow-list 컬럼을 Prisma `select` 객체 형태의 상수 + derive 함수 1개로 박제하는 **dependency-free 순수 helper** 1 파일이다. 이로써 후속 materialization service / repository query 가 본 상수를 contract 로 받아 바로 `delegate.findMany({ select })` 에 배선할 수 있고, secret (`apiKey`) 이 select 객체에 **애초에 없음** 을 single-source 로 보장한다 (Q-0043 옵션1 service-layer 배선 chain, REQ-030 Export / REQ-032 raw·secret 미저장).

## Required Reading

- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision1 (entity 별 컬럼 allow/deny 표) + §Decision2(c) (projection-only 강제) + §Decision3(ii) (allow-list 컬럼만 select). 본 task 의 contract source.
- `src/export/export-scope-select.ts` — `ExportEntity` 5 union (`Assessment`/`Person`/`Group`/`LlmConfig`/`AuditLog`) + `VALID_EXPORT_ENTITIES`. 본 helper 의 key 타입 source.
- `src/export/export-job.service.ts` L116~151 — `EXPORT_ENTITY_SOURCES` 매핑표 (5 entity → Prisma delegate + instantColumn) + `ExportEntityDelegate` union. instant projection single-source 패턴 (본 task 가 full-record allow-list 로 확장하는 mirror 대상). **수정하지 않는다** — 패턴만 참조.
- `prisma/schema.prisma` — 5 export entity (`Assessment`/`Person`/`Group`/`LlmProviderConfig`/`PermissionDeniedRecord`) 의 scalar 컬럼 정의. 특히 `LlmProviderConfig.apiKey` (deny 대상 secret) 위치 확인. allow-list 가 실 schema 컬럼과 일치하는지 검증용.
- colocated spec 위치: `src/export/export-entity-full-record-select.spec.ts` (신규, NestJS convention).

## Acceptance Criteria

- [ ] 신규 파일 `src/export/export-entity-full-record-select.ts` 생성 — 다음을 박제한다:
  - [ ] entity 별 full-record allow-list `select` 상수 `EXPORT_ENTITY_FULL_RECORD_SELECT: Record<ExportEntity, Record<string, true>>` (또는 동등한 single-source 구조). 각 entity 의 allow-list 컬럼 (ADR-0047 §Decision1 표) 만 `{ <col>: true }` 로 명시. `ExportEntity` 는 `./export-scope-select` 에서 import (새 union 신설 금지).
  - [ ] `LlmConfig` 의 select 객체에 `apiKey` key 가 **없음** (ADR-0047 §Decision2(b) deny-list — projection-only 강제).
  - [ ] derive 함수 `getExportEntityFullRecordSelect(entity: ExportEntity): Record<string, true>` 1개 — 미지원 entity 면 한국어 `RangeError`, 비-`ExportEntity` 입력이면 한국어 `TypeError` (export-scope-select 의 assert convention mirror). 반환 객체는 비-mutating (호출자가 변형해도 상수 원본 불변 — 방어 복제 또는 frozen).
  - [ ] 새 외부 dependency 0 (Node 내장 + 기존 타입 import 만, Prisma runtime import 0 — 순수 데이터 + key 타입만). DB / repository / controller / service 호출 0.
- [ ] happy-path test — 5 entity 각각에 대해 `getExportEntityFullRecordSelect(entity)` 가 ADR-0047 §Decision1 표의 allow-list 컬럼 key 를 정확히 포함함을 단언 (entity 별 1+).
- [ ] error path test — 미지원 entity (예: `"Unknown"`) → `RangeError`, `null`/`undefined`/비-string 입력 → `TypeError` (각 1+).
- [ ] flow / branch test — derive 함수의 정상 분기 (5 entity) + error 분기 (미지원/비-`ExportEntity`) 각 1+ test 로 분리.
- [ ] **negative cases 충분 cover** (예외 상황 분기마다 1+):
  - [ ] 🔥 secret deny 회귀 test — `getExportEntityFullRecordSelect("LlmConfig")` 결과에 `apiKey` key 가 **부재** 함을 명시 단언 (`expect(...).not.toHaveProperty("apiKey")`). ADR-0047 §Decision2(b) 핵심 invariant.
  - [ ] allow-list 멤버십 단언 — 각 entity 결과에 deny / 미정의 컬럼이 섞이지 않음 (정확한 key 집합 일치, ADR-0047 §Consequences "회귀 test 가 allow-list 멤버십 단언하면 누락도 catch").
  - [ ] 반환 객체 mutation 이 상수 원본에 영향 없음 (non-mutating / frozen 단언).
  - [ ] 미지원 entity / 비-string 등 경계 입력 각 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — backbone 패턴상 100% 목표).

## Out of Scope

- `ExportRecord` 타입의 full-record 확장 (`{entity, instant}` → 전체 record 본문) — **후속 task** (ADR-0047 §Follow-ups[1] 나머지 절반). 본 task 는 select 상수 single-source 만.
- `export-job.service.ts` 의 `collectExportRecords` 를 full-record read 로 실 배선 — 후속 task (본 상수를 소비하는 첫 caller). 기존 instant projection 코드 **수정 0**.
- service-layer materialization 함수 / `GET /api/admin/export/:id/download` streaming controller — 후속 chain (ADR-0047 §Follow-ups[2][3]).
- relation/nested include 깊이·순환 정책 — 후속 (ADR-0047 §Out of scope, 본 task 는 scalar allow-list 만).
- `prisma/schema.prisma` 수정 / migration — 본 task 는 기존 schema 의 컬럼을 select 상수로 옮길 뿐 schema 변경 0.
- STATE.json / journal / counters write (driver/planner 책임).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0047 가 이미 컬럼 경계를 결정했으므로 본 task 는 그 contract 를 코드로 옮기는 구현만).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
