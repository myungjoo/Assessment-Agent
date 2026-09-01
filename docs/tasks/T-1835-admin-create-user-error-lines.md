---
id: T-1835
title: Admin 사용자 추가 실패 문구를 줄 단위로 구분 표시 (REQ-084 AdminView 축)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-084]
estimatedDiff: 390
estimatedFiles: 3
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 = 390 LOC — 제품 코드는 ~100 LOC 이고 초과분은 전부 colocated spec LOC (동형 선례 T-1834 4 파일 +482/-20 중 제품 ~100 LOC, T-1831 5 파일 +1,039/-0 중 제품 261 LOC). 파일 cap(≤ 5) 은 준수."
independentStream: web-ui-basics
dependsOn: [T-1834]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.create-user-failure.test.ts
  - web/src/views/AdminView.test.tsx
created: 2026-09-01
plannerNote: "P6 PLAN 133 행 ⑤ (REQ-084) 두 번째 slice — AdminView 사용자 추가 실패 사유를 줄 단위 렌더 + 러너 배선까지 한 PR. cap-bend pre-justified: R-112 backbone × 1.5 = 390 LOC, T-1834 패턴."
---

# T-1835 — Admin 사용자 추가 실패 문구를 줄 단위로 구분 표시 (REQ-084 AdminView 축)

## Why

[docs/PLAN.md](../PLAN.md) `133 행` (UI 기본기 R-187~R-191) 의 다섯 조각 중 ⑤ "여러 줄 오류 안내 줄 단위 표시" = [docs/requirements.md](../requirements.md) `103 행` REQ-084 의 **나머지 한 축**이다. 직전 slice [T-1834](T-1834-setup-form-error-lines.md) 가 SuperAdmin 셋업 축을 닫으면서 `Follow-ups` 에 "AdminView 사용자 추가 실패 문구(`CREATE_USER_ERROR_SEPARATOR`)도 줄 단위 렌더로 전환 + drift-guard spec 갱신 — 별도 slice" 를 명시해 예약해 두었다. 현재 Admin 이 사용자를 추가하다 실패하면 축별 구체 사유(아이디 / 비밀번호 / 기타)가 `' / '` 로 **한 줄에 합쳐져** 표시돼, 사유가 2 개 이상일 때 줄 경계가 사라진다 — REQ-084 가 금지하는 "한 줄 합침" 그대로다.

**planner issue-still-relevant pre-check (실측)**: `git grep "createUserErrorLines\|describeCreateUserFailureLines" -- web` **0 건** — 줄 배열 축이 미안착. [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2240 행` 은 여전히 `const CREATE_USER_ERROR_SEPARATOR = ' / ';`, `2250 행` `describeCreateUserFailure(e: unknown): string` 은 여전히 `formatSignupFailure(...).join(CREATE_USER_ERROR_SEPARATOR)` 이며, 표시 지점 `5508 행` 은 여전히 `{createUserError ? <p role="alert">{createUserError}</p> : null}` 단일 문자열 렌더다. [docs/requirements.md](../requirements.md) `103 행` REQ-084 는 `PLANNED`, [docs/PLAN.md](../PLAN.md) `133 행` 은 `[ ]` — 본 축은 main 에 박제돼 있지 않음을 확인했다. 반대로 셋업 축은 이미 안착(`AppShell.tsx` `136 행` `buildSetupErrorLines` · `303 행` `errorLines={setupErrorLines}`)이라 본 task 의 범위에서 제외한다.

## Required Reading

- [docs/tasks/T-1834-setup-form-error-lines.md](T-1834-setup-form-error-lines.md) — 직전 slice 가 확립한 "줄 배열이 정본, join 은 파생" 패턴과 Follow-ups 예약 문구.
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `113~155 행` — `SETUP_ERROR_SEPARATOR` · `buildSetupErrorLines`(정본) · `buildSetupErrorMessage`(join 파생) 의 기준 구현. 본 task 는 이 형태를 AdminView 로 옮긴다.
- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `90~110 행` — 줄마다 별도 element 로 렌더하는 markup 과 index-포함 key 근거 주석. 렌더 형태를 여기에 맞춘다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2234~2260 행` — `CREATE_USER_ERROR_SEPARATOR` 와 `describeCreateUserFailure` 정의(및 "표시 지점이 한 줄이라 `\n` 을 못 쓴다" 는 주석 — 본 task 가 그 전제를 해소한다).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2270~2310 행` — `CreateUserDeps` / `runCreateUser`(409 → `USER_DUPLICATE_ERROR` 분기 포함).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `4763~4790 행` (`createUserError` state + `handleCreateUser` deps 조립) · `5508 행` (표시 지점) · `6110~6120 행` (named export 블록).
- [web/src/views/AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) — 본 축의 colocated spec. 신규 케이스는 **이 파일에 추가**한다(새 spec 파일 신설 대신).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `9752 행` — 표시 지점 원문을 그대로 단언하는 drift-guard(`'{createUserError ? <p role="alert">{createUserError}</p> : null}'`). 렌더를 바꾸면 반드시 함께 갱신해야 한다.

## Acceptance Criteria

- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 에 `describeCreateUserFailureLines(e: unknown): string[]` 를 신설하고 이를 **사유 정본**으로 삼는다 — 400 은 `formatSignupFailure(classifySignupFailure(...))` 줄 배열 그대로, 그 외 status 는 `[toErrorMessage(e)]` 1 줄. 기존 `describeCreateUserFailure` 는 **삭제하지 않고** `describeCreateUserFailureLines(e).join(CREATE_USER_ERROR_SEPARATOR)` 로 재정의한다(기존 join 계약 spec 과 구분자 정합 drift-guard 를 그대로 통과시키기 위함).
- [ ] `runCreateUser` 가 실패 시 줄 배열도 함께 표면화하도록 `CreateUserDeps` 를 확장한다 — 409 중복 분기는 `[USER_DUPLICATE_ERROR]`, 그 외는 `describeCreateUserFailureLines` 결과. **기존 `describeError` / `setCreateError`(문자열) 필드의 시그니처는 유지**해 다른 spec 의 deps literal 이 깨지지 않게 한다(줄 배열 필드는 optional 추가). 필수 필드로 바꾸는 설계를 택할 경우 영향받는 spec 을 같은 PR 에서 함께 고치되 **파일 5 개 cap 을 넘지 않아야** 한다.
- [ ] 컨테이너에 `createUserErrorLines` state 를 두고 `handleCreateUser` deps 에 배선한 뒤, 표시 지점(`5508 행`)을 줄 배열 우선 렌더로 바꾼다 — 우선순위는 **줄 배열 > 단일 문자열 `createUserError` > 미렌더**, 줄마다 별도 element, `role="alert"` 유지, 줄 원문 보존(합치기·요약 금지). helper 신설과 소비처 배선(컨테이너 state + 렌더)을 **같은 PR** 에 담는다 (CLAUDE.md §3 소비처 동반 의무).
- [ ] happy-path unit test 1+ — 사유 2 줄짜리 400 실패에서 `describeCreateUserFailureLines` 가 2 원소 배열을 돌려주고, 렌더 경로가 줄마다 별도 element 를 만든다.
- [ ] error path unit test 1+ — 400 이 아닌 실패(500 / 네트워크 오류 / `ApiError` 아님)에서 1 줄 배열로 되돌아가고 throw 하지 않는다.
- [ ] 분기 test — (a) 400 축별 사유 / (b) 409 중복 → `[USER_DUPLICATE_ERROR]` / (c) 그 외 status / (d) 렌더 3 분기(줄 배열 있음 · 문자열만 있음 · 둘 다 없음) 각 1+ test.
- [ ] negative cases 충분 cover — 빈 배열 / `undefined` 줄 배열에서 alert 를 렌더하지 않음, `null` · `undefined` 입력에 무-throw, 성공 시 직전 줄 배열이 비워짐, 비밀번호 원문이 어떤 줄에도 새지 않음, 줄 원문이 요약·병합되지 않음 — 각 1+ test.
- [ ] `describeCreateUserFailure(e) === describeCreateUserFailureLines(e).join(CREATE_USER_ERROR_SEPARATOR)` 등가를 고정하는 test 1+ (join 파생 계약이 뒤에서 갈리지 않게).
- [ ] [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `9752 행` drift-guard 를 새 렌더 원문에 맞게 갱신하고, "줄 배열 우선" 이 소스에서 사라지면 fail 하는 형태로 유지한다.
- [ ] `cd web && pnpm test` 통과 (기존 web test 전량 green — 특히 `AdminView.create-user-failure.test.ts` 의 구분자 정합 drift-guard 와 `AdminView.create-user-contract.test.ts`).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 무변경이라 backend coverage 변동은 0 이어야 한다).

## Out of Scope

- `SETUP_ERROR_SEPARATOR` / `CREATE_USER_ERROR_SEPARATOR` / `buildSetupErrorMessage` / `describeCreateUserFailure` **제거** — 두 축이 모두 줄 단위로 전환된 뒤 별도 slice 에서 재평가한다.
- 두 화면의 구분자·formatter 를 **공통 helper 로 추출**하는 리팩터 (AdminView god component 부채는 PLAN `183 행` 소관).
- AdminView 의 다른 실패 문구 표면(역할 변경 · 인스턴스 접근 부여 · 파트/그룹/인원 생성 등) 의 줄 단위 전환.
- backend(`src/`) 변경 — 오류 body 계약은 이미 shipped(REQ-068 e2e 고정)라 손대지 않는다.
- REQ-084 재판정 및 PLAN `133 행` 마커 갱신 (CLAUDE.md §3.1 규칙 6 — 본 구현이 머지된 **뒤** `direct` 1 회).
- 전역 CSS 도입 · 로그아웃 · 세션 복원 · polling (PLAN `133 행` 의 ① ~ ④ 조각).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- REQ-084 두 축(셋업 · Admin 사용자 추가)이 모두 줄 단위로 전환되면 REQ-084 재판정 + PLAN `133 행` ⑤ 조각 서술 갱신 (`direct` 1 회).
- 두 화면의 줄 렌더 markup 이 사실상 동형이므로 공통 `<ErrorLines>` presentational 컴포넌트 추출 검토 (소비처 2 곳 동반).

## Result (2026-09-01)

- **DONE** — PR [#1442](https://github.com/myungjoo/Assessment-Agent/pull/1442) squash merge `c1d4b1f2` (round 1, reviewer APPROVE comment 외부 존재 · PR check 2/2 pass · integrator self-check — §3.3 4-게이트 충족).
- 변경 3 파일 `+411/-20`. `describeCreateUserFailureLines` 를 실패 사유 정본으로 신설하고 기존 `describeCreateUserFailure` 를 그 join 파생으로 재정의해 구분자 정합 drift-guard 를 보존했다. `hasCreateUserErrorLines` 가드 · `CREATE_USER_ERROR_LINE_CLASS` 를 함께 두고, `CreateUserDeps` 에 줄 축 2 필드를 optional 로 더해 기존 deps literal 무회귀를 지켰다. 컨테이너에 `createUserErrorLines` state 를 배선하고 표시 지점을 3 분기(줄 배열 > 단일 문자열 > 미렌더)로 렌더한다 — §3 소비처 동반 의무 준수(helper 단독 slice 아님).
- 신규 케이스 18 + 미렌더 축 1 + `AdminView.test.tsx` drift-guard 갱신으로 R-112 4 종 cover (happy · error · 분기 a~d · negative 8 종 · join 등가 고정). web 116 파일 3,495 test green, 루트 13,404 test green, lint · build(`tsc --noEmit` 포함) green (`src/` 무변경이라 backend coverage 변동 0).
- `estimatedDiff` 390 대비 `+411` 이나 초과분은 전부 colocated spec LOC (제품 코드 ~100 LOC) 이고 `sizeExempt: true` 사전 정당화 + 파일 cap(≤ 5) 준수.
- 잔여: REQ-084 재판정 + PLAN `133 행` ⑤ 마커 갱신 (§3.1 규칙 6 — 본 구현 머지 후 `direct` 1 회).
