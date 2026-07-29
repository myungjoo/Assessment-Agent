---
id: T-1297
title: 복원 실행 없이 영향 요약만 산출하는 dry-run preview 경로 (service slice 3c-5a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: []
touchesFiles:
  - src/import/import-restore.service.ts
  - src/import/import-restore.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 약 210 LOC / 2 파일. T-1296 이 외부 사실로 만든 요약을 '실행 전' 에도 얻는 경로 (UC-07 §5 confirmation 영향 범위)"
---

# T-1297 — 복원 실행 없이 영향 요약만 산출하는 dry-run preview 경로 (service slice 3c-5a)

## Why

[T-1294](T-1294-restore-plan-summary-wire.md) → [T-1295](T-1295-runner-restore-summary-return.md) → [T-1296](T-1296-import-response-restore-summary.md) 3 겹으로 복원 영향 요약 (`RestorePlanSummary`) 이 `POST /api/admin/import` 응답의 `restoreSummary` 로 외부 사실이 됐다. 그러나 그 요약은 **복원이 이미 커밋된 뒤** 에만 얻을 수 있다 — [UC-07](../use-cases/UC-07-export-import.md) §5 sequence 64 행이 요구하는 "Import 는 강한 confirmation — destructive 명시 + **영향 범위** + 기존 데이터 삭제 경고" 는 **실행 전** 에 그 수치를 보여줘야 성립한다. 지금은 "지우고 나서 얼마나 지웠는지 알려주는" 순서라 §5 step 7 의 confirmation 이 데이터 없이 비어 있다.

본 slice 는 그 순서를 뒤집을 수 있는 **service 경로 한 겹** 만 만든다 — [`ImportRestoreService`](../../src/import/import-restore.service.ts) 에 `previewFromDump(buffer, mode)` 를 신설해, 현재 `restoreFromDump` 의 (1) 기존 record 로딩 → (2) plan 준비 → (3) 실패 verdict 400 단락 → 요약 파생 까지를 **똑같이** 수행하고 `this.transaction.restore` 만 **호출하지 않은 채** `RestorePlanSummary` 를 반환한다. DB write 0 · `$transaction` 미개시 — UC-07 §7.4 의 "transaction 시작 전 reject" 규율과 자연 정합이며, 이미 요약 파생 지점이 `$transaction` **앞** 에 있으므로 (T-1294 가 그렇게 배치한 이유) 코드 재배치 없이 그 앞부분을 그대로 재사용할 수 있다.

두 메서드가 (1)~(3) + 요약 파생을 공유하므로 **private helper 1 개로 추출** 해 DRY 를 유지한다 — 거부 message 조립 · 요약 파생 순서 · 전파 계약 (재랩핑 · 흡수 0) 의 source 는 여전히 한 곳이다. `restoreFromDump` 의 외부 관측 동작 (반환 shape · 400 message 문자열 · plan 인스턴스 그대로 전달 · `summarizeRestorePlan` 1 회 호출) 은 **한 글자도 바뀌지 않아야** 하며, 기존 spec 이 수정 없이 통과하는 것이 그 증거다.

호출처는 본 slice 에서 **0** 이다 (T-1281 → T-1294 와 같은 리듬). `POST /api/admin/import/preview` endpoint 배선은 다음 slice (3c-5b), e2e 는 그다음 (3c-5c) — controller + spec + e2e 를 본 slice 에 합치면 5 파일 / 300 LOC cap 을 확실히 넘긴다.

**estimate 근거** — private helper 추출 + `previewFromDump` + 근거 주석 ~80 LOC, spec 신규 describe (happy / error / branch / negative) ~60 → base ~140, R-112 backbone × 1.5 → **~210 LOC / 2 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 전문 (96 행) — **본 task 의 주 변경 대상**. 특히 66~95 행 `restoreFromDump` 의 4 단계와 86~90 행 주석 (요약 파생이 `$transaction` **앞** 이어야 하는 근거 — 커밋 뒤에 부르면 성공한 복원이 FAILED 로 오기록). 헤더 주석의 전파 계약 (`prepareImportRestorePlan` 은 throw 0 계약이라 try/catch 0, read 단계 throw · `restore()` throw 는 인스턴스 그대로 전파, 재랩핑 · 흡수 0) 과 REQ-032 규율 (거부 message 에 dump 원문 · record `fields` · plan payload · stack · `cause` 0) 은 신규 메서드에도 **그대로** 적용된다.
- [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts) 의 harness 구역 (60~174 행) — **두 번째 변경 대상**. 재사용할 것: `MERGE_PLAN` / `PLAN` fixture, `zeroPerEntity` / `EMPTY_SUMMARY` / `MERGE_SUMMARY` 실측 표, `accept(plan)` verdict 조립, `makeService(over)` mock 조립 (`collect` / `prepare` / `restore` jest mock + `planned` 인스턴스 수집 배열), `reject(stage, issues)`, `STAGE_TABLE` / `STAGES` exhaustiveness 표, `denied(service)` 축약. **새 fixture · 새 mock harness 를 중복 신설하지 않는다** — `denied` 처럼 `restoreFromDump` 에 묶인 축약이 preview 에도 필요하면 인자로 호출 대상을 받도록 최소 확장한다.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 23~38 행 (`RestorePlanGroupBreakdown` / `RestorePlanSummary`) 과 `summarizeRestorePlan` 시그니처 — 반환 타입 정본. **0 수정**.
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 의 `prepareImportRestorePlan` 반환 verdict union (`ok: true` 시 `plan` / `records` / `version`, `ok: false` 시 `stage` / `issues`) — 공유 helper 의 반환 계약 입력. **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 sequence 64 행 (confirmation dialog — destructive 명시 + 영향 범위) + §7.4 (transaction 시작 전 reject, DB 변경 0) — 본 경로가 채우는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `src/import/import-restore.service.ts`, `src/import/import-restore.service.spec.ts` **만**. `import.controller.ts` · `import-job-runner.service.ts` · `import-restore-transaction.service.ts` · `import.module.ts` · `src/export/**` · `test/e2e/**` · `prisma/**` · `web/**` · `package.json` **0 수정**.
- [ ] **`previewFromDump(buffer: Buffer, mode: ImportMode): Promise<RestorePlanSummary>` 신설** — (1) 기존 record 로딩 → (2) plan 준비 → (3) 실패 verdict 400 단락 → (4) `summarizeRestorePlan(plan)` 반환. `this.transaction.restore` 호출 0 · `prisma.$transaction` 호출 0 · 어떤 DB write 도 0.
- [ ] **공유 경로는 private helper 1 개로 추출** — `restoreFromDump` 와 `previewFromDump` 가 (1)~(3) + 요약 파생을 같은 private 메서드로 통과한다 (거부 message 조립 · 요약 파생 순서의 사본 0). helper 는 성공 시 `{ plan, summary }` 형태로 돌려주고, 실패 verdict 는 helper 안에서 `BadRequestException` 을 던진다.
- [ ] **`restoreFromDump` 외부 동작 무변화** — 반환 shape (`outcomes` / `deleted` / `inserted` / `summary`) · 400 message 문자열 (`import 복원 거부 (stage: ...)` + issues 꼬리, issues 가 비면 구분자 미출력) · plan 인스턴스 그대로 transaction 전달 · `summarizeRestorePlan` 호출 1 회 · 요약 파생이 `restore()` **앞** 이라는 순서 전부 불변. **기존 spec 의 단언을 수정하지 않고 통과** 해야 한다 (수정이 필요해지면 그것은 무변화가 아니라는 신호 — 멈추고 원인을 PR body 에 기록).
- [ ] **주석** — 모듈 헤더에 본 slice (3c-5a) 가 무엇을 더했는지 · preview 가 transaction 을 열지 않는다는 계약 · 호출처가 아직 0 이고 endpoint 배선은 다음 slice 라는 사실을 한국어 (§12) 3~6 줄로 박제. 신규 메서드 위에 4 단계 주석 (`restoreFromDump` 스타일) 을 두되 공유 helper 의 근거를 사본으로 반복하지 않는다.
- [ ] **happy-path unit test 1+** — `MERGE_PLAN` 성공 verdict 에서 `previewFromDump` 가 `MERGE_SUMMARY` 와 deep-equal (`toEqual`) 인 요약을 resolve 하고, 같은 호출에서 `restore` mock 이 **0 회** 호출됨 (`planned` 배열 길이 0) 을 단언한다. 빈 `PLAN` 에서는 `EMPTY_SUMMARY` 가 나온다.
- [ ] **error path unit test 1+** — (a) `collect` 가 reject 하면 그 reason 이 **인스턴스 그대로** 전파 (`rejects.toBe`) 되고 `restore` 미호출, (b) `summarizeRestorePlan` 이 TypeError 를 던지면 재랩핑 · 흡수 없이 그대로 전파되고 `restore` 미호출, (c) 실패 verdict 면 `BadRequestException` (400) 이고 `restore` 미호출.
- [ ] **분기 cover** — (a) 성공 verdict → 요약 반환 경로, (b) 실패 verdict → 400 단락 경로 (`STAGES` 전 stage 를 `it.each` 로 순회해 exhaustiveness 유지), (c) `mode` 가 REPLACE / MERGE 두 값 모두 `prepareImportRestorePlan` 3 번째 인자로 **그대로** forward 됨 (변환 · 기본값 주입 0).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 실패 verdict 의 400 message 에 dump 원문 · plan payload · record `fields` · stack 이 실리지 않고 `cause` 도 붙지 않음 (REQ-032 — sentinel 문자열 미포함으로 확인), (b) issues 가 빈 배열이면 message 가 구분자 (`: `) 로 끝나지 않음, (c) 반환 요약이 `summarizeRestorePlan` 이 돌려준 **인스턴스 그대로** (복제 · 재계산 · 필드 pick · 반올림 0 — mock 반환 객체와 `toBe`), (d) 같은 service 로 `previewFromDump` 를 연속 2 회 호출해도 상태 누적 0 (두 결과 동일 + `restore` 여전히 0 회), (e) `previewFromDump` 직후 같은 service 로 `restoreFromDump` 를 부르면 정상 복원되고 (preview 가 plan 을 소비 · 변형하지 않음) 그때 비로소 `restore` 가 1 회 호출됨, (f) 입력 `buffer` 는 동일 인스턴스로 `prepareImportRestorePlan` 에 전달 (복사 · slice 0).
- [ ] **호출처 0 확인** — `previewFromDump` 는 본 slice 에서 production 호출처가 없다. 이를 메우려고 controller · runner · module 을 건드리지 않는다 (다음 slice 책임).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경한 `import-restore.service.ts` 는 line/branch/function coverage 종전 수치 (100%) 유지.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green (e2e 는 무회귀 확인 — 본 slice 는 e2e 0 추가).
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 2 파일. 초과가 예상되면 negative (e) → (f) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **하류 결함 발견 시 수정 금지** — 추출 중 `prepareImportRestorePlan` / `summarizeRestorePlan` / transaction service 쪽 결함이 드러나면 그 파일들을 고치지 말고 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **controller endpoint 배선 0** — `POST /api/admin/import/preview` (multipart + Admin RBAC + FileInterceptor) 는 다음 slice (3c-5b). 본 slice 는 `import.controller.ts` 를 열지 않는다.
- **e2e 0** — 실 HTTP 왕복 검증은 endpoint 가 생긴 뒤 (3c-5c).
- **`import.module.ts` 수정 0** — `ImportRestoreService` 는 이미 providers · exports 에 등록돼 있다 (T-1282).
- **`summarizeImportImpact` ([src/export/import-restore-preview.ts](../../src/export/import-restore-preview.ts)) 사용 0** — dump envelope 기반의 별개 요약이다. 본 경로는 실행 응답과 **같은 타입** (`RestorePlanSummary`) 을 반환해야 preview ↔ 실행 수치가 비교 가능하므로 `summarizeRestorePlan` 만 쓴다. 두 helper 통합 여부는 별건.
- **preview 결과 영속화 0 · job row 생성 0** — preview 는 `ImportJob` 을 만들지 않는다 (schema 변경 = §5 BLOCKED, 그리고 dry-run 이 job 을 남길 이유가 없다).
- **REPLACE 비선별 삭제 차단 / 경고 정책 구현 0** — 수치를 산출할 뿐 차단 판단은 제품 결정 (Follow-ups 유지).
- **`restoreFromDump` 의 의미 변경 0 · 응답 필드 개명/삭제 0 · 새 ADR 0 · 새 외부 dependency 0.**
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 가 낳는 다음 겹, 3c-5b / 3c-5c) `POST /api/admin/import/preview` endpoint 배선 (Admin+ RBAC · FileInterceptor 크기 상한 재사용 · DB write 0 응답) + 실 HTTP 왕복 e2e — preview 수치와 실행 후 `restoreSummary` 가 같은 dump 에서 일치하는지 왕복으로 박제.
- (유지, T-1293/T-1294/T-1295/T-1296) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview 경로가 생기면 실행 전에 그 수치를 보여줄 수 있다. 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1296 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 정상 경로 도달 불가하나 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1296 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
