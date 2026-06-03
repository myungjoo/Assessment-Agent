---
id: ADR-0018
title: ConfluenceAdapter HTTP transport 계약 — 내장 fetch transport / Cloud vs Server base URL 라우팅 / auth header shape / non-2xx 도메인 매핑 / `_links.next` cursor pagination / adapter↔service 경계
status: ACCEPTED
date: 2026-06-03
relatedTask: T-0183
supersedes: null
---

# ADR-0018 — ConfluenceAdapter HTTP transport 계약 박제

## Context

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` 으로 P4 milestone-3 (GitHub adapter + Confluence adapter) 를 승인하면서 **4 EXACT 제약** 을 verbatim 박제했다 — (1) HTTP transport = Node 내장 `globalThis.fetch` (injectable `FetchLike`), **새 외부 dependency 0** (octokit / confluence-client-typescript / atlassian-connect / axios / node-fetch 추가 금지), (2) test = mocked-fetch unit (실 token 없이 public CI green), (3) 실 token live 통합은 별도 [§5](../../CLAUDE.md) credential 게이트 task 로 deferred, (4) milestone-1 패턴 (내장 fetch + mocked test + live defer) 재현. milestone-3 의 GitHub 측 chain — [ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) (transport 계약) + [ADR-0017](ADR-0017-github-instance-config-source.md) (env 기반 config source) + T-0173~T-0182 의 6 코드/test task — 가 main 박제 완료된 상태에서, Confluence 측은 [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) (SPACE 탐색 정책) 만 ACCEPTED 이고 코드 0 LOC 다.

[ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 은 **탐색 정책** (page List 기반 + SPACE allowlist 순회 + 4xx skip-and-continue) 만 cover 한다 — Confluence REST 호출의 transport 계층 (어떤 client 로 호출하는지 / Cloud vs Server base URL 차이 / auth header form / non-2xx 도메인 매핑 / pagination cursor 형식 / adapter↔service 경계) 은 박제되지 않았다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 4](../../CLAUDE.md) (새 ADR = pr-mode) 정합으로, **ConfluenceAdapter scaffold 코드 task 의 선행 결정 ADR** 을 본 ADR 이 단독 박제한다. GitHub 측 [ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) 6 축 구조를 mirror 하되 Confluence 도메인에 적합하게 reframe 한다.

### 결정 대상 6 축

본 ADR 이 확정하는 transport 계약 축:

- **축 (1) 내장 fetch transport** — HTTP 호출을 어느 client 로 수행하는지. Confluence SDK (`confluence-client-typescript` / atlassian-connect) vs axios/node-fetch vs Node 내장 `fetch` 중 택일.
- **축 (2) base URL 라우팅** — Confluence Cloud (`https://<workspace>.atlassian.net/wiki/rest/api`) vs Confluence Server/Data Center (`https://<host>/rest/api`) 의 base path 비대칭을 instance config 로부터 어떻게 도출하는지.
- **축 (3) auth header + 필수 header shape** — token 을 어느 `Authorization` 형태로 싣는지 (Cloud Basic API token vs Server Bearer PAT) + `Accept` header.
- **축 (4) non-2xx → 도메인 error 매핑** — 4xx / 429 / 5xx / network reject 를 어떤 도메인 error 위상으로 매핑하는지 + 4xx → PermissionDeniedEvent emit 경계.
- **축 (5) REST pagination** — Confluence REST 의 `_links.next` (body 내 cursor) 형식 + `start`/`limit` 정합.
- **축 (6) adapter↔service 경계** — `src/confluence/` module 안에서 순수 request-builder / 주입 fetch dispatch / multi-page orchestration / SPACE allowlist 순회 service 의 4 단 경계 + token 복호화 ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher) 의 just-in-time 위상.

### REQ 외력 (본 ADR 이 cover)

- **REQ-009 / REQ-010 / REQ-015** ([docs/requirements.md](../requirements.md), README L31–33) — 지정된 Confluence Service 내 지정된 SPACE 들 내 문서 작성 / 업데이트 활동 평가 backbone. 본 ADR 의 축 (1)~(5) 가 그 "지정 Service / 다중 SPACE 의 page 수집" 의 transport 계층 (Cloud/Server 라우팅 / auth / error / pagination) 을 박제한다.
- **REQ-016 / REQ-044** ([README.md](../../README.md) L19–22, L33) — 접근 권한 (read) 부족 시 AA 사용자·관리자 인식·대응. 본 ADR 의 축 (4) 4xx → PermissionDeniedEvent emit 위상이 권한 부족 가시화의 transport 측 경계를 박제 ([modules.md](../architecture/modules.md) ConfluenceModule "4xx catch → PermissionDeniedEvent emit" 책임과 직결).
- **REQ-034 ([README.md](../../README.md) L34) = R-34** — Confluence SPACE crawling vs hierarchy 탐색 정책. [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 가 page List 기반을 선택했다. 본 ADR 의 축 (5) pagination cursor 가 그 List API 의 paging contract 의 transport-level 구체화.
- **REQ-059 / [ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant. 본 ADR 의 축 (5) pagination 수집 단위 (page 메타 + version) 가 이 invariant 위에서 성립 — page body raw 는 transient.

### 선행 박제 정합 (milestone-1/GitHub transport 패턴 / adapter leaf)

본 ADR 이 mirror 하는 milestone-1 / milestone-3 GitHub transport 패턴 (직접 reference 구현):

- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — `FetchLike` 함수 타입을 `@Optional()` 생성자 주입 (default `globalThis.fetch`) → unit 은 주입 mock 으로 검증, 실 네트워크 0. provider 분기 dispatch → 주입 fetch 호출 → `!response.ok` 시 status 포함 throw → 응답 파싱 dispatch.
- [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) — 순수 함수 `{url, headers, body}` builder (`assertNonEmpty` 방어) + response parse (비정상 응답 throw), 부수효과 0 / 외부 의존 0 / apiKey 평문 인자만 (decrypt 는 호출처 책임).
- [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) — milestone-3 GitHub 측 순수 request-builder (host / token / path / query → `{url, headers}` 조립, `parseNextLink` RFC-5988 등). **본 ConfluenceAdapter request-builder 가 mirror 할 직접 reference.**
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — milestone-3 GitHub 측 service dispatch (주입 fetch + non-2xx 매핑 + Link 순회 `requestAllPages` + `fetchAndMap` 경계). **본 ConfluenceAdapter service dispatch 가 mirror 할 직접 reference.**
- **adapter leaf** — [modules.md](../architecture/modules.md) 상 ConfluenceModule 은 다른 internal module 을 import 하지 않는 **adapter leaf** 로 외부 Confluence HTTPS 만 호출 ([ADR-0003 §4](ADR-0003-deployment.md) 외부 adapter direct egress). 본 ADR 의 transport 계약은 이 leaf 경계 안 (HTTP 호출 + 결과 변환) 에서만 동작.

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0018** — `docs/decisions/` 에 ADR-0001 ~ ADR-0017 점유 (ADR-0007 은 미신설 — [ADR-0013 §ADR cross-reference](ADR-0013-confluence-space-traversal-policy.md) / [ADR-0014 §ADR cross-reference](ADR-0014-llm-api-key-encryption-at-rest.md) / [ADR-0016 §ADR cross-reference](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0017 §ADR cross-reference](ADR-0017-github-instance-config-source.md) 박제). 본 ADR 은 다음 free 번호 ADR-0018 을 사용 (T-0183 acceptance 의 번호 정합 명시).
- **[ADR-0013](ADR-0013-confluence-space-traversal-policy.md)** — Confluence SPACE 탐색 정책 (page List 기반 + SPACE allowlist 순회 + 4xx skip-and-continue). 본 ADR 은 그 위에 **transport 계층** 만 얹는다 — 탐색 메커니즘 / 수집 경계 / 4xx 제어의 결정 자체를 재결정하지 않는다. 축 (4) skip-and-continue 위상은 [ADR-0013 §3](ADR-0013-confluence-space-traversal-policy.md) 와 정합 (탐색-제어 책임은 service, transport adapter 는 throw).
- **[ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md)** — Confluence token 도 본 cipher 접근 (AES-256-GCM envelope) 을 재사용 — config 의 token 은 `LlmApiKeyCipher` + `LLM_APIKEY_ENC_KEY` env 로 encrypted-at-rest, adapter 의 HTTP 호출 직전 just-in-time decrypt, never-read-back ([ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md)). 축 (6) 이 이 위상을 박제. **본 ADR 은 token 전용 신규 env 키를 도입하지 않는다** (cipher 접근 위상만 박제).
- **[ADR-0016](ADR-0016-github-adapter-http-transport-contract.md)** — GitHub adapter HTTP transport 계약. 본 ADR 의 6 축 구조 (내장 fetch / base URL 라우팅 / auth header / non-2xx 매핑 / pagination / adapter↔gateway 경계) 를 동형 차용하되 Confluence 도메인 (Cloud/Server 비대칭 / Basic vs Bearer auth / `_links.next` body cursor) 으로 reframe 한다.
- **[ADR-0017](ADR-0017-github-instance-config-source.md)** — env 기반 instance-keyed config (`GITHUB_INSTANCES` + per-key `_HOST`/`_ORG`/`_TOKEN_ENC`) 패턴. 본 ADR 의 축 (2) 에서 Confluence 도 동형 (`CONFLUENCE_INSTANCES` enumerable key + per-key 변수) 으로 차용 vs 단일 풀 URL 박제 중 택일을 결정한다.

## Decision

본 ADR 은 다음 6 결정을 박제한다. **본 ADR 은 transport 계약 (transport client / base URL 라우팅 / header shape / error 매핑 / pagination / 경계) 을 기술하되 production code 0 LOC — 실 `ConfluenceAdapter` 코드는 후속 task.**

### Decision §1 — transport client: Node 내장 `globalThis.fetch` (injectable `ConfluenceFetchLike`, 새 dep 0)

- **내장 fetch 채택** — ConfluenceAdapter 의 HTTP transport 는 Node 내장 `globalThis.fetch` 를 사용한다. **새 외부 dependency 0** — `confluence-client-typescript` / atlassian-connect SDK / `axios` / `node-fetch` 어느 것도 추가하지 않는다 ([Q-0017](../STATE.json) 제약, [CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). `fetch` 는 Node LTS 표준 내장 ([ADR-0001](ADR-0001-stack.md)) 이라 `pnpm add` 불요. p4-implementation-plan §2 T-0142 row 의 "Confluence client dependency (SDK / fetch 택일) + token credential = §5 BLOCKED 게이트" 표기 중 **dependency 게이트는 본 결정으로 supersede** 된다 — 내장 fetch 채택으로 §5 의존성 게이트 미발화. (token credential 게이트만 live-run task 로 잔류, 후속 chain row 3.)
- **injectable `ConfluenceFetchLike`** — milestone-1 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) / milestone-3 [github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 `FetchLike` 함수 타입 `@Optional()` 생성자 주입 (default `globalThis.fetch`) 패턴을 mirror 한다. ConfluenceAdapter 도 fetch 를 직접 호출하지 않고 주입 함수로 받아 — unit 은 주입한 fetch mock 으로 검증 (실 네트워크 호출 0, 실 token 0). Confluence REST 의 pagination cursor 는 응답 body (`_links.next`) 에 실리므로 (Decision §5) `ConfluenceFetchLike` 의 response surface 는 milestone-3 GitHub 의 `headers` 접근까지 요구하지 않고 GitHub 보다 단순 — 기본 `{ ok, status, statusText, headers, json }` 만으로 충분. 구체 타입 form 은 ConfluenceAdapter 코드 task 책임, 본 ADR 은 "주입 fetch 함수로 호출" 계약만 박제.

### Decision §2 — base URL 라우팅: Cloud vs Server 비대칭 + instance config 형태

- **base URL 비대칭 박제** — Confluence 는 배포 형태에 따라 REST API base path 가 분기한다:
  - **Confluence Cloud** → base `https://<workspace>.atlassian.net/wiki/rest/api` ("/wiki" prefix 가 Cloud 의 표준).
  - **Confluence Server / Data Center** → base `https://<host>/rest/api` (Server/DC 는 host 직속 `/rest/api`, `/wiki` prefix 없음).
- **instance config 표현: 풀 base URL 직접 박제 (host+variant 분해 미채택)** — instance 별 config 는 **풀 base URL 문자열 1 개** (예: `https://acme.atlassian.net/wiki/rest/api` 또는 `https://confluence.internal.example/rest/api`) 를 그대로 박제한다. host + variant flag (Cloud/Server boolean) 로 분해해 adapter 가 base path 를 조립하는 대안은 미채택 (Alternatives §3). **단순 풀 URL** 이 (i) 비표준 reverse proxy / sub-path 배포 (예: `https://corp.example/confluence/rest/api`) 를 자연 지원, (ii) Cloud/Server 분기 로직을 config 단계 (사람이 한 번 작성) 로 이전해 adapter 코드의 if-분기 제거, (iii) `/rest/api` vs `/wiki/rest/api` 의 path 차이를 host 매칭이 아니라 풀 URL 로 표현하여 운영자 의도가 config 에 명시되는 장점이 있다.
- **adapter request URL 조립** — adapter 는 base URL + relative path (예: `/content?spaceKey=X&limit=100`) 를 단순 concat (또는 `URL` constructor) 으로 조립한다. base URL 의 trailing slash 정규화 (붙어있어도 없어도 동일 결과) 는 request-builder 의 책임 — 본 ADR 은 "풀 base URL + relative path concat" contract 만 박제.
- **enumerable instance-keyed config: ADR-0017 패턴 차용** — Confluence 도 다중 instance / 다중 SPACE 운영을 지원해야 한다 ([ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) SPACE allowlist 순회). [ADR-0017](ADR-0017-github-instance-config-source.md) 의 enumerable key list + per-key 접두 변수 패턴을 **동형 차용** — 단, 본 ADR 은 env 변수 **shape 만** 박제하고 실 wiring 코드는 후속 task. shape 박제 (실값 0, [CLAUDE.md §9](../../CLAUDE.md)):

  | env 변수 | 역할 | 예시 shape (실값 0) |
  | --- | --- | --- |
  | **`CONFLUENCE_INSTANCES`** | 활성 instance key 의 comma-separated 목록 (enumeration source). env 에 정의된 key 만 활성 — 자동 발견 안 함 ([ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) allowlist 정합). | `CONFLUENCE_INSTANCES=cloud,internal` |
  | **`CONFLUENCE_<KEY>_BASE_URL`** | 해당 instance 의 풀 REST API base URL (Cloud `/wiki/rest/api` 또는 Server `/rest/api` 형태가 풀 URL 에 직접 포함). | `CONFLUENCE_CLOUD_BASE_URL` / `CONFLUENCE_INTERNAL_BASE_URL` |
  | **`CONFLUENCE_<KEY>_AUTH_USER`** | Cloud Basic 인증의 email/계정명. Server Bearer 인증은 미사용 (빈 값 / 미정의 가능). Decision §3 의 auth scheme 분기 입력. | `CONFLUENCE_CLOUD_AUTH_USER` |
  | **`CONFLUENCE_<KEY>_TOKEN_ENC`** | 해당 instance 의 **encrypted-at-rest token** ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) AES-256-GCM envelope base64). Cloud 는 API token, Server 는 PAT. `_ENC` suffix 가 "암호화된 형태" 임을 이름으로 명시. | `CONFLUENCE_CLOUD_TOKEN_ENC` |
  | **`CONFLUENCE_<KEY>_SPACE_ALLOWLIST`** | 해당 instance 에서 평가 대상 SPACE key 의 comma-separated 목록 ([ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) "지정 allowlist 만 순회" 의 설정 source). | `CONFLUENCE_CLOUD_SPACE_ALLOWLIST=DEV,DOCS` |

  단일 JSON env (`CONFLUENCE_INSTANCES_JSON`) 대비 enumerable 분리 채택 근거는 [ADR-0017 §2](ADR-0017-github-instance-config-source.md) 와 동일 — token 단위 rotation / systemd `EnvironmentFile=` 친화 / secret 격리 (`_TOKEN_ENC` 만 마스킹) 가 우월. **실 env→config parser 코드는 본 ADR scope 외** (후속 wiring task, [ADR-0017](ADR-0017-github-instance-config-source.md) 의 순수 함수 patten mirror).

### Decision §3 — auth header shape: Cloud Basic vs Server Bearer 분기 + Accept header

- **Cloud = `Authorization: Basic base64(email:api_token)`** — Atlassian Confluence Cloud REST API 의 권장 auth 는 Basic 인증으로, username 자리에 사용자 email, password 자리에 API token (Atlassian account 에서 발급) 을 넣고 base64 인코딩한 `Basic` header 를 싣는다. adapter 는 instance config 의 `AUTH_USER` (email) + decrypted token 으로 base64 를 조립 — 두 값을 평문으로 메모리에 잠시 보유 후 즉시 폐기 (never-read-back, Decision §6 JIT 위상).
- **Server / Data Center = `Authorization: Bearer <pat>`** — Confluence Server 7.9+ / Data Center 는 Personal Access Token (PAT) 을 발급해 `Authorization: Bearer <pat>` 형태로 인증한다 (Basic + username/password 도 가능하나 PAT 가 권장). adapter 는 instance config 의 decrypted token (PAT) 을 그대로 Bearer header 에 싣는다 — `AUTH_USER` 는 사용하지 않음 (env 에 정의돼 있어도 무시).
- **scheme 분기 입력 = `AUTH_USER` 존재 여부** — adapter 는 instance config 의 `CONFLUENCE_<KEY>_AUTH_USER` 가 **non-empty 면 Cloud Basic**, **empty / undefined 면 Server Bearer** 로 분기한다. 별도 `_AUTH_SCHEME` 변수 신설보다 운영자가 "email 을 줬는가" 의 자연 input 으로 분기되는 것이 의도와 일치하고 env shape 도 단순화. 분기 로직은 request-builder (Decision §6 순수 함수) 의 책임 — adapter service 가 if-분기 없이 builder 결과의 `headers` 를 그대로 사용.
- **필수 header** — 모든 REST 호출에 `Accept: application/json` 을 명시 (Confluence REST 의 default media type 이 일부 endpoint 에서 XML 로 fall back 하는 것을 방지). User-Agent / Content-Type 등 부가 header 의 구체는 ConfluenceAdapter 코드 task 책임.
- **token 실값 0 기재** ([CLAUDE.md §9](../../CLAUDE.md)) — 본 ADR 은 어떤 Confluence token / API token / PAT 실값도 기재하지 않는다. token 은 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 encrypted-at-rest 후 호출 직전 decrypt (Decision §6), 또는 후속 live-run task 의 env 주입 (값 0). header 에 실리는 평문 token / Basic base64 결과는 로그 / 직렬화 / 에러 메시지에 노출하지 않는다.

### Decision §4 — non-2xx → 도메인 error 매핑 + 4xx PermissionDeniedEvent 경계

- **도메인 error 매핑 박제** — adapter 는 fetch response 의 status 를 다음 도메인 error 위상으로 매핑한다 (milestone-3 [github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 non-2xx → status 포함 throw + 도메인 error subclass 패턴을 **Confluence 도메인에 맞게 분기 확장**):

  | status | 도메인 분류 | error 명 (잠정) | 위상 |
  | --- | --- | --- | --- |
  | **401 / 403** | `permission-denied` | `ConfluencePermissionDeniedError` | token 무효 / 권한 부족 / SPACE read 비가시. 4xx catch → **PermissionDeniedEvent emit** ([modules.md](../architecture/modules.md) ConfluenceModule "4xx catch → PermissionDeniedEvent emit" 책임). |
  | **404** | `not-found` | `ConfluenceNotFoundError` | 대상 SPACE / page / version 부재 또는 권한상 비가시. 권한 비가시 404 도 emit 후보 (Confluence 도 권한 부족을 404 로 표현하기도 함). |
  | **429** | `rate-limited` | `ConfluenceRateLimitedError` | rate limit (`Retry-After` header 보존). backoff 위상 박제 (구체 backoff 구현은 코드 task). |
  | **5xx / network reject** | `transient` | `ConfluenceTransientError` | upstream 장애 / DNS / TLS / connection reset. fetch reject (status 부재) 도 같은 분류. |
  | **JSON parse 실패 / 비정형 응답** | `domain-error` (fallback) | `ConfluenceDomainError` (base) | response.ok 인데 body 파싱 실패 / 필수 필드 누락. 위 분류의 base class 로 모든 ConfluenceXxxError 의 공통 superclass. |

- **PermissionDeniedEvent emit 위상** — 401 / 403 (및 권한 비가시 404) catch 시 adapter 는 **PermissionDeniedEvent 를 emit** 한다 (REQ-016 / REQ-044 권한 가시화). emit 자체 책임은 [modules.md](../architecture/modules.md) ConfluenceModule row 와 직결. **PermissionDeniedRecord entity 의 실 schema 는 본 ADR scope 외** ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) 와 동일 후속 entity task, GitHub/Confluence 공통).
- **abort vs skip-and-continue 위상 — SPACE 단위 (ADR-0013 §3 정합)** — 권한 부족 (4xx) 시 탐색-제어는 **SPACE 단위 skip-and-continue** 다 — 한 SPACE 의 권한 누락이 전체 Confluence 수집을 abort 시키지 않고, 권한 있는 나머지 SPACE 의 수집을 계속한다 ([ADR-0013 §3](ADR-0013-confluence-space-traversal-policy.md) verbatim). **adapter 의 책임 분리**: adapter (transport layer) 는 4xx 를 `ConfluencePermissionDeniedError` 로 **throw** 한다. SPACE 단위 skip-and-continue 의 control flow 는 **service layer** (`ConfluenceSpaceTraversalService`, Decision §6) 가 SPACE 순회 loop 안에서 try/catch 로 흡수 + 다음 SPACE 계속 진행 + event emit 책임을 진다. 5xx / transient 도 일시 장애일 수 있어 retry/backoff 후 실패 시 그 SPACE 만 skip — 전면 abort 아님. (GitHub 측 [ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) instance/repo 단위 skip-and-continue 와 **동형이되 대상 단위는 SPACE**.)

### Decision §5 — REST pagination: `_links.next` body cursor (`start` / `limit` 보강)

- **`_links.next` body cursor 채택** — Confluence REST 의 `/wiki/rest/api/content` 류 list endpoint 는 응답 body 의 `_links.next` (relative URL 또는 절대 URL) 에 다음 page 의 cursor 를 제공한다. GitHub 의 RFC-5988 `Link` header 와 달리 **응답 body 안** 에 cursor 가 있어 transport 처리 위상이 다르다. adapter 는 **`_links.next` 가 존재하는 한 끝까지 순회** (필드 부재 시 종료) 한다. cursor 의 형식 (relative path vs 절대 URL) 은 endpoint 와 Confluence 버전에 따라 다를 수 있으므로, request-builder (Decision §6) 의 `parseNextCursor` 가 다음 절대 URL 을 base URL 과 정합 조립한다.
- **`start` / `limit` query param** — 초기 호출 시 `start=0&limit=<MAX>` 를 명시한다. `_links.next` 는 이후 page 의 `start` 를 cursor 로 박제 — adapter 는 이 값을 직접 증가시키지 않고 Confluence 가 준 next URL 을 그대로 따른다 (cursor-opaque, GitHub Link rel=next 와 동형 정책).
- **per-page 최대화** — round-trip 횟수를 줄이기 위해 `limit` 을 Confluence 허용 최대값 (endpoint 별 상이 — 통상 `100` ~ `250`) 으로 설정한다. 구체 값은 ConfluenceAdapter 코드 task 가 endpoint 별 상수 또는 단일 default 로 결정. 본 ADR 은 "`limit` 최대화" contract 만 박제.
- **safety cap: `CONFLUENCE_MAX_PAGES`** — 무한 cursor loop / 비정상 large SPACE 방어를 위해 page 순회 최대 횟수 cap 을 도입한다 (default `100`). cap 도달 시 partial 결과를 반환하면서 경고 log + **PermissionDeniedEvent 와 구분되는 별도 partial-collection event** 를 emit 한다 (구체 event 형식은 후속 task). cap 도달 자체는 error 가 아니다 (부분 가용성 유지).
- **raw 미저장 invariant 정합** — 수집 단위는 page 의 **메타** (id / spaceKey / title / version.number / version.by / version.when 등) 이며, page body raw 는 평가 파이프라인 입력으로만 transient 사용하고 영속화하지 않는다 ([ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 raw 미저장 invariant, [ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) (page, version) raw-transient 경계 정합). `_links.next` cursoring 은 page 단위 메타 enumerate 이므로 이 invariant 와 정합 — body 본문 파싱 불요.

### Decision §6 — adapter↔service 경계: `src/confluence/` module, 4 단 경계 + JIT decrypt

- **module 위치** — ConfluenceAdapter 는 **`src/confluence/` module** (ConfluenceModule, adapter leaf) 안에 위치한다 ([modules.md](../architecture/modules.md) ConfluenceModule row). 다른 internal module 을 import 하지 않고 외부 Confluence HTTPS 만 호출.
- **4 단 경계 박제 (milestone-1/3 패턴 mirror + ADR-0013 service 위상)** — milestone-1 / milestone-3 GitHub 의 (순수 request-builder) / (service orchestration + 주입 fetch dispatch) 분리에 [ADR-0013 §3](ADR-0013-confluence-space-traversal-policy.md) SPACE 순회 service 책임을 더해 **4 단 경계** 로 박제:
  1. **`buildConfluenceRequest` (순수 함수, unit-testable, 부수효과 0)** — instance config (base URL + auth scheme 분기 입력 + token 평문) + endpoint relative path / query 를 받아 `{url, headers}` 를 조립. Decision §2 (base URL concat) + Decision §3 (Cloud Basic vs Server Bearer 분기) 박제 위치. [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) 의 `assertNonEmpty` 방어 + [github-request.builder.ts](../../src/github/github-request.builder.ts) 의 url concat 패턴 mirror. token 은 평문 인자로만 받음 (decrypt 는 호출처).
  2. **`ConfluenceAdapter.request` (NestJS `@Injectable` service, 단일 page 호출)** — 주입 fetch dispatch (Decision §1) + non-2xx → 도메인 error 매핑 throw (Decision §4) + JSON parse. 단일 page 의 response 만 반환 (cursor 처리는 §3 책임).
  3. **`ConfluenceAdapter.requestAllPages` (multi-page orchestration)** — Decision §5 의 `_links.next` cursor 순회 loop. `request` 를 반복 호출하면서 cursor 가 없거나 cap 도달 시 종료. 4xx 가 throw 되면 SPACE traversal service 가 catch (이 함수 자체는 throw 그대로 전파).
  4. **`ConfluenceSpaceTraversalService` (SPACE allowlist 순회 + skip-and-continue)** — [ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) SPACE allowlist 순회의 control flow + Decision §4 의 4xx catch → PermissionDeniedEvent emit + 다음 SPACE 계속 진행 책임을 진다. `requestAllPages` 를 SPACE 단위로 호출하면서 try/catch 로 권한 부족을 흡수.
- **token JIT decrypt 위상 ([ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용)** — instance config 의 token (Cloud API token / Server PAT) 은 [ADR-0014 §1](ADR-0014-llm-api-key-encryption-at-rest.md) AES-256-GCM envelope (`LlmApiKeyCipher` + `LLM_APIKEY_ENC_KEY` env 재사용) 으로 encrypted-at-rest 저장된다. adapter 는 **HTTP 호출 직전 (Authorization header 에 실으려는 순간) 에만** cipher 로 decrypt 하고, 복호화 결과는 응답 / 로그 / 직렬화 어디에도 노출하지 않는다 (in-memory transient, [ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md) never-read-back). cipher 의 master key 는 milestone-1 / GitHub 와 동일 `LLM_APIKEY_ENC_KEY` 재사용 — token 전용 신규 env (예: `CONFLUENCE_TOKEN_ENC_KEY`) 도입 여부는 본 ADR 미결정 (운영상 모든 adapter token 을 동일 KMS-친화 cipher 로 통합 관리하는 것이 단순 — 미래 KMS 전환 ADR 에서 일괄 재검토). **본 ADR 은 새 env key 를 도입하지 않는다** — cipher 접근 위상만 박제.

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — ConfluenceAdapter transport 계약의 **결정** 만 박제한다. `pnpm add` 0 / 외부 호출 0 / secret 0 / schema migration 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row).
- **ConfluenceAdapter 실 코드는 §5 의존성 게이트 미발화** — [Q-0017](../STATE.json) 제약상 transport = **내장 fetch (dep 0)** + [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용 (신규 secret 메커니즘 0) 이므로, ConfluenceAdapter scaffold 코드 task 는 [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency / schema migration" BLOCKED 게이트를 **발화하지 않고** dependency-free 로 진입 가능하다. milestone-3 GitHub chain (T-0173~T-0182) 이 dependency-free 로 완주된 패턴과 동형.
- **실 Confluence token live 통합만 §5 credential 게이트로 deferred** — 실 Cloud API token + Server PAT 의 env/secret 주입 + 실 네트워크 live smoke 는 후속 live-run task 의 [CLAUDE.md §5](../../CLAUDE.md) 외부 자격증명 게이트 대상이다 (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) / GitHub live-run / Q-0016 optionA task 2 패턴 mirror). 본 ADR 은 env 변수 **이름/shape** 만 박제 가능하며 실값 0 ([CLAUDE.md §9](../../CLAUDE.md)).
- **PermissionDeniedRecord entity 는 schema migration §5 게이트** — Decision §4 의 emit 자체는 본 ADR + adapter scaffold 로 완결되나, 영속 record entity 의 Prisma model + migration 은 [CLAUDE.md §5](../../CLAUDE.md) "DB schema 변경" 게이트로 별도 task ([ADR-0013](ADR-0013-confluence-space-traversal-policy.md) Consequences 후속 chain 과 공통).

## Consequences

### 양의 (positive)

1. **dependency-free 즉시 착수** — Decision §1 의 Node 내장 `fetch` 채택 → 후속 ConfluenceAdapter scaffold 가 `pnpm add` 0 으로 진입 ([CLAUDE.md §5](../../CLAUDE.md) 새 dependency BLOCKED 게이트 회피). Confluence SDK (`confluence-client-typescript` 큰 의존 트리 + 버전 관리) 대비 도입 마찰 최소. p4-implementation-plan §2 T-0142 row 의 dependency 게이트 표기가 본 결정으로 supersede.
2. **milestone-1/3 패턴 재사용** — Decision §1/§6 이 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) / [github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 `FetchLike` 주입 + 순수 builder/parser 분리를 mirror → architect/implementer 의 transport 환각 ↓, 일관된 아키텍처. mocked-fetch unit 으로 transport 분기 전체 cover 가능 (public CI green).
3. **Cloud/Server 비대칭 단순 해소** — Decision §2 의 풀 base URL 직접 박제가 Cloud (`/wiki/rest/api`) vs Server (`/rest/api`) 비대칭을 config 단계 (사람이 한 번 작성) 로 이전 → adapter 코드의 if-분기 제거. 비표준 reverse proxy / sub-path 배포도 자연 지원. ADR-0017 enumerable key 패턴 차용으로 GitHub/Confluence config source 일관.
4. **Cloud/Server auth 자연 분기** — Decision §3 의 `AUTH_USER` 존재 여부로 Basic/Bearer 분기 → 별도 `_AUTH_SCHEME` 변수 신설 불요. 운영자 의도 (email 줬는가) 의 자연 input 으로 분기.
5. **권한 가시성 + 부분 가용성 (ADR-0013 정합)** — Decision §4 의 4xx → PermissionDeniedEvent emit + SPACE 단위 skip-and-continue 로 한 SPACE 권한 누락이 전체 수집을 막지 않음 (REQ-016/044 권한 가시화 + robustness). [ADR-0013 §3](ADR-0013-confluence-space-traversal-policy.md) 와 정합한 동형 정책이라 Confluence 결정 일관 — adapter (throw) / service (catch + continue) 의 책임 분리도 명시.
6. **secret-at-rest 정합** — Decision §6 의 token JIT decrypt + never-read-back 이 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 접근을 재사용 → token 유출 surface ↓, 새 secret 메커니즘 도입 0. milestone-1 / GitHub adapter 와 동일 cipher 라 운영자 학습 비용 0.
7. **raw 미저장 invariant 정합** — Decision §5 의 `_links.next` cursoring 이 메타 단위 enumerate (page body transient) 라 [ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 / [ADR-0013 §2](ADR-0013-confluence-space-traversal-policy.md) invariant 와 구조적 정합.
8. **safety cap 로 무한 cursor 방어** — Decision §5 의 `CONFLUENCE_MAX_PAGES` cap 이 비정상 large SPACE / 무한 cursor loop 를 partial-collection event 로 흡수 → robustness ↑.

### 음의 (negative) / trade-off

1. **SDK 편의 기능 미사용** — Decision §1 상 Confluence SDK 의 typed response / 자동 pagination / rate-limit retry 를 직접 구현해야 한다 (Decision §4 backoff + §5 cursor 순회를 adapter 코드가 박제). mitigation: milestone-1 / milestone-3 GitHub 이 이미 내장 fetch 로 transport 를 구현해 패턴이 검증됨 — Confluence 도 동형 + 순수 함수 unit cover.
2. **live 경로 CI 미검증** — mocked-fetch unit 만으로는 실 Confluence 계약 (Cloud/Server 실 응답 / 실 `_links.next` 형식 / 실 rate-limit) 을 CI 에서 검증하지 못한다 (skip). mitigation: 순수 builder/parser 는 unit full cover + 후속 §5 live-run task 가 실 token 으로 1 회 검증 ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) live 패턴 mirror).
3. **Cloud vs Server REST 버전 변동 risk** — Decision §2 의 풀 base URL 박제는 endpoint path 의 Cloud/Server 차이까지는 흡수하나, 일부 endpoint 가 Cloud 와 Server 에서 response shape 가 다를 수 있다 (Atlassian REST v1 vs v2 분기 등). mitigation: adapter 가 response shape 차이를 도메인 error 로 매핑 + endpoint 별 호출 layer 가 Cloud/Server 차이 흡수 — 본 ADR 은 transport 만, endpoint shape 차이는 후속 코드.
4. **`_links.next` 비표준 cursor risk** — endpoint 와 Confluence 버전에 따라 `_links.next` 가 relative path 인지 절대 URL 인지 다를 수 있고, 일부 endpoint 는 `_links.next` 대신 `start`+`size` 비교로 다음 page 존재를 추론해야 할 수 있다. mitigation: `parseNextCursor` 가 두 형식을 모두 흡수 (relative → base URL 과 정합 절대 조립, 절대 → 그대로 사용) + size 기반 fallback 은 endpoint 별 보강 (본 ADR 은 cursor 우선 contract 만 박제).
5. **scheme 분기 input 의 implicit 의존** — Decision §3 의 `AUTH_USER` 존재 여부로 Basic/Bearer 분기는 `AUTH_USER` 의 의미를 "Cloud 표식" 으로 묶는다. Server 에서 운영자가 실수로 `AUTH_USER` 를 정의하면 Bearer 가 Basic 으로 잘못 분기됨. mitigation: env parser (Decision §6 가 후속 task 로 책임) 가 `AUTH_USER` non-empty + `_TOKEN_ENC` 둘 다 있으면 Cloud, 둘 다 있고 Server 의도라면 운영자가 `AUTH_USER` 를 명시적으로 비워야 함 — README / runbook 명시 책임 (후속 doc-sync task).

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합. 본 chain 은 milestone-3 GitHub 측 chain (T-0173 → T-0174 → T-0175 → T-0176 → T-0177 → T-0178 → T-0179 → T-0180 → T-0182) 의 직접 mirror:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **ConfluenceModule wiring + env config parser** | `src/confluence/{confluence.module.ts, confluence-instance-config.ts}` — Decision §2 enumerable key + per-key 변수 + 순수 함수 env parser ([ADR-0017](ADR-0017-github-instance-config-source.md) `resolveGithubInstances` mirror) + module wiring | 본 ADR-0018 머지 후 | **없음 — 내장 fetch (dep 0), env 만, `pnpm add` 0.** |
| **Confluence token JIT decrypt helper** | `src/confluence/confluence-token-decrypt.ts` — [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용 (GitHub `github-token-decrypt.ts` mirror) | wiring 후 | 없음 |
| **ConfluenceAdapter request-builder + service dispatch + non-2xx 매핑** | Decision §3/§4 — `buildConfluenceRequest` 순수 함수 (Cloud Basic / Server Bearer 분기) + `ConfluenceAdapter.request` + 도메인 error 매핑 throw + mocked-fetch unit (R-112 4 종 + negative cases 충분 cover) | wiring + decrypt 후 | 없음 |
| **`_links.next` cursor pagination** | Decision §5 — `parseNextCursor` (relative/absolute 분기) + `ConfluenceAdapter.requestAllPages` + `CONFLUENCE_MAX_PAGES` cap + mocked unit | service dispatch 후 | 없음 |
| **`ConfluenceSpaceTraversalService` (SPACE allowlist 순회 + skip-and-continue)** | Decision §6 §4 — [ADR-0013 §2/§3](ADR-0013-confluence-space-traversal-policy.md) SPACE 순회 + 4xx catch → PermissionDeniedEvent emit + 다음 SPACE 계속 | pagination 후 | 없음 |
| **round-trip stub smoke** | 내장 `http.createServer` Confluence stub 으로 실 globalThis.fetch round-trip 검증 (T-0168 / T-0182 mirror) | service 완결 후 | 없음 |
| **modules.md / p4-implementation-plan doc-sync** | ConfluenceModule row 4 단 경계 박제 + T-0142/T-0143 row 의 "Confluence client dependency 게이트" 표기를 본 ADR 결정 (dep 0) 로 정합 (direct doc-only) | 본 ADR 후 또는 chain 완결 후 | 없음 (direct doc) |
| **PermissionDeniedRecord entity** | 4xx event 영속화 + user/admin audience 분리 (REQ-016/044) — GitHub/Confluence 공통 | ConfluenceAdapter / GithubAdapter | **있음 — DB schema migration §5 게이트** |
| **Confluence live-run** | 실 Confluence token (Cloud API token / Server PAT) env/secret 주입 후 live smoke/e2e (실값은 [§9](../../CLAUDE.md) 파일 금지) | scaffold 머지 + 사용자 credential | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 패턴 mirror) |
| **ADR-0018 PROPOSED→ACCEPTED** | scaffold chain 머지 후 status 한 줄 갱신 (direct) | scaffold chain 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) Node 내장 `fetch` (injectable `ConfluenceFetchLike`) + 순수 builder/parser + 4 단 경계** (채택) | 외부 dependency 0 (`pnpm add` 0, [CLAUDE.md §5](../../CLAUDE.md) 게이트 회피) / milestone-1·3 transport 패턴 재사용 (검증된 mirror) / mocked-fetch unit 으로 public CI green / [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용 / [ADR-0013](ADR-0013-confluence-space-traversal-policy.md) / [ADR-0006](ADR-0006-assessment-data-model.md) raw 미저장 정합 / Cloud/Server 풀 URL 박제로 if-분기 제거 | SDK 자동 pagination/retry/typed response 직접 구현 / live 경로 CI 미검증 (후속 task 검증) / `_links.next` 비표준 cursor 흡수 책임 builder | **✓ 채택** ([Q-0017](../STATE.json) 제약 직접 충족) |
| (2) `confluence-client-typescript` SDK / atlassian-connect SDK | Confluence REST 의 typed client / 자동 pagination / 공식 또는 활성 community SDK | **새 외부 dependency ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 + [Q-0017](../STATE.json) '내장 fetch, dep 0' 제약 정면 위반)** / 큰 의존 트리 + 버전 관리 / milestone-1·3 의 내장 fetch 패턴과 비정합 (LLM/GitHub 은 fetch, Confluence 만 SDK 면 일관성 ↓) / p4-implementation-plan T-0142 row 의 'SDK / fetch 택일' 표기는 Q-0017 승인으로 **대체됨** | 기각 — 새 dependency, Q-0017 제약 위반 |
| (3) host + variant flag (Cloud/Server boolean) 분해 + adapter 가 base path 조립 | host 정보를 운영자가 두 변수 (host + variant) 로 분리해서 표현 / Cloud/Server 명시 | 비표준 reverse proxy / sub-path 배포 (`/confluence/rest/api`) 지원 불가 / adapter 코드에 if (variant === Cloud) `${host}/wiki/rest/api` else `${host}/rest/api` 분기 발생 → 풀 URL 박제 (사람이 한 번 작성) 대비 코드 복잡도 ↑ | 기각 — 운영 일반화 열세 (Decision §2 풀 URL 채택) |
| (4) axios / node-fetch | 풍부한 interceptor / 광범위 생태계 / Node 구버전 호환 | **새 외부 dependency ([CLAUDE.md §5](../../CLAUDE.md) 게이트 + Q-0017 제약 위반)** / Node LTS 는 이미 `fetch` 내장이라 잉여 / milestone-1·3 내장 fetch 패턴과 비정합 | 기각 — 새 dependency, 내장 fetch 로 충족 가능 |
| (5) `Authorization: Basic base64(email:api_token)` 만 (Server PAT 도 Basic) | 단일 auth scheme 으로 분기 제거 | Confluence Server PAT 는 **Bearer 권장**, Basic 사용 시 사용자명 의존 (PAT 의 발급자) — 별도 `_USER` 변수 강제 / 권장 form 비정합 / Cloud (Atlassian account email 필수) 와 Server (system account 의 PAT) 의 인증 모델 차이 무시 | 기각 (Decision §3 Cloud Basic / Server Bearer 분기 채택) |
| (6) page 번호 직접 증가 pagination (`start += limit`) | 단순한 loop (`_links.next` 의존 제거) | Confluence 권장은 **`_links.next` opaque cursor** (cursor 기반 endpoint 와 호환 / page count race 회피) / `start` 단순 증가는 collection 변경 중 race 시 중복/누락 risk / 일부 endpoint 는 cursor-only | 기각 (Decision §5 cursor 채택) — Confluence 권장 cursor 와 비정합 |
| (7) `CONFLUENCE_INSTANCES_JSON` 단일 JSON env | 한 변수에 instance 전부 박제 — 추가 변수 0 | secret (token) 과 non-secret (host/org/SPACE) 가 한 문자열에 섞여 마스킹/rotation 경계 흐려짐 / instance 한 개의 token rotation 시 전체 JSON 재작성 / systemd EnvironmentFile / CI secret store 의 변수 단위 권한·주입과 비정합 / [ADR-0017](ADR-0017-github-instance-config-source.md) 가 동일 사유로 기각한 결정과 일관 | 기각 (Decision §2 enumerable 분리 채택) — secret 격리 + rotation granularity 우월 |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) Confluence REST 의 rate-limit / retry 복잡도가 직접 구현 부담을 크게 키우면 SDK 도입을 사용자 승인 게이트로 재제안하는 supersede ADR. (ii) Atlassian REST v2 만 사용해야 하는 endpoint 가 증가하면 v1/v2 분기 contract 박제 ADR. (iii) Confluence Cloud-only 배포 전환 시 Server 분기 제거 + Basic auth 단순화 supersede ADR. (iv) KMS 전환 시 token cipher 의 master key 통합 ADR (LLM/GitHub/Confluence 일괄 — 본 ADR 의 `LLM_APIKEY_ENC_KEY` 재사용을 KMS 키 ID 로 대체).

## References

- [README.md L9–22](../../README.md) — Confluence 통합 REQ source (지정 Confluence Service + 다중 SPACE 관리 + 작성자 평가 + 권한 부족 가시화)
- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` — P4 milestone-3 승인 + 4 EXACT 제약 (내장 fetch / mocked test / live defer / milestone-1 패턴 재현) — 본 ADR 의 직접 motivation
- [docs/PLAN.md L83~84](../PLAN.md) — Phase P4 Confluence 통합 + R-34 ADR 의무
- [docs/requirements.md](../requirements.md) — REQ-009/010/015 (Confluence 다중 SPACE 활동 평가) / REQ-016 (권한 가시화) / REQ-017 = R-34 (탐색 정책 ADR) / REQ-034 / REQ-044 / REQ-059 (raw 미저장) source of truth
- [docs/architecture/modules.md](../architecture/modules.md) — ConfluenceModule row (외부 adapter leaf, 4xx → PermissionDeniedEvent emit 책임)
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §2 T-0142/T-0143 row — 본 ADR 이 unblock 하는 후속 scaffold/exploration task 의 책임 표기. **T-0142 row 의 "Confluence client dependency (SDK / fetch 택일) + token credential = §5 BLOCKED 게이트" 표기 중 dependency 게이트는 본 ADR Decision §1 (내장 fetch, dep 0) 로 supersede 된다. token credential 게이트만 후속 live-run task 로 잔류** — 동 row 의 inline 정합 update 는 별도 후속 direct doc-sync task (본 ADR scope 외)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0018 row)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — milestone-1 `FetchLike` `@Optional` 주입 + dispatch + non-2xx throw 패턴 (Decision §1/§4/§6 mirror reference)
- [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) — 순수 `{url, headers, body}` builder + parse + assertNonEmpty 방어 패턴 (Decision §6 request-builder mirror reference)
- [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) — milestone-3 GitHub 순수 request-builder + `parseNextLink` (Decision §6 build / Decision §5 cursor parse mirror reference)
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — milestone-3 GitHub service dispatch + non-2xx 매핑 + `requestAllPages` (Decision §1/§4/§5/§6 mirror reference)
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](ADR-0013-confluence-space-traversal-policy.md) — Confluence SPACE 탐색 정책 (page List + allowlist + 4xx skip-and-continue). 본 ADR 의 transport 가 그 위에 얹힘 (Decision §4 skip-and-continue 위상 / Decision §6 traversal service 책임 정합 source)
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) — apiKey/token encryption-at-rest cipher (Decision §6 token JIT decrypt / never-read-back 재사용 source)
- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — milestone-1 live-test 계약 + PROPOSED→ACCEPTED 전이 패턴 (본 ADR PROPOSED 전이 mirror)
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) — milestone-3 GitHub adapter transport 계약 (본 ADR 6 축 구조 직접 mirror reference)
- [docs/decisions/ADR-0017-github-instance-config-source.md](ADR-0017-github-instance-config-source.md) — env 기반 enumerable instance-keyed config 패턴 (Decision §2 Confluence 차용 source)
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant (REQ-059) — Decision §5 메타 수집 / raw-transient 정합
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) §4 — 외부 adapter direct egress (ConfluenceModule 외부 HTTPS 호출 정책)
- [docs/decisions/ADR-0001-stack.md](ADR-0001-stack.md) — Node LTS stack (채택안 내장 `fetch` dependency-free baseline)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — 새 ADR = pr-mode
- [CLAUDE.md §5](../../CLAUDE.md) — 새 dependency / 자격증명 BLOCKED 게이트 (본 ADR doc-only + 내장 fetch + cipher 재사용 라 dependency / schema-migration 게이트 미발화, live-run task 만 credential 게이트)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 값 절대 미기재 (env 이름/header 형태만 박제)

Refs: T-0183, ADR-0006, ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0017, REQ-009, REQ-010, REQ-015, REQ-016, REQ-017, REQ-034, REQ-044, REQ-059
