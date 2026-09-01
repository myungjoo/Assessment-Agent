---
id: T-1836
title: REQ-084 줄 단위 오류 표시 arc 머지 후 재판정 + PLAN 133 행 ⑤ 조각 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-084]
independentStream: req-084-error-lines
dependsOn: [T-1835]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
estimatedDiff: 50
estimatedFiles: 2
created: 2026-09-01
plannerNote: "P6 / PLAN 133 행 ⑤ — T-1834·T-1835 로 REQ-084 두 축 머지, §3.1 규칙 6 상 구현 후 1 회 재판정"
---

# T-1836 — REQ-084 줄 단위 오류 표시 arc 머지 후 재판정 + PLAN 133 행 ⑤ 조각 갱신

## Why

[T-1834](T-1834-setup-form-error-lines.md) (셋업 폼 축) 와 [T-1835](T-1835-admin-create-user-error-lines.md)
(Admin 사용자 추가 축) 가 머지되면서 [PLAN.md](../PLAN.md) `133 행` 오너 지시 bullet 의 ⑤ 조각
"여러 줄 오류 안내 줄 단위 표시(SETUP_ERROR_SEPARATOR 한 줄 합침 해소)" 가 두 화면 모두에서 집행됐다.
그런데 [requirements.md](../requirements.md) `103 행` 의 REQ-084 row 는 여전히 `PLANNED` 이고 근거 열이
계획값 그대로라 **문서가 실제 shipped 상태와 어긋나 있다**. [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 이
허용(이자 요구)하는 "구현 머지 후 1 회" 재판정 시점이 지금이며, 본 task 는 T-1835 의 `Follow-ups` 에
planner 가 예약해 둔 그 1 회를 집행한다.

issue-still-relevant pre-check (planner, `origin/main` `3638c936`): `requirements.md` `103 행` 의
REQ-084 row 는 `status` 열이 `PLANNED` 이고 근거 열이 `P6 (PLAN 133 행)` 뿐이다 (shipped slice 링크 0).
`PLAN.md` `133 행` 의 ⑤ 조각도 "SETUP_ERROR_SEPARATOR 한 줄 합침 해소" 라는 **미해소 서술 그대로**이며
T-1834 / T-1835 링크가 없다. 즉 본 재판정은 main 에 아직 안착하지 않았다 — 중복 task 아님.

## Required Reading

- [docs/requirements.md](../requirements.md) `103 행` (REQ-084) — 재판정 대상 row. 바로 위 `87 행`
  REQ-068 row 가 **이미 재판정된 row 의 서술·근거 표기 양식 선례**다 (축별로 근거 파일 + `행` pointer 를
  나열하고 `status` 를 `DONE` 으로). 본 task 는 그 양식을 따르되 밀도는 그보다 짧게 (본 REQ 는 축이 2 개).
  REQ-068 row 말미가 "표시 형식 축은 `103 행` REQ-084 소관" 이라고 본 REQ 를 가리키고 있으므로, 두 row 의
  경계 서술이 서로 모순되지 않는지 확인한다.
- [docs/PLAN.md](../PLAN.md) `133 행` — 오너 지시 bullet. ①~④ (전역 CSS · 로그아웃 · 세션 복원 ·
  R-78 polling) 는 여전히 미착수이므로 **bullet 마커는 `[ ]` 유지**이고, 본 task 가 고치는 것은 ⑤ 조각의
  서술 하나뿐이다.
- [docs/tasks/T-1834-setup-form-error-lines.md](T-1834-setup-form-error-lines.md) `## Result` +
  [docs/tasks/T-1835-admin-create-user-error-lines.md](T-1835-admin-create-user-error-lines.md)
  `## Result` — 두 축의 실측 결과 (무엇이 발사됐고 무엇이 의도적으로 남았는지). T-1835 `## Follow-ups`
  첫 항목이 본 task 의 발주서다.
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `126 행` `buildSetupErrorLines` · `151 행`
  `buildSetupErrorMessage` · `204 행` 이하 `setupErrorLines` state · `302 행` 폼 배선 — 셋업 축의 실 렌더
  경로가 줄 배열인지, 그리고 `118 행` `SETUP_ERROR_SEPARATOR` 를 쓰는 join 이 **살아 있는 렌더 경로에
  남아 있는지** 를 실측할 지점.
- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `42 행`
  줄 배열 prop · `98 행` 줄마다 별도 element 렌더 — 셋업 축의 표시 근거.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2252 행`
  `describeCreateUserFailureLines` · `2274 행` `describeCreateUserFailure` (join 파생) · `4801 행`
  `createUserErrorLines` 배선 · `5548 행` 이하 3 분기 렌더 — Admin 사용자 추가 축의 표시 근거.

## 재판정 지침 (판정은 실측으로, 낙관 금지)

- **두 축 근거 나열** — 셋업 축 (T-1834) 과 Admin 사용자 추가 축 (T-1835) 각각에 대해 (a) 줄 배열 산출
  함수, (b) 컨테이너 state 배선, (c) 줄마다 별도 element 를 그리는 렌더 지점, (d) unit spec 위치 네 가지를
  파일 + `행` pointer 로 적는다. `evidence` 열의 계획값 `unit` 은 실제 spec 이 unit 뿐이면 그대로 둔다.
- **join 잔재의 성격을 정확히 적는다** — `AppShell.tsx` `151 행` `buildSetupErrorMessage` 와
  `AdminView.tsx` `2274 행` `describeCreateUserFailure` 는 줄 배열의 **join 파생 export** 로 남아 있다.
  이들이 **살아 있는 렌더 경로에서 호출되는지** 를 `grep` 으로 실측해, 호출자가 없으면 "표시 경로 아님 —
  단일 문자열 계약 호환용 잔존" 으로 적고, 하나라도 화면으로 이어지면 그것을 **잔여로 못박아** 적는다.
- **다른 여러 줄 안내 표면 점검** — REQ-084 문구는 "폼 오류 등" 이라 셋업 · 사용자 추가 두 폼에 한정되지
  않는다. `web/src` 에서 사유가 2 개 이상 될 수 있는 안내를 한 문자열로 잇는 렌더 지점이 더 있는지 확인한다
  (구분자 상수 · `join(` 사용처를 기준으로 훑되, `CollectionTargetList.tsx` `53 행` `SCOPE_SEPARATOR` 나
  `contributionRow.ts` `26 행` `LABEL_SEPARATOR` 처럼 **오류 안내가 아닌 데이터 표시용 join 은 본 REQ 대상이
  아니다** — 오판 금지). 대상 표면이 더 발견되면 `PARTIAL` 로 두고 잔여를 한 문장으로 적는다.
- **status 판정** — 위 세 점검이 모두 통과하면 `DONE`, 살아 있는 한 줄 합침 렌더 경로가 하나라도 남아 있으면
  `PARTIAL` + 잔여 한 문장. 근거 없는 `DONE` 승격 금지 — 문서가 실제와 어긋나는 것이 본 task 가 고치려는
  결함이다.
- **PLAN `133 행` ⑤ 조각** — 판정 결과를 ⑤ 조각 서술에 반영한다. 현재 문장 "⑤ 여러 줄 오류 안내 줄 단위
  표시(SETUP_ERROR_SEPARATOR 한 줄 합침 해소)" 는 이미 해소된 사실을 담지 못하므로, shipped slice
  (T-1834 · T-1835) 를 링크한 한 조각으로 고쳐 적는다. **bullet 마커 `[ ]` 는 ①~④ 미착수를 이유로 유지**
  하고, ①~④ 서술은 건드리지 않는다.

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) `103 행` REQ-084 row 의 `status` 열이 실측 결과에 따라
      `DONE` 또는 `PARTIAL` 로 갱신됐고, `PLANNED` 가 남아 있지 않다.
- [ ] 같은 row 의 근거 열에 셋업 축 (T-1834) · Admin 사용자 추가 축 (T-1835) 두 축의 shipped 근거가
      **파일 + `행` pointer 로** 적혀 있고, 두 축의 task 파일이 링크돼 있다.
- [ ] 같은 row 에 `buildSetupErrorMessage` / `describeCreateUserFailure` join 파생 export 의 성격
      (표시 경로 여부) 이 한 문장으로 명시돼 있다.
- [ ] `PARTIAL` 판정인 경우에만 — 잔여가 한 문장으로 그 row 에 못박혀 있다. `DONE` 판정이면 잔여 표기를
      두지 않는다.
- [ ] [docs/PLAN.md](../PLAN.md) `133 행` 의 ⑤ 조각이 shipped 서술로 교체됐고 T-1834 · T-1835 가
      링크돼 있다. 같은 bullet 의 마커는 `[ ]` 그대로이고 ①~④ 서술은 무변경이다.
- [ ] 검증: `git diff --stat` 결과가 `docs/requirements.md` · `docs/PLAN.md` **2 파일뿐**이다
      (task 파일 · `docs/STATE.json` · journal 은 driver 의 bookkeeping 몫).
- [ ] 검증: `grep -n "REQ-084" docs/requirements.md docs/PLAN.md` 로 두 문서의 서술이 서로 모순되지
      않음을 눈으로 확인 (한쪽은 shipped, 다른 쪽은 미해소 같은 상태가 없어야 한다).
- [ ] 행 범위 표기가 [CLAUDE.md](../../CLAUDE.md) `§12` 범위 좌표 표기 (`~` 구분자 · 단일 행은 `20 행` ·
      `L` prefix 금지) 를 따른다.

R-112 4 항목은 코드 변경 0 인 `direct` doc-only task 라 비해당 (분기 없음 — 이 항목 생략).

## Out of Scope

- `web/` · `src/` · `test/` 의 **어떤 코드 변경도 금지**. 본 task 는 문서 2 파일뿐이다
  (§3.1 규칙 3 — 두 종류를 섞으면 task 를 쪼갠다).
- `buildSetupErrorMessage` / `describeCreateUserFailure` 의 **제거 여부 판단·집행 금지**. 본 task 는
  그 성격을 기록만 한다 (제거는 소비처 확인이 필요한 별건).
- 공통 `<ErrorLines>` presentational 컴포넌트 추출 금지 (아래 `Follow-ups` — `pr` 별건).
- PLAN `133 행` 의 ①~④ (전역 CSS · 로그아웃 · 세션 복원 · R-78 polling) 서술 수정 및 REQ-080 ~ REQ-083
  row 재판정 금지 — 그 축들은 미착수라 재판정 대상이 아니다.
- 다른 REQ row 의 status 재판정 금지 (§3.1 규칙 6 — REQ 당 구현 후 1 회).

## Suggested Sub-agents

`implementer` (문서 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

- 두 화면의 줄 렌더 markup 이 사실상 동형이므로 공통 `<ErrorLines>` presentational 컴포넌트 추출 검토
  (`pr`, 소비처 2 곳 — `SuperAdminSetupForm.tsx` · `AdminView.tsx` — 동반 의무 충족 필요, T-1835 승계).
- 본 재판정이 `DONE` 이면, join 파생 export 2 개 (`buildSetupErrorMessage` ·
  `describeCreateUserFailure`) 의 잔존 소비처를 실측해 제거 가능 여부를 판단하는 `pr` slice 검토
  (T-1834 Follow-up 승계 — drift-guard spec 이 이들을 참조하는지 함께 확인).

## Result (2026-09-01)

- **DONE** — `direct` commit [`b34af88d`](https://github.com/myungjoo/Assessment-Agent/commit/b34af88d) main push (문서 2 파일 `+2/-2`, PR·reviewer 불요 — §3.1 rule 1).
- [requirements.md](../requirements.md) `103 행` REQ-084 를 `PLANNED` → **`DONE`** 으로 재판정했다. 근거 열에 두 축을 (a) 줄 배열 산출 정본 · (b) 컨테이너 state 배선 · (c) 렌더 분기 · (d) unit 위치 4 항목으로 파일 + 행 pointer 와 함께 박제했다 — 셋업 폼 축은 `AppShell.tsx` `136 행` `buildSetupErrorLines` → `303 행` `errorLines` prop → `SuperAdminSetupForm.tsx` `96 행` 분기, Admin 사용자 추가 축은 `AdminView.tsx` `2261 행` `describeCreateUserFailureLines` → `4803 행` state → `5553 행` 3 분기 렌더.
- **join 파생 export 2 개는 표시 경로가 아님**을 명시했다 — `buildSetupErrorMessage` 는 `web/src` 내 호출자 0(spec 만 참조), `describeCreateUserFailure` 는 문자열 state 를 채우나 같은 실패 경로가 줄 배열도 항상 채우므로 `5553 행` 우선순위상 화면에 도달하지 않는다. 둘 다 단일 문자열 계약 호환용 잔존.
- **다른 여러 줄 안내 표면 점검** — 사유가 2 개 이상 될 수 있는 생산자는 `signupError.ts` `114 행` `formatSignupFailure` 하나뿐이고 소비처도 위 두 축뿐이라 잔여 표면 0. `web/src` 의 나머지 `join(` 사용처는 데이터·요약 표시라 본 REQ 대상이 아니다.
- [PLAN.md](../PLAN.md) `133 행` ⑤ 조각을 shipped 서술로 교체하고 T-1834 · T-1835 링크를 달았다. ①~④ 서술과 bullet 마커 `[ ]` 는 잔여가 남아 무변경.
- 코드 변경 0 인 doc-only `direct` task 라 R-112 비해당 — 검증은 `git diff --stat` 2 파일 · 두 문서 서술 무모순 확인으로 대체했다.
