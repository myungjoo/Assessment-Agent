---
id: T-0466
title: UC-07 §8 NFR Export dump 예상 크기 산정·대량 dump async/streaming 권고 안내 순수 helper estimateExportDumpSize
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-dump-size-estimate.ts
  - src/export/export-dump-size-estimate.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR(대량 dump async/streaming) gap — Import 측 validateImportDumpSize 의 Export 대칭 부재. pr·게이트-free·dependsOn []."
---

# T-0466 — UC-07 §8 NFR Export dump 예상 크기 산정·대량 dump async/streaming 권고 안내 순수 helper estimateExportDumpSize

## Why

UC-07 §8 NFR 은 "본 UC 의 응답 시간은 dump size 에 비례. read 한정 SLA [REQ-048] 의 3 초는 일반적 dump 에 적용, **대량 dump 는 long-running operation 가능 — async job + status polling + chunked streaming**" 을 명시한다. Import 측에는 `validateImportDumpSize`(T-0450)가 size cap 검증 verdict 를 산출하지만, **Export 측에는 선별된 record 집합의 예상 dump 크기를 산정하고 "이 크기면 동기 다운로드 / 대량이라 async·streaming 권고" 를 안내하는 대칭 helper 가 0 회 cover 된 gap** 이다(`git grep estimateExportDumpSize|ExportDumpSizeEstimate|estimateExport|exportSize` src/ → 0 매칭). `summarizeExportSelection`(T-0449)은 selected/excluded breakdown 만 derive 하고 byte 단위 크기 추정·async 임계 판정은 하지 않는다. 본 helper 는 UC-07 §3 trigger 1 의 scope 옵션 confirmation dialog + §5 step 2 가 필요로 하는 "선택한 scope 의 예상 다운로드 규모 + 대량 시 long-running 경고" 를 순수 합성으로 박제한다. 실 직렬화 / DB query / streaming / async job 0 — 입력으로 받은 selection 의 record 수와 entity-별 byte weight 만으로 추정한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — 대량 dump async/streaming) + §6.1 (Export scope 옵션) + §3 trigger 1
- `src/export/import-dump-size-validate.ts` — 대칭 size 판정 helper(verdict shape · 입력 방어 throw · 한국어 message convention · 5-entity 0-init map · isPlainObject / isValidCap mirror 대상)
- `src/export/export-selection-summary.ts` — 입력 ExportSelection 구조 + perEntity 5-entity breakdown 패턴(`ExportSelectionGroupBreakdown` 산출 방식 참조)
- `src/export/export-scope-select.ts` — `ExportSelection` / `ExportRecord` / `ExportEntity` / `VALID_EXPORT_ENTITIES` 재사용 타입 source
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-dump-size-estimate.ts` 신설. 신규 도메인 타입 `ExportDumpSizeEstimate`(plain object: `estimatedBytes`, `humanSize`(예 "1.2 MB" 한국어/SI label), `recordTotal`, `perEntityBytes: Record<ExportEntity, number>`, `large: boolean`, `recommendation: "sync" | "async-streaming"`, `guidanceLines: string[]`) + 옵션 타입 `ExportDumpSizeEstimateOptions`(`bytesPerRecord?`(entity 별 byte weight `Partial<Record<ExportEntity, number>>`, 부재 entity 는 default weight), `defaultBytesPerRecord?`, `asyncThresholdBytes?`(이 값 초과 시 large=true·async-streaming 권고, 부재 시 DEFAULT 상수)) 만 신설. `ExportSelection` / `ExportEntity` 등은 재사용.
- [ ] `estimateExportDumpSize(selection, options?)` 순수 함수: `selection.selected` record 를 entity-별로 1 회 순회 집계 → entity 별 byte weight 를 곱해 `perEntityBytes` + `estimatedBytes`(합) 산출. `estimatedBytes > asyncThresholdBytes` 면 `large=true` + `recommendation="async-streaming"`, 아니면 `large=false` + `recommendation="sync"`. `humanSize` 는 byte → B/KB/MB/GB 사람-친화 한국어 라벨. `guidanceLines` 는 한국어 — sync 면 "3 초 내 동기 다운로드 가능" 류, async-streaming 면 "대량 dump — async job + status polling / chunked streaming 권고"(§8 NFR 문구) 류. non-mutating(입력 selection 변형 0). `large === (recommendation === "async-streaming")` 불변.
- [ ] 입력 방어: `selection` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "selection"). `selection.selected` 가 배열 아님 → `TypeError`(label "selection.selected"). `options` 가 비-object(배열/null 제외 — undefined 는 정상) → `TypeError`. `bytesPerRecord`/`defaultBytesPerRecord`/`asyncThresholdBytes` 가 비-정수·음수·NaN·Infinity 등 부적합 byte weight → `TypeError`(어느 옵션/어느 entity 인지 메시지 박제). `bytesPerRecord` 가 비-object → `TypeError`.
- [ ] **Happy-path unit test**: `estimateExportDumpSize` 에 정상 selection(여러 entity 혼합 record) 입력 → 기대 `estimatedBytes`/`perEntityBytes`/`humanSize`/`large`/`recommendation`/`guidanceLines` 검증 test 1+. sync 경로(임계 미만)와 async-streaming 경로(임계 초과) 각각 1+.
- [ ] **Error path unit test**: selection 비-object / selected 비-배열 / options 비-object / byte weight 부적합(음수·소수·NaN·Infinity·비-number) 각각에 대해 `TypeError` throw 검증 test 1+ (메시지 label 포함 확인).
- [ ] **Flow / branch 분리 test**: large 분기(true/false 양측), 빈 selection(`selected: []` → estimatedBytes 0 / recommendation sync / humanSize "0 B" 정상), bytesPerRecord 일부 entity 만 지정(나머지 default weight 적용), asyncThresholdBytes 경계값(임계와 정확히 같을 때의 동작 명시·test), humanSize 의 B/KB/MB/GB 각 단위 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 5 허용 외 entity 값이 record 에 섞여도 자연 무시(perEntity key 없음, T-0440 구조 검증 책임 위임) 검증, `large === (recommendation === "async-streaming")` 불변 검증, non-mutating(입력 selection 객체 동일성·필드 불변) 검증, option 미지정 시 default weight·default threshold 적용 검증 — 각 1+ test.
- [ ] `src/export/export-dump-size-estimate.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 dump 직렬화 / 실 byte 측정 / 실 DB query / 실 streaming / async job / status polling 배선 — 본 helper 는 순수 추정(입력 weight × record 수)만. 실 크기 측정은 P5 service layer(repository 게이트).
- REST controller / endpoint / multipart / HTTP status 매핑 — repository 게이트 후속.
- `selectExportRecords`(T-0437) / `summarizeExportSelection`(T-0449) 로직 재구현 — 본 helper 는 selection 을 입력으로만 받는다(DRY).
- entity 별 byte weight 의 정책 source(ENV / DB row / config) — 본 helper 는 옵션으로 받은 값만 사용(정책 source 0).
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
