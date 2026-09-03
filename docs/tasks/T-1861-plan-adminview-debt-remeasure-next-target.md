---
id: T-1861
title: PLAN 183 행 AdminView 부채 4 차 실측 갱신 + 다음 추출 대상 재지목
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1860]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-09-03
completedAt: 2026-09-03T06:43:20Z
plannerNote: P5 PLAN 183 행 부채 bullet — T-1860 머지로 표기가 stale(5,044/129 vs 실측 4,688/108) + 지목 대상이 이미 추출 완료라 교체
---

# T-1861 — PLAN 183 행 AdminView 부채 4 차 실측 갱신 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 bullet (AdminView god component 부채) 은 실측 LOC 과 "다음 추출 대상" 을 슬라이스마다 갱신하며 부채를 추적하도록 설계됐다. 직전 [T-1860](T-1860-adminview-import-export-runners-extract.md) (PR #1460, 머지 `20ff3d7f`) 이 import/export 러너 축 21 심볼을 추출해 AdminView 가 `5,044 줄` → `4,688 줄` 로 줄었는데, 그 slice 는 `pr` 이라 `direct` 문서 갱신을 함께 넣을 수 없어 [T-1860 Follow-ups](T-1860-adminview-import-export-runners-extract.md) 가 본 후속 slice 로 명시적으로 넘겼다.

지금 `183 행` 은 **두 군데가 사실과 어긋난다** — ① 표기 LOC/선언 수가 `5,044 줄 · 선언 129 개` 로 stale, ② "다음 대상" 으로 지목한 import/export 러너 군 12 심볼이 이미 [web/src/views/adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) 로 추출 완료. ② 는 다음 planner 가 이미 끝난 일을 다시 큐잉하도록 유도하는 실질 위험이라 이번 slice 에서 바로잡는다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` (오너 지시 AdminView god component 부채 bullet — 특히 말미의 "**후속** = 실제 분할 `pr` task" 문장부터 끝까지)
- [docs/tasks/T-1860-adminview-import-export-runners-extract.md](T-1860-adminview-import-export-runners-extract.md) 의 `Follow-ups` 2 항목 (이동 경계 보정 교훈 + 4 차 갱신 위임)
- [docs/tasks/T-1859-req080-global-style-rejudge-plan-debt-remeasure.md](T-1859-req080-global-style-rejudge-plan-debt-remeasure.md) (직전 3 차 갱신 — 문장 형태·측정 방법 서술의 선례)

## Acceptance Criteria

- [ ] `183 行` 의 실측 수치를 head `e30fb73d` 기준으로 갱신한다: `5,044 줄 · top-level 선언 129 개` → **`4,688 줄 · top-level 선언 108 개`**, 측정 sha 표기도 `edfb1a4b` → `e30fb73d` 로 교체. 최초 기록(`6,087 줄` · 선언 149) 대비 누적 감소는 **`-1,399 줄`** (선언 149 → 108) 로 적는다.
- [ ] 위 수치는 bullet 이 이미 박제한 **측정 방법 그대로** 재현해 확인한다 — `git show origin/main:web/src/views/AdminView.tsx | wc -l` 과 `git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`. 두 명령의 출력이 위 숫자와 일치해야 한다 (불일치 시 실측값을 쓰고 본 task 의 `Follow-ups` 에 차이를 남긴다).
- [ ] 목표선(≤ 2,000 줄) 까지의 잔여를 `-3,044 줄` → **`-2,688 줄`** 로 갱신한다.
- [ ] 진척 열거에 **일곱 번째 슬라이스** 로 [T-1860](T-1860-adminview-import-export-runners-extract.md) + [adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) (import/export 러너 군 21 심볼, `-356 줄`) 를 추가한다 (T-1857 항목과 같은 표기 형태).
- [ ] stale 해진 "다음 대상" 지목을 **스케줄 · 재평가 축** 으로 교체한다. head `e30fb73d` 좌표로 다음을 명시: 대상 7 심볼 `ScheduleMutationDeps`(`1011 행`) · `runApply`(`1030 행`) · `runTrigger`(`1075 행`) · `deriveScheduleMessage`(`1102 행`) · `buildRecentDeletionPath`(`1123 행`) · `ReEvaluationDeps`(`1130 행`) · `runReEvaluate`(`1150 행`), 선행 주석 포함 시 `1007 行` ~ `1189 行` 의 **연속 1 블록**, 경계 밖은 위쪽 `runAssign`(`973 행`, 난이도 매핑 축) 과 아래쪽 `RemoveDeps`(`1191 행`) 이후 (멤버 add/remove 축).
- [ ] 위 좌표는 문서에 적기 전에 `git show origin/main:web/src/views/AdminView.tsx | sed -n '<n>p'` 로 각 심볼의 행 번호를 실제 확인한다 (T-1860 이 남긴 "경계 산정 전 호출자·좌표 확인" 교훈 적용). 확인 결과 어긋나면 실측 좌표를 쓴다.
- [ ] 교체 문장에 **`buildRecentDeletionPath` 는 `637 行` 주석이 참조하지만 실호출자는 `runReEvaluate` 뿐** 이라는 사실을 한 절로 덧붙인다 (T-1860 의 `formatRestorePlanConfirmText` 역방향 import 오판 재발 방지 — 다음 slice 가 경계를 다시 계산하지 않아도 되게).
- [ ] 변경은 `docs/PLAN.md` **1 파일** 로 끝난다. `git diff --stat` 이 `docs/PLAN.md` 외의 파일을 보이지 않아야 한다.
- [ ] 코드 변경이 0 이라 test/coverage 영향 없음 — 검증은 `git diff` 로 문서 diff 를 눈으로 확인하는 것으로 충족한다 (R-112 4 종은 코드 변경이 없어 해당 없음).

## Out of Scope

- **AdminView 실제 추출 작업 금지** — 스케줄 · 재평가 축 분리는 본 slice 가 지목만 하고, 구현은 별도 `pr` task 다 (`commitMode` 가 달라 §3.1 규칙 3 상 같은 task 에 섞을 수 없다).
- `web/` 아래 어떤 파일도 수정하지 않는다 (측정용 read 만).
- `docs/requirements.md` 의 REQ status 재판정 금지 — 본 slice 는 리팩터 추적 문서 갱신이며 REQ 를 구현하지 않는다 (§3.1 규칙 6).
- `183 行` 의 다른 서술 (측정 방법 박제 문단, cap 유인 분석, `[ ]` 마커) 은 건드리지 않는다 — 목표선 미도달이므로 마커는 `[ ]` 유지.
- PLAN 의 다른 행 (`181 行` · `182 行` · `184 行`) 수정 금지.

## Suggested Sub-agents

`implementer` (문서 편집 + 측정 명령 실행) → 별도 tester 불요 (direct doc-only, 코드 변경 0).

## Follow-ups

- 다음 `pr` slice (스케줄 · 재평가 축 추출) 는 본 slice 가 박제한 `1007 行` ~ `1185 行` 좌표를 그대로 쓰되, 착수 시점 head 에서 `sed -n` 으로 재확인한다 — 그 사이 다른 slice 가 AdminView 를 줄이면 좌표가 밀린다.
- 블록 끝 좌표는 task AC 가 예상한 `1189 行` 이 아니라 실측 `1185 行` 이었다 (`1187 行` ~ `1190 行` 은 `RemoveDeps` 선행 주석). AC 의 "어긋나면 실측 좌표를 쓴다" 지시대로 실측값을 기재했고, 정정 사실을 PLAN bullet 안에 괄호로 함께 박제했다.

## Result

`direct` commit [`4e54d81c`](https://github.com/myungjoo/Assessment-Agent/commit/4e54d81c) (1 파일 `+1/-1`) 로 완료. Acceptance Criteria 9 항목 전원 `ok`.

- [PLAN.md](../PLAN.md) `183 行` — AdminView 부채 4 차 실측. `5,044 줄 · 선언 129 개` → **`4,688 줄 · 선언 108 개`** (측정 sha `edfb1a4b` → `e30fb73d`, 최초 기록 대비 누적 `-1,399 줄`, 목표선 잔여 `-3,044 줄` → **`-2,688 줄`**). 두 측정 명령을 `origin/main` 대상으로 실제 실행해 수치가 일치함을 확인했다.
- 진척 열거에 **일곱 번째 슬라이스** 로 [T-1860](T-1860-adminview-import-export-runners-extract.md) + [adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) (import/export 러너 군 21 심볼, `-356 줄`) 를 추가했다.
- stale 했던 "다음 대상" 지목을 **스케줄 · 재평가 축 7 심볼** 로 교체했다 — `ScheduleMutationDeps`(`1011 行`) · `runApply`(`1030 行`) · `runTrigger`(`1075 行`) · `deriveScheduleMessage`(`1102 行`) · `buildRecentDeletionPath`(`1123 行`) · `ReEvaluationDeps`(`1130 行`) · `runReEvaluate`(`1150 行`), 선행 주석 포함 시 `1007 行` ~ `1185 行` 연속 1 블록. 좌표 7 개 + 경계 밖 `runAssign`(`973 行`) · `RemoveDeps`(`1191 行`) 을 모두 `sed -n` 으로 대조 확인했다.
- `buildRecentDeletionPath` 는 `637 行` 주석이 참조하지만 실호출자는 `runReEvaluate`(`1171 行`) 와 test 재수출 배럴뿐이라는 사실을 한 절로 덧붙였다 (T-1860 의 `formatRestorePlanConfirmText` 역방향 import 오판 재발 방지).

코드 변경 0 (`docs/PLAN.md` 1 파일만) 이라 test·coverage 무영향 — `commitMode: direct` doc-only 로 R-110 test 의무 미해당.
