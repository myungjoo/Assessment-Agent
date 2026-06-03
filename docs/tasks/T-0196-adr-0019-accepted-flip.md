---
id: T-0196
title: ADR-0019 status PROPOSED→ACCEPTED flip (두 same-host 가드 머지 완료 박제)
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-044]
estimatedDiff: 3
estimatedFiles: 2
created: 2026-06-03
completedAt: 2026-06-03
actualDiff: 2
actualFiles: 2
reviewRounds: 0
completionNote: orphan /loop #47 이 큐잉했으나 미실행으로 남긴 task 를 manual driver 가 회수·실행 (ADR-0019 frontmatter status 1줄 + INDEX.md 41행 status 컬럼 1줄). direct doc-only, R-110 면제.
plannerNote: P4 ADR-0019 chain 3행 — GitHub(T-0194)+Confluence(T-0195) 두 가드 머지 완료 → status-line flip(direct, §3.1 rule4)
---

# T-0196 — ADR-0019 status PROPOSED→ACCEPTED flip

## Why

ADR-0019 (pagination cursor same-host Authorization 제약 정책) 는 "코드보다 ADR이 먼저다" 원칙(CLAUDE.md §1)에 따라 `status: PROPOSED` 로 먼저 박제됐고, 두 adapter 가드 구현이 머지되면 별도 direct task 로 ACCEPTED 전이하기로 ADR 본문(§Decision §HITL 경계 + Consequences chain 표 128행)에 명시돼 있었다. 그 선행 조건인 GithubAdapter 가드(T-0194, merge `4c62edc`)와 ConfluenceAdapter 가드(T-0195, merge `b0e5279`)가 모두 머지됐으므로, ADR-0016/0018 의 PROPOSED→ACCEPTED 패턴을 mirror 해 status 한 줄을 ACCEPTED 로 전이한다. 이는 두 가드가 실제로 main 에 안착했다는 사실을 ADR status 로 기록하는 정당한 closure 작업이다 (make-work 아님). ADR status-line 한 줄 갱신이므로 commitMode 는 `direct` (CLAUDE.md §3.1 rule 4).

## Required Reading

- `docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md` — frontmatter 4행 `status: PROPOSED` (전이 대상). 본문 101행("status PROPOSED 박제")·128행(chain 표 "ADR-0019 PROPOSED→ACCEPTED" 행) 은 **historical 서술이라 그대로 둔다** (아래 Out of Scope 참조 — ADR-0018 mirror).
- `docs/architecture/INDEX.md` — 41행 ADR-0019 row 의 status 컬럼 `PROPOSED (T-0193)` (전이 대상).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md` 의 frontmatter 4행을 `status: PROPOSED` → `status: ACCEPTED` 로 변경. (다른 frontmatter 필드는 무변경.)
- [ ] `docs/architecture/INDEX.md` 41행 ADR-0019 row 의 마지막 status 컬럼을 `PROPOSED (T-0193)` → `ACCEPTED (T-0196)` 로 변경. (ADR-0014~0018 row 들이 `ACCEPTED (T-NNNN)` 형식인 것과 정합.)
- [ ] 위 두 변경 외 production code(`src/`·`test/`·`web/`)·CI(`.github/workflows/`)·dependency manifest(`package.json`/lockfile) 변경 0 (direct-mode doc-only 검증). `git diff --stat` 으로 변경 파일이 위 2개(또는 STATE/journal 포함 driver bookkeeping 파일)뿐임을 확인.
- [ ] (분기 없음 — doc status-line 단순 치환이라 R-112 test 4종 비해당. direct-mode doc-only commit 은 CLAUDE.md §3.2 R-110 면제, tester 미호출.)

## Out of Scope

- ADR-0019 **본문**의 historical 서술 — 101행("status PROPOSED 박제 … 머지 후 별도 direct task 로 ACCEPTED 전이")·120~128행 Consequences chain 표("ADR-0019 PROPOSED→ACCEPTED" 행)·Decision/HITL 경계 단락 — 은 **수정하지 않는다**. ADR-0018(frontmatter ACCEPTED 이나 본문 166행 "PROPOSED→ACCEPTED" 서술 보존) 패턴을 그대로 mirror — 본문은 결정 시점의 의도를 기록한 historical record 이므로 frontmatter status 와 INDEX row 만 전이.
- 어떤 `src/`·`test/`·`web/` 코드 변경도 금지 (두 가드는 이미 T-0194/T-0195 로 머지됨).
- §5 HITL 게이트 항목 착수 금지 — ADR-0019 chain 표의 row8 PermissionDeniedRecord entity(DB schema 게이트)·row9 live-run(credential 게이트) 는 본 task 범위 밖이며 사용자 승인 전까지 BLOCKED.
- 새 ADR 작성·다른 ADR status 변경 금지.

## Suggested Sub-agents

direct-mode doc-only task 라 sub-agent dispatch 불요 — driver 가 직접 2개 status-line edit 후 main 에 direct commit + push. (executor 경유 없이 driver loop 의 direct-mode 분기로 처리, LOOP.md §1.)

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append.)
