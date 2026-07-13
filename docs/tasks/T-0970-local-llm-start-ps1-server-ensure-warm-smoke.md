---
id: T-0970
title: deploy/local-llm-example/start-llm.ps1 서버 보장 기동+모델 예열 스크립트 내부 계약(dot-source _common.ps1·CmdletBinding 1-switch(-NoWarm)·config-sourced 값(하드코딩 아님)·Start-OllamaServerIfNeeded 실패 시 throw fail-fast·-NoWarm early-return skip 분기·예열 POST /api/generate body(model/keep_alive config-sourced·prompt 'ok'·stream false)·예열 실패 non-fatal Write-Warning) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 470
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0969(install.ps1 5-step 시퀀스, 560 LOC)·T-0967(_common.ps1 코드-정본 parity, 593 LOC)·T-0966(config.env 내부+seed cross-parity, 526 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·CmdletBinding 1-switch·config-sourced model/keep_alive/host 값·Start-OllamaServerIfNeeded fail-fast throw·-NoWarm early-return skip 분기·예열 POST /api/generate body 계약(prompt 'ok'·stream false·keep_alive $cfg 참조)·예열 실패 catch non-fatal Write-Warning·심볼 소비(Get-LlmConfig/Get-LocalApiBase/Start-OllamaServerIfNeeded) _common.ps1 실존 대조·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·start-llm.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-start-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-start-llm-ps1-server-ensure-config-sourced-warm-nowarm-branch-nonfatal-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)·_common.ps1(T-0967)·README(T-0968)·install.ps1(T-0969) 봉함 뒤 그 헬퍼 dot-source 소비자 중 2순위(설치 후 운영 진입점) start-llm.ps1 이 smoke 미봉(grep NONE). 서버 보장 기동+모델 예열 계약 drift→운영자 오기동. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0970 — deploy/local-llm-example/start-llm.ps1 서버 보장 기동+모델 예열 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)·그 config 를 코드로 소비하는 공용 헬퍼(_common.ps1, T-0967)·운영자 사용법 문서(README.md, T-0968)·1순위 설치 진입점(install.ps1, T-0969)을 봉했다. 그다음 운영자가 설치 후 실제로 **곧바로 쓰려고 서버를 세우고 모델을 예열하는 2순위 진입점** `deploy/local-llm-example/start-llm.ps1` 은 아직 smoke 미봉이다(origin/main grep 확인 — `test/` 에 `start-llm.ps1` 참조 spec NONE). 이 스크립트는 `_common.ps1` 을 dot-source 해 `Get-LlmConfig`(T-0967 봉함)로 config 정본을 읽고, 서버 보장 기동(`Start-OllamaServerIfNeeded`)→모델 예열(POST `/api/generate`)의 흐름을 수행한다.

핵심 위험은 **기동/예열 계약 drift**다. (1) `start-llm.ps1` 이 config-sourced 값을 쓰지 않고 `gemma4:12b`/`5m`/`11434` 같은 literal 을 하드코딩하기 시작하면 config.env 정본(T-0966)과 조용히 divergence 한다 — 본 task 의 1순위 계약은 start-llm.ps1 이 예열 body 의 model/keep_alive 를 `$cfg.OLLAMA_MODEL`/`$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과) 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 참조하고 그 값을 하드코딩하지 않음이다. (2) 서버 보장 기동은 `Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40` 이 false 를 반환하면 `throw`(fail-fast, install.ps1 선행 실행 안내)해야 한다 — 이 fail-fast 가 빠지면 죽은 서버 위에서 예열이 시도돼 오진단된다. (3) `-NoWarm` switch 는 서버만 기동하고 예열 전에 `return`(early-exit, skip)해야 한다 — early-return 이 빠지면 -NoWarm 이 무시돼 불필요한 예열이 돈다. (4) 예열 body 는 `@{ model=$cfg.OLLAMA_MODEL; prompt='ok'; stream=$false; keep_alive=$cfg.OLLAMA_KEEP_ALIVE }` 를 `ConvertTo-Json` 해 `$apiBase/api/generate` 로 POST(`TimeoutSec 300`)해야 한다 — model/keep_alive 는 config-sourced, prompt 는 최소 `'ok'`, stream 은 `$false`. (5) 예열 실패는 `catch` 에서 `Write-Warning` non-fatal 처리(모델 미pull 안내)여야 한다 — 예열 실패로 스크립트가 죽으면 서버는 떠 있는데도 운영 진입이 막힌다. 이 계약이 어긋나면 설치 후 첫 사용(PLAN §108/§109)의 로컬 LLM 준비가 조용히 오기동된다.

본 task 는 그 기동/예열 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 중 2순위 운영 진입점을 install.ps1(T-0969) 위에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/start-llm.ps1` 전체(44행) — line 9~10(`[CmdletBinding()]` + `param([switch]$NoWarm)` 정확히 1 switch)·line 12(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')` dot-source)·line 13~14(`$cfg = Get-LlmConfig`·`$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 소비)·line 16~19(`Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40` 실패 시 `throw`)·line 22~25(`-NoWarm` → Write-Host + `return` early-exit skip)·line 29~35(예열 body `@{ model=$cfg.OLLAMA_MODEL; prompt='ok'; stream=$false; keep_alive=$cfg.OLLAMA_KEEP_ALIVE }` `ConvertTo-Json`)·line 36~43(`Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post ... -TimeoutSec 300` try + `catch { Write-Warning ... }` non-fatal). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`). start-llm.ps1 이 이 값을 하드코딩하지 않고 `$cfg.*` 로 참조함을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-LocalApiBase`(line 66)·`Start-OllamaServerIfNeeded`(line 101) 함수 정의 존재. start-llm.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 `function` grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-common-ps1-config-default-single-source-parity-envparse-mergeorder-apibase-port-gitignore-contract.smoke-spec.ts`(T-0967) 또는 install.ps1 형제 spec(T-0969) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/분기 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 start-llm.ps1 의 config-sourced 참조+fail-fast throw+-NoWarm 분기+예열 body+non-fatal catch 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-start-llm-ps1-server-ensure-config-sourced-warm-nowarm-branch-nonfatal-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/start-llm.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama 기동·예열·실 HTTP 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0967/T-0969 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: start-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 start-llm.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-LocalApiBase`·`Start-OllamaServerIfNeeded`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced 값 계약, 1순위)**: start-llm.ps1 이 예열 body 의 model/keep_alive 를 `$cfg.OLLAMA_MODEL`·`$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과) 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 **참조**하고, `gemma4:12b`·`127.0.0.1:11434`·`5m` 같은 config 값 literal 을 start-llm.ps1 본문에 **하드코딩하지 않음**을 단언하는 assert 각 1+ (하드코딩 검출 시 config.env 정본과 divergence 위험). config.env 는 그 값의 정본으로만 참조(byte 값 대조 근거).
- [ ] **Happy-path(CmdletBinding + 1-switch param 계약)**: `[CmdletBinding()]` 존재 + `param` 블록에 `[switch]$NoWarm` 정확히 1개 switch 가 선언됨(그 외 switch 없음)을 단언하는 assert 1+.
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - 서버 보장 기동 fail-fast(`Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40` → 반환 false(`-not`) 시 `throw` — install.ps1 선행 실행 안내) 토큰·순서 존재,
  - `-NoWarm` early-return skip 분기(`if ($NoWarm)` → Write-Host 예열 생략 안내 + `return`, 이후 예열 코드 미도달) 존재,
  - 예열 body 계약(`ConvertTo-Json` 대상 hashtable 에 `model = $cfg.OLLAMA_MODEL`·`prompt = 'ok'`·`stream = $false`·`keep_alive = $cfg.OLLAMA_KEEP_ALIVE` 4 필드) + POST 배선(`Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post ... -ContentType 'application/json' -TimeoutSec 300`) 존재,
  - 예열 실패 non-fatal(`try { ... } catch { Write-Warning ... }` — 예열 실패가 throw/exit 로 치명화되지 않고 경고 후 진행/종료, 모델 pull 재확인 안내) 존재.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) start-llm.ps1 에 config 값 `gemma4:12b` 를 예열 body 에 literal 로 하드코딩한 mutant → config-sourced 값 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) `Start-OllamaServerIfNeeded` 실패 시 `throw` 를 제거(false 여도 진행)한 mutant → 서버 보장 fail-fast 계약 drift 검출,
  - (d) `-NoWarm` 분기의 `return` early-exit 를 제거한 mutant → 예열 skip 분기 drift(예열 무조건 실행) 검출,
  - (e) 예열 body 의 `keep_alive = $cfg.OLLAMA_KEEP_ALIVE` 를 literal `5m` 로 바꾼 mutant → config-sourced keep_alive drift 검출,
  - (f) 예열 `catch { Write-Warning ... }` 를 제거(예열 실패 치명화)한 mutant → non-fatal 예열 계약 drift 검출,
  - (g) start-llm.ps1 이 호출하는 `Start-OllamaServerIfNeeded` 를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `start-llm.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·모델 tag `gemma4:12b`·keep-alive `5m`·endpoint `/api/generate` 같은 비시크릿 설정 값/경로만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 `gemma4:12b`/`5m` literal·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/기동 0 이므로 green, R-113).

## Out of Scope

- `start-llm.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 Ollama 기동/예열·실 HTTP POST·실 Invoke-RestMethod 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Get-LocalApiBase 포트·Start-OllamaServerIfNeeded 폴링 mechanics 등)은 T-0967 소관 — 본 task 는 start-llm.ps1 이 그 심볼을 호출/소비하는 배선만.
- 나머지 미봉 스크립트(`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`expose-lan.ps1`)의 내부 계약은 후속 별도 task — Follow-ups 참고.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 local-llm-example 스크립트 static-smoke 후속(각 1 task): `stop-llm.ps1`(모델 언로드 keep_alive=0 + -StopServer 서버종료 분기 + API 실패 시 CLI stop fallback)·`status.ps1`(서버/버전·ollama ps·list·nvidia-smi 진단)·`test-llm.ps1`(/v1/chat/completions 스모크 wire 포맷)·`expose-lan.ps1`(LAN 노출 방화벽/bind 변경 + -Revert 분기). 각 파일이 `_common.ps1` dot-source 소비자이므로 본 task 와 동형 패턴.
