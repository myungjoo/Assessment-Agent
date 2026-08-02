---
id: T-1401
title: UC-03 이 자기 frontmatter coversReq 7 선언 (REQ-023 ~ 028 · 045 — union 신규 6 건) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 100
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1400]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1401-uc03-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 13 번째 slice — T-1400 Follow-up 1 번 (UC-03 단독 7 선언, REQ-045 는 UC-03 축만 신규 판정), doc-only direct"
---

# T-1401 — UC-03 이 자기 frontmatter coversReq 7 선언 (union 신규 6 건) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증

## Why

[T-1400](T-1400-uc06-uc07-coversreq-selfcover-verify.md) 이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 의 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 를 UC-06 · UC-07 까지 밀어 올려 **8 UC 중 5 UC · coversReq union 33 중 13 건** 을 실측했고, 한계 절에서 **공통 REQ 를 가진 2 UC 묶음도 단독 slice 와 실질 동일 비용** 임을 수치로 남기며 다음 slice 로 **UC-03 (7 건) 또는 UC-05 (7 건) 단독** 이 cap 안전하다고 판정했다. 그 Follow-up 1 번이 지목한 것이 **UC-03 (REQ-023 ~ 028 · REQ-045)** 이며, 특히 **REQ-045 는 T-1400 이 UC-06 · UC-07 축으로만 실측** 했으므로 UC-03 선언 축은 아직 미판정 상태다. 본 slice 는 UC-03 7 선언을 T-1398 · T-1399 · T-1400 과 동일한 4 축으로 실측해 union 실측분을 19 건으로 올린다.

## Required Reading

- `docs/use-cases/UC-03-person-crud.md` — 실측 모집단, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 33(§3) · 44(§4) · 52(§5) · 92(§6, 하위 94/100/104/110) · 114(§7, 하위 118/122/126/136/140) · 144(§8) · 155(§9) · 171(§10) · 189(§11), 총 **206 행**. frontmatter `coversReq` 는 7 행, Refs 줄은 206 행.
- `docs/use-cases/UC-03-person-crud.md` 175 ~ 185 행 — §10 관련 REQ 표 (header 175 · sep 176 · row 177 ~ 185). **177 = REQ-023 · 178 = REQ-024 · 179 = REQ-025 · 180 = REQ-026 · 181 = REQ-027 · 182 = REQ-028 · 183 = REQ-045 의 자기 선언 근거 절**, 184 · 185 는 인접 REQ-043 · REQ-044 (본 slice 대상 아님). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 57 · 58 · 59 · 60 · 61 · 62 · 79 행 — §3 매트릭스의 REQ-023 ~ REQ-028 · REQ-045 row (7 건 모두 `uc-covered`, 근거 셀이 `UC-03 coversReq` (57 ~ 62) · `다수 UC coversReq` (79)). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 108 행 — §4 의 UC-03 bullet (coversReq 7 + adjacent 2 나열). **read-only** (T-1393 축 B 가 union 33 정확성 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 236 행 — §10 dated 절 (마지막 bullet = 236 행, T-1400 분). 본 slice 는 **236 행 뒤에 bullet 을 append** 한다. 기존 37 줄 무수정, 238 행 `## 11. References` 무수정.
- `docs/requirements.md` 42 · 43 · 44 · 45 · 46 · 47 · 64 행 — 7 건의 원문 요구 문장 (의미적 판정 기준). **read-only** — status 셀이 매우 길다 (`cut -c1-150` 정도로 앞부분만 봐도 충분).

## Acceptance Criteria

- [ ] **계수 규약 확정 (선행 항목)** — UC-03 은 **선언 7 (REQ-023 ~ 028 · 045)** 이지만 REQ-045 는 [T-1400](T-1400-uc06-uc07-coversreq-selfcover-verify.md) 이 UC-06 · UC-07 축으로 이미 실측했으므로 **union 진행률에는 신규 6 건 (REQ-023 ~ 028) 만 가산** 한다. 완료 기록 첫머리에 이 규약을 1 줄 명시하고, 이후 모든 집계에서 **"선언 7" 과 "union 신규 6"** 을 구분해 쓴다. REQ-045 는 본 slice 에서 **UC-03 선언 축으로는 신규 판정** 임을 함께 명시한다 (T-1400 이 남긴 미판정 항).
- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-023\|REQ-024\|REQ-025\|REQ-026\|REQ-027\|REQ-028\|REQ-045" docs/use-cases/UC-03-person-crud.md` 를 실행해 hit 를 전건 열거하고, **7 선언 × (hit 행 번호 목록 · 각 hit 가 속한 절)** 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (175 ~ 185 행) · Refs 줄 (206 행) 의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1398](T-1398-uc02-coversreq-selfcover-verify.md) · [T-1399](T-1399-uc04-uc08-coversreq-selfcover-verify.md) · [T-1400](T-1400-uc06-uc07-coversreq-selfcover-verify.md) 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님). **§ 제목 줄 안의 ID** (94 행 `### 6.1 … (REQ-026)` · 100 행 `### 6.2 … (REQ-024)` · 104 행 `### 6.3 … (REQ-027)` · 110 행 `### 6.4 … (REQ-028)` · 122 행 `### 7.2 … (REQ-045)` · 126 행 `### 7.3 … (REQ-023, REQ-024, REQ-025)` · 140 행 `### 7.5 … (REQ-028)`) 은 본문 hit 로 계상하되 `제목` 표기를 병기한다.
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1398 ~ T-1400 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 등급 분포를 **선언 7 기준** 으로 (강 N / 약 N / 없음 N) 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다 (특히 (약) · (없음) 판정 선언에 대해 의무 — REQ-025 (NULL 허용) 와 REQ-045 (§5 step 3 권한 검증) 가 유력 후보).
- [ ] **축 C — 자기 선언 절 대조** — UC-03 177 ~ 183 행이 7 선언 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다 (특히 REQ-027 의 `§5 alt block (신규 인원)` · REQ-026 의 `§8 postcondition` 처럼 ID 없이 서술될 개연성이 높은 항). 7 선언의 판정 결과를 표에 한 컬럼으로 적고, 선언 항 총수 · `선언에만 있음` · `실측에만 있음` 항 수를 합계로 적는다. **`§5 step N` 표기가 등장하면 arrow 계수 규약 (alt / opt block arrow 포함 · `Note over` 제외) 으로 ±1 검산** 하고 편차가 있으면 T-1400 부기와 동형으로 기록만 한다 (정정은 Out of Scope).
- [ ] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 57 · 58 · 59 · 60 · 61 · 62 · 79 행 7 row 의 분류값과 근거 셀을 원문 인용하고, 7 건 모두 `uc-covered` 이며 근거 셀이 `UC-03 coversReq` (57 ~ 62) · `다수 UC coversReq` (79) 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 특히 **58 행 REQ-024 의 `UC-03 (+ P3 ADR)` 표기** 와 **60 행 REQ-026 의 UC 열 `UC-03, UC-01 (대상 명단)`** 이 본 slice 실측과 충돌하지 않음을 명시하고, **79 행 REQ-045 의 UC 열 4 개 중 UC-03 1 개만 본 slice 범위** 임을 밝힌다 (UC-05 분은 여전히 미실측 — 한계 항목). 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 7 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 선언이 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (236 행) **뒤** 에 `- **2026-08-03 UC-03 coversReq 자기 cover 검증 (T-1401)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (hit 행 + 등급 분포 숫자 포함), (2) 축 C 자기 선언 절 대조 결과 (일치 / 선언에만 / 실측에만 항 수) + REQ-045 계수 규약 1 줄, (3) 축 D 매트릭스 정합 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목의 **진행률 시점 명시** — UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (T-1400) + UC-03 (본 bullet) = **8 UC 중 6 UC · coversReq union 33 중 19 건 실측** (신규 6 = REQ-023 ~ 028), 잔여 **14 건** (UC-01 13 · UC-05 신규 1 = REQ-050) 이라 해당 축은 **축소된 채 존속** 함. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변** (123 ~ 127 행), (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-03-person-crud.md` **206 불변** (UC read-only 증명) — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 · UC-05 의 자기 coversReq cover 검증 · REQ-045 의 UC-05 쪽 cover · UC-03 `adjacentReq` 2 건 (REQ-043 / 044) 의 인접 서술 정확성 · 7 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` 64 행 기준 REQ-045 는 IN_PROGRESS) · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다. 추가로 **단독 UC 7 선언 slice 의 비용 실측** (본 slice diff LOC · 축당 grep 횟수) 을 1 줄 적어 다음 slice (UC-05 7 건 단독, 또는 UC-01 13 건의 분할 필요 여부) 의 cap 판정 근거로 남긴다.

## Out of Scope

- **`docs/use-cases/UC-03-person-crud.md` 수정** — 일절 금지. 본 slice 는 UC-03 을 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 236 행 (T-1396 · T-1397 · T-1398 · T-1399 · T-1400 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` · `web/` 수정** — 전부 read-only.
- **7 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 특히 REQ-045 의 IN_PROGRESS 사유를 재실측하지 않는다. 본 slice 는 **UC 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **T-1400 이 남긴 REQ-045 `§5 step N` ±1 표기 정정** (UC-06 164 행 · UC-07 170 행) — UC read-only 라 본 slice 도 무수정. UC-03 183 행에서 같은 편차가 발견돼도 기록만 한다.
- **UC-01 · UC-05 의 동일 검증 · `adjacentReq` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

Empty at creation.
