# install.ps1 — 로컬 LLM(Ollama) 설치 + 환경설정 + 모델 pull + 자동시작 구성.
# 멱등(idempotent): 이미 설치/설정된 항목은 건너뛴다. 가능하면 관리자 권한 없이 동작
# (Ollama 는 사용자 영역 설치라 보통 UAC 불요).
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\install.ps1
# 옵션:
#   -NoModelPull   모델 다운로드(pull) 생략 — 서버/환경설정만
#   -NoAutostart   로그인 시 자동시작 구성을 끈다 (완전 수동 운용)
[CmdletBinding()]
param(
    [switch]$NoModelPull,
    [switch]$NoAutostart
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig
$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST

Write-Host "== 로컬 LLM 예제 설치 ==" -ForegroundColor Cyan
Write-Host ("모델={0}  HOST={1}  KEEP_ALIVE={2}" -f $cfg.OLLAMA_MODEL, $cfg.OLLAMA_HOST, $cfg.OLLAMA_KEEP_ALIVE)

# ── [1/5] Ollama 설치 (없으면) ───────────────────────────────────────────────
$exe = Get-OllamaExe
if ($exe) {
    Write-Host "[1/5] Ollama 이미 설치됨: $exe" -ForegroundColor Green
} else {
    Write-Host "[1/5] Ollama 설치 중..." -ForegroundColor Yellow
    $installed = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install --id Ollama.Ollama -e --silent `
                --accept-source-agreements --accept-package-agreements
            if ($LASTEXITCODE -eq 0) { $installed = $true }
        } catch { Write-Warning "winget 설치 실패, 직접 다운로드로 전환: $_" }
    }
    if (-not $installed) {
        $url = 'https://ollama.com/download/OllamaSetup.exe'
        $tmp = Join-Path $env:TEMP 'OllamaSetup.exe'
        Write-Host "  직접 다운로드: $url"
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
        Write-Host "  무인 설치 실행..."
        Start-Process -FilePath $tmp -ArgumentList '/VERYSILENT', '/NORESTART' -Wait
    }
    $exe = Get-OllamaExe
    if (-not $exe) {
        throw "Ollama 설치 후에도 ollama.exe 를 찾지 못함. 수동 설치 필요: https://ollama.com/download"
    }
    Write-Host "  설치 완료: $exe" -ForegroundColor Green
}

# ── [2/5] 환경변수(user scope) 설정 — 서버 데몬이 읽는다 ──────────────────────
Write-Host "[2/5] 환경변수(User) 설정..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE', $cfg.OLLAMA_KEEP_ALIVE, 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_HOST', $cfg.OLLAMA_HOST, 'User')
$env:OLLAMA_KEEP_ALIVE = $cfg.OLLAMA_KEEP_ALIVE
$env:OLLAMA_HOST = $cfg.OLLAMA_HOST
Write-Host ("  OLLAMA_KEEP_ALIVE={0}  OLLAMA_HOST={1}" -f $cfg.OLLAMA_KEEP_ALIVE, $cfg.OLLAMA_HOST) -ForegroundColor Green

# ── [3/5] 자동시작 구성 (재부팅 후 곧바로 준비) ──────────────────────────────
# Ollama 트레이 앱은 기본적으로 로그인 시 자동시작(HKCU Run)으로 등록된다.
# -NoAutostart 면 그 등록을 제거해 완전 수동 운용으로 둔다.
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if ($NoAutostart) {
    Write-Host "[3/5] 자동시작 해제 (-NoAutostart)..." -ForegroundColor Yellow
    try {
        Remove-ItemProperty -Path $runKey -Name 'Ollama' -ErrorAction Stop
        Write-Host "  자동시작 항목 제거됨" -ForegroundColor Green
    } catch { Write-Host "  자동시작 항목이 이미 없음 (skip)" }
} else {
    Write-Host "[3/5] 자동시작 확인 (기본 유지)..." -ForegroundColor Yellow
    $appExe = Get-OllamaAppExe
    $has = $false
    try { $null = Get-ItemProperty -Path $runKey -Name 'Ollama' -ErrorAction Stop; $has = $true } catch {}
    if (-not $has -and $appExe) {
        New-ItemProperty -Path $runKey -Name 'Ollama' -Value "`"$appExe`"" -PropertyType String -Force | Out-Null
        Write-Host "  자동시작 항목 등록: $appExe" -ForegroundColor Green
    } else {
        Write-Host "  자동시작 이미 구성됨 (또는 설치 관리)" -ForegroundColor Green
    }
}

# ── [4/5] 서버 재기동 (새 환경변수 적용) + 헬스 대기 ─────────────────────────
# 멈춘 인스턴스(설치 직후 트레이 앱이 서버를 못 띄우는 race) 를 피하려고, 모든
# ollama 프로세스를 정리한 뒤 'ollama serve' 로 직접 기동한다(가장 결정적). 현재
# 세션 env(OLLAMA_KEEP_ALIVE/HOST)를 그대로 상속해 정책이 즉시 반영된다. 재부팅
# 후에는 [3/5] 의 자동시작(트레이 앱)이 동일 user env 로 서버를 띄운다.
Write-Host "[4/5] 서버 재기동(환경변수 반영) 후 대기..." -ForegroundColor Yellow
Get-Process -Name 'ollama app', 'ollama', 'ollama_llama_server' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
if (Wait-OllamaServer -ApiBase $apiBase -TimeoutSec 60) {
    Write-Host "  서버 응답 OK: $apiBase" -ForegroundColor Green
} else {
    Write-Warning "  서버가 시간 내 응답하지 않음. status.ps1 로 상태를 확인하세요."
}

# ── [5/5] 모델 pull ──────────────────────────────────────────────────────────
if ($NoModelPull) {
    Write-Host "[5/5] 모델 pull 생략 (-NoModelPull)" -ForegroundColor Yellow
} else {
    Write-Host ("[5/5] 모델 pull: {0} (수 GB 다운로드, 시간 소요)" -f $cfg.OLLAMA_MODEL) -ForegroundColor Yellow
    & $exe pull $cfg.OLLAMA_MODEL
    if ($LASTEXITCODE -ne 0) {
        Write-Warning ("  '{0}' pull 실패. 태그가 맞는지 https://ollama.com/library 에서 확인하거나" -f $cfg.OLLAMA_MODEL)
        Write-Warning "  config.local.env 에 OLLAMA_MODEL 을 다른 태그로 지정 후 재실행하세요 (예: qwen3:8b)."
    } else {
        Write-Host "  모델 준비 완료" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "설치 완료. 다음으로 확인:" -ForegroundColor Cyan
Write-Host "  - 상태:    powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\status.ps1"
Write-Host "  - 스모크:  powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\test-llm.ps1"
Write-Host "  - 언로드:  powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\stop-llm.ps1"
