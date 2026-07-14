---
id: T-0974
title: deploy/local-llm-example/expose-lan.ps1 LAN 노출 스크립트 내부 계약(dot-source _common.ps1·config-sourced port($cfg.OLLAMA_HOST)/CIDR($cfg.LAN_ALLOW_CIDR)(하드코딩 아님)·관리자 권한 fail-fast exit 1·방화벽 규칙 idempotent remove-then-create·RemoteAddress $cidr 범위제한·-Revert vs expose OLLAMA_HOST(127.0.0.1 vs 0.0.0.0) 분기·서버 재기동 Get-OllamaExe exe-미발견 warning·LAN IP 안내 expose-only) 정적 smoke
phase: P5
status: DONE
completedAt: 2026-07-14T01:15:00Z
mergedAs: 5029204b449218efa5baa519f293e36b4d3cd450
prNumber: 868
reviewRounds: 1
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 470
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0973(test-llm.ps1 wire, 470 LOC)·T-0972(status.ps1 진단, 470 LOC)·T-0971(stop-llm.ps1, 470 LOC)·T-0970(start-llm.ps1, 470 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·config-sourced port/CIDR 참조·관리자 권한 fail-fast exit 1·방화벽 remove-then-create idempotent·RemoteAddress $cidr 범위제한·-Revert vs expose OLLAMA_HOST 분기·서버 재기동 exe-미발견 warning·LAN IP 안내 expose-only·심볼 소비(Get-LlmConfig/Get-OllamaExe/Get-LocalApiBase/Wait-OllamaServer) _common.ps1 실존 대조·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·expose-lan.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-expose-lan-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-expose-lan-ps1-firewall-config-sourced-cidr-revert-expose-branch-admin-failfast-idempotent-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)~test-llm.ps1(T-0973) 봉함 뒤 마지막 미봉 스크립트 expose-lan.ps1(§109 'PC Ollama LAN 노출' 운영 전제 = 이 스크립트). config-sourced port/CIDR·-Revert 분기·방화벽 범위제한 drift→LAN 노출 오설정/보안 범위 확대. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0974 — deploy/local-llm-example/expose-lan.ps1 LAN 노출 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 config 정본(config.env, T-0966)·공용 헬퍼(_common.ps1, T-0967)·README 런북(T-0968)·설치(install.ps1, T-0969)·기동/예열(start-llm.ps1, T-0970)·자원 해제(stop-llm.ps1, T-0971)·진단(status.ps1, T-0972)·실-검증 스모크(test-llm.ps1, T-0973)를 봉했다. 남은 마지막 미봉 스크립트가 `deploy/local-llm-example/expose-lan.ps1` 이다(origin/main grep 확인 — `test/` 에 expose-lan 을 앵커하는 dedicated spec NONE). 이 스크립트는 **PLAN §109 의 운영 전제인 "PC Ollama LAN 노출"을 실제로 수행하는 진입점**이다 — 오너가 2026-07-07 확인한 "PC Ollama 는 이미 LAN 노출됨 → stage 배포 환경에서 사용 가능"의 그 노출 메커니즘. 같은 LAN 의 테스트 서버(예: 192.168.0.7)가 이 PC 의 Ollama 를 OpenAI 호환 endpoint 로 쓰려면 (1) `OLLAMA_HOST` 를 `0.0.0.0:<port>` 로 바꿔 모든 NIC 에 bind + 서버 재기동, (2) Windows 방화벽 inbound 규칙을 config 의 `LAN_ALLOW_CIDR` 범위·TCP `<port>` 로만 열어야 한다. `-Revert` 는 그 노출을 해제(방화벽 규칙 제거 + `OLLAMA_HOST` 를 `127.0.0.1` 로 복귀)한다.

핵심 위험은 **config 소비 계약 drift 와 보안 범위 확대**다. (1) 방화벽 규칙의 허용 범위(`RemoteAddress`)를 config 의 `$cfg.LAN_ALLOW_CIDR`(정본 `192.168.0.0/24`)로 참조하지 않고 `192.168.0.0/24` literal 을 하드코딩하거나 `Any`/전역으로 넓히면, 운영자가 config 로 범위를 좁혀도 조용히 divergence 하거나 의도보다 넓은 범위로 Ollama 를 노출한다 — 본 task 의 1순위 계약은 CIDR 을 `$cfg.LAN_ALLOW_CIDR` 로, 포트를 `$cfg.OLLAMA_HOST` 에서 추출한 값으로 참조하고 하드코딩하지 않음이다. (2) 관리자 권한이 아니면 `New-NetFirewallRule` 이 실패하므로 **fail-fast**(Write-Warning 후 `exit 1`)로 조기 중단해야 한다 — 이게 빠지면 비관리자 실행이 조용히 부분 성공/오작동한다. (3) 방화벽 규칙 생성은 **idempotent**해야 한다(동명 규칙 `Get-NetFirewallRule ... | Remove-NetFirewallRule` 로 먼저 제거한 뒤 `New-NetFirewallRule` 재생성) — remove 단계가 빠지면 재실행 시 중복 규칙이 쌓인다. (4) `-Revert` 분기는 `OLLAMA_HOST` 를 `127.0.0.1:$port`(로컬 전용)로, expose 분기는 `0.0.0.0:$port`(모든 NIC)로 **서로 다르게** 설정해야 하고, 두 분기가 collapse 하면 revert 가 노출을 실제로 해제하지 못한다. (5) 새 bind 적용을 위한 서버 재기동은 `Get-OllamaExe`(T-0967 봉함) 로 exe 를 찾고, 미발견 시 `Write-Warning`(install.ps1 먼저 실행 안내)로 비치명 처리해야 한다. (6) 테스트 서버 `.env` 에 넣을 `SEED_LLM_ENDPOINT_URL` LAN IP 안내는 노출(expose) 분기에서만 표시하고 `-Revert` 에서는 표시하지 않아야 한다.

본 task 는 그 노출 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 8개(install/start/stop/status/test/expose + 헬퍼/config)를 모두 봉하고 deploy/local-llm-example 전 스크립트 내부 계약 앵커를 완성한다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/expose-lan.ps1` 전체(~88행) — param(`[switch]$Revert`)·dot-source 행(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')`)·config 소비(`$cfg = Get-LlmConfig`·포트 추출 `if ($cfg.OLLAMA_HOST -match ':(\d+)\s*$') { $port = $Matches[1] }` 기본 `'11434'`·`$cidr = $cfg.LAN_ALLOW_CIDR`)·규칙명(`$ruleName = 'Ollama LAN (Assessment-Agent local-llm-example)'`)·관리자 권한 확인(`$isAdmin = ([Security.Principal.WindowsPrincipal]...).IsInRole(...Administrator)`·`if (-not $isAdmin) { Write-Warning ...; ...; exit 1 }`)·`Set-FirewallRule` 함수(`Get-NetFirewallRule -DisplayName $ruleName ... | Remove-NetFirewallRule ...` 후 `New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress $cidr -Profile Any`)·`-Revert` 분기(방화벽 제거 + `SetEnvironmentVariable('OLLAMA_HOST', "127.0.0.1:$port", 'User')`)·expose 분기(`SetEnvironmentVariable('OLLAMA_HOST', "0.0.0.0:$port", 'User')` + `Set-FirewallRule`)·서버 재기동(`$exe = Get-OllamaExe`·`if ($exe) { Stop-Process ...; Start-Sleep -Seconds 2; Start-Process serve; $apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST; Wait-OllamaServer ... } else { Write-Warning "ollama.exe 미발견 ..." }`)·LAN IP 안내(`if (-not $Revert) { ... SEED_LLM_ENDPOINT_URL ... }`). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_HOST=127.0.0.1:11434`·`LAN_ALLOW_CIDR=192.168.0.0/24`). expose-lan.ps1 이 포트를 `$cfg.OLLAMA_HOST` 에서, CIDR 을 `$cfg.LAN_ALLOW_CIDR` 로 참조하고 그 값(`192.168.0.0/24`)을 하드코딩하지 않음을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-OllamaExe`(line 49)·`Get-LocalApiBase`(line 66)·`Wait-OllamaServer`(line 85) 함수 정의 존재. expose-lan.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 `function` grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-test-llm-ps1-chat-completions-wire-bearer-utf8-body-throw-exit-branch-contract.smoke-spec.ts`(T-0973) 또는 status.ps1 형제 spec(T-0972) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/분기 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 expose-lan.ps1 의 config-sourced port/CIDR + 관리자 fail-fast + 방화벽 idempotent + -Revert/expose 분기 + RemoteAddress 범위제한 + 서버 재기동 exe-미발견 warning 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-expose-lan-ps1-firewall-config-sourced-cidr-revert-expose-branch-admin-failfast-idempotent-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/expose-lan.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 방화벽 규칙 변경/실 OLLAMA_HOST env 변경/실 서버 재기동 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0973/T-0972 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: expose-lan.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 expose-lan.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-OllamaExe`·`Get-LocalApiBase`·`Wait-OllamaServer`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced port/CIDR 계약, 1순위)**: expose-lan.ps1 이 포트를 `$cfg.OLLAMA_HOST`(정규식 `:(\d+)\s*$`)에서 추출하고, 방화벽 허용 범위를 `$cfg.LAN_ALLOW_CIDR` 로 **참조**하며 `192.168.0.0/24` 같은 config 값 CIDR literal 을 `New-NetFirewallRule -RemoteAddress` 에 **하드코딩하지 않음**을 단언하는 assert 각 1+. 방화벽 규칙이 `-Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress $cidr` shape(범위 제한 — `Any`/전역 아님)임을 단언하는 assert 1+. config.env 는 그 값의 정본으로만 참조(값 대조 근거).
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - `-Revert` 분기: 방화벽 규칙 제거 + `OLLAMA_HOST` 를 `127.0.0.1:$port`(로컬 전용)로 설정 존재,
  - expose(비-Revert) 분기: `OLLAMA_HOST` 를 `0.0.0.0:$port`(모든 NIC bind)로 설정 + `Set-FirewallRule` 호출 존재 — 두 분기의 OLLAMA_HOST 값이 서로 다름(127.0.0.1 vs 0.0.0.0),
  - 관리자 권한 아님 분기: `if (-not $isAdmin)` → `Write-Warning` + `exit 1`(fail-fast) 존재,
  - 서버 재기동: `$exe = Get-OllamaExe` 존재 시 `Stop-Process`+`Start-Process serve`+`Wait-OllamaServer`, 미발견 시 `Write-Warning "ollama.exe 미발견 ..."`(비치명, install 먼저 안내) 존재,
  - LAN IP 안내(`SEED_LLM_ENDPOINT_URL`)가 `if (-not $Revert)` 가드로 expose 분기에서만 표시 존재.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) `New-NetFirewallRule -RemoteAddress` 를 `$cidr` 대신 `192.168.0.0/24` literal 로 하드코딩한 mutant → config-sourced CIDR 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) `-Revert` 분기의 OLLAMA_HOST 를 `0.0.0.0:$port`(expose 와 동일)로 바꾼 mutant → revert/expose 분기 collapse 검출,
  - (d) `New-NetFirewallRule -RemoteAddress $cidr` 을 `-RemoteAddress Any`(또는 옵션 제거)로 넓힌 mutant → 방화벽 범위제한(보안) 계약 drift 검출,
  - (e) 관리자 아님 분기의 `exit 1` 을 제거(비관리자여도 계속 진행)한 mutant → fail-fast 분기 drift 검출,
  - (f) `Set-FirewallRule` 에서 `Get-NetFirewallRule ... | Remove-NetFirewallRule`(선-제거)를 삭제한 mutant → 규칙 idempotent(remove-then-create) 계약 drift 검출,
  - (g) expose-lan.ps1 이 호출하는 `Get-OllamaExe`(또는 `Wait-OllamaServer`)를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `expose-lan.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1`/`0.0.0.0:11434`·CIDR `192.168.0.0/24`·방화벽 규칙명 문자열 같은 비시크릿 설정 값/경로만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 CIDR literal·`Any`·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/방화벽/기동 0 이므로 green, R-113).

## Out of Scope

- `expose-lan.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 `New-NetFirewallRule`/`Remove-NetFirewallRule`·실 `SetEnvironmentVariable('OLLAMA_HOST', ...)`·실 서버 재기동·실 `Get-NetIPAddress` 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Get-LocalApiBase 포트·Wait-OllamaServer 폴링 mechanics·Get-OllamaExe 탐색 경로 등)은 T-0967 소관 — 본 task 는 expose-lan.ps1 이 그 심볼을 호출/소비하는 배선만.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 task 머지로 `deploy/local-llm-example/` 전 스크립트(config.env·_common.ps1·README·install·start·stop·status·test·expose-lan) 내부 계약 정적 앵커 완성 = 로컬 Ollama live-LLM 운영 premise leg 봉함. 다음 자연 진행은 PLAN §109 실 평가 e2e(github.com myungjoo/leemgs 공개 활동 → 로컬 Ollama 실 LLM 평가) 배선 — 단 운영 전제(github read-scope PAT 주입·PC Ollama LAN 노출 실증)는 credential/env 층이라 코드 task 는 env-gated skip-by-default live spec(eval-live T-0610 / collection-live T-0806 선례) 형태로 planner 가 별도 큐잉.
