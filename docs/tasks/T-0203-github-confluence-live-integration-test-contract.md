---
id: T-0203
title: ADR-0021 박제 — GitHub·Confluence live-integration TEST CONTRACT (env-gated skip-unless-credentialed)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-015, REQ-016, REQ-044, REQ-059]
hqOrigin: Q-0017
hqNote: Q-0017 milestone-3 follow-up — milestone-3 (GitHub + Confluence adapter) 의 live-integration test 계약 ADR. mocked transport 위 3 번째 layer 를 박제.
estimatedDiff: 290
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0021 only (GitHub+Confluence live-test 계약). gating helper/live spec 은 T-0204/T-0205 chain. doc-only enumerated-section new-ADR.
completedAt: 2026-06-03T21:03:42+09:00
mergedAs: 4542f1ebdcd4b80f6b014e638cb6646ac18b774a
prNumber: 177
reviewRounds: 1
---

# T-0203 — ADR-0021 박제: GitHub·Confluence live-integration TEST CONTRACT

## Why

P4 milestone-3 의 GitHub / Confluence adapter 는 mocked-fetch unit + localhost-stub round-trip smoke 까지만 main 에 박제됐고, 실 github.com / 실 Confluence 에는 한 번도 도달하지 않았다 — live 경로는 [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) (Consequences "live 경로 CI 미검증", L123 + 후속 chain "GitHub live-run") 과 [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) (Consequences L146 + 후속 chain "Confluence live-run", L165) 가 **명시적으로 deferred** 한 §5 credential 게이트 항목이다. 사용자가 session #50 에서 milestone-3 live-integration (Q-0017 후속) 을 승인했으므로, milestone-1 이 [ADR-0015](../decisions/ADR-0015-llm-live-integration-test-contract.md) 를 LLM live spec 보다 먼저 박제한 패턴을 mirror 해 **GitHub·Confluence 양측 live-integration test 계약을 단일 ADR-0021 로 선행 박제**한다. 이렇게 하면 (i) reviewer 가 구현 전에 계약 설계를 점검하고, (ii) 후속 credentialed live RUN 이 순수 §5 env-주입 task 로 축소되며, (iii) gating helper / env-gated live spec (T-0204/T-0205) 이 본 ADR 을 단일 source 로 mirror 한다.

## Required Reading

- `docs/decisions/ADR-0015-llm-live-integration-test-contract.md` — milestone-1 live-test 계약 ADR. **본 ADR-0021 이 mirror 할 TEMPLATE** (Decision §1 gating env / §2 skip-in-CI 메커니즘 / §3 live wire shape / §4 timeout·non-2xx 매핑 / 3-layer 경계 표 / Consequences / Alternatives / 후속 task chain 구조).
- `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` — GitHub transport 계약 (3 host variant base URL 라우팅 / `Authorization: Bearer` + `X-GitHub-Api-Version` / non-2xx→도메인 error + 4xx PermissionDeniedEvent / Decision §5 `Link` rel=next pagination). live 계약이 그 위에 얹힘.
- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — Confluence transport 계약 (Cloud `/wiki/rest/api` Basic vs Server `/rest/api` Bearer 라우팅 / Decision §5 `_links.next` body cursor / `start`·`limit` / `CONFLUENCE_MAX_PAGES` cap / 도메인 error 매핑). live 계약이 그 위에 얹힘.
- `src/llm/llm-live-test-gating.ts` (+ `src/llm/llm-live-test-gating.spec.ts`) — gating-helper reference. `resolveLiveTestGating(env): LiveTestGating` 순수 함수 (3 종 env all non-empty → `enabled`, 부분-set → skip + `reason`). 후속 T-0204/T-0205 가 mirror 할 패턴. **본 ADR 은 이 helper 의 gating semantics 를 GitHub·Confluence 로 일반화해 기술**.
- `test/smoke/llm-live.smoke-spec.ts` — env-gated live-spec reference (`gating.enabled ? describe : describe.skip`). 후속 live spec 의 형태 reference.
- `test/smoke/github-adapter-roundtrip.smoke-spec.ts` + `test/smoke/confluence-adapter-roundtrip.smoke-spec.ts` — 본 live 계약이 그 **위에** 얹히는 localhost-stub round-trip smoke (layer 2). live 계약은 이 stub 을 실 endpoint 로 확장하는 layer 3.
- `docs/STATE.json` `humanQuestions[Q-0017]` — milestone-3 승인 + 4 EXACT 제약 (내장 fetch / mocked test / live defer / milestone-1 패턴 재현). 본 ADR 의 motivation.
- 참고: ADR template / status 컨벤션은 위 ADR-0015/0016/0018 의 frontmatter + 본문 구조를 따른다 (`status: ACCEPTED (YYYY-MM-DD)` 형태 — milestone 이 사용자 승인됐으므로 ACCEPTED).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0021-<slug>.md` 신설 — frontmatter (id: ADR-0021 / title / status / date / relatedTask: T-0203 / supersedes: null) + 본문 4 섹션 **Context / Decision / Consequences / Alternatives** (한국어 prose, ADR-0015/0016/0018 구조 mirror).
- [ ] **Decision §(i) — env-var 이름** (실값 0, §9): GitHub 측 `GITHUB_LIVE_TEST` toggle + 3 host (github.com / github.sec.samsung.net / github.ecodesamsung.com) per-host token env (예: `GITHUB_LIVE_TOKEN_PUBLIC` / `_SEC` / `_ECODE` 형태 — 이름만, 실값 0). Confluence 측 `CONFLUENCE_LIVE_TEST` toggle + Cloud-token env + Server-PAT env. 모두 env/secret 주입만 ([ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) enumerable key 패턴 + ADR-0018 Decision §2 instance-keyed 변수와 정합).
- [ ] **Decision §(ii) — skip-in-CI gating semantics**: env 부재/빈 문자열/공백/부분-set → `describe.skip` → 실 네트워크 0 → public CI green. all-required-set → live 활성. `resolveLiveTestGating` 의 trim-후-non-empty AND 판정 + `reason` 보고를 GitHub·Confluence 각각으로 mirror 함을 명시 (helper 코드 자체는 본 ADR scope 외, 위상만 박제).
- [ ] **Decision §(iii) — live endpoint shape (adapter 별)**: GitHub = 실 `api.github.com` (public) / `<host>/api/v3` (Enterprise) REST + `Link` rel=next 실 pagination 1 round-trip 검증. Confluence = 실 Cloud `<workspace>.atlassian.net/wiki/rest/api` + 실 `_links.next` body cursor 검증. 비결정적 본문은 assert 안 함 — 비어있지 않은 메타 1+ + 도메인 매핑 합치만 (ADR-0015 Decision §3 invariant mirror).
- [ ] **Decision §(iv) — timeout + non-2xx → 도메인 error LIVE 매핑**: live 경로의 timeout (jest setTimeout / AbortController 위상) + non-2xx (401/403/404/429/5xx) → ADR-0016 §4 / ADR-0018 §4 의 도메인 error 위상으로 매핑됨을 명시. **stub-validated wire 매핑과 구분** — live 는 실 endpoint 에 의도적 실패를 유도하지 않고 happy round-trip 만 (실패 재현은 layer 2 stub 에 위임, ADR-0015 Decision §4 mirror).
- [ ] **Decision §(v) — 3-layer 경계 표** (ADR-0015 표 mirror): adapter 별 (1) unit mocked-fetch / (2) localhost-stub roundtrip / (3) live-gated 의 fetch · endpoint · credential · CI 동작 열을 박제. GitHub·Confluence 두 표 또는 통합 표.
- [ ] **실 credential VALUE 0** ([§9](../../CLAUDE.md)) — 어떤 GitHub token / Confluence API token / PAT 의 실값도 ADR / 본 task 파일 어디에도 기재하지 않는다. env 변수 **이름/형태** 만.
- [ ] ADR status 는 repo 컨벤션 (ADR-0016/0018 가 `ACCEPTED` — milestone 사용자 승인) 을 따른다. 다른 free 번호 정합 명시 (ADR-0001~0020 점유, ADR-0007 미신설, 본 ADR = 다음 free ADR-0021).
- [ ] `docs/architecture/INDEX.md` 에 ADR-0021 row 1 줄 추가 (ADR-0016/0018 이 INDEX row 추가를 acceptance 에 둔 것과 정합 — INDEX 가 pr 대상 doc 이면 본 task 에 포함, 5 파일 cap 안).
- [ ] **R-112 4-항목 unit test 는 본 task 에 적용 안 함** — 본 task 는 new-ADR doc-only 로 production code 0 LOC / public symbol 0 이라 happy/error/branch/negative unit test 대상이 없다 (분기 없음 — 해당 4 항목 생략). 단 `commitMode: pr` 이므로 R-110 상 tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과를 확인한다 (doc 변경이 기존 test 를 깨지 않음 검증).
- [ ] `scripts/check-spec-presence.sh` 가 `docs/decisions/*.md` 신규 파일을 spec-누락으로 flag 하지 않음 확인 (doc 파일은 spec 대상 아님 — tester 가 CI green 으로 확인).

## Out of Scope

- gating helper 코드 (`src/github/github-live-test-gating.ts` / `src/confluence/confluence-live-test-gating.ts`) + colocated spec — **후속 T-0204 (GitHub) / T-0205 (Confluence)** 가 본 ADR 을 mirror 해 구현. 본 task 는 ADR 박제만.
- env-gated live smoke spec (`test/smoke/github-live.smoke-spec.ts` / `test/smoke/confluence-live.smoke-spec.ts`) 추가 — T-0204/T-0205 책임.
- 실 credential 을 주입한 **live RUN** (실 GitHub token 3 host + Confluence Cloud/Server token 으로 실 네트워크 1 회 실행 검증) — §5 외부 자격증명 게이트, 사용자가 env/secret 로 token 주입해야 진입 (별도 후속 task).
- milestone-1 (LLM) live-integration 관련 일체 — 이미 ADR-0015 + 후속으로 분리됨.
- PermissionDeniedRecord entity 의 Prisma model + DB migration — §5 DB schema 게이트, 별도 task (ADR-0016/0018 후속 chain 공통).
- `src/` / `test/` 아래 어떤 코드 변경도 본 task 에 없음 — ADR doc (+ INDEX 1 row) 만.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR-0015 를 template 으로 ADR-0021 를 작성하고 INDEX row 를 추가, tester 가 R-110 상 `pnpm lint && pnpm build && pnpm test` + check-spec-presence 가 doc 파일을 flag 하지 않음을 확인 (implementer 불요 — production code 0 LOC).

## Follow-ups

- **T-0204 (GitHub, commitMode pr)** — `src/github/github-live-test-gating.ts` + colocated `github-live-test-gating.spec.ts` (R-112 4 항목 + negative cases 충분 cover: 부재/빈/공백/부분-set 각 skip 판정) + `test/smoke/github-live.smoke-spec.ts` (`gating.enabled ? describe : describe.skip` — gating 부재 시 describe.skip → CI green). ADR-0021 Decision §(i)~(v) 를 GitHub 측으로 구현. `resolveLiveTestGating` (ADR-0015/T-0171) 패턴 mirror.
- **T-0205 (Confluence, commitMode pr)** — T-0204 의 Confluence 등가물: `src/confluence/confluence-live-test-gating.ts` + colocated spec + `test/smoke/confluence-live.smoke-spec.ts`. Cloud Basic vs Server Bearer gating 분기 (ADR-0018 Decision §3 정합) 반영.
- **credentialed live RUN task (§5-gated)** — T-0204/T-0205 머지 후, 사용자가 GitHub 3 host token + Confluence Cloud/Server token 을 env/secret 로 주입 (실값 §9 금지) 한 뒤 gated live spec 을 실 네트워크 1 회 실행 검증. §5 외부 자격증명 게이트 — 사용자 credential 제공 시 진입.
