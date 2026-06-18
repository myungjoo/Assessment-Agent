# 로컬 LLM serving 예제 (Ollama) — Windows + RTX 4070

> ⚠️ **이것은 선택적 보조 예제입니다.** Assessment-Agent(AA) 본체는 특정 LLM serving
> 을 가정하지 않습니다 — Cloud LLM(OpenAI/Azure/Anthropic/Gemini)이든 Local LLM이든
> OpenAI 호환 endpoint면 동작합니다. 이 폴더는 **개발자 본인 PC에서 테스트용 로컬
> LLM을 띄우는 한 가지 방법의 재현 스크립트**일 뿐이며, 빌드·CI·런타임 어디에서도
> AA 본체의 필수 요소가 아닙니다. 이 폴더를 통째로 지워도 AA는 그대로 동작합니다.

이 예제는 다음 3가지 요구를 만족하도록 구성되어 있습니다.

1. **필요할 때만 동작** — 모델은 첫 요청이 올 때만 VRAM에 적재됩니다(lazy load).
2. **안 쓸 때 자원 해제** — 유휴 `OLLAMA_KEEP_ALIVE`(기본 5분) 경과 시 모델을 VRAM에서
   자동 언로드 → GPU/메모리를 다른 프로세스가 온전히 쓸 수 있습니다. 즉시 해제도 가능
   (`stop-llm.ps1`).
3. **재부팅 후 곧바로 로딩** — Ollama 백그라운드 서버가 로그인 시 자동 시작되어
   대기(idle, VRAM 0)하고, 첫 요청이 오면 수 초 내 모델을 올립니다.

---

## 왜 Ollama인가

- **요청 기반 lazy load + idle 자동 언로드**가 기본 내장 → 위 1·2를 코드 없이 충족.
- **로그인 시 자동시작**되는 가벼운 백그라운드 서버 → idle 점유 거의 0인데 항상 준비됨(요구 3).
- **OpenAI Chat Completions 호환 API**(`/v1`)를 제공 → AA의
  [`src/llm/providers/openai-compatible.adapter.ts`](../../src/llm/providers/openai-compatible.adapter.ts)가
  그대로 호출. 별도 어댑터 불필요.

원하면 LM Studio / llama.cpp / vLLM(WSL) 등으로 대체해도 됩니다. AA 입장에선 "OpenAI 호환
endpoint" 하나면 충분하므로 이 예제는 교체 가능한 한 가지 구현일 뿐입니다.

---

## 요구 환경

- Windows 10/11
- NVIDIA GPU (이 예제는 **RTX 4070, 12GB VRAM** 기준으로 모델을 골랐습니다)
- 최신 NVIDIA 드라이버 (CUDA 런타임은 Ollama가 자체 번들)
- PowerShell (Windows 기본 탑재)
- 인터넷 (Ollama 및 모델 최초 다운로드용)

---

## 빠른 시작

PowerShell에서 **저장소 루트**기준으로 실행합니다.

```powershell
# 1) 설치 + 환경설정 + 모델 pull + 자동시작 구성 (최초 1회, 모델 수 GB 다운로드)
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\install.ps1

# 2) 상태 확인 (서버/적재 모델/GPU)
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\status.ps1

# 3) OpenAI 호환 endpoint 스모크 테스트 (AA가 호출하는 것과 동일한 형태)
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\test-llm.ps1
```

설치 후에는 평소 **아무 스크립트도 실행할 필요가 없습니다.** AA(또는 test 스크립트)가
endpoint를 호출하면 모델이 자동 로딩되고, 5분 놀면 자동 해제됩니다.

---

## 스크립트 설명

| 스크립트 | 역할 |
| --- | --- |
| `install.ps1` | Ollama 설치(winget→직접 다운로드 fallback) + user 환경변수(`OLLAMA_KEEP_ALIVE`/`OLLAMA_HOST`) 설정 + 자동시작 구성 + 모델 pull. 멱등. |
| `start-llm.ps1` | 서버 보장 기동 + (옵션) 모델 예열(VRAM 선적재). `-NoWarm`이면 서버만. |
| `stop-llm.ps1` | 모델 즉시 언로드(VRAM 해제). `-StopServer`면 서버까지 종료(idle 점유 0). |
| `status.ps1` | 서버 상태/버전, `ollama ps`(적재 모델), `ollama list`(보유 모델), `nvidia-smi`. |
| `test-llm.ps1` | `/v1/chat/completions` 스모크 테스트. `-Prompt "..."`로 질문 지정. |
| `config.env` | 예제 기본 설정(커밋됨). 모델/호스트/언로드 정책/endpoint. |
| `_common.ps1` | 공용 헬퍼(직접 실행 X). |

### 설치 옵션

```powershell
# 모델은 안 받고 서버/환경설정만
... install.ps1 -NoModelPull
# 자동시작을 끄고 완전 수동 운용 (재부팅 후 직접 start-llm.ps1 실행)
... install.ps1 -NoAutostart
```

---

## 설정 바꾸기 (`config.env`)

```ini
OLLAMA_MODEL=gemma4:12b              # pull/serve 할 모델 (Ollama tag)
OLLAMA_HOST=127.0.0.1:11434          # bind 주소 (LAN 공유는 0.0.0.0:11434)
OLLAMA_KEEP_ALIVE=5m                 # 유휴 언로드 시간 (0=즉시, -1=무기한 상주)
OPENAI_BASE_URL=http://127.0.0.1:11434/v1   # AA endpointUrl 에 넣는 값
```

- **개인 오버라이드는 `config.local.env`** (gitignore됨)에 같은 KEY를 적으세요. 커밋된
  `config.env`를 건드리지 않고 본인 PC 설정만 바꿀 수 있습니다.
- 모델 교체: `config.local.env`에 `OLLAMA_MODEL=qwen3:8b` 등을 적고 `install.ps1` 재실행
  (또는 `ollama pull <tag>`). 여러 모델을 받아두고 AA config의 `modelId`만 바꿔 비교 가능.

### 12GB VRAM에서 무난한 다른 모델 후보

| tag | 크기(Q4) | 메모 |
| --- | --- | --- |
| `gemma4:12b` | ~8GB | 기본값. 2026 최신 Gemma4, 한국어/추론 양호 |
| `qwen3:8b` | ~5.2GB | 빠르고 VRAM 여유 큼 |
| `qwen3:14b` | ~9.3GB | 동급 최고 품질, 타이트 |
| `qwen2.5-coder:7b` | ~4.7GB | 코드 특화, 가장 빠름 |
| `gemma3:12b` | ~8.1GB | 직전 세대 |

> 12GB에서 "완전 VRAM 상주" 안전선은 Q4 기준 ~10GB 이하입니다.

---

## Assessment-Agent에 연결하기

AA는 LLM provider config를 DB에 저장하고, `custom`/`openai` provider는 OpenAI 호환
어댑터로 `<endpointUrl>/chat/completions`를 호출합니다. 다음 값으로 등록하세요.

| 필드 | 값 |
| --- | --- |
| `provider` | `custom` (또는 `openai`) |
| `endpointUrl` | `http://127.0.0.1:11434/v1` |
| `modelId` | `gemma4:12b` (받은 모델 tag) |
| `apiKey` | 아무 비어있지 않은 값 (예: `ollama`) — Ollama는 키를 검증하지 않지만 어댑터가 비어있지 않은 값을 요구함 |

> AA를 **컨테이너**로 띄운 경우 `127.0.0.1`은 컨테이너 자신을 가리키므로,
> `endpointUrl`을 `http://host.docker.internal:11434/v1`로 두고 Ollama를
> `OLLAMA_HOST=0.0.0.0:11434`로 바인딩하세요(`config.local.env`에서 변경).

연결 확인은 `test-llm.ps1`이 통과하면 OK입니다(동일한 wire 포맷을 사용).

---

## 다른 기기(테스트 서버)에서 사용하기 — LAN 노출

같은 LAN의 다른 기기(예: 테스트 서버 `192.168.0.7`)가 이 PC의 Ollama를 쓰게 하려면,
기본값(`127.0.0.1` 로컬 전용)을 LAN으로 열어야 합니다. `expose-lan.ps1`이 두 가지를
한 번에 처리합니다.

1. `OLLAMA_HOST`를 `0.0.0.0:11434`로 설정(모든 NIC bind) + 서버 재기동
2. Windows 방화벽 inbound 규칙 추가 — `config.env`의 `LAN_ALLOW_CIDR`(기본
   `192.168.0.0/24`) 범위, TCP 11434만 허용

```powershell
# 관리자 PowerShell 에서 실행 (방화벽 규칙 변경에 권한 필요)
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\expose-lan.ps1
# 해제 (로컬 전용으로 복귀 + 방화벽 규칙 제거)
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\expose-lan.ps1 -Revert
```

실행이 끝나면 이 PC의 LAN IP 기준 endpoint(예:
`SEED_LLM_ENDPOINT_URL=http://192.168.0.5:11434/v1`)를 안내합니다. 허용 범위를 단일
호스트로 좁히려면 `config.local.env`에 `LAN_ALLOW_CIDR=192.168.0.7`을 적습니다.

> 테스트 서버 쪽 자동 연동(재배포 시 이 endpoint를 DB에 멱등 seed)은
> [`deploy/README.md` §5.2](../README.md) + [`deploy/seed-llm-config.sh`](../seed-llm-config.sh)
> 를 참조하세요. 서버 `.env`에 `SEED_LLM_ENDPOINT_URL` 만 넣으면 매 redeploy마다
> 이 PC의 LLM을 가리키도록 구성됩니다.

---

## 자원 해제 동작 정리

| 상태 | VRAM | 설명 |
| --- | --- | --- |
| 서버 idle (요청 없음 5분 초과) | ~0 | 모델 언로드됨. 서버 프로세스만 대기 |
| 요청 도착 | 모델 크기 | 자동 로딩(첫 호출은 수 초~수십 초) |
| `stop-llm.ps1` | ~0 | 모델 즉시 언로드, 서버는 유지 |
| `stop-llm.ps1 -StopServer` | 0 | 서버까지 종료(완전 해제) |

게임/렌더링 등 GPU를 통째로 쓰고 싶을 땐 `stop-llm.ps1 -StopServer` 한 번이면 됩니다.
다시 쓸 땐 첫 요청이나 `start-llm.ps1`이 알아서 올립니다.

---

## 제거

```powershell
# 자동시작 해제 + 서버 종료
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\stop-llm.ps1 -StopServer
powershell -ExecutionPolicy Bypass -File deploy\local-llm-example\install.ps1 -NoModelPull -NoAutostart

# Ollama 자체 제거
winget uninstall --id Ollama.Ollama
# 받은 모델은 %USERPROFILE%\.ollama 에 있음 — 필요 시 폴더 삭제
```

설정한 user 환경변수 제거(선택):

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE', $null, 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_HOST', $null, 'User')
```

---

## 트러블슈팅

- **`ollama` 명령을 못 찾음** — 새 PowerShell 창을 열거나 로그아웃/로그인(PATH 갱신).
  스크립트는 `%LOCALAPPDATA%\Programs\Ollama\ollama.exe`를 직접 찾으므로 보통 문제 없음.
- **모델 pull 실패(태그 없음)** — `https://ollama.com/library`에서 정확한 tag 확인 후
  `config.local.env`의 `OLLAMA_MODEL` 수정 → 재실행.
- **첫 응답이 느림** — 정상. 모델 로딩 시간입니다. 이후 `KEEP_ALIVE` 동안은 빠릅니다.
- **GPU 대신 CPU로 도는 듯함** — `status.ps1`의 `ollama ps`에서 `PROCESSOR`가 `GPU`인지
  확인. 모델이 12GB를 초과하면 일부가 CPU로 offload되어 느려집니다(더 작은 모델 사용).
- **다른 프로세스가 VRAM을 다 써서 로딩 실패** — `stop-llm.ps1`로 우선 비우거나, 다른
  GPU 프로세스를 종료 후 재시도.
