---
id: T-1300
title: import preview 실 HTTP 왕복 e2e — preview 수치 ↔ 실행 restoreSummary 일치 + DB write 0 (e2e slice 3c-5c)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1299]
touchesFiles:
  - test/e2e/import-restore-http.e2e-spec.ts
plannerNote: "cap-bend 없음: e2e-only x1.3 = 약 280 LOC / 1 파일. T-1299 Follow-up 1 (3c-5c) — preview 계약을 실 HTTP 사실로 박제"
---

# T-1300 — import preview 실 HTTP 왕복 e2e (e2e slice 3c-5c)

## Why

[T-1299](T-1299-import-preview-endpoint.md) (머지 `5ca07860`) 가 `POST /api/admin/import/preview` 를 배선해 **복원을 실행하지 않고 영향 요약만** 내는 HTTP entry 를 열었다. 그러나 그 계약 — (a) preview 수치가 **실행 후** `restoreSummary` 와 같다, (b) preview 요청은 **DB 를 한 row 도 바꾸지 않는다** (`ImportJob` row 도 안 남는다) — 은 아직 controller unit + supertest **모듈 단위** 로만 증명돼 있다. 실 PostgreSQL 위의 export → download → preview → 실행 왕복은 한 번도 돌지 않았다.

본 slice 는 그 왕복을 [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 의 **section G** 로 박제한다. 같은 dump 를 preview 로 한 번, 실행으로 한 번 올려 두 요약이 **정확히 일치** 하는지 (preview 가 DB 를 안 바꿨으니 실행 시 plan 이 동일해야 성립한다 — 두 계약이 한 단언으로 함께 묶인다) 확인하고, preview 만 보낸 경우 entity row 수 · `ImportJob` row 수가 그대로임을 실 DB 조회로 확인한다. 이것이 [UC-07](../use-cases/UC-07-export-import.md) §5 sequence 64 행 confirmation 의 "영향 범위" 가 실사용에서 신뢰 가능한 수치라는 마지막 증거다.

**estimate 근거** — `uploadPreview` helper + section 머리 주석 ~40 LOC, e2e 케이스 6 종 × ~30 LOC ~ 180 → base ~220, e2e-only × 1.3 → **~280 LOC / 1 파일** (cap 300 / 5 안, `sizeExempt` 불요). 파일 1 개라 파일 수 여유는 크고 LOC 만 빠듯하므로 아래 Acceptance Criteria 의 trim 순서를 반드시 지킨다.

## Required Reading

- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) — **본 task 의 유일한 변경 대상**. 재사용할 것: 106 행 describe 의 `beforeAll` (`createAuthenticatedE2EApp([{ role: "Admin", ... }])`), 129 행 `afterEach` 정리 순서 (`importJob.deleteMany` → `exportJob.deleteMany` → `truncateAll` → `reseedAuthenticatedActors` — **actor User FK 재 seed 순서를 절대 바꾸지 않는다**), 139 행 `seedRestorableEntities`, 153 행 `createExportJob`, 167 행 `downloadDump`, 184 행 `uploadDump`, 195 행 `recordCountOf`, 200 행 `counts`. 기존 section A~F 의 상수 (`ADMIN_EMAIL` / `IMPORT_BASE` / `EXPORT_BASE` / sentinel dump 본문) 도 그대로 쓴다 — **새 harness · 새 describe 파일 신설 0**.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 259~300 행 (`preview` 핸들러) — 검증 대상 계약 정본. 특히 (a) `@Post("preview")` 라 성공 응답은 **201** (`@HttpCode` 미사용), (b) `dto.mode ?? ImportMode.REPLACE` fallback, (c) 반환은 `RestorePlanSummary` **그대로** (wrapper 0), (d) `createJob` · `runJob` 미호출. **0 수정**.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 23~38 행 — 응답 shape (`deleted` / `inserted` / `kept` 각각 `{ total, perEntity }`). 단언이 이 구조를 그대로 따른다. **0 수정**.
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 의 `previewFromDump` 헤더 주석 — 거부 verdict → `BadRequestException`, `$transaction` 미개시. **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 sequence 64 행 + §7.4 — 본 e2e 가 증명하는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 1 개** — `test/e2e/import-restore-http.e2e-spec.ts` **만**. `src/**` · `test/e2e/` 의 다른 파일 · `test/smoke/**` · `test/perf/**` · `deploy/**` · `prisma/**` · `package.json` · `docs/**` **0 수정**.
- [ ] **section G 신설** — 기존 파일 머리 주석 (37 행 section E / 48 행 section F 형식) 에 이어 **section G (T-1300, preview dry-run)** 항목을 한 단락 추가하고, 기존 describe **안** 에 `// -- G. preview dry-run ...` 구분선 + 케이스들을 둔다. 기존 section A~F 의 `it` 본문 · 단언 · 상수는 **한 줄도 수정하지 않는다** (수정이 필요해지면 회귀 신호 — 멈추고 PR body 에 기록).
- [ ] **`uploadPreview` helper 1 개 추가** — `uploadDump` 와 같은 형식 (`mode` 미지정 시 field 자체를 보내지 않음) 이되 `POST ${IMPORT_BASE}/preview` 로 향한다. 기존 `uploadDump` 는 **무수정**, 문자열 리터럴 사본 대신 `IMPORT_BASE` 를 재사용한다.
- [ ] **happy-path (G1) — preview ↔ 실행 일치** — seed → `createExportJob()` → `downloadDump` → Group row 1 건 실삭제 → `uploadPreview(dump, "REPLACE")` 가 **201** 이고 body 가 `{deleted, inserted, kept}` 3 그룹 각각 `{total, perEntity}` 를 갖는다 (`inserted.total === recordCountOf(dump)`). 이어서 **같은 dump** 를 `uploadDump(dump, "REPLACE")` 로 실행하고, 실행 응답의 `restoreSummary` 가 preview body 와 **`toEqual` 로 정확히 일치** 함을 단언한다 (preview 가 DB 를 안 바꿨다는 사실과 수치 일치가 이 한 단언에 함께 묶인다).
- [ ] **happy-path (G2) — MERGE mode** — 같은 왕복을 `"MERGE"` 로 한 번 더. `kept.total` 이 0 이 아님 (기존 row 보존이 수치에 실제로 반영) + 실행 응답 `restoreSummary` 와 `toEqual` 일치.
- [ ] **분기 cover (G3) — mode 미지정** — `uploadPreview(dump)` (form 에 `mode` field 자체 없음) 응답이 `uploadPreview(dump, "REPLACE")` 응답과 `toEqual` 로 동일함을 단언한다. 이것이 controller 의 `?? ImportMode.REPLACE` fallback 이 schema `@default(REPLACE)` 를 실제로 mirror 한다는 **실 HTTP 증거** 다 (drift 시 본 케이스가 깨진다 — 그 의도를 한국어 주석으로 박제).
- [ ] **DB write 0 (G4)** — preview 만 1~2 회 보낸 뒤 (a) `counts()` 가 preview 직전 값과 **완전히 동일**, (b) `prisma.importJob.count()` 가 **0**, (c) `prisma.exportJob.count()` 가 preview 전후 동일 (export job 은 dump 생성분 그대로). G1 안에 합쳐도 되고 별 케이스로 둬도 된다 — 다만 (b) `importJob.count() === 0` 단언은 **반드시 존재** 해야 한다 (job row 미생성이 본 slice 의 핵심 계약).
- [ ] **error path (G5) — 손상 dump 400 + raw 미노출** — 파싱 불가 본문 (기존 sentinel 상수 재사용) 을 preview 로 업로드하면 **400** 이고, 응답 body 를 문자열화했을 때 sentinel 문자열이 **포함되지 않으며** (REQ-032 raw 미저장/미노출), 그 요청 뒤에도 `counts()` 무변화 + `importJob.count() === 0`.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) **파일 미첨부** preview → 400 이고 DB 무변화, (b) **미인증** (Cookie 미설정) preview → **401** 이고 `importJob.count() === 0` (guard 가 파일 파싱 전에 차단), (c) G5 의 손상 dump 400. 위 3 종은 필수. 여력이 있으면 (d) `CreateImportDto` 에 없는 form field 를 실은 요청이 `forbidNonWhitelisted` 로 400 을 추가한다 — **LOC 초과 시 (d) 를 가장 먼저 덜어내고** 그 사실을 PR body + 본 task Follow-ups 에 박제한다.
- [ ] **정리 규율 준수** — 새 케이스도 기존 `afterEach` 에 전적으로 의존한다 (케이스 안에서 `truncateAll` 직접 호출 0 · actor 재 seed 직접 호출 0). 새 seed 가 필요하면 `seedRestorableEntities` 를 호출하고 새 seed 함수를 만들지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 slice 는 production 코드 0 수정이므로 coverage 수치는 **종전과 동일해야** 한다 (하락 시 회귀 신호).
- [ ] `pnpm test:e2e` 통과 — 신규 section G 포함 전체 e2e green. `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 1 파일. 초과 예상 시 trim 순서는 negative (d) → G2 의 `restoreSummary` 재왕복 (수치 단언만 남김) 순. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **하류 결함 발견 시 수정 금지** — e2e 작성 중 controller · `previewFromDump` · runner 쪽 결함이 드러나면 (예: preview 와 실행 수치 불일치) 그 파일들을 **고치지 말고** 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉). 그 불일치야말로 본 slice 가 잡으려던 결함이다.

## Out of Scope

- **production 코드 0 수정** — `src/**` 를 열지 않는다. 본 slice 는 순수 검증 layer.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).
- **문서 동기 0** — [docs/architecture/api.md](../architecture/api.md) · UC-07 에 preview endpoint 계약을 적는 것은 별도 direct-mode doc task (§3.1 rule 3).
- **web (frontend) 배선 0** — confirmation dialog 가 preview 를 호출하도록 바꾸는 것은 P6 축.
- **새 e2e 파일 신설 0** — 기존 `import-restore-http.e2e-spec.ts` 에 section 을 더한다 (harness 중복 조립 회피). `import-restore-rejection` / `import-restore-transaction` spec 도 0 수정.
- **크기 상한 413 e2e 0** — 50 MiB 초과 업로드 검증은 별건 (Follow-ups 유지, supertest mid-stream abort 표면화 선행 확인 필요).
- **응답 shape 변경 · mode echo 추가 0** — preview 응답에 해석된 mode 를 실을지는 별도 slice (Follow-ups).
- **REPLACE 비선별 삭제 차단 / 경고 정책 구현 0** — 제품 결정 (Follow-ups 유지).
- **새 외부 dependency · 새 ADR 0**.

## Suggested Sub-agents

`tester → implementer` (본 slice 는 test-only — tester 가 주도하고 필요 시 implementer 는 harness 정리만)

## Follow-ups

- (본 slice 가 낳음) api.md / UC-07 §5 에 preview endpoint 계약 (route · RBAC · 요청 multipart · 응답 `RestorePlanSummary` · DB write 0) 문서 동기 — direct-mode doc task.
- (T-1299 이월) preview 응답에 **해석된 mode 를 echo** 할지 판단 — `mode` 미지정 시 client 는 어떤 mode 기준 수치인지 알 수 없다. shape 확장이라 별도 slice.
- (유지, T-1293~T-1299) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview 로 실행 전 수치는 보이게 됐으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1299 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → T-1299 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
