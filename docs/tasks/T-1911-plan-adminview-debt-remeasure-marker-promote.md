---
id: T-1911
title: PLAN 184 행 AdminView 부채 12 차 실측 갱신 — 경로 2 4 슬라이스 반영 + 목표선 도달 마커 승격
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049]
estimatedDiff: 20
estimatedFiles: 2
independentStream: adminview-god-component-debt
dependsOn: [T-1910]
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1911-plan-adminview-debt-remeasure-marker-promote.md
created: 2026-09-06
plannerNote: "P5 PLAN 184 행 부채 bullet — 경로 2 4 슬라이스(T-1907~T-1910) 미반영 stale(2,080 vs 실측 1,958) + 목표선 ≤ 2,000 최초 도달로 마커 승격 판정 필요"
---

# T-1911 — PLAN 184 행 AdminView 부채 12 차 실측 갱신 + 마커 승격

## Why

[docs/PLAN.md](../PLAN.md) `184 행` 의 오너 지시(2026-08-31) AdminView god component 부채 bullet 이 **직전 갱신([T-1906](T-1906-plan-adminview-debt-remeasure-jsx-phase.md), 11 차, head `6f8e773b` 실측) 이후 머지된 경로 2(JSX 섹션 분해) 4 슬라이스를 한 건도 반영하지 못한 stale 상태**다. 이 bullet 은 자기 안에 다음 슬라이스의 절단 좌표 · 목적지 · 파일 cap census 모수를 담아 후속 task 를 공급하는 유일한 지점이고, 동시에 **마커 승격 조건("갱신 시점 실측이 ≤ 2,000 줄 이면 `[x]`")을 자기 마지막 문장에 박제**하고 있다. 현 head 실측이 그 조건을 처음으로 충족했으므로 재실측과 마커 판정이 같은 슬라이스의 책임이다.

**issue-still-relevant pre-check (origin/main `a1a110b2` 실측)** — 본 갱신은 **미박제**이고, 갱신 대상은 전부 검증 가능한 실측 drift 다:

1. `grep -c "T-1907" docs/PLAN.md` ~ `grep -c "T-1910" docs/PLAN.md` 가 **전부 0** — 머지된 경로 2 슬라이스 4 건(T-1907 · T-1908 수집 대상 패널, T-1909 · T-1910 그룹 패널)이 bullet 어디에도 없다. `AdminCollectionTargetsSection` · `AdminGroupsSection` 히트도 각 **0** 이다(두 모듈은 `git ls-tree origin/main web/src/views/` 로 spec 포함 4 파일 실재).
2. `wc -l web/src/views/AdminView.tsx` = **1,958 줄**인데 bullet 표기는 **2,080 줄**(`-122` drift). 선언 수는 bullet 박제 명령으로 **7 개**로 표기와 일치한다(경로 2 는 컴포넌트 밖 심볼을 늘리지 않는다).
3. bullet 의 "**다음 대상 = 수집 대상 패널(`1863 행` ~ `1939 행`)**" 지목 문단과 그 목적지 · 기대 감소 · 예상 파일 수 서술이 **통째로 무효**다 — T-1907 · T-1908 이 이미 완료했다. **JSX 패널 인벤토리 5 개**(사용자 관리 · 인원 · 그룹 · 파트 · 수집 대상)도 무효다: 그룹 · 수집 대상 2 개가 소진돼 `grep -nE '^\s*<section' web/src/views/AdminView.tsx` 히트가 루트 포함 **4 개**로 줄었다.
4. **목표선을 통과했다** — 실측 1,958 은 목표선 `≤ 2,000` 을 `-42` 로 밑돈다. bullet 이 마커를 `[ ]` 로 유지한 근거("현 실측 2,080 줄이 목표선을 `+80` 초과")가 소멸했다.
5. 마커 승격 판정은 T-1910 PR(#1501) 이 의도적으로 남긴 잔여다 — [journal-2026-09-05.md](../progress/journal-2026-09-05.md) `20:02 driver` 항목이 "마커 승격 판정은 별도 direct slice 소관이라 본 PR 은 PLAN 을 건드리지 않았다" 로 박제했다. 즉 본 task 가 그 지정된 소관이다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — 갱신 대상 bullet 전문(한 줄 bullet). 특히 말미의 "**측정 방법**" · "**구조 산술**" · "**JSX 패널 인벤토리**" · "**경로 2 제약 3 종**" · "**마커는 `[ ]` 유지**" 문단.
- [docs/tasks/T-1906-plan-adminview-debt-remeasure-jsx-phase.md](T-1906-plan-adminview-debt-remeasure-jsx-phase.md) `## Acceptance Criteria` — 직전(11 차) 갱신이 지킨 서술 형식 · 보존 대상 문단 판정 선례.
- [docs/progress/journal-2026-09-05.md](../progress/journal-2026-09-05.md) 의 T-1907 · T-1908 · T-1909 · T-1910 `driver:` 항목 — 슬라이스별 목적지 · 순감 수치의 정본.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 실측 대상. 본문을 통독하지 말고 아래 측정 명령의 출력만 취한다.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) `# Estimate model` 의 "순수 추출 리팩터" 항 — bullet 이 인용하는 3 조건(a)(b)(c) 판정 문구의 출처(경로 2 미충족 판정 보존 근거).

## Acceptance Criteria

측정은 bullet 이 박제한 명령을 그대로 재실행해 얻은 값만 쓴다(추정 금지). 기준 head 는 `a1a110b2`.

- [ ] `wc -l web/src/views/AdminView.tsx` · `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) ' web/src/views/AdminView.tsx` 를 재실행해 bullet 의 실측 LOC · 선언 수 · head sha 를 갱신한다(planner 실측 기준 **1,958 줄 · 선언 7 개 · head `a1a110b2`**, 착수 시 재확인).
- [ ] **경로 2 진척 문단 신설** — 진척 (1) · (2) 와 같은 형식으로 "진척 (3) JSX 섹션 → 하위 컴포넌트 4 슬라이스" 를 박제한다: T-1907([AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) 껍데기 + 목록 축) · T-1908(같은 모듈, `children` 슬롯 → props 흡수) · T-1909([AdminGroupsSection.tsx](../../web/src/views/AdminGroupsSection.tsx) 껍데기 + 목록 축) · T-1910(같은 모듈, 생성 · 수정 폼 2 종 흡수). 각 task 파일 링크와 슬라이스별 순감을 포함한다.
- [ ] **궤적 + 측정치 불일치 박제** — 경로 2 궤적을 `2,080 → 2,048 → 2,022 → 2,006 → 1,958` 로 적고, 마지막 값이 T-1910 journal 의 슬라이스 보고치 `1,961` 과 **`3 줄` 다르다**는 사실과 그 처리 원칙(**bullet 의 정본 지표는 head 에서 실행한 `wc -l` 이며 슬라이스 보고치는 참고값**)을 한 문장으로 명시한다. 이후 갱신이 같은 불일치에 다시 걸리지 않게 하는 것이 목적이다.
- [ ] **구조 산술 갱신** — 4 구역 좌표를 빈 행 기준(`grep -n '^$'`)으로 재실측해 갱신한다(planner 실측: 헤더 + import `1 행` ~ `376 행` · 잔여 top-level 타입 · helper `378 행` ~ `458 행` · `AdminView` 컴포넌트 `460 행` ~ `1820 행` · 배럴 재수출 `1822 행` ~ `1958 행`, 구분 빈 행 3 개(`377 행` · `459 행` · `1821 행`) 합산 시 1,958 정합). 본문 내부 분해도 prelude `464 행` ~ `1009 행`(546 줄) · JSX return `1010 행` ~ `1819 행`(810 줄) · 닫는 괄호 1 줄로 갱신하고, **JSX 우위가 `376 줄` → `264 줄` 로 좁혀졌다**는 방향을 한 문장으로 적는다.
- [ ] **JSX 패널 인벤토리 갱신** — 소진된 그룹 · 수집 대상 2 개는 목적지 모듈만 남기고 좌표를 삭제하고(경로 1 소진분 처리 형식 동형), 잔여 3 패널 좌표를 재실측해 갱신한다(planner 실측: 사용자 관리 `1321 행` ~ `1436 행` 116 줄 · 인원 `1449 행` ~ `1648 행` 200 줄 · 파트 `1680 행` ~ `1781 행` 102 줄, 합 418 줄).
- [ ] **다음 대상 지목 교체** — 무효가 된 "다음 대상 = 수집 대상 패널" 문단 전체를 삭제하고, 잔여 3 패널 중 하나를 근거(축 밖 의존 최소 · drift-guard anchor 0 여부)와 함께 지목하되 **목표선 밖 선택적 개선임을 명시**한다. census 모수는 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 를 재실행해 갱신한다(planner 실측 **13 파일**).
- [ ] **마커 `[ ]` → `[x]` 승격** — bullet 자기 규칙("갱신 시점 실측이 ≤ 2,000 줄 이면 `[x]`")대로 승격하고, 승격 근거 문장을 "현 실측 1,958 줄이 목표선 `≤ 2,000` 을 `-42` 로 통과" 로 교체한다. 동시에 **재개 조건**을 한 문장으로 박제한다: 기능 증분(T-1901 · T-1904 선례)으로 실측이 다시 `> 2,000` 이 되면 마커를 `[ ]` 로 되돌리고 위 인벤토리 · 절단 기준 · census 방법으로 재개한다.
- [ ] **보존 대상 문단 무삭제** — 최초 기록(6,087 줄 · 선언 149) · 측정 방법 2 종 · 진척 (1) 17 슬라이스 · 진척 (2) 11 슬라이스 · 순수 추출 3 조건 판정(경로 2 **미충족** — `sizeExempt` 금지 근거) · 경로 2 제약 3 종 · anchor census 방법 (i)~(iv) · T-1822 선행 처리 링크는 그대로 남긴다. `grep -c "T-1822" docs/PLAN.md` · `grep -c "6,087" docs/PLAN.md` · `grep -c "anchor census" docs/PLAN.md` 가 각 1 이상.
- [ ] bullet 이 한 줄(single-line list item)로 유지되고, `docs/PLAN.md` 총 행 수가 변하지 않는다(`git diff --stat docs/PLAN.md` 가 `1 +-`, 즉 1 insertion / 1 deletion).
- [ ] 링크 형식이 기존 bullet 과 동형(상대 경로 `tasks/T-NNNN-*.md` · `../web/src/...`)이고 CLAUDE.md `§12` 행 범위 표기(`~` 구분자, `1958 행` 형식, `L` prefix 금지)를 따른다.
- [ ] 본 task 파일 frontmatter `status` 를 `DONE` 으로 바꾸고, 두 파일을 **단일 direct commit** 으로 main 에 push 한다(CLAUDE.md `§3.1` — doc-only).

## Out of Scope

- `web/src/` 코드 · spec 변경 0 — 본 task 는 실측 **기록**만 한다. 잔여 3 패널의 실제 분해는 별도 `pr` task 소관이다.
- PLAN `183 행`(REQ 재판정 왕복 제거) 등 다른 bullet 수정.
- `docs/requirements.md` 의 REQ status 재판정(CLAUDE.md `§3.1` — 구현 slice 머지 후 REQ 당 1 회 규칙, 본 task 는 구현 slice 가 아니다).
- 새 ADR 신설 · 기존 ADR 결정 변경 · `docs/architecture/*` 갱신.
- 부채 bullet 의 목표선 수치(`≤ 2,000`) 자체 변경 — 오너 지시 소관이라 planner · implementer 재량 밖이다.
- 다음 패널 분해 task 파일 생성(planner 소관, 한 호출 1 task).

## Suggested Sub-agents

`implementer` (doc-only direct — R-110 상 tester 면제, 단 측정 명령 재실행 결과를 trail `notes` 에 1 줄 남긴다)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
