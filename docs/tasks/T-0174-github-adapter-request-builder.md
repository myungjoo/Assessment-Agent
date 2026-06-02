---
id: T-0174
title: GithubAdapter 순수 request-builder + 3 host variant base URL 라우팅 + auth header 조립
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-02
completedAt: 2026-06-02T23:23:52+09:00
prNumber: 158
mergeCommit: 5d43b37
actualDiff: "373 LOC (prod 139 + R-112 spec 234) — sizeExempt"
plannerNote: P4 milestone-3 GithubAdapter 첫 slice(ADR-0016 §2/§3 순수 builder). T-0157 mirror. dep 0/§5 미발화. R-112 backbone ×1.5.
---

# T-0174 — GithubAdapter 순수 request-builder + 3 host variant base URL 라우팅 + auth header 조립

## Why

P4 milestone-3 (GitHub adapter, [PLAN.md L81](../PLAN.md)) 의 첫 vertical slice다. 사용자가 [Q-0017](../STATE.json) 으로 milestone-3 을 승인했고 ([ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 transport 계약 박제), 본 task 는 그 계약의 **순수 함수 layer** ([ADR-0016 Decision §2](../decisions/ADR-0016-github-adapter-http-transport-contract.md) host → base URL 도출 + [§3](../decisions/ADR-0016-github-adapter-http-transport-contract.md) auth header shape) 만 독립 구현한다. milestone-1 의 [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) (T-0157) 가 gateway wiring 전에 순수 `{url, headers, body}` builder 를 먼저 박제한 split 을 정확히 mirror — 부수효과 0 / 외부 의존 0 / 주입 fetch·token decrypt·pagination·error 매핑은 본 slice 밖 (Follow-up). REQ-005/006/007/008 (3 GitHub instance 활동 평가) 의 transport 조립 backbone.

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\decisions\ADR-0016-github-adapter-http-transport-contract.md` — THE 계약. 본 task 는 **Decision §2 (3 host variant base URL 라우팅: github.com → `https://api.github.com`, Enterprise host → `https://<host>/api/v3`) + Decision §3 (`Authorization: Bearer <token>` + `Accept: application/vnd.github+json` + `X-GitHub-Api-Version: 2022-11-28`)** 만 구현. §4 (non-2xx 매핑) / §5 (Link pagination) / §6 (주입 fetch dispatch·JIT decrypt) 는 OUT OF SCOPE (Follow-up).
- `C:\Users\myung\Assessment-Agent\src\llm\providers\openai-compatible.adapter.ts` — mirror 할 순수 builder 패턴 (export interface 입력/출력, `assertNonEmpty` 방어 guard, trailing slash 정규화, header record 조립, 부수효과 0). 본 GithubAdapter builder 가 동형 구조로 작성.
- `C:\Users\myung\Assessment-Agent\src\llm\providers\openai-compatible.adapter.spec.ts` — colocated spec 의 R-112 4 종 + negative 패턴 (happy / 빈 입력 throw / 분기 별). 본 task 의 colocated spec 이 mirror.
- `C:\Users\myung\Assessment-Agent\docs\architecture\modules.md` (L35 GithubModule row) — adapter leaf 위치 + 3 instance host 명시. 본 builder 가 그 leaf 안의 순수 함수.

## Acceptance Criteria

신규 파일 2 개 (colocated spec 우선 — NestJS convention + discoverability):

- `src/github/github-request.builder.ts` — 순수 함수 module (NestJS provider 아님, DI 불요). 다음 export:
  - [ ] `resolveGithubApiBaseUrl(host: string): string` — configured host → REST API base URL 도출. `github.com` → `https://api.github.com`. 그 외 host (Enterprise: `github.sec.samsung.net` / `github.ecodesamsung.com` 포함 임의 host) → `https://<host>/api/v3`. host 빈 값/비 string 은 명확한 Error throw (`assertNonEmpty` 패턴).
  - [ ] `buildGithubRequest(input): GithubRequest` — instance sub-config (host / token) + 대상 path + query 로 `{ url, headers }` 조립. `url = resolveGithubApiBaseUrl(host)` + 정규화된 path (+ query). `headers` = `Authorization: Bearer <token>` + `Accept: application/vnd.github+json` + `X-GitHub-Api-Version: 2022-11-28`. token / path 빈 값은 throw. token 평문 인자로만 받음 (decrypt 는 호출처 책임 — 본 slice 밖).
  - [ ] `GITHUB_API_VERSION` 상수 export (`"2022-11-28"`) — milestone-1 `AZURE_OPENAI_DEFAULT_API_VERSION` 상수 패턴 mirror.
  - [ ] `GithubRequestInput` / `GithubRequest` interface export (입력/출력 타입).
- `src/github/github-request.builder.spec.ts` — colocated R-112 spec:
  - [ ] **Happy path** — `resolveGithubApiBaseUrl("github.com")` → `https://api.github.com`, Enterprise host 2 종 → `https://<host>/api/v3` 각각 검증. `buildGithubRequest` 정상 입력 → 기대 url + 3 header 전부 검증 (Bearer token / Accept / X-GitHub-Api-Version).
  - [ ] **Error path** — `resolveGithubApiBaseUrl("")` / 비 string 입력 throw. `buildGithubRequest` 의 빈 token / 빈 path / 빈 host 각각 throw (각 1+ test).
  - [ ] **Flow / branch coverage** — public github.com 분기 vs Enterprise host 분기 각 1+ test (base URL 도출의 2 분기). query 유 / 무 분기, path trailing-slash 정규화 분기 각 cover.
  - [ ] **Negative cases 충분 cover** — 예외 상황 각 1+: 빈 문자열 host / token / path, 비 string 입력 (number/null/undefined), whitespace-only 입력, host 에 protocol prefix 가 섞인 비정상 입력 처리 (정의한 정규화 규칙대로). 단일 negative 금지 — 각 방어 분기마다 test.
  - [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 순수 함수라 100% 달성 용이.
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — tester 가 확인).
- [ ] CI 의 unit + smoke + e2e 전부 green (R-113 — 실 token 0 / 실 네트워크 0 이므로 §5 미발화).

## Out of Scope

다음은 본 slice 가 **건드리지 않는다** (Follow-up 으로 분리 — diff 작게 유지):

- **주입 fetch dispatch service** — `@Injectable` GithubAdapter service + `FetchLike` 주입 + 실 HTTP 호출 ([ADR-0016 §6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)). 본 slice 는 순수 builder 만 (fetch 호출 0).
- **non-2xx → 도메인 error 매핑 + 4xx → PermissionDeniedEvent emit** ([ADR-0016 §4](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 다음 slice.
- **Link rel=next pagination 순회** ([ADR-0016 §5](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — 다음 slice.
- **token JIT decrypt** (ADR-0014 cipher 재사용, [ADR-0016 §6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) — service slice 책임. 본 builder 는 token 평문 인자만 받음.
- **instance sub-config 의 실 설정 source** (env / DB config 로딩) — config layer 책임. 본 builder 는 host/token 을 인자로만 받음.
- **GithubModule (`github.module.ts`) NestJS wiring** + AppModule 등록 — service slice 이후.
- **GitHub Issue 평가 (R-30) 도메인 로직** — 별도 milestone task.
- **ConfluenceAdapter** — milestone-3 Confluence 측.
- **실 GitHub token / live 네트워크 호출** — §5 credential 게이트 (후속 live-run task, 미승인 deferred).
- **modules.md / p4-implementation-plan 의 `@octokit/rest` → 내장 fetch 표기 doc-sync** — 별도 direct doc-only follow-up (ADR-0016 후속 chain 박제됨).
- **ADR-0016 PROPOSED → ACCEPTED 전이** — service scaffold 머지 후 별도 direct 한 줄 갱신.

## Suggested Sub-agents

`implementer → tester`. **architect 불요** — [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 transport 계약 (host 라우팅 / auth header shape) 을 이미 확정했으므로 새 architecture 결정 / 새 ADR 0. implementer 는 ADR-0016 §2/§3 + [openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) 패턴을 그대로 mirror.

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 append)
