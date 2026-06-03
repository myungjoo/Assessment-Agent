---
id: T-0195
title: ConfluenceAdapter same-host cursor 가드 구현 (cross-host Authorization leak 차단)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-059]
dependsOn: [T-0193, T-0194]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0019 chain 2행 Confluence 가드. requestAllPages parseNextCursor 결과 fetch 직전 host-check + cross-host kind + 상대-cursor same-host PASS. R-112 backbone ×1.5, Node URL dep0.
---

# T-0195 — ConfluenceAdapter same-host cursor 가드 구현 (cross-host Authorization leak 차단)

## Why

[ADR-0019](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) 가 박제한 same-host 제약 정책을 **Confluence adapter 에 실 구현**한다 (ADR Decision 끝 "후속 task chain" 표의 2행). GitHub 측 가드는 [T-0194](T-0194-github-adapter-same-host-guard.md) 에서 머지됐고 (`isSameHost` 순수 함수 + `cross-host-cursor` 분류 + `requestAllPages` host-check 게이트, merge `4c62edc`), 본 task 는 그 chain 의 2행을 닫는다. 현재 [`requestAllPages`](../../src/confluence/confluence-adapter.service.ts) (L267~322) 는 응답 body `_links.next` 가 준 cursor 를 `parseNextCursor` (L67~96) 로 절대 URL 로 정규화한 뒤, 첫 page 의 `headers` (Cloud Basic / Server Bearer token 포함) 로 그대로 fetch 한다 (L290) — host 검증이 없어, `_links.next` 가 **절대 cross-host URL** 이면 (`parseNextCursor` 의 `new URL(next, baseUrl)` 가 절대 URL 시 base 무시 — L92) `Authorization` 토큰이 그 foreign host 로 **leak** 된다. 이는 README REQ-044 (instance 별 권한 분리) 와 [CLAUDE.md §9](../../CLAUDE.md) (secret 비노출) 를 transport 계층에서 위반하는 결함이다.

**GitHub 와의 결정적 차이** — Confluence `_links.next` 는 **relative path** (예: `/rest/api/content?...&start=25`) 일 수 있고, `parseNextCursor` 가 이를 `baseUrl` origin 으로 조립해 **same-origin 절대 URL** 로 만든다. 따라서 relative same-host cursor 는 host-check 를 **통과(PASS)** 해야 한다 (정상 pagination 비파괴). 차단 대상은 `_links.next` 가 **절대 cross-host URL** 일 때뿐이다. ADR-0019 가 Node 내장 `URL` 만 쓰도록 박제했으므로 새 외부 dependency 0 (§5 게이트 미발화).

## Required Reading

- [src/confluence/confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) — `requestAllPages` (L267~322, `parseNextCursor` 산출 next URL 을 다음 iteration 에서 동일 `headers` 로 fetch — leak vector) / `parseNextCursor` (L67~96, 순수 parser, 절대 URL 은 base 무시 그대로·relative 는 base origin 조립 — **시그니처·동작 변경 금지**) / `ConfluenceDomainError` + `ConfluenceDomainErrorKind` (L120~144) / `fetchAndMap` (L331~369, 동일 headers fetch + token 비노출 message 패턴) / `mapNon2xx` (L377~420, baseUrl/path/status-only message). 핵심 게이트 위치: L306 `nextUrl = parseNextCursor(body, input.baseUrl)` 직후 ~ L287 while 루프가 그 `nextUrl` 을 fetch 하기 직전.
- [src/confluence/confluence-adapter.service.spec.ts](../../src/confluence/confluence-adapter.service.spec.ts) — colocated spec. 기존 `requestAllPages` / `parseNextCursor` describe block 근처에 본 task 의 신규 cross-host test 를 colocated 추가 (신규 describe block `ConfluenceAdapter same-host guard` 권장).
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — **참조 패턴** (변경 금지): `isSameHost` (L115~146, scheme+host(case-insensitive)+port 정규화 strict equal + malformed fail-closed 순수 함수) / `requestAllPages` 의 host-check 게이트 (L312~334, `if (parsedNext !== null && !isSameHost(parsedNext, baseUrl))` → cross-host kind throw + abort + cursorHost-only message). 본 task 는 이 구조를 Confluence (`input.baseUrl` 기반, relative-cursor PASS) 로 reframe.
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) — Decision §1 (same host = scheme + host(case-insensitive) + port 정규화 strict equal, subdomain 불허, malformed → fail-closed false) / §2 (mismatch → 도메인 error throw + 순회 abort, Authorization drop·partial 반환 기각) / §3 (Confluence host-check 위치 = `parseNextCursor` 결과 받은 직후 ~ 다음 fetch 직전, `parseNextCursor` 는 순수 parser 유지) / §4 (token / full cursor URL 비노출 invariant).
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) — §4 (ConfluenceDomainError kind 매핑 표 — 본 task 가 cross-host 분류 1행 추가) / §5 (`_links.next` body cursor — 절대 URL 이 base 무시 = leak vector) / §6 (4 단 경계 — host 비교는 순수 함수).

## Acceptance Criteria

구현:

- [ ] **host 비교 함수** — ADR-0019 §1 규칙대로 `isSameHost(cursorUrl: string, baseUrl: string): boolean` 형태의 **순수 함수** (부수효과 0, 외부 의존 0 — Node 내장 `URL` 만) 를 `confluence-adapter.service.ts` 에 추가한다. 비교 규칙은 GitHub `isSameHost` (L115~146) 와 **동일 규칙**: (a) scheme(`URL.protocol`) 정확 일치, (b) host(`URL.hostname`) **case-insensitive** 일치(양쪽 `toLowerCase()`), (c) port — 빈 `URL.port` 를 scheme-default(https=443 / http=80) 로 정규화 후 일치, (d) **strict equal host** — subdomain 불허, (e) 한쪽이라도 `URL` 파싱 실패(malformed)면 **false (fail-closed)**. base 인자로는 `input.baseUrl` (instance 풀 base URL) 을 쓴다. **shared util 추출은 Out of Scope** — Confluence adapter 내부에 동일 규칙을 자기충족하게 둔다(ADR-0019 §3 이 물리적 공유 강제 안 함; 두 adapter 는 modules.md 상 서로 import 안 함).
- [ ] **cross-host error 분류** — `ConfluenceDomainErrorKind` union 에 cross-host 전용 분류 1종을 추가한다 (GitHub 와 정합하게 잠정 슬러그 `cross-host-cursor`; ADR-0019 §2 의 `ConfluenceCrossHostCursorError` "서브클래스" 표현은 잠정 — 기존 코드가 subclass 가 아니라 `kind` union 기반 단일 `ConfluenceDomainError` 이므로, **kind 추가 방식이 기존 스타일·GitHub mirror 와 정합**하다. implementer 가 둘 중 코드 정합 쪽 선택). 신규 분류는 권한 부족(401/403)·not-found 와 **구분** 되며 `PermissionDeniedEvent` 를 emit 하지 않고 `PartialCollectionEvent` 도 emit 하지 않는다 (ADR-0019 §2 — cross-host 는 partial 반환이 아니라 throw).
- [ ] **host-check 게이트** — `requestAllPages` 의 순회 loop 에서, `parseNextCursor(body, input.baseUrl)` 가 산출한 next URL 을 **다음 iteration 에서 fetch 하기 직전** 에 `isSameHost(parsedNext, input.baseUrl)` 를 검사한다 (GitHub L320 게이트 mirror — `parsedNext !== null && !isSameHost(...)`). 불일치면 그 cursor 를 **fetch 하지 않고** cross-host 분류의 `ConfluenceDomainError` 를 throw 해 순회를 abort 한다 (부분 수집분은 버린다 — ADR-0019 §2). **relative cursor 정상 통과 보장** — `parseNextCursor` 가 relative `_links.next` 를 `baseUrl` origin 으로 조립한 same-origin 절대 URL 은 host-check 를 PASS 한다 (정상 pagination 비파괴). 첫 page URL(`buildConfluenceRequest` 조립값)은 base host 가 보장되므로 검사 대상이 아니다 — host-check 는 next page(들)에만 적용.
- [ ] **`parseNextCursor` 순수 parser 유지** — `parseNextCursor` 는 host 판정을 하지 않고 cursor 문자열만 산출하는 현재 책임을 그대로 둔다 (ADR-0019 §3 수렴 경계 — 시그니처·동작 변경 금지).
- [ ] **token / full cursor URL 비노출 (§4)** — cross-host error 의 message 에는 식별 정보(base host/origin, cursor 의 foreign host)만 담고 **token 평문(Cloud Basic base64 / Server Bearer PAT) / `Authorization` 헤더 값 / cursor full URL(query 포함) 을 직렬화하지 않는다** (기존 `fetchAndMap`·`mapNon2xx` 의 baseUrl/path-only message 패턴 + GitHub host-check message 의 `cursorHost`-only + `(malformed)` placeholder 답습). host-check 실패 시점에 `headers` 에 평문 token 이 실려 있어도 그 `headers` 를 cross-host 로 **fetch 에 쓰지 않고 폐기** 한다 (송신 0).
- [ ] **시그니처 비파괴** — `request` / `requestAllPages` / `parseNextCursor` 의 public 시그니처는 host-check 추가 외에 변경하지 않는다.

R-112 test (colocated `src/confluence/confluence-adapter.service.spec.ts`):

- [ ] **happy-path** — same-host next cursor 일 때 pagination 이 **정상 순회·flatten** 됨. 두 형태 모두 cover: (i) `_links.next` 가 **relative path** (예: `/wiki/rest/api/content?start=25`) → `baseUrl` origin 으로 조립돼 same-host → 정상 다음 page 수집, (ii) `_links.next` 가 **절대 same-host URL** (base 와 동일 scheme+host+port) → 정상 수집. 각 2~3 page → 전 항목 누적 반환. `isSameHost` happy-path(동일 scheme+host+port → true) 1+.
- [ ] **error/abort path** — `_links.next` 가 **절대 cross-host URL**(다른 hostname) → cross-host 분류 `ConfluenceDomainError` throw + 순회 abort + `PermissionDeniedEmitter.emit` **미호출** + `PartialCollectionEmitter.emit` **미호출** 검증.
- [ ] **flow / branch cover (mismatch 분기마다 1+ — 각 별도 `it`)** — (a) **다른 host**(절대 cross-host hostname 상이) → throw, (b) **같은 host 다른 port**(예: base `:443` vs cursor `:8443`) → throw, (c) **같은 host 다른 scheme**(https→http downgrade) → throw, (d) **subdomain** cursor(예: `evil.<base-host>`) → throw (strict equal 검증), (e) **malformed cursor**(파싱 불가 — 단, `parseNextCursor` 가 malformed 면 보통 null 반환하므로, `isSameHost` 가 malformed 입력에 false 반환함을 단위 차원에서 직접 검증 또는 게이트가 malformed 절대 URL 을 fail-closed throw 하는 경로) → fail-closed, (f) **case-insensitive host** 일치(host 대문자/소문자 차이만) → same host 로 정상 통과, (g) **port 정규화** 일치(`https://h/` vs `https://h:443/`) → same host 통과, (h) **relative same-host cursor** → 정상 통과(GitHub 에 없는 Confluence 고유 분기 — 명시 cover).
- [ ] **negative cases 충분 cover** — 위 (a)~(e) 각각 **별도 `it`** 으로 cross-host abort / fail-closed 를 검증 (단일 negative 만 작성 금지 — mismatch 분기마다 cover). 추가로 cross-host error 가 **token 평문 / `Authorization` 값 / full cursor URL 을 message 에 포함하지 않음** 을 단언하는 negative test 1+.
- [ ] **regression** — 본 결함(cross-host auth-leak) 재발 시 fail 하도록, "cross-host cursor 를 만나면 주입 fetch mock 이 그 foreign host 로 **호출되지 않는다**(`fetchFn` 이 cross-host URL 인자로 invoke 되지 않음)" 를 단언하는 test 1+ (leak vector 직접 봉합 검증). 첫 page + 마지막 same-host page 까지만 fetch 가 호출되고 cross-host URL 로는 호출 0 임을 mock call args 로 검증.
- [ ] **coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 `isSameHost` + 게이트 분기는 branch 100% 지향.
- [ ] **lint/build/test** — `pnpm lint && pnpm build && pnpm test` green (R-110, tester 검증).

## Out of Scope

- **GithubAdapter same-host 가드** — T-0194 에서 이미 머지됨 (chain 1행). 본 task 는 Confluence adapter 만.
- **ADR-0019 PROPOSED→ACCEPTED flip** — 두 adapter 가드(T-0194 + 본 task)가 모두 머지된 후 별도 direct task (chain 3행). 본 task 에서 ADR status 를 건드리지 않는다.
- **새 외부 dependency 추가** — Node 내장 `URL` 만 사용 (octokit/axios/node-fetch 등 `pnpm add` 0).
- **host allowlist / 정상 cross-host cursor 지원** — ADR-0019 Alternatives §5 가 YAGNI 로 기각. 본 task 는 strict equal host 만.
- **cross-host 보안 event 신설 / 영속화** — ADR-0019 §2 가 "도메인 error throw 만 박제, event 신설 강제 안 함". `PermissionDeniedEvent`/`PartialCollectionEvent` 위상 변경 금지.
- **`parseNextCursor` 동작/시그니처 변경** — 순수 parser 유지 (ADR-0019 §3). cursor 산출 책임만, host 판정 안 함.
- **shared util 추출(GitHub+Confluence 공통 `isSameHost`)** — ADR-0019 §3 이 물리적 공유 여부를 강제하지 않음. 본 task 는 Confluence adapter 내부에 scope. 두 adapter 의 `isSameHost` 공유 refactor 가 필요하면 후속 별도 task 에서 판단.
- **PermissionDeniedRecord entity 실 persistence (row8) / live-run (row9)** — §5 schema / credential 게이트 (BLOCKED). 본 task 는 in-memory emitter port 위에서만 동작.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- ADR-0019 status PROPOSED→ACCEPTED flip (chain 3행) — 본 task(Confluence 가드) 머지 후 direct task. 두 adapter 가드(T-0194 + 본 task) 모두 머지 완료가 전제.
- (선택) GitHub + Confluence `isSameHost` shared util 추출 refactor — ADR-0019 §3 향후 재검토 조건 (iii) (추가 외부 adapter 도입 시 일반화). 현 시점 우선순위 낮음.
