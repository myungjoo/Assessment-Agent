---
id: T-1289
title: import MERGE mode 실 DB 왕복 e2e (보존 vs 전면교체 분기, 실행 slice 3c-3d4)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 1
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1288]
touchesFiles:
  - test/e2e/import-restore-http.e2e-spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 170 LOC / 1 파일. T-1288 Follow-up 의 MERGE slice — 기존 e2e 의 export 왕복 helper 재사용이라 boilerplate 0"
---

# T-1289 — import MERGE mode 실 DB 왕복 e2e (보존 vs 전면교체 분기, 실행 slice 3c-3d4)

## Why

[T-1287](T-1287-import-restore-http-e2e.md) (slice 3c-3d1) 이 성공 복원 왕복을, [T-1288](T-1288-import-http-rejection-e2e.md) (slice 3c-3d2) 이 거부 경계를 실 HTTP + 실 PostgreSQL 사실로 박제했다. 그러나 **두 slice 모두 `mode = REPLACE` 만** exercise 한다 (T-1287 의 mode 생략 test 도 schema `@default(REPLACE)` 확정값을 확인할 뿐이다). `ImportMode.MERGE` 는 `prepareImportRestorePlan` 의 매핑표 · `buildImportRestorePlan` 의 merge 분기 · `buildImportRestoreDeleteWhere` 의 **targeted delete** 를 지나 실제 `$transaction` 까지 흐르는 별도 경로인데, 그 경로가 실 DB 위에서 **정말 기존 비충돌 row 를 보존하는지** 증명한 test 는 0 이다 (`grep "MERGE" test/e2e/` 결과 helper 시그니처 2 건뿐).

본 slice 는 [UC-07](../use-cases/UC-07-export-import.md) §6.2 가 박제한 계약 — **replace = 기존 전부 삭제 후 snapshot 재구성 / merge = 기존 row 보존 + file row 추가, conflict 시 file 우선** — 을 같은 seed · 같은 dump 에 mode 만 바꿔 두 결과가 **실제로 다르다** 는 외부 사실로 닫는다. 이는 REQ-030 의 mode 분기가 UI 옵션 이름만이 아니라 DB 결과로 구분됨을 증명하는 유일한 층이고, targeted delete 가 과삭제 (전면 삭제로 흘러 REPLACE 와 같아짐) 하는 회귀를 잡는 그물이다.

**slice 3c-3d3 (413 크기 상한) 은 한 turn 미룬다** — T-1288 Follow-ups 가 예고한 대로 50 MiB 초과 업로드는 supertest 의 mid-stream abort 취급 (ECONNRESET / EPIPE) 이라는 flakiness 표면을 먼저 확인해야 하고, flaky e2e 를 CI 에 넣는 비용이 본 MERGE 계약 검증을 미루는 비용보다 크다. 3c-3d3 은 본 task Follow-ups 에 그대로 유지된다.

**estimate 근거** — 기존 e2e 1 파일에 **section E 를 덧붙이는 amend** 다. `createExportJob` / `downloadDump` / `uploadDump(dump, "MERGE")` / `counts` / `seedRestorableEntities` 가 이미 그 파일 closure 에 있어 e2e 부트스트랩 boilerplate (~150 LOC) 를 **한 줄도 다시 쓰지 않는다**. 머리 주석 amend ~20 + 신규 helper 1 개 (~15) + test 4 종 (~130) → **~170 LOC / 1 파일** (cap 300 안, `sizeExempt` 불요). R-112 backbone × 1.5 카테고리, 선례 T-1287 실측 270 LOC (그쪽은 boilerplate 포함).

## Required Reading

- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 전체 (T-1287, 270 줄) — **본 task 의 유일한 변경 대상**. 재사용할 closure helper: `seedRestorableEntities()` (Group 1 + Person 1), `createExportJob()`, `downloadDump(jobId)`, `uploadDump(dump, mode?)` (이미 `"MERGE"` 를 받는다), `recordCountOf(dump)`, `counts()`. `afterEach` 의 job 삭제 → `truncateAll` → `reseedAuthenticatedActors` 순서와 머리 주석의 seed 제약 (secret 보유 entity 미 seed) 을 그대로 따른다.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 의 `buildImportRestorePlan` merge 분기 (30~53 행 주석 + 141 행 이후) — merge 는 **incoming 과 충돌하는 기존만** `toDelete`, incoming 전부 `toInsert`, **비충돌 기존은 `toKeep`** (삭제도 재삽입도 안 함). 충돌 판정 key 는 `(entity, instant)` 이며 instant 는 각 entity 의 시각 컬럼이다 — 그래서 dump 에 없는 기존 row 를 만들 때 **instant 를 dump 의 어떤 값과도 겹치지 않게 명시 지정** 해야 판정이 결정적이다. **0 수정**.
- [src/import/import-restore-delete-where.ts](../../src/import/import-restore-delete-where.ts) — delete step 의 `where` 가 `{ <instantColumn>: { in: Date[] } }` 형태라는 사실. merge 의 targeted delete 가 이 `in` 목록에 **보존 대상 instant 를 넣지 않는다** 는 것이 본 e2e 의 핵심 단언 대상이다. **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §6.2 (105~107 행) — mode 계약의 정본 (replace = 전부 삭제 후 재구성 / merge = 보존 + 추가, conflict 시 file 우선).
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model Group` — 보존 대상 row 를 만들 때 `createdAt` 을 명시 값으로 넣을 수 있는지 확인용 (`@default(now())` 는 명시 지정 시 override 된다).

## Acceptance Criteria

- [ ] **변경 파일 1 개** — `test/e2e/import-restore-http.e2e-spec.ts` 에 section E 를 **덧붙인다**. `src/**` · `web/**` · `prisma/**` · `scripts/**` · `deploy/**` · `package.json` · `test/jest-e2e.json` · 다른 `test/**` 파일 **0 수정**. 기존 test A~D 의 단언 · 기존 helper 시그니처 · `beforeAll` / `afterEach` 본문은 **변경 0** (추가만).
- [ ] **보존 대상 seed helper** — dump 에 들어가지 않는 기존 Group 1 건을 만드는 helper (예: `seedGroupAbsentFromDump()`) 를 추가한다. 이 row 의 `createdAt` 은 **명시 고정값** (예: dump 생성 시각보다 확실히 이전인 상수 Date) 으로 지정해 dump 안 어떤 record 의 instant 와도 겹치지 않게 한다 — 같은 밀리초 충돌로 test 가 간헐 실패하는 경로를 원천 차단한다. helper 는 DB 가 돌려준 row 를 그대로 반환한다.
- [ ] **happy — MERGE 가 비충돌 기존 row 를 보존한다 1+** — (1) `seedRestorableEntities()` 로 Group G1 + Person P1 seed → (2) export + download 로 실 dump 획득 (`recordCountOf` 는 2) → (3) G1 을 삭제하고 dump 에 없는 Group G2 를 위 helper 로 생성 → (4) `uploadDump(dump, "MERGE")`. 단언: 응답 **201** + `status === "SUCCEEDED"` + `mode === "MERGE"` + **G1 이 동일 id 로 부활** + **G2 가 그대로 살아 있음** (id · name · createdAt 전부 seed 값) + `group.count() === 2` + `person.count() === 1`. 실 DB 의 `ImportJob` row 도 `mode === "MERGE"` 다.
- [ ] **분기 cover — 같은 상황에서 REPLACE 는 G2 를 제거한다 1+** — (3) 까지 동일하게 만든 뒤 `uploadDump(dump, "REPLACE")` 를 보내면 응답 201 + SUCCEEDED 이면서 **G2 가 사라지고** `group.count() === 1` (dump 의 G1 만) 이다. 이 test 와 위 happy test 가 **같은 입력 · mode 만 다름** 이어야 mode 분기가 DB 결과로 구분된다는 증거가 된다 (targeted delete 가 전면 삭제로 흘러가는 회귀를 잡는 그물).
- [ ] **error path — MERGE + 손상 dump 1+** — mode `"MERGE"` 로 손상 dump (유효하지 않은 JSON) 를 업로드하면 (a) 응답 **400**, (b) job row `status === "FAILED"` + `restoredRowCount === null` + `mode === "MERGE"`, (c) **Group / Person row 수가 요청 전과 동일** (보존 대상 G2 포함 — merge 라도 거부는 `$transaction` 이전 단락, UC-07 §7.4).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) MERGE 거부 응답 · job `error` 에 업로드 raw sentinel 문자열과 그 **접두 조각** 이 없다 (REQ-032, T-1287 reviewer round 1 MINOR 회귀 방지 형식 그대로), (b) MERGE 성공 시 `restoredRowCount` 가 **dump 의 record 수와 정확히 일치** 하고 보존된 G2 를 합산하지 않는다 (`toBe` 정확 일치 — 상한 단언 금지), (c) 보존된 G2 의 `createdAt` 이 요청 전후로 **동일** 하다 (보존이 "삭제 후 재삽입" 이 아니라 진짜 손대지 않음), (d) 요청 1 회당 `ImportJob` row 는 정확히 1 건 (중복 job 0).
- [ ] **머리 주석 amend** — 파일 머리 주석에 본 slice (3c-3d4) 가 추가하는 section E 의 책임 (MERGE 보존 계약 · REPLACE 대비 분기 · 보존 row 의 instant 를 명시 고정하는 이유) 을 **한국어** (§12) 로 3~6 줄 덧붙인다. 기존 머리 주석 내용은 지우지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 e2e 는 CI 의 `pnpm test:e2e` step 에서 실행되며 (로컬 `DATABASE_URL` 부재 시 미실행), PR CI 의 e2e leg 가 green 이어야 한다.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과.
- [ ] **diff 규율** — **총 diff ≤ 300 LOC / 1 파일**. 초과가 예상되면 negative (c) → (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 결함 발견 시 수정 금지** — MERGE 경로에서 결함 (예: 보존 대상까지 삭제됨 · createMany PK 충돌 P2002 · plan 이 merge 를 replace 로 흘림) 이 드러나면 `src/**` 를 고치지 말고 재현 조건 (seed · dump · 응답 · DB 상태) 을 Follow-ups 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **크기 상한 413 e2e 0** — slice 3c-3d3 으로 그대로 유지 (Follow-ups). 본 slice 는 대용량 버퍼를 만들지 않는다.
- **`LlmConfig` (LlmProviderConfig) · `Assessment` · `AuditLog` seed 0** — `LlmConfig` 는 full-record select 가 `apiKey` 를 명시 deny (ADR-0047 §Decision2) 하는데 schema 의 `apiKey` 는 not-null 이라 재삽입이 깨질 것이 예상되는 **미해결 정책 표면** 이다 (Follow-ups). 나머지 2 종도 T-1287 과 동일하게 범위 밖.
- **conflict resolution 알고리즘 확장 0** — "file 우선" 외의 정책 (timestamp 비교 · dedupe · reject mode) 은 UC-07 §6.2 가 별도로 남긴 영역. 본 slice 는 현행 구현의 계약만 확인한다.
- **부분 dump (scope 한정) + MERGE 조합 0** — cross-instance migration 시나리오는 별도 slice.
- **`src/**` 수정 0** — controller · runner · restore service · plan helper 전부 불변 (위 Acceptance 마지막 항목).
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 / T-1122 BLOCKED 선례). 본 task 는 기존 e2e 파일을 확장할 뿐이라 leg 변경이 애초에 불요다.
- **`test/perf/**` · `test/smoke/**` 수정 0** — DI 확장이 없으므로 `controllers: [ImportController]` 조립 parity 갱신 대상 0.
- **비동기 job 전환 · 진행률 polling · 재시도 · 관측 metric · Prisma schema/migration · 새 외부 dependency · 새 ADR 0**.
- **`web/` UI 수정 0**.

## Suggested Sub-agents

`tester → implementer` (test-only — tester 가 spec 작성·실행까지 맡고, implementer 는 호출하지 않아도 무방하다)

## Follow-ups

- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드 → 413 + job row 0 + DB 변경 0. **선행 확인 의무**: supertest 가 multer 의 mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE 여부) 를 먼저 국소 확인하고, flaky 하면 e2e 대신 `MulterExceptionFilter` 단위 경계 (이미 존재) 로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (미해결 정책, T-1287 → T-1288 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 운영 dump 에 그 entity 가 1 건이라도 있으면 REPLACE / MERGE 어느 mode 든 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책 (해당 entity skip / 재입력 요구 / 부분 실패 안내) 은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상** — 다음 driver turn 에서 `humanQuestion` 으로 escalate 하는 것이 적절하다 (planner 는 본 turn 에 STATE.humanQuestions 를 쓸 권한이 없어 여기에만 남긴다).
- (예고) 부분 dump + MERGE 조합 (staging seed / cross-instance migration, UC-07 §6.2 후반) e2e.
- (관례 박제, T-1286 executor) controller 생성자 확장은 `test/perf/` 의 `controllers: [<Name>]` 조립 spec 과 parity 를 요구한다. 향후 DI 확장 task estimate 시 `grep -rn "controllers: \[<Name>\]" test/` 결과를 파일 수 산정에 포함할 것.
