---
id: T-1420
title: UC-09 §9 의 5 component · 6 module mapping 을 modules.md · components.md 와 2 축 대조 실판정 + audit §12.18 기록
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1419]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1420-uc09-module-component-mapping-verification.md
plannerNote: "uc-doc-audit-resync 32 번째 slice — T-1419 Follow-up 1 (4 회 이월, 의존 최전방). UC-09 cascade 의 마지막 구조 축. doc-only 신설 절 1.6x"
---

# T-1420 — UC-09 §9 mapping 2 축 대조 실판정 + audit §12.18

## Why

[T-1419](T-1419-eight-uc-notation-bulk-resync.md) 의 **Follow-up 1** (= audit `§12.17` **한계 2**) 을 닫는다. 이 항목은 [T-1417](T-1417-audit-legacy-summary-forward-pointer.md) Follow-up 3 → [T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) Follow-up 2 → T-1419 Follow-up 1 로 **4 회 이월** 된 stream 의 의존 최전방이며, UC-09 신설이 architecture 문서에 남긴 **마지막 구조 축** 이다 (endpoint 축 = T-1416 · entity 축 = T-1418 · 표기 축 = T-1419 로 이미 closure).

- [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§9` 는 "본 UC 가 거치는 **5 component + 6 module**" 을 표로 못 박고, 그 서두가 "명칭은 [INDEX.md](../use-cases/INDEX.md) 19 ~ 25 행이 허용한 목록만 사용한다" 고 **스스로 검증 가능한 주장** 을 건다. 그런데 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) 두 문서는 UC-09 를 알지 못한다 — planner 실측상 `grep "use-cases"` hit 이 두 문서 모두 **0** 이고 UC 참조는 modules.md 42 행 1 곳뿐이다. 즉 두 문서는 UC 축이 아니라 **REQ / ADR 축** 으로 조직돼 있다.
- 그러므로 본 slice 가 할 일은 row 신설이 아니라 **대조 판정** 이다 — (축 A) UC-09 `§9` 가 호명하는 component 5 · module 6 개 명칭이 두 문서의 정본 목록 안에 전건 실재하는가, (축 B) UC-09 `§9` 의 component ↔ module **조합** 이 modules.md `## Components ↔ Modules mapping` 표와 어긋나지 않는가. [T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) 이 entity 축에서 `신규 0` 을 판정한 것과 정확히 동형의 절차다.
- 축 B 는 실제로 어긋남 후보를 안고 있다 — UC-09 `§9` 는 Worker 행의 module 을 `AssessmentModule (period bridge + orchestrator)` 로 적는데 modules.md 는 Worker 를 `AssessmentCollectionModule + AssessmentEvaluationModule` 로 적는다. 판정 없이 어느 쪽을 고치면 날조가 되므로, 본 slice 는 **판정과 기록까지만** 하고 두 architecture 문서는 무편집으로 남긴다 (AC 6).

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — **129 ~ 143 행** (`## 9. Component / Module mapping` — 표 6 행 + 서두 "5 component + 6 module" + 말미 GithubModule / ConfluenceModule / SchedulerModule 제외 근거 문단). 본 slice 의 **판정 대상 원본**
- `docs/architecture/modules.md` — **26 ~ 46 행** (`## Module 목록` — module row **12** 가 정본 목록), **190 ~ 229 행** (`## Components ↔ Modules mapping` — row **8**, 축 B 의 대조 상대), **192 행** (`8 component 와 본 문서의 11 module` 서술 — AC 5 한계 항 입력)
- `docs/architecture/components.md` — **109 ~ 121 행** (`## Component table` — component row **8** 이 정본 목록, 축 A 의 대조 상대)
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1139 ~ 1244 행** (`### 12.17` — 화법 template + 한계 2 ~ 4 = 본 slice 의 진입 근거), **1002 ~ 1058 행** (`### 12.15` — 처리 방침 정본), **1245 ~ 1256 행** (`## 11. References` — §12.18 삽입 위치의 경계)
- `docs/use-cases/INDEX.md` — **19 ~ 25 행** (UC-09 §9 서두가 "허용 목록" 으로 인용한 column 정의 — 축 A 판정의 보조 입력이자 AC 5 한계 항 입력)
- `CLAUDE.md` §3 (task 크기 상한) · §12 (언어 정책)

## Acceptance Criteria

- [x] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§12.18` 에 그대로 인용한다. (i) UC-09 `§9` 표의 component 열 **5 값** 과 module 열 **6 module 명** 전수 (표 행은 6 이고 `—` 행 1 개가 component 를 갖지 않음 — 이 비대칭 자체를 기록), (ii) `sed -n '26,46p' docs/architecture/modules.md | grep -c "^| \*\*"` = **12** 와 그 module 명 전수 · `sed -n '190,229p' docs/architecture/modules.md | grep -c "^| \*\*"` = **8**, (iii) `sed -n '109,121p' docs/architecture/components.md | grep -c "^| \*\*"` = **8** 과 component 명 전수, (iv) 두 문서의 UC 축 부재 실측 — `grep -c "use-cases" docs/architecture/modules.md` = **0** · 같은 명령 components.md = **0** · `grep -c "UC-0" docs/architecture/modules.md` = **1** (42 행) · components.md = **0**, (v) baseline — `wc -l` modules.md **256** · components.md **190** · audit **1256**, audit `grep -c "^| REQ-"` **66** · `grep -c "^## "` **12**. **기대값과 다르면 그 축의 판정을 중단하고 `§12.18` 에 불성립 사실을 기록** 한다.
- [x] **AC 2 — 축 A (명칭 실재) 대조표**: UC-09 `§9` 의 **component 5** (`Web UI` · `Backend API` · `Worker (평가 파이프라인)` · `LLM Gateway` · `DB Persistence`) 가 components.md `## Component table` **8 row** 안에, **module 6** (`WebModule` · `AssessmentModule` · `AuthModule` · `UserModule` · `LlmModule` · `PersistenceModule`) 이 modules.md `## Module 목록` **12 row** 안에 실재하는지를 **11 행 표** 로 판정한다. 각 행에 `실재 (행 N)` / `미실재` 중 하나와 근거 행 번호를 붙인다. 애매어 금지. **미실재가 1 건이라도 나오면** 새 module / component 신설 여부는 본 slice 가 결정하지 않고 (ADR 게이트) 사실만 기록한 뒤 Follow-up 으로 지목한다.
- [x] **AC 3 — 축 B (조합 정합) 대조표**: UC-09 `§9` 표 **6 행** 각각의 component ↔ module 조합을 modules.md `## Components ↔ Modules mapping` **8 행** 과 대조해 `일치` / `부분 일치` / `어긋남` 중 하나로 확정하고 근거 1 구를 붙인 **6 행 표** 를 만든다. 최소 다음 3 축을 명시 판정한다 — (a) **Worker** — UC-09 `AssessmentModule (period bridge + orchestrator)` vs modules.md `AssessmentCollectionModule + AssessmentEvaluationModule`, (b) **Backend API** — UC-09 `AssessmentModule (controller layer) + AuthModule` vs modules.md 6 module 열거 (UC-09 가 부분집합인지), (c) **Web UI / LLM Gateway / DB Persistence** 1:1 축 3 행. UC-09 표의 `—` component 행 (`UserModule`) 은 modules.md 상 어느 component 에 귀속되는지도 함께 판정한다.
- [x] **AC 4 — 판정 결론 1 문장**: 축 A · 축 B 결과를 근거로 "UC-09 신설이 `modules.md` / `components.md` 에 요구하는 **갱신 = 있음 / 없음**" 을 한 문장으로 확정하고, AC 1 (iv) 의 "두 문서에 UC 축 서술 0" 실측을 근거로 인용한다. 결론이 `있음` 이어도 본 slice 는 두 문서를 **편집하지 않고** (AC 6) 갱신 대상 행 번호 · 어느 문서 쪽을 정본으로 볼지의 **후보** 만 `§12.18` 에 박제한 뒤 Follow-up 으로 넘긴다.
- [x] **AC 5 — audit §12.18 절 신설**: `## 11. References` 바로 앞 (= `§12.17` 한계 4 뒤) 에 `### 12.18 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변**). 구성은 `§12.16` · `§12.17` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 인용, (iii) **AC 2 축 A 표 11 행**, (iv) **AC 3 축 B 표 6 행**, (v) AC 4 결론 1 문장, (vi) [T-1419](../tasks/T-1419-eight-uc-notation-bulk-resync.md) Follow-up 1 **closure 선언** (T-1417 FU3 → T-1418 FU2 → T-1419 FU1 **4 회 이월** 종결 + `§12.17` 한계 2 소진 + UC-09 cascade 4 축 [endpoint · entity · 표기 · module] 전건 종결 여부 1 줄), (vii) 불변 검산 출력 블록, (viii) **한계 3 항 이상** — 최소: ① modules.md **192 행** `8 component 와 본 문서의 11 module` 이 AC 1 (ii) 실측 **12 module** 과 어긋나나 UC-09 와 무관한 **선행 불일치** 라 무편집, ② `INDEX.md` 19 ~ 25 행의 `UC-01 ~ UC-08 의 8 개` · `8 component` · `8 NestJS module` 은 날짜 없는 column 정의지만 본 slice 범위 밖이라 무편집, ③ `§12.17` 한계 3 (`data-model.md` 38 행 `13 entity` vs 실 row **14**) · 한계 4 (`api.md` 223 행 링크 범위) 잔존.
- [x] **AC 6 — 무편집 경계 + 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 2 개** (`docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · `docs/use-cases/UC-01` ~ `UC-09` 본문 · `INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. 수치 불변 — audit `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12**, modules.md `wc -l` = **256** · components.md `wc -l` = **190** (둘 다 무편집). 본 slice 는 순수 append 라 **삭제 라인 0** 임을 `git diff --numstat` · `git diff -U0 | grep '^@@'` 로 제시. 합계 diff ≤ 300 LOC.
- [x] **AC 7 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`docs/architecture/modules.md` · `components.md` 편집 일체** — 본 slice 는 대조 **판정과 기록** 만 한다. 축 B 어긋남이 확정돼도 어느 쪽을 정본으로 볼지는 후속 slice (필요 시 ADR) 소관.
- **`docs/use-cases/UC-09-user-defined-period-evaluation.md` 본문 편집** — 판정 대상 원본이라 read-only.
- **`docs/use-cases/INDEX.md` 19 ~ 25 행 column 정의 (`8 개` · `8 component` · `8 NestJS module`) 갱신** — 별도 slice (`§12.18` 한계 항에 사실 기록만).
- **`api.md` 223 행 링크 범위 정정** — T-1419 Follow-up 3, 별도 slice.
- **`data-model.md` 38 행 `13 entity` vs 실 row 수 14 정정** — T-1419 Follow-up 2, 별도 slice.
- **새 module / component 신설 결정** — modules.md 정본 목록에 없는 이름이 UC-09 에서 발견돼도 신설은 ADR 게이트 (본 slice 는 escalate 후보 지목까지).
- 66 REQ 전수 재audit · 분류 재판정 · audit 본문의 기존 `8 UC` 34 hit 재편집.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **`api.md` 223 행 링크 범위 (`UC-01 … ~ UC-08-permission-denied.md — 본 문서의 endpoint source`) 정정** — T-1419 Follow-up 3 이월 (2 회). `data-model.md` 181 행 · audit `§11` 2 줄이 이미 9 UC 로 동기된 것과 동형 (in-place) 처리가 유력.
2. **`data-model.md` 38 행 · 18 행 · 3 행의 `13 entity` vs `§2` 표 실 row 수 **14** 의 1 어긋남 정정** — T-1419 Follow-up 2 이월 (2 회). 누계 서술 (`10 → 11` · `11 → 13`) 이 `PermissionDeniedRecord` 를 빠뜨린 것으로 보이며 UC-09 와 무관한 선행 불일치다.
3. **`modules.md` 192 행 `8 component 와 본 문서의 11 module` vs 실측 module row **12** 의 1 어긋남 정정** — 본 slice AC 1 (ii) 실측으로 확정 (44 행 · 205 행에도 같은 어긋남 반복). Follow-up 2 와 동형의 수치 drift.
4. **UC-09 `§9` **137 행** (Worker) · **136 행** (Backend API) 의 module 귀속 정정** — 본 slice 축 B 가 확정한 어긋남 1 · 부분 일치 1. 정본은 `modules.md` 198 · 197 행 (shipped 코드 + [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) / [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 근거) 이고 UC-09 본문이 정정 대상이다 — 본 slice 는 UC-09 를 read-only 로 두었다 (Out of Scope).
5. **`INDEX.md` 19 ~ 25 행 column 정의 정정** — 19 행 `UC-01 ~ UC-08 의 8 개` 가 실 9 UC 와 어긋나고, 25 행 `8 NestJS module 명` 은 괄호 안에 이름을 **9 개** 열거하면서 수치는 `8` 이라 자체 모순 (정본 `modules.md` 12 와도 어긋남).

## 완료 기록

- **판정 결과** — 축 A 명칭 실재 **11/11** (미실재 0), 축 B 조합 정합 **일치 3 · 부분 일치 2 · 어긋남 1**. 결론: UC-09 신설이 `modules.md` / `components.md` 에 요구하는 갱신은 **없음** (두 문서는 UC 축 서술 0 · REQ / ADR 축 조직). 어긋남 방향은 UC-09 `§9` 쪽이며 Follow-up 4 로 넘겼다.
- **산출물** — [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.18` 순수 append. 두 architecture 문서 · UC-09 본문 · `INDEX.md` 무편집 (AC 6 경계 준수).
- **AC 7 (R-110 / R-112 면제)** — `commitMode: direct` doc-only · production code **0 LOC** · 분기 0 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 면제 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A**.
