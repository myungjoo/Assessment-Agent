---
id: T-0323
title: period bridge Admin full-persist e2e (실 PostgreSQL round-trip + first-write-wins read-through idempotency)
phase: P5
status: DONE
completedAt: 2026-06-10T13:10:00+09:00
result: 머지 — PR #271 squash ad966d0. test/e2e/period-bridge-admin-persist.e2e-spec.ts(+267 LOC, production symbol 0) — Admin full-persist round-trip(assessment.count 0→1 + findUnique read-back) + first-write-wins read-through idempotency(2번째 호출 not-409·row 불변·동일 id) + negative 5종. 동시성은 flaky 회피 순차 idempotency 대체. reviewer round1 APPROVE(NIT 2 비차단: created-always-false v1 한계·동시성 생략), 4-게이트(e2e CI 실 PostgreSQL green, PR-open run 첫-pass). **ADR-0037 Admin full-persist chain end-to-end 완결 — R-9 backbone 닫힘.**
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 200
estimatedFiles: 1
created: 2026-06-10
plannerNote: P5 ADR-0037 slice5 — slice4 RBAC 가 T-0317+T-0322 로 흡수됨(survey 확인) → e2e Admin persist round-trip + first-write-wins idempotency, single-helper test ×1.0
---

# T-0323 — period bridge Admin full-persist e2e (실 PostgreSQL round-trip + first-write-wins read-through idempotency)

## Why

ADR-0037 §Follow-ups **slice 5(e2e)의 Admin 부분**을 박제한다 — `POST /api/assessment-evaluation/period` 의 **Admin full-persist 경로**를 실 PostgreSQL(ADR-0004) 위에서 end-to-end round-trip 검증한다. T-0322(slice 3 Admin 분기 controller)가 머지돼 Admin 이 임의 personId 의 평가문을 요청하면 `Assessment`/`Contribution` 에 영속화하고 영속 식별자를 반환하는 wire 가 닫혔으나, 그 영속화·식별자 응답·**first-write-wins read-through idempotency(§Decision3 amended)** 가 실 DB 상에서 검증되지 않았다. 본 task 가 (a) Admin 호출 → 실 row 생성 + 영속 식별자 응답, (b) 같은 좌표 2번째 호출 → 기존 저장본 반환(409 아님, row 증가 0)을 spec 으로 닫아 R-9(Admin·User 임의 기간 평가문 요청)의 마지막 backbone 검증을 완결한다.

**slice 4(RBAC guard self-only 강제)는 T-0317 + T-0322 에 이미 흡수됨**(survey 확인): User self-only(personId 동등성, fail-closed)는 T-0317 이 controller orchestration 진입에 inline 강제(타인 personId→403 / sub 부재→403)했고, Admin 임의-personId 우회 + `isAdminRole(undefined)===false` fail-closed dispatch 는 T-0322 가 박제했다. ADR §Follow-ups slice 4 가 요구한 negative 3종(타인 personId→403 / 인증 부재→401 / principal→personId 부재→deny) 중 unit-coverable 2종은 controller spec 에 이미 존재하고, live 401(인증 부재)은 본 e2e 가 닫는다. 별도 guard 추출은 단일 호출 지점이라 make-work — slice 4 는 잔여 material 작업 없음.

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(Admin full-persist)·§Decision3(amended first-write-wins read-through — 같은 좌표 2번째 호출은 409 아닌 기존 저장본 read 반환, row 증가 0)·§Decision4(fresh in-memory collect)·§Follow-ups slice 5. overwrite 는 DEFERRED(범위 밖).
- `test/e2e/period-bridge-ephemeral.e2e-spec.ts` — **직접 template**(T-0318). no-network 전략(빈 serviceIdentities Person seed → fresh collect 빈 spec → fetch/LLM 0), 실 DB 전략(mock override 0, `expectNoPersistedRows`/`prisma.*.count()` 패턴), self-only/404/400 negative 구조. **본 task 는 이 spec 을 중복하지 않고 Admin persist + idempotency 에 집중**(User ephemeral e2e 는 이미 존재).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (L247-342) — `period()` role dispatch + `persistForAdmin`(임의 personId, context 4-tuple 조립, `PeriodBridgeAdminResponse` 응답 shape: assessmentId/personId/period/scope/periodStart/created).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — `generateAndPersist(person, {since}, options, context)` → `{ assessment, created }`. first-write-wins: 좌표 부재→create(created=true)+persist, 존재→read(created=false), 동시 race 는 P2002 catch→read fall-through.
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp([{role:"Admin"}])` / `buildAuthCookie(token)` / `AuthenticatedE2EContext`(app/prisma/users/tokens). JWT `sub`=User.id, Admin 은 임의 personId 가능(self-only 미적용).
- `test/helpers/db-truncate.ts` — `truncateAll(prisma)`("Person" CASCADE 가 Assessment/Contribution/Summary 동반 truncate). afterEach 정리.
- `src/persistence/prisma.service.ts` — `prisma.assessment.count()` / `prisma.contribution.count()` / `prisma.person.create(...)` 의 e2e DB 접근(empty serviceIdentities Person seed).

## Acceptance Criteria

- [ ] `test/e2e/period-bridge-admin-persist.e2e-spec.ts` 신설 — `createAuthenticatedE2EApp([{ role: "Admin", email }])` 로 Admin actor seed, `beforeAll`/`afterAll`(app.close + $disconnect)/`afterEach`(truncateAll) life cycle 은 ephemeral template mirror.
- [ ] **happy-path round-trip 1+**(Admin full-persist): 빈 serviceIdentities 의 target Person 을 seed(no-network) → Admin 토큰으로 `POST /period`(임의 personId == target Person.id, self-only 미적용) → 200 + `PeriodBridgeAdminResponse`(assessmentId/personId/period/scope/periodStart/created=true). **실 DB 영속 검증**: `prisma.assessment.count()` 가 1 로 증가 + 반환 `assessmentId` 가 실 Assessment row 의 id 와 일치(`prisma.assessment.findUnique`로 read-back). Contribution count 는 빈 수집이라 0(빈 평가 결과).
- [ ] **first-write-wins read-through idempotency 1+**(§Decision3 핵심): 같은 `(personId, period, scope, periodStart)` 좌표로 2번째 Admin 호출 → 200 + **409 아님** + `created=false` + 반환 assessmentId 가 1번째와 **동일** + `prisma.assessment.count()` 가 **여전히 1**(row 증가 0, 2번째 write 미발생). 1번째 호출 후 count==1, 2번째 호출 후 count==1 을 명시 assert.
- [ ] **error path / negative cases 충분 cover**(예외 처리 분기마다 1+):
  - (a) **인증 부재 → 401**(cookie 부재) — slice 4 가 요구한 live 401 negative + DB row 0 assert.
  - (b) **role 미달 → 403**: User 토큰으로 호출 시 Admin 분기에 도달하나 self-only(User branch)로 dispatch 되거나 — **본 e2e 는 Admin-persist 관점**이므로 User 토큰 + 타인 personId → 403(User self-only fail-closed) + Admin persist row 0 을 검증(User 가 Admin persist 를 트리거할 수 없음 — write 0 회귀 차단).
  - (c) **person-not-found → 404**: Admin 토큰 + 미존재 personId → `PersonService` NotFoundException(404) 전파 + DB row 0.
  - (d) **validation → 400**: Admin 토큰 + 빈 body 또는 정의 외 raw 필드 → 400(envelope) + DB row 0.
- [ ] **flow / 분기 cover**: created=true(첫 호출) / created=false(read-through) 두 분기 각 1+ test(idempotency criterion 이 둘을 cover하면 충족). person 미존재 분기 1+.
- [ ] (optional, feasible 시) **동시/중복 수렴**: 같은 좌표로 2호출을 `Promise.all` 로 동시 발사 → 둘 다 200(409 전파 0) + 최종 `prisma.assessment.count()`==1 + 양쪽 응답 assessmentId 동일. P2002 catch→read fall-through 검증. 동시성 test 가 flaky/infeasible 하면 본 항목 생략하고 PR 본문에 사유 명시(순차 idempotency 로 대체).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 단, 본 task 는 e2e spec 만 추가(새 production symbol 0)라 coverage 영향 최소. `pnpm lint && pnpm build && pnpm test` + `pnpm test:e2e`(실 PostgreSQL) green(tester 가 CI 에서 확인).
- [ ] PR 본문에 (a) "slice 4 RBAC 는 T-0317+T-0322 흡수 — 본 task 는 slice 5 Admin persist + idempotency", (b) no-network 전략(빈 serviceIdentities), (c) 동시성 항목 포함 여부 + 사유 명시.

## Out of Scope

- **User ephemeral e2e 중복** — `test/e2e/period-bridge-ephemeral.e2e-spec.ts`(T-0318)가 이미 User self-only DB-write-0 round-trip 을 cover. 본 task 는 Admin persist + idempotency 에만 집중(User negative 는 Admin-write-0 회귀 차단 목적의 최소 1건만).
- **slice 4 RBAC guard 추출** — survey 확인상 흡수됨(T-0317 self-only inline + T-0322 Admin 우회/fail-closed dispatch). 새 reusable guard 추출은 단일 호출 지점이라 make-work — 금지.
- **DEFERRED overwrite / 재평가** — ADR-0037 §Follow-ups DEFERRED. 같은 좌표 재호출의 read-through(409 아님, row 0)만 검증하고 reeval/overwrite 경로는 박제 0(별도 후속 ADR).
- **live LLM round-trip** — §Decision5 credential 게이트 deferred. no-network(빈 serviceIdentities → fresh collect 빈 수집)로만 검증. 실 LLM/GitHub/Confluence 호출 0.
- **production code 변경** — 본 task 는 e2e spec 파일 1개 신설만. controller/service/DTO 변경 0(이미 머지됨). 변경 필요 발생 시 = slice 3/4 결함 → 별도 patch task(본 task 범위 밖).
- **새 외부 dependency / DB schema 변경 / 새 credential** — 0(전부 기존 재사용: e2e helper + 실 PostgreSQL DATABASE_URL CI 기주입 ADR-0004). 발생 시 §5 BLOCKED.
- **timezone(Q-0026)** — periodStart 는 DTO pass-through. 좌표 동등성은 동일 ISO string 으로 재현.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0037 §Decision1/3/4 FIRM 박제, T-0318 ephemeral e2e template + T-0322 Admin 분기 머지 계약 mirror). 실 PostgreSQL e2e 는 CI test:e2e step(ADR-0004)에서 검증.

## Follow-ups

(없음 — 생성 시점. ADR-0037 Admin full-persist impl chain slice 1~5 완결 시 R-9 backbone 닫힘. 잔여 DEFERRED = overwrite/재평가(별도 ADR) + live-LLM 검증(§5 credential, Q-0022 만료 2026-06-30).)
