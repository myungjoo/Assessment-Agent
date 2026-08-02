---
id: T-1404
title: REQ-COVERAGE-AUDIT 212 행 "미검증 축" 문장을 해소 현황 (5 축 중 4 해소 · 잔여 1) 으로 1 행 → 1 행 in-place 갱신
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1403]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1404-req-coverage-audit-unverified-axes-line-refresh.md
plannerNote: "uc-doc-audit-resync 16 번째 slice — T-1403 Follow-up 1 (212 행 stale 문장 갱신), 줄 수 불변 1 행 교체로 후속 8 참조 보호, doc-only direct"
---

# T-1404 — REQ-COVERAGE-AUDIT 212 행 "미검증 축" 문장의 해소 현황 in-place 갱신

## Why

[T-1403](T-1403-uc01-coversreq-selfcover-verify.md) 이 `UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지` 축을 **8 UC 전건 · coversReq union 33/33** 으로 해소하면서, `docs/use-cases/REQ-COVERAGE-AUDIT.md` **212 행 ("미검증 축")** 이 열거한 5 축 중 **4 축이 해소**됐다 — 수치 오차 3 건 정정 (T-1394 · 213 행), `adjacent` 서술 정확성 (T-1395 · 217 행), envelope-cover 의미적 타당성 (T-1396 · T-1397 · 221 · 225 행), UC 본문 cover 전수 검증 (T-1398 ~ T-1403 · 228 ~ 249 행). 그럼에도 212 행 본문은 **T-1393 시점 그대로** 라 지금 읽으면 이미 닫힌 4 축을 미검증으로 오독하게 만든다. T-1398 ~ T-1403 6 slice 가 append-only 규약을 지키려 일관되게 Follow-up 으로 미뤄 둔 항목이며, T-1403 Follow-up 1 번이 본 slice 다.

본 slice 의 핵심 제약은 **줄 수 불변**이다. 217 · 221 · 225 · 228 · 232 · 236 · 240 · 244 · 249 행 9 개 bullet 이 `212 행 "미검증 축"` 이라는 **행 번호로** 본 문장을 참조하므로, 삽입 / 삭제 없이 **212 행 1 줄을 1 줄로 교체** 해야 그 참조가 전부 유효하게 유지된다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 212 행 — 교체 대상 원문 1 줄. 현행 열거 5 축 = (1) envelope-cover 판정의 **의미적** 타당성, (2) `adjacent` 서술의 정확성 (REQ-031 · REQ-034 귀속 포함), (3) UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지, (4) §3 매트릭스 66 row 분류 자체의 재판정, (5) 위 수치 오차 3 건의 실제 정정. **순서와 문구를 식별 가능하게 보존해야 한다** (후속 bullet 들이 각 축을 문구로 인용).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 · 211 · 213 · 214 행 — §10 blockquote (`본 절은 T-1393 이 …`) 와 직전 종합 판정 bullet, 직후 T-1394 정정 반영 bullet. 교체 문장의 **시점 표기 규약** (T-1393 시점 서술 + 이후 갱신을 명시하는 방식) 을 여기서 그대로 따온다. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 217 · 221 · 225 행 — 축 (2) · (1) 의 해소 선언 bullet (T-1395 / T-1396 / T-1397). 교체 문장에 달 해소 pointer 의 근거. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 228 · 232 · 236 · 240 · 244 · 249 행 — 축 (3) 의 UC 별 해소 bullet (T-1398 · T-1399 · T-1400 · T-1401 · T-1402 · T-1403). 특히 249 행이 `8 UC 전건 · union 33/33 해소` 와 `잔여 축 = §3 매트릭스 66 row 분류 재판정` 을 확정한 문장이다. **read-only**.
- `docs/tasks/T-1403-uc01-coversreq-selfcover-verify.md` Follow-ups 1 번 — 본 slice 의 발주 근거 (`212 행 열거에서 해당 항을 제거하는 편집 … §10 중간 hunk 1 지점만 여는 형태로`). **read-only**.

## Acceptance Criteria

- [x] **교체 방식 확정 (선행 항목)** — 212 행을 **정확히 1 줄로 교체** 한다 (삭제 1 · 추가 1). 줄 삽입 · 줄 분할 · 새 bullet append · 새 `##` 절 신설은 **전부 금지** — 후속 9 개 bullet (217 · 221 · 225 · 228 · 232 · 236 · 240 · 244 · 249 행) 이 `212 행` 이라는 행 번호로 본 문장을 참조하기 때문이다. 이 제약과 그 근거를 완료 기록 첫머리에 2 줄 이내로 박제한다.
- [x] **교체 문장 요건 — 5 축 보존** — 새 문장은 원 열거 **5 축을 같은 순서 · 식별 가능한 문구로 보존** 한다 (축을 지우거나 병합하지 않는다). 후속 bullet 들이 `envelope-cover 판정의 의미적 타당성` · `adjacent 서술의 정확성` · `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` · `§3 매트릭스 66 row 분류 자체의 재판정` 을 **문구로 인용** 하고 있으므로, 이 4 문구는 축약하더라도 검색 가능한 형태를 유지해야 한다. 완료 기록에 새 문장 전문을 인용한다.
- [x] **교체 문장 요건 — 축별 해소 pointer 병기** — 각 축 뒤에 해소 여부와 근거 행 / task 를 병기한다: (1) envelope-cover 의미적 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), (2) `adjacent` 서술 정확성 → **해소** (217 행 T-1395), (3) UC 본문 cover 전수 검증 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · union 33/33), (4) §3 매트릭스 66 row 분류 재판정 → **미해소 (유일 잔여 축)**, (5) 수치 오차 3 건 정정 → **해소** (213 행 T-1394). 각 pointer 의 행 번호 · task ID 가 실제 파일과 일치하는지 `grep -n` 1 회로 확인하고 그 출력 요약을 완료 기록에 남긴다.
- [x] **교체 문장 요건 — 시점 표기** — 원 열거가 **T-1393 시점 서술** 이었음을 문장 안에 남기고, 해소 표기가 **2026-08-03 (T-1404) 갱신분** 임을 명시한다 (214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형). 이로써 §10 이 "작성 당시 기록 + 이후 갱신" 이라는 본 문서의 서술 규약을 깨지 않음을 보인다.
- [x] **줄 수 · 참조 불변 검산** — 편집 전후로 (a) `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` **264 불변**, (b) `grep -c "212 행" docs/use-cases/REQ-COVERAGE-AUDIT.md` **9 불변** (212 행 자신은 그 문자열을 포함하지 않으므로 새 문장에도 넣지 않는다), (c) `grep -n "미검증 축" docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 첫 hit 가 여전히 **212** 이고 총 hit **10 불변**, (d) `grep -c "^| REQ-" …` **66 불변**, (e) `grep -c "^## " …` **11 불변**, (f) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` (123 ~ 127 행) 불변, (g) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` 불변 — **7 값을 완료 기록에 적는다**.
- [x] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더를 박제해, hunk 가 **`@@ -212 +212 @@` 1 개뿐** 이고 §1 ~ §9 · §11 및 §10 의 다른 행에 hunk **0** 임을 보인다. `git diff --numstat` 이 **`1 1`** (추가 1 · 삭제 1) 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 212 행은 표 row 가 아니므로 `|` 필드 수 대조 대상이 아님을 1 줄 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [x] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 하지 않은 것을 열거한다: (1) 유일 잔여 축인 **§3 매트릭스 66 row 분류 자체의 재판정** 은 미착수 (cascade 설계가 선행돼야 함 — §5 count · §4 정합식 · INDEX 110 행 · PLAN 36 행), (2) §3 83 행 `(cover)` 표기 비일관 · UC §10 표 `§5 step N` ±1 편차 등 T-1398 ~ T-1403 이 **기록만** 한 표기 후보들의 정정, (3) `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 요약 문구의 동기화, (4) 66 REQ 의 구현 실재 여부 (`docs/requirements.md` status — T-1375 계열 소관).

## Out of Scope

- **212 행 외 어떤 행의 수정** — §1 ~ §9 · §11 전부, §10 의 200 ~ 211 · 213 ~ 250 행 전부 **금지**. 특히 §10 말미 bullet append 도 **금지** (본 slice 는 append-only 규약의 예외로 in-place 1 행 교체만 수행하며, 두 방식을 섞으면 hunk 가 2 지점으로 늘어 줄 수 불변이 깨진다).
- **줄 수 변화를 일으키는 모든 편집** — 줄 삽입 · 삭제 · 분할 · 병합 금지. 264 행 불변이 본 slice 의 1 급 invariant 다.
- **§3 매트릭스 어떤 row 의 분류값 · 근거 셀 변경** — 일절 금지. 잔여 축 (66 row 분류 재판정) 은 본 slice 가 **문장으로 지목만** 하고 판정하지 않는다.
- **§4 106 ~ 113 행 bullet · 115 행 정합식 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1393 실측 · T-1394 정정분 보존).
- **`docs/use-cases/UC-0*.md` · `docs/use-cases/INDEX.md` · `docs/requirements.md` · `docs/PLAN.md` · `src/` · `web/` 수정** — 전부 read-only. INDEX 110 행 · PLAN 36 행 동기화는 Follow-up 소관.
- **새 dated 절 (§12) 신설 · References 번호 변경** — 금지.
- **T-1398 ~ T-1403 이 기록만 한 표기 후보의 정정** (§3 83 행 `(cover)` · UC §10 표 `§5 step N` 편차) — 금지, 별도 slice 소관.

## Suggested Sub-agents

`implementer` (212 행 1 행 교체 + pointer 행 번호 grep 확인 + 불변 7 값 검산) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **§3 매트릭스 66 row 분류 자체의 재판정** — 212 행이 지목하는 **유일 잔여 축**. cascade (§5 count 4 값 · §4 115 행 정합식 · INDEX 110 행 · PLAN 36 행) 설계가 선행돼야 하므로 단독 slice 로는 불가. 재판정 범위 (전건 66 row vs gap/cross-cutting 후보만) 와 cascade 순서를 먼저 정하는 설계 slice 1 개 + 실판정 slice N 개 구조를 권장.
- **표기 비일관 후보 3 건의 정정** — (a) §3 83 행만 `(cover)` 를 달고 85 ~ 89 행은 달지 않음 (T-1403 기록), (b) §3 79 행이 77 · 78 행과 달리 UC-05 에 `(인접)` 표기 없음 (T-1402 기록), (c) UC §10 표의 `§5 step N` 이 arrow 계수 대비 ±1 ~ +2 편차 (T-1398 ~ T-1403 전 slice 부기 — 원인은 `Note over` 계수 여부). 셋 다 절 단위 판정에 영향 0 이라 저순위.
- **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 요약 문구 동기화** — §10 이 T-1394 ~ T-1404 로 4 축 해소를 확정했으나 두 요약 문구는 T-1393 시점 서술 그대로. direct doc-only 1 slice 로 처리 가능.

## 완료 기록 (2026-08-03)

**교체 방식 제약 (선행 항목)** — 212 행을 **삭제 1 · 추가 1 의 정확히 1 줄 교체** 로만 편집했다 (줄 삽입 · 분할 · bullet append · 새 절 신설 전부 미수행). 근거: 217 · 221 · 225 · 228 · 232 · 236 · 240 · 244 · 249 행 9 개 bullet 이 `212 행` 이라는 **행 번호** 로 본 문장을 참조하므로, 줄 수가 1 이라도 변하면 그 9 참조가 전부 어긋난다.

**새 문장 전문 (교체 후 212 행)**:

> - **미검증 축** (열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404) 갱신분이다 — 아래 214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형) — envelope-cover 판정의 **의미적** 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), \`adjacent\` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함) → **해소** (217 행 T-1395), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · coversReq union 33/33), §3 매트릭스 66 row 분류 자체의 재판정 → **미해소 — 유일 잔여 축** (cascade 설계 선행 필요), 위 수치 오차 3 건의 실제 정정 → **해소** (213 행 T-1394).

**5 축 보존** — 원 열거의 5 축을 같은 순서로 유지했고, 후속 bullet 이 문구로 인용하는 4 문구 (`envelope-cover 판정의 **의미적** 타당성` · `adjacent 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함)` · `UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지` · `§3 매트릭스 66 row 분류 자체의 재판정`) 와 5 번째 축 (`위 수치 오차 3 건의 실제 정정`) 을 **한 글자도 축약하지 않고 원문 그대로** 실었다 — 축 삭제 · 병합 0.

**pointer 행 번호 · task ID 검증** (`grep -n "T-1394\|T-1395\|T-1396\|T-1397\|T-1398)\|T-1399)\|T-1400)\|T-1401)\|T-1402)\|T-1403)"` 1 회 실행, 편집 전 파일 기준 — 212 행은 미포함이라 편집이 결과를 바꾸지 않는다): 213 = T-1394 정정 반영 · 215 · 217 = T-1395 (해소 선언은 217) · 218 ~ 221 = T-1396 (해소 선언 221) · 222 ~ 225 = T-1397 (해소 선언 225) · 226 ~ 228 = T-1398 · 229 ~ 232 = T-1399 · 233 ~ 236 = T-1400 · 237 ~ 240 = T-1401 · 241 ~ 244 = T-1402 · 245 ~ 249 = T-1403. 새 문장이 쓴 pointer 5 개 (221 / 225 / 217 / 228 ~ 249 / 213) 가 **전건 일치**.

**시점 표기** — 문장 머리에 "열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404) 갱신분" 을 명시하고 214 행 화법 (200 · 209 행을 "T-1393 시점 서술" 로 못박고 이후 상태를 별도 bullet 이 가리키는 방식) 과 동형임을 인용했다. §10 의 "작성 당시 기록 + 이후 갱신" 서술 규약 불변.

**줄 수 · 참조 불변 검산 7 값** (편집 후 실측, 괄호 안이 요구치):

| # | 항목 | 값 |
| --- | --- | --- |
| (a) | `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` | **264** (264 불변) |
| (b) | `grep -c "212 행"` | **9** (9 불변 — 새 문장에 `212 행` 문자열 미포함) |
| (c) | `grep -n "미검증 축"` 첫 hit / 총 hit | **212** / **10** (212 / 10 불변) |
| (d) | `grep -c "^\| REQ-"` | **66** (66 불변) |
| (e) | `grep -c "^## "` | **11** (11 불변) |
| (f) | §5 표 count 4 값 + 합계 row (123 ~ 127 행) | `48 / 4 / 13 / 1` + 합계 `**66**` · `**100 %**` 불변 |
| (g) | §4 115 행 정합식 | `33 + 15 + 4 + 13 + 1 = 66` 불변 |

**hunk 국한 검증 (R-112 대체, doc-only — 코드 변경 0 이라 unit test 대신 diff 박제)**:

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -212 +212 @@ REQ 의 cover 방식을 다음 4 enum 으로 분류:

$ git diff --numstat docs/use-cases/REQ-COVERAGE-AUDIT.md
1	1	docs/use-cases/REQ-COVERAGE-AUDIT.md

$ git status --porcelain
 M docs/use-cases/REQ-COVERAGE-AUDIT.md
 M docs/tasks/T-1404-req-coverage-audit-unverified-axes-line-refresh.md
```

hunk 는 `@@ -212 +212 @@` **1 개뿐** 이고 §1 ~ §9 · §11 및 §10 의 다른 행 (200 ~ 211 · 213 ~ 250) 에 hunk **0**. numstat 은 **`1 1`** (추가 1 · 삭제 1) 이고 변경 파일은 `touchesFiles` 2 개 외 **0**. 212 행은 `|` 로 구분된 표 row 가 아니라 `-` bullet 문장이므로 [T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 가 겪은 **필드 수 대조 대상이 아니다** (표 파손 risk 없음).

**한계 —** 본 slice 가 하지 않은 것: (1) 유일 잔여 축인 **§3 매트릭스 66 row 분류 자체의 재판정** 은 미착수 — cascade 설계 (§5 count · §4 115 행 정합식 · INDEX 110 행 · PLAN 36 행) 가 선행돼야 한다. (2) §3 83 행 `(cover)` 표기 비일관 · UC §10 표 `§5 step N` ±1 편차 등 T-1398 ~ T-1403 이 **기록만** 한 표기 후보의 정정 미수행. (3) `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 요약 문구 동기화 미수행 (read-only 유지). (4) 66 REQ 의 구현 실재 여부 (`docs/requirements.md` status) 는 T-1375 계열 소관으로 본 slice 범위 밖.
