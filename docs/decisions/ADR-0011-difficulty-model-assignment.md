---
id: ADR-0011
title: 3 난이도 (easy/medium/hard) 모델 할당 정책 — 슬롯 cardinality / 매핑 의미 / fallback 박제
status: ACCEPTED
date: 2026-06-01
relatedTask: T-0136
supersedes: null
---

# ADR-0011 — 3 난이도 (easy/medium/hard) 모델 할당 정책 박제

## Context

본 ADR 은 [docs/PLAN.md L86](../PLAN.md) Phase P4 의 **"3 난이도 모델 할당 (R-97) — ADR 로 박제"** 의무를 박제한다 — 동 bullet 이 명시한 "ADR 로 박제" 가 본 ADR 의 single source of truth 트리거. [docs/architecture/p4-implementation-plan.md §3 ADR 후보 (b)](../architecture/p4-implementation-plan.md) 와 §2 표 T-0136 row 도 DifficultyMapping entity 진입 시 본 ADR 신설을 트리거로 박제한다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 3](../../CLAUDE.md) (ADR + 코드 혼합 task 는 split) 에 따라, **DifficultyMapping entity·repository 코드 task (T-0137 잠정) 의 선행 결정 ADR** 을 본 ADR 이 단독 박제하여 후속 entity / repository / service / routing task 가 일관된 contract 위에서 구현되게 한다.

### 결정 대상 3 축

[docs/architecture/data-model.md §2 DifficultyMapping row](../architecture/data-model.md) + [§3 관계 8 항목](../architecture/data-model.md) 은 DifficultyMapping 을 "3 난이도 (easy / medium / hard) ↔ LlmProviderConfig.modelId 매핑, **3 row 고정** 또는 sub-relation" 으로 conceptual 박제하되 cardinality 모델 / 매핑 의미 / fallback 의 구체 결정은 ADR 로 미룬다. 본 ADR 이 그 3 축을 확정:

- **축 (1) 난이도 슬롯 cardinality 모델** — 3 row 고정 (easy / medium / hard 각 1 row) vs N 난이도 가변 vs LlmProviderConfig inline enum 컬럼 vs sub-relation.
- **축 (2) 슬롯 ↔ LlmProviderConfig.modelId 매핑 의미** — 각 난이도 슬롯이 어느 LlmProviderConfig 의 어느 model 을 가리키는지의 참조 형태 (FK vs modelId 문자열 vs provider+modelId 복합).
- **축 (3) 미설정 / 누락 슬롯의 fallback 정책** — 3 슬롯 중 일부가 미설정일 때 기본 provider 사용 vs 평가 거부 택일.

### REQ 외력 (본 ADR 이 cover)

- **REQ-049** ([docs/requirements.md](../requirements.md)) — Admin 이 LLM 모델을 지정. DifficultyMapping 이 난이도별 model 지정의 영속 단위. 본 ADR 이 그 매핑 단위의 cardinality·의미 결정.
- **REQ-050** ([docs/requirements.md](../requirements.md)) — 3 난이도 모델 매핑. 본 ADR 이 easy / medium / hard 3 슬롯 고정 + 슬롯 ↔ model 매핑을 박제.
- **REQ-097 (= R-97)** ([docs/PLAN.md L86](../PLAN.md)) — 평가 항목별 난이도 분류 + 어떤 난이도가 어떤 model 로 처리될지의 routing 정책. 본 ADR 이 그 routing 의 정적 매핑 backbone 결정 (실 routing 호출은 T-0137+ LlmGateway).

### 선행 코드 박제 (T-0135 정합)

본 ADR 이 결정하는 매핑의 대상 (model) 은 [T-0135](../tasks/T-0135-llm-module-scaffold.md) 가 이미 박제한 다음 두 symbol 위에 성립한다:

- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `LlmProviderConfig` **다중 row 모델** (provider / endpointUrl / apiKey / modelId 4 컬럼). DifficultyMapping 슬롯이 가리키는 매핑 대상 row 의 source. `@unique` / `@@unique` 미정의 → 동일 (provider, modelId) 다중 row 가능.
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `LlmProvider` enum (custom / azure_openai / anthropic / google_gemini / openai 5 멤버) + `LlmGenerateOptions.difficulty?: string` placeholder. 본 ADR 의 슬롯 식별자 (easy/medium/hard) 가 그 `difficulty` 옵션과 연결될 enum 의 source. `LlmGenerateOptions.modelId` 가 슬롯 매핑 resolve 결과의 소비처.

### ADR cross-reference (번호 정합 박제)

- [ADR-0006 (assessment-data-model)](ADR-0006-assessment-data-model.md) — **ADR-0006 은 assessment-data-model 로 이미 점유**. [p4-implementation-plan.md §3 후보 (b)/(c)](../architecture/p4-implementation-plan.md) 의 "ADR-0006 (LLM key)" 표기는 **stale** — 본 ADR 은 다음 free 번호 **ADR-0011** 을 사용한다 (T-0136 acceptance 의 번호 정합 명시).
- **ADR-0007 (audit log entity schema)** — [p4-implementation-plan.md §3 후보 (d)](../architecture/p4-implementation-plan.md) 가 ADR-0007 을 audit log schema 후보로 박제하나 **현재 미신설** (docs/decisions/ 에 ADR-0007 파일 부재 — ADR-0006 다음이 ADR-0008). 본 ADR 은 audit log 와 무관 (난이도 할당 정책 단독) 이므로 ADR-0007 신설을 trigger 하지 않는다.
- [ADR-0002 (DB / Prisma)](ADR-0002-db.md) — DifficultyMapping 의 PostgreSQL row 영속 + Prisma model form 의 baseline.

## Decision

본 ADR 은 다음 3 결정을 박제한다.

### Decision §1 — 난이도 슬롯 cardinality: 3 row 고정 (easy / medium / hard)

- **3 row 고정 모델 채택** — DifficultyMapping 은 난이도 슬롯 3 개 (`easy` / `medium` / `hard`) 에 대해 **정확히 3 row** 를 가진다. 난이도 식별자는 schema 컬럼에 그대로 저장되는 lower-case String literal (`easy` / `medium` / `hard`) — [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 의 `LlmProvider` enum-as-String literal 정공법과 동일 패턴 (Prisma enum 격상은 별도 ADR). 본 ADR 시점에는 `Difficulty` 식별자를 TS String literal union (`'easy' | 'medium' | 'hard'`) 또는 enum 으로 entity code task 가 박제 (T-0137 책임) — 본 ADR 은 3 슬롯 cardinality·값 집합만 확정.
- **3 슬롯 unique** — `@@unique([difficulty])` (또는 `difficulty` 단일 `@unique`) 로 동일 난이도 슬롯 중복 row schema-level 차단. 3 row 초과 / 미정의 난이도 값 row 는 application-layer (T-0137 service) 가 거부.
- **[data-model.md §3 관계 8 항목](../architecture/data-model.md) 정합** — DifficultyMapping 은 LlmProviderConfig 에 N:1 (LlmProviderConfig ||--o{ DifficultyMapping = 1:N). 즉 한 LlmProviderConfig 가 N 난이도 슬롯의 매핑 대상이 될 수 있고 (예: custom provider 의 1 config 가 3 슬롯 모두 차지 — REQ-051), 한 DifficultyMapping 슬롯은 정확히 1 LlmProviderConfig 를 가리킨다.

### Decision §2 — 슬롯 ↔ model 매핑 의미: LlmProviderConfig FK 참조

- **FK (`llmProviderConfigId`) 참조 채택** — 각 DifficultyMapping 슬롯은 **`LlmProviderConfig.id` 를 가리키는 외래키 `llmProviderConfigId`** 를 보유한다. modelId 문자열을 DifficultyMapping 에 복제 저장하지 **않는다** — 매핑 대상 model 의 single source 는 가리켜진 `LlmProviderConfig.modelId` 컬럼이다 (denormalize 회피, model 변경 시 1 곳만 갱신).
- **resolve 의미** — 난이도 `d` 의 model 을 구할 때: `DifficultyMapping(difficulty=d).llmProviderConfigId` → `LlmProviderConfig` row → 그 row 의 `provider` + `modelId` 가 실제 호출 대상. [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 의 `LlmGenerateOptions.modelId` 와 `LlmGenerateResult.provider` / `modelId` 가 이 resolve 결과의 소비처.
- **N:1 정합** — Decision §1 의 LlmProviderConfig 1:N DifficultyMapping 과 일치 — FK 가 N(DifficultyMapping) 측에 위치. custom provider 1 config 가 3 슬롯 모두 차지 가능 (3 DifficultyMapping row 가 동일 `llmProviderConfigId` 보유 — REQ-051).
- **cascade** — 가리켜진 LlmProviderConfig 삭제 시 DifficultyMapping 의 FK 정합 정책 (RESTRICT 권장 — 매핑이 살아있는 config 삭제 차단) 의 구체 `onDelete` 박제는 entity code task (T-0137) 책임. 본 ADR 은 FK 참조 형태만 확정.

### Decision §3 — 미설정 / 누락 슬롯 fallback: 평가 거부 (fail-fast)

- **평가 거부 (fail-fast) 채택** — 난이도 `d` 의 평가 요청 시 `DifficultyMapping(difficulty=d)` 슬롯이 미설정 (row 부재 또는 가리킨 LlmProviderConfig 부재) 이면 **명시적 거부** — application-layer 가 `BadRequestException` / `ConflictException` 류 4xx 로 "해당 난이도 model 미설정" 을 통지하고 평가를 진행하지 않는다.
- **기본 provider silent-fallback 거부 사유** — 미설정 슬롯을 임의 기본 provider 로 silent 대체하면 (i) Admin 이 의도하지 않은 model 로 평가가 수행되어 결과 신뢰성 훼손 (ii) 어느 난이도가 미설정인지 운영 가시성 상실 (iii) REQ-049 의 "Admin 이 model 을 지정" 의도 (명시 지정) 와 어긋남. 따라서 silent-fallback 대신 fail-fast 로 미설정을 표면화.
- **운영 함의** — 본 정책상 3 슬롯 모두 설정되어야 전 난이도 평가가 가능 — entity code task 의 seed (Decision §1 의 3 row) 가 초기 매핑을 제공하고, Admin 이 [T-0139](../architecture/p4-implementation-plan.md) endpoint 로 슬롯별 model 을 갱신. 미설정 슬롯의 4xx 는 [PermissionDeniedRecord](../architecture/data-model.md) 와 무관한 일반 validation 거부 (외부 4xx 가 아니므로 audit record 영속화 대상 아님).

## Consequences

### 양의 (positive)

1. **후속 entity task (T-0137) contract 명확** — DifficultyMapping Prisma model 의 컬럼 (`difficulty` String + `llmProviderConfigId` FK) / `@@unique([difficulty])` / N:1 relation 이 본 ADR 로 사전 고정 → architect / implementer 의 schema 환각 ↓, 일관된 contract 위 구현.
2. **denormalize 회피** — Decision §2 의 FK 참조로 model 식별자가 LlmProviderConfig 1 곳에만 존재 → Admin 이 provider config 의 modelId 변경 시 DifficultyMapping 동기 갱신 불요 (FK 가 자동 추종).
3. **운영 가시성 (fail-fast)** — Decision §3 의 명시 거부로 미설정 난이도가 4xx 로 즉시 표면화 → silent 오작동 (의도치 않은 model 로 평가) 차단, REQ-049 명시 지정 의도 보존.
4. **3 row 고정의 seed 단순성** — Decision §1 의 3 슬롯 고정으로 seed migration 이 정확히 3 row (easy / medium / hard) 만 생성 → 가변 N 모델 대비 migration / 초기화 로직 단순. seed 의 초기 `llmProviderConfigId` 는 nullable 시작 또는 첫 LlmProviderConfig 지정 — 구체는 T-0137.
5. **LlmGateway routing 연결점 박제** — [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 의 `LlmGenerateOptions.difficulty` placeholder 가 본 ADR 의 3 슬롯 식별자와 직결 → T-0137+ 의 LlmGateway 구현이 `difficulty` → DifficultyMapping resolve → `modelId` 의 routing 을 본 ADR contract 로 구현.

### 음의 (negative) / trade-off

1. **3 row 고정의 경직성** — 향후 난이도 슬롯이 3 개를 초과 (예: `trivial` / `expert` 추가) 하면 cardinality 모델 변경 ADR (본 ADR supersede) 필요. mitigation: README / requirements 의 평가 난이도 모델이 3 단계로 고정 (R-97) 이므로 현 요구 범위 내 안정.
2. **fail-fast 의 운영 부담** — Decision §3 상 3 슬롯 미설정 시 해당 난이도 평가 전면 거부 → 초기 셋업 전 평가 불가. mitigation: seed (3 row) + T-0139 Admin endpoint 로 슬롯 설정 절차 제공, 미설정 4xx 메시지가 어느 슬롯 설정이 필요한지 명시.
3. **FK RESTRICT 의 삭제 마찰** — Decision §2 의 LlmProviderConfig RESTRICT(권장) 상 매핑에 사용 중인 provider config 삭제가 차단 → Admin 이 먼저 매핑 재지정 후 삭제. mitigation: T-0139 endpoint 가 "이 config 는 N 난이도 슬롯에 사용 중" 안내 + 재지정 흐름 제공 (구체 UX 는 P6).

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **T-0137 candidate** | DifficultyMapping Prisma model (`difficulty` String + `llmProviderConfigId` FK + `@@unique([difficulty])`) + `Difficulty` String literal union/enum + DifficultyMappingRepository (CRUD primitive, LlmProviderConfigRepository 패턴 mirror) + 3 row seed | 본 ADR-0011 머지 후 즉시 (T-0135 LlmProviderConfig 위) | 없음 — 기존 Prisma schema 확장 + repository 신설, 외부 dependency 0 |
| **T-0138+ candidate** | LlmGateway routing — `difficulty` → DifficultyMapping resolve → LlmProviderConfig.modelId → provider 호출. fail-fast (Decision §3) 의 service-level 강제 | T-0137 + provider HTTP client (T-0137+) | **있음 — provider SDK 추가 시 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트** (본 ADR 무관, routing task 책임) |
| **T-0139 candidate** | Admin LLM 지정 endpoint (PATCH `/api/llm/difficulty-mappings`) + DTO + RBAC (Admin+) — 슬롯별 model 재지정 | T-0137 | 없음 — 내부 endpoint, 외부 dependency 0 |

### 3 row 고정 모델의 seed / migration 함의

- Decision §1 의 3 row 고정상 entity code task (T-0137) 의 `prisma migrate dev` 가 DifficultyMapping table 신설 + seed script 가 정확히 3 row (`easy` / `medium` / `hard`) 삽입. 초기 `llmProviderConfigId` 는 nullable 시작 (셋업 전) 또는 첫 LlmProviderConfig FK — Decision §3 의 fail-fast 가 nullable / 미설정 슬롯을 4xx 로 거부하므로 nullable 시작 안전. 구체 seed / nullable 여부는 T-0137 책임.

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) 3 row 고정 + FK 참조 + fail-fast** (채택) | data-model.md "3 row 고정" 1 차 권장 정합 / denormalize 회피 (model single source) / 운영 가시성 (미설정 표면화) / seed 단순 (정확히 3 row) / REQ-049 명시 지정 의도 보존 | 3 슬롯 초과 시 supersede ADR 필요 / 초기 셋업 전 평가 거부 / FK RESTRICT 삭제 마찰 | **✓ 채택** |
| (2) N 난이도 가변 모델 (난이도 슬롯을 런타임 추가/삭제 가능한 가변 set) | 향후 난이도 단계 확장 유연 / 슬롯 수 정책 변경 시 ADR 불요 | R-97 이 3 난이도로 고정 → 가변 cardinality 는 현 요구 over-engineering / seed 초기화 / UI / routing 모두 가변 set 처리 복잡 / [data-model.md](../architecture/data-model.md) "3 row 고정" 권장과 어긋남 | 기각 — 현 요구 (3 난이도 고정) 대비 over-design, MVA 원칙 위반 |
| (3) LlmProviderConfig inline enum 컬럼 (DifficultyMapping entity 없이 LlmProviderConfig 에 `difficulty` enum 컬럼 직접 부착) | entity 1 개 절약 / join 불요 | 1 LlmProviderConfig 가 N 난이도 슬롯 차지 (custom 3 슬롯 — REQ-051) 표현 불가 (enum 컬럼은 1 값) / 난이도 ↔ config 의 N:1 을 inline 컬럼으로 표현하면 동일 config 를 3 row 복제해야 → 정규화 훼손 / [data-model.md §3 관계 8](../architecture/data-model.md) 의 별도 DifficultyMapping entity 박제와 어긋남 | 기각 — REQ-051 custom 3 슬롯 표현 불가 + 정규화 훼손 |
| (4) sub-relation (DifficultyMapping 을 LlmProviderConfig 의 embedded sub-document / JSONB 컬럼으로) | join 불요 / config 단위로 난이도 매핑 묶임 | PostgreSQL 관계형 모델에서 JSONB sub-relation 은 FK 무결성 / unique 제약 / 쿼리 가독성 손실 / 난이도 슬롯의 N:1 을 JSONB 안에 숨기면 [ADR-0002](ADR-0002-db.md) Prisma relational 정공법과 어긋남 / 슬롯별 독립 갱신 (T-0139) 시 전체 JSONB rewrite | 기각 — relational 무결성 / Prisma 정공법 ([ADR-0002](ADR-0002-db.md)) 정합 0 |
| (5) 기본 provider silent-fallback (미설정 슬롯을 시스템 기본 LlmProviderConfig 로 자동 대체) | 미설정 슬롯에도 평가 무중단 진행 / Admin 셋업 부담 ↓ | 의도하지 않은 model 로 평가 → 결과 신뢰성 훼손 / 어느 난이도가 미설정인지 가시성 상실 / REQ-049 "Admin 이 model 지정" 명시 의도와 어긋남 (Decision §3) | 기각 — 결과 신뢰성 + 운영 가시성 + REQ-049 명시 의도 3 차원 모두 fail-fast 열세 |

## References

- [docs/PLAN.md L86](../PLAN.md) — Phase P4 "3 난이도 모델 할당 (R-97) — ADR 로 박제" (본 ADR 의 직접 motivation)
- [docs/architecture/p4-implementation-plan.md §2 T-0136 row](../architecture/p4-implementation-plan.md) — 책임 task / 신설 사유 / dependsOn (T-0135)
- [docs/architecture/p4-implementation-plan.md §3 후보 (b)](../architecture/p4-implementation-plan.md) — "LLM provider 추상화 / 3 난이도 모델 할당" ADR 후보 (트리거 시점 = T-0136)
- [docs/architecture/p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) — T-0136 게이트 미발화 (외부 dependency 0) 박제
- [docs/architecture/data-model.md §2 DifficultyMapping row](../architecture/data-model.md) — 3 난이도 ↔ modelId, 3 row 고정 vs sub-relation conceptual source
- [docs/architecture/data-model.md §3 관계 8 항목](../architecture/data-model.md) — LlmProviderConfig 1:N DifficultyMapping cardinality source
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — T-0135 LlmProviderConfig 다중 row 모델 + modelId 컬럼 (매핑 대상 source)
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — T-0135 LlmProvider enum + LlmGenerateOptions.difficulty placeholder (슬롯 식별자 연결점)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma (DifficultyMapping persistence / FK 정공법 baseline)
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — ADR-0006 점유 확인 (p4-plan "ADR-0006 (LLM key)" 표기 stale → 본 ADR 은 ADR-0011)
- [docs/requirements.md](../requirements.md) — REQ-049 (Admin LLM 지정) / REQ-050 (3 난이도 매핑) / REQ-051 (custom 3 슬롯) / REQ-097 (난이도 routing) source of truth
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) — ADR + 코드 혼합 task split (본 ADR doc-only, 코드는 T-0137)
- [CLAUDE.md §5](../../CLAUDE.md) — 본 ADR 외부 dependency 0 / `pnpm add` 0 / 자격증명 0 → HITL 게이트 미발화

Refs: T-0136, ADR-0002, ADR-0006, REQ-049, REQ-050, REQ-097
