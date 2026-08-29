---
id: T-1785
title: ADR-0058 §Status·§Follow-ups closure 표기 + PLAN 132 행 bullet 마커 승격
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-078, REQ-079]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-08-30
independentStream: adr-0058-service-identity-closure
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0058-service-identity-management-api.md
  - docs/PLAN.md
plannerNote: P5 — ADR-0058 (a)~(e) 전량 shipped 인데 ADR §Status·§Follow-ups·PLAN 132 행은 미착수 서술로 남은 drift 를 닫는 doc-only direct slice
---

# T-1785 — ADR-0058 §Status·§Follow-ups closure 표기 + PLAN 132 행 bullet 마커 승격

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` 의 chain (a) ~ (e) 는
[T-1784](T-1784-requirements-req079-continuation-e2e-rejudge.md) 머지로 **전량 shipped** 가 됐다
(REQ-078 · REQ-079 두 row 모두 `docs/requirements.md` `97~98 행` 에서 `DONE`). 그런데 ADR 본문은 아직
"착수 slice 0" · "완료 선언 0" 시점의 서술이고, `docs/PLAN.md` `132 행` 오너 지시 bullet 도 `- [ ]`
미완료 마커 그대로다 — 실측과 문서 사이의 drift 다. 본 slice 는 그 drift 만 닫는다.

[T-1784](T-1784-requirements-req079-continuation-e2e-rejudge.md) 가 Out of Scope 로 명시적으로 미룬
잔여분이 정확히 본 task 의 범위이며, ADR 의 **결정 내용은 1 자도 바꾸지 않고** 진행 상태 표기만
갱신하므로 [CLAUDE.md §3.1](../../CLAUDE.md) rule 4 · rule 5 에 따라 `commitMode: direct` 다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `13~27 행` (§Status), `259~285 행` (§Follow-ups (a) ~ (e))
- [docs/PLAN.md](../PLAN.md) `132 행` — 오너 지시 bullet (R-182~R-183)
- [docs/requirements.md](../requirements.md) `97~98 행` — REQ-078 / REQ-079 row. **shipped slice ID 목록의 정본** (본 task 가 인용할 task ID 는 전부 이 두 row 에서 가져온다)
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode rule 4 · 5) · §12 (언어 정책 · 행 좌표 표기 `R1` / `R4`)

## Acceptance Criteria

- [ ] ADR-0058 `§Status` 에 **closure 문단 1 개 추가**. 기존 `**ACCEPTED**` 문단과 "DB schema 변경 0" · "완료 선언 0" 세 문단의 **원문은 보존**한다 (삭제 · 개작 금지 — ADR merge 시점의 사실 서술이다). closure 는 그 아래 별도 문단으로 `2026-08-30 closure` 임을 밝히고, `§Follow-ups (a) ~ (e)` 가 전량 shipped 이며 그 결과 REQ-078 · REQ-079 가 `DONE` 이고 PLAN `132 행` 이 `[x]` 로 승격됐음을 적는다.
- [ ] ADR-0058 frontmatter 의 `status: ACCEPTED` 는 **그대로 유지** (결정 자체는 불변 — status enum 을 다른 값으로 바꾸지 않는다).
- [ ] `§Follow-ups` 의 (a) · (b) · (c) · (d) · (e) **5 bullet 각각**에 shipped 표기 1 줄 추가 — 근거 task ID + 실측 좌표(파일 경로 또는 `<파일> <N> 행`) 1 개 이상. 인용하는 task ID 는 `docs/requirements.md` `97~98 행` 이 열거한 것만 쓴다 (**임의 ID 신설 금지**).
- [ ] `docs/PLAN.md` `132 행` 의 `- [ ]` 를 `- [x]` 로 바꾸고, bullet 본문 끝에 승격 근거 1 문장 추가 (REQ-078 · REQ-079 가 `DONE` 인 점 + ADR-0058 `§Follow-ups` (a) ~ (e) 전량 shipped). bullet 의 기존 서술은 삭제하지 않는다.
- [ ] 검증: `grep -n "^- \[x\].*ServiceIdentity) 관리 API·UI" docs/PLAN.md` 가 **1 hit**.
- [ ] 검증: `git diff --stat` 결과가 **정확히 2 파일** (`docs/decisions/ADR-0058-service-identity-management-api.md`, `docs/PLAN.md`) 이고 diff ≤ 300 LOC · 코드 0 LOC.
- [ ] 새로 쓰는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) §12 조문 `R1` (구분자는 `~` 하나) · `R4` (단일 행은 `132 행`, `132~132` 금지) 준수. 기존 표기의 전면 소급 치환은 하지 않는다.
- [ ] doc-only direct 라 R-110 tester 의무 · R-112 4 항목 (happy / error / 분기 / negative) 은 **적용 대상 없음** — 위 `git diff --stat` 의 코드 0 LOC 으로 그 사실을 확인한다.

## Out of Scope

- `docs/requirements.md` 수정 **0** — REQ-078 · REQ-079 는 T-1758 · T-1782 · T-1784 가 이미 `DONE` 으로 재판정했다. 재판정 재개 금지.
- `docs/architecture/api.md` 수정 **0** — nested 5 route 는 T-1757 이 `§ 5 82~86 행` 에 이미 박제했다.
- ADR-0058 의 `§Decision` · `§Consequences` · `§Alternatives considered` · `§Out of scope` **실질 변경 0** — 결정 내용을 건드리면 `commitMode` 가 `pr` 로 바뀌어야 한다 ([CLAUDE.md §3.1](../../CLAUDE.md) rule 5).
- `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` **0 LOC**.
- `docs/PLAN.md` 의 다른 오너 지시 bullet (R-158~R-160 · R-164~R-168 · R-175~R-178 · R-187~R-191) 마커 변경 **0**.
- 새 ADR 신설 **0**, 새 외부 dependency **0**.

## Suggested Sub-agents

`implementer` (doc-only direct — 코드 0 LOC 이라 `tester` 생략, R-110 면제 대상).

## Follow-ups

- (없음 — sub-agent 가 발견 시 여기에 append)
