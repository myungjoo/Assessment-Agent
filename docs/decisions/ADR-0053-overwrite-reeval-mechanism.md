---
id: ADR-0053
title: "overwrite / 이미 영속화된 평가문 재평가 mechanism — 명시 mode flag 시에만 reset-and-recreate(ADR-0033 §D3 재사용), 무플래그 default 는 first-write-wins 보존(ADR-0037 §D3 조건분기 supersede)"
status: PROPOSED
date: 2026-07-07
relatedTask: [T-0804]
relatedReq: [REQ-037, REQ-041, REQ-064]
supersedes: null
supersedesDecision: "ADR-0037 §Decision 3 (first-write-wins read-through) — 조건분기 supersede: 무플래그 default 는 보존, 명시 overwrite/reeval mode 진입 시에만 대체"
augments: [ADR-0033, ADR-0048]
---

# ADR-0053 — overwrite / 이미 영속화된 평가문 재평가 mechanism

> 본 ADR 은 **PROPOSED** — 오너가 2026-07-07 [Q-0051](../STATE.json) 옵션 5 로 [PLAN line 107](../PLAN.md) "(DEFERRED) overwrite / 이미 영속화된 평가문 재평가" 의 DEFERRED 를 해제하고 재개를 승인(권장 착수 1순위)한 방향의 **ADR-first 첫 slice** 다. 이미 영속화된 좌표 `(personId, period, scope, periodStart)` 에 대해 **덮어쓰기/재평가** 를 어떻게 표현할지의 mechanism 만 decide 하며 **production code · DB migration 0 LOC** 다(decision-only ADR). 구현(bridge 진입점 overwrite 분기 → e2e idempotency → PLAN status sync)은 §Follow-ups 의 dependency-free chain 으로 분해되며 각 slice 는 ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover)으로 강제한다. 본 ADR 은 [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision 3(first-write-wins read-through)을 **조건분기 supersede**(무플래그 default 는 보존, 명시 mode flag 진입 시에만 대체)하고 [ADR-0033](ADR-0033-evaluation-result-persistence.md) §Decision 3(reset-and-recreate + fill/reeval 모드)의 write-layer semantics 를 **재사용(변경 0)** 하며 [ADR-0048](ADR-0048-default-model-id-source.md) §Decision 1(재평가 modelId source = LlmProviderConfig row)의 상호작용을 확정한다.

## Context

### 트리거 — 오너가 first-write-wins v1 의 DEFERRED overwrite 를 재개 승인했다

[ADR-0037 §Decision 3](ADR-0037-period-collection-evaluate-bridge.md) 은 [Q-0032](../STATE.json) 오너 결정으로 bridge 의 idempotency 를 **first-write-wins read-through(get-or-create)** 로 확정했다 — 같은 좌표에 두 번째 이후 호출이 들어오면 write 없이 기존 영속 평가문을 read 해 반환한다(churn 0, row 불변). 그때 오너는 "이미 write 한 것을 overwrite 하는 것은 나중에 고민하도록 plan 만 해두자" 로 overwrite/재평가를 **DEFERRED** 했고(ADR-0037 §Follow-ups 의 `(DEFERRED)` 항목), 그 결과 같은 좌표에 대한 **의도적 재평가**(최신 활동 반영 · 다른 modelId 로 재산출 · 오류 평가 정정)가 표현 불가능한 상태로 남았다.

2026-07-07 오너가 [Q-0051](../STATE.json) 에서 6 옵션 중 옵션 5 를 개방하며 **PLAN line 107 의 DEFERRED 를 해제**하고 overwrite/재평가 재개를 승인했다(권장 착수 1순위). 오너 지시는 명시적으로 **ADR-first**(별도 후속 ADR 선행 — [Q-0051 decision](../STATE.json) "(5) … Q-0032 first-write-wins v1 유지 결정 해제, 별도 후속 ADR 선행")다. 본 ADR 이 그 mechanism 결정을 박제한다.

### 핵심 사실 — 재평가 write semantics 는 이미 write-layer 에 존재한다 (bridge 진입점만 first-write-wins 로 막고 있다)

overwrite 는 "새 write path 를 발명" 하는 문제가 아니다 — **[ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md) 이 재평가 semantics 를 이미 완전히 박제**했고 그 구현 chain(T-0298~T-0302, PR #250~#253)이 main 에 안착돼 있다:

- **reset-and-recreate**: 같은 `(personId, period, scope, periodStart)` 4-tuple 로 재평가가 들어오면 기존 Assessment row 를 `delete`(component `Contribution[]` 은 `onDelete: Cascade` 동반 삭제) → 새 Assessment + Contribution[] `create`, 이 delete→create 를 **단일 `$transaction`** 으로 묶는다(atomicity — 부분 실패 시 이전 평가 미유실).
- **fill / reeval 모드 분기**: 영속화 입력의 flag(`mode: "fill" | "reeval"`)로 "없으면 채운다(fill)" 와 "강제 재평가(reeval)" 를 이미 구분한다 — [EvaluationResultPersistService.persist(context, results, mode)](../../src/assessment-evaluation/evaluation-result-persist.service.ts).
- **partial-reset**: `personId`+`period` prefix 부분 일치 delete(`@@unique` leading-edge + `@@index([personId, period, periodStart])`)로 "한 person 의 한 period 만 재평가, 다른 period 보존" 을 이미 표현한다.
- **idempotency**: 같은 입력 재실행 시 row 수 불변(reeval 모드 재실행은 delete→create 로 같은 1 row 유지).

즉 write-layer 는 `reeval` 을 이미 지원한다. **막고 있는 것은 bridge 진입점(orchestration) 단 한 곳** — ADR-0037 §Decision 3 이 Admin persist 진입을 **create-if-absent-else-read** 로 고정해, 좌표가 존재하면 `EvaluationResultPersistService.persist(..., "reeval")` 을 **호출하지 않고** 기존 저장본을 read 반환하도록 했기 때문이다(ADR-0037 §Decision 3 "reeval(overwrite)을 호출하지 않는다 … reeval 은 본 v1 범위 밖으로 DEFERRED"). 따라서 본 ADR 의 결정은 "새 mechanism 도입" 이 아니라 **bridge 진입점이 언제 first-write-wins 대신 reeval 경로를 타는지의 진입 조건과 경계** 를 decide 하는 것이다.

### 외력

- **[Q-0051 decision](../STATE.json)** — 오너 2026-07-07 옵션 5 승인(DEFERRED 해제 + overwrite/재평가 재개 + ADR-first 선행, 권장 착수 1순위). 본 ADR 의 진입 근거.
- **[ADR-0037 §Decision 3](ADR-0037-period-collection-evaluate-bridge.md)** — first-write-wins read-through(본 ADR 이 조건분기 supersede 할 대상) + §Follow-ups 의 `(DEFERRED)` overwrite 항목(오너가 "좌표 중복 호출 = 기존 반환 계약" 을 v1 으로 확정한 배경).
- **[ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md)** — Assessment 단위 reset-and-recreate(delete-if-exists → create, 단일 `$transaction`) + fill/reeval 모드 분기 + partial-reset + `@@unique([personId, period, scope, periodStart])` 재사용. 재평가 write semantics 의 **이미-박제된 source**(본 ADR 이 변경 0 으로 재사용).
- **[ADR-0048 §Decision 1](ADR-0048-default-model-id-source.md)** — 재평가 시 modelId source = `LlmProviderConfig` row 의 `modelId`(단일-row 운용 + resolver 1 회 해석), 다중-row default 정책 deferred(REQ-051 진입 시 후속 ADR). 재평가 mechanism 과의 상호작용 지점.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 결정의 채택안은 **schema migration 0 / 새 dependency 0 / 새 credential 0**(기존 `@@unique` + reset-and-recreate 재사용). §5 게이트 처리는 §Consequences 참조.
- **REQ-037 / REQ-041 / REQ-064** ([README.md](../../README.md)) — "평가 없는 부분 일괄 평가 + Reset & Reeval" / "Admin manual delete" / "평가 재실행·부분 reset". overwrite/재평가의 요구 출처.

## Decision

### Decision §1 — replace-existing semantics: 명시 mode flag 진입 시 ADR-0033 §D3 reset-and-recreate 재사용, 진입 경로 = bridge orchestration 의 mode 인자

**채택: overwrite/재평가는 새 write path 를 발명하지 않고 [ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md) 의 reset-and-recreate(delete-if-exists → create, 단일 `$transaction`, cascade 로 component Contribution[] 동반 정리)를 그대로 재사용한다. 진입 경로는 bridge orchestration service 가 받는 명시 mode 인자(예: `mode: "reeval" | "overwrite"`)이며, 그 mode 가 설정된 요청만 `EvaluationResultPersistService.persist(context, results, "reeval")` 을 호출한다.**

- **재사용 대상 = 이미 main 에 있는 write-layer**: `EvaluationResultPersistService.persist(context, results, mode)` 의 `reeval` 모드가 delete→create 를 단일 `$transaction` 으로 수행한다(ADR-0033 §D3, T-0300 PR #252 머지). 본 ADR 은 이 서비스의 시그니처·동작을 **변경 0** 으로 재사용한다 — overwrite 는 곧 "bridge 진입점이 이 기존 reeval 경로를 조건부로 호출하도록 배선" 하는 것이다.
- **진입 경로 = bridge orchestration 의 mode 인자**: ADR-0037 이 박제한 bridge orchestration service(Admin full 경로)가 request 로부터 mode 를 받아 (a) mode 부재/`fill` → ADR-0037 §Decision 3 first-write-wins read-through(create-if-absent-else-read, §Decision 4 참조), (b) mode == `reeval`/`overwrite` → 좌표 존재 여부와 무관하게 fresh collect → evaluate → `persist(..., "reeval")`(존재 시 delete→create, 부재 시 create) 로 분기한다. mode 의 정확한 이름·enum·DTO 표면은 구현 slice 결정(본 ADR 은 "명시 mode 인자가 존재하고 그것이 reeval 경로 진입을 gate 한다" 만 박제).
- **RBAC 경계 = Admin only(overwrite 는 write path)**: overwrite/재평가는 영속 상태를 변경하는 write path 이므로 ADR-0037 §Decision 1 의 RBAC 를 그대로 따른다 — **Admin full 경로에서만** 허용된다. User self-only ephemeral 경로는 애초에 DB write 0(persist 미호출)이라 overwrite 개념 자체가 발생하지 않는다(ephemeral 산출물은 저장되지 않으므로 "이미 영속화된 좌표" 가 없다). "누가 재평가를 trigger 할 권한이 있는가"(ADR-0037 §Follow-ups `(DEFERRED)` 의 미결 질문 a)의 답은 **Admin**(기존 RBAC 재사용, 새 role/권한 모델 0).

### Decision §2 — idempotency 경계: overwrite 모드에서 같은 입력 재실행 시 row 수 불변(ADR-0033 idempotency key 재사용)

**채택: overwrite/reeval 모드에서 같은 좌표 `(personId, period, scope, periodStart)` 로 같은 입력을 재실행해도 최종 row 수는 불변(정확히 1 Assessment + 그 component Contribution[])이다. idempotency key 는 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 의 기존 `Assessment.@@unique([personId, period, scope, periodStart])` 를 그대로 재사용하며 새 key 발명 0.**

- **row 수 불변 보장**: reeval 모드 재실행은 delete-if-exists → create 이므로 "이전 row 삭제 후 새 row 1 개 생성" = 항상 좌표당 정확히 1 Assessment row 를 유지한다(중복 row 축적 0). fill 모드 재실행이 no-op(이미 존재 시 write 0)인 것과 대칭으로, reeval 모드 재실행은 "덮어쓰되 row 수는 1 로 수렴" 이다(ADR-0033 §Decision 3 "idempotency 보장 = 같은 입력 재실행 시 row 수 불변" 의 reeval 축 재확인).
- **동시 overwrite race 직렬화**: 두 overwrite 호출이 같은 좌표로 동시에 들어오면 ADR-0033 의 `$transaction` + `@@unique` 가 직렬화한다 — 각 reeval transaction 은 delete→create 를 원자적으로 수행하고, DB isolation 이 두 transaction 을 순서화해 최종 상태는 나중 commit 한 transaction 의 결과 1 row 로 수렴한다(last-writer-wins **within overwrite mode**). 이는 ADR-0037 §Decision 3 의 first-write-wins(무플래그 default)와 대비된다 — overwrite mode 는 명시적으로 "덮어쓰기를 의도" 하므로 last-writer-wins 가 정합이다. 새 동시성 제어(application lock / advisory lock) 도입 0.
- **결정론 경계 flag**: overwrite 결과 자체는 fresh collect(§Decision 4, ADR-0037 §Decision 4 mirror)에 의존하므로 "같은 입력" 의 정의는 "같은 좌표 + 같은 수집 시점 활동 + 같은 modelId"(§Decision 5)다. 수집 활동이나 modelId 가 바뀌면 재평가 결과값은 달라질 수 있으나 **row 수 idempotency(좌표당 1 row)** 는 불변으로 보장된다 — 값의 결정론이 아니라 구조의 idempotency 를 본 §2 가 박제한다.

### Decision §3 — partial reset 경계: personId+period prefix 부분 재평가 시 다른 좌표 보존(ADR-0033 partial-reset 재사용)

**채택: `personId`+`period` prefix 부분 재평가(한 person 의 한 period 만 overwrite)는 [ADR-0033 §Decision 3](ADR-0033-evaluation-result-persistence.md) 의 partial-reset(`@@unique` leading-edge delete)을 그대로 재사용한다 — 대상 prefix 에 매칭되는 좌표만 reset-and-recreate 되고 다른 `period`/`scope`/`periodStart` 의 Assessment 는 보존된다("wiping others" 미발생).**

- **prefix 부분 일치 경계**: `@@unique([personId, period, scope, periodStart])` 의 leading-edge 가 `personId`·`period` 이고 `@@index([personId, period, periodStart])` 가 존재하므로, "한 person 의 한 period" 재평가는 그 prefix 에 매칭되는 좌표만 대상으로 한다(ADR-0033 §D3 "partial reset = key prefix 부분 일치 delete"). 다른 period/scope 좌표는 delete 대상에 포함되지 않아 구조적으로 보존된다.
- **재평가 대상 좌표 집합의 명시**: overwrite 요청이 (a) 단일 완전 좌표(4-tuple 전체 지정) → 그 1 좌표만, (b) prefix(personId+period) → 매칭 좌표 집합, 중 어느 것을 대상으로 하는지는 요청 표면에 명시돼야 한다(구현 slice DTO 결정). 본 ADR 은 "prefix 부분 재평가가 다른 좌표를 보존해야 한다" 는 경계 invariant 를 박제하며, 정확한 대상 표현(단일 vs prefix)은 구현 slice 가 R-112 negative test(다른 period 좌표 delete 미발생)로 강제 검증한다.
- **부분 read-during-reeval 일관성**: 재평가 중 동시 read(UC-02 조회)의 일관성(ADR-0037 §Follow-ups `(DEFERRED)` 미결 질문 c)은 `$transaction` 격리로 흡수된다 — reeval transaction 이 commit 되기 전까지 read 는 이전 좌표 상태를, commit 후에는 새 상태를 본다(transaction isolation 의 기본 보장). 새 lock/버전 도입 0. 단 read-during-reeval 의 phantom/재현성 경계 검증은 §Follow-ups e2e slice 가 cover(본 ADR 은 "transaction isolation 재사용" 만 박제).

### Decision §4 — ADR-0037 §Decision 3 supersede 관계: 조건분기 supersede — 무플래그 default 는 first-write-wins 보존, 명시 mode 시에만 reeval 로 대체

**채택: 본 ADR 은 [ADR-0037 §Decision 3](ADR-0037-period-collection-evaluate-bridge.md)(first-write-wins read-through)를 전면 폐기하지 않고 **조건분기 supersede** 한다 — bridge 진입점의 mode 인자에 따라 (a) mode 부재/`fill`(무플래그 default) → **ADR-0037 §Decision 3 first-write-wins read-through 를 그대로 보존**(create-if-absent-else-read, 좌표 존재 시 기존 read 반환, churn 0), (b) mode == `reeval`/`overwrite`(명시 지정) → **본 ADR §Decision 1 의 reset-and-recreate 로 대체**(좌표 존재 시 delete→create). 즉 default 동작은 불변이며 overwrite 는 opt-in 이다.**

- **왜 전면 폐기가 아니라 조건분기인가**: ADR-0037 §Decision 3 의 first-write-wins 근거([Q-0032](../STATE.json) 오너 발화 "이 활동/평가는 사람이 적는 것이 아니라 LLM/Agent 가 생성하는 산출물")는 여전히 유효하다 — 같은 좌표의 **무의도 중복 호출**(예: batch retry, 동시 fire)에 409 를 전파하거나 churn 을 발생시키는 대신 stored 결과로 수렴하는 것이 옳다. 본 ADR 은 그 default 를 유지하고, **의도적 재평가**(오너/Admin 이 명시 mode 로 요청)만 새 경로를 열어준다. 이로써 무플래그 caller(기존 bridge slice 2~5 의 create-if-absent-else-read)는 동작이 **바뀌지 않는다**(회귀 0) — ADR-0037 §Follow-ups slice 2~5 의 "create-if-absent-else-read(first-write-wins read-through)를 따르며 reeval/overwrite 가 아니다" 계약이 무플래그 경로에서 그대로 성립한다.
- **supersede 의 정확한 범위**: 대체되는 것은 ADR-0037 §Decision 3 의 "reeval(overwrite)을 호출하지 않는다 … reeval 은 본 v1 범위 밖으로 DEFERRED" 문장뿐이다 — 이 DEFERRED 문장이 본 ADR 의 명시 mode 진입으로 해제(unblock)된다. §Decision 3 의 나머지(무플래그 first-write-wins read-through + 동시 race P2002 catch → read fall-through)는 **전부 보존**된다. frontmatter `supersedesDecision` 이 이 조건분기 supersede 를 박제한다.
- **mode gate 의 fail-safe**: mode 가 인식 불가/모호하면 fail-closed 로 **default(first-write-wins) 경로** 를 탄다 — 즉 unknown mode 는 절대 overwrite 를 유발하지 않는다(우발적 데이터 파괴 차단). 명시적으로 인식된 `reeval`/`overwrite` mode 만 reeval 경로를 gate 하며, 이는 구현 slice 의 R-112 negative test(unknown/빈 mode → overwrite 미발생, 기존 좌표 delete 0)로 강제 검증된다.

### Decision §5 — ADR-0048 defaultModelId source 상호작용: 재평가 시 modelId 를 LlmProviderConfig row 에서 재해석(server-side resolver 재사용)

**채택: overwrite/재평가 시 사용할 modelId 는 [ADR-0048 §Decision 1](ADR-0048-default-model-id-source.md) 대로 server-side `LlmProviderConfigResolver` 가 `LlmProviderConfig` row 의 `modelId` 에서 **재평가 요청 진입 시점에 재해석**한다 — request body 에 default modelId 를 담지 않는다(ADR-0048 §Decision 3 제거 정합). caller 는 선택적 `modelId` override 만 제공할 수 있다.**

- **재해석 시점 = 재평가 요청 진입**: overwrite 는 fresh collect → evaluate(§Decision 4 mirror, ADR-0037 §Decision 4)를 새로 수행하므로, 그 evaluate 가 사용할 modelId 도 **재평가 요청 시점의 배포 설정(LlmProviderConfig row)에서 재해석**된다. 이는 "재평가 = 최신 배포 설정으로 재산출" 의 의미와 정합한다 — 원래 평가가 A model 로 됐어도 재평가 시점에 운영자가 row 를 B model 로 바꿨다면 재평가는 B 로 산출된다(운영자 의도 반영).
- **단일-row 운용 가정 + fail-fast 계승**: resolver 의 length 점검 3 분기(length 1 → 채택 / 0 → "provider 미설정" / ≥2 → "다중-row 미박제 후속 ADR 필요")를 그대로 계승한다(ADR-0048 §Decision 2). REQ-051(custom 3 model 슬롯) 진입 시 다중-row default 정책은 ADR-0048 §Decision 2 의 후속 ADR 이 prerequisite 로 남는다 — 본 overwrite ADR 은 그 정책을 선점하지 않는다.
- **caller override 표면 재사용**: 재평가 요청도 선택적 `modelId` override(ADR-0048 §Decision 3 유지)를 흡수한다 — Admin 이 "이 좌표를 특정 model 로 재평가" 하려면 override 를 제공하고, 부재 시 resolver 가 default 를 해석한다. 새 override 표면(header/query) 도입 0.

## Consequences

### 긍정

- **overwrite/재평가가 mechanism 으로 unblock** — ADR-0037 §Follow-ups 의 `(DEFERRED)` 항목이 조건분기 supersede(§Decision 4)로 해제된다. 오너 [Q-0051](../STATE.json) 옵션 5 승인이 실제 구현 chain 으로 진입 가능.
- **새 write path 발명 0 — 이미-박제된 write-layer 재사용** — reset-and-recreate(ADR-0033 §D3, main 에 안착)를 변경 0 으로 재사용하므로 overwrite 구현은 "bridge 진입점 조건분기 배선" 으로 축약된다. 새 알고리즘·새 서비스 0.
- **default 동작 회귀 0** — 조건분기 supersede(§Decision 4)로 무플래그 caller(bridge slice 2~5)는 first-write-wins 를 그대로 유지 — 기존 e2e/spec 이 깨지지 않는다(회귀 표면 0). overwrite 는 opt-in.
- **새 dependency 0 / 새 credential 0 / 새 schema 변경 0** — 기존 `@@unique` + reset-and-recreate + `$transaction` + `LlmProviderConfigResolver` 재사용. [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 어느 축도 발화하지 않는다.
- **재평가 modelId 가 배포 설정으로 단일화** — ADR-0048 §Decision 1 정합(§Decision 5) — 재평가 시점의 최신 LlmProviderConfig row 로 재해석돼 caller 인지 부담 0 + 운영자 의도 반영.

### 부정 / trade-off

- **versioning 미채택 — 이력 미보존 risk 재확인** — reset-and-recreate 는 이전 평가를 hard delete 하므로 overwrite 시 **이전 평가문 이력이 남지 않는다**(ADR-0033 §Consequences 부정 + [ADR-0033 §Alternatives B](ADR-0033-evaluation-result-persistence.md) versioning 미채택의 homolog). ADR-0037 §Follow-ups `(DEFERRED)` 의 미결 질문 b("기존 결과 보존/이력 관리")의 답은 **본 v1 에서 이력 미보존**이다 — overwrite 는 "덮어쓰기(replace-existing)" 이지 "이력 누적" 이 아니다. 평가 변화 추적(누가·언제·왜 재평가했는가)이 실제 요구로 부상하면 별도 history table ADR(ADR-0006 immutable amend/supersede 선결)로 격상해야 한다. 본 §은 그 risk 를 명시 박제하고 v1 은 immutable 정합(reset-and-recreate)을 우선한다.
- **last-writer-wins 의 동시 overwrite 혼동 가능** — overwrite mode 는 동시 호출 시 last-writer-wins(§Decision 2)로, 무플래그 first-write-wins 와 반대 방향이다. 두 정책이 mode 로 갈리므로, mode 를 잘못 지정하면 의도와 다른 수렴이 발생할 수 있다. mitigation: §Decision 4 fail-safe(unknown mode → default first-write-wins)로 우발적 overwrite 를 차단하고, 구현 slice 가 mode 분기를 명시 enum 으로 강제(silent 진입 불가)한다.
- **재평가 수집 비용 반복** — overwrite 도 fresh collect(§Decision 4 mirror)를 새로 수행하므로 수집 비용(GitHub/Confluence)을 다시 지불한다(ADR-0037 §Consequences 부정 mirror). freshness 근거(재평가는 최신 활동 반영이 목적)가 이를 정당화하며, 캐싱은 향후 별도 최적화(본 ADR 밖).
- **partial-reset 대상 표현의 구현 결정 잔여** — 단일 완전 좌표 vs prefix 부분 재평가(§Decision 3)의 정확한 요청 표면은 구현 slice 로 미룬다 — 잘못 두면 "wiping others" risk → 구현 slice 가 R-112 negative test(다른 좌표 delete 미발생)로 강제 검증해야 한다(reviewer 점검 대상).

### Cross-Module Impact

본 결정은 새 export contract 를 파괴하지 않고 **추가/조건분기** 한다(bridge orchestration 의 mode 인자 분기 + 기존 reeval 경로 조건부 호출). hard rule(cross-module impact)의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다 — `EvaluationResultPersistService.persist(context, results, mode)` / `Assessment.@@unique` / `$transaction` / `LlmProviderConfigResolver` 의 기존 시그니처를 모두 **import 재사용(변경 0)** 하며 bridge 는 그 위에 mode gate 분기를 **추가**한다.

- **영향 module = `assessment-evaluation` 국한(bridge orchestration + DTO)** — overwrite mode 인자 수신(DTO) + orchestration 의 mode 분기(reeval 경로 조건부 진입)가 유일한 변경 표면. `EvaluationResultPersistService`(reeval 모드 이미 존재)·`LlmProviderConfigResolver`(ADR-0048)·`AssessmentRepository`(ADR-0033)는 read-only 재사용(시그니처 변경 0).
- **shared symbol 재사용(변경 0, read-only)**: `EvaluationResultPersistService.persist` / `PersistMode`(fill/reeval) / `Assessment.@@unique` / `$transaction` / `LlmProviderConfigResolver` / `collectActivities` / `evaluateActivities` — 전부 import 재사용만, contract 변경 0.

### §5 schema 게이트 처리 (CLAUDE.md §5)

- **DB schema 변경 필요 여부 판정 = 불요(새 migration 0)**: 본 ADR 의 채택안(명시 mode 진입 + reset-and-recreate 재사용 + 기존 `@@unique` idempotency key 재사용)은 **어떤 새 table·컬럼·unique·index 도 요구하지 않는다**. reset-and-recreate 는 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 이 이미 박제한 `Assessment.@@unique([personId, period, scope, periodStart])` + `Contribution.@@unique([assessmentId, sourceRef])` + `onDelete: Cascade` 위에서 동작하며, 그 backbone 은 main 에 이미 배포돼 있다. 따라서 본 milestone 은 **[CLAUDE.md §5](../../CLAUDE.md) schema-migration 게이트를 발화하지 않는다** — "새 schema migration 0 — ADR-0033 의 기존 `@@unique` + reset-and-recreate 재사용" 을 명시 박제한다.
- **versioning 채택 시에만 schema 게이트 발화(미채택이므로 미발화)**: 만약 §Alternatives A(versioning append)를 채택했다면 `version` 컬럼 + `@@unique` 변경 = schema migration 게이트 발화(BLOCKED 사유 + 오너 승인 선행)가 필요했을 것이다. 본 v1 은 versioning 을 미채택(immutable 정합)하므로 그 게이트가 발화하지 않는다. 향후 이력 보존이 요구로 부상해 versioning 을 재고하면 **그 구현 task 진입 시 §5 schema 게이트를 재확인**해야 한다(본 §의 명시 박제 — 향후 versioning ADR 의 prerequisite).

## Alternatives considered

### A. versioning append (재평가마다 이전 row 보존 + version 컬럼 증분) (미채택)

overwrite 를 delete→create 가 아니라 이전 평가 row 를 보존하고 `version` 컬럼을 증분하는 append 로 표현하는 안(평가 이력 추적 가능). 미채택 — (1) [ADR-0006](ADR-0006-assessment-data-model.md) 이 Assessment 를 immutable + "재평가는 hard delete 후 재생성" 으로 이미 박제했고 versioning 은 그 결정과 충돌해 별도 ADR(ADR-0006 amend/supersede) 선결이 필요, (2) `version` 컬럼 + `@@unique` 변경 = [CLAUDE.md §5](../../CLAUDE.md) schema migration 게이트 발화(BLOCKED + 오너 승인 선행) → 본 decision-only ADR 이 즉시 schema 게이트에 걸림, (3) [ADR-0033 §Alternatives B](ADR-0033-evaluation-result-persistence.md) 가 이미 같은 이유로 versioning 을 미채택한 선례. 본 v1 은 reset-and-recreate(immutable 정합)를 재사용하고 이력 보존 risk 를 §Consequences 부정 항목에 박제 — 이력이 실제 요구로 부상하면 별도 history table ADR 로 격상(그 시점 §5 게이트 재확인).

### B. in-place update (기존 Assessment/Contribution row 를 update) (미채택)

overwrite 를 delete→create 대신 기존 row 의 필드를 in-place `update` 로 표현하는 안(row id 보존). 미채택 — [ADR-0006](ADR-0006-assessment-data-model.md) 의 Assessment immutable(`updatedAt` 미정의, `AssessmentRepository` 에 update 메서드 부재)과 정면 충돌하고, 더 결정적으로 **update 는 component Contribution[] 의 reset 을 cascade 하지 않는다**(Assessment row 만 갱신, 재평가로 사라져야 할 stale Contribution 이 잔존) — [ADR-0033 §Alternatives D](ADR-0033-evaluation-result-persistence.md)(Prisma upsert 미채택)와 동형 문제. reset-and-recreate(delete cascade → create)가 자식까지 정확히 정리하므로 의미가 명확하다.

### C. first-write-wins 전면 폐기(항상 overwrite) (미채택)

ADR-0037 §Decision 3 을 조건분기가 아니라 **전면 폐기**해 같은 좌표 재호출이 항상 덮어쓰도록 하는 안(mode flag 불요). 미채택 — [Q-0032](../STATE.json) 오너 결정의 first-write-wins 근거("평가문은 LLM/Agent 생성물 — 무의도 중복 호출은 churn 회피가 옳다")가 여전히 유효하므로 default 를 overwrite 로 바꾸면 batch retry·동시 fire 같은 **무의도 중복**이 매번 재수집·재평가·재write 를 유발(churn 폭증 + 낭비 compute). 조건분기 supersede(§Decision 4)가 default(first-write-wins)를 보존하면서 의도적 재평가만 opt-in 으로 열어주므로 우월하다(default 회귀 0 + overwrite unblock 동시).

### D. 별도 reeval endpoint 신설(overwrite 전용 route) (미채택)

기존 bridge endpoint(`POST /period`)에 mode 를 추가하는 대신 overwrite 전용 새 endpoint(예: `POST /period/reeval`)를 신설하는 안. 미채택(본 v1) — (1) fresh collect → evaluate → persist 파이프라인이 first-write-wins 경로와 **완전히 동일**하고 차이는 persist 의 mode(fill vs reeval) 한 지점뿐이라, 별도 endpoint 는 orchestration 로직을 거의 전부 중복시킨다(DRY 위반), (2) mode 인자 분기(§Decision 4)가 같은 endpoint 안에서 default/overwrite 를 fail-safe 하게 gate 하므로 새 route·새 controller·새 RBAC guard 배선이 불요, (3) 향후 endpoint 표면이 커지면 재고 가능하나 v1 은 mode 인자로 축약이 우월. 단 mode 인자 표면(body field vs query param)의 정확한 택1 은 구현 slice 결정(본 ADR §Decision 1 이 "명시 mode 인자 존재" 만 박제).

## References

- [ADR-0037](ADR-0037-period-collection-evaluate-bridge.md) §Decision 3 — first-write-wins read-through(본 ADR 이 조건분기 supersede) + §Follow-ups `(DEFERRED)` overwrite 항목(본 ADR 이 unblock)
- [ADR-0033](ADR-0033-evaluation-result-persistence.md) §Decision 3 — reset-and-recreate + fill/reeval 모드 + partial-reset + `@@unique` idempotency key(본 ADR 이 변경 0 으로 재사용)
- [ADR-0048](ADR-0048-default-model-id-source.md) §Decision 1/2 — 재평가 modelId source = LlmProviderConfig row(단일-row 운용 + fail-fast, 본 ADR §Decision 5 상호작용)
- [ADR-0006](ADR-0006-assessment-data-model.md) — Assessment/Contribution immutable + `@@unique` + cascade(reset-and-recreate 의 source)
- [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL(구현 chain e2e 검증 source)
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) — `persist(context, results, mode)` reeval 경로(본 ADR 이 재사용)
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `LlmProviderConfigRepository`(재평가 modelId 재해석 source, ADR-0048)
- [docs/PLAN.md](../PLAN.md) line 107 — overwrite/재평가 DEFERRED 해제(Q-0051 오너 승인) — 본 ADR 의 진입 근거
- [Q-0051](../STATE.json) / [Q-0032](../STATE.json) — 오너 결정(DEFERRED 해제 / first-write-wins v1 확정 배경)
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — ADR-first(rule 4) / BLOCKED 게이트(schema/dep/credential 어느 축도 미발화) / 언어 정책

## Follow-ups

(ADR-0053 ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover). dependency 순서. 무플래그 default 경로는 회귀 0 을 유지하고, 아래 slice 들이 명시 mode overwrite 경로를 배선한다.)

- [ ] **slice 1 — overwrite mode DTO** (`commitMode: pr`) — bridge 요청 DTO 에 명시 mode 인자(`mode?: "reeval" | "overwrite"` 또는 동등 enum) + class-validator(`@IsOptional`/`@IsEnum`/whitelist) + colocated spec(R-112 4 종 + negative: unknown mode / 빈 mode / 정의 외 값 → default 경로 fail-safe / type mismatch). 기존 bridge DTO(ADR-0037 slice 1) mirror.
- [ ] **slice 2 — bridge orchestration overwrite 분기** (`commitMode: pr`) — orchestration service 가 mode 를 받아 (a) 부재/fill → first-write-wins read-through(ADR-0037, 무변경) / (b) reeval/overwrite → fresh collect → evaluate → `persist(..., "reeval")`(§Decision 1) 로 분기 + mocked-LLM/mocked-collection unit(R-112 4 종 + negative: unknown mode → overwrite 미발생·기존 좌표 delete 0 / User ephemeral 경로 overwrite 무관 / partial-reset 시 다른 좌표 보존 / 동시 overwrite last-writer-wins row 1 수렴). modelId 재해석은 ADR-0048 resolver 재사용(§Decision 5).
- [ ] **slice 3 — e2e overwrite idempotency** (`commitMode: pr`, ADR-0004 실 PostgreSQL) — overwrite 모드 round-trip(기존 좌표 delete→create 로 값 교체 검증) + **row 수 idempotency**(같은 입력 overwrite 재실행 → row 1 불변) + **partial-reset 다른 좌표 보존**(personId+period prefix overwrite 시 다른 period 좌표 미변경) + **무플래그 회귀 0**(mode 부재 호출 → first-write-wins 그대로, 409 아님·row 증가 0) + **동시 overwrite 수렴**(같은 좌표 동시 2 overwrite → 최종 row 1 + last-writer-wins).
- [ ] **slice 4 — PLAN line 107 status sync** (`commitMode: direct`) — [PLAN.md](../PLAN.md) line 107 의 `(DEFERRED)` 표기를 본 ADR + 구현 chain 진입/완결로 갱신(checkbox·annotation) + ADR-0037 §Follow-ups `(DEFERRED)` 항목의 unblock 반영(필요 시 별도 direct doc-sync). pr-mode 코드 chain 과 mixed chain 금지([CLAUDE.md §3.1](../../CLAUDE.md) rule 3) — 별도 direct commit.
- [ ] **(deferred) 평가 이력 보존(history table / versioning)** — overwrite 가 hard delete 하는 이전 평가문의 이력이 실제 요구로 부상하면 별도 ADR(ADR-0006 immutable amend/supersede 선결 + §5 schema 게이트 재확인) 로 격상. 본 v1 범위 밖(§Consequences 부정 + §Alternatives A).

Refs: T-0804, ADR-0053, ADR-0037, ADR-0033, ADR-0048
