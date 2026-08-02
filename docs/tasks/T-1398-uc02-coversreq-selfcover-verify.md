---
id: T-1398
title: UC-02 가 자기 frontmatter coversReq 4 건 (REQ-038 / 042 / 046 / 048) 을 본문 §5 · §6 · §8 로 실제 cover 하는지 3 축 실측 검증
phase: P5
status: DONE
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

- [x] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-038\|REQ-042\|REQ-046\|REQ-048" docs/use-cases/UC-02-evaluation-query.md` 를 실행해 hit 를 전건 열거하고, 4 건 × (hit 행 번호 목록 · 각 hit 가 속한 절) 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 실측값으로 판정하고, **frontmatter 7 행 · §10 관련 REQ 표 (145 ~ 160 행) · 174 행 Refs 줄의 hit 는 본문 hit 와 별도 컬럼으로 구분** 한다 ([T-1396](T-1396-uc-audit-envelope-cover-13-basis-recheck.md) · T-1397 축 A 와 동일 규약 — 표 / 메타 줄은 요약이지 flow 서술이 아님).
- [x] **축 B — 근거 강도 분류** — 축 A 의 hit 를 T-1396 · T-1397 과 **동일한 3 등급** 으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술, (약) §1 ~ §4 · §7 · §9 또는 §10 표 안의 언급만, (없음) 본문 hit 0. 4 건의 등급 분포 (강 N / 약 N / 없음 N) 를 합계로 적는다. ID 없이 의미만 서술한 위임 문장 anchor 가 있으면 인용한다.
- [x] **축 C — 자기 선언 절 대조** — UC-02 §10 표 151 ~ 154 행이 4 건 각각에 대해 선언한 근거 절 목록을 원문 그대로 옮긴 뒤, 축 A 의 실측 hit 절과 **항목별로 대조** 해 (일치 / 선언에만 있음 / 실측에만 있음) 3 분류로 판정한다. 선언 절에 ID hit 가 없더라도 **그 절에 해당 요구를 서술한 문장이 실재하면 `일치 (위임 문장)`** 으로 판정하고 그 문장을 인용한다. 4 건의 판정 결과를 표에 한 컬럼으로 적는다.
- [x] **축 D — §3 매트릭스 근거 셀 정합** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 72 · 76 · 80 · 82 행 4 row 의 분류값과 근거 셀을 원문 인용하고, 4 건 모두 `uc-covered` + 근거 셀이 `UC-02 coversReq` 를 지목함이 축 A ~ C 실측과 **어긋나지 않는지** 판정한다. 어긋나면 어긋난 항과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 기록한다 (정정 금지 — Out of Scope).
- [x] **종합 판정 + 조치 분기** — 축 A · B · C · D 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **frontmatter ↔ 본문 정합 확인** — 4 건이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남 0 일 때. → §10 bullet append 만, 본문 무수정.
  - (나) **선언과 본문이 어긋남** — 어느 REQ 가 본문 근거 0 이면서 §10 자기 선언 절에도 위임 문장이 없을 때. → **본 slice 는 아무 수치도 고치지 않는다.** 어긋난 항목과 cascade 범위만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — (가)·(나) 어느 쪽도 실측이 지지하지 않을 때. 보류 사유 그대로 기록, §10 bullet 외 무수정.
- [x] **§10 bullet append** — §10 마지막 bullet (225 행) **뒤** 에 `- **2026-08-03 UC-02 coversReq 자기 cover 검증 (T-1398)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A · B 실측 요약 (등급 분포 숫자 포함), (2) 축 C 자기 선언 절 대조 결과, (3) 축 D 매트릭스 정합 판정, (4) 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 항목이 **UC-02 범위에서만 해소** 되고 UC-01 · UC-03 ~ UC-08 7 UC 는 미실측이라 **축소된 채 존속** 함을 시점 명시. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [x] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) `wc -l docs/use-cases/UC-02-evaluation-query.md` **174 불변** (UC-02 read-only 증명) — 5 값을 완료 기록에 적는다.
- [x] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. `git diff --numstat` 이 삭제 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 셀을 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [x] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (UC-01 · UC-03 ~ UC-08 의 자기 coversReq cover 검증 · UC-02 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성 · 4 건 REQ 의 **구현** 실재 여부 · §3 매트릭스 66 row 분류 자체의 재판정) 을 열거한다.

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

## 완료 기록 (2026-08-03)

`Status: DONE`. 종합 판정 **(가) frontmatter ↔ 본문 정합 확인** — §10 bullet 3 줄 append 만 수행, 본문 · 매트릭스 · 수치 전부 무수정.

### 축 A · B — ID 직접 언급 실측 + 근거 강도

`grep -n "REQ-038\|REQ-042\|REQ-046\|REQ-048" docs/use-cases/UC-02-evaluation-query.md` 전건 (절 귀속은 Required Reading 의 절 경계 실측값 기준).

| REQ | 본문 hit (행 → 절) | 메타 hit (frontmatter / §10 표 / Refs) | 강도 |
| --- | --- | --- | --- |
| REQ-038 | 37 · 38 · 39 (§3 trigger 2 · 3 · 4) / 62 (§5 arrow 1) / 134 · 135 (§9 Web UI · Backend API row) | 7 (frontmatter) / 151 (§10 표) / 174 (Refs) | **강** (§5 62) |
| REQ-042 | 21 (§1) / 71 (§5 alt block) / 87 (§6.1 제목) / 134 (§9) | 7 / 152 / 174 | **강** (§5 71 · §6.1 87) |
| REQ-046 | 27 · 30 (§2 actor 표 + 서술) / 46 (§4 precondition 2) / 107 (§7.2 제목) / 135 (§9) | 7 / 153 / 174 | **약** (§5 · §6 · §8 ID hit 0) |
| REQ-048 | 21 (§1) / 77 (§5 arrow 8) / 93 (§6.2) / 126 (§8 NFR 충족) / 136 (§9) | 7 / 154 / 174 | **강** (§5 77 · §6.2 93 · §8 126) |

- **등급 분포 — 강 3 / 약 1 / 없음 0** (본문 hit 0 인 REQ 없음). 메타 hit 는 4 건 모두 3 개씩으로 동일 (frontmatter 7 행 · §10 표 1 행 · 174 행 Refs) — 본문 hit 와 별도 계상했다.
- REQ-046 (약) 의 위임 문장 anchor 는 ID 없이 실재한다: §5 65 행 Note `미인증/권한부족 시<br/>§7.1·§7.2 분기`, §8 121 행 `본 UC 는 **read-only operation** 이므로 평가 데이터의 상태 변경은 없다`, §8 123 행 `AssessmentRun / 평가 결과 row 의 read 만 발생. PersistenceModule 의 write 없음`. 즉 "User read-only" 요구의 실체는 §5 · §8 에 서술돼 있고 ID 표기만 §2 · §7.2 · §9 에 몰려 있다.

### 축 C — 자기 선언 절 대조 (UC-02 §10 표 151 ~ 154 행 원문)

| REQ | 선언 근거 절 (원문) | 대조 판정 |
| --- | --- | --- |
| REQ-038 | `§3 trigger 1–4 / §5 step 1–2, 8 / §6.2, §6.3 / §9 WebUI + Backend API` | 선언 5 항 전건 **일치** — §3 · §5 · §9 는 ID hit, §6.2 · §6.3 은 **일치 (위임 문장)** (93 행 `server-side sort/filter 를 default 로 명시`, 95 ~ 97 행 `window 파라미터 값만 daily / weekly / monthly 로 다름`) |
| REQ-042 | `§5 alt block / §6.1 / §8 postcondition` | 선언 3 항 전건 **일치** — §5 71 행 alt block · §6.1 87 행 은 ID hit, §8 은 **일치 (위임 문장)** (124 행 `평가 진행 중인 경우 (§6.1) 상단에 경고 배너`) |
| REQ-046 | `§2 actor / §7.2 / §9 AuthModule` | 선언 3 항 전건 **일치** (27 · 30 / 107 / 135 모두 ID hit) |
| REQ-048 | `§5 step 9 / §8 postcondition` | 선언 2 항 전건 **일치** (77 / 126 ID hit) |

- `선언에만 있음` **0 항**. `실측에만 있음` **6 항** — REQ-042 의 §1 (21) · §9 (134), REQ-046 의 §4 (46), REQ-048 의 §1 (21) · §6.2 (93) · §9 (136). 선언이 실측보다 좁은 방향이라 "선언한 곳에 근거가 없다" 유형의 결함은 아니다.
- 부기: REQ-048 선언의 `§5 step 9` 는 §5 83 행 규약 (arrow 만 계수, `Note over` 제외) 으로 세면 77 행이 step **8** 이다. Note 계수 차 ±1 이며 절 단위 판정에는 영향 없어 어긋남으로 계상하지 않았다 (§10 bullet 에도 부기로만 박제).

### 축 D — §3 매트릭스 근거 셀 정합 (원문 인용)

```
72: | REQ-038 | FR  | uc-covered | UC-02, UC-06 (인접), UC-07 (인접) | UI 조회 / sort / filter / 시계열 — UC-02 coversReq |
76: | REQ-042 | FR  | uc-covered | UC-02 | 평가 진행 중 시각화 보호 (경고 배너) — UC-02 coversReq |
80: | REQ-046 | FR  | uc-covered | UC-02, UC-04 (인접), UC-08 (인접) | User read-only — UC-02 coversReq |
82: | REQ-048 | NFR | uc-covered | UC-02 + [deployment.md](../architecture/deployment.md) | 조회·시각화 3 초 이내 — UC-02 coversReq + perf test |
```

4 row 모두 분류값 `uc-covered` + 근거 셀이 `UC-02 coversReq` 를 지목하며, 축 A 가 4 건 전건에 본문 hit ≥ 4 를 확인하고 축 B · C 가 §5 / §6 / §8 근거 (ID 또는 위임 문장) 를 확인했으므로 **어긋남 0 건**. cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 기록 대상 없음.

### 불변 검산 (편집 전후 동일)

| 항 | 값 | 판정 |
| --- | --- | --- |
| (a) `grep -c "^| REQ-" REQ-COVERAGE-AUDIT.md` | 66 → 66 | 불변 |
| (b) `grep -c "^## " REQ-COVERAGE-AUDIT.md` | 11 → 11 | 불변 (새 `##` 절 0) |
| (c) §5 count 4 값 + 합계 row | `48 / 4 / 13 / 1` · `\| **합** \| **66** \| **100 %** \|` (127 행) | 불변 |
| (d) §4 115 행 정합식 | `33 + 15 + 4 + 13 + 1 = 66` | 불변 |
| (e) `wc -l UC-02-evaluation-query.md` | 174 → 174 | 불변 (UC-02 read-only 증명) |

### hunk 국한 검증 (R-112 대체, doc-only)

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -225,0 +226,3 @@ REQ 의 cover 방식을 다음 4 enum 으로 분류:

$ git diff --numstat
3	0	docs/use-cases/REQ-COVERAGE-AUDIT.md

$ git status --porcelain
 M docs/use-cases/REQ-COVERAGE-AUDIT.md
```

- hunk 는 **§10 말미 append 1 지점 (226 ~ 228 행)** 뿐이고 §1 ~ §9 · §11 에 hunk **0**. 삭제 라인 **0** (`3\t0`) 이라 기존 25 줄 · 227 행 `## 11. References` 무수정이 증명된다.
- `git status --porcelain` 은 audit 파일 1 개 + (본 완료 기록 반영 후) task 파일 1 개, 즉 `touchesFiles` 2 개 외 변경 파일 **0**.
- 본 slice 는 표 셀을 한 곳도 편집하지 않았으므로 `|` 개수 대조 대상 행이 **없다** (T-1370 · T-1375 사고 유형 비해당).

### 한계 —

- **UC-01 (coversReq 13 건) · UC-03 ~ UC-08 (7 UC) 의 자기 coversReq cover 검증** 은 미실측 — 212 행 축은 UC-02 범위에서만 해소되고 축소된 채 존속한다.
- **UC-02 `adjacentReq` 3 건 (REQ-043 / 044 / 045) 의 인접 서술 정확성** 은 판정하지 않았다 (adjacent 축 실측은 UC-01 / T-1395 뿐).
- **4 건 REQ 의 구현 실재 여부** (`docs/requirements.md` status — REQ-048 은 IN_PROGRESS) 는 본 slice 대상이 아니다. 본 slice 는 UC-02 문서 내부의 frontmatter ↔ 본문 정합만 본다.
- **§3 매트릭스 66 row 분류 자체의 재판정** 은 수행하지 않았다 (212 행 마지막 잔여 축).
- 축 B 의 3 등급은 T-1396 · T-1397 과 동일한 **절 위치 기반** 휴리스틱이며, 서술의 의미적 충분성 (예: REQ-038 의 "지표별 sort" 세부 항목이 §5 에서 완전한지) 까지 판정하지 않는다.
