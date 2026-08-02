---
id: T-1392
title: UC INDEX.md §2 표 "관련 REQ" 컬럼의 인용 REQ ID 전건을 requirements.md 66 row 와 1:1 정합 대조
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1391]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/tasks/T-1392-uc-index-req-column-integrity.md
plannerNote: "uc-doc-audit-resync 4 번째 slice — T-1391 Follow-up 1 (REQ 컬럼 정합 미검증) 처리, 인용 REQ ID 전건 실재 대조, doc-only direct"
---

# T-1392 — UC INDEX.md §2 표 "관련 REQ" 컬럼의 인용 REQ ID 전건을 requirements.md 66 row 와 1:1 정합 대조

## Why

[T-1391](T-1391-uc-index-status-column-rejudge.md) 이 `docs/use-cases/INDEX.md` §2 표의 `status` 컬럼 8 row 를 2 축 실측으로 재판정해 `DONE` 8/8 유지를 확정했지만, 그 완료 기록의 "한계 (2)" 와 Follow-up 1 이 남긴 대로 **"관련 REQ" 컬럼의 인용 REQ ID 가 실제로 `docs/requirements.md` 에 실재하는지는 미검증** 이다. INDEX.md 26 행은 "requirements.md 의 66 REQ ID 만 사용. 존재하지 않는 REQ ID 인용 금지" 를 명시적 제약으로 선언하는데, 이 제약이 지켜지는지 한 번도 실측된 적이 없다 (표 최초 작성은 2026-05 시점, requirements.md 는 이후 다수 갱신). 본 slice 는 8 row 의 REQ 컬럼에서 인용 ID 를 기계적으로 추출해 requirements.md 66 row 와 **전건 1:1 대조** 하고, dangling ID (인용됐으나 requirements.md 에 부재) 수를 판정해 결과를 §2 아래 한 문단으로 박제한다.

## Required Reading

- `docs/use-cases/INDEX.md` 26 행 — "관련 REQ" 컬럼의 제약 정의 ("requirements.md 의 66 REQ ID 만 사용. 존재하지 않는 REQ ID 인용 금지"). **본 정의가 판정 기준이며 정의 자체는 수정하지 않는다.**
- `docs/use-cases/INDEX.md` 29~38 행 — §2 UC 목록 표 (헤더 2 행 + UC-01 ~ UC-08 8 row). 6 번째 컬럼이 대조 대상이다.
- `docs/use-cases/INDEX.md` 42~45 행 — 42 행 "P2 UC 본문 분해 8/8 closure" 원 문단 + T-1391 이 신설한 `2026-08-02 재판정 (T-1391)` 문단. 본 slice 의 부기는 45 행 뒤에 덧붙인다.
- `docs/requirements.md` 의 REQ 표 — `grep -c "^| REQ-" docs/requirements.md` 로 row 수 (기대 66) 만 확인하고, 개별 REQ 본문은 읽지 않는다 (context 보호 — 본 slice 는 **ID 실재 여부만** 본다).
- `docs/tasks/T-1391-uc-index-status-column-rejudge.md` 의 "완료 기록" — 실측 서술 포맷 (축별 수치 + 명령 출력 박제 + "한계 —" 절) 을 그대로 따른다. 그 안의 수치를 근거로 복사하지 않고 본 slice 에서 다시 실측한다.

## Acceptance Criteria

- [ ] **인용 ID 추출** — `awk -F'|' '/^\| UC-0/ {print $7}' docs/use-cases/INDEX.md` 로 8 row 의 REQ 컬럼만 분리한 뒤 `grep -o "REQ-[0-9]\{3\}"` 로 ID 를 뽑아 **총 인용 건수 (중복 포함)** 와 **unique ID 수** 두 값을 숫자로 완료 기록에 적는다. row 별 인용 건수 8 개도 함께 적는다 (예: UC-01 13 건 / UC-02 4 건 / ...).
- [ ] **실재 대조 (forward)** — 위 unique ID 각각에 대해 `grep -c "^| REQ-NNN" docs/requirements.md` 가 1 이상인지 확인해 **실재 수 / dangling 수** 를 판정한다. dangling 이 1 건 이상이면 그 ID 와 인용 row 를 전부 열거한다. 대조는 개별 grep 반복 대신 `comm -23 <(인용 unique 정렬) <(requirements ID 정렬)` 같은 집합 연산 1 회로 수행해도 무방하며, 사용한 명령을 완료 기록에 그대로 박제한다.
- [ ] **requirements.md row 수 검산** — `grep -c "^| REQ-" docs/requirements.md` 가 **66** 인지 확인해 숫자를 적는다. 66 이 아니면 그 사실을 기록하고, 26 행이 선언한 "66 REQ" 문구와의 불일치를 한계 절에 명시한다 (**26 행 문구 자체는 본 slice 에서 수정하지 않는다**).
- [ ] **INDEX.md 부기** — §2 의 T-1391 문단 (45 행) 뒤에 `2026-08-02 REQ 컬럼 정합 대조 (T-1392)` 한 문단을 **최대 3 줄** 로 신설한다. 내용은 (1) 인용 총 건수 · unique 수 · requirements row 수, (2) 판정 (dangling 0 이면 "제약 26 행 충족", 1+ 이면 dangling ID 열거), (3) 미검증 축 1 줄. 42 행 원 문단과 44~45 행 T-1391 문단은 **1 자도 수정하지 않는다**.
- [ ] **표 무결성 검산** — 편집 전후로 `grep -c "^| UC-" docs/use-cases/INDEX.md` 가 **8** 로 불변이고 8 개 data row 의 컬럼 수가 **7** 로 불변임을 확인해 두 값을 완료 기록에 적는다. 표 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지). **dangling 이 발견되어도 본 slice 에서 표 row 의 REQ 값을 고치지 않는다** — 수정은 별도 slice (Follow-ups) 로 남기고 사실만 부기한다.
- [ ] **R-112 대체 검증 (doc-only)** — 코드 변경 0 이므로 unit test 대신 위 awk / grep / comm 명령의 출력값을 완료 기록에 그대로 박제하는 것으로 검증을 대체한다. 추가로 `wc -l docs/use-cases/INDEX.md` 가 편집 전 110 행 대비 **+3 행 이내** 임을 확인해 적는다.
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 **검증하지 않은 축** (인용 REQ 가 해당 UC 의 내용과 **의미적으로** 맞는지 · 66 REQ 중 어느 UC 에도 인용되지 않은 REQ 집합 (역방향 coverage — `REQ-COVERAGE-AUDIT.md` 소관) · actor / component / module 컬럼 오타 · 각 UC 본문 내용 충실도) 을 열거한다.

## Out of Scope

- **역방향 coverage 재판정** — "66 REQ 중 어느 UC row 에도 인용되지 않은 REQ" 집계·판정은 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 소관. 본 slice 는 forward (인용 → 실재) 방향만 본다.
- **dangling ID 의 실제 수정** — 발견 시 사실 부기만. 표 row 의 REQ 값 변경 금지.
- **REQ 인용의 의미적 타당성 판정** — ID 실재 여부만 보고 "이 REQ 가 이 UC 에 맞는가" 는 판정하지 않는다.
- §2 actor / component / module 컬럼 오타 검증 (T-1391 Follow-up 2), 각 UC 본문 내용 충실도 재판정 (T-1391 Follow-up 3) — 별도 slice.
- **UC-09 신설 여부 결정** — T-1389 / T-1390 Follow-up 이 남긴 정책 slice. 본 slice 에서 착수 금지.
- `docs/requirements.md` · `docs/use-cases/REQ-COVERAGE-AUDIT.md` · `docs/PLAN.md` · `src/` 수정 — 일절 금지.
- INDEX.md §1 / §3 / §4 / §5 본문 수정 — 26 행 정의는 인용만 하고 문구를 바꾸지 않는다.

## Suggested Sub-agents

`implementer` (doc 편집 + awk / grep / comm 실측) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 R-112 대체 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## 완료 기록

**인용 ID 추출** — `awk -F'|' '/^\| UC-0/ {print $7}' docs/use-cases/INDEX.md | grep -o "REQ-[0-9]\{3\}"` 결과: 총 인용 건수 (중복 포함) **41 건**, unique ID **33 개**. row 별 인용 건수 — UC-01 13 / UC-02 4 / UC-03 7 / UC-04 2 / UC-05 7 / UC-06 3 / UC-07 3 / UC-08 2 (합 41, 검산 일치).

**실재 대조 (forward)** — 집합 연산 1 회로 수행. 사용 명령 그대로:

```
comm -23 <(awk -F'|' '/^\| UC-0/ {print $7}' docs/use-cases/INDEX.md | grep -o "REQ-[0-9]\{3\}" | sort -u) \
         <(grep -o "^| REQ-[0-9]\{3\}" docs/requirements.md | grep -o "REQ-[0-9]\{3\}" | sort -u)
```

출력: **공백 (0 행)**. 즉 실재 **33 / 33**, dangling **0 건** — 열거할 ID 없음. INDEX.md 26 행 제약 "존재하지 않는 REQ ID 인용 금지" **충족**.

**requirements.md row 수 검산** — `grep -c "^| REQ-" docs/requirements.md` → **66**. 26 행이 선언한 "66 REQ" 문구와 일치 (불일치 없음). unique ID 수도 `grep -o "^| REQ-[0-9]\{3\}" ... | sort -u | wc -l` → **66** 으로 동일 — REQ ID 중복 row 0.

**INDEX.md 부기** — §2 의 T-1391 문단 (45 행) 뒤에 `2026-08-02 REQ 컬럼 정합 대조 (T-1392)` 문단을 신설 (본문 2 줄 + 앞 빈 줄 1 = +3 행). 42 행 원 문단 및 44~45 행 T-1391 문단은 무수정 (diff `3 insertions(+), 0 deletions`).

**표 무결성 검산** — 편집 전후 `grep -c "^| UC-" docs/use-cases/INDEX.md` → **8 / 8** (불변). data row 컬럼 수 `awk -F'|' '/^\| UC-/ {print NF-2}' | sort -u` → **7** 단일값 (8 row 전부 7 컬럼, 불변). 표 셀 안 리터럴 `|` 삽입 0 — 표 row 자체를 건드리지 않았으므로 T-1370 / T-1375 형 사고 재발 여지 없음. dangling 0 이라 REQ 값 수정 대상도 없었다.

**R-112 대체 검증 (doc-only)** — 코드 변경 0. 위 awk / grep / comm 출력값 전건을 본 절에 박제하는 것으로 대체. 추가로 `wc -l docs/use-cases/INDEX.md` → 편집 전 **110** → 편집 후 **113** (+3 행, 상한 +3 이내 충족). 인용 총 건수는 편집 후에도 **41** 로 불변 (부기 문단 안의 수치가 표 컬럼 추출 정규식에 섞이지 않음을 확인).

**한계 —** 본 slice 가 검증하지 않은 축:

1. **의미적 타당성** — 인용된 REQ 가 해당 UC 의 내용과 실제로 맞는 REQ 인지는 판정하지 않았다 (ID 실재 여부만).
2. **역방향 coverage** — 66 REQ 중 어느 UC row 에도 인용되지 않은 REQ 집합 (41 인용 / 33 unique 이므로 최소 33 개 REQ 는 미인용) 의 집계·판정은 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 소관.
3. **다른 컬럼 오타** — actor / 주요 component / 주요 module 컬럼이 23~25 행 제약 (허용 값 집합) 을 지키는지는 미검증 (T-1391 Follow-up 2).
4. **UC 본문 충실도** — 각 UC-NN-*.md 본문이 표 row 의 REQ 인용과 정합한지, 본문 안에서 인용되는 REQ ID 의 실재 여부는 범위 밖 (T-1391 Follow-up 3).

## Follow-ups

1. **역방향 coverage 실측** — 본 slice 가 forward 방향 dangling 0 을 확정했으므로, 남은 축은 "66 REQ 중 §2 표에 인용되지 않은 33 개 (66 − unique 33)" 의 실체 확인. `REQ-COVERAGE-AUDIT.md` 의 기존 판정과 이 수치가 정합하는지 대조하는 slice 가 필요 (본 slice Out of Scope).
2. **UC 본문 내 REQ 인용 실재 대조** — 본 slice 는 INDEX.md §2 표만 봤다. 8 개 UC 본문 파일 안에서 인용되는 REQ ID 도 같은 방식으로 forward 대조하는 slice.
