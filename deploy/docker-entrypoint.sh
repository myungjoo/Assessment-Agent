#!/bin/sh
# 컨테이너 entrypoint — DB migration 적용 후 앱 기동.
# deployment.md "Migration 정책": 배포 환경은 `prisma migrate deploy` (idempotent,
# 미적용 migration 만 순차 적용). DATABASE_URL 은 compose 의 env_file(.env) 로 주입된다.
#
# 전제: prod 이미지는 `pnpm prune --prod` 로 typescript/ts-node 가 제거된 상태다.
# prisma CLI 는 자체 번들 로더로 TS `prisma.config.ts` 를 읽으므로 typescript 미설치여도
# 동작한다. 만약 이 단계에서 컨테이너가 crash-loop 하면 `docker logs <컨테이너>` 의
# "prisma migrate deploy 실행..." 직후 로그(config 로딩/DB 연결 오류)를 우선 확인한다.
# 본 경로는 CI 의 deploy-artifacts job 런타임 smoke 가 매 PR 마다 검증한다.
set -e

echo "[entrypoint] prisma migrate deploy 실행..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] NestJS 앱 기동 (node dist/main)..."
exec node dist/main
