---
id: T-1432
title: directory.md `Top-level 디렉토리 트리` ASCII 블록 (21 ~ 50 행) 의 `src/` 하위 11 항목을 실 `src/` 트리와 3 축 대조 후 처리 판정 + audit §12.30
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1431]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1432-directory-md-ascii-tree-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 44 번째 slice — T-1431 파생 영향 7 (directory.md ASCII tree ↔ 실 src/ 정합) 실행. doc-only 1.6x"
---

# T-1432 — directory.md ASCII 트리 블록 ↔ 실 `src/` 트리 3 축 대조 + 처리 판정

## Why

[T-1430](T-1430-directory-md-module-coordinate-resync.md) 은 [directory.md](../architecture/directory.md) 의 **`## 9 module 별 디렉토리 mapping` 표** (81 ~ 100 행) 축만 닫았다 — 표 9 row ↔ 실 shipped 14 의 3 축 대조 각주 1 블록을 붙였고, 그 잔여로 "**ASCII tree ↔ 실 `src/` 트리 정합**" 을 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.28` 파생 영향에 남겼다. [T-1431](T-1431-timepoint-artifact-module-pointer-judgment.md) 이 `§ 12.29` **파생 영향 7** 로 그것을 다시 이월했고, 같은 절의 closure 선언이 "정본을 **현재형으로 가리키는 파생 pointer 축** 은 닫혔다" 고 못박아 module 어휘 축은 종료됐다. 즉 본 stream 에서 **directory.md 안에 남은 미판정 축은 ASCII 트리 블록 하나** 다. 본 slice 가 그 마지막 잔여를 실행한다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 트리 블록 (**21 ~ 50 행**) 은 `src/` 직접 하위로 디렉토리 **11 개** (`auth` / `persistence` / `user` / `github` / `confluence` / `llm` / `assessment` / `scheduler` / `web` / `common` / `config`) + 파일 2 개 (`main.ts` / `app.module.ts`) 를 열거하는데, 실 `src/` 하위 디렉토리는 **15** 다. 표 축에서 T-1430 이 실측한 것과 **동형의 3 축 차집합** (양쪽 실재 / 트리 전용 / 실재 전용) 이 트리 축에도 성립하며, 특히 `src/config/` 는 표 축에 없던 **트리 전용 항목** 이라 T-1430 각주로는 덮이지 않는다.

동시에 본 블록은 **19 행 · 52 행** 이 각각 "본 task 시점에는 … skeleton 만 존재 — 9 module 디렉토리는 P3+ 에서 생성되는 **blueprint**", "본 시점 (**T-0021**) 의 `src/` 실제 내용은 … 9 module 디렉토리는 모두 미생성" 으로 스스로를 **시점 blueprint** 라 규정한다. 이는 [T-1417](T-1417-audit-legacy-summary-forward-pointer.md) 이 `§ 12.15` 로 명문화한 "시점 기록 = append-only" 축이자 T-1431 이 freeze 문서군에서 적용한 판정 축이라, 본 slice 는 **코드블록 안 blueprint 를 in-place 로 고칠 것인가, 원문 보존 + 실측 각주로 닫을 것인가** 를 정면 판정한다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가라 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **184 행**. 다음 구간만 읽는다.
  - **17 ~ 53 행** (`## Top-level 디렉토리 트리` heading + **19** 행 시점 blueprint 선언 산문 + **21 ~ 50** 행 ASCII 코드블록 + **52** 행 시점 skeleton 산문) — 본 slice 의 유일한 편집 후보 구간.
  - **81 ~ 100 행** (`## 9 module 별 디렉토리 mapping` 표 + **T-1430 이 붙인 3 축 대조 각주 blockquote 2 행**) — **무편집**, 각주 화법 template + 이미 닫힌 축 경계 확인용.
  - **102 ~ 137 행** (`## common/ shared utilities` · `## config/` · `## prisma/`) — **무편집**, `src/config/` 항목이 트리 전용인지 판정할 때 문서 내 상호 참조 근거로만 인용.
  - **169 ~ 184 행** (`## References` + `Refs:` 말미) — **무편집** 경계 확인용.
- `docs/architecture/modules.md` — **무편집, 읽기만**. **28** 행 (정본 `12 NestJS module`) · **32 ~ 43** 행 (정본 표 row 12) · **47 ~ 48** 행 (T-1425 미기재 3 각주 + 카운트 경계). `AssessmentModule` (미shipped placeholder) · `SchedulerModule` (실 shipped 명 `SchedulingModule`) 두 row 문장이 AC 2 판정 근거라 그대로 인용.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.15`** (**1002** 행 — 시점 기록 append-only / living document in-place 처리 방침 정본) · **`### 12.28`** (**2505** 행 — T-1430 의 표 축 3 축 대조 + 각주 채택 화법 template) · **`### 12.29`** (**2688** 행 — 파생 영향 **7** 이 본 slice 위임 원문 + closure 선언) · **`## 11. References` (2809 행)** — `§ 12.30` 삽입 위치 경계.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.30` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.30` 에 기록한다.
  - (i) **트리 축 전수**: `sed -n '21,50p' docs/architecture/directory.md` 로 블록 원문을 인용하고, `src/` 직접 하위 항목을 **디렉토리 11** (`auth` · `persistence` · `user` · `github` · `confluence` · `llm` · `assessment` · `scheduler` · `web` · `common` · `config`) + **파일 2** (`main.ts` · `app.module.ts`) 로 전수 열거한다.
  - (ii) **코드 축 전수**: `ls -d src/*/ | sed 's#src/##;s#/##'` 출력을 인용한다. 기대 — **15** (`assessment-collection` · `assessment-evaluation` · `auth` · `common` · `confluence` · `export` · `github` · `import` · `llm` · `permission-denied` · `persistence` · `scheduling` · `user` · `user-instance-access` · `web`). 추가로 `ls src/*/*.module.ts | wc -l` = **14** · `ls src/*.ts | head -20` (skeleton 파일 실재 확인 — `main.ts` · `app.module.ts` 외 `bootstrap.ts` · `parse-port.ts` 등이 트리 미기재임을 함께 인용).
  - (iii) **3 축 차집합**: (i) ∩ (ii) = **양쪽 실재 8** (`auth` · `common` · `confluence` · `github` · `llm` · `persistence` · `user` · `web`) · **트리 전용 (경로 미실재) 3** (`assessment` · `scheduler` · `config`) · **실재 전용 (트리 미기재) 7** (`assessment-collection` · `assessment-evaluation` · `export` · `import` · `permission-denied` · `scheduling` · `user-instance-access`) 로 전수 이분한다. **양변 검산 2 식** 명시 — `11 = 8 + 3` · `15 = 8 + 7`. 트리 전용 3 각각에 대해 정본 [modules.md](../architecture/modules.md) 근거 1 구 (`assessment` = 미shipped placeholder · `scheduler` = 실 shipped 명 `scheduling` · `config` = 정본 표 밖 = **module 아님**, `## config/` 단락이 서술하는 loader 위치라 성격이 다름을 반드시 구분).
  - (iv) **시점 marker 축**: `sed -n '3p;19p;52p' docs/architecture/directory.md` 원문 인용 — 세 지점이 본 문서 / 본 블록을 **T-0021 시점 blueprint** 로 규정하는 문장임을 확인한다. 이 셋은 판정의 최강 제약이자 **무편집 대상** 이다.
  - (v) **top-level 축 (보조)**: `git ls-files | cut -d/ -f1 | sort -u` 출력을 인용해 트리가 열거한 root 항목 (`src` · `prisma` · `test` · `web` · `docs` · `.github/workflows` · `package.json` · `README.md` / `CLAUDE.md`) 대비 **트리 미기재 tracked root 항목** 을 전수 열거한다 (기대 — `scripts` 등 1 개 이상). 본 축은 AC 2 판정 대상에 포함하되 편집 여부는 AC 3 채택안을 따른다.
  - (vi) baseline — `wc -l` directory.md **184** · audit **2822** · modules.md **259**, `grep -c '^## '` directory.md **10** · audit **12**, audit `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 지점 판정표**: AC 1 (iii) 의 **트리 전용 3** + **실재 전용 7** + AC 1 (v) 의 **트리 미기재 root 항목** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` 중 하나를 판정한 표를 만든다. 각 row 는 **항목 · 축 (src 하위 / root) · 트리 서술 또는 부재 1 구 · 실재 여부 · 판정 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **블록 성격** (코드블록 안 blueprint 를 고치면 19 · 52 행의 시점 선언과 자기모순이 생기는가), ② `§ 12.15` **정합** (시점 기록 append-only 축에 본 블록이 해당하는가), ③ **선례** (T-1430 이 같은 문서의 표 축에서 채택한 "원문 보존 + 실측 각주 blockquote" 화법이 트리 축에도 그대로 적용 가능한가).
  - **`config` 는 별도 1 구** — 나머지 트리 전용 2 (`assessment` · `scheduler`) 가 **module 축** 인 반면 `config` 는 정본 표 밖 항목이라, 같은 "미실재" 라도 근거가 다름을 구분한다 (`## config/` 단락 102 ~ 125 행이 서술하는 loader 가 실제로 어디에 있는지 `ls src/config* src/common/config* 2>/dev/null` 로 1 회 실측해 인용).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **ASCII 블록 in-place 재작성** (실 15 디렉토리로 전면 교체), (B) **블록 원문 무편집 + 블록 직후 (50 행 뒤) 3 축 대조 각주 blockquote 1 개 부기** (T-1430 표 축 선례 확대 적용), (C) **혼합** (트리 전용 3 만 주석 병기 + 실재 전용 7 은 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② 독자 오도 risk (블록을 그대로 두면 독자가 `src/assessment/` · `src/scheduler/` · `src/config/` 가 실재한다고 오인하는가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.30` 에 기록), ④ 선례 일관성 (같은 문서 표 축의 T-1430 각주 화법 vs T-1431 이 References pointer 에 적용한 in-place 화법 중 **코드블록 blueprint** 성격에 맞는 쪽).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **directory.md 편집은 블록 직후 각주 blockquote 1 개 (≤ 4 행) 또는 산문 1 ~ 2 행 이내** — `wc -l` 증가 **+6 이내**.
  - **ASCII 코드블록 (21 ~ 50 행) 내부는 AC 3 이 (A) 또는 (C) 를 채택한 경우에만 편집** 하며, 그 경우에도 3 축 차집합 실측으로 확인된 항목만 손댄다 (창작 금지 — 각 디렉토리의 `←` 설명 문구는 실측 없이 신설하지 않는다).
  - **3 · 19 · 52 행 시점 선언 무편집** · **81 ~ 100 행 표 + T-1430 각주 무편집** · **102 행 이후 전 구간 무편집** · `Refs:` 말미 무편집.
- [ ] **AC 5 — audit §12.30 절 신설**: `## 11. References` (**2809** 행) 바로 앞 (= `§ 12.29` 뒤) 에 `### 12.30 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). **본 절 ≤ 120 행** (cap 보호). 구성은 `§ 12.28` · `§ 12.29` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.29` **파생 영향 7** 의 위임을 실행하며 T-1422 → … → T-1431 계보에서 **directory.md 의 마지막 미판정 축** 임을 규정), (ii) AC 1 실측 6 항 인용 (3 축 차집합 + 양변 검산 2 식 포함), (iii) AC 2 판정표, (iv) AC 3 4 후보 판정표 + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점 근거), (vi) 무편집 경계, (vii) 파생 영향 목록 (AC 7), (viii) **closure 선언** (directory.md 축이 표 · pointer · 트리 3 면에서 모두 닫혔는지 — 닫히지 않았다면 잔여를 명시), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 대조는 **디렉토리 이름 축** 이라 각 디렉토리 내부 파일 구성 (`dto/` · `repositories/` 등 표준 sub-structure 단락 54 ~ 79 행) 이 실제와 맞는지는 미검증, ② blueprint 문서가 코드를 복제하는 구조 자체는 잔존해 `src/` 에 디렉토리가 하나 추가되면 즉시 재-stale (CI drift-guard 축으로만 닫힘), ③ 판정상 보존된 항목은 독자가 여전히 미실재 경로를 만난다.
- [ ] **AC 6 — 불변 검산**: `git status --porcelain` 변경 파일이 **최대 3 개** (`directory.md` · `REQ-COVERAGE-AUDIT.md` + 본 task 파일 — AC 3 채택안이 (D) 면 directory.md 가 빠져 2 개). 불변 — audit `^## ` **12** · `^| REQ-` **66**, directory.md `^## ` **10**, `modules.md` `wc -l` **259** 무편집. `git diff -U0 -- docs/architecture/directory.md` 의 `^@@` hunk 목록을 제시해 AC 4 허용 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). `git status --porcelain src/ test/ prisma/ web/` 이 **빈 출력** 임을 인용. 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 7 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.30` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 (**14 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트), ③ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약, ④ 행 번호 좌표계 → anchor 좌표계 이행 (**8 회째**), ⑤ 산문 tally ↔ 표 row 수 / 트리 항목 수 CI drift-guard spec, ⑥ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리, ⑦ directory.md `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 79 행) 의 sub-dir 채택 module 열거 ↔ 실 `src/*/` 하위 실측 대조 (**본 slice 신규 잔여**), ⑧ [components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 여부 (T-1431 잔여). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다**.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` 디렉토리 rename · 신설 · 삭제 일체** — 문서를 코드에 맞추는 slice 이지 그 역이 아니다. `src/assessment/` · `src/scheduler/` · `src/config/` 를 실제로 만드는 것은 절대 금지.
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 7 ②).
- **directory.md 의 `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 79 행) · `## 9 module 별 디렉토리 mapping` 표와 T-1430 각주 (81 ~ 100 행) · `## common/` 이후 전 구간 (102 ~ 184 행)** — 전부 무편집 (AC 7 ⑦ 로 이월).
- **시점 선언 3 지점 (directory.md 3 · 19 · 52 행) 편집** — `§ 12.15` 상 보존.
- **[components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · `docs/requirements.md`** — 전부 무편집, diff 에 미등장.
- **`test/` · `prisma/` · `web/` · `scripts/` 일체** 및 66 REQ 전수 재audit · audit 기존 절 (`§ 12.1` ~ `§ 12.29`) 본문 재편집.
- `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
