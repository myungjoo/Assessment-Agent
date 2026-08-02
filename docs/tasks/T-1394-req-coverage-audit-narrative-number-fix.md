---
id: T-1394
title: REQ-COVERAGE-AUDIT §4 115 행 · §5 121 행의 요약 수치 오차 3 건을 매트릭스 실측값으로 정정
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1393]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1394-req-coverage-audit-narrative-number-fix.md
plannerNote: "uc-doc-audit-resync 6 번째 slice — T-1393 Follow-up 1 (수치 오차 3 건 cascade 정정) 처리, audit 문서 내부 2 행 정정 + §10 반영 bullet, doc-only direct"
---

# T-1394 — REQ-COVERAGE-AUDIT §4 115 행 · §5 121 행의 요약 수치 오차 3 건을 매트릭스 실측값으로 정정

## Why

[T-1393](T-1393-req-coverage-reverse-coverage-recheck.md) 이 역방향 coverage 를 3 축으로 실측해 **집합·분류 차원 결함 0 건** 을 확정하면서, 동시에 **요약 수치 서술 오차 3 건** (§4 115 행의 `union 31` · 같은 행의 `envelope 13` · §5 121 행 비고의 분해 `31 직접 + 17 envelope`) 을 판정만 하고 정정은 Follow-up 1 로 넘겼다. 이 오차는 2026-05-25 PR-28 reviewer 가 이미 MINOR 로 지적했던 것이라 **15 개월째 미정정 존속** 상태이며, 115 행의 합산식은 `31 + 13 + 4 + 13 + 1 = 62 ≠ 66` 으로 문서 안에서 산술이 성립하지 않는다. 본 slice 는 §3 매트릭스 66 row 실측 (T-1390 이 §5 합계 48 / 4 / 13 / 1 과 1:1 일치 확인) 을 **유일한 anchor** 로 삼아 두 행의 숫자만 실측값 (`33 직접 + 15 envelope`) 으로 맞춘다. 분류 판정 자체 (REQ-031 · REQ-034 의 `adjacent` vs `uc-covered` 귀속) 는 건드리지 않는다 — 그 재판정은 매트릭스 row 까지 바꾸는 별개 cascade 라 Follow-up 으로 남긴다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 115 행 — §4 마지막 요약 문장. 정정 대상 1·2 (`union: 31 REQ` → 33, `envelope-cover (UC-01 의 P5 알고리즘 13 REQ)` → 잔차 15). **106 ~ 113 행 bullet 8 줄은 무수정** (T-1393 축 B 가 bullet union 은 이미 33 으로 정확함을 확인).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 117 ~ 125 행 — §5 통계 표. 정정 대상 3 은 **121 행 비고 셀의 분해 서술** 뿐. **count 컬럼 `48` · percentage `73 %` · 합계 row 66 은 전부 정확하므로 절대 건드리지 않는다** (T-1390 재검산 완료분).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 198 ~ 211 행 — §10 (T-1393 dated 절). 본 slice 는 이 절 **끝에 정정 반영 bullet 1 ~ 2 줄만 append** 한다. 특히 200 행 blockquote 의 "정정도 하지 않았다" 는 T-1393 시점 서술이므로 **원문 무수정**, 새 bullet 이 그 시점성을 명시한다.
- `docs/tasks/T-1393-req-coverage-reverse-coverage-recheck.md` "완료 기록" 축 B · 축 C — 정정에 쓸 실측 근거값 (union 33 / envelope 잔차 15 / 정합식 `33 + 15 + 4 + 13 + 1 = 66`). 본 slice 는 이 값을 **그대로 신뢰하지 않고 1 회 재실측** 한 뒤 반영한다.
- `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 — 외부 인용처 2 곳. 둘 다 **read-only**. 이 두 곳이 인용하는 값이 outer 4 값 (48 / 4 / 13 / 1) 뿐이어서 본 정정의 cascade 대상이 **아님** 을 실측 확인하는 것이 본 slice 의 판정 항목 중 하나다.

## Acceptance Criteria

- [x] **실측 재확인 (정정 전)** — 정정 직전에 (a) 8 UC frontmatter `coversReq` unique union, (b) §3 매트릭스 `uc-covered` row 수, (c) (b) − (a) 로 계산한 envelope 잔차 3 값을 명령으로 재산출해 각각 **33 / 48 / 15** 인지 확인하고 사용한 명령과 출력값을 완료 기록에 박제한다. 하나라도 다르면 **정정을 중단** 하고 그 사실만 기록한다 (틀린 anchor 로 정정하지 않는다).
- [x] **정정 1·2 — §4 115 행** — `8 UC 의 coversReq union: 31 REQ` → **33**, `envelope-cover (UC-01 의 P5 알고리즘 13 REQ)` → **envelope 잔차 15 REQ** 로 고치고, 합산식을 `33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66` 으로 맞춘다. 잔차 15 와 §4 bullet 이 나열한 envelope 13 건 사이의 차이 2 건 (REQ-031 · REQ-034 — bullet 은 `adjacent`, §3 매트릭스는 `uc-covered`) 을 같은 행 또는 바로 뒤 1 줄에 **명시** 해 문서 내부에서 13 과 15 가 동시에 읽혀도 모순으로 보이지 않게 한다. **115 행 편집 후 문장이 산술적으로 66 으로 닫히는지** 를 직접 더해 확인한다.
- [x] **정정 3 — §5 121 행 비고 셀** — `31 REQ 가 … 직접 명시 + 17 REQ 가 … envelope` → `33 REQ … 직접 명시 + 15 REQ … envelope` 로 고친다. **같은 row 의 count `48` · percentage `73 %` 는 무수정**. 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지) — 편집 후 121 행의 `|` 개수가 편집 전과 **동일** 함을 세어 완료 기록에 적는다.
- [x] **외부 인용처 cascade 판정** — `grep -n "48\|31 직접\|17 envelope" docs/use-cases/INDEX.md docs/PLAN.md` 등으로 INDEX 110 행 · PLAN 36 행이 인용하는 값을 실측해, 두 곳이 outer 4 값만 인용하고 본 정정 대상 3 값 (31 / 13 / 17) 은 **인용하지 않음** 을 확인한다. 결과에 따라 (a) 확인되면 "cascade 대상 아님 — 두 파일 무수정" 을 완료 기록에 명시, (b) 예상과 달리 인용이 발견되면 **본 slice 에서 고치지 말고** Follow-up 으로 넘긴다 (파일 상한 보호).
- [x] **§10 정정 반영 bullet** — §10 마지막 bullet (211 행 "미검증 축") **뒤** 에 `- **2026-08-02 정정 반영 (T-1394)** — …` bullet 을 **최대 2 줄** append. 내용은 (1) 정정한 3 값 before → after, (2) anchor 가 §3 매트릭스 실측이라는 점, (3) 200 행 blockquote 의 "정정도 하지 않았다" 는 T-1393 시점 서술이며 본 bullet 이 그 이후 상태임을 1 구절로 명시. **새 `##` 절을 만들지 않는다** (References 번호 churn 회피).
- [x] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## "` **11 불변** (신설 절 0), (c) §5 표의 합계 row 가 여전히 `**66** | **100 %**` 이고 count 컬럼 4 값이 48 / 4 / 13 / 1 **불변**, (d) `git diff --stat` 의 변경 파일이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` **1 개** (+ 본 task 파일) 세 ~ 네 값을 완료 기록에 적는다.
- [x] **R-112 대체 검증 (doc-only)** — 코드 변경 0 이므로 unit test 대신 위 grep / awk 출력값 전건 박제로 대체한다. 추가로 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 가 **§4 115 행 · §5 121 행 · §10 말미 3 지점** 에만 국한됨을 hunk 헤더 목록으로 보여 적는다.
- [x] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (REQ-031 · REQ-034 의 `adjacent` vs `uc-covered` 귀속 · §4 bullet 의 envelope 나열 13 건 자체의 의미적 타당성 · §3 매트릭스 row 분류 재판정 · UC 본문 forward dangling 검사) 을 열거한다.

## Out of Scope

- **REQ-031 · REQ-034 의 귀속 재판정** — §4 bullet 의 `adjacent` 표기와 §3 매트릭스의 `uc-covered` 중 어느 쪽이 옳은지는 본 slice 가 판정하지 않는다. 본 slice 는 **매트릭스를 anchor 로 고정** 하고 숫자만 맞춘다 (T-1393 Follow-up 2 존속).
- **§3 매트릭스 66 row 수정** — 어떤 row 의 분류값도 바꾸지 않는다.
- **§5 표의 count / percentage / 합계 수정** — 비고 셀 문구 1 곳 외 일절 금지 (T-1390 이 이미 정확함을 확인).
- **§1 ~ §3 · §6 ~ §9 본문 수정** — 일절 금지. §10 은 **말미 bullet append 만** 허용하고 기존 13 줄은 무수정.
- **`docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · 8 UC 본문 · `src/` 수정** — 전부 read-only. 인용처 판정 결과가 예상과 달라도 본 slice 에서 고치지 않는다.
- **새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (anchor churn 회피).

## Suggested Sub-agents

`implementer` (doc 편집 + grep / awk 재실측) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 R-112 대체 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

- **REQ-031 · REQ-034 의 귀속 재판정** (T-1393 Follow-up 2 존속) — §4 106 행 bullet 은 두 REQ 를 `adjacent`, §3 매트릭스는 `uc-covered` 로 적는다. 본 slice 는 매트릭스를 anchor 로 고정하고 그 차이를 115 행 뒤 blockquote 로 **명시만** 했으므로, 어느 쪽이 옳은지의 판정 + 진 쪽의 수정 (bullet 문구 또는 매트릭스 row) 은 별도 slice 소관. 매트릭스 row 를 바꾸면 §5 count 48 까지 cascade 하므로 그 경우 §5 · INDEX 110 행 · PLAN 36 행 재검산이 동반된다.
- **§4 bullet 의 envelope-cover 나열 13 건 자체의 의미적 타당성** — UC-01 P5 알고리즘이 REQ-009 ~ 013 / 018 ~ 022 / 033 / 035 / 036 을 실제로 envelope 하는지의 내용 검증 (본 slice 는 개수만 대조).

## 완료 기록

**완료 2026-08-02 (T-1394)** — §4 요약 행 · §5 비고 셀의 수치 오차 3 건을 §3 매트릭스 실측 anchor 로 정정. 편집 3 지점, `docs/use-cases/REQ-COVERAGE-AUDIT.md` 1 파일 (+6 / −2).

### 1. 실측 재확인 (정정 전) — 33 / 48 / 15 전건 일치

| 값 | 명령 | 출력 |
| --- | --- | --- |
| (a) 8 UC frontmatter `coversReq` unique union | `grep -h "^coversReq" docs/use-cases/UC-0*.md \| sed 's/.*\[//; s/\].*//' \| tr ',' '\n' \| tr -d ' ' \| grep . \| sort -u \| wc -l` | **33** (원소 총 41 건 → unique 33) |
| (b) §3 매트릭스 `uc-covered` row 수 | `grep -c "^\| REQ-.*\| uc-covered \|" docs/use-cases/REQ-COVERAGE-AUDIT.md` | **48** |
| (c) envelope 잔차 = (b) − (a) | `comm -13 <union> <uc-covered ID 목록> \| wc -l` | **15** |

- 잔차 15 건의 실 ID: `REQ-009 010 011 012 013 018 019 020 021 022 031 033 034 035 036` — §4 106 행 bullet 이 나열한 UC-01 P5 알고리즘 13 건 + **REQ-031 · REQ-034** 2 건. T-1393 축 C 부기의 서술과 ID 단위까지 일치.
- 역방향 `comm -23` (union 중 `uc-covered` 아닌 것) = **0 건** → frontmatter union 33 은 매트릭스 `uc-covered` 48 의 진부분집합. 즉 (c) 를 잔차로 계산하는 것이 성립한다.
- 세 값이 task 가 요구한 33 / 48 / 15 와 전건 일치하므로 **정정 중단 조건 미발동**, 정정 진행.

### 2. 정정 1·2 — §4 115 행

- before: `8 UC 의 coversReq union: 31 REQ. envelope-cover (UC-01 의 P5 알고리즘 13 REQ) 포함 시 uc-covered 48 REQ. 합 = 31 + 13 + 4 cross-cutting + 13 infrastructure + 1 gap = 66`
- after: `… union: 33 REQ. envelope 잔차 15 REQ 포함 시 uc-covered 48 REQ. 합 = 33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66`
- **산술 확인**: 33 + 15 = 48 (= §5 `uc-covered` count), 48 + 4 + 13 + 1 = **66** (= §3 row 수 = §5 합계). 문장이 66 으로 닫힌다.
- 13 vs 15 모순 방지: 바로 뒤 1 줄 blockquote 를 추가해 차이 2 건이 REQ-031 · REQ-034 이며 bullet (`adjacent`) 과 매트릭스 (`uc-covered`) 의 나열 기준 차이일 뿐이고, 본 요약 행의 anchor 는 §3 매트릭스임을 명시. 귀속 재판정은 미수행이라고 못박고 §10 을 가리킴.
- **106 ~ 113 행 bullet 8 줄 무수정** (diff hunk 가 115 행에서 시작함으로 확인).

### 3. 정정 3 — §5 비고 셀

- before: `| \`uc-covered\` | 48 | 73 % | 31 REQ 가 … 직접 명시 + 17 REQ 가 … envelope |`
- after: `| \`uc-covered\` | 48 | 73 % | 33 REQ 가 … 직접 명시 + 15 REQ 가 … envelope |`
- **count `48` · percentage `73 %` 무수정**. 셀 안 리터럴 `|` 주입 0.
- **`|` 개수 검산**: 편집 전 `awk 'NR==121' … | tr -cd '|' | wc -c` = **5**, 편집 후 같은 행 (123 행으로 이동) = **5** → 동일. 헤더 및 인접 4 행과 필드 수 일치 (T-1370 · T-1375 사고 재발 없음).

### 4. 외부 인용처 cascade 판정 — **cascade 대상 아님, 두 파일 무수정**

- `grep -n "48\|31 직접\|17 envelope\|31 REQ\|envelope" docs/use-cases/INDEX.md docs/PLAN.md` 실행.
- INDEX 110 행 인용값: `66 REQ 중 uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` — **outer 4 값뿐**.
- PLAN 36 행 인용값: `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` — **outer 4 값뿐**.
- 두 파일 어디에도 본 정정 대상 3 값 (`31` union / `13` envelope / `17` envelope) 인용 **0 건**. INDEX 의 나머지 hit (32 · 58 · 113 행) 은 REQ-048 / REQ-042 등 REQ ID 문자열이 `48` 에 걸린 것이고, PLAN 의 나머지 hit 도 무관 bullet. → **INDEX.md · PLAN.md read-only 유지**, 예상대로 cascade 없음.

### 5. §10 정정 반영 bullet

- §10 마지막 bullet ("미검증 축") **뒤** 에 `- **2026-08-02 정정 반영 (T-1394)** — …` + 시점성 명시 1 줄, 총 **2 줄** append. 새 `##` 절 0 (References 는 §11 그대로).
- 200 행 blockquote · 209 행 "정정은 Follow-up 으로 넘긴다" 는 **원문 무수정**, 새 bullet 이 그것을 "T-1393 시점 (정정 전) 서술" 로 시점 한정.

### 6. 불변 검산 + R-112 대체 검증 (doc-only, 코드 변경 0)

| 검산 | 편집 전 | 편집 후 |
| --- | --- | --- |
| (a) `grep -c "^\| REQ-"` | 66 | **66** (불변) |
| (b) `grep -c "^## "` | 11 | **11** (불변, 신설 절 0) |
| (c) §5 count 4 값 + 합계 row | 48 / 4 / 13 / 1, `**66** \| **100 %**` | **동일** (비고 셀 문구만 변경) |
| (d) `git diff --stat` | — | `docs/use-cases/REQ-COVERAGE-AUDIT.md \| 8 ++++++--`, **1 파일** 6 insertions / 2 deletions (+ 본 task 파일) |

- `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` hunk 헤더 **3 개뿐**: `@@ -115 +115,3 @@` (§4 요약 행) · `@@ -121 +123 @@` (§5 비고 셀) · `@@ -210,0 +213,2 @@` (§10 말미 append). §1 ~ §3 · §6 ~ §9 · §11 에 hunk **0** → Out of Scope 준수 확인.
- 코드 변경 0 이라 unit test 대신 위 grep / awk / comm 출력 전건 박제로 R-112 대체 (task Suggested Sub-agents 의 tester 면제 조건과 동일 — direct doc-only).

### 7. 한계 —

- **REQ-031 · REQ-034 의 `adjacent` vs `uc-covered` 귀속 재판정 미수행** — 본 slice 는 §3 매트릭스를 anchor 로 **선언적으로 고정** 했을 뿐, 매트릭스 분류가 옳다고 판정하지 않았다. bullet 쪽이 옳다면 정정값은 33 + 13 계열로 다시 바뀐다 (Follow-up 1).
- **§4 bullet 의 envelope-cover 나열 13 건 자체의 의미적 타당성 미검증** — 개수만 대조했고 각 REQ 가 UC-01 P5 알고리즘에 실제로 포함되는지는 읽지 않았다.
- **§3 매트릭스 66 row 분류 재판정 미수행** — 어떤 row 의 분류값도 검증·변경하지 않았다. anchor 자체가 stale 하면 본 정정값도 함께 stale 하다.
- **UC 본문 forward dangling 검사 미수행** — frontmatter `coversReq` 가 가리키는 REQ 를 UC 본문 §5 / §6 / §8 이 실제로 서술하는지, 반대로 본문이 frontmatter 에 없는 REQ 를 인용하는지 미확인.
- **`percentage` 컬럼 재산정 미수행** — 73 % / 6 % / 20 % / 2 % 는 T-1390 확인분을 신뢰해 그대로 두었다 (합 101 % 는 반올림 결과로 추정하나 본 slice 가 검산하지 않음).
