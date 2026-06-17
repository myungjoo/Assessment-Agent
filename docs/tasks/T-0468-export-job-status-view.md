---
id: T-0468
title: UC-07 §8 NFR async Export job 현재 polling 상태를 사람-친화 진행 view 로 렌더하는 순수 helper describeExportJobStatus
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
  - src/export/export-job-status-view.ts
  - src/export/export-job-status-view.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — buildExportJobPlan(T-0467)은 statusFlow·pollingRequired 만 산출, polling 중 현재 status 를 진행 view(단계·다음·종단·다운로드 가능)로 렌더하는 helper 는 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0468 — UC-07 §8 NFR async Export job 현재 polling 상태를 사람-친화 진행 view 로 렌더하는 순수 helper describeExportJobStatus

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + **status polling** + chunked streaming" 으로 처리하라 명시한다. 직전 `buildExportJobPlan`(T-0467)은 async 경로의 `statusFlow: ["queued","running","ready"]` + `pollingRequired: true` 까지만 산출할 뿐, **polling 도중 받은 현재 `ExportJobStatus`(queued/running/ready/failed) 를 사람-친화 진행 view(현재 단계 label·전체 단계 중 몇 번째·다음 단계·종단 여부·다운로드 가능 여부·한국어 안내 한 줄)로 렌더하는 helper 는 31 helper 중 0 회 cover 된 gap** 이다(`git grep describeExportJobStatus|ExportJobStatusView|ExportJobProgress src/` → 0 매칭). T-0467 의 plan 이 "어떤 경로로 다운로드할지" 를 정한다면, 본 helper 는 그 async 경로에서 매 poll 응답마다 "지금 어디까지 왔는지" 를 사용자에게 보여줄 view descriptor 를 순수 합성으로 박제한다. UC-07 §5 step 13(Export 다운로드 완료) 직전의 진행 안내가 필요로 하는 모델을 채운다. 실 polling endpoint / status store / job lifecycle 0 — 입력으로 받은 status enum 하나만으로 view 를 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-job-plan.ts` — `ExportJobStatus = "queued" | "running" | "ready" | "failed"` 타입(본 helper 가 import 재사용 — 신규 정의 금지) + `statusFlow` 정상 흐름(queued→running→ready) + `isPlainObject` / `describeNonObject` / 한국어 message convention mirror 대상. **본 helper 는 status enum 을 입력으로만 받고 buildExportJobPlan 을 재호출하지 않는다(DRY).**
- `src/export/import-mode-description.ts` — 구조화 입력 → 사람-친화 plain 모델 조립 helper 의 shape 패턴 참조(headline / line 류)
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-job-status-view.ts` 신설. `ExportJobStatus` 는 `./export-job-plan` 에서 **import 재사용**(신규 정의 절대 금지 — 중복 타입 박제 회피). 신규 도메인 타입만 신설: `ExportJobStatusView`(plain object: `status: ExportJobStatus`(입력 그대로), `phaseLabel: string`(현재 상태의 한국어 단계명 — 예 queued="대기 중", running="처리 중", ready="다운로드 가능", failed="실패"), `stepIndex: number`(정상 흐름 queued→running→ready 에서의 0-base 위치 — failed 는 -1), `totalSteps: number`(정상 흐름 단계 수 = 3), `nextStatus: ExportJobStatus | null`(다음 정상 단계 — ready/failed 는 null), `terminal: boolean`(ready 또는 failed 면 true), `downloadable: boolean`(ready 면 true, 그 외 false), `message: string`(현재 진행을 담은 한국어 한 줄)).
- [ ] `describeExportJobStatus(status)` 순수 함수: 입력 `ExportJobStatus` 하나를 받아 위 `ExportJobStatusView` 를 derive. 상태별 매핑 — queued → stepIndex=0·nextStatus="running"·terminal=false·downloadable=false, running → stepIndex=1·nextStatus="ready"·terminal=false·downloadable=false, ready → stepIndex=2·nextStatus=null·terminal=true·downloadable=true, failed → stepIndex=-1·nextStatus=null·terminal=true·downloadable=false. `totalSteps=3` 고정. non-mutating(반환 객체는 항상 새 것, 모듈 공유 상수가 있으면 복제). 동일 입력 2회 호출은 동등 결과(순수·결정성). 불변: `downloadable === true ⟹ status === "ready"`, `terminal === (status === "ready" || status === "failed")`, `nextStatus === null ⟺ terminal === true`.
- [ ] 입력 방어: `status` 가 `"queued"`/`"running"`/`"ready"`/`"failed"` 외 값(string 이지만 미정의 / 비-string / null / undefined / 객체 / 숫자) → 한국어 `RangeError` 또는 `TypeError`(어느 쪽인지 spec 의 describe 문자열로 박제하고 일관 적용 — 받은 값을 메시지에 박제). null/undefined 와 비-string 은 동일 reject 경로로 충분.
- [ ] **Happy-path unit test**: `describeExportJobStatus` 에 4 상태(queued/running/ready/failed) 각각 입력 → 위 매핑 표의 모든 필드(phaseLabel·stepIndex·totalSteps·nextStatus·terminal·downloadable·message) 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: 미정의 status 문자열(예 "cancelled"), null, undefined, 숫자, 객체, 빈 문자열 각각에 대해 throw 검증 test 1+ (메시지에 받은 값 포함 확인). 단일 negative 만 작성 금지 — 위 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: 4 상태 분기 각각(위 happy 로 cover), terminal/non-terminal 분기, downloadable/non-downloadable 분기, nextStatus 가 null/non-null 인 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `downloadable === true ⟹ status === "ready"`, `terminal === (status === "ready" || status === "failed")`, `nextStatus === null ⟺ terminal === true` 3 불변을 4 상태 전수로 검증하는 test 1+, non-mutating(반환 객체가 호출마다 새 인스턴스 — 두 호출 결과가 `!==` 이면서 deep-equal) 검증 1+, failed 상태가 stepIndex=-1 로 정상 흐름 밖임을 명시 검증 1+ test.
- [ ] `src/export/export-job-status-view.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 polling endpoint / status store / job lifecycle / job id 조회 / SSE·long-poll 응답 — 본 helper 는 단일 status enum → view descriptor 변환만. 실 lifecycle 은 P5 service layer(repository / scheduler 게이트).
- REST controller / endpoint / HTTP status mapping — repository 게이트 후속.
- `buildExportJobPlan`(T-0467) / `estimateExportDumpSize`(T-0466) 재호출·재구현 — 본 helper 는 `ExportJobStatus` 만 입력으로 받는다(DRY).
- `ExportJobStatus` 타입 신규 정의 — 반드시 `./export-job-plan` 에서 import 재사용(중복 정의 금지).
- 진행률 percentage·ETA·경과 시간 계산 — 본 helper 는 status enum 의 정성 view 만. 정량 진행률은 실 job store 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
