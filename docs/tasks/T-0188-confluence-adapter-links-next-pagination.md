---
id: T-0188
title: ConfluenceAdapter `_links.next` body cursor pagination — 다중 page 순회로 list endpoint 전 page 수집
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044, REQ-059]
dependsOn: [T-0187]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 ConfluenceAdapter chain row4(ADR-0018 §5). request() 위 _links.next body cursor 순회 + CONFLUENCE_MAX_PAGES cap. dep0/schema0/credential0. R-112 backbone ×1.5.
prNumber: 170
mergedAs: ba23370
reviewRounds: 1
completedAt: 2026-06-03T13:17:34+09:00
---

# T-0188 — ConfluenceAdapter `_links.next` body cursor pagination — 다중 page 순회로 list endpoint 전 page 수집

## Why

P4 milestone-3 (Confluence adapter, [PLAN.md L83~84](../PLAN.md)) 의 **4차 vertical slice** 다. 사용자가 [Q-0017](../STATE.json) 으로 milestone-3 을 승인했고 ([ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) transport 계약 박제), chain row3 까지 — T-0184 (module wiring + env config parser), T-0185 (token JIT decrypt helper), T-0186 (순수 request-builder), T-0187 (`@Injectable ConfluenceAdapter.request()` 단일 dispatch + non-2xx 도메인 매핑 + 4xx PermissionDeniedEvent emit) — 가 merged 됐다. 본 slice 는 [ADR-0018 §5](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) (REST `_links.next` body cursor pagination) 를 구현한다 — Confluence list endpoint (`/content` 류) 응답 **body** 의 `_links.next` (relative 또는 absolute URL) 를 다음 page cursor 로 따라가며, cursor 부재 또는 `CONFLUENCE_MAX_PAGES` cap 도달 시까지 순회해 전 page 의 `results[]` 항목을 flatten 수집한다 (`start`/`limit` 보강 + per-page 최대화). 이는 이미 merged 된 `request()` 의 **순수 in-process 확장** 이다 — 새 infra / 새 config / 새 cipher 결정이 전혀 필요 없고 (dep 0 / schema 0 / credential 0 → [§5](../../CLAUDE.md) 미발화), mocked `ConfluenceFetchLike` 만으로 독립 검증된다 (실 네트워크 0 / 실 token 0). page body raw 가 아니라 page 단위 메타 항목을 enumerate 하므로 [ADR-0006](../decisions/ADR-0006-assessment-data-model.md) / REQ-059 raw 미저장 invariant 와 정합한다.

**GitHub 측 (T-0176) 와의 결정적 차이 — cursor 위치**: milestone-3 GitHub `requestAllPages` (T-0176) 는 RFC-5988 `Link` **header** (`rel="next"`) 로 paginate 한다. Confluence 는 cursor 가 응답 **body** 의 `_links.next` 에 실린다 ([ADR-0018 §5](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md)). 따라서 GitHub 의 *구조* (순회 loop / max-pages cap / flatten 누적 / opaque cursor 그대로 따라가기) 는 mirror 하되, *cursor 추출* 은 **파싱된 body 에서** `_links.next` 를 읽어 (header 가 아니라) base URL 과 정합 조립한다. 이 차이 때문에 `ConfluenceFetchLike` response surface 는 GitHub 의 `headers.get()` 을 요구하지 않으며 (현재 `{ ok, status, json }` 그대로 충분), 새 surface 추가 0.

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\decisions\ADR-0018-confluence-adapter-http-transport-contract.md` — THE 계약. 본 task 는 **Decision §5 (`_links.next` body cursor 채택 / `start`·`limit` 보강 / per-page 최대화 / `CONFLUENCE_MAX_PAGES` safety cap default 100 / cap 도달 시 partial 결과 + PermissionDeniedEvent 와 구분되는 별도 partial-collection event emit / cursor-opaque — Confluence 가 준 next URL 그대로 따름 / raw 미저장 invariant 정합) + §6 4단 경계의 3번 (`ConfluenceAdapter.requestAllPages` multi-page orchestration — `request` 를 반복 호출, 4xx throw 는 그대로 전파)** 만 구현. **§1/§3/§4 (fetch 주입 / auth 분기 / non-2xx 도메인 매핑 / emit) 는 T-0187 이 이미 제공 — 본 slice 는 그 `request()` 단일 dispatch 위에 순회 loop 를 얹을 뿐, status 매핑/emit 분기는 재구현하지 않고 재사용한다.** **`ConfluenceSpaceTraversalService` (§6 4단 경계 4번, SPACE allowlist 순회 + skip-and-continue) 는 OUT OF SCOPE (row5).**
- `C:\Users\myung\Assessment-Agent\src\confluence\confluence-adapter.service.ts` — 본 slice 가 확장할 3차 slice (T-0187). 이미 박제된 surface: `async request(input): Promise<unknown>` (단일 dispatch — `buildConfluenceRequest` → 주입 fetch → non-2xx → `ConfluenceDomainError` throw + 4xx emit → JSON parse), `ConfluenceFetchLike` (`{ ok, status, json }` — **headers 없음, body cursor 정합**), `ConfluenceDomainError` / `ConfluenceDomainErrorKind`, `PermissionDeniedEvent` / `PermissionDeniedEmitter` / `NO_OP_PERMISSION_DENIED_EMITTER`. 본 task 는 (a) 순수 cursor parser 함수 (파싱된 body 객체 → `_links.next` 절대 URL | null) 를 export 하고, (b) `request()` 의 fetch+status매핑+parse 흐름을 **공통 private helper 로 추출** (GitHub `fetchAndMap` mirror — 단 Confluence helper 는 cursor 를 body 에서 읽으려고 **파싱된 body 를 반환** 해야 함) 한 뒤 그 helper 를 재사용하는 **page 순회 메서드** (예: `requestAllPages(input): Promise<unknown[]>`) 를 추가한다. 단일 `request()` 의 외부 시그니처/동작은 보존 (helper 추출은 내부 refactor 라 기존 spec 이 회귀로 보증).
- `C:\Users\myung\Assessment-Agent\src\github\github-adapter.service.ts` — milestone-3 GitHub 측 직접 mirror reference (구조). `requestAllPages` (per-page 최대화 첫 query + opaque next URL 그대로 fetch + `GITHUB_MAX_PAGES` cap + `unknown[]` flatten) + `fetchAndMap` (fetch + status 매핑 + parse + next 추출을 한 곳에 묶은 private helper, `request()`/`requestAllPages()` 공유) + `parseNextLink` (순수 함수). **차이**: GitHub 는 `parseNextLink(response.headers.get("link"))` 로 header 에서, Confluence 는 파싱된 body 에서 `_links.next` 를 읽는다. 구조만 차용하고 cursor 추출 위치/형식은 ADR-0018 §5 를 따른다 (전체 정독 불요 — 순회/cap/flatten 골격만 참고).
- `C:\Users\myung\Assessment-Agent\src\confluence\confluence-adapter.service.spec.ts` — 확장할 colocated spec (T-0187, 489 lines). 기존 fixture `okResponse(json)` / `nonOkResponse(status)` / `cloudInput()` / `serverInput()` / `makeEmitter()` / `SECRET_TOKEN` sentinel 재사용. 본 task 는 `_links.next` 를 담은 body 를 돌려주는 fixture (예: `pagedResponse(results, nextHref)`) 를 추가해 multi-page 순회를 mock 한다 (header fixture 불요 — cursor 는 body 에 있음).
- `C:\Users\myung\Assessment-Agent\src\confluence\confluence-request.builder.ts` — `buildConfluenceRequest({baseUrl, authUser, token, path, query})` → `{url, headers}`. 본 순회는 첫 page 요청에 `start=0` + `limit=<MAX>` query 를 싣고, next page 는 Confluence 가 준 opaque next URL 을 그대로 fetch 한다 (`start` 직접 증가 금지 — ADR-0018 §5 cursor-opaque). relative `_links.next` 를 절대 URL 로 조립할 때 base URL (origin) 과 정합. 참고용 (전체 정독 불요).

## Acceptance Criteria

`src/confluence/confluence-adapter.service.ts` (기존 파일 확장 — 새 파일 생성 불요, 단 cursor parser 를 별도 모듈로 분리하고 싶으면 `confluence-next-cursor.ts` 1 파일 추가 허용; 5-파일 cap 내):

- [ ] **`CONFLUENCE_MAX_PAGES` 상수 export** (default `100`) + per-page 최대화 `limit` 상수 (예: `CONFLUENCE_MAX_LIMIT`, ADR-0018 §5 의 통상 `100`~`250` 중 단일 default) export. 둘 다 주석으로 ADR-0018 §5 근거 박제.
- [ ] **순수 cursor parser 함수 export** (예: `parseNextCursor(body: unknown, baseUrl: string): string | null`) — 파싱된 응답 body 객체에서 `_links.next` (relative path 또는 절대 URL) 를 추출해 **절대 URL** 로 정규화 반환. (a) relative (`/rest/api/content?...&start=25`) → base URL 의 origin 과 정합 조립한 절대 URL, (b) 절대 URL (`https://...`) → 그대로, (c) `_links` 부재 / `_links.next` 부재 / null / 비-객체 body → `null` (순회 종료). 부수효과 0 / 외부 의존 0 (Node 내장 `URL` 만) — [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) / `parseNextLink` 류 순수 함수.
- [ ] **`request()` 의 fetch+status매핑+parse 흐름을 공통 private helper 로 추출** (GitHub `fetchAndMap` mirror) — `request()` 와 `requestAllPages()` 가 non-2xx 매핑 / emit 분기 / JSON parse 를 중복 구현하지 않도록. helper 는 **파싱된 body 를 반환** 한다 (cursor 가 body 에 있으므로 — GitHub 처럼 next 를 header 에서 미리 뽑지 않고 body 를 호출처로 넘긴다). `request()` 의 외부 동작/시그니처는 불변 (기존 T-0187 spec 이 회귀로 보증).
- [ ] **page 순회 메서드 추가** (예: `async requestAllPages(input: ConfluenceRequestInput): Promise<unknown[]>`) — 첫 page 는 `start=0` + `limit=<CONFLUENCE_MAX_LIMIT>` query 를 싣고 fetch → 응답 body 의 `results[]` (array 가정) 항목을 누적 → `parseNextCursor(body, baseUrl)` 로 next 절대 URL 추출 → next 가 있고 cap 미도달이면 그 opaque URL 을 그대로 fetch (`start` 직접 증가 금지) → next 부재 또는 `CONFLUENCE_MAX_PAGES` 도달 시 종료. **전 page 의 `results[]` 항목을 단일 `unknown[]` 로 flatten 해 반환.**
  - [ ] `results[]` 가 array 면 flatten 누적, 비-array (방어적) 면 손실 없이 단일 항목 누적 (GitHub `Array.isArray(body)` 분기 mirror — 단 Confluence 는 `body.results` 를 본다).
  - [ ] non-2xx / fetch reject / malformed JSON 은 T-0187 의 도메인 매핑을 재사용한다 (status → `ConfluenceDomainError`, 4xx → `PermissionDeniedEvent` emit). 순회 중 어느 page 든 non-2xx 면 그 도메인 error 를 throw (부분 수집분 무시 — SPACE 단위 skip-and-continue 는 상위 `ConfluenceSpaceTraversalService` 책임, 본 slice 는 throw 까지만).
  - [ ] 단일-page 응답 (`_links.next` 부재) 은 1 회 fetch 후 종료 — 단일 page 의 `results[]` 만 반환.
- [ ] **`CONFLUENCE_MAX_PAGES` cap 도달 시 partial-collection 처리** — cap 도달 시 그때까지 수집분을 반환하고 순회 종료 (throw 아님 — 부분 수집은 유효). cap 도달은 [ADR-0018 §5](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 상 **PermissionDeniedEvent 와 구분되는 별도 partial-collection event** emit 후보다. 본 slice 의 구체 emit 메커니즘 형식은 ADR 이 후속 task 로 둘 수 있으므로, 최소한 cap 도달이 정상 종료 (error 아님) 임을 보장하고, partial-collection 신호 (별도 emit port 또는 cap-reached flag) 의 표현은 구현자가 ADR-0018 §5 와 정합하게 결정 (PermissionDeniedEmitter 를 재사용하지 말 것 — 권한 부족과 cap 은 다른 의미). Out of Scope 의 "별도 event 의 실 persistence" 와 구분.
- [ ] token 평문 (Basic base64 / Bearer PAT) 은 로그 / error message / 직렬화 / next URL 어디에도 노출 금지 ([CLAUDE.md §9](../../CLAUDE.md)) — 기존 `request()` 의 token 비노출 규약 유지. next URL 은 Confluence 가 준 path/query 만이라 token 미포함이지만, error 식별 정보는 원본 `input` 의 baseUrl/path 를 사용.

`src/confluence/confluence-adapter.service.spec.ts` (기존 colocated spec 확장 — 모두 주입 `ConfluenceFetchLike` mock, **실 네트워크 0 / 실 token 0**, §5 미발화. colocated 위치 유지 — 신규 `confluence-next-cursor.ts` 분리 시 그 colocated `confluence-next-cursor.spec.ts` 도 동반):

- [ ] **Happy path (multi-page)** — `_links: { next: "/rest/api/content?start=25&limit=25" }` 를 담은 page 1 body mock + next 없는 page 2 body mock → `requestAllPages(...)` 가 fetch 를 정확히 2 회 호출하고 두 page 의 `results[]` 를 flatten 한 배열을 반환함을 검증. 첫 호출 url 에 `start=0` + `limit` query 가 실리고, 두 번째 호출은 page 1 의 next URL (절대 정규화 결과) 을 그대로 사용함을 assert.
- [ ] **Happy path (single-page)** — `_links.next` 부재 (또는 `_links` 자체 부재) 응답 → fetch 1 회만 호출되고 단일 page `results[]` 만 반환됨을 검증 (순회 종료 분기).
- [ ] **`parseNextCursor` 순수 함수 happy/branch** — 각 분기 1+ test: (a) relative `_links.next` → base origin 과 정합 절대 URL 반환, (b) 절대 `_links.next` → 그대로, (c) `_links.next` 부재 → `null`, (d) `_links` 부재 → `null`, (e) null / 비-객체 body → `null`.
- [ ] **Error path (negative cases 충분 cover — 단일 negative 금지)** — 각 방어 분기마다 1+ test: (1) page 1 은 2xx 인데 page 2 (next 따라간 요청) 가 403 → `permission-denied` throw + emitter 호출됨 (순회 중 권한 거부), (2) page 1 자체가 500 → `transient` throw, (3) 순회 중 fetch reject → `transient` (status undefined) throw, (4) page 응답 JSON 파싱 실패 → `domain-error` throw (T-0187 동형 매핑 재사용), (5) **404 mid-pagination** → `not-found` throw, (6) **429 mid-pagination** → `rate-limited` throw. 각 throw 의 `ConfluenceDomainError` kind + status assert.
- [ ] **negative — malformed `_links` 형태** — `_links` 가 객체가 아닌 값 (string / number / array) 이거나 `_links.next` 가 비-string (객체 / number) 인 응답에서 `parseNextCursor` 가 `null` 반환 (순회 안전 종료, throw 0) 검증 1+.
- [ ] **negative — cap-reached partial** — `_links.next` 가 매 page 계속 존재하는 (무한 cursor) mock 으로 `CONFLUENCE_MAX_PAGES` 도달까지 순회시켜, (a) fetch 호출 횟수가 정확히 `CONFLUENCE_MAX_PAGES` 회, (b) throw 0 (정상 종료), (c) 부분 수집분 (`MAX_PAGES × per-page` 항목) 반환, (d) partial-collection 신호가 발생하되 PermissionDeniedEmitter 는 호출되지 않음 (권한 부족과 cap 구분) 을 검증.
- [ ] **PermissionDeniedEvent emit 분기 정확성** — 순회 중 401/403 시에만 emitter 가 호출되고, 정상 다중-page 순회 / 404 / 429 / 5xx / cap-reached 경로에서는 PermissionDeniedEmitter 가 **호출되지 않음** 을 mock 으로 검증. emit payload 에 baseUrl/path/status 식별 정보 포함, **token 평문 미포함** assert.
- [ ] **token 비노출 negative** — 순회 중 어느 단계의 throw error message / emit 직렬화 / 반환 배열에도 `SECRET_TOKEN` sentinel 이 (Bearer 평문 / Basic base64 둘 다) 새어나오지 않음 검증 1+ ([CLAUDE.md §9](../../CLAUDE.md)).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — tester 가 확인).
- [ ] CI 의 unit + smoke + e2e 전부 green (R-113 — 실 token 0 / 실 네트워크 0 이므로 §5 미발화).

## Out of Scope

다음은 본 slice 가 **건드리지 않는다** (Follow-up 또는 후속 chain row 로 분리 — diff 작게 유지):

- **`ConfluenceSpaceTraversalService` (SPACE allowlist 순회 + 4xx catch skip-and-continue)** — ADR-0018 §6 4단 경계 4번, chain **row5** (별도 task). 본 `requestAllPages` 는 단일 instance 의 단일 list endpoint 전 page 수집 + 권한 거부 시 throw 까지만. 권한 누락 SPACE 를 skip 하고 나머지를 계속하는 상위 수집 제어는 service layer 책임.
- **round-trip stub smoke** (내장 `http.createServer` Confluence stub 으로 실 globalThis.fetch round-trip 검증) — ADR-0018 chain **row6** (별도 task, T-0182 GitHub mirror). 본 task 는 mocked `ConfluenceFetchLike` unit 만.
- **PermissionDeniedRecord / partial-collection event entity 의 실 persistence / schema** — ADR-0018 chain **row8**, [§5](../../CLAUDE.md) DB schema migration 게이트 (별도 task). 본 slice 는 cap 도달이 정상 종료임만 보장하고, partial-collection 신호의 표현 (in-memory port / flag) 까지만 — Prisma model / migration 0.
- **token JIT decrypt** ([ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) cipher 재사용, T-0185 `confluence-token-decrypt.ts`) — 본 순회는 builder/`request()` 와 동일하게 **이미 복호화된 평문 token** 을 담은 `ConfluenceRequestInput` 을 인자로 받는다 (cipher 주입/호출 0). 실 decrypt wire 는 instance config 순회 wiring 책임 (row5).
- **instance sub-config 의 실 설정 source / SPACE allowlist 라우팅** — config layer 책임 (T-0184 wiring + row5). 본 task 는 baseUrl/authUser/token/path 를 인자로만 받음.
- **rate-limit backoff / `Retry-After` 구체 처리** ([ADR-0018 §4/§5](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md)) — 본 slice 는 429 → rate-limited 매핑 (T-0187 재사용) 위상만. 순회 중 backoff/재시도는 후속.
- **endpoint 별 응답 shape 의 typed parser** (page 메타 id/spaceKey/title/version 추출) — 도메인 평가 task 책임. 본 transport slice 는 `results[]` 항목을 `unknown` 으로 flatten 까지만 (도메인 해석 0).
- **`_links.next` 의 size-기반 fallback** ([ADR-0018 §5 trade-off 4](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) — 일부 endpoint 가 cursor 대신 `start`+`size` 비교로 다음 page 추론) — 본 slice 는 `_links.next` cursor 우선 contract 만. size fallback 은 endpoint 별 보강 (후속).
- **실 Confluence token / live 네트워크 호출** — [§5](../../CLAUDE.md) credential 게이트 (후속 live-run task, 미승인 deferred).
- **ADR-0018 PROPOSED → ACCEPTED 전이** — Confluence scaffold chain 머지 후 별도 direct 한 줄 갱신 (chain row10).

## Suggested Sub-agents

`implementer → tester`. **architect 불요** — [ADR-0018 §5/§6](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 이 pagination 계약 (`_links.next` body cursor opaque 순회 / `start`·`limit` 보강 / per-page 최대화 / `CONFLUENCE_MAX_PAGES` cap + partial-collection / 순수 cursor parser + service loop 경계) 을 이미 확정했으므로 새 architecture 결정 / 새 ADR 0. implementer 는 ADR-0018 §5 + 이미 merged 된 [confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) 의 `request()` / `ConfluenceFetchLike` (body cursor 정합 surface) 를 재사용하고, GitHub [github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 `requestAllPages`/`fetchAndMap` 골격을 mirror 하되 cursor 를 **body `_links.next`** 에서 (header 아님) 읽도록 reframe 한다 (status 매핑/emit 분기 재구현 금지 — `request()` 흐름 helper 추출 재사용).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
