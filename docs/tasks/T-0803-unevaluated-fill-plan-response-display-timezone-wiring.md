---
id: T-0803
title: unevaluated-fill-plan 응답의 periodStart 직렬화를 요청 User.timezone 으로 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038, REQ-043]
dependsOn: [T-0802]
independentStream: adr-0052-timezone-wiring
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts
  - src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
estimatedDiff: 170
estimatedFiles: 4
created: 2026-07-06
plannerNote: "P5 R-64 bullet(L106) / ADR-0052 §Decision(b)(ii) display 축 — T-0802 Out of Scope 가 남긴 응답 직렬화 timezone slice (R-112 backbone ×1.5)"
---

# T-0803 — unevaluated-fill-plan 응답의 periodStart 직렬화를 요청 User.timezone 으로 배선

## Why

[ADR-0052](../decisions/ADR-0052-user-timezone-storage.md) §Decision(b) 는 요청 User 의
`User.timezone` 을 **(i) 기간 입력 해석**과 **(ii) 화면 표시(display)** 두 축에 적용하도록
정한다. T-0802 가 (i) 입력 해석 축(`POST /period`)을 완결했고, 그 Out of Scope 절이 (ii)
display 축을 별도 slice(Follow-up)로 명시 deferral 했다. 본 task 는 그 display slice 중
`POST /api/assessment-evaluation/unevaluated-fill-plan` 응답의 `periodStart` 직렬화를 요청
User 의 timezone 으로 배선한다.

현재 `toUnevaluatedFillPlanResponse` 는 `formatKstIso(period.periodStart)` 를 timeZone
인자 없이 호출해 **항상 KST(+09:00)** 로 직렬화한다. T-0800/T-0801 이 `formatKstIso` 에
`timeZone` 파라미터(기본 `KST_TIMEZONE`, backward-compat)를 이미 박제했으나, 이 mapper 와
controller route 는 그 파라미터를 아직 흘리지 않는다. 본 task 는 mapper 에 optional
`timeZone` 인자를 추가하고, controller 의 `planUnevaluatedFill` route 가 T-0802 의
`resolveRequestTimeZone(actor?.sub)` 로 해석한 요청 User zone 을 그 인자로 배선해, 응답 시각이
요청 User zone 으로 직렬화되게 한다(기본 KST fallback 보존). 새 dependency·schema·credential 0.

## Required Reading

- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — 변경 대상.
  `toUnevaluatedFillPlanResponse(plan)` 이 `formatKstIso(period.periodStart)` 를 timeZone
  인자 없이 호출하는 지점(L93). optional `timeZone` 파라미터 추가 대상.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.spec.ts` — colocated spec.
  기존 happy/error/negative(null plan·Invalid Date) 케이스에 timeZone 파라미터 케이스 추가.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — `planUnevaluatedFill`
  route(L542, 현재 `@CurrentUser()` 미수신). `resolveRequestTimeZone(principalUserId)`(L369,
  기본 KST fallback) 재사용. `@CurrentUser`(L52) / `JwtPayload` / `KST_TIMEZONE`(L58) 이미 import.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — colocated spec.
  `planUnevaluatedFill` route 의 기존 mock 배선(planner mock) 확인 + `userService` mock 은
  T-0802 가 이미 추가(period route 배선). 요청 User.timezone → mapper 인자 전파 검증 패턴.
- `src/common/period-boundary.ts` — `formatKstIso(instant, timeZone = KST_TIMEZONE)`(L256) /
  `KST_TIMEZONE` export 시그니처.
- `docs/decisions/ADR-0052-user-timezone-storage.md` — §Decision(b)(ii) display 축 + §Follow-ups.
- `docs/tasks/T-0802-r9-period-timezone-wiring.md` — §Out of Scope 의 display slice 정의 +
  `resolveRequestTimeZone` 패턴.

## Acceptance Criteria

- [ ] `toUnevaluatedFillPlanResponse(plan, timeZone?)` 에 optional `timeZone`
      파라미터(기본 `KST_TIMEZONE`)를 추가하고, 내부 `formatKstIso(period.periodStart)` 호출을
      `formatKstIso(period.periodStart, timeZone)` 으로 일반화한다. timeZone 미지정 호출은
      기본값으로 기존 KST 직렬화 100% 보존(backward-compat) — 기존 caller 무변경 동작 유지.
- [ ] `planUnevaluatedFill` route 가 `@CurrentUser() actor: JwtPayload | undefined` 를 받아
      `resolveRequestTimeZone(actor?.sub)` 로 요청 User zone 을 해석하고, 그 값을
      `toUnevaluatedFillPlanResponse(plan, timeZone)` 인자로 전달한다. principal sub 부재
      이론 경로면 KST fallback(resolveRequestTimeZone 내부) 이 그대로 적용된다.
- [ ] happy-path test — 요청 User.timezone = 비-KST zone(예 `America/New_York`)일 때 응답
      `periodStart` 가 그 zone offset(예 `-04:00`/`-05:00`)으로 직렬화됨을 검증(mapper 단위 +
      controller route 단위 각 1+). timeZone = KST(또는 기본) 이면 기존 `+09:00` 유지 검증.
- [ ] error path test — `formatKstIso` 가 Invalid Date/비-Date periodStart 에 대해 던지는
      `TypeError` 가 mapper 를 통해 자연 전파됨을 검증(timeZone 인자 유무 무관). controller 에서
      `UserService.findById` reject(NotFoundException 등) 시 그 error 가 raw 전파(swallow 0)됨을 검증.
- [ ] flow / branch coverage — (a) timeZone 명시 / (b) 미지정(기본 KST), (c) 요청 User.timezone
      이 KST / (d) 비-KST, (e) principal sub 존재 / (f) 부재(fallback) 각 분기 1+ test.
- [ ] negative cases 충분 cover — (1) `plan` 이 null/undefined 면 기존 한국어 TypeError 유지
      (timeZone 인자 추가가 이 방어를 깨지 않음) / (2) 무효 IANA timeZone 식별자면 `formatKstIso`
      의 `RangeError` 가 전파 / (3) 한 period 의 periodStart 가 Invalid Date 면 TypeError 전파 /
      (4) Admin 미달/인증 부재는 기존 가드(JwtAuthGuard+RolesGuard @Roles("Admin"))가 timezone
      조회보다 먼저 401/403 차단(회귀 0) — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build` 통과.

## Out of Scope

- **`unevaluated-fill-run` 응답의 timezone 배선** — run-response mapper 의 `periodStart` 는
  이미 string(추가 직렬화 0)이라 formatKstIso 호출이 없다. 도메인 outcome 이 어느 zone 으로
  string 을 담느냐는 별도 slice(orchestrator/run-side chain, live-LLM 게이트 deferred) 소관.
- **`POST /period` / `evaluate` route 의 display 배선** — period route 입력 해석은 T-0802 가
  완결. period route 응답의 display 직렬화·evaluate route 는 별도 Follow-up slice.
- **timezone 설정 mutation API + 무효 tz 입력 검증(저장 경로)** — ADR-0052 §Out of scope.
  본 task 는 저장된 timezone 을 읽어 배선만. 무효 tz 는 helper 의 RangeError 전파로 방어(negative test).
- **Person.timezone 도입 / 요약·평가 경계 timezone 차등** — ADR-0052 §Decision(c) NON-goal(KST 고정).
- **module import / provider 등록 변경** — UserModule 이미 import 중(T-0802), 인자 배선만.
- **e2e / smoke HTTP 통합 spec** — colocated mapper/controller unit 까지. e2e 는 후속.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)

---

## Result (DONE — 2026-07-06T14:05:06Z)

PR [#717](https://github.com/myungjoo/Assessment-Agent/pull/717) squash merge `edf599ce` (round 2). reviewer APPROVE(0/0/0/0) + 4-게이트 PASS.
- **변경**: mapper `toUnevaluatedFillPlanResponse(plan, timeZone?=KST)` optional 파라미터 + `formatKstIso` 일반화, controller `planUnevaluatedFill` @CurrentUser + `resolveRequestTimeZone(actor?.sub)` 배선(sub 부재 KST fallback), backward-compat 보존. +217/-17 core.
- **round2 fix**: e2e afterEach `reseedAuthenticatedActors` 로 actor User 재-seed(신규 findById 배선의 404 회귀 해소) + 200 회귀 assertion, +35 LOC.
- unit 9015 pass, mapper 100% / controller line·func 100%. CI green(run 28797062803).
