---
id: T-1398
title: UC-02 가 자기 frontmatter coversReq 4 건 (REQ-038 / 042 / 046 / 048) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 3 축 실측 검증
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1397]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1398-uc02-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 10 번째 slice — 212 행 잔여 축 (UC 본문 frontmatter 대비 전수 검증) 의 UC-02 개시분, 4 건이라 cap 안전, doc-only direct"
---

# T-1398 — UC-02 가 자기 frontmatter coversReq 4 건 (REQ-038 / 042 / 046 / 048) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 3 축 실측 검증

## Why

[T-1397](T-1397-uc02-envelope-cover-basis-rejudge.md) 이 §4 107 행 UC-02 bullet 의 **envelope-cover 3 건** 을 실측해 판정 (가) 로 닫으면서, `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 중 `envelope-cover 판정의 의미적 타당성` 이 전량 해소됐다. 같은 행에 남은 2 축 가운데 하나가 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 이며, T-1397 의 Follow-up 1 이 그 UC-02 slice 를 지목한다. 본 slice 는 그 축의 **첫 실측** 으로 UC-02 의 `coversReq` 4 건 (REQ-038 / 042 / 046 / 048) 을 대상으로 삼는다 — 8 UC 중 건수가 가장 작은 축 (UC-01 은 13 건) 이라 cap 안에서 방법론을 확립하기에 적합하다. 추가로 UC-02 는 §10 관련 REQ 표 (151 ~ 154 행) 에 **자기 cover 근거 절을 스스로 선언** 하고 있어, 그 선언과 본문 실측을 대조하면 "frontmatter ↔ 본문" 정합을 한 slice 안에서 양방향으로 닫을 수 있다.

## Required Reading

- `docs/use-cases/UC-02-evaluation-query.md` — 본 slice 의 유일한 실측 모집단, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 32(§3) · 41(§4) · 50(§5) · 85(§6, 하위 87/91/95) · 99(§7, 하위 103/107/111/115) · 119(§8) · 128(§9) · 145(§10) · 161(§11), 총 174 행. frontmatter `coversReq` 는 7 행.
- `docs/use-cases/UC-02-evaluation-query.md` 145 ~ 160 행 — §10 관련 REQ 표. 151 ~ 154 행이 4 건의 **자기 선언 근거 절** (예: REQ-038 → `§3 trigger 1–4 / §5 step 1–2, 8 / §6.2, §6.3 / §9`). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 72 · 76 · 80 · 82 행 — §3 매트릭스의 REQ-038 · 042 · 046 · 048 row (4 건 모두 `uc-covered`, 근거 셀에 `UC-02 coversReq` 명시). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 107 행 — §4 UC-02 bullet (coversReq 4 건 나열). **read-only** (T-1393 축 B 가 union 33 정확성 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 225 행 — §10 dated 절 (마지막 bullet = 225 행, T-1397 분). 본 slice 는 **225 행 뒤에 bullet 을 append** 한다. 기존 25 줄 무수정, 227 행 `## 11. References` 무수정.
- `docs/requirements.md` 57 · 61 · 65 · 67 행 — 4 건의 원문 요구 문장 (의미적 판정 기준). **read-only**.

## Acceptance Criteria

- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-038\|REQ-042\|REQ-046\|REQ-048" docs/use-cases/UC-02-evaluation-query.md` 를 실행해 hit 를 전건 열거하고, 4 건 × (hit 행 번호 목록 · 각 hit 가 속한 절) 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (145 ~ 160 행) · 174 행 Refs 줄의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1396](T-1396-uc-audit-envelope-cover-13-basis-recheck.md) · T-1397 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님).
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1396 · T-1397 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 4 건의 등급 분포 (강 N / 약 N / 없음 N) 를 합계로 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다.
- [ ] **축 C — 자기 선언 절 대조** — UC-02 §10 표 151 ~ 154 행이 4 건 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다. 4 건의 판정 결과를 표에 한 컬럼으로 적는다.
- [ ] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 72 · 76 · 80 · 82 행 4 row 의 분류값과 근거 셀을 원문 인용하고, 4 건 모두 `uc-covered` + 근거 셀이 `UC-02 coversReq` 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 4 건이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 REQ 가 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (225 행) **뒤** 에 `- **2026-08-03 UC-02 coversReq 자기 cover 검증 (T-1398)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (등급 분포 숫자 포함), (2) 축 C 자기 선언 절 대조 결과, (3) 축 D 매트릭스 정합 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목이 **UC-02 범위에서만 해소** 되고 UC-01 · UC-03 ~ UC-08 7 UC 는 미실측이라 **축소된 채 존속** 함을 시점 명시. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-02-evaluation-query.md` **174 불변** (UC-02 read-only 증명) — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 · UC-03 ~ UC-08 의 자기 coversReq cover 검증 · UC-02 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성 · 4 건 REQ 의 **구현** 실재 여부 · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다.

## Out of Scope

- **`docs/use-cases/UC-02-evaluation-query.md` 수정** — 일절 금지. 본 slice 는 UC-02 를 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 225 행 (T-1396 · T-1397 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` 수정** — 전부 read-only.
- **4 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 본 slice 는 **UC-02 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **UC-01 · UC-03 ~ UC-08 의 동일 검증 · `adjacentReq` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **UC-01 의 자기 `coversReq` 13 건 cover 검증** — 212 행 잔여 축의 최대 slice. 건수가 많아 cap 초과 risk 가 있으니 planner 가 §5/§6/§8 축과 §9/§10 축으로 분할 여부를 판정할 것.
- **UC-03 ~ UC-08 의 자기 `coversReq` cover 검증** — UC 당 4 ~ 7 건이라 2 UC 씩 묶는 slice 가 가능한지 판정.
- **UC-02 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성** — adjacent 축은 UC-01 (T-1395) 만 실측됐다.
