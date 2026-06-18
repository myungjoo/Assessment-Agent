# stop-llm.ps1 — 모델을 VRAM 에서 즉시 내려 GPU/메모리 자원을 해제한다.
# 기본 동작은 "모델만 언로드" — 서버는 계속 떠 있으므로(idle, VRAM 0) 다음 요청에 곧바로
# 다시 로딩된다. 완전히 서버까지 끄려면 -StopServer.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\stop-llm.ps1
# 옵션:
#   -StopServer   모델 언로드 + 서버(트레이 앱)까지 종료 (idle 점유까지 0)
[CmdletBinding()]
param([switch]$StopServer)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig
$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST

if (-not (Test-OllamaServer -ApiBase $apiBase)) {
    Write-Host "서버가 이미 꺼져 있음 — 해제할 자원 없음." -ForegroundColor Yellow
    return
}

# 모델 언로드: keep_alive=0 으로 빈 요청을 보내면 해당 모델이 즉시 VRAM 에서 내려간다.
# (CLI 'ollama stop' 과 동등하나, 서버 API 만으로 처리해 버전 차이에 견고하게.)
Write-Host ("모델 언로드(VRAM 해제): {0} ..." -f $cfg.OLLAMA_MODEL) -ForegroundColor Cyan
$body = @{ model = $cfg.OLLAMA_MODEL; keep_alive = 0 } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post -Body $body `
        -ContentType 'application/json' -TimeoutSec 30
    Write-Host "  언로드 요청 완료" -ForegroundColor Green
} catch {
    Write-Warning "API 언로드 실패, CLI 로 재시도: $_"
    $exe = Get-OllamaExe
    if ($exe) { & $exe stop $cfg.OLLAMA_MODEL 2>$null }
}

if ($StopServer) {
    Write-Host "서버(트레이 앱) 종료 중..." -ForegroundColor Cyan
    Get-Process -Name 'ollama app', 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  서버 종료됨 — idle 점유까지 0. 다음엔 start-llm.ps1 또는 첫 요청으로 재기동." -ForegroundColor Green
} else {
    Write-Host "서버는 유지(idle, VRAM 0). 다음 요청에 자동 재로딩됩니다." -ForegroundColor Green
}
