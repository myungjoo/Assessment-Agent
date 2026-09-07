---
id: T-1944
title: commit 내용 지문 helper 신설 + github mapper 배선 (ADR-0063 Follow-up (a))
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-032]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-09-07
independentStream: collection-content-dedup
dependsOn: [T-1943]
touchesFiles:
  - src/assessment-collection/domain/commit-content-fingerprint.ts
  - src/assessment-collection/domain/commit-content-fingerprint.spec.ts
  - src/assessment-collection/domain/github-activity.mapper.ts
  - src/assessment-collection/domain/github-activity.mapper.spec.ts
plannerNote: P5 — ADR-0063 §Follow-ups (a) 첫 구현 slice. 지문 helper 신설 + 유일 소비처(mapper) 동반 배선, R-112 backbone ×1.5 = 210 LOC.
---

# T-1944 — commit 내용 지문 helper 신설 + github mapper 배선

## Why

[ADR-0063](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) 이 직전 slice (T-1943, main `c2f11bc4`) 에서 rebase/meld 내용물 중복 제거 **정책** 을 확정했고, 그 `§ Follow-ups` 가 구현 chain 을 (a) 지문 helper + mapper 배선 → (b) dedup pass + 수집 flow 배선 → (c) 관측 로그 → (d) doc-sync 로 이미 파일·배선 단위로 선박제했다. 본 task 는 그 **(a) 첫 slice** 로, README `21 행` R-21 의 세 축 중 유일하게 코드에 없는 축 (ii) "Meld/Rebase 되어 commit ID 는 다르지만 중복된 내용물" 을 닫는 chain 의 입구다 ([PLAN.md](../PLAN.md) `99 행` 중복 제거 bullet · REQ-009 IN_PROGRESS).

**issue-still-relevant pre-check (origin/main `2e29a36b` 실측)** — (1) `git ls-tree origin/main src/assessment-collection/domain/` 에 `commit-content-fingerprint.ts` **부재** (11 개 domain 파일 중 매칭 0). (2) `git grep -n -i "contentFingerprint\|content-fingerprint" origin/main -- src test` **매칭 0**. (3) [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `119~131 행` `buildMetadata` 는 현재 `titleLength` 하나만 담고 commit 분기 자체가 없다. 즉 본 task 의 변경 의도는 main 에 전혀 안착돼 있지 않다 (부분 안착 0). 새 외부 dependency 0 (Node 내장 `crypto` — [export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `22 행` 선례) · schema 변경 0 · 기존 ADR 충돌 0 (ADR-0029 를 augment) 이므로 CLAUDE.md `§ 5` 게이트 미발화. 오너 게이트 3 종 미접촉 — PLAN `157 행` (k6 부하검증) 은 `package.json` `23~26 행` + `.github/workflows/load-k6.yml` 로 이미 착수돼 본 task 와 자원 경합 0, PLAN `158 행` (per-route perf baseline 신규 slice 금지) 은 `test/perf/` 무변경이라 비해당, PLAN `183 행` (REQ 재판정 왕복 제거) 에 따라 **REQ-009 재판정은 본 task 에서 하지 않고** (b)(c) 머지 후 (d) doc-sync 에서 1 회만 한다.

**소비처 동반 의무 (CLAUDE.md `§ 3`) 판정: 충족** — helper 단독 PR 이 아니라 그 유일 소비처인 mapper 의 `buildMetadata` 배선을 같은 PR 에 포함한다 (ADR-0063 `§ Follow-ups (a)` 의 판정 그대로).

## Required Reading

- [docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) — `§ Decision 1` (산출 지점 = mapper raw→typed 경계, helper 파일 분리) · `§ Decision 2` (정규화 5 규칙 표) · `§ Decision 3` (metadata scalar 저장 · 영속 컬럼 0) · `§ Decision 4` (하한 20 자) · `§ Decision 6` (commit 한정)
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) — `119~131 행` `buildMetadata` (배선 지점), `133~173 행` `mapGithubActivity` (`kind` 가 이미 계산돼 있음 · `metadata: buildMetadata(raw)` 호출부), `1~17 행` 헤더 주석 (REQ-032 서술 — 지문 추가에 맞춰 갱신 대상)
- [src/assessment-collection/domain/github-activity.mapper.spec.ts](../../src/assessment-collection/domain/github-activity.mapper.spec.ts) — 기존 spec 관례 (colocated, 배선 검증 추가 위치)
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~44 행` — `ActivityMetadataValue = string | number | boolean | null` scalar 계약 (지문 문자열이 지켜야 할 타입 경계)
- [src/export/export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `22 행` · `176 행` — `createHash("sha256").update(..., "utf8").digest("hex")` 사내 선례 (새 dependency 0 근거)

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/commit-content-fingerprint.ts` 신설 — 순수 함수 1 개 (예: `computeCommitContentFingerprint(message: unknown): string | undefined`) + 하한 상수 `CONTENT_FINGERPRINT_MIN_LENGTH = 20` export. 부수효과 0 · 외부 의존은 Node 내장 `crypto` 뿐 (`package.json` 무변경).
- [ ] 정규화가 ADR-0063 `§ Decision 2` 의 5 규칙을 **그 순서대로** 구현: (1) `\r\n`·`\r` → `\n`, (2) `Signed-off-by:`·`Change-Id:`·`Reviewed-on:`·`(cherry picked from commit <sha>)` 행 제거 (행 단위·대소문자 무시, **`Co-authored-by:` 는 보존**), (3) 행 내 연속 공백 → 단일 space + 연속 빈 행 → 단일 `\n`, (4) 전체·행끝 trim, (5) 대소문자 보존 (lowercase 금지).
- [ ] digest 는 sha256 hex **64 자 전량** (절단 0). 정규화 결과가 빈 문자열이거나 20 자 미만이면 `undefined` 반환 (지문 미산출).
- [ ] [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) 의 `buildMetadata` 가 `kind` 를 받아 `kind === "commit"` 일 때만 raw commit message (`raw.commit.message`) 로 helper 를 호출하고, 반환값이 `undefined` 가 아닐 때만 `metadata.contentFingerprint` 에 담는다. `mapGithubActivity` 반환 객체에 raw commit message 는 **어디에도 실리지 않는다** (REQ-032).
- [ ] mapper 헤더 주석 (`1~17 행` REQ-032 단락) 에 "지문은 비가역 sha256 파생값이라 raw quote 가 아니다" 를 ADR-0063 `§ Decision 3` 참조와 함께 1~2 줄 추가.
- [ ] **happy-path unit test** — colocated `src/assessment-collection/domain/commit-content-fingerprint.spec.ts` 에 정규화 → 안정적 digest (동일 입력 재호출 시 동일 hex 64 자) 1+ / colocated `github-activity.mapper.spec.ts` 에 commit raw → `metadata.contentFingerprint` 포함 1+.
- [ ] **error path unit test** — helper 에 비-string 입력 (`undefined` · `null` · number · 객체) 을 넣어도 throw 하지 않고 `undefined` 반환 1+ / mapper 에서 `raw.commit` 부재·`message` 필드 부재 시에도 기존 매핑이 깨지지 않음 1+.
- [ ] **분기별 test** — trailer 있음 / 없음, `Co-authored-by:` 는 보존됨 (제거 시와 digest 가 다름), CRLF 와 LF 가 같은 digest, 연속 공백·trailing whitespace 차이가 같은 digest, 하한 미달 / 하한 경계 (정확히 20 자) 각 1+.
- [ ] **negative case test (예외 분기마다 1+)** — (i) 하한 미달 메시지는 `metadata.contentFingerprint` **키 자체가 미포함**, (ii) `kind === "pr"` · `kind === "issue"` 는 지문 미산출 (ADR-0063 `§ Decision 6`), (iii) 대소문자만 다른 두 메시지는 **서로 다른** digest (lowercase 정규화 미채택 검증), (iv) 기존 `titleLength` 메타 동작 회귀 무영향.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **dedup pass 추가 금지** — [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) 는 본 task 에서 **1 LOC 도 건드리지 않는다**. `content:<author>:<digest>` 키의 pass 2 와 2-pass 직렬 합성은 ADR-0063 `§ Follow-ups (b)` slice.
- **수집 flow / service 배선 금지** — [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) 무변경. 제거 건수 관측 로그는 `§ Follow-ups (c)` slice.
- **영속 표면 금지** — `prisma/schema.prisma` 컬럼 신설·migration 0 (ADR-0063 `§ Decision 3`).
- **diff / 파일 목록 축 편입 금지** — v1 digest 입력은 정규화된 commit message 단일 문자열뿐 (ADR-0063 `§ Decision 2`).
- **Confluence·PR/issue dedup 정책 변경 금지** — [page-dedup.ts](../../src/assessment-collection/domain/page-dedup.ts) · 평가-side [evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) 무변경.
- **문서 갱신 금지** — ADR-0063 status flip (PROPOSED → ACCEPTED) · [requirements.md](../requirements.md) REQ-009 재판정 · [PLAN.md](../PLAN.md) `99 행` 갱신은 전부 `§ Follow-ups (d)` doc-sync slice 이며, PLAN `183 행` 오너 지시대로 구현 chain 머지 **후 1 회만** 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 인접 작업을 발견하면 여기에 추가한다.)
