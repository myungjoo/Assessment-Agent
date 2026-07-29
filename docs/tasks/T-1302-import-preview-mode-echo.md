---
id: T-1302
title: import preview 응답에 해석된 mode echo — 수치의 기준 mode 를 client 가 알 수 있게 (계약 slice 3c-5e)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1299, T-1300]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
  - test/e2e/import-restore-http.e2e-spec.ts
plannerNote: "R-112 backbone x1.5 = 약 200 LOC / 3 파일. T-1300 Follow-up 3 — preview 응답에 해석된 mode echo (3c-5e)"
---

# T-1302 — import preview 응답에 해석된 mode echo (계약 slice 3c-5e)

## Why

[T-1299](T-1299-import-preview-endpoint.md) (PR #1189) 가 배선한 `POST /api/admin/import/preview` 는 `mode` form field 를 생략하면 controller 안에서 `dto.mode ?? ImportMode.REPLACE` 로 조용히 해석한다 ([import.controller.ts](../../src/import/import.controller.ts) `preview` 핸들러). 그런데 응답은 `RestorePlanSummary` 3 그룹 수치뿐이라 **client 는 눈앞의 숫자가 어느 mode 기준인지 알 수 없다** — REPLACE 로 해석된 "Person 1 건 삭제" 를 MERGE 기준으로 오독하면 확인 dialog 가 사용자에게 잘못된 파괴 범위를 보여준다. preview 의 존재 이유가 [UC-07](../use-cases/UC-07-export-import.md) §5 64 행 confirmation 의 "영향 범위" 표시인 만큼, 기준값이 응답에 없는 것은 그 목적 자체를 반쯤 비운다.

이 gap 은 [T-1300](T-1300-import-preview-e2e.md) 의 Follow-up 3 (그리고 T-1301 로 이월) 으로 박제돼 있다. 지금 닫는 이유는 **소비자가 아직 0** 이기 때문이다 — preview 는 2 fire 전 shipped 됐고 web (P6) 배선도 외부 client 도 없다. 여기서 shape 를 확정하지 않으면 나중에는 breaking change 가 된다.

**estimate 근거** — controller 응답 interface 신설 + 반환 조립 + 근거 주석 ~30 LOC, controller spec (unit `preview` describe + supertest dry-run 구간) 갱신·추가 ~70 LOC, e2e section H 의 3 개 단언 조정 + echo 전용 단언 ~35 LOC → base ~135, R-112 backbone × 1.5 → **~200 LOC / 3 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 137~151 행 (`CreateImportResponse` 선언 + additive spread 를 택한 근거 주석 — **본 task 가 따를 shape 선례**) + 259~300 행 (`preview` 핸들러, `const mode = dto.mode ?? ImportMode.REPLACE` 와 `return this.restore.previewFromDump(file.buffer, mode)`) + 파일 머리 주석 29~34 행 (preview endpoint surface 설명 — 본 변경 반영 대상). **변경 대상 1**.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 594~670 행 (unit `preview` 구간 — happy 는 `previewFromDump` 반환 **인스턴스 동일성**(`toBe`) 을 단언하므로 본 변경으로 반드시 손대야 한다) + 1159 행 이후 (`POST /api/admin/import/preview` supertest 구간). **변경 대상 2**.
- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 681~800 행 (section H — `uploadPreview` helper + preview dry-run 케이스). 조정 대상 단언 3 곳: `expect(preview.body).toEqual({deleted,inserted,kept})` (703 행 케이스), `expect(executed.body.restoreSummary).toEqual(preview.body)` **2 곳** (REPLACE/MERGE happy 케이스). **변경 대상 3**. **section 문자를 새로 만들지 않는다** — 기존 H 안에서 수정·추가한다 (T-1300 의 section 충돌 마찰 재발 방지).
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 24~38 행 — `RestorePlanSummary` 정의 (`deleted`/`inserted`/`kept`). **0 수정** (요약 타입 자체는 건드리지 않는다 — 실행 응답의 `restoreSummary` 가 같은 타입을 공유하므로 여기를 바꾸면 실행 경로까지 오염된다).
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `enum ImportMode` + `ImportJob.mode` `@default(REPLACE)` — echo 하는 값의 정본. **0 수정**.

## Acceptance Criteria

- [ ] **응답 shape — additive spread** — `src/import/import.controller.ts` 에 `PreviewImportResponse` 를 신설한다: `RestorePlanSummary` 를 extend 하고 `mode: ImportMode` 한 key 만 **추가**. `preview` 핸들러 반환 타입을 `Promise<PreviewImportResponse>` 로 바꾸고 `return { ...summary, mode }` 형태로 조립한다 (`CreateImportResponse` 의 additive spread 선례 정합 — 중첩 `{ mode, summary }` 는 preview ↔ 실행 `restoreSummary` 타입 대응을 깨므로 **택하지 않는다**). 선언부에 그 선택 근거를 주석 2~4 줄로 박제.
- [ ] **echo 값의 단일 source** — 응답의 `mode` 는 `previewFromDump` 에 실제로 넘긴 **바로 그 변수** 여야 한다 (`dto.mode` 재참조·재해석·문자열 재조립 0). 즉 `const mode = dto.mode ?? ImportMode.REPLACE` 하나가 service 인자와 응답 key 양쪽의 유일한 source. 이 불변을 주석 1 줄로 명시.
- [ ] **요약 3 그룹 값 불변** — `deleted` / `inserted` / `kept` 의 값은 service 인스턴스에서 온 그대로다 (복제 후 필드 pick · 재계산 · 반올림 · 이름 변경 0). 응답 key 집합은 정확히 **4 개** (`deleted`/`inserted`/`kept`/`mode`) — `mode` 가 요약 key 를 덮거나 추가 wrapper 를 만들지 않는다.
- [ ] **happy-path unit test 1+** — `preview` 가 `{ ...요약, mode }` 를 반환하고 요약 3 그룹이 mock 이 준 값과 정확히 같음을 단언. 기존의 인스턴스 동일성(`toBe`) 단언은 **구조 동등성 + `mode` key** 단언으로 교체하고, 교체 사유를 spec 주석 1 줄로 남긴다.
- [ ] **branch test — mode 해석 3 종** — `dto.mode = REPLACE` / `dto.mode = MERGE` / `dto.mode` 미지정 각각에 대해 (a) `previewFromDump` 에 넘어간 mode 인자와 (b) 응답 `body.mode` 가 **같은 값** 임을 한 단언 쌍으로 묶는다 (echo 가 forward 값과 어긋나면 fail). 미지정 케이스의 기대값은 `ImportMode.REPLACE` — schema `@default(REPLACE)` mirror.
- [ ] **error path test 1+** — 파일 누락 시 종전대로 `BadRequestException`(400) 이고 `previewFromDump` 미호출 + 응답 body 에 `mode` key 가 실리지 않음 (성공 경로에서만 echo). 또한 `previewFromDump` 가 reject 하면 그 인스턴스가 **재랩핑 없이 그대로** 전파됨을 유지 확인 (기존 단언 보존 — echo 조립이 try/catch 를 새로 만들지 않았다는 증거).
- [ ] **negative cases 충분 cover** — 각 1+ test: (a) 미인증 401, (b) 비-Admin 403 (기존 supertest 케이스 유지 확인 — echo 가 guard 앞으로 새지 않음), (c) whitelist 위반 필드 포함 400 (`forbidNonWhitelisted`), (d) `mode` 에 비유효 enum 문자열 전송 시 400 이며 응답이 임의 문자열을 echo 하지 않음 (ValidationPipe 가 먼저 거부 — 날조 echo 0), (e) 요약 mock 의 `deleted.perEntity` 가 비어 있어도 `mode` 만 추가되고 요약 구조가 변형되지 않음 (경계값).
- [ ] **e2e section H 정합** — `test/e2e/import-restore-http.e2e-spec.ts` 의 조정 대상 3 단언을 실 HTTP 사실에 맞춘다: (1) preview body 의 `toEqual` 대상에 `mode: "REPLACE"` 추가, (2)(3) `expect(preview.body).toEqual({ mode: <해당 mode>, ...executed.body.restoreSummary })` 형태로 뒤집어 **preview ↔ 실행 수치 일치 계약을 그대로 유지하면서** echo 를 함께 고정. 추가로 mode 미지정 요청의 `body.mode === "REPLACE"` 를 실 HTTP 로 1 건 단언 (default mirror 가 wire 상에서도 관측됨). 새 e2e 파일 · 새 section 문자 · 새 harness 신설 0, 기존 `afterEach` actor FK 재 seed 순서 **무수정**.
- [ ] **실행 응답 무변화 회귀 방지** — `POST /api/admin/import` 응답(`CreateImportResponse`)에는 아무 변화가 없음을 기존 단언으로 확인한다 (`restoreSummary` 안에 `mode` key 가 **생기지 않아야** 한다 — job row 의 top-level `mode` 가 이미 그 역할). 이 사실을 단언하는 test 1+ (기존 케이스 보강 가능).
- [ ] **coverage** — `pnpm test:cov` 통과 (global line ≥ 80% / function ≥ 80%). `src/import/import.controller.ts` 의 line/branch/function 100% 를 **유지** (종전 수치에서 하락 0).
- [ ] **검증 명령** — `pnpm lint && pnpm build && pnpm test` 전부 green, `pnpm test:e2e` 로 `import-restore-http.e2e-spec.ts` green. tester 는 §3.2 R-110 의무 호출.
- [ ] **PR 절차** — feature branch `claude/T-1302-import-preview-mode-echo` → PR open → PR open 직후 `scripts/sync-claim-pr.sh T-1302 <PR번호> <owner>` 자체 호출 (executor 계약, T-1298) → reviewer → §3.3 4-게이트 PASS 후 squash merge. main 복귀는 `git pull --ff-only` (§9 — `git reset --hard` 금지).
- [ ] **언어 규율 (§12)** — 주석 · commit · PR 본문은 한국어, 식별자 · enum · route 는 영어.

## Out of Scope

- **문서 동기 0** — [api.md](../architecture/api.md) UC-07 표의 preview row 와 [UC-07](../use-cases/UC-07-export-import.md) §6.5 는 응답을 "`RestorePlanSummary` 를 wrapper 없이 그대로" 로 적고 있어 본 변경 후 drift 가 된다. 그러나 그 두 파일은 §3.1 상 `direct` 컬럼이라 **본 pr task 에 섞지 않는다** (rule 3 — 별도 direct doc task, Follow-ups 에 이월). T-1299→T-1301 과 같은 순서.
- **실행 경로(`POST /api/admin/import`) 응답 변경 0** — `restoreSummary` 안에 mode 를 넣거나 `CreateImportResponse` 를 손대지 않는다.
- **`RestorePlanSummary` 타입 자체 변경 0** — 요약 타입에 mode 를 넣으면 실행 응답까지 오염된다. mode 는 preview **응답 envelope** 에만.
- **service 층 변경 0** — `ImportRestoreService.previewFromDump` 시그니처·반환 타입 무수정 (`src/import/import-restore.service.ts` 0 수정). echo 는 controller 조립 책임.
- **web (frontend) 배선 0** — confirmation dialog 가 preview 를 호출/표시하는 것은 P6 축.
- **`dto.mode` 해석 위치 이동 0** — fallback 을 DTO default 나 service 로 옮기는 리팩터는 별건 (drift 지점 주석은 유지).
- **preview 응답에 다른 필드 추가 0** — `artifactRef` / 파일명 / 크기 / 타임스탬프 등을 함께 얹지 않는다. 본 slice 는 `mode` 한 key 만.
- **`daily-test.sh` leg 추가 0** — leg 추가는 drift-guard parity spec 3 종 동반 수정을 유발해 cap 을 깬다 (Q-0054 선례).
- **크기 초과 시** — 300 LOC 접근 시 negative (e) → (d) 순으로 축약하고 축약 내역을 PR body 에 박제한다 (T-1299 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 가 낳음) **api.md / UC-07 문서 동기** — preview 응답이 `RestorePlanSummary` + `mode` 임을 두 문서에 반영. direct-mode doc task.
- (T-1301 이월) api.md UC-07 표의 **잔여 drift** 보강 — export download (`GET /api/admin/export/:id/download`) · import 조회 3 종 (`GET /api/admin/import/running` · `/modes` · `/:id`) row 신설. direct-mode doc task.
- (T-1301 이월) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview + mode echo 로 실행 전 정보는 갖춰졌으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 → 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.
