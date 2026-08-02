---
id: T-1395
title: REQ-COVERAGE-AUDIT 의 REQ-031 · REQ-034 `adjacent` vs `uc-covered` 귀속을 3 축 실측으로 재판정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1394]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1395-uc-audit-req031-req034-attribution-rejudge.md
plannerNote: "uc-doc-audit-resync 7 번째 slice — T-1394 Follow-up 1 (REQ-031·034 귀속 재판정) 처리, 매트릭스 row 변경은 cascade 라 Out of Scope, doc-only direct"
---

# T-1395 — REQ-COVERAGE-AUDIT 의 REQ-031 · REQ-034 `adjacent` vs `uc-covered` 귀속을 3 축 실측으로 재판정

## Why

[T-1393](T-1393-req-coverage-reverse-coverage-recheck.md) 이 §4 · §5 의 요약 수치 오차 3 건을 특정하고 [T-1394](T-1394-req-coverage-audit-narrative-number-fix.md) 가 그 숫자를 §3 매트릭스 실측 anchor 로 정정하면서, **두 slice 모두 판정을 미룬 단 하나의 잔여 축** 이 REQ-031 · REQ-034 의 귀속이다 — §4 106 행 bullet 은 두 REQ 를 UC-01 의 `adjacent` 로 적고, §3 매트릭스 65 · 68 행은 `uc-covered` 로 분류한다. T-1394 는 이 차이를 117 행 blockquote 로 **명시만** 하고 "어느 귀속이 옳은지의 재판정은 미수행" 이라고 못박았으며, 그 미판정이 곧 T-1394 가 스스로 적은 "anchor 자체가 stale 하면 본 정정값도 함께 stale" 이라는 한계의 실체다. 본 slice 는 그 anchor 를 **선언이 아니라 실측** 으로 확정한다 — UC-01 frontmatter `adjacentReq` 4 건의 처리 차이 · UC-01 본문의 실 서술 근거 · 매트릭스 근거 셀 문구 3 축을 대조해 귀속을 판정하고, 판정이 매트릭스 row 변경을 요구하지 않는 경우에 한해 문서 서술을 판정 결과로 sharpen 한다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 65 행 · 68 행 — §3 매트릭스의 REQ-031 · REQ-034 row. 근거 셀이 각각 `UC-01 (인접, P5 알고리즘)` · `UC-01 (인접, P5 trigger)` 로 **이미 "인접" 을 근거로 명시** 한다는 점이 본 판정의 핵심 입력. **두 row 는 read-only** (분류값 변경은 Out of Scope).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 106 행 — §4 UC-01 bullet 의 `coversReq` / `adjacent` / `envelope-cover` 3 분류 나열. **본 slice 는 이 행을 원칙적으로 무수정** (T-1393 축 B 가 bullet union 33 의 정확성을 확인한 상태라 건드리면 그 실측이 흔들린다).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 117 행 blockquote — T-1394 가 넣은 13 vs 15 해설. **마지막 문장 "어느 귀속이 옳은지의 재판정은 미수행 (§10 참조)" 이 본 slice 의 유일한 inline 수정 대상 후보**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 214 행 — §10 dated 절. 본 slice 는 **214 행 뒤에 bullet 을 append** 한다. 기존 15 줄 무수정.
- `docs/use-cases/UC-01-evaluation-execution.md` 7 ~ 8 행 (`coversReq` 13 건 / `adjacentReq: [REQ-008, REQ-031, REQ-032, REQ-034]`) · 71 행 · 80 행 (§5 sequence 의 REQ-031 Note 2 곳) · 130 행 (§8 postcondition 의 REQ-034) · 173 행 (§10 관련 REQ 표의 `REQ-031 (인접)` row) — 본문 cover 근거 실측 대상. **read-only**.
- `docs/requirements.md` 50 행 (REQ-031) · 53 행 (REQ-034) — 두 REQ 의 원문 요구 문장. 귀속 판정의 의미 기준. **read-only**.

## Acceptance Criteria

- [ ] **축 A — `adjacentReq` 4 건의 처리 차이 실측** — UC-01 8 행 `adjacentReq` 의 4 건 (REQ-008 · 031 · 032 · 034) 각각에 대해 "8 UC 중 어느 UC 의 `coversReq` 에 직접 명시되는가" 를 `grep -n "^coversReq" docs/use-cases/UC-0*.md` 실측으로 판정하고, 4 건 × (직접 명시 UC 또는 `없음`) 표를 완료 기록에 박제한다. 기대값은 REQ-008 → UC-08 · REQ-032 → UC-07 · REQ-031 → 없음 · REQ-034 → 없음 이며, **다르면 그 사실을 그대로 적고 이후 판정을 그 실측에 맞춘다**.
- [ ] **축 B — UC-01 본문의 실 서술 근거 실측** — REQ-031 · REQ-034 각각이 UC-01 본문 어느 절에서 어떤 문장으로 서술되는지 `grep -n "REQ-031\|REQ-034" docs/use-cases/UC-01-evaluation-execution.md` 로 전건 열거하고, hit 마다 (행 번호, 절 이름, 서술 성격 = 흐름 Note / postcondition / 관련 REQ 표) 를 완료 기록에 적는다. 두 REQ 중 **본문 근거가 0 건인 것이 있으면** 그 사실을 판정의 반례로 명시한다.
- [ ] **축 C — 매트릭스 근거 셀 문구 대조** — 65 · 68 행 근거 셀이 `uc-covered` 분류를 **`인접`(adjacent) 근거로** 적고 있는지를 원문 인용으로 확인하고, 그로부터 "`adjacent` 는 §3 분류 체계에서 `uc-covered` 의 **배제 사유가 아니라 하위 근거**" 인지 여부를 판정한다. 이 판정이 본 slice 결론의 중심축이므로 **인용 원문을 그대로** 완료 기록에 남긴다.
- [ ] **종합 판정 + 조치 분기** — 축 A·B·C 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **매트릭스 유지** (=`uc-covered` 가 옳고 bullet 의 `adjacent` 는 모순이 아닌 다른 축의 표기) → 117 행 blockquote 마지막 문장을 재판정 결과 1 문장으로 교체 + §10 bullet append. §4 106 행 bullet · §3 매트릭스 row **무수정**.
  - (나) **bullet 이 옳고 매트릭스 row 가 틀림** → **본 slice 에서 매트릭스를 고치지 않는다**. 판정 사실과 그로 인한 cascade 범위 (§5 count 48 · §4 115 행 정합식 · INDEX 110 행 · PLAN 36 행) 만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **실측이 (가)·(나) 어느 쪽도 지지하지 않음** → 판정 보류를 그대로 적고 문서 본문은 §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (214 행) **뒤** 에 `- **2026-08-02 귀속 재판정 (T-1395)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A·B·C 실측 요약, (2) 종합 판정 (가/나/다 중 무엇인지), (3) 212 행 "미검증 축" 이 열거한 `adjacent 서술의 정확성 (REQ-031 · REQ-034 귀속 포함)` 항목이 본 bullet 으로 **해소 또는 축소** 됐다는 시점 명시. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변** (T-1394 정정값 보존), (e) `git diff --stat` 변경 파일이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` **1 개** (+ 본 task 파일) — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **117 행 blockquote (분기 (가) 인 경우) · §10 말미 append 2 지점 이내** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. 표 셀을 편집한 경우 해당 행의 `|` 개수가 편집 전후 **동일** 함을 세어 함께 적는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (§4 bullet 의 envelope-cover 나열 13 건 자체의 의미적 타당성 · §3 매트릭스 나머지 64 row 의 분류 재판정 · UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지의 전수 검증 · REQ-031 · REQ-034 구현 실재 여부) 를 열거한다.

## Out of Scope

- **§3 매트릭스 65 · 68 행 (또는 다른 어떤 row) 의 분류값 변경** — 일절 금지. 분류값을 바꾸면 §5 count 48 · §4 115 행 정합식 · INDEX 110 행 · PLAN 36 행까지 cascade 하므로 판정이 (나) 로 나와도 본 slice 는 기록만 한다.
- **§4 106 ~ 113 행 bullet 8 줄 수정** — 금지 (T-1393 축 B 의 union 33 실측 기반 보존).
- **§4 115 행 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용.
- **`docs/use-cases/UC-01-evaluation-execution.md` · `docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `src/` 수정** — 전부 read-only. UC-01 의 `adjacentReq` / `coversReq` frontmatter 도 건드리지 않는다.
- **REQ-031 · REQ-034 의 구현 실재 재판정** — requirements.md 50 · 53 행의 DONE 판정 (T-1375 계열 slice 소관) 은 본 slice 의 대상이 아니다. 본 slice 는 **UC cover 귀속** 만 본다.
- **새 dated 절 (§12) 신설 · References 번호 변경** — 금지.

## Suggested Sub-agents

`implementer` (grep 3 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
