---
id: T-0802
title: R-9 POST /period 가 요청 User.timezone 을 KST 입력 해석에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-034, REQ-031]
dependsOn: [T-0801]
independentStream: adr-0052-timezone-wiring
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
estimatedDiff: 180
estimatedFiles: 2
created: 2026-07-06
plannerNote: "P5 R-9 bullet(L98) / ADR-0052 Follow-up(3) slice3 — POST /period 가 요청 User.timezone 을 normalizeKstPeriodStart 에 배선 (R-112 backbone ×1.5)"
---

# T-0802 — R-9 POST /period 가 요청 User.timezone 을 KST 입력 해석에 배선

## Why

[ADR-0052](../decisions/ADR-0052-user-timezone-storage.md) §Decision(b)/(d) 와 §Follow-ups(3) 이
남긴 마지막 배선 slice 다: R-9 사용자 지정 기간 입력의 해석 timezone 을 **요청 User 의
`User.timezone`** 으로 적용한다. slice1(T-0799)이 `User.timezone` 컬럼을, slice2(T-0800)/
slice2b(T-0801)이 `period-boundary.ts` helper 의 `timeZone` 파라미터(기본 KST)를 이미 박제했다.
본 task 는 `AssessmentEvaluationController` 의 `POST /period` route(R-9 임의 기간 평가문 요청의
canonical endpoint, ADR-0037 slice3 / PLAN.md P5 L98)가 요청 principal 의 timezone 을
`normalizeKstPeriodStart` → `parseKstPeriodInput`/`getKstPeriodRangeByPeriod` 인자로 흘려
offset 미명시 입력이 요청 User 의 zone 으로 해석되게 배선한다(기본 KST fallback 보존).

**중요 발견** — JWT payload(`JwtPayload` = `{ sub, role }`)는 `timezone` 을 담지 않는다.
따라서 controller 가 principal `sub`(userId)로 `UserService.findById` 를 호출해 그 row 의
`timezone` 을 조회한다. `UserService` 는 `UserModule` export 이고 본 controller 의 module 이
이미 `UserModule` 을 import 중이라(assessment-evaluation.module.ts L70) **추가 module/token
배선 0** — 생성자 주입만으로 inject(PersonService 주입과 동형 패턴).

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 본 task 의 변경 대상.
  특히 `period()`(L318), `ephemeralForUser()`(L334), `persistForAdmin()`(L394),
  `normalizeKstPeriodStart()`(L259) 4 지점 + 생성자(L145) + import 구역.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — colocated spec.
  기존 `period` route mock 배선(orchestrator/ephemeralBridge/adminBridge/personService)에
  `userService` mock 을 추가하는 패턴 확인.
- `src/common/period-boundary.ts` — `parseKstPeriodInput(input, timeZone?)` /
  `getKstPeriodRangeByPeriod(period, instant, timeZone?)` 의 timeZone 파라미터(기본
  `KST_TIMEZONE`) 시그니처. `KST_TIMEZONE` export.
- `src/user/user.service.ts` — `findById(id): Promise<User>`(L183, row 부재 시
  NotFoundException). 반환 `User` 는 `timezone` 필드 보유(T-0799 additive).
- `src/auth/auth.service.ts` — `JwtPayload` = `{ sub, role, iat?, exp? }`(timezone 없음 —
  DB 조회 필요 근거).
- `docs/decisions/ADR-0052-user-timezone-storage.md` — §Decision(b)/(d) + §Follow-ups(3).

## Acceptance Criteria

- [ ] `AssessmentEvaluationController` 생성자에 `UserService`(UserModule export) 를 주입한다.
      추가 module import / provider 등록 변경 0(assessment-evaluation.module.ts 이미
      UserModule import — 무변경 확인).
- [ ] `period()` route 가 principal `actor?.sub` 로 요청 User 의 timezone 을 해석한다:
      principal `sub` 존재 시 `UserService.findById(sub)` 로 조회한 `user.timezone` 을,
      부재/비로그인 이론 경로면 `KST_TIMEZONE`(Asia/Seoul) fallback 을 사용한다.
      해석된 timezone 을 `normalizeKstPeriodStart` 로 전달한다.
- [ ] `normalizeKstPeriodStart(period, periodStart, timeZone?)` 가 `timeZone` 파라미터
      (기본 `KST_TIMEZONE`)를 받아 `parseKstPeriodInput(periodStart, timeZone)` +
      `getKstPeriodRangeByPeriod(period, ..., timeZone)` 에 전달하도록 일반화한다.
      timeZone 미지정 호출부(있다면)는 기본값으로 기존 KST 동작 100% 보존(backward-compat).
- [ ] User 분기(`ephemeralForUser`)와 Admin 분기(`persistForAdmin`) 둘 다 해석된 요청 User
      timezone 을 `normalizeKstPeriodStart` 에 배선한다. Admin 은 자기(로그인 User)의
      timezone 으로 입력을 해석한다(임의 personId target 이어도 해석 zone 은 요청 주체 기준 —
      ADR-0052 §Decision(b) "조회/요청 주체 User" 정합). self-only/재평가 fail-closed 검사
      우선순위는 불변(회귀 0).
- [ ] happy-path test — 요청 User.timezone = 비-KST zone(예 `America/New_York`)일 때 offset
      미명시 `periodStart` 입력이 그 zone 으로 해석돼 `normalizeKstPeriodStart`/bridge 위임
      인자의 instant 가 KST 해석과 달라짐을 검증(User 분기 + Admin 분기 각 1+).
- [ ] error path test — `UserService.findById` 가 reject(NotFoundException 등)하면 그 error 가
      raw 전파(swallow 0)됨을 검증. principal `sub` 부재 시 KST fallback 으로 진행함을 검증.
- [ ] flow / branch coverage — (a) 요청 User.timezone 이 KST 인 경우와 (b) 비-KST 인 경우,
      (c) User 분기 / (d) Admin 분기, (e) principal sub 존재 / (f) 부재(fallback) 각 분기 1+ test.
- [ ] negative cases 충분 cover — self-only 위반 User 분기가 timezone 조회보다 **먼저**
      403 으로 차단(회귀 0) / 재평가 fail-closed(비-Admin reevaluate:true) 가 timezone 조회
      전에 403 / User row 의 timezone 이 무효 IANA 식별자면 helper 의 RangeError 가 전파 /
      malformed `periodStart` 가 helper 의 RangeError/TypeError 로 거부 — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build` 통과.

## Out of Scope

- **`POST /evaluate` route 의 timezone 배선** — `evaluate`(L202)는 현재 `@CurrentUser()` 를
  받지 않으며 별도 slice(Follow-up)로 다룬다. 본 task 는 `POST /period` 만.
- **display / 응답 mapper 의 timezone 배선** — `formatKstIso`/`formatKstDisplay` 로 응답 시각을
  요청 User zone 으로 직렬화하는 것(unevaluated-fill-plan/run response mapper 등)은 별도
  slice(ADR-0052 §Decision(b)(ii) display 축, Follow-up).
- **timezone 설정 mutation API + 무효 tz 입력 검증(저장 경로)** — ADR-0052 §Out of scope.
  본 task 는 저장된 timezone 을 읽어 배선만. 무효 tz 는 helper 의 RangeError 전파로 방어(negative test).
- **Person.timezone 도입 / 요약·평가 경계 timezone 차등** — ADR-0052 §Decision(c) NON-goal(KST 고정).
- **module import / provider 등록 변경** — UserModule 이미 import 중, 생성자 주입만.
- **e2e / smoke HTTP 통합 spec** — colocated controller unit 까지. e2e 는 후속.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
