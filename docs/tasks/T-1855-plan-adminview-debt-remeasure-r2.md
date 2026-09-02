---
id: T-1855
title: PLAN 183 행 AdminView 부채 bullet 2 차 실측 갱신 + 다음 추출 대상 재지목
phase: P6
status: DONE
commitMode: direct
coversReq: []
independentStream: adminview-god-component-refactor
dependsOn: [T-1854]
touchesFiles:
  - docs/PLAN.md
estimatedDiff: 20
estimatedFiles: 1
created: 2026-09-02
ownerDirective: "2026-08-31 오너 지시 (4) — AdminView.tsx god component 부채 추적"
plannerNote: "P6 / PLAN 183 행 부채 bullet 의 T-1854 Follow-up — 실측 6,053→5,569 갱신 + 다음 대상(인원 mutation 러너 군) 재지목 (direct, doc-only)"
---

# T-1855 — PLAN 183 행 AdminView 부채 bullet 2 차 실측 갱신 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 은 그 bullet 자신이 "분할 진행에 따라 본 bullet 의 실측 LOC 을 갱신" 하도록 규정한다. 직전 fire 의 [T-1854](T-1854-adminview-group-part-mutation-runners-extract.md) 가 넷째 순수 추출 (`-484 줄`) 을 머지했으므로 bullet 의 수치와 "다음 대상" 좌표가 모두 낡았다. 본 task 는 그 갱신 1 건이며, T-1854 의 유일한 `Follow-ups` 항목 (`6,053 → 5,569` 갱신 + 다음 대상 head 재지목, `direct`) 을 그대로 집행한다.

**planner issue-still-relevant pre-check (origin/main `79dd1eda` 실측)** — 미안착이 맞다: ① `grep -n "6,053" docs/PLAN.md` 가 `183 행` 1 건을 반환하고 `5,569` 는 **0 건** (T-1854 머지 후 PLAN 은 한 번도 갱신되지 않았다). ② head 실측은 `wc -l web/src/views/AdminView.tsx` = **5,569**, 선언 수 `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '` = **150** — bullet 이 적은 `6,053 줄 · 167 개` 와 모두 어긋난다. ③ bullet 이 "다음 대상" 으로 지목한 그룹·파트 mutation 러너 군은 T-1854 가 [adminGroupPartMutationRunners.ts](../../web/src/views/adminGroupPartMutationRunners.ts) 로 이미 빼냈으므로 그 좌표 (`1893~2032` · `2426~2579` · `2723~2900`) 는 head 에서 전혀 다른 블록을 가리켜 **반드시 교체**해야 한다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문. 수치 · 측정 방법 · 진척 문단 · "후속" 문단 (다음 대상 좌표) 의 위치를 확인한다. **본 bullet 1 줄만** 고친다.
- [docs/tasks/T-1854-adminview-group-part-mutation-runners-extract.md](T-1854-adminview-group-part-mutation-runners-extract.md) `## 결과` 및 `## Follow-ups (실측 갱신)` — 넷째 슬라이스의 실측 (`6,053 → 5,569`, `-484`) 과 본 task 의 지시 원문.
- [docs/tasks/T-1853-plan-adminview-debt-remeasure.md](T-1853-plan-adminview-debt-remeasure.md) — 직전(1 차) 갱신이 어떤 문장 구조로 수치 · 측정 방법 · 진척 · 다음 대상을 배치했는지의 선례. 본 task 는 같은 구조를 유지한 채 값만 되맞춘다.

## Acceptance Criteria

- [ ] `docs/PLAN.md` `183 행` bullet 의 제목과 본문 수치를 head 실측으로 교체 — `6,053 줄` → **`5,569 줄`**, `top-level 선언 167 개` → **`150 개`**, 최초 기록 (`2026-08-31 · 6,087 줄 · 선언 149 개`) 대비 증감을 `-34 줄` → **`-518 줄`** 로 되맞춘다. 검증: `grep -c "5,569" docs/PLAN.md` ≥ 1 이고 `grep -c "6,053" docs/PLAN.md` = 0.
- [ ] **측정 방법 문장은 그대로 보존** (`wc -l` · `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`) — 다음 갱신이 같은 방법으로 비교할 수 있어야 한다. 선언 수가 방법 미기록 최초값 대비 **지표(indicative)** 일 뿐이라는 한정도 유지.
- [ ] 진척 문단에 **넷째 슬라이스** 를 추가 — [T-1854](T-1854-adminview-group-part-mutation-runners-extract.md) [adminGroupPartMutationRunners.ts](../../web/src/views/adminGroupPartMutationRunners.ts) (그룹·파트 mutation 러너 군 14 심볼, `-484 줄`). 추출 슬라이스는 이제 **4 건**이다.
- [ ] 직전 갱신의 해석 문장 (**append 속도가 extract 속도를 앞선다**) 을 이번 실측으로 되맞춘다 — 3 슬라이스 시점의 순 감소 34 줄과 달리 넷째 슬라이스 한 건이 `-484` 를 냈고 선언 수도 167 → 150 으로 처음 감소했다. 다만 잔여는 여전히 크다는 점 (목표선 `≤ 2,000 줄` 까지 `-3,569 줄`, 슬라이스당 -300~500 줄 페이스로도 산술 8 회 이상) 을 명시한다.
- [ ] "후속" 문단의 **다음 추출 대상을 head (`79dd1eda`) 좌표로 교체** — 그룹·파트 러너 군은 안착 완료이므로 삭제하고, 다음 대상은 **인원(person) mutation 러너 군** (`CreatePersonFields` · `CreatePersonDeps` · `extractCreatedPersonId` · `runCreatePerson` · `DeletePersonDeps` · `runDeletePerson` · `PersonPatchInput` · `PersonPatch` · `buildPersonPatch` · `UpdatePersonDeps` · `runUpdatePerson` 의 **11 심볼**) 로 지목한다. 좌표는 **비연속 2 블록** — 생성 축 `1788~1893 행` (주석 포함 `CreatePersonFields` ~ `runCreatePerson` 끝), 삭제·수정 축 `2222~2416 행` (`DeletePersonDeps` ~ `runUpdatePerson` 끝) 이며 **합계 약 301 줄**이다.
- [ ] 다음 대상의 **경계 밖 항목을 명시** — `CREATE_USER_ERROR_SEPARATOR` (`1899 행 ~`, 사용자 축) · `createInFlightIdGate` (`2208 행`, 여러 축이 공유하는 범용 게이트) · `UpdateProviderFields` (`2424 행 ~`, LLM provider 축) 는 대상이 **아니다**. 특히 `createInFlightIdGate` 는 ServiceIdentity · 역할 변경 경로도 쓰므로 함께 옮기지 않는다.
- [ ] 체크박스는 `- [ ]` 유지 — 목표선 `≤ 2,000 줄` 미도달 (5,569).
- [ ] 변경은 `docs/PLAN.md` **1 파일뿐** — 코드 · 다른 문서 · STATE 무변경. 검증: `git diff --name-only` 가 `docs/PLAN.md` 만 반환 (driver 의 bookkeeping 파일 제외).

## Out of Scope

- 실제 추출 작업 — 인원 mutation 러너 군 분할은 별도 `pr` task (본 task 는 좌표 지목까지만).
- `183 행` 이외 PLAN bullet · 다른 문서 (`CLAUDE.md` · `.claude/agents/*` · ADR) 수정.
- `docs/requirements.md` REQ status 재판정 — 본 task 는 동작 변경 0 이며 §3.1 판정 규칙 6 대상도 아니다.
- bullet 의 구조 개편 · 문단 재배치 — 값과 좌표만 되맞춘다 (선례 T-1853 유지).
- 목표선 (`≤ 2,000 줄`) 자체의 재조정.

## Suggested Sub-agents

`implementer`

## 결과 (2026-09-02T18:40Z DONE)

- `docs/PLAN.md` `183 행` bullet 1 줄만 교체 — 수치 `6,053 줄 · 선언 167` → **`5,569 줄 · 선언 150`**, 최초 기록 (`6,087 줄 · 149`) 대비 증감 `-34` → **`-518`**. 검증: `grep -c "5,569"` = 1, `grep -c "6,053"` = 0.
- 측정 방법 문장 (`wc -l` · `grep -cE ...`) 과 선언 수의 지표(indicative) 한정은 원문 그대로 보존.
- 진척 문단에 넷째 슬라이스 ([T-1854](T-1854-adminview-group-part-mutation-runners-extract.md) [adminGroupPartMutationRunners.ts](../../web/src/views/adminGroupPartMutationRunners.ts), 14 심볼 `-484 줄`) 추가 — 추출 슬라이스 누적 4 건.
- 해석 문장 되맞춤 — 넷째 슬라이스가 처음으로 선언 수까지 (167 → 150) 줄였으나 목표선 `≤ 2,000 줄` 까지 잔여 `-3,569 줄` 로 슬라이스당 -300~500 페이스에서도 산술 8 회 이상.
- "후속" 문단의 다음 추출 대상을 **인원(person) mutation 러너 군** 11 심볼 (`1788~1893 행` 생성 축 · `2222~2416 행` 삭제·수정 축, 합계 약 301 줄) 로 교체하고 경계 밖 3 종 (`CREATE_USER_ERROR_SEPARATOR` · `createInFlightIdGate` · `UpdateProviderFields`) 을 명시.
- 체크박스 `- [ ]` 유지 (5,569 > 2,000 목표선 미도달). 변경 파일은 `docs/PLAN.md` 1 개 — main 직접 commit [`f2245082`](https://github.com/myungjoo/Assessment-Agent/commit/f2245082).

## Follow-ups

- 인원(person) mutation 러너 군 11 심볼의 실제 순수 추출 (`pr`) — 위 "후속" 문단이 지목한 `1788~1893` · `2222~2416` 비연속 2 블록, 합계 약 301 줄. 안착 후 PLAN `183 행` 3 차 실측 갱신 (`direct`) 이 다시 필요하다.
