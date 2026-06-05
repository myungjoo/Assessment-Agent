---
id: T-0245
title: live smoke spec 을 unbounded requestAllPages 에서 단일 bounded request 로 교정
phase: P4
status: DONE
commitMode: pr
prNumber: 210
mergedCommit: 85793cf
doneAt: 2026-06-05
coversReq: [REQ-059]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-06-05
hqOrigin: Q-0024
plannerNote: "P4 milestone-3 patch — Q-0024(1b). live smoke 가 unbounded /repositories·/content 에 requestAllPages → 30s timeout fail. single request() 로 bounded round-trip 교정 (test-only)."
result: "DONE/MERGED PR-210(squash 85793cf, reviewer APPROVE r1/7 0 findings, 4-게이트 PASS, CI green). credentialed live re-run(github.com PAT, repo 밖 secrets.env §9): github-live happy PASS — 실 api.github.com round-trip 885ms, repo 식별 메타 verified. milestone-3 GitHub public live VERIFIED. Confluence·Enterprise(sec/ecode) host 는 token 미제공으로 skip(미검증, 추후 token 제공 시 동일 spec 재실행)."
---

# T-0245 — live smoke spec 을 unbounded requestAllPages 에서 단일 bounded request 로 교정

## Why

milestone-3 credentialed live run (Q-0024 option 1b) 에서 발견된 결함을 고친다. T-0204/T-0205 의 env-gated live smoke spec 2 개가 adapter 의 `requestAllPages(...)` 를 **unbounded list endpoint** 에 대해 호출한다 — GitHub 측은 `/repositories` (전역 public repo 목록), Confluence 측은 `/content`. `requestAllPages` 는 per_page/limit 을 최대화하고 `Link rel=next` (GitHub) / `_links.next` (Confluence) cursor 를 `MAX_PAGES=100` 까지 순차 추종한다. 실 `api.github.com/repositories` 응답은 **항상** `rel="next"` 를 실어주므로 (`&since=...; rel="next"` 확인) live test 가 최대 100 회 순차 HTTP 호출 → spec 의 `jest.setTimeout(30000)` 초과 → happy-path `it` 이 30s timeout 으로 FAIL (TCPWRAP open handle). transport/auth/network 자체는 건강함이 독립 검증됨 (authenticated 단일 GET `api.github.com/repositories?per_page=1` → HTTP 200, ~0.76s, 유효 repo array). 즉 결함은 순수하게 **unbounded endpoint 에 requestAllPages 를 쓴 spec 의 선택** 이지 transport/auth/adapter-core 가 아니다.

live SMOKE 는 실 transport/auth/URL/headers/parse round-trip 을 실 endpoint 에 **1 회** 증명하면 충분하다. 다중 page cursor 추종은 이미 layer-2 localhost-stub round-trip spec (`github-adapter-roundtrip` / `confluence-adapter-roundtrip`, ADR-0021 Decision §(v) 3-layer 표 layer-2) 이 cover 한다. live happy-path 는 timeout + rate-limit + 비용 회피를 위해 bounded 해야 한다 (ADR-0021 §(iv) live=happy-only 원칙과 정합).

## Required Reading

- `test/smoke/github-live.smoke-spec.ts` — happy `it.each` 가 `requestAllPages` 호출 (line ~69). 교정 대상.
- `test/smoke/confluence-live.smoke-spec.ts` — happy `it` 이 `requestAllPages` 호출 (line ~67). 교정 대상.
- `src/github/github-adapter.service.ts` — `request(input): Promise<unknown>` (line ~263, "단일 요청 1 회만" — Link 순회 안 함, 파싱된 JSON body 반환) vs `requestAllPages(input): Promise<unknown[]>` (line ~287). 단일 page 호출 메서드 시그니처/반환 shape 확인.
- `src/confluence/confluence-adapter.service.ts` — `request(input): Promise<unknown>` (line ~326) vs `requestAllPages(input): Promise<unknown[]>` (line ~353). 동형 확인.
- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` — §(iii) invariant (비결정 본문 미assert, 비어있지 않은 메타 1+ 존재만 assert), §(iv) live=happy round-trip only, §(v) 3-layer 표 (layer-2 가 pagination cover 함을 확인).
- `test/jest-smoke.json` — smoke runner config (skip-path 검증 명령에 사용).

## Acceptance Criteria

- [ ] `test/smoke/github-live.smoke-spec.ts` 의 live happy `it.each` 가 `requestAllPages` 대신 **단일 bounded** `request(input)` 를 호출한다. `requestAllPages` 호출이 live happy-path 에서 0 회 (grep 으로 확인 가능).
- [ ] `test/smoke/confluence-live.smoke-spec.ts` 의 live happy `it` 이 동일하게 `requestAllPages` 대신 `request(input)` 를 호출한다.
- [ ] `request()` 는 단일 page 의 파싱된 JSON 을 반환한다 (`Promise<unknown>`). 두 spec 모두 반환값에서 list array 를 도출 (GitHub `/repositories` 는 top-level array, Confluence `/content` 는 body `results[]`) 한 뒤 ADR-0021 §(iii) invariant — 비어있지 않은 array + 첫 항목이 도메인 식별 메타 (GitHub: id/full_name/name/node_id 중 1+, Confluence: id/title/type/status 중 1+) 를 가진 객체 — 를 assert. 반환 shape 에 맞게 array 도출 로직 조정 (GitHub 은 array 직접, Confluence 는 `results` 추출 — 정확한 shape 은 adapter `request()` 반환 + ADR-0021 §(iii) 로 확정).
- [ ] gating + `describe.skip` + sanity `it` 을 그대로 보존한다 — live env 부재 시 전 suite skip → CI green 유지. GitHub 은 `it.each(enabledHosts)` per-host 순회, Confluence 는 scheme-label 단일 `it` 구조 유지.
- [ ] `jest.setTimeout(30000)` 유지 (제거/변경 금지).
- [ ] tester: live env 부재 상태에서 `pnpm exec jest --config test/jest-smoke.json` 실행 시 두 live spec 이 모두 skip 되고 전체 green (CI parity 검증) — happy-path test 1+ 등가 (skip path 가 정상 통과).
- [ ] negative/branch: gating env 부재 → describe.skip 경로 (CI default) 가 통과함을 명시 검증. 본 task 는 spec 자체 수정이라 production code 분기 추가 0 — gating helper 분기는 기존 (T-0204/T-0205) test 가 이미 cover, 본 task 는 그 분기를 변경하지 않음. live happy `it` 내부에 새 분기 추가 안 함 (단일 request 호출 + invariant assert 만).
- [ ] regression: 본 task 가 patch (`hqOrigin: Q-0024`) 이므로 — live happy-path 가 `requestAllPages` 가 아니라 단일 `request()` 를 쓴다는 사실이 spec 구조 자체로 박제됨 (재발 시 grep 으로 catch). 추가 별도 regression unit 은 불요 (live spec 은 env-gated 라 CI 에서 미실행 — skip-path green 검증이 곧 regression 보호).
- [ ] `src/` behavior 변경 0 — 기존 `request()` 를 그대로 사용. 만약 `request()` 가 없거나 array 도출 불가한 shape 라 사소한 src 조정이 불가피하면 그 사실을 PR body 와 Follow-ups 에 명시하고 reviewer 가 판단 (PREFER test-only fix).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 변경이라 production coverage 영향 0, 기존 threshold 유지 확인.

## Out of Scope

- credentialed live RUN 자체 (merge 후 driver 가 env 주입해 재실행 — Follow-up).
- AbortController 명시 timeout hardening (별도 task, ADR-0021 §(iv)).
- Confluence Server/Cloud auth scheme 분기 변경.
- `GITHUB_MAX_PAGES` / `CONFLUENCE_MAX_PAGES` / per_page·limit 상수 변경.
- `requestAllPages` 메서드 자체 수정 (adapter core 무변경 — layer-2 stub spec 이 계속 cover).
- gating helper (`resolveGithubLiveTestGating` / `resolveConfluenceLiveTestGating`) 변경.

## Suggested Sub-agents

`implementer → tester` (test-only 변경 — architect 불요. 단 `request()` 반환 shape 도출에 src 조정이 불가피하다고 판단되면 implementer 가 그 사실을 SUMMARY 에 flag).

## Follow-ups

- credentialed live re-run after merge (driver, env-injected) → record PASS = milestone-3 GitHub/Confluence live verified.
