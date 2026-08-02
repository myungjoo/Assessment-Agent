---
id: T-1405
title: REQ-COVERAGE-AUDIT 유일 잔여 축 (§3 매트릭스 66 row 분류 재판정) 의 범위·기준·cascade·slice 분할 설계를 §12 로 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1404]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1405-req-coverage-matrix-rejudge-scope-design.md
plannerNote: "uc-doc-audit-resync 17 번째 slice — T-1404 Follow-up 1 (유일 잔여 축) 의 선행 설계, 판정 0 · 설계만, §11 앞 §12 신설 direct doc-only"
---

# T-1405 — §3 매트릭스 66 row 분류 재판정의 범위·기준·cascade·slice 분할 설계

## Why

[T-1404](T-1404-req-coverage-audit-unverified-axes-line-refresh.md) 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` **212 행** 을 갱신하며 5 축 중 4 축 해소를 확정했고, 남은 것은 **`§3 매트릭스 66 row 분류 자체의 재판정` 단 하나** 다. 그러나 이 축은 T-1398 ~ T-1404 처럼 단독 slice 로 바로 착수할 수 없다 — 분류값이 하나라도 바뀌면 §4 106 ~ 113 행 bullet · §4 115 행 정합식 · §5 표 count 4 값 · `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행이 **연쇄로 어긋나기** 때문이다. T-1404 Follow-up 1 번이 "재판정 범위 (전건 66 row vs 후보만) 와 cascade 순서를 먼저 정하는 설계 slice 1 개 + 실판정 slice N 개 구조" 를 권고한 이유가 이것이며, 본 slice 가 그 **설계 slice 1 개** 다.

본 slice 는 **어떤 row 의 분류값도 판정하지 않는다** (판정 0). 후속 실판정 slice 들이 그대로 집행할 수 있는 범위·기준·cascade 규약·batch 분할안을 §12 로 박제하는 것만이 산출물이며, 이로써 실판정 slice 들이 매번 cascade 범위를 재추론하는 비용과 판정 기준 drift 를 제거한다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **20 ~ 27 행 (§2 분류 정책)** — 재판정이 그대로 재사용해야 할 4 enum (`uc-covered` / `cross-cutting` / `infrastructure` / `gap`) 정의. 특히 24 행의 "UC envelope 안에 있으면 uc-covered" 규약이 envelope-cover 15 건 판정의 근거다. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **29 ~ 33 행 (§3 머리 + 표 헤더) 과 마지막 row (101 행 REQ-066)** — 5 컬럼 schema (REQ ID / kind / cover 방식 / cover 위치 / 참고) 와 66 row 의 물리적 범위 확인용. 전체 66 row 를 통독할 필요는 없다 — 본 slice 는 판정하지 않는다. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **102 ~ 117 행 (§4)** — 8 UC bullet (106 ~ 113 행) · 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` · 117 행 blockquote (REQ-031 · REQ-034 anchor). cascade 대상 1 · 2 번의 정확한 위치.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **119 ~ 127 행 (§5 표)** — count 4 값 `48 / 4 / 13 / 1` + 합계 row `**66** | **100 %**`. cascade 대상 3 번.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **186 ~ 199 행 (§9.4 · §9.5)** — 197 행이 이미 "3 절 66 row 중 REQ-004 1 건만 재판정했으므로 다른 REQ 의 분류가 stale 해졌는지는 미확인, §5 통계표 수치도 그 시점 값" 이라고 본 축의 미검증 상태를 박제해 뒀다. 본 slice 의 범위 판정은 이 문장과 모순되지 않아야 한다. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **212 행 + 249 · 250 행** — T-1404 가 갱신한 5 축 문장 (잔여 축 = §3 66 row 재판정) 과 T-1403 종합 판정의 cascade 규약 선례 (`cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 없음`). 본 slice 의 cascade 목록은 이 선례를 정본으로 삼아 확장한다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **251 ~ 264 행 (§11 References + Refs)** — §12 를 그 **직전** 에 삽입하기 위한 경계 확인. §10 이 §11 앞에 삽입된 선례와 동형.
- `docs/use-cases/INDEX.md` **110 행** · `docs/PLAN.md` **36 행** — 외부 cascade 2 지점. 본 slice 는 **읽기만** 하고 수정하지 않는다 (동기화는 T-1404 Follow-up 3 소관).

## Acceptance Criteria

- [ ] **삽입 위치·형식 (선행 항목)** — 새 절을 `## 12. 2026-08-03 §3 매트릭스 66 row 분류 재판정 설계 (T-1405)` 로 **§11 References 바로 앞 (현 250 행과 251 행 사이) 에 삽입** 한다. §10 이 §11 앞에 삽입된 선례와 동형이며, 이렇게 하면 **250 행 이하의 모든 행 번호가 불변** 이라 §10 의 9 개 bullet 이 인용하는 `212 행` 참조와 §4 `115 행` 참조가 전부 유효하게 유지된다. 이 제약과 근거를 완료 기록 첫머리에 2 줄 이내로 박제한다.
- [ ] **(1) 재판정 범위 확정** — §12 안에 "전건 66 row 재판정" 과 "후보 부분집합만 재판정" 중 **하나를 택하고 근거를 3 줄 이내로** 적는다. 택한 안이 부분집합이면 그 부분집합을 **결정 가능한 rule 로** 정의한다 (예: `kind` 가 Constraint 인 13 row 는 §2 27 행 정의상 판정 여지 0 이므로 제외, `cover 위치` 셀이 UC 를 가리키지 않는 row 만 후보 등). rule 을 §3 에 적용했을 때 나오는 **후보 row 수를 `grep -c` 계열 명령 1 회로 산출** 하고 그 명령과 출력을 완료 기록에 박제한다. 이 수치가 후속 slice 분할의 분모다.
- [ ] **(2) 판정 기준 박제** — 재판정이 사용할 기준을 §2 4 enum 을 **재정의하지 않고 참조** 하는 형태로 적고, row 1 개를 판정할 때 요구되는 **근거 3 종** (해당 UC frontmatter `coversReq` 실측 / UC 본문 §5 · §6 · §8 hit / `docs/requirements.md` 원문) 과 **분류 변경을 인정하는 임계** (예: 근거 3 종 중 2+ 가 현 분류와 어긋날 때만 변경, 1 종만 어긋나면 `기록만`) 를 명시한다. T-1398 ~ T-1403 이 확립한 "어긋남이 없으면 무수정 · 표기 비일관은 기록만" 규약을 그대로 승계함을 1 줄로 못박는다.
- [ ] **(3) cascade 대상 전수 열거** — 분류값이 **바뀔 경우** 동기화가 강제되는 지점을 빠짐없이 열거한다. 최소 6 지점: (a) §3 해당 row 의 `cover 방식` · `cover 위치` · `참고` 셀, (b) §4 106 ~ 113 행 중 관련 UC bullet, (c) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66`, (d) §5 표 count 4 값 + 합계 row, (e) `docs/use-cases/INDEX.md` 110 행, (f) `docs/PLAN.md` 36 행. 각 지점에 **현재 값** 과 **갱신 트리거 조건** (어떤 enum 전이가 그 지점을 건드리는지) 을 병기한다. §9.4 · §10 의 이전 요약 문장은 append-only 규약상 **갱신 대상이 아님** 을 1 줄 명시한다.
- [ ] **(4) cascade 순서 + 원자성 규약** — (a) → (b) → (c) → (d) → (e) → (f) 순서와, 한 slice 안에서 **(a) ~ (d) 는 반드시 함께** 갱신해야 함 (같은 파일 안의 정합식이라 분리 시 중간 상태가 모순) · (e) · (f) 는 **별도 slice 로 미뤄도 됨** (파일이 다르고 요약 문구라 lag 허용) 을 규약으로 적는다. 5 파일 cap 과의 관계를 1 줄로 확인한다.
- [ ] **(5) slice 분할안** — 후속 실판정 slice 의 개수 · 각 slice 가 맡을 row batch · batch 당 예상 diff 를 표로 적는다. batch 크기는 **T-1398 ~ T-1403 실적 (UC 1 ~ 2 개 · 1 bullet append · 90 ~ 160 LOC)** 을 근거로 산정하고, 각 slice 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 1 파일 + task 파일 2 개만 건드려 **cap (300 LOC / 5 파일) 안** 임을 명시한다. 마지막 slice 가 212 행 잔여 축 문구를 닫는 slice 임도 표에 포함한다.
- [ ] **(6) 판정 0 검증** — 본 slice 가 **어떤 row 의 분류값도 바꾸지 않았음** 을 검산한다: `git diff docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 변경 행이 전부 새 §12 범위 안이고 `^| REQ-` 로 시작하는 행의 추가·삭제가 **0** 임을 `git diff -U0 … | grep -c "^[-+]| REQ-"` = **0** 으로 보인다. 명령과 출력을 완료 기록에 박제한다.
- [ ] **불변 검산 6 값** — 편집 후 실측해 완료 기록에 표로 적는다: (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변, (b) `grep -c "^## "` = **12** (11 → 12, 정확히 +1), (c) `grep -n "미검증 축"` 첫 hit = **212** 불변 · 총 hit **10** 불변, (d) `grep -c "212 행"` = **9** 불변, (e) §5 표 count 4 값 `48 / 4 / 13 / 1` + 합계 `**66**` · `**100 %**` 불변, (f) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` 이 **여전히 115 행** 에 있음 (`sed -n '115p'` 로 확인).
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 헤더를 박제해, hunk 가 **삽입 1 개뿐** (`@@ -250,0 +251,N @@` 형태) 이고 1 ~ 250 행에 hunk **0** 임을 보인다. `git diff --numstat` 의 삭제 열이 **0** 임과 `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 함께 적는다. 표 row 를 건드리지 않으므로 `|` 필드 수 대조 대상이 아님을 1 줄 명시한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 하지 않은 것을 열거한다: (1) 실제 row 재판정 0 (설계만), (2) INDEX 110 행 · PLAN 36 행 미수정, (3) 표기 비일관 후보 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) 미정정, (4) 66 REQ 의 구현 실재 여부는 `docs/requirements.md` status 소관.

## Out of Scope

- **§3 매트릭스 어떤 row 의 어떤 셀 수정** — 일절 금지. 본 slice 는 판정 규약만 적고 판정하지 않는다.
- **§4 106 ~ 117 행 · §5 119 ~ 127 행 · §9 · §10 의 어떤 행 수정** — 전부 금지 (T-1393 · T-1394 실측분과 T-1398 ~ T-1404 append 분 보존). §10 말미 bullet append 도 금지 — 본 slice 의 산출물은 §12 신설 1 지점뿐이다.
- **1 ~ 250 행의 어떤 행 수정** — 금지. 250 행 이하 행 번호 불변이 본 slice 의 1 급 invariant (212 행 · 115 행 참조 보호).
- **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 동기화** — 금지 (T-1404 Follow-up 3 소관). 본 slice 는 cascade 대상으로 **열거만** 한다.
- **`docs/use-cases/UC-0*.md` · `docs/requirements.md` · `src/` · `web/` 수정** — 전부 read-only.
- **새 ADR 신설 · `docs/architecture/*` 신규 파일 추가** — 금지 (그 경우 commitMode 가 pr 로 바뀌어 본 slice 판정과 충돌).
- **References (§11) 항목 추가 · Refs 줄 변경** — 금지.

## Suggested Sub-agents

`implementer` (§12 삽입 + 후보 row 수 grep 산출 + 불변 6 값 · hunk 검산) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 (2) 판정 0 검증과 hunk 국한 검증의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

1. **S1 실판정 slice** — cross-cutting 4 (REQ-002 · 003 · 029 · 047) 재판정. §12.2 근거 3 종 + 임계 규약 적용, cascade 는 §12.3 · §12.4 그대로.
2. **S2 · S3 실판정 slice** — infrastructure 13 (REQ-001 · 017 · 056 ~ 066) 을 7 + 6 으로 분할 재판정. S3 가 마지막이므로 212 행 `유일 잔여 축` 문구 closure 를 포함한다.
3. **표기 비일관 3 건 정정 slice** (선택) — §3 83 행 `(cover)` · 79 행 `(인접)` 누락 · UC §10 표 `§5 step N` ±1 편차. cascade 없음 (분류값 무관) 이라 S1 ~ S3 와 독립.

## 완료 기록 (2026-08-03)

**삽입 위치 제약 (선행 항목)** — 새 절을 `## 12.` 로 **§11 References 바로 앞 (구 250 · 251 행 사이)** 에만 삽입했다 (§10 이 §11 앞에 들어간 선례와 동형). 근거: 250 행 이하 행 번호가 전부 불변이어야 §10 의 9 개 bullet 이 거는 `212 행` 참조와 §4 `115 행` 정합식 참조가 유효하게 유지된다.

**(1) 재판정 범위 — 부분집합 안 채택 (후보 17)**. rule (R) = §3 row 중 `cover 방식` 셀이 `cross-cutting` 또는 `infrastructure` 인 row. 제외 근거는 `uc-covered` 48 이 T-1395 ~ T-1403 축 C · D 로 이미 대조됐고 `gap` 1 은 §9.4 가 재판정을 마쳤다는 것 (§12.1 3 줄 근거).

```
$ grep -c "^| REQ-[0-9]\{3\} | [^|]* | \(cross-cutting\|infrastructure\) |" docs/use-cases/REQ-COVERAGE-AUDIT.md
17
```

대조 실측 (같은 형태): `uc-covered` = **48**, `gap` = **1** → 48 + 1 + 17 = **66** 검산 통과. 후보 17 = cross-cutting 4 (REQ-002 · 003 · 029 · 047) + infrastructure 13 (REQ-001 · 017 · 056 ~ 066).

**(2) 판정 기준** — §2 4 enum 을 재정의 없이 참조. 근거 3 종 = (i) UC frontmatter `coversReq` / `adjacentReq` 실측 · (ii) UC 본문 §5 · §6 · §8 hit (위임 문장 anchor 포함) · (iii) `docs/requirements.md` 원문 + cover 위치 셀 실재. 임계 = **2 종 이상 어긋날 때만 분류 변경, 1 종이면 `기록만`**. T-1398 ~ T-1403 의 "어긋남 없으면 무수정 · 표기 비일관은 기록만" 규약 승계를 §12.2 에 1 줄로 못박았다.

**(3) cascade 6 지점** — (a) §3 row 3 셀 / (b) §4 106 ~ 113 행 bullet / (c) §4 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` / (d) §5 count `48 / 4 / 13 / 1` + 합계 row / (e) INDEX.md 110 행 / (f) PLAN.md 36 행. 각 지점에 현재 값 + 트리거 조건 병기, §9.4 · §10 이 append-only 규약상 갱신 대상이 아님도 1 줄 명시 (§12.3 표).

**(4) 순서 + 원자성** — (a) → (b) → (c) → (d) → (e) → (f). **(a) ~ (d) 는 한 slice 안에서 원자적** (같은 파일 정합식 — 분리 시 `합 ≠ 66` 중간 상태), (e) · (f) 는 별도 slice 허용 (파일 다름 · 요약 문구). slice 당 2 파일이라 5 파일 cap 의 40 % (§12.4).

**(5) slice 분할안** — S1 cross-cutting 4 (140 ~ 160 LOC) / S2 infrastructure 7 = REQ-001 · 017 · 056 ~ 060 (100 ~ 130 LOC) / S3 infrastructure 6 = REQ-061 ~ 066 (110 ~ 140 LOC). 합 17 로 분모 일치. **S3 가 마지막 slice** — 212 행 잔여 축 문구를 in-place 1 줄 교체로 닫는다 (§12.5 표).

**(6) 판정 0 검증** — §3 매트릭스 row 의 추가 · 삭제 0:

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep -c "^[-+]| REQ-"
0
```

**불변 검산 6 값** (편집 후 실측, 괄호 안이 요구치):

| # | 항목 | 값 |
| --- | --- | --- |
| (a) | `grep -c "^\| REQ-"` | **66** (66 불변) |
| (b) | `grep -c "^## "` | **12** (11 → 12, 정확히 +1) |
| (c) | `grep -n "미검증 축"` 첫 hit / 총 hit | **212** / **10** (212 / 10 불변) |
| (d) | `grep -c "212 행"` | **9** (9 불변) |
| (e) | §5 표 count 4 값 + 합계 row (123 ~ 127 행) | `48 / 4 / 13 / 1` + `**66**` · `**100 %**` 불변 |
| (f) | `sed -n '115p'` | `33 + 15 + 4 + 13 + 1 = 66` 이 **여전히 115 행** |

(c) · (d) 가 불변인 것은 새 §12 본문이 그 두 검산 대상 문자열을 **의도적으로 쓰지 않고** 회피 표기 (`L212` · `잔여 축`) 를 쓴 결과다.

**hunk 국한 검증 (R-112 대체, doc-only — 코드 변경 0 이라 unit test 대신 diff 박제)**:

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -250,0 +251,75 @@ REQ 의 cover 방식을 다음 4 enum 으로 분류:

$ git diff --numstat docs/use-cases/REQ-COVERAGE-AUDIT.md
75	0	docs/use-cases/REQ-COVERAGE-AUDIT.md

$ git status --porcelain
 M docs/use-cases/REQ-COVERAGE-AUDIT.md
 M docs/tasks/T-1405-req-coverage-matrix-rejudge-scope-design.md
```

hunk 는 **삽입 1 개뿐** (`@@ -250,0 +251,75 @@`) 이고 1 ~ 250 행에 hunk **0**, 삭제 열 **0**, touchesFiles 2 개 외 변경 파일 **0**. 본 slice 는 표 row 를 1 개도 건드리지 않으므로 `|` 필드 수 대조는 대상이 아니다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지 항목의 non-applicable 처리).

**한계 —**

1. **실제 row 재판정 0** — 본 slice 는 설계만이며 17 후보 중 어느 row 의 분류값도 실측 · 판정하지 않았다. 후보 수 17 은 rule 적용 결과일 뿐 "17 건이 틀렸다" 는 뜻이 아니다.
2. **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 미수정** — cascade 대상으로 열거만 했다 (T-1404 Follow-up 3 소관).
3. **표기 비일관 후보 3 건 미정정** — §3 83 행 `(cover)` · 79 행 `(인접)` 누락 · UC §10 표 `§5 step N` ±1 편차. 전부 기록만 존속.
4. **66 REQ 의 구현 실재 여부는 본 문서 소관이 아니다** — `docs/requirements.md` 의 status 축이며, §9.3 이 못박은 "구현 실재 ≠ UC cover" 분리를 그대로 따른다.
5. **S1 ~ S3 의 LOC 추정은 T-1398 ~ T-1403 실적 기반 외삽** 이라 실판정 시 근거 (iii) 대상 문서가 예상보다 크면 재분할이 필요할 수 있다.
