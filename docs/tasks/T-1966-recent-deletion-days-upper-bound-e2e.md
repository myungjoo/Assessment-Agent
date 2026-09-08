---
id: T-1966
title: recent-deletion days 상한 초과 400 e2e 계약 고정 + 거부 종수 주석 drift 정정
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 80
estimatedFiles: 1
created: 2026-09-08
independentStream: recent-deletion-input-4xx
dependsOn: [T-1965]
touchesFiles: [test/e2e/schedules-recent-deletion.e2e-spec.ts]
plannerNote: P7 T-1965 Follow-up (a)+(b) 1 파일 묶음 — filter 의 400 매핑을 실 HTTP 로 고정 + 거부 4 종→5 종 주석 drift 정정
---

# T-1966 — recent-deletion days 상한 초과 400 e2e 계약 고정 + 거부 종수 주석 drift 정정

## Why

T-1965 (PR #1541 → main `9ecc7736`) 가 `RecentDeletionInputExceptionFilter` 를 신설해 `days > 366` 의 `RangeError` 를 500 대신 **400** 으로 매핑하고 controller 에 `@UseFilters` 로 배선했다. 그러나 검증 축은 **unit (filter spec + controller metadata spec)** 뿐이라, 배선이 풀리거나 filter 등록 순서가 바뀌어 다시 500 으로 새는 회귀를 잡을 **실 HTTP 왕복 계약이 없다**. 본 task 는 T-1965 `Follow-ups (a)` 를 닫아 그 축을 `test/e2e/schedules-recent-deletion.e2e-spec.ts` 에 고정한다.

같은 파일의 `206 행` 주석은 "ValidationPipe 거부 **4 종**" 이라 적혀 있으나 `208~230 행` 의 `invalidPayloads` table 원소는 **5 개** 다 (T-1963 executor 가 남긴 drift, T-1965 `Follow-ups (b)`). 신규 케이스가 같은 400 이면서 **다른 layer** (pipe 가 아니라 filter) 라 주석을 손대는 김에 함께 정정한다 — (a)(b) 는 같은 1 파일이라 별도 slice 로 쪼개면 고정비만 2 배가 된다 (PLAN `182 행` 취지).

**issue-still-relevant pre-check (origin/main `a4d617bf` 실측)** — ① `git grep -n "days: 400\|366" origin/main -- test/e2e/schedules-recent-deletion.e2e-spec.ts` **0 hit** (상한 축 e2e 미존재), ② `git grep -n "UseFilters" origin/main -- src/scheduling/recent-deletion.controller.ts` → `107 행` 에 `@UseFilters(RecentDeletionInputExceptionFilter)` **배선 확인** (선행 T-1965 머지 완료 = `dependsOn` 해소), ③ 같은 파일 `206 행` 의 "4 종" ↔ table 5 원소 **drift 잔존**, ④ `docs/tasks/` 최대 ID 는 T-1965 이므로 `T-1966` 미사용. 즉 이미 main 에 안착한 일이 아니다.

오너 게이트 판정 — PLAN `157 행` (k6 · `test/load` 무접촉) · `158 행` (`test/perf` 무접촉 · per-route perf baseline slice 아님, 본 task 는 latency 아닌 HTTP status 계약) · `182 행` 소비처 동반 의무 (신설 helper 0 — 오히려 T-1965 filter 의 **실 소비 경로 검증**) · `183 행` AdminView 부채 (`web/` 무접촉) 전부 미침범.

## Required Reading

- `test/e2e/schedules-recent-deletion.e2e-spec.ts` `1~20 행` — 파일 책임 경계 (HTTP 계약만) + no-network 전략 (ADR-0031 §3/§5) + 실 DB 전략 (ADR-0004). 신규 케이스도 adapter 도달 전 종료라 mock override 도입 0.
- 같은 파일 `27~30 행` (`createAuthenticatedE2EApp` · `buildAuthCookie` · `truncateAll` import) · `44~52 행` (`recentDeletionUrl` · `inWindowInstant` helper) · `63~101 행` (`beforeAll` 부트스트랩 · `adminCookie` · `afterEach(truncateAll)` · `seedPerson`). **각 it 는 자기 안에서 `seedPerson()` 을 호출한다** — `afterEach` 가 전부 truncate 하므로 케이스 간 seed 공유 금지.
- 같은 파일 `102~145 행` — 202 happy 2 종 (기본 days · `days: 7` 명시) 의 assert 축 (`RecentDeletionRunResult` 3 key · `recollected` · Assessment 계수). 경계 202 케이스가 mirror 할 형태.
- 같은 파일 `206~245 행` — 주석 drift 지점 (`206 행`) + `invalidPayloads` table (`208~230 행`, 5 원소) + `it.each` 본문 (`232~245 행`). 신규 filter 축 케이스를 **table 에 넣지 말고** 이 블록 뒤에 별도 `it` 로 둔다.
- 같은 파일 `147~172 행` — 404 raw forward + 401 케이스. filter 의 `HttpException` passthrough 가 실 HTTP 에서도 유지됨을 보이는 기존 축 (수정 0, 회귀 확인 대상).
- `src/scheduling/recent-deletion-input-exception.filter.ts` `31~42 행` — `RECENT_DELETION_INPUT_GUIDE` prefix 문자열 + `buildBadRequestMessage` 의 `안내: 원문` 결합 규칙 (e2e 의 body message assert 근거) · `44~63 행` — 4 분기 우선순위.
- `src/scheduling/recent-deletion-window.ts` `20~38 행` — `MAX_DAYS = 366` + `assertValidDays` 의 상한 분기 `RangeError` message 원문 (400 body 에 결합되는 문자열).
- `src/scheduling/recent-deletion.controller.ts` `99~110 행` — `@UseFilters` 배선 지점. 이 줄이 사라지면 본 e2e 가 red 여야 한다.

## Acceptance Criteria

변경은 `test/e2e/schedules-recent-deletion.e2e-spec.ts` **1 파일** 뿐이다 (`src/` 무접촉).

- [ ] **happy-path 1+ (filter 축 신규)** — Admin 쿠키 + in-window instant 1 건 + `days: 400` 요청 시 **400** 응답 + body message 에 안내 prefix (`recent-deletion-input-exception.filter.ts` `31~33 행`) 와 `assertValidDays` 상한 원문 (`366`) 이 **함께** 포함 + `prisma.assessment.count()` 가 0 (재수집 미발화). 500 이 아님을 status 로 직접 단언한다.
- [ ] **error path 1+** — 상한 축과 다른 `RangeError` 분기가 pipe 에 먼저 걸리는 축과 구별되도록, 기존 404 케이스 (`149 행`) 가 여전히 **404 그대로** 임을 회귀로 확인한다 (filter 의 `HttpException` passthrough 가 실 HTTP 에서 4xx 를 400 으로 덮지 않음). 기존 it 본문 수정 0 — `pnpm test:e2e` 통과로 확인.
- [ ] **분기별 1+** — 같은 400 이지만 layer 가 다른 두 분기를 각각 고정: (1) ValidationPipe 거부 (기존 `it.each` 5 종, 수정 0) (2) filter 매핑 (`days: 400` 신규). 신규 케이스의 assert 에 안내 prefix 포함 여부를 넣어 **pipe 400 과 filter 400 이 서로 다른 body** 임을 구별한다.
- [ ] **negative — 예외 분기마다 1+** : ① **경계 통과** — `days: 366` (상한 정확히) + in-window instant 시 **202** + `recollected` true (filter 가 정상 요청을 400 으로 downgrade 하지 않음) ② **RBAC 우선순위** — User role 쿠키 + `days: 400` 시 **403** (guard 가 filter 보다 먼저 — 입력 결함이 tier 미달을 가리지 않음) + Assessment 0. ③ 신규 케이스 어느 것도 응답 body 에 stack trace · 내부 경로를 노출하지 않음을 단언.
- [ ] **주석 drift 정정** — `206 행` 의 "ValidationPipe 거부 4 종" 을 실제 table 원소 수 **5 종** 으로 정정하고, 신규 filter 축 케이스가 **pipe 가 아닌 controller filter layer** 의 400 임을 1 줄로 구분 명시한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 (unit 회귀 0).
- [ ] `pnpm test:e2e` 가 CI (R-113 e2e leg) 에서 green — 로컬 `DATABASE_URL` 부재 시 CI 결과로 확인하고 로컬 skip 을 통과로 오인하지 않는다.
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`).

## Out of Scope

- `src/` 전체 무접촉 — filter · controller · DTO · `recent-deletion-window.ts` 의 로직 · message · 시그니처 변경 0. 본 task 는 **기존 동작의 계약 고정** 이다.
- `RecentDeletionDto` 에 `@Max(366)` 등 상한 decorator 추가 금지 (T-1965 Out of Scope 승계 — 상한 single source 는 `assertValidDays`). e2e 가 pipe 400 을 기대하도록 바꾸지 않는다.
- 공용 입력 결함 filter 추출 (T-1965 `Follow-ups (c)`) 금지 — 소비처 2 개로 조건 미충족.
- `docs/requirements.md` 의 REQ-041 재판정 금지 — CLAUDE.md §3.1 규칙 6 (구현 arc 당 REQ 1 회) 에 따라 T-1964 가 이미 수행했다.
- `test/perf/` · `test/load/` · `web/` · 다른 e2e 파일 무접촉 (PLAN `157`·`158`·`183 행`).
- 기존 `it.each` table 원소 추가 · 기존 케이스 assert 변경 금지 (drift 정정 주석 1 줄 제외).

## Suggested Sub-agents

`implementer → tester` (ADR 불요 — 기존 ACCEPTED 동작의 e2e 고정. 실질 작업은 tester 주도).

## Follow-ups
