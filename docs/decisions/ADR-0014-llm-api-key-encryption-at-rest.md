---
id: ADR-0014
title: LLM API key encryption-at-rest 정책 — application-layer AES-256-GCM envelope encryption 채택
status: ACCEPTED
date: 2026-06-01
relatedTask: T-0146
supersedes: null
---

# ADR-0014 — LLM API key encryption-at-rest 정책 박제

## Context

본 ADR 은 [docs/PLAN.md L85/L88](../PLAN.md) Phase P4 의 **"LLM provider 추상화 (R-99~103)"** + **"자격증명 관리 (R-20/R-33)"** bullet 의 backbone 인 `LlmProviderConfig.apiKey` 컬럼의 encryption-at-rest 구체 mechanism 을 박제한다. 동 컬럼은 현재 평문 String 으로 박제돼 있고 ([src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) L33–40 — T-0135 머지), 그 코드 주석은 encryption-at-rest 를 별도 ADR 로 명시 deferral 한다 (주석 표기된 "ADR-0006" 은 stale — 아래 번호 정합 참조).

[docs/architecture/data-model.md L31](../architecture/data-model.md) 는 이 컬럼을 **"API key (encrypted at rest, 별도 ADR)"** 로 박제하고, [§7 L150](../architecture/data-model.md) + future-hook ([L172](../architecture/data-model.md)) 에서 **"LLM API key 의 encryption-at-rest 구체 mechanism — 별도 보안 ADR 책임"** 으로 명시 deferral 한다. [docs/architecture/p4-implementation-plan.md §3 ADR 후보 (c)](../architecture/p4-implementation-plan.md) 도 이 ADR 을 mandated 후보로 박제하나 (트리거 = LlmProviderConfig entity 진입 = T-0135) 아직 **미신설**이었다 — 본 ADR 이 그 신설.

[CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 4](../../CLAUDE.md) (새 ADR = pr) 정합으로, secret 처리 코드 / config write CRUD endpoint (apiKey 를 request body 로 받음 — [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 대상) 의 **선행 결정 doc** 을 단독 박제한다. [ADR-0011](ADR-0011-difficulty-model-assignment.md) (난이도) / [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) (Confluence 탐색) 이 각각 HITL-gated 구현의 선행 ADR 였던 패턴 mirror — 본 ADR 은 doc-only (외부 dependency 0 / `pnpm add` 0 / 자격증명 0 / secret literal 0 / schema migration 0) 라 [CLAUDE.md §5](../../CLAUDE.md) HITL 미발화. 실 encryption 구현 + 필요 시 dependency 추가 / 키 자격증명 / migration 은 후속 task 의 §5 게이트 책임.

### 결정 대상 4 축

본 ADR 이 확정하는 결정 축:

- **축 (1) encryption mechanism** — PostgreSQL `pgcrypto` column-level vs application-layer envelope encryption (Node 내장 `crypto` AES-GCM) vs 외부 KMS 중 택일.
- **축 (2) 암호화 키 자체의 보관·rotation 정책 방향** — env var / secret manager (실 secret 값 0 기재).
- **축 (3) apiKey 의 write-only / never-read-back contract** — config write CRUD 의 [CLAUDE.md §5](../../CLAUDE.md) HITL endpoint 에 전달될 invariant. GET 응답에 apiKey 비노출 ([T-0140](../tasks/T-0140-llm-provider-config-get-list-endpoint.md) service 가 이미 비노출 박제한 사실과 정합).
- **축 (4) 평문 → 암호화 전환 migration 방향** — 구체 SQL 은 후속 task, 본 ADR 은 방향만.

### REQ 외력 (본 ADR 이 cover)

- **REQ-052 / REQ-053 / REQ-054** ([docs/requirements.md](../requirements.md)) — Azure OpenAI / Anthropic / Google Gemini provider 의 API key 영속화. 각 provider 의 LlmProviderConfig.apiKey 가 본 ADR 의 encryption 대상. (REQ-051 custom 3 슬롯 / REQ-055 OpenAI 도 동일 컬럼 — 본 ADR 이 LlmProviderConfig.apiKey 단일 컬럼을 cover 하므로 전 provider 적용.)
- **REQ-043** ([README.md](../../README.md)) — "모든 사용 기능은 보안사항" 의 secret-at-rest 정합 (auth credential 은 [ADR-0008](ADR-0008-auth-credential-type.md), LLM key 는 본 ADR).

### 선행 코드 박제 (T-0135 / T-0140 정합)

본 ADR 이 결정하는 encryption 의 대상은 다음 선행 symbol 위에 성립한다:

- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `LlmProviderConfigCreateInput.apiKey: string` (평문). 본 ADR 의 암복호화 layer 가 끼어들 지점 (write 시 encrypt, read 시 절대 decrypt-and-return 하지 않음 — 축 (3)).
- [T-0140](../tasks/T-0140-llm-provider-config-get-list-endpoint.md) service — GET 목록 응답에서 apiKey 를 이미 비노출 박제 (never-read-back contract 의 선행 실현). 본 ADR 의 축 (3) 이 이를 invariant 로 격상.

### ADR cross-reference (번호 정합 박제)

- [ADR-0006 (assessment-data-model)](ADR-0006-assessment-data-model.md) — **ADR-0006 은 assessment-data-model 로 이미 점유**. [p4-implementation-plan.md §3 후보 (c)](../architecture/p4-implementation-plan.md) 의 "ADR-0006 (LLM key)" 표기 + [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) 주석의 "ADR-0006 follow-up" 표기 + [data-model.md §7 L150](../architecture/data-model.md) 의 "ADR-0005 secret-encryption" 표기는 **모두 stale** — 본 ADR 은 다음 free 번호 **ADR-0014** 를 사용한다 ([ADR-0011 §"ADR cross-reference"](ADR-0011-difficulty-model-assignment.md) 가 ADR-0006 stale 박제를 선행 확인한 패턴 mirror). docs/decisions/ 의 ADR-0007 은 부재 (ADR-0006 다음이 ADR-0008), 0008~0013 점유.
- [ADR-0008 (auth credential type)](ADR-0008-auth-credential-type.md) — security 결정을 ADR 로 doc-only 박제한 precedent + secret = env 기반 `@nestjs/config` 정합. 본 ADR 의 축 (2) 키 보관이 동 §5 Secret 관리 패턴 (`process.env` getter / dev `.env` gitignore / prod `EnvironmentFile=`) 을 재사용.
- [ADR-0002 (DB / Prisma)](ADR-0002-db.md) — PostgreSQL + Prisma baseline. 축 (1) `pgcrypto` 후보의 기반이자, 채택안 (application-layer) 이 Prisma model 컬럼 (`apiKeyCiphertext` 등) 으로 영속될 form 의 baseline.

## Decision

본 ADR 은 다음 4 결정을 박제한다.

### Decision §1 — encryption mechanism: application-layer AES-256-GCM envelope encryption (Node 내장 `crypto`)

- **application-layer envelope encryption 채택** — `LlmProviderConfig.apiKey` 의 평문은 **Node.js 내장 `crypto` module 의 AES-256-GCM** 으로 application layer 에서 암호화한 후 ciphertext 를 DB 에 영속한다. 외부 dependency 0 — `node:crypto` 는 Node LTS 표준 내장 ([ADR-0001](ADR-0001-stack.md) Node LTS stack) 이라 `pnpm add` 불요.
- **envelope 구조** — 평문 apiKey 를 data key (DEK) 로 AES-256-GCM 암호화 → ciphertext + IV (nonce) + GCM auth tag 를 DB 컬럼에 저장. DEK 자체는 master key (KEK) 로 보호 (envelope) — 본 ADR 시점 single-instance 환경 ([ADR-0003](ADR-0003-deployment.md) monolithic 1 process) 에서는 KEK = env var 직접 (`LLM_APIKEY_ENC_KEY`, 축 (2)) 로 시작하고, DEK-per-row rotation 의 본격 envelope 분리는 후속 KMS 도입 시 (Consequences 후속 chain). 즉 **본 ADR 의 envelope 은 AES-256-GCM + auth tag + IV 의 authenticated encryption 형태를 박제**하고, KEK/DEK 2-tier 의 물리 분리는 KMS 전환 ADR 까지 논리적 1-tier 로 시작.
- **DB 컬럼 form** — `apiKey` 평문 String 컬럼을 **ciphertext + IV + authTag 를 담는 form** 으로 전환 (구체 컬럼명 / 단일 컬럼 base64 concat vs 3 컬럼 분리는 후속 entity task + migration 책임 — 축 (4)). [ADR-0002](ADR-0002-db.md) Prisma model 위에서 String / Bytes 컬럼으로 영속.
- **GCM 선택 사유** — AES-256-GCM 은 authenticated encryption (AEAD) 으로 ciphertext 변조 (DB row tamper) 를 auth tag 검증으로 detect → CBC 등 non-authenticated mode 대비 무결성 보장. IV (nonce) 는 row 마다 고유 random 생성 (재사용 시 GCM 보안 붕괴 — 구현 task 가 `crypto.randomBytes(12)` 강제).

### Decision §2 — 암호화 키 보관·rotation 방향: env var 시작 + secret manager 격상 경로 ([ADR-0008](ADR-0008-auth-credential-type.md) §5 정합)

- **환경변수 이름 박제 (실 secret 값 0)** — master key 는 환경변수 **`LLM_APIKEY_ENC_KEY`** (AES-256 = 32-byte random, base64 또는 hex 인코딩) 로 read. [ADR-0008 §5](ADR-0008-auth-credential-type.md) 의 `AUTH_JWT_SECRET` 패턴 (process.env / `@nestjs/config` getter / dev `.env` gitignore / prod systemd `EnvironmentFile=`) 을 그대로 재사용 — 새 secret 관리 메커니즘 도입 0.
- **rotation 정책 방향** — 본 ADR 시점에는 **manual rotation (process restart + 전 row re-encrypt batch)**. 자동 rotation / DEK-per-row 의 본격 envelope 은 후속 secret manager (vault / cloud KMS) 도입 ADR ([ADR-0003 §2](ADR-0003-deployment.md) 후속) 의 책임. rotation 시 key version 식별자를 ciphertext envelope 에 prefix 박제하는 방향 (구체는 KMS 전환 ADR).
- **실 secret 값 0 기재** ([CLAUDE.md §9](../../CLAUDE.md)) — 본 ADR 본문에 어떤 API key / 암호화 키 값도 기재하지 않는다. 환경변수 **이름** 박제만 (값 박제 0).

### Decision §3 — apiKey write-only / never-read-back contract

- **write-only invariant** — apiKey 는 config write CRUD endpoint (POST/PATCH — 후속 [CLAUDE.md §5](../../CLAUDE.md) HITL task) 의 request body 로만 들어오고, **어떤 read path (GET 목록 / GET 단건 / Export) 도 평문 apiKey 를 응답에 포함하지 않는다**. [T-0140](../tasks/T-0140-llm-provider-config-get-list-endpoint.md) service 가 GET 목록에서 apiKey 를 이미 비노출 박제한 사실을 본 ADR 이 시스템 invariant 로 격상.
- **never-decrypt-and-return** — 복호화는 **LLM 호출 직전 (LlmGateway 가 provider HTTP 호출 시 Authorization header 에 실으려는 순간) 에만** 일어나고, 복호화 결과는 응답 / 로그 / 직렬화 어디에도 노출하지 않는다 (in-memory transient). API 응답 DTO 는 apiKey 필드 자체를 omit 하거나 masked (`****` / `null`) 로 표현.
- **부분 갱신 시멘틱** — PATCH 시 apiKey 필드 부재 = "기존 키 유지", 명시 제공 = "재암호화 후 교체". 빈 문자열 등 negative 입력의 거부는 후속 service / DTO validation 책임 (R-112 negative cases — 본 ADR 은 invariant 만 박제).

### Decision §4 — 평문 → 암호화 전환 migration 방향

- **migration 방향 박제 (구체 SQL 0)** — 현 평문 `apiKey` 컬럼을 ciphertext form 으로 전환하는 `prisma migrate` 는 후속 entity/migration task 책임. 방향: (i) ciphertext 컬럼 (+ IV / authTag) 신설 → (ii) 기존 평문 row 를 application-layer batch 로 re-encrypt → (iii) 평문 컬럼 drop. dev 환경에 실 평문 secret 이 없다면 (현 LlmProviderConfig row 0 / seed 평문) 단순 컬럼 transform 으로 단순화 가능.
- **schema migration 은 본 ADR scope 외** ([CLAUDE.md §5](../../CLAUDE.md) DB schema 변경 BLOCKED 게이트 + 본 task Out of Scope) — 본 ADR 은 전환 **방향만**, 실 `prisma/migrations/*.sql` 작성 0.

## Consequences

### 양의 (positive)

1. **dependency-free 채택** — Decision §1 의 Node 내장 `crypto` AES-256-GCM 은 [ADR-0001](ADR-0001-stack.md) Node LTS stack 에 이미 포함 → 후속 구현 task 가 `pnpm add` 0 으로 encryption 구현 가능 ([CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). `pgcrypto` (PostgreSQL extension enable + migration) / KMS SDK (외부 패키지 + cloud 자격증명) 대비 도입 마찰 최소.
2. **authenticated encryption 무결성** — AES-256-GCM 의 auth tag 가 DB row ciphertext 변조를 detect → CBC 등 non-AEAD mode 의 padding-oracle / 무결성 부재 risk 회피.
3. **[ADR-0008](ADR-0008-auth-credential-type.md) §5 secret 관리 재사용** — Decision §2 의 `LLM_APIKEY_ENC_KEY` env var 가 `AUTH_JWT_SECRET` 와 동일 `@nestjs/config` 패턴 → 새 secret 관리 메커니즘 도입 0, 운영자 학습 비용 0.
4. **write-only invariant 의 시스템 일관성** — Decision §3 이 [T-0140](../tasks/T-0140-llm-provider-config-get-list-endpoint.md) 의 GET 비노출을 invariant 로 격상 → 후속 config write CRUD / Export ([UC-07](../use-cases/UC-07-import-export.md)) endpoint 가 일관된 apiKey 비노출 contract 위 구현, secret 유출 surface ↓.
5. **KMS 전환 친화** — Decision §1 의 envelope 구조 (AES-256-GCM + key version prefix 방향) 가 후속 cloud KMS / vault 도입 시 KEK 만 외부 KMS 로 이전하면 되는 자연 확장 경로 → application-layer 시작이 KMS lock-in 회피 + 향후 격상 friction 최소.

### 음의 (negative) / trade-off

1. **application-layer 키 노출 surface** — Decision §2 상 `LLM_APIKEY_ENC_KEY` 가 process env 에 평문 거주 → process memory dump / env leak 시 키 노출. mitigation: env 파일 권한 제한 (dev `.env` gitignore, prod `EnvironmentFile=` 0600) + 후속 KMS 전환으로 KEK 의 process-외 보관. `pgcrypto` (DB-side 키) 대비 trade-off 이나, `pgcrypto` 도 키를 어딘가 (env / SQL 파라미터) 전달해야 하므로 본질적 우열 아님.
2. **manual rotation 부담** — Decision §2 상 키 rotation 시 process restart + 전 row re-encrypt batch 필요 → 자동 rotation 부재. mitigation: row 수가 적은 LlmProviderConfig (provider 당 1~수 row) 라 batch 비용 낮음 + 후속 KMS 도입 시 자동화.
3. **IV 재사용 금지의 구현 규율** — Decision §1 상 GCM IV(nonce) 를 row 마다 고유 random 생성해야 함 (재사용 시 GCM 기밀성 붕괴) → 구현 task 가 `crypto.randomBytes(12)` per-encrypt + IV 영속을 강제해야 함. mitigation: 후속 R-112 negative test (동일 평문 2 회 암호화 시 ciphertext 상이 검증) 로 IV 고유성 회귀 방지.
4. **DB-side 쿼리 불가** — application-layer 암호화상 DB 가 ciphertext 만 보유 → apiKey 기반 SQL WHERE / index 불가. mitigation: apiKey 는 secret 이라 검색 대상이 아님 (provider / modelId 로만 조회) → 실 제약 0.

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **encryption helper task** | `node:crypto` 기반 AES-256-GCM encrypt/decrypt helper (envelope: ciphertext+IV+authTag) + `LLM_APIKEY_ENC_KEY` env getter + R-112 4 종 + negative (IV 고유성 / auth tag 변조 거부 / 키 부재) spec | 본 ADR 머지 후 즉시 | **없음 — Node 내장 `crypto`, `pnpm add` 0.** 단 `LLM_APIKEY_ENC_KEY` 키 자격증명 도입 시 [CLAUDE.md §5](../../CLAUDE.md) 외부 자격증명 게이트 발화 가능 (env var 신설 = 운영 secret) |
| **schema migration task** | `LlmProviderConfig.apiKey` 평문 → ciphertext form 전환 `prisma/migrations/*.sql` (Decision §4 방향) | encryption helper | **있음 — DB schema 변경 ([CLAUDE.md §5](../../CLAUDE.md) schema-migration BLOCKED 게이트)** |
| **config write CRUD endpoint** | POST/PATCH/DELETE `/api/llm/providers` — apiKey 를 request body 로 받아 encrypt 후 영속 + write-only invariant (Decision §3) 강제 | encryption helper + migration | **있음 — apiKey 를 받는 secret 처리 endpoint ([CLAUDE.md §5](../../CLAUDE.md) security/secret 게이트)** |
| **LlmGateway 복호화 wire** | provider HTTP 호출 직전 in-memory decrypt (Decision §3 never-read-back) | encryption helper + provider HTTP client (T-0137+) | **있음 — provider SDK 추가 시 게이트 (본 ADR 무관, routing task 책임)** |

### config write CRUD 의 선행 의존 관계

본 ADR 머지는 apiKey 를 request body 로 받는 config write CRUD endpoint ([CLAUDE.md §5](../../CLAUDE.md) HITL secret 게이트 대상) 의 **선행 결정 doc**. 그 endpoint 가 받은 평문 apiKey 를 Decision §1 helper 로 encrypt 후 영속하므로, encryption helper + migration 이 endpoint 구현보다 선행해야 한다 (위 chain 순서).

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) application-layer AES-256-GCM envelope (Node 내장 `crypto`)** (채택) | 외부 dependency 0 (`pnpm add` 0, [CLAUDE.md §5](../../CLAUDE.md) 게이트 회피) / AEAD 무결성 (auth tag) / [ADR-0008 §5](ADR-0008-auth-credential-type.md) env secret 패턴 재사용 / KMS 전환 친화 (KEK 만 이전) / [ADR-0001](ADR-0001-stack.md) Node LTS 정합 | application-layer 키가 process env 거주 (leak surface) / manual rotation 부담 / IV 고유성 구현 규율 / DB-side 쿼리 불가 (secret 이라 실 제약 0) | **✓ 채택** |
| (2) PostgreSQL `pgcrypto` column-level (`pgp_sym_encrypt` / `pgp_sym_decrypt`) | DB-native 암호화 / application code 의 crypto 책임 0 / 표준 extension | **`CREATE EXTENSION pgcrypto` = DB schema/권한 변경** ([CLAUDE.md §5](../../CLAUDE.md) schema-migration 게이트 + superuser 권한 의존) / 암호화 키가 SQL 파라미터로 전달 → query log / pg_stat_statements 노출 surface / 복호화가 DB-side 라 평문이 DB↔app 경로에 노출 / [ADR-0002](ADR-0002-db.md) Prisma 가 raw SQL function (`pgp_sym_encrypt`) 호출을 escape hatch 로만 지원 → ORM 정공법 이탈 | 기각 — schema/권한 변경 마찰 + 키의 SQL-param 노출 + Prisma 정공법 이탈 |
| (3) 외부 KMS (AWS KMS / GCP KMS / HashiCorp Vault) | 키의 process-외 물리 분리 (최강 보관) / 자동 rotation / audit / DEK-per-row envelope 본격 | **외부 SDK (`@aws-sdk/client-kms` 등) = 새 dependency ([CLAUDE.md §5](../../CLAUDE.md) 게이트)** + cloud 자격증명 (KMS access) 추가 / [ADR-0003](ADR-0003-deployment.md) 의 현 single-instance / 자체 호스팅 환경에 cloud KMS 의존 도입은 deployment 토폴로지 변경 / 현 규모 (LlmProviderConfig 수 row) 대비 over-engineering | 미채택 (deferred) — 채택안 (1) 의 envelope 구조가 향후 KMS 전환의 자연 경로 (KEK 만 KMS 로 이전). 규모 / 멀티-instance 압박 시 별도 전환 ADR. |
| (4) 평문 유지 (encryption 0) | 구현 0 / 복잡도 0 | **REQ-043 보안 backbone 위반** ([README.md](../../README.md) "모든 사용 기능은 보안사항") / [data-model.md L31](../architecture/data-model.md) "encrypted at rest" 박제 위반 / DB dump / backup 유출 시 전 provider API key 평문 노출 / [CLAUDE.md §5](../../CLAUDE.md) security 정합 0 | 기각 — 보안 요구 (REQ-043) + data-model 박제 정면 위반 |

## References

- [docs/PLAN.md L85/L88](../PLAN.md) — Phase P4 "LLM provider 추상화 (R-99~103)" + "자격증명 관리 (R-20/R-33)" (본 ADR 의 직접 motivation)
- [docs/architecture/data-model.md L31](../architecture/data-model.md) — LlmProviderConfig apiKey "encrypted at rest, 별도 ADR" (본 ADR 이 그 별도 ADR)
- [docs/architecture/data-model.md §7 L150 + L172](../architecture/data-model.md) — encryption-at-rest mechanism deferral + "ADR-0005 secret-encryption" stale 표기 (본 ADR = ADR-0014 로 번호 정합)
- [docs/architecture/p4-implementation-plan.md §3 후보 (c)](../architecture/p4-implementation-plan.md) — LLM API key encryption-at-rest ADR 후보 (트리거 = LlmProviderConfig entity = T-0135) + §4 게이트 inventory
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — 현 평문 apiKey String 컬럼 + "ADR-0006 follow-up" stale 주석 (decision 의 대상)
- [docs/tasks/T-0140-llm-provider-config-get-list-endpoint.md](../tasks/T-0140-llm-provider-config-get-list-endpoint.md) — GET 목록 apiKey 비노출 service (Decision §3 never-read-back 의 선행 실현)
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](ADR-0011-difficulty-model-assignment.md) — ADR-first split + 번호 정합 (ADR-0006 stale 박제) 패턴 mirror + ADR 본문 template
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](ADR-0013-confluence-space-traversal-policy.md) — 최근 ACCEPTED ADR format / HITL-gated 구현의 선행 ADR precedent
- [docs/decisions/ADR-0008-auth-credential-type.md](ADR-0008-auth-credential-type.md) — security 결정 doc-only ADR precedent + §5 Secret 관리 패턴 (`process.env` / `@nestjs/config` / env 이름 박제) 재사용 source
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma baseline (pgcrypto 후보 기반 + 채택안 ciphertext 컬럼 영속 form)
- [docs/decisions/ADR-0001-stack.md](ADR-0001-stack.md) — Node LTS stack (채택안 `node:crypto` 내장 dependency-free baseline)
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) §1 (monolithic 1 process — single-instance 키 보관 baseline) / §2 (env 기반 secret)
- [docs/requirements.md](../requirements.md) — REQ-052/053/054 (Azure/Anthropic/Gemini provider key) / REQ-043 (보안 backbone) source of truth
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — 새 ADR = pr-mode
- [CLAUDE.md §5](../../CLAUDE.md) — 새 dependency / 자격증명 / schema migration / secret BLOCKED 게이트 (본 ADR doc-only 미발화, 후속 구현 task trigger)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 값 절대 미기재 (환경변수 이름 박제는 OK)

Refs: T-0146, ADR-0001, ADR-0002, ADR-0003, ADR-0008, ADR-0011, ADR-0013, REQ-043, REQ-052, REQ-053, REQ-054
