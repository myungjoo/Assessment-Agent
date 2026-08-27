---
id: T-1736
title: useApiResource 에 reload 재조회 계약 신설 (호출부 호환 유지)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-08-27
independentStream: web-req077-period
dependsOn: [T-1735]
touchesFiles:
  - web/src/api/useApiResource.ts
  - web/src/api/useApiResource.test.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 4-카테고리 cover backbone × 1.5 = 250 LOC, T-1734(455 LOC) · T-1735(419 LOC) 동일 chain 선례 승계 — production 순증은 ≤ 60 LOC 로 억제하고 초과분은 전부 R-112 강제 spec"
plannerNote: "P6 오너 지시 PLAN 131 행 ④ / REQ-077 slice 5a — 제출 성공 후 표 재조회의 선행 hook 계약. 배선은 slice 5b."
---

# T-1736 — useApiResource 에 reload 재조회 계약 신설 (호출부 호환 유지)

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` ④ / REQ-077 분해의 **slice 5a** 다. 직전 T-1735 가 `DashboardView` 에 기간 지정 평가 요청을 배선했지만, 제출이 성공해도 결과 표는 옛 데이터를 그대로 들고 있다 — `useApiResource` 가 `path` 변경 시에만 재조회하고 **명시적 재조회 수단을 노출하지 않기** 때문이다. 실제로 `web/src/views/DashboardView.tsx` `70 행` 주석이 "useApiResource 의 reload 수단 신설을 동반하므로 slice 5 로 분리한다" 고 이미 박제해 두었다.

본 task 는 그 선행 계약만 잘라낸다 — hook 에 재조회 수단을 **가산적으로(additive)** 얹고 기존 5 개 호출부의 destructuring 을 그대로 두는 것까지. `DashboardView` 의 실제 배선(제출 성공 시 재조회 호출)은 **slice 5b** 로 분리한다. 컨테이너가 이미 866 행이고 그 전용 spec 도 큰 상태라 한 slice 에 합치면 §3 상한을 크게 넘긴다 — T-1734(순수 모듈 선행) → T-1735(배선) 선례를 승계한다.

`origin/main` 실측 pre-check: `web/src/api/useApiResource.ts` 의 `useApiResource` 반환값에 `reload` 류 심볼이 **0** 이고 `useEffect` deps 가 `[path]` 뿐이라, 본 slice 의 의도는 아직 main 에 안착되지 않았다.

## Required Reading

- `web/src/api/useApiResource.ts` — 본 task 의 유일한 production 변경 대상. `ApiResourceState` / `idleState` / `runFetch` / `useApiResource` 4 심볼과 `useEffect` deps 주석을 그대로 읽을 것.
- `web/src/api/useApiResource.test.ts` — 본 task 의 spec 변경 대상(158 행). 기존 `runFetch` 직접 호출 방식의 검증 관례를 승계한다.
- `web/src/views/DashboardView.tsx` `60~72 행` 및 `485~532 행` — slice 5 분리 사유 주석과 5 개 `useApiResource` 호출부의 destructuring 형태 확인용(**본 task 에서 수정 금지, 읽기만**).
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` §Decision 3 — thin custom fetch hook 의 책임 경계(loading/error → props). 새 dependency 0 원칙 확인.

## Acceptance Criteria

- [ ] `web/src/api/useApiResource.ts` 의 `useApiResource` 반환값에 **안정 신원(stable identity)** 의 `reload: () => void` 가 추가된다. 같은 컴포넌트가 여러 번 렌더돼도 `reload` 참조가 바뀌지 않아야 한다(`useCallback` deps `[]` + 함수형 `setState` 카운터).
- [ ] **기존 호출부 호환 유지** — `ApiResourceState<T>` 인터페이스 자체는 `data`/`loading`/`error` 3 필드 그대로 두고, hook 의 반환 타입만 `ApiResourceState<T> & { reload: () => void }` 형태의 별도 타입으로 확장한다. `runFetch` 의 `commit` 계약(`ApiResourceState<T>` 를 받음)은 **변경 0** — 기존 spec 이 `{ data, loading, error }` 리터럴을 commit 하는 방식이 그대로 통과해야 한다.
- [ ] `reload()` 호출 시 `path` 가 truthy 면 `request` 가 **다시 1회** 호출되고 `loading` 이 true 로 되돌아간 뒤 새 응답으로 갱신된다(`useEffect` deps 에 재조회 토큰 추가).
- [ ] `reload()` 호출 시 `path` 가 falsy(`null`/빈 문자열) 면 `request` 호출이 **0회** 이고 idle 상태가 유지된다(조건부 조회 계약 불변).
- [ ] **happy-path test 1+** — `path` truthy 상태에서 `reload()` 후 최신 데이터가 반영되는 케이스.
- [ ] **error path test 1+** — 첫 조회는 성공, `reload()` 후 요청이 실패해 `error` 문구로 전이되는 케이스 1+ 와, 첫 조회 실패 후 `reload()` 로 복구되는 케이스 1+.
- [ ] **분기 cover** — 추가/수정된 분기마다 test 1+: (a) `path` truthy 재조회 (b) `path` falsy 시 no-op (c) 재조회 도중 `path` 가 바뀌어 이전 응답이 stale 이 되는 race 가드 (d) 재조회 토큰만 바뀌었을 때와 `path` 만 바뀌었을 때의 effect 재실행.
- [ ] **negative cases 충분 cover (각 1+)** — ① `reload()` 를 연속 2회 호출해도 마지막 응답만 반영(중간 응답 무시) ② unmount 이후 도착한 재조회 응답이 state 를 덮어쓰지 않음 ③ `request` 가 `ApiError(status 0)` 로 실패해도 throw 가 밖으로 새지 않음 ④ 비-`Error` 값 throw 시에도 문자열 error 로 안전 변환 ⑤ `reload` 참조가 재렌더 간 동일(무한 refetch 유발 금지) ⑥ `reload()` 가 어떤 경우에도 반환값 없이(`undefined`) 종료하고 호출자에게 예외를 던지지 않음.
- [ ] `pnpm --filter web test` (또는 `web/` 에서 `pnpm test`) 로 web vitest 전량 green — 기존 `useApiResource` 소비 spec(`DashboardView.*`, `AdminView.*`) 이 **수정 없이** 통과해야 한다(호환성 회귀 게이트).
- [ ] `web/` 에서 `pnpm build`(tsc + vite) 통과 — 타입 확장이 5 개 기존 호출부의 destructuring 을 깨지 않음을 컴파일로 증명.
- [ ] 루트 `pnpm lint` 통과 + 루트 `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` diff 가 0 이므로 backend coverage 는 불변이어야 한다.
- [ ] **production 순증 ≤ 60 LOC** — `useApiResource.ts` 한 파일에만. 초과 시 즉시 멈추고 Follow-ups 에 기록.
- [ ] 새 dependency 0 — `web/package.json` diff **0 파일**(react hooks + 기존 `apiClient` 만 사용, ADR-0041 §Decision 3).

## Out of Scope

- `web/src/views/DashboardView.tsx` 수정 — 제출 성공 후 실제 재조회 호출 배선은 **slice 5b**. 본 task 에서 diff 0.
- `web/src/views/AdminView.tsx` 및 그 spec 들 — 기존 호출부는 읽기만, 수정 0.
- `web/src/components/*` (`DashboardPeriodSelector` 등) 수정.
- `web/src/api/apiClient.ts` · `assessmentRow.ts` · `assessmentRowOps.ts` · `periodEvaluationSubmit.ts` 수정.
- polling / 자동 갱신 / interval 도입 — 본 task 는 **명시적 수동 재조회 수단**만 만든다(R-78 자동 polling 은 별건 defer).
- `src/` · `prisma/` · `package.json` · CI workflow 변경.
- react-query / SWR 등 데이터 페칭 라이브러리 도입 (새 dep 게이트 §5).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다)

## 완료 기록

- **Status: DONE** — 2026-08-27T14:58:39Z (squash merge)
- PR [#1366](https://github.com/myungjoo/Assessment-Agent/pull/1366) → main `da246f58`
- 결과: `useApiResource` 반환 타입을 `ApiResourceHandle<T>`(기존 `ApiResourceState<T>` 3 필드 + `reload`)로 **가산 확장**해 기존 5 개 호출부의 destructuring 을 그대로 통과시켰다. `useEffect` deps 를 `[path, reloadToken]` 두 축으로 넓히고, effect 본체를 `startResourceEffect` 로 분리해 jsdom 없이도 검증 가능하게 했다. `reload` 는 `useCallback` deps `[]` + 함수형 `setState` 라 신원이 안정적이다.
- 규모: 2 파일 `+356/-36` — production 순증 **+38 LOC**(task 사전 고지 ≤60 준수), 초과분 283 행은 전부 R-112 강제 spec (`sizeExempt` 사전 정당화).
- 검증: 신규 spec 17 케이스(happy 3 · error 2 · 분기 4 · negative 6 · 토큰/호환 2). web vitest 83 파일 2500 test · web build(tsc+vite) · 루트 lint · `test:cov` 453 suite 13009 test 전량 green. `src/` diff 0 이라 backend coverage 불변, 새 dependency 0.
- reviewer round 1/7 APPROVE. reviewer nit(헤더 주석 책임 목록 drift)은 §3 Nit-in-PR closure 로 같은 PR 의 commit `81778b46` 에서 닫아 follow-up task 0.
- **후속 slice 5b**: `DashboardView` 에서 기간 평가 제출 성공 시 `reload` 호출 배선(결과 표 실제 재조회).
