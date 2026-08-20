---
id: T-1624
title: k6 S2 조회 부하의 인증 조회 확장 (signup → login → 인증 route 1 종 타격)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-20
createdAt: 2026-08-20T10:20:00Z
completedAt: 2026-08-20T11:54:48Z
prNumber: 1301
independentStream: load-harness-k6
dependsOn: [T-1623]
touchesFiles:
  - test/load/s2-read.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 5/N — guard-free 3 route 만 재던 S2 를 인증 route 1 종으로 확장. S1·S3·baseline 은 후속 slice.
---

# T-1624 — k6 S2 조회 부하의 인증 조회 확장

## Why

오너가 `docs/PLAN.md` `144 행` 에서 **R-91 k6 부하검증 최우선 착수**를 확정했고, chain 1/N
([T-1620](T-1620-k6-load-job-skeleton.md) workflow 골격) · 2/N
([T-1621](T-1621-load-k6-target-app-boot.md) 부하 대상 기동) · 3/N
([T-1622](T-1622-load-k6-s2-read-scenario.md) S2 조회 시나리오) · 4/N
([T-1623](T-1623-load-k6-s2-seed-wiring.md) seed 배선) 이 모두 머지됐다.

지금 S2 가 타격하는 route 는 `@UseGuards` 가 전무한 `GET /api/persons` · `/api/groups` ·
`/api/parts` **3 종뿐**이다. 그러나 계획 `§2 S2` 가 말하는 "저장된 평가 결과 조회" 의 실제 사용
경로는 **인증을 통과한 조회**이며, JwtAuthGuard + cookie 추출 + `findById` DB round-trip 이라는
**guard-free 목록 조회에는 없는 구간**을 포함한다. 본 slice 는 T-1623 의 `setup()` 에
**signup → login → access token cookie 획득** 을 덧붙이고, 그 토큰으로 **인증 route 1 종**을
한 iteration 에 추가 타격해 인증 경로의 p95 를 처음으로 측정 가능하게 만든다.

T-1623 의 Follow-up 1 은 "`POST /api/users` 가 guard 라 별도 admin 부트스트랩 필요" 라고 적었으나
이는 **사실과 다르다** — `src/user/user.controller.ts` `156 행` 의 `@Post()` signup 은 **guard-free
public endpoint** 다. 따라서 별도 부트스트랩 설계 없이 본 slice 하나로 인증 확장이 닫힌다.

## Required Reading

- `test/load/s2-read.js` (현재 `112 행`) — 본 task 의 주 변경 대상. `__ENV` 기본값 규약 ·
  `SEED_PARAMS` / `TEARDOWN_PARAMS` 의 route tag 분리 규약 · `options.thresholds` 5 종 ·
  **조건 분기 0** 규약(T-1620) 을 그대로 승계한다.
- `src/user/user.controller.ts` `139~166 행` — `POST /api/users` signup. **guard 없음(public)**,
  `@HttpCode(201)`, body 는 `AddUserDto`. 응답은 `UserResponseDto`(id / email / role / createdAt /
  updatedAt) — `hashedPassword` 미노출.
- `src/user/dto/add-user.dto.ts` — signup payload 계약: `email`(`@IsEmail`, Prisma `@unique` →
  중복 시 409) + `password`(`@MinLength(8)`). ValidationPipe 가 `forbidNonWhitelisted` 라
  **정의되지 않은 필드(`role` 등) 를 넣으면 400** 이다.
- `src/auth/auth.controller.ts` `106~176 행` — `@Controller("api/auth")` 의 `POST login`
  (`@HttpCode(200)`, body `LoginDto` = email + password, 응답 body 는 `{ userId }` **only**) 와
  `89~94 행` 의 `COOKIE_OPTIONS`(`httpOnly: true` · **`secure: true`** · `sameSite: "strict"` ·
  `path: "/"`). 토큰은 **body 에 없고 Set-Cookie 로만** 온다.
- `src/auth/auth.controller.ts` `296~299 행` — `@Get("me")` + `@UseGuards(JwtAuthGuard)`
  **단독**(RolesGuard 미적용). 즉 role 과 무관하게 인증만 통과하면 200 이고, 내부에서
  `userService.findById` 로 **DB round-trip** 이 발생한다 — 본 slice 의 타격 대상.
- `src/auth/jwt.strategy.ts` `33~60 행` — `jwtFromRequest` 가 **cookie 단일 source**
  (`req.cookies[access_token]`). `Authorization: Bearer` 는 cover 0 이므로 k6 는 반드시
  `Cookie: access_token=<값>` **header** 를 직접 실어야 한다.
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` (786 행) — 확장 대상
  drift-guard spec. 기존 지역 helper (`indentOf` · `unquote` · `extractStepBlock` ·
  `extractKey` · `extractStep` · `scriptPathOf` · `lineIndexOf` · `stepIndexOf`) 를 **재사용**
  하고 새 helper 는 1 개 이내로 억제한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2 S2` + `§3`
  임계 표 — p95 < 3s · error rate < 1%. **임계값 재산정 금지**(새 route tag 도 동일 3000ms).
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  `§Consequences 긍정` — "PR CI 무영향 — 별도 정기/수동 job 분리"(`workflow_dispatch` 유지 근거).

## Acceptance Criteria

- [ ] **(1) setup() 인증 부트스트랩** — `test/load/s2-read.js` 의 기존 `setup()` 에
      ① `POST /api/users` 로 계정 1 개 생성(`email` 은 기존 `stamp` 접미사 규약으로 **run 마다
      유일**, `password` 는 **8 자 이상**) ② `POST /api/auth/login` 으로 동일 자격증명 로그인
      ③ 응답의 `access_token` cookie 값을 읽어 ④ `authCookie: "access_token=<값>"` 같은
      **JSON 직렬화 가능한 문자열**을 기존 `return` 객체(`personIds` / `groupIds` / `partIds`)에
      **추가 필드로** 담는다. 기존 3 필드는 이름·의미 **불변**.
- [ ] **(2) 인증 route 타격** — `export default function (data)` 로 시그니처를 바꿔 한 iteration
      에 `GET /api/auth/me` 1 회를 추가한다. 요청 params 는
      `{ headers: { Cookie: data.authCookie }, tags: { route: "me" } }` 형태로 **새 route tag**
      를 단다. 기존 guard-free 3 종 GET 의 URL · tag · 호출 순서는 **불변**.
- [ ] **(3) 임계 1 종 추가** — `options.thresholds` 에
      `"http_req_duration{route:me}": ["p(95)<3000"]` 1 줄만 추가해 총 **6 종**(전역 2 + route 4)
      이 된다. 기존 5 종의 문자열(`p(95)<3000` · `rate<0.01`) 은 **값·표기 불변**(재산정 금지),
      `vus: 5` / `duration: "20s"` 도 불변.
- [ ] **(4) 지표 오염 차단** — signup / login 요청은 기존 `SEED_PARAMS`(`route: "seed"`) 를
      재사용하거나 동형의 별도 tag 를 달아, 조회 route tag 4 종(`persons` / `groups` / `parts` /
      `me`) 의 p95 를 오염시키지 않는다. **Admin+ 전용 route (`GET /api/users`) 는 타격하지
      않는다** — 첫-user SuperAdmin 승격 semantic 에 의존하면 로컬 반복 실행에서 403 이 나
      `http_req_failed` 를 오염시킨다.
- [ ] **(5) 분기 0 규약 승계** — `s2-read.js` 에 `if` / 삼항 / `&&` 단락 같은 **조건 분기를 두지
      않는다**(카운트 기반 `for` 반복문 · 배열 index 접근은 허용). cookie 값 추출도 index 접근
      만으로 처리하고, 분기가 필요해지면 unit-testable helper 로 분리한다(T-1620 규약).
- [ ] **(6) teardown 범위 명시** — `DELETE /api/users/:id` 는 **존재하지 않으므로**(user
      controller 는 `PATCH :id/role` · `POST` · `GET` · `GET :id` 4 종뿐) 생성된 계정은 지우지
      않는다. 기존 3 종 DELETE 정리 루프는 **불변**이고, "계정 row 는 남는다(CI DB 는 run 마다
      폐기 · 로컬은 `stamp` 로 충돌 회피)" 를 스크립트 주석 1~2 줄로 박제한다.
- [ ] **(7) happy-path 단언** — drift-guard spec 에 `it` 를 추가해 ① `s2-read.js` 가 signup
      경로(`/api/users`) 와 login 경로(`/api/auth/login`) 를 모두 포함 ② `access_token` cookie
      를 읽어 `Cookie` header 로 싣는 배선이 존재 ③ `default` 함수가 `/api/auth/me` 를
      `route: "me"` tag 로 타격 ④ `options.thresholds` 에 `route:me` 항목이 존재함을 각각
      단언한다(각 1+).
- [ ] **(8) error path 단언** — 재사용/확장하는 추출 helper 에 (a) 대상 step·키가 없는 합성
      YAML, (b) non-string 입력을 넣었을 때 각각 **"미발견" 정규형 반환** / **`TypeError`
      throw**(기존 계약)임을 단언하는 `it` 각 1+ (총 2+).
- [ ] **(9) 분기 cover** — 새로 도달시키는 추출 경로의 분기(값 따옴표 유무, 대상 토큰이 파일에
      1 회 / 다회 등장, 블록이 다음 헤더에서 끝남 / 파일 끝에서 끝남)마다 단언 1+. 분기가 없는
      helper 는 spec 주석에 "분기 없음" 을 남긴다.
- [ ] **(10) negative cases 충분 cover** — 최소 5 종: ① `s2-read.js` 에 여전히
      `/api/assessments` · `/api/contributions` · `/api/summaries` prefix 가 **없음**(인증 확장은
      `/api/auth/me` 1 종에 국한) ② `GET /api/users` 목록 타격이 **없음**(Admin+ 의존 회피) ③
      하드코딩 JWT 리터럴(`eyJ`) 과 `Bearer ` 문자열이 **없음**(토큰은 run 시점 login 으로만
      획득) ④ `options.thresholds` 항목이 정확히 **6 개**이고 기존 5 종 문자열이 그대로임 ⑤
      `.github/workflows/load-k6.yml` 이 **무변경**(`pull_request` · `push` · `schedule` 트리거
      부재 유지) ⑥ `package.json` 에 `k6` **dependency 키가 없음**. 추가로 `s2-read.js` 에
      `if (` 문자열이 **없음**(분기 0 규약) 을 단언한다.
- [ ] **(11) 실 발화 0 유지** — spec 은 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker
      실행 0 · 실 HTTP 0 · YAML 파서 0 · 새 dependency 0 · DB 의존 0 · `process.env` 읽기/쓰기
      0(파일 read + 합성 문자열 주입만).
- [ ] **(12) 검증 명령** — `pnpm lint && pnpm build` green, `pnpm test` 전량 pass,
      `pnpm test:cov` 통과(**line ≥ 80% / function ≥ 80%** — `src/` 무변경이라 coverage 영향 0),
      `pnpm test:smoke` 에서 본 spec green.
- [ ] **(13) 크기 상한** — 변경 파일 **2 개** · diff ≤ 300 LOC(권장 예산: `s2-read.js` ≤ 45,
      spec ≤ 150). 초과 예상 시 단언을 줄이고 남은 국면을 Follow-ups 로 넘긴다
      (**파일 추가 금지**).

## Out of Scope

- **`src/` 변경 전면 금지** — `Authorization: Bearer` extractor 추가 · `DELETE /api/users/:id`
  신설 · guard 조정은 모두 별도 결정(§5 security 게이트) 소관. 본 slice 는 **현행 계약 그대로**
  cookie header 를 실어 맞춘다.
- **133명 실 seed 금지** — [realdata-scale-devset.md](../ops/realdata-scale-devset.md) dataset
  주입은 S1 slice 소관. 본 slice 의 계정은 **합성 1 개**.
- **S1 배치 harness · S3 ramping VUs 금지** — 각각 별도 slice.
- **`.github/workflows/load-k6.yml` 변경 금지** — 새 `__ENV` 키 없이 스크립트 안에서 자격증명을
  생성한다(파일 cap 보호). **`.github/workflows/ci.yml` 도 변경 금지**(T-1122 / Q-0054 전례).
- **`test/load/smoke.js` 변경 금지** · **새 `test/load/*.js` 파일 추가 금지**.
- **`package.json` 변경 금지** — 새 script · dependency 0(`git diff` 로 확인). `pnpm-lock.yaml`
  도 불변.
- **임계값 재산정 · `vus` / `duration` 조정 · REQ-047 / REQ-048 상태 변경 금지** — 실측 baseline
  확정은 별도 slice, `docs/requirements.md` 는 현 상태 유지.
- **자격증명 상수 하드코딩 금지** — 고정 email / password 리터럴을 스크립트에 박지 않는다
  (§9 secret 규율 · run 마다 `stamp` 생성).
- **`prisma/` · `web/` · `test/perf/` 변경 금지.** per-route perf baseline slice 신설도 금지
  (`docs/PLAN.md` `145 행` 오너 지시).
- **`docs/PLAN.md` 완료 표기 변경 금지** — doc-sync 는 direct 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

R-91 chain 잔여(T-1623 Follow-ups 승계, 의존성 순서):

1. **인증 조회 route 확대** — `GET /api/users`(Admin+) · `GET /api/users/:id` 등 role 의존
   route 까지 확대. 첫-user SuperAdmin 승격 semantic 에 기대지 않는 역할 부여 경로 설계 동반.
2. **S1 평가 배치 부하 harness** — 133명 dataset seed + 배치 1회 + 단계별(수집/LLM/저장) 소요
   분포 수집. 격리 endpoint(stub/record-replay) 설계 동반.
3. **S3 동시성 내성** — ramping VUs 단계별 부하 + latency cliff / error rate 관찰.
4. **baseline 확정 + 임계 fix** — 최초 실측으로 계획 `§3` 의 "baseline 후 fix" 항목 확정.
5. **REQ-047 / REQ-048 상태 전이** — 실측 근거 확보 후 `docs/requirements.md` · `docs/PLAN.md`
   `140~142 행` 동기(direct doc-sync).

## 완료 기록 (2026-08-20T11:54:48Z)

- PR [#1301](https://github.com/myungjoo/Assessment-Agent/pull/1301) 라운드 1 APPROVE → 스쿼시 머지 `a3340e0c`.
- 변경 2 파일 +249/-10 — `test/load/s2-read.js` 의 `setup()` 이 run 마다 `stamp` 로 signup(`POST /api/users`) →
  `POST /api/auth/login` → `access_token` cookie 를 추출해 `authCookie` 로 반환하고, default 함수가 그 cookie 로
  `GET /api/auth/me` 를 `route: "me"` tag 로 추가 타격(기존 guard-free 3 종 불변). 임계 5 → 6 종.
- 자격증명 하드코딩 0(run 마다 `stamp` 생성) · 분기 0 규약 승계(index 접근만) · seed tag 재사용으로 지표 오염 차단.
- drift-guard smoke 38 → 46 it(해당 spec 58 test green), `src/` 변경 0 이라 coverage 영향 0, dependency 추가 0,
  `ci.yml` · `load-k6.yml` · `package.json` 무변경, 실 k6/HTTP 발화 0.
- Acceptance Criteria 13 항 전량 ok, `pnpm lint`/`build` green, `pnpm test` 441 suite / 12680 test pass.
