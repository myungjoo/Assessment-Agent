---
id: T-1301
title: import preview endpoint 계약 문서 동기 — api.md UC-07 표 row + UC-07 §6.5 dry-run alt flow (doc slice 3c-5d)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-07-29
independentStream: import-restore-docs
dependsOn: [T-1299, T-1300]
touchesFiles:
  - docs/architecture/api.md
  - docs/use-cases/UC-07-export-import.md
plannerNote: "doc-only inline-amend x1.6 x0.4 = 약 70 LOC / 2 파일. T-1300 Follow-up 1 — 코드로 shipped 된 preview 계약을 문서 정본에 동기"
---

# T-1301 — import preview endpoint 계약 문서 동기 (doc slice 3c-5d)

## Why

[T-1299](T-1299-import-preview-endpoint.md) (머지 `5ca07860`) 가 `POST /api/admin/import/preview` 를 배선하고, [T-1300](T-1300-import-preview-e2e.md) (머지 PR #1190) 이 그 계약을 실 HTTP 왕복 e2e 로 박제하면서 **preview 경로는 코드·테스트 양쪽에서 완결** 됐다. 그러나 문서 정본은 그대로다 — [api.md](../architecture/api.md) 124~127 행 UC-07 블록에는 `/api/admin/import` 한 줄만 있고 preview row 가 없으며, [UC-07](../use-cases/UC-07-export-import.md) §5 sequence 64 행이 요구하는 "영향 범위 (실행 전 표시)" 를 **무엇이 채우는지** 어디에도 적혀 있지 않다.

두 slice 모두 이 문서 동기를 Out of Scope 로 미루며 "별도 direct-mode doc task (§3.1 rule 3)" 로 명시했고, T-1300 의 Follow-ups 첫 항목이 바로 본 task 다. 코드가 앞서고 문서가 뒤처진 drift 는 다음 소비자 (web confirmation dialog 배선 · 외부 client) 가 endpoint 존재 자체를 모르게 만드는 실 비용이므로 여기서 닫는다. 코드 · test 는 **한 줄도 건드리지 않는다** — 이미 shipped 된 사실을 문서에 옮겨 적는 것이 전부다.

**estimate 근거** — api.md row 신설 1 + 기존 row 정합 1 + traceability row 1 행 ~ 35 LOC, UC-07 §6.5 신설 + §10 cover 위치 갱신 ~ 40 LOC → base ~110, doc-only enumerated-section × 1.6 × inline-amend × 0.4 → **~70 LOC / 2 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) 123~127 행 (`**UC-07 Export / Import / Backup (`/api/admin`)**` 표 블록) + 177 행 (UC → endpoint traceability 표의 UC-07 행) — **변경 대상 1**. 같은 표의 `/api/llm/providers` row 들 (114~118 행) 이 서술 밀도·문장 형식·`T-NNNN 박제 (PR #N)` 말미 표기의 본보기다. 그 형식을 따른다.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §6 (99~117 행, 특히 §6.2 Import merge 옵션 · §6.3 · §6.4 의 한 문단 형식) + §7.4 (124 행) + §10 REQ 표 (156~158 행) — **변경 대상 2**. §5 mermaid sequence (51~98 행) 는 **읽기만** 하고 수정하지 않는다 (Out of Scope).
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 259~300 행 (`preview` 핸들러) — 문서에 옮겨 적을 **계약 정본**. route (`@Post("preview")` on `@Controller("api/admin/import")` → `POST /api/admin/import/preview`), RBAC (`JwtAuthGuard` + `RolesGuard` + `@Roles("Admin")` → Admin+), 업로드 stack (`FileInterceptor("file")` + `MAX_IMPORT_FILE_SIZE_BYTES` + `MulterExceptionFilter` 413), `dto.mode ?? ImportMode.REPLACE` fallback, `createJob`/`runJob` 미호출. **0 수정**.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 24~38 행 — 응답 shape 정본 (`RestorePlanSummary` = `deleted` / `inserted` / `kept` 각각 `{ total, perEntity }`, `perEntity` 는 5 entity key). **0 수정**.
- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 의 section G (T-1300 신설분) — 문서에 적을 수치 일치 / DB write 0 계약이 실제로 어디까지 증명됐는지 확인용. **0 수정**.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `docs/architecture/api.md` · `docs/use-cases/UC-07-export-import.md` **만**. `src/**` · `test/**` · `web/**` · `prisma/**` · `package.json` · `docs/decisions/**` · 다른 `docs/architecture/*` **0 수정** (`git status --short` 로 2 파일만 나오는지 확인).
- [ ] **api.md — preview row 신설** — UC-07 표의 `POST /api/admin/import` 행 **바로 아래** 에 `| POST | `/api/admin/import/preview` | UC-07 §5 | ... | Admin+ |` 1 행을 추가하고 설명에 다음 5 사실을 모두 담는다: (a) **복원을 실행하지 않고** 영향 요약만 산출하는 dry-run, (b) 요청은 `create` 와 동일한 multipart (`file` 필드 + optional `mode`, `mode` 미지정 시 `ImportMode.REPLACE` 로 해석 — `prisma/schema.prisma` `@default(REPLACE)` mirror), (c) 응답 201 + `RestorePlanSummary` (`deleted`/`inserted`/`kept` × `{total, perEntity}`) 를 wrapper 없이 그대로, (d) **`ImportJob` row 미생성 · DB write 0 · `$transaction` 미개시**, (e) 실패 400 (파일 미첨부 · 손상 dump · DTO 위반) / 401 (미인증) / 403 (비-Admin) / 413 (크기 상한). 말미에 `T-1299 (PR #1189) 배선 · T-1300 (PR #1190) e2e 박제` 표기.
- [ ] **api.md — 기존 import row 정합** — `POST /api/admin/import` 행의 설명이 [T-1296](T-1296-import-response-restore-summary.md) 이후의 사실 (응답이 `ImportJob` 필드 + `restoreSummary` 동봉) 을 반영하도록 **한 절 보강**. 기존 문구 (`평가 자료 import (multipart file upload)`) 와 `Admin+` 열은 유지하고 덧붙이기만 한다 — 행 전체 재작성 금지.
- [ ] **api.md — traceability 행 갱신** — 177 행 UC-07 traceability 행의 endpoint 목록에 `POST /api/admin/import/preview` 를 추가한다 (기존 나열 순서·다른 endpoint 문자열 무수정).
- [ ] **UC-07 — §6.5 신설** — §6.4 뒤에 `### 6.5 실행 전 preview (dry-run)` 를 한 문단으로 추가한다. §6.1~§6.4 와 같은 한 문단 형식으로 다음을 담는다: §5 sequence 64 행 confirmation 의 "영향 범위" 를 채우는 것이 본 경로라는 점, 같은 dump 를 preview 로 올렸을 때의 수치가 **실행 후 응답의 `restoreSummary` 와 일치** 한다는 계약, preview 요청은 **DB 를 한 row 도 바꾸지 않는다** (job row 도 안 남는다), 그리고 그 두 계약이 실 HTTP e2e 로 박제됐다는 사실 (`T-1300`). 구체 route / 응답 shape 는 [api.md](../architecture/api.md) 로 pointer (UC 문서에 endpoint 스펙을 복제하지 않는다 — §6.1 의 "구체 query schema 는 P2 api.md" 관례 정합).
- [ ] **UC-07 — §7.4 한 절 보강** — §7.4 (Import file 손상) 에 **preview 경로도 동일 정책** (손상 dump 는 400 + `transaction` 시작 전 reject, DB 변경 0) 이라는 한 절 추가. 기존 문장 재작성 금지 — 덧붙이기만.
- [ ] **UC-07 — §10 cover 위치 갱신** — REQ 표의 `REQ-030` 행 "본 UC 의 cover 위치" 에 `§6.5` 를 추가 (기존 나열 무수정, 항목만 추가).
- [ ] **사실 정확성 (grep 대조)** — 문서에 적은 route 문자열이 실제 코드와 일치함을 확인한다: `grep -n '@Post("preview")' src/import/import.controller.ts` 가 1 hit, `grep -n 'Controller("api/admin/import")' src/import/import.controller.ts` 가 1 hit. 응답 필드명 3 종 (`deleted` / `inserted` / `kept`) 과 breakdown 필드 (`total` / `perEntity`) 는 `src/export/import-restore-plan-summary.ts` 의 `RestorePlanSummary` 정의와 **문자 그대로** 일치해야 한다. 코드에 없는 필드·status code 를 문서에 만들어내지 않는다 (날조 0).
- [ ] **표 구조 무결** — `docs/architecture/api.md` 의 UC-07 표가 5 열 (`method | path | UC | 설명 | 최소 권한`) 을 유지하고 신규 행도 `|` 개수가 같다. 렌더 확인: `grep -n "api/admin/import" docs/architecture/api.md` 결과가 3 행 (import · preview · traceability) 이며 각 표 행의 열 수가 인접 행과 동일.
- [ ] **언어 규율 (§12)** — 추가 문장 본문은 한국어, route · 필드명 · status code · enum (`ImportMode.REPLACE`) · 타입명은 영어 그대로.
- [ ] **doc-only 라 §3.2 R-110/R-112 면제** — 코드 0 LOC 이므로 tester 호출·신규 test 작성 의무 없음. 대신 위 grep 대조 3 종으로 검증을 갈음하고, 그 결과를 commit trail 의 `notes` 에 1 줄 남긴다.
- [ ] **direct commit** — main 에서 직접 commit → `git push HEAD:main`. PR·reviewer 없음 (§3.1 direct 판정: 기존 문서 inline 수정, 새 `docs/architecture/*`·`docs/decisions/*` 파일 신설 0 · 코드 0 — 선례 `8492f0a1` api.md UC-06 drift 교정). push 후 main CI conclusion 확인 (R-114).

## Out of Scope

- **코드·test 0 수정** — `src/**` · `test/**` 를 열어 읽는 것은 되지만 편집 금지. 문서와 코드가 어긋난 곳을 발견하면 **문서를 코드에 맞추고**, 코드 쪽이 틀렸다고 판단되면 고치지 말고 Follow-ups + commit trail 에 기록한다.
- **§5 mermaid sequence 재작성 0** — preview step 을 diagram 에 그려 넣는 것은 diagram 전체 번호 재정렬을 유발한다 (autonumber). 별도 slice.
- **api.md 의 다른 UC-07 drift 보강 0** — export download (`GET /api/admin/export/:id/download`, T-1291/T-1292) · import 조회 3 종 (`GET /api/admin/import/running` · `/modes` · `/:id`) 도 표에 없지만 **본 task 에서 채우지 않는다** (Follow-ups). 본 slice 는 preview 축만.
- **UC-07 §8 postcondition 개정 0** — preview 경로의 postcondition (DB 무변화 · audit row 0) 을 §8 에 별도 항목으로 넣는 것은 §8 구조 변경이라 별건.
- **web (frontend) 배선 0** — confirmation dialog 가 preview 를 호출하도록 바꾸는 것은 P6 축.
- **새 ADR · 새 파일 신설 0** — 신설 시 `commitMode` 가 `pr` 로 바뀐다 (§3.1 rule 4). 본 task 는 기존 2 파일 inline 수정만.
- **`docs/requirements.md` · `docs/PLAN.md` 수정 0**.
- **크기 초과 시** — 총 diff 가 100 LOC 을 넘어가면 §7.4 보강 → §10 갱신 순으로 덜어내고 그 사실을 Follow-ups 에 기록한다 (cap 300 이라 여유는 크지만 doc drift 를 한 slice 에 몰아 담지 않는다).

## Suggested Sub-agents

`implementer` (doc-only inline amend — architect·tester 불요)

## Follow-ups

- (본 slice 가 낳음) api.md UC-07 표의 **잔여 drift** 보강 — export download (`GET /api/admin/export/:id/download`) · import 조회 3 종 (`GET /api/admin/import/running` · `/modes` · `/:id`) row 신설. direct-mode doc task.
- (본 slice 가 낳음) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (T-1300 이월) preview 응답에 **해석된 mode 를 echo** 할지 판단 — `mode` 미지정 시 client 는 어떤 mode 기준 수치인지 알 수 없다. shape 확장이라 별도 slice.
- (유지, T-1293~T-1300) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview 로 실행 전 수치는 보이게 됐으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1300 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → T-1300 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
