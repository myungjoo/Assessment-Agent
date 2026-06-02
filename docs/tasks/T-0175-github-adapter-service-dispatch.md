---
id: T-0175
title: GithubAdapter @Injectable service — 단일 요청 dispatch + non-2xx 도메인 error 매핑 (4xx→PermissionDeniedEvent emit)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044]
estimatedDiff: 165
estimatedFiles: 4
created: 2026-06-02
completedAt: 2026-06-02T23:47:21+09:00
prNumber: 159
mergeCommit: 125f486
actualDiff: "630 LOC (prod 219 + R-112 spec 411) — sizeExempt"
plannerNote: P4 milestone-3 GithubAdapter 2차 slice(ADR-0016 §1/§4/§6). T-0158 mirror. dep 0/§5 미발화. R-112 backbone ×1.5. pagination·module·JIT decrypt defer.
---

# T-0175 — GithubAdapter @Injectable service — 단일 요청 dispatch + non-2xx 도메인 error 매핑

## Why

P4 milestone-3 (GitHub adapter, [PLAN.md L81](../PLAN.md)) 의 **2차 vertical slice** 다. 사용자가 [Q-0017](../STATE.json) 으로 milestone-3 을 승인했고, [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 transport 계약을 박제했다. 1차 slice (T-0174, PR #158, merged) 가 순수 request-builder ([ADR-0016 §2/§3](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) 를 박제했고, 본 slice 는 그 builder 를 소비하는 `@Injectable GithubAdapter` service 가 **단일 요청을 주입 `FetchLike` 로 dispatch** 하고 ([ADR-0016 §1/§6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) non-2xx 응답을 **도메인 error 로 매핑** ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md): 401/403→permission-denied, 404→not-found, 429→rate-limited, 5xx→upstream-error, fetch reject→transport-error) 하며 4xx 에서 **PermissionDeniedEvent 를 emit** 한다 (REQ-044 권한 가시화). milestone-1 의 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) (T-0158) 가 builder (T-0157) 뒤에 `FetchLike` 주입 dispatch service 를 박제한 split 을 정확히 mirror 한다. Link pagination ([§5](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) / GithubModule wiring / token JIT decrypt ([§6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) 는 본 slice 밖 (Follow-up).

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\decisions\ADR-0016-github-adapter-http-transport-contract.md` — THE 계약. 본 task 는 **Decision §1 (내장 `globalThis.fetch` 를 injectable `FetchLike` 로 주입, Link header 를 읽을 수 있는 response surface) + §4 (non-2xx → 도메인 error 매핑 표 + 4xx → PermissionDeniedEvent emit 위상 + instance/repo 단위 skip-and-continue) + §6 (service orchestration 경계, 단 token JIT decrypt 는 defer)** 만 구현. **§5 (Link rel=next pagination 순회) 는 OUT OF SCOPE** — 본 slice 는 단일 요청 1 회 dispatch 만 (next URL 추출/순회 없음). §2/§3 (host 라우팅 / header 조립) 은 이미 T-0174 builder 가 제공 — 본 service 는 그 builder 를 호출만.
- `C:\Users\myung\Assessment-Agent\src\github\github-request.builder.ts` — 본 service 가 소비할 1차 slice. `buildGithubRequest({host, token, path, query})` → `{url, headers}` + `resolveGithubApiBaseUrl` + `GITHUB_API_VERSION` + `GithubRequestInput` / `GithubRequest` interface. 본 service 는 이 builder 로 요청을 조립한 뒤 주입 fetch 로 호출한다.
- `C:\Users\myung\Assessment-Agent\src\llm\llm-http-gateway.service.ts` — mirror 할 reference. `FetchLike` 함수 타입을 `@Optional()` 생성자 주입 (default `globalThis.fetch`), build → 주입 fetch 호출 → `!response.ok` 분기 → throw 의 구조. 본 GithubAdapter 는 이 `!response.ok` 단일 throw 를 **GitHub 도메인 status 분기로 확장** (401/403/404/429/5xx/network 별).
- `C:\Users\myung\Assessment-Agent\src\llm\llm-http-gateway.service.spec.ts` — (참고용, 전체 정독 불요) `FetchLike` mock 으로 non-2xx / fetch reject / malformed JSON 분기를 검증하는 패턴. 본 colocated spec 이 동형으로 status 분기 mock.
- `C:\Users\myung\Assessment-Agent\docs\architecture\modules.md` (L35 GithubModule row) — "4xx catch → PermissionDeniedEvent emit" 책임 + adapter leaf 위치. 본 service 가 그 책임의 emit 위상을 구현.
- `C:\Users\myung\Assessment-Agent\src\llm\providers\openai-compatible.adapter.spec.ts` — colocated spec 의 R-112 4 종 + negative 패턴 reference.

## Acceptance Criteria

신규 파일 (colocated spec 우선 — NestJS convention + discoverability):

- `src/github/github-adapter.service.ts` — `@Injectable() class GithubAdapter`. 다음을 export/구현:
  - [ ] `FetchLike` 함수 타입 export — `(url, init) => Promise<{ ok, status, headers, json }>`. milestone-1 의 `{ ok, status, json }` 에 더해 **`headers` 접근** (`Headers.get(name)` 또는 동형 — [ADR-0016 §1](../decisions/ADR-0016-github-adapter-http-transport-contract.md) "Link header 를 읽을 수 있는 fetch surface") 을 포함. 본 slice 는 단일 요청이라 Link 를 실제 순회하지 않지만, response surface 타입은 후속 pagination slice 와 정합하게 박제 (실제 Link 파싱 코드는 OUT OF SCOPE).
  - [ ] 생성자 — `FetchLike` 를 `@Optional()` 주입 (default `globalThis.fetch`) + PermissionDeniedEvent emit 을 위한 emitter port 주입 (아래). milestone-1 `@Optional()` 패턴 mirror.
  - [ ] `GithubDomainError` (또는 동형 named error / error code enum) export — `permission-denied` / `not-found` / `rate-limited` / `upstream-error` / `transport-error` 5 위상을 식별 가능한 형태 ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 매핑 표). error 객체에 status 와 도메인 분류 (code/kind) 를 담되 **token 평문은 절대 미포함** (로그/직렬화 노출 금지 — [CLAUDE.md §9](../../CLAUDE.md)).
  - [ ] `request(...)` (또는 동형 단일 dispatch 메서드) — instance sub-config (host / token 평문) + 대상 path (+ optional query) 를 받아 `buildGithubRequest` 로 `{url, headers}` 조립 → 주입 fetch 호출 → 응답 분기 → 성공 시 파싱된 JSON 반환. **단일 요청 1 회만** (pagination 순회 없음). token 은 **이미 복호화된 평문** 을 인자로 받는다 (JIT decrypt 는 본 slice 밖 — 호출처/후속 slice 책임, builder 의 token 평문 인자 규약과 동일).
  - [ ] non-2xx 분기 — `response.status` 를 [ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 표대로 매핑: 401/403 → `permission-denied`, 404 → `not-found`, 429 → `rate-limited`, 5xx → `upstream-error`. fetch 가 reject (network/DNS/TLS) 하면 `transport-error`. 각 분기는 `GithubDomainError` throw (또는 동형).
  - [ ] 4xx (401/403) catch → **PermissionDeniedEvent emit** (REQ-044). emit 은 주입된 emitter port (예: `(event) => void` 함수 또는 작은 interface) 를 통해 수행하며 **default 는 no-op** — `PermissionDeniedRecord` entity 의 실 persistence 는 OUT OF SCOPE ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md) "PermissionDeniedRecord entity 의 실 schema 는 본 ADR scope 외"). emit 후에도 도메인 error 를 throw (instance/repo 단위 skip-and-continue 는 호출처가 catch 해 결정 — 본 service 는 throw 까지만).
  - [ ] 성공 (2xx) 경로 — `response.json()` 결과 반환. JSON 파싱 실패 / 비정상 응답은 명확한 error throw (malformed → upstream-error 또는 동형, swallow 금지).
- `src/github/github-adapter.service.spec.ts` — colocated R-112 spec (모두 주입 `FetchLike` mock — **실 네트워크 0 / 실 token 0**, §5 미발화):
  - [ ] **Happy path** — 2xx 응답 mock → `request(...)` 가 builder 로 올바른 url/headers (Bearer token / Accept / X-GitHub-Api-Version) 를 조립해 주입 fetch 를 1 회 호출하고 파싱된 JSON 을 반환함을 검증. default `globalThis.fetch` 미주입 분기도 1 test (주입 없이 생성 가능).
  - [ ] **Error path** — 각 status class 별 negative test 1+ (단일 negative 금지): 401 → permission-denied + emitter 호출됨, 403 → permission-denied + emitter 호출됨, 404 → not-found, 429 → rate-limited, 500 (5xx) → upstream-error, fetch reject (Promise.reject) → transport-error. 각각 throw 되는 error 의 도메인 분류 (code/kind) + status 를 assert.
  - [ ] **PermissionDeniedEvent emit 검증** — 401/403 시 주입된 emitter port 가 정확히 호출됨을 mock 으로 검증 (emit payload 에 host/path 등 식별 정보 포함, **token 평문 미포함** assert). 404 / 429 / 5xx / 성공 경로에서는 emitter 가 **호출되지 않음** 을 검증 (분기 정확성).
  - [ ] **Flow / branch coverage** — 성공 분기 / 5 status 분기 / fetch reject 분기 / JSON 파싱 실패 분기 각 1+ test. emitter default no-op 분기 (emitter 미주입 시 401 가 throw 만 하고 crash 안 함) 1 test.
  - [ ] **Negative cases 충분 cover** — token 평문이 error message / 직렬화에 노출되지 않음 검증 1+ ([CLAUDE.md §9](../../CLAUDE.md)), malformed JSON (`json()` 이 throw 또는 빈/비정상 응답) 1+, 빈 path/host 위임 throw (builder 의 assertNonEmpty 전파) 1+. 각 방어 분기마다 test.
  - [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — tester 가 확인).
- [ ] CI 의 unit + smoke + e2e 전부 green (R-113 — 실 token 0 / 실 네트워크 0 이므로 §5 미발화).

## Out of Scope

다음은 본 slice 가 **건드리지 않는다** (Follow-up 으로 분리 — diff 작게 유지):

- **Link rel=next pagination 순회** ([ADR-0016 §5](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 다음 slice. 본 service 는 단일 요청 1 회만 dispatch 하고, `FetchLike` response surface 에 `headers` 접근 타입만 박제 (실제 Link 파싱/next URL 추출/순회 loop 는 미구현).
- **token JIT decrypt** (ADR-0014 `LlmApiKeyCipher` 재사용, [ADR-0016 §6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 다음 slice. 본 service 는 builder 와 동일하게 **이미 복호화된 평문 token** 을 인자로 받는다 (cipher 주입/호출 0).
- **GithubModule (`github.module.ts`) NestJS wiring** + AppModule 등록 — 본 service 는 `@Injectable` class 만 박제. module provider 등록 / instance sub-config provider / AppModule import 는 wiring slice 책임.
- **instance sub-config 의 실 설정 source** (env / DB config 로딩 + instance key 라우팅) — config layer 책임. 본 service 는 host/token 을 인자로만 받음 (단일 instance 기준 dispatch).
- **PermissionDeniedRecord entity 의 실 persistence / schema** ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md) scope 외) — 본 slice 는 emitter port 호출 (default no-op) 까지만. 실 entity + user/admin audience 분리 (REQ-044/REQ-016) 는 별도 entity task.
- **instance/repo 단위 skip-and-continue 의 실제 loop 제어** — 본 service 는 도메인 error throw 까지만. 권한 누락 instance/repo 를 skip 하고 나머지를 계속하는 제어는 상위 수집 orchestrator (후속 도메인 task) 책임.
- **GitHub Issue 평가 (R-30/REQ-014) 도메인 로직** — 별도 milestone task.
- **rate-limit backoff/Retry-After 구체 구현** ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 본 slice 는 429 → rate-limited 매핑 위상만. 실 backoff/재시도는 후속.
- **ConfluenceAdapter** — milestone-3 Confluence 측.
- **실 GitHub token / live 네트워크 호출** — §5 credential 게이트 (후속 live-run task, 미승인 deferred).
- **ADR-0016 PROPOSED → ACCEPTED 전이** — milestone-3 service chain (wiring 포함) 머지 후 별도 direct 한 줄 갱신.

## Suggested Sub-agents

`implementer → tester`. **architect 불요** — [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 transport 계약 (내장 fetch 주입 / non-2xx 도메인 매핑 표 / 4xx→PermissionDeniedEvent emit 위상 / service 경계) 을 이미 확정했으므로 새 architecture 결정 / 새 ADR 0. implementer 는 ADR-0016 §1/§4/§6 + [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 의 `FetchLike` 주입 + `!response.ok` 분기 패턴을 mirror (단 GitHub 도메인 status 분기로 확장).

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 append)
