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

echo "[redeploy] $(date -Is) — 미사용 이미지 정리"
docker image prune -f

echo "[redeploy] $(date -Is) — 완료 (현재 상태)"
docker compose ps
