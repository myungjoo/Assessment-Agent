---
id: T-1428
title: INDEX.md 의 `AssessmentModule` 귀속 3 지점 (§3 산문 58 · 86 행 + §2 표 37 행 UC-07 row) 을 실 shipped module 과 문서↔코드 대조 후 audit §12.26 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1427]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1428-index-md-module-attribution-code-resync.md
plannerNote: "uc-doc-audit-resync 40 번째 slice — §12.25 파생 영향 1 (5 회째 이월) + 4 를 한 파일에서 동시 closure. doc-only 1.6x"
---

# T-1428 — INDEX.md `AssessmentModule` 귀속 3 지점 문서 ↔ 코드 대조

## Why

[T-1427](T-1427-data-model-entity-vs-prisma-model-audit.md) 이 신설한 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.25` 의 **파생 영향 목록** 은 8 항 중 **1** ([INDEX.md](../use-cases/INDEX.md) **58 · 86** 행 `§ 3` 산문의 `AssessmentModule` 귀속 — T-1424 `Follow-up 1` 이후 **5 회째 이월**) 과 **4** ([INDEX.md](../use-cases/INDEX.md) **37** 행 UC-07 row 가 `ExportModule` / `ImportModule` 을 미사용 — `§ 12.23` 파생 영향 6) 을 남겼다. 둘은 **같은 파일 · 같은 뿌리** (문서가 `AssessmentModule` 로 뭉뚱그린 귀속 vs `src/` 실 shipped module) 이므로 본 slice 가 한 번에 닫는다.

축이 지금 닫을 수 있게 된 근거 — [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 [modules.md](../architecture/modules.md) **47 ~ 48** 행에 "정본 표 미기재 실 shipped module 3" (`ExportModule` `src/export/export.module.ts` T-0488 · `ImportModule` `src/import/import.module.ts` T-0489 · `UserInstanceAccessModule` T-0238) 각주를 박제했다. INDEX **37** 행 UC-07 row 의 기존 각주는 "export/import 실 shipped 코드의 module 귀속은 정본 12 표에 아직 미기재라 **후속 slice 소관**" 이라고 적어 두었는데, 그 전제 (가리킬 근거 지점의 부재) 가 T-1425 로 **해소** 됐다.

planner 사전 확인 (executor 가 AC 1 에서 재측정) — `grep -n 'AssessmentModule' docs/use-cases/INDEX.md` 는 **25 · 31 · 32 · 36 · 37 · 38 · 39 · 58 · 86** 행. 이 중 `§ 2` 표 row (31 · 32 · 36 · 38 · 39) 는 이미 **실 shipped 축 병기 각주** 를 보유하나, **37** 행만 "후속 slice 소관" 미완 문구이고, `§ 3` 산문 (**58** UC-01 · **86** UC-08) 은 병기가 **전무** 하다. `src/` 실측으로는 `assessment-collection` · `assessment-evaluation` · `permission-denied` · `export` · `import` 가 실재하고 `src/assessment/` 는 **부재** 다.

본 slice 는 **대조 실판정 + 부기 처리** 이지 module 정본 표 (modules.md) 나 UC 본문의 재배치가 아니다 — 정본 표 row 신설은 `§ 12.25` 파생 영향 5 의 ADR 게이트 소관 그대로 남는다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/INDEX.md` — **본 slice 의 유일한 편집 대상 문서** (123 행). 다음 구간만 읽는다.
  - **19 ~ 27 행** (`## 2. UC 목록 표` column 정의 — 특히 **25** 행 "주요 module = modules.md 의 12 NestJS module 명" 이라는 **어휘 계약**. 본 slice 판정 기준의 근거).
  - **28 ~ 39 행** (표 header 2 줄 + UC-01 ~ UC-09 row 9 줄). 특히 **31 · 32 · 36 · 38 · 39** 행의 **기존 병기 각주 화법** (`실 shipped 는 … 병기는 부기라 §9 의 N module 산정 불변`) 과 **37** 행 UC-07 row 의 미완 문구.
  - **41 ~ 43 행** (T-1412 row 등록 단락 + 21 · 40 행 시점 기록 무편집 선언 — 본 slice 도 그 보존 규약을 승계).
  - **54 ~ 88 행** (`## 3. 각 UC 별 description` 중 **58** UC-01 산문 · **86** UC-08 산문. 나머지 description 은 무편집 대상 확인용으로만).
- `docs/architecture/modules.md` — **무편집, 읽기만**. **22 행** (정본 계상 기준 서술) · **37 · 39 ~ 42 행** (`PermissionDeniedRecordModule` · `AssessmentModule` placeholder · `AssessmentCollectionModule` · `AssessmentEvaluationModule` row) · **47 ~ 48 행** (T-1425 미기재 3 각주와 그 계상 경계) 만.
- `src/` — **무편집, 읽기만**. `ls src/` 1 회 + `ls src/export src/import src/assessment-collection src/assessment-evaluation src/permission-denied 2>&1` 수준의 **존재 확인만**. 파일 본문 통독 금지.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.23` · `### 12.25` 두 절의 화법 template** (실측 → 대조표 → 4 후보 판정표 → 반영 결과 → 무편집 경계 → 파생 영향 → 불변 검산 → 한계) 과 **`## 11. References` (2196 행)** — `§ 12.26` 삽입 위치의 경계.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.26` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.26` 에 기록한다.
  - (i) **문서 축 전수**: `grep -n 'AssessmentModule' docs/use-cases/INDEX.md` 전수 (기대 **9 지점** — 25 · 31 · 32 · 36 · 37 · 38 · 39 · 58 · 86). 각 지점을 **① 어휘 계약 (25)** · **② 표 row 병기 완료 (31 · 32 · 36 · 38 · 39)** · **③ 표 row 미완 (37)** · **④ 산문 병기 전무 (58 · 86)** 4 구획으로 분류한 표를 만든다.
  - (ii) **코드 축**: `ls -d src/*/ | wc -l` 과 `ls -d src/assessment* src/permission-denied src/export src/import 2>&1` 로 실 shipped 디렉토리 존재를, `ls -d src/assessment 2>&1` 로 `src/assessment/` **부재** 를 각각 출력째 인용한다.
  - (iii) **정본 근거 지점**: `grep -n 'ExportModule\|ImportModule' docs/architecture/modules.md` (기대 **47** 행 T-1425 각주) 와 `grep -n 'PermissionDeniedRecordModule\|AssessmentCollectionModule\|AssessmentEvaluationModule' docs/architecture/modules.md` 로, 본 slice 가 INDEX 에서 **가리킬 근거 행번호** 를 확정해 원문 일부와 함께 인용한다.
  - (iv) **기존 화법 원문**: **31** · **38** 행 병기 각주의 원문 (표 row 가 이미 채택한 `실 shipped 는 … / 병기는 부기라 §9 의 N module 산정 불변` 화법) 과 **37** 행 미완 문구 원문을 그대로 인용한다 — AC 3 의 화법 승계 판정 재료.
  - (v) **`§ 12.15` 판별**: (i) ③ ④ 각 지점에 대해 **날짜 stamp 유무** 를 근거로 append / in-place 를 판정한 표를 만든다. **58 · 86** 행은 T-0019 시점 산문이므로 **원문 한 글자도 바꾸지 않고 문장 뒤에 부기** 하는 방식이 성립하는지 1 구로 근거화한다 (성립 안 하면 그 지점은 무편집).
  - (vi) baseline — `wc -l` INDEX.md **123** · audit **2209** · modules.md **259** · data-model.md **193**, INDEX `grep -c '^## '` **5** · `grep -c '^| UC-'` **9**, audit `grep -c '^## '` **12** · `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 3 축 대조표**: AC 1 (i) (ii) (iii) 을 **한 표** 로 합쳐 INDEX 의 각 `AssessmentModule` 지점을 다음 3 구획으로 분류한다.
  - **① 정합** (문서 서술이 실 shipped 와 어긋나지 않음 — 어휘 계약 25 행 · 병기 완료 5 row).
  - **② 어긋남 — 근거 지점 확보됨** (문서가 실 shipped 를 가리키지 못하나 modules.md 에 가리킬 각주/row 가 이미 존재. 기대 **37 · 58 · 86** 3 지점).
  - **③ 어긋남 — 근거 지점 부재** (가리킬 정본 기재가 없어 본 slice 로 닫을 수 없음. 기대 **0**. 1 개 이상이면 그 지점은 무편집 + 파생 영향으로 이월).
  - 각 ② 지점마다 **어느 module 이 실 shipped 축인지** 를 1 구로 적는다 (기대 — **37** = `ExportModule` / `ImportModule` (modules.md 47 행 각주), **58** = `AssessmentCollectionModule` + `AssessmentEvaluationModule`, **86** = `PermissionDeniedRecordModule`).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구 (애매어 금지).
  - 후보 — (A) **`AssessmentModule` 표기를 실 shipped module 명으로 치환**, (B) **원문 보존 + 문장 뒤 부기** (표 row 31 · 38 이 이미 채택한 화법 승계), (C) **`§ 3` 말미에 각주 블록 1 개 신설해 3 지점을 한 곳에서 설명**, (D) **무편집 이월**.
  - 판정 기준 **4 축** 명시: ① **어휘 계약** — 25 행이 못박은 "주요 module = modules.md 의 **12** NestJS module 명" 을 채택안이 깨는가 (미기재 module 명을 본문 어휘로 승격시키면 정본 표 row 신설과 동치라 자동 기각), ② **cascade** — 채택안이 각 UC 본문 (`UC-01` / `UC-07` / `UC-08`) `§ 9` 의 module 산정 수치, [modules.md](../architecture/modules.md) `12 module` 산문, [components.md](../architecture/components.md) mapping 에 **새 stale 을 만드는가**, ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.26` 에 기록), ④ **선례 일관성** — 같은 표 안 5 row 가 이미 채택한 화법과 다른 방식을 쓰면 한 문서 안에 두 규약이 공존하게 되는가.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 편집은 **행 단위 1:1 in-place 또는 순수 append** 이고, 각 지점마다 AC 1 (v) 의 `§ 12.15` 판별 결과를 따른다.
  - 편집 지점 **정확히 3 행 이하** (37 · 58 · 86 중 AC 2 ② 로 판정된 것만), INDEX.md `wc -l` 증가 **+2 이내**.
  - **21 · 40 행의 `UC-01 ~ UC-08` / `총 8 UC` 시점 기록은 무편집** (T-1412 가 명시 보존 선언한 지점 — 건드리면 그 slice 의 판정을 뒤집는다).
  - **표 row 31 · 32 · 36 · 38 · 39 의 기존 병기 각주는 무편집** — 이미 정합 판정 (AC 2 ①) 이라 재서술 금지.
  - **`## 4. References` 이후 · 갱신 룰 절은 무편집**.
- [ ] **AC 5 — 무편집 경계**: `src/` · `test/` · `prisma/` 일체, `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md`, `docs/use-cases/UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, `docs/PLAN.md`, `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. 이 경계를 `§ 12.26` 에 1 구로 남긴다.
- [ ] **AC 6 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.26` 에 남긴다 — 최소 ① [api.md](../architecture/api.md) **223 행** `UC-01 ~ UC-08` 링크 범위 vs 9 UC (`§ 12.25` 파생 영향 2), ② [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정 (**10 회째 이월**), ③ 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 선행 — `§ 12.25` 파생 영향 5), ④ 외부 package module 계상 규약 (`§ 12.25` 파생 영향 6), ⑤ 행 번호 좌표계 → anchor 좌표계 이행 (근거 **3 회 누적** — 본 slice 의 append 가 INDEX 좌표를 다시 shift 시키면 4 회째), ⑥ 산문 tally ↔ 표 row 수 CI drift-guard spec (`§ 12.25` 파생 영향 8 · 한계 2), ⑦ 각 UC 본문 `§ 9` module 산정 수치가 INDEX 병기와 별개 좌표계라는 미해소 이중 관리. 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 8 이 diff 부재로 검증).
- [ ] **AC 7 — audit §12.26 절 신설**: `## 11. References` (**2196** 행) 바로 앞 (= `§ 12.25` 뒤) 에 `### 12.26 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). 구성은 `§ 12.23` · `§ 12.25` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.25` 파생 영향 **1** (5 회째 이월) 과 **4** 를 동시에 닫는다는 위치 규정 + T-1425 modules.md 47 행 각주가 근거 지점을 공급했기에 지금 닫힌다는 계보), (ii) AC 1 실측 6 항 인용 (`§ 12.15` 판별표 포함), (iii) AC 2 **3 축 대조표** (① ② ③ 구획별 전수), (iv) AC 3 4 후보 판정표 (기준 4 축 명시) + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점의 append/in-place 근거), (vi) AC 5 무편집 경계, (vii) AC 6 파생 영향 목록, (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 본 대조가 **module 명 축** 이라 각 UC 산문이 서술한 **동작·책임** 이 실 코드와 맞는지는 여전히 미검증, ② INDEX 병기와 각 UC 본문 `§ 9` 산정 수치가 서로 다른 좌표계라 한쪽만 갱신되는 구조적 재-stale 위험, ③ 채택안이 남긴 미해결 지점.
- [ ] **AC 8 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/use-cases/INDEX.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일). 불변 — audit `^## ` **12** · `^| REQ-` **66**, INDEX `^## ` **5** · `^| UC-` **9**, `modules.md` `wc -l` **259** · `data-model.md` **193** 무편집. `git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'` 로 hunk 목록을 제시해 AC 4 가 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 9 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` · `test/` · `prisma/` 코드 변경 일체** — CI drift-guard spec 신설도 본 slice 밖 (AC 6 ⑥ 로 기록만).
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 6 ③).
- **`UC-01` ~ `UC-09` 본문 편집 일체** — 특히 각 `§ 9` module 산정 수치 갱신 (AC 6 ⑦ 로 기록만).
- **[api.md](../architecture/api.md) · [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) 편집** — AC 6 으로 기록만.
- **INDEX **21 · 40** 행 시점 기록 정정** — T-1412 가 보존 선언한 지점.
- **INDEX `§ 2` 표 row 의 `주요 module` 컬럼 값 자체 치환** — 어휘 계약 (25 행) 상 정본 12 명만 사용하므로 AC 3 ① 기준으로 자동 기각 대상.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.25`) 본문 재편집.
- `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **UC 산문의 동작·책임 서술 대조** — 본 slice 는 **module 명 축** 만 닫았다. 58 행 "3 GitHub instance + Confluence + LLM gateway 를 거쳐 … 생성" · 86 행 "event 를 받아 DB 에 기록" 같은 **책임 서술** 이 실 service / controller 와 부합하는지는 미검증 (`§ 12.26` 한계 1).
2. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — `§ 12.26` 파생 영향 1 (5 회째 이월 축과 별개 잔여).
3. **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 판정** — `§ 12.26` 파생 영향 2, **10 회째 이월**.
4. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트)** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 3 module 의 정본 계상 판정. module · entity · UC 3 축이 한 ADR 로 닫혀야 한다 (`§ 12.26` 파생 영향 3 · closure 선언 3).
5. **행 번호 좌표계 → anchor 좌표계 이행** — 근거 **4 회 누적** (`§ 12.26` 파생 영향 5).
6. **문서 tally ↔ 코드 실측 CI drift-guard spec** — `ls -d src/*/` vs 문서 module 명 축도 같은 spec 후보 (`§ 12.26` 파생 영향 6 · 한계 2).
7. **INDEX 병기 ↔ 각 UC 본문 `§ 9` 산정 이중 관리 해소** — `§ 12.26` 파생 영향 7.
