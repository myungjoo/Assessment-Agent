---
id: T-1304
title: api.md UC-07 표에 shipped 조회·download endpoint 4 행 신설 (import 조회 3 종 + export download)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1303]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "doc-only enumerated-section x1.6 x inline-amend 0.4 = 약 60 LOC / 1 파일. T-1301/T-1303 이월 Follow-up — shipped endpoint 4 개의 api.md 정본 부재 해소"
---

# T-1304 — api.md UC-07 표에 shipped 조회·download endpoint 4 행 신설

## Why

[api.md](../architecture/api.md) 의 UC-07 그룹 (123~128 행) 은 mutation 계열 5 행 (`POST /api/admin/export` · `/import` · `/import/preview` · `/backup` · `/restore`) 만 담고 있는데, main 에는 그보다 많은 route 가 이미 shipped 돼 있다. 특히 **조회·다운로드 계열은 정본에 한 행도 없다** — `GET /api/admin/import/running` · `/modes` · `/:id` ([import.controller.ts](../../src/import/import.controller.ts) 339/356/371 행) 와 `GET /api/admin/export/:id/download` ([export.controller.ts](../../src/export/export.controller.ts) 381 행) 는 production 에서 응답하는데 api 정본은 그 존재를 모른다. 즉 "무엇이 존재하는가" 자체가 drift 다 (T-1301/T-1303 은 응답 shape drift 를 닫았고, 본 task 는 endpoint 존재 drift 를 닫는다).

본 follow-up 은 [T-1301](T-1301-import-preview-doc-sync.md) → [T-1303](T-1303-import-preview-mode-echo-doc-sync.md) 로 두 번 이월된 항목이다. 코드 0 LOC · 기존 doc 1 파일의 표 행 추가만이라 §3.1 상 `direct` 이고 R-110/R-112 는 면제되며, 대신 controller ↔ 문서 문자 대조를 Acceptance Criteria 로 강제한다. export 측 잔여 route 5 개 (`running` · `describe-scope` · `preview-selection` · `:id/status-view` · `:id`) 는 서술 부피가 본 4 행과 맞먹어 **별도 slice** 로 남긴다 (Follow-ups).

**estimate 근거** — 표 행 4 개 신설 ~40 LOC + traceability 행 amend ~5 LOC + 그룹 헤더/인접 문장 정합 ~15 LOC → base ~95, doc-only enumerated-section × 1.6 × inline-amend 0.4 = × 0.64 → **~60 LOC / 1 파일** (cap 안, `sizeExempt` 불요).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) 123~128 행 — UC-07 그룹 표. 표 형식은 **5 열** (`| METHOD | route | UC | 설명 | 권한 |`). 126 행 (preview row) 이 서술 밀도·표기 관례 (근거 task/PR 표기, 실패 status 나열) 의 **본보기**. 신설 4 행을 이 그룹 안에 넣는다. **125~126 행 기존 서술은 0 수정**.
- [docs/architecture/api.md](../architecture/api.md) 178 행 — UC-07 traceability 행. `POST` 5 개가 나열돼 있고 cell 성격은 "step 1 (Admin → export 또는 import)".
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 333~377 행 — `@Get("running")` / `@Get("modes")` / `@Get(":id")` 세 handler 와 그 주석. 반환 타입 (`ImportJob[]` · `ImportModeDescription[]` · `ImportJob`) · 빈 배열 정책 · 404 변환 (P2025 → `NotFoundException`) · `:id` 보다 literal segment 를 먼저 선언한 path matching 순서 근거를 **여기서 그대로 인용**한다. **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 339~414 행 — `@Get(":id/download")` handler 와 주석. `findJob(id)` 404 · `materializeFullExportDownload(scope)` · `StreamableFile` 반환 · `Content-Type`/`Content-Disposition`/`Content-Length` header 설정 (`byteSizeHint` 만 실 body 길이로 보정) · body bytes 무변형 forward (재필터·secret strip 0) 가 문서에 적을 사실. **0 수정**.
- [src/export/import-mode-description.ts](../../src/export/import-mode-description.ts) 30~36 행 — `ImportModeDescription` 5 필드 (`headline` / `detailLines` / `destructive` / `mergeStrategy` / `reason`). `/modes` row 의 응답 서술에 필드명을 문자 그대로 인용. **0 수정**.

## Acceptance Criteria

- [ ] **`GET /api/admin/import/running` 행 신설** — UC-07 §8 status polling 경로. 응답 200 + `ImportJob[]` (진행 중 `status=RUNNING` job 목록), **매칭 0 이면 빈 배열** (404 변환 0 — service `findRunning` raw forward). 401 (미인증) / 403 (비-Admin). 권한 열 `Admin+`.
- [ ] **`GET /api/admin/import/modes` 행 신설** — import mode 선택 dialog 의 사람-친화 설명 목록 (UC-07 §5 step 2 + §6.2). 응답 200 + `ImportModeDescription[]` **정확히 2 원소** (`REPLACE` → `destructive: true` / `MERGE` → `destructive: false`), 각 원소 필드는 `headline` / `detailLines` / `destructive` / `mergeStrategy` / `reason`. **DB write 0 · raw 본문 미접근** (REQ-032 유지) · client 입력 분기 0 (알려진 2 mode 만 helper 로 forward). 401 / 403.
- [ ] **`GET /api/admin/import/:id` 행 신설** — 단건 status polling 조회 (UC-07 §8). 응답 200 + `ImportJob`, 부재 id 는 service `findUniqueOrThrow` 의 P2025 → **404** (controller swallow 0). 401 / 403. 같은 행 또는 인접 문장에 **route 선언 순서 주의** (`running` · `modes` literal 이 `:id` 동적 segment 보다 먼저 선언돼 있어 `/running` 이 id 로 포착되지 않는다) 를 한 절로 박제.
- [ ] **`GET /api/admin/export/:id/download` 행 신설** — 저장된 export job 의 full-record dump 다운로드 (UC-07 §5 step 13 + §8 (c) artifact 전달). 응답 200 + **`StreamableFile` body** + `Content-Type` / `Content-Disposition` / `Content-Length` header (`buildExportArtifactDescriptor` 산출 descriptor 를 그대로 쓰되 `byteSizeHint` 만 실 body 길이로 보정 — 불일치 시 응답 잘림/hang 방지). body bytes 는 service Readable 그대로 **무변형 forward** (controller 재필터 · secret strip · 컬럼 재검증 0 — 상류 projection/builder 가 이미 강제, REQ-032). 부재 id 404 (`findJob`), 401 / 403. `:id/download` 가 `:id` 보다 먼저 선언된 사실도 한 절.
- [ ] **행 위치·표 무결** — 4 행 모두 UC-07 그룹 (123 행 그룹 헤더 ~ 128 행 `POST /api/admin/restore`) **안**에 넣는다. import 3 행은 `POST /api/admin/import/preview` (126 행) 뒤, export download 행은 `POST /api/admin/export` (124 행) 뒤 또는 import 3 행 뒤 중 한 곳으로 일관되게. 신설 4 행 각각이 **5 열 무결** (`| METHOD | route | UC | 설명 | 권한 |` — 파이프 6 개) 이고 기존 행 수정 0.
- [ ] **근거 표기** — 각 신설 행 끝에 `T-NNNN 박제` 형태 대신, 본 문서화 행위의 근거로 `T-1304 문서화` 를 적고 구현 근거가 되는 파일 경로 (`src/import/import.controller.ts` / `src/export/export.controller.ts`) 를 1 개씩 명시한다 (기존 행들이 PR 번호를 적는 관례와 달리 본 4 route 는 여러 task 에 걸쳐 shipped 됐으므로 파일 pointer 가 정확한 정본이다).
- [ ] **traceability 행 amend** — 178 행 UC-07 cell 에 `GET /api/admin/export/:id/download` 를 추가하고, 그 행의 성격 표기를 "step 1 (Admin → export 또는 import) + step 13 (다운로드)" 로 한 번만 확장한다. **import 조회 3 종은 §5 step 1 이 아니라 §8 status polling 이므로 traceability 행에 넣지 않는다** — 이 판단을 같은 cell 또는 181 행 아래 각주 한 문장으로 남긴다.
- [ ] **grep 대조 4 종 통과** (R-110/R-112 면제의 대체 검증):
  1. `grep -c "api/admin/import/running\|api/admin/import/modes\|api/admin/export/:id/download" docs/architecture/api.md` ≥ 3.
  2. `grep -c "ImportModeDescription" docs/architecture/api.md` ≥ 1 이고 철자가 `src/export/import-mode-description.ts` 의 `export interface ImportModeDescription` 과 일치.
  3. `grep -c "StreamableFile" docs/architecture/api.md` ≥ 1 이고 철자가 `export.controller.ts` 의 반환 타입과 일치.
  4. UC-07 그룹 (123~132 행 부근) 의 모든 표 행이 5 열 무결 — 신설 후 파이프 개수 확인, 표 렌더 깨짐 0.
- [ ] **R-110/R-112 면제 근거 명시** — 본 task 는 코드 0 LOC / test 0 건이라 tester 호출 불요. 위 grep 4 종 결과를 commit body trail 의 `notes` 에 1~2 줄로 박제 (§11 길이 제한 준수).
- [ ] **direct commit 절차** — main 에서 `git push HEAD:main` (feature branch · PR 생성 0, [LOOP.md](../LOOP.md) §4 push source/target 매칭). commit subject 는 `docs(api): …(T-1304)` 형태.
- [ ] **언어 규율 (§12)** — 문서 본문 · commit 본문은 한국어, route · 타입명 · header 이름 · enum 값은 영어 그대로.

## Out of Scope

- **코드 · test 수정 0** — `src/**`, `test/**` 어느 파일도 건드리지 않는다 (§3.1 rule 3 — 섞으면 direct/pr 혼합 위반).
- **export 잔여 route 5 개 행 신설 0** — `GET /api/admin/export/running` · `POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection` · `GET /api/admin/export/:id/status-view` · `GET /api/admin/export/:id` 는 서술 부피가 본 4 행과 맞먹어 **별도 slice**. Follow-ups 로 이월.
- **UC-07 use-case 문서 수정 0** — §5 mermaid sequence 에 preview/download step 반영, §8 polling 절 보강 등은 별건 (T-1301 이월 그대로). 본 task 는 api.md 1 파일만 만진다.
- **기존 5 행 재서술 0** — `POST /api/admin/export` (124) · `/import` (125) · `/import/preview` (126) · `/backup` (127) · `/restore` (128) 의 문장은 손대지 않는다 (추가만).
- **응답 예시 JSON 블록 신설 0** — 표 셀 안 산문 서술 유지 (기존 관례). shape 를 별도 문서/코드 블록으로 옮기지 않는다.
- **data-model.md · directory.md 동기 0** — 본 4 route 는 새 엔티티·디렉토리를 만들지 않는다.
- **크기 초과 시** — 서술이 길어져 cap 에 접근하면 export download 행을 다음 slice 로 미루고 import 조회 3 행만 먼저 박제한다 (import 측 3 행이 우선).

## Suggested Sub-agents

`implementer` (doc-only — tester 미호출, R-110 면제 근거는 Acceptance Criteria 에 명시)

## Follow-ups

- (본 task 발) api.md UC-07 표에 **export 잔여 route 5 행** 신설 — `GET /api/admin/export/running` · `POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection` · `GET /api/admin/export/:id/status-view` · `GET /api/admin/export/:id`. direct-mode doc task.
- (T-1301 이월) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview + mode echo 로 실행 전 정보는 갖춰졌으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 → 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.


## Result (2026-07-29)

- **Status: DONE** — commit `e122b6fc` (direct, main). CI run 30440622423 = success.
- api.md UC-07 표에 `GET /api/admin/import/running` · `/modes` · `/:id` + `GET /api/admin/export/:id/download` 4 행 신설 (preview 행 뒤), §7 traceability 행에 download 추가 + import 조회 3 종 제외 근거 각주 1 문장. 기존 5 행 0 수정.
- diff `+7/-1` / 1 파일 — cap (300 LOC / 5 파일) 안.
- controller 문자 대조 grep 4 종 통과: `running|modes|download` 6 hit (>=3) · `ImportModeDescription` 1 · `StreamableFile` 1 · UC-07 10 행 모두 파이프 6 개 (5 열 무결).
- 코드 0 LOC 이라 R-110/R-112 면제 — 대체 검증은 위 grep 대조.
- 이월: export 잔여 route 5 행은 T-1305 로 큐잉.
