---
id: T-1393
title: REQ-COVERAGE-AUDIT §4 역방향 coverage 를 8 UC frontmatter · INDEX §2 인용 집합과 실측 대조
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1392]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1393-req-coverage-reverse-coverage-recheck.md
plannerNote: "uc-doc-audit-resync 5 번째 slice — T-1392 Follow-up 1 (역방향 coverage 실측) 처리, §4 서술 수치 3 종 재검산 + §10 dated 절 신설, doc-only direct"
---

# T-1393 — REQ-COVERAGE-AUDIT §4 역방향 coverage 를 8 UC frontmatter · INDEX §2 인용 집합과 실측 대조

## Why

[T-1392](T-1392-uc-index-req-column-integrity.md) 가 `docs/use-cases/INDEX.md` §2 표의 forward 방향 (인용 → 실재) dangling 을 **0 건** 으로 확정하면서, 그 완료 기록의 "한계 (2)" 와 Follow-up 1 로 **역방향 축** — 66 REQ 중 §2 표에 인용되지 않은 33 개 (66 − unique 33) 의 실체와 분류 — 을 남겼다. 이 역방향 축은 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 소관이며, 그 §4 (UC 별 reverse view) 는 "8 UC 의 coversReq union: 31 REQ" 와 "envelope-cover (UC-01 의 P5 알고리즘 13 REQ)" 라는 **서술 수치** 를 갖고 있는데 §5 통계 표는 같은 분포를 "31 직접 + 17 envelope = uc-covered 48" 로 적어 두 절의 envelope 수치가 어긋나 보인다. 게다가 §4 마지막 문장의 합산식 `31 + 13 + 4 + 13 + 1` 은 산술적으로 66 이 되지 않는다. 본 slice 는 (a) INDEX §2 미인용 REQ 집합, (b) 8 UC 본문 frontmatter `coversReq` 의 실제 union, (c) §4 합산식의 산술 세 축을 **실측** 해 결과를 dated 절 하나로 박제한다. 수치 정정 자체는 본 slice 범위 밖 (cascade 대상이 §5 / INDEX / PLAN 까지 번져 파일 상한을 넘김) — 사실 판정만 남기고 정정은 Follow-up 으로 넘긴다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 102~115 행 — §4 "UC 별 REQ cover 요약 (reverse view)". 106~113 행이 UC-01 ~ UC-08 의 `coversReq` / `adjacent` / `envelope-cover` 서술, **115 행이 본 slice 의 1 차 검산 대상 문장** ("8 UC 의 coversReq union: 31 REQ … 합 = 31 + 13 + 4 + 13 + 1 = 66").
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 117~125 행 — §5 분류별 요약 통계 표. 121 행 `uc-covered | 48 | 73 % | 31 REQ … + 17 REQ … envelope` 이 §4 서술과의 대조 상대다. **표 자체는 수정하지 않는다** (T-1390 이 이미 재검산해 매트릭스와 1:1 일치 확인).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 164~196 행 — §9 "2026-08-02 재판정 (T-1389)". 본 slice 의 신설 절은 이 절의 서술 포맷 (축별 실측 → 판정 → 한계) 을 그대로 따른다. **§9 본문은 1 자도 수정하지 않는다.**
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 198 행 — `## 10. References`. 본 slice 가 §10 을 신설하므로 이 헤더는 `## 11. References` 로 번호만 바뀐다 (본문 무수정). 저장소 전체에서 본 문서의 `#10-...` anchor 링크는 0 건임을 `grep -rn "COVERAGE-AUDIT.md#"` 로 재확인한 뒤 진행한다.
- `docs/use-cases/INDEX.md` 29~38 행 — §2 UC 목록 표 8 row. 6 번째 컬럼 (관련 REQ) 이 인용 집합 추출 대상이다. **INDEX.md 는 본 slice 에서 수정하지 않는다** (read-only).
- `docs/tasks/T-1392-uc-index-req-column-integrity.md` "완료 기록" — 인용 총 41 건 / unique 33 개 / requirements row 66 의 직전 실측값. **그 수치를 근거로 복사하지 않고 본 slice 에서 다시 실측** 한 뒤 일치 여부를 적는다.

## Acceptance Criteria

- [ ] **축 A — INDEX §2 미인용 REQ 집합** — `comm -13 <(INDEX §2 표 인용 unique 정렬) <(requirements.md REQ ID 정렬)` 로 "requirements.md 에 있으나 §2 표 어느 row 에도 인용되지 않은 REQ" 를 산출해 **개수** 와 **ID 전건** 을 완료 기록에 적는다 (T-1392 실측대로면 66 − 33 = 33 건 기대 — 다르면 그 사실을 명시). 사용한 명령을 그대로 박제한다.
- [ ] **축 A' — 미인용 집합의 분류 분포** — 위 미인용 ID 각각을 §3 매트릭스 row 의 분류 컬럼 (`uc-covered` / `cross-cutting` / `infrastructure` / `gap`) 으로 집계해 4 값 분포를 적는다. 특히 **`uc-covered` 로 분류됐으면서 §2 표에는 미인용인 REQ 수** 를 별도 숫자로 뽑고, 그것이 "§2 표는 요약 index 이고 정답은 UC 본문 frontmatter" (104 행 선언) 와 모순되지 않음을 1 줄로 판정한다.
- [ ] **축 B — 8 UC frontmatter coversReq 실 union** — `grep -A3 "^coversReq" docs/use-cases/UC-0*.md` 또는 동등한 방법으로 8 개 UC 본문 파일의 frontmatter `coversReq` 를 추출해 **unique union 개수** 를 산출하고, §4 115 행이 선언한 **31** 과 일치하는지 판정한다. 불일치면 차이 나는 ID 를 열거한다 (2026-05-25 PR-28 reviewer 가 MINOR 로 "§4 narrative coversReq union 31→33 수치 오차" 를 이미 지적했으므로 그 지적의 재확인 여부도 1 줄로 적는다).
- [ ] **축 C — §4 합산식 산술 검산** — 115 행의 `31 + 13 + 4 + 13 + 1` 을 그대로 더한 값을 적고 66 과 같은지 판정한다. 다르면 §5 121 행의 "31 직접 + 17 envelope" 와 대조해 **어느 항이 어긋나는지** (envelope 13 vs 17) 를 1 줄로 특정한다. **본 slice 에서 115 행 · 121 행의 수치를 고치지 않는다.**
- [ ] **§10 dated 절 신설** — 198 행 `## 10. References` **앞** 에 `## 10. 2026-08-02 역방향 coverage 재검산 (T-1393)` 절을 신설한다. 본문은 **최대 18 줄**, 구성은 (1) 축 A 결과 (미인용 개수 + 분류 분포), (2) 축 B 결과 (union 실측 vs 선언 31), (3) 축 C 결과 (합산식 판정), (4) 종합 판정 1 줄, (5) 미검증 축 열거. 기존 `## 10. References` 헤더는 `## 11. References` 로 **번호만** 변경하고 그 본문 항목은 무수정.
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` 가 **66** 불변, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` 가 **10 → 11** (정확히 +1), (c) §1 ~ §9 본문 diff 0 (`git diff` 의 변경 hunk 가 §10 신설 + References 헤더 번호 1 줄에만 국한) 세 값을 완료 기록에 적는다. 표 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **R-112 대체 검증 (doc-only)** — 코드 변경 0 이므로 unit test 대신 위 comm / grep / awk 명령의 출력값을 완료 기록에 그대로 박제하는 것으로 검증을 대체한다. 추가로 `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 가 편집 전 **211** 행 대비 **+20 행 이내** 임을 확인해 적는다.
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 검증하지 않은 축 (envelope-cover 판정의 **의미적** 타당성 · `adjacent` 서술의 정확성 · UC 본문 §5 / §6 / §8 가 실제로 frontmatter 대로 cover 하는지 · §3 매트릭스 66 row 의 분류 자체의 재판정 · 발견된 수치 오차의 정정) 을 열거한다.

## Out of Scope

- **발견된 수치 오차의 실제 정정** — §4 115 행 / §5 121 행 / INDEX 110 행 / PLAN 36 행이 같은 4 값을 반복 인용하므로 정정은 cascade 다. 본 slice 는 **사실 판정만** 하고 정정은 Follow-up 으로 넘긴다.
- **§3 매트릭스 66 row 의 분류 재판정** — row 별 `uc-covered` / `cross-cutting` / `infrastructure` 판정의 타당성은 본 slice 범위 밖 (분류값을 **집계** 만 한다).
- **REQ-004 gap 재판정 · UC-09 신설 여부 결정** — [T-1389](T-1389-uc-coverage-audit-req-004-gap-rejudge.md) §9 가 이미 처리했고 정책 결정은 별도 slice.
- **UC 본문 내 REQ 인용 실재 대조** — T-1392 Follow-up 2. 8 개 UC 본문의 forward dangling 검사는 다음 slice 소관 (본 slice 는 frontmatter `coversReq` 의 **union 개수** 만 본다).
- `docs/use-cases/INDEX.md` · `docs/requirements.md` · `docs/PLAN.md` · `src/` 수정 — 일절 금지 (전부 read-only).
- §1 ~ §9 본문 · §3 매트릭스 row · §5 통계 표 수정 — 일절 금지.

## Suggested Sub-agents

`implementer` (doc 편집 + comm / grep / awk 실측) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 R-112 대체 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
