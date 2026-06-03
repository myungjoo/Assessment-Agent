---
id: T-0205
title: Confluence live-test gating helper + env-gated live smoke 추가 (milestone-3 live-test scaffold 완결)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-06-03
plannerNote: P4 milestone-3 — T-0204(GitHub gating) 의 Confluence 대칭 mirror. ADR-0021 Decision §(i) Confluence row(Cloud Basic vs Server Bearer) 박제 helper + env-gated live smoke 로 live-test scaffold 완결.
---

# T-0205 — Confluence live-test gating helper + env-gated live smoke 추가

## Why

P4 milestone-3 의 live-integration test scaffold 를 **대칭으로 완결**한다. 직전 머지된 T-0204 (`src/github/github-live-test-gating.ts` + colocated spec + `test/smoke/github-live.smoke-spec.ts`, 14bb771) 의 Confluence 등가물을 ADR-0021 Decision §(i) 의 **Confluence row** (Cloud-token / Server-PAT 분기) 에 맞춰 박제한다. ADR-0021 의 후속 task 표 (`T-0205 (Confluence)`) 와 T-0203/T-0204 Follow-ups 가 본 task 를 명시적으로 호명한다. milestone-1 의 `src/llm/llm-live-test-gating.ts` (`resolveLiveTestGating`) 가 원형 template 이고, GitHub 의 *3 host per-host token* 일반화 대신 Confluence 는 *단일 endpoint + scheme 분기 (Cloud Basic vs Server Bearer)* 로 reframe 한다. 본 task 가 머지되면 milestone-3 의 3-layer live-test scaffold (mocked unit → localhost-stub smoke → env-gated live smoke) 가 GitHub·Confluence 양측 모두 완결된다.

## Required Reading

- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` — 본 task 의 단일 source 계약. 특히 **Decision §(i)** 의 Confluence env 표 (L67~76: `CONFLUENCE_LIVE_TEST` / `CONFLUENCE_LIVE_BASE_URL` / `CONFLUENCE_LIVE_AUTH_USER` / `CONFLUENCE_LIVE_TOKEN` + gating 완전성 규칙) + **Decision §(ii)** (trim-후-non-empty AND 판정 + describe.skip 분기) + **Decision §(iii)** (live wire invariant) + **Decision §(v)** 의 Confluence 3-layer 표 (L114~120, layer 3 row = `test/smoke/confluence-live.smoke-spec.ts` 신설).
- `src/github/github-live-test-gating.ts` — **갓 머지된 GitHub mirror** (T-0204). 반환 shape (`{ enabled, reason, ... }`) · `isPresent` guard · `reason` 박제 (실값 미포함, env 이름만) 패턴을 Confluence 단일-endpoint + scheme 분기로 reframe.
- `src/github/github-live-test-gating.spec.ts` — GitHub gating helper 의 colocated spec. R-112 4 종 (happy / error / branch / negative — flag 부재 · base URL 부재 · token 부재 · 빈 · 공백 · 부분-set 각 별도 it) 의 test 구조를 mirror.
- `test/smoke/github-live.smoke-spec.ts` — GitHub live smoke (T-0204). `describeLive = gating.enabled ? describe : describe.skip` 분기 + jest.setTimeout + happy round-trip + sanity it 구조를 Confluence 로 reframe.
- `src/llm/llm-live-test-gating.ts` — 원형 template (`resolveLiveTestGating` 의 단일-endpoint binary gating). Confluence 는 이쪽에 가까우나 scheme 분기 (`CONFLUENCE_LIVE_AUTH_USER` non-empty → Cloud Basic, 부재 → Server Bearer) 가 추가된다.
- `src/confluence/confluence-adapter.service.ts` — `ConfluenceAdapter.request()` (단일, L309) / `requestAllPages()` (cursor pagination, L336) + `ConfluenceDomainError` (L201). live smoke 가 호출할 adapter 진입점.
- `src/confluence/confluence-request.builder.ts` — `ConfluenceRequestInput` (L28: `baseUrl` / `authUser: string | null` / `token` / `path` / `query?`). live smoke 가 조립할 입력 shape. **scheme 분기는 `authUser` 가 결정** (non-empty → Cloud Basic, null/빈 → Server Bearer).
- `test/smoke/confluence-adapter-roundtrip.smoke-spec.ts` — layer 2 localhost-stub round-trip (T-0190). 본 live smoke 가 그 위에 layer 3 으로 얹힌다. import 경로 · suffix · CI 픽업 규칙 정합 참조.

## Acceptance Criteria

- [ ] `src/confluence/confluence-live-test-gating.ts` 신설 — `process.env` (또는 임의 env map) 를 읽어 Confluence live gating 결정을 계산하는 **순수 함수** `resolveConfluenceLiveTestGating(env)` export. 부수효과 0 / 실 네트워크 0 / 실 credential 0 (env 의 존재·비어있지 않음만 검사, 실값을 코드에 적지 않는다 — CLAUDE.md §9). gating env 이름 상수 (`CONFLUENCE_LIVE_TEST` / `CONFLUENCE_LIVE_BASE_URL` / `CONFLUENCE_LIVE_AUTH_USER` / `CONFLUENCE_LIVE_TOKEN`) 를 export.
- [ ] gating 완전성 규칙 (ADR-0021 Decision §(i) L76): `CONFLUENCE_LIVE_TEST` AND `CONFLUENCE_LIVE_BASE_URL` AND `CONFLUENCE_LIVE_TOKEN` **3 종이 모두 trim-후 non-empty** 일 때만 `enabled === true`. `CONFLUENCE_LIVE_AUTH_USER` 는 gating 필수가 아니며 (부재 시 Server Bearer 로 진행), scheme 분기 입력일 뿐. 반환 shape 는 `{ enabled, reason, baseUrl?, authUser, token?, scheme }` 류 — `scheme` 은 `authUser` non-empty 면 `"cloud-basic"`, 부재면 `"server-bearer"` (정확한 필드명은 implementer 가 GitHub mirror 와 정합되게 결정).
- [ ] `reason` 필드는 어느 env 가 부재해 skip 됐는지 사람에게 보고 — **실 token / base URL 값은 절대 포함하지 않는다** (env 이름만, CLAUDE.md §9).
- [ ] `test/smoke/confluence-live.smoke-spec.ts` 신설 — `const gating = resolveConfluenceLiveTestGating(process.env); const describeLive = gating.enabled ? describe : describe.skip;` 분기로 suite 등록. gating env 부재 (= public CI 기본 조건) → `describe.skip` → 전 it skip → 실 네트워크 호출 0 → **public CI green (token 0)**. live happy round-trip 은 `ConfluenceAdapter.requestAllPages()` 로 실 endpoint content list 호출 후 ADR-0021 Decision §(iii) invariant (비결정 본문 미assert, 비어있지 않은 메타 1+ + 도메인 매핑 합치만 assert) 검증. fetchFn 미주입 (생성자 default `globalThis.fetch`).
- [ ] **Happy-path unit test (R-112 ①)**: `resolveConfluenceLiveTestGating` 의 happy-path — 필수 3 env 모두 set + `AUTH_USER` set → `enabled === true` / `scheme === "cloud-basic"` / token·baseUrl 채워짐. `AUTH_USER` 부재 + 필수 3 set → `enabled === true` / `scheme === "server-bearer"` (양 scheme 분기 각 happy 1+).
- [ ] **Error path unit test (R-112 ②)**: 필수 env 부재 시 (`CONFLUENCE_LIVE_TEST` 부재 / `CONFLUENCE_LIVE_BASE_URL` 부재 / `CONFLUENCE_LIVE_TOKEN` 부재) 각각 `enabled === false` + `reason` 에 해당 env 이름 박제 (실값 미포함) 검증 — 각 env 별 별도 it.
- [ ] **Flow / branch coverage (R-112 ③)**: scheme 분기 (Cloud Basic vs Server Bearer) 양쪽 1+ test. gating enabled true / false 양 분기 1+ test. `reason` 박제 분기 (enabled / skip) 양쪽 1+.
- [ ] **Negative cases 충분 cover (R-112 ④)**: 빈 문자열 · 공백-only · 부분-set (3 필수 중 1~2 만 set) · `AUTH_USER` 만 공백 등 예외 상황을 **각 1+ it** 로 cover (단일 negative 금지 — 예외 처리 분기마다). 부분-set 은 어느 필수가 빠졌든 `enabled === false` 이고 `reason` 이 빠진 env 이름을 보고함을 검증.
- [ ] **Coverage 최소치 (R-112 ⑤)**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, package.json `coverageThreshold.global` 강제).
- [ ] colocated spec 위치 — gating helper 의 unit spec 은 `src/confluence/confluence-live-test-gating.spec.ts` (colocated, T-0204 의 `src/github/github-live-test-gating.spec.ts` mirror). live smoke 는 `test/smoke/confluence-live.smoke-spec.ts` (`.smoke-spec.ts` suffix → `test/jest-smoke.json` testRegex 자동 픽업 → CI "스모크 테스트" step 실행, CI/jest 설정 수정 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (tester 가 실행 결과 확인 — R-110). gating env 부재라 live smoke 는 CI 에서 항상 skip → green.
- [ ] PR 본문에 본 task 파일 링크 + acceptance 체크리스트 + "실 token live RUN 은 §5 credential 게이트로 별도 deferred" 명시.

## Out of Scope

- **GitHub gating** — T-0204 에서 이미 완결 (`src/github/github-live-test-gating.ts`). 재구현 / 수정 금지.
- **실 credential 주입 + credentialed live RUN** — 실 Confluence Cloud API token / Server PAT 의 env/secret 주입 + 실 네트워크 live smoke 1 회 실행 검증은 CLAUDE.md §5 외부 자격증명 게이트 대상 후속 task (ADR-0021 후속 task 표 `credentialed live RUN` row). 본 task 는 gating helper + env-gated skip 경로만, env 변수 **이름/형태** 만 박제 (실값 0, §9).
- **credential-prep CLI (`_TOKEN_ENC` ciphertext 생성)** — 별도 backlog 항목 (LlmApiKeyCipher 재사용). 본 task scope 외.
- **LLM provider apiKey encryption-at-rest 완결** — prisma schema 변경 가능성 = §5 DB-migration 게이트라 본 task 와 무관 (Follow-ups 참조).
- **ConfluenceAdapter / request builder / traversal service 동작 코드 변경** — transport 계약 (ADR-0018) 은 이미 박제됨. live smoke 는 기존 adapter 경로를 그대로 재사용 (live 전용 wire 코드 중복 0).
- **AbortController timeout hardening** — ADR-0021 후속 `live timeout hardening` row (별도 task).
- **ADR-0021 신설/수정** — 이미 ACCEPTED. 본 task 는 그 계약을 mirror 만.

## Suggested Sub-agents

`implementer → tester` (계약은 ADR-0021 이 이미 박제 — architect 불요. gating helper 신설 + colocated spec + env-gated live smoke).

## Follow-ups

(생성 시 비어있음. sub-agent 가 관련 작업 발견 시 append.)
