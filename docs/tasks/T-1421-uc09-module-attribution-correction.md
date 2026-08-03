---
id: T-1421
title: UC-09 §9 136 · 137 행 module 귀속 어긋남의 처리 방식 판정 + shipped 정본 반영 + audit §12.19 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1420]
touchesFiles:
  - docs/use-cases/UC-09-user-defined-period-evaluation.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1421-uc09-module-attribution-correction.md
plannerNote: "uc-doc-audit-resync 33 번째 slice — T-1420 Follow-up 4 (본 slice 축 B 가 확정한 어긋남 1 · 부분 일치 1). 방식 판정 후 최소 blast-radius 반영. doc-only 신설 절 1.6x"
---

# T-1421 — UC-09 §9 module 귀속 어긋남 처리 + audit §12.19

## Why

[T-1420](T-1420-uc09-module-component-mapping-verification.md) 의 **Follow-up 4** 를 닫는다. T-1420 축 B (조합 정합) 가 UC-09 `§9` 6 행 중 **어긋남 1 · 부분 일치 2** 를 확정했고, 그 판정문 자체가 "정본은 [modules.md](../architecture/modules.md) 198 · 197 행 (shipped 코드 + [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) / [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 근거) 이고 **UC-09 본문이 정정 대상**" 이라고 방향까지 못 박았다. T-1420 은 UC-09 를 read-only 로 두었으므로 (Out of Scope) 실 반영은 본 slice 소관이다.

- 어긋남 실체 — UC-09 `§9` **137 행** (Worker) 이 module 을 `AssessmentModule (period bridge + orchestrator)` 로 적는데 `modules.md` **198 행** 은 Worker 를 `AssessmentCollectionModule (수집 service layer) + AssessmentEvaluationModule (평가 scoring/orchestration service layer)` 로 적고, 그 행 안에 "종전 mapping 이 평가 service layer 를 `AssessmentModule` 로 귀속하던 서술은 **stale 이라 정정** (실 shipped layer = AssessmentEvaluationModule)" 이라고 명시돼 있다. **136 행** (Backend API) 의 `AssessmentModule (controller layer)` 도 같은 계열 — 실 controller 는 `AssessmentEvaluationController` 다.
- 그런데 **단순 치환은 자기모순을 만든다**. UC-09 `§9` **131 행** 서두가 "명칭은 [INDEX.md](../use-cases/INDEX.md) 19 ~ 25 행이 **허용한 목록만** 사용한다" 고 스스로 제약을 걸었는데, INDEX `25` 행의 허용 목록 9 개에는 `AssessmentCollectionModule` · `AssessmentEvaluationModule` 이 **없다** (planner 실측). 게다가 UC-09 안의 `AssessmentModule` 표기는 **14 행** 이고 그 중 **12 행이 `§5` mermaid sequence 의 participant** 라, 어휘를 전면 교체하면 diagram 까지 번져 blast radius 가 cap 을 위협한다.
- 그러므로 본 slice 는 **먼저 처리 방식을 판정** 하고 (전면 치환 / 정본 병기 / 무편집+한계기록 3 후보), 채택안을 blast-radius 실측 근거로 확정한 뒤 **UC-09 `§9` 안에서만** 반영한다. `§5` sequence · `INDEX.md` · `modules.md` 는 무편집 경계다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — **129 ~ 143 행** (`## 9. Component / Module mapping` — 131 행 서두 제약문 + 표 6 행 + 말미 제외 근거 문단). **본 slice 의 유일한 편집 대상 구간**. 추가로 **55 ~ 100 행** (`§5` sequence — `AssessmentModule` participant 12 행. **읽기만** 하고 편집 금지, blast-radius 실측 입력)
- `docs/architecture/modules.md` — **197 행** (Backend API row — 6 module 열거 + `AssessmentEvaluationController` 가 `POST /api/assessment-evaluation/period` 를 노출한다는 서술), **198 행** (Worker row — `AssessmentCollectionModule + AssessmentEvaluationModule` + "종전 `AssessmentModule` 귀속은 stale 이라 정정" 문장). **정본 (무편집)**
- `docs/use-cases/INDEX.md` — **25 행** (허용 module 명 9 개 목록 — 131 행 제약문의 지시 대상), **39 행** (UC-09 row 의 module 열 6 값). **무편집 (읽기만)**
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1243 ~ 1341 행** (`### 12.18` — T-1420 축 B 판정 원문 + 화법 template + 한계 항), **1002 ~ 1058 행** (`### 12.15` — append / in-place 처리 방침 정본), **1342 행** (`## 11. References` — `§12.19` 삽입 위치의 경계)
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§12.19` 에 그대로 인용한다. (i) `grep -c "AssessmentModule" docs/use-cases/UC-09-user-defined-period-evaluation.md` = **14**, 그중 `sed -n '55,100p' … | grep -c "AssessmentModule"` = **12** (`§5` sequence), `§9` = **2** (136 · 137 행), (ii) `sed -n '26,46p' docs/architecture/modules.md` 의 module row **12** 안에 `AssessmentCollectionModule` · `AssessmentEvaluationModule` 이 **실재** 함, (iii) `INDEX.md` **25** 행 허용 목록의 module 명 **9 개** 를 전수 나열하고 그 안에 위 두 이름이 **부재** 함, (iv) baseline — `wc -l` UC-09 **174** · INDEX **123** · modules.md **256** · audit **1355**, audit `grep -c "^| REQ-"` **66** · `grep -c "^## "` **12**. **기대값과 다르면 그 축의 판정을 중단하고 `§12.19` 에 불성립 사실을 기록** 한다.
- [ ] **AC 2 — 처리 방식 판정 (3 후보 택 1)**: 아래 3 후보를 각각 **blast radius (예상 변경 행 수 · 파일 수)** 와 **자기모순 발생 여부** 두 축으로 평가한 **3 행 표** 를 만들고 채택안 1 개를 확정한다. 애매어 금지 — 각 행에 `채택` / `기각` 과 기각 사유 1 구.
  - **(A) 전면 치환** — `§9` 136 · 137 행 module 열을 shipped 명칭으로 바꾸고 `§5` sequence participant 12 행 · 131 행 제약문 · `INDEX.md` 25 · 39 행까지 동기. → blast radius 실측 (≥ 16 행 / ≥ 3 파일) 과 `§5` 무편집 경계 (Out of Scope) 위반 여부를 명시.
  - **(B) 정본 병기** — `§9` 136 · 137 행 module 열의 INDEX 허용 어휘는 **유지** 하고 shipped 정본 module 명을 괄호 또는 각주로 **병기**, 131 행 서두에 "표기 어휘는 INDEX 허용 목록 · 실 shipped layer 는 `modules.md` 197 · 198 행 정본" 취지 1 구 추가. 수치 `5 component + 6 module` 은 병기라 **불변**. [T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) 의 `source UC` 병기 선례와 동형.
  - **(C) 무편집 + 한계 기록** — UC-09 를 손대지 않고 `§12.19` 에 사실만 남긴다.
  - **판정 제약**: cap (≤ 300 LOC / ≤ 5 파일) 을 넘거나 `§5` sequence · `INDEX.md` · `modules.md` 를 건드려야 성립하는 방식은 **채택 불가**. 그 경우 그 사실을 기록하고 남은 후보 중에서 택한다. (C) 를 채택하려면 "UC-09 본문이 정정 대상" 이라는 T-1420 축 B 판정을 왜 미이행으로 두는지 근거 1 문장이 필수다.
- [ ] **AC 3 — 채택안 반영 (UC-09 `§9` 한정)**: AC 2 채택안을 UC-09 `## 9. Component / Module mapping` **구간 안에서만** 반영한다. 반영 지점마다 [§12.15](../use-cases/REQ-COVERAGE-AUDIT.md) 방침 (날짜 stamp 있는 시점 기록 = append / 없는 living document = in-place) 중 어느 쪽인지 **1 행씩 명시 판정** 한다 — `§9` 표 · 서두는 stamp 가 없으므로 in-place 가 예상 결론이나, 실측 후 다르면 그 근거를 쓴다. 표 행 수 **6 불변** · 표 열 수 **3 불변** · `§9` 이외 heading 무편집.
- [ ] **AC 4 — 수치 정합 재검산**: 반영 후 UC-09 `§9` 131 행의 `5 component + 6 module` 표기가 표 실제 값과 일치하는지 재검산한다. 병기 방식이면 **불변** 임을 근거와 함께 밝히고, 치환이 발생해 module distinct 수가 바뀌면 **같은 slice 안에서** 서두 수치를 함께 갱신한다 (수치와 표의 어긋남을 남기지 않는다). 최종 module distinct 수를 `§12.19` 에 숫자로 박제.
- [ ] **AC 5 — audit §12.19 절 신설**: `## 11. References` 바로 앞 (= `§12.18` 뒤) 에 `### 12.19 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변**). 구성은 `§12.17` · `§12.18` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 인용, (iii) **AC 2 후보 3 행 표 + 채택안 확정**, (iv) AC 3 반영 지점별 `§12.15` 방침 판정, (v) AC 4 수치 재검산 결과, (vi) [T-1420](../tasks/T-1420-uc09-module-component-mapping-verification.md) Follow-up 4 **closure 선언** (+ UC-09 cascade 4 축 [endpoint · entity · 표기 · module] 종결 상태 1 줄), (vii) 불변 검산 출력 블록, (viii) **한계 3 항 이상** — 최소: ① `§5` sequence 의 `AssessmentModule` participant **12 행** 은 본 slice 무편집이라 `§9` 와 어휘가 갈릴 수 있음 (별도 slice 후보), ② `INDEX.md` **25** 행 허용 목록 9 개가 `modules.md` 실측 **12** module 과 어긋나고 `8 NestJS module 명` 이라 적으면서 **9 개** 를 열거하는 자체 모순 (T-1420 Follow-up 5), ③ `modules.md` **192 · 44 · 205** 행 `11 module` vs 실측 **12** (T-1420 Follow-up 3) · `data-model.md` `13 entity` vs 실 row **14** (Follow-up 2) · `api.md` **223** 행 링크 범위 (Follow-up 1) 잔존.
- [ ] **AC 6 — 무편집 경계 + 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/use-cases/UC-09-user-defined-period-evaluation.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-08` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. 수치 불변 — audit `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12**, `wc -l` modules.md **256** · INDEX **123** (둘 다 무편집). UC-09 `§5` 구간 (55 ~ 100 행) 이 diff hunk 에 **미등장** 함을 `git diff -U0 -- docs/use-cases/UC-09-user-defined-period-evaluation.md | grep '^@@'` 로 제시. 합계 diff ≤ 300 LOC.
- [ ] **AC 7 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **UC-09 `§5` sequence (55 ~ 100 행) 의 `AssessmentModule` participant 12 행 편집** — mermaid diagram 이라 blast radius 가 크고 `§9` 와 성격이 다르다. 본 slice 는 `§9` 한정 (필요 시 Follow-up).
- **`docs/use-cases/INDEX.md` 편집 일체** — 25 행 허용 목록 · 39 행 UC-09 row 의 module 열은 T-1420 Follow-up 5 소관 (두 지점을 한 slice 에서 원자 처리해야 하므로 분리).
- **`docs/architecture/modules.md` · `components.md` 편집 일체** — 본 slice 의 **정본** 이라 read-only.
- **`modules.md` 192 · 44 · 205 행 `11 module` vs 실측 12 정정** — T-1420 Follow-up 3, 별도 slice.
- **`data-model.md` `13 entity` vs 실 row 14 정정** (Follow-up 2) · **`api.md` 223 행 링크 범위 정정** (Follow-up 1) — 각각 별도 slice.
- **새 module / component 신설 또는 module 책임 재배치 결정** — ADR 게이트. 본 slice 는 문서 표기 정합만.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§12.1` ~ `§12.18`) 본문 재편집.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
