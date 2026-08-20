---
id: T-1620
title: k6 부하 job 최소 골격 배선 (상시 PR CI 와 분리된 별도 workflow + smoke 스크립트)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-08-20
createdAt: 2026-08-20T02:37:58Z
independentStream: load-harness-k6
dependsOn: []
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/load/smoke.js
  - package.json
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 1/N — 오너 e9c3fa6f 지시(PLAN 144 행)로 R-92 churn 중단·k6 즉시 착수. 본 slice 는 실행 배선 골격만(실 seed·게이트는 후속).
---

# T-1620 — k6 부하 job 최소 골격 배선

## Why

오너가 main `e9c3fa6f` (2026-08-20T02:29Z) 에서
[ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) 를 **ACCEPTED** 로 flip 하며 k6
새 dependency 를 승인했고([CLAUDE.md](../../CLAUDE.md) §5 HITL 게이트 해소), `docs/PLAN.md`
`144 행` 에 **"R-91 k6 부하검증 — 최우선·즉시 착수"** 를 확정했다. PLAN `141 행` 이 기록하듯
REQ-047(100~200명 × 50~100 repo × ~1000 page 배치 1h 이내)은 **부하 발생기 자체가 없어 미검증**
상태다.

본 task 는 그 chain 의 **첫 slice** 로, 부하 harness 의 **실행 배선 골격만** 연다 — ①
`.github/workflows/` 에 상시 PR CI 와 **분리된** 별도 workflow(수동 trigger), ② 임계를 선언한
최소 k6 스크립트 1 개, ③ `package.json` 의 실행 script 항목. ADR-0054 `§Consequences 긍정`
("PR CI 무영향 — k6 는 별도 정기/수동 job 으로 분리") 과
[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5 item 4`(부하 job 은 별도
trigger 로 편입, 상시 PR CI 와 분리) 를 그대로 집행한다.

실 133명 seed · 1h 이내 실측 게이트 · REQ-047 최종 판정은 **후속 slice** 다(아래 Out of Scope /
Follow-ups). 본 slice 가 여는 것은 "k6 가 CI runner 위에서 돌고 임계 위반 시 non-zero exit 로
끝난다" 는 골격뿐이다.

## Required Reading

- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  — `§Status`(ACCEPTED flip 근거) · `§Decision`(k6 2-계층 접근) · `§Consequences 부정`
  ("k6 는 npm 패키지가 아니라 정적 바이너리 — `pnpm-lock.yaml` 관리 대상 밖, CI runner 의 별도
  설치 step 으로 편입") · `§후속 task 전망` 첫 항목("도구 도입 task — k6 CI 설치 step + 부하 job
  스켈레톤").
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2` 시나리오
  (S1/S2/S3) · `§3` 측정 지표·임계 표(p95 < 3s, error rate < 1%) · `§5` follow-up 인덱스 item 3·4.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) — `§규모` (총 133명, R-91
  목표 충족). **본 slice 에서 seed 하지 않는다** — 후속 slice 가 소비할 dataset 의 존재만 확인.
- `.github/workflows/ci.yml` — `1~44 행`(트리거 `on:` · `permissions:` · `concurrency:` 그룹 규약)
  과 `44~48 행`(`jobs.ci` 헤더). **읽기 전용 · 0 LOC 변경** — 본 slice 는 ci.yml 을 건드리지 않고
  새 workflow 파일을 신설한다.
- `package.json` — `scripts` 블록(`test:perf` 항목 형태) · `devDependencies`(k6 는 여기 들어가지
  **않는다**).
- `test/smoke/ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts` — **정본 패턴**
  (workflow YAML 을 `readFileSync` + 정적 텍스트 추출로 대조하는 drift-guard smoke 의 구조 ·
  지역 helper `indentOf`/`unquote`/step 블록 절단 · YAML 파서 0 · 새 dependency 0). 0 LOC 변경,
  구조만 참조.

## Acceptance Criteria

- [ ] **(1) 별도 workflow 신설** — `.github/workflows/load-k6.yml` 1 개를 신설한다.
      트리거는 **`workflow_dispatch` 만** (`pull_request` · `push` 트리거를 넣지 않는다 — 상시 PR
      CI 무영향, ADR-0054 `§Consequences 긍정`). job 은 checkout → k6 설치 step 1 개 →
      k6 스크립트 실행 step 1 개의 최소 구성. 설치는 ADR-0054 가 명시한
      `grafana/setup-k6-action` 을 권장하며, 어느 방식이든 **`package.json` / `pnpm-lock.yaml` 에
      k6 를 추가하지 않는다**(정적 바이너리 — lockfile 관리 대상 밖).
- [ ] **(2) 최소 k6 스크립트** — `test/load/smoke.js` 1 개를 신설한다. `export const options` 에
      `thresholds` 로 계획 `§3` 의 두 임계(`http_req_duration: ["p(95)<3000"]`,
      `http_req_failed: ["rate<0.01"]`)를 선언하고, 대상 base URL 은 환경변수(예: `K6_BASE_URL`,
      기본값 `http://localhost:3000`)에서 읽어 **정적 선언**으로 유지한다(조건 분기 로직 금지 —
      아래 (6) 참조). VU · duration 은 smoke 수준(예: `vus: 1`, `iterations: 1` 또는
      `duration: "5s"`)으로 최소화한다.
- [ ] **(3) 실행 script** — `package.json` 의 `scripts` 에 `test:load` 1 항목을 추가해 (1) 의
      workflow step 과 **동일한 스크립트 경로**를 실행한다(예: `k6 run test/load/smoke.js`).
      dependency 블록은 무변경.
- [ ] **(4) drift-guard smoke spec** —
      `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 1 개를 신설해 위 배선을
      **실 파일 read + 정적 텍스트 추출**로 대조한다(실 GitHub Actions 발화 0 · 실 k6 실행 0 ·
      YAML 파서 0 · 새 dependency 0). 아래 (5)~(8) 의 국면을 본 spec 이 담는다.
- [ ] **(5) happy-path** — `load-k6.yml` 이 존재하고 ① `workflow_dispatch` 트리거를 가지며 ②
      k6 설치 step 1 개와 실행 step 1 개를 가지고 ③ 실행 step 의 스크립트 경로가 실제로 존재하는
      파일(`test/load/smoke.js`) 이며 ④ 그 경로가 `package.json` 의 `test:load` 와 **동일**함을
      단언하는 `it` 각 1+ (parity 단언 포함).
- [ ] **(6) error path** — 추출 helper 에 (a) 존재하지 않는 workflow 경로, (b) 대상 step 이 없는
      합성 YAML 문자열을 넣었을 때 **throw 하지 않고** "미발견" 정규형으로 보고함을 단언하는
      `it` 각 1+ (총 2+).
- [ ] **(7) 분기 cover** — 추출 helper 의 분기(따옴표 있는 값 / 없는 값, 들여쓰기로 step 블록이
      끝나는 경우 / 파일 끝에서 끝나는 경우)를 각각 도달시키는 단언 1+. 분기가 실제로 없는
      helper 는 본 항목에서 제외하되 spec 주석에 "분기 없음" 을 남긴다.
- [ ] **(8) negative cases 충분 cover** — 최소 3 종: ① `load-k6.yml` 에 `pull_request` ·
      `push` 트리거 문자열이 **없음**(상시 PR CI 오염 차단), ② `.github/workflows/ci.yml` 에
      k6 실행 문자열이 **없음**(부하가 상시 CI 로 새어 들어가지 않음 — ci.yml 은 read only), ③
      `package.json` 의 `dependencies`/`devDependencies` 어디에도 `k6` 키가 **없음**(정적 바이너리
      규약 위반 차단). 추가로 `process.env` 를 읽지도 쓰지도 않음(합성 입력만 주입)을 유지한다.
- [ ] **(9) 분기 로직은 unit-testable helper 로만** — shell 또는 TS 에 조건 분기가 필요해지면
      workflow 의 인라인 `run:` 에 묻지 말고 별도 helper 로 분리해 colocated spec 을 붙인다. 본
      slice 는 그런 helper 를 추가하지 않는 범위로 설계한다(추가하면 파일 cap 초과 — split 사유).
- [ ] **(10) 검증 명령** — `pnpm lint && pnpm build` green, `pnpm test` 전량 pass,
      `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `src/` 무변경이라 coverage 영향 0 이어야
      한다), `pnpm test:smoke` 에서 신규 spec 이 green.
- [ ] **(11) 크기 상한** — 변경 파일 **4 개** · diff ≤ 300 LOC. 파일별 예산 권장:
      `load-k6.yml` ≤ 60 · `smoke.js` ≤ 50 · `package.json` 1 · smoke spec ≤ 180. 초과가 예상되면
      단언을 줄이고 남은 국면을 Follow-ups 로 넘긴다(파일 추가 금지).

## Out of Scope

- **133명 실 seed 금지** — [realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 dataset
  주입·배치 실행은 후속 slice. 본 slice 의 k6 스크립트는 smoke 수준 1 VU 다.
- **1h 이내 실측 게이트 · REQ-047 최종 검증 금지** — 계획 `§3` 의 S1 배치 완료 시간 임계 판정과
  `docs/requirements.md` 의 REQ-047 상태 변경(PLANNED 유지)은 본 slice 범위 밖.
- **S1 격리 endpoint(stub / record-replay) 설계 금지** — LLM · 외부 수집 I/O 격리는 별도 slice
  (ADR-0054 `§후속 task 전망`).
- **`.github/workflows/ci.yml` 변경 금지** — 읽기 전용. ci.yml 에 step 을 추가하면 drift-guard
  smoke 3 종 동반으로 파일 cap 이 터진다(T-1122 / Q-0054 전례).
- **`schedule` 정기 trigger 금지** — 본 slice 는 `workflow_dispatch` 만. 정기 실행은 비용 판단이
  따로 필요한 별도 slice.
- **`src/` · `prisma/` · `test/perf/` 변경 금지.** per-route perf baseline slice 신설도 금지
  (`docs/PLAN.md` `145 행`).
- **`package.json` 의 dependency 추가 금지** — k6 는 npm 패키지가 아니다. `pnpm-lock.yaml`
  무변경(`git diff` 로 확인).
- **`docs/PLAN.md` · `docs/requirements.md` 완료 표기 변경 금지** — doc-sync 는 direct 별도 slice.
- **임계값 재산정 금지** — 계획 `§3` 의 "baseline 후 fix" 는 실측 후 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

R-91 chain 의 남은 slice(의존성 순서):

1. **부하 대상 기동 배선** — load job 안에서 앱(+PostgreSQL service)을 띄우고 `K6_BASE_URL` 을
   실제 인스턴스로 겨냥. 현재는 스크립트가 기본값만 들고 있다.
2. **S2 조회 부하 시나리오** — 계획 `§2 S2` 를 k6 시나리오로(p95 < 3s 임계 게이트 실발화).
3. **S1 평가 배치 부하 harness** — 133명 dataset seed + 배치 1회 실행 + 단계별(수집/LLM/저장)
   소요 분포 수집. 격리 endpoint(stub/record-replay) 설계 동반.
4. **S3 동시성 내성** — ramping VUs 단계별 부하 + latency cliff / error rate 관찰.
5. **baseline 확정 + 임계 fix** — 최초 실측으로 계획 `§3` 의 "baseline 후 fix" 를 실 수치로 확정,
   `load-resilience-test-plan.md` 갱신.
6. **REQ-047 상태 전이** — 1h 이내 실측 근거 확보 후 `docs/requirements.md` · `docs/PLAN.md`
   `140~141 행` 완료 표기 동기(direct doc-sync).
