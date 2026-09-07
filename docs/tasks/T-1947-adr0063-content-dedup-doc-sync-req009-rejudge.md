---
id: T-1947
title: ADR-0063 ACCEPTED 승격 + REQ-009 재판정 + PLAN 99 행 doc-sync
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-009, REQ-032]
estimatedDiff: 45
estimatedFiles: 3
estimatedFilesNote: docs 3 개 (ADR-0063 / requirements.md / PLAN.md) — src·test·prisma·workflow 변경 0
created: 2026-09-07
independentStream: content-fingerprint-dedup
dependsOn: [T-1943, T-1944, T-1945, T-1946]
touchesFiles:
  - docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P5 중복 제거 bullet(PLAN 99 행) — ADR-0063 §Follow-ups (d) doc-sync. (a)~(c) 코드 slice 전량 머지 후 1 회 재판정 (§3.1 once-rule)."
---

# T-1947 — ADR-0063 ACCEPTED 승격 + REQ-009 재판정 + PLAN 99 행 doc-sync

## Why

[ADR-0063](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) `§ Follow-ups (d)` 가 지정한 마지막 문서 slice 다. 같은 ADR 의 코드 chain (a) 지문 helper + mapper 배선 (T-1944, PR #1526 → `ae03ac5b`) · (b) dedup pass 2 + 수집 flow 직렬 합성 (T-1945, PR #1527 → `1b7b9c2f`) · (c) 제거 건수 관측 로그 (T-1946, PR #1528 → `85641398`) 가 **전량 머지** 됐으므로, CLAUDE.md `§ 3.1` 의 "REQ status 재판정 task 는 구현 slice 머지 뒤 REQ 당 1 회" (PLAN `183 행` once-rule) 조건이 지금 충족된다. 문서가 코드보다 뒤처진 상태 (ACCEPTED 아닌 ADR 위에 머지된 구현) 를 닫는 것이 본 task 의 전부다.

**issue-still-relevant pre-check (origin/main `18e8f36e` 실측, 안착 0 확인)**:

- ADR status — `git show origin/main:docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md` frontmatter `status: PROPOSED` + `## Status` 본문이 "**PROPOSED**. 본 ADR 은 결정만 박제하며 코드를 1 LOC 도 만들지 않는다" 로 남아 있다 → **승격 미안착**.
- REQ-009 — `docs/requirements.md` `28 행` 이 여전히 `IN_PROGRESS (… rebase·meld 로 commit ID 가 갈리는 "내용물" 중복 제거 축 부재 …)` 다 → **재판정 미안착**. 같은 파일에 `contentFingerprint` / `dedupGithubActivitiesByContent` 매칭 0.
- PLAN `99 행` — 중복 제거 bullet 의 `implemented-on-main` 서술이 `commit-dedup.ts` (fork/rebase/meld 구조적 중복) 표기에 머물고 ADR-0063 · pass 2 좌표가 없다 → **갱신 미안착**.
- 반대로 코드 축은 전부 안착 확인 — `src/assessment-collection/domain/commit-content-fingerprint.ts` `17 행` `CONTENT_FINGERPRINT_MIN_LENGTH = 20` · `72 행` `computeCommitContentFingerprint`, `commit-dedup.ts` `118 행` `dedupGithubActivitiesByContent`, `github-collection.service.ts` `133 행` 합성 + `142 행` 로그. 즉 본 task 는 문서 잔여분만 남은 상태다.

오너 게이트 미침범 — PLAN `157 행` (R-91 k6, `test/load` · `package.json` · `ci.yml` 무변경) · `183 행` (본 task 가 바로 그 once-rule 이 허용하는 **1 회** 재판정) 어느 쪽도 건드리지 않는다.

## Required Reading

- [docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) — frontmatter `status` · `## Status` 절 · `## Follow-ups` (a)~(d) (승격 대상 3 지점)
- [docs/requirements.md](../requirements.md) `28 행` — REQ-009 row (재판정 대상 단일 행). 같은 파일 `13 행` 상태 enum 정의 (`IN_PROGRESS` / `DONE` 판정 기준)
- [docs/PLAN.md](../PLAN.md) `99 행` — "중복 제거" bullet (서술 갱신 대상). 참고로 `183 행` = REQ 재판정 once-rule 오너 지시
- [src/assessment-collection/domain/commit-content-fingerprint.ts](../../src/assessment-collection/domain/commit-content-fingerprint.ts) `17 행` (`CONTENT_FINGERPRINT_MIN_LENGTH = 20`) · `72 행` (`computeCommitContentFingerprint`) — 재판정 실측 좌표
- [src/assessment-collection/domain/commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) `64 행` (`dedupGithubActivities`, pass 1) · `118 행` (`dedupGithubActivitiesByContent`, pass 2) — 재판정 실측 좌표
- [src/assessment-collection/github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `133 행` (2-pass 직렬 합성) · `142 행` (제거 건수 로그 1 줄) — 재판정 실측 좌표
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `26 행` (helper import) · `143 행` (commit 분기 지문 산출) — 재판정 실측 좌표

## Acceptance Criteria

- [ ] ADR-0063 frontmatter 가 `status: ACCEPTED` 이고 `## Status` 본문이 "결정만 박제 · 코드 0 LOC" 서술 대신 **(a)~(c) 코드 chain 머지 완료 + 남은 것은 없음** 을 T-1944 / T-1945 / T-1946 과 머지 sha (`ae03ac5b` / `1b7b9c2f` / `85641398`) 로 명시한다. `augments: [ADR-0029]` · `supersedes: null` 은 무변경.
- [ ] ADR-0063 `## Follow-ups` 의 (a) · (b) · (c) 각 항목 머리에 완료 표기 (담당 task ID + PR 번호 + 머지 sha) 가 붙고, (d) 항목에는 본 task ID (T-1947) 가 박힌다. **"(확장 지점, task 아님)" 항목은 미착수 그대로 보존** 한다.
- [ ] `docs/requirements.md` `28 행` REQ-009 상태가 `IN_PROGRESS` → `DONE` 으로 재판정되고, 판정 근거가 **실측 좌표** (`commit-content-fingerprint.ts` `72 행` · `commit-dedup.ts` `118 행` · `github-collection.service.ts` `133 행` · `github-activity.mapper.ts` `143 행`) 로 적혀 있다. 기존 "내용물 중복 제거 축 부재" 문장은 **삭제하지 말고** "T-1947 재판정 시점에 해소" 취지로 갱신 서술을 잇는다 (과거 실측 기록 보존).
- [ ] REQ-009 row 의 7 컬럼 schema (REQ / README 행 / 요약 / kind / 구현 위치 / 검증 위치 / 상태) 가 깨지지 않는다 — `| REQ-009 | 21 | … | FR | P5 | unit | DONE (…) |` 형태로 파이프 개수 유지. `grep -c "^| REQ-009 |" docs/requirements.md` 결과가 `1`.
- [ ] `docs/PLAN.md` `99 행` 중복 제거 bullet 의 `implemented-on-main` 서술에 ADR-0063 링크 + pass 2 (`dedupGithubActivitiesByContent`) + 지문 helper 좌표 + chain task ID (T-1943~T-1946) 가 추가되고, checkbox 는 `[x]` 유지 (이미 `[x]`).
- [ ] 표기 규약 준수 (CLAUDE.md `§ 12`) — 행 범위는 `~` 구분자, 단일 행은 `99 행` 형태, `L` prefix 금지. 신규 작성분에만 적용하고 기존 표기는 소급 치환하지 않는다.
- [ ] 변경 파일이 정확히 3 개 (`docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md` · `docs/requirements.md` · `docs/PLAN.md`) — `git diff --name-only` 로 확인. `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경 0.
- [ ] doc-only direct commit 이므로 R-110 test 의무 면제 대상이나, 문서 링크가 깨지지 않았는지 상대 경로를 눈으로 확인한다 (ADR → `../requirements.md` · `../../src/...`, PLAN → `decisions/ADR-0063-...md`).

## Out of Scope

- `src/` · `test/` · `prisma/` · `web/` 어떤 코드도 건드리지 않는다 (본 task 는 `direct` doc-sync — 코드가 섞이면 `§ 3.1` 위반).
- ADR-0063 의 **결정 내용 변경 금지** — `§ Decision 1~7` 본문 · `§ Alternatives` · `§ Consequences` 는 status 승격과 무관하므로 그대로 둔다 (결정 내용 수정은 `pr` mode 대상).
- ADR-0063 `§ Decision 7` 의 defer 항목 (제거 활동 목록 노출 · Admin 복원 경로) 착수 금지.
- ADR-0063 `§ Follow-ups` 의 "(확장 지점) 파일 경로 축 편입" 을 task 로 승격시키지 않는다.
- REQ-009 **외의** REQ row 재판정 금지 (once-rule 은 REQ 당 1 회 — 다른 REQ 를 묶어 판정하면 왕복 재발).
- PLAN `99 행` **외의** bullet 갱신 금지. 특히 `157 행` k6 게이트 · `109 행` live-LLM 행은 무변경.
- `docs/STATE.json` · `docs/progress/` 는 driver bookkeeping 소관 — 본 task 의 diff 에 포함하지 않는다.
- ADR-0029 (`§ Decision 4`) 본문 수정 금지 — ADR-0063 이 augment 관계임은 ADR-0063 쪽에만 적는다.

## Suggested Sub-agents

`implementer` (doc-only 편집). direct doc-only 이므로 `tester` 는 R-110 면제 대상 — 다만 편집 후 `git diff --name-only` 로 파일 3 개 · 코드 0 변경만 확인한다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
