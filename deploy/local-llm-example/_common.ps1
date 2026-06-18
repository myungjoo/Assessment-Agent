# _common.ps1 — 로컬 LLM 예제 스크립트들의 공용 헬퍼. 각 스크립트가 dot-source 한다.
# 책임: config.env(+config.local.env) 로드, ollama.exe 위치 탐색, 서버 헬스 체크/대기.
# 본 파일은 직접 실행하지 않는다.

$ErrorActionPreference = 'Stop'

# 이 스크립트가 위치한 폴더의 절대경로 — 어느 cwd 에서 호출하든 config 를 찾기 위함.
$script:LlmExampleDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Read-EnvFile — 단순 KEY=VALUE 형식의 .env 파일을 읽어 hashtable($Into) 에 채운다.
# '#' 주석/빈 줄은 건너뛰고, 값 양끝의 따옴표는 제거한다. 파일이 없으면 noop.
function Read-EnvFile {
    param([string]$Path, [hashtable]$Into)
    if (-not (Test-Path $Path)) { return }
    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        $t = $line.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $idx = $t.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $t.Substring(0, $idx).Trim()
        $val = $t.Substring($idx + 1).Trim()
        if ($val.Length -ge 2) {
            $f = $val[0]; $l = $val[$val.Length - 1]
            if (($f -eq '"' -and $l -eq '"') -or ($f -eq "'" -and $l -eq "'")) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        $Into[$key] = $val
    }
}

# Get-LlmConfig — 코드 내 기본값 → config.env → config.local.env 순으로 병합해 반환.
# 뒤에 읽는 파일이 같은 KEY 를 덮어쓴다 (local 이 최우선).
function Get-LlmConfig {
    $cfg = @{
        OLLAMA_MODEL      = 'gemma4:12b'
        OLLAMA_HOST       = '127.0.0.1:11434'
        OLLAMA_KEEP_ALIVE = '5m'
        OPENAI_BASE_URL   = 'http://127.0.0.1:11434/v1'
    }
    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.env') -Into $cfg
    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.local.env') -Into $cfg
    return $cfg
}

# Get-OllamaExe — ollama.exe 의 전체 경로를 반환 (PATH → 사용자 설치 경로 순 탐색).
# 찾지 못하면 $null.
function Get-OllamaExe {
    $cmd = Get-Command ollama -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path $candidate) { return $candidate }
    return $null
}

# Get-OllamaAppExe — 백그라운드 서버를 띄우는 트레이 앱(ollama app.exe) 경로. 없으면 $null.
function Get-OllamaAppExe {
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    if (Test-Path $candidate) { return $candidate }
    return $null
}

# Get-LocalApiBase — OLLAMA_HOST 가 0.0.0.0 이어도 로컬 헬스체크는 127.0.0.1 로 한다.
# host:port 에서 port 만 추출해 http://127.0.0.1:<port> 를 만든다.
function Get-LocalApiBase {
    param([string]$OllamaHost = '127.0.0.1:11434')
    $port = '11434'
    if ($OllamaHost -match ':(\d+)\s*$') { $port = $Matches[1] }
    return "http://127.0.0.1:$port"
}

# Test-OllamaServer — 서버가 응답하면 $true, 아니면 $false (예외 삼킴).
function Test-OllamaServer {
    param([string]$ApiBase = 'http://127.0.0.1:11434')
    try {
        $null = Invoke-RestMethod -Uri "$ApiBase/api/version" -TimeoutSec 3
        return $true
    } catch {
        return $false
    }
}

# Wait-OllamaServer — 서버가 뜰 때까지 최대 $TimeoutSec 초 폴링. 뜨면 $true, 시간초과 $false.
function Wait-OllamaServer {
    param([string]$ApiBase = 'http://127.0.0.1:11434', [int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-OllamaServer -ApiBase $ApiBase) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

# Start-OllamaServerIfNeeded — 서버가 꺼져 있으면 트레이 앱을 띄워 기동시킨다.
# 이미 떠 있으면 noop. 기동 성공 여부($true/$false) 반환.
# 전략: (1) 트레이 앱으로 기동 시도(정상 UX) → 절반 시간 내 서버가 안 뜨면
#       (2) 멈춘 인스턴스 정리 후 'ollama serve' 직접 기동(가장 결정적)으로 폴백.
# 일부 환경에서 트레이 앱이 백그라운드 서버를 띄우지 못하고 "existing instance" 로
# 멈추는 race 가 있어 serve 폴백을 둔다.
function Start-OllamaServerIfNeeded {
    param([string]$ApiBase = 'http://127.0.0.1:11434', [int]$TimeoutSec = 60)
    if (Test-OllamaServer -ApiBase $ApiBase) { return $true }
    $exe = Get-OllamaExe
    if (-not $exe) { return $false }
    $half = [Math]::Max(5, [int]($TimeoutSec / 2))

    # (1) 트레이 앱 우선 (있으면)
    $app = Get-OllamaAppExe
    if ($app) {
        Start-Process -FilePath $app | Out-Null
        if (Wait-OllamaServer -ApiBase $ApiBase -TimeoutSec $half) { return $true }
    }

    # (2) 폴백: 멈춘 인스턴스 정리 후 serve 직접 기동
    Get-Process -Name 'ollama app', 'ollama', 'ollama_llama_server' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    return (Wait-OllamaServer -ApiBase $ApiBase -TimeoutSec ([Math]::Max(10, $half)))
}
