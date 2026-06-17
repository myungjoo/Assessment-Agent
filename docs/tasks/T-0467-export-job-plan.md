---
id: T-0467
title: UC-07 §8 NFR Export 다운로드 실행 plan(동기 다운로드 vs async job + status polling) 조립 순수 helper buildExportJobPlan
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-job-plan.ts
  - src/export/export-job-plan.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — estimateExportDumpSize(T-0466)는 sync/async-streaming 권고만 산출, async job + status polling 실행 plan descriptor 는 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0467 — UC-07 §8 NFR Export 다운로드 실행 plan(동기 다운로드 vs async job + status polling) 조립 순수 helper buildExportJobPlan

## Why

UC-07 §8 NFR 은 대량 dump 를 "long-running operation 가능 — **async job + status polling + chunked streaming**" 으로 처리하라 명시한다. 직전 `estimateExportDumpSize`(T-0466)는 예상 크기로부터 `recommendation: "sync" | "async-streaming"` + `large: boolean` 권고만 산출할 뿐, **그 권고를 실제 실행 plan(동기 즉시 다운로드 경로 또는 async job descriptor — job mode·status 상태 집합·polling 안내·chunk 권고)으로 조립하는 helper 는 30 helper 중 0 회 cover 된 gap** 이다(`git grep buildExportJobPlan|ExportJobPlan|exportJob|statusPolling|asyncJob src/` → 0 매칭). T-0466 의 size estimate 가 "이 dump 는 대량" 까지만 판정한다면, 본 helper 는 그 추정을 입력으로 받아 "그럼 어떻게 전달할 것인가(즉시 streaming vs job 생성 후 polling)" 의 사람-친화 실행 plan 을 순수 합성으로 박제한다. UC-07 §5 step 13(Export 다운로드 완료) + §3 trigger 1(scope confirmation dialog) 의 다운로드 방식 안내가 필요로 하는 plan descriptor 를 채운다. 실 async job 생성 / queue / status store / streaming / polling endpoint 0 — 입력으로 받은 estimate 의 `recommendation` / `large` / `humanSize` / `recordTotal` 만으로 plan 을 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13 + §3 trigger 1
- `src/export/export-dump-size-estimate.ts` — 입력 `ExportDumpSizeEstimate` 타입(`estimatedBytes` / `humanSize` / `recordTotal` / `perEntityBytes` / `large` / `recommendation` / `guidanceLines`) + `isPlainObject` / `describeNonObject` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 estimate 를 입력으로만 받고 estimateExportDumpSize 를 재호출하지 않는다(DRY).**
- `src/export/import-mode-description.ts` — 구조화 입력 → 사람-친화 plain 모델 조립 helper 의 shape 패턴 참조(headline + lines[] 류)
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-job-plan.ts` 신설. 신규 도메인 타입만 신설: `ExportJobMode = "sync-download" | "async-job"`, `ExportJobStatus = "queued" | "running" | "ready" | "failed"`(async job 의 상태 집합 — 실 store 0, plan 안내용 enum), `ExportJobPlan`(plain object: `mode: ExportJobMode`, `chunked: boolean`(대량 시 chunked streaming 권고 여부), `pollingRequired: boolean`, `statusFlow: ExportJobStatus[]`(async 면 queued→running→ready 순, sync 면 빈 배열), `headline: string`, `instructionLines: string[]`(한국어 단계 안내)). 옵션 타입 `ExportJobPlanOptions`(`chunkThresholdBytes?`(이 byte 초과 시 chunked=true, 부재 시 DEFAULT 상수), `pollIntervalSeconds?`(polling 안내 문구에 쓸 간격, 부재 시 DEFAULT 상수)) 만 신설. `ExportDumpSizeEstimate` 는 재사용(import).
- [ ] `buildExportJobPlan(estimate, options?)` 순수 함수: `estimate.recommendation === "async-streaming"`(== `estimate.large`)이면 `mode="async-job"` + `pollingRequired=true` + `statusFlow=["queued","running","ready"]` + chunked streaming·status polling 단계 안내(한국어), 아니면 `mode="sync-download"` + `pollingRequired=false` + `statusFlow=[]` + 즉시 다운로드 안내. `chunked` 는 `estimate.estimatedBytes > chunkThresholdBytes` 일 때 true. `instructionLines` 는 한국어 — async 면 "Export job 생성 → 상태 polling(약 N 초 간격) → ready 시 chunked 다운로드" 류, sync 면 "즉시 다운로드" 류. non-mutating(입력 estimate / options 변형 0, 반환 배열·객체는 항상 새 것). 불변: `mode === "async-job"` ⟺ `pollingRequired === true` ⟺ `statusFlow.length > 0`.
- [ ] 입력 방어: `estimate` 가 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "estimate"). `estimate.recommendation` 이 `"sync"`/`"async-streaming"` 외 값 → `RangeError`(받은 값 박제). `estimate.estimatedBytes` 가 비-정수·음수·NaN·Infinity → `TypeError`. `options` 가 비-object(배열/null — undefined 는 정상) → `TypeError`. `chunkThresholdBytes` / `pollIntervalSeconds` 가 비-정수·음수·NaN·Infinity 등 부적합 → `TypeError`(어느 옵션인지 메시지 박제).
- [ ] **Happy-path unit test**: `buildExportJobPlan` 에 async-streaming estimate 입력 → `mode="async-job"`·`pollingRequired=true`·`statusFlow=["queued","running","ready"]`·`chunked`·`instructionLines` 기대값 검증 test 1+. sync estimate 입력 → `mode="sync-download"`·`statusFlow=[]`·`pollingRequired=false` 검증 test 1+.
- [ ] **Error path unit test**: estimate 비-object / recommendation 허용 외 값(RangeError) / estimatedBytes 부적합(음수·소수·NaN·Infinity·비-number) / options 비-object / chunkThresholdBytes·pollIntervalSeconds 부적합 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인).
- [ ] **Flow / branch 분리 test**: mode 분기(async/sync 양측), chunked 분기(estimatedBytes 가 chunkThresholdBytes 초과/이하/경계값 — 경계 동작 명시·test), options 미지정 시 default chunkThreshold·default pollInterval 적용, pollIntervalSeconds 지정 시 instructionLines 문구 반영 각 1+ test.
- [ ] **Negative cases 충분 cover**: `mode === "async-job"` ⟺ `pollingRequired === true` ⟺ `statusFlow.length > 0` 3-동치 불변 검증, non-mutating(입력 estimate 객체 동일성·필드 불변 — freeze 입력 통과) 검증, `large=true` 이지만 `recommendation="sync"` 같은 모순 estimate 입력 시의 처리 명시(recommendation 을 ground truth 로 — large 무시 또는 명시 throw 중 하나를 spec 의 describe 문자열로 박제하고 test) 각 1+ test.
- [ ] `src/export/export-job-plan.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 async job 생성 / job queue / job id 발급 / status store / status polling endpoint / chunked streaming 직렬화 / resumable upload 배선 — 본 helper 는 순수 plan descriptor 조립만. 실 job lifecycle 은 P5 service layer(repository / scheduler 게이트).
- REST controller / endpoint / HTTP status / SSE·long-poll 응답 — repository 게이트 후속.
- `estimateExportDumpSize`(T-0466) 재호출·재구현 — 본 helper 는 `ExportDumpSizeEstimate` 를 입력으로만 받는다(DRY).
- chunk 크기·poll 간격의 정책 source(ENV / DB row / config) — 본 helper 는 옵션으로 받은 값만 사용(정책 source 0).
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
