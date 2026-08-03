---
id: T-1430
title: directory.md 의 `9 module` 좌표 8 지점 + §"9 module 별 디렉토리 mapping" 표 9 row 를 정본 12 module / `src/` 실 shipped 14 디렉토리와 3 축 대조 후 처리 판정 반영 + audit §12.28
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1429]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1430-directory-md-module-coordinate-resync.md
plannerNote: "uc-doc-audit-resync 42 번째 slice — T-1429 의 파생 3 문서 closure 가 놓친 4 번째 파생 문서 directory.md 좌표계 3 축 대조. doc-only 1.6x"
---

# T-1430 — directory.md `9 module` 좌표계 stale 전수 확정 + 3 축 대조 후 처리 판정

## Why

[T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 는 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.27` 에서 "정본 [modules.md](../architecture/modules.md) 의 **파생 3 문서** ([INDEX.md](../use-cases/INDEX.md) T-1423 · [data-model.md](../architecture/data-model.md) T-1426 · [api.md](../architecture/api.md) T-1429) module 어휘 축 **일괄 closure**" 를 선언했다. planner 사전 실측 결과 그 closure 는 **부분 closure** 다 — 정본을 자기 source 로 명시하는 **네 번째 파생 문서** [directory.md](../architecture/directory.md) 가 closure 집합에서 빠져 있고, 그 문서는 아직 [T-0021](T-0021-p2-directory-structure.md) 시점의 **`9 module` 좌표계** 에 통째로 머물러 있다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — `grep -n '9 module\|9 NestJS module' docs/architecture/directory.md` 는 **3 · 7 · 19 · 25 · 52 · 81 · 83 · 168** 여덟 행이다. 그중 **7** 행은 "`modules.md` (T-A4) 가 박제한 9 NestJS module (8 application module + PersistenceModule) 을 그대로 … 1:1 mapping 한 single source of truth" 라는 **현재형 파생 서술** 이라 정본 12 ([T-1422](T-1422-modules-md-module-count-resync.md) 확정) 와 정면으로 어긋나고, **81** 행은 `## 9 module 별 디렉토리 mapping` 이라는 **heading 안의 카운트**, **168** 행은 References 의 파생 pointer 다. 반면 **3 · 19 · 52** 행은 `T-0021` · "본 task 시점" · "본 시점 (T-0021)" 라는 **시점 기록 marker** 를 명시적으로 보유하고, **25** 행은 ASCII tree **코드블록 내부** 다 — 즉 여덟 지점이 `§ 12.15` 처리 방침상 **서로 다른 판정** 을 받아야 하는 혼합 집합이다.

추가로 `§ "9 module 별 디렉토리 mapping"` 표 (**85 ~ 95** 행 부근, row **9**) 는 각 module 의 디렉토리 경로를 1:1 로 못박는데, 그중 **2 row 의 경로가 실재하지 않는다** — `src/assessment/` (미생성 — 정본 39 행이 `AssessmentModule` 을 **미shipped placeholder** 로 이미 규정) 와 `src/scheduler/` (실체는 `src/scheduling/` — 정본 `SchedulerModule` row 가 "**실 shipped module 명 = `SchedulingModule` (src/scheduling/)**" 를 이미 박제). 반대로 `src/*/*.module.ts` 실측 **14** 중 **7** 이 표에 미기재다. 두 축 모두 **정본이 이미 대체값·근거를 공급** 하므로 본 slice 가 판정으로 닫을 수 있다 — 이는 [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 정본 표에서 수행한 **3 축 대조 + (B) 표 직후 각주** 선례와 동형이다.

본 slice 는 **문서 축의 좌표 정합** 이지 코드 이동이 아니다 — `src/scheduling/` 을 `src/scheduler/` 로 rename 하거나 `src/assessment/` 를 신설하는 코드 변경은 **절대 하지 않는다** (Out of Scope 1). [PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가라 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **본 slice 의 유일한 편집 대상 문서** (181 행). 다음 구간만 읽는다.
  - **1 ~ 16 행** (frontmatter blockquote **3** 행 + `## 개요` **7** 행 — 편집 후보 2 지점 + 시점 marker 판별 재료).
  - **17 ~ 53 행** (`## Top-level 디렉토리 트리` — **19** 행 산문 · **25** 행 tree 주석 · **52** 행 시점 서술. 코드블록 경계 확인용).
  - **81 ~ 97 행** (`## 9 module 별 디렉토리 mapping` heading **81** · 도입 산문 **83** · 표 row 9 · 표 뒤 산문 **97**). 각 row 의 **디렉토리 경로 컬럼** 이 축 대조의 입력.
  - **166 ~ 181 행** (`## References` — **168** 행 파생 pointer + `Refs:` 말미).
  - **54 ~ 80 행** · **99 ~ 165 행** — **무편집, 경계 확인용으로만** (sub-structure / common / config / prisma / test / web 절).
- `docs/architecture/modules.md` — **무편집, 읽기만**. **28 행** (`다음 12 NestJS module 로 분해된다`) · **32 ~ 43 행** (정본 표 row 12 — 12 module 명 철자) · **45 행** · **47 ~ 48 행** (T-1425 미기재 3 각주 + 그 **계상 경계** — 각주 3 개는 12 카운트에 미포함). 특히 표 안의 **`AssessmentModule` row** (미shipped placeholder 규정) 와 **`SchedulerModule` row** (실 shipped 명 `SchedulingModule`, `src/scheduling/`) 두 문장은 AC 2 축 판정의 **근거 원문** 이라 그대로 인용한다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.23`** (T-1425 의 3 축 대조 + (B) 각주 채택 — 본 slice 가 승계할 화법 template) · **`### 12.27`** (**2340** 행 — T-1429 의 "파생 3 문서 일괄 closure" 선언 **원문**. 본 slice 가 이를 **부분 closure 였다** 고 정정할 때 인용할 대상) · **`## 11. References` (2505 행)** — `§ 12.28` 삽입 위치의 경계.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.28` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.28` 에 기록한다.
  - (i) **문서 축 전수**: `grep -n '9 module\|9 NestJS module' docs/architecture/directory.md` (기대 **3 · 7 · 19 · 25 · 52 · 81 · 83 · 168** 8 행). 각 행을 **1 구 인용** 하고, 7 행의 괄호 부연 (`8 application module + PersistenceModule`) 이 **8 + 1 = 9** 라는 자기-검산을 갖는다는 사실도 적는다 (카운트만 바꾸면 부연과 자기모순 — AC 3 의 별도 판정 입력).
  - (ii) **표 축**: 표 구간을 `sed -n '85,95p' docs/architecture/directory.md | grep -c '^| \*\*'` 로 row 수 (기대 **9**) 를 세고, 같은 구간에서 **module 명 ↔ 디렉토리 경로** 쌍 9 개를 전수 추출한다.
  - (iii) **코드 축**: `ls src/*/*.module.ts` (기대 **14** — `src/app.module.ts` 는 root composition 이라 제외) 로 실 shipped module 파일을, `ls -d src/*/` 로 디렉토리를 각각 뽑는다. `ls -d src/assessment/ src/scheduler/` 가 **부재** 임을 (exit code 포함) 인용한다.
  - (iv) **정본 축**: `sed -n '28p;45p;47,48p' docs/architecture/modules.md` + 표 안 `AssessmentModule` · `SchedulerModule` 두 row 의 **해당 문장** 을 원문 인용 — 정본이 12 이고, 각주 3 module 이 카운트 밖이며, 두 module 의 shipped 상태를 정본이 이미 규정한다는 세 사실이 본 slice 의 대체값 근거임을 명시.
  - (v) **`§ 12.15` 판별표**: 편집 후보 8 지점 각각에 **시점 marker 유무** 를 근거로 `in-place 동기` / `원문 보존 + 부기` / `무편집` 을 판정한 표를 만든다. 최소 — **3 · 19 · 52** 행은 `T-0021` · "본 task 시점" · "본 시점 (T-0021)" marker 보유 (→ in-place 치환 금지), **25** 행은 ASCII tree **코드블록 내부** (→ 편집 시 tree 정렬 파손 risk 를 1 구로 평가), **7 · 81 · 83 · 168** 행은 marker 부재 현재형 서술. 각 판정에 근거 1 구 (애매어 금지).
  - (vi) baseline — `wc -l` directory.md **181** · audit **2518** · modules.md **259** · api.md **230** · data-model.md **193** · INDEX.md **123** · components.md **190**, directory.md `grep -c '^## '` **10**, audit `grep -c '^## '` **12** · `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 3 축 대조표**: AC 1 (ii) (iii) 를 **한 표** 로 합쳐 표 row 9 와 실 dir 14 를 다음 3 구획으로 전수 분류한다.
  - **① 일치** (표의 디렉토리 경로가 실재 — 기대 **7**: `auth` / `persistence` / `user` / `github` / `confluence` / `llm` / `web`).
  - **② 문서 only** (표에 있으나 경로 미실재 — 기대 **2**: `AssessmentModule` → `src/assessment/` · `SchedulerModule` → `src/scheduler/`). 각각 **정본이 공급하는 설명** 을 1 구로 (placeholder / 실 명 `SchedulingModule`).
  - **③ 코드 only** (실재하나 표 미기재 — 기대 **7**: `assessment-collection` / `assessment-evaluation` / `export` / `import` / `permission-denied` / `scheduling` / `user-instance-access`).
  - **양변 검산** 을 명시 — `9 = 7 + 2` · `14 = 7 + 7`. 어긋나면 그 사실을 기록하고 표 편집을 중단한다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **카운트 8 지점 전부 12 로 in-place 치환 + 표 row 를 14 로 확장**, (B) **marker 부재 지점만 최소 in-place + 표 직후 각주 블록 1 개 신설** (T-1425 `§ 12.23` 선례), (C) **문서 전면 재작성** (blueprint → 실측 좌표계 이행), (D) **무편집 이월**.
  - 판정 기준 **4 축** 명시: ① **파생 관계** — 7 · 168 행이 스스로 출처를 `modules.md` 라 밝히는 파생 서술인가, ② **cascade** — 채택안이 `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 80 행) · ASCII tree (19 ~ 51 행) · `common/` `config/` `prisma/` `test/` `web/` 절에 **새 stale 을 만드는가** (표 row 를 14 로 늘리면 각 신규 row 의 sub-dir 컬럼 서술을 새로 창작해야 하므로 **날조 risk** 가 발생하는지 반드시 평가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.28` 에 기록), ④ **선례 일관성** — 같은 축을 T-1423 · T-1426 · T-1429 는 in-place 로, T-1425 · T-1427 은 각주로 처리했으므로 본 문서의 성격 (P2 blueprint) 에 어느 선례가 맞는지.
  - **81 행 heading 숫자** 를 별도 1 구로 판정한다 — 표 row 를 늘리지 않은 채 heading 만 12 로 바꾸면 **heading ↔ 표 row 수 자기모순** 이 되므로 그 조합은 자동 기각 (T-1429 의 43 행 괄호 열거 판정과 동형 규칙).
  - **7 행 괄호 부연** (`8 application module + PersistenceModule`) 도 별도 1 구 — 카운트만 12 로 바꾸고 부연을 두면 한 행 안에서 자기모순이므로 그 조합 역시 자동 기각.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 1 (v) 의 `§ 12.15` 판별 결과를 따른다.
  - 편집 지점 **최대 5 행** + 각주 블록 **최대 1 개 (≤ 6 행)**. directory.md `wc -l` 증가 **+8 이내**.
  - **ASCII tree 코드블록 (19 ~ 51 행) 내부는 무편집** — tree 정렬 파손 방지 (25 행 주석 포함).
  - **`## 각 module 디렉토리의 표준 sub-structure` (54 ~ 80 행) · `common/` (99 ~) · `config/` (113 ~) · `prisma/` (123 ~) · `test/` (135 ~) · `Frontend (web/)` (149 ~ 165 행) 절은 무편집** — diff 에 미등장.
  - **표 기존 9 row 의 본문 (module 명 · 경로 · sub-dir · 비고) 은 무편집** — ② 2 row 도 원문 보존 (판정 결과는 각주 또는 행-끝 부기로만).
  - **`Refs:` 말미 줄 무편집**.
- [ ] **AC 5 — 무편집 경계**: `src/` · `test/` · `prisma/` · `web/` 일체 (**디렉토리 rename · 신설 절대 금지**), [modules.md](../architecture/modules.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · [components.md](../architecture/components.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md`, `docs/use-cases/INDEX.md`, `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. 이 경계를 `§ 12.28` 에 1 구로 남긴다.
- [ ] **AC 6 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.28` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 (**12 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트), ③ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약, ④ 행 번호 좌표계 → anchor 좌표계 이행 (**6 회째** — 본 slice 도 8 행 번호에 전면 의존), ⑤ 산문 tally ↔ 표 row 수 CI drift-guard spec (본 절의 `N module` 축도 같은 spec 후보), ⑥ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리, ⑦ [api.md](../architecture/api.md) 43 행 열거의 명칭 귀속 축 (`AssessmentModule` placeholder · `SchedulerModule` ↔ `SchedulingModule`), ⑧ **신규** — [components.md](../architecture/components.md) **11** 행 (8 module 열거) · `docs/architecture/p3-implementation-plan.md` (**13 · 243** 행 `9 NestJS module`) · `docs/architecture/p3-to-p4-transition.md` (**20** 행) 의 **시점 기록성 module 수치 축** — 세 문서 모두 P1 ~ P3 시점 산출물이라 `§ 12.15` 상 **보존 후보** 이며 별도 판정 slice 소관. 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 8 이 diff 부재로 검증).
- [ ] **AC 7 — audit §12.28 절 신설**: `## 11. References` (**2505** 행) 바로 앞 (= `§ 12.27` 뒤) 에 `### 12.28 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). 구성은 `§ 12.23` · `§ 12.27` 화법 승계 — (i) 서두 blockquote (본 절이 T-1429 `§ 12.27` 의 "파생 3 문서 일괄 closure" 를 **부분 closure 였다** 고 정정하고 **네 번째 파생 문서** 를 대상으로 삼는다는 위치 규정 + T-1422 → T-1423 → T-1426 → T-1429 → T-1430 계보), (ii) AC 1 실측 6 항 인용 (`§ 12.15` 판별표 포함), (iii) AC 2 **3 축 대조표** (① ② ③ 전수 + 양변 검산), (iv) AC 3 4 후보 판정표 (기준 4 축 + heading 숫자 · 괄호 부연 별도 판정) + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점의 in-place / 부기 / 무편집 근거), (vi) AC 5 무편집 경계, (vii) AC 6 파생 영향 목록, (viii) **closure 선언** (`§ 12.27` 의 closure 범위 정정 + 파생 **4** 문서 module 어휘 축 closure), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 동기가 **카운트 · 경로 축** 이라 각 표 row 의 sub-dir / 비고 서술이 실 코드 구조와 맞는지는 여전히 미검증, ② 파생 문서가 정본을 복제하는 구조 자체가 남아 정본 갱신 시 재-stale 이 반복 (CI drift-guard 축으로만 닫힘), ③ 채택안이 남긴 미해결 (blueprint 성격 문서를 실측 좌표계로 이행할지의 근본 판정은 미착수).
- [ ] **AC 8 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/directory.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일). 불변 — audit `^## ` **12** · `^| REQ-` **66**, directory.md `^## ` **10** · 표 row `^| \*\*` 구간 실측값 (AC 1 (ii) 기준값), `modules.md` `wc -l` **259** · `api.md` **230** · `data-model.md` **193** · `INDEX.md` **123** · `components.md` **190** 무편집. `git diff -U0 -- docs/architecture/directory.md | grep '^@@'` 로 hunk 목록을 제시해 AC 4 가 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). `git status --porcelain src/ test/ prisma/ web/` 이 **빈 출력** 임을 인용 (코드 무변경 실증). 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 9 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` 디렉토리 rename · 신설 일체** — `src/scheduling/` → `src/scheduler/` rename 도, `src/assessment/` 신설도 **절대 금지** (문서 축만 조정). 코드 이동은 module 명 · import path · spec 경로 · coverage 설정에 cascade 하는 별도 ADR 게이트 소관.
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 6 ②).
- **directory.md 표 row 를 14 로 확장하면서 신규 row 의 `표준 sub-dir` · `비고` 컬럼을 창작하는 것** — 실측 근거 없는 서술은 날조. 필요 시 각주로 사실만 기록.
- **ASCII tree 코드블록 (19 ~ 51 행) 재작성** — 실 `src/` 트리 반영은 별도 slice 소관.
- **[components.md](../architecture/components.md) 11 행 · `p3-implementation-plan.md` · `p3-to-p4-transition.md` 의 module 수치 축** — AC 6 ⑧ 로 기록만.
- **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기** — AC 6 ① 로 기록만.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.27`) 본문 재편집.
- `package.json` · CI workflow · `scripts/` 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 판정** — `§ 12.28` 파생 영향 1, **12 회째 이월**.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트)** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 계상 판정.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약**.
4. **행 번호 좌표계 → anchor 좌표계 이행** — 근거 **6 회 누적**.
5. **산문 tally ↔ 표 row 수 CI drift-guard spec** — `N module` 축 · `N NestJS module` 축 · `UC-NN` 범위 축이 모두 같은 spec 후보.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리 해소**.
7. **[api.md](../architecture/api.md) 43 행 열거의 명칭 귀속 축** — `AssessmentModule` (미shipped placeholder) · `SchedulerModule` (실 shipped 명 `SchedulingModule`).
8. **시점 기록성 module 수치 문서 3 종 판정** — [components.md](../architecture/components.md) 11 행 · `p3-implementation-plan.md` 13 · 243 행 · `p3-to-p4-transition.md` 20 행 (`§ 12.28` 파생 영향 8).
9. **directory.md ASCII tree ↔ 실 `src/` 트리 정합** — 본 slice 가 코드블록을 무편집으로 남긴 잔여.
