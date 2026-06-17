---
id: T-0457
title: UC-07 Export 다운로드 artifact descriptor 조립 순수 helper buildExportArtifactDescriptor
phase: P7
status: DONE
completedAt: 2026-06-17T07:15:27Z
mergedAs: 89a49e1
prNumber: 368
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
independentStream: uc07-export-import
dependsOn: []
touchesFiles:
  - src/export/export-artifact-descriptor.ts
  - src/export/export-artifact-descriptor.spec.ts
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §5 step13·§8(a)(c) Export file artifact 전달 — dump→다운로드 descriptor(filename/content-type/size/disposition) 0회-cover gap, 게이트-free, dependsOn []"
---

# T-0457 — UC-07 Export 다운로드 artifact descriptor 조립 순수 helper buildExportArtifactDescriptor

## Why

UC-07 §5 step13 (`Export: 다운로드 완료`) + §8 (a)(c) Export postcondition (`Admin 에게 file artifact 전달 완료`) 는 Export 가 만든 dump envelope 를 사람·브라우저에 **다운로드 가능한 파일**로 전달할 때 필요한 artifact 메타데이터(파일명·content-type·byte size·content-disposition 헤더 값)를 요구한다. 그러나 T-0437~T-0456 의 20 building block 중 이 다운로드 artifact descriptor 조립은 0회 cover 된 gap이다 — `buildExportDump`(T-0438)는 직렬화 가능한 envelope(`schemaVersion/generatedAt/scope/entityCounts/recordCount/records`)만 조립하고 파일명/content-type/disposition 은 전혀 산출하지 않으며(`git grep` 으로 filename/contentType/disposition 0 매칭 확인), `buildExportResult`(T-0456)는 사람이 읽을 결과 메시지일 뿐 다운로드 메타가 아니다. 본 task 는 그 envelope 를 받아 다운로드 artifact descriptor 로 조립하는 순수 helper를 박제한다 — 실 file streaming·REST·persistence 0 (게이트-free).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step13·§8 (a)(c) Export postcondition(file artifact 전달), §6.1 scope 옵션(full/range/partial — 파일명 토큰화 source).
- `src/export/export-dump.ts` — 입력 타입 `ExportDump`(schemaVersion/generatedAt/scope/entityCounts/recordCount/records) + 재사용할 `ExportEntity`.
- `src/export/export-scope-select.ts` — `ExportScope`(scope/dateRange/entitySelector) 형태 + `PeriodRange` 재사용.
- `src/export/export-result.ts` — T-0456 의 순수 조립 helper 패턴(non-mutating · 입력 방어 · 한국어 TypeError/RangeError)을 mirror.

## Acceptance Criteria

- [ ] `src/export/export-artifact-descriptor.ts` 신설 — `buildExportArtifactDescriptor(dump: ExportDump, options?: { now?: Date })` 순수 함수 + 결과 interface `ExportArtifactDescriptor` export. 새 도메인 타입은 `ExportArtifactDescriptor` 만 신설하고 `ExportDump`/`ExportScope`/`ExportEntity`/`PeriodRange` 는 재사용(새 dep 0).
- [ ] descriptor 는 최소 `{ fileName, contentType, byteSizeHint, contentDisposition, scopeToken }` 를 담는다 — `fileName` 은 scope 토큰(full/range/partial) + `dump.generatedAt`(또는 options.now) 기반 timestamp 토큰 + 확장자(`.json`)로 조립, `contentType` 은 `application/json`, `byteSizeHint` 은 `JSON.stringify(dump)` 의 byte length 추정, `contentDisposition` 은 `attachment; filename="<fileName>"` 형태, `scopeToken` 은 §6.1 scope 분기별 토큰. (구체 필드명·포맷은 implementer 재량, 단 위 5 정보가 모두 표현돼야 함.)
- [ ] non-mutating — 입력 `dump` 객체·중첩 배열을 변형하지 않음(테스트가 deepFreeze 또는 snapshot 비교로 단언).
- [ ] **Happy-path unit test 1+**: scope=full / range / partial 각각에 대해 정상 descriptor 조립(파일명에 scope 토큰 + timestamp 포함, content-disposition 정합) 검증.
- [ ] **Error path unit test 1+**: `dump` 가 null/undefined/비-object 면 한국어 TypeError; `dump.scope` 부재 또는 `dump.scope.scope` 가 5 허용 외 값이면 한국어 RangeError; `options.now` 가 비-Date/Invalid Date 면 한국어 TypeError(`buildExportDump` assertValidDate convention mirror).
- [ ] **Flow / branch coverage**: scope full/range/partial 3 분기 각각 1+ test, `options.now` 제공 분기 vs `dump.generatedAt` fallback 분기 각각 1+ test, byteSizeHint 빈 records(recordCount 0) vs 다수 records 각각 1+ test.
- [ ] **Negative cases 충분 cover**: (a) `dump` 비-object(null/숫자/문자열) → TypeError, (b) `dump.scope` 부재 → 명시 error, (c) scope 값이 허용 외(`"weird"`) → RangeError, (d) `options.now` Invalid Date(`new Date("nope")`) → TypeError, (e) `dump.generatedAt` 가 ISO string 이 아닌 비정상 값일 때의 방어, (f) fileName 에 경로 traversal/특수문자가 섞이지 않도록 sanitize 검증(예: scope/timestamp 토큰이 안전한 charset). 예외 처리 분기마다 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치 `src/export/export-artifact-descriptor.spec.ts` (NestJS convention — 신규 helper와 동일 디렉토리).

## Out of Scope

- 실 file streaming / `res.download` / chunked response / resumable — REST controller 영역(repository 게이트된 후속).
- 실 byte size 의 정확 측정(압축·encoding 고려) — 본 helper 는 추정 hint 만. 실 streaming 시 실측은 후속.
- 압축 archive(`.gz`/`.zip`) 포맷 / SQL dump 포맷 — JSON dump 단일 포맷만(§6.1 구체 포맷 후속).
- Export/Import 실 배선(실 DB dump query·transaction·Audit row insert) — schema/repository 게이트된 후속.
- `docs/STATE.json` / journal / counters write — driver/planner 소유.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — sub-agent 가 발견 시 여기에 append)
