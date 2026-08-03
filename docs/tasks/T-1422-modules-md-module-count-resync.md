---
id: T-1422
title: modules.md `11 module` 카운트 8 지점 실측 12 대조 판정 + 동기 + audit §12.20 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1421]
touchesFiles:
  - docs/architecture/modules.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1422-modules-md-module-count-resync.md
plannerNote: "uc-doc-audit-resync 34 번째 slice — T-1421 Follow-up 3 의 첫 조각. INDEX 정정(FU1)의 정본 선행 조건이라 순서를 앞당김. doc-only 1.6x"
---

# T-1422 — modules.md module 카운트 8 지점 실측 대조 + 동기

## Why

[T-1421](T-1421-uc09-module-attribution-correction.md) 의 **Follow-up 3** 중 `modules.md` 축을 닫는다. planner 는 T-1421 이 제시한 Follow-up 우선순위 (1 = `INDEX.md` 25 · 39 행 원자 정정) 를 **실측 후 재배치** 했다 — 근거는 **정본 선행 조건** 이다.

- `INDEX.md` **25** 행은 허용 module 명 목록의 출처를 "[modules.md](../architecture/modules.md) 의 8 NestJS module 명" 이라고 스스로 밝힌다. 즉 INDEX 는 `modules.md` 의 **파생** 문서다. 그런데 그 정본 `modules.md` 가 지금 **자기모순** 상태다 — `## Module 목록` 표는 row **12** 개 (32 ~ 43 행: AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / PermissionDeniedRecordModule / LlmModule / AssessmentModule / AssessmentCollectionModule / AssessmentEvaluationModule / SchedulerModule / WebModule) 인데 본문 산문은 **8 지점에서 `11 module`** 이라 적는다 (planner 실측: 22 · 28 · 45 · 133 · 154 · 192 · 205 · 249 행).
- 정본이 자기모순인 상태에서 파생 INDEX 를 고치면 "8 이라 쓰고 9 를 열거" 를 "11 이라 쓰고 12 를 열거" 로 옮겨 적는 셈이라 모순이 이월될 뿐이다. **정본 자기정합이 선행** 이어야 INDEX slice 가 인용할 확정 수치가 생긴다.
- 어느 쪽이 stale 인지의 방향도 planner 가 1 차 실측했다 — `## Acyclic 검증` 의 topological order 블록 (145 ~ 153 행) 이 module 을 **12 개 전수 열거** 한 뒤 154 행에서 "위 **11** module 모두 imports" 라 적는다. 같은 code block 안에서 열거 12 vs 산문 11 이 갈리므로 **표·열거 = 정본, 산문 카운트 = stale** 이 유력하다. 다만 본 slice 는 그 결론을 전제하지 않고 AC 1 에서 재측정한다.
- 선례도 있다 — [T-0295](T-0295-modules-md-evaluation-module-doc-sync.md) 가 11 번째 module 머지 시 `10 module` 표기 전 site 를 같은 방식으로 일괄 동기했다. 본 slice 는 12 번째 module 이 표에 들어온 뒤 누락된 같은 종류의 동기다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/modules.md` — **본 slice 의 유일한 정본 편집 대상**. 다음 구간만 읽는다.
  - **1 ~ 5 행** (front blockquote — 3 행의 `NestJS 8 module 분해` 는 T-0017 **시점 기록**. 편집 여부 판정 대상)
  - **20 ~ 46 행** (22 행 `모든 11 module` · 28 행 `11 NestJS module` · 30 ~ 43 행 표 = **정본 row 12** · 45 행 `위 11 module`)
  - **129 ~ 136 행** (다이어그램 표기 설명 — 133 행 `11 module 을 imports`)
  - **142 ~ 157 행** (topological order code block — 145 ~ 153 행 열거 vs 154 행 `위 11 module`)
  - **190 ~ 206 행** (component ↔ module mapping — 192 행 `본 문서의 11 module` · 205 행 `총 8 component → 11 module` + `Backend API component 의 1:6 분할` 파생 수치)
  - **245 ~ 252 행** (References — 249 행 `11 module 의 단일 process 결합`)
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1342 ~ 1419 행** (`### 12.19` — T-1421 판정 원문 + 화법 template + 한계 항, 특히 **1417 행** 이 본 slice 대상을 한계 3 으로 지목), **1002 ~ 1058 행** (`### 12.15` — append / in-place 처리 방침 정본), **1420 행** (`## 11. References` — `§12.20` 삽입 위치의 경계)
- `docs/use-cases/INDEX.md` — **25** 행 (파생 문서의 module 명 목록. **무편집, 읽기만** — 본 slice 가 확정한 수치를 후속 slice 가 쓴다)
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§12.20` 에 그대로 인용한다. 기대값과 **다르면 그 축의 판정을 중단** 하고 불성립 사실을 `§12.20` 에 기록한다.
  - (i) `sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"` = **12** (정본 표 row 수) — 12 개 module 명을 전수 나열.
  - (ii) `grep -n "11 module\|11 NestJS module" docs/architecture/modules.md` 가 **8 행** (22 · 28 · 45 · 133 · 154 · 192 · 205 · 249) 을 반환.
  - (iii) topological order 블록 (145 ~ 153 행) 이 열거하는 module **distinct 수** 를 세어 (i) 의 12 와 일치하는지 대조.
  - (iv) mermaid 다이어그램 (약 60 ~ 129 행) 의 module node distinct 수를 세어 (i) 과 일치하는지 대조 — **불일치면 그 사실을 한계로 기록** 하고 다이어그램 자체는 무편집 (Out of Scope).
  - (v) baseline — `wc -l` modules.md **256** · audit **1433** · INDEX **123**, modules.md `grep -c "^## "` **8**, audit `grep -c "^| REQ-"` **66** · `grep -c "^## "` **12**.
- [ ] **AC 2 — 지점별 처리 판정 (8 + 1 지점, 애매어 금지)**: AC 1 이 확정한 정본 수치를 기준으로 `11` 표기 **8 지점** + front blockquote **3 행** (`NestJS 8 module 분해`) 각각을 **1 행씩** 판정한 **9 행 표** 를 만든다. 열은 `행 / 현재 표기 / §12.15 판별 (stamp 있는 시점 기록 = append · 없는 living 서술 = in-place) / 처리 (치환 · 무편집) / 근거 1 구`.
  - **3 행** 은 `T-0017 이 … 8 module 분해` 라는 **과거 task 산출 시점 기록** 이므로 무편집이 예상 결론이나, 실측 후 다르면 근거를 쓴다.
  - **154 행** 은 code block 내부다 — 같은 block 의 열거와 어긋난 상태를 남기지 않는 방향으로 판정한다.
  - **205 행** 은 `총 8 component → 11 module` 과 `Backend API component 의 1:6 분할` 두 수치를 함께 담는다. `8 component` 는 [components.md](../architecture/components.md) 정본이라 **무편집**, `1:6 분할` 은 192 ~ 204 행 mapping 표의 Backend API row 실제 module 수를 세어 정합 여부를 별도 판정한다 (어긋나면 같은 slice 안에서 함께 갱신, 맞으면 불변 근거 1 구).
- [ ] **AC 3 — 판정 반영 (modules.md 한정)**: AC 2 가 `치환` 으로 판정한 지점만 **1 행 → 1 행 in-place** 로 반영한다. `무편집` 판정 지점은 diff 에 **미등장**. 표 row **12 불변** · 표 열 수 불변 · `^## ` heading **8 불변** · `wc -l` **256 불변** (1:1 치환이므로). mermaid block (약 60 ~ 129 행) 과 module 표 본문 (32 ~ 43 행) 은 **무편집**.
- [ ] **AC 4 — 파생 문서 영향 범위 명시 (편집은 금지)**: 본 slice 가 확정한 정본 수치가 어느 파생 지점을 stale 로 만드는지 **목록만** `§12.20` 에 남긴다 — 최소 [INDEX.md](../use-cases/INDEX.md) **25** 행 (`8 NestJS module 명` + 9 개 열거) · **39** 행 (UC-09 row module 열 6 값). 목록의 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 6 이 diff 부재로 검증).
- [ ] **AC 5 — audit §12.20 절 신설**: `## 11. References` 바로 앞 (= `§12.19` 뒤) 에 `### 12.20 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변**). 구성은 `§12.18` · `§12.19` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 5 축 인용, (iii) **AC 2 의 9 행 판정 표**, (iv) AC 3 반영 결과 + 불변 수치, (v) AC 4 파생 영향 목록, (vi) [T-1421](../tasks/T-1421-uc09-module-attribution-correction.md) Follow-up 3 의 **modules.md 축 closure 선언** (+ 잔여 축 `data-model.md` 38 행 `13 entity` · `api.md` 223 행 링크 범위 1 줄), (vii) 불변 검산 출력 블록, (viii) **한계 3 항 이상** — 최소: ① mermaid 다이어그램 node 수 축 (AC 1 (iv) 결과) 은 무편집이라 산문과 갈릴 수 있음, ② `INDEX.md` 25 · 39 행 파생 stale 잔존 (후속 slice), ③ UC-09 `§5` sequence participant 12 행 병기 여부 미판정 (T-1421 Follow-up 2) 잔존.
- [ ] **AC 6 — 무편집 경계 + 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/modules.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/architecture/components.md` · `api.md` · `data-model.md` · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. `git diff -U0 -- docs/architecture/modules.md | grep '^@@'` 로 hunk 목록을 제시해 mermaid block · 표 본문 구간이 없음을 보인다. 합계 diff ≤ 300 LOC · 파일 ≤ 5.
- [ ] **AC 7 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **[INDEX.md](../use-cases/INDEX.md) 25 · 39 행 편집 일체** — 본 slice 는 그 정본 수치를 확정할 뿐이다. 두 지점의 원자 정정은 후속 slice (T-1421 Follow-up 1 승계).
- **mermaid 다이어그램 (약 60 ~ 129 행) node 추가 / 수정** — node 누락이 실측되면 한계로 기록만. 다이어그램 편집은 blast radius 가 다르므로 별도 slice.
- **module 표 (32 ~ 43 행) 의 row 추가 · 삭제 · 책임 문구 수정** — 본 slice 는 표를 **정본으로 읽기만** 한다.
- **새 module 신설 · module 책임 재배치 · `AppModule` imports 변경** — ADR + 코드 게이트.
- **`data-model.md` 38 행 `13 entity` vs 실 row 14** · **`api.md` 223 행 링크 범위** 정정 (T-1421 Follow-up 3 의 잔여 2 축) — 각각 별도 slice.
- **UC-09 `§5` sequence participant 12 행 병기 판정** (T-1421 Follow-up 2) — 별도 slice.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§12.1` ~ `§12.19`) 본문 재편집.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append.)
