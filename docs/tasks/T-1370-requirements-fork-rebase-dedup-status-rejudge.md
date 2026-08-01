---
id: T-1370
title: requirements.md 28 행 REQ-009 Fork/Rebase/Meld 중복 제거 + 시간적 중복 상태를 실측 기반 재판정
phase: P7
status: PENDING
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

- [ ] **시간적 중복 축 (earlier date 우선)** 을 실측한다 — `dedupGithubActivities` 와 `dedupTemporalDuplicates` 각각의 export signature (인자 타입 · 반환 타입) 와 earliest-wins 판정식 (`isEarlier` 의 `Date.parse` 우선 + NaN 사전식 fallback, 동일 timestamp tie-break 규칙) 을 한 절로 요약해 인용한다. 추측한 심볼명·수식을 적지 않는다.
- [ ] **구조적 중복 축 (fork / rebase / meld)** 을 별도로 판정한다 — dedup 식별 키가 무엇인지 (commit SHA 기준인지, 내용 hash / diff 유사도 기준인지) 를 `dedupKey` 실측으로 확인하고, README 21 행이 말한 "commit ID 는 다르지만 중복된 내용물" (rebase / meld 로 SHA 가 갈리는 경우) 이 현 키로 잡히는지 / 안 잡히는지를 사실대로 구분해 명시한다. SHA 동일 전제로만 동작하면 그 사실을 축 미충족으로 적고 `DONE` 근거로 쓰지 않는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "dedupGithubActivities\|dedupTemporalDuplicates" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) 실제 수집 / 평가 pipeline (`github-collection.service.ts` / `evaluation-orchestrator.service.ts`) 에서 호출되는지 (b) 정의만 있고 호출 0 인지 구분해 파일·행을 인용한다. 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **검증 위치 컬럼 `unit` 의 실 근거**를 확인한다 — `grep -c "it(" src/assessment-collection/domain/commit-dedup.spec.ts` · `src/assessment-evaluation/domain/evaluation-dedup.spec.ts` 로 개수를 실측해 spec 경로와 개수를 상태 문자열에 인용한다. dedup 축을 cover 하는 e2e / smoke 가 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [ ] REQ-009 (28 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 내용 기반 유사도 dedup 부재 여부, confluence 측 `page-dedup.ts` 와의 정책 차이, dedup 이 DB unique constraint 와 중복 적용되는 경계, 오탐 시 사람 개입 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-009" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-008 · REQ-010) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

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

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 append.)
