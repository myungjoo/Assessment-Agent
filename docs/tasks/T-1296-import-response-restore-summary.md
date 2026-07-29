---
id: T-1296
title: POST /api/admin/import 응답에 복원 영향 요약 동봉 (envelope 확장, 실행 slice 3c-4c)
phase: P5
status: DONE
completedAt: 2026-07-29T02:07:53Z
prNumber: 1187
mergeCommit: 788e9d9a
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 250
estimatedFiles: 3
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: []
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
  - test/e2e/import-restore-http.e2e-spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 약 250 LOC / 3 파일. T-1295 가 runner 경계까지 올린 요약을 외부 HTTP 사실로 만드는 마지막 겹 (3c-4c)"
---

# T-1296 — POST /api/admin/import 응답에 복원 영향 요약 동봉 (envelope 확장, 실행 slice 3c-4c)

## Why

[T-1294](T-1294-restore-plan-summary-wire.md) 가 `ImportRestoreService.restoreFromDump` 에서 `RestorePlanSummary` 를 산출했고, [T-1295](T-1295-runner-restore-summary-return.md) 가 그것을 `ImportJobRunnerService.runJob` 의 반환 (`{ job, summary }`) 까지 한 겹 올렸다. 그러나 [`ImportController.create`](../../src/import/import.controller.ts) 는 의도적으로 `result.job` **만** forward 하고 있어 (215~221 행 주석), 요약은 여전히 **프로세스 밖으로 나가지 못한다** — [UC-07](../use-cases/UC-07-export-import.md) §5 의 "결과 응답 (Import: 복원 row count + **영향 요약**)" 중 영향 요약은 아직 외부 사실이 아니다.

본 slice 는 그 마지막 한 겹 — **HTTP 응답 envelope** — 을 넓힌다. `create` 가 `{ ...result.job, restoreSummary: result.summary }` 를 반환해, 기존 client 가 읽던 필드 (`id` / `status` / `mode` / `restoredRowCount` / `artifactRef` / `error`) 는 **위치·이름·값 전부 불변** 인 채 `restoreSummary` 한 key 만 **추가** 된다. T-1295 Follow-ups 가 제시한 두 후보 (`{ ...job, restoreSummary }` vs `{ job, summary }`) 중 전자를 택하는 이유가 이것이다 — 후자는 기존 3 개 e2e spec 의 모든 `response.body.status` 단언을 깨는 breaking change 라 diff 파급이 크고, 본 slice 를 cap 밖으로 밀어낸다.

본 slice 는 **외부 관측 가능한 변화** 를 처음 만들므로 e2e 1 건을 동반한다 (T-1295 가 e2e 0 이었던 것과 대비). 실 HTTP 왕복에서 MERGE 가 보존한 row 수 (`restoreSummary.kept`) 와 REPLACE 가 지운 entity 별 수치 (`restoreSummary.deleted.perEntity`) 가 응답 body 로 관측된다는 사실을 박제한다.

영속화는 여전히 0 — `ImportJob` 에 breakdown 컬럼을 추가하려면 Prisma migration 이 필요하고 이는 CLAUDE.md §5 상 BLOCKED 대상이다 (T-1294 / T-1295 판단 유지). 요약은 응답 body 에만 실린다.

**estimate 근거** — controller 반환 타입 + 조립 + 근거 주석 ~35 LOC + controller spec (기존 `not.toHaveProperty` 3 줄 반전 + 신규 단언/케이스) ~65 + e2e 신규 케이스 2 건 ~65 → base ~165, R-112 backbone × 1.5 → **~250 LOC / 3 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 의 `create` 메서드 (184~222 행) + 그 위 헤더 주석 중 `POST /api/admin/import` 절 (9~23 행) — **본 task 의 주 변경 대상**. 특히 215~221 행의 "envelope 확장은 다음 slice" 주석이 본 slice 에서 갱신될 지점이다. 보존해야 할 계약: controller 자체 분기는 파일 누락 400 **하나뿐**, service/runner 예외 raw propagate (try/catch 0), buffer 동일 인스턴스 전달, `mode` 는 `job.mode` (schema `@default` 확정값) 사용.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 23~38 행 (`RestorePlanGroupBreakdown` / `RestorePlanSummary`) — 응답에 실을 타입 shape (`deleted` / `inserted` / `kept` 각각 `total` + 5 entity `perEntity`). **0 수정**.
- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 의 `RunImportJobResult` 선언부 + `runJob` 반환 조립부 — 소비할 타입의 정본 (T-1295 박제). **0 수정**.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 의 `runnerMock` 조립부 + `buildSummaryFixture` helper + `POST create` happy-path 케이스 (~680~723 행) — **두 번째 변경 대상**. 714~722 행의 "T-1295 외부 계약 무변화" 단언 3 줄 (`not.toHaveProperty("summary" | "restoreSummary" | "job")`) 이 본 slice 에서 **반전** 되는 지점이다. `buildSummaryFixture` 는 이미 있으니 재사용하고 새 fixture helper 를 중복 신설하지 않는다.
- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 의 helper 군 (139~205 행: `seedRestorableEntities` / `createExportJob` / `downloadDump` / `uploadDump` / `recordCountOf` / `counts`) + MERGE 픽스처 절 (323~382 행: `seedGroupAbsentFromDump` / `arrangeMergeFixture` + MERGE happy 케이스) + 부분 dump 절 (468~525 행) — **세 번째 변경 대상**. 신규 케이스는 이 helper 들을 그대로 재사용해 조립한다 (새 seed helper 신설 최소화).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 sequence 의 "결과 응답 (Export: streaming file. Import: 복원 row count + 영향 요약)" 줄 (90 행 부근) + §8 (e) — 본 배선이 완결시키는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 3 개** — `src/import/import.controller.ts`, `src/import/import.controller.spec.ts`, `test/e2e/import-restore-http.e2e-spec.ts` **만**. `src/import/` 의 다른 파일 (runner · restore service · transaction service · `import-job.service.ts` · `import.module.ts`) · `src/export/**` · `prisma/**` · `web/**` · `package.json` · `deploy/**` **0 수정**.
- [ ] **응답 shape 는 additive spread** — `create` 가 `{ ...result.job, restoreSummary: result.summary }` 를 반환한다. 반환 타입은 `Promise<ImportJob & { restoreSummary: RestorePlanSummary }>` (또는 그와 동등한 명시 export interface 1 개를 controller 파일에 선언). `restoreSummary` 는 runner 가 준 인스턴스 **그대로** (복제 · 재계산 · 필드 pick · 반올림 0). 기존 job 필드는 이름·값 전부 불변이고 삭제·개명 0.
- [ ] **`restoredRowCount` 규칙 불변** — job row 의 `restoredRowCount` 는 종전 값 그대로 응답된다. `restoreSummary.inserted.total` 로 덮어쓰거나 두 값의 일치를 강제하지 않는다 (T-1295 와 동일 판단 — 조용한 의미 변경 금지).
- [ ] **controller 분기 추가 0** — 파일 누락 400 이 유일한 controller 분기라는 계약 유지. `restoreSummary` 가 없을 때를 대비한 fallback 분기 (`?? {}` · optional chaining · try/catch) 를 넣지 않는다 (runner 계약상 항상 존재).
- [ ] **주석 갱신** — 215~221 행의 "envelope 확장은 다음 slice (3c-4c)" 주석을 본 slice 결과에 맞게 한국어 (§12) 로 갱신하고, 헤더 주석의 `POST /api/admin/import` 절에 응답이 job 필드 + `restoreSummary` 로 구성된다는 사실 1~3 줄 추가. `{ job, summary }` 대신 spread 를 택한 근거 (기존 client/e2e 파급 최소) 를 한 줄 남긴다.
- [ ] **happy-path unit test 1+ (controller spec)** — `runJob` 이 `{ job, summary }` 를 resolve 할 때 응답 body 가 (a) 기존 필드 (`id` / `status` / `restoredRowCount`) 를 종전과 동일하게 싣고, (b) `restoreSummary` key 를 가지며 그 값이 fixture summary 와 deep-equal (`toEqual`) 이고, (c) `summary` · `job` key 는 **여전히 없음** (envelope 중첩이 아니라 spread 임의 증거) 을 단언한다. 기존 714~722 행 단언은 삭제가 아니라 본 사실에 맞게 **반전·조정**.
- [ ] **error path unit test 1+** — (a) `runJob` 이 reject 하면 응답에 `restoreSummary` 가 실리지 않고 예외가 raw propagate (기존 status 단언 유지, controller 가 삼키지 않음), (b) 파일 누락 400 경로에서 `runJob` 미호출 + body 에 `restoreSummary` 부재, (c) `createJob` 이 throw 하면 `runJob` 미호출 (기존 단언 유지).
- [ ] **분기 cover** — (a) 성공 → spread 조립 경로, (b) 파일 누락 → 400 (조립 미도달), (c) mode 미지정 (form field 생략) 으로 `job.mode` 확정값이 쓰이는 기존 분기가 응답 shape 변경 후에도 동일 동작 + `restoreSummary` 동봉.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 세 그룹이 모두 `total: 0` 인 빈 요약도 `restoreSummary` 로 그대로 실림 (`undefined` · `{}` 로 뭉개지지 않음), (b) `perEntity` 의 0 값 entity key 가 JSON 직렬화 후에도 **보존** 됨 (key 누락 0 — supertest 왕복 body 로 확인), (c) job row 에 `restoreSummary` 라는 필드가 원래 없으므로 spread 가 기존 필드를 덮어쓰지 않음 (충돌 0 — 응답의 기존 필드 값이 mock job 과 정확히 일치), (d) 응답 body 어디에도 dump raw 본문 · 파일 원문 조각이 실리지 않음 (REQ-032 — 업로드한 sentinel 문자열이 body 직렬화 결과에 미포함), (e) 권한 미달 (User actor) / 미인증 요청은 종전대로 403 / 401 이고 body 에 `restoreSummary` 부재.
- [ ] **e2e 1+ (실 HTTP 왕복)** — `test/e2e/import-restore-http.e2e-spec.ts` 에 케이스 추가: (a) **MERGE happy** — 기존 `arrangeMergeFixture` 재사용, 응답 201 body 의 `restoreSummary.kept.total` ≥ 1 (보존된 Group 이 수치로 관측) + `restoreSummary.inserted.total` 이 dump record 수와 정합 + `deleted.total` 이 MERGE 계약대로 0, (b) **REPLACE branch** — 같은 dump 를 REPLACE 로 올리면 `restoreSummary.deleted.perEntity` 에 삭제된 entity 수치가 잡히고 `kept.total` 이 0. 두 케이스 모두 기존 `status` / `restoredRowCount` 단언을 함께 유지해 **기존 필드 무변화** 를 실 왕복으로 증명한다. 신규 seed helper 신설은 불가피할 때만 1 개 이내.
- [ ] **기존 e2e 무회귀** — `test/e2e/import-restore-rejection.e2e-spec.ts` · `import-restore-transaction.e2e-spec.ts` 는 **0 수정** 으로 통과해야 한다 (additive 확장의 증거). `import-restore-http.e2e-spec.ts` 의 기존 12 케이스도 단언 수정 없이 통과 — 수정이 필요해지면 그것은 additive 가 아니라는 신호이므로 멈추고 원인을 PR body 에 기록한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경한 `import.controller.ts` 는 line/branch/function coverage 종전 수치 이상 유지.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 3 파일. 초과가 예상되면 e2e (b) REPLACE 케이스 → unit negative (e) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **하류 결함 발견 시 수정 금지** — 배선 중 runner / restore service 쪽 결함 (예: 특정 경로에서 `summary` 가 `undefined`, `perEntity` key 누락) 이 드러나면 그 파일들을 고치지 말고 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **`GET /api/admin/import/:id` · `/running` 응답 확장 0** — 조회 endpoint 는 DB 의 job row 만 읽으며 요약은 영속화돼 있지 않다. 조회 시점 요약 제공은 schema 변경이 선행돼야 하는 별개 문제.
- **Prisma schema / migration 0** — `ImportJob` 에 breakdown 컬럼 추가 금지 (§5 BLOCKED 대상). 요약은 응답 body 에만 실린다.
- **Audit log row 영속화 0** — UC-07 §8 (e) 의 실 insert 경로는 범용 `AuditLog` model 부재로 사람 결정 대상 (Follow-ups 유지).
- **web/ UI 수정 0** — 응답의 `restoreSummary` 를 화면에 표시하는 배선 (UC-07 §5 step 12 "복원 완료 + 안내") 은 P6 frontend 영역.
- **`ImportRestoreService` / `ImportJobRunnerService` / `summarizeRestorePlan` 본문 수정 0** — 본 slice 는 이미 손에 있는 값을 응답에 실을 뿐이다.
- **`restoredRowCount` 의미 변경 0 · 새 count 필드 추가 0 · 응답 필드 개명/삭제 0.**
- **OpenAPI / swagger 문서 갱신 0 · 새 ADR 0 · 새 외부 dependency 0.**
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (유지, T-1293/T-1294/T-1295) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. 본 slice 이후 `restoreSummary.deleted.perEntity` 가 응답으로 관측되므로, 차단/경고 UX 의 입력 데이터는 갖춰졌다. 차단 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1295 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 정상 경로 도달 불가하나 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1295 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
