---
id: T-1419
title: api.md · data-model.md · audit §11 References 의 `8 UC` 표기 12 지점을 §12.15 방침으로 판정 후 일괄 동기 + audit §12.17 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 95
estimatedFiles: 4
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1418]
touchesFiles:
  - docs/architecture/api.md
  - docs/architecture/data-model.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1419-eight-uc-notation-bulk-resync.md
plannerNote: "uc-doc-audit-resync 31 번째 slice — T-1418 Follow-up 1 (5 회 이월, 의존 최전방). §12.15 방침 2 차 적용. doc-only 1.6 x inline-amend 0.4"
---

# T-1419 — `8 UC` 표기 12 지점 §12.15 방침 판정 + 일괄 동기 + audit §12.17 기록

## Why

[T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) 의 **Follow-up 1** 을 닫는다. 이 항목은 [T-1416](T-1416-uc09-api-endpoint-attribution.md) Follow-up 3 부터 **5 회 이월** 된 uc-doc-audit-resync stream 의 의존 최전방이다.

- [T-1411](T-1411-uc-09-user-defined-period-evaluation.md) 이 UC-09 를 신설하고 [T-1412](T-1412-index-uc09-row-registration.md) 가 `INDEX.md` 에 등록한 뒤로 저장소의 실 UC 개수는 **9** 다. 그런데 architecture / audit 문서 곳곳의 `8 UC` 표기는 이 사실을 아직 반영하지 못한다 — [T-1416](T-1416-uc09-api-endpoint-attribution.md) 이 `api.md` **153 행** 1 곳만 `9 UC cover` 로 고쳤고, [T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) 이 `data-model.md` **38 행** 1 곳을 고쳤을 뿐이다. 잔여 stale 지점은 audit `§12.14` 1000 행 · `§12.16` 한계 항이 "일괄 판정이 선행돼야 해 별도 slice 소관" 으로 명시적으로 남겨둔 것들이다.
- 남은 것은 단순 치환이 아니라 **지점별 판정** 이다. [T-1417](T-1417-audit-legacy-summary-forward-pointer.md) 이 audit `§12.15` 에 정본으로 확정한 방침 — 날짜 stamp 를 단 **시점 기록** 은 원문 무편집 + pointer append, 날짜 stamp 없는 **living document 현행 서술** 은 in-place 갱신 — 을 12 지점 각각에 적용해야 한다. 본 slice 는 그 방침의 **2 차 적용 사례** 이자 첫 다지점 일괄 적용이므로 판정 표를 `§12.17` 에 남긴다.
- 일부 지점은 단순 수치가 아니라 **주장** 을 담는다 (`api.md` 208 · 209 행의 "현재 8 UC §5 sequence 어디에도 호명 없음"). 이 두 줄은 UC-09 §5 를 실제로 조회해 주장이 9 UC 기준으로도 성립하는지 확인한 뒤에만 표기를 옮길 수 있다 (AC 3 (c) — 날조 금지).

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM run) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 1002 ~ 1058 행 (`### 12.15` — 처리 방침 **정본** + 화법 template), 1059 ~ 1138 행 (`### 12.16` — T-1418 기록 + 한계 항), 995 ~ 1001 행 (`§12.14` 한계 3 = 본 slice 대상 열거), 1139 ~ 1152 행 (`## 11. References` — 본 slice 대상 2 줄 포함)
- `docs/architecture/api.md` — 1 ~ 14 행 (서두 + 목차), 60 ~ 66 행 (§5 표 서두), 150 ~ 156 행 (합계 — **153 행은 이미 `9 UC cover`, 무편집 대상**), 205 ~ 230 행 (§8 Out of scope · §9 References)
- `docs/architecture/data-model.md` — 1 ~ 8 행 (서두), 36 ~ 40 행 (합계 — **38 행은 이미 `9 UC cover`, 무편집 대상**), 160 ~ 190 행 (§7 Out of scope · §8 References)
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — 54 ~ 101 행 (`## 5. Main flow` — AC 3 (c) 의 실측 입력)
- `docs/tasks/T-1418-data-model-uc09-entity-derivation-judgment.md` Follow-ups 1 + 완료 기록 AC 2 (`신규 0` 결론 — AC 4 (b) 의 판정 입력)
- `CLAUDE.md` §3 (task 크기 상한) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음 값을 직접 측정해 `§12.17` 에 그대로 인용한다. (i) `grep -n "8 UC"` 결과의 **행 번호 전수** — `docs/architecture/api.md` (기대 **6**: 3 · 12 · 64 · 208 · 209 · 222 행) · `docs/architecture/data-model.md` (기대 **4**: 3 · 167 · 180 · 181 행) · `docs/use-cases/REQ-COVERAGE-AUDIT.md` (기대 **36** 중 `## 11. References` 안의 **2 줄만** 본 slice 대상, 나머지 34 은 Out of Scope), (ii) 각 대상 지점의 **날짜 stamp 유무** 와 문장 종류 (시점 기록 / living document 현행 서술) — `§12.15` 방침 적용의 판정 입력, (iii) baseline — `wc -l` api.md **230** · data-model.md **190** · audit **1152**, audit `grep -c "^| REQ-"` **66** · `grep -c "^## "` **12**, api.md `72 endpoint` · `16 resource prefix` · `9 UC cover` (153 행) 실재, data-model.md `13 entity` · `4 module` · `9 UC cover` (38 행) 실재. **기대값과 다르면 그 지점 편집을 중단하고 `§12.17` 에 불성립 사실을 기록** 한다.
- [ ] **AC 2 — 지점별 §12.15 판정 표**: 대상 **12 지점** (api.md 6 · data-model.md 4 · audit §11 References 2) 각각에 대해 `시점 기록 → pointer append` / `living document → in-place 치환` 중 어느 축인지 **명시 판정** 하고, 판정 근거 1 구 (날짜 stamp 유무 · 문장이 서술하는 시점) 를 붙인 표를 `§12.17` 에 박제한다. 애매어 금지 — 12 행 전건이 두 축 중 하나로 확정돼야 한다.
- [ ] **AC 3 — `api.md` 6 지점 처리**: AC 2 판정대로 처리하되 각 지점은 **1 행 → 1 행** 을 유지한다 (`wc -l` 230 불변). (a) **3 행** (서두 `본 문서는 P2 의 넷째 entry artifact … 8 UC (UC-01 ~ UC-08)`) · **12 행** (목차 `8 UC §5 sequence 의 호명을 1:1 row 로`) · **64 행** (§5 표 서두 `본 표는 8 UC §5 sequence …`) — living document 판정 시 UC 개수 · 링크 범위를 9 UC 기준으로 in-place 갱신하고 근거 1 구 (본 task ID · UC-09 · T-1416 귀속 slice) 를 덧붙인다. (b) **222 행** (§9 References `INDEX.md — 8 UC backbone`) — `INDEX.md` 실측 (`grep -c "^| UC-"` = **9**) 에 맞춰 처리. (c) **208 · 209 행** (`WebSocket / SSE / streaming` · `외부 webhook receiver` — "현재 8 UC §5 sequence 어디에도 호명 없음") — 표기를 옮기기 전에 **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) §5 (54 ~ 101 행) 를 실제로 조회** 해 WebSocket / SSE / streaming / webhook 호명이 **0** 임을 확인하고 그 grep 결과를 `§12.17` 에 인용한다. 호명이 1 건이라도 있으면 두 줄을 **9 UC 로 바꾸지 않고** 그 사실만 `§12.17` 한계 항에 기록한다. (d) **153 행 합계** (`9 UC cover` · `72 endpoint` · `16 resource prefix`) 와 §5 표 body · §7 cross-reference 표는 **무편집**.
- [ ] **AC 4 — `data-model.md` 4 지점 처리**: (a) **3 행** (서두) · **180 · 181 행** (§8 References `INDEX.md — 8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문`) — AC 2 판정대로 처리, 링크 범위를 바꿀 때도 **1 행 → 1 행** (`wc -l` 190 불변). (b) **167 행** (§7 Out of scope `새 entity 발굴이 8 UC scope 를 벗어나는 경우 … ADR 없이 신규 entity 결정 금지`) — 이 문장은 **ADR 게이트 규범** 이므로 게이트 문구 (`ADR 없이 신규 entity 결정 금지`) 를 **한 글자도 약화시키지 않고** scope 표기만 처리하고, [T-1418](T-1418-data-model-uc09-entity-derivation-judgment.md) 이 확정한 `신규 0` 결론을 근거로 인용한다. (c) **38 행 합계** (`9 UC cover` · `13 entity (+ 1 conceptual mention)` · `4 module`) · §2 표 · §3 ER diagram · §4 · §5 · §6 은 **무편집**.
- [ ] **AC 5 — audit `## 11. References` 2 줄 처리**: `INDEX.md — 8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 2 줄을 AC 2 판정대로 처리한다 (References 는 현행 index 서술이라 in-place 가 유력하나 판정은 AC 2 가 확정). 같은 §11 의 나머지 bullet 9 줄 · 말미 `Refs:` 줄은 **무편집**, `## 11.` heading 도 무편집.
- [ ] **AC 6 — audit §12.17 절 신설**: `## 11. References` 바로 앞에 `### 12.17 …` 절을 삽입한다 (audit `grep -c "^## "` = **12 불변**). 구성은 `§12.15` · `§12.16` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 인용, (iii) **AC 2 판정 표 12 행**, (iv) 지점별 갱신 결과 요약 (파일별 1 ~ 2 줄, 어느 축으로 처리했는지 명시), (v) AC 3 (c) 의 UC-09 §5 grep 결과 인용, (vi) T-1418 Follow-up 1 **closure 선언** (5 회 이월 종결 · `§12.14` 한계 3 · `§12.16` 한계 1 동시 소진), (vii) 불변 검산 출력 블록, (viii) 한계 2 ~ 3 항 (최소: audit 본문 §9 · §10 · §12.x 의 `8 UC` 34 hit 는 시점 기록이라 무편집 존속 · UC-09 ↔ `modules.md` / `components.md` mapping 미착수 · `data-model.md` 38 행 `13 entity` vs 실 row 수 **14** 의 1 어긋남 미정정 [T-1418 Follow-up 4]).
- [ ] **AC 7 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 4 개** (`docs/architecture/api.md` + `docs/architecture/data-model.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/modules.md` · `components.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. 수치 불변 — audit `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12**, api.md `wc -l` = **230** · `72 endpoint` · `16 resource prefix` hit 유지, data-model.md `wc -l` = **190** · `grep -c "^| \*\*"` = **14** · `grep -c "^## "` = **8**. **순수 삭제 0** — 삭제 라인은 전부 in-place 치환 / append 의 짝임을 `git diff --numstat` · `git diff -U0 | grep '^@@'` 로 제시. 합계 diff ≤ 300 LOC.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **audit 본문의 나머지 `8 UC` 34 hit** (`§9` · `§10` · `§12.5` ~ `§12.16` 안의 실측 인용 · grep 출력 블록 · 시점 기록) — 전부 날짜 stamp 를 단 시점 기록이거나 실행 당시 grep 출력의 축자 인용이라 **무편집**. 본 slice 대상은 `## 11. References` 2 줄뿐.
- **`api.md` 153 행 · `data-model.md` 38 행 합계 문장** — 이미 T-1416 · T-1418 이 `9 UC cover` 로 갱신 완료. 재편집 금지.
- **`data-model.md` 38 행 `13 entity` vs 실 row 수 14 의 1 어긋남 정정** — T-1418 Follow-up 4, 별도 slice (본 slice 는 `§12.17` 한계 항에 사실 기록만).
- **UC-09 ↔ `docs/architecture/modules.md` / `components.md` mapping** — T-1418 Follow-up 2, 별도 slice.
- **`api.md` §5 endpoint 표 row · §7 cross-reference 표 · `data-model.md` §2 표 · §3 ER diagram · §4 · §5 · §6 편집** — 본 slice 는 표기 동기만.
- **UC-01 ~ UC-09 본문 · `INDEX.md` · `PLAN.md` · `requirements.md` 편집 일체** — read-only 참조.
- 66 REQ 전수 재audit · 분류 재판정.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **UC-09 ↔ `docs/architecture/modules.md` / `components.md` mapping 점검** — T-1418 Follow-up 2 이월 (T-1417 FU3 부터). UC-09 §9 가 `AssessmentModule (controller layer) + AuthModule` 외 6 module 을 지목하는데 두 architecture 문서가 UC-09 를 알지 못한다.
2. **`data-model.md` 38 행 `13 entity` vs §2 표 실 row 수 14 의 1 어긋남 정정** — T-1418 Follow-up 4 이월. 누계 서술 (`10 → 11` · `11 → 13`) 이 `PermissionDeniedRecord` 를 빠뜨린 것으로 보이며 UC-09 와 무관한 선행 불일치다.
3. **`api.md` 223 행 링크 범위 (`UC-01 … ~ UC-08-permission-denied.md — 본 문서의 endpoint source`) 정정** — 본 slice 실행 중 신규 발견. 이 행은 `8 UC` 리터럴을 담지 않아 AC 1 의 grep 6 hit 에 들지 않았고 12 지점 열거 밖이라 무편집으로 남겼으나, 링크 범위만 보면 9 UC 실재와 어긋난다 (§ 12.17 한계 4 에 사실 기록). `data-model.md` 181 행 · audit §11 2 줄과 동형 처리 (in-place) 가 유력하다.
