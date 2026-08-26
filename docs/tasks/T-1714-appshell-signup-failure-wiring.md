---
id: T-1714
title: AppShell 셋업 실패 포괄 문구를 축별 구체 사유로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-068, REQ-069]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-08-26
independentStream: account-creation-ux
dependsOn: [T-1712, T-1713]
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
plannerNote: P6 오너 지시(PLAN 129 행 🔴) 분해 slice 5 — T-1713 signupDetailed 를 AppShell 에 배선해 금지 포괄 문구 제거.
---

# T-1714 — AppShell 셋업 실패 포괄 문구를 축별 구체 사유로 교체

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `129 행` 🔴(계정 생성 UX)의 분해 slice 5 다. T-1712 가 순수 helper [signupError.ts](../../web/src/api/signupError.ts)(`classifySignupFailure` / `formatSignupFailure`)를, T-1713 이 사유를 보존하는 API 계약 [auth.ts](../../web/src/api/auth.ts) `signupDetailed` 를 각각 박제했지만, **화면은 아직 그 정보를 쓰지 않는다** — [AppShell.tsx](../../web/src/AppShell.tsx) `99 행` 이 여전히 오너가 정면으로 금지한 포괄 문구 `'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` 를 그대로 표시한다.

본 slice 는 SuperAdmin 초기 셋업 화면의 소비 지점 **하나만** 교체한다: `handleSetupSubmit` 이 `signup` 대신 `signupDetailed` 를 호출하고, 실패 시 `formatSignupFailure` 가 만든 축별 구체 사유를 폼 error 로 표시한다. 이로써 [REQ-068](../requirements.md) `87 행`(위반 조건별 구체 사유 · 포괄 문구 금지)과 [REQ-069](../requirements.md) `88 행`(중복 오류 vs 형식/길이 오류 구분)이 셋업 화면에서 실제로 충족된다. Admin 사용자 추가 화면([AdminView.tsx](../../web/src/views/AdminView.tsx))은 다른 API 경로를 쓰므로 후속 slice 로 분리한다.

## Required Reading

- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — `68 행` setupError state, `90~107 행` `handleSetupSubmit`(교체 대상), `99 행` 금지 포괄 문구, `103 행` catch 문구.
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) — 기존 `describe('AppShell')` 8 it(전부 `renderToStaticMarkup` 정적 렌더). 회귀 게이트.
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `60~126 행` — `signupDetailed` 반환 계약(`SignupResult { role, failure }`), 2xx·409·400·그 외 분기.
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) `9~22 행`(`PASSWORD_MIN_LENGTH` · `SignupFailureKind` · `SignupFailure`) · `114~122 행`(`formatSignupFailure` → `string[]`, `아이디:` / `비밀번호:` / `기타:` 접두).
- [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `40 행`(`error?: string`) · `75 행`(`role="alert"` 렌더) — error prop 이 단일 문자열이라는 제약.
- [docs/requirements.md](../requirements.md) `87~88 행` — REQ-068 / REQ-069 원문.

## Acceptance Criteria

- [ ] [AppShell.tsx](../../web/src/AppShell.tsx) 의 `handleSetupSubmit` 이 `signup` 대신 `signupDetailed`(named import) 를 호출하고, `role` 이 문자열이면 종전대로 `setView('login')` 으로 재진입한다(성공 동작 변화 0).
- [ ] 실패(`role === null` + `failure !== null`) 시 `formatSignupFailure(failure)` 결과를 폼 error 문자열로 변환해 표시한다. `error?: string` 제약 때문에 여러 줄을 하나의 문자열로 합치되, **각 줄의 구체 사유 문장은 원문 그대로 보존**하고 요약·병합하지 않는다(구분자는 코드 주석으로 근거를 남긴다).
- [ ] 변환 로직은 AppShell 에서 **named export 한 순수 함수**(예: `buildSetupErrorMessage(failure)`)로 분리한다 — web 에 `@testing-library/react` 가 없어(§5 새-dep 게이트) 상호작용 렌더 test 가 불가하므로, 순수 함수 단위로 검증 가능해야 한다.
- [ ] 금지 문구 제거 확인: `grep -n "이미 등록된 사용자이거나" web/src/AppShell.tsx` 결과 **0 건**.
- [ ] 2xx 인데 `role` 이 없고 `failure` 도 null 인 비정상 응답 분기는 사유를 지어내지 않는 별도 fallback 문구로 처리한다(네트워크/5xx catch 문구와 구분 가능해야 한다).
- [ ] happy-path unit test 1+ — `buildSetupErrorMessage` 가 `duplicate-username` failure 에 대해 중복 전용 사유를 그대로 담은 문자열을 만든다.
- [ ] error path unit test 1+ — `invalid-input` failure(아이디 형식 + 비밀번호 길이 동시 위반)에서 두 사유가 **모두** 문자열에 남는다(하나로 병합 금지).
- [ ] 분기 cover — `buildSetupErrorMessage` 의 분기마다 test 1+: ① 줄 1 개 ② 줄 2+ 개 ③ 빈 목록(`username`/`password`/`other` 전부 비어 있는 failure) 의 fallback.
- [ ] negative cases 충분 cover(각 1+ test) — ① 결과 문자열에 오너 금지 문구 `'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` 가 나타나지 않는다 ② 결과 문자열에 사용자가 입력한 비밀번호 값이 섞이지 않는다 ③ `duplicate-username` 결과와 `invalid-input` 결과가 서로 다른 문자열이다(REQ-069 구분 축) ④ `other` 만 있는 failure 에서도 그 원문이 유실되지 않는다.
- [ ] 기존 `describe('AppShell')` 8 it 이 **무수정으로 통과**한다(특히 `initialSetupError` 정적 표시 test) — 정적 렌더 계약 회귀 0.
- [ ] `pnpm --dir web test` green, `pnpm --dir web build` green.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` diff **0 파일** — backend jest coverage(line ≥ 80% / function ≥ 80%)는 무영향이며 `pnpm test:cov` 재실행 불요임을 PR 본문에 명시.

## Out of Scope

- [AdminView.tsx](../../web/src/views/AdminView.tsx) 의 사용자 추가 실패 문구 교체 — 다른 API 경로(`runCreateUser`)라 표면이 다르다. 후속 slice.
- [SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) 의 `error` prop 타입 변경(`string | string[]`)이나 여러 줄 렌더 스타일(CSS `white-space`) 도입 — 파일 수가 늘어 §3 cap 을 압박한다. Follow-ups 로.
- [auth.ts](../../web/src/api/auth.ts) `signup` wrapper 삭제·시그니처 변경 — 다른 호출측 영향 검토가 필요한 별개 정리.
- [signupError.ts](../../web/src/api/signupError.ts) 의 매핑표 확장(새 class-validator 패턴 추가).
- [requirements.md](../requirements.md) `87~88 행` REQ-068 / REQ-069 상태 갱신 — doc-only `direct` 후속.
- 새 dependency 추가(`@testing-library/react` 등) — §5 새-dep 게이트 대상.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
