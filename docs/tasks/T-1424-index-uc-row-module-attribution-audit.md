---
id: T-1424
title: INDEX.md 8 UC row (31 ~ 38 행) module 귀속 2 축 대조 실판정 + 처리 방식 판정 후 반영 + audit §12.22
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-038]
estimatedDiff: 135
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1423]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1424-index-uc-row-module-attribution-audit.md
plannerNote: "uc-doc-audit-resync 36 번째 slice — T-1423 Follow-up 1. INDEX 8 row module 귀속 2 축 대조 + 판정 반영. doc-only 1.6x"
---

# T-1424 — INDEX.md 8 UC row module 귀속 2 축 대조 실판정

## Why

[T-1423](T-1423-index-module-vocabulary-resync.md) 이 [INDEX.md](../use-cases/INDEX.md) **25** 행 허용 어휘를 정본 **12** 로 넓히고 **39** 행 (UC-09 row) 를 (B) 병기로 닫으면서, 스스로 `AC 5` 파생 영향 ① 로 "**31 · 36 · 37 행의 `AssessmentModule` 귀속이 실 shipped layer 와 갈리는 축 — 후속 slice 소관**" 을 남겼다 (`Follow-up 1`). 본 slice 가 그 축을 닫는다.

- [modules.md](../architecture/modules.md) **39** 행 정본은 `AssessmentModule` 을 **"평가 결과 조회·sort·filter·시계열 placeholder (미shipped)"** 로 박제하고, 실제 shipped layer 는 `AssessmentCollectionModule` (수집, 40 행) / `AssessmentEvaluationModule` (평가, 41 행) 임을 명시한다. 그런데 INDEX 표의 **31 · 32 · 36 · 37 · 38** 행 (UC-01 / UC-02 / UC-06 / UC-07 / UC-08) **5 row** 는 여전히 `AssessmentModule` 단독 귀속이다 — [T-1421](T-1421-uc09-module-attribution-correction.md) 이 UC-09 `§ 9` 에서, T-1423 이 INDEX 39 행에서 각각 해소한 것과 **같은 종류의 어긋남** 이 5 row 에 잔존한다.
- 같은 표에 **정본 병기된 39 행** 과 **미병기 5 row** 가 공존하는 상태라 표 안 표기가 이미 비대칭이다. T-1423 이 39 행 판정 시 세운 기준 ③ (표기 비대칭 허용 여부) 을 이번에는 **나머지 row 쪽에서** 판정해야 대칭이 회복된다.
- 부수로 **31** 행의 `SchedulerModule` 은 modules.md **42** 행이 "**실 shipped module 명 = `SchedulingModule` (src/scheduling/)**" 를 부기한 지점이라 같은 2 축 대조 대상이다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/INDEX.md` — **본 slice 의 유일한 편집 대상 문서**. 다음 구간만 읽는다.
  - **29 ~ 41 행** (표 header 2 행 + UC-01 ~ UC-09 row 9 개 + 41 행 `총 8 UC` 시점 기록). 이 중 **31 ~ 38 행 8 row 만 판정 대상** 이고 **39** 행 (UC-09) 은 T-1423 이 이미 닫은 **무편집 경계**.
  - **24 · 25 행** (컬럼 허용 어휘 — 25 행은 T-1423 이 정본 12 로 방금 동기한 지점. **무편집 경계이자 본 slice 의 어휘 상한**)
  - **43 · 51 행** (시점 기록 · T-1412 무편집 판정 선례) · **58 · 86 행** (§3 description 산문의 `AssessmentModule` 언급 — 무편집 경계)
  - **110 ~ 115 행** (§5 갱신 룰 1 ~ 5 — **114** 행 룰 5 가 본 slice 근거)
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (표 row 12 = 정본 module 명), 특히 **39** 행 (`AssessmentModule` placeholder 미shipped 서술) · **40 · 41** 행 (실 shipped 수집 / 평가 축) · **42** 행 (`SchedulerModule` 의 실 shipped 명 부기) · **196 ~ 203 행** (component ↔ module mapping 정본 — T-1421 이 인용한 **197 · 198** 행 포함)
- `docs/use-cases/UC-01-evaluation-execution.md` · `UC-02-*.md` · `UC-06-*.md` · `UC-07-*.md` · `UC-08-*.md` — **무편집, 읽기만**. 각 파일의 `§ 9` (component / module mapping) 절만. 각 UC 본문이 선언한 **module 산정 수치** 를 확인해 본 slice 의 row 편집이 그 수치를 부정하지 않는지 대조하기 위함 (AC 1 (iii)).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1505 ~ 1612 행** (`### 12.21` — T-1423 판정 원문 + 화법 template, `AC 5` 파생 영향 ① 이 본 slice 대상을 지목), **1342 ~ 1419 행** (`### 12.19` — T-1421 의 3 후보 판정 + 병기 화법 원형), **1002 ~ 1058 행** (`### 12.15` — append / in-place 판별 방침 정본), **1613** 행 (`## 11. References` — `§ 12.22` 삽입 위치의 경계)
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (2 축 대조 원자료, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.22` 에 그대로 인용한다. 기대값과 **다르면 그 축의 판정을 중단** 하고 불성립 사실을 `§ 12.22` 에 기록한다 (임의 진행 금지).
  - (i) 정본 — `grep -c "^| \*\*" docs/architecture/modules.md` = **12** 와 그 12 개 module 명 전수.
  - (ii) **축 A (명칭 실재)** — INDEX **31 ~ 38 행** 8 row 의 module 열 distinct 집합을 전수 나열하고 (기대 **9** 개), 각 명칭이 (i) 의 12 안에 있는지 1:1 대조. **미실재 0** 이 기대값이며, 1 건이라도 미실재면 그 명칭은 어휘 위반이므로 별도 항목으로 표기.
  - (iii) **축 B (실 shipped layer 정합)** — (ii) 의 각 명칭에 대해 modules.md 정본 서술이 "shipped" 인지 "placeholder / 명칭 부기 있음" 인지 판정하고, 해당 명칭을 쓰는 row 번호를 붙인다. 최소 2 건을 명시적으로 다룬다 — ① `AssessmentModule` = **39** 행 정본이 `미shipped placeholder` 로 박제 (사용 row: **31 · 32 · 36 · 37 · 38**), ② `SchedulerModule` = **42** 행이 `실 shipped 명 = SchedulingModule` 부기 (사용 row: **31**). 아울러 각 대상 UC 본문 (`UC-01` / `UC-02` / `UC-06` / `UC-07` / `UC-08`) 의 `§ 9` 가 선언한 **module 산정 수치** 를 read-only 로 인용해, 본 slice 의 row 편집이 그 수치를 부정하지 않음을 확인한다 (T-1421 이 UC-09 `6 module` 을 보존한 것과 동형).
  - (iv) **무해 row 확인** — **33 · 34 · 35 행** (UC-03 / UC-04 / UC-05) 이 쓰는 module 명이 전부 (i) 실재 + shipped 임을 확인해 **편집 대상 0** 임을 근거화 (blast radius 를 5 ~ 6 지점에 고정하는 근거).
  - (v) baseline — `wc -l` INDEX **123** · audit **1626** · modules.md **256** · components.md **190**, INDEX `grep -c "^| UC-"` **9**, audit `grep -c "^## "` **12** · `grep -c "^| REQ-"` **66**.
- [ ] **AC 2 — 처리 방식 4 후보 판정표**: AC 1 (iii) 이 확정한 **어긋남 축마다 1 행** 인 판정표를 만든다 (최소 2 행 — `AssessmentModule` 축 · `SchedulerModule` 축). 각 행은 후보 4 개 중 **채택 1 · 기각 3** 이고 기각마다 근거 1 구를 단다 ("애매하다" 류 서술 금지).
  - (A) **치환** — row 의 `AssessmentModule` 을 실 shipped `AssessmentEvaluationModule` / `AssessmentCollectionModule` 로 교체.
  - (B) **row 내 병기** — INDEX **39** 행 (T-1423) · UC-09 `§ 9` (T-1421) 가 채택한 괄호 부기 화법을 5 row 에 동형 적용.
  - (C) **표 각주 1 개** — 표 아래에 각주 1 ~ 2 행을 신설하고 row 는 무편집 또는 최소 marker 만 (반복 부기의 verbosity 회피안).
  - (D) **무편집** — 본 slice 는 실측·판정만 audit 에 남기고 표는 후속 slice 로 이월.
  - 판정 기준 3 축을 명시한다: ① 각 UC 본문 `§ 9` 의 module 산정 수치와 **무모순** (AC 1 (iii) 인용값 기준), ② **blast radius** — 편집 지점 수 × 행당 in-place 여부, ③ **표기 대칭** — 이미 병기된 39 행과 나머지 row 사이의 비대칭을 채택안이 줄이는지 늘리는지.
- [ ] **AC 3 — 채택안 반영**: AC 2 의 채택안대로만 INDEX 를 편집한다. 처리 전에 [`§ 12.15`](../use-cases/REQ-COVERAGE-AUDIT.md) 판별 (날짜 stamp 있는 시점 기록 = append / 없는 living 서술 = in-place) 을 대상 지점에 적용한 결과를 1 구로 근거화한다.
  - (A) 또는 (B) 채택 시 — 각 대상 row 는 **1 행 → 1 행 in-place** 이고, 편집 row 수는 AC 1 (iii) 이 지목한 집합과 **정확히 일치** 해야 한다 (지목 밖 row 편집 0).
  - (C) 채택 시 — 신설 각주는 표 **바로 아래** 에 두고 **2 행 이내**, row 편집은 0 또는 marker 1 토큰. INDEX `wc -l` 증가는 **+2 이내**.
  - (D) 채택 시 — diff 에 **31 ~ 38 행이 미등장** 해야 하고, 그 경우 `§ 12.22` 는 실측 + 판정 기록만으로 성립한다.
  - 어느 안이든 **module 명 어휘는 25 행이 허용한 12 개 안** 에서만 쓴다 (25 행 자체는 무편집).
- [ ] **AC 4 — 무편집 경계**: **21 · 24 · 25 · 39 · 41 · 43 · 51 · 58 · 86 행** 과 **33 · 34 · 35 행** 은 **전부 무편집** 이고 diff 에 미등장한다. 특히 **25 · 39 행** 은 T-1423 이 방금 닫은 지점이라 재편집이 곧 회귀이며, 이 사실을 `§ 12.22` 에 1 구로 남긴다.
- [ ] **AC 5 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.22` 에 남긴다 — 최소 ① INDEX **58 · 86 행** §3 description 산문의 `AssessmentModule` 귀속 (T-1423 Follow-up 2), ② [data-model.md](../architecture/data-model.md) **39** 행의 `modules.md 의 8 NestJS module 명만 사용` (INDEX 25 행과 **동종 파생 stale** — 정본 12 대비 어긋남, 본 slice 실측 중 신규 확인), ③ data-model.md **38** 행 `13 entity` vs 실 entity row **14** (T-1421 Follow-up 3 잔여 ①), ④ [api.md](../architecture/api.md) **223** 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC (동 잔여 ②), ⑤ UC-09 `§ 5` sequence participant 병기 미판정 (6 회째 이월). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 7 이 diff 부재로 검증).
- [ ] **AC 6 — audit §12.22 절 신설**: `## 11. References` (**1613** 행) 바로 앞 (= `§ 12.21` 뒤) 에 `### 12.22 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변** — `###` 이므로). 구성은 `§ 12.19` · `§ 12.21` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 5 축 인용 (**축 A 대조표** + **축 B 대조표** 포함), (iii) **AC 2 의 4 후보 판정표** + 채택 결론, (iv) AC 3 반영 결과 (편집 지점 목록 + `§ 12.15` 판별 근거), (v) AC 4 무편집 경계 목록, (vi) AC 5 파생 영향 목록, (vii) [T-1423](../tasks/T-1423-index-module-vocabulary-resync.md) `§ 12.21` `AC 5` 파생 영향 ① 의 **closure 선언** (+ T-1423 Follow-up 1 closure), (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 58 · 86 행 산문 축 잔존, ② data-model.md 38 · 39 행 2 축 잔존, ③ 표 귀속이 modules.md 정본을 **복제** 하는 구조라 정본이 바뀌면 다시 stale 이 되는 축 (T-1423 Follow-up 6 의 5 축 동시 갱신 규약에 **INDEX 표 row** 를 편입해야 한다는 지적).
- [ ] **AC 7 — 무편집 경계 + 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/use-cases/INDEX.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. 불변 — INDEX `grep -c "^| UC-"` **9** · 표 열 수 불변 · `wc -l` **123** (AC 3 (C) 각주 채택 시에만 **≤ 125**), audit `^## ` **12** · `^| REQ-` **66**, modules.md **256** · components.md **190**. `git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'` 로 hunk 목록을 제시해 21 · 24 · 25 · 33 · 34 · 35 · 39 · 41 · 43 · 51 · 58 · 86 행 구간이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 5.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **INDEX 25 · 39 행 재편집** — T-1423 이 방금 닫은 지점. 재편집은 회귀.
- **INDEX 21 · 41 · 43 · 51 행 시점 기록 편집** — T-1412 가 무편집 보존으로 판정한 선례.
- **INDEX 58 · 86 행 §3 description 산문 편집** — 표 축과 산문 축은 처리 단위가 다르므로 별도 slice (AC 5 ①).
- **[modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) 편집 일체** — 본 slice 는 정본으로 **읽기만** 한다 (T-1422 가 이미 자기정합 완료).
- **UC-01 ~ UC-09 본문 편집 일체** — `§ 9` mapping 은 read-only 대조 입력일 뿐. 본문 쪽 어긋남이 실측되어도 AC 5 에 기록만.
- **[data-model.md](../architecture/data-model.md) 38 · 39 행** · **[api.md](../architecture/api.md) 223 행** — 각각 별도 slice (AC 5 ② ③ ④).
- **새 module 신설 · module 책임 재배치 · `AppModule` imports 변경 · `SchedulerModule` → `SchedulingModule` rename** — ADR + 코드 게이트.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.21`) 본문 재편집.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## 결과 요약 (2026-08-03)

- **AC 1 실측** — (i) 무-scope `grep -c "^| \*\*" modules.md` = **20** 으로 기대 12 와 불일치. 분해하면 module 목록 표 (32 ~ 43 행) **12** + component ↔ module mapping 표 (196 ~ 203 행) **8** 이라 **정본 축 자체는 12 로 성립** (§ 12.21 (i) 의 sed scope 판과 동일값, 28 · 45 행 산문과도 정합) — 불일치 원인이 문서가 아니라 **AC 1 (i) 명령의 scope 누락** 이라 축을 중단하지 않고 그 사실을 `§ 12.22` (i) · 한계 4 에 그대로 박제했다. (ii) 8 row distinct **9** (기대 일치) · **미실재 0**. (iii) 축 B 어긋남 2 개 — `AssessmentModule` (39 행 미shipped placeholder, row 31 · 32 · 36 · 37 · 38) · `SchedulerModule` (42 행 실 명칭 `SchedulingModule` 부기, row 31). (iv) 33 · 34 · 35 행 편집 대상 **0**. (v) baseline 6 값 전부 기대 일치.
- **AC 2 판정** — 축 1 `AssessmentModule` = **(B) row 내 병기 채택** (치환은 UC-01 `6 module` 부정 / 각주는 row 별 실 shipped 축이 5 가지라 부정확 + 39 행과 화법 분기 / 무편집은 4 회째 이월). 축 2 `SchedulerModule` = **(D) 무편집 채택** (`SchedulingModule` 은 25 행 허용 12 밖 토큰 · 정본 42 행 표 row 명 자체가 `SchedulerModule` 이라 **정본이 이미 흡수한 축**).
- **AC 3 반영** — INDEX **31 · 32 · 36 · 37 · 38** 5 행만 1 행 → 1 행 in-place 병기 (`§ 12.15` 판별상 stamp 없는 현행 서술 = in-place). 축 B 지목 집합과 정확히 일치, 지목 밖 row 편집 **0**. 편집 후 top-level module 토큰 수 **6 · 4 · 4 · 4 · 4** 로 5 UC 본문 `§ 9` 산정 전부 보존, distinct **9** 불변.
- **AC 4 · 7 검산** — 변경 파일 정확히 **3 개**, INDEX `wc -l` **123** 불변 · `^| UC-` **9** · 표 열 수 7 불변, audit `^## ` **12** · `^| REQ-` **66** 불변, modules.md **256** · components.md **190** 무편집. INDEX hunk = `@@ -31,2 +31,2 @@` · `@@ -36,3 +36,3 @@` 2 개뿐 → 21 · 24 · 25 · 33 · 34 · 35 · 39 · 41 · 43 · 51 · 58 · 86 행 미등장. numstat `5 5` → 순수 삭제 **0**. 합계 diff **+133/-5** (≤ 300 LOC · 3 파일).
- **AC 5 · 6** — 파생 영향 **6 항** (58 · 86 행 산문 / data-model 39 행 / data-model 38 행 / api.md 223 행 / UC-09 `§ 5` / **export·import 코드의 module 귀속 정본 미기재 — 신규 확인**) 을 목록만 기록하고 편집 0. audit `### 12.22` 를 `## 11. References` 앞에 **순수 append 128 행** 삽입 (한계 **5 항**).
- **AC 8** — `commitMode: direct` + production code **0 LOC** 이라 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 전부 **N/A** (CLAUDE.md §3.2 direct-mode doc-only 면제, 분기 0).
- **closure** — T-1423 `§ 12.21` `AC 5` 파생 영향 ① · 한계 1 · Follow-up 1 동시 closure.

## Follow-ups

1. **INDEX 58 · 86 행 §3 description 산문의 `AssessmentModule` 귀속 판정** — T-1423 Follow-up 2 이월 (2 회째). 본 slice 가 표 row 를 병기로 닫아 **표 ↔ 산문 비대칭** 이 새로 생겼으므로 표 화법을 그대로 승계해야 한다 (§ 12.22 한계 1).
2. **[data-model.md](../architecture/data-model.md) 39 행 `8 NestJS module 명` → 정본 12 동기** — INDEX 25 행 (T-1423) 과 동종 파생 stale.
3. **[data-model.md](../architecture/data-model.md) 38 행 `13 entity` vs 실 entity row 14 정정** — T-1421 Follow-up 3 잔여 축 ①.
4. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC 정정** — T-1421 Follow-up 3 잔여 축 ②.
5. **UC-09 `§ 5` sequence participant 병기 판정** — T-1421 Follow-up 2 이월 (6 회째).
6. **정본 module 변경 시 다축 동시 갱신 규약** — modules.md 표 · topological 열거 · mermaid node · 산문 카운트 + INDEX **25 행 어휘** + INDEX **표 row 귀속** 을 한 slice 에서 함께 갱신 (T-1423 Follow-up 6 에 표 row 축 편입 — 본 slice 병기가 `modules.md` **행 번호** 를 인용하므로 정본 row 삽입·삭제 시 즉시 어긋난다, § 12.22 한계 3).
7. **task 정의서의 정본 module 실측 명령 표준화** — 무-scope `grep -c "^| \*\*" docs/architecture/modules.md` 는 module 목록 표 12 + mapping 표 8 을 합산해 **20** 을 낸다. 후속 task 정의서는 `sed -n '32,43p' … | grep -c "^| \*\*"` 처럼 **scope 를 포함한 형태** 를 복제해야 오탐이 반복되지 않는다 (§ 12.22 한계 4).
8. **`src/export/` · `src/import/` 실 shipped 코드의 module 귀속을 modules.md 정본 12 표에 기재** — 본 slice 실측 중 신규 확인 (§ 12.22 파생 영향 6). 정본 편집이라 별도 slice.
