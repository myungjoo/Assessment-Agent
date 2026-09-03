---
id: T-1871
title: PLAN 183 행 AdminView 부채 5 차 실측 갱신 + 다음 추출 대상 재지목
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1869, T-1870]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 10
estimatedFiles: 1
created: 2026-09-03
plannerNote: P5 PLAN 183 행 부채 bullet — T-1869·T-1870 머지로 표기가 stale(4,688/108 vs 실측 4,497/93) + 지목 대상(스케줄 축)이 이미 마감돼 교체
---

# T-1871 — PLAN 183 행 AdminView 부채 5 차 실측 갱신 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이며, 표기된 실측값과 "다음 추출 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. 두 값이 stale 하면 다음 슬라이스가 이미 추출된 심볼을 다시 지목하는 중복 task 로 이어진다 (T-1859 · T-1861 이 같은 사유로 만들어진 선례).

issue-still-relevant pre-check (origin/main `7bbbf361` 기준 실측):

- PLAN `183 행` 표기 = `4,688 줄 · top-level 선언 108 개` (측정 sha `e30fb73d`) vs **실측 `4,497 줄 · 선언 93 개`** — [T-1869](T-1869-adminview-schedule-apply-runner-extract.md) (`-91`) · [T-1870](T-1870-adminview-schedule-trigger-reeval-runners-extract.md) (`-100`) 머지분 **둘 다 미반영**.
- 같은 행이 지목한 "다음 대상 = 스케줄 · 재평가 축 7 심볼" 은 T-1869 + T-1870 이 [adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) 로 **전량 추출 완료** — 지목이 이미 소멸했다 (`git show origin/main:web/src/views/AdminView.tsx | grep -c 'function runReEvaluate'` = 0).
- 두 건 모두 main 에 미안착이라 본 slice 는 중복이 아니다. `docs/PLAN.md` 외 다른 파일에 같은 실측치를 박제한 곳은 없다 (부채 추적 지점 단일).

또 T-1870 driver 기록이 "PLAN `183 행` 실측 LOC 를 `4,688` → `4,497` 로 한 번에 갱신" 을 다음 후보로 명시 위임했다 — 본 slice 가 두 슬라이스분을 한 번에 흡수해 doc-sync churn 을 줄인다 (오너 지시 PLAN `181 행` 과분할 차단 취지).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (한 줄이 매우 길다; 부분 편집으로 처리한다).
- [docs/tasks/T-1861-plan-adminview-debt-remeasure-next-target.md](T-1861-plan-adminview-debt-remeasure-next-target.md) — 직전 (4 차) 실측 갱신의 문장 형태·좌표 박제 방식 선례.
- [docs/tasks/T-1870-adminview-schedule-trigger-reeval-runners-extract.md](T-1870-adminview-schedule-trigger-reeval-runners-extract.md) `Follow-ups` — 스케줄 축 마감 사실과 본 slice 로 위임된 갱신 항목.

## Acceptance Criteria

측정은 **PLAN bullet 이 박제한 방법 그대로** 수행하고, 그 시점 `origin/main` head sha 를 함께 적는다:

```
git fetch origin main -q
git show origin/main:web/src/views/AdminView.tsx | wc -l
git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '
git rev-parse --short origin/main
```

- [ ] bullet 제목의 `— 4,688 줄` 을 실측 LOC (본 pre-check 시점 **4,497**) 로 교체. 실행 시점 실측이 다르면 **실측값을 우선**한다.
- [ ] 본문 실측 문구 `**4,688 줄 · top-level 선언 108 개**(2026-09-03 head \`e30fb73d\` 실측)` 을 `**4,497 줄 · top-level 선언 93 개**(2026-09-03 head \`b908be1a\` 실측)` 로 교체 (측정 sha 는 T-1870 머지 commit).
- [ ] 최초 기록 대비 누적 감소 표기 **2 곳** 을 `-1,399 줄` → `-1,590 줄` 로 갱신하고, 선언 수 추이 `(선언 149 → 108)` 을 `(선언 149 → 93)` 으로 갱신 (6,087 − 4,497 = 1,590).
- [ ] 목표선 잔여 표기 `-2,688 줄` → `-2,497 줄` 로 갱신하고, 이어지는 "슬라이스당 -250~500 줄 페이스로도 산술 **6 회** 이상" 을 재계산값(**5 회 이상**)으로 정정.
- [ ] 진척 목록을 **순수 추출 7 슬라이스 → 9 슬라이스** 로 늘리고 두 건을 추가: [T-1869](T-1869-adminview-schedule-apply-runner-extract.md) [adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) (스케줄 apply 러너 · 안내 문구 helper 3 심볼 + 상수 6, `-91 줄`) · [T-1870](T-1870-adminview-schedule-trigger-reeval-runners-extract.md) 같은 모듈 (trigger · 재평가 러너 4 심볼 + 상수 2, `-100 줄`, **스케줄 축 마감**).
- [ ] stale 한 "다음 대상" 지목 문단(스케줄 · 재평가 축 7 심볼 + 그 좌표 · 경계 서술 · `buildRecentDeletionPath` 호출자 박제)을 **사용자 관리 mutation 축** 으로 교체한다. 아래 실측 사실을 그대로 박제할 것 (head `b908be1a` 기준):
  - 대상 = `CREATE_USER_ERROR_SEPARATOR` · `CREATE_USER_ERROR_LINE_CLASS` · `hasCreateUserErrorLines` · `describeCreateUserFailureLines` · `describeCreateUserFailure` · `CreateUserDeps` · `runCreateUser` · `buildInstanceAccessPath` · `InstanceAccessFormInput` · `InstanceAccessFormFlags` · `deriveInstanceAccessFormFlags` · `GrantInstanceAccessDeps` · `runGrantInstanceAccess` · `RevokeInstanceAccessDeps` · `runRevokeInstanceAccess` · `ChangeRoleDeps` · `runChangeRole` 의 **17 심볼**, 선행 주석부터 `runChangeRole` 끝까지 `1128 행` ~ `1426 행` 의 **연속 1 블록 299 줄**.
  - 경계 밖 = 위쪽 `runAdd`(`1089 행`, 멤버십 축) · 아래쪽 `InFlightIdGate`(`1430 행`) · `createInFlightIdGate`(`1442 행`) (컨테이너 소유 범용 gate).
  - **`USERS_PATH`(`276 행`) 처리 박제** — 이동 대상 중 `runCreateUser`(`1208 행`) · `buildInstanceAccessPath`(`1236 행`) · `runChangeRole`(`1409 행`) 이 이 상수를 쓰고, 잔류 `buildUsersPath`(`867 행`) 도 함께 쓴다. 새 모듈이 AdminView 를 import 하면 역방향이라 금지이므로 **상수를 동반 이동하고 AdminView 가 새 모듈에서 import** 하는 방향만 성립한다 (T-1860 의 `formatRestorePlanConfirmText` 경계 오판 재발 차단).
  - **파일 cap 주의 박제** — 소스 텍스트를 읽는 drift-guard 중 [AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) (`155 행` `readFileSync`) 만 동반 갱신 대상이고, [AdminView.instance-access-contract.test.ts](../../web/src/views/AdminView.instance-access-contract.test.ts) 는 controller · DTO 소스만 읽어 영향이 없다. [AdminView.users-list-contract.test.ts](../../web/src/views/AdminView.users-list-contract.test.ts) 는 AdminView 소스에서 users fire method 를 뽑으므로 `USERS_PATH` 동반 이동 시 **영향 여부를 슬라이스 착수 시 재확인**한다. 17 심볼을 한 번에 옮기면 파일 수가 cap(≤ 5, LOC 만 면제)을 넘길 수 있으므로 절단선 후보를 함께 적는다: **생성 축 `1128~1232 행`(7 심볼)** / **권한 · 역할 축 `1234~1426 행`(10 심볼)**.
- [ ] `git diff --stat` 이 `docs/PLAN.md` **1 파일** 만 보고하고, bullet 의 나머지 서술 (측정 방법 문단 · 구조적 유인 설명 · 선행 처리 T-1822 링크 · 목표선 정의) 은 **무변경**.
- [ ] 코드 변경 0 이므로 test 는 불요 — 단 `git status --short` 로 `docs/PLAN.md` 외 오염이 없음을 확인한다.

## Out of Scope

- `web/src/views/AdminView.tsx` 를 포함한 **모든 코드 변경** — 본 slice 는 doc-only `direct` 다. 실제 추출은 후속 `pr` slice (§3.1 규칙 3 분리 유지).
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 리팩터 추적 문서 갱신이라 REQ 구현이 없다 (CLAUDE.md §3.1 규칙 6).
- PLAN `181 행` · `182 행` (과분할 차단 · 재판정 왕복) bullet 갱신.
- 부채 bullet 의 목표선(≤ 2,000 줄) 자체 재조정 — 오너 지시값이라 planner 판단으로 바꾸지 않는다.
- `docs/PLAN.md` 의 다른 phase · 항목, `PLAN_archive.md`.

## Suggested Sub-agents

`implementer` (doc 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
