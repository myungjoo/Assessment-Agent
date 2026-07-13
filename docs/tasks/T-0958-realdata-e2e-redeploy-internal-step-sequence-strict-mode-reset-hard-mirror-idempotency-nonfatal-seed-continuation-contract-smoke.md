---
id: T-0958
title: redeploy.sh 내부 재배포 단계-시퀀스(fetch→checkout→reset-hard mirror→up--build→seed-guard→prune→ps) + set -euo pipefail 엄격모드 + 비치명 seed 계속 계약 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 420
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0955(step_redeploy invocation, 360 LOC)·T-0956(bootstrap, 544 LOC)·T-0797(redeploy orchestration parity) 동형. R-112 4종 cover 위한 다수 assert(ordered 7-step 시퀀스·strict-mode·reset-hard mirror·비치명 seed·negative mutant a~e) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·redeploy.sh 미변경."
independentStream: realdata-e2e-redeploy-internal-step-sequence-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-redeploy-internal-step-sequence-strict-mode-reset-hard-mirror-idempotency-nonfatal-seed-continuation-contract.smoke-spec.ts]
created: 2026-07-13
plannerNote: "P5 §109 step①/④ — daily-test.sh 계약 chain(T-0944~T-0957) 완결 뒤 nightly runner 가 호출하는 redeploy.sh 의 미봉 표면 = 내부 ordered 재배포 시퀀스. T-0797(outer artifact parity)·T-0955(caller invocation)는 봉했으나 redeploy.sh 자신의 fetch→reset-hard mirror→build→seed-guard→prune 순서·strict-mode·비치명 seed 계속은 미봉."
---

# T-0958 — redeploy.sh 내부 재배포 단계-시퀀스 + strict-mode + 비치명 seed 계속 계약 정적 smoke

## Why

`deploy/daily-test.sh` 계약 표면을 하나씩 봉해온 chain(T-0944~T-0957)이 완결됐다(eval/collect/rediscovery run-leg 삼형제 + 머신 JSON + gating + 서두 bootstrap 전량 봉함). 그 무인 nightly runner 가 `step_redeploy()`(T-0955 로 봉함)에서 실제로 호출하는 재배포 스크립트 `deploy/redeploy.sh`(43행)의 **내부 ordered 재배포 단계-시퀀스**는 아직 미봉이다. 기존 두 redeploy smoke 는 상보적 다른 표면만 봉했다 — T-0797(`redeploy-orchestration-entrypoint-contract`)은 redeploy.sh ↔ systemd `.service`/`.timer`/compose **artifact parity**(ExecStart triple-match·경로 실존)만, T-0955(`step-redeploy-invocation`)은 daily-test.sh 가 redeploy.sh 를 **호출하는 배선**(env-thread·redirect·return)만 봉했다. redeploy.sh 자신의 **내부 orchestration 시퀀스**(`set -euo pipefail` 엄격모드 → `cd $REPO_DIR` → `git fetch --prune origin` → `git checkout $BRANCH` → `git reset --hard origin/$BRANCH`(mirror 멱등 정렬) → `docker compose up -d --build` → 조건부 `if [ -f seed ]` seed + `|| echo`(비치명 계속) → `docker image prune -f` → `docker compose ps`)는 어느 smoke 도 봉하지 않았다(origin/main 확인 — ordered 시퀀스 assert NONE). 이 순서가 reorder(예: prune 이 build 앞으로) / strict-mode 누락 / reset-hard→reset-soft 변질 / seed 비치명 continuation(`|| echo`) 소실로 정본과 silent 분기하면, 무인 야간 재배포가 잘못된 상태(빌드 전 prune·drift 미복구·seed 실패가 재배포를 깨뜨림)로 진행돼 stage 앱이 조용히 stale/broken 배포가 된다. 본 task 는 그 내부 시퀀스를 정적 앵커로 봉해 nightly runner 재배포 leg 을 완결한다(PLAN.md 109행 step①/④ realdata-e2e nightly runner).

## Required Reading

- `deploy/redeploy.sh` 전체(1~44행 — `set -euo pipefail`(5행)·REPO_DIR/BRANCH 기본값(8~9행)·`cd`(11행)·fetch/checkout/reset-hard(14/15/18행)·`docker compose up -d --build`(23행)·조건부 seed `if [ -f ]`+`|| echo`(31~34행)·`docker image prune -f`(40행)·`docker compose ps`(43행) 포함).
- `test/smoke/redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts` — 형제 T-0797 redeploy artifact-parity smoke 패턴(readFileSync 정적 추출·repo-root __dirname 해석·합성 mutate 사본 drift-detection·credential 누출 0 구조). 본 task 는 그와 상보(내부 시퀀스 vs outer parity) — 재구현/변경 0.
- `test/smoke/realdata-e2e-daily-test-step-redeploy-invocation-repo-dir-env-thread-log-redirect-append-stdout-purity-return-code-contract.smoke-spec.ts` — 형제 T-0955 step_redeploy invocation smoke(caller 측 배선) 참조 — redeploy.sh 를 **호출하는** 계약이라 본 task(redeploy.sh **내부** 시퀀스)와 distinct.
- `test/smoke/realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts` — T-0956 shell-strictness 동형 모델링(단, daily-test.sh 는 errexit **OFF**, redeploy.sh 는 `set -euo pipefail` = errexit **ON** — 반대 계약이므로 대조 주의) 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-redeploy-internal-step-sequence-strict-mode-reset-hard-mirror-idempotency-nonfatal-seed-continuation-contract.smoke-spec.ts` 신설. `deploy/redeploy.sh` 를 `readFileSync` 로 읽어 재배포 orchestration 토큰을 정적 추출한다(실행/source/실 git/docker/seed 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0797 패턴).
- [ ] **Happy-path**: redeploy.sh 내부 계약 불변식 각각에 대해 성공 assert 1+ —
  - `set -euo pipefail` 존재(errexit `-e` ON — daily-test.sh 와 **반대**: nounset·pipefail·errexit 모두 ON),
  - `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` + `BRANCH="${DEPLOY_BRANCH:-main}"` env-override 기본값(값·env 이름 매핑 DEPLOY_BRANCH→BRANCH),
  - **ordered step-sequence**(정본 순서대로 등장): `cd "$REPO_DIR"` → `git fetch --prune origin` → `git checkout "$BRANCH"` → `git reset --hard "origin/${BRANCH}"` → `docker compose up -d --build` → seed 조건블록 → `docker image prune -f` → `docker compose ps`(각 토큰의 소스 내 index 가 단조 증가함을 assert),
  - `git reset --hard "origin/${BRANCH}"` mirror 멱등 정렬(reset **--hard** 이며 대상이 `origin/$BRANCH` — drift 복구 계약),
  - 조건부 seed: `if [ -f "$REPO_DIR/deploy/seed-llm-config.sh" ]` guard + `REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/seed-llm-config.sh"` 호출 + `|| echo`(비치명 continuation — seed 실패가 재배포를 깨지 않음),
  - seed 호출 경로 suffix(`deploy/seed-llm-config.sh`)가 repo-root 기준 실 파일로 실존(`fs.existsSync` — 오타·dangling 방지).
- [ ] **비치명 seed continuation 계약**: `set -e` 가 ON 인데도 seed 라인이 `|| echo ...`(또는 `|| true` 계열)로 감싸져 seed 실패 시 스크립트가 중단되지 않고 계속됨을 단언하는 assert 1+ (errexit-ON 하에서 seed 만 예외적 non-fatal 임을 검출).
- [ ] **prune-after-build 순서 계약**: `docker image prune -f`(40행)가 `docker compose up -d --build`(23행) **뒤**에 옴을 단언하는 assert 1+ (prune 이 build 를 앞지르면 방금 만든 이미지가 정리될 위험 — 순서 뒤집힘 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match 단언 각 1+ (최소 a~e 5종):
  - (a) `set -euo pipefail` 을 `set -uo pipefail`(errexit 제거) 로 바꾼 mutant → strict-mode 계약 위반 검출(daily-test.sh 와 혼동 방지),
  - (b) `git reset --hard` 를 `git reset --soft` 로 바꾼 mutant → mirror 멱등 계약 위반 검출,
  - (c) `docker image prune -f` 를 `docker compose up -d --build` **앞**으로 옮긴 mutant → ordered-index 단조성 false(순서 뒤집힘 검출),
  - (d) seed 라인의 `|| echo ...` 를 제거한 mutant → 비치명 continuation 계약 위반 검출(seed 실패가 재배포를 깨뜨림),
  - (e) seed 호출 경로를 `deploy/seed-renamed.sh` 로 바꾼 mutant → `existsSync` false(dangling 경로 검출).
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 토큰/secret/password/실 endpoint 가 등장하지 않음(경로·git·docker 명령·env 이름만)을 단언하는 test 1+. `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만.
- [ ] **Flow/branch cover**: seed 조건블록의 존재-분기(`if [ -f ]` true 경로)·strict-mode 있음/없음 mutant 분기·prune 순서 정상/뒤집힘 분기를 각 test 로 분리. redeploy.sh 는 seed guard 외 명시 분기 최소 — 분기 없는 항목은 "분기 없음 — 생략" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 git/docker/seed/systemd/네트워크 0, `deploy/redeploy.sh` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/redeploy.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0797(redeploy ↔ service/timer/compose artifact parity) smoke 재구현/변경 0 — outer 배선 vs 본 task 의 내부 시퀀스는 distinct 상보 표면.
- T-0955(daily-test.sh step_redeploy() 가 redeploy.sh 를 호출하는 배선) smoke 재구현/변경 0 — caller 측 vs 본 task 의 callee 내부는 distinct.
- `deploy/seed-llm-config.sh` 자신의 내부 SQL/cipher/upsert 로직 재검증 0(`seed-llm-config-sql-cipher` 등 기존 seed smoke 소관) — 본 task 는 redeploy.sh 가 seed 를 **호출·비치명 계속**하는 계약만.
- `docker-compose.yml`·docker-entrypoint.sh 내부 계약 재검증 0(기존 compose/entrypoint smoke 소관).
- systemd `.service`/`.timer` 스케줄 계약 재검증 0(T-0797 소관).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
