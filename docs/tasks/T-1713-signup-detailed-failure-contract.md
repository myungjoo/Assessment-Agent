---
id: T-1713
title: signup 실패 사유를 보존하는 signupDetailed 계약 추가
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-068, REQ-069]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-26
completedAt: 2026-08-26T06:50:25Z
prNumber: 1344
independentStream: account-creation-ux
dependsOn: [T-1712]
touchesFiles:
  - web/src/api/auth.ts
  - web/src/api/auth.test.ts
plannerNote: P6 오너 지시(PLAN 129 행 🔴) 분해 slice 4 — T-1712 helper 를 실제 API 경로에 잇는 signupDetailed 계약 신설(배선은 후속).
---

# T-1713 — signup 실패 사유를 보존하는 signupDetailed 계약 추가

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `129 행` 🔴(계정 생성 UX)의 분해 slice 4 다. T-1710·T-1711 이 [REQ-067](../requirements.md) `86 행`(조건 사전 안내)을 두 화면 모두에서 닫았고, T-1712 가 실패 응답을 축별 사유로 나누는 순수 helper [signupError.ts](../../web/src/api/signupError.ts)(`classifySignupFailure` / `formatSignupFailure`)를 박제했다. 그러나 정작 API 경로인 [auth.ts](../../web/src/api/auth.ts) `signup` 이 409·400 을 **둘 다 `null` 로 흡수**해 사유를 버리므로, 화면은 여전히 [AppShell.tsx](../../web/src/AppShell.tsx) `99 행` 의 포괄 문구(`'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` — 오너가 정면으로 금지한 문구)밖에 쓸 수 없다.

본 slice 는 그 정보 손실 지점 하나만 연다 — `signupDetailed` 를 신설해 실패 시 `SignupFailure` 를 보존해 반환하고, 기존 `signup` 은 그 위의 얇은 wrapper 로 재구현해 **호출측 계약을 그대로 유지**한다([AppShell.tsx](../../web/src/AppShell.tsx) 무변경 → 런타임 동작 변화 0). 화면 배선(포괄 문구 교체)은 표면이 다른 후속 slice 다([REQ-068](../requirements.md) `87 행` · [REQ-069](../requirements.md) `88 행` 의 최종 충족은 그 배선에서 완성).

## Required Reading

- [web/src/api/auth.ts](../../web/src/api/auth.ts) — `signup`(`75 행` 부근)의 현 계약 · 주석에 박힌 흡수 정책 · `export { login, refresh, signup }` 라인.
- [web/src/api/auth.test.ts](../../web/src/api/auth.test.ts) — `describe('auth.signup')`(`156 행` 부근) 기존 분기 test. 회귀 보존 대상.
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) — `SignupFailure` / `SignupFailureKind` / `classifySignupFailure(status, body)` 시그니처 (T-1712 박제).
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `23~30 행` + `93~97 행` — `ApiError.status` / `ApiError.message` 가 비-2xx 응답 **body 원문**을 담는다는 사실(분류 입력의 근거). 네트워크 실패는 `status 0`.

## Acceptance Criteria

- [ ] [auth.ts](../../web/src/api/auth.ts) 에 `signupDetailed(username, password)` 를 신설해 named export 한다. 반환은 성공/실패를 구분 가능한 단일 객체 — 성공 시 `role` 문자열(응답 body `role` 이 비문자열/누락이면 `null`)과 `failure: null`, 409·400 실패 시 `role: null` + `classifySignupFailure(status, message)` 결과의 `failure`.
- [ ] 409·400 **이외**의 에러(네트워크 `status 0` · 5xx 등)는 현행 `signup` 과 동일하게 `ApiError` 를 그대로 **throw** 한다(흡수 금지 — 호출측 catch 계약 불변).
- [ ] 기존 `signup` 은 `signupDetailed` 를 호출하는 얇은 wrapper 로 재구현하고 **반환 계약 `Promise<string | null>` 을 문자 그대로 유지**한다. 기존 `describe('auth.signup')` test 8 개가 수정 없이 그대로 통과해야 한다(회귀 게이트).
- [ ] `web/src/AppShell.tsx` · `web/src/views/AdminView.tsx` 를 포함해 **호출측 파일 diff 0** — `git diff --name-only` 결과가 `web/src/api/auth.ts` · `web/src/api/auth.test.ts` 2 개뿐이어야 한다.
- [ ] happy-path unit test 1+ — `signupDetailed` 가 201 응답 `{ role: 'SuperAdmin' }` 에 대해 `role='SuperAdmin'` · `failure=null` 을 반환.
- [ ] error path unit test 1+ — 409 응답에서 `failure.kind === 'duplicate-username'` 이고 `failure.username` 에 사유가 담기며 `failure.password` 는 빈 배열(중복 축과 형식 축이 섞이지 않음 — REQ-069).
- [ ] branch test — `signupDetailed` 의 분기마다 1+ test: ① 2xx + `role` 문자열 ② 2xx + `role` 누락/비문자열 → `role: null`, `failure: null` ③ 409 ④ 400 ⑤ 그 외(5xx / status 0) → throw.
- [ ] negative cases 충분 cover(각 1+): 400 body 가 `@IsEmail` 위반 문구일 때 `username` 축에만 사유가 쌓임 · 400 body 가 비-JSON 원문일 때도 throw 없이 `failure.other` 최소 1 줄 보존 · 5xx 는 `failure` 를 지어내지 않고 rejects · 응답 body 가 `null`/빈 객체여도 throw 0 · `formatSignupFailure(failure)` 결과에 금지 문구 `'이미 등록된 사용자이거나 입력이 올바르지 않습니다.'` 가 **포함되지 않음**(오너 금지 조항 guard).
- [ ] `pnpm --dir web test -- --run` green(기존 71 files 기준 회귀 0), `pnpm --dir web build` green.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` diff 0 파일 — backend coverage 무영향(web 은 vitest 라 `pnpm test:cov` 대상 밖이며, backend 파일 무변경으로 line/function ≥ 80% 임계 불변).

## Out of Scope

- [AppShell.tsx](../../web/src/AppShell.tsx) `99 행` 포괄 문구 교체 및 `signupDetailed` 배선 — 후속 slice.
- [AdminView.tsx](../../web/src/views/AdminView.tsx) 사용자 추가 실패 표시 배선 — 후속 slice.
- [signupError.ts](../../web/src/api/signupError.ts) 의 분류 규칙 · 문구 · `MESSAGE_MAP` 패턴 변경(T-1712 박제 그대로 소비만).
- backend(`src/`) 오류 응답 body 형식 변경 · `AddUserDto` 수정.
- [requirements.md](../requirements.md) `87~88 행` REQ-068/069 상태 갱신(doc-only `direct` 후속).
- REQ-070~073(평가 대상 관리 UI) 관련 일체.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
