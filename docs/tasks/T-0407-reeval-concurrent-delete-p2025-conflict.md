---
id: T-0407
title: reevaluate 동시 delete 경합 시 Prisma P2025 를 409 로 변환 (flaky e2e 500 누수 차단)
phase: P5
status: DONE
commitMode: pr
prNumber: 328
completedAt: 2026-06-14T15:30:00Z
completedCommit: 192346a
coversReq: [REQ-036]
estimatedDiff: 70
estimatedFiles: 2
hqOrigin: null
independentStream: reeval-concurrency-robustness
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/evaluation-result-persist.service.ts
  - src/assessment-evaluation/evaluation-result-persist.service.spec.ts
created: 2026-06-15
plannerNote: "P5 robustness patch — reeval 동시 경합 loser 의 P2025(delete 대상 부재)를 409 로 변환, flaky e2e 500 누수(ADR-0038 §Decision5 수렴) 차단. CI-stage 소형 단일 service 분기."
---

# T-0407 — reevaluate 동시 delete 경합 시 Prisma P2025 를 409 로 변환

## Why

2026-06-14 main-push CI run 27502740644 에서 `test/e2e/period-bridge-reevaluate.e2e-spec.ts` 의 "동시 reevaluate 2건 수렴 실측" test 가 간헐 fail 했다 (journal 15:08 entry). 원인은 ADR-0038 §Decision5 수렴 경로의 robustness gap — 같은 좌표에 동시 reevaluate 2건이 들어오면 두 트랜잭션이 모두 `findUnique` 로 같은 `existing` row 를 발견한 뒤 둘 다 `tx.assessment.delete({ where: { id: existing.id } })` 를 시도한다. 먼저 commit 한 winner 가 row 를 삭제하므로, loser 트랜잭션의 delete 는 Prisma **P2025 ("No record found for a delete")** 를 던진다. 현재 `EvaluationResultPersistService.persist()` 의 catch (src/assessment-evaluation/evaluation-result-persist.service.ts L126-135) 는 **P2002 만** ConflictException(409)으로 변환하고 P2025 는 그대로 propagate → NestFactory 가 500 으로 응답한다. e2e 의 invariant (각 응답 status ∈ {200, 409}) 를 벗어나 간헐 500 누수가 발생한다. 데이터 손상은 없으나 (winner 의 replace 는 정상 영속화) CI 신뢰도를 떨어뜨리는 실제 race 다. P2002 와 동형으로 "경합 loser 의 정상 수렴" 이므로 409 가 올바른 status 다.

## Required Reading

- `src/assessment-evaluation/evaluation-result-persist.service.ts` — `persist()` catch 블록 (L117-136: 현재 P2002 만 ConflictException 변환), `persistInTransaction()` 의 reeval delete 분기 (L169-180: `existing !== null && mode==="reeval"` → `tx.assessment.delete`), `getPrismaErrorCode` helper (L64-74)
- `src/assessment-evaluation/evaluation-result-persist.service.spec.ts` — 기존 P2002→ConflictException test (L280-289) + **기존 "P2002 외 Prisma error(P2025)는 그대로 propagate" test (L291-300)** + 트랜잭션 중단 test (L302-309). `buildPrismaError("P2025")` helper 사용 패턴 확인
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — `persistReevalAndReadBack()` (L224-237): reeval 경로는 read-through fall-back 미적용, ConflictException 포함 모든 error 를 그대로 caller 로 전파한다 (409 가 controller 까지 도달하는 경로 확인)
- `test/e2e/period-bridge-reevaluate.e2e-spec.ts` — "동시 reevaluate 2건 시 각 status ∈ {200,409}" test (L214-240): 본 fix 가 green 으로 안정화할 대상 (regression 가드는 이미 e2e 에 존재, 본 task 는 unit layer 에 regression test 추가)
- `docs/decisions/ADR-0038-reevaluate-replace.md` — §Decision5 동시 reevaluate 수렴 semantics (변경 없음, 본 task 가 그 의도를 충족시킨다)

## Acceptance Criteria

- [ ] `EvaluationResultPersistService.persist()` 의 catch 블록을 수정 — **reeval 경로의 delete 경합 loser 가 던지는 P2025 를 ConflictException(409)으로 변환**한다. P2002 와 동일하게 "경합 loser 의 정상 수렴" 으로 취급한다.
- [ ] **변환 범위를 좁게 유지** — P2025 는 "delete 대상 row 부재" 외에도 다른 상황(예: update/delete 일반)에서 발생할 수 있으므로, 본 변환은 **reeval mode 의 동시 delete 경합** 시나리오에 한정되도록 의도를 명확히 한다 (예: P2025 변환을 reeval delete 경로 한정으로 좁히거나, 최소한 catch 블록에 P2025 변환의 reeval-race 근거를 한국어 주석으로 박제). create-side 의 예기치 못한 P2025 까지 무차별 삼키지 않도록 한다.
- [ ] **기존 spec L291-300 의 P2025-propagate test 를 fix 의도에 맞게 정정** — 현재 "P2002 외 Prisma error(P2025)는 그대로 propagate" test 는 본 fix 와 충돌한다. 변환 범위를 좁게 잡았다면 (create-side P2025 는 여전히 propagate) 해당 test 가 검증하는 시나리오를 create-side(또는 P2003/unknown 등 진짜 변환 대상 아닌 코드)로 조정해 "예기치 못한 error 는 삼키지 않는다" 의도를 보존한다.
- [ ] **happy-path unit test 1+** — reeval mode + `existing` row 발견 + `tx.assessment.delete` 가 P2025 reject → `persist()` 가 ConflictException 을 던진다 (409 변환 실증). `buildPrismaError("P2025")` helper 재사용.
- [ ] **regression test 1+ (R-112 patch 룰)** — 위 happy-path test 가 곧 이 결함의 regression 가드를 겸한다. test describe/it 문자열에 "동시 reevaluate delete 경합" / "P2025 → 409" 취지를 명시해 결함이 재발하면 fail 하도록 한다.
- [ ] **error/negative cases 충분 cover (R-112 항목 2·4)**:
  - P2002 는 여전히 ConflictException 으로 변환된다 (기존 test L280-289 green 유지 — 회귀 0).
  - 변환 대상이 아닌 Prisma error (예: P2003 또는 변환 범위 밖의 P2025) 는 여전히 그대로 propagate 한다 (예기치 못한 error 무차별 삼킴 0).
  - 트랜잭션 중단(delete 실패) 시 create 미호출 + propagate (기존 test L302-309 green 유지).
- [ ] **flow / branch cover (R-112 항목 3)** — fill mode(P2025 변환 비적용) vs reeval mode 분기, existing 존재 vs 부재 분기를 각각 1+ test 로 cover (변환이 reeval-race 한정임을 분기별로 실증).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — package.json coverageThreshold global).
- [ ] R-110: tester 가 root `pnpm lint && pnpm build && pnpm test` + `pnpm test:smoke` + `pnpm test:e2e` 실행·green 확인 (특히 period-bridge-reevaluate.e2e-spec.ts 의 동시 수렴 test 가 안정 green 인지 확인 — 단 e2e 는 DATABASE_URL 부재 시 CI 전용이라 PR CI green 으로 인증).
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 benignRedNote case A 절차(rerun)로 처리.

## Out of Scope

- ADR-0038 §Decision5 의 수렴 정책 자체 변경 — 파괴적 replace(delete→create) 의 v1 semantics 는 유지. 본 task 는 경합 loser 의 status 누수(500→409)만 닫는다.
- reeval 경합을 행 잠금(SELECT ... FOR UPDATE)이나 upsert 로 재설계 — race window 자체를 없애는 구조 변경은 별도 ADR 검토 대상. 본 task 는 catch-and-convert 최소 fix.
- fill 경로의 P2002 read-through fall-back 동작 변경 (period-bridge-admin-persist.service.ts) — 본 task 는 persist service 의 error 변환만 건드린다.
- `period-bridge-admin-persist.service.ts` / controller / DTO 변경 — reeval 경로가 ConflictException 을 그대로 전파하는 기존 배선(이미 409 도달)에 의존만 한다.
- ci.yml / package.json / web 관련 변경.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 결함 site·수정 방향이 ADR-0038 §Decision5 + 본 task 분석으로 확정. P2002 변환의 동형 확장이라 신규 아키텍처 결정 없음.)

## Follow-ups

(없음 — 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
