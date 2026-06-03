---
id: T-0187
title: ConfluenceAdapter 단일 page service dispatch + non-2xx 도메인 매핑 + 4xx PermissionDeniedEvent emit
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044]
dependsOn: [T-0183, T-0184, T-0185, T-0186]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-03
plannerNote: "P4 milestone-3 ADR-0018 chain row3b — ConfluenceAdapter.request 단일 dispatch + non-2xx 매핑 + 4xx in-memory emit. dep0/schema0/§5 미발화. pagination=row4 OUT."
prNumber: 169
mergedAs: f8c7a5c
reviewRounds: 1
completedAt: 2026-06-03T12:52:51+09:00
---

# T-0187 — ConfluenceAdapter 단일 page service dispatch + non-2xx 도메인 매핑 + 4xx PermissionDeniedEvent emit

## Why

ADR-0018 후속 chain row 3 의 service-dispatch slice 다 (request-builder 는 T-0186 으로 main 박제 완료). [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) Decision §1 (injectable `ConfluenceFetchLike`) + §4 (non-2xx → 도메인 error 매핑 + 4xx → PermissionDeniedEvent emit) + §6 (`ConfluenceAdapter.request` NestJS `@Injectable` 단일 page 경계) 를 구현한다. milestone-3 GitHub 측 [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) 의 `request()` 메서드 (T-0175) 를 직접 mirror 하되, Confluence 도메인 (Cloud/Server, `buildConfluenceRequest` 사용) 으로 reframe 한다. REQ-016 / REQ-044 (접근 권한 부족 가시화) 의 transport 측 경계를 박제한다.

**범위 = 단일 page `request()` 만.** `_links.next` cursor pagination (`requestAllPages`) 은 row4, `ConfluenceSpaceTraversalService` (SPACE allowlist 순회 + skip-and-continue) 은 row5, PermissionDeniedRecord 영속 entity 는 row8 (§5 schema 게이트) — 전부 본 task 밖.

## Required Reading

- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — Decision §1 (injectable `ConfluenceFetchLike`, 새 dep 0), §4 (non-2xx 매핑 표 + 4xx PermissionDeniedEvent emit + adapter throw / service skip-and-continue 책임 분리), §6 (4 단 경계 중 `ConfluenceAdapter.request` 단일 page 위상)
- `src/github/github-adapter.service.ts` — **직접 mirror reference.** `request()` 메서드 + `fetchAndMap` + `mapNon2xx` + `FetchLike` / `GithubDomainError` / `GithubDomainErrorKind` / `PermissionDeniedEvent` / `PermissionDeniedEmitter` / `NO_OP_PERMISSION_DENIED_EMITTER` 패턴. **pagination 부분 (`requestAllPages` / `parseNextLink` / `GITHUB_MAX_PAGES`) 은 본 task 에서 mirror 하지 않는다 (row4).**
- `src/github/github-adapter.service.spec.ts` — spec 구조 mirror reference (happy / non-2xx 각 status / fetch reject / parse-fail / emit 검증 패턴)
- `src/confluence/confluence-request.builder.ts` — 본 adapter 가 호출할 `buildConfluenceRequest` + `ConfluenceRequestInput` / `ConfluenceRequest` 타입 (이미 main 박제)
- `src/confluence/confluence.module.ts` — provider/export 골격. 본 task 가 `ConfluenceAdapter` provider 를 추가 등록할 대상
- `src/llm/llm-http-gateway.service.ts` — `FetchLike` `@Optional()` 주입 default `globalThis.fetch` 패턴 (참조용, 이미 읽힌 GitHub mirror 로 충분하면 생략 가능)

## Acceptance Criteria

구현:

- [ ] `src/confluence/confluence-adapter.service.ts` 신설 — `@Injectable() class ConfluenceAdapter` 와 단일 page `async request(input: ConfluenceRequestInput): Promise<unknown>` 메서드. 흐름: `buildConfluenceRequest(input)` 로 `{ url, headers }` 조립 → 주입 `ConfluenceFetchLike` 로 1 회 fetch (method `GET`) → non-2xx / fetch reject 면 도메인 error 매핑 throw → 2xx 면 `response.json()` 파싱 후 반환.
- [ ] `ConfluenceFetchLike` 함수 타입 export — Node 내장 fetch 의 최소 surface (`{ ok, status, json }`; row4 가 `_links.next` 를 body 에서 읽으므로 `headers` 접근은 불필요 — ADR-0018 §1 "GitHub 보다 단순" 정합). 생성자 `@Optional()` 주입, default `globalThis.fetch`.
- [ ] 도메인 error 위상 — `ConfluenceDomainError` (base, `kind` + `status` + message) + `ConfluenceDomainErrorKind` union (`permission-denied` / `not-found` / `rate-limited` / `transient` / `domain-error`). ADR-0018 §4 표 매핑: 401·403 → `permission-denied`, 404 → `not-found`, 429 → `rate-limited`, 5xx + fetch reject (status undefined) → `transient`, 2xx 인데 JSON parse 실패 → `domain-error`. token 평문은 error message / 직렬화 어디에도 노출 금지 (baseUrl/path/status 만).
- [ ] PermissionDeniedEvent emit — 401·403 매핑 시 주입 `PermissionDeniedEmitter` (port interface) 로 in-memory emit 후 throw (emit 후에도 도메인 error throw — ADR-0018 §4). default 는 `NO_OP_PERMISSION_DENIED_EMITTER` (no-op). **영속 0 / 새 DB entity 0** — GitHub `github-adapter.service.ts` 의 emitter port 패턴을 그대로 mirror (Confluence 전용 신규 interface 를 정의하거나 GitHub 의 것을 재사용하되, adapter 간 직접 import 의존은 피하고 Confluence 모듈 안에서 자기충족하게 둔다). event payload 는 식별 정보만 (`baseUrl` 또는 instance 식별 + `path` + `status`), token 평문 0.
- [ ] `src/confluence/confluence.module.ts` 편집 — `ConfluenceAdapter` 를 provider 로 등록 + export (후속 row4/row5 가 inject). `CONFLUENCE_INSTANCES` provider 는 그대로 유지.

R-112 test (`src/confluence/confluence-adapter.service.spec.ts` colocated 신설):

- [ ] happy-path — 2xx 응답에서 `request()` 가 주입 fetch 를 1 회 호출하고 파싱된 JSON body 를 반환하는 test 1+. Cloud Basic / Server Bearer 두 분기 모두 `buildConfluenceRequest` 결과 url/headers 로 fetch 가 호출됨을 검증.
- [ ] error path — fetch 가 reject (network/DNS/TLS) 하면 `ConfluenceDomainError` (`kind: transient`, `status: undefined`) throw 검증 test 1+.
- [ ] flow / 분기 cover — `mapNon2xx` 의 각 status 분기마다 test 분리: 401, 403, 404, 429, 500 (대표 5xx) 각 1+ → 매핑 `kind` 검증.
- [ ] negative cases 충분 cover (예외 상황 분기마다 1+): (a) 401 → `permission-denied` + emitter.emit 1 회 호출 검증, (b) 403 → 동일 emit 검증, (c) 404 → `not-found` 이고 emit 미호출 검증, (d) 429 → `rate-limited`, (e) 500 → `transient`, (f) 2xx 인데 `response.json()` 이 throw (malformed/빈 응답) → `domain-error` 매핑 throw, (g) emitter 미주입 (default no-op) 상태에서 401 이 emit 으로 crash 없이 throw 까지 도달, (h) error message / event payload 에 token 평문이 포함되지 않음 검증 (Basic base64 / Bearer token 노출 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 `confluence-adapter.service.ts` 의 모든 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- **`_links.next` cursor pagination (`requestAllPages` / `parseNextCursor` / `CONFLUENCE_MAX_PAGES`)** — ADR-0018 §5, chain **row4** (별도 task). 본 task 는 단일 page `request()` 만. GitHub mirror 의 `requestAllPages` / `parseNextLink` / `GITHUB_MAX_PAGES` 는 복사하지 않는다.
- **`ConfluenceSpaceTraversalService` (SPACE allowlist 순회 + 4xx catch skip-and-continue)** — ADR-0018 §6 4단 경계 중 4번, chain **row5** (별도 task). 본 adapter 는 4xx 를 throw 까지만 — skip-and-continue control flow 는 service layer 책임.
- **PermissionDeniedRecord entity / 실 persistence** — chain **row8**, §5 DB schema 게이트 (별도 task). 본 task 의 emit 은 in-memory port (no-op default) 까지만 — Prisma model / migration 0.
- **token JIT decrypt 의 실 wire** — `decryptConfluenceInstanceToken` (T-0185 main 박제) 호출은 instance config 순회 wiring (row4/row5) 책임. 본 adapter 의 `request()` 는 이미 복호화된 평문 token 을 담은 `ConfluenceRequestInput` 을 받는다 (builder 와 동일하게 cipher 호출 0).
- **실 Confluence token + 실 네트워크 live-run** — §5 credential 게이트, chain row9 (별도 task). 본 task 는 mocked-fetch unit 만 (실 token 0 / 실 네트워크 0 / public CI green).
- **round-trip stub smoke** — chain row6 (별도 task). 본 task 는 unit 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
