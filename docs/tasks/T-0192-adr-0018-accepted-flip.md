---
id: T-0192
title: ADR-0018 ConfluenceAdapter transport 계약 status PROPOSED→ACCEPTED flip
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044, REQ-034, REQ-059]
dependsOn: []
estimatedDiff: 4
estimatedFiles: 2
created: 2026-06-03
completedAt: 2026-06-03T15:03:10+09:00
plannerNote: "P4 milestone-3 chain row10 — ADR-0018 scaffold(T-0183~T-0191) 전원 merged → status ACCEPTED flip(§3.1 rule4 direct). 이후 dependency-free backlog 소진."
---

# T-0192 — ADR-0018 ConfluenceAdapter transport 계약 status PROPOSED→ACCEPTED flip

## Why

P4 milestone-3 Confluence chain ([PLAN.md](../PLAN.md) Phase P4)의 마지막 dependency-free 단계다. ADR-0018 이 박제한 transport 계약 6 결정 — 내장 fetch transport(§1) / Cloud vs Server base URL 라우팅(§2) / Cloud Basic vs Server Bearer auth(§3) / non-2xx 도메인 매핑 + 4xx→PermissionDeniedEvent(§4) / `_links.next` body cursor pagination(§5) / 4 단 adapter↔service 경계 + JIT decrypt(§6) — 가 후속 scaffold chain(T-0183 ADR + T-0184~T-0190 코드/smoke + T-0191 doc-sync, 전원 `status: DONE`)으로 main 에 전부 realize 됐다. ADR 자신의 후속 chain 표(Consequences §후속 task chain)의 마지막 row "ADR-0018 PROPOSED→ACCEPTED" 가 본 task 다. ADR 의 status 한 줄 갱신은 [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) 에 따라 `direct`.

## Required Reading

- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) — frontmatter `status: PROPOSED` (line 4) + Consequences 후속 chain 표 마지막 row
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR-0018 row(line 40) 의 status 컬럼이 `PROPOSED (T-0183)` 로 표기됨 (동기 갱신 대상)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED` 로 변경 (다른 frontmatter 필드 — `id`/`title`/`date`/`relatedTask`/`supersedes` — 는 불변).
- [ ] `docs/architecture/INDEX.md` 의 ADR-0018 row status 컬럼을 `PROPOSED (T-0183)` → `ACCEPTED (T-0183)` 로 변경.
- [ ] 변경은 위 2 파일의 status 표기뿐 — Decision / Consequences / References 본문은 손대지 않는다 (검증: `git diff --stat` 가 2 파일 + 합 ≤ 6 LOC).
- [ ] direct-mode doc-only commit 이므로 코드 변경 0 — `git diff` 에 `src/` / `test/` / `.github/` / `package.json` 변경이 없음을 확인.

## Out of Scope

- **References 에 code-task SHA(T-0183~T-0190) 추가하지 않는다** — chain SHA 는 `git log --grep "T-018"` 로 이미 추적 가능하며, status flip 의 순수 한 줄 commit purpose 를 유지하기 위해 별도 enrichment 는 생략. 필요 시 follow-up.
- ADR 본문(Decision §1~§6 / Consequences / Alternatives)의 내용 수정 — 본 task 는 status 전이만.
- row8 PermissionDeniedRecord entity (Prisma model + migration) — [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트, 본 task 와 무관.
- row9 Confluence live-run (실 Cloud API token / Server PAT) — [CLAUDE.md §5](../../CLAUDE.md) credential 게이트, 본 task 와 무관.
- `tester` 호출 — direct-mode doc-only 라 [CLAUDE.md §3.2 R-110](../../CLAUDE.md) 면제 (코드 0 LOC).

## Suggested Sub-agents

`implementer`(2 파일 status 한 줄 edit). architect 불요 — 결정은 ADR-0018 에 이미 박제됨. tester 불요 — doc-only direct.

## Follow-ups

(작성 시 비어있음)
