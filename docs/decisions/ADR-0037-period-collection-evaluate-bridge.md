---
id: ADR-0037
title: period→collection→evaluate bridge 설계 — period/personId → collectForPerson(fresh in-memory) → evaluate end-to-end + period RBAC(Admin full persist / User self-only ephemeral DB write 0) + collection-side↔evaluation-side double-write 경계 + 동시 호출 idempotency + EvaluationResult[] source-of
status: ACCEPTED
date: 2026-06-10
relatedTask: [T-0313, T-0320]
relatedPR: []
coversReq: [REQ-009, REQ-040, REQ-045]
supersedes: null
---

# ADR-0037 — period→collection→evaluate bridge (period/personId → collect → evaluate)

> 본 ADR 은 P5 의 다음 backbone — **`period/personId` 입력 → `collectForPerson`(수집) → `Activity[]` → `evaluate`(평가) 를 end-to-end 로 배선하는 bridge** — 의 설계만 decide 하며 production code · DTO · controller · RBAC guard · e2e 0 LOC 다(design-only ADR). [ADR-0033](ADR-0033-evaluation-result-persistence.md) 가 단위 평가 영속화를, [ADR-0035](ADR-0035-aggregate-summary-evaluation.md) 가 일·주·월 Summary 평가 backbone 을 닫은 위에서, 그 두 layer 가 전제하던 "평가 입력 `Activity[]` 의 source" 를 **period/personId 로부터의 fresh 수집**으로 확정한다. 구현(DTO → orchestration bridge service → controller endpoint → RBAC guard → e2e)은 §Follow-ups 의 dependency chain 으로 분해되며 각 slice 는 ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover)으로 강제한다. **status `ACCEPTED`** — 본 bridge 는 (a) period RBAC(Admin full / User ephemeral), (b) collection-side↔evaluation-side double-write 경계, (c) 동시 호출 idempotency 가 2+ module 에 걸친 새 design 결정이라 [CLAUDE.md §3.1](../../CLAUDE.md) rule 4 + [Q-0031 decision](../STATE.json) 에 따라 코드 전에 ADR 로 경계를 박제했다. 당초 §Decision 2/3 는 PROPOSE 로 두어 사용자 ADR PR 검토 대상이었으나, **[Q-0032](../STATE.json) 에서 사용자가 검토를 마쳐 §2 는 as-proposed 확정, §3 는 first-write-wins read-through 로 amend 했다(아래 각 §Decision 참조). 두 PROPOSE 가 모두 resolve 돼 본 ADR 은 ACCEPTED.**

## Context

수집·평가·Summary 의 세 backbone 이 각각 main 에 머지됐으나, **셋을 하나로 잇는 wire 가 아직 0** 이다:

- **수집 layer** — [CollectionEntryService.collectForPerson(person, since, assessmentId): Promise<Contribution[]>](../../src/assessment-collection/collection-entry.service.ts) 가 `buildCollectionSpec → collectActivities → filterActivitiesByAuthor → persistActivities` 4단계를 조립해 **영속화된 `Contribution[]`** 을 반환한다([ADR-0030](ADR-0030-assessment-collection-enumerate.md) §5). 그 중간 산출인 [CollectionOrchestratorService.collectActivities(spec): Promise<Activity[]>](../../src/assessment-collection/collection-orchestrator.service.ts) 가 **in-memory `Activity[]`** 를 (persist 없이) 산출한다.
- **평가 layer** — [EvaluationOrchestratorService.evaluateActivities(activities, options): Promise<EvaluationResult[]>](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) 가 `Activity[]` 를 받아 정규화 → dedup → scoring 으로 `EvaluationResult[]` 를 산출한다(in-memory, DB write 0). 이 결과는 [EvaluationResultPersistService.persist(context, results, mode)](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 로 `Assessment`/`Contribution` 에 영속화된다(ADR-0033 reset-and-recreate).
- **HTTP 진입** — 기존 [POST /api/assessment-evaluation/evaluate](../../src/assessment-evaluation/assessment-evaluation.controller.ts) 는 controller 주석(L26~27)에 박제된 대로 **"이미 수집된 `Activity[]` 직접 수신"** 계약만 노출한다. period/personId → 수집 → `Activity[]` 변환 bridge 는 명시적으로 controller 밖(후속 bridge slice)으로 deferred 돼 있다. [ADR-0032](ADR-0032-p5-evaluation-contract.md) §Follow-ups 의 "controller / DTO / endpoint / R-9 사용자 지정 기간" 도 같은 piece 를 deferred 했다.

즉 [README R-9](../../README.md)(L98 PLAN 참조 — "Admin·User 가 임의 기간의 평가문을 요청")가 요구하는 **"period/personId 를 입력으로 임의 기간 평가문을 요청"** 의 end-to-end 경로가 평가 layer 에서 미충족이다. caller 는 평가 전에 `Activity[]` 를 어딘가에서 따로 만들어 넘겨야 하는데, 그 source 가 미결정 상태다.

핵심 사실 — **building block 은 이미 다 존재하고, 본 ADR 은 wire 와 그 경계만 결정한다**:

- `collectActivities`(in-memory `Activity[]`) 와 `evaluateActivities`(`Activity[]` → `EvaluationResult[]`) 의 시그니처는 정확히 맞물린다(`Activity[]` in/out). 새 매퍼·새 알고리즘 0.
- `collectForPerson` 은 그 안에 **`persistActivities`(Contribution FK persist)를 포함**한다 — 즉 수집 layer 가 이미 `Contribution` 을 자체 FK 로 영속화한다. 한편 평가 layer 도 `EvaluationResultPersistService` 로 `Assessment`/`Contribution` 에 write 한다. 두 write 가 같은 `Contribution` table 을 향하므로 **double-write 경계**(중복/충돌 회피)가 본 bridge 의 핵심 design 산물이다.
- `Assessment` 는 immutable + `@@unique([personId, period, scope, periodStart])`([ADR-0006](ADR-0006-assessment-data-model.md) §1), 평가 영속화는 reset-and-recreate(ADR-0033 §3). 같은 `(personId, period)` 에 대한 concurrent bridge 호출이 이 unique 제약 위에서 어떻게 직렬화/idempotent 한지가 결정돼야 한다.
- [README 보안 특성](../../README.md) — 평가 trigger 는 Admin(L72~74), User 는 read-only(L86). 그런데 R-9 는 "Admin·User 임의 기간 평가문 요청" 을 요구한다. 이 두 요구의 화해가 period RBAC 결정이다([Q-0031 decision](../STATE.json) 옵션 (c) 가 이를 human-approve).

따라서 본 ADR 은 **새 module 도입이 아니라**, (a) period RBAC(Admin full / User ephemeral), (b) double-write 경계, (c) 동시 호출 idempotency, (d) `EvaluationResult[]` source-of, (e) 새 dependency/credential 경계를 decide 한다. backbone 을 먼저 박제(de-risk)하고 impl chain 으로 분해한다.

### 외력

- **[Q-0031 decision](../STATE.json)** — 사용자가 AskUserQuestion 으로 옵션 (1) "period→collection→evaluate bridge ADR + impl" 진입을 승인. 핵심 결정 (a) period RBAC = 옵션 (c) **Admin write + User ephemeral**, (b) double-write 경계 + 동시호출 idempotency 는 **architect 가 ADR 에서 PROPOSE → 사용자가 ADR PR 에서 검토**, (c) `EvaluationResult[]` source-of = bridge 가 `collectForPerson`/`collectActivities` 로 **fresh collect(in-memory)** 후 evaluate. 본 ADR 의 §Decision 1~5 가 task §Acceptance Criteria 5 결정 + impl-slice 분해와 1:1 cover.
- **[Q-0032 decision](../STATE.json)** — Q-0031 이 PROPOSE 로 남긴 §Decision 2/3 를 사용자가 ADR PR 검토에서 확정. (a) **§Decision 2(double-write 경계, evaluation-side single-writer): as-proposed 수용**(이의 없음 — collection-side persist 우회 + 평가 영속화 일원화 확정). (b) **§Decision 3(idempotency): 옵션 (2) 경계 수정 — first-write-wins read-through 로 amend**. 핵심 근거(사용자 발화): "이 활동/평가는 사람이 적는 것이 아니라 LLM/Agent 가 적는(생성하는) 것이다" — 같은 좌표 재생성은 churn / 낭비 compute 만 발생하므로 동일 좌표 중복 호출은 `ConflictException(409)` 전파가 아니라 **기존 저장본을 read 해 반환**해야 한다. (c) **overwrite / 이미 영속화된 평가문 재평가는 DEFERRED**(별도 후속 ADR/task — §Follow-ups). 본 task T-0320 이 이 결정을 §Decision 2/3·§Consequences·§Follow-ups·frontmatter 에 박제한다.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 결정은 **새 dependency 0**(내장 Prisma + 기존 `LlmHttpGateway` mocked-LLM unit + 기존 `JwtAuthGuard`/`RolesGuard`/`@Roles`), **새 credential 0**(`DATABASE_URL` 은 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 가 이미 CI 에 주입). **DB schema 변경도 0**(새 table·새 컬럼·새 unique 모두 미동반 — 기존 entity·unique·guard 재사용만) → 본 milestone 은 §5 BLOCKED 게이트를 어느 항목도 발화하지 않는다. live-LLM 검증만 후속 §5 credential 게이트(§Decision 5).
- **README R-9 / PLAN P5 L98** — "Admin·User 가 임의 기간의 평가문을 요청". 본 bridge 의 직접 요구 출처. period/personId 입력으로 임의 기간 평가문을 산출하는 경로.
- **[README 보안 특성](../../README.md)** — 평가 trigger = Admin(L72~74) / User read-only(L86). period RBAC 화해의 source(§Decision 1).
- **[ADR-0031](ADR-0031-collection-manual-trigger.md)** — collection manual-trigger endpoint(`POST /api/assessment-collection/collect`, Admin RBAC, Assessment row 를 endpoint 가 생성). 본 bridge 의 endpoint RBAC/orchestration 패턴 precedent.
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md)** — evaluation-side reset-and-recreate write semantics(`$transaction` delete-if-exists → create) + fill/reeval 모드 + partial-reset + P2002→ConflictException. double-write 경계의 evaluation 축 + idempotency 의 source.
- **[ADR-0035](ADR-0035-aggregate-summary-evaluation.md)** §Follow-ups — controller/endpoint·source-of 미결 항목을 본 ADR 이 함께 확정(§Decision 4 가 Summary endpoint 의 source 도 박제).
- **[ADR-0032](ADR-0032-p5-evaluation-contract.md)** §2 — 평가 contract(`Activity[]` → `EvaluationResult[]`) 경계 + batch deferred. bridge 가 그 contract 를 변경 없이 재사용함을 §Decision 4 에서 재확인.

## Decision

### Decision §1 — period RBAC: Admin = full bridge(collect→evaluate→persist, DB write 有) / User = self-only ephemeral(자기 자신 한정 + generate-and-return, DB write 0)

**채택([Q-0031](../STATE.json) 옵션 (c) 박제): bridge 의 RBAC 를 role 별 2 경로로 분기한다. (a) **Admin** 은 임의 `personId` 에 대해 `collect → evaluate → persist` 하는 **full bridge**(DB write 有). (b) **User** 는 **자기 자신(`personId == 요청자 본인`) 한정**으로 `collect(in-memory) → evaluate → return` 하는 **ephemeral 경로**(generate-and-return, **DB write 0**). 이로써 README User read-only 보안 모델을 보존하면서 R-9 '평가문 요청' 을 충족한다.**

RBAC 박제:

- **Admin full bridge**: `@Roles("Admin")` 으로 보호되는 경로. 임의 `personId` 를 받아 `collect → evaluate → persist`(§Decision 2 double-write 경계 적용) 까지 수행한다. 평가 결과가 `Assessment`/`Contribution` 에 영속화돼 이후 조회(UC-02)·재집계(ADR-0035 Summary)의 source 가 된다. ADR-0031 의 collection manual-trigger Admin 패턴 + ADR-0033 persist 의 합성.
- **User self-only ephemeral**: 인증된 `User` 가 **자기 자신** 의 평가문을 요청하는 경로. 두 제약을 **동시에** 강제:
  1. **self-only** — 요청 `personId` 가 인증 principal 의 personId 와 **일치할 때만** 허용. 불일치 시 403(타인 평가문 요청 차단). 이 동등성 검사는 RBAC guard / orchestration 진입에서 수행하며 정확한 강제 지점(guard vs service)은 impl slice 가 결정(본 ADR 은 "self-only 강제가 존재해야 함" 박제). principal→personId 매핑이 부재하거나 모호하면 그 경로는 deny(fail-closed) — negative test 대상.
  2. **ephemeral(DB write 0)** — `collect` 는 **`collectActivities`(in-memory `Activity[]`, persist 없는 orchestrator)** 만 호출하고 `collectForPerson`(persistActivities 포함)을 **호출하지 않는다**. `evaluate` 결과는 `EvaluationResultPersistService.persist` 를 **호출하지 않고** 그대로 응답 body 로 반환한다. 즉 User 경로는 어떤 write path(Contribution FK persist / EvaluationResult persist / Summary write) 도 **타지 않는다**.
- **ephemeral 경계 보장 방식(어떻게 write 0 을 보장하는가)**: User 경로의 ephemeral 보장은 "persist 호출을 안 하면 된다" 는 약속이 아니라 **구조적 분기**로 강제한다 — bridge orchestration service 가 role(또는 mode `"persist" | "ephemeral"`)을 입력으로 받아, ephemeral 분기는 (i) 수집은 `collectActivities`(persist-free) 경로만, (ii) 평가 후 persist hook 자체를 호출하지 않는 코드 경로를 탄다. persist service 를 ephemeral 분기에 **주입조차 하지 않거나**(또는 호출 0), 분기를 type-level 로 갈라 ephemeral 경로에서 persist 호출이 컴파일/구조적으로 도달 불가하게 두는 방식을 impl slice 가 택한다. R-112 negative test 가 "User ephemeral 호출 후 DB row 증가 0"(e2e 실 PostgreSQL round-trip) 을 강제 검증한다 — write 0 이 spec 으로 박제돼 회귀가 잡힌다.
- **이 분기가 README 충돌을 화해하는 방식**: README "User read-only" 는 User 가 **시스템 상태(영속 데이터)를 바꾸지 못함** 을 의미한다. ephemeral 경로는 영속 데이터를 0 으로 변경(read-only 보존)하면서도 R-9 의 "평가문 요청"(자기 자신에 대한 일회성 산출물 생성-반환)을 충족한다 — 산출물은 응답으로만 흐르고 저장되지 않으므로 read-only 모델을 위반하지 않는다.

### Decision §2 — double-write 경계: collection-side(Contribution FK persist) ↔ evaluation-side(EvaluationResultPersistService) — Admin full 경로 한정, User ephemeral 은 write 0 (ACCEPTED)

> **본 §2 는 [Q-0031](../STATE.json) 이 "architect 가 ADR 에서 PROPOSE → 사용자가 ADR PR 에서 검토" 로 지정했던 결정이며, [Q-0032](../STATE.json) 에서 사용자가 as-proposed 로 수용해 ACCEPTED 다(evaluation-side single-writer 경계 확정, 이의 없음).**

**채택([Q-0032](../STATE.json) as-proposed 확정): Admin full 경로의 두 write — collection-side(`collectForPerson` 내부 `persistActivities` 의 Contribution FK persist)와 evaluation-side(`EvaluationResultPersistService` 의 Assessment/Contribution write) — 의 중복을 회피하기 위해, bridge 는 collection-side persist 를 우회하고 평가 영속화 단일 경로로 일원화한다. 즉 bridge 의 수집 단계는 persist-free `collectActivities`(in-memory `Activity[]`) 를 source 로 쓰고(§Decision 4), 영속화는 evaluation-side(ADR-0033 reset-and-recreate) 가 단독 책임진다. User ephemeral 경로는 어느 write 도 타지 않는다(§Decision 1).**

경계 박제:

- **중복의 정체**: `collectForPerson` 은 `persistActivities → ContributionService.create` 로 `Contribution`(placeholder difficulty/score/volume, ADR-0031 §1) 을 미평가 상태로 먼저 persist 한다. 그 뒤 evaluation-side `EvaluationResultPersistService.persist` 가 같은 `(personId, period, scope, periodStart)` 의 Assessment 를 reset-and-recreate 하며 평가-산출 Contribution 을 다시 write 한다 → **같은 활동이 collection-placeholder Contribution + evaluation-result Contribution 으로 2 번** 들어갈 수 있다.
- **채택안 A — 평가 영속화 일원화**: bridge 는 **collection-side persist 를 타지 않는다**. 수집은 `collectActivities`(persist-free orchestrator, in-memory `Activity[]`) 까지만 수행하고, `filterActivitiesByAuthor`(author 귀속 필터, 순수 함수)를 in-memory 로 적용한 뒤 그 `Activity[]` 를 `evaluateActivities` 에 넘긴다. **영속화는 evaluation-side 한 곳**(`EvaluationResultPersistService`, ADR-0033 reset-and-recreate)에서만 일어난다. 이로써 double-write 가 single-write 로 축약돼 중복/충돌 표면이 사라진다. collection-side `persistActivities` 는 기존 manual collection trigger(ADR-0031 endpoint)의 책임으로 남고 bridge 는 그것을 재사용하지 않는다(코드 변경 0 — 단지 호출하지 않을 뿐).
- **Assessment container 생성 책임**: evaluation-side persist 는 유효한 `(personId, period, scope, periodStart)` Assessment 좌표를 요구한다(ADR-0033 §1 context 4-tuple). bridge 의 Admin 경로는 ADR-0031 §1 패턴 mirror — orchestration 이 평가 영속화 진입에 이 4-tuple 을 조립해 넘기고, reset-and-recreate 가 Assessment row 생성/재생성을 책임진다(별도 placeholder Assessment 선생성 불요 — 평가 결과가 곧 Assessment 를 채운다).
- **대안(미채택, §Alternatives A)**: collection-side 가 placeholder Contribution 을 먼저 persist 하고 evaluation-side 가 그것을 in-place update 하는 안은 Assessment immutable(ADR-0006, in-place update 경로 부재) + reset-and-recreate(ADR-0033)와 충돌해 미채택.
- **User ephemeral 은 본 §2 적용 외**: write 가 0 이므로 double-write 문제 자체가 발생하지 않는다(§Decision 1).

### Decision §3 — 동시 호출 idempotency: 같은 (personId, period, scope, periodStart) 좌표의 first-write-wins read-through (ACCEPTED)

> **본 §3 은 [Q-0031](../STATE.json) 이 PROPOSE → ADR PR 검토 로 지정했던 결정이며, [Q-0032](../STATE.json) 에서 사용자가 옵션 (2) 경계 수정으로 확정해 ACCEPTED 다 — 이전 PROPOSE(P2002 → `ConflictException(409)` 전파)를 first-write-wins read-through 로 amend.**

**채택([Q-0032](../STATE.json) 옵션 (2) 경계 수정): 같은 `(personId, period, scope, periodStart)` 좌표에 대한 bridge 호출(Admin full 경로)은 first-write-wins read-through(get-or-create) semantics 를 따른다. 첫 호출은 create + persist + 결과 반환, 2 번째 이후 호출은 write 없이 기존 영속 평가문을 read 해 그대로 반환한다(좌표 충돌 caller 들이 같은 저장본으로 수렴). 동시 race 는 evaluation-side 의 `$transaction` + `Assessment.@@unique` 가 직렬화 — create-winner 가 persist 하고, loser 는 P2002 를 catch 해 read 경로로 fall-through 하여 winner 의 영속 결과를 반환한다(client 에게 `ConflictException(409)` 전파 없음). User ephemeral 경로는 write 0 이라 idempotency 무관(부수효과 없는 순수 산출).**

> **이 결정은 이전 PROPOSE(P2002 → `ConflictException(409)` 전파)를 REPLACES 한다.** 근거([Q-0032](../STATE.json) 사용자 발화): 이 활동/평가는 사람이 적는 것이 아니라 LLM/Agent 가 생성하는 산출물이므로, 같은 좌표의 중복 호출에 409 를 전파해 caller 에게 재시도 부담을 지우는 대신 — duplicate-coordinate caller 는 churn / 낭비 compute 없이 **기존 저장본으로 수렴**해야 한다. 즉 409 는 더 이상 duplicate-coordinate case 의 정상 응답이 아니다.

idempotency 박제:

- **first-write-wins read-through(get-or-create)**: bridge 의 Admin persist 진입은 좌표 존재 여부에 따라 분기한다 — (a) 좌표 부재 → create + persist + 반환, (b) 좌표 존재 → 기존 영속 평가문을 read 해 반환(write 0). 즉 두 번째 이후 동일 좌표 호출은 새 평가를 영속화하지 않고 stored 결과를 재사용한다(idempotent — row 수 불변, churn 0).
- **동시 race 직렬화 backbone = `$transaction` + `@@unique`(ADR-0033 재사용)**: 두 호출이 같은 좌표로 동시에 들어와 둘 다 "부재" 로 판단하고 create 를 시도하면 — DB transaction 격리 + `@@unique([personId, period, scope, periodStart])` 가 한쪽(winner)만 commit 시키고 다른 쪽(loser)은 P2002 로 reject 한다. **loser 는 P2002 를 catch 해 read 경로로 fall-through** 하여 winner 가 방금 persist 한 결과를 read 해 반환한다 — 양쪽 caller 가 동일 저장본을 받고 row 는 1 개만 남는다. 새 동시성 제어(application lock / advisory lock) **도입 0**, ADR-0033 의 기존 `$transaction`/`@@unique`/P2002 직렬화 substrate 를 재사용한다(P2002 의 처리만 409 전파 → read fall-through 로 바뀜).
- **fill / reeval 모드와의 관계**: bridge 의 Admin first-write-wins 경로는 좌표 부재 시 create(ADR-0033 의 `fill` 의미와 정합 — 미평가 좌표를 채움)만 수행하고, 좌표 존재 시 read-through 한다 — 즉 **reeval(이미 영속화된 평가문을 delete→create 로 교체)을 호출하지 않는다**. `reeval`(overwrite) 은 본 v1 범위 밖으로 DEFERRED(§Follow-ups) — 같은 좌표 재호출이 기존 결과를 덮어쓰지 않고 read 반환하므로 churn 이 발생하지 않는다.
- **수집 단계의 동시성**: bridge 의 수집(`collectActivities`)은 persist-free in-memory 라(§Decision 2) 동시 수집이 DB 상태를 경쟁시키지 않는다 — idempotency 책임은 evaluation-side persist 한 곳으로 국소화된다(경쟁 표면 최소화). 좌표 부재 판단 후 winner 가 fresh 수집-평가 결과를 persist 하고, loser 는 자기 수집-평가 산출을 버리고 winner 저장본을 read 한다(first-write-wins).
- **검증 경계**: first-write-wins read-through idempotency 는 impl slice 의 e2e(실 PostgreSQL, ADR-0004)에서 "같은 좌표 2 번째 호출 → 기존 반환(409 아님, row 증가 0)" + "같은 좌표 동시 2 호출 → 최종 row 1 개 + 양쪽 동일 결과(409 전파 없음)" 를 concurrency/idempotency test 로 검증한다(R-112 negative cases 충분 cover — 동시성·중복 좌표 경계 cover).

### Decision §4 — EvaluationResult[] source-of: bridge 는 fresh collect(in-memory Activity[]) → evaluate (영속 Contribution[] re-read 아님)

**채택([Q-0031](../STATE.json) (c) 박제): bridge 의 평가 입력 `Activity[]` 의 source 는 **`collectActivities`/`collectForPerson` 경로로 매 호출 fresh 수집한 in-memory `Activity[]`** 다(영속 `Contribution[]` 을 DB 에서 re-read 해 `Activity[]` 로 역변환하는 경로 **아님**). 이 결정이 옵션 (2) Summary evaluation controller/endpoint 의 `EvaluationResult[]` source 도 함께 확정해 재작업을 막는다.**

source-of 박제:

- **fresh in-memory collect**: bridge 는 `period/personId` 를 받아 그 기간의 활동을 **그 시점에 수집**(`collectActivities`, GitHub+Confluence aggregate, orchestrator throw 0)해 `Activity[]` 를 in-memory 로 산출하고, `filterActivitiesByAuthor` 로 Person 귀속만 남긴 뒤 `evaluateActivities` 에 넘긴다. 영속 `Contribution[]` 을 read 해 평가 입력으로 역변환하지 않는다.
- **fresh 채택 근거**: (a) R-9 의 "임의 기간 평가문 요청" 은 요청 시점의 최신 활동을 반영해야 의미가 있다(stale 영속물 재사용은 "임의 기간" 의 freshness 를 훼손). (b) 영속 `Contribution` 은 평가-파생 필드만 보유(R-59, raw 0)라 raw `Activity` 로 역변환이 불가능/손실적 — `Activity` 의 typed surface 를 재구성할 수 없다. (c) 수집과 평가를 한 호출에 fresh 로 묶으면 "수집된 자료 → 평가 → Summary" backbone(ADR-0035)의 입력이 deterministic 하게 정의된다.
- **옵션 (2) source 함께 확정**: ADR-0035 의 `SummaryAggregateOrchestratorService` 를 HTTP 로 노출하는 후속 endpoint(옵션 2)도 그 `EvaluationResult[]`/Activity source 를 본 bridge 의 fresh-collect 경로로 정렬한다 — in-memory caller vs 영속 re-read 의 ambiguity 를 본 ADR 이 해소해 재작업을 막는다(§Consequences 박제).
- **contract 무변경**: `collectActivities`(`Activity[]` out) / `evaluateActivities`(`Activity[]` in, `EvaluationResult[]` out) / `LlmHttpGateway.generate` 의 기존 시그니처를 **변경 0** 으로 재사용한다(ADR-0032 §2 mirror). bridge 는 새 orchestration service 1 개로 둘을 compose 할 뿐 기존 contract 를 깨지 않는다.

### Decision §5 — 새 dependency / credential 경계: 새 외부 dependency 0 / 외부 credential 0 (live-LLM 검증만 후속 §5 게이트)

**채택: 본 bridge 의 impl chain 은 **새 외부 dependency 0**(내장 Prisma + 기존 `LlmHttpGateway`(mocked-LLM unit) + 기존 `JwtAuthGuard`/`RolesGuard`/`@Roles`/`CurrentUser` decorator) / **외부 credential 0**(CI 실 PostgreSQL [ADR-0004](ADR-0004-smoke-e2e-db-mode.md), DATABASE_URL 기 주입) 으로 완결된다. DB schema 변경도 0(새 table·컬럼·unique 미동반). live-LLM 으로 실제 평가문 품질을 검증하는 것만 후속 §5 credential 게이트로 분리한다.**

경계 박제:

- **새 dependency 0**: bridge 는 기존 module(`AssessmentCollectionModule` + `assessment-evaluation`)의 export 를 import 해 compose 하는 새 orchestration service + DTO + controller endpoint + RBAC 분기일 뿐, 새 npm 패키지를 요구하지 않는다(@nestjs/schedule 등 scheduler 자동화는 본 ADR 밖 — P7 / 별도 ADR / §5 dep 게이트).
- **외부 credential 0**: 전 impl chain 은 mocked-LLM unit + CI 실 PostgreSQL(ADR-0004 migrate-deploy, DATABASE_URL 기 주입)으로 dependency-free / credential-free 검증된다. 실 GitHub/Confluence live token 수집(Q-0024/0025)·실 LLM key(Q-0022, 만료 2026-06-30)는 본 chain 밖.
- **DB schema 변경 0**: ADR-0033(Contribution `@@unique`)·ADR-0035(Summary `@@unique`)가 이미 필요한 idempotency backbone 을 박제했다. bridge 는 그 위에서 compose 만 하므로 새 migration 을 동반하지 않는다 — §5 BLOCKED 게이트의 schema-migration 축도 발화 0.
- **live-LLM 검증은 §5 credential deferred**: 실 endpoint 로 bridge 를 1 회 round-trip 해 평가문 품질을 확인하는 것은 실 API key 주입이 필요하므로([CLAUDE.md §5](../../CLAUDE.md) credential 게이트) 별도 후속 §5 credential task 로 분리(ADR-0032/0035 의 live-LLM deferred mirror). 본 ADR 의 impl chain 은 전부 mocked-LLM unit + e2e 실 PostgreSQL 로 완결된다.

## Consequences

### 긍정

- **R-9(임의 기간 평가문 요청)가 평가 layer 에서 end-to-end 로 충족** — period/personId → 수집 → 평가 의 마지막 wire 가 닫힌다. ADR-0032 §Follow-ups / ADR-0035 §Follow-ups 가 deferred 한 "controller/endpoint + source-of" piece 가 확정된다.
- **User read-only 보안 모델 보존 + R-9 충족 동시 달성** — ephemeral(DB write 0) 경로가 영속 상태를 0 으로 변경하면서 User 가 자기 평가문을 요청할 수 있게 해, README 보안 특성과 R-9 의 표면적 충돌을 구조적으로 화해한다.
- **double-write 가 single-write 로 축약(§Decision 2 ACCEPTED)** — bridge 가 collection-side persist 를 우회하고 evaluation-side 일원화하므로 중복/충돌 표면이 사라진다(Q-0032 as-proposed 확정).
- **새 dependency 0 / 새 credential 0 / 새 schema 변경 0** — 기존 module export + 기존 guard + ADR-0004 CI 를 재사용하므로 CLAUDE.md §5 BLOCKED 게이트를 어느 축도 발화하지 않는다(dependency-free impl chain).
- **idempotency 가 first-write-wins read-through 로 보장(§Decision 3 ACCEPTED)** — 새 동시성 제어 도입 0, `$transaction` + `@@unique`(ADR-0033) 재사용으로 동시 호출을 직렬화하고 loser 는 P2002 catch → read fall-through 로 winner 저장본을 반환(409 전파 0). 같은 좌표 중복 호출은 churn 없이 stored 평가문으로 수렴.
- **옵션 (2) Summary endpoint 의 source 재작업 차단** — fresh-collect source(§Decision 4)가 후속 Summary endpoint 의 입력도 정렬해 ambiguity 로 인한 재설계를 막는다.

### 부정 / trade-off

- **§Decision 2/3 는 [Q-0032](../STATE.json) 가 resolve — 더 이상 pending 아님** — double-write 일원화 방향(§2)은 as-proposed 로 확정됐고, idempotency 방식(§3)은 PROPOSE(P2002 → 409)에서 first-write-wins read-through 로 amend 돼 확정됐다(Q-0032 사용자 검토). 두 결정이 모두 박제돼 impl chain(slice 2~5)이 진행 가능하다 — slice 들은 §3 의 **create-if-absent-else-read**(reeval 아님)를 따른다. trade-off: first-write-wins 는 같은 좌표 재호출 시 최신 활동을 반영하지 않고 stored 결과를 반환하므로, 의도적 재평가(overwrite)가 필요하면 별도 경로가 필요하다 — 이는 §Follow-ups 의 DEFERRED overwrite 항목으로 분리(v1 은 평가문이 LLM/Agent 생성물이라는 전제 하에 first-write-wins 가 churn 을 막는 게 우월).
- **fresh collect 의 수집 비용 반복** — bridge 호출마다 외부 수집(GitHub/Confluence)을 새로 수행하므로 영속 재사용 대비 수집 비용을 반복 지불한다(특히 User ephemeral 의 잦은 요청 시). 단 freshness(§Decision 4 근거 a)와 raw 역변환 불가(근거 b)가 fresh 를 강제하며, 수집 layer 의 부분 가용성/skip-and-continue(ADR-0029)가 실패를 흡수한다. 캐싱/rate-limit 은 향후 별도 최적화(본 ADR 밖).
- **self-only 강제 지점이 impl 결정으로 남음** — User self-only(personId 동등성)의 정확한 강제 지점(guard vs orchestration service)을 본 ADR 이 박제하지 않고 impl slice 로 미룬다. 잘못된 지점에 두면 타인 평가문 누출 risk → impl slice 가 fail-closed + R-112 negative test(타인 personId → 403)로 강제 검증해야 한다(reviewer 점검 대상).
- **ephemeral write-0 보장의 구조적 강제 필요** — "persist 를 호출 안 하면 된다" 는 약속이 아니라 구조적 분기(persist 도달 불가)로 강제해야 회귀에 안전하다. impl slice 가 이를 type/구조 level 로 갈라야 하고, e2e 가 "User 호출 후 row 증가 0" 을 검증해야 한다(미준수 시 read-only 모델 누수 risk).

### Cross-Module Impact

본 결정은 새 export contract 를 **파괴하지 않고 추가**한다(bridge orchestration service + DTO + controller endpoint + RBAC 분기 신설). hard rule(cross-module impact)의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다 — `collectActivities` / `collectForPerson` / `evaluateActivities` / `EvaluationResultPersistService.persist` / `LlmHttpGateway.generate` / `JwtAuthGuard`·`RolesGuard`·`@Roles` 의 기존 시그니처를 모두 **import 재사용(변경 0)** 하며 bridge 는 그 위에 compose layer 를 **추가**한다.

- **영향 module = 2 module 한정(≥3 spread 아님 → BLOCKED 미해당)**: (1) `assessment-evaluation` — bridge orchestration service(collect compose → evaluate → Admin persist / User ephemeral 분기) + period bridge DTO + controller endpoint 신설(평가 trigger 의 상위 wire 소유). (2) `assessment-collection` — `collectActivities`/`filterActivitiesByAuthor`(persist-free 경로) + (Admin 경로용) `collectForPerson` building block 을 **read-only import**(시그니처 변경 0). RBAC 는 `auth` module 의 기존 guard/decorator 재사용(변경 0).
- **shared symbol 재사용(변경 0, read-only)**: `CollectionOrchestratorService.collectActivities` / `CollectionEntryService.collectForPerson` / `filterActivitiesByAuthor` / `EvaluationOrchestratorService.evaluateActivities` / `EvaluationResultPersistService.persist` / `PersistMode` / `JwtAuthGuard` / `RolesGuard` / `@Roles` / `@CurrentUser` — 전부 import 재사용만, contract 변경 0.

### 새 dependency risk flag (CLAUDE.md §5)

- **@nestjs/schedule(scheduler 자동화)** — 본 bridge 는 manual trigger(ADR-0031 precedent)로 발화되며 cron 자동화는 도입하지 **않는다**(P7 / 별도 ADR / §5 dep 게이트). 본 risk 가 본 milestone 을 막지 않는다.
- 그 외 새 dependency 0 — 내장 Prisma + 기존 `LlmHttpGateway`(mocked-LLM unit) + 기존 auth guard 만으로 전 chain 완결.

## Alternatives considered

### A. collection-side placeholder Contribution persist 후 evaluation-side in-place update (double-write 유지) (미채택)

bridge 가 `collectForPerson`(persistActivities 포함)을 그대로 호출해 placeholder Contribution 을 먼저 persist 하고, 평가 결과로 그 row 를 in-place update 하는 안(두 write 를 모두 유지하되 같은 row 를 갱신). 미채택 — `Assessment`/`Contribution` 은 immutable(ADR-0006, update 경로 부재) + 평가 영속화는 reset-and-recreate(ADR-0033, delete→create)라 in-place update 가 의미상 부적합하고, placeholder + 평가-결과 의 두 write 가 같은 `(assessmentId, sourceRef)` 좌표에서 충돌하거나 stale placeholder 를 남길 risk 가 크다. evaluation-side 일원화(§Decision 2 채택안)가 double-write 표면을 구조적으로 제거한다.

### B. User 경로를 아예 금지(Admin only bridge) (미채택)

README "평가 trigger = Admin / User read-only" 를 문자 그대로 해석해 bridge 를 Admin 전용으로 두고 User 의 평가문 요청을 막는 안. 미채택 — R-9(PLAN L98)가 "Admin·User 가 임의 기간의 평가문을 요청" 을 명시 요구하므로 User 금지는 R-9 미충족이다. [Q-0031](../STATE.json) 이 옵션 (c) ephemeral 화해를 human-approve 했다 — ephemeral(DB write 0) 경로가 read-only 모델을 보존하면서 R-9 를 충족하므로 Admin-only 보다 우월(요구 충족 + 보안 보존 동시).

### C. User 경로도 영속(persist)하되 별도 User-owned scope 로 격리 (미채택)

User 의 평가문도 DB 에 저장하되 Admin 평가와 다른 scope/owner 로 격리하는 안(User 가 자기 이력을 영속 조회 가능). 미채택(본 v1) — User write 를 허용하는 순간 README "User read-only" 보안 모델이 깨지고, scope 격리·소유권·삭제 권한 등 새 RBAC/data-model 결정이 연쇄로 필요해진다(2+ module spread 확대 + 새 schema risk). ephemeral(write 0)이 read-only 를 보존하며 R-9 를 충족하므로 v1 은 ephemeral 을 택한다. User 이력 영속이 실제 요구로 부상하면 별도 ADR(User-owned evaluation scope)로 격상.

### D. 평가 입력을 영속 Contribution[] re-read 로 (fresh collect 아님) (미채택)

bridge 가 수집을 새로 하지 않고 이미 영속화된 `Contribution[]` 을 read 해 평가 입력으로 역변환하는 안(수집 비용 0). 미채택 — (a) 영속 Contribution 은 평가-파생 필드만 보유(R-59, raw 0)라 raw `Activity` 의 typed surface 로 역변환이 손실적/불가능, (b) R-9 "임의 기간" 의 freshness 를 stale 영속물이 훼손, (c) collection 과 evaluation 의 입력 source 가 ambiguous 해져 옵션 (2) Summary endpoint 까지 drift 가 번진다. fresh in-memory collect(§Decision 4)가 freshness·정합·재작업 차단 모두 우월하다([Q-0031](../STATE.json) (c) 채택).

## References

- [ADR-0033](ADR-0033-evaluation-result-persistence.md) — evaluation-side reset-and-recreate / fill·reeval / partial-reset / P2002→ConflictException (double-write 경계의 evaluation 축 + idempotency source).
- [ADR-0035](ADR-0035-aggregate-summary-evaluation.md) — Summary 평가 backbone + §Follow-ups 의 controller/endpoint·source-of 미결(본 ADR §Decision 4 가 함께 확정).
- [ADR-0032](ADR-0032-p5-evaluation-contract.md) §2 — 평가 contract(`Activity[]` → `EvaluationResult[]`) + `LlmHttpGateway.generate` 무변경 재사용 mirror.
- [ADR-0031](ADR-0031-collection-manual-trigger.md) — collection manual-trigger endpoint(Admin RBAC, Assessment row 생성, P2002→409) — 본 bridge 의 endpoint/orchestration/idempotency precedent.
- [ADR-0030](ADR-0030-assessment-collection-enumerate.md) §5 — `collectForPerson` 4단계 조립 진입 계약.
- [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) §1/§3 — 수집/평가 분리 + collectActivities 부분 가용성.
- [ADR-0006](ADR-0006-assessment-data-model.md) — Assessment/Contribution immutable + `@@unique` (idempotency backbone).
- [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL (impl chain e2e 검증 source).
- [ADR-0008](ADR-0008-rbac-role-hierarchy.md) — RBAC tier(Admin/User) — period RBAC 분기의 role source.
- [src/assessment-collection/collection-orchestrator.service.ts](../../src/assessment-collection/collection-orchestrator.service.ts) — `collectActivities`(persist-free in-memory `Activity[]`).
- [src/assessment-collection/collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts) — `collectForPerson`(persistActivities 포함 — bridge 가 우회).
- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — `evaluateActivities`(`Activity[]` → `EvaluationResult[]`).
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) — `persist`/`PersistMode`(Admin 영속화 단일 경로).
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — 기존 POST /evaluate(source-of 박제 위치 — bridge 가 상위 wire 추가).
- [README.md](../../README.md) R-9(임의 기간 평가문 요청) / 보안 특성(평가 trigger=Admin / User read-only) — 외력.
- [docs/PLAN.md](../PLAN.md) P5 L98 — R-9 임의 기간 평가문 요청 bullet.
- [Q-0031](../STATE.json) — 본 bridge 진입 승인(옵션 1) + RBAC(c)/double-write/idempotency/source-of 결정 + §2/§3 PROPOSE→ADR PR 검토 지정.
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책.

## Follow-ups

(ADR-0037 ACCEPTED 후 planner 가 dependency chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover). dependency 순서. **Admin full-persist impl chain(slice 2~5)은 §Decision 3 의 create-if-absent-else-read(first-write-wins read-through)를 따르며 reeval/overwrite 가 아니다** — 같은 좌표 재호출은 기존 저장본 read 반환, write 0.)

- [ ] **slice 1 — bridge 입력 DTO** (`commitMode: pr`) — `period`/`personId`(+ RBAC role/mode 도출 경로) 입력 DTO + class-validator(`@IsISO8601`/`@IsString`/whitelist) + colocated spec(R-112 4 종 + negative: 빈/wrong-type/정의 외 필드). 기존 `EvaluateActivitiesDto`/`CollectTriggerDto` mirror.
- [ ] **slice 2 — period→collection→evaluate orchestration bridge service** (`commitMode: pr`) — `collectActivities`(persist-free) → `filterActivitiesByAuthor` → `evaluateActivities` compose + Admin persist(`EvaluationResultPersistService`, **create-if-absent-else-read**: 좌표 부재 시 create+persist, 존재 시 기존 read 반환, P2002 catch → read fall-through) / User ephemeral(persist 0) 구조적 분기 + mocked-LLM/mocked-collection unit(R-112 4 종 + negative: User 호출 시 persist 미호출 / 빈 수집 / collection throw 흡수 / 모드 분기 / 좌표 존재 시 read-through write 미발생).
- [ ] **slice 3 — controller endpoint** (`commitMode: pr`) — 예: `POST /api/assessment-evaluation/period` — DTO 수신 + orchestration 위임 + Admin/User 응답(Admin 영속 식별자 / User ephemeral 결과) + colocated controller unit(orchestrator mock). Admin 중복 좌표 호출은 409 아닌 기존 식별자/결과 반환(§Decision 3).
- [ ] **slice 4 — RBAC guard(self-only 강제)** (`commitMode: pr`) — Admin full / User self-only(personId 동등성, fail-closed) 분기를 guard 또는 orchestration 진입에 강제 + colocated spec(negative: 타인 personId → 403 / 인증 부재 → 401 / principal→personId 부재 → deny).
- [ ] **slice 5 — e2e** (`commitMode: pr`, ADR-0004 실 PostgreSQL) — Admin full persist round-trip(평가 결과 영속 검증) + **User ephemeral DB-write-0 검증**(호출 후 row 증가 0) + **first-write-wins read-through idempotency**(같은 좌표 2 번째 호출 → 기존 반환, **409 아님**, row 증가 0) + 동시 호출 수렴(같은 좌표 동시 2 호출 → 최종 row 1 + 양쪽 동일 결과, 409 전파 없음).
- [ ] **(DEFERRED) overwrite / 이미 영속화된 평가문 재평가(replace existing)** — 이미 persist 된 좌표의 평가문을 새 평가로 교체하는 경로(ADR-0033 reeval/reset-and-recreate delete→create). **Admin full-persist v1 chain 범위 밖** — 본 v1 은 first-write-wins read-through(create-if-absent-else-read)만 지원하며 같은 좌표 재호출은 기존 저장본을 read 반환한다. overwrite 는 (a) 누가 재평가를 trigger 할 권한이 있는가, (b) 기존 결과 보존/이력 관리, (c) 재평가 중 동시 read 의 일관성 등 새 결정을 동반하므로 별도 후속 ADR/task 로 분리한다(근거: 평가문은 LLM/Agent 생성물 — v1 은 churn 회피를 위해 first-write-wins). [Q-0032](../STATE.json) 가 "이미 write 한 것을 overwrite 하는 것은 나중에 고민하도록 plan 만 해두자" 로 DEFERRED 지시.
- [ ] **(§5 credential) live LLM bridge run** — 실 endpoint/key 주입 후 bridge 1 회 실제 round-trip 으로 평가문 품질 검증(deferred — Q-0022 시험 credential 만료 2026-06-30).
