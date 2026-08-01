---
id: T-1370
title: requirements.md 28 행 REQ-009 Fork/Rebase/Meld 중복 제거 + 시간적 중복 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-009]
estimatedDiff: 20
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1370-requirements-fork-rebase-dedup-status-rejudge.md
plannerNote: "requirements-status-resync 16 번째 slice — T-1369 Follow-ups 가 남긴 PLANNED row 중 dedup 실 구현(commit-dedup/evaluation-dedup)이 가장 두터운 REQ-009"
---

# T-1370 — requirements.md 28 행 REQ-009 Fork/Rebase/Meld 중복 제거 + 시간적 중복 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 28 행 REQ-009 (README 21 행 — "Forked repository 로 내용물이 중복되거나 Meld / Rebase 되어 commit ID 는 다르지만 중복된 내용물 … 중복된 부분은 제거되고 평가되어야 하며, 시간적으로 다를 수 있음도 고려 (2 월 결과물이 3 월 timestamp 로 중복되면 2 월 기여로 판단)") 은 아직 상태 컬럼이 `PLANNED` 이지만, 수집-side `src/assessment-collection/domain/commit-dedup.ts` (`dedupGithubActivities`) 와 평가-side `src/assessment-evaluation/domain/evaluation-dedup.ts` (`dedupTemporalDuplicates`) 가 실재하고 각각 `github-collection.service.ts` · `evaluation-orchestrator.service.ts` 에 wiring 돼 있어 표가 실제 코드베이스와 어긋날 가능성이 크다. T-1369 Follow-ups 가 남긴 다음 slice 후보 (REQ-009 · REQ-010 · REQ-011 · REQ-014) 중 첫 항목으로, `requirements-status-resync` stream 의 16 번째 slice 로 표를 requirements 추적의 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 28 행 (REQ-009) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum
- `docs/tasks/T-1369-requirements-underperformer-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 21 행 — REQ-009 의 원문 지시 (축 = (a) fork/rebase/meld 로 인한 **내용물** 중복 제거, (b) 시간적 중복 시 **earlier date 우선**)
- `src/assessment-collection/domain/commit-dedup.ts` — 파일 상단 정책 주석, `dedupKey` (commit = `commit:<sha>` 단일 키 / pr·issue = `<kind>:<repoRef>:<externalId>` 합성 키), `isEarlier`, `dedupGithubActivities` 의 실 signature 와 earliest-wins 알고리즘 실측
- `src/assessment-evaluation/domain/evaluation-dedup.ts` — 파일 상단 책임 2 종 주석, `dedupTemporalDuplicates` 의 동일 활동 식별 키 (`unitId` 합성 규칙) 와 earliest-wins 판정 실측. 같은 파일의 `excludeSelfFollowUps` 는 REQ-014 축이므로 본 task 의 근거로 쓰지 않는다
- `src/assessment-collection/github-collection.service.ts` · `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 두 dedup 함수가 실제 수집 / 평가 flow 에 호출되는 지점 실측
- `src/assessment-collection/domain/commit-dedup.spec.ts` · `src/assessment-evaluation/domain/evaluation-dedup.spec.ts` — 검증 위치 컬럼 `unit` 의 실 근거 실측

## Acceptance Criteria

- [x] **시간적 중복 축 (earlier date 우선)** 을 실측한다 — `dedupGithubActivities` 와 `dedupTemporalDuplicates` 각각의 export signature (인자 타입 · 반환 타입) 와 earliest-wins 판정식 (`isEarlier` 의 `Date.parse` 우선 + NaN 사전식 fallback, 동일 timestamp tie-break 규칙) 을 한 절로 요약해 인용한다. 추측한 심볼명·수식을 적지 않는다.
- [x] **구조적 중복 축 (fork / rebase / meld)** 을 별도로 판정한다 — dedup 식별 키가 무엇인지 (commit SHA 기준인지, 내용 hash / diff 유사도 기준인지) 를 `dedupKey` 실측으로 확인하고, README 21 행이 말한 "commit ID 는 다르지만 중복된 내용물" (rebase / meld 로 SHA 가 갈리는 경우) 이 현 키로 잡히는지 / 안 잡히는지를 사실대로 구분해 명시한다. SHA 동일 전제로만 동작하면 그 사실을 축 미충족으로 적고 `DONE` 근거로 쓰지 않는다.
- [x] **wiring 축을 별도로 판정한다** — `grep -rn "dedupGithubActivities\|dedupTemporalDuplicates" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) 실제 수집 / 평가 pipeline (`github-collection.service.ts` / `evaluation-orchestrator.service.ts`) 에서 호출되는지 (b) 정의만 있고 호출 0 인지 구분해 파일·행을 인용한다. 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [x] **검증 위치 컬럼 `unit` 의 실 근거**를 확인한다 — `grep -c "it(" src/assessment-collection/domain/commit-dedup.spec.ts` · `src/assessment-evaluation/domain/evaluation-dedup.spec.ts` 로 개수를 실측해 spec 경로와 개수를 상태 문자열에 인용한다. dedup 축을 cover 하는 e2e / smoke 가 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [x] REQ-009 (28 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 내용 기반 유사도 dedup 부재 여부, confluence 측 `page-dedup.ts` 와의 정책 차이, dedup 이 DB unique constraint 와 중복 적용되는 경계, 오탐 시 사람 개입 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-009" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-008 · REQ-010) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 내용 기반 (SHA 무관) dedup 이 부재하더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- `excludeSelfFollowUps` (REQ-014 Issue 평가 축) 재판정 — 별도 slice 다.
- Confluence `page-dedup.ts` 축 (REQ-015 / REQ-031 인접) 재판정 — 본 task 는 REQ-009 상태 문자열에 한계로만 언급 가능.
- 인접 REQ-008 (27 행) · REQ-010 (29 행) 재판정 — 본 task 대상이 아니다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-009 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Result (2026-08-01 완료)

REQ-009 (requirements.md 28 행) 상태를 `PLANNED` → `IN_PROGRESS (시간적 중복 earlier-date 우선 축 · fork (SHA 보존) 중복 제거 축 · pipeline wiring 축 실재 / rebase·meld 로 commit ID 가 갈리는 "내용물" 중복 제거 축 부재: …)` 로 갱신했다. 4 축 실측 결과:

- **시간적 중복 축 (충족)** — `commit-dedup.ts` 51 행 `dedupGithubActivities(activities: GithubActivity[]): GithubActivity[]`, `evaluation-dedup.ts` 118 행 `dedupTemporalDuplicates(inputs: EvaluationInput[]): EvaluationInput[]` (121 행에서 53 행 `dedupByEarliest` 로 위임). 두 파일의 동형 `isEarlier` (26 행 / 36 행) 가 `Date.parse` 수치 비교 우선 + `Number.isNaN` 시 사전식 `a < b` fallback. 판정식 72 행 / 84 행 모두 **엄격히 더 이른** 항목만 교체 → 동일 timestamp tie 는 먼저 등장한 항목 유지, 반환 순서는 최초 등장 위치 기준 (79~81 행 `firstSeenOrder` 정렬 / 90~94 행 slot 직렬화) 으로 결정적.
- **구조적 중복 축 (부분 — fork 만 충족)** — `dedupKey` (40 행) 는 commit 을 42 행 `commit:<externalId>` 단일 키로, pr/issue 를 44 행 `<kind>:<repoRef>:<externalId>` 합성 키로 만든다. `activity.ts` 48~50 행에 따라 `externalId` = commit SHA 이므로 fork (SHA 보존, repoRef 를 키에서 제외) 는 잡히지만 **rebase / meld 로 SHA 가 재작성되는 "내용물" 중복은 잡히지 않는다**. `similarity` / `contentHash` / `diffHash` 어느 심볼도 `src` 이하 `*.ts` 매칭 0 — 내용 기반 dedup 부재. 평가-side `unitId` (`sourceType:instanceKey:externalId`) 도 동일한 식별자 기반이고, `evaluation-dedup.ts` 17~19 행 주석이 R-9 구조적 중복을 수집-side 책임으로 경계 박제.
- **wiring 축 (충족)** — spec 제외 전수 참조에서 실 호출부 2 개: `github-collection.service.ts` 32 행 import + 115 행 `return dedupGithubActivities(collected)`, `evaluation-orchestrator.service.ts` 73 행 import + 148 행 `excludeSelfFollowUps(dedupTemporalDuplicates(inputs))`. `evaluation-unevaluated-period-select.ts` 112 행은 주석 언급일 뿐 호출 아님. dead code 아님.
- **검증 위치 `unit` (충족)** — domain unit 2 spec 60 it (`commit-dedup.spec.ts` 31 it · `evaluation-dedup.spec.ts` 29 it). dedup 축 전용 e2e / smoke 는 0 (`test/e2e/` 에 dedup spec 부재, smoke 2 spec 은 "deduped input" 주석 언급만) — 한계로 부기.

불변 확인: `wc -l docs/requirements.md` = 97 (편집 전후 동일), `grep -c "^| REQ-"` = 66 (동일), REQ-009 행의 `|` 필드 수 = 9 로 인접 REQ-008 · REQ-010 과 동일. (1 차 편집에서 `grep` 정규식 인용에 포함된 리터럴 `|` 2 개가 필드 수를 11 로 부풀려 즉시 수정했다.)

## Follow-ups

- **내용 기반 (SHA 무관) dedup 부재** — README 21 행의 "commit ID 는 다르지만 중복된 내용물" 축이 현 구현에 없다. rebase / meld 로 SHA 가 갈린 중복을 잡으려면 diff 내용 hash 또는 유사도 기준 키가 필요하다. 코드 변경 task (`commitMode: pr`) 로 별도 slice 필요 — 설계 선택지 (patch-id 활용 / 정규화 diff hash / 유사도 threshold) 가 갈리므로 ADR 선행 여부 판단 포함.
- **dedup 축 e2e / smoke 부재** — 수집·평가 pipeline 을 통과하는 중복 입력이 실제로 1 건으로 정리되는지 확인하는 e2e 가 0 이다. 별도 test slice 후보.
- **requirements-status-resync stream 다음 slice 후보** — T-1369 Follow-ups 가 남긴 REQ-010 (29 행) · REQ-011 (30 행) · REQ-014 (`excludeSelfFollowUps` 축) 중 택 1.
