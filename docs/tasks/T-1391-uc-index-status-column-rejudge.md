---
id: T-1391
title: UC INDEX.md §2 표의 status 컬럼 8 row 를 UC 본문 실재·본문 task 상태 2 축으로 실측 재판정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1390]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/tasks/T-1391-uc-index-status-column-rejudge.md
plannerNote: "uc-doc-audit-resync 3 번째 slice — T-1390 Follow-up 2 (INDEX §2 status 컬럼 미검증) 처리, 8 row 2 축 실측 재판정, doc-only direct"
---

# T-1391 — UC INDEX.md §2 표의 status 컬럼 8 row 를 UC 본문 실재·본문 task 상태 2 축으로 실측 재판정

## Why

[T-1390](T-1390-uc-index-audit-closure-resync.md) 이 `docs/use-cases/INDEX.md` 104 행의 audit closure 문단을 §9 재판정과 동기했지만, 그 Follow-up 2 와 완료 기록의 "한계 (1)" 이 남긴 대로 **§2 UC 목록 표의 `status` 컬럼은 row 수 8 불변만 확인했고 각 값이 실제 진척과 정합한지는 미검증** 이다. 현재 8 row 가 모두 `DONE` 이고 42 행이 "P2 UC 본문 분해 8/8 closure" 를 선언하는데, 이 선언은 2026-05 시점 기록이라 stale 여부를 실측으로 재판정할 필요가 있다. 본 slice 는 INDEX.md §2 의 status 정의 (27 행 — `PLANNED` / `IN_PROGRESS` / `DONE` 3 값) 를 기준으로 **(a) 대응 `UC-NN-*.md` 본문 파일 실재 축** + **(b) 본문 task (T-0020 / T-0022 ~ T-0028) 의 frontmatter `status` 축** 2 축을 각각 집계해 8 row 의 `DONE` 표기가 유지되는지 판정하고, 결과를 §2 아래 한 문단으로 박제한다 (INDEX.md §5 갱신 룰이 요구하는 living-document 동기 의무의 이행).

## Required Reading

- `docs/use-cases/INDEX.md` 27 행 — `status` 컬럼의 3 값 (`PLANNED` / `IN_PROGRESS` / `DONE`) 정의. **본 정의가 판정 기준이며 정의 자체는 수정하지 않는다.**
- `docs/use-cases/INDEX.md` 29~42 행 — §2 UC 목록 표 (헤더 2 행 + UC-01 ~ UC-08 8 row) 와 40 행 총계 문장 · 42 행 "P2 UC 본문 분해 8/8 closure" 문단. 42 행 문단이 본 slice 의 부기 대상 인접 지점이다.
- `docs/use-cases/INDEX.md` 92~100 행 (§5 갱신 룰) — 본 slice 가 어느 룰의 이행인지 한 줄로 인용하기 위해 문구만 확인. 룰 자체는 수정하지 않는다.
- `docs/tasks/T-1390-uc-index-audit-closure-resync.md` 의 "완료 기록" 과 Follow-up 2 — 실측 서술 포맷 (축별 수치 + 실재 경로 + "한계 —" 부기) 을 그대로 따른다. 그 안의 수치를 본 task 근거로 복사하지 않고 본 slice 에서 다시 실측한다.
- `docs/use-cases/` 디렉토리 목록 — `ls docs/use-cases/` 로 UC 본문 파일 실재만 확인. **각 UC 본문의 내용은 읽지 않는다** (context 보호 — 본 slice 는 파일 실재 + task status 2 축만 본다).

## Acceptance Criteria

- [ ] **축 (a) UC 본문 파일 실재 집계** — `ls docs/use-cases/UC-*.md` 로 UC-01 ~ UC-08 각각에 대응하는 본문 파일이 실재하는지 8 건을 1:1 확인하고, 실재 수 (기대 8) 를 완료 기록에 숫자로 적는다. INDEX.md §3 의 각 UC description 끝 링크 (`UC-NN-*.md`) 경로와 실제 파일명이 일치하는지 `grep -o "UC-0[1-8][a-z0-9-]*\.md" docs/use-cases/INDEX.md | sort -u` 로 대조해 broken link 수를 적는다.
- [ ] **축 (b) 본문 task status 집계** — INDEX.md 42 행이 인용하는 8 task (`T-0020` / `T-0022` ~ `T-0028`) 의 frontmatter `status` 를 `grep -H "^status:" docs/tasks/T-0020-*.md docs/tasks/T-002[2-8]-*.md` 로 일괄 확인하고, `DONE` 개수 (기대 8) 를 숫자로 적는다. 파일이 없는 task ID 가 있으면 그 사실을 적는다.
- [ ] **8 row 판정** — 위 2 축 결과로 각 row 의 `DONE` 표기가 유지되는지 판정한다. 두 축 모두 충족이면 `DONE` 유지, 어느 한 축이라도 미충족인 row 가 있으면 **그 row 만** 축 정의에 맞는 값으로 재판정하고 사유를 적는다. 판정 결과는 "8/8 유지" 또는 "N row 변경 (UC-XX: DONE→YYY, 사유)" 형태로 완료 기록에 명시한다.
- [ ] **INDEX.md 부기** — §2 42 행 문단 뒤에 `2026-08-02 재판정 (T-1391)` 한 문단을 **최대 3 줄** 로 신설한다. 내용은 (1) 2 축 실측 결과 요약 수치, (2) 판정 (유지 / 변경), (3) 미검증 축 1 줄. 원 42 행 "P2 UC 본문 분해 8/8 closure" 문단은 역사적 기록으로 **삭제·수정하지 않고** 그대로 보존하며 덧붙이는 형태로만 표현한다.
- [ ] **표 무결성 검산** — 편집 전후로 `grep -c "^| UC-" docs/use-cases/INDEX.md` 가 **8** 로 불변이고, 표 헤더 컬럼 수 7 이 불변임을 확인해 두 값을 완료 기록에 적는다. 표 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지). status 컬럼 값 변경이 필요 없으면 표 row 자체는 **1 자도 수정하지 않는다**.
- [ ] **R-112 대체 검증 (doc-only)** — 코드 변경 0 이므로 unit test 대신 위 grep / ls 명령의 출력값을 완료 기록에 그대로 박제하는 것으로 검증을 대체한다. 추가로 `wc -l docs/use-cases/INDEX.md` 가 편집 전 107 행 대비 +3 행 이내임을 확인해 적는다.
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 **검증하지 않은 축** (각 UC 본문의 내용 충실도 · "관련 REQ" 컬럼과 `docs/requirements.md` 66 row 정합 · actor / component / module 컬럼의 오타 0 여부) 을 열거한다.

## Out of Scope

- 각 `UC-NN-*.md` **본문 내용의 품질·충실도 재판정** — 본 slice 는 파일 실재 + task status 2 축만 본다.
- §2 표의 **"관련 REQ" 컬럼 정합 대조** — `docs/requirements.md` 66 row 와의 1:1 검증은 별도 slice (Follow-ups 2).
- **UC-09 신설 여부 결정** — T-1389 / T-1390 Follow-up 이 남긴 정책 slice. 본 slice 에서 착수 금지.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 수정 — 본 slice 는 `INDEX.md` 만 건드린다.
- `docs/requirements.md` · `docs/PLAN.md` · `src/` 수정 — 일절 금지.
- INDEX.md §1 / §3 / §4 / §5 본문 수정 — §5 는 인용만 하고 문구를 바꾸지 않는다.

## Suggested Sub-agents

`implementer` (doc 편집 + grep / ls 실측) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 R-112 대체 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

1. **§2 "관련 REQ" 컬럼 정합 대조** — 8 row 의 REQ ID 인용 (총 40+ 건) 이 현재 `docs/requirements.md` 66 row 에 모두 실재하는지 1:1 검증. 본 slice 는 status 컬럼만 봤고 REQ 컬럼은 Out of Scope 였다 (doc-only direct, 예상 ≤40 LOC).
2. **§2 actor / component / module 컬럼 오타 0 검증** — 24~25 행이 선언한 "8 component 명 / 8 module 명만 사용, 오타 0" 제약을 `components.md` · `modules.md` 실제 명칭과 대조. 본 slice 미검증 축.
3. **각 UC 본문 내용 충실도 재판정** — UC-01 ~ UC-08 본문이 §1 이 예고한 항목 (트리거 / 흐름 / 데이터 / NFR / sequence diagram) 을 실제로 담고 있는지. 파일 실재만으로 `DONE` 을 정당화한 본 slice 의 가장 큰 미검증 축 — UC 8 건이라 slice 분할 필요.

## 완료 기록

- **완료 시각**: 2026-08-02 (UTC)
- **결과**: `docs/use-cases/INDEX.md` §2 의 42 행 "P2 UC 본문 분해 8/8 closure" 문단 뒤에 `2026-08-02 재판정 (T-1391)` 문단을 2 줄로 신설했다. 원 42 행 문단은 **1 자도 수정하지 않고** 역사적 기록으로 보존했고, §2 표의 8 row 역시 status 컬럼 변경이 불요해 **1 자도 수정하지 않았다**. 본 부기는 INDEX.md §5 갱신 룰 3 ("UC 본문 task 가 머지될 때 — 대응 UC 의 status 컬럼을 `IN_PROGRESS` → `DONE` 으로 갱신") 이 요구하는 living-document 동기 의무의 사후 검증 이행이다.
- **실측 — 축 (a) UC 본문 파일 실재**: `ls docs/use-cases/UC-*.md` 출력 = `UC-01-evaluation-execution.md` · `UC-02-evaluation-query.md` · `UC-03-person-crud.md` · `UC-04-account-auth.md` · `UC-05-llm-config.md` · `UC-06-evaluation-delete-reeval.md` · `UC-07-export-import.md` · `UC-08-permission-denied.md` — **실재 8 건 / 기대 8 건**. `grep -o "UC-0[1-8][a-z0-9-]*\.md" docs/use-cases/INDEX.md | sort -u` 출력 = 동일 8 개 파일명 (unique 8). 인용 경로 8 건이 실제 파일명과 1:1 일치 — **broken link 0 건**.
- **실측 — 축 (b) 본문 task status**: `grep -H "^status:" docs/tasks/T-0020-*.md docs/tasks/T-002[2-8]-*.md` 출력 8 줄 = `T-0020-uc-01-evaluation-execution.md:status: DONE` / `T-0022-uc-02-evaluation-query.md:status: DONE` / `T-0023-uc-03-person-crud.md:status: DONE` / `T-0024-uc-04-account-auth.md:status: DONE` / `T-0025-uc-05-llm-config.md:status: DONE` / `T-0026-uc-06-evaluation-delete-reeval.md:status: DONE` / `T-0027-uc-07-export-import.md:status: DONE` / `T-0028-uc-08-permission-denied.md:status: DONE`. **`DONE` 8 건 / 기대 8 건**, 파일 없는 task ID **0 건** (T-0021 은 INDEX 42 행 인용 목록에 없으므로 대상 아님).
- **8 row 판정**: **8/8 유지** — UC-01 ~ UC-08 각 row 가 축 (a) 본문 파일 실재 + 축 (b) 대응 task `DONE` 두 축을 모두 충족하므로 27 행 정의의 `DONE` (UC 본문 머지) 표기가 그대로 유효하다. 재판정으로 값이 바뀐 row **0 건**. 따라서 표 row 는 수정하지 않았다.
- **실측 — 표 무결성 검산**: `grep -c "^| UC-" docs/use-cases/INDEX.md` = 편집 전 **8** / 편집 후 **8** (불변). 표 헤더 (29 행) 컬럼 수 = **7**, 8 개 data row 모두 컬럼 수 **7** (`awk -F'|' '{print NF-2}'` 전 row 7) — 불변. 표 셀 안에 리터럴 `|` 추가 **0 건** (편집 지점이 표 밖 산문 문단이라 구조적으로 불가).
- **실측 — R-112 대체 검증 (doc-only)**: 코드 변경 0 LOC 이므로 위 grep / ls 출력값 박제로 unit test 를 대체한다. `wc -l docs/use-cases/INDEX.md` = 편집 전 **107 행** → 편집 후 **110 행** (+3 행 = 빈 줄 1 + 본문 2 줄, 상한 "+3 행 이내" 충족).
- **한계 —** 본 slice 가 검증하지 않은 축: (1) 각 `UC-NN-*.md` **본문의 내용 충실도** — 파일 실재만 확인했고 본문이 §1 이 예고한 트리거 / 흐름 / 데이터 / NFR / sequence diagram 을 실제로 담는지는 읽지 않았다 (Required Reading 이 명시적으로 금지). (2) §2 표 "관련 REQ" 컬럼과 `docs/requirements.md` **66 row 의 1:1 정합** — REQ ID 실재 여부 미대조 (Follow-ups 1). (3) actor / **주요 component** / **주요 module** 컬럼의 **오타 0 여부** — 24~25 행이 선언한 8 component / 8 module 명칭과의 대조 미수행 (Follow-ups 2). (4) 축 (b) 는 task frontmatter `status` 값만 신뢰했고 각 task 의 실제 머지 여부 (git history) 는 교차 확인하지 않았다.
- **변경 파일**: `docs/use-cases/INDEX.md` (+3 행 / -0 행, 표 row · 42 행 원문단 무수정), `docs/tasks/T-1391-uc-index-status-column-rejudge.md` (완료 기록 + Follow-ups).
