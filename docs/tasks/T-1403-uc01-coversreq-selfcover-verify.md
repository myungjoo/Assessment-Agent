---
id: T-1403
title: UC-01 이 자기 frontmatter coversReq 13 선언 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040 union 신규 7 + REQ-049 · 051 ~ 055 UC-01 축 잔여 6) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증 — 8 UC 마지막 slice
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1402]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1403-uc01-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 15 번째 slice — T-1402 Follow-up 1 번 (UC-01 13 선언, 마지막 UC), 분할 불요 재판정 후 단일 slice, doc-only direct"
---

# T-1403 — UC-01 이 자기 frontmatter coversReq 13 선언 (union 신규 7 + UC-01 축 잔여 6) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증

## Why

[T-1402](T-1402-uc05-coversreq-selfcover-verify.md) 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 의 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 를 UC-05 까지 밀어 올려 **8 UC 중 7 UC · coversReq union 33 중 26 건** 을 실측했고, 잔여는 **UC-01 전용 7 건 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040)** 뿐임을 확정하며 다음 slice 로 **UC-01 단독 (선언 13)** 을 지목했다. 그 Follow-up 1 번이 본 slice 이자 **본 축의 마지막 UC** 다. 본 slice 가 (가) 로 닫히면 212 행 미검증 축 4 항 중 해당 항이 **8 UC 전건 · union 33/33 으로 해소** 되고, 그 행에는 `§3 매트릭스 66 row 분류 자체의 재판정` 만 남는다. 아울러 T-1402 가 UC-05 축으로만 판정한 **REQ-049 · 051 ~ 055 6 건의 UC-01 선언 축** 도 본 slice 에서 판정해 dangling 항 0 으로 종결한다.

**분할 불요 재판정 (planner 선행 판정)** — [T-1401](T-1401-uc03-coversreq-selfcover-verify.md) Follow-up 2 번은 "13 선언은 본문 hit 100 건 규모라 2 slice 분할 권장" 이었으나, planner 가 `grep -c` 로 UC-01 을 사전 실측한 결과 **ID hit 행 34 = 본문 19 행 + 메타 15 행 (frontmatter 7 · §10 표 159 ~ 171 · Refs 193)** 이다. 선언 13 이 `REQ-005~007` · `REQ-051~055` 같은 **range 표기로 압축**되어 있어 본문 hit 행이 UC-03 (58 건) · UC-05 (64 건) 보다도 적으므로, T-1402 한계 절이 예고한 대로 **단일 slice 로 cap 안전** 하다고 재판정한다. 이 재판정 근거를 완료 기록에도 남긴다.

## Required Reading

- `docs/use-cases/UC-01-evaluation-execution.md` — 실측 모집단, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 32(§3) · 40(§4) · 51(§5) · 94(§6, 하위 96/100) · 104(§7, 하위 108/112/116/120) · 124(§8) · 133(§9) · 153(§10) · 179(§11), 총 **193 행**. frontmatter `coversReq` 는 7 행, `adjacentReq` 는 8 행, Refs 줄은 193 행.
- `docs/use-cases/UC-01-evaluation-execution.md` 157 ~ 175 행 — §10 관련 REQ 표 (header 157 · sep 158 · row 159 ~ 175). **159 = REQ-005 · 160 = REQ-006 · 161 = REQ-007 · 162 = REQ-014 · 163 = REQ-015 · 164 = REQ-039 · 165 = REQ-040 · 166 = REQ-049 · 167 = REQ-051 · 168 = REQ-052 · 169 = REQ-053 · 170 = REQ-054 · 171 = REQ-055 의 자기 선언 근거 절**, 172 ~ 175 는 인접 REQ-008 · 031 · 032 · 034 (본 slice 대상 아님 — T-1395 · T-1396 소관). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 39 · 40 · 41 · 48 · 49 · 73 · 74 행 — §3 매트릭스의 union 신규 7 row (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040, 전건 `uc-covered`, 근거 셀이 `UC-01 coversReq`). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 83 · 85 · 86 · 87 · 88 · 89 행 — §3 매트릭스의 UC-01 축 잔여 6 row (REQ-049 · 051 ~ 055, UC 열이 `UC-05, UC-01 (cover)` 또는 `UC-05, UC-01`, 근거 셀은 `UC-05 coversReq`). 축 D-2 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 106 행 — §4 의 UC-01 bullet (coversReq 13 + adjacent 4 + envelope-cover 13 나열). **read-only** (T-1393 축 B · T-1396 이 이미 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 244 행 — §10 dated 절 (마지막 bullet = 244 행, T-1402 분). 본 slice 는 **244 행 뒤에 bullet 을 append** 한다. 기존 45 줄 무수정, 246 행 `## 11. References` 무수정.
- `docs/requirements.md` 24 · 25 · 26 · 33 · 34 · 58 · 59 행 — union 신규 7 건의 원문 요구 문장 (의미적 판정 기준). **read-only** — status 셀이 매우 길다 (`cut -c1-150` 정도로 앞부분만 봐도 충분).

## Acceptance Criteria

- [ ] **계수 규약 확정 (선행 항목)** — UC-01 선언은 **13** 이고, 그중 **7 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) 이 union 신규**, **6 (REQ-049 · 051 · 052 · 053 · 054 · 055) 은 [T-1402](T-1402-uc05-coversreq-selfcover-verify.md) 가 UC-05 축으로 이미 실측** 했으므로 **union 진행률에는 신규 7 만 가산** 하되 그 6 건은 본 slice 에서 **UC-01 선언 축으로 신규 판정** 한다 (T-1402 가 남긴 미판정 항 해소). 완료 기록 첫머리에 이 규약을 2 줄 이내로 명시하고 이후 집계에서 **"선언 13" · "union 신규 7" · "UC-01 축 신규 판정 6"** 을 구분해 쓴다. 아울러 위 Why 절의 **분할 불요 재판정** (T-1401 Follow-up 2 번 권고를 planner 가 사전 실측으로 뒤집은 근거) 을 1 줄 박제한다.
- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-005\|REQ-006\|REQ-007\|REQ-014\|REQ-015\|REQ-039\|REQ-040\|REQ-049\|REQ-051\|REQ-052\|REQ-053\|REQ-054\|REQ-055" docs/use-cases/UC-01-evaluation-execution.md` 를 **1 회** 실행해 hit 를 전건 열거하고, **13 선언 × (hit 행 번호 목록 · 각 hit 가 속한 절)** 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (157 ~ 175 행) · Refs 줄 (193 행) 의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1398](T-1398-uc02-coversreq-selfcover-verify.md) ~ T-1402 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님). **range 표기 hit 는 T-1402 규약을 계승** 해 각 선언에 계상하고 `range` 를 병기한다 — 본 UC 는 `REQ-051~055` (47 · 82 · 143 행) 외에 **`REQ-005~007` (141 행) 형태가 최초 등장** 하므로 그 확장 규약을 1 줄 명시한다. `### ` 제목 줄 안의 ID 가 있으면 본문 hit 로 계상하되 `제목` 을 병기한다.
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1398 ~ T-1402 와 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 · §11 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 등급 분포를 **선언 13 기준** 과 **union 신규 7 기준** 두 줄로 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다 — **§8 Postconditions (124 ~ 132 행) 는 13 선언 어느 ID 도 직접 hit 이 없을 개연성이 높으므로 (약) · (없음) 판정 선언에 대해 위임 문장 인용이 의무** 이고, REQ-014 (Issue 평가) · REQ-015 (Confluence SPACE) 의 §8 결과 row 서술이 유력 후보다.
- [ ] **축 C — 자기 선언 절 대조** — UC-01 159 ~ 171 행이 13 선언 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다. 13 선언의 판정 결과를 표에 한 컬럼으로 적고, 선언 항 총수 · `선언에만 있음` · `실측에만 있음` 항 수를 합계로 적는다. **`§5 step 5` · `step 6` · `step 7` · `step 5–7` · `step 8` · `step 10` · `alt cron` · `alt manual` 표기가 다수 등장** 하므로 arrow 계수 규약 (§5 51 ~ 93 행의 arrow 만 계수 · alt / opt block arrow 포함 · `Note over` 제외) 으로 각 항 ±1 검산하고, 편차가 있으면 T-1400 ~ T-1402 부기와 동형으로 **기록만** 한다 (정정은 Out of Scope).
- [ ] **축 D — §3 매트릭스 근거 셀 정합 (union 신규 7)** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 39 · 40 · 41 · 48 · 49 · 73 · 74 행 7 row 의 분류값과 근거 셀을 원문 인용하고, 7 건 모두 `uc-covered` 이며 근거 셀이 `UC-01 coversReq` 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 특히 **39 · 40 · 41 · 48 · 49 행의 UC 열 `UC-01, UC-08 (인접)`** 이 UC-01 §7.1 (108 ~ 111 행) 의 UC-08 위임 서술과 정합하는지 1 줄로 확인한다. 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **축 D-2 — UC-01 축 잔여 6 의 매트릭스 정합 + `(cover)` 표기 비일관 기록** — 83 · 85 ~ 89 행 6 row 를 원문 인용하고, UC 열이 `UC-05, UC-01` 로 UC-01 을 함께 지목하면서 **근거 셀은 `UC-05 coversReq` 만 지목** 하는 구조가 본 slice 의 UC-01 축 실측 (13 선언 중 6 건이 UC-01 frontmatter 에도 실재) 과 **충돌하지 않음** 을 명시한다. 아울러 **83 행만 `UC-05, UC-01 (cover)` 로 `(cover)` 를 달고 85 ~ 89 행은 달지 않는** 표기 비일관을 **후보로 기록만** 하고 정정하지 않는다 (Out of Scope — cascade 없음). 본 축 판정으로 T-1402 가 남긴 "REQ-049 · 051 ~ 055 의 UC-01 선언 축 미판정" dangling 항이 **종결** 됨을 1 줄 박제한다.
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D · D-2 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 13 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D · D-2 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 선언이 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (244 행) **뒤** 에 `- **2026-08-03 UC-01 coversReq 자기 cover 검증 (T-1403)** — …` 로 시작하는 bullet 을 **최대 5 줄** append 한다 (선언 13 이라 T-1398 ~ T-1402 의 4 줄보다 1 줄 여유 허용). 내용은 (1) 계수 규약 + 분할 불요 재판정 + 축 A · B 실측 요약 (hit 행 + 등급 분포 숫자 + `REQ-005~007` range 확장 규약 포함), (2) 축 C 자기 선언 절 대조 결과 (일치 / 선언에만 / 실측에만 항 수) + `§5 step N` ±1 부기, (3) 축 D · D-2 매트릭스 정합 + **UC-01 축 잔여 6 dangling 항 종결**, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목이 **8 UC 전건 (UC-02 T-1398 + UC-04 · UC-08 T-1399 + UC-06 · UC-07 T-1400 + UC-03 T-1401 + UC-05 T-1402 + UC-01 본 bullet) · coversReq union 33 중 33 건 실측** 으로 **해소** 되고, 같은 행의 잔여 축은 `§3 매트릭스 66 row 분류 자체의 재판정` (및 envelope-cover 의미적 타당성 · adjacent 서술 정확성 중 미해소분) 만 남음을 명시. **212 행 자체를 편집하지 않으며 새 `##` 절도 만들지 않는다** (§11 References 번호 churn 회피 — 212 행 문장 갱신은 Follow-up 소관).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변** (123 ~ 127 행), (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-01-evaluation-execution.md` **193 불변** (UC read-only 증명) — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 `adjacentReq` 4 건 (REQ-008 / 031 / 032 / 034) 의 인접 서술 정확성 — T-1395 부분 실측분 외 · UC-01 envelope-cover 13 건의 **의미적** 타당성 (T-1396 이 ID hit 만 실측) · 13 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` status 판정은 T-1375 계열 소관) · §3 매트릭스 66 row 분류 자체의 재판정 · 212 행 문장 자체의 갱신) 을 열거한다. 추가로 **본 축 종료 시점의 누적 비용 실측** 을 1 줄 적어 (6 slice T-1398 ~ T-1403 의 총 diff LOC · 총 bash 호출 규모), 향후 유사 전수 audit 축의 slice 설계 근거로 남긴다.

## Out of Scope

- **`docs/use-cases/UC-01-evaluation-execution.md` 수정** — 일절 금지. 본 slice 는 UC-01 을 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **`docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 ("미검증 축" 문장) 수정** — 본 축이 해소돼도 **금지**. 212 행은 §10 중간이라 편집 시 hunk 가 2 지점으로 늘어 T-1398 ~ T-1402 의 append-only 규약이 깨진다. 해소 사실은 새 bullet 안에서만 서술하고, 212 행 문장 갱신은 Follow-up 으로 넘긴다.
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지. 특히 축 D-2 가 기록만 하기로 한 **83 행의 `(cover)` 표기 vs 85 ~ 89 행 무표기** 비일관은 정정 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade 회피).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 244 행 (T-1396 ~ T-1402 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` · `web/` 수정** — 전부 read-only.
- **13 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 본 slice 는 **UC 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **UC-01 `adjacentReq` 4 건 · envelope-cover 13 건의 재판정** — 금지 (T-1395 · T-1396 소관, 남은 축은 Follow-up).
- **`§5 step N` 표기 편차의 실제 정정** — T-1400 (UC-06 164 행 · UC-07 170 행) · T-1401 (UC-03 177 ~ 183 행) · T-1402 (UC-05 201 ~ 207 행) 과 동일하게 UC read-only 라 본 slice 도 무수정. UC-01 159 ~ 171 행에서 같은 편차가 발견돼도 기록만 한다.
- **새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## 완료 기록 (2026-08-03)

**계수 규약** — UC-01 선언 **13** 중 **union 신규 7** (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) 만 union 진행률에 가산하고, **UC-01 축 신규 판정 6** (REQ-049 · 051 ~ 055) 은 T-1402 가 UC-05 축으로 이미 실측한 건이라 진행률 무가산 · 선언 축 판정만 한다. **분할 불요 재판정** — T-1401 Follow-up 2 번의 "2 slice 권장" 은 planner 사전 실측 (ID hit 행 34 = 본문 19 + 메타 15 < UC-03 58 · UC-05 64) 으로 뒤집혔고, 실제 단일 slice 로 cap 안에서 완결됐다 (range 압축 표기 덕).

**축 A — ID 직접 언급 실측** (`grep -n "REQ-005\|REQ-006\|REQ-007\|REQ-014\|REQ-015\|REQ-039\|REQ-040\|REQ-049\|REQ-051\|REQ-052\|REQ-053\|REQ-054\|REQ-055" docs/use-cases/UC-01-evaluation-execution.md` 1 회, hit 행 34 = 본문 19 + 메타 15). **range 확장 규약** — T-1402 의 `REQ-051~055` 규약을 계승하고, 본 slice 최초 등장한 `REQ-005~007` (141 행) 형태에도 동일 적용 (포함된 각 선언에 계상 + `range` 병기).

| 선언 | 본문 hit (행 · 절) | 메타 hit | 축 B 등급 | 축 C 대조 (선언 절 → 판정) |
| --- | --- | --- | --- | --- |
| REQ-005 | 74 (§5) · 141 (§9, range) | 7 · 159 · 193 | 강 | `§5 step 5 / §9 GithubModule` → 2 항 일치 |
| REQ-006 | 75 (§5) · 141 (§9, range) | 7 · 160 · 193 | 강 | `§5 step 6 / §9 GithubModule` → 2 항 일치 |
| REQ-007 | 76 (§5) · 141 (§9, range) | 7 · 161 · 193 | 강 | `§5 step 7 / §9 GithubModule` → 2 항 일치 |
| REQ-014 | 74 (§5) · 141 (§9) | 7 · 162 · 193 | 강 | `§5 step 5–7 / §9 GithubModule` → 2 항 일치 (step 6 · 7 은 위임 문장) |
| REQ-015 | 46 (§4) · 79 (§5) · 142 (§9) | 7 · 163 · 193 | 강 | `§5 step 8 / §9 ConfluenceModule` → 2 항 일치, §4 46 은 실측에만 |
| REQ-039 | 27 (§2) · 36 (§3) · 64 (§5 alt cron) · 139 (§9) · 183 (§11) | 7 · 164 · 193 | 강 | `§3 trigger 1 / §5 alt cron / §9 Scheduler` → 3 항 일치, §2 · §11 은 실측에만 |
| REQ-040 | 28 (§2) · 37 (§3) · 66 (§5 alt manual) · 140 (§9) · 183 (§11) | 7 · 165 · 193 | 강 | `§3 trigger 2 / §5 alt manual / §9 Worker` → 3 항 일치, §2 · §11 은 실측에만 |
| REQ-049 | 47 (§4) · 82 (§5) · 140 · 143 (§9) | 7 · 166 · 193 | 강 | `§4 precondition 4 / §5 step 10 / §9 LlmModule` → 3 항 일치, §9 140 Worker row 는 실측에만 |
| REQ-051 ~ 055 | 각 47 (§4, range) · 82 (§5, range) · 143 (§9, range) | 7 · 167 ~ 171 · 193 | 강 (각) | `§5 step 10 / §9 LlmModule` → 각 2 항 일치, §4 47 은 실측에만 |

**축 B — 근거 강도 분포**: 선언 13 기준 **강 13 / 약 0 / 없음 0**, union 신규 7 기준 **강 7 / 약 0 / 없음 0** (13 선언 전부 §5 Main flow 에 ID hit). §6 · §8 은 ID hit **0** 이나 위임 문장 anchor 실재 — §6.1 98 행 `cron / manual trigger 의 차이는 AssessmentRun row 의 source metadata 컬럼으로만 표현`, §8 128 행 `source, startedAt, endedAt, trigger 출처 metadata 박제` (REQ-039 · 040), §8 129 행 `각 인원 × 각 commit/문서 단위 (REQ-033) 의 기여도·난이도·양·평가문` (REQ-005 ~ 007 commit 축 · REQ-014 Issue 축 · REQ-015 Confluence 문서 축), §5 84 행 `평가문 + 난이도 + 기여도 + 양` 반환 (REQ-049 · 051 ~ 055).

**축 C 합계** — 선언 항 **29** (2×5 + 3×3 + 2×5), 전건 **일치**, `선언에만 있음` **0**, `실측에만 있음` **11 항**. `§5 step N` arrow 계수 (§5 92 행 규약 = 11 step, arrow 는 65 · 67 · 70 · 74 · 75 · 76 · 79 · 82 · 84 · 86 · 87 행) 검산: REQ-005 ~ 015 선언은 **일괄 +1 이르고** REQ-049 · 051 ~ 055 는 **+2 이르다** — 편차량이 앞선 `Note over` 개수 (71 / 71 + 80) 와 일치해 원인은 Note 계수 여부, `alt cron` · `alt manual` 은 편차 0. **기록만** (정정 Out of Scope).

**축 D** — §3 39 · 40 · 41 · 48 · 49 · 73 · 74 행 7 row 전건 `uc-covered` + 근거 셀 `— UC-01 coversReq`, 축 A ~ C 와 **어긋남 0**. 39 · 40 · 41 · 48 · 49 행 UC 열 `UC-01, UC-08 (인접)` 은 UC-01 §7.1 110 행 (4xx → `PermissionDeniedEvent` emit, 후속 처리는 UC-08 책임) · §4 113 행 bullet 과 정합.

**축 D-2** — 83 (`UC-05, UC-01 (cover)`) · 85 ~ 89 (`UC-05, UC-01`) 6 row 는 근거 셀이 `UC-05 coversReq` 만 지목하나 이는 대표 근거 1 개 표기일 뿐, UC-01 frontmatter 7 행이 같은 6 건을 선언한 실측과 **충돌 없음**. T-1402 dangling 항 (`REQ-049 · 051 ~ 055 의 UC-01 선언 축 미판정`) **종결**. 83 행만 `(cover)` 를 다는 표기 비일관은 **후보 기록만** (cascade 없음).

**종합 판정 — (가) frontmatter ↔ 본문 정합 확인.** §10 말미 bullet 5 줄 append 만 수행, 본문 무수정.

**불변 검산** — (a) `^| REQ-` **66** 불변, (b) `^## ` **11** 불변, (c) §5 count `48 / 4 / 13 / 1` + 합계 `**66** | **100 %**` 불변, (d) §4 115 행 `33 + 15 + 4 + 13 + 1 = 66` 불변, (e) `wc -l` UC-01 **193** 불변 (read-only 증명).

**hunk 국한 검증 (R-112 대체)** — `git diff -U0` hunk 헤더는 `@@ -244,0 +245,5 @@` **1 개뿐** (§10 말미 append 1 지점, §1 ~ §9 · §11 hunk 0). `git diff --numstat` = `5 0 docs/use-cases/REQ-COVERAGE-AUDIT.md` (삭제 **0**). `git status --porcelain` 은 `touchesFiles` 2 개 외 변경 **0**. 표 셀을 한 곳도 편집하지 않아 `|` 개수 대조 대상 행 **없음**.

**한계** — 본 slice 가 판정하지 않은 축: (1) UC-01 `adjacentReq` 4 건 (REQ-008 · 031 · 032 · 034) 의 인접 서술 정확성 중 T-1395 부분 실측분 외, (2) UC-01 envelope-cover 13 건의 **의미적** 타당성 (T-1396 은 ID hit 만), (3) 13 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` status — T-1375 계열 소관), (4) §3 매트릭스 66 row 분류 자체의 재판정, (5) 212 행 문장 자체의 갱신. **누적 비용 실측** — 본 축 6 slice (T-1398 ~ T-1403) 의 audit 문서 diff 는 `3 + 4 + 4 + 4 + 4 + 5 = 24` 줄 append · 삭제 0 이고 slice 당 bash 호출은 4 ~ 6 회 (축 A grep 1 · 불변/hunk 검산 1 ~ 2 · 보조 read 1 ~ 2) 규모 — 전수 audit 축을 UC 단위로 자르면 slice 당 cap 의 1/10 이하 비용으로 안전하게 진행됨을 보여준다.

## Follow-ups

1. **REQ-COVERAGE-AUDIT.md 212 행 문장 갱신** — 본 slice 로 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 축이 8 UC 전건 · union 33/33 으로 해소됐으므로 212 행 열거에서 해당 항을 제거하는 편집 (append-only 규약상 본 slice 는 금지 — 별도 slice 에서 §10 중간 hunk 1 지점만 여는 형태로).
2. **§3 매트릭스 66 row 분류 자체의 재판정** — 212 행 잔여 축. `uc-covered` / `cross-cutting` / `infrastructure` / `gap` 4 enum 귀속의 타당성 재검토 (본 축과 달리 §5 count · §4 정합식 cascade 를 동반하므로 사전 cascade 설계 필요).
3. **§3 83 행 `(cover)` 표기 비일관 정정** — 83 행만 `UC-05, UC-01 (cover)`, 85 ~ 89 행은 `UC-05, UC-01`. cascade 없는 표기 통일 (본 slice 는 기록만).
4. **UC-01 §10 표 `§5 step N` 편차 정정** — 159 ~ 171 행의 step 표기가 arrow 계수 대비 +1 / +2 (Note 계수 차). UC-06 · UC-07 (T-1400) · UC-03 (T-1401) · UC-05 (T-1402) 에서도 같은 편차가 기록돼 있어, 8 UC 의 step 표기 규약을 한 slice 에서 일괄 정합화하는 편이 효율적.
