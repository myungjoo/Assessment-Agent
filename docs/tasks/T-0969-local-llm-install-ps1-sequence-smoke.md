---
id: T-0969
title: deploy/local-llm-example/install.ps1 설치 스크립트 내부 계약(dot-source _common.ps1·CmdletBinding 2-switch·config-sourced 값(하드코딩 아님)·5-step ordered 시퀀스·[1/5] winget→직접다운로드 fallback+멱등 guard·[2/5] env-var User+session dual-write·[3/5] HKCU Run 자동시작 -NoAutostart 분기·[4/5] 서버 재기동+Wait-OllamaServer 60s·[5/5] -NoModelPull 분기+pull 실패 non-fatal) 정적 smoke
phase: P5
status: DONE
completedAt: 2026-07-13T21:59:00Z
mergedAs: 7ba763b8
prNumber: 863
reviewRounds: 2
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 560
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0967(_common.ps1 코드-기본값 cross-parity, 593 LOC)·T-0966(config.env 내부+seed cross-parity, 526 LOC)·T-0965(deploy/README runbook, 694 LOC)·T-0964(env.prod.example, 648 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·CmdletBinding 2-switch·config-sourced 값·5-step ordered 시퀀스·[1/5] winget→직접다운로드 fallback+Get-OllamaExe 멱등 guard·[2/5] env-var User scope+session dual-write·[3/5] HKCU Run 자동시작 등록/제거 분기·[4/5] Stop-Process→serve→Wait-OllamaServer 60s·[5/5] -NoModelPull skip+pull LASTEXITCODE non-fatal·negative mutant a~h 8종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·install.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-install-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-install-ps1-ordered-sequence-config-sourced-idempotent-fallback-envvar-autostart-restart-modelpull-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)·_common.ps1 공용 헬퍼(T-0967)·README(T-0968) 봉함 뒤 그 헬퍼를 dot-source 하는 개별 스크립트 중 1순위 진입점 install.ps1 이 smoke 미봉(grep NONE). 설치·env-var·자동시작·서버기동·모델pull 5-step 시퀀스 drift→운영자 오설치. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0969 — deploy/local-llm-example/install.ps1 설치 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)·그 config 를 코드로 소비하는 공용 헬퍼(_common.ps1, T-0967)·운영자 사용법 문서(README.md, T-0968)를 봉했다. 그러나 운영자가 로컬 LLM 을 실제로 **세우는 1순위 진입점** `deploy/local-llm-example/install.ps1` 은 아직 smoke 미봉이다(origin/main grep 확인 — `test/` 에 `install.ps1` 참조 spec NONE). 이 스크립트는 `_common.ps1` 을 dot-source 해 `Get-LlmConfig`/`Get-LocalApiBase`(T-0967 봉함) 로 config 정본을 읽고, Ollama 설치→환경변수→자동시작→서버 재기동→모델 pull 의 5-step 을 순서대로 수행한다.

핵심 위험은 **설치 시퀀스 계약 drift**다. (1) `install.ps1` 이 config-sourced 값을 쓰지 않고 `gemma4:12b`/`11434` 같은 literal 을 하드코딩하기 시작하면 config.env 정본(T-0966)과 조용히 divergence 한다 — 본 task 의 1순위 계약은 install.ps1 이 모델/HOST/KEEP_ALIVE 를 `$cfg.OLLAMA_MODEL`/`$cfg.OLLAMA_HOST`/`$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과) 로 참조하고 그 값을 하드코딩하지 않음이다. (2) `[1/5]` 설치 단계의 멱등 guard(`Get-OllamaExe` 존재 시 skip)와 fallback chain(winget `--silent` → `LASTEXITCODE -eq 0` 판정 실패 시 `Invoke-WebRequest OllamaSetup.exe` 직접 다운로드 → `/VERYSILENT /NORESTART` 무인 설치 → 재확인 후 미발견 시 `throw`)이 변질되면 설치가 조용히 실패하거나 재실행이 깨진다. (3) `[2/5]` 환경변수를 `[Environment]::SetEnvironmentVariable(...,'User')`(영속 User scope, 데몬이 읽음) 와 `$env:`(현 세션) 로 **이중 기록**해야 재기동 서버가 즉시 정책을 반영한다 — 한쪽만 쓰면 재부팅/재기동 후 정책 미반영. (4) `[3/5]` 자동시작은 HKCU `Run` 키 `Ollama` 를 `-NoAutostart` 시 제거(이미 없으면 skip)·기본 시 부재하면 등록(`Get-OllamaAppExe`+`New-ItemProperty`)하는 분기여야 한다. (5) `[4/5]` 는 모든 ollama 프로세스 정리→2초 대기→`serve` 재기동→`Wait-OllamaServer -TimeoutSec 60` 헬스 대기(미응답 시 non-fatal warning), (6) `[5/5]` 는 `-NoModelPull` skip 분기 + `& $exe pull` 후 `LASTEXITCODE -ne 0` non-fatal warning 이어야 한다. 이 시퀀스가 어긋나면 무인 재배포(PLAN §109)의 로컬 LLM 준비가 조용히 오설치된다.

본 task 는 그 설치 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 중 1순위 진입점을 config.env(T-0966)·README(T-0968) 위에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/install.ps1` 전체 — line 10~14(`[CmdletBinding()]` + `-NoModelPull`/`-NoAutostart` 2 switch)·line 16(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')` dot-source)·line 17~18(`Get-LlmConfig`/`Get-LocalApiBase` 소비)·line 23~50([1/5] 멱등 guard+winget→직접다운로드 fallback+throw)·line 52~58([2/5] env-var User+session dual-write, `$cfg` 값 사용)·line 60~81([3/5] HKCU Run 자동시작 등록/제거 분기)·line 83~97([4/5] Stop-Process→sleep 2→serve→Wait-OllamaServer 60s→non-fatal warn)·line 99~111([5/5] -NoModelPull skip + `& $exe pull $cfg.OLLAMA_MODEL` + LASTEXITCODE non-fatal). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`). install.ps1 이 이 값을 하드코딩하지 않고 `$cfg.*` 로 참조함을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-LocalApiBase`(line 66)·`Get-OllamaExe`(line 49)·`Get-OllamaAppExe`(line 58)·`Wait-OllamaServer`(line 85) 함수 정의 존재. install.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-common-ps1-config-default-single-source-parity-envparse-mergeorder-apibase-port-gitignore-contract.smoke-spec.ts`(T-0967) 또는 `...config-env-internal-template-parity-contract.smoke-spec.ts`(T-0966) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/시퀀스 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 install.ps1 의 5-step 시퀀스+config-sourced 참조+fallback/분기 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-install-ps1-ordered-sequence-config-sourced-idempotent-fallback-envvar-autostart-restart-modelpull-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/install.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama 설치·기동/실 winget·Invoke-WebRequest/실 레지스트리 쓰기 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0966/T-0967 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: install.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 install.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-LocalApiBase`·`Get-OllamaExe`·`Get-OllamaAppExe`·`Wait-OllamaServer`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced 값 계약, 1순위)**: install.ps1 이 모델/HOST/KEEP_ALIVE 를 `$cfg.OLLAMA_MODEL`·`$cfg.OLLAMA_HOST`·`$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과) 로 **참조**하고, `gemma4:12b`·`127.0.0.1:11434`·`5m` 같은 config 값 literal 을 install.ps1 본문에 **하드코딩하지 않음**을 단언하는 assert 각 1+ (하드코딩 검출 시 config.env 정본과 divergence 위험). config.env 는 그 값의 정본으로만 참조(byte 값 대조 근거).
- [ ] **Happy-path(CmdletBinding + 2-switch param 계약)**: `[CmdletBinding()]` 존재 + `param` 블록에 `[switch]$NoModelPull`·`[switch]$NoAutostart` 정확히 2개 switch 가 선언됨을 단언하는 assert 1+.
- [ ] **Happy-path(5-step ordered 시퀀스 계약)**: `[1/5]`~`[5/5]` 배너가 소스에서 **오름차순 단조 순서**로 정확히 1회씩 등장하고, 각 단계 의미가 순서대로 (1) 설치→(2) 환경변수→(3) 자동시작→(4) 서버 재기동+헬스대기→(5) 모델 pull 임을 단언하는 assert(단계당 1+ 또는 순서 배열 1+).
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - `[1/5]` 멱등 guard(`Get-OllamaExe` 존재 시 skip) + fallback chain(winget `LASTEXITCODE -eq 0` 성공 판정 → 실패 시 `Invoke-WebRequest` `OllamaSetup.exe` 직접 다운로드 → `/VERYSILENT`+`/NORESTART` 무인 설치 → 재확인 후 미발견 시 `throw`) 순서·토큰 존재,
  - `[2/5]` env-var **dual-write**(`[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE'/'OLLAMA_HOST', ..., 'User')` 영속 User scope 2개 + `$env:OLLAMA_KEEP_ALIVE`/`$env:OLLAMA_HOST` 세션 2개) 4개 write 모두 존재,
  - `[3/5]` 자동시작 분기(`-NoAutostart` → HKCU `Run` 키 `Ollama` `Remove-ItemProperty`(이미 없으면 skip) / else → 부재 시 `Get-OllamaAppExe`+`New-ItemProperty` 등록),
  - `[4/5]` 서버 재기동(`Stop-Process` 로 ollama 프로세스 정리 → `Start-Sleep -Seconds 2` → `Start-Process ... 'serve' -WindowStyle Hidden` → `Wait-OllamaServer -ApiBase $apiBase -TimeoutSec 60` → 미응답 시 `Write-Warning` non-fatal),
  - `[5/5]` 모델 pull 분기(`-NoModelPull` → skip / else → `& $exe pull $cfg.OLLAMA_MODEL` + `LASTEXITCODE -ne 0` non-fatal `Write-Warning`).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~h 8종):
  - (a) install.ps1 에 config 값 `gemma4:12b` 를 literal 로 하드코딩한 mutant → config-sourced 값 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) `[3/5]` 배너를 제거해 4-step 으로 만든 mutant → 5-step ordered 시퀀스 단조성 위반 검출,
  - (d) `[2/5]` 에서 `$env:OLLAMA_HOST` 세션 write 를 제거한 mutant → env-var dual-write 계약 drift(세션측 누락) 검출,
  - (e) winget fallback 의 `Invoke-WebRequest` 직접 다운로드 분기를 제거한 mutant → 설치 fallback chain drift 검출,
  - (f) `-NoModelPull` switch 를 param 에서 제거한 mutant → 2-switch param 계약 drift 검출,
  - (g) `Wait-OllamaServer` 호출을 제거한 mutant → `[4/5]` 헬스 대기 계약 drift 검출,
  - (h) install.ps1 이 호출하는 `Get-LocalApiBase` 를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `install.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·모델 tag `gemma4:12b`·keep-alive `5m`·다운로드 URL `https://ollama.com/download/OllamaSetup.exe`·레지스트리 경로·`/VERYSILENT` 같은 비시크릿 설정 값/경로/플래그만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 `gemma4:12b` literal·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/설치 0 이므로 green, R-113).

## Out of Scope

- `install.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 Ollama 설치/기동/pull·실 winget·Invoke-WebRequest·실 레지스트리 쓰기·실 markdown 렌더 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Read-EnvFile 형식·Get-LocalApiBase 포트 등)은 T-0967 소관 — 본 task 는 install.ps1 이 그 심볼을 호출/소비하는 배선만.
- 나머지 미봉 스크립트(`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`expose-lan.ps1`)의 내부 계약은 후속 별도 task — Follow-ups 참고.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 local-llm-example 스크립트 static-smoke 후속(각 1 task): `start-llm.ps1`(서버 보장 기동 + -NoWarm 예열 분기)·`stop-llm.ps1`(모델 언로드 + -StopServer 분기)·`status.ps1`(서버/버전·ollama ps·list·nvidia-smi 진단)·`test-llm.ps1`(/v1/chat/completions 스모크 wire 포맷)·`expose-lan.ps1`(LAN 노출 방화벽/bind 변경 + -Revert 분기). 각 파일이 `_common.ps1` dot-source 소비자이므로 본 task 와 동형 패턴.
