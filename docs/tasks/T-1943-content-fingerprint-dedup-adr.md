---
id: T-1943
title: ADR-0063 신설 — rebase/meld 내용물 중복 제거 정책 (commit content fingerprint, REQ-009 잔여 축)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-032]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-09-07
independentStream: p5-content-dedup
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md
plannerNote: "P5 dedup arc 재개 1 단(ADR-first) — README 21 행 R-21 의 '커밋 ID 는 달라도 내용물 중복' 축, PLAN 99 행 bullet 잔여분"
---

# T-1943 — ADR-0063 신설: rebase/meld 내용물 중복 제거 정책 (commit content fingerprint)

## Why

README `21 행` (R-21) 은 "Meld / Rebase 되어 **commit ID 는 다르지만 중복된 내용물**"까지 제거하라고 지시하는데, 현 수집-side dedup 은 식별자 기반뿐이다 — [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) `40~46 행` `dedupKey` 가 commit 은 `commit:<SHA>`, pr/issue 는 `<kind>:<repoRef>:<externalId>` 로 키를 만들어 **SHA 가 재작성되면 키가 갈려 잡히지 않는다**. 같은 공백을 [requirements.md](../requirements.md) `28 행` REQ-009 행이 "내용 hash / diff 유사도 기반 dedup 은 `src/` 전체에 부재"로 이미 실측 박제했고, PLAN `99 행` 중복 제거 bullet 의 잔여분이 정확히 이 축이다. 직전 arc (REQ-004 기간 상한, T-1939~T-1942) 가 종단됐으므로 P5 의 다음 실질 공백인 본 축을 재개한다.

본 slice 를 **ADR 먼저**로 두는 이유는 결정해야 할 것이 구현 방식이 아니라 정책이기 때문이다: (1) 내용 지문을 어디서 산출하고 무엇으로부터 만드는가 — [ADR-0029](../decisions/ADR-0029-assessment-collection-orchestrator.md) `§ Decision (2)` / [data-model.md](../architecture/data-model.md) `§ 4` 의 **REQ-032 raw 미저장 불변**과의 관계를 확정하지 않으면 mapper 에 손댈 수 없다. (2) 내용 지문 dedup 은 **오탐이 곧 기여 삭제**다 — "fix typo" 같은 상투적 메시지가 서로 다른 실제 기여를 하나로 접을 수 있어 키 합성과 하한 규칙을 코드보다 먼저 못박아야 한다. (3) 기존 earliest-wins 시간 규칙 (`ADR-0029 § Decision (4)`) 과의 적용 순서도 정책이다.

**issue-still-relevant pre-check (origin/main `fa5f17bd` 실측)** — ① `git grep -niE "fingerprint|contentHash|createHash|similarity" origin/main -- "src/**/*.ts"` 매칭 3 건이 전부 [export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) (`12` · `22` · `176 행`, export dump 체크섬) 이라 **수집 dedup 경로의 내용 지문 구현 0** 확인. ② `docs/decisions/` 최신 id 는 `ADR-0062` 로 `ADR-0063` 미사용 · 내용물 dedup 을 다루는 기존 ADR 0. ③ `docs/tasks/` · `docs/PLAN.md` 에 "내용물 중복" / "content fingerprint" 매칭 0 이라 중복 task 0. ④ `commit-dedup.ts` 는 T-1939~T-1942 arc 에서 무변경이라 위 gap 이 그대로 살아 있다. ⑤ 새 외부 dependency 0 — 지문 산출은 Node 내장 `crypto` (위 export 선례) 로 충분하므로 CLAUDE.md `§ 5` 새-dep 게이트 미해당이고, 본 ADR 은 ADR-0029 `§ Decision (4)` 를 **augment** 할 뿐 뒤집지 않으므로 ADR 충돌 게이트도 미해당이다.

## Required Reading

- [README.md](../../README.md) `21 행` — R-21 원문 (fork 중복 · rebase/meld 로 commit ID 가 갈린 내용물 중복 · 시간적 중복 earlier-date 우선).
- [docs/PLAN.md](../PLAN.md) `99 행` — P5 "중복 제거" bullet 의 현 implemented-on-main 서술.
- [docs/requirements.md](../requirements.md) `28 행` — REQ-009 행. 특히 "내용물 중복 제거 축 부재" 실측 문단 (키가 갈리는 이유 · 유사도 심볼 0 근거).
- [docs/decisions/ADR-0029-assessment-collection-orchestrator.md](../decisions/ADR-0029-assessment-collection-orchestrator.md) `§ Decision (2)` (`41~50 행`, mapper 경계 + raw 미저장 보존) · `§ Decision (4)` (`60~67 행`, 현행 dedup 전략).
- [docs/architecture/data-model.md](../architecture/data-model.md) `§ 4` (`90~107 행`) — REQ-032 raw 미저장 불변의 정본.
- [src/assessment-collection/domain/commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) 전체 (`82 행`) — 현행 `isEarlier` / `dedupKey` / `dedupGithubActivities` 계약과 결정성 규칙.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `36~66 행` — `ActivityMetadata` (scalar 한정) 와 `ActivityBase` 필드 계약.
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `118~173 행` — `buildMetadata` (현재 `titleLength` 1 개) 와 `mapGithubActivity` 의 raw→typed 경계.
- [src/export/export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `12~22 행` · `176 행` — Node 내장 `crypto` `createHash("sha256")` 선례 (새 dependency 0 근거).
- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) `§ Status` 첫 문단 + frontmatter — doc-only ADR slice 의 형식 · 문체 선례.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md` **1 개**를 신설한다. frontmatter 는 선례 형식 그대로 — `id: ADR-0063` / `title` / `status: PROPOSED` / `date: 2026-09-07` / `relatedTask: [T-1943]` / `relatedReq: [REQ-009, REQ-032]` / `supersedes: null` / `augments: [ADR-0029]`.
- [ ] `§ Decision 1 (지문 산출 지점)` — 지문을 **mapper 의 raw→typed 경계**에서 산출하고 raw 본문은 즉시 폐기한다는 결정, 산출 수단은 Node 내장 `crypto` `createHash("sha256")` ([export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `176 행` 선례) 이라는 결정을 박제.
- [ ] `§ Decision 2 (정규화 규칙)` — digest 입력 문자열의 정규화 규칙을 열거 확정 (최소: 앞뒤 trim · 연속 공백/개행 정규화 · 대소문자 처리 방침 · `Signed-off-by` / `Change-Id` 류 trailer 취급). 각 규칙에 "rebase/meld 가 무엇을 바꾸는가" 기준의 한 줄 근거 포함.
- [ ] `§ Decision 3 (저장 형태와 REQ-032 관계)` — 지문은 `Activity.metadata` 의 **scalar 1 개**로만 실리고 (`ActivityMetadataValue` 계약 준수), 비가역 digest 라 raw quote 가 아니며, `prisma/schema.prisma` 에 **영속 컬럼을 신설하지 않는다** (pre-persistence in-memory 전용) 는 결정을 [data-model.md](../architecture/data-model.md) `§ 4` 인용과 함께 박제.
- [ ] `§ Decision 4 (dedup 키 합성 + 오탐 차단)` — 지문 단독 키 / `(author, 지문)` 합성 / 시간창 제한 중 채택안 1 개를 고르고, **상투적·초단문 커밋 메시지 오탐**에 대한 차단책 (예: 정규화 후 최소 길이 하한, author 동일 요구) 을 수치·조건으로 확정. 오탐 시 잃는 것이 "기여 1 건"임을 명시.
- [ ] `§ Decision 5 (적용 순서와 결정성)` — 기존 SHA dedup 과 내용 지문 dedup 의 적용 순서, earliest-wins 승계 여부, tie-break (입력 순서 보존) 와 반환 순서 결정성이 현행 [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) 계약과 어떻게 이어지는지 확정.
- [ ] `§ Decision 6 (적용 범위)` — commit 한정 (pr / issue / Confluence page dedup 정책 무변경) 을 명시하고, **diff 유사도 임계 기반 fuzzy dedup 미채택** 근거를 `§ Alternatives` 에 1 개 이상 기술 (새 dependency · 오탐 비용 · raw diff 취급 관점).
- [ ] `§ Decision 7 (관측 · 개입)` — 지문 dedup 이 제거한 건수를 사람이 인지할 수 있는 경로를 결정하거나, defer 하는 경우 그 사유와 재검토 트리거를 명시.
- [ ] `§ Follow-ups` 에 구현 chain 을 **slice 단위**로 열거 — 각 slice 마다 변경 파일 · 배선 소비처 · 예상 cap 을 적고, CLAUDE.md `§ 3` 소비처 동반 의무 (helper 단독 PR 금지) 를 충족하는 절단면인지 한 줄로 판정.
- [ ] production 코드 0 LOC 검증 — `git diff --stat origin/main...HEAD` 결과가 ADR 1 파일뿐이며 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 임을 확인.
- [ ] 새 dependency 0 확인 — `package.json` diff 0, ADR 본문이 참조하는 해시 수단이 Node 내장 `crypto` 뿐.
- [ ] R-110 — production 변경 0 LOC 여도 tester 를 호출해 `pnpm lint && pnpm build && pnpm test` pass 확인.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 코드 변경 0 이라 기존 수치가 게이트를 그대로 상회함을 확인.
- [ ] R-112 (1)~(4) 적용 판정 — 본 slice 는 신규·변경 public symbol 0, 분기 0 이라 happy-path / error path / 분기별 / negative test 대상이 **없다** (신규 spec 0). 대신 구현 chain 각 slice 가 져야 할 R-112 4 축 요구를 `§ Follow-ups` 의 slice 항목에 미리 한 줄씩 박제한다.

## Out of Scope

- `src/` 코드 변경 일체 — 지문 helper 신설 · mapper 배선 · `commit-dedup.ts` 의 dedup pass 추가는 전부 후속 slice (본 ADR `§ Follow-ups` 가 절단면을 지정).
- `prisma/schema.prisma` · migration — 본 ADR 은 영속 필드 신설을 **금지 결정**으로 박제할 뿐 schema 를 건드리지 않는다 (CLAUDE.md `§ 5` schema 게이트 미침범).
- REQ-009 status 재판정 · [requirements.md](../requirements.md) 편집 — PLAN `183 행` once-rule 에 따라 구현 chain 머지 후 1 회로 미룬다. 본 task 는 기존 실측 문장을 **인용만** 한다.
- PLAN `157 행` (k6 부하검증) · `158 행` (per-route perf-spec) 오너 게이트 — 미접촉.
- [ADR-0029](../decisions/ADR-0029-assessment-collection-orchestrator.md) 본문 편집 — augment 관계는 신설 ADR 쪽에만 기술한다 (기존 ADR 의 결정 내용 변경 0).
- pr / issue / Confluence page dedup 정책 변경.
- 새 외부 dependency (문자열 유사도 · diff 라이브러리 등) 도입 — 필요 판단이 서면 구현이 아니라 CLAUDE.md `§ 5` BLOCKED 로 올린다.
- T-1942 `§ Follow-ups (a)` 의 주석 drift 2 곳 (`unevaluated-fill-plan-request.mapper.ts` `14 행` · `period-bridge-admin-persist.e2e-spec.ts` `67 행`) — 본 slice 와 무관하며 별도 doc-drift slice 로 남긴다.

## Suggested Sub-agents

`architect → tester`

(코드 변경 0 이므로 implementer 는 호출하지 않는다. tester 는 R-110 에 따라 `pnpm lint && pnpm build && pnpm test` 만 확인한다.)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
