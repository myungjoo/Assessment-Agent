---
id: T-0481
title: UC-07 §8 NFR resumable upload Import 측 수신된 chunk 디스크립터로 업로드 진행 상태(진행률·상태 taxonomy·resume offset)를 순수 산술로 렌더하는 helper describeImportChunkUploadProgress
phase: P7
status: DONE
completedAt: 2026-06-17T18:27:14Z
prNumber: 392
mergeCommit: 7866890
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/import-chunk-upload-progress.ts
  - src/export/import-chunk-upload-progress.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — export-streaming(throughput/progress/resume/refetch·integrity) 포화·IMPORT pivot 지속. download 측 describeExportChunkStreamProgress(T-0470)의 대칭인 *업로드* 진행 view(진행률·status taxonomy·resumeOffset)는 44 helper(T-0437~T-0480) 중 0회 cover(git grep UploadProgress|resumeOffset|uploadStatus 0). T-0480 validate(go/no-go)와 직교(검증 vs 진행 렌더). ImportChunkDescriptor DRY-import. pr·게이트-free·dependsOn []."
---

# T-0481 — UC-07 §8 NFR resumable upload Import 측 chunk 업로드 진행 view 순수 helper describeImportChunkUploadProgress

## Why

UC-07 §8 NFR 은 대량 dump 의 전달을 "async job + status polling + chunked streaming + **resumable upload**" 로 설계한다(P5 별도 설계 — 본 task 는 순수 산술 helper 만). 지금까지의 chunked-streaming helper(T-0437~T-0480, 44개)는 **거의 전부 Export 측(다운로드)** 이며, 그중 `describeExportChunkStreamProgress`(T-0470)는 다운로드 *전송 진행 상태*(전달 chunk·전송 byte·진행률·현재 content-range)를 렌더한다. 직전 T-0480(`validateImportChunkReassemblyOrder`)이 IMPORT 측으로 pivot 해 수신 chunk 가 재조립 가능한 완전 시퀀스인지를 **검증(go/no-go)** 했다.

그러나 resumable upload 에는 검증과 별개로 **수신 진행 상태(upload progress) 렌더** 책임이 있다: importer 가 dump 를 여러 chunk 로 나눠 업로드받는 동안, WebUI/status-polling 은 "지금까지 몇 개 chunk·몇 byte 수신됐고·진행률 몇 %·현재 상태가 미시작/업로드중/지연-미완/완료 중 무엇이며·업로드를 재개한다면 어느 offset 부터인가" 를 표시해야 한다. 이 **업로드 진행 view** 는 다운로드 측 `describeExportChunkStreamProgress` 의 대칭 책임이지만 IMPORT 측에서는 44 helper 중 0 회 cover 된 gap 이다(`git grep -ic "UploadProgress|describeImportChunkUpload|ImportUploadProgress|resumeOffset|uploadStatus" src/` → 0 매칭 확인).

본 helper 는 T-0480 의 *검증* 과 직교한다: T-0480 은 시퀀스가 완전·연속·무중복·정렬인지를 boolean 으로 판정(transaction 시작 가능 여부)하고, 본 helper 는 수신된 chunk 들로부터 **사람-친화 진행 상태**(percentComplete·status taxonomy·resumeOffset)를 렌더한다(검증 vs 진행 표시). download 측 `describeExportChunkStreamProgress`(T-0470)와도 방향(보내는 측 전달 진행 vs 받는 측 수신 진행)·산정 입력(정적 ExportChunkPlan + deliveredChunks vs 동적으로 수신된 ImportChunkDescriptor[])·상태 모델(content-range 헤더 수치 vs resumable status + resumeOffset)이 직교한다.

실 업로드 수신·byte slice·HTTP Range/206·multipart/resumable upload 프로토콜·타이머·시계 read 0 — chunk 디스크립터(index·offset·size)는 caller 가 전달하고, 본 helper 는 산술 렌더만 한다. 도메인 타입 `ImportChunkDescriptor` 는 T-0480 의 `import-chunk-reassembly-order.ts` 에서 그대로 import 해 재사용한다(DRY — 재정의 금지).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming + resumable upload) + §5 step 13 부근(업로드/복원 진행 표시 흐름)
- `src/export/import-chunk-reassembly-order.ts` — `ImportChunkDescriptor`(index·offsetBytes·sizeBytes) 타입을 **import 해 재사용**(재정의 금지). 단 본 helper 는 *검증* 이 아니라 *진행 렌더* — `validateImportChunkReassemblyOrder` 재호출·완전성 판정 로직 재구현 금지(진행률·상태·resume offset 산정만).
- `src/export/export-chunk-stream-progress.ts` — download 측 진행 view 의 코드 골격 mirror 대상(percentComplete·complete·headline 산정 패턴 + `isPlainObject`/`describeNonObject`/`isValidNonNegativeInteger` 입력 방어 + non-mutating·결정성·한국어 message convention). 단 export download 진행과 직교 — 재호출 금지(본 helper 는 import 수신 진행 + resumable status taxonomy).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/import-chunk-upload-progress.ts` 신설. `ImportChunkDescriptor` 는 `./import-chunk-reassembly-order` 에서 import(재정의 금지). 신규 타입: 입력 `ImportChunkUploadProgressInput`(plain object: `receivedChunks: ImportChunkDescriptor[]`(지금까지 수신된 chunk 디스크립터 배열 — 비-음수 index·offset, 양의 size), `expectedTotalBytes: number`(완전 dump 의 총 byte — 비-음수 정수), `expectedChunkCount: number`(완전 dump 의 총 chunk 수 — 비-음수 정수)). 결과 `ImportChunkUploadProgress`(plain object: `receivedChunkCount: number`(= receivedChunks.length), `expectedChunkCount: number`(입력 echo), `remainingChunkCount: number`(= max(0, expectedChunkCount - receivedChunkCount)), `receivedBytes: number`(수신 chunk 의 sizeBytes 단순 합), `expectedTotalBytes: number`(입력 echo), `remainingBytes: number`(= max(0, expectedTotalBytes - receivedBytes)), `percentComplete: number`(0~100 정수 — expectedTotalBytes 0 이면 100, 아니면 Math.round((receivedBytes/expectedTotalBytes)\*100), 100 으로 clamp), `complete: boolean`(receivedChunkCount === expectedChunkCount && receivedBytes === expectedTotalBytes && expectedChunkCount > 0; expectedChunkCount 0 이면 complete=true), `status: ImportChunkUploadStatus`(아래 enum), `resumeOffset: number`(정렬된 수신 chunk 를 offset 0 부터 끊김 없이 따라갔을 때 첫 끊김/끝 offset — 업로드 재개 시 다음에 받아야 할 byte offset; 완전하면 expectedTotalBytes, 미시작이면 0), `headline: string`(한국어 한 줄 — 수신/기대 chunk·진행률·상태 요약)). `ImportChunkUploadStatus` 는 문자열 union 타입 `"not-started" | "uploading" | "stalled-incomplete" | "complete"` 로 정의(별도 enum 객체 신설 안 함). 옵션 타입 신설 안 함.
- [ ] `describeImportChunkUploadProgress(input)` 순수 함수: receivedChunks 를 (원본 비변형) index 기준 정렬한 복사본으로 위 필드를 단일 패스로 derive. status taxonomy 분기: receivedChunkCount === 0 → `"not-started"`; complete(전 chunk·전 byte 수신) → `"complete"`; 0 < receivedChunkCount < expectedChunkCount 이거나 receivedBytes < expectedTotalBytes 인데 정렬 후 첫 chunk offset 이 resumeOffset 과 일치하며 끊김 없이 일부만 수신 → `"uploading"`; 수신은 있으나 정렬 시퀀스에 gap 이 있어 resumeOffset 이 receivedBytes 진행보다 앞서 멈춤(끊김 발생 — 연속 수신이 끊긴 미완 상태) → `"stalled-incomplete"`. 불변(invariant): `receivedBytes + remainingBytes === expectedTotalBytes` (단 receivedBytes > expectedTotalBytes 인 초과 수신 시 remainingBytes=0 이며 이때 불변은 max-clamp 형 `receivedBytes >= expectedTotalBytes ⟹ remainingBytes === 0` 로 명세), `0 <= percentComplete <= 100`, `complete ⟺ status === "complete"`, `receivedChunkCount === 0 ⟺ status === "not-started"`, `0 <= resumeOffset <= expectedTotalBytes`, `complete ⟹ (resumeOffset === expectedTotalBytes && percentComplete === 100)`. non-mutating(입력 객체·receivedChunks 배열 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `receivedChunks` 빈 배열(status="not-started"·receivedChunkCount=0·receivedBytes=0·percentComplete=0·resumeOffset=0·complete=false; 단 expectedChunkCount=0 이면 complete=true·status="complete"·percentComplete=100). 단일 chunk 완전 수신(index=0·offset=0·size=expectedTotalBytes·expectedChunkCount=1 → complete=true·status="complete"·resumeOffset=expectedTotalBytes·percentComplete=100). 부분 연속 수신(chunk0 만 수신, expectedChunkCount=2 → status="uploading"·resumeOffset=chunk0.size·percentComplete<100). gap 으로 인한 stalled(chunk0 offset0 size10 + chunk2 offset30 size10 수신, chunk1 누락 → 연속 구간이 offset10 에서 끊김 → resumeOffset=10·status="stalled-incomplete"·complete=false). 입력이 뒤섞였으나 정렬 후 완전(receivedChunks index [1,0] 완전 → status="complete"). 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `input` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "input"·받은 값 박제). `input.receivedChunks` 가 배열 아님 → `TypeError`(label "receivedChunks"). `input.receivedChunks[i]` 가 plain object 아님 → `TypeError`(label·index 박제). `receivedChunks[i].index` / `offsetBytes` 가 비-음수 유한 정수 아님, `receivedChunks[i].sizeBytes` 가 양의 유한 정수(≥1) 아님(음수·0·NaN·Infinity·소수·비-number 각각), `input.expectedTotalBytes` / `input.expectedChunkCount` 가 비-음수 유한 정수 아님 → 각각 `TypeError`(label·받은 값 박제). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 완전 수신(전 chunk·전 byte → complete=true·status="complete"·resumeOffset=expectedTotalBytes·percentComplete=100), 단일 chunk 완전, 부분 연속 수신(status="uploading"·percentComplete<100·resumeOffset=수신끝), 입력이 뒤섞였으나 정렬 후 완전(status="complete"), headline 한국어 내용 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: input 비-object / receivedChunks 비-배열 / receivedChunks[i] 비-object / index·offsetBytes 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / sizeBytes 비-양의정수 아님(0·음수·NaN·Infinity·소수 각각) / expectedTotalBytes·expectedChunkCount 비-음수정수 아님 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·index 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: status 4값(not-started / uploading / stalled-incomplete / complete) 각 1+ test, 빈 receivedChunks 분기 vs 비-빈 분기, complete=true vs false 분기, percentComplete 0(미시작) vs 중간(부분) vs 100(완전) 분기, resumeOffset 이 0(미시작) vs 첫 gap 에서 멈춤(stalled) vs expectedTotalBytes(완전) 분기, expectedChunkCount 0 분기 vs >0 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `receivedBytes >= expectedTotalBytes ⟹ remainingBytes === 0`, `0 <= percentComplete <= 100`, `complete ⟺ status === "complete"`, `receivedChunkCount === 0 ⟺ status === "not-started"`, `0 <= resumeOffset <= expectedTotalBytes`, `complete ⟹ (resumeOffset === expectedTotalBytes && percentComplete === 100)` 를 not-started·uploading·stalled·complete·초과수신 케이스 전수로 검증하는 test 1+, non-mutating(입력 객체·receivedChunks 배열 deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/import-chunk-upload-progress.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 수신 chunk 시퀀스의 완전·연속·무중복·정렬 *검증(go/no-go)* — `validateImportChunkReassemblyOrder`(T-0480)의 책임. 본 helper 는 *진행 상태 렌더* 만(검증 로직 재구현·재호출 금지 — resumeOffset 산정에 필요한 연속 구간 추적은 자체 단일 패스로, 완전성 boolean 판정·missingIndexes/duplicateIndexes 도출은 하지 않음).
- download(Export) 측 전송 진행·content-range 수치 — `describeExportChunkStreamProgress`(T-0470)의 책임. 본 helper 는 *업로드 수신* 진행 + resumable status + resumeOffset(다운로드 진행 도메인 재호출·재구현 금지).
- 실 업로드 수신 / byte slice·재조립(실 bytes 결합) / HTTP Range·206 Partial Content·multipart upload / resumable upload 프로토콜(tus 등) / SSE·long-poll 배선 — P5 service/controller layer(repository 게이트). 본 helper 는 chunk 디스크립터(index·offset·size) 수치만으로 진행 렌더.
- digest / checksum / 무결성 검증 — `computeDumpChecksum`/`verifyDumpChecksum`(T-0446)/`reconcileExportChunkIntegrity`(T-0472)의 책임. 본 helper 는 byte 진행 수치만(내용 무결성 0).
- dump 구조·schema 버전·크기·record merge 충돌·preflight go/no-go — `validateImportDumpStructure`(T-0440)/`checkSchemaVersionCompat`(T-0439)/`validateImportDumpSize`(T-0450)/`detectImportMergeConflicts`(T-0451)/`buildImportPreflightSummary`(T-0452)의 책임.
- 타이머·`Date.now()`·`setTimeout` 등 실 시계·스케줄 read(시계 read 0 — 모든 수치는 caller 전달; "stalled" 는 시간 경과가 아니라 시퀀스 gap 기반 판정).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 업로드 진행 바·오류 안내 컴포넌트 렌더 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
