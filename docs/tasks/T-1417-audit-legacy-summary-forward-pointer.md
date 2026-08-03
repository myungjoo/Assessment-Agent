---
id: T-1417
title: audit §8 결론 · §1 18 행 옛 gap 요약에 현행 pointer append + §9 198 행 행 표기 부기 + §12.15 방침 확정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 75
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1416]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1417-audit-legacy-summary-forward-pointer.md
plannerNote: "uc-doc-audit-resync 29 번째 slice — T-1416 Follow-up 2(3 회 이월) + 4(4 회 이월) 동시 closure. 수치 무편집 + pointer append. doc-only × 1.6"
---

# T-1417 — audit §8 결론 · §1 18 행의 옛 `gap 1 건` 요약에 현행 pointer append + §9 198 행 행 표기 부기 + §12.15 방침 확정

## Why

[T-1416](T-1416-uc09-api-endpoint-attribution.md) 의 **Follow-up 2** (3 회 이월 — T-1413 FU4 · T-1414 FU4 · T-1415 FU3) 와 **Follow-up 4** (4 회 이월 — T-1412 FU4 부터) 를 한 파일 안에서 함께 닫는다. 둘 다 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) **내부의 pointer 정합** 문제라 판정 축이 같다.

- **Follow-up 2** — `§12.10` 786 ~ 790 행의 **한계 2** 가 "지목 공백 3 지점" 으로 열거한 `api.md 211 행` · `data-model.md 168 행` · **`§8 161 행`** 중 앞의 둘은 T-1415 가 닫았고 **§8 161 행 1 건만 잔존** 한다. 실측하면 `## 8. 결론` (157 행) 의 5 bullet 은 여전히 `gap 1 건` · `후속 task (T-0030+) 책임` · `8 UC + UC-09 (예정)` 을 말하는데, `§12.11` 실판정으로 REQ-004 는 이미 `uc-covered` (gap 0) 이고 UC-09 는 실재하며 `§12.10` 은 T-0030+ 책임 지목을 **stale 로 확정** 했다. 그럼에도 §8 에는 **현행을 가리키는 pointer 문장이 한 줄도 없다** — `§1` 18 행이 `2026-08-02 재판정: §9 참조` 를 달고 있는 것과 대조된다 (그 pointer 조차 `§12.11` 이전 시점이다). 즉 남은 결함은 "옛 수치" 가 아니라 **forward pointer 부재** 이며, 처리 방침은 `§12.3` 306 행 append-only 규약 + T-1414 의 PLAN 36 행 선례 (원문 보존 + 문장 append) 로 이미 정해져 있다. 본 slice 는 그 방침을 **집행하고 동시에 명문화** 한다.
- **Follow-up 4** — `§9` 한계 목록 198 행의 `docs/use-cases/INDEX.md 104 행 의 audit closure 요약은 본 절과 동기화하지 않았다` 서술. 실측하면 (i) 그 closure 문단은 INDEX.md 의 **104 행이 아니라 118 행부터** 이고 (T-1412 row 등록 · T-1414 append 로 이동), (ii) **미동기 사실 자체가 이미 해소** 됐다 (T-1414 가 4 값을 append 완료). 다만 198 행은 `§9` (2026-08-02 재판정) 의 **시점 기록** 이므로 위 규약상 in-place 치환 대상이 아니다 — **부기 append** 로 닫는다.

[PLAN.md](../PLAN.md) 의 미완 bullet (P7 성능 검증 · P8 부하·내성 · live-LLM) 은 각각 ADR PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 14 ~ 19 행 (`## 1. 개요`), 157 ~ 166 행 (`## 8. 결론`), 186 ~ 199 행 (`### 9.4` + §9 한계 목록), 293 ~ 317 행 (`### 12.3` cascade 표 + 각주 + `### 12.4` 규약), 786 ~ 793 행 (`§12.10` 한계), 869 ~ 907 행 (`### 12.12`), 908 ~ 952 행 (`### 12.13`), 953 ~ 999 행 (`### 12.14` — 화법 template), 1000 행 (`## 11. References`)
- `docs/use-cases/INDEX.md` 114 ~ 123 행 — closure 문단의 **현재 행 번호** 실측용 (편집 대상 아님)
- `docs/tasks/T-1416-uc09-api-endpoint-attribution.md` Follow-ups 2 · 4
- `CLAUDE.md` §3 (task 크기 상한) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (전제 재측정, 날조 금지)**: 편집 전에 다음 4 값을 직접 측정해 `§12.15` 에 그대로 인용한다. (i) `## 8. 결론` 절의 시작 행 · bullet 행 범위와 그 안에 `§9` / `§12` 를 가리키는 pointer 문장이 **0 개** 임, (ii) `§1` 개요의 `gap 1 건` 문장이 달고 있는 pointer 가 `§9` 까지뿐임, (iii) `§9` 한계 목록에서 `INDEX.md 104 행` 을 언급하는 행 번호와, INDEX.md closure 문단의 **실제 현재 행 번호**, (iv) `grep -c "^| REQ-"` · `grep -c "^## "` baseline. **전제가 하나라도 불성립이면 (예: §8 에 이미 pointer 가 있음) 그 지점 편집을 중단하고 `§12.15` 에 불성립 사실을 기록** 한다.
- [ ] **AC 2 — §8 결론 절에 forward pointer append**: 기존 5 bullet (`gap 1 건` · `T-0030+ 책임` · `8 UC + UC-09 (예정)` 포함) 의 **수치·문구를 한 글자도 고치지 않고**, 마지막 bullet 뒤에 현행 pointer 문단 (1 ~ 3 행) 을 append 한다. 내용 3 요소 — (i) 본 §8 은 `auditDate: 2026-05-25` 시점 verdict 의 기록이라는 명시, (ii) 2026-08-03 현재 REQ-004 는 `uc-covered` (gap 0) · UC-09 는 실재 · `T-0030+` 책임 지목은 stale 이라는 현행 사실, (iii) 근거를 `§9` · `§12.10` · `§12.11` · `§12.15` 로 위임 (수치 재생산 최소화). `## 8.` heading · `## 9.` heading 무편집.
- [ ] **AC 3 — §1 18 행 pointer 최신화 (append)**: 18 행의 4 값 (`uc-covered 48` 등) 과 `gap 1 건` 서술, 기존 `2026-08-02 재판정: §9 참조` 문장은 **보존** 하고, 그 뒤에 `2026-08-03 재분류: … §12.11 · §12.15 참조` 형태의 문장 1 개만 이어 붙인다 (T-1414 가 PLAN.md 36 행에 쓴 in-line append 화법 승계). 1 행 → 1 행 유지 (행 수 증가 0).
- [ ] **AC 4 — §9 198 행 부기 append**: `INDEX.md 104 행` 리터럴은 시점 기록이라 **치환하지 않고**, 같은 행 끝에 괄호 부기 1 구를 append 한다. 내용 2 요소 — (i) AC 1 (iii) 로 실측한 현재 행 번호, (ii) 미동기 사실은 T-1414 (cascade (e)) 로 **이미 해소** 됐고 근거는 `§12.12` 라는 pointer. 1 행 → 1 행 유지.
- [ ] **AC 5 — §12.15 절 신설**: `## 11. References` 바로 앞에 `### 12.15 …` 절을 삽입한다 (`grep -c "^## "` = **12 불변**). 구성은 `§12.14` 화법 승계 — (i) 서두 blockquote, (ii) AC 1 실측 4 값 인용, (iii) **처리 방침 확정** 1 문단: "옛 요약의 수치·판정 문구는 `§12.3` 306 행 append-only 규약대로 무편집 보존하고, 현행 상태는 **pointer 문장 append** 로만 가리킨다" 를 정본으로 박제 + T-1415 가 in-place 로 고친 `api.md` 3 행과의 성격 차이 (living-document 현행 서술 vs 시점 기록) 1 구, (iv) 갱신 3 지점 기록 각 1 줄, (v) `§12.10` 한계 2 의 3 지점 **전건 closure 선언** + T-1416 Follow-up 2 · 4 closure 선언, (vi) 불변 검산 출력 블록, (vii) 한계 2 ~ 3 항 (최소: `§9.4` 188 행 · `§12.x` 본문의 옛 행 표기는 여전히 무편집 · `8 UC` 표기 일괄 갱신은 미착수).
- [ ] **AC 6 — 불변 검산**: `git status --porcelain` 변경 파일이 **정확히 2 개** (`docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일) 이고 `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/architecture/*` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `src/` · `test/` 는 diff 에 **미등장**. audit 의 `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12** 불변, `§3` 38 행 · `§4` 116 행 정합식 · `§5` 통계표 · `§12.3` cascade 6 row 는 hunk 밖 무변. **순수 삭제 0** — 삭제 라인은 전부 in-place append 의 짝임을 `git diff --numstat` · `git diff -U0 | grep '^@@'` 로 제시. 합계 diff ≤ 300 LOC.
- [ ] **AC 7 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 · R-112 4 항목 · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`§8` 5 bullet 본문 · `§1` 18 행 앞부분 · `§9.4` 188 행의 수치·판정 문구 수정** — 시점 기록이라 무편집 (AC 5 (iii) 방침 자체가 이를 금지).
- **`8 UC` 표기 일괄 갱신** (api.md 3 · 12 · 64 · 207 · 208 행 · data-model.md 3 · 38 행 · audit `§11` References) — T-1416 Follow-up 3, 별도 slice.
- **`docs/architecture/data-model.md` §2 entity 도출 판정** — T-1416 Follow-up 1, 별도 slice.
- **UC-09 ↔ `modules.md` / `components.md` mapping** — T-1416 Follow-up 5, 별도 slice.
- `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/architecture/*` 편집 일체 (본 slice 는 audit 1 파일).
- 66 REQ 전수 재audit · 재판정 후보 밖 49 row 재검토.
- `src/` · `test/` · `web/` · `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
