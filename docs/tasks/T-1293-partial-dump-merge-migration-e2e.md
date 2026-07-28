---
id: T-1293
title: 부분 dump + MERGE cross-instance migration e2e (UC-07 §6.2 조합 계약, 실행 slice 3c-3d5)
phase: P5
status: DONE
completedAt: 2026-07-28T22:54:45Z
prNumber: 1184
mergeCommit: d2f976b1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 200
estimatedFiles: 1
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1292]
touchesFiles:
  - test/e2e/import-restore-http.e2e-spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 200 LOC / 1 파일. T-1292 가 '부분 dump 는 진짜 부분' 을 닫아 성립한 §6.2 조합 slice (test-only)"
---

# T-1293 — 부분 dump + MERGE cross-instance migration e2e (UC-07 §6.2 조합 계약, 실행 slice 3c-3d5)

## Why

[UC-07](../use-cases/UC-07-export-import.md) §6.2 (107 행) 는 **"부분 dump (§6.1) + merge mode 의 조합으로 staging seed / cross-instance migration 시나리오 가능"** 을 REQ-030 계약으로 박제한다. 이 문장은 두 축이 모두 실 사실이어야 성립하는데, 그동안은 성립 자체가 불가였다 — [T-1289](T-1289-import-merge-mode-e2e.md) (slice 3c-3d4) 가 MERGE 보존 축을 닫았을 때 다운로드 dump 는 scope 와 무관하게 **항상 5 entity 전부** 였기 때문이다 (`materializeFullExportDownload` 가 선별 미적용). [T-1291](T-1291-export-download-scope-select-wire.md) 이 그 배선을 넣고 [T-1292](T-1292-export-scope-download-e2e.md) 가 "PARTIAL dump 는 실제로 부분" 을 실 DB·HTTP 사실로 닫은 지금, 비로소 **부분 dump 를 그대로 import 측에 물려** 조합 계약을 실 왕복으로 증명할 수 있다 (T-1292 Follow-ups 1 번 항목이 예고한 바로 그 slice).

증명 가치가 큰 이유는 두 mode 의 결과가 **부분 dump 에서 극적으로 갈리기** 때문이다. [import-restore.service.ts](../../src/import/import-restore.service.ts) 54~58 행은 기존 record 를 `collectFullExportRecords(prisma)` 로 읽는데 이는 **DB 전체 5 entity** 다. 따라서 dump 가 Group 만 담은 부분 dump 여도 REPLACE 의 `toDelete` 는 **기존 전부** — dump 에 없는 Person 까지 지운다. 반대로 MERGE 는 비충돌 기존을 `toKeep` 으로 남겨 Person 을 보존한다. 즉 §6.2 가 말하는 migration 이 **MERGE 와 조합해야만** 성립한다는 것이 현행 구현의 실 계약이며, 본 e2e 는 같은 부분 dump 에 mode 만 바꿔 그 갈림을 외부 사실로 남긴다. 이 대조가 없으면 "부분 dump 를 REPLACE 로 올리면 나머지 entity 가 조용히 증발" 하는 회귀·오용을 잡을 그물이 어디에도 없다.

본 slice 는 기존 [import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) (439 줄) 에 **section F 를 덧붙이는 amend** 다 — 부트스트랩·actor 재 seed·업로드/다운로드 helper 가 이미 그 파일 closure 에 있어 boilerplate 를 한 줄도 다시 쓰지 않는다.

**estimate 근거** — `createExportJob` 선택 인자화 (~5 LOC) + 부분 dump fixture helper 1 개 (~30) + test 4~5 개 (~135) + 머리 주석 amend (~15) → base ~130, R-112 backbone × 1.5 → **~200 LOC / 1 파일** (cap 300 안, `sizeExempt` 불요). 선례 T-1289 실측 (~170 LOC / 1 파일, 같은 파일 amend) 과 동형.

## Required Reading

- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 전체 (439 줄) — **본 task 의 유일한 변경 대상**. 재사용할 closure helper: `seedRestorableEntities()` (118 행, Group 1 + Person 1 을 심고 DB row 를 그대로 반환), `createExportJob()` (130 행 — 현재 `{ scope: "FULL" }` **하드코딩**, 본 task 가 선택 인자화한다), `downloadDump(jobId)` (142 행, StreamableFile raw parse → Buffer), `uploadDump(dump, mode?)` (159 행, multipart + `mode` form field), `recordCountOf(dump)` (170 행), `counts()` (175 행 — `group` / `person` 수), `seedGroupAbsentFromDump()` (298 행), `arrangeMergeFixture()` (311 행). `afterEach` (108~113 행) 의 job 삭제 → `truncateAll` → `reseedAuthenticatedActors` 순서와 머리 주석의 seed 제약 (secret 보유 entity 미 seed) 을 그대로 따른다.
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 50~60 행 — 기존 record 를 `collectFullExportRecords` 로 **DB 전체 5 entity** 읽어 `prepareImportRestorePlan(buffer, existing, mode)` 에 넘긴다. **본 e2e 의 대조 축 근거** (부분 dump 여도 REPLACE 의 삭제 범위는 기존 전부). **0 수정**.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 의 plan 계약 주석 (44~55 행) 과 `conflictKey` (74~76 행) — replace: `toDelete` = 기존 전부 / `toKeep` 빈 배열, merge: 충돌하는 기존만 `toDelete` + 비충돌은 `toKeep`. 충돌 key 는 `(entity, instant millis)` 이므로 보존 대상 row 의 시각을 **명시 고정 상수** 로 심어야 간헐 실패가 없다 (T-1289 선례). **0 수정**.
- [src/import/import-restore-delete-where.ts](../../src/import/import-restore-delete-where.ts) — delete step 의 `where` 가 `{ <instantColumn>: { in: Date[] } }` 형태. **0 수정**.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 의 `VALID_EXPORT_ENTITIES` (73~79 행: `Assessment` · `Person` · `Group` · `LlmConfig` · `AuditLog`) — `entitySelector` 에 넣을 값의 정본. **0 수정**.
- [test/e2e/export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) 의 T-1292 추가분 (section C 이후) — PARTIAL job 생성 body shape (`{ scope: "PARTIAL", entitySelector: ["Group"] }`) 과 부분 dump 의 `entityCounts` / `recordCount` 단언 형식. **참고용, 0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §6.2 (105~107 행) — 본 e2e 가 실 사실로 닫는 계약 정본.
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model Group` (`name` 은 unique 아님, `createdAt @default(now())` — 명시 지정 시 override) · `model Person` (`email @unique` — seed 시 P2002 회피). **0 수정**.

## Acceptance Criteria

- [ ] **변경 파일 1 개** — `test/e2e/import-restore-http.e2e-spec.ts` 에 **section F 를 덧붙인다**. `src/**` · `web/**` · `prisma/**` · `scripts/**` · `deploy/**` · `package.json` · `test/jest-e2e.json` · 다른 `test/**` 파일 **0 수정**. **production 코드 0 LOC 변경** (본 slice 는 test-only).
- [ ] **기존 test 무회귀** — 기존 section A~E 8 개 test 의 단언 · `beforeAll` / `afterEach` 본문 · 기존 helper 본문은 한 줄도 바꾸지 않는다. 예외는 `createExportJob` 의 **선택 인자화** 하나뿐: `createExportJob(body: Record<string, unknown> = { scope: "FULL" })` 로 바꿔 기존 호출부 (인자 없음) 는 그대로 동작하고 section F 만 scope body 를 넘긴다 (T-1292 가 export e2e 에서 쓴 형식 그대로).
- [ ] **부분 dump fixture helper 1 개** — MERGE / REPLACE 두 test 가 공유할 **동일 출발 상태** 를 만드는 helper (예: `arrangePartialDumpFixture()`) 를 추가한다: (1) `seedRestorableEntities()` 로 Group G1 + Person P1 seed → (2) `createExportJob({ scope: "PARTIAL", entitySelector: ["Group"] })` + `downloadDump` 로 **부분 dump** 획득 → (3) 부분성 확정 단언 — `recordCountOf(dump) === 1` 이고 dump 의 `records` 가 전부 `entity === "Group"` → (4) G1 삭제 (`group.count() === 0`), **P1 은 그대로 둔다** (dump 에 없는 비선별 entity 의 보존 여부가 본 slice 의 관측 대상). helper 는 `{ dump, group, person }` 를 반환한다.
- [ ] **happy — 부분 dump + MERGE 가 migration 으로 성립한다 1+** — 위 fixture 에 `uploadDump(dump, "MERGE")`. 단언: 응답 **201** + `status === "SUCCEEDED"` + `mode === "MERGE"` + **G1 이 동일 id 로 부활** (`name` 도 seed 값) + **P1 이 그대로 살아 있음** (`id` · `email` · `createdAt` 전부 seed 값) + `group.count() === 1` + `person.count() === 1`. 실 DB 의 `ImportJob` row 도 `mode === "MERGE"` 다.
- [ ] **분기 cover — 같은 부분 dump 에 REPLACE 를 보내면 비선별 entity 가 사라진다 1+** — fixture 를 동일하게 만든 뒤 `uploadDump(dump, "REPLACE")`. 단언: 응답 201 + SUCCEEDED 이면서 **`person.count() === 0`** (dump 에 없는 Person 이 삭제됨 — 기존 record 를 DB 전체에서 읽는 현행 계약) + `group.count() === 1`. 이 test 와 위 happy 가 **같은 입력 · mode 만 다름** 이어야 §6.2 의 "부분 dump 는 merge 와 조합" 문장이 실 사실로 박제된다. 주석에 "본 test 는 현행 계약을 박제할 뿐 바람직함을 주장하지 않는다 (정책 판단은 Follow-ups)" 를 한국어로 1~2 줄 남긴다.
- [ ] **분기 cover — 선별 결과가 빈 부분 dump 1+** — Group row 가 하나도 없는 상태 (Person P1 만 seed) 에서 `{ scope: "PARTIAL", entitySelector: ["Group"] }` job 의 dump 는 `recordCount === 0` 인 정상 dump 다 (T-1292 가 export 측에서 닫은 사실). 이 dump 를 **MERGE** 로 업로드하면 응답 201 + SUCCEEDED + `restoredRowCount === 0` + **P1 무손상** (`person.count() === 1`) — 빈 dump 가 wipe 로 흐르지 않음을 확인한다.
- [ ] **error path 1+** — 부분 dump 를 **손상시킨 본문** (유효하지 않은 JSON, 고유 sentinel 문자열 포함) 을 `MERGE` 로 업로드하면 (a) 응답 **400**, (b) job row `status === "FAILED"` + `mode === "MERGE"` + `restoredRowCount === null`, (c) **Group / Person row 수가 요청 전과 동일** (`counts()` 비교 — 거부는 `$transaction` 이전 단락, UC-07 §7.4).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 위 error 응답 · `job.error` 어디에도 업로드 raw sentinel 과 그 **접두 조각** 이 없다 (REQ-032, section E 의 형식 그대로), (b) MERGE 성공 시 `restoredRowCount` 가 **부분 dump 의 record 수 (= 1) 와 정확히 일치** 하고 보존된 P1 을 합산하지 않는다 (`toBe` 정확 일치 — 상한 단언 금지), (c) 보존된 P1 의 `createdAt` 이 요청 전후로 **동일** 하다 (보존이 "삭제 후 재삽입" 이 아니라 진짜 손대지 않음), (d) 요청 1 회당 `ImportJob` row 는 정확히 1 건 (중복 job 0 — 성공·거부 양쪽에서 확인).
- [ ] **e2e 정리 규율 준수** — 새 test 도 기존 `afterEach` (`importJob`/`exportJob` 삭제 → `truncateAll` → `reseedAuthenticatedActors`) 에 그대로 얹는다. `afterEach` 순서·내용을 바꾸지 않는다 (actor User 재 seed 가 빠지면 다음 test 의 job 생성이 `requestedById` FK 위반으로 500 — T-0520 round 2 선례).
- [ ] **머리 주석 amend** — 파일 머리 주석 끝에 본 slice (3c-3d5) 가 추가하는 section F 의 책임을 **한국어** (§12) 로 3~6 줄 덧붙인다: (1) T-1291/T-1292 로 부분 dump 가 실제 부분이 된 뒤에야 §6.2 조합 계약이 성립한다는 전제, (2) 기존 record 를 DB 전체에서 읽기 때문에 부분 dump + REPLACE 가 비선별 entity 까지 지운다는 대조 축, (3) 같은 dump 에 mode 만 바꾸는 구성이 회귀 그물이라는 점. 기존 머리 주석 문장은 지우지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. 본 spec 은 CI 의 `pnpm test:e2e` step 에서 실 PostgreSQL 위로 실행되며 (`test/jest-e2e.json` 의 `testRegex` 가 이미 picking — 설정 변경 0), PR CI 의 e2e leg 가 green 이어야 한다.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 1 파일. 초과가 예상되면 "빈 부분 dump" 분기 → negative (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 결함 발견 시 수정 금지** — 복원 경로에서 결함 (예: MERGE 인데 P1 이 삭제됨 · createMany PK 충돌 P2002 · 부분 dump 가 plan 단계에서 거부됨) 이 드러나면 `src/**` 를 고치지 말고 재현 조건 (seed · dump · 응답 · DB 상태) 을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **`src/**` 수정 0** — controller · runner · restore service · plan helper · export 선별 helper 전부 불변. 부분 dump + REPLACE 의 비선별 entity 삭제가 사용자 의도와 어긋나 보여도 **본 slice 에서 정책을 바꾸지 않는다** (Follow-ups 의 정책 판단 대상).
- **RANGE scope + import 조합 e2e 0** — RANGE 선별 자체는 T-1292 가 export 측에서 닫았고, 조합 계약은 entity 축 (PARTIAL) 하나로 충분히 대조된다. 추가 축은 LOC 만 늘린다.
- **`LlmConfig` (LlmProviderConfig) · `Assessment` · `AuditLog` seed 0** — `LlmConfig` 는 full-record select 가 `apiKey` 를 명시 deny (ADR-0047 §Decision2) 하는데 schema 의 `apiKey` 는 not-null 이라 재삽입이 깨질 것이 예상되는 **미해결 정책 표면** 이다 (Follow-ups). 나머지 2 종도 T-1287~T-1289 와 동일하게 범위 밖.
- **크기 상한 413 e2e 0** — slice 3c-3d3 으로 그대로 유지 (Follow-ups). 본 slice 는 대용량 버퍼를 만들지 않는다.
- **conflict resolution 알고리즘 확장 0** — "file 우선" 외의 정책 (timestamp 비교 · dedupe · reject mode) 은 UC-07 §6.2 가 별도로 남긴 영역.
- **새 e2e 파일 신설 0** — 기존 `import-restore-http.e2e-spec.ts` 에 덧붙인다 (boilerplate 재사용 = 본 slice 의 cap 근거).
- **`readonly TRecord[]` 전환 0** — T-1290 round 1 MINOR A (defer 합의) 는 소비처 3 곳 동반 수정이라 본 slice 밖 (Follow-ups 유지).
- **smoke 추가 0**, **새 ADR · Prisma schema/migration · 새 외부 dependency · `web/` UI 수정 0**.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 가 새로 드러내는 정책 판단) **부분 dump + REPLACE 의 비선별 entity 삭제** — 사용자가 "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. UI confirmation dialog 의 영향 범위 표시 (UC-07 §5) 가 이 사실을 노출하는지, 혹은 부분 dump 에는 REPLACE 를 막거나 경고해야 하는지는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계 (10 bytes 상한) 로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 (`export-dump-size-estimate.ts` · `export-selection-summary.ts` · `export-job.service.previewSelection` · materialize 경로) 동반 수정 필요. 현 실 피해 0 (소비처 전부 read-only) 이라 우선순위 낮음.
- (T-1291 → T-1292 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 생성 단계 게이트가 막고 있어 정상 경로에서는 도달 불가하나, 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1292 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 운영 dump 에 그 entity 가 1 건이라도 있으면 REPLACE / MERGE 어느 mode 든 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책 (해당 entity skip / 재입력 요구 / 부분 실패 안내) 은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
