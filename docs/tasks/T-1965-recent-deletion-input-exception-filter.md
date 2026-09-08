---
id: T-1965
title: recent-deletion endpoint 입력 결함 500 → 400 매핑 filter 신설
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-09-08
independentStream: recent-deletion-input-4xx
dependsOn: []
touchesFiles: [src/scheduling/recent-deletion-input-exception.filter.ts, src/scheduling/recent-deletion-input-exception.filter.spec.ts, src/scheduling/recent-deletion.controller.ts, src/scheduling/recent-deletion.controller.spec.ts]
plannerNote: P7 T-1963 Follow-up ① — days>366 RangeError 가 500 으로 새는 현행 동작을 T-1328 filter 패턴 1:1 mirror 로 400 매핑
---

# T-1965 — recent-deletion endpoint 입력 결함 500 → 400 매핑 filter 신설

## Why

T-1963 (PR #1540 → main `3587309e`) 이 `POST /api/schedules/recent-deletion/:personId` 의 e2e 계약을 고정하면서 남긴 Follow-up ① — **`days > 366` 요청의 현행 동작 적절성 판정** — 을 닫는다. 판정 결과는 "현행 동작은 결함" 이다. 근거는 코드 실측이다: `RecentDeletionDto` 의 `days` 는 `@IsOptional + @IsInt + @IsPositive` 만 걸고 상한 검증을 `buildRecentDeletionWindow` 의 `assertValidDays` 에 위임한다 (`src/scheduling/dto/recent-deletion.dto.ts` `50~57 행` 의 명시적 책임 경계). 그래서 `days: 400` 은 ValidationPipe 를 통과한 뒤 `assertValidDays` 의 **`RangeError`** 로 떨어지고, controller 는 raw forward 정책이라 삼키지 않으며, NestJS default exception filter 가 이를 **500** 으로 매핑한다. 즉 "내 입력이 잘못됐다" 가 "서버가 죽었다" 로 보고되고 정상적인 입력 검증 실패가 5xx 로 집계된다.

더구나 `src/scheduling/recent-deletion.controller.ts` `27~30 행` 의 계약 주석은 이미 "`buildRecentDeletionPlan` 의 TypeError/RangeError → **400**" 이라고 **선언** 한다 — 선언과 실제 동작이 어긋나 있다. 본 task 는 그 선언을 실제로 만든다.

설계는 새 결정이 아니라 **이미 ACCEPTED 된 패턴의 1:1 mirror** 다 — `src/export/scope-input-exception.filter.ts` (T-1328, T-1305 이월 결함 회수) 가 완전히 같은 결함 형태 (helper 의 `RangeError`/`TypeError` raw propagate → default filter 500) 를 controller 경계 filter 로 400 매핑해 해결했다. 따라서 ADR 신설 0, domain layer (`recent-deletion-window.ts` / `-plan.ts` / `-runner.service.ts`) 의 throw 종류 변경 0 — HTTP 의존을 domain 에 들이지 않는다는 T-1328 의 결정을 그대로 승계한다.

**issue-still-relevant pre-check (origin/main `7f4012a1` 실측)** — ① `git grep -l "ExceptionFilter" origin/main -- "src/scheduling/**"` **0 hit** (scheduling 모듈에 filter 부재), ② `git grep -n "UseFilters" origin/main -- src/scheduling/recent-deletion.controller.ts` **0 hit** (controller 에 filter 미배선), ③ `docs/tasks/` 에서 `recent-deletion` 을 언급하는 task 전수 (T-0424~T-0435 · T-1196 · T-1229 · T-1963 · T-1964 등) 가 **모두 `status: DONE`**, 비-DONE 0 건, ④ `T-1965` ID 미사용. 즉 이미 main 에 안착한 일이 아니다.

오너 게이트 판정 — PLAN `157 행` (k6 · `test/load` 무접촉) · `158 행` (`test/perf` 무접촉, per-route baseline slice 아님) · `182 행` 소비처 동반 의무 (**신설 filter 의 소비처 = `RecentDeletionController` 배선을 같은 PR 에 포함** — helper 만 만드는 slice 아님) · `183 행` REQ 재판정 왕복 (`docs/requirements.md` 무접촉 — 재판정 필요 시 머지 후 별도 direct 1 회) 전부 미침범.

## Required Reading

- `src/export/scope-input-exception.filter.ts` `1~64 행` — 1:1 mirror 할 정본. 헤더 주석의 **4 분기 우선순위** (①HttpException passthrough ②RangeError→400 ③TypeError→400 ④unknown→500) · `buildBadRequestMessage` 의 빈 message 방어 · `@Catch()` + `toHttpException` 분리 (분기 단위 테스트 용이) 구조를 그대로 따른다.
- `src/export/scope-input-exception.filter.spec.ts` `47~164 행` — 신규 colocated spec 이 mirror 할 케이스 축 (happy RangeError / error TypeError / unknown 500 / subclass 경계 / message 비문자열 · 빈 문자열 negative).
- `src/export/export.controller.spec.ts` `2351~2385 행` — `@UseFilters` 배선을 metadata 로 검증하는 assertion 패턴 (필터 클래스가 handler metadata 에 부착됐는지 + 무관 handler 에는 미부착).
- `src/scheduling/recent-deletion.controller.ts` `27~30 행` (raw forward 계약 주석 — 본 task 가 "400 매핑은 filter 가 담당" 으로 정정) + `96~111 행` (`@Post` · `@HttpCode(202)` · guard · handler 시그니처 — `@UseFilters` 부착 지점).
- `src/scheduling/recent-deletion-window.ts` `26~38 행` — `assertValidDays` 의 2 분기 (`!Number.isInteger || <= 0` / `> MAX_DAYS(366)`) 가 던지는 `RangeError` message 형태 (400 body 에 결합될 원문).
- `src/scheduling/recent-deletion-plan.ts` `39~50 행` — `TypeError` 발생 축 (instants 비-배열 / 원소 Invalid Date) 이 **호출자 입력 결함** 이라는 근거.
- `src/scheduling/recent-deletion.controller.spec.ts` — 기존 unit spec (수정 대상). 기존 케이스 회귀 없이 배선 검증 it 만 추가한다.

## Acceptance Criteria

신규 파일은 `src/scheduling/recent-deletion-input-exception.filter.ts` + 그 colocated spec `src/scheduling/recent-deletion-input-exception.filter.spec.ts` **2 개** 뿐이고, 수정은 `src/scheduling/recent-deletion.controller.ts` · `src/scheduling/recent-deletion.controller.spec.ts` **2 개** 뿐이다 (총 4 파일).

- [ ] **filter 신설** — `RecentDeletionInputExceptionFilter` 를 `src/scheduling/recent-deletion-input-exception.filter.ts` 에 `@Catch()` + `implements ExceptionFilter` 로 신설하고, 분기 판정은 `toHttpException(exception: unknown): HttpException` private 메서드로 분리한다 (`ScopeInputExceptionFilter` 구조 mirror). 400 message 는 한국어 안내 prefix + 원 `error.message` 결합, secret · stack trace 미포함.
- [ ] **소비처 배선 (같은 PR)** — `RecentDeletionController` 의 `recentDeletion` 핸들러에 `@UseFilters(RecentDeletionInputExceptionFilter)` 를 부착하고, `27~30 행` 주석의 "TypeError/RangeError → 400" 서술을 "본 filter 가 매핑" 으로 정정한다 (선언 ↔ 실제 동작 일치).
- [ ] **happy-path unit test 1+** — `RangeError` (`assertValidDays` 의 `days 상한(366일=1년) 초과` message) → **400** + 한국어 안내 + 원 message 결합 검증.
- [ ] **error path unit test 1+** — unknown `Error` (예: DB 연결 실패) → **500** 보존 (4xx 오분류 0, swallow 0).
- [ ] **분기별 test** — 4 분기 각각 1+ : (1) `HttpException` passthrough (`NotFoundException` 404 가 status · body 그대로 유지되어 T-1963 e2e 의 404 raw forward 계약이 깨지지 않음) (2) `RangeError` → 400 (3) `TypeError` (instants 원소 Invalid Date) → 400 (4) unknown → 500.
- [ ] **negative test — 예외 분기마다 1+** : ① `RangeError` subclass 도 400 유지 + 응답 body 에 내부 구조 노출 0 ② `message` 가 문자열이 아닌 error → 안내 문구만 남고 throw 0 ③ `message` 가 빈 문자열 → 빈 꼬리 (`: ` · 빈 괄호) 0 ④ `days <= 0` / 비-정수 축의 `RangeError` (상한 축과 다른 message) 도 400 ⑤ `ForbiddenException` (403) passthrough 로 RBAC 결과가 400 으로 downgrade 되지 않음.
- [ ] **controller 배선 검증 test 1+** — `recent-deletion.controller.spec.ts` 에 handler metadata 에 `RecentDeletionInputExceptionFilter` 가 부착됐음을 검증하는 it 추가 (`export.controller.spec.ts` `2351~2385 행` 패턴). 기존 케이스 수정 0 · 회귀 0.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 (기존 480 suite 회귀 0).
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`).

## Out of Scope

- `RecentDeletionDto` 에 `@Max(366)` 등 상한 decorator 추가 **금지** — DTO `50~57 행` 이 명시한 책임 경계 (상한은 `assertValidDays` 단일 source) 를 유지한다. 중복 검증은 두 곳이 어긋날 여지를 만든다.
- `recent-deletion-window.ts` / `-plan.ts` / `-runner.service.ts` 의 throw 종류 · message · 시그니처 변경 0 (domain layer 에 HTTP 의존 유입 금지 — T-1328 결정 승계).
- `src/export/scope-input-exception.filter.ts` 재사용 · 공용 filter 추출 리팩터 금지 — 안내 문구가 도메인별로 다르고 cross-module import 결합을 만든다. 공용화는 3 번째 소비처가 생길 때 재검토 (Follow-ups).
- `test/e2e/schedules-recent-deletion.e2e-spec.ts` 무접촉 — HTTP 계약 축 추가는 Follow-ups 의 별도 slice (본 PR cap 보존).
- `docs/requirements.md` · `docs/architecture/api.md` doc-sync 무접촉 — PLAN `183 행` once-rule 에 따라 머지 후 필요 시 1 회.
- 다른 scheduling controller (`CronScheduleController` · `BackfillController`) 로 filter 확대 적용 금지 — 본 task 는 recent-deletion 1 개 handler 한정.
- 전역 `useGlobalFilters` 도입 금지 (blast radius 가 task 범위를 넘는다).

## Suggested Sub-agents

`implementer → tester` (ADR 불요 — T-1328 의 ACCEPTED 패턴 1:1 mirror 라 새 아키텍처 결정 0).

## Follow-ups

- (a) `test/e2e/schedules-recent-deletion.e2e-spec.ts` 에 `days: 400` → **400** HTTP 계약 케이스 추가 (본 PR 의 unit 축을 실 HTTP 로 확인).
- (b) 같은 파일 `206 행` 주석의 drift — "ValidationPipe 거부 4 종" 이라 적혀 있으나 실제 `invalidPayloads` table 은 **5 종** (T-1963 executor nit). (a) 와 한 slice 로 묶으면 1 파일 소규모 PR.
- (c) 입력 결함 400 매핑 filter 가 3 번째 소비처를 얻으면 공용 filter 추출 재검토 (현재 2 개 — export · scheduling).
