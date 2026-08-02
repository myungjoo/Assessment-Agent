---
id: T-1400
title: UC-06 · UC-07 이 자기 frontmatter coversReq 6 선언 (unique 5 건 — REQ-037 / 041 / 045 · REQ-030 / 032 / 045) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1399]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1400-uc06-uc07-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 12 번째 slice — T-1399 Follow-up 1 번 (UC-06 + UC-07 묶음, REQ-045 공통 중복 실측 회피 규약 포함), doc-only direct"
---

# T-1400 — UC-06 · UC-07 이 자기 frontmatter coversReq 6 선언 (unique 5 건) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증

## Why

[T-1399](T-1399-uc04-uc08-coversreq-selfcover-verify.md) 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 의 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 를 UC-04 · UC-08 4 건까지 밀어 올리고 (UC-02 포함 8 UC 중 3 UC · union 33 중 8 건), 비용 실측 결과 **2 UC 묶음 slice 가 단독 UC slice 와 실질 동일 비용** 임을 확인했다. 그 Follow-up 1 번이 지목한 다음 묶음이 **UC-06 (REQ-037 / 041 / 045) + UC-07 (REQ-030 / 032 / 045)** 이다. 두 UC 모두 §10 관련 REQ 표에 자기 cover 근거 절을 스스로 선언하고 있어 T-1398 · T-1399 와 동일한 축 C 대조가 그대로 성립하며, **REQ-045 가 양 UC 공통** 이라 Follow-up 이 요구한 **중복 실측 회피 규약** 을 본 slice 에서 확정한다.

## Required Reading

- `docs/use-cases/UC-06-evaluation-delete-reeval.md` — 실측 모집단 1, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 33(§3) · 41(§4) · 53(§5) · 97(§6, 하위 99/103/107/111/115) · 121(§7) · 132(§8) · 142(§9) · 156(§10) · 172(§11), 총 **184 행**. frontmatter `coversReq` 는 7 행, Refs 줄은 184 행.
- `docs/use-cases/UC-06-evaluation-delete-reeval.md` 160 ~ 168 행 — §10 관련 REQ 표 (header 160 · sep 161 · row 162 ~ 168). **162 행 = REQ-037 · 163 행 = REQ-041 · 164 행 = REQ-045 의 자기 선언 근거 절** (예: REQ-045 → `§2 actor / §4 precondition 2 / §5 step 5 / §7.2 — 본 UC 는 재작성·Reset 권한 박제`). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/UC-07-export-import.md` — 실측 모집단 2, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 33(§3) · 40(§4) · 51(§5) · 107(§6, 하위 109/113/117/121/125) · 129(§7) · 140(§8) · 148(§9) · 162(§10) · 178(§11), 총 **190 행**. frontmatter `coversReq` 는 7 행, Refs 줄은 190 행.
- `docs/use-cases/UC-07-export-import.md` 166 ~ 174 행 — §10 관련 REQ 표 (header 166 · sep 167 · row 168 ~ 174). **168 행 = REQ-030 · 169 행 = REQ-032 · 170 행 = REQ-045 의 자기 선언 근거 절** (예: REQ-045 → `§2 actor / §4 precondition 2 / §5 step 7 / §7.2 — 본 UC 는 Import / Export 권한 박제`). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 64 · 66 · 71 · 75 · 79 행 — §3 매트릭스의 REQ-030 · REQ-032 · REQ-037 · REQ-041 · REQ-045 row (5 건 모두 `uc-covered`, 근거 셀이 각각 `UC-07 coversReq` (64 · 66) · `UC-06 coversReq` (71 · 75) · `다수 UC coversReq` (79)). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 111 · 112 행 — §4 의 UC-06 · UC-07 bullet (coversReq + adjacent 나열). **read-only** (T-1393 축 B 가 union 33 정확성 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 232 행 — §10 dated 절 (마지막 bullet = 232 행, T-1399 분). 본 slice 는 **232 행 뒤에 bullet 을 append** 한다. 기존 33 줄 무수정, 234 행 `## 11. References` 무수정.
- `docs/requirements.md` 49 · 51 · 56 · 60 · 64 행 — 5 건의 원문 요구 문장 (의미적 판정 기준). **read-only** — status 셀이 매우 길다 (`cut -c1-150` 정도로 앞부분만 봐도 충분).

## Acceptance Criteria

- [ ] **중복 실측 회피 규약 확정 (선행 항목)** — REQ-045 는 UC-06 · UC-07 **양쪽 coversReq 에 있으므로 선언 단위로 2 회 (UC-06 164 행 · UC-07 170 행), REQ 단위로는 1 건** 으로 센다. 완료 기록 첫머리에 이 규약을 1 줄 명시하고, 이후 모든 집계에서 **"선언 6" (UC-06 3 + UC-07 3) 과 "unique REQ 5"** 를 구분해 쓴다. grep 은 UC 파일별로 따로 돌려 hit 가 파일 간에 섞이지 않게 한다.
- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-037\|REQ-041\|REQ-045" docs/use-cases/UC-06-evaluation-delete-reeval.md` 와 `grep -n "REQ-030\|REQ-032\|REQ-045" docs/use-cases/UC-07-export-import.md` 를 각각 실행해 hit 를 전건 열거하고, **UC 별 표 2 개** (각 3 선언 × (hit 행 번호 목록 · 각 hit 가 속한 절)) 를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (UC-06 160 ~ 168 · UC-07 166 ~ 174 행) · Refs 줄 (UC-06 184 · UC-07 190 행) 의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1397](T-1397-uc02-envelope-cover-basis-rejudge.md) · [T-1398](T-1398-uc02-coversreq-selfcover-verify.md) · [T-1399](T-1399-uc04-uc08-coversreq-selfcover-verify.md) 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님). **§ 제목 줄 안의 ID** (예: UC-06 99 행 `### 6.1 3 sub-trigger 의 분기 (REQ-037, REQ-041)`, UC-07 109 · 113 행) 는 본문 hit 로 계상하되 `제목` 표기를 병기한다.
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1398 · T-1399 와 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 등급 분포를 **선언 6 기준** 으로 (강 N / 약 N / 없음 N) 적고, REQ-045 는 UC-06 · UC-07 각각의 등급을 따로 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다 (특히 (약) · (없음) 판정 선언에 대해 의무 — REQ-045 는 §5 step 5 / step 7 의 권한 검사 서술이 유력 anchor 후보).
- [ ] **축 C — 자기 선언 절 대조** — UC-06 162 · 163 · 164 행, UC-07 168 · 169 · 170 행이 6 선언 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다. 6 선언의 판정 결과를 표에 한 컬럼으로 적고, 선언 항 총수 · `선언에만 있음` · `실측에만 있음` 항 수를 합계로 적는다.
- [ ] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 64 · 66 · 71 · 75 · 79 행 5 row 의 분류값과 근거 셀을 원문 인용하고, 5 건 모두 `uc-covered` 이며 근거 셀이 각각 `UC-07 coversReq` (64 · 66) · `UC-06 coversReq` (71 · 75) · `다수 UC coversReq` (79) 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 특히 **79 행 REQ-045 의 UC 열 `UC-03, UC-05, UC-06, UC-07`** 중 본 slice 가 실측한 UC-06 · UC-07 2 개만 검증 범위임을 명시한다 (UC-03 · UC-05 분은 미실측 — 한계 항목). 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 6 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 선언이 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (232 행) **뒤** 에 `- **2026-08-03 UC-06 · UC-07 coversReq 자기 cover 검증 (T-1400)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (UC 별 hit 행 + 등급 분포 숫자 포함), (2) 축 C 자기 선언 절 대조 결과 (일치 / 선언에만 / 실측에만 항 수) + REQ-045 중복 규약 1 줄, (3) 축 D 매트릭스 정합 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목의 **진행률 시점 명시** — UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (본 bullet) = **8 UC 중 5 UC · coversReq union 33 중 13 건 실측**, 잔여 **20 건** (UC-01 13 · UC-03 신규 6 · UC-05 신규 1 — REQ-045 · REQ-049/051~055 중복 제외 후) 이라 해당 축은 **축소된 채 존속** 함. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변** (123 ~ 127 행), (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-06-evaluation-delete-reeval.md` **184 불변** · `wc -l docs/use-cases/UC-07-export-import.md` **190 불변** (2 UC read-only 증명) — 6 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 · UC-03 · UC-05 의 자기 coversReq cover 검증 · REQ-045 의 UC-03 · UC-05 쪽 cover · UC-06 `adjacentReq` 4 건 (REQ-032 / 038 / 043 / 044) 과 UC-07 `adjacentReq` 4 건의 인접 서술 정확성 · 5 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` 56 · 64 행 기준 REQ-037 · REQ-045 는 IN_PROGRESS) · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다. 추가로 **공통 REQ 를 가진 2 UC 묶음의 비용 실측 결과** (본 slice diff LOC · 축당 grep 횟수) 를 1 줄 적어 다음 slice (UC-03 7 건 또는 UC-05 7 건 단독) 의 cap 판정 근거로 남긴다.

## Out of Scope

- **`docs/use-cases/UC-06-evaluation-delete-reeval.md` · `docs/use-cases/UC-07-export-import.md` 수정** — 일절 금지. 본 slice 는 두 UC 를 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 232 행 (T-1396 · T-1397 · T-1398 · T-1399 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` · `web/` 수정** — 전부 read-only.
- **5 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 특히 REQ-037 · REQ-045 의 IN_PROGRESS 사유를 재실측하지 않는다. 본 slice 는 **UC 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **UC-01 · UC-03 · UC-05 의 동일 검증 · `adjacentReq` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **UC-03 (7 건 — REQ-023 ~ 028 · 045) 의 자기 coversReq cover 검증** — REQ-045 는 본 slice 에서 UC-06 · UC-07 축으로만 실측했으므로 UC-03 선언 축은 별도 판정 필요.
- **UC-05 (7 건 — REQ-049 ~ 055) 의 자기 coversReq cover 검증** — 6 건이 UC-01 coversReq 와 중복이라 UC-01 slice 와의 실측 공유 규약이 필요하다.
- **UC-01 의 자기 `coversReq` 13 건 cover 검증** — 212 행 잔여 축의 최대 slice. §5/§6/§8 축과 §9/§10 축으로 분할 여부를 planner 가 판정할 것.
