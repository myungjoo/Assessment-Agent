---
id: T-0190
title: ConfluenceAdapter 실 fetch round-trip 을 local stub 서버 smoke 로 검증
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044, REQ-059]
dependsOn: []
estimatedDiff: 190
estimatedFiles: 1
created: 2026-06-03
completedAt: 2026-06-03T14:36:44+09:00
prNumber: 172
reviewRounds: 1
mergedAs: 7612c10
plannerNote: P4 milestone-3 Confluence chain row6 — T-0182 GitHub smoke mirror, 내장 http stub 로 실 fetch transport+_links.next pagination 검증(dep0/credential0/§5 미발화)
---

# T-0190 — ConfluenceAdapter 실 fetch round-trip 을 local stub 서버 smoke 로 검증

## Why

P4 milestone-3 Confluence chain (request-builder → token JIT decrypt → adapter dispatch → `_links.next` pagination → SpaceTraversalService) 은 전부 main 에 머지됐고 unit 수준으로 검증돼 있다. 그러나 기존 unit spec (`src/confluence/confluence-adapter.service.spec.ts`) 은 `ConfluenceFetchLike` 를 jest mock 으로 **대체**하므로 실제 transport 배선 (auth header 직렬화 · base URL + path 조립 · non-2xx 실수신 · JSON 파싱 · **응답 body `_links.next` cursor pagination**) 을 통과시키지 못한다.

[ADR-0018 §6](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 4단 경계의 transport 잔여 risk 를 닫기 위해, Q-0017 decision 제약 (2) 의 "(선택) 로컬 stub round-trip smoke" 를 mirror 한다 — Node 내장 `http.createServer` stub 서버에 `ConfluenceAdapter` 가 **실 `globalThis.fetch`** 로 end-to-end 도달하는 경로를 검증한다. GitHub 측 T-0182 (`test/smoke/github-adapter-roundtrip.smoke-spec.ts`) 와 동형이되, **결정적 차이는 pagination cursor 가 Link header 가 아니라 응답 body `_links.next` 에 실린다는 점**이다 (ADR-0018 §5). 새 외부 dependency 0 / 실 credential 0 / 실 Confluence endpoint 0 — CLAUDE.md §5 미발화로 Confluence chain 의 transport 잔여 risk 를 closeout 한다.

## Required Reading

- `test/smoke/github-adapter-roundtrip.smoke-spec.ts` — mirror 할 reference 패턴 (내장 http stub + ephemeral 포트(0) + `beforeAll` listen / `afterAll` close + captured request 검증 + happy/error/pagination/negative). **단, GitHub 의 Link-header pagination 검증을 Confluence 의 body `_links.next` 로 바꿔야 함**.
- `test/smoke/llm-gateway-roundtrip.smoke-spec.ts` — 동일 stub 패턴의 또 다른 reference (CapturedRequest 컨테이너 + route 별 status 토글 + `node:http` import 형태).
- `src/confluence/confluence-adapter.service.ts` — 검증 대상. `ConfluenceAdapter` 의 `@Optional() fetchFn = globalThis.fetch as ConfluenceFetchLike`, `request(input)` 단일 요청, `requestAllPages(input)` body `_links.next` 순회, `ConfluenceDomainError`(kind: permission-denied/not-found/rate-limited/transient/domain-error + status), `PermissionDeniedEmitter` / `NO_OP_PERMISSION_DENIED_EMITTER` / `PartialCollectionEmitter` 주입 port. **중요: `ConfluenceFetchLike` response surface 는 `{ ok, status, json }` 만 — `headers` 없음.** `requestAllPages` 는 첫 page 에 `start=0` + `limit=CONFLUENCE_MAX_LIMIT(100)` query 를 싣고, 이후 page 는 `parseNextCursor` 가 body `_links.next` 에서 추출한 절대/relative URL 을 그대로 fetch 하며, 응답 body 의 `results[]` 를 flatten 누적한다.
- `src/confluence/confluence-request.builder.ts` — `buildConfluenceRequest` 가 조립하는 `{ url, headers }` 형태: `url = 정규화된 baseUrl + 단일 slash + path (+ query)`, headers = `Authorization` (authUser non-empty → `Basic base64(authUser:token)`, authUser null/빈 → `Bearer <token>`) + `Accept: application/json`. smoke 의 `baseUrl` 인자는 stub 의 `http://localhost:<port>` 로 향하게 구성.
- `test/jest-smoke.json` — `.smoke-spec.ts` suffix 자동 픽업 확인 (CI/jest 설정 수정 불요).

## Acceptance Criteria

- [ ] `test/smoke/confluence-adapter-roundtrip.smoke-spec.ts` 신설 — 내장 `node:http` `createServer` 로 stub 서버를 ephemeral 포트(0)에 `beforeAll` 에서 listen, `afterAll` 에서 close (누수 0, 둘 다 await). 새 외부 dependency 0 / 실 credential 0 / 실 Confluence endpoint 0 (모든 통신 localhost stub). production code(`src/confluence/*`) 변경 0.
- [ ] **happy-path test 1+** — `ConfluenceAdapter.request()` 가 default `globalThis.fetch` (fetchFn 미주입, 실 생성자) 로 stub 에 실 도달하고, stub 이 수신한 request 의 method(GET) · path · headers (`authorization` 이 stub 에 도달한 형태 — Cloud Basic 케이스면 `Basic <base64>` 로 시작, `accept` == `application/json`) 를 captured request 로 검증. 반환 body 가 stub 고정 JSON 응답과 일치.
- [ ] **error path test 1+** — stub 이 non-2xx(예: 403)를 실제 wire 로 반환하면 실 fetch 가 `response.ok === false` 를 실수신하고 `ConfluenceAdapter` 가 `ConfluenceDomainError` (kind `permission-denied`, status 403) 를 throw + 주입한 `PermissionDeniedEmitter.emit` 이 `{ baseUrl, path, status: 403 }` payload 로 1 회 호출됨을 검증.
- [ ] **flow / 분기 cover (pagination — 본 chain 의 결정적 차이)** — `requestAllPages()` 가 body `_links.next` cursor 를 실 wire 로 순회함을 검증: stub 이 첫 응답 body 에 `{ results: [...], _links: { next: "<2번째 page 의 relative path 또는 절대 URL>" } }` 를 싣고, 2번째 응답 body 엔 `_links.next` 부재(또는 `_links` 없음)로 응답하면, `requestAllPages()` 가 실 fetch 로 2 page 를 순회해 양 page 의 `results[]` 항목을 flatten 누적함을 검증. stub 이 2번째 요청을 첫 page 와 다른 URL/path 로 실수신했는지(opaque next URL 추종)도 captured 로 확인.
- [ ] **negative cases 충분 cover (각 1+, 매핑 분기마다)** — 최소 3 종 이상의 예외 경로를 stub 으로 실수신시켜 각 `ConfluenceDomainError.kind` 매핑을 검증:
  - (1) 위 non-2xx 403 → `permission-denied` + emit (error path 항목과 겸할 수 있음).
  - (2) 404 → `not-found` (emit 없음 — 404 는 `mapNon2xx` 에서 emit 호출 안 함을 함께 assert).
  - (3) 5xx(예: 500) → `transient`, **또는** 2xx 인데 malformed JSON(`res.end("not-json")` 로 `json()` reject) → `domain-error`, 중 1+. 단일 negative 만으로 부족 — 매핑 분기마다 cover.
- [ ] token 평문(Cloud Basic base64 / Server Bearer PAT)이 `ConfluenceDomainError.message` / 직렬화 / emit payload 어디에도 노출되지 않음을 1 assertion 으로 확인 (CLAUDE.md §9, ADR-0018 §3). (예: throw 된 error 의 message 와 emit payload 를 JSON.stringify 한 결과에 fixture token 평문 substring 이 없음을 assert.)
- [ ] `pnpm test:smoke` 통과 (본 신규 smoke 포함 전 smoke green).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 production code 무변경(smoke spec 만 추가)이라 coverage 임계 영향 0 이어야 하나, tester 가 실행 결과로 확인.

## Out of Scope

- production code(`src/confluence/*`) 변경 금지 — smoke spec 1 파일만 추가. 만약 adapter 가 stub 도달에 실패하면 결함이므로 follow-up patch task 로 분리(본 task 에서 src 수정 금지).
- 실 Confluence token / 실 네트워크 / live endpoint 통합 — chain row9, Q-0017 deferred(§5 credential 게이트). 본 smoke 는 localhost stub 만.
- 새 외부 dependency 추가 금지 (nock/axios/node-fetch 등 — Q-0017 제약 (1), 내장 `node:http` 만).
- `ConfluenceSpaceTraversalService` 의 SPACE allowlist 순회 / skip-and-continue smoke — 본 task 는 `ConfluenceAdapter` 단일 instance transport round-trip 만 (service layer 의 다중 SPACE loop 는 unit 으로 이미 cover, smoke 확장은 별도 후속).
- `CONFLUENCE_MAX_PAGES` safety cap 도달 → `PartialCollectionEvent` emit 의 stub 검증 (100 page wire round-trip 은 smoke 로 비현실적 — unit spec 책임). 본 smoke 는 2 page pagination 까지만.
- rate-limited(429) backoff / Retry-After 구체 검증 — 후속 slice 책임 (429 매핑 자체는 unit 에서 cover).
- doc-sync (modules.md / p4-implementation-plan.md / ADR-0018 §6 정합) — chain row7, 별도 direct doc task.
- e2e(`test/e2e/`) 로의 확장 — 본 task 는 smoke 레벨만.

## Suggested Sub-agents

`tester` (smoke spec 작성 + 실행) → 필요 시 `implementer`. production code 무변경이라 implementer 비호출 가능 — tester 가 spec 작성 + `pnpm test:smoke` / `lint` / `build` / `test:cov` 검증. stub 이 도달 실패해 src 결함이 드러나면 본 task 에서 고치지 말고 Follow-ups 에 patch task 후보로 기록.

## Follow-ups

- (row7) doc-sync — `docs/architecture/modules.md` ConfluenceModule row + `docs/architecture/p4-implementation-plan.md` 에 SpaceTraversalService + roundtrip smoke 박제 + ADR-0018 §6 4단 경계 완결 반영(direct). T-0190 merge 후 우선 후보.
- (row8) PermissionDeniedRecord entity — Prisma model + migration + repository + 4xx event 영속화 + user/admin audience 분리(REQ-016). §5 DB schema 게이트 — DO NOT queue.
- (row9) live-run — 실 Confluence token + 실 네트워크로 traversal 1회 검증. §5 credential 게이트 — DO NOT queue.
- (row10) ADR-0018 status → ACCEPTED — implementable rows(row6/row7) 완결 후 direct doc task.
- **SECURITY 후보(STATE loopSession 기록, T-0188 PR-170 reviewer MINOR)**: cross-host auth-leak — adapter 가 body `_links.next` / Link rel=next 를 instance base host 와 무관하게 따라가면 Authorization 헤더가 외부 host 로 유출 가능. GitHub+Confluence 양 adapter 공통 → 별도 ADR(same-host 제약 박제) + 양 adapter 가드 task 후보. 본 task scope 밖.
