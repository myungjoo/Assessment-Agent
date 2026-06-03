---
id: T-0194
title: GithubAdapter same-host cursor 가드 구현 (cross-host Authorization leak 차단)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-059]
dependsOn: [T-0193]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0019 GitHub 가드 구현(requestAllPages next-page fetch 직전 host-check + cross-host error 분류 + full R-112). R-112 backbone ×1.5, Node URL dep0.
---

# T-0194 — GithubAdapter same-host cursor 가드 구현 (cross-host Authorization leak 차단)

## Why

[ADR-0019](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) 가 박제한 same-host 제약 정책을 **GitHub adapter 에 실 구현**한다 (ADR Decision 끝 "후속 task chain" 표의 1행). 현재 [`requestAllPages`](../../src/github/github-adapter.service.ts) 는 응답 `Link` rel=next 가 준 **opaque next URL** 을 첫 page 의 `headers` (Bearer token 포함) 로 그대로 fetch 한다 — host 검증이 없어, 서버 응답에 박힌 cursor 가 foreign host 를 가리키면 `Authorization` 토큰이 그 host 로 **leak** 된다 (T-0188 reviewer 가 MINOR finding 으로 식별한 cross-host auth-leak vector). 이는 README REQ-044 (instance 별 권한 분리) 와 [CLAUDE.md §9](../../CLAUDE.md) (secret 비노출) 를 transport 계층에서 위반하는 결함이다. 본 task 가 next page fetch 직전에 host-check 게이트를 넣어 leak 을 0 으로 만든다. ADR-0019 가 Node 내장 `URL` 만 쓰도록 박제했으므로 새 외부 dependency 0 (§5 게이트 미발화).

## Required Reading

- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — `requestAllPages` (L213~250, next URL 순회) / `fetchAndMap` (L257~301, 동일 headers fetch + Link parse) / `GithubDomainError` + `GithubDomainErrorKind` (L111~134) / `parseNextLink` (L60~85, 순수 parser — 변경 금지) / token 비노출 error message 패턴 (L271~275·L290~294·mapNon2xx L308~350).
- [src/github/github-adapter.service.spec.ts](../../src/github/github-adapter.service.spec.ts) — colocated spec. 기존 describe block: `GithubAdapter.request` (L88) / `parseNextLink` (L445) / `GithubAdapter.requestAllPages` (L533). 본 task 의 신규 cross-host test 는 `requestAllPages` describe 안 또는 신규 describe 로 colocated 추가.
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) — Decision §1 (same host = scheme + host(case-insensitive) + port 정규화 strict equal, subdomain 불허, malformed → fail-closed false) / §2 (mismatch → 도메인 error throw + 순회 abort, Authorization drop·partial 반환 기각) / §3 (host-check 위치 = `parseNextLink` 산출 next URL 을 `fetchAndMap` 으로 넘기기 직전, `parseNextLink` 는 순수 parser 유지) / §4 (token / full cursor URL 비노출 invariant).
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](../decisions/ADR-0016-github-adapter-http-transport-contract.md) — §3 (auth header) / §4 (non-2xx 도메인 매핑 표 — 본 task 가 cross-host 분류 1행 추가) / §6 (순수 builder/parser 경계 — host 비교 함수는 부수효과 0 순수 함수로).

## Acceptance Criteria

구현:

- [ ] **host 비교 함수** — ADR-0019 §1 규칙대로 `isSameHost(cursorUrl: string, baseUrl: string): boolean` 형태의 **순수 함수** (부수효과 0, 외부 의존 0) 를 `github-adapter.service.ts` 에 추가한다. 비교 규칙: (a) scheme(`URL.protocol`) 정확 일치, (b) host(`URL.hostname`) **case-insensitive** 일치 (양쪽 `toLowerCase()`), (c) port — 빈 `URL.port` 를 scheme-default(https=443 / http=80) 로 정규화 후 일치, (d) **strict equal host** — subdomain 불허 (글자 그대로 동일 hostname 만 same host), (e) 한쪽이라도 `URL` 파싱 실패(malformed) 면 **false (fail-closed)**. base host 도출은 기존 `buildGithubRequest` 의 base URL 산출과 정합하게 `input.host` 기반으로 한다.
- [ ] **cross-host error 분류** — `GithubDomainErrorKind` union 에 cross-host 전용 분류 1종을 추가한다 (잠정 슬러그 `cross-host-cursor`; 슬러그 최종 결정은 implementer 가 ADR-0016 §4 표 명명 관례와 정합하게). 신규 분류는 권한 부족(401/403)·not-found 와 **구분** 되며 `PermissionDeniedEvent` 를 emit 하지 않는다 (ADR-0019 §2).
- [ ] **host-check 게이트** — `requestAllPages` 의 순회 loop 에서, `fetchAndMap` 이 산출한 `parsedNext` (next page opaque URL) 를 **다음 iteration 의 `nextUrl` 로 받아 fetch 하기 직전** 에 `isSameHost(parsedNext, baseUrl)` 를 검사한다. 불일치(또는 malformed)면 그 cursor 를 **fetch 하지 않고** cross-host 분류의 `GithubDomainError` 를 throw 해 순회를 abort 한다 (부분 수집분은 버린다 — ADR-0019 §2). 첫 page URL(`buildGithubRequest` 조립값)은 base host 가 보장되므로 검사 대상이 아니다 — host-check 는 next page(들)에만 적용.
- [ ] **`parseNextLink` 순수 parser 유지** — `parseNextLink` 는 host 판정을 하지 않고 cursor 문자열만 산출하는 현재 책임을 그대로 둔다 (ADR-0019 §3 수렴 경계 — 시그니처·동작 변경 금지).
- [ ] **token / full cursor URL 비노출 (§4)** — cross-host error 의 message 에는 식별 정보(base host, cursor 의 foreign host)만 담고 **`Authorization` 헤더 값 / 평문 token / cursor full URL(query 포함) 을 직렬화하지 않는다** (기존 `fetchAndMap`·`mapNon2xx` 의 host/path-only message 패턴 답습). host-check 실패 시점에 `headers` 에 평문 token 이 실려 있어도 그 `headers` 를 cross-host 로 **fetch 에 쓰지 않고 폐기** 한다 (송신 0).
- [ ] **시그니처 비파괴** — `request` / `requestAllPages` / `parseNextLink` 의 public 시그니처는 host-check 추가 외에 변경하지 않는다.

R-112 test (colocated `src/github/github-adapter.service.spec.ts`):

- [ ] **happy-path** — same-host next cursor 일 때 pagination 이 **정상 순회·flatten** 됨 (예: base host 와 동일한 절대 URL cursor 2~3 page → 전 항목 누적 반환). `isSameHost` happy-path(동일 scheme+host+port → true) 1+.
- [ ] **error/abort path** — cross-host 절대 cursor(다른 hostname) → cross-host 분류 `GithubDomainError` throw + 순회 abort + `PermissionDeniedEmitter.emit` **미호출** 검증.
- [ ] **branch cover (mismatch 분기마다 1+)** — (a) **다른 host**(hostname 상이) → throw, (b) **같은 host 다른 port**(예: base `:443` vs cursor `:8443`) → throw, (c) **같은 host 다른 scheme**(https→http downgrade) → throw, (d) **subdomain** cursor(예: `uploads.<base-host>`) → throw (strict equal 검증), (e) **malformed cursor**(파싱 불가 문자열) → fail-closed throw, (f) **case-insensitive host** 일치(host 대문자/소문자 차이만) → same host 로 정상 통과, (g) **port 정규화** 일치(`https://h/` vs `https://h:443/`) → same host 통과.
- [ ] **negative cases 충분 cover** — 위 (a)~(e) 각각 별도 it 으로 cross-host abort 를 검증 (단일 negative 만 작성 금지 — mismatch 분기마다 cover). 추가로 cross-host error 가 **token 평문 / full cursor URL 을 message 에 포함하지 않음** 을 단언하는 negative test 1+.
- [ ] **regression 성격 명시** — 본 결함(cross-host auth-leak) 재발 시 fail 하도록, "cross-host cursor 를 만나면 fetch 가 그 host 로 호출되지 않는다(주입 fetch mock 이 foreign host 로 호출되지 않음)" 를 단언하는 test 1+ (leak vector 직접 봉합 검증).
- [ ] **coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 `isSameHost` + 게이트 분기는 branch 100% 지향.
- [ ] **lint/build/test** — `pnpm lint && pnpm build && pnpm test` green (R-110, tester 검증).

## Out of Scope

- **ConfluenceAdapter same-host 가드** — 별도 follow-up task (ADR-0019 chain 2행). 본 task 는 GitHub adapter 만.
- **ADR-0019 PROPOSED→ACCEPTED flip** — 두 adapter 가드 머지 후 별도 direct task (chain 3행).
- **새 외부 dependency 추가** — Node 내장 `URL` 만 사용 (octokit/axios/node-fetch 등 `pnpm add` 0).
- **host allowlist / 정상 cross-host cursor 지원** — ADR-0019 Alternatives §5 가 YAGNI 로 기각. 본 task 는 strict equal host 만.
- **cross-host 보안 event 신설 / 영속화** — ADR-0019 §2 가 "도메인 error throw 만 박제, event 신설 강제 안 함". `PermissionDeniedEvent`/`PartialCollectionEvent` 위상 변경 금지.
- **`parseNextLink` 동작/시그니처 변경** — 순수 parser 유지 (ADR-0019 §3).
- **shared util 추출(GitHub+Confluence 공통 `isSameHost`)** — ADR-0019 §3 이 물리적 공유 여부를 강제하지 않음. 본 task 는 GitHub adapter 내부에 scope. 필요 시 Confluence 가드 task 또는 후속 refactor 에서 판단.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- ConfluenceAdapter same-host 가드 구현 (ADR-0019 chain 2행) — `parseNextCursor` 결과 fetch 직전 host-check + `ConfluenceCrossHostCursorError` 서브클래스 + full R-112 (절대-URL cross-host / relative same-host pass / subdomain-reject / malformed negative cover).
- ADR-0019 status PROPOSED→ACCEPTED flip (chain 3행) — 두 adapter 가드 머지 후 direct task.
