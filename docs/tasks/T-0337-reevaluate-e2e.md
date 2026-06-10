---
id: T-0337
title: reevaluate replace·동시성 수렴 e2e + ADR-0038 §Decision5 실측 박제 (slice 4)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-06-11
independentStream: adr0038-overwrite-chain
dependsOn: [T-0336]
touchesFiles:
  - test/e2e/period-bridge-reevaluate.e2e-spec.ts
  - docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md
plannerNote: "P5 ADR-0038 slice4 — reevaluate e2e(실 PG) + §Decision5 동시성 실측 박제. base 200×1.3(chain e2e stage)=260 LOC."
---

# T-0337 — reevaluate replace·동시성 수렴 e2e + ADR-0038 §Decision5 실측 박제 (slice 4)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED) §Follow-ups **slice 4(마지막 impl slice)** 다. [T-0336](T-0336-controller-reevaluate-dispatch.md)(slice 3, 머지 a2672db)으로 reevaluate 가 endpoint 까지 배선 완료됐으나(DTO→service→controller), 전 chain 은 mocked unit 만으로 검증됐다 — **실 PostgreSQL(ADR-0004) 위에서 (a) reevaluate 가 기존 평가문을 실제로 replace(delete→create) 하는지, (b) default first-write-wins 가 보존되는지, (c) 동시 reevaluate 2건의 수렴 semantics(last-write-wins vs 한쪽 P2002→409)** 는 미실측이다. 특히 (c) 는 §Decision5 가 "impl slice e2e 가 실 PostgreSQL 로 실측해 박제한다" 로 **명시 의무화** 한 항목 — reeval race 는 fill 의 P2002 catch→read 수렴과 달리 "둘 다 delete→create 시도" 라 직렬화 결과가 다를 수 있다. 본 task 가 e2e 1 파일 + ADR §Decision5 실측 amendment 로 chain 을 닫는다. production code(src/) 변경 0.

## Required Reading

- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — §Decision3(default first-write-wins 보존 + opt-out + 좌표 부재 create degrade) · §Decision4(User fail-closed 403) · **§Decision5(동시성 — `$transaction`+`@@unique` 직렬화, 수렴 semantics 실측 박제 의무)** · §Follow-ups slice 4 정의. §Decision5 가 amendment 박제 대상.
- `test/e2e/period-bridge-admin-persist.e2e-spec.ts` — **template(1:1 mirror 대상)**. 실 DB 전략(ADR-0004, mock override 0) / no-network 전략(빈 serviceIdentities seed → fetch 0·LLM 0 → 빈 EvaluationResult[] → valid Assessment 1 row) / lifecycle(`createAuthenticatedE2EApp` + `buildAuthCookie` + `truncateAll` afterEach + close/$disconnect afterAll) / `validBody` 좌표 base / `created` 플래그의 정직한 박제(빈 수집 → contributionCount 0 한계) — 구조·helper 만 차용, 기존 first-write-wins 케이스 중복 작성 금지.
- `test/helpers/auth-e2e-helper.ts` + `test/helpers/db-truncate.ts` — 재사용 helper(변경 0).
- `docs/tasks/T-0336-controller-reevaluate-dispatch.md` — slice 3 박제 사실(Admin 분기 5번째 인자 pass-through / User+reevaluate:true → 403 ForbiddenException, self-only 검사보다 선행 / reeval 경로 Conflict 전파).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — read-only(변경 0). strict `reevaluate === true` 판정 + reeval 경로 read-through fallback 없음(P2002 → Conflict 전파) + `created` 도출 로직 — e2e assert 의 사실 근거.

## Acceptance Criteria

- [ ] **신규 `test/e2e/period-bridge-reevaluate.e2e-spec.ts`** — template 의 실 DB/no-network/lifecycle 전략 1:1 mirror(mock override 0). Admin + User actor seed. 로컬 DATABASE_URL 부재 시 CI `test:e2e` step 에서 검증(template 동일 — PR CI green 이 인증).
- [ ] **replace 실측(happy-path, R-112 항목 1)**: Admin 첫 호출(default)로 좌표 create(`prisma.assessment.count()` 0→1, assessmentId A 채집) → 같은 좌표 Admin + `reevaluate: true` → 성공 status + **count 1 stable(증가 0) + 새 assessmentId B ≠ A + B 의 `createdAt` > A 의 `createdAt`**(delete→create 의 NEW row 실증 — no-network 전략상 content 는 동일할 수 있으므로 replace 의 authoritative 신호는 id 변화 + createdAt + count stable 로 assert, spec 주석에 박제).
- [ ] **default first-write-wins 보존(flow/branch, R-112 항목 3)**: 좌표 존재 상태에서 (i) `reevaluate: false` 명시 (ii) 미지정 각 1+ test → 성공 + count 1 + **동일 assessmentId(write 0, read-through)** — §Decision3 default 회귀 0. 좌표 부재 + `reevaluate: true` → create degrade(count 0→1, 에러 아님 — §Decision3 idempotent 진입) 1+ test.
- [ ] **동시 reevaluate 2건 수렴 실측(§Decision5 의무)**: 좌표 seed(첫 create) 후 `Promise.all` 로 Admin `reevaluate: true` 2건 동시 발사 → assert: 각 응답 status ∈ {성공, 409}, 성공 ≥ 1건, **최종 count === 1**, 생존 row 좌표 일치 + assessmentId 가 첫 create 의 A 와 다름(최소 1회 replace 발생). 관측 결과(둘 다 성공 last-write-wins / 한쪽 P2002→409 Conflict)를 spec 주석에 박제.
- [ ] **ADR-0038 §Decision5 amendment(1~6줄)**: 위 동시성 e2e 의 실측 결과를 §Decision5 의 "(단 reeval 경로의 동시성 수렴 semantics … e2e 검증 대상)" 항목에 amendment 로 박제 — 관측 semantics + run 증거(CI run 또는 로컬 실 DB run) 명시. 비결정 관측(run 마다 다름) 시 "두 outcome 모두 valid 수렴(최종 row 1 + 유실/silent 부패 0)" 으로 박제.
- [ ] **negative cases 충분 cover(R-112 항목 2·4)**: (a) User + `reevaluate: true` → **403** + `expectNoPersistedRows` 식 영속 변경 0(count 불변 — §Decision4 (ii)). (b) User + `reevaluate: true` + 좌표 기존재 상태 → 403 + 기존 row 무변경(id/createdAt 불변 — 파괴 0). (c) wrong-type `reevaluate: "yes"` → 400(ValidationPipe) + 영속 변경 0. (d) 미인증(쿠키 없음) + `reevaluate: true` → 401 + 영속 변경 0. 단일 negative 금지 — 각 1+ test.
- [ ] 기존 e2e(`period-bridge-admin-persist` / `period-bridge-ephemeral`) 무변경 green(회귀 0) — 기존 first-write-wins idempotency 케이스와 중복 작성 0.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — e2e 는 cov 집계 밖, 기존 unit cov 회귀 0 확인). (R-112 항목 5)

## Out of Scope

- `docs/architecture/api.md` doc-sync(L102 — `mode` 제거 + `reevaluate` 계약 + 403 경계 반영, T-0334/T-0336 Follow-ups 박제) — **chain 완료 후 별도 doc-sync task**(다음 큐잉 후보).
- `src/` production code 변경 — 전부 0(DTO/service/controller 는 slice 1~3 완료분 read-only). e2e 가 결함을 발견하면 즉시 고치지 말고 BLOCKED + patch task 분리.
- audit trail / version history(§Decision5 DEFERRED) · live-LLM reevaluate run(§5 credential, 만료 2026-06-30) — 미착수.
- 새 helper 신설 — 기존 `auth-e2e-helper`/`db-truncate` 재사용(변경 0).
- 새 외부 dependency / DB schema 변경 / credential — 전부 0(§Decision6).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — §Decision5 amendment 는 설계 결정이 아니라 실측 결과 기록).

## Follow-ups

- (planner) **doc-sync task** 큐잉: 본 task 머지 후 `docs/architecture/api.md` period endpoint 서술 동기(`reevaluate?` 계약 + User 403 경계 + `mode` 제거 사실) — ADR-0038 chain 종결.
- (planner) live-LLM bridge 검증(PLAN P5, 만료 2026-06-30) — 2026-06-25 전 미착수 시 우선순위 격상(backlogNote 트리거 유지).
