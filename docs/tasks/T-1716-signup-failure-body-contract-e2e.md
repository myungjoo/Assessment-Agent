---
id: T-1716
title: signup 실패 응답 body 의 축별 사유 계약을 e2e 로 고정
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-068, REQ-069]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-08-26
completedAt: 2026-08-26T10:10:27Z
independentStream: account-creation-ux
dependsOn: [T-1712, T-1714, T-1715]
touchesFiles:
  - test/e2e/signup-failure-contract.e2e-spec.ts
plannerNote: P6 오너 지시(PLAN 129 행 🔴) 분해 slice 7 — REQ-068/069 의 verify 축 'e2e' 를 backend 응답 body 계약으로 실제 충족.
---

# T-1716 — signup 실패 응답 body 의 축별 사유 계약을 e2e 로 고정

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `129 행` 🔴(계정 생성 UX)의 분해 slice 7 이다. slice 1~6 이 화면 두 곳의 표시 축을 끝냈지만(T-1710/T-1711 사전 안내, T-1712 분류 helper, T-1713 계약, T-1714 셋업 화면, T-1715 사용자 추가 화면), 그 표시가 **backend 가 실제로 내려주는 문자열에 전적으로 의존**한다 — [signupError.ts](../../web/src/api/signupError.ts) `28~33 행` `MESSAGE_MAP` 의 key 는 `POST /api/users` 의 class-validator 문구 원문(`'email must be an email'` 등)이다. backend DTO 의 decorator 나 문구가 바뀌면 web 은 조용히 fallback 문구로 퇴화하고 REQ-068(구체 사유) 회귀를 **아무 test 도 잡지 못한다**.

현재 [users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) `369~414 행` 의 signup 실패 it 3 개는 `expect(response.status).toBe(400|409)` **status 만** 단언하고 body 는 보지 않는다. 본 slice 는 응답 body 의 축별 사유 계약(400 의 `message` 배열 문자열 · 409 의 중복 축 분리)을 e2e 로 고정해 [requirements.md](../requirements.md) `87~88 행` REQ-068 / REQ-069 의 verify 컬럼 `unit + e2e` 중 **e2e 축을 실제로 충족**시킨다. 코드 동작 변경 0 — 신규 spec 파일 1 개만 추가한다.

## Required Reading

- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — `33~48 행` import 블록(`supertest` · `createAuthenticatedE2EApp` · `issueAccessTokenFor` · `truncateAll` · `createE2EApp`), `301~414 행` `describe("E2E: POST /api/users signup …")` 의 setup/teardown 관용구(`createAuthenticatedE2EApp([...])` → `try` → `finally` 에서 `truncateAll` + `app.close()` + `prisma.$disconnect()`). 본 spec 이 그대로 mirror 할 선례다. **이 파일은 수정하지 않는다.**
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) `41~61 행` — `PASSWORD_MIN_LENGTH = 8`, `email` 의 `@IsEmail` + `@IsNotEmpty`, `password` 의 `@IsString` + `@IsNotEmpty` + `@MinLength(8)`. 기대 문자열의 정본.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) `96~102 행` — controller-scope `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`(미정의 필드 400 의 근거), `140~160 행` `@Post()` signup(201 · service 의 P2002 → `ConflictException` → 409 자동 mapping).
- [src/user/user.service.ts](../../src/user/user.service.ts) `240~260 행` — `signup` 의 P2002 → `throw new ConflictException(\`email already exists: ...\`)` (409 body 의 `message` 가 **문자열 1 개**라는 계약의 근거).
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) `28~33 행` `MESSAGE_MAP` · `68~90 행` `classifySignupFailure` — 본 spec 이 drift guard 로 대조할 소비 측 매핑표.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp(seed[])` 시그니처와 반환 `{ app, prisma }`.
- [docs/requirements.md](../requirements.md) `87~88 행` — REQ-068 / REQ-069 원문과 verify 컬럼.

## Acceptance Criteria

- [ ] 신규 파일 [test/e2e/signup-failure-contract.e2e-spec.ts](../../test/e2e/signup-failure-contract.e2e-spec.ts) **1 개만** 추가한다. 기존 spec · `src/` · `web/` · `.github/workflows/` · `package.json` diff **0 파일**.
- [ ] 파일 상단 주석에 본 spec 의 책임 경계(“status 는 users.e2e-spec 이, 응답 **body 의 축별 사유 문자열 계약** 은 본 spec 이 담당 — 중복 아님”)와 REQ-068 / REQ-069 근거를 한국어로 남긴다.
- [ ] happy-path test 1+ — `email` 형식 위반 + `password` 8 자 미만을 **동시에** 담아 `POST /api/users` 호출 시 400 이고, body 의 `message` 가 **배열**이며 `'email must be an email'` 과 `'password must be longer than or equal to 8 characters'` **두 문자열이 각각** 들어 있다(하나로 병합되지 않는다 — REQ-068 포괄 문구 금지의 backend 측 근거).
- [ ] error path test 1+ — 이미 존재하는 email 로 재요청 시 409 이고, body 의 `message` 가 중복 사실만 담는다(형식 · 길이 어휘 `must be an email` · `longer than or equal` 이 **섞이지 않는다** — REQ-069 구분 축).
- [ ] 분기 cover — `POST /api/users` 의 실패 분기마다 test 1+: ① `email` 누락 → `'email should not be empty'` 포함 ② `password` 빈 문자열 → `'password should not be empty'` 포함 ③ `password` 가 비-문자열(숫자) → `'password must be a string'` 포함 ④ 미정의 필드(`role`) 포함 → 400 이며 `message` 배열에 해당 사유가 유실 없이 남는다(web 분류기의 `other` 축 보존 경로).
- [ ] negative cases 충분 cover(각 1+ test) — ① 400 · 409 어느 응답 body 에도 요청에 보낸 **평문 password 값**이 등장하지 않는다 ② 어느 실패 응답에도 `hashedPassword` 키가 없다 ③ 400 응답의 `message` 가 **빈 배열이 아니다**(web 의 최소 1 줄 보장이 fallback 문구로 퇴화하지 않음을 backend 쪽에서 고정) ④ 400 응답의 `statusCode` 가 400 이고 409 의 `statusCode` 가 409 다(web 이 status 만으로 축을 가르는 근거) ⑤ 정상 payload(유효 email + 8 자 이상 password)는 201 이며 실패 어휘가 전혀 없다(false-positive 방지 대조군).
- [ ] drift guard 1+ — `readFileSync('web/src/api/signupError.ts')` 로 소비 측 매핑표를 읽어, 위 test 들이 backend 응답에서 실제 관측한 문자열 **5 종**(`email must be an email` · `email should not be empty` · `password must be longer than or equal to 8 characters` · `password should not be empty` · `password must be a string`)이 전부 `MESSAGE_MAP` 의 key 로 존재함을 단언한다([realdata-devset-logins-doc-consistency.spec.ts](../../test/helpers/realdata-devset-logins-doc-consistency.spec.ts) 의 `readFileSync` 대조 선례). 한쪽만 바뀌면 본 guard 가 red 가 되어야 한다.
- [ ] 모든 it 는 기존 signup describe 의 관용구를 따른다 — `createAuthenticatedE2EApp` 로 격리 app 을 만들고 `finally` 에서 `truncateAll` + `app.close()` + `prisma.$disconnect()`. 다른 spec 의 seed 에 의존하지 않는다(실행 순서 무관).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test:cov`(line ≥ 80% / function ≥ 80%) green — 프로덕션 심볼 추가가 0 이라 coverage 수치는 무영향임을 PR 본문에 명시한다.
- [ ] `pnpm test:e2e` green(실 PostgreSQL 필요 — CI 의 postgres service 에서 검증되며, 로컬 DB 부재 시 그 사실을 PR 본문에 명시한다).

## Out of Scope

- backend DTO 문구의 한국어화 · custom `message` 옵션 추가 — 그 순간 web `MESSAGE_MAP` 5 key 를 동시에 갈아야 해 파일 수가 늘고 표시 회귀 risk 가 생긴다. 필요하면 별도 slice.
- [users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 의 기존 signup it 3 개 수정 · 이관 · 삭제 — 회귀 표면만 키운다(본 spec 은 body 축만 신설).
- `web/` 파일 일체 수정 — 본 slice 는 backend 계약 고정 전용이며 web 은 `readFileSync` 로 **읽기만** 한다.
- [requirements.md](../requirements.md) `86~88 행` REQ-067 ~ REQ-069 status 갱신 · [PLAN](../PLAN.md) `129 행` checkbox 마감 — doc-only `direct` 후속 task(본 slice 머지 후).
- smoke(`test/smoke/`) 확장 · 새 endpoint · rate limiting · 비밀번호 복잡도 정책 강화 — 오너 지시 범위 밖.
- 새 dependency 추가 — §5 새-dep 게이트 대상.

## Suggested Sub-agents

`tester`(spec-only task — 프로덕션 코드 변경이 없어 implementer 불요. tester 가 spec 작성 + `pnpm lint`/`build`/`test:cov`/`test:e2e` 실행까지 담당)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 요약

- **DONE** — PR [#1347](https://github.com/myungjoo/Assessment-Agent/pull/1347) round 1 APPROVE → squash merge `e8d22e3c` (2026-08-26T10:10:27Z).
- 신규 `test/e2e/signup-failure-contract.e2e-spec.ts` 1 파일(+300/-0)만 추가 — 프로덕션 코드 · 기존 spec · `src/` · `web/` · 워크플로 · `package.json` diff 0 파일이라 전역 coverage 무영향.
- 400 `message` 배열의 축별 문자열 · 409 중복 축 어휘 분리(REQ-069) · 평문 password 비노출 · web `MESSAGE_MAP` key 대조 drift guard 를 e2e 로 고정해 [requirements.md](../requirements.md) `87~88 행` REQ-068/069 의 verify `e2e` 축을 충족.
- R-112 4 종 cover — happy(형식+길이 동시 위반 2 문자열) · error path(409 어휘 불혼입) · 분기 4 종(email 누락 · password 빈 문자열 · 비-문자열 · 미정의 필드) · negative 5 종(평문 미노출 · hashedPassword 부재 · message 비어있지 않음 · statusCode · 201 대조군).
- 로컬 lint · build · `test:cov`(453 suite / 13009 test) green, CI PR run + 머지 후 main run 둘 다 success.
