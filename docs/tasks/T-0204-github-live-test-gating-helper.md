---
id: T-0204
title: GitHub live-test gating helper + colocated spec + env-gated github-live smoke 추가
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-016, REQ-044]
origin: ADR-0021 후속 chain (Consequences 표 "T-0204 (GitHub)" row) — milestone-3 GitHub live-integration test layer 3 scaffold
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0021 §(i)~(v) GitHub 측 구현(gating helper + spec + env-gated live smoke). R-112 backbone × 1.5. in-flight chain 직속 후속.
completedAt: 2026-06-03T21:51:34+09:00
mergedAs: 14bb771c1f61c87df56bb6c2134ecc5aa348362f
prNumber: 178
reviewRounds: 1
---

# T-0204 — GitHub live-test gating helper + colocated spec + env-gated github-live smoke 추가

## Why

[ADR-0021](../decisions/ADR-0021-github-confluence-live-integration-test-contract.md) (ACCEPTED, merged 4542f1e) 가 milestone-3 (GitHub adapter + Confluence adapter) 의 **3 번째 test layer (live-gated smoke)** 계약을 박제했고, 그 Consequences 후속 chain 표가 **T-0204 (GitHub)** 를 이 ADR 의 GitHub 측 구현으로 명시했다. 본 task 는 ADR-0021 Decision §(i)~(v) 를 GitHub 측에 구현한다 — (1) 순수 gating helper `resolveGithubLiveTestGating` (`src/llm/llm-live-test-gating.ts` 의 `resolveLiveTestGating` 패턴 mirror, per-host token 부분 활성 지원), (2) colocated spec (R-112 4 항목 + 부재/빈/공백/부분-set 각 skip 판정 negative cover), (3) env-gated `test/smoke/github-live.smoke-spec.ts` (gating env 부재 시 `describe.skip` → public CI green 유지). PLAN.md P4 "GitHub 통합 — 3 instance" + "권한 부족 감지·통지" bullet 을 cover 한다. 새 외부 dependency 0 (Node 내장 fetch), 실 token 0 (gating env 부재 시 skip) — [§5](../../CLAUDE.md) 게이트 미발화.

## Required Reading

- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](../decisions/ADR-0021-github-confluence-live-integration-test-contract.md) — 본 task 의 단일 source. 특히 Decision §(i) GitHub gating env 4 종 (`GITHUB_LIVE_TEST` / `GITHUB_LIVE_TOKEN_PUBLIC` / `_SEC` / `_ECODE`) + per-host 부분 활성 규칙, §(ii) trim-후-non-empty AND 판정 + `describe.skip` 분기, §(iii) live endpoint shape (REST list + Link rel=next 1 round-trip / 비결정 본문 미assert / 메타 1+ assert), §(iv) non-2xx 매핑 위상 (live 는 happy round-trip only), §(v) 3-layer 표 GitHub row.
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — gating helper **mirror 템플릿**. `resolveLiveTestGating` 의 순수 함수 구조 + `isPresent` guard + `reason` 박제 + `LiveTestGating` 반환 shape 를 GitHub per-host 로 일반화. (LLM 은 단일 baseUrl/apiKey, GitHub 은 3 host token 각각 → 반환에 host 별 enabled/token 또는 enabled host 목록 + reason 을 담는다.)
- [src/llm/llm-live-test-gating.spec.ts](../../src/llm/llm-live-test-gating.spec.ts) — colocated spec **mirror 템플릿** (R-112 4 항목 + 부재/빈/공백/부분-set negative). 본 GitHub spec 의 describe/it 구조 reference.
- [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) — env-gated live spec **mirror 템플릿** (`const gating = resolve...(process.env); const d = gating.enabled ? describe : describe.skip;` + `jest.setTimeout` + adapter live wiring). 본 github-live smoke 의 형태 reference.
- [test/smoke/github-adapter-roundtrip.smoke-spec.ts](../../test/smoke/github-adapter-roundtrip.smoke-spec.ts) — layer 2 stub round-trip (본 live 가 layer 3 으로 위에 얹힘). GithubAdapter 호출 패턴 (`request` / `requestAllPages`, `GithubRequestInput` 입력 shape, `FetchLike` / `PermissionDeniedEmitter` 주입) + FAKE_TOKEN §9 안전 패턴 reference.
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) — live smoke 가 호출할 adapter. public surface: `GithubAdapter` (`request(input)` / `requestAllPages(input)`), `FetchLike`, `GithubDomainError`, `PermissionDeniedEmitter`, `NO_OP_PERMISSION_DENIED_EMITTER`. live 는 실 `globalThis.fetch` (fetchFn 인자 생략 → default) 로 실 endpoint 도달.
- [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) — `GithubRequestInput` (host / token / path 등) — live spec 이 enabled host 와 token 을 이 입력으로 조립.
- [test/jest-smoke.json](../../test/jest-smoke.json) — `.smoke-spec.ts` testRegex (신규 live spec 이 자동 픽업되는 근거 — CI/jest 설정 수정 0).

## Acceptance Criteria

- [ ] `src/github/github-live-test-gating.ts` 신설 — 순수 함수 `resolveGithubLiveTestGating(env: NodeJS.ProcessEnv)` + gating env 이름 상수 (`GITHUB_LIVE_TEST_ENV` / `GITHUB_LIVE_TOKEN_PUBLIC_ENV` / `_SEC_ENV` / `_ECODE_ENV`). ADR-0021 Decision §(i) per-host 부분 활성: `GITHUB_LIVE_TEST` AND (해당 host token) 모두 non-empty (trim 후 길이 > 0) 일 때만 그 host 활성. 반환은 host 별 활성 여부 + (활성 host 의) token + `reason` (어느 host 가 어느 env 부재로 skip 됐는지 — 실값 미포함, 이름만, [§9](../../CLAUDE.md)). 부수효과 0 / 실 네트워크 0 / 새 dependency 0.
- [ ] `src/github/github-live-test-gating.spec.ts` (colocated) 신설 — **happy-path**: gating env 전부 set (또는 일부 host set) 시 enabled host 정확히 식별 + token narrowing. **error/negative path** (각 1+, ADR-0021 §(ii) 부분-set 판정): (i) `GITHUB_LIVE_TEST` 부재 → 전 host skip, (ii) host token 부재 → 해당 host skip (나머지 host 영향 0 = 부분 활성), (iii) 빈 문자열 token → skip, (iv) 공백-only token → skip, (v) `GITHUB_LIVE_TEST` 만 set + 전 host token 부재 → 전 host skip. **branch cover**: host 별 활성/비활성 분기 각 1+ test (3 host × {present, absent} 조합 중 대표). `reason` 에 실 token 값이 미포함됨을 assert 하는 §9 안전 test 1+.
- [ ] `test/smoke/github-live.smoke-spec.ts` 신설 — `const gating = resolveGithubLiveTestGating(process.env); const d = gating.enabled? describe : describe.skip;` (또는 host 별 분기). gating env 부재 (= public CI 기본 조건) 시 `describe.skip` → 전 it skip → 실 네트워크 0 → CI green. 활성 시 `GithubAdapter` 가 실 `globalThis.fetch` 로 실 `api.github.com` (public) 또는 `<host>/api/v3` (Enterprise) REST list endpoint 1 회 호출, Link rel=next 있으면 pagination 1 round-trip. **검증 invariant (ADR-0021 §(iii))**: 비결정 본문은 assert 하지 않고 비어있지 않은 메타 1+ (repo/commit 식별자) + 도메인 매핑 합치만 assert. `jest.setTimeout` 상한 (예: 30000ms). 실 credential 값을 spec 어디에도 적지 않는다 (env 출처만, [§9](../../CLAUDE.md)).
- [ ] negative cases 충분 cover — 단일 negative 가 아니라 gating 의 각 부재 분기 (flag 부재 / host token 부재 / 빈 / 공백 / 부분-set) 마다 별도 it. (ADR-0021 §(ii) "부분-set false 판정" + R-112 §3.2 4 항목.)
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 (colocated gating spec 의 unit test green).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (helper 의 모든 분기 cover; `package.json` coverageThreshold 강제). github-live smoke 는 entrypoint 아닌 gated spec 이므로 helper 가 coverage 본체.
- [ ] `pnpm test:smoke` 가 gating env 부재 상태 (CI 기본) 에서 github-live smoke 를 `describe.skip` 으로 건너뛰고 green 유지함을 tester 가 확인 (R-113 — live spec 추가가 CI 를 깨지 않음).

## Out of Scope

- **Confluence 측 등가물** (T-0205 = `src/confluence/confluence-live-test-gating.ts` + colocated spec + `test/smoke/confluence-live.smoke-spec.ts`, Cloud Basic vs Server Bearer gating 분기) — 본 task 이후 별도 task. 본 task 는 GitHub 측만.
- **credentialed live RUN** — 실 GitHub 3 host token 을 env/secret 주입한 뒤 gated live spec 을 실 네트워크로 실제 실행하는 검증은 [§5](../../CLAUDE.md) 외부 자격증명 게이트 (미승인). 본 task 는 scaffold (helper + skip-path) 만, 실 token 0.
- **token-encryption CLI** (`scripts/encrypt-token.ts`, PLAN P4 credential-prep bullet) — 별도 task. 본 task 는 그것에 의존하지 않는다.
- **LLM provider apiKey encryption-at-rest 완결** (prisma `apiKey` plaintext → encrypted, PLAN P4 credential-prep bullet) — 별도 task (§5 schema migration 게이트 가능).
- **GithubAdapter / github-request.builder 동작 코드 변경** — 본 task 는 gating helper + spec 추가만. adapter transport 계약 (ADR-0016/0017) 재결정 0.
- **AbortController 명시 timeout 도입** (ADR-0021 §(iv) trade-off) — 별도 hardening task.
- **PermissionDeniedRecord entity Prisma model + migration** — §5 DB schema 게이트 별도 task.
- **새 dependency 추가** (`pnpm add` octokit/nock 등) 금지 — Node 내장 fetch 만 (Q-0017 제약 (1)).

## Suggested Sub-agents

`implementer → tester` — gating helper 코드 + colocated spec 은 implementer 가, env-gated live smoke 추가 + R-112/R-113 검증 (skip-path CI green 확인) 은 tester 가. ADR-0021 이 계약을 이미 박제했으므로 architect 호출 불요 (새 ADR 0). 단 helper 반환 shape (per-host 부분 활성을 어떤 자료구조로 표현할지) 가 ADR-0021 §(i)~(ii) 범위 안에서 구현 판단이면 implementer 가 결정 (LLM 단일 helper 와 달리 GitHub 은 3 host 라 반환 shape 가 자연 확장).

## Follow-ups

- T-0205 (Confluence live-test gating 등가물) — 본 task 의 Confluence 버전. 다음 planner turn 의 milestone-3 queue 1순위 후보.
- token-encryption CLI (`scripts/encrypt-token.ts`, LlmApiKeyCipher 재사용) — PLAN P4 credential-prep bullet, dependency-free, 사용자 GitHub/Confluence token 주입 선행 조건.
- LLM provider apiKey encryption-at-rest 완결 (prisma `apiKey` plaintext → encrypted JIT decrypt) — PLAN P4 credential-prep bullet, §5 schema migration 게이트 그 task 진입 시 재확인.
- (sub-agent 가 작업 중 발견한 관련 work 를 여기 append.)
