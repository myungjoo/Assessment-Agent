---
id: T-1371
title: requirements.md 33 행 REQ-014 Issue 평가 (본인 follow-up 소비 제외) 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-014]
estimatedDiff: 20
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1371-requirements-issue-self-followup-status-rejudge.md
plannerNote: "requirements-status-resync 17 번째 slice — T-1370 이 REQ-014 축으로 명시 deferred 한 excludeSelfFollowUps 가 근거 실재로 가장 두터움"
---

# T-1371 — requirements.md 33 행 REQ-014 Issue 평가 (본인 follow-up 소비 제외) 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 33 행 REQ-014 (README 30 행 — "코드 평가 대상이 된 Repository에 Issue를 작성하여 다른 개발자들의 활동에 도움이 된 경우. 단, 본인 결과물에 대해 본인이 Follow-up을 남기고 본인이 소비하는 경우는 카운트 하지 않는다") 는 아직 상태 컬럼이 `PLANNED` 이지만, `src/assessment-evaluation/domain/evaluation-dedup.ts` 의 `excludeSelfFollowUps` (R-30 self-follow-up 제외) 가 실재하고 `evaluation-orchestrator.service.ts` 에 wiring 돼 있어 표가 실제 코드베이스와 어긋날 가능성이 크다. 직전 slice T-1370 은 REQ-014 축을 "별도 slice" 로 명시 deferred 했고, 그 Result 절이 이미 wiring 지점 (`evaluation-orchestrator.service.ts` 148 행) 을 실측해 두어 근거 확보 비용이 가장 낮다. `requirements-status-resync` stream 의 17 번째 slice 로 표를 requirements 추적의 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 33 행 (REQ-014) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum
- `docs/tasks/T-1370-requirements-fork-rebase-dedup-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다. Result 절의 wiring 실측값 (`evaluation-orchestrator.service.ts` 148 행 `excludeSelfFollowUps(dedupTemporalDuplicates(inputs))`) 은 재확인 대상이지 인용 근거로 그대로 복사하지 않는다
- `README.md` 30 행 — REQ-014 의 원문 지시 (축 = (a) Issue 작성 활동이 평가 대상으로 수집·평가됨, (b) 본인 결과물에 본인이 남긴 follow-up 을 본인이 소비하는 경우 카운트 제외)
- `src/assessment-evaluation/domain/evaluation-dedup.ts` — 파일 상단 책임 2 종 주석 (특히 11~15 행 `excludeSelfFollowUps` 정의와 21~24 행 "comment thread 미수집 → issue 단위 author 동일성 휴리스틱" 경계), `excludeSelfFollowUps` 의 실 signature 와 제외 판정 알고리즘 실측. 같은 파일의 `dedupTemporalDuplicates` 는 REQ-009 축이므로 본 task 의 근거로 쓰지 않는다
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `excludeSelfFollowUps` 가 실제 평가 flow 에 호출되는 지점 실측
- `src/assessment-collection/domain/activity.ts` · `src/assessment-collection/domain/github-activity.mapper.ts` — Issue 활동이 수집 kind / sourceType 으로 실재하는지 (축 (a) 의 수집-side 근거) 실측
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` — Issue 활동이 평가 입력으로 매핑되는지 (축 (a) 의 평가-side 근거) 실측
- `src/assessment-evaluation/domain/evaluation-dedup.spec.ts` — 203 행 `describe("excludeSelfFollowUps ...")` 블록. 검증 위치 컬럼 `unit` 의 실 근거 실측

## Acceptance Criteria

- [ ] **self-follow-up 제외 축 (README 30 행 단서절)** 을 실측한다 — `excludeSelfFollowUps` 의 export signature (인자 타입 · 반환 타입) 와 제외 판정식 (동일 기여 단위 식별 키가 무엇인지, author 동일성 비교 대상 필드, 최초 기여 1 건 유지 규칙, 동일 author 후속 활동 판정 순서) 을 한 절로 요약해 인용한다. 추측한 심볼명·필드명을 적지 않는다.
- [ ] **Issue 평가 대상 축 (README 30 행 본절)** 을 별도로 판정한다 — Issue 활동이 (a) 수집 layer 에서 kind / sourceType 으로 실재하는지 (`activity.ts` · `github-activity.mapper.ts` 실측) (b) 평가 입력으로 매핑돼 실제 LLM 평가 대상이 되는지 (`evaluation-input.mapper.ts` 실측) 를 파일·행 인용으로 구분해 명시한다. 수집만 되고 평가 입력 매핑이 없으면 그 사실을 축 미충족으로 적고 `DONE` 근거로 쓰지 않는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "excludeSelfFollowUps" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) 실제 평가 pipeline (`evaluation-orchestrator.service.ts`) 에서 호출되는지 (b) 정의만 있고 호출 0 인지 구분해 파일·행을 인용한다. 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **검증 위치 컬럼 `unit` 의 실 근거**를 확인한다 — `evaluation-dedup.spec.ts` 의 `excludeSelfFollowUps` describe 블록에 속한 `it(` 개수를 실측 (블록 범위를 눈으로 확인 — 파일 전체 개수를 그대로 쓰지 않는다) 해 spec 경로와 개수를 상태 문자열에 인용한다. Issue 평가 축을 cover 하는 e2e / smoke 가 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [ ] REQ-014 (33 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: `evaluation-dedup.ts` 21~24 행이 자인한 comment thread 미수집으로 인한 issue 단위 author 휴리스틱의 정밀도 한계, "다른 개발자들의 활동에 도움이 된 경우" 라는 유용성 조건이 실제 점수 산정에 반영되는지 여부, 오탐 시 사람 개입 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-014" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-013 · REQ-015) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 1 차 편집에서 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). comment-level self-follow-up 정밀 검출이 부재하더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- `dedupTemporalDuplicates` (REQ-009 축) 재판정 — T-1370 에서 이미 처리됐다.
- 인접 REQ-013 (32 행) · REQ-015 (34 행) 재판정 — 본 task 대상이 아니다.
- 새 ADR 작성 또는 기존 ADR (ADR-0032 등) status 변경.
- REQ-014 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- (작성 시 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append 한다.)
