---
id: T-1834
title: SuperAdmin 셋업 폼 오류 안내를 줄 단위로 구분 표시 (REQ-084 setup 축)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-084]
estimatedDiff: 390
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 — 제품 코드는 ~100 LOC 이고 초과분은 전부 colocated spec LOC (동형 선례 T-1831 5 파일 +1,039/-0 중 제품 261 LOC, T-1832 5 파일 +1,113/-5). 파일 cap(≤ 5) 은 준수."
independentStream: web-ui-basics
dependsOn: []
touchesFiles:
  - web/src/components/SuperAdminSetupForm.tsx
  - web/src/components/SuperAdminSetupForm.test.tsx
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
created: 2026-09-01
plannerNote: "P6 PLAN 133 행 ⑤ (REQ-084) 첫 slice — setup 폼 여러 줄 오류를 줄 단위 렌더 + AppShell 배선까지 한 PR. cap-bend pre-justified: R-112 backbone × 1.5 = 390 LOC, T-1831 패턴."
---

# T-1834 — SuperAdmin 셋업 폼 오류 안내를 줄 단위로 구분 표시 (REQ-084 setup 축)

## Why

[docs/PLAN.md](../PLAN.md) `133 행` (UI 기본기 R-187~R-191) 의 다섯 조각 중 ⑤ "여러 줄 오류 안내 줄 단위 표시 (SETUP_ERROR_SEPARATOR 한 줄 합침 해소)" = [docs/requirements.md](../requirements.md) `103 행` REQ-084 를 여는 첫 slice 다. 현재 [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `141 행` 이 실패 사유 줄들을 `SETUP_ERROR_SEPARATOR`(`' / '`) 로 **한 줄에 합쳐** [SuperAdminSetupForm](../../web/src/components/SuperAdminSetupForm.tsx) 의 `error?: string` 한 칸에 밀어 넣는다 — 사유가 2 개 이상이면 사용자는 어디서 한 줄이 끝나는지 구분할 수 없다. `113~117 행` 주석이 그 합침을 "폼의 `error?: string` 제약 때문" 이라고 명시하고 있으므로, 제약을 폼 쪽에서 푸는 것이 정공법이다.

**planner issue-still-relevant pre-check (실측)**: `git grep errorLines -- web` **0 건** — 줄 단위 prop 미안착. `AppShell.tsx` `141 행` 은 여전히 `lines.join(SETUP_ERROR_SEPARATOR)` 이고 `SuperAdminSetupForm.tsx` `75 행` 은 여전히 `{error ? <div role="alert">{error}</div> : null}` 단일 문자열 렌더다. `requirements.md` `103 행` REQ-084 는 `PLANNED`, `PLAN.md` `133 행` 은 `[ ]` — 어느 축도 main 에 박제돼 있지 않음을 확인했다.

[CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무를 지키기 위해 폼 prop 신설(helper)과 AppShell 배선(소비처)을 **한 PR** 에 담는다.

## Required Reading

- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) — `error?: string` prop 정의(`40 행`)와 alert 렌더(`75 행`).
- [web/src/components/SuperAdminSetupForm.test.tsx](../../web/src/components/SuperAdminSetupForm.test.tsx) — colocated spec. 본 task 의 신규 케이스도 이 파일에 추가한다.
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `113~142 행` (`SETUP_ERROR_SEPARATOR` · `SETUP_UNRESOLVED_MESSAGE` · `buildSetupErrorMessage`) 및 `157 행`(`initialSetupError`) · `187 행`(`setupError` state) · `246 행`(`setSetupError(...)`) · `270~277 행`(폼 배선).
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `105~230 행` — `initialSetupError` 정적 렌더 단언 + `buildSetupErrorMessage` 기존 케이스군. colocated spec 이며 본 task 의 신규 케이스도 이 파일에 추가한다.
- [docs/requirements.md](../requirements.md) `103 행` — REQ-084 문언.

## Acceptance Criteria

- [ ] `SuperAdminSetupForm` 에 `errorLines?: string[]` prop 을 추가하고, 값이 있고 빈 배열이 아니면 `role="alert"` 영역 안에서 **줄마다 별도 element** 로 렌더한다 (한 문자열로 합치지 않는다). 각 줄 원문은 보존한다 (요약·병합 금지 — REQ-068 선례).
- [ ] 기존 `error?: string` prop 은 그대로 유지하고 (`initialSetupError` 정적 렌더 경로 보존), `errorLines` 가 우선한다는 우선순위를 코드 주석과 spec 양쪽에 명시한다.
- [ ] `AppShell` 에 `buildSetupErrorLines(failure: SignupFailure | null): string[]` 를 named export 로 신설하고, 기존 `buildSetupErrorMessage` 는 **그 결과를 `SETUP_ERROR_SEPARATOR` 로 잇는 형태로 재정의**해 사유 산출 로직 중복을 만들지 않는다 (기존 케이스 전부 green 유지).
- [ ] `AppShell` 의 setup 실패 경로(`246 행` 부근)가 줄 배열 state 를 갱신하고 폼에 `errorLines` 로 내려간다 — 소비처 배선까지 본 PR 안에서 완결한다 (helper 단독 slice 금지, CLAUDE.md §3).
- [ ] happy-path unit test 1+ — 신규/변경 public symbol (`buildSetupErrorLines`, `errorLines` prop) 각각에 대해 정상 입력 시 줄 수·본문이 그대로 렌더/반환되는지 검증.
- [ ] error path unit test 1+ — `failure === null` · `formatSignupFailure` 결과가 빈 배열인 경우 `SETUP_UNRESOLVED_MESSAGE` 한 줄이 나오는지 검증.
- [ ] 분기 cover — (가) `errorLines` 비어있지 않음 (나) `errorLines` 빈 배열/미전달 + `error` 문자열 있음 (다) 둘 다 없음(alert 미렌더) 세 분기 각각 1+ test.
- [ ] negative cases 충분 cover — 각 1+ test: 빈 배열 전달 시 빈 alert 미렌더 · 줄이 1 개뿐일 때도 구분자 `' / '` 가 출력에 섞이지 않음 · 줄 2 개 이상일 때 두 줄이 같은 텍스트 노드로 합쳐지지 않음 · 비밀번호 등 입력값이 오류 문구로 새지 않음 (기존 secret-leak 단언 패턴 승계) · 타입 우회로 `undefined`/공백 줄이 섞여도 throw 0.
- [ ] `pnpm --dir web test` 전량 green, 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` green (web 빌드 포함).

## Out of Scope

- **CSS/전역 스타일 도입 금지** — PLAN `133 행` ① 은 별도 slice 이며 architect ADR 이 선행해야 한다. 본 slice 는 `white-space` 등 스타일에 의존하지 않는 **마크업 분리**만으로 줄 구분을 만든다.
- **AdminView 사용자 추가 오류 축 미변경** — [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2235 행` 의 `CREATE_USER_ERROR_SEPARATOR` 와 그 drift-guard spec ([AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) `166 행`) 은 그대로 둔다. 그래서 `SETUP_ERROR_SEPARATOR` 상수는 삭제하지 않는다 (삭제하면 그 guard 가 깨지고 6,000 줄짜리 AdminView 가 diff 에 들어와 cap 을 넘긴다).
- 로그아웃 · 세션 복원 · R-78 polling (PLAN `133 행` ②③④) 배선 금지.
- `docs/requirements.md` REQ-084 status 재판정 금지 — CLAUDE.md `§3.1` 규칙 6 에 따라 구현 slice 머지 **후** 1 회만, 별도 direct task 로.
- backend (`src/`) · e2e (`test/`) · `package.json` 변경 금지 (새 dependency 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- REQ-084 의 나머지 축: AdminView 사용자 추가 실패 문구(`CREATE_USER_ERROR_SEPARATOR`, [AdminView.tsx](../../web/src/views/AdminView.tsx) `2235 행`)도 줄 단위 렌더로 전환 + drift-guard spec 갱신 — 별도 slice.
- 위 전환이 끝나면 `SETUP_ERROR_SEPARATOR` / `buildSetupErrorMessage` 제거 가능 여부 재평가.
- PLAN `133 행` ⑤ 조각 완결 후 REQ-084 재판정 + PLAN 마커 갱신 (`direct` 1 회).

## Result (2026-09-01)

- **DONE** — PR [#1441](https://github.com/myungjoo/Assessment-Agent/pull/1441) squash merge `3f407684` (round 1, reviewer APPROVE comment 외부 존재 · PR CI 2/2 pass · integrator self-check — §3.3 4-게이트 충족).
- 변경 4 파일 `+482/-20`. `SuperAdminSetupForm` 에 `errorLines?: string[]` prop 과 `hasErrorLines` 가드를 신설해 줄마다 별도 element 로 렌더하고(우선순위 `errorLines` > `error` > 미렌더), `AppShell` 은 `buildSetupErrorLines` 를 사유 정본으로 두고 `buildSetupErrorMessage` 를 join 형태로 재정의해 실패 · throw 경로를 `setupErrorLines` state 로 통일 후 폼에 배선했다(§3 소비처 동반 의무 준수 — helper 단독 slice 아님).
- 신규 케이스 happy 4 · error 3 · 분기 7 · negative 10 + 소스 drift guard 1 로 R-112 4 종 cover. web 116 파일 3,476 test green, 루트 463 suite 13,404 test green (line · function ≥ 80% 게이트 통과).
- `estimatedDiff` 390 대비 `+482` 이나 초과분은 전부 colocated spec LOC (제품 코드 ~100 LOC) 이고 `sizeExempt: true` 사전 정당화 + 파일 cap(≤ 5) 준수.
