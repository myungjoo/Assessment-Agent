---
id: T-1890
title: PLAN 183 행 AdminView 부채 10 차 실측 갱신 — hook 화 5 슬라이스 반영 + 잔여 4 축 좌표 재실측 + drift-guard anchor census 방법 보강 + 다음 대상 지목
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1889]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-09-04
plannerNote: "P5 PLAN 183 행 부채 bullet — hook 5 슬라이스(-908) 미반영 stale(3,450 vs 실측 2,542) + 지목 문단 무효, anchor census 방법 보강 동반"
---

# T-1890 — PLAN 183 행 AdminView 부채 10 차 실측 갱신 + 잔여 축 재실측 + anchor census 방법 보강

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이고, 거기 박제된 실측값 · 축 인벤토리 · "다음 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. 직전 갱신([T-1883](T-1883-plan-adminview-debt-remeasure-body-phase.md), 9 차) 이후 **hook 화 5 슬라이스가 연속 머지**([T-1884](T-1884-adminview-import-export-hook-extract.md) · [T-1886](T-1886-adminview-collection-targets-hook-extract.md) · [T-1887](T-1887-adminview-llm-provider-hook-extract.md) · [T-1888](T-1888-adminview-service-identity-hook-extract.md) · [T-1889](T-1889-adminview-schedule-reeval-hook-extract.md)) 되면서 bullet 의 수치 · 좌표 · 지목이 **한꺼번에 무효**가 됐다. 그래서 최근 세 슬라이스는 자기 `Why` 안에서 좌표를 매번 다시 재는 비용을 치렀고, T-1889 는 그 재측정 과정에서 **drift-guard anchor 판정을 실제로 틀렸다**(아래 ⑤). 본 갱신의 목적은 수치 동기화 + 잔여 축 좌표 재실측 + **anchor census 방법 보강** 세 가지다.

**issue-still-relevant pre-check** (origin/main `a8749e20` == working tree, 본 planner 가 전수 재측정):

- ① **미안착 확인** — PLAN `183 행` 표기 = `3,450 줄 · top-level 선언 5 개`(측정 sha `839562a7`) vs **실측 `2,542 줄 · 선언 5 개`**(bullet 이 박제한 `wc -l` · `grep -cE` 동일 명령). `grep -c '2,542' docs/PLAN.md` = **0** 이고 `git log origin/main --oneline -20 -- docs/PLAN.md` 의 마지막 PLAN 갱신이 T-1883 의 9 차 갱신이라 **동일 의도 미안착**을 확정했다. 즉 bullet 은 hook 5 슬라이스분 **`-908 줄`** 을 통째로 놓치고 있다.
- ② **슬라이스별 실측 감소**(각 task 의 `Result` 절 기재값) — T-1884 `3,450 → 3,277`(`-173`) · T-1886 `3,277 → 3,076`(`-201`) · T-1887 `3,076 → 2,835`(`-241`) · T-1888 `2,835 → 2,652`(`-183`) · T-1889 `2,652 → 2,542`(`-110`). 5 건 평균 **`-182`** 로, bullet 이 "밴드 하단에도 못 미친다(평균 `-137`)" 고 적은 직전 국면보다 페이스가 **회복**됐다. 최초 기록(6,087 줄) 대비 누적 **`-3,545 줄`**, 목표선(≤ 2,000 줄)까지 잔여 **`-542 줄`** — 현 평균 페이스로 산술 **3 회**.
- ③ **4 구역 좌표 재실측** — 헤더 주석 + import 블록 `1 행` ~ `357 행` · 잔여 top-level 타입 · helper `359 행` ~ `410 행`(52 줄, `MeRow`(`359 행`) · `AdminViewProps`(`363 행`) · `isAdminRole`(`405 행`) 3 심볼 그대로) · `AdminView` 컴포넌트 본문 `412 행` ~ `2408 행`(1,997 줄) · 배럴 재수출 `2410 행` ~ `2542 행`(133 줄, `export {`(`2410 행`) + `export type {`(`2493 행`)). **본문 내부** — prelude `412 행` ~ `1501 행`(**1,090 줄**, 직전 1,997 줄에서 `-907`) + JSX return `1502 행` ~ `2408 행`(**907 줄**, 5 슬라이스 내내 불변).
- ④ **prelude 잔량 구성**(bullet 박제 명령 그대로, 좌표 인자만 갱신) — `useState` **59 줄**(직전 125) · `useApiResource` **25 줄**(직전 36) · `const handle*` **22 개**(직전 51) · `useMemo`/`useCallback` **40 줄**(직전 80). 추출된 5 축은 `useAdminServiceIdentities`(`527 행`) · `useAdminLlmProviders`(`1045 행`) · `useAdminImportExport`(`1051 행`) · `useAdminSchedule`(`1073 행`) · `useAdminCollectionTargets`(`1136 행`) 다섯 개의 hook 호출 줄로 대체됐다. 인벤토리 9 축 중 **③ ServiceIdentity · ④ LLM provider · 난이도 · ⑤ import/export · ⑥ 수집 대상 · ⑨ 스케줄 · 재평가 다섯이 소진**됐고 **잔여는 ① 그룹 · 멤버십 · ② 인원 · ⑦ 파트 · ⑧ 사용자 관리 넷**이다 — 그 넷의 좌표는 bullet 표기(`839562a7` 기준)가 전부 stale 이라 본 갱신에서 다시 잡아야 한다.
- ⑤ **anchor census 방법이 실제로 한 번 틀렸다 (본 갱신의 핵심 보강)** — T-1889 는 `Why` ⑥ 에서 "본 축 심볼을 anchor 로 쓰는 drift-guard 0 건" 이라 판정했으나, 실제로는 `AdminView.schedules-list-contract.test.ts` 가 **심볼명이 아니라 호출식** `useApiResource<string[]>(SCHEDULES_PATH)` 를 정규식 anchor 로 써서 pointer 를 옮겨야 했고, 그 결과 `touchesFiles` 가 선언한 3 이 아니라 **실제 4 파일**이 됐다(cap 5 이내라 재분할은 불요였다). 같은 함정이 T-1888 의 후속 메모에도 이미 있다(`useApiResource<UserRow[]>(usersPath)` · `runCreateUser(...)` 호출식 anchor). 그러므로 bullet 의 "파일 cap 주의" 문단은 **anchor 를 심볼명으로만 세지 말고 호출식 정규식까지 훑을 것 + census 결과를 `touchesFiles` · `estimatedFiles` 에 반드시 합산할 것** 을 명령형으로 박제해야 한다. 현 census 모수 실측 = `grep -rl "AdminView.tsx" web/src --include=*.test.*` **16 파일**(직전 표기 19 에서 감소 — 다섯 축의 pointer 가 hook 모듈로 옮겨간 결과).
- ⑥ **다음 대상 지목의 근거는 이미 두 task 가 박제했다** — [T-1888](T-1888-adminview-service-identity-hook-extract.md) `Follow-ups` 2 항과 [T-1889](T-1889-adminview-schedule-reeval-hook-extract.md) `Follow-ups` 2 항이 모두 **⑧ 사용자 관리 축**을 다음 대상으로 지목하면서, 조회 · 생성 · 역할 변경 · 인스턴스 접근을 한 슬라이스로 묶으면 drift-guard 3 건(`AdminView.users-list-contract.test.ts` · `AdminView.create-user-failure.test.ts` · `AdminView.test.tsx`)이 함께 걸려 **6 파일로 cap 초과**임을 실측으로 남겼다. 본 갱신은 그 판정을 bullet 의 "후속" 문단으로 승격해, 다음 `pr` 슬라이스가 자기 `Why` 에서 같은 계산을 되풀이하지 않게 한다.
- ⑦ **CLAUDE.md `§3.1` 판정 6(REQ 재판정 1 회 룰) 저촉 없음** — 본 task 는 `docs/requirements.md` 의 REQ status 재판정이 아니라 PLAN 부채 bullet 의 **실측 동기화**이며, 대상 파일도 `docs/PLAN.md` 하나다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (수치 · 4 구역 좌표 · prelude 구성 · 9 축 인벤토리 · 순수 추출 3 조건 판정 · 파일 cap 주의 · 후속 지목 문단)
- [docs/tasks/T-1884-adminview-import-export-hook-extract.md](T-1884-adminview-import-export-hook-extract.md) · [T-1886](T-1886-adminview-collection-targets-hook-extract.md) · [T-1887](T-1887-adminview-llm-provider-hook-extract.md) · [T-1888](T-1888-adminview-service-identity-hook-extract.md) · [T-1889](T-1889-adminview-schedule-reeval-hook-extract.md) — 각 `Result` 절의 실측 감소값과 `Follow-ups`(특히 T-1888 2 항 · T-1889 2 항의 사용자 관리 축 cap 산술)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 좌표 재실측 대상 (본 task 는 **읽기만** 한다)
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 estimate model 중 "순수 추출 리팩터" 카테고리 — bullet 의 3 조건 (a)(b)(c) 판정 문단이 인용하는 정본

## Acceptance Criteria

- [ ] `docs/PLAN.md` `183 행` bullet 의 제목과 본문 첫 수치가 **`2,542 줄 · top-level 선언 5 개`** 로 갱신되고 측정 sha 가 현 head 시점으로 교체된다. 검증: `grep -c '2,542 줄' docs/PLAN.md` 가 1 이상, `grep -c '3,450 줄' docs/PLAN.md` 가 0.
- [ ] **진척 목록에 hook 화 5 슬라이스가 추가**된다 — T-1884(`-173`) · T-1886(`-201`) · T-1887(`-241`) · T-1888(`-183`) · T-1889(`-110`) 각각의 task 링크 · 목적지 hook 모듈 링크 · 실측 감소값 표기. 누적 감소는 최초 기록 대비 **`-3,545 줄`**, 목표선까지 잔여 **`-542 줄`**, 5 건 평균 **`-182`** 로 기재. 검증: `grep -c 'useAdminSchedule' docs/PLAN.md` 가 1 이상.
- [ ] **4 구역 · 본문 내부 좌표가 재실측값으로 교체**된다 — import 블록 `1 행` ~ `357 행` / 잔여 top-level `359 행` ~ `410 행`(52 줄) / 컴포넌트 본문 `412 행` ~ `2408 행`(1,997 줄) / 배럴 `2410 행` ~ `2542 행`(133 줄), 본문 내부는 prelude `412 행` ~ `1501 행`(1,090 줄) + JSX return `1502 행` ~ `2408 행`(907 줄). 구역 합 + 구분 행이 실측 LOC 과 정합함을 bullet 안에 산술로 남긴다.
- [ ] **국면 전환이 문장으로 박제**된다 — prelude 비중이 69% 에서 **45%** 로 역전돼 남은 최대 덩어리가 JSX return 907 줄이라는 사실, 그리고 잔여 4 축(약 1,090 줄)을 모두 hook 화하면 목표선(≤ 2,000 줄)에는 닿지만 그보다 더 줄이려면 경로 2(JSX 섹션 분해)가 필요하다는 판단.
- [ ] **prelude 잔량 구성 수치가 갱신**된다 — `useState` 59 · `useApiResource` 25 · `const handle*` 22 · `useMemo`/`useCallback` 40, 그리고 측정 명령의 좌표 인자를 현 prelude 범위(`412` ~ `1501`)로 교체해 다음 갱신이 동일 방법으로 비교 가능하게 한다.
- [ ] **9 축 인벤토리가 잔여 4 축으로 축약**된다 — 소진된 ③ ④ ⑤ ⑥ ⑨ 는 각각 어느 hook 모듈로 갔는지 한 줄로만 남기고 좌표는 삭제하며, 잔여 ① 그룹 · 멤버십 · ② 인원 · ⑦ 파트 · ⑧ 사용자 관리 넷은 **현 head 기준 좌표와 줄 수를 새로 실측**해 기재한다(각 축이 연속인지 비연속 몇 조각인지 포함).
- [ ] **"파일 cap 주의" 문단이 anchor census 방법으로 보강**된다 — (i) census 모수는 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 기준 현 **16 파일**, (ii) anchor 는 **심볼명뿐 아니라 호출식 정규식**(예: `useApiResource<string[]>(SCHEDULES_PATH)` · `runCreateUser(...)`)까지 훑을 것, (iii) census 결과를 task frontmatter 의 `touchesFiles` · `estimatedFiles` 에 **반드시 합산**할 것(파일 cap ≤ 5 는 LOC 면제와 무관하게 유지), (iv) 근거로 T-1889 의 실제 오판 사례를 한 줄 인용. 검증: `grep -c '호출식' docs/PLAN.md` 가 1 이상.
- [ ] **"후속" 문단의 다음 대상 지목이 교체**된다 — 무효가 된 ⑤ import/export 지목 문단(좌표 `1481 행` ~ `1650 행` 포함)을 통째로 삭제하고 다음 대상 = **⑧ 사용자 관리 축(2 슬라이스 분할)** 로 교체한다. 분할 근거(drift-guard 3 건 동반 → 단일 슬라이스 시 6 파일 cap 초과)와 T-1888 이 제안한 절단(① 조회 + 생성 → ② 역할 변경 + 인스턴스 접근)을 함께 기재. 검증: `grep -c 'import/export 축을 custom hook' docs/PLAN.md` 가 0.
- [ ] 갱신 후에도 bullet 은 **미완료 `- [ ]`** 로 유지된다(목표선 ≤ 2,000 줄 미도달) — 해당 행이 `- [x]` 로 바뀌지 않았음을 파일 검사로 확인.
- [ ] `docs/PLAN.md` 외 파일 변경 0 — `git status --short` 가 `docs/PLAN.md`(및 driver 가 별도로 다루는 bookkeeping 파일) 외를 보이지 않는다.

## Out of Scope

- **코드 변경 일체 금지** — `web/` · `src/` · spec 파일을 건드리지 않는다(본 task 는 `direct` doc-only, commitMode 혼합 금지).
- 다음 슬라이스의 **실제 hook 추출 착수 금지** — 본 task 는 지목까지만 한다.
- `docs/requirements.md` 의 REQ status 재판정 금지 (CLAUDE.md `§3.1` 판정 6).
- PLAN 의 **다른 bullet · 다른 절 수정 금지** — `183 행` 부채 bullet 한 개만 손댄다.
- 부채 bullet 의 **목표선(≤ 2,000 줄) 변경 금지** — 목표 재조정은 별도 오너 판단 사항.
- 축 인벤토리 좌표를 **추정으로 적지 말 것** — 모든 수치는 현 head 에서 실행한 명령의 출력이어야 한다.

## Suggested Sub-agents

`implementer` (doc-only — architect · tester 불요. 코드 0 LOC direct commit 이라 R-110 면제 대상)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
