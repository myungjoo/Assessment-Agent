---
id: T-1292
title: scope 반영 다운로드 e2e (PARTIAL / RANGE dump 가 실 DB·HTTP 경로에서 선별됨) + (g) 단언 협소화
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-28
independentStream: export-scope-materialization
dependsOn: [T-1291]
touchesFiles:
  - test/e2e/export-download.e2e-spec.ts
  - src/export/export-job.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 200 LOC / 2 파일. T-1291 배선의 실 DB 확증 + 이월 nit 협소화 동시 closure (test-only)"
---

# T-1292 — scope 반영 다운로드 e2e (PARTIAL / RANGE dump 가 실 DB·HTTP 경로에서 선별됨) + (g) 단언 협소화

## Why

[T-1291](T-1291-export-download-scope-select-wire.md) 이 `materializeFullExportDownload` 에 `selectExportRecords` 를 배선해 dump 가 job 의 scope (RANGE `dateRange` / PARTIAL `entitySelector`) 를 실제로 반영하게 했다. 다만 그 확증은 **mock delegate 기반 unit** 까지다 — job row 의 Prisma enum/Json 이 `buildScopePayload` → `coerceDateRange` 를 거쳐 lowercase payload 로 합성되고, 그 payload 가 실 PostgreSQL read 결과에 적용돼 **HTTP 응답 body 로 내려가는** 전 구간은 아직 e2e 사실이 아니다. [UC-07](../use-cases/UC-07-export-import.md) §6.1 이 박제한 Export 3 차원 옵션의 REQ-030 충족은 이 왕복이 실 DB 로 닫혀야 성립하며, R-113 (unit 외 e2e 도 CI 수행) 상으로도 배선 slice 뒤에는 e2e slice 가 따라붙는 것이 본 chain 의 관례다 ([T-1287](T-1287-import-restore-http-e2e.md) ~ [T-1289](T-1289-import-merge-mode-e2e.md) 동형).

특히 실 경로에만 있는 위험이 두 가지다: (1) 생성 시 body 의 `dateRange.start/end` 는 **ISO string** 인데 job row Json 으로 저장됐다가 다시 `new Date(...)` 로 coerce 돼야 `assertValidRange` 를 통과한다 — 이 coerce 사슬은 unit mock 이 우회한다. (2) `entityCounts` / `recordCount` 가 **선별 후** 기준이 되는지는 실 5 entity seed 위에서만 신뢰할 수 있다. 본 slice 는 기존 [export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) (T-0520, 부트스트랩·actor 재 seed·raw parse boilerplate 완비) 에 **덧붙이기** 로 이 둘을 닫는다 — 새 e2e 파일을 만들지 않아 boilerplate 소비가 0 이다.

덧붙여 [T-1291](T-1291-export-download-scope-select-wire.md) 이 PR #1182 의 insertion cap (+299/300) 에 닿아 이관한 **nit 1 건** 을 같은 commit 에서 닫는다: `export-job.service.spec.ts` 의 negative (g) 가 `.rejects.toThrow(TypeError)` 로만 단언해 **throw 지점이 고정되지 않는다** (상류 `buildFullExportRecord` 의 TypeError 로도 통과해버려 "선별 단계에서 잡힌다" 는 test 의 의도가 지켜지지 않는다). 메시지 regex 로 좁힌다.

**estimate 근거** — e2e 는 기존 파일에 `createExportJob` 인자화 (~5 LOC) + `downloadDump` 공용 parse helper (~20 LOC) + scope 별 seed helper (~25 LOC) + test 4~5 개 (~140 LOC), spec nit 은 1 줄 교체. base ~130, R-112 backbone × 1.5 → **~200 LOC / 2 파일** (cap 300 안, `sizeExempt` 불요).

## Required Reading

- [test/e2e/export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) 전체 (356 줄) — **본 task 의 주 변경 대상**. 특히 `beforeAll` 의 actor 2 종 seed (84~106 행) · `reseedActors` (116~118 행) · `afterEach` 정리 순서 (124~130 행) · `seedFiveEntities` (136~179 행) · `createExportJob` (183~191 행, 현재 `{ scope: "FULL" }` 하드코딩) · A.1 happy 의 supertest raw-parse 블록 (202~213 행 — `buffer(true)` + custom `parse`, StreamableFile 응답이 octet-stream 이라 기본 json parse 가 안 되는 이유).
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 의 `materializeFullExportDownload` (T-1291 배선 후 본문·머리 주석) 와 `createJob` (224~253 행 — scope invariant 위반 시 `BadRequestException` **400**). **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 의 `buildScopePayload` (282~298 행) + `coerceDateRange` (268~280 행) — job row 의 Prisma enum/Json → lowercase payload 합성 + ISO string → `Date` coerce. 본 e2e 가 실증하는 사슬. **0 수정**.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 의 `selectExportRecords` 3 분기 (full 전부 / range `[start, end)` **반열림** / partial `entitySelector` 멤버십 / range+selector AND) 와 `VALID_EXPORT_ENTITIES` (73~79 행: `Assessment` · `Person` · `Group` · `LlmConfig` · `AuditLog`) — e2e 가 넘길 selector 값의 정본. **0 수정**.
- [src/export/export-full-record-collect.ts](../../src/export/export-full-record-collect.ts) 의 `collectFullExportRecords` — entity 별 instant = 각 row 의 `createdAt` 이라는 사실 (RANGE 경계 seed 의 근거). **0 수정**.
- [src/export/export-job.service.spec.ts](../../src/export/export-job.service.spec.ts) 3002~3017 행 — negative (g) `"negative — dateRange 가 Invalid Date 면 선별 단계에서 TypeError 가 변환 없이 propagate"`. **본 task 의 두 번째 (그리고 유일한 그 파일의) 변경 지점**.
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model Person` (`email @unique`, `createdAt DateTime @default(now())`) · `model Group` (`name` 은 **unique 아님**) · `model ExportJob` (`dateRange Json?` / `entitySelector Json?`) — seed 시 P2002 회피 + `createdAt` 명시 지정 가능 근거. **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §6.1 — 본 e2e 가 실 사실로 닫는 계약.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `test/e2e/export-download.e2e-spec.ts` + `src/export/export-job.service.spec.ts` 만. 다른 `src/**` · `test/**` · `web/**` · `prisma/**` · `package.json` · `deploy/**` **0 수정**. **production 코드 0 LOC 변경** (본 slice 는 test-only).
- [ ] **기존 e2e 무회귀** — 기존 6 test 의 단언은 한 줄도 바꾸지 않는다. `createExportJob` 만 선택 인자화 (`createExportJob(body: Record<string, unknown> = { scope: "FULL" })`) 해 기존 호출부 (인자 없음) 가 그대로 동작하고, 새 tests 는 scope body 를 넘긴다. 응답 parse boilerplate 는 `downloadDump(jobId): Promise<Dump>` 공용 helper 로 뽑되 **기존 A.1 test 는 건드리지 않는다** (새 test 만 helper 사용).
- [ ] **happy — PARTIAL 선별 1+** — 5 entity 를 실 DB 에 seed (`seedFiveEntities` 재사용) 한 뒤 `POST /api/admin/export` 를 `{ scope: "PARTIAL", entitySelector: ["Group"] }` 로 호출해 job 생성 → `GET :id/download` 200. 응답 dump 의 `records` 가 **전부 `entity === "Group"`** 이고, `entityCounts.Group === 1`, 나머지 4 entity `=== 0`, `recordCount === 1`, `records[0].fields` 에 `name` 이 보존된다.
- [ ] **분기 cover — full / range / partial 각 1+** —
      (a) `FULL` — 기존 A.1 test 가 cover (5 entity 전부). 새로 추가하지 않는다.
      (b) `RANGE` — Person 3 row 를 `createdAt` 명시 지정으로 seed 한다 (`start - 1h` / `start` 정각 / `end` 정각; `email` 은 서로 다르게 해 P2002 회피). `{ scope: "RANGE", dateRange: { start: <ISO>, end: <ISO> } }` job 의 dump 는 **`start` 정각 row 만** 포함 (`recordCount === 1`) — `[start, end)` 반열림 (start 포함 · end 배타) 을 실 DB·ISO 왕복으로 실증한다.
      (c) `PARTIAL` — 위 happy 가 cover.
      (d) `RANGE` + `entitySelector` 동시 지정 → **AND** — 위 (b) seed 에 window 안 `Group` row 1 개를 더해 `{ scope: "RANGE", dateRange, entitySelector: ["Group"] }` 이면 window 안이면서 Group 인 1 건만 나온다.
- [ ] **선별 후 메타 일관성 1+** — 새로 추가한 어느 dump 든 `recordCount === records.length` 이고 `Object.values(entityCounts).reduce(+) === recordCount` 다 (metadata 와 body 가 같은 선별 기준을 본다).
- [ ] **error path 1+** — 존재하지 않는 job id 는 기존 B.1 이 404 로 cover 하므로 재작성하지 않는다. 대신 **생성 단계 게이트** 를 1+ 로 단언: `POST /api/admin/export` 를 `{ scope: "PARTIAL" }` (entitySelector 부재) 로 호출하면 `createJob` 의 `validateExportScope` verdict 로 **400** 이며 job row 가 만들어지지 않는다 (`prisma.exportJob.count() === 0`) — 즉 download 경로가 손상 scope 를 만날 실 경로 자체가 막혀 있음을 실증한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) `{ scope: "RANGE" }` (dateRange 부재) → **400** 생성 거부, (b) `{ scope: "RANGE", dateRange: { start, end } }` 에서 `start >= end` (역전) → **400** 생성 거부, (c) `{ scope: "PARTIAL", entitySelector: ["NotAnEntity"] }` (허용 외 entity) → **400** 생성 거부, (d) **선별 결과가 빈 배열** — Group row 가 하나도 없는 상태에서 `PARTIAL + ["Group"]` → error 가 아니라 **200** + `recordCount === 0` + `records []` + `entityCounts` 전부 0 인 정상 dump, (e) `PARTIAL + ["LlmConfig"]` 로 secret 보유 entity 만 선별해도 응답 body 전체에 `SEED_API_KEY` sentinel 이 **부재** 하고 `records[0].fields` 에 `apiKey` 키가 없다 (선별 배선이 상류 allow-list projection 을 우회하지 않음 — REQ-032 회귀), (f) 새 test 도 인증 축 회귀 확인 — PARTIAL job 의 download 를 **User 역할 쿠키** 로 호출하면 403 (RolesGuard tier 미달). (a)(b)(c) 는 400 이 세 갈래로 같은 shape 이라 `it.each` 로 묶어도 좋다 (LOC 절약).
- [ ] **(g) 단언 협소화 (이월 nit)** — `src/export/export-job.service.spec.ts` 3016 행의 `.rejects.toThrow(TypeError)` 를 `.rejects.toThrow(/selectExportRecords: dateRange\.start/)` 로 좁혀 **throw 지점이 선별 단계 (`assertValidRange`) 로 고정** 되게 한다. 메시지 정본은 [export-scope-select.ts](../../src/export/export-scope-select.ts) 88 행 (`selectExportRecords: ${label} 은(는) 유효한 Date instance 여야 합니다`, label = `dateRange.start`). 같은 test 의 다른 줄·다른 test 는 수정하지 않는다.
- [ ] **e2e 정리 규율 준수** — 새 test 도 기존 `afterEach` (exportJob → llmProviderConfig → assessment deleteMany → `truncateAll` → `reseedActors`) 에 그대로 얹는다. `afterEach` 순서·내용을 바꾸지 않는다 (actor User 재 seed 가 빠지면 다음 test 의 `createExportJob` 이 `ExportJob_requestedById_fkey` FK 위반으로 500 — T-0520 round 2 선례).
- [ ] **주석 (한국어, §12)** — 새로 추가하는 describe/helper 머리에 본 e2e 가 무엇을 실증하는지 (T-1291 배선의 실 DB·HTTP 확증, ISO → Json → Date coerce 사슬, `[start, end)` 반열림) 를 3~6 줄로 박제한다. 기존 파일 머리 주석에는 본 slice 가 추가한 scope 축 1~2 줄만 덧붙이고 기존 문장은 지우지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. CI 의 `pnpm test:e2e` step 이 green (본 spec 은 실 PostgreSQL 이 있는 CI 에서 실행 — `test/jest-e2e.json` 의 `testRegex` 가 이미 picking 하므로 설정 변경 0).
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 2 파일. 초과가 예상되면 (d) AND 분기 → (f) 403 회귀 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다.

## Out of Scope

- **production 코드 수정 0** — `src/export/**` 의 `.ts` (spec 제외) · `src/**` 전반 손대지 않는다. 본 slice 에서 e2e 가 결함을 드러내면 **고치지 말고** Follow-ups + PR body 에 박제하고 planner 에 보고한다 (patch 는 별도 task).
- **`readonly TRecord[]` 전환 0** — T-1290 round 1 MINOR A (defer 합의): `ExportSelection` 의 `selected`/`excluded` 가 가변 `TRecord[]` 라 TS 배열 공변 unsoundness 가 열려 있다. 소비처 3 곳 동반 수정이 필요해 본 slice 밖 (Follow-ups 유지).
- **MERGE cross-instance migration e2e 0** — 부분 dump 를 다른 인스턴스에 import 해 왕복시키는 UC-07 §6.2 시나리오는 **다음 slice**. 본 task 는 다운로드 측 선별 사실까지만.
- **새 e2e 파일 신설 0** — 기존 `export-download.e2e-spec.ts` 에 덧붙인다 (boilerplate 재사용 = LOC 절약이 본 slice 의 cap 근거).
- **`preview-selection` / `describe-scope` endpoint e2e 0** — 이미 별도 계약이고 본 배선과 무관.
- **`selectExportRecords` throw 의 HTTP status 재매핑 0** — RangeError → 500 유지 (Follow-ups 의 정책 판단 대상).
- **smoke 추가 0**, **새 ADR · Prisma schema/migration · 새 외부 dependency · `web/` UI 수정 0**.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice, 본 chain) **부분 dump + MERGE cross-instance migration e2e** (UC-07 §6.2) — `PARTIAL(entitySelector=[...])` 로 다운로드한 dump 를 MERGE mode 로 import 해 **선별된 entity 만** 이동하고 기존 데이터가 보존되는지 실 DB 로 닫는다. 본 slice 가 "부분 dump 가 실제로 부분" 임을 확증하므로 그 위에서 성립한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 (`export-dump-size-estimate.ts` · `export-selection-summary.ts` · `export-job.service.previewSelection` · materialize 경로) 동반 수정 필요. 현 실 피해 0 (소비처 전부 read-only) 이라 우선순위 낮음.
- (T-1291 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 본 task 의 error-path 단언대로 생성 단계가 막고 있어 정상 경로에서는 도달 불가하나, 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계 (10 bytes 상한) 로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (미해결 정책, T-1287 → T-1291 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 운영 dump 에 그 entity 가 1 건이라도 있으면 REPLACE / MERGE 어느 mode 든 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책 (해당 entity skip / 재입력 요구 / 부분 실패 안내) 은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상** — driver 가 `humanQuestion` 으로 escalate 하는 것이 적절하다.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
