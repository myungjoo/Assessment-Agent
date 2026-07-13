---
id: T-0959
title: seed-llm-config.sh 내부 env-gating(SEED_LLM_ENDPOINT_URL 부재 no-op exit0 guard + set -euo pipefail 엄격모드 + SEED_LLM_* env-override 기본값 + LLM_APIKEY_ENC_KEY fail-fast + apiKey stdin-not-argv secret-safety + postgres/app bounded readiness polling) 계약 정적 smoke
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 400
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0956(daily-test bootstrap shell-strictness, 544 LOC)·T-0958(redeploy 내부 시퀀스, 420 LOC)·T-0955(step_redeploy invocation, 360 LOC) 동형. R-112 4종 cover 위한 다수 assert(no-op guard·strict-mode·6종 env-override 기본값·enc-key fail-fast·2종 bounded polling·stdin-not-argv·negative mutant a~f) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·seed-llm-config.sh 미변경."
independentStream: realdata-e2e-seed-llm-config-env-gating-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts]
created: 2026-07-13
plannerNote: "P5 §109 step③ — redeploy.sh 가 조건부 호출하는 seed-llm-config.sh 의 미봉 표면 = 내부 env-gating. T-0958(redeploy 가 seed 를 호출·비치명 계속하는 배선)·T-0794(seed SQL↔schema/cipher parity)는 봉했으나 seed 자신의 no-op guard·strict-mode·SEED_LLM_* 기본값·enc-key fail-fast·stdin-not-argv·bounded readiness 는 미봉."
---

# T-0959 — seed-llm-config.sh 내부 env-gating + no-op guard + strict-mode + env-override 기본값 + enc-key fail-fast + stdin secret-safety + bounded readiness 계약 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 하나씩 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958)에서, redeploy.sh 가 재배포 직후 **조건부로 호출**(`if [ -f seed ]` guard + `|| echo` 비치명 계속, T-0958 로 봉함)하는 callee 스크립트 `deploy/seed-llm-config.sh`(116행)의 **내부 env-gating 계약**은 아직 미봉이다. 기존 seed smoke 는 상보적 다른 표면만 봉했다 — T-0794(`realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift`)는 seed 의 INSERT 7-컬럼 ↔ Prisma `LlmProviderConfig` scalar parity·ON CONFLICT 멱등 update set·compiled cipher require-path ↔ tsconfig outDir·cipher class/method parity 만 봉했다(SQL/cipher artifact 정합). seed-llm-config.sh 자신의 **env-gating orchestration**(`set -euo pipefail` 엄격모드 → `cd $REPO_DIR` → `.env` 로드(`set -a`/`. ./.env`/`set +a`) → `SEED_LLM_ENDPOINT_URL` 비면 즉시 no-op exit 0 → `SEED_LLM_*` env-override 기본값(PROVIDER→custom·MODEL→gemma4:12b·API_KEY→ollama·CONFIG_ID→seed-local-llm) → `LLM_APIKEY_ENC_KEY` 부재 시 fail-fast exit 1 → postgres/app 컨테이너 bounded readiness polling(30회×2s ~60s) → apiKey 를 **argv 아닌 stdin 으로** 전달(`ps` 노출 회피, §9) → ciphertext 비면 exit 1)은 어느 smoke 도 봉하지 않았다. 이 gating 이 변질되면(예: no-op guard 소실로 endpoint 미설정인 공용 환경에서 seed 가 폭주 / enc-key fail-fast 소실로 평문 upsert / apiKey 가 argv 로 새 `ps` 노출) 무인 야간 seed 가 잘못된 상태로 진행돼 stage LLM config 가 조용히 오염되거나 credential 이 누출된다. 본 task 는 그 내부 env-gating 을 정적 앵커로 봉해 nightly runner seed leg 을 완결한다(PLAN.md 109행 step③ 로컬 Ollama seed 배선).

## Required Reading

- `deploy/seed-llm-config.sh` 전체(1~116행 — `set -euo pipefail`·`REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"`+`cd`·`.env` 로드(`if [ -f .env ]; then set -a; . ./.env; set +a; fi`)·`ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"`+no-op guard(`if [ -z "$ENDPOINT" ]; then echo ...; exit 0; fi`)·6종 env-override 기본값(SEED_LLM_PROVIDER→custom / SEED_LLM_MODEL_ID→gemma4:12b / SEED_LLM_API_KEY→ollama / SEED_LLM_CONFIG_ID→seed-local-llm / POSTGRES_USER / POSTGRES_DB)·`LLM_APIKEY_ENC_KEY` fail-fast(`if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]; then ...; exit 1; fi`)·postgres/app bounded polling(`for _ in $(seq 1 30); do ...; sleep 2; done`+`[ "$ready" = 1 ] || { ...; exit 1; }`)·apiKey stdin 전달(`printf '%s' "$APIKEY_PLAIN" | docker compose exec -T -e LLM_APIKEY_ENC_KEY=... app node -e ...`)·ciphertext 비면 exit 1 포함).
- `test/smoke/realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts` — 형제 T-0956 shell-strictness + env-override 기본값 해석 정적 smoke 패턴(readFileSync 정적 추출·`${VAR:-default}` 파싱·mutant 합성 drift-detection). 단 daily-test.sh 는 errexit **OFF**, seed-llm-config.sh 는 `set -euo pipefail` = errexit **ON**(redeploy.sh 와 동형·대조 주의) — 재구현 0, 모델링만 참조.
- `test/smoke/realdata-e2e-redeploy-internal-step-sequence-strict-mode-reset-hard-mirror-idempotency-nonfatal-seed-continuation-contract.smoke-spec.ts` — 형제 T-0958 redeploy 내부 시퀀스 smoke. redeploy.sh 가 seed 를 **호출·비치명 계속**하는 caller 측 계약이라 본 task(seed **자신**의 내부 env-gating)와 distinct 상보.
- `test/smoke/realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts` — 형제 T-0794 seed SQL↔schema/cipher parity smoke. INSERT 컬럼·ON CONFLICT·cipher require-path/API artifact 정합이라 본 task(env-gating orchestration)와 distinct — 재구현/변경 0.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts` 신설. `deploy/seed-llm-config.sh` 를 `readFileSync` 로 읽어 env-gating 토큰을 정적 추출한다(실행/source/실 docker/psql/node 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0956/T-0958 패턴).
- [ ] **Happy-path**: seed-llm-config.sh 내부 계약 불변식 각각에 대해 성공 assert 1+ —
  - `set -euo pipefail` 존재(errexit `-e` ON — nounset·pipefail·errexit 모두 ON, redeploy.sh 와 동형),
  - `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` env-override 기본값 + `cd "$REPO_DIR"`,
  - `.env` 조건부 로드 블록(`if [ -f .env ]` guard + `set -a` → `. ./.env`(source) → `set +a` — auto-export 3-token 시퀀스),
  - **no-op guard**: `ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"` + `if [ -z "$ENDPOINT" ]` → `exit 0`(SEED_LLM_ENDPOINT_URL 미설정 시 즉시 무해 종료 — 공용 repo/타 환경 폭주 방지),
  - **6종 env-override 기본값** 매핑(값·env 이름): `SEED_LLM_PROVIDER:-custom`, `SEED_LLM_MODEL_ID:-gemma4:12b`, `SEED_LLM_API_KEY:-ollama`, `SEED_LLM_CONFIG_ID:-seed-local-llm`, `POSTGRES_USER:-assessment_agent`, `POSTGRES_DB:-assessment_agent`,
  - **enc-key fail-fast**: `if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]` → `exit 1`(암호화 키 부재 시 평문 upsert 대신 실패),
  - **bounded readiness polling** 2종(postgres·app): `for _ in $(seq 1 30)` 반복 + `sleep 2` + `[ "$ready" = 1 ] || { ...; exit 1; }`(무한 hang 방지 + 미준비 시 fail-fast),
  - **apiKey stdin 전달**: `printf '%s' "$APIKEY_PLAIN" | docker compose exec -T ... node -e`(평문 apiKey 가 argv 아닌 stdin 파이프로 전달 — 컨테이너 `ps` 노출 회피 §9) + enc-key 를 `-e LLM_APIKEY_ENC_KEY=` 로 컨테이너 주입,
  - ciphertext 비면 fail-fast: `if [ -z "$CIPHERTEXT" ]` → `exit 1`.
- [ ] **no-op vs fail-fast exit-code 분기 계약**: SEED_LLM_ENDPOINT_URL 부재는 `exit 0`(정상 no-op), LLM_APIKEY_ENC_KEY 부재는 `exit 1`(실패)임을 각각 단언하는 assert 1+ (두 미설정 상황의 exit-code 방향이 반대임을 검출 — no-op 이 실패로, fail-fast 가 성공으로 변질되지 않게).
- [ ] **stdin-not-argv secret-safety 계약**: 평문 apiKey(`$APIKEY_PLAIN`)가 `docker compose exec` 의 **argv 위치가 아닌 stdin 파이프**(`printf ... | ...`)로만 전달됨을 단언하는 assert 1+ (argv 로 넘기면 `ps` 노출되므로 — §9 credential-safety 회귀 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match 단언 각 1+ (최소 a~f 6종):
  - (a) `set -euo pipefail` 을 `set -uo pipefail`(errexit 제거)로 바꾼 mutant → strict-mode(errexit ON) 계약 위반 검출,
  - (b) no-op guard(`if [ -z "$ENDPOINT" ]; then ... exit 0`)를 제거한 mutant → endpoint 미설정 무해-종료 계약 소실 검출,
  - (c) `SEED_LLM_MODEL_ID:-gemma4:12b` 의 기본값을 다른 값으로 바꾼 mutant → env-override 기본값 정합 위반 검출,
  - (d) enc-key fail-fast(`if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]; then ... exit 1`)를 제거한 mutant → 암호화 키 부재 시 평문 upsert 방지 계약 소실 검출,
  - (e) apiKey 전달을 stdin(`printf ... | docker ... node`)에서 argv 위치(예: `... node -e ... "$APIKEY_PLAIN"`)로 옮긴 mutant → stdin-not-argv secret-safety 위반 검출,
  - (f) bounded polling(`for _ in $(seq 1 30)` + `sleep 2` + `[ "$ready" = 1 ] || exit 1`)에서 fail-fast(`|| ... exit 1`)를 제거한 mutant → 무한/미준비 방치 계약 소실 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 토큰/secret/password/실 endpoint IP 가 등장하지 않음(env 이름·기본값 리터럴·git/docker/psql 명령 토큰만)을 단언하는 test 1+. `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. (기본값 `ollama`·`gemma4:12b`·`custom`·`seed-local-llm` 은 실 credential 아닌 무해 placeholder — 이들은 허용, 실 API key/password 형태 문자열만 금지.)
- [ ] **Flow/branch cover**: `.env` 존재-분기(`if [ -f .env ]`)·no-op guard true 분기·enc-key fail-fast 분기·readiness ready/미ready 분기를 각 test 로 분리. 분기 없는 항목은 "분기 없음 — 생략" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 docker/psql/node/네트워크/컨테이너 0, `deploy/seed-llm-config.sh` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/seed-llm-config.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0794(seed INSERT 컬럼 ↔ Prisma schema scalar parity·ON CONFLICT 멱등·cipher require-path/class·tsconfig outDir) smoke 재구현/변경 0 — SQL/cipher artifact 정합 vs 본 task 의 env-gating orchestration 은 distinct 상보 표면.
- T-0958(redeploy.sh 가 seed 를 조건부 호출·`|| echo` 비치명 계속하는 배선) smoke 재구현/변경 0 — caller 측 vs 본 task 의 callee 내부 env-gating 은 distinct.
- `src/llm/llm-apikey-cipher.service.ts`(AES-256-GCM envelope) 내부 암호화 로직 재검증 0 — 기존 cipher unit/parity smoke 소관. 본 task 는 seed 가 cipher 를 **stdin 으로 안전 호출**하는 배선 계약만.
- `deploy/env.prod.example`·`docker-compose.yml`·`deploy/redeploy.sh` 내부 계약 재검증 0(각 기존 smoke 소관).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)

## Result

- **Status: DONE** (2026-07-13T15:03Z, PR [#853](https://github.com/myungjoo/Assessment-Agent/pull/853) squash 머지 `c9e7a503`).
- test-only 단일 smoke-spec `test/smoke/realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts` 신설 (+628/-0, 30 케이스). `deploy/seed-llm-config.sh` 미변경, production 0 LOC.
- `readFileSync` 정적 추출로 strict-mode(errexit ON)·REPO_DIR/6종 env-override 기본값·.env 조건부 3-token 로드·no-op guard(exit0)·enc-key fail-fast(exit1)·bounded polling 2종·apiKey stdin-not-argv·ciphertext fail-fast 불변식을 pure 함수로 앵커. no-op(exit0) vs fail-fast(exit1) exit-code 분기·stdin-not-argv secret-safety·negative mutant a~f·원본 read-only·§9 secret-safety·flow/branch cover 전부 assert.
- reviewer round 1/7 APPROVE (0 BLOCKER / 0 MAJOR / 1 informational MINOR — sizeExempt overrun 문서화, nit-closure 불요). 4-게이트 PASS. `pnpm lint && pnpm build && pnpm test:cov` green, coverageThreshold 무회귀.
- fineGrainedConcurrency stage5b claim-pickup fire (cron@aa-local-1955-5379). daily-test(T-0944~T-0957)·redeploy 내부(T-0958)·seed-llm-config env-gating(T-0959) 봉함으로 nightly runner seed leg 완결. next: T-0960(docker-entrypoint.sh 내부 부팅 시퀀스 정적 smoke).
