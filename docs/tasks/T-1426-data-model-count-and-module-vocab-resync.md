---
id: T-1426
title: data-model.md 의 `13 entity` 2 지점 · `4 module` · `8 NestJS module 명` 3 지점을 실측 정본과 대조 판정 후 동기 + audit §12.24 기록
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-08-03
completedAt: 2026-08-03T13:47:00Z
independentStream: uc-doc-audit-resync
dependsOn: [T-1425]
touchesFiles:
  - docs/architecture/data-model.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1426-data-model-count-and-module-vocab-resync.md
plannerNote: "uc-doc-audit-resync 38 번째 slice — T-1425 §12.23 파생 영향 ② ③ 동시 closure. 자기 표 실측 2 축 + 정본 12 파생 1 축. doc-only 1.6x"
---

# T-1426 — data-model.md 수치·module 어휘 3 축 정합

## Why

[T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 정본 [modules.md](../architecture/modules.md) 를 코드 축과 대조해 미기재 3 module 을 각주로 흡수하면서, `§ 12.23` 파생 영향 목록에 **② [data-model.md](../architecture/data-model.md) 의 `8 NestJS module 명` 표기** 와 **③ `13 entity` vs 실 entity row 14** 를 후속 slice 소관으로 남겼다. 본 slice 가 그 두 축을 한 문서 안에서 닫는다.

- 축 A (자기 표 정합) — planner 사전 확인 (executor 가 AC 1 에서 재측정): `§ 2` 표의 실체 entity row 는 **22 ~ 35 행 14 개** 인데 **18 행** 과 **38 행** 두 곳이 `13 entity` 로 서술한다. 38 행의 이력 서술 (`10 → 11`, `11 → 13`) 자체는 시점 기록이라 무편집 대상이지만, 앞머리 tally 는 living 수치다.
- 축 B (파생 어휘) — **14 · 40 · 179 행** 이 정본 module 집합을 `8 NestJS module 명` 으로 인용한다. 정본은 [T-1422](T-1422-modules-md-module-count-resync.md) 가 **12** 로 확정했고 [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 미기재 **3** 을 각주로 덧붙인 상태라, 파생 인용이 두 세대 뒤처져 있다. [T-1423](T-1423-index-module-vocabulary-resync.md) 이 [INDEX.md](../use-cases/INDEX.md) 25 행에서 같은 성격의 삼중 어긋남을 닫은 것과 동형이다.
- 본 문서는 3 행이 스스로 **living document** 로 선언한 문서라 [`§ 12.15`](../use-cases/REQ-COVERAGE-AUDIT.md) 판별 (날짜 stamp 있는 시점 기록 = append / 없는 living 서술 = in-place) 적용 대상이 분명하다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/data-model.md` — **본 slice 의 유일한 편집 대상 문서**. 다음 구간만 읽는다.
  - **3 행** (living document 선언 + [T-1419](T-1419-eight-uc-notation-bulk-resync.md) 가 append 한 UC 표기 이력 — `13 entity` / `4 module` 불변 선언 포함) · **7 행** (MVA conceptual-only 범위) · **14 행** (References 성격의 `8 NestJS module` 인용).
  - **16 ~ 40 행** (`## 2. Entity 목록` — **18** 행 서두 `13 entity (+ 1 conceptual mention)`, **20** 행 표 header, **22 ~ 36 행** row, **38** 행 `**합계**` 산문, **40** 행 `**module 명 정합성**` 산문).
  - **173 ~ 190 행** (`## 8. References` — 특히 **179** 행의 `8 NestJS module 명`).
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (정본 12 row) · **45 행** (`위 12 module 은 AppModule …`) · **47 ~ 48 행** ([T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 신설한 미기재 3 각주 — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 과 그 계상 경계 서술).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1741 ~ 1864 행** (`### 12.23` — T-1425 판정 원문 + 파생 영향 ② ③ 의 원 서술 + 화법 template), **1505 ~ 1612 행** (`### 12.21` — 파생 문서 어휘 동기의 선례), **1865** 행 (`## 11. References` — `§ 12.24` 삽입 위치의 경계).
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [x] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.24` 에 **명령과 출력을 함께** 인용한다. 모든 명령은 [T-1424](T-1424-index-uc-row-module-attribution-audit.md) `Follow-up 7` 이 요구한 **scope 포함 형태** (`sed -n '<from>,<to>p' <file> | grep …`) 로 적는다 (무-scope grep 이 다른 표까지 합산해 20 을 냈던 사고의 재발 방지). 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.24` 에 기록한다.
  - (i) **축 A 원자료 — `§ 2` 표 실체 row 수**: `sed -n '22,36p' docs/architecture/data-model.md | grep -c '^| \*\*'` = **14** (기대) 와 그 14 개 entity 명 전수. 추가로 `sed -n '22,36p' … | grep -c '(conceptual mention)'` = **1** (AuditLog — 실체 계상 대상 아님) 을 별도 인용해 `(+ 1 conceptual mention)` 표기의 짝이 유지됨을 보인다.
  - (ii) **축 A 서술 지점**: `grep -n '13 entity' docs/architecture/data-model.md` 로 **18 · 38** 두 행을 확정하고 각 행 원문을 인용. 세 번째 지점이 나오면 그것도 포함한다.
  - (iii) **축 A 부수 수치 — `4 module`**: `sed -n '22,36p' … | awk -F'|' '{print $NF}' | sort -u` (또는 동등 명령) 로 "책임 module" 컬럼의 **distinct 값 전수** 를 뽑아 38 행이 열거한 `4 module (UserModule / AuthModule / AssessmentModule / LlmModule)` 과 대조한다. 어긋나면 축 A-2 로 별도 판정, 일치하면 "일치 — 무편집" 을 1 구로 기록.
  - (iv) **축 B 원자료 — 정본 현행값**: `sed -n '32,43p' docs/architecture/modules.md | grep -c '^| \*\*'` = **12** (기대) 와, `sed -n '47,48p' docs/architecture/modules.md | grep -c 'ExportModule'` ≥ **1** (T-1425 각주 실재) 를 인용.
  - (v) **축 B 서술 지점**: `grep -n '8 NestJS module' docs/architecture/data-model.md` 로 **14 · 40 · 179** 세 행 (기대 **3** 지점) 을 확정하고 각 행 원문을 인용.
  - (vi) **`§ 12.15` 판별**: (ii) · (v) 가 확정한 각 지점에 대해 **날짜 stamp 유무** 를 근거로 append / in-place 를 판정한 표를 만든다. 특히 **38 행** 은 앞머리 tally (living) 와 뒤쪽 이력 서술 (`10 → 11` · `11 → 13` — 시점 기록) 이 **한 행에 공존** 하므로, 이력 문장은 **한 글자도 바꾸지 않고** tally 만 고치는 방식이 성립하는지 1 구로 근거화한다 (성립 안 하면 그 지점은 append 로 처리).
  - (vii) baseline — `wc -l` data-model.md **190** · modules.md **259** · audit **1878**, data-model `grep -c '^## '` **8**, audit `grep -c '^## '` **12** · `grep -c '^| REQ-'` **66**, `docs/use-cases/INDEX.md` `wc -l` **123** · `grep -c '^| UC-'` **9**.
- [x] **AC 2 — 축별 처리 방식 판정**: AC 1 이 확정한 축마다 후보 3 개 중 **채택 1 · 기각 2** 인 판정표를 만든다. 기각마다 근거 1 구 (애매어 금지).
  - 축 A (`13 entity`) 후보 — (A1) **실측값으로 수치 정정** (`13` → 실측값, 두 지점 동시 + 시점 이력 문장 무편집), (A2) **각주/부기로 흡수** (수치 무편집 + 어긋남 사실만 명시), (A3) **무편집 이월** (실측·판정만 audit 에).
  - 축 B (`8 NestJS module 명`) 후보 — (B1) **정본 현행값으로 치환** (`8` → `12`, 3 지점 동시, 필요 시 T-1425 각주 3 의 계상 경계 1 구 부기), (B2) **카운트 제거·서술화** (수치를 빼고 "modules.md 의 정본 module 명만 사용" 으로), (B3) **무편집 이월**.
  - 판정 기준 **3 축** 명시: ① **사실 흡수** — 채택안이 본 문서만 읽는 독자에게 정확한 수치를 주는가, ② **cascade** — 채택안이 [modules.md](../architecture/modules.md) · [INDEX.md](../use-cases/INDEX.md) · [api.md](../architecture/api.md) · [components.md](../architecture/components.md) 에 **새 stale 을 만드는가** (만들면 그 후보 기각 또는 같은 slice 안 closure 를 조건화), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 ≤ 3 (본 slice 는 파일 3 개로 고정 — 초과하는 후보는 자동 기각 + split 제안을 `§ 12.24` 에 기록).
  - 축 B 채택안이 `12` 를 쓸 경우, **T-1425 각주 3 을 카운트에 포함하지 않는다** 는 경계 (modules.md 48 행이 명시) 를 반드시 계승해야 함을 1 구로 못박는다.
- [x] **AC 3 — 채택안 반영**: AC 2 채택안대로만 편집한다. 편집은 **행 단위 1:1 in-place 또는 순수 append** 이고, 각 지점마다 AC 1 (vi) 의 `§ 12.15` 판별 결과를 따른다.
  - 편집 지점 총합 **≤ 6 행**, data-model.md `wc -l` 증가 **+3 이내**.
  - **`§ 2` 표 row (22 ~ 36 행) 자체는 무편집** — 본 slice 는 수치·어휘 서술의 정합만 다루고 entity 의 추가·삭제·책임 재배치를 선언하지 않는다.
  - 38 행을 편집하는 경우 이력 문장 (`10 → 11` · `11 → 13`) 은 **원문 보존** 이고, 새 shift 근거는 [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) · 본 task 링크와 함께 **덧붙이는** 형태여야 한다.
- [x] **AC 4 — 무편집 경계**: `src/` · `test/` · `prisma/` 일체, `docs/architecture/modules.md` · `components.md` · `api.md`, `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, `docs/PLAN.md`, `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. data-model.md 안에서도 **`§ 3` (42 ~ 83 행) mermaid ER diagram · `§ 4` ~ `§ 7` (84 ~ 172 행)** 은 무편집. 이 경계를 `§ 12.24` 에 1 구로 남긴다.
- [x] **AC 5 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.24` 에 남긴다 — 최소 ① [INDEX.md](../use-cases/INDEX.md) **58 · 86 행** §3 산문의 `AssessmentModule` 귀속 (T-1424 Follow-up 1, 4 회째 이월), ② [api.md](../architecture/api.md) **223 행** `UC-01 ~ UC-08` 링크 범위 vs 9 UC, ③ UC-09 `§ 5` sequence participant 병기 미판정 (8 회째 이월), ④ INDEX **37 행** UC-07 row 의 `ExportModule` / `ImportModule` 미사용, ⑤ 정본 표 row 신설 축 (T-1425 Follow-up 2 의 3 slice split — ADR 선행), ⑥ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약 미판정 (T-1425 Follow-up 3), ⑦ 행 번호 좌표계 → anchor 좌표계 이행 (T-1425 Follow-up 4). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 7 이 diff 부재로 검증).
- [x] **AC 6 — audit §12.24 절 신설**: `## 11. References` (**1865** 행) 바로 앞 (= `§ 12.23` 뒤) 에 `### 12.24 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). 구성은 `§ 12.22` · `§ 12.23` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 7 항 인용 (`§ 12.15` 판별표 포함), (iii) AC 2 축별 판정표 (기준 3 축 명시) + 채택 결론, (iv) AC 3 반영 결과 (편집 지점 목록 + 각 지점의 append/in-place 근거), (v) AC 4 무편집 경계, (vi) AC 5 파생 영향 목록, (vii) [T-1425](../tasks/T-1425-modules-md-shipped-module-inventory-audit.md) `§ 12.23` 파생 영향 **② ③ 의 처리 결과 선언**, (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 파생 문서의 수치 인용은 정본이 바뀔 때마다 재stale 이 되는 구조라 사람 규약보다 CI drift-guard spec 이 견고하다는 축 (T-1425 Follow-up 5 와 동형), ② 본 slice 가 `§ 2` 표 row 자체는 검증하지 않아 "표 row ↔ `prisma/schema.prisma` 실 model" 축은 여전히 미대조, ③ 채택안이 남긴 미해결 지점.
- [x] **AC 7 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/data-model.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일). 불변 — audit `^## ` **12** · `^| REQ-` **66**, data-model `^## ` **8** · `sed -n '22,36p' … | grep -c '^| \*\*'` **14** (표 row 무편집), `modules.md` **259** · `INDEX.md` **123** · `components.md` **190** 무편집. `git diff -U0 -- docs/architecture/data-model.md | grep '^@@'` 로 hunk 목록을 제시해 AC 3 이 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [x] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` · `prisma/` 코드 변경 일체** — entity 신설 · `schema.prisma` model 추가 · module 재배치. 본 slice 는 문서 수치 정합만.
- **`§ 2` 표 row 추가 / 삭제 / 책임 module 컬럼 값 변경** — entity 집합 변경은 ADR + 코드 게이트 소관.
- **[modules.md](../architecture/modules.md) 편집** — 정본 표 row 신설 축은 T-1425 Follow-up 2 의 3 slice split (ADR 선행) 소관. 본 slice 는 읽기만.
- **[INDEX.md](../use-cases/INDEX.md) · [api.md](../architecture/api.md) · [components.md](../architecture/components.md) 편집** — AC 5 ① ② ④ 로 기록만.
- **UC-01 ~ UC-09 본문 편집 일체** — 어긋남이 실측되어도 AC 5 에 기록만.
- **`§ 2` 표 row ↔ `prisma/schema.prisma` 실 model 대조** — 문서 ↔ 코드 축의 별도 slice (AC 6 한계 ②).
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.23`) 본문 재편집.
- `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## 결과 요약 (2026-08-03)

- **실측 (AC 1)** — `sed -n '22,36p' docs/architecture/data-model.md | grep -c '^| \*\*'` = **14** (기대 일치, conceptual mention 1 = AuditLog 별도) · `grep -n '13 entity'` = **3 · 18 · 38** (task 가 예상한 2 지점이 아니라 **3 지점**) · `grep -n '8 NestJS module'` = **14 · 40 · 179** (기대 일치, 단 § 12.22 · § 12.23 이 인용해 온 `39` 행은 실좌표 **40** 행) · `sed -n '32,43p' docs/architecture/modules.md | grep -c '^| \*\*'` = **12** · T-1425 각주 실재 확인. baseline 9 값 전부 기대 일치 → 축 중단 사유 0.
- **축 A-2 (`4 module`)** — 책임 module 컬럼 distinct 값이 정확히 `UserModule / AuthModule / AssessmentModule / LlmModule` **4** 로 38 행 열거와 완전 일치 → **무편집**.
- **판정 (AC 2)** — 축 A 는 **(A1) 실측값 정정** 채택 (A2 각주 / A3 이월 기각), 축 B 는 **(B1) 정본값 치환** 채택 (B2 서술화 / B3 이월 기각). 기준 3 축 = 사실 흡수 · cascade · cap. cap 초과 자동 기각 후보 0.
- **반영 (AC 3)** — [data-model.md](../architecture/data-model.md) **14 · 18 · 38 · 40 · 179** 5 지점 전부 **행 단위 1:1 in-place 치환** (`13 entity` → `14 entity` 2 곳, `8 NestJS module` → `12 NestJS module` 3 곳). **3 행 blockquote 는 T-1419 시점 기록이라 보존**, **38 행 shift 이력 (`10 → 11` · `11 → 13`) 은 원문 그대로** 두고 그 뒤에 T-1426 shift 근거만 덧붙임. § 2 표 row · § 3 mermaid · § 4 ~ § 7 무편집. `wc -l` **190 불변** (+0).
- **audit (AC 6)** — `### 12.24` 를 `## 11. References` 앞에 순수 append (150 행, 1878 → 2028). `^## ` **12 불변** · `^| REQ-` **66 불변**.
- **검산 (AC 7)** — `git status --porcelain` 변경 파일 **정확히 3 개**. `git diff --numstat` = data-model.md `5 5` (추가 = 삭제 → **순수 삭제 0**) + audit `150 0` + 본 task 파일. hunk 5 개 (`@@ -14 +14 @@` · `-18 +18` · `-38 +38` · `-40 +40` · `-179 +179`) 전부 AC 3 허용 지점과 1:1. `modules.md` 259 · `INDEX.md` 123 · `components.md` 190 무편집.
- **AC 8** — `commitMode: direct` + production code **0 LOC** · 분기 0 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 doc-only 면제 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 전부 **N/A**.

## Follow-ups

1. **`§ 2` 표 row ↔ `prisma/schema.prisma` 실 model 대조** — 본 slice 는 표 row 수 14 를 문서 안에서만 확정했다. 38 행 스스로 "ExportJob/ImportJob 의 구체 Prisma schema 코드·migration 은 후속 task" 라 적어 문서 ↔ 코드 불일치가 예고된 상태 (§ 12.24 한계 2). § 12.23 이 module 축에서 한 대조를 entity 축에서 수행하는 별도 slice 필요.
2. **산문 tally ↔ 표 row 수 CI drift-guard spec** — 축 A 가 6 회 이월되는 동안 아무도 catch 하지 못했다. `sed -n '22,36p' … | grep -c '^| \*\*'` 와 18 · 38 행 tally 를 대조하는 spec 이 사람 규약보다 견고 (§ 12.24 한계 1, T-1425 Follow-up 5 와 동형 — 두 축을 한 spec 으로 묶는 안 검토).
3. **시점 기록 marker 규약** — data-model.md **3** 행이 `13 entity` 를 담은 채 보존돼 통독 독자에게 18 · 38 행 (14) 과 표면상 모순으로 보인다. § 12.15 판별상 보존이 옳으나 "시점 기록임" 이 문장 안에서 자명하지 않다 (§ 12.24 한계 3 (a)). 명시적 marker 표기 규약 신설 검토.
4. **행 번호 좌표계 오차의 두 번째 발현** — § 12.22 · § 12.23 이 data-model.md 의 축 B 지점을 `39` 행으로 인용했으나 실좌표는 **40** 행이었다. T-1425 Follow-up 4 (anchor 좌표계 이행) 의 근거가 하나 더 쌓였다.
5. **잔여 파생 영향 7 항** — § 12.24 파생 영향 목록 1 ~ 7 (INDEX 58 · 86 행 §3 산문 4 회째 이월 / api.md 223 행 / UC-09 §5 participant 8 회째 이월 / INDEX 37 행 UC-07 row / 정본 표 row 신설 3 slice split / 외부 package module 계상 규약 / anchor 좌표계) 이 후속 slice 소관으로 이월된다.
