---
id: T-0186
title: ConfluenceAdapter 순수 request-builder (buildConfluenceRequest — base URL concat + Cloud Basic/Server Bearer auth 분기)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044]
dependsOn: [T-0184, T-0185]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-03
plannerNote: ADR-0018 chain row3 1차 slice — 순수 buildConfluenceRequest (GitHub T-0174 mirror). dep0/schema0/credential0/§5 미발화. service-dispatch 는 row3b Follow-up.
---

# T-0186 — ConfluenceAdapter 순수 request-builder (buildConfluenceRequest)

## Why

ADR-0018(ConfluenceAdapter HTTP transport 계약)의 후속 chain row 3 = "ConfluenceAdapter request-builder + service dispatch + non-2xx 매핑"의 **1차 slice**다. milestone-3 GitHub 측은 이 영역을 순수 request-builder(T-0174 `github-request.builder.ts`)와 service dispatch(T-0175 `github-adapter.service.ts`)로 **분리**했다 — 같이 묶으면 cap(≤300 LOC / 5 파일)을 넘기 때문이다. 본 task 는 그 분리를 정확히 mirror 하여 **순수 함수 `buildConfluenceRequest` 만** 박제한다: ADR-0018 Decision §2(풀 base URL + relative path concat) + Decision §3(Cloud Basic `email:api_token` base64 vs Server Bearer `<pat>` auth 분기 — `authUser` 존재 여부로 분기 + `Accept: application/json` 필수 header) + `assertNonEmpty` 방어. 실 fetch dispatch / non-2xx → 도메인 error 매핑 / `_links.next` pagination 은 **본 slice 밖**(Follow-ups 의 row 3b service-dispatch task). REQ-009/010/015(지정 Confluence Service 내 다중 SPACE 활동 평가 backbone) + REQ-016/044(권한 부족 가시화)의 transport 조립 계층을 dependency-free 로 연다.

## Required Reading

- `C:/Users/myung/Assessment-Agent/docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — Decision §1(injectable fetch, 본 slice 는 미사용이나 경계 이해용), **Decision §2**(base URL 라우팅 — 풀 base URL 직접 박제 + relative path concat + trailing slash 정규화), **Decision §3**(Cloud Basic vs Server Bearer auth header + `Accept` + `AUTH_USER` 존재 여부로 분기), **Decision §6**(4 단 경계 중 1번 `buildConfluenceRequest` 순수 함수의 책임 = `{url, headers}` 조립, token 평문 인자만)
- `C:/Users/myung/Assessment-Agent/src/github/github-request.builder.ts` — **직접 mirror reference**. `assertNonEmpty` guard / `normalizeHost`(여기선 base URL 정규화로 변형) / `buildGithubRequest`(url concat + query append + 필수 header) 패턴을 Confluence 도메인으로 reframe
- `C:/Users/myung/Assessment-Agent/src/llm/providers/openai-compatible.adapter.ts` — 순수 `{url, headers, body}` builder + `assertNonEmpty` 방어의 milestone-1 원형(부수효과 0 / 외부 의존 0 / 평문 인자)
- `C:/Users/myung/Assessment-Agent/src/confluence/confluence-instance-config.ts` — `ConfluenceInstanceConfig`(필드: `key`, `baseUrl`, `authUser: string | null`, `tokenEnc`, `spaceAllowlist`). 본 builder 의 입력 source — `baseUrl`(풀 REST API base URL) + `authUser`(Cloud Basic email 또는 null=Server Bearer) 가 분기 입력
- `C:/Users/myung/Assessment-Agent/src/confluence/confluence-token-decrypt.ts` — `decryptConfluenceInstanceToken`. builder 는 **평문 token 을 인자로만** 받는다(decrypt 는 호출처 = service-dispatch slice 책임). 책임 경계 확인용

## Acceptance Criteria

구현 (deliverable):

- [ ] `src/confluence/confluence-request.builder.ts` 신설 — 순수 함수 모듈(NestJS provider 아님, DI 불요, 부수효과 0 / 외부 의존 0 / 새 dependency 0). 다음을 export:
  - [ ] `ConfluenceRequestInput` interface — 입력: `baseUrl: string`(instance 의 풀 REST API base URL), `authUser: string | null`(Cloud Basic email 또는 null=Server Bearer 분기 입력), `token: string`(평문 token — Cloud 는 API token, Server 는 PAT. decrypt 는 호출처 책임), `path: string`(relative REST path, 예: `/content`), `query?: Record<string, string>`(선택 query param).
  - [ ] `ConfluenceRequest` interface — 반환: `{ url: string; headers: Record<string, string> }` (GitHub `GithubRequest` 와 동형, adapter 간 직접 의존 0 위해 동형 신규 타입).
  - [ ] `buildConfluenceRequest(input: ConfluenceRequestInput): ConfluenceRequest` — `url` = `baseUrl`(trailing slash 정규화) + 단일 slash + 정규화된 `path` (+ optional `query` 를 `URLSearchParams` 로 인코딩 append). `headers` = auth 분기(아래) + `Accept: application/json`(ADR-0018 §3 필수). 빈 `baseUrl` / `path` / `token` 은 `assertNonEmpty` 로 명확한 Error throw.
  - [ ] **auth scheme 분기**(ADR-0018 §3): `authUser` 가 non-empty string → `Authorization: Basic <base64(`authUser:token`)>` (Cloud). `authUser` 가 `null` / 빈 / 공백 → `Authorization: Bearer <token>` (Server). 분기는 builder 안에서 완결(호출처에 if-분기 누출 0).
- [ ] base URL 정규화 — `baseUrl` 의 trailing slash 유무, `path` 의 leading slash 유무와 무관하게 단일 slash 로 join(GitHub builder 의 path 정규화 mirror).
- [ ] token 평문 비노출(ADR-0018 §3, CLAUDE.md §9) — error message / 직렬화 어디에도 token / Basic base64 결과를 싣지 않는다(식별 정보는 path 등만).

R-112 test (colocated spec — `src/confluence/confluence-request.builder.spec.ts`):

- [ ] **happy-path** 1+: (a) Cloud(`authUser` 존재) 입력 → url 정확 concat + `Authorization: Basic <기대 base64>` + `Accept: application/json`. (b) Server(`authUser` null) 입력 → 동일 url + `Authorization: Bearer <token>`.
- [ ] **error path** 1+: 빈/공백 `baseUrl`, 빈/공백 `path`, 빈/공백 `token` 각각 → `assertNonEmpty` Error throw(각 1+).
- [ ] **flow/branch cover**: auth 분기 양쪽(Cloud Basic / Server Bearer) + query 있음/없음(빈 객체·undefined 는 미append) + trailing/leading slash 정규화 분기 각 1+ test.
- [ ] **negative cases 충분 cover**: `authUser` 가 빈 문자열·공백-only → Bearer 로 분기됨(Cloud 오분기 안 함) / `query` 빈 객체 → `?` 미append / base URL 에 trailing slash 있을 때 이중 slash 안 남김 / token 이 error message 에 미노출(throw message 에 token substring 부재 assert) / base64 인코딩이 정확(`authUser:token` 순서) — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 builder 파일은 순수 함수라 100% 도달 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- **service dispatch** — `ConfluenceAdapter.request`(@Injectable, 주입 fetch dispatch) / non-2xx → `ConfluenceDomainError` 매핑 throw / 4xx → PermissionDeniedEvent emit. 본 slice 는 **순수 builder 만** — 실 fetch 0, NestJS provider 0. (Follow-ups row 3b)
- **`_links.next` cursor pagination** — `parseNextCursor` / `requestAllPages` / `CONFLUENCE_MAX_PAGES` cap (ADR-0018 §5, chain row 4)
- **`ConfluenceSpaceTraversalService`** — SPACE allowlist 순회 + skip-and-continue (ADR-0018 §6, chain row 5)
- **token JIT decrypt 호출** — builder 는 평문 token 을 인자로만 받는다. decrypt(`decryptConfluenceInstanceToken`) 호출은 service-dispatch slice 책임
- **ConfluenceModule wire** — `confluence.module.ts` 에 builder/adapter provider 등록은 service-dispatch slice 에서(builder 는 순수 함수라 provider 불요)
- **PermissionDeniedRecord entity / Prisma schema** — §5 schema 게이트 (별도 task)
- **실 Confluence token live-run** — §5 credential 게이트 (별도 task)

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(row 3b, 차순위) ConfluenceAdapter service dispatch + non-2xx 매핑** — `src/confluence/confluence-adapter.service.ts` 신설: injectable `ConfluenceFetchLike`(default `globalThis.fetch`) 주입(ADR-0018 §1) + `ConfluenceAdapter.request`(buildConfluenceRequest 조립 → fetch → status 분기) + `ConfluenceDomainError`(kind: permission-denied/not-found/rate-limited/transient, ADR-0018 §4 표) + 401/403 → PermissionDeniedEvent emit + JSON parse. mocked-fetch unit(R-112 4종 + negative 충분). GitHub `github-adapter.service.ts`(T-0175) mirror. dep0/schema0/credential0/§5 미발화. 본 T-0186 머지 후 큐잉.
- (row 4) `_links.next` cursor pagination — `parseNextCursor`(relative/absolute 분기) + `requestAllPages` + `CONFLUENCE_MAX_PAGES` cap (ADR-0018 §5, GitHub T-0176 mirror)
- (row 5) `ConfluenceSpaceTraversalService` — SPACE allowlist 순회 + 4xx catch → emit + skip-and-continue (ADR-0018 §6, ADR-0013 §2/§3)
