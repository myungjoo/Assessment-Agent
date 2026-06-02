---
id: ADR-0017
title: GithubModule instance sub-config source — process.env 기반 instance-keyed config (DB table / @nestjs/config 미채택) + token encrypted-at-rest 위상
status: ACCEPTED (2026-06-03)
date: 2026-06-03
relatedTask: T-0177
supersedes: null
---

# ADR-0017 — GithubModule instance sub-config source (env 기반) 박제

> ACCEPTED (2026-06-03, T-0181 에서 status 전이). 본 ADR 의 config-source 결정 — `process.env` instance-keyed config (`GITHUB_INSTANCES` + per-key `_HOST`/`_ORG`/`_TOKEN_ENC`) / DB table·`@nestjs/config` 미채택 / token encrypted-at-rest + JIT decrypt / env→config 순수 함수 — 은 T-0178 (GithubModule wiring + `resolveGithubInstances` env parser, PR #162 squash 50fb704) + T-0179 (token JIT decrypt helper, ADR-0014 `LLM_APIKEY_ENC_KEY` 재사용, PR #163 squash 3e21c2d) + T-0180 (GithubInstanceClient orchestrator, PR #164 squash 23bf78b) 로 `src/github/{github.module.ts, github-instance-config.ts, github-token-decrypt.ts, github-instance-client.service.ts}` 에 main 박제 완료됐다. 잔여 GitHub live-run (실 token + 실 네트워크) 은 §5 외부 자격증명 게이트로 deferred (chain row 3). ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 가 T-0171 머지로 ACCEPTED 전이된 패턴 mirror.)

## Context

[ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) 는 GithubAdapter 의 transport 계약 (내장 fetch / 3 host variant base URL 라우팅 / `Authorization: Bearer` header / non-2xx 도메인 매핑 / Link rel=next pagination) 을 확정하면서, **각 instance 의 sub-config (host / org / token) 의 실 설정 source 형태 (env vs DB config) 는 "GithubAdapter 코드 task 책임" 으로 명시적으로 deferred** 했다. 그 결과 현재 [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) 는 이미 복호화된 평문 token + host 를 **호출 인자** (`GithubRequestInput { host, token, path, query }`) 로만 받고, 그 인자를 **어디서 채우는지** 의 설정 source 는 미확정 상태로 남아 있다 ([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L24–25 "GithubModule wiring / instance sub-config 의 실 설정 source(env/DB)" 를 본 slice 밖으로 명시 deferral).

본 결정은 **두 후속 slice 의 공통 선행** 이다 — (i) `GithubModule` (`github.module.ts`) NestJS wiring (AppModule 등록 + adapter provider 배선), (ii) token JIT decrypt ([ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 호출) 의 입력 소스. config source 가 정해지지 않으면 두 slice 모두 inline 으로 architecture 결정을 끌어들여 reviewer-risk + diff 비대화를 유발한다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 4](../../CLAUDE.md) (새 ADR = pr-mode) 정합으로, 본 ADR 이 그 config-source 결정을 단독 박제한다.

### 결정 대상 3 축

본 ADR 이 확정하는 config-source 결정 축:

- **축 (1) source 형태** — instance sub-config (host / org / encrypted token) 를 어디서 읽는지. `process.env` 기반 vs DB config table vs `@nestjs/config` package 도입 중 택일.
- **축 (2) env 변수 naming convention** — 3 instance (+ 향후 확장) 의 (host / org / token) 를 어떤 env 키 형태로 분리·열거하는지. 실값 0, 이름/shape 만 박제 ([CLAUDE.md §9](../../CLAUDE.md)).
- **축 (3) token-at-rest 위상** — env 에 실리는 token 이 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 encrypted-at-rest (JIT decrypt) 인지 평문 직접 주입인지를 [ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md) 와 정합하게 박제 + env→config 변환 경계 (순수 함수) 박제.

### REQ 외력 (본 ADR 이 cover)

- **REQ-005 / REQ-006 / REQ-007 / REQ-008** ([docs/requirements.md](../requirements.md), README L7–18) — 지정된 GitHub Service 3 instance (github.com / github.sec.samsung.net / github.ecodesamsung.com) 의 활동 평가 backbone. 본 ADR 이 "각 instance 의 host / org / token 을 어떤 source 로 설정하는지" 를 박제해 그 3 instance 활성화의 설정 경로를 확정한다.
- **REQ-044** ([README.md](../../README.md) L19–22) — instance 별 권한 분리. env 에 정의된 instance 만 활성 (자동 발견 안 함, [ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) allowlist 순회 정합) — 권한·설정 경계가 명시 instance-key 집합으로 한정된다.

### 선행 박제 정합 (milestone-1 env-as-config 패턴)

본 ADR 이 mirror 하는 기존 env-as-config-source 선례 (직접 reference):

- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) L48–73 (`resolveKey`) — `process.env[ENC_KEY_ENV]` 직접 read + env 부재 / 길이 미달 시 fail-fast throw + 평문 fallback 금지. **env 가 secret/config source 이고 새 dependency 0 인 기존 선례.** 본 ADR 의 token-at-rest 위상이 동일 cipher 접근을 재사용.
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) L60–73 — `JwtModule.registerAsync` 의 `useFactory` 가 `process.env.AUTH_JWT_SECRET ?? ""` 를 module init 시점에 read. **NestJS module 이 env 를 config source 로 쓰는 기존 선례** (`@nestjs/config` 없이 `process.env` 직접). 본 ADR 의 `GithubModule` wiring 이 동형 `registerAsync`/`useFactory` 로 env→instance config 를 binding.
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) L54–93 (`resolveLiveTestGating`) — `process.env` 를 인자 (`env: NodeJS.ProcessEnv`) 로 받아 config 객체를 계산하는 **부수효과 0 순수 함수** + 부재/빈/공백 env 의 malformed 방어 + 실값을 코드에 안 적음 ([CLAUDE.md §9](../../CLAUDE.md)). 본 ADR 의 축 (3) env→instance config parser 경계가 이 패턴을 mirror (unit-testable, 부수효과 0).

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0017** — `docs/decisions/` 에 ADR-0001 ~ ADR-0016 점유 (ADR-0007 은 미신설 — [ADR-0014 §"ADR cross-reference"](ADR-0014-llm-api-key-encryption-at-rest.md) / [ADR-0016 §"ADR cross-reference"](ADR-0016-github-adapter-http-transport-contract.md) 박제). 본 ADR 은 다음 free 번호 ADR-0017 을 사용.
- **[ADR-0016](ADR-0016-github-adapter-http-transport-contract.md)** — 본 ADR 이 그 §2 가 deferred 한 config-source 를 resolve 한다. ADR-0016 의 transport 계약 (instance key 라우팅 + 자동 발견 안 함 + host→base URL 도출) 위에 본 ADR 의 source 결정이 얹힌다 — **본 ADR 은 transport 계약을 재결정하지 않는다** (config 의 *출처* 만 추가 박제).
- **[ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md)** — GitHub token 도 본 cipher 접근 (AES-256-GCM envelope) 을 재사용 — env 에 실리는 token 은 encrypted-at-rest envelope (base64) 이고, adapter 의 HTTP 호출 직전 JIT decrypt, never-read-back ([ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md)). 축 (3) 이 이 위상을 박제.

## Decision

본 ADR 은 다음 3 결정을 박제한다. **본 ADR 은 config source / env naming / token-at-rest 위상을 기술하되 production code 0 LOC — 실 `GithubModule` wiring + env parser 코드는 후속 task.**

### Decision §1 — config source: `process.env` 기반 instance-keyed config (새 dependency 0, DB table 미채택)

- **env 기반 채택** — GithubModule 의 instance sub-config (host / org / encrypted token) 는 **`process.env` 에서 read** 한다. 기존 [llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) (`process.env[ENC_KEY_ENV]`) / [auth.module.ts](../../src/auth/auth.module.ts) (`process.env.AUTH_JWT_SECRET`) 선례를 mirror — **새 외부 dependency 0** (`@nestjs/config` / `dotenv` 등 추가 안 함, [Q-0017](../STATE.json) dep-0 제약 + [CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). `process.env` 는 Node 표준이라 `pnpm add` 불요.
- **DB config table 미채택** — instance config 를 DB entity/table 로 영속하지 않는다 (Alternatives §2). 그 경로는 `prisma migrate` schema 변경 ([CLAUDE.md §5](../../CLAUDE.md) schema-migration BLOCKED 게이트) + migration + entity CRUD 부담을 유발하는데, GitHub instance 는 **배포 환경당 고정된 소수 (3 + 향후 소량)** 이고 운영자가 부팅 시점에 한 번 설정하는 정적 config 라 DB 의 동적 CRUD / 다중 row 관리가 불요하다. env 가 [ADR-0003](ADR-0003-deployment.md) single-instance 배포의 secret/config 주입 경로 (`EnvironmentFile=`) 와도 정합.

### Decision §2 — env 변수 naming: enumerable instance-key list (`GITHUB_INSTANCES`) + per-key 접두 변수

- **enumerable key list + per-key 변수 채택** — 어느 instance 가 활성인지 열거하는 단일 key list env + instance 별 접두 변수 3 종 (base host / org / encrypted token) 으로 분리한다. 실값 0, **이름/shape 만** 박제 ([CLAUDE.md §9](../../CLAUDE.md)):

  | env 변수 | 역할 | 예시 (이름 shape 만 — 실값 0) |
  | --- | --- | --- |
  | **`GITHUB_INSTANCES`** | 활성 instance key 의 comma-separated 목록 (enumeration source). env 에 정의된 key 만 활성 — 자동 발견 안 함 ([ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) allowlist 순회 정합). | `GITHUB_INSTANCES=public,sec,ecode` |
  | **`GITHUB_<KEY>_HOST`** | 해당 instance 의 base host (예: `github.com` / `github.sec.samsung.net` / `github.ecodesamsung.com`). adapter 가 [ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) host→base URL 도출 규칙으로 API base 를 산출. | `GITHUB_PUBLIC_HOST` / `GITHUB_SEC_HOST` / `GITHUB_ECODE_HOST` |
  | **`GITHUB_<KEY>_ORG`** | 해당 instance 의 org(s). 다중 org 는 comma-separated. | `GITHUB_PUBLIC_ORG` / `GITHUB_SEC_ORG` / `GITHUB_ECODE_ORG` |
  | **`GITHUB_<KEY>_TOKEN_ENC`** | 해당 instance 의 **encrypted-at-rest token** ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) AES-256-GCM envelope base64). 평문 token 이 아니라 cipher envelope — JIT decrypt (Decision §3). `_ENC` suffix 가 "암호화된 형태" 임을 이름으로 명시. | `GITHUB_PUBLIC_TOKEN_ENC` / `GITHUB_SEC_TOKEN_ENC` / `GITHUB_ECODE_TOKEN_ENC` |

- **단일 JSON env 대비 enumerable 분리 채택 근거** — 단일 `GITHUB_INSTANCES_JSON` 같은 JSON blob 한 변수에 전부 싣는 대안 (Alternatives §4) 보다, key list + per-key 변수가 (i) 운영자가 instance 하나의 token 만 rotate 할 때 그 한 변수만 교체하면 되고 (JSON blob 은 전체 재작성), (ii) systemd `EnvironmentFile=` / CI secret store 가 변수 단위 권한·주입에 친화적이며, (iii) token (secret) 을 host/org (non-secret) 와 **변수 단위로 분리** 해 [CLAUDE.md §9](../../CLAUDE.md) secret 격리 (로그/직렬화에서 `_TOKEN_ENC` 만 마스킹 대상)에 유리하다. JSON blob 은 secret 과 non-secret 이 한 문자열에 섞여 마스킹·rotation 경계가 흐려진다.
- **자동 발견 안 함** — `GITHUB_INSTANCES` 에 열거된 key 집합만 순회한다 ([ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) "설정으로 주어진 instance key 집합만 순회" 와 동형). env 에 `sec` key 의 3 변수가 모두 없으면 그 instance 는 비활성 — 환경별 부분 활성 (예: 사내 host 없는 환경은 `public` 만) 이 자연 지원된다.

### Decision §3 — token-at-rest 위상 + env→config 변환 경계 (순수 함수)

- **token encrypted-at-rest, JIT decrypt** — `GITHUB_<KEY>_TOKEN_ENC` 에 실리는 값은 [ADR-0014 §1](ADR-0014-llm-api-key-encryption-at-rest.md) AES-256-GCM envelope (base64) 형태의 **암호문** 이다 (평문 token 직접 env 주입 아님). adapter 는 [ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) 대로 **HTTP 호출 직전 (Authorization header 에 실으려는 순간) 에만** [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher (`LlmApiKeyCipher` 와 동일 접근 — Decision §3 cipher 재사용/일반화는 후속 wiring task 가 확정) 로 decrypt 하고, 복호화 결과는 응답 / 로그 / 직렬화 어디에도 노출하지 않는다 (in-memory transient, [ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md) never-read-back). cipher 의 master key 는 기존 [ADR-0014 §2](ADR-0014-llm-api-key-encryption-at-rest.md) `LLM_APIKEY_ENC_KEY` 재사용 여부 (또는 token 전용 `GITHUB_TOKEN_ENC_KEY` 신설) 를 후속 wiring task 가 확정 — **본 ADR 은 새 env key 를 도입하지 않는다** (token-at-rest 위상만 박제).
- **live-run 시 실 token 주입 경로는 §5 게이트로 deferred** — `GITHUB_<KEY>_TOKEN_ENC` 의 실 암호문 (즉 실 GitHub token 을 암호화한 값) 의 환경 주입 + 실 네트워크 live smoke 는 후속 live-run task 의 [CLAUDE.md §5](../../CLAUDE.md) 외부 자격증명 게이트 대상이다 (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 패턴 mirror). 본 ADR 은 env 변수 **이름/shape** 만 박제하며 어떤 token / 암호문 실값도 기재하지 않는다 ([CLAUDE.md §9](../../CLAUDE.md)).
- **env → instance config 변환 = 순수 함수 경계** — `process.env` 를 읽어 `GITHUB_INSTANCES` 를 파싱하고 각 key 의 3 변수를 instance sub-config 객체 배열 (`{ key, host, orgs, tokenEnc }`) 로 변환하는 로직은 **부수효과 0 순수 함수** (인자로 `env: NodeJS.ProcessEnv` 를 받음) 로 둔다 — [llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) `resolveLiveTestGating` 패턴 mirror. 이로써 missing/malformed config (열거된 key 의 변수 부재 / 빈 host / 빈 token_enc 등) 분기를 spec 이 직접 호출해 R-112 카테고리로 cover 가능하다 (boot 시점 검증 layer). 부재/malformed 시 fail-fast (해당 instance 거부 또는 명확한 error) — 평문/빈 fallback 금지 ([cipher resolveKey](../../src/llm/llm-apikey-cipher.service.ts) fail-fast 정합). **실 parser 코드는 본 ADR scope 외** (후속 wiring code task).

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — config-source 의 **결정** 만 박제한다. `pnpm add` 0 / 외부 호출 0 / secret 0 / schema migration 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row + modules.md 1 줄 pointer).
- **§5 게이트 미발화** — env 기반 (dep 0) + schema 변경 0 이므로 본 ADR 은 [CLAUDE.md §5](../../CLAUDE.md) 새 dependency / schema-migration BLOCKED 게이트를 **발화하지 않는다**. 후속 wiring code task 도 dependency-free 로 진입 가능. **실 token 주입만** §5 credential 게이트로 deferred.

## Consequences

### 양의 (positive)

1. **dependency-free + schema-free 즉시 착수** — Decision §1 의 `process.env` 채택 → 후속 GithubModule wiring 이 `pnpm add` 0 + `prisma migrate` 0 으로 진입 ([CLAUDE.md §5](../../CLAUDE.md) 새 dependency / schema-migration BLOCKED 게이트 동시 회피). DB config table (migration + entity CRUD) 대비 도입 마찰 최소.
2. **기존 env 선례 재사용** — Decision §1/§3 이 [llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) / [auth.module.ts](../../src/auth/auth.module.ts) / [llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 의 env-read + 순수 함수 parser 패턴을 mirror → architect/implementer 의 config 환각 ↓, 일관된 아키텍처. 운영자 학습 비용 0 (auth/llm 과 동일 env 주입 방식).
3. **부분 활성 + rotation 친화** — Decision §2 의 enumerable key list + per-key 변수가 환경별 부분 활성 (host 없는 환경은 일부 instance 만) + instance 단위 token rotation (해당 `_TOKEN_ENC` 한 변수만 교체) 을 자연 지원. JSON blob 대비 운영 granularity 우수.
4. **secret 격리 + at-rest 정합** — Decision §2/§3 이 token 을 host/org 와 변수 단위로 분리 (`_TOKEN_ENC` 만 마스킹 대상) + [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) encrypted-at-rest envelope + JIT decrypt never-read-back 재사용 → token 유출 surface ↓, 새 secret 메커니즘 도입 0 ([CLAUDE.md §9](../../CLAUDE.md) 정합).
5. **boot 시점 검증 + ADR-0016 정합** — Decision §3 의 순수 함수 parser 가 missing/malformed config 를 unit 으로 full cover 가능 + 자동 발견 안 함 (allowlist) 이 [ADR-0016 §2](ADR-0016-github-adapter-http-transport-contract.md) 와 구조적 정합.

### 음의 (negative) / trade-off

1. **env 변수 다수 관리 부담** — Decision §2 상 instance 당 3 변수 (host / org / token_enc) + key list → 3 instance 면 10 변수. mitigation: systemd `EnvironmentFile=` / CI secret store 의 변수 단위 관리로 흡수 + 순수 함수 parser 의 fail-fast 검증으로 부분-set/오타를 boot 시점 표면화 (Decision §3). DB CRUD UI 가 없는 trade-off 이나, instance 가 정적 소수라 UI 불요.
2. **boot 시점 검증 layer 필요** — Decision §3 상 env 부재/빈/malformed (열거된 key 의 변수 누락 등) 를 거부할 검증 함수를 후속 wiring task 가 구현해야 함 (`@nestjs/config` 의 Joi schema 같은 기성 검증 부재). mitigation: [llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 의 `isPresent` 방어 + [cipher resolveKey](../../src/llm/llm-apikey-cipher.service.ts) fail-fast 패턴 재사용 → 검증이 순수 함수라 R-112 negative cases 로 full cover.
3. **동적 재구성 불가** — env 기반은 runtime 중 instance 추가/변경 시 process restart 필요 (DB config 면 row 추가로 hot-reload 가능). mitigation: GitHub instance 는 배포당 고정 소수라 동적 재구성 needs 0 — restart 비용 무시 가능. 향후 동적 needs 발생 시 DB config 전환 supersede ADR (Alternatives 재검토 조건).

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **GithubModule wiring + env config parser** | `src/github/github.module.ts` (@Module) + AppModule 등록 + Decision §3 순수 함수 (env → instance sub-config 배열 변환 + missing/malformed fail-fast) + R-112 4 종 + negative cases 충분 cover (key 부재 / host 빈 / token_enc 빈 / 열거-key 와 변수 set 불일치 등) | 본 ADR-0017 머지 후 | **없음 — `process.env` (dep 0), `pnpm add` 0, schema 0.** §5 게이트 미발화 |
| **token JIT decrypt wire** | adapter 호출 직전 `GITHUB_<KEY>_TOKEN_ENC` envelope 를 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 decrypt → 평문 token 을 `GithubRequestInput.token` 인자로 공급 (in-memory transient, never-read-back) | wiring 머지 + cipher 재사용/일반화 결정 | **없음 — Node 내장 `crypto` (dep 0).** 단 token 전용 master key env 신설 시 운영 secret 도입 |
| **GitHub live-run** | 실 GitHub token (3 host variant) 을 암호화한 `_TOKEN_ENC` env 주입 후 live smoke/e2e (실값은 [§9](../../CLAUDE.md) 파일 금지) | wiring + decrypt 머지 + 사용자 credential | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 패턴 mirror) |
| **ADR-0017 PROPOSED→ACCEPTED** | wiring 머지 후 status 한 줄 갱신 (direct) | wiring 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) `process.env` 기반 instance-keyed config (`GITHUB_INSTANCES` + per-key 변수)** (채택) | 외부 dependency 0 (`pnpm add` 0) + schema 변경 0 ([CLAUDE.md §5](../../CLAUDE.md) 두 게이트 동시 회피) / 기존 [auth.module.ts](../../src/auth/auth.module.ts) · [llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) env 선례 재사용 / instance 단위 rotation·부분 활성 friendly / token 변수 격리로 [CLAUDE.md §9](../../CLAUDE.md) secret 정합 / [ADR-0003](ADR-0003-deployment.md) single-instance env 주입 정합 | env 변수 다수 관리 부담 / boot 검증 layer 직접 구현 / runtime 동적 재구성 불가 (정적 instance 라 실 제약 0) | **✓ 채택** ([Q-0017](../STATE.json) dep-0 제약 직접 충족) |
| (2) DB config entity/table | 동적 CRUD (runtime instance 추가/변경 hot-reload) / admin UI 친화 / row-level audit | **`prisma migrate` schema 변경 ([CLAUDE.md §5](../../CLAUDE.md) schema-migration BLOCKED 게이트) + entity + CRUD endpoint 부담** / GitHub instance 는 배포당 고정 소수라 동적 CRUD over-engineering / token 영속이 또 한 겹 ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher) 필요한데 env 와 이중 source 혼란 | 기각 — schema 게이트 + migration 부담 + 정적 instance 에 over-engineering |
| (3) `@nestjs/config` package 도입 | `ConfigModule` + `.env` 로드 + Joi schema 검증 기성 제공 / NestJS 표준 config 추상 | **새 외부 dependency ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 + [Q-0017](../STATE.json) dep-0 제약 정면 위반)** / 기존 [auth.module.ts](../../src/auth/auth.module.ts) 가 이미 `process.env` 직접 read 로 일관 — `@nestjs/config` 만 GitHub 에 쓰면 비일관 / `process.env` + 순수 함수 검증으로 동등 충족 | 기각 — 새 dependency, Q-0017 dep-0 위반, 기존 패턴으로 충족 가능 |
| (4) 단일 JSON blob env (`GITHUB_INSTANCES_JSON`) | env 변수 1 개 (관리 단순) / 구조화된 nested config 한 번에 | secret(token) 과 non-secret(host/org) 이 한 문자열에 혼재 → 마스킹·rotation 경계 흐림 ([CLAUDE.md §9](../../CLAUDE.md) secret 격리 열세) / instance 1 개 rotation 에 전체 blob 재작성 / systemd/CI 의 변수 단위 권한·주입 친화도 ↓ / JSON 파싱 오류 진단이 변수 단위보다 모호 | 기각 (Decision §2 에서 enumerable 분리 채택) — secret 격리·rotation granularity 열세 |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) GitHub instance 의 runtime 동적 추가/변경 needs 가 생기면 DB config table 전환 supersede ADR. (ii) instance 수가 크게 늘어 env 변수 관리가 부담이 되면 단일 secret store (vault) 통합 ADR. (iii) token 전용 master key 분리가 필요해지면 `GITHUB_TOKEN_ENC_KEY` 신설을 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) 갱신/보강으로 결정.

## References

- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) — §2 (instance key sub-config 분리 + "설정 형태 env/DB 는 코드 task 책임" deferral — 본 ADR 이 resolve) / §6 (token JIT decrypt 위상) / "후속 task chain"
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) — §1 AES-256-GCM envelope / §2 env 키 보관 (`LLM_APIKEY_ENC_KEY`) / §3 never-read-back (token encrypted-at-rest + JIT decrypt 재사용 source)
- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — env-gated config + 순수 함수 helper + PROPOSED→ACCEPTED 전이 패턴 (본 ADR mirror)
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](ADR-0013-confluence-space-traversal-policy.md) — ADR template / HITL 경계 단락 / Alternatives 표 형식 mirror
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) §2 — env 기반 secret/config 주입 (single-instance `EnvironmentFile=`) — 채택안 env source baseline
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) — `process.env[ENC_KEY_ENV]` 직접 read + fail-fast (Decision §1/§3 env-as-source + token cipher 재사용 reference)
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — `process.env.AUTH_JWT_SECRET` `registerAsync`/`useFactory` (Decision §1 NestJS module env-source reference)
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — `resolveLiveTestGating` 순수 함수 env→config 변환 + malformed 방어 (Decision §3 parser 경계 reference)
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — 현 `GithubRequestInput { host, token, path }` 인자 + "instance sub-config 의 실 설정 source(env/DB)" deferral (본 ADR 이 채울 입력 source)
- [docs/PLAN.md L81](../PLAN.md) — Phase P4 "GitHub 통합 — 3 instance 모두, 각 instance URL·org·token 설정 분리" (본 결정의 직접 구현 경로)
- [docs/requirements.md](../requirements.md) — REQ-005/006/007/008 (GitHub 3 instance) / REQ-044 (instance 권한 분리) source of truth
- [docs/architecture/modules.md](../architecture/modules.md) — GithubModule row (단일 module + instance sub-config) — 책임 module + pointer 추가 대상
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0017 row)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — 새 ADR = pr-mode
- [CLAUDE.md §5](../../CLAUDE.md) — 새 dependency / schema migration / 자격증명 BLOCKED 게이트 (본 ADR env 기반 + doc-only 라 미발화, live-run task 만 credential 게이트)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 값 절대 미기재 (env 이름/shape 만 박제)

Refs: T-0177, ADR-0003, ADR-0013, ADR-0014, ADR-0015, ADR-0016, REQ-005, REQ-006, REQ-007, REQ-008, REQ-044
