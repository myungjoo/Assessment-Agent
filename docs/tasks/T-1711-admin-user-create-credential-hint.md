---
id: T-1711
title: Admin 사용자 추가 폼에 아이디·암호 조건 사전 안내 박제 (REQ-067 slice 2)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-067]
independentStream: owner-account-ux
dependsOn: [T-1710]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-26
completedAt: 2026-08-26T04:54:11Z
prNumber: 1342
mergeCommit: 936e2786
plannerNote: P6 오너 지시 계정 생성 UX(PLAN 129 행) 분해 slice 2 — REQ-067 나머지 절반인 Admin 사용자 추가 폼 조건 사전 안내
---

# T-1711 — Admin 사용자 추가 폼에 아이디·암호 조건 사전 안내 박제 (REQ-067 slice 2)

## Why

[REQ-067](../requirements.md) `86 행` 의 원문([README](../../README.md) `158 행`) 은 계정 생성 화면을 **"첫 로긴 SuperAdmin 지정, Admin 의 사용자 추가 모두 포함"** 으로 명시한다. T-1710 이 앞쪽 절반(SuperAdmin 초기 셋업 폼) 을 닫았으므로 남은 절반이 **Admin 의 사용자 추가 화면** 이다.

현 [AdminView.tsx](../../web/src/views/AdminView.tsx) `4544 행` 부근의 사용자 생성 폼은 `aria-label="추가할 사용자 이메일"` / `aria-label="추가할 사용자 비밀번호"` 입력 2 개와 "사용자 추가" 버튼만 렌더하고, 조건 안내가 **한 줄도 없다**. 이 폼은 SuperAdmin 셋업과 **동일한** backend 계약(`POST /api/users` → `AddUserDto` = `@IsEmail` + `@IsNotEmpty` + `@MinLength(PASSWORD_MIN_LENGTH)`) 을 쓰므로, Admin 도 제출해 400 을 받은 뒤에야 조건을 추측하는 상태다 — REQ-067 이 금지하는 바로 그 상태.

REQ-068 / REQ-069(실패 사유 구체 표시 · 중복 vs 형식 오류 구분) 는 `runCreateUser` 의 error 문구 파생 계약 변경을 동반해 표면이 다르므로 **후속 slice** 로 분리한다. 본 slice 는 정적 렌더 배선 1 개 + 그 spec 만 건드려 cap 안에서 닫는다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 변경 대상. 특히 `4543 행` ~ `4570 행` 의 `<section aria-label="사용자 관리 섹션">` 안 사용자 생성 폼(입력 2 + 버튼 1 + `role="alert"` 실패 문구) 과 파일 상단 `18 행` ~ `83 행` import 블록.
- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `9 행` ~ `24 행` — 이미 `export` 된 `PASSWORD_MIN_LENGTH` / `USERNAME_HINT_TEXT` / `PASSWORD_HINT_TEXT` 상수 (T-1710 박제). 문구는 **재정의하지 말고 이 상수를 named import 로 재사용** 한다 (두 화면의 문구 drift 차단).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `9347 행` ~ `9365 행` — `renderToStaticMarkup(<AdminView />)` 후 `USER_SECTION` 으로 섹션을 잘라내 검증하는 기존 정적 렌더 test 패턴. 신규 test 는 이 패턴을 그대로 차용해 append 한다.
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) — 안내 문구가 인용하는 backend 검증 규칙 **정본** (`PASSWORD_MIN_LENGTH = 8`). 읽기만 하고 수정하지 않는다.
- [docs/requirements.md](../requirements.md) `86 행` — `REQ-067` row 원문.

## Acceptance Criteria

- [ ] `AdminView` 의 사용자 생성 폼이 **입력 전에도 항상 보이는** 조건 안내 2 축(아이디 / 비밀번호) 을 렌더한다. 문구 본문은 `SuperAdminSetupForm` 의 `USERNAME_HINT_TEXT` / `PASSWORD_HINT_TEXT` 를 named import 해 재사용하고, AdminView 안에서 문구를 새로 쓰지 않는다 (같은 backend 규칙의 문구가 두 벌 생기면 drift 한다 — import 이유를 주석 1~2 줄로 남긴다).
- [ ] 안내 `<p>` 는 각각 고유 DOM id(예: `admin-create-user-email-hint` / `admin-create-user-password-hint`) 를 갖고, 대응 입력의 `aria-describedby` 가 그 id 를 가리킨다. id 상수는 AdminView 안에 별도 `const` 로 박제한다 (SuperAdmin 셋업 폼의 id 와 값이 겹치면 안 된다 — 같은 문서에 동시 존재하지 않더라도 화면별 고유 id 유지).
- [ ] 안내 문구는 조건 분기 없이 무조건 렌더한다 — `creatingUser` / 에러 상태와 무관하게 항상 표시(입력 전 안내가 목적이므로 상태 의존 금지).
- [ ] **happy-path test 1+**: `renderToStaticMarkup(<AdminView />)` 결과의 사용자 관리 섹션 안에 아이디 안내 문구 · 비밀번호 안내 문구 · `aria-describedby` 2 개가 모두 포함됨을 검증.
- [ ] **error path test 1+**: 사용자 생성 실패 문구(`role="alert"`) 가 떠 있는 상태에서도 안내 문구 2 축이 함께 남아 있음을 검증 (실패가 안내를 대체하지 않는다).
- [ ] **branch test**: 안내 렌더 자체에는 분기가 없으므로, 인접 분기 축인 (a) `creatingUser` 진행 중 렌더 (b) 비-Admin 등급이라 섹션 자체가 미마운트되는 fail-closed 경로 2 갈래를 각각 1+ test 로 cover 한다 (전자는 안내 유지, 후자는 안내도 미노출).
- [ ] **negative cases 충분 cover (각 1+)**: ① 비밀번호 안내에 실제 입력값이 절대 섞이지 않음(입력값 문자열이 마크업의 안내 영역에 노출 0) ② 안내 `<p>` 가 입력의 접근 가능 이름을 오염시키지 않음(`aria-label` 은 종전 값 그대로 — `추가할 사용자 이메일` / `추가할 사용자 비밀번호` 문자열 유지) ③ 안내 문구가 `role="alert"` 를 갖지 않음(보조기술이 매 렌더마다 경보로 읽지 않도록).
- [ ] 기존 `AdminView.test.tsx` 의 모든 it 이 그대로 green — 특히 `9347 행` 대의 정적 렌더 회귀 test(`section` 안 `aria-label="추가할 사용자 이메일"` 존재 + `not.toContain('role="alert"')`) 가 신규 안내 때문에 깨지지 않아야 한다. 깨지면 안내 마크업 쪽을 조정한다 (기존 단언 삭제로 우회 금지).
- [ ] `pnpm --dir web test` 전량 green.
- [ ] `pnpm --dir web build` (tsc --noEmit + vite build) green.
- [ ] backend 는 `src/` · `test/` · `.github/workflows/` · `package.json` diff **0 파일** 이므로 backend coverage 불변 — 확인용으로 `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를 유지함을 CI green 으로 확인한다.

## Out of Scope

- REQ-068 / REQ-069 (계정 생성 실패 사유 구체 표시 · 아이디 중복 vs 형식 위반 구분) — `runCreateUser` 의 error 문구 파생 계약 변경을 동반하므로 **후속 slice**.
- REQ-070 ~ REQ-073 (평가 대상 관리 UI · RBAC) — 별도 chain.
- backend (`src/`) · e2e · smoke · CI workflow · `package.json` 변경 **0 파일**.
- 사용자 생성 폼의 레이아웃 · CSS · 버튼 disabled 조건 · 인원 생성 폼(`fullName`/`email`) · 인스턴스 접근 권한 부여 폼 변경 금지 (본 slice 는 사용자 생성 2 입력의 안내 배선만).
- `docs/requirements.md` 의 `REQ-067` 상태 `PLANNED` → 갱신 금지 — REQ-067 은 본 slice 로 두 화면이 모두 닫히지만 상태 갱신은 doc-only 라 `direct` 로 분리 (§3.1 rule 3). Follow-ups 에 남긴다.
- `SuperAdminSetupForm.tsx` / 그 spec 수정 금지 (named import 로 읽기만 — 수정하면 파일 수 · 표면이 커진다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner) REQ-068 / REQ-069 slice — 계정 생성 실패 시 위반 입력·조건별 구체 사유 표시 + 409 중복과 400 형식/길이 위반 구분. SuperAdmin 셋업(`signup` helper 의 `null` 흡수 계약) 과 Admin 사용자 추가(`runCreateUser` 문구 파생) 두 축이라 slice 2 개로 분할 예상.
- (planner) 본 slice 머지 후 `docs/requirements.md` `86 행` `REQ-067` 상태 `PLANNED` → 구현 반영 갱신 (doc-only `direct`, T-1710 + 본 task 두 화면 pointer 동반).
