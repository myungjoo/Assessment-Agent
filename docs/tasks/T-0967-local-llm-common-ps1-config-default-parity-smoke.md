---
id: T-0967
title: deploy/local-llm-example/_common.ps1 공용 헬퍼 내부 계약 + config.env/.gitignore cross-artifact 정본 parity(Get-LlmConfig 코드-기본값 5종↔config.env byte-parity·Read-EnvFile 형식 규약↔config.env 문서 형식·config.env→config.local.env 병합순서·config.local.env↔.gitignore 커밋금지 parity·Get-LocalApiBase 포트 11434 규약·/api/version 헬스 endpoint) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 400
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0966(config.env 내부+seed cross-parity, 390 LOC)·T-0965(deploy/README runbook, 694 LOC)·T-0964(env.prod.example 내부 템플릿, 420 LOC) 동형. R-112 4종 cover 위한 다수 assert(Get-LlmConfig 코드-기본값 5종 cross-parity·Read-EnvFile 형식 규약·병합순서·config.local.env↔.gitignore parity·Get-LocalApiBase 포트 규약·/api/version endpoint·negative mutant a~h 8종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·_common.ps1/config.env/.gitignore 미변경."
independentStream: realdata-e2e-local-llm-common-ps1-parity-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-common-ps1-config-default-single-source-parity-envparse-mergeorder-apibase-port-gitignore-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg 후속 — T-0966 이 config.env 정본을 봉했고, 그 config 를 코드로 소비/기본값-embedding 하는 공용 헬퍼 _common.ps1(모든 local-llm ps1 이 dot-source)은 smoke 미봉(grep NONE for _common.ps1 in test). Get-LlmConfig 코드-기본값 hashtable↔config.env cross-artifact parity 가 핵심 — config.env 부재/누락 시 코드-기본값이 대체하므로 drift=조용한 divergence."
---

# T-0967 — deploy/local-llm-example/_common.ps1 공용 헬퍼 내부 계약 + config.env/.gitignore cross-artifact parity 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain — T-0966 이 `deploy/local-llm-example/config.env`(LLM 호스트측 설정 정본) 의 내부 계약 + seed cross-parity 를 봉했다. 그러나 그 config.env 를 **코드로 로드/소비**하고 동일 계약을 **코드-내 기본값으로 embedding** 하는 공용 헬퍼 `deploy/local-llm-example/_common.ps1` 은 아직 smoke 미봉이다(origin/main grep 확인 — `test/` 에 `_common.ps1`/`Get-LlmConfig`/`Get-LocalApiBase` 참조 spec NONE). 이 `_common.ps1` 은 모든 로컬 LLM 스크립트(`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`expose-lan.ps1`·`install.ps1`)가 `dot-source` 하는 single-source 헬퍼로, config 로드·env 파싱·서버 헬스체크·API base 산출의 계약을 정의한다.

핵심 위험은 **코드-기본값 drift**다. `Get-LlmConfig`(line 34~45)는 hashtable 에 5종 기본값(`OLLAMA_MODEL='gemma4:12b'`·`OLLAMA_HOST='127.0.0.1:11434'`·`OLLAMA_KEEP_ALIVE='5m'`·`OPENAI_BASE_URL='http://127.0.0.1:11434/v1'`·`LAN_ALLOW_CIDR='192.168.0.0/24'`)을 **코드로 embedding** 한 뒤 config.env 를 읽어 덮어쓴다. 즉 **config.env 가 부재하거나 특정 키가 누락되면 이 코드-기본값이 실효 설정이 된다** — 코드-기본값이 config.env 정본과 어긋나면(drift), config.env 를 신뢰한 운영자가 예상 못한 모델/포트/endpoint 로 조용히 서빙된다. config.env(T-0966 봉함)와 `_common.ps1` 코드-기본값의 **cross-artifact byte-parity** 를 정적 앵커로 봉하는 것이 본 task 의 1순위 계약이다.

부수 계약들도 실 파일-사실 parity 대상이다: (1) `Read-EnvFile`(line 12~30) 파서의 형식 규약(`#` 주석 skip·빈 줄 skip·`=` 인덱스 ≥ 1·값 양끝 따옴표 제거)이 config.env 가 line 8 에 문서화한 형식(`KEY=VALUE`·`#` 시작/빈 줄 무시)과 정합, (2) `Get-LlmConfig` 병합 순서(코드-기본값 → `config.env` → `config.local.env`, 뒤가 최우선)가 config.env 주석(line 4~6 "config.local.env 로 덮어쓴다")과 정합, (3) `_common.ps1` 이 읽는 `config.local.env`(line 43)가 `.gitignore`(line 2)에 커밋-금지로 등재됨(config.env line 4 "gitignore 됨" 문서와 cross-artifact parity — 미등재면 개인 secret override 가 커밋 위험), (4) `Get-LocalApiBase`(line 66~71) 의 기본 포트 `11434`·포트 추출 정규식(`:(\d+)\s*$`)이 config.env 의 `OLLAMA_HOST`/`OPENAI_BASE_URL` 포트(`11434`)와 정합, (5) `Test-OllamaServer`(line 74~82) 의 헬스 endpoint 규약(`/api/version`). 이 헬퍼 정본이 변질되면 로컬 live-LLM 호스트가 config.env 기대와 다르게 구성되어 무인 재배포 후 live-LLM 평가(PLAN §109)가 조용히 오구성 진행된다. 본 task 는 그 코드-정본을 정적 앵커로 봉해 LLM 호스트측 운영 premise 를 config.env(T-0966) 위에 완결에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/_common.ps1` 전체 — `Get-LlmConfig` 코드-기본값 hashtable 5종(line 35~41: `OLLAMA_MODEL='gemma4:12b'`·`OLLAMA_HOST='127.0.0.1:11434'`·`OLLAMA_KEEP_ALIVE='5m'`·`OPENAI_BASE_URL='http://127.0.0.1:11434/v1'`·`LAN_ALLOW_CIDR='192.168.0.0/24'`)·`Read-EnvFile` 형식 규약(line 12~30)·병합순서(line 42~44: config.env → config.local.env)·`Get-LocalApiBase` 포트 기본/추출(line 66~71)·`Test-OllamaServer` 헬스 endpoint `/api/version`(line 77). 본 task 는 이 파일에서 정본 토큰을 정적 추출한다(재구현/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키 5종(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`·`LAN_ALLOW_CIDR=192.168.0.0/24`)·형식 문서(line 8)·config.local.env override 규약(line 4~6). `_common.ps1` 코드-기본값과 cross-artifact byte-parity 대조(readFileSync 정적 추출).
- `deploy/local-llm-example/.gitignore` — line 2 `config.local.env` 커밋-금지 등재. `_common.ps1` 이 읽는 개인 override 파일(line 43)이 실제로 gitignore 되는지 cross-artifact 대조.
- `test/smoke/realdata-e2e-local-llm-example-config-env-internal-template-parity-contract.smoke-spec.ts` — 형제 T-0966 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰 존재/값/parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 `_common.ps1` 코드-기본값 cross-parity + 파서/병합/포트/endpoint 규약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-common-ps1-config-default-single-source-parity-envparse-mergeorder-apibase-port-gitignore-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/_common.ps1`·`config.env`·`.gitignore` 를 `readFileSync` 로 읽어 정본 토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama 기동/실 추론 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0966 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 ps1 파서/실 ini 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path(코드-기본값 cross-artifact parity, 1순위 계약)**: `_common.ps1` 의 `Get-LlmConfig` 코드-기본값 hashtable 5종(`OLLAMA_MODEL`·`OLLAMA_HOST`·`OLLAMA_KEEP_ALIVE`·`OPENAI_BASE_URL`·`LAN_ALLOW_CIDR`)의 각 값을 정적 추출하고, `config.env` 의 동명 active 키 값과 **byte-동일**임을 단언하는 assert 5개(키당 1개 이상). 어느 하나라도 drift 하면 config.env 부재/누락 시 실효 설정이 정본과 어긋남.
- [ ] **Happy-path(파서/병합/포트/endpoint 내부 규약)**: 각각 성공 assert 1+ —
  - `Read-EnvFile` 파서 규약: `#` 시작 줄 skip·빈 줄 skip·`=` 인덱스 ≥ 1(`if ($idx -lt 1)` 가드)·값 양끝 따옴표 제거 로직이 소스에 존재(config.env line 8 문서 형식과 정합),
  - 병합순서: `Get-LlmConfig` 가 `config.env` 를 먼저, `config.local.env` 를 나중에 `Read-EnvFile` 호출(뒤가 최우선 — config.env line 4~6 override 문서와 정합),
  - `Get-LocalApiBase` 기본 포트 토큰 `'11434'` + 추출 정규식(`:(\d+)`)이 소스에 존재하고, config.env `OLLAMA_HOST`/`OPENAI_BASE_URL` 포트(`11434`)와 byte-동일,
  - `Test-OllamaServer` 헬스 endpoint 가 `/api/version` 로 소스에 존재(Ollama 서버 헬스 규약).
- [ ] **cross-artifact config.local.env↔.gitignore parity 계약**: `_common.ps1` 이 `Read-EnvFile` 로 읽는 개인 override 파일명(`config.local.env`, line 43 정적 추출)이 `.gitignore`(line 2)에 커밋-금지 항목으로 등재됨을 단언하는 assert 1+ (미등재면 개인 secret override 가 실수로 커밋될 위험 — config.env line 4 "gitignore 됨" 문서와 정합).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~h 8종):
  - (a) `_common.ps1` 코드-기본값 `OLLAMA_MODEL='gemma4:12b'` 를 `'llama3:8b'` 로 바꾼 mutant → config.env 와 코드-기본값 cross-parity drift 검출,
  - (b) `_common.ps1` 코드-기본값 `OLLAMA_HOST` 포트를 `11434` 에서 `8080` 으로 바꾼 mutant → config.env 포트와 cross-parity drift 검출,
  - (c) `_common.ps1` 코드-기본값 `OPENAI_BASE_URL` 의 `/v1` suffix 제거 mutant → config.env endpoint 규약과 drift 검출,
  - (d) `Read-EnvFile` 의 `#` 주석 skip 가드(`$t.StartsWith('#')`) 를 제거한 mutant → 파서 형식 규약 drift 검출,
  - (e) `Get-LlmConfig` 병합 순서를 뒤집어(`config.local.env` 를 먼저, `config.env` 를 나중) 읽는 mutant → 병합순서(local 최우선) drift 검출,
  - (f) `Get-LocalApiBase` 기본 포트 토큰을 `'11434'` 에서 `'11500'` 으로 바꾼 mutant → 포트 규약 cross-parity drift 검출,
  - (g) `Test-OllamaServer` 헬스 endpoint 를 `/api/version` 에서 `/api/tags` 로 바꾼 mutant → 헬스 endpoint 규약 drift 검출,
  - (h) `.gitignore` 에서 `config.local.env` 행을 제거한 합성 mutant → config.local.env 커밋-금지 등재 drift(gitignore 측) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `_common.ps1`/`config.env`/`.gitignore` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·CIDR `192.168.0.0/24`·모델 tag `gemma4:12b`·keep-alive `5m`·`/v1` suffix·헬스 `/api/version` 만 — 모두 비시크릿 설정 값/경로)을 단언하는 test 1+. mutant 에 쓰는 합성 값조차 명백한 dummy(`8080`·`11500`·`llama3:8b`·`/api/tags`)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 각 정본 앵커의 일치/drift 분기(코드-기본값 5종 cross-parity·파서 형식 규약·병합순서·config.local.env↔.gitignore parity·포트 규약·헬스 endpoint)를 각 test 로 분리. `_common.ps1`/config.env/.gitignore 는 정적 스크립트·선언적 설정 — "런타임 분기 없음(정적 소스 텍스트 앵커) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 PowerShell 실행/실 Ollama/실 추론 0, 대조 artifact 3종(`_common.ps1`·`config.env`·`.gitignore`) 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/local-llm-example/_common.ps1`·`config.env`·`.gitignore` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0966(config.env 내부 템플릿 + seed cross-parity) smoke 재구현/변경 0 — 본 task 는 config.env 를 **코드로 소비/embedding** 하는 `_common.ps1` 측 계약 + config.env↔코드-기본값 cross-parity 만(config.env 내부 계약·seed cross-parity 는 T-0966 봉함).
- `_common.ps1` 의 서버 기동 폴백 로직(`Start-OllamaServerIfNeeded` 트레이 앱 → serve 폴백·프로세스 정리 race 처리)·`Wait-OllamaServer` 폴링 semantic 계약 검증 0 — 본 task 는 config-기본값 cross-parity·파서/병합/포트/헬스-endpoint 정적 규약만. 기동 폴백 시퀀스는 별도 표면(필요 시 follow-up).
- 나머지 로컬 LLM ps1 스크립트(`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`expose-lan.ps1`·`install.ps1`) 계약 검증 0 — 본 task 는 공용 헬퍼 `_common.ps1` 의 config-소비 계약만. 각 스크립트별 실행 semantic 은 별도 표면(필요 시 follow-up).
- 실 Ollama pull/serve/추론·실 PowerShell 파서 동작·실 LAN 노출·실 방화벽 규칙 실측 도입 0 — 정적 소스 텍스트 앵커만(_common.ps1 코드-기본값 ↔ config.env/.gitignore parity).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
