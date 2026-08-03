---
id: T-1418
title: UC-09 §5·§8·§9 기준 data-model.md §2 신규 entity 필요 여부 실판정 + source UC 병기 + 168 행 잔여 의무 closure + audit §12.16 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 85
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1417]
touchesFiles:
  - docs/architecture/data-model.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1418-data-model-uc09-entity-derivation-judgment.md
plannerNote: "uc-doc-audit-resync 30 번째 slice — T-1417 Follow-up 1 (4 회 이월, 의존 최전방). §12.15 방침 첫 적용. doc-only × 1.6"
---

# T-1418 — UC-09 기준 `docs/architecture/data-model.md` §2 신규 entity 필요 여부 실판정 + `source UC` 병기 + 168 행 잔여 의무 closure + audit §12.16 기록

## Why

[T-1417](T-1417-audit-legacy-summary-forward-pointer.md) 의 **Follow-up 1** 을 닫는다. 이 항목은 [T-1415](T-1415-arch-doc-req004-pointer-resync.md) Follow-up 2 부터 **4 회 이월** 된 stream 의 의존 최전방이다.

- T-1415 가 [data-model.md](../architecture/data-model.md) **168 행** 에 REQ-004 pointer 를 박았으나, 그 문장 스스로 "UC-09 § 5 기준 entity 도출 (신규 entity 가 필요한지 여부 자체) 은 후속 slice 소관이라 본 § 2 표 row 추가는 미완 — **여전히 out-of-scope**" 라고 **잔여 의무를 명시** 한다. 즉 남은 것은 pointer 가 아니라 **판정 자체** 다.
- 판정 축은 이미 실재한다 — [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) 는 §5 sequence · §8 Postconditions · §9 mapping 에서 다루는 데이터 단위를 전부 명시했고 ( §8 (b) 는 `Assessment` 좌표 row 1 개 생성 · (a) 는 `DB 상태 변화 0`, §9 는 `PersistenceModule` 이 Admin 분기에서만 write), 그 이름들이 §2 표 13 entity 안에 있는지 여부만 대조하면 판정이 닫힌다. 신규 entity 가 **필요하다** 는 결론이 나오면 data-model.md **167 행** 이 "ADR 없이 신규 entity 결정 금지" 를 못 박고 있으므로 본 slice 는 row 를 추가하지 않고 게이트로 escalate 한다 (AC 3).
- 편집 방식은 T-1417 이 audit `§12.15` 에 **정본으로 확정** 한 방침을 그대로 따른다 — 날짜 stamp 를 단 **시점 기록** 은 무편집 + pointer append, 날짜 stamp 없는 **living document 서술** 은 in-place 갱신. 본 slice 는 그 방침의 **첫 적용 사례** 이므로 지점별 판정 근거를 `§12.16` 에 남긴다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/data-model.md` — 1 ~ 8 행 (서두 + 범위), 16 ~ 40 행 (`## 2. Entity 목록` 표 + 합계 38 행 + module 명 정합성), 155 ~ 172 행 (`## 7. Out of scope` — 특히 **167 행** ADR 게이트 · **168 행** REQ-004 잔여 의무), 174 ~ 190 행 (`## 8. References`)
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — 54 ~ 101 행 (`## 5. Main flow`), 121 ~ 128 행 (`## 8. Postconditions`), 129 ~ 143 행 (`## 9. Component / Module mapping`)
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 1002 ~ 1058 행 (`### 12.15` — 처리 방침 정본 + 화법 template), 910 ~ 954 행 (`### 12.13` — data-model 168 행 을 박은 slice 의 기록), 1059 행 (`## 11. References`)
- `docs/tasks/T-1417-audit-legacy-summary-forward-pointer.md` Follow-ups 1
- `CLAUDE.md` §3 (task 크기 상한) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음 4 값을 직접 측정해 `§12.16` 에 그대로 인용한다. (i) UC-09 §5 · §8 · §9 가 호명하는 **데이터 단위 전수 열거** 와 그 각각이 `data-model.md` §2 표 13 entity 중 어느 row 에 대응하는지의 1:1 매핑 (대응 없는 항목이 있으면 그 이름을 그대로 기록), (ii) §2 표 `source UC` 컬럼에 현재 `UC-09` 가 등장하는 횟수 (기대값 **0**), (iii) 168 행 · 167 행의 현재 원문과 **날짜 stamp 유무** (`§12.15` 방침 적용의 판정 입력), (iv) baseline — `data-model.md` 의 `grep -c "^| \*\*"` (entity row 수) · `grep -c "^## "` · `wc -l`, audit 의 `grep -c "^| REQ-"` (= 66) · `grep -c "^## "` (= 12). **전제가 하나라도 불성립이면 (예: (ii) 가 0 이 아님) 그 지점 편집을 중단하고 `§12.16` 에 불성립 사실을 기록** 한다.
- [ ] **AC 2 — 신규 entity 필요 여부 실판정**: AC 1 (i) 매핑을 근거로 "UC-09 가 §2 표에 없는 새 entity 를 요구하는가" 를 **명시 판정** 한다 (결론은 `신규 0` 또는 `신규 N — <이름>` 중 하나, 애매어 금지). 판정 근거는 UC-09 §8 (a) `DB 상태 변화 0` / (b) `Assessment 좌표 row 1 개` / §9 `PersistenceModule` 행을 **인용** 해 제시한다. 판정이 `신규 0` 이면 §2 표 **row 추가 0** · 18 행 · 38 행의 `13 entity` 수치 **불변**.
- [ ] **AC 3 — 신규 필요 시 ADR 게이트 (조건부)**: AC 2 결론이 `신규 N (N ≥ 1)` 이면 [data-model.md](../architecture/data-model.md) **167 행** 의 "ADR 없이 신규 entity 결정 금지" 에 따라 **본 slice 에서 §2 표 row 를 추가하지 않고**, 168 행 갱신 문장과 `§12.16` 에 "신규 entity <이름> 필요 — ADR 선행 게이트" 를 박제한 뒤 Follow-ups 에 ADR task 후보 1 줄을 남기고 종료한다 (AC 4 · AC 5 는 그 결론에 맞춰 문구만 조정). 결론이 `신규 0` 이면 본 AC 는 **N/A** 로 완료 기록에 1 줄 명시.
- [ ] **AC 4 — §2 표 `source UC` 병기**: AC 1 (i) 에서 **UC-09 가 §5 / §8 에서 직접 호명** 한 것으로 판정된 entity row 에 한해 `source UC` 컬럼에 `UC-09` 를 병기한다 (표기는 같은 컬럼의 기존 화법 승계 — 첫 등장만 링크). 단순 read-only 참조에 그치는 entity 는 병기하지 않고 그 판정 근거를 `§12.16` 에 1 줄로 남긴다. 각 row 의 **`책임` · `관련 REQ` · `책임 module` 컬럼은 무편집**, 표 row 수 · 컬럼 수 불변, 병기 대상은 **최대 3 row**.
- [ ] **AC 5 — 38 행 합계 문장 + 168 행 갱신 (§12.15 방침 적용)**: (a) **38 행** — AC 4 병기 row 가 1 개 이상이면 `8 UC cover` 를 `9 UC cover` 로 **in-place 치환** 하고 근거 1 구 (본 task ID + UC-09) 를 이어 붙인다 (날짜 stamp 없는 living-document 합계 → §12.15 방침의 in-place 축). 병기 0 이면 무편집. `13 entity (+ 1 conceptual mention)` · `4 module` 수치는 AC 2 결론이 `신규 0` 인 한 **불변**. (b) **168 행** — `2026-08-03 T-1413 재분류` 로 시작하는 문장은 날짜 stamp 를 단 시점 기록이므로 **앞부분 무편집**, "본 § 2 표 row 추가는 미완 — **여전히 out-of-scope**" 의 잔여 의무가 본 slice 로 **해소** 됐음을 문장 끝에 append 로 기록한다 (결론 + 근거 `§12.16` pointer). 두 지점 모두 **1 행 → 1 행** 유지.
- [ ] **AC 6 — audit §12.16 절 신설**: `## 11. References` (현재 1059 행) 바로 앞에 `### 12.16 …` 절을 삽입한다 (audit 의 `grep -c "^## "` = **12 불변**). 구성은 `§12.15` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 4 값 인용, (iii) **AC 2 판정 결론 1 문단** (근거 인용 포함), (iv) 갱신 지점 기록 각 1 줄 (§2 표 병기 row · 38 행 · 168 행) + 각 지점이 `§12.15` 방침의 어느 축 (시점 기록 append / living document in-place) 으로 처리됐는지 명시, (v) T-1417 Follow-up 1 **closure 선언** (4 회 이월 종결), (vi) 불변 검산 출력 블록, (vii) 한계 2 ~ 3 항 (최소: `8 UC` 표기 잔여 지점 미착수 · UC-09 ↔ `modules.md` / `components.md` mapping 미착수 · §3 ER diagram 무편집).
- [ ] **AC 7 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 3 개** (`docs/architecture/data-model.md` + `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/architecture/api.md` · `docs/architecture/modules.md` · `docs/architecture/components.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `prisma/` · `src/` · `test/` 는 diff 에 **미등장**. audit `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12** 불변, data-model 의 `grep -c "^## "` · §3 ER diagram (mermaid 블록) · §4 · §5 · §6 은 hunk 밖 무변. **순수 삭제 0** — 삭제 라인은 전부 in-place append / 치환의 짝임을 `git diff --numstat` · `git diff -U0 | grep '^@@'` 로 제시. 합계 diff ≤ 300 LOC.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **§2 표에 신규 entity row 추가** — AC 2 결론과 무관하게 본 slice 금지 (data-model.md 167 행 ADR 게이트). 필요 판정 시 Follow-up + ADR task 로만.
- **`prisma/schema.prisma` · migration SQL** — data-model.md §7 이 명시한 P3 범위, 본 slice 는 conceptual 문서 1 종만.
- **§3 ER diagram (mermaid) · §4 invariant · §5 · §6 REQ → entity coverage 표 편집** — UC-09 병기가 관계 자체를 바꾸지 않는 한 무편집 (바꾼다는 판정이 나오면 그 사실만 `§12.16` 한계 항에 기록하고 별도 slice).
- **`8 UC` 표기 일괄 갱신 잔여** (`api.md` 3 · 12 · 64 · 208 · 209 · 222 행 · `data-model.md` 3 행 · audit `§11` References) — T-1417 Follow-up 2, 별도 slice. 본 slice 는 38 행 1 지점만 (AC 2 판정의 직접 귀결이라 동일 slice 소관).
- **UC-09 ↔ `modules.md` / `components.md` mapping** — T-1417 Follow-up 3, 별도 slice.
- **UC-09 본문 · `INDEX.md` · `PLAN.md` · `requirements.md` 편집 일체** — 본 slice 는 read-only 참조.
- 66 REQ 전수 재audit · 재판정 후보 밖 row 재검토.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

1. **`8 UC` 표기 일괄 갱신** — T-1417 Follow-up 2 이월 (T-1416 FU3 부터 3 회). `api.md` 3 · 12 · 64 · 208 · 209 · 222 행 · `data-model.md` 3 행 · audit `§11` References. 각 지점을 `§12.15` 방침 (날짜 stamp 유무) 으로 판정한 뒤 in-place 치환 / pointer append 로 분기 처리.
2. **UC-09 ↔ `docs/architecture/modules.md` / `components.md` mapping 점검** — T-1417 Follow-up 3 이월. UC-09 §9 가 `AssessmentModule (controller layer) + AuthModule` 외 6 module 을 지목하는데 두 architecture 문서가 UC-09 를 알지 못한다.
3. *(조건부)* AC 2 결론이 `신규 N (N ≥ 1)` 이면 — 신규 entity 의 ADR 선행 task 후보를 여기 1 줄로 남긴다 (§5 DB schema 게이트 해당 여부 함께 판정).
