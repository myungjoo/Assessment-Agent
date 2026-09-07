---
id: T-1950
title: Wire algorithmResearchHits derived signal into github-activity mapper buildMetadata
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-019, REQ-032]
independentStream: adr-0064-algorithm-research-uplift
dependsOn: [T-1949]
touchesFiles:
  - src/assessment-collection/domain/github-activity.mapper.ts
  - src/assessment-collection/domain/github-activity.mapper.spec.ts
estimatedDiff: 130
estimatedFiles: 2
created: 2026-09-07
plannerNote: P5 PLAN 103 행 R-38 축 — ADR-0064 §Follow-ups (a) 잔여 github mapper 배선(T-1949 cap 분리분), pr, 2 파일 / ~130 LOC
---

# T-1950 — github mapper buildMetadata 에 algorithmResearchHits 파생 신호 배선

## Why

[PLAN.md](../PLAN.md) `103 행` 품질 분류 (R-37·38) bullet 의 **상향 축** 을 여는 [ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (a)` 중 **잔여 github mapper 배선** 을 닫는다. 직전 T-1949 (PR #1530 → main `c93fb3cf`) 가 판별 helper 신설 + Confluence mapper 배선까지 가져갔고, github 축은 cap (≤ 300 LOC / ≤ 5 파일) 때문에 후속 slice 로 분리됐다. 본 slice 는 그 분리분 하나만 처리한다.

**issue-still-relevant pre-check (origin/main `1509d705` 실측)** — 안착 0 확인:

- `git grep -n "algorithmResearch" origin/main -- src/assessment-collection/domain/github-activity.mapper.ts src/assessment-collection/domain/github-activity.mapper.spec.ts` → **매칭 0 행**. github 축은 mapper 본문 · spec 어디에도 미배선.
- [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `26 행` import 는 `computeCommitContentFingerprint` 단일이고, `129 행` `buildMetadata` 가 담는 키는 `137 행` `titleLength` · `145 행` `contentFingerprint` **2 계열뿐** — 파생 신호 키 부재.
- 반대로 소비 대상 helper 는 이미 안착 — [algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) `16 행` `ALGORITHM_RESEARCH_MIN_HITS` · `64 행` `computeAlgorithmResearchHits`. Confluence 축 선례도 안착 — [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `109~112 행`.
- `git grep -ln "ADR-0064" origin/main -- docs/tasks/` → `T-1948` · `T-1949` 둘뿐이고 `docs/tasks/T-195*` 는 **0 개** — 동일 의도 중복 task 없음.

**대상 kind 판단 (본 slice 의 유일한 설계 결정, ADR 범위 내)**: ADR-0064 `§ Decision 2` 가 대상을 `contributionKind === "document"` 단위로 한정했고, [evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) `8~14 행` 의 정규화 계약이 github `commit` · `pr` → `code` / `issue` → `document` (R-30) 를 박제한다. 따라서 github 축에서 산출 대상은 **`kind === "issue"` 뿐** 이며, commit · pr 은 키를 담지 않는다 — `contentFingerprint` 를 commit 한정으로 담는 `145 행` 관행과 동형의 kind 조건부 산출이다. 새 ADR · 새 dependency · schema 변경 **0** 이라 CLAUDE.md `§ 5` 게이트 미발화.

**소비처 동반 의무 (CLAUDE.md `§ 3`)**: 본 slice 는 helper 신설이 아니라 기존 helper 의 **소비처 배선 자체** 이므로 충족.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — `§ Decision 1` (산출 경계 · scalar 노출 · 0 이면 키 생략) · `§ Decision 2` (대상 kind · 임계) · `§ Decision 5` (영속 표면 0) · `§ Follow-ups (a)` (본 slice 의 잔여 범위와 R-112 축)
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) — `26 행` import · `124~150 행` `buildMetadata` (배선 지점) · `1~19 행` REQ-032 raw-not-stored 주석 계약
- [src/assessment-collection/domain/confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) — `94~114 행` 직전 slice 의 동일 배선 선례 (주석 서술 · 키 생략 관행)
- [src/assessment-collection/domain/algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) — `16 행` · `64~81 행` 호출할 helper 계약 (비-string → `0`, throw 0)
- [src/assessment-collection/domain/github-activity.mapper.spec.ts](../../src/assessment-collection/domain/github-activity.mapper.spec.ts) — `52~85 행` happy fixture · `116~166 행` `contentFingerprint` 배선 describe (본 slice 의 spec 이 mirror 할 구조) · `167~276 행` error / negative describe
- [src/assessment-collection/domain/confluence-activity.mapper.spec.ts](../../src/assessment-collection/domain/confluence-activity.mapper.spec.ts) — `248~322 행` 직전 slice 의 spec 구조 선례
- [src/assessment-evaluation/domain/evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) — `8~14 행` github kind → `contributionKind` 정규화 (대상 kind 근거)
- [docs/PLAN.md](../PLAN.md) `103 행` — 품질 분류 (R-37·38) bullet

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/github-activity.mapper.ts` 가 `./algorithm-research-signal` 의 `computeAlgorithmResearchHits` 를 import 하고, `buildMetadata` 안에서 **호출만** 한다 (판별 로직을 mapper 본문에 복제하지 않는다 — ADR-0064 `§ Decision 1`).
- [ ] 산출은 `kind === "issue"` 분기 안에서만 이뤄진다. `commit` · `pr` 은 `algorithmResearchHits` 키를 **담지 않는다**.
- [ ] 산출값이 `0` 이면 `metadata` 에 키 자체를 담지 않는다 (`contentFingerprint` 하한 미달 관행과 동형).
- [ ] `buildMetadata` 위 주석에 대상 kind 한정 근거 (ADR-0064 `§ Decision 2` + github issue → document 정규화) 를 한국어로 1~4 줄 추가한다.
- [ ] **happy-path (R-112-1)**: (C)+(A) title 을 가진 issue → `metadata.algorithmResearchHits === 2`, (C)+(B) title 을 가진 issue → `2` 각각 1+ test.
- [ ] **error path (R-112-2)**: title 이 비-string (number · null · 객체 등) 인 issue · title 키가 아예 없는 issue 에서 **throw 0** 이고 키 미포함임을 검증하는 test 1+.
- [ ] **분기별 (R-112-3)**: `kind` 3 종 (`issue` 산출 / `pr` 미산출 / `commit` 미산출) 각 1+, 그리고 (C) 단독 → `1` · 3 그룹 동시 매칭 → `3` 각 1+ test.
- [ ] **negative (R-112-4)**: 예외 분기마다 1+ — ① marker 만점 title 을 가진 pr · commit 이어도 키 미포함 ② marker 무관 title issue 는 키 미포함 ③ 빈 문자열 title ④ 기존 `titleLength` 무회귀 (issue 에서 `titleLength` 와 `algorithmResearchHits` 공존) ⑤ 기존 `contentFingerprint` 무회귀 (commit metadata 계약 불변) ⑥ raw title 문자열 자체가 반환 객체 어디에도 누출되지 않음 (REQ-032).
- [ ] spec 은 colocated `src/assessment-collection/domain/github-activity.mapper.spec.ts` 에만 추가한다 (신규 spec 파일 · `test/` 신규 helper 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%, 변경 파일 `github-activity.mapper.ts` 는 line · function 100% 유지.
- [ ] 새 dependency 0 · `prisma/schema.prisma` 변경 0 · 새 ADR 0 · `.github/workflows/` 변경 0 을 diff 로 확인.

## Out of Scope

- ADR-0064 `§ Follow-ups (b)` — `evaluation-algorithm-research-signal.ts` detection helper 및 `evaluation-detection-signals-pipeline.ts` 배선 (별도 slice).
- ADR-0064 `§ Follow-ups (c)` — `applyAlgorithmResearchUplift` adjuster · `evaluation-adjustments-pipeline.ts` step (9) 삽입 · 관측 로그 (별도 slice).
- ADR-0064 `§ Follow-ups (d)` — ADR status 승격 · [requirements.md](../requirements.md) `38 행` REQ-019 재판정 · PLAN `103 행` 서술 갱신. [PLAN.md](../PLAN.md) `183 행` once-rule 대로 (a)~(c) 전량 머지 후 **1 회만** 하며 본 slice 에서 손대지 않는다.
- `algorithm-research-signal.ts` 의 marker 어휘 · 임계 `ALGORITHM_RESEARCH_MIN_HITS` 변경 (helper 파일 자체를 건드리지 않는다).
- Confluence mapper · 그 spec 재수정 (T-1949 에서 이미 안착).
- `test/perf/` 무변경 (오너 게이트 158 행), k6 부하 자산 무관 (오너 게이트 157 행).
- commit message · PR body 본문 축 판별로의 확장 (ADR-0064 `§ Decision 2` 기각안 C).
- `ActivityMetadata` 타입 계약 · `activity.ts` 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)
