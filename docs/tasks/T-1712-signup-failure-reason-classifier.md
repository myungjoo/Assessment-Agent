---
id: T-1712
title: signup 실패 응답을 위반 조건별 구체 사유로 분류하는 순수 helper 박제
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-068, REQ-069]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-26
completedAt: 2026-08-26T05:57:23Z
prNumber: 1343
mergeCommit: 04b112a9
independentStream: account-create-ux
dependsOn: []
touchesFiles:
  - web/src/api/signupError.ts
  - web/src/api/signupError.test.ts
plannerNote: "P6 오너 지시 PLAN 129 행 계정 생성 UX 분해 slice 3 — REQ-068/069 사유 분류기(순수 함수)만 선박제, 배선은 후속"
---

# T-1712 — signup 실패 응답을 위반 조건별 구체 사유로 분류하는 순수 helper 박제

## Why

오너가 `9485c923` 로 직접 등록한 최우선 지시 [PLAN](../PLAN.md) `129 행` 🔴(계정 생성 UX)의 분해 slice 3 이다. slice 1(T-1710 SuperAdmin 셋업 폼) · slice 2(T-1711 Admin 사용자 추가 폼)가 [REQ-067](../requirements.md) `86 행`(조건 **사전** 안내)을 두 화면 모두에서 닫았고, 남은 축이 [REQ-068](../requirements.md) `87 행`(실패 시 **어떤 입력이 어떤 조건을 위반했는지** 구체 사유 표시 · 포괄 오류 문구 1 개로 뭉뚱그리기 금지)과 [REQ-069](../requirements.md) `88 행`(아이디 **중복** 오류와 **형식/길이** 위반 오류 구분)이다.

현재 [AppShell.tsx](../../web/src/AppShell.tsx) `99 행` 은 정확히 오너가 금지한 문구 `'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` 를 그대로 표시하는데, 그 원인은 상류인 [auth.ts](../../web/src/api/auth.ts) `signup` 이 409(중복)와 400(`AddUserDto` 위반)을 **둘 다 `null` 로 흡수**해 사유 정보를 버리기 때문이다. 본 slice 는 그 정보를 되살리는 **순수 분류 함수 1 개**만 신설한다 — `signup` 시그니처 · AppShell · AdminView 배선은 표면이 넓어 후속 slice 로 분리한다(§3 크기 상한 준수). 분류기가 먼저 있어야 후속 배선 slice 가 문구를 재정의하지 않고 재사용할 수 있다(T-1711 이 T-1710 의 hint 상수를 재사용한 것과 동형).

`signup` 이 409/400 을 단일 `null` 로 흡수한 근거였던 "enumeration-safe" 는 [auth.ts](../../web/src/api/auth.ts) `70~72 행` **코드 주석 정책**일 뿐 어떤 ADR 에도 박제돼 있지 않다(`docs/decisions/` 에 signup enumeration 결정 0 건). 따라서 오너 지시(REQ-069)가 이를 정면으로 대체하며 ADR 충돌은 없다 — 다만 본 task 는 `signup` 을 **건드리지 않으므로** 런타임 동작 변화 0 이고, 주석 정책 문구 갱신은 배선 slice 의 책임이다.

## Required Reading

- [web/src/api/auth.ts](../../web/src/api/auth.ts) — `signup` 의 현 계약(2xx→role / 409·400→`null` / 그 외 throw)과 enumeration-safe 주석 위치.
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `ApiError`(필드 `status` + `message`)와 비-2xx 시 `message` 에 **응답 body 원문 텍스트**를 담는 분기(`await response.text()`).
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `82~108 행` — 현재 포괄 오류 문구를 쓰는 지점(본 task 는 읽기만, 수정 금지).
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) — 400 을 만드는 decorator 4 종(`@IsEmail` · `@IsNotEmpty` · `@IsString` · `@MinLength(PASSWORD_MIN_LENGTH=8)`).
- [src/user/user.service.ts](../../src/user/user.service.ts) `249~260 행` — P2002 → `ConflictException('email already exists: ...')` 로 409 를 만드는 지점.
- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `12~24 행` — T-1710 이 export 한 `PASSWORD_MIN_LENGTH` · hint 문구 상수(사유 문구의 길이 표기를 여기와 어긋나지 않게 맞출 것).
- 신규 spec 위치(colocated 의무): `web/src/api/signupError.test.ts` — 같은 디렉토리의 [auth.test.ts](../../web/src/api/auth.test.ts) 가 vitest 작성 convention 의 참고 기준.

## Acceptance Criteria

- [ ] 신규 파일 `web/src/api/signupError.ts` 가 다음을 named export 한다.
  - `type SignupFailureKind = 'duplicate-username' | 'invalid-input' | 'unknown'`
  - `interface SignupFailure { kind: SignupFailureKind; username: string[]; password: string[]; other: string[] }` — 축별 한국어 사유 목록.
  - `function classifySignupFailure(status: number, body: string): SignupFailure`
  - `function formatSignupFailure(failure: SignupFailure): string[]` — 화면 표시용 줄 목록(각 줄이 `아이디` / `비밀번호` 중 어느 입력의 문제인지 드러나게).
- [ ] 분류 규칙이 다음과 같이 구현된다.
  - `status === 409` → `kind: 'duplicate-username'`, `username` 에 중복 전용 사유 1 줄(형식/길이 문구와 명확히 다른 문장). REQ-069 의 "중복 vs 형식/길이 구분" 축.
  - `status === 400` → `kind: 'invalid-input'`, 응답 body JSON 의 `message`(문자열 또는 문자열 배열)를 class-validator 문구로 축 매핑. 매핑 대상 **6 패턴만**: `email must be an email` · `email should not be empty` · `password must be longer than or equal to 8 characters` · `password should not be empty` · `password must be a string` · 그 외 `email`/`password` prefix 항목(각 축의 일반 사유로).
  - 위 어느 축에도 매핑 못 한 항목은 `other` 에 보존(정보 유실 0).
  - 그 외 status(0 · 401 · 5xx 등) → `kind: 'unknown'`, `other` 에 1 줄.
- [ ] 비밀번호 최소 길이 문구는 `SuperAdminSetupForm` 의 `PASSWORD_MIN_LENGTH` 와 어긋나지 않는다(값 `8` 을 문자열에 직접 박아 넣지 말고 상수 재사용 또는 동일 값 상수 선언 + 주석으로 정본 명시).
- [ ] `formatSignupFailure` 는 **어떤 입력에 대해서도** `'이미 등록된 사용자이거나 입력이 올바르지 않습니다'` 같은 중복·형식 병합 포괄 문구를 만들지 않는다(REQ-068 금지 조항). spec 이 이를 guard.
- [ ] colocated spec `web/src/api/signupError.test.ts` 가 R-112 4 종을 cover 한다.
  - happy-path: 409 body / 400 email 위반 body / 400 password 위반 body / 400 두 축 동시 위반 body 각각에 대해 기대 `kind` 와 축별 사유가 나오는 test 1+.
  - error path: body 가 빈 문자열 · JSON 이 아닌 텍스트(`HTTP 400`) · `message` 키 부재 · `message` 가 객체 등 비정상 형태여도 throw 하지 않고 `kind` 는 유지한 채 `other` 로 흡수하는 test 1+.
  - 분기 cover: `kind` 3 값 각각 1+, `message` 가 string 인 경우와 string[] 인 경우 각각 1+, 매핑되는 항목/매핑 안 되는 항목 각각 1+.
  - negative cases 충분 cover: ① 409 결과에 형식/길이 문구가 섞이지 않음 ② 400 결과에 중복 문구가 섞이지 않음 ③ 금지된 포괄 문구가 `formatSignupFailure` 출력 어디에도 없음 ④ 사용자가 입력한 비밀번호 값이 결과 문자열에 노출되지 않음 ⑤ 미지 status(0/500)에서 축별 배열이 비고 `other` 만 채워짐 — 각 1+ test.
- [ ] `pnpm --dir web test` 통과(기존 web test 전량 회귀 0), `pnpm --dir web build` 통과.
- [ ] backend 무변경 확인 — `git diff --name-only origin/main` 결과에 `src/` · `test/` · `.github/workflows/` · `package.json` 파일 0 개(따라서 backend coverage 게이트 무영향, R-112 coverage 항목은 web vitest green 으로 갈음).

## Out of Scope

- [auth.ts](../../web/src/api/auth.ts) `signup` 의 시그니처·반환 계약 변경 및 enumeration-safe 주석 갱신 — 후속 배선 slice.
- [AppShell.tsx](../../web/src/AppShell.tsx) `99 행` 포괄 문구 교체, `SuperAdminSetupForm` / `AdminView` 의 오류 표시 UI 변경 — 후속 배선 slice(파일 수 cap 때문에 분리).
- backend 오류 응답 형태 변경(`ConflictException` 문구 · ValidationPipe 옵션 · 필드별 error code 신설) — `src/` diff 0 유지.
- 매핑 문구 표를 6 패턴 너머로 확장하거나 i18n 체계 도입.
- [requirements.md](../requirements.md) `87~88 행` REQ-068/069 상태 갱신 — doc-only `direct` 후속.
- REQ-070~073(평가 대상 관리 UI) 관련 일체.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
