---
id: ADR-0021
title: GitHub·Confluence live-integration TEST CONTRACT — env-gated skip-unless-credentialed live smoke 정책 (milestone-3)
status: ACCEPTED (2026-06-03)
date: 2026-06-03
relatedTask: T-0203
supersedes: null
---

# ADR-0021 — GitHub·Confluence live-integration TEST CONTRACT 박제

> milestone-3 (GitHub adapter + Confluence adapter) 의 **3 번째 test layer** (live-gated smoke) 계약을, milestone-1 의 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) (LLM live-test 계약) 가 LLM live spec 보다 먼저 박제된 패턴을 mirror 해 **GitHub·Confluence 양측 단일 ADR 로 선행 박제**한다. 본 ADR 은 test 계약 (gating env 이름·skip 메커니즘·live wire shape·error 경계·3-layer 표) 만 기술하며 production code 0 LOC — gating helper / env-gated live spec 은 후속 [T-0204](../tasks/) (GitHub) / [T-0205](../tasks/) (Confluence) 가 본 ADR 을 단일 source 로 mirror 한다.

## Context

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` (session #50 후속) 에서 P4 milestone-3 의 **live-integration 단계** 를 승인했다. milestone-3 의 GitHub / Confluence adapter 는 [ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) (GitHub transport) + [ADR-0017](ADR-0017-github-instance-config-source.md) (GitHub config source) + [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md) (Confluence transport) 계약 위에 **mocked-fetch unit** (layer 1) + **localhost-stub round-trip smoke** (layer 2) 까지만 main 에 박제됐고, 실 github.com (3 host variant) / 실 Confluence (Cloud·Server) 에는 **한 번도 도달하지 않았다**. live 경로는 [ADR-0016 Consequences](ADR-0016-github-adapter-http-transport-contract.md) ("live 경로 CI 미검증" + 후속 chain "GitHub live-run") 과 [ADR-0018 Consequences](ADR-0018-confluence-adapter-http-transport-contract.md) (후속 chain "Confluence live-run") 가 **명시적으로 deferred** 한 [§5](../../CLAUDE.md) credential 게이트 항목이다.

milestone-1 (LLM) 이 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 를 **LLM live spec 보다 먼저** 박제해 (i) reviewer 가 구현 전에 계약 설계를 점검하고, (ii) 후속 credentialed live RUN 을 순수 [§5](../../CLAUDE.md) env-주입 task 로 축소시킨 패턴이 검증됐으므로, milestone-3 도 동형으로 **GitHub·Confluence live-integration test 계약을 단일 ADR-0021 로 선행 박제**한다. 이렇게 하면 (i) reviewer 가 구현 전 계약을 점검, (ii) 후속 credentialed live RUN 이 순수 [§5](../../CLAUDE.md) env-주입 task 로 축소, (iii) gating helper / env-gated live spec ([T-0204](../tasks/)/[T-0205](../tasks/)) 이 본 ADR 을 단일 source 로 mirror 한다.

본 분해의 근거는 [ADR-0015 Context](ADR-0015-llm-live-integration-test-contract.md) 와 동일하다:

- **[CLAUDE.md §9](../../CLAUDE.md)** — credential (GitHub token / Confluence API token / Server PAT / 암호화 키) 의 실값을 코드/STATE/journal/ADR/spec/CI yaml 어디에도 기재할 수 없다. env/secret 주입만 허용. 따라서 본 ADR 은 env 변수 **이름/형태** 만 박제한다 (값 0).
- **[CLAUDE.md §3.2 R-113](../../CLAUDE.md)** — CI 는 smoke + e2e 를 수행한다. 그러나 실 네트워크 live test 를 public CI 에서 무조건 실행하면 (i) secret-leak (token 이 CI 로그·에러에 노출) (ii) flaky (외부 서비스 가용성·rate-limit 의존) (iii) 비용·rate-limit 소진 (실 API 호출) 이 발생한다. 따라서 live test 는 **gating env 부재 시 자동 skip → public CI 는 실 credential 없이 green 유지** 패턴이 필수다.

### 기존 테스트 layer 와의 경계 (본 ADR 이 RELATIVE 하게 정의)

본 ADR 의 live contract 는 GitHub·Confluence adapter 별로 이미 main 에 박제된 두 layer **위에** 세 번째 layer 를 더한다. 세 layer 의 경계를 adapter 별로 명시하는 것이 본 ADR 의 핵심 산출물이다 (Decision §(v) 의 표). 요지:

- **(1) mocked unit** — jest mock 으로 fetch 를 *대체* (주입 `FetchLike`), transport 를 건너뛰고 builder/parser/dispatch 분기만 검증, credential 0, 항상 실행.
- **(2) localhost-stub round-trip smoke** — `http.createServer` stub 에 **실** `globalThis.fetch` round-trip, transport (헤더 직렬화·URL 조립·non-2xx 실수신·JSON 파싱·pagination cursor) 검증하되 외부 의존 0, credential 0, 항상 실행. (GitHub: [test/smoke/github-adapter-roundtrip.smoke-spec.ts](../../test/smoke/github-adapter-roundtrip.smoke-spec.ts) / Confluence: [test/smoke/confluence-adapter-roundtrip.smoke-spec.ts](../../test/smoke/confluence-adapter-roundtrip.smoke-spec.ts))
- **(3) live smoke (본 ADR)** — (2) 와 동일 transport 경로를 **실 외부 endpoint** 로 확장해 실 GitHub / Confluence 계약 합치를 검증. (3) 만이 credential 을 요구하고 그래서 gating skip 대상이다.

### REQ 외력

- **REQ-005 / REQ-006 / REQ-007 / REQ-008** ([docs/requirements.md](../requirements.md), README L7–18) — GitHub 3 instance (commit / PR / Issue) 활동 평가 backbone. 본 ADR 의 GitHub live 계약이 그 transport 의 실 동작 검증을 박제.
- **REQ-009 / REQ-010 / REQ-015** ([docs/requirements.md](../requirements.md), README L31–33) — Confluence 지정 SPACE 내 문서 작성/업데이트 활동 평가 backbone. 본 ADR 의 Confluence live 계약이 그 transport 의 실 동작 검증을 박제.
- **REQ-016 / REQ-044** ([README.md](../../README.md) L19–22, L33) — instance/SPACE 권한 분리 + 권한 부족 가시화. live 경로의 non-2xx → 도메인 error 매핑 (Decision §(iv)) 이 그 권한 경계의 live-side 정합을 박제.
- **REQ-059 / [ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant. live round-trip 도 메타 비어있지 않음만 assert (Decision §(iii)) 해 raw-transient 정합 유지.
- **[CLAUDE.md §3.2 R-112](../../CLAUDE.md)** — gating 판정 로직 (env 읽기·완전성 검사) 은 skip 본문에 묻으면 unit-test 불가하므로, entrypoint-helper 분리 원칙을 mirror 해 **순수 helper 함수** 로 분리하고 happy/error/negative test 를 후속 task 가 강제한다 (본 ADR 은 helper 의 gating semantics 위상만 박제, 코드는 [T-0204](../tasks/)/[T-0205](../tasks/) scope).

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0021** — `docs/decisions/` 에 ADR-0001 ~ ADR-0020 점유 (ADR-0007 은 미신설 — [ADR-0016 §ADR cross-reference](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §ADR cross-reference](ADR-0018-confluence-adapter-http-transport-contract.md) 박제). 본 ADR 은 다음 free 번호 ADR-0021 을 사용 (T-0203 acceptance 의 번호 정합 명시).
- **[ADR-0015](ADR-0015-llm-live-integration-test-contract.md)** — milestone-1 LLM live-test 계약. 본 ADR 의 gating env / skip-in-CI 메커니즘 / live wire shape invariant / error 경계 / 3-layer 표 구조를 **직접 mirror** 하되 GitHub·Confluence 도메인으로 reframe. milestone-1 의 LLM live 는 본 ADR scope 외 (이미 ADR-0015 + 후속으로 분리).
- **[ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0017](ADR-0017-github-instance-config-source.md)** — GitHub transport + config source 계약. 본 ADR 의 GitHub live 계약이 그 위에 얹히며, gating env 의 per-host 분리는 ADR-0017 의 enumerable instance-key (`public`/`sec`/`ecode`) 패턴과 정합. 본 ADR 은 transport/config 계약을 **재결정하지 않는다** (live test 계약만 추가 박제).
- **[ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md)** — Confluence transport 계약 (Cloud `/wiki/rest/api` Basic vs Server `/rest/api` Bearer / `_links.next` body cursor / `CONFLUENCE_MAX_PAGES` cap). 본 ADR 의 Confluence live 계약이 그 위에 얹히며 transport 계약을 재결정하지 않는다.

## Decision

본 ADR 은 다음 5 결정을 박제한다. **본 ADR 은 test 계약 (gating env 이름·skip 메커니즘·live wire shape·error 경계·3-layer 표) 을 기술하되 `GithubAdapter` / `ConfluenceAdapter` 의 동작 코드 및 gating helper 코드는 변경/신설하지 않는다 (production code 0 LOC — 후속 [T-0204](../tasks/)/[T-0205](../tasks/) 책임).**

### Decision §(i) — gating env 변수 이름 확정 (실 secret 값 0)

GitHub·Confluence live smoke 는 각 adapter 별로 아래 env 변수가 **모두** 비어있지 않게 set 된 경우에만 활성화된다. **모두 env/secret 주입만** ([CLAUDE.md §9](../../CLAUDE.md) — 실값 0, 이름/형태만). [ADR-0017](ADR-0017-github-instance-config-source.md) enumerable instance-key 패턴 + [ADR-0018 Decision §2](ADR-0018-confluence-adapter-http-transport-contract.md) instance-keyed 변수와 정합한다.

**GitHub 측** (3 host variant 별 per-host token — ADR-0017 의 `public`/`sec`/`ecode` instance key 정합):

| env 변수 | 역할 | 예시 shape (실값 0) |
| --- | --- | --- |
| **`GITHUB_LIVE_TEST`** | gating toggle. set (비어있지 않은 값) 시에만 GitHub live 경로 활성. 부재/빈/공백 시 skip. 이 flag 단독으로는 부족 — 아래 host token 도 필요. | `GITHUB_LIVE_TEST=1` |
| **`GITHUB_LIVE_TOKEN_PUBLIC`** | public github.com (`api.github.com`) 호출용 token (평문, Authorization Bearer). | `GITHUB_LIVE_TOKEN_PUBLIC` |
| **`GITHUB_LIVE_TOKEN_SEC`** | Enterprise `github.sec.samsung.net` (`/api/v3`) 호출용 token. | `GITHUB_LIVE_TOKEN_SEC` |
| **`GITHUB_LIVE_TOKEN_ECODE`** | Enterprise `github.ecodesamsung.com` (`/api/v3`) 호출용 token. | `GITHUB_LIVE_TOKEN_ECODE` |

GitHub gating 완전성 규칙: `GITHUB_LIVE_TEST` AND (검증 대상 host 의 per-host token) 이 모두 non-empty 일 때만 해당 host 의 live 활성. **부분 활성 자연 지원** — 예: `public` token 만 주어지면 public host 만 활성, Enterprise host 는 skip (환경별 부분 credential, ADR-0017 부분 활성 정합). 어느 host 가 token 부재로 skip 됐는지 helper 의 `reason` 이 보고.

**Confluence 측** (Cloud-token / Server-PAT — ADR-0018 Decision §3 Cloud Basic vs Server Bearer 분기 정합):

| env 변수 | 역할 | 예시 shape (실값 0) |
| --- | --- | --- |
| **`CONFLUENCE_LIVE_TEST`** | gating toggle. set 시에만 Confluence live 경로 활성. 부재/빈/공백 시 skip. | `CONFLUENCE_LIVE_TEST=1` |
| **`CONFLUENCE_LIVE_BASE_URL`** | live endpoint 의 풀 REST API base URL (Cloud `https://<workspace>.atlassian.net/wiki/rest/api` 또는 Server `https://<host>/rest/api` — ADR-0018 Decision §2 풀 URL 박제 정합). | `CONFLUENCE_LIVE_BASE_URL` |
| **`CONFLUENCE_LIVE_AUTH_USER`** | Cloud Basic 인증의 email/계정명 — non-empty 면 Cloud Basic, empty/미정의 면 Server Bearer 로 분기 (ADR-0018 Decision §3 `AUTH_USER` 존재 여부 분기 정합). | `CONFLUENCE_LIVE_AUTH_USER` |
| **`CONFLUENCE_LIVE_TOKEN`** | Cloud API token (Basic 의 password 자리) 또는 Server PAT (Bearer). 평문, scheme 분기는 `AUTH_USER` 가 결정. | `CONFLUENCE_LIVE_TOKEN` |

Confluence gating 완전성 규칙: `CONFLUENCE_LIVE_TEST` AND `CONFLUENCE_LIVE_BASE_URL` AND `CONFLUENCE_LIVE_TOKEN` 3 종이 **모두** non-empty 일 때만 활성. `CONFLUENCE_LIVE_AUTH_USER` 는 gating 필수가 아님 — 부재 시 Server Bearer 로 진행 (gating 필수 3 종에 미포함, scheme 분기 입력일 뿐).

**암호화 키 재사용** — live RUN 이 cipher 를 통해 token 을 다루는 경우 [ADR-0014 §2](ADR-0014-llm-api-key-encryption-at-rest.md) `LLM_APIKEY_ENC_KEY` (또는 후속이 확정할 token 전용 env) 를 재사용한다 (새 env 도입 0). 단 본 live smoke scaffold 는 cipher 를 stub 하거나 평문 경로 (env 의 live token) 로 우회할 수 있다 ([ADR-0015 Decision §1](ADR-0015-llm-live-integration-test-contract.md) 의 LLM live scaffold 가 cipher 를 stub 한 패턴 mirror) — 본 ADR 은 새 env 를 도입하지 않는다.

### Decision §(ii) — skip-in-CI gating semantics (순수 helper + describe.skip)

- **trim-후-non-empty AND 판정** — gating 판정은 [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) `resolveLiveTestGating` 의 semantics 를 GitHub·Confluence 각각으로 **mirror** 한다: 필수 env 가 모두 `trim()` 후 길이 > 0 일 때만 `enabled === true`. 하나라도 **부재 (undefined) / 빈 문자열 / 공백-only / 부분-set** 이면 `enabled === false` (skip). 어느 env 가 부재해 skip 됐는지 `reason` 필드에 박제 (실값 미포함 — 이름만, [§9](../../CLAUDE.md)). **helper 코드 자체는 본 ADR scope 외** — 위상 (반환 shape `{ enabled, reason, ... }` + 부분-set false 판정) 만 박제.
- **describe 분기** — spec 은 `const gating = resolveGithubLiveTestGating(process.env);` (Confluence 는 등가물) 후 `const d = gating.enabled ? describe : describe.skip;` 로 suite 를 등록한다. gating env 부재 (= public CI 기본 조건) → `describe.skip` → 전 it skip → 실 네트워크 호출 0 → public CI green. 사람이 local / 전용 workflow 에 env 주입 시에만 `describe` 활성 → 실 호출. ([ADR-0015 Decision §2](ADR-0015-llm-live-integration-test-contract.md) + [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) 의 `describeLive` 패턴 mirror.)
- **CI 정합** — 후속 live spec 은 `.smoke-spec.ts` suffix 라 [test/jest-smoke.json](../../test/jest-smoke.json) 의 `testRegex` 가 자동 픽업하고 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) "스모크 테스트" step 이 실행한다 (CI/jest 설정 수정 0). CI 에는 gating env 가 없으므로 항상 skip — green 유지. GitHub·Confluence 각각 독립 gating 이라 한쪽만 credentialed 환경에서도 다른 쪽은 skip.

### Decision §(iii) — live endpoint shape (adapter 별)

live 호출은 기존 transport 계약 ([ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md)) 의 builder/parser/dispatch 경로를 **그대로 재사용** 하며 (live 전용 wire 코드 중복 0), 실 endpoint 에 대해 다음 round-trip 을 1 회 검증한다.

- **GitHub** — 실 `api.github.com` (public) 또는 `<host>/api/v3` (Enterprise) 의 REST list endpoint (예: org repos / commits) 를 호출하고 ([ADR-0016 Decision §2](ADR-0016-github-adapter-http-transport-contract.md) host→base URL 도출), 응답 `Link` rel=next 가 있으면 **실 pagination 1 round-trip** ([ADR-0016 Decision §5](ADR-0016-github-adapter-http-transport-contract.md) `Link` cursoring) 을 검증한다. `Authorization: Bearer <token>` + `X-GitHub-Api-Version` header 정합 ([ADR-0016 Decision §3](ADR-0016-github-adapter-http-transport-contract.md)).
- **Confluence** — 실 Cloud `<workspace>.atlassian.net/wiki/rest/api` (Basic) 또는 Server `<host>/rest/api` (Bearer) 의 content list endpoint 를 호출하고 ([ADR-0018 Decision §2/§3](ADR-0018-confluence-adapter-http-transport-contract.md)), 응답 body `_links.next` cursor 가 있으면 **실 cursor pagination** ([ADR-0018 Decision §5](ADR-0018-confluence-adapter-http-transport-contract.md)) 을 검증한다.
- **검증 invariant ([ADR-0015 Decision §3](ADR-0015-llm-live-integration-test-contract.md) mirror)** — live smoke 는 실 endpoint 응답에서 **비결정적 본문은 assert 하지 않는다**. 비어있지 않은 메타 1+ (예: GitHub repo/commit 식별자 또는 Confluence page id/title 1+ 존재) + 도메인 매핑 합치 (응답이 도메인 객체로 정상 변환됨, raw 미저장 invariant 정합) 만 assert 한다. 실 데이터 내용 (commit message / page 본문 의미) 은 환경별 비결정적이라 assert 대상이 아니다.

### Decision §(iv) — timeout + non-2xx → 도메인 error LIVE 매핑

본 ADR 은 live 경로가 기존 transport 계약의 error 경계를 **공유** 함을 기술한다 (코드 변경 0).

- **non-2xx 매핑 위상** — live endpoint 의 401/403 (permission-denied) / 404 (not-found) / 429 (rate-limited) / 5xx (upstream / transient) 는 [ADR-0016 Decision §4](ADR-0016-github-adapter-http-transport-contract.md) (GitHub 도메인 error + 4xx PermissionDeniedEvent) / [ADR-0018 Decision §4](ADR-0018-confluence-adapter-http-transport-contract.md) (`ConfluencePermissionDeniedError` 등 + SPACE 단위 skip-and-continue) 의 도메인 error 위상으로 매핑된다 — live 와 stub 가 **동일한 adapter 매핑 경로** 를 공유.
- **stub-validated wire 매핑과 구분** — non-2xx (401/403/404/429/5xx) 의 실수신·매핑 재현은 **layer 2 localhost-stub** 가 의도적 실패 status 를 돌려주는 negative it 으로 검증한다 ([ADR-0015 Decision §4](ADR-0015-llm-live-integration-test-contract.md) mirror). live smoke 는 실 endpoint 에 **의도적 실패를 유도하지 않고 happy round-trip 만** 검증한다 — 실 endpoint 에 401/429 를 강제하면 flaky / rate-limit 소진 / 계정 위험을 유발하므로 실패 재현은 layer 2 stub 에 위임.
- **timeout 위상** — live endpoint 의 hang 위험은 spec 내 `jest.setTimeout` 상한 (예: 30000ms, [llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) 패턴) 으로 보호하며, adapter 내 명시 AbortController timeout 도입 여부는 본 ADR scope 외 (별도 hardening task — [ADR-0015 Decision §4](ADR-0015-llm-live-integration-test-contract.md) "timeout 부재 잔존" trade-off mirror). timeout 초과는 jest 자체가 실패로 보고 (별도 매핑 0). gating skip 시 `jest.setTimeout` 미발화.

### Decision §(v) — 3-layer 경계 표 (ADR-0015 표 mirror)

adapter 별 (1) unit mocked-fetch / (2) localhost-stub roundtrip / (3) live-gated 의 fetch · endpoint · credential · CI 동작 열을 박제한다.

**GitHub:**

| layer | 파일 | fetch | endpoint | credential | CI 동작 |
| --- | --- | --- | --- | --- | --- |
| **(1) mocked unit** | `src/github/*.spec.ts` | jest mock 으로 *대체* (주입 `FetchLike`) | 없음 — fetch 가 mock | 0 (fixture 평문) | 항상 실행 |
| **(2) stub roundtrip smoke** | [test/smoke/github-adapter-roundtrip.smoke-spec.ts](../../test/smoke/github-adapter-roundtrip.smoke-spec.ts) | **실** `globalThis.fetch` | localhost `http.createServer` stub | 0 (평문 fixture, localhost) | 항상 실행 |
| **(3) live smoke** (본 ADR) | `test/smoke/github-live.smoke-spec.ts` (T-0204 신설) | **실** `globalThis.fetch` | **실** `api.github.com` / `<host>/api/v3` | 실 per-host token (env 주입) | **gating env 부재 시 skip** |

**Confluence:**

| layer | 파일 | fetch | endpoint | credential | CI 동작 |
| --- | --- | --- | --- | --- | --- |
| **(1) mocked unit** | `src/confluence/*.spec.ts` | jest mock 으로 *대체* (주입 `ConfluenceFetchLike`) | 없음 — fetch 가 mock | 0 (fixture 평문) | 항상 실행 |
| **(2) stub roundtrip smoke** | [test/smoke/confluence-adapter-roundtrip.smoke-spec.ts](../../test/smoke/confluence-adapter-roundtrip.smoke-spec.ts) | **실** `globalThis.fetch` | localhost `http.createServer` stub | 0 (평문 fixture, localhost) | 항상 실행 |
| **(3) live smoke** (본 ADR) | `test/smoke/confluence-live.smoke-spec.ts` (T-0205 신설) | **실** `globalThis.fetch` | **실** Cloud `/wiki/rest/api` 또는 Server `/rest/api` | 실 Cloud API token / Server PAT (env 주입) | **gating env 부재 시 skip** |

경계 요지: (1) 은 transport 를 *건너뛰고* dispatch/parse 분기만, (2) 는 transport (헤더 직렬화·URL 조립·non-2xx 실수신·JSON 파싱·pagination cursor) 를 localhost 에서 실 fetch 로 검증하되 외부 의존 0, (3) 은 (2) 와 동일 transport 경로를 **실 외부 endpoint** 로 확장해 실 서비스 계약 합치를 검증. (3) 만이 credential 을 요구하고 그래서 gating skip 대상이다.

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — live test 계약의 **결정** 만 박제한다. `pnpm add` 0 / 외부 호출 0 / secret 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row).
- **gating helper / live spec 코드는 §5 게이트 미발화** — gating helper (`resolveGithubLiveTestGating` / `resolveConfluenceLiveTestGating`) + env-gated live spec 은 내장 fetch (dep 0) + env 만 사용하므로 후속 [T-0204](../tasks/)/[T-0205](../tasks/) 가 [CLAUDE.md §5](../../CLAUDE.md) 새 dependency 게이트를 발화하지 않고 dependency-free 로 진입 가능하다.
- **실 token live RUN 만 §5 credential 게이트로 deferred** — 실 GitHub 3 host token + Confluence Cloud/Server token 의 env/secret 주입 + 실 네트워크 live smoke 1 회 실행 검증은 후속 live-run task 의 [CLAUDE.md §5](../../CLAUDE.md) 외부 자격증명 게이트 대상이다 (milestone-1 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md) / Q-0016 optionA task 2 패턴 mirror). 본 ADR 은 env 변수 **이름/형태** 만 박제하며 실값 0 ([CLAUDE.md §9](../../CLAUDE.md)).
- **PermissionDeniedRecord entity 의 Prisma model + migration** 은 [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트로 별도 task ([ADR-0016](ADR-0016-github-adapter-http-transport-contract.md)/[ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md) 후속 chain 공통) — 본 ADR scope 외.

## Consequences

### 양의 (positive)

1. **dependency-free 즉시 착수** — Node 내장만 (새 dep 0), 실 credential 0 으로 GitHub·Confluence live contract 와 후속 scaffold 의 계약을 지금 박제 → [CLAUDE.md §5](../../CLAUDE.md) 게이트 미발화. credential 은 후속 live-run task 가 env 주입.
2. **public CI green 보존** — Decision §(ii) 의 gating env 부재 → describe.skip 으로 CI 는 실 네트워크 0·secret 0·비용 0 으로 green. R-113 smoke 게이트는 stub round-trip (2) + skip 된 live (3) 로 여전히 통과.
3. **순수 helper 의 testability** — Decision §(ii) 가 gating 판정을 순수 함수 위상으로 박제 → 후속 task 가 R-112 happy/error/negative (부재/빈/공백/부분-set 각 skip 판정) 를 unit-test 가능. skip 본문 미테스트 risk 회피 ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 동형).
4. **GitHub·Confluence 단일 ADR 의 일관성** — 양 adapter 의 live 계약을 한 ADR 에 박제 → milestone-3 live 정책이 단일 source. 두 후속 task (T-0204/T-0205) 가 동일 ADR 을 mirror 해 계약 divergence 0.
5. **adapter 재사용** — Decision §(iii)/§(iv) 가 기존 transport builder/parser/dispatch + error 매핑 경로를 그대로 재사용 → live 전용 wire/error 코드 중복 0, transport 계약 합치.
6. **per-host / Cloud·Server 부분 활성** — Decision §(i) 의 per-host token / Cloud·Server gating 이 환경별 부분 credential (예: public host 만, Cloud 만) 을 자연 지원 → 운영자가 가진 credential 만으로 부분 live 검증 가능 ([ADR-0017](ADR-0017-github-instance-config-source.md) 부분 활성 정합).

### 음의 (negative) / trade-off

1. **live 경로의 CI 미검증** — gating skip 이라 public CI 는 live 코드의 실 실행을 검증하지 않는다 (skip 만 검증). mitigation: 순수 helper 의 gating 분기는 unit-test 로 full cover + credentialed live-run task 가 실 endpoint 로 1 회 검증 ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 동형).
2. **gating env 운영 부담** — 사람이 local/전용 workflow 에 GitHub per-host token + Confluence Cloud/Server env 를 정확히 주입해야 live 활성. mitigation: helper 의 `reason` 필드가 어느 env 가 부재해 skip 됐는지 사람에게 보고 (host 별 부분 활성 진단 포함).
3. **timeout 부재 잔존** — Decision §(iv) 상 명시 AbortController timeout 미도입 → live endpoint hang 시 jest 기본/setTimeout 상한까지 대기. mitigation: spec 내 `jest.setTimeout` 상한 + 별도 hardening task 로 AbortController 도입 가능 ([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 동형 trade-off).
4. **live happy-path only** — Decision §(iv) 상 live 는 의도적 실패 (401/429) 를 유도하지 않아 실 endpoint 의 error 매핑은 live 에서 미검증. mitigation: non-2xx 매핑은 layer 2 stub 가 검증 (실 endpoint flaky/rate-limit/계정 위험 회피).

### 후속 task chain

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **T-0204 (GitHub)** | `src/github/github-live-test-gating.ts` + colocated spec (R-112 4 항목 + negative cases 충분 cover: 부재/빈/공백/부분-set 각 skip 판정) + `test/smoke/github-live.smoke-spec.ts` (`gating.enabled ? describe : describe.skip` → 부재 시 CI green). ADR-0021 Decision §(i)~(v) 를 GitHub 측 구현. `resolveLiveTestGating` 패턴 mirror | 본 ADR-0021 머지 후 | **없음 — 내장 fetch (dep 0), env 만, `pnpm add` 0** |
| **T-0205 (Confluence)** | T-0204 의 Confluence 등가물: `src/confluence/confluence-live-test-gating.ts` + colocated spec + `test/smoke/confluence-live.smoke-spec.ts`. Cloud Basic vs Server Bearer gating 분기 (ADR-0018 Decision §3 정합) 반영 | 본 ADR + T-0204 후 (또는 병렬) | **없음 — dep 0** |
| **credentialed live RUN** | T-0204/T-0205 머지 후, 사용자가 GitHub 3 host token + Confluence Cloud/Server token 을 env/secret 주입 (실값 [§9](../../CLAUDE.md) 금지) 한 뒤 gated live spec 을 실 네트워크 1 회 실행 검증. 필요 시 전용 workflow (secret 주입 step) | scaffold 머지 + 사용자 credential | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** |
| **live timeout hardening** | GithubAdapter / ConfluenceAdapter 에 AbortController 기반 명시 timeout 도입 + R-112 negative (timeout 발화) | 본 ADR 후 | 없음 (Node 내장) |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) env-gated skip-unless-credentialed live smoke + 순수 gating helper, GitHub·Confluence 단일 ADR 선행 박제** (채택) | public CI green 보존 (skip) / 실 credential 0 으로 즉시 착수 / R-112 helper testable / mocked·stub layer 와 경계 명시 / transport adapter 재사용 / milestone-1 ADR-0015 검증된 패턴 mirror / 양 adapter 단일 source | live 경로 자체는 CI 미검증 (후속 task 가 검증) / gating env 운영 부담 | **✓ 채택** ([Q-0017](../STATE.json) live 승인 직접 충족) |
| (2) live test 를 항상 실행 (gating 없음) | live 경로가 매 CI 에서 실 검증 | **secret-leak (token 이 CI 로그 노출)** + flaky (외부 서비스 가용성·rate-limit) + 비용/rate-limit 소진 + [§9](../../CLAUDE.md)/R-113 정합 0 (public CI 에 credential 상주) | 기각 — secret-leak/flaky/비용 |
| (3) GitHub·Confluence live 계약을 별도 2 ADR 로 분리 | adapter 별 ADR 독립성 | milestone-1 이 LLM 단일 ADR (ADR-0015) 로 박제한 패턴과 비정합 / 두 adapter 의 gating semantics·3-layer 구조가 동형이라 중복 ADR / reviewer 점검 표면 2 배 | 기각 — 동형 계약은 단일 ADR 이 cohesive (milestone-1 패턴 mirror) |
| (4) live test 미작성 (live 미검증) | 구현 0 / 복잡도 0 | **Q-0017 live 승인 위반** — milestone-3 live 통합이 영구 미검증 / 후속 credentialed task 가 scaffold 없이 from-scratch | 기각 — live 승인 미충족 |
| (5) gating helper 를 LLM `resolveLiveTestGating` 1 개로 공용 | helper 코드 중복 0 | LLM 의 gating env (`LLM_LIVE_*`) 와 GitHub per-host / Confluence Cloud·Server 의 env shape·분기 가 상이 (per-host 다중 token / Cloud Basic vs Server Bearer) → 단일 helper 가 도메인별 분기를 떠안아 복잡도 ↑ | 기각 — adapter 별 helper 가 도메인 분기 cohesive (Decision §(ii) 는 semantics mirror 만, 코드는 분리) |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) live endpoint 의 rate-limit / flaky 가 빈발하면 전용 nightly workflow + retry 정책 ADR. (ii) GitHub App / OAuth token rotation 자동화가 필요하면 credential 주입 경로 확장 ADR. (iii) Confluence Cloud-only 전환 시 Server Bearer gating 분기 제거 supersede.

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` — P4 milestone-3 승인 + milestone-3 live-integration 승인 (session #50 후속) — 본 ADR 의 직접 motivation
- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — milestone-1 LLM live-test 계약 ADR (본 ADR 의 직접 TEMPLATE — gating env / skip-in-CI / live wire shape / error 경계 / 3-layer 표 / Alternatives / 후속 chain 구조 mirror)
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) — GitHub transport 계약 (3 host base URL / `Authorization: Bearer` + `X-GitHub-Api-Version` / non-2xx 도메인 매핑 + 4xx→PermissionDeniedEvent / Link rel=next) — live 계약이 그 위에 얹힘
- [docs/decisions/ADR-0017-github-instance-config-source.md](ADR-0017-github-instance-config-source.md) — env 기반 enumerable instance-key (`public`/`sec`/`ecode`) — Decision §(i) per-host token gating 정합 source
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](ADR-0018-confluence-adapter-http-transport-contract.md) — Confluence transport 계약 (Cloud `/wiki/rest/api` Basic vs Server `/rest/api` Bearer / `_links.next` body cursor / `CONFLUENCE_MAX_PAGES` cap) — live 계약이 그 위에 얹힘
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) §2 — `LLM_APIKEY_ENC_KEY` env 재사용 + secret 값 0 기재 패턴
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant (REQ-059) — Decision §(iii) live 메타 round-trip 정합
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — `resolveLiveTestGating` gating-helper reference (Decision §(ii) semantics mirror source — 후속 T-0204/T-0205 가 GitHub·Confluence 로 일반화)
- [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) — env-gated live-spec reference (`gating.enabled ? describe : describe.skip`) — 후속 live spec 형태 reference
- [test/smoke/github-adapter-roundtrip.smoke-spec.ts](../../test/smoke/github-adapter-roundtrip.smoke-spec.ts) / [test/smoke/confluence-adapter-roundtrip.smoke-spec.ts](../../test/smoke/confluence-adapter-roundtrip.smoke-spec.ts) — layer 2 localhost-stub round-trip (본 live 계약이 그 위에 layer 3 으로 얹힘)
- [test/jest-smoke.json](../../test/jest-smoke.json) — smoke testRegex (신규 live spec 의 suffix 근거)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0021 row)
- [CLAUDE.md §3.2 R-112/R-113](../../CLAUDE.md) — entrypoint-helper 분리 + smoke/e2e CI 게이트
- [CLAUDE.md §5 / §9](../../CLAUDE.md) — 자격증명 BLOCKED 게이트 + secret 값 미기재 (env 이름만)

Refs: T-0203, ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-015, REQ-016, REQ-044, REQ-059
