---
id: T-1622
title: k6 S2 조회 부하 시나리오 신설 (guard-free read 3 route · p95 < 3s 게이트 실발화)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-08-20
createdAt: 2026-08-20T06:10:00Z
completedAt: 2026-08-20T07:51:24Z
prNumber: 1299
independentStream: load-harness-k6
dependsOn: [T-1621]
touchesFiles:
  - test/load/s2-read.js
  - .github/workflows/load-k6.yml
  - package.json
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 3/N — T-1621 Follow-up 1(S2 조회 부하 시나리오). 실 seed·S1/S3 는 후속 slice 로 유지.
---

# T-1622 — k6 S2 조회 부하 시나리오 신설

## Why

오너가 `docs/PLAN.md` `144 행` 에서 **R-91 k6 부하검증 최우선 착수**를 확정했고, chain 1/N
([T-1620](T-1620-k6-load-job-skeleton.md), workflow 골격 + `test:load` script) 과 2/N
([T-1621](T-1621-load-k6-target-app-boot.md), PostgreSQL service + 앱 컨테이너 기동 +
`K6_BASE_URL` 겨냥) 이 머지됐다. 지금은 k6 가 **실 인스턴스를 때리지만 타격 경로가
`GET /api` sanity 1 개뿐** 이라 계획 `§2 S2` (조회 API 응답 지연, REQ-048) 의 p95 < 3s 게이트가
실제로 발화하지 않는다.

본 task 는 T-1621 `Follow-ups 1` (S2 조회 부하 시나리오) 을 집행해 **DB round-trip 을 실제로 타는
조회 route 를 반복 타격하는 k6 시나리오 스크립트**를 신설하고, 부하 job 이 그것을 실행하도록
배선한다. 133명 실 seed · S1 배치 harness · S3 동시성 내성 · baseline 확정은 여전히 후속 slice 다.

## Required Reading

- `test/load/smoke.js` — T-1620 이 만든 정본 스크립트 형태(`__ENV.K6_BASE_URL` 기본값 ·
  `options.thresholds` 2 종 · 분기 0 규약). **본 task 는 이 파일을 0 LOC 변경**하고 새 스크립트가
  같은 형태를 따른다.
- `.github/workflows/load-k6.yml` — 현재 배선 전문(services.postgres · 빌드 · 기동 polling ·
  k6 설치 · `k6 run test/load/smoke.js` · always teardown). **step 추가 1 개만** 하는 변경 대상.
- `package.json` `20~23 행` 부근 — `test:smoke` / `test:perf` / `test:load` script 형태.
  본 task 는 `test:load:s2` 1 줄만 추가한다(**dependency 추가 0** — k6 는 정적 바이너리).
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — 확장 대상 drift-guard spec.
  기존 지역 helper (`indentOf` · `unquote` · `extractStepBlock` · `extractKey` · `extractStep` ·
  `scriptPathOf` · `lineIndexOf` · `stepIndexOf`) 를 **재사용**하고 새 helper 는 1 개 이내로 억제.
- `src/user/person.controller.ts` `41~60 행` · `src/user/group.controller.ts` `79~99 행` ·
  `src/user/part.controller.ts` `50~70 행` — **`@UseGuards` 가 없는 guard-free 목록 GET**
  (`GET /api/persons` · `GET /api/groups` · `GET /api/parts`). 본 시나리오의 타격 대상. 반면
  `assessment` / `contribution` / `summary` / `user` controller 의 GET 은
  `@UseGuards(JwtAuthGuard, RolesGuard)` 라 토큰 없이는 401 → `http_req_failed` 임계를 깨므로
  **본 slice 에서 타격 금지**(인증 획득 배선은 후속 slice).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2 S2` (54~62 행)
  + `§3` 임계 표 — p95 < 3s · error rate < 1%, **p50 / throughput 는 "baseline 후 fix" 라 관찰만**.
  임계값 재산정 금지.
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  `§Consequences 긍정` — "PR CI 무영향 — 별도 정기/수동 job 분리" (workflow_dispatch 유지 근거).

## Acceptance Criteria

- [ ] **(1) S2 스크립트 신설** — `test/load/s2-read.js` 를 만들어 ① `__ENV.K6_BASE_URL` 기본값
      (`http://localhost:3000`) 을 `smoke.js` 와 동일하게 읽고 ② guard-free 목록 GET **3 route**
      (`/api/persons` · `/api/groups` · `/api/parts`) 를 한 iteration 안에서 각각 1 회 타격하며
      ③ 각 요청에 route 식별 tag (예: `tags: { route: "persons" }`) 를 단다.
- [ ] **(2) 부하 프로파일** — smoke(1 VU × 1 iteration) 보다 큰 **반복 조회** 프로파일을 선언한다
      (권장: `vus: 5` + `duration: "20s"` 수준 — 수동 발화라 비용 영향은 job 1 회에 국한).
      `stages` / ramping 은 S3 소관이므로 쓰지 않는다.
- [ ] **(3) 임계 게이트 실발화** — `options.thresholds` 에 계획 `§3` 값 그대로 전역
      `http_req_duration: ["p(95)<3000"]` + `http_req_failed: ["rate<0.01"]` 을 선언하고, 추가로
      **route tag 별 p95 임계** (`http_req_duration{route:persons}` 등 3 종) 를 같은 3000ms 로
      선언한다. **값 재산정 금지** — p50 / throughput 은 임계 없이 k6 기본 summary 관찰로 둔다.
- [ ] **(4) workflow 배선** — `load-k6.yml` 에 k6 실행 step 을 **1 개 추가**한다(기존 smoke 실행
      step 뒤 · teardown 앞). `env.K6_BASE_URL` 은 기존 step 과 동일 값, `run` 은
      `k6 run test/load/s2-read.js`. 기존 step · services · 기동/teardown step 은 **불변**.
- [ ] **(5) script parity** — `package.json` 에 `"test:load:s2": "k6 run test/load/s2-read.js"`
      1 줄을 추가해 workflow 실행 경로와 로컬 실행 경로가 동일함을 보장한다. 기존 `test:load` 는
      불변, `dependencies` / `devDependencies` 는 **0 LOC 변경**.
- [ ] **(6) happy-path 단언** — drift-guard spec 에 `it` 를 추가해 ① `test/load/s2-read.js` 가
      실재하고 3 route 문자열을 모두 포함 ② 전역 임계 2 종 + route tag 임계 3 종 선언 존재
      ③ workflow 의 S2 실행 step 이 실재하고 그 `run` 이 겨냥하는 스크립트 경로가 실재 파일
      ④ 그 경로가 `package.json` `test:load:s2` 의 경로와 **동일**(parity) 임을 각각 단언(각 1+).
- [ ] **(7) error path 단언** — 확장/재사용하는 추출 helper 에 (a) 대상 step·키가 없는 합성 YAML,
      (b) non-string 입력을 넣었을 때 각각 **"미발견" 정규형 반환** / **`TypeError` throw**
      (기존 계약) 임을 단언하는 `it` 각 1+ (총 2+).
- [ ] **(8) 분기 cover** — 새로 도달시키는 추출 경로의 분기(값 따옴표 유무, step 블록이 다음
      헤더에서 끝남 / 파일 끝에서 끝남, `env:` 블록 존재 / 부재)마다 단언 1+. 분기가 없는
      helper 는 spec 주석에 "분기 없음" 을 남긴다. `s2-read.js` 자체는 **조건 분기 0** 을 유지한다
      (분기가 필요해지면 unit-testable helper 로 분리 — T-1620 규약 승계).
- [ ] **(9) negative cases 충분 cover** — 최소 5 종: ① `s2-read.js` 에 auth-guarded prefix
      (`/api/assessments` · `/api/contributions` · `/api/summaries` · `/api/users`) 가 **없음**
      (토큰 없는 401 이 error rate 임계를 오염시키는 것 차단) ② `s2-read.js` 의 타격 경로에
      **id 파라미터 경로가 없음**(빈 DB 에서 404 → non-2xx 로 임계 오염 차단) ③ `load-k6.yml` 에
      여전히 `pull_request` · `push` · `schedule` 트리거가 **없음** ④ `ci.yml` 에 k6 실행 문자열이
      **없음**(ci.yml read only) ⑤ `package.json` 어디에도 `k6` **dependency 키가 없음**. 추가로
      임계 문자열이 `3000` 이 아닌 값으로 바뀌지 않았음(재산정 금지)을 단언한다.
- [ ] **(10) 실 발화 0 유지** — spec 은 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행
      0 · 실 HTTP 0 · YAML 파서 0 · 새 dependency 0 · DB 의존 0 · `process.env` 읽기/쓰기 0
      (파일 read + 합성 문자열 주입만).
- [ ] **(11) 검증 명령** — `pnpm lint && pnpm build` green, `pnpm test` 전량 pass,
      `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `src/` 무변경이라 coverage 영향 0),
      `pnpm test:smoke` 에서 본 spec green.
- [ ] **(12) 크기 상한** — 변경/추가 파일 **4 개** · diff ≤ 300 LOC (권장 예산: `s2-read.js` ≤ 70,
      workflow ≤ 20, `package.json` 1, spec ≤ 140). 초과 예상 시 단언을 줄이고 남은 국면을
      Follow-ups 로 넘긴다(**파일 추가 금지**).

## Out of Scope

- **133명 실 seed 금지** — [realdata-scale-devset.md](../ops/realdata-scale-devset.md) dataset
  주입은 후속 slice. 본 slice 는 빈/소규모 DB 상태의 조회 round-trip 을 측정한다.
- **인증 토큰 획득 배선 금지** — guard 가 붙은 조회 route(`/api/assessments` ·
  `/api/contributions` · `/api/summaries` · `/api/users`) 타격은 후속 slice(로그인 → JWT 주입
  설계 동반).
- **S1 배치 harness · S3 ramping VUs 금지** — 각각 별도 slice.
- **`test/load/smoke.js` 변경 금지** — 기존 smoke 경로는 그대로 둔다.
- **`.github/workflows/ci.yml` 변경 금지** — 읽기 전용(파일 cap · T-1122 / Q-0054 전례).
- **`schedule` 정기 trigger 추가 금지** — `workflow_dispatch` 만 유지.
- **임계값 재산정 · REQ-047 / REQ-048 상태 변경 금지** — 계획 `§3` "baseline 후 fix" 는 실측 후
  별도 slice, `docs/requirements.md` 는 현 상태 유지.
- **`src/` · `prisma/` · `web/` · `test/perf/` 변경 금지.** per-route perf baseline slice 신설도
  금지(`docs/PLAN.md` `145 행` 오너 지시).
- **`pnpm-lock.yaml` 변경 금지** — dependency 추가 0(`git diff` 로 확인).
- **`docs/PLAN.md` 완료 표기 변경 금지** — doc-sync 는 direct 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

R-91 chain 잔여(의존성 순서, T-1621 Follow-ups 승계):

1. **S2 인증 조회 확장** — 로그인 → JWT 주입으로 guard 붙은 조회 route 까지 S2 범위 확대.
2. **S1 평가 배치 부하 harness** — 133명 dataset seed + 배치 1회 + 단계별(수집/LLM/저장) 소요
   분포 수집. 격리 endpoint(stub/record-replay) 설계 동반.
3. **S3 동시성 내성** — ramping VUs 단계별 부하 + latency cliff / error rate 관찰.
4. **baseline 확정 + 임계 fix** — 최초 실측으로 계획 `§3` 의 "baseline 후 fix" 항목을 실 수치로
   확정.
5. **REQ-047 / REQ-048 상태 전이** — 실측 근거 확보 후 `docs/requirements.md` · `docs/PLAN.md`
   `140~142 행` 동기(direct doc-sync).

---

## 완료 기록 (2026-08-20T07:51:24Z)

- PR [#1299](https://github.com/myungjoo/Assessment-Agent/pull/1299) 라운드 1 APPROVE → 스쿼시 머지 `c9afd0ba`.
- 변경 4 파일 +254/-0 — `test/load/s2-read.js` 신설(guard-free read 3 route · route tag 별 임계),
  `.github/workflows/load-k6.yml` 실행 step 1 개 추가, `package.json` 의 `test:load:s2` script,
  drift-guard smoke 확장(it 9 개 추가 · 해당 spec 34 test green).
- dependency 추가 0(k6 는 lockfile 밖 정적 바이너리) · `ci.yml` 무변경 · 실 k6/HTTP 발화 0.
- Acceptance Criteria 12 항 전량 ok, `pnpm test` 441 suite / 12680 test pass, coverage line·function ≥ 80% 유지.

