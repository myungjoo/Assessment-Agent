---
id: T-0176
title: GithubAdapter Link rel=next pagination — 다중 page 순회로 list endpoint 전 page 수집
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-059]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-06-02
completedAt: 2026-06-03T00:18:55+09:00
prNumber: 160
mergeCommit: ff864d3
reviewRounds: 2
actualDiff: "code +581/-23 (prod +153/-23 + spec +428) — sizeExempt"
plannerNote: P4 milestone-3 GithubAdapter 3차 slice(ADR-0016 §5). request() 위 순수 Link 파서 + paginate loop. dep 0/§5 미발화. R-112 backbone ×1.5. module·JIT decrypt defer.
---

# T-0176 — GithubAdapter Link rel=next pagination — 다중 page 순회로 list endpoint 전 page 수집

## Why

P4 milestone-3 (GitHub adapter, [PLAN.md L81](../PLAN.md)) 의 **3차 vertical slice** 다. 사용자가 [Q-0017](../STATE.json) 으로 milestone-3 을 승인했고 ([ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) transport 계약 박제), 1차 (T-0174, PR #158, 순수 request-builder) + 2차 (T-0175, PR #159, `@Injectable GithubAdapter.request()` 단일 dispatch + non-2xx 도메인 매핑) 가 merged 됐다. 본 slice 는 [ADR-0016 §5](../decisions/ADR-0016-github-adapter-http-transport-contract.md) (REST `Link` header `rel="next"` cursoring) 를 구현 — GitHub list endpoint (commits / issues / pulls) 응답의 `Link` header 에서 `rel="next"` URL 을 추출해 **next 부재 시까지 순회** 하며 전 page 의 항목을 수집한다 (per_page 최대화). 이는 이미 merged 된 `request()` 의 **순수 확장** 이다 — `FetchLike` response surface 에 `headers.get(name)` 이 이미 박제돼 있어 (T-0175) 새 infra / 새 config / 새 cipher 결정이 전혀 필요 없고, mocked fetch 만으로 독립 검증된다 (실 네트워크 0 / 실 token 0 → §5 미발화). raw 본문이 아니라 page 단위 메타 항목을 enumerate 하므로 [ADR-0006](../decisions/ADR-0006-assessment-data-model.md) / REQ-059 raw 미저장 invariant 와 정합한다. GithubModule wiring / token JIT decrypt 는 본 slice 밖 (Out of Scope — 후속 slice, 둘 다 선행 config/env 결정이 필요해 본 pure-extension 보다 prerequisite 가 덜 깔끔하다).

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\decisions\ADR-0016-github-adapter-http-transport-contract.md` — THE 계약. 본 task 는 **Decision §5 (REST pagination — `Link` header `rel="next"` opaque cursor 순회, per_page 최대화 현행 `100`, page 번호 직접 증가 금지, raw 미저장 invariant 정합) + §6 (순수 parser 함수 / service orchestration 경계 — `Link` parser 는 순수 함수, 순회 loop 는 service)** 만 구현. **§1/§4 (fetch 주입 / non-2xx 도메인 매핑) 는 T-0175 가 이미 제공 — 본 slice 는 그 `request()` 단일 dispatch 위에 순회 loop 를 얹을 뿐, status 매핑/emit 분기는 재구현하지 않고 재사용한다.** **token JIT decrypt (§6 후반) / GithubModule wiring 은 OUT OF SCOPE.**
- `C:\Users\myung\Assessment-Agent\src\github\github-adapter.service.ts` — 본 slice 가 확장할 2차 slice. 이미 박제된 surface: `request(input): Promise<unknown>` (단일 dispatch + non-2xx 매핑), `FetchLike` (response surface 에 `headers: { get(name): string | null }` 포함 — Link 를 읽을 수 있는 surface 이미 존재), `GithubDomainError` / `GithubRequestInput`. 본 task 는 (a) 순수 `Link` parser 함수 (`Link` header 문자열 → `rel="next"` URL | null) 를 export 하고, (b) `request()` 를 재사용하는 **page 순회 메서드** (예: `requestAllPages(input): Promise<unknown[]>`) 를 추가한다. 단일 `request()` 의 status 매핑/emit 은 그대로 활용하되, 순회 메서드는 매 page 의 `Link` header 를 읽어 next URL 을 따라간다.
- `C:\Users\myung\Assessment-Agent\src\github\github-adapter.service.spec.ts` — 확장할 colocated spec. 기존 fixture `okResponse(json)` / `nonOkResponse(status)` 는 `headers: { get: () => null }` 을 반환 — 본 task 는 `Link` header 를 돌려주는 fixture (예: `pagedResponse(json, linkHeader)`) 를 추가해 multi-page 순회를 mock 한다. `input()` fixture + `makeEmitter()` 패턴 재사용.
- `C:\Users\myung\Assessment-Agent\src\github\github-request.builder.ts` — `buildGithubRequest({host, token, path, query})` → `{url, headers}`. 본 순회는 첫 page 요청에 `per_page=100` query 를 싣고, next page 는 GitHub 이 준 opaque next URL 을 그대로 fetch 한다 (page 번호 직접 증가 금지 — ADR-0016 §5). 참고용 (전체 정독 불요).
- `C:\Users\myung\Assessment-Agent\docs\decisions\ADR-0006-assessment-data-model.md` — raw 미저장 invariant (REQ-059). 순회 수집 단위는 메타 enumerate 라 raw 본문 영속 0 — 정합 확인용 (전체 정독 불요).

## Acceptance Criteria

`src/github/github-adapter.service.ts` (기존 파일 확장 — 새 파일 생성 불요):

- [ ] 순수 `Link` parser 함수 export (예: `parseNextLink(linkHeader: string | null): string | null`) — `Link` header 문자열 (예: `<https://api.github.com/...&page=2>; rel="next", <...>; rel="last"`) 에서 `rel="next"` 대상 URL 을 추출. `rel="next"` 가 없으면 (마지막 page) `null` 반환. `null` / 빈 문자열 입력은 `null` 반환. 부수효과 0 / 외부 의존 0 — [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) 류 순수 함수.
- [ ] page 순회 메서드 추가 (예: `requestAllPages(input: GithubRequestInput): Promise<unknown[]>`) — 첫 page 는 `per_page=100` (또는 ADR-0016 §5 의 현행 GitHub 허용 최대값 상수) query 를 싣고 fetch → 응답 JSON (array 가정) 을 수집 → 응답 `Link` header 를 `parseNextLink` 로 파싱 → next URL 이 있으면 그 opaque URL 을 그대로 fetch (page 번호 직접 증가 금지) → next 부재 시 종료. **전 page 의 항목을 단일 `unknown[]` 로 flatten 해 반환.**
  - [ ] non-2xx / fetch reject / malformed JSON 은 T-0175 의 도메인 매핑을 재사용한다 (status → `GithubDomainError`, 4xx → `PermissionDeniedEvent` emit). 순회 중 어느 page 든 non-2xx 면 그 도메인 error 를 throw (부분 수집분 무시 — instance/repo 단위 skip-and-continue 는 상위 orchestrator 책임, 본 slice 는 throw 까지만).
  - [ ] 단일-page 응답 (`Link` header 부재 또는 `rel="next"` 없음) 은 1 회 fetch 후 종료 — 단일 page 만 반환.
- [ ] token 평문은 로그 / error message / 직렬화 어디에도 노출 금지 ([CLAUDE.md §9](../../CLAUDE.md)) — 기존 `request()` 의 token 비노출 규약 유지.

`src/github/github-adapter.service.spec.ts` (기존 colocated spec 확장 — 모두 주입 `FetchLike` mock, **실 네트워크 0 / 실 token 0**, §5 미발화):

- [ ] **Happy path** — `Link: <...page=2>; rel="next"` 를 돌려주는 page 1 mock + next 없는 page 2 mock → `requestAllPages(...)` 가 fetch 를 정확히 2 회 호출하고 두 page 의 항목을 flatten 한 배열을 반환함을 검증. 첫 호출 url 에 `per_page=100` query 가 실리고, 두 번째 호출은 page 1 의 next URL 을 그대로 사용함을 assert.
- [ ] **`parseNextLink` 순수 함수 happy/branch** — `rel="next"` 존재 시 URL 추출 / `rel="next"` 부재 (last/prev 만) 시 `null` / 다중 rel 혼재 시 next 만 정확 추출 / 따옴표·공백 변형 (`rel=next` vs `rel="next"`) 각 1+ test.
- [ ] **단일 page 분기** — `Link` header 가 `null` (header 부재) 인 응답 → fetch 1 회만 호출되고 단일 page 항목만 반환됨을 검증 (순회 종료 분기).
- [ ] **Error path (negative cases 충분 cover — 단일 negative 금지)** — 각 방어 분기마다 1+ test: (1) page 1 은 2xx 인데 page 2 (next 따라간 요청) 가 403 → `permission-denied` throw + emitter 호출됨 (순회 중 권한 거부), (2) page 1 자체가 500 → `upstream-error` throw, (3) 순회 중 fetch reject → `transport-error` throw, (4) page 응답 JSON 파싱 실패 → `upstream-error` throw (또는 T-0175 의 동형 매핑). 각 throw 의 `GithubDomainError` kind + status assert.
- [ ] **PermissionDeniedEvent emit 분기 정확성** — 순회 중 401/403 시에만 emitter 가 호출되고, 정상 다중-page 순회 / 404 / 429 / 5xx 경로에서는 emitter 가 **호출되지 않음** 을 mock 으로 검증. emit payload 에 host/path 등 식별 정보 포함, **token 평문 미포함** assert.
- [ ] **token 비노출 negative** — 순회 중 어느 단계의 throw error message / emit 직렬화에도 `SECRET_TOKEN` sentinel 이 새어나오지 않음 검증 1+ ([CLAUDE.md §9](../../CLAUDE.md)).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — tester 가 확인).
- [ ] CI 의 unit + smoke + e2e 전부 green (R-113 — 실 token 0 / 실 네트워크 0 이므로 §5 미발화).

## Out of Scope

다음은 본 slice 가 **건드리지 않는다** (Follow-up 으로 분리 — diff 작게 유지):

- **GithubModule (`github.module.ts`) NestJS wiring** + AppModule 등록 + instance sub-config provider — 다음 slice. 본 task 는 기존 `@Injectable GithubAdapter` class 에 메서드/함수만 추가. (instance sub-config 의 설정 source = env vs DB 결정이 선행 필요 — 본 pure-extension 보다 prerequisite 가 덜 깔끔해 분리.)
- **token JIT decrypt** ([ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) `LlmApiKeyCipher` 재사용, [ADR-0016 §6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 다음 slice. 본 순회는 builder/`request()` 와 동일하게 **이미 복호화된 평문 token** 을 인자로 받는다 (cipher 주입/호출 0, env 재사용 결정 미수반).
- **instance sub-config 의 실 설정 source** (env / DB config 로딩 + instance key 라우팅) — config layer 책임. 본 task 는 host/token 을 인자로만 받음.
- **PermissionDeniedRecord entity 의 실 persistence / schema** ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md) scope 외) — 본 slice 는 기존 emitter port 호출 (default no-op) 까지만 재사용. 실 entity 는 별도 entity task.
- **instance/repo 단위 skip-and-continue 의 실제 loop 제어** — 본 순회 메서드는 단일 instance 의 단일 list endpoint 전 page 수집까지만. 권한 누락 instance/repo 를 skip 하고 나머지를 계속하는 상위 수집 제어는 후속 orchestrator 책임.
- **rate-limit backoff / `Retry-After` / `X-RateLimit-*` 구체 처리** ([ADR-0016 §4/§5](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 본 slice 는 429 → rate-limited 매핑 (T-0175 재사용) 위상만. 순회 중 backoff/재시도는 후속.
- **`since` 파라미터 증분 수집** (변경분만) — ADR-0016 §5 가 코드 task 성능 책임으로 둔 부분. 본 slice 는 전 page full 순회만.
- **GitHub Issue / commit / PR 도메인 평가 로직** (R-30/REQ-014 등) — 별도 milestone task. 본 slice 는 transport 의 page 수집까지만 (수집된 메타의 도메인 해석 0).
- **ConfluenceAdapter** — milestone-3 Confluence 측.
- **실 GitHub token / live 네트워크 호출** — §5 credential 게이트 (후속 live-run task, 미승인 deferred).
- **ADR-0016 PROPOSED → ACCEPTED 전이** — milestone-3 service chain (wiring 포함) 머지 후 별도 direct 한 줄 갱신.

## Suggested Sub-agents

`implementer → tester`. **architect 불요** — [ADR-0016 §5/§6](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 pagination 계약 (`Link` rel=next opaque cursor 순회 / per_page 최대화 / page 번호 직접 증가 금지 / 순수 parser + service loop 경계) 을 이미 확정했으므로 새 architecture 결정 / 새 ADR 0. implementer 는 ADR-0016 §5 + 이미 merged 된 [github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 `request()` / `FetchLike` (headers.get surface) 를 재사용해 순수 `Link` parser + 순회 loop 만 추가한다 (status 매핑/emit 분기 재구현 금지 — `request()` 재사용).

## Follow-ups

- (tester, 관찰) `parseNextLink` 정규식 `/rel\s*=\s*["']?\s*next\s*["']?/i` 은 `next` 뒤 단어 경계를 강제하지 않아 `rel="nextpage"` 의 prefix `next` 에 매칭한다 (spec 에 현행 동작으로 박제함). GitHub 실 응답은 `rel="next"` 정확값만 주므로 실사용 영향 0 이나, 향후 robust 화 시 closing 따옴표/단어 경계 강화 검토 (별도 nit task — 본 slice cap 내 처리 불요).
