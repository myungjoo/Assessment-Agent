---
id: T-1427
title: data-model.md `§ 2` 14 entity 표를 `prisma/schema.prisma` 15 model 과 3 축 대조 실판정 + 문서 축 처리 후 audit §12.25 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1426]
touchesFiles:
  - docs/architecture/data-model.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1427-data-model-entity-vs-prisma-model-audit.md
plannerNote: "uc-doc-audit-resync 39 번째 slice — T-1426 Follow-up 1 (entity 축 문서↔코드 대조). T-1425 modules 축 3 축 대조의 entity 판. doc-only 1.6x"
---

# T-1427 — `§ 2` entity 표 vs `prisma/schema.prisma` 실 model 3 축 대조

## Why

[T-1426](T-1426-data-model-count-and-module-vocab-resync.md) 이 [data-model.md](../architecture/data-model.md) 의 `13 entity` tally 를 표 실측 **14** 로 정정하면서, `§ 12.24` 한계 ② 와 `Follow-up 1` 로 **"표 row 자체가 `prisma/schema.prisma` 실 model 과 대조된 적이 없다"** 를 남겼다. 본 slice 가 그 축을 닫는다 — [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 가 module 축에서 수행한 **문서 ↔ 코드** 3 축 대조 (`modules.md` 정본 12 vs `src/*/*.module.ts` 14) 의 **entity 판**이다.

planner 사전 확인 (executor 가 AC 1 에서 재측정) — `grep -c '^model ' prisma/schema.prisma` = **15**, `§ 2` 표 실체 row = **14**. 즉 두 집합의 cardinality 가 어긋나며, 코드 only 후보로 **`UserInstanceAccess`** (schema.prisma 234 행) 가 잡힌다. 또한 **38 행** 과 **171 행 (`§ 7`)** 이 `ExportJob` / `ImportJob` 의 "구체 Prisma schema 코드·migration 은 후속 task" 라고 **미구현을 전제한 서술** 을 담고 있으나 코드에는 `model ExportJob` (614 행) · `model ImportJob` (649 행) 이 실재한다 — 문서가 코드보다 뒤처진 두 번째 축이다.

본 문서 **7 행** 이 스스로 범위를 **MVA conceptual model only** (구체 컬럼 type · index · Prisma schema 코드 · migration SQL 은 범위 밖) 로 못박았으므로, 본 slice 는 **대조 실판정 + 문서 축 처리** 이지 schema 코드를 문서로 끌어오는 작업이 아니다. `prisma/schema.prisma` 는 **read-only 대조 입력**.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `prisma/schema.prisma` — **무편집, 읽기만**. 전문 통독 금지. `grep -n '^model '` 로 얻은 **15 개 model 선언 행** 과 각 model 의 **선언 행 ± 3 행** (관계·주석으로 책임을 판단할 최소 범위) 만 읽는다. 특히 **234 행 `model UserInstanceAccess`** · **614 행 `model ExportJob`** · **649 행 `model ImportJob`** 주변.
- `docs/architecture/data-model.md` — **본 slice 의 유일한 편집 대상 문서**. 다음 구간만 읽는다.
  - **3 행** (living document 선언 + 시점 기록 blockquote — 무편집 대상) · **7 행** (MVA conceptual-only 범위 선언 — 본 slice 판정 기준의 근거) · **11 행** (ADR-0002 `schema.prisma` 가 conceptual model 의 실 구현 form 이라는 서술).
  - **16 ~ 41 행** (`## 2. Entity 목록` — **18** 행 tally, **20 ~ 21** 행 표 header, **22 ~ 36 행** row 15 줄 (실체 14 + `*(conceptual mention)*` AuditLog 1), **38** 행 합계 산문 (`10 → 11 → 13` 이력 + T-1426 정정 문장), **40** 행 module 명 정합성 산문).
  - **154 ~ 172 행** (`## 7. Out of scope` — 특히 **158** · **162** · **171** 행).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **1741 ~ 1864 행** (`### 12.23` — T-1425 의 문서↔코드 3 축 대조 화법 template + 4 후보 판정표 형식), **1865 ~ 2014 행** (`### 12.24` — T-1426 판정 원문 + 한계 ② 원 서술), **2015** 행 (`## 11. References` — `§ 12.25` 삽입 위치의 경계).
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.25` 에 **명령과 출력을 함께** 인용한다. 모든 명령은 [T-1424](T-1424-index-uc-row-module-attribution-audit.md) `Follow-up 7` 이 요구한 **scope 포함 형태** (`sed -n '<from>,<to>p' <file> | grep …`) 로 적는다 (무-scope grep 이 다른 표까지 합산해 20 을 냈던 사고의 재발 방지). 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.25` 에 기록한다.
  - (i) **코드 축 전수**: `grep -n '^model ' prisma/schema.prisma` 로 **15** 개 model 명 + 행번호 전수를 인용 (`grep -c` 결과 **15** 병기).
  - (ii) **문서 축 전수**: `sed -n '22,36p' docs/architecture/data-model.md | grep -c '^| \*\*'` = **14** (기대) 와 그 14 개 entity 명 전수. 추가로 `sed -n '22,36p' … | grep -c '(conceptual mention)'` = **1** (AuditLog) 을 별도 인용해 실체 계상과 conceptual 계상을 분리한다.
  - (iii) **tally 서술 지점**: `grep -n '14 entity' docs/architecture/data-model.md` 로 T-1426 이 정정한 지점 (기대 **18 · 38**) 을 확정하고 원문 인용. `grep -n '13 entity'` 로 **3** 행 시점 기록 blockquote 가 보존돼 있음도 함께 확인 (무편집 대상 확인용).
  - (iv) **축 B 원자료 — 미구현 전제 서술**: `grep -n 'ExportJob' docs/architecture/data-model.md` 로 지점 전수를 뽑고, 그 중 **"후속 task" / "범위 밖" 으로 미구현을 전제한 행** (기대 **38 · 171**) 을 원문과 함께 인용. 코드 측 `sed -n '614p;649p' prisma/schema.prisma` 출력을 나란히 붙여 어긋남을 **한 표에서** 보인다.
  - (v) **`§ 12.15` 판별**: (iii) · (iv) 가 확정한 각 지점에 대해 **날짜 stamp 유무** 를 근거로 append / in-place 를 판정한 표를 만든다. **38 행** 은 이력 문장 (`10 → 11` · `11 → 13`) 과 T-1426 정정 문장이 공존하므로 **한 글자도 바꾸지 않고 덧붙이는** 방식이 성립하는지 1 구로 근거화한다 (성립 안 하면 그 지점은 무편집).
  - (vi) baseline — `wc -l` data-model.md **190** · schema.prisma **666** · audit **2028**, data-model `grep -c '^## '` **8**, audit `grep -c '^## '` **12** · `grep -c '^| REQ-'` **66**, `modules.md` **259** · `INDEX.md` **123** · `components.md` **190**.
- [ ] **AC 2 — 3 축 대조표**: AC 1 (i) (ii) 를 **한 표** 로 합쳐 각 model / entity 를 다음 3 구획 중 하나로 분류한다. 분류는 **명칭 exact match** 를 1 차 기준으로 하고, 명칭이 다르나 동일 개념으로 판단되는 짝이 있으면 그 근거를 1 구로 적는다.
  - **① 일치** (코드 model ∧ 문서 실체 row) — 기대 14.
  - **② 문서 only** (문서 실체 row ∧ 코드 model 부재) — 기대 0. `*(conceptual mention)*` AuditLog 는 실체 row 가 아니므로 **별도 3 행 이내 단락** 으로 "코드 미실재 = 설계 의도대로 정합" 임을 근거화하고 ② 에 계상하지 않는다.
  - **③ 코드 only** (코드 model ∧ 문서 row 부재) — 기대 1 (`UserInstanceAccess`). 각 항목에 대해 **어느 module 소관인지** ([modules.md](../architecture/modules.md) 47 ~ 48 행 T-1425 각주의 `UserInstanceAccessModule` 과의 대응) 를 1 구로 적는다.
- [ ] **AC 3 — 축별 처리 방식 판정**: 어긋남 축마다 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구 (애매어 금지).
  - 축 ③ (코드 only) 후보 — (A) **`§ 2` 표에 row 신설** + tally **14 → 15** 다축 동기, (B) **표 직후 각주 추가** (row 무신설 · tally 불변 — [T-1425](T-1425-modules-md-shipped-module-inventory-audit.md) 채택 선례), (C) **기존 row 내 부기**, (D) **무편집 이월**.
  - 축 B (미구현 전제 서술) 후보 — (A') **38 · 171 행을 코드 실재 반영해 in-place 정정**, (B') **각주/부기로 흡수**, (C') **`§ 7` 만 정정하고 38 행은 이력이라 보존**, (D') **무편집 이월**.
  - 판정 기준 **4 축** 명시: ① **MVA 범위** — 7 행이 못박은 conceptual-only 경계를 채택안이 넘지 않는가 (컬럼 type · index · migration 을 문서로 끌어오면 자동 기각), ② **cascade** — 채택안이 **18 · 38 행 tally**, `§ 3` mermaid ER diagram (42 ~ 83 행), `§ 6` REQ → entity coverage (115 ~ 153 행), [modules.md](../architecture/modules.md) · [INDEX.md](../use-cases/INDEX.md) · [api.md](../architecture/api.md) 에 **새 stale 을 만드는가** (만들면 기각 또는 같은 slice 안 closure 를 조건화 — 후자는 cap 기준으로 재판정), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.25` 에 기록), ④ **ADR 게이트** — 채택안이 entity 집합의 신설·재배치를 **선언** 하면 ADR 선행 대상이라 본 doc slice 범위 밖 (T-1425 가 (A) row 신설을 기각한 것과 동형 근거).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 편집은 **행 단위 1:1 in-place 또는 순수 append** 이고, 각 지점마다 AC 1 (v) 의 `§ 12.15` 판별 결과를 따른다.
  - 편집 지점 총합 **≤ 6 행**, data-model.md `wc -l` 증가 **+4 이내**.
  - **`§ 2` 표 row (22 ~ 36 행) 는 AC 3 이 (A) 를 채택한 경우에만** 변경 가능하며, 그 경우 tally 2 지점 (**18 · 38**) 동시 동기가 의무다 (한쪽만 고치면 T-1426 이 닫은 어긋남의 재발).
  - **`§ 3` mermaid (42 ~ 83 행) · `§ 4` ~ `§ 6` (84 ~ 153 행) 은 무편집** — 관계선·REQ coverage 갱신은 entity 집합 변경을 전제하므로 AC 3 ④ 게이트 소관.
- [ ] **AC 5 — 무편집 경계**: `prisma/schema.prisma` 를 포함한 `prisma/` 전체 · `src/` · `test/` 일체, `docs/architecture/modules.md` · `components.md` · `api.md`, `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, `docs/PLAN.md`, `docs/requirements.md` 는 **전부 무편집** 이고 diff 에 미등장. 이 경계를 `§ 12.25` 에 1 구로 남긴다.
- [ ] **AC 6 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.25` 에 남긴다 — 최소 ① [INDEX.md](../use-cases/INDEX.md) **58 · 86 행** §3 산문의 `AssessmentModule` 귀속 (5 회째 이월), ② [api.md](../architecture/api.md) **223 행** `UC-01 ~ UC-08` 링크 범위 vs 9 UC, ③ UC-09 `§ 5` sequence participant 병기 미판정 (9 회째 이월), ④ INDEX **37 행** UC-07 row 의 `ExportModule` / `ImportModule` 미사용, ⑤ 정본 `modules.md` 표 row 신설 축 (T-1425 Follow-up 2 의 3 slice split — ADR 선행), ⑥ 외부 package module 계상 규약 (T-1425 Follow-up 3), ⑦ 행 번호 좌표계 → anchor 좌표계 이행 (T-1426 Follow-up 4 로 근거 2 회 누적), ⑧ 산문 tally ↔ 표 row 수 CI drift-guard spec (T-1426 Follow-up 2). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다** (AC 8 이 diff 부재로 검증).
- [ ] **AC 7 — audit §12.25 절 신설**: `## 11. References` (**2015** 행) 바로 앞 (= `§ 12.24` 뒤) 에 `### 12.25 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). 구성은 `§ 12.23` · `§ 12.24` 화법 승계 — (i) 서두 blockquote (본 절이 T-1426 `Follow-up 1` / 한계 ② 를 닫는다는 위치 규정 + T-1425 문서↔코드 대조의 entity 판이라는 계보), (ii) AC 1 실측 6 항 인용 (`§ 12.15` 판별표 포함), (iii) AC 2 **3 축 대조표** (① ② ③ 구획별 전수 + AuditLog 별도 단락), (iv) AC 3 축별 4 후보 판정표 (기준 4 축 명시) + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점의 append/in-place 근거), (vi) AC 5 무편집 경계, (vii) AC 6 파생 영향 목록, (viii) 불변 검산 출력 블록, (ix) **한계 3 항 이상** — 최소: ① 본 대조가 **명칭 축** 이라 model 의 필드·관계·invariant 가 문서 서술과 일치하는지는 여전히 미검증, ② 문서↔코드 대조는 코드가 바뀔 때마다 재stale 되는 구조라 사람 규약보다 CI drift-guard spec 이 견고 (T-1426 Follow-up 2 와 동형 — entity 축 spec 을 module 축 spec 과 한 spec 으로 묶는 안 검토), ③ 채택안이 남긴 미해결 지점.
- [ ] **AC 8 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/data-model.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일). 불변 — audit `^## ` **12** · `^| REQ-` **66**, data-model `^## ` **8**, `prisma/schema.prisma` `wc -l` **666** · `grep -c '^model '` **15** (무편집 실증), `modules.md` **259** · `INDEX.md` **123** · `components.md` **190** 무편집. `git diff -U0 -- docs/architecture/data-model.md | grep '^@@'` 로 hunk 목록을 제시해 AC 4 가 허용한 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 9 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`prisma/schema.prisma` 편집 일체** — model 추가 / 삭제 / 필드 변경 / migration 생성. 본 slice 는 read-only 대조 입력으로만 쓴다.
- **`src/` · `test/` 코드 변경 일체** — CI drift-guard spec 신설도 본 slice 밖 (AC 6 ⑧ 로 기록만).
- **`§ 3` mermaid ER diagram · `§ 6` REQ → entity coverage 갱신** — entity 집합 변경을 전제하므로 AC 3 ④ ADR 게이트 소관.
- **구체 컬럼 type · index · unique constraint · cascade policy 의 문서화** — 7 행이 못박은 MVA 범위 밖 (`§ 7` 158 · 162 행).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../use-cases/INDEX.md) · [api.md](../architecture/api.md) · [components.md](../architecture/components.md) 편집** — AC 6 으로 기록만.
- **UC-01 ~ UC-09 본문 편집 일체** — 어긋남이 실측되어도 AC 6 에 기록만.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.24`) 본문 재편집.
- `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append.)
