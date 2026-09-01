---
id: T-1839
title: REQ-081 로그아웃 + REQ-082 세션 복원 배치 재판정 + PLAN 133 행 ② · ③ 조각 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-081, REQ-082]
independentStream: req-081-082-session-rejudge
dependsOn: [T-1837, T-1838]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
estimatedDiff: 60
estimatedFiles: 2
created: 2026-09-02
completed: 2026-09-02
plannerNote: "P6 / PLAN 133 행 ② · ③ — T-1837 · T-1838 머지 완료, §3.1 규칙 6 상 구현 후 1 회 배치 재판정"
---

# T-1839 — REQ-081 로그아웃 + REQ-082 세션 복원 배치 재판정 + PLAN 133 행 ② · ③ 조각 갱신

## Why

[docs/PLAN.md](../PLAN.md) `133 행` 오너 지시 bullet (UI 기본기 — R-187~R-191) 의 조각 ② 로그아웃과 ③ 새로고침 세션 복원이 각각 [T-1837](T-1837-web-logout-wiring.md) (PR #1443 → main `57ab7e41`) 과 [T-1838](T-1838-web-session-restore-hydration.md) (PR #1444 → main `cd071b25`) 로 머지됐다. CLAUDE.md `§3.1` 규칙 6 은 REQ status 재판정을 **구현 slice 머지 후 1 회** 로 제한하므로 지금이 그 1 회이며, T-1838 `Follow-ups` 가 지시한 대로 두 REQ 를 **한 direct task 로 배치 처리** 한다 ([T-1833](T-1833-requirements-collection-target-ui-rejudge.md) 이 3 REQ 를 한 번에 재판정한 선례 — PLAN `182 행` 오너 지시의 doc-sync commit 절감 취지).

**issue-still-relevant pre-check 실측 (origin/main `7d4a286a`)** — ① [docs/requirements.md](../requirements.md) `100 행` REQ-081 · `101 행` REQ-082 두 row 의 status 가 **여전히 `PLANNED`** 로 실제 shipped 상태와 어긋난다 (drift 미해소). ② PLAN `133 행` 본문의 ② · ③ 조각에는 shipped 서술이 아직 없다 (`⑤` 만 T-1836 이 갱신했다). ③ 재판정 재료도 이미 main 에 있다 — 로그아웃은 backend `src/auth/auth.controller.ts` `194 행` `@Post("logout")` (cookie clear 2 종 → 204) + web `web/src/api/auth.ts` `76 행` `logout()` + `web/src/AppShell.tsx` `126 행` `shouldShowLogout` · `369 행` `handleLogout`, 세션 복원은 `AppShell.tsx` `142 행` `shouldRestoreSession` · `160 행` `restoredView` · `303 행` 부트 effect 다. 따라서 본 task 는 중복이 아니며 잔여 전량을 cover 한다.

## Required Reading

- [docs/requirements.md](../requirements.md) `99~103 행` — REQ-080 ~ REQ-084 row (재판정 대상은 `100 행` · `101 행` 두 줄, `103 행` REQ-084 는 서술 양식 참고용)
- [docs/PLAN.md](../PLAN.md) `133 행` — UI 기본기 오너 지시 bullet (① ~ ⑤ 조각 중 ② · ③ 만 갱신)
- [docs/tasks/T-1836-requirements-req084-error-lines-rejudge.md](T-1836-requirements-req084-error-lines-rejudge.md) — 직전 재판정 선례 (근거 서술 형식 · 행 좌표 인용 방식)
- [docs/tasks/T-1837-web-logout-wiring.md](T-1837-web-logout-wiring.md) · [docs/tasks/T-1838-web-session-restore-hydration.md](T-1838-web-session-restore-hydration.md) — 두 구현 slice 의 Acceptance Criteria
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) `178~200 행` — `POST /api/auth/logout` cookie 무효화 계약
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `23 행` · `66~90 행` — `LOGOUT_PATH` · `logout()` (실패 흡수 계약)
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `52~60 행` · `126~175 행` · `288~330 행` · `364~380 행` · `440~495 행` — 상수 · 순수 helper 3 개 · 부트 복원 effect · `handleLogout` · 렌더 배선
- [test/e2e/auth.e2e-spec.ts](../../test/e2e/auth.e2e-spec.ts) — logout 축의 backend e2e 존재 근거 (검증 위치 칸 판정용)

## Acceptance Criteria

- [x] [docs/requirements.md](../requirements.md) `100 행` REQ-081 의 status 를 실측 근거와 함께 재판정한다. 근거 서술에는 (a) backend 무효화 축 (`src/auth/auth.controller.ts` 의 `@Post("logout")` — access · refresh cookie clear 후 204), (b) web 호출 축 (`web/src/api/auth.ts` `logout()` — 실패를 `false` 로 흡수해 throw 0), (c) UI 진입점 · 세션 종료 축 (`AppShell.tsx` `shouldShowLogout` 게이트 · `handleLogout` 의 `currentUser=null` · `view='login'` · `sessionEpoch` 증가 remount), (d) 검증 위치 (backend `test/e2e/auth.e2e-spec.ts` + web colocated vitest) 를 **파일 경로 + 행 좌표** 로 박제한다.
- [x] [docs/requirements.md](../requirements.md) `101 행` REQ-082 의 status 를 실측 근거와 함께 재판정한다. 근거 서술에는 (a) 복원 조건 순수 helper (`shouldRestoreSession` — 미인증 진입 view · 미시도 · 미적재 3 조건), (b) 목적지 helper (`restoredView` — 유효 사용자면 인증 후 view, 아니면 미인증 진입 view, throw 0), (c) 부트 effect 배선 (`fetchCurrentUser()` 1 회 호출 · 실패 조용 흡수 · 시도 플래그 확정으로 재시도 루프 차단 · `cancelled` 언마운트 방어), (d) 검증 위치 를 파일 경로 + 행 좌표로 박제한다.
- [x] 두 row 의 **검증 위치 칸** 이 저장소의 실제 검증 실체와 일치하는지 확인해 필요 시 정정한다 — 저장소에 web 브라우저 e2e harness 가 없다는 사실을 확인했다면 그 사실을 근거로 칸을 조정하고, 조정 사유를 row 서술에 1 문장 남긴다 ([T-1836](T-1836-requirements-req084-error-lines-rejudge.md) 이 REQ-084 의 칸을 `unit` 으로 유지한 선례와 동일한 판단 기준).
- [x] 실측 결과 **잔여가 있으면 `DONE` 으로 올리지 않는다** — 잔여를 row 서술에 명시하고 status 는 그 잔여에 맞는 값으로 둔다 (재판정은 승격 의식이 아니라 실측 반영이다).
- [x] [docs/PLAN.md](../PLAN.md) `133 행` bullet 본문의 ② 조각과 ③ 조각에 shipped 서술 (근거 task 링크 + main commit 또는 PR 번호) 을 추가한다. bullet 앞머리 마커는 잔여 (① 전역 CSS · ④ R-78 polling) 가 남아 있으므로 **`[ ]` 유지** 하고, 그 유지 사유를 bullet 본문에 1 문장 남긴다.
- [x] `grep -n "REQ-081\|REQ-082" docs/requirements.md` 출력의 두 row 에 `PLANNED` 가 남아 있지 않다 (재판정 결과 값으로 치환됐다).
- [x] `grep -c "T-1837\|T-1838" docs/PLAN.md` 가 1 이상 — PLAN `133 행` 의 ② · ③ 조각이 두 구현 slice 를 실제로 링크한다.
- [x] 행 좌표 표기는 CLAUDE.md `§12` 범위 좌표 규약을 따른다 (구분자 `~` 하나 · 단일 행은 `N 행` · `L` prefix 금지).
- [x] 코드 · 테스트 변경 0 — 본 task 는 doc-only `direct` 이므로 R-112 test 항목은 적용 대상이 아니다 (분기 · public symbol 신설 0 → 해당 항목 생략).

## Out of Scope

- REQ-080 (전역 CSS) · REQ-083 (R-78 polling) 재판정 — 두 축은 구현 자체가 미shipped 라 재판정 대상이 아니다.
- PLAN `133 행` bullet 마커를 `[x]` 로 승격하는 것 — ① · ④ 잔여가 남아 있어 금지.
- `web/` · `src/` · `test/` 의 어떤 코드 · spec 변경.
- 새 ADR 작성 또는 기존 ADR 의 Decision · Consequences 실질 변경 (그것은 `pr` 대상이다).
- 다른 REQ row 의 status 손대기 (본 task 는 `100 행` · `101 행` 두 줄 + PLAN `133 행` 한 줄만 건드린다).
- 전역 표기 일괄 치환 · 대량 정규화 (CLAUDE.md `§12` 소급 치환 금지).

## Suggested Sub-agents

`implementer` (doc-only 실측 재판정이라 architect · tester 미호출 — 코드 변경 0)

## Follow-ups


- PLAN `133 행` 잔여 ① 전역 CSS 정돈 (새 dependency 가능성 탓 architect ADR + CLAUDE.md `§5` 게이트 선행 판단 필요) · ④ R-78 polling (backend endpoint 신설 동반이라 slice 다분할 필요) — 본 재판정과 독립된 구현 arc 로 남긴다.
- 본 재판정에서 REQ-081 · REQ-082 중 잔여가 확인되면 그 잔여를 덮는 구현 slice 를 별도 task 로 큐잉한다 (`§3.1` 규칙 6 상 재판정은 본 task 1 회로 소진). — **실측 결과 두 REQ 모두 잔여 0 이라 구현 slice 큐잉은 불요**.
- 부트 세션 복원 중 로딩 표시 축 — `GET /api/auth/me` 응답 도착 전 짧은 순간 로그인 폼이 보인다. REQ-082 의 도착 상태 의무는 충족하므로 그 row 의 잔여로는 적지 않았고, PLAN `133 행` 잔여 ① 전역 CSS · UX 정돈 (REQ-080) 계열의 후속 slice 로 남긴다.
- refresh token 의 server-side revocation (ADR-0008 `§Consequences 6` 의 `RefreshToken` revoked flag) — schema 에 model 자체가 없고 `src/auth/auth.controller.ts` `211 행` 주석이 이미 T-0086 로 추적 중이다. REQ-081 의 잔여가 아니라 인증 backbone 축이라 본 재판정에서 별도 큐잉하지 않는다.

## 결과 요약 (2026-09-02 완료)

- **[docs/requirements.md](../requirements.md) `100 행` REQ-081 → `DONE`** — (a) backend 무효화 축 `src/auth/auth.controller.ts` `194~199 행` (`@Post("logout")` + `@HttpCode(204)` → `clearCookie` 2 종, set 시점과 동일한 `COOKIE_OPTIONS`, guard 0 idempotent), (b) web 호출 축 `web/src/api/auth.ts` `23 행` `LOGOUT_PATH` · `76 행` `logout()` (실패 전량 `false` 흡수 · throw 0), (c) UI 진입점 · 세션 종료 축 `web/src/AppShell.tsx` `126 행` `shouldShowLogout` · `480~490 행` 렌더 · `369 행` `handleLogout` (`setCurrentUser(null)` · `setView('login')` · `sessionEpoch` 증가 → `447 행` `key={sessionEpoch}` AuthGate remount), (d) 검증 위치 backend e2e `test/e2e/auth.e2e-spec.ts` `261 행` describe + web vitest `web/src/api/auth.test.ts` `514 행` · `web/src/AppShell.test.tsx` `716 행` · `747 행` 를 행 좌표로 박제했다. 검증 위치 칸은 `unit + e2e` 유지 (두 층 모두에 검증 실체 존재).
- **[docs/requirements.md](../requirements.md) `101 행` REQ-082 → `DONE`** — (a) `142 행` `shouldRestoreSession` 3 조건, (b) `160 행` `restoredView` fail-safe, (c) `303 행` 부트 effect (1 회 조회 · 실패 조용 흡수 · 시도 플래그 확정 · `cancelled` 방어), (d) 검증 위치 `web/src/AppShell.test.tsx` `846 행` · `899 행` · `936 행` 3 describe 를 박제했다. 검증 위치 칸은 **`e2e` → `unit` 으로 조정** — `test/e2e/` 27 spec 이 전부 supertest HTTP 축이라 브라우저 새로고침 harness 가 0 건이고 실제 검증 실체가 colocated vitest 뿐이기 때문이며, 그 사유를 row 서술에 1 문장 남겼다 (T-1836 선례와 동일 기준).
- **[docs/PLAN.md](../PLAN.md) `133 행`** — ② 로그아웃 조각에 T-1837 (PR #1443, main `57ab7e41`), ③ 세션 복원 조각에 T-1838 (PR #1444, main `cd071b25`) shipped 서술을 링크와 함께 추가하고, 마커는 잔여 (① 전역 CSS · ④ R-78 polling) 탓에 `[ ]` 유지 + 그 사유 1 문장을 본문에 남겼다.
- 잔여 판정 — 두 REQ 모두 잔여 0. 경계 2 건 (복원 중 로딩 표시 · refresh token server-side revocation) 은 각각 REQ-080 계열 · T-0086 소관으로 분류해 `Follow-ups` 에 박제했다.
- 코드 · 테스트 변경 0 (doc-only `direct`).
