---
id: T-0460
title: UC-07 §6.4 Import 진행중-작업 race precondition 판정 순수 helper evaluateImportRaceGuard
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-037]
dependsOn: []
independentStream: uc07-export-import-helpers
touchesFiles: [src/export/import-race-guard.ts, src/export/import-race-guard.spec.ts]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §6.4/§7.6 — UC-01/UC-06 진행중 작업과 Import race 의 proceed/defer/timeout 판정 helper 0회-cover gap(git grep evaluateImportRaceGuard/ImportRaceGuard/ImportRaceVerdict src/ 0 매칭). pr, 게이트-free(입력 state descriptor·DB/scheduler query 0), dependsOn []."
---

# T-0460 — UC-07 §6.4 Import 진행중-작업 race precondition 판정 순수 helper evaluateImportRaceGuard

## Why

UC-07 [§4 precondition 4](../use-cases/UC-07-export-import.md) + [§6.4](../use-cases/UC-07-export-import.md) 는 Import / Restore 호출 시 [UC-01](../use-cases/UC-01-evaluation-execution.md) 평가 파이프라인 또는 [UC-06](../use-cases/UC-06-evaluation-delete-reeval.md) destructive operation 이 **진행 중인지** 검사하고, 진행 중이면 **(i) default — 진행 중 작업 완료 후 본 UC 실행** 또는 **(ii) 진행 중 작업 중단 후 본 UC 실행** 중 사용자 결정에 위임한다고 박제한다. 또한 [§7.6](../use-cases/UC-07-export-import.md) 은 (i) default 흐름에서 진행 중 작업이 **비정상 timeout / hang** 시 본 UC 도 timeout 전파 → 재시도 안내를 명시한다. 이 race precondition 판정 — `proceed` / `defer`(진행 중 → 대기) / `timeout`(진행 중 작업이 임계 초과 hang) 의 결정 — 은 현재 23+ 개 helper 중 **0 회 cover** 된 gap 이다 (git grep evaluateImportRaceGuard / ImportRaceGuard / ImportRaceVerdict src/ 0 매칭 확인).

본 task 는 이미 관측된 "진행 중 작업 상태 descriptor"(어떤 operation 이 언제 시작됐는지 + 현재 instant + timeout 임계 + 사용자 정책)를 **입력으로** 받아(실 scheduler / DB / pipeline state query 0 — 순수·재실행 0) `{ verdict: 'proceed' | 'defer' | 'timeout'; blocking, reason, headline, detailLines[] }` 단일 race 판정 모델 `ImportRaceVerdict` 를 산출하는 **순수 helper** 다. §6.4 (i) default(진행 중 → defer 대기) 와 (ii)(사용자가 중단 선택 → proceed) 의 정책 분기 + §7.6 timeout(경과 시간이 임계 초과 → timeout) 을 박제한다. 이는 sibling helper(T-0450 `validateImportDumpSize` / T-0451 `detectImportMergeConflicts` 의 non-throw verdict 누적, T-0453 `buildRestoreConfirmation` 의 사람-친화 headline+detailLines 조립)가 확립한 패턴의 Import precondition(§6.4/§7.6) 측 적용이다. persistence / repository / transaction / DB / scheduler / pipeline state query / REST 호출 0, 새 외부 dependency 0 — 게이트-free. 실 race detection(실 진행중 작업 polling)·cancellation protocol·timeout 임계 영속은 P5 service layer 의 게이트된 후속(§Out of Scope).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §4 precondition 4 (Import 전 race 검증) + §6.4 (UC-01/UC-06 race 의 (i) default defer / (ii) 중단 후 proceed 사용자 결정 위임) + §7.6 (race timeout → 5xx + 재시도 안내).
- `src/export/import-dump-size-validate.ts` — T-0450 `validateImportDumpSize` / `ImportDumpSizeVerdict`. non-throw verdict 누적 + 입력 방어 throw + 한국어 message + non-mutating 패턴 mirror 대상.
- `src/export/import-restore-confirmation.ts` — T-0453 `buildRestoreConfirmation`. headline + detailLines + blocking flag 조립 패턴 참고.
- `src/export/export-scope-select.ts` — T-0437. 입력 descriptor(plain interface) + assertValidDate 입력 방어 + non-mutating 의 순수-helper 골격 mirror 대상 (`PeriodRange`/`Date` 다루는 방식).

## Acceptance Criteria

- [ ] `src/export/import-race-guard.ts` 신설 — `evaluateImportRaceGuard(state: InProgressOperationState, options?: ImportRaceOptions): ImportRaceVerdict` 순수 함수 export. 입력 `InProgressOperationState`(예: `{ active: boolean; operation?: 'UC01-pipeline' | 'UC06-destructive'; startedAt?: Date }`) + `now` + `timeoutMs` + 사용자 정책(`onConflict: 'defer' | 'interrupt'`, §6.4 (i)/(ii)) 을 받아 `{ verdict: 'proceed' | 'defer' | 'timeout'; blocking: boolean; reason: string; headline: string; detailLines: string[] }` 모델을 조립. 실 scheduler/DB/pipeline state query 0 (입력으로만 받음).
- [ ] verdict 분기 정책: **active=false** → `proceed` + blocking=false (진행 중 작업 없음). **active=true && onConflict='interrupt'** → `proceed` + blocking=false (§6.4 (ii) 사용자가 중단 선택). **active=true && onConflict='defer'(default) && 경과(now-startedAt) ≤ timeoutMs** → `defer` + blocking=true (§6.4 (i) 진행 중 완료까지 대기). **active=true && onConflict='defer' && 경과 > timeoutMs** → `timeout` + blocking=true (§7.6 비정상 hang). `blocking === (verdict !== 'proceed')` 불변 유지.
- [ ] 한국어 headline / detailLines: 각 verdict 분기에 사람-친화 headline(예: defer="진행 중 작업 완료 후 자동 재시도 예정") + operation 종류·경과 시간·임계를 detailLines 로 노출. non-mutating — 입력 `state` / `options` 변형 0 (freeze 된 객체로 호출해도 통과).
- [ ] 입력 방어: `state` 비-object/null → 한국어 `TypeError`. `state.active` 비-boolean → 한국어 `TypeError`. active=true 인데 `startedAt` 부재 또는 비-Date(invalid Date 포함) → 한국어 `TypeError`(또는 `RangeError`). `options.now` 비-Date / `options.timeoutMs` 비-양의정수 / `options.onConflict` 가 허용 enum 외 → 한국어 `TypeError`(또는 `RangeError`). `now < startedAt`(시간 역행) → 한국어 `RangeError`.
- [ ] `src/export/import-race-guard.spec.ts` (colocated) 신설 — R-112 4종 충족:
  - [ ] happy-path: active=false → proceed / interrupt → proceed / defer(임계 이내) → defer / defer(임계 초과) → timeout 각 분기에 대해 올바른 verdict·blocking·headline 반환 test 1+ (각 1+).
  - [ ] error path: `state` null/비-object, `active` 비-boolean, active=true+startedAt 부재/비-Date, `timeoutMs` 비-양정수, `onConflict` 허용 외, `now < startedAt` 각각 한국어 메시지 `TypeError`/`RangeError` test 1+.
  - [ ] flow / branch: 4개 verdict 분기 각각 별 test 분리 (proceed-inactive / proceed-interrupt / defer / timeout).
  - [ ] negative cases 충분 cover: 경과 === timeoutMs 경계(임계 같을 때 defer 인지 timeout 인지 명세대로) / UC-01 vs UC-06 operation 종류별 detailLines 분기 / freeze 된 입력 non-mutating regression / startedAt === now(경과 0) 경계 / options 미지정 시 default 정책(defer + 기본 timeout) 각 1+.
  - [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — 가능하면 100%).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- 실 race detection — 실 scheduler / pipeline / UC-06 operation 의 진행 상태 polling / lock 조회 (§6.4 검증 단계의 실 query). 본 helper 는 이미 관측된 state descriptor 의 판정만.
- cancellation protocol — §6.4 (ii) 의 "진행 중 작업 중단" 실 실행 (cron job kill / transaction abort). 본 helper 는 정책 결정(`interrupt` → proceed)만, 실 중단 배선 0.
- REST controller / 5xx 응답 직렬화 / 재시도 backoff 정책 / async job + status polling (§7.6 WebUI·NFR) — repository/controller 게이트된 후속.
- timeout 임계값 영속 / config 주입 / 환경별 정책 table — P5. 본 helper 는 `timeoutMs` 를 입력으로만 받음.
- 새 도메인 타입은 `InProgressOperationState` / `ImportRaceOptions` / `ImportRaceVerdict` 3종만 신설. 기존 helper 와 중복 메시지 조립 금지 (구조 §7.4 / version §6.3 / size §7.3 측은 별 helper 책임). 새 외부 dependency 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
