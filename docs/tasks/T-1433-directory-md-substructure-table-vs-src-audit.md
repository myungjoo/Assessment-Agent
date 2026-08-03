---
id: T-1433
title: directory.md `각 module 디렉토리의 표준 sub-structure` 표 (68 ~ 75 행) 6 sub-dir row 의 `채택 module` 컬럼을 실 `src/*/` 하위와 3 축 대조 후 처리 판정 + audit §12.31
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1432]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1433-directory-md-substructure-table-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 45 번째 slice — audit §12.30 파생 영향 7 (sub-structure 표 ↔ 실 src/*/ 하위) 실행. doc-only 1.6x"
---

# T-1433 — directory.md 표준 sub-structure 표 ↔ 실 `src/*/` 하위 3 축 대조 + 처리 판정

## Why

[T-1432](T-1432-directory-md-ascii-tree-vs-src-audit.md) 는 [directory.md](../architecture/directory.md) 의 **ASCII 트리 축** (21 ~ 50 행) 을 원문 보존 + 3 축 대조 각주 2 행으로 닫았고, [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.30` 의 closure 선언에서 "본 대조는 **디렉토리 이름 축뿐** — 각 디렉토리 **내부 파일 구성** (`dto/` · `entities/` · `repositories/` 등 표준 sub-structure) 이 실제와 맞는지는 미검증" 이라고 잔여를 명시했다. 같은 절 파생 영향 **7** 이 그것을 "본 slice 신규 잔여 — 후속 slice 소관" 으로 위임했다. 본 slice 가 그 위임을 실행해 directory.md 의 **네 번째이자 마지막 대조 면 (sub-structure 축)** 을 닫는다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 표 (**68 ~ 75 행**) 는 sub-dir **6 종** (`dto/` · `entities/` · `guards/` · `providers/` · `adapters/` · `repositories/`) 을 열거하고 각각에 `채택 module` 을 지정하는데, 실 `ls -d src/*/*/` 는 **11 경로 / 3 종** (`dto` 8 · `domain` 2 · `providers` 1) 뿐이다. 즉 표 6 종 중 **실재 2 종 · 미실재 4 종**, 그리고 **표 미기재 실재 1 종** (`domain/`) 이라는 트리 축과 **동형의 3 축 차집합** 이 성립한다. 더욱이 `guards/` · `repositories/` 는 디렉토리가 아니라 **flat suffix 파일** (`src/auth/roles.guard.ts` 2 개 · `src/*/*.repository.ts` 13 개) 로 shipped 돼 있어, "미실재" 가 아니라 **다른 형태로 실현** 이라는 제 3 의 판정 상태가 필요하다 — 트리 축에는 없던 본 slice 고유의 판정 축이다.

동시에 본 문서는 3 · 19 · 55 행이 스스로를 **T-0021 시점 blueprint** 로 규정하므로, `§ 12.15` 의 "시점 기록 = append-only" 축과 T-1430 / T-1432 가 같은 문서 표 축 · 트리 축에서 채택한 "원문 보존 + 실측 각주 blockquote" 선례를 본 표에도 적용할지 정면 판정한다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가라, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **187 행**. 다음 구간만 읽는다.
  - **57 ~ 82 행** (`## 각 module 디렉토리의 표준 sub-structure` heading + 59 ~ 64 행 공통 4 항목 산문 + 66 행 도입구 + **68 ~ 75 행 표** + 77 ~ 82 행 `PersistenceModule 의 특수 sub-structure`) — 본 slice 의 **유일한 편집 후보 구간**.
  - **52 ~ 53 행** (T-1432 가 붙인 트리 축 3 축 대조 각주 blockquote 2 행) — **무편집**, 각주 화법 template + 이미 닫힌 축 경계 확인용.
  - **100 ~ 101 행** (T-1430 이 붙인 mapping 표 축 각주 blockquote 2 행) — **무편집**, 같은 화법의 두 번째 선례.
  - **3 · 19 · 55 행** (시점 blueprint 선언 3 지점) — **무편집**, 판정의 최강 제약.
  - **105 ~ 187 행** (`## common/ shared utilities` 이후 전 구간 + `## References` + `Refs:` 말미) — **무편집** 경계 확인용.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.30`** (**2809** 행 — T-1432 의 트리 축 3 축 대조 + 4 후보 판정표 화법 template + 파생 영향 **7** 이 본 slice 위임 원문 + closure 선언의 "디렉토리 이름 축뿐" 한계 1 항) · **`## 11. References` (2930 행)** — `§ 12.31` 삽입 위치 경계.
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (정본 표 row 12) · **47 ~ 48 행** (T-1425 미기재 3 각주). `AssessmentModule` 미shipped placeholder · `SchedulerModule` ↔ 실 `SchedulingModule` 두 문장이 표의 `채택 module` 값 (`assessment` · `scheduler`) 판정 근거라 그대로 인용.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.31` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.31` 에 기록한다.
  - (i) **표 축 전수**: `sed -n '68,75p' docs/architecture/directory.md` 로 표 원문을 인용하고, sub-dir **6 종** (`dto/` · `entities/` · `guards/` · `providers/` · `adapters/` · `repositories/`) 각각의 `채택 module` 값을 전수 열거한다 (예 — `dto/` = assessment / user / auth / web / scheduler, `guards/` = auth 전용, `providers/` = llm 전용, `adapters/` = github / confluence, `repositories/` = user / assessment, `entities/` = assessment / user).
  - (ii) **코드 축 전수**: `ls -d src/*/*/ | sed 's#/$##'` 출력을 인용한다. 기대 — **11 경로**, sub-dir 명으로 접으면 **3 종** (`dto` **8** = `assessment-collection` · `assessment-evaluation` · `auth` · `export` · `import` · `llm` · `scheduling` · `user`, `domain` **2** = `assessment-collection` · `assessment-evaluation`, `providers` **1** = `llm`). 접기 검산은 `ls -d src/*/*/ | awk -F/ '{print $3}' | sort | uniq -c`.
  - (iii) **flat suffix 축 (본 slice 고유)**: `ls src/*/*.guard.ts src/*/*.repository.ts src/*/*.entity.ts src/*/*.adapter.ts 2>/dev/null` 를 suffix 별로 실행해 개수를 인용한다. 기대 — `*.guard.ts` **2** (`src/auth/jwt-auth.guard.ts` · `src/auth/roles.guard.ts`), `*.repository.ts` **13**, `*.entity.ts` **0**, `*.adapter.ts` **0**. 이 축이 "표의 sub-dir 이 미실재" 와 "그 책임 자체가 미shipped" 를 구분하는 유일한 근거다.
  - (iv) **3 축 차집합**: (i) ∩ (ii) = **양쪽 실재 2 종** (`dto/` · `providers/`) · **표 전용 (디렉토리 미실재) 4 종** (`entities/` · `guards/` · `adapters/` · `repositories/`) · **실재 전용 (표 미기재) 1 종** (`domain/`) 으로 전수 이분한다. **양변 검산 2 식** 명시 — `6 = 2 + 4` · `3 = 2 + 1`. 표 전용 4 각각에 (iii) 의 flat 실측을 붙여 **`guards/` · `repositories/` = 다른 형태로 실현** vs **`entities/` · `adapters/` = 책임 자체 미shipped** 로 2 분류한다.
  - (v) **채택 module 값 축 (보조)**: (i) 이 열거한 `채택 module` 값 중 **경로가 실재하지 않는 이름** (`assessment` · `scheduler` — T-1430 / T-1432 가 이미 미shipped placeholder · 실 shipped 명 `scheduling` 으로 판정) 과 **실재하나 표의 어느 row 에도 없는 module** (`export` · `import` · `permission-denied` · `user-instance-access` · `assessment-collection` · `assessment-evaluation` 중 `dto/` 보유분) 을 각각 전수 열거한다. 본 축은 AC 2 판정 대상에 포함하되 편집 여부는 AC 3 채택안을 따른다.
  - (vi) **PersistenceModule 특수 단락 축 (보조)**: `ls src/persistence/` 출력을 인용해 77 ~ 82 행이 열거한 3 파일 (`persistence.module.ts` · `prisma.service.ts` · `prisma.service.spec.ts`) 의 실재 여부와 미기재 파일 (`persistence.module.spec.ts`) 을 확인한다. 기대 — 3 전부 실재 (= **본 단락은 stale 아님**). 이 결과가 "무편집" 이면 그 사실 자체를 `§ 12.31` 에 1 구로 기록한다.
  - (vii) baseline — `wc -l` directory.md **187** · audit **2943** · modules.md **259**, `grep -c '^## '` directory.md **10** · audit **12**, audit `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 지점 판정표**: AC 1 (iv) 의 **표 전용 4 종** + **실재 전용 1 종** + AC 1 (v) 의 `채택 module` 값 이상 항목 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` 중 하나를 판정한 표를 만든다. 각 row 는 **항목 · 축 (sub-dir 종 / 채택 module 값) · 표 서술 또는 부재 1 구 · 실측 상태 (디렉토리 실재 / flat 실현 / 미shipped) · 판정 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (본 문서가 3 · 19 · 55 행에서 스스로를 T-0021 blueprint 로 규정하는데 표를 고치면 자기모순인가), ② `§ 12.15` **정합** (시점 기록 append-only 축에 본 표가 해당하는가), ③ **선례** (T-1430 표 축 · T-1432 트리 축이 같은 문서에서 채택한 "원문 보존 + 실측 각주 blockquote" 화법이 sub-structure 축에도 그대로 적용 가능한가).
  - **`guards/` · `repositories/` 는 별도 1 구** — 나머지 표 전용 2 종 (`entities/` · `adapters/`) 이 **책임 미shipped** 인 반면 이 둘은 **책임은 shipped 이나 형태가 flat 파일** 이라, 같은 "디렉토리 미실재" 라도 근거가 다름을 반드시 구분한다 (AC 1 (iii) 실측 인용).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **표 in-place 재작성** (6 row 를 실측 3 종 + flat 축으로 전면 교체), (B) **표 원문 무편집 + 표 직후 (75 행 뒤) 3 축 대조 각주 blockquote 1 개 부기** (T-1430 / T-1432 선례의 동일 문서 내 3 번째 확대 적용), (C) **혼합** (표 전용 4 종의 `채택 module` 컬럼만 주석 병기 + 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② 독자 오도 risk (표를 그대로 두면 P3+ implementer 가 `src/user/entities/` · `src/github/adapters/` 를 만들어야 한다고 오인하는가 — 특히 **flat 파일로 이미 실현된 `repositories/` 를 다시 디렉토리로 만드는 중복 위험**), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.31` 에 기록), ④ 선례 일관성 (같은 문서에서 이미 두 번 (T-1430 · T-1432) 채택된 각주 화법과의 정합).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **directory.md 편집은 표 직후 각주 blockquote 1 개 (≤ 4 행) 또는 산문 1 ~ 2 행 이내** — `wc -l` 증가 **+6 이내**.
  - **표 본문 (68 ~ 75 행) 내부는 AC 3 이 (A) 또는 (C) 를 채택한 경우에만 편집** 하며, 그 경우에도 실측으로 확인된 항목만 손댄다 (창작 금지 — 각 sub-dir 의 `용도` 컬럼 문구는 실측 없이 신설 · 재작성하지 않는다).
  - **3 · 19 · 55 행 시점 선언 무편집** · **52 ~ 53 행 T-1432 각주 무편집** · **100 ~ 101 행 표 + T-1430 각주 무편집** · **105 행 이후 전 구간 무편집** · `Refs:` 말미 무편집.
  - **77 ~ 82 행 PersistenceModule 특수 단락은 AC 1 (vi) 이 stale 을 실증한 경우에만** 손대며, 기대대로 3 파일 전부 실재면 **무편집** 이다.
- [ ] **AC 5 — audit §12.31 절 신설**: `## 11. References` (**2930** 행) 바로 앞 (= `§ 12.30` 뒤) 에 `### 12.31 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). **본 절 ≤ 120 행** (cap 보호). 구성은 `§ 12.28` · `§ 12.30` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.30` **파생 영향 7** 의 위임을 실행하며 T-1422 → … → T-1432 계보에서 **directory.md 의 네 번째이자 마지막 대조 면** 임을 규정), (ii) AC 1 실측 7 항 인용 (3 축 차집합 + flat suffix 축 + 양변 검산 2 식 포함), (iii) AC 2 판정표, (iv) AC 3 4 후보 판정표 + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점 근거), (vi) 무편집 경계, (vii) 파생 영향 목록 (AC 7), (viii) **closure 선언** (directory.md 축이 표 · pointer · 트리 · sub-structure 4 면에서 모두 닫혔는지 — 닫히지 않았다면 잔여를 명시), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 대조는 **sub-dir 이름 축 + flat suffix 축** 이라 각 파일의 내용 / 책임이 표의 `용도` 컬럼 서술과 맞는지는 미검증, ② blueprint 문서가 코드 layout 을 복제하는 구조 자체는 잔존해 `src/*/` 에 sub-dir 이 하나 추가되면 즉시 재-stale (CI drift-guard 축으로만 닫힘), ③ 판정상 보존된 항목은 P3+ implementer 가 여전히 미실재 sub-dir 지시를 만난다.
- [ ] **AC 6 — 불변 검산**: `git status --porcelain` 변경 파일이 **최대 3 개** (`directory.md` · `REQ-COVERAGE-AUDIT.md` + 본 task 파일 — AC 3 채택안이 (D) 면 directory.md 가 빠져 2 개). 불변 — audit `^## ` **12** · `^| REQ-` **66**, directory.md `^## ` **10**, `modules.md` `wc -l` **259** 무편집. `git diff -U0 -- docs/architecture/directory.md` 의 `^@@` hunk 목록을 제시해 AC 4 허용 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). `git status --porcelain src/ test/ prisma/ web/` 이 **빈 출력** 임을 인용. 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 7 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.31` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 (**15 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트), ③ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약, ④ 행 번호 좌표계 → anchor 좌표계 이행 (**9 회째**), ⑤ 산문 tally ↔ 표 row 수 / 트리 항목 수 / sub-dir 종 수 CI drift-guard spec, ⑥ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리, ⑦ [components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 여부 (T-1431 잔여), ⑧ **신규 — 표 `용도` 컬럼 서술 ↔ 실 파일 내용 (책임) 대조** (본 slice 는 이름 축만 닫음). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다**.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative 충분 cover) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` 디렉토리 · 파일 신설 · 이동 · rename 일체** — 문서를 코드에 맞추는 slice 이지 그 역이 아니다. `src/user/entities/` · `src/github/adapters/` · `src/user/repositories/` 를 실제로 만들거나 `*.repository.ts` 를 디렉토리로 옮기는 것은 절대 금지.
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 7 ②).
- **directory.md 의 ASCII 트리 블록 (21 ~ 50 행) 과 T-1432 각주 (52 ~ 53 행) · `## 9 module 별 디렉토리 mapping` 표와 T-1430 각주 (84 ~ 101 행) · `## common/` 이후 전 구간 (105 ~ 187 행)** — 전부 무편집.
- **시점 선언 3 지점 (directory.md 3 · 19 · 55 행) 편집** — `§ 12.15` 상 보존.
- **[components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · `docs/requirements.md`** — 전부 무편집, diff 에 미등장.
- **`test/` · `prisma/` · `web/` · `scripts/` 일체** 및 66 REQ 전수 재audit · audit 기존 절 (`§ 12.1` ~ `§ 12.30`) 본문 재편집.
- **`scripts/daily-test.sh` leg 추가 · CI drift-guard spec 신설** — AC 7 ⑤ 로 이월 (drift-guard smoke spec 3 개 동반 갱신이 5 파일 cap 을 넘긴다 — 과거 T-1122 BLOCKED 선례).
- `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
