---
id: T-0515
title: ExportRecord full-record 확장 타입 + buildFullExportRecord 순수 builder (secret deny 단언)
phase: P7
status: DONE
commitMode: pr
prNumber: 428
mergedAt: 2026-06-19T05:08:04Z
mergeCommit: 6537757
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
dependsOn: []
independentStream: export-download-materialization
touchesFiles: [src/export/export-full-record.ts, src/export/export-full-record.spec.ts]
plannerNote: "ADR-0047 §Follow-ups[1] 잔여 — full-record materialization 입력 contract(FullExportRecord 타입+builder), dependency-free 순수 helper, T-0514 select 상수의 소비측 짝"
---

# T-0515 — ExportRecord full-record 확장 타입 + buildFullExportRecord 순수 builder

## Why

[ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md) §Follow-ups[1] (`ExportRecord` full-record 확장)의 잔여 절반이다. Q-0043 옵션1(게이트1 service-layer 배선 chain)의 ADR-우선 gate 결정이 ADR-0047(ACCEPTED)로 이미 닫혔고, 그 chain 의 첫 코드 조각인 select 상수 single-source 는 T-0514(merge 81f115b)가 박제했다. 그러나 그 select 상수를 **소비해 실제 dump record 를 조립하는 contract** — `{entity, instant}` 만 가진 현 `ExportRecord` 를 full-record payload 까지 담는 `FullExportRecord` 로 확장하는 타입 + 순수 builder — 는 아직 없다. 본 task 가 그 materialization 입력 contract 를 dependency-free 순수 helper 로 박제해, 후속 impure repository/service 배선이 contract 를 받아 바로 배선하도록 한다. REQ-030(Export) / REQ-032(raw 미저장 + secret 제외)의 materialization 측 경계를 코드로 실증한다.

본 helper 는 DB / Prisma / repository / service / controller 를 일절 건드리지 않는 순수 함수 + 타입 1 파일이다(T-0506 materializeExportDump · T-0438 buildExportDump · T-0514 select 상수의 순수-helper 패턴 mirror). 실 DB full-record read 배선(impure)은 본 task 의 다음 step 이며 별도 task 다.

## Required Reading

- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision1(entity 별 allow-list 표) · §Decision2(a)(b)(c) (raw-미저장 논증 + `apiKey` secret deny + projection-only 강제) · §Decision3(ii) (allow-list 컬럼만, deny read 금지) · §Out of scope · §Follow-ups[1].
- `src/export/export-scope-select.ts` — 현 `ExportEntity` union(5 종) + `ExportRecord` 타입(`{entity, instant}`) + `VALID_EXPORT_ENTITIES` 상수 + assertValidDate convention(import 대상).
- `src/export/export-entity-full-record-select.ts` — T-0514 산출 `EXPORT_ENTITY_FULL_RECORD_SELECT` 상수 + `getExportEntityFullRecordSelect` derive 함수 + `FullRecordSelect` 타입(본 builder 의 짝 — allow-list key 집합 source).
- `src/export/export-dump.ts` — `buildExportDump` 가 소비하는 `ExportRecord[]` payload 형태(본 task 산출 `FullExportRecord` 가 향후 이 자리에 들어감 — 호환 방향 확인용, 변경 금지).
- **colocated spec 위치**: 신규 spec 은 `src/export/export-full-record.spec.ts` (colocated) 에 둔다. 기존 공유 mock 불요(순수 helper — DB mock 0).

## Acceptance Criteria

- [ ] 새 파일 `src/export/export-full-record.ts` 에 다음을 박제:
  - `FullExportRecord` 타입 — `ExportRecord`(`{entity, instant}`)를 확장해 `fields: Record<string, unknown>` 를 추가(`{entity, instant, fields}`). `export-scope-select.ts` 의 `ExportEntity`/`ExportRecord` 를 import 재사용(새 union/record 신설 금지).
  - `buildFullExportRecord(entity, instant, fields)` 순수 함수 — 검증 후 동결/방어복제된 `FullExportRecord` 를 반환. `EXPORT_ENTITY_FULL_RECORD_SELECT` 의 해당 entity allow-list key 집합을 source 로 활용(deny key 단언 — 아래 secret 분기).
- [ ] **secret deny 단언(REQ-032 §Decision2(b) 핵심)**: `fields` 에 deny-listed secret key(특히 `LlmConfig` 의 `apiKey`)가 포함되면 한국어 RangeError 를 throw 한다(materialization 조립 layer 의 방어선 — projection-only 가 1차 guard 이나 본 builder 가 2차 단언으로 secret 의 dump 혼입을 차단). allow-list 외 임의 key 포함 시의 정책(엄격 거부 vs 무시)은 구현이 ADR-0047 §Decision2 에 맞춰 결정하되 그 분기를 명시 주석으로 박제.
- [ ] **Happy-path unit test**: 5 entity 각각에 대해 allow-list 컬럼만 담은 `fields` 로 `buildFullExportRecord` 호출 시 정상 `FullExportRecord` 반환 1+ test(`entity`/`instant`/`fields` 정확 보존).
- [ ] **Error path unit test**: 비-string entity → TypeError, 미지원 entity literal → RangeError, 비-Date/Invalid Date instant → TypeError, `fields` 비-plain-object → TypeError 각 1+ test.
- [ ] **secret deny regression test(REQ-032 negative 핵심)**: `LlmConfig` entity 에 `apiKey` 가 든 `fields` 로 호출 시 RangeError 단언 + 반환 객체에 `apiKey` key 부재(`.not.toHaveProperty("apiKey")`) 회귀 test 1+. 향후 다른 secret key 추가 시 동형으로 catch 됨을 주석 명시.
- [ ] **Flow / branch coverage**: builder 안 모든 입력 방어 분기(entity 타입/멤버십 · instant 유효성 · fields 형태 · secret 포함)마다 test branch 분리 1+.
- [ ] **Negative cases 충분 cover**: 빈 `fields`(allow-list 일부만/전무) 경계 · 잘못된 entity · Invalid Date · null/undefined fields · secret 혼입 등 예외 분기마다 각 1+ test(단일 negative 금지).
- [ ] **non-mutating**: 입력 `fields` 객체를 변형하지 않고 새 객체를 반환(`Object.freeze(fields)` 로 호출해도 통과) test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80%, 순수 helper 라 100% 목표).
- [ ] tester 가 `tester` sub-agent 로 호출되어 test 결과 확인(R-110).

## Out of Scope

- 실 DB full-record read 배선(impure) — `export-job.service.ts` 의 `collectExportRecords` 를 instant-only → full-record 로 확장하는 repository query 변경은 **별도 후속 task**(본 task 는 DB / Prisma / service 일절 미변경).
- `buildExportDump` / `materializeExportDump` 의 입력 타입을 `FullExportRecord` 로 교체하는 배선 — 후속 task(본 task 는 contract 타입 + builder 만 신설, 기존 helper 시그니처 변경 0).
- `GET /api/admin/export/:id/download` controller 배선 — 후속 task.
- chunk 단위 직렬화 / relation·nested include 정책 — ADR-0047 §Out of scope, 후속 task.
- `export-scope-select.ts` / `export-dump.ts` / `export-entity-full-record-select.ts` 의 기존 export 시그니처 변경(import 재사용만, 변경 금지).
- 새 외부 dependency / credential 추가(있으면 §5 BLOCKED).

## Suggested Sub-agents

`implementer → tester` (architecture 결정은 ADR-0047 이 이미 박제 — architect 불요).

## Resume note

- 코드 완성·PR #428 open(`claude/T-0515-export-full-record-build`). reviewer APPROVE round1/7 + 외부 PR comment 존재(4-게이트 a+b+c PASS). 로컬 5275 test pass·lint/build green·신규 파일 100% cov·새 dep 0.
- **BLOCKED 사유 = CI green 미충족 (account billing/spending-limit)**: GitHub Actions job 이 step 0개로 즉시 실패(annotation: 'recent account payments have failed or your spending limit needs to be increased'). 03:54Z green → 04:11Z 부터 재발한 infra block(코드 결함 아님). Q-0044 / B-credential-ci-billing-2026-06-19T04:39Z.
- **resume 경로**: 사용자가 Billing & plans 조치 + PR #428 CI rerun → green 시 다음 fire 가 prNumber=428 resume(또는 currentTask=T-0515 resume)으로 PR #428 을 이어 4-게이트 재평가→merge. 코드 rework 0.

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 append.)
