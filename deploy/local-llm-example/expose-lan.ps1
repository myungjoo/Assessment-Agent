# expose-lan.ps1 — Ollama 를 LAN 에 노출한다. 같은 LAN 의 테스트 서버(예: 192.168.0.7)
# 가 이 PC 의 Ollama 를 OpenAI 호환 endpoint 로 쓰게 하려면 필요하다.
#   (1) OLLAMA_HOST 를 0.0.0.0:<port> 로 설정(user env) + 서버 재기동 — 모든 NIC 에 bind
#   (2) Windows 방화벽 inbound 규칙 추가 — config 의 LAN_ALLOW_CIDR 범위, TCP <port> 만 허용
# 기본은 로컬 전용(127.0.0.1)이라 본 스크립트를 실행해야 LAN 에서 닿는다.
#
# 방화벽 규칙 변경은 관리자 권한이 필요하다 — 관리자 PowerShell 에서 실행할 것.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\expose-lan.ps1
# 옵션:
#   -Revert   LAN 노출 해제 — 방화벽 규칙 제거 + OLLAMA_HOST 를 127.0.0.1 로 복귀
[CmdletBinding()]
param([switch]$Revert)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig

# 포트 추출(OLLAMA_HOST 의 host:port 에서 port). 기본 11434.
$port = '11434'
if ($cfg.OLLAMA_HOST -match ':(\d+)\s*$') { $port = $Matches[1] }
$cidr = $cfg.LAN_ALLOW_CIDR
$ruleName = 'Ollama LAN (Assessment-Agent local-llm-example)'

# 관리자 권한 확인 — New-NetFirewallRule 은 elevation 필요.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "관리자 권한이 아닙니다. 방화벽 규칙 변경에는 관리자 PowerShell 이 필요합니다."
    Write-Host "관리자 PowerShell 에서 다시 실행하세요:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\expose-lan.ps1" -ForegroundColor Yellow
    exit 1
}

# Apply-FirewallRule — 기존 동명 규칙 제거 후 재생성(멱등). RemoteAddress 로 범위 제한.
function Set-FirewallRule {
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $port -RemoteAddress $cidr -Profile Any | Out-Null
}

if ($Revert) {
    Write-Host "== LAN 노출 해제 ==" -ForegroundColor Cyan
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    Write-Host "  방화벽 규칙 제거됨" -ForegroundColor Green
    [Environment]::SetEnvironmentVariable('OLLAMA_HOST', "127.0.0.1:$port", 'User')
    $env:OLLAMA_HOST = "127.0.0.1:$port"
    Write-Host "  OLLAMA_HOST=127.0.0.1:$port (로컬 전용) 복귀" -ForegroundColor Green
}
else {
    Write-Host "== LAN 노출 설정 ==" -ForegroundColor Cyan
    Write-Host ("port={0}  allow={1}" -f $port, $cidr)
    [Environment]::SetEnvironmentVariable('OLLAMA_HOST', "0.0.0.0:$port", 'User')
    $env:OLLAMA_HOST = "0.0.0.0:$port"
    Write-Host "  OLLAMA_HOST=0.0.0.0:$port (모든 NIC bind) 설정" -ForegroundColor Green
    Set-FirewallRule
    Write-Host ("  방화벽 inbound 허용: TCP {0} from {1}" -f $port, $cidr) -ForegroundColor Green
}

# 새 OLLAMA_HOST 적용을 위해 서버 깨끗이 재기동(serve 직접 기동 — 현재 세션 env 상속).
Write-Host "서버 재기동(새 bind 적용)..." -ForegroundColor Cyan
$exe = Get-OllamaExe
if ($exe) {
    Get-Process -Name 'ollama app', 'ollama', 'ollama_llama_server' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    $apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST
    if (Wait-OllamaServer -ApiBase $apiBase -TimeoutSec 60) {
        Write-Host "  서버 OK" -ForegroundColor Green
    } else {
        Write-Warning "  서버가 시간 내 응답하지 않음 — status.ps1 로 확인"
    }
} else {
    Write-Warning "ollama.exe 미발견 — install.ps1 을 먼저 실행하세요."
}

if (-not $Revert) {
    # 이 PC 의 LAN IP 안내(테스트 서버 .env 의 SEED_LLM_ENDPOINT_URL 에 넣을 값).
    $ips = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*' } |
        Select-Object -ExpandProperty IPAddress) -join ', '
    Write-Host ""
    Write-Host "테스트 서버 .env 에 넣을 endpoint (이 PC LAN IP 기준):" -ForegroundColor Cyan
    Write-Host ("  SEED_LLM_ENDPOINT_URL=http://{0}:{1}/v1" -f ($ips -split ', ')[0], $port)
    Write-Host ("  (이 PC IPv4 후보: {0})" -f $ips)
}
