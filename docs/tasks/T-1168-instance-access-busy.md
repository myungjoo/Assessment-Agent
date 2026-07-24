---
id: T-1168
title: 인스턴스 접근 폼 교차 비활성 파생을 순수 helper 로 분리 + 단위 test
phase: P6
status: DONE
commitMode: pr
prNumber: 1060
reviewRounds: 1
mergedAs: 8feffda5
completedAt: 2026-07-24T03:57:00Z
coversReq: [REQ-016, REQ-044]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1167]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 사용자 관리 arc 11번째 slice — T-1167 reviewer follow-up (1) 교차 비활성 파생 helper 추출
---

# T-1168 — 인스턴스 접근 폼 교차 비활성 파생을 순수 helper 로 분리 + 단위 test

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 11번째 slice 이며, T-1167 reviewer 가 남긴 Follow-up 후보 (1) 을 그대로 집행한다. T-1167 이 도입한 부여/회수 교차 비활성 파생 (`instanceAccessBusy = grantingInstanceAccess || revokingInstanceAccess` 과 두 버튼의 `busy || !userId || !instanceRef.trim()`) 은 **컨테이너 본문 안 인라인 식**이라, 현 spec harness 가 [ADR-0040](../decisions/ADR-0040-frontend-test-harness.md) §5 게이트로 jsdom/RTL 을 쓰지 않는 제약 하에서는 **상태 구동 렌더로 검증할 방법이 없다** — 즉 이 파생이 잘못 바뀌어도 (예: `||` → `&&`, trim 누락, 한쪽 진행 플래그 누락) 어떤 test 도 fail 하지 않는다. 실제 결과는 부여 발사 중에 회수 버튼이 살아 있어 같은 사용자에게 두 방향 mutation 이 동시에 나가는 표면이다.

본 task 는 그 파생을 **인자만 받는 순수 helper 1개**로 뽑아 진리표 전량을 단위 test 로 고정하고, 컨테이너가 그 helper 결과를 실제로 쓰는지 소스 문자열 drift guard (T-1165 선례) 로 못박는다. 동작 변경은 0 — 현 disabled 조건과 **완전히 동일한 진리값**을 유지하는 리팩터다.

## Required Reading

- `web/src/views/AdminView.tsx` 3697~3700행 — 현 `instanceAccessBusy` 파생과 그 한국어 주석(교차 발사 이중 방어 근거). 본 task 가 대체할 대상이다.
- `web/src/views/AdminView.tsx` 4341~4381행 grant/revoke 폼 markup — `disabled={instanceAccessBusy}` (select · input) 와 `disabled={instanceAccessBusy || !instanceAccessUserId || !instanceRefInput.trim()}` (부여 버튼 · 회수 버튼) 4개 call site. 이 4곳이 helper 결과를 쓰도록 바꾼다.
- `web/src/views/AdminView.tsx` 1891~1908행 `createInFlightIdGate` — **순수 helper 추출 + 결함 근거를 (a)/(b) 주석으로 박제하는 convention 원본**. 본 helper 의 주석도 같은 형식(왜 인라인 식이 위험한가 / 왜 helper 여야 하는가)을 따른다.
- `web/src/views/AdminView.tsx` 1685~1719행 `runCreateUser` 꼬리 + `buildInstanceAccessPath` — 컨테이너 밖 module-scope 함수들이 놓이는 위치·주석 톤. 새 helper 도 이 구역(인스턴스 접근 러너 근처)에 둔다.
- `web/src/views/AdminView.tsx` 4706~4759행 test-only `export { ... }` 목록 — 새 helper 를 여기에 추가해야 spec 이 import 할 수 있다.
- `web/src/views/AdminView.test.tsx` 8949~8985행 `describe('AdminView — 역할 변경 가드 컨테이너 배선 drift guard (T-1165)')` — `readFileSync` 로 `AdminView.tsx` 소스를 읽어 배선 문자열을 단언하는 **drift guard convention 원본**. 본 task 의 guard 도 이 형식을 따른다(새 helper 추가 금지 — 같은 `readFileSync` 패턴 재사용).
- `web/src/views/AdminView.test.tsx` 9150행~ `describe('AdminView — 인스턴스 접근 권한 회수 실 DELETE mutation (T-1167 runRevokeInstanceAccess)')` 의 `makeDeps` harness — 신규 describe 는 이 convention(러너/helper 직접 호출 + mock deps, RTL 없음, 초기 렌더 단언은 `renderToStaticMarkup`)을 그대로 따른다.

## Acceptance Criteria

- [ ] 순수 helper 1개를 module scope 에 추가한다. 계약: 인자 `{ granting: boolean; revoking: boolean; userId: string; instanceRef: string }` → 반환 `{ busy: boolean; actionDisabled: boolean }`. `busy = granting || revoking`, `actionDisabled = busy || userId 가 빈 값 || instanceRef.trim() 이 빈 값`. React import·state·부수효과 0(같은 인자면 항상 같은 결과).
- [ ] helper 위에 한국어 주석으로 (a) 인라인 파생이었을 때의 결함(교차 발사 창 — 부여 진행 중 회수 버튼이 살아 있으면 같은 사용자에 두 방향 mutation 동시 발사) 과 (b) helper 로 뽑는 이유(ADR-0040 §5 로 상태 구동 렌더 test 가 불가하므로 파생만 떼어 진리표로 고정) 를 `createInFlightIdGate` 형식으로 박제한다.
- [ ] 컨테이너의 `instanceAccessBusy` 인라인 파생을 helper 호출로 교체하고, markup 의 4개 call site (select · input · 부여 버튼 · 회수 버튼) 가 helper 결과(`busy` / `actionDisabled`) 를 쓰도록 바꾼다. **인라인 `||` 식이 markup 에 남아 있으면 안 된다.**
- [ ] 진리값 동등성 — 교체 전후 disabled 결과가 모든 입력 조합에서 동일해야 한다. 특히 (a) select · input 은 `busy` 만 보고 사용자 선택/입력 여부는 보지 않는다, (b) 두 버튼은 동일한 `actionDisabled` 를 공유한다(비활성 조건 분화 금지).
- [ ] 새 helper 를 test-only `export { ... }` 목록에 추가한다.
- [ ] happy-path unit test 1+ — 진행 0 + 사용자 선택됨 + 주소 입력됨이면 `{ busy: false, actionDisabled: false }` 를 반환한다.
- [ ] error path / 방어 경로 unit test 1+ — `granting` true, `revoking` true, **둘 다 true** 각각에서 `busy` 와 `actionDisabled` 가 모두 true 다(한쪽 진행이 반대 방향 버튼까지 잠근다는 교차 방어 계약).
- [ ] 분기 cover — `busy` 2 분기(진행 있음/없음) × `actionDisabled` 의 3 원인(busy / 빈 userId / 빈 instanceRef) 각 1+ test. 진리표는 `it.each` 표 1개로 합쳐도 되나 **기대값을 표에 명시**해야 한다(계산식 재구현 금지 — 그러면 guard 가 되지 않는다).
- [ ] negative cases 충분 cover — 각 1+ test: (a) 공백만(`'   '`) 인 instanceRef 는 `actionDisabled` true(trim 계약), (b) 공백 padding 이 있어도 실 내용이 있으면 false, (c) 빈 userId + 유효 instanceRef 조합은 true, (d) 유효 userId + 빈 instanceRef 조합은 true, (e) 진행 중이면 userId·instanceRef 가 모두 유효해도 true(진행 우선), (f) 인자 객체를 helper 가 변형하지 않는다(호출 후 인자 필드 값 불변 — 순수성).
- [ ] drift guard test 2+ (T-1165 convention, `readFileSync` 로 `AdminView.tsx` 소스 단언) — (a) markup 의 부여·회수 버튼 `disabled` 가 helper 파생 값을 참조한다(인라인 `!instanceAccessUserId ||` 형태의 조건식이 markup 에 없다), (b) 컨테이너가 helper 를 호출해 두 값을 얻는다. 배선을 되돌리면 이 guard 가 fail 해야 한다 — 구현자는 실제로 되돌려 fail 을 1회 확인하고 되돌린다.
- [ ] 초기 렌더 회귀 test 1+ (`renderToStaticMarkup`) — Admin 렌더에서 `aria-label="접근 권한을 부여할 사용자"` select · `aria-label="부여할 인스턴스 주소"` input · `인스턴스 접근 권한 부여` · `인스턴스 접근 권한 회수` 버튼 4개가 그대로 존재하고, 비-Admin 렌더에서는 모두 미노출(fail-closed) 이다.
- [ ] `aria-label` 문자열 3종과 버튼 라벨 2종은 **한 글자도 바꾸지 않는다** — T-1166/T-1167 test 의 selector 다.
- [ ] 기존 T-1159 / T-1160 / T-1162 / T-1164 / T-1165 / T-1166 / T-1167 describe 의 assertion 을 **하나도 삭제·약화하지 않는다** — 전부 그대로 통과해야 한다.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 50 LOC, `AdminView.test.tsx` ≤ 150 LOC. 초과 예상 시 (1) 주석을 선례 참조 한 줄로 압축하고 (2) 진리표를 `it.each` 로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- **web↔backend 계약 drift-guard spec** (REVOKE path / method / `instanceRef` DTO 필드명 literal 을 backend 소스와 대조) — T-1167 reviewer Follow-up 후보 (2). 별도 slice 로 남긴다(교차 패키지 소스 읽기라는 새 패턴 도입이라 본 refactor 와 섞으면 회귀 표면·diff 가 함께 커진다). Follow-ups 에 박제.
- `createInFlightIdGate`(T-1165) ref 패턴을 grant/revoke 로 확산 — 여전히 별도 sweep task.
- 역할 변경 / 사용자 생성 / `UserList` 쪽 비활성 파생 통합 — 본 slice 는 인스턴스 접근 폼 한 곳만.
- jsdom / RTL 도입으로 상태 구동 렌더 test 를 가능하게 만들기 — 새 외부 dependency 라 CLAUDE.md §5 게이트 대상(ADR-0040 §5 도 현 harness 경계를 박제). 본 task 는 그 제약 **안에서의** 우회다.
- 부여·회수 러너(`runGrantInstanceAccess` / `runRevokeInstanceAccess`) 본문 수정 — 파생만 뽑고 mutation 계약은 건드리지 않는다.
- 인스턴스 접근 권한 **목록 표시** · 확인 다이얼로그 · 라벨 문구 일반화 — 각각 backend GET endpoint 부재 / UX 확장 / selector 파손 사유로 제외.
- `web/src/components/*` · `web/src/api/*` 수정 — 파일 수 cap 과 계약 경계.
- backend (`src/`) · prisma schema · `deploy/daily-test.sh` · smoke drift-guard spec (T-0791/T-0944/T-0947) · `docs/architecture/*` 수정.
- `web/package.json` 의 vitest coverage threshold 도입 — `@vitest/coverage-v8` 새 외부 dependency (PLAN P6 게이트된 backlog).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 박제) web↔backend 계약 drift-guard spec — web 이 하드코딩한 `/api/users/:id/instance-access` path shape · `DELETE` method · `instanceRef` body 필드명이 backend `src/user-instance-access/user-instance-access.controller.ts` / `GrantInstanceAccessDto` 와 어긋나면 fail 하는 guard. 다음 slice 후보.
