---
id: T-1303
title: import preview 응답의 mode echo 를 문서 정본에 동기 (계약 slice 3c-5f)
phase: P5
status: DONE
completedAt: 2026-07-29T08:50:00Z
resultCommit: 49fafc2e
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1302]
touchesFiles:
  - docs/architecture/api.md
  - docs/use-cases/UC-07-export-import.md
plannerNote: "doc-only enumerated-section x1.6 x inline-amend 0.4 = 약 40 LOC / 2 파일. T-1302 Follow-up 1 — preview 응답 shape drift 해소 (3c-5f)"
---

# T-1303 — import preview 응답의 mode echo 문서 동기 (계약 slice 3c-5f)

## Why

[T-1302](T-1302-import-preview-mode-echo.md) (PR #1191, squash `8bdc8f2e`) 가 `POST /api/admin/import/preview` 의 응답을 `PreviewImportResponse`(= `RestorePlanSummary` 3 그룹 + `mode` 한 key, 총 4 key) 로 확정해 shipped 시켰다. 그런데 문서 정본 두 곳은 아직 **직전 shape 를 사실로 적고 있다** — [api.md](../architecture/api.md) 126 행의 preview row 는 "`RestorePlanSummary` … 를 wrapper 없이 그대로 반환" 이라 적어 `mode` key 의 존재를 부정하고, [UC-07](../use-cases/UC-07-export-import.md) §6.5 는 mode 해석 규칙만 서술할 뿐 그 해석 결과가 응답으로 되돌아온다는 사실이 0 이다. 즉 code 는 4 key 인데 문서는 3 key — 정본이 production 과 어긋난 drift 다.

문서가 §3.1 상 `direct` 컬럼이라 T-1302 (pr) 에 섞을 수 없어 rule 3 대로 분리된 후속이며, [T-1299](T-1299-import-preview-endpoint.md)→[T-1301](T-1301-import-preview-api-doc-sync.md) 과 정확히 같은 순서다. 코드 0 LOC · 기존 doc 2 파일의 section 단위 inline 수정만이라 R-110/R-112 는 면제되고, 대신 code ↔ doc 문자 대조를 Acceptance Criteria 로 강제한다.

**estimate 근거** — api.md preview row 응답 절 교체 ~15 LOC + UC-07 §6.5 mode echo 한 절 추가 ~10 LOC + 인접 문장 정합 ~10 LOC → base ~60, doc-only enumerated-section × 1.6 × inline-amend 0.4 = × 0.64 → **~40 LOC / 2 파일** (cap 안, `sizeExempt` 불요).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) 126 행 — UC-07 표의 `POST /api/admin/import/preview` row. "응답 201 + `RestorePlanSummary` (…) 를 wrapper 없이 그대로 반환" 문장이 **교체 대상**. 같은 표의 125 행 (`POST /api/admin/import` row 의 `restoreSummary` 서술) 은 **대조용 0 수정** — 실행 응답은 T-1302 에서 변하지 않았다.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 117~119 행 (§6.5 실행 전 preview (dry-run)) — 계약 (i)(ii) 뒤에 mode echo 한 절을 **추가**할 자리. 마지막 문장 "`mode` 를 지정하지 않으면 실행 경로의 default 와 같은 mode 로 해석되므로…" 가 이어질 지점.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 156~171 행 — `PreviewImportResponse` 선언과 additive spread 근거 주석. **문서에 적을 사실의 정본, 0 수정**. key 집합(`deleted`/`inserted`/`kept`/`mode`) 과 타입명을 여기서 그대로 인용한다.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 24~38 행 — `RestorePlanSummary` 정의. **0 수정**, 필드명 문자 대조용.

## Acceptance Criteria

- [ ] **api.md preview row 응답 절 교체** — 126 행의 "…를 wrapper 없이 그대로 반환" 을 실제 shape 로 바꾼다: 응답 201 + `PreviewImportResponse` = `RestorePlanSummary` 3 그룹(`deleted`/`inserted`/`kept`, 각 `{ total, perEntity }`) 을 그대로 펼친 위에 **해석된 `mode`** 한 key 를 더한 additive envelope, key 집합은 정확히 4 개. 타입명 `PreviewImportResponse` 와 key 이름은 controller 선언과 **문자 일치**.
- [ ] **echo 의 의미 1 줄** — 같은 row 안에 "`mode` 는 요약 수치가 어느 mode 기준인지를 client 가 응답만으로 알게 하는 값이며, service 에 넘긴 바로 그 해석 결과(미지정 시 `REPLACE`)" 라는 취지를 한 문장으로 박제. 근거 task 표기 `T-1302 (PR #1191)` 를 기존 `T-1299 (PR #1189) 배선 · T-1300 (PR #1190) e2e 박제` 뒤에 추가.
- [ ] **실행 응답 무변화 명시** — preview row 또는 import row 중 한 곳에 "실행 응답(`CreateImportResponse`) 의 `restoreSummary` 에는 `mode` 가 **없다** (job row 의 top-level `mode` 가 그 역할)" 를 한 절로 적어 두 응답의 차이를 문서에서 구분한다. import row 의 기존 서술 자체는 수정 0 (추가만).
- [ ] **UC-07 §6.5 계약 (iii) 추가** — 기존 계약 (i)(ii) 뒤에 (iii) 로 "preview 응답은 산출 기준 mode 를 함께 되돌려주므로 (`mode` key), 사용자가 mode 를 지정하지 않아 `REPLACE` 로 해석된 경우에도 confirmation dialog 가 **어느 mode 기준의 파괴 범위인지** 를 응답만으로 표시할 수 있다" 취지를 서술. endpoint 스펙 복제는 하지 않고 (§6.1 관례) 상세는 api.md 를 정본으로 가리킨다.
- [ ] **UC-07 마지막 문장 정합** — 117~119 행 끝의 "`mode` 를 지정하지 않으면 … 조용히 어긋나지 않는다" 문장이 (iii) 과 중복 서술되지 않도록 다듬는다 (해석 규칙 → 응답 echo 로 자연스럽게 이어지게). 문장 삭제가 아니라 연결.
- [ ] **grep 대조 3 종 통과** (R-110/R-112 면제의 대체 검증):
  1. `grep -c "PreviewImportResponse" docs/architecture/api.md` ≥ 1 이고, 그 문자열이 `src/import/import.controller.ts` 의 `export interface PreviewImportResponse` 와 동일 철자.
  2. `grep -n "wrapper 없이 그대로 반환" docs/architecture/api.md` **0 hit** (낡은 서술 잔존 0).
  3. api.md UC-07 표의 preview row 가 여전히 **5 열 무결** (`| METHOD | route | UC | 설명 | 권한 |`) 이고 표 렌더가 깨지지 않음 — 행 수 · 파이프 개수 확인.
- [ ] **REQ traceability 유지** — api.md 178 행 traceability 행의 preview endpoint 표기와 UC-07 §10 REQ-030 cover 위치(§6.5 포함) 는 이미 T-1301 이 박제했으므로 **수정 0**, 존재만 확인.
- [ ] **R-110/R-112 면제 근거 명시** — 본 task 는 코드 0 LOC / test 0 건이라 tester 호출 불요. 대신 위 grep 3 종 결과를 commit body trail 의 `notes` 에 1~2 줄로 박제 (§11 길이 제한 준수).
- [ ] **direct commit 절차** — main 에서 `git push HEAD:main` (feature branch · PR 생성 0, [LOOP.md](../LOOP.md) §4 push source/target 매칭). commit subject 는 `docs(api): …(T-1303)` 형태.
- [ ] **언어 규율 (§12)** — 문서 본문 · commit 본문은 한국어, 타입명 · route · key 이름 · enum 값은 영어 그대로.

## Out of Scope

- **코드 · test 수정 0** — `src/**`, `test/**` 어느 파일도 건드리지 않는다. 본 task 는 문서 정본 동기 전용 (§3.1 rule 3 — 섞으면 direct/pr 혼합 위반).
- **api.md 잔여 row 신설 0** — export download (`GET /api/admin/export/:id/download`) · import 조회 3 종 (`GET /api/admin/import/running` · `/modes` · `/:id`) row 는 T-1301 에서 이월된 **별건** 이며 본 task 에서 추가하지 않는다 (diff 팽창 · 검증 초점 흐림 방지). Follow-ups 유지.
- **UC-07 §5 mermaid sequence 수정 0** — preview step 을 sequence 에 넣는 것은 autonumber 재정렬을 동반해 별도 slice (T-1301 이월분 그대로).
- **`RestorePlanSummary` / `PreviewImportResponse` 타입 서술 재구조화 0** — data-model.md 나 별도 문서로 shape 를 옮기지 않는다. api.md 표 셀 안 서술 유지.
- **web (frontend) 문서 0** — confirmation dialog 가 `mode` 를 어떻게 보여줄지는 P6 축.
- **ADR 신설 0** — 응답 shape 결정 근거는 controller 주석 + T-1302 정의서에 이미 박제됐다.
- **크기 초과 시** — 문서 서술을 늘려 300 LOC 에 접근하면 UC-07 §6.5 추가분을 2~3 문장으로 압축한다 (api.md row 정확성이 우선).

## Suggested Sub-agents

`implementer` (doc-only — tester 미호출, R-110 면제 근거는 Acceptance Criteria 에 명시)

## Result (2026-07-29)

`DONE` — direct commit `49fafc2e` (main), doc-only **+2/-2 · 2 파일**. `docs/architecture/api.md` 의 preview row 응답 절을 `PreviewImportResponse` (3 그룹 수치 + `mode`) 로 교체하고 `docs/use-cases/UC-07-export-import.md` §6.5 에 계약 (iii) 을 추가해 T-1302 (PR [#1191](https://github.com/myungjoo/Assessment-Agent/pull/1191)) 가 shipped 시킨 응답 shape 와 문서 사이 drift 를 닫았다. 실행 응답 서술·`RestorePlanSummary` 정의·REQ traceability 는 0 수정. R-110/R-112 는 direct doc-only (코드 0 LOC) 로 면제, 대체 검증으로 grep 3 종 (controller 철자 일치 / 옛 문구 0 hit / 표 열 무결) 통과. main CI run 30436458337 = **success**.

## Follow-ups

- (T-1301 이월) api.md UC-07 표의 **잔여 drift** 보강 — export download (`GET /api/admin/export/:id/download`) · import 조회 3 종 (`GET /api/admin/import/running` · `/modes` · `/:id`) row 신설. direct-mode doc task.
- (T-1301 이월) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview + mode echo 로 실행 전 정보는 갖춰졌으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 → 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.
