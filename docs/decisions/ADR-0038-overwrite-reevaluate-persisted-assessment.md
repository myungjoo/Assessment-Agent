---
id: ADR-0038
title: overwrite / 이미 영속화된 평가문 재평가(re-evaluate) 설계 — Admin 명시적 재평가 요청 contract(period bridge DTO mode/flag) + ADR-0033 reeval(reset-and-recreate) 재사용 + ADR-0037 §Decision3 first-write-wins 의 명시적 opt-out + RBAC Admin + idempotency/safety 경계
status: ACCEPTED
date: 2026-06-10
relatedTask: [T-0325, T-0333, T-0334]
relatedPR: []
coversReq: [REQ-009, REQ-040, REQ-045]
supersedes: null
---

# ADR-0038 — overwrite / 이미 영속화된 평가문 재평가(re-evaluate)

> 본 ADR 은 [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Follow-ups 의 **"(DEFERRED) overwrite / 이미 영속화된 평가문 재평가(replace existing)"** 항목을 설계로 승격한다. ADR-0037 §Decision3 의 Admin full-persist bridge 는 현재 **first-write-wins read-through**(create-if-absent-else-read — 같은 좌표 2 번째 호출은 기존 저장본을 read 반환, write 0)로 동작하며, 이는 [Q-0032](../STATE.json) 에서 "이미 write 한 것을 overwrite 하는 것은 나중에 고민하도록 plan 만 해두자" 로 DEFERRED 됐던 항목이다. [Q-0033](../STATE.json) 에서 사용자가 옵션 (1) "overwrite / 재평가 capability 설계 진입" 을 선택해 본 ADR 로 그 경계를 박제한다. 본 capability 는 **새 persist primitive 를 만들지 않는다** — [ADR-0033](ADR-0033-evaluation-result-persistence.md) 가 이미 정의·구현한 **`reeval` PersistMode(reset-and-recreate: `$transaction` delete-if-exists → create)** 를 재사용한다. 설계 질문은 (a) Admin caller 가 재평가를 **어떻게 요청** 하는가, (b) ADR-0037 §Decision3 first-write-wins 와 어떻게 **공존** 하는가, (c) **RBAC**(누가 재평가 권한), (d) **idempotency/concurrency + safety**(재평가가 기존 평가문을 파괴 — v1 허용 여부 / audit follow-up)다. production code · DTO · controller · orchestration · e2e 0 LOC 인 **design-only ADR** 이며 구현은 §Follow-ups 의 dependency-ordered slice 로 분해된다. **status `PROPOSED`** — 사용자가 [Q-0033](../STATE.json) 으로 설계 진입을 승인했으므로 architect 가 PROPOSE 하고 reviewer 가 ADR PR 을 검토한다(ADR-0037 T-0313 precedent mirror). PROPOSED→ACCEPTED flip 경로는 §Status 에 명시.

## Status

- **ACCEPTED** (2026-06-10) — [Q-0034](../STATE.json) 옵션 1(사용자 /loop 현장 승인)로 flip. Q-0033 이 명시한 "ADR 작성 후 사용자 ADR PR 검토" 게이트를 사용자가 현장에서 충족(설계 진입 + impl chain 진행 승인) → §Status 의 PROPOSED→ACCEPTED flip 경로 (b)(첫 slice gating) 로 처리. 다음 fire 부터 §Follow-ups impl chain(slice 1 = [T-0333](../tasks/T-0333-reevaluate-flag-dto.md)) 진행.
- **PROPOSED** (2026-06-10) — architect 가 본 ADR 을 PROPOSE, reviewer 가 ADR PR 을 검토한다([Q-0033](../STATE.json) 승인 하에 설계 진입). [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) 이 §Decision2/3 를 PROPOSE → 사용자 ADR PR 검토 → [Q-0032](../STATE.json) resolve 로 ACCEPTED flip 한 방식을 mirror.
- **PROPOSED→ACCEPTED flip 경로**: 본 ADR 의 §Decision 1~5 가 reviewer ADR PR 검토에서 일관성·Q-0033 정합·ADR-0033/0037/0006 cross-ref 정확성·§5 경계로 확인되면, flip 은 (a) 본 ADR PR 머지 + reviewer APPROVE 시점, 또는 (b) §Follow-ups impl chain 의 첫 slice gating 으로 처리한다(ADR-0037 §Status mirror — 별도 한 줄 status 갱신 direct commit, [CLAUDE.md §3.1](../../CLAUDE.md) rule 4 "ADR status 한 줄 수정은 direct").

## Context

[ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) 이 period→collection→evaluate bridge 의 Admin full-persist 경로를 박제했고, 그 impl chain(slice 2 [PeriodBridgeAdminPersistService](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts))이 머지됐다. 그 Admin 경로의 영속화는 ADR-0037 §Decision3(amended, [Q-0032](../STATE.json) resolve)에 따라 **first-write-wins read-through(create-if-absent-else-read)** 로 동작한다 — 같은 `(personId, period, scope, periodStart)` 좌표에 두 번째 호출이 오면 새 평가를 영속화하지 않고 기존 저장본을 read 반환한다(write 0, churn 0). 근거는 "평가문은 사람이 적는 것이 아니라 LLM/Agent 가 생성하는 산출물이므로, 같은 좌표 재호출에 churn / 낭비 compute 를 만들지 말고 기존 저장본으로 수렴해야 한다" 였다.

그러나 이 first-write-wins 는 **의도적 재평가를 불가능하게** 만든다 — 평가 알고리즘이 개선됐거나, 좌표의 활동이 추가/정정됐거나, Admin 이 명시적으로 "이 좌표를 다시 평가하라" 고 요구하는 경우, 현 bridge 는 항상 stale 한 첫 저장본을 반환할 뿐 새 평가로 교체할 경로가 없다. ADR-0037 §Decision3 자신이 이 한계를 trade-off 로 박제했다("같은 좌표 재호출 시 최신 활동을 반영하지 않고 stored 결과를 반환하므로, 의도적 재평가(overwrite)가 필요하면 별도 경로가 필요하다 — §Follow-ups DEFERRED overwrite 항목으로 분리").

핵심 사실 — **재평가 primitive 는 이미 다 존재한다. 본 ADR 은 그것을 요청하는 contract 와 경계만 결정한다**:

- [ADR-0033](ADR-0033-evaluation-result-persistence.md) §Decision3 + 그 impl([EvaluationResultPersistService.persist](../../src/assessment-evaluation/evaluation-result-persist.service.ts))이 **`reeval` PersistMode** 를 이미 구현·머지했다(T-0300, PR #252). `persist(context, results, "reeval")` 은 좌표 존재 시 기존 Assessment 를 delete(component Contribution 은 `onDelete: Cascade` 동반 삭제) → fresh create 를 단일 `$transaction` 으로 수행하고, 좌표 부재 시 일반 create 한다([persist-service L169~182](../../src/assessment-evaluation/evaluation-result-persist.service.ts)). 즉 **`PersistMode = "fill" | "reeval"`** 의 두 모드가 이미 type-level 로 존재하며, 현 Admin bridge 는 항상 `"fill"` 만 넘긴다([admin-persist-service L159~163](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) — "mode 는 항상 'fill'").
- [ADR-0006](ADR-0006-assessment-data-model.md) §1 의 `Assessment` immutable + `@@unique([personId, period, scope, periodStart])`. reset-and-recreate(delete old row → create new)는 immutable Assessment 를 "변경" 하는 **sanctioned 방식**이다 — in-place mutation(`update`)이 아니라 delete→create 이므로 ADR-0006 immutability 를 위반하지 않는다(ADR-0033 §3·§AlternativesD 에서 이미 박제).
- [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision1 의 **Admin full-persist guard**(`@Roles("Admin")` 보호 경로 + User self-only ephemeral write 0)가 이미 박제돼 있다 — 재평가 RBAC 은 이 기존 guard 를 재사용한다(새 guard/role 도입 0).

따라서 본 ADR 은 **새 persist primitive·새 module·새 guard 도입이 아니라**, (a) request contract(period bridge DTO 에 mode/flag), (b) persistence semantics(reeval 재사용), (c) first-write-wins 와의 공존(명시적 opt-out), (d) RBAC(Admin only), (e) idempotency/concurrency + safety(파괴적 교체의 v1 허용 + audit follow-up)를 decide 한다. backbone 을 먼저 박제(de-risk)하고 impl chain 으로 분해한다(commitMode `pr`, design-only, src 0 — [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md)/[ADR-0033](ADR-0033-evaluation-result-persistence.md) ADR-only precedent 동형).

### 외력

- **[Q-0033 decision](../STATE.json)** — 사용자가 AskUserQuestion 으로 옵션 (1) "overwrite / 재평가 capability 설계 진입(ADR-0038)" 을 승인. [Q-0032](../STATE.json) 가 DEFERRED 했던 overwrite 항목을 본 ADR 로 설계 승격한다. 본 ADR 의 §Decision 1~5 가 task §Acceptance Criteria 6 결정 + 2 경계와 1:1 cover.
- **[Q-0032 decision](../STATE.json)** — ADR-0037 §Decision3 를 first-write-wins read-through 로 확정하고 overwrite 를 DEFERRED 했던 결정. 본 ADR 이 그 DEFERRED 항목을 승격한다 — first-write-wins 가 **default 로 유지**되고 reeval 은 그 명시적 **opt-out** 임을 §Decision3 에서 박제(default 동작 회귀 0).
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md) §Decision3** — `reeval` PersistMode(reset-and-recreate: `$transaction` delete-if-exists → create) + fill 모드 + partial-reset + P2002→ConflictException. overwrite capability 가 **재사용** 할 기존 persist primitive(새 primitive 도입 0). 본 ADR §Decision2 가 그 재사용을 박제.
- **[ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision1/§Decision3** — Admin full-persist RBAC guard(§1) + first-write-wins read-through(§3). 본 ADR §Decision3/§Decision4 가 그 두 결정 위에서 opt-out 분기 + RBAC 재사용을 박제.
- **[ADR-0006](ADR-0006-assessment-data-model.md) §1** — `Assessment`/`Contribution` immutable + `@@unique([personId, period, scope, periodStart])`. reset-and-recreate 가 immutable Assessment 를 변경하는 sanctioned 방식임을 §Decision2/§Decision5 에서 재확인.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 결정은 **새 dependency 0**(기존 `reeval` 경로 + 기존 entity·guard 재사용), **새 credential 0**, **DB schema 변경 0**(기존 `@@unique`/entity 재사용, 새 table·컬럼·unique·migration 미동반) → 본 milestone 은 §5 BLOCKED 게이트를 어느 축도 발화하지 않는다(§Decision5).
- **README R-9 / PLAN P5** — "Admin·User 가 임의 기간의 평가문을 요청". 재평가는 그 R-9 요청의 Admin 측 확장 — 이미 영속화된 좌표를 새 평가로 교체.
- **[README 보안 특성](../../README.md)** — 평가 trigger = Admin / User read-only. 재평가는 영속 상태를 파괴적으로 교체하므로 **Admin only**(§Decision4) — User ephemeral 경로는 영속화 자체를 안 하므로 재평가 대상이 없다.

## Decision

### Decision §1 — request contract: 기존 `POST /api/assessment-evaluation/period` bridge DTO 에 mode/flag field 추가(별도 endpoint 아님)

**채택: Admin 이 재평가를 요청하는 방식은 **기존 period bridge endpoint(`POST /api/assessment-evaluation/period`, ADR-0037 §Follow-ups slice 3)의 입력 DTO 에 mode/flag field 를 추가** 하는 것이다(별도 재평가 endpoint 신설 아님). field 는 default 가 first-write-wins 를 보존하고, 명시적 opt-in 으로만 reeval 을 trigger 한다. 별도 endpoint 안은 §Alternatives A 에 미채택 근거와 함께 기록한다.**

contract 박제:

- **field**: period bridge 입력 DTO([PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts), ADR-0037 slice 1·3)에 **`reevaluate?: boolean`** 을 추가한다(boolean flag 안 채택 — `mode: "first-write-wins" | "reevaluate"` enum 안보다 단순). type `boolean`, **default `false`**(미지정 시 first-write-wins read-through 보존 — ADR-0037 §Decision3 동작 회귀 0).
- **validation**: class-validator `@IsOptional()` + `@IsBoolean()` + controller-scope ValidationPipe(`whitelist` + `forbidNonWhitelisted` — 정의 외 필드 400, wrong-type `reevaluate: "yes"` 같은 비-boolean 400). [EvaluateActivitiesDto](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts)/[PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts) 의 기존 validation 패턴 mirror.
- **semantics**: `reevaluate === true` (Admin 경로) → bridge 가 reset-and-recreate(`mode: "reeval"`)로 영속화. `reevaluate === false`/미지정 → 기존 first-write-wins read-through(`mode: "fill"`, create-if-absent-else-read) 보존(§Decision3).
- **enum 안과의 관계**: `mode: "first-write-wins" | "reevaluate"` 라는 enum field 안도 가능하나, v1 은 두 모드뿐이라 `boolean reevaluate` 가 더 단순하고 default 표현(`false`)이 명확하다. 3+ 모드가 향후 필요해지면(예: partial-reset trigger) enum 으로 격상한다(§Follow-ups). **본 v1 은 `reevaluate?: boolean (default false)`** 를 박제.
- **채택 근거(별도 endpoint 회피)**: (a) 기존 controller dispatch([AssessmentEvaluationController](../../src/assessment-evaluation/assessment-evaluation.controller.ts) period 분기, ADR-0037 slice 3)를 그대로 재사용 — 새 route/guard/wiring 0. (b) 재평가는 first-write-wins 와 **같은 collect→evaluate→persist 흐름**이고 단지 persist mode 만 다르므로, 별도 endpoint 는 collect/evaluate 로직을 중복시키거나 공유 service 를 재호출하는 추가 분기 비용만 낳는다. (c) Admin RBAC guard(ADR-0037 §Decision1)가 endpoint 단위로 이미 걸려 있어 같은 endpoint 의 flag 분기가 RBAC 재사용에 정합한다. (d) DTO field 추가는 cap(≤300 LOC/≤5 파일) 안에서 slice 분해가 자연스럽다(§Follow-ups).

#### Amendment (2026-06-11, T-0334) — vestigial `PeriodBridgeDto.mode` reconcile: **제거 채택**

본 §Decision1 이 `reevaluate?: boolean` 을 채택할 당시 [PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts) 에 이미 존재하던 `mode` field 를 미언급한 설계 gap 을 본 amendment 가 reconcile 한다.

- **(i) 사실관계**: T-0315 가 ADR-0037 slice 1 당시 speculatively `mode?: string`(`"fill" | "reeval"` `@IsOptional` + `@IsIn`) field 를 PeriodBridgeDto 에 추가했으나, **period bridge 의 어느 분기도 이를 소비하지 않았다**(Admin 분기는 항상 `"fill"` — [admin-persist-service L159~163](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts), User ephemeral 은 persist 0). [T-0333](../tasks/T-0333-reevaluate-flag-dto.md)(slice 1)이 이 vestigial(unwired) 사실을 발견·박제했고([controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 의 "no-bake" 테스트가 ignore 를 명시 검증했었다), vestigial 정리 결정을 slice 2 architect 의 본 amendment 로 위임했다. (혼동 주의: 별도 [EvaluateActivitiesDto](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) 의 `mode` 는 evaluate endpoint 에서 `persist(..., mode)` 로 **wired — 정상이며 본 amendment 대상이 아니다**.)
- **(ii) 결정 — 제거 채택**: vestigial `mode` field(+ DTO-local `BridgePersistMode` type alias, 외부 미사용)를 PeriodBridgeDto 에서 **제거** 한다. 근거 — (a) §Decision1 의 진짜 request 계약은 `reevaluate?: boolean` 단일 flag 다(period bridge contract = `personId/period/scope/periodStart/reevaluate` **5 키**). (b) §Alternatives B 가 period 계약의 enum mode field 를 이미 미채택했다 — vestigial enum-string 을 deprecated 로 유지하는 안은 그 미채택 결정과 모순되는 dual-contract(boolean flag + enum mode 공존)를 남겨 drift risk 만 낳는다(caller 가 `mode: "reeval"` 을 보내고 재평가를 기대하나 unwired 라 아무 일도 일어나지 않는 silent 혼란). deprecate 유지 안은 이 근거로 **미채택**. (c) persist-service 의 `PersistMode = "fill" | "reeval"`(ADR-0033 §3)은 orchestration 내부 계약으로 **불변** — 제거 대상은 period bridge 의 request surface 뿐이다.
- **(iii) caller 가시 효과**: 제거 후 `mode` 를 제공하는 payload 는 controller-scope ValidationPipe(`whitelist` + `forbidNonWhitelisted`)의 **정의 외 필드로 400 거부** 된다 — 종전(`@IsIn` 통과 후 silent ignore)보다 의도가 명확하다(§Decision4 fail-closed 정신과 동형: "요청했으나 무시됨" 의 silent 혼란 차단). 기존에 `mode` 를 보내던 caller 는 없으므로(unwired + 미문서화 speculative field) 호환성 파괴 표면은 사실상 0 이다.

### Decision §2 — persistence semantics: ADR-0033 `reeval` PersistMode(reset-and-recreate) 재사용, in-place mutation 아님, 새 primitive 0

**채택: overwrite 는 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 가 이미 정의·구현한 **`reeval` PersistMode(reset-and-recreate)** 를 그대로 재사용한다 — 좌표 존재 시 `$transaction` 안에서 기존 Assessment delete(component Contribution 은 `onDelete: Cascade` 동반 삭제) → fresh Assessment + Contribution create. **새 persist primitive 를 도입하지 않으며**([EvaluationResultPersistService.persist](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 시그니처 변경 0), bridge 가 `mode: "reeval"` 을 넘길 뿐이다. **in-place mutation(`update`)이 아니라 delete→create** 이므로 [ADR-0006](ADR-0006-assessment-data-model.md) immutability 를 존중한다.**

semantics 박제:

- **reset-and-recreate 재사용(새 primitive 0)**: `persist(context, results, "reeval")` 은 이미 머지된 경로다([persist-service L150~183](../../src/assessment-evaluation/evaluation-result-persist.service.ts)). 좌표 존재 시 `tx.assessment.delete({ where: { id: existing.id } })` → `createAssessment(tx, mapped)`, 좌표 부재 시 일반 create. bridge 는 현재 `"fill"` 만 넘기는([admin-persist-service L159~163](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts)) 자리에 `reevaluate === true` 일 때만 `"reeval"` 을 넘기는 분기를 추가할 뿐 — **persist service 시그니처/구현 변경 0**.
- **in-place mutation 아님(ADR-0006 immutability 존중)**: `Assessment` 는 immutable(ADR-0006 §1 — `updatedAt` 미정의, repository 에 `update` 메서드 부재). reeval 은 `update` 가 아니라 **delete→create** 이므로 immutable 모델과 정합한다(ADR-0033 §3·§AlternativesD 이미 박제 — "upsert 의 update 분기는 immutable 과 부적합, reset-and-recreate 가 sanctioned"). 본 ADR 은 이 정합을 재확인.
- **단일 `$transaction` atomicity 재사용**: delete→create 는 [persist-service](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 의 단일 `$transaction` 안에서 일어나 부분 실패 시 이전 평가가 유실되지 않는다(ADR-0033 §3 atomicity). 본 ADR 은 이 atomicity boundary 를 재사용할 뿐 새로 정의하지 않는다.
- **mapper/집계 재사용**: reeval 경로의 fresh create 도 first-write-wins 경로와 동일한 `mapEvaluationResultsToAssessment` 매퍼·집계·Decimal round 정책([persist-service](../../src/assessment-evaluation/evaluation-result-persist.service.ts) NIT(a)/(b))을 탄다 — 평가 산출의 영속 매핑이 mode 무관하게 일관.

### Decision §3 — first-write-wins(ADR-0037 §Decision3)와의 관계: default 유지 + 명시적 opt-out

**채택: default 동작은 [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision3 의 first-write-wins read-through(create-if-absent-else-read)로 **그대로 유지** 되고, overwrite 는 그 **명시적 opt-out** 이다 — caller(Admin)가 `reevaluate === true` 를 명시할 때만 bridge 가 read-through 하지 않고 reset-and-recreate(`mode: "reeval"`)를 호출한다. 두 mode 는 같은 endpoint 에서 flag 로 공존한다(default first-write-wins / explicit reevaluate).**

공존 박제:

- **default first-write-wins 보존(회귀 0)**: `reevaluate` 미지정/`false` → bridge 는 현 동작 그대로([admin-persist-service](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) `persistAndReadThrough`, `mode: "fill"`) — 좌표 부재 시 create+persist+read-back(`created=true`), 좌표 존재 시 no-op + 기존 저장본 read-back(`created=false`, write 0). ADR-0037 §Decision3 동작이 default 로 보존되므로 기존 caller 의 동작 변화 0.
- **explicit opt-out(reevaluate)**: `reevaluate === true` → bridge 는 read-through 를 건너뛰고 `mode: "reeval"` 로 persist 한다 — 좌표 존재 시 기존 평가문을 reset-and-recreate(파괴적 교체), 좌표 부재 시 일반 create. 즉 opt-out 은 "좌표 존재 시 read 대신 replace" 를 의미한다.
- **좌표 부재에서 reevaluate 요청 시 동작**: 좌표가 존재하지 않는 상태에서 `reevaluate === true` 가 와도 **에러가 아니다** — destructive 대상(기존 row)이 없으므로 `reeval` 의 부재 분기가 일반 create 로 동작한다(`fill` 의 좌표-부재 create 와 동일 결과: 새 Assessment 생성). 즉 reevaluate 는 "존재하면 replace, 부재하면 create" 로 정의되며, 부재 좌표를 거부하지 않는다(idempotent 진입 — "재평가" 의도가 첫 평가로 안전하게 degrade). 이 동작은 [persist-service L169~182](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 의 `existing === null` 분기가 이미 보장한다(reeval 도 부재 시 create 로 fall-through).
- **두 mode 의 호출 경계**: first-write-wins(`"fill"`)와 reeval(`"reeval"`)은 같은 bridge service 의 단일 분기점에서 갈린다 — `persistAndReadThrough` 가 `reevaluate` flag 에 따라 mode 를 선택하고, reeval 경로는 read-through fall-back(P2002 catch→read) 대신 reset-and-recreate 후 read-back 한다(§Decision5 동시성). 구조적 분기 1 개로 두 mode 가 공존한다(impl slice 2 책임).

### Decision §4 — RBAC: 재평가는 Admin only(ADR-0037 §Decision1 guard 재사용), User ephemeral 은 N/A, User flag negative 경계

**채택: 재평가는 **Admin only** 다 — [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision1 의 Admin full-persist guard(`@Roles("Admin")` 보호 경로)를 그대로 재사용한다(새 guard/role 도입 0). User self-only ephemeral 경로는 영속화 자체를 안 하므로(항상 write 0) 재평가 대상이 없어 N/A 다 — User 가 `reevaluate` flag 를 넘겨도 ephemeral 경로라 영속 변경이 일어나지 않는다(또는 fail-closed reject). 이 negative 경계를 박제한다.**

RBAC 박제:

- **Admin only(기존 guard 재사용)**: 재평가는 영속 상태를 파괴적으로 교체하므로(기존 평가 row delete) 영속화 권한이 있는 **Admin** 만 trigger 할 수 있다. ADR-0037 §Decision1 의 Admin full-persist 경로(`@Roles("Admin")` + persist 도달)에 이미 RBAC 이 걸려 있고, 재평가는 그 경로의 persist mode 만 바꾼 것이므로 **새 guard/role 도입 0** — 기존 Admin guard 를 그대로 재사용한다.
- **User ephemeral 은 N/A**: ADR-0037 §Decision1 의 User self-only ephemeral 경로는 어떤 write path 도 타지 않는다(영속 write 0, generate-and-return). 영속화 자체가 없으므로 **재평가 대상(영속 row)이 존재하지 않는다** — User 경로에 재평가 의미가 정의되지 않는다(N/A).
- **User 가 reevaluate flag 를 넘기는 경우(negative 경계)**: User 경로는 구조적으로 [PeriodBridgeEphemeralService](../../src/assessment-evaluation/period-bridge-ephemeral.service.ts)(persist symbol 미주입 — ADR-0037 §Decision1 구조적 write-0)를 타므로, User 가 `reevaluate: true` 를 넘겨도 **영속 변경이 일어나지 않는다**(ephemeral 분기에 persist 도달 불가). 두 처리 옵션 중 v1 은 (i) **ephemeral 경로에서 reevaluate flag 를 무시**(영속 변경 0 — read-only 모델 보존)하거나 (ii) **fail-closed reject**(User 가 reevaluate 를 요청하면 400/403 — "재평가는 Admin only" 명시) 중 하나를 impl slice 가 택한다. **권장: (ii) fail-closed reject** — "User 가 재평가를 요청했으나 무시됨" 은 silent 혼란을 낳으므로, User + `reevaluate: true` 는 명시적 reject(403)가 의도 명확. 단 어느 쪽이든 **영속 변경 0** 은 구조적으로 보장된다(ephemeral persist 도달 불가). impl slice 가 R-112 negative test(User + reevaluate → reject 또는 영속 row 증가 0)로 강제 검증한다.

### Decision §5 — idempotency/concurrency + safety: `$transaction`/`@@unique` 직렬화 재사용 + 파괴적 교체 v1 acceptable + audit follow-up

**채택: 동시 reevaluate 호출의 직렬화는 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 의 `$transaction` + `Assessment.@@unique` substrate 를 재사용한다(새 동시성 제어 도입 0). overwrite 가 **기존 평가문을 파괴**(이전 평가 row delete)함을 명시하고, **v1 에서 그것을 acceptable** 로 결정한다 — 평가문은 LLM/Agent 생성물이고 Admin 의 의도적 명시 요청(`reevaluate: true`)이므로 churn-방지 first-write-wins 의 **의도적 우회**다. 파괴된 이전 평가의 **audit trail(이력 보존)은 별도 follow-up** 으로 §Follow-ups 에 flag(v1 범위 밖 — 새 data-model 결정 동반).**

idempotency/safety 박제:

- **동시 reevaluate 직렬화(`$transaction` + `@@unique` 재사용)**: 두 reevaluate 호출이 같은 좌표로 동시에 들어오면, [persist-service](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 의 단일 `$transaction` 안의 delete→create 가 DB transaction 격리 + `@@unique([personId, period, scope, periodStart])` 로 직렬화된다 — 한쪽이 delete→create 를 commit 하는 동안 다른 쪽은 격리되고, 경합 시 P2002 가 발생하면 [persist-service L129~134](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 가 ConflictException 으로 변환한다. **새 application lock / advisory lock 도입 0** — ADR-0033 의 기존 substrate 재사용. (단 reeval 경로의 동시성 수렴 semantics — 두 reevaluate 가 모두 성공하면 마지막 write 가 이기는 last-write-wins vs 한쪽 P2002 reject — 은 impl slice 5 e2e 가 실 PostgreSQL 로 실측해 박제한다. reeval 의 race window 는 fill 의 first-write-wins read-through 와 달리 "둘 다 delete→create 시도" 라 직렬화 결과가 fill 과 다를 수 있다 — e2e 검증 대상.)
  - **Amendment (2026-06-11, T-0337 slice 4 실측)**: 같은 좌표 동시 reevaluate 2건(`Promise.all`)의 수렴 semantics 를 [test/e2e/period-bridge-reevaluate.e2e-spec.ts](../../test/e2e/period-bridge-reevaluate.e2e-spec.ts) 가 실 PostgreSQL 로 실측한다(ADR-0004 — run 증거는 본 slice 4 PR 의 CI `test:e2e` run green). 관측은 timing 에 따라 **비결정** — (i) 둘 다 200(자연 직렬화 last-write-wins: 뒤 commit 이 앞 row 를 재교체) 또는 (ii) 한쪽 P2002→409 Conflict(reeval 경로는 read-through 위장 없이 전파). **두 outcome 모두 valid 수렴** 으로 박제한다 — invariant(성공 ≥ 1건 + 최종 row 정확히 1 + 좌표 보존 + 최소 1회 replace + 유실/silent 부패 0)를 e2e 가 assert 하며, 그 외 outcome(예: 500 누출)은 invariant 위반으로 e2e red 가 노출한다.
- **파괴적 교체 v1 acceptable**: reevaluate 는 좌표 존재 시 **이전 평가 row 를 delete**(component Contribution cascade 동반 삭제)한다 — 이전 평가문은 복구 불가능하게 사라진다. **v1 은 이를 acceptable 로 결정** 한다. 근거: (a) 평가문은 사람의 수기 입력이 아니라 **LLM/Agent 생성물**이므로(Q-0032 근거 재인용) 같은 입력으로 재생성 가능하고 손실의 의미가 다르다, (b) 재평가는 churn-방지 default(first-write-wins)의 **의도적 우회** — Admin 이 `reevaluate: true` 를 명시해야만 발생하므로 우발적 파괴가 아니다, (c) ADR-0006 immutability + ADR-0033 reset-and-recreate 가 이미 "재평가 = hard delete 후 재생성, versioning 미채택"(ADR-0033 §AlternativesB)을 박제했으므로 본 ADR 은 그 결정의 연장이다.
- **audit trail / version history 는 §Follow-ups(v1 범위 밖)**: 파괴된 이전 평가문을 보존/조회하려면 새 data-model 결정(history table 또는 version 컬럼)이 동반된다 — ADR-0033 §AlternativesB 가 versioning 을 미채택했고 그 격상은 별도 ADR 이 선결돼야 한다. 본 ADR 은 audit 필요 시 §Follow-ups 의 DEFERRED 항목으로 flag 만 하고 v1 에 구현하지 않는다(새 schema/migration 미동반 — §Decision6 §5 경계 보존).
- **first-write-wins idempotency 불변**: reevaluate opt-out 은 first-write-wins(`"fill"`) default 의 idempotency(같은 좌표 재호출 row 증가 0)를 바꾸지 않는다 — reevaluate 는 명시 flag 일 때만 발화하므로, default 경로의 idempotency 는 ADR-0037 §Decision3 그대로 보존된다.

### Decision §6 — 새 dependency / schema / credential 경계: 모두 0 (§5 BLOCKED 게이트 미발화)

**채택: 본 overwrite capability 의 impl chain 은 **새 외부 dependency 0**(기존 `reeval` PersistMode + 기존 entity·`@@unique`·guard 재사용) / **외부 credential 0** / **DB schema 변경 0**(새 table·컬럼·unique·migration 미동반)으로 완결된다. [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트의 어느 축(dep/schema/credential)도 발화하지 않는다. live-LLM 검증만 후속 §5 credential 게이트(본 chain 밖).**

경계 박제:

- **새 dependency 0**: 재평가는 기존 `EvaluationResultPersistService.persist(..., "reeval")` + 기존 period bridge service + DTO field 1 개 추가일 뿐, 새 npm 패키지를 요구하지 않는다.
- **DB schema 변경 0**: `reeval` 경로는 기존 `Assessment`/`Contribution` entity + `@@unique([personId, period, scope, periodStart])` + `onDelete: Cascade` 를 그대로 사용한다 — 새 table·컬럼·unique·migration 미동반(audit/version history 를 구현했다면 schema 변경이 동반되나, 그것은 §Decision5 가 v1 범위 밖으로 분리). §5 BLOCKED 게이트의 schema-migration 축 발화 0.
- **외부 credential 0**: impl chain 은 mocked-LLM unit + CI 실 PostgreSQL([ADR-0004](ADR-0004-smoke-e2e-db-mode.md), DATABASE_URL 기 주입)으로 검증된다 — 새 credential 0.
- **live-LLM 검증은 §5 credential deferred**: 실 endpoint 로 재평가를 1 회 round-trip 해 새 평가문 품질을 확인하는 것은 실 API key 주입이 필요하므로 별도 후속 §5 credential task 로 분리(ADR-0037 §Decision5 live-LLM deferred mirror). 본 chain 은 전부 mocked-LLM unit + e2e 실 PostgreSQL 로 완결.

## Consequences

### 긍정

- **의도적 재평가가 가능해진다** — ADR-0037 §Decision3 trade-off(first-write-wins 가 의도적 재평가를 막음)가 닫힌다. 평가 알고리즘 개선·활동 정정·Admin 명시 요청 시 좌표를 새 평가로 교체할 경로가 생긴다.
- **default first-write-wins 동작 회귀 0** — reevaluate 는 명시 opt-in(`default false`)이므로 기존 caller 의 동작이 바뀌지 않는다(§Decision3). ADR-0037 §Decision3 의 churn-방지 idempotency 가 default 로 보존된다.
- **새 persist primitive 0 / 새 guard 0 / 새 endpoint 0** — 기존 `reeval` PersistMode + 기존 Admin guard + 기존 period endpoint 의 DTO field 추가만으로 완결된다(재사용 우월). persist service·guard·controller 시그니처 변경 최소.
- **새 dependency 0 / 새 credential 0 / 새 schema 변경 0** — CLAUDE.md §5 BLOCKED 게이트를 어느 축도 발화하지 않는다(§Decision6).
- **ADR-0006 immutability 정합** — reeval 은 in-place update 가 아니라 delete→create(sanctioned)이므로 immutable 모델과 충돌 0(ADR-0033 §3 연장).

### 부정 / trade-off

- **파괴적 교체 — 이전 평가문 복구 불가** — reevaluate 는 이전 평가 row 를 hard delete 하므로(versioning 미채택, ADR-0033 §AlternativesB 연장) 평가 이력이 남지 않는다. v1 은 acceptable 로 결정(평가문은 LLM/Agent 생성물 + Admin 명시 요청)하나, 이력 추적이 실제 요구로 부상하면 audit/version history ADR 이 별도 선결돼야 한다(§Follow-ups DEFERRED).
- **reeval 동시성 수렴이 fill 과 다를 수 있음** — first-write-wins(`"fill"`) read-through 는 loser 가 P2002 catch→read 로 winner 저장본에 수렴하지만, 두 reevaluate(`"reeval"`)가 동시에 "둘 다 delete→create" 를 시도하는 race 의 수렴 semantics(last-write-wins vs P2002 reject)는 fill 과 달라 impl slice 5 e2e 가 실 PostgreSQL 로 실측·박제해야 한다(§Decision5). 잘못 구현 시 한 호출의 평가가 silent 유실되거나 P2002 가 caller 로 새는 risk → e2e + R-112 negative 강제.
- **User + reevaluate 의 처리 모호성** — User 가 reevaluate flag 를 넘기는 경우 (i) 무시 vs (ii) fail-closed reject 의 선택을 impl slice 로 미룬다(§Decision4 권장 (ii)). 잘못 두면 User 가 "재평가했다고 믿지만 아무 일도 안 일어남" 의 silent 혼란 risk → impl slice 가 fail-closed reject + R-112 negative test 로 명확화(reviewer 점검 대상).

### Cross-Module Impact

본 결정은 새 export contract 를 **파괴하지 않고 추가**한다(period bridge DTO 에 optional field 1 개 + bridge service 에 mode 분기 1 개). hard rule(cross-module impact)의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다 — `EvaluationResultPersistService.persist`(이미 `PersistMode = "fill" | "reeval"` 수용) / `PeriodBridgeAdminPersistService` / Admin guard 의 기존 시그니처를 모두 **재사용(변경 0 또는 optional 추가)** 한다.

- **영향 module = 1 module 한정(`assessment-evaluation`, ≥3 spread 아님 → BLOCKED 미해당)**: period bridge DTO(field 추가) + bridge orchestration service(mode 분기) + controller(flag dispatch)가 모두 `assessment-evaluation` 안이다. persist service(`reeval` 이미 구현)·entity·guard 는 read-only 재사용(변경 0).
- **shared symbol 재사용(변경 0/optional)**: `EvaluationResultPersistService.persist` / `PersistMode`(`"reeval"` 이미 존재) / `PeriodBridgeAdminPersistService.generateAndPersist` / Admin `@Roles("Admin")` guard / `Assessment.@@unique` / `onDelete: Cascade` — 전부 재사용, 파괴적 변경 0.

### 새 dependency risk flag (CLAUDE.md §5)

- 새 dependency 0 — 기존 `reeval` 경로 + 기존 entity·guard 재사용만으로 전 chain 완결. 본 milestone 은 §5 dep/schema/credential 게이트를 어느 축도 발화하지 않는다(§Decision6).

## Alternatives considered

### A. 별도 재평가 endpoint 신설(`POST /api/assessment-evaluation/period/reevaluate`) (미채택)

재평가를 기존 period bridge DTO 의 flag 가 아니라 **별도 endpoint** 로 노출하는 안. 미채택 — (a) 재평가는 first-write-wins 와 **같은 collect→evaluate→persist 흐름**이고 persist mode 만 다르므로, 별도 endpoint 는 collect/evaluate 로직을 중복시키거나 공유 service 를 재호출하는 추가 wiring/guard/route 비용만 낳는다, (b) 기존 controller dispatch(ADR-0037 slice 3)와 Admin RBAC guard 를 재사용하면 새 route/guard 0, (c) DTO field 추가(`reevaluate?: boolean default false`)가 default first-write-wins 보존을 더 명확히 표현한다. 별도 endpoint 는 contract surface 를 늘리고 두 경로의 drift risk 를 만든다 — flag 안이 재사용·단순성에서 우월(§Decision1 채택).

### B. enum mode field(`mode: "first-write-wins" | "reevaluate"`) (boolean 대신) (미채택, v1)

DTO field 를 boolean(`reevaluate`)이 아니라 enum(`mode`)으로 두는 안. 부분적으로 매력적(향후 3+ 모드 확장 시 자연)이나 v1 미채택 — v1 은 두 모드(first-write-wins / reevaluate)뿐이라 `boolean reevaluate (default false)` 가 더 단순하고 default 표현이 명확하다. partial-reset trigger 등 3+ 모드가 실제 요구로 부상하면 enum 으로 격상(§Follow-ups). boolean→enum 격상은 비파괴적(optional field 추가)이므로 v1 을 boolean 으로 시작해도 future-proof.

### C. versioning(이전 평가 보존 + version 컬럼)으로 재평가 표현 (미채택, v1)

재평가마다 이전 평가 row 를 보존하고 `version` 컬럼을 증분해 이력을 남기는 안. 미채택(v1) — ADR-0006 이 Assessment 를 immutable + "재평가는 hard delete 후 재생성" 으로 박제했고(ADR-0033 §AlternativesB 가 이미 versioning 미채택), versioning 은 그 결정과 충돌해 별도 ADR(ADR-0006/0033 amend)이 선결돼야 한다 + 새 schema(history table/version 컬럼) + migration 을 동반해 CLAUDE.md §5 schema-migration 게이트를 발화한다. 본 v1 은 reset-and-recreate(파괴적 교체)를 채택하고 audit/version history 는 §Follow-ups DEFERRED 로 분리한다(필요 시 별도 ADR 격상).

### D. in-place update(`Assessment.update`)로 재평가 표현 (미채택)

기존 Assessment row 를 `update` 로 갱신해 재평가를 표현하는 안. 미채택 — `Assessment` 는 immutable(ADR-0006 §1, `update` 메서드/`updatedAt` 부재)이고, `update` 는 component `Contribution[]` 의 reset 을 cascade 하지 않아(ADR-0033 §AlternativesD upsert 미채택과 동형) 기존 Contribution 이 stale 로 남는다. reset-and-recreate(delete cascade → create)가 자식까지 정확히 정리하므로 의미가 명확 — `update` 대신 `reeval` 재사용(§Decision2 채택).

## References

- [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) — period→collection→evaluate bridge + §Decision1 Admin RBAC guard + §Decision3 first-write-wins read-through + §Follow-ups DEFERRED overwrite(본 ADR 이 승격).
- [ADR-0033](ADR-0033-evaluation-result-persistence.md) — `reeval` PersistMode(reset-and-recreate: `$transaction` delete→create) + fill 모드 + partial-reset + P2002→ConflictException(본 ADR 이 재사용하는 persist primitive) + §AlternativesB versioning 미채택.
- [ADR-0006](ADR-0006-assessment-data-model.md) — Assessment/Contribution immutable + `@@unique`/`onDelete: Cascade`(reset-and-recreate 가 immutable 변경의 sanctioned 방식임의 source).
- [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL(impl chain e2e 검증 source).
- [ADR-0008](ADR-0008-rbac-role-hierarchy.md) — RBAC tier(Admin/User) — Admin only 재평가 권한의 role source.
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) — `persist`/`PersistMode`(fill·reeval) — 재사용 primitive.
- [src/assessment-evaluation/period-bridge-admin-persist.service.ts](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) — 현 first-write-wins read-through(mode 항상 "fill") — reeval opt-out 분기를 추가할 anchor.
- [src/assessment-evaluation/period-bridge-ephemeral.service.ts](../../src/assessment-evaluation/period-bridge-ephemeral.service.ts) — User ephemeral(persist 미주입, 구조적 write-0) — User reevaluate negative 경계.
- [src/assessment-evaluation/dto/period-bridge.dto.ts](../../src/assessment-evaluation/dto/period-bridge.dto.ts) — period bridge DTO — `reevaluate?: boolean` field 추가 anchor.
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — period endpoint + Admin RBAC guard — flag dispatch anchor.
- [README.md](../../README.md) R-9(임의 기간 평가문 요청) / 보안 특성(평가 trigger=Admin / User read-only) — 외력.
- [docs/PLAN.md](../PLAN.md) P5 — R-9 임의 기간 평가문 요청.
- [Q-0033](../STATE.json) — 본 overwrite/재평가 설계 진입 승인(옵션 1). [Q-0032](../STATE.json) — first-write-wins 확정 + overwrite DEFERRED(본 ADR 이 승격).
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책.

## Follow-ups

(ADR-0038 PROPOSED→ACCEPTED flip(§Status) 후 planner 가 dependency chain 으로 분해 — overwrite impl chain. 각 별도 task, ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover). dependency 순서.)

- [ ] **slice 1 — DTO mode/flag field** (`commitMode: pr`) — period bridge 입력 DTO([PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts))에 `reevaluate?: boolean`(default `false`) 추가 + class-validator(`@IsOptional()`/`@IsBoolean()`) + colocated spec(R-112 4 종 + negative: wrong-type `"yes"` → 400 / 정의 외 필드 → 400 / default `false` 보존).
- [ ] **slice 2 — orchestration reeval opt-out 분기** (`commitMode: pr`) — [PeriodBridgeAdminPersistService](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) 의 `persistAndReadThrough` 에 default first-write-wins(`"fill"`) / `reevaluate === true` 시 reset-and-recreate(`mode: "reeval"`) 분기 + mocked unit(R-112: flag 분기 / Admin only / 좌표 부재 시 create(reeval degrade) / 좌표 존재 시 reset-and-recreate / User flag negative).
- [ ] **slice 3 — controller wiring(mode field dispatch)** (`commitMode: pr`) — [AssessmentEvaluationController](../../src/assessment-evaluation/assessment-evaluation.controller.ts) period 분기가 `reevaluate` field 를 orchestrator 에 dispatch + User + reevaluate fail-closed reject(§Decision4 (ii)) + colocated controller unit(orchestrator mock).
- [ ] **slice 4 — e2e** (`commitMode: pr`, ADR-0004 실 PostgreSQL) — reevaluate 가 기존 평가문을 replace(row count 1 stable + content NEW) + default 호출은 여전히 first-write-wins(기존 read 반환) + 동시 reevaluate 수렴 semantics 실측(§Decision5 last-write-wins vs P2002 reject 박제) + User + reevaluate 영속 변경 0.
- [ ] **(DEFERRED) audit trail / 이전 평가 version history** — reevaluate 가 파괴한 이전 평가문을 보존/조회하는 경로(새 data-model 결정 동반 — version 컬럼 또는 history table + migration). v1 범위 밖(§Decision5) — 필요 시 별도 ADR(ADR-0006/0033 versioning amend 선결).
- [ ] **(§5 credential) live LLM reevaluate run** — 실 endpoint/key 주입 후 reevaluate 1 회 실제 round-trip 으로 새 평가문 품질 검증(deferred — Q-0022 시험 credential 만료 2026-06-30).
