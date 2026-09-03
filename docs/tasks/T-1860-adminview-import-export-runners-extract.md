---
id: T-1860
title: AdminView 의 import/export 러너 군을 별도 모듈로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminImportExportRunners.ts
  - web/src/views/adminImportExportRunners.test.ts
estimatedDiff: 1000
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + 최상단 type/값 import 몇 줄 + 선언 앞 export 키워드만) · (b) 신규 로직 0 LOC (deps 타입 4 · 순수 helper 3 · 상수 5 · async 러너 4 의 본문 무변경) · (c) 기존 spec 은 AdminView 재수출 덕에 import 경로까지 무수정 통과. 삭제 약 350 + 추가 약 380 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 일곱째 실분할 — head cb4aff3f 의 import/export 축 12 심볼 연속 1 블록 251 줄 + 직접 참조 상수·helper"
created: 2026-09-03
completedAt: 2026-09-03T05:07:45Z
prNumber: 1460
mergeCommit: 20ff3d7f
---

# T-1860 — AdminView 의 import/export 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **일곱째 실분할** 이다. 그 bullet 이 [T-1859](T-1859-req080-global-style-rejudge-plan-debt-remeasure.md) 에서 다음 대상을 **import/export 러너 군 12 심볼 (`1117~1361 행`, 선행 주석 포함 `1111~1361 행`, 연속 1 블록 245~251 줄)** 로 명시적으로 지목했고, 본 slice 가 그 지목을 그대로 집행한다. 직전 6 슬라이스 (`adminServiceIdentityRowActions` · T-1830 · T-1852 · T-1854 · T-1856 · T-1857) 와 동일한 순수 추출 패턴이며, 누적 `-1,043 줄` 페이스를 잇는다 (목표선 ≤ 2,000 줄 까지 잔여 `-3,044 줄`).

**planner issue-still-relevant pre-check (origin/main `cb4aff3f` 실측)** — 부채도 대상 블록도 그대로 남아 있어 신규 생성이 맞다:

- `git ls-tree origin/main web/src/views/` 에 `adminImportExportRunners.ts` **없음** (기존 추출본 5 개는 collection-target · serviceIdentity · groupPart · person · llmProvider 축뿐).
- `wc -l` = **5,044 줄** 로 PLAN `183 행` 표기와 일치 (T-1859 가 방금 동기화한 값).
- 대상 블록 경계 실재 확인 — `1111 행` 선행 주석 → `1117 행` `interface DownloadDeps` 시작, `1356~1361 행` `clearImportConfirm` 끝. 바로 위 `runAssign` (`1077 행`, 난이도 매핑 축) · 바로 아래 `ScheduleMutationDeps` (`1367 행`, 스케줄 축) 는 경계 밖 그대로.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 블록 `1111~1361 행`, 동반 이동 대상 `415~516 행` (import path 상수 3 + 문구 상수 2 + 순수 helper 2), 파일 끝 `export {` (`4929~4939 행` 부근) · `export type {` (`5004~5008 행` 부근) 표면, 상단 import 블록 `20~35 행`, 소비처 `3088~3210 행` (`handleExport` · `handleImport` · preview · confirm · cancel call site).
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — 직전 슬라이스의 모듈 헤더 주석 규약 (단방향 import · 재수출 · 동반 이동 상수 근거) 정본. 본 slice 는 같은 형식을 따른다.
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) — 신설 **경계 spec** 의 범위 규약 (기존 계약 spec 복제 금지 · 재수출 identity `toBe` 고정) 선례.
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet · 대상 12 심볼 열거 · 경계 밖 명시 (`runAssign` · `ScheduleMutationDeps` 이후).
- [.claude/agents/planner.md](../../.claude/agents/planner.md) `§ Estimate model` 의 "순수 추출 리팩터" 카테고리 — (a)(b)(c) 조건과 `sizeExempt` 직행 규칙.

## Acceptance Criteria

- [ ] `web/src/views/adminImportExportRunners.ts` 신설 — `1111~1361 행` 의 **12 심볼** (deps 타입 4 `DownloadDeps` · `RunAdminExportJobDeps` · `ImportDeps` · `ImportPreviewDeps` · `ConfirmImportDeps` — `ConfirmImportDeps` 는 `ImportDeps` 를 `extends` 하므로 함께 옮긴다, 런타임 값 상수 1 `browserDownloadDeps`, 순수 helper 1 `buildExportInput`, async 러너 3 `runAdminExportJob` · `runImport` · `runImportPreview` · `runConfirmedImport`, 동기 helper 1 `clearImportConfirm`) 을 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`.
- [ ] **동반 이동 (역방향 import 차단 목적)** — 옮긴 러너가 직접 참조하는 모듈 상수·helper 도 본문 무변경으로 함께 옮긴다: `ADMIN_IMPORT_PATH` (`419 행`) · `ADMIN_IMPORT_PREVIEW_PATH` (`425 행`) · `IMPORT_FILE_FIELD` (`436 행`) · `IMPORT_DONE_TEXT` (`441 행`) · `IMPORT_RESULT_SUMMARY_PREFIX` (`446 행`) · `formatRestoreTotalsPhrase` (`453 행`) · `formatImportJobDetail` (`486 행`). 근거는 T-1854 `GROUPS_PATH` · T-1856 `PERSONS_PATH` · T-1857 `LLM_PROVIDERS_PATH` 선례와 동형 — AdminView 에 남기면 새 모듈 → AdminView 역방향 import 가 생긴다. AdminView 에 남는 `formatRestorePlanConfirmText` (`521 행`) 는 `formatRestoreTotalsPhrase` 를 새 모듈에서 **import 해서** 쓴다 (정본 1 개 유지 · 재선언 0 · 단방향 유지).
- [ ] **이동 범위가 위 목록을 넘지 않는다** — 옮기다 보니 또 다른 AdminView 심볼이 필요해지면 범위를 넓히지 말고 그 자리에서 멈춰 `Follow-ups` 에 적는다 (범위 확대는 이동 경계를 잘못 잡았다는 신호).
- [ ] 허용 변경은 (i) 선언 앞 `export` 키워드 추가, (ii) 새 모듈 최상단의 import 몇 줄 (`runExportJobDownload` · `RunExportJobDownloadDeps` from `../api/exportJobDownload`, `runExportJob` · `RunExportJobOptions` from `../api/exportJobFlow`, `CreateExportInput` 등 export client 타입, `RequestOptions` from `../api/apiClient` — 실제 필요한 것만) 뿐이다. 그 외 본문 편집 0.
- [ ] 모듈 최상단 헤더 주석 — 이동 근거 (PLAN `183 행` 부채 · 일곱째 실분할) · **AdminView → 본 모듈 단방향 import** 규약 (본 모듈은 AdminView 를 import 하지 않는다) · 재수출로 기존 spec 을 보존한다는 사실 · 동반 이동 7 심볼의 역방향 차단 근거 · `.ts` 확장자 판단을 명시.
- [ ] `AdminView.tsx` 는 옮긴 심볼을 새 모듈에서 import 하고 **재선언하지 않는다**. 소비처 4 곳 (`handleExport` 의 `runAdminExportJob` + `browserDownloadDeps` 스프레드, `handleImport` 의 `runImportPreview`, 확인 실행의 `runConfirmedImport`, 취소의 `clearImportConfirm`) 이 import 한 심볼을 그대로 호출한다 — 소비처 배선을 같은 PR 에 포함한다 ([CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무).
- [ ] `AdminView.tsx` 파일 끝 `export {` / `export type {` 목록의 **공개 표면이 이동 전과 정확히 같다** — 이동 전 이미 export 표면이던 심볼 (`buildExportInput` · `runAdminExportJob` · `runImport` · `runImportPreview` · `runConfirmedImport` · `clearImportConfirm` · `formatImportJobDetail` · `formatRestoreTotalsPhrase` 와 타입 `DownloadDeps` · `RunAdminExportJobDeps` · `ImportDeps` · `ImportPreviewDeps` · `ConfirmImportDeps`) 를 그대로 re-export 하고, 이동 전 export 가 아니던 심볼 (`browserDownloadDeps` · path/문구 상수 5) 은 AdminView 에서 새로 export 하지 않는다.
- [ ] 기존 spec 이 `from './AdminView'` 를 **한 줄도 수정하지 않고** 통과한다 (`AdminView.test.tsx` 및 import/export 를 참조하는 계약 spec 전부). 이것이 순수 추출 조건 (c) 의 기계적 증거다.
- [ ] **happy-path unit test** — 신설 경계 spec `web/src/views/adminImportExportRunners.test.ts` 에서 러너 4 개가 **직접 import 경로** 로도 정상 동작함을 검증 (러너당 1+): `runAdminExportJob` 이 주입 primitive 로 job-flow 를 1 회 발사하고 다운로드까지 잇는다 · `runImport` 가 `POST /api/admin/import` 를 multipart 로 1 회 발사하고 완료 문구를 `setImportMessage` 로 표면화한다 · `runImportPreview` 가 `POST /api/admin/import/preview` 를 1 회 발사하고 확인 문구·보관 파일을 채운다 · `runConfirmedImport` 가 확인 상태를 비운 뒤 `runImport` 경로로 실행한다 · `clearImportConfirm` 이 setter 2 개만 비운다.
- [ ] **error path unit test** — 러너 4 개 각각의 주입 primitive 가 reject 할 때 **throw 없이** error 문구를 error state 로 표면화하고 진행 플래그 (`setExporting` / `setImporting`) 를 `finally` 로 되돌림을 검증 (러너당 1+).
- [ ] **분기 cover** — 각 러너의 가드·fallback 분기를 분리해 test: `runImport` 의 빈 file 가드 · in-flight (`importing`) 가드, `runImportPreview` 의 동일 2 가드, `runConfirmedImport` 의 위임 전 정리 분기, `formatImportJobDetail` 의 4 갈래 (비객체 → `IMPORT_DONE_TEXT` · `id` 부재 → `IMPORT_DONE_TEXT` · `status`/`mode` 유무에 따른 부분 합성 · `restoreSummary` 유무에 따른 접미 유무), `formatRestoreTotalsPhrase` 의 규약 (a)~(e) 갈래.
- [ ] **negative cases 충분 cover** — 최소 6 종 이상: ① 빈 file 로 import/preview POST 0 회 ② in-flight 중 재호출 시 이중 발사 0 ③ 실패 경로에서 완료 문구·확인 문구 미설정 ④ `formatImportJobDetail` 에 `null` · 배열 · `id` 빈 문자열을 넣어도 throw 0 이고 `'[object Object]'` 가 노출되지 않음 ⑤ `formatRestoreTotalsPhrase` 가 비객체·배열·수치 부재에서 `undefined` 반환 (throw 0) ⑥ export 다운로드 중 `clickAnchor` 가 throw 해도 object URL 회수가 이뤄지고 error 문구로 흡수 ⑦ **재수출 identity 보존** — `AdminView` 에서 import 한 심볼과 새 모듈에서 import 한 심볼이 **동일 함수 참조** (`toBe`) 임을 값 심볼 전부에 대해 검증.
- [ ] 경계 spec 은 기존 계약 spec 의 상세 행동 검증을 **복제하지 않는다** — 검증 범위를 "새 모듈 자신의 공개 표면" 으로 한정하고 그 규약을 spec 최상단 주석에 명시 (T-1830 · T-1857 선례).
- [ ] `cd web && pnpm test` (vitest) 전량 green + `cd web && pnpm build` 성공 (import 경로 변경 반영).
- [ ] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [ ] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `5044` 보다 **300 줄 이상 작아진다** (이동 약 350 줄 - 새 import 블록 약 25 줄).

## Out of Scope

- 난이도 매핑 축 (`AssignDeps` `1059 행` · `runAssign` `1077 행`) 이동 — PLAN `183 행` 이 명시적으로 "함께 옮기지 않는다" 고 경계를 그은 대상.
- 스케줄 · 재평가 축 (`ScheduleMutationDeps` `1367 행` 이후) 이동 — 다음 슬라이스 후보이며 본 slice 범위 밖.
- AdminView 에 남는 `formatRestorePlanConfirmText` (`521 행`) · `IMPORT_PREVIEW_UNKNOWN_TEXT` 등 preview 확인 **문구 합성 축** 이동 — 소비처가 컨테이너 렌더 경로라 러너 축과 절단면이 다르다.
- 구 GET 모델 `runExport` (dead-but-exported, 제거는 T-1247 소관) 의 제거·정리.
- 러너 본문 로직 개선 (가드 추가 · 에러 문구 변경 · 중복 제거 · 타입 정리) — **순수 추출** 이므로 본문 한 줄도 바꾸지 않는다. 개선 여지가 보이면 Follow-ups 에 적는다.
- `docs/PLAN.md` `183 행` 실측 LOC 갱신 — `direct` 문서 갱신이라 본 `pr` task 와 섞지 않는다 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 3). 머지 후 별도 slice.
- web `coverageThreshold` 도입 — 새 devDependency (`@vitest/coverage-v8`) 가 필요해 `§5` 새-dep 게이트 대상 (PLAN 게이트된 backlog).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **이동 경계 보정 (본 slice 에서 실제로 발생한 범위 조정 — 다음 슬라이스 경계 산정 시 재발 주의)** — task 정의서 `Out of Scope` 는 `formatRestorePlanConfirmText` (`521 행`) 와 `IMPORT_PREVIEW_UNKNOWN_TEXT` 를 AdminView 잔류 대상으로 적었으나, 실측상 `formatRestorePlanConfirmText` 의 **유일한 호출자가 함께 이동하는 `runImportPreview` 한 곳뿐**이라 잔류시키면 새 모듈 → AdminView 역방향 import 가 생긴다. 단방향 규약을 지키려 두 심볼을 함께 옮겼고, 그 근거는 `web/src/views/adminImportExportRunners.ts` 헤더 주석과 [PR #1460](https://github.com/myungjoo/Assessment-Agent/pull/1460) 본문에 박제했다. reviewer 는 이 판단을 타당하다고 보고 MINOR 1 건으로만 남겼다 (BLOCKER 0). **다음 슬라이스 (스케줄 · 재평가 축, `ScheduleMutationDeps` 이후) 경계 산정 시에는 후보 심볼의 호출자 집합을 먼저 확인해 같은 오판을 반복하지 않는다.**
- **`docs/PLAN.md` `183 행` 실측 LOC 4 차 갱신** — 본 slice 로 AdminView 가 `5,044 줄` → `4,688 줄` (`-356`) 로 줄었고 최초 대비 누적 `-1,399 줄` 이다. `direct` 문서 갱신이라 본 `pr` task 와 섞지 않았으므로 후속 slice 에서 처리한다 (다음 대상 지목도 스케줄 · 재평가 축으로 함께 교체).
