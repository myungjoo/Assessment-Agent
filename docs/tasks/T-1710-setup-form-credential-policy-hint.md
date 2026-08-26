---
id: T-1710
title: SuperAdmin 초기 셋업 폼에 아이디·암호 조건 사전 안내 박제 (REQ-067 slice 1)
phase: P6
status: DONE
completedAt: 2026-08-26T03:52:18Z
commitMode: pr
coversReq: [REQ-067]
independentStream: owner-account-ux
dependsOn: []
touchesFiles:
  - web/src/components/SuperAdminSetupForm.tsx
  - web/src/components/SuperAdminSetupForm.test.tsx
estimatedDiff: 110
estimatedFiles: 2
created: 2026-08-26
plannerNote: P6 오너 지시 계정 생성 UX(PLAN 129 행) 분해 slice 1 — 셋업 폼 조건 사전 안내(REQ-067), presentational 단일 컴포넌트 한정
---

# T-1710 — SuperAdmin 초기 셋업 폼에 아이디·암호 조건 사전 안내 박제 (REQ-067 slice 1)

## Why

오너가 2026-08-26 직접 등록한 지시([README](../../README.md) `156~160 행`, [PLAN](../PLAN.md) `129 행` 🔴) 의 선행 step 인 requirements 동기는 T-1709 가 `REQ-067` ~ `REQ-073` 으로 마쳤고, 남은 것은 **task 분해** 다. 본 task 는 그 첫 slice 로 [REQ-067](../requirements.md) ("계정 생성 화면에서 아이디·암호 조건을 입력 전에 사전 안내") 을 **SuperAdmin 초기 셋업 폼 한 화면에 한정** 해 집행한다.

현 [SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) 는 label 2 개와 입력 2 개만 렌더할 뿐, 아이디가 email 형식이어야 한다는 사실도 비밀번호 최소 길이(backend [add-user.dto.ts](../../src/user/dto/add-user.dto.ts) 의 `PASSWORD_MIN_LENGTH = 8`) 도 화면에 없다. 사용자는 제출해 실패한 뒤에야 조건을 추측해야 한다 — REQ-067 이 정확히 금지하는 상태다.

REQ-068 / REQ-069 (실패 사유 구체 표시 · 중복 vs 형식 오류 구분) 는 `signup` helper 의 반환 계약(현재 400·409 를 모두 `null` 로 흡수) 변경을 동반해 표면이 다르므로 **별도 후속 slice** 로 분리한다. 본 slice 는 presentational 컴포넌트 1 개 + 그 spec 만 건드려 cap 안에서 닫는다.

## Required Reading

- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) — 변경 대상 컴포넌트 (props 계약 · `submitDisabled` 분기 · error alert 분기).
- [web/src/components/SuperAdminSetupForm.test.tsx](../../web/src/components/SuperAdminSetupForm.test.tsx) — 기존 14 개 it 블록. 본 slice 의 신규 test 는 이 파일에 append 하고 기존 케이스는 깨뜨리지 않는다.
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) — 안내 문구가 인용해야 할 **실제 backend 검증 규칙 정본** (`@IsEmail` + `@IsNotEmpty` + `@MinLength(PASSWORD_MIN_LENGTH)`, `PASSWORD_MIN_LENGTH = 8`).
- [docs/requirements.md](../requirements.md) `86 행` — `REQ-067` row (본 task 가 cover 하는 지시 원문).

## Acceptance Criteria

- [ ] `SuperAdminSetupForm` 이 **입력 전에도 항상 보이는** 조건 안내를 렌더한다 — 아이디 축 1 개 + 비밀번호 축 1 개. 아이디 안내는 email 형식(예 문자열 포함) 과 공백 불가를, 비밀번호 안내는 **최소 8자** 를 명시한다. 두 문구는 backend `AddUserDto` 의 실제 규칙과 일치해야 한다 (없는 조건을 지어내지 않는다 — 대문자/특수문자 요구 등은 backend 에 없으므로 문구에 넣지 않는다).
- [ ] 안내 문구의 최소 길이 값은 파일 상단 상수로 박제하고(예: `PASSWORD_MIN_LENGTH`), 주석에 `src/user/dto/add-user.dto.ts` 의 동명 상수가 정본이며 web 은 별도 package 라 import 대신 값 동기임을 1~2 줄로 남긴다.
- [ ] 각 안내 문구에 `id` 를 부여하고 대응 `<input>` 에 `aria-describedby` 로 연결한다 (스크린리더에서도 입력 전 조건이 읽히도록).
- [ ] happy-path test 1+ — 정상 props 렌더 시 아이디 안내와 비밀번호 안내가 **둘 다** 문서에 존재하고, 비밀번호 안내에 `8` 이 포함됨을 검증.
- [ ] error path test 1+ — `error` props 가 있을 때도 `role="alert"` 와 **조건 안내가 동시에** 렌더됨을 검증 (실패 후에도 조건이 사라지지 않아야 한다).
- [ ] branch test — 본 변경이 도입하는 새 조건 분기는 없다(안내는 무조건 렌더). 대신 기존 분기(`loading` true/false, `error` 유무, 빈 입력) 각각에서 안내 문구가 그대로 렌더됨을 최소 2 개 분기에 대해 검증해 회귀를 막는다.
- [ ] negative cases 충분 cover — 최소 3 개: ① `username`/`password` 가 빈 문자열(입력 전 초기 상태)일 때도 안내가 보임 ② `loading=true` 로 submit 이 막힌 상태에서도 안내가 보임 ③ 안내 문구가 `password` props 의 실제 값을 노출하지 않음(마스킹 침해 0).
- [ ] `aria-describedby` 배선 검증 test 1+ — 아이디 입력의 `aria-describedby` 가 아이디 안내의 `id` 와, 비밀번호 입력의 것이 비밀번호 안내의 `id` 와 일치.
- [ ] 기존 14 개 it 블록 전부 그대로 통과 — `cd web && pnpm test` 가 green (신규 포함 전 케이스 pass).
- [ ] `cd web && pnpm build` (tsc `--noEmit` + vite build) 통과 — 타입 회귀 0.
- [ ] backend 무영향 확인: 루트 `pnpm lint && pnpm build && pnpm test` 통과. `src/` · `test/` · `.github/workflows/` · `package.json` diff **0 파일**. web 은 `coverageThreshold` 미배선(PLAN "게이트된 backlog — web coverage threshold") 이라 `pnpm test:cov` 의 line/function ≥ 80% 게이트는 backend 기준으로만 적용되며, 본 slice 는 backend LOC 을 늘리지 않으므로 수치 변동 0 이어야 한다.

## Out of Scope

- **REQ-068 / REQ-069** (실패 사유 구체 표시 · 아이디 중복 vs 형식/길이 오류 구분) — `web/src/api/auth.ts` 의 `signup` 반환 계약과 `web/src/AppShell.tsx` 의 포괄 문구 `'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` 교체가 필요한 별도 slice. 본 task 에서 그 문구를 건드리지 않는다.
- **Admin 의 사용자 추가 화면** 의 동일 안내(REQ-067 의 나머지 절반) — 별도 slice.
- **REQ-070 ~ REQ-073** (평가 대상 관리 UI) — 별개 오너 bullet(PLAN `130 행`).
- backend 변경 일체 — `AddUserDto` 의 규칙 강화/완화, 오류 응답 포맷 변경, 새 endpoint.
- `docs/requirements.md` 의 `REQ-067` 상태 `PLANNED` → 갱신 — doc-only 이므로 `direct` task 로 분리(§3.1 rule 3, 혼합 금지).
- CSS/스타일링, 새 dependency, i18n 프레임워크 도입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기 append)

## 완료 기록 (2026-08-26)

- PR [#1341](https://github.com/myungjoo/Assessment-Agent/pull/1341) round 1 APPROVE → squash merge `4924bc8c`. 2 파일 +131/-1.
- `SuperAdminSetupForm.tsx` 상단에 `PASSWORD_MIN_LENGTH` · 힌트 문구 상수를 박제하고(backend `add-user.dto.ts` 동명 상수가 정본임을 주석으로 명시), 안내 `<p>` 를 label 바깥에 배치해 입력의 접근 가능 이름 오염을 피했다. 조건 분기 추가 0 — 무조건 렌더.
- spec 은 기존 14 it 유지 + 7 it 추가. happy · error(alert 와 안내 동시 렌더) · branch(loading true/false · error 유무) · negative 3 종(빈 입력 · loading 차단 · 비밀번호 노출 0) · `aria-describedby` 배선 cover.
- web 70 files / 2089 test green, backend 453 suite / 13009 test green. `src/` · `test/` · workflows · `package.json` diff 0 파일이라 backend coverage 수치 불변.

## Follow-ups

- REQ-067 나머지 절반 — Admin 사용자 추가 화면에 동일 안내. 그 시점에 `USERNAME_HINT_TEXT` / `PASSWORD_HINT_TEXT` 를 공용 모듈로 승격 검토.
