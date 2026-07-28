---
id: T-1278
title: 복원 service 에 Prisma error → HTTP exception 매핑 배선 (실행 slice 3b-2c-2)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1277]
touchesFiles:
  - src/import/import-restore-transaction.service.ts
  - src/import/import-restore-transaction.service.spec.ts
  - test/e2e/import-restore-transaction.e2e-spec.ts
plannerNote: "3b-2c 뒷 절반 — helper 배선 + mock unit 갱신 + T-1276 '감싸지 않음' pin 을 '매핑된다' 로 의도적 갱신. module/controller 는 3c."
---

# T-1278 — 복원 service 에 Prisma error → HTTP exception 매핑 배선 (실행 slice 3b-2c-2)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 3b-2c-1 ([T-1277](T-1277-import-restore-prisma-error-map.md), PR #1168) 이 순수 매핑 helper `toImportRestoreHttpException` 을 **호출처 0** 인 상태로 박제했다. 본 slice 는 그 helper 를 유일한 호출처인 `ImportRestoreTransactionService.restore()` 에 배선해, 복원 실패가 raw Prisma error (→ HTTP 500) 로 올라가던 경로를 **P2002 → 409 · P2003 → 400 · P2025 → 409** 로 바꾼다. 미매핑 error 는 지금처럼 원본 그대로 전파(→ 500)한다 — 무차별 흡수 금지가 helper 표의 핵심이었고 배선도 그 규약을 그대로 따른다.

동시에 [T-1276](T-1276-import-restore-rollback-e2e.md) e2e 164 행의 **"전파된 error 는 본 service 가 감싼 것이 아니다 (Prisma → HTTP 매핑 부재 pin)"** 단언은 본 배선으로 **의도적으로 무효** 가 된다. 그 단언은 스스로 "3b-2c 매핑 slice 가 본 단언을 의도적으로 갱신한다" 고 예고해 두었으므로, 본 task 가 그것을 "실 DB 제약 위반이 실제로 `ConflictException` 409 로 매핑된다" 로 갱신한다 (삭제가 아니라 갱신 — 실 DB 사실로 매핑을 실증하는 자리를 그대로 재사용).

**estimate 근거** — 본 chain 실측 비율 (production : spec ≈ 1 : 2.1) 에 배선 slice 특성 (production 변경이 얇고 spec/e2e 갱신이 대부분) 을 반영. production ~20 (import 1 + try/catch 1 겹 + 헤더 주석 갱신), mock unit spec ~+55, e2e ~+45/-12 → 총 **~170 LOC / 3 파일**. ADR-first split stage × 1.3 적용 후에도 cap (300 / 5) 안이라 `sizeExempt` 를 쓰지 않는다.

## Required Reading

- [src/import/import-restore-error.ts](../../src/import/import-restore-error.ts) 66~98 행 — 본 task 가 배선할 helper 의 공개 계약: 매핑 적중 시 **새** exception 인스턴스, 미적중 시 `undefined`, throw 0 (단 접근자가 스스로 throw 하는 입력은 계약 밖). 메시지 문구는 helper 가 이미 조립하므로 **service 가 문구를 만들거나 덧붙이지 않는다**.
- [src/import/import-restore-error.spec.ts](../../src/import/import-restore-error.spec.ts) 166~184 행 — "접근자가 throw 하는 입력에서 helper 도 throw 한다" pin. 아래 **설계 결정 (필수 재검토)** 항목의 근거다.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 전체 (98 행) — 본 task 의 유일한 production 수정 대상. 특히 4~6 행 ("매핑 0 — 3b-2b / 3c 위임" 주석, 갱신 대상) · 9~11 행 ("error 를 그대로 전파 · 보상 로직 0" 계약) · 66~86 행 `restore()` 본문 (조립은 트랜잭션 **밖**, `$transaction` 1 회).
- [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) 43~70 행 (`makeService` factory — `txReject` 로 `$transaction` 자체 실패 주입) + 171~191 행 (기존 (d) `$transaction` reject / (e) 중간 step reject test). 기존 두 test 의 주입 error 는 각각 `code: "P1001"` 과 code 없는 `Error` 라 **둘 다 미매핑** — 단언 (`rejects.toBe(boom)`) 은 그대로 유효하고 주석만 갱신하면 된다.
- [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 1~45 행 (헤더 + `MARKER` sentinel + `planOf` / `del` / `ins` helper) + 164~180 행 (갱신 대상 pin 단언). 실 DB e2e 이며 CI 의 `pnpm test:e2e` step 에서 Postgres service 와 함께 돈다.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 185~200 행 — 복원 경로의 최종 HTTP 경계 (`BadRequestException` 400 / `ConflictException` 409). 본 task 는 **이 파일을 수정하지 않는다** (3c 몫) — 매핑 결과가 이 경계와 어긋나지 않는지 읽기만 한다.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) §2 (raw 미저장 invariant) — REQ-032 근거. 매핑 후에도 원본 Prisma 문구 · record 값이 응답에 실리면 안 된다.

## 설계 결정 (필수 재검토) — 방어적 흡수를 도입할 것인가

T-1277 spec 은 **"`code` / `meta` / `meta.target` 접근자가 스스로 throw 하는 입력에서는 helper 도 삼키지 않고 그대로 throw 한다"** 를 의도적으로 pin 했다 (방어적 흡수는 진짜 결함을 `undefined` 로 위장하므로). 배선 지점인 catch 블록에서는 이 계약이 **새로운 결과** 를 낳는다: helper 호출이 throw 하면 그 accessor error 가 원본 복원 실패 error 를 **덮어쓴다**.

implementer 는 다음 중 하나를 **명시적으로 선택** 하고, 선택 근거를 service 헤더 주석 2~3 행으로 박제한 뒤, 선택한 동작을 spec 1 개로 pin 한다:

- **(A) 흡수 0 (기본 권장)** — catch 블록은 `throw toImportRestoreHttpException(error) ?? error;` 한 줄. 실 Prisma known error 는 plain data property 라 accessor throw 가 발생하지 않으므로 계약 밖 입력을 위해 분기를 늘리지 않는다. spec 은 "accessor 가 throw 하는 error 를 주입하면 그 throw 가 전파된다 (계약 밖 · 원본 유실은 알려진 trade-off)" 를 pin.
- **(B) 원본 보존 guard** — helper 호출을 자체 try/catch 로 감싸 매핑 중 throw 시 **원본 error 를 다시 던진다**. 원본 유실 0 이 이득이지만 분기 1 개 + spec 1 개가 늘고, T-1277 의 "삼키지 않는다" 설계와 층위가 다르다는 점을 주석에 적어야 한다 (helper 는 판정 실패를 숨기지 않고, service 는 복원 실패 원인을 잃지 않는다 — 서로 다른 책임).

어느 쪽이든 **말없이 지나가는 것은 금지** — 선택 없이 배선만 하면 리뷰에서 되돌아온다. (A) 를 고르면 근거 주석 + pin spec 이 곧 결정 기록이다.

## Acceptance Criteria

- [ ] 파일 **3 개만** 수정한다: [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) · [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) · [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts). 신규 파일 0 · `import.module.ts` / `import.controller.ts` / `import-job.service.ts` / [src/import/import-restore-error.ts](../../src/import/import-restore-error.ts) **0 수정**.
- [ ] **배선 계약** — `restore()` 의 `$transaction` 호출을 try/catch 로 감싸 catch 에서 `toImportRestoreHttpException(error)` 를 부른다. 매핑 적중 시 그 exception 을, 미적중 (`undefined`) 시 **원본 error 를 그대로** 던진다. 재시도 0 · 보상 로직 0 · 로깅 0 · 부분 결과 반환 0 · 성공 경로 동작 변화 0.
- [ ] **catch 범위** — step 조립 (`groupImportRestoreOperations` · `planImportRestoreTransactionSteps`) 은 트랜잭션 **밖** 이며 Prisma error 를 낳지 않으므로 **catch 밖에 그대로 둔다**. 상류 조립 throw (한국어 prefix 문구) 는 매핑을 거치지 않고 지금처럼 전파된다 — 이 경계를 주석 1 행 + spec 1 개로 pin 한다.
- [ ] **설계 결정 박제** — 위 §설계 결정 의 (A) 또는 (B) 중 택 1 을 service 헤더 주석 2~3 행으로 근거와 함께 적고, 그 동작을 spec 1 개로 pin 한다. 헤더 주석의 기존 "Prisma error 매핑 0 (3b-2b / 3c 위임)" 문장은 현행에 맞게 갱신한다 (chain 위치 3b-2c-2 표기 포함, 헤더 총 20 행 이내 유지).
- [ ] **happy-path unit test 1+** — mock `$transaction` 이 `code: "P2002"` / `"P2003"` / `"P2025"` error 로 reject 할 때 `restore()` 가 각각 `ConflictException` / `BadRequestException` / `ConflictException` 으로 reject 하고 `getStatus()` 가 409 / 400 / 409 임을 단언한다. 기존 `it.each` 표 스타일로 압축한다.
- [ ] **error path unit test 1+** — (a) 미매핑 code (`P1001` · `P2028`) 는 `rejects.toBe(원본)` 로 **인스턴스 동일성** 유지 (기존 (d) test 재사용 가능), (b) code 없는 평범한 `Error` (기존 (e) test) 도 동일, (c) 상류 조립 단계 throw 는 매핑을 거치지 않고 원본 그대로 전파, (d) `$transaction` 호출 횟수 1 · 재시도 0 을 함께 단언.
- [ ] **분기 cover** — 분기마다 1+: (a) 성공 경로 (catch 미진입 — 기존 happy test 가 그대로 통과하는지 확인), (b) catch 진입 + 매핑 적중, (c) catch 진입 + 매핑 미적중 (`undefined` → 원본 재throw), (d) 빈 step 배열 단락 (트랜잭션 미개시 → catch 미진입), (e) §설계 결정 에서 (B) 를 골랐다면 helper throw → 원본 보존 분기.
- [ ] **negative cases 충분 cover** — 예외 분기마다 1+: (a) **REQ-032 회귀 차단** — `message` 에 `"leak-me"` marker 를 심은 Prisma error (`{ code: "P2002", message: "...leak-me...", meta: { cause: "leak-me" } }`) 를 주입했을 때 매핑된 exception 의 `message` 와 `getResponse()` 직렬화 (`JSON.stringify`) 어디에도 marker 가 없음, (b) 매핑된 exception 에 원본이 `cause` 로 붙지 않음, (c) 같은 error 로 두 번 호출해도 **매번 새 exception 인스턴스** (`not.toBe`), (d) 매핑이 일어나도 **부분 성공 결과를 반환하지 않음** (반드시 reject — resolve 0), (e) 매핑 후에도 보상 delete / 추가 delegate 호출 0 (`calls` 배열 단언), (f) accessor 가 throw 하는 계약 밖 error 주입 시 §설계 결정 에서 고른 동작대로 거동.
- [ ] **e2e pin 갱신** — [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 164 행 test 를 삭제하지 말고 **의도 갱신**: 실 Group PK 중복 (실 P2002) 이 이제 `ConflictException` (`getStatus() === 409`) 으로 reject 되고, 메시지가 한국어 안내이며, `MARKER` 문자열 · 원본 Prisma 문구 (`/^PrismaClient/` 이름 · `Unique constraint`) 가 메시지와 `getResponse()` 직렬화 어디에도 없음을 단언한다. test 제목과 헤더 주석의 "매핑 부재 pin" 표현도 함께 갱신한다 (chain 위치 표기 `3b-2b` → 본 갱신이 3b-2c-2 임을 1 행으로 명시).
- [ ] **rollback 회귀 유지** — e2e 의 기존 rollback test (`rejects.toThrow()` + row 원상 복귀 단언 3 종) 는 **의미 변경 없이 통과** 해야 한다. 매핑이 rollback 사실을 가리지 않는다는 것이 본 갱신의 안전 조건이다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경한 service 파일은 branch 포함 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. e2e 는 CI 의 `pnpm test:e2e` step (Postgres service) 에서 green.
- [ ] **diff 규율** — **총 diff ≤ 220 LOC / 3 파일**. 초과가 예상되면 negative (f) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.module.ts` provider 등록 · `import.controller.ts` / `import-job.service.ts` 재배선 · T-1254 interim false-success guard 교체 · HTTP / RBAC e2e · import UI false-success 해소** — 실행 slice **3c**. 본 task 는 service 한 겹의 error 매핑만 닫는다 (복원 pipeline 은 여전히 controller 에 연결되지 않는다).
- 매핑 대상 code 확장 (`P2028` → 504 · `P1001` → 503 등) · 재시도 정책 · backoff — 별도 slice. 본 task 는 helper 가 이미 닫은 3 종만 배선한다.
- [src/import/import-restore-error.ts](../../src/import/import-restore-error.ts) 의 문구 · 매핑 표 · `columnHint` 수정 — helper 는 T-1277 에서 닫혔다. 배선 중 helper 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- 기존 service 4 곳 (`import-job` / `export-job` / `evaluation-result-persist` / `summary-persist`) 의 `getPrismaErrorCode` 사본 통합 — 별도 위생 slice.
- 로깅 · 관측 metric · 실패 통계 · ImportJob 상태 전이 (`markFailed`) 연동 — 별도 slice.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건) · 사용자 안내 문구 i18n · 성능 측정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c** — `import.module.ts` provider 등록 + `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard → 실 복원 pipeline) + HTTP 경계 e2e (409 / 400 응답 body 확인) + import UI false-success 해소.
