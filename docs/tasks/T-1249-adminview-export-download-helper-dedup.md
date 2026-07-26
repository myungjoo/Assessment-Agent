---
id: T-1249
title: AdminView 죽은 parseFilename/triggerDownload 제거(exportJobDownload dedup)
phase: P6
status: DONE
commitMode: pr
prNumber: 1141
mergedAs: 9b0b3545
reviewRounds: 1
completedAt: 2026-07-26T11:15:38Z
coversReq: [REQ-057]
estimatedDiff: -170
estimatedFiles: 2
created: 2026-07-26
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
dependsOn: []
independentStream: p6-export-contract-fix
plannerNote: "P6 export-contract-fix stream 종결 slice — T-1247 note 의 dedup 후속: AdminView 죽은 parseFilename/triggerDownload 물리 삭제(exportJobDownload.ts 활성본이 대체), 삭제-only"
---

# T-1249 — AdminView 죽은 parseFilename/triggerDownload 제거(exportJobDownload dedup)

## Why

T-1246 이 AdminView 의 export 배선을 job-flow(`runAdminExportJob` → `runExportJobDownload`)로 교체하고 T-1247 이 구 GET 모델 죽은코드(`runExport`/`ExportDeps`/`buildExportPath`)를 청소했다. 그때 T-1247 은 `parseFilename`/`triggerDownload`/`DownloadDeps`/`browserDownloadDeps` 는 "유지(dedup 은 후속 slice)"로 남겼다. 지금 확인 결과 **`parseFilename`(정의 line 247)·`triggerDownload`(정의 line 860)는 AdminView 내부에서 더는 호출되지 않는 죽은코드**다 — 다운로드시 파일명 파싱·blob 저장 부수효과는 이제 `web/src/api/exportJobDownload.ts` 의 동명 활성본(line 18 `parseFilename`, line 59 `triggerDownload`, `runExportJobDownload` 가 소비)이 담당한다. AdminView 의 두 함수는 오직 test 를 위해 export 만 되어 있는 중복 잔재다. 이 죽은코드를 물리 제거하면 P6 export-contract-fix stream(T-1242~T-1248 배선·청소·coverage) 의 마지막 dedup 정리가 끝난다. (REQ-057 import/export/restore.)

**보존 대상 주의**: `DownloadDeps` 타입과 `browserDownloadDeps` 값은 **삭제하지 않는다** — `browserDownloadDeps`(line 877, `DownloadDeps` 타입)는 여전히 `handleExport`(line 3467 `...browserDownloadDeps`)에서 활성 사용 중이다. 이 slice 는 오직 `parseFilename`·`triggerDownload` 두 함수만 제거한다.

## Required Reading

- `web/src/views/AdminView.tsx` — 삭제 대상: `parseFilename`(정의 line 242~ 주석 포함, 함수 line 247~), `triggerDownload`(정의 line 844~ 주석 포함, 함수 line 860~873), value export list 의 `parseFilename`/`triggerDownload`(line 4784~4785). **보존**: `DownloadDeps`(interface line 847~)·`browserDownloadDeps`(line 877)·`RunAdminExportJobDeps`·`runAdminExportJob`·`buildExportInput`.
- `web/src/views/AdminView.test.tsx` — 삭제 대상: `parseFilename` describe 블록(line 2797~2835)·`triggerDownload` describe 블록(line 2837~2899), 그리고 import 목록의 `parseFilename`(line 81)·`triggerDownload`(line 82). **보존**: `DownloadDeps` import(line 125 — 다른 describe 에서 여전히 쓰이면 유지, 미사용이 되면 함께 정리).
- `web/src/api/exportJobDownload.ts` (line 15~70) — AdminView 에서 제거되는 두 함수의 활성 대체본이 여기 있음을 확인(제거가 기능 손실이 아님을 근거).

## Acceptance Criteria

프로덕션 로직 **변경 없이 죽은코드만 제거**한다(순수 삭제 slice — 신규 public symbol 0 이라 R-112 새 test 추가 불요; 회귀 방지는 아래 build/test green 으로 검증). src 정의·export 와 test describe 를 **atomic 하게 함께 삭제**해 orphan import/export 미발생을 보장한다.

- [ ] `web/src/views/AdminView.tsx` 에서 `parseFilename` 함수 정의(+선행 주석)와 value export list 항목을 삭제한다.
- [ ] `web/src/views/AdminView.tsx` 에서 `triggerDownload` 함수 정의(+선행 주석)와 value export list 항목을 삭제한다.
- [ ] `DownloadDeps` 타입·`browserDownloadDeps` 값·`runAdminExportJob`·`buildExportInput`·`RunAdminExportJobDeps` 는 **그대로 보존**(line 3467 `...browserDownloadDeps` 활성 사용 유지). `grep -n "browserDownloadDeps" web/src/views/AdminView.tsx` 로 3467 사용처가 남아 있음을 확인.
- [ ] `web/src/views/AdminView.test.tsx` 에서 `parseFilename` describe 블록과 `triggerDownload` describe 블록, 그리고 그 두 심볼의 import 를 삭제한다.
- [ ] 삭제 후 `web/src/views/AdminView.tsx` 에 `parseFilename`/`triggerDownload` 문자열이 **잔존하지 않음**을 확인(`grep -c "parseFilename\|triggerDownload" web/src/views/AdminView.tsx` == 0). AdminView.test.tsx 도 동일하게 두 심볼 잔존 0.
- [ ] `pnpm --dir web build`(tsc + vite) green — TS6133(unused import) 0, orphan reference 0.
- [ ] `pnpm --dir web test`(vitest) 전체 green — 삭제된 두 describe 외 web 전체 무회귀(특히 `runAdminExportJob`/`buildExportInput`/기존 export job-flow describe 는 그대로 pass).

## Out of Scope

- `DownloadDeps`/`browserDownloadDeps`/`runAdminExportJob`/`buildExportInput` 등 **활성 export 심볼 제거**(이 slice 는 죽은 두 함수만).
- `web/src/api/exportJobDownload.ts` 의 `parseFilename`/`triggerDownload` 활성본 수정(로직 변경 금지 — 삭제 대상 아님).
- T-1247 잔여 NIT(AdminView convention-reference 주석 ~233/508/894/1132/2200 현행화, `requestRawMock` dead-weight mock 정리) — 별도 slice.
- web `coverageThreshold`(`@vitest/coverage-v8`) 도입 — 새-dep 게이트(PLAN.md P6 backlog, 사용자 승인 필요).
- AdminView 외 다른 view/컴포넌트 접촉(file-disjoint 유지 — concurrent driver 안전).

## Suggested Sub-agents

`implementer → tester` (삭제-only slice — implementer 가 src+test 를 atomic 삭제, tester 가 build/test green + 잔존 0 grep 검증).

## Follow-ups

(작성 시 비어 있음)
