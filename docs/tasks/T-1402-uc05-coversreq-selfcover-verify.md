---
id: T-1402
title: UC-05 가 자기 frontmatter coversReq 7 선언 (REQ-049 ~ 055 — union 신규 7 건 전부) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 100
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1401]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1402-uc05-coversreq-selfcover-verify.md
plannerNote: "uc-doc-audit-resync 14 번째 slice — T-1401 Follow-up 1 번 (UC-05 단독 7 선언, 7 건 전부 union 신규), doc-only direct"
---

# T-1402 — UC-05 가 자기 frontmatter coversReq 7 선언 (union 신규 7 건 전부) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 4 축 실측 검증

## Why

[T-1401](T-1401-uc03-coversreq-selfcover-verify.md) 이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 "미검증 축" 의 **`UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지`** 를 UC-03 까지 밀어 올려 **8 UC 중 6 UC · coversReq union 33 중 19 건** 을 실측했고, 비용 실측 (선언 7 · diff +4 LOC · bash 4 회) 으로 **단독 UC 7 선언 slice 가 cap 대비 여유 매우 큼** 을 확인하며 다음 slice 로 **UC-05 (REQ-049 ~ 055) 단독** 을 지목했다. 그 Follow-up 1 번이 본 slice 다. UC-05 의 7 선언은 **어느 선행 slice 도 실측한 적이 없어 7 건 전부가 union 신규** 이며 (T-1401 의 REQ-045 처럼 중복 차감할 항이 없다), 이를 실측하면 union 은 **19 → 26** 으로 전진하고 잔여는 **UC-01 전용 7 건** 만 남는다. 부수적으로 T-1400 · T-1401 이 두 번 연속 "미실측" 으로 남긴 **§3 매트릭스 79 행 REQ-045 의 UC-05 분** 이 실은 UC-05 의 `adjacentReq` (coversReq 아님) 임을 축 D 에서 확정해 dangling 항을 닫는다.

## Required Reading

- `docs/use-cases/UC-05-llm-config.md` — 실측 모집단, **read-only**. 절 경계 실측값: 17(§1) · 23(§2) · 33(§3) · 42(§4) · 53(§5) · 94(§6, 하위 96/108/117/121) · 125(§7, 하위 129/133/137/150/154/158) · 167(§8) · 177(§9) · 195(§10) · 214(§11), 총 **225 행**. frontmatter `coversReq` 는 7 행, `adjacentReq` 는 8 행, Refs 줄은 225 행.
- `docs/use-cases/UC-05-llm-config.md` 199 ~ 210 행 — §10 관련 REQ 표 (header 199 · sep 200 · row 201 ~ 210). **201 = REQ-049 · 202 = REQ-050 · 203 = REQ-051 · 204 = REQ-052 · 205 = REQ-053 · 206 = REQ-054 · 207 = REQ-055 의 자기 선언 근거 절**, 208 ~ 210 은 인접 REQ-043 · 044 · 045 (본 slice 대상 아님). 축 C 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 83 · 84 · 85 · 86 · 87 · 88 · 89 행 — §3 매트릭스의 REQ-049 ~ REQ-055 row (7 건 모두 `uc-covered`, 근거 셀이 `UC-05 coversReq`). 축 D 의 대조 기준, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 79 행 — §3 매트릭스 REQ-045 row (UC 열 `UC-03, UC-05, UC-06, UC-07`). 축 D 의 dangling 항 판정 대상, **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 110 행 — §4 의 UC-05 bullet (coversReq 7 + adjacent 3 나열). **read-only** (T-1393 축 B 가 union 33 정확성 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 240 행 — §10 dated 절 (마지막 bullet = 240 행, T-1401 분). 본 slice 는 **240 행 뒤에 bullet 을 append** 한다. 기존 41 줄 무수정, 242 행 `## 11. References` 무수정.
- `docs/requirements.md` 68 · 69 · 70 · 71 · 72 · 73 · 74 행 — 7 건의 원문 요구 문장 (의미적 판정 기준). **read-only** — status 셀이 길다 (`cut -c1-160` 정도로 앞부분만 봐도 충분).

## Acceptance Criteria

- [ ] **계수 규약 확정 (선행 항목)** — UC-05 선언은 **7 (REQ-049 ~ REQ-055)** 이고, 이 7 건은 [T-1398](T-1398-uc02-coversreq-selfcover-verify.md) ~ [T-1401](T-1401-uc03-coversreq-selfcover-verify.md) 어느 slice 도 실측한 적이 없으므로 **union 진행률에 7 건 전부 가산** 한다 (T-1401 의 REQ-045 같은 중복 차감 항 **0**). 다만 이 중 **6 건 (REQ-049 · 051 · 052 · 053 · 054 · 055) 은 UC-01 의 coversReq 13 에도 동시에 들어 있어**, 본 slice 가 먼저 실측하면 **UC-01 선언 축으로는 여전히 미판정** 으로 남는다 (T-1401 이 REQ-045 를 UC-03 축으로 실측했어도 UC-05 축이 남았던 것과 동형). 완료 기록 첫머리에 이 규약을 2 줄 이내로 명시하고, 이후 집계에서 **"선언 7" · "union 신규 7" · "UC-01 축 잔여 6"** 을 구분해 쓴다.
- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-049\|REQ-050\|REQ-051\|REQ-052\|REQ-053\|REQ-054\|REQ-055" docs/use-cases/UC-05-llm-config.md` 를 실행해 hit 를 전건 열거하고, **7 선언 × (hit 행 번호 목록 · 각 hit 가 속한 절)** 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (199 ~ 210 행) · Refs 줄 (225 행) 의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 (T-1398 · [T-1399](T-1399-uc04-uc08-coversreq-selfcover-verify.md) · [T-1400](T-1400-uc06-uc07-coversreq-selfcover-verify.md) · T-1401 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님). **§ 제목 줄 안의 ID** (96 행 `### 6.1 … (REQ-051~055)` · 108 행 `### 6.2 … (REQ-050)` · 137 행 `### 7.3 … (REQ-049, REQ-050, REQ-051~055)` · 158 행 `### 7.6 … (REQ-050)`) 은 본문 hit 로 계상하되 `제목` 표기를 병기하고, **`REQ-051~055` 같은 range 표기 hit 는 5 선언 각각에 계상** 하되 `range` 표기를 병기한다 (본 slice 최초 등장 규약 — 완료 기록에 1 줄 명시).
- [ ] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1398 ~ T-1401 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 등급 분포를 **선언 7 기준** 으로 (강 N / 약 N / 없음 N) 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다 (특히 (약) · (없음) 판정 선언에 대해 의무 — §8 Postconditions (167 ~ 176 행) 의 API key 마스킹 · 3 슬롯 매핑 확정 서술과 §6.4 (121 ~ 124 행) 이 유력 후보).
- [ ] **축 C — 자기 선언 절 대조** — UC-05 201 ~ 207 행이 7 선언 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다 (특히 REQ-050 의 `§8` 항). 7 선언의 판정 결과를 표에 한 컬럼으로 적고, 선언 항 총수 · `선언에만 있음` · `실측에만 있음` 항 수를 합계로 적는다. **7 선언이 모두 `§5 step 5` 를 선언** 하므로 arrow 계수 규약 (§5 53 ~ 93 행의 arrow 만 계수 · alt / opt block arrow 포함 · `Note over` 제외) 으로 ±1 검산하고, 편차가 있으면 T-1400 · T-1401 부기와 동형으로 **기록만** 한다 (정정은 Out of Scope).
- [ ] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 83 ~ 89 행 7 row 의 분류값과 근거 셀을 원문 인용하고, 7 건 모두 `uc-covered` 이며 근거 셀이 `UC-05 coversReq` 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 특히 **84 행 REQ-050 의 `UC-05 (+ P4 ADR)` 표기 + `ADR 필수` 근거 셀** 과 **83 · 85 ~ 89 행의 UC 열 `UC-05, UC-01`(또는 `UC-05, UC-01 (cover)`)** 이 본 slice 실측과 충돌하지 않음을 명시한다. 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [ ] **축 D-2 — REQ-045 dangling 항 확정 (T-1400 · T-1401 잔여)** — [T-1400](T-1400-uc06-uc07-coversreq-selfcover-verify.md) 과 T-1401 이 각각 "79 행 REQ-045 의 UC 열 4 개 중 UC-05 분은 여전히 미실측" 으로 남긴 항을, **UC-05 frontmatter 8 행 `adjacentReq: [REQ-043, REQ-044, REQ-045]`** 실측으로 판정한다. REQ-045 는 UC-05 의 **coversReq 가 아니라 adjacentReq** 이므로 본 축 (`frontmatter coversReq ↔ 본문 cover`) 의 모집단에 애초에 속하지 않음을 명시하고, 따라서 **해당 dangling 항은 "미실측" 이 아니라 "본 축 대상 아님" 으로 종결** 됨을 완료 기록에 1 줄 박제한다. 다만 79 행 UC 열이 UC-05 를 **`(인접)` 표기 없이** 나열한다는 점 (77 · 78 행은 `UC-05 (인접)` 로 표기) 은 표기 비일관 **후보** 로 **기록만** 하고 정정하지 않는다 (Out of Scope — cascade 없음).
- [ ] **종합 판정 + 조치 분기** — 축 A · B · C · D · D-2 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 7 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 선언이 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (240 행) **뒤** 에 `- **2026-08-03 UC-05 coversReq 자기 cover 검증 (T-1402)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (hit 행 + 등급 분포 숫자 + range 표기 규약 포함), (2) 축 C 자기 선언 절 대조 결과 (일치 / 선언에만 / 실측에만 항 수) + `§5 step 5` ±1 부기, (3) 축 D 매트릭스 정합 + **축 D-2 의 REQ-045 dangling 항 종결** 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목의 **진행률 시점 명시** — UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (T-1400) + UC-03 (T-1401) + UC-05 (본 bullet) = **8 UC 중 7 UC · coversReq union 33 중 26 건 실측** (본 slice 신규 7 = REQ-049 ~ 055), 잔여 **7 건** (UC-01 전용 = REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) 이라 해당 축은 **축소된 채 존속** 함. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변** (123 ~ 127 행), (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-05-llm-config.md` **225 불변** (UC read-only 증명) — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 13 선언의 자기 coversReq cover 검증 · 그중 REQ-049 · 051 ~ 055 6 건의 **UC-01 선언 축** 미판정 · UC-05 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성 · 7 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` 69 행 기준 REQ-050 은 IN_PROGRESS — ADR 미박제) · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다. 추가로 **마지막 남은 UC-01 slice 의 cap 판정 근거** 를 1 줄 적는다 — 본 slice 실측으로 UC-01 13 선언 중 **union 신규는 7 건뿐** 임이 확정되므로, T-1401 Follow-up 2 가 권고한 "2 slice 분할" 의 필요 여부를 **선언 13 기준 본문 hit 수** 로 재판정할 것.

## Out of Scope

- **`docs/use-cases/UC-05-llm-config.md` 수정** — 일절 금지. 본 slice 는 UC-05 를 **read-only 모집단** 으로만 쓴다 (불변 검산 (e) 로 증명).
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지. 특히 축 D-2 가 기록만 하기로 한 **79 행 UC 열의 `UC-05` `(인접)` 표기 누락** 은 정정 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade 회피).
- **§4 106 ~ 113 행 bullet 8 줄 · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 240 행 (T-1396 ~ T-1401 분) 무수정.
- **`docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · 다른 `docs/use-cases/UC-0*.md` · `src/` · `web/` 수정** — 전부 read-only.
- **7 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 특히 REQ-050 의 IN_PROGRESS 사유 (P4 ADR 미박제) 를 재실측하거나 ADR 을 신설하지 않는다. 본 slice 는 **UC 문서 내부의 frontmatter ↔ 본문 정합** 만 본다.
- **`§5 step N` 표기 편차의 실제 정정** — T-1400 (UC-06 164 행 · UC-07 170 행) · T-1401 (UC-03 177 ~ 183 행) 과 동일하게 UC read-only 라 본 slice 도 무수정. UC-05 201 ~ 207 행에서 같은 편차가 발견돼도 기록만 한다.
- **UC-01 의 동일 검증 · `adjacentReq` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (Follow-up 소관).

## Suggested Sub-agents

`implementer` (grep 4 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## 결과 요약 (2026-08-03 DONE)

**계수 규약** — UC-05 선언은 **7 (REQ-049 ~ REQ-055)** 이고 T-1398 ~ T-1401 어느 slice 도 실측한 적이 없어 **union 신규 7 · 중복 차감 0**. 다만 그중 **6 (REQ-049 · 051 · 052 · 053 · 054 · 055) 은 UC-01 coversReq 13 에도 동시 소속** 이라 **UC-01 선언 축으로는 잔여 미판정** 이다. 이하 집계는 "선언 7" · "union 신규 7" · "UC-01 축 잔여 6" 을 구분해 쓴다.

**축 A — ID 직접 언급 실측** (`grep -n "REQ-049\|REQ-050\|REQ-051\|REQ-052\|REQ-053\|REQ-054\|REQ-055" docs/use-cases/UC-05-llm-config.md` 1 회). 절 귀속은 Required Reading 의 절 경계 실측값 기준. **range 표기 규약 (본 slice 최초 등장)**: `REQ-051~055` 형태 hit 는 5 선언 각각에 계상하고 `range` 병기. `### ` 제목 줄 안의 ID 는 본문 hit 으로 계상하고 `제목` 병기.

| 선언 | 본문 hit (행 · 절) | 메타 hit | 축 B 등급 | 축 C 판정 |
| --- | --- | --- | --- | --- |
| REQ-049 | §1 19 / §2 27 / §3 37 · 38 · 39 / §5 72 (Note over) / §7.3 137 (제목) / §9 183 · 184 · 186 — **10** | fm 7 / §10 표 201 / Refs 225 | **강** (§5 72) | 선언 6 항 전건 일치 (§6.1 은 위임 문장), 실측에만 §2 27 |
| REQ-050 | §1 19 / §3 40 / §4 51 / §5 72 (Note over) / §6.2 108 (제목) · 115 / §7.3 137 (제목) · 145 / §7.6 158 (제목) · 163 / §9 183 · 184 · 186 — **14** | fm 7 / §10 표 202 / Refs 225 | **강** (§5 72 · §6.2) | 선언 8 항 전건 일치 (§8 은 위임 문장), 실측에만 §4 51 |
| REQ-051 | §1 19 / §3 37 (range) / §5 72 (range) / §6.1 96 (제목 range) · 100 / §7.3 137 (제목 range) · 141 (range) / §9 184 (range) — **8** | fm 7 / §10 표 203 / Refs 225 | **강** (§5 · §6.1) | 선언 6 항 전건 일치 |
| REQ-052 | 위와 동형, §6.1 direct 는 101 — **8** | fm 7 / §10 표 204 / Refs 225 | **강** | 선언 6 항 전건 일치 |
| REQ-053 | 위와 동형, §6.1 direct 는 102 — **8** | fm 7 / §10 표 205 / Refs 225 | **강** | 선언 6 항 전건 일치 |
| REQ-054 | 위와 동형, §6.1 direct 는 103 — **8** | fm 7 / §10 표 206 / Refs 225 | **강** | 선언 6 항 전건 일치 |
| REQ-055 | 위와 동형, §6.1 direct 는 104 — **8** | fm 7 / §10 표 207 / Refs 225 | **강** | 선언 6 항 전건 일치 |

본문 hit 합 **64 건**, 메타 hit 합 **21 건** (frontmatter 7 행 7 · §10 표 201 ~ 207 행 7 · Refs 225 행 7) — T-1398 ~ T-1401 축 A 규약대로 별도 컬럼.

**축 B — 근거 강도 분포: 강 7 / 약 0 / 없음 0** (선언 7 기준, union 신규 7 기준도 동일). 7 선언 전부 §5 Main flow 72 행 payload 검증 `Note over LlmModule` 에 ID hit. §8 Postconditions (167 ~ 176 행) 은 ID hit **0** 이나 위임 문장 anchor 실재:

- REQ-050 — 172 행 `**DifficultyMapping row 갱신** — 3 난이도 슬롯의 provider+model 결정. 모든 슬롯이 활성 provider 를 참조하는 invariant 만족 (§7.6).`
- REQ-049 (API key 취급) — 171 행 `**API key 는 암호화 저장** (schema-level 강제 …)` + 174 행 `**API key 자체는 audit 에 기록 X** — 마스킹 형태로만 기록`, 짝이 되는 §6.4 123 행 `기존 provider 설정 조회 시 API key 는 **마스킹 형태** (예: sk-****abcd) 로만 WebUI 에 반환`.

**축 C — 자기 선언 절 대조** (§10 표 201 ~ 207 행 원문 기준). 선언 항 총수 **44 (6 + 8 + 6 × 5)**, `일치` **44** (그중 ID 없는 `일치 (위임 문장)` **2** — REQ-049 의 §6.1 = 100 ~ 104 행 각 provider 의 `model 식별자` 서술, REQ-050 의 §8 = 172 행), **`선언에만 있음` 0**, **`실측에만 있음` 2 항** (REQ-049 의 §2 27 행 actor 표, REQ-050 의 §4 51 행 precondition invariant 문장) — 선언이 실측보다 좁을 뿐 결함 아님.

**부기 (`§5 step 5` ±1 검산)** — 7 선언 모두 `§5 step 5` 선언. arrow 계수 규약 (§5 92 행 자기 선언 11 step · alt block arrow 포함 · `Note over` 제외; arrow 는 66 · 67 · 68 · 71 · 79 · 80 · 84 · 85 · 87 · 88 · 89 행 = **11 개, 92 행 선언과 일치**) 으로 보면 실측 hit 72 행은 **arrow 4 (71 행) 직후의 Note** 라 선언이 **1 이르다 (편차 +1, ±1 이내)**. Note over 를 계수에 포함하면 정확히 step 5 이므로 원인은 Note 계수 여부다. T-1400 · T-1401 부기와 동형으로 **기록만** (정정 Out of Scope), 절 단위 (§5) 판정에는 영향 없음.

**축 D — §3 매트릭스 근거 셀 정합 (83 ~ 89 행)** — 7 row 모두 분류 `uc-covered`, 근거 셀 전부 `UC-05 coversReq` 지목. 축 A ~ C 실측과 **어긋남 0**.

- 84 행 `| REQ-050 | Constraint | uc-covered | UC-05 (+ P4 ADR) | 3 난이도 모델 슬롯 — UC-05 coversReq, ADR 필수 |` — §6.2 115 행이 난이도 분류를 `P4 의 별도 ADR 책임 (Out of Scope)` 으로 위임한 서술과 정합 (충돌 없음).
- 83 행 `UC-05, UC-01 (cover)` · 85 ~ 89 행 `UC-05, UC-01` — UC-01 이 같은 6 건을 coversReq 로 중복 선언한 사실의 반영이라 본 slice 실측과 충돌 아님 (UC-01 축 판정은 범위 밖).
- cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 **없음**.

**축 D-2 — REQ-045 dangling 항 종결** — UC-05 frontmatter 8 행이 `adjacentReq: [REQ-043, REQ-044, REQ-045]` 이므로 **REQ-045 는 UC-05 의 coversReq 가 아니라 adjacentReq** 다. 따라서 본 축 (frontmatter `coversReq` ↔ 본문 cover) 의 **모집단에 애초에 속하지 않으며**, T-1400 · T-1401 이 남긴 "79 행 REQ-045 의 UC-05 분 미실측" dangling 항은 **"미실측" 이 아니라 "본 축 대상 아님" 으로 종결** 된다. 다만 79 행 UC 열 `UC-03, UC-05, UC-06, UC-07` 이 77 · 78 행 (`UC-05 (인접)`) 과 달리 `(인접)` 표기 없이 UC-05 를 나열하는 점은 표기 비일관 **후보로 기록만** (정정 금지 — cascade 없음).

**종합 판정 — (가) frontmatter ↔ 본문 정합 확인.** 7 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D · D-2 어긋남 0 → §10 bullet append 만, 본문 무수정.

**불변 검산** — (a) `grep -c "^| REQ-"` = **66** 불변, (b) `grep -c "^## "` = **11** 불변, (c) §5 표 count `48 / 4 / 13 / 1` + 합계 `**66** | **100 %**` 불변, (d) §4 115 행 `33 + 15 + 4 + 13 + 1 = 66` 불변, (e) `wc -l docs/use-cases/UC-05-llm-config.md` = **225** 불변 (UC read-only 증명).

**hunk 국한 검증 (R-112 대체, doc-only)** — `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` hunk 헤더 **1 개뿐**: `@@ -240,0 +241,4 @@` → §10 말미 append 1 지점, §1 ~ §9 · §11 hunk **0**. `git diff --numstat` = `4	0	docs/use-cases/REQ-COVERAGE-AUDIT.md` (삭제 **0**). `git status --porcelain` = 위 `touchesFiles` 2 개 외 변경 파일 **0**. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행 **없음** (T-1370 · T-1375 사고 재발 방지).

**한계 —**

- UC-01 13 선언의 자기 `coversReq` cover 검증 (본 slice 범위 밖).
- 그중 **REQ-049 · 051 ~ 055 6 건의 UC-01 선언 축** 은 본 slice 가 UC-05 축으로만 판정 — UC-01 축은 미판정.
- UC-05 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성.
- 7 건 REQ 의 **구현** 실재 여부 (`docs/requirements.md` 69 행 REQ-050 은 `IN_PROGRESS` — P4 ADR 미박제).
- §3 매트릭스 66 row 분류 자체의 재판정.
- **마지막 UC-01 slice 의 cap 판정 근거** — 본 slice 로 UC-01 13 선언 중 **union 신규는 7 건뿐** (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) 임이 확정됐으므로, T-1401 Follow-up 2 의 "2 slice 분할" 권고는 **선언 13 기준 본문 hit 수** 로 재판정해야 한다 (union 신규 7 만 보면 본 slice 와 동급 규모 = 단일 slice 로 충분할 가능성이 크다).

## Follow-ups

1. **UC-01 coversReq 13 선언의 자기 cover 검증 (마지막 UC)** — union 신규 7 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) + UC-01 축 잔여 6 (REQ-049 · 051 ~ 055) = 선언 13 전건. 본 slice 비용 실측 (선언 7 · 본문 hit 64 · diff +4 LOC · bash 4 회) 을 기준으로 단일 slice 가능 여부를 먼저 판정할 것. 완료 시 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8` 항이 **8 UC 전건 (union 33/33) 으로 해소**.
2. **§3 매트릭스 79 행 REQ-045 의 UC 열 `(인접)` 표기 비일관** — 77 · 78 행은 `UC-05 (인접)`, 79 행은 표기 없음. cascade 없는 표기 정정 1 줄 (본 slice 는 Out of Scope 로 기록만).
