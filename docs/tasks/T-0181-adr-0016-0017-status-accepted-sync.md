---
id: T-0181
title: ADR-0016 + ADR-0017 status PROPOSED→ACCEPTED 동기화 (GithubAdapter transport·config source 구현 완료 반영)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 14
estimatedFiles: 3
created: 2026-06-03
plannerNote: P4 milestone-3 doc-sync — ADR-0016/0017 의 GitHub adapter 계약이 T-0174~0176·T-0178~0180 로 main 박제됐으나 status 가 PROPOSED stale. §3.1 rule 4 direct status 전이. dep-free, §5 미발화.
---

# T-0181 — ADR-0016 + ADR-0017 status PROPOSED→ACCEPTED 동기화

## Why

P4 milestone-3 (GitHub adapter) 의 두 결정 ADR 이 main 에 전부 구현·머지됐는데 frontmatter `status` 와 INDEX.md row 가 아직 `PROPOSED` stale 다. 본 repo convention (ADR-0001~0015 는 결정이 구현·머지되면 ACCEPTED — T-0164/T-0172 precedent) + 두 ADR 자신의 "후속 task chain" 표가 명시한 "PROPOSED→ACCEPTED (구현 머지 후 status 한 줄 갱신, direct, BLOCKED risk 없음)" follow-up 을 본 direct doc-sync 로 처리한다.

- **ADR-0016** (GithubAdapter HTTP transport 계약 — 내장 fetch / 3 host variant base URL / `Authorization: Bearer` + `X-GitHub-Api-Version` / non-2xx→PermissionDeniedEvent / Link rel=next pagination) → T-0174 (request-builder, PR-159) + T-0175 (service dispatch + non-2xx 매핑) + T-0176 (Link pagination, PR #160 squash ff864d3) 로 `src/github/github-adapter.service.ts` + `github-request.builder.ts` 에 main 박제 완료. 그러나 frontmatter `status: PROPOSED` + INDEX.md `PROPOSED (T-0173)` stale.
- **ADR-0017** (GithubModule instance sub-config source — `process.env` instance-keyed config / DB table·@nestjs/config 미채택 / token encrypted-at-rest + JIT decrypt / env→config 순수 함수) → T-0178 (GithubModule wiring + env config parser, PR #162 squash 50fb704) + T-0179 (token JIT decrypt helper, PR #163 squash 3e21c2d) + T-0180 (GithubInstanceClient orchestrator, PR #164 squash 23bf78b) 로 `src/github/github.module.ts` + `github-instance-config.ts` + `github-token-decrypt.ts` + `github-instance-client.service.ts` 에 main 박제 완료. 그러나 frontmatter `status: PROPOSED` + INDEX.md `PROPOSED (T-0177)` stale.

ADR-0015→ACCEPTED 동기화 (T-0172, direct, T-0171 머지 후) 가 정확한 precedent — 본 task 는 그 형식을 2 ADR + INDEX 에 mirror.

## Required Reading

- `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` (frontmatter L1~8 + 본문 제목 L10 blockquote + "후속 task chain" 표) — status 전이 대상 + chain 표 self-reference (scaffold 머지 후 ACCEPTED 명시).
- `docs/decisions/ADR-0017-github-instance-config-source.md` (frontmatter L1~8 + 본문 제목 L10 blockquote L12 + "후속 task chain" 표 L97~106) — status 전이 대상 + chain 표 row 4 (wiring 머지 후 PROPOSED→ACCEPTED) self-reference.
- `docs/architecture/INDEX.md` (L38 ADR-0016 row + L39 ADR-0017 row) — `PROPOSED (T-NNNN)` → `ACCEPTED (T-NNNN)` 갱신 대상.
- `docs/tasks/T-0172-adr-0015-status-accepted-sync.md` (L29~31) — PROPOSED→ACCEPTED 전이의 박제 형식 precedent (frontmatter `ACCEPTED (YYYY-MM-DD)` + 제목 아래 blockquote transition note + chain 표 행 주석).
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` (L1~12) — `ACCEPTED (YYYY-MM-DD)` frontmatter 형식 + 전이 note 형식 mirror 원본.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED (2026-06-03)` 로 변경 (T-0172/ADR-0009 의 `ACCEPTED (YYYY-MM-DD)` 형식 mirror).
- [ ] ADR-0016 본문 제목 (`# ADR-0016 — ...`) 바로 아래 PROPOSED 안내 blockquote (L12) 를 PROPOSED→ACCEPTED 전이 note 로 갱신 — 구현 안착 증거 1~3 줄: transport 계약 (host 라우팅 + 순수 request-builder + non-2xx→PermissionDeniedEvent + Link rel=next pagination) 이 T-0174/T-0175/T-0176 (PR #160 squash ff864d3 등) 로 `src/github/github-adapter.service.ts` + `github-request.builder.ts` 에 머지됨. mocked-fetch unit + adapter cov 100% 박제.
- [ ] `docs/decisions/ADR-0017-github-instance-config-source.md` frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED (2026-06-03)` 로 변경.
- [ ] ADR-0017 본문 제목 (`# ADR-0017 — ...`) 바로 아래 PROPOSED 안내 blockquote (L12) 를 PROPOSED→ACCEPTED 전이 note 로 갱신 — 구현 안착 증거 1~3 줄: GithubModule wiring + env→instance config 순수 함수 parser (T-0178) + token JIT decrypt helper (T-0179, ADR-0014 `LLM_APIKEY_ENC_KEY` 재사용) + GithubInstanceClient orchestrator (T-0180) 가 `src/github/{github.module.ts, github-instance-config.ts, github-token-decrypt.ts, github-instance-client.service.ts}` 에 머지됨. 잔여 GitHub live-run 은 §5 외부 자격증명 게이트로 deferred 임을 1줄 명시.
- [ ] `docs/architecture/INDEX.md` 의 ADR-0016 row (L38) `PROPOSED (T-0173)` → `ACCEPTED (T-0173)`, ADR-0017 row (L39) `PROPOSED (T-0177)` → `ACCEPTED (T-0177)` 로 변경 (originating task ID 는 유지, status 토큰만 전이 — INDEX 의 ACCEPTED row 들이 originating task ID 를 유지하는 기존 패턴 정합).
- [ ] (선택) 두 ADR 의 "후속 task chain" 표의 `PROPOSED→ACCEPTED` 행에 "(본 T-0181 에서 완료)" 한 줄 주석 추가 — 표는 forward-looking 기록이라 주석만으로 충분, 상충 없음.
- [ ] 변경은 위 3 파일 (`ADR-0016...md`, `ADR-0017...md`, `INDEX.md`) 에만 한정 — 다른 ADR · 코드 · spec · modules.md 무변경 (modules.md GithubModule row 는 이미 ADR-0016/0017 pointer + env config 를 정확히 박제 — genuine drift 아님).
- [ ] 분기 없음 — doc-only direct task 라 R-110/R-112 (test 작성·coverage) 비적용. tester 미호출 (코드 변경 0).

## Out of Scope

- 두 ADR 의 본문 결정 내용 (Decision §1~§N · Alternatives · Consequences 본문) 재작성 — status 전이 + 제목 아래 전이 note + chain 표 행 주석만.
- 다른 ADR (ADR-0001~0015 는 이미 ACCEPTED) 의 status 검토.
- GitHub live-run task 착수 — 이는 §5 외부 자격증명 게이트 (ADR-0017 chain row 3, 실 GitHub token 주입) 로, 사용자 credential 주입 시점에 별도 task.
- modules.md / PLAN.md 추가 doc-sync — modules.md GithubModule row 는 이미 ADR-0016/0017 + env config 를 정확히 박제 (genuine drift 아님).
- 새 dependency / schema migration / auth 변경 — 없음 (§5 미발화).

## Suggested Sub-agents

`implementer` 만 (doc-only direct: 2 ADR frontmatter status + blockquote + INDEX 2 row + chain 표 주석). architect 불요 (ADR 결정 본문 무변경), tester 불요 (코드 0). 실제로는 driver 가 direct mode 로 직접 수행해도 무방.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
