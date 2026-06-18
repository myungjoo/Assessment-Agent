#!/usr/bin/env bash
# Assessment-Agent — main 기준 재배포 스크립트 (매일 밤 systemd timer/cron 에서 호출).
# 동작: origin/main 동기화 → 이미지 재빌드 → 컨테이너 무중단 교체 → 잔여 이미지 정리.
# 설치/사용 절차는 deploy/README.md 참조.
set -euo pipefail

# 배포 체크아웃 경로 / 브랜치 — 환경변수로 override 가능.
REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$REPO_DIR"

echo "[redeploy] $(date -Is) — origin/${BRANCH} 동기화"
git fetch --prune origin
git checkout "$BRANCH"
# 배포 체크아웃은 로컬 커밋이 없는 mirror 라는 전제. origin 상태로 정확히 정렬한다
# (drift 가 있어도 멱등하게 복구). 로컬에서 직접 수정하는 용도의 체크아웃이 아님.
git reset --hard "origin/${BRANCH}"

echo "[redeploy] $(date -Is) — 이미지 재빌드 + 컨테이너 교체"
# --build 로 새 코드 반영, up -d 로 변경된 서비스만 재생성. migration 은 app
# 컨테이너 entrypoint(prisma migrate deploy)가 기동 직전 자동 적용한다.
docker compose up -d --build

echo "[redeploy] $(date -Is) — (선택) LLM provider config seed"
# 환경 고유 LLM endpoint(예: 같은 LAN 로컬 PC 의 Ollama)를 쓰도록 DB 의
# LlmProviderConfig 를 멱등 seed 한다. .env 의 SEED_LLM_ENDPOINT_URL 가 설정된
# 경우에만 동작하고, 미설정이면 no-op 이라 공용 repo / 다른 환경엔 영향 0
# (deploy/seed-llm-config.sh, deploy/README.md §5.2). seed 실패는 재배포 자체를
# 깨지 않도록 경고만 남기고 계속 진행한다(앱은 이미 기동된 상태).
if [ -f "$REPO_DIR/deploy/seed-llm-config.sh" ]; then
  REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/seed-llm-config.sh" \
    || echo "[redeploy] 경고: LLM config seed 실패 — 재배포는 계속 (로그 확인)"
fi

echo "[redeploy] $(date -Is) — 미사용 이미지 정리"
# 주의: 호스트 전역 dangling 이미지를 정리한다(이 프로젝트 한정 아님). README 가
# 가정하는 "배포 전용 호스트"에서는 무해하다. 다른 컨테이너와 호스트를 공유한다면
# 본 줄을 제거하거나 `docker image prune -f --filter "label=..."` 로 범위를 좁힌다.
docker image prune -f

echo "[redeploy] $(date -Is) — 완료 (현재 상태)"
docker compose ps
