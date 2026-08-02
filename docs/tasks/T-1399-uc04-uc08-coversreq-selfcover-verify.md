---
id: T-1399
title: UC-04 · UC-08 이 자기 frontmatter coversReq 4 건 (REQ-043 / 044 · REQ-008 / 016) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 75
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1398]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1399-uc04-uc08-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 11 번째 slice — 212 행 잔여 축의 2 UC 묶음 첫 실측 (UC-04 2 건 + UC-08 2 건 = 4 건, T-1398 과 동수라 cap 안전), doc-only direct"
---

# T-1399 — UC-04 · UC-08 이 자기 frontmatter coversReq 4 건 (REQ-043 / 044 · REQ-008 / 016) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증

## Why

[T-1398](T-1398-uc02-coversreq-selfcover-verify.md) 이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 중 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 를 UC-02 4 건 범위에서만 해소하고, UC-01 (13 건) · UC-03 ~ UC-08 7 UC 를 미실측으로 남겼다. 그 Follow-up 2 번이 "UC 당 4 ~ 7 건이라 2 UC 씩 묶는 slice 가 가능한지 판정" 을 지목한다. 본 slice 는 그 **2 UC 묶음 방법론의 첫 실측** 으로 `coversReq` 가 각 2 건인 **UC-04 (REQ-043 / 044) + UC-08 (REQ-008 / 016)** 를 택한다 — 합 4 건으로 T-1398 과 동수라 cap 안에서 "2 UC 를 한 slice 에 담을 수 있는가" 를 실증할 수 있고, 두 UC 모두 §10 관련 REQ 표에 **자기 cover 근거 절을 스스로 선언** 하고 있어 T-1398 과 동일한 축 C 대조가 그대로 성립한다.

## Required Reading

- `docs/use-cases/UC-04-account-auth.md` — 실측 모집단 1, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 33(§3) · 42(§4) · 52(§5) · 94(§6, 하위 96/100/104/108) · 112(§7, 하위 116/120/130/141/145) · 149(§8) · 160(§9) · 176(§10) · 189(§11), 총 **199 행**. frontmatter `coversReq` 는 7 행, Refs 줄은 199 행.
- `docs/use-cases/UC-04-account-auth.md` 180 ~ 185 행 — §10 관련 REQ 표. **182 행 = REQ-043 · 183 행 = REQ-044 의 자기 선언 근거 절** (예: REQ-043 → `§1 / §3 trigger 2–4 / §4 precondition 3 / §5 step 3 / §7.1 / §7.3 / §9 AuthModule`). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/UC-08-permission-denied.md` — 실측 모집단 2, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 36(§3) · 43(§4) · 55(§5) · 107(§6) · 115(§7) · 125(§8) · 133(§9) · 150(§10) · 166(§11), 총 **179 행**. frontmatter `coversReq` 는 7 행, Refs 줄은 179 행.
- `docs/use-cases/UC-08-permission-denied.md` 154 ~ 162 행 — §10 관련 REQ 표. **156 행 = REQ-008 · 157 행 = REQ-016 의 자기 선언 근거 절** (예: REQ-008 → `§1 / §2 Person / §3 trigger 1 / §5 alt GitHub 4xx + Person display / §6.1·6.4 / §8 (a)(c)(e) / §9`). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 42 · 50 · 77 · 78 행 — §3 매트릭스의 REQ-008 · REQ-016 · REQ-043 · REQ-044 row (4 건 모두 `uc-covered`, 근거 셀이 각각 `UC-08 coversReq` · `UC-04 coversReq` 를 지목). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 109 · 113 행 — §4 의 UC-04 · UC-08 bullet (coversReq + adjacent 나열). **read-only** (T-1393 축 B 가 union 33 정확성 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 228 행 — §10 dated 절 (마지막 bullet = 228 행, T-1398 분). 본 slice 는 **228 행 뒤에 bullet 을 append** 한다. 기존 29 줄 무수정, 230 행 `## 11. References` 무수정.
- `docs/requirements.md` 27 · 35 · 62 · 63 행 — 4 건의 원문 요구 문장 (의미적 판정 기준). **read-only** — REQ-008 · REQ-016 row 의 status 셀은 매우 길다 (cut 로 앞 120 자만 봐도 충분).

## Acceptance Criteria

- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-043\|REQ-044" docs/use-cases/UC-04-account-auth.md` 와 `grep -n "REQ-008\|REQ-016" docs/use-cases/UC-08-permission-denied.md` 를 각각 실행해 hit 를 전건 열거하고, **UC 별 표 2 개** (각 2 REQ × (hit 행 번호 목록 · 각 hit 가 속한 절)) 를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (UC-04 180 ~ 185 · UC-08 154 ~ 162 행) · Refs 줄 (UC-04 199 · UC-08 179 행) 의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1396](T-1396-uc-audit-envelope-cover-13-basis-recheck.md) · [T-1397](T-1397-uc02-envelope-cover-basis-rejudge.md) · T-1398 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님). **§ 제목 줄 안의 ID** (예: UC-04 96 · 116 · 120 · 130 · 145 행) 는 본문 hit 로 계상하되 `제목` 표기를 병기한다.
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1396 · T-1397 · T-1398 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 4 건의 등급 분포 (강 N / 약 N / 없음 N) 를 **2 UC 합계** 로 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다 (특히 (약) 판정 REQ 에 대해 의무).
- [ ] **축 C — 자기 선언 절 대조** — UC-04 182 · 183 행, UC-08 156 · 157 행이 4 건 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다. 4 건의 판정 결과를 표에 한 컬럼으로 적고, `선언에만 있음` / `실측에만 있음` 항 수를 합계로 적는다.
- [ ] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 42 · 50 · 77 · 78 행 4 row 의 분류값과 근거 셀을 원문 인용하고, 4 건 모두 `uc-covered` + 근거 셀이 `UC-08 coversReq` (42 · 50) · `UC-04 coversReq` (77 · 78) 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 4 건이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 REQ 가 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (228 행) **뒤** 에 `- **2026-08-03 UC-04 · UC-08 coversReq 자기 cover 검증 (T-1399)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (UC 별 hit 행 + 등급 분포 숫자 포함), (2) 축 C 자기 선언 절 대조 결과 (일치 / 선언에만 / 실측에만 항 수), (3) 축 D 매트릭스 정합 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목의 **진행률 시점 명시** — UC-02 (T-1398) + UC-04 · UC-08 (본 bullet) = **8 UC 중 3 UC · 33 union 중 8 건 실측** 이고 UC-01 (13 건) · UC-03 (7) · UC-05 (7) · UC-06 (3) · UC-07 (3) 는 미실측이라 **축소된 채 존속** 함. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-04-account-auth.md` **199 불변** · `wc -l docs/use-cases/UC-08-permission-denied.md` **179 불변** (2 UC read-only 증명) — 6 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 · UC-03 · UC-05 · UC-06 · UC-07 의 자기 coversReq cover 검증 · UC-04 `adjacentReq` 2 건 (REQ-045 / 046) 과 UC-08 `adjacentReq` 9 건의 인접 서술 정확성 · 4 건 REQ 의 **구현** 실재 여부 (REQ-043 은 `docs/requirements.md` 62 행 기준 IN_PROGRESS) · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다. 추가로 **2 UC 묶음 slice 의 비용 실측 결과** (본 slice diff LOC · 축당 grep 횟수) 를 1 줄 적어 다음 묶음 (UC-06 + UC-07 = 6 건) 의 cap 판정 근거로 남긴다.

## Out of Scope

- **`docs/use-cases/UC-04-account-auth.md` · `docs/use-cases/UC-08-permission-denied.md` 수정** — 일절 금지. 본 slice 는 두 UC 를 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 228 행 (T-1396 · T-1397 · T-1398 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` · `web/` 수정** — 전부 read-only.
- **4 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 특히 REQ-043 의 IN_PROGRESS 사유 (미보호 route 21 개) 를 재실측하지 않는다. 본 slice 는 **UC 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **UC-01 · UC-03 · UC-05 · UC-06 · UC-07 의 동일 검증 · `adjacentReq` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **UC-06 + UC-07 묶음 (REQ-037 / 041 / 045 · REQ-030 / 032 / 045 = unique 5 건) 의 자기 coversReq cover 검증** — 본 slice 의 비용 실측 결과를 근거로 cap 판정. REQ-045 가 양 UC 공통이라 중복 실측 회피 규약이 필요하다.
- **UC-03 (7 건) · UC-05 (7 건) 의 자기 coversReq cover 검증** — 각각 단독 slice 후보.
- **UC-01 의 자기 `coversReq` 13 건 cover 검증** — 212 행 잔여 축의 최대 slice. §5/§6/§8 축과 §9/§10 축으로 분할 여부를 planner 가 판정할 것.
