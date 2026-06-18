# start-llm.ps1 — 서버를 보장 기동하고, (옵션) 모델을 VRAM 에 미리 올린다(warm).
# 평소엔 굳이 실행할 필요 없다 — 첫 요청 때 모델이 자동 로딩된다. 다만 "곧바로 쓰고
# 싶을 때" 예열용으로 호출한다.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\start-llm.ps1
# 옵션:
#   -NoWarm   서버만 기동하고 모델 예열은 생략
[CmdletBinding()]
param([switch]$NoWarm)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig
$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST

Write-Host "서버 기동 확인..." -ForegroundColor Cyan
if (-not (Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40)) {
    throw "Ollama 서버 기동 실패. install.ps1 을 먼저 실행했는지 확인하세요."
}
Write-Host "  서버 OK: $apiBase" -ForegroundColor Green

if ($NoWarm) {
    Write-Host "예열 생략 (-NoWarm). 첫 요청 시 모델이 자동 로딩됩니다." -ForegroundColor Yellow
    return
}

# 예열: 짧은 요청 1 회로 모델을 VRAM 에 적재. keep_alive 는 config 값을 따른다(생략 시
# 서버 환경변수 OLLAMA_KEEP_ALIVE 적용).
Write-Host ("모델 예열(VRAM 적재): {0} ..." -f $cfg.OLLAMA_MODEL) -ForegroundColor Cyan
$body = @{
    model      = $cfg.OLLAMA_MODEL
    prompt     = 'ok'
    stream     = $false
    keep_alive = $cfg.OLLAMA_KEEP_ALIVE
} | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post -Body $body `
        -ContentType 'application/json' -TimeoutSec 300
    Write-Host "  예열 완료 — 이제 즉시 응답 가능" -ForegroundColor Green
} catch {
    Write-Warning "예열 실패: $_"
    Write-Warning "모델이 받아졌는지 확인: install.ps1 또는 'ollama pull $($cfg.OLLAMA_MODEL)'"
}
