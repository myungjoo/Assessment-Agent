---
id: T-0972
title: deploy/local-llm-example/status.ps1 진단 상태 표시 스크립트 내부 계약(dot-source _common.ps1·config-sourced 값 표시(하드코딩 아님)·서버 ONLINE/OFFLINE 분기·version 조회 try/catch·exe 미발견 early-return·ollama ps/list 진단·nvidia-smi 선택 분기) 정적 smoke
phase: P5
status: DONE
mergedAs: 5a9a9cb4
prNumber: 866
reviewRounds: 1
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 470
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0971(stop-llm.ps1 언로드/서버종료/CLI폴백, 470 LOC)·T-0970(start-llm.ps1 기동+예열, 470 LOC)·T-0967(_common.ps1 코드-정본 parity, 593 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·config-sourced 표시 값·서버 ONLINE/OFFLINE 분기·version try/catch·exe 미발견 early-return·ollama ps/list 진단·nvidia-smi 선택 분기·심볼 소비(Get-LlmConfig/Get-LocalApiBase/Test-OllamaServer/Get-OllamaExe) _common.ps1 실존 대조·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·status.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-status-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-status-ps1-diagnostics-config-sourced-server-online-offline-version-trycatch-exe-earlyreturn-ollama-ps-list-nvidiasmi-branch-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)·_common.ps1(T-0967)·README(T-0968)·install.ps1(T-0969)·start-llm.ps1(T-0970)·stop-llm.ps1(T-0971) 봉함 뒤 그 헬퍼 dot-source 소비자 중 4순위(read-only 진단 진입점) status.ps1 이 내부계약 smoke 미봉(README 테이블 parity 제외 NONE). 진단 표시/ONLINE-OFFLINE/exe-early-return 계약 drift→운영자 상태 오진단. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0972 — deploy/local-llm-example/status.ps1 진단 상태 표시 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)·그 config 를 코드로 소비하는 공용 헬퍼(_common.ps1, T-0967)·운영자 사용법 문서(README.md, T-0968)·1순위 설치 진입점(install.ps1, T-0969)·2순위 기동/예열 진입점(start-llm.ps1, T-0970)·3순위 자원 해제 진입점(stop-llm.ps1, T-0971)을 봉했다. 그다음 운영자가 **현재 로컬 LLM 상태를 한눈에 확인하려고 쓰는 4순위 read-only 진단 진입점** `deploy/local-llm-example/status.ps1` 은 아직 내부 계약 smoke 미봉이다(origin/main grep 확인 — `test/` 의 유일한 `status.ps1` 참조는 T-0968 README 런북 script 테이블 cross-ref 뿐, status.ps1 내부 계약을 앵커하는 dedicated spec NONE). 이 스크립트는 `_common.ps1` 을 dot-source 해 `Get-LlmConfig`(T-0967 봉함)로 config 정본을 읽고, `Get-LocalApiBase`·`Test-OllamaServer`·`Get-OllamaExe` 로 서버 생존/실행 파일을 판정한 뒤, 설정 요약·서버 ONLINE/OFFLINE·적재 모델(`ollama ps`)·받아둔 모델(`ollama list`)·(선택) GPU 사용량(`nvidia-smi`)을 표시한다.

핵심 위험은 **진단 표시 계약 drift**다. (1) `status.ps1` 이 config-sourced 값(`$cfg.OLLAMA_MODEL`·`$cfg.OLLAMA_HOST`·`$cfg.OLLAMA_KEEP_ALIVE`·`$cfg.OPENAI_BASE_URL`)을 표시하지 않고 `gemma4:12b`/`127.0.0.1:11434` 같은 literal 을 하드코딩하기 시작하면 config.env 정본(T-0966)과 조용히 divergence 해 운영자가 실제와 다른 설정을 본다 — 본 task 의 1순위 계약은 status.ps1 이 표시 값을 `Get-LlmConfig` 결과(`$cfg.*`)로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 참조하고 그 값을 하드코딩하지 않음이다. (2) 서버 생존은 `if (Test-OllamaServer -ApiBase $apiBase)` 로 판정해 true 면 ONLINE(+`/api/version` 조회), false 면 OFFLINE 안내로 갈라져야 한다 — 이 분기가 어긋나면 상태가 반대로 표시된다. (3) version 조회는 `try { Invoke-RestMethod -Uri "$apiBase/api/version" ... } catch { ... }` 로 감싸 실패해도 ONLINE 표시가 치명화되지 않아야 한다 — try/catch 가 빠지면 version API 미지원/타임아웃에서 스크립트가 죽어 상태를 못 본다. (4) `Get-OllamaExe` 결과가 없으면(`if (-not $exe)`) "install.ps1 을 먼저 실행" 안내 후 `return`(early-exit)해야 한다 — 이 skip 이 빠지면 없는 exe 로 `& $exe ps` 를 호출해 오진단된다. (5) exe 가 있으면 `& $exe ps`(적재 모델)·`& $exe list`(받아둔 모델) 두 진단을 실행하고, `nvidia-smi` 는 `Get-Command nvidia-smi -ErrorAction SilentlyContinue` 로 존재할 때만(`if ($smi)`) 선택적으로 실행해야 한다 — nvidia-smi 를 무조건 호출하면 GPU 없는 호스트에서 오류가 난다. 이 계약이 어긋나면 상태 진단(PLAN §108/§109)이 조용히 오작동한다.

본 task 는 그 진단 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 중 4순위 read-only 진단 진입점을 stop-llm.ps1(T-0971) 위에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/status.ps1` 전체(~57행) — dot-source 행(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')`)·config 소비(`$cfg = Get-LlmConfig`·`$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST`·`$exe = Get-OllamaExe`)·설정 요약 표시(`MODEL={0} HOST={1} KEEP_ALIVE={2}` 를 `$cfg.OLLAMA_MODEL, $cfg.OLLAMA_HOST, $cfg.OLLAMA_KEEP_ALIVE` 로·`endpointUrl(AA): {0}` 를 `$cfg.OPENAI_BASE_URL` 로)·서버 분기(`if (Test-OllamaServer -ApiBase $apiBase)` → try `Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 3` ONLINE / catch ONLINE fallback / `else` OFFLINE 안내)·exe 미발견 early-return(`if (-not $exe) { Write-Host "...install.ps1..."; return }`)·진단(`& $exe ps`·`& $exe list`)·GPU 선택 분기(`$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue; if ($smi) { & nvidia-smi --query-gpu=... --format=csv }`). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`). status.ps1 이 이 값을 하드코딩하지 않고 `$cfg.*` 로 참조함을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-OllamaExe`(line 49)·`Get-LocalApiBase`(line 66)·`Test-OllamaServer`(line 74) 함수 정의 존재. status.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 `function` grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-stop-llm-ps1-model-unload-keepalive0-config-sourced-cli-fallback-stopserver-branch-contract.smoke-spec.ts`(T-0971) 또는 start-llm.ps1 형제 spec(T-0970) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/분기 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 status.ps1 의 config-sourced 표시+서버 ONLINE/OFFLINE 분기+version try/catch+exe 미발견 early-return+ollama ps/list 진단+nvidia-smi 선택 분기 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-status-ps1-diagnostics-config-sourced-server-online-offline-version-trycatch-exe-earlyreturn-ollama-ps-list-nvidiasmi-branch-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/status.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama ps/list/실 nvidia-smi/실 HTTP 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0971/T-0970 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: status.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 status.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-LocalApiBase`·`Test-OllamaServer`·`Get-OllamaExe`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced 표시 값 계약, 1순위)**: status.ps1 이 설정 요약을 `$cfg.OLLAMA_MODEL`·`$cfg.OLLAMA_HOST`·`$cfg.OLLAMA_KEEP_ALIVE`·`$cfg.OPENAI_BASE_URL` 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 **참조**하고, `gemma4:12b`·`127.0.0.1:11434`·`5m`·`http://127.0.0.1:11434/v1` 같은 config 값 literal 을 status.ps1 본문에 **하드코딩하지 않음**을 단언하는 assert 각 1+ (하드코딩 검출 시 config.env 정본과 divergence 위험). config.env 는 그 값의 정본으로만 참조(byte 값 대조 근거).
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - 서버 ONLINE/OFFLINE 분기(`if (Test-OllamaServer -ApiBase $apiBase)` → ONLINE 표시 / `else` → OFFLINE 안내) 양쪽 존재,
  - version 조회 try/catch(`try { Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 3 } catch { ... }` — API 실패해도 ONLINE 표시 치명화 안 됨) 존재,
  - exe 미발견 early-return 분기(`if (-not $exe)` → "install.ps1" 안내 + `return`, 이후 `& $exe ps`/`list` 미도달) 존재,
  - 진단 실행(`& $exe ps`·`& $exe list` 두 호출) 존재,
  - nvidia-smi 선택 분기(`$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue` + `if ($smi) { & nvidia-smi ... }` — 조건부 실행) 존재.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) status.ps1 에 config 값 `gemma4:12b`(또는 `127.0.0.1:11434`)를 설정 요약에 literal 로 하드코딩한 mutant → config-sourced 표시 값 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) 서버 판정 `if (Test-OllamaServer ...)` 의 `else`(OFFLINE 안내) 분기를 제거한 mutant → ONLINE/OFFLINE 분기 drift 검출,
  - (d) version 조회의 `try`/`catch` 를 제거(bare `Invoke-RestMethod`)한 mutant → version 실패 비치명 계약 drift 검출,
  - (e) exe 미발견 분기의 `return` early-exit 를 제거(없는 exe 로 `& $exe ps` 진행)한 mutant → skip 분기 drift 검출,
  - (f) nvidia-smi 의 `if ($smi)` 가드(또는 `Get-Command ... -ErrorAction SilentlyContinue`)를 제거해 무조건 `& nvidia-smi` 실행하는 mutant → GPU 선택 분기 drift 검출,
  - (g) status.ps1 이 호출하는 `Test-OllamaServer`(또는 `Get-LocalApiBase`)를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `status.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·모델 tag `gemma4:12b`·endpoint `/api/version`·`http://127.0.0.1:11434/v1`·진단 명령 `ollama ps`/`ollama list`/`nvidia-smi` 같은 비시크릿 설정 값/경로만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 `gemma4:12b` literal·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/기동 0 이므로 green, R-113).

## Out of Scope

- `status.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 Ollama ps/list·실 nvidia-smi·실 HTTP GET(`/api/version`)·실 Invoke-RestMethod·실 Get-Command 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Get-LocalApiBase 포트·Test-OllamaServer 폴링·Get-OllamaExe 탐색 mechanics 등)은 T-0967 소관 — 본 task 는 status.ps1 이 그 심볼을 호출/소비하는 배선만.
- 나머지 미봉 스크립트(`test-llm.ps1`·`expose-lan.ps1`)의 내부 계약은 후속 별도 task — Follow-ups 참고.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 local-llm-example 스크립트 static-smoke 후속(각 1 task): `test-llm.ps1`(`/v1/chat/completions` 스모크 wire 포맷·config-sourced endpoint/model)·`expose-lan.ps1`(LAN 노출 방화벽/bind 변경 + `-Revert` 분기·`LAN_ALLOW_CIDR` 소비). 각 파일이 `_common.ps1` dot-source 소비자이므로 본 task 와 동형 패턴.
