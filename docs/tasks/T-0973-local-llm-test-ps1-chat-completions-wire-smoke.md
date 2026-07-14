---
id: T-0973
title: deploy/local-llm-example/test-llm.ps1 OpenAI 호환 스모크 스크립트 내부 계약(dot-source _common.ps1·config-sourced model/apiBase(하드코딩 아님)·서버 기동 실패 throw 분기·/v1/chat/completions wire 포맷·Bearer 헤더·UTF-8 body 바이트·응답 choices[0].message.content 소비·성공/실패 exit 분기) 정적 smoke
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 470
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0972(status.ps1 진단, 470 LOC)·T-0971(stop-llm.ps1, 470 LOC)·T-0970(start-llm.ps1, 470 LOC)·T-0967(_common.ps1 parity, 593 LOC) 동형. R-112 4종 cover 위한 다수 assert(dot-source·config-sourced model/apiBase 참조·서버 기동 실패 throw 분기·/v1/chat/completions wire 경로·Bearer 헤더·UTF-8 body 바이트·choices[0].message.content 소비·성공/catch exit 분기·심볼 소비(Get-LlmConfig/Get-LocalApiBase/Start-OllamaServerIfNeeded) _common.ps1 실존 대조·negative mutant a~g 7종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·test-llm.ps1/_common.ps1/config.env 미변경."
independentStream: realdata-e2e-local-llm-test-ps1-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-test-llm-ps1-chat-completions-wire-bearer-utf8-body-throw-exit-branch-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — config.env(T-0966)·_common.ps1(T-0967)·README(T-0968)·install.ps1(T-0969)·start-llm.ps1(T-0970)·stop-llm.ps1(T-0971)·status.ps1(T-0972) 봉함 뒤 유일한 실-검증 진입점 test-llm.ps1(AA openai-compatible adapter 와 동일 wire /v1/chat/completions) 미봉. wire 포맷/config-sourced model/throw 분기 drift→AA 연동 오검증. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint stage5b 병렬."
---

# T-0973 — deploy/local-llm-example/test-llm.ps1 OpenAI 호환 스모크 스크립트 내부 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)·그 config 를 코드로 소비하는 공용 헬퍼(_common.ps1, T-0967)·운영자 사용법 문서(README.md, T-0968)·1순위 설치 진입점(install.ps1, T-0969)·2순위 기동/예열 진입점(start-llm.ps1, T-0970)·3순위 자원 해제 진입점(stop-llm.ps1, T-0971)·4순위 read-only 진단 진입점(status.ps1, T-0972)을 봉했다. 그다음 운영자가 **실제로 로컬 LLM 이 Assessment-Agent 연동에 쓸 수 있는지 최종 검증하려고 쓰는 스모크 진입점** `deploy/local-llm-example/test-llm.ps1` 은 아직 내부 계약 smoke 미봉이다(origin/main grep 확인 — `test/` 의 `test-llm.ps1` 참조는 T-0968 README 런북 script 테이블 cross-ref 뿐, test-llm.ps1 내부 계약을 앵커하는 dedicated spec NONE). 이 스크립트는 `_common.ps1` 을 dot-source 해 `Get-LlmConfig`(T-0967 봉함)로 config 정본을 읽고, `Get-LocalApiBase` 로 api base 를 얻고, `Start-OllamaServerIfNeeded` 로 서버 기동을 보장한 뒤, **AA 의 openai-compatible.adapter 와 동일한 wire 포맷**(`POST {apiBase}/v1/chat/completions` + `Authorization: Bearer` + `{model, messages}`)으로 실제 chat completion 을 쳐 보고 응답을 표시한다. 이게 통과하면 AA 연동 준비 완료라는 판정 근거가 된다.

핵심 위험은 **wire 포맷/설정 소비 계약 drift**다. (1) test-llm.ps1 이 `$cfg.OLLAMA_MODEL`(model)·`Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST`(api base)를 config-sourced 로 참조하지 않고 `gemma4:12b`/`127.0.0.1:11434` literal 을 하드코딩하기 시작하면 config.env 정본(T-0966)과 조용히 divergence 해 운영자가 config 를 바꿔도 스모크가 옛 값을 친다 — 본 task 의 1순위 계약은 model 을 `$cfg.OLLAMA_MODEL` 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 참조하고 그 값을 하드코딩하지 않음이다. (2) 요청 URL 은 반드시 `$apiBase/v1/chat/completions`(OpenAI 호환 `/v1` 경로 — AA adapter 와 동일)여야 하고, `/api/chat`(Ollama 네이티브) 등으로 어긋나면 AA 연동 검증 의미가 사라진다. (3) 인증 헤더는 `Authorization = 'Bearer ...'`(비어있지 않은 값 — adapter 가 요구)로 보내야 한다. (4) 요청 본문은 PowerShell 5.1 의 `-Body`(문자열, Latin1) 대신 `[System.Text.Encoding]::UTF8.GetBytes($payload)` 로 **UTF-8 바이트**로 보내야 한국어 프롬프트가 `?` 로 깨지지 않는다 — 이 바이트 변환이 빠지면 한국어 wire 가 손상된다. (5) 서버 기동이 실패하면(`if (-not (Start-OllamaServerIfNeeded ...))`) `throw` 로 조기 중단해야 하고(fail-fast), 응답 성공 시 `$resp.choices[0].message.content`(OpenAI 응답 shape)를 소비해 출력하며, catch 분기에서는 진단 안내 후 `exit 1` 로 실패 코드를 내야 한다. 이 계약이 어긋나면 live-LLM 최종 검증(PLAN §108/§109)이 조용히 오작동한다.

본 task 는 그 스모크 스크립트 내부 계약을 정적 앵커로 봉해, `_common.ps1`(T-0967) dot-source 소비자 중 최종 실-검증 진입점을 status.ps1(T-0972) 위에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/test-llm.ps1` 전체(~59행) — dot-source 행(`. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')`)·config 소비(`$cfg = Get-LlmConfig`·`$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST`)·서버 기동 보장 분기(`if (-not (Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40)) { throw ... }`)·wire URL(`$url = "$apiBase/v1/chat/completions"`)·payload(`@{ model = $cfg.OLLAMA_MODEL; messages = @(@{ role = 'user'; content = $Prompt }) } | ConvertTo-Json`)·UTF-8 body(`$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)`)·Bearer 헤더(`$headers = @{ Authorization = 'Bearer ollama' }`)·요청(`Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bodyBytes -ContentType 'application/json; charset=utf-8'`)·성공 소비(`$content = $resp.choices[0].message.content`)·catch 분기(`Write-Host "스모크 테스트 실패:" ... exit 1`). 본 task 는 이 파일에서 시퀀스/토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`). test-llm.ps1 이 model 을 하드코딩하지 않고 `$cfg.OLLAMA_MODEL` 로, host 를 `$cfg.OLLAMA_HOST` 로 참조함을 대조하는 근거(readFileSync 정적 추출) — 값 직접 등장이 아니라 config-sourced 참조 계약.
- `deploy/local-llm-example/_common.ps1` — `Get-LlmConfig`(line 34)·`Get-LocalApiBase`(line 66)·`Start-OllamaServerIfNeeded`(line 101) 함수 정의 존재. test-llm.ps1 이 dot-source 후 호출하는 심볼이 헬퍼에 실존함을 `existsSync`+정적 `function` grep 으로 대조(호출 dead 여부만 — 함수 내부 계약은 T-0967 소관).
- `test/smoke/realdata-e2e-local-llm-example-status-ps1-diagnostics-config-sourced-server-online-offline-version-trycatch-exe-earlyreturn-ollama-ps-list-nvidiasmi-branch-contract.smoke-spec.ts`(T-0972) 또는 start-llm.ps1 형제 spec(T-0970) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰/분기 존재·값·parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 test-llm.ps1 의 config-sourced model/apiBase+wire `/v1/chat/completions`+Bearer 헤더+UTF-8 body 바이트+서버 기동 throw 분기+choices[0].message.content 소비+성공/catch exit 분기 계약에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-test-llm-ps1-chat-completions-wire-bearer-utf8-body-throw-exit-branch-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/test-llm.ps1`·`config.env`·`_common.ps1` 을 `readFileSync` 로 읽어 시퀀스/토큰을 정적 추출한다(실 PowerShell 실행/실 Ollama 기동/실 HTTP POST/실 Invoke-RestMethod 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0972/T-0970 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. node 내장 `fs`/`path` + 정규식/행 슬라이스만(외부 파서 도입 0).
- [ ] **Happy-path(dot-source + 심볼 소비 계약)**: test-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation.MyCommand.Path` + `Join-Path ... '_common.ps1'`)로 dot-source 함을 단언하는 assert 1+, 그리고 test-llm.ps1 이 호출하는 헬퍼 심볼(`Get-LlmConfig`·`Get-LocalApiBase`·`Start-OllamaServerIfNeeded`)이 각각 `_common.ps1` 에 `function` 정의로 실존함을 대조하는 assert(심볼당 1+ 또는 일괄 1+). 호출은 있는데 헬퍼 정의가 없으면 dead 호출.
- [ ] **Happy-path(config-sourced model/apiBase + wire 포맷 계약, 1순위)**: test-llm.ps1 이 model 을 `$cfg.OLLAMA_MODEL` 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 **참조**하고 `gemma4:12b`·`127.0.0.1:11434` 같은 config 값 literal 을 본문에 **하드코딩하지 않음**을 단언하는 assert 각 1+. 요청 URL 이 `$apiBase/v1/chat/completions`(OpenAI 호환 `/v1` 경로)이고, payload 가 `model`+`messages`(role `user`·content `$Prompt`) shape 이며, Bearer 헤더(`Authorization = 'Bearer ...'` 비어있지 않은 값), body 가 `[System.Text.Encoding]::UTF8.GetBytes(...)` UTF-8 바이트, ContentType 이 `application/json; charset=utf-8` 임을 단언하는 assert 각 1+. config.env 는 그 값의 정본으로만 참조(byte 값 대조 근거).
- [ ] **Flow/branch cover** — 분기마다 assert 1+:
  - 서버 기동 실패 throw 분기(`if (-not (Start-OllamaServerIfNeeded ...)) { throw ... }` — fail-fast) 존재,
  - 요청 성공 경로에서 `$resp.choices[0].message.content` (OpenAI 응답 shape) 소비 존재,
  - 실패 catch 분기(`Write-Host "스모크 테스트 실패:" ...` + `exit 1`) 존재,
  - UTF-8 콘솔 출력 인코딩 시도(`try { [Console]::OutputEncoding = ... } catch {}` — 비치명) 존재.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) test-llm.ps1 에 model 값 `gemma4:12b` 를 payload 에 literal 로 하드코딩한 mutant → config-sourced model 계약 위반 검출,
  - (b) dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출,
  - (c) 요청 URL 을 `/api/chat`(Ollama 네이티브)로 바꾼 mutant → `/v1/chat/completions` OpenAI 호환 wire 계약 drift 검출,
  - (d) body 를 `[System.Text.Encoding]::UTF8.GetBytes(...)` 대신 문자열 `-Body $payload` 로 바꾼 mutant → UTF-8 바이트 계약 drift 검출,
  - (e) 서버 기동 실패 분기의 `throw` 를 제거(실패해도 계속 진행)한 mutant → fail-fast 분기 drift 검출,
  - (f) Bearer 헤더(`Authorization = 'Bearer ...'`)를 제거하거나 빈 값으로 바꾼 mutant → 비어있지 않은 Bearer 계약 drift 검출,
  - (g) test-llm.ps1 이 호출하는 `Start-OllamaServerIfNeeded`(또는 `Get-LocalApiBase`)를 `_common.ps1` 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `test-llm.ps1`/`config.env`/`_common.ps1` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·모델 tag `gemma4:12b`·경로 `/v1/chat/completions`·placeholder Bearer 값 `ollama`(Ollama 가 무시하는 dummy) 같은 비시크릿 설정 값/경로만)을 단언하는 test 1+. mutant 합성 값도 명백한 dummy(하드코딩 `gemma4:12b` literal·타 파일 경로 등)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). production 0 LOC 이므로 coverageThreshold 무회귀. smoke 파일은 CI 의 `pnpm test:smoke` 대상으로 non-gated 항상 실행(실 실행/네트워크/기동 0 이므로 green, R-113).

## Out of Scope

- `test-llm.ps1`/`_common.ps1`/`config.env` 원본 수정 절대 금지(read-only 정적 대조만).
- 실 PowerShell 실행·실 Ollama 기동·실 HTTP POST(`/v1/chat/completions`)·실 Invoke-RestMethod·실 chat completion 금지(정적 텍스트 추출·`existsSync`/`function` 정의 grep 대조만).
- `_common.ps1` 함수 **내부** 계약(Get-LlmConfig 병합순서·Get-LocalApiBase 포트·Start-OllamaServerIfNeeded 폴링 mechanics 등)은 T-0967 소관 — 본 task 는 test-llm.ps1 이 그 심볼을 호출/소비하는 배선만.
- 나머지 미봉 스크립트(`expose-lan.ps1`)의 내부 계약은 후속 별도 task — Follow-ups 참고.
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 local-llm-example 스크립트 static-smoke 후속(1 task): `expose-lan.ps1`(LAN 노출 방화벽 규칙 추가/`-Revert` 롤백 분기·bind 변경·`LAN_ALLOW_CIDR` config-sourced 소비·관리자 권한 안내). `_common.ps1` dot-source 소비자이므로 본 task 와 동형 패턴. 이 leg 봉하면 deploy/local-llm-example 전 스크립트 내부 계약 앵커 완성.
