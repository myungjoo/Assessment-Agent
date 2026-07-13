---
id: T-0971
title: deploy/local-llm-example/stop-llm.ps1 모델 언로드+서버종료+CLI 폴백 스크립트 내부 계약(dot-source _common.ps1·CmdletBinding 1-switch(-StopServer)·config-sourced 값(하드코딩 아님)·서버 미기동 early-return skip·모델 언로드 POST /api/generate body(model config-sourced·keep_alive=0)·API 실패 catch CLI stop 폴백·-StopServer 서버 프로세스 종료 분기·else 서버 유지 안내) 정적 smoke
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 470
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0970(start-llm.ps1 기동+예열, 470 LOC)·T-0969(install.ps1 5-step, 560 LOC)·T-0967(_common.ps1 코드-정본 parity, 593 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·CmdletBinding 1-switch(-StopServer)·config-sourced model 값·서버 미기동 early-return skip 분기·언로드 POST /api/generate body(keep_alive=0·model $cfg 참조)·API 실패 catch CLI stop 폴백·-StopServer 서버 프로세스 종료 분기·else 서버 유지 안내·심볼 소비(Get-LlmConfig/Get-LocalApiBase/Test-OllamaServer/Get-OllamaExe) _common.ps1 실존 대조·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·stop-llm.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-stop-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-stop-llm-ps1-model-unload-keepalive0-config-sourced-cli-fallback-stopserver-branch-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)·_common.ps1(T-0967)·README(T-0968)·install.ps1(T-0969)·start-llm.ps1(T-0970) 봉함 뒤 그 헬퍼 dot-source 소비자 중 3순위(운영 후 자원 해제 진입점) stop-llm.ps1 이 내부계약 smoke 미봉(README 테이블 parity 제외 NONE). 모델 언로드/서버종료/CLI 폴백 계약 drift→운영자 자원 오해제. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0971 — deploy/local-llm-example/stop-llm.ps1 모델 언로드+서버종료+CLI 폴백 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)·그 config 를 코드로 소비하는 공용 헬퍼(_common.ps1, T-0967)·운영자 사용법 문서(README.md, T-0968)·1순위 설치 진입점(install.ps1, T-0969)·2순위 기동/예열 진입점(start-llm.ps1, T-0970)을 봉했다. 그다음 운영자가 사용을 끝내고 **GPU/메모리 자원을 해제하려고 쓰는 3순위 진입점** `deploy/local-llm-example/stop-llm.ps1` 은 아직 내부 계약 smoke 미봉이다(origin/main grep 확인 — `test/` 의 유일한 `stop-llm.ps1` 참조는 T-0968 README 런북 script 테이블 cross-ref 뿐, stop-llm.ps1 내부 계약을 앵커하는 dedicated spec NONE). 이 스크립트는 `_common.ps1` 을 dot-source 해 `Get-LlmConfig`(T-0967 봉함)로 config 정본을 읽고, 서버 생존 확인(`Test-OllamaServer`)→모델 언로드(POST `/api/generate` keep_alive=0)→(API 실패 시) CLI 폴백→(옵션) 서버 프로세스 종료의 흐름을 수행한다.

핵심 위험은 **자원 해제 계약 drift**다. (1) `stop-llm.ps1` 이 config-sourced 값을 쓰지 않고 `gemma4:12b`/`11434` 같은 literal 을 하드코딩하기 시작하면 config.env 정본(T-0966)과 조용히 divergence 한다 — 본 task 의 1순위 계약은 stop-llm.ps1 이 언로드 body 의 model 을 `$cfg.OLLAMA_MODEL`(=Get-LlmConfig 결과) 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 참조하고 그 값을 하드코딩하지 않음이다. (2) 서버가 이미 꺼져 있으면(`-not (Test-OllamaServer ...)`) "해제할 자원 없음" 안내 후 `return`(early-exit, skip)해야 한다 — 이 skip 이 빠지면 죽은 서버에 언로드 POST 를 던져 오진단된다. (3) 모델 언로드는 `@{ model=$cfg.OLLAMA_MODEL; keep_alive=0 }` 를 `ConvertTo-Json` 해 `$apiBase/api/generate` 로 POST(`TimeoutSec 30`)해야 한다 — model 은 config-sourced, `keep_alive` 는 `0`(즉시 VRAM 해제 계약의 핵심 값). (4) API 언로드 실패는 `catch` 에서 `Get-OllamaExe` 로 CLI 실행 파일을 찾아 `& $exe stop $cfg.OLLAMA_MODEL` 로 폴백해야 한다 — 이 폴백이 빠지면 API 버전차에서 언로드가 조용히 무산된다. (5) `-StopServer` switch 는 언로드 후 추가로 `Get-Process -Name 'ollama app','ollama' | Stop-Process -Force` 로 서버 프로세스까지 종료해야 하고, switch 없으면 `else` 로 "서버는 유지(idle, VRAM 0)" 안내여야 한다 — 이 분기가 어긋나면 -StopServer 가 무시돼 idle 점유가 남거나, 반대로 옵션 없이 서버가 죽어 다음 요청이 실패한다. 이 계약이 어긋나면 사용 후 자원 해제(PLAN §108/§109)가 조용히 오작동한다.

본 task 는 그 자원 해제 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 중 3순위 운영 진입점을 start-llm.ps1(T-0970) 위에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/stop-llm.ps1` 전체(42행) — line 9~10(`[CmdletBinding()]` + `param([switch]$StopServer)` 정확히 1 switch)·line 12(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')` dot-source)·line 13~14(`$cfg = Get-LlmConfig`·`$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 소비)·line 16~19(`if (-not (Test-OllamaServer -ApiBase $apiBase))` → 안내 + `return` early-exit skip)·line 23~24(언로드 body `@{ model = $cfg.OLLAMA_MODEL; keep_alive = 0 }` `ConvertTo-Json`)·line 25~33(`Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post ... -TimeoutSec 30` try + `catch { Write-Warning ...; $exe = Get-OllamaExe; if ($exe) { & $exe stop $cfg.OLLAMA_MODEL } }` CLI 폴백)·line 35~41(`if ($StopServer)` → `Get-Process -Name 'ollama app','ollama' ... | Stop-Process -Force` 서버 종료 / `else` → 서버 유지 안내). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`). stop-llm.ps1 이 이 값을 하드코딩하지 않고 `$cfg.*` 로 참조함을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-OllamaExe`(line 49)·`Get-LocalApiBase`(line 66)·`Test-OllamaServer`(line 74) 함수 정의 존재. stop-llm.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 `function` grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-start-llm-ps1-server-ensure-config-sourced-warm-nowarm-branch-nonfatal-contract.smoke-spec.ts`(T-0970) 또는 install.ps1 형제 spec(T-0969) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/분기 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 stop-llm.ps1 의 config-sourced 참조+서버 미기동 early-return+언로드 body(keep_alive=0)+CLI 폴백+-StopServer 분기 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-stop-llm-ps1-model-unload-keepalive0-config-sourced-cli-fallback-stopserver-branch-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/stop-llm.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama 언로드/서버 종료·실 HTTP 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0970/T-0969 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: stop-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 stop-llm.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-LocalApiBase`·`Test-OllamaServer`·`Get-OllamaExe`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced 값 계약, 1순위)**: stop-llm.ps1 이 언로드 body 의 model 을 `$cfg.OLLAMA_MODEL`(=Get-LlmConfig 결과) 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로, CLI 폴백 인자를 `$cfg.OLLAMA_MODEL` 로 **참조**하고, `gemma4:12b`·`127.0.0.1:11434` 같은 config 값 literal 을 stop-llm.ps1 본문에 **하드코딩하지 않음**을 단언하는 assert 각 1+ (하드코딩 검출 시 config.env 정본과 divergence 위험). config.env 는 그 값의 정본으로만 참조(byte 값 대조 근거).
- [ ] **Happy-path(CmdletBinding + 1-switch param 계약)**: `[CmdletBinding()]` 존재 + `param` 블록에 `[switch]$StopServer` 정확히 1개 switch 가 선언됨(그 외 switch 없음)을 단언하는 assert 1+.
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - 서버 미기동 early-return skip 분기(`if (-not (Test-OllamaServer -ApiBase $apiBase))` → "해제할 자원 없음" 안내 + `return`, 이후 언로드 코드 미도달) 존재,
  - 모델 언로드 body 계약(`ConvertTo-Json` 대상 hashtable 에 `model = $cfg.OLLAMA_MODEL`·`keep_alive = 0` 2 필드) + POST 배선(`Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post ... -ContentType 'application/json' -TimeoutSec 30`) 존재,
  - API 언로드 실패 CLI 폴백 분기(`catch { ...; $exe = Get-OllamaExe; if ($exe) { & $exe stop $cfg.OLLAMA_MODEL } }` — API 실패가 치명화되지 않고 CLI 로 재시도) 존재,
  - `-StopServer` 서버 종료 분기(`if ($StopServer)` → `Get-Process -Name 'ollama app', 'ollama' ... | Stop-Process -Force`) 와 `else`(서버 유지 안내) 양쪽 존재.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) stop-llm.ps1 에 config 값 `gemma4:12b` 를 언로드 body 에 literal 로 하드코딩한 mutant → config-sourced 값 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) 서버 미기동 분기의 `return` early-exit 를 제거(꺼진 서버에도 언로드 진행)한 mutant → skip 분기 drift 검출,
  - (d) 언로드 body 의 `keep_alive = 0` 을 `keep_alive = '5m'`(또는 필드 제거)로 바꾼 mutant → 즉시 VRAM 해제 계약 drift 검출,
  - (e) `catch` 의 CLI 폴백(`& $exe stop ...`)을 제거한 mutant → API 실패 폴백 계약 drift 검출,
  - (f) `-StopServer` 분기의 `Stop-Process -Force`(또는 `if ($StopServer)` 조건)를 제거한 mutant → 서버 종료 분기 drift 검출,
  - (g) stop-llm.ps1 이 호출하는 `Test-OllamaServer`(또는 `Get-OllamaExe`)를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `stop-llm.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·모델 tag `gemma4:12b`·endpoint `/api/generate`·프로세스명 `ollama app`/`ollama` 같은 비시크릿 설정 값/경로만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 `gemma4:12b`/`5m` literal·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/기동 0 이므로 green, R-113).

## Out of Scope

- `stop-llm.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 Ollama 언로드/서버 종료·실 HTTP POST·실 `Stop-Process`·실 Invoke-RestMethod 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Get-LocalApiBase 포트·Test-OllamaServer 폴링·Get-OllamaExe 탐색 mechanics 등)은 T-0967 소관 — 본 task 는 stop-llm.ps1 이 그 심볼을 호출/소비하는 배선만.
- 나머지 미봉 스크립트(`status.ps1`·`test-llm.ps1`·`expose-lan.ps1`)의 내부 계약은 후속 별도 task — Follow-ups 참고.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 local-llm-example 스크립트 static-smoke 후속(각 1 task): `status.ps1`(서버/버전·ollama ps·list·nvidia-smi 진단)·`test-llm.ps1`(/v1/chat/completions 스모크 wire 포맷)·`expose-lan.ps1`(LAN 노출 방화벽/bind 변경 + -Revert 분기). 각 파일이 `_common.ps1` dot-source 소비자이므로 본 task 와 동형 패턴.
