---
id: T-1659
title: load-k6.yml 에 seed 실행용 Node/pnpm 툴체인 step 3 종을 ci.yml 핀과 동일하게 배선한다
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 245
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T07:30:00Z
independentStream: load-r91
dependsOn: [T-1658]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: "R-91 chain 41/N — seed step 배선의 선행 툴체인 slice: ci.yml 핀 parity 3 step + drift smoke, seed 실행 step 은 다음 slice."
---

# T-1659 — load-k6.yml 에 seed 실행용 Node/pnpm 툴체인 step 3 종 배선

## Why

오너 지시 ([PLAN.md](../PLAN.md) `144 행` "R-91 k6 최우선·즉시 착수") chain 의 41 번째 slice 다. 직전 slice T-1658 (main `609c937b`, PR #1326) 이 `scripts/seed-devset-logins.ts` entrypoint 와 `package.json` 의 `seed:devset-logins` 키까지 박아, **133 명 실 dataset seed 는 이제 셸 한 줄로 실행 가능**하다. 남은 것은 그 한 줄을 [`load-k6.yml`](../../.github/workflows/load-k6.yml) 이 부하 run 안에서 실제로 부르는 배선이다 ([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ① 의 실 dataset 축).

그런데 현재 `load-k6.yml` 에는 **Node 도, pnpm 도, `node_modules` 도 없다** — checkout 후 곧바로 docker build 를 하고 k6 정적 바이너리만 설치한다. `seed:devset-logins` 는 `ts-node` 와 `postinstall` 이 생성하는 Prisma client 를 runner 위에서 요구하므로, seed step 을 넣으려면 툴체인 설치가 먼저다.

본 slice 는 그 **선행 툴체인 3 step 만** 가져간다 — `ci.yml` `186~198 행` 이 이미 검증한 pin (pnpm `9.12.0` · Node `20` · `pnpm install --frozen-lockfile`) 을 **같은 step 이름·같은 값으로** 복제하고, 두 workflow 의 pin 이 갈리는 drift 를 smoke 로 못 박는다. 실제 seed 실행 step (`DATABASE_URL` 주입 + `pnpm seed:devset-logins`) 은 다음 slice 다 — 한 slice 에 합치면 drift-guard describe 가 커져 300 LOC cap 을 넘긴다 (T-1633 266 LOC · T-1640 249 LOC 선례).

## Required Reading

- [`.github/workflows/load-k6.yml`](../../.github/workflows/load-k6.yml) `49~57 행` — `steps:` 시작 · "저장소 checkout" · "부하 대상 이미지 빌드". **삽입 지점은 checkout 직후 · docker build 직전**.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) `186~198 행` — 복제 대상 **정본 3 step** (`pnpm 설치` / `Node.js 설치` / `의존성 설치`) 의 action 참조와 pin 값. 본 task 는 이 값을 그대로 쓴다 (새 값 창작 금지).
- [`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `14~168 행` — 공용 상수·helper (`CI_YML_PATH` · `extractStepBlock` · `extractKey` · `extractStep` · `stepIndexOf` · `lineIndexOf` · `unquote` · `loadYml` · `pkg`). **helper 재사용이 원칙** — 신설은 최대 1 개.
- 같은 파일 `363~425 행` — T-1620 negative 계약 (상시 트리거 유입 차단 · k6 npm dependency 금지 · 정리 step `if: always()`). 본 slice 가 **회귀시키면 안 되는 단언들**.
- [`package.json`](../../package.json) `27 행` 부근 — `seed:devset-logins` 키 (다음 slice 의 소비 대상. 본 slice 는 `package.json` 을 **변경하지 않는다**).
- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ① — 본 chain 이 겨냥하는 좌표 (실 dataset seed 축).

## Acceptance Criteria

- [ ] `load-k6.yml` 의 "저장소 checkout" step **직후, "부하 대상 이미지 빌드" step 직전** 에 step 정확히 3 개를 추가한다 — 이름은 `ci.yml` 과 동일 문자열 (`pnpm 설치` · `Node.js 설치` · `의존성 설치`), 값도 동일 (`pnpm/action-setup@v4` + `version: 9.12.0`, `actions/setup-node@v4` + `node-version: '20'` + `cache: 'pnpm'`, `run: pnpm install --frozen-lockfile`). 새 action · 새 dependency 도입 0.
- [ ] 각 step 에 그 존재 이유를 한국어 주석 1~3 줄로 남긴다 — "다음 slice 의 `pnpm seed:devset-logins` 가 runner 위 `ts-node` + `postinstall` 생성 Prisma client 를 요구한다" + "pin 은 `ci.yml` 정본을 복제한다" 취지. 기존 step 의 본문·순서·env 는 **변경 0**.
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 **T-1659 describe 1 블록**을 추가하고 아래 R-112 4 종을 모두 cover 한다:
  - [ ] **happy-path**: ① 3 step 이 `load-k6.yml` 에 실재하고 각각의 `uses` / `version` / `node-version` / `cache` / `run` 값이 기대값과 같다, ② 같은 이름의 `ci.yml` step 에서 뽑은 값과 **4 자 parity** (pnpm version · node-version · cache · install 커맨드) 가 성립한다, ③ 순서 단언 — `checkout < pnpm 설치 < Node.js 설치 < 의존성 설치 < k6 설치` 그리고 3 step 전부가 첫 `k6 run` step 보다 앞선다.
  - [ ] **error path**: ① 세 step 이 없는 합성 YAML 을 넣으면 helper 가 throw 하지 않고 미발견 정규형 (`null` / `found:false`) 을 돌려준다, ② step 은 있으나 대상 key 만 없는 합성 입력도 `null` 이다 (부분 drift 검출), ③ non-string 입력에 기존 helper 계약대로 `TypeError` 가 난다 (신설 helper 를 만들었다면 그 helper 도 동형).
  - [ ] **분기 cover**: ① `node-version: '20'` 처럼 따옴표가 있는 값과 없는 값 두 갈래를 `unquote` 가 같은 결과로 정규화한다, ② `uses` 만 있고 `run` 이 없는 action step 갈래와 `run` 만 있고 `uses` 가 없는 커맨드 step 갈래 각각 1+ test.
  - [ ] **negative cases 충분 cover**: ① 합성 mutation 으로 pnpm version 또는 node-version 을 바꾸면 `ci.yml` parity 단언이 깨진다 (원본은 대조군으로 무변경), ② `pnpm install` 이 `--frozen-lockfile` 없이 또는 `--no-frozen-lockfile` · `--force` 같은 lockfile 우회 flag 와 함께 쓰이지 **않는다**, ③ 툴체인 추가가 `pull_request` · `push` · `schedule` 트리거 유입을 동반하지 **않는다** (T-1620 negative (1) 계약 유지), ④ `package.json` 이 변경되지 않았고 k6 는 여전히 dependencies/devDependencies 어디에도 없다 (T-1620 negative (3) 계약 유지), ⑤ 새 step 이 `secrets.` 참조나 자격증명 env 를 주입하지 **않는다** (CLAUDE.md `§9`), ⑥ 기존 step 순서 (`build < boot < k6 설치 < smoke 실행 < S1 실행 < 요약 기록 < S2 < S3 < 정리`) 회귀 0 이고 정리 step 은 여전히 `if: always()` 다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 — 대상 drift-guard spec 의 기존 describe (T-1620~T-1645) 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 변동은 없어야 한다.

## Out of Scope

- **seed 실행 step 자체** (`DATABASE_URL` 주입 + `pnpm seed:devset-logins` 호출 + 그 drift 단언) — 다음 slice. 본 slice 는 툴체인만 깐다.
- `test/load/s1-batch.js` `setup()` 의 실 dataset 교체 — 그 다음 slice.
- **실제 workflow dispatch 금지** — 배선 후 실 run 을 태우고 `§3.1` 에 실측을 기록하는 것은 별도 slice.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke 3 종 T-0791/T-0944/T-0947 동반 갱신 → 5 파일 cap 초과, T-1122 BLOCKED / Q-0054 선례).
- `package.json` · `pnpm-lock.yaml` · `test/helpers/realdata-devset-seed-*.ts` · `scripts/*` · `src/` · Prisma schema 변경 금지.
- `ci.yml` 변경 금지 (본 slice 에서 `ci.yml` 은 **read only** 정본).
- `actions/checkout@v4` Node 20 deprecation 경고 해소 · `set -o pipefail` 등 shell 옵션 정책 (기존 Follow-ups) 은 섞지 않는다.
- `docs/ops/load-resilience-test-plan.md` · `PLAN.md` 진척 doc-sync 는 direct-mode 라 본 pr task 에 섞지 않는다 (CLAUDE.md `§3.1` rule 3).
- T-1658 reviewer MINOR 잔여 (`nest build` 가 `dist/test/helpers/**` 를 함께 emit) 처리 — 본 slice 와 무관, 별도 판단.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
