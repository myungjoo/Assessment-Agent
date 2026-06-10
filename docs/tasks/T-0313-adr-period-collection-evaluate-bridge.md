---
id: T-0313
title: ADR-0037 period→collection→evaluate bridge 설계 (RBAC[Admin full / User ephemeral]·double-write 경계·idempotency·source-of)
phase: P5
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-10
priority: high
plannerNote: PLAN P5 L98 R-9(임의기간 평가문 요청) — Q-0031 옵션(1) 승인. ADR-0035 Summary backbone 종료 후 'period/personId → collectForPerson → Activity[] → evaluate' end-to-end bridge 를 ADR-first 로 설계. RBAC[Admin full / User ephemeral DB write 0]·double-write 경계·idempotency·source-of 박제. design-only ADR(src/ impl 0), architect 작성, pr-mode.
---

# T-0313 — ADR-0037 period→collection→evaluate bridge 설계

## Why

[Q-0031](../STATE.json) 에서 사용자가 옵션 (1) **period→collection→evaluate bridge ADR + impl** 진입을 승인했다. ADR-0035 가 Summary 평가 backbone(수집된 자료 → 평가 → Summary 영속화)을 닫았으므로, P5 의 다음 backbone 은 **period/personId 를 입력으로 받아 `collectForPerson` → `Activity[]` → `evaluate` 를 end-to-end 로 배선**하는 bridge 다([PLAN.md](../PLAN.md) P5 L98, README R-9 "Admin/User 가 임의 기간의 평가문을 요청").

이 bridge 는 thin wire 가 아니다 — (a) **period RBAC**, (b) collection-side(Contribution 자체 FK persist)와 evaluation-side(`EvaluationResultPersistService`)의 **double-write 경계**, (c) 동시 호출 **idempotency**, (d) **`EvaluationResult[]` source-of** 가 2+ module 에 걸친 새 design 결정이다. 그래서 CLAUDE.md §3.1 rule 4 에 따라 **코드 전에 ADR**(ADR 추가는 commitMode pr)로 경계를 먼저 박제한다. 본 task 는 **ADR 1개만** 작성하고 src/ impl 은 후속 slice 로 분해한다.

## Required Reading

- `docs/STATE.json` — Q-0031 `decision` 본문(RBAC 옵션 (c) Admin full / User ephemeral·double-write 경계·idempotency·source-of 결정 전문) + Q-0030 맥락.
- `docs/PLAN.md` — P5 L96~106 (단위/일·주·월 평가·사용자지정기간·R-9 임의기간 평가문 요청).
- `README.md` — 보안 특성 부분(평가 trigger = Admin / User read-only) + R-9 (Admin·User 임의기간 평가문 요청). 해당 줄만.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — evaluation-side reset-and-recreate write semantics + partial-reset + P2002→ConflictException. double-write 경계의 한 축.
- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — Summary 평가 backbone + §Follow-ups 의 controller/endpoint·source-of 미결 항목.
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` §2 — 평가 contract(Activity[] → EvaluationResult[]) 경계 + batch deferred.
- `docs/decisions/ADR-0031-collection-manual-trigger.md` — collection-side 수동 trigger + Contribution 자체 FK persist 동작(double-write 의 collection 축).
- `src/assessment-collection/collection-orchestrator.service.ts` (헤더·`collectActivities` 시그니처) — collect → Activity[] 산출 진입점.
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` (헤더·public 메서드 시그니처) — Activity[] → EvaluationResult[] 평가 진입점.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (헤더) — 기존 POST /evaluate 의 source-of(현재 in-memory caller) 박제 위치.

## Acceptance Criteria — ADR-0037 이 아래를 모두 decide

- [ ] `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` 신규(status: **PROPOSED**), ADR-0032/0033/0035 포맷 mirror(Context / Decision / Consequences / Alternatives / Follow-ups + status·relatedTask backref).
- [ ] **결정 1 — period RBAC (Q-0031 옵션 (c) 박제)**: **Admin = full bridge**(period/personId → collect → evaluate → **persist**, DB write 有). **User = self-only ephemeral**(자기 자신 personId 한정 + **generate-and-return, DB write 0**) — README User read-only 보안 모델을 보존하면서 R-9 '평가문 요청' 충족. ephemeral 경로(영속 0)의 경계(어떤 write path 도 타지 않음을 어떻게 보장하는지)를 명시.
- [ ] **결정 2 — double-write 경계**: collection-side 는 이미 Contribution 을 자체 FK 로 persist 하고, evaluation-side 는 `EvaluationResultPersistService` 로 Assessment/Contribution 에 write 한다. 두 write 의 **책임 경계 + 중복/충돌 회피**(collect 가 persist 한 Contribution 을 evaluate persist 가 어떻게 참조/재사용/재생성하는지)를 PROPOSE. Admin full 경로에만 적용, User ephemeral 은 write 0.
- [ ] **결정 3 — 동시 호출 idempotency**: 같은 (personId, period) 에 대한 concurrent bridge 호출이 reset-and-recreate(ADR-0033) semantics 와 어떻게 직렬화/idempotent 하게 동작하는지. P2002/$transaction 활용 경계 PROPOSE.
- [ ] **결정 4 — `EvaluationResult[]` source-of**: bridge 는 `collectForPerson`/`collectActivities` 로 **fresh collect(in-memory Activity[])** 한 뒤 evaluate 로 확정한다(영속 Contribution[] re-read 아님). 이 결정이 옵션 (2) controller/endpoint 의 source 도 함께 확정해 재작업을 막음을 Consequences 에 박제.
- [ ] **결정 5 — 새 dependency / credential 경계**: 새 외부 dependency 0(내장 Prisma + 기존 `LlmHttpGateway` mocked-LLM unit) / 외부 credential 0(CI 실 PostgreSQL ADR-0004). live-LLM 검증만 후속 §5 credential 게이트임을 명시.
- [ ] **impl-slice 분해를 Follow-ups 로 박제**: DTO(period/personId 입력 + RBAC role) / orchestration bridge service / controller endpoint / RBAC guard / e2e — 각 ≤300 LOC·≤5 파일·의존성 chain.
- [ ] ADR 본문은 한국어(§12), status·키·식별자·경로는 영어.
- [ ] **tester 게이트(0 src 변경 검증)**: 본 task 는 ADR 1개만 추가하고 src/ 변경 0 이므로, tester 가 `pnpm lint && pnpm build && pnpm test` 가 **여전히 green**(회귀 0)임을 확인. 신규 production symbol 0 → happy-path/error-path/branch/negative unit test 항목은 **본 design-only task 에 해당 없음**(분기 있는 production 코드 미추가 — R-112 4종은 후속 impl slice 의 Acceptance 에서 강제). coverage threshold 는 src 변경 0 이므로 불변.

## Out of Scope

- **src/ impl 일체 금지** — controller endpoint·DTO·bridge orchestration service·RBAC guard·e2e 는 전부 후속 slice(본 ADR ACCEPTED 후). 본 task 는 ADR 문서 1개만.
- ADR-0035 §Follow-ups 의 timezone(Q-0026)·live-LLM·scheduler 항목 — 본 bridge 와 독립, 별도 게이트.
- ADR-0034 lock-bypass 봉쇄 규율 흡수 + PR #249 close — Q-0031 followUp (B), 별도 direct doc task(후속 planner 큐잉).
- 새 외부 dependency 추가 — §5 게이트.

## Suggested Sub-agents

`architect` — ADR-0037 작성(단일 ADR / 구현 코드 0). 이어 `tester` 가 pr-mode R-110 충족(0 src 변경 → lint/build/test green 확인). reviewer 가 pr-mode design 검토.

## Follow-ups

(ADR-0037 ACCEPTED 후 impl chain — 각 별도 task, ≤300 LOC·≤5 파일, dependency chain 순서):
1. bridge 입력 DTO(period/personId + RBAC role) + validation.
2. period→collection→evaluate orchestration bridge service(collectActivities → evaluate, Admin persist / User ephemeral 분기).
3. controller endpoint 노출(예: POST /api/assessment-evaluation/period) + Admin/User RBAC guard.
4. e2e(Admin full persist round-trip + User ephemeral DB-write-0 검증, CI 실 PostgreSQL).
별건: Q-0031 followUp (B) — 'ADR-0034 lock-bypass 봉쇄 규율 흡수'(commitMode direct, doc) + 흡수 머지 후 PR #249 close.
