---
id: T-1621
title: k6 부하 job 의 부하 대상 기동 배선 (PostgreSQL service + 앱 컨테이너 + K6_BASE_URL 겨냥)
phase: P5
status: DONE
completedAt: 2026-08-20T05:51:51Z
prNumber: 1298
mergeCommit: 1f939d5c
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-20
createdAt: 2026-08-20T04:30:00Z
independentStream: load-harness-k6
dependsOn: [T-1620]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 2/N — T-1620 Follow-up 1(부하 대상 기동 배선). k6 가 실제 인스턴스를 때리도록 앱+DB 기동, 실 seed·시나리오는 후속.
---

# T-1621 — k6 부하 job 의 부하 대상 기동 배선

## Why

오너가 `docs/PLAN.md` `144 행` 에서 **R-91 k6 부하검증 최우선 착수**를 확정했고, 그 chain 1/N 인
[T-1620](T-1620-k6-load-job-skeleton.md) 이 `workflow_dispatch` 전용 부하 workflow · 임계
선언 k6 스크립트 · `test:load` script 골격을 머지했다. 다만 현재 `test/load/smoke.js` 의
`K6_BASE_URL` 은 **기본값만 들고 있어 부하 대상이 존재하지 않는다** — job 을 수동 발화하면 k6 가
아무도 듣지 않는 `http://localhost:3000` 을 때린다.

본 task 는 T-1620 `Follow-ups 1` (부하 대상 기동 배선) 을 집행해, 부하 job 안에서 **PostgreSQL
service + 앱 인스턴스를 실제로 띄우고 `K6_BASE_URL` 을 그 인스턴스로 겨냥**한다. 기동 방식은
`ci.yml` 의 `deploy-artifacts` job (`306~383 행`) 이 이미 증명한 패턴 — `services.postgres` +
`docker build` + `docker run --network host` + readiness polling — 을 그대로 따라 새 추론을 만들지
않는다. 133명 실 seed · S1/S2/S3 시나리오 · 1h 실측 게이트는 여전히 후속 slice 다.

## Required Reading

- `.github/workflows/load-k6.yml` — T-1620 이 만든 현재 골격 전문(트리거 `workflow_dispatch` ·
  `concurrency: load-k6` · k6 설치/실행 step 2 개). **본 task 의 유일한 workflow 변경 대상.**
- `.github/workflows/ci.yml` `306~383 행` — `deploy-artifacts` job 의 **정본 패턴**:
  `services.postgres`(image `postgres:16-alpine` · `POSTGRES_USER/PASSWORD/DB` · `ports` ·
  `--health-cmd pg_isready` 옵션), `docker build -t ... .`, `docker run -d --network host` 의
  env 3 종(`DATABASE_URL` · `AUTH_JWT_SECRET` · `PORT`), 30회 × 2s curl polling + crash 감지 +
  `docker logs` + `docker rm -f`. **읽기 전용 · 0 LOC 변경** (ci.yml 을 건드리면 drift-guard
  smoke 3 종 동반으로 파일 cap 이 터진다 — T-1122 / Q-0054 전례).
- `test/load/smoke.js` — `__ENV.K6_BASE_URL` 기본값과 타격 경로(`GET /api`). **0 LOC 변경** —
  스크립트는 이미 env 를 읽으므로 workflow 가 주입만 하면 된다.
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — 본 task 가 확장할 drift-guard
  spec. 기존 지역 helper (`indentOf` · `unquote` · `extractStepBlock` · `extractKey` ·
  `extractStep`) 를 **재사용**하고 새 helper 는 꼭 필요한 1 개 이내로 억제한다.
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  — `§Consequences 긍정`("PR CI 무영향 — 별도 정기/수동 job 분리") · `§후속 task 전망`.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` — 임계 표
  (p95 < 3s · error rate < 1%). **임계값 재산정 금지** (baseline 후 fix).

## Acceptance Criteria

- [ ] **(1) DB service 배선** — `load-k6.yml` 의 `jobs.load` 에 `services.postgres` 를 추가한다.
      image · env(`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`) · `ports` · health check
      옵션은 `ci.yml` `deploy-artifacts` (`322~336 행`) 와 **동일 형태**로 맞춘다(새 추론 0).
- [ ] **(2) 부하 대상 기동 step** — checkout 이후 · k6 실행 step **이전에** ① 이미지 빌드
      (`docker build`) ② 컨테이너 기동(`docker run -d --network host` + `DATABASE_URL` ·
      `AUTH_JWT_SECRET` · `PORT=3000` 주입) ③ **readiness polling**(HTTP 응답이 올 때까지 최대
      60s, 컨테이너 crash 시 `docker logs` 후 즉시 fail) 을 배선한다. polling 없이 k6 를 바로
      실행하면 부하 측정이 부팅 지연을 섞어 오염되므로 **필수**다.
- [ ] **(3) K6_BASE_URL 겨냥** — k6 실행 step 에 `env: K6_BASE_URL` 을 주입해 (2) 로 띄운
      인스턴스(`http://localhost:3000`) 를 겨냥한다. `run:` 명령 자체(`k6 run test/load/smoke.js`)
      와 `package.json` 의 `test:load` parity 는 **그대로 유지**한다.
- [ ] **(4) 정리 step** — `if: always()` teardown step 1 개로 `docker logs` 출력 + `docker rm -f`
      를 수행해 k6 실패 시에도 컨테이너가 남지 않게 한다.
- [ ] **(5) happy-path 단언** — 기존 drift-guard spec 에 `it` 를 추가해 ① `services.postgres`
      블록 존재 + health check 옵션 존재 ② 기동 step 존재 ③ k6 실행 step 의 `K6_BASE_URL` 값이
      `test/load/smoke.js` 의 기본값 포트와 **동일** ④ **step 순서** 가 `기동 step index < k6 실행
      step index` 임을 각각 단언한다(각 1+).
- [ ] **(6) error path 단언** — 추출 helper 에 (a) 대상 step/키가 없는 합성 YAML 문자열,
      (b) non-string 입력을 넣었을 때 각각 **"미발견" 정규형 반환** / **`TypeError` throw**
      (기존 `extractStepBlock` 계약) 임을 단언하는 `it` 각 1+ (총 2+).
- [ ] **(7) 분기 cover** — 새로/확장해 쓰는 추출 경로의 분기(값에 따옴표 있음 / 없음, step 블록이
      다음 헤더에서 끝남 / 파일 끝에서 끝남, `env:` 블록 존재 / 부재)를 각각 도달시키는 단언 1+.
      분기가 없는 helper 는 spec 주석에 "분기 없음" 을 남긴다.
- [ ] **(8) negative cases 충분 cover** — 최소 4 종: ① `load-k6.yml` 에 여전히 `pull_request` ·
      `push` 트리거 문자열이 **없음**(상시 PR CI 오염 차단 — T-1620 게이트 유지) ② `ci.yml` 에
      k6 실행 문자열이 **없음**(부하가 상시 CI 로 새어 들어가지 않음, ci.yml 은 read only) ③
      `package.json` 의 `dependencies` / `devDependencies` 어디에도 `k6` 키가 **없음**(정적
      바이너리 규약) ④ teardown step 이 `if: always()` 를 가짐(실패 시 컨테이너 잔존 차단). 추가로
      `K6_BASE_URL` 값이 외부 host 가 아니라 로컬 인스턴스를 겨냥함을 단언한다.
- [ ] **(9) 실 발화 0 유지** — spec 은 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 ·
      YAML 파서 0 · 새 dependency 0 · DB 의존 0 · `process.env` 읽기/쓰기 0 (파일 read + 합성
      문자열 주입만) 을 유지한다.
- [ ] **(10) 검증 명령** — `pnpm lint && pnpm build` green, `pnpm test` 전량 pass,
      `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `src/` 무변경이라 coverage 영향 0 이어야
      한다), `pnpm test:smoke` 에서 본 spec green.
- [ ] **(11) 크기 상한** — 변경 파일 **2 개** · diff ≤ 300 LOC (권장 예산: workflow ≤ 60,
      spec ≤ 120). 초과가 예상되면 단언을 줄이고 남은 국면을 Follow-ups 로 넘긴다(파일 추가 금지).

## Out of Scope

- **133명 실 seed 금지** — [realdata-scale-devset.md](../ops/realdata-scale-devset.md) dataset 주입은
  후속 slice. 본 slice 의 k6 스크립트는 여전히 1 VU smoke 다.
- **`test/load/smoke.js` 변경 금지** — 시나리오(S1/S2/S3) · VU 프로파일 · 타격 경로 확장은 후속
  slice. 본 slice 는 workflow 가 env 를 주입할 뿐이다.
- **`.github/workflows/ci.yml` 변경 금지** — 읽기 전용(파일 cap · T-1122/Q-0054 전례).
- **`schedule` 정기 trigger 추가 금지** — `workflow_dispatch` 만 유지(비용 판단은 별도 slice).
- **임계값 재산정 · REQ-047 상태 변경 금지** — 계획 `§3` "baseline 후 fix" 는 실측 후 별도 slice,
  `docs/requirements.md` REQ-047 은 PLANNED 유지.
- **`src/` · `prisma/` · `web/` · `test/perf/` 변경 금지.** per-route perf baseline slice 신설도
  금지(`docs/PLAN.md` `145 행` 오너 지시).
- **`package.json` / `pnpm-lock.yaml` 변경 금지** — dependency 추가 0(`git diff` 로 확인).
- **`docs/PLAN.md` 완료 표기 변경 금지** — doc-sync 는 direct 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

R-91 chain 잔여(의존성 순서, T-1620 Follow-ups 승계):

1. **S2 조회 부하 시나리오** — 계획 `§2 S2` 를 k6 시나리오로(p95 < 3s 임계 게이트 실발화).
2. **S1 평가 배치 부하 harness** — 133명 dataset seed + 배치 1회 + 단계별(수집/LLM/저장) 소요
   분포 수집. 격리 endpoint(stub/record-replay) 설계 동반.
3. **S3 동시성 내성** — ramping VUs 단계별 부하 + latency cliff / error rate 관찰.
4. **baseline 확정 + 임계 fix** — 최초 실측으로 계획 `§3` 를 실 수치로 확정.
5. **REQ-047 상태 전이** — 1h 이내 실측 근거 확보 후 `docs/requirements.md` · `docs/PLAN.md`
   `140~141 행` 완료 표기 동기(direct doc-sync).
