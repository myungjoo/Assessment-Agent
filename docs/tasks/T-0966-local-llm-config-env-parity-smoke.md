---
id: T-0966
title: deploy/local-llm-example/config.env 로컬 LLM 호스트 템플릿 내부 계약 + seed-llm-config.sh cross-artifact 정본 parity(필수 active 키 5종 존재·OLLAMA_HOST↔OPENAI_BASE_URL 포트 내부 parity·OpenAI-호환 /v1 suffix·기본 모델 tag gemma4:12b↔seed 기본값·:11434/v1 endpoint 규약 parity·§9 secret-safety) 정적 smoke
phase: P5
status: DONE
prNumber: 860
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 390
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0965(deploy/README runbook cross-artifact, 430 LOC)·T-0964(env.prod.example 내부 템플릿, 420 LOC)·T-0963(Dockerfile 내부 멀티스테이지, 460 LOC) 동형. R-112 4종 cover 위한 다수 assert(config.env 필수 키 5종·내부 포트 parity·OpenAI-호환 suffix·seed cross-artifact 모델/endpoint 규약 parity·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·config.env 및 seed-llm-config.sh 미변경."
independentStream: realdata-e2e-local-llm-config-env-parity-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-config-env-internal-template-parity-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — deploy/local-llm-example/config.env(Ollama 호스트 설정 템플릿)이 smoke 미봉(grep NONE for local-llm/config.env in test). 재배포 runner chain(T-0960~T-0965)이 봉한 AA 서버측 artifact 의 counterpart = LLM 호스트측 설정. config.env 내부 template 계약 + seed-llm-config.sh 기본 모델/endpoint 규약 cross-artifact parity 봉함."
---

# T-0966 — deploy/local-llm-example/config.env 로컬 LLM 호스트 템플릿 내부 계약 + seed cross-artifact parity 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 봉해온 chain — AA **서버측** artifact(daily-test.sh: T-0944~T-0957, redeploy.sh: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh: T-0960, systemd unit: T-0961, docker-compose.yml: T-0962, Dockerfile: T-0963, env.prod.example: T-0964, deploy/README.md runbook: T-0965)는 촘촘히 봉했다. 그러나 그 서버가 실 평가 시 호출하는 **LLM 호스트측 설정 정본** 인 `deploy/local-llm-example/config.env` 는 아직 smoke 미봉이다(origin/main grep 확인 — `test/` 에 `local-llm-example`/`OLLAMA_MODEL` 참조 spec NONE). PLAN.md §108/§109 가 canonical live-LLM 경로로 확정한 **로컬 PC Ollama(LAN 노출)** 의 실 서빙 설정이 이 config.env 이며, 여기서 pull/serve 할 모델 tag·bind 주소·OpenAI-호환 endpoint·LAN 허용 범위가 정의된다. 이 파일이 실 파일-사실과 어긋나면(drift) 로컬 LLM 호스트가 **AA 서버의 seed 기대와 다른 모델/포트로 서빙** — 무인 재배포 후 `seed-llm-config.sh` 가 seed 한 `LlmProviderConfig` 가 실제로 응답 못하는 endpoint/model 을 가리켜 live-LLM 평가가 조용히 실패한다.

구체적으로 config.env 는 다음 내부·cross-artifact 계약을 갖는다(각각 실 파일-값 parity 대상): (1) 필수 active 키 5종(`OLLAMA_MODEL`/`OLLAMA_HOST`/`OLLAMA_KEEP_ALIVE`/`OPENAI_BASE_URL`/`LAN_ALLOW_CIDR`) 존재, (2) `OLLAMA_HOST`(`127.0.0.1:11434`)의 포트와 `OPENAI_BASE_URL`(`http://127.0.0.1:11434/v1`)의 포트가 **내부 parity**(둘이 어긋나면 Ollama 가 서빙하는 포트와 OpenAI-호환 base 가 달라 클라이언트가 잘못된 포트로 연결), (3) `OPENAI_BASE_URL` 이 OpenAI-호환 규약(`/v1` suffix)을 만족(Ollama 는 `/v1` 로 OpenAI Chat Completions 호환 API 를 연다 — suffix 유실 시 호환 endpoint 아님), (4) config.env 의 기본 모델 tag `gemma4:12b` 가 `seed-llm-config.sh` 의 `SEED_LLM_MODEL_ID` 기본값(`gemma4:12b`, line 49)과 **cross-artifact parity**(둘이 어긋나면 호스트가 서빙하는 모델과 seed 가 등록하는 modelId 가 달라 평가 호출이 모델-미스매치로 실패), (5) `OPENAI_BASE_URL` 의 포트+`/v1` 규약(`:11434/v1`)이 seed-llm-config.sh 주석의 예시 endpoint(`SEED_LLM_ENDPOINT_URL` 예: `http://192.168.0.5:11434/v1`, line 21)의 포트+suffix 규약과 **cross-artifact 정합**(host 는 환경마다 다르나 포트/`/v1` 규약은 동일해야 OpenAI-호환 경로가 성립). config.env 정본이 변질되면 — 모델 tag 가 seed 기본과 어긋나면 seed 된 modelId 로 추론 요청 시 host 가 그 모델 미보유 / 포트 내부 불일치면 base URL 이 죽은 포트를 가리킴 / `/v1` 유실이면 OpenAI-호환 아님 — 로컬 live-LLM 평가(PLAN §109 myungjoo/leemgs 실 평가 e2e)가 무인으로 오구성 진행된다. 본 task 는 그 LLM 호스트측 정본을 정적 앵커로 봉해 재배포 runner chain 의 live-LLM 운영 premise leg 를 완결에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/config.env` 전체 — 5 active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`·`LAN_ALLOW_CIDR=192.168.0.0/24`) + 주석 규율(`OLLAMA_KEEP_ALIVE` 문서화 값 `5m`/`0`/`-1`). 본 task 는 이 파일에서 정본 토큰을 정적 추출한다(재구현/변경 0 — read-only).
- `deploy/seed-llm-config.sh` — `MODEL="${SEED_LLM_MODEL_ID:-gemma4:12b}"`(line 49) 기본 모델 tag + 주석의 예시 endpoint `SEED_LLM_ENDPOINT_URL ... 예: http://192.168.0.5:11434/v1`(line 21). config.env 와의 cross-artifact parity 대조(readFileSync 정적 추출 — 포트/`/v1` 규약·모델 tag 만, host 는 환경 가변이라 대조 제외).
- `test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` — 형제 T-0964 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰 존재/값/parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 config.env 내부 계약 + config.env↔seed cross-parity 에 적용 — 재구현이 아니라 패턴 참조.
- `test/smoke/realdata-e2e-deploy-readme-runbook-cross-artifact-parity-contract.smoke-spec.ts` — 형제 T-0965 cross-artifact parity 패턴 참조(문서/설정-값 ↔ 실 artifact 값 대조 구조).

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-config-env-internal-template-parity-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/config.env`·`deploy/seed-llm-config.sh` 를 `readFileSync` 로 읽어 정본 토큰을 정적 추출한다(실 Ollama 기동/실 추론/실 seed 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0964 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 env/ini 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path**: config.env 내부·cross-artifact 정본 불변식 각각에 대해 성공 assert 1+ —
  - 필수 active 키 5종(`OLLAMA_MODEL`·`OLLAMA_HOST`·`OLLAMA_KEEP_ALIVE`·`OPENAI_BASE_URL`·`LAN_ALLOW_CIDR`)이 주석 아닌 `KEY=VALUE` 행으로 각각 존재,
  - `OLLAMA_HOST` 의 포트(`11434`)와 `OPENAI_BASE_URL` 의 포트(`11434`)가 byte-동일(내부 포트 parity),
  - `OPENAI_BASE_URL` 이 `http://` 스킴 + `/v1` suffix 로 끝남(OpenAI-호환 규약),
  - `OLLAMA_KEEP_ALIVE` 값(`5m`)이 파일 주석이 문서화한 허용 값 집합(`5m`/`0`/`-1`) 중 하나.
- [ ] **cross-artifact 기본 모델 tag parity 계약**: `config.env` 의 `OLLAMA_MODEL` 값과 `seed-llm-config.sh` 의 `SEED_LLM_MODEL_ID` 기본값(`${SEED_LLM_MODEL_ID:-...}` 정적 추출)이 **byte-동일**(`gemma4:12b`)임을 단언하는 assert 1+ (호스트가 서빙하는 모델 ≠ seed 가 등록하는 modelId 면 추론 시 모델-미스매치 실패).
- [ ] **cross-artifact endpoint 규약 parity 계약**: `config.env` 의 `OPENAI_BASE_URL` 의 포트(`11434`)+suffix(`/v1`)와, `seed-llm-config.sh` 주석 예시 endpoint(`http://192.168.0.5:11434/v1` 정적 추출)의 포트(`11434`)+suffix(`/v1`)가 **동일 규약**임을 단언하는 assert 1+ (host 는 환경 가변이라 대조 제외 — 포트/`/v1` 규약만). OpenAI-호환 경로 성립의 cross-artifact 조건.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) `OLLAMA_HOST` 포트를 `127.0.0.1:11434` 에서 `127.0.0.1:8080` 으로 바꾼 mutant → 내부 host↔base 포트 parity drift 검출,
  - (b) `OPENAI_BASE_URL` 의 trailing `/v1` 을 제거한 mutant(`http://127.0.0.1:11434`) → OpenAI-호환 suffix 규약 drift 검출,
  - (c) config.env 의 `OLLAMA_MODEL` 을 `gemma4:12b` 에서 `llama3:8b` 으로 바꾼 mutant → seed 기본 모델과 cross-artifact drift(config.env 측) 검출,
  - (d) seed-llm-config.sh 의 `SEED_LLM_MODEL_ID` 기본값을 다른 tag(`qwen2:7b`)로 바꾼 합성 mutant → config.env 와 cross-artifact drift(seed 측) 검출,
  - (e) config.env 에서 필수 키 `OLLAMA_MODEL` 행을 제거한 mutant → 필수 active 키 presence drift 검출,
  - (f) `OPENAI_BASE_URL` 의 포트를 `11434` 에서 `11500` 으로 바꾼 mutant → seed 예시 endpoint 포트 규약과 cross-artifact drift 검출,
  - (g) `OLLAMA_KEEP_ALIVE` 값을 문서화 집합 밖(`99x`)으로 바꾼 mutant → 문서화 허용 값 규율 drift 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 config.env/seed-llm-config.sh 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·CIDR `192.168.0.0/24`·모델 tag `gemma4:12b`·keep-alive `5m`·`/v1` suffix·seed 예시 host `192.168.0.5` 만 — 모두 비시크릿 설정 값/예시)을 단언하는 test 1+. mutant 에 쓰는 합성 값조차 명백한 dummy(`8080`·`11500`·`llama3:8b`·`qwen2:7b`·`99x`)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 각 정본 앵커의 일치/drift 분기(필수 키 presence·내부 포트 parity·`/v1` suffix·keep-alive 값 규율·모델 tag cross-parity·endpoint 규약 cross-parity)를 각 test 로 분리. config.env/seed 는 조건 분기 없는 선언적 설정·스크립트 기본값 — "런타임 분기 없음(선언적 설정·기본값) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 Ollama/실 추론/실 seed 0, 대조 artifact 2종(`deploy/local-llm-example/config.env`·`deploy/seed-llm-config.sh`) 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/local-llm-example/config.env`·`deploy/seed-llm-config.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0959(seed-llm-config.sh 런타임 env-gating·no-op guard·strict-mode·enckey fail-fast) smoke 재구현/변경 0 — 본 task 는 seed 의 **기본 모델 tag·예시 endpoint 규약** 만 config.env 와 cross-parity 대조(스크립트 gating/암호화 semantic 은 T-0959 봉함).
- T-0964(env.prod.example 내부 템플릿)·T-0965(deploy/README runbook) smoke 재구현/변경 0 — 본 task 는 **LLM 호스트측** config.env 정본만(서버측 env.prod.example 템플릿·README 문서-값 parity 는 각각 T-0964/T-0965 봉함).
- `deploy/local-llm-example/` 의 PowerShell 스크립트(`install.ps1`·`expose-lan.ps1`·`start-llm.ps1` 등) 계약 검증 0 — 본 task 는 config.env 정적 설정 값 + seed cross-parity 만. PowerShell 실행/설치 semantic 은 별도 표면(필요 시 follow-up).
- 실 Ollama pull/serve/추론·실 LAN 노출·실 방화벽 규칙·실 OpenAI-호환 round-trip 실측 도입 0 — 정적 텍스트 앵커만(config.env 값 ↔ seed 규약 parity).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
