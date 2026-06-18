#!/usr/bin/env bash
# Assessment-Agent — (선택) LLM provider config 멱등 seed 스크립트.
# redeploy.sh 가 재배포 직후 호출한다(미설정이면 no-op). 목적: 테스트 기기가 특정
# OpenAI 호환 LLM endpoint(예: 같은 LAN 의 로컬 PC 가 띄운 Ollama)를 쓰도록, DB 의
# LlmProviderConfig 행을 매 재배포마다 멱등하게 보장한다.
#
# 핵심 설계(repo 비오염):
#   - 본 스크립트는 **범용**이다. 실제 endpoint/모델/IP 같은 환경 고유 값은 git 에
#     박지 않고 서버의 untracked `.env`(SEED_LLM_* 변수)에서만 읽는다.
#   - `SEED_LLM_ENDPOINT_URL` 가 비어있으면 즉시 no-op(exit 0) — 공용 repo / 다른
#     환경에서는 아무 동작도 하지 않는다.
#
# apiKey 처리: AA 는 apiKey 를 AES-256-GCM envelope 으로 암호화 저장한다(ADR-0014).
#   본 스크립트는 평문 키를 DB 에 넣지 않고, 실행 중인 app 컨테이너 안에서 compiled
#   cipher(dist)로 암호화한 ciphertext 만 upsert 한다(컨테이너 env 의 LLM_APIKEY_ENC_KEY
#   사용 — 앱이 호출 시 decrypt 할 때와 동일 키). Ollama 는 키를 무시하므로 평문 값은
#   더미('ollama')여도 무방하나, gateway 가 decrypt 는 수행하므로 유효 envelope 이 필요.
#
# env(.env 또는 호출 환경):
#   SEED_LLM_ENDPOINT_URL  (필수 트리거) OpenAI 호환 base, 예: http://192.168.0.5:11434/v1
#   SEED_LLM_PROVIDER      (기본 custom) provider 토큰 — custom / openai 가 OpenAI 호환
#   SEED_LLM_MODEL_ID      (기본 gemma4:12b) 모델 tag
#   SEED_LLM_API_KEY       (기본 ollama) 평문 apiKey(Ollama 는 무시 — 더미 가능)
#   SEED_LLM_CONFIG_ID     (기본 seed-local-llm) LlmProviderConfig 의 고정 id(멱등 키이자
#                          평가 orchestrator 가 modelId 로 참조할 수 있는 안정 식별자)
#   LLM_APIKEY_ENC_KEY     (.env 필수) apiKey 암호화 키 — 미설정 시 실패
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"
cd "$REPO_DIR"

# .env 로드 — redeploy 가 export 하지 않으므로 직접 읽는다(SEED_LLM_* / POSTGRES_* /
# LLM_APIKEY_ENC_KEY). 단순 KEY=VALUE 가정(deploy/env.prod.example 형식).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"
if [ -z "$ENDPOINT" ]; then
  echo "[seed-llm] SEED_LLM_ENDPOINT_URL 미설정 — seed 생략(no-op)"
  exit 0
fi

PROVIDER="${SEED_LLM_PROVIDER:-custom}"
MODEL="${SEED_LLM_MODEL_ID:-gemma4:12b}"
APIKEY_PLAIN="${SEED_LLM_API_KEY:-ollama}"
CONFIG_ID="${SEED_LLM_CONFIG_ID:-seed-local-llm}"
PG_USER="${POSTGRES_USER:-assessment_agent}"
PG_DB="${POSTGRES_DB:-assessment_agent}"

if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]; then
  echo "[seed-llm] ERROR: LLM_APIKEY_ENC_KEY 가 .env 에 없습니다 — apiKey 암호화 불가" >&2
  exit 1
fi

echo "[seed-llm] $(date -Is) — provider=$PROVIDER endpoint=$ENDPOINT model=$MODEL id=$CONFIG_ID"

# 1) postgres ready 대기(최대 ~60s).
echo "[seed-llm] postgres ready 대기..."
ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 2
done
[ "$ready" = 1 ] || { echo "[seed-llm] ERROR: postgres 가 준비되지 않음" >&2; exit 1; }

# 2) app 컨테이너 ready 대기(encrypt one-liner 용 — node + dist 필요, 최대 ~60s).
echo "[seed-llm] app 컨테이너 대기..."
ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T app node -e 'process.exit(0)' >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 2
done
[ "$ready" = 1 ] || { echo "[seed-llm] ERROR: app 컨테이너가 준비되지 않음" >&2; exit 1; }

# 3) apiKey 암호화 — app 컨테이너 안에서 compiled cipher 직접 호출(컨테이너 env 의
#    LLM_APIKEY_ENC_KEY 사용). 평문은 **stdin 으로** 전달한다(argv 로 넘기면 컨테이너
#    `ps` 에 잠깐 노출되므로 회피). 출력은 ciphertext envelope 뿐.
CIPHERTEXT="$(printf '%s' "$APIKEY_PLAIN" | docker compose exec -T app node -e \
  'let d="";process.stdin.on("data",c=>{d+=c}).on("end",()=>{const {LlmApiKeyCipher}=require("/app/dist/src/llm/llm-apikey-cipher.service");process.stdout.write(new LlmApiKeyCipher().encrypt(d))})')"
if [ -z "$CIPHERTEXT" ]; then
  echo "[seed-llm] ERROR: apiKey 암호화 결과가 비어있음(LLM_APIKEY_ENC_KEY 확인)" >&2
  exit 1
fi

# 4) DB upsert — 고정 id 로 ON CONFLICT. 모든 값은 single-quote escape 후 리터럴 주입.
sql_escape() { printf "%s" "$1" | sed "s/'/''/g"; }
ID_E="$(sql_escape "$CONFIG_ID")"
PV_E="$(sql_escape "$PROVIDER")"
EP_E="$(sql_escape "$ENDPOINT")"
CT_E="$(sql_escape "$CIPHERTEXT")"
MD_E="$(sql_escape "$MODEL")"

docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO "LlmProviderConfig" ("id","provider","endpointUrl","apiKey","modelId","createdAt","updatedAt")
VALUES ('$ID_E','$PV_E','$EP_E','$CT_E','$MD_E', NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "provider"    = EXCLUDED."provider",
  "endpointUrl" = EXCLUDED."endpointUrl",
  "apiKey"      = EXCLUDED."apiKey",
  "modelId"     = EXCLUDED."modelId",
  "updatedAt"   = NOW();
SQL

echo "[seed-llm] OK — LlmProviderConfig 멱등 upsert 완료 (id=$CONFIG_ID)"
