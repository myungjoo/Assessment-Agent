# status.ps1 — 로컬 LLM 현재 상태를 한눈에 본다.
#   - 서버 떠 있는지 / 버전
#   - 지금 VRAM 에 적재된 모델 (ollama ps)
#   - 받아둔 모델 목록 (ollama list)
#   - GPU 사용량 (nvidia-smi, 있으면)
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\status.ps1

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig
$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST
$exe = Get-OllamaExe

Write-Host "== 로컬 LLM 상태 ==" -ForegroundColor Cyan
Write-Host ("설정: MODEL={0}  HOST={1}  KEEP_ALIVE={2}" -f $cfg.OLLAMA_MODEL, $cfg.OLLAMA_HOST, $cfg.OLLAMA_KEEP_ALIVE)
Write-Host ("endpointUrl(AA): {0}" -f $cfg.OPENAI_BASE_URL)
Write-Host ""

# 서버 상태
if (Test-OllamaServer -ApiBase $apiBase) {
    try {
        $ver = Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 3
        Write-Host ("서버: ONLINE  (version {0}, {1})" -f $ver.version, $apiBase) -ForegroundColor Green
    } catch {
        Write-Host "서버: ONLINE  ($apiBase)" -ForegroundColor Green
    }
} else {
    Write-Host "서버: OFFLINE — start-llm.ps1 또는 첫 요청으로 기동" -ForegroundColor Yellow
}

if (-not $exe) {
    Write-Host "ollama.exe 미발견 — install.ps1 을 먼저 실행하세요." -ForegroundColor Yellow
    return
}

Write-Host ""
Write-Host "── 현재 VRAM 에 적재된 모델 (ollama ps) ──" -ForegroundColor Cyan
& $exe ps

Write-Host ""
Write-Host "── 받아둔 모델 목록 (ollama list) ──" -ForegroundColor Cyan
& $exe list

# GPU 사용량 (선택)
$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($smi) {
    Write-Host ""
    Write-Host "── GPU (nvidia-smi) ──" -ForegroundColor Cyan
    & nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv
}
