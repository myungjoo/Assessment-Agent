---
id: T-1883
title: PLAN 183 행 AdminView 부채 9 차 실측 갱신 + 순수 추출 경로 종료 박제 + 본문 분해 대상 지목
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1882]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 10
estimatedFiles: 1
created: 2026-09-04
plannerNote: "P5 PLAN 183 행 부채 bullet — T-1882 머지로 표기 stale(3,630/39 vs 실측 3,450/5) + 순수 표면 소진, 지목 0"
---

# T-1883 — PLAN 183 행 AdminView 부채 9 차 실측 갱신 + 순수 추출 경로 종료 박제 + 본문 분해 대상 지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이고, 거기 박제된 실측값과 "다음 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. [T-1882](T-1882-adminview-residual-static-surface-extract.md) 가 그 bullet 이 지목한 **잔여 순수 표면을 전량 소진**해 지금 그 행에는 유효한 다음 대상이 **0 개**이며, 동시에 bullet 자신이 예고한 "이후 남는 것은 컴포넌트 본문뿐" 국면에 실제로 도달했다. 즉 본 갱신은 수치 동기화만이 아니라 **순수 추출 경로의 종료를 박제하고 다음 국면(컴포넌트 본문 분해)의 첫 대상을 지목**하는 것이 목적이다.

**issue-still-relevant pre-check** (origin/main `6643da7a` · AdminView head `839562a7` 실측 — bullet 의 좌표는 stale 을 전제로 전수 재측정했다):

- PLAN `183 행` 표기 = `3,630 줄 · top-level 선언 39 개` (측정 sha `06074b68`) vs **실측 `3,450 줄 · 선언 5 개`** — T-1882 머지분 (`3,630 → 3,450`, `-180`) 이 미반영이다. `grep -c '3,450' docs/PLAN.md` = 0 으로 확인했고, 같은 의도의 갱신이 이미 main 에 있는지 `git log origin/main --oneline -20 -- docs/PLAN.md` 로 대조해 **미안착**을 확정했다 (마지막 PLAN 갱신은 T-1881 의 `9edb7258` = 8 차).
- 같은 행이 지목한 **다음 대상이 소멸**했다 — "잔여 순수 표면 일괄 소진 슬라이스" 의 세 묶음 (문구 · DOM id 상수 22 · 범위 편집 4 심볼 · 폼 옵션 · 게이트 8 심볼) 은 T-1882 가 신규 [adminViewConstants.ts](../../web/src/views/adminViewConstants.ts) 와 기존 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 로 전량 옮겼다. 그 문단의 좌표 (`321 행` ~ `591 행` 등) 는 통째로 무효다.
- **본 갱신이 새로 박제해야 할 사실 (1) — 순수 추출 경로 종료**: 실측상 컴포넌트 밖 잔여 top-level 표면은 `356 행` ~ `411 행` **56 줄**뿐이고, 그 내용은 직전 갱신이 이미 **"잔류 허용"** 으로 지목한 3 심볼 (`MeRow`(`360 행`) · `AdminViewProps`(`364 행`) · `isAdminRole`(`406 행`)) 이 전부다. 즉 **옮길 순수 표면이 0** 이라 지금까지의 추출 방식으로는 더 낼 슬라이스가 없다.
- **본 갱신이 새로 박제해야 할 사실 (2) — prelude 내부 구성 실측**: 컴포넌트 본문 `413 행` ~ `3316 행` (2,904 줄) 중 prelude `413 행` ~ `2409 행` (1,997 줄) 안에 `useState` **123** · `useApiResource` **36** · `handle*` 핸들러 **51** · `useMemo`/`useEffect`/`useCallback` **76** 이 있다. 다음 국면의 절단면이 "축(axis) 단위 state + 핸들러 군집" 이라는 것을 이 수치가 뒷받침한다.
- 본 갱신 대상은 `docs/PLAN.md` **1 파일뿐** — 같은 실측치를 박제한 다른 문서는 없다 ([components.md](../architecture/components.md) · [modules.md](../architecture/modules.md) 는 AdminView 를 언급하되 LOC 실측을 박제하지 않는다).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (한 줄이 매우 길다; 반드시 **부분 편집**으로 처리한다).
- [docs/tasks/T-1881-plan-adminview-debt-remeasure-next-target.md](T-1881-plan-adminview-debt-remeasure-next-target.md) — 직전 (8 차) 갱신의 문장 형태 · 좌표 박제 방식 · 구조 산술 서술 선례.
- [docs/tasks/T-1882-adminview-residual-static-surface-extract.md](T-1882-adminview-residual-static-surface-extract.md) `완료 기록` — 실측 순 감소 `-180` 과 이동 대상 · 목적지 모듈.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) `Estimate model` 의 **순수 추출 리팩터** 카테고리 — (a)(b)(c) 3 조건 원문 (본 갱신의 판정 문장이 인용할 기준).

## Acceptance Criteria

측정은 **PLAN bullet 이 박제한 방법 그대로** 수행하고, 그 시점 값을 우선한다 (아래 수치는 planner pre-check 시점 값이다):

```
git fetch origin main -q
git show origin/main:web/src/views/AdminView.tsx | wc -l
git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '
```

- [ ] bullet 제목의 `— 3,630 줄` 을 실측 LOC (**3,450**) 로 교체.
- [ ] 본문 실측 문구를 **`3,450 줄 · top-level 선언 5 개`(2026-09-04 head `839562a7` 실측)** 으로 교체 (측정 sha 는 T-1882 머지 commit).
- [ ] 최초 기록 대비 누적 감소 표기를 `-2,457 줄` → **`-2,637 줄`** 로, 선언 수 추이를 `(선언 149 → 5)` 로 갱신 (6,087 − 3,450 = 2,637).
- [ ] 목표선 잔여 표기를 `-1,630 줄` → **`-1,450 줄`** 로 갱신 (3,450 − 2,000 = 1,450). 이어지는 페이스 문장의 수치도 함께 고쳐 쓴다 — **최근 3 슬라이스 실측은 `-127` · `-105` · `-180` (평균 `-137`)** 이고 그 페이스가 이어지면 산술 **11 회**가 더 필요하다 (직전 갱신의 `-59` · `-127` · `-105` · 평균 `-97` · 17 회 서술을 대체).
- [ ] 진척 목록을 **순수 추출 16 슬라이스 → 17 슬라이스** 로 늘리고 [T-1882](T-1882-adminview-residual-static-surface-extract.md) 를 추가한다 — 신규 [adminViewConstants.ts](../../web/src/views/adminViewConstants.ts) (문구 · DOM id 상수군 + 폼 옵션 · in-flight 게이트 축) + 기존 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) (범위 편집 4 심볼 합류), `-180 줄`, **잔여 순수 표면 소진**.
- [ ] 구조 산술 문단의 4 구역 좌표를 실측으로 갱신한다 — 헤더 주석 + import 블록 `1 행` ~ `354 행` (354 줄 — 직전 319 에서 `+35`) · 잔여 top-level 타입 · helper `356 행` ~ `411 행` (**56 줄** — 직전 271 에서 `-215`) · `AdminView` 컴포넌트 본문 `413 행` ~ `3316 행` (2,904 줄 — **3 회 연속 동일**) · 배럴 재수출 `3318 행` ~ `3450 행` (133 줄 — 동일). 네 구역 + 구분 공백행의 합이 3,450 으로 정합함을 확인할 것.
- [ ] **순수 추출 경로 종료를 명시적으로 박제한다** — 잔여 top-level 표면 56 줄은 직전 갱신이 이미 "잔류 허용" 으로 지목한 3 심볼 (`MeRow`(`360 행`) · `AdminViewProps`(`364 행`) · `isAdminRole`(`406 행`)) 이 전부라 **옮길 순수 표면이 0** 이며, 지금까지의 방식으로 낼 수 있는 슬라이스는 더 없다. 옛 "잔여 helper 표면 271 줄을 전량 추출해도 약 3,360 줄" 서술은 소진됐으므로 종료 선언으로 대체한다.
- [ ] **prelude 내부 구성 실측을 새 문장으로 박제한다** (bullet 에 없던 사실) — prelude 1,997 줄 안에 `useState` **123** · `useApiResource` **36** · `handle*` 핸들러 **51** · `useMemo`/`useEffect`/`useCallback` **76**. 측정 명령도 함께 적어 다음 갱신이 비교 가능하게 한다.
- [ ] **prelude 축별 인벤토리를 박제한다** — prelude 1,997 줄을 화면 축 단위로 5 ~ 8 개 묶음으로 나누고 각각 **대표 좌표 · 대략 줄 수 · 연속 블록 여부**를 적는다 (예: 인원 · 멤버십 · 수집 대상 · ServiceIdentity · LLM provider · 난이도 · 스케줄 · 사용자 관리). 축이 파일 안에서 **연속이 아닌 경우 그 사실을 그대로 적는다** — pre-check 실측에서 ServiceIdentity 관련 줄이 `422 행` ~ `1747 행` 에 흩어져 있어(관련 줄 118), 축 단위 절단이 곧 연속 블록 이동이 아님을 다음 슬라이스가 알아야 한다.
- [ ] **순수 추출 3 조건 (a)(b)(c) 판정을 박제한다** — [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 (a) 동작 변경 없는 이동이 전부 · (b) 신규 로직 0 LOC · (c) 기존 spec 무수정 통과 기준으로, **prelude 축을 custom hook 모듈로 옮기는 경로**와 **JSX 섹션을 하위 컴포넌트로 분리하는 경로** 각각이 조건을 충족하는지 판정하고 근거를 1 ~ 2 문장으로 적는다. 판정 결과에 따라 다음 중 하나를 bullet 에 명시한다:
  - 충족 → `sizeExempt` 직행 가능 (`exemptReason: "pure-extraction"`), 또는
  - 미충족 → cap (300 LOC / 5 파일) 안에 들어오도록 **어떻게 쪼갤지**의 기준을 적는다. 이때 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무를 함께 만족하는 절단면이어야 한다 (hook 신설과 그 hook 을 호출하는 AdminView 배선은 같은 슬라이스).
- [ ] **다음 대상 1 개를 좌표와 함께 지목한다** — 위 판정과 인벤토리를 근거로 첫 슬라이스 후보 축 1 개를 고르고, **대상 좌표 · 이동 예상 줄 수 · 목적지 모듈 (신규 or 기존) · 기대 순 감소 · 소비처 동반 의무 충족 근거 · 파일 cap 산술** 을 적는다. 다음 planner 호출이 **추가 조사 없이 `pr` task 를 큐잉할 수 있는 수준**이어야 한다.
- [ ] **파일 cap 주의 갱신** — AdminView **소스 텍스트**를 `readFileSync` 로 읽는 drift-guard spec 수를 재측정해 (`grep -rl "AdminView.tsx" web/src --include=*.test.*` pre-check 값 **19**) 옛 표기 `15 개` 를 갱신하고, 본문 이동은 문구 상수 이동보다 anchor 를 깰 소지가 크다는 점을 한 문장으로 적는다.
- [ ] `git diff --stat` 이 `docs/PLAN.md` **1 파일** 만 보고하고, bullet 의 나머지 서술 (측정 방법 문단 · 구조적 유인 설명 · 선행 처리 [T-1822](T-1822-pure-extraction-cap-bend-category.md) 링크 · 목표선 정의 · 넷째 슬라이스 서술 · `[ ]` 체크박스 상태) 은 **무변경**.
- [ ] 코드 변경 0 이므로 test 는 불요 — 단 `git status --short` 로 `docs/PLAN.md` 외 오염이 없음을 확인한다. (R-112 4 항목은 `commitMode: direct` doc-only 라 적용 대상이 아니다 — CLAUDE.md §3.2 의 direct-mode doc-only 면제.)

## Out of Scope

- `web/src/views/AdminView.tsx` 를 포함한 **모든 코드 변경** — 본 slice 는 doc-only `direct` 다. 실제 분할은 후속 `pr` slice (§3.1 판정 규칙 3 분리 유지).
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 cap-bend 표 수정 — 위 (a)(b)(c) 판정이 "새 카테고리가 필요하다" 로 귀결되더라도 본 slice 는 **판정 결과만 PLAN 에 적고**, planner.md 개정은 `Follow-ups` 에 별도 `direct` task 로 남긴다 (한 slice 1 주제).
- 컴포넌트 본문 분리 방식의 **ADR 작성** — 필요 판단이 서면 `Follow-ups` 에 적고 본 slice 에서는 만들지 않는다 (ADR 신설은 `pr`).
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 리팩터 추적 문서 갱신이라 REQ 구현이 없다 (CLAUDE.md §3.1 판정 규칙 6).
- [docs/architecture/components.md](../architecture/components.md) · [modules.md](../architecture/modules.md) 갱신 — 두 문서는 LOC 실측을 박제하지 않아 stale 이 아니다.
- PLAN `181 행` · `182 행` (과분할 차단 · 재판정 왕복) bullet 갱신, 그 외 `docs/PLAN.md` 의 다른 phase · 항목, [PLAN_archive.md](../PLAN_archive.md).
- 부채 bullet 의 목표선 (≤ 2,000 줄) 자체 재조정 — 오너 지시값이라 planner 판단으로 바꾸지 않는다.

## Suggested Sub-agents

`implementer` (doc 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(생성 시 비어 있음)

## 완료 기록

- **완료 시각**: 2026-09-04T02:47Z (server-time 기준 — `gh api -i rate_limit` `Date` 헤더 `Fri, 04 Sep 2026 02:37:50 GMT` 기준 fire)
- **commit**: [`e0781120`](https://github.com/myungjoo/Assessment-Agent/commit/e0781120) (`direct` → main, `docs/PLAN.md` 1 파일 `+1/-1` — 183 행 단일 bullet 부분 편집 12 곳)
- **실측 갱신** (head `839562a7`): AdminView.tsx **3,450 줄 · top-level 선언 5 개** (직전 표기 3,630/39 에서 동기). 누적 감소 **-2,637 줄** (선언 149 → 5), 목표선(≤ 2,000 줄) 잔여 **-1,450 줄**, 최근 페이스 `-127`/`-105`/`-180` (평균 `-137`), 진척 **17 순수-추출 슬라이스**. 4 구역 좌표 재측정 결과 3,447 + 구분 3 행 = 3,450 으로 정합.
- **새로 박제한 사실**: T-1882 가 잔여 정적 표면을 전량 소진해 **순수 추출 경로가 종료**됐다 — 잔류 허용 3 심볼 56 줄 외에 옮길 표면이 0 이다. 남은 mass 는 컴포넌트 본문뿐이며, prelude 내부 구성을 측정 명령과 함께 실측해 **축별 인벤토리 9 개**(비연속 여부 · ServiceIdentity 산재 10 줄 포함) 로 분해했다.
- **판정**: 순수 추출 3 조건 (a)(b)(c) 를 prelude 에 적용해 **hook 경로는 충족 / JSX 경로는 미충족** 으로 갈랐다. 이에 따라 다음 대상 1 개를 **import·export 축**(좌표 · 목적지 · 순 감소 기대 · cap 산술 동반) 으로 지목했다.
- **함께 정정**: 같은 bullet 의 `파일 cap 주의` 문장에서 배럴 좌표가 `3498 행 ~ 3630 행` 으로 stale 이라 구조 산술 갱신과 모순돼 `3318 행 ~ 3450 행` 으로 고쳤고, 소스 텍스트 drift-guard 실측치를 15 → **19 개** 로 갱신했다.
- **검증**: 코드 변경 0 인 doc-only `direct` 라 R-112 면제 (CLAUDE.md §3.2). `git diff --stat` 이 `docs/PLAN.md` 1 파일만 보고, 작업 트리 오염 0.
