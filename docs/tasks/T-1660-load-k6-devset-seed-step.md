---
id: T-1660
title: load-k6.yml 에 133 로그인 실 dataset seed 실행 step 을 배선한다
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T09:30:00Z
independentStream: load-r91
dependsOn: [T-1659]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: "R-91 chain 42/N — T-1659 툴체인 위에 실 seed 실행 step 1 개 배선 + drift smoke. s1-batch.js dataset 교체는 다음 slice."
---

# T-1660 — load-k6.yml 에 133 로그인 실 dataset seed 실행 step 배선

## Why

오너 지시 ([PLAN.md](../PLAN.md) `144 행` "R-91 k6 최우선·즉시 착수") chain 의 42 번째 slice 다. 앞선 두 slice 가 실행 조건을 모두 갖췄다 — T-1658 (main `609c937b`) 이 `scripts/seed-devset-logins.ts` entrypoint 와 `package.json` 의 `seed:devset-logins` 키를 박았고, T-1659 (main `f9da3e7f`) 가 [`load-k6.yml`](../../.github/workflows/load-k6.yml) 에 pnpm · Node 20 · `pnpm install --frozen-lockfile` 툴체인 3 step 을 깔았다. 그런데 **아직 아무도 그 seed 를 부르지 않는다** — 부하 run 은 여전히 빈 DB 위에서 k6 스크립트의 자체 `setup()` 만으로 돈다.

본 slice 는 그 마지막 한 줄을 배선한다: 부하 대상 컨테이너 기동 직후 · k6 설치 직전에 `pnpm seed:devset-logins` 를 실행하는 step 1 개. 순서가 boot 뒤여야 하는 이유는 [`deploy/docker-entrypoint.sh`](../../deploy/docker-entrypoint.sh) `13~14 행` 이 `prisma migrate deploy` 로 스키마를 만들기 때문이다 — 그 전에 seed 를 부르면 테이블이 없어 실패한다. 이로써 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ① (실 dataset 축) 의 **적재 경로가 워크플로 안에서 닫힌다**. 남은 것은 k6 스크립트가 그 적재된 인원을 실제로 겨냥하게 바꾸는 일 ([`test/load/s1-batch.js`](../../test/load/s1-batch.js) `setup()` 교체) 인데, 그건 다음 slice 다 — 한 slice 에 합치면 drift-guard describe 가 커져 300 LOC cap 을 넘긴다 (T-1659 298 LOC · T-1633 266 LOC 선례).

## Required Reading

- [`.github/workflows/load-k6.yml`](../../.github/workflows/load-k6.yml) `69~116 행` — "의존성 설치"(T-1659 마지막 툴체인 step) · "부하 대상 이미지 빌드" · "부하 대상 컨테이너 기동 + readiness polling" · "k6 설치". **삽입 지점은 기동 polling step 직후 · "k6 설치" 직전**.
- 같은 파일 `88~95 행` — `docker run` 의 `-e DATABASE_URL=...` 연결 문자열 리터럴. 본 slice 의 seed step 이 주입할 `DATABASE_URL` 은 **이 값과 문자 그대로 같아야** 한다 (한쪽만 바뀌면 seed 가 다른 DB 를 채운다).
- [`deploy/docker-entrypoint.sh`](../../deploy/docker-entrypoint.sh) `13~14 행` — `prisma migrate deploy`. seed step 이 boot 이후여야 하는 근거.
- [`package.json`](../../package.json) `27 행` — `seed:devset-logins` 키. seed step 의 `run` 은 이 키를 경유한다 (`ts-node` 직접 호출 금지). 본 slice 는 `package.json` 을 **변경하지 않는다**.
- [`scripts/seed-devset-logins.ts`](../../scripts/seed-devset-logins.ts) `6~13 행` — 사용법 주석 (`DATABASE_URL=<...> pnpm seed:devset-logins`, exit 0/1).
- [`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `14~168 행` — 공용 상수·helper (`LOAD_YML_PATH` · `PKG_JSON_PATH` · `extractStepBlock` · `extractKey` · `extractStep` · `stepIndexOf` · `unquote` · `loadYml` · `pkg`). **helper 재사용이 원칙 — 신설은 최대 1 개**.
- 같은 파일 `2683~2957 행` — T-1659 describe (툴체인 3 step 상수 · parity 단언). 본 slice 가 회귀시키면 안 되는 선행 계약이며, 새 describe 는 그 **뒤에 append** 한다.
- 같은 파일 `363~434 행` — T-1620 negative 계약 (상시 트리거 유입 차단 · k6 npm dependency 금지 · 정리 step `if: always()`). 역시 회귀 0 이어야 한다.

## Acceptance Criteria

- [ ] `load-k6.yml` 의 "부하 대상 컨테이너 기동 + readiness polling" step **직후, "k6 설치" step 직전** 에 seed 실행 step 정확히 1 개를 추가한다 — 이름은 `133 로그인 실 dataset seed 적재`, `env.DATABASE_URL` 은 같은 파일 `docker run` 의 `-e DATABASE_URL=` 값과 **문자 그대로 동일한** 연결 문자열, `run` 은 `pnpm seed:devset-logins` 한 줄. 새 action · 새 dependency · 새 `package.json` 키 도입 0.
- [ ] 그 step 에 존재 이유를 한국어 주석 2~4 줄로 남긴다 — ① boot 이후여야 하는 이유 (`docker-entrypoint.sh` 의 `prisma migrate deploy` 가 스키마를 만든다), ② k6 실행보다 앞서야 하는 이유 (부하가 실 dataset 위에서 돌아야 한다), ③ `DATABASE_URL` 은 CI 전용 더미 자격증명이며 `docker run` 리터럴과 같은 값이라는 점. 기존 step 의 본문·순서·env 는 **변경 0**.
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 끝에 **T-1660 describe 1 블록**을 추가하고 아래 R-112 4 종을 모두 cover 한다 (케이스 총량 ≤ 12 — T-1659 가 14 케이스에 298 LOC 로 cap 에 근접했다):
  - [ ] **happy-path**: ① seed step 이 실재하고 `run` 이 정확히 `pnpm seed:devset-logins` 이며 그 스크립트 키가 `package.json` 에 존재한다 (workflow ↔ package.json parity), ② seed step 의 `DATABASE_URL` 이 `docker run` 의 `-e DATABASE_URL=` 값과 문자열 동일, ③ 순서 단언 — `의존성 설치 < 부하 대상 이미지 빌드 < 기동 polling < seed < k6 설치` 이고 seed 가 세 k6 실행 step (`smoke` · `S1` · `S2`/`S3`) 전부보다 앞선다.
  - [ ] **error path**: ① seed step 이 없는 합성 YAML 에서 helper 가 throw 하지 않고 미발견 정규형 (`null` / `found:false`) 을 돌려준다, ② step 은 있으나 `env` 또는 `run` 키만 없는 합성 입력도 `null` 이다 (부분 drift 검출), ③ non-string 입력에 기존 helper 계약대로 `TypeError` 가 난다 (신설 helper 를 만들었다면 그 helper 도 동형).
  - [ ] **분기 cover**: ① `DATABASE_URL` 값의 따옴표 유무 두 갈래를 `unquote` 가 같은 결과로 정규화한다, ② `env` 를 가진 step 갈래와 `env` 없는 step 갈래 (`k6 설치` 등) 각각 1+ test.
  - [ ] **negative cases 충분 cover**: ① 합성 mutation 으로 seed step 을 `k6 설치` 뒤로 옮기거나 `DATABASE_URL` 한쪽만 바꾸면 위 단언이 깨진다 (원본은 대조군으로 무변경), ② seed step 이 `if: always()` · `continue-on-error: true` 를 갖지 **않는다** (seed 실패가 조용히 통과하면 빈 DB 위 측정치가 baseline 으로 박힌다), ③ `run` 이 `ts-node` · `npx` · `node ` 직접 호출로 `package.json` 키를 우회하지 **않는다**, ④ seed step 이 `secrets.` 참조나 신규 자격증명 env 를 도입하지 **않는다** (CLAUDE.md `§9` — 값은 기존 CI 더미 재사용), ⑤ 본 배선이 `pull_request` · `push` · `schedule` 트리거 유입을 동반하지 **않는다** (T-1620 negative (1) 계약 유지), ⑥ `package.json` 이 변경되지 않았고 k6 는 여전히 dependencies/devDependencies 어디에도 없다 (T-1620 negative (3) 계약 유지), ⑦ T-1659 툴체인 3 step (`pnpm 설치` · `Node.js 설치` · `의존성 설치`) 이 여전히 seed step 보다 앞이고 pin 값 회귀 0, ⑧ 기존 step 순서 (`build < boot < k6 설치 < smoke < S1 < 요약 기록 < S2 < S3 < 정리`) 회귀 0 이며 정리 step 은 여전히 `if: always()` 다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 — 대상 drift-guard spec 의 기존 describe (T-1620~T-1659) 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 변동은 없어야 한다.
- [ ] 최종 diff ≤ 300 LOC · 2 파일. cap 근접 시 negative 케이스를 세분화하지 말고 한 `it` 안에서 `forEach` 로 묶는다.

## Out of Scope

- **`test/load/s1-batch.js` `setup()` 의 실 dataset 교체** — seed 로 적재된 133 인원을 k6 가 실제로 겨냥하게 만드는 일은 다음 slice.
- **실제 workflow dispatch 금지** — 배선 후 실 run 을 태우고 `§3.1` 에 실측을 기록하는 것은 별도 slice.
- seed 적재분의 teardown / 정리 step 추가 (부하 run 은 매번 새 컨테이너·새 DB 라 현재 불요).
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke 3 종 T-0791/T-0944/T-0947 동반 갱신 → 5 파일 cap 초과, T-1122 BLOCKED / Q-0054 선례).
- `package.json` · `pnpm-lock.yaml` · `test/helpers/realdata-devset-seed-*.ts` · `scripts/*` · `src/` · Prisma schema · `ci.yml` 변경 금지.
- `docs/ops/load-resilience-test-plan.md` · `PLAN.md` 진척 doc-sync 는 direct-mode 라 본 pr task 에 섞지 않는다 (CLAUDE.md `§3.1` rule 3).
- T-1658 reviewer MINOR 잔여 (`nest build` 가 `dist/test/helpers/**` 를 함께 emit) 처리 · `actions/checkout@v4` deprecation 경고 해소 · shell `set -o pipefail` 정책 — 본 slice 와 무관.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 기록

- **Status: DONE** — 2026-08-23T10:54:34Z (PR **#1328** squash merge → main `73100c77`, branch 삭제).
- 결과: [`load-k6.yml`](../../.github/workflows/load-k6.yml) `113~122 행` 에 seed 실행 step `133 로그인 실 dataset seed 적재` 1 개를 기동 polling 직후 · k6 설치 직전에 배선했다. `env.DATABASE_URL` 은 같은 파일 `docker run` 의 `-e DATABASE_URL=` 리터럴과 문자 그대로 동일하고, `run` 은 `pnpm seed:devset-logins` 한 줄이다 (`ts-node` 직접 호출 우회 0 · 새 action / dependency / `package.json` 키 0 · 기존 step 본문 · 순서 · env 변경 0). 존재 이유 주석은 boot 이후 조건 (`docker-entrypoint.sh` 의 `prisma migrate deploy`) · k6 선행 조건 · CI 더미 자격증명 3 항목을 담았다.
- 검증: drift-guard smoke 에 T-1660 describe 12 케이스 (happy 3 · error 3 · 분기 2 · negative 4) 추가, 신설 helper 는 `envKeysOf` 1 개뿐. 대상 spec 190 케이스 green (기존 178 회귀 0), 전체 453 suite / 12980 test pass, lint · build · `test:cov` 통과. `src/` 무변경이라 전역 coverage 수치 변동 0. 최종 diff **+294/-0 · 2 파일** (cap 300 LOC / 2 파일 이내). reviewer round 1 `APPROVE` (BLOCKER · MAJOR · MINOR 0) 를 PR 코멘트로 외화 — §3.3 4-게이트 충족.
- 남은 일 (본 slice Out of Scope 그대로): ① [`test/load/s1-batch.js`](../../test/load/s1-batch.js) `setup()` 을 적재된 133 인원 실 dataset 으로 교체, ② 실 workflow dispatch 후 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 실측 기록, ③ 같은 문서 `§5` item 5 진척 doc-sync (direct-mode).
