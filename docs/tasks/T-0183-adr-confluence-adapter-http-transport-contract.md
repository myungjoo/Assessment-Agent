---
id: T-0183
title: ADR — ConfluenceAdapter HTTP transport 계약 박제 (내장 fetch / Cloud vs Server base URL / auth header / non-2xx 매핑 / page List pagination / adapter↔gateway 경계)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-034, REQ-044, REQ-059]
estimatedDiff: 240
estimatedFiles: 3
created: 2026-06-03
completedAt: 2026-06-03T06:15:00+09:00
plannerNote: P4 milestone-3 Confluence 측 ADR-first slice — ADR-0016 패턴 mirror, dep0, Q-0017 verbatim 박제, doc-only enumerated × 1.6
runtimeNote: 사용자 invocation 지시 ("문서·코멘트 변경은 PR/리뷰 없이 direct merge") 정합으로 본 doc-only ADR slice 는 pr-mode → direct main commit 으로 처리. cloud env refs/locks/* 403 한계로 ref-CAS 강한 mutex 미가용 (lock 비점유 상태로 진행, STATE.json.lock human mirror 만 갱신). lint+build+test 모두 green (80 suites / 1625 tests pass) 으로 R-110 doc-only delta 검증. acceptance 의 "docs/decisions/INDEX.md" 경로는 저장소 실 구조상 `docs/architecture/INDEX.md` (ADR 매핑표) 가 single source — 그 INDEX 에 ADR-0018 row 1 줄 추가.
---

# T-0183 — ADR ConfluenceAdapter HTTP transport 계약 박제

## Why

Q-0017 (RESOLVED 2026-06-02T21:40) 가 P4 milestone-3 (GitHub adapter + Confluence adapter) 를 EXACT 4 제약 — 내장 fetch / mocked test / live deferred / milestone-1 패턴 mirror — 으로 승인했고, milestone-3 의 GitHub 측 chain (ADR-0016/0017 + T-0173~T-0182 6 task) 이 main 박제 완료됐다. Confluence 측은 ADR-0013 (SPACE 탐색 정책 = page List 기반 + allowlist 순회 + 4xx skip-and-continue) 만 ACCEPTED 상태로 코드 0 LOC. ADR-0013 은 **탐색 정책만** cover 하므로, GitHub 측 ADR-0016 (transport 계약) 과 동형의 **Confluence 측 HTTP transport 계약** ADR 이 코드보다 먼저 필요하다. 본 task 는 ConfluenceAdapter scaffold 코드 task 의 선행 결정 ADR 1개를 단독 박제한다 (CLAUDE.md §1 "코드보다 ADR이 먼저다" + §3.1 rule 4 새 ADR = pr-mode 정합).

## Required Reading

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0017]` — milestone-3 승인 + EXACT 4 제약 (내장 fetch / mocked test / live deferred / milestone-1 mirror) verbatim.
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](../decisions/ADR-0013-confluence-space-traversal-policy.md) — 본 ADR 이 그 위에 transport 계층을 얹는다. 탐색 정책 = page List 기반 + SPACE allowlist 순회 + 4xx skip-and-continue (Decision §1·§2·§3).
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](../decisions/ADR-0016-github-adapter-http-transport-contract.md) — **본 ADR 의 mirror reference**. 축 (1)~(6) 구조 동형 차용 (내장 fetch / base URL 라우팅 / auth header / non-2xx 매핑 / pagination / adapter↔gateway 경계).
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) — Confluence token 도 동일 cipher (`LlmApiKeyCipher` + `LLM_APIKEY_ENC_KEY`) 재사용 결정 박제 — token 전용 키 미신설.
- [docs/decisions/ADR-0017-github-instance-config-source.md](../decisions/ADR-0017-github-instance-config-source.md) — env 기반 config source 패턴 reference. Confluence 도 동형 (`CONFLUENCE_INSTANCES` enumerable key + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) 인지 본 ADR 에서 결정 (또는 별도 후속 ADR 로 defer).
- [docs/architecture/modules.md](../architecture/modules.md) — `ConfluenceModule` row (외부 adapter leaf, 4xx → PermissionDeniedEvent emit 책임).
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §2 T-0142/T-0143 row — 본 ADR 이 unblock 하는 후속 scaffold/exploration task 의 책임 표기. **단 T-0142 row 의 "Confluence client dependency (SDK / fetch 택일) + token credential = §5 BLOCKED 게이트" 표기는 Q-0017 의 "내장 fetch, dep 0" + "live token 만 §5" 결정으로 대체된다 — 본 ADR 에 그 supersede 명시.**
- [README.md](../../README.md) 9–22 행 — Confluence 통합 REQ source (지정 Confluence Service + 다중 SPACE 관리 + 작성자 평가 + 권한 부족 가시화).
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) (전체 read 금지 — 검색만) — milestone-1 의 내장 fetch transport 패턴 (FetchLike default `globalThis.fetch` + @Optional 주입 + non-2xx → throw) reference.
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) + [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) (전체 read 금지 — 구조만) — ADR-0016 의 실 코드 mirror. `parseNextLink` (RFC-5988) / `request` / `requestAllPages` / `fetchAndMap` 경계 패턴.

## Acceptance Criteria

본 task 는 **순수 doc ADR 1개 신설** + INDEX row 추가만 다룬다. 코드 변경 0 LOC. 따라서 R-110/R-112 (unit test 4 카테고리 + coverage threshold) 는 production code 0 LOC 이므로 자연 면제 — 단 R-110 의 "코드 검토 + test 수행" 요구는 `pnpm lint && pnpm build && pnpm test` 가 본 doc-only delta 위에서 green 유지하는지 tester 검증으로 충족.

- [ ] `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` 신설 — frontmatter `id: ADR-0018` / `title` / `status: PROPOSED` / `date: 2026-06-03` / `relatedTask: T-0183` / `supersedes: null`. 본문은 ADR-0016 의 6 축 구조를 mirror 하되 Confluence 도메인에 적합하게 reframe.
- [ ] Decision §1 — 내장 fetch transport (Node `globalThis.fetch` + `@Optional` injectable `ConfluenceFetchLike`, 새 외부 dependency 0). 기각된 대안: `confluence-client-typescript` SDK / atlassian-connect SDK / `axios` / `node-fetch` (Q-0017 EXACT 제약 (1) verbatim 정합).
- [ ] Decision §2 — base URL 라우팅. Confluence Cloud (`https://<workspace>.atlassian.net/wiki/rest/api`) vs Confluence Server/Data Center (`https://<host>/rest/api`) 경로 차이 명시 + base URL 은 instance config 에 풀 URL 로 박제 (`CONFLUENCE_BASE_URL` 직접 read) 또는 host + variant flag 로 분해 중 택일. ADR-0017 의 enumerable key 패턴 차용 여부 결정.
- [ ] Decision §3 — auth header shape. Confluence Cloud = `Authorization: Basic base64(email:api_token)` (REST API token), Confluence Server = `Authorization: Bearer <pat>` (Personal Access Token) 중 instance 별 분기 정책 명시. 추가 필수 header: `Accept: application/json`. ADR-0014 cipher (`LlmApiKeyCipher` + `LLM_APIKEY_ENC_KEY`) 재사용 — 토큰 전용 키 미신설 명시.
- [ ] Decision §4 — non-2xx → 도메인 error 매핑. 401/403 → `ConfluencePermissionDeniedError` + PermissionDeniedEvent emit (ADR-0013 §3 의 "SPACE 단위 skip-and-continue" 위상과 정합 — adapter 는 throw, 상위 service 가 SPACE 순회 중 catch + continue). 404 → `ConfluenceNotFoundError` (SPACE / page 미존재 또는 권한 가림). 429 → `ConfluenceRateLimitedError` (retry-after header 보존). 5xx / network reject → `ConfluenceTransientError`. JSON parse 실패 → `ConfluenceDomainError`.
- [ ] Decision §5 — pagination. Confluence REST 의 `/wiki/rest/api/content` 류 endpoint 는 `_links.next` (relative URL) 기반 cursor + `start` / `limit` query param. GitHub 의 RFC-5988 `Link` header 와 다른 위상 — `parseNextCursor` 가 응답 body 의 `_links.next` 를 읽고 절대 URL 로 재조립. `CONFLUENCE_MAX_PAGES` cap (default 100) + 부분 수집 명시. ADR-0013 §1 page List 탐색 정책의 transport-level 구체화.
- [ ] Decision §6 — adapter↔gateway/service 경계. `src/confluence/` module 안에서 순수 request-builder 함수 (`buildConfluenceRequest`) / 주입 fetch dispatch (`ConfluenceAdapter.request`) / multi-page orchestration (`ConfluenceAdapter.requestAllPages`) / SPACE allowlist 순회 service (`ConfluenceSpaceTraversalService`, ADR-0013 §2 위에서) 의 4 단 경계 박제. token 복호화는 service 직전 JIT (never-read-back, ADR-0014 정합).
- [ ] HITL 경계 명시 — 본 ADR 적용 task chain 의 §5 게이트 미발화 범위 (내장 fetch + mocked test + ADR-0014 cipher 재사용 = dep 0 / schema 0 / credential 0) vs §5 발화 후속 task (PermissionDeniedRecord entity = schema migration / 실 Confluence token live-run = credential). milestone-1 / GitHub 측 패턴 mirror.
- [ ] Consequences §양의 / §음의 / §후속 task chain — ADR-0016 구조 mirror. 후속 chain 예시: T-X (ConfluenceModule wiring + env config parser) → T-Y (token JIT decrypt helper, ADR-0014 cipher 재사용) → T-Z (ConfluenceAdapter request builder + service dispatch + non-2xx 매핑) → T-W (`_links.next` cursor pagination) → T-V (round-trip stub smoke, T-0168 / T-0182 패턴). 각 task 의 §5 게이트 여부 표기.
- [ ] Alternatives considered — `confluence-client-typescript` SDK 추가 / `axios` / `node-fetch` 기각 근거 (Q-0017 EXACT 제약 (1) "dep 0" verbatim) + base URL host+variant 분해 vs 풀 URL 박제 trade-off + Cloud-only 우선 vs Server 동시 지원 trade-off.
- [ ] References — README L9~22 / docs/PLAN.md L83~84 / ADR-0013 / ADR-0014 / ADR-0016 / ADR-0017 / docs/architecture/modules.md ConfluenceModule row / docs/architecture/p4-implementation-plan.md §2 T-0142/T-0143 row + 그 row 의 §5 게이트 표기를 본 ADR 이 supersede 함 명시.
- [ ] `docs/decisions/INDEX.md` 에 ADR-0018 row 1 줄 추가 (id / title / status PROPOSED / date / related task T-0183).
- [ ] 본 ADR 본문은 한국어 (CLAUDE.md §12) — 식별자 / 경로 / HTTP method / header name / status code / enum 토큰만 영어 유지.
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 가 본 doc-only delta 위에서 green 유지하는지 확인 (production code 0 LOC 이므로 신규 spec 미요구, 기존 2815 test suite 전부 pass 유지).
- [ ] **분기 없음 (doc-only delta) — R-112 4 카테고리 / coverage threshold 항목 본 task 에서 자연 면제**. 단 PR body / commit message 에 "production code 0 LOC, R-112 면제 근거: doc-only ADR 신설" 1 줄 명시.

## Out of Scope

- ConfluenceModule / ConfluenceAdapter / ConfluenceSpaceTraversalService 등 **코드 신설 일체 금지** — 본 task 는 ADR 1개 + INDEX row 만. 코드는 후속 chain task 에서 ADR-0018 결정 따라 박제.
- 실 Confluence credential (workspace URL / API token / email) 요청·기재 0. live-run 통합은 별도 §5 게이트 task (milestone-1 의 Q-0016 optionA task 2 와 동형).
- ADR-0013 (SPACE 탐색 정책) 의 결정 자체 변경 0 — 본 ADR 은 그 위에 transport 계층만 얹는다. 페이지 List vs Hierarchy 택일 등 ADR-0013 결정 영역은 건드리지 않음.
- ADR-0017 의 env config source 결정을 Confluence 에 그대로 차용할지는 본 ADR 의 Decision §2 에서 결정 — **별도 신규 ADR (ADR-0019 등) 신설 금지**. 한 task = ADR 1개 원칙 (분리 필요 시 후속 task 로 split, 단 본 task 진행 중 split 결정은 architect 가 plannerNote 에 박제하고 별도 humanQuestion escalate).
- `package.json` / lockfile 변경 0 (Q-0017 EXACT 제약 (1) dep 0 verbatim).
- modules.md / api.md / data-model.md 등 architecture doc 의 동시 update 0 — 본 task 는 ADR 1개 + INDEX 만. doc-sync 는 후속 별도 direct doc-sync task (ADR-0016 → modules.md sync 가 T-0170 으로 분리된 패턴 mirror).
- p4-implementation-plan.md §2 T-0142 row 의 "@octokit/rest / dependency 게이트" 표기 supersede 의 실 inline edit 0 — 본 ADR 본문 References 에 supersede 명시만, plan doc 의 row 자체 수정은 후속 별도 doc-sync task.

## Suggested Sub-agents

architect (ADR 본문 작성 + 6 결정 축 박제) → tester (lint/build/test green 검증, R-110 충족)

## Follow-ups

(creation 시점 empty — 본 task 진행 중 sub-agent 가 발견한 관련 work 를 여기에 append. 예: ADR-0018 status PROPOSED→ACCEPTED 전이는 후속 chain task 머지 후 별도 direct doc-sync task / p4-implementation-plan.md §2 T-0142 row supersede inline edit doc-sync task / ConfluenceModule scaffold + env config parser task / 등.)
