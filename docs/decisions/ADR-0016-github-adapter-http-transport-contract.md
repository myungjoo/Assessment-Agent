---
id: ADR-0016
title: GithubAdapter HTTP transport 계약 — 내장 fetch transport / 3 host variant base URL 라우팅 / auth header shape / non-2xx 도메인 매핑 / Link pagination / adapter↔gateway 경계
status: ACCEPTED (2026-06-03)
date: 2026-06-02
relatedTask: T-0173
supersedes: null
---

# ADR-0016 — GithubAdapter HTTP transport 계약 박제

> ACCEPTED (2026-06-03, T-0181 에서 status 전이). 본 ADR 의 transport 계약 — 내장 fetch + injectable `FetchLike` / 3 host variant base URL 라우팅 / `Authorization: Bearer` + `X-GitHub-Api-Version` / non-2xx→PermissionDeniedEvent 도메인 매핑 / Link rel=next pagination — 은 T-0174 (순수 request-builder) + T-0175 (service dispatch + non-2xx 매핑) + T-0176 (Link pagination, PR #160 squash ff864d3) 로 `src/github/github-adapter.service.ts` + `github-request.builder.ts` 에 main 박제 완료됐다. mocked-fetch unit + adapter cov 100% 동반. ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 가 T-0171 머지로 ACCEPTED 전이된 패턴 mirror.)

## Context

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` 으로 P4 milestone-3 (GitHub adapter + Confluence adapter) 를 승인했다. 그 승인은 **4 EXACT 제약**을 명시한다 — (1) HTTP transport = Node 내장 `globalThis.fetch` (injectable `FetchLike`), **새 외부 dependency 0** (octokit / axios / node-fetch 추가 금지), (2) test = mocked-fetch unit (실 token 없이 public CI green), (3) 실 token live 통합은 별도 [§5](../../CLAUDE.md) credential 게이트 task 로 deferred, (4) milestone-1 패턴 (내장 fetch + mocked test + live defer) 재현.

[docs/PLAN.md L81](../PLAN.md) ("GitHub 통합 — 3 instance 모두: github.com / github.sec.samsung.net / github.ecodesamsung.com. 각 instance 의 URL·org·token 설정 분리") 이 이 milestone 의 source 다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 4](../../CLAUDE.md) (새 ADR = pr-mode) 정합으로, `GithubAdapter` scaffold 코드 task 의 **선행 결정 ADR** 을 본 task 가 단독 박제한다. milestone-1 이 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) (key 암호화) + [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) (live-test 계약) 를 코드보다 먼저 박제한 것과 동형 — milestone-3 은 [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 이 **Confluence 측 탐색 정책만** cover 하므로, GitHub adapter 의 **HTTP transport 계약** (내장 fetch / 3 host variant 라우팅 / auth header shape / non-2xx 도메인 매핑 / REST Link pagination / adapter↔gateway interface 경계) 을 cross-cutting 결정으로 본 ADR 이 확정한다.

### 결정 대상 6 축

본 ADR 이 확정하는 transport 계약 축:

- **축 (1) 내장 fetch transport** — HTTP 호출을 어느 client 로 수행하는지. octokit SDK vs axios/node-fetch vs Node 내장 `fetch` 중 택일.
- **축 (2) 3 host variant base URL 라우팅** — github.com (public) vs Enterprise host (github.sec.samsung.net / github.ecodesamsung.com) 의 API base URL 을 configured host 로부터 어떻게 도출하는지.
- **축 (3) auth header + 필수 header shape** — token 을 어느 `Authorization` 형태로 싣는지 + `Accept` / `X-GitHub-Api-Version` header.
- **축 (4) non-2xx → 도메인 error 매핑** — 4xx / 429 / 5xx / network reject 를 어떤 도메인 error 위상으로 매핑하는지 + 4xx → PermissionDeniedEvent emit 경계.
- **축 (5) REST pagination** — GitHub REST 의 `Link` header (`rel="next"`) cursoring 계약 + raw 미저장 invariant 정합.
- **축 (6) adapter↔gateway/service 경계** — `src/github/` module 안에서 순수 request-builder 함수 / 주입 fetch dispatch / service orchestration 의 경계 + token 복호화 ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher) 의 just-in-time 위상.

### REQ 외력 (본 ADR 이 cover)

- **REQ-005 / REQ-006 / REQ-007 / REQ-008** ([docs/requirements.md](../requirements.md), README L7–18) — 지정된 GitHub Service (3 instance) 의 commit / PR / Issue 활동 평가 backbone. 본 ADR 의 축 (1)~(5) 가 그 "3 instance 의 활동 수집" 의 transport 계층 (host 라우팅 / auth / error / pagination) 을 박제한다.
- **REQ-044** ([README.md](../../README.md) L19–22) — instance 별 권한 분리. 본 ADR 의 축 (4) 4xx → PermissionDeniedEvent emit 위상이 권한 부족 가시화의 transport 측 경계를 박제 ([modules.md](../architecture/modules.md) "4xx catch → PermissionDeniedEvent emit" 책임과 직결).
- **REQ-059 / [ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant. 본 ADR 의 축 (5) pagination 수집 단위 (commit / issue / PR 메타) 가 이 invariant 위에서 성립 — raw 본문 transient.

### 선행 박제 정합 (milestone-1 transport 패턴 / adapter leaf)

본 ADR 이 mirror 하는 milestone-1 transport 패턴 (직접 reference 구현):

- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — `FetchLike` 함수 타입을 `@Optional()` 생성자 주입 (default `globalThis.fetch`) → unit 은 주입 mock 으로 검증, 실 네트워크 0. provider 분기 dispatch → 주입 fetch 호출 → `!response.ok` 시 status 포함 throw → 응답 파싱 dispatch. **본 GithubAdapter transport 가 동형으로 mirror 할 reference.**
- [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) — 순수 함수 `{url, headers, body}` builder (`assertNonEmpty` 방어) + response parse (비정상 응답 throw), 부수효과 0 / 외부 의존 0 / apiKey 평문 인자만 (decrypt 는 호출처 책임). **본 GithubAdapter request-builder 가 mirror 할 reference.**
- **adapter leaf** — [modules.md](../architecture/modules.md) 상 GithubModule 은 다른 internal module 을 import 하지 않는 **adapter leaf** 로 외부 GitHub HTTPS 만 호출 ([ADR-0003 §4](ADR-0003-deployment.md) 외부 adapter direct egress). 본 ADR 의 transport 계약은 이 leaf 경계 안 (HTTP 호출 + 결과 변환) 에서만 동작.

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0016** — `docs/decisions/` 에 ADR-0001 ~ ADR-0015 점유 (ADR-0007 은 미신설 — [ADR-0013 §ADR cross-reference](ADR-0013-confluence-space-traversal-policy.md) / [ADR-0014 §ADR cross-reference](ADR-0014-llm-api-key-encryption-at-rest.md) 박제). 본 ADR 은 다음 free 번호 ADR-0016 을 사용 (T-0173 acceptance 의 번호 정합 명시).
- **[ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md)** — GitHub / Confluence token 도 본 cipher 접근을 재사용 — config 의 token 은 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) §1 AES-256-GCM envelope 으로 encrypted-at-rest, 본 adapter 의 HTTP 호출 직전 just-in-time decrypt, never-read-back ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) §3). 축 (6) 이 이 위상을 박제.
- **[ADR-0013](ADR-0013-confluence-space-traversal-policy.md)** — Confluence 측 4xx skip-and-continue + PermissionDeniedEvent emit 정책. 본 ADR 의 축 (4) 가 GitHub 측 4xx 매핑을 **그와 정합하게** 박제하되, GitHub 의 instance/repo 단위 경계로 위상을 명시 (Confluence 의 SPACE 단위와 동형이나 대상 단위 상이). 본 ADR 은 Confluence 측 결정을 **중복하지 않는다**.

## Decision

본 ADR 은 다음 6 결정을 박제한다. **본 ADR 은 transport 계약 (transport client / host 라우팅 / header shape / error 매핑 / pagination / 경계) 을 기술하되 production code 0 LOC — 실 `GithubAdapter` 코드는 후속 task.**

### Decision §1 — transport client: Node 내장 `globalThis.fetch` (injectable `FetchLike`, 새 dep 0)

- **내장 fetch 채택** — GithubAdapter 의 HTTP transport 는 Node 내장 `globalThis.fetch` 를 사용한다. **새 외부 dependency 0** — octokit (`@octokit/rest`) / axios / node-fetch 어느 것도 추가하지 않는다 ([Q-0017](../STATE.json) 제약, [CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). `fetch` 는 Node LTS 표준 내장 ([ADR-0001](ADR-0001-stack.md)) 이라 `pnpm add` 불요.
- **injectable `FetchLike`** — milestone-1 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 의 `FetchLike` 함수 타입 `@Optional()` 생성자 주입 (default `globalThis.fetch`) 패턴을 mirror 한다. GithubAdapter 도 fetch 를 직접 호출하지 않고 주입 함수로 받아 — unit 은 주입한 fetch mock 으로 검증 (실 네트워크 호출 0, 실 token 0). GitHub REST 는 `Link` header 를 읽어야 하므로 (Decision §5) `FetchLike` 의 response surface 는 milestone-1 의 `{ ok, status, json }` 에 **`headers` 접근** (`Headers.get("link")` 또는 동형) 을 추가한다 — 구체 타입 form 은 GithubAdapter 코드 task 책임, 본 ADR 은 "Link header 를 읽을 수 있는 fetch surface" 의 계약만 박제.

### Decision §2 — 3 host variant base URL 라우팅: configured host → API base URL 도출 규칙

- **host → base URL 도출 규칙 박제** — adapter 는 instance 별 configured host 로부터 REST API base URL 을 다음 규칙으로 도출한다:
  - **github.com (public)** → API base `https://api.github.com` (host 와 API host 가 분리된 public 의 특수 규칙).
  - **GitHub Enterprise host** (`github.sec.samsung.net` / `github.ecodesamsung.com`) → API base `https://<host>/api/v3` (Enterprise Server REST v3 의 표준 base path — `/api/v3` suffix).
- **instance key sub-config 분리** — 단일 `GithubAdapter` service 가 instance key 로 라우팅한다 ([modules.md](../architecture/modules.md) GithubModule row "단일 module + instance sub-config" 정합). 각 instance 는 (host / org / token) 의 분리된 sub-config 를 가지며, adapter 는 호출 시 instance key 로 해당 sub-config 를 선택해 base URL · org · token 을 라우팅한다. **3 instance 자동 발견 안 함** — 설정으로 주어진 instance key 집합만 순회 ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) SPACE allowlist 순회와 동형 경계). sub-config 의 설정 형태 (env / DB config) 는 GithubAdapter 코드 task 책임 — 본 ADR 은 "configured host → base URL 도출 규칙" + "instance key 라우팅, 자동 발견 안 함" 의 계약만 박제.
- **public vs Enterprise 분기 근거** — public github.com 은 API 가 별도 host (`api.github.com`) 인 반면, Enterprise Server 는 같은 host 아래 `/api/v3` path 로 REST 를 노출한다 (GitHub REST API 표준). 이 비대칭을 host 값 매칭으로 분기하는 것이 본 결정의 핵심 — base URL 조립에 link 본문 파싱이나 외부 discovery 호출이 불요 (정적 규칙).

### Decision §3 — auth header shape: `Authorization: Bearer <token>` + Accept + X-GitHub-Api-Version

- **`Authorization: Bearer <token>` 채택** — GitHub REST API 의 권장 auth header 는 `Authorization: Bearer <token>` (fine-grained PAT / classic PAT / GitHub App token 모두 지원). 구식 `Authorization: token <token>` 도 classic PAT 에 동작하나, GitHub 공식 문서가 **`Bearer` 를 현행 권장 form** 으로 명시하고 fine-grained token 과의 호환을 위해 `Bearer` 를 단일 채택한다 (milestone-1 [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) 의 `Authorization: Bearer <apiKey>` 와도 형태 정합).
- **필수 header** — 모든 REST 호출에 다음 header 를 싣는다:
  - **`Accept: application/vnd.github+json`** — GitHub REST 의 권장 media type (v3 JSON 응답).
  - **`X-GitHub-Api-Version: 2022-11-28`** — REST API 버전 pin (GitHub 권장 — 버전 미pin 시 default 변동 risk). 구체 버전 문자열은 GithubAdapter 코드 task 가 상수로 공급하되 (milestone-1 의 `AZURE_OPENAI_DEFAULT_API_VERSION` 상수 패턴 mirror), 본 ADR 은 "`X-GitHub-Api-Version` header 를 명시 pin" 의 계약을 박제.
- **token 실값 0 기재** ([CLAUDE.md §9](../../CLAUDE.md)) — 본 ADR 은 어떤 GitHub token 실값도 기재하지 않는다. token 은 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 encrypted-at-rest 후 호출 직전 decrypt (Decision §6), 또는 후속 live-run task 의 env 주입 (값 0). header 에 실리는 평문 token 은 로그 / 직렬화 / 에러 메시지에 노출하지 않는다.

### Decision §4 — non-2xx → 도메인 error 매핑 + 4xx PermissionDeniedEvent 경계

- **도메인 error 매핑 박제** — adapter 는 fetch response 의 status 를 다음 도메인 error 위상으로 매핑한다 (milestone-1 gateway 의 `!response.ok` → status 포함 throw 단일 경로를 **GitHub 도메인에 맞게 분기 확장**):
  | status | 도메인 분류 | 위상 |
  | --- | --- | --- |
  | **401 / 403** | `permission-denied` | token 무효 / 권한 부족. 4xx catch → **PermissionDeniedEvent emit** ([modules.md](../architecture/modules.md) GithubModule "4xx catch → PermissionDeniedEvent emit" 책임). |
  | **404** | `not-found` | 대상 repo / resource 부재 또는 권한상 비가시. 권한 비가시 404 도 emit 후보 (GitHub 은 권한 부족을 404 로 위장하기도 함). |
  | **429 / secondary-rate-limit** | `rate-limited` | primary rate limit (`Retry-After` / `X-RateLimit-Remaining: 0`) 및 secondary rate limit. backoff 위상 박제 (구체 backoff 구현은 코드 task). |
  | **5xx** | `upstream-error` | GitHub 측 장애. |
  | **network / fetch reject** | `transport-error` | DNS / TLS / connection reset 등 fetch reject (status 부재). |
- **PermissionDeniedEvent emit 위상** — 401 / 403 (및 권한 비가시 404) catch 시 adapter 는 **PermissionDeniedEvent 를 emit** 한다 (REQ-044 권한 가시화). emit 자체 책임은 [modules.md](../architecture/modules.md) GithubModule row 와 직결. **PermissionDeniedRecord entity 의 실 schema 는 본 ADR scope 외** ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 와 동일 후속 entity task).
- **abort vs skip-and-continue 위상 — instance / repo 단위** — 권한 부족 (4xx) 시 탐색-제어는 **instance / repo 단위 skip-and-continue** 다 — 한 instance 또는 한 repo 의 권한 누락이 전체 GitHub 수집을 abort 시키지 않고, 권한 있는 나머지 instance / repo 의 수집을 계속한다 (부분 가용성, [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) §3 SPACE 단위 skip-and-continue 와 **동형이되 대상 단위는 instance / repo**). 단 transport-error (network) / 5xx 는 일시 장애일 수 있어 retry/backoff 후 실패 시 그 instance/repo 만 skip — 전면 abort 아님.

### Decision §5 — REST pagination: `Link` header (`rel="next"`) cursoring

- **`Link` header cursoring 채택** — GitHub REST 의 list endpoint (commits / issues / pulls 등) 는 응답 `Link` header 에 `<...>; rel="next"` 형태로 다음 page URL 을 제공한다. adapter 는 **`Link` header 의 `rel="next"` URL 을 끝까지 순회** (next 부재 시 종료) 하여 전 page 를 수집한다. page 번호를 직접 증가시키지 않고 GitHub 이 준 next URL 을 그대로 따른다 (GitHub 권장 — opaque cursor 호환).
- **per-page 최대화** — round-trip 횟수를 줄이기 위해 `per_page` 를 GitHub 허용 최대 (현행 `100`) 로 설정한다 ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) §1 "paging 끝까지 순회 + limit 최대화" 와 동형). 구체 per_page 값 / 증분 수집 (since 파라미터로 변경분만) 은 GithubAdapter 코드 task 의 성능 책임 — 본 ADR 은 "`Link` rel=next 순회 + per_page 최대화" 의 계약만 박제.
- **raw 미저장 invariant 정합** — 수집 단위는 commit / issue / PR 의 **메타** (sha / author / timestamp / 식별자) 이며, raw 본문 (commit message 전문 / issue body) 은 평가 파이프라인 입력으로만 transient 사용하고 영속화하지 않는다 ([ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 raw 미저장 invariant). `Link` cursoring 은 page 단위 메타 enumerate 이므로 이 invariant 와 정합 — link 본문 파싱 불요.

### Decision §6 — adapter↔gateway/service 경계: `src/github/` module, 순수 builder + 주입 fetch dispatch + JIT decrypt

- **module 위치** — GithubAdapter 는 **`src/github/` module** (GithubModule, adapter leaf) 안에 위치한다 ([modules.md](../architecture/modules.md) GithubModule row). 다른 internal module 을 import 하지 않고 외부 GitHub HTTPS 만 호출.
- **경계 박제 (milestone-1 패턴 mirror)** — milestone-1 의 (순수 request-builder 함수) / (service orchestration + 주입 fetch dispatch) 분리를 mirror 한다:
  - **순수 함수 (unit-testable, 부수효과 0)** — request-builder (instance sub-config + 대상 → `{url, headers}` 조립, Decision §2/§3) + response/Link parser (`Link` header → next URL 추출, status → 도메인 error 분류, Decision §4/§5). [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) 의 `assertNonEmpty` 방어 + 비정상 응답 throw 패턴 mirror. apiKey/token 은 평문 인자로만 받음 (decrypt 는 호출처).
  - **service orchestration** — instance 라우팅 + 주입 fetch dispatch (Decision §1) + pagination 순회 loop (Decision §5) + 4xx catch → PermissionDeniedEvent emit (Decision §4) + token JIT decrypt. 이 부분이 NestJS `@Injectable` service.
- **token JIT decrypt 위상 ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용)** — instance sub-config 의 token 은 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) §1 AES-256-GCM envelope 으로 encrypted-at-rest 저장된다. adapter 는 **HTTP 호출 직전 (Authorization header 에 실으려는 순간) 에만** cipher 로 decrypt 하고, 복호화 결과는 응답 / 로그 / 직렬화 어디에도 노출하지 않는다 (in-memory transient, [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) §3 never-read-back). cipher 는 milestone-1 의 `LlmApiKeyCipher` 와 동일 접근 (`LLM_APIKEY_ENC_KEY` env, 또는 token 전용 env 도입 시 별도 — 후속 task 가 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) env 재사용 여부 확정). **본 ADR 은 새 env 를 도입하지 않는다** — cipher 접근 위상만 박제.

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — GithubAdapter transport 계약의 **결정** 만 박제한다. `pnpm add` 0 / 외부 호출 0 / secret 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row + modules.md 1 줄 pointer).
- **GithubAdapter 실 코드는 §5 의존성 게이트 미발화** — [Q-0017](../STATE.json) 제약상 transport = **내장 fetch (dep 0)** 이므로, GithubAdapter scaffold 코드 task 는 [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency" BLOCKED 게이트를 **발화하지 않고** dependency-free 로 진입 가능하다. ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 의 ConfluenceAdapter 가 SDK/token 게이트 대상이었던 것과 대비 — 본 milestone-3 은 내장 fetch 제약으로 dependency 게이트가 사라졌다. p4-implementation-plan T-0140 row 의 '@octokit/rest dependency 게이트' 표기는 본 결정으로 대체됨 — Alternatives 참조.)
- **실 token live 통합만 §5 credential 게이트로 deferred** — 실 GitHub token (3 host variant) 의 env/secret 주입 + 실 네트워크 live smoke 는 후속 live-run task 의 [CLAUDE.md §5](../../CLAUDE.md) 외부 자격증명 게이트 대상이다 (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) / Q-0016 optionA task 2 패턴 mirror). 본 ADR 은 env 변수 **이름/형태** 만 박제 가능하며 실값 0 ([CLAUDE.md §9](../../CLAUDE.md)).

## Consequences

### 양의 (positive)

1. **dependency-free 즉시 착수** — Decision §1 의 Node 내장 `fetch` 채택 → 후속 GithubAdapter scaffold 가 `pnpm add` 0 으로 진입 ([CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). octokit SDK (큰 의존 트리 + 버전 관리) 대비 도입 마찰 최소.
2. **milestone-1 패턴 재사용** — Decision §1/§6 이 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 의 `FetchLike` 주입 + 순수 builder/parser 분리를 mirror → architect/implementer 의 transport 환각 ↓, 일관된 아키텍처. mocked-fetch unit 으로 transport 분기 전체 cover 가능 (public CI green).
3. **3 host 비대칭 정적 해소** — Decision §2 의 host → base URL 도출 규칙 (public `api.github.com` vs Enterprise `/api/v3`) 이 정적 매칭으로 박제 → discovery 호출 / 외부 round-trip 불요. instance key allowlist 라우팅이 자동 발견 risk 제거.
4. **권한 가시성 + 부분 가용성** — Decision §4 의 4xx → PermissionDeniedEvent emit + instance/repo 단위 skip-and-continue 로 한 instance 권한 누락이 전체 수집을 막지 않음 (REQ-044 권한 가시화 + robustness). [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 와 동형 정책이라 GitHub/Confluence 일관.
5. **secret-at-rest 정합** — Decision §6 의 token JIT decrypt + never-read-back 이 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 접근을 재사용 → token 유출 surface ↓, 새 secret 메커니즘 도입 0.
6. **raw 미저장 invariant 정합** — Decision §5 의 `Link` cursoring 이 메타 단위 enumerate (raw 본문 transient) 라 [ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 invariant 와 구조적 정합.

### 음의 (negative) / trade-off

1. **octokit 편의 기능 미사용** — Decision §1 상 octokit SDK 의 자동 pagination / rate-limit retry / typed response 를 직접 구현해야 한다 (Decision §4 backoff + §5 Link 순회를 adapter 코드가 박제). mitigation: milestone-1 이 이미 내장 fetch 로 4 provider transport 를 구현해 패턴이 검증됨 — GitHub 도 동형 + 순수 함수 unit cover.
2. **live 경로 CI 미검증** — mocked-fetch unit 만으로는 실 GitHub 계약 (3 host 의 실 응답 / 실 Link header / 실 rate-limit) 을 CI 에서 검증하지 못한다 (skip). mitigation: 순수 builder/parser 는 unit full cover + 후속 §5 live-run task 가 실 token 으로 1 회 검증 ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) live 패턴 mirror).
3. **Enterprise 버전 변동 risk** — Decision §2 의 `/api/v3` base + Decision §3 의 `X-GitHub-Api-Version` pin 은 GitHub Enterprise Server 버전에 따라 일부 endpoint 가 달라질 수 있다. mitigation: version pin header 가 default 변동을 차단 + 버전 불일치는 후속 live-run 에서 표면화 (adapter 가 도메인 error 로 매핑).
4. **secondary rate-limit 모호성** — Decision §4 의 secondary-rate-limit 은 GitHub 이 명확한 status 로 항상 주지 않을 수 있다 (403 + 특정 메시지로 오기도 함). mitigation: 403 의 rate-limit 메시지/header 판별은 코드 task 가 `Retry-After` / `X-RateLimit-*` header 로 보강 — 본 ADR 은 위상만, 구체 판별은 코드.

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **GithubAdapter scaffold** | `src/github/` GithubAdapter service (Decision §2 host 라우팅 + 순수 request-builder + 주입 fetch dispatch + Decision §4 4xx→PermissionDeniedEvent / 도메인 error 매핑 + Decision §5 Link pagination) + mocked-fetch unit (R-112 4 종 + negative cases 충분 cover) | 본 ADR-0016 머지 후 | **없음 — 내장 fetch (dep 0), `pnpm add` 0.** §5 의존성 게이트 미발화 |
| **GitHub Issue 평가 (R-30)** | GitHub Issue 활동 평가 로직 (본인 follow-up 카운트 제외 invariant 등) | GithubAdapter scaffold | 없음 (도메인 로직) |
| **GitHub live-run** | 실 GitHub token (3 host variant) env/secret 주입 후 live smoke/e2e (실값은 [§9](../../CLAUDE.md) 파일 금지) | scaffold 머지 + 사용자 credential | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 패턴 mirror) |
| **p4-plan / modules.md doc-sync** | T-0140 row '@octokit/rest dependency 게이트' 표기를 '내장 fetch, dep 0' 로 정합 (direct doc-only) | 본 ADR 후 | 없음 (direct doc) |
| **PermissionDeniedRecord entity** | 4xx event 영속화 + user/admin audience 분리 (REQ-044/REQ-016) — GitHub/Confluence 공통 | GithubAdapter / ConfluenceAdapter | 없음 (entity, token 은 선행 task 게이트) |
| **ADR-0016 PROPOSED→ACCEPTED** | scaffold 머지 후 status 한 줄 갱신 (direct) | scaffold 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) Node 내장 `fetch` (injectable `FetchLike`) + 순수 builder/parser** (채택) | 외부 dependency 0 (`pnpm add` 0, [CLAUDE.md §5](../../CLAUDE.md) 게이트 회피) / milestone-1 transport 패턴 재사용 (검증된 mirror) / mocked-fetch unit 으로 public CI green / [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher · [ADR-0006](ADR-0006-assessment-data-model.md) raw 미저장 정합 | octokit 의 자동 pagination/retry/typed response 직접 구현 / live 경로 CI 미검증 (후속 task 검증) | **✓ 채택** ([Q-0017](../STATE.json) 제약 직접 충족) |
| (2) `@octokit/rest` SDK | GitHub REST 의 typed client / 자동 pagination / rate-limit plugin / 공식 SDK | **새 외부 dependency ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 + [Q-0017](../STATE.json) '내장 fetch, dep 0' 제약 정면 위반)** / 큰 의존 트리 + 버전 관리 / milestone-1 의 내장 fetch 패턴과 비정합 (LLM 은 fetch, GitHub 만 SDK 면 일관성 ↓) / p4-implementation-plan T-0140 row 의 '@octokit/rest' 표기는 Q-0017 승인으로 **대체됨** | 기각 — 새 dependency, Q-0017 제약 위반 |
| (3) axios / node-fetch | 풍부한 interceptor / 광범위 생태계 / Node 구버전 호환 | **새 외부 dependency ([CLAUDE.md §5](../../CLAUDE.md) 게이트 + Q-0017 제약 위반)** / Node LTS 는 이미 `fetch` 내장이라 node-fetch/axios 는 잉여 / milestone-1 내장 fetch 패턴과 비정합 | 기각 — 새 dependency, 내장 fetch 로 충족 가능 |
| (4) `Authorization: token <token>` (구식 header) | classic PAT 에 동작 / 일부 구 예제와 호환 | GitHub 공식 권장은 **`Bearer`** (fine-grained PAT / GitHub App token 호환) / milestone-1 의 `Authorization: Bearer` 와 형태 비정합 | 기각 (Decision §3 에서 `Bearer` 채택) — 권장 form + 형태 일관 열세 |
| (5) page 번호 직접 증가 pagination | 단순한 loop (page++ 까지) | GitHub 권장은 **`Link` rel=next opaque cursor** (cursor 기반 endpoint 와 호환 / page 번호 race 회피) / page 번호는 일부 endpoint 에서 deprecated | 기각 (Decision §5 에서 Link cursoring 채택) — GitHub 권장 cursor 와 비정합 |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) GitHub REST 의 rate-limit / retry 복잡도가 직접 구현 부담을 크게 키우면 octokit SDK 도입을 사용자 승인 게이트로 재제안하는 supersede ADR. (ii) GraphQL API 기반 수집 (REST 대비 round-trip ↓) 이 필요해지면 transport 계약 확장 ADR. (iii) 3 host 외 추가 GitHub instance 가 늘면 Decision §2 host 도출 규칙을 일반화하는 보강.

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` — P4 milestone-3 승인 + 4 EXACT 제약 (내장 fetch / mocked test / live defer / milestone-1 패턴 재현) — 본 ADR 의 직접 motivation
- [docs/PLAN.md L81](../PLAN.md) — Phase P4 "GitHub 통합 — 3 instance 모두 (github.com / github.sec.samsung.net / github.ecodesamsung.com), 각 instance URL·org·token 설정 분리"
- [docs/requirements.md](../requirements.md) — REQ-005/006/007/008 (GitHub 3 instance 활동 평가) / REQ-044 (instance 권한 분리) / REQ-059 (raw 미저장) source of truth
- [docs/architecture/modules.md](../architecture/modules.md) — GithubModule row (단일 module + instance sub-config, adapter leaf, 4xx catch → PermissionDeniedEvent emit) — 책임 module + 트리거 source
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — milestone-1 `FetchLike` `@Optional` 주입 + dispatch + non-2xx throw 패턴 (Decision §1/§4/§6 mirror reference)
- [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) — 순수 `{url, headers, body}` builder + parse + assertNonEmpty 방어 패턴 (Decision §6 request-builder mirror reference) + `Authorization: Bearer` 형태 정합 (Decision §3)
- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — milestone-1 transport/test 계약 ADR (내장 fetch + mocked test + live defer 패턴의 직접 mirror) + PROPOSED→ACCEPTED 전이 패턴
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) — apiKey/token encryption-at-rest cipher (Decision §6 token JIT decrypt / never-read-back 재사용 source)
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](ADR-0013-confluence-space-traversal-policy.md) — Confluence 측 4xx skip-and-continue + PermissionDeniedEvent emit (Decision §4 GitHub 측 동형 정합, 중복 금지) + ADR template + HITL 경계 단락 mirror
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant (REQ-059) — Decision §5 메타 수집 / raw-transient 정합
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) §4 — 외부 adapter direct egress (GithubModule 외부 HTTPS 호출 정책)
- [docs/decisions/ADR-0001-stack.md](ADR-0001-stack.md) — Node LTS stack (채택안 내장 `fetch` dependency-free baseline)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0016 row)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — 새 ADR = pr-mode
- [CLAUDE.md §5](../../CLAUDE.md) — 새 dependency / 자격증명 BLOCKED 게이트 (본 ADR doc-only + 내장 fetch 라 dependency 게이트 미발화, live-run task 만 credential 게이트)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 값 절대 미기재 (env 이름/header 형태만 박제)

Refs: T-0173, ADR-0006, ADR-0013, ADR-0014, ADR-0015, REQ-005, REQ-006, REQ-007, REQ-008, REQ-044, REQ-059
