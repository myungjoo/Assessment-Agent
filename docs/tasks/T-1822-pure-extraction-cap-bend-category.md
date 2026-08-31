---
id: T-1822
title: Add a pure-extraction refactor category to the planner cap-bend table
phase: P5
status: DONE
commitMode: direct
coversReq: []
independentStream: driver-process-reform
dependsOn: []
touchesFiles:
  - .claude/agents/planner.md
estimatedDiff: 55
estimatedFiles: 1
created: 2026-08-31
ownerDirective: "2026-08-31 오너 지시 (3) — sizeExempt 를 순수 추출 리팩터에 적용"
plannerNote: AdminView.tsx 6,087 줄 god component 를 분할 가능하게 만드는 선행 조각 — cap 이 리팩터를 구조적으로 막는 문제 해소
---

# T-1822 — planner cap-bend 표에 "순수 추출 리팩터" 카테고리 추가

## Why

2026-08-31 오너 지시 (3). [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 가
**6,087 줄 · top-level 선언 149 개** 로 자랐고 2026-08-29 ~ 08-31 3 일 동안만 +985 줄 늘었다.
그런데 PLAN · ADR · task 어디에도 "AdminView 분할" 이 추적되고 있지 않았다 (본 오너 지시와
동반 commit 이 PLAN `운영 정책 review backlog` 에 부채로 처음 박제했다).

**추적이 없던 것은 우연이 아니라 구조적 유인의 결과다.** §3 cap 은 `diff ≤ 300 LOC` 를
강제하는데, 순수 추출 리팩터는 **옮기는 줄 수가 그대로 diff 로 계상**된다 — 400 줄짜리
helper 군을 별도 모듈로 빼면 삭제 400 + 추가 400 이라 cap 을 즉시 초과한다. 반면 같은
helper 를 AdminView 에 **덧붙이는** slice 는 60~120 줄이라 언제나 cap 안이다. 즉 현행 cap 은
**append 를 싸게, extract 를 비싸게** 만들어 god component 를 키우는 방향으로 작동한다.

`sizeExempt` + `exemptReason` 기구는 이미 존재하고 256 개 task 가 쓰고 있다. 빠진 것은
[.claude/agents/planner.md](../../.claude/agents/planner.md) 의 **cap-bend 카테고리 표에
"순수 추출 리팩터" 행이 없다**는 것뿐이다. 표에 없으면 planner 가 exempt 를 정당화할 근거
문구를 못 만들고, 결국 추출 task 자체를 만들지 않는다.

## Required Reading

- [.claude/agents/planner.md](../../.claude/agents/planner.md) **line 150~190 부근** — cap-bend
  multiplier 표 (base 카테고리 + sub-pattern 표) 와 그 아래 **적용 절차 1~4**. 특히 절차 4 의
  `sizeExempt: true` + `exemptReason` 박제 경로. **본 task 는 이 표와 절차에만 손댄다.**
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) `§4` (multiplier 산출)
  + `§5` (planner 적용 절차) — planner.md 가 정본으로 지목하는 문서. 새 카테고리가 이 문서와
  모순되면 **planner.md 만 고치고 estimate-model.md 동기는 Follow-ups 로 넘긴다**
  (본 task 는 1 파일 유지 — 두 파일을 함께 고치려면 별도 task).
- [docs/PLAN.md](../PLAN.md) `운영 정책 review backlog` 절의 **AdminView 부채 bullet** —
  본 task 가 가능하게 만들 후속 분할 task 의 대상 정의. 새 카테고리 본문에서 이 bullet 을 인용한다.

## Acceptance Criteria

1. planner.md 의 cap-bend base 카테고리 표에 **"순수 추출 리팩터 (pure extraction)"** 행을
   추가한다. 정의는 다음 3 조건을 **모두** 만족하는 변경으로 한정한다 (넓게 열면 cap 이 무의미해짐):
   - (a) 기존 파일에서 **동작 변경 없이** 코드를 다른 파일로 옮기는 것이 변경의 전부다
     (이름 변경 · import 경로 조정 · export 추가는 허용).
   - (b) **신규 로직 0 LOC** — 옮겨진 코드의 본문이 바뀌면 순수 추출이 아니다.
   - (c) 옮겨진 symbol 의 **기존 spec 이 그대로 통과**한다 (spec 은 import 경로만 수정).
2. 새 행의 multiplier 대신 **`sizeExempt` 직행 규칙**을 명시한다 — 순수 추출은 LOC 이
   이동량에 비례할 뿐 위험도에 비례하지 않으므로, 위 (a)(b)(c) 를 task 파일에 명시하면
   `estimatedDiff` 초과만으로는 split 하지 않고 `sizeExempt: true` + `exemptReason:
   "pure-extraction"` 으로 진행한다.
3. **파일 수 cap (≤ 5) 은 예외 없이 유지**함을 명시한다 — LOC 만 면제 대상이다. 한 번에
   여러 모듈로 흩는 추출은 여전히 split 해야 한다 (리뷰 가능성 보존).
4. 적용 절차 4 에 순수 추출 분기를 1 줄 추가한다 — "카테고리가 순수 추출이면 split 대신
   `sizeExempt` 를 **기본 선택**한다" (현행 절차 4 는 exempt 와 split 을 대등한 선택지로 둔다).
5. 근거를 검증 가능하게 남긴다 — 새 행의 precedent 칸 또는 인접 본문에 AdminView.tsx
   **6,087 줄 / 3 일 +985 줄 / top-level 선언 149 개** 실측과 PLAN 부채 bullet 링크를 적는다.

## Out of Scope

- **AdminView.tsx 실제 분할** — 본 task 는 분할을 *가능하게만* 한다. 실제 추출은 후속
  `commitMode: pr` task (PLAN 부채 bullet 이 planner 를 그리로 인도).
- `docs/architecture/estimate-model.md` 동기 — Follow-ups.
- §3 cap 수치 (300 LOC / 5 파일) 자체의 변경 — 불변.
- [T-1820](T-1820-slice-granularity-rule.md) 의 slice 하한 룰 — 별개 task (다만 두 룰은
  같은 방향: 하한 룰이 append slice 를 묶고, 본 룰이 extract slice 를 가능케 한다).

## Follow-ups

- estimate-model.md §4/§5 에 순수 추출 카테고리 동기.
- AdminView.tsx 분할 1 차 slice — ServiceIdentity 행별 액션 helper 군
  (`deriveServiceIdentityRowActionsFlags` · `buildServiceIdentityRowActionBridge` ·
  `buildServiceIdentityRowActionsProps` · `buildServiceIdentityRowActionsSlot` ·
  `beginServiceIdentityEdit`, 현 AdminView.tsx 2300~2560 행) 을 별도 모듈로 추출.
- 분할 후 AdminView.tsx LOC 을 PLAN 부채 bullet 에 실측 갱신.
