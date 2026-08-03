---
id: T-1429
title: api.md 파생 stale 3 지점 (§4 43 행 · §9 220 행 `9 NestJS module` + §9 223 행 `UC-01 ~ UC-08` 범위) 을 정본 12 module / 9 UC 와 대조 동기 후 audit §12.27 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1428]
touchesFiles:
  - docs/architecture/api.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md
plannerNote: "uc-doc-audit-resync 41 번째 slice — §12.26 파생 영향 1 closure + 미발견 module 어휘 축 2 지점 동시 동기. doc-only 1.6x"
---

# T-1429 — api.md module 어휘 · UC 범위 파생 stale 3 지점 정본 동기

## Why

[T-1428](T-1428-index-md-module-attribution-code-resync.md) 이 신설한 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.26` 의 **파생 영향 1** — [api.md](../architecture/api.md) **223** 행 `UC-01 ~ UC-08` 링크 범위가 실재 **9 UC** 와 어긋남 (`§ 12.25` 파생 영향 2 를 이어받은 축) — 을 본 slice 가 닫는다. [T-1419](T-1419-eight-uc-notation-bulk-resync.md) 가 같은 문서의 `8 UC` 표기 **12 지점** 을 9 로 일괄 동기했으나 **223** 행의 링크 **범위 표기** (`UC-01-... ~ UC-08-permission-denied.md`) 만 남았다.

같은 문서에 **동종 파생 stale 2 지점** 이 더 있음을 planner 가 사전 확인했다 — **43** 행 (`§ 4 Resource model`) 과 **220** 행 (`§ 9 References`) 의 `9 NestJS module` 표기다. [T-1422](T-1422-modules-md-module-count-resync.md) 가 정본 [modules.md](../architecture/modules.md) 를 표 row 실측 **12** 로 확정했고, 그 파생 문서인 [INDEX.md](../use-cases/INDEX.md) 25 행은 [T-1423](T-1423-index-module-vocabulary-resync.md) 이, [data-model.md](../architecture/data-model.md) 3 지점은 [T-1426](T-1426-data-model-count-and-module-vocab-resync.md) 이 이미 12 로 동기했다. **api.md 만 파생 3 문서 중 유일하게 미동기** 로 남아 있어 본 slice 가 그 마지막 조각을 닫는다. 두 축은 같은 파일 · 같은 성격 (정본 대조 후 in-place 동기) 이라 한 slice 로 묶는 편이 cap 안에서 효율적이다.

planner 사전 확인 (executor 가 AC 1 에서 재측정) — `grep -n '[0-9]\+ NestJS module' docs/architecture/api.md` 는 **43 · 220** 두 행이고, 43 행은 카운트 `9` 와 **괄호 안 9 개 열거** (`AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule / SchedulerModule / WebModule`) 를 함께 갖는다 — 정본 12 대비 `PermissionDeniedRecordModule` · `AssessmentCollectionModule` · `AssessmentEvaluationModule` **3 개 누락**. 이는 T-1423 이 INDEX 25 행에서 처리한 형태 (카운트 · 열거 · 정본 삼중 대조) 와 **동형** 이라 그 선례를 승계한다. `grep -n 'UC-08-permission-denied.md)' api.md` 는 **223** 행 1 곳.

본 slice 는 **파생 문서의 정본 동기** 이지 정본 표 (modules.md) 나 endpoint 표 (§ 5) 의 변경이 아니다 — 정본 표 row 신설은 `§ 12.26` 파생 영향 3 의 ADR 게이트 소관 그대로 남고, `72 endpoint` / `16 resource prefix` / `9 UC cover` 합계는 **불변** 이다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/api.md` — **본 slice 의 유일한 편집 대상 문서** (230 행). 다음 구간만 읽는다.
  - **41 ~ 60 행** (`## 4. Resource model` — 특히 **43** 행 산문의 `9 NestJS module (...)` 카운트 + 9 개 열거 + `신규 module 신설 0` 문구. 편집 축 A 의 1 지점).
  - **215 ~ 230 행** (`## 9. References` 전체 — 특히 **220** 행 `modules.md — 9 NestJS module` (축 A 의 2 지점) 과 **223** 행 `UC-01-... ~ UC-08-permission-denied.md` 범위 (축 B). 나머지 References 행은 무편집 대상 확인용으로만).
  - **3 행** blockquote · **12 · 64 · 153 · 208 · 209 행** — **무편집, 읽기만**. 이미 `9 UC` 로 동기된 T-1419 결과라 회귀 0 을 증명할 대조군.
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (정본 표 row 12 — 12 module 명의 정확한 철자) · **45 행** (`위 12 module 은 AppModule …`) · **47 ~ 48 행** (T-1425 미기재 3 각주와 그 **계상 경계** — 각주 3 개는 `12` 카운트에 미포함) 만.
- `docs/use-cases/INDEX.md` **25 행** — **무편집, 읽기만**. T-1423 이 채택한 파생 문서 동기 화법 (`modules.md 의 12 NestJS module 명 (12 개 전수 열거) 만 사용`) 의 **선례 원문**. AC 3 의 화법 승계 판정 재료.
- `docs/architecture/data-model.md` **14 · 40 · 179 행** — **무편집, 읽기만**. T-1426 이 같은 축에서 채택한 `12 NestJS module` in-place 동기 결과 (두 번째 선례).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.21` (INDEX 25 행 판정) · `### 12.26`** 두 절의 화법 template (실측 → 대조표 → 후보 판정표 → 반영 결과 → 무편집 경계 → 파생 영향 → 불변 검산 → 한계) 과 **`## 11. References` (2340 행)** — `§ 12.27` 삽입 위치의 경계.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.27` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.27` 에 기록한다.
  - (i) **축 A 문서 축 전수**: `grep -n '[0-9]\+ NestJS module' docs/architecture/api.md` (기대 **43 · 220** 2 행) 와 `grep -n 'module' docs/architecture/api.md | grep -c ''` 수준의 광범위 grep 이 아닌, **카운트 표기를 가진 행만** 전수. 43 행은 괄호 안 열거를 `/` 로 분해해 **실제 열거 개수** 를 세어 카운트 표기와 일치하는지 별도로 적는다 (기대 — 표기 9 · 열거 9).
  - (ii) **축 A 정본 축**: `sed -n '32,43p' docs/architecture/modules.md | grep -c '^| \*\*'` (기대 **12**) 로 정본 row 수를, 같은 구간에서 **12 module 명 전수** 를 뽑아 (i) 의 9 개 열거와 **차집합** 을 구한다 (기대 — 누락 3 = `PermissionDeniedRecordModule` · `AssessmentCollectionModule` · `AssessmentEvaluationModule`, 정본에 없는데 api.md 에만 있는 이름 **0**). `sed -n '47,48p' modules.md` 로 T-1425 각주 3 module 이 **12 카운트 밖** 임을 인용해 본 slice 가 12 를 쓰는 근거로 삼는다.
  - (iii) **축 B**: `grep -n 'UC-08-permission-denied.md)' docs/architecture/api.md` (기대 **223** 행 1 곳) 로 범위 표기를, `grep -c '9 UC' docs/architecture/api.md` 로 이미 동기된 지점 수를 각각 출력째 인용한다. `ls docs/use-cases/UC-0*.md | wc -l` (기대 **9**) 로 실재 UC 파일 수를 대조한다.
  - (iv) **선례 원문**: [INDEX.md](../use-cases/INDEX.md) **25** 행 (T-1423) 과 [data-model.md](../architecture/data-model.md) **40** 행 (T-1426) 의 동기 결과 원문을 그대로 인용한다 — AC 3 의 화법 승계 판정 재료.
  - (v) **`§ 12.15` 판별**: 편집 후보 3 지점 각각에 대해 **날짜 stamp / 시점 기록 marker 유무** 를 근거로 in-place 동기 / 원문 보존 + 부기 를 판정한 표를 만든다. 특히 **3 행 blockquote** 가 T-1419 시점 기록을 보유한다는 사실과, 43 · 220 · 223 행이 그런 marker 를 갖는지를 각각 1 구로 근거화한다 (marker 보유 지점은 in-place 치환 대신 부기 또는 무편집).
  - (vi) baseline — `wc -l` api.md **230** · audit **2353** · modules.md **259** · data-model.md **193** · INDEX.md **123** · components.md **190**, api.md `grep -c '^## '` **9** · endpoint row (`^| (GET|POST|PATCH|PUT|DELETE) `) **72**, audit `grep -c '^## '` **12** · `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 2 축 대조표**: AC 1 을 **한 표** 로 합쳐 편집 후보 3 지점을 다음 3 구획으로 분류한다.
  - **① 정합** (문서 서술이 정본과 어긋나지 않음 — 기대 **0**, 있으면 그 지점은 무편집).
  - **② 어긋남 — 정본 근거 확보됨** (정본 modules.md 표 12 또는 실재 UC 파일 9 가 대체값을 직접 공급. 기대 **43 · 220 · 223** 3 지점).
  - **③ 어긋남 — 근거 부재** (대체값을 확정할 정본 기재가 없어 본 slice 로 닫을 수 없음. 기대 **0**. 1 개 이상이면 그 지점은 무편집 + 파생 영향으로 이월).
  - 각 ② 지점마다 **대체값** 을 1 구로 적는다 (기대 — 43 = `12 NestJS module` + 12 개 전수 열거, 220 = `12 NestJS module`, 223 = 범위 종단을 `UC-09-user-defined-period-evaluation.md` 로).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구 (애매어 금지). 축 A · 축 B 의 채택안이 서로 달라도 되나 그 경우 각각 판정표를 갖는다.
  - 후보 — (A) **정본값으로 in-place 1:1 치환** (T-1423 · T-1426 선례), (B) **원문 보존 + 행-끝 부기** (T-1427 `B'` 선례 — 시점 기록 marker 보유 지점용), (C) **`§ 9` 말미에 각주 블록 1 개 신설**, (D) **무편집 이월**.
  - 판정 기준 **4 축** 명시: ① **파생 관계** — 본 문서가 스스로 출처를 `modules.md` 라 밝히는 **파생 서술** 인가 (파생이면 정본값 치환이 무모순), ② **cascade** — 채택안이 `§ 5` 합계 (`72 endpoint` / `16 resource prefix` / `9 UC cover`) · `§ 7` cross-reference 표 · 3 행 blockquote 에 **새 stale 을 만드는가**, ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.27` 에 기록), ④ **선례 일관성** — 같은 축을 INDEX 25 행 (T-1423) · data-model 3 지점 (T-1426) 이 이미 처리했으므로 다른 방식을 쓰면 파생 3 문서에 서로 다른 규약이 공존하게 되는가.
  - 43 행의 **괄호 열거** 를 어떻게 할지 (9 개 유지 / 12 개 전수 확장 / 열거 삭제) 를 **별도 1 구** 로 판정한다 — 카운트만 12 로 바꾸고 열거를 9 로 두면 **한 행 안에서 자기모순** 이 되므로 그 조합은 자동 기각.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 편집은 **행 단위 1:1 in-place 또는 행-끝 부기** 이고, 각 지점마다 AC 1 (v) 의 `§ 12.15` 판별 결과를 따른다.
  - 편집 지점 **정확히 3 행 이하** (43 · 220 · 223 중 AC 2 ② 로 판정된 것만), api.md `wc -l` 증가 **+2 이내**.
  - **`§ 5` endpoint 표 (66 ~ 153 행) · `§ 7` cross-reference 표 (179 ~ 197 행) 는 무편집** — row 수 · 합계 수치가 diff 에 미등장.
  - **3 · 12 · 64 · 153 · 208 · 209 행의 `9 UC` 표기는 무편집** (T-1419 가 이미 동기한 지점 — 재서술 금지, 회귀 0 을 hunk 부재로 증명).
  - **`## 8. Out of scope` 절 · `Refs:` 말미 줄은 무편집**.
- [ ] **AC 5 — 무편집 경계**: `src/` · `test/` · `prisma/` · `web/` 일체, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · [directory.md](../architecture/directory.md), `docs/use-cases/INDEX.md`, `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. 이 경계를 `§ 12.27` 에 1 구로 남긴다.
- [ ] **AC 6 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.27` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정 (**11 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 선행 — `§ 12.26` 파생 영향 3), ③ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약 (`§ 12.26` 파생 영향 4), ④ 행 번호 좌표계 → anchor 좌표계 이행 (`§ 12.26` 파생 영향 5 가 **4 회째** 로 셈 — 본 절 append 로 **5 회째**), ⑤ 산문 tally ↔ 표 row 수 CI drift-guard spec (`§ 12.26` 파생 영향 6 — 본 절의 `9 NestJS module` 축도 같은 spec 후보), ⑥ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리 (`§ 12.26` 파생 영향 7), ⑦ api.md **43 행 열거** 에 남는 `AssessmentModule` (정본 39 행 미shipped placeholder) · `SchedulerModule` (실 shipped 명 `SchedulingModule`) 의 **명칭 귀속 축** — 본 slice 는 **카운트 · 열거 집합** 만 정본과 맞추고 개별 명칭의 shipped 정합은 T-1424 가 채택한 `(D) 무편집` / `(B) 병기` 판정을 승계할지 여부를 후속 소관으로 남긴다. 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 8 이 diff 부재로 검증).
- [ ] **AC 7 — audit §12.27 절 신설**: `## 11. References` (**2340** 행) 바로 앞 (= `§ 12.26` 뒤) 에 `### 12.27 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). 구성은 `§ 12.21` · `§ 12.26` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.26` 파생 영향 **1** 을 닫고, 동시에 파생 3 문서 (INDEX · data-model · api) 중 **마지막 미동기 문서** 의 module 어휘 축을 T-1422 정본 12 로 맞춘다는 위치 규정 + 계보), (ii) AC 1 실측 6 항 인용 (`§ 12.15` 판별표 포함), (iii) AC 2 **2 축 대조표** (① ② ③ 구획별 전수 + 차집합 3 module 명시), (iv) AC 3 4 후보 판정표 (기준 4 축 + 괄호 열거 별도 판정) + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점의 in-place/부기 근거), (vi) AC 5 무편집 경계, (vii) AC 6 파생 영향 목록, (viii) **closure 선언** (`§ 12.26` 파생 영향 1 종료 + 파생 3 문서 module 어휘 축 일괄 closure — T-1422 정본 → T-1423 INDEX → T-1426 data-model → T-1429 api 의 계보를 1 구로), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 동기가 **카운트 · 어휘 집합 축** 이라 각 module 명이 실 shipped 코드와 맞는지는 여전히 미검증 (파생 영향 ⑦), ② 파생 문서가 정본을 복제하는 구조 자체가 남아 정본 갱신 시 재-stale 이 반복된다는 구조적 위험 (CI drift-guard 축으로만 닫힘), ③ 채택안이 남긴 미해결.
- [ ] **AC 8 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/api.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일). 불변 — audit `^## ` **12** · `^| REQ-` **66**, api.md `^## ` **9** · endpoint row **72**, `modules.md` `wc -l` **259** · `data-model.md` **193** · `INDEX.md` **123** · `components.md` **190** 무편집. `git diff -U0 -- docs/architecture/api.md | grep '^@@'` 로 hunk 목록을 제시해 AC 4 가 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 9 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` · `test/` · `prisma/` · `web/` 코드 변경 일체** — CI drift-guard spec 신설도 본 slice 밖 (AC 6 ⑤ 로 기록만).
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 6 ②).
- **api.md `§ 5` endpoint 표 · `§ 7` cross-reference 표의 row 신설 · 삭제 · 수치 변경** — 본 slice 는 endpoint 축을 건드리지 않는다 (`72` / `16` / `9 UC cover` 불변).
- **api.md 3 · 12 · 64 · 153 · 208 · 209 행의 `9 UC` 표기 재서술** — T-1419 가 이미 동기한 지점.
- **43 행 열거 안 개별 module 명의 shipped 정합 판정** (`AssessmentModule` placeholder · `SchedulerModule` ↔ `SchedulingModule`) — AC 6 ⑦ 로 기록만.
- **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기** — AC 6 ① 로 기록만.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.26`) 본문 재편집.
- `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 판정** — `§ 12.27` 파생 영향 1, **11 회째 이월**.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트)** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 3 module 의 계상 판정 (`§ 12.27` 파생 영향 2).
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약** — `§ 12.27` 파생 영향 3.
4. **행 번호 좌표계 → anchor 좌표계 이행** — 근거 **5 회 누적** (`§ 12.27` 파생 영향 4). 본 slice 가 43 · 220 · 223 세 행 번호에 전면 의존한 것이 최신 근거.
5. **산문 tally ↔ 표 row 수 CI drift-guard spec** — `N NestJS module` 축과 `UC-NN` 범위 종단 축 둘 다 같은 spec 후보 (`§ 12.27` 파생 영향 5 · 한계 2).
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리 해소** — `§ 12.27` 파생 영향 6.
7. **api.md 43 행 열거의 명칭 귀속 축** — `AssessmentModule` (미shipped placeholder) · `SchedulerModule` (실 shipped 명 `SchedulingModule`) 의 shipped 정합 판정 (`§ 12.27` 파생 영향 7 · 한계 1).
8. **범위 표기 화법 재설계** — 223 행이 고정 종단 (`~ UC-09`) 을 쓰는 한 UC-10 신설 시 동일 stale 재발 (`§ 12.27` 한계 3 (a)).

## 결과 요약 (driver bookkeeping)

- api.md 편집 후보 **3 지점** 을 정본 대조 → **② 어긋남(근거 확보) 3** (`43` · `220` · `223` 행), ① 정합 대조군 7 행, ③ 근거 부재 **0**. 차집합 실측 — 정본 12 − api 9 = `PermissionDeniedRecordModule` · `AssessmentCollectionModule` · `AssessmentEvaluationModule` 3, 역방향 0.
- 4 후보 중 **(A) 정본값 in-place 1:1 치환** 채택 — (B) 부기는 시점 marker 부재로 전제 불성립, (C) 각주는 stale 본문 잔존, (D) 이월은 근거 완비로 기각. 43 행 괄호 열거는 **12 개 전수 확장** (카운트만 바꾸면 자기모순).
- 편집 hunk **3 개**, 순수 삭제 **0**, api.md `wc -l` **230 불변** · `^## ` 9 · endpoint row 72 · `9 UC` 7 행 불변 (회귀 0). audit `§ 12.27` 신설 (References 앞 순수 append 165 행, `^## ` 12 · `^| REQ-` 66 불변).
- `§ 12.26` 파생 영향 1 **closure** + 파생 3 문서 (INDEX · data-model · api) module 어휘 축 **일괄 closure** (T-1422 → T-1423 → T-1426 → T-1429 계보).
- 변경 3 파일. doc-only · production code 0 LOC 이라 `§ 3.2` direct-mode 면제 (R-110 tester · R-112 4 항목 · `test:cov` 전부 **N/A**, 분기 0).
