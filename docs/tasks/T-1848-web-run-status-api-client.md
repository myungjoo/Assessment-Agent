---
id: T-1848
title: web run-status 조회 helper 신설 (실패를 active=false 로 안전 흡수)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-083]
independentStream: run-status-web
dependsOn: [T-1846, T-1847]
touchesFiles:
  - web/src/api/runStatus.ts
  - web/src/api/runStatus.test.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-09-02
plannerNote: P6 PLAN 133 행 ④ / ADR-0060 §Follow-ups (e) 의 (e1) — helper+spec. (e2) AppShell 배선까지 합치면 약 395 LOC 로 cap 초과라 분할.
---

# T-1848 — web run-status 조회 helper 신설 (실패를 active=false 로 안전 흡수)

## Why

[PLAN.md](../PLAN.md) `133 행` 오너 지시 (R-187~R-191) 의 잔여 ④ "R-78 평가 진행 배너 자동 polling" 을 닫는 chain 의 web 축 첫 조각이다.
[ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` chain 은 (a) → (b) → (d) → (e) → (f) 순서이고 (a)(a2)(b)(c)(d) 가 모두 머지돼 backend 는 완결됐다 — `GET /api/run-status` 가 실제로 서빙되고 (T-1846) 실 HTTP 계약도 e2e 로 고정됐다 (T-1847). 남은 것은 (e) web polling 배선이며 본 slice 는 그 중 **조회 client 계층** 이다.

**issue-still-relevant pre-check 실측 (origin/main `11e02b08`)**: `git ls-tree -r origin/main` 에 `web/src/api/runStatus.ts` 매칭 0, `git grep -n -i "runStatus" -- web/src` 매칭 0, `web/src/AppShell.tsx` `263 행` 은 여전히 `const [evaluationInProgress] = useState<boolean>(false)` 로 setter 조차 없는 고정 false 다. 즉 중복 큐잉도 부분 안착도 아닌 **미착수** 이며, 배너는 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Consequences (a)` 가 미리 박제한 대로 아직 렌더 0 이다 ("배너가 조용함" 을 "평가가 안 돌고 있음" 으로 오독하면 안 된다).

**소비처 동반 의무 ([CLAUDE.md](../../CLAUDE.md) `§3`) 의 수치 예외 근거**: (e) 를 한 task 로 묶으면 ① `web/src/api/runStatus.ts` 약 55 LOC ② `web/src/api/runStatus.test.ts` 약 150 LOC ③ `web/src/AppShell.tsx` 배선 약 50 LOC ④ `web/src/AppShell.test.tsx` 갱신 약 140 LOC = **약 395 LOC / 4 파일** 로 300 LOC cap 을 명백히 넘긴다 (AppShell.test.tsx 는 이미 991 줄이고 polling 은 fake timer · 가시성 이벤트 · unmount 정리까지 test 축이 넓다). [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups (e)` 가 "cap 압박이 크면 api helper + spec 을 (e1), AppShell 배선 + spec 을 (e2) 로 쪼갠다" 고 미리 허용한 그 조건이 성립하므로 분할한다. 소비처 slice 는 아래 `Follow-ups` 에 **어느 파일의 어느 배선인지까지** 박제한다.

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) — `§Decision 2` (응답 shape · 불변식 · 항상 200) · `§Decision 3` (RBAC `User+` · 미인증 401) · `§Decision 5` (polling 5 초 · 탭 비가시 중단) · `§Follow-ups (e)`
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `10~40 행` — `RunAxisStatus` / `RunStatusSnapshot` 필드 정본 (`active` · `evaluation` · `collection` · `observedAt`)
- [src/run-status/run-status.controller.ts](../../src/run-status/run-status.controller.ts) — 경로 `api/run-status` · `@Get()` · guard stack
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `107~131 행` — `request<T>(path, options)` 계약 (credentials 동반 · 401 → refresh → 재시도 · 비-2xx 및 네트워크 실패 → `ApiError`)
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `20~30 행` · `66~85 행` — 경로 상수화 + "실패를 boolean 으로 흡수하는" 얇은 helper 선례 (`logout()`)
- [web/src/api/serviceIdentity.ts](../../web/src/api/serviceIdentity.ts) `1~40 행` — per-resource helper 파일의 헤더 주석 · 타입 선언 관례
- [web/src/api/auth.test.ts](../../web/src/api/auth.test.ts) `514~594 행` — 흡수형 helper 의 colocated spec 작성 관례 (fetch mock · ApiError 분기 · negative 나열)

## Acceptance Criteria

- [ ] `web/src/api/runStatus.ts` 신설. 다음을 export 한다.
  - [ ] 경로 상수 (예: `RUN_STATUS_PATH = '/api/run-status'`) — 문자열을 함수 안에 하드코딩하지 않는다 ([auth.ts](../../web/src/api/auth.ts) `20~24 행` 선례).
  - [ ] backend 응답과 1:1 인 타입 (예: `RunStatusSnapshotView`) — `active: boolean` · `evaluation` · `collection` · `observedAt: string`. 필드 정본은 [run-status.service.ts](../../src/run-status/run-status.service.ts) `23~40 행` 이며 **새 필드를 발명하지 않는다**.
  - [ ] 순수 판정 helper (예: `isRunActive(payload: unknown): boolean`) — 입력이 객체이고 `active === true` (엄격 비교) 일 때만 `true`. 그 밖의 모든 입력에 `false` 를 주고 **throw 하지 않는다**.
  - [ ] 조회 helper (예: `fetchRunStatus(): Promise<boolean>`) — `request(RUN_STATUS_PATH)` 를 1 회 호출하고 그 결과를 위 판정 helper 에 통과시켜 반환. **어떤 실패에서도 reject 하지 않고 `false` 로 흡수** 한다 (401 · 403 · 5xx `ApiError` · 네트워크 실패 · 파싱 불가 payload). 흡수 사유를 파일 헤더 주석에 박제한다 — 배너 polling 이 5 초마다 unhandled rejection 을 만들면 안 되고, 조회 실패는 "평가 중" 의 근거가 될 수 없다.
  - [ ] 새 외부 dependency 0 · 새 credential 0 (`apiClient` 가 cookie 를 동반하므로 helper 는 `credentials` 옵션을 직접 다루지 않는다).
- [ ] colocated spec `web/src/api/runStatus.test.ts` 신설. R-112 4 항목을 모두 cover 한다.
  - [ ] **happy-path** — `active: true` 응답에 `true`, `active: false` 응답에 `false`, 그리고 호출 경로가 정확히 `/api/run-status` 이고 호출이 1 회임을 확인 (각 1+ test).
  - [ ] **error path** — `ApiError(401)` · `ApiError(500)` · 네트워크 실패 (reject) 각각에서 **reject 하지 않고** `false` 를 반환 (각 1+ test).
  - [ ] **분기 cover** — 판정 helper 의 분기마다 test: 객체 + `active === true` / 객체 + `active === false` / 비객체 입력 / `active` 필드 부재.
  - [ ] **negative cases 충분 cover** — 최소 6 종: `null` payload · 문자열 payload · 배열 payload · `active: "true"` (문자열 truthy 를 `true` 로 오인하지 않음) · `active: 1` (숫자 truthy 동일) · `{ evaluation: { active: true } }` 처럼 최상위 `active` 없이 축만 있는 payload. 각 케이스가 throw 0 임을 함께 확인한다.
  - [ ] 부수효과 0 확인 — 조회 helper 가 `POST` 등 다른 method 나 body 를 보내지 않음 (mock 호출 인자 검사 1+ test).
- [ ] `pnpm lint && pnpm build` 통과. 저장소 unit test (`pnpm test`) green.
- [ ] `pnpm test:cov` 통과 — 전역 임계 line ≥ 80% / function ≥ 80% 유지.
- [ ] web spec 은 vitest 로 돈다 — `web/` 에서 `pnpm test` (vitest) 로 신규 spec 이 green 임을 확인하고 결과를 trail 에 남긴다.

## Out of Scope

- **`web/src/AppShell.tsx` 수정 0** — 5 초 interval · 탭 가시성 중단 · `evaluationInProgress` 배선은 전부 (e2) slice (아래 `Follow-ups`) 소관이다. 본 slice 에서 AppShell 을 건드리면 위 수치 근거로 정당화한 분할이 무의미해진다.
- **`web/src/components/EvaluationGuardBanner.tsx` 수정 0** — [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§배너 매핑` 이 "컴포넌트 수정 0" 을 명시했다. 기존 `active` prop 계약을 그대로 쓴다.
- **polling 주기 · interval · 가시성 이벤트 구현 0** — 본 파일은 "한 번 조회하는" 순수 client 다. 타이머를 helper 안에 넣지 않는다 (타이머 소유는 컴포넌트 lifecycle 책임).
- **backend 수정 0** — `src/run-status/*` · `test/e2e/*` · `prisma/schema.prisma` 무변경. schema 승격이 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier ([CLAUDE.md](../../CLAUDE.md) `§5`, ADR-0060 `§Consequences (e)`).
- **doc-sync 0** — [api.md](../architecture/api.md) 표 행 추가, [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 갱신, [requirements.md](../requirements.md) `102 행` REQ-083 재판정은 (f) slice 소관이다 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 재판정은 구현 머지 후 1 회).
- **전역 CSS 도입 0** — PLAN `133 행` 잔여 ① 은 독립 arc 다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(e2) AppShell polling 배선** — 본 helper 의 소비처. `web/src/AppShell.tsx` `263 행` 의 `const [evaluationInProgress] = useState<boolean>(false)` 를 setter 보유 state 로 바꾸고, 인증 후 view 에서만 도는 `useEffect` 에 5 초 interval + `document.visibilityState` 기반 중단/재개 (ADR-0060 `§Decision 5`) 를 붙여 `fetchRunStatus()` 결과를 그 state 에 대입한다. 그 값은 이미 `418 행` `<EvaluationGuardBanner active={evaluationInProgress} />` 로 내려가므로 **컴포넌트 파일 수정 0** 이다. spec 은 `web/src/AppShell.test.tsx` 에 fake timer 기반 describe 추가 — 주기 호출 · unmount 시 `clearInterval` · 탭 비가시 시 중단 · 실패 흡수 후 배너 미표시 · true/false 토글 분기.
- **(f) doc-sync + REQ-083 재판정** — (e2) 머지 후 1 회.
