#!/bin/sh
# 컨테이너 entrypoint — DB migration 적용 후 앱 기동.
# deployment.md "Migration 정책": 배포 환경은 `prisma migrate deploy` (idempotent,
# 미적용 migration 만 순차 적용). DATABASE_URL 은 compose 의 env_file(.env) 로 주입된다.
set -e

echo "[entrypoint] prisma migrate deploy 실행..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] NestJS 앱 기동 (node dist/main)..."
exec node dist/main
