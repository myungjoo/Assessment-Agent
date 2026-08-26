---
id: T-1715
title: Admin 사용자 추가 실패 문구를 축별 구체 사유로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-068, REQ-069]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-26
independentStream: account-creation-ux
dependsOn: [T-1712, T-1714]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.create-user-failure.test.ts
plannerNote: P6 오너 지시(PLAN 129 행 🔴) 분해 slice 6 — T-1714 가 남긴 두 번째 소비 지점(AdminView 사용자 추가) 배선.
---

# T-1715 — Admin 사용자 추가 실패 문구를 축별 구체 사유로 교체

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `129 행` 🔴(계정 생성 UX)의 분해 slice 6 이다. 오너 지시는 계정 생성 화면 **두 곳** — 첫 로그인 SuperAdmin 셋업과 **Admin 의 사용자 추가** — 을 모두 대상으로 한다. T-1712 가 순수 분류 helper [signupError.ts](../../web/src/api/signupError.ts) 를, T-1714 가 셋업 화면 배선을 각각 끝냈지만, **두 번째 화면은 아직 남아 있다**([T-1714](T-1714-appshell-signup-failure-wiring.md) 의 Out of Scope 첫 항목이 그대로 본 slice 다).

현재 [AdminView.tsx](../../web/src/views/AdminView.tsx) `1851 행` 의 `runCreateUser` 는 400(입력 검증 실패) 을 `describeError(e)`(= [useApiResource.ts](../../web/src/api/useApiResource.ts) 의 `toErrorMessage`) 로만 표면화한다 — 화면에 `HTTP 400: {"message":["email must be an email", ...]}` 같은 **응답 원문 JSON** 이 그대로 노출되고, 어느 입력이 어떤 조건을 위반했는지는 사용자가 해독해야 한다. 본 slice 는 그 400 분기 하나만 축별 한국어 사유로 바꿔 [REQ-068](../requirements.md) `87 행`(위반 조건별 구체 사유)과 [REQ-069](../requirements.md) `88 행`(중복 vs 형식/길이 구분)을 사용자 추가 화면에서도 충족시킨다. 409(중복) 분기는 이미 전용 문구 `USER_DUPLICATE_ERROR` 를 갖고 있어 **손대지 않는다**(회귀 0).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `19~21 행` import(`toErrorMessage` · `ApiError`), `142 행` `USER_DUPLICATE_ERROR`, `1834~1880 행` `CreateUserDeps` + `runCreateUser`(catch 의 409/그 외 2 분기), `3858~3875 행` `handleCreateUser` 의 deps 조립(`describeError: toErrorMessage` 가 교체 지점), `4596 행` `<p role="alert">{createUserError}</p>` 렌더, `4995~5036 행` named export 블록.
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) — `12 행` `SignupFailureKind`, `15~21 행` `SignupFailure`, `68 행` `classifySignupFailure(status, body)`(400 분기의 매핑표·미매핑 보존·최소 1 줄 보장), `114~122 행` `formatSignupFailure(failure): string[]`(`아이디:` / `비밀번호:` / `기타:` 접두).
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `23~30 행` · `92~99 행` — `ApiError`(`status` + `message`) 이며 **비-2xx 의 `message` 가 응답 body 원문**이라는 사실(본 slice 가 `classifySignupFailure(status, e.message)` 를 쓸 수 있는 근거).
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `38~68 행` — 선례 `SETUP_ERROR_SEPARATOR`(`' / '`) + `buildSetupErrorMessage`(T-1714). 본 slice 는 이 패턴을 mirror 한다.
- [web/src/views/AdminView.create-user-contract.test.ts](../../web/src/views/AdminView.create-user-contract.test.ts) `1~30 행` — 같은 endpoint 의 기존 spec 이 `readFileSync` 소스 대조 방식을 쓰는 선례(drift guard 작성 참고).
- [docs/requirements.md](../requirements.md) `87~88 행` — REQ-068 / REQ-069 원문.

## Acceptance Criteria

- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 에 **named export 한 순수 함수** `describeCreateUserFailure(e: unknown): string` 를 신설한다 — `ApiError` 이고 `status === 400` 이면 `formatSignupFailure(classifySignupFailure(400, e.message))` 의 줄들을 구분자로 이어 반환하고, 그 외 모든 입력은 종전 `toErrorMessage(e)` 결과를 그대로 반환한다(동작 변화 0). 어떤 입력에도 throw 하지 않는다.
- [ ] 여러 줄을 한 문자열로 합칠 때 **각 줄의 사유 문장은 원문 그대로 보존**하고 요약·병합하지 않는다(REQ-068 포괄 문구 금지). 구분자 상수는 [AppShell.tsx](../../web/src/AppShell.tsx) `43 행` 선례와 같은 값을 쓰고, 왜 줄바꿈이 아닌지 주석으로 근거를 남긴다.
- [ ] `handleCreateUser` 의 deps 가 `describeError: toErrorMessage` 대신 `describeError: describeCreateUserFailure` 를 넘긴다. `runCreateUser` 본문과 `CreateUserDeps` 타입은 **무수정**이며, 409 분기(`isConflict` → `USER_DUPLICATE_ERROR`)도 그대로 둔다(REQ-069 의 중복 축은 이미 충족 — 본 helper 는 409 에 관여하지 않는다).
- [ ] happy-path unit test 1+ — 400 + body `{"message":["email must be an email"]}` 에 대해 `아이디:` 접두의 구체 사유 1 줄을 반환한다.
- [ ] error path unit test 1+ — 400 + `email` · `password` 두 위반이 동시에 담긴 body 에서 **두 사유가 모두** 결과 문자열에 남는다(하나로 병합 금지, 순서는 아이디 → 비밀번호).
- [ ] 분기 cover — `describeCreateUserFailure` 의 분기마다 test 1+: ① `ApiError` 400 (분류 경로) ② `ApiError` 400 이지만 body 가 JSON 이 아님(분류기의 최소 1 줄 보장이 그대로 표면화) ③ `ApiError` 비-400(예: 500 · status 0 네트워크) → `toErrorMessage` 경로 ④ 비-`ApiError` throw 표면.
- [ ] negative cases 충분 cover(각 1+ test) — ① 400 결과 문자열에 raw JSON 조각(`{"message"` · `[` 로 시작하는 원문 배열)이 남지 않는다 ② `null` · `undefined` · 문자열 · 숫자 등 비-Error 입력에서도 throw 없이 문자열을 반환한다 ③ 결과 문자열에 사용자가 입력한 비밀번호 값이 섞이지 않는다 ④ 409 `ApiError` 를 helper 에 직접 넘겨도 형식/길이 어휘가 섞이지 않는다(REQ-069 구분 축) ⑤ 미매핑 message(예: `nickname must be a string`) 의 원문이 `기타:` 축에 유실 없이 남는다.
- [ ] drift guard 1+ — `readFileSync('web/src/views/AdminView.tsx')` 소스 문자열에서 `handleCreateUser` 의 deps 가 실제로 `describeError: describeCreateUserFailure` 를 넘기는지 대조한다(웹에 `@testing-library/react` 가 없어 상호작용 렌더 test 가 불가하므로 배선 여부는 소스 대조로 고정 — [AdminView.userlist-wiring.test.tsx](../../web/src/views/AdminView.userlist-wiring.test.tsx) 선례).
- [ ] 기존 `describe('AdminView — 사용자 생성 실 POST create mutation (T-1160 runCreateUser)')` 의 it 들이 **무수정으로 통과**한다(자체 deps fake 를 넘기므로 러너 계약 회귀 0).
- [ ] `pnpm --dir web test` green, `pnpm --dir web build` green.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` diff **0 파일** — backend jest coverage(line ≥ 80% / function ≥ 80%)는 무영향이며 `pnpm test:cov` 재실행 불요임을 PR 본문에 명시한다.

## Out of Scope

- `runCreateUser` 러너 본문 · `CreateUserDeps` 타입 · 409 전용 문구(`USER_DUPLICATE_ERROR`) 변경 — 기존 spec 대량 수정을 부르고 cap 을 압박한다.
- `<p role="alert">` 를 여러 줄 목록(`<ul>`)으로 바꾸거나 CSS `white-space` 를 도입하는 렌더 개편 — 별도 slice.
- [signupError.ts](../../web/src/api/signupError.ts) 매핑표 확장 · [AppShell.tsx](../../web/src/AppShell.tsx) 의 `buildSetupErrorMessage` 와의 공통 helper 추출 — 파일 수가 늘어 §3 cap 위반. Follow-ups 로.
- 역할 변경 · 인스턴스 접근 부여/회수 등 **다른 mutation** 의 실패 문구 정비 — 오너 지시 범위(계정 생성) 밖.
- [requirements.md](../requirements.md) `87~88 행` REQ-068 / REQ-069 상태 갱신 — doc-only `direct` 후속 task.
- 새 dependency 추가(`@testing-library/react` · `@vitest/coverage-v8` 등) — §5 새-dep 게이트 대상.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
