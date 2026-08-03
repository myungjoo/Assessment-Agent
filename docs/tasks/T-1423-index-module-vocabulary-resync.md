---
id: T-1423
title: INDEX.md 25 행 module 허용 어휘 정본 12 동기 + 39 행 UC-09 row 귀속 판정 + audit §12.21
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 105
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1422]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1423-index-module-vocabulary-resync.md
plannerNote: "uc-doc-audit-resync 35 번째 slice — T-1422 Follow-up 1. 정본 12 확정 뒤라 파생 INDEX 정정의 선행 조건 충족. doc-only 1.6x"
---

# T-1423 — INDEX.md module 허용 어휘 정본 동기 + UC-09 row 귀속 판정

## Why

[T-1422](T-1422-modules-md-module-count-resync.md) 가 정본 [modules.md](../architecture/modules.md) 의 자기모순 (`11 module` 산문 8 지점 vs 표 row 12) 을 닫으며 **module 정본 수 = 12** 를 확정했다. 그 slice 는 스스로 "파생 [INDEX.md](../use-cases/INDEX.md) 25 · 39 행 stale 잔존 — 후속 slice 소관" 을 `§ 12.20` 한계 2 로 남겼고, 그 앞의 [T-1421](T-1421-uc09-module-attribution-correction.md) `§ 12.19` 한계 2 도 같은 지점을 이월했다. 본 slice 가 그 **파생 축** 을 닫는다.

- `INDEX.md` **25** 행은 UC 표 "주요 module" 컬럼의 **허용 어휘 목록** 이며 스스로 출처를 "[modules.md](../architecture/modules.md) 의 … NestJS module 명" 이라 밝히는 **파생** 서술이다. 현재 이 한 행은 **삼중 어긋남** 상태다 — 카운트는 `8`, 실제 열거는 **9** 개 (WebModule / AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / PersistenceModule), 정본은 **12** 개.
- `INDEX.md` **114** 행의 §5 갱신 룰 5 는 "components.md / modules.md 의 component / module 명이 갱신되면 본 표의 컬럼을 동기" 를 **명문 의무** 로 두고 있다. T-1422 가 정본을 확정한 지금이 그 룰의 발동 시점이다.
- **39** 행 (UC-09 row) 의 module 열 6 값은 T-1421 이 UC-09 `§ 9` 에서 정본 병기를 택할 때 "INDEX 허용 어휘가 9 개뿐" 이라는 제약 아래 판정된 것이다. 25 행이 12 로 넓어지면 그 제약 전제가 바뀌므로, **같은 slice 안에서 39 행 처리 방식을 재판정** 해야 모순이 다시 이월되지 않는다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/INDEX.md` — **본 slice 의 유일한 편집 대상 문서**. 다음 구간만 읽는다.
  - **20 ~ 27 행** (컬럼 어휘 정의 — **21** 행 `UC-01 ~ UC-08 의 8 개` = T-0019 시점 기록 / **24** 행 `8 component 명` / **25** 행 `8 NestJS module 명` + 9 개 열거 = **주 편집 대상**)
  - **29 ~ 41 행** (UC 표 header + UC-01 ~ UC-09 row 9 개 + **41** 행 `총 8 UC` 시점 기록. 이 중 **39** 행만 판정 대상)
  - **51** 행 (T-1412 의 등록 기록 — 21 · 41 행을 **무편집 보존** 으로 이미 판정한 선례. 본 slice 는 그 판정을 승계)
  - **110 ~ 115 행** (§5 갱신 룰 1 ~ 5 — 특히 **114** 행 룰 5 가 본 slice 의 근거)
- `docs/architecture/modules.md` — **무편집, 읽기만**. **30 ~ 43 행** (표 header 2 행 + row 12 = 정본 module 명 12 개) · **28** 행 (`12 NestJS module`) · **197 · 198** 행 (T-1421 이 인용한 component ↔ module mapping 정본 행)
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — **무편집, 읽기만**. **129 ~ 141 행** (`§ 9` 서두 + mapping 표 6 행 — T-1421 이 박제한 **병기 화법** 과 `6 module` 산정 기준)
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1420 ~ 1504 행** (`### 12.20` — T-1422 판정 원문 + 화법 template, 특히 한계 2 가 본 slice 대상을 지목), **1002 ~ 1058 행** (`### 12.15` — append / in-place 판별 방침 정본), **1505** 행 (`## 11. References` — `§ 12.21` 삽입 위치의 경계)
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.21` 에 그대로 인용한다. 기대값과 **다르면 그 축의 판정을 중단** 하고 불성립 사실을 `§ 12.21` 에 기록한다 (임의 진행 금지).
  - (i) 정본 — `sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"` = **12**, 그 12 개 module 명을 전수 나열.
  - (ii) 파생 현재 상태 — `sed -n '25p' docs/use-cases/INDEX.md` 의 카운트 토큰 (`8`) 과 괄호 안 `/` 구분 열거의 실제 개수 (**9**) 를 각각 제시하고, (i) 과의 차집합 (정본에만 있는 module 명) 을 전수 나열.
  - (iii) 39 행 현재 module 열 값 6 개를 그대로 인용하고, 그 6 개가 (i) 의 12 개 안에 모두 존재하는지 (미실재 0 여부) 대조.
  - (iv) 다른 UC row 의 어휘 유효성 — `sed -n '31,38p'` 의 8 row 가 쓰는 module 명 distinct 집합이 (i) 의 부분집합인지 확인 (**부분집합이면 25 행 확장으로 무효화되는 row 0** 이라 본 slice blast radius 가 2 행에 고정된다는 근거).
  - (v) baseline — `wc -l` INDEX **123** · audit **1518** · modules.md **256** · UC-09 **174**, INDEX `grep -c "^| UC-"` **9**, audit `grep -c "^## "` **12** · `grep -c "^| REQ-"` **66**.
- [ ] **AC 2 — 25 행 처리 판정 + 반영**: AC 1 (i) 이 확정한 정본 12 를 기준으로 **25 행 1 행 → 1 행 in-place** 치환한다. 카운트 토큰과 괄호 열거를 **동시에** 갱신해 "카운트 N vs 열거 M" 어긋남을 남기지 않는다 (T-1422 가 정본에서 닫은 것과 같은 종류의 모순 재발 금지). 처리 전에 [`§ 12.15`](../use-cases/REQ-COVERAGE-AUDIT.md) 판별 (날짜 stamp 있는 시점 기록 = append / 없는 living 서술 = in-place) 을 25 행에 적용한 결과를 1 구로 근거화한다.
  - 문장 골격 (`… 의 N NestJS module 명 (…) 만 사용. 오타 0.`) 과 [modules.md](../architecture/modules.md) 링크는 **보존** — 수치와 열거만 교체.
  - **24** 행 (`8 component 명`) 은 [components.md](../architecture/components.md) 정본 8 과 정합이므로 **무편집** 이며, 그 사실을 1 구로 명시한다 (T-1420 축 A 실측 승계).
- [ ] **AC 3 — 39 행 (UC-09 row) 처리 방식 3 후보 판정**: 25 행 확장으로 허용 어휘 제약이 풀린 상태에서 39 행 module 열을 어떻게 둘지 **후보 3 개를 각각 1 행으로 판정한 표** 를 만든다 (채택 1 · 기각 2, 기각마다 근거 1 구 — "애매하다" 류 서술 금지).
  - (A) **치환** — `AssessmentModule` → 실 shipped `AssessmentEvaluationModule` (+ 수집 축 `AssessmentCollectionModule`) 로 교체.
  - (B) **병기** — UC-09 `§ 9` 가 이미 채택한 화법과 동형으로 부기 추가.
  - (C) **무편집** — 25 행만 닫고 39 행은 후속 slice 로 이월.
  - 판정 기준 3 축을 명시한다: ① UC-09 `§ 9` (무편집 경계) 와의 **무모순** — `§ 9` 는 `5 component + 6 module` 을 산정 기준과 함께 박제했으므로 39 행 변경이 그 수치를 부정하면 안 된다, ② **표 셀 1 개 = 1 행 in-place** 로 처리 가능한 blast radius, ③ 나머지 8 row (31 ~ 38 행) 를 **건드리지 않고** 39 행만 바꿀 때 표 안에 생기는 표기 비대칭의 허용 여부.
  - 채택안이 (A) 또는 (B) 면 **39 행 1 행 → 1 행 in-place** 로 반영하고, (C) 면 diff 에 39 행이 **미등장** 해야 한다.
- [ ] **AC 4 — 무편집 경계 (시점 기록 보존)**: **21** 행 (`UC-01 ~ UC-08 의 8 개 use case`) · **41** 행 (`총 8 UC`) · **43** 행 (`P2 UC 본문 분해 8/8 closure`) · **51** 행 (T-1412 등록 기록) · **58 · 86** 행 (§3 description 산문의 `AssessmentModule` 언급) 은 **전부 무편집** 이고 diff 에 미등장한다. 21 · 41 행은 51 행이 이미 "T-0019 시점 기록이라 무편집 보존" 으로 판정한 선례를 승계한다는 근거를 `§ 12.21` 에 1 구로 남긴다.
- [ ] **AC 5 — 파생 영향 목록 (편집 금지)**: 본 slice 가 확정한 어휘 12 가 어느 지점을 여전히 stale 로 남기는지 **목록만** `§ 12.21` 에 남긴다 — 최소 ① 31 · 36 · 37 행 (UC-01 / UC-06 / UC-07) 의 `AssessmentModule` 귀속이 실 shipped `AssessmentCollectionModule` / `AssessmentEvaluationModule` 와 갈리는 축 (T-1421 이 UC-09 에서만 해소한 것과 **같은 종류**), ② 58 · 86 행 산문의 동종 귀속, ③ UC-09 `§ 5` sequence participant 병기 미판정 (T-1421 Follow-up 2, 4 회 이월). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 7 이 diff 부재로 검증).
- [ ] **AC 6 — audit §12.21 절 신설**: `## 11. References` (1505 행) 바로 앞 (= `§ 12.20` 뒤) 에 `### 12.21 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변** — `###` 이므로). 구성은 `§ 12.19` · `§ 12.20` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 5 축 인용, (iii) AC 2 의 25 행 판정 + 근거, (iv) **AC 3 의 3 후보 판정 표** + 채택 결론, (v) AC 4 무편집 경계 목록, (vi) AC 5 파생 영향 목록, (vii) [T-1422](../tasks/T-1422-modules-md-module-count-resync.md) `§ 12.20` 한계 2 + [T-1421](../tasks/T-1421-uc09-module-attribution-correction.md) `§ 12.19` 한계 2 의 **동시 closure 선언** (+ T-1421 Follow-up 3 잔여 2 축 `data-model.md` 38 행 `13 entity` · `api.md` 223 행 링크 범위 1 줄), (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 8 row 의 동종 귀속 어긋남 잔존, ② UC-09 `§ 5` participant 미판정 잔존, ③ 25 행 어휘 확장이 향후 13 번째 module 시 다시 stale 이 되는 구조 (T-1422 `§ 12.20` 한계 1 의 4 축 동시 갱신 규약에 INDEX 축을 **5 번째 축** 으로 편입해야 한다는 지적).
- [ ] **AC 7 — 무편집 경계 + 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/use-cases/INDEX.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. 불변 — INDEX `wc -l` **123** · `grep -c "^| UC-"` **9** · 표 열 수 불변, audit `^## ` **12** · `^| REQ-` **66**, modules.md **256** · UC-09 **174**. `git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'` 로 hunk 목록을 제시해 21 · 41 · 43 · 51 · 58 · 86 행 구간이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 5.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **31 ~ 38 행 (UC-01 ~ UC-08) 의 module 열 편집 일체** — 동종 귀속 어긋남이 실측되어도 AC 5 목록에 기록만. 8 row 동시 재귀속은 blast radius 가 다르므로 별도 slice.
- **21 · 41 · 43 · 51 행 시점 기록 편집** — T-1412 가 이미 무편집 보존으로 판정한 지점.
- **58 · 86 행 §3 description 산문의 module 귀속 정정** — 표 축과 산문 축은 처리 단위가 다르므로 별도 slice.
- **[modules.md](../architecture/modules.md) 편집 일체** — 본 slice 는 정본으로 **읽기만** 한다 (T-1422 가 이미 자기정합 완료).
- **UC-09 본문 (`§ 5` sequence participant · `§ 9` mapping 표) 편집** — T-1421 이 박제한 병기 결과 보존. `§ 5` 병기 판정은 별도 slice.
- **`data-model.md` 38 행 `13 entity` vs 실 row 14** · **`api.md` 223 행 링크 범위** (T-1421 Follow-up 3 잔여 2 축) — 각각 별도 slice.
- **새 module 신설 · module 책임 재배치 · `AppModule` imports 변경** — ADR + 코드 게이트.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.20`) 본문 재편집.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **INDEX 표 8 row (31 ~ 38 행) 의 module 귀속 실 shipped layer 대조** — T-1421 이 UC-09 에서 수행한 2 축 대조 (명칭 실재 / 조합 정합) 를 나머지 8 row 에 적용 (본 slice AC 5 파생 영향 ①).
2. **INDEX 58 · 86 행 §3 description 산문의 `AssessmentModule` 귀속 판정** (본 slice AC 5 파생 영향 ②).
3. **[data-model.md](../architecture/data-model.md) 38 행 `13 entity` vs 실 row 14 정정** — T-1421 Follow-up 3 잔여 축 ①.
4. **`api.md` 223 행 링크 범위 vs 9 UC 어긋남 정정** — T-1421 Follow-up 3 잔여 축 ②.
5. **UC-09 `§ 5` sequence participant 병기 판정** — T-1421 Follow-up 2 이월 (5 회째).
6. **13 번째 module shipped 시 5 축 동시 갱신 규약** — modules.md 표 · topological 열거 · mermaid node · 산문 카운트 + **INDEX 25 행 허용 어휘** 를 한 slice 안에서 함께 갱신 (T-1422 `§ 12.20` 한계 1 에 INDEX 축 편입).
