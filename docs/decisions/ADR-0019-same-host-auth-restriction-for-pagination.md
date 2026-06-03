---
id: ADR-0019
title: pagination cursor 의 same-host Authorization 전송 제약 정책 — cursor URL 의 (scheme + host + port) 가 instance base URL 과 정확히 일치할 때만 Authorization 동반 fetch / 불일치 시 abort + 도메인 error throw / GitHub·Confluence 양쪽 adapter 공통 / token 비노출 invariant
status: ACCEPTED
date: 2026-06-03
relatedTask: T-0193
supersedes: null
---

# ADR-0019 — pagination cursor 의 same-host Authorization 전송 제약 정책 박제

## Context

P4 milestone-3 의 두 adapter — [GithubAdapter](../../src/github/github-adapter.service.ts) ([ADR-0016](ADR-0016-github-adapter-http-transport-contract.md)) 와 [ConfluenceAdapter](../../src/confluence/confluence-adapter.service.ts) ([ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md)) — 는 pagination 순회 시 서버가 준 **opaque next cursor URL** 을 첫 page 와 **동일한 `headers`** (= `Authorization` token 포함) 로 그대로 fetch 한다. 그런데 그 cursor URL 은 응답 본문/헤더에서 오는 **서버측 제어값** (잠재적 공격 surface) 이라, instance base host 와 **다른 host 를 가리키는 cursor** 가 오면 `Authorization` 헤더 (credential) 가 **foreign host 로 leak** 될 수 있다.

이 leak vector 는 두 adapter 의 현 코드에 실재한다:

- **GitHub** ([github-adapter.service.ts](../../src/github/github-adapter.service.ts) `requestAllPages` L213~250 / `fetchAndMap` L257~301) — `parseNextLink(response.headers.get("link"))` 로 추출한 rel=next opaque URL 을 `nextUrl` 로 받아 **첫 page 의 `headers` (Bearer token) 를 그대로** `this.fetchFn(nextUrl, { headers })` 로 fetch 한다. cursor URL 의 host 검증이 **없다** — `Link` rel=next 가 foreign host 를 가리키면 token 이 그 host 로 전송된다.
- **Confluence** ([confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) `parseNextCursor` L67~96 / `requestAllPages` L267~322) — `parseNextCursor` 가 `new URL(next, baseUrl)` 로 cursor 를 정규화하는데, **`_links.next` 가 절대 URL 이면 두 번째 인자 `baseUrl` 을 무시** 하고 그대로 통과한다 (Node `URL` semantics — [ADR-0018 §5](ADR-0018-confluence-adapter-http-transport-contract.md) 가 "절대 URL → 그대로 반환" 으로 명시). 그 절대 URL 이 foreign host 면 `requestAllPages` 가 첫 page 의 `headers` (Basic / Bearer) 로 fetch 해 credential 이 leak 된다. ADR-0018 Consequences 의 "`_links.next` 비표준 cursor risk" 항목의 보안 측면 구체화다.

이 leak 은 [T-0188](../tasks/T-0188-confluence-links-next-pagination.md) reviewer 가 MINOR finding (cross-host auth-leak) 으로 사전 식별한 follow-up 후보였다. [README](../../README.md) 의 instance 별 권한 분리 (REQ-044) + 본 시스템의 secret 비노출 규율 ([CLAUDE.md §9](../../CLAUDE.md)) 을 **transport 계층** 에서 방어하기 위해, "cursor URL 의 host 가 base host 와 다르면 Authorization 을 어떻게 처리하는가" 를 코드보다 먼저 ADR 로 박제한다 ([CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR이 먼저다", [§3.1 rule 4](../../CLAUDE.md) "새 ADR = pr-mode").

### 결정 대상 4 축

본 ADR 이 확정하는 same-host 제약 정책 축:

- **축 (1) "same host" 정의** — cursor URL 과 instance base URL 의 동일 host 판정 기준 (scheme + host + port 비교 규칙 + subdomain 취급).
- **축 (2) mismatch 동작** — host 불일치 cursor 를 만났을 때의 단일 동작 (Authorization drop 진행 / abort 부분 수집 / 도메인 error throw 중 택일).
- **축 (3) 적용 범위** — GitHub (header cursor) · Confluence (body cursor) 양쪽 adapter 에 공통 적용 + 두 cursor 출처 차이의 수렴 경계.
- **축 (4) token 비노출 정합** — host-check 실패 시에도 token 평문이 error message / event / 로그에 노출되지 않는 invariant.

### REQ / 선행 ADR 외력 (본 ADR 이 cover)

- **REQ-044** ([README.md](../../README.md) L19~22) — instance 별 권한 분리. 본 ADR 은 한 instance 의 token 이 (서버 응답에 박힌 cursor 를 통해) 다른 host 로 새어 나가는 것을 transport 계층에서 차단해 권한 경계를 강화한다.
- **REQ-059 / [ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant. 본 ADR 은 cursor URL 의 host 만 비교할 뿐 cursor 본문을 영속화하지 않으므로 이 invariant 와 정합.
- **[ADR-0016 §5](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §5](ADR-0018-confluence-adapter-http-transport-contract.md)** — 두 adapter 의 pagination 계약 (opaque cursor 순회). 본 ADR 은 그 순회에 **host-check 게이트** 한 겹을 추가하되, opaque cursor 를 따른다는 결정 자체는 재결정하지 않는다.
- **[CLAUDE.md §9](../../CLAUDE.md)** — secret 비노출 규율. 축 (4) 가 이를 host-check 실패 경로에서도 invariant 로 박제.

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0019** — `docs/decisions/` 에 ADR-0001 ~ ADR-0018 점유 (ADR-0007 은 미신설 — [ADR-0016 §ADR cross-reference](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §ADR cross-reference](ADR-0018-confluence-adapter-http-transport-contract.md) 박제). 본 ADR 은 다음 free 번호 ADR-0019 를 사용 (T-0193 acceptance 의 번호 정합 명시).
- **본 ADR 은 ADR-0016 / ADR-0018 을 supersede 하지 않는다** — 두 transport 계약 ADR 의 pagination 결정 (§5) 위에 **same-host 제약 한 겹을 얹는** 보강 ADR 이다 (`supersedes: null`). 두 ADR 의 어떤 결정도 뒤집지 않으며, 두 ADR 의 §5 cursor 순회가 본 ADR 의 host-check 게이트를 통과한 cursor 에만 적용되도록 좁힌다.

## Decision

본 ADR 은 다음 4 결정을 박제한다. **본 ADR 은 same-host 제약 정책을 기술하되 production code 0 LOC — 실 두 adapter 의 host-check 가드 코드는 후속 follow-up task (adapter 당 1 task, full R-112 test 동반).**

### Decision §1 — "same host" 정의: (scheme + host + port) 3 요소 정확 일치, subdomain 불허 (strict equal host)

cursor URL 이 instance base URL 과 **same host** 인지의 판정은 다음 3 요소를 Node 내장 `URL` 로 파싱해 비교한다 (새 dependency 0 — [Q-0017](../STATE.json) 제약 / [ADR-0018 §5](ADR-0018-confluence-adapter-http-transport-contract.md) `parseNextCursor` 가 이미 쓰는 `URL` 재사용):

- **scheme (protocol)** — `URL.protocol` 비교. **정확 일치** 를 요구한다 (`https:` vs `http:` 불일치는 mismatch). cursor 가 https base 의 token 을 http 평문 채널로 끌고 가는 downgrade leak 을 막는다. `URL.protocol` 은 이미 소문자 정규화되어 case 무관.
- **host (hostname)** — `URL.hostname` 비교, **case-insensitive** (DNS host 는 대소문자 무관이나 문자열 비교는 그렇지 않으므로 양쪽을 `toLowerCase()` 후 비교). IDN/punycode 는 `URL.hostname` 이 이미 punycode 로 정규화하므로 추가 처리 불요.
- **port** — `URL.port` 비교, **명시 port 와 scheme-default port 를 정규화한 뒤** 비교. `URL.port` 는 scheme-default port (https=443 / http=80) 가 명시돼 있으면 빈 문자열로 반환하는 비대칭이 있으므로, "빈 `port` = 해당 scheme 의 default port" 로 정규화해 `https://h/` 와 `https://h:443/` 를 동일 port 로 취급한다. 비-default 명시 port (예: `:8443`) 끼리는 정확 일치를 요구한다.

**subdomain 취급 — strict equal host (base host 의 subdomain 도 불허)**. cursor 의 hostname 이 base hostname 과 **글자 그대로 동일** 해야 same host 다. `api.github.com` base 에 대해 `uploads.github.com` 같은 base 의 형제/하위 subdomain cursor 도 **mismatch** 로 본다. 근거:

- **credential scope 최소화** — token 은 base host 에 발급된 권한 경계 안에서만 유효하다고 가정하는 것이 가장 보수적이다. subdomain 허용 (예: "base host 의 suffix 면 OK") 은 cookie `Domain` 속성류의 super-domain 공유 attack (예: 공격자가 `evil.github.com` 를 통제하면 token 탈취) surface 를 연다.
- **단순성 / 환각 ↓** — "정확히 같은 host 인가" 는 구현·리뷰·테스트가 명료하다. suffix 매칭은 public suffix list (eTLD+1) 경계 판정이 필요해져 복잡도와 오판 risk 가 커진다.
- **실 cursor 정합** — 두 adapter 의 정상 pagination cursor 는 base 와 **같은 host** 를 가리킨다 (GitHub `Link` rel=next 는 동일 API host, Confluence `_links.next` 의 relative path 는 `parseNextCursor` 가 base origin 으로 조립). 즉 strict equal 은 정상 경로를 막지 않는다 — host 가 다른 cursor 는 본래 비정상이다. (cross-host upload 등 정상적 cross-host 흐름이 미래에 필요해지면 host allowlist 를 도입하는 supersede ADR 로 확장 — Alternatives 참조.)

비교 함수는 두 adapter 의 **순수 함수 builder/parser layer** ([ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §6](ADR-0018-confluence-adapter-http-transport-contract.md)) 에 부수효과 0 으로 박제할 수 있는 형태여야 한다 (예: `isSameHost(cursorUrl: string, baseUrl: string): boolean`). 한쪽이라도 `URL` 파싱에 실패 (malformed) 하면 **same host 아님 (false)** 으로 보아 보수적으로 차단한다 (fail-closed). 구체 함수 시그니처/위치는 follow-up 코드 task 책임 — 본 ADR 은 비교 규칙만 박제.

### Decision §2 — mismatch 동작: 순회 abort + 도메인 error throw (Authorization drop 진행 / partial 반환 미채택)

host 불일치 cursor 를 만나면 adapter 는 **그 cursor 를 fetch 하지 않고 즉시 도메인 error 를 throw 해 pagination 순회를 abort** 한다. 세 후보 중 본 결정의 택일:

- **(채택) 도메인 error throw + abort** — host-check 실패는 "정상 pagination 의 자연 종료" 가 아니라 **비정상 신호** (서버 응답이 foreign host cursor 를 줬다 = 손상되었거나 공격) 다. 따라서 그 instance 의 그 호출에 대한 수집을 **error 로 표면화** 해 호출처/운영자가 인지하게 한다. error 위상은 두 adapter 의 기존 도메인 error 계층을 재사용한다:
  - GitHub → [GithubDomainError](../../src/github/github-adapter.service.ts) 의 신규 분류 (잠정 `cross-host-cursor`, [ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) 매핑 표에 한 row 추가 — 구체 분류 슬러그는 follow-up 코드 task 가 확정).
  - Confluence → [ConfluenceDomainError](../../src/confluence/confluence-adapter.service.ts) 서브클래스 (잠정 `ConfluenceCrossHostCursorError`, [ADR-0018 §4](ADR-0018-confluence-adapter-http-transport-contract.md) `ConfluenceDomainError` base 의 신규 서브클래스).
- **(미채택) Authorization 헤더를 drop 하고 계속 fetch** — credential 비노출은 달성하나, **인증 없는 cross-host 요청을 adapter 가 자발적으로 보내는** 것은 (i) foreign host 로의 무인증 egress 라는 또 다른 공격 surface 를 열고, (ii) 그 응답이 인증 실패/무의미하므로 수집 가치가 없으며, (iii) "왜 갑자기 cross-host 호출이 나갔나" 를 운영자가 추적하기 어렵게 만든다. 차단이 곧 비용 0 인데 굳이 요청을 내보낼 이유가 없다.
- **(미채택) abort 하되 partial collection 을 정상 반환** — Confluence 의 `CONFLUENCE_MAX_PAGES` cap 도달 시 partial 반환 ([ADR-0018 §5](ADR-0018-confluence-adapter-http-transport-contract.md)) 과 형태는 비슷하나, cap 도달은 "정상 데이터의 양적 초과" 인 반면 cross-host cursor 는 "응답 신뢰성 자체의 손상" 이다. partial 을 정상 반환하면 호출처가 **불완전 수집을 정상 완료로 오인** 할 risk 가 있다. 보안 신호는 silent partial 보다 loud error 가 옳다.

**기존 event 위상과의 정합**:

- **PermissionDeniedEvent 와 구분** — cross-host cursor 는 권한 부족 (401/403) 이 아니므로 **PermissionDeniedEvent 를 emit 하지 않는다** ([ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §4](ADR-0018-confluence-adapter-http-transport-contract.md) 의 4xx → PermissionDeniedEvent 경계와 별개). 별도 보안 event (예: cross-host-cursor 차단) 의 emit 여부/형식은 follow-up 코드 task 가 결정 — 본 ADR 은 "도메인 error throw" 만 박제하고 event 신설은 강제하지 않는다.
- **PartialCollectionEvent 와 구분** — Confluence 의 cap 도달 partial-collection event ([ADR-0018 §5](ADR-0018-confluence-adapter-http-transport-contract.md)) 와도 다르다. cross-host 는 partial 반환이 아니라 throw 이므로 PartialCollectionEvent emit 경로를 타지 않는다.
- **skip-and-continue 와 정합** — throw 된 cross-host error 는 두 adapter 의 기존 도메인 error 와 동일하게 **상위 orchestrator/traversal service 가 try/catch 로 흡수** 한다 (GitHub instance/repo 단위 / Confluence SPACE 단위 skip-and-continue — [ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §4·§6](ADR-0018-confluence-adapter-http-transport-contract.md)). 즉 한 instance/SPACE 의 cross-host cursor 가 전체 수집을 막지 않고, 그 단위만 skip 되며 나머지는 계속 진행된다 — abort 의 영향 범위는 adapter 호출 1 건이지 전체 수집이 아니다.

### Decision §3 — 적용 범위: GitHub·Confluence 양쪽 adapter 공통, header vs body cursor 출처 차이의 수렴

본 same-host 제약은 **두 adapter 에 공통 적용** 된다. 두 adapter 의 cursor 출처는 다르나 **"opaque cursor URL → 동일 headers 로 fetch"** 라는 동일 구조라, host-check 는 그 fetch **직전** 한 지점으로 수렴한다:

- **GitHub** — cursor 출처는 응답 **header** (`Link` rel=next, [parseNextLink](../../src/github/github-adapter.service.ts)). `requestAllPages` ([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L213~250) 의 순회 loop 에서 `parseNextLink` 가 산출한 `nextUrl` 을 `fetchAndMap` 으로 넘기기 직전에 host-check 를 둔다. 즉 **다음 page 의 opaque URL 을 fetch 하기 직전** 이 게이트 위치다. (첫 page 의 `url` 은 `buildGithubRequest` 가 base host 로 조립하므로 base 와 같은 host 임이 보장 — host-check 는 next page 들에만 의미가 있다.)
- **Confluence** — cursor 출처는 응답 **body** (`_links.next`, [parseNextCursor](../../src/confluence/confluence-adapter.service.ts) L67~96). `parseNextCursor` 가 절대 URL 을 그대로 반환하는 지점이 leak vector 이므로, host-check 는 **`parseNextCursor` 결과를 받은 직후 ~ 다음 fetch 직전** (`requestAllPages` L290~306 loop) 에 둔다. `parseNextCursor` 가 이미 cursor 를 절대 URL 로 정규화하므로 host-check 는 그 절대 URL 과 `input.baseUrl` 을 비교하면 된다.

**수렴 경계** — 두 adapter 모두 (i) cursor 산출 함수 (`parseNextLink` / `parseNextCursor`) 는 **순수 parser** 로 두고 (cursor 문자열만 산출, host 판정 안 함 — 단일 책임 유지), (ii) host-check 는 **순회 loop (`requestAllPages`)** 가 "산출된 next URL 을 fetch 할지" 결정하는 게이트로 둔다. host 비교 함수 자체 (`isSameHost` 류) 는 두 adapter 가 **동일 비교 규칙 (Decision §1)** 을 구현하되, 코드 공유 (shared util) vs adapter 별 중복 구현 중 어느 쪽인지는 follow-up 코드 task 책임 — 본 ADR 은 "동일 규칙이 양쪽에 적용됨" 만 박제하고 물리적 공유 여부는 강제하지 않는다 (두 adapter 가 [modules.md](../architecture/modules.md) 상 서로 import 하지 않는 adapter leaf 라, shared util 도입은 leaf 경계와 무관한 별도 판단).

### Decision §4 — token 비노출 정합: host-check 실패 경로에서도 평문 token 0 노출 (invariant)

host-check 실패로 throw 되는 도메인 error / event / 로그 어디에도 **평문 token (Bearer token / Cloud Basic `email:api_token` base64 / Server PAT) 이 노출되지 않는다** ([CLAUDE.md §9](../../CLAUDE.md), [ADR-0016 §3](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §3](ADR-0018-confluence-adapter-http-transport-contract.md) token 비노출 invariant 의 본 정책 내 재확인):

- **error message 에 cursor URL 의 host 만** — cross-host error 의 message 는 식별 정보로 (base host, cursor 의 foreign host, path) 만 담는다. 두 adapter 의 기존 error message 가 `host`/`path`/`status` 만 담고 token 을 절대 넣지 않는 패턴 ([github-adapter.service.ts](../../src/github/github-adapter.service.ts) `fetchAndMap` L271~275·L290~294 / [ADR-0018 §3](ADR-0018-confluence-adapter-http-transport-contract.md)) 을 그대로 따른다. **`Authorization` 헤더 값 자체는 error/log 에 직렬화하지 않는다.**
- **cursor URL 의 query string 주의** — cursor URL (예: `_links.next` 의 절대 URL) 의 query string 에 민감값이 섞일 수 있으므로, error message 에는 cursor 의 **host (origin)** 만 담고 full URL (query 포함) 을 통째로 박지 않는다 (구체 redaction 형태는 follow-up 코드 task 가 확정 — 본 ADR 은 "full cursor URL / token 평문 미노출" invariant 만 박제).
- **never-read-back 정합** — token 은 [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 encrypted-at-rest 후 HTTP 호출 직전 JIT decrypt 되며 ([ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §6](ADR-0018-confluence-adapter-http-transport-contract.md)), host-check 실패 시점에는 이미 `headers` 에 평문 token 이 실려 있으나 그 `headers` 를 **fetch 에 쓰지 않고 폐기** 한다 (cross-host 로는 송신 0 — 이것이 본 ADR 의 핵심 보호). decrypt 된 token 은 in-memory transient 로 GC 대상이며 error/event/log 어디에도 read-back 되지 않는다 ([ADR-0014 §3](ADR-0014-llm-api-key-encryption-at-rest.md)).

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — same-host 제약 정책의 **결정** 만 박제한다. `pnpm add` 0 (Node 내장 `URL`) / 외부 호출 0 / secret 0 / schema migration 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row).
- **두 adapter 가드 구현은 §5 게이트 미발화** — host-check 는 Node 내장 `URL` 만 쓰므로 ([Q-0017](../STATE.json) 제약 정합), follow-up 코드 task 는 [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency" BLOCKED 게이트를 **발화하지 않고** dependency-free 로 진입 가능하다.
- **status PROPOSED 박제** — 본 ADR 은 PROPOSED 로 박제한다. 두 adapter 의 host-check 가드 구현이 머지된 후 별도 direct task 로 ACCEPTED 전이 (ADR-0016/0018 의 PROPOSED→ACCEPTED 패턴 mirror).

## Consequences

### 양의 (positive)

1. **credential leak 차단** — Decision §1·§2 가 foreign host cursor 로의 `Authorization` 송신을 0 으로 만든다 (cross-host fetch 자체를 abort). T-0188 reviewer 가 식별한 cross-host auth-leak MINOR finding 을 transport 계층에서 정책으로 봉합한다 (REQ-044 권한 경계 강화 + [CLAUDE.md §9](../../CLAUDE.md) secret 비노출).
2. **dependency-free** — Decision §1 의 Node 내장 `URL` 비교 → follow-up 가드가 `pnpm add` 0 으로 진입 ([CLAUDE.md §5](../../CLAUDE.md) 게이트 회피). Confluence `parseNextCursor` 가 이미 `URL` 을 쓰므로 새 메커니즘 도입 0.
3. **fail-closed 보수성** — Decision §1 의 strict equal host + malformed → false + Decision §2 의 throw/abort 조합이 "의심스러우면 차단" 으로 수렴 → 보안 default 가 안전 측.
4. **양 adapter 일관** — Decision §3 가 header cursor (GitHub) / body cursor (Confluence) 의 출처 차이를 동일 host-check 규칙으로 수렴 → 두 adapter 의 보안 동작 일관, architect/implementer 환각 ↓.
5. **기존 위상 비파괴** — Decision §2 가 cross-host error 를 두 adapter 의 **기존 도메인 error 계층** 에 한 분류로 더하고 skip-and-continue 에 자연 흡수시켜 ([ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §4](ADR-0018-confluence-adapter-http-transport-contract.md)), PermissionDeniedEvent / PartialCollectionEvent 위상을 건드리지 않음. ADR-0016/0018 supersede 0.

### 음의 (negative) / trade-off

1. **정상 cross-host pagination 차단 risk** — strict equal host 는 GitHub 이 미래에 다른 host 의 cursor (예: pagination 을 별도 CDN host 로 redirect) 를 정상적으로 줄 경우 그 수집을 abort 한다. mitigation: 현 두 adapter 의 정상 cursor 는 모두 same host (Decision §1 근거) — 실제 cross-host 정상 cursor 가 관측되면 host allowlist 도입 supersede ADR 로 확장 (Alternatives §재검토 조건).
2. **abort 의 부분 수집 손실** — Decision §2 가 partial 반환 대신 throw 라, cross-host cursor 직전까지 수집한 page 들이 (해당 adapter 호출 단위에서) 버려진다 (두 adapter 의 기존 "순회 중 throw 시 부분 수집분 버림" 동작과 동형 — [github-adapter.service.ts](../../src/github/github-adapter.service.ts) L210 / [confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) L262). mitigation: cross-host 는 본래 비정상 신호라 부분 수집의 신뢰성도 의심스러움 — loud error 가 silent partial 보다 안전 (Decision §2 근거).
3. **host-check 비용** — 매 next page 마다 `URL` 파싱 2 회 + 문자열 비교. mitigation: 무시 가능한 비용 (page 당 1 회, network round-trip 대비 미미).
4. **follow-up 코드 task 2 개 + error 분류 신설** — 본 ADR 머지 후 두 adapter 각각 host-check 가드 + error 분류 추가 + full R-112 test 가 필요하다 (cross-host happy/abort/malformed/subdomain-reject negative cover). mitigation: adapter 당 cap (300 LOC / 5 파일) 내 소규모 변경 — ADR-first split 의 의도된 분리.

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **GithubAdapter same-host 가드** | `src/github/` — `requestAllPages` next page fetch 직전 host-check 게이트 + `GithubDomainError` cross-host 분류 추가 + mocked-fetch unit (R-112 4 종 + cross-host/subdomain-reject/malformed negative cover) | 본 ADR-0019 머지 후 | **없음 — Node 내장 `URL`, dep 0** |
| **ConfluenceAdapter same-host 가드** | `src/confluence/` — `requestAllPages` 의 `parseNextCursor` 결과 fetch 직전 host-check 게이트 + `ConfluenceCrossHostCursorError` 서브클래스 + mocked-fetch unit (R-112 4 종 + 절대-URL cross-host / relative same-host pass / subdomain-reject / malformed negative cover) | 본 ADR-0019 머지 후 | **없음 — Node 내장 `URL`, dep 0** |
| **ADR-0019 PROPOSED→ACCEPTED** | 두 가드 머지 후 status 한 줄 갱신 (direct) | 두 가드 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) strict equal host (scheme+host+port 정확 일치) + mismatch 시 abort/throw + Node `URL` 비교** (채택) | credential leak 0 (cross-host fetch abort) / dependency 0 (Node 내장 `URL`) / 보수적 fail-closed / 양 adapter 동일 규칙 / 정상 same-host cursor 비파괴 / ADR-0016·0018 supersede 0 | 미래 정상 cross-host cursor 차단 risk (allowlist supersede 로 확장) / 부분 수집 손실 (cross-host 는 본래 비정상이라 허용) | **✓ 채택** ([CLAUDE.md §9](../../CLAUDE.md) + REQ-044 직접 충족) |
| (2) base host 의 subdomain 허용 (suffix 매칭) | 같은 조직 subdomain cursor (예: `uploads.github.com`) 정상 수집 | super-domain 공유 attack surface 확대 (공격자 통제 subdomain 으로 token leak) / public suffix list (eTLD+1) 경계 판정 복잡 + 오판 risk / 현 정상 cursor 는 same host 라 불요 | 기각 — credential scope 최소화 + 단순성 열세 (Decision §1) |
| (3) mismatch 시 Authorization 헤더 drop 후 무인증 계속 fetch | 수집 완전성 시도 / credential 미송신 | 무인증 cross-host egress = 또 다른 공격 surface / 무인증 응답은 인증 실패·무가치 / 추적성 ↓ / 차단이 비용 0 인데 굳이 송신 | 기각 (Decision §2) — 차단 우월 |
| (4) mismatch 시 partial collection 정상 반환 (throw 안 함) | cross-host 직전까지 수집분 보존 / 순회 graceful 종료 | 불완전 수집을 정상 완료로 오인 risk / 보안 신호가 silent / cap 도달 partial (양적 초과) 과 cross-host (신뢰성 손상) 의 의미 혼동 | 기각 (Decision §2) — loud error 가 옳음 |
| (5) host allowlist (config 로 허용 host 목록 명시) | 정상 cross-host 흐름 (CDN / upload host) 유연 지원 | 현 시점 정상 cross-host cursor 가 관측되지 않음 (over-design) / config surface + 운영 복잡도 ↑ / allowlist 오설정 시 leak 재개 risk | 기각 (현 시점) — YAGNI. 정상 cross-host cursor 관측 시 본 대안을 supersede ADR 로 도입 |
| (6) host-check 없이 token 자체를 cross-host 시 redact (헤더에서 token 제거) | 헤더 직렬화 leak 만 방어 | fetch 는 여전히 cross-host 로 나감 ((3) 과 동일 무인증 egress 문제) / leak vector 의 근본 (cross-host 송신) 미차단 | 기각 — 송신 차단이 근본 (Decision §2) |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) GitHub/Confluence 의 정상 pagination 이 cross-host cursor (CDN / upload host redirect 등) 를 주는 것이 실제로 관측되면 Alternatives §5 host allowlist 를 도입하는 supersede ADR. (ii) cross-host cursor 가 빈번히 관측되어 보안 event 영속화/audit 가 필요해지면 cross-host-cursor event entity + emit 정책 ADR. (iii) 두 adapter 외 추가 외부 adapter (예: Jira / GitLab) 가 늘면 본 host-check 규칙을 공유 transport util 로 일반화하는 보강 ADR.

## References

- [docs/tasks/T-0193-same-host-auth-restriction-adr.md](../tasks/T-0193-same-host-auth-restriction-adr.md) — 본 ADR 의 source task (4 축 Acceptance Criteria + Out of Scope)
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) §3 (auth header) / §4 (non-2xx 도메인 매핑 + skip-and-continue) / §5 (Link rel=next pagination) / §6 (순수 builder/parser 경계 + JIT decrypt) — 본 ADR 이 host-check 를 얹는 GitHub transport 계약
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](ADR-0018-confluence-adapter-http-transport-contract.md) §3 (Cloud Basic / Server Bearer) / §4 (도메인 매핑 + SPACE skip-and-continue) / §5 (`_links.next` body cursor — 절대 URL 이 base 무시 = leak vector) / §6 (4 단 경계) — 본 ADR 이 host-check 를 얹는 Confluence transport 계약
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — `requestAllPages` (L213~250) / `fetchAndMap` (L257~301) opaque next URL 을 동일 headers 로 fetch 하는 GitHub leak vector + token 비노출 error message 패턴
- [src/confluence/confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) — `parseNextCursor` (L67~96, `new URL(next, baseUrl)` 가 절대 URL 시 base 무시) / `requestAllPages` (L267~322) 동일 headers fetch — Confluence leak vector
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) §3 — token never-read-back / JIT decrypt (Decision §4 정합 source)
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant (REQ-059) — host 만 비교, cursor 본문 미저장 정합
- [docs/architecture/modules.md](../architecture/modules.md) — GithubModule / ConfluenceModule (서로 import 안 하는 adapter leaf — Decision §3 shared util 판단 경계)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0019 row)
- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` — 내장 fetch / dep 0 제약 (Decision §1 Node `URL` 채택 정합)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — 새 ADR = pr-mode
- [CLAUDE.md §5](../../CLAUDE.md) — 새 dependency BLOCKED 게이트 (본 ADR doc-only + Node 내장 `URL` 라 게이트 미발화)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 값 절대 미기재 (Decision §4 token 비노출 invariant source)

Refs: T-0193, ADR-0006, ADR-0014, ADR-0016, ADR-0018, REQ-044, REQ-059
