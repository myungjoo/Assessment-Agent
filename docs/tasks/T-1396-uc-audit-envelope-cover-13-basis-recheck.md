---
id: T-1396
title: REQ-COVERAGE-AUDIT §4 UC-01 envelope-cover 13 건의 UC-01 본문 서술 근거를 2 축 실측으로 재판정
phase: P5
status: DONE
completedAt: 2026-08-02T15:42:00Z
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1395]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1396-uc-audit-envelope-cover-13-basis-recheck.md
plannerNote: "uc-doc-audit-resync 8 번째 slice — 212 행 미검증 축 잔여 3 개 중 'envelope-cover 의 의미적 타당성' 을 13 건 전수 실측, 분류 변경은 Out of Scope, doc-only direct"
---

# T-1396 — REQ-COVERAGE-AUDIT §4 UC-01 envelope-cover 13 건의 UC-01 본문 서술 근거를 2 축 실측으로 재판정

## Why

[T-1395](T-1395-uc-audit-req031-req034-attribution-rejudge.md) 는 §10 212 행 "미검증 축" 이 열거한 5 항목 중 `adjacent` 귀속 축 1 개만 해소하고, 217 행에 **`envelope-cover 의 의미적 타당성` · `UC 본문 §5/§6/§8 의 frontmatter 대비 전수 검증` · `66 row 분류 자체의 재판정` 3 축은 미해소로 존속** 한다고 못박았다. 그 중 첫째 축이 본 slice 의 대상이다 — §4 106 행 bullet 은 REQ-009 · 010 · 011 · 012 · 013 · 018 · 019 · 020 · 021 · 022 · 033 · 035 · 036 **13 건** 을 UC-01 의 `envelope-cover (P5 알고리즘)` 로 선언하지만, 그 선언이 UC-01 본문의 실 서술에 근거하는지는 2026-05-25 이래 **한 번도 실측된 적이 없다**. T-1395 가 REQ-031 · REQ-034 2 건에 대해 쓴 축 B (본문 grep 근거 열거) 방법론을 그대로 13 건으로 확장해, envelope 선언이 실 서술 기반인지 아니면 분류상의 편의 표기인지를 판정한다. 판정이 §3 매트릭스 row 변경을 요구하는 경우에도 본 slice 는 **기록만** 한다 (§5 count 48 · §4 115 행 정합식 · INDEX 110 행 · PLAN 36 행으로 번지는 cascade 회피 — T-1395 와 동일 원칙).

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 106 행 — §4 UC-01 bullet. `envelope-cover (P5 알고리즘)` 뒤에 나열된 **13 건이 본 slice 의 모집단** 이다. **이 행은 read-only** (T-1393 축 B 가 bullet union 33 의 정확성을 실측한 상태라 무수정).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 115 행 · 117 행 — envelope 잔차 15 = bullet 13 + REQ-031 · 034 라는 T-1394 · T-1395 확정 분해. 본 slice 의 모집단이 왜 13 인지의 근거. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 200 ~ 217 행 — §10 dated 절. 본 slice 는 **217 행 뒤에 bullet 을 append** 한다. 기존 18 줄 무수정. 219 행 `## 11. References` 는 무수정.
- `docs/use-cases/UC-01-evaluation-execution.md` — 절 경계는 17(§1) · 51(§5) · 94(§6) · 107(§7) · 124(§8) · 133(§9) · 153(§10) · 179(§11) 행. 본문 서술 근거 실측 대상. **read-only**.
- `docs/requirements.md` 28 ~ 32 행 (REQ-009 ~ 013) · 37 ~ 41 행 (REQ-018 ~ 022) · 52 · 54 · 55 행 (REQ-033 · 035 · 036) — 13 건의 원문 요구 문장. 의미적 판정의 기준. **read-only**.

## Acceptance Criteria

- [ ] **축 A — ID 직접 언급 실측 (기계적)** — `grep -n "REQ-009\|REQ-010\|REQ-011\|REQ-012\|REQ-013\|REQ-018\|REQ-019\|REQ-020\|REQ-021\|REQ-022\|REQ-033\|REQ-035\|REQ-036" docs/use-cases/UC-01-evaluation-execution.md` 를 실행해 hit 를 전건 열거하고, 13 건 × (hit 행 번호 목록 · 각 hit 가 속한 절 · `없음`) 표를 완료 기록에 박제한다. 절 귀속은 위 Required Reading 의 절 경계 행 번호로 판정한다. **§10 관련 REQ 표 (153 ~ 178 행) 안의 hit 는 별도 컬럼으로 구분** 한다 (표는 요약이지 flow 서술이 아니므로 축 B 의 근거 강도가 다르다).
- [ ] **축 B — 서술 근거 강도 분류** — 축 A 의 hit 를 3 등급으로 분류해 표에 컬럼 1 개로 적는다: (강) §5 Main flow / §6 Alternative flows / §8 Postconditions 안의 서술 — 실제 흐름 cover, (약) §10 관련 REQ 표 또는 §9 Component mapping 안의 언급만 — 요약 참조, (없음) hit 0. 13 건의 등급 분포 (강 N / 약 N / 없음 N) 를 합계로 적는다.
- [ ] **종합 판정 + 조치 분기** — 축 A·B 를 종합해 다음 중 하나로 결론내고 완료 기록에 명시한다.
  - (가) **envelope 선언 유지** — 13 건 중 (없음) 등급이 0 이거나, (없음) 이 있어도 §4 106 행의 `envelope-cover (P5 알고리즘)` 라는 **선언 자체가 "본문에 개별 ID 로는 안 적히지만 UC-01 이 실행하는 P5 알고리즘의 내부 항목" 이라는 뜻** 임이 §4 도입 문장 (104 행) 과 정합할 때. → §10 bullet append 만. 본문 무수정.
  - (나) **선언과 본문이 어긋남** — (없음) 등급이 다수여서 envelope 선언이 본문 근거로 뒷받침되지 않을 때. → **본 slice 에서 §4 bullet 도 §3 매트릭스도 고치지 않는다**. 어긋난 REQ ID 목록과 cascade 범위 (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 만 §10 bullet 으로 박제하고 Follow-up 으로 넘긴다.
  - (다) **판정 보류** — 실측이 (가)·(나) 어느 쪽도 지지하지 않을 때. 보류 사유를 그대로 적고 §10 bullet 외 무수정.
- [ ] **§10 bullet append** — §10 마지막 bullet (217 행) **뒤** 에 `- **2026-08-02 envelope-cover 근거 재판정 (T-1396)** — …` 로 시작하는 bullet 을 **최대 4 줄** append 한다. 내용은 (1) 축 A·B 실측 요약 (등급 분포 숫자 포함), (2) 종합 판정 (가/나/다 중 무엇인지), (3) 212 행 "미검증 축" 의 `envelope-cover 판정의 의미적 타당성` 항목이 본 bullet 으로 **해소 또는 축소** 됐고 나머지 2 축 (UC 본문 전수 검증 · 66 row 분류 재판정) 은 존속함을 시점 명시. **새 `##` 절을 만들지 않는다** (§11 References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` **11 불변**, (c) §5 표 count 4 값 `48 / 4 / 13 / 1` 과 합계 row `**66** | **100 %**` **불변**, (d) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` **불변**, (e) 106 행 bullet 의 envelope-cover 나열이 **13 건 그대로** — 5 값을 완료 기록에 적는다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 목록을 박제해, hunk 가 **§10 말미 append 1 지점** 에만 존재하고 §1 ~ §9 · §11 에 hunk **0** 임을 보인다. 표 셀은 한 곳도 편집하지 않으므로 `|` 개수 대조 대상 행이 없음을 함께 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (다른 7 UC 의 envelope-cover / adjacent 나열 · §3 매트릭스 66 row 분류 자체의 재판정 · 13 건 REQ 의 **구현** 실재 여부 · UC-01 본문이 `coversReq` 13 건을 실제로 cover 하는지) 을 열거한다.

## Out of Scope

- **§4 106 ~ 113 행 bullet 8 줄 수정** — 금지 (T-1393 축 B 의 union 33 실측 기반 보존). 판정이 (나) 로 나와도 기록만 한다.
- **§3 매트릭스 어떤 row 의 분류값 변경** — 일절 금지 (§5 count · §4 정합식 · INDEX · PLAN cascade).
- **§4 115 행 · §5 표 (count / percentage / 비고 셀) 수정** — 금지 (T-1394 정정분 보존).
- **§1 ~ §3 · §6 ~ §9 · §11 본문 수정** — 금지. §10 은 **말미 bullet append 만** 허용. 117 행 blockquote 도 무수정 (T-1395 가 이미 확정 문장으로 교체함).
- **`docs/use-cases/UC-01-evaluation-execution.md` · `docs/requirements.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `src/` 수정** — 전부 read-only.
- **13 건 REQ 의 구현 실재 재판정** — `docs/requirements.md` 의 status 판정 (T-1375 계열 slice 소관) 은 본 slice 대상이 아니다. 본 slice 는 **UC-01 본문 서술 근거** 만 본다.
- **다른 7 UC 의 envelope-cover 검증 · 새 dated 절 (§12) 신설 · References 번호 변경** — 금지.

## Suggested Sub-agents

`implementer` (grep 2 축 실측 + doc 편집) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 hunk 국한 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## 완료 기록 (2026-08-03 실측)

### 축 A · B — 13 건 전수 실측표

명령: `grep -n "REQ-009\|REQ-010\|REQ-011\|REQ-012\|REQ-013\|REQ-018\|REQ-019\|REQ-020\|REQ-021\|REQ-022\|REQ-033\|REQ-035\|REQ-036" docs/use-cases/UC-01-evaluation-execution.md` → 출력 **1 행** (`129:- **평가 결과 row N 개 생성** — 각 인원 × 각 commit/문서 단위 (REQ-033) …`). 교차 검증으로 `grep -no "REQ-[0-9]\{3\}"` 전수 목록도 대조했고 결과 동일.

절 경계 실측 (`grep -n "^## " docs/use-cases/UC-01-evaluation-execution.md`): 17(§1) · 23(§2) · 32(§3) · 40(§4) · 51(§5) · 94(§6) · **104(§7)** · 124(§8) · 133(§9) · 153(§10) · 179(§11). Required Reading 이 적은 §7=107 은 실측 104 로 3 행 drift — REQ-033 hit (129 행) 의 §8 귀속 판정에는 영향 0.

| REQ | 본문 hit 행 | 귀속 절 | §10 표 (153~178) hit | 축 B 등급 |
| --- | --- | --- | --- | --- |
| REQ-009 | 없음 | — | 0 | 없음 |
| REQ-010 | 없음 | — | 0 | 없음 |
| REQ-011 | 없음 | — | 0 | 없음 |
| REQ-012 | 없음 | — | 0 | 없음 |
| REQ-013 | 없음 | — | 0 | 없음 |
| REQ-018 | 없음 | — | 0 | 없음 |
| REQ-019 | 없음 | — | 0 | 없음 |
| REQ-020 | 없음 | — | 0 | 없음 |
| REQ-021 | 없음 | — | 0 | 없음 |
| REQ-022 | 없음 | — | 0 | 없음 |
| REQ-033 | 129 | §8 Postconditions (124~132) | 0 | 강 |
| REQ-035 | 없음 | — | 0 | 없음 |
| REQ-036 | 없음 | — | 0 | 없음 |

**등급 분포 — 강 1 / 약 0 / 없음 12** (합 13). §10 관련 REQ 표는 primary 13 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040 · 049 · 051 ~ 055) + 인접 4 (REQ-008 · 031 · 032 · 034) 만 실어 13 건 중 hit 0 이므로, "약" 등급 자체가 발생하지 않았다.

### 종합 판정 — **(가) envelope 선언 유지**

- 근거 1: §5 통계표 123 행이 envelope 을 `15 REQ 가 UC envelope 내부 algorithmic / data-model cover` 로 **정의** 하고, §10 206 · 210 행도 같은 독법 (`미인용 uc-covered 15 건 … 모두 UC-01 envelope (P5 알고리즘 · trigger · 결과 data model)`) 을 쓴다. 즉 envelope-cover 는 처음부터 **개별 ID 본문 명시를 전제하지 않는** label 이라 hit 0 이 선언 위반이 아니다.
- 근거 2: §4 도입 문장 104 행 (`coversReq frontmatter + 본문 §5 / §6 / §8 가 실제로 cover 하는 REQ 의 ID list`) 과도 충돌 없음 — 13 건은 UC-01 `coversReq` 목록이 아니라 bullet 안의 **제 3 label** 로 분리 표기돼 있어, frontmatter 축 서술을 침범하지 않는다.
- 근거 3: 본문에 per-ID 는 아니어도 **위임 문장 형태의 envelope anchor 가 실재** — §5 step 10 `assessContributions(items, difficultyRouting)` + 반환 `평가문 + 난이도 + 기여도 + 양` (REQ-010 · 011 · 019 · 020 · 036 의 산정 축), §5 71 · 80 행 Note `중복 제거 … 구체 알고리즘은 P5` (REQ-009), §8 129 · 130 행 결과 row 서술 (REQ-033 · 035 의 data model 축).
- 유보 부기: 근거 3 의 anchor 는 **위임 1~3 문장** 수준이라 강도가 per-ID 서술보다 약하다. (나)·(다) 로 기울 만큼은 아니지만, "본문 근거 = 강 1 건" 이라는 실측치 자체는 위 §10 bullet 에 그대로 박제했다. 조치 분기는 (가) 이므로 §4 bullet · §3 매트릭스 · 115 행 정합식 · §5 count 전부 무수정.

### 불변 검산 (편집 전후 동일)

| 항목 | 값 | 판정 |
| --- | --- | --- |
| (a) `grep -c "^\| REQ-"` | 66 | 불변 |
| (b) `grep -c "^## "` | 11 | 불변 |
| (c) §5 표 count 4 값 + 합계 row | `48 / 4 / 13 / 1` + 합계 `**66**` · `**100 %**` | 불변 |
| (d) §4 115 행 정합식 | `33 + 15 + 4 + 13 + 1 = 66` | 불변 |
| (e) 106 행 envelope-cover 나열 | 13 건 (REQ-009 · 010 · 011 · 012 · 013 · 018 · 019 · 020 · 021 · 022 · 033 · 035 · 036) | 불변 |

### hunk 국한 검증 (R-112 대체, doc-only)

`git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더 **전량**:

```
@@ -217,0 +218,4 @@
```

hunk **1 개**, §10 말미 (217 행 뒤) append 1 지점뿐이고 §1 ~ §9 · §11 에 hunk **0**. `git diff --numstat` = `4  0` (추가 4 · 삭제 0) 로 기존 행 수정 0 을 이중 확인. 표 셀은 한 곳도 편집하지 않았으므로 `|` 개수 대조 대상 행이 **없다** (T-1370 · T-1375 사고 유형은 구조적으로 발생 불가).

### 한계 —

- **다른 7 UC (UC-02 ~ UC-08) 의 envelope-cover / adjacent 나열** 은 실측하지 않았다. 107 행 UC-02 의 `envelope-cover: REQ-003 / REQ-013 · 020 의 비교 view` 포함 미검증.
- **§3 매트릭스 66 row 분류 자체의 재판정** 은 하지 않았다 (Out of Scope).
- **13 건 REQ 의 구현 실재 여부** (`docs/requirements.md` status 열의 DONE / IN_PROGRESS 판정) 는 본 slice 대상이 아니다 — T-1375 계열 소관.
- **UC-01 본문이 자기 `coversReq` 13 건을 실제로 cover 하는지** (frontmatter 대비 본문 전수 검증) 는 미실측 — §10 212 행의 잔여 축으로 존속.
- 축 A 는 **ID 문자열 매칭** 이라, ID 없이 의미만 서술된 cover (예: §5 step 10 의 난이도 routing 이 REQ-011 을 함의) 를 기계적으로는 잡지 못한다. 축 B 의 위임 문장 판정이 이를 사람 판단으로 보완했으나 전수성은 보장하지 않는다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- **다른 7 UC 의 envelope-cover 나열 근거 재판정** (미착수) — 본 slice 는 UC-01 13 건만 실측했다. §4 107 ~ 113 행의 UC-02 envelope-cover 나열 (REQ-003 · REQ-013 / 020 비교 view) 부터 같은 2 축 방법론으로 확장하면 212 행 축이 완전 해소된다. doc-only direct 1 slice 규모.

- planner 관측 (2026-08-02, 미착수) — journal 2026-08-02 의 5 fire 연속 `[7.5] chain 미진입` 사유가 모두 §2.5 (a) 미충족 (executor 반환이 ≤200 char SUMMARY + trail blob 범위를 넘어 driver context 로 유입) 이다. 즉 `flags.multiTaskFire=true` 가 실효 0 이다. 교정은 `.claude/agents/executor.md` 반환 계약 (step 7) 강화가 유력하나 **agent 설정 파일 변경이라 본 planner 가 임의로 task 화하지 않는다** — 사람 판단으로 슬라이스 여부를 결정할 사안으로 남긴다.
