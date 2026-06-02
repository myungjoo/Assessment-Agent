---
id: T-0173
title: ADR — GithubAdapter HTTP transport 계약(내장 fetch / 3 host variant 라우팅 / auth header / non-2xx 매핑 / pagination / adapter↔gateway 경계)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-02
plannerNote: P4 milestone-3 승인(Q-0017) 첫 slice — ADR-first. GithubAdapter transport 계약을 코드보다 먼저 박제(내장 fetch, dep 0). ADR-first split stage ×1.3.
---

# T-0173 — ADR: GithubAdapter HTTP transport 계약

## Why

사용자가 P4 milestone-3 (GitHub adapter + Confluence adapter) 를 [STATE.json Q-0017](../STATE.json) 으로 승인했다. 핵심 제약은 **HTTP transport = Node 내장 fetch (globalThis.fetch), 새 외부 dependency 0** (octokit/axios/node-fetch 추가 금지) 이며, test 는 mocked-fetch unit, 실 token live 통합은 별도 후속 task 로 deferred 다. [PLAN.md L81](../PLAN.md) ("GitHub 통합 — 3 instance 모두: github.com / github.sec.samsung.net / github.ecodesamsung.com. 각 instance 의 URL·org·token 설정 분리") 가 이 milestone 의 source 다.

[CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 4](../../CLAUDE.md) (새 ADR 은 pr-mode) 에 따라, `GithubAdapter` scaffold 코드 task 의 **선행 결정 ADR** 을 본 task 가 단독 박제한다. milestone-1 이 ADR-0014(key 암호화) + ADR-0015(test 계약) 를 코드보다 먼저 박제한 것과 동형 — milestone-3 은 ADR-0013(Confluence 탐색) 이 Confluence 측만 cover 하므로, GitHub adapter 의 **HTTP transport 계약** (3 host variant 라우팅 / auth header shape / non-2xx 매핑 / REST pagination / adapter↔gateway interface 경계) 을 cross-cutting 결정으로 본 ADR 이 확정한다.

## Required Reading

- `docs/STATE.json` — humanQuestions Q-0017 (본 task 의 승인 근거 + 4 EXACT 제약: 내장 fetch / mocked test / live token defer / Q-0016 패턴 재현).
- `docs/PLAN.md` L79–88 (Phase P4 단락) — GitHub 3-instance 통합 (L81) + GitHub Issue 평가 (L82) bullet.
- `docs/architecture/modules.md` — GithubModule row (3 instance 단일 GithubAdapter service + instance key sub-config, 4xx catch → PermissionDeniedEvent emit, adapter leaf) + LlmModule row (mirror 할 milestone-1 transport 패턴 박제).
- `docs/architecture/p4-implementation-plan.md` §2 표 T-0140 row (GithubModule scaffold 책임) + §4 인간 승인 게이트 1 (단 '@octokit/rest dependency' 표기는 Q-0017 의 '내장 fetch, dep 0' 로 대체 — ADR 이 이 정합을 명시).
- `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` — frontmatter 형식 + Context/Decision/Consequences/Alternatives 구조 + HITL 경계 단락 + 후속 task chain 표 (본 ADR 이 mirror 할 template, 동시에 Confluence 측 4xx skip-and-continue 정책과의 정합 참조).
- `docs/decisions/ADR-0015-llm-live-integration-test-contract.md` — milestone-1 transport/test 계약 ADR (내장 fetch + mocked test + live defer 패턴의 직접 mirror reference, GitHub 측 동형 박제).
- `src/llm/llm-http-gateway.service.ts` — milestone-1 의 `FetchLike` default `globalThis.fetch` @Optional 주입 + provider dispatch + non-2xx → throw 매핑 패턴 (GithubAdapter transport 가 mirror 할 reference 구현).
- `src/llm/providers/openai-compatible.adapter.ts` — 순수 함수 `{url, headers, body}` builder + response parse + assertNonEmpty 방어 패턴 (GithubAdapter request builder 의 mirror reference).

## Acceptance Criteria

본 task 는 **doc-only ADR 신설** (production code 0 LOC). architect 가 ADR 을 작성하고, tester 는 R-110 에 따라 `pnpm lint && pnpm build && pnpm test` 가 ADR 추가만으로 깨지지 않음을 확인한다 (코드 변경 0 이므로 신규 spec 없음 — 아래 R-112 항목 참조).

### ADR 신설

- [ ] `docs/decisions/ADR-NNNN-github-adapter-http-transport-contract.md` 신설 — 다음 free ADR 번호 사용 (현재 ADR-0001 ~ ADR-0015 점유 확인 → ADR-0016). status PROPOSED. Context/Decision/Consequences/Alternatives 한국어 본문 ([§12](../../CLAUDE.md)).
- [ ] **Decision — 내장 fetch transport**: HTTP transport 는 Node 내장 `globalThis.fetch` 사용, 새 외부 dependency 0 (octokit/axios/node-fetch 추가 금지) 을 명시 박제. milestone-1 `FetchLike` default `globalThis.fetch` @Optional 주입 패턴을 mirror — 테스트 시 inject 한 fetch mock 으로 검증.
- [ ] **Decision — 3 host variant 라우팅**: github.com / github.sec.samsung.net / github.ecodesamsung.com 의 base API URL 분리 (예: `https://api.github.com` vs Enterprise 의 `https://<host>/api/v3`) + instance key sub-config (URL / org / token) 분리 라우팅을 명시. 단일 `GithubAdapter` service + instance key 로 라우팅 ([modules.md](../architecture/modules.md) GithubModule row 정합).
- [ ] **Decision — auth header shape**: GitHub REST 의 `Authorization` 헤더 형태 (예: `Authorization: token <pat>` 또는 `Bearer <pat>`) + 필수 헤더 (`Accept: application/vnd.github+json`, `X-GitHub-Api-Version`) 를 명시. 실 token 값은 본 ADR scope 외 (후속 live-run task, env 주입).
- [ ] **Decision — non-2xx 매핑**: 4xx (특히 401/403/404 권한 부족) → `PermissionDeniedEvent` emit 경계 ([modules.md](../architecture/modules.md) "4xx catch → PermissionDeniedEvent emit" + ADR-0013 Confluence 측 4xx 정책과의 정합) + 그 외 non-2xx 의 throw/error 매핑 위상을 명시. abort vs skip-and-continue 위상은 instance/repo 단위 경계로 박제.
- [ ] **Decision — REST pagination**: GitHub REST 의 `Link` 헤더 기반 pagination (`rel="next"` 순회) + per-page 최대화 전략을 명시. raw 미저장 invariant ([ADR-0006](../decisions/ADR-0006-assessment-data-model.md) / REQ-059) 와의 정합 (수집 단위는 commit/issue 메타, raw 본문 transient).
- [ ] **Decision — adapter↔gateway interface 경계**: GithubAdapter 가 순수 request-builder 함수 (`{url, headers, body}` 조립 + response parse) + 주입 fetch dispatch 로 분리되는 milestone-1 패턴 mirror. 어느 부분이 순수 함수 (unit-testable) 이고 어느 부분이 service orchestration 인지 경계 박제.
- [ ] **HITL 경계 단락**: 본 ADR 은 결정만 (production code 0 / pnpm add 0 / secret 0). GithubAdapter 실 코드는 후속 task — Q-0017 제약상 **내장 fetch (dep 0) 이므로 §5 의존성 게이트 미발화**, 실 token live 통합만 §5 credential 게이트로 deferred 임을 명시 (milestone-1 Q-0016 optionA task 2 패턴 mirror).
- [ ] **후속 task chain 표**: GithubAdapter scaffold (본 ADR 위 mocked-fetch unit) + GitHub Issue 평가 (R-30) + live-run (credential 게이트) row 박제.
- [ ] **Alternatives**: (1) 내장 fetch (채택) vs (2) octokit SDK (기각 — 새 dependency, Q-0017 제약 위반) vs (3) axios/node-fetch (기각 — 새 dependency) 비교 + p4-implementation-plan T-0140 row 의 '@octokit' 표기가 본 결정으로 대체됨을 명시.
- [ ] `docs/architecture/INDEX.md` 의 ADR 목록에 본 ADR row 1 줄 추가.

### R-112 test 요구

- [ ] **분기 없음 — 이 항목 생략**: 본 task 는 production code 0 LOC (ADR doc + INDEX row 만). 신규 public symbol / 함수 / 분기 0 → happy-path / error-path / branch / negative unit test 대상 없음. tester 는 신규 spec 작성 없이 R-110 회귀 확인만 수행 (기존 suite green 유지).

### CI 검증 (R-110)

- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 ADR doc + INDEX row 추가가 기존 suite 를 깨지 않음을 확인 (doc 변경이라 회귀 0 기대).
- [ ] PR 본문에 task 링크 + acceptance checklist + "smoke/e2e 영향 0 (doc-only ADR)" 명시.

## Out of Scope

- **GithubAdapter 실 코드 작성** — service class / request-builder 함수 / response parser / instance 라우팅 구현은 후속 task (본 ADR 머지 후, mocked-fetch unit 동반). 본 task 는 transport 계약 결정만.
- **`pnpm add` 실행** — Q-0017 제약상 내장 fetch 이므로 dependency 추가 0. 어떤 패키지도 추가하지 않는다.
- **실 GitHub token 자격증명 처리** — 실값 주입·실 네트워크 호출은 후속 live-run task (§5 credential 게이트). 본 ADR 은 env 변수 **이름/형태**만 박제 가능, 실값 0 ([§9](../../CLAUDE.md)).
- **Confluence adapter 측 결정** — ConfluenceAdapter 는 ADR-0013 (탐색 정책) 위에서 별도 task. 본 ADR 은 GitHub transport 계약만 (단, 공통 내장-fetch 패턴은 Confluence 도 mirror 가능함을 Consequences 에 언급 가능).
- **GitHub Issue 평가 (R-30) 로직** — 본인 follow-up 카운트 제외 invariant 등은 후속 task (T-0141 매핑). 본 ADR 은 transport 계층만.
- **p4-implementation-plan.md / modules.md 의 '@octokit' → '내장 fetch' doc-sync** — 별도 follow-up direct doc task. 본 ADR 은 Alternatives 에서 대체 사실만 명시, 기존 doc 수정 0.
- **STATE.phase / counters 갱신, PLAN.md P4 bullet status 표기** — driver single-writer 책임 ([§9](../../CLAUDE.md)) / 별도 follow-up.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR 신설 + INDEX row 박제, tester 가 R-110 회귀 확인 (코드 변경 0 이라 implementer 불요).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- (예상, planner 가 지금 큐잉하지 않음) **GithubAdapter scaffold** — 본 ADR 의 transport 계약 위에서 `GithubAdapter` service (3 host variant 라우팅 + 순수 request-builder + 주입 fetch dispatch + 4xx → PermissionDeniedEvent + Link pagination) + mocked-fetch unit test. 내장 fetch (dep 0) 이라 §5 미발화, dependency-free 진입 가능. R-112 4 카테고리 spec 동반.
- (예상) **p4-implementation-plan.md / modules.md doc-sync** — T-0140 row 의 '@octokit/rest dependency 게이트' 표기를 Q-0017 의 '내장 fetch, dep 0' 로 정합 (direct doc-only).
- (예상, §5 게이트) **GitHub live-run** — 실 GitHub token (3 host variant) env/secret 주입 후 live smoke/e2e (실값은 §9 에 따라 파일 금지). milestone-1 Q-0016 optionA task 2 패턴 mirror.
- (예상) **ConfluenceAdapter scaffold** — ADR-0013 (탐색) + 본 ADR 의 내장-fetch 공통 패턴 위에서 Confluence 측 adapter (별도 task).
