---
id: T-1409
title: REQ-COVERAGE-AUDIT cascade (e) INDEX.md 110 행 · (f) PLAN.md 36 행 정합 확인 + §12.9 박제 + 두 요약의 시점 pointer 갱신
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1408]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/use-cases/INDEX.md
  - docs/PLAN.md
  - docs/tasks/T-1409-req-coverage-cascade-ef-external-summary-verify.md
plannerNote: "uc-doc-audit-resync 21 번째 slice — §12.4 가 분리 허용한 cascade (e)(f) 외부 요약 2 곳의 정합 확인 + 시점 pointer 갱신, direct doc-only"
---

# T-1409 — cascade (e) · (f) 외부 요약 2 곳 정합 확인 + 시점 pointer 갱신

## Why

[T-1405](T-1405-req-coverage-matrix-rejudge-scope-design.md) ~ [T-1408](T-1408-req-coverage-s3-infrastructure-rejudge-l212-closure.md) 이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` §12 로 §3 매트릭스 재판정 후보 **17 row 전건** 을 설계 → 실판정 (S1 / S2 / S3) 하고 §10 잔여 축 (L212) 을 닫았다. 종합 결과는 **유지 12 / 기록만 5 / 분류 변경 0 · 표기-only 셀 치환 1** 이라 §12.3 이 열거한 cascade 6 지점은 한 번도 발동하지 않았다.

그런데 §12.8 의 한계 (2) 가 못박은 대로 cascade **(e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행** 은 **수치 동기가 불요였던 것과 별개로 정합 확인 자체가 한 번도 수행되지 않았다** — §12.4 311 행이 두 지점을 "분리 허용" 으로 뺐고, 그 소관이 [T-1404](T-1404-req-coverage-audit-unverified-axes-line-refresh.md) Follow-up 3 → [T-1407](T-1407-req-coverage-s2-infrastructure-rejudge.md) Follow-up 2 → T-1408 Follow-up 1 로 세 번 연속 이월돼 왔다. 본 slice 가 그 이월분을 닫는다.

동시에 두 요약의 **시점 pointer 가 stale** 이다 — INDEX.md 111 행은 `2026-08-02 재판정: §9 참조 (T-1390)` 에서 멈춰 있어 §10 (T-1393 ~ T-1404) · §12 (T-1405 ~ T-1408) 를 가리키지 않고, PLAN.md 36 행은 2026-05-25 T-0029 원 출처만 인용하며 재판정 pointer 가 아예 없다. 수치가 같더라도 "재판정을 거쳐 같음이 확인된 값" 과 "한 번도 재확인되지 않은 값" 은 독자에게 다른 신뢰도를 준다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — §5 통계표 (119 ~ 127 행, 대조 anchor) · §4 115 행 정합식 · §12.3 (292 ~ 305 행, (e) · (f) 행의 `현재 값` 문자열) · §12.4 (307 ~ 312 행, 분리 허용 근거) · §12.8 종합 판정 표와 한계 (2) (600 ~ 654 행)
- `docs/use-cases/INDEX.md` 108 ~ 113 행 — cascade (e) 대상 문단 (110 행 4 값 + 111 행 시점 pointer)
- `docs/PLAN.md` 36 행 — cascade (f) 대상 bullet (Phase P2 셋째 bullet)
- `docs/tasks/T-1404-req-coverage-audit-unverified-axes-line-refresh.md` — Follow-up 3 (본 slice 의 원 출처) + 완료 기록의 **1 행 → 1 행 in-place 교체** 선례
- `docs/tasks/T-1408-req-coverage-s3-infrastructure-rejudge-l212-closure.md` — Follow-up 1 + 완료 기록의 불변 검산 표 · hunk 국한 검증 화법 (본 slice 가 승계할 기록 구조)

## Acceptance Criteria

### 1. 정합 확인 — 4 축 실측 (판정이 본 slice 의 1 급 산출물)

- [ ] **축 A — (e) 수치 대조**: `docs/use-cases/INDEX.md` 110 행이 적은 4 값 + 합 (`66 REQ 중 uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1`) 을 audit §5 표 (121 ~ 127 행) 4 값 · 합계 row 와 1:1 대조하고, 추가로 `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = 66 을 독립 anchor 로 재확인. 일치 / 불일치를 **건수로** 판정.
- [ ] **축 B — (f) 수치 대조**: `docs/PLAN.md` 36 행이 적은 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` 와 gap 서술 (REQ-004 사용자 지정 기간 임의 평가문) 을 같은 anchor 및 audit §6 gap follow-up · §9 재판정 (REQ-004 `gap` 유지) 과 대조. 일치 / 불일치를 건수로 판정.
- [ ] **축 C — 시점 pointer 최신성**: 두 문서의 재판정 pointer 가 audit 의 어느 절까지 반영하는지 실측 (INDEX.md 111 행 = §9 / T-1390 까지, PLAN.md 36 행 = pointer 없음) 하고, §10 (T-1393 ~ T-1404) · §12 (T-1405 ~ T-1408) 미반영 여부를 명시.
- [ ] **축 D — §12.3 표 자기정합**: §12.3 의 (e) · (f) 행이 적은 `현재 값` 문자열이 실제 두 파일의 해당 행과 문자열 수준에서 어긋나지 않는지 확인. 어긋나면 그 사실을 기록 (본 slice 는 §12.3 표를 고치지 않는다 — 아래 Out of Scope).
- [ ] 4 축 결과로 **cascade (e) · (f) 발동 여부를 명시 판정**. 수치 일치 시 "수치 갱신 0 — pointer 갱신만" 으로 결론짓고, 불일치 1 건이라도 나오면 그 건은 **정정하지 말고** Follow-up 으로 올린 뒤 본 slice 는 확인 기록까지만 (§12.4 의 (a) ~ (d) 원자 묶음이 audit 파일 안에서 함께 움직여야 하므로 외부 요약만 단독 정정하면 안 된다).

### 2. 기록 — audit 문서에 §12.9 append

- [ ] `docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 §12.8 마지막 행과 `## 11. References` **사이에만** `### 12.9` 절을 삽입 (654 행 이하 삽입 hunk 1 개). 1 ~ 654 행은 1 자도 변경 금지.
- [ ] §12.9 는 §12.6 ~ §12.8 선례 구조를 승계: (i) 대상·범위 1 문단, (ii) 축 A ~ D 실측 표, (iii) cascade (e) · (f) 발동 여부 판정, (iv) 두 외부 파일에 실제로 가한 편집의 before → after 요지, (v) 불변 검산 표, (vi) 한계 명시.
- [ ] 새 절은 `## ` 로 시작하는 heading 을 만들지 않는다 (`###` / `####` 만 사용).

### 3. 편집 — 외부 요약 2 곳의 시점 pointer 갱신

- [ ] `docs/use-cases/INDEX.md`: **111 행 다음에 1 줄 삽입** 으로 2026-08-03 재판정 pointer 를 추가 (화법은 111 행의 `2026-08-02 재판정: … §9 참조` 와 동형 — 후보 17 row 재판정 결과 분류 변경 0 이라 110 행 4 값 무변임을 밝히고 근거는 audit §12 에 위임). **110 행 문자열과 행 번호는 불변** 이어야 한다 (§12.3 (e) 가 행 번호로 참조).
- [ ] `docs/PLAN.md` **36 행은 1 행 → 1 행 in-place 교체** (T-1404 선례와 동형) — 문말에 재판정 pointer 1 문장만 덧붙이고 기존 문장·링크·수치는 한 글자도 축약하지 않는다. 삽입 / 삭제 금지 (파일 행 수 175 불변, 36 행 번호 불변).
- [ ] 두 편집 모두 **수치를 새로 쓰지 않는다** — 분류 변경 0 이므로 4 값은 기존 문자열 그대로 둔다.

### 4. 불변 검산 (편집 후 실측값을 §12.9 표에 박제)

- [ ] `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변.
- [ ] `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [ ] `grep -c "212 행" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **9** 불변 · `grep -n "미검증 축"` 첫 hit = **212** · 총 hit = **10** 불변 (새 절은 두 문자열을 쓰지 않고 `L212` · `잔여 축` 회피 표기를 쓴 T-1405 ~ T-1408 선례 승계).
- [ ] `sed -n '115p'` 가 여전히 `33 + 15 + 4 + 13 + 1 = 66` 정합식 · §5 표 count 4 값 `48 / 4 / 13 / 1` + 합계 `**66**` · `**100 %**` 불변.
- [ ] `wc -l docs/PLAN.md` = **175** 불변 · `wc -l docs/use-cases/INDEX.md` = **113 → 114** (+1, 의도된 유일한 증가) · INDEX.md 110 행 문자열 동일.
- [ ] `git diff -U0` 의 hunk 가 정확히 3 개 (audit 삽입 1 · INDEX 삽입 1 · PLAN 1:1 치환 1), `git diff --numstat` 의 삭제 열 합 = **1** (PLAN 치환의 짝) → **순수 삭제 0**.
- [ ] `git status --porcelain` 이 `touchesFiles` 4 개 외 변경 파일 **0**.

### 5. 검증 (doc-only — R-112 대체)

- [ ] 코드 변경 0 이라 unit test 없음. 대신 위 4 항의 검산 명령 출력과 `git diff -U0 … | grep '^@@'` / `--numstat` 결과를 task 파일 완료 기록에 박제 (T-1404 · T-1408 선례).
- [ ] 분기 없음 — R-112 의 flow / branch 항목은 해당 없음.

## Out of Scope

- **§3 매트릭스 셀 편집 일체** — 분류 enum 전이 · 표기-only 치환 모두 금지. 본 slice 는 재판정을 하지 않는다.
- **cascade (a) ~ (d) 갱신** — 분류 변경 0 이라 발동 대상 자체가 없다.
- **§12.3 표 수정** — (e) · (f) 행의 `현재 값` 셀 갱신도, 7 번째 cascade 지점 (§4 117 행 blockquote) 추가도 하지 않는다 (T-1408 Follow-up 2 소관).
- **INDEX.md 110 행 · PLAN.md 36 행 본문 재작성** — 문장 구조 개선 · 수치 재배치 · 링크 정비 금지. pointer 1 줄 추가 / 문말 1 문장 첨가만.
- **재판정 후보 밖 49 row 취급 결정** (T-1408 Follow-up 3) · **표기 비일관 3 건 정정** (T-1408 Follow-up 3 인접 항) — 별도 slice.
- **§9 · §10 의 과거 시점 서술 수정** — append-only 규약상 각 시점 판정은 보존한다 (§12.3 306 행).
- `src/` · `test/` · CI · package.json 등 코드 계열 파일 일체.

## Suggested Sub-agents

`implementer → tester` (doc-only direct — implementer 가 4 축 실측 + §12.9 append + 외부 2 파일 pointer 편집, tester 는 §4 불변 검산 명령 실행과 hunk 국한 확인만 담당)

## 완료 기록 (2026-08-03)

### 4 축 실측 결과 — cascade (e) · (f) **미발동** (수치 갱신 0)

| 축 | 실측 | 판정 |
| --- | --- | --- |
| A — (e) 수치 대조 | INDEX.md 110 행 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` ↔ audit §5 표 `48 / 4 / 13 / 1` 합 `**66**` ↔ `grep -c "^\| REQ-"` = **66** ↔ §3 분류 열 tally `48 · 4 · 13 · 1` | **일치 5 / 5 · 불일치 0** |
| B — (f) 수치 대조 | PLAN.md 36 행 `… gap 1 = 66` 문자열 완전 일치 · gap 서술 REQ-004 가 §6 133 행 · §9.4 188 행 `gap` 유지 판정과 정합 | **일치 5 / 5 · 불일치 0** |
| C — 시점 pointer | INDEX.md 111 행 = §9 / T-1390 (2026-08-02) 까지 · PLAN.md 36 행 = pointer **부재** (T-0029 원 출처만). §10 (T-1393 ~ T-1404) · §12 (T-1405 ~ T-1408) **둘 다 미반영** | **stale 2 / 2** |
| D — §12.3 자기정합 | (e) 셀 문자열 ↔ INDEX.md 110 행 substring hit 1 · (f) 셀 문자열 ↔ PLAN.md 36 행 substring hit 1 | **어긋남 0** |

수치 불일치 0 이므로 §12.4 원자 묶음 위반 없이 **pointer 갱신만** 수행. 정정 대상 Follow-up 도 발생하지 않았다.

### 산출물

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — §12.9 신설 (654 행 이하 삽입 hunk 1 개, 1 ~ 654 행 무편집). (i) 대상·범위 / (ii) 축 A ~ D 표 / (iii) cascade 발동 판정 / (iv) 외부 2 파일 before → after / (v) 불변 검산 표 / (vi) 한계 4 항.
- `docs/use-cases/INDEX.md` — 111 행 다음 1 줄 삽입 (112 행 신설, 110 행 문자열·행 번호 불변).
- `docs/PLAN.md` — 36 행 1 행 → 1 행 in-place 교체 (문말 pointer 1 문장 첨가, 기존 문장·링크·수치 무축약).

### 검산 명령 출력 (편집 후)

```
$ grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md      → 66   (불변)
$ grep -c "^## "    docs/use-cases/REQ-COVERAGE-AUDIT.md      → 12   (불변, ### / #### 만 추가)
$ grep -c "212 행"  docs/use-cases/REQ-COVERAGE-AUDIT.md      → 9    (불변)
$ grep -n "미검증 축" … | head -1 → 212 ;  총 hit → 10        (불변)
$ sed -n '115p' …   → 33 + 15 + 4 + 13 + 1 = 66 정합식 그대로
$ sed -n '121,127p' … → 48 / 4 / 13 / 1 · 합 **66** · **100 %** 불변
$ wc -l docs/PLAN.md              → 175  (불변)
$ wc -l docs/use-cases/INDEX.md   → 114  (113 → 114, 의도된 유일한 증가)
```

```
$ git diff -U0 | grep '^@@'
@@ -36 +36 @@                (docs/PLAN.md — 1:1 치환)
@@ -111,0 +112 @@            (docs/use-cases/INDEX.md — 1 줄 삽입)
@@ -654,0 +655,65 @@         (REQ-COVERAGE-AUDIT.md — §12.9 삽입)
$ git diff --numstat
1	1	docs/PLAN.md
1	0	docs/use-cases/INDEX.md
65	0	docs/use-cases/REQ-COVERAGE-AUDIT.md
$ git status --porcelain
 M docs/PLAN.md
 M docs/use-cases/INDEX.md
 M docs/use-cases/REQ-COVERAGE-AUDIT.md      (+ 본 task 파일 — touchesFiles 4 개 외 변경 0)
```

hunk **정확히 3 개** · 삭제 열 합 **1** (PLAN 치환의 짝) → **순수 삭제 0**. 코드 변경 0 이라 unit test 없음 · 분기 없음 (R-112 flow / branch 해당 없음).

## Follow-ups

1. **INDEX.md 110 행 · PLAN.md 36 행의 권장 처리 서술 최신성 재판정** — 두 요약이 함께 적은 `UC-09 신설 또는 UC-01 확장 권장` · `follow-up task T-0030+ 책임` 은 본 slice 의 대조 범위 밖이었다. REQ-004 는 `gap` 유지라 권장 자체는 유효하나 T-0030 / T-0031 이 이미 다른 산출물 (api.md / data-model.md) 로 완료돼 책임 task 지목이 stale 일 수 있다 (§12.9 한계 1).
2. **§12.3 표 보강** — (e) · (f) 행 `현재 값` 셀은 축 D 어긋남 0 이라 무수정이지만, 7 번째 cascade 지점 (§4 117 행 blockquote) 추가는 미착수 (T-1408 Follow-up 2 승계).
3. **재판정 후보 밖 49 row 취급 결정** · **표기 비일관 3 건 정정** — T-1408 Follow-up 3 그대로 이월.
