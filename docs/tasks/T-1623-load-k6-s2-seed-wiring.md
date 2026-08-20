---
id: T-1623
title: k6 S2 조회 부하의 seed 배선 (setup/teardown 으로 조회 대상 row 생성·정리)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-20
createdAt: 2026-08-20T08:10:00Z
independentStream: load-harness-k6
dependsOn: [T-1622]
touchesFiles:
  - test/load/s2-read.js
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 4/N — 빈 DB 조회의 무의미 측정 해소(seed). 인증 조회·S1·S3 는 후속 slice 유지.
---

# T-1623 — k6 S2 조회 부하의 seed 배선

## Why

오너가 `docs/PLAN.md` `144 행` 에서 **R-91 k6 부하검증 최우선 착수**를 확정했고, chain 1/N
([T-1620](T-1620-k6-load-job-skeleton.md) workflow 골격) · 2/N
([T-1621](T-1621-load-k6-target-app-boot.md) 부하 대상 기동) · 3/N
([T-1622](T-1622-load-k6-s2-read-scenario.md) S2 조회 시나리오) 가 모두 머지됐다.

그러나 부하 job 의 PostgreSQL service 는 run 마다 **새로 만들어진 빈 DB** 라, 지금 S2 가 때리는
`GET /api/persons` · `/api/groups` · `/api/parts` 는 전부 **0 행 목록**을 돌려준다. 즉 계획
`§2 S2` 가 요구하는 "이미 저장된 평가 결과 조회" 의 DB round-trip 이 사실상 빈 쿼리라
p95 < 3s 게이트가 **통과해도 아무것도 입증하지 못한다**. 본 slice 는 k6 의 `setup()` /
`teardown()` 수명주기를 써서 **조회 대상 row 를 부하 직전에 만들고 끝난 뒤 정리**해, S2 측정이
실제 데이터를 읽는 측정이 되게 한다. 이는 후속 "133명 실 seed"(S1) · "baseline 확정" slice 의
선행 배선이기도 하다.

## Required Reading

- `test/load/s2-read.js` — 본 task 의 주 변경 대상(현재 40 행). `__ENV` 기본값 규약 ·
  `options.thresholds` 5 종(전역 2 + route tag 3) · route tag(`tags: { route: ... }`) ·
  **조건 분기 0** 규약을 그대로 승계한다.
- `test/load/smoke.js` — 정본 스크립트 형태. **0 LOC 변경**.
- `.github/workflows/load-k6.yml` — `k6 S2 조회 부하 시나리오 실행` step 의 `env` 블록만 늘리는
  변경 대상. services · 빌드 · 기동 polling · smoke 실행 step · teardown step 은 **불변**.
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` (592 행) — 확장 대상
  drift-guard spec. 기존 지역 helper (`indentOf` · `unquote` · `extractStepBlock` ·
  `extractKey` · `extractStep` · `scriptPathOf` · `lineIndexOf` · `stepIndexOf`) 를 **재사용**
  하고 새 helper 는 1 개 이내로 억제한다.
- `src/user/person.controller.ts` `41~100 행` — `@Controller("api/persons")` 에 `@UseGuards` 가
  **전무**하다. `POST /api/persons`(201) · `DELETE /api/persons/:id`(204) 가 guard-free 라
  토큰 없이 seed / 정리가 가능하다.
- `src/user/dto/create-person.dto.ts` — seed payload 계약: `fullName`(non-empty, ≤255) +
  `email`(RFC 5322, ≤255, **Prisma `@unique`** → 중복 시 409). ValidationPipe 가
  `forbidNonWhitelisted` 라 **정의되지 않은 필드를 넣으면 400** 이다.
- `src/user/dto/create-group.dto.ts` · `src/user/dto/create-part.dto.ts` — 둘 다 `name` 1 필드.
  `Part.name` 은 `@unique`, `Group.name` 은 아니다(동명 허용).
- `src/user/group.controller.ts` `79~200 행` · `src/user/part.controller.ts` `50~135 행` —
  `POST` / `DELETE` 모두 guard-free 임을 확인(별도 인증 배선 불요).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2 S2` +
  `§3` 임계 표 — p95 < 3s · error rate < 1%. **임계값 재산정 금지**.
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  `§Consequences 긍정` — "PR CI 무영향 — 별도 정기/수동 job 분리"(`workflow_dispatch` 유지 근거).

## Acceptance Criteria

- [ ] **(1) setup() seed** — `test/load/s2-read.js` 에 `export function setup()` 을 추가해
      ① `POST /api/persons` 로 인원 N 행 ② `POST /api/groups` 로 group 1 행 ③ `POST /api/parts`
      로 part 1 행을 만들고, ④ 생성된 id 들을 JSON 직렬화 가능한 객체로 **return** 한다.
      N 은 `__ENV.K6_SEED_PERSONS` 를 읽고 미지정 시 기본값(권장 30)을 쓴다 — `BASE_URL` 의
      `__ENV` 기본값 규약과 동형.
- [ ] **(2) 충돌 회피** — seed 의 `email`(Person `@unique`) 과 `name`(Part `@unique`) 은
      **run 마다 유일**해야 한다(예: `Date.now()` + index 접미사). 로컬 반복 실행에서도 409 가
      나지 않아야 하며, 409 가 나면 전역 `http_req_failed` 임계를 오염시킨다.
- [ ] **(3) teardown() 정리** — `export function teardown(data)` 에서 setup 이 만든 row 를
      `DELETE /api/persons/:id` · `/api/groups/:id` · `/api/parts/:id` 로 모두 지운다.
      CI 의 DB 는 run 마다 폐기되지만 **로컬 반복 실행 시 데이터 누적을 막는 책임**이다.
- [ ] **(4) 지표 오염 차단** — seed / teardown 요청에는 읽기 route tag(`persons` / `groups` /
      `parts`) 를 **재사용하지 않고** 별도 tag(예: `route: "seed"` · `route: "teardown"`) 를
      단다. 그래야 기존 route tag 별 p95 임계 3 종이 **조회 지연만** 측정한다. `options` 의
      기존 임계 5 종은 **값·개수 불변**(재산정 금지), `vus` / `duration` 도 불변.
- [ ] **(5) 분기 0 규약 승계** — `s2-read.js` 에 `if` / 삼항 / `&&` 단락 같은 **조건 분기를 두지
      않는다**(카운트 기반 `for` 반복문은 허용). 분기가 필요해지면 unit-testable helper 로
      분리한다(T-1620 규약).
- [ ] **(6) workflow 배선** — `load-k6.yml` 의 **`k6 S2 조회 부하 시나리오 실행` step 의 `env`
      블록에 `K6_SEED_PERSONS` 1 줄만** 추가한다(권장 `"30"`). `K6_BASE_URL` · `run` 명령 ·
      step 순서 · smoke 실행 step · services · 기동/teardown step 은 **불변**.
- [ ] **(7) happy-path 단언** — drift-guard spec 에 `it` 를 추가해 ① `s2-read.js` 가
      `export function setup` 과 `export function teardown` 을 모두 선언 ② seed 가 3 종 POST
      경로(`/api/persons` · `/api/groups` · `/api/parts`) 를 포함 ③ teardown 이 3 종 DELETE
      경로를 포함 ④ workflow 의 S2 step `env` 에서 뽑은 `K6_SEED_PERSONS` 값이 존재하고
      `s2-read.js` 가 읽는 `__ENV` 키와 **동일**(parity) 임을 각각 단언한다(각 1+).
- [ ] **(8) error path 단언** — 재사용/확장하는 추출 helper 에 (a) 대상 step·키가 없는 합성
      YAML, (b) non-string 입력을 넣었을 때 각각 **"미발견" 정규형 반환** / **`TypeError`
      throw**(기존 계약)임을 단언하는 `it` 각 1+ (총 2+).
- [ ] **(9) 분기 cover** — 새로 도달시키는 추출 경로의 분기(값 따옴표 유무, `env:` 블록에
      키가 1 개 / 2 개, step 블록이 다음 헤더에서 끝남 / 파일 끝에서 끝남)마다 단언 1+.
      분기가 없는 helper 는 spec 주석에 "분기 없음" 을 남긴다.
- [ ] **(10) negative cases 충분 cover** — 최소 5 종: ① `s2-read.js` 에 auth-guarded prefix
      (`/api/assessments` · `/api/contributions` · `/api/summaries` · `/api/users`) 가 여전히
      **없음** ② seed / teardown tag 가 읽기 route tag 3 종과 **겹치지 않음**(지표 오염 차단)
      ③ `options.thresholds` 의 임계 문자열이 여전히 `3000` / `rate<0.01` 이고 항목 수가
      **5 개 그대로**(재산정 금지) ④ `load-k6.yml` 에 여전히 `pull_request` · `push` ·
      `schedule` 트리거가 **없음** ⑤ `package.json` 어디에도 `k6` **dependency 키가 없음**.
      추가로 `s2-read.js` 에 `if (` 문자열이 **없음**(분기 0 규약)을 단언한다.
- [ ] **(11) 실 발화 0 유지** — spec 은 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker
      실행 0 · 실 HTTP 0 · YAML 파서 0 · 새 dependency 0 · DB 의존 0 · `process.env` 읽기/쓰기
      0(파일 read + 합성 문자열 주입만).
- [ ] **(12) 검증 명령** — `pnpm lint && pnpm build` green, `pnpm test` 전량 pass,
      `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `src/` 무변경이라 coverage 영향 0),
      `pnpm test:smoke` 에서 본 spec green.
- [ ] **(13) 크기 상한** — 변경 파일 **3 개** · diff ≤ 300 LOC(권장 예산: `s2-read.js` ≤ 55,
      workflow 1~2, spec ≤ 140). 초과 예상 시 단언을 줄이고 남은 국면을 Follow-ups 로 넘긴다
      (**파일 추가 금지**).

## Out of Scope

- **133명 실 seed 금지** — [realdata-scale-devset.md](../ops/realdata-scale-devset.md) dataset
  주입(실 GitHub/Confluence 수집 동반)은 S1 slice 소관. 본 slice 의 seed 는 **합성 소규모 fixture**.
- **인증 토큰 획득 배선 금지** — guard 가 붙은 조회 route 타격 및 로그인 → JWT 주입은 후속 slice.
- **S1 배치 harness · S3 ramping VUs 금지** — 각각 별도 slice.
- **`test/load/smoke.js` 변경 금지** · **새 `test/load/*.js` 파일 추가 금지**.
- **`.github/workflows/ci.yml` 변경 금지** — 읽기 전용(파일 cap · T-1122 / Q-0054 전례).
- **`package.json` 변경 금지** — 새 script · dependency 0(`git diff` 로 확인).
  `pnpm-lock.yaml` 도 불변.
- **`schedule` 정기 trigger 추가 금지** — `workflow_dispatch` 만 유지.
- **임계값 재산정 · `vus` / `duration` 조정 · REQ-047 / REQ-048 상태 변경 금지** — 실측 baseline
  확정은 별도 slice, `docs/requirements.md` 는 현 상태 유지.
- **`src/` · `prisma/` · `web/` · `test/perf/` 변경 금지.** per-route perf baseline slice 신설도
  금지(`docs/PLAN.md` `145 행` 오너 지시).
- **`docs/PLAN.md` 완료 표기 변경 금지** — doc-sync 는 direct 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

R-91 chain 잔여(T-1622 Follow-ups 승계, 의존성 순서):

1. **S2 인증 조회 확장** — 로그인 → JWT 주입으로 guard 붙은 조회 route 까지 S2 범위 확대
   (admin 계정 seed 경로 설계 동반 — `POST /api/users` 는 guard 가 있어 별도 부트스트랩 필요).
2. **S1 평가 배치 부하 harness** — 133명 dataset seed + 배치 1회 + 단계별(수집/LLM/저장) 소요
   분포 수집. 격리 endpoint(stub/record-replay) 설계 동반.
3. **S3 동시성 내성** — ramping VUs 단계별 부하 + latency cliff / error rate 관찰.
4. **baseline 확정 + 임계 fix** — 최초 실측으로 계획 `§3` 의 "baseline 후 fix" 항목 확정.
5. **REQ-047 / REQ-048 상태 전이** — 실측 근거 확보 후 `docs/requirements.md` · `docs/PLAN.md`
   `140~142 행` 동기(direct doc-sync).
