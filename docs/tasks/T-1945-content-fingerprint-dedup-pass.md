---
id: T-1945
title: 내용 지문 dedup pass 2 신설 + 수집 flow 직렬 합성 배선 (ADR-0063 Follow-up (b))
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-032]
estimatedDiff: 195
estimatedFiles: 4
created: 2026-09-07
independentStream: collection-content-dedup
dependsOn: [T-1943, T-1944]
touchesFiles:
  - src/assessment-collection/domain/commit-dedup.ts
  - src/assessment-collection/domain/commit-dedup.spec.ts
  - src/assessment-collection/github-collection.service.ts
  - src/assessment-collection/github-collection.service.spec.ts
plannerNote: P5 — ADR-0063 §Follow-ups (b). pass 2 순수 함수 + 유일 소비처(수집 service) 직렬 합성 동반, R-112 backbone ×1.5 = 195 LOC.
---

# T-1945 — 내용 지문 dedup pass 2 신설 + 수집 flow 직렬 합성 배선

## Why

[ADR-0063](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) `§ Follow-ups` 가 rebase/meld 내용물 중복 제거 구현 chain 을 (a) 지문 helper + mapper 배선 → **(b) dedup pass + 수집 flow 배선** → (c) 관측 로그 → (d) doc-sync 로 선박제했고, (a) 는 T-1944 (main `ae03ac5b`, PR #1526) 로 머지됐다. 본 task 는 그 **(b) slice** 다 — 지문이 `metadata.contentFingerprint` 에 실려도 그것을 **읽는 소비자가 아직 없어** README `21 행` R-21 의 축 (ii) 는 여전히 닫히지 않았다. 본 slice 가 `content:<author>:<digest>` 키의 pass 2 를 신설하고 수집 flow 에 직렬 합성해 그 축을 실제로 닫는다 ([PLAN.md](../PLAN.md) `99 행` 중복 제거 bullet · REQ-009).

**issue-still-relevant pre-check (origin/main `f577411c` 실측)** — (1) `git grep -n "content:" origin/main -- src/assessment-collection/domain/commit-dedup.ts` **매칭 0** — pass 2 키도 함수도 부재. (2) `git show origin/main:src/assessment-collection/domain/commit-dedup.ts` 의 export 는 `dedupGithubActivities` **1 개뿐** (`51 행`), `dedupKey` (`40~45 행`) 는 `commit:<SHA>` / `<kind>:<repoRef>:<externalId>` 두 갈래만 만든다. (3) `git grep -n "dedupGithubActivities" origin/main -- src test` 는 [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `13 행` (주석) · `115 행` (호출) 만 매칭 — 합성 지점이 아직 단일 pass 다. (4) 반대로 pass 2 의 **입력은 이미 준비돼 있다** — [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `139~147 행` 이 `kind === "commit"` 분기에서 `metadata.contentFingerprint` 를 담고 있다 (T-1944 안착분). 즉 본 task 의 변경 의도는 main 에 안착 0 이고 부분 안착도 0 이며, 선행 slice 는 완료 상태다.

**게이트 판정** — 새 외부 dependency **0** (신규 import 는 같은 도메인 파일 간 relative import 뿐, `package.json` 무변경) · DB schema 변경 **0** (ADR-0063 `§ Decision 3` 대로 지문은 in-memory 전용, `prisma/schema.prisma` 무변경) · security/auth 변경 **0** · 기존 ADR 충돌 **0** (ADR-0029 `§ Decision (4)` 의 pass 1 계약을 1 LOC 도 바꾸지 않고 뒤에 pass 를 덧붙이는 augment) → CLAUDE.md `§ 5` BLOCKED 게이트 미발화. 오너 게이트 3 종 미접촉 — PLAN `157 행` (R-91 k6 최우선) 은 `test/load/` · `.github/workflows/load-k6.yml` 무변경이라 자원 경합 0, PLAN `158 행` (per-route perf baseline 신규 slice 금지) 은 `test/perf/` 무변경이라 비해당, PLAN `183 행` (REQ 재판정 왕복 제거) 에 따라 **REQ-009 재판정·PLAN 갱신·ADR status flip 은 본 task 에서 하지 않고** (c) 머지 후 (d) doc-sync 에서 1 회만 한다.

**소비처 동반 의무 (CLAUDE.md `§ 3`) 판정: 충족** — pass 2 순수 함수 단독 PR 이 아니라 그 유일 소비처인 [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `115 행` 반환 경로의 직렬 합성 배선을 같은 PR 에 포함한다 (ADR-0063 `§ Follow-ups (b)` 의 판정 그대로).

## Required Reading

- [docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) — `§ Decision 4` (키 합성 `content:<author>:<digest>` · repoRef 미포함 · 시간창 미채택 · 오탐 편향), `§ Decision 5` (2-pass 직렬 순서 · earliest-wins 승계 · tie-break · 반환 순서 결정성 · 시그니처 무변경), `§ Decision 6` (commit 한정 · pr/issue/Confluence 무변경), `§ Decision 7` (관측 로그는 **(c) slice** — 본 task 범위 밖)
- [src/assessment-collection/domain/commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) — `23~34 행` `isEarlier` (재사용 대상, 재구현 금지), `36~45 행` `dedupKey` (pass 1 키 — 무변경), `47~82 행` `dedupGithubActivities` (winners / firstSeenOrder 알고리즘 — pass 2 가 동형으로 승계), `1~19 행` 헤더 주석 (pass 2 추가에 맞춰 갱신 대상)
- [src/assessment-collection/domain/commit-dedup.spec.ts](../../src/assessment-collection/domain/commit-dedup.spec.ts) — `44~151 행` 기존 describe 구조 (`happy path` / `commit SHA earliest-wins` / `pr / issue dedup`) 및 fixture 관례 (pass 2 describe 추가 위치)
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `123~149 행` — `buildMetadata` 가 `metadata.contentFingerprint` 를 담는 조건 (commit 한정 · `undefined` 면 키 미포함) — pass 2 가 전제하는 입력 계약
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~71 행` — `ActivityMetadataValue` scalar 계약 · `ActivityBase.author` (`56 행`) · `GithubActivity.kind` (`70 행`) — 키 합성이 읽는 필드
- [src/assessment-collection/github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) — `7~13 행` 흐름 주석 (`(4)` 단계 갱신 대상), `114~115 행` dedup 호출·반환부 (배선 지점)
- [src/assessment-collection/github-collection.service.spec.ts](../../src/assessment-collection/github-collection.service.spec.ts) `13~22 행` — `rawCommit` fixture (현재 `commit.message` 가 없어 지문이 산출되지 않음 — 지문 있는 fixture 를 추가해야 함)

## Acceptance Criteria

- [ ] [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) 에 pass 2 순수 함수 1 개 export 추가 (예: `dedupGithubActivitiesByContent(activities: GithubActivity[]): GithubActivity[]`). 부수효과 0 · 입력 배열 비변형 · 외부 의존 0 (`crypto` 재호출 금지 — 지문은 mapper 가 이미 산출한 `metadata.contentFingerprint` 를 **읽기만** 한다).
- [ ] 키 합성이 ADR-0063 `§ Decision 4` 그대로 — `content:<author>:<digest>`. **repoRef 는 키에 넣지 않는다.** 시간창 제한 없음.
- [ ] 키 대상 판정: `kind === "commit"` **이면서** `metadata.contentFingerprint` 가 **string** 인 활동만 지문 키를 갖는다. 그 외 (비-commit · 키 부재 · 비-string 값) 는 **키를 만들지 않고 원본 그대로 통과** 시킨다 (다른 활동과 절대 병합되지 않음).
- [ ] earliest-wins · tie-break · 반환 순서가 pass 1 과 **동형** — 기존 `isEarlier` (`23~34 행`) 를 **재사용** 하고 재구현하지 않는다. 동일 timestamp 는 먼저 등장한 항목 유지, 반환 순서는 유지 항목의 최초 등장 위치 기준으로 결정적이며, 통과 활동의 상대 순서도 입력 순서를 보존한다.
- [ ] 기존 `dedupGithubActivities` 의 **시그니처·동작 무변경** (ADR-0063 `§ Decision 5`) — pass 1 코드 (`40~82 행`) 는 수정하지 않는다.
- [ ] [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `115 행` 이 pass 1 출력에 pass 2 를 **직렬 합성** 하도록 배선 (예: `dedupGithubActivitiesByContent(dedupGithubActivities(collected))`). 메서드 시그니처·반환 타입은 무변경.
- [ ] 두 파일의 헤더 주석 갱신 — [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) `1~19 행` 에 pass 2 정책 (키 · commit 한정 · 하한 판정은 mapper 책임) 을 ADR-0063 `§ Decision 4`/`§ 5` 참조와 함께 추가, [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `13 행` `(4)` 단계 서술을 2-pass 로 갱신.
- [ ] **happy-path unit test** — colocated [commit-dedup.spec.ts](../../src/assessment-collection/domain/commit-dedup.spec.ts) 에 "SHA 는 다르고 author·지문은 같은 commit 2 건 → 1 건, earliest timestamp 유지" 1+ / colocated [github-collection.service.spec.ts](../../src/assessment-collection/github-collection.service.spec.ts) 에 지문이 산출되는 `commit.message` 를 가진 raw fixture 로 "SHA 다른 rebase 사본이 수집 결과에서 1 건으로 접힘" 1+.
- [ ] **error path unit test** — `metadata` 가 빈 객체인 활동, `contentFingerprint` 가 비-string (number/null/boolean) 인 활동을 넣어도 throw 하지 않고 원본 그대로 통과 1+ / 빈 배열 입력이 빈 배열 반환 1+.
- [ ] **분기별 test** — (i) 지문 같고 **author 다름** → 미접힘, (ii) `kind === "pr"` · `"issue"` 는 지문 키 대상 아님 → 미접힘, (iii) 같은 지문·author 이면서 **repoRef 다름** → 접힘 (repoRef 미포함 검증), (iv) pass 1 → pass 2 직렬 순서에서 SHA 동일 중복이 먼저 접힌 뒤 지문 중복이 접힘 각 1+.
- [ ] **negative case test (예외 분기마다 1+)** — (i) 동일 timestamp tie 시 **먼저 등장한 항목 유지** (입력 순서 보존), (ii) 반환 순서 결정성 — 통과 활동과 접힌 활동이 섞인 입력에서 반환 배열의 순서가 최초 등장 위치 기준으로 안정, (iii) 입력 배열 **비변형** (호출 전후 `length` · 요소 동일), (iv) 지문 없는 commit 2 건은 서로 **병합되지 않음** (하한 미달 활동이 한 덩어리로 접히는 오탐 차단), (v) 기존 pass 1 spec (SHA earliest-wins · pr/issue dedup) 회귀 무영향.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **관측 로그 금지** — ADR-0063 `§ Decision 7` 의 "제거 건수 1 줄 로그" 는 `§ Follow-ups (c)` slice. 본 task 에서 `Logger` 를 새로 주입하거나 로그 문장을 추가하지 않는다 (본 task 의 service 변경은 합성 배선 + 주석 한 단락뿐).
- **지문 산출 로직 변경 금지** — [commit-content-fingerprint.ts](../../src/assessment-collection/domain/commit-content-fingerprint.ts) · [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) 는 **1 LOC 도 건드리지 않는다** (T-1944 안착분). 하한 20 자 판정도 mapper 쪽 책임 그대로.
- **pass 1 정책 변경 금지** — `dedupKey` · `dedupGithubActivities` 본문 수정 0 (ADR-0029 `§ Decision (4)` 무변경).
- **영속 표면 금지** — `prisma/schema.prisma` · migration 0. 지문·제거 이력 어느 것도 영속화하지 않는다 (ADR-0063 `§ Decision 3`).
- **유사도 기반 fuzzy dedup 금지** — 정확 일치 digest 만 (ADR-0063 `§ Alternatives B`). 새 dependency 0.
- **Confluence · 평가-side 무변경** — [page-dedup.ts](../../src/assessment-collection/domain/page-dedup.ts) · [evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) 미접촉.
- **문서 갱신 금지** — ADR-0063 status flip (PROPOSED → ACCEPTED) · [requirements.md](../requirements.md) REQ-009 재판정 · [PLAN.md](../PLAN.md) `99 행` 갱신은 전부 `§ Follow-ups (d)` doc-sync slice 이며, PLAN `183 행` 오너 지시대로 구현 chain 머지 **후 1 회만** 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 인접 작업을 발견하면 여기에 추가한다.)
