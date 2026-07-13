---
id: T-0964
title: env.prod.example 내부 env 템플릿 single-source 계약(필수 active 키 존재 + 시크릿 보유 키 placeholder-safety + 선택 gated 키 주석-규율 + DATABASE_URL 내부 credential parity + SEED_LLM_* 키셋 seed-llm-config.sh 소비셋 parity) 정적 smoke
phase: P5
status: DONE
mergedAs: ed10aff2
prNumber: 858
reviewRounds: 1
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 420
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0963(Dockerfile 내부 멀티스테이지, 460 LOC)·T-0962(docker-compose 내부 오케스트레이션, 420 LOC)·T-0961(systemd unit 내부 directive, 642 LOC)·T-0959(seed-llm-config env-gating, 628 LOC) 동형. R-112 4종 cover 위한 다수 assert(필수 active 키 6종 존재·placeholder-safety 2종·선택 gated 주석-규율 9종·DATABASE_URL 내부 credential parity·SEED_LLM_* 키셋 cross-artifact parity·negative mutant a~g 7종) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·env.prod.example/seed-llm-config.sh 미변경."
independentStream: realdata-e2e-env-prod-example-internal-template-single-source-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §109 재배포 runner chain 의 env single-source leg — env.prod.example 내부 템플릿 계약 미봉. 기존 T-0795 parity(PORT/POSTGRES_USER/DB/DATABASE_URL host:port 4중 정합)는 cross-artifact 값만 봉함(placeholder-safety·필수 active 키 존재·선택 gated 주석-규율·SEED_LLM_* 키셋 parity 미봉, grep 확인 line 41~42 명시 미포함). compose/entrypoint/systemd/Dockerfile parity→internal split(T-0960~T-0963)과 동형."
---

# T-0964 — env.prod.example 내부 env 템플릿 single-source 계약(필수 active 키 존재 + placeholder-secret-safety + 선택 gated 키 주석-규율 + DATABASE_URL 내부 credential parity + SEED_LLM_* 키셋 seed-llm-config.sh 소비셋 parity) 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh 내부 부팅: T-0960, systemd unit 내부 directive: T-0961, docker-compose.yml 내부 오케스트레이션: T-0962, Dockerfile 내부 멀티스테이지 빌드: T-0963)에서, 그 스택 전체가 **런타임에 소비하는 설정의 정본(single-source)** 인 `deploy/env.prod.example` 의 **내부 env 템플릿 계약** 은 아직 미봉이다. `docker-compose.yml`(T-0962 봉함)의 `env_file` 이 참조하는 `.env` 가 이 템플릿을 복사해 만들어지고, `deploy/seed-llm-config.sh`(T-0959 봉함)가 소비하는 `SEED_LLM_*`/`LLM_APIKEY_ENC_KEY` 키가 이 템플릿에 문서화되므로, env.prod.example 의 내부 계약(필수 키 존재·시크릿 안전성·선택 키 규율·키셋 parity)이 재배포 runner chain 의 **설정 single-source leg** 다. 기존 env.prod.example smoke 는 상보적 다른 표면만 봉했다 — `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795)는 env.prod.example 의 `PORT`(compose `${PORT:-3000}`·Dockerfile EXPOSE·parse-port DEFAULT_PORT 와 4중 byte-identity)·`POSTGRES_USER`/`POSTGRES_DB` **키 실존**(healthcheck 참조)·`DATABASE_URL` **host:port**(compose 서비스명 `postgres`·`5432`)의 **cross-artifact 값 parity** 만 봉했고, 그 smoke 는 line 41~42 에서 `POSTGRES_PASSWORD/AUTH_JWT_SECRET 은 placeholder 일 뿐 본 smoke 의 추출 surface 미포함` 이라고 **명시적으로 배제**했다. 즉 env.prod.example 자신의 **내부 템플릿 semantic 계약**(필수 active 키 6종(`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`DATABASE_URL`/`PORT`/`AUTH_JWT_SECRET`)이 주석-아닌 `KEY=value` 행으로 실존·시크릿 보유 키(`POSTGRES_PASSWORD`/`AUTH_JWT_SECRET`)가 실값 아닌 `<...>` placeholder 만 담음(§9)·비시크릿 키가 사용 가능한 구체 기본값(`assessment_agent`/`3000`) 을 담음·`DATABASE_URL` 의 credential user 가 `POSTGRES_USER` 값과 동일·선택/gated 키(`LLM_APIKEY_ENC_KEY`·`SEED_LLM_*` 5종·`NODE_EXTRA_CA_CERTS`/`HTTPS_PROXY`/`NO_PROXY`)가 default-on 을 강제하지 않도록 **주석 처리된 placeholder** 로만 존재·문서화된 `SEED_LLM_*` 키셋이 `seed-llm-config.sh` 가 실제 소비하는 `SEED_LLM_*` 키셋과 정확히 일치·헤더의 `.env 는 .gitignore 대상 절대 commit 금지` 안전 지시 및 `cp deploy/env.prod.example .env` 사용법 존재)은 어느 smoke 도 assert 하지 않았다(origin/main grep 확인 — `POSTGRES_PASSWORD`/`AUTH_JWT_SECRET`/`LLM_APIKEY_ENC_KEY`/`SEED_LLM_MODEL_ID` 의 placeholder-safety·키셋 parity 에 `expect` NONE, T-0795 는 PORT/POSTGRES_USER·DB/DATABASE_URL host:port 만). 이 관계는 docker-entrypoint.sh 가 parity(T-0797) 뒤에도 T-0960 이, systemd unit 이 parity 뒤에도 T-0961 이, docker-compose.yml 이 parity(T-0795) 뒤에도 T-0962 가, Dockerfile 이 parity(T-0795) 뒤에도 T-0963 이 별도로 필요했던 것과 정확히 동형이다. 이 내부 템플릿 계약이 변질되면 — 필수 active 키(`AUTH_JWT_SECRET`) 소실 시 운영자가 서명 secret 미설정으로 부팅(ADR-0008 서명 검증 무력화) / 시크릿 보유 키에 실값 커밋 시 §9 secret 유출(.example 의 존재 목적 붕괴) / 선택 gated 키가 active 로 승격되면 LLM 미사용 배포도 `LLM_APIKEY_ENC_KEY` 강제(불필요 마찰) / `SEED_LLM_ENDPOINT_URL` 이 주석-해제되면 T-0959 봉함 "빈 값=no-op" gating 문서 drift / 문서화된 `SEED_LLM_*` 키셋이 seed-llm-config.sh 소비셋과 어긋나면 운영자가 오타/누락 키로 seed 실패 — 무인 배포가 조용히 미부팅/secret유출/config-drift 로 진행된다. 본 task 는 그 설정 single-source leg 의 내부 템플릿 semantic 을 정적 앵커로 봉해 재배포 runner chain 을 완결에 한 걸음 더 붙인다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `deploy/env.prod.example` 전체 — 필수 active 키(`POSTGRES_USER=assessment_agent`·`POSTGRES_PASSWORD=<강력한_DB_비밀번호로_교체>`·`POSTGRES_DB=assessment_agent`·`DATABASE_URL="postgresql://assessment_agent:<위와_동일한_비밀번호>@postgres:5432/assessment_agent?schema=public"`·`PORT=3000`·`AUTH_JWT_SECRET=<openssl_rand_hex_32_로_생성한_값>`) + 주석 처리된 선택/gated 키(`# LLM_APIKEY_ENC_KEY=...`·`# SEED_LLM_ENDPOINT_URL=...`·`# SEED_LLM_PROVIDER=custom`·`# SEED_LLM_MODEL_ID=...`·`# SEED_LLM_API_KEY=ollama`·`# SEED_LLM_CONFIG_ID=seed-local-llm`·`# NODE_EXTRA_CA_CERTS=...`·`# HTTPS_PROXY=...`·`# NO_PROXY=...`) + 헤더 안전 지시(`.env 는 .gitignore 대상 — 절대 commit 금지 (CLAUDE.md §9)`·`cp deploy/env.prod.example .env`).
- `deploy/seed-llm-config.sh` — 이 스크립트가 실제 소비하는 `SEED_LLM_*` 키셋(`SEED_LLM_ENDPOINT_URL`·`SEED_LLM_PROVIDER`·`SEED_LLM_MODEL_ID`·`SEED_LLM_API_KEY`·`SEED_LLM_CONFIG_ID`)과 `LLM_APIKEY_ENC_KEY`. 본 task 의 키셋 parity assert 는 이 파일을 readFileSync 로 읽어 `SEED_LLM_[A-Z_]+` 토큰을 정적 추출한 집합과 env.prod.example 문서화 집합을 대조한다(재구현/변경 0 — T-0959 봉함 스크립트는 read-only).
- `test/smoke/realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts` — 기존 env.prod.example 관련 parity smoke(T-0795: `PORT` 4중 byte-identity·`POSTGRES_USER`/`POSTGRES_DB` 키 실존·`DATABASE_URL` host(`postgres`):port(`5432`) parity). 본 task 는 그와 상보(env.prod.example 내부 템플릿 semantic vs cross-artifact 값 parity) — 재구현/변경 0, 중복 assert 금지. 특히 이 smoke 가 이미 잡는 `PORT` 값·`DATABASE_URL` **host:port** 는 본 task 에서 재검증하지 않는다(본 task 의 DATABASE_URL 관점은 **credential user ↔ POSTGRES_USER 내부 parity** 만).
- `test/smoke/realdata-e2e-dockerfile-internal-multistage-build-sequence-base-image-pin-layer-cache-order-frozen-lockfile-prune-nonroot-entrypoint-wiring-contract.smoke-spec.ts` — 형제 T-0963 내부 계약 smoke 패턴(readFileSync 정적 추출·repo-root `__dirname` 해석·선언적 파일 토큰 존재/값/규율 assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 env.prod.example 에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` 신설. `deploy/env.prod.example` 과 `deploy/seed-llm-config.sh` 을 `readFileSync` 로 읽어 내부 템플릿 토큰을 정적 추출한다(실 `.env` 생성/실 컨테이너/실 seed 실행/실 DB 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0963 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 dotenv 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path**: env.prod.example 내부 템플릿 계약 불변식 각각에 대해 성공 assert 1+ —
  - 필수 active 키 6종(`POSTGRES_USER`·`POSTGRES_PASSWORD`·`POSTGRES_DB`·`DATABASE_URL`·`PORT`·`AUTH_JWT_SECRET`)이 각각 **주석 아닌** `KEY=value` 행(행 시작이 `#` 아님)으로 실존,
  - 시크릿 보유 키 `POSTGRES_PASSWORD`·`AUTH_JWT_SECRET` 의 값이 실값이 아니라 `<...>`(angle-bracket placeholder) 토큰만 담음(§9 — .example 이 실 secret 을 담지 않음),
  - 비시크릿 키가 사용 가능한 구체 기본값을 담음(`POSTGRES_USER=assessment_agent`·`POSTGRES_DB=assessment_agent`·`PORT=3000`),
  - `DATABASE_URL` 의 credential user 세그먼트(`postgresql://<user>:...`)가 `POSTGRES_USER` 값(`assessment_agent`)과 동일(내부 credential parity — user 불일치 시 컨테이너 DB 인증 실패),
  - 선택/gated 키(`LLM_APIKEY_ENC_KEY`·`SEED_LLM_ENDPOINT_URL`·`SEED_LLM_PROVIDER`·`SEED_LLM_MODEL_ID`·`SEED_LLM_API_KEY`·`SEED_LLM_CONFIG_ID`·`NODE_EXTRA_CA_CERTS`·`HTTPS_PROXY`·`NO_PROXY`)가 각각 **주석 처리된**(`# KEY=...`) 형태로만 존재(default-on 강제 안 함 — 미사용 배포에 마찰 0),
  - 헤더 안전 지시(`.env 는 .gitignore 대상`·`절대 commit 금지` 문구)와 `cp deploy/env.prod.example .env` 사용법 행이 존재.
- [ ] **SEED_LLM_* 키셋 cross-artifact parity 계약**: `deploy/seed-llm-config.sh` 를 readFileSync 로 읽어 `SEED_LLM_[A-Z_]+` 토큰을 정적 추출한 소비 키셋과, env.prod.example 이 (주석 포함) 문서화한 `SEED_LLM_*` 키셋이 **정확히 동일 집합**(누락·잉여 0)임을 단언하는 assert 1+ (seed-llm-config 가 읽는 키를 템플릿이 문서화 안 하거나, 템플릿이 스크립트가 안 읽는 키를 문서화하면 drift — 운영자 오타/누락 유발).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) `POSTGRES_PASSWORD=<강력한_DB_비밀번호로_교체>` 를 `POSTGRES_PASSWORD=hunter2-real-secret` 처럼 구체 실값으로 바꾼 mutant → 시크릿 보유 키에 실 secret 커밋(§9 유출) 검출,
  - (b) `AUTH_JWT_SECRET=...` active 행을 제거한 mutant → 필수 active 키 누락(서명 secret 미설정 부팅) 검출,
  - (c) `DATABASE_URL=...` 행을 `# DATABASE_URL=...` 로 주석 처리한 mutant → 필수 active 키의 주석-강등(런타임 DB 연결 문자열 소실) 검출,
  - (d) env.prod.example 에서 `SEED_LLM_MODEL_ID` 문서화 행을 제거한 mutant → seed-llm-config.sh 소비셋 ⊋ 템플릿 문서화셋 parity drift 검출,
  - (e) `DATABASE_URL` 의 credential user 를 `assessment_agent` 에서 `root` 로 바꾼(POSTGRES_USER 와 불일치) mutant → 내부 credential parity drift 검출,
  - (f) `# LLM_APIKEY_ENC_KEY=...` 주석 처리 선택 키를 `LLM_APIKEY_ENC_KEY=...` 로 주석-해제(활성화)한 mutant → gated-optional 키의 default-on 강제(미사용 배포 마찰) 검출,
  - (g) `AUTH_JWT_SECRET=<openssl_rand_hex_32_로_생성한_값>` 를 `AUTH_JWT_SECRET=deadbeefcafe0123deadbeefcafe0123` 처럼 구체 실값으로 바꾼 mutant → 두 번째 시크릿 보유 키의 실값 커밋(§9 유출) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 env.prod.example / seed-llm-config.sh 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/토큰/실 DATABASE_URL 자격/실 endpoint 가 등장하지 않음(env 키 이름·`<...>` placeholder·비시크릿 기본값 `assessment_agent`/`3000`·주석 지시문·`SEED_LLM_*` 키 이름만)을 단언하는 test 1+. mutant 에 쓰는 합성 "실값"조차 명백한 dummy(`hunter2-real-secret`·`deadbeefcafe...`)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 필수 키 있음/주석-강등 분기·placeholder 있음/실값 분기(×2 키)·credential user 일치/불일치 분기·gated 키 주석/활성 분기·SEED_LLM_* 키셋 일치/drift 분기를 각 test 로 분리. env.prod.example 은 조건 분기 없는 선언적 env 템플릿 — "런타임 분기 없음(선언적 템플릿) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 `.env` 생성/실 seed/실 컨테이너/실 DB 0, `deploy/env.prod.example`·`deploy/seed-llm-config.sh` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/env.prod.example`·`deploy/seed-llm-config.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- 기존 `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795: `PORT` 4중 byte-identity·`POSTGRES_USER`/`POSTGRES_DB` 키 실존·`DATABASE_URL` **host:port** parity) 재구현/변경 0 — cross-artifact 값 parity vs 본 task 의 env.prod.example 내부 템플릿 semantic 은 distinct 상보 표면. 본 task 는 `PORT` 값·`DATABASE_URL` **host(`postgres`)/port(`5432`)** 를 재검증하지 않는다(본 task 의 DATABASE_URL 관점은 **credential user ↔ POSTGRES_USER 내부 parity** 만).
- 기존 T-0959(seed-llm-config.sh env-gating 내부 계약) smoke 재구현/변경 0 — seed-llm-config 의 `SEED_LLM_ENDPOINT_URL 빈값 no-op` **런타임 gating semantic** 은 T-0959 봉함. 본 task 는 env.prod.example 이 문서화한 `SEED_LLM_*` **키셋** 이 seed-llm-config 소비셋과 **집합 일치** 하는지(cross-artifact 키셋 parity)만 — 스크립트 gating 동작 재검증 0.
- T-0958(redeploy.sh)·T-0960(docker-entrypoint.sh)·T-0961(systemd unit)·T-0962(docker-compose.yml)·T-0963(Dockerfile) 내부 계약 smoke 재구현/변경 0 — 각 파일 내부 계약 vs 본 task 의 env.prod.example 내부 템플릿은 distinct.
- 실 dotenv 로드/실 `cp`/실 컨테이너 env 주입 실측 도입 0 — 정적 텍스트 앵커만(선언적 env 템플릿의 키 존재·주석-규율·placeholder-safety·키셋 parity).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
