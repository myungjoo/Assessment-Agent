---
id: T-1397
title: REQ-COVERAGE-AUDIT §4 UC-02 envelope-cover 3 건의 본문 서술 근거 + 이중계상 여부를 3 축 실측으로 재판정
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1396]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1397-uc02-envelope-cover-basis-rejudge.md
plannerNote: "uc-doc-audit-resync 9 번째 slice — envelope-cover label 은 UC-01·UC-02 2 곳뿐이라 UC-02 3 건 실측으로 212 행 축이 닫힌다, 분류 변경 Out of Scope, doc-only direct"
---

# T-1397 — REQ-COVERAGE-AUDIT §4 UC-02 envelope-cover 3 건의 본문 서술 근거 + 이중계상 여부를 3 축 실측으로 재판정

## Why

[T-1396](T-1396-uc-audit-envelope-cover-13-basis-recheck.md) 이 §4 106 행 UC-01 의 envelope-cover 13 건을 2 축 실측해 판정 **(가) 유지** 로 닫았고, 그 Follow-up 1 은 "다른 7 UC 의 envelope-cover 나열" 로 확장하라고 남겼다. planner 가 `grep -n "envelope-cover" docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 사전 실측한 결과 **envelope-cover label 을 단 bullet 은 106 행 (UC-01) 과 107 행 (UC-02) 둘뿐** 이며 UC-03 ~ UC-08 bullet 6 줄에는 아예 없다. 따라서 본 slice 가 UC-02 의 3 건 (REQ-003 표시 · REQ-013 / 020 의 비교 view) 을 같은 방법론으로 실측하면 §10 212 행 "미검증 축" 의 `envelope-cover 판정의 의미적 타당성` 축이 **전량 해소** 된다 (T-1396 이 "축소된 채 존속" 으로 남긴 잔여분). 추가로 UC-02 의 3 건은 §3 매트릭스에서 REQ-003 = `cross-cutting`, REQ-013 · REQ-020 = `uc-covered` (이미 UC-01 envelope 13 에 포함) 이라, 이 3 건이 §5 통계의 envelope 잔차 15 에 **이중계상되지 않았는지** 를 함께 확인해야 판정이 완결된다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 106 ~ 113 행 — §4 UC 별 bullet 8 줄. 본 slice 의 축 0 (envelope-cover label 전수) 모집단이자 **read-only** (T-1393 축 B 가 union 33 정확성을 실측 완료).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 37 · 47 · 54 행 — §3 매트릭스의 REQ-003 (`cross-cutting`) · REQ-013 (`uc-covered`) · REQ-020 (`uc-covered`) row. 축 C 이중계상 판정의 기준. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 115 행 · 121 ~ 123 행 — envelope 잔차 15 정합식 (T-1394 정정분) 과 §5 통계표. 축 C 의 대조 대상. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 221 행 — §10 dated 절 (마지막 bullet = 221 행, T-1396 분). 본 slice 는 **221 행 뒤에 bullet 을 append** 한다. 기존 22 줄 무수정, 223 행 `## 11. References` 무수정.
- `docs/use-cases/UC-02-evaluation-query.md` — 절 경계 실측값: 17(§1) · 23(§2) · 32(§3) · 41(§4) · 50(§5) · 85(§6) · 99(§7) · 119(§8) · 128(§9) · 145(§10) · 161(§11), 총 174 행. frontmatter `coversReq` 7 행 · `adjacentReq` 8 행. 본문 서술 근거 실측 대상, **read-only**.
- `docs/requirements.md` 의 REQ-003 · REQ-013 · REQ-020 row — 3 건의 원문 요구 문장 (의미적 판정 기준). **read-only**.

## Acceptance Criteria

- [x] **축 0 — envelope-cover label 전수 확인** — `grep -n "envelope-cover" docs/use-cases/REQ-COVERAGE-AUDIT.md` 를 실행해 hit 행 번호를 전건 열거하고, §4 bullet 8 줄 (106 ~ 113 행) 중 label 을 단 bullet 이 **106 (UC-01) · 107 (UC-02) 2 줄뿐** 이며 UC-03 ~ UC-08 은 **0** 임을 확인해 완료 기록에 박제한다. 이 사실이 "본 slice 로 envelope-cover 축이 닫힌다" 의 근거다. (설령 실측이 planner 사전값과 다르면 그 사실을 그대로 적고 잔여 UC 를 Follow-up 으로 남긴다.)
- [x] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-003\|REQ-013\|REQ-020" docs/use-cases/UC-02-evaluation-query.md` 를 실행해 hit 를 전건 열거하고, 3 건 × (hit 행 번호 목록 · 각 hit 가 속한 절 · `없음`) 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **§10 관련 REQ 표 (145 ~ 160 행) 안의 hit 는 별도 컬럼으로 구분** 한다 (표는 요약이지 flow 서술이 아님 — T-1396 축 A 와 동일 규약).
- [x] **축 B — 서술 근거 강도 분류** — 축 A 의 hit 를 T-1396 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §9 Component mapping 또는 §10 관련 REQ 표 안의 언급만, (없음) hit 0. 3 건의 등급 분포 (강 N / 약 N / 없음 N) 를 합계로 적는다. ID 없이 의미만 서술된 위임 문장 anchor (예: 표시 / 비교 view 관련 문장) 가 있으면 근거로 인용한다.
- [x] **축 C — 이중계상 여부 판정** — §3 매트릭스 37 · 47 · 54 행 실측값 (REQ-003 = `cross-cutting`, REQ-013 · REQ-020 = `uc-covered`) 과 §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` · §5 121 ~ 123 행 통계를 대조해, UC-02 bullet 의 envelope-cover 3 건이 envelope 잔차 **15** 에 **추가로 더해지지 않았음** (REQ-013 · 020 은 이미 UC-01 envelope 13 에 포함되어 1 회만 계상, REQ-003 은 cross-cutting 4 에 계상되어 envelope 밖) 을 확인하고 판정을 완료 기록에 적는다. 어긋나면 어긋난 항과 cascade 범위만 기록한다 (정정 금지 — Out of Scope).
- [x] **종합 판정 + 조치 분기** — 축 0 · A · B · C 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **envelope 선언 유지** — 개별 ID 미등장이 121 ~ 123 행의 envelope 정의 (`UC envelope 내부 algorithmic / data-model cover`) 와 정합하고 축 C 이중계상 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문·통계가 어긋남** — 축 B 가 근거 0 이면서 축 C 가 이중계상 또는 누락을 드러낼 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [x] **§10 bullet append** — §10 마지막 bullet (221 행) **뒤** 에 `- **2026-08-02 UC-02 envelope-cover 근거 재판정 (T-1397)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 0 결과 (label 보유 bullet 수), (2) 축 A · B 실측 요약 (등급 분포 숫자 포함), (3) 축 C 이중계상 판정, (4) 212 행 "미검증 축" 의 `envelope-cover 판정의 의미적 타당성` 항목이 **UC-01 (T-1396) + UC-02 (본 slice) 로 전량 해소** 됐는지 여부와 나머지 2 축 (UC 본문 frontmatter 대비 전수 검증 · 66 row 분류 재판정) 의 존속을 시점 명시. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [x] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) 107 행 bullet 의 envelope-cover 나열이 **`REQ-003 (표시), REQ-013 / 020 의 비교 view` 그대로** — 5 값을 완료 기록에 적는다.
- [x] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임도 함께 적어 기존 행 수정 0 을 이중 확인한다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [x] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-03 ~ UC-08 의 `adjacent` 나열 정확성 · §3 매트릭스 66 row 분류 자체의 재판정 · 3 건 REQ 의 **구현** 실재 여부 · UC-02 본문이 자기 `coversReq` 4 건을 실제로 cover 하는지) 을 열거한다.

## Out of Scope

- **§4 106 ~ 113 행 bullet 8 줄 수정** — 금지 (T-1393 축 B union 33 실측 기반 보존). 판정이 (나) 로 나와도 기록만 한다.
- **§3 매트릭스 어떤 row 의 분류값 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행 cascade).
- **§4 115 행 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote (T-1395 확정) · 218 ~ 221 행 (T-1396 분) 무수정.
- **`docs/use-cases/UC-0*.md` · `docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `src/` 수정** — 전부 read-only.
- **3 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` status 판정 (T-1375 계열 소관) 은 본 slice 대상이 아니다. 본 slice 는 **UC-02 본문 서술 근거 + 통계 이중계상** 만 본다.
- **UC-03 ~ UC-08 의 `adjacent` 나열 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지.

## Suggested Sub-agents

`implementer` (grep 3 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **UC-02 본문의 자기 `coversReq` 4 건 (REQ-038 / 042 / 046 / 048) 전수 cover 검증** — 본 slice 는 envelope-cover 3 건만 봤다. 212 행 잔여 축 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 의 UC-02 slice.
- **UC-03 ~ UC-08 의 `adjacent` 나열 정확성 실측** — envelope-cover 축은 본 slice 로 닫혔으나 `adjacent` 나열은 UC-01 (T-1395) 만 실측됐고 나머지 7 UC 는 미실측.

## 완료 기록 (2026-08-02, T-1397)

### 축 0 — envelope-cover label 전수 확인

`grep -n "envelope-cover" docs/use-cases/REQ-COVERAGE-AUDIT.md` hit **7 건**: 106 · 107 · 117 · 212 · 217 · 218 · 221 행.

| 행 | 위치 | label 성격 |
| --- | --- | --- |
| 106 | §4 UC-01 bullet | **나열 label** (envelope-cover 13 건) |
| 107 | §4 UC-02 bullet | **나열 label** (envelope-cover 3 건) |
| 117 | §4 blockquote | 서술 언급 (T-1395 확정분) |
| 212 · 217 · 218 · 221 | §10 dated bullet | 서술 언급 (미검증 축 / T-1396 분) |

§4 bullet 8 줄 (106 ~ 113 행) 중 label 보유 bullet 은 **106 (UC-01) · 107 (UC-02) 2 줄뿐**, UC-03 ~ UC-08 6 줄 (108 ~ 113 행) 은 **0** — planner 사전값과 **일치**. 따라서 UC-01 (T-1396) + UC-02 (본 slice) 로 envelope-cover 나열 모집단이 전량 실측되어 212 행 축이 닫힌다. 잔여 UC Follow-up 불요.

### 축 A · B — ID 직접 언급 실측 + 서술 근거 강도

`grep -n "REQ-003\|REQ-013\|REQ-020" docs/use-cases/UC-02-evaluation-query.md` → 출력 **없음** (3 건 각각 `grep -c` 도 전부 **0**). 절 경계 판정값: 17(§1) · 23(§2) · 32(§3) · 41(§4) · 50(§5) · 85(§6) · 99(§7) · 119(§8) · 128(§9) · 145(§10) · 161(§11), 총 174 행.

| REQ | 107 행 bullet 의 근거 서술 | 본문 hit 행 (§1 ~ §9) | §10 관련 REQ 표 (145 ~ 160 행) hit | 등급 |
| --- | --- | --- | --- | --- |
| REQ-003 | 표시 | 없음 | 없음 | (없음) |
| REQ-013 | 비교 view | 없음 | 없음 | (없음) |
| REQ-020 | 비교 view | 없음 | 없음 | (없음) |

등급 분포 **강 0 / 약 0 / 없음 3** (강 = §5 Main flow · §6 Alternative flows · §8 Postconditions, 약 = §9 Component mapping 또는 §10 표). §10 표가 0 인 이유는 그 표가 primary 4 (REQ-038 / 042 / 046 / 048) + 인접 3 (REQ-043 / 044 / 045) 만 싣기 때문 — UC-01 (T-1396 축 A) 과 동일 구조.

ID 없는 **위임 문장 anchor** 는 실재한다:

- REQ-003 (표시 축) — §8 124 행 `- **사용자 화면** — Web UI 에 평가 결과 표 + 시계열 차트 표시. 평가 진행 중인 경우 (§6.1) 상단에 경고 배너.`, §9 138 행 Web UI row `평가 결과 페이지 SPA — 표 / 시계열 차트 / sort·filter·window 컨트롤 + 경고 배너`, §5 80 행 `WebUI->>User: 표·차트 표시`.
- REQ-013 / REQ-020 (저성과자 · 조직 기여 큰 인원의 비교 view) — §6.2 95 행 `본 UC 는 **server-side sort/filter 를 default 로 명시**`, §6.3 97 행 시계열 grouping window 재집계, §3 39 행 시계열 단위 변경. 즉 "비교 view" 는 sort / filter / 시계열이라는 **일반 조회 기능** 으로만 서술되고 저성과자 · 상위 기여자 랭킹 view 자체를 지목한 문장은 없다 (`저성과` · `랭킹` 문자열 hit 0).

### 축 C — 이중계상 여부 판정: **이중계상 0**

- §3 매트릭스 실측: 37 행 `| REQ-003 | FR | cross-cutting | UC-01 (생성) + UC-02 (표시) | …`, 47 행 `| REQ-013 | FR | uc-covered | UC-01 (P5 알고리즘) | … (UC-02 표시) |`, 54 행 `| REQ-020 | FR | uc-covered | UC-01 (P5 알고리즘) | … (UC-02 표시) |` — 3 건 모두 **UC-02 를 근거 셀에 이미 반영** 한 채 분류값은 row 당 1 개다.
- envelope 잔차 **15** 는 `uc-covered 48 − frontmatter union 33` 의 차집합이라 정의상 중복 계상이 불가능하다. 그 실 집합 (§10 205 행, T-1393 축 A' 실측) 은 REQ-009 ~ 013 / 018 ~ 022 / 031 / 033 ~ 036 (5 + 5 + 5 = 15) 으로 **REQ-013 · REQ-020 을 이미 1 회씩 포함** 한다 — UC-01 envelope 13 경유 계상분이며 UC-02 bullet 이 추가 계상을 만들지 않았다.
- REQ-003 은 `cross-cutting` 이라 envelope 15 밖이고 §5 122 행 `cross-cutting | 4` 의 비고 셀에 명시적으로 열거된다 (REQ-002 / 003 / 029 / 047).
- 대조 결과 §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` 과 §5 121 ~ 124 행 count `48 / 4 / 13 / 1` · 합계 `**66** | **100 %**` 가 **어긋남 0** 으로 성립. 정정 대상 없음.

### 종합 판정 — **(가) envelope 선언 유지**

121 ~ 123 행이 envelope 을 `UC envelope 내부 algorithmic / data-model cover` 로 정의하므로 개별 ID 미등장 (축 B 등급 "없음 3") 은 선언 위반이 아니라 정의 그대로이고, 축 C 가 이중계상 0 을 확인했다. UC-02 의 3 건은 UC-02 `coversReq` 가 아니라 bullet 안의 별도 label 이라 104 행 선언 (frontmatter + 본문 §5 / §6 / §8 실 cover 가 정답) 과도 충돌하지 않는다. → §10 bullet append 만, §4 106 ~ 113 행 · §3 매트릭스 · 115 행 정합식 · §5 표 전부 **무수정**.

### 불변 검산 (편집 후 실측 5 값)

- (a) `grep -c "^| REQ-"` = **66** (불변)
- (b) `grep -c "^## "` = **11** (불변)
- (c) §5 count 4 값 = `48 / 4 / 13 / 1`, 합계 row = `**66** | **100 %**` (불변)
- (d) §4 115 행 정합식 = `33 + 15 + 4 + 13 + 1 = 66` (불변)
- (e) 107 행 bullet = `envelope-cover: REQ-003 (표시), REQ-013 / 020 의 비교 view.` 그대로 (불변)

### hunk 국한 검증 (R-112 대체, doc-only)

- `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` hunk 헤더: `@@ -221,0 +222,4 @@` — **1 지점뿐** 이며 §10 말미 (221 행 뒤) append. §1 ~ §9 · §11 hunk **0**, 223 행이던 `## 11. References` 는 227 행으로 밀렸을 뿐 내용 무수정.
- `git diff --numstat` = `4	0	docs/use-cases/REQ-COVERAGE-AUDIT.md` — **삭제 0** 이므로 기존 행 수정 0 이 이중 확인된다.
- 표 셀을 한 곳도 편집하지 않았으므로 `|` 개수 대조 대상 행이 **없다** (T-1370 · T-1375 사고 유형 비해당).

### 한계 —

- UC-03 ~ UC-08 의 `adjacent` 나열 정확성은 판정하지 않았다 (UC-01 만 T-1395 로 실측됨).
- §3 매트릭스 66 row 의 **분류값 자체** 재판정은 하지 않았다 — 본 slice 는 기존 분류를 anchor 로 삼아 이중계상만 대조했다.
- REQ-003 · REQ-013 · REQ-020 의 **구현 실재 여부** (`docs/requirements.md` status) 는 보지 않았다 (T-1375 계열 소관).
- UC-02 본문이 자기 `coversReq` 4 건 (REQ-038 / 042 / 046 / 048) 을 실제로 cover 하는지는 실측하지 않았다 (212 행 잔여 축, 위 Follow-up 1).
- 축 A 는 **ID 문자열 기계 대조** 라, 의미상 cover 하되 다른 표현으로 서술한 경우는 위임 문장 anchor 로만 정성 판정했다.
