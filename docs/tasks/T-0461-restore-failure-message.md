---
id: T-0461
title: UC-07 §7.5 Import 복원 실패(DB write fail) 사람-친화 rollback 보장·재시도 안내 메시지 조립 순수 helper buildRestoreFailureMessage
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
dependsOn: []
independentStream: uc07-export-import-helpers
touchesFiles: [src/export/import-restore-failure-message.ts, src/export/import-restore-failure-message.spec.ts]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §7.5 — Import transaction DB write fail(connection/timeout/rollback/cascade) 시 atomic all-or-nothing rollback 보장 + 재시도 안내 메시지 조립 helper 0회-cover gap(git grep RestoreFailure/rollback/retry src/export 0 매칭). buildRestoreResult(성공)의 실패측 대칭. pr, 게이트-free, dependsOn []."
---

# T-0461 — UC-07 §7.5 Import 복원 실패(DB write fail) 사람-친화 rollback 보장·재시도 안내 메시지 조립 순수 helper buildRestoreFailureMessage

## Why

UC-07 [§7.5](../use-cases/UC-07-export-import.md) 는 Import 복원 중 PersistenceModule 의 **connection 끊김 / timeout / transaction rollback / cascade constraint 위반** 시 `5xx + WebUI 의 재시도 안내` 를 박제하며, 그 핵심 invariant 는 "**atomic — all-or-nothing** — 기존 row 삭제와 file snapshot 재구성이 함께 rollback (부분 복원 상태 없음)" 이다. T-0455 `buildRestoreResult` 가 transaction commit **이후 성공 결과 메시지** 를 조립했으나, 그 **실패측 대칭** — DB write fail 시 Admin 에게 보여줄 rollback 보장(부분 복원 상태 없음 안심) + 사유 분류 + 재시도 actionable 안내 메시지 — 는 24+ helper 중 0회 cover 된 gap 이다 (`git grep RestoreFailure / rollback / retry / writeFail src/export` 0 매칭 확인).

본 task 는 실패 사유를 구조화 descriptor `RestoreFailureDescriptor{ kind, mode }` 로 받아(실 transaction / repository / DB query 0 — 순수 합성, 재실행 0) 한국어 headline + rollback 보장 라인(부분 복원 상태 없음) + 사유별 detailLines + 재시도 actionable 안내 + retryable flag 를 담은 단일 메시지 모델 `RestoreFailureMessage` 를 조립하는 **순수 helper** 다. 이는 T-0453 `buildRestoreConfirmation`(실행 전) / T-0455 `buildRestoreResult`(성공) / T-0459 `buildDumpValidationMessage`(§7.4 구조 reject) 가 확립한 "구조화 verdict → 사람-친화 메시지 모델" 패턴의 §7.5 실패 측 적용이다. persistence / repository / transaction / DB / REST / 5xx 직렬화 / retry 자동 재시도 배선 호출 0, 새 외부 dependency 0 — 게이트-free. touchesFiles disjoint·dependsOn [] — maxConcurrentClaims=2 stage 5b 동시 driver 안전.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §7.5 (DB write fail → 5xx + 재시도 안내, atomic all-or-nothing rollback, 부분 복원 상태 없음) + §8 (b)(c) Import postcondition (실패 시 미적용) + §7.6 (race timeout → 재시도) 와의 경계.
- `src/export/import-restore-result.ts` — T-0455 `buildRestoreResult` / `RestoreResult` + `"replace" | "merge"` mode. 본 helper 의 **성공측 대칭** — plain interface + 한국어 TypeError/RangeError convention + non-mutating + mode 표기 패턴 mirror 대상.
- `src/export/import-restore-result.spec.ts` (colocated spec) — spec 위치·구조 mirror 대상.
- `src/export/import-dump-validate-message.ts` — T-0459 `buildDumpValidationMessage` / `DumpValidationMessage`. headline + detailLines + blocking flag 모델 패턴 참고 (본 helper 는 blocking 대신 retryable flag).
- `src/export/import-race-guard.ts` — T-0460 `evaluateImportRaceGuard` / `ImportRaceVerdict`. §7.6 race timeout 재시도 안내와 중복 회피 경계 확인용.

## Acceptance Criteria

- [ ] `src/export/import-restore-failure-message.ts` 신설 — `buildRestoreFailureMessage(descriptor: RestoreFailureDescriptor): RestoreFailureMessage` 순수 함수 export. 입력 `RestoreFailureDescriptor{ kind: RestoreFailureKind; mode: "replace" | "merge" }` 를 받아 `{ headline: string; rollbackAssured: boolean; detailLines: string[]; retryable: boolean }` 모델 조립. `RestoreFailureKind` 는 §7.5 의 4 사유 union — `"connection" | "timeout" | "rollback" | "cascade"`. 새 도메인 타입은 `RestoreFailureDescriptor` / `RestoreFailureKind` / `RestoreFailureMessage` 만 신설 (mode 는 T-0455 와 동형 `"replace" | "merge"` 재사용). raw 미저장(REQ-032) 정합 — 사유/mode 만 다루고 raw 미fetch.
- [ ] §7.5 atomic invariant 박제: 모든 kind 에 대해 `rollbackAssured === true` 불변 (transaction 은 all-or-nothing 이므로 어떤 실패 사유든 부분 복원 상태가 없음). detailLines 에 "기존 데이터는 변경되지 않았습니다(부분 복원 상태 없음)" 취지의 rollback 보장 한국어 라인을 항상 포함.
- [ ] kind 별 한국어 사유 라인 + retryable 분기: `connection`(DB 연결 끊김) / `timeout`(write timeout) → retryable=true + "잠시 후 재시도" 안내, `rollback`(transaction rollback) → retryable=true, `cascade`(cascade constraint 위반) → retryable=false + "file/데이터 정합 확인 후 재업로드" 안내 (단순 재시도로 해소 불가한 데이터 문제). headline 은 "복원 실패" + mode(replace/merge 한국어 표기) + 사유 요약 한 줄.
- [ ] non-mutating — 입력 `descriptor` 변형 0 (freeze 된 객체로 호출해도 통과). 반환 객체·배열은 새로 생성.
- [ ] 입력 방어: `descriptor` 가 비-object / null → 한국어 `TypeError`. `descriptor.kind` 가 4 허용 union 외 값(빈 문자열 / 대문자 / 숫자 / null 등) → 한국어 `RangeError`. `descriptor.mode` 가 `"replace" | "merge"` 외 값 → 한국어 `RangeError` (T-0455 convention 동형 — shape 위반 TypeError / enum 위반 RangeError 구분).
- [ ] `src/export/import-restore-failure-message.spec.ts` (colocated) 신설 — R-112 4종 충족:
  - [ ] happy-path: 4 kind(`connection`/`timeout`/`rollback`/`cascade`) × mode(replace/merge) 조합에 대해 올바른 headline·rollbackAssured·detailLines·retryable 반환 test 1+ (각 kind 1+).
  - [ ] error path: `descriptor` null/비-object, `kind` 허용외 값, `mode` 허용외 값 각각 한국어 메시지 `TypeError`/`RangeError` test 1+.
  - [ ] flow / branch: retryable 분기(connection/timeout/rollback → true, cascade → false) 각각 별 test 분리 + rollbackAssured 항상 true 검증.
  - [ ] negative cases 충분 cover: freeze 된 descriptor non-mutating regression / cascade 가 retryable=false + 데이터 확인 안내 포함 / 모든 kind 에서 rollback 보장 라인 detailLines 포함 / `kind` 가 빈 문자열·대문자("CONNECTION")·숫자 경계 거부 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — 가능하면 100%).

## Out of Scope

- 실 transaction 실행 / rollback / connection pool 관리 / cascade constraint 검사 (§7.5 의 PersistenceModule 영역) — 본 helper 는 이미 분류된 실패 사유의 메시지 조립만. P5 service layer + repository 게이트된 후속.
- REST controller / 5xx 응답 직렬화 / HTTP status code 매핑 / 자동 재시도(retry backoff) 배선 (§7.5 WebUI) — repository/controller 게이트된 후속.
- §7.6 race timeout 재시도 안내(T-0460 `evaluateImportRaceGuard` `timeout` verdict 책임) 와 중복 메시지 조립 금지 — 본 helper 는 DB write fail(§7.5) 측만. race 진행중-작업 timeout 은 별도 helper.
- §7.4 file 손상 reject 안내(T-0459 `buildDumpValidationMessage` 책임) 와 중복 금지 — §7.4 는 transaction 시작 *전* reject, 본 §7.5 는 transaction 중 write fail.
- `buildRestoreResult`(T-0455) 자체 재구현 또는 성공 경로 메시지 조립 — 본 helper 는 실패 경로만.
- 새 외부 dependency 0. 새 도메인 타입은 `RestoreFailureDescriptor` / `RestoreFailureKind` / `RestoreFailureMessage` 3종만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
