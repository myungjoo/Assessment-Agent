---
id: T-1425
title: modules.md 정본 12 module 표 vs src/ 실 shipped module 실측 3 축 대조 + 미기재 3 module 처리 방식 판정 후 반영 + audit §12.23
phase: P5
status: DONE
completedAt: 2026-08-03T12:45:00Z
commitMode: direct
coversReq: [REQ-030, REQ-044, REQ-045]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1424]
touchesFiles:
  - docs/architecture/modules.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/use-cases/INDEX.md
  - docs/tasks/T-1425-modules-md-shipped-module-inventory-audit.md
plannerNote: "uc-doc-audit-resync 37 번째 slice — T-1424 Follow-up 8. 정본 12 표 vs 실 module 14 대조 + 미기재 3 판정·반영. doc-only 1.6x"
---

# T-1425 — modules.md 정본 표 vs 실 shipped module 실측 대조

## Why

[T-1424](T-1424-index-uc-row-module-attribution-audit.md) 가 [INDEX.md](../use-cases/INDEX.md) 8 UC row 의 module 귀속을 정본 [modules.md](../architecture/modules.md) 와 대조하는 과정에서 **`src/export/` · `src/import/` 의 실 shipped module 이 정본 12 표에 아예 없다** 는 사실을 신규 확인하고 `Follow-up 8` 로 남겼다. 본 slice 가 그 축을 닫는다.

- 지금까지의 3 slice (T-1422 → T-1423 → T-1424) 는 **문서 ↔ 문서** 정합만 맞췄다 (`modules.md` 자기정합 8 지점 → `INDEX.md` 25 행 어휘 → `INDEX.md` 표 row 귀속). 그 기준선이 된 정본 **12** 자체가 **코드 실측** 과 어긋나면 아래 3 문서가 한꺼번에 stale 이 되므로, 이번에는 **문서 ↔ 코드** 축을 처음으로 대조한다.
- planner 사전 확인 (executor 가 AC 1 에서 재검증): `src/*/*.module.ts` **14** 개가 실재하는데 정본 표는 **12** row 이고, 그 12 중 `AssessmentModule` 은 39 행 스스로가 "미shipped placeholder" 로 박제한 항목이다. 반대로 실 shipped `ExportModule` · `ImportModule` · `UserInstanceAccessModule` 은 정본 문서 전체에서 **module 명 자체가 0 회** 등장한다.
- 이 누락은 이미 파생 오류를 만들고 있다 — INDEX **37** 행 `UC-07 (Export / Import / Backup / Restore)` row 는 실 shipped `ExportModule` / `ImportModule` 대신 `AssessmentModule` 병기를 쓴다. INDEX **25** 행 허용 어휘가 정본 12 로 닫혀 있어 **쓰고 싶어도 쓸 수 없는** 구조라, 정본 축을 열지 않으면 UC-07 row 는 영원히 부정확하다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/modules.md` — **본 slice 의 주 편집 후보 문서**. 다음 구간만 읽는다.
  - **26 ~ 45 행** (`## Module 목록` 절 — **28** 행 서두 산문 + **30 · 31** 행 표 header + **32 ~ 43 행 정본 12 row** + **45** 행 마무리 산문). 특히 **39** 행 (`AssessmentModule` = 미shipped placeholder) · **42** 행 (`SchedulerModule` 의 실 명칭 `SchedulingModule` 부기).
  - **22** 행 (Deployment 컨텍스트의 `모든 12 module`) · **133** 행 (mermaid 표기 bullet 의 `12 module`) · **154** 행 (topological 마지막 줄 `위 12 module 모두 imports`) · **192** 행 · **205** 행 · **249** 행 — [T-1422](T-1422-modules-md-module-count-resync.md) 가 확정한 **카운트 8 지점** (22 · 28 · 45 · 133 · 154 · 192 · 205 · 249).
  - **47 ~ 136 행** (`## 의존성 그래프 (mermaid)` — node 선언 + `app -->` edge 목록 + 133 ~ 136 행 다이어그램 표기 bullet). (A) 안 채택 시 동시 갱신 대상이므로 **blast radius 산정을 위해서만** 훑는다.
  - **140 ~ 157 행** (`### Topological order` 코드블록) · **190 ~ 205 행** (`## Components ↔ Modules mapping` 표 8 row + 205 행 산문).
- `src/app.module.ts` — **무편집, 읽기만**. `@Module({ imports: [...] })` 배열만. AppModule 이 실제로 등록하는 module 집합이 AC 1 (ii) 의 원자료.
- `src/export/export.module.ts` · `src/import/import.module.ts` — **무편집, 읽기만**. 각 파일의 `@Module({...})` 블록 (imports / controllers / providers / exports) 과 상단 주석 1 ~ 5 행. (A) 안 채택 시 신설 row 의 "책임 1 ~ 2 줄" · "주요 dependency" 열 근거.
- `src/permission-denied/permission-denied-record.module.ts` — **무편집, 읽기만**. **20 ~ 35 행** 부근 (`UserInstanceAccessModule` 을 non-@Global 명시 import 하는 지점). `UserInstanceAccessModule` 이 **AppModule 직접 등록이 아님** 을 확인하는 근거.
- `docs/use-cases/INDEX.md` — **조건부 편집 대상** (AC 3 (A) 안 채택 시에만). **24 · 25 행** (허용 어휘 — 25 행이 정본 12 를 복제) · **31 ~ 38 행** (T-1424 가 병기한 8 UC row — 특히 **37** 행 UC-07) · **39** 행 (T-1423 이 닫은 UC-09 row).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1613 ~ 1740 행** (`### 12.22` — T-1424 판정 원문 + 화법 template, `Follow-up 8` 의 근거인 파생 영향 6), **1420 ~ 1504 행** (`### 12.20` — T-1422 의 카운트 8 지점 실측 원형), **1741** 행 (`## 11. References` — `§ 12.23` 삽입 위치의 경계).
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (문서 ↔ 코드 3 축 대조 원자료, 날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.23` 에 그대로 인용한다. 기대값과 **다르면 그 축의 판정을 중단** 하고 불성립 사실을 `§ 12.23` 에 기록한다 (임의 진행 금지). **모든 실측 명령은 [T-1424](T-1424-index-uc-row-module-attribution-audit.md) `Follow-up 7` 이 요구한 scope 포함 형태** (`sed -n '<from>,<to>p' <file> | grep …`) 로 적고, 그 결과를 명령과 함께 인용한다.
  - (i) **축 1 — 실 shipped module 전수**: `ls src/*/*.module.ts` 로 module 파일을 전수 나열한다 (기대 **14** 개 — `assessment-collection` / `assessment-evaluation` / `auth` / `confluence` / `export` / `github` / `import` / `llm` / `permission-denied-record` / `persistence` / `scheduling` / `user-instance-access` / `user` / `web`). `src/app.module.ts` (root) 는 별도 표기.
  - (ii) **축 2 — AppModule 등록 집합**: `src/app.module.ts` 의 `@Module` `imports:` 배열을 전수 나열한다 (기대 internal **13** = (i) 의 14 중 `UserInstanceAccessModule` 제외, + 외부 `ScheduleModule.forRoot()` 1). `UserInstanceAccessModule` 이 `src/permission-denied/permission-denied-record.module.ts` 의 명시 import 로만 DI 에 들어오는 사실을 파일·행으로 인용.
  - (iii) **축 3 — 정본 표 12**: `sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"` = **12** 와 그 12 개 module 명 전수.
  - (iv) **3 축 대조표** — (i)/(ii) ↔ (iii) 를 1:1 매칭해 세 부분집합을 명시한다. 기대: ① **양쪽 일치 11** (`SchedulerModule` ↔ `src/scheduling/` 는 정본 42 행이 이미 부기로 흡수 — 일치로 계상하고 그 근거 1 구), ② **정본 only 1** = `AssessmentModule` (39 행 자기박제 미shipped placeholder — 어긋남 아님, 이미 닫힌 축), ③ **실 only 3** = `ExportModule` · `ImportModule` · `UserInstanceAccessModule`. 각 항목에 파일 경로를 붙인다.
  - (v) **미기재 증명** — `grep -c "ExportModule\|ImportModule\|UserInstanceAccessModule" docs/architecture/modules.md` = **0** (기대). 0 이 아니면 그 행 번호를 인용하고 (iv) ③ 를 그만큼 축소.
  - (vi) **소비 파장 실측** — `sed -n '25p' docs/use-cases/INDEX.md` (허용 어휘가 정본 12 를 복제) 와 `sed -n '37p' docs/use-cases/INDEX.md` (UC-07 = Export/Import/Backup/Restore row 가 `ExportModule`/`ImportModule` 대신 `AssessmentModule` 병기 사용) 를 인용해, 정본 누락이 파생 문서에 이미 오류를 만들고 있음을 1 구로 근거화.
  - (vii) baseline — `wc -l` modules.md **256** · INDEX **123** · audit **1754** · components.md **190** · data-model.md **190**, audit `grep -c "^## "` **12** · `grep -c "^| REQ-"` **66**, INDEX `grep -c "^| UC-"` **9**, modules.md 카운트 8 지점 (**22 · 28 · 45 · 133 · 154 · 192 · 205 · 249** 행) 이 전부 `12` 임을 재확인.
- [ ] **AC 2 — 처리 방식 4 후보 판정표**: AC 1 (iv) ③ 가 확정한 **미기재 module 집합** 에 대해 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구를 단다 ("애매하다" 류 서술 금지).
  - (A) **정본 표 row 신설 + 다축 동시 동기** — 32 ~ 43 행 표에 누락 module row 를 추가하고, 카운트 8 지점 · mermaid node/edge · 다이어그램 표기 bullet · topological order · Components↔Modules mapping 표·산문 을 **같은 slice 안에서** 전부 갱신. 추가로 파생 `INDEX.md` **25** 행 허용 어휘와, T-1424 병기가 인용한 `modules.md` **행 번호** (row 삽입으로 shift 되는 지점) 까지 닫아야 성립.
  - (B) **표 아래 미기재 각주 신설** — 표 직후 (45 행 부근) 에 "정본 표 미기재 실 shipped module" 을 명시하는 **≤ 3 행** 산문/각주를 추가하고 표 row 와 카운트는 무편집. 정본이 사실을 흡수하되 카운트 cascade 0.
  - (C) **기존 row 안 부기** — 관련 row 서술 안에 부기 (예: `PermissionDeniedRecordModule` row 에 `UserInstanceAccessModule` 부기). `ExportModule` / `ImportModule` 은 귀속시킬 row 가 없으므로 **부분해** 임을 명시.
  - (D) **무편집** — 실측·판정만 audit 에 남기고 정본 편집은 후속 slice 로 이월.
  - 판정 기준 **4 축** 을 명시한다: ① **사실 흡수** — 채택안이 정본만 읽는 독자에게 미기재 3 을 인지시키는가, ② **cascade** — 채택안이 `INDEX.md` 25 행 어휘 / T-1424 병기의 행 번호 인용 / [data-model.md](../architecture/data-model.md) 39 행에 **새 stale 을 만드는가**, 만든다면 같은 slice 안에서 닫을 수 있는가, ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 ≤ 5 (초과 시 그 후보는 자동 기각 + split 제안을 `§ 12.23` 에 기록), ④ **결정 권한** — 정본 module 집합 변경이 [ADR-0003 §1](../decisions/ADR-0003-deployment.md) 등 기존 ADR 서술과 충돌해 ADR 게이트를 요구하는지 (요구하면 그 후보는 direct doc slice 에서 기각).
- [ ] **AC 3 — 채택안 반영**: AC 2 의 채택안대로만 편집한다. 처리 전에 [`§ 12.15`](../use-cases/REQ-COVERAGE-AUDIT.md) 판별 (날짜 stamp 있는 시점 기록 = append / 없는 living 서술 = in-place) 을 대상 지점에 적용한 결과를 1 구로 근거화한다.
  - (A) 채택 시 — 기준 ② 의 cascade 를 **하나도 남기지 않는다**. 즉 카운트 8 지점 전부 · mermaid · topological · mapping 표·산문 · `INDEX.md` 25 행 · 행 번호 인용 shift 를 모두 닫고, 닫은 지점 목록을 `§ 12.23` 에 열거한다. 하나라도 남기면 (A) 는 성립하지 않으므로 차선안으로 되돌린다.
  - (B) 채택 시 — 신설 산문/각주는 **표 직후 ≤ 3 행**, 표 row · 카운트 8 지점 · mermaid · topological · mapping 표는 **전부 무편집**. modules.md `wc -l` 증가는 **+4 이내**. 각주 본문은 (i) 미기재 module 명 전수 + 파일 경로, (ii) AppModule 등록 여부 (`UserInstanceAccessModule` 은 비등록 — PermissionDeniedRecordModule 경유), (iii) 정본 12 카운트가 본 각주를 포함하지 않는다는 경계 를 담는다.
  - (C) 채택 시 — 부기는 대상 row **1 행 → 1 행 in-place**, 편집 row 수 ≤ 2, 카운트 8 지점 무편집. 미해결로 남는 module (`ExportModule` / `ImportModule`) 을 `§ 12.23` 에 명시.
  - (D) 채택 시 — diff 에 `docs/architecture/modules.md` 가 **미등장** 해야 하고, 그 경우 `§ 12.23` 은 실측 + 판정 + split 제안만으로 성립한다.
  - 어느 안이든 **새 module 신설 · 책임 재배치 · rename 을 문서로 선언하지 않는다** — 본 slice 는 **이미 shipped 된 사실의 문서 반영** 만.
- [ ] **AC 4 — 무편집 경계**: `src/` · `test/` · `prisma/` 일체, `docs/architecture/components.md` · `data-model.md` · `api.md`, `docs/decisions/ADR-*.md`, `UC-01` ~ `UC-09` 본문, `docs/PLAN.md`, `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. `INDEX.md` 는 **(A) 채택 시에만** 편집 가능하며 그 경우에도 **58 · 86 행 (§3 산문) · 39 행 (UC-09 row) · 21 · 41 · 43 · 51 행 (시점 기록)** 은 무편집. 이 경계를 `§ 12.23` 에 1 구로 남긴다.
- [ ] **AC 5 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.23` 에 남긴다 — 최소 ① INDEX **58 · 86 행** §3 산문의 `AssessmentModule` 귀속 (T-1424 Follow-up 1, 3 회째 이월), ② [data-model.md](../architecture/data-model.md) **39** 행 `8 NestJS module 명`, ③ data-model.md **38** 행 `13 entity` vs 실 entity row 14, ④ [api.md](../architecture/api.md) **223** 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC, ⑤ UC-09 `§ 5` sequence participant 병기 미판정 (7 회째 이월), ⑥ INDEX **37** 행 UC-07 row 의 `ExportModule` / `ImportModule` 미사용 (본 slice 채택안이 (A) 가 아니면 잔존 — AC 1 (vi) 실측 결과와 연결), ⑦ (D) 또는 (B)/(C) 채택 시 남는 정본 표 row 신설 축. 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 7 이 diff 부재로 검증).
- [ ] **AC 6 — audit §12.23 절 신설**: `## 11. References` (**1741** 행) 바로 앞 (= `§ 12.22` 뒤) 에 `### 12.23 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c "^## "` = **12 불변** — `###` 이므로). 구성은 `§ 12.21` · `§ 12.22` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 7 축 인용 (**3 축 대조표** 포함), (iii) **AC 2 의 4 후보 판정표** (판정 기준 4 축 명시) + 채택 결론, (iv) AC 3 반영 결과 (편집 지점 목록 + `§ 12.15` 판별 근거), (v) AC 4 무편집 경계 목록, (vi) AC 5 파생 영향 목록, (vii) [T-1424](../tasks/T-1424-index-uc-row-module-attribution-audit.md) `Follow-up 8` 의 처리 결과 선언 + `Follow-up 7` (scope 포함 실측 명령 표준) 을 본 slice 가 **AC 1 에서 실제로 적용해 closure** 했다는 1 구, (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 문서 ↔ 코드 대조는 본 slice 시점의 snapshot 이라 module 추가/삭제 시 즉시 재stale 이 되는 축 (T-1424 Follow-up 6 의 다축 동시 갱신 규약에 **코드 축** 을 편입해야 한다는 지적), ② 채택안이 남긴 미해결 module, ③ `ScheduleModule.forRoot()` 같은 외부 package module 은 정본 표의 계상 대상인지 미판정.
- [ ] **AC 7 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/modules.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) — 단 **(A) 채택 시에만 `docs/use-cases/INDEX.md` 포함 4 개**, (D) 채택 시 **2 개**. 불변 — audit `^## ` **12** · `^| REQ-` **66**, INDEX `^| UC-` **9** · 표 열 수 7, components.md **190** · data-model.md **190** 무편집, modules.md 표 row 수는 (A) 채택 시에만 증가하고 그 외에는 `sed -n '32,43p' … | grep -c "^| \*\*"` = **12 불변**. `git diff -U0 -- docs/architecture/modules.md | grep '^@@'` 로 hunk 목록을 제시해 채택안이 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 5.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` 코드 변경 일체** — module 신설 · rename (`SchedulerModule` → `SchedulingModule`) · `AppModule` imports 변경 · `UserInstanceAccessModule` 의 root 등록. 전부 ADR + 코드 게이트이며 본 slice 는 **읽기만** 한다.
- **ADR 편집 일체** — [ADR-0003](../decisions/ADR-0003-deployment.md) §1 의 module 서술 포함. 정본 표와 ADR 이 어긋나면 AC 5 에 기록만.
- **[components.md](../architecture/components.md) 편집** — 8 component 축은 본 slice 대상 아님 (mapping 표는 modules.md 쪽만).
- **[data-model.md](../architecture/data-model.md) 38 · 39 행** · **[api.md](../architecture/api.md) 223 행** — 각각 별도 slice (AC 5 ② ③ ④).
- **INDEX 58 · 86 행 §3 산문 편집** — T-1424 Follow-up 1 소관 (AC 5 ①).
- **INDEX 편집 (A 안 외)** — (B)/(C)/(D) 채택 시 `INDEX.md` 는 diff 에 미등장해야 한다.
- **UC-01 ~ UC-09 본문 편집 일체** — 어긋남이 실측되어도 AC 5 에 기록만.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.22`) 본문 재편집.
- `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **미기재 집합은 2 가 아니라 3 이었다** — task 정의서는 `Follow-up 8` 을 이어받아 `src/export/` · `src/import/` 2 축으로 기술했으나, AC 1 (iv) 실측은 `UserInstanceAccessModule` 을 포함한 **3** 을 냈다. 채택안 (B) 각주가 3 전부를 흡수했다. (후속 slice 는 3 을 기준선으로 삼을 것.)
2. **정본 표 row 신설 축은 3 slice split 이 필요** — ① "정본 계상 기준 = `AppModule` 등록 여부인가" ADR 확정 (22 행의 [ADR-0003 §1](../decisions/ADR-0003-deployment.md) 인용 서술과 `UserInstanceAccessModule` 비등록 사실이 충돌) → ② modules.md 표 row + 카운트 8 지점 + mermaid + topological + mapping 동시 갱신 → ③ [INDEX.md](../use-cases/INDEX.md) 25 행 어휘 확장 + 37 행 재귀속 + [UC-07](../use-cases/UC-07-export-import.md) `§ 9` `4 module` 수치 재판정. `§ 12.23` 파생 영향 ⑦ 에 동일 내용 박제.
3. **외부 package module 계상 규약 미판정** — `ScheduleModule.forRoot()` (`@nestjs/schedule`) 가 정본 표 계상 대상인지 어느 문서도 명시하지 않는다 (`§ 12.23` 한계 3). 위 2 의 ① ADR 과 함께 판정하는 편이 자연스럽다.
4. **행 번호 좌표계 → anchor 좌표계 이행** — 본 slice 의 3 행 append 로 modules.md 46 행 이후가 +3 shift 했고, 기존 journal/task 의 `237 행` · `239 행` 인용이 실제로 어긋났다 (시점 기록이라 정정 안 함). `§ 12.22` 한계 5 가 예고한 취약성의 실발현 — 문서 간 좌표 인용을 heading anchor 기반으로 옮기는 별도 slice 가 필요하다.
5. **다축 동시 갱신 규약에 코드 축 편입** — T-1423 Follow-up 6 의 6 축 (표 · topological · mermaid · 산문 카운트 · INDEX 25 행 어휘 · INDEX 표 row 귀속) 에 **`src/*/*.module.ts` 집합** 을 7 번째 축으로 추가해야 하고, 사람 규약보다 CI drift-guard spec 이 견고하다 (`§ 12.23` 한계 1).
