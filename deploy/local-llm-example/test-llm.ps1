# test-llm.ps1 — OpenAI 호환 endpoint(/v1/chat/completions) 스모크 테스트.
# Assessment-Agent 가 실제로 호출하는 것과 동일한 wire 포맷(Authorization: Bearer +
# {model, messages})으로 쳐 보고 응답을 출력한다. 이게 통과하면 AA 연동 준비 완료.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\test-llm.ps1
# 옵션:
#   -Prompt "..."   보낼 프롬프트 (기본: 한 줄 자기소개 요청)
[CmdletBinding()]
param([string]$Prompt = '너는 누구야? 한 문장으로 한국어로 답해줘.')

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')
$cfg = Get-LlmConfig
$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST

# 콘솔 출력 인코딩을 UTF-8 로 — 한국어 응답이 깨지지 않게.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Host "서버 기동 확인..." -ForegroundColor Cyan
if (-not (Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40)) {
    throw "Ollama 서버 기동 실패. install.ps1 을 먼저 실행했는지 확인하세요."
}

# OpenAI 호환 경로(/v1) — AA 의 openai-compatible.adapter 와 동일한 형태.
$url = "$apiBase/v1/chat/completions"
$payload = @{
    model    = $cfg.OLLAMA_MODEL
    messages = @(@{ role = 'user'; content = $Prompt })
} | ConvertTo-Json -Depth 5
# 본문은 반드시 UTF-8 바이트로 전송. PowerShell 5.1 의 -Body(문자열) 은 Latin1 로
# 인코딩해 한국어가 '?' 로 깨지므로 직접 UTF-8 바이트로 변환한다.
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

Write-Host ("요청 → {0}" -f $url) -ForegroundColor Cyan
Write-Host ("model={0}  prompt='{1}'" -f $cfg.OLLAMA_MODEL, $Prompt)
Write-Host "(첫 호출은 모델 로딩으로 수십 초 걸릴 수 있음)"
Write-Host ""

$headers = @{ Authorization = 'Bearer ollama' }  # Ollama 는 키를 무시하지만 adapter 는 비어있지 않은 값 요구
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bodyBytes `
        -ContentType 'application/json; charset=utf-8' -TimeoutSec 300
    $sw.Stop()
    $content = $resp.choices[0].message.content
    Write-Host "── 응답 ──" -ForegroundColor Green
    Write-Host $content
    Write-Host ""
    Write-Host ("OK ({0:N1}s)  model={1}" -f $sw.Elapsed.TotalSeconds, $resp.model) -ForegroundColor Green
} catch {
    $sw.Stop()
    Write-Host "스모크 테스트 실패:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "점검: (1) 모델을 받았는가 (status.ps1 의 ollama list)" -ForegroundColor Yellow
    Write-Host "      (2) config.env 의 OLLAMA_MODEL 태그가 존재하는가 (https://ollama.com/library)" -ForegroundColor Yellow
    exit 1
}
