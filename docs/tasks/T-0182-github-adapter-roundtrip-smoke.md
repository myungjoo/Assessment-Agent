---
id: T-0182
title: GithubAdapter 실 fetch round-trip 을 local stub 서버 smoke 로 검증
phase: P4
status: DONE
commitMode: pr
prNumber: 165
mergedAs: edc37aa
completedAt: 2026-06-03T03:05:00+09:00
reviewRounds: 1
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044, REQ-059]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-06-03
plannerNote: P4 milestone-3 GitHub chain closeout — T-0168 LLM stub 패턴 mirror, 내장 http stub 로 실 fetch transport+pagination 검증(dep0/credential0)
---

# T-0182 — GithubAdapter 실 fetch round-trip 을 local stub 서버 smoke 로 검증

## Why

milestone-3 GitHub chain (config → token decrypt → dispatch → instance client) 은 모두 main 에 머지됐고 unit 수준으로 검증돼 있다. 그러나 기존 unit spec (`src/github/github-adapter.service.spec.ts`) 은 `fetch` 를 jest mock 으로 **대체**하므로 실제 transport 배선 (header 직렬화 · host-routed URL 조립 · non-2xx 실수신 · JSON 파싱 · Link rel=next pagination) 을 통과시키지 못한다. Q-0017 decision 제약 (2) 의 "(선택) 로컬 stub round-trip smoke" 를 mirror 해, Node 내장 `http.createServer` stub 서버에 `GithubAdapter` 가 **실 `globalThis.fetch`** 로 end-to-end 도달하는 경로를 검증한다. milestone-1 의 T-0168 (`test/smoke/llm-gateway-roundtrip.smoke-spec.ts`) 과 정확히 동형이며, 새 외부 dependency 0 / 실 credential 0 / §5 미발화로 GitHub chain 의 transport 잔여 risk 를 닫는다.

## Required Reading

- `test/smoke/llm-gateway-roundtrip.smoke-spec.ts` — mirror 할 reference 패턴 (내장 http stub + ephemeral 포트(0) + beforeAll listen / afterAll close + captured request 검증 + happy/negative).
- `src/github/github-adapter.service.ts` — 검증 대상. `GithubAdapter` 의 `@Optional() fetchFn = globalThis.fetch`, `request(input)` 단일 요청, `requestAllPages(input)` Link rel=next 순회, `GithubDomainError` (kind/status), `PermissionDeniedEmitter` 주입.
- `src/github/github-request.builder.ts` (L25~135 부분) — `buildGithubRequest` 가 조립하는 `{ url, headers }` 형태: host-routed base URL (github.com → `https://api.github.com`, Enterprise host → `https://<host>/api/v3`), `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`. smoke 의 host 인자는 stub 의 host:port 로 향하도록 Enterprise-form path (`/api/v3`) 가 stub 경로와 정합하는지 확인하고, 정합이 어려우면 stub 서버가 모든 path 를 수용하도록 구성.
- `test/jest-smoke.json` — `.smoke-spec.ts` suffix 자동 픽업 확인 (CI/jest 설정 수정 불요).

## Acceptance Criteria

- [ ] `test/smoke/github-adapter-roundtrip.smoke-spec.ts` 신설 — 내장 `node:http` `createServer` 로 stub 서버를 ephemeral 포트(0)에 `beforeAll` 에서 listen, `afterAll` 에서 close (누수 0, 둘 다 await). 새 외부 dependency 0 / 실 credential 0 / 실 GitHub endpoint 0 (모든 통신 localhost stub).
- [ ] **happy-path test 1+** — `GithubAdapter.request()` (또는 `requestAllPages()`) 가 default `globalThis.fetch` (fetchFn 미주입) 로 stub 에 실 도달하고, stub 이 수신한 request 의 method(GET) · path · headers (`authorization` == `Bearer <token>`, `accept` == `application/vnd.github+json`, `x-github-api-version` 존재) 를 captured request 로 검증. 반환 body 가 stub 고정 응답과 일치.
- [ ] **error path test 1+** — stub 이 non-2xx(예: 403)를 실제 wire 로 반환하면 실 fetch 가 `response.ok === false` 를 실수신하고 `GithubAdapter` 가 `GithubDomainError` (kind `permission-denied`, status 403) 를 throw + 주입한 `PermissionDeniedEmitter.emit` 이 host/path/status payload 로 1 회 호출됨을 검증.
- [ ] **flow / 분기 cover** — pagination 분기: stub 이 첫 응답에 `Link: <...>; rel="next"` header 를 실어 보내고 2번째 응답엔 next 부재로 응답하면, `requestAllPages()` 가 실 fetch 로 2 page 를 순회해 양 page array 항목을 flatten 누적함을 검증 (실 Link header 수신 + opaque next URL 추종). (분기 추가 곤란 시 happy/error 만으로도 가하나 가급적 pagination 1 case 포함.)
- [ ] **negative cases 충분 cover** — 최소 2 종 이상의 예외 경로: (1) 위 non-2xx(403→permission-denied+emit) (2) 추가로 5xx(→upstream-error) 또는 malformed JSON(→upstream-error) 또는 404(→not-found) 중 1+ 를 stub 으로 실수신시켜 각 `GithubDomainError.kind` 매핑을 검증. 단일 negative 만으로 부족 — 매핑 분기마다 cover.
- [ ] token 평문이 `GithubDomainError.message` / 직렬화 / emit payload 어디에도 노출되지 않음을 1 assertion 으로 확인 (CLAUDE.md §9).
- [ ] `pnpm test:smoke` 통과 (본 신규 smoke 포함 전 smoke green).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 production code 무변경(smoke spec 만 추가)이라 coverage 임계 영향 0 이어야 하나, tester 가 실행 결과로 확인.

## Out of Scope

- production code(`src/github/*`) 변경 금지 — smoke spec 1 파일만 추가. 만약 adapter 가 stub 도달에 실패하면 결함이므로 follow-up patch task 로 분리(본 task 에서 src 수정 금지).
- 실 GitHub token / 실 네트워크 / live endpoint 통합 — Q-0017 deferred(§5 credential 게이트). 본 smoke 는 localhost stub 만.
- 새 외부 dependency 추가 금지 (octokit/nock/axios 등 — Q-0017 제약 (1), 내장 `node:http` 만).
- rate-limit backoff / Retry-After 구체 검증, instance/repo 단위 skip-and-continue loop 검증 — 후속 slice 책임.
- `GithubInstanceClient` orchestrator 의 다중 instance 순회 smoke — 본 task 는 `GithubAdapter` 단일 instance transport round-trip 만.
- e2e(`test/e2e/`) 로의 확장 — 본 task 는 smoke 레벨만.

## Suggested Sub-agents

`tester` (smoke spec 작성 + 실행) → 필요 시 `implementer`. production code 무변경이라 implementer 비호출 가능 — tester 가 spec 작성 + `pnpm test:smoke`/`lint`/`build`/`test:cov` 검증.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
